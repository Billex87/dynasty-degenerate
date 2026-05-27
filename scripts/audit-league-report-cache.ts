#!/usr/bin/env node

import '../server/_core/env';
import { getDb } from '../server/db';
import { getLeagueReportCacheTtlHours, getLeagueReportCacheTtlMs } from '../server/leagueReportCachePolicy';

type CacheSummaryRow = {
  total_rows?: number | string | null;
  fresh_rows?: number | string | null;
  stale_rows?: number | string | null;
  total_payload_bytes?: number | string | null;
  latest_updated_at?: Date | string | null;
  oldest_updated_at?: Date | string | null;
};

type CacheEntryRow = {
  cacheKey?: string | null;
  leagueId?: string | null;
  viewerUserId?: string | null;
  updatedAt?: Date | string | null;
  payload_bytes?: number | string | null;
};

type AnalyzeSummaryRow = {
  total_attempts?: number | string | null;
  cache_hits?: number | string | null;
  fresh_successes?: number | string | null;
  errors?: number | string | null;
};

type AnalyzeNoteRow = {
  status?: string | null;
  note?: string | null;
  attempt_count?: number | string | null;
  latest_at?: Date | string | null;
};

const limit = Math.max(1, Math.min(100, Number.parseInt(process.env.LEAGUE_REPORT_CACHE_AUDIT_LIMIT || '12', 10) || 12));
const lookbackHours = Math.max(1, Math.min(24 * 14, Number.parseFloat(process.env.LEAGUE_REPORT_CACHE_AUDIT_LOOKBACK_HOURS || '24') || 24));
const showFullCacheKeys = process.env.LEAGUE_REPORT_CACHE_AUDIT_FULL_KEYS === 'true';
const ttlHours = getLeagueReportCacheTtlHours();
const ttlMs = getLeagueReportCacheTtlMs();

function parseLeagueIds(value: string | undefined): string[] {
  return Array.from(
    new Set(
      String(value || '')
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function toNumber(value: unknown): number {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatBytes(value: unknown): string {
  const bytes = toNumber(value);
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: Date | string | null | undefined): string {
  return toDate(value)?.toISOString() || 'unknown';
}

function formatAge(value: Date | string | null | undefined, nowMs = Date.now()): string {
  const date = toDate(value);
  if (!date) return 'unknown';
  const ageMs = Math.max(0, nowMs - date.getTime());
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function maskId(value: string | null | undefined): string {
  const text = String(value || '').trim();
  if (!text) return 'none';
  if (text.length <= 6) return text;
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function formatFreshness(updatedAt: Date | string | null | undefined, nowMs = Date.now()): string {
  const date = toDate(updatedAt);
  if (!date) return 'unknown';
  return nowMs - date.getTime() <= ttlMs ? 'fresh' : 'stale';
}

function getCacheFamily(cacheKey: string | null | undefined): string {
  const key = String(cacheKey || '');
  if (key.startsWith('league-report-')) return 'report';
  if (key.startsWith('league-rankings-')) return 'rankings';
  return 'other';
}

function formatCacheKey(cacheKey: string | null | undefined): string {
  const key = String(cacheKey || 'unknown');
  if (showFullCacheKeys || key.length <= 160) return key;
  return `${key.slice(0, 120)}...${key.slice(-32)}`;
}

async function main() {
  const sql = await getDb();
  if (!sql) {
    console.error('DATABASE_URL is required to audit leagueReportCache.');
    process.exitCode = 1;
    return;
  }

  const now = new Date();
  const nowMs = now.getTime();
  const freshAfter = new Date(nowMs - ttlMs);
  const since = new Date(nowMs - lookbackHours * 60 * 60 * 1000);
  const warmLeagueIds = parseLeagueIds(process.env.LEAGUE_REPORT_WARM_LEAGUE_IDS);

  const summary = (await sql`
    SELECT
      COUNT(*) AS total_rows,
      COUNT(*) FILTER (WHERE "updatedAt" >= ${freshAfter}) AS fresh_rows,
      COUNT(*) FILTER (WHERE "updatedAt" < ${freshAfter}) AS stale_rows,
      COALESCE(SUM(OCTET_LENGTH(payload)), 0) AS total_payload_bytes,
      MAX("updatedAt") AS latest_updated_at,
      MIN("updatedAt") AS oldest_updated_at
    FROM "leagueReportCache"
  ` as CacheSummaryRow[])[0] || {};

  const cacheEntries = await sql`
    SELECT
      "cacheKey",
      "leagueId",
      "viewerUserId",
      "updatedAt",
      OCTET_LENGTH(payload) AS payload_bytes
    FROM "leagueReportCache"
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  ` as CacheEntryRow[];

  const analyzeSummary = (await sql`
    SELECT
      COUNT(*) AS total_attempts,
      COUNT(*) FILTER (
        WHERE status = 'success'
          AND note LIKE 'Served cached league report%'
      ) AS cache_hits,
      COUNT(*) FILTER (
        WHERE status = 'success'
          AND (note IS NULL OR note NOT LIKE 'Served cached league report%')
      ) AS fresh_successes,
      COUNT(*) FILTER (WHERE status = 'error') AS errors
    FROM "loginAttempts"
    WHERE "eventType" = 'analyze_league'
      AND "createdAt" >= ${since}
  ` as AnalyzeSummaryRow[])[0] || {};

  const analyzeNotes = await sql`
    SELECT
      status,
      note,
      COUNT(*) AS attempt_count,
      MAX("createdAt") AS latest_at
    FROM "loginAttempts"
    WHERE "eventType" = 'analyze_league'
      AND "createdAt" >= ${since}
    GROUP BY status, note
    ORDER BY latest_at DESC
    LIMIT ${limit}
  ` as AnalyzeNoteRow[];

  console.log('# leagueReportCache Audit');
  console.log(`Generated: ${now.toISOString()}`);
  console.log(`Serving TTL: ${ttlHours}h`);
  console.log(`Lookback: ${lookbackHours}h`);
  console.log(`Recent entry limit: ${limit}`);
  console.log(`Full cache keys: ${showFullCacheKeys ? 'yes' : 'no'}`);
  console.log(`Warm leagues configured: ${warmLeagueIds.length ? `${warmLeagueIds.length} (${warmLeagueIds.map(maskId).join(', ')})` : 'none'}`);

  console.log('\n## Cache Summary');
  console.log(`Rows: ${toNumber(summary.total_rows)} total, ${toNumber(summary.fresh_rows)} fresh, ${toNumber(summary.stale_rows)} stale`);
  console.log(`Stored payload bytes: ${formatBytes(summary.total_payload_bytes)}`);
  console.log(`Latest cache update: ${formatDate(summary.latest_updated_at)} (${formatAge(summary.latest_updated_at, nowMs)} ago)`);
  console.log(`Oldest cache update: ${formatDate(summary.oldest_updated_at)} (${formatAge(summary.oldest_updated_at, nowMs)} ago)`);

  console.log('\n## Recent Cache Entries');
  if (!cacheEntries.length) {
    console.log('No league report cache rows found.');
  } else {
    for (const row of cacheEntries) {
      console.log(
        `- ${formatFreshness(row.updatedAt, nowMs)} ${getCacheFamily(row.cacheKey)} league=${maskId(row.leagueId)} viewer=${maskId(row.viewerUserId)} age=${formatAge(row.updatedAt, nowMs)} size=${formatBytes(row.payload_bytes)} key=${formatCacheKey(row.cacheKey)}`
      );
    }
  }

  const totalAttempts = toNumber(analyzeSummary.total_attempts);
  const cacheHits = toNumber(analyzeSummary.cache_hits);
  const freshSuccesses = toNumber(analyzeSummary.fresh_successes);
  const errors = toNumber(analyzeSummary.errors);
  const hitRate = totalAttempts > 0 ? `${Math.round((cacheHits / totalAttempts) * 100)}%` : 'n/a';

  console.log('\n## Recent Analyze Activity');
  console.log(`Attempts: ${totalAttempts}; cache hits: ${cacheHits}; fresh/uncached successes: ${freshSuccesses}; errors: ${errors}; hit rate: ${hitRate}`);

  if (!analyzeNotes.length) {
    console.log('No analyze attempts found in the lookback window.');
  } else {
    for (const row of analyzeNotes) {
      console.log(
        `- ${row.status || 'unknown'} x${toNumber(row.attempt_count)} latest=${formatDate(row.latest_at)} note=${row.note || 'none'}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
