#!/usr/bin/env tsx

import '../server/_core/env';
import {
  DRAFTSHARKS_PUBLIC_SOS_URL,
  refreshDraftSharksPublicSosSnapshot,
} from '../server/draftSharksPublicSosSnapshot';

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function printHelp() {
  console.log([
    'Refresh DraftSharks SOS from the public strength-of-schedule page into a stored snapshot.',
    '',
    'Usage:',
    '  pnpm refresh:draftsharks-sos -- --season=2026',
    '  pnpm refresh:draftsharks-sos -- --season=2026 --write',
    '',
    'Flags:',
    '  --season=2026',
    '  --source-version=public-2026-2026-06-04',
    '  --url=https://www.draftsharks.com/strength-of-schedule/qb',
    '  --write',
    '',
    'Default mode is dry-run. Add --write to persist draftsharks-sos-v1.',
  ].join('\n'));
}

function defaultSeason(): string {
  return getFlag('season') || process.env.DRAFTSHARKS_SOS_SEASON || String(new Date().getUTCFullYear());
}

function defaultSourceVersion(season: string): string {
  return getFlag('source-version') ||
    process.env.DRAFTSHARKS_SOS_SOURCE_VERSION ||
    `public-${season}-${new Date().toISOString().slice(0, 10)}`;
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const write = process.argv.includes('--write');
  if (write && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when running with --write.');
  }

  const season = defaultSeason();
  const sourceVersion = defaultSourceVersion(season);
  const sourceUrl = getFlag('url') || process.env.DRAFTSHARKS_SOS_PUBLIC_URL || DRAFTSHARKS_PUBLIC_SOS_URL;
  const { snapshot } = await refreshDraftSharksPublicSosSnapshot({
    season,
    sourceVersion,
    sourceUrl,
    fetchedAt: new Date(),
    persistSnapshot: write,
  });

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
  console.error('[draftsharks-sos-refresh] failed:', error);
  process.exitCode = 1;
});
