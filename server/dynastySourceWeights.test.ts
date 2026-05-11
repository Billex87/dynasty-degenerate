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
      flock: 0.32,
      fantasyPros: 0.12,
      dynastyNerds: 0.21,
      fantasyNerds: 0.07,
      ktc: 0.16,
      fantasyCalc: 0.10,
      dynastyProcess: 0.02,
    });
  });

  it('moves more weight to TEP-aware sources in superflex TEP leagues', () => {
    const weights = getDynastySourceWeights({ numQbs: 2, ppr: 1, tep: 1 });

    expect(totalWeight(weights)).toBeCloseTo(1);
    expect(weights).toMatchObject({
      flock: 0.29,
      fantasyPros: 0.12,
      dynastyNerds: 0.25,
      fantasyNerds: 0.07,
      ktc: 0.17,
      fantasyCalc: 0.08,
      dynastyProcess: 0.02,
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
      .toBe('Flock Fantasy 28%, FantasyPros Dynasty 12%, Dynasty Nerds 25%, Fantasy Nerds 7%, KTC 14%, FantasyCalc 12%, DynastyProcess 2%');
  });
});
