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
const sourceMaturityRampDays = Number(process.env.SOURCE_MATURITY_RAMP_DAYS || 90);
const sourceMaturityMinFactor = Number(process.env.SOURCE_MATURITY_MIN_FACTOR || 0.15);
const rankNormalizationWeight = Number(process.env.HISTORICAL_RANK_NORMALIZATION_WEIGHT || 1);
const rankCurveLookbackDays = Number(process.env.RANK_CURVE_LOOKBACK_DAYS || 21);

const defaultWeights = getDefaultValueHistoryWeights();
const SOURCE_VALUE_FIELDS = {
  marketKtc: 'marketKtc',
  fantasyCalc: 'fantasyCalcDynasty',
  fantasyPros: 'fantasyProsDynasty',
  dynastyProcess: 'dynastyProcess',
  dynastyNerds: 'dynastyNerds',
  flockFantasy: 'flockFantasy',
};

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Recalculate historical blended values from a frozen raw value archive.',
    '',
    'Environment:',
    '  ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json',
    '  OUT_FILE=server/value-history-archive/player-value-history-reblended.json',
    '  BLEND_NAME=2026-05-new-weights',
    '  WEIGHTS=\'{"marketKtc":0.23,"fantasyCalc":0.1,"fantasyPros":0.12,"dynastyProcess":0.02,"dynastyNerds":0.21,"flockFantasy":0.32}\'',
    '  SOURCE_MATURITY_RAMP_DAYS=90',
    '  SOURCE_MATURITY_MIN_FACTOR=0.15',
    '  HISTORICAL_RANK_NORMALIZATION_WEIGHT=1',
    '  RANK_CURVE_LOOKBACK_DAYS=21',
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
    flockFantasy: numberOrNull(point.expert?.flockFantasy),
    fallback: numberOrNull(point.value),
  };
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function dateMinusDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function buildSourceFirstSeen(points) {
  const firstSeen = new Map();
  for (const point of points) {
    const values = getSourceValues(point);
    for (const [source, value] of Object.entries(values)) {
      if (source === 'fallback' || !value) continue;
      const key = `${point.format || 'default'}|${source}`;
      const current = firstSeen.get(key);
      if (!current || point.date < current) firstSeen.set(key, point.date);
    }
  }
  return firstSeen;
}

function getSourceMaturityFactor(point, source, firstSeen, sourceCount) {
  if (sourceCount <= 1 || sourceMaturityRampDays <= 0) return 1;
  const firstDate = firstSeen.get(`${point.format || 'default'}|${source}`);
  if (!firstDate) return 1;
  const ageDays = daysBetween(firstDate, point.date);
  if (ageDays >= sourceMaturityRampDays) return 1;
  const minFactor = Math.max(0, Math.min(1, sourceMaturityMinFactor));
  return minFactor + (1 - minFactor) * (ageDays / sourceMaturityRampDays);
}

function parsePositionRank(rank, fallbackPosition) {
  const match = String(rank || '').toUpperCase().match(/\b(QB|RB|WR|TE)\s*([0-9]{1,3})\b/);
  if (match) return { position: match[1], rank: Number(match[2]) };
  const position = String(fallbackPosition || '').toUpperCase();
  const overallRank = Number(rank);
  if (['QB', 'RB', 'WR', 'TE'].includes(position) && Number.isFinite(overallRank) && overallRank > 0) {
    return { position, rank: overallRank };
  }
  return null;
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatCurveKey(format, position) {
  return `${format || 'default'}|${position}`;
}

function getCurveValue(curves, format, position, rank) {
  const curve = curves?.get(formatCurveKey(format, position));
  if (!curve) return null;
  if (curve.has(rank)) return curve.get(rank);

  for (let offset = 1; offset <= 5; offset += 1) {
    const nearby = [
      curve.get(rank - offset),
      curve.get(rank + offset),
    ].filter(Boolean);
    const value = median(nearby);
    if (value) return value;
  }

  return null;
}

function normalizeValueToRankCurve(point, blendedValue, rankCurves) {
  if (!rankCurves || rankNormalizationWeight <= 0) return blendedValue;
  const parsedRank = parsePositionRank(point.rank, point.position);
  if (!parsedRank) return blendedValue;
  const rankValue = getCurveValue(rankCurves, point.format, parsedRank.position, parsedRank.rank);
  if (!rankValue) return blendedValue;
  const weight = Math.max(0, Math.min(1, rankNormalizationWeight));
  return Math.round((blendedValue * (1 - weight)) + (rankValue * weight));
}

function attachSourceValues(target, values) {
  for (const [source, field] of Object.entries(SOURCE_VALUE_FIELDS)) {
    const value = values[source];
    if (value) target[field] = Math.round(value);
  }
  return target;
}

function buildRankCurvePoint(points, position) {
  const sorted = points
    .filter((point) => point?.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  if (!latest) return null;

  const startDate = dateMinusDays(latest.date, rankCurveLookbackDays);
  const recent = sorted.filter((point) => point.date >= startDate);
  const sourceValues = {};
  for (const point of recent) {
    const values = getSourceValues(point);
    for (const [source, value] of Object.entries(values)) {
      if (source === 'fallback' || !value) continue;
      sourceValues[source] = value;
    }
  }

  return {
    ...latest,
    position,
    market: {
      ktc: sourceValues.marketKtc || null,
      fantasyCalc: sourceValues.fantasyCalc || null,
    },
    expert: {
      fantasyPros: sourceValues.fantasyPros || null,
      dynastyProcess: sourceValues.dynastyProcess || null,
      dynastyNerds: sourceValues.dynastyNerds || null,
      flockFantasy: sourceValues.flockFantasy || null,
    },
    value: latest.value,
    sourcePoints: Object.values(sourceValues).filter(Boolean).length || latest.sourcePoints || 1,
  };
}

function blendPoint(point, weights, sourceFirstSeen, rankCurves) {
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
    return attachSourceValues(fallbackPoint, values);
  }

  const adjusted = weighted.map((row) => ({
    ...row,
    weight: row.weight * getSourceMaturityFactor(point, row.source, sourceFirstSeen, weighted.length),
  })).filter((row) => row.weight > 0);
  const rowsForBlend = adjusted.length ? adjusted : weighted;
  const totalWeight = rowsForBlend.reduce((sum, row) => sum + row.weight, 0);
  const value = rowsForBlend.reduce((sum, row) => sum + row.value * row.weight, 0) / totalWeight;
  const normalizedValue = normalizeValueToRankCurve(point, Math.round(value), rankCurves);
  const blendedPoint = {
    date: point.date,
    format: point.format || null,
    value: normalizedValue,
    sourceCount: rowsForBlend.length,
    sourcesUsed: rowsForBlend.map((row) => row.source),
    sourcePointCount: point.sourcePoints || rowsForBlend.length,
    importedSources: point.importedSources || [],
    rank: point.rank || null,
    overallRank: point.overallRank || null,
  };
  return attachSourceValues(blendedPoint, values);
}

async function buildRankCurves(filePath, weights) {
  const latestByPlayerFormat = [];

  for await (const player of streamArchivePlayers(filePath)) {
    const aggregatedPoints = aggregatePlayerPoints(player.points || []).map((point) => ({
      ...point,
      position: player.position || null,
    }));
    const byFormat = new Map();

    for (const point of aggregatedPoints) {
      const rows = byFormat.get(point.format) || [];
      rows.push(point);
      byFormat.set(point.format, rows);
    }

    for (const [format, points] of byFormat) {
      const rankCurvePoint = buildRankCurvePoint(points, player.position || null);
      if (!rankCurvePoint) continue;
      const blended = blendPoint(rankCurvePoint, weights, new Map(), null);
      if (blended.value) latestByPlayerFormat.push({ ...rankCurvePoint, format, blendedValue: blended.value });
    }
  }

  const rawCurves = new Map();
  for (const point of latestByPlayerFormat) {
    const parsedRank = parsePositionRank(point.rank, point.position);
    if (!parsedRank || !point.blendedValue) continue;
    const key = formatCurveKey(point.format, parsedRank.position);
    const rows = rawCurves.get(key) || new Map();
    const values = rows.get(parsedRank.rank) || [];
    values.push(point.blendedValue);
    rows.set(parsedRank.rank, values);
    rawCurves.set(key, rows);
  }

  const curves = new Map();
  for (const [key, rows] of rawCurves) {
    const curve = new Map();
    for (const [rank, values] of rows) {
      const value = median(values);
      if (value) curve.set(rank, Math.round(value));
    }
    curves.set(key, curve);
  }

  return curves;
}

async function* buildReblendedPlayers(filePath, weights, counters, rankCurves) {
  for await (const player of streamArchivePlayers(filePath)) {
    const aggregatedPoints = aggregatePlayerPoints(player.points || []).map((point) => ({
      ...point,
      position: player.position || null,
    }));
    const sourceFirstSeen = buildSourceFirstSeen(aggregatedPoints);
    const points = aggregatedPoints
      .map((point) => blendPoint(point, weights, sourceFirstSeen, rankCurves))
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

async function countReblendedPlayers(filePath, weights, rankCurves) {
  const counters = { playerCount: 0, pointCount: 0 };
  for await (const _player of buildReblendedPlayers(filePath, weights, counters, rankCurves)) {
    // Counting pass only. The write pass streams the actual player records.
  }
  return counters;
}

async function main() {
  if (!fs.existsSync(archivePath)) throw new Error(`Archive not found: ${archivePath}`);
  const archive = await readArchiveHeader(archivePath);
  const weights = parseWeights();
  const rankCurves = rankNormalizationWeight > 0 ? await buildRankCurves(archivePath, weights) : null;
  const counters = await countReblendedPlayers(archivePath, weights, rankCurves);

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
      sourceMaturityRampDays,
      sourceMaturityMinFactor,
      rankNormalizationWeight,
      rankCurveLookbackDays,
      rankCurveCount: rankCurves?.size || 0,
      note: 'Derived blend only. The raw historical source archive remains the source of truth. Source weights are renormalized to available sources, newly appearing sources ramp into multi-source blends, and historical points with positional ranks are anchored toward the current rank/value curve so old source scales do not create fake movement.',
    },
  };

  await writeArchive(outputPath, result, buildReblendedPlayers(archivePath, weights, { playerCount: 0, pointCount: 0 }, rankCurves));
  console.log(`Reblended ${counters.pointCount} points for ${counters.playerCount} players to ${path.relative(rootDir, outputPath)}`);
}

main();
