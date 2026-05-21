export interface PlayerInfo {
  name: string;
  player_id?: string;
  playerDetails?: PlayerDetails;
  currentPositionRank?: string | null;
  owner: string;
  pos: string;
  age: number | null;
  val_2026: number;
  val_2027: number;
  diff: number;
}

export interface WeeklyMomentum {
  name: string;
  player_id?: string;
  playerDetails?: PlayerDetails;
  currentPositionRank?: string | null;
  owner: string;
  pos: string;
  val_last: number;
  val_now: number;
  diff: number;
  pct_change: number;
}

export type RankingBoardCategory = 'dynasty' | 'redraft' | 'devy';

export type RankingBoardFormat =
  | 'dynastySf'
  | 'dynastyOneQb'
  | 'devySf'
  | 'devyOneQb'
  | 'redraftPpr'
  | 'redraftHalfPpr'
  | 'redraftStandard';

export interface RankingPlayer {
  id: string;
  player_id?: string;
  name: string;
  pos: string;
  team?: string | null;
  college?: string | null;
  age?: number | null;
  draftYear?: number | null;
  collegeLogoUrl?: string | null;
  overallRank: number;
  positionRank?: string | null;
  sourceOverallRank?: number | null;
  sourcePositionRank?: string | null;
  value: number;
  ktcValue?: number | null;
  ktcRank?: number | null;
  flockValue?: number | null;
  flockRank?: number | null;
  fantasyProsDynastyValue?: number | null;
  dynastyNerdsValue?: number | null;
  fantasyNerdsValue?: number | null;
  fantasyCalcValue?: number | null;
  dynastyProcessValue?: number | null;
  dynastyDealerBenchmark?: number | null;
  dynastyDealerVoteRating?: number | null;
  fantasyProsValue?: number | null;
  redraftAveragePick?: number | null;
  redraftProjectedPoints?: number | null;
  redraftSourceRanks?: Record<string, number | null | undefined>;
  fantasyProsDevyRank?: number | null;
  fantasyProsDevyPositionRank?: string | null;
  fantasyProsDevyAge?: number | null;
  fantasyProsDevyBestRank?: number | null;
  fantasyProsDevyWorstRank?: number | null;
  fantasyProsDevyAverageRank?: number | null;
  fantasyProsDevyStdDev?: number | null;
  projectedRookiePick?: string | null;
  seasonValue?: number | null;
  tier?: string | number | null;
  movement?: number | null;
  movementLabel?: string | null;
  movementDirection?: 'up' | 'down' | 'flat' | null;
  rankMovement?: number | null;
  rankMovementLabel?: string | null;
  rankMovementDirection?: 'up' | 'down' | 'flat' | null;
  previousYearPprAverage?: number | null;
  owner?: string | null;
  rosterStatus?: string | null;
  sources: string[];
  sourceCount: number;
  isDevy?: boolean;
  isPick?: boolean;
  imageUrl?: string | null;
  prospectProfile?: ProspectProfile | null;
  athleticProfile?: PlayerDetails['athleticProfile'] | null;
}

export interface RankingIdentityDiagnostic {
  id: string;
  profileKey: string;
  board: RankingBoardCategory;
  playerName: string;
  sourceKey: string;
  status: 'unmatched' | 'resolved-collision';
  selectedPlayerId?: string | null;
  selectedPlayerName?: string | null;
  candidates?: Array<{
    playerId: string;
    name: string;
    position?: string | null;
    team?: string | null;
  }>;
  note: string;
}

export interface RankingProfileOption {
  key: string;
  label: string;
  board: RankingBoardCategory;
  qbFormat: 'sf' | 'one_qb';
  tep: 0 | 0.5 | 1 | 1.5;
  ppr?: 0 | 0.5 | 1;
}

export interface RankingSourceWeightEntry {
  key: string;
  source: string;
  weight: number;
  percent: number;
  note: string;
  baseWeight?: number | null;
  effectiveWeight?: number | null;
  trustScore?: number | null;
  trustMultiplier?: number | null;
}

export interface RankingSourceDiagnostic {
  key: string;
  source: string;
  board: RankingBoardCategory;
  status: 'loaded' | 'empty' | 'disabled' | 'stale' | 'error';
  rowCount: number;
  note: string;
  error?: string | null;
  season?: string | null;
  expectedSeason?: string | null;
  loadedAt?: string | null;
  trustScore?: number | null;
  trustMultiplier?: number | null;
  baseWeight?: number | null;
  effectiveWeight?: number | null;
  trustSampleSize?: number | null;
  medianConsensusDeltaPct?: number | null;
  recentSuccessRate?: number | null;
  rowCountRatio?: number | null;
  trustNote?: string | null;
  previousTrustScore?: number | null;
  trustScoreDelta?: number | null;
  previousTrustMultiplier?: number | null;
  trustMultiplierDelta?: number | null;
  previousEffectiveWeight?: number | null;
  effectiveWeightDelta?: number | null;
  trustAlert?: {
    level: 'info' | 'warn' | 'danger';
    message: string;
  } | null;
}

export interface RankingsBoard {
  generatedAt: string;
  selectedProfileKey?: string | null;
  selectedProfileLabel?: string | null;
  defaultProfileKey?: string | null;
  defaultDevyProfileKey?: string | null;
  defaultRedraftProfileKey?: string | null;
  profileOptions?: RankingProfileOption[];
  sourceWeightProfiles?: Record<string, {
    label: string;
    sources: RankingSourceWeightEntry[];
  }>;
  profiles?: Record<string, RankingPlayer[]>;
  profileRowCounts?: Record<string, number>;
  identityDiagnostics?: RankingIdentityDiagnostic[];
  dynastySourceDiagnostics?: RankingSourceDiagnostic[];
  redraftSourceDiagnostics?: RankingSourceDiagnostic[];
  devySourceDiagnostics?: RankingSourceDiagnostic[];
  draftBuzzScoreboard?: DraftBuzzScoreboardEntry[];
  draftBuzzScoreboardCount?: number;
  payloadMode?: 'full' | 'metadata';
  dynastySf: RankingPlayer[];
  dynastyOneQb: RankingPlayer[];
  devySf: RankingPlayer[];
  devyOneQb: RankingPlayer[];
  redraftPpr?: RankingPlayer[];
  redraftHalfPpr?: RankingPlayer[];
  redraftStandard?: RankingPlayer[];
}

export interface DraftBuzzScoreboardEntry {
  id: string;
  player_id?: string | null;
  team?: string | null;
  nflTeam?: string | null;
  age?: number | null;
  draftYear: number;
  name: string;
  position: string;
  college?: string | null;
  playerImageUrl?: string | null;
  collegeLogoUrl?: string | null;
  rating: number;
  overallRank?: number | null;
  positionRank?: number | null;
  averageOverallRank?: number | null;
  averagePositionRank?: number | null;
  height?: string | null;
  weight?: string | null;
  fortyYardDash?: number | null;
  role?: string | null;
  sourceUrl?: string | null;
  summary?: string | null;
  prospectProfile: ProspectProfile;
  athleticProfile?: PlayerDetails['athleticProfile'] | null;
}

export type ProspectProfileSource = 'NFL Draft Buzz' | 'ESPN';

export interface ProspectProfile {
  source: ProspectProfileSource;
  sourceUrl?: string | null;
  scrapeMonth?: string | null;
  espnId?: string | null;
  draftYear: number;
  name: string;
  position: string;
  role?: string | null;
  classYear?: string | null;
  jersey?: string | null;
  status?: string | null;
  birthPlace?: string | null;
  college?: string | null;
  nflTeam?: string | null;
  playerImageUrl?: string | null;
  collegeLogoUrl?: string | null;
  overallRank?: number | null;
  positionRank?: number | null;
  rating?: number | null;
  averageOverallRank?: number | null;
  averagePositionRank?: number | null;
  height?: string | null;
  weight?: string | null;
  fortyYardDash?: number | null;
  summary?: string | null;
  fantasyProsDevyRank?: number | null;
  fantasyProsDevyPositionRank?: string | null;
  fantasyProsDevyAge?: number | null;
  fantasyProsDevyBestRank?: number | null;
  fantasyProsDevyWorstRank?: number | null;
  fantasyProsDevyAverageRank?: number | null;
  fantasyProsDevyStdDev?: number | null;
  projectedRookiePick?: string | null;
}

export interface ProspectSourceDiagnostics {
  source: 'NFL Draft Buzz';
  status: 'stored' | 'partial' | 'missing' | 'error';
  scrapeMonth?: string | null;
  generatedAt?: string | null;
  playerCount: number;
  yearsTracked: number[];
  note: string;
  errors?: string[];
}

export interface SourceSnapshotFreshnessDiagnostic {
  sourceKey: string;
  source: string;
  tableName: string;
  snapshotKey: string | null;
  updatedAt: string | null;
  ageHours: number | null;
  payloadSizeBytes: number | null;
  rowCount: number | null;
  status: 'loaded' | 'stale' | 'missing' | 'error';
  level: 'info' | 'warn' | 'danger';
  note: string;
  lastHealthStatus?: string | null;
  lastHealthMessage?: string | null;
  lastHealthAt?: string | null;
}

export interface ManagerData {
  total_val: number;
  past_val: number;
  growth: number;
  pos_vals: Record<string, number>;
  v2027: number;
}

export interface ManagerChampionship {
  seasons: string[];
  runnerUpSeasons?: string[];
  lastPlaceSeasons?: string[];
}

export interface TradeData {
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
  winners?: string[];
  team_a_context?: TradeTeamContext;
  team_b_context?: TradeTeamContext;
  value_context?: TradeValueContext;
}

export interface TradeValueContext {
  source: 'historical-value-index' | 'stored-trade-snapshot' | 'current-value';
  profileKey?: string | null;
  playerAssetCount: number;
  historicalPlayerAssetCount: number;
  fallbackPlayerAssetCount: number;
  maxDaysAway?: number | null;
  note: string;
}

export interface TradeTeamContext {
  mode: 'dynasty' | 'contender' | 'rebuilder';
  label: string;
  contenderScore: number;
  rebuildScore: number;
  agingRisk: number;
  avgAge: number | null;
  starterSeasonValue: number;
  totalValue: number;
  source: 'historical-roster' | 'current-roster';
  reason: string;
  rosterPlayers?: ManagerIntelPlayer[];
  tradeTimePicks?: TradeTimePickAsset[];
}

export interface TradeTimePickAsset {
  id: string;
  label: string;
  season: string;
  round: number;
  originalRosterId: number;
  originalOwner: string;
  ownerRosterId: number;
  owner: string;
  value: number;
  draftSlot?: number | null;
}

export interface PositionDepth {
  manager: string;
  position: string;
  count: number;
  status: 'shortage' | 'excess';
}

export interface ManagerStarterPlayer {
  player_id: string;
  name: string;
  pos: string;
  owner?: string | null;
  value: number;
  seasonValue?: number;
  currentPositionRank?: string | null;
  seasonPositionRank?: string | null;
  playerDetails?: PlayerDetails;
}

export interface ManagerStarterGroup {
  key: string;
  label: string;
  count: number;
  players: ManagerStarterPlayer[];
}

export interface ManagerIntelPlayer {
  player_id: string;
  name: string;
  pos: string;
  owner?: string | null;
  value: number;
  seasonValue?: number;
  currentPositionRank?: string | null;
  seasonPositionRank?: string | null;
  lastSeasonPositionRank?: string | null;
  lastSeasonFantasyPoints?: number | null;
  lastSeasonGames?: number | null;
  lastSeasonPointsPerGame?: number | null;
  lastSeasonYear?: string | null;
  playerDetails?: PlayerDetails;
}

export type TaxiTriageAction =
  | 'Promote Now'
  | 'Keep Parked'
  | 'Trade Sweetener'
  | 'Cuttable'
  | 'Taxi Risk';

export interface TaxiTriageItem extends ManagerIntelPlayer {
  taxiAction: TaxiTriageAction;
  taxiReason: string;
  taxiScore: number;
}

export interface OwnerLineupStrengthTile {
  key: string;
  label: string;
  count: number;
  leagueRank: number | null;
  grade: string;
  playerNames: string[];
  note: string;
}

export interface OwnerBenchBaselineTile {
  key: string;
  label: string;
  count: number;
  leagueRank: number | null;
  grade: string;
  player: ManagerIntelPlayer | null;
  players?: ManagerIntelPlayer[];
  note: string;
}

export interface OwnerTradeableDepthTile {
  position: 'QB' | 'RB' | 'WR' | 'TE';
  player: ManagerIntelPlayer | null;
  note: string;
}

export interface ManagerRosterIntelligence {
  manager: string;
  identity: string;
  timeline: string;
  summary: string;
  strategySummary?: string;
  starterValue: number;
  starterSeasonValue?: number;
  benchValue: number;
  starterValuePct: number;
  bestBenchStash: ManagerIntelPlayer | null;
  weakestStarter: ManagerIntelPlayer | null;
  oldestPlayer: ManagerIntelPlayer | null;
  youngCorePlayer: ManagerIntelPlayer | null;
  breakoutCandidate: ManagerIntelPlayer | null;
  lastSeasonStud: ManagerIntelPlayer | null;
  buyTarget: ManagerIntelPlayer | null;
  sellCandidate: ManagerIntelPlayer | null;
  tradePlan?: {
    needPosition: 'QB' | 'RB' | 'WR' | 'TE' | null;
    surplusPosition: 'QB' | 'RB' | 'WR' | 'TE' | null;
    summary: string;
  };
  tradeBlueprints?: Array<{
    label: string;
    summary: string;
    givePlayer?: ManagerIntelPlayer | null;
    getPlayer?: ManagerIntelPlayer | null;
    tone?: 'buy' | 'sell' | 'risk' | 'value';
  }>;
  chaosNotes?: string[];
  marketSignals?: string[];
  pressurePoints?: string[];
  situationSummary?: {
    playerCount: number;
    backedCount: number;
    strongCount: number;
    boostCount: number;
    riskCount: number;
    staleCount: number;
    sourceLimitedCount: number;
    topBoostPlayer?: string | null;
    topRiskPlayer?: string | null;
    note: string;
    signals: string[];
  };
  rosterHealthScore?: number;
  positionGrades?: Record<'QB' | 'RB' | 'WR' | 'TE', {
    rank: number | null;
    grade: string;
    note: string;
  }>;
  startingRosterStrength?: OwnerLineupStrengthTile[];
  benchBaseline?: OwnerBenchBaselineTile[];
  tradeableDepth?: OwnerTradeableDepthTile[];
  tradeChip: ManagerIntelPlayer | null;
  injuryInsurance: ManagerIntelPlayer | null;
  rosterPlayers?: ManagerIntelPlayer[];
  benchPlayers?: ManagerIntelPlayer[];
  taxiPlayers?: ManagerIntelPlayer[];
  reservePlayers?: ManagerIntelPlayer[];
  droppablePlayers: ManagerIntelPlayer[];
  untouchablePlayers: ManagerIntelPlayer[];
  taxiTriage: {
    items: TaxiTriageItem[];
    summary: string;
    counts: Record<TaxiTriageAction, number>;
  };
  similarValuePlayers: Record<'QB' | 'RB' | 'WR' | 'TE', ManagerIntelPlayer | null>;
  avgAge: number | null;
  avgAgeByPosition: Record<'QB' | 'RB' | 'WR' | 'TE', number | null>;
  starterAvailability: {
    avgGamesMissed: number | null;
    riskLevel: 'low' | 'medium' | 'high';
    riskiestStarter: ManagerIntelPlayer | null;
  };
  ageFlags: string[];
  holes: {
    bestQbRank: string | null;
    rb2Rank: string | null;
    wr3Rank: string | null;
    te1Rank: string | null;
    flexDepth: number;
    summary: string;
  };
}

export interface TradeTendency {
  manager: string;
  tradeCount: number;
  wins: number;
  winPct: number;
  profit: number;
  avgGap: number;
  favoritePartner: string | null;
  overpaysForPicks: boolean;
  overpaysForVeterans: boolean;
}

export interface TradeProposalSignal {
  id: string;
  date: string;
  status: string;
  managers: string[];
  playerIds: string[];
  playerNames: string[];
  pickLabels?: string[];
  note: string;
}

export interface SleeperWaiverClaimSignal {
  id: string;
  date: string;
  status: string;
  managers: string[];
  playerIds: string[];
  playerNames: string[];
  dropPlayerIds?: string[];
  dropPlayerNames?: string[];
  bidAmount: number | null;
  waiverBudget?: number | null;
  note: string;
}

export interface SleeperHiddenLeagueSnapshot {
  sharedBy?: string | null;
  sharedAt: number;
  transactionCount: number;
  tradeCount: number;
  waiverCount: number;
}

export interface PowerRanking {
  rank: number;
  manager: string;
  score: number;
  tier: string;
  starterStrength: number;
  rosterValue: number;
  positionalBalance: number;
  draftCapital: number;
  youthScore: number;
  tradeEfficiency: number;
}

export interface DynastyTimeline {
  manager: string;
  contenderScore: number;
  outlook2027: number;
  agingRisk: number;
  rebuildScore: number;
  label: string;
}

export interface PickPortfolio {
  manager: string;
  value2026: number;
  value2027: number;
  count2025: number;
  count2026: number;
  count2027: number;
  value2025: number;
  totalValue: number;
  ownPicks: number;
  acquiredPicks: number;
  projectedSlots: string[];
  futurePicks?: Array<{
    id: string;
    label: string;
    manager: string;
    originalOwner: string;
    season: string;
    round: number;
    value: number;
  }>;
}

export interface WaiverIntelligence {
  rosteredTrendingAdds: TrendingPlayer[];
  availableTrendingAdds: TrendingPlayer[];
  highestKtcAvailable: TrendingPlayer | null;
  bestAvailableByPosition: Record<'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF', TrendingPlayer | null>;
  bestTaxiStashes: TrendingPlayer[];
  recentlyDroppedValuable: TrendingPlayer[];
  weeklyEcrTargets?: WaiverWeeklyEcrTarget[];
  defensePairingTargets?: WaiverWeeklyEcrTarget[];
  omittedCandidates?: WaiverOmittedCandidate[];
}

export interface WaiverWeeklyEcrWeek {
  week: number;
  rankEcr: number | null;
  positionRank: string | null;
  bestRank: number | null;
  worstRank: number | null;
  averageRank: number | null;
  rankStdDev: number | null;
  lastUpdated: string | null;
  sourceKey?: string | null;
  endpointKey?: string | null;
  fetchedAt?: string | null;
  sourceStatus?: string | null;
  sourceType?: 'weekly-rank' | 'draftsharks-sos' | string;
  opponent?: string | null;
  homeAway?: 'home' | 'away' | null;
  opponentRank?: number | null;
  matchupStars?: number | null;
  matchupTier?: 'easy' | 'neutral' | 'hard' | 'bye' | string | null;
  matchupText?: string | null;
  isBye?: boolean;
}

export type MatchupWindowKey =
  | 'next1'
  | 'next3'
  | 'next6'
  | 'restOfSeason'
  | 'playoffs';

export interface MatchupWindowSummary {
  key: MatchupWindowKey;
  label: string;
  weeks: number[];
  score: number | null;
  averageStars: number | null;
  playableWeeks: number;
  easyWeeks: number;
  hardWeeks: number;
  neutralWeeks: number;
  byeWeeks: number;
  bestWeek: number | null;
  bestMatchupStars: number | null;
  bestOpponentRank: number | null;
  worstWeek: number | null;
  summary: string;
}

export interface MatchupWindowSet {
  currentWeek: number | null;
  playoffWeeks: number[];
  next1: MatchupWindowSummary;
  next3: MatchupWindowSummary;
  next6: MatchupWindowSummary;
  restOfSeason: MatchupWindowSummary;
  playoffs: MatchupWindowSummary;
}

export interface WaiverSourceTraceEntry {
  source: 'FantasyPros' | 'DraftSharks' | string;
  sourceKey: string;
  endpointKey: string;
  endpointLabel: string;
  status: string;
  season: string;
  scoring: string;
  week: number | null;
  position: string | null;
  rowCount: number | null;
  fetchedAt: string | null;
  lastUpdated: string | null;
  evidence: string;
}

export interface FantasyProsPlayerSourceTrace {
  source: 'FantasyPros';
  key: string;
  label: string;
  sourceKey?: string | null;
  endpointKey?: string | null;
  value?: number | null;
  rank?: number | null;
  positionRank?: string | null;
  tier?: number | null;
  scoring?: string | null;
  season?: string | null;
  week?: number | null;
  fetchedAt?: string | null;
  lastUpdated?: string | null;
  status?: string | null;
  evidence: string;
}

export interface WaiverWeeklyEcrSignal {
  signalType?: 'weekly-rank' | 'draftsharks-sos' | string;
  playerId: string;
  fantasyProsId: string | null;
  name: string;
  position: string;
  team: string | null;
  source: 'FantasyPros' | 'DraftSharks' | string;
  updatedAt: string | null;
  weeks: WaiverWeeklyEcrWeek[];
  bestWeek: number | null;
  bestRankEcr: number | null;
  bestPositionRank: string | null;
  averageRankEcr: number | null;
  rankDelta: number | null;
  bestMatchupStars?: number | null;
  bestOpponentRank?: number | null;
  matchupWindows?: MatchupWindowSet;
  confidence: number;
  note: string;
  sourceTrace: WaiverSourceTraceEntry[];
  traceSummary: string;
}

export interface WaiverWeeklyEcrTarget {
  player: TrendingPlayer;
  signal: WaiverWeeklyEcrSignal;
  score: number;
}

export interface WaiverOmittedCandidate {
  player_id: string;
  name: string;
  pos: string;
  team: string | null;
  value: number | null;
  rank: string | null;
  sourceCount: number;
  reason: string;
  action: 'omit' | 'review';
}

export interface MatchupPositionEdge {
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF' | string;
  managerProjected?: number | null;
  opponentProjected?: number | null;
  edge?: number | null;
  note?: string | null;
}

export interface MatchupPreview {
  week: number;
  manager: string;
  opponentManager?: string | null;
  projectedPoints?: number | null;
  opponentProjectedPoints?: number | null;
  winProbability?: number | null;
  positionEdges?: MatchupPositionEdge[];
  mustStarts?: ManagerStarterPlayer[];
  vulnerableSpots?: ManagerStarterPlayer[];
  boomBustRisks?: ManagerStarterPlayer[];
  howToWin?: string | null;
  source?: 'Sleeper' | 'FantasyPros' | 'manual' | string;
  updatedAt?: string | null;
}

export type ScheduleTier = 'easy' | 'neutral' | 'hard' | 'elite';

export interface PlayerScheduleProfile {
  source?: string | null;
  updatedAt?: string | null;
  byeWeek?: number | null;
  seasonSOS?: number | null;
  scheduleTier?: ScheduleTier | null;
  streamerWeeks?: number[];
  avoidWeeks?: number[];
}

export interface ScheduleRosterGap {
  manager: string;
  position: string;
  weeks: number[];
  severity: 'low' | 'medium' | 'high';
  note?: string | null;
}

export interface ScheduleStreamerCandidate {
  playerId: string;
  name: string;
  position: string;
  team?: string | null;
  manager?: string | null;
  byeWeek?: number | null;
  seasonSOS?: number | null;
  scheduleTier?: ScheduleTier | null;
  targetWeeks?: number[];
  note?: string | null;
}

export interface SchedulePlanningSummary {
  source?: string | null;
  status?: 'pending' | 'partial' | 'ready';
  updatedAt?: string | null;
  rosterGaps?: ScheduleRosterGap[];
  streamerCandidates?: ScheduleStreamerCandidate[];
  byeWeekNotes?: Array<{
    week: number;
    note?: string | null;
    teams?: string[];
  }>;
}

export interface DraftPick {
  round: number;
  pick: number;
  draftSlot?: number;
  playerName: string;
  playerPos: string;
  manager: string;
  managerDisplayName?: string;
  managerRosterId?: number | null;
  originalOwner?: string | null;
  originalRosterId?: number | null;
  adp: number | null;
  ktcValue: number | null;
  currentKtcValue: number | null;
  valueGain: number | null;
  draftOutcome?: 'hit' | 'miss' | 'neutral';
  isStarter?: boolean;
  positionRankMay2025?: string | null;
  currentPositionRank?: string | null;
  positionRankChange?: string | null;
  draftYear?: string;
  draftKind?: 'rookie' | 'startup' | 'main' | null;
  draftPickCount?: number | null;
  draftType?: string | null;
  draftValueDate?: string | null;
  currentValueDate?: string | null;
  player_id?: string;
  playerDetails?: PlayerDetails;
  draftDecisionVerdict?: string | null;
  draftDecisionTone?: 'value' | 'need' | 'watch' | 'win' | null;
  draftDecisionPrimaryNeed?: string | null;
  draftDecisionBoardRankLabel?: string | null;
  draftDecisionSummary?: string | null;
  draftDecisionAltLabel?: string | null;
  draftDecisionAltPlayerName?: string | null;
  draftDecisionAltPosition?: string | null;
  draftDecisionAltPickLabel?: string | null;
}

export type PlayerCohortPhase = 'early' | 'prime' | 'late-prime' | 'decline' | 'unknown';
export type PlayerCohortOutcomeBucket = 'breakout' | 'sustain' | 'fade-risk' | 'injury-risk' | 'market-over-production' | 'market-under-production' | 'thin-signal';
export type PlayerCohortEvidenceGrade = 'strong' | 'usable' | 'thin' | 'blocked';
export type PlayerDraftCapitalTier = 'premium' | 'day-two' | 'late-round' | 'undrafted' | 'unknown';
export type PlayerOpportunityWindow = 'protected-runway' | 'prove-it-window' | 'short-leash' | 'unknown';
export type PlayerCohortAnomalyRuleKey = 'age-curve-outlier' | 'late-breakout' | 'injury-comeback' | 'small-sample-spike' | 'role-driven-jump';

export interface PlayerCohortAnomalyFlag {
  key: PlayerCohortAnomalyRuleKey;
  label: string;
  tone: 'good' | 'info' | 'warn' | 'danger';
  score: number;
  detail: string;
  evidence: string[];
}

export interface PlayerCohortDraftCapital {
  round: number | null;
  pick: number | null;
  tier: PlayerDraftCapitalTier;
  label: string;
  opportunityWindow: PlayerOpportunityWindow;
  patienceScore: number | null;
  note: string;
}

export interface PlayerCohortSeasonOutcomeReceipt {
  key: string;
  label: string;
  recommendation: 'amplify' | 'lean-positive' | 'neutral' | 'caution' | 'fade-risk';
  stance: 'upside-supported' | 'risk-supported' | 'neutral-reference';
  confidence: number;
  confidenceGrade: 'strong' | 'usable' | 'thin' | 'blocked';
  sampleSize: number;
  displayEligible: boolean;
  productionTier: 'elite' | 'strong' | 'usable' | 'replacement' | 'low-signal';
  roleTier: 'feature' | 'starter' | 'rotation' | 'thin';
  trajectoryFromPrevious: 'first-season' | 'breakout' | 'progression' | 'sustain' | 'regression' | 'collapse' | 'late-career-rebound' | 'low-signal';
  improvedOrSustainedRate: number | null;
  breakoutOrProgressionRate: number | null;
  regressionOrCollapseRate: number | null;
  materialFailureRate: number | null;
  medianNextProductionDelta: number | null;
  medianNextRoleDelta: number | null;
  primaryFailureMode?: {
    key: string;
    label: string;
    rate: number;
  } | null;
  summary: string;
  note: string;
  derivedFrom: string[];
}

export interface PlayerCohortProfile {
  playerId: string;
  name: string;
  position: string;
  age: number | null;
  value: number | null;
  lastSeasonPointsPerGame: number | null;
  agePhase: PlayerCohortPhase;
  productionScore: number | null;
  marketScore: number | null;
  marketProductionDelta: number | null;
  outcomeBucket: PlayerCohortOutcomeBucket;
  confidence: number;
  calibration: {
    evidenceGrade: PlayerCohortEvidenceGrade;
    evidenceScore: number;
    confidenceCap: number;
    strongReadEligible: boolean;
    missingSignals: string[];
    cautionFlags: string[];
    note: string;
  };
  anomalyFlags?: PlayerCohortAnomalyFlag[];
  draftCapital: PlayerCohortDraftCapital;
  seasonOutcomeReceipt?: PlayerCohortSeasonOutcomeReceipt | null;
  peers: Array<{
    playerId: string;
    name: string;
    age: number | null;
    value: number | null;
    lastSeasonPointsPerGame: number | null;
    similarity?: number;
    outcomeBucket?: PlayerCohortOutcomeBucket;
    matchReasons?: string[];
    resultSignal?: string;
  }>;
  historicalComps?: {
    archetype: string;
    summary: string;
    sampleSize: number;
    confidence: number;
    averageSimilarity: number | null;
    consensusOutcome: PlayerCohortOutcomeBucket | null;
    signals: Array<{
      key: string;
      label: string;
      score: number;
      tone: 'good' | 'info' | 'warn' | 'danger' | 'neutral';
      detail: string;
    }>;
    closest: Array<{
      playerId: string;
      name: string;
      age: number | null;
      value: number | null;
      lastSeasonPointsPerGame: number | null;
      similarity: number;
      outcomeBucket: PlayerCohortOutcomeBucket;
      matchReasons: string[];
      resultSignal: string;
    }>;
  };
  trace: string[];
}

export type PlayerSituationDeltaLabel =
  | 'role-boost'
  | 'role-threat'
  | 'crowded-room'
  | 'vacated-opportunity'
  | 'scheme-boost'
  | 'scheme-risk'
  | 'new-team-uncertainty'
  | 'fragile-breakout'
  | 'veteran-runway'
  | 'opportunity-cliff'
  | 'draft-capital-patience'
  | 'late-capital-urgency'
  | 'source-limited-route-read';

export type PlayerSituationDeltaAction = 'buy' | 'hold' | 'sell' | 'stash' | 'monitor' | 'avoid';

export interface PlayerSituationDeltaComponent {
  key: 'prior-opportunity' | 'team-volume' | 'same-position-room' | 'investment-runway' | 'efficiency-quality' | 'availability' | 'market-movement';
  label: string;
  score: number;
  direction: 'boost' | 'risk' | 'neutral';
  trace: string;
}

export interface PlayerSituationFreshness {
  grade: 'fresh' | 'usable' | 'stale' | 'missing';
  score: number;
  latestEventAt?: string | null;
  signals: string[];
  note: string;
}

export interface PlayerSituationDynamicSignal {
  type: 'usage' | 'roster-room' | 'news' | 'injury' | 'schedule' | 'market' | 'source';
  label: string;
  direction: 'boost' | 'risk' | 'neutral';
  detail: string;
  eventAt?: string | null;
}

export interface PlayerSituationDeltaProfile {
  playerId: string;
  name: string;
  position: string;
  score: number;
  confidence: number;
  primaryLabel: PlayerSituationDeltaLabel;
  labels: PlayerSituationDeltaLabel[];
  action: PlayerSituationDeltaAction;
  summary: string;
  trace: string[];
  missingSignals: string[];
  cautionFlags: string[];
  components: PlayerSituationDeltaComponent[];
  freshness: PlayerSituationFreshness;
  dynamicSignals: PlayerSituationDynamicSignal[];
}

export interface PlayerDetails {
  playerId?: string;
  fullName?: string;
  position?: string;
  team?: string | null;
  jerseyNumber?: string | number | null;
  age?: number | null;
  birthDate?: string | null;
  height?: string | number | null;
  weight?: string | number | null;
  college?: string | null;
  rookieYear?: string | number | null;
  nflDraftRound?: string | number | null;
  nflDraftPick?: string | number | null;
  nflDraftTeam?: string | null;
  highSchool?: string | null;
  injuryStatus?: string | null;
  rosterStatus?: 'IR' | 'Taxi' | string | null;
  displayStatus?: string | null;
  depthChartPosition?: string | null;
  depthChartOrder?: number | null;
  sleeperDepthChartPosition?: string | null;
  sleeperDepthChartOrder?: number | null;
  depthChartVerified?: boolean | null;
  depthChartMismatch?: boolean | null;
  yearsExp?: number | null;
  status?: string | null;
  sleeperNewsUpdated?: number | string | null;
  sleeperRosteredPct?: number | null;
  sleeperStartedPct?: number | null;
  sleeperResearchSeason?: string | null;
  sleeperResearchSeasonType?: string | null;
  leagueUsage?: {
    season: string;
    ownedGames: number;
    startedGames: number;
    managerBreakdown: Array<{
      manager: string;
      rosterId: number;
      ownedGames: number;
      startedGames: number;
    }>;
  } | null;
  schedule?: PlayerScheduleProfile | null;
  valueProfile?: {
    dynastyValue?: number | null;
    seasonValue?: number | null;
    contenderValue?: number | null;
    rebuilderValue?: number | null;
    balancedValue?: number | null;
    dynastyPositionRank?: string | null;
    seasonPositionRank?: string | null;
    contenderPositionRank?: string | null;
    rebuilderPositionRank?: string | null;
    balancedPositionRank?: string | null;
    marketKtc?: number | null;
    flockFantasy?: number | null;
    flockRank?: number | null;
    flockPositionRank?: string | null;
    flockTier?: number | null;
    flockFormat?: string | null;
    flockBestBall?: number | null;
    flockBestBallRank?: number | null;
    flockBestBallPositionRank?: string | null;
    flockBestBallFormat?: string | null;
    fantasyProsDynasty?: number | null;
    fantasyProsDynastyRank?: number | null;
    fantasyProsDynastyPositionRank?: string | null;
    fantasyCalcDynasty?: number | null;
    fantasyCalcRedraft?: number | null;
    dynastyProcess?: number | null;
    dynastyNerds?: number | null;
    dynastyNerdsRank?: number | null;
    dynastyNerdsPositionRank?: string | null;
    dynastyNerdsFormat?: string | null;
    fantasyNerds?: number | null;
    fantasyNerdsRank?: number | null;
    fantasyNerdsPositionRank?: string | null;
    dynastyDealerBenchmark?: number | null;
    dynastyDealerVoteRating?: number | null;
    dynastyDealerUpdatedAt?: string | null;
    fantasyProsRank?: number | null;
    fantasyProsPositionRank?: string | null;
    fantasyProsTier?: number | null;
    fantasyProsSeasonValue?: number | null;
    fantasyProsSourceTrace?: FantasyProsPlayerSourceTrace[];
    sources?: string[];
  };
  valueTimeline?: {
    profileKey: string;
    source: 'stored-value-snapshots' | 'historical-value-index' | 'redraft-value-history';
    selectedWindow?: '1m' | '3m' | '6m' | '1y' | 'all';
    availableWindows?: Array<{
      key: '1m' | '3m' | '6m' | '1y' | 'all';
      label: string;
      days: number | null;
      pointCount: number;
      startDate: string;
      endDate: string;
      startValue: number;
      endValue: number;
      delta: number;
      deltaPct: number | null;
    }>;
    windows?: Partial<Record<'1m' | '3m' | '6m' | '1y' | 'all', {
      key: '1m' | '3m' | '6m' | '1y' | 'all';
      label: string;
      days: number | null;
      pointCount: number;
      startDate: string;
      endDate: string;
      startValue: number;
      endValue: number;
      delta: number;
      deltaPct: number | null;
      points: Array<{
        date: string;
        value: number;
        rank?: string | null;
        overallRank?: number | null;
        sources: string[];
        sourceCount: number;
        events?: Array<{
          type: 'news' | 'draft' | 'roster-room' | 'injury' | 'schedule' | 'source-change';
          label: string;
          tone: 'up' | 'down' | 'neutral' | 'warning';
          detail?: string | null;
        }>;
        marketKtc?: number | null;
        fantasyCalcDynasty?: number | null;
        fantasyProsDynasty?: number | null;
        dynastyProcess?: number | null;
        dynastyNerds?: number | null;
        fantasyNerds?: number | null;
        flockFantasy?: number | null;
      }>;
    }>>;
    extremes?: {
      high: {
        date: string;
        value: number;
        rank?: string | null;
        overallRank?: number | null;
        sources: string[];
        sourceCount: number;
      } | null;
      low: {
        date: string;
        value: number;
        rank?: string | null;
        overallRank?: number | null;
        sources: string[];
        sourceCount: number;
      } | null;
    };
    yearlyExtremes?: Array<{
      year: string;
      high: {
        date: string;
        value: number;
        rank?: string | null;
        overallRank?: number | null;
        sources: string[];
        sourceCount: number;
      } | null;
      low: {
        date: string;
        value: number;
        rank?: string | null;
        overallRank?: number | null;
        sources: string[];
        sourceCount: number;
      } | null;
    }>;
    allTimePointCount?: number;
    points: Array<{
      date: string;
      value: number;
      rank?: string | null;
      overallRank?: number | null;
      sources: string[];
      sourceCount: number;
      events?: Array<{
        type: 'news' | 'draft' | 'roster-room' | 'injury' | 'schedule' | 'source-change';
        label: string;
        tone: 'up' | 'down' | 'neutral' | 'warning';
        detail?: string | null;
      }>;
      marketKtc?: number | null;
      fantasyCalcDynasty?: number | null;
      fantasyProsDynasty?: number | null;
      dynastyProcess?: number | null;
      dynastyNerds?: number | null;
      fantasyNerds?: number | null;
      flockFantasy?: number | null;
    }>;
    summary: {
      startValue: number | null;
      endValue: number | null;
      delta: number | null;
      deltaPct: number | null;
      sourceSetChanged: boolean;
      eventCount: number;
      note: string;
    };
  } | null;
  lastSeasonPositionRank?: string | null;
  lastSeasonFantasyPoints?: number | null;
  lastSeasonGames?: number | null;
  lastSeasonPointsPerGame?: number | null;
  lastSeasonYear?: string | null;
  availabilityHistory?: Array<{
    season: string;
    games: number | null;
    gamesMissed: number | null;
    pointsPerGame: number | null;
    positionRank?: string | null;
  }>;
  latestNews?: {
    title: string;
    summary?: string | null;
    source?: string | null;
    url?: string | null;
    publishedAt?: string | null;
  } | null;
  newsValueMovement?: {
    newsTitle: string;
    newsPublishedAt?: string | null;
    currentValue: number | null;
    previousValue: number | null;
    valueDelta: number | null;
    valueDeltaPct: number | null;
    note: string;
  } | null;
  usageTrend?: {
    season: string;
    team?: string | null;
    games: number;
    targets: number;
    carries: number;
    receptions: number;
    fantasyPointsPpr: number;
    fantasyPointsPprPerGame: number | null;
    avgTargetShare: number | null;
    airYardsShare?: number | null;
    wopr?: number | null;
    avgOffenseSnapPct: number | null;
    recentTargets: number;
    recentCarries: number;
    rollingWindows?: Array<{
      games: number;
      weeks: number[];
      targetsPerGame: number | null;
      carriesPerGame: number | null;
      receptionsPerGame: number | null;
      fantasyPointsPprPerGame: number | null;
      targetDeltaPerGame: number | null;
      carryDeltaPerGame: number | null;
      note: string;
    }>;
    targetTrend: 'up' | 'down' | 'flat' | 'unknown';
    carryTrend: 'up' | 'down' | 'flat' | 'unknown';
    note: string;
  } | null;
  teamEnvironment?: {
    source: 'nflverse team stats';
    season: string;
    team: string;
    games: number;
    passAttempts: number;
    carries: number;
    targets: number | null;
    dropbacks: number;
    designedPlayVolume: number;
    passRate: number | null;
    rushRate: number | null;
    playsPerGame: number | null;
    targetsPerGame: number | null;
    passingEpa: number | null;
    rushingEpa: number | null;
    passRateRank: number | null;
    rushRateRank: number | null;
    neutralScriptPlays: number | null;
    neutralScriptPassRate: number | null;
    redZonePlays: number | null;
    redZonePassRate: number | null;
    redZoneRushRate: number | null;
    nonGarbagePlays: number | null;
    nonGarbagePassRate: number | null;
    estimatedSecondsPerPlay: number | null;
    paceRank: number | null;
    noHuddleRate: number | null;
    tendency: 'pass-heavy' | 'run-heavy' | 'balanced';
    note: string;
  } | null;
  rosterRoom?: {
    source: 'nflverse rosters/weekly rosters/depth charts/trades';
    season: string;
    previousSeason: string;
    team: string;
    position: string;
    currentCount: number;
    previousCount: number;
    netChange: number;
    additions: Array<{
      name: string;
      gsisId?: string | null;
      sleeperId?: string | null;
      draftRound?: number | null;
      draftOverall?: number | null;
      yearsExp?: number | null;
      priorSeasonTeam?: string | null;
      priorSeasonGames?: number | null;
      priorSeasonTargets?: number | null;
      priorSeasonCarries?: number | null;
      priorSeasonReceptions?: number | null;
      priorSeasonFantasyPointsPpr?: number | null;
      priorSeasonFantasyPointsPprPerGame?: number | null;
      priorSeasonAvgTargetShare?: number | null;
      priorSeasonAirYardsShare?: number | null;
      priorSeasonWopr?: number | null;
      movementQualityTier?: 'star' | 'starter' | 'rotation' | 'depth' | 'unknown';
      movementImpactScore?: number | null;
      prospectRating?: number | null;
      prospectOverallRank?: number | null;
      prospectPositionRank?: number | null;
      prospectDraftYear?: number | null;
      movementType?: 'draft-pick' | 'trade' | 'free-agent-or-claim' | 'injury-return' | 'practice-squad-or-depth-churn' | 'roster-loss';
      movementConfidence?: 'high' | 'medium' | 'low';
      firstSeenWeek?: number | null;
      lastSeenWeek?: number | null;
      firstStatus?: string | null;
      lastStatus?: string | null;
      activeWeeks?: number | null;
      practiceSquadWeeks?: number | null;
      injuredReserveWeeks?: number | null;
      tradeDate?: string | null;
      tradeFromTeam?: string | null;
      tradeToTeam?: string | null;
      movementNote?: string | null;
    }>;
    losses: Array<{
      name: string;
      gsisId?: string | null;
      sleeperId?: string | null;
      draftRound?: number | null;
      draftOverall?: number | null;
      yearsExp?: number | null;
      priorSeasonTeam?: string | null;
      priorSeasonGames?: number | null;
      priorSeasonTargets?: number | null;
      priorSeasonCarries?: number | null;
      priorSeasonReceptions?: number | null;
      priorSeasonFantasyPointsPpr?: number | null;
      priorSeasonFantasyPointsPprPerGame?: number | null;
      priorSeasonAvgTargetShare?: number | null;
      priorSeasonAirYardsShare?: number | null;
      priorSeasonWopr?: number | null;
      movementQualityTier?: 'star' | 'starter' | 'rotation' | 'depth' | 'unknown';
      movementImpactScore?: number | null;
      prospectRating?: number | null;
      prospectOverallRank?: number | null;
      prospectPositionRank?: number | null;
      prospectDraftYear?: number | null;
      movementType?: 'draft-pick' | 'trade' | 'free-agent-or-claim' | 'injury-return' | 'practice-squad-or-depth-churn' | 'roster-loss';
      movementConfidence?: 'high' | 'medium' | 'low';
      firstSeenWeek?: number | null;
      lastSeenWeek?: number | null;
      firstStatus?: string | null;
      lastStatus?: string | null;
      activeWeeks?: number | null;
      practiceSquadWeeks?: number | null;
      injuredReserveWeeks?: number | null;
      tradeDate?: string | null;
      tradeFromTeam?: string | null;
      tradeToTeam?: string | null;
      movementNote?: string | null;
    }>;
    rookieAdditions: Array<{
      name: string;
      gsisId?: string | null;
      sleeperId?: string | null;
      draftRound?: number | null;
      draftOverall?: number | null;
      yearsExp?: number | null;
      priorSeasonTeam?: string | null;
      priorSeasonGames?: number | null;
      priorSeasonTargets?: number | null;
      priorSeasonCarries?: number | null;
      priorSeasonReceptions?: number | null;
      priorSeasonFantasyPointsPpr?: number | null;
      priorSeasonFantasyPointsPprPerGame?: number | null;
      priorSeasonAvgTargetShare?: number | null;
      priorSeasonAirYardsShare?: number | null;
      priorSeasonWopr?: number | null;
      movementQualityTier?: 'star' | 'starter' | 'rotation' | 'depth' | 'unknown';
      movementImpactScore?: number | null;
      prospectRating?: number | null;
      prospectOverallRank?: number | null;
      prospectPositionRank?: number | null;
      prospectDraftYear?: number | null;
      movementType?: 'draft-pick' | 'trade' | 'free-agent-or-claim' | 'injury-return' | 'practice-squad-or-depth-churn' | 'roster-loss';
      movementConfidence?: 'high' | 'medium' | 'low';
      firstSeenWeek?: number | null;
      lastSeenWeek?: number | null;
      firstStatus?: string | null;
      lastStatus?: string | null;
      activeWeeks?: number | null;
      practiceSquadWeeks?: number | null;
      injuredReserveWeeks?: number | null;
      tradeDate?: string | null;
      tradeFromTeam?: string | null;
      tradeToTeam?: string | null;
      movementNote?: string | null;
    }>;
    premiumAdditions: Array<{
      name: string;
      gsisId?: string | null;
      sleeperId?: string | null;
      draftRound?: number | null;
      draftOverall?: number | null;
      yearsExp?: number | null;
      priorSeasonTeam?: string | null;
      priorSeasonGames?: number | null;
      priorSeasonTargets?: number | null;
      priorSeasonCarries?: number | null;
      priorSeasonReceptions?: number | null;
      priorSeasonFantasyPointsPpr?: number | null;
      priorSeasonFantasyPointsPprPerGame?: number | null;
      priorSeasonAvgTargetShare?: number | null;
      priorSeasonAirYardsShare?: number | null;
      priorSeasonWopr?: number | null;
      movementQualityTier?: 'star' | 'starter' | 'rotation' | 'depth' | 'unknown';
      movementImpactScore?: number | null;
      prospectRating?: number | null;
      prospectOverallRank?: number | null;
      prospectPositionRank?: number | null;
      prospectDraftYear?: number | null;
      movementType?: 'draft-pick' | 'trade' | 'free-agent-or-claim' | 'injury-return' | 'practice-squad-or-depth-churn' | 'roster-loss';
      movementConfidence?: 'high' | 'medium' | 'low';
      firstSeenWeek?: number | null;
      lastSeenWeek?: number | null;
      firstStatus?: string | null;
      lastStatus?: string | null;
      activeWeeks?: number | null;
      practiceSquadWeeks?: number | null;
      injuredReserveWeeks?: number | null;
      tradeDate?: string | null;
      tradeFromTeam?: string | null;
      tradeToTeam?: string | null;
      movementNote?: string | null;
    }>;
    depthChartTop: Array<{
      name: string;
      gsisId?: string | null;
      rank?: number | null;
      slot?: string | null;
    }>;
    movementTypes?: Array<'draft-pick' | 'trade' | 'free-agent-or-claim' | 'injury-return' | 'practice-squad-or-depth-churn' | 'roster-loss'>;
    weeklyCoverage?: {
      currentSeasonPlayers: number;
      previousSeasonPlayers: number;
    };
    opportunityDelta?: {
      vacatedTargets: number;
      vacatedCarries: number;
      vacatedReceptions: number;
      vacatedFantasyPointsPpr: number;
      addedPriorTargets: number;
      addedPriorCarries: number;
      addedPriorReceptions: number;
      addedPriorFantasyPointsPpr: number;
      vacatedImpactScore: number;
      addedThreatScore: number;
      netOpportunityScore: number;
      qualitySignal: 'major-opening' | 'minor-opening' | 'stable' | 'squeeze' | 'major-squeeze';
      incumbentPromotionScore?: number | null;
      incumbentOpportunitySignal?: 'major-promotion' | 'minor-promotion' | 'stable' | 'blocked';
      topVacatedPlayer?: string | null;
      topAddedThreat?: string | null;
      topReturningDepthPlayer?: string | null;
      returningPromotionCandidates?: Array<{
        name: string;
        rank?: number | null;
        score: number;
        signal: 'major-promotion' | 'minor-promotion' | 'stable' | 'blocked';
      }>;
      note: string;
    };
    competitionLevel: 'thin' | 'normal' | 'crowded';
    vacatedOpportunitySignal: 'opening' | 'stable' | 'squeeze';
    note: string;
  } | null;
  injuryHistory?: {
    season: string;
    reportCount: number;
    missedOrLimitedCount: number;
    injuryTypes: string[];
    latestStatus?: string | null;
    note: string;
  } | null;
  athleticProfile?: {
    source: 'nflverse combine';
    draftYear: number | null;
    height?: string | null;
    weight?: number | null;
    forty?: number | null;
    bench?: number | null;
    vertical?: number | null;
    broadJump?: number | null;
    cone?: number | null;
    shuttle?: number | null;
    speedScore?: number | null;
    note: string;
  } | null;
  contractProfile?: {
    source: 'nflverse contracts';
    team?: string | null;
    yearSigned?: number | null;
    years?: number | null;
    value?: number | null;
    apy?: number | null;
    guaranteed?: number | null;
    draftRound?: number | null;
    draftOverall?: number | null;
    investmentTier: 'premium' | 'solid' | 'fringe' | 'unknown';
    note: string;
  } | null;
  avgGamesMissed?: number | null;
  availabilitySeasons?: number | null;
  similarTradeValues?: Array<{
    playerId: string;
    name: string;
    position: string;
    team?: string | null;
    rank?: string | null;
    value: number;
    difference: number;
    label?: string;
  }>;
  prospectProfile?: ProspectProfile | null;
  playerCohort?: PlayerCohortProfile | null;
  playerSituationDelta?: PlayerSituationDeltaProfile | null;
  externalIds?: Record<string, string | number | null | undefined>;
}

export interface TrendingPlayer {
  player_id: string;
  name: string;
  playerDetails?: PlayerDetails;
  currentPositionRank?: string | null;
  pos: string;
  team: string | null;
  owner?: string | null;
  count: number;
  ktcValue: number | null;
  weeklyEcr?: WaiverWeeklyEcrSignal | null;
}

export interface RecentTransactionPlayer {
  player_id: string;
  name: string;
  playerDetails?: PlayerDetails;
  currentPositionRank?: string | null;
  pos: string;
  team: string | null;
  ktcValue: number | null;
}

export interface RecentTransaction {
  id: string;
  date: string;
  season?: string | null;
  manager: string;
  type: 'Waiver' | 'Free Agent';
  bidAmount: number | null;
  addedPlayer: RecentTransactionPlayer | null;
  droppedPlayer: RecentTransactionPlayer | null;
  alternativeDrop: RecentTransactionPlayer | null;
  note: string;
  losingBidsAvailable: boolean;
}

export interface ManagerDraftStats {
  manager: string;
  managerDisplayName?: string;
  totalPicks: number;
  avgAdpDiff: number;
  avgKtcGain: number;
  bestPick: DraftPick | null;
  worstPick: DraftPick | null;
  hits: number;
  misses: number;
  starters: number;
}

export type LeagueValueMode = 'dynasty' | 'redraft' | 'keeper';

export interface LeagueAiConfidenceSignal {
  key: string;
  label: string;
  score: number;
  previousScore?: number | null;
  scoreDelta?: number | null;
  weight: number;
  status: 'low' | 'building' | 'strong';
  note: string;
}

export interface ManagerAiConfidence {
  manager: string;
  score: number;
  label: string;
  note: string;
  previousScore?: number | null;
  scoreDelta?: number | null;
  signals: LeagueAiConfidenceSignal[];
}

export interface LeagueAiConfidenceTrendPoint {
  snapshotKey: string;
  generatedAt?: string | null;
  score: number;
  label: string;
}

export interface LeagueAiConfidenceCalibration {
  phase: 'offseason' | 'preseason' | 'early_season' | 'in_season' | 'playoffs';
  status: 'pending' | 'collecting' | 'ready';
  observedSampleSize: number;
  targetSampleSize: number;
  seasonStartDate: string;
  nextReviewDate: string;
  note: string;
}

export interface LeagueAiConfidence {
  score: number;
  label: string;
  note: string;
  previousScore?: number | null;
  scoreDelta?: number | null;
  history?: LeagueAiConfidenceTrendPoint[];
  calibration?: LeagueAiConfidenceCalibration;
  signals: LeagueAiConfidenceSignal[];
  managerConfidence?: ManagerAiConfidence[];
}

export type ReportAICalibrationAdjustmentScope =
  | 'global'
  | 'surface'
  | 'action'
  | 'label'
  | 'sourceAgreement'
  | 'leagueFormat'
  | 'counterfactual'
  | 'realizedEdge'
  | 'surfaceAction'
  | 'surfaceActionLabel'
  | 'surfaceActionSourceAgreement'
  | 'surfaceActionLeagueFormat'
  | 'surfaceActionCounterfactual'
  | 'surfaceActionRealizedEdge'
  | 'surfaceManager';

export interface ReportAICalibrationAdjustment {
  key: string;
  scope: ReportAICalibrationAdjustmentScope;
  group: Record<string, string>;
  eventCount: number;
  scoredCount: number;
  pendingCount: number;
  hitRate: number | null;
  avgConfidence: number | null;
  calibrationGap: number | null;
  brierScore: number | null;
  scoreAdjustment: number;
  confidenceCap: number | null;
  recommendation: 'collect-more-samples' | 'lower-confidence' | 'raise-confidence' | 'review-model' | 'calibrated';
  priority: 'danger' | 'warn' | 'info' | 'good';
  reason: string;
}

export interface ReportAICalibrationAdjustmentProfile {
  schemaVersion: 1;
  generatedFrom: 'ai-prediction-events';
  generatedAt: string;
  eventCount: number;
  scoredCount: number;
  pendingCount: number;
  globalAdjustment: ReportAICalibrationAdjustment;
  adjustments: ReportAICalibrationAdjustment[];
}

export interface ServerReportDeltaChange {
  id: string;
  label: string;
  summary: string;
  detail?: string | null;
  tone: 'good' | 'info' | 'warn' | 'danger' | 'neutral';
  priority: number;
  receipts: string[];
}

export interface ServerReportDeltaRead {
  schemaVersion: 1;
  source: 'server-cache' | 'none';
  generatedAt: string;
  baselineGeneratedAt?: string | null;
  summary: string;
  changes: ServerReportDeltaChange[];
}

export interface LeagueDiagnostics {
  teamCount: number;
  valueMode: LeagueValueMode;
  qbFormat?: 'one_qb' | 'superflex' | 'two_qb' | 'unknown';
  currentSeason?: string;
  currentWeek?: number | null;
  playoffWeekStart?: number | null;
  playoffWeeks?: number[];
  championshipWeek?: number | null;
  hasCurrentSeasonMainDraft?: boolean;
  currentSeasonMainDraftPickCount?: number;
  currentSeasonMainDraftPickedPlayerCount?: number;
  currentSeasonMainDraftStatus?: 'not_started' | 'in_progress' | 'complete' | 'unknown';
  redraftTradeWindowEndDate?: string | null;
  rosterSlots: string[];
  starterSlots: string[];
  totalRosterSlots?: number;
  reserveSlots?: number;
  taxiSlots?: number;
  lineupSlotSummary: string;
  starterCountSummary: string;
  starterCalculation: string;
  benchCalculation: string;
  tradeableDepthCalculation: string;
  scoringSummary: string;
  receptionScoring: number;
  tightEndPremium: number;
  passingTdPoints?: number | null;
  ktcProfileLabel: string;
  valueSnapshotProfileCount: number;
  valueSnapshotProfiles: string[];
  valueLimitations: string[];
  aiConfidence?: LeagueAiConfidence;
}

export interface DepthChartDiagnostics {
  checkedPlayerCount: number;
  matchedPlayerCount: number;
  mismatchCount: number;
  requestedTeams: string[];
  loadedTeams: string[];
  failedTeams: string[];
  staleTeamCount?: number;
  retryCount?: number;
  cacheMode?: 'live' | 'snapshot';
  snapshotKey?: string | null;
  lastWarmAt?: string | null;
  snapshotUpdatedAt?: string | null;
  durationMs: number;
  generatedAt: string;
}

export interface TransactionBackfillDiagnostics {
  checkedLeagueCount: number;
  seasonCount: number;
  transactionCount: number;
  waiverOrFreeAgentCount: number;
  tradeProposalCount: number;
  completedTradeCount: number;
  scannedLeagueIds?: string[];
  failedLeagueCount?: number;
  failedLeagueIds?: string[];
  brokenPreviousLeagueChainCount?: number;
  leagues: Array<{
    leagueId: string;
    season: string;
    transactionCount: number;
    previousLeagueId?: string | null;
    status?: 'loaded' | 'failed' | 'invalid';
    error?: string | null;
  }>;
  generatedAt: string;
}

export interface MonthlyBlueprintHistorySnapshot {
  leagueId?: string;
  leagueName?: string;
  leagueFormat?: string;
  snapshotMonth: string;
  manager: string;
  capturedAt?: string | null;
  rosterIdentity?: string | null;
  timeline?: string | null;
  strategySummary?: string | null;
  starterValue?: number | null;
  starterSeasonValue?: number | null;
  benchValue?: number | null;
  starterValuePct?: number | null;
  avgAge?: number | null;
  avgAgeByPosition?: Record<'QB' | 'RB' | 'WR' | 'TE', number | null>;
  positionGrades?: Record<'QB' | 'RB' | 'WR' | 'TE', {
    rank: number | null;
    grade: string;
    note: string;
  }> | null;
  pressurePoints?: string[];
  ageFlags?: string[];
  leagueOverview?: {
    rank_value?: number | null;
    total_value?: number | null;
    [key: string]: unknown;
  } | null;
  powerRanking?: {
    rank?: number | null;
    score?: number | null;
    tier?: string | null;
    rosterValue?: number | null;
    starterStrength?: number | null;
    [key: string]: unknown;
  } | null;
  pickPortfolio?: {
    totalValue?: number | null;
    value2026?: number | null;
    value2027?: number | null;
    count2026?: number | null;
    count2027?: number | null;
    [key: string]: unknown;
  } | null;
  tradeTendency?: {
    tradeCount?: number | null;
    winPct?: number | null;
    profit?: number | null;
    [key: string]: unknown;
  } | null;
}

export interface ReportData {
  leagueValueMode?: LeagueValueMode;
  leagueDiagnostics?: LeagueDiagnostics;
  monthlyBlueprintSnapshot?: {
    month: string;
    status: 'stored' | 'local' | 'unavailable';
    managerCount: number;
    source: 'database' | 'file' | 'none';
    warning?: string | null;
  };
  monthlyBlueprintHistory?: MonthlyBlueprintHistorySnapshot[];
  aiCalibrationAdjustmentProfile?: ReportAICalibrationAdjustmentProfile | null;
  serverReportDelta?: ServerReportDeltaRead | null;
  sourceSnapshotDiagnostics?: SourceSnapshotFreshnessDiagnostic[];
  depthChartDiagnostics?: DepthChartDiagnostics;
  transactionBackfillDiagnostics?: TransactionBackfillDiagnostics;
  prospectSourceDiagnostics?: ProspectSourceDiagnostics;
  viewerManager?: string | null;
  viewerManagerByUserId?: Record<string, string>;
  currentStandings?: Array<{
    rosterId?: number;
    manager: string;
    rank: number;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
  }>;
  standingsHistory?: Array<{
    season: string;
    rosterId?: number;
    manager: string;
    rank: number;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
  }>;
  managerAvatars?: Record<string, string | null>;
  managerChampionships?: Record<string, ManagerChampionship>;
  playerDetailsById?: Record<string, PlayerDetails>;
  currentPositionRankById?: Record<string, string | null>;
  managerRosterValueGrowth: Array<{
    manager: string;
    past_val: number;
    total_val: number;
    growth: number;
    rank: number;
  }>;
  weeklyRisers: WeeklyMomentum[];
  weeklyFallers: WeeklyMomentum[];
  rankings?: RankingsBoard;
  trendingAdds?: TrendingPlayer[];
  trendingDrops?: TrendingPlayer[];
  leagueOverview: Array<{
    manager: string;
    total_val: number;
    rank_qb: number;
    rank_rb: number;
    rank_wr: number;
    rank_te: number;
    rank_value: number;
    rank_2027: number;
  }>;
  projectedRisers: PlayerInfo[];
  projectedFallers: PlayerInfo[];
  tradeProfitLeaderboard: Array<{
    rank: number;
    manager: string;
    profit: number;
    wins: number;
    trade_count: number;
  }>;
  tradeHistory: TradeData[];
  tradeHistoryValueAudit?: {
    source: 'historical-value-index';
    profileKey: string;
    playerAssetCount: number;
    historicalPlayerAssetCount: number;
    fallbackPlayerAssetCount: number;
    maxDaysAway: number;
    coveragePct: number | null;
    note: string;
  };
  tradeProposalSignals?: TradeProposalSignal[];
  adminTradeProposalSignals?: TradeProposalSignal[];
  adminSleeperTradeProposalSignals?: TradeProposalSignal[];
  adminSleeperWaiverSignals?: SleeperWaiverClaimSignal[];
  sleeperHiddenLeagueSnapshot?: SleeperHiddenLeagueSnapshot | null;
  positionDepth: PositionDepth[];
  managerPositionCounts: Array<{
    manager: string;
    activePlayerCount?: number;
    reservePlayerCount?: number;
    taxiPlayerCount?: number;
    totalRosterPlayerCount?: number;
    QB: number;
    QB_starters: number;
    RB: number;
    RB_starters: number;
    WR: number;
    WR_starters: number;
    TE: number;
    TE_starters: number;
    K?: number;
    K_starters?: number;
    DEF?: number;
    DEF_starters?: number;
    starterSource?: 'Sleeper' | 'Projected';
    starterPlayers?: ManagerStarterPlayer[];
    lineupPlayers?: ManagerStarterPlayer[];
    rosterPlayers?: ManagerStarterPlayer[];
    starterGroups?: ManagerStarterGroup[];
  }>;
  managerRosterIntelligence?: ManagerRosterIntelligence[];
  tradeTendencies?: TradeTendency[];
  powerRankings?: PowerRanking[];
  dynastyTimelines?: DynastyTimeline[];
  pickPortfolios?: PickPortfolio[];
  waiverIntelligence?: WaiverIntelligence;
  scheduleEdgeTargets?: WaiverWeeklyEcrTarget[];
  matchupPreviews?: MatchupPreview[];
  schedulePlanning?: SchedulePlanningSummary;
  recentTransactions?: RecentTransaction[];
  draftPicks?: DraftPick[];
  draftStats?: ManagerDraftStats[];
}

export interface SleeperDraftPick {
  draft_id?: string;
  draft_slot: number;
  is_keeper: boolean | null;
  metadata: {
    first_name: string;
    injury_status: string;
    last_name: string;
    news_updated: string;
    number: string;
    player_id: string;
    position: string;
    sport: string;
    status: string;
    team: string;
    team_abbr: string;
    team_changed_at: string;
    years_exp: string;
  };
  pick_no: number;
  picked_by: string;
  player_id: string;
  reactions: any;
  roster_id: number;
  round: number;
  roster_map?: Record<string, string>;
}

export type ActionPlanKind = 'lineup' | 'waiver' | 'trade';
export type ActionPlanStatus = 'saved' | 'submitted' | 'copied' | 'opened' | 'tracked' | 'won' | 'lost' | 'acted' | 'blocked' | 'stale';

export interface ActionPlanRecord {
  id: string;
  kind: ActionPlanKind;
  leagueId?: string;
  manager?: string | null;
  playerId?: string;
  replacementPlayerId?: string;
  createdAt: number;
  updatedAt?: number;
  title: string;
  summary: string;
  status: ActionPlanStatus;
  payload: Record<string, unknown>;
}

export interface WaiverBidHistoryRecord {
  id: string;
  leagueId?: string;
  manager?: string | null;
  playerId: string;
  playerName: string;
  position: string;
  bidMin: number;
  bidMax: number;
  bidLabel: string;
  source: 'league-history' | 'model' | 'submitted-plan';
  createdAt: number;
  updatedAt?: number;
}
