#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import {
  getBoundedCleanupLimit,
  getExpiredCleanupCutoff,
  parseCleanupOptions,
  validateCleanupOptions,
} from './league-report-cache-cleanup-policy.mjs';

const options = parseCleanupOptions(process.env);

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

async function listExpiredRows(sql, boundedLimit) {
  const cutoff = getExpiredCleanupCutoff(Date.now(), options.maxAgeHours);
  return {
    label: `expired rows older than ${Math.max(1, options.maxAgeHours)} hours`,
    rows: await sql`
      SELECT
        "cacheKey",
        "leagueId",
        "viewerUserId",
        "updatedAt",
        OCTET_LENGTH(payload) AS payload_bytes
      FROM "leagueReportCache"
      WHERE "updatedAt" < ${cutoff}
      ORDER BY "updatedAt" ASC
      LIMIT ${boundedLimit}
    `,
  };
}

async function listStaleVersionRows(sql, boundedLimit) {
  return {
    label: 'stale version rows',
    rows: await sql`
      WITH versioned AS (
        SELECT
          "cacheKey",
          "leagueId",
          "viewerUserId",
          "updatedAt",
          OCTET_LENGTH(payload) AS payload_bytes,
          CASE
            WHEN "cacheKey" ~ '^league-report-v[0-9]+:' THEN 'league-report'
            WHEN "cacheKey" ~ '^league-rankings-v[0-9]+:' THEN 'league-rankings'
          END AS cache_family,
          CASE
            WHEN "cacheKey" ~ '^league-report-v[0-9]+:' THEN SUBSTRING("cacheKey" FROM '^league-report-v([0-9]+):')::INTEGER
            WHEN "cacheKey" ~ '^league-rankings-v[0-9]+:' THEN SUBSTRING("cacheKey" FROM '^league-rankings-v([0-9]+):')::INTEGER
          END AS cache_version
        FROM "leagueReportCache"
        WHERE "cacheKey" ~ '^league-(report|rankings)-v[0-9]+:'
      )
      SELECT
        "cacheKey",
        "leagueId",
        "viewerUserId",
        "updatedAt",
        payload_bytes
      FROM versioned
      WHERE (
          cache_family = 'league-report'
          AND cache_version < ${options.currentLeagueReportVersion}
        ) OR (
          cache_family = 'league-rankings'
          AND cache_version < ${options.currentLeagueRankingsVersion}
        )
      ORDER BY "updatedAt" ASC
      LIMIT ${boundedLimit}
    `,
  };
}

async function main() {
  const validationErrors = validateCleanupOptions(options);
  if (validationErrors.length) {
    for (const error of validationErrors) console.error(error);
    process.exitCode = 1;
    return;
  }

  const boundedLimit = getBoundedCleanupLimit(options.limit);
  const sql = neon(options.databaseUrl);
  const result = options.cleanupMode === 'expired'
    ? await listExpiredRows(sql, boundedLimit)
    : await listStaleVersionRows(sql, boundedLimit);
  const rows = result.rows;

  let totalBytes = 0;

  console.log('# leagueReportCache Cleanup');
  console.log(`Mode: ${options.cleanupMode}`);
  console.log(`Dry run: ${options.dryRun ? 'yes' : 'no'}`);
  console.log(`Limit: ${boundedLimit}`);
  console.log(`Keeping: league-report-v${options.currentLeagueReportVersion}, league-rankings-v${options.currentLeagueRankingsVersion}`);
  if (options.cleanupMode === 'expired') {
    console.log(`Max age: ${Math.max(1, options.maxAgeHours)} hours`);
  }

  if (rows.length === 0) {
    console.log(`\nNo ${result.label} found.`);
    return;
  }

  console.log(`\n${options.dryRun ? 'Rows that would be deleted' : 'Deleting'} ${result.label}:`);
  for (const row of rows) {
    const cacheKey = String(row.cacheKey || '');
    const payloadBytes = Number(row.payload_bytes || 0);
    totalBytes += payloadBytes;
    console.log(
      `- cacheKey=${cacheKey} leagueId=${row.leagueId || 'unknown'} viewerUserId=${row.viewerUserId || 'anon'} updatedAt=${formatDate(row.updatedAt)} payloadSize=${formatBytes(payloadBytes)}`
    );

    if (!options.dryRun) {
      await sql`
        DELETE FROM "leagueReportCache"
        WHERE "cacheKey" = ${cacheKey}
      `;
    }
  }

  console.log('\n## Summary');
  console.log(`Matched rows: ${rows.length}`);
  console.log(`${options.dryRun ? 'Would delete' : 'Deleted'}: ${formatBytes(totalBytes)}`);
  if (options.dryRun) {
    console.log('No rows were deleted. Set LEAGUE_REPORT_CACHE_CLEANUP_DRY_RUN=false and LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE=true only after approval.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
