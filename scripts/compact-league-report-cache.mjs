#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import { gzipSync, gunzipSync } from 'node:zlib';

const DATABASE_URL = process.env.DATABASE_URL;
const limit = Number.parseInt(process.env.LEAGUE_REPORT_CACHE_COMPACT_LIMIT || '100', 10) || 100;
const dryRun = process.env.LEAGUE_REPORT_CACHE_COMPACT_DRY_RUN !== 'false';
const ENCODING = 'gzip-base64';
const THRESHOLD_BYTES = 256 * 1024;

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

function parseStoredPayload(payload) {
  const parsed = JSON.parse(payload);
  if (parsed?.__ddCacheEncoding === ENCODING && typeof parsed.payload === 'string') {
    return {
      alreadyCompressed: true,
      value: JSON.parse(gunzipSync(Buffer.from(parsed.payload, 'base64')).toString('utf8')),
    };
  }
  return { alreadyCompressed: false, value: parsed };
}

function serializePayload(value) {
  const raw = JSON.stringify(value);
  if (Buffer.byteLength(raw, 'utf8') < THRESHOLD_BYTES) return raw;
  return JSON.stringify({
    __ddCacheEncoding: ENCODING,
    v: 1,
    payload: gzipSync(raw).toString('base64'),
  });
}

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required to compact leagueReportCache.');
    process.exitCode = 1;
    return;
  }

  const sql = neon(DATABASE_URL);
  const rows = await sql`
    SELECT "cacheKey", "leagueId", OCTET_LENGTH(payload) AS payload_bytes
    FROM "leagueReportCache"
    ORDER BY OCTET_LENGTH(payload) DESC
    LIMIT ${Math.max(1, Math.min(1000, Math.floor(limit)))}
  `;

  let scanned = 0;
  let skipped = 0;
  let changed = 0;
  let beforeBytes = 0;
  let afterBytes = 0;

  console.log('# leagueReportCache Compaction');
  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);
  console.log(`Limit: ${limit}`);

  for (const row of rows) {
    scanned += 1;
    const cacheKey = String(row.cacheKey || '');
    const payloadRows = await sql`
      SELECT payload
      FROM "leagueReportCache"
      WHERE "cacheKey" = ${cacheKey}
      LIMIT 1
    `;
    const originalPayload = String(payloadRows[0]?.payload || '');
    const originalBytes = Number(row.payload_bytes || Buffer.byteLength(originalPayload, 'utf8'));
    beforeBytes += originalBytes;

    let parsed;
    try {
      parsed = parseStoredPayload(originalPayload);
    } catch (error) {
      skipped += 1;
      console.log(`- skipped unparsable key=${cacheKey.slice(0, 96)} error=${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (parsed.alreadyCompressed) {
      skipped += 1;
      afterBytes += originalBytes;
      continue;
    }

    const compactedPayload = serializePayload(parsed.value);
    const compactedBytes = Buffer.byteLength(compactedPayload, 'utf8');
    afterBytes += compactedBytes;

    if (compactedBytes >= originalBytes) {
      skipped += 1;
      continue;
    }

    changed += 1;
    console.log(`- ${dryRun ? 'would compact' : 'compacted'} ${formatBytes(originalBytes)} -> ${formatBytes(compactedBytes)} league=${row.leagueId} key=${cacheKey.slice(0, 96)}`);

    if (!dryRun) {
      await sql`
        UPDATE "leagueReportCache"
        SET payload = ${compactedPayload}, "updatedAt" = "updatedAt"
        WHERE "cacheKey" = ${cacheKey}
      `;
    }
  }

  console.log('\n## Summary');
  console.log(`Scanned: ${scanned}`);
  console.log(`Changed: ${changed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Before: ${formatBytes(beforeBytes)}`);
  console.log(`After: ${formatBytes(afterBytes)}`);
  console.log(`Estimated savings: ${formatBytes(Math.max(0, beforeBytes - afterBytes))}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
