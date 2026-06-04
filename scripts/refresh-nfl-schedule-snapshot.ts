#!/usr/bin/env tsx

import '../server/_core/env';
import {
  buildNflverseScheduleSnapshot,
  NFLVERSE_SCHEDULE_SOURCE_URL,
} from '../server/nflverseScheduleSnapshot';
import {
  buildNflScheduleCoverageDiagnostics,
  getNflScheduleSnapshotDiagnostics,
  persistNflScheduleSnapshot,
} from '../server/nflScheduleSnapshots';

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultSeason(): number {
  const now = new Date();
  return parseInteger(process.env.NFL_SCHEDULE_SEASON, now.getUTCFullYear());
}

function defaultSourceVersion(season: number): string {
  const date = new Date().toISOString().slice(0, 10);
  return process.env.NFL_SCHEDULE_SOURCE_VERSION || `nflverse-${season}-${date}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to persist the NFL schedule snapshot.');
  }

  const season = defaultSeason();
  const sourceUrl = process.env.NFL_SCHEDULE_SOURCE_URL || NFLVERSE_SCHEDULE_SOURCE_URL;
  const sourceVersion = defaultSourceVersion(season);
  const response = await fetch(sourceUrl, {
    headers: {
      accept: 'text/csv,*/*;q=0.8',
      'user-agent': 'dynasty-degenerate-schedule-snapshot/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`NFL schedule source returned HTTP ${response.status}`);
  }

  const csv = await response.text();
  const snapshot = buildNflverseScheduleSnapshot({
    csv,
    season,
    sourceVersion,
    sourceUrl,
    fetchedAt: new Date(),
  });
  const diagnostics = getNflScheduleSnapshotDiagnostics(snapshot);
  const coverage = buildNflScheduleCoverageDiagnostics({
    snapshot,
    season,
    sleeperWeeks: Array.from({ length: 18 }, (_, index) => index + 1),
    providerProjectionWeeks: Array.from({ length: 18 }, (_, index) => index + 1),
  });

  if (diagnostics.status !== 'loaded') {
    throw new Error(`Normalized schedule snapshot is not loadable: ${diagnostics.note}`);
  }

  if (coverage.status !== 'ready') {
    throw new Error(`Normalized schedule coverage is not ready: ${coverage.note}`);
  }

  await persistNflScheduleSnapshot(snapshot);

  console.log(JSON.stringify({
    sourceKey: snapshot.sourceKey,
    snapshotKey: snapshot.snapshotKey,
    source: snapshot.source,
    sourceUrl: snapshot.sourceUrl,
    sourceVersion: snapshot.sourceVersion,
    season: diagnostics.season,
    rowCount: snapshot.rowCount,
    checksum: snapshot.checksum,
    coverageStatus: coverage.status,
    scheduleWeeks: coverage.scheduleWeeks,
    missingTeamCount: coverage.missingTeamCount,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
