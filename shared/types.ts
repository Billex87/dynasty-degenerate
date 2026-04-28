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
  value: number;
  currentPositionRank?: string | null;
  playerDetails?: PlayerDetails;
}

export interface DraftPick {
  round: number;
  pick: number;
  draftSlot?: number;
  playerName: string;
  playerPos: string;
  manager: string;
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
  depthChartPosition?: string | null;
  depthChartOrder?: number | null;
  yearsExp?: number | null;
  status?: string | null;
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

export interface ManagerDraftStats {
  manager: string;
  totalPicks: number;
  avgAdpDiff: number;
  avgKtcGain: number;
  bestPick: DraftPick | null;
  worstPick: DraftPick | null;
  hits: number;
  misses: number;
  starters: number;
}

export interface ReportData {
  managerAvatars?: Record<string, string | null>;
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
  }>;
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
