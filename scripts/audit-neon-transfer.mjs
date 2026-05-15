#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
const DEFAULT_LIMIT = 20;
const limit = Number.parseInt(process.env.NEON_TRANSFER_AUDIT_LIMIT || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT;

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

function printRows(title, rows, mapper) {
  console.log(`\n## ${title}`);
  if (!rows.length) {
    console.log('No rows returned.');
    return;
  }
  rows.forEach((row, index) => {
    console.log(`${String(index + 1).padStart(2, ' ')}. ${mapper(row)}`);
  });
}

function tableSizeQuery(sql) {
  return sql`
    SELECT
      c.relname AS table_name,
      pg_total_relation_size(c.oid) AS total_bytes,
      pg_relation_size(c.oid) AS table_bytes,
      pg_indexes_size(c.oid) AS index_bytes,
      COALESCE(s.n_live_tup, 0) AS estimated_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
  `;
}

async function safeQuery(label, query) {
  try {
    return await query();
  } catch (error) {
    console.log(`\n## ${label}`);
    console.log(`Skipped: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required to run the Neon transfer audit.');
    process.exitCode = 1;
    return;
  }

  const sql = neon(DATABASE_URL);
  console.log(`# Neon/Postgres Transfer Audit`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Limit: ${limit}`);

  const tableSizes = await safeQuery('Table sizes', () => tableSizeQuery(sql));
  printRows('Largest Tables', tableSizes, (row) =>
    `${row.table_name}: ${formatBytes(row.total_bytes)} total (${formatBytes(row.table_bytes)} table, ${formatBytes(row.index_bytes)} indexes), ~${Number(row.estimated_rows || 0).toLocaleString()} rows`
  );

  const leagueReports = await safeQuery('Largest leagueReportCache payloads', () => sql`
    SELECT
      "cacheKey",
      "leagueId",
      "viewerUserId",
      OCTET_LENGTH(payload) AS payload_bytes,
      "updatedAt"
    FROM "leagueReportCache"
    ORDER BY OCTET_LENGTH(payload) DESC
    LIMIT ${limit}
  `);
  printRows('Largest leagueReportCache Payloads', leagueReports, (row) =>
    `${formatBytes(row.payload_bytes)} league=${row.leagueId} viewer=${row.viewerUserId || 'anon'} updated=${new Date(row.updatedAt).toISOString()} key=${String(row.cacheKey).slice(0, 72)}`
  );

  const recentReports = await safeQuery('Recent leagueReportCache writes', () => sql`
    SELECT
      "leagueId",
      COUNT(*) AS writes,
      SUM(OCTET_LENGTH(payload)) AS total_payload_bytes,
      AVG(OCTET_LENGTH(payload)) AS avg_payload_bytes,
      MAX("updatedAt") AS latest_write
    FROM "leagueReportCache"
    WHERE "updatedAt" >= NOW() - INTERVAL '7 days'
    GROUP BY "leagueId"
    ORDER BY SUM(OCTET_LENGTH(payload)) DESC
    LIMIT ${limit}
  `);
  printRows('Recent leagueReportCache Transfer Drivers', recentReports, (row) =>
    `${formatBytes(row.total_payload_bytes)} over ${row.writes} writes, avg ${formatBytes(row.avg_payload_bytes)}, league=${row.leagueId}, latest=${new Date(row.latest_write).toISOString()}`
  );

  const snapshotPayloads = await safeQuery('Snapshot payload sizes', () => sql`
    SELECT 'redraftSourceSnapshots' AS table_name, "snapshotKey" AS key, season AS context, OCTET_LENGTH(payload) AS payload_bytes, "updatedAt"
    FROM "redraftSourceSnapshots"
    UNION ALL
    SELECT 'devySourceSnapshots' AS table_name, "snapshotKey" AS key, "profileKey" AS context, OCTET_LENGTH(payload) AS payload_bytes, "updatedAt"
    FROM "devySourceSnapshots"
    UNION ALL
    SELECT 'leagueAiConfidenceSnapshots' AS table_name, "snapshotKey" AS key, "leagueId" AS context, OCTET_LENGTH(payload) AS payload_bytes, "updatedAt"
    FROM "leagueAiConfidenceSnapshots"
    UNION ALL
    SELECT 'monthlyRosterBlueprintSnapshots' AS table_name, "snapshotMonth" AS key, "leagueId" AS context, OCTET_LENGTH(payload) AS payload_bytes, "updatedAt"
    FROM "monthlyRosterBlueprintSnapshots"
    ORDER BY payload_bytes DESC
    LIMIT ${limit}
  `);
  printRows('Largest Snapshot Payloads', snapshotPayloads, (row) =>
    `${row.table_name}: ${formatBytes(row.payload_bytes)} key=${row.key} context=${row.context} updated=${new Date(row.updatedAt).toISOString()}`
  );

  const sourceHealth = await safeQuery('Source health volume', () => sql`
    SELECT
      "sourceKey",
      source,
      level,
      status,
      COUNT(*) AS events,
      MAX("createdAt") AS latest_event
    FROM "sourceHealthEvents"
    WHERE "createdAt" >= NOW() - INTERVAL '14 days'
    GROUP BY "sourceKey", source, level, status
    ORDER BY COUNT(*) DESC, MAX("createdAt") DESC
    LIMIT ${limit}
  `);
  printRows('Recent Source Health Event Volume', sourceHealth, (row) =>
    `${row.events} events source=${row.source} key=${row.sourceKey} level=${row.level} status=${row.status} latest=${new Date(row.latest_event).toISOString()}`
  );

  console.log('\n## Follow-up');
  console.log('- Use the largest payload rows to decide what can be summarized, compressed, or split into metadata/detail reads.');
  console.log('- If table sizes look small but transfer is high, add per-route DB read/write telemetry next; PostgreSQL size alone will not explain repeated full-payload reads.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
