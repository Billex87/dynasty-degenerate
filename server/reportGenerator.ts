import {
  cleanName,
  getPlayerName,
  getPlayerValue,
  getPickValue,
  projectValue,
  calculateValueAdjustment,
} from './leagueAnalysis';
import { loadLatestLocalKtcSnapshotBefore } from './ktcLoader';
import type { ManagerIntelPlayer, PlayerDetails, ReportData } from '../shared/types';

export interface KTCValues {
  [key: string]: { name: string; ktc_value: number; position_rank?: string };
}

interface Player {
  [key: string]: {
    player_id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    position?: string;
    team?: string | null;
    number?: string | number | null;
    age?: number;
    birth_date?: string | null;
    height?: string | null;
    weight?: string | number | null;
    college?: string | null;
    high_school?: string | null;
    injury_status?: string | null;
    depth_chart_position?: string | null;
    depth_chart_order?: number | null;
    years_exp?: number | null;
    status?: string | null;
    fantasy_data_id?: string | number | null;
    sportradar_id?: string | null;
    yahoo_id?: string | number | null;
    gsis_id?: string | null;
    espn_id?: string | number | null;
    stats_id?: string | number | null;
    metadata?: {
      rookie_year?: string | number | null;
      draft_round?: string | number | null;
      draft_pick?: string | number | null;
      draft_slot?: string | number | null;
      draft_team?: string | null;
    };
    draft_round?: string | number | null;
    draft_pick?: string | number | null;
    draft_team?: string | null;
  };
}

interface User {
  user_id: string;
  display_name: string;
}

export interface LastSeasonPlayerRank {
  positionRank: string;
  fantasyPoints: number;
  season?: string;
}

interface Roster {
  roster_id: number;
  owner_id: string;
  players: string[];
}

interface Trade {
  status_updated: number;
  adds?: Record<string, number>;
  draft_picks?: Array<{
    season: number | string;
    round: number;
    roster_id?: number;
    owner_id: number;
    previous_owner_id?: number;
  }>;
}

interface SeasonData {
  label: string;
  trades: Trade[];
  rosterMap: Record<number, string>;
  rosters: Roster[];
  draftSlotsBySeason?: Record<string, Record<number, number>>;
}

type StarterThresholds = Record<'QB' | 'RB' | 'WR' | 'TE', number>;

function getStarterThresholds(teamCount: number): StarterThresholds {
  return {
    QB: Math.max(1, Math.round(teamCount * 2)),
    RB: Math.max(1, Math.round(teamCount * 3)),
    WR: Math.max(1, Math.round(teamCount * 4)),
    TE: Math.max(1, Math.round(teamCount * 1.5)),
  };
}

function ordinalRound(round: number): string {
  if (round === 1) return '1st';
  if (round === 2) return '2nd';
  if (round === 3) return '3rd';
  return `${round}th`;
}

function formatDraftPickLabel(
  pick: NonNullable<Trade['draft_picks']>[number],
  rosterMap: Record<number, string>,
  draftSlotsBySeason?: Record<string, Record<number, number>>
): string {
  const originalOwner = pick.roster_id ? rosterMap[pick.roster_id] : undefined;
  const ownerPrefix = originalOwner ? `${originalOwner} ` : '';
  const draftSlot = pick.roster_id
    ? draftSlotsBySeason?.[String(pick.season)]?.[pick.roster_id]
    : undefined;
  const pickNumber = draftSlot
    ? ` (${pick.round}.${String(draftSlot).padStart(2, '0')})`
    : '';
  return `${pick.season} ${ownerPrefix}${ordinalRound(pick.round)}${pickNumber}`;
}

function getDraftSlot(
  pick: NonNullable<Trade['draft_picks']>[number],
  draftSlotsBySeason?: Record<string, Record<number, number>>
): number | undefined {
  return pick.roster_id
    ? draftSlotsBySeason?.[String(pick.season)]?.[pick.roster_id]
    : undefined;
}

function encodePlayerItem(
  pid: string,
  name: string,
  value: number,
  tradeDateValue?: number | null,
  tradeDate?: string
): string {
  const historicalParts = tradeDateValue && tradeDateValue > 0 && tradeDate
    ? `|${tradeDateValue}|${tradeDate}`
    : '';
  return `PLAYER:${pid}|${name}|${value}${historicalParts}`;
}

function encodePickItem(label: string, value: number): string {
  return `PICK:${label}|${value}`;
}

const MUTUAL_TRADE_WIN_GAP = 250;

function chooseTradeWinners(
  managerA: string,
  managerB: string,
  valueA: number,
  valueB: number
): string[] {
  const pointGap = Math.abs(valueA - valueB);
  if (pointGap <= MUTUAL_TRADE_WIN_GAP) return [managerA, managerB];
  return valueA > valueB ? [managerA] : [managerB];
}

function getPlayerDetails(pid: string, allPlayers: Player): PlayerDetails | undefined {
  const player = allPlayers[pid];
  if (!player) return undefined;

  return {
    playerId: pid,
    fullName: player.full_name || getPlayerName(pid, allPlayers),
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

function getPlayerKtcRank(pid: string, allPlayers: Player, ktcValues: KTCValues): string | null {
  const p = allPlayers[pid];
  if (!p) return null;

  const fullName = `${p.first_name || ''}${p.last_name || ''}`;
  const key = cleanName(fullName);
  let rank = ktcValues[key]?.position_rank;

  if (!rank) {
    for (const k in ktcValues) {
      if (key.includes(k) || k.includes(key)) {
        rank = ktcValues[k].position_rank;
        break;
      }
    }
  }

  return rank || null;
}

function isStarterRank(
  position: string,
  positionRank: string | null,
  starterThresholds: StarterThresholds
): boolean {
  const rankPosition = positionRank?.match(/^[A-Z]+/)?.[0];
  const rankNumber = Number(positionRank?.match(/\d+/)?.[0]);
  if (!rankPosition || !Number.isFinite(rankNumber) || rankPosition !== position) return false;

  return position in starterThresholds && rankNumber <= starterThresholds[position as keyof StarterThresholds];
}

function getRankNumber(positionRank: string | null | undefined): number | null {
  const rankNumber = Number(positionRank?.match(/\d+/)?.[0]);
  return Number.isFinite(rankNumber) ? rankNumber : null;
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function roundOne(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function normalizeScore(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function getTier(score: number): string {
  if (score >= 86) return 'Juggernaut';
  if (score >= 74) return 'Contender';
  if (score >= 60) return 'Playoff Mix';
  if (score >= 45) return 'Reloading';
  return 'Rebuild Mode';
}

function getRosterIdentity(
  starterPct: number,
  avgAge: number | null,
  benchValue: number,
  totalValue: number,
  rankValue: number,
  rank2027: number
): string {
  if (rankValue <= 3 && starterPct >= 62 && benchValue < totalValue * 0.28) return 'Contender with weak depth';
  if (rankValue <= 3 && starterPct >= 58) return 'Win-now';
  if (rank2027 <= 3 && (avgAge ?? 99) <= 25.5) return 'Youth-heavy';
  if (rankValue >= 8 && rank2027 <= 5) return 'Rebuilding';
  if (starterPct < 47 && benchValue > totalValue * 0.38) return 'Balanced depth';
  return 'Balanced';
}

function getTimelineLabel(contenderScore: number, rebuildScore: number, agingRisk: number): string {
  if (contenderScore >= 78 && agingRisk >= 55) return 'Win now, monitor age';
  if (contenderScore >= 72) return '2026 contender';
  if (rebuildScore >= 68) return 'Rebuild runway';
  if (contenderScore >= 55) return 'Middle build';
  return 'Future focused';
}

function isLastSeasonStud(positionRank?: string | null): boolean {
  if (!positionRank) return false;
  const position = positionRank.replace(/[0-9]/g, '').toUpperCase();
  const rank = getRankNumber(positionRank);
  if (!rank) return false;

  if (position === 'QB' || position === 'TE') return rank <= 5;
  if (position === 'RB' || position === 'WR') return rank <= 10;
  return rank <= 12;
}

function pickDistinctPlayer<T extends ManagerIntelPlayer>(
  players: T[],
  usedPlayerIds: Set<string>
): T | null {
  const player = players.find((candidate) => !usedPlayerIds.has(candidate.player_id)) || players[0] || null;
  if (player) usedPlayerIds.add(player.player_id);
  return player;
}

function getRankLabel(player?: ManagerIntelPlayer | null): string {
  return player?.currentPositionRank || player?.pos || 'unranked';
}

function buildRosterIntelligenceSummary({
  identity,
  qbs,
  rbs,
  wrs,
  tes,
  benchFlexCandidates,
  bestBenchStash,
  weakestStarter,
  youngCorePlayer,
  oldestPlayer,
  holeParts,
}: {
  identity: string;
  qbs: ManagerIntelPlayer[];
  rbs: ManagerIntelPlayer[];
  wrs: ManagerIntelPlayer[];
  tes: ManagerIntelPlayer[];
  benchFlexCandidates: number;
  bestBenchStash: ManagerIntelPlayer | null;
  weakestStarter: ManagerIntelPlayer | null;
  youngCorePlayer: ManagerIntelPlayer | null;
  oldestPlayer: ManagerIntelPlayer | null;
  holeParts: string[];
}): string {
  const qbSummary = qbs[0]
    ? `QB room is led by ${qbs[0].name} (${getRankLabel(qbs[0])})${qbs[1] ? ` with ${qbs[1].name} (${getRankLabel(qbs[1])}) as the next option` : ' with no clear second ranked QB'}`
    : 'QB room has no ranked option';
  const rbSummary = rbs[1]
    ? `RB starts with ${rbs[0].name} (${getRankLabel(rbs[0])}) and ${rbs[1].name} (${getRankLabel(rbs[1])})`
    : rbs[0]
      ? `RB has ${rbs[0].name} (${getRankLabel(rbs[0])}) but no reliable RB2 by rank`
      : 'RB room has no ranked starter';
  const wrSummary = wrs[2]
    ? `WR trio is ${wrs.slice(0, 3).map((player) => `${player.name} (${getRankLabel(player)})`).join(', ')}`
    : wrs.length > 0
      ? `WR room has ${wrs.map((player) => `${player.name} (${getRankLabel(player)})`).join(', ')} but lacks a full three-WR spine`
      : 'WR room has no ranked option';
  const teSummary = tes[0]
    ? `TE is ${tes[0].name} (${getRankLabel(tes[0])})`
    : 'TE room has no ranked option';
  const depthSummary = benchFlexCandidates >= 3
    ? `Injury depth looks strong with ${benchFlexCandidates} bench flex pieces inside the starter-depth window`
    : benchFlexCandidates >= 1
      ? `There is some injury cover, but only ${benchFlexCandidates} bench flex piece${benchFlexCandidates === 1 ? '' : 's'} grades inside the starter-depth window`
      : 'One injury could hurt fast because there are no bench flex pieces inside the starter-depth window';
  const stashSummary = bestBenchStash
    ? `Best bench chip is ${bestBenchStash.name} (${getRankLabel(bestBenchStash)}, ${bestBenchStash.value.toLocaleString()})`
    : 'There is no obvious bench stash with real KTC value';
  const weakSummary = weakestStarter
    ? `Softest starter is ${weakestStarter.name} (${getRankLabel(weakestStarter)})`
    : 'No starter weakness could be identified from ranked players';
  const futureSummary = youngCorePlayer
    ? `Future anchor is ${youngCorePlayer.name} (${getRankLabel(youngCorePlayer)})`
    : oldestPlayer
      ? `Age risk is concentrated around ${oldestPlayer.name} (${getRankLabel(oldestPlayer)})`
      : 'No clear youth anchor or age-risk player stood out';
  const holesSummary = holeParts.length > 0
    ? `Watch list: ${holeParts.join(', ')}`
    : 'No major positional hole is flagged by the rank thresholds';

  return `${identity}. ${qbSummary}. ${rbSummary}. ${wrSummary}. ${teSummary}. ${depthSummary}. ${stashSummary}. ${weakSummary}. ${futureSummary}. ${holesSummary}.`;
}

export async function generateReport(
  currentSeasonData: SeasonData,
  pastSeasonData: SeasonData | null,
  allPlayers: Player,
  ktcValues: KTCValues,
  ktcValuesLastWeek: KTCValues,
  lastSeasonPositionRanks: Record<string, LastSeasonPlayerRank> = {}
): Promise<ReportData> {
  const starterThresholds = getStarterThresholds(currentSeasonData.rosters.length || 10);
  const tradeSnapshotCache: Record<string, KTCValues> = {};
  const getTradeSnapshot = (tradeDate: string): KTCValues => {
    if (!tradeSnapshotCache[tradeDate]) {
      tradeSnapshotCache[tradeDate] = loadLatestLocalKtcSnapshotBefore(new Date(tradeDate));
    }
    return tradeSnapshotCache[tradeDate];
  };
  const teamData: Record<
    string,
    {
      total_val: number;
      past_val: number;
      growth: number;
      pos_vals: Record<string, number>;
      v2027: number;
    }
  > = {};

  const allPlayerMoves: Array<{
    name: string;
    player_id: string;
    playerDetails?: PlayerDetails;
    currentPositionRank?: string | null;
    owner: string;
    pos: string;
    age: number | null;
    val_2026: number;
    val_2027: number;
    diff: number;
  }> = [];

  const weeklyMomentum: Array<{
    name: string;
    player_id: string;
    playerDetails?: PlayerDetails;
    currentPositionRank?: string | null;
    owner: string;
    pos: string;
    val_last: number;
    val_now: number;
    diff: number;
    pct_change: number;
  }> = [];

  const rankLists: Record<
    string | number,
    Record<string, Array<[string, number]>>
  > = {
    current: { QB: [], RB: [], WR: [], TE: [], VALUE: [] },
    2027: { VALUE: [] },
  };

  const pastRosterValues: Record<string, number> = {};

  // Calculate past season roster values if available
  if (pastSeasonData) {
    for (const r of pastSeasonData.rosters) {
      const name = pastSeasonData.rosterMap[r.roster_id];
      const pids = r.players || [];
      pastRosterValues[name] = pids.reduce(
        (sum, pid) => sum + getPlayerValue(pid, allPlayers, ktcValues),
        0
      );
    }
  }

  // Process current season rosters
  for (const r of currentSeasonData.rosters) {
    const name = currentSeasonData.rosterMap[r.roster_id];
    const pids = r.players || [];
    const posVals: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    let totalVal = 0;
    let v2027 = 0;

    for (const pid of pids) {
      const p = allPlayers[pid];
      const pos = p?.position || 'UNK';
      const age = p?.age || null;
      const val = getPlayerValue(pid, allPlayers, ktcValues);

      totalVal += val;

      if (pos in posVals) {
        posVals[pos] += val;
      }

      const p2027 = projectValue(val, pos, age, 1);
      v2027 += p2027;

      // Weekly momentum tracking - include all players with last week values
      const lastWeekVal = getPlayerValue(pid, allPlayers, ktcValuesLastWeek);
      if (lastWeekVal > 0) {
        const pct_change = lastWeekVal > 0 ? (val - lastWeekVal) / lastWeekVal * 100 : 0;
        weeklyMomentum.push({
          name: getPlayerName(pid, allPlayers),
          player_id: pid,
          playerDetails: getPlayerDetails(pid, allPlayers),
          currentPositionRank: getPlayerKtcRank(pid, allPlayers, ktcValues),
          owner: name,
          pos,
          val_last: lastWeekVal,
          val_now: val,
          diff: val - lastWeekVal,
          pct_change,
        });
      }

      if (val > 300) {
        allPlayerMoves.push({
          name: getPlayerName(pid, allPlayers),
          player_id: pid,
          playerDetails: getPlayerDetails(pid, allPlayers),
          currentPositionRank: getPlayerKtcRank(pid, allPlayers, ktcValues),
          owner: name,
          pos,
          age,
          val_2026: val,
          val_2027: p2027,
          diff: p2027 - val,
        });
      }
    }

    const pastVal = pastRosterValues[name] || 0;
    const growth = pastVal > 0 ? ((totalVal - pastVal) / pastVal) * 100 : 0;

    teamData[name] = {
      total_val: totalVal,
      past_val: pastVal,
      growth,
      pos_vals: posVals,
      v2027,
    };

    for (const [pos, val] of Object.entries(posVals)) {
      rankLists.current[pos].push([name, val]);
    }
    rankLists.current.VALUE.push([name, totalVal]);
    rankLists[2027].VALUE.push([name, v2027]);
  }

  // Calculate final ranks
  const finalRanks: Record<
    string,
    Record<string, number>
  > = {};

  for (const yearKey of Object.keys(rankLists)) {
    for (const posKey of Object.keys(rankLists[yearKey])) {
      const sorted = rankLists[yearKey][posKey].sort((a, b) => b[1] - a[1]);
      for (let i = 0; i < sorted.length; i++) {
        const [name] = sorted[i];
        if (!finalRanks[name]) finalRanks[name] = {};
        finalRanks[name][`${yearKey}_${posKey}`] = i + 1;
      }
    }
  }

  // Process trades
  const managerProfits: Record<string, number> = {};
  const managerActivity: Record<string, number> = {};
  const managerWins: Record<string, number> = {};
  const managerTradeGaps: Record<string, number[]> = {};
  const managerTradePartners: Record<string, Record<string, number>> = {};
  const managerPickNet: Record<string, number> = {};
  const managerVeteranNet: Record<string, number> = {};
  const tradeRows: Array<{
    date: string;
    season: string;
    team_a: string;
    team_b: string;
    team_a_items: string;
    team_b_items: string;
    team_a_total: number;
    team_b_total: number;
    point_gap: number;
    winner: string;
    winners: string[];
  }> = [];

  for (const season of [currentSeasonData, ...(pastSeasonData ? [pastSeasonData] : [])]) {
    for (const tx of season.trades) {
      const dt = new Date(tx.status_updated).toISOString().split('T')[0];
      const sideData: Record<
        number,
        { items: string[]; vals: number[]; pickValue: number; veteranValue: number }
      > = {};

      const adds = tx.adds || {};
      for (const [pid, rid] of Object.entries(adds)) {
        if (!sideData[rid]) sideData[rid] = { items: [], vals: [], pickValue: 0, veteranValue: 0 };
        const val = getPlayerValue(pid, allPlayers, ktcValues);
        const tradeDateValue = getPlayerValue(pid, allPlayers, getTradeSnapshot(dt));
        sideData[rid].items.push(encodePlayerItem(pid, getPlayerName(pid, allPlayers), val, tradeDateValue, dt));
        sideData[rid].vals.push(val);
        if ((allPlayers[pid]?.age || 0) >= 27) {
          sideData[rid].veteranValue += val;
        }
      }

      const picks = tx.draft_picks || [];
      for (const pick of picks) {
        const rid = pick.owner_id;
        if (!sideData[rid]) sideData[rid] = { items: [], vals: [], pickValue: 0, veteranValue: 0 };
        const val = getPickValue(
          Number(pick.season),
          pick.round,
          ktcValues,
          getDraftSlot(pick, season.draftSlotsBySeason),
          season.rosters.length
        );
        sideData[rid].items.push(
          encodePickItem(formatDraftPickLabel(pick, season.rosterMap, season.draftSlotsBySeason), val)
        );
        sideData[rid].vals.push(val);
        sideData[rid].pickValue += val;
      }

      const parts = Object.keys(sideData).map(Number);
      if (parts.length >= 2) {
        const r1 = parts[0];
        const r2 = parts[1];
        const m1 = season.rosterMap[r1] || '??';
        const m2 = season.rosterMap[r2] || '??';
        const v1 = sideData[r1].vals.reduce((a, b) => a + b, 0);
        const v2 = sideData[r2].vals.reduce((a, b) => a + b, 0);
        const adj1 = calculateValueAdjustment(
          sideData[r1].vals,
          sideData[r2].vals
        );
        const adj2 = calculateValueAdjustment(
          sideData[r2].vals,
          sideData[r1].vals
        );
        const finalV1 = v1 + adj1;
        const finalV2 = v2 + adj2;
        const pointGap = Math.abs(finalV1 - finalV2);

        managerProfits[m1] = (managerProfits[m1] || 0) + (finalV1 - finalV2);
        managerProfits[m2] = (managerProfits[m2] || 0) + (finalV2 - finalV1);
        managerActivity[m1] = (managerActivity[m1] || 0) + 1;
        managerActivity[m2] = (managerActivity[m2] || 0) + 1;
        managerTradeGaps[m1] = [...(managerTradeGaps[m1] || []), pointGap];
        managerTradeGaps[m2] = [...(managerTradeGaps[m2] || []), pointGap];
        managerTradePartners[m1] = {
          ...(managerTradePartners[m1] || {}),
          [m2]: (managerTradePartners[m1]?.[m2] || 0) + 1,
        };
        managerTradePartners[m2] = {
          ...(managerTradePartners[m2] || {}),
          [m1]: (managerTradePartners[m2]?.[m1] || 0) + 1,
        };
        managerPickNet[m1] = (managerPickNet[m1] || 0) + sideData[r1].pickValue - sideData[r2].pickValue;
        managerPickNet[m2] = (managerPickNet[m2] || 0) + sideData[r2].pickValue - sideData[r1].pickValue;
        managerVeteranNet[m1] = (managerVeteranNet[m1] || 0) + sideData[r1].veteranValue - sideData[r2].veteranValue;
        managerVeteranNet[m2] = (managerVeteranNet[m2] || 0) + sideData[r2].veteranValue - sideData[r1].veteranValue;

        const s1Text = [
          ...sideData[r1].items,
          ...(adj1 > 0 ? [`VALUE_ADJUSTMENT:+${adj1}`] : []),
        ].join(', ');
        const s2Text = [
          ...sideData[r2].items,
          ...(adj2 > 0 ? [`VALUE_ADJUSTMENT:+${adj2}`] : []),
        ].join(', ');
        const winners = chooseTradeWinners(m1, m2, finalV1, finalV2);
        winners.forEach((winner) => {
          managerWins[winner] = (managerWins[winner] || 0) + 1;
        });

        tradeRows.push({
          date: dt,
          season: season.label,
          team_a: m1,
          team_b: m2,
          team_a_items: s1Text,
          team_b_items: s2Text,
          team_a_total: finalV1,
          team_b_total: finalV2,
          point_gap: pointGap,
          winner: winners[0],
          winners,
        });
      }
    }
  }

  // Build report sections
  const managerRosterValueGrowth = Object.entries(teamData)
    .sort((a, b) => b[1].growth - a[1].growth)
    .map(([name, data]) => ({
      manager: name,
      past_val: data.past_val,
      total_val: data.total_val,
      growth: data.growth,
      rank: finalRanks[name]?.current_VALUE || 0,
    }));

  const weeklyRisers = weeklyMomentum
    .sort((a, b) => b.pct_change - a.pct_change)
    .slice(0, 15);

  const weeklyFallers = weeklyMomentum
    .sort((a, b) => a.pct_change - b.pct_change)
    .slice(0, 15);

  const leagueOverview = Object.entries(teamData)
    .sort((a, b) => b[1].total_val - a[1].total_val)
    .map(([name, data]) => ({
      manager: name,
      total_val: data.total_val,
      rank_qb: finalRanks[name]?.current_QB || 0,
      rank_rb: finalRanks[name]?.current_RB || 0,
      rank_wr: finalRanks[name]?.current_WR || 0,
      rank_te: finalRanks[name]?.current_TE || 0,
      rank_value: finalRanks[name]?.current_VALUE || 0,
      rank_2027: finalRanks[name]?.['2027_VALUE'] || 0,
    }));

  const projectedRisers = allPlayerMoves
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 20);

  const projectedFallers = allPlayerMoves
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 20);

  const tradeProfitLeaderboard = Object.entries(managerProfits)
    .sort((a, b) => b[1] - a[1])
    .map(([name, profit], idx) => ({
      rank: idx + 1,
      manager: name,
      profit,
      wins: managerWins[name] || 0,
      trade_count: managerActivity[name] || 0,
    }));

  // Sort trades oldest to newest (earliest first)
  const sortedTradeHistory = tradeRows.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB; // Ascending order: oldest first
  });

  // Calculate position depth by team
  const positionDepth: Array<{
    manager: string;
    position: string;
    count: number;
    status: 'shortage' | 'excess';
  }> = [];

  // First pass: collect all position counts to calculate dynamic thresholds
  const allPosCounts: Record<string, number[]> = { QB: [], RB: [], WR: [], TE: [] };
  const managerPosCounts: Array<{ manager: string; posCounts: Record<string, number> }> = [];

  for (const r of currentSeasonData.rosters) {
    const name = currentSeasonData.rosterMap[r.roster_id];
    const pids = r.players || [];
    const posCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };

    for (const pid of pids) {
      const p = allPlayers[pid];
      const pos = p?.position || 'UNK';
      if (pos in posCounts) {
        posCounts[pos]++;
      }
    }

    managerPosCounts.push({ manager: name, posCounts });

    // Collect counts for threshold calculation
    for (const [pos, count] of Object.entries(posCounts)) {
      if (pos in allPosCounts) {
        allPosCounts[pos].push(count);
      }
    }
  }

  // Calculate dynamic thresholds based on min/max of actual data
  const dynamicThresholds: Record<string, { shortage: number; excess: number }> = {};
  for (const [pos, counts] of Object.entries(allPosCounts)) {
    if (counts.length > 0) {
      const min = Math.min(...counts);
      const max = Math.max(...counts);
      dynamicThresholds[pos] = {
        shortage: min,
        excess: max,
      };
    }
  }

  // Second pass: identify shortages and excesses using dynamic thresholds
  for (const { manager, posCounts } of managerPosCounts) {
    for (const [pos, count] of Object.entries(posCounts)) {
      if (pos in dynamicThresholds) {
        const { shortage, excess } = dynamicThresholds[pos];

        if (count < shortage) {
          positionDepth.push({
            manager,
            position: pos,
            count,
            status: 'shortage',
          });
        } else if (count > excess) {
          positionDepth.push({
            manager,
            position: pos,
            count,
            status: 'excess',
          });
        }
      }
    }
  }

  // Create manager position counts table
  const managerPositionCounts: Array<{
    manager: string;
    QB: number;
    QB_starters: number;
    RB: number;
    RB_starters: number;
    WR: number;
    WR_starters: number;
    TE: number;
    TE_starters: number;
    starterPlayers: Array<{
      player_id: string;
      name: string;
      pos: string;
      value: number;
      currentPositionRank?: string | null;
      playerDetails?: PlayerDetails;
    }>;
  }> = [];

  for (const r of currentSeasonData.rosters) {
    const name = currentSeasonData.rosterMap[r.roster_id];
    const pids = r.players || [];
    const posCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const posStarterCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const starterPlayers: Array<{
      player_id: string;
      name: string;
      pos: string;
      value: number;
      currentPositionRank?: string | null;
      playerDetails?: PlayerDetails;
    }> = [];

    for (const pid of pids) {
      const p = allPlayers[pid];
      const pos = p?.position || 'UNK';
      if (pos in posCounts) {
        posCounts[pos]++;
        const positionRank = getPlayerKtcRank(pid, allPlayers, ktcValues);
        if (isStarterRank(pos, positionRank, starterThresholds)) {
          posStarterCounts[pos]++;
          starterPlayers.push({
            player_id: pid,
            name: getPlayerName(pid, allPlayers),
            pos,
            value: getPlayerValue(pid, allPlayers, ktcValues),
            currentPositionRank: positionRank,
            playerDetails: getPlayerDetails(pid, allPlayers),
          });
        }
      }
    }

    managerPositionCounts.push({
      manager: name,
      QB: posCounts.QB,
      QB_starters: posStarterCounts.QB,
      RB: posCounts.RB,
      RB_starters: posStarterCounts.RB,
      WR: posCounts.WR,
      WR_starters: posStarterCounts.WR,
      TE: posCounts.TE,
      TE_starters: posStarterCounts.TE,
      starterPlayers: starterPlayers.sort((a, b) => b.value - a.value),
    });
  }

  const managerRosterIntelligence = currentSeasonData.rosters.map((r) => {
    const manager = currentSeasonData.rosterMap[r.roster_id];
    const rosterPlayers = (r.players || [])
      .map((pid): (ManagerIntelPlayer & { age: number | null; isStarter: boolean }) | null => {
        const player = allPlayers[pid];
        const pos = player?.position || 'UNK';
        const currentPositionRank = getPlayerKtcRank(pid, allPlayers, ktcValues);
        const lastSeasonRank = lastSeasonPositionRanks[pid];
        const value = getPlayerValue(pid, allPlayers, ktcValues);
        if (!['QB', 'RB', 'WR', 'TE'].includes(pos) || value <= 0) return null;

        return {
          player_id: pid,
          name: getPlayerName(pid, allPlayers),
          pos,
          value,
          currentPositionRank,
          lastSeasonPositionRank: lastSeasonRank?.positionRank || null,
          lastSeasonFantasyPoints: lastSeasonRank?.fantasyPoints ?? null,
          lastSeasonYear: lastSeasonRank?.season || null,
          playerDetails: getPlayerDetails(pid, allPlayers),
          age: player?.age ?? null,
          isStarter: isStarterRank(pos, currentPositionRank, starterThresholds),
        };
      })
      .filter((player): player is ManagerIntelPlayer & { age: number | null; isStarter: boolean } => Boolean(player));

    const starters = rosterPlayers.filter((player) => player.isStarter).sort((a, b) => b.value - a.value);
    const bench = rosterPlayers.filter((player) => !player.isStarter).sort((a, b) => b.value - a.value);
    const starterValue = starters.reduce((sum, player) => sum + player.value, 0);
    const benchValue = bench.reduce((sum, player) => sum + player.value, 0);
    const totalValue = starterValue + benchValue;
    const starterValuePct = totalValue > 0 ? Math.round((starterValue / totalValue) * 100) : 0;
    const avgAge = roundOne(average(rosterPlayers.map((player) => player.age)));
    const avgAgeByPosition = {
      QB: roundOne(average(rosterPlayers.filter((player) => player.pos === 'QB').map((player) => player.age))),
      RB: roundOne(average(rosterPlayers.filter((player) => player.pos === 'RB').map((player) => player.age))),
      WR: roundOne(average(rosterPlayers.filter((player) => player.pos === 'WR').map((player) => player.age))),
      TE: roundOne(average(rosterPlayers.filter((player) => player.pos === 'TE').map((player) => player.age))),
    };

    const byPos = (pos: string) => rosterPlayers
      .filter((player) => player.pos === pos)
      .sort((a, b) => (getRankNumber(a.currentPositionRank) || 999) - (getRankNumber(b.currentPositionRank) || 999));
    const qbs = byPos('QB');
    const rbs = byPos('RB');
    const wrs = byPos('WR');
    const tes = byPos('TE');
    const rb2RankNumber = getRankNumber(rbs[1]?.currentPositionRank);
    const wr2RankNumber = getRankNumber(wrs[1]?.currentPositionRank);
    const te1RankNumber = getRankNumber(tes[0]?.currentPositionRank);
    const teamCount = currentSeasonData.rosters.length || 10;
    const coreRbLine = Math.max(1, teamCount * 2);
    const coreWrLine = Math.max(1, teamCount * 2);
    const coreTeLine = Math.max(1, teamCount);
    const flexDepthLine = {
      RB: Math.max(coreRbLine, teamCount * 3),
      WR: Math.max(coreWrLine, teamCount * 4),
      TE: Math.max(coreTeLine, Math.round(teamCount * 1.5)),
    };
    const coreFlexPlayers = [
      ...rbs.slice(0, 2).filter((player) => (getRankNumber(player.currentPositionRank) || 999) <= coreRbLine),
      ...wrs.slice(0, 2).filter((player) => (getRankNumber(player.currentPositionRank) || 999) <= coreWrLine),
    ].length;
    const benchFlexCandidates = [
      ...rbs.slice(2).filter((player) => (getRankNumber(player.currentPositionRank) || 999) <= flexDepthLine.RB),
      ...wrs.slice(2).filter((player) => (getRankNumber(player.currentPositionRank) || 999) <= flexDepthLine.WR),
      ...tes.slice(1).filter((player) => (getRankNumber(player.currentPositionRank) || 999) <= flexDepthLine.TE),
    ].length;
    const flexDepth = [
      ...rbs.filter((player) => (getRankNumber(player.currentPositionRank) || 999) <= flexDepthLine.RB),
      ...wrs.filter((player) => (getRankNumber(player.currentPositionRank) || 999) <= flexDepthLine.WR),
      ...tes.filter((player) => (getRankNumber(player.currentPositionRank) || 999) <= flexDepthLine.TE),
    ].length;
    const hasLightFlexDepth = coreFlexPlayers < 4 || benchFlexCandidates === 0;
    const holeParts = [
      !qbs[0] ? 'no ranked QB' : null,
      !rbs[1] ? 'thin RB room' : rb2RankNumber && rb2RankNumber > coreRbLine ? 'RB2 trails lineup need' : null,
      !wrs[1] ? 'thin WR room' : wr2RankNumber && wr2RankNumber > coreWrLine ? 'WR2 trails lineup need' : null,
      !tes[0] ? 'no ranked TE' : te1RankNumber && te1RankNumber > coreTeLine ? 'TE room is behind' : null,
      hasLightFlexDepth ? 'flex depth is light' : null,
    ].filter(Boolean) as string[];
    const ageFlags = [
      avgAgeByPosition.RB !== null && avgAgeByPosition.RB >= 26.5 ? 'old RB room' : null,
      avgAgeByPosition.WR !== null && avgAgeByPosition.WR <= 25 ? 'young WR core' : null,
      avgAgeByPosition.TE !== null && avgAgeByPosition.TE <= 25 ? 'young TE room' : null,
      avgAge !== null && avgAge >= 27 ? 'older roster' : null,
      avgAge !== null && avgAge <= 25 ? 'young roster' : null,
    ].filter(Boolean) as string[];
    const identity = getRosterIdentity(
      starterValuePct,
      avgAge,
      benchValue,
      totalValue,
      finalRanks[manager]?.current_VALUE || 99,
      finalRanks[manager]?.['2027_VALUE'] || 99
    );
    const contenderScore = normalizeScore(starterValue, Math.max(...Object.values(teamData).map((data) => data.total_val)));
    const rebuildScore = Math.round(((100 - starterValuePct) * 0.35) + ((avgAge !== null ? Math.max(0, 28 - avgAge) * 8 : 35) * 0.65));
    const timeline = getTimelineLabel(contenderScore, rebuildScore, avgAge !== null ? Math.max(0, avgAge - 25) * 18 : 0);
    const usedInsightPlayerIds = new Set<string>();
    const bestBenchStash = pickDistinctPlayer(bench, usedInsightPlayerIds);
    const weakestStarter = pickDistinctPlayer([...starters].sort((a, b) => a.value - b.value), usedInsightPlayerIds);
    const oldestPlayer = pickDistinctPlayer(
      [...rosterPlayers]
        .filter((player) => player.value >= 1000)
        .sort((a, b) => (b.age || 0) - (a.age || 0)) || [],
      usedInsightPlayerIds
    );
    const youngCorePlayer = pickDistinctPlayer(
      [...rosterPlayers]
        .filter((player) => (player.age || 99) <= 25 && player.value >= 2500)
        .sort((a, b) => b.value - a.value),
      usedInsightPlayerIds
    );
    const breakoutCandidate = pickDistinctPlayer(
      [...rosterPlayers]
        .filter((player) => {
          const rank = getRankNumber(player.currentPositionRank) || 999;
          const eliteLine = player.pos === 'QB' || player.pos === 'TE' ? 8 : 18;
          return (player.age || 99) <= 26 && player.value >= 1200 && rank > eliteLine;
        })
        .sort((a, b) => b.value - a.value),
      usedInsightPlayerIds
    );
    const lastSeasonStud = pickDistinctPlayer(
      [...rosterPlayers]
        .filter((player) => isLastSeasonStud(player.lastSeasonPositionRank))
        .sort((a, b) => {
          const rankDelta = (getRankNumber(a.lastSeasonPositionRank) || 999) - (getRankNumber(b.lastSeasonPositionRank) || 999);
          return rankDelta || b.value - a.value;
        }),
      usedInsightPlayerIds
    );
    const summary = buildRosterIntelligenceSummary({
      identity,
      qbs,
      rbs,
      wrs,
      tes,
      benchFlexCandidates,
      bestBenchStash,
      weakestStarter,
      youngCorePlayer,
      oldestPlayer,
      holeParts,
    });

    return {
      manager,
      identity,
      timeline,
      summary,
      starterValue,
      benchValue,
      starterValuePct,
      bestBenchStash,
      weakestStarter,
      oldestPlayer,
      youngCorePlayer,
      breakoutCandidate,
      lastSeasonStud,
      avgAge,
      avgAgeByPosition,
      ageFlags,
      holes: {
        bestQbRank: qbs[0]?.currentPositionRank || null,
        rb2Rank: rbs[1]?.currentPositionRank || null,
        wr3Rank: wrs[2]?.currentPositionRank || null,
        te1Rank: tes[0]?.currentPositionRank || null,
        flexDepth,
        summary: holeParts.length > 0 ? holeParts.join(', ') : 'No major roster hole flagged',
      },
    };
  });

  const maxTotalValue = Math.max(...Object.values(teamData).map((data) => data.total_val), 1);
  const maxStarterValue = Math.max(...managerRosterIntelligence.map((row) => row.starterValue), 1);
  const maxDraftCapital = 1;
  const maxTradeAbs = Math.max(...Object.values(managerProfits).map((profit) => Math.abs(profit)), 1);

  const tradeTendencies = Object.keys(teamData)
    .map((manager) => {
      const partners = managerTradePartners[manager] || {};
      const favoritePartner = Object.entries(partners).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const tradeCount = managerActivity[manager] || 0;
      const wins = managerWins[manager] || 0;
      return {
        manager,
        tradeCount,
        wins,
        winPct: tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0,
        profit: managerProfits[manager] || 0,
        avgGap: Math.round(average(managerTradeGaps[manager] || []) || 0),
        favoritePartner,
        overpaysForPicks: (managerPickNet[manager] || 0) < -500,
        overpaysForVeterans: (managerVeteranNet[manager] || 0) > 500 && (managerProfits[manager] || 0) < 0,
      };
    })
    .sort((a, b) => b.tradeCount - a.tradeCount || b.profit - a.profit);

  const dynastyTimelines = managerRosterIntelligence.map((intel) => {
    const data = teamData[intel.manager];
    const contenderScore = Math.round((normalizeScore(intel.starterValue, maxStarterValue) * 0.72) + (normalizeScore(data.total_val, maxTotalValue) * 0.28));
    const outlook2027 = Math.round(100 - ((finalRanks[intel.manager]?.['2027_VALUE'] || currentSeasonData.rosters.length) - 1) * (100 / Math.max(1, currentSeasonData.rosters.length - 1)));
    const agingRisk = Math.round(Math.max(0, ((intel.avgAge || 25) - 25) * 18));
    const rebuildScore = Math.round((outlook2027 * 0.42) + ((100 - contenderScore) * 0.28) + (Math.max(0, 28 - (intel.avgAge || 28)) * 8));
    return {
      manager: intel.manager,
      contenderScore,
      outlook2027,
      agingRisk,
      rebuildScore,
      label: getTimelineLabel(contenderScore, rebuildScore, agingRisk),
    };
  });

  const powerRankings = managerRosterIntelligence
    .map((intel) => {
      const data = teamData[intel.manager];
      const starterStrength = Math.round(normalizeScore(intel.starterValue, maxStarterValue));
      const rosterValue = Math.round(normalizeScore(data.total_val, maxTotalValue));
      const positionalRanks = ['QB', 'RB', 'WR', 'TE'].map((pos) => finalRanks[intel.manager]?.[`current_${pos}`] || currentSeasonData.rosters.length);
      const positionalBalance = Math.round(100 - ((Math.max(...positionalRanks) - Math.min(...positionalRanks)) * (100 / Math.max(1, currentSeasonData.rosters.length))));
      const draftCapital = Math.round(normalizeScore(0, maxDraftCapital));
      const youthScore = Math.round(Math.max(0, Math.min(100, 100 - (((intel.avgAge || 26) - 24) * 13))));
      const tradeEfficiency = Math.round(50 + ((managerProfits[intel.manager] || 0) / maxTradeAbs) * 50);
      const score = Math.round(
        starterStrength * 0.28 +
        rosterValue * 0.24 +
        positionalBalance * 0.16 +
        draftCapital * 0.08 +
        youthScore * 0.14 +
        tradeEfficiency * 0.10
      );
      return {
        rank: 0,
        manager: intel.manager,
        score,
        tier: getTier(score),
        starterStrength,
        rosterValue,
        positionalBalance,
        draftCapital,
        youthScore,
        tradeEfficiency,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    managerRosterValueGrowth,
    weeklyRisers,
    weeklyFallers,
    leagueOverview,
    projectedRisers,
    projectedFallers,
    tradeProfitLeaderboard,
    tradeHistory: sortedTradeHistory,
    positionDepth,
    managerPositionCounts,
    managerRosterIntelligence,
    tradeTendencies,
    powerRankings,
    dynastyTimelines,
  };
}
