import {
  cleanName,
  getPlayerName,
  getPlayerKtcMarketValue,
  getPlayerRedraftValue,
  getPlayerValue,
  getPickValue,
  projectValue,
  calculateValueAdjustment,
} from './leagueAnalysis';
import { loadLatestLocalKtcSnapshotBefore } from './ktcLoader';
import type { LeagueValueMode, ManagerIntelPlayer, PlayerDetails, ReportData, TaxiTriageAction, TaxiTriageItem } from '../shared/types';

export interface KTCValues {
  [key: string]: {
    name: string;
    ktc_value: number;
    position_rank?: string;
    dynasty_value?: number;
    true_value?: number;
    redraft_value?: number;
    market_value_ktc?: number;
    market_value_fantasycalc?: number;
    expert_value_dynastyprocess?: number;
    fantasypros_rank?: number;
    fantasypros_position_rank?: string | null;
    fantasypros_tier?: number | null;
    fantasypros_season_value?: number;
    value_sources?: string[];
  };
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
  games?: number | null;
  pointsPerGame?: number | null;
  season?: string;
}

interface Roster {
  roster_id: number;
  owner_id: string;
  players: string[];
  taxi?: string[];
  reserve?: string[];
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
  rosterPositions?: string[];
}

interface ReportOptions {
  leagueValueMode?: LeagueValueMode;
}

type StarterThresholds = Record<'QB' | 'RB' | 'WR' | 'TE', number>;
type FantasyPosition = keyof StarterThresholds;

const FANTASY_POSITIONS: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE'];
const BENCH_ROSTER_SLOTS = new Set(['BN', 'BE', 'BENCH', 'IR', 'TAXI', 'RESERVE']);
const DEFAULT_STARTER_SLOTS = ['QB', 'SUPER_FLEX', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX'];
const FLEX_ELIGIBILITY: Record<string, FantasyPosition[]> = {
  FLEX: ['RB', 'WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  WRRBTE_FLEX: ['RB', 'WR', 'TE'],
  REC_FLEX: ['RB', 'WR', 'TE'],
};

function getStarterThresholds(teamCount: number): StarterThresholds {
  return {
    QB: Math.max(1, Math.round(teamCount * 2)),
    RB: Math.max(1, Math.round(teamCount * 3)),
    WR: Math.max(1, Math.round(teamCount * 4)),
    TE: Math.max(1, Math.round(teamCount * 1.5)),
  };
}

function normalizePlayerIds(ids: Array<string | number | null | undefined> | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const id of ids || []) {
    if (id === null || id === undefined) continue;
    const key = String(id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return normalized;
}

function getTaxiPlayerIds(roster: Pick<Roster, 'taxi'> | undefined): string[] {
  return normalizePlayerIds(roster?.taxi);
}

function getReservePlayerIds(roster: Pick<Roster, 'reserve'> | undefined): string[] {
  return normalizePlayerIds(roster?.reserve);
}

function getInactivePlayerIdSet(roster: Pick<Roster, 'taxi' | 'reserve'> | undefined): Set<string> {
  return new Set([...getTaxiPlayerIds(roster), ...getReservePlayerIds(roster)]);
}

function getActivePlayerIds(roster: Pick<Roster, 'players' | 'taxi' | 'reserve'>): string[] {
  const inactiveIds = getInactivePlayerIdSet(roster);
  return normalizePlayerIds(roster.players).filter((pid) => !inactiveIds.has(pid));
}

function normalizeRosterSlot(slot: string): string {
  return String(slot || '').toUpperCase();
}

function getStarterRosterSlots(rosterPositions?: string[]): string[] {
  const slots = (rosterPositions || [])
    .map(normalizeRosterSlot)
    .filter((slot) => slot && !BENCH_ROSTER_SLOTS.has(slot));

  return slots.length ? slots : DEFAULT_STARTER_SLOTS;
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

function normalizeAvailabilityStatus(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const label = String(value).replace(/_/g, ' ').trim();
  if (!label) return null;
  if (/^(active|healthy)$/i.test(label)) return null;
  return label;
}

function getDisplayStatus(player: Player[string] | undefined, rosterStatus?: string | null): string {
  const rosterLabel = normalizeAvailabilityStatus(rosterStatus);
  if (rosterLabel) return rosterLabel;

  const injuryLabel = normalizeAvailabilityStatus(player?.injury_status);
  if (injuryLabel) return injuryLabel;

  return normalizeAvailabilityStatus(player?.status) || 'Active';
}

function getRosterPlayerStatus(roster: Roster | undefined, playerId: string): string | null {
  if (getReservePlayerIds(roster).includes(playerId)) return 'IR';
  if (getTaxiPlayerIds(roster).includes(playerId)) return 'Taxi';
  return null;
}

function getPlayerDetails(pid: string, allPlayers: Player, rosterStatus?: string | null): PlayerDetails | undefined {
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
    rosterStatus: rosterStatus ?? null,
    displayStatus: getDisplayStatus(player, rosterStatus),
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

function buildSeasonPositionRanks(
  playerIds: string[],
  allPlayers: Player,
  ktcValues: KTCValues
): Record<string, string | null> {
  const byPosition: Record<'QB' | 'RB' | 'WR' | 'TE', Array<{ pid: string; value: number }>> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
  };
  const seen = new Set<string>();

  for (const pid of playerIds) {
    if (seen.has(pid)) continue;
    seen.add(pid);
    const pos = allPlayers[pid]?.position;
    if (!pos || !(pos in byPosition)) continue;
    const seasonValue = getPlayerRedraftValue(pid, allPlayers, ktcValues) || getPlayerValue(pid, allPlayers, ktcValues);
    if (seasonValue <= 0) continue;
    byPosition[pos as keyof typeof byPosition].push({ pid, value: seasonValue });
  }

  const ranks: Record<string, string | null> = {};
  for (const [pos, players] of Object.entries(byPosition)) {
    players
      .sort((a, b) => b.value - a.value)
      .forEach((player, index) => {
        ranks[player.pid] = `${pos}${index + 1}`;
      });
  }

  return ranks;
}

function getRankNumber(positionRank: string | null | undefined): number | null {
  const rankNumber = Number(positionRank?.match(/\d+/)?.[0]);
  return Number.isFinite(rankNumber) ? rankNumber : null;
}

function isFantasyPosition(position: string): position is FantasyPosition {
  return FANTASY_POSITIONS.includes(position as FantasyPosition);
}

function getLineupRank(player: Pick<ManagerIntelPlayer, 'seasonPositionRank' | 'currentPositionRank'>): number {
  return getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999;
}

function compareLineupPlayers<T extends Pick<ManagerIntelPlayer, 'seasonValue' | 'value' | 'seasonPositionRank' | 'currentPositionRank'>>(
  a: T,
  b: T
): number {
  const rankDelta = getLineupRank(a) - getLineupRank(b);
  if (rankDelta !== 0) return rankDelta;
  return (b.seasonValue || b.value) - (a.seasonValue || a.value);
}

function selectProjectedLineup<T extends ManagerIntelPlayer>(players: T[], rosterPositions?: string[]): T[] {
  const slots = getStarterRosterSlots(rosterPositions);
  const remaining = players
    .filter((player) => isFantasyPosition(player.pos))
    .sort(compareLineupPlayers);
  const selected: T[] = [];

  const takeBest = (eligiblePositions: FantasyPosition[]): void => {
    const index = remaining.findIndex((player) => eligiblePositions.includes(player.pos as FantasyPosition));
    if (index < 0) return;
    const [player] = remaining.splice(index, 1);
    selected.push(player);
  };

  for (const position of FANTASY_POSITIONS) {
    const fixedSlotCount = slots.filter((slot) => slot === position).length;
    for (let i = 0; i < fixedSlotCount; i += 1) {
      takeBest([position]);
    }
  }

  for (const slot of slots) {
    const eligiblePositions = FLEX_ELIGIBILITY[slot];
    if (eligiblePositions) {
      takeBest(eligiblePositions);
    }
  }

  return selected;
}

function playerWouldMakeProjectedLineup<T extends ManagerIntelPlayer>(
  player: T,
  activePlayers: T[],
  rosterPositions?: string[]
): boolean {
  return selectProjectedLineup([...activePlayers, player], rosterPositions)
    .some((lineupPlayer) => lineupPlayer.player_id === player.player_id);
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
  if (contenderScore >= 84 && contenderScore - rebuildScore >= 18 && agingRisk >= 55) return 'Win now, monitor age';
  if (contenderScore >= 84 && contenderScore - rebuildScore >= 18) return 'True contender';
  if (rebuildScore >= 68 && rebuildScore - contenderScore >= 10) return 'Rebuild mode';
  if (contenderScore >= 70 && rebuildScore >= 52) return 'Fork in road';
  if (contenderScore >= 64) return 'Playoff mix';
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
  return player?.currentPositionRank || player?.seasonPositionRank || player?.pos || 'unranked';
}

function getPlayerGamesMissed(player?: ManagerIntelPlayer | null): number | null {
  if (!player || typeof player.lastSeasonGames !== 'number') return null;
  return Math.max(0, 17 - player.lastSeasonGames);
}

function getAvailabilityRisk(avgGamesMissed: number | null): 'low' | 'medium' | 'high' {
  if (avgGamesMissed === null) return 'medium';
  if (avgGamesMissed >= 3) return 'high';
  if (avgGamesMissed >= 1.5) return 'medium';
  return 'low';
}

function createTaxiCounts(): Record<TaxiTriageAction, number> {
  return {
    'Promote Now': 0,
    'Keep Parked': 0,
    'Trade Sweetener': 0,
    Cuttable: 0,
    'Taxi Risk': 0,
  };
}

function getTaxiAgeRiskLine(position: string): number {
  if (position === 'RB') return 24.5;
  if (position === 'WR') return 25.5;
  if (position === 'TE') return 26.5;
  if (position === 'QB') return 27.5;
  return 25.5;
}

function getTaxiTriageAction({
  player,
  starterThresholds,
  needPosition,
  wouldStart,
}: {
  player: ManagerIntelPlayer;
  starterThresholds: StarterThresholds;
  needPosition: 'QB' | 'RB' | 'WR' | 'TE' | null;
  wouldStart: boolean;
}): { action: TaxiTriageAction; reason: string; score: number } {
  const position = player.pos as keyof StarterThresholds;
  const starterLine = starterThresholds[position] || 0;
  const rankNumber = getRankNumber(player.seasonPositionRank || player.currentPositionRank);
  const age = player.playerDetails?.age ?? null;
  const seasonValue = player.seasonValue || player.value;
  const fillsNeed = needPosition === player.pos;
  const depthLine = Math.round(starterLine * 1.75);

  if (wouldStart) {
    return {
      action: 'Promote Now',
      reason: `${getRankLabel(player)} would crack the projected starting lineup${fillsNeed ? ` and directly answers the ${player.pos} need` : ''}. This is a real activation, not just bench depth.`,
      score: 6500 + seasonValue,
    };
  }

  if (player.value < 450 && (!rankNumber || rankNumber > depthLine)) {
    return {
      action: 'Cuttable',
      reason: `Low dynasty value and no useful positional-rank signal yet. This is the first taxi spot to churn if waivers produce a better stash.`,
      score: 1000 - player.value,
    };
  }

  if (player.value >= 1800) {
    return {
      action: 'Trade Sweetener',
      reason: `${getRankLabel(player)} still carries enough dynasty value to matter in a deal, but does not force a promotion yet.`,
      score: 4000 + player.value,
    };
  }

  if (age !== null && age >= getTaxiAgeRiskLine(player.pos)) {
    return {
      action: 'Taxi Risk',
      reason: `${age} years old is getting late for a taxi stash at ${player.pos}. This player needs a role soon or the roster spot gets expensive.`,
      score: 2000 + player.value,
    };
  }

  if (player.value >= 700 || (rankNumber !== null && rankNumber <= depthLine)) {
    return {
      action: 'Keep Parked',
      reason: `Young or ranked enough to keep developing, but not urgent enough to activate over current roster pieces.`,
      score: 3000 + player.value,
    };
  }

  return {
    action: 'Cuttable',
    reason: `No clear dynasty value, rank, or near-term role signal. Treat this as a churnable taxi stash.`,
    score: 1000 - player.value,
  };
}

function buildTaxiTriageSummary(items: TaxiTriageItem[]): string {
  if (!items.length) return 'No taxi players reported by Sleeper for this roster.';

  const counts = items.reduce((acc, item) => {
    acc[item.taxiAction] = (acc[item.taxiAction] || 0) + 1;
    return acc;
  }, createTaxiCounts());
  const parts = [
    counts['Promote Now'] ? `${counts['Promote Now']} should be promoted` : null,
    counts['Keep Parked'] ? `${counts['Keep Parked']} can stay parked` : null,
    counts['Trade Sweetener'] ? `${counts['Trade Sweetener']} work as trade sweeteners` : null,
    counts['Taxi Risk'] ? `${counts['Taxi Risk']} are taxi risks` : null,
    counts.Cuttable ? `${counts.Cuttable} look cuttable` : null,
  ].filter(Boolean);

  return `Taxi squad read: ${parts.join(', ')}.`;
}

function describeAvailability(riskiestStarter: ManagerIntelPlayer | null, avgGamesMissed: number | null): string {
  if (!riskiestStarter || avgGamesMissed === null) return 'Availability data is still light, so this roster should be judged mostly by current positional rank.';
  const missed = getPlayerGamesMissed(riskiestStarter);
  if (avgGamesMissed >= 3) {
    return `Availability is a real concern: projected starters averaged ${avgGamesMissed.toFixed(1)} missed games last season, led by ${riskiestStarter.name}${missed !== null ? ` at ${missed} missed games` : ''}.`;
  }
  if (avgGamesMissed >= 1.5) {
    return `Availability is manageable but not clean: starters averaged ${avgGamesMissed.toFixed(1)} missed games, so bench insurance matters.`;
  }
  return `Availability looks stable: projected starters averaged only ${avgGamesMissed.toFixed(1)} missed games last season.`;
}

function compactPlayerBlurb(player?: ManagerIntelPlayer | null): string | null {
  if (!player) return null;
  return `${player.name} (${getRankLabel(player)})`;
}

function rowHandoffText({
  contenderScore,
  rebuildScore,
  avgAge,
  starterValuePct,
  bestBenchStash,
  oldestPlayer,
  youngCorePlayer,
}: {
  contenderScore: number;
  rebuildScore: number;
  avgAge: number | null;
  starterValuePct: number;
  bestBenchStash: ManagerIntelPlayer | null;
  oldestPlayer: ManagerIntelPlayer | null;
  youngCorePlayer: ManagerIntelPlayer | null;
}): string {
  if (contenderScore >= 76 && oldestPlayer) {
    return `Clock management: this team can contend, but ${oldestPlayer.name} is the veteran fuse; do not let that asset expire without either a title run or a younger replacement.`;
  }
  if (rebuildScore > contenderScore && youngCorePlayer) {
    return `Rebuild lever: ${youngCorePlayer.name} is the anchor; every trade should either protect that window or add another asset on the same timeline.`;
  }
  if (starterValuePct < 48 && bestBenchStash) {
    return `Bench hoarder alert: too much value is parked outside the weekly lineup; ${bestBenchStash.name} is the first chip to convert into a starter.`;
  }
  return `Build tension: contender ${Math.round(contenderScore)}, rebuild ${Math.round(rebuildScore)}, age ${avgAge ?? '-'}; this roster should avoid cute sideways trades until the next move clearly changes the lineup.`;
}

function rowValueTrapText({
  sellCandidate,
  buyTarget,
  isContenderBuild,
}: {
  sellCandidate: ManagerIntelPlayer | null;
  buyTarget: ManagerIntelPlayer | null;
  isContenderBuild: boolean;
}): string | null {
  if (sellCandidate && buyTarget) {
    return `${isContenderBuild ? 'Contender arbitrage' : 'Rebuild arbitrage'}: turn ${sellCandidate.name} into ${buyTarget.name} if the other manager values name-brand dynasty points more than the position need.`;
  }
  if (sellCandidate) return `Value trap watch: ${sellCandidate.name} is movable if another manager still prices him like a core piece.`;
  if (buyTarget) return `Sneaky add: ${buyTarget.name} fits the roster shape better than the raw value table suggests.`;
  return null;
}

function rowRosterExploitText({
  qbs,
  rbs,
  wrs,
  tes,
  flexDepth,
  teamCount,
}: {
  qbs: ManagerIntelPlayer[];
  rbs: ManagerIntelPlayer[];
  wrs: ManagerIntelPlayer[];
  tes: ManagerIntelPlayer[];
  flexDepth: number;
  teamCount: number;
}): string {
  const qb2 = getRankLabel(qbs[1]);
  const rb2 = getRankLabel(rbs[1]);
  const wr3 = getRankLabel(wrs[2]);
  const te1 = getRankLabel(tes[0]);
  const danger: string[] = [];
  if ((getRankNumber(qb2) || 999) > teamCount * 2) danger.push(`superflex gets shaky after ${qbs[0]?.name || 'QB1'}`);
  if ((getRankNumber(rb2) || 999) > teamCount * 2.5) danger.push(`RB2 is attackable at ${rb2}`);
  if ((getRankNumber(wr3) || 999) > teamCount * 3.5) danger.push(`WR3 is thin at ${wr3}`);
  if ((getRankNumber(te1) || 999) > Math.ceil(teamCount * 1.2)) danger.push(`TE leaks points at ${te1}`);
  if (flexDepth < 4) danger.push('one flex injury changes the weekly ceiling');
  if (danger.length) return `Exploit map: ${danger.join('; ')}.`;
  return `Exploit map: no obvious weekly pressure point; you probably need a premium offer or a manager-preference angle to crack this roster.`;
}

function gradeRank(rank: number | null, eliteLine: number, usableLine: number, depthLine: number) {
  if (!rank) return 'Empty';
  if (rank <= eliteLine) return 'Elite';
  if (rank <= usableLine) return 'Strong';
  if (rank <= depthLine) return 'Playable';
  return 'Problem';
}

function buildPositionGrades({
  qbs,
  rbs,
  wrs,
  tes,
  teamCount,
}: {
  qbs: ManagerIntelPlayer[];
  rbs: ManagerIntelPlayer[];
  wrs: ManagerIntelPlayer[];
  tes: ManagerIntelPlayer[];
  teamCount: number;
}) {
  const make = (
    pos: 'QB' | 'RB' | 'WR' | 'TE',
    player: ManagerIntelPlayer | undefined,
    eliteLine: number,
    usableLine: number,
    depthLine: number,
    noteTarget: string
  ) => {
    const rank = getRankNumber(player?.seasonPositionRank || player?.currentPositionRank);
    const grade = gradeRank(rank, eliteLine, usableLine, depthLine);
    const note = player
      ? `${noteTarget} is ${player.name} (${getRankLabel(player)}), which grades as ${grade.toLowerCase()} for this league size.`
      : `No ranked ${pos} option found.`;
    return { rank, grade, note };
  };

  return {
    QB: make('QB', qbs[1] || qbs[0], teamCount, teamCount * 2, teamCount * 3, qbs[1] ? 'QB2' : 'QB1'),
    RB: make('RB', rbs[1] || rbs[0], teamCount, teamCount * 2, teamCount * 3, rbs[1] ? 'RB2' : 'RB1'),
    WR: make('WR', wrs[2] || wrs[1] || wrs[0], teamCount, teamCount * 3, teamCount * 4, wrs[2] ? 'WR3' : wrs[1] ? 'WR2' : 'WR1'),
    TE: make('TE', tes[0], Math.ceil(teamCount * 0.5), teamCount, Math.ceil(teamCount * 1.5), 'TE1'),
  };
}

function buildPressurePoints({
  qbs,
  rbs,
  wrs,
  tes,
  benchFlexCandidates,
  riskiestStarter,
  avgStarterGamesMissed,
  teamCount,
}: {
  qbs: ManagerIntelPlayer[];
  rbs: ManagerIntelPlayer[];
  wrs: ManagerIntelPlayer[];
  tes: ManagerIntelPlayer[];
  benchFlexCandidates: number;
  riskiestStarter: ManagerIntelPlayer | null;
  avgStarterGamesMissed: number | null;
  teamCount: number;
}) {
  const points: string[] = [];
  const qb2 = getRankNumber(qbs[1]?.seasonPositionRank || qbs[1]?.currentPositionRank);
  const rb3 = getRankNumber(rbs[2]?.seasonPositionRank || rbs[2]?.currentPositionRank);
  const wr4 = getRankNumber(wrs[3]?.seasonPositionRank || wrs[3]?.currentPositionRank);
  const te2 = getRankNumber(tes[1]?.seasonPositionRank || tes[1]?.currentPositionRank);
  if (!qbs[1] || (qb2 && qb2 > teamCount * 2.3)) points.push('Superflex depth can get ugly if QB1 misses time.');
  if (!rbs[2] || (rb3 && rb3 > teamCount * 3.2)) points.push('RB injury insurance is thin behind the top two.');
  if (!wrs[3] || (wr4 && wr4 > teamCount * 4.2)) points.push('WR depth falls off before the weekly flex cushion.');
  if (!tes[1] || (te2 && te2 > teamCount * 2)) points.push('No real TE contingency plan if the starter gets hurt.');
  if (benchFlexCandidates <= 1) points.push('Bench flex depth is light enough that one injury changes weekly decisions.');
  if (riskiestStarter && avgStarterGamesMissed !== null && avgStarterGamesMissed >= 2.5) {
    points.push(`${riskiestStarter.name} is the injury-tax negotiation point at ${avgStarterGamesMissed} missed games per starter.`);
  }
  return points.slice(0, 5);
}

function buildMarketSignals({
  rosterPlayers,
  buyTarget,
  sellCandidate,
  isContenderBuild,
}: {
  rosterPlayers: Array<ManagerIntelPlayer & { age?: number | null; isStarter?: boolean }>;
  buyTarget: ManagerIntelPlayer | null;
  sellCandidate: ManagerIntelPlayer | null;
  isContenderBuild: boolean;
}) {
  const signals: string[] = [];
  const redraftDiscount = rosterPlayers
    .filter((player) => (player.seasonValue || 0) - player.value >= 800)
    .sort((a, b) => ((b.seasonValue || 0) - b.value) - ((a.seasonValue || 0) - a.value))[0];
  const dynastyPremium = rosterPlayers
    .filter((player) => player.value - (player.seasonValue || 0) >= 800)
    .sort((a, b) => (b.value - (b.seasonValue || 0)) - (a.value - (a.seasonValue || 0)))[0];
  const agingProducer = rosterPlayers
    .filter((player) => (player.age || 0) >= (player.pos === 'RB' ? 27 : player.pos === 'WR' ? 29 : player.pos === 'TE' ? 30 : 33) && (player.seasonValue || player.value) >= 2500)
    .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value))[0];
  const youthHype = rosterPlayers
    .filter((player) => (player.age || 99) <= 24 && player.value >= (player.seasonValue || 0) + 700)
    .sort((a, b) => b.value - a.value)[0];

  if (redraftDiscount) signals.push(`${redraftDiscount.name} has more current-season utility than dynasty price, a contender-friendly hold/buy.`);
  if (dynastyPremium) signals.push(`${dynastyPremium.name} is dynasty-priced above current-season projection, so rebuilders can hold but contenders should ask what the market pays.`);
  if (agingProducer) signals.push(`${agingProducer.name} is an aging producer: useful for a title push, dangerous as a long-term store of value.`);
  if (youthHype) signals.push(`${youthHype.name} carries youth premium; do not sell low, but use the name value if the roster needs weekly points.`);
  if (buyTarget) signals.push(`External target profile: ${buyTarget.name} fits the roster need better than a generic best-player trade.`);
  if (sellCandidate) signals.push(`Internal liquidity: ${sellCandidate.name} is the cleanest piece to shop without cracking the core plan.`);
  if (isContenderBuild) signals.push('Contender lens: prefer redraft production and injury insulation over pure dynasty value.');
  else signals.push('Future lens: prefer age/value growth and picks over short-window production.');
  return signals.slice(0, 6);
}

function buildTradeBlueprints({
  tradePlan,
  buyTarget,
  sellCandidate,
  tradeChip,
  injuryInsurance,
  oldestPlayer,
  youngCorePlayer,
  isContenderBuild,
}: {
  tradePlan: { needPosition: 'QB' | 'RB' | 'WR' | 'TE' | null; surplusPosition: 'QB' | 'RB' | 'WR' | 'TE' | null; summary: string };
  buyTarget: ManagerIntelPlayer | null;
  sellCandidate: ManagerIntelPlayer | null;
  tradeChip: ManagerIntelPlayer | null;
  injuryInsurance: ManagerIntelPlayer | null;
  oldestPlayer: ManagerIntelPlayer | null;
  youngCorePlayer: ManagerIntelPlayer | null;
  isContenderBuild: boolean;
}) {
  return [
    buyTarget && sellCandidate ? {
      label: 'Need Swap',
      summary: `Trade from ${tradePlan.surplusPosition || 'surplus'} into ${tradePlan.needPosition || 'need'}: ${sellCandidate.name} for ${buyTarget.name} is the clean starting point.`,
      givePlayer: sellCandidate,
      getPlayer: buyTarget,
      tone: 'buy' as const,
    } : null,
    tradeChip && buyTarget ? {
      label: 'Two-for-One Ladder',
      summary: `Use ${tradeChip.name} as the add-on piece if it turns a decent offer into ${buyTarget.name}.`,
      givePlayer: tradeChip,
      getPlayer: buyTarget,
      tone: 'value' as const,
    } : null,
    isContenderBuild && injuryInsurance ? {
      label: 'Injury Hedge',
      summary: `${injuryInsurance.name} is the internal insurance piece; do not throw him into a deal unless it clearly upgrades a starter.`,
      givePlayer: injuryInsurance,
      tone: 'risk' as const,
    } : null,
    !isContenderBuild && oldestPlayer && youngCorePlayer ? {
      label: 'Timeline Flip',
      summary: `Shop ${oldestPlayer.name}'s name value for younger assets built around the ${youngCorePlayer.name} timeline.`,
      givePlayer: oldestPlayer,
      getPlayer: youngCorePlayer,
      tone: 'sell' as const,
    } : null,
  ].filter(Boolean).slice(0, 4) as Array<{
    label: string;
    summary: string;
    givePlayer?: ManagerIntelPlayer | null;
    getPlayer?: ManagerIntelPlayer | null;
    tone?: 'buy' | 'sell' | 'risk' | 'value';
  }>;
}

function calculateRosterHealthScore({
  starterValuePct,
  contenderScore,
  rebuildScore,
  avgStarterGamesMissed,
  flexDepth,
  holeCount,
  ageFlagCount,
}: {
  starterValuePct: number;
  contenderScore: number;
  rebuildScore: number;
  avgStarterGamesMissed: number | null;
  flexDepth: number;
  holeCount: number;
  ageFlagCount: number;
}) {
  const availabilityPenalty = avgStarterGamesMissed === null ? 5 : Math.min(25, avgStarterGamesMissed * 4);
  const depthBonus = Math.min(15, flexDepth * 3);
  const directionScore = Math.max(contenderScore, rebuildScore) * 0.35;
  const starterShape = Math.min(25, starterValuePct * 0.28);
  const penalties = availabilityPenalty + holeCount * 7 + ageFlagCount * 2;
  return Math.max(1, Math.min(99, Math.round(directionScore + starterShape + depthBonus + 35 - penalties)));
}

function getSeasonValue(player: ManagerIntelPlayer, allPlayers: Player, ktcValues: KTCValues): number {
  return getPlayerRedraftValue(player.player_id, allPlayers, ktcValues) || player.value;
}

function getSeasonArbitrage(player: ManagerIntelPlayer, allPlayers: Player, ktcValues: KTCValues): number {
  return getSeasonValue(player, allPlayers, ktcValues) - player.value;
}

function getNeedPosition({
  qbs,
  rbs,
  wrs,
  tes,
  holeParts,
}: {
  qbs: ManagerIntelPlayer[];
  rbs: ManagerIntelPlayer[];
  wrs: ManagerIntelPlayer[];
  tes: ManagerIntelPlayer[];
  holeParts: string[];
}): 'QB' | 'RB' | 'WR' | 'TE' | null {
  if (holeParts.some((part) => part.includes('WR'))) return 'WR';
  if (holeParts.some((part) => part.includes('RB'))) return 'RB';
  if (holeParts.some((part) => part.includes('TE'))) return 'TE';
  if (holeParts.some((part) => part.includes('QB'))) return 'QB';
  const candidates: Array<{ pos: 'QB' | 'RB' | 'WR' | 'TE'; rank: number }> = [
    { pos: 'QB', rank: getRankNumber(qbs[1]?.seasonPositionRank || qbs[1]?.currentPositionRank) || getRankNumber(qbs[0]?.seasonPositionRank || qbs[0]?.currentPositionRank) || 999 },
    { pos: 'RB', rank: getRankNumber(rbs[1]?.seasonPositionRank || rbs[1]?.currentPositionRank) || 999 },
    { pos: 'WR', rank: getRankNumber(wrs[2]?.seasonPositionRank || wrs[2]?.currentPositionRank) || getRankNumber(wrs[1]?.seasonPositionRank || wrs[1]?.currentPositionRank) || 999 },
    { pos: 'TE', rank: getRankNumber(tes[0]?.seasonPositionRank || tes[0]?.currentPositionRank) || 999 },
  ];
  return candidates.sort((a, b) => b.rank - a.rank)[0]?.pos || null;
}

function getPositionDepthScore(players: ManagerIntelPlayer[], position: 'QB' | 'RB' | 'WR' | 'TE'): number {
  const starterLine = position === 'QB' ? 2 : position === 'RB' ? 3 : position === 'WR' ? 4 : 2;
  return players
    .filter((player) => player.pos === position)
    .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value))
    .slice(0, starterLine)
    .reduce((sum, player) => sum + (player.seasonValue || player.value), 0);
}

function getSurplusPosition(
  rosterPlayers: Array<ManagerIntelPlayer & { isStarter?: boolean }>,
  needPosition: 'QB' | 'RB' | 'WR' | 'TE' | null
): 'QB' | 'RB' | 'WR' | 'TE' | null {
  const positions = (['QB', 'RB', 'WR', 'TE'] as const).filter((pos) => pos !== needPosition);
  const scored = positions.map((pos) => ({
    pos,
    score: getPositionDepthScore(rosterPlayers, pos),
    benchStarterCount: rosterPlayers.filter((player) => player.pos === pos && !player.isStarter && (player.seasonValue || player.value) >= 1800).length,
  }));
  return scored.sort((a, b) => (b.benchStarterCount - a.benchStarterCount) || b.score - a.score)[0]?.pos || null;
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
  buyTarget,
  sellCandidate,
  injuryInsurance,
  avgGamesMissed,
  riskiestStarter,
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
  buyTarget: ManagerIntelPlayer | null;
  sellCandidate: ManagerIntelPlayer | null;
  injuryInsurance: ManagerIntelPlayer | null;
  avgGamesMissed: number | null;
  riskiestStarter: ManagerIntelPlayer | null;
  holeParts: string[];
}): string {
  const qbSummary = qbs[0]
    ? `QB room is led by ${qbs[0].name} (${getRankLabel(qbs[0])})${qbs[1] ? ` with ${qbs[1].name} (${getRankLabel(qbs[1])}) as the next option` : ' with no clear second ranked QB'}`
    : 'QB room has no ranked option';
  const rbSummary = rbs[1]
    ? `RB starts with ${rbs[0].name} (${getRankLabel(rbs[0])}) and ${rbs[1].name} (${getRankLabel(rbs[1])})`
    : rbs[0]
      ? `RB has ${rbs[0].name} (${getRankLabel(rbs[0])}) but no reliable RB2 by rank`
      : 'RB room has no starter';
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
    ? `Best bench chip is ${bestBenchStash.name} (${getRankLabel(bestBenchStash)})`
    : 'There is no obvious bench stash with real KTC value';
  const weakSummary = weakestStarter
    ? `Best lineup upgrade spot is ${weakestStarter.name} (${getRankLabel(weakestStarter)})`
    : 'No obvious starter upgrade spot showed up once season value was included';
  const futureSummary = youngCorePlayer
    ? `Future anchor is ${youngCorePlayer.name} (${getRankLabel(youngCorePlayer)})`
    : oldestPlayer
      ? `Age risk is concentrated around ${oldestPlayer.name} (${getRankLabel(oldestPlayer)})`
      : 'No clear youth anchor or age-risk player stood out';
  const holesSummary = holeParts.length > 0
    ? `Watch list: ${holeParts.join(', ')}`
    : 'No major positional hole is flagged by the rank thresholds';
  const availabilitySummary = describeAvailability(riskiestStarter, avgGamesMissed);
  const tradeSummary = [
    buyTarget ? `Best cross-roster buy idea is ${buyTarget.name} (${getRankLabel(buyTarget)}) from ${buyTarget.owner || 'another roster'}` : null,
    sellCandidate ? `Best sell idea is ${sellCandidate.name} (${getRankLabel(sellCandidate)}) because dynasty value is more useful than the current lineup role` : null,
    injuryInsurance ? `Internal injury insurance is ${injuryInsurance.name} (${getRankLabel(injuryInsurance)})` : null,
  ].filter(Boolean).join('. ');

  return `${identity}. ${qbSummary}. ${rbSummary}. ${wrSummary}. ${teSummary}. ${depthSummary}. ${availabilitySummary} ${stashSummary}. ${weakSummary}. ${futureSummary}. ${holesSummary}.${tradeSummary ? ` ${tradeSummary}.` : ''}`;
}

export async function generateReport(
  currentSeasonData: SeasonData,
  pastSeasonData: SeasonData | null,
  allPlayers: Player,
  ktcValues: KTCValues,
  ktcValuesLastWeek: KTCValues,
  lastSeasonPositionRanks: Record<string, LastSeasonPlayerRank> = {},
  options: ReportOptions = {}
): Promise<ReportData> {
  const leagueValueMode = options.leagueValueMode || 'dynasty';
  const useSeasonAsPrimary = leagueValueMode === 'redraft';
  const starterThresholds = getStarterThresholds(currentSeasonData.rosters.length || 10);
  const seasonPositionRankById = buildSeasonPositionRanks(
    currentSeasonData.rosters.flatMap((roster) => roster.players || []),
    allPlayers,
    ktcValues
  );
  const getPrimaryValue = (pid: string) => {
    if (useSeasonAsPrimary) {
      return getPlayerRedraftValue(pid, allPlayers, ktcValues) || getPlayerValue(pid, allPlayers, ktcValues);
    }
    return getPlayerValue(pid, allPlayers, ktcValues);
  };
  const getPrimaryRank = (pid: string) => {
    if (useSeasonAsPrimary) {
      return seasonPositionRankById[pid] || getPlayerKtcRank(pid, allPlayers, ktcValues);
    }
    return getPlayerKtcRank(pid, allPlayers, ktcValues) || seasonPositionRankById[pid] || null;
  };
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
        (sum, pid) => sum + getPrimaryValue(pid),
        0
      );
    }
  }

  // Process current season rosters
  for (const r of currentSeasonData.rosters) {
    const name = currentSeasonData.rosterMap[r.roster_id];
    const pids = r.players || [];
    const posVals: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const posSeasonValues: Record<string, number[]> = { QB: [], RB: [], WR: [], TE: [] };
    let totalVal = 0;
    let v2027 = 0;

    for (const pid of pids) {
      const p = allPlayers[pid];
      const pos = p?.position || 'UNK';
      const age = p?.age || null;
      const val = getPrimaryValue(pid);

      totalVal += val;

      if (pos in posVals) {
        posVals[pos] += val;
        posSeasonValues[pos].push(getPlayerRedraftValue(pid, allPlayers, ktcValues) || val);
      }

      const p2027 = projectValue(val, pos, age, 1);
      v2027 += p2027;

      // Weekly momentum is a market-movement view, so compare raw KTC market
      // value to raw KTC market value. The rest of the report can keep using
      // the blended dynasty value.
      const currentMarketVal = getPlayerKtcMarketValue(pid, allPlayers, ktcValues);
      const lastWeekVal = getPlayerKtcMarketValue(pid, allPlayers, ktcValuesLastWeek);
      if (currentMarketVal > 0 && lastWeekVal > 0) {
        const pct_change = lastWeekVal > 0 ? (currentMarketVal - lastWeekVal) / lastWeekVal * 100 : 0;
        weeklyMomentum.push({
          name: getPlayerName(pid, allPlayers),
          player_id: pid,
          playerDetails: getPlayerDetails(pid, allPlayers, getRosterPlayerStatus(r, pid)),
          currentPositionRank: getPrimaryRank(pid),
          owner: name,
          pos,
          val_last: lastWeekVal,
          val_now: currentMarketVal,
          diff: currentMarketVal - lastWeekVal,
          pct_change,
        });
      }

      if (val > 300) {
        allPlayerMoves.push({
          name: getPlayerName(pid, allPlayers),
          player_id: pid,
          playerDetails: getPlayerDetails(pid, allPlayers, getRosterPlayerStatus(r, pid)),
          currentPositionRank: getPrimaryRank(pid),
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

    for (const [pos, values] of Object.entries(posSeasonValues)) {
      const position = pos as keyof StarterThresholds;
      const topCount = Math.max(1, Math.ceil(starterThresholds[position] / Math.max(1, currentSeasonData.rosters.length || 10)));
      const positionStrength = values
        .sort((a, b) => b - a)
        .slice(0, topCount)
        .reduce((sum, value) => sum + value, 0);
      rankLists.current[pos].push([name, positionStrength]);
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
        const val = getPrimaryValue(pid);
        const tradeSnapshot = getTradeSnapshot(dt);
        const tradeDateValue = useSeasonAsPrimary
          ? getPlayerRedraftValue(pid, allPlayers, tradeSnapshot) || getPlayerValue(pid, allPlayers, tradeSnapshot)
          : getPlayerValue(pid, allPlayers, tradeSnapshot);
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
    .filter((player) => player.diff > 0 && player.pct_change > 0)
    .sort((a, b) => b.diff - a.diff || b.pct_change - a.pct_change)
    .slice(0, 10);

  const weeklyFallers = weeklyMomentum
    .filter((player) => player.diff < 0 && player.pct_change < 0)
    .sort((a, b) => a.diff - b.diff || a.pct_change - b.pct_change)
    .slice(0, 10);

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
    const pids = getActivePlayerIds(r);
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
      seasonValue?: number;
      currentPositionRank?: string | null;
      seasonPositionRank?: string | null;
      playerDetails?: PlayerDetails;
    }>;
    lineupPlayers: Array<{
      player_id: string;
      name: string;
      pos: string;
      value: number;
      seasonValue?: number;
      currentPositionRank?: string | null;
      seasonPositionRank?: string | null;
      playerDetails?: PlayerDetails;
    }>;
  }> = [];

  for (const r of currentSeasonData.rosters) {
    const name = currentSeasonData.rosterMap[r.roster_id];
    const pids = getActivePlayerIds(r);
    const posCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const posStarterCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const lineupPlayers: Array<{
      player_id: string;
      name: string;
      pos: string;
      value: number;
      seasonValue?: number;
      currentPositionRank?: string | null;
      seasonPositionRank?: string | null;
      playerDetails?: PlayerDetails;
    }> = [];
    const starterPlayers: Array<{
      player_id: string;
      name: string;
      pos: string;
      value: number;
      seasonValue?: number;
      currentPositionRank?: string | null;
      seasonPositionRank?: string | null;
      playerDetails?: PlayerDetails;
    }> = [];

    for (const pid of pids) {
      const p = allPlayers[pid];
      const pos = p?.position || 'UNK';
      if (pos in posCounts) {
        posCounts[pos]++;
        const positionRank = getPrimaryRank(pid);
        const value = getPrimaryValue(pid);
        const seasonValue = getPlayerRedraftValue(pid, allPlayers, ktcValues) || value;
        const seasonPositionRank = seasonPositionRankById[pid] || null;
        const playerDetails = getPlayerDetails(pid, allPlayers, getRosterPlayerStatus(r, pid));
        if (positionRank || seasonPositionRank) {
          lineupPlayers.push({
            player_id: pid,
            name: getPlayerName(pid, allPlayers),
            pos,
            value,
            seasonValue,
            currentPositionRank: positionRank,
            seasonPositionRank,
            playerDetails,
          });
        }
        if (isStarterRank(pos, seasonPositionRank, starterThresholds)) {
          posStarterCounts[pos]++;
          starterPlayers.push({
            player_id: pid,
            name: getPlayerName(pid, allPlayers),
            pos,
            value,
            seasonValue,
            currentPositionRank: positionRank,
            seasonPositionRank,
            playerDetails,
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
      starterPlayers: starterPlayers.sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)),
      lineupPlayers: lineupPlayers.sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)),
    });
  }

  const seasonRosterValues: Record<string, number> = Object.fromEntries(
    currentSeasonData.rosters.map((roster) => {
      const manager = currentSeasonData.rosterMap[roster.roster_id];
      const value = getActivePlayerIds(roster).reduce((sum, pid) => {
        return sum + (getPlayerRedraftValue(pid, allPlayers, ktcValues) || getPrimaryValue(pid));
      }, 0);
      return [manager, value];
    })
  );
  const maxSeasonRosterValue = Math.max(...Object.values(seasonRosterValues), 1);

  const managerRosterIntelligence = currentSeasonData.rosters.map((r) => {
    const manager = currentSeasonData.rosterMap[r.roster_id];
    type BuiltIntelPlayer = ManagerIntelPlayer & { age: number | null; isStarter: boolean };
    const buildIntelPlayer = (pid: string, owner: string, roster?: Roster): BuiltIntelPlayer | null => {
        const player = allPlayers[pid];
        const pos = player?.position || 'UNK';
        const currentPositionRank = getPrimaryRank(pid);
        const seasonPositionRank = seasonPositionRankById[pid] || null;
        const lastSeasonRank = lastSeasonPositionRanks[pid];
        const value = getPrimaryValue(pid);
        const seasonValue = getPlayerRedraftValue(pid, allPlayers, ktcValues) || value;
        if (!['QB', 'RB', 'WR', 'TE'].includes(pos) || value <= 0) return null;

        return {
          player_id: pid,
          name: getPlayerName(pid, allPlayers),
          pos,
          owner,
          value,
          seasonValue,
          currentPositionRank,
          seasonPositionRank,
          lastSeasonPositionRank: lastSeasonRank?.positionRank || null,
          lastSeasonFantasyPoints: lastSeasonRank?.fantasyPoints ?? null,
          lastSeasonGames: lastSeasonRank?.games ?? null,
          lastSeasonPointsPerGame: lastSeasonRank?.pointsPerGame ?? null,
          lastSeasonYear: lastSeasonRank?.season || null,
          playerDetails: getPlayerDetails(pid, allPlayers, getRosterPlayerStatus(roster, pid)),
          age: player?.age ?? null,
          isStarter: isStarterRank(pos, seasonPositionRank, starterThresholds),
        };
      };
    const activePlayerIds = getActivePlayerIds(r);
    const rosterPlayers = activePlayerIds
      .map((pid) => buildIntelPlayer(pid, manager, r))
      .filter((player): player is BuiltIntelPlayer => Boolean(player));
    const taxiPlayers = getTaxiPlayerIds(r)
      .map((pid) => buildIntelPlayer(pid, manager, r))
      .filter((player): player is BuiltIntelPlayer => Boolean(player));
    const reservePlayers = getReservePlayerIds(r)
      .map((pid) => buildIntelPlayer(pid, manager, r))
      .filter((player): player is BuiltIntelPlayer => Boolean(player));
    const externalPlayers = currentSeasonData.rosters
      .filter((otherRoster) => otherRoster.roster_id !== r.roster_id)
      .flatMap((otherRoster) => {
        const owner = currentSeasonData.rosterMap[otherRoster.roster_id];
        return normalizePlayerIds([...(otherRoster.players || []), ...(otherRoster.taxi || []), ...(otherRoster.reserve || [])])
          .map((pid) => buildIntelPlayer(pid, owner, otherRoster));
      })
      .filter((player): player is BuiltIntelPlayer => Boolean(player));

    const starters = rosterPlayers
      .filter((player) => player.isStarter)
      .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value));
    const bench = rosterPlayers.filter((player) => !player.isStarter).sort((a, b) => b.value - a.value);
    const starterValue = starters.reduce((sum, player) => sum + player.value, 0);
    const starterSeasonValue = starters.reduce((sum, player) => sum + (player.seasonValue || getPlayerRedraftValue(player.player_id, allPlayers, ktcValues)), 0);
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
      .sort((a, b) => (getRankNumber(a.seasonPositionRank || a.currentPositionRank) || 999) - (getRankNumber(b.seasonPositionRank || b.currentPositionRank) || 999));
    const qbs = byPos('QB');
    const rbs = byPos('RB');
    const wrs = byPos('WR');
    const tes = byPos('TE');
    const rb2RankNumber = getRankNumber(rbs[1]?.seasonPositionRank || rbs[1]?.currentPositionRank);
    const wr2RankNumber = getRankNumber(wrs[1]?.seasonPositionRank || wrs[1]?.currentPositionRank);
    const te1RankNumber = getRankNumber(tes[0]?.seasonPositionRank || tes[0]?.currentPositionRank);
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
      ...rbs.slice(0, 2).filter((player) => (getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999) <= coreRbLine),
      ...wrs.slice(0, 2).filter((player) => (getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999) <= coreWrLine),
    ].length;
    const benchFlexCandidates = [
      ...rbs.slice(2).filter((player) => (getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999) <= flexDepthLine.RB),
      ...wrs.slice(2).filter((player) => (getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999) <= flexDepthLine.WR),
      ...tes.slice(1).filter((player) => (getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999) <= flexDepthLine.TE),
    ].length;
    const starterGamesMissed = starters
      .map(getPlayerGamesMissed)
      .filter((value): value is number => value !== null);
    const avgStarterGamesMissed = roundOne(average(starterGamesMissed));
    const riskiestStarter = [...starters]
      .filter((player) => getPlayerGamesMissed(player) !== null)
      .sort((a, b) => (getPlayerGamesMissed(b) || 0) - (getPlayerGamesMissed(a) || 0))[0] || null;
    const flexDepth = [
      ...rbs.filter((player) => (getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999) <= flexDepthLine.RB),
      ...wrs.filter((player) => (getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999) <= flexDepthLine.WR),
      ...tes.filter((player) => (getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999) <= flexDepthLine.TE),
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
      avgAgeByPosition.RB !== null && avgAgeByPosition.RB >= 27.2 ? 'old RB room' : null,
      avgAgeByPosition.WR !== null && avgAgeByPosition.WR <= 24.4 && (finalRanks[manager]?.current_WR || 99) <= Math.ceil(teamCount / 2) ? 'young WR core' : null,
      avgAgeByPosition.TE !== null && avgAgeByPosition.TE <= 24.8 && (finalRanks[manager]?.current_TE || 99) <= Math.ceil(teamCount / 2) ? 'young TE room' : null,
      avgAge !== null && avgAge >= 27.8 ? 'older roster' : null,
      avgAge !== null && avgAge <= 24.7 ? 'young roster' : null,
      avgStarterGamesMissed !== null && avgStarterGamesMissed >= 3 ? 'availability risk' : null,
      avgStarterGamesMissed !== null && avgStarterGamesMissed <= 0.8 ? 'durable starters' : null,
    ].filter(Boolean) as string[];
    const identity = getRosterIdentity(
      starterValuePct,
      avgAge,
      benchValue,
      totalValue,
      finalRanks[manager]?.current_VALUE || 99,
      finalRanks[manager]?.['2027_VALUE'] || 99
    );
    const contenderScore = normalizeScore(starterSeasonValue || starterValue, maxSeasonRosterValue);
    const rebuildScore = Math.round(((100 - starterValuePct) * 0.35) + ((avgAge !== null ? Math.max(0, 28 - avgAge) * 8 : 35) * 0.65));
    const isContenderBuild = contenderScore >= rebuildScore || contenderScore >= 65;
    const timeline = getTimelineLabel(contenderScore, rebuildScore, avgAge !== null ? Math.max(0, avgAge - 25) * 18 : 0);
    const usedInsightPlayerIds = new Set<string>();
    const bestBenchStash = pickDistinctPlayer(bench, usedInsightPlayerIds);
    const starterUpgradeCandidates = [...starters]
      .filter((player) => {
        const rank = getRankNumber(player.seasonPositionRank || player.currentPositionRank) || 999;
        const seasonValue = getSeasonValue(player, allPlayers, ktcValues);
        const rankLine = player.pos === 'QB' ? teamCount * 2 : player.pos === 'RB' ? teamCount * 3 : player.pos === 'WR' ? teamCount * 4 : Math.round(teamCount * 1.5);
        return rank > rankLine || seasonValue < 3500;
      })
      .sort((a, b) => getSeasonValue(a, allPlayers, ktcValues) - getSeasonValue(b, allPlayers, ktcValues));
    const weakestStarter = pickDistinctPlayer(starterUpgradeCandidates, usedInsightPlayerIds);
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
    const primaryNeed = getNeedPosition({ qbs, rbs, wrs, tes, holeParts });
    const surplusPosition = getSurplusPosition(rosterPlayers, primaryNeed);
    const taxiTriageItems: TaxiTriageItem[] = taxiPlayers
      .map((player) => {
        const wouldStart = playerWouldMakeProjectedLineup(player, rosterPlayers, currentSeasonData.rosterPositions);
        const triage = getTaxiTriageAction({
          player,
          starterThresholds,
          needPosition: primaryNeed,
          wouldStart,
        });
        return {
          ...player,
          taxiAction: triage.action,
          taxiReason: triage.reason,
          taxiScore: triage.score,
        };
      })
      .sort((a, b) => b.taxiScore - a.taxiScore || b.value - a.value);
    const taxiTriageCounts = taxiTriageItems.reduce((acc, item) => {
      acc[item.taxiAction] += 1;
      return acc;
    }, createTaxiCounts());
    const sellPool = [...rosterPlayers]
      .filter((player) => {
        if (player.value < 900) return false;
        if (surplusPosition && player.pos !== surplusPosition) return false;
        const seasonValue = getSeasonValue(player, allPlayers, ktcValues);
        if (isContenderBuild && player.isStarter && seasonValue >= player.value * 0.86) return false;
        return !player.isStarter || player.pos === surplusPosition || getSeasonArbitrage(player, allPlayers, ktcValues) < -900;
      })
      .sort((a, b) => {
        const aDepthBonus = !a.isStarter ? 1400 : 0;
        const bDepthBonus = !b.isStarter ? 1400 : 0;
        const aArb = Math.max(0, getSeasonArbitrage(a, allPlayers, ktcValues) * -1);
        const bArb = Math.max(0, getSeasonArbitrage(b, allPlayers, ktcValues) * -1);
        return (bDepthBonus + bArb + b.value * 0.25) - (aDepthBonus + aArb + a.value * 0.25);
      });
    const sellCandidate = pickDistinctPlayer(sellPool, usedInsightPlayerIds);
    const targetBudget = Math.max(
      1800,
      (sellCandidate?.value || 0) * 1.18,
      (sellCandidate?.value || 0) + (bench.find((player) => player.player_id !== sellCandidate?.player_id)?.value || 0) * 0.45,
      (bestBenchStash?.value || 0) * 1.15
    );
    const buyTargetPool = [...externalPlayers]
      .filter((player) => {
        if (primaryNeed && player.pos !== primaryNeed) return false;
        if (!primaryNeed && !['RB', 'WR', 'TE'].includes(player.pos)) return false;
        if (player.value > targetBudget) return false;
        if (sellCandidate && player.owner === sellCandidate.owner) return false;
        if (isContenderBuild) return getSeasonValue(player, allPlayers, ktcValues) >= player.value * 0.66 || isLastSeasonStud(player.lastSeasonPositionRank);
        return (player.age || 99) <= 25 && player.value >= 900;
      })
      .sort((a, b) => {
        const aFit = getSeasonValue(a, allPlayers, ktcValues) + (primaryNeed && a.pos === primaryNeed ? 1200 : 0) + ((26 - (a.age || 26)) * (isContenderBuild ? 20 : 90));
        const bFit = getSeasonValue(b, allPlayers, ktcValues) + (primaryNeed && b.pos === primaryNeed ? 1200 : 0) + ((26 - (b.age || 26)) * (isContenderBuild ? 20 : 90));
        return bFit - aFit;
      });
    const needBuyTarget = pickDistinctPlayer(
      buyTargetPool,
      usedInsightPlayerIds
    );
    const fallbackBuyTarget = pickDistinctPlayer(
      [...externalPlayers]
        .filter((player) => {
          if (primaryNeed && player.pos !== primaryNeed) return false;
          if (!primaryNeed && !['RB', 'WR', 'TE'].includes(player.pos)) return false;
          if (player.value > targetBudget) return false;
          return (player.age || 99) <= 25 || getSeasonValue(player, allPlayers, ktcValues) >= player.value * 0.72;
        })
        .sort((a, b) => getSeasonValue(b, allPlayers, ktcValues) - getSeasonValue(a, allPlayers, ktcValues)),
      new Set(usedInsightPlayerIds)
    );
    const buyTarget = needBuyTarget || fallbackBuyTarget;
    const tradePlan = {
      needPosition: primaryNeed,
      surplusPosition,
      summary: primaryNeed && surplusPosition && buyTarget && sellCandidate
        ? `Shop ${surplusPosition} surplus (${sellCandidate.name}) for ${primaryNeed} help (${buyTarget.name}).`
        : primaryNeed
          ? `Priority is ${primaryNeed}, but there is no clean same-budget surplus-for-need swap yet.`
          : surplusPosition
            ? `No screaming lineup hole; surplus is most movable at ${surplusPosition}.`
            : 'No obvious need-for-surplus trade path from the current roster shape.',
    };
    const positionGrades = buildPositionGrades({ qbs, rbs, wrs, tes, teamCount });
    const tradeChip = pickDistinctPlayer(
      [...bench]
        .filter((player) => player.value >= 1000)
        .sort((a, b) => b.value - a.value),
      usedInsightPlayerIds
    );
    const injuryInsurance = pickDistinctPlayer(
      [...bench]
        .filter((player) => ['RB', 'WR', 'TE'].includes(player.pos))
        .sort((a, b) => getPlayerRedraftValue(b.player_id, allPlayers, ktcValues) - getPlayerRedraftValue(a.player_id, allPlayers, ktcValues)),
      usedInsightPlayerIds
    );
    const similarValuePlayers = Object.fromEntries(
      (['QB', 'RB', 'WR', 'TE'] as const).map((pos) => {
        const anchor = starters.find((player) => player.pos === pos) || rosterPlayers.find((player) => player.pos === pos);
        if (!anchor) return [pos, null];
        const closest = rosterPlayers
          .filter((player) => player.pos === pos && player.player_id !== anchor.player_id)
          .sort((a, b) => Math.abs(a.value - anchor.value) - Math.abs(b.value - anchor.value))[0] || null;
        return [pos, closest];
      })
    ) as Record<'QB' | 'RB' | 'WR' | 'TE', ManagerIntelPlayer | null>;
    const droppablePlayers = [...rosterPlayers]
      .filter((player) => !player.isStarter)
      .sort((a, b) => {
        const rankDelta = (getRankNumber(b.currentPositionRank) || 999) - (getRankNumber(a.currentPositionRank) || 999);
        return rankDelta || a.value - b.value;
      })
      .slice(0, 3);
    const untouchablePlayers = [...rosterPlayers]
      .filter((player) => {
        const rank = getRankNumber(player.currentPositionRank) || 999;
        const age = player.playerDetails?.age ?? 99;
        const pos = player.pos;
        const isAlreadyElite = rank <= 3;
        const isYoungElitePath =
          (pos === 'QB' && age <= 26 && rank <= 8) ||
          (pos === 'RB' && age <= 24 && rank <= 10) ||
          (pos === 'WR' && age <= 25 && rank <= 12) ||
          (pos === 'TE' && age <= 25 && rank <= 6);
        return isAlreadyElite || isYoungElitePath;
      })
      .sort((a, b) => {
        const rankDelta = (getRankNumber(a.currentPositionRank) || 999) - (getRankNumber(b.currentPositionRank) || 999);
        return rankDelta || b.value - a.value;
      })
      .slice(0, 4);
    const pressurePoints = buildPressurePoints({
      qbs,
      rbs,
      wrs,
      tes,
      benchFlexCandidates,
      riskiestStarter,
      avgStarterGamesMissed,
      teamCount,
    });
    const marketSignals = buildMarketSignals({
      rosterPlayers,
      buyTarget,
      sellCandidate,
      isContenderBuild,
    });
    const tradeBlueprints = buildTradeBlueprints({
      tradePlan,
      buyTarget,
      sellCandidate,
      tradeChip,
      injuryInsurance,
      oldestPlayer,
      youngCorePlayer,
      isContenderBuild,
    });
    const rosterHealthScore = calculateRosterHealthScore({
      starterValuePct,
      contenderScore,
      rebuildScore,
      avgStarterGamesMissed,
      flexDepth,
      holeCount: holeParts.length,
      ageFlagCount: ageFlags.filter((flag) => /old|aging|risk/i.test(flag)).length,
    });
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
      buyTarget,
      sellCandidate,
      injuryInsurance,
      avgGamesMissed: avgStarterGamesMissed,
      riskiestStarter,
      holeParts,
    });
    const chaosNotes = [
      tradePlan.summary,
      buyTarget && sellCandidate
        ? `Need-for-surplus swap: float ${sellCandidate.name} (${getRankLabel(sellCandidate)}) and ask for ${buyTarget.name} (${getRankLabel(buyTarget)}) because ${primaryNeed || 'lineup'} help matters more than hoarding ${surplusPosition || 'extra'} value.`
        : null,
      weakestStarter && buyTarget
        ? `Pressure point: ${weakestStarter.name} is the starter opponents should attack; ${buyTarget.name} is the cleanest outside patch.`
        : weakestStarter
          ? `Pressure point: ${weakestStarter.name} is the softest weekly starter.`
          : null,
      rowHandoffText({
        contenderScore,
        rebuildScore,
        avgAge,
        starterValuePct,
        bestBenchStash,
        oldestPlayer,
        youngCorePlayer,
      }),
      rowValueTrapText({
        sellCandidate,
        buyTarget,
        isContenderBuild,
      }),
      rowRosterExploitText({
        qbs,
        rbs,
        wrs,
        tes,
        flexDepth,
        teamCount,
      }),
    ].filter(Boolean) as string[];
    const strategySummary = [
      contenderScore >= 84 && contenderScore - rebuildScore >= 18
        ? 'Contender posture: use bench value or picks to buy weekly points now'
        : rebuildScore >= 68 && rebuildScore - contenderScore >= 10
          ? 'Rebuild posture: sell older production for players who can still gain value next offseason'
          : 'Middle-build posture: avoid sideways deals and only trade when it fixes a clear lineup hole',
      primaryNeed ? `Biggest trade need: ${primaryNeed}` : null,
      tradePlan.summary,
      buyTarget ? `Buy target profile: ${compactPlayerBlurb(buyTarget)} from ${buyTarget.owner || 'another roster'}` : null,
      sellCandidate ? `Sell candidate: ${compactPlayerBlurb(sellCandidate)} from ${surplusPosition || 'surplus'} depth only if it buys the needed position` : null,
      tradeChip ? `Trade chip: ${compactPlayerBlurb(tradeChip)} can be moved without cracking the projected lineup` : null,
      describeAvailability(riskiestStarter, avgStarterGamesMissed),
    ].filter(Boolean).join('. ');

    return {
      manager,
      identity,
      timeline,
      summary,
      strategySummary,
      starterValue,
      starterSeasonValue,
      benchValue,
      starterValuePct,
      bestBenchStash,
      weakestStarter,
      oldestPlayer,
      youngCorePlayer,
      breakoutCandidate,
      lastSeasonStud,
      buyTarget,
      sellCandidate,
      tradePlan,
      tradeBlueprints,
      chaosNotes,
      marketSignals,
      pressurePoints,
      rosterHealthScore,
      positionGrades,
      tradeChip,
      injuryInsurance,
      rosterPlayers,
      benchPlayers: bench,
      taxiPlayers,
      reservePlayers,
      droppablePlayers,
      untouchablePlayers,
      taxiTriage: {
        items: taxiTriageItems,
        summary: buildTaxiTriageSummary(taxiTriageItems),
        counts: taxiTriageCounts,
      },
      similarValuePlayers,
      avgAge,
      avgAgeByPosition,
      starterAvailability: {
        avgGamesMissed: avgStarterGamesMissed,
        riskLevel: getAvailabilityRisk(avgStarterGamesMissed),
        riskiestStarter,
      },
      ageFlags,
      holes: {
        bestQbRank: qbs[0]?.seasonPositionRank || qbs[0]?.currentPositionRank || null,
        rb2Rank: rbs[1]?.seasonPositionRank || rbs[1]?.currentPositionRank || null,
        wr3Rank: wrs[2]?.seasonPositionRank || wrs[2]?.currentPositionRank || null,
        te1Rank: tes[0]?.seasonPositionRank || tes[0]?.currentPositionRank || null,
        flexDepth,
        summary: holeParts.length > 0 ? holeParts.join(', ') : 'No major roster hole flagged',
      },
    };
  });

  const maxTotalValue = Math.max(...Object.values(teamData).map((data) => data.total_val), 1);
  const maxStarterValue = Math.max(...managerRosterIntelligence.map((row) => row.starterSeasonValue || row.starterValue), 1);
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
    const contenderScore = Math.round((normalizeScore(intel.starterSeasonValue || intel.starterValue, maxStarterValue) * 0.72) + (normalizeScore(data.total_val, maxTotalValue) * 0.28));
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
      const starterStrength = Math.round(normalizeScore(intel.starterSeasonValue || intel.starterValue, maxStarterValue));
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
    leagueValueMode,
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
