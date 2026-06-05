import { describe, expect, it, vi } from 'vitest';
import {
  FANTASY_NERDS_PACKAGE_PROBES,
  runFantasyNerdsPackageProbe,
  summarizeFantasyNerdsPackageProbeResults,
} from './fantasyNerdsProbe';

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    status,
    headers: {
      get: () => 'application/json',
    },
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

describe('Fantasy Nerds package probe', () => {
  it('reports missing config without calling the protected endpoint', async () => {
    const fetchMock = vi.fn();

    const result = await runFantasyNerdsPackageProbe(FANTASY_NERDS_PACKAGE_PROBES[0], {
      env: {},
      fetchImpl: fetchMock as unknown as typeof fetch,
      expectedSeason: '2026',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'missing_config',
      credentialConfigured: false,
      usesTestKey: false,
      currentSeasonNonTestRows: false,
    });
  });

  it('confirms current-season non-TEST rows without exposing the key in metadata', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse({
      season: 2026,
      players: [
        { playerId: '1', name: 'Example Player', team: 'BUF', position: 'QB', rank: 1 },
        { playerId: '2', name: 'Second Player', team: 'KC', position: 'RB', rank: 2 },
      ],
      lastUpdated: '2026-06-05T12:00:00Z',
    }));

    const result = await runFantasyNerdsPackageProbe(FANTASY_NERDS_PACKAGE_PROBES[2], {
      env: { FANTASY_NERDS_API_KEY: 'real-key' },
      fetchImpl: fetchMock as unknown as typeof fetch,
      expectedSeason: '2026',
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('apikey=real-key');
    expect(result.path).not.toContain('real-key');
    expect(result).toMatchObject({
      status: 'loaded',
      rows: 2,
      shape: 'players',
      sourceSeason: '2026',
      freshnessTimestamp: '2026-06-05T12:00:00Z',
      credentialConfigured: true,
      usesTestKey: false,
      currentSeasonRows: true,
      nonTestRows: true,
      currentSeasonNonTestRows: true,
    });

    const summary = summarizeFantasyNerdsPackageProbeResults([result], { expectedSeason: '2026' });
    expect(summary).toMatchObject({
      gateStatus: 'research',
      currentSeasonNonTestRowsConfirmed: true,
    });
  });

  it('keeps TEST rows from satisfying production package evidence', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse({
      season: 2026,
      players: [{ playerId: '1', name: 'Example Player', team: 'BUF', position: 'QB', rank: 1 }],
    }));

    const result = await runFantasyNerdsPackageProbe(FANTASY_NERDS_PACKAGE_PROBES[2], {
      env: { FANTASY_NERDS_API_KEY: 'TEST' },
      fetchImpl: fetchMock as unknown as typeof fetch,
      expectedSeason: '2026',
    });
    const summary = summarizeFantasyNerdsPackageProbeResults([result], { expectedSeason: '2026' });

    expect(result).toMatchObject({
      status: 'loaded',
      usesTestKey: true,
      currentSeasonRows: true,
      nonTestRows: false,
      currentSeasonNonTestRows: false,
    });
    expect(summary.gateStatus).toBe('blocked');
    expect(summary.blockedReasons.join(' ')).toContain('TEST payloads');
  });

  it('detects Fantasy Nerds rate-limit error nodes even when HTTP status is 200', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse({
      Error: 'Rate limit exceeded. Please cache API responses.',
    }));

    const result = await runFantasyNerdsPackageProbe(FANTASY_NERDS_PACKAGE_PROBES[6], {
      env: { FANTASY_NERDS_API_KEY: 'real-key' },
      fetchImpl: fetchMock as unknown as typeof fetch,
      expectedSeason: '2026',
    });

    expect(result).toMatchObject({
      status: 'rate_limited',
      httpStatus: 200,
      rows: null,
      currentSeasonNonTestRows: false,
    });
  });
});
