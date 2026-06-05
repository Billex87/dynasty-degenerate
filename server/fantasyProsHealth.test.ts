import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFantasyProsSourceHealthEvents, checkFantasyProsApiHealth, getFantasyProsEndpointDefinitions } from './fantasyProsHealth';

describe('FantasyPros API health checks', () => {
  afterEach(() => {
    delete process.env.FANTASYPROS_API_KEY;
    vi.unstubAllGlobals();
  });

  it('returns one disabled health row when no server key is configured', async () => {
    const rows = await checkFantasyProsApiHealth({
      season: '2026',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: 'fantasypros-api-key',
      label: 'FantasyPros API Key',
      status: 'disabled',
      rowCount: 0,
    });

    const events = buildFantasyProsSourceHealthEvents(rows);
    expect(events[0]).toMatchObject({
      job: 'fantasypros-api-health',
      sourceKey: 'fantasypros-api-key',
      level: 'warn',
      status: 'disabled',
    });
  });

  it('summarizes endpoint row counts and expert counts without storing raw payloads', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('type=DYNASTY')) {
        return new Response(JSON.stringify({
          last_updated: '2026-05-11T00:00:00Z',
          published_at: '2026-05-11T01:00:00Z',
          total_experts: 22,
          players: [
            { player_name: 'Ja\'Marr Chase' },
            { player_name: 'Bijan Robinson' },
          ],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        players: [{ player_name: 'Sample Player' }],
        total_experts: 12,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const rows = await checkFantasyProsApiHealth({
      season: '2026',
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
      requestDelayMs: 0,
    });
    const dynastyRow = rows.find((row) => row.key === 'fantasypros-dynasty');
    const events = buildFantasyProsSourceHealthEvents(rows);
    const dynastyEvent = events.find((event) => event.sourceKey === 'fantasypros-dynasty');

    expect(rows.length).toBeGreaterThan(8);
    expect(dynastyRow).toMatchObject({
      status: 'loaded',
      rowCount: 2,
      totalExperts: 22,
      lastUpdated: '2026-05-11T00:00:00Z',
      publishedAt: '2026-05-11T01:00:00Z',
    });
    expect(dynastyEvent).toMatchObject({
      job: 'fantasypros-api-health',
      board: 'dynasty',
      level: 'info',
      status: 'loaded',
      rowCount: 2,
    });
    expect(dynastyEvent?.payload).toMatchObject({
      totalExperts: 22,
      lastUpdated: '2026-05-11T00:00:00Z',
      publishedAt: '2026-05-11T01:00:00Z',
    });
    expect(JSON.stringify(dynastyEvent?.payload)).not.toContain('Ja\'Marr Chase');
    expect(JSON.stringify(dynastyEvent?.payload)).not.toContain('Bijan Robinson');
  });

  it('keeps missing expert metadata unknown instead of treating it as zero', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      players: [{ player_name: 'Sample Player' }],
      total_experts: null,
      totalExperts: '',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const rows = await checkFantasyProsApiHealth({
      season: '2026',
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
      requestDelayMs: 0,
    });
    const draftRow = rows.find((row) => row.key === 'fantasypros-draft');
    const draftEvent = buildFantasyProsSourceHealthEvents(rows)
      .find((event) => event.sourceKey === 'fantasypros-draft');

    expect(draftRow).toMatchObject({
      status: 'loaded',
      rowCount: 1,
      totalExperts: null,
    });
    expect(draftEvent?.payload).toMatchObject({
      totalExperts: null,
    });
  });

  it('records rate limited endpoints as danger events and skips the remaining probes', async () => {
    const fetchMock = vi.fn(async () => new Response('rate limited', {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'retry-after': '10' },
    }));

    const rows = await checkFantasyProsApiHealth({
      season: '2026',
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
      requestDelayMs: 0,
    });
    const events = buildFantasyProsSourceHealthEvents(rows);

    expect(rows[0]).toMatchObject({
      status: 'rate_limited',
      statusCode: 429,
      retryAfterMs: 10000,
      error: 'Too Many Requests',
    });
    expect(rows[1]).toMatchObject({
      status: 'skipped',
      statusCode: null,
      rowCount: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events[0]).toMatchObject({
      level: 'danger',
      status: 'rate_limited',
      rowCount: 0,
    });
    expect(events[1]).toMatchObject({
      level: 'warn',
      status: 'skipped',
      rowCount: 0,
    });
  });

  it('adds expanded endpoint probes without requiring raw payload storage', async () => {
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
        players: [{ player_name: 'Sample Player' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const rows = await checkFantasyProsApiHealth({
      season: '2026',
      apiKey: 'test-key',
      includeExpanded: true,
      includeProjections: true,
      currentWeek: 2,
      weekWindow: 3,
      fetchImpl: fetchMock as unknown as typeof fetch,
      requestDelayMs: 0,
    });

    expect(rows.find((row) => row.key === 'fantasypros-weekly-ecr')).toMatchObject({ status: 'loaded' });
    expect(rows.find((row) => row.key === 'fantasypros-weekly-ecr-qb-week-2')).toMatchObject({ status: 'loaded' });
    expect(rows.find((row) => row.key === 'fantasypros-weekly-ecr-rb-week-2')).toMatchObject({ status: 'loaded' });
    expect(rows.find((row) => row.key === 'fantasypros-weekly-ecr-wr-week-3')).toMatchObject({ status: 'loaded' });
    expect(rows.find((row) => row.key === 'fantasypros-weekly-ecr-te-week-3')).toMatchObject({ status: 'loaded' });
    expect(rows.find((row) => row.key === 'fantasypros-weekly-ecr-k-week-4')).toMatchObject({ status: 'loaded' });
    expect(rows.find((row) => row.key === 'fantasypros-weekly-ecr-dst-week-4')).toMatchObject({ status: 'loaded' });
    expect(rows.find((row) => row.key === 'fantasypros-ww')).toMatchObject({ status: 'loaded' });
    expect(rows.find((row) => row.key === 'fantasypros-targets')).toBeUndefined();
    expect(rows.find((row) => row.key === 'fantasypros-articles')).toBeUndefined();
    expect(rows.find((row) => row.key === 'fantasypros-compare-players')).toMatchObject({
      status: 'loaded',
      rowCount: 2,
    });
    expect(rows.find((row) => row.key === 'fantasypros-projections')).toMatchObject({ status: 'loaded' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/nfl/2026/consensus-rankings?position=RB&scoring=PPR&week=3'),
      expect.any(Object),
    );
  });

  it('keeps entitlement-gated expanded endpoints opt-in', () => {
    const defaultRows = getFantasyProsEndpointDefinitions({
      season: '2026',
      scoring: 'PPR',
      includeExpanded: true,
      currentWeek: 1,
      weekWindow: 1,
    });
    const entitledRows = getFantasyProsEndpointDefinitions({
      season: '2026',
      scoring: 'PPR',
      includeExpanded: true,
      includeTargets: true,
      includeArticles: true,
      currentWeek: 1,
      weekWindow: 1,
    });

    expect(defaultRows.some((row) => row.key === 'fantasypros-targets')).toBe(false);
    expect(defaultRows.some((row) => row.key === 'fantasypros-articles')).toBe(false);
    expect(entitledRows.some((row) => row.key === 'fantasypros-targets')).toBe(true);
    expect(entitledRows.some((row) => row.key === 'fantasypros-articles')).toBe(true);
  });
});
