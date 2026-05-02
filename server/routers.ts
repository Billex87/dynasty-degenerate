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
import { cleanName, getPickValue, getPlayerName, getPlayerValue } from "./leagueAnalysis";
import { fetchFantasyProsNews, fetchFantasyProsPlayerPoints } from "./fantasyPros";
import type { LeagueValueMode, ManagerChampionship, PickPortfolio, PlayerDetails, TrendingPlayer, WaiverIntelligence } from "../shared/types";

function normalizeManagerName(name: string | undefined): string {
  const fallback = name || 'Unknown';
  return fallback.replace(/\d+$/, '') || fallback;
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
  rosters: Array<{ players?: string[]; roster_id: number }>,
  rosterUserMap: Record<string, string>
): Record<string, string> {
  const ownerByPlayerId: Record<string, string> = {};

  for (const roster of rosters) {
    const manager = rosterUserMap[String(roster.roster_id)];
    if (!manager) continue;

    for (const playerId of roster.players || []) {
      ownerByPlayerId[playerId] = manager;
    }
  }

  return ownerByPlayerId;
}

function getLeagueValueMode(leagueInfo: any): LeagueValueMode {
  const type = Number(leagueInfo?.settings?.type ?? 0);
  if (type === 2) return 'dynasty';
  if (type === 1) return 'keeper';
  return 'redraft';
}

function formatLeagueFormat(leagueInfo: any): string {
  const totalTeams = leagueInfo.total_rosters ? `${leagueInfo.total_rosters}-Team` : null;
  const valueMode = getLeagueValueMode(leagueInfo);
  const type = valueMode === 'dynasty' ? 'Dynasty' : valueMode === 'keeper' ? 'Keeper' : 'Redraft';
  const positions = Array.isArray(leagueInfo.roster_positions) ? leagueInfo.roster_positions : [];
  const superflex = positions.includes('SUPER_FLEX') ? 'SF' : null;
  const rec = Number(leagueInfo.scoring_settings?.rec ?? 0);
  const teBonus = Number(leagueInfo.scoring_settings?.bonus_rec_te ?? 0);
  const ppr = rec === 1 ? 'PPR' : rec === 0.5 ? 'Half-PPR' : rec === 0 ? 'Standard' : `${rec} PPR`;
  const tep = teBonus > 0 ? 'TEP' : null;

  return [totalTeams, type, superflex, ppr, tep].filter(Boolean).join(' ');
}

function toSleeperLeagueOption(leagueInfo: any, season: string) {
  return {
    leagueId: String(leagueInfo.league_id),
    name: leagueInfo.name || 'Unnamed League',
    avatarUrl: getSleeperAvatarUrl(leagueInfo.avatar),
    season,
    format: formatLeagueFormat(leagueInfo),
    totalRosters: Number(leagueInfo.total_rosters || leagueInfo.settings?.num_teams || 0),
  };
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

function getChampionRosterIdFromBracket(bracket: any[]): number | null {
  if (!Array.isArray(bracket) || bracket.length === 0) return null;

  const completed = bracket
    .filter((matchup) => matchup && matchup.w !== undefined && matchup.w !== null)
    .map((matchup) => ({
      ...matchup,
      r: Number(matchup.r || 0),
      m: Number(matchup.m || 999),
      w: Number(matchup.w),
    }))
    .filter((matchup) => Number.isFinite(matchup.w));

  if (completed.length === 0) return null;

  const finalMatchup = completed.sort((a, b) => {
    if (b.r !== a.r) return b.r - a.r;
    return a.m - b.m;
  })[0];

  return Number.isFinite(finalMatchup.w) ? finalMatchup.w : null;
}

async function buildManagerChampionships(
  currentLeagueInfo: any,
  currentUsers: any[] = [],
  maxSeasons = 8
): Promise<Record<string, ManagerChampionship>> {
  const championships: Record<string, ManagerChampionship> = {};
  const visited = new Set<string>();
  const currentManagerByUserId = Object.fromEntries(
    currentUsers.map((user: any) => [user.user_id, normalizeManagerName(user.display_name)])
  );
  let nextLeagueId = currentLeagueInfo?.previous_league_id ? String(currentLeagueInfo.previous_league_id) : '';

  for (let depth = 0; nextLeagueId && depth < maxSeasons && !visited.has(nextLeagueId); depth += 1) {
    visited.add(nextLeagueId);

    const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${nextLeagueId}`);
    if (!leagueInfo?.league_id) break;

    const [users, rosters, winnersBracket] = await Promise.all([
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${nextLeagueId}/users`),
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${nextLeagueId}/rosters`),
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${nextLeagueId}/winners_bracket`),
    ]);

    const championRosterId = getChampionRosterIdFromBracket(winnersBracket || []);
    const championRoster = Array.isArray(rosters)
      ? rosters.find((roster: any) => Number(roster.roster_id) === championRosterId)
      : null;
    const userMap = Object.fromEntries((users || []).map((user: any) => [user.user_id, user]));
    const championOwnerId = championRoster?.owner_id ? String(championRoster.owner_id) : '';
    const championManager = currentManagerByUserId[championOwnerId]
      || normalizeManagerName(userMap[championOwnerId]?.display_name);
    const season = String(leagueInfo.season || Number(currentLeagueInfo?.season || new Date().getFullYear()) - depth - 1);

    if (championRosterId !== null && championManager && championManager !== 'Unknown') {
      championships[championManager] = championships[championManager] || { seasons: [] };
      if (!championships[championManager].seasons.includes(season)) {
        championships[championManager].seasons.push(season);
      }
    }

    nextLeagueId = leagueInfo.previous_league_id ? String(leagueInfo.previous_league_id) : '';
  }

  return Object.fromEntries(
    Object.entries(championships).map(([manager, championship]) => [
      manager,
      {
        seasons: [...championship.seasons].sort((a, b) => Number(b) - Number(a)),
      },
    ])
  );
}

function getPlayerDetails(playerId: string, player: Record<string, any> | undefined): PlayerDetails | undefined {
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

function buildPlayerDetailsMap(playerIds: Iterable<string>, players: Record<string, any>): Record<string, PlayerDetails> {
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean)))
      .map((playerId) => [playerId, getPlayerDetails(playerId, players[playerId])])
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
  let rank = ktcValues[key]?.position_rank;

  if (!rank) {
    for (const ktcKey in ktcValues) {
      if (key.includes(ktcKey) || ktcKey.includes(key)) {
        rank = ktcValues[ktcKey].position_rank;
        break;
      }
    }
  }

  return rank || null;
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
  let data = ktcValues[key];
  let dataKey = key;

  if (!data) {
    for (const ktcKey in ktcValues) {
      if (key.includes(ktcKey) || ktcKey.includes(key)) {
        data = ktcValues[ktcKey];
        dataKey = ktcKey;
        break;
      }
    }
  }

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
    fantasyCalcDynasty: data.market_value_fantasycalc ?? null,
    fantasyCalcRedraft: data.redraft_value ?? null,
    dynastyProcess: data.expert_value_dynastyprocess ?? null,
    fantasyProsRank: data.fantasypros_rank ?? null,
    fantasyProsPositionRank: data.fantasypros_position_rank ?? null,
    fantasyProsTier: data.fantasypros_tier ?? null,
    fantasyProsSeasonValue: data.fantasypros_season_value ?? null,
    sources: data.value_sources || [],
  };
}

function getKtcPosition(data: KTCValues[string]): 'QB' | 'RB' | 'WR' | 'TE' | null {
  const position = data?.position_rank?.match(/^[A-Z]+/)?.[0]
    || data?.fantasypros_position_rank?.match(/^[A-Z]+/)?.[0]
    || null;
  return ['QB', 'RB', 'WR', 'TE'].includes(position || '') ? position as 'QB' | 'RB' | 'WR' | 'TE' : null;
}

function buildValueProfileRankLookups(
  ktcValues: KTCValues
): Record<string, Partial<Record<'dynastyPositionRank' | 'seasonPositionRank' | 'contenderPositionRank' | 'rebuilderPositionRank' | 'balancedPositionRank', string>>> {
  type LensKey = 'dynastyPositionRank' | 'seasonPositionRank' | 'contenderPositionRank' | 'rebuilderPositionRank' | 'balancedPositionRank';
  const lensValues: Record<LensKey, Array<{ key: string; position: 'QB' | 'RB' | 'WR' | 'TE'; value: number }>> = {
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
    for (const position of ['QB', 'RB', 'WR', 'TE'] as const) {
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
  const dynastyRankMap = buildCurrentPositionRankMap(playerIds, players, ktcValues);
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean))).map((playerId) => {
      const profile = valueProfilesById[playerId];
      const rank = leagueValueMode === 'redraft'
        ? profile?.seasonPositionRank || profile?.fantasyProsPositionRank || dynastyRankMap[playerId]
        : profile?.dynastyPositionRank || profile?.balancedPositionRank || dynastyRankMap[playerId] || profile?.seasonPositionRank;
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
  ktcValues: KTCValues
): Record<string, NonNullable<PlayerDetails['similarTradeValues']>> {
  const requestedPlayerIds = Array.from(new Set(Array.from(playerIds).filter(Boolean)));
  const candidateIds = Array.from(new Set([
    ...requestedPlayerIds,
    ...Object.keys(players).filter((playerId) => {
      const player = players[playerId];
      return ['QB', 'RB', 'WR', 'TE'].includes(player?.position)
        && ['Active', 'Inactive', null, undefined].includes(player?.status);
    }),
  ]));
  const candidates = candidateIds
    .map((playerId) => {
      const player = players[playerId];
      const position = player?.position;
      const value = getPlayerValue(playerId, players, ktcValues);
      if (!['QB', 'RB', 'WR', 'TE'].includes(position) || value <= 0) return null;
      return {
        playerId,
        name: getPlayerName(playerId, players),
        position,
        team: player.team || null,
        rank: getPlayerCurrentPositionRank(playerId, players, ktcValues),
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
  const normalize = (value: string) => cleanName(value).toLowerCase();
  const requestedIds = Array.from(new Set(Array.from(playerIds).filter(Boolean)));
  const normalizedNews = newsItems.map((item) => ({
    item,
    haystack: normalize(`${item.title} ${item.summary || ''}`),
  }));

  return Object.fromEntries(requestedIds.map((playerId) => {
    const player = players[playerId];
    if (!player) return null;
    const fullName = getPlayerName(playerId, players);
    const nameKey = normalize(fullName);
    const lastName = normalize(player.last_name || fullName.split(/\s+/).slice(-1)[0] || '');
    const matched = normalizedNews.find(({ haystack }) => haystack.includes(nameKey))
      || (lastName.length >= 5 ? normalizedNews.find(({ haystack }) => haystack.includes(lastName)) : null);
    if (!matched) return null;
    return [playerId, matched.item];
  }).filter((entry): entry is [string, NonNullable<PlayerDetails['latestNews']>] => Boolean(entry)));
}

async function fetchTrendingPlayers(
  type: 'add' | 'drop',
  players: Record<string, any>,
  ktcValues: KTCValues,
  ownerByPlayerId: Record<string, string>
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
      playerDetails: getPlayerDetails(playerId, player),
      currentPositionRank: getPlayerCurrentPositionRank(playerId, players, ktcValues),
      pos: player?.position || 'N/A',
      team: player?.team || null,
      owner: ownerByPlayerId[playerId] || null,
      count: item.count || 0,
      ktcValue: getPlayerValue(playerId, players, ktcValues) || null,
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

function buildWaiverIntelligence(trendingAdds: TrendingPlayer[], trendingDrops: TrendingPlayer[]): WaiverIntelligence {
  const availableAdds = trendingAdds.filter((player) => !player.owner);
  const rosteredAdds = trendingAdds.filter((player) => player.owner);
  const highestKtcAvailable = [...availableAdds].sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0))[0] || null;
  const bestAvailableByPosition = {
    QB: [...availableAdds].filter((player) => player.pos === 'QB').sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0))[0] || null,
    RB: [...availableAdds].filter((player) => player.pos === 'RB').sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0))[0] || null,
    WR: [...availableAdds].filter((player) => player.pos === 'WR').sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0))[0] || null,
    TE: [...availableAdds].filter((player) => player.pos === 'TE').sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0))[0] || null,
  };

  return {
    rosteredTrendingAdds: rosteredAdds,
    availableTrendingAdds: availableAdds,
    highestKtcAvailable,
    bestAvailableByPosition,
    recentlyDroppedValuable: [...trendingDrops]
      .filter((player) => (player.ktcValue || 0) > 0)
      .sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0))
      .slice(0, 8),
  };
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
      .mutation(async ({ input }) => {
        const username = input.username.trim();
        if (!username) throw new Error('Please enter a Sleeper username');

        const userResponse = await fetch(
          `https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`
        );
        if (!userResponse.ok) throw new Error('Sleeper user not found');

        const user = await userResponse.json();
        if (!user?.user_id) throw new Error('Sleeper user not found');

        const currentSeason = String(new Date().getFullYear());
        const seenLeagueIds = new Set<string>();
        const leagues = [];

        const leaguesResponse = await fetch(
          `https://api.sleeper.app/v1/user/${user.user_id}/leagues/nfl/${currentSeason}`
        );
        const seasonLeagues = leaguesResponse.ok ? await leaguesResponse.json() : [];

        if (Array.isArray(seasonLeagues)) {
          for (const leagueInfo of seasonLeagues) {
            const leagueId = String(leagueInfo?.league_id || '');
            if (!leagueId || seenLeagueIds.has(leagueId)) continue;
            seenLeagueIds.add(leagueId);
            leagues.push(toSleeperLeagueOption(leagueInfo, currentSeason));
          }
        }

        return {
          user: {
            userId: String(user.user_id),
            username: user.username || username,
            displayName: user.display_name || user.username || username,
            avatarUrl: getSleeperAvatarUrl(user.avatar),
          },
          leagues: leagues.sort((a, b) => Number(b.season) - Number(a.season) || a.name.localeCompare(b.name)),
        };
      }),

    analyze: publicProcedure
      .input(z.object({ leagueId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const leagueInfo = await fetch(
            `https://api.sleeper.app/v1/league/${input.leagueId}`
          ).then((r) => r.json());

          if (!leagueInfo.league_id) {
            throw new Error('Invalid league ID');
          }

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
          const ownerByPlayerId = buildPlayerOwnerMap(rosters, rosterUserMap);

          const trades: any[] = [];
          for (let week = 1; week <= 18; week++) {
            const weekTrades = await fetch(
              `https://api.sleeper.app/v1/league/${input.leagueId}/transactions/${week}`
            ).then((r) => r.json());
            if (weekTrades) {
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

          const ktcValues = await loadBlendedKTCValues();
          // Get the latest KTC snapshot from at least 7 days ago for weekly value-change calculations.
          const ktcValuesLastWeekRaw = await getKtcSnapshotFromDaysAgo(7);
          let ktcValuesLastWeek: KTCValues = {};
          
          if (ktcValuesLastWeekRaw && Object.keys(ktcValuesLastWeekRaw).length > 0) {
            ktcValuesLastWeek = ktcValuesLastWeekRaw;
          } else {
            ktcValuesLastWeek = loadLatestLocalKtcSnapshotDaysAgo(7);
            if (Object.keys(ktcValuesLastWeek).length === 0) {
              ktcValuesLastWeek = await loadKTCValuesLastWeek();
            }
          }

          const prevLeagueId = leagueInfo.previous_league_id;
          let pastSeasonData = null;
          let draftSlotsBySeason = await fetchDraftSlotsBySeason(input.leagueId, rosters);

          if (prevLeagueId) {
            try {
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
              };
            } catch (e) {
              console.warn('Failed to fetch past season data:', e);
            }
          }

          // Create user_id to manager name map for draft analysis
          const userIdToManagerMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, normalizeManagerName(u.display_name)])
          );

          const currentSeasonData = {
            label: '2026',
            trades,
            rosterMap: rosterUserMap,
            rosters,
            draftSlotsBySeason,
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
          if (pastSeasonData) {
            const pastUsers = await fetch(
              `https://api.sleeper.app/v1/league/${prevLeagueId}/users`
            ).then((r) => r.json());
            pastUserMap = Object.fromEntries(
              pastUsers.map((u: any) => [u.user_id, normalizeManagerName(u.display_name)])
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
              currentRosters: rosters,
              currentUserMap,
              currentUserIdToManagerMap: userIdToManagerMap,
              pastRosterMap: pastSeasonData?.rosterMap || {},
              pastRosters: pastSeasonData?.rosters || [],
              pastUserMap,
              pastUserIdToManagerMap: pastUserMap,
              prevLeagueId,
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
                rookieValuesByDraftYear
              );
            }
          } catch (e) {
            console.warn('Failed to fetch draft data:', e);
          }

          try {
            [trendingAdds, trendingDrops] = await Promise.all([
              fetchTrendingPlayers('add', players, ktcValues, ownerByPlayerId),
              fetchTrendingPlayers('drop', players, ktcValues, ownerByPlayerId),
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
          const waiverIntelligence = buildWaiverIntelligence(trendingAdds, trendingDrops);
          const managerChampionships = await buildManagerChampionships(leagueInfo, users);

          const reportPlayerIds = [
            ...rosters.flatMap((roster: any) => roster.players || []),
            ...trades.flatMap((trade: any) => Object.keys(trade.adds || {})),
            ...draftAnalysis.draftPicks.map((pick: any) => pick.player_id),
            ...trendingAdds.map((player) => player.player_id),
            ...trendingDrops.map((player) => player.player_id),
          ];
          const valueProfilesById = buildPlayerValueProfileMap(reportPlayerIds, players, ktcValues);
          const similarTradeValuesById = buildSimilarTradeValueMap(reportPlayerIds, players, ktcValues);
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
          const playerDetailsById = buildPlayerDetailsMap(reportPlayerIds, players);

          return {
            leagueId: input.leagueId,
            leagueName: leagueInfo.name,
            leagueLogo: getSleeperAvatarUrl(leagueInfo.avatar),
            leagueFormat: formatLeagueFormat(leagueInfo),
            reportData: {
              ...reportData,
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
              draftPicks: draftAnalysis.draftPicks,
              draftStats: draftAnalysis.draftStats,
            },
          }
        } catch (error) {
          console.error('League analysis error:', error);
          throw new Error('Failed to fetch league data');
        }
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
