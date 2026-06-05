import { execFileSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  "logos",
  "png",
  "dd-mark-3d-transparent.png"
);

const iconSizes = [16, 32, 48, 128];

async function generateIcons() {
  const iconRoot = path.join(extensionRoot, "icons");
  const tempRoot = path.join(distRoot, "icon-work");
  await mkdir(iconRoot, { recursive: true });
  await rm(tempRoot, { recursive: true, force: true });
  await mkdir(tempRoot, { recursive: true });

  iconSizes.forEach((size) => {
    const resizedPath = path.join(tempRoot, `icon-${size}-resized.png`);
    execFileSync("sips", [
      "-Z",
      String(size),
      sourceLogo,
      "--out",
      resizedPath
    ], { stdio: "ignore" });
    execFileSync("sips", [
      "-p",
      String(size),
      String(size),
      resizedPath,
      "--out",
      path.join(iconRoot, `icon-${size}.png`)
    ], { stdio: "ignore" });
  });

  await rm(tempRoot, { recursive: true, force: true });
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
  const manifest = await import(path.join(extensionRoot, "manifest.json"), {
    with: { type: "json" }
  });
  const zipPath = path.join(
    distRoot,
    `dynasty-degens-sleeper-helper-${manifest.default.version}.zip`
  );
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: packageRoot });
  return zipPath;
}

await generateIcons();
await copyExtensionFiles();
const zipPath = await packageExtension();
console.log(`Sleeper Helper package ready: ${path.relative(repoRoot, zipPath)}`);
