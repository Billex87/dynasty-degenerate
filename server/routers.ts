import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { loadBlendedKTCValues, loadKTCValuesLastWeek, loadLatestLocalKtcSnapshotDaysAgo, loadLocalKtcSnapshotForDate } from "./ktcLoader";
import type { KTCValues, LastSeasonPlayerRank } from "./reportGenerator";
import { getKtcSnapshotFromDaysAgo } from "./ktcSnapshotJob";
import { generateReport } from "./reportGenerator";
import { fetchDraftData, calculateADPFromPicks, analyzeDraftPicks } from "./draftAnalysis";
import { getMay2025KTCSnapshot } from "./waybackMachineScraper";
import { fetchPlayerHeadshot, getCachedImage } from "./imageProxy";
import { cleanName, getPickValue, getPlayerName, getPlayerValue } from "./leagueAnalysis";
import { fetchFantasyProsPlayerPoints } from "./fantasyPros";
import type { PickPortfolio, PlayerDetails, TrendingPlayer, WaiverIntelligence } from "../shared/types";

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

function formatLeagueFormat(leagueInfo: any): string {
  const totalTeams = leagueInfo.total_rosters ? `${leagueInfo.total_rosters}-Team` : null;
  const type = 'Dynasty';
  const positions = Array.isArray(leagueInfo.roster_positions) ? leagueInfo.roster_positions : [];
  const superflex = positions.includes('SUPER_FLEX') ? 'SF' : null;
  const rec = Number(leagueInfo.scoring_settings?.rec ?? 0);
  const ppr = rec === 1 ? 'PPR' : rec === 0.5 ? 'Half-PPR' : rec === 0 ? 'Standard' : `${rec} PPR`;

  return [totalTeams, type, superflex, ppr].filter(Boolean).join(' ');
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
  ktcValues: KTCValues
): PlayerDetails['valueProfile'] | undefined {
  const player = players[playerId];
  if (!player) return undefined;

  const key = cleanName(`${player.first_name || ''}${player.last_name || ''}`);
  let data = ktcValues[key];

  if (!data) {
    for (const ktcKey in ktcValues) {
      if (key.includes(ktcKey) || ktcKey.includes(key)) {
        data = ktcValues[ktcKey];
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

function buildPlayerValueProfileMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues
): Record<string, PlayerDetails['valueProfile']> {
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean)))
      .map((playerId) => [playerId, getPlayerValueProfile(playerId, players, ktcValues)])
      .filter((entry): entry is [string, NonNullable<PlayerDetails['valueProfile']>] => Boolean(entry[1]))
  );
}

function buildSimilarTradeValueMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues
): Record<string, NonNullable<PlayerDetails['similarTradeValues']>> {
  const candidates = Array.from(new Set(Array.from(playerIds).filter(Boolean)))
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

  return Object.fromEntries(candidates.map((player) => {
    const peers = (['QB', 'RB', 'WR', 'TE'] as const)
      .map((position) => candidates
        .filter((candidate) => candidate.playerId !== player.playerId && candidate.position === position)
        .sort((a, b) => Math.abs(a.value - player.value) - Math.abs(b.value - player.value))[0])
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.value - player.value) - Math.abs(b.value - player.value))
      .map((peer) => ({
        playerId: peer.playerId,
        name: peer.name,
        position: peer.position,
        team: peer.team,
        rank: peer.rank,
        value: peer.value,
        difference: peer.value - player.value,
        label: `${player.position} value near ${peer.position}`,
      }));

    return [player.playerId, peers];
  }));
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
          // Get the latest KTC snapshot from at least 14 days ago for value-change calculations.
          const ktcValuesLastWeekRaw = await getKtcSnapshotFromDaysAgo(14);
          let ktcValuesLastWeek: KTCValues = {};
          
          if (ktcValuesLastWeekRaw && Object.keys(ktcValuesLastWeekRaw).length > 0) {
            ktcValuesLastWeek = ktcValuesLastWeekRaw;
          } else {
            ktcValuesLastWeek = loadLatestLocalKtcSnapshotDaysAgo(14);
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

          const reportData = await generateReport(
            currentSeasonData,
            pastSeasonData,
            players,
            ktcValues,
            ktcValuesLastWeek,
            lastSeasonPositionRanks
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
              // Load May 2025 KTC baseline for value change calculations
              const ktcValuesMay2025 = getMay2025KTCSnapshot();
              // For 2026 rookie drafts, compare against the April 2026 snapshot instead of May 2025.
              const ktcValuesByDraftYear = {
                '2026': loadLocalKtcSnapshotForDate('2026-04-23'),
              };
              draftAnalysis = await analyzeDraftPicks(
                draftPicks,
                players,
                rosterUserMap,
                ktcValues,
                adpData,
                ktcValuesLastWeek,
                ktcValuesMay2025,
                ktcValues,
                ktcValuesByDraftYear
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

          const reportPlayerIds = [
            ...rosters.flatMap((roster: any) => roster.players || []),
            ...trades.flatMap((trade: any) => Object.keys(trade.adds || {})),
            ...draftAnalysis.draftPicks.map((pick: any) => pick.player_id),
            ...trendingAdds.map((player) => player.player_id),
            ...trendingDrops.map((player) => player.player_id),
          ];
          const valueProfilesById = buildPlayerValueProfileMap(reportPlayerIds, players, ktcValues);
          const similarTradeValuesById = buildSimilarTradeValueMap(reportPlayerIds, players, ktcValues);
          const playerDetailsById = buildPlayerDetailsMap(reportPlayerIds, players);

          return {
            leagueId: input.leagueId,
            leagueName: leagueInfo.name,
            leagueLogo: getSleeperAvatarUrl(leagueInfo.avatar),
            leagueFormat: formatLeagueFormat(leagueInfo),
            reportData: {
              ...reportData,
              managerAvatars: buildManagerAvatarMap(users),
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
                    similarTradeValues: similarTradeValuesById[playerId] || [],
                  },
                ])
              ),
              currentPositionRankById: buildCurrentPositionRankMap(reportPlayerIds, players, ktcValues),
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
