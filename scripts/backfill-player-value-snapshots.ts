#!/usr/bin/env tsx

import { insertPlayerValueSnapshots, listKtcSnapshotPayloadsSince } from '../server/db';
import { buildPlayerValueSnapshotRowsFromPayload } from '../server/ktcSnapshotJob';

const DEFAULT_START_DATE = '2026-04-01';

function parseArgs() {
  const startFlag = process.argv.find((arg) => arg.startsWith('--start='));
  const write = process.argv.includes('--write');
  const start = startFlag ? startFlag.slice('--start='.length) : DEFAULT_START_DATE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    throw new Error('--start must use YYYY-MM-DD');
  }
  return { start, write };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to read stored ktcSnapshots for graph backfill.');
  }

  const { start, write } = parseArgs();
  const snapshots = await listKtcSnapshotPayloadsSince(new Date(`${start}T00:00:00.000Z`));
  let parsedSnapshots = 0;
  let skippedSnapshots = 0;
  let totalRows = 0;
  const rowsByProfile = new Map<string, number>();

  for (const snapshot of snapshots) {
    try {
      const payload = JSON.parse(snapshot.ktcData);
      const rows = buildPlayerValueSnapshotRowsFromPayload(snapshot.snapshotDate, payload);
      parsedSnapshots += 1;
      totalRows += rows.length;
      rows.forEach((row) => rowsByProfile.set(row.profileKey, (rowsByProfile.get(row.profileKey) || 0) + 1));
      if (write && rows.length > 0) {
        await insertPlayerValueSnapshots(rows);
      }
    } catch (error) {
      skippedSnapshots += 1;
      console.warn(`[player-value-snapshots] skipped ${snapshot.snapshotDate.toISOString()}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const topProfiles = Array.from(rowsByProfile.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([profileKey, rowCount]) => ({ profileKey, rowCount }));

  console.log(JSON.stringify({
    mode: write ? 'write' : 'dry-run',
    start,
    snapshotsFound: snapshots.length,
    parsedSnapshots,
    skippedSnapshots,
    playerValueRows: totalRows,
    topProfiles,
    note: write
      ? 'Inserted or updated normalized player value graph rows from stored ktcSnapshots.'
      : 'Dry run only. Re-run with --write to insert normalized player value graph rows.',
  }, null, 2));
}

main().catch((error) => {
  console.error('[player-value-snapshots] failed:', error);
  process.exitCode = 1;
});
