import fs from 'node:fs';
import path from 'node:path';
import { readArchiveHeader, streamArchivePlayers } from './value-history-archive-io.mjs';

const rootDir = process.cwd();
const archivePath = process.env.ARCHIVE_FILE
  ? path.resolve(rootDir, process.env.ARCHIVE_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'player-value-history-reblended.json');
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'player-value-history-timeline-index.json');

const WINDOW_CONFIGS = [
  { key: '1m', label: '1M', days: 31, maxPoints: 12 },
  { key: '3m', label: '3M', days: 92, maxPoints: 18 },
  { key: '6m', label: '6M', days: 183, maxPoints: 26 },
  { key: '1y', label: '1Y', days: 366, maxPoints: 38 },
  { key: 'all', label: 'All', days: null, maxPoints: 72 },
];
const MAX_AS_OF_POINTS = Number(process.env.MAX_AS_OF_POINTS || 260);

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Build a compact player timeline index from the reblended value-history archive.',
    '',
    'Environment:',
    '  ARCHIVE_FILE=server/value-history-archive/player-value-history-reblended.json',
    '  OUT_FILE=server/value-history-archive/player-value-history-timeline-index.json',
    '',
    'The index is small enough for report generation and keeps 1M/3M/6M/1Y/all-time windows, high/low records, and a denser as-of lookup series for historical trades.',
  ].join('\n'));
  process.exit(0);
}

function compactPoints(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const keepIndexes = new Set([0, points.length - 1]);
  const innerSlots = Math.max(0, maxPoints - keepIndexes.size);
  for (let index = 1; index <= innerSlots; index += 1) {
    keepIndexes.add(Math.round((index * (points.length - 1)) / (innerSlots + 1)));
  }
  return points.filter((_, index) => keepIndexes.has(index));
}

function dateMinusDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function getPointRank(point) {
  return typeof point.rank === 'string' && point.rank ? point.rank : null;
}

function slimPoint(point) {
  return {
    date: point.date,
    value: Math.round(Number(point.value)),
    rank: getPointRank(point),
    overallRank: Number.isFinite(Number(point.overallRank)) ? Number(point.overallRank) : null,
    sourceCount: Number(point.sourceCount || point.sourcesUsed?.length || 0),
    sources: Array.isArray(point.sourcesUsed) ? point.sourcesUsed : [],
  };
}

function summarizeWindow(points, config, latestDate) {
  const startDate = config.days ? dateMinusDays(latestDate, config.days) : '';
  const filtered = points.filter((point) => !startDate || point.date >= startDate);
  if (filtered.length < 2) return null;
  const compacted = compactPoints(filtered, config.maxPoints).map(slimPoint);
  const start = compacted[0];
  const end = compacted[compacted.length - 1];
  const delta = end.value - start.value;
  return {
    key: config.key,
    label: config.label,
    days: config.days,
    pointCount: filtered.length,
    startDate: start.date,
    endDate: end.date,
    startValue: start.value,
    endValue: end.value,
    delta,
    deltaPct: start.value ? Math.round((delta / start.value) * 1000) / 10 : null,
    points: compacted,
  };
}

function getExtreme(points, comparator) {
  return points.reduce((best, point) => (!best || comparator(point, best) ? point : best), null);
}

function summarizeExtremes(points) {
  const high = getExtreme(points, (point, best) => point.value > best.value);
  const low = getExtreme(points, (point, best) => point.value < best.value);
  return {
    high: high ? slimPoint(high) : null,
    low: low ? slimPoint(low) : null,
  };
}

function summarizeYearlyExtremes(points) {
  const byYear = new Map();
  for (const point of points) {
    const year = String(point.date || '').slice(0, 4);
    if (!/^\d{4}$/.test(year)) continue;
    const rows = byYear.get(year) || [];
    rows.push(point);
    byYear.set(year, rows);
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, rows]) => ({
      year,
      ...summarizeExtremes(rows),
    }));
}

function normalizeLookupKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function groupPlayerFormats(player) {
  const byFormat = new Map();
  for (const point of player.points || []) {
    if (!point?.date || !Number(point.value)) continue;
    const format = String(point.format || 'default');
    const rows = byFormat.get(format) || [];
    rows.push(point);
    byFormat.set(format, rows);
  }
  return byFormat;
}

async function main() {
  if (!fs.existsSync(archivePath)) throw new Error(`Archive not found: ${archivePath}`);
  const archive = await readArchiveHeader(archivePath);
  const players = {};
  let playerCount = 0;
  let formatCount = 0;
  let windowPointCount = 0;
  let asOfPointCount = 0;

  for await (const player of streamArchivePlayers(archivePath)) {
    const formatRows = {};
    for (const [format, rows] of groupPlayerFormats(player)) {
      rows.sort((a, b) => a.date.localeCompare(b.date));
      if (rows.length < 2) continue;
      const latestDate = rows[rows.length - 1].date;
      const windows = Object.fromEntries(
        WINDOW_CONFIGS
          .map((config) => summarizeWindow(rows, config, latestDate))
          .filter(Boolean)
          .map((window) => {
            windowPointCount += window.points.length;
            return [window.key, window];
          })
      );
      if (!Object.keys(windows).length) continue;
      const asOfPoints = compactPoints(rows, MAX_AS_OF_POINTS).map(slimPoint);
      asOfPointCount += asOfPoints.length;
      formatRows[format] = {
        format,
        firstDate: rows[0].date,
        lastDate: latestDate,
        rawPointCount: rows.length,
        asOfPointCount: rows.length,
        asOfPoints,
        windows,
        extremes: summarizeExtremes(rows),
        yearlyExtremes: summarizeYearlyExtremes(rows),
      };
      formatCount += 1;
    }
    if (!Object.keys(formatRows).length) continue;
    const key = player.key || normalizeLookupKey(player.name);
    players[key] = {
      key,
      name: player.name,
      position: player.position || null,
      lookupKeys: Array.from(new Set([key, normalizeLookupKey(player.name)].filter(Boolean))),
      formats: formatRows,
    };
    playerCount += 1;
  }

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceArchive: path.relative(rootDir, archivePath),
    sourceArchiveGeneratedAt: archive.generatedAt || null,
    blendName: archive.blendName || null,
    playerCount,
    formatCount,
    windowPointCount,
    asOfPointCount,
    maxAsOfPoints: MAX_AS_OF_POINTS,
    windows: WINDOW_CONFIGS,
    players,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result)}\n`);
  console.log(`Indexed ${playerCount} players, ${formatCount} format timelines, ${windowPointCount} compact window points, ${asOfPointCount} as-of lookup points.`);
  console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
