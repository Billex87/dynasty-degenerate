import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const extensionRoot = path.join(repoRoot, "browser-extension", "sleeper-helper");
const distRoot = path.join(repoRoot, "dist", "browser-extension", "sleeper-helper");
const packageRoot = path.join(distRoot, "package");
const sourceLogo = path.join(
  repoRoot,
  "client",
  "public",
  "brand",
  "dd-logo-transparent.png"
);

const iconSizes = [16, 32, 48, 128];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const iconAlphaTrimThreshold = 8;
const storePackageExcludedMatches = new Set(["http://localhost:3000/*"]);

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  return upDistance <= upLeftDistance ? up : upLeft;
}

function decodePng(buffer) {
  if (!buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error("Source logo is not a PNG.");
  }

  let offset = pngSignature.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.toString("ascii", offset, offset + 4);
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length + 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlaceMethod = data[12];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || interlaceMethod !== 0 || ![2, 6].includes(colorType)) {
    throw new Error("Source logo must be an 8-bit non-interlaced RGB or RGBA PNG.");
  }

  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const rowLength = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const decoded = new Uint8Array(height * rowLength);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowOffset = y * rowLength;
    const previousRowOffset = rowOffset - rowLength;

    for (let x = 0; x < rowLength; x += 1) {
      const raw = inflated[sourceOffset];
      sourceOffset += 1;
      const left = x >= bytesPerPixel ? decoded[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? decoded[previousRowOffset + x] : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel
          ? decoded[previousRowOffset + x - bytesPerPixel]
          : 0;

      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paethPredictor(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);

      decoded[rowOffset + x] = value & 255;
    }
  }

  const pixels = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const sourceIndex = index * channels;
    const outputIndex = index * 4;
    pixels[outputIndex] = decoded[sourceIndex];
    pixels[outputIndex + 1] = decoded[sourceIndex + 1];
    pixels[outputIndex + 2] = decoded[sourceIndex + 2];
    pixels[outputIndex + 3] = colorType === 6 ? decoded[sourceIndex + 3] : 255;
  }

  return { width, height, pixels };
}

function findAlphaBounds(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.pixels[(y * image.width + x) * 4 + 3];
      if (alpha <= iconAlphaTrimThreshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: image.width - 1, maxY: image.height - 1 };
  }

  return { minX, minY, maxX, maxY };
}

function samplePremultipliedBilinear(image, x, y) {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
  const tx = Math.max(0, Math.min(1, x - x0));
  const ty = Math.max(0, Math.min(1, y - y0));
  const samples = [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x1, y0, tx * (1 - ty)],
    [x0, y1, (1 - tx) * ty],
    [x1, y1, tx * ty],
  ];
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;

  samples.forEach(([sampleX, sampleY, weight]) => {
    const index = (sampleY * image.width + sampleX) * 4;
    const sampleAlpha = image.pixels[index + 3] / 255;
    const weightedAlpha = sampleAlpha * weight;
    red += image.pixels[index] * weightedAlpha;
    green += image.pixels[index + 1] * weightedAlpha;
    blue += image.pixels[index + 2] * weightedAlpha;
    alpha += weightedAlpha;
  });

  if (alpha <= 0) return [0, 0, 0, 0];
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

function renderIcon(image, bounds, size) {
  const cropWidth = bounds.maxX - bounds.minX + 1;
  const cropHeight = bounds.maxY - bounds.minY + 1;
  const padding = size >= 48 ? Math.max(1, Math.round(size * 0.015)) : 0;
  const contentSize = size - padding * 2;
  const scale = contentSize / Math.max(cropWidth, cropHeight);
  const renderWidth = Math.min(size, Math.round(cropWidth * scale));
  const renderHeight = Math.min(size, Math.round(cropHeight * scale));
  const offsetX = Math.floor((size - renderWidth) / 2);
  const offsetY = Math.floor((size - renderHeight) / 2);
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < renderHeight; y += 1) {
    for (let x = 0; x < renderWidth; x += 1) {
      const sourceX = bounds.minX + (x + 0.5) / scale - 0.5;
      const sourceY = bounds.minY + (y + 0.5) / scale - 0.5;
      const [red, green, blue, alpha] = samplePremultipliedBilinear(
        image,
        sourceX,
        sourceY
      );
      const outputIndex = ((offsetY + y) * size + offsetX + x) * 4;
      pixels[outputIndex] = red;
      pixels[outputIndex + 1] = green;
      pixels[outputIndex + 2] = blue;
      pixels[outputIndex + 3] = alpha;
    }
  }

  return { width: size, height: size, pixels };
}

const crcTable = Array.from({ length: 256 }, (_, tableIndex) => {
  let crc = tableIndex;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(image) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLength = image.width * 4;
  const raw = Buffer.alloc((rowLength + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    const rowOffset = y * (rowLength + 1);
    raw[rowOffset] = 0;
    Buffer.from(image.pixels.buffer, image.pixels.byteOffset + y * rowLength, rowLength).copy(
      raw,
      rowOffset + 1
    );
  }

  return Buffer.concat([
    pngSignature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND"),
  ]);
}

async function generateIcons() {
  const iconRoot = path.join(extensionRoot, "icons");
  await mkdir(iconRoot, { recursive: true });
  const source = decodePng(await readFile(sourceLogo));
  const bounds = findAlphaBounds(source);

  await Promise.all(
    iconSizes.map((size) =>
      writeFile(
        path.join(iconRoot, `icon-${size}.png`),
        encodePng(renderIcon(source, bounds, size))
      )
    )
  );
}

async function copyExtensionFiles() {
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(packageRoot, { recursive: true });
  await Promise.all([
    cp(path.join(extensionRoot, "background.js"), path.join(packageRoot, "background.js")),
    cp(path.join(extensionRoot, "popup.html"), path.join(packageRoot, "popup.html")),
    cp(path.join(extensionRoot, "popup.js"), path.join(packageRoot, "popup.js")),
    cp(path.join(extensionRoot, "assets"), path.join(packageRoot, "assets"), { recursive: true }),
    cp(path.join(extensionRoot, "content"), path.join(packageRoot, "content"), { recursive: true }),
    cp(path.join(extensionRoot, "icons"), path.join(packageRoot, "icons"), { recursive: true })
  ]);
  await writeStoreManifest();
}

async function writeStoreManifest() {
  const manifestPath = path.join(extensionRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.host_permissions = (manifest.host_permissions || []).filter(
    (match) => !storePackageExcludedMatches.has(match)
  );
  manifest.content_scripts = (manifest.content_scripts || [])
    .map((script) => ({
      ...script,
      matches: (script.matches || []).filter(
        (match) => !storePackageExcludedMatches.has(match)
      )
    }))
    .filter((script) => script.matches.length > 0);

  await writeFile(
    path.join(packageRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

async function packageExtension() {
  const manifest = await import(path.join(extensionRoot, "manifest.json"), {
    with: { type: "json" }
  });
  const zipPath = path.join(
    distRoot,
    `dynasty-degens-transaction-sync-${manifest.default.version}.zip`
  );
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: packageRoot });
  return zipPath;
}

await generateIcons();
await copyExtensionFiles();
const zipPath = await packageExtension();
console.log(`Transaction Sync package ready: ${path.relative(repoRoot, zipPath)}`);
