import { describe, expect, it } from 'vitest';
import { buildNflScheduleSnapshot } from './nflScheduleSnapshots';
import {
  getPlayerOpponentHistoryKey,
  type PlayerMatchupArchetypeSummary,
  type PlayerOpponentHistorySummary,
} from './playerMatchupActuals';
import {
  buildPlayerProjectionContext,
  getGameEnvironmentContextKey,
  getOpponentDefenseContextKey,
  type PlayerProjectionDepthChartContext,
  type PlayerProjectionGameEnvironmentContext,
  type PlayerProjectionOpponentDefenseContext,
  type PlayerProjectionOpportunityContext,
} from './playerProjectionContext';
import { buildPlayerProjectionSnapshot } from './playerProjectionSnapshots';

describe('player projection context', () => {
  it('joins projection rows to schedule games and value context without changing base snapshots', () => {
    const projections = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'fantasypros',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'week1-v1',
      rows: [
        { playerId: 'wr1', sourcePlayerId: 'fp-wr1', playerName: 'Wide Receiver', team: 'JAC', position: 'WR', projectedFantasyPoints: 16.4, targets: 9, injuryStatus: 'healthy' },
        { playerId: 'rb1', sourcePlayerId: 'fp-rb1', playerName: 'Running Back', team: 'WAS', position: 'RB', projectedFantasyPoints: 12.1, carries: 14 },
      ],
    });
    const schedule = buildNflScheduleSnapshot({
      season: 2026,
      source: 'Official schedule feed',
      sourceVersion: 'release-1',
      rows: [
        { week: 1, gameId: 'game-1', homeTeam: 'JAX', awayTeam: 'ARI', startsAt: '2026-09-13T17:00:00Z', gameStatus: 'scheduled', venueType: 'outdoor', weatherSensitivity: 'wind-sensitive' },
        { week: 1, gameId: 'game-2', homeTeam: 'NYG', awayTeam: 'WAS', startsAt: '2026-09-14T00:20:00Z', gameStatus: 'scheduled' },
      ],
    });
    const matchupActuals: PlayerMatchupArchetypeSummary = {
      position: 'WR',
      roleBucket: 'starter',
      opponentStrengthBucket: 'soft',
      homeAway: 'home',
      summaryKey: 'WR:starter:soft:home',
      sampleSize: 12,
      avgActualFantasyPoints: 15.4,
      avgProjectionError: 2.7,
      beatProjectionRate: 66.7,
      ceilingRate: 25,
      floorMissRate: 8.3,
      confidence: 78,
      recommendation: 'boost',
      reason: 'WR starter usage has beaten projection in this soft/home archetype.',
    };
    const playerOpponentHistory: PlayerOpponentHistorySummary = {
      historyKey: getPlayerOpponentHistoryKey({ playerId: 'wr1', position: 'WR', opponent: 'ARI' }) || 'wr1:WR:ARI',
      playerId: 'wr1',
      sourcePlayerId: 'fp-wr1',
      playerName: 'Wide Receiver',
      position: 'WR',
      opponent: 'ARI',
      sampleSize: 3,
      avgFantasyPoints: 18.4,
      medianFantasyPoints: 17.9,
      highFantasyPoints: 22.1,
      lowFantasyPoints: 15.3,
      avgProjectionError: 2.4,
      beatProjectionRate: 66.7,
      ceilingGameRate: 33.3,
      floorGameRate: 0,
      confidence: 72,
      recommendation: 'boost',
      reason: 'Wide Receiver has beaten projection in 66.7% of 3 career games vs ARI.',
      games: [],
    };

    const context = buildPlayerProjectionContext({
      projectionSnapshot: projections,
      scheduleSnapshot: schedule,
      dynastyValueByPlayerId: { wr1: 7000, rb1: 500 },
      redraftValueByPlayerId: { wr1: 1400, rb1: 400 },
      restOfSeasonProjectionByPlayerId: { wr1: 231 },
      longTermRoleSecurityByPlayerId: { wr1: 'stable target earner' },
      opportunityRunwayByPlayerId: { wr1: 'protected rookie-contract runway' },
      draftCapitalSignalByPlayerId: { wr1: 'Day 1 NFL draft capital' },
      matchupActualsByPlayerId: { wr1: matchupActuals },
      playerOpponentHistoryByKey: {
        [playerOpponentHistory.historyKey]: playerOpponentHistory,
      },
    });

    expect(context).toMatchObject({
      status: 'ready',
      rowCount: 2,
      missingScheduleCount: 0,
    });
    expect(context.rows.find((row) => row.playerId === 'wr1')).toMatchObject({
      team: 'JAX',
      schedule: {
        opponent: 'ARI',
        homeAway: 'home',
        sourceVersion: 'release-1',
        venueType: 'outdoor',
        weatherSensitivity: 'wind-sensitive',
      },
      valueBridge: {
        valueContext: 'dynasty-premium',
        restOfSeasonProjection: 231,
        longTermRoleSecurity: 'stable target earner',
        opportunityRunway: 'protected rookie-contract runway',
        draftCapitalSignal: 'Day 1 NFL draft capital',
        injuryStatus: 'healthy',
      },
      matchupActuals: {
        summaryKey: 'WR:starter:soft:home',
        recommendation: 'boost',
      },
      playerOpponentHistory: {
        historyKey: 'wr1:WR:ARI',
        recommendation: 'boost',
      },
    });
    expect(context.rows.find((row) => row.playerId === 'wr1')?.trace.join(' ')).toContain('Draft capital: Day 1 NFL draft capital.');
    expect(context.rows.find((row) => row.playerId === 'wr1')?.trace.join(' ')).toContain('Historical matchup actuals');
    expect(context.rows.find((row) => row.playerId === 'wr1')?.trace.join(' ')).toContain('Player opponent history');
    expect(context.rows.find((row) => row.playerId === 'rb1')?.trace.join(' ')).toContain(
      'Weekly projection is the main short-term signal'
    );
  });

  it('suppresses opponent claims when schedule rows are missing', () => {
    const projections = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'internal',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'internal-v1',
      rows: [
        { playerId: 'te1', playerName: 'Tight End', team: 'KC', position: 'TE', projectedFantasyPoints: 8.2 },
      ],
    });

    expect(buildPlayerProjectionContext({
      projectionSnapshot: projections,
      scheduleSnapshot: null,
    })).toMatchObject({
      status: 'missing-schedule',
      missingScheduleCount: 1,
      rows: [
        expect.objectContaining({
          schedule: expect.objectContaining({
            opponent: null,
            homeAway: 'unknown',
            note: expect.stringContaining('projection-specific opponent claims are suppressed'),
          }),
        }),
      ],
    });
  });

  it('joins optional opponent, environment, depth-chart, and opportunity context when source-backed maps are present', () => {
    const projections = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'fantasypros',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'week1-v1',
      rows: [
        { playerId: 'wr-context', sourcePlayerId: 'fp-wr-context', playerName: 'Context Receiver', team: 'JAC', position: 'WR', projectedFantasyPoints: 15.7 },
      ],
    });
    const schedule = buildNflScheduleSnapshot({
      season: 2026,
      source: 'Official schedule feed',
      sourceVersion: 'release-1',
      rows: [
        { week: 1, gameId: 'game-1', homeTeam: 'JAX', awayTeam: 'ARI', startsAt: '2026-09-13T17:00:00Z', gameStatus: 'scheduled', venueType: 'outdoor' },
      ],
    });
    const opponentDefense: PlayerProjectionOpponentDefenseContext = {
      opponent: 'ARI',
      position: 'WR',
      source: 'licensed-defense-feed',
      sourceVersion: 'def-v1',
      fetchedAt: '2026-09-10T12:00:00Z',
      fantasyPointsAllowedRank: 28,
      paceRank: 7,
      passRushFunnel: 'pass-funnel',
      pressureRate: 0.27,
      explosivePlayAllowanceRank: 25,
      redZoneWeaknessRank: 22,
      dstTurnoverOpportunityRank: null,
      dstSackOpportunityRank: null,
      confidence: 82,
      note: 'ARI allows elevated WR scoring and plays fast.',
    };
    const environment: PlayerProjectionGameEnvironmentContext = {
      team: 'JAX',
      week: 1,
      source: 'licensed-weather-feed',
      sourceVersion: 'weather-v1',
      fetchedAt: '2026-09-12T12:00:00Z',
      windMph: 8,
      precipitationChance: 12,
      temperatureF: 74,
      venueType: 'outdoor',
      vegasTotal: 47.5,
      impliedTeamTotal: 25.25,
      postponementRisk: 'low',
      confidence: 88,
      note: 'Low weather risk with a healthy implied total.',
    };
    const depthChart: PlayerProjectionDepthChartContext = {
      source: 'licensed-depth-chart-feed',
      sourceVersion: 'depth-v1',
      fetchedAt: '2026-09-10T11:00:00Z',
      starterStatus: 'starter',
      roleStability: 'stable',
      injuryReplacementFor: null,
      backupPressure: 'low',
      snapShareTrend: 'rising',
      recentSnapShare: 0.81,
      confidence: 90,
      note: 'Locked into two-WR sets with rising snaps.',
    };
    const opportunity: PlayerProjectionOpportunityContext = {
      source: 'internal-opportunity-model',
      sourceVersion: 'opp-v1',
      draftRound: 1,
      rookiePickTier: 'premium',
      contractTier: 'rookie',
      teamInvestment: 'high',
      rookieRamp: 'patient',
      patienceWindowWeeks: 8,
      opportunityScore: 86,
      confidence: 84,
      note: 'Round 1 investment supports a longer runway through early volatility.',
    };

    const context = buildPlayerProjectionContext({
      projectionSnapshot: projections,
      scheduleSnapshot: schedule,
      opponentDefenseContextByOpponentPosition: {
        [getOpponentDefenseContextKey('ARI', 'WR')]: opponentDefense,
      },
      gameEnvironmentContextByTeamWeek: {
        [getGameEnvironmentContextKey({ season: 2026, week: 1, team: 'JAC' })]: environment,
      },
      teamDepthChartContextByPlayerId: {
        'wr-context': depthChart,
      },
      opportunityContextByPlayerId: {
        'wr-context': opportunity,
      },
    });

    expect(context.rows[0]).toMatchObject({
      opponentDefense: {
        fantasyPointsAllowedRank: 28,
        passRushFunnel: 'pass-funnel',
      },
      gameEnvironment: {
        windMph: 8,
        impliedTeamTotal: 25.25,
      },
      depthChart: {
        starterStatus: 'starter',
        snapShareTrend: 'rising',
      },
      opportunityContext: {
        rookieRamp: 'patient',
        patienceWindowWeeks: 8,
      },
    });
    expect(context.rows[0].trace.join(' ')).toContain('Opponent defense: ARI allows elevated WR scoring');
    expect(context.rows[0].trace.join(' ')).toContain('Game environment: Low weather risk');
    expect(context.rows[0].trace.join(' ')).toContain('Depth chart: Locked into two-WR sets');
    expect(context.rows[0].trace.join(' ')).toContain('Opportunity context: Round 1 investment');
  });
});
