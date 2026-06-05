import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import { getFantasyProsEndpointSnapshotSourceKey, refreshFantasyProsEndpointSnapshots } from './fantasyProsEndpointSnapshots';

describe('FantasyPros endpoint snapshots', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FANTASYPROS_API_KEY;
  });

  it('persists successful endpoint payloads behind source-specific snapshot keys', async () => {
    const upsertSpy = vi.spyOn(db, 'upsertProviderDataSnapshot').mockResolvedValue(true);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('compare-players')) {
        return new Response(JSON.stringify({
          rankings: { PPR: { '9016': [{ rank: 20 }], '9020': [{ rank: 25 }] } },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        last_updated: '5/19',
        published_at: '2026-05-19T09:00:00Z',
        total_experts: 12,
        players: [{ player_name: 'Sample Player' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const results = await refreshFantasyProsEndpointSnapshots({
      season: '2026',
      scoring: 'PPR',
      apiKey: 'test-key',
      includeExpanded: true,
      includeProjections: true,
      currentWeek: 2,
      weekWindow: 3,
      fetchImpl: fetchMock as unknown as typeof fetch,
      requestDelayMs: 0,
      now: new Date('2026-05-19T12:00:00Z'),
    });

    expect(results.find((row) => row.endpointKey === 'fantasypros-weekly-ecr')).toMatchObject({
      status: 'loaded',
      rowCount: 1,
      persisted: true,
    });
    expect(results.find((row) => row.endpointKey === 'fantasypros-weekly-ecr-dst-week-4')).toMatchObject({
      status: 'loaded',
      rowCount: 1,
      persisted: true,
    });
    expect(results.find((row) => row.endpointKey === 'fantasypros-compare-players')).toMatchObject({
      status: 'loaded',
      rowCount: 2,
      persisted: true,
    });
    expect(results.find((row) => row.endpointKey === 'fantasypros-targets')).toBeUndefined();
    expect(results.find((row) => row.endpointKey === 'fantasypros-articles')).toBeUndefined();
    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: getFantasyProsEndpointSnapshotSourceKey({
        endpointKey: 'fantasypros-weekly-ecr',
        season: '2026',
        scoring: 'PPR',
      }),
      snapshotKey: '2026-05-19',
    }));
    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: getFantasyProsEndpointSnapshotSourceKey({
        endpointKey: 'fantasypros-weekly-ecr-dst-week-4',
        season: '2026',
        scoring: 'PPR',
      }),
      snapshotKey: '2026-05-19',
    }));
    const weeklyEcrCall = upsertSpy.mock.calls.find(([input]) =>
      input.sourceKey === getFantasyProsEndpointSnapshotSourceKey({
        endpointKey: 'fantasypros-weekly-ecr',
        season: '2026',
        scoring: 'PPR',
      })
    );
    const persistedPayload = JSON.parse(String(weeklyEcrCall?.[0].payload || '{}'));
    expect(persistedPayload).toMatchObject({
      totalExperts: 12,
      lastUpdated: '5/19',
      publishedAt: '2026-05-19T09:00:00Z',
    });
    expect(JSON.stringify(upsertSpy.mock.calls)).not.toContain('test-key');
  });

  it('keeps missing expert-count metadata unknown instead of recording zero experts', async () => {
    vi.spyOn(db, 'upsertProviderDataSnapshot').mockResolvedValue(true);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      last_updated: '5/19',
      total_experts: null,
      totalExperts: '',
      players: [{ player_name: 'Sample Player' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const results = await refreshFantasyProsEndpointSnapshots({
      season: '2026',
      scoring: 'PPR',
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
      persistSnapshot: false,
      requestDelayMs: 0,
      includeExpanded: false,
      includeProjections: false,
      currentWeek: 1,
      weekWindow: 1,
    });

    expect(results[0]).toMatchObject({
      endpointKey: 'fantasypros-draft',
      status: 'loaded',
      rowCount: 1,
      totalExperts: null,
    });
  });

  it('stops after a rate limit and marks later endpoints as skipped', async () => {
    const upsertSpy = vi.spyOn(db, 'upsertProviderDataSnapshot').mockResolvedValue(true);
    const fetchMock = vi.fn(async () => new Response('rate limited', {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'retry-after': '5' },
    }));

    const results = await refreshFantasyProsEndpointSnapshots({
      season: '2026',
      scoring: 'PPR',
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
      requestDelayMs: 0,
      rateLimitRetryAttempts: 0,
    });

    expect(results[0]).toMatchObject({
      status: 'rate_limited',
      retryAfterMs: 5000,
      persisted: false,
    });
    expect(results[1]).toMatchObject({
      status: 'skipped',
      persisted: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('retries a rate-limited endpoint before moving on', async () => {
    const upsertSpy = vi.spyOn(db, 'upsertProviderDataSnapshot').mockResolvedValue(true);
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response('rate limited', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'retry-after': '0' },
        });
      }

      return new Response(JSON.stringify({
        players: [{ player_name: 'Recovered Player' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const results = await refreshFantasyProsEndpointSnapshots({
      season: '2026',
      scoring: 'PPR',
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
      requestDelayMs: 0,
      rateLimitRetryAttempts: 1,
      rateLimitRetryDelayMs: 0,
    });

    expect(results[0]).toMatchObject({
      endpointKey: 'fantasypros-draft',
      status: 'loaded',
      rowCount: 1,
      persisted: true,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(fetchMock.mock.calls[1][0]);
    expect(upsertSpy).toHaveBeenCalled();
  });

  it('can continue later endpoints after a persistent rate limit', async () => {
    vi.spyOn(db, 'upsertProviderDataSnapshot').mockResolvedValue(true);
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      if (callCount <= 2) {
        return new Response('rate limited', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'retry-after': '0' },
        });
      }

      return new Response(JSON.stringify({
        players: [{ player_name: 'Next Endpoint Player' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const results = await refreshFantasyProsEndpointSnapshots({
      season: '2026',
      scoring: 'PPR',
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
      requestDelayMs: 0,
      rateLimitRetryAttempts: 1,
      rateLimitRetryDelayMs: 0,
      stopOnRateLimit: false,
    });

    expect(results[0]).toMatchObject({
      endpointKey: 'fantasypros-draft',
      status: 'rate_limited',
      persisted: false,
    });
    expect(results[1]).toMatchObject({
      endpointKey: 'fantasypros-ros',
      status: 'loaded',
      rowCount: 1,
      persisted: true,
    });
    expect(results[1].status).not.toBe('skipped');
  });
});
