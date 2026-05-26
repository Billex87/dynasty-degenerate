import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSleeperRookieAdpData,
  getSleeperRookieAdpStatKey,
  parseSleeperRookieAdpRows,
} from './sleeperRookieAdp';

const sleeperRows = [
  {
    player_id: 'jeanty',
    stats: {
      adp_dynasty_2qb: 13.1,
      adp_dynasty_ppr: 8,
    },
    player: {
      first_name: 'Ashton',
      last_name: 'Jeanty',
      position: 'RB',
      team: 'LV',
      metadata: { rookie_year: '2025' },
    },
  },
  {
    player_id: 'ward',
    stats: {
      adp_dynasty_2qb: 55.7,
      adp_dynasty_ppr: 107.4,
    },
    player: {
      first_name: 'Cam',
      last_name: 'Ward',
      position: 'QB',
      team: 'TEN',
      metadata: { rookie_year: '2025' },
    },
  },
  {
    player_id: 'hunter',
    stats: {
      adp_dynasty_2qb: 37.6,
      adp_dynasty_ppr: 39.6,
    },
    player: {
      first_name: 'Travis',
      last_name: 'Hunter',
      position: 'WR',
      team: 'JAX',
      metadata: { rookie_year: '2025' },
    },
  },
  {
    player_id: 'old-player',
    stats: {
      adp_dynasty_2qb: 2,
      adp_dynasty_ppr: 2,
    },
    player: {
      first_name: 'Old',
      last_name: 'Player',
      position: 'QB',
      metadata: { rookie_year: '2024' },
    },
  },
  {
    player_id: 'unranked',
    stats: {
      adp_dynasty_2qb: 999,
      adp_dynasty_ppr: 999,
    },
    player: {
      first_name: 'Unranked',
      last_name: 'Rookie',
      position: 'RB',
      metadata: { rookie_year: '2025' },
    },
  },
];

describe('Sleeper rookie ADP source', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('selects Superflex or scoring-specific dynasty ADP fields', () => {
    expect(getSleeperRookieAdpStatKey({ numQbs: 2, ppr: 1 })).toBe('adp_dynasty_2qb');
    expect(getSleeperRookieAdpStatKey({ numQbs: 1, ppr: 1 })).toBe('adp_dynasty_ppr');
    expect(getSleeperRookieAdpStatKey({ numQbs: 1, ppr: 0.5 })).toBe('adp_dynasty_half_ppr');
    expect(getSleeperRookieAdpStatKey({ numQbs: 1, ppr: 0 })).toBe('adp_dynasty_std');
  });

  it('derives Superflex rookie rank from Sleeper dynasty 2QB ADP', () => {
    const rows = parseSleeperRookieAdpRows(sleeperRows, '2025', { numQbs: 2, ppr: 1 });

    expect(rows.jeanty).toMatchObject({
      year: '2025',
      name: 'Ashton Jeanty',
      positionRank: 'RB1',
      rank: 1,
      adp: 1,
      sleeperMarketAdp: 13.1,
      source: 'Sleeper SF Rookie Rank',
    });
    expect(rows.travishunter).toMatchObject({
      rank: 2,
      adp: 2,
      positionRank: 'WR1',
    });
    expect(rows.ward).toMatchObject({
      rank: 3,
      adp: 3,
      positionRank: 'QB1',
    });
    expect(rows['old-player']).toBeUndefined();
    expect(rows.unranked).toBeUndefined();
  });

  it('maps rookie-sized Sleeper picks to year-scoped ADP records', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sleeperRows),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adpData = await buildSleeperRookieAdpData(
      [
        { player_id: 'ward', round: 1, pick_no: 7, picked_by: 'u1', season: '2025', draft_pick_count: 36 },
        { player_id: 'startup', round: 11, pick_no: 120, picked_by: 'u1', season: '2025', draft_pick_count: 120 },
      ] as any,
      {
        ward: { full_name: 'Cam Ward' },
        startup: { full_name: 'Ashton Jeanty' },
      },
      { numQbs: 2, ppr: 1 }
    );

    expect(adpData).toEqual({
      '2025:ward': {
        name: 'Cam Ward',
        adp: 3,
        source: 'Sleeper SF Rookie Rank',
        rank: 3,
        positionRank: 'QB1',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.sleeper.app/projections/nfl/2025?season_type=regular');
  });
});
