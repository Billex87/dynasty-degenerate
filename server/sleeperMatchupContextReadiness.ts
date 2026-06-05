import { fetchUserLoadJson } from './loadTimeProviderPolicy';
import {
  getSleeperProjectionScoringProfile,
  loadStoredSleeperProjectionSnapshot,
  type SleeperProjectionScoringProfile,
} from './sleeperProjectionSnapshots';
import type { PlayerProjectionSnapshotPayload } from './playerProjectionSnapshots';

type SleeperLeague = {
  league_id?: string | number | null;
  season?: string | number | null;
  status?: string | null;
  scoring_settings?: Record<string, unknown> | null;
};

type SleeperRoster = {
  roster_id?: string | number | null;
  owner_id?: string | number | null;
  players?: unknown;
  starters?: unknown;
};

type SleeperUser = {
  user_id?: string | number | null;
};

type SleeperMatchup = {
  roster_id?: string | number | null;
  matchup_id?: string | number | null;
  starters?: unknown;
  players?: unknown;
  players_points?: unknown;
  custom_points?: unknown;
  points?: unknown;
};

type SleeperNflState = {
  season?: string | number | null;
  week?: string | number | null;
  season_type?: string | null;
};

type FetchJson = <T = any>(url: string, context?: string) => Promise<T>;
type ProjectionSnapshotLoader = (input: {
  season: string | number;
  week: number;
  scoringProfile: SleeperProjectionScoringProfile;
}) => Promise<PlayerProjectionSnapshotPayload | null>;

export type SleeperMatchupContextLeagueResult = {
  leagueLabel: string;
  ok: boolean;
  season: string;
  week: number;
  scoringProfile: SleeperProjectionScoringProfile;
  leagueStatus: string | null;
  userCount: number;
  rosterCount: number;
  matchupRowCount: number;
  matchupIdRowCount: number;
  matchupPairCount: number;
  opponentMappedRowCount: number;
  submittedLineupRowCount: number;
  submittedStarterCount: number;
  rowsWithPlayerPointsCount: number;
  projectionSnapshotStatus: 'ready' | 'missing';
  projectionSnapshotRowCount: number;
  submittedStarterProjectionCoveredCount: number;
  failures: string[];
};

export type SleeperMatchupContextReadinessResult = {
  ok: boolean;
  checkedAt: string;
  season: string;
  week: number;
  leagueCount: number;
  passedLeagueCount: number;
  failedLeagueCount: number;
  leagues: SleeperMatchupContextLeagueResult[];
};

export type SleeperMatchupContextReadinessOptions = {
  leagueIds: string[];
  season?: string | number | null;
  week?: number | null;
  fetchJson?: FetchJson;
  loadProjectionSnapshot?: ProjectionSnapshotLoader;
};

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
const SLEEPER_LEAGUE_ID_PATTERN = /^\d{8,24}$/;

function numericId(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized && /^\d+$/.test(normalized) ? normalized : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeLeagueId(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return SLEEPER_LEAGUE_ID_PATTERN.test(normalized) ? normalized : null;
}

function leagueLabel(leagueId: string): string {
  return `league:...${leagueId.slice(-4)}`;
}

function parseWeek(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 18 ? parsed : null;
}

function resolveSeason(input: {
  explicitSeason?: string | number | null;
  league?: SleeperLeague | null;
  state?: SleeperNflState | null;
}): string {
  return String(input.explicitSeason || input.league?.season || input.state?.season || new Date().getUTCFullYear());
}

function resolveWeek(input: {
  explicitWeek?: number | null;
  state?: SleeperNflState | null;
}): number {
  return parseWeek(input.explicitWeek) || parseWeek(input.state?.week) || 1;
}

function buildProjectionPlayerSet(snapshot: PlayerProjectionSnapshotPayload | null): Set<string> {
  const ids = new Set<string>();
  for (const row of snapshot?.rows || []) {
    const playerId = String(row.playerId || row.sourcePlayerId || '').trim();
    if (playerId && row.projectedFantasyPoints !== null && row.projectedFantasyPoints !== undefined) {
      ids.add(playerId);
    }
  }
  return ids;
}

function summarizeLeague(input: {
  leagueId: string;
  season: string;
  week: number;
  league: SleeperLeague | null;
  rosters: SleeperRoster[];
  users: SleeperUser[];
  matchups: SleeperMatchup[];
  projectionSnapshot: PlayerProjectionSnapshotPayload | null;
  scoringProfile: SleeperProjectionScoringProfile;
}): SleeperMatchupContextLeagueResult {
  const rosterIds = new Set(input.rosters.map((roster) => numericId(roster.roster_id)).filter(Boolean) as string[]);
  const matchupRows = input.matchups.filter((row) => numericId(row.roster_id));
  const matchupGroups = new Map<string, Set<string>>();
  let matchupIdRowCount = 0;
  let submittedLineupRowCount = 0;
  let submittedStarterCount = 0;
  let rowsWithPlayerPointsCount = 0;
  const submittedStarterIds = new Set<string>();

  for (const row of matchupRows) {
    const rosterId = numericId(row.roster_id);
    const matchupId = numericId(row.matchup_id);
    const starters = arrayValue(row.starters).map((playerId) => String(playerId || '').trim()).filter(Boolean);
    if (matchupId && rosterId) {
      matchupIdRowCount += 1;
      const group = matchupGroups.get(matchupId) || new Set<string>();
      group.add(rosterId);
      matchupGroups.set(matchupId, group);
    }
    if (starters.length > 0) {
      submittedLineupRowCount += 1;
      submittedStarterCount += starters.length;
      starters.forEach((playerId) => submittedStarterIds.add(playerId));
    }
    if (
      objectValue(row.players_points) ||
      objectValue(row.custom_points) ||
      numberValue(row.points) !== null
    ) {
      rowsWithPlayerPointsCount += 1;
    }
  }

  const matchupPairCount = Array.from(matchupGroups.values()).filter((group) => group.size >= 2).length;
  const opponentMappedRosterIds = new Set<string>();
  for (const group of Array.from(matchupGroups.values())) {
    if (group.size < 2) continue;
    for (const rosterId of Array.from(group)) {
      if (rosterIds.has(rosterId)) opponentMappedRosterIds.add(rosterId);
    }
  }
  const projectionPlayerIds = buildProjectionPlayerSet(input.projectionSnapshot);
  const submittedStarterProjectionCoveredCount = Array.from(submittedStarterIds)
    .filter((playerId) => projectionPlayerIds.has(playerId))
    .length;

  const failures: string[] = [];
  if (!input.league) failures.push('league metadata missing');
  if (input.users.length === 0) failures.push('league users missing');
  if (input.rosters.length === 0) failures.push('league rosters missing');
  if (input.matchups.length === 0) failures.push(`week ${input.week} matchup rows missing`);
  if (matchupIdRowCount === 0) failures.push('matchup IDs missing');
  if (matchupPairCount === 0) failures.push('opponent matchup pairs missing');
  if (submittedLineupRowCount === 0) failures.push('submitted lineup starters missing');
  if (!input.projectionSnapshot?.rows?.length) failures.push('stored Sleeper projection snapshot missing');
  if (submittedStarterIds.size > 0 && submittedStarterProjectionCoveredCount === 0) {
    failures.push('submitted starters have no stored projection coverage');
  }

  return {
    leagueLabel: leagueLabel(input.leagueId),
    ok: failures.length === 0,
    season: input.season,
    week: input.week,
    scoringProfile: input.scoringProfile,
    leagueStatus: input.league?.status || null,
    userCount: input.users.length,
    rosterCount: input.rosters.length,
    matchupRowCount: input.matchups.length,
    matchupIdRowCount,
    matchupPairCount,
    opponentMappedRowCount: opponentMappedRosterIds.size,
    submittedLineupRowCount,
    submittedStarterCount,
    rowsWithPlayerPointsCount,
    projectionSnapshotStatus: input.projectionSnapshot?.rows?.length ? 'ready' : 'missing',
    projectionSnapshotRowCount: input.projectionSnapshot?.rowCount || input.projectionSnapshot?.rows?.length || 0,
    submittedStarterProjectionCoveredCount,
    failures,
  };
}

export async function probeSleeperMatchupContextReadiness(
  options: SleeperMatchupContextReadinessOptions
): Promise<SleeperMatchupContextReadinessResult> {
  const leagueIds = Array.from(new Set(options.leagueIds.map(normalizeLeagueId).filter(Boolean) as string[]));
  const fetchJson = options.fetchJson || fetchUserLoadJson;
  const loadProjectionSnapshot = options.loadProjectionSnapshot || loadStoredSleeperProjectionSnapshot;
  const state = await fetchJson<SleeperNflState>(`${SLEEPER_BASE_URL}/state/nfl`, 'Sleeper matchup context state').catch(() => null);
  const week = resolveWeek({ explicitWeek: options.week, state });
  const checkedAt = new Date().toISOString();

  const leagues: SleeperMatchupContextLeagueResult[] = [];
  for (const leagueId of leagueIds) {
    const league = await fetchJson<SleeperLeague>(`${SLEEPER_BASE_URL}/league/${encodeURIComponent(leagueId)}`, 'Sleeper matchup context league').catch(() => null);
    const season = resolveSeason({ explicitSeason: options.season, league, state });
    const [users, rosters, matchups] = await Promise.all([
      fetchJson<SleeperUser[]>(`${SLEEPER_BASE_URL}/league/${encodeURIComponent(leagueId)}/users`, 'Sleeper matchup context users').catch(() => []),
      fetchJson<SleeperRoster[]>(`${SLEEPER_BASE_URL}/league/${encodeURIComponent(leagueId)}/rosters`, 'Sleeper matchup context rosters').catch(() => []),
      fetchJson<SleeperMatchup[]>(`${SLEEPER_BASE_URL}/league/${encodeURIComponent(leagueId)}/matchups/${week}`, 'Sleeper matchup context matchups').catch(() => []),
    ]);
    const scoringProfile = getSleeperProjectionScoringProfile(league?.scoring_settings);
    const projectionSnapshot = await loadProjectionSnapshot({ season, week, scoringProfile }).catch(() => null);
    leagues.push(summarizeLeague({
      leagueId,
      season,
      week,
      league,
      users: Array.isArray(users) ? users : [],
      rosters: Array.isArray(rosters) ? rosters : [],
      matchups: Array.isArray(matchups) ? matchups : [],
      projectionSnapshot,
      scoringProfile,
    }));
  }

  const passedLeagueCount = leagues.filter((league) => league.ok).length;
  const failedLeagueCount = leagues.length - passedLeagueCount;
  return {
    ok: leagueIds.length > 0 && failedLeagueCount === 0,
    checkedAt,
    season: String(options.season || state?.season || new Date().getUTCFullYear()),
    week,
    leagueCount: leagueIds.length,
    passedLeagueCount,
    failedLeagueCount,
    leagues,
  };
}
