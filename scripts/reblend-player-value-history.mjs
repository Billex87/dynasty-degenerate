import fs from 'node:fs';
import path from 'node:path';
import { readArchiveHeader, streamArchivePlayers, writeArchive } from './value-history-archive-io.mjs';
import { getDefaultValueHistoryWeights } from './value-history-source-registry.mjs';

const rootDir = process.cwd();
const archivePath = process.env.ARCHIVE_FILE
  ? path.resolve(rootDir, process.env.ARCHIVE_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'one-time-source-history.json');
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'player-value-history-reblended.json');
const weightSpec = process.env.WEIGHTS || '';
const blendName = process.env.BLEND_NAME || 'ad-hoc-reblend';

const defaultWeights = getDefaultValueHistoryWeights();

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Recalculate historical blended values from a frozen raw value archive.',
    '',
    'Environment:',
    '  ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json',
    '  OUT_FILE=server/value-history-archive/player-value-history-reblended.json',
    '  BLEND_NAME=2026-05-new-weights',
    '  WEIGHTS=\'{"marketKtc":0.16,"fantasyCalc":0.1,"fantasyPros":0.12,"dynastyProcess":0.02,"dynastyNerds":0.21,"fantasyNerds":0.07,"flockFantasy":0.32}\'',
    '',
    'The raw archive is not modified. This writes a derived blend that can be regenerated any time weights change.',
  ].join('\n'));
  process.exit(0);
}

function parseWeights() {
  if (!weightSpec) return defaultWeights;
  const parsed = JSON.parse(weightSpec);
  return { ...defaultWeights, ...parsed };
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeFormat(format) {
  const raw = String(format || '').trim();
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();

  if (!raw) return 'default';
  if (upper === 'SUPERFLEX') return 'sf_ppr';
  if (upper === 'ONEQB' || upper === '1QB') return 'one_qb_ppr';
  if (upper === 'PROSPECTS_SF') return 'prospects_sf';
  if (upper === 'PROSPECTS') return 'prospects';
  if (lower === 'oneqb_ppr') return 'one_qb_ppr';
  return lower;
}

function sourceNameFromPoint(point) {
  if (Array.isArray(point.sources) && point.sources.length) return point.sources.join('+');
  if (point.importedSource) return point.importedSource;
  return 'unknown';
}

function mergeSourceValue(target, key, value) {
  const numeric = numberOrNull(value);
  if (!numeric) return;
  target[key] = target[key] ? Math.round((target[key] + numeric) / 2) : numeric;
}

function aggregatePlayerPoints(points) {
  const aggregates = new Map();

  for (const point of points || []) {
    if (!point?.date) continue;
    const format = normalizeFormat(point.format);
    const aggregateKey = `${point.date}|${format}`;
    const existing = aggregates.get(aggregateKey) || {
      date: point.date,
      format,
      rank: point.rank || null,
      overallRank: numberOrNull(point.overallRank),
      sourcePoints: 0,
      sourceNames: new Set(),
      importedSources: new Set(),
      market: {},
      expert: {},
      fallbackValues: [],
    };

    existing.rank = existing.rank || point.rank || null;
    existing.overallRank = existing.overallRank || numberOrNull(point.overallRank);
    existing.sourcePoints += 1;
    existing.sourceNames.add(sourceNameFromPoint(point));
    if (point.importedSource) existing.importedSources.add(point.importedSource);
    mergeSourceValue(existing.market, 'ktc', point.market?.ktc);
    mergeSourceValue(existing.market, 'fantasyCalc', point.market?.fantasyCalc);
    mergeSourceValue(existing.expert, 'fantasyPros', point.expert?.fantasyPros);
    mergeSourceValue(existing.expert, 'dynastyProcess', point.expert?.dynastyProcess);
    mergeSourceValue(existing.expert, 'dynastyNerds', point.expert?.dynastyNerds);
    mergeSourceValue(existing.expert, 'fantasyNerds', point.expert?.fantasyNerds);
    mergeSourceValue(existing.expert, 'flockFantasy', point.expert?.flockFantasy);
    const fallback = numberOrNull(point.value);
    if (fallback) existing.fallbackValues.push(fallback);
    aggregates.set(aggregateKey, existing);
  }

  return Array.from(aggregates.values()).map((point) => ({
    ...point,
    sources: Array.from(point.sourceNames).sort(),
    importedSources: Array.from(point.importedSources).sort(),
    value: point.fallbackValues.length
      ? Math.round(point.fallbackValues.reduce((sum, value) => sum + value, 0) / point.fallbackValues.length)
      : null,
  }));
}

function getSourceValues(point) {
  return {
    marketKtc: numberOrNull(point.market?.ktc),
    fantasyCalc: numberOrNull(point.market?.fantasyCalc),
    fantasyPros: numberOrNull(point.expert?.fantasyPros),
    dynastyProcess: numberOrNull(point.expert?.dynastyProcess),
    dynastyNerds: numberOrNull(point.expert?.dynastyNerds),
    fantasyNerds: numberOrNull(point.expert?.fantasyNerds),
    flockFantasy: numberOrNull(point.expert?.flockFantasy),
    fallback: numberOrNull(point.value),
  };
}

function blendPoint(point, weights) {
  const values = getSourceValues(point);
  const weighted = Object.entries(weights)
    .map(([source, weight]) => ({
      source,
      value: values[source],
      weight: Number(weight),
    }))
    .filter((row) => row.value !== null && Number.isFinite(row.weight) && row.weight > 0);

  if (!weighted.length) {
    return {
      date: point.date,
      format: point.format || null,
      value: values.fallback,
      sourceCount: values.fallback ? 1 : 0,
      sourcesUsed: values.fallback ? ['fallback'] : [],
      sourcePointCount: point.sourcePoints || 1,
      importedSources: point.importedSources || [],
    };
  }

  const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  const value = weighted.reduce((sum, row) => sum + row.value * row.weight, 0) / totalWeight;
  return {
    date: point.date,
    format: point.format || null,
    value: Math.round(value),
    sourceCount: weighted.length,
    sourcesUsed: weighted.map((row) => row.source),
    sourcePointCount: point.sourcePoints || weighted.length,
    importedSources: point.importedSources || [],
    rank: point.rank || null,
    overallRank: point.overallRank || null,
  };
}

async function* buildReblendedPlayers(filePath, weights, counters) {
  for await (const player of streamArchivePlayers(filePath)) {
    const points = aggregatePlayerPoints(player.points || [])
      .map((point) => blendPoint(point, weights))
      .filter((point) => point.date && point.value)
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.format || '').localeCompare(String(b.format || '')));

    if (!points.length) continue;
    counters.playerCount += 1;
    counters.pointCount += points.length;
    yield {
      key: player.key,
      name: player.name,
      position: player.position || null,
      points,
    };
  }
}

async function countReblendedPlayers(filePath, weights) {
  const counters = { playerCount: 0, pointCount: 0 };
  for await (const _player of buildReblendedPlayers(filePath, weights, counters)) {
    // Counting pass only. The write pass streams the actual player records.
  }
  return counters;
}

async function main() {
  if (!fs.existsSync(archivePath)) throw new Error(`Archive not found: ${archivePath}`);
  const archive = await readArchiveHeader(archivePath);
  const weights = parseWeights();
  const counters = await countReblendedPlayers(archivePath, weights);

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceArchive: path.relative(rootDir, archivePath),
    sourceArchiveGeneratedAt: archive.generatedAt || null,
    blendName,
    weights,
    playerCount: counters.playerCount,
    pointCount: counters.pointCount,
    policy: {
      note: 'Derived blend only. The raw historical source archive remains the source of truth.',
    },
  };

  await writeArchive(outputPath, result, buildReblendedPlayers(archivePath, weights, { playerCount: 0, pointCount: 0 }));
  console.log(`Reblended ${counters.pointCount} points for ${counters.playerCount} players to ${path.relative(rootDir, outputPath)}`);
}

main();
