#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import '../server/_core/env';
import { upsertProviderDataSnapshot } from '../server/db';
import {
  buildDraftSharksSosSnapshotImport,
  parseDraftSharksSosImportRows,
} from '../server/draftSharksSosSnapshotImport';

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function getInputFile(): string | null {
  const fromFlag = getFlag('file');
  const fromEnv = process.env.DRAFTSHARKS_SOS_IMPORT_FILE;
  const value = fromFlag || fromEnv || '';
  return value ? path.resolve(process.cwd(), value) : null;
}

function printHelp() {
  console.log([
    'Import an approved/manual DraftSharks SOS snapshot into providerDataSnapshots.',
    '',
    'Usage:',
    '  pnpm import:draftsharks-sos -- --file=/path/to/draftsharks-sos.csv --season=2026 --write',
    '',
    'Supported input:',
    '  CSV, TSV/copied table text, JSON array, or JSON object with rows/data/items/sos/strengthOfSchedule.',
    '',
    'Common fields:',
    '  team/team_abbr/nflTeam, position/pos/fantasyPosition',
    '  season_sos/seasonSOS/sos/score, remaining_sos/remainingSOS',
    '  streamer_weeks/targetWeeks/goodWeeks, avoid_weeks/hardWeeks/fadeWeeks',
    '  week1/week2/... cells such as "19.1% WAS" or week1_percent + week1Opponent',
    '',
    'Flags:',
    '  --file=/path/to/export.csv',
    '  --season=2026',
    '  --source-version=manual-2026-2026-06-04',
    '  --source-name="DraftSharks manual SOS export"',
    '  --write',
    '',
    'Default mode is dry-run. Add --write to persist.',
  ].join('\n'));
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const inputFile = getInputFile();
  if (!inputFile) {
    throw new Error('Missing --file. Run `pnpm import:draftsharks-sos -- --help` for usage.');
  }

  const write = process.argv.includes('--write');
  if (write && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when running with --write.');
  }

  const season = getFlag('season') || process.env.DRAFTSHARKS_SOS_SEASON || new Date().getUTCFullYear();
  const text = fs.readFileSync(inputFile, 'utf8');
  const rows = parseDraftSharksSosImportRows({
    text,
    fileName: inputFile,
  });
  const snapshot = buildDraftSharksSosSnapshotImport({
    rows,
    season,
    sourceVersion: getFlag('source-version') || process.env.DRAFTSHARKS_SOS_SOURCE_VERSION,
    sourceName: getFlag('source-name') || process.env.DRAFTSHARKS_SOS_SOURCE_NAME,
    sourceFile: path.basename(inputFile),
    importedAt: new Date(),
  });

  if (write) {
    const persisted = await upsertProviderDataSnapshot({
      sourceKey: snapshot.sourceKey,
      snapshotKey: snapshot.snapshotKey,
      payload: JSON.stringify(snapshot.payload),
    });
    if (!persisted) {
      throw new Error('DraftSharks SOS snapshot was not persisted. Check DATABASE_URL.');
    }
  }

  console.log(JSON.stringify({
    mode: write ? 'write' : 'dry-run',
    sourceKey: snapshot.sourceKey,
    snapshotKey: snapshot.snapshotKey,
    sourceVersion: snapshot.sourceVersion,
    rowCount: snapshot.rowCount,
    profileCount: snapshot.profileCount,
    checksum: snapshot.checksum,
    sampleProfiles: Object.keys(snapshot.payload.context.profiles).slice(0, 8),
  }, null, 2));
}

main().catch((error) => {
  console.error('[draftsharks-sos-import] failed:', error);
  process.exitCode = 1;
});
