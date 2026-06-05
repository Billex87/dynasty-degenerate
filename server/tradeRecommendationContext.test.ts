import { describe, expect, it } from 'vitest';
import { buildTradeRecommendationContext } from './tradeRecommendationContext';
import type { DynastyContentionPlayerRead, ManagerIntelPlayer, ReportData, RookieDevelopmentRead } from '../shared/types';

function player(overrides: Partial<ManagerIntelPlayer> & { player_id: string; name: string }): ManagerIntelPlayer {
  return {
    pos: 'WR',
    value: 3000,
    seasonValue: 2800,
    owner: 'Other',
    ...overrides,
  } as ManagerIntelPlayer;
}

function contentionRead(overrides: Partial<DynastyContentionPlayerRead> & { action: DynastyContentionPlayerRead['action']; player: ManagerIntelPlayer }): DynastyContentionPlayerRead {
  return {
    id: `read:${overrides.action}:${overrides.player.player_id}`,
    manager: 'Contender',
    action: overrides.action,
    player: overrides.player,
    score: 100,
    confidence: 80,
    confidenceReasons: ['Fixture.'],
    signals: [],
    dynastyValue: overrides.player.value,
    seasonValue: overrides.player.seasonValue || null,
    valueGap: (overrides.player.seasonValue || 0) - overrides.player.value,
    projectedFantasyPoints: null,
    projectionStatus: 'ready',
    sourceTrace: [],
    ...overrides,
  } as DynastyContentionPlayerRead;
}

function rookieRead(overrides: Partial<RookieDevelopmentRead> & { player: ManagerIntelPlayer }): RookieDevelopmentRead {
  return {
    id: `rookie:${overrides.player.player_id}`,
    manager: 'Contender',
    player: overrides.player,
    stage: 'rookie',
    action: 'hold-development',
    score: 82,
    confidence: 78,
    confidenceReasons: ['Fixture.'],
    teamInvestmentScore: 88,
    earlyUsageScore: 32,
    depthChartBarrierScore: 28,
    similarPlayerOpportunityScore: 70,
    opportunityRunwayWeeks: 9,
    projectionStatus: 'ready',
    signals: [],
    sourceTrace: [],
    ...overrides,
  } as RookieDevelopmentRead;
}

describe('buildTradeRecommendationContext', () => {
  it('separates trade-for, trade-away, and hold reads with projection spike flags', () => {
    const buyPlayer = player({ player_id: 'buy', name: 'Buy Growth', value: 2600, seasonValue: 3000, owner: 'Builder' });
    const sellPlayer = player({ player_id: 'sell', name: 'Sell Spike', value: 2200, seasonValue: 4100, owner: 'Contender' });
    const holdPlayer = player({ player_id: 'hold', name: 'Hold Rookie', value: 2800, seasonValue: 800, owner: 'Contender' });
    const reportData: ReportData = {
      leagueValueMode: 'dynasty',
      weeklyProjectionDiagnostics: {
        status: 'ready',
        source: 'stored-weekly-projection',
        provider: 'sleeper',
        season: '2026',
        week: 1,
        scoringProfile: 'PPR',
        rowCount: 3,
        rosteredCoveragePct: 100,
        attachedPlayerCount: 3,
        note: 'Ready.',
        warnings: [],
      },
      dynastyContentionContext: {
        status: 'ready',
        source: 'stored-report-dynasty-contention',
        projectionStatus: 'ready',
        generatedAt: '2026-06-01T00:00:00.000Z',
        rows: [],
        note: 'Ready.',
        managers: [{
          manager: 'Contender',
          rosterWindow: 'contender',
          contenderScore: 88,
          rebuildScore: 35,
          confidence: 82,
          confidenceReasons: ['Fixture.'],
          startNow: [],
          holdThroughDevelopment: [contentionRead({ action: 'hold-through-development', player: holdPlayer, dynastyValue: 2800, seasonValue: 800 })],
          doNotPanicRunway: [],
          buyBeforeRoleGrowth: [contentionRead({ action: 'buy-before-role-growth', player: buyPlayer, targetManager: 'Builder', dynastyValue: 2600, seasonValue: 3000 })],
          sellOnProjectionSpike: [contentionRead({
            action: 'sell-on-projection-spike',
            player: sellPlayer,
            dynastyValue: 2200,
            seasonValue: 4100,
            valueGap: 1900,
            projectedFantasyPoints: 14.2,
            scheduleAdjustment: 140,
            byeAdjustment: -20,
            scheduleContextScore: 120,
            sourceTrace: ['stored-weekly-projection:sleeper:1', 'redraft-schedule-adjustment:140', 'redraft-bye-adjustment:-20'],
          })],
        }],
      },
      rookieDevelopmentContext: {
        status: 'ready',
        source: 'stored-report-rookie-development',
        projectionStatus: 'ready',
        generatedAt: '2026-06-01T00:00:00.000Z',
        rows: [rookieRead({ player: holdPlayer })],
        managers: [],
        note: 'Ready.',
      },
      playerDetailsById: {
        buy: {
          playerId: 'buy',
          fullName: 'Buy Growth',
          valueProfile: {
            fantasyProsSourceTrace: [{
              source: 'FantasyPros',
              key: 'COMPARE_PLAYERS',
              label: 'FantasyPros Compare Players',
              value: 8.4,
              rank: 8.4,
              scoring: 'PPR',
              evidence: 'expert rank count 3; average rank 8.4; best rank 5; worst rank 12; endpoint metadata: fantasypros-compare-players.',
            }],
          },
        },
        sell: {
          playerId: 'sell',
          fullName: 'Sell Spike',
          valueProfile: {
            fantasyProsSourceTrace: [{
              source: 'FantasyPros',
              key: 'COMPARE_PLAYERS',
              label: 'FantasyPros Compare Players',
              value: 11.6,
              rank: 11.6,
              scoring: 'PPR',
              evidence: 'expert rank count 4; average rank 11.6; best rank 8; worst rank 18; endpoint metadata: fantasypros-compare-players.',
            }],
          },
        },
      },
      playoffSchedulePlanning: {
        source: 'fixture',
        status: 'ready',
        updatedAt: '2026-06-01T00:00:00.000Z',
        confidence: 80,
        confidenceReasons: [],
        weeks: [15, 16, 17],
        managerPlans: [],
        actionItems: [{
          id: 'cover',
          manager: 'Contender',
          week: 15,
          type: 'cover-risk',
          priority: 'high',
          score: 100,
          confidence: 80,
          confidenceReasons: [],
          affectedPlayers: [sellPlayer],
          replacementTargets: [buyPlayer],
          note: 'Fixture.',
        }],
      } as any,
      managerRosterValueGrowth: [],
      weeklyRisers: [],
      weeklyFallers: [],
      leagueOverview: [],
      projectedRisers: [],
      projectedFallers: [],
      tradeProfitLeaderboard: [],
      tradeHistory: [],
      positionDepth: [],
      managerPositionCounts: [],
    };

    const result = buildTradeRecommendationContext(reportData);
    const manager = result?.managers[0];

    expect(result?.status).toBe('ready');
    expect(manager?.tradeFor.map((read) => read.player.name)).toContain('Buy Growth');
    expect(manager?.tradeAway.map((read) => read.player.name)).toContain('Sell Spike');
    expect(manager?.hold.map((read) => read.player.name)).toContain('Hold Rookie');
    expect(manager?.tradeAway[0]?.fragileProjectionSpike).toBe(true);
    expect(manager?.tradeAway[0]?.playoffLeverageScore).toBeGreaterThan(0);
    expect(manager?.tradeAway[0]?.scheduleContextScore).toBe(120);
    expect(manager?.tradeAway[0]?.signals).toContain('positive-schedule-stretch');
    expect(manager?.tradeAway[0]?.signals).toContain('fantasypros-compare-players');
    expect(manager?.tradeAway[0]?.confidenceReasons).toContain('FantasyPros compare-player consensus is attached.');
    expect(manager?.tradeAway[0]?.sourceTrace.join(' ')).toContain('fantasypros-compare-players');
    expect(manager?.tradeFor[0]?.confidenceReasons).toContain('FantasyPros compare-player consensus is attached.');
    expect(result?.rows.every((read) => read.confidence >= 0 && read.confidence <= 100)).toBe(true);
  });
});
