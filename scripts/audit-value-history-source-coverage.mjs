import fs from 'node:fs';
import path from 'node:path';
import { readArchiveHeader, streamArchivePlayers } from './value-history-archive-io.mjs';
import { VALUE_HISTORY_SOURCES } from './value-history-source-registry.mjs';

const rootDir = process.cwd();
const archivePath = process.env.ARCHIVE_FILE
  ? path.resolve(rootDir, process.env.ARCHIVE_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'one-time-source-history.json');
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'source-coverage-audit.json');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Audit which weighted value sources are archived, import-ready, or future-only.',
    '',
    'Environment:',
    '  ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json',
    '  OUT_FILE=server/value-history-archive/source-coverage-audit.json',
  ].join('\n'));
  process.exit(0);
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

async function countArchiveSources(filePath) {
  const countsBySource = new Map();
  const countsByImportedSource = new Map();
  const countsByFormat = new Map();
  let playerCount = 0;
  let pointCount = 0;

  for await (const player of streamArchivePlayers(filePath)) {
    playerCount += 1;
    for (const point of player.points || []) {
      pointCount += 1;
      increment(countsByImportedSource, point.importedSource || 'unknown');
      increment(countsByFormat, point.format || 'unknown');
      for (const source of point.sources || []) {
        increment(countsBySource, source);
      }
    }
  }

  return {
    playerCount,
    pointCount,
    countsBySource,
    countsByImportedSource,
    countsByFormat,
  };
}

function buildSourceRows(counts) {
  return VALUE_HISTORY_SOURCES.map((source) => {
    const archivedPointCount = source.archiveSourceNames
      .reduce((sum, name) => sum + (counts.countsBySource.get(name) || 0), 0);
    const archiveStatus = archivedPointCount > 0 ? 'present' : source.status;
    return {
      key: source.key,
      label: source.label,
      currentWeight: source.currentWeight,
      configuredStatus: source.status,
      archiveStatus,
      archivedPointCount,
      captureMode: source.captureMode,
      formats: source.formats,
      note: source.note,
    };
  });
}

async function main() {
  if (!fs.existsSync(archivePath)) throw new Error(`Archive not found: ${archivePath}`);
  const archive = await readArchiveHeader(archivePath);
  const counts = await countArchiveSources(archivePath);
  const rows = buildSourceRows(counts);
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    archiveFile: path.relative(rootDir, archivePath),
    archiveGeneratedAt: archive.generatedAt || null,
    archiveSource: archive.source || null,
    playerCount: counts.playerCount,
    pointCount: counts.pointCount,
    sources: rows,
    countsBySource: Object.fromEntries([...counts.countsBySource.entries()].sort()),
    countsByImportedSource: Object.fromEntries([...counts.countsByImportedSource.entries()].sort()),
    countsByFormat: Object.fromEntries([...counts.countsByFormat.entries()].sort()),
    policy: {
      note: 'Add every new weighted source here before it can affect future blend weights; archive raw source values first, then reblend derived timelines.',
    },
  };

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log(`Audited ${counts.pointCount} raw points for ${counts.playerCount} players.`);
  for (const row of rows) {
    console.log(`- ${row.label}: ${row.archiveStatus} (${row.archivedPointCount} archived points, weight ${row.currentWeight})`);
  }
  console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
}

main();
