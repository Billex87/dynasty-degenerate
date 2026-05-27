#!/usr/bin/env node

import '../server/_core/env';
import { loadSourceSnapshotFreshnessDiagnostics } from '../server/sourceSnapshotFreshness';
import { buildSourceFreshnessSummary } from '../server/sourceFreshnessSummary';
import type { SourceSnapshotFreshnessDiagnostic } from '../shared/types';

const currentYear = String(new Date().getFullYear());
const currentSeason = String(process.env.SOURCE_FRESHNESS_CURRENT_SEASON || currentYear);
const previousSeason = process.env.SOURCE_FRESHNESS_PREVIOUS_SEASON || null;
const valueProfileKey = process.env.SOURCE_FRESHNESS_VALUE_PROFILE_KEY || '12_sf_ppr_base';
const devyProfileKey = process.env.SOURCE_FRESHNESS_DEVY_PROFILE_KEY || null;
const currentWeek = parseOptionalInteger(process.env.SOURCE_FRESHNESS_CURRENT_WEEK);
const weekWindow = parseOptionalInteger(process.env.SOURCE_FRESHNESS_WEEK_WINDOW);
const limit = Math.max(1, Math.min(50, parseOptionalInteger(process.env.SOURCE_FRESHNESS_LIMIT) || 12));

function parseOptionalInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatBytes(value: number): string {
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatAge(hours: number | null): string {
  if (hours === null) return 'unknown';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours - days * 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatSourceLine(diagnostic: SourceSnapshotFreshnessDiagnostic): string {
  const parts = [
    `${diagnostic.level.toUpperCase()} ${diagnostic.status}`,
    diagnostic.source,
    `key=${diagnostic.sourceKey}`,
    `age=${formatAge(diagnostic.ageHours)}`,
    diagnostic.rowCount === null ? 'rows=unknown' : `rows=${diagnostic.rowCount.toLocaleString('en-US')}`,
    diagnostic.payloadSizeBytes === null ? null : `payload=${formatBytes(diagnostic.payloadSizeBytes)}`,
    diagnostic.lastHealthMessage ? `health=${diagnostic.lastHealthMessage}` : null,
  ];
  return `- ${parts.filter(Boolean).join(' | ')}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to audit source freshness.');
    process.exitCode = 1;
    return;
  }

  const diagnostics = await loadSourceSnapshotFreshnessDiagnostics({
    currentSeason,
    previousSeason,
    valueProfileKey,
    devyProfileKey,
    currentWeek,
    weekWindow,
  });
  const summary = buildSourceFreshnessSummary({
    diagnostics,
    currentSeason,
    valueProfileKey,
    limit,
  });

  console.log('# Source Freshness Audit');
  console.log(`Generated: ${summary.generatedAt}`);
  console.log(`Season: ${summary.currentSeason || 'unknown'}`);
  console.log(`Value profile: ${summary.valueProfileKey || 'unknown'}`);
  console.log(`Current week: ${currentWeek ?? 'auto'}`);
  console.log(`Weekly ECR window: ${weekWindow ?? 'default'}`);

  console.log('\n## Summary');
  console.log(`Sources: ${summary.totals.sources}`);
  console.log(`Status: ${summary.totals.loaded} loaded, ${summary.totals.stale} stale, ${summary.totals.missing} missing, ${summary.totals.error} error`);
  console.log(`Levels: ${summary.totals.info} info, ${summary.totals.warn} warn, ${summary.totals.danger} danger`);
  console.log(`Rows represented: ${summary.rows.toLocaleString('en-US')}`);
  console.log(`Stored payload bytes: ${formatBytes(summary.payloadBytes)}`);
  console.log(`Oldest loaded source: ${summary.oldestLoadedSource ? `${summary.oldestLoadedSource.source} (${formatAge(summary.oldestLoadedSource.ageHours)})` : 'none'}`);

  console.log('\n## Actionable Sources');
  if (!summary.actionableSources.length) {
    console.log('No stale, missing, warn, or danger sources found.');
  } else {
    for (const diagnostic of summary.actionableSources) {
      console.log(formatSourceLine(diagnostic));
    }
  }

  console.log('\n## Recent Health Issues');
  if (!summary.recentHealthIssues.length) {
    console.log('No recent source-health issues found.');
  } else {
    for (const diagnostic of summary.recentHealthIssues) {
      console.log(formatSourceLine(diagnostic));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
