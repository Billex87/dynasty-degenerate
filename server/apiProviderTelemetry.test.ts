import { afterEach, describe, expect, it } from 'vitest';
import {
  clearApiProviderTelemetryForTests,
  getApiProviderTelemetrySnapshot,
  recordApiProviderCacheHit,
  recordApiProviderTelemetryEvent,
} from './apiProviderTelemetry';

describe('api provider telemetry', () => {
  afterEach(() => {
    clearApiProviderTelemetryForTests();
  });

  it('summarizes network calls, cache hits, failures, 429s, and endpoint cost', () => {
    recordApiProviderTelemetryEvent({
      provider: 'FantasyPros',
      endpoint: '/NFL/2026/consensus-rankings',
      status: 200,
      ok: true,
      durationMs: 120,
      cacheStatus: 'miss',
      costUnits: 1,
    });
    recordApiProviderCacheHit({
      provider: 'FantasyPros',
      endpoint: '/NFL/2026/consensus-rankings',
      job: 'DRAFT',
    });
    recordApiProviderTelemetryEvent({
      provider: 'FantasyPros',
      endpoint: '/NFL/news',
      status: 429,
      ok: false,
      durationMs: 40,
      cacheStatus: 'miss',
      costUnits: 1,
      message: 'rate limited',
    });

    const snapshot = getApiProviderTelemetrySnapshot({ lookbackMs: 60_000 });

    expect(snapshot.totals.calls).toBe(3);
    expect(snapshot.totals.networkCalls).toBe(2);
    expect(snapshot.totals.cacheHits).toBe(1);
    expect(snapshot.totals.cacheHitRatePct).toBe(33.3);
    expect(snapshot.totals.failures).toBe(1);
    expect(snapshot.totals.rateLimited).toBe(1);
    expect(snapshot.byProvider[0]).toMatchObject({
      label: 'FantasyPros',
      calls: 3,
      networkCalls: 2,
      cacheHits: 1,
      failures: 1,
      rateLimited: 1,
    });
    expect(snapshot.byEndpoint[0]?.label).toContain('FantasyPros');
  });

  it('ignores old events outside the lookback window', () => {
    recordApiProviderTelemetryEvent({
      provider: 'FantasyPros',
      endpoint: '/NFL/old',
      status: 200,
      ok: true,
      durationMs: 10,
      cacheStatus: 'miss',
      createdAt: new Date(Date.now() - 3_600_000),
    });

    const snapshot = getApiProviderTelemetrySnapshot({ lookbackMs: 1_000 });

    expect(snapshot.totals.calls).toBe(0);
    expect(snapshot.byProvider).toEqual([]);
  });
});

