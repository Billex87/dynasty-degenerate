import fs from 'node:fs';
import path from 'node:path';
import { readArchiveHeader, streamArchivePlayers } from './value-history-archive-io.mjs';

const rootDir = process.cwd();
const archivePath = process.env.ARCHIVE_FILE
  ? path.resolve(rootDir, process.env.ARCHIVE_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'one-time-source-history.json');
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'player-value-history-audit.json');
const failOnErrors = process.env.FAIL_ON_ERRORS !== '0';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Audit a raw or derived player value history archive before approving it for product use.',
    '',
    'Environment:',
    '  ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json',
    '  OUT_FILE=server/value-history-archive/player-value-history-audit.json',
    '  FAIL_ON_ERRORS=1',
  ].join('\n'));
  process.exit(0);
}

function increment(map, key, count = 1) {
  map[key] = (map[key] || 0) + count;
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getSourceValueCount(point) {
  return [
    point.market?.ktc,
    point.market?.fantasyCalc,
    point.expert?.fantasyPros,
    point.expert?.dynastyProcess,
    point.expert?.dynastyNerds,
    point.expert?.flockFantasy,
    point.value,
  ].filter((value) => {
    const numeric = numberOrNull(value);
    return numeric !== null && numeric > 0;
  }).length;
}

function dateInWindow(dateKey, fromDate, toDate) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  if (fromDate && dateKey < fromDate) return false;
  if (toDate && dateKey > toDate) return false;
  return true;
}

function sortObject(input) {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const archive = await readArchiveHeader(archivePath);
  const manifest = archive.manifest || {};
  const fromDate = manifest.fromDate || archive.minDate || null;
  const toDate = manifest.toDate || archive.maxDate || null;
  const errors = [];
  const warnings = [];
  const countsByImportedSource = {};
  const countsByFormat = {};
  const countsBySource = {};
  const dateRangeByFormat = {};
  let pointCount = 0;
  let playerCount = 0;
  let duplicateCount = 0;

  if (!archive.schemaVersion) errors.push('Archive is missing schemaVersion.');
  if (manifest.dryRun) errors.push('Archive was generated in dry-run mode.');
  if (
    manifest.ktc?.sampledOnly ||
    manifest.dynastyprocess?.sampledOnly ||
    Object.values(manifest.flock?.formats || {}).some((format) => format?.sampledOnly)
  ) {
    warnings.push('Archive appears to be a sampled run, not a full backfill.');
  }
  if (manifest.ktc?.errors?.length) warnings.push(`KTC reported ${manifest.ktc.errors.length} collection errors.`);
  if (manifest.flock?.errors?.length) warnings.push(`Flock reported ${manifest.flock.errors.length} collection errors.`);
  if (manifest.dynastyprocess?.errors?.length) warnings.push(`DynastyProcess reported ${manifest.dynastyprocess.errors.length} collection errors.`);
  if (manifest.fantasycalc?.errors?.length) warnings.push(`FantasyCalc reported ${manifest.fantasycalc.errors.length} collection errors.`);
  if (manifest.fantasypros?.errors?.length) warnings.push(`FantasyPros reported ${manifest.fantasypros.errors.length} collection errors.`);

  for await (const player of streamArchivePlayers(archivePath)) {
    playerCount += 1;
    const seenPoints = new Set();
    if (!player.key || !player.name) errors.push(`Player is missing key/name: ${JSON.stringify({ key: player.key, name: player.name })}`);

    for (const point of player.points || []) {
      pointCount += 1;
      const format = point.format || 'default';
      const importedSource = point.importedSource || 'unknown';
      const duplicateKey = `${point.date}|${format}|${importedSource}`;
      if (seenPoints.has(duplicateKey)) duplicateCount += 1;
      seenPoints.add(duplicateKey);

      increment(countsByFormat, format);
      increment(countsByImportedSource, importedSource);
      for (const source of point.sources || []) increment(countsBySource, source);

      const range = dateRangeByFormat[format] || { minDate: point.date, maxDate: point.date };
      if (point.date && (!range.minDate || point.date < range.minDate)) range.minDate = point.date;
      if (point.date && (!range.maxDate || point.date > range.maxDate)) range.maxDate = point.date;
      dateRangeByFormat[format] = range;

      if (!dateInWindow(point.date, fromDate, toDate)) {
        errors.push(`${player.name} has out-of-window or invalid date ${point.date || 'missing'} (${format}, ${importedSource}).`);
      }
      if (!Number.isFinite(Number(point.value)) || Number(point.value) <= 0) {
        errors.push(`${player.name} has invalid value on ${point.date || 'missing'} (${format}, ${importedSource}).`);
      }
      if (getSourceValueCount(point) <= 0) {
        errors.push(`${player.name} has no usable source value on ${point.date || 'missing'} (${format}, ${importedSource}).`);
      }
    }
  }

  if (duplicateCount) warnings.push(`Found ${duplicateCount} duplicate player/date/format/source points.`);
  if (archive.pointCount && archive.pointCount !== pointCount) {
    errors.push(`Archive pointCount ${archive.pointCount} does not match counted points ${pointCount}.`);
  }
  if (archive.playerCount && archive.playerCount !== playerCount) {
    errors.push(`Archive playerCount ${archive.playerCount} does not match counted players ${playerCount}.`);
  }

  const audit = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    archiveFile: path.relative(rootDir, archivePath),
    archiveGeneratedAt: archive.generatedAt || null,
    source: archive.source || null,
    fromDate,
    toDate,
    playerCount,
    pointCount,
    formatCount: Object.keys(countsByFormat).length,
    countsByFormat: sortObject(countsByFormat),
    countsByImportedSource: sortObject(countsByImportedSource),
    countsBySource: sortObject(countsBySource),
    dateRangeByFormat: sortObject(dateRangeByFormat),
    manifestErrors: {
      ktc: manifest.ktc?.errors || [],
      flock: manifest.flock?.errors || [],
      dynastyprocess: manifest.dynastyprocess?.errors || [],
      fantasycalc: manifest.fantasycalc?.errors || [],
      fantasypros: manifest.fantasypros?.errors || [],
    },
    warnings,
    errors,
    passed: errors.length === 0,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(`Audited ${audit.pointCount} points for ${audit.playerCount} players. Passed: ${audit.passed ? 'yes' : 'no'}. Warnings: ${warnings.length}. Errors: ${errors.length}.`);
  console.log(`Wrote ${path.relative(rootDir, outputPath)}`);

  if (failOnErrors && errors.length) process.exit(1);
}

main();
