import { describe, expect, it } from 'vitest';
import {
  applyDynastySourceTrust,
  calculateDynastySourceTrust,
  getDynastySourceRowsFromSnapshotValues,
  type DynastySourceRow,
  type DynastySourceRows,
} from './dynastySourceTrust';
import type { DynastySourceWeights } from './dynastySourceWeights';

const baseWeights: DynastySourceWeights = {
  flock: 0.32,
  fantasyPros: 0.12,
  dynastyNerds: 0.23,
  ktc: 0.21,
  fantasyCalc: 0.10,
  dynastyProcess: 0.02,
};

describe('dynasty source trust', () => {
  it('scores aligned dynasty sources higher than consensus outliers', () => {
    const alignedRows: Record<string, DynastySourceRow> = {};
    const outlierRows: Record<string, DynastySourceRow> = {};
    for (let index = 1; index <= 30; index += 1) {
      const key = `player${index}`;
      alignedRows[key] = {
        name: `Player ${index}`,
        position: 'WR',
        value: 8500 - index * 70,
      };
      outlierRows[key] = {
        name: `Player ${index}`,
        position: 'WR',
        value: 1500,
      };
    }

    const trust = calculateDynastySourceTrust({
      sourceMaps: {
        flock: alignedRows,
        dynastyNerds: alignedRows,
        ktc: alignedRows,
        fantasyCalc: outlierRows,
      },
      baseWeights,
    });

    expect(trust.flock?.score).toBeGreaterThan(trust.fantasyCalc?.score || 0);
    expect(trust.flock?.multiplier).toBeGreaterThan(1);
    expect(trust.fantasyCalc?.multiplier).toBeLessThan(1);
    expect(trust.fantasyCalc?.sampleSize).toBe(30);
  });

  it('penalizes sources whose row count collapses versus recent snapshots', () => {
    const currentRows: Record<string, DynastySourceRow> = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [
      `player${index + 1}`,
      {
        name: `Player ${index + 1}`,
        position: 'RB',
        value: 7000 - index * 100,
      },
    ]));
    const historicalRows: Record<string, DynastySourceRow> = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [
      `player${index + 1}`,
      {
        name: `Player ${index + 1}`,
        position: 'RB',
        value: 7000 - index * 20,
      },
    ]));

    const trust = calculateDynastySourceTrust({
      sourceMaps: { dynastyNerds: currentRows },
      baseWeights,
      history: [{ dynastyNerds: historicalRows }],
    });

    expect(trust.dynastyNerds?.rowCountRatio).toBe(0.1);
    expect(trust.dynastyNerds?.score).toBeLessThan(68);
    expect(trust.dynastyNerds?.multiplier).toBeLessThan(1);
  });

  it('keeps weights neutral when a loaded source has no trust evidence yet', () => {
    const trust = calculateDynastySourceTrust({
      sourceMaps: {
        ktc: {
          oneplayer: {
            name: 'One Player',
            position: 'QB',
            value: 5000,
          },
        },
      },
      baseWeights,
    });

    expect(trust.ktc?.multiplier).toBe(1);
    expect(applyDynastySourceTrust(baseWeights, trust).ktc).toBe(baseWeights.ktc);
  });

  it('builds source rows from stored blended snapshot source fields', () => {
    const sourceRows: DynastySourceRows = getDynastySourceRowsFromSnapshotValues({
      joshallen: {
        name: 'Josh Allen',
        ktc_value: 9400,
        market_value_ktc: 9300,
        expert_value_flock: 9600,
        expert_value_fantasypros: 9450,
        expert_value_dynastynerds: 9500,
        market_value_fantasycalc: 9100,
        expert_value_dynastyprocess: 8700,
        value_sources: ['FlockFantasy', 'FantasyPros', 'DynastyNerds', 'KTC', 'FantasyCalc', 'DynastyProcess'],
      },
    });

    expect(sourceRows.flock?.joshallen.value).toBe(9600);
    expect(sourceRows.fantasyPros?.joshallen.value).toBe(9450);
    expect(sourceRows.dynastyNerds?.joshallen.value).toBe(9500);
    expect(sourceRows.ktc?.joshallen.value).toBe(9300);
    expect(sourceRows.fantasyCalc?.joshallen.value).toBe(9100);
    expect(sourceRows.dynastyProcess?.joshallen.value).toBe(8700);
  });
});
