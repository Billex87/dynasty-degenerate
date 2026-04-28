import {
  cleanName,
  getPlayerName,
  getPlayerValue,
  getPickValue,
  projectValue,
  calculateValueAdjustment,
} from './leagueAnalysis';
import type { ReportData } from '../shared/types';

export interface KTCValues {
  [key: string]: { name: string; ktc_value: number };
}

interface Player {
  [key: string]: {
    first_name?: string;
    last_name?: string;
    position?: string;
    age?: number;
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

function encodePlayerItem(pid: string, name: string): string {
  return `PLAYER:${pid}|${name}`;
}

function encodePickItem(label: string, value: number): string {
  return `PICK:${label}|${value}`;
}

function chooseTradeWinner(
  managerA: string,
  managerB: string,
  valueA: number,
  valueB: number
): string {
  if (valueA > valueB) return managerA;
  if (valueB > valueA) return managerB;
  if (managerA === 'mynameisbillex' || managerB === 'mynameisbillex') {
    return 'mynameisbillex';
  }
  return managerA;
}

export async function generateReport(
  currentSeasonData: SeasonData,
  pastSeasonData: SeasonData | null,
  allPlayers: Player,
  ktcValues: KTCValues,
  ktcValuesLastWeek: KTCValues
): Promise<ReportData> {
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
        sideData[rid].items.push(encodePlayerItem(pid, getPlayerName(pid, allPlayers)));
        sideData[rid].vals.push(val);
      }

      const picks = tx.draft_picks || [];
      for (const pick of picks) {
        const rid = pick.owner_id;
        if (!sideData[rid]) sideData[rid] = { items: [], vals: [] };
        const val = getPickValue(Number(pick.season), pick.round, ktcValues);
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
        const winner = chooseTradeWinner(m1, m2, finalV1, finalV2);

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
          winner,
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
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 15);

  const weeklyFallers = weeklyMomentum
    .sort((a, b) => a.diff - b.diff)
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
  }> = [];

  for (const r of currentSeasonData.rosters) {
    const name = currentSeasonData.rosterMap[r.roster_id];
    const pids = r.players || [];
    const posCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const posStarterCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };

    for (const pid of pids) {
      const p = allPlayers[pid];
      const pos = p?.position || 'UNK';
      if (pos in posCounts) {
        posCounts[pos]++;
        // Check if player value > 4000 (starter threshold)
        const playerValue = ktcValues[pid]?.ktc_value || 0;
        if (playerValue > 4000) {
          posStarterCounts[pos]++;
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
