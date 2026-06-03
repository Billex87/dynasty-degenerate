import { describe, expect, it } from 'vitest';
import type { ManagerIntelPlayer } from '@shared/types';
import { gradeRoster } from './playerGrading';
import {
  buildAverageAge,
  buildPositionValueShare,
  buildRosterMakeup,
  buildValueProportion,
  getDraftCapitalScore,
  getOverallGrade,
} from './rosterAggregates';

function makePlayer(overrides: Partial<ManagerIntelPlayer> & { player_id: string; pos: string; value: number }): ManagerIntelPlayer {
  return { name: overrides.name || overrides.player_id, ...overrides } as ManagerIntelPlayer;
}

const roster: ManagerIntelPlayer[] = [
  makePlayer({ player_id: 'qb1', pos: 'QB', value: 8000, playerDetails: { age: 26 } }),
  makePlayer({ player_id: 'rb1', pos: 'RB', value: 2000, playerDetails: { age: 24 } }),
  makePlayer({ player_id: 'wr1', pos: 'WR', value: 6000, playerDetails: { age: 22 } }),
  makePlayer({ player_id: 'wr2', pos: 'WR', value: 4000, playerDetails: { age: 28 } }),
  makePlayer({ player_id: 'te1', pos: 'TE', value: 0, playerDetails: { age: 24 } }),
];

describe('buildValueProportion', () => {
  it('shares sum to ~100 and include a draft-capital slice', () => {
    const slices = buildValueProportion(roster, 4000); // 20000 players + 4000 picks = 24000
    const dc = slices.find((s) => s.key === 'DC')!;
    expect(dc.share).toBeCloseTo(16.7, 0);
    const total = slices.reduce((sum, s) => sum + s.share, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
  });

  it('omits the DC slice when there is no draft capital', () => {
    const slices = buildValueProportion(roster, 0);
    expect(slices.find((s) => s.key === 'DC')).toBeUndefined();
  });

  it('returns empty when the roster has no value', () => {
    expect(buildValueProportion([], 0)).toEqual([]);
  });
});

describe('buildPositionValueShare', () => {
  it('computes per-position share of player value', () => {
    const share = buildPositionValueShare(roster); // QB8000 RB2000 WR10000 TE0 = 20000
    expect(share.QB).toBeCloseTo(40, 0);
    expect(share.WR).toBeCloseTo(50, 0);
    expect(share.RB).toBeCloseTo(10, 0);
    expect(share.TE).toBe(0);
  });
});

describe('buildRosterMakeup', () => {
  it('distributes archetypes and sums to ~100%', () => {
    const graded = gradeRoster(roster, 'dynasty');
    const makeup = buildRosterMakeup(graded);
    expect(makeup.length).toBeGreaterThan(0);
    const total = makeup.reduce((sum, row) => sum + row.share, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
    expect(makeup.reduce((sum, row) => sum + row.count, 0)).toBe(graded.length);
  });
});

describe('getOverallGrade', () => {
  it('returns a 0-10 grade for a graded roster', () => {
    const grade = getOverallGrade(gradeRoster(roster, 'dynasty'));
    expect(grade).toBeGreaterThan(0);
    expect(grade).toBeLessThanOrEqual(10);
  });

  it('returns 0 for an empty roster', () => {
    expect(getOverallGrade([])).toBe(0);
  });
});

describe('buildAverageAge', () => {
  it('averages age per position and is null where no age exists', () => {
    const ages = buildAverageAge(roster);
    expect(ages.WR).toBeCloseTo(25, 0); // (22 + 28) / 2
    expect(ages.QB).toBe(26);
    const ageless = buildAverageAge([makePlayer({ player_id: 'x', pos: 'QB', value: 1 })]);
    expect(ageless.QB).toBeNull();
  });
});

describe('getDraftCapitalScore', () => {
  it('scores best league rank highest', () => {
    expect(getDraftCapitalScore({ leagueRank: 1, leagueSize: 12 })).toBe(10);
    expect(getDraftCapitalScore({ leagueRank: 12, leagueSize: 12 })).toBeLessThan(2);
  });

  it('falls back to scaled raw value without a rank', () => {
    expect(getDraftCapitalScore({ totalValue: 12000 })).toBe(10);
    expect(getDraftCapitalScore({ totalValue: 0 })).toBe(0);
  });
});
