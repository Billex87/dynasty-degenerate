import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const chromeExtensionRoot = path.join(repoRoot, "browser-extension", "sleeper-helper");
const safariDistRoot = path.join(repoRoot, "dist", "browser-extension", "safari-transaction-sync");
const includeLocalhost = process.argv.includes("--local");
const outputRoot = path.join(safariDistRoot, includeLocalhost ? "local-extension" : "extension");
const localhostMatches = new Set(["http://localhost:3000/*"]);

function filterLocalhostMatches(matches) {
  if (includeLocalhost) return matches || [];
  return (matches || []).filter((match) => !localhostMatches.has(match));
}

async function writeSafariManifest() {
  const manifest = JSON.parse(
    await readFile(path.join(chromeExtensionRoot, "manifest.json"), "utf8")
  );

  manifest.description =
    "Read-only Safari helper that imports pending Sleeper trades and waivers into Dynasty Degens.";
  manifest.host_permissions = filterLocalhostMatches(manifest.host_permissions);
  manifest.content_scripts = (manifest.content_scripts || [])
    .map((script) => ({
      ...script,
      matches: filterLocalhostMatches(script.matches),
    }))
    .filter((script) => script.matches.length > 0);

  await writeFile(
    path.join(outputRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

async function copyExtensionSource() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  await Promise.all([
    cp(path.join(chromeExtensionRoot, "background.js"), path.join(outputRoot, "background.js")),
    cp(path.join(chromeExtensionRoot, "popup.html"), path.join(outputRoot, "popup.html")),
    cp(path.join(chromeExtensionRoot, "popup.js"), path.join(outputRoot, "popup.js")),
    cp(path.join(chromeExtensionRoot, "assets"), path.join(outputRoot, "assets"), { recursive: true }),
    cp(path.join(chromeExtensionRoot, "content"), path.join(outputRoot, "content"), { recursive: true }),
    cp(path.join(chromeExtensionRoot, "icons"), path.join(outputRoot, "icons"), { recursive: true }),
  ]);

  await writeSafariManifest();
}

await copyExtensionSource();

const relativeOutput = path.relative(repoRoot, outputRoot);
console.log(`Safari Transaction Sync source ready: ${relativeOutput}`);
console.log(
  `Convert with: xcrun safari-web-extension-converter "${relativeOutput}" --app-name "Dynasty Degens Transaction Sync" --bundle-identifier "com.dynastydegens.transactionsync"`
);
