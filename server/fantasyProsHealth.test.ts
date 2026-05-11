import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFantasyProsSourceHealthEvents, checkFantasyProsApiHealth } from './fantasyProsHealth';

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
    });
    expect(dynastyEvent).toMatchObject({
      job: 'fantasypros-api-health',
      board: 'dynasty',
      level: 'info',
      status: 'loaded',
      rowCount: 2,
    });
    expect(JSON.stringify(dynastyEvent?.payload)).not.toContain('Ja\'Marr Chase');
    expect(JSON.stringify(dynastyEvent?.payload)).not.toContain('Bijan Robinson');
  });

  it('records failed endpoints as danger events', async () => {
    const fetchMock = vi.fn(async () => new Response('rate limited', {
      status: 429,
      statusText: 'Too Many Requests',
    }));

    const rows = await checkFantasyProsApiHealth({
      season: '2026',
      apiKey: 'test-key',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const events = buildFantasyProsSourceHealthEvents(rows);

    expect(rows[0]).toMatchObject({
      status: 'error',
      statusCode: 429,
      error: 'Too Many Requests',
    });
    expect(events[0]).toMatchObject({
      level: 'danger',
      status: 'error',
      rowCount: 0,
    });
  });
});
