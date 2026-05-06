import {
  cleanName,
  getPlayerName,
  getPlayerRedraftValue,
  getPlayerValue,
  getPickValue,
  projectValue,
  calculateValueAdjustment,
} from './leagueAnalysis';
import { loadLatestLocalKtcSnapshotBefore } from './ktcLoader';
import { KTC_SNAPSHOT_PROFILES, VALUE_SOURCE_PROFILE_DEFINITIONS } from './valueBlend';
import type {
  LeagueValueMode,
  ManagerIntelPlayer,
  OwnerBenchBaselineTile,
  OwnerLineupStrengthTile,
  OwnerTradeableDepthTile,
  PlayerDetails,
  ReportData,
  TaxiTriageAction,
  TaxiTriageItem,
  TradeTeamContext,
} from '../shared/types';

export interface KTCValues {
  [key: string]: {
    name: string;
    ktc_value: number;
    position_rank?: string;
    dynasty_value?: number;
    true_value?: number;
    redraft_value?: number;
    market_value_ktc?: number;
    expert_value_flock?: number;
    flock_rank?: number;
    flock_position_rank?: string | null;
    flock_tier?: number | null;
    flock_format?: string | null;
    market_value_fantasycalc?: number;
    expert_value_dynastyprocess?: number;
    expert_value_dynastynerds?: number;
    dynastynerds_rank?: number;
    dynastynerds_position_rank?: string | null;
    dynastynerds_format?: string | null;
    benchmark_value_dynastydealer?: number;
    dynastydealer_vote_rating?: number | null;
    dynastydealer_updated_at?: string | null;
    fantasypros_rank?: number;
    fantasypros_position_rank?: string | null;
    fantasypros_tier?: number | null;
    fantasypros_season_value?: number;
    value_sources?: string[];
    benchmark_sources?: string[];
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
  scoringSettings?: Record<string, any>;
  valueBlendProfileKey?: string;
  valueBlendProfileLabel?: string;
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

function getRosterPlayerIds(roster: Pick<Roster, 'players' | 'taxi' | 'reserve'> | undefined): string[] {
  return normalizePlayerIds([
    ...(roster?.players || []),
    ...(roster?.taxi || []),
    ...(roster?.reserve || []),
  ]);
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

function getLineupValue(player: Pick<ManagerIntelPlayer, 'seasonValue' | 'value'>): number {
  return player.seasonValue || player.value || 0;
}

function compareValueLineupPlayers<T extends Pick<ManagerIntelPlayer, 'seasonValue' | 'value' | 'seasonPositionRank' | 'currentPositionRank'>>(
  a: T,
  b: T
): number {
  const valueDelta = getLineupValue(b) - getLineupValue(a);
  if (valueDelta !== 0) return valueDelta;
  return getLineupRank(a) - getLineupRank(b);
}

function selectValueProjectedLineup<T extends ManagerIntelPlayer>(players: T[], rosterPositions?: string[]): T[] {
  const slots = getStarterRosterSlots(rosterPositions);
  const remaining = players
    .filter((player) => isFantasyPosition(player.pos))
    .sort(compareValueLineupPlayers);
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

type LineupSlotProfile = Record<'QB' | 'RB' | 'WR' | 'TE', number> & {
  flex: number;
  superFlex: number;
};
type LineupGroup<T extends ManagerIntelPlayer = ManagerIntelPlayer> = {
  key: string;
  label: string;
  count: number;
  players: T[];
};

function pluralizeSlot(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function formatLineupSlotSummary(profile: LineupSlotProfile): string {
  const parts = [
    profile.QB ? `${profile.QB} QB` : null,
    profile.RB ? `${profile.RB} RB` : null,
    profile.WR ? `${profile.WR} WR` : null,
    profile.TE ? `${profile.TE} TE` : null,
    profile.flex ? `${profile.flex} Flex` : null,
    profile.superFlex ? `${profile.superFlex} Superflex` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : 'Default starter slots';
}

function normalizeNumQbsForDiagnostics(profile: LineupSlotProfile): 1 | 2 {
  return profile.superFlex > 0 || profile.QB >= 2 ? 2 : 1;
}

function formatStarterCountSummary(counts: Record<FantasyPosition, number>): string {
  return FANTASY_POSITIONS.map((position) => `${position} x${counts[position]}`).join(', ');
}

function getScoringNumber(scoringSettings: Record<string, any> | undefined, key: string): number {
  const value = Number(scoringSettings?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getTightEndPremium(scoringSettings: Record<string, any> | undefined): number {
  const rec = getScoringNumber(scoringSettings, 'rec');
  const teReception = Number(scoringSettings?.rec_te);
  if (Number.isFinite(teReception) && teReception > rec) {
    return teReception - rec;
  }

  return getScoringNumber(scoringSettings, 'bonus_rec_te');
}

function formatScoringSummary(scoringSettings: Record<string, any> | undefined): string {
  const rec = getScoringNumber(scoringSettings, 'rec');
  const teBonus = getTightEndPremium(scoringSettings);
  const rbBonus = getScoringNumber(scoringSettings, 'bonus_rec_rb');
  const wrBonus = getScoringNumber(scoringSettings, 'bonus_rec_wr');
  const passTd = getScoringNumber(scoringSettings, 'pass_td');
  const ppr = rec === 1 ? 'PPR' : rec === 0.5 ? 'Half-PPR' : rec === 0 ? 'Standard' : `${rec} PPR`;
  const bonuses = [
    teBonus ? `TE +${teBonus}/rec` : null,
    rbBonus ? `RB +${rbBonus}/rec` : null,
    wrBonus ? `WR +${wrBonus}/rec` : null,
    passTd ? `${passTd}-point passing TD` : null,
  ].filter(Boolean);

  return [ppr, ...bonuses].join(', ');
}

function buildLeagueDiagnostics(
  currentSeasonData: SeasonData,
  leagueValueMode: LeagueValueMode,
  ktcValues: KTCValues
): NonNullable<ReportData['leagueDiagnostics']> {
  const teamCount = currentSeasonData.rosters.length || 10;
  const starterSlots = getStarterRosterSlots(currentSeasonData.rosterPositions);
  const lineupProfile = getLineupSlotProfile(currentSeasonData.rosterPositions);
  const starterCounts = getPositionStarterCounts(currentSeasonData.rosterPositions, teamCount);
  const receptionScoring = getScoringNumber(currentSeasonData.scoringSettings, 'rec');
  const tightEndPremium = getTightEndPremium(currentSeasonData.scoringSettings);
  const selectedValueProfile = currentSeasonData.valueBlendProfileLabel || '12-team SF PPR';
  const valueProfiles = Array.from(
    new Set(
      Object.values(ktcValues)
        .flatMap((value) => Array.isArray(value.value_sources) ? value.value_sources : [])
        .filter(Boolean)
    )
  ).sort();
  const playerValues = Object.values(ktcValues).filter((value) => !/\d{4}.*(1st|2nd|3rd|4th|5th)/i.test(value.name));
  const sourceCoverage = (source: string) => playerValues.filter((value) => value.value_sources?.includes(source)).length;
  const coverageParts = ['FlockFantasy', 'DynastyNerds', 'KTC', 'FantasyCalc', 'DynastyProcess', 'FantasyPros']
    .filter((source) => sourceCoverage(source) > 0)
    .map((source) => `${source}: ${sourceCoverage(source)}`);
  const dealerCoverage = playerValues.filter((value) => Number(value.benchmark_value_dynastydealer || 0) > 0).length;

  return {
    teamCount,
    valueMode: leagueValueMode,
    rosterSlots: currentSeasonData.rosterPositions || [],
    starterSlots,
    lineupSlotSummary: formatLineupSlotSummary(lineupProfile),
    starterCountSummary: formatStarterCountSummary(starterCounts),
    starterCalculation: `Projected starters are selected from active non-IR roster players only, using this league's starter slots: ${formatLineupSlotSummary(lineupProfile)}. Fixed QB/RB/WR/TE slots fill first by position rank, Superflex tries QB first, then flex slots take the best remaining RB/WR/TE options.`,
    benchCalculation: `Bench baseline uses season rank and season value to find the best non-starting QB, RB, WR, and TE after projected starters are removed. Taxi players are included only for bench baseline visibility because they can be future depth, and IR players are retained as roster assets without counting as active starters.`,
    tradeableDepthCalculation: 'Tradeable depth uses season rank and season value for active bench players only. Taxi and IR players are retained as roster assets, but not counted as immediate tradeable depth in that tile.',
    scoringSummary: formatScoringSummary(currentSeasonData.scoringSettings),
    receptionScoring,
    tightEndPremium,
    ktcProfileLabel: `This report is using the ${selectedValueProfile} blended profile. Flock Fantasy remains the top dynasty/rankings signal when available, Dynasty Nerds now adds format-aware expert/community values, and KTC, FantasyCalc, DynastyProcess, and FantasyPros fill the rest of the blend.`,
    valueSnapshotProfileCount: VALUE_SOURCE_PROFILE_DEFINITIONS.length,
    valueSnapshotProfiles: [
      `${VALUE_SOURCE_PROFILE_DEFINITIONS.length} blended league profiles: 10/12/14-team, 1QB/SF, Standard/Half/PPR, and 0/0.5/1/1.5 TEP buckets`,
      `${KTC_SNAPSHOT_PROFILES.length} KTC market profiles for 1QB/SF and TEP variants`,
      'Flock Fantasy dynasty and rookie rankings for 1QB/SF',
      'Dynasty Nerds PPR, Superflex, Standard, and Superflex TEP rankings with player values, Sleeper IDs, and movement',
      'FantasyCalc format values, DynastyProcess 1QB/SF values, FantasyPros scoring-specific ranks and points',
      dealerCoverage > 0
        ? `Dynasty Dealer benchmark values stored for ${dealerCoverage} players, but kept out of the primary blend until that endpoint is confirmed stable/licensed.`
        : 'Dynasty Dealer benchmark support is wired, but no benchmark values were present in this snapshot.',
    ],
    valueLimitations: [
      `Selected value profile: ${selectedValueProfile}. League analysis no longer uses the old default 12-team SF PPR blend when the league settings point elsewhere.`,
      `Daily snapshots now track ${VALUE_SOURCE_PROFILE_DEFINITIONS.length} blended format profiles across team count, QB format, reception scoring, and TEP bucket.`,
      'Flock Fantasy is treated as the highest-priority dynasty/rookie rankings source where the public rankings endpoint returns data. Dynasty Nerds is the secondary expert/community dynasty source and is selected by the closest league format. Redraft stays projection/season-source driven.',
      normalizeNumQbsForDiagnostics(lineupProfile) === 2 && tightEndPremium > 0
        ? 'Dynasty Nerds has a direct Superflex TEP source for this format bucket.'
        : normalizeNumQbsForDiagnostics(lineupProfile) === 2
          ? 'Dynasty Nerds Superflex rankings are used for this format bucket.'
          : receptionScoring === 0
            ? 'Dynasty Nerds Standard rankings are used for this 1QB non-PPR bucket.'
            : 'Dynasty Nerds PPR rankings are used for this 1QB/Half/PPR bucket because a separate 1QB TEP page was not available from the public ranking payload.',
      tightEndPremium > 0
        ? `This league has TE premium scoring (+${tightEndPremium} per TE reception). The blend selects the closest TEP bucket, and tables receive that selected profile. Exact custom scoring beyond the bucket remains an approximation.`
        : 'This league does not add a TE reception bonus, so no TEP adjustment is being applied beyond the generic market blend.',
      receptionScoring !== 1
        ? `This league uses ${formatScoringSummary(currentSeasonData.scoringSettings)}; the blend selects the closest Standard/Half/PPR source profile.`
        : 'This league uses full PPR, so the PPR source profile is selected.',
      coverageParts.length
        ? `Current blended player-source coverage in this snapshot: ${coverageParts.join(', ')}. Players with fewer sources are more assumption-heavy.`
        : 'No source coverage metadata was present in this value snapshot.',
    ],
  };
}

function getLineupSlotProfile(rosterPositions?: string[]): LineupSlotProfile {
  const slots = getStarterRosterSlots(rosterPositions);
  const profile: LineupSlotProfile = { QB: 0, RB: 0, WR: 0, TE: 0, flex: 0, superFlex: 0 };

  for (const slot of slots) {
    if (slot === 'QB' || slot === 'RB' || slot === 'WR' || slot === 'TE') {
      profile[slot] += 1;
    } else if (slot === 'SUPER_FLEX') {
      profile.superFlex += 1;
    } else if (FLEX_ELIGIBILITY[slot]) {
      profile.flex += 1;
    }
  }

  return profile;
}

function getPositionStarterCounts(rosterPositions: string[] | undefined, teamCount: number): Record<FantasyPosition, number> {
  const profile = getLineupSlotProfile(rosterPositions);

  return {
    QB: Math.max(1, profile.QB + profile.superFlex || Math.ceil(getStarterThresholds(teamCount).QB / Math.max(1, teamCount))),
    RB: Math.max(1, profile.RB || Math.ceil(getStarterThresholds(teamCount).RB / Math.max(1, teamCount))),
    WR: Math.max(1, profile.WR || Math.ceil(getStarterThresholds(teamCount).WR / Math.max(1, teamCount))),
    TE: Math.max(1, profile.TE || Math.ceil(getStarterThresholds(teamCount).TE / Math.max(1, teamCount))),
  };
}

function gradeLeagueRank(rank: number | null, teamCount: number): string {
  if (!rank) return 'Empty';
  if (rank <= Math.max(1, Math.ceil(teamCount * 0.25))) return 'Elite';
  if (rank <= Math.max(1, Math.ceil(teamCount * 0.5))) return 'Strong';
  if (rank <= Math.max(1, Math.ceil(teamCount * 0.75))) return 'Playable';
  return 'Problem';
}

function getLeagueRank(score: number, scores: number[]): number | null {
  if (!Number.isFinite(score) || score <= 0) return null;
  return scores.filter((value) => value > score).length + 1;
}

function sumLineupScore(players: ManagerIntelPlayer[]): number {
  return players.reduce((sum, player) => sum + getLineupValue(player), 0);
}

function takeBestPlayers<T extends ManagerIntelPlayer>(
  remaining: T[],
  eligiblePositions: FantasyPosition[],
  count: number
): T[] {
  const selected: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = remaining.findIndex((player) => eligiblePositions.includes(player.pos as FantasyPosition));
    if (index < 0) break;
    const [player] = remaining.splice(index, 1);
    selected.push(player);
  }
  return selected;
}

function getLineupGroups<T extends ManagerIntelPlayer>(players: T[], rosterPositions?: string[]): LineupGroup<T>[] {
  const profile = getLineupSlotProfile(rosterPositions);
  const remaining = players
    .filter((player) => isFantasyPosition(player.pos))
    .sort(compareLineupPlayers);
  const groups: LineupGroup<T>[] = [];
  const fixedByPosition: Partial<Record<FantasyPosition, T[]>> = {};

  for (const position of FANTASY_POSITIONS) {
    fixedByPosition[position] = takeBestPlayers(remaining, [position], profile[position]);
  }

  const superFlexPlayers = takeBestPlayers(remaining, ['QB'], profile.superFlex);
  if (superFlexPlayers.length < profile.superFlex) {
    superFlexPlayers.push(...takeBestPlayers(remaining, FANTASY_POSITIONS, profile.superFlex - superFlexPlayers.length));
  }

  const qbPlayers = [...(fixedByPosition.QB || []), ...superFlexPlayers];
  if (qbPlayers.length || profile.QB || profile.superFlex) {
    groups.push({
      key: profile.superFlex ? 'QB_SF' : 'QB',
      label: profile.superFlex ? `QB/SF x${Math.max(1, profile.QB + profile.superFlex)}` : `QB x${Math.max(1, profile.QB)}`,
      count: Math.max(1, profile.QB + profile.superFlex),
      players: qbPlayers,
    });
  }

  for (const position of ['RB', 'WR', 'TE'] as const) {
    const count = profile[position];
    const positionPlayers = fixedByPosition[position] || [];
    if (positionPlayers.length || count) {
      groups.push({
        key: position,
        label: `${position} x${Math.max(1, count)}`,
        count: Math.max(1, count),
        players: positionPlayers,
      });
    }
  }

  const flexPlayers = takeBestPlayers(remaining, ['RB', 'WR', 'TE'], profile.flex);
  if (flexPlayers.length || profile.flex) {
    groups.push({
      key: 'FLEX',
      label: `Flex x${Math.max(1, profile.flex)}`,
      count: Math.max(1, profile.flex),
      players: flexPlayers,
    });
  }

  return groups;
}

function buildStartingRosterStrengthTiles(
  manager: string,
  leagueGroups: Array<{ manager: string; groups: LineupGroup[] }>,
  teamCount: number
): OwnerLineupStrengthTile[] {
  const managerGroups = leagueGroups.find((row) => row.manager === manager)?.groups || [];

  return managerGroups.map((group) => {
    const score = sumLineupScore(group.players);
    const scores = leagueGroups.map((row) => sumLineupScore(row.groups.find((item) => item.key === group.key)?.players || []));
    const leagueRank = getLeagueRank(score, scores);
    const grade = gradeLeagueRank(leagueRank, teamCount);
    const playerNames = group.players.map((player) => player.name);
    const note = playerNames.length
      ? `${group.label} compares ${playerNames.join(', ')} against the same starting slot group on every roster.`
      : `${group.label} has no ranked starter in this lineup shape.`;

    return {
      key: group.key,
      label: group.label,
      count: group.count,
      leagueRank,
      grade,
      playerNames,
      note,
    };
  });
}

function buildBenchBaselineTiles(
  manager: string,
  leagueRows: Array<{ manager: string; bench: ManagerIntelPlayer[] }>,
  _rosterPositions: string[] | undefined,
  teamCount: number
): OwnerBenchBaselineTile[] {
  const managerBench = leagueRows.find((row) => row.manager === manager)?.bench || [];
  const tileDefs: Array<{ key: string; label: string; count: number; positions: FantasyPosition[] }> = [
    { key: 'QB', label: 'Bench QB', count: 1, positions: ['QB'] },
    { key: 'RB', label: 'Bench RB', count: 1, positions: ['RB'] },
    { key: 'WR', label: 'Bench WR', count: 1, positions: ['WR'] },
    { key: 'TE', label: 'Bench TE', count: 1, positions: ['TE'] },
  ];

  const pickBenchPlayers = (
    bench: ManagerIntelPlayer[],
    def: { count: number; positions: FantasyPosition[] },
    usedPlayerIds: Set<string>
  ) => {
    const players: ManagerIntelPlayer[] = [];

    for (const player of bench
      .filter((item) => def.positions.includes(item.pos as FantasyPosition))
      .sort(compareLineupPlayers)) {
      const playerKey = player.player_id || player.name;
      if (usedPlayerIds.has(playerKey)) continue;
      usedPlayerIds.add(playerKey);
      players.push(player);
      if (players.length >= def.count) break;
    }

    return players;
  };

  const selectionsByManager = new Map<string, ManagerIntelPlayer[][]>();
  leagueRows.forEach((row) => {
    const usedPlayerIds = new Set<string>();
    selectionsByManager.set(
      row.manager,
      tileDefs.map((def) => pickBenchPlayers(row.bench, def, usedPlayerIds))
    );
  });

  const managerSelections = selectionsByManager.get(manager) || [];

  return tileDefs.map((def, index) => {
    const players = managerSelections[index] || [];
    const score = sumLineupScore(players);
    const scores = leagueRows.map((row) => sumLineupScore(selectionsByManager.get(row.manager)?.[index] || []));
    const leagueRank = getLeagueRank(score, scores);
    const grade = gradeLeagueRank(leagueRank, teamCount);
    const player = players[0] || null;
    const notePosition = def.key === 'FLEX'
      ? `flex ${players.length === 1 ? 'option' : 'options'}`
      : def.key;
    const note = players.length
      ? `${players.map((item) => item.name).join(', ')} ${players.length === 1 ? 'is' : 'are'} the best unused non-starting ${notePosition} for this roster.`
      : `No non-starting ${def.key === 'FLEX' ? 'flex option' : def.key} is available.`;

    return {
      key: def.key,
      label: def.label,
      count: def.count,
      leagueRank,
      grade,
      player,
      players,
      note,
    };
  });
}

function buildTradeableDepthTiles(bench: ManagerIntelPlayer[]): OwnerTradeableDepthTile[] {
  return FANTASY_POSITIONS.map((position) => {
    const player = bench
      .filter((item) => item.pos === position)
      .sort(compareLineupPlayers)[0] || null;
    return {
      position,
      player,
      note: player
        ? `${player.name} is your best non-starting ${position}.`
        : `No non-starting ${position} is available.`,
    };
  });
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

function getTradeContextMode(contenderScore: number, rebuildScore: number, label: string): TradeTeamContext['mode'] {
  if (contenderScore >= 74 && contenderScore >= rebuildScore - 6) return 'contender';
  if (rebuildScore >= 68 && rebuildScore > contenderScore) return 'rebuilder';
  if (/contender|win|playoff/i.test(label)) return 'contender';
  if (/rebuild|future/i.test(label)) return 'rebuilder';
  return 'dynasty';
}

function buildHistoricalTradeTeamContext({
  manager,
  date,
  starterSeasonValue,
  totalValue,
  avgAge,
  maxStarterSeasonValue,
  maxTotalValue,
}: {
  manager: string;
  date: string;
  starterSeasonValue: number;
  totalValue: number;
  avgAge: number | null;
  maxStarterSeasonValue: number;
  maxTotalValue: number;
}): TradeTeamContext {
  const contenderScore = Math.round(
    (normalizeScore(starterSeasonValue, maxStarterSeasonValue) * 0.72)
    + (normalizeScore(totalValue, maxTotalValue) * 0.28)
  );
  const starterValuePct = totalValue > 0 ? Math.round((starterSeasonValue / totalValue) * 100) : 0;
  const rebuildScore = Math.round(
    ((100 - starterValuePct) * 0.35)
    + ((avgAge !== null ? Math.max(0, 28 - avgAge) * 8 : 35) * 0.65)
  );
  const agingRisk = Math.round(Math.max(0, ((avgAge || 25) - 25) * 18));
  const label = getTimelineLabel(contenderScore, rebuildScore, agingRisk);

  return {
    mode: getTradeContextMode(contenderScore, rebuildScore, label),
    label,
    contenderScore,
    rebuildScore,
    agingRisk,
    avgAge,
    starterSeasonValue: Math.round(starterSeasonValue),
    totalValue: Math.round(totalValue),
    source: 'historical-roster',
    reason: `Pre-trade roster snapshot for ${manager} on ${date}: contender ${contenderScore}, rebuild ${rebuildScore}, age ${avgAge ?? '-'} from the season roster plus later trades rolled back.`,
  };
}

function getTradeParticipants(trade: Trade): number[] {
  const participantIds = new Set<number>();

  for (const rid of Object.values(trade.adds || {})) {
    participantIds.add(rid);
  }
  for (const pick of trade.draft_picks || []) {
    participantIds.add(pick.owner_id);
    if (typeof pick.previous_owner_id === 'number') {
      participantIds.add(pick.previous_owner_id);
    }
  }

  return Array.from(participantIds);
}

function buildHistoricalTradeContextsForSeason(
  season: SeasonData,
  allPlayers: Player,
  ktcValues: KTCValues,
  getPrimaryValue: (pid: string) => number,
  getPrimaryRank: (pid: string) => string | null,
  seasonPositionRankById: Record<string, string | null>,
): Map<number, Record<number, TradeTeamContext>> {
  const rosterState = new Map<number, Set<string>>(
    season.rosters.map((roster) => [roster.roster_id, new Set(getActivePlayerIds(roster))])
  );
  const sortedTrades = [...season.trades].sort((a, b) => b.status_updated - a.status_updated);
  const contextsByTrade = new Map<number, Record<number, TradeTeamContext>>();

  const buildRosterSnapshot = () => {
    const rows = season.rosters.map((roster) => {
      const playerIds = Array.from(rosterState.get(roster.roster_id) || []);
      const players = playerIds
        .map((pid) => {
          const pos = allPlayers[pid]?.position || 'UNK';
          const value = getPrimaryValue(pid);
          if (!isFantasyPosition(pos) || value <= 0) return null;

          const seasonValue = getPlayerRedraftValue(pid, allPlayers, ktcValues) || value;
          return {
            player_id: pid,
            name: getPlayerName(pid, allPlayers),
            pos,
            owner: season.rosterMap[roster.roster_id] || 'Unknown',
            value,
            seasonValue,
            currentPositionRank: getPrimaryRank(pid),
            seasonPositionRank: seasonPositionRankById[pid] || null,
            playerDetails: getPlayerDetails(pid, allPlayers),
          } satisfies ManagerIntelPlayer;
        })
        .filter((player): player is NonNullable<typeof player> => Boolean(player));

      const lineup = selectProjectedLineup(players, season.rosterPositions);
      const starterSeasonValue = lineup.reduce((sum, player) => sum + (player.seasonValue || player.value), 0);
      const totalValue = players.reduce((sum, player) => sum + player.value, 0);
      const avgAge = roundOne(average(players.map((player) => player.playerDetails?.age ?? null)));

      return {
        rosterId: roster.roster_id,
        manager: season.rosterMap[roster.roster_id] || 'Unknown',
        starterSeasonValue,
        totalValue,
        avgAge,
      };
    });

    const maxStarterSeasonValue = Math.max(...rows.map((row) => row.starterSeasonValue), 1);
    const maxTotalValue = Math.max(...rows.map((row) => row.totalValue), 1);
    return { rows, maxStarterSeasonValue, maxTotalValue };
  };

  sortedTrades.forEach((trade) => {
    const participants = getTradeParticipants(trade);
    if (participants.length !== 2) return;

    const [rosterA, rosterB] = participants;
    for (const [pid, newRosterId] of Object.entries(trade.adds || {})) {
      const oldRosterId = newRosterId === rosterA ? rosterB : rosterA;
      rosterState.get(newRosterId)?.delete(pid);
      if (!rosterState.has(oldRosterId)) rosterState.set(oldRosterId, new Set());
      rosterState.get(oldRosterId)?.add(pid);
    }

    const snapshot = buildRosterSnapshot();
    const date = new Date(trade.status_updated).toISOString().split('T')[0];
    const rowsByRoster = new Map(snapshot.rows.map((row) => [row.rosterId, row]));
    const tradeContexts: Record<number, TradeTeamContext> = {};

    for (const rosterId of participants) {
      const row = rowsByRoster.get(rosterId);
      if (!row) continue;
      tradeContexts[rosterId] = buildHistoricalTradeTeamContext({
        manager: row.manager,
        date,
        starterSeasonValue: row.starterSeasonValue,
        totalValue: row.totalValue,
        avgAge: row.avgAge,
        maxStarterSeasonValue: snapshot.maxStarterSeasonValue,
        maxTotalValue: snapshot.maxTotalValue,
      });
    }

    contextsByTrade.set(trade.status_updated, tradeContexts);
  });

  return contextsByTrade;
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

function formatReportValue(value: number): string {
  if (value >= 1000) {
    const scaled = value / 1000;
    return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1)}K`;
  }
  return `${value}`;
}

function getAvailabilityLabel(player: ManagerIntelPlayer): string | null {
  const details = player.playerDetails;
  return normalizeAvailabilityStatus(details?.displayStatus)
    || normalizeAvailabilityStatus(details?.rosterStatus)
    || normalizeAvailabilityStatus(details?.injuryStatus)
    || normalizeAvailabilityStatus(details?.status);
}

function isUnavailableStarter(player: ManagerIntelPlayer): boolean {
  const label = getAvailabilityLabel(player)?.toLowerCase();
  if (!label || label.includes('taxi')) return false;
  return label.includes('ir')
    || label.includes('injured reserve')
    || label.includes('pup')
    || label.includes('nfi')
    || label.includes('out')
    || label.includes('doubt');
}

function findDisplacedLineupPlayer<T extends ManagerIntelPlayer>(
  beforeLineup: T[],
  afterLineup: T[],
  promotedPlayerId: string
): T | null {
  const afterIdsWithoutPromoted = new Set(
    afterLineup
      .filter((player) => player.player_id !== promotedPlayerId)
      .map((player) => player.player_id)
  );

  return beforeLineup
    .filter((player) => !afterIdsWithoutPromoted.has(player.player_id))
    .sort((a, b) => getLineupValue(a) - getLineupValue(b))[0] || null;
}

function getTaxiPromotionContext(
  player: ManagerIntelPlayer,
  activePlayers: ManagerIntelPlayer[],
  rosterPositions?: string[]
): { shouldPromote: boolean; reason: string | null; scoreBonus: number } {
  const taxiValue = getLineupValue(player);
  const activeLineup = selectValueProjectedLineup(activePlayers, rosterPositions);
  const activeWithTaxiLineup = selectValueProjectedLineup([...activePlayers, player], rosterPositions);
  const taxiStartsNow = activeWithTaxiLineup.some((lineupPlayer) => lineupPlayer.player_id === player.player_id);

  if (taxiStartsNow) {
    const displacedPlayer = findDisplacedLineupPlayer(activeLineup, activeWithTaxiLineup, player.player_id);
    const displacedValue = displacedPlayer ? getLineupValue(displacedPlayer) : 0;

    if (!displacedPlayer || taxiValue > displacedValue) {
      return {
        shouldPromote: true,
        reason: displacedPlayer
          ? `${getRankLabel(player)} is above the current starting path, beating ${displacedPlayer.name} (${formatReportValue(displacedValue)}) for a lineup or flex spot.`
          : `${getRankLabel(player)} fills an open lineup spot, so this is a real activation instead of bench depth.`,
        scoreBonus: 6500,
      };
    }
  }

  const activeLineupIds = new Set(activeLineup.map((lineupPlayer) => lineupPlayer.player_id));
  const hurtStarters = activeLineup.filter(isUnavailableStarter);
  for (const hurtStarter of hurtStarters) {
    const activeWithoutStarter = activePlayers.filter((candidate) => candidate.player_id !== hurtStarter.player_id);
    const replacementLineup = selectValueProjectedLineup(activeWithoutStarter, rosterPositions);
    const fillIn = replacementLineup
      .filter((candidate) => !activeLineupIds.has(candidate.player_id))
      .sort((a, b) => getLineupValue(a) - getLineupValue(b))[0] || null;
    const taxiReplacementLineup = selectValueProjectedLineup([...activeWithoutStarter, player], rosterPositions);
    const taxiStartsIfStarterSits = taxiReplacementLineup.some((lineupPlayer) => lineupPlayer.player_id === player.player_id);

    if (!taxiStartsIfStarterSits) continue;

    const displacedFillIn = findDisplacedLineupPlayer(replacementLineup, taxiReplacementLineup, player.player_id);
    const fallbackFillIn = displacedFillIn || fillIn;
    const fillInValue = fallbackFillIn ? getLineupValue(fallbackFillIn) : 0;

    if ((!fallbackFillIn && taxiReplacementLineup.length > replacementLineup.length) || taxiValue > fillInValue) {
      return {
        shouldPromote: true,
        reason: fallbackFillIn
          ? `${hurtStarter.name} is tagged ${getAvailabilityLabel(hurtStarter)}, and ${getRankLabel(player)} beats the active fill-in ${fallbackFillIn.name} (${formatReportValue(fillInValue)}).`
          : `${hurtStarter.name} is tagged ${getAvailabilityLabel(hurtStarter)}, and ${getRankLabel(player)} fills the open lineup slot.`,
        scoreBonus: 6200,
      };
    }
  }

  return { shouldPromote: false, reason: null, scoreBonus: 0 };
}

function getTaxiTriageAction({
  player,
  starterThresholds,
  needPosition,
  promotion,
}: {
  player: ManagerIntelPlayer;
  starterThresholds: StarterThresholds;
  needPosition: 'QB' | 'RB' | 'WR' | 'TE' | null;
  promotion: { shouldPromote: boolean; reason: string | null; scoreBonus: number };
}): { action: TaxiTriageAction; reason: string; score: number } {
  const position = player.pos as keyof StarterThresholds;
  const starterLine = starterThresholds[position] || 0;
  const rankNumber = getRankNumber(player.seasonPositionRank || player.currentPositionRank);
  const age = player.playerDetails?.age ?? null;
  const seasonValue = getLineupValue(player);
  const fillsNeed = needPosition === player.pos;
  const depthLine = Math.round(starterLine * 1.75);

  if (promotion.shouldPromote) {
    return {
      action: 'Promote Now',
      reason: `${promotion.reason}${fillsNeed ? ` It also directly answers the ${player.pos} need.` : ''}`,
      score: promotion.scoreBonus + seasonValue,
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
      reason: `${getRankLabel(player)} still carries enough dynasty value to matter in a deal, but does not beat the current lineup or injury fill-in path yet.`,
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
      reason: `Young or ranked enough to keep developing, but not above a current starter, flex option, or injury fill-in yet.`,
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
      summary: `Trade from ${tradePlan.surplusPosition || 'surplus'} into ${tradePlan.needPosition || 'need'}: use ${sellCandidate.name} to shop for similar-value help like ${buyTarget.name}.`,
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
    currentSeasonData.rosters.flatMap(getRosterPlayerIds),
    allPlayers,
    ktcValues
  );
  const getPrimaryValue = (pid: string) => {
    if (useSeasonAsPrimary) {
      return getPlayerRedraftValue(pid, allPlayers, ktcValues) || getPlayerValue(pid, allPlayers, ktcValues);
    }
    return getPlayerValue(pid, allPlayers, ktcValues);
  };
  const getPrimarySnapshotValue = (pid: string, snapshot: KTCValues) => {
    if (useSeasonAsPrimary) {
      return getPlayerRedraftValue(pid, allPlayers, snapshot) || getPlayerValue(pid, allPlayers, snapshot);
    }
    return getPlayerValue(pid, allPlayers, snapshot);
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
      const pids = getRosterPlayerIds(r);
      pastRosterValues[name] = pids.reduce(
        (sum, pid) => sum + getPrimaryValue(pid),
        0
      );
    }
  }

  // Process current season rosters
  for (const r of currentSeasonData.rosters) {
    const name = currentSeasonData.rosterMap[r.roster_id];
    const pids = getRosterPlayerIds(r);
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

      const currentWeeklyVal = getPrimarySnapshotValue(pid, ktcValues);
      const lastWeekVal = getPrimarySnapshotValue(pid, ktcValuesLastWeek);
      if (currentWeeklyVal > 0 && lastWeekVal > 0) {
        const pct_change = (currentWeeklyVal - lastWeekVal) / lastWeekVal * 100;
        weeklyMomentum.push({
          name: getPlayerName(pid, allPlayers),
          player_id: pid,
          playerDetails: getPlayerDetails(pid, allPlayers, getRosterPlayerStatus(r, pid)),
          currentPositionRank: getPrimaryRank(pid),
          owner: name,
          pos,
          val_last: lastWeekVal,
          val_now: currentWeeklyVal,
          diff: currentWeeklyVal - lastWeekVal,
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

    const positionStarterCounts = getPositionStarterCounts(currentSeasonData.rosterPositions, currentSeasonData.rosters.length || 10);
    for (const [pos, values] of Object.entries(posSeasonValues)) {
      const position = pos as keyof StarterThresholds;
      const topCount = positionStarterCounts[position];
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
    team_a_context?: TradeTeamContext;
    team_b_context?: TradeTeamContext;
  }> = [];

  for (const season of [currentSeasonData, ...(pastSeasonData ? [pastSeasonData] : [])]) {
    const historicalTradeContexts = buildHistoricalTradeContextsForSeason(
      season,
      allPlayers,
      ktcValues,
      getPrimaryValue,
      getPrimaryRank,
      seasonPositionRankById,
    );

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
        const historicalContext = historicalTradeContexts.get(tx.status_updated);

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
          team_a_context: historicalContext?.[r1],
          team_b_context: historicalContext?.[r2],
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
    .sort((a, b) => b.pct_change - a.pct_change || b.diff - a.diff)
    .slice(0, 10);

  const weeklyFallers = weeklyMomentum
    .filter((player) => player.diff < 0 && player.pct_change < 0)
    .sort((a, b) => a.pct_change - b.pct_change || a.diff - b.diff)
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
    const pids = normalizePlayerIds([
      ...getActivePlayerIds(r),
      ...getTaxiPlayerIds(r),
      ...getReservePlayerIds(r),
    ]);
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

  // Second pass: identify the league-low and league-high outliers for each position.
  for (const { manager, posCounts } of managerPosCounts) {
    for (const [pos, count] of Object.entries(posCounts)) {
      if (pos in dynamicThresholds) {
        const { shortage, excess } = dynamicThresholds[pos];
        const counts = allPosCounts[pos] || [];
        const hasSpread = shortage !== excess;

        if (hasSpread && count === shortage) {
          positionDepth.push({
            manager,
            position: pos,
            count,
            status: 'shortage',
          });
        } else if (hasSpread && count === excess) {
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
    rosterPlayers: Array<{
      player_id: string;
      name: string;
      pos: string;
      value: number;
      seasonValue?: number;
      currentPositionRank?: string | null;
      seasonPositionRank?: string | null;
      playerDetails?: PlayerDetails;
    }>;
    starterGroups: Array<{
      key: string;
      label: string;
      count: number;
      players: Array<{
        player_id: string;
        name: string;
        pos: string;
        value: number;
        seasonValue?: number;
        currentPositionRank?: string | null;
        seasonPositionRank?: string | null;
        playerDetails?: PlayerDetails;
      }>;
    }>;
  }> = [];

  for (const r of currentSeasonData.rosters) {
    const name = currentSeasonData.rosterMap[r.roster_id];
    const activePids = getActivePlayerIds(r);
    const rosterPids = normalizePlayerIds([
      ...activePids,
      ...getTaxiPlayerIds(r),
      ...getReservePlayerIds(r),
    ]);
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
    const rosterPlayers: typeof lineupPlayers = [];

    const buildCountPlayer = (pid: string) => {
      const p = allPlayers[pid];
      const pos = p?.position || 'UNK';
      if (!['QB', 'RB', 'WR', 'TE'].includes(pos)) return null;
      const positionRank = getPrimaryRank(pid);
      const value = getPrimaryValue(pid);
      if (value <= 0) return null;
      const seasonValue = getPlayerRedraftValue(pid, allPlayers, ktcValues) || value;
      const seasonPositionRank = seasonPositionRankById[pid] || null;
      const playerDetails = getPlayerDetails(pid, allPlayers, getRosterPlayerStatus(r, pid));
      return {
        player_id: pid,
        name: getPlayerName(pid, allPlayers),
        pos,
        value,
        seasonValue,
        currentPositionRank: positionRank,
        seasonPositionRank,
        playerDetails,
      };
    };

    for (const pid of rosterPids) {
      const countPlayer = buildCountPlayer(pid);
      if (!countPlayer) continue;
      const pos = countPlayer.pos;
      if (pos in posCounts) {
        posCounts[pos]++;
        rosterPlayers.push(countPlayer);
      }
    }

    for (const pid of activePids) {
      const lineupPlayer = buildCountPlayer(pid);
      if (lineupPlayer) lineupPlayers.push(lineupPlayer);
    }

    const starterGroups = getLineupGroups(lineupPlayers, currentSeasonData.rosterPositions);
    const projectedStarters = starterGroups.flatMap((group) => group.players);
    for (const player of projectedStarters) {
      if (isFantasyPosition(player.pos)) {
        posStarterCounts[player.pos]++;
      }
      starterPlayers.push(player);
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
      rosterPlayers: rosterPlayers.sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)),
      starterGroups: starterGroups.map((group) => ({
        key: group.key,
        label: group.label,
        count: group.count,
        players: group.players.sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)),
      })),
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
    const allTaxiPlayers = getTaxiPlayerIds(r)
      .map((pid) => buildIntelPlayer(pid, manager, r))
      .filter((player): player is BuiltIntelPlayer => Boolean(player));
    const taxiPlayers = allTaxiPlayers;
    const reservePlayers = getReservePlayerIds(r)
      .map((pid) => buildIntelPlayer(pid, manager, r))
      .filter((player): player is BuiltIntelPlayer => Boolean(player));
    const rosterAssetPlayers = [...rosterPlayers, ...reservePlayers, ...taxiPlayers];
    const externalPlayers = currentSeasonData.rosters
      .filter((otherRoster) => otherRoster.roster_id !== r.roster_id)
      .flatMap((otherRoster) => {
        const owner = currentSeasonData.rosterMap[otherRoster.roster_id];
        return normalizePlayerIds([...(otherRoster.players || []), ...(otherRoster.taxi || []), ...(otherRoster.reserve || [])])
          .map((pid) => buildIntelPlayer(pid, owner, otherRoster));
      })
      .filter((player): player is BuiltIntelPlayer => Boolean(player));

    const projectedStarters = selectProjectedLineup(rosterPlayers, currentSeasonData.rosterPositions);
    const projectedStarterIds = new Set(projectedStarters.map((player) => player.player_id));
    rosterPlayers.forEach((player) => {
      player.isStarter = projectedStarterIds.has(player.player_id);
    });
    reservePlayers.forEach((player) => {
      player.isStarter = false;
    });
    taxiPlayers.forEach((player) => {
      player.isStarter = false;
    });
    const movableRosterPlayers = [...rosterPlayers, ...reservePlayers];
    const starters = projectedStarters
      .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value));
    const bench = rosterPlayers.filter((player) => !player.isStarter).sort((a, b) => b.value - a.value);
    const leagueLineupRows = currentSeasonData.rosters.map((otherRoster) => {
      const owner = currentSeasonData.rosterMap[otherRoster.roster_id];
      const players = otherRoster.roster_id === r.roster_id
        ? rosterPlayers
        : getActivePlayerIds(otherRoster)
          .map((pid) => buildIntelPlayer(pid, owner, otherRoster))
          .filter((player): player is BuiltIntelPlayer => Boolean(player));
      const lineup = selectProjectedLineup(players, currentSeasonData.rosterPositions);
      const lineupIds = new Set(lineup.map((player) => player.player_id));

      return {
        manager: owner,
        groups: getLineupGroups(players, currentSeasonData.rosterPositions),
        bench: players.filter((player) => !lineupIds.has(player.player_id)).sort(compareLineupPlayers),
      };
    });
    const benchBaselineRows = currentSeasonData.rosters.map((otherRoster) => {
      const owner = currentSeasonData.rosterMap[otherRoster.roster_id];
      const activePlayers = otherRoster.roster_id === r.roster_id
        ? rosterPlayers
        : getActivePlayerIds(otherRoster)
          .map((pid) => buildIntelPlayer(pid, owner, otherRoster))
          .filter((player): player is BuiltIntelPlayer => Boolean(player));
      const taxiDepthPlayers = otherRoster.roster_id === r.roster_id
        ? allTaxiPlayers
        : getTaxiPlayerIds(otherRoster)
          .map((pid) => buildIntelPlayer(pid, owner, otherRoster))
          .filter((player): player is BuiltIntelPlayer => Boolean(player));
      const lineup = selectProjectedLineup(activePlayers, currentSeasonData.rosterPositions);
      const lineupIds = new Set(lineup.map((player) => player.player_id));

      return {
        manager: owner,
        bench: [
          ...activePlayers.filter((player) => !lineupIds.has(player.player_id)),
          ...taxiDepthPlayers,
        ].sort(compareLineupPlayers),
      };
    });
    const starterValue = starters.reduce((sum, player) => sum + player.value, 0);
    const starterSeasonValue = starters.reduce((sum, player) => sum + (player.seasonValue || getPlayerRedraftValue(player.player_id, allPlayers, ktcValues)), 0);
    const benchValue = [...bench, ...reservePlayers, ...taxiPlayers].reduce((sum, player) => sum + player.value, 0);
    const totalValue = starterValue + benchValue;
    const starterValuePct = totalValue > 0 ? Math.round((starterValue / totalValue) * 100) : 0;
    const avgAge = roundOne(average(rosterAssetPlayers.map((player) => player.age)));
    const avgAgeByPosition = {
      QB: roundOne(average(rosterAssetPlayers.filter((player) => player.pos === 'QB').map((player) => player.age))),
      RB: roundOne(average(rosterAssetPlayers.filter((player) => player.pos === 'RB').map((player) => player.age))),
      WR: roundOne(average(rosterAssetPlayers.filter((player) => player.pos === 'WR').map((player) => player.age))),
      TE: roundOne(average(rosterAssetPlayers.filter((player) => player.pos === 'TE').map((player) => player.age))),
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
      [...rosterAssetPlayers]
        .filter((player) => player.value >= 1000)
        .sort((a, b) => (b.age || 0) - (a.age || 0)) || [],
      usedInsightPlayerIds
    );
    const youngCorePlayer = pickDistinctPlayer(
      [...rosterAssetPlayers]
        .filter((player) => (player.age || 99) <= 25 && player.value >= 2500)
        .sort((a, b) => b.value - a.value),
      usedInsightPlayerIds
    );
    const breakoutCandidate = pickDistinctPlayer(
      [...rosterAssetPlayers]
        .filter((player) => {
          const rank = getRankNumber(player.currentPositionRank) || 999;
          const eliteLine = player.pos === 'QB' || player.pos === 'TE' ? 8 : 18;
          return (player.age || 99) <= 26 && player.value >= 1200 && rank > eliteLine;
        })
        .sort((a, b) => b.value - a.value),
      usedInsightPlayerIds
    );
    const lastSeasonStud = pickDistinctPlayer(
      [...rosterAssetPlayers]
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
        const promotion = getTaxiPromotionContext(player, rosterPlayers, currentSeasonData.rosterPositions);
        const triage = getTaxiTriageAction({
          player,
          starterThresholds,
          needPosition: primaryNeed,
          promotion,
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
    const sellPool = [...movableRosterPlayers]
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
    const tradeChip = pickDistinctPlayer(
      [...bench]
        .filter((player) => player.value >= 1000)
        .sort((a, b) => b.value - a.value),
      usedInsightPlayerIds
    );
    const tradeValueAnchor = sellCandidate?.value || tradeChip?.value || bestBenchStash?.value || 0;
    const targetBudget = tradeValueAnchor
      ? Math.max(900, Math.round(tradeValueAnchor * 1.18 + 250))
      : 1800;
    const targetValueFloor = tradeValueAnchor
      ? Math.max(500, Math.round(tradeValueAnchor * 0.72))
      : 700;
    const buyTargetPool = [...externalPlayers]
      .filter((player) => {
        if (primaryNeed && player.pos !== primaryNeed) return false;
        if (!primaryNeed && !['RB', 'WR', 'TE'].includes(player.pos)) return false;
        if (player.value < targetValueFloor) return false;
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
          if (player.value < targetValueFloor) return false;
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
        ? `Shop ${surplusPosition} surplus (${sellCandidate.name}) for similar-value ${primaryNeed} help (${buyTarget.name}).`
        : primaryNeed
          ? `Priority is ${primaryNeed}, but there is no clean same-budget surplus-for-need swap yet.`
          : surplusPosition
            ? `No screaming lineup hole; surplus is most movable at ${surplusPosition}.`
            : 'No obvious need-for-surplus trade path from the current roster shape.',
    };
    const positionGrades = buildPositionGrades({ qbs, rbs, wrs, tes, teamCount });
    const startingRosterStrength = buildStartingRosterStrengthTiles(manager, leagueLineupRows, teamCount);
    const benchBaseline = buildBenchBaselineTiles(
      manager,
      benchBaselineRows,
      currentSeasonData.rosterPositions,
      teamCount
    );
    const tradeableDepth = buildTradeableDepthTiles(bench);
    const injuryInsurance = pickDistinctPlayer(
      [...bench]
        .filter((player) => ['RB', 'WR', 'TE'].includes(player.pos))
        .sort((a, b) => getPlayerRedraftValue(b.player_id, allPlayers, ktcValues) - getPlayerRedraftValue(a.player_id, allPlayers, ktcValues)),
      usedInsightPlayerIds
    );
    const similarValuePlayers = Object.fromEntries(
      (['QB', 'RB', 'WR', 'TE'] as const).map((pos) => {
        const anchor = starters.find((player) => player.pos === pos) || rosterAssetPlayers.find((player) => player.pos === pos);
        if (!anchor) return [pos, null];
        const closest = rosterAssetPlayers
          .filter((player) => player.pos === pos && player.player_id !== anchor.player_id)
          .sort((a, b) => Math.abs(a.value - anchor.value) - Math.abs(b.value - anchor.value))[0] || null;
        return [pos, closest];
      })
    ) as Record<'QB' | 'RB' | 'WR' | 'TE', ManagerIntelPlayer | null>;
    const droppablePlayers = [...movableRosterPlayers]
      .filter((player) => !player.isStarter)
      .sort((a, b) => {
        const rankDelta = (getRankNumber(b.currentPositionRank) || 999) - (getRankNumber(a.currentPositionRank) || 999);
        return rankDelta || a.value - b.value;
      })
      .slice(0, 3);
    const untouchablePlayers = [...rosterAssetPlayers]
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
      rosterPlayers: rosterAssetPlayers,
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
      startingRosterStrength,
      benchBaseline,
      tradeableDepth,
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
    leagueDiagnostics: buildLeagueDiagnostics(currentSeasonData, leagueValueMode, ktcValues),
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
