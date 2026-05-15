import { describe, expect, it } from 'vitest';
import { slimCachedLeagueReportPayload, slimReportDataForTransfer } from './reportPayloadSlimming';
import type { ReportData } from '../shared/types';

function createReport(): ReportData {
  return {
    playerDetailsById: {
      '1': {
        age: 25,
        team: 'BUF',
        valueProfile: { dynastyValue: 1000 },
      },
    },
    weeklyRisers: [{
      player_id: '1',
      name: 'Player One',
      owner: 'A',
      pos: 'QB',
      val_last: 900,
      val_now: 1000,
      diff: 100,
      pct_change: 0.11,
      playerDetails: {
        age: 25,
        team: 'BUF',
        valueProfile: { dynastyValue: 1000 },
      },
    }],
    weeklyFallers: [{
      player_id: '2',
      name: 'Player Two',
      owner: 'B',
      pos: 'RB',
      val_last: 1000,
      val_now: 900,
      diff: -100,
      pct_change: -0.1,
      playerDetails: {
        age: 24,
        team: 'DAL',
      },
    }],
    managerRosterValueGrowth: [],
    leagueOverview: [],
    projectedRisers: [],
    projectedFallers: [],
    tradeProfitLeaderboard: [],
    tradeHistory: [],
    positionDepth: [],
    managerPositionCounts: [],
    managerRosterIntelligence: [],
    draftPicks: [],
    draftStats: [],
    powerRankings: [],
    pickPortfolios: [],
    schedulePlanning: null,
    matchupPreviews: [],
    recentTransactions: [],
  } as unknown as ReportData;
}

describe('report payload slimming', () => {
  it('compacts embedded playerDetails when playerDetailsById already carries the same player id', () => {
    const report = createReport();
    const result = slimReportDataForTransfer(report);

    expect(result.stats.compactedEmbeddedPlayerDetails).toBe(1);
    expect(result.payload.weeklyRisers[0].playerDetails).toMatchObject({
      team: 'BUF',
      age: 25,
    });
    expect(result.payload.weeklyRisers[0].playerDetails).not.toHaveProperty('valueProfile');
    expect(result.payload.weeklyFallers[0]).toHaveProperty('playerDetails');
    expect(result.payload.playerDetailsById?.['1']).toMatchObject({
      team: 'BUF',
      valueProfile: { dynastyValue: 1000 },
    });
  });

  it('slims cached analyze payloads without mutating unrelated payloads', () => {
    const cached = {
      leagueId: '123',
      reportData: createReport(),
    };
    const result = slimCachedLeagueReportPayload(cached);

    expect(result.stats.compactedEmbeddedPlayerDetails).toBe(1);
    expect(result.payload.reportData.weeklyRisers[0].playerDetails).toMatchObject({
      team: 'BUF',
      age: 25,
    });
    expect(result.payload.reportData.weeklyRisers[0].playerDetails).not.toHaveProperty('valueProfile');
    expect(slimCachedLeagueReportPayload({ rankings: {} }).stats.compactedEmbeddedPlayerDetails).toBe(0);
  });
});
