import { cleanName, getPlayerName, getPlayerRedraftValue, getPlayerValue } from './leagueAnalysis';
import { isCurrentSeasonLineupPlayer, normalizeSeasonLineupPosition } from './playerEligibility';
import type { KTCValues } from './reportGenerator';
import { getDraftSharksScheduleProfile } from './draftSharksSchedule';
import type { DraftSharksScheduleContext } from './draftSharksSchedule';
import { normalizeNflTeamCode } from './nflTeamCodes';
import type { MatchupPreview, PlayerScheduleProfile, PlayoffSchedulePlanningSummary, SchedulePlanningSummary, WeeklyProjectionContext } from '../shared/types';

type SchedulePosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
type WeeklyProjectionReadiness = {
  enabled: boolean;
  reason?: string | null;
};

type ProjectionPointsResult = {
  points: number;
  coveredPlayerCount: number;
  totalPlayerCount: number;
  fullCoverage: boolean;
} | null;

type LineupProjectionResult = {
  points: number | null;
  mode: 'stored-weekly-projection' | 'stored-weekly-projection-blend' | 'schedule-value';
  coveredPlayerCount: number;
  totalPlayerCount: number;
};

type PlayoffConfidenceResult = {
  confidence: number;
  confidenceReasons: string[];
  confidenceCapReason: string | null;
};

type PlayoffSchedulePlayerRow = {
  playerId: string;
  name: string;
  position: SchedulePosition | 'FLEX';
  team: string | null;
  scheduleTier: PlayerScheduleProfile['scheduleTier'] | null;
};

type SchedulePlayer = {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string | null;
  team?: string | null;
  status?: string | null;
};

type ScheduleRoster = {
  roster_id: number;
  players?: string[];
  starters?: Array<string | number | null | undefined>;
  taxi?: string[];
  reserve?: string[];
};

type SleeperMatchupRow = {
  roster_id?: number;
  matchup_id?: number | null;
  points?: number | string | null;
  players?: string[];
  starters?: Array<string | number | null | undefined>;
};

const BASE_SCHEDULE_SOURCE = 'NFL.com 2026 bye weeks + Sleeper league data';
const SCHEDULE_UPDATED_AT = '2026-05-15T09:00:00.000Z';
const SUPPORTED_SEASONS = new Set(['2026']);
const SCHEDULE_POSITIONS: SchedulePosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const PLAYOFF_CONFIDENCE_BASE = 94;
const SOS_STALE_AFTER_DAYS = 45;

// Source: NFL.com 2026 schedule release bye-week list, published May 15, 2026.
const NFL_2026_BYE_WEEK_BY_TEAM: Record<string, number> = {
  ARI: 14,
  ATL: 11,
  BAL: 13,
  BUF: 7,
  CAR: 5,
  CHI: 10,
  CIN: 6,
  CLE: 11,
  DAL: 14,
  DEN: 10,
  DET: 6,
  GB: 11,
  HOU: 8,
  IND: 13,
  JAX: 7,
  KC: 5,
  LAC: 7,
  LAR: 11,
  LV: 13,
  MIA: 6,
  MIN: 6,
  NE: 11,
  NO: 8,
  NYG: 8,
  NYJ: 13,
  PHI: 10,
  PIT: 9,
  SEA: 11,
  SF: 8,
  TB: 10,
  TEN: 9,
  WAS: 7,
};

function normalizeTeam(team?: string | null): string | null {
  return normalizeNflTeamCode(team);
}

function normalizePlayerId(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized && normalized !== '0' ? normalized : null;
}

function uniquePlayerIds(values?: Array<string | number | null | undefined>): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of values || []) {
    const id = normalizePlayerId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function getByeWeekForTeam(team?: string | null, season = '2026'): number | null {
  if (!SUPPORTED_SEASONS.has(String(season))) return null;
  const normalized = normalizeTeam(team);
  return normalized ? NFL_2026_BYE_WEEK_BY_TEAM[normalized] ?? null : null;
}

function getRosterActivePlayerIds(roster: ScheduleRoster): string[] {
  const inactive = new Set([
    ...uniquePlayerIds(roster.taxi || []),
    ...uniquePlayerIds(roster.reserve || []),
  ]);
  return uniquePlayerIds(roster.players || []).filter((playerId) => !inactive.has(playerId));
}

function getPosition(player?: SchedulePlayer): SchedulePosition | null {
  const position = normalizeSeasonLineupPosition(player?.position || undefined);
  return SCHEDULE_POSITIONS.includes(position as SchedulePosition) ? position as SchedulePosition : null;
}

function getStarterMinimums(rosterPositions: string[] = []): Record<SchedulePosition, number> {
  const counts = Object.fromEntries(SCHEDULE_POSITIONS.map((position) => [position, 0])) as Record<SchedulePosition, number>;
  for (const slot of rosterPositions || []) {
    const position = normalizeSeasonLineupPosition(slot);
    if (SCHEDULE_POSITIONS.includes(position as SchedulePosition)) {
      counts[position as SchedulePosition] += 1;
    }
  }

  counts.QB = Math.max(counts.QB, rosterPositions.includes('SUPER_FLEX') ? 1 : counts.QB);
  return counts;
}

function getPlayerDisplayName(playerId: string, players: Record<string, SchedulePlayer>): string {
  const player = players[playerId];
  return player?.full_name || getPlayerName(playerId, players as any);
}

function getScheduleValue(playerId: string, players: Record<string, SchedulePlayer>, ktcValues: KTCValues): number {
  const direct = ktcValues[cleanName(getPlayerDisplayName(playerId, players))];
  return getPlayerRedraftValue(playerId, players as any, ktcValues)
    || getPlayerValue(playerId, players as any, ktcValues)
    || direct?.redraft_value
    || direct?.ktc_value
    || 0;
}

function getScheduleSource(draftSharksContext?: DraftSharksScheduleContext | null): string {
  return draftSharksContext?.status === 'loaded'
    ? `${BASE_SCHEDULE_SOURCE} + DraftSharks SOS`
    : BASE_SCHEDULE_SOURCE;
}

function getScheduleUpdatedAt(draftSharksContext?: DraftSharksScheduleContext | null): string {
  return draftSharksContext?.status === 'loaded' && draftSharksContext.updatedAt
    ? draftSharksContext.updatedAt
    : SCHEDULE_UPDATED_AT;
}

function isStaleTimestamp(value?: string | null, maxAgeDays = SOS_STALE_AFTER_DAYS): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed > maxAgeDays * 24 * 60 * 60 * 1000;
}

function uniqueReasons(reasons: Array<string | null | undefined>, limit = 6): string[] {
  return Array.from(new Set(reasons.filter((reason): reason is string => Boolean(reason)))).slice(0, limit);
}

function getPlayoffWeekConfidence(input: {
  lineupProjection: LineupProjectionResult;
  lineupIds: string[];
  playerSchedules: Record<string, PlayerScheduleProfile>;
  draftSharksContext?: DraftSharksScheduleContext | null;
  weeklyProjectionReadiness?: WeeklyProjectionReadiness | null;
}): PlayoffConfidenceResult {
  let confidenceCap = PLAYOFF_CONFIDENCE_BASE;
  const capReasons: string[] = [];
  const applyCap = (cap: number, reason: string) => {
    if (cap < confidenceCap) confidenceCap = cap;
    capReasons.push(reason);
  };

  if (!input.lineupIds.length) {
    applyCap(45, 'No active lineup players were available for playoff confidence scoring.');
  }

  if (input.weeklyProjectionReadiness?.enabled === false) {
    applyCap(54, input.weeklyProjectionReadiness.reason || 'Weekly projection readiness is blocked; using schedule/value fallback.');
  }

  if (input.lineupProjection.mode === 'schedule-value') {
    applyCap(58, 'Weekly projection rows are unavailable for this playoff week; using schedule/value fallback.');
  } else if (input.lineupProjection.mode === 'stored-weekly-projection-blend') {
    applyCap(76, `Projection coverage is partial (${input.lineupProjection.coveredPlayerCount}/${input.lineupProjection.totalPlayerCount}); blended with schedule/value fallback.`);
  }

  if (
    input.lineupProjection.totalPlayerCount > 0 &&
    input.lineupProjection.coveredPlayerCount < input.lineupProjection.totalPlayerCount &&
    input.lineupProjection.mode !== 'schedule-value'
  ) {
    applyCap(76, `Missing projection rows for ${input.lineupProjection.totalPlayerCount - input.lineupProjection.coveredPlayerCount} starter candidate${input.lineupProjection.totalPlayerCount - input.lineupProjection.coveredPlayerCount === 1 ? '' : 's'}.`);
  }

  const missingScheduleProfileCount = input.lineupIds.filter((playerId) => !input.playerSchedules[playerId]).length;
  if (missingScheduleProfileCount > 0) {
    applyCap(70, `Schedule mapping is partial for ${missingScheduleProfileCount} lineup player${missingScheduleProfileCount === 1 ? '' : 's'}.`);
  }

  if (input.draftSharksContext?.status !== 'loaded') {
    applyCap(64, 'DraftSharks SOS snapshot is unavailable; confidence is capped to bye-week and value context.');
  } else if (isStaleTimestamp(input.draftSharksContext.updatedAt)) {
    applyCap(72, 'DraftSharks SOS snapshot may be stale; confidence is capped until the next source refresh.');
  }

  const confidenceReasons = uniqueReasons(
    capReasons.length
      ? capReasons
      : ['Fresh schedule, SOS, and projection context support this playoff-week confidence score.']
  );

  return {
    confidence: Math.max(25, Math.min(PLAYOFF_CONFIDENCE_BASE, confidenceCap)),
    confidenceReasons,
    confidenceCapReason: confidenceReasons[0] || null,
  };
}

export function buildPlayerScheduleProfiles(input: {
  season: string;
  players: Record<string, SchedulePlayer>;
  draftSharksContext?: DraftSharksScheduleContext | null;
}): Record<string, PlayerScheduleProfile> {
  if (!SUPPORTED_SEASONS.has(String(input.season))) return {};

  const profiles: Record<string, PlayerScheduleProfile> = {};
  for (const [playerId, player] of Object.entries(input.players)) {
    const team = normalizeTeam(player.team);
    const byeWeek = getByeWeekForTeam(team, input.season);
    if (!team || !byeWeek) continue;
    const position = getPosition(player);
    const draftSharksProfile = getDraftSharksScheduleProfile(input.draftSharksContext, team, position);
    const avoidWeeks = Array.from(new Set([
      byeWeek,
      ...(draftSharksProfile?.avoidWeeks || []),
    ])).sort((a, b) => a - b);

    profiles[playerId] = {
      source: getScheduleSource(input.draftSharksContext),
      updatedAt: draftSharksProfile?.updatedAt || getScheduleUpdatedAt(input.draftSharksContext),
      byeWeek,
      seasonSOS: draftSharksProfile?.seasonSOS ?? null,
      scheduleTier: draftSharksProfile?.scheduleTier || 'neutral',
      streamerWeeks: draftSharksProfile?.streamerWeeks || [],
      avoidWeeks,
    };
  }
  return profiles;
}

export function buildSchedulePlanningSummary(input: {
  season: string;
  currentWeek?: number | null;
  rosters: ScheduleRoster[];
  rosterMap: Record<number, string>;
  players: Record<string, SchedulePlayer>;
  ktcValues: KTCValues;
  rosterPositions?: string[];
  draftSharksContext?: DraftSharksScheduleContext | null;
  playerSchedules?: Record<string, PlayerScheduleProfile>;
}): SchedulePlanningSummary {
  const playerSchedules = input.playerSchedules || buildPlayerScheduleProfiles({
    season: input.season,
    players: input.players,
    draftSharksContext: input.draftSharksContext,
  });
  const byeWeekNotes = Object.entries(NFL_2026_BYE_WEEK_BY_TEAM)
    .reduce((weeks, [team, week]) => {
      if (!weeks.has(week)) weeks.set(week, []);
      weeks.get(week)?.push(team);
      return weeks;
    }, new Map<number, string[]>());
  const starterMinimums = getStarterMinimums(input.rosterPositions || []);
  const rosterGaps: NonNullable<SchedulePlanningSummary['rosterGaps']> = [];

  for (const roster of input.rosters || []) {
    const manager = input.rosterMap[roster.roster_id] || `Roster ${roster.roster_id}`;
    const activeIds = getRosterActivePlayerIds(roster);

    for (const position of SCHEDULE_POSITIONS) {
      const required = starterMinimums[position];
      if (required <= 0) continue;

      const positionIds = activeIds.filter((playerId) => getPosition(input.players[playerId]) === position);
      if (!positionIds.length) continue;

      const weeks = new Map<number, number>();
      for (const playerId of positionIds) {
        const byeWeek = playerSchedules[playerId]?.byeWeek;
        if (!byeWeek) continue;
        weeks.set(byeWeek, (weeks.get(byeWeek) || 0) + 1);
      }

      for (const [week, byeCount] of Array.from(weeks.entries())) {
        const available = positionIds.length - byeCount;
        if (available >= required) continue;
        const deficit = required - available;
        rosterGaps.push({
          manager,
          position,
          weeks: [week],
          severity: deficit >= 2 || available === 0 ? 'high' : 'medium',
          note: `${manager} projects below ${position} starter coverage in Week ${week}: ${available}/${required} active ${position} options after byes.`,
        });
      }
    }
  }

  const ownedPlayerIds = new Set(input.rosters.flatMap((roster) => uniquePlayerIds(roster.players || [])));
  const gapWeeksByPosition = new Map<string, Set<number>>();
  for (const gap of rosterGaps) {
    if (!gapWeeksByPosition.has(gap.position)) gapWeeksByPosition.set(gap.position, new Set<number>());
    gap.weeks.forEach((week) => gapWeeksByPosition.get(gap.position)?.add(week));
  }

  const streamerCandidates = Object.entries(input.players)
    .filter(([playerId, player]) => {
      if (ownedPlayerIds.has(playerId)) return false;
      const position = getPosition(player);
      return Boolean(position && isCurrentSeasonLineupPlayer(player as any));
    })
    .map(([playerId, player]) => {
      const position = getPosition(player)!;
      const team = normalizeTeam(player.team);
      const draftSharksProfile = getDraftSharksScheduleProfile(input.draftSharksContext, team, position);
      const byeWeek = playerSchedules[playerId]?.byeWeek ?? null;
      const targetWeeks = Array.from(new Set([
        ...Array.from(gapWeeksByPosition.get(position) || []),
        ...(draftSharksProfile?.streamerWeeks || []),
      ]))
        .filter((week) => week !== byeWeek)
        .sort((a, b) => a - b);
      return {
        playerId,
        name: getPlayerDisplayName(playerId, input.players),
        position,
        team,
        byeWeek,
        seasonSOS: draftSharksProfile?.seasonSOS ?? null,
        scheduleTier: draftSharksProfile?.scheduleTier || 'neutral' as const,
        targetWeeks,
        value: getScheduleValue(playerId, input.players, input.ktcValues),
        note: targetWeeks.length
          ? draftSharksProfile?.streamerWeeks.length
            ? `Available ${position} coverage with DraftSharks target Week ${targetWeeks.join(', ')} schedule windows.`
            : `Available ${position} coverage for Week ${targetWeeks.join(', ')} bye pressure.`
          : `Available ${position} with Week ${byeWeek || 'n/a'} bye; monitor as schedule depth.`,
      };
    })
    .filter((candidate) => candidate.targetWeeks.length > 0 || candidate.value > 0)
    .sort((a, b) => b.targetWeeks.length - a.targetWeeks.length || b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, 12)
    .map(({ value, ...candidate }) => candidate);

  const status: SchedulePlanningSummary['status'] = playerSchedules && Object.keys(playerSchedules).length
    ? rosterGaps.length || streamerCandidates.length ? 'ready' : 'partial'
    : 'pending';

  return {
    source: getScheduleSource(input.draftSharksContext),
    status,
    updatedAt: getScheduleUpdatedAt(input.draftSharksContext),
    rosterGaps,
    streamerCandidates,
    byeWeekNotes: Array.from(byeWeekNotes.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, teams]) => ({
        week,
        teams: teams.sort(),
        note: `${teams.length} NFL team${teams.length === 1 ? '' : 's'} on bye.`,
      })),
  };
}

function getPlayoffWeeks(weeks?: number[] | null): number[] {
  const normalized = Array.from(new Set((weeks?.length ? weeks : [15, 16, 17])
    .map((week) => Number(week))
    .filter((week) => Number.isFinite(week) && week > 0 && week <= 22)))
    .sort((a, b) => a - b);
  return normalized.length ? normalized : [15, 16, 17];
}

function toSchedulePlayerRow(
  playerId: string,
  players: Record<string, SchedulePlayer>,
  playerSchedules?: Record<string, PlayerScheduleProfile>,
): PlayoffSchedulePlayerRow {
  const player = players[playerId];
  const schedule = playerSchedules?.[playerId] || null;
  return {
    playerId,
    name: getPlayerDisplayName(playerId, players),
    position: getPosition(player) || 'FLEX',
    team: normalizeTeam(player?.team),
    scheduleTier: schedule?.scheduleTier || null,
  };
}

export function buildPlayoffSchedulePlanningSummary(input: {
  season: string;
  rosters: ScheduleRoster[];
  rosterMap: Record<number, string>;
  players: Record<string, SchedulePlayer>;
  ktcValues: KTCValues;
  playoffWeeks?: number[] | null;
  draftSharksContext?: DraftSharksScheduleContext | null;
  playerSchedules?: Record<string, PlayerScheduleProfile>;
  weeklyProjectionByPlayerId?: Record<string, WeeklyProjectionContext | null | undefined>;
  weeklyProjectionReadiness?: WeeklyProjectionReadiness | null;
}): PlayoffSchedulePlanningSummary {
  const weeks = getPlayoffWeeks(input.playoffWeeks);
  const playerSchedules = input.playerSchedules || buildPlayerScheduleProfiles({
    season: input.season,
    players: input.players,
    draftSharksContext: input.draftSharksContext,
  });
  const canUseWeeklyProjectionContext = isWeeklyProjectionReadinessEnabled(input.weeklyProjectionReadiness);
  const weeklyProjectionByPlayerId = canUseWeeklyProjectionContext ? input.weeklyProjectionByPlayerId : undefined;
  const ownedPlayerIds = new Set(input.rosters.flatMap((roster) => uniquePlayerIds(roster.players || [])));

  const availablePriorityAdds = Object.entries(input.players)
    .filter(([playerId, player]) => !ownedPlayerIds.has(playerId) && getPosition(player) && isCurrentSeasonLineupPlayer(player as any))
    .map(([playerId, player]) => {
      const schedule = playerSchedules[playerId];
      const position = getPosition(player);
      if (!schedule || !position) return null;
      const targetWeeks = weeks.filter((week) => schedule.streamerWeeks?.includes(week) && schedule.byeWeek !== week);
      if (!targetWeeks.length) return null;
      const value = getScheduleValue(playerId, input.players, input.ktcValues);
      return {
        playerId,
        name: getPlayerDisplayName(playerId, input.players),
        position,
        team: normalizeTeam(player.team),
        targetWeeks,
        seasonSOS: schedule.seasonSOS ?? null,
        scheduleTier: schedule.scheduleTier,
        value,
        note: `Available ${position} with stored playoff streamer window in Week ${targetWeeks.join(', ')}.`,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => b.targetWeeks.length - a.targetWeeks.length || (b.seasonSOS ?? -999) - (a.seasonSOS ?? -999) || b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, 12)
    .map(({ value, ...candidate }) => candidate);

  const managerPlans = (input.rosters || []).map((roster) => {
    const manager = input.rosterMap[roster.roster_id] || `Roster ${roster.roster_id}`;
    const activeIds = getRosterActivePlayerIds(roster);
    const lineupIds = uniquePlayerIds(roster.starters?.length ? roster.starters : activeIds);
    const weekRows = weeks.map((week) => {
      const lineupProjection = getLineupProjection({
        playerIds: lineupIds,
        week,
        players: input.players,
        ktcValues: input.ktcValues,
        playerSchedules,
        weeklyProjectionByPlayerId,
      });
      const confidence = getPlayoffWeekConfidence({
        lineupProjection,
        lineupIds,
        playerSchedules,
        draftSharksContext: input.draftSharksContext,
        weeklyProjectionReadiness: input.weeklyProjectionReadiness,
      });
      const byePlayers = lineupIds
        .filter((playerId) => playerSchedules[playerId]?.byeWeek === week)
        .map((playerId) => toSchedulePlayerRow(playerId, input.players, playerSchedules));
      const avoidPlayers = lineupIds
        .filter((playerId) => playerSchedules[playerId]?.avoidWeeks?.includes(week) && playerSchedules[playerId]?.byeWeek !== week)
        .map((playerId) => toSchedulePlayerRow(playerId, input.players, playerSchedules));
      const streamerPlayers = lineupIds
        .filter((playerId) => playerSchedules[playerId]?.streamerWeeks?.includes(week))
        .map((playerId) => toSchedulePlayerRow(playerId, input.players, playerSchedules));
      const riskCount = byePlayers.length + avoidPlayers.length;
      const upsideCount = streamerPlayers.length;

      return {
        week,
        projectedStarterPoints: lineupProjection.points,
        projectionCoverage: {
          coveredPlayerCount: lineupProjection.coveredPlayerCount,
          totalPlayerCount: lineupProjection.totalPlayerCount,
          mode: lineupProjection.mode,
        },
        confidence: confidence.confidence,
        confidenceReasons: confidence.confidenceReasons,
        confidenceCapReason: confidence.confidenceCapReason,
        byePlayers,
        avoidPlayers,
        streamerPlayers,
        note: riskCount
          ? `${manager} has ${riskCount} playoff schedule risk${riskCount === 1 ? '' : 's'} in Week ${week}; prioritize replacement coverage before lineup lock.`
          : upsideCount
            ? `${manager} has ${upsideCount} stored playoff streamer edge${upsideCount === 1 ? '' : 's'} in Week ${week}.`
            : `${manager} has no stored bye/SOS playoff red flags in Week ${week}.`,
      };
    });
    const riskScore = weekRows.reduce((sum, row) => sum + row.byePlayers.length * 3 + row.avoidPlayers.length * 2, 0);
    const upsideScore = weekRows.reduce((sum, row) => sum + row.streamerPlayers.length, 0);
    const confidence = weekRows.length
      ? Math.min(...weekRows.map((row) => row.confidence || PLAYOFF_CONFIDENCE_BASE))
      : 45;
    const confidenceReasons = uniqueReasons(weekRows.flatMap((row) => row.confidenceReasons || []), 6);
    const planPriorityAdds = availablePriorityAdds
      .filter((candidate) => candidate.targetWeeks.some((week) => weekRows.some((row) => row.week === week && (row.byePlayers.length || row.avoidPlayers.length))))
      .slice(0, 6);

    return {
      manager,
      riskScore,
      upsideScore,
      confidence,
      confidenceReasons,
      weeks: weekRows,
      priorityAdds: planPriorityAdds,
      note: riskScore
        ? `${manager} should cover ${riskScore} weighted playoff schedule risk point${riskScore === 1 ? '' : 's'} with stored SOS-backed waiver targets.`
        : upsideScore
          ? `${manager} has stored playoff schedule upside without current bye/SOS risk.`
          : `${manager} has a neutral stored playoff schedule profile.`,
    };
  }).sort((a, b) => b.riskScore - a.riskScore || b.upsideScore - a.upsideScore || a.manager.localeCompare(b.manager));

  const hasProfiles = Object.keys(playerSchedules).length > 0;
  const confidence = managerPlans.length
    ? Math.min(...managerPlans.map((plan) => plan.confidence || PLAYOFF_CONFIDENCE_BASE))
    : hasProfiles ? 70 : 35;
  const confidenceReasons = uniqueReasons(
    managerPlans.flatMap((plan) => plan.confidenceReasons || []),
    8
  );
  return {
    source: getScheduleSource(input.draftSharksContext),
    status: hasProfiles ? 'ready' : 'pending',
    updatedAt: getScheduleUpdatedAt(input.draftSharksContext),
    confidence,
    confidenceReasons: confidenceReasons.length
      ? confidenceReasons
      : [hasProfiles ? 'Stored playoff schedule profiles are available.' : 'No stored playoff schedule profiles are available.'],
    weeks,
    managerPlans,
  };
}

function getMatchupProjection(input: {
  playerIds: string[];
  players: Record<string, SchedulePlayer>;
  ktcValues: KTCValues;
  playerSchedules?: Record<string, PlayerScheduleProfile>;
}): number | null {
  const values = input.playerIds
    .map((playerId) => getScheduleValue(playerId, input.players, input.ktcValues))
    .filter((value) => value > 0);
  if (!values.length) return null;
  const raw = 62
    + values.reduce((sum, value) => sum + value, 0) / 950
    + getScheduleProjectionAdjustment(input.playerIds, input.playerSchedules);
  return Math.round(raw * 10) / 10;
}

function getReadyWeeklyProjection(
  playerId: string,
  week: number,
  weeklyProjectionByPlayerId?: Record<string, WeeklyProjectionContext | null | undefined>,
): WeeklyProjectionContext | null {
  const projection = weeklyProjectionByPlayerId?.[playerId] || null;
  return projection
    && projection.status === 'ready'
    && projection.week === week
    && Number.isFinite(projection.projectedFantasyPoints)
    ? projection
    : null;
}

function getProjectionPointsForPlayers(
  playerIds: string[],
  week: number,
  weeklyProjectionByPlayerId?: Record<string, WeeklyProjectionContext | null | undefined>,
): ProjectionPointsResult {
  if (!weeklyProjectionByPlayerId) return null;
  const uniqueIds = uniquePlayerIds(playerIds);
  if (!uniqueIds.length) return null;
  const values = uniqueIds
    .map((playerId) => getReadyWeeklyProjection(playerId, week, weeklyProjectionByPlayerId))
    .filter((projection): projection is WeeklyProjectionContext => Boolean(projection))
    .map((projection) => projection.projectedFantasyPoints);
  if (!values.length) return null;
  return {
    points: Math.round(values.reduce((sum, value) => sum + value, 0) * 10) / 10,
    coveredPlayerCount: values.length,
    totalPlayerCount: uniqueIds.length,
    fullCoverage: values.length === uniqueIds.length,
  };
}

function getAllocatedFallbackPointsForMissingPlayers(input: {
  allPlayerIds: string[];
  missingPlayerIds: string[];
  fallbackTotal: number | null;
  players: Record<string, SchedulePlayer>;
  ktcValues: KTCValues;
}): number | null {
  if (input.fallbackTotal === null || !input.missingPlayerIds.length) return 0;
  const weights = input.allPlayerIds
    .map((playerId) => ({
      playerId,
      value: Math.max(1000, getScheduleValue(playerId, input.players, input.ktcValues)),
    }))
    .filter((row) => row.value > 0);
  const totalWeight = weights.reduce((sum, row) => sum + row.value, 0);
  if (!totalWeight) return null;
  const missing = new Set(input.missingPlayerIds);
  const missingWeight = weights
    .filter((row) => missing.has(row.playerId))
    .reduce((sum, row) => sum + row.value, 0);
  return Math.round((input.fallbackTotal * (missingWeight / totalWeight)) * 10) / 10;
}

function getLineupProjection(input: {
  playerIds: string[];
  week: number;
  players: Record<string, SchedulePlayer>;
  ktcValues: KTCValues;
  playerSchedules?: Record<string, PlayerScheduleProfile>;
  weeklyProjectionByPlayerId?: Record<string, WeeklyProjectionContext | null | undefined>;
}): LineupProjectionResult {
  const uniqueIds = uniquePlayerIds(input.playerIds);
  const fallbackTotal = getMatchupProjection({
    playerIds: uniqueIds,
    players: input.players,
    ktcValues: input.ktcValues,
    playerSchedules: input.playerSchedules,
  });
  const projectionResult = getProjectionPointsForPlayers(uniqueIds, input.week, input.weeklyProjectionByPlayerId);
  if (!projectionResult) {
    return {
      points: fallbackTotal,
      mode: 'schedule-value',
      coveredPlayerCount: 0,
      totalPlayerCount: uniqueIds.length,
    };
  }

  if (projectionResult.fullCoverage) {
    return {
      points: projectionResult.points,
      mode: 'stored-weekly-projection',
      coveredPlayerCount: projectionResult.coveredPlayerCount,
      totalPlayerCount: projectionResult.totalPlayerCount,
    };
  }

  const missingPlayerIds = uniqueIds.filter((playerId) => !getReadyWeeklyProjection(playerId, input.week, input.weeklyProjectionByPlayerId));
  const fallbackMissingPoints = getAllocatedFallbackPointsForMissingPlayers({
    allPlayerIds: uniqueIds,
    missingPlayerIds,
    fallbackTotal,
    players: input.players,
    ktcValues: input.ktcValues,
  });
  const blendedPoints = fallbackMissingPoints === null
    ? fallbackTotal ?? projectionResult.points
    : Math.round((projectionResult.points + fallbackMissingPoints) * 10) / 10;

  return {
    points: blendedPoints,
    mode: 'stored-weekly-projection-blend',
    coveredPlayerCount: projectionResult.coveredPlayerCount,
    totalPlayerCount: projectionResult.totalPlayerCount,
  };
}

function isWeeklyProjectionReadinessEnabled(readiness?: WeeklyProjectionReadiness | null): boolean {
  return readiness?.enabled !== false;
}

function hasReadyWeeklyProjectionContext(
  week: number,
  weeklyProjectionByPlayerId?: Record<string, WeeklyProjectionContext | null | undefined>,
): boolean {
  return Object.values(weeklyProjectionByPlayerId || {}).some((projection) => Boolean(
    projection
    && projection.status === 'ready'
    && projection.week === week
    && Number.isFinite(projection.projectedFantasyPoints)
  ));
}

function logisticWinProbability(edge: number): number {
  return Math.round((1 / (1 + Math.exp(-edge / 12))) * 1000) / 10;
}

function getScheduleProjectionAdjustment(playerIds: string[], playerSchedules?: Record<string, PlayerScheduleProfile>): number {
  if (!playerSchedules) return 0;
  const adjustments = playerIds
    .map((playerId) => playerSchedules[playerId])
    .filter((schedule): schedule is PlayerScheduleProfile => Boolean(schedule))
    .map((schedule) => {
      // seasonSOS is a signed points-vs-average delta (~ -15..+15), higher = easier.
      const sosAdjustment = typeof schedule.seasonSOS === 'number'
        ? Math.max(-1.5, Math.min(1.5, schedule.seasonSOS / 10))
        : 0;
      const tierAdjustment = schedule.scheduleTier === 'elite'
        ? 1
        : schedule.scheduleTier === 'easy'
          ? 0.5
          : schedule.scheduleTier === 'hard'
            ? -0.75
            : 0;
      return sosAdjustment + tierAdjustment;
    });
  if (!adjustments.length) return 0;
  return Math.max(-4, Math.min(4, adjustments.reduce((sum, value) => sum + value, 0) / Math.max(1, Math.sqrt(adjustments.length))));
}

function toStarterPlayer(
  playerId: string,
  manager: string,
  players: Record<string, SchedulePlayer>,
  ktcValues: KTCValues,
  weeklyProjectionByPlayerId?: Record<string, WeeklyProjectionContext | null | undefined>,
) {
  const player = players[playerId];
  const position = getPosition(player) || 'FLEX';
  return {
    player_id: playerId,
    name: getPlayerDisplayName(playerId, players),
    pos: position,
    owner: manager,
    value: getPlayerValue(playerId, players as any, ktcValues) || getScheduleValue(playerId, players, ktcValues),
    seasonValue: getPlayerRedraftValue(playerId, players as any, ktcValues) || getScheduleValue(playerId, players, ktcValues),
    weeklyProjection: weeklyProjectionByPlayerId?.[playerId] || null,
  };
}

export function buildMatchupPreviews(input: {
  season: string;
  week: number;
  matchups: SleeperMatchupRow[];
  rosters: ScheduleRoster[];
  rosterMap: Record<number, string>;
  players: Record<string, SchedulePlayer>;
  ktcValues: KTCValues;
  playerSchedules?: Record<string, PlayerScheduleProfile>;
  weeklyProjectionByPlayerId?: Record<string, WeeklyProjectionContext | null | undefined>;
  weeklyProjectionReadiness?: WeeklyProjectionReadiness | null;
}): MatchupPreview[] {
  if (!SUPPORTED_SEASONS.has(String(input.season)) || !Number.isFinite(input.week) || input.week <= 0) return [];
  if (!Array.isArray(input.matchups) || input.matchups.length === 0) return [];
  const canUseWeeklyProjectionContext = isWeeklyProjectionReadinessEnabled(input.weeklyProjectionReadiness)
    && hasReadyWeeklyProjectionContext(input.week, input.weeklyProjectionByPlayerId);
  const weeklyProjectionByPlayerId = canUseWeeklyProjectionContext ? input.weeklyProjectionByPlayerId : undefined;

  const rowsByRosterId = new Map(input.matchups.map((row) => [Number(row.roster_id), row]));
  const rowsByMatchupId = input.matchups.reduce((groups, row) => {
    const matchupId = Number(row.matchup_id);
    if (!Number.isFinite(matchupId) || matchupId <= 0) return groups;
    if (!groups.has(matchupId)) groups.set(matchupId, []);
    groups.get(matchupId)?.push(row);
    return groups;
  }, new Map<number, SleeperMatchupRow[]>());
  const previews: MatchupPreview[] = [];

  for (const group of Array.from(rowsByMatchupId.values())) {
    if (group.length < 2) continue;
    const [a, b] = group;
    for (const [row, opponent] of [[a, b], [b, a]] as const) {
      const rosterId = Number(row.roster_id);
      const opponentRosterId = Number(opponent.roster_id);
      const manager = input.rosterMap[rosterId] || `Roster ${rosterId}`;
      const opponentManager = input.rosterMap[opponentRosterId] || `Roster ${opponentRosterId}`;
      const fallbackRoster = input.rosters.find((roster) => roster.roster_id === rosterId);
      const fallbackOpponentRoster = input.rosters.find((roster) => roster.roster_id === opponentRosterId);
      const starterIds = uniquePlayerIds(row.starters?.length ? row.starters : fallbackRoster?.starters || fallbackRoster?.players || []);
      const opponentStarterIds = uniquePlayerIds(opponent.starters?.length ? opponent.starters : fallbackOpponentRoster?.starters || fallbackOpponentRoster?.players || []);
      const actualPoints = Number(row.points);
      const actualOpponentPoints = Number(opponent.points);
      const starterProjectionResult = getLineupProjection({
        playerIds: starterIds,
        week: input.week,
        players: input.players,
        ktcValues: input.ktcValues,
        playerSchedules: input.playerSchedules,
        weeklyProjectionByPlayerId,
      });
      const opponentProjectionResult = getLineupProjection({
        playerIds: opponentStarterIds,
        week: input.week,
        players: input.players,
        ktcValues: input.ktcValues,
        playerSchedules: input.playerSchedules,
        weeklyProjectionByPlayerId,
      });
      const starterProjectionMode = Number.isFinite(actualPoints) && actualPoints > 0
        ? 'schedule-value'
        : starterProjectionResult.mode;
      const opponentProjectionMode = Number.isFinite(actualOpponentPoints) && actualOpponentPoints > 0
        ? 'schedule-value'
        : opponentProjectionResult.mode;
      const matchupUsesWeeklyProjectionTotals = starterProjectionMode === 'stored-weekly-projection'
        && opponentProjectionMode === 'stored-weekly-projection';
      const matchupUsesAnyWeeklyProjection = [starterProjectionMode, opponentProjectionMode]
        .some((mode) => mode === 'stored-weekly-projection' || mode === 'stored-weekly-projection-blend');
      const matchupUsesWeeklyProjectionBlend = !matchupUsesWeeklyProjectionTotals && matchupUsesAnyWeeklyProjection;
      const projectedPoints = Number.isFinite(actualPoints) && actualPoints > 0
        ? Math.round(actualPoints * 10) / 10
        : starterProjectionResult.points;
      const opponentProjectedPoints = Number.isFinite(actualOpponentPoints) && actualOpponentPoints > 0
        ? Math.round(actualOpponentPoints * 10) / 10
        : opponentProjectionResult.points;
      const edge = projectedPoints !== null && opponentProjectedPoints !== null
        ? Math.round((projectedPoints - opponentProjectedPoints) * 10) / 10
        : null;
      const edgeSourceLabel = matchupUsesWeeklyProjectionTotals
        ? 'stored projection'
        : matchupUsesWeeklyProjectionBlend
          ? 'stored projection blend'
          : 'schedule/value';
      const starterPlayers = starterIds
        .map((playerId) => toStarterPlayer(playerId, manager, input.players, input.ktcValues, weeklyProjectionByPlayerId))
        .sort((left, right) => (right.weeklyProjection?.projectedFantasyPoints || right.seasonValue || right.value) - (left.weeklyProjection?.projectedFantasyPoints || left.seasonValue || left.value));

      previews.push({
        week: input.week,
        manager,
        opponentManager,
        projectedPoints,
        opponentProjectedPoints,
        winProbability: edge === null ? null : logisticWinProbability(edge),
        mustStarts: starterPlayers.slice(0, 3),
        vulnerableSpots: starterPlayers.slice(-3).reverse(),
        boomBustRisks: starterPlayers.filter((player) => player.pos === 'RB' || player.pos === 'WR').slice(-2),
        positionEdges: SCHEDULE_POSITIONS.map((position) => {
          const managerProjected = starterPlayers
            .filter((player) => player.pos === position)
            .reduce((sum, player) => sum + (player.weeklyProjection?.projectedFantasyPoints ?? ((player.seasonValue || player.value) / 1000)), 0);
          const opponentProjected = opponentStarterIds
            .map((playerId) => toStarterPlayer(playerId, opponentManager, input.players, input.ktcValues, weeklyProjectionByPlayerId))
            .filter((player) => player.pos === position)
            .reduce((sum, player) => sum + (player.weeklyProjection?.projectedFantasyPoints ?? ((player.seasonValue || player.value) / 1000)), 0);
          return {
            position,
            managerProjected: Math.round(managerProjected * 10) / 10,
            opponentProjected: Math.round(opponentProjected * 10) / 10,
            edge: Math.round((managerProjected - opponentProjected) * 10) / 10,
            note: `${position} edge from submitted lineup context${matchupUsesAnyWeeklyProjection ? ' and stored weekly projections' : input.playerSchedules ? ' and stored bye/SOS profiles' : ''}.`,
          };
        }).filter((row) => row.managerProjected || row.opponentProjected),
        howToWin: edge === null
          ? `Sleeper returned matchup ${row.matchup_id || ''}, but lineup projection inputs are still thin.`
          : edge >= 0
            ? `Protect the ${edge.toFixed(1)} point ${edgeSourceLabel} edge against ${opponentManager}; use stored bye/SOS context before taking streamer risk.`
            : `Close a ${Math.abs(edge).toFixed(1)} point ${edgeSourceLabel} gap against ${opponentManager} through lineup upgrades, streamer checks, and stored bye/SOS context.`,
        source: matchupUsesWeeklyProjectionTotals
          ? 'Submitted lineup + stored weekly projection model'
          : matchupUsesWeeklyProjectionBlend
            ? 'Submitted lineup + stored weekly projection blend'
            : 'Sleeper + Dynasty Degenerates schedule model',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return previews.sort((a, b) => a.manager.localeCompare(b.manager));
}

export function getSupportedScheduleByeWeeks() {
  return { ...NFL_2026_BYE_WEEK_BY_TEAM };
}
