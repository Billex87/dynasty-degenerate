import { describe, expect, it } from 'vitest';
import { findWeeklyMovementAnomalies } from './weeklyMovementAnomalyReport';

describe('weekly movement anomaly report', () => {
  it('flags extreme moves, low denominators, and source-set changes without payload fields', () => {
    const result = findWeeklyMovementAnomalies({
      stableplayer: {
        name: 'Stable Player',
        ktc_value: 5200,
        position_rank: 'WR12',
        value_sources: ['KTC', 'FantasyCalc'],
      },
      lowbaselinejump: {
        name: 'Low Baseline Jump',
        ktc_value: 680,
        position_rank: 'RB54',
        value_sources: ['KTC'],
      },
      sourceswing: {
        name: 'Source Swing',
        ktc_value: 2500,
        position_rank: 'TE7',
        value_sources: ['KTC', 'FantasyPros'],
      },
    }, {
      stableplayer: {
        name: 'Stable Player',
        ktc_value: 5000,
        position_rank: 'WR12',
        value_sources: ['KTC', 'FantasyCalc'],
      },
      lowbaselinejump: {
        name: 'Low Baseline Jump',
        ktc_value: 300,
        position_rank: 'RB70',
        value_sources: ['KTC'],
      },
      sourceswing: {
        name: 'Source Swing',
        ktc_value: 1900,
        position_rank: 'TE11',
        value_sources: ['KTC'],
      },
    }, {
      extremePctChange: 35,
      sourceSwingMinAbsoluteChange: 250,
    });

    expect(result.comparedPlayers).toBe(3);
    expect(result.rows.map((row) => row.playerKey)).toEqual(['sourceswing', 'lowbaselinejump']);
    expect(result.rows[0]).toMatchObject({
      name: 'Source Swing',
      baselineValue: 1900,
      currentValue: 2500,
      diff: 600,
      currentSources: ['FantasyPros', 'KTC'],
      reasons: ['large-absolute-change', 'source-set-changed'],
    });
    expect(result.rows[1].reasons).toEqual(expect.arrayContaining([
      'extreme-pct-change',
      'large-absolute-change',
      'low-baseline-denominator',
    ]));
    expect(JSON.stringify(result.rows)).not.toContain('Stable Player');
  });
});
