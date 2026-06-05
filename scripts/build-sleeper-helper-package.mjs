import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const extensionRoot = path.join(repoRoot, "browser-extension", "sleeper-helper");
const distRoot = path.join(repoRoot, "dist", "browser-extension", "sleeper-helper");
const packageRoot = path.join(distRoot, "package");

const iconSizes = [16, 32, 48, 128];

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function setPixel(pixels, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const index = (y * width + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function fillRect(pixels, width, x, y, rectWidth, rectHeight, color) {
  for (let yy = y; yy < y + rectHeight; yy += 1) {
    for (let xx = x; xx < x + rectWidth; xx += 1) {
      setPixel(pixels, width, xx, yy, color);
    }
  }
}

function drawBlockD(pixels, width, x, y, letterWidth, letterHeight, color) {
  const stroke = Math.max(2, Math.round(width * 0.08));
  fillRect(pixels, width, x, y, stroke, letterHeight, color);
  fillRect(pixels, width, x, y, letterWidth - stroke, stroke, color);
  fillRect(pixels, width, x, y + letterHeight - stroke, letterWidth - stroke, stroke, color);
  fillRect(pixels, width, x + letterWidth - stroke, y + stroke, stroke, letterHeight - stroke * 2, color);
}

function makeIconPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size * 0.42;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const glow = Math.max(0, 1 - dist / radius);
      const orange = Math.max(0, 1 - Math.hypot(x - size * 0.25, y - size * 0.85) / size);
      const cyan = Math.max(0, 1 - Math.hypot(x - size * 0.92, y - size * 0.12) / size);
      setPixel(pixels, size, x, y, [
        Math.round(5 + orange * 86 + glow * 18),
        Math.round(13 + cyan * 104 + glow * 34),
        Math.round(28 + cyan * 126 + orange * 24),
        255
      ]);
    }
  }

  const pad = Math.max(2, Math.round(size * 0.08));
  const border = Math.max(1, Math.round(size * 0.03));
  const teal = [34, 211, 238, 190];
  fillRect(pixels, size, pad, pad, size - pad * 2, border, teal);
  fillRect(pixels, size, pad, size - pad - border, size - pad * 2, border, teal);
  fillRect(pixels, size, pad, pad, border, size - pad * 2, teal);
  fillRect(pixels, size, size - pad - border, pad, border, size - pad * 2, teal);

  const letterHeight = Math.round(size * 0.44);
  const letterWidth = Math.round(size * 0.28);
  const y = Math.round(size * 0.3);
  drawBlockD(pixels, size, Math.round(size * 0.22), y, letterWidth, letterHeight, [251, 146, 60, 255]);
  drawBlockD(pixels, size, Math.round(size * 0.49), y, letterWidth, letterHeight, [103, 232, 249, 255]);

  const rawRows = [];
  for (let y = 0; y < size; y += 1) {
    rawRows.push(Buffer.from([0]));
    rawRows.push(pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rawRows))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

async function generateIcons() {
  const iconRoot = path.join(extensionRoot, "icons");
  await mkdir(iconRoot, { recursive: true });
  await Promise.all(iconSizes.map((size) =>
    writeFile(path.join(iconRoot, `icon-${size}.png`), makeIconPng(size))
  ));
}

async function copyExtensionFiles() {
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(packageRoot, { recursive: true });
  await Promise.all([
    cp(path.join(extensionRoot, "manifest.json"), path.join(packageRoot, "manifest.json")),
    cp(path.join(extensionRoot, "background.js"), path.join(packageRoot, "background.js")),
    cp(path.join(extensionRoot, "popup.html"), path.join(packageRoot, "popup.html")),
    cp(path.join(extensionRoot, "popup.js"), path.join(packageRoot, "popup.js")),
    cp(path.join(extensionRoot, "content"), path.join(packageRoot, "content"), { recursive: true }),
    cp(path.join(extensionRoot, "icons"), path.join(packageRoot, "icons"), { recursive: true })
  ]);
}

async function packageExtension() {
  const manifest = JSON.parse(await readFile(path.join(extensionRoot, "manifest.json"), "utf8"));
  const zipPath = path.join(distRoot, `dynasty-degens-sleeper-helper-${manifest.version}.zip`);
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: packageRoot });
  return zipPath;
}

await generateIcons();
await copyExtensionFiles();
const zipPath = await packageExtension();
console.log(`Sleeper Helper package ready: ${path.relative(repoRoot, zipPath)}`);
