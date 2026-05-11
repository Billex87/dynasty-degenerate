import { describe, expect, it } from 'vitest';
import { normalizeFantasyNerdsRankingsPayload } from './fantasyNerds';

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
});
