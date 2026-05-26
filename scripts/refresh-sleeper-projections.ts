#!/usr/bin/env tsx

import {
  refreshSleeperProjectionSnapshotSet,
  type SleeperProjectionScoringProfile,
} from '../server/sleeperProjectionSnapshots';

const VALID_PROFILES = new Set<SleeperProjectionScoringProfile>(['PPR', 'HALF_PPR', 'STD', 'CUSTOM']);

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function parseWeeks(value: string | null): number[] | undefined {
  if (!value) return undefined;
  const weeks = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((week) => Number.isInteger(week) && week > 0 && week <= 18);
  return weeks.length ? weeks : undefined;
}

function parseProfiles(value: string | null): SleeperProjectionScoringProfile[] | undefined {
  if (!value) return undefined;
  const profiles = value
    .split(',')
    .map((part) => part.trim().toUpperCase() as SleeperProjectionScoringProfile)
    .filter((profile) => VALID_PROFILES.has(profile));
  return profiles.length ? profiles : undefined;
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log([
      'Refresh stored Sleeper weekly projection snapshots.',
      '',
      'Default mode is dry-run. Add --write to persist to providerDataSnapshots.',
      '',
      'Examples:',
      '  pnpm refresh:sleeper-projections -- --season=2026 --weeks=1,2',
      '  pnpm refresh:sleeper-projections -- --season=2026 --profiles=PPR,HALF_PPR --write',
      '',
      'Flags:',
      '  --season=2026',
      '  --weeks=1,2,3',
      '  --profiles=PPR,HALF_PPR,STD',
      '  --delay-ms=150',
      '  --write',
    ].join('\n'));
    return;
  }

  const write = process.argv.includes('--write');
  if (write && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when running with --write.');
  }

  const season = getFlag('season') || new Date().getFullYear();
  const diagnostics = await refreshSleeperProjectionSnapshotSet({
    season,
    weeks: parseWeeks(getFlag('weeks')),
    scoringProfiles: parseProfiles(getFlag('profiles')),
    persistSnapshot: write,
    requestDelayMs: Number(getFlag('delay-ms') || 150),
  });

  console.log(JSON.stringify({
    mode: write ? 'write' : 'dry-run',
    source: 'stored-weekly-projection',
    season: String(season),
    profiles: diagnostics.map((row) => ({
      scoringProfile: row.scoringProfile,
      requestedWeeks: row.requestedWeeks,
      fetchedWeeks: row.fetchedWeeks,
      persistedWeeks: row.persistedWeeks,
      rowCount: row.rowCount,
      normalizedRowCount: row.normalizedRowCount,
      quarantinedRowCount: row.quarantinedRowCount,
      nonNullProjectionRowCount: row.nonNullProjectionRowCount,
      nullProjectionRowCount: row.nullProjectionRowCount,
      byeOrNullOpponentRowCount: row.byeOrNullOpponentRowCount,
      errors: row.errors,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error('[sleeper-projections] failed:', error);
  process.exitCode = 1;
});
