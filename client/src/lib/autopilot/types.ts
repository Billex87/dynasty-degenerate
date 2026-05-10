export type AutopilotMode = 'dynasty' | 'redraft';
export type AutopilotTone = 'good' | 'info' | 'warn' | 'danger' | 'neutral';
export type ValueDirection = 'Rising' | 'Falling' | 'Stable';

export type AutopilotScore = {
  label: string;
  value: number;
  tone: AutopilotTone;
};

export type AutopilotRecommendation = {
  id: string;
  type: string;
  player: string;
  secondary?: string;
  action: string;
  confidence: number;
  risk: 'Low' | 'Medium' | 'High';
  upside: 'Low' | 'Medium' | 'High' | 'Elite';
  summary: string;
  reasons: string[];
  signals: string[];
  tone: AutopilotTone;
};

export type PlayerProjection = {
  player: string;
  position: string;
  direction: ValueDirection;
  currentValue: string;
  projectedMove: string;
  confidence: number;
  signals: string[];
};

export type LeaguePowerRow = {
  rank: number;
  team: string;
  direction: string;
  score: number;
  note: string;
  tone: AutopilotTone;
};

export type ManagerTendencyProfile = {
  manager: string;
  label: string;
  summary: string;
  historyDepthScore: number;
  tradeActivityScore: number;
  waiverActivityScore: number;
  competitiveConsistencyScore: number;
  riskToleranceScore: number;
  signals: string[];
};

export type WeeklyStartOption = {
  player: string;
  position: string;
  confidence: number;
  note: string;
  tone: AutopilotTone;
};

export type WeeklyActionPlan = {
  starterToReview: {
    player: string;
    position: string;
    confidence: number;
    note: string;
    tone: AutopilotTone;
  } | null;
  options: WeeklyStartOption[];
  summary: string;
};

export type AutopilotData = {
  mode: AutopilotMode;
  focusManager?: string;
  dataStatus?: string;
  headline: string;
  direction: {
    label: string;
    confidence: number;
    summary: string;
    strategy: string;
    scores: AutopilotScore[];
    actionPlan: string[];
  };
  systemRead: AutopilotScore[];
  lineup: AutopilotRecommendation[];
  weeklyPlan?: WeeklyActionPlan;
  waivers: AutopilotRecommendation[];
  trades: AutopilotRecommendation[];
  projections: PlayerProjection[];
  power: LeaguePowerRow[];
  managerTendency?: ManagerTendencyProfile;
  scheduleTodo: string[];
};
