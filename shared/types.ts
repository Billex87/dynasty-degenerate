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
  identityDiagnostics?: RankingIdentityDiagnostic[];
  dynastySourceDiagnostics?: RankingSourceDiagnostic[];
  redraftSourceDiagnostics?: RankingSourceDiagnostic[];
  devySourceDiagnostics?: RankingSourceDiagnostic[];
  draftBuzzScoreboard?: DraftBuzzScoreboardEntry[];
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
  note: string;
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
}

export interface WaiverIntelligence {
  rosteredTrendingAdds: TrendingPlayer[];
  availableTrendingAdds: TrendingPlayer[];
  highestKtcAvailable: TrendingPlayer | null;
  bestAvailableByPosition: Record<'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF', TrendingPlayer | null>;
  bestTaxiStashes: TrendingPlayer[];
  recentlyDroppedValuable: TrendingPlayer[];
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
    sources?: string[];
  };
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
  }>;
  latestNews?: {
    title: string;
    summary?: string | null;
    source?: string | null;
    url?: string | null;
    publishedAt?: string | null;
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

export interface LeagueDiagnostics {
  teamCount: number;
  valueMode: LeagueValueMode;
  redraftTradeWindowEndDate?: string | null;
  rosterSlots: string[];
  starterSlots: string[];
  lineupSlotSummary: string;
  starterCountSummary: string;
  starterCalculation: string;
  benchCalculation: string;
  tradeableDepthCalculation: string;
  scoringSummary: string;
  receptionScoring: number;
  tightEndPremium: number;
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
  leagues: Array<{
    leagueId: string;
    season: string;
    transactionCount: number;
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
  tradeProposalSignals?: TradeProposalSignal[];
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
export type ActionPlanStatus = 'saved' | 'submitted' | 'copied' | 'opened' | 'tracked' | 'won' | 'lost' | 'acted' | 'blocked';

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
