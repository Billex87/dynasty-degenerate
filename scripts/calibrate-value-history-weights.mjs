import fs from 'node:fs';
import path from 'node:path';
import { streamArchivePlayers } from './value-history-archive-io.mjs';
import { DEFAULT_VALUE_HISTORY_WEIGHTS } from './value-history-source-registry.mjs';

const rootDir = process.cwd();
const archivePath = process.env.ARCHIVE_FILE
  ? path.resolve(rootDir, process.env.ARCHIVE_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'one-time-source-history.json');
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'value-history-weight-calibration.json');
const horizonDays = Number(process.env.HORIZON_DAYS || 180);
const minSamples = Number(process.env.MIN_SOURCE_SAMPLES || 250);
const maxWeight = Number(process.env.MAX_SOURCE_WEIGHT || 0.4);
const maxMove = Number(process.env.MAX_WEIGHT_MOVE || 0.06);

const SOURCE_CONFIGS = [
  { key: 'marketKtc', label: 'KeepTradeCut', read: (point) => point.market?.ktc },
  { key: 'fantasyCalc', label: 'FantasyCalc', read: (point) => point.market?.fantasyCalc },
  { key: 'fantasyPros', label: 'FantasyPros', read: (point) => point.expert?.fantasyPros },
  { key: 'dynastyProcess', label: 'DynastyProcess', read: (point) => point.expert?.dynastyProcess },
  { key: 'dynastyNerds', label: 'Dynasty Nerds', read: (point) => point.expert?.dynastyNerds },
  { key: 'fantasyNerds', label: 'Fantasy Nerds', read: (point) => point.expert?.fantasyNerds },
  { key: 'flockFantasy', label: 'Flock Fantasy', read: (point) => point.expert?.flockFantasy },
];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Calibrate source weights from the frozen raw value-history archive.',
    '',
    'Environment:',
    '  ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json',
    '  HORIZON_DAYS=180',
    '  MIN_SOURCE_SAMPLES=250',
    '  MAX_SOURCE_WEIGHT=0.4',
    '  MAX_WEIGHT_MOVE=0.06',
    '  OUT_FILE=server/value-history-archive/value-history-weight-calibration.json',
    '',
    'The script compares each source value to future cross-source consensus for the same player/format.',
    'It recommends cautious weights, but does not mutate production weights.',
  ].join('\n'));
  process.exit(0);
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function datePlusDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pctError(value, target) {
  if (!value || !target) return null;
  return Math.abs(Math.log(value / target));
}

function getPointSourceValues(point) {
  return Object.fromEntries(
    SOURCE_CONFIGS.map((source) => [source.key, numberOrNull(source.read(point))])
  );
}

function buildConsensus(sourceValues, excludeSource = '') {
  const values = Object.entries(sourceValues)
    .filter(([source, value]) => source !== excludeSource && value)
    .map(([, value]) => value);
  return median(values);
}

function findFuturePoint(points, targetDate) {
  return points.find((point) => point.date >= targetDate) || null;
}

function summarizePlayer(player, sourceStats, counters) {
  const byFormatDate = new Map();

  for (const point of player.points || []) {
    if (!point?.date) continue;
    const format = normalizeFormat(point.format);
    const key = `${format}|${point.date}`;
    const existing = byFormatDate.get(key) || {
      date: point.date,
      format,
      sourceValues: {},
      sourcePointCount: 0,
    };
    const values = getPointSourceValues(point);
    for (const [source, value] of Object.entries(values)) {
      if (!value) continue;
      existing.sourceValues[source] = existing.sourceValues[source]
        ? Math.round((existing.sourceValues[source] + value) / 2)
        : value;
    }
    existing.sourcePointCount += 1;
    byFormatDate.set(key, existing);
  }

  const byFormat = new Map();
  for (const point of byFormatDate.values()) {
    point.consensus = buildConsensus(point.sourceValues);
    if (!point.consensus) continue;
    const points = byFormat.get(point.format) || [];
    points.push(point);
    byFormat.set(point.format, points);
  }

  for (const points of byFormat.values()) {
    points.sort((a, b) => a.date.localeCompare(b.date));
    for (const point of points) {
      const future = findFuturePoint(points, datePlusDays(point.date, horizonDays));
      if (!future?.consensus) continue;
      counters.comparisonCount += 1;
      const currentConsensus = point.consensus;
      const futureConsensus = future.consensus;
      const futureDirection = futureConsensus > currentConsensus * 1.03 ? 'up'
        : futureConsensus < currentConsensus * 0.97 ? 'down'
          : 'flat';

      for (const source of SOURCE_CONFIGS) {
        const value = point.sourceValues[source.key];
        if (!value) continue;
        const target = buildConsensus(future.sourceValues, source.key) || futureConsensus;
        const error = pctError(value, target);
        if (error === null) continue;
        const stats = sourceStats[source.key];
        stats.samples += 1;
        stats.absolutePctErrorSum += error;
        stats.coverageDateFormats.add(`${point.date}|${point.format}`);
        const sourceSignal = value > currentConsensus * 1.03 ? 'up'
          : value < currentConsensus * 0.97 ? 'down'
            : 'flat';
        if (sourceSignal === futureDirection) stats.directionHits += 1;
        if (sourceSignal !== 'flat') stats.directionCalls += 1;
      }
    }
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeWeights(rawScores, currentWeights, rows) {
  const lockedWeight = rows
    .filter((row) => row.confidence !== 'usable')
    .reduce((sum, row) => sum + (currentWeights[row.key] || 0), 0);
  const remainingWeight = Math.max(0, 1 - lockedWeight);
  const totalScore = rows
    .filter((row) => row.confidence === 'usable')
    .reduce((sum, row) => sum + (rawScores[row.key] || 0), 0);
  const normalized = {};
  for (const source of SOURCE_CONFIGS) {
    const row = rows.find((item) => item.key === source.key);
    const current = currentWeights[source.key] || 0;
    if (row?.confidence !== 'usable') {
      normalized[source.key] = current;
      continue;
    }
    const raw = totalScore ? (rawScores[source.key] / totalScore) * remainingWeight : current;
    normalized[source.key] = clamp(raw, Math.max(0.01, current - maxMove), Math.min(maxWeight, current + maxMove));
  }
  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(
    Object.entries(normalized).map(([key, value]) => [key, Math.round((value / total) * 1000) / 1000])
  );
}

async function main() {
  if (!fs.existsSync(archivePath)) throw new Error(`Archive not found: ${archivePath}`);
  const sourceStats = Object.fromEntries(SOURCE_CONFIGS.map((source) => [source.key, {
    key: source.key,
    label: source.label,
    samples: 0,
    absolutePctErrorSum: 0,
    directionHits: 0,
    directionCalls: 0,
    coverageDateFormats: new Set(),
  }]));
  const counters = { playerCount: 0, comparisonCount: 0 };

  for await (const player of streamArchivePlayers(archivePath)) {
    counters.playerCount += 1;
    summarizePlayer(player, sourceStats, counters);
  }

  const rows = SOURCE_CONFIGS.map((source) => {
    const stats = sourceStats[source.key];
    const maePct = stats.samples ? (stats.absolutePctErrorSum / stats.samples) * 100 : null;
    const directionHitRate = stats.directionCalls ? (stats.directionHits / stats.directionCalls) * 100 : null;
    const sampleScore = Math.min(1, Math.log10(Math.max(10, stats.samples)) / 4);
    const errorScore = maePct ? 1 / Math.max(12, maePct) : 0;
    const directionScore = directionHitRate ? clamp(directionHitRate / 55, 0.55, 1.18) : 0.8;
    const confidence = stats.samples >= minSamples ? 'usable' : stats.samples ? 'thin' : 'missing';
    return {
      key: source.key,
      label: source.label,
      currentWeight: DEFAULT_VALUE_HISTORY_WEIGHTS[source.key],
      samples: stats.samples,
      dateFormatCoverage: stats.coverageDateFormats.size,
      meanAbsolutePctError: maePct === null ? null : Math.round(maePct * 10) / 10,
      directionCalls: stats.directionCalls,
      directionHitRate: directionHitRate === null ? null : Math.round(directionHitRate * 10) / 10,
      confidence,
      rawScore: confidence === 'missing' ? 0 : errorScore * sampleScore * directionScore,
    };
  });

  const usableScores = Object.fromEntries(rows.map((row) => [row.key, row.rawScore]));
  const suggestedWeights = normalizeWeights(usableScores, DEFAULT_VALUE_HISTORY_WEIGHTS, rows);
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    archiveFile: path.relative(rootDir, archivePath),
    horizonDays,
    policy: {
      note: 'Suggested weights are capped and movement-limited. Review before changing production defaults.',
      minSamples,
      maxWeight,
      maxWeightMove: maxMove,
    },
    playerCount: counters.playerCount,
    comparisonCount: counters.comparisonCount,
    currentWeights: DEFAULT_VALUE_HISTORY_WEIGHTS,
    suggestedWeights,
    deltas: Object.fromEntries(
      Object.entries(suggestedWeights).map(([key, value]) => [
        key,
        Math.round((value - (DEFAULT_VALUE_HISTORY_WEIGHTS[key] || 0)) * 1000) / 1000,
      ])
    ),
    sources: rows.map(({ rawScore: _rawScore, ...row }) => row),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Calibrated ${rows.length} sources over ${counters.comparisonCount} future comparisons.`);
  for (const row of rows) {
    console.log(`- ${row.label}: samples ${row.samples}, MAE ${row.meanAbsolutePctError ?? 'n/a'}%, hit ${row.directionHitRate ?? 'n/a'}%, suggested ${suggestedWeights[row.key]}`);
  }
  console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
