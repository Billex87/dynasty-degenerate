import { buildNflScheduleSnapshot, type NflScheduleSnapshotPayload } from './nflScheduleSnapshots';
import {
  buildPlayerProjectionSnapshot,
  type PlayerProjectionSnapshotPayload,
} from './playerProjectionSnapshots';
import type { ProjectionActualInputRow } from './projectionAccuracyBacktest';
import {
  getGameEnvironmentContextKey,
  getOpponentDefenseContextKey,
  type PlayerProjectionDepthChartContext,
  type PlayerProjectionGameEnvironmentContext,
  type PlayerProjectionOpponentDefenseContext,
  type PlayerProjectionOpportunityContext,
} from './playerProjectionContext';

export type ProjectionRolloutFixtureScenario =
  | 'normal-week'
  | 'bye-heavy-week'
  | 'injury-heavy-week'
  | 'rookies-heavy-roster'
  | 'playoff-matchup-week';

export type ProjectionRolloutFixture = {
  scenario: ProjectionRolloutFixtureScenario;
  description: string;
  scheduleSnapshot: NflScheduleSnapshotPayload;
  projectionSnapshot: PlayerProjectionSnapshotPayload;
  actualRows: ProjectionActualInputRow[];
  contextMaps: {
    opponentDefenseContextByOpponentPosition: Record<string, PlayerProjectionOpponentDefenseContext>;
    gameEnvironmentContextByTeamWeek: Record<string, PlayerProjectionGameEnvironmentContext>;
    teamDepthChartContextByPlayerId: Record<string, PlayerProjectionDepthChartContext>;
    opportunityContextByPlayerId: Record<string, PlayerProjectionOpportunityContext>;
  };
};

function opponentDefense(input: Partial<PlayerProjectionOpponentDefenseContext> & {
  opponent: PlayerProjectionOpponentDefenseContext['opponent'];
  position: string;
  note: string;
}): PlayerProjectionOpponentDefenseContext {
  return {
    source: 'fixture-defense-context',
    sourceVersion: 'fixture-v1',
    fetchedAt: '2026-09-10T12:00:00Z',
    fantasyPointsAllowedRank: null,
    paceRank: null,
    passRushFunnel: 'unknown',
    pressureRate: null,
    explosivePlayAllowanceRank: null,
    redZoneWeaknessRank: null,
    dstTurnoverOpportunityRank: null,
    dstSackOpportunityRank: null,
    confidence: 75,
    ...input,
  };
}

function environment(input: Partial<PlayerProjectionGameEnvironmentContext> & {
  team: PlayerProjectionGameEnvironmentContext['team'];
  week: number;
  note: string;
}): PlayerProjectionGameEnvironmentContext {
  return {
    source: 'fixture-game-environment',
    sourceVersion: 'fixture-v1',
    fetchedAt: '2026-09-10T12:00:00Z',
    windMph: null,
    precipitationChance: null,
    temperatureF: null,
    venueType: null,
    vegasTotal: null,
    impliedTeamTotal: null,
    postponementRisk: 'unknown',
    confidence: 75,
    ...input,
  };
}

function depthChart(input: Partial<PlayerProjectionDepthChartContext> & {
  note: string;
}): PlayerProjectionDepthChartContext {
  return {
    source: 'fixture-depth-chart',
    sourceVersion: 'fixture-v1',
    fetchedAt: '2026-09-10T12:00:00Z',
    starterStatus: 'unknown',
    roleStability: 'unknown',
    injuryReplacementFor: null,
    backupPressure: 'unknown',
    snapShareTrend: 'unknown',
    recentSnapShare: null,
    confidence: 75,
    ...input,
  };
}

function opportunity(input: Partial<PlayerProjectionOpportunityContext> & {
  note: string;
}): PlayerProjectionOpportunityContext {
  return {
    source: 'fixture-opportunity-model',
    sourceVersion: 'fixture-v1',
    draftRound: null,
    rookiePickTier: 'unknown',
    contractTier: 'unknown',
    teamInvestment: 'unknown',
    rookieRamp: 'unknown',
    patienceWindowWeeks: null,
    opportunityScore: null,
    confidence: 75,
    ...input,
  };
}

function baseContextMaps(): ProjectionRolloutFixture['contextMaps'] {
  return {
    opponentDefenseContextByOpponentPosition: {},
    gameEnvironmentContextByTeamWeek: {},
    teamDepthChartContextByPlayerId: {},
    opportunityContextByPlayerId: {},
  };
}

function putOpponent(
  maps: ProjectionRolloutFixture['contextMaps'],
  context: PlayerProjectionOpponentDefenseContext
) {
  maps.opponentDefenseContextByOpponentPosition[getOpponentDefenseContextKey(context.opponent, context.position)] = context;
}

function putEnvironment(
  maps: ProjectionRolloutFixture['contextMaps'],
  season: string | number,
  context: PlayerProjectionGameEnvironmentContext
) {
  maps.gameEnvironmentContextByTeamWeek[getGameEnvironmentContextKey({ season, week: context.week, team: context.team })] = context;
}

function normalWeekFixture(): ProjectionRolloutFixture {
  const scenario: ProjectionRolloutFixtureScenario = 'normal-week';
  const scheduleSnapshot = buildNflScheduleSnapshot({
    season: 2026,
    source: 'fixture-official-schedule',
    sourceVersion: scenario,
    rows: [
      { season: 2026, week: 1, gameId: 'normal-1', homeTeam: 'JAC', awayTeam: 'ARI', startsAt: '2026-09-13T17:00:00Z', gameStatus: 'scheduled', venueType: 'outdoor' },
      { season: 2026, week: 1, gameId: 'normal-2', homeTeam: 'BUF', awayTeam: 'KC', startsAt: '2026-09-13T20:25:00Z', gameStatus: 'scheduled', venueType: 'outdoor' },
    ],
  });
  const projectionSnapshot = buildPlayerProjectionSnapshot({
    season: 2026,
    week: 1,
    source: 'internal',
    scoringProfile: 'PPR',
    projectionType: 'weekly',
    sourceVersion: scenario,
    rows: [
      { season: 2026, playerId: 'fixture-wr-normal', playerName: 'Fixture WR Normal', team: 'JAC', position: 'WR', projectedFantasyPoints: 16.2, targets: 8 },
      { season: 2026, playerId: 'fixture-qb-normal', playerName: 'Fixture QB Normal', team: 'KC', position: 'QB', projectedFantasyPoints: 21.4, passingAttempts: 34 },
    ],
  });
  const contextMaps = baseContextMaps();
  putOpponent(contextMaps, opponentDefense({
    opponent: 'ARI',
    position: 'WR',
    fantasyPointsAllowedRank: 25,
    passRushFunnel: 'pass-funnel',
    note: 'Normal-week WR test has favorable opponent context.',
  }));
  putEnvironment(contextMaps, 2026, environment({
    team: 'JAX',
    week: 1,
    windMph: 6,
    precipitationChance: 8,
    vegasTotal: 46.5,
    impliedTeamTotal: 24.5,
    postponementRisk: 'low',
    note: 'Normal weather and total support a clean projection read.',
  }));
  contextMaps.teamDepthChartContextByPlayerId['fixture-wr-normal'] = depthChart({
    starterStatus: 'starter',
    roleStability: 'stable',
    snapShareTrend: 'flat',
    recentSnapShare: 0.78,
    note: 'Stable starter role for normal-week fixture.',
  });
  return {
    scenario,
    description: 'Balanced projection week with complete schedule, environment, and role context.',
    scheduleSnapshot,
    projectionSnapshot,
    actualRows: [
      { season: 2026, week: 1, playerId: 'fixture-wr-normal', actualFantasyPoints: 15.8 },
      { season: 2026, week: 1, playerId: 'fixture-qb-normal', actualFantasyPoints: 23.1 },
    ],
    contextMaps,
  };
}

function byeHeavyWeekFixture(): ProjectionRolloutFixture {
  const scenario: ProjectionRolloutFixtureScenario = 'bye-heavy-week';
  return {
    scenario,
    description: 'Week with a projected player missing a game row so bye/missing-schedule fallbacks can be validated.',
    scheduleSnapshot: buildNflScheduleSnapshot({
      season: 2026,
      source: 'fixture-official-schedule',
      sourceVersion: scenario,
      rows: [
        { season: 2026, week: 7, gameId: 'bye-1', homeTeam: 'DAL', awayTeam: 'PHI', startsAt: '2026-10-25T17:00:00Z', gameStatus: 'scheduled' },
      ],
    }),
    projectionSnapshot: buildPlayerProjectionSnapshot({
      season: 2026,
      week: 7,
      source: 'internal',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: scenario,
      rows: [
        { season: 2026, playerId: 'fixture-rb-bye', playerName: 'Fixture RB Bye', team: 'MIN', position: 'RB', projectedFantasyPoints: 11.2, carries: 13 },
        { season: 2026, playerId: 'fixture-wr-active', playerName: 'Fixture WR Active', team: 'DAL', position: 'WR', projectedFantasyPoints: 13.5, targets: 7 },
      ],
    }),
    actualRows: [
      { season: 2026, week: 7, playerId: 'fixture-wr-active', actualFantasyPoints: 12.9 },
    ],
    contextMaps: baseContextMaps(),
  };
}

function injuryHeavyWeekFixture(): ProjectionRolloutFixture {
  const scenario: ProjectionRolloutFixtureScenario = 'injury-heavy-week';
  const contextMaps = baseContextMaps();
  contextMaps.teamDepthChartContextByPlayerId['fixture-rb-fill-in'] = depthChart({
    starterStatus: 'starter',
    roleStability: 'new-opportunity',
    injuryReplacementFor: 'Fixture Starter RB',
    backupPressure: 'medium',
    snapShareTrend: 'rising',
    recentSnapShare: 0.62,
    note: 'Starter injury opens a short-term role, but confidence should stay capped.',
  });
  return {
    scenario,
    description: 'Injury-heavy week with questionable players and replacement-role context.',
    scheduleSnapshot: buildNflScheduleSnapshot({
      season: 2026,
      source: 'fixture-official-schedule',
      sourceVersion: scenario,
      rows: [
        { season: 2026, week: 4, gameId: 'injury-1', homeTeam: 'NYJ', awayTeam: 'BUF', startsAt: '2026-10-04T17:00:00Z', gameStatus: 'scheduled' },
      ],
    }),
    projectionSnapshot: buildPlayerProjectionSnapshot({
      season: 2026,
      week: 4,
      source: 'internal',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: scenario,
      rows: [
        { season: 2026, playerId: 'fixture-rb-fill-in', playerName: 'Fixture RB Fill In', team: 'BUF', position: 'RB', projectedFantasyPoints: 13.8, carries: 16 },
        { season: 2026, playerId: 'fixture-wr-injury', playerName: 'Fixture WR Injury', team: 'NYJ', position: 'WR', projectedFantasyPoints: 9.1, targets: 5, injuryStatus: 'Questionable - hamstring' },
      ],
    }),
    actualRows: [
      { season: 2026, week: 4, playerId: 'fixture-rb-fill-in', actualFantasyPoints: 15.2 },
      { season: 2026, week: 4, playerId: 'fixture-wr-injury', actualFantasyPoints: 4.7 },
    ],
    contextMaps,
  };
}

function rookiesHeavyRosterFixture(): ProjectionRolloutFixture {
  const scenario: ProjectionRolloutFixtureScenario = 'rookies-heavy-roster';
  const contextMaps = baseContextMaps();
  contextMaps.opportunityContextByPlayerId['fixture-rookie-wr'] = opportunity({
    draftRound: 1,
    rookiePickTier: 'premium',
    contractTier: 'rookie',
    teamInvestment: 'high',
    rookieRamp: 'patient',
    patienceWindowWeeks: 8,
    opportunityScore: 88,
    note: 'Round 1 rookie gets a patient ramp despite early projection volatility.',
  });
  contextMaps.opportunityContextByPlayerId['fixture-late-rb'] = opportunity({
    draftRound: 6,
    rookiePickTier: 'late',
    contractTier: 'rookie',
    teamInvestment: 'low',
    rookieRamp: 'urgent',
    patienceWindowWeeks: 2,
    opportunityScore: 42,
    note: 'Late rookie has a shorter opportunity window and needs usage quickly.',
  });
  return {
    scenario,
    description: 'Rookies-heavy roster for draft-capital runway and rookie-ramp readout validation.',
    scheduleSnapshot: buildNflScheduleSnapshot({
      season: 2026,
      source: 'fixture-official-schedule',
      sourceVersion: scenario,
      rows: [
        { season: 2026, week: 2, gameId: 'rookie-1', homeTeam: 'SEA', awayTeam: 'SF', startsAt: '2026-09-20T20:05:00Z', gameStatus: 'scheduled' },
      ],
    }),
    projectionSnapshot: buildPlayerProjectionSnapshot({
      season: 2026,
      week: 2,
      source: 'internal',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: scenario,
      rows: [
        { season: 2026, playerId: 'fixture-rookie-wr', playerName: 'Fixture Rookie WR', team: 'SEA', position: 'WR', projectedFantasyPoints: 8.4, targets: 5, rookie: true },
        { season: 2026, playerId: 'fixture-late-rb', playerName: 'Fixture Late RB', team: 'SF', position: 'RB', projectedFantasyPoints: 5.2, carries: 6, rookie: true },
      ],
    }),
    actualRows: [
      { season: 2026, week: 2, playerId: 'fixture-rookie-wr', actualFantasyPoints: 7.2, rookie: true, draftCapitalBucket: 'round-1' },
      { season: 2026, week: 2, playerId: 'fixture-late-rb', actualFantasyPoints: 2.1, rookie: true, draftCapitalBucket: 'round-6' },
    ],
    contextMaps,
  };
}

function playoffMatchupWeekFixture(): ProjectionRolloutFixture {
  const scenario: ProjectionRolloutFixtureScenario = 'playoff-matchup-week';
  const contextMaps = baseContextMaps();
  putOpponent(contextMaps, opponentDefense({
    opponent: 'BAL',
    position: 'QB',
    fantasyPointsAllowedRank: 4,
    pressureRate: 0.39,
    passRushFunnel: 'balanced',
    note: 'Playoff-week QB test has a difficult pressure matchup.',
  }));
  putEnvironment(contextMaps, 2026, environment({
    team: 'CIN',
    week: 16,
    windMph: 18,
    precipitationChance: 45,
    temperatureF: 31,
    venueType: 'outdoor',
    vegasTotal: 41.5,
    impliedTeamTotal: 20.25,
    postponementRisk: 'medium',
    confidence: 71,
    note: 'Outdoor playoff-week environment adds weather risk.',
  }));
  return {
    scenario,
    description: 'Playoff matchup week with source-backed schedule relevance and weather/opponent pressure.',
    scheduleSnapshot: buildNflScheduleSnapshot({
      season: 2026,
      source: 'fixture-official-schedule',
      sourceVersion: scenario,
      rows: [
        { season: 2026, week: 16, gameId: 'playoff-1', homeTeam: 'CIN', awayTeam: 'BAL', startsAt: '2026-12-20T18:00:00Z', gameStatus: 'scheduled', venueType: 'outdoor', weatherSensitivity: 'wind-sensitive', projectedPlayoffWeekRelevance: true },
      ],
    }),
    projectionSnapshot: buildPlayerProjectionSnapshot({
      season: 2026,
      week: 16,
      source: 'internal',
      scoringProfile: 'PPR',
      projectionType: 'playoff_weeks',
      sourceVersion: scenario,
      rows: [
        { season: 2026, playerId: 'fixture-qb-playoff', playerName: 'Fixture QB Playoff', team: 'CIN', position: 'QB', projectedFantasyPoints: 18.3, passingAttempts: 32 },
      ],
    }),
    actualRows: [
      { season: 2026, week: 16, playerId: 'fixture-qb-playoff', actualFantasyPoints: 15.1, opponentStrengthBucket: 'hard' },
    ],
    contextMaps,
  };
}

export function buildProjectionRolloutFixture(scenario: ProjectionRolloutFixtureScenario): ProjectionRolloutFixture {
  if (scenario === 'normal-week') return normalWeekFixture();
  if (scenario === 'bye-heavy-week') return byeHeavyWeekFixture();
  if (scenario === 'injury-heavy-week') return injuryHeavyWeekFixture();
  if (scenario === 'rookies-heavy-roster') return rookiesHeavyRosterFixture();
  return playoffMatchupWeekFixture();
}

export function buildAllProjectionRolloutFixtures(): ProjectionRolloutFixture[] {
  return [
    buildProjectionRolloutFixture('normal-week'),
    buildProjectionRolloutFixture('bye-heavy-week'),
    buildProjectionRolloutFixture('injury-heavy-week'),
    buildProjectionRolloutFixture('rookies-heavy-roster'),
    buildProjectionRolloutFixture('playoff-matchup-week'),
  ];
}
