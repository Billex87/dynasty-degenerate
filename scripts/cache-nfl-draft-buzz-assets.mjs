import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const SNAPSHOT_DIR = path.join(ROOT_DIR, 'server', 'prospect-snapshots');
const TEAM_STYLE_FILE = path.join(ROOT_DIR, 'client', 'src', 'lib', 'teamTileStyle.ts');
const OUTPUT_DIR = path.join(ROOT_DIR, 'client', 'public', 'assets', 'draftbuzz-cache');
const MANIFEST_FILE = path.join(OUTPUT_DIR, 'manifest.json');
const FETCH_TIMEOUT_MS = 30000;
const FETCH_RETRIES = 2;
const CONCURRENCY = Number(process.env.DRAFT_BUZZ_ASSET_CONCURRENCY || 8);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeFileName(value) {
  return String(value || '')
    .replace(/%20/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function fileNameFromUrl(url) {
  try {
    const parsed = new URL(decodeHtmlEntities(url));
    return sanitizeFileName(decodeURIComponent(parsed.pathname.split('/').pop() || ''));
  } catch {
    return null;
  }
}

function localPathForSource(url) {
  const fileName = fileNameFromUrl(url);
  if (!fileName) return null;
  if (/\/Content\/PlayerHeadShots(?:Small)?\//i.test(url)) return `player-headshots/${fileName}`;
  if (/\/Content\/collmascots\//i.test(url)) return `college-logos/${fileName}`;
  if (/\/Content\/NFLLogos\//i.test(url)) return `nfl-logos/${fileName.toLowerCase()}`;
  if (/\/i\/teamlogos\/ncaa\/500\/(\d+)\.png/i.test(url)) {
    const id = url.match(/\/i\/teamlogos\/ncaa\/500\/(\d+)\.png/i)?.[1];
    return id ? `college-logos/espn-${id}.png` : null;
  }
  if (/sleepercdn\.com\/images\/team_logos\/nfl\/([a-z]{2,3})\.png/i.test(url)) {
    const team = url.match(/\/nfl\/([a-z]{2,3})\.png/i)?.[1];
    return team ? `nfl-logos/${team.toLowerCase()}.png` : null;
  }
  return null;
}

function normalizeDraftBuzzAssetSourceUrl(url) {
  const normalized = decodeHtmlEntities(url)
    .replace('/Content/PlayerHeadShotsSmall/', '/Content/PlayerHeadShots/')
    .replace('/Content/collmascotsSmall/', '/Content/collmascots/');
  try {
    const parsed = new URL(normalized);
    if (parsed.hostname.endsWith('nfldraftbuzz.com')) {
      parsed.protocol = 'https:';
      return parsed.toString();
    }
  } catch {
    return normalized;
  }
  return normalized;
}

function readConstRecord(source, constName) {
  const match = source.match(new RegExp(`const\\s+${constName}:[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\};`));
  if (!match) return [];
  return Array.from(match[1].matchAll(/['"]?([A-Z0-9 &._-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g))
    .map((entry) => ({ key: entry[1], value: entry[2] }));
}

async function collectAssetUrls() {
  const urls = new Set();
  const snapshotFiles = await fs.readdir(SNAPSHOT_DIR);
  for (const file of snapshotFiles) {
    if (!file.endsWith('.json')) continue;
    const payload = JSON.parse(await fs.readFile(path.join(SNAPSHOT_DIR, file), 'utf-8'));
    for (const player of payload.players || []) {
      if (player.playerImageUrl) urls.add(normalizeDraftBuzzAssetSourceUrl(player.playerImageUrl));
      if (player.collegeLogoUrl) urls.add(normalizeDraftBuzzAssetSourceUrl(player.collegeLogoUrl));
    }
  }

  const teamStyleSource = await fs.readFile(TEAM_STYLE_FILE, 'utf-8');
  for (const { key } of readConstRecord(teamStyleSource, 'NFL_TEAM_COLORS')) {
    urls.add(`https://sleepercdn.com/images/team_logos/nfl/${key.toLowerCase()}.png`);
  }
  for (const { value } of readConstRecord(teamStyleSource, 'COLLEGE_NFL_DRAFT_BUZZ_LOGO_SLUGS')) {
    urls.add(`https://www.nfldraftbuzz.com/Content/collmascots/${value}.png`);
  }
  for (const { value } of readConstRecord(teamStyleSource, 'COLLEGE_ESPN_LOGO_IDS')) {
    urls.add(`https://a.espncdn.com/i/teamlogos/ncaa/500/${value}.png`);
  }

  return Array.from(urls)
    .map((sourceUrl) => ({ sourceUrl, localPath: localPathForSource(sourceUrl) }))
    .filter((asset) => asset.localPath);
}

async function fetchBuffer(url) {
  const normalizedUrl = decodeHtmlEntities(url);
  let lastError = null;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(normalizedUrl, {
        headers: {
          accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
          'user-agent': 'DynastyDegeneratesAssetCache/1.0',
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) throw new Error(`unexpected content-type ${contentType || 'unknown'}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_RETRIES) await sleep(350 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error('fetch failed');
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function downloadAsset(asset) {
  const outputFile = path.join(OUTPUT_DIR, asset.localPath);
  if (await fileExists(outputFile)) return { ...asset, status: 'cached' };
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  const buffer = await fetchBuffer(asset.sourceUrl);
  await fs.writeFile(outputFile, buffer);
  return { ...asset, status: 'downloaded', bytes: buffer.length };
}

async function runPool(items, worker) {
  const results = [];
  let index = 0;
  async function next() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      try {
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      } catch (error) {
        results[currentIndex] = {
          ...items[currentIndex],
          status: 'failed',
          error: error instanceof Error ? error.message : 'failed',
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(CONCURRENCY, items.length)) }, next));
  return results;
}

const collectedAssets = await collectAssetUrls();
const byLocalPath = new Map();
for (const asset of collectedAssets) {
  if (!byLocalPath.has(asset.localPath)) byLocalPath.set(asset.localPath, asset);
}
const assets = Array.from(byLocalPath.values()).sort((a, b) => a.localPath.localeCompare(b.localPath));

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const results = await runPool(assets, async (asset, index) => {
  const result = await downloadAsset(asset);
  if ((index + 1) % 50 === 0 || index === assets.length - 1) {
    console.log(`${index + 1}/${assets.length} assets processed`);
  }
  return result;
});

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'NFL Draft Buzz snapshots plus stable team logo sources',
  outputBasePath: '/assets/draftbuzz-cache',
  assets: results,
};

await fs.writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
const summary = results.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({
  outputDir: OUTPUT_DIR,
  manifestFile: MANIFEST_FILE,
  total: results.length,
  ...summary,
}, null, 2));
