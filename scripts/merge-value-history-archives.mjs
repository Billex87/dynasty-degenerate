import fs from 'node:fs';
import path from 'node:path';
import { readArchiveHeader, streamArchivePlayers, writeArchive } from './value-history-archive-io.mjs';

const rootDir = process.cwd();
const baseArchivePath = process.env.BASE_ARCHIVE_FILE
  ? path.resolve(rootDir, process.env.BASE_ARCHIVE_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'one-time-source-history.json');
const importPaths = String(process.env.IMPORT_FILES || '')
  .split(',')
  .map((filePath) => filePath.trim())
  .filter(Boolean)
  .map((filePath) => path.resolve(rootDir, filePath));
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'one-time-source-history-merged.json');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Merge approved source-specific value-history archives into one raw archive.',
    '',
    'Environment:',
    '  BASE_ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json',
    '  IMPORT_FILES=server/value-history-archive/fantasycalc-history.json,server/value-history-archive/fantasypros-history.json',
    '  OUT_FILE=server/value-history-archive/one-time-source-history-merged.json',
    '',
    'Notes:',
    '  The base archive is streamed. Import archives are indexed by player key, then merged by player/date/format/importedSource.',
    '  Keep the original base archive immutable; write merged output as a new generated archive.',
  ].join('\n'));
  process.exit(0);
}

function pointKey(point) {
  return [
    point.date || '',
    point.format || '',
    point.importedSource || '',
    (point.sources || []).join('+'),
  ].join('|');
}

function mergePointLists(basePoints = [], importedPoints = []) {
  const byKey = new Map();
  for (const point of basePoints) byKey.set(pointKey(point), point);
  for (const point of importedPoints) {
    const key = pointKey(point);
    const existing = byKey.get(key);
    byKey.set(key, existing ? {
      ...existing,
      ...point,
      sources: Array.from(new Set([...(existing.sources || []), ...(point.sources || [])])).sort(),
      market: { ...(existing.market || {}), ...(point.market || {}) },
      expert: { ...(existing.expert || {}), ...(point.expert || {}) },
      sourceMeta: { ...(existing.sourceMeta || {}), ...(point.sourceMeta || {}) },
    } : point);
  }
  return Array.from(byKey.values())
    .filter((point) => point.date && point.value)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.format || '').localeCompare(String(b.format || '')));
}

async function loadImportPlayers(files) {
  const byKey = new Map();
  const imports = [];

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) throw new Error(`Import archive not found: ${filePath}`);
    const header = await readArchiveHeader(filePath);
    imports.push({
      file: path.relative(rootDir, filePath),
      source: header.source || null,
      sourceName: header.sourceName || null,
      generatedAt: header.generatedAt || null,
    });

    for await (const player of streamArchivePlayers(filePath)) {
      const key = player.key || String(player.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!key) continue;
      const existing = byKey.get(key) || {
        key,
        name: player.name || key,
        position: player.position || null,
        points: [],
      };
      existing.name = existing.name || player.name;
      existing.position = existing.position || player.position || null;
      existing.points = mergePointLists(existing.points, player.points || []);
      byKey.set(key, existing);
    }
  }

  return { imports, byKey };
}

async function* mergedPlayers(baseFilePath, importPlayers, counters) {
  const seen = new Set();
  for await (const player of streamArchivePlayers(baseFilePath)) {
    const key = player.key || String(player.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const imported = importPlayers.get(key);
    const merged = {
      ...player,
      name: player.name || imported?.name || key,
      position: player.position || imported?.position || null,
      points: mergePointLists(player.points || [], imported?.points || []),
    };
    seen.add(key);
    counters.playerCount += 1;
    counters.pointCount += merged.points.length;
    yield merged;
  }

  for (const [key, player] of importPlayers.entries()) {
    if (seen.has(key)) continue;
    const merged = {
      ...player,
      points: mergePointLists([], player.points || []),
    };
    counters.playerCount += 1;
    counters.pointCount += merged.points.length;
    yield merged;
  }
}

async function main() {
  if (!fs.existsSync(baseArchivePath)) throw new Error(`Base archive not found: ${baseArchivePath}`);
  if (!importPaths.length) throw new Error('IMPORT_FILES is required.');

  const baseHeader = await readArchiveHeader(baseArchivePath);
  const { imports, byKey } = await loadImportPlayers(importPaths);
  const countCounters = { playerCount: 0, pointCount: 0 };
  for await (const _player of mergedPlayers(baseArchivePath, byKey, countCounters)) {
    // Counting pass so archive metadata matches the streamed write.
  }
  const header = {
    ...baseHeader,
    generatedAt: new Date().toISOString(),
    source: 'merged-value-history-archive',
    baseArchive: path.relative(rootDir, baseArchivePath),
    mergedImports: imports,
    playerCount: countCounters.playerCount,
    pointCount: countCounters.pointCount,
    policy: {
      note: 'Merged archive derived from the immutable base archive plus approved source-specific import archives.',
    },
  };

  const writeCounters = { playerCount: 0, pointCount: 0 };
  await writeArchive(outputPath, header, mergedPlayers(baseArchivePath, byKey, writeCounters));
  console.log(`Merged ${writeCounters.pointCount} points for ${writeCounters.playerCount} players to ${path.relative(rootDir, outputPath)}`);
}

main();
