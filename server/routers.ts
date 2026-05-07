import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { loadBlendedKTCValues, loadKTCValuesLastWeek, loadLatestLocalKtcSnapshotDaysAgo } from "./ktcLoader";
import type { KTCValues, LastSeasonPlayerRank } from "./reportGenerator";
import { getKtcSnapshotFromDaysAgo } from "./ktcSnapshotJob";
import { generateReport } from "./reportGenerator";
import { fetchDraftData, calculateADPFromPicks, analyzeDraftPicks } from "./draftAnalysis";
import { getRookieValueBaseline, getRookieValueBaselines } from "./rookieValueBaselines";
import { fetchPlayerHeadshot, getCachedImage } from "./imageProxy";
import { cleanName, getPickValue, getPlayerName, getPlayerValue, playerNameKeyVariants } from "./leagueAnalysis";
import { fetchFantasyProsLatestPlayerNews, fetchFantasyProsNews, fetchFantasyProsPlayerPoints, findLatestFantasyProsNewsForPlayer } from "./fantasyPros";
import { buildRankingsBoard } from "./rankingsBoard";
import { buildProspectLookup, findProspectProfile, loadProspectContext } from "./prospectSource";
import {
  getFantasyProsScoringForPpr,
  getKtcProfileKeyForValueOptions,
  getValueSourceProfileKey,
  getValueSourceProfileLabel,
  normalizePpr,
  normalizeTep,
  type ValueBlendOptions,
} from "./valueBlend";
import { insertLoginAttempt } from "./db";
import { isCurrentFantasySkillPlayer, isCurrentSeasonLineupPlayer, normalizeSeasonLineupPosition } from "./playerEligibility";
import type { LeagueValueMode, ManagerChampionship, PickPortfolio, PlayerDetails, RecentTransaction, RecentTransactionPlayer, TrendingPlayer, WaiverIntelligence } from "../shared/types";

function normalizeManagerName(name: string | undefined): string {
  const fallback = name || 'Unknown';
  return fallback.replace(/\d+$/, '') || fallback;
}

function getManagerDisplayName(name: string | undefined): string {
  return name?.trim() || 'Unknown';
}

function getClientIp(req: { headers: Record<string, any>; socket?: { remoteAddress?: string | null } }): string | null {
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];
  const raw = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string" && forwardedFor.length > 0
      ? forwardedFor.split(",")[0]
      : typeof realIp === "string" && realIp.length > 0
        ? realIp
        : req.socket?.remoteAddress || null;

  if (!raw) return null;
  return String(raw).trim().replace(/^::ffff:/, "") || null;
}

function getSleeperAvatarUrl(avatarId: string | null | undefined): string | null {
  return avatarId ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : null;
}

function buildManagerAvatarMap(users: any[]): Record<string, string | null> {
  return Object.fromEntries(
    users.map((user: any) => [
      normalizeManagerName(user.display_name),
      getSleeperAvatarUrl(user.avatar),
    ])
  );
}

function buildPlayerOwnerMap(
  rosters: Array<{ players?: string[]; taxi?: string[]; reserve?: string[]; roster_id: number }>,
  rosterUserMap: Record<string, string>
): Record<string, string> {
  const ownerByPlayerId: Record<string, string> = {};

  for (const roster of rosters) {
    const manager = rosterUserMap[String(roster.roster_id)];
    if (!manager) continue;

    for (const playerId of [...(roster.players || []), ...(roster.taxi || []), ...(roster.reserve || [])]) {
      ownerByPlayerId[playerId] = manager;
    }
  }

  return ownerByPlayerId;
}

function normalizeAvailabilityStatus(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const label = String(value).replace(/_/g, ' ').trim();
  if (!label) return null;
  if (/^(active|healthy)$/i.test(label)) return null;
  return label;
}

function getDisplayStatus(player: Record<string, any> | undefined, rosterStatus?: string | null): string {
  const rosterLabel = normalizeAvailabilityStatus(rosterStatus);
  if (rosterLabel) return rosterLabel;

  const injuryLabel = normalizeAvailabilityStatus(player?.injury_status);
  if (injuryLabel) return injuryLabel;

  return normalizeAvailabilityStatus(player?.status) || 'Active';
}

function buildPlayerRosterStatusMap(
  rosters: Array<{ players?: string[]; taxi?: string[]; reserve?: string[] }>
): Record<string, string> {
  const statusByPlayerId: Record<string, string> = {};

  for (const roster of rosters) {
    for (const playerId of roster.reserve || []) {
      statusByPlayerId[String(playerId)] = 'IR';
    }
    for (const playerId of roster.taxi || []) {
      if (!statusByPlayerId[String(playerId)]) {
        statusByPlayerId[String(playerId)] = 'Taxi';
      }
    }
  }

  return statusByPlayerId;
}

function getLeagueValueMode(leagueInfo: any): LeagueValueMode {
  const type = Number(leagueInfo?.settings?.type ?? 0);
  if (type === 2) return 'dynasty';
  if (type === 1) return 'keeper';
  return 'redraft';
}

function countRosterSlot(rosterPositions: unknown, slotName: string): number {
  if (!Array.isArray(rosterPositions)) return 0;
  return rosterPositions.filter((slot) => String(slot) === slotName).length;
}

function getLeagueNumQbs(leagueInfo: any): 1 | 2 {
  const positions = Array.isArray(leagueInfo?.roster_positions) ? leagueInfo.roster_positions : [];
  const qbSlots = countRosterSlot(positions, 'QB');
  const hasSuperflex = positions.some((slot: string) => ['SUPER_FLEX', 'OP'].includes(slot));
  return hasSuperflex || qbSlots >= 2 ? 2 : 1;
}

function getLeagueReceptionScoring(leagueInfo: any): number {
  const value = Number(leagueInfo?.scoring_settings?.rec ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getLeagueTightEndPremium(leagueInfo: any): number {
  const scoring = leagueInfo?.scoring_settings || {};
  const baseReception = getLeagueReceptionScoring(leagueInfo);
  const teReception = Number(scoring.rec_te);
  if (Number.isFinite(teReception) && teReception > baseReception) {
    return teReception - baseReception;
  }

  const bonus = Number(scoring.bonus_rec_te ?? 0);
  return Number.isFinite(bonus) ? bonus : 0;
}

function getLeagueValueBlendOptions(leagueInfo: any): ValueBlendOptions {
  const ppr = normalizePpr(getLeagueReceptionScoring(leagueInfo));
  const tep = normalizeTep(getLeagueTightEndPremium(leagueInfo));
  const options: ValueBlendOptions = {
    numQbs: getLeagueNumQbs(leagueInfo),
    numTeams: Number(leagueInfo?.total_rosters || leagueInfo?.settings?.num_teams || 12),
    ppr,
    tep,
    fantasyProsScoring: getFantasyProsScoringForPpr(ppr),
  };

  return {
    ...options,
    ktcProfileKey: getKtcProfileKeyForValueOptions(options),
  };
}

function getLeagueValueProfileKey(leagueInfo: any): string {
  return getValueSourceProfileKey(getLeagueValueBlendOptions(leagueInfo));
}

function formatLeagueFormat(leagueInfo: any): string {
  const totalTeams = leagueInfo.total_rosters ? `${leagueInfo.total_rosters}-Team` : null;
  const valueMode = getLeagueValueMode(leagueInfo);
  const type = valueMode === 'dynasty' ? 'Dynasty' : valueMode === 'keeper' ? 'Keeper' : 'Redraft';
  const positions = Array.isArray(leagueInfo.roster_positions) ? leagueInfo.roster_positions : [];
  const superflex = positions.includes('SUPER_FLEX') ? 'SF' : null;
  const rec = Number(leagueInfo.scoring_settings?.rec ?? 0);
  const teBonus = getLeagueTightEndPremium(leagueInfo);
  const ppr = rec === 1 ? 'PPR' : rec === 0.5 ? 'Half-PPR' : rec === 0 ? 'Standard' : `${rec} PPR`;
  const tep = teBonus > 0 ? 'TEP' : null;

  return [totalTeams, type, superflex, ppr, tep].filter(Boolean).join(' ');
}

function formatLeagueMobileFormat(leagueInfo: any): string {
  const totalTeams = leagueInfo.total_rosters ? `${leagueInfo.total_rosters}-Team` : null;
  const valueMode = getLeagueValueMode(leagueInfo);
  const type = valueMode === 'dynasty' ? 'Dynasty' : valueMode === 'keeper' ? 'Keeper' : 'Redraft';
  return [totalTeams, type].filter(Boolean).join(' ');
}

function toSleeperLeagueOption(
  leagueInfo: any,
  season: string,
  extras?: {
    standingsRank?: number | null;
    powerRank?: number | null;
  }
) {
  return {
    leagueId: String(leagueInfo.league_id),
    name: leagueInfo.name || 'Unnamed League',
    avatarUrl: getSleeperAvatarUrl(leagueInfo.avatar),
    season,
    format: formatLeagueFormat(leagueInfo),
    mobileFormat: formatLeagueMobileFormat(leagueInfo),
    totalRosters: Number(leagueInfo.total_rosters || leagueInfo.settings?.num_teams || 0),
    standingsRank: extras?.standingsRank ?? null,
    powerRank: extras?.powerRank ?? null,
  };
}

type SleeperLeagueOption = ReturnType<typeof toSleeperLeagueOption>;

function buildLeagueRosterValueRankings(
  rosters: any[] = [],
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode
) {
  const playerIds = rosters.flatMap((roster: any) => [
    ...(Array.isArray(roster?.players) ? roster.players : []),
    ...(Array.isArray(roster?.taxi) ? roster.taxi : []),
    ...(Array.isArray(roster?.reserve) ? roster.reserve : []),
  ]);
  const valueProfilesById = buildPlayerValueProfileMap(playerIds, players, ktcValues);

  return rosters
    .map((roster: any) => {
      const rosterId = Number(roster?.roster_id);
      const totalValue = [...(Array.isArray(roster?.players) ? roster.players : []), ...(Array.isArray(roster?.taxi) ? roster.taxi : []), ...(Array.isArray(roster?.reserve) ? roster.reserve : [])]
        .reduce((sum: number, playerId: string) => (
          sum + getPlayerValueForLeagueMode(String(playerId), players, ktcValues, leagueValueMode, valueProfilesById)
        ), 0);
      return {
        rosterId,
        totalValue,
      };
    })
    .filter((row) => Number.isFinite(row.rosterId))
    .sort((a, b) => {
      if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
      return a.rosterId - b.rosterId;
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

async function fetchSleeperJson<T = any>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

function getFinalMatchupFromBracket(bracket: any[]): { winner: number | null; loser: number | null } {
  if (!Array.isArray(bracket) || bracket.length === 0) return { winner: null, loser: null };

  const completed = bracket
    .filter((matchup) => matchup && matchup.w !== undefined && matchup.w !== null)
    .map((matchup) => ({
      ...matchup,
      r: Number(matchup.r || 0),
      m: Number(matchup.m || 999),
      w: Number(matchup.w),
      l: Number(matchup.l),
    }))
    .filter((matchup) => Number.isFinite(matchup.w));

  if (completed.length === 0) return { winner: null, loser: null };

  const finalMatchup = completed.sort((a, b) => {
    if (b.r !== a.r) return b.r - a.r;
    return a.m - b.m;
  })[0];

  return {
    winner: Number.isFinite(finalMatchup.w) ? finalMatchup.w : null,
    loser: Number.isFinite(finalMatchup.l) ? finalMatchup.l : null,
  };
}

function getChampionRosterIdFromBracket(bracket: any[]): number | null {
  return getFinalMatchupFromBracket(bracket).winner;
}

function getRunnerUpRosterIdFromBracket(bracket: any[]): number | null {
  return getFinalMatchupFromBracket(bracket).loser;
}

function getRosterIdByFinalRank(rosters: any[] = [], rank: number): number | null {
  const roster = rosters.find((item: any) => Number(item?.settings?.rank) === rank);
  const rosterId = Number(roster?.roster_id);
  return Number.isFinite(rosterId) ? rosterId : null;
}

function getLastPlaceRosterIdFromRosters(rosters: any[] = []): number | null {
  const ranked = rosters
    .map((roster: any) => ({
      rosterId: Number(roster?.roster_id),
      rank: Number(roster?.settings?.rank),
    }))
    .filter((item) => Number.isFinite(item.rosterId) && Number.isFinite(item.rank));

  if (ranked.length === 0) return null;

  ranked.sort((a, b) => b.rank - a.rank);
  return ranked[0]?.rosterId ?? null;
}

type NormalizedLosersBracketMatchup = {
  r: number;
  p: number;
  m: number;
  w: number;
  l: number;
  t1: number;
  t2: number;
};

function normalizeLosersBracket(bracket: any[] = []): NormalizedLosersBracketMatchup[] {
  if (!Array.isArray(bracket) || bracket.length === 0) return [];

  return bracket
    .filter((matchup) => matchup && (matchup.l !== undefined || matchup.w !== undefined))
    .map((matchup) => ({
      r: Number(matchup.r || 0),
      p: Number(matchup.p || 0),
      m: Number(matchup.m || 999),
      w: Number(matchup.w),
      l: Number(matchup.l),
      t1: Number(matchup.t1),
      t2: Number(matchup.t2),
    }))
    .filter((matchup) => Number.isFinite(matchup.w) || Number.isFinite(matchup.l));
}

function getLastPlaceGameFromLosersBracket(bracket: any[] = [], playoffType?: unknown): NormalizedLosersBracketMatchup | null {
  const completed = normalizeLosersBracket(bracket);
  if (completed.length === 0) return null;

  const isToiletBowl = Number(playoffType) === 0;
  const placementGames = completed.filter((matchup) => Number.isFinite(matchup.p) && matchup.p > 0);
  const candidateGames = placementGames.length > 0 ? placementGames : completed;
  const finalRound = Math.max(...candidateGames.map((matchup) => matchup.r));
  const finalRoundGames = candidateGames.filter((matchup) => matchup.r === finalRound);

  const lastPlaceGame = finalRoundGames.sort((a, b) => {
    if (isToiletBowl && a.p !== b.p) return a.p - b.p;
    if (!isToiletBowl && a.p !== b.p) return b.p - a.p;
    return b.m - a.m;
  })[0];

  if (!lastPlaceGame) return null;

  return lastPlaceGame;
}

function getRosterMatchupPoints(matchups: any[] = [], rosterId: number): number | null {
  const row = matchups.find((matchup) => Number(matchup?.roster_id) === rosterId);
  if (!row) return null;
  const customPoints = Number(row.custom_points);
  if (Number.isFinite(customPoints)) return customPoints;
  const points = Number(row.points);
  return Number.isFinite(points) ? points : null;
}

function getLastPlaceRosterIdFromMatchupPoints(
  lastPlaceGame: NormalizedLosersBracketMatchup | null,
  matchups: any[] = []
): number | null {
  if (!lastPlaceGame || !Number.isFinite(lastPlaceGame.t1) || !Number.isFinite(lastPlaceGame.t2)) return null;

  const t1Points = getRosterMatchupPoints(matchups, lastPlaceGame.t1);
  const t2Points = getRosterMatchupPoints(matchups, lastPlaceGame.t2);
  if (t1Points === null || t2Points === null || t1Points === t2Points) return null;

  return t1Points < t2Points ? lastPlaceGame.t1 : lastPlaceGame.t2;
}

function getBracketGameWeek(leagueInfo: any, bracketGame: NormalizedLosersBracketMatchup | null): number | null {
  if (!bracketGame || !Number.isFinite(bracketGame.r)) return null;
  const playoffWeekStart = Number(leagueInfo?.settings?.playoff_week_start || 0);
  if (!Number.isFinite(playoffWeekStart) || playoffWeekStart <= 0) return null;
  return playoffWeekStart + bracketGame.r - 1;
}

export function getLastPlaceRosterIdFromLosersBracket(
  bracket: any[] = [],
  playoffType?: unknown,
  matchups: any[] = []
): number | null {
  const lastPlaceGame = getLastPlaceGameFromLosersBracket(bracket, playoffType);
  if (!lastPlaceGame) return null;

  const matchupPointsLoser = getLastPlaceRosterIdFromMatchupPoints(lastPlaceGame, matchups);
  if (matchupPointsLoser !== null) return matchupPointsLoser;

  const isToiletBowl = Number(playoffType) === 0;
  const lastPlaceRosterId = isToiletBowl
    // Sleeper's toilet-bowl `w` field represents the team that advances through the loser's path.
    ? lastPlaceGame.w
    // In normal consolation placement games, `l` is the loser of the lowest placement game.
    : lastPlaceGame.l;

  if (Number.isFinite(lastPlaceRosterId)) return lastPlaceRosterId;
  const fallbackRosterId = isToiletBowl ? lastPlaceGame.l : lastPlaceGame.w;
  return Number.isFinite(fallbackRosterId) ? fallbackRosterId : null;
}

function getWorstRegularSeasonRosterId(rosters: any[] = []): number | null {
  const ranked = rosters
    .map((roster: any) => ({
      rosterId: Number(roster?.roster_id),
      wins: Number(roster?.settings?.wins || 0),
      losses: Number(roster?.settings?.losses || 0),
      points: Number(roster?.settings?.fpts || 0) + Number(roster?.settings?.fpts_decimal || 0) / 100,
    }))
    .filter((item) => Number.isFinite(item.rosterId));

  if (ranked.length === 0) return null;

  ranked.sort((a, b) => {
    if (a.wins !== b.wins) return a.wins - b.wins;
    if (b.losses !== a.losses) return b.losses - a.losses;
    return a.points - b.points;
  });

  return ranked[0]?.rosterId ?? null;
}

function buildCurrentStandings(rosters: any[] = [], rosterUserMap: Record<string, string> = {}) {
  const ranked = rosters
    .map((roster: any) => {
      const pointsFor = Number(roster?.settings?.fpts || 0) + Number(roster?.settings?.fpts_decimal || 0) / 100;
      return {
        manager: rosterUserMap[String(roster?.roster_id)] || 'Unknown',
        wins: Number(roster?.settings?.wins || 0),
        losses: Number(roster?.settings?.losses || 0),
        ties: Number(roster?.settings?.ties || 0),
        pointsFor: Number.isFinite(pointsFor) ? pointsFor : 0,
      };
    })
    .filter((row) => row.manager && row.manager !== 'Unknown');

  ranked.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    if (a.ties !== b.ties) return b.ties - a.ties;
    if (a.pointsFor !== b.pointsFor) return b.pointsFor - a.pointsFor;
    return a.manager.localeCompare(b.manager);
  });

  return ranked.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

async function buildManagerChampionships(
  currentLeagueInfo: any,
  currentUsers: any[] = [],
  currentRosters: any[] = [],
  maxSeasons = 8
): Promise<Record<string, ManagerChampionship>> {
  const championships: Record<string, ManagerChampionship> = {};
  const addFinish = (manager: string | undefined, season: string, key: keyof ManagerChampionship) => {
    if (!manager || manager === 'Unknown') return;
    championships[manager] = championships[manager] || { seasons: [] };
    const seasons = championships[manager][key] || [];
    if (!seasons.includes(season)) {
      championships[manager][key] = [...seasons, season];
    }
  };
  const visited = new Set<string>();
  const safeCurrentUsers = Array.isArray(currentUsers) ? currentUsers : [];
  const safeCurrentRosters = Array.isArray(currentRosters) ? currentRosters : [];
  const currentManagerByUserId = Object.fromEntries(
    safeCurrentUsers.map((user: any) => [user.user_id, normalizeManagerName(user.display_name)])
  );
  const currentUserMap = Object.fromEntries(safeCurrentUsers.map((user: any) => [user.user_id, user]));
  const currentManagerByRosterId = Object.fromEntries(
    safeCurrentRosters.map((roster: any) => {
      const rosterId = Number(roster?.roster_id);
      const ownerId = roster?.owner_id ? String(roster.owner_id) : '';
      const manager = currentManagerByUserId[ownerId]
        || normalizeManagerName(currentUserMap[ownerId]?.display_name);
      return [rosterId, manager === 'Unknown' ? undefined : manager];
    })
  );
  let nextLeagueId = currentLeagueInfo?.previous_league_id ? String(currentLeagueInfo.previous_league_id) : '';

  for (let depth = 0; nextLeagueId && depth < maxSeasons && !visited.has(nextLeagueId); depth += 1) {
    visited.add(nextLeagueId);

    const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${nextLeagueId}`);
    if (!leagueInfo?.league_id) break;

    const [users, rosters, winnersBracket, losersBracket] = await Promise.all([
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${nextLeagueId}/users`),
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${nextLeagueId}/rosters`),
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${nextLeagueId}/winners_bracket`),
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${nextLeagueId}/losers_bracket`),
    ]);

    const userMap = Object.fromEntries((users || []).map((user: any) => [user.user_id, user]));
    const season = String(leagueInfo.season || Number(currentLeagueInfo?.season || new Date().getFullYear()) - depth - 1);
    const managerByRosterId = Object.fromEntries(
      (Array.isArray(rosters) ? rosters : []).map((roster: any) => {
        const rosterId = Number(roster.roster_id);
        const ownerId = roster?.owner_id ? String(roster.owner_id) : '';
        const currentSlotManager = currentManagerByRosterId[rosterId];
        const manager = currentManagerByUserId[ownerId]
          || (currentSlotManager && currentSlotManager !== 'Unknown' ? currentSlotManager : undefined)
          || normalizeManagerName(userMap[ownerId]?.display_name);
        return [rosterId, manager];
      })
    );

    const championRosterId = getChampionRosterIdFromBracket(winnersBracket || [])
      ?? getRosterIdByFinalRank(rosters || [], 1);
    const runnerUpRosterId = getRunnerUpRosterIdFromBracket(winnersBracket || [])
      ?? getRosterIdByFinalRank(rosters || [], 2);
    const lastPlaceGame = getLastPlaceGameFromLosersBracket(losersBracket || [], leagueInfo?.settings?.playoff_type);
    const lastPlaceWeek = getBracketGameWeek(leagueInfo, lastPlaceGame);
    const lastPlaceWeekMatchups = lastPlaceWeek
      ? await fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${nextLeagueId}/matchups/${lastPlaceWeek}`)
      : null;
    const lastPlaceRosterId = getLastPlaceRosterIdFromLosersBracket(
      losersBracket || [],
      leagueInfo?.settings?.playoff_type,
      lastPlaceWeekMatchups || []
    )
      ?? getLastPlaceRosterIdFromRosters(rosters || [])
      ?? getWorstRegularSeasonRosterId(rosters || []);

    addFinish(managerByRosterId[championRosterId ?? -1], season, 'seasons');
    if (depth === 0 && runnerUpRosterId !== championRosterId) {
      addFinish(managerByRosterId[runnerUpRosterId ?? -1], season, 'runnerUpSeasons');
    }
    if (depth === 0 && lastPlaceRosterId !== championRosterId && lastPlaceRosterId !== runnerUpRosterId) {
      addFinish(managerByRosterId[lastPlaceRosterId ?? -1], season, 'lastPlaceSeasons');
    }

    nextLeagueId = leagueInfo.previous_league_id ? String(leagueInfo.previous_league_id) : '';
  }

  return Object.fromEntries(
    Object.entries(championships).map(([manager, championship]) => [
      manager,
      {
        seasons: [...championship.seasons].sort((a, b) => Number(b) - Number(a)),
        runnerUpSeasons: [...(championship.runnerUpSeasons || [])].sort((a, b) => Number(b) - Number(a)),
        lastPlaceSeasons: [...(championship.lastPlaceSeasons || [])].sort((a, b) => Number(b) - Number(a)),
      },
    ])
  );
}

function getPlayerDetails(playerId: string, player: Record<string, any> | undefined, rosterStatus?: string | null): PlayerDetails | undefined {
  if (!player) return undefined;

  return {
    playerId,
    fullName: player.full_name || getPlayerName(playerId, { [playerId]: player }),
    position: player.position,
    team: player.team ?? null,
    jerseyNumber: player.number ?? null,
    age: player.age ?? null,
    birthDate: player.birth_date ?? null,
    height: player.height ?? null,
    weight: player.weight ?? null,
    college: player.college ?? null,
    rookieYear: player.metadata?.rookie_year ?? null,
    nflDraftRound: player.metadata?.draft_round ?? player.draft_round ?? null,
    nflDraftPick: player.metadata?.draft_pick ?? player.metadata?.draft_slot ?? player.draft_pick ?? null,
    nflDraftTeam: player.metadata?.draft_team ?? player.draft_team ?? null,
    highSchool: player.high_school ?? null,
    injuryStatus: player.injury_status ?? null,
    rosterStatus: rosterStatus ?? null,
    displayStatus: getDisplayStatus(player, rosterStatus),
    depthChartPosition: player.depth_chart_position ?? null,
    depthChartOrder: player.depth_chart_order ?? null,
    yearsExp: player.years_exp ?? null,
    status: player.status ?? null,
    sleeperNewsUpdated: player.news_updated ?? null,
    externalIds: {
      fantasyData: player.fantasy_data_id,
      sportradar: player.sportradar_id,
      yahoo: player.yahoo_id,
      gsis: player.gsis_id,
      espn: player.espn_id,
      stats: player.stats_id,
    },
  };
}

async function fetchPlayerAvailabilityHistory(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  scoringSettings: Record<string, any> | undefined,
  lastCompletedSeason: string,
  seasonCount = 3
): Promise<Record<string, Pick<PlayerDetails, 'availabilityHistory' | 'avgGamesMissed' | 'availabilitySeasons'>>> {
  const scoringFamily = getScoringFamily(scoringSettings);
  const fantasyProsScoring = scoringFamily === 'ppr' ? 'PPR' : scoringFamily === 'std' ? 'STD' : 'HALF';
  const seasons = Array.from({ length: seasonCount }, (_, index) => String(Number(lastCompletedSeason) - index))
    .filter((season) => Number.isFinite(Number(season)));
  const uniquePlayerIds = Array.from(new Set(Array.from(playerIds).filter(Boolean)))
    .filter((playerId) => ['QB', 'RB', 'WR', 'TE'].includes(players[playerId]?.position));

  const seasonPoints = await Promise.all(
    seasons.map(async (season) => ({
      season,
      values: await fetchFantasyProsPlayerPoints(season, fantasyProsScoring),
    }))
  );

  return Object.fromEntries(uniquePlayerIds.map((playerId) => {
    const key = cleanName(`${players[playerId]?.first_name || ''}${players[playerId]?.last_name || ''}`);
    const history = seasonPoints
      .map(({ season, values }) => {
        const points = values[key];
        if (!points || typeof points.games !== 'number') return null;
        const gamesMissed = Math.max(0, 17 - points.games);
        return {
          season,
          games: points.games,
          gamesMissed,
          pointsPerGame: points.average ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const avgGamesMissed = history.length
      ? Math.round((history.reduce((sum, item) => sum + (item.gamesMissed || 0), 0) / history.length) * 10) / 10
      : null;

    return [
      playerId,
      {
        availabilityHistory: history,
        avgGamesMissed,
        availabilitySeasons: history.length,
      },
    ];
  }));
}

function buildPlayerDetailsMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  rosterStatusByPlayerId: Record<string, string> = {},
  prospectLookup?: ReturnType<typeof buildProspectLookup>
): Record<string, PlayerDetails> {
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean)))
      .map((playerId) => {
        const details = getPlayerDetails(playerId, players[playerId], rosterStatusByPlayerId[playerId]);
        return [
          playerId,
          details && prospectLookup
            ? {
              ...details,
              prospectProfile: findProspectProfile(
                prospectLookup,
                details.fullName,
                details.position,
                details.college,
                details.rookieYear
              ),
            }
            : details,
        ];
      })
      .filter((entry): entry is [string, PlayerDetails] => Boolean(entry[1]))
  );
}

function getPlayerCurrentPositionRank(
  playerId: string,
  players: Record<string, any>,
  ktcValues: KTCValues
): string | null {
  const player = players[playerId];
  if (!player) return null;

  const fullName = `${player.first_name || ''}${player.last_name || ''}`;
  const key = cleanName(fullName);
  const variants = Array.from(new Set(playerNameKeyVariants(key)));
  let rank = variants
    .map((variant) => ktcValues[variant]?.position_rank)
    .find(Boolean);

  if (!rank) {
    const match = Object.entries(ktcValues)
      .filter(([ktcKey]) => variants.some((variant) => variant.includes(ktcKey) || ktcKey.includes(variant)))
      .sort(([, a], [, b]) => ((b.value_sources?.length || 0) * 1000 + (b.ktc_value || 0)) - ((a.value_sources?.length || 0) * 1000 + (a.ktc_value || 0)))[0];
    rank = match?.[1]?.position_rank;
  }

  return rank || null;
}

function getValueProfileValueForMode(
  profile: PlayerDetails['valueProfile'] | undefined,
  leagueValueMode: LeagueValueMode
): number | null {
  if (!profile) return null;
  if (leagueValueMode === 'redraft') {
    return profile.seasonValue ?? profile.fantasyProsSeasonValue ?? profile.dynastyValue ?? null;
  }
  if (leagueValueMode === 'keeper') {
    return profile.balancedValue ?? profile.dynastyValue ?? profile.seasonValue ?? null;
  }
  return profile.dynastyValue ?? profile.balancedValue ?? profile.seasonValue ?? null;
}

function getValueProfileRankForMode(
  profile: PlayerDetails['valueProfile'] | undefined,
  leagueValueMode: LeagueValueMode
): string | null {
  if (!profile) return null;
  if (leagueValueMode === 'redraft') {
    return profile.seasonPositionRank ?? profile.fantasyProsPositionRank ?? profile.dynastyPositionRank ?? null;
  }
  if (leagueValueMode === 'keeper') {
    return profile.balancedPositionRank ?? profile.dynastyPositionRank ?? profile.seasonPositionRank ?? null;
  }
  return profile.dynastyPositionRank ?? profile.balancedPositionRank ?? profile.seasonPositionRank ?? null;
}

function getPlayerValueProfile(
  playerId: string,
  players: Record<string, any>,
  ktcValues: KTCValues,
  rankLookups?: Record<string, Partial<Record<'dynastyPositionRank' | 'seasonPositionRank' | 'contenderPositionRank' | 'rebuilderPositionRank' | 'balancedPositionRank', string>>>
): PlayerDetails['valueProfile'] | undefined {
  const player = players[playerId];
  if (!player) return undefined;

  const key = cleanName(`${player.first_name || ''}${player.last_name || ''}`);
  const variants = Array.from(new Set(playerNameKeyVariants(key)));
  const candidates: Array<{ key: string; data: KTCValues[string]; score: number }> = [];

  for (const variant of variants) {
    if (ktcValues[variant]) {
      const sourceCount = ktcValues[variant].value_sources?.length || 0;
      candidates.push({ key: variant, data: ktcValues[variant], score: sourceCount * 1000 + (ktcValues[variant].ktc_value || 0) });
    }
  }

  for (const [ktcKey, value] of Object.entries(ktcValues)) {
    if (variants.some((variant) => variant.includes(ktcKey) || ktcKey.includes(variant))) {
      const sourceCount = value.value_sources?.length || 0;
      candidates.push({ key: ktcKey, data: value, score: sourceCount * 1000 + (value.ktc_value || 0) });
    }
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  let data = best?.data;
  let dataKey = best?.key || key;

  if (!data) return undefined;

  const dynastyValue = data.dynasty_value ?? data.ktc_value ?? null;
  const seasonValue = data.redraft_value ?? data.true_value ?? data.ktc_value ?? null;
  const contenderValue = dynastyValue && seasonValue
    ? Math.round((seasonValue * 0.6) + (dynastyValue * 0.4))
    : seasonValue ?? dynastyValue;
  const rebuilderValue = dynastyValue && seasonValue
    ? Math.round((dynastyValue * 0.8) + (seasonValue * 0.2))
    : dynastyValue ?? seasonValue;
  const balancedValue = dynastyValue && seasonValue
    ? Math.round((dynastyValue * 0.55) + (seasonValue * 0.45))
    : dynastyValue ?? seasonValue;

  return {
    dynastyValue,
    seasonValue,
    contenderValue,
    rebuilderValue,
    balancedValue,
    dynastyPositionRank: rankLookups?.[dataKey]?.dynastyPositionRank || data.position_rank || null,
    seasonPositionRank: rankLookups?.[dataKey]?.seasonPositionRank || data.fantasypros_position_rank || null,
    contenderPositionRank: rankLookups?.[dataKey]?.contenderPositionRank || null,
    rebuilderPositionRank: rankLookups?.[dataKey]?.rebuilderPositionRank || null,
    balancedPositionRank: rankLookups?.[dataKey]?.balancedPositionRank || data.position_rank || null,
    marketKtc: data.market_value_ktc ?? null,
    flockFantasy: data.expert_value_flock ?? null,
    flockRank: data.flock_rank ?? null,
    flockPositionRank: data.flock_position_rank ?? null,
    flockTier: data.flock_tier ?? null,
    flockFormat: data.flock_format ?? null,
    fantasyCalcDynasty: data.market_value_fantasycalc ?? null,
    fantasyCalcRedraft: data.redraft_value ?? null,
    dynastyProcess: data.expert_value_dynastyprocess ?? null,
    dynastyNerds: data.expert_value_dynastynerds ?? null,
    dynastyNerdsRank: data.dynastynerds_rank ?? null,
    dynastyNerdsPositionRank: data.dynastynerds_position_rank ?? null,
    dynastyNerdsFormat: data.dynastynerds_format ?? null,
    dynastyDealerBenchmark: data.benchmark_value_dynastydealer ?? null,
    dynastyDealerVoteRating: data.dynastydealer_vote_rating ?? null,
    dynastyDealerUpdatedAt: data.dynastydealer_updated_at ?? null,
    fantasyProsRank: data.fantasypros_rank ?? null,
    fantasyProsPositionRank: data.fantasypros_position_rank ?? null,
    fantasyProsTier: data.fantasypros_tier ?? null,
    fantasyProsSeasonValue: data.fantasypros_season_value ?? null,
    sources: data.value_sources || [],
  };
}

function getPlayerValueForLeagueMode(
  playerId: string,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): number {
  const profile = valueProfilesById?.[playerId] || getPlayerValueProfile(playerId, players, ktcValues);
  const modeValue = getValueProfileValueForMode(profile, leagueValueMode);
  if (typeof modeValue === 'number' && Number.isFinite(modeValue)) return modeValue;
  return getPlayerValue(playerId, players, ktcValues);
}

function getPlayerPositionRankForLeagueMode(
  playerId: string,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): string | null {
  const profile = valueProfilesById?.[playerId] || getPlayerValueProfile(playerId, players, ktcValues);
  return getValueProfileRankForMode(profile, leagueValueMode) || getPlayerCurrentPositionRank(playerId, players, ktcValues);
}

function getKtcPosition(data: KTCValues[string]): 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | null {
  const position = data?.position_rank?.match(/^[A-Z]+/)?.[0]
    || data?.flock_position_rank?.match(/^[A-Z]+/)?.[0]
    || data?.dynastynerds_position_rank?.match(/^[A-Z]+/)?.[0]
    || data?.fantasypros_position_rank?.match(/^[A-Z]+/)?.[0]
    || null;
  const normalized = normalizeSeasonLineupPosition(position);
  return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(normalized || '') ? normalized as 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' : null;
}

function buildValueProfileRankLookups(
  ktcValues: KTCValues
): Record<string, Partial<Record<'dynastyPositionRank' | 'seasonPositionRank' | 'contenderPositionRank' | 'rebuilderPositionRank' | 'balancedPositionRank', string>>> {
  type LensKey = 'dynastyPositionRank' | 'seasonPositionRank' | 'contenderPositionRank' | 'rebuilderPositionRank' | 'balancedPositionRank';
  const lensValues: Record<LensKey, Array<{ key: string; position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'; value: number }>> = {
    dynastyPositionRank: [],
    seasonPositionRank: [],
    contenderPositionRank: [],
    rebuilderPositionRank: [],
    balancedPositionRank: [],
  };

  for (const [key, data] of Object.entries(ktcValues)) {
    const position = getKtcPosition(data);
    if (!position) continue;
    const dynastyValue = data.dynasty_value ?? data.ktc_value ?? null;
    const seasonValue = data.redraft_value ?? data.true_value ?? data.ktc_value ?? null;
    const contenderValue = dynastyValue && seasonValue
      ? Math.round((seasonValue * 0.6) + (dynastyValue * 0.4))
      : seasonValue ?? dynastyValue;
    const rebuilderValue = dynastyValue && seasonValue
      ? Math.round((dynastyValue * 0.8) + (seasonValue * 0.2))
      : dynastyValue ?? seasonValue;
    const balancedValue = dynastyValue && seasonValue
      ? Math.round((dynastyValue * 0.55) + (seasonValue * 0.45))
      : dynastyValue ?? seasonValue;
    const values: Record<LensKey, number | null | undefined> = {
      dynastyPositionRank: dynastyValue,
      seasonPositionRank: seasonValue,
      contenderPositionRank: contenderValue,
      rebuilderPositionRank: rebuilderValue,
      balancedPositionRank: balancedValue,
    };

    for (const lens of Object.keys(values) as LensKey[]) {
      const value = values[lens];
      if (value && value > 0) lensValues[lens].push({ key, position, value });
    }
  }

  const ranks: Record<string, Partial<Record<LensKey, string>>> = {};
  for (const [lens, rows] of Object.entries(lensValues) as Array<[LensKey, typeof lensValues[LensKey]]>) {
    for (const position of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const) {
      rows
        .filter((row) => row.position === position)
        .sort((a, b) => b.value - a.value)
        .forEach((row, index) => {
          ranks[row.key] = {
            ...ranks[row.key],
            [lens]: `${position}${index + 1}`,
          };
        });
    }
  }

  return ranks;
}

function buildCurrentPositionRankMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues
): Record<string, string | null> {
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean))).map((playerId) => [
      playerId,
      getPlayerCurrentPositionRank(playerId, players, ktcValues),
    ])
  );
}

function buildPrimaryPositionRankMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues,
  valueProfilesById: Record<string, PlayerDetails['valueProfile']>,
  leagueValueMode: LeagueValueMode
): Record<string, string | null> {
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean))).map((playerId) => {
      const rank = getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
      return [playerId, rank || null];
    })
  );
}

function buildPlayerValueProfileMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues
): Record<string, PlayerDetails['valueProfile']> {
  const rankLookups = buildValueProfileRankLookups(ktcValues);
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean)))
      .map((playerId) => [playerId, getPlayerValueProfile(playerId, players, ktcValues, rankLookups)])
      .filter((entry): entry is [string, NonNullable<PlayerDetails['valueProfile']>] => Boolean(entry[1]))
  );
}

function buildSimilarTradeValueMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): Record<string, NonNullable<PlayerDetails['similarTradeValues']>> {
  const requestedPlayerIds = Array.from(new Set(Array.from(playerIds).filter(Boolean)));
  const candidateIds = Array.from(new Set([
    ...requestedPlayerIds,
    ...Object.keys(players).filter((playerId) => {
      const player = players[playerId];
      return isCurrentFantasySkillPlayer(player)
        && ['Active', 'Inactive', null, undefined].includes(player?.status);
    }),
  ]));
  const candidates = candidateIds
    .map((playerId) => {
      const player = players[playerId];
      const position = player?.position;
      const value = getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
      if (!['QB', 'RB', 'WR', 'TE'].includes(position) || value <= 0) return null;
      return {
        playerId,
        name: getPlayerName(playerId, players),
        position,
        team: player.team || null,
        rank: getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById),
        value,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const rankNumber = (rank?: string | null) => {
    const value = Number(String(rank || '').match(/\d+/)?.[0]);
    return Number.isFinite(value) ? value : null;
  };

  return Object.fromEntries(
    candidates
      .filter((player) => requestedPlayerIds.includes(player.playerId))
      .map((player) => {
    const currentRankNumber = rankNumber(player.rank);
    const samePositionPeer = currentRankNumber
      ? candidates
        .filter((candidate) => candidate.playerId !== player.playerId && candidate.position === player.position && rankNumber(candidate.rank))
        .sort((a, b) => {
          const aRankDiff = Math.abs((rankNumber(a.rank) || 999) - currentRankNumber);
          const bRankDiff = Math.abs((rankNumber(b.rank) || 999) - currentRankNumber);
          return aRankDiff - bRankDiff || Math.abs(a.value - player.value) - Math.abs(b.value - player.value);
        })[0]
      : null;
    const crossPositionPeers = (['QB', 'RB', 'WR', 'TE'] as const)
      .filter((position) => position !== player.position)
      .map((position) => candidates
        .filter((candidate) => candidate.playerId !== player.playerId && candidate.position === position)
        .sort((a, b) => Math.abs(a.value - player.value) - Math.abs(b.value - player.value))[0])
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.value - player.value) - Math.abs(b.value - player.value));
    const peers = [samePositionPeer, ...crossPositionPeers]
      .filter((peer): peer is NonNullable<typeof samePositionPeer> => Boolean(peer))
      .slice(0, 4)
      .map((peer) => ({
        playerId: peer.playerId,
        name: peer.name,
        position: peer.position,
        team: peer.team,
        rank: peer.rank,
        value: peer.value,
        difference: peer.value - player.value,
        label: peer.position === player.position ? `Nearest ${peer.position}` : `Near ${peer.position}`,
      }));

    return [player.playerId, peers];
  }));
}

function buildLatestNewsByPlayerId(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  newsItems: Awaited<ReturnType<typeof fetchFantasyProsNews>>
): Record<string, NonNullable<PlayerDetails['latestNews']>> {
  const requestedIds = Array.from(new Set(Array.from(playerIds).filter(Boolean)));
  const entries: Array<[string, NonNullable<PlayerDetails['latestNews']>]> = [];

  for (const playerId of requestedIds) {
    const player = players[playerId];
    if (!player) continue;
    const fullName = getPlayerName(playerId, players);
    const matched = findLatestFantasyProsNewsForPlayer(fullName, newsItems);
    if (!matched) continue;
    entries.push([playerId, {
      title: matched.title,
      summary: matched.summary || null,
      source: matched.source || 'FantasyPros',
      url: matched.url || null,
      publishedAt: matched.publishedAt || null,
    }]);
  }

  return Object.fromEntries(entries);
}

async function fetchTrendingPlayers(
  type: 'add' | 'drop',
  players: Record<string, any>,
  ktcValues: KTCValues,
  ownerByPlayerId: Record<string, string>,
  rosterStatusByPlayerId: Record<string, string> = {},
  leagueValueMode: LeagueValueMode = 'dynasty',
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): Promise<TrendingPlayer[]> {
  const trending = await fetch(
    `https://api.sleeper.app/v1/players/nfl/trending/${type}?lookback_hours=168&limit=15`
  ).then((r) => r.json());

  if (!Array.isArray(trending)) return [];

  return trending.map((item: any) => {
    const playerId = String(item.player_id);
    const player = players[playerId];
    return {
      player_id: playerId,
      name: getPlayerName(playerId, players),
      playerDetails: getPlayerDetails(playerId, player, rosterStatusByPlayerId[playerId]),
      currentPositionRank: getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById),
      pos: player?.position || 'N/A',
      team: player?.team || null,
      owner: ownerByPlayerId[playerId] || null,
      count: item.count || 0,
      ktcValue: getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById) || null,
    };
  });
}

function buildPickPortfolios(
  managers: string[],
  draftPicks: Array<{
    manager: string;
    originalOwner?: string | null;
    draftYear?: string;
    currentKtcValue?: number | null;
    ktcValue?: number | null;
    draftSlot?: number;
    pick?: number;
  }>,
  futurePicks: Array<{
    manager: string;
    originalOwner: string;
    season: string;
    round: number;
    value: number;
  }> = []
): PickPortfolio[] {
  return managers.map((manager) => {
    const picks = draftPicks.filter((pick) => pick.manager === manager);
    const future = futurePicks.filter((pick) => pick.manager === manager);
    const picksForYear = (year: string) => picks.filter((pick) => String(pick.draftYear || '') === year);
    const futureForYear = (year: string) => future.filter((pick) => String(pick.season || '') === year);
    const valueForYear = (year: string) => picks
      .filter((pick) => String(pick.draftYear || '') === year)
      .reduce((sum, pick) => sum + (pick.currentKtcValue || pick.ktcValue || 0), 0);
    const futureValueForYear = (year: string) => future
      .filter((pick) => String(pick.season || '') === year)
      .reduce((sum, pick) => sum + pick.value, 0);
    const completedPickValue = picks.reduce((sum, pick) => sum + (pick.currentKtcValue || pick.ktcValue || 0), 0);
    const futurePickValue = future.reduce((sum, pick) => sum + pick.value, 0);
    const totalValue = completedPickValue + futurePickValue;
    const ownPicks = future.filter((pick) => pick.originalOwner === manager).length;
    const acquiredPicks = future.length - ownPicks;
    const projectedSlots = picks
      .filter((pick) => pick.draftYear && (pick.draftSlot || pick.pick))
      .map((pick) => `${pick.draftYear} #${pick.pick || pick.draftSlot}`)
      .slice(0, 6);

    return {
      manager,
      value2025: valueForYear('2025'),
      value2026: valueForYear('2026') + futureValueForYear('2026'),
      value2027: valueForYear('2027') + futureValueForYear('2027'),
      count2025: picksForYear('2025').length,
      count2026: picksForYear('2026').length + futureForYear('2026').length,
      count2027: picksForYear('2027').length + futureForYear('2027').length,
      totalValue,
      ownPicks,
      acquiredPicks,
      projectedSlots,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);
}

function buildFuturePickInventory({
  rosters,
  rosterMap,
  tradedPicks,
  ktcValues,
  draftRounds,
  seasons,
  draftSlotsBySeason,
  totalTeams,
}: {
  rosters: Array<{ roster_id: number }>;
  rosterMap: Record<number, string>;
  tradedPicks: Array<{ season: string; round: number; roster_id: number; owner_id: number }>;
  ktcValues: KTCValues;
  draftRounds: number;
  seasons: string[];
  draftSlotsBySeason?: Record<string, Record<number, number>>;
  totalTeams?: number;
}) {
  const pickOwners = new Map<string, { originalRosterId: number; ownerRosterId: number; season: string; round: number }>();

  for (const season of seasons) {
    for (const roster of rosters) {
      for (let round = 1; round <= draftRounds; round += 1) {
        const key = `${season}-${round}-${roster.roster_id}`;
        pickOwners.set(key, {
          originalRosterId: roster.roster_id,
          ownerRosterId: roster.roster_id,
          season,
          round,
        });
      }
    }
  }

  for (const pick of tradedPicks) {
    const season = String(pick.season);
    if (!seasons.includes(season) || pick.round > draftRounds) continue;
    const key = `${season}-${pick.round}-${pick.roster_id}`;
    pickOwners.set(key, {
      originalRosterId: Number(pick.roster_id),
      ownerRosterId: Number(pick.owner_id),
      season,
      round: Number(pick.round),
    });
  }

  return Array.from(pickOwners.values())
    .map((pick) => {
      const manager = rosterMap[pick.ownerRosterId];
      const originalOwner = rosterMap[pick.originalRosterId];
      if (!manager || !originalOwner) return null;

      return {
        manager,
        originalOwner,
        season: pick.season,
        round: pick.round,
        value: getPickValue(
          Number(pick.season),
          pick.round,
          ktcValues,
          draftSlotsBySeason?.[pick.season]?.[pick.originalRosterId],
          totalTeams
        ),
      };
    })
    .filter((pick): pick is { manager: string; originalOwner: string; season: string; round: number; value: number } => Boolean(pick));
}

function buildWaiverIntelligence(
  trendingAdds: TrendingPlayer[],
  trendingDrops: TrendingPlayer[],
  players: Record<string, any>,
  ktcValues: KTCValues,
  ownerByPlayerId: Record<string, string>,
  rosterStatusByPlayerId: Record<string, string> = {},
  leagueValueMode: LeagueValueMode = 'dynasty',
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): WaiverIntelligence {
  const availableAdds = trendingAdds.filter((player) => !player.owner);
  const rosteredAdds = trendingAdds.filter((player) => player.owner);
  const sortedAvailableAdds = [...availableAdds].sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0));
  const availablePlayerPool = Object.entries(players)
    .filter(([playerId, player]) => {
      if (!playerId || ownerByPlayerId[playerId]) return false;
      if (!isCurrentSeasonLineupPlayer(player)) return false;
      const value = getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
      const rank = getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
      const position = normalizeSeasonLineupPosition(player?.position);
      return value > 0 || Boolean(rank && (position === 'K' || position === 'DEF'));
    })
    .map(([playerId, player]) => ({
      player_id: playerId,
      name: getPlayerName(playerId, players),
      playerDetails: getPlayerDetails(playerId, player, rosterStatusByPlayerId[playerId]),
      currentPositionRank: getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById),
      pos: normalizeSeasonLineupPosition(player?.position) || player?.position || 'N/A',
      team: player?.team || null,
      owner: null,
      count: 0,
      ktcValue: getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById) || null,
    }))
    .sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0));
  const usedPlayerIds = new Set<string>();

  const takeBestUnique = (players: TrendingPlayer[]) => {
    const next = players.find((player) => !usedPlayerIds.has(player.player_id)) || null;
    if (next) usedPlayerIds.add(next.player_id);
    return next;
  };

  const highestKtcAvailable = takeBestUnique(availablePlayerPool.length ? availablePlayerPool : sortedAvailableAdds);
  const bestAvailableByPosition = {
    QB: takeBestUnique((availablePlayerPool.length ? availablePlayerPool : sortedAvailableAdds).filter((player) => player.pos === 'QB')),
    RB: takeBestUnique((availablePlayerPool.length ? availablePlayerPool : sortedAvailableAdds).filter((player) => player.pos === 'RB')),
    WR: takeBestUnique((availablePlayerPool.length ? availablePlayerPool : sortedAvailableAdds).filter((player) => player.pos === 'WR')),
    TE: takeBestUnique((availablePlayerPool.length ? availablePlayerPool : sortedAvailableAdds).filter((player) => player.pos === 'TE')),
    K: takeBestUnique((availablePlayerPool.length ? availablePlayerPool : sortedAvailableAdds).filter((player) => player.pos === 'K')),
    DEF: takeBestUnique((availablePlayerPool.length ? availablePlayerPool : sortedAvailableAdds).filter((player) => player.pos === 'DEF')),
  };
  const bestTaxiStashes = (availablePlayerPool.length ? availablePlayerPool : sortedAvailableAdds)
    .filter((player) => {
      const rookieYear = Number(player.playerDetails?.rookieYear || 0);
      return rookieYear === new Date().getFullYear() && !usedPlayerIds.has(player.player_id);
    })
    .slice(0, 3);

  return {
    rosteredTrendingAdds: rosteredAdds,
    availableTrendingAdds: availableAdds,
    highestKtcAvailable,
    bestAvailableByPosition,
    bestTaxiStashes,
    recentlyDroppedValuable: [...trendingDrops]
      .filter((player) => (player.ktcValue || 0) > 0)
      .sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0))
      .slice(0, 8),
  };
}

function buildRecentTransactionPlayer(
  playerId: string | null | undefined,
  players: Record<string, any>,
  ktcValues: KTCValues,
  rosterStatusByPlayerId: Record<string, string> = {},
  leagueValueMode: LeagueValueMode = 'dynasty',
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): RecentTransactionPlayer | null {
  if (!playerId || !players[playerId]) return null;
  const player = players[playerId];
  return {
    player_id: playerId,
    name: getPlayerName(playerId, players),
    playerDetails: getPlayerDetails(playerId, player, rosterStatusByPlayerId[playerId]),
    currentPositionRank: getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById),
    pos: player?.position || 'N/A',
    team: player?.team || null,
    ktcValue: getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById) || null,
  };
}

function buildRecentTransactions(
  transactions: any[],
  rosterUserMap: Record<string, string>,
  players: Record<string, any>,
  ktcValues: KTCValues,
  rosterStatusByPlayerId: Record<string, string> = {},
  managerIntelByName: Map<string, any> = new Map(),
  currentSeason: string,
  leagueValueMode: LeagueValueMode = 'dynasty',
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): RecentTransaction[] {
  const currentSeasonNumber = Number(currentSeason || new Date().getFullYear());

  return [...transactions]
    .filter((transaction) => transaction?.status === 'complete' && ['waiver', 'free_agent'].includes(transaction?.type))
    .sort((a, b) => Number(b?.status_updated || 0) - Number(a?.status_updated || 0))
    .slice(0, 16)
    .map((transaction) => {
      const manager = rosterUserMap[String(transaction.roster_ids?.[0] ?? transaction.roster_id ?? '')] || 'Unknown';
      const addedPlayerId = Object.keys(transaction.adds || {})[0] || null;
      const droppedPlayerId = Object.keys(transaction.drops || {})[0] || null;
      const addedPlayer = buildRecentTransactionPlayer(addedPlayerId, players, ktcValues, rosterStatusByPlayerId, leagueValueMode, valueProfilesById);
      const droppedPlayer = buildRecentTransactionPlayer(droppedPlayerId, players, ktcValues, rosterStatusByPlayerId, leagueValueMode, valueProfilesById);
      const bidAmount = Number(
        transaction.settings?.waiver_bid ??
        transaction.settings?.bid ??
        transaction.waiver_bid ??
        transaction.metadata?.waiver_bid ??
        0
      ) || null;
      const intel = managerIntelByName.get(manager);
      const droppedIsCurrentRookie = Number(droppedPlayer?.playerDetails?.rookieYear || 0) === currentSeasonNumber;
      const alternativeDrop = droppedPlayer && !droppedIsCurrentRookie
        ? (intel?.droppablePlayers || [])
            .filter((candidate: any) => candidate?.player_id && candidate.player_id !== droppedPlayerId)
            .filter((candidate: any) => candidate.playerDetails?.rosterStatus !== 'Taxi')
            .filter((candidate: any) => {
              const candidateIsRookie = Number(candidate.playerDetails?.rookieYear || 0) === currentSeasonNumber;
              return candidateIsRookie === droppedIsCurrentRookie;
            })
            .sort((a: any, b: any) => (a.value || 0) - (b.value || 0))[0] || null
        : null;

      let note = `${transaction.type === 'waiver' ? 'Winning claim' : 'Free-agent add'} logged.`;
      if (droppedPlayer && addedPlayer) {
        const addValue = addedPlayer.ktcValue || 0;
        const dropValue = droppedPlayer.ktcValue || 0;
        if (!droppedIsCurrentRookie && alternativeDrop && (alternativeDrop.value || 0) + 250 < dropValue) {
          note = `Reasonable add, but ${manager} probably should have cut ${alternativeDrop.name} instead of ${droppedPlayer.name}.`;
        } else if (!droppedIsCurrentRookie && dropValue > addValue + 500) {
          note = `${manager} cut more dynasty value than came back. This is a shaky churn move.`;
        } else if (droppedIsCurrentRookie) {
          note = 'Rookie-slot context can distort bench math, so no alternate-cut judgment here.';
        } else {
          note = 'This is a normal churn move unless the roster needed the dropped player type.';
        }
      } else if (addedPlayer && !droppedPlayer) {
        note = transaction.type === 'waiver'
          ? 'Clean claim with no obvious cut cost logged in the public feed.'
          : 'Clean add with no drop attached in the public feed.';
      }

      return {
        id: String(transaction.transaction_id || `${transaction.status_updated}-${manager}-${addedPlayerId || 'none'}`),
        date: new Date(Number(transaction.status_updated || Date.now())).toISOString(),
        manager,
        type: transaction.type === 'waiver' ? 'Waiver' : 'Free Agent',
        bidAmount,
        addedPlayer,
        droppedPlayer,
        alternativeDrop: alternativeDrop
          ? {
              player_id: alternativeDrop.player_id,
              name: alternativeDrop.name,
              playerDetails: alternativeDrop.playerDetails,
              currentPositionRank: alternativeDrop.currentPositionRank,
              pos: alternativeDrop.pos,
              team: alternativeDrop.playerDetails?.team || null,
              ktcValue: alternativeDrop.value || null,
            }
          : null,
        note,
        losingBidsAvailable: false,
      };
    });
}

function getScoringFamily(scoringSettings: Record<string, any> | undefined): 'std' | 'half_ppr' | 'ppr' | 'custom' {
  const rec = Number(scoringSettings?.rec ?? 0);
  if (rec === 1) return 'ppr';
  if (rec === 0.5) return 'half_ppr';
  if (rec === 0) return 'std';
  return 'custom';
}

function calculateFantasyPointsFromScoring(stats: Record<string, any>, scoringSettings: Record<string, any> | undefined): number {
  return Object.entries(scoringSettings || {}).reduce((sum, [key, scoringValue]) => {
    const statValue = Number(stats[key] ?? 0);
    const multiplier = Number(scoringValue ?? 0);
    if (!Number.isFinite(statValue) || !Number.isFinite(multiplier)) return sum;
    return sum + statValue * multiplier;
  }, 0);
}

async function fetchLastSeasonPositionRanks(
  playerIds: string[],
  players: Record<string, any>,
  scoringSettings: Record<string, any> | undefined,
  season: string
): Promise<Record<string, LastSeasonPlayerRank>> {
  const uniquePlayerIds = Array.from(new Set(playerIds))
    .filter((playerId) => ['QB', 'RB', 'WR', 'TE'].includes(players[playerId]?.position));
  const scoringFamily = getScoringFamily(scoringSettings);
  const fantasyProsScoring = scoringFamily === 'ppr' ? 'PPR' : scoringFamily === 'std' ? 'STD' : 'HALF';
  const fantasyProsPoints = await fetchFantasyProsPlayerPoints(season, fantasyProsScoring);
  const scoredPlayers: Array<{
    playerId: string;
    position: string;
    points: number;
    games?: number | null;
    pointsPerGame?: number | null;
    providedPositionRank?: number | null;
  }> = [];

  for (let index = 0; index < uniquePlayerIds.length; index += 25) {
    const batch = uniquePlayerIds.slice(index, index + 25);
    const results = await Promise.all(batch.map(async (playerId) => {
      try {
        const response = await fetch(
          `https://api.sleeper.com/stats/nfl/player/${playerId}?season_type=regular&season=${season}&grouping=season`
        );
        if (!response.ok) return null;
        const payload = await response.json();
        const stats = payload?.stats || payload;
        if (!stats || typeof stats !== 'object') return null;

        const position = players[playerId]?.position;
        const nameKey = cleanName(`${players[playerId]?.first_name || ''}${players[playerId]?.last_name || ''}`);
        const fpPoints = fantasyProsPoints[nameKey];
        const providedPositionRank = Number(stats[`pos_rank_${scoringFamily}`] ?? stats.pos_rank_half_ppr ?? stats.pos_rank_ppr ?? stats.pos_rank_std);
        const providedPoints = Number(stats[`pts_${scoringFamily}`] ?? stats.pts_half_ppr ?? stats.pts_ppr ?? stats.pts_std);
        const points = scoringFamily === 'custom'
          ? calculateFantasyPointsFromScoring(stats, scoringSettings)
          : providedPoints;

        if (!position || !Number.isFinite(points) || points <= 0) return null;
        return {
          playerId,
          position,
          points,
          games: fpPoints?.games ?? null,
          pointsPerGame: fpPoints?.average ?? null,
          providedPositionRank: Number.isFinite(providedPositionRank) ? providedPositionRank : null,
        };
      } catch (error) {
        return null;
      }
    }));

    scoredPlayers.push(...results.filter((result): result is NonNullable<typeof result> => Boolean(result)));
  }

  const ranks: Record<string, LastSeasonPlayerRank> = {};
  for (const position of ['QB', 'RB', 'WR', 'TE']) {
    const positionPlayers = scoredPlayers
      .filter((player) => player.position === position)
      .sort((a, b) => b.points - a.points);

    positionPlayers.forEach((player, index) => {
      const rank = scoringFamily === 'custom'
        ? index + 1
        : player.providedPositionRank || index + 1;
      ranks[player.playerId] = {
        positionRank: `${position}${rank}`,
        fantasyPoints: Math.round(player.points * 10) / 10,
        games: player.games ?? null,
        pointsPerGame: player.pointsPerGame ?? null,
        season,
      };
    });
  }

  return ranks;
}

async function fetchDraftSlotsBySeason(
  leagueId: string,
  rosters: Array<{ roster_id: number; owner_id: string }>
): Promise<Record<string, Record<number, number>>> {
  const drafts = await fetch(
    `https://api.sleeper.app/v1/league/${leagueId}/drafts`
  ).then((r) => r.json());

  if (!Array.isArray(drafts)) return {};

  const rosterByOwnerId = Object.fromEntries(
    rosters.map((roster) => [roster.owner_id, roster.roster_id])
  );
  const slotsBySeason: Record<string, Record<number, number>> = {};

  for (const draft of drafts) {
    if (!draft?.season || !draft?.draft_order) continue;

    const season = String(draft.season);
    if (!slotsBySeason[season]) slotsBySeason[season] = {};

    for (const [ownerId, draftSlot] of Object.entries(draft.draft_order)) {
      const rosterId = rosterByOwnerId[ownerId];
      if (rosterId && typeof draftSlot === 'number') {
        slotsBySeason[season][rosterId] = draftSlot;
      }
    }
  }

  return slotsBySeason;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  league: router({
    getUserLeagues: publicProcedure
      .input(z.object({ username: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const username = input.username.trim();
        if (!username) throw new Error('Please enter a Sleeper username');
        const ipAddress = getClientIp(ctx.req as any);
        const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"] : null;

        try {
          const userResponse = await fetch(
            `https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`
          );
          if (!userResponse.ok) {
            await insertLoginAttempt({
              eventType: "find_leagues",
              status: "error",
              username,
              ipAddress,
              userAgent,
              note: "Sleeper user not found",
            });
            throw new Error('Sleeper user not found');
          }

          const user = await userResponse.json();
          if (!user?.user_id) {
            await insertLoginAttempt({
              eventType: "find_leagues",
              status: "error",
              username,
              ipAddress,
              userAgent,
              note: "Sleeper response missing user_id",
            });
            throw new Error('Sleeper user not found');
          }

          const currentSeason = String(new Date().getFullYear());
          const seenLeagueIds = new Set<string>();
          const leagues = [];

          const leaguesResponse = await fetch(
            `https://api.sleeper.app/v1/user/${user.user_id}/leagues/nfl/${currentSeason}`
          );
          const seasonLeagues = leaguesResponse.ok ? await leaguesResponse.json() : [];

          const players = Array.isArray(seasonLeagues) && seasonLeagues.length > 0
            ? await fetch("https://api.sleeper.app/v1/players/nfl").then((r) => r.json())
            : {};
          const leagueValueCache = new Map<string, Promise<KTCValues>>();
          const getLeagueValues = (leagueInfo: any): Promise<KTCValues> => {
            if (!Array.isArray(seasonLeagues) || seasonLeagues.length === 0) return Promise.resolve({});
            const options = getLeagueValueBlendOptions(leagueInfo);
            const key = getValueSourceProfileKey(options);
            if (!leagueValueCache.has(key)) {
              leagueValueCache.set(key, loadBlendedKTCValues(options));
            }
            return leagueValueCache.get(key)!;
          };

          if (Array.isArray(seasonLeagues)) {
            const enrichedLeagues = await Promise.all(seasonLeagues.map(async (leagueInfo: any) => {
              const leagueId = String(leagueInfo?.league_id || '');
              if (!leagueId || seenLeagueIds.has(leagueId)) return null;
              seenLeagueIds.add(leagueId);

              const [rosters, users] = await Promise.all([
                fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
                fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/users`),
              ]);

              const safeRosters = Array.isArray(rosters) ? rosters : [];
              const safeUsers = Array.isArray(users) ? users : [];
              const rosterUserMap = Object.fromEntries(
                safeRosters.map((roster: any) => [
                  roster.roster_id,
                  normalizeManagerName(
                    safeUsers.find((user: any) => user.user_id === roster.owner_id)?.display_name
                  ),
                ])
              );
              const currentStandings = buildCurrentStandings(safeRosters, rosterUserMap);
              const leagueValueMode = getLeagueValueMode(leagueInfo);
              const ktcValues = await getLeagueValues(leagueInfo);
              const powerRankings = buildLeagueRosterValueRankings(safeRosters, players, ktcValues, leagueValueMode);
              const viewerManagerName = normalizeManagerName(user.display_name || user.username || username);
              const viewerRoster = safeRosters.find((roster: any) => String(roster.owner_id) === String(user.user_id));
              const viewerRosterId = Number(viewerRoster?.roster_id);
              const standingsRank = currentStandings.find((row) => row.manager === viewerManagerName)?.rank ?? null;
              const powerRank = powerRankings.find((row) => row.rosterId === viewerRosterId)?.rank ?? null;

              return toSleeperLeagueOption(leagueInfo, currentSeason, {
                standingsRank,
                powerRank,
              });
            }));

            leagues.push(...enrichedLeagues.filter((league): league is SleeperLeagueOption => Boolean(league)));
          }

          await insertLoginAttempt({
            eventType: "find_leagues",
            status: "success",
            username,
            ipAddress,
            userAgent,
            note: `${leagues.length} current-season leagues found`,
          });

          return {
            user: {
              userId: String(user.user_id),
              username: user.username || username,
              displayName: user.display_name || user.username || username,
              avatarUrl: getSleeperAvatarUrl(user.avatar),
            },
            leagues: leagues.sort((a, b) => Number(b.season) - Number(a.season) || a.name.localeCompare(b.name)),
          };
        } catch (error) {
          if (!(error instanceof Error && error.message === 'Sleeper user not found')) {
            await insertLoginAttempt({
              eventType: "find_leagues",
              status: "error",
              username,
              ipAddress,
              userAgent,
              note: error instanceof Error ? error.message : "Unknown error",
            });
          }
          throw error;
        }
      }),

    analyze: publicProcedure
      .input(z.object({ leagueId: z.string(), viewerUserId: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const ipAddress = getClientIp(ctx.req as any);
        const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"] : null;
        try {
          const leagueInfo = await fetch(
            `https://api.sleeper.app/v1/league/${input.leagueId}`
          ).then((r) => r.json());

          if (!leagueInfo.league_id) {
            await insertLoginAttempt({
              eventType: "analyze_league",
              status: "error",
              leagueId: input.leagueId,
              ipAddress,
              userAgent,
              note: "Invalid league ID",
            });
            throw new Error('Invalid league ID');
          }

          await insertLoginAttempt({
            eventType: "analyze_league",
            status: "success",
            leagueId: input.leagueId,
            ipAddress,
            userAgent,
            note: leagueInfo.name || null,
          });

          const users = await fetch(
            `https://api.sleeper.app/v1/league/${input.leagueId}/users`
          ).then((r) => r.json());

          const rosters = await fetch(
            `https://api.sleeper.app/v1/league/${input.leagueId}/rosters`
          ).then((r) => r.json());

          const userMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, u])
          );
          const rosterUserMap = Object.fromEntries(
            rosters.map((r: any) => [
              r.roster_id,
              normalizeManagerName(userMap[r.owner_id]?.display_name),
            ])
          );
          const rosterUserDisplayMap = Object.fromEntries(
            rosters.map((r: any) => [
              r.roster_id,
              getManagerDisplayName(userMap[r.owner_id]?.display_name),
            ])
          );
          const ownerByPlayerId = buildPlayerOwnerMap(rosters, rosterUserMap);
          const rosterStatusByPlayerId = buildPlayerRosterStatusMap(rosters);

          const allTransactions: any[] = [];
          const trades: any[] = [];
          for (let week = 1; week <= 18; week++) {
            const weekTrades = await fetch(
              `https://api.sleeper.app/v1/league/${input.leagueId}/transactions/${week}`
            ).then((r) => r.json());
            if (Array.isArray(weekTrades)) {
              allTransactions.push(...weekTrades);
              trades.push(
                ...weekTrades.filter(
                  (t: any) => t.type === 'trade' && t.status === 'complete'
                )
              );
            }
          }

          const players = await fetch(
            'https://api.sleeper.app/v1/players/nfl'
          ).then((r) => r.json());

          const leagueValueOptions = getLeagueValueBlendOptions(leagueInfo);
          const leagueValueProfileKey = getLeagueValueProfileKey(leagueInfo);
          const leagueValueProfileLabel = getValueSourceProfileLabel(leagueValueOptions);
          const ktcValues = await loadBlendedKTCValues(leagueValueOptions);
          // Get the latest KTC snapshot from at least 7 days ago for weekly value-change calculations.
          const ktcValuesLastWeekRaw = await getKtcSnapshotFromDaysAgo(7, leagueValueProfileKey);
          let ktcValuesLastWeek: KTCValues = {};
          
          if (ktcValuesLastWeekRaw && Object.keys(ktcValuesLastWeekRaw).length > 0) {
            ktcValuesLastWeek = ktcValuesLastWeekRaw;
          } else {
            ktcValuesLastWeek = loadLatestLocalKtcSnapshotDaysAgo(7, leagueValueProfileKey);
            if (Object.keys(ktcValuesLastWeek).length === 0) {
              ktcValuesLastWeek = await loadKTCValuesLastWeek();
            }
          }

          const prevLeagueId = leagueInfo.previous_league_id;
          let pastSeasonData = null;
          let pastRosterDisplayMap: Record<string, string> = {};
          let draftSlotsBySeason = await fetchDraftSlotsBySeason(input.leagueId, rosters);

          if (prevLeagueId) {
            try {
              const pastLeagueInfo = await fetch(
                `https://api.sleeper.app/v1/league/${prevLeagueId}`
              ).then((r) => r.json());
              const pastUsers = await fetch(
                `https://api.sleeper.app/v1/league/${prevLeagueId}/users`
              ).then((r) => r.json());
              const pastRosters = await fetch(
                `https://api.sleeper.app/v1/league/${prevLeagueId}/rosters`
              ).then((r) => r.json());
              const pastUserMap = Object.fromEntries(
                pastUsers.map((u: any) => [u.user_id, u])
              );
              const pastRosterUserMap = Object.fromEntries(
                pastRosters.map((r: any) => [
                  r.roster_id,
                  normalizeManagerName(pastUserMap[r.owner_id]?.display_name),
                ])
              );
              const pastRosterUserDisplayMap = Object.fromEntries(
                pastRosters.map((r: any) => [
                  r.roster_id,
                  getManagerDisplayName(pastUserMap[r.owner_id]?.display_name),
                ])
              );
              pastRosterDisplayMap = pastRosterUserDisplayMap;
              // Fetch trades from previous season
              const pastTrades: any[] = [];
              for (let week = 1; week <= 18; week++) {
                const weekTrades = await fetch(
                  `https://api.sleeper.app/v1/league/${prevLeagueId}/transactions/${week}`
                ).then((r) => r.json());
                if (weekTrades) {
                  pastTrades.push(
                    ...weekTrades.filter(
                      (t: any) => t.type === "trade" && t.status === "complete"
                    )
                  );
                }
              }

              const pastDraftSlotsBySeason = await fetchDraftSlotsBySeason(prevLeagueId, pastRosters);
              draftSlotsBySeason = {
                ...pastDraftSlotsBySeason,
                ...draftSlotsBySeason,
              };

              pastSeasonData = {
                label: '2025',
                trades: pastTrades,
                rosterMap: pastRosterUserMap,
                rosters: pastRosters,
                draftSlotsBySeason,
                rosterPositions: Array.isArray(pastLeagueInfo.roster_positions) ? pastLeagueInfo.roster_positions : [],
              };
            } catch (e) {
              console.warn('Failed to fetch past season data:', e);
            }
          }

          // Create user_id to manager name map for draft analysis
          const userIdToManagerMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, normalizeManagerName(u.display_name)])
          );
          const userIdToManagerDisplayMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, getManagerDisplayName(u.display_name)])
          );
          const managerDisplayNameByManager = Object.fromEntries(
            users.map((u: any) => [normalizeManagerName(u.display_name), getManagerDisplayName(u.display_name)])
          );
          const viewerManager = input.viewerUserId ? userIdToManagerMap[input.viewerUserId] || null : null;
          const currentStandings = buildCurrentStandings(rosters, rosterUserMap);

          const currentSeasonData = {
            label: '2026',
            trades,
            rosterMap: rosterUserMap,
            rosters,
            draftSlotsBySeason,
            rosterPositions: Array.isArray(leagueInfo.roster_positions) ? leagueInfo.roster_positions : [],
            scoringSettings: leagueInfo.scoring_settings || {},
            valueBlendProfileKey: leagueValueProfileKey,
            valueBlendProfileLabel: leagueValueProfileLabel,
          };
          const lastCompletedSeason = String(Number(currentSeasonData.label) - 1);
          let lastSeasonPositionRanks: Record<string, LastSeasonPlayerRank> = {};
          try {
            lastSeasonPositionRanks = await fetchLastSeasonPositionRanks(
              rosters.flatMap((roster: any) => roster.players || []),
              players,
              leagueInfo.scoring_settings,
              lastCompletedSeason
            );
          } catch (error) {
            console.warn('Failed to fetch last season player stats:', error);
          }

          const leagueValueMode = getLeagueValueMode(leagueInfo);
          const allValueProfilesById = buildPlayerValueProfileMap(Object.keys(players), players, ktcValues);
          const reportData = await generateReport(
            currentSeasonData,
            pastSeasonData,
            players,
            ktcValues,
            ktcValuesLastWeek,
            lastSeasonPositionRanks,
            { leagueValueMode }
          );

          // currentUserMap is the same as userIdToManagerMap, so we can reuse it
          const currentUserMap = userIdToManagerMap;
          let pastUserMap: Record<string, string> = {};
          let pastUserDisplayMap: Record<string, string> = {};
          const pastManagerDisplayNameByManager: Record<string, string> = {};
          if (pastSeasonData) {
            const pastUsers = await fetch(
              `https://api.sleeper.app/v1/league/${prevLeagueId}/users`
            ).then((r) => r.json());
            pastUserMap = Object.fromEntries(
              pastUsers.map((u: any) => [u.user_id, normalizeManagerName(u.display_name)])
            );
            pastUserDisplayMap = Object.fromEntries(
              pastUsers.map((u: any) => [u.user_id, getManagerDisplayName(u.display_name)])
            );
            Object.assign(
              pastManagerDisplayNameByManager,
              Object.fromEntries(
                pastUsers.map((u: any) => [normalizeManagerName(u.display_name), getManagerDisplayName(u.display_name)])
              )
            );
          }

          // Fetch and analyze draft data
          let draftAnalysis: { draftPicks: any[]; draftStats: any[] } = { draftPicks: [], draftStats: [] };
          let trendingAdds: TrendingPlayer[] = [];
          let trendingDrops: TrendingPlayer[] = [];
          let tradedPicks: Array<{ season: string; round: number; roster_id: number; owner_id: number }> = [];
          try {
            const draftPicks = await fetchDraftData(input.leagueId, {
              currentRosterMap: rosterUserMap,
              currentRosterDisplayMap: rosterUserDisplayMap,
              currentRosters: rosters,
              currentUserMap,
              currentUserIdToManagerMap: userIdToManagerMap,
              currentUserIdToManagerDisplayMap: userIdToManagerDisplayMap,
              pastRosterMap: pastSeasonData?.rosterMap || {},
              pastRosterDisplayMap,
              pastRosters: pastSeasonData?.rosters || [],
              pastUserMap,
              pastUserIdToManagerMap: pastUserMap,
              pastUserIdToManagerDisplayMap: pastUserDisplayMap,
              prevLeagueId,
              draftSlotsBySeason,
            });
            // Calculate ADP from the draft picks themselves
            const adpData = calculateADPFromPicks(draftPicks);
            if (draftPicks.length > 0) {
              const rookieValues2025 = getRookieValueBaseline('2025');
              const rookieValuesByDraftYear = getRookieValueBaselines();
              draftAnalysis = await analyzeDraftPicks(
                draftPicks,
                players,
                rosterUserMap,
                ktcValues,
                adpData,
                ktcValuesLastWeek,
                rookieValues2025,
                ktcValues,
                rookieValuesByDraftYear,
                {
                  ...pastManagerDisplayNameByManager,
                  ...managerDisplayNameByManager,
                },
                leagueValueOptions
              );
            }
          } catch (e) {
            console.warn('Failed to fetch draft data:', e);
          }

          try {
            [trendingAdds, trendingDrops] = await Promise.all([
              fetchTrendingPlayers('add', players, ktcValues, ownerByPlayerId, rosterStatusByPlayerId, leagueValueMode, allValueProfilesById),
              fetchTrendingPlayers('drop', players, ktcValues, ownerByPlayerId, rosterStatusByPlayerId, leagueValueMode, allValueProfilesById),
            ]);
            tradedPicks = await fetch(
              `https://api.sleeper.app/v1/league/${input.leagueId}/traded_picks`
            ).then((r) => r.json());
            if (!Array.isArray(tradedPicks)) tradedPicks = [];
          } catch (e) {
            console.warn('Failed to fetch trending players:', e);
          }

          const managers = Object.values(rosterUserMap).filter(Boolean) as string[];
          const currentSeason = String(leagueInfo.season || new Date().getFullYear());
          const futurePickInventory = buildFuturePickInventory({
            rosters,
            rosterMap: rosterUserMap,
            tradedPicks,
            ktcValues,
            draftRounds: Number(leagueInfo.settings?.draft_rounds || 5),
            seasons: [currentSeason, String(Number(currentSeason) + 1)],
            draftSlotsBySeason,
            totalTeams: Number(leagueInfo.total_rosters || rosters.length || 0),
          });
          const pickPortfolios = buildPickPortfolios(managers, draftAnalysis.draftPicks, futurePickInventory);
          const maxPickPortfolioValue = Math.max(...pickPortfolios.map((portfolio) => portfolio.totalValue), 1);
          const powerRankings = (reportData.powerRankings || [])
            .map((ranking) => {
              const portfolio = pickPortfolios.find((item) => item.manager === ranking.manager);
              const draftCapital = Math.round(((portfolio?.totalValue || 0) / maxPickPortfolioValue) * 100);
              const score = Math.round(
                ranking.starterStrength * 0.28 +
                ranking.rosterValue * 0.24 +
                ranking.positionalBalance * 0.16 +
                draftCapital * 0.08 +
                ranking.youthScore * 0.14 +
                ranking.tradeEfficiency * 0.10
              );
              return {
                ...ranking,
                draftCapital,
                score,
                tier: score >= 86 ? 'Juggernaut' : score >= 74 ? 'Contender' : score >= 60 ? 'Playoff Mix' : score >= 45 ? 'Reloading' : 'Rebuild Mode',
              };
            })
            .sort((a, b) => b.score - a.score)
            .map((ranking, index) => ({ ...ranking, rank: index + 1 }));
          const waiverIntelligence = buildWaiverIntelligence(
            trendingAdds,
            trendingDrops,
            players,
            ktcValues,
            ownerByPlayerId,
            rosterStatusByPlayerId,
            leagueValueMode,
            allValueProfilesById
          );
          const managerIntelByName = new Map((reportData.managerRosterIntelligence || []).map((row) => [row.manager, row]));
          const recentTransactions = buildRecentTransactions(
            allTransactions,
            rosterUserMap,
            players,
            ktcValues,
            rosterStatusByPlayerId,
            managerIntelByName,
            currentSeason,
            leagueValueMode,
            allValueProfilesById
          );
          const prospectContext = await loadProspectContext();
          const prospectLookup = buildProspectLookup(prospectContext.profiles);
          const rankings = await buildRankingsBoard({
            players,
            ktcValues,
            baselineKtcValues: ktcValuesLastWeek,
            ownerByPlayerId,
            rosterStatusByPlayerId,
            selectedProfileKey: leagueValueProfileKey,
            selectedProfileLabel: leagueValueProfileLabel,
            prospectLookup,
          });
          const managerChampionships = await buildManagerChampionships(leagueInfo, users, rosters);

          const reportPlayerIds = [
            ...rosters.flatMap((roster: any) => [...(roster.players || []), ...(roster.taxi || []), ...(roster.reserve || [])]),
            ...trades.flatMap((trade: any) => Object.keys(trade.adds || {})),
            ...draftAnalysis.draftPicks.map((pick: any) => pick.player_id),
            ...trendingAdds.map((player) => player.player_id),
            ...trendingDrops.map((player) => player.player_id),
            waiverIntelligence.highestKtcAvailable?.player_id,
            ...Object.values(waiverIntelligence.bestAvailableByPosition).map((player) => player?.player_id),
            ...waiverIntelligence.bestTaxiStashes.map((player) => player.player_id),
            ...waiverIntelligence.recentlyDroppedValuable.map((player) => player.player_id),
            ...Object.values(rankings.profiles || {}).flatMap((rows) => rows.map((player) => player.player_id)),
          ];
          const valueProfilesById = Object.fromEntries(
            reportPlayerIds
              .filter((playerId, index, arr) => Boolean(playerId) && arr.indexOf(playerId) === index)
              .map((playerId) => [playerId, allValueProfilesById[playerId]])
              .filter((entry): entry is [string, NonNullable<PlayerDetails['valueProfile']>] => Boolean(entry[1]))
          );
          const similarTradeValuesById = buildSimilarTradeValueMap(reportPlayerIds, players, ktcValues, leagueValueMode, allValueProfilesById);
          const availabilityHistoryById = await fetchPlayerAvailabilityHistory(
            reportPlayerIds,
            players,
            leagueInfo.scoring_settings,
            lastCompletedSeason,
            3
          );
          const latestNewsByPlayerId = buildLatestNewsByPlayerId(
            reportPlayerIds,
            players,
            await fetchFantasyProsNews()
          );
          const playerDetailsById = buildPlayerDetailsMap(reportPlayerIds, players, rosterStatusByPlayerId, prospectLookup);

          return {
            leagueId: input.leagueId,
            leagueName: leagueInfo.name,
            leagueLogo: getSleeperAvatarUrl(leagueInfo.avatar),
            leagueFormat: formatLeagueFormat(leagueInfo),
            reportData: {
              ...reportData,
              prospectSourceDiagnostics: prospectContext.diagnostics,
              viewerManager,
              currentStandings,
              managerAvatars: buildManagerAvatarMap(users),
              managerChampionships,
              playerDetailsById: Object.fromEntries(
                Object.entries(playerDetailsById).map(([playerId, details]) => [
                  playerId,
                  {
                    ...details,
                    valueProfile: valueProfilesById[playerId],
                    lastSeasonPositionRank: lastSeasonPositionRanks[playerId]?.positionRank || null,
                    lastSeasonFantasyPoints: lastSeasonPositionRanks[playerId]?.fantasyPoints ?? null,
                    lastSeasonGames: lastSeasonPositionRanks[playerId]?.games ?? null,
                    lastSeasonPointsPerGame: lastSeasonPositionRanks[playerId]?.pointsPerGame ?? null,
                    lastSeasonYear: lastSeasonPositionRanks[playerId]?.season || null,
                    availabilityHistory: availabilityHistoryById[playerId]?.availabilityHistory || [],
                    latestNews: latestNewsByPlayerId[playerId] || null,
                    avgGamesMissed: availabilityHistoryById[playerId]?.avgGamesMissed ?? null,
                    availabilitySeasons: availabilityHistoryById[playerId]?.availabilitySeasons ?? 0,
                    similarTradeValues: similarTradeValuesById[playerId] || [],
                  },
                ])
              ),
              currentPositionRankById: buildPrimaryPositionRankMap(reportPlayerIds, players, ktcValues, valueProfilesById, leagueValueMode),
              trendingAdds,
              trendingDrops,
              pickPortfolios,
              powerRankings,
              waiverIntelligence,
              recentTransactions,
              rankings,
              draftPicks: draftAnalysis.draftPicks,
              draftStats: draftAnalysis.draftStats,
            },
          }
        } catch (error) {
          console.error('League analysis error:', error);
          if (!(error instanceof Error && error.message === 'Invalid league ID')) {
            await insertLoginAttempt({
              eventType: "analyze_league",
              status: "error",
              leagueId: input.leagueId,
              ipAddress,
              userAgent,
              note: error instanceof Error ? error.message : "Failed to fetch league data",
            });
          }
          throw new Error('Failed to fetch league data');
        }
    }),
  }),

  players: router({
    latestNews: publicProcedure
      .input(z.object({
        playerId: z.string().optional(),
        playerName: z.string().optional(),
        team: z.string().optional().nullable(),
        position: z.string().optional().nullable(),
      }))
      .query(async ({ input }) => {
        const playerName = input.playerName?.trim();
        if (!playerName) return { latestNews: null };

        const latestNews = await fetchFantasyProsLatestPlayerNews({
          playerName,
          team: input.team || null,
          position: input.position || null,
        });

        return {
          latestNews: latestNews ? {
            title: latestNews.title,
            summary: latestNews.summary || null,
            source: latestNews.source || 'FantasyPros',
            url: latestNews.url || null,
            publishedAt: latestNews.publishedAt || null,
          } : null,
        };
      }),
  }),

  images: router({
    playerHeadshot: publicProcedure
      .input(z.object({ playerId: z.string() }))
      .query(async ({ input }) => {
        // Try to get from cache first
        const cached = getCachedImage(input.playerId);
        if (cached) {
          return {
            success: true,
            cached: true,
            data: cached.data.toString('base64'),
            contentType: cached.contentType,
          };
        }

        // Fetch and cache
        const imageBuffer = await fetchPlayerHeadshot(input.playerId);
        if (!imageBuffer) {
          return { success: false, cached: false };
        }

        return {
          success: true,
          cached: false,
          data: imageBuffer.toString('base64'),
          contentType: 'image/jpeg',
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
