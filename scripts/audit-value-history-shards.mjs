import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const shardDir = path.resolve(
  rootDir,
  process.env.SHARD_DIR || 'server/value-history-archive/player-value-history-shards'
);
const minPlayers = Number(process.env.MIN_PLAYERS || 1500);
const minShardCount = Number(process.env.MIN_SHARDS || 120);
const maxLargestShardBytes = Number(process.env.MAX_LARGEST_SHARD_BYTES || 15 * 1024 * 1024);
const requiredPlayers = (process.env.REQUIRED_PLAYERS || 'Bijan Robinson,Malachi Fields,Luther Burden')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${bytes} B`;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getShardKey(value) {
  return normalizeName(value).slice(0, 2) || '__';
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message) {
  console.error(`[value-history-shards] ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(shardDir)) {
  fail(`Shard directory not found: ${path.relative(rootDir, shardDir)}`);
  process.exit();
}

const manifestPath = path.join(shardDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  fail(`Manifest not found: ${path.relative(rootDir, manifestPath)}`);
  process.exit();
}

const manifest = readJson(manifestPath);
const shardFiles = fs.readdirSync(shardDir)
  .filter((fileName) => fileName.endsWith('.json') && fileName !== 'manifest.json')
  .sort();

let totalBytes = fs.statSync(manifestPath).size;
let largestShard = { file: '', bytes: 0 };
for (const fileName of shardFiles) {
  const bytes = fs.statSync(path.join(shardDir, fileName)).size;
  totalBytes += bytes;
  if (bytes > largestShard.bytes) largestShard = { file: fileName, bytes };
}

const missingPlayers = [];
for (const playerName of requiredPlayers) {
  const shardPath = path.join(shardDir, `${getShardKey(playerName)}.json`);
  if (!fs.existsSync(shardPath)) {
    missingPlayers.push(playerName);
    continue;
  }

  const shard = readJson(shardPath);
  const wanted = normalizeName(playerName);
  const found = Object.entries(shard.players || {}).some(([key, player]) => {
    const keys = [
      key,
      player?.key,
      player?.name,
      ...(Array.isArray(player?.lookupKeys) ? player.lookupKeys : []),
    ].map(normalizeName);
    return keys.includes(wanted);
  });
  if (!found) missingPlayers.push(playerName);
}

if (Number(manifest.playerCount || 0) < minPlayers) {
  fail(`Player count ${manifest.playerCount || 0} is below minimum ${minPlayers}`);
}
if (shardFiles.length < minShardCount) {
  fail(`Shard count ${shardFiles.length} is below minimum ${minShardCount}`);
}
if (largestShard.bytes > maxLargestShardBytes) {
  fail(`Largest shard ${largestShard.file} is ${formatBytes(largestShard.bytes)}, above limit ${formatBytes(maxLargestShardBytes)}`);
}
if (missingPlayers.length) {
  fail(`Required players missing from shard store: ${missingPlayers.join(', ')}`);
}

console.log(JSON.stringify({
  ok: process.exitCode !== 1,
  shardDir: path.relative(rootDir, shardDir),
  generatedAt: manifest.generatedAt || null,
  sourceArchive: manifest.sourceArchive || null,
  blendName: manifest.blendName || null,
  playerCount: manifest.playerCount || 0,
  formatCount: manifest.formatCount || 0,
  shardCount: shardFiles.length,
  manifestShardCount: manifest.shardCount || 0,
  totalBytes,
  totalSize: formatBytes(totalBytes),
  largestShard,
  largestShardSize: formatBytes(largestShard.bytes),
  requiredPlayers,
}, null, 2));
