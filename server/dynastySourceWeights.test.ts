import { describe, expect, it } from 'vitest';
import { formatDynastySourceWeights, getDynastySourceWeights } from './dynastySourceWeights';

function totalWeight(weights: ReturnType<typeof getDynastySourceWeights>): number {
  return Object.values(weights).reduce((sum, weight) => sum + weight, 0);
}

describe('dynasty source weights', () => {
  it('keeps Flock as the top source in regular superflex dynasty', () => {
    const weights = getDynastySourceWeights({ numQbs: 2, ppr: 1, tep: 0 });

    expect(totalWeight(weights)).toBeCloseTo(1);
    expect(weights).toMatchObject({
      flock: 0.40,
      dynastyNerds: 0.25,
      ktc: 0.20,
      fantasyCalc: 0.12,
      dynastyProcess: 0.03,
    });
  });

  it('moves more weight to TEP-aware sources in superflex TEP leagues', () => {
    const weights = getDynastySourceWeights({ numQbs: 2, ppr: 1, tep: 1 });

    expect(totalWeight(weights)).toBeCloseTo(1);
    expect(weights).toMatchObject({
      flock: 0.35,
      dynastyNerds: 0.30,
      ktc: 0.22,
      fantasyCalc: 0.10,
      dynastyProcess: 0.03,
    });
  });

  it('uses only prospect-capable sources for college rankings', () => {
    const weights = getDynastySourceWeights({ board: 'devy', numQbs: 2, ppr: 1, tep: 0 });

    expect(totalWeight(weights)).toBeCloseTo(1);
    expect(weights.flock).toBe(0.45);
    expect(weights.ktc).toBe(0.35);
    expect(weights.dynastyNerds).toBe(0.20);
    expect(weights.fantasyCalc).toBe(0);
    expect(weights.dynastyProcess).toBe(0);
  });

  it('formats weights for admin diagnostics and the rankings board', () => {
    expect(formatDynastySourceWeights(getDynastySourceWeights({ numQbs: 1, ppr: 0, tep: 0 })))
      .toBe('Flock Fantasy 34%, Dynasty Nerds 30%, KTC 16%, FantasyCalc 17%, DynastyProcess 3%');
  });
});
