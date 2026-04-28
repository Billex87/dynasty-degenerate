import {
  cleanName,
  getPlayerName,
  getPlayerValue,
  getPickValue,
  projectValue,
  calculateValueAdjustment,
} from './leagueAnalysis';
import { loadLatestLocalKtcSnapshotBefore } from './ktcLoader';
import type { PlayerDetails, ReportData } from '../shared/types';

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

export async function generateReport(
  currentSeasonData: SeasonData,
  pastSeasonData: SeasonData | null,
  allPlayers: Player,
  ktcValues: KTCValues,
  ktcValuesLastWeek: KTCValues
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
        { items: string[]; vals: number[] }
      > = {};

      const adds = tx.adds || {};
      for (const [pid, rid] of Object.entries(adds)) {
        if (!sideData[rid]) sideData[rid] = { items: [], vals: [] };
        const val = getPlayerValue(pid, allPlayers, ktcValues);
        const tradeDateValue = getPlayerValue(pid, allPlayers, getTradeSnapshot(dt));
        sideData[rid].items.push(encodePlayerItem(pid, getPlayerName(pid, allPlayers), val, tradeDateValue, dt));
        sideData[rid].vals.push(val);
      }

      const picks = tx.draft_picks || [];
      for (const pick of picks) {
        const rid = pick.owner_id;
        if (!sideData[rid]) sideData[rid] = { items: [], vals: [] };
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

        managerProfits[m1] = (managerProfits[m1] || 0) + (finalV1 - finalV2);
        managerProfits[m2] = (managerProfits[m2] || 0) + (finalV2 - finalV1);
        managerActivity[m1] = (managerActivity[m1] || 0) + 1;
        managerActivity[m2] = (managerActivity[m2] || 0) + 1;

        const s1Text = [
          ...sideData[r1].items,
          ...(adj1 > 0 ? [`VALUE_ADJUSTMENT:+${adj1}`] : []),
        ].join(', ');
        const s2Text = [
          ...sideData[r2].items,
          ...(adj2 > 0 ? [`VALUE_ADJUSTMENT:+${adj2}`] : []),
        ].join(', ');
        const pointGap = Math.abs(finalV1 - finalV2);
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
  };
}
