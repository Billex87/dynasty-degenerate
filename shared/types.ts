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
  bestAvailableByPosition: Record<'QB' | 'RB' | 'WR' | 'TE', TrendingPlayer | null>;
  bestTaxiStashes: TrendingPlayer[];
  recentlyDroppedValuable: TrendingPlayer[];
}

export interface DraftPick {
  round: number;
  pick: number;
  draftSlot?: number;
  playerName: string;
  playerPos: string;
  manager: string;
  managerDisplayName?: string;
  originalOwner?: string | null;
  originalRosterId?: number | null;
  adp: number | null;
  ktcValue: number | null;
  currentKtcValue: number | null;
  valueGain: number | null;
  positionRankMay2025?: string | null;
  currentPositionRank?: string | null;
  positionRankChange?: string | null;
  draftYear?: string;
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
  yearsExp?: number | null;
  status?: string | null;
  sleeperNewsUpdated?: number | string | null;
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
    fantasyCalcDynasty?: number | null;
    fantasyCalcRedraft?: number | null;
    dynastyProcess?: number | null;
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

export interface ReportData {
  leagueValueMode?: LeagueValueMode;
  viewerManager?: string | null;
  currentStandings?: Array<{
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
  positionDepth: PositionDepth[];
  managerPositionCounts: Array<{
    manager: string;
    QB: number;
    QB_starters: number;
    RB: number;
    RB_starters: number;
    WR: number;
    WR_starters: number;
    TE: number;
    TE_starters: number;
    starterPlayers?: ManagerStarterPlayer[];
    lineupPlayers?: ManagerStarterPlayer[];
  }>;
  managerRosterIntelligence?: ManagerRosterIntelligence[];
  tradeTendencies?: TradeTendency[];
  powerRankings?: PowerRanking[];
  dynastyTimelines?: DynastyTimeline[];
  pickPortfolios?: PickPortfolio[];
  waiverIntelligence?: WaiverIntelligence;
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
