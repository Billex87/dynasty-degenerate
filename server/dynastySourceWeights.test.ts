import { describe, expect, it } from 'vitest';
import { formatDynastySourceWeights, getDynastySourceWeights } from './dynastySourceWeights';

function totalWeight(weights: ReturnType<typeof getDynastySourceWeights>): number {
  return Object.values(weights).reduce((sum, weight) => sum + weight, 0);
}

describe('dynasty source weights', () => {
  it('uses the audited blend in regular superflex dynasty', () => {
    const weights = getDynastySourceWeights({ numQbs: 2, ppr: 1, tep: 0 });

    expect(totalWeight(weights)).toBeCloseTo(1);
    expect(weights).toMatchObject({
      flock: 0.25,
      fantasyPros: 0.06,
      dynastyNerds: 0.22,
      fantasyNerds: 0.07,
      ktc: 0.19,
      fantasyCalc: 0.16,
      dynastyProcess: 0.05,
    });
  });

  it('moves more weight to TEP-aware sources in superflex TEP leagues', () => {
    const weights = getDynastySourceWeights({ numQbs: 2, ppr: 1, tep: 1 });

    expect(totalWeight(weights)).toBeCloseTo(1);
    expect(weights).toMatchObject({
      flock: 0.23,
      fantasyPros: 0.06,
      dynastyNerds: 0.27,
      fantasyNerds: 0.07,
      ktc: 0.19,
      fantasyCalc: 0.13,
      dynastyProcess: 0.05,
    });
  });

  it('uses only prospect-capable sources for college rankings', () => {
    const weights = getDynastySourceWeights({ board: 'devy', numQbs: 2, ppr: 1, tep: 0 });

    expect(totalWeight(weights)).toBeCloseTo(1);
    expect(weights.flock).toBe(0.45);
    expect(weights.fantasyPros).toBe(0);
    expect(weights.ktc).toBe(0.35);
    expect(weights.dynastyNerds).toBe(0.20);
    expect(weights.fantasyNerds).toBe(0);
    expect(weights.fantasyCalc).toBe(0);
    expect(weights.dynastyProcess).toBe(0);
  });

  it('formats weights for admin diagnostics and the rankings board', () => {
    expect(formatDynastySourceWeights(getDynastySourceWeights({ numQbs: 1, ppr: 0, tep: 0 })))
      .toBe('Flock Fantasy 23%, FantasyPros Dynasty 6%, Dynasty Nerds 25%, Fantasy Nerds 7%, KTC 17%, FantasyCalc 17%, DynastyProcess 5%');
  });
});
