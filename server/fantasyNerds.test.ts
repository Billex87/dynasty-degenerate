import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFantasyNerdsDraftRankings,
  fetchFantasyNerdsDynastyRankings,
  hasFantasyNerdsApiKey,
  normalizeFantasyNerdsRankingsPayload,
} from './fantasyNerds';

function restoreFantasyNerdsEnv(originalEnv: Record<string, string | undefined>) {
  if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv.NODE_ENV;
  if (originalEnv.FANTASY_NERDS_API_KEY === undefined) delete process.env.FANTASY_NERDS_API_KEY;
  else process.env.FANTASY_NERDS_API_KEY = originalEnv.FANTASY_NERDS_API_KEY;
  if (originalEnv.FANTASYNERDS_API_KEY === undefined) delete process.env.FANTASYNERDS_API_KEY;
  else process.env.FANTASYNERDS_API_KEY = originalEnv.FANTASYNERDS_API_KEY;
  if (originalEnv.ENABLE_FANTASY_NERDS_TEST_DATA === undefined) delete process.env.ENABLE_FANTASY_NERDS_TEST_DATA;
  else process.env.ENABLE_FANTASY_NERDS_TEST_DATA = originalEnv.ENABLE_FANTASY_NERDS_TEST_DATA;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Fantasy Nerds API normalization', () => {
  it('normalizes draft rankings with ADP pick strings into redraft values', () => {
    const rows = normalizeFantasyNerdsRankingsPayload({
      season: 2026,
      format: 'ppr',
      players: [{
        playerId: '954',
        name: 'Christian McCaffrey',
        team: 'SF',
        position: 'RB',
        rank: 2,
        rank_position: 1,
        pick: '1.03',
      }],
    }, { kind: 'redraft', teams: 12 });

    expect(rows.christianmccaffrey).toMatchObject({
      name: 'Christian McCaffrey',
      position: 'RB',
      team: 'SF',
      overallRank: 2,
      positionRank: 'RB1',
      season: '2026',
      adp: 3,
    });
    expect(rows.christianmccaffrey.redraftValue).toBeGreaterThan(8000);
  });

  it('rejects stale test dynasty payloads before they can enter the blend', () => {
    const rows = normalizeFantasyNerdsRankingsPayload({
      season: 2021,
      players: [{
        playerId: '954',
        name: 'Christian McCaffrey',
        team: 'CAR',
        position: 'RB',
        rank: '1',
        rank_position: '1',
      }],
    }, {
      kind: 'dynasty',
      expectedSeason: '2026',
      rejectStaleDynastySeason: true,
    });

    expect(rows).toEqual({});
  });

  it('uses the TEST fallback in development when no real key is configured', async () => {
    const originalEnv = {
      NODE_ENV: process.env.NODE_ENV,
      FANTASY_NERDS_API_KEY: process.env.FANTASY_NERDS_API_KEY,
      FANTASYNERDS_API_KEY: process.env.FANTASYNERDS_API_KEY,
      ENABLE_FANTASY_NERDS_TEST_DATA: process.env.ENABLE_FANTASY_NERDS_TEST_DATA,
    };

    try {
      process.env.NODE_ENV = 'development';
      delete process.env.FANTASY_NERDS_API_KEY;
      delete process.env.FANTASYNERDS_API_KEY;
      delete process.env.ENABLE_FANTASY_NERDS_TEST_DATA;

      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        expect(url).toContain('apikey=TEST');
        return {
          ok: true,
          json: async () => ({
            season: 2021,
            players: [{
              playerId: '954',
              name: 'Christian McCaffrey',
              team: 'SF',
              position: 'RB',
              rank: 2,
              rank_position: 1,
              pick: '1.03',
            }],
          }),
        } as unknown as Response;
      });
      vi.stubGlobal('fetch', fetchMock);

      expect(hasFantasyNerdsApiKey()).toBe(true);

      const dynastyRows = await fetchFantasyNerdsDynastyRankings('2026');
      expect(dynastyRows.christianmccaffrey).toMatchObject({
        name: 'Christian McCaffrey',
        position: 'RB',
        season: '2021',
      });

      const draftRows = await fetchFantasyNerdsDraftRankings('ppr', 12);
      expect(draftRows.christianmccaffrey).toMatchObject({
        name: 'Christian McCaffrey',
        position: 'RB',
        season: String(new Date().getFullYear()),
      });
    } finally {
      restoreFantasyNerdsEnv(originalEnv);
    }
  });
});
