import { describe, expect, it } from 'vitest';
import { getLastPlaceRosterIdFromLosersBracket } from './routers';

describe('manager championships', () => {
  it('uses the actual lower-score loser of the final toilet-bowl matchup for sacko', () => {
    const losersBracket = [
      { m: 3, r: 2, l: 3, w: 9, t1: 9, t2: 3, t2_from: { w: 1 } },
      { m: 4, r: 2, l: 5, w: 10, t1: 10, t2: 5, t2_from: { w: 2 } },
      { p: 1, m: 6, r: 3, l: 10, w: 9, t1: 9, t2: 10, t2_from: { w: 4 }, t1_from: { w: 3 } },
      { p: 3, m: 7, r: 3, l: 5, w: 3, t1: 3, t2: 5, t2_from: { l: 4 }, t1_from: { l: 3 } },
    ];
    const week17Matchups = [
      { roster_id: 9, points: 98.99, custom_points: null },
      { roster_id: 10, points: 100.15, custom_points: null },
      { roster_id: 3, points: 116.91, custom_points: null },
      { roster_id: 5, points: 182.94, custom_points: null },
    ];

    expect(getLastPlaceRosterIdFromLosersBracket(losersBracket, 0, week17Matchups)).toBe(9);
  });

  it("falls back to the loser's path roster when toilet-bowl matchup points are unavailable", () => {
    const losersBracket = [
      { p: 1, m: 6, r: 3, l: 10, w: 9, t1: 9, t2: 10 },
      { p: 3, m: 7, r: 3, l: 5, w: 3, t1: 3, t2: 5 },
    ];

    expect(getLastPlaceRosterIdFromLosersBracket(losersBracket, 0)).toBe(9);
  });
});
