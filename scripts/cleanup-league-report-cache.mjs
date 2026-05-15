#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
const limit = Number.parseInt(process.env.LEAGUE_REPORT_CACHE_CLEANUP_LIMIT || '500', 10) || 500;
const dryRun = process.env.LEAGUE_REPORT_CACHE_CLEANUP_DRY_RUN !== 'false';
const confirmDelete = process.env.LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE === 'true';

const CURRENT_LEAGUE_REPORT_VERSION = 37;
const CURRENT_LEAGUE_RANKINGS_VERSION = 11;

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

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required to clean up leagueReportCache.');
    process.exitCode = 1;
    return;
  }

  if (!dryRun && !confirmDelete) {
    console.error('Refusing to delete rows without LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE=true.');
    console.error('Run the default dry run first, review the rows, and ask before deleting production rows.');
    process.exitCode = 1;
    return;
  }

  const boundedLimit = Math.max(1, Math.min(5000, Math.floor(limit)));
  const sql = neon(DATABASE_URL);
  const rows = await sql`
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
        AND cache_version < ${CURRENT_LEAGUE_REPORT_VERSION}
      ) OR (
        cache_family = 'league-rankings'
        AND cache_version < ${CURRENT_LEAGUE_RANKINGS_VERSION}
      )
    ORDER BY "updatedAt" ASC
    LIMIT ${boundedLimit}
  `;

  let totalBytes = 0;

  console.log('# leagueReportCache Stale Version Cleanup');
  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);
  console.log(`Limit: ${boundedLimit}`);
  console.log(`Keeping: league-report-v${CURRENT_LEAGUE_REPORT_VERSION}, league-rankings-v${CURRENT_LEAGUE_RANKINGS_VERSION}`);

  if (rows.length === 0) {
    console.log('\nNo stale leagueReportCache version rows found.');
    return;
  }

  console.log(`\n${dryRun ? 'Rows that would be deleted' : 'Deleting rows'}:`);
  for (const row of rows) {
    const cacheKey = String(row.cacheKey || '');
    const payloadBytes = Number(row.payload_bytes || 0);
    totalBytes += payloadBytes;
    console.log(
      `- cacheKey=${cacheKey} leagueId=${row.leagueId || 'unknown'} viewerUserId=${row.viewerUserId || 'anon'} updatedAt=${formatDate(row.updatedAt)} payloadSize=${formatBytes(payloadBytes)}`
    );

    if (!dryRun) {
      await sql`
        DELETE FROM "leagueReportCache"
        WHERE "cacheKey" = ${cacheKey}
      `;
    }
  }

  console.log('\n## Summary');
  console.log(`Matched rows: ${rows.length}`);
  console.log(`${dryRun ? 'Would delete' : 'Deleted'}: ${formatBytes(totalBytes)}`);
  if (dryRun) {
    console.log('No rows were deleted. Set LEAGUE_REPORT_CACHE_CLEANUP_DRY_RUN=false and LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE=true only after approval.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
