import fs from 'fs';
import path from 'path';

export type ApiProviderCacheStatus = 'hit' | 'miss' | 'bypass';
export type ApiProviderCallScope = 'user-load' | 'cron' | 'admin' | 'maintenance' | 'test' | 'unknown';

export type ApiProviderTelemetryEvent = {
  provider: string;
  endpoint: string;
  method?: string;
  status?: number | null;
  ok: boolean;
  durationMs?: number | null;
  cacheStatus: ApiProviderCacheStatus;
  costUnits?: number;
  job?: string | null;
  scope?: ApiProviderCallScope | null;
  message?: string | null;
  createdAt?: Date | string | null;
};

type StoredApiProviderTelemetryEvent = {
  provider: string;
  endpoint: string;
  method: string;
  status: number | null;
  ok: boolean;
  durationMs: number | null;
  cacheStatus: ApiProviderCacheStatus;
  costUnits: number;
  job: string | null;
  scope: ApiProviderCallScope;
  message: string | null;
  createdAt: Date;
};

const MAX_MEMORY_EVENTS = 5000;
const TELEMETRY_LOG_DIR = path.join(process.cwd(), '.cache', 'api-provider-telemetry');
const events: StoredApiProviderTelemetryEvent[] = [];

function shouldSkipDiskWrites(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

function getDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeEvent(event: ApiProviderTelemetryEvent): StoredApiProviderTelemetryEvent {
  const scope: ApiProviderCallScope = event.scope === 'user-load'
    || event.scope === 'cron'
    || event.scope === 'admin'
    || event.scope === 'maintenance'
    || event.scope === 'test'
    ? event.scope
    : 'unknown';

  return {
    provider: event.provider.trim() || 'unknown',
    endpoint: event.endpoint.trim() || 'unknown',
    method: (event.method || 'GET').toUpperCase(),
    status: event.status ?? null,
    ok: Boolean(event.ok),
    durationMs: event.durationMs ?? null,
    cacheStatus: event.cacheStatus,
    costUnits: Number.isFinite(event.costUnits) ? Math.max(0, Number(event.costUnits)) : 1,
    job: event.job ?? null,
    scope,
    message: event.message ?? null,
    createdAt: event.createdAt ? new Date(event.createdAt) : new Date(),
  };
}

function writeLocalEvent(event: StoredApiProviderTelemetryEvent) {
  if (shouldSkipDiskWrites()) return;
  try {
    fs.mkdirSync(TELEMETRY_LOG_DIR, { recursive: true });
    const filePath = path.join(TELEMETRY_LOG_DIR, `api-provider-telemetry-${getDateKey(event.createdAt)}.jsonl`);
    fs.appendFileSync(filePath, `${JSON.stringify({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })}\n`);
  } catch (error) {
    console.warn('[ApiProviderTelemetry] Failed to write local telemetry event:', error);
  }
}

export function recordApiProviderTelemetryEvent(event: ApiProviderTelemetryEvent) {
  const normalized = normalizeEvent(event);
  events.push(normalized);
  if (events.length > MAX_MEMORY_EVENTS) {
    events.splice(0, events.length - MAX_MEMORY_EVENTS);
  }
  writeLocalEvent(normalized);
}

export function recordApiProviderCacheHit(input: {
  provider: string;
  endpoint: string;
  job?: string | null;
  scope?: ApiProviderCallScope | null;
}) {
  recordApiProviderTelemetryEvent({
    provider: input.provider,
    endpoint: input.endpoint,
    ok: true,
    status: 200,
    durationMs: 0,
    cacheStatus: 'hit',
    costUnits: 0,
    job: input.job ?? null,
    scope: input.scope ?? null,
    message: 'served from in-process cache',
  });
}

function createBucket(label: string) {
  return {
    label,
    calls: 0,
    networkCalls: 0,
    cacheHits: 0,
    failures: 0,
    rateLimited: 0,
    costUnits: 0,
    durationTotalMs: 0,
    durationSamples: 0,
    firstSeen: null as Date | null,
    lastSeen: null as Date | null,
    lastStatus: null as number | null,
    lastMessage: null as string | null,
  };
}

function addEventToBucket(bucket: ReturnType<typeof createBucket>, event: StoredApiProviderTelemetryEvent) {
  bucket.calls += 1;
  if (event.cacheStatus === 'hit') bucket.cacheHits += 1;
  if (event.cacheStatus !== 'hit') bucket.networkCalls += 1;
  if (!event.ok) bucket.failures += 1;
  if (event.status === 429) bucket.rateLimited += 1;
  bucket.costUnits += event.costUnits;
  if (typeof event.durationMs === 'number') {
    bucket.durationTotalMs += event.durationMs;
    bucket.durationSamples += 1;
  }
  if (!bucket.firstSeen || event.createdAt < bucket.firstSeen) bucket.firstSeen = event.createdAt;
  if (!bucket.lastSeen || event.createdAt > bucket.lastSeen) {
    bucket.lastSeen = event.createdAt;
    bucket.lastStatus = event.status;
    bucket.lastMessage = event.message;
  }
}

function serializeBucket(bucket: ReturnType<typeof createBucket>) {
  const avgDurationMs = bucket.durationSamples
    ? Math.round(bucket.durationTotalMs / bucket.durationSamples)
    : 0;
  const cacheHitRatePct = bucket.calls
    ? Math.round((bucket.cacheHits / bucket.calls) * 1000) / 10
    : 0;

  return {
    label: bucket.label,
    calls: bucket.calls,
    networkCalls: bucket.networkCalls,
    cacheHits: bucket.cacheHits,
    cacheHitRatePct,
    failures: bucket.failures,
    rateLimited: bucket.rateLimited,
    costUnits: bucket.costUnits,
    avgDurationMs,
    firstSeen: bucket.firstSeen?.toISOString() ?? null,
    lastSeen: bucket.lastSeen?.toISOString() ?? null,
    lastStatus: bucket.lastStatus,
    lastMessage: bucket.lastMessage,
  };
}

function bucketEvents(
  sourceEvents: StoredApiProviderTelemetryEvent[],
  getLabel: (event: StoredApiProviderTelemetryEvent) => string,
  limit: number,
) {
  const buckets = new Map<string, ReturnType<typeof createBucket>>();
  for (const event of sourceEvents) {
    const label = getLabel(event) || 'unknown';
    const bucket = buckets.get(label) || createBucket(label);
    addEventToBucket(bucket, event);
    buckets.set(label, bucket);
  }

  return Array.from(buckets.values())
    .map(serializeBucket)
    .sort((a, b) => b.costUnits - a.costUnits || b.failures - a.failures || b.calls - a.calls || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function getApiProviderTelemetrySnapshot(options: {
  lookbackMs?: number;
  limit?: number;
} = {}) {
  const lookbackMs = Math.max(1, options.lookbackMs || 7 * 24 * 60 * 60 * 1000);
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit || 10)));
  const since = new Date(Date.now() - lookbackMs);
  const scopedEvents = events.filter((event) => event.createdAt >= since);
  const totalDuration = scopedEvents.reduce((sum, event) => sum + (event.durationMs || 0), 0);
  const durationSamples = scopedEvents.filter((event) => typeof event.durationMs === 'number').length;
  const cacheHits = scopedEvents.filter((event) => event.cacheStatus === 'hit').length;

  return {
    generatedAt: new Date().toISOString(),
    lookbackMs,
    totals: {
      events: scopedEvents.length,
      calls: scopedEvents.length,
      networkCalls: scopedEvents.filter((event) => event.cacheStatus !== 'hit').length,
      cacheHits,
      cacheHitRatePct: scopedEvents.length ? Math.round((cacheHits / scopedEvents.length) * 1000) / 10 : 0,
      failures: scopedEvents.filter((event) => !event.ok).length,
      rateLimited: scopedEvents.filter((event) => event.status === 429).length,
      costUnits: scopedEvents.reduce((sum, event) => sum + event.costUnits, 0),
      avgDurationMs: durationSamples ? Math.round(totalDuration / durationSamples) : 0,
      uniqueProviders: new Set(scopedEvents.map((event) => event.provider)).size,
      uniqueEndpoints: new Set(scopedEvents.map((event) => `${event.provider}:${event.endpoint}`)).size,
      userLoadCalls: scopedEvents.filter((event) => event.scope === 'user-load').length,
      userLoadNetworkCalls: scopedEvents.filter((event) => event.scope === 'user-load' && event.cacheStatus !== 'hit').length,
      cronCalls: scopedEvents.filter((event) => event.scope === 'cron').length,
      adminCalls: scopedEvents.filter((event) => event.scope === 'admin').length,
    },
    byProvider: bucketEvents(scopedEvents, (event) => event.provider, limit),
    byEndpoint: bucketEvents(scopedEvents, (event) => `${event.provider} ${event.endpoint}`, limit),
    byScope: bucketEvents(scopedEvents, (event) => event.scope, limit),
    recentEvents: [...scopedEvents]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, Math.min(25, limit * 2))
      .map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
  };
}

export function clearApiProviderTelemetryForTests() {
  events.splice(0, events.length);
}
