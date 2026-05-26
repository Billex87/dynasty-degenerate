import { cleanName, getPlayerName, getPlayerRedraftValue, getPlayerValue } from './leagueAnalysis';
import { isCurrentSeasonLineupPlayer, normalizeSeasonLineupPosition } from './playerEligibility';
import type { KTCValues } from './reportGenerator';
import { getDraftSharksScheduleProfile } from './draftSharksSchedule';
import type { DraftSharksScheduleContext } from './draftSharksSchedule';
import { normalizeNflTeamCode } from './nflTeamCodes';
import type { MatchupPreview, PlayerScheduleProfile, SchedulePlanningSummary, WeeklyProjectionContext } from '../shared/types';

type SchedulePosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

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

function getProjectionPointsForPlayers(
  playerIds: string[],
  week: number,
  weeklyProjectionByPlayerId?: Record<string, WeeklyProjectionContext | null | undefined>,
): number | null {
  if (!weeklyProjectionByPlayerId) return null;
  const values = playerIds
    .map((playerId) => weeklyProjectionByPlayerId[playerId])
    .filter((projection): projection is WeeklyProjectionContext => Boolean(
      projection
      && projection.status === 'ready'
      && projection.week === week
      && Number.isFinite(projection.projectedFantasyPoints)
    ))
    .map((projection) => projection.projectedFantasyPoints);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 10) / 10;
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
      const sosAdjustment = typeof schedule.seasonSOS === 'number'
        ? Math.max(-1.5, Math.min(1.5, (schedule.seasonSOS - 50) / 25))
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
}): MatchupPreview[] {
  if (!SUPPORTED_SEASONS.has(String(input.season)) || !Number.isFinite(input.week) || input.week <= 0) return [];
  if (!Array.isArray(input.matchups) || input.matchups.length === 0) return [];
  const hasWeeklyProjectionContext = Boolean(input.weeklyProjectionByPlayerId && Object.keys(input.weeklyProjectionByPlayerId).length);

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
      const projectedPoints = Number.isFinite(actualPoints) && actualPoints > 0
        ? Math.round(actualPoints * 10) / 10
        : getProjectionPointsForPlayers(starterIds, input.week, input.weeklyProjectionByPlayerId)
          ?? getMatchupProjection({ playerIds: starterIds, players: input.players, ktcValues: input.ktcValues, playerSchedules: input.playerSchedules });
      const opponentProjectedPoints = Number.isFinite(actualOpponentPoints) && actualOpponentPoints > 0
        ? Math.round(actualOpponentPoints * 10) / 10
        : getProjectionPointsForPlayers(opponentStarterIds, input.week, input.weeklyProjectionByPlayerId)
          ?? getMatchupProjection({ playerIds: opponentStarterIds, players: input.players, ktcValues: input.ktcValues, playerSchedules: input.playerSchedules });
      const edge = projectedPoints !== null && opponentProjectedPoints !== null
        ? Math.round((projectedPoints - opponentProjectedPoints) * 10) / 10
        : null;
      const starterPlayers = starterIds
        .map((playerId) => toStarterPlayer(playerId, manager, input.players, input.ktcValues, input.weeklyProjectionByPlayerId))
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
            .map((playerId) => toStarterPlayer(playerId, opponentManager, input.players, input.ktcValues, input.weeklyProjectionByPlayerId))
            .filter((player) => player.pos === position)
            .reduce((sum, player) => sum + (player.weeklyProjection?.projectedFantasyPoints ?? ((player.seasonValue || player.value) / 1000)), 0);
          return {
            position,
            managerProjected: Math.round(managerProjected * 10) / 10,
            opponentProjected: Math.round(opponentProjected * 10) / 10,
            edge: Math.round((managerProjected - opponentProjected) * 10) / 10,
            note: `${position} edge from submitted lineup context${hasWeeklyProjectionContext ? ' and stored weekly projections' : input.playerSchedules ? ' and stored bye/SOS profiles' : ''}.`,
          };
        }).filter((row) => row.managerProjected || row.opponentProjected),
        howToWin: edge === null
          ? `Sleeper returned matchup ${row.matchup_id || ''}, but lineup projection inputs are still thin.`
          : edge >= 0
            ? `Protect the ${edge.toFixed(1)} point schedule/value edge against ${opponentManager}; use stored bye/SOS context before taking streamer risk.`
            : `Close a ${Math.abs(edge).toFixed(1)} point schedule/value gap against ${opponentManager} through lineup upgrades, streamer checks, and stored bye/SOS context.`,
        source: hasWeeklyProjectionContext ? 'Submitted lineup + stored weekly projection model' : 'Sleeper + Dynasty Degenerates schedule model',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return previews.sort((a, b) => a.manager.localeCompare(b.manager));
}

export function getSupportedScheduleByeWeeks() {
  return { ...NFL_2026_BYE_WEEK_BY_TEAM };
}
