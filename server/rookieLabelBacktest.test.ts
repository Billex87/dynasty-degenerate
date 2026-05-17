import { describe, expect, it } from 'vitest';
import { buildRookieBacktestRows, classifyRookieBacktestOutcome } from './rookieLabelBacktest';
import type { ProspectProfile } from '../shared/types';

describe('rookie label backtest', () => {
  it('downgrades cheap baseline spikes so trade copy does not overstate them', () => {
    expect(classifyRookieBacktestOutcome({
      baselineValue: 400,
      currentValue: 900,
      baselineSources: ['KTC'],
      currentSources: ['KTC', 'FantasyCalc'],
    })).toMatchObject({
      outcome: 'low-denominator-watch',
      confidence: 'low',
      reasons: expect.arrayContaining(['low-baseline-denominator', 'thin-source-coverage']),
    });
  });

  it('classifies confirmed risers, confirmed fallers, and stable holds by calibrated movement', () => {
    const result = buildRookieBacktestRows({
      year: '2025',
      baselineValues: {
        'breakout-rookie-1': {
          name: 'Breakout Rookie',
          ktc_value: 2500,
          dynasty_value: 2500,
          position_rank_may2025: 'WR40',
          value_sources: ['KTC', 'DynastyProcess'],
        },
        'priced-out-2': {
          name: 'Priced Out',
          ktc_value: 4200,
          dynasty_value: 4200,
          position_rank_may2025: 'RB11',
          value_sources: ['KTC', 'DynastyProcess'],
        },
        'steady-player-3': {
          name: 'Steady Player',
          ktc_value: 3000,
          dynasty_value: 3000,
          position_rank_may2025: 'TE9',
          value_sources: ['KTC', 'DynastyProcess'],
        },
      },
      currentValues: {
        breakoutrookie: {
          name: 'Breakout Rookie',
          ktc_value: 3500,
          dynasty_value: 3500,
          position_rank: 'WR26',
          value_sources: ['KTC', 'FantasyCalc', 'DynastyProcess'],
        },
        pricedout: {
          name: 'Priced Out',
          ktc_value: 3000,
          dynasty_value: 3000,
          position_rank: 'RB29',
          value_sources: ['KTC', 'FantasyCalc', 'DynastyProcess'],
        },
        steadyplayer: {
          name: 'Steady Player',
          ktc_value: 3180,
          dynasty_value: 3180,
          position_rank: 'TE8',
          value_sources: ['KTC', 'DynastyProcess'],
        },
      },
    });

    expect(result.comparedPlayers).toBe(3);
    expect(result.rows.find(row => row.name === 'Breakout Rookie')).toMatchObject({
      outcome: 'confirmed-riser',
      direction: 'up',
      confidence: 'high',
      diff: 1000,
    });
    expect(result.rows.find(row => row.name === 'Priced Out')).toMatchObject({
      outcome: 'confirmed-faller',
      direction: 'down',
      confidence: 'high',
      diff: -1200,
    });
    expect(result.rows.find(row => row.name === 'Steady Player')).toMatchObject({
      outcome: 'stable-hold',
      direction: 'flat',
    });
  });

  it('filters full blended baselines to the intended rookie draft class when prospect context exists', () => {
    const prospects: ProspectProfile[] = [
      {
        source: 'NFL Draft Buzz',
        draftYear: 2026,
        name: 'Future Runner',
        position: 'RB',
        overallRank: 22,
        positionRank: 3,
      },
    ];

    const result = buildRookieBacktestRows({
      year: '2026',
      baselineValues: {
        futurerunner: {
          name: 'Future Runner',
          ktc_value: 1800,
          dynasty_value: 1800,
          position_rank: 'RB44',
          value_sources: ['KTC', 'FantasyCalc'],
        },
        veteranstar: {
          name: 'Veteran Star',
          ktc_value: 7000,
          dynasty_value: 7000,
          position_rank: 'WR3',
          value_sources: ['KTC', 'FantasyCalc'],
        },
      },
      currentValues: {
        futurerunner: {
          name: 'Future Runner',
          ktc_value: 2500,
          dynasty_value: 2500,
          position_rank: 'RB31',
          value_sources: ['KTC', 'FantasyCalc'],
        },
        veteranstar: {
          name: 'Veteran Star',
          ktc_value: 7200,
          dynasty_value: 7200,
          position_rank: 'WR2',
          value_sources: ['KTC', 'FantasyCalc'],
        },
      },
      prospectProfiles: prospects,
      filterToDraftYear: 2026,
    });

    expect(result.baselinePlayers).toBe(2);
    expect(result.filteredBaselinePlayers).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: 'Future Runner',
      prospectDraftYear: 2026,
      prospectRank: 22,
    });
  });
});
