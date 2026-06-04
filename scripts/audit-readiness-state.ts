#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import '../server/_core/env';
import { loadSourceSnapshotFreshnessDiagnostics } from '../server/sourceSnapshotFreshness';
import { buildSourceCoverageMatrix } from '../server/sourceCoverageMatrix';
import { buildSourceFreshnessSummary } from '../server/sourceFreshnessSummary';
import { listSourceHealthEventsSince } from '../server/db';
import { evaluateOperationsSecurityReadiness } from '../server/operationsSecurityReadiness';
import type { SourceSnapshotFreshnessDiagnostic } from '../shared/types';

type ApiTelemetryEvent = {
  createdAt?: string;
  provider?: string;
  endpoint?: string;
  scope?: string;
  ok?: boolean;
  cacheStatus?: string;
  status?: number | null;
  costUnits?: number | null;
  message?: string | null;
};

type ApiTelemetryBucket = {
  calls: number;
  failures: number;
  rateLimited: number;
  networkCalls: number;
};

type ApiTelemetryBucketEntry = {
  label: string;
  metrics: ApiTelemetryBucket;
};

const LOOKBACK_DAYS = Math.max(1, Number.parseInt(process.env.READINESS_AUDIT_LOOKBACK_DAYS || '14', 10) || 14);
const SOURCE_SUMMARY_LIMIT = Math.max(1, Math.min(200, Number.parseInt(process.env.READINESS_AUD_LIMIT || '40', 10) || 40));
const API_TELEMETRY_DIR = path.join(process.cwd(), '.cache', 'api-provider-telemetry');
const HEALTH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatBytes(value: unknown): string {
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

function formatAge(date: Date | string | null | undefined, nowMs = Date.now()): string {
  const parsed = toDate(date);
  if (!parsed) return 'unknown';
  const ageMs = Math.max(0, nowMs - parsed.getTime());
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  const minutes = Math.floor((ageMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function maskId(value: string | null | undefined): string {
  const text = String(value || '').trim();
  if (!text) return 'none';
  if (text.length <= 8) return text;
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function summarizeApiTelemetry(days = LOOKBACK_DAYS): {
  totals: ApiTelemetryBucket;
  providerBuckets: ApiTelemetryBucketEntry[];
  endpointBuckets: ApiTelemetryBucketEntry[];
} {
  const nowMs = Date.now();
  const since = new Date(nowMs - days * 24 * 60 * 60 * 1000);
  if (!fs.existsSync(API_TELEMETRY_DIR)) {
    return {
      totals: { calls: 0, failures: 0, rateLimited: 0, networkCalls: 0 },
      providerBuckets: [],
      endpointBuckets: [],
    };
  }

  const files = fs
    .readdirSync(API_TELEMETRY_DIR)
    .filter((file) => file.startsWith('api-provider-telemetry-') && file.endsWith('.jsonl'))
    .sort();
  const providerBuckets = new Map<string, ApiTelemetryBucket>();
  const endpointBuckets = new Map<string, ApiTelemetryBucket>();
  const totals: ApiTelemetryBucket = { calls: 0, failures: 0, rateLimited: 0, networkCalls: 0 };

  for (const file of files) {
    const text = fs.readFileSync(path.join(API_TELEMETRY_DIR, file), 'utf8');
    const lines = text.split('\n').filter(Boolean);
    for (const line of lines) {
      let event: ApiTelemetryEvent;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      const created = toDate(event.createdAt);
      if (!created || created.getTime() < since.getTime()) continue;

      const provider = String(event.provider || 'unknown');
      const endpoint = `${provider} ${String(event.endpoint || 'unknown')}`.trim();
      const bucket = providerBuckets.get(provider) || { calls: 0, failures: 0, rateLimited: 0, networkCalls: 0 };
      const endpointBucket = endpointBuckets.get(endpoint) || { calls: 0, failures: 0, rateLimited: 0, networkCalls: 0 };
      const isNetwork = event.cacheStatus !== 'hit';

      totals.calls += 1;
      bucket.calls += 1;
      endpointBucket.calls += 1;
      if (!event.ok) {
        totals.failures += 1;
        bucket.failures += 1;
        endpointBucket.failures += 1;
      }
      if (event.status === 429) {
        totals.rateLimited += 1;
        bucket.rateLimited += 1;
        endpointBucket.rateLimited += 1;
      }
      if (isNetwork) {
        totals.networkCalls += 1;
        bucket.networkCalls += 1;
        endpointBucket.networkCalls += 1;
      }
      providerBuckets.set(provider, bucket);
      endpointBuckets.set(endpoint, endpointBucket);
    }
  }

  const sortByCalls = (entries: [string, ApiTelemetryBucket][]) =>
    entries.sort((a, b) => b[1].calls - a[1].calls).map(([label, metrics]) => ({ label, metrics }));

  return {
    totals,
    providerBuckets: sortByCalls(Array.from(providerBuckets.entries())),
    endpointBuckets: sortByCalls(Array.from(endpointBuckets.entries())),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to run readiness snapshot.');
    process.exitCode = 1;
    return;
  }

  const currentSeason = String(new Date().getFullYear());
  const freshness = await loadSourceSnapshotFreshnessDiagnostics({
    currentSeason: process.env.READINESS_AUDIT_SEASON || currentSeason,
    previousSeason: process.env.READINESS_AUDIT_PREVIOUS_SEASON || null,
    valueProfileKey: process.env.READINESS_AUDIT_VALUE_PROFILE_KEY || '12_sf_ppr_base',
    devyProfileKey: process.env.READINESS_AUDIT_DEVY_PROFILE_KEY || null,
    currentWeek: null,
    weekWindow: null,
  });

  const healthEvents = await listSourceHealthEventsSince(new Date(Date.now() - HEALTH_WINDOW_MS), SOURCE_SUMMARY_LIMIT);
  const coverage = buildSourceCoverageMatrix({
    currentSeason: process.env.READINESS_AUDIT_SEASON || currentSeason,
    previousSeason: process.env.READINESS_AUDIT_PREVIOUS_SEASON,
    valueProfileKey: process.env.READINESS_AUDIT_VALUE_PROFILE_KEY || '12_sf_ppr_base',
    devyProfileKey: process.env.READINESS_AUDIT_DEVY_PROFILE_KEY,
    lookbackDays: LOOKBACK_DAYS,
    freshnessDiagnostics: freshness,
    healthEvents,
    generatedAt: new Date(),
  });

  const freshnessSummary = buildSourceFreshnessSummary({
    diagnostics: freshness,
    generatedAt: new Date().toISOString(),
    currentSeason: coverage.generatedAt ? process.env.READINESS_AUDIT_SEASON || currentSeason : currentSeason,
    valueProfileKey: process.env.READINESS_AUDIT_VALUE_PROFILE_KEY || '12_sf_ppr_base',
    limit: SOURCE_SUMMARY_LIMIT,
  });

  console.log('# Readiness Snapshot Audit');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Lookback days: ${LOOKBACK_DAYS}`);
  console.log(`Season: ${process.env.READINESS_AUDIT_SEASON || currentSeason}`);
  console.log(`Profile: ${process.env.READINESS_AUDIT_VALUE_PROFILE_KEY || '12_sf_ppr_base'}`);

  const securityReadiness = evaluateOperationsSecurityReadiness();
  console.log('\n## Operations Security Readiness');
  console.log(`Checks: pass=${securityReadiness.totals.pass} warn=${securityReadiness.totals.warn} blocker=${securityReadiness.totals.blocker}`);
  for (const check of securityReadiness.checks.filter((item) => item.status !== 'pass')) {
    console.log(`- ${check.status.toUpperCase()} ${check.id} [${check.envNames.join(', ')}]: ${check.message}`);
  }

  console.log('\n## Source Freshness Summary');
  console.log(`Sources: ${freshnessSummary.totals.sources}`);
  console.log(`Status: ${freshnessSummary.totals.loaded} loaded, ${freshnessSummary.totals.stale} stale, ${freshnessSummary.totals.missing} missing, ${freshnessSummary.totals.error} error`);
  console.log(`Levels: ${freshnessSummary.totals.info} info, ${freshnessSummary.totals.warn} warn, ${freshnessSummary.totals.danger} danger`);
  console.log(`Payload bytes: ${formatBytes(freshnessSummary.payloadBytes)}`);
  console.log(`Rows represented: ${freshnessSummary.rows.toLocaleString('en-US')}`);

  console.log('\n## Source Coverage Matrix');
  console.log(`Totals: ${coverage.totals.sources} sources | ${coverage.totals.loaded} loaded | ${coverage.totals.stale} stale | ${coverage.totals.missing} missing | ${coverage.totals.blocked} blocked | ${coverage.totals.research} research`);
  console.log(`Needs approval: ${coverage.totals.needsApproval}`);

  console.log('\n## Source Coverage Actionables');
  if (!coverage.rows.length) {
    console.log('No coverage rows found.');
  } else {
    for (const row of coverage.rows.slice(0, SOURCE_SUMMARY_LIMIT).filter((row) => row.level !== 'info' || row.status !== 'loaded')) {
      console.log(`${row.level.toUpperCase()} ${row.status} | ${maskId(row.sourceKey)} (${row.source}) | age=${row.ageHours === null ? 'unknown' : `${row.ageHours}h`} | rows=${row.rowCount ?? 'unknown'}${row.tableName ? ` | table=${row.tableName}` : ''}${row.lastHealthStatus ? ` | health=${row.lastHealthStatus}` : ''}`);
    }
  }

  console.log('\n## Health Event Summary (14-day lookback)');
  console.log(`Source-health events: ${healthEvents.length}`);
  if (!healthEvents.length) {
    console.log('No source-health events found in window.');
  } else {
    const danger = healthEvents.filter((event) => event.level === 'danger').length;
    const warn = healthEvents.filter((event) => event.level === 'warn').length;
    const info = healthEvents.filter((event) => event.level === 'info').length;
    console.log(`Levels: danger=${danger}, warn=${warn}, info=${info}`);
    for (const event of healthEvents.slice(0, 20)) {
      console.log(`- ${event.level.toUpperCase()} ${event.status} ${event.sourceKey} | source=${event.source} | created=${formatAge(event.createdAt, Date.now())} | rows=${event.rowCount ?? 'n/a'}`);
    }
  }

  const apiSummary = summarizeApiTelemetry(LOOKBACK_DAYS);
  console.log('\n## API Provider Telemetry Snapshot (cache log)');
  console.log(`Calls=${apiSummary.totals.calls} network=${apiSummary.totals.networkCalls} failures=${apiSummary.totals.failures} 429s=${apiSummary.totals.rateLimited}`);
  if (apiSummary.totals.calls === 0) {
    console.log('No local provider telemetry log events found in cache window. Capture requires running server in same deployment window.');
  } else {
    console.log('\n## Top Providers');
    for (const item of apiSummary.providerBuckets.slice(0, 10)) {
      console.log(`- ${item.label} calls=${item.metrics.calls} network=${item.metrics.networkCalls} failures=${item.metrics.failures} 429s=${item.metrics.rateLimited}`);
    }

    console.log('\n## Top Endpoints');
    for (const item of apiSummary.endpointBuckets.slice(0, 10)) {
      console.log(`- ${item.label} calls=${item.metrics.calls} network=${item.metrics.networkCalls} failures=${item.metrics.failures} 429s=${item.metrics.rateLimited}`);
    }
  }

  console.log('\n## Fresh Sources');
  const loadedAndFresh = freshness.filter((item) => item.status === 'loaded' && item.level === 'info');
  console.log(`Loaded + info: ${loadedAndFresh.length} source families`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
