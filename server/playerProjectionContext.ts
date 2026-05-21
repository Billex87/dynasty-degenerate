import type { NflScheduleGame, NflScheduleSnapshotPayload } from './nflScheduleSnapshots';
import { normalizeNflTeamCode, type NflTeamCode } from './nflTeamCodes';
import {
  getPlayerOpponentHistoryKey,
  type PlayerMatchupArchetypeSummary,
  type PlayerOpponentHistorySummary,
} from './playerMatchupActuals';
import type { PlayerProjectionSnapshotPayload, PlayerProjectionSnapshotRow } from './playerProjectionSnapshots';

export type PlayerProjectionOpponentDefenseContext = {
  opponent: NflTeamCode;
  position: string;
  source: string;
  sourceVersion: string;
  fetchedAt: string | null;
  fantasyPointsAllowedRank: number | null;
  paceRank: number | null;
  passRushFunnel: 'pass-funnel' | 'rush-funnel' | 'balanced' | 'unknown';
  pressureRate: number | null;
  explosivePlayAllowanceRank: number | null;
  redZoneWeaknessRank: number | null;
  dstTurnoverOpportunityRank: number | null;
  dstSackOpportunityRank: number | null;
  confidence: number | null;
  note: string;
};

export type PlayerProjectionGameEnvironmentContext = {
  team: NflTeamCode;
  week: number;
  source: string;
  sourceVersion: string;
  fetchedAt: string | null;
  windMph: number | null;
  precipitationChance: number | null;
  temperatureF: number | null;
  venueType: string | null;
  vegasTotal: number | null;
  impliedTeamTotal: number | null;
  postponementRisk: 'low' | 'medium' | 'high' | 'unknown';
  confidence: number | null;
  note: string;
};

export type PlayerProjectionDepthChartContext = {
  source: string;
  sourceVersion: string;
  fetchedAt: string | null;
  starterStatus: 'starter' | 'committee' | 'backup' | 'practice-squad' | 'inactive' | 'unknown';
  roleStability: 'stable' | 'volatile' | 'new-opportunity' | 'blocked' | 'unknown';
  injuryReplacementFor: string | null;
  backupPressure: 'low' | 'medium' | 'high' | 'unknown';
  snapShareTrend: 'rising' | 'flat' | 'falling' | 'unknown';
  recentSnapShare: number | null;
  confidence: number | null;
  note: string;
};

export type PlayerProjectionOpportunityContext = {
  source: string;
  sourceVersion: string;
  draftRound: number | null;
  rookiePickTier: 'premium' | 'early' | 'middle' | 'late' | 'unknown';
  contractTier: 'premium' | 'starter' | 'depth' | 'rookie' | 'unknown';
  teamInvestment: 'high' | 'medium' | 'low' | 'unknown';
  rookieRamp: 'patient' | 'normal' | 'urgent' | 'not-rookie' | 'unknown';
  patienceWindowWeeks: number | null;
  opportunityScore: number | null;
  confidence: number | null;
  note: string;
};

export type PlayerProjectionValueBridge = {
  dynastyValue: number | null;
  redraftValue: number | null;
  weeklyProjection: number | null;
  restOfSeasonProjection: number | null;
  longTermRoleSecurity: string | null;
  opportunityRunway: string | null;
  draftCapitalSignal: string | null;
  injuryStatus: string | null;
  valueContext: 'short-term-points' | 'dynasty-premium' | 'redraft-aligned' | 'projection-only' | 'value-missing';
  note: string;
};

export type PlayerProjectionScheduleContext = {
  week: number | null;
  team: string | null;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'bye' | 'unknown';
  startsAt: string | null;
  gameStatus: string | null;
  venue: string | null;
  neutralSite: boolean;
  shortRest: boolean;
  longRest: boolean;
  travelDistanceBucket: string | null;
  venueType: string | null;
  weatherSensitivity: string | null;
  internationalGame: boolean;
  divisionGame: boolean;
  conferenceGame: boolean;
  projectedPlayoffWeekRelevance: boolean;
  sourceVersion: string | null;
  note: string;
};

export type PlayerProjectionContextRow = {
  rowKey: string;
  playerId: string | null;
  sourcePlayerId: string | null;
  playerName: string;
  position: string;
  team: string | null;
  source: string;
  scoringProfile: string;
  projectionType: string;
  sourceVersion: string;
  projectedFantasyPoints: number | null;
  schedule: PlayerProjectionScheduleContext;
  valueBridge: PlayerProjectionValueBridge;
  opponentDefense: PlayerProjectionOpponentDefenseContext | null;
  gameEnvironment: PlayerProjectionGameEnvironmentContext | null;
  depthChart: PlayerProjectionDepthChartContext | null;
  opportunityContext: PlayerProjectionOpportunityContext | null;
  matchupActuals: PlayerMatchupArchetypeSummary | null;
  playerOpponentHistory: PlayerOpponentHistorySummary | null;
  trace: string[];
};

export type BuildPlayerProjectionContextInput = {
  projectionSnapshot?: PlayerProjectionSnapshotPayload | null;
  scheduleSnapshot?: NflScheduleSnapshotPayload | null;
  dynastyValueByPlayerId?: Record<string, number | null | undefined>;
  redraftValueByPlayerId?: Record<string, number | null | undefined>;
  restOfSeasonProjectionByPlayerId?: Record<string, number | null | undefined>;
  longTermRoleSecurityByPlayerId?: Record<string, string | null | undefined>;
  opportunityRunwayByPlayerId?: Record<string, string | null | undefined>;
  draftCapitalSignalByPlayerId?: Record<string, string | null | undefined>;
  opponentDefenseContextByOpponentPosition?: Record<string, PlayerProjectionOpponentDefenseContext | null | undefined>;
  gameEnvironmentContextByTeamWeek?: Record<string, PlayerProjectionGameEnvironmentContext | null | undefined>;
  teamDepthChartContextByPlayerId?: Record<string, PlayerProjectionDepthChartContext | null | undefined>;
  opportunityContextByPlayerId?: Record<string, PlayerProjectionOpportunityContext | null | undefined>;
  matchupActualsByProjectionRowKey?: Record<string, PlayerMatchupArchetypeSummary | null | undefined>;
  matchupActualsByPlayerId?: Record<string, PlayerMatchupArchetypeSummary | null | undefined>;
  playerOpponentHistoryByProjectionRowKey?: Record<string, PlayerOpponentHistorySummary | null | undefined>;
  playerOpponentHistoryByKey?: Record<string, PlayerOpponentHistorySummary | null | undefined>;
};

export type PlayerProjectionContextResult = {
  status: 'ready' | 'missing-projections' | 'missing-schedule' | 'partial';
  rowCount: number;
  missingScheduleCount: number;
  rows: PlayerProjectionContextRow[];
  trace: string[];
};

function finiteValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePosition(value?: string | null): string {
  const normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z/]/g, '');
  if (normalized === 'DST' || normalized === 'D/ST') return 'DEF';
  return normalized || 'UNKNOWN';
}

export function getOpponentDefenseContextKey(opponent?: string | null, position?: string | null): string {
  return `${normalizeNflTeamCode(opponent) || 'UNKNOWN'}:${normalizePosition(position)}`;
}

export function getGameEnvironmentContextKey(input: {
  season?: string | number | null;
  week?: string | number | null;
  team?: string | null;
}): string {
  const week = Number(input.week);
  return [
    String(input.season || 'unknown'),
    Number.isInteger(week) ? `w${week}` : 'week-unknown',
    normalizeNflTeamCode(input.team) || 'UNKNOWN',
  ].join(':');
}

function findGameForProjection(row: PlayerProjectionSnapshotRow, games: NflScheduleGame[]): NflScheduleGame | null {
  if (!row.team || row.week === null) return null;
  return games.find((game) => (
    game.season === row.season
    && game.week === row.week
    && (game.homeTeam === row.team || game.awayTeam === row.team)
  )) || null;
}

function buildScheduleContext(row: PlayerProjectionSnapshotRow, scheduleSnapshot?: NflScheduleSnapshotPayload | null): PlayerProjectionScheduleContext {
  if (!scheduleSnapshot) {
    return {
      week: row.week,
      team: row.team,
      opponent: null,
      homeAway: 'unknown',
      startsAt: null,
      gameStatus: null,
      venue: null,
      neutralSite: false,
      shortRest: false,
      longRest: false,
      travelDistanceBucket: null,
      venueType: null,
      weatherSensitivity: null,
      internationalGame: false,
      divisionGame: false,
      conferenceGame: false,
      projectedPlayoffWeekRelevance: false,
      sourceVersion: null,
      note: 'No normalized schedule snapshot is loaded; projection-specific opponent claims are suppressed.',
    };
  }

  const game = findGameForProjection(row, scheduleSnapshot.rows);
  if (!game) {
    return {
      week: row.week,
      team: row.team,
      opponent: null,
      homeAway: row.week === null ? 'unknown' : 'bye',
      startsAt: null,
      gameStatus: null,
      venue: null,
      neutralSite: false,
      shortRest: false,
      longRest: false,
      travelDistanceBucket: null,
      venueType: null,
      weatherSensitivity: null,
      internationalGame: false,
      divisionGame: false,
      conferenceGame: false,
      projectedPlayoffWeekRelevance: false,
      sourceVersion: scheduleSnapshot.sourceVersion,
      note: row.week === null
        ? 'Projection row is not tied to a single week, so no game join was attempted.'
        : 'No game row matched this player team/week; treat this as bye or missing schedule coverage.',
    };
  }

  const homeAway = game.homeTeam === row.team ? 'home' : 'away';
  const opponent = homeAway === 'home' ? game.awayTeam : game.homeTeam;
  return {
    week: row.week,
    team: row.team,
    opponent,
    homeAway,
    startsAt: game.startsAt,
    gameStatus: game.gameStatus,
    venue: game.venue,
    neutralSite: game.neutralSite,
    shortRest: game.shortRest,
    longRest: game.longRest,
    travelDistanceBucket: game.travelDistanceBucket,
    venueType: game.venueType,
    weatherSensitivity: game.weatherSensitivity,
    internationalGame: game.internationalGame,
    divisionGame: game.divisionGame,
    conferenceGame: game.conferenceGame,
    projectedPlayoffWeekRelevance: game.projectedPlayoffWeekRelevance,
    sourceVersion: game.sourceVersion,
    note: `${row.team} is ${homeAway} vs ${opponent} in Week ${row.week}.`,
  };
}

function buildValueBridge(input: {
  row: PlayerProjectionSnapshotRow;
  dynastyValue: number | null;
  redraftValue: number | null;
  restOfSeasonProjection: number | null;
  longTermRoleSecurity: string | null;
  opportunityRunway: string | null;
  draftCapitalSignal: string | null;
}): PlayerProjectionValueBridge {
  const weeklyProjection = input.row.projectedFantasyPoints;
  const dynastyValue = finiteValue(input.dynastyValue);
  const redraftValue = finiteValue(input.redraftValue);
  const restOfSeasonProjection = finiteValue(input.restOfSeasonProjection);
  const projectionScore = weeklyProjection === null ? null : weeklyProjection * 100;
  const hasProjection = projectionScore !== null;
  const valueContext: PlayerProjectionValueBridge['valueContext'] = !hasProjection
    ? 'value-missing'
    : dynastyValue === null && redraftValue === null
      ? 'projection-only'
      : dynastyValue !== null && redraftValue !== null && dynastyValue > redraftValue * 1.35
        ? 'dynasty-premium'
        : redraftValue !== null && projectionScore !== null && redraftValue >= projectionScore * 0.75
          ? 'redraft-aligned'
          : 'short-term-points';

  return {
    dynastyValue,
    redraftValue,
    weeklyProjection,
    restOfSeasonProjection,
    longTermRoleSecurity: input.longTermRoleSecurity,
    opportunityRunway: input.opportunityRunway,
    draftCapitalSignal: input.draftCapitalSignal,
    injuryStatus: input.row.injuryStatus,
    valueContext,
    note: valueContext === 'dynasty-premium'
      ? 'Dynasty price is materially above the weekly projection/value lane.'
      : valueContext === 'redraft-aligned'
        ? 'Redraft value and weekly projection are directionally aligned.'
        : valueContext === 'projection-only'
          ? 'Projection is available, but value bridge inputs are missing.'
          : valueContext === 'short-term-points'
            ? 'Weekly projection is the main short-term signal; do not treat it as dynasty value.'
            : 'Projection/value bridge is missing enough evidence.',
  };
}

function getOpponentDefenseContext(input: {
  row: PlayerProjectionSnapshotRow;
  schedule: PlayerProjectionScheduleContext;
  contextByOpponentPosition?: Record<string, PlayerProjectionOpponentDefenseContext | null | undefined>;
}): PlayerProjectionOpponentDefenseContext | null {
  if (!input.schedule.opponent) return null;
  const positionKey = getOpponentDefenseContextKey(input.schedule.opponent, input.row.position);
  const allKey = getOpponentDefenseContextKey(input.schedule.opponent, 'ALL');
  return input.contextByOpponentPosition?.[positionKey] || input.contextByOpponentPosition?.[allKey] || null;
}

function getGameEnvironmentContext(input: {
  row: PlayerProjectionSnapshotRow;
  schedule: PlayerProjectionScheduleContext;
  contextByTeamWeek?: Record<string, PlayerProjectionGameEnvironmentContext | null | undefined>;
}): PlayerProjectionGameEnvironmentContext | null {
  if (!input.row.team || input.row.week === null) return null;
  const key = getGameEnvironmentContextKey({
    season: input.row.season,
    week: input.row.week,
    team: input.row.team,
  });
  return input.contextByTeamWeek?.[key] || null;
}

function getPlayerContext<T>(
  playerId: string | null,
  contextByPlayerId?: Record<string, T | null | undefined>
): T | null {
  if (!playerId) return null;
  return contextByPlayerId?.[playerId] || null;
}

function getMatchupActualsContext(input: {
  row: PlayerProjectionSnapshotRow;
  byProjectionRowKey?: Record<string, PlayerMatchupArchetypeSummary | null | undefined>;
  byPlayerId?: Record<string, PlayerMatchupArchetypeSummary | null | undefined>;
}): PlayerMatchupArchetypeSummary | null {
  return input.byProjectionRowKey?.[input.row.rowKey]
    || (input.row.playerId ? input.byPlayerId?.[input.row.playerId] || null : null)
    || null;
}

function getPlayerOpponentHistoryContext(input: {
  row: PlayerProjectionSnapshotRow;
  schedule: PlayerProjectionScheduleContext;
  byProjectionRowKey?: Record<string, PlayerOpponentHistorySummary | null | undefined>;
  byKey?: Record<string, PlayerOpponentHistorySummary | null | undefined>;
}): PlayerOpponentHistorySummary | null {
  const direct = input.byProjectionRowKey?.[input.row.rowKey] || null;
  if (direct) return direct;
  const key = getPlayerOpponentHistoryKey({
    playerId: input.row.playerId,
    sourcePlayerId: input.row.sourcePlayerId,
    playerName: input.row.playerName,
    position: input.row.position,
    opponent: input.schedule.opponent,
  });
  return key ? input.byKey?.[key] || null : null;
}

export function buildPlayerProjectionContext(input: BuildPlayerProjectionContextInput): PlayerProjectionContextResult {
  if (!input.projectionSnapshot) {
    return {
      status: 'missing-projections',
      rowCount: 0,
      missingScheduleCount: 0,
      rows: [],
      trace: ['No normalized projection snapshot is loaded.'],
    };
  }

  const rows = input.projectionSnapshot.rows.map((row) => {
    const schedule = buildScheduleContext(row, input.scheduleSnapshot);
    const dynastyValue = row.playerId ? input.dynastyValueByPlayerId?.[row.playerId] ?? null : null;
    const redraftValue = row.playerId ? input.redraftValueByPlayerId?.[row.playerId] ?? null : null;
    const restOfSeasonProjection = row.playerId ? input.restOfSeasonProjectionByPlayerId?.[row.playerId] ?? null : null;
    const longTermRoleSecurity = row.playerId ? input.longTermRoleSecurityByPlayerId?.[row.playerId] ?? null : null;
    const opportunityRunway = row.playerId ? input.opportunityRunwayByPlayerId?.[row.playerId] ?? null : null;
    const draftCapitalSignal = row.playerId ? input.draftCapitalSignalByPlayerId?.[row.playerId] ?? null : null;
    const valueBridge = buildValueBridge({
      row,
      dynastyValue,
      redraftValue,
      restOfSeasonProjection,
      longTermRoleSecurity,
      opportunityRunway,
      draftCapitalSignal,
    });
    const opponentDefense = getOpponentDefenseContext({
      row,
      schedule,
      contextByOpponentPosition: input.opponentDefenseContextByOpponentPosition,
    });
    const gameEnvironment = getGameEnvironmentContext({
      row,
      schedule,
      contextByTeamWeek: input.gameEnvironmentContextByTeamWeek,
    });
    const depthChart = getPlayerContext(row.playerId, input.teamDepthChartContextByPlayerId);
    const opportunityContext = getPlayerContext(row.playerId, input.opportunityContextByPlayerId);
    const matchupActuals = getMatchupActualsContext({
      row,
      byProjectionRowKey: input.matchupActualsByProjectionRowKey,
      byPlayerId: input.matchupActualsByPlayerId,
    });
    const playerOpponentHistory = getPlayerOpponentHistoryContext({
      row,
      schedule,
      byProjectionRowKey: input.playerOpponentHistoryByProjectionRowKey,
      byKey: input.playerOpponentHistoryByKey,
    });
    return {
      rowKey: row.rowKey,
      playerId: row.playerId,
      sourcePlayerId: row.sourcePlayerId,
      playerName: row.playerName,
      position: row.position,
      team: row.team,
      source: row.source,
      scoringProfile: row.scoringProfile,
      projectionType: row.projectionType,
      sourceVersion: row.sourceVersion,
      projectedFantasyPoints: row.projectedFantasyPoints,
      schedule,
      valueBridge,
      opponentDefense,
      gameEnvironment,
      depthChart,
      opportunityContext,
      matchupActuals,
      playerOpponentHistory,
      trace: [
        `${row.source} ${row.projectionType} projection ${row.projectedFantasyPoints ?? 'n/a'} for ${row.scoringProfile}.`,
        schedule.note,
        valueBridge.note,
        opponentDefense ? `Opponent defense: ${opponentDefense.note}` : null,
        gameEnvironment ? `Game environment: ${gameEnvironment.note}` : null,
        depthChart ? `Depth chart: ${depthChart.note}` : null,
        opportunityContext ? `Opportunity context: ${opportunityContext.note}` : null,
        matchupActuals ? `Historical matchup actuals: ${matchupActuals.reason}` : null,
        playerOpponentHistory ? `Player opponent history: ${playerOpponentHistory.reason}` : null,
        valueBridge.restOfSeasonProjection !== null ? `Rest-of-season projection bridge: ${valueBridge.restOfSeasonProjection}.` : null,
        valueBridge.longTermRoleSecurity ? `Role security: ${valueBridge.longTermRoleSecurity}.` : null,
        valueBridge.opportunityRunway ? `Opportunity runway: ${valueBridge.opportunityRunway}.` : null,
        valueBridge.draftCapitalSignal ? `Draft capital: ${valueBridge.draftCapitalSignal}.` : null,
        valueBridge.injuryStatus ? `Injury status: ${valueBridge.injuryStatus}.` : null,
      ].filter((line): line is string => Boolean(line)),
    };
  });
  const missingScheduleCount = rows.filter((row) => row.schedule.opponent === null && row.schedule.homeAway !== 'unknown').length
    + rows.filter((row) => row.schedule.sourceVersion === null).length;
  const status: PlayerProjectionContextResult['status'] = !input.scheduleSnapshot
    ? 'missing-schedule'
    : missingScheduleCount
      ? 'partial'
      : 'ready';

  return {
    status,
    rowCount: rows.length,
    missingScheduleCount,
    rows,
    trace: [
      `${rows.length} projection row${rows.length === 1 ? '' : 's'} joined from ${input.projectionSnapshot.sourceKey}.`,
      input.scheduleSnapshot
        ? `Schedule snapshot ${input.scheduleSnapshot.snapshotKey} used for team/week joins.`
        : 'No schedule snapshot was available; opponent claims are suppressed.',
    ],
  };
}
