import type { AIEvidenceResult } from '@shared/aiEvidenceEngine';

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
  evidenceRead?: AIEvidenceResult;
  calibration?: {
    baseConfidence: number;
    adjustedConfidence: number;
    confidenceCap: number;
    reason: string;
    priority: 'danger' | 'warn' | 'info' | 'good';
  };
  tone: AutopilotTone;
};

export type AIActionQueueDecision = 'do' | 'watch' | 'hold' | 'blocked';

export type AIActionQueueSource = 'lineup' | 'waiver' | 'trade' | 'strategy';

export type AIActionQueueItem = {
  id: string;
  source: AIActionQueueSource;
  decision: AIActionQueueDecision;
  rank: number;
  label: string;
  action: string;
  target: string;
  detail: string;
  why: string;
  risk: string;
  confidence: number;
  tone: AutopilotTone;
  blockers: string[];
  missingEvidence: string[];
  sourceHealth: string[];
  receipts: string[];
  changeTriggers: string[];
  dominoEffects?: string[];
  signals: string[];
};

export type AIRejectionRead = {
  id: string;
  source: AIActionQueueSource | 'market';
  action: string;
  target: string;
  reason: string;
  alternative: string;
  confidence: number;
  tone: AutopilotTone;
  receipts: string[];
};

export type AIMarketAnomalyRead = {
  id: string;
  player: string;
  position: string;
  label: string;
  summary: string;
  suggestedAction: string;
  confidence: number;
  tone: AutopilotTone;
  receipts: string[];
};

export type AIReportCardRead = {
  grade: string;
  summary: string;
  confidence: number;
  tone: AutopilotTone;
  rows: Array<{
    label: string;
    status: string;
    detail: string;
    tone: AutopilotTone;
  }>;
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

export type WeeklyRecapRead = {
  headline: string;
  summary: string;
  startSitCalls: Array<{
    sit: string;
    start: string;
    confidence: number;
    note: string;
    tone: AutopilotTone;
  }>;
  waiverNotes: string[];
  tradeNotes: string[];
};

export type FuturePickTrajectory = {
  manager: string;
  currentRank: number | null;
  currentValue: number;
  likelyRookieRange: string;
  note: string;
  picks: Array<{
    label: string;
    projectedBand: string;
    rookieTier: string;
    value: number;
  }>;
  points: Array<{
    label: string;
    value: number;
  }>;
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
  actionQueue: AIActionQueueItem[];
  lineup: AutopilotRecommendation[];
  weeklyPlan?: WeeklyActionPlan;
  weeklyRecap?: WeeklyRecapRead;
  reportCard?: AIReportCardRead;
  rejections: AIRejectionRead[];
  marketAnomalies: AIMarketAnomalyRead[];
  waivers: AutopilotRecommendation[];
  trades: AutopilotRecommendation[];
  projections: PlayerProjection[];
  futurePickTrajectory?: FuturePickTrajectory;
  power: LeaguePowerRow[];
  managerTendency?: ManagerTendencyProfile;
  scheduleTodo: string[];
};
