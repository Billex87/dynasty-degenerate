import { describe, expect, it } from 'vitest';
import { buildContenderPlayoffContext } from './contenderPlayoffContext';
import type { ReportData } from '../shared/types';

describe('buildContenderPlayoffContext', () => {
  it('builds contender week reads with lineup strength, pressure, and stash recommendations', () => {
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
          rebuildScore: 32,
          confidence: 82,
          confidenceReasons: ['Fixture.'],
          startNow: [],
          holdThroughDevelopment: [],
          sellOnProjectionSpike: [],
          buyBeforeRoleGrowth: [],
          doNotPanicRunway: [],
        }],
      },
      playoffSchedulePlanning: {
        source: 'DraftSharks SOS',
        status: 'ready',
        updatedAt: '2026-06-01T00:00:00.000Z',
        confidence: 76,
        confidenceReasons: ['Projection coverage is ready.'],
        weeks: [15, 16, 17],
        actionItems: [{
          id: 'contender-week-15-cover-risk',
          manager: 'Contender',
          week: 15,
          type: 'cover-risk',
          priority: 'high',
          score: 320,
          confidence: 76,
          confidenceReasons: ['Stored projection coverage ready.'],
          confidenceCapReason: null,
          affectedPlayers: [{ playerId: 'rb1', name: 'Bye Runner', position: 'RB', team: 'BUF', reason: 'bye' }],
          replacementTargets: [{
            playerId: 'stash1',
            name: 'Stash Runner',
            position: 'RB',
            team: 'LV',
            targetWeeks: [15, 16],
            seasonSOS: 18,
            scheduleTier: 'easy',
            note: 'Available RB with playoff window.',
          }],
          note: 'Cover risk.',
        }],
        managerPlans: [{
          manager: 'Contender',
          riskScore: 3,
          upsideScore: 1,
          confidence: 76,
          confidenceReasons: ['Stored projection coverage ready.'],
          weeks: [{
            week: 15,
            projectedStarterPoints: 118.4,
            projectionCoverage: {
              coveredPlayerCount: 9,
              totalPlayerCount: 9,
              mode: 'stored-weekly-projection',
            },
            confidence: 76,
            confidenceReasons: ['Stored projection coverage ready.'],
            confidenceCapReason: null,
            byePlayers: [{ playerId: 'rb1', name: 'Bye Runner', position: 'RB', team: 'BUF' }],
            avoidPlayers: [{ playerId: 'wr1', name: 'Avoid Receiver', position: 'WR', team: 'KC', scheduleTier: 'hard' }],
            streamerPlayers: [{ playerId: 'te1', name: 'Streamer Tight End', position: 'TE', team: 'LV', scheduleTier: 'easy' }],
            note: 'Week 15 risk.',
          }],
          priorityAdds: [{
            playerId: 'stash1',
            name: 'Stash Runner',
            position: 'RB',
            team: 'LV',
            targetWeeks: [15, 16],
            seasonSOS: 18,
            scheduleTier: 'easy',
            note: 'Available RB with playoff window.',
          }],
          note: 'Cover risk.',
        }],
      },
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

    const result = buildContenderPlayoffContext(reportData);

    expect(result?.status).toBe('ready');
    expect(result?.managers[0]?.manager).toBe('Contender');
    expect(result?.managers[0]?.projectedLineupStrength).toBe(118.4);
    expect(result?.rows[0]?.projectionCoverage.mode).toBe('stored-weekly-projection');
    expect(result?.rows[0]?.byeBenchPressureScore).toBeGreaterThan(0);
    expect(result?.rows[0]?.opponentDifficultyScore).toBeGreaterThan(0);
    expect(result?.rows[0]?.stashRecommendations.map((target) => target.name)).toContain('Stash Runner');
  });
});
