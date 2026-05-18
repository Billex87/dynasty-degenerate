import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const shardDir = path.resolve(
  rootDir,
  process.env.SHARD_DIR || 'server/value-history-archive/player-value-history-shards'
);
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'value-history-movement-audit.json');
const focusFormats = new Set(
  String(process.env.FOCUS_FORMATS || 'sf_ppr,one_qb_ppr')
    .split(',')
    .map((format) => format.trim())
    .filter(Boolean)
);
const maxJumpDays = Number(process.env.MAX_JUMP_DAYS || 14);
const minJumpValue = Number(process.env.MIN_JUMP_VALUE || 900);
const minJumpPct = Number(process.env.MIN_JUMP_PCT || 12);
const maxExamples = Number(process.env.MAX_EXAMPLES || 250);

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function daysBetween(left, right) {
  const start = new Date(`${left}T00:00:00.000Z`).getTime();
  const end = new Date(`${right}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function sourceSignature(point) {
  return (point.sources || []).slice().sort().join('|');
}

function rankSignature(point) {
  return String(point.rank || '').trim().toUpperCase();
}

function sourceAddedOrRemoved(left, right) {
  const leftSources = new Set(left.sources || []);
  const rightSources = new Set(right.sources || []);
  return leftSources.size !== rightSources.size
    || Array.from(leftSources).some((source) => !rightSources.has(source))
    || Array.from(rightSources).some((source) => !leftSources.has(source));
}

function loadPoints(formatTimeline) {
  const points = Array.isArray(formatTimeline.asOfPoints) && formatTimeline.asOfPoints.length
    ? formatTimeline.asOfPoints
    : formatTimeline.windows?.all?.points || [];
  return points
    .filter((point) => point?.date && numberOrNull(point.value))
    .map((point) => ({ ...point, value: Math.round(Number(point.value)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function auditFormat(player, formatKey, formatTimeline, result) {
  if (!['QB', 'RB', 'WR', 'TE'].includes(String(player.position || '').toUpperCase())) return;
  const points = loadPoints(formatTimeline);
  if (points.length < 2) return;
  result.formatCount += 1;
  result.pointCount += points.length;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const days = daysBetween(previous.date, current.date);
    if (days === null || days < 0 || days > maxJumpDays) continue;
    const delta = current.value - previous.value;
    const deltaPct = previous.value ? (delta / previous.value) * 100 : 0;
    if (Math.abs(delta) < minJumpValue || Math.abs(deltaPct) < minJumpPct) continue;

    const sourceSetChanged = sourceSignature(previous) !== sourceSignature(current);
    const jump = {
      player: player.name,
      position: player.position || null,
      format: formatKey,
      fromDate: previous.date,
      toDate: current.date,
      days,
      fromValue: previous.value,
      toValue: current.value,
      fromRank: previous.rank || null,
      toRank: current.rank || null,
      delta,
      deltaPct: Math.round(deltaPct * 10) / 10,
      fromSources: previous.sources || [],
      toSources: current.sources || [],
      sourceSetChanged,
      sourceAddedOrRemoved: sourceAddedOrRemoved(previous, current),
    };
    if (sourceSetChanged) result.sourceMixJumps += 1;
    if (rankSignature(previous) && rankSignature(previous) === rankSignature(current)) {
      result.sameRankJumpCount += 1;
    }
    result.suspiciousJumpCount += 1;
    if (result.examples.length < maxExamples) result.examples.push(jump);
  }
}

function auditShard(filePath, result) {
  const shard = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const player of Object.values(shard.players || {})) {
    result.playerCount += 1;
    for (const [formatKey, formatTimeline] of Object.entries(player.formats || {})) {
      if (focusFormats.size && !focusFormats.has(formatKey)) continue;
      auditFormat(player, formatKey, formatTimeline, result);
    }
  }
}

if (!fs.existsSync(shardDir)) {
  console.error(`Shard directory not found: ${path.relative(rootDir, shardDir)}`);
  process.exit(1);
}

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  shardDir: path.relative(rootDir, shardDir),
  focusFormats: Array.from(focusFormats),
  thresholds: {
    maxJumpDays,
    minJumpValue,
    minJumpPct,
  },
  playerCount: 0,
  formatCount: 0,
  pointCount: 0,
  suspiciousJumpCount: 0,
  sameRankJumpCount: 0,
  sourceMixJumps: 0,
  examples: [],
};

const shardFiles = fs.readdirSync(shardDir)
  .filter((fileName) => fileName.endsWith('.json') && fileName !== 'manifest.json')
  .sort();

for (const fileName of shardFiles) {
  auditShard(path.join(shardDir, fileName), result);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(JSON.stringify({
  shardFiles: shardFiles.length,
  focusFormats: result.focusFormats,
  players: result.playerCount,
  formats: result.formatCount,
  points: result.pointCount,
  suspiciousJumps: result.suspiciousJumpCount,
  sameRankJumps: result.sameRankJumpCount,
  sourceMixJumps: result.sourceMixJumps,
  output: path.relative(rootDir, outputPath),
}, null, 2));
