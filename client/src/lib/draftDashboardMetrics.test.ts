import { describe, expect, it } from 'vitest';
import type { DraftPick, ReportData } from '@shared/types';
import {
  buildDraftSignalManagerStats,
  getBestDraftAdpValueManager,
  getDraftSignalPicks,
  getWorstDraftAdpValueManager,
} from './draftDashboardMetrics';

function pick(overrides: Partial<DraftPick>): DraftPick {
  return {
    round: 1,
    pick: 1,
    playerName: 'Rookie Hit',
    playerPos: 'WR',
    manager: 'Manager A',
    adp: null,
    ktcValue: 1000,
    currentKtcValue: 1500,
    valueGain: 500,
    draftKind: 'rookie',
    draftYear: '2026',
    ...overrides,
  };
}

function report(draftPicks: DraftPick[], leagueValueMode: ReportData['leagueValueMode'] = 'dynasty') {
  return {
    draftPicks,
    leagueValueMode,
  } as ReportData;
}

describe('draft dashboard metrics', () => {
  it('uses only rookie picks for dynasty draft signals', () => {
    const data = report([
      pick({ playerName: 'Rookie Hit', manager: 'Manager A', draftKind: 'rookie', valueGain: 600 }),
      pick({ playerName: 'Startup Smash', manager: 'Manager B', draftKind: 'startup', draftPickCount: 120, valueGain: 5000 }),
      pick({ playerName: 'Inferred Rookie', manager: 'Manager C', draftKind: null, round: 2, draftPickCount: 36, valueGain: 250 }),
    ]);

    expect(getDraftSignalPicks(data, 'dynasty').map((row) => row.playerName)).toEqual([
      'Rookie Hit',
      'Inferred Rookie',
    ]);
  });

  it('builds dynasty efficiency and ADP value from rookie picks only', () => {
    const data = report([
      pick({ playerName: 'Rookie Value', manager: 'Manager A', draftKind: 'rookie', pick: 12, adp: 4, valueGain: 400, draftOutcome: 'hit' }),
      pick({ playerName: 'Rookie Miss', manager: 'Manager A', draftKind: 'rookie', pick: 12, adp: 8, valueGain: -200, draftOutcome: 'miss' }),
      pick({ playerName: 'Rookie Leak', manager: 'Manager B', draftKind: 'rookie', pick: 5, adp: 7, valueGain: -1200, draftOutcome: 'miss' }),
      pick({ playerName: 'Board Fall', manager: 'Manager C', draftKind: 'rookie', pick: 24, adp: 10, valueGain: 150, draftOutcome: 'neutral' }),
      pick({ playerName: 'Startup Trap', manager: 'Manager B', draftKind: 'startup', draftPickCount: 120, pick: 90, adp: 1, valueGain: -5000, draftOutcome: 'miss' }),
    ]);

    const stats = buildDraftSignalManagerStats(data, 'dynasty');

    expect(stats).toHaveLength(3);
    expect(stats.find((stat) => stat.manager === 'Manager A')).toMatchObject({
      manager: 'Manager A',
      totalPicks: 2,
      avgKtcGain: 100,
      hits: 1,
      misses: 1,
      totalAdpValue: 12,
      adpValuePickCount: 2,
    });
    expect(getWorstDraftAdpValueManager(data, 'dynasty')).toMatchObject({
      manager: 'Manager B',
      totalAdpReach: 2,
      adpReachPickCount: 1,
    });
    expect(getBestDraftAdpValueManager(data, 'dynasty')).toMatchObject({
      manager: 'Manager C',
      totalAdpValue: 14,
      adpValuePickCount: 1,
    });
  });

  it('uses main picks for redraft draft signals', () => {
    const data = report(
      [
        pick({ playerName: 'Redraft Starter', draftKind: 'main', draftPickCount: 180, valueGain: 800 }),
        pick({ playerName: 'Rookie Hidden', draftKind: 'rookie', draftPickCount: 36, valueGain: 1200 }),
      ],
      'redraft'
    );

    expect(getDraftSignalPicks(data, 'redraft').map((row) => row.playerName)).toEqual([
      'Redraft Starter',
    ]);
  });
});
