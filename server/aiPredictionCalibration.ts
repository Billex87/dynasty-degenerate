import { createHash } from 'node:crypto';
import type {
  AIEvidenceAction,
  AIEvidencePenalty,
  AIEvidenceResult,
  AIEvidenceSurface,
  AIConfidenceLabel,
  AISourceTrace,
} from '../shared/aiEvidenceEngine';
import type {
  AICounterfactualRead,
  AICounterfactualStatus,
  AIDecisionSnapshot,
  AIRealizedEdge,
  AIPredictionDecayProfile,
} from '../shared/aiDecisionSnapshots';
import type { RecommendationObservedOutcome } from '../shared/recommendationOutcome';

export type AIPredictionDecision = 'do' | 'dont' | 'watch' | 'hold' | 'blocked';
export type AIPredictionOutcomeStatus = 'hit' | 'miss' | 'push' | 'pending' | 'blocked';
export type AISourceAgreementState = 'aligned' | 'split' | 'conflicted' | 'thin' | 'missing' | 'unknown';
export type AISourceSignalDirection = 'for' | 'against' | 'neutral' | 'missing';

export type AISourceAgreementSignal = {
  source: string;
  direction: AISourceSignalDirection;
  confidence?: number | null;
  status?: AISourceTrace['status'] | null;
  detail?: string | null;
};

export type AISourceAgreementRead = {
  state: AISourceAgreementState;
  directionalSourceCount: number;
  sourceCount: number;
  forWeight: number;
  againstWeight: number;
  neutralWeight: number;
  missingCount: number;
  confidenceCap: number | null;
  reason: string;
  signals: AISourceAgreementSignal[];
};

export type AIPredictionOutcome = {
  status: AIPredictionOutcomeStatus;
  resolvedAt?: string | null;
  actualValue?: number | null;
  baselineValue?: number | null;
  realizedEdge?: AIRealizedEdge | null;
  feedbackSource?: 'system' | 'user' | 'admin' | null;
  note?: string | null;
  observedOutcome?: RecommendationObservedOutcome | null;
};

export type AIPredictionEvent = {
  schemaVersion: 1;
  eventId: string;
  predictionKey: string;
  createdAt: string;
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  decision: AIPredictionDecision;
  entityType: 'player' | 'team' | 'manager' | 'league' | 'trade' | 'lineup' | 'schedule' | 'unknown';
  entityId?: string | null;
  entityName?: string | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | null;
  week?: number | null;
  label: AIConfidenceLabel;
  finalScore: number;
  confidenceCap: number;
  confidenceCapReason?: string | null;
  evidence: string[];
  missingEvidence: string[];
  hardBlockers: string[];
  softPenalties: AIEvidencePenalty[];
  sourceTrace: AISourceTrace[];
  sourceAgreement?: AISourceAgreementRead | null;
  decisionSnapshot?: AIDecisionSnapshot | null;
  counterfactual?: AICounterfactualRead | null;
  decay?: AIPredictionDecayProfile | null;
  expiresAt?: string | null;
  whyThisFired: string;
  outcome: AIPredictionOutcome;
  metadata?: Record<string, unknown>;
};

export type CreateAIPredictionEventInput = {
  evidenceRead: AIEvidenceResult;
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  entityType?: AIPredictionEvent['entityType'];
  entityId?: string | number | null;
  entityName?: string | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | number | null;
  week?: string | number | null;
  decision?: AIPredictionDecision | null;
  createdAt?: string | Date | null;
  eventId?: string | null;
  predictionKey?: string | null;
  sourceAgreement?: AISourceAgreementRead | null;
  decisionSnapshot?: AIDecisionSnapshot | null;
  counterfactual?: AICounterfactualRead | null;
  decay?: AIPredictionDecayProfile | null;
  metadata?: Record<string, unknown>;
};

export type AIPredictionReliabilityGroupBy =
  | 'surface'
  | 'action'
  | 'label'
  | 'decision'
  | 'sourceAgreement'
  | 'leagueSharpness'
  | 'league'
  | 'manager'
  | 'managerArchetype'
  | 'leagueFormat'
  | 'counterfactual'
  | 'realizedEdge';

export type AIPredictionReliabilityBucket = {
  key: string;
  group: Record<string, string>;
  eventCount: number;
  scoredCount: number;
  hitCount: number;
  missCount: number;
  pushCount: number;
  pendingCount: number;
  blockedCount: number;
  avgConfidence: number | null;
  hitRate: number | null;
  brierScore: number | null;
  calibrationGap: number | null;
  recommendedScoreAdjustment: number;
  recommendation: 'collect-more-samples' | 'lower-confidence' | 'raise-confidence' | 'review-model' | 'calibrated';
};

export type AIPredictionReliabilitySummary = {
  schemaVersion: 1;
  generatedFrom: 'ai-prediction-events';
  generatedAt: string;
  eventCount: number;
  scoredCount: number;
  pendingCount: number;
  buckets: AIPredictionReliabilityBucket[];
};

export type AICounterfactualReliabilityBucket = {
  status: AICounterfactualStatus | 'all';
  eventCount: number;
  scoredCount: number;
  hitCount: number;
  missCount: number;
  avgEdge: number | null;
  avgConfidence: number | null;
  hitRate: number | null;
};

export type AICounterfactualReliabilitySummary = {
  schemaVersion: 1;
  generatedFrom: 'ai-prediction-events';
  generatedAt: string;
  eventCount: number;
  baselineCount: number;
  missingBaselineCount: number;
  doWithoutBaselineEdgeCount: number;
  avgEdge: number | null;
  buckets: AICounterfactualReliabilityBucket[];
};

export type AIManagerTradeCalibrationRow = {
  manager: string;
  eventCount: number;
  scoredCount: number;
  completedCount: number;
  missCount: number;
  pendingCount: number;
  avgPredictedEdge: number | null;
  avgRealizedEdge: number | null;
  acceptanceRate: number | null;
  recommendation: 'attack' | 'test-carefully' | 'avoid-unless-overpay' | 'collect-more-samples';
  note: string;
};

export type AIManagerTradeCalibrationSummary = {
  schemaVersion: 1;
  generatedFrom: 'ai-prediction-events';
  generatedAt: string;
  eventCount: number;
  rows: AIManagerTradeCalibrationRow[];
};

export type AIModuleQualityKey =
  | 'waiver-bid-range'
  | 'waiver-competition'
  | 'trade-resistance'
  | 'depth-chart-role-confidence';

export type AIModuleQualityRow = {
  key: AIModuleQualityKey;
  label: string;
  description: string;
  eventCount: number;
  scoredCount: number;
  pendingCount: number;
  hitRate: number | null;
  avgConfidence: number | null;
  calibrationGap: number | null;
  brierScore: number | null;
  recommendation: AIPredictionReliabilityBucket['recommendation'];
  sampleStatus: 'needs-samples' | 'collecting' | 'usable' | 'ready';
  confidenceAction: 'hold-cap' | 'lower' | 'raise' | 'keep';
  nextDataNeeded: string;
};

export type AIModuleQualitySummary = {
  schemaVersion: 1;
  generatedFrom: 'ai-prediction-events';
  generatedAt: string;
  eventCount: number;
  rows: AIModuleQualityRow[];
};

export type AICalibrationAdjustmentScope =
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
  | 'surfaceManager'
  | 'surfaceLeague'
  | 'surfaceActionLeague'
  | 'leagueSharpness'
  | 'surfaceActionLeagueSharpness'
  | 'managerArchetype'
  | 'surfaceActionManagerArchetype';

export type AICalibrationAdjustment = {
  key: string;
  scope: AICalibrationAdjustmentScope;
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
  recommendation: AIPredictionReliabilityBucket['recommendation'];
  priority: 'danger' | 'warn' | 'info' | 'good';
  reason: string;
};

export type AICalibrationAdjustmentProfile = {
  schemaVersion: 1;
  generatedFrom: 'ai-prediction-events';
  generatedAt: string;
  eventCount: number;
  scoredCount: number;
  pendingCount: number;
  globalAdjustment: AICalibrationAdjustment;
  adjustments: AICalibrationAdjustment[];
};

export type AIOutcomeLedgerRow = {
  eventId: string;
  predictionKey: string;
  createdAt: string;
  updatedAt?: string | null;
  leagueId?: string | null;
  manager?: string | null;
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  module: string;
  decision: AIPredictionDecision;
  entityType: AIPredictionEvent['entityType'];
  entityName?: string | null;
  label: AIConfidenceLabel;
  finalScore: number;
  confidenceCap: number;
  outcomeStatus: AIPredictionOutcomeStatus;
  feedbackSource?: AIPredictionOutcome['feedbackSource'];
  observedOutcomeStatus?: RecommendationObservedOutcome['status'] | null;
  observedOutcomeConfidence?: number | null;
  observedOutcomeDetectedFrom?: RecommendationObservedOutcome['evidence']['detectedFrom'] | null;
  observedOutcomeReason?: string | null;
  sourceAgreement: AISourceAgreementState;
  counterfactualStatus: AICounterfactualStatus | 'missing-baseline';
  baselineLabel?: string | null;
  baselineScore: number | null;
  realizedEdgeStatus?: string | null;
  realizedEdge: number | null;
  sharpnessLabel?: string | null;
  sharpnessScore: number | null;
  sharpnessTier?: string | null;
  verdict: 'pending' | 'worked' | 'missed' | 'ignored' | 'blocked';
  evidencePreview: string[];
  missingEvidence: string[];
  blockers: string[];
  why: string;
};

export type AIOutcomeMemorySummary = {
  schemaVersion: 1;
  generatedFrom: 'ai-prediction-events';
  generatedAt: string;
  eventCount: number;
  scoredCount: number;
  pendingCount: number;
  ledger: AIOutcomeLedgerRow[];
  confidenceBuckets: AIPredictionReliabilityBucket[];
  moduleScorecards: AIPredictionReliabilityBucket[];
  sharpnessBuckets: AIPredictionReliabilityBucket[];
  automaticAdjustments: AICalibrationAdjustment[];
};

export type ApplyAICalibrationAdjustmentInput = {
  profile: AICalibrationAdjustmentProfile;
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  label: AIConfidenceLabel;
  sourceAgreementState?: AISourceAgreementState | null;
  leagueId?: string | null;
  leagueSharpnessTier?: string | null;
  managerArchetype?: string | null;
  finalScore: number;
  confidenceCap?: number | null;
};

export type AppliedAICalibrationAdjustment = {
  finalScore: number;
  confidenceCap: number;
  appliedAdjustment: AICalibrationAdjustment | null;
  reason: string | null;
};

function cleanText(value: unknown): string | null {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean || null;
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: unknown): number {
  const parsed = numeric(value);
  if (parsed === null) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function weekNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isoDate(value?: string | Date | null): string {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function hashKey(parts: Array<string | number | null | undefined>): string {
  return createHash('sha1')
    .update(parts.map(part => cleanText(part) || 'none').join('|'))
    .digest('hex')
    .slice(0, 16);
}

export function getAIPredictionKey(input: {
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  entityType?: string | null;
  entityId?: string | number | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | number | null;
  week?: string | number | null;
}): string {
  return [
    input.surface,
    input.action,
    cleanText(input.leagueId) || 'global',
    cleanText(input.manager) || 'all',
    cleanText(input.entityType) || 'unknown',
    cleanText(input.entityId) || 'unknown',
    cleanText(input.season) || 'season',
    cleanText(input.week) || 'week',
  ].join(':');
}

function defaultDecision(result: AIEvidenceResult): AIPredictionDecision {
  if (!result.shouldRender || result.hardBlockers.length || result.label === 'blocked') return 'blocked';
  if (result.confidenceCapReason || result.missingEvidence.length) return 'watch';
  if (result.label === 'high conviction' || result.label === 'priority' || result.label === 'actionable') return 'do';
  if (result.label === 'watchlist') return 'watch';
  return 'dont';
}

function hasUnsafeSourceAgreementForAction(sourceAgreement?: AISourceAgreementRead | null): boolean {
  return (
    !sourceAgreement ||
    sourceAgreement.state === 'missing' ||
    sourceAgreement.state === 'unknown' ||
    sourceAgreement.state === 'split' ||
    sourceAgreement.state === 'conflicted'
  );
}

function normalizePredictionDecision(
  decision: AIPredictionDecision,
  evidenceRead: AIEvidenceResult,
  counterfactual: AICounterfactualRead | null,
  sourceAgreement: AISourceAgreementRead | null
): AIPredictionDecision {
  if (!evidenceRead.shouldRender || evidenceRead.hardBlockers.length || evidenceRead.label === 'blocked') return 'blocked';
  if (decision === 'do' && (evidenceRead.confidenceCapReason || evidenceRead.missingEvidence.length)) return 'watch';
  if (decision === 'do' && counterfactual && counterfactual.status !== 'beats-baseline') return 'watch';
  if (decision === 'do' && hasUnsafeSourceAgreementForAction(sourceAgreement)) return 'watch';
  return decision;
}

function getEffectivePredictionDecision(event: AIPredictionEvent): AIPredictionDecision {
  if (event.hardBlockers.length || event.label === 'blocked') return 'blocked';
  if (
    event.decision === 'do' &&
    (event.confidenceCapReason || event.missingEvidence.length || (event.counterfactual && event.counterfactual.status !== 'beats-baseline'))
  ) {
    return 'watch';
  }
  if (event.decision === 'do' && hasUnsafeSourceAgreementForAction(event.sourceAgreement)) return 'watch';
  return event.decision;
}

export function createAIPredictionEvent(input: CreateAIPredictionEventInput): AIPredictionEvent {
  const createdAt = isoDate(input.createdAt);
  const entityType = input.entityType || 'unknown';
  const entityId = cleanText(input.entityId);
  const season = cleanText(input.season);
  const week = weekNumber(input.week);
  const counterfactual = input.counterfactual || input.decisionSnapshot?.counterfactual || null;
  const rawDecision = input.decision || defaultDecision(input.evidenceRead);
  const sourceAgreement = input.sourceAgreement || buildSourceAgreementReadFromTrace(input.evidenceRead.sourceTrace);
  const decision = normalizePredictionDecision(rawDecision, input.evidenceRead, counterfactual, sourceAgreement);
  const predictionKey = cleanText(input.predictionKey) || getAIPredictionKey({
    surface: input.surface,
    action: input.action,
    entityType,
    entityId,
    leagueId: input.leagueId,
    manager: input.manager,
    season,
    week,
  });
  const eventId = cleanText(input.eventId) || `ai-${hashKey([predictionKey, createdAt, input.evidenceRead.finalScore])}`;

  return {
    schemaVersion: 1,
    eventId,
    predictionKey,
    createdAt,
    surface: input.surface,
    action: input.action,
    decision,
    entityType,
    entityId,
    entityName: cleanText(input.entityName),
    leagueId: cleanText(input.leagueId),
    manager: cleanText(input.manager),
    season,
    week,
    label: input.evidenceRead.label,
    finalScore: clampPercent(input.evidenceRead.finalScore),
    confidenceCap: clampPercent(input.evidenceRead.confidenceCap),
    confidenceCapReason: cleanText(input.evidenceRead.confidenceCapReason),
    evidence: input.evidenceRead.evidence,
    missingEvidence: input.evidenceRead.missingEvidence,
    hardBlockers: input.evidenceRead.hardBlockers,
    softPenalties: input.evidenceRead.softPenalties,
    sourceTrace: input.evidenceRead.sourceTrace,
    sourceAgreement,
    decisionSnapshot: input.decisionSnapshot || null,
    counterfactual,
    decay: input.decay || null,
    expiresAt: input.decay?.expiresAt || null,
    whyThisFired: input.evidenceRead.whyThisFired,
    outcome: {
      status: input.evidenceRead.label === 'blocked' ? 'blocked' : 'pending',
      baselineValue: counterfactual?.baseline.score ?? null,
      feedbackSource: 'system',
    },
    metadata: input.metadata,
  };
}

function normalizeDirection(value: unknown): AISourceSignalDirection {
  const clean = String(value || '').trim().toLowerCase();
  if (clean === 'for' || clean === 'support' || clean === 'positive' || clean === 'boost') return 'for';
  if (clean === 'against' || clean === 'negative' || clean === 'avoid' || clean === 'fade') return 'against';
  if (
    clean === 'missing' ||
    clean === 'unavailable' ||
    clean === 'unverified' ||
    clean === 'stale' ||
    clean === 'error' ||
    clean === 'limited'
  ) return 'missing';
  return 'neutral';
}

function hasMissingSourceStatus(signal: AISourceAgreementSignal): boolean {
  const detail = `${signal.source || ''} ${signal.detail || ''}`;
  return (
    signal.status === 'missing' ||
    signal.status === 'unavailable' ||
    signal.status === 'unverified' ||
    signal.status === 'stale' ||
    signal.status === 'error' ||
    signal.status === 'limited' ||
    signal.direction === 'missing' ||
    /\b(?:0|zero)\s+rows?\b|no source|empty source|source empty|provider disabled|source disabled/i.test(detail)
  );
}

function signalWeight(signal: AISourceAgreementSignal): number {
  if (hasMissingSourceStatus(signal)) return 0;
  return Math.max(1, Math.min(100, clampPercent(signal.confidence ?? 60)));
}

export function buildSourceAgreementRead(signals: AISourceAgreementSignal[]): AISourceAgreementRead {
  const normalized = signals
    .map(signal => ({
      source: cleanText(signal.source) || 'unknown-source',
      direction: hasMissingSourceStatus(signal)
        ? 'missing'
        : normalizeDirection(signal.direction),
      confidence: signal.confidence === null || signal.confidence === undefined ? null : clampPercent(signal.confidence),
      status: signal.status || undefined,
      detail: cleanText(signal.detail),
    }))
    .filter(signal => signal.source);
  const missingCount = normalized.filter(hasMissingSourceStatus).length;
  const directional = normalized.filter(signal => signal.direction === 'for' || signal.direction === 'against');
  const forWeight = directional
    .filter(signal => signal.direction === 'for')
    .reduce((sum, signal) => sum + signalWeight(signal), 0);
  const againstWeight = directional
    .filter(signal => signal.direction === 'against')
    .reduce((sum, signal) => sum + signalWeight(signal), 0);
  const neutralWeight = normalized
    .filter(signal => signal.direction === 'neutral')
    .reduce((sum, signal) => sum + signalWeight(signal), 0);
  const totalDirectionalWeight = forWeight + againstWeight;

  if (!normalized.length || directional.length === 0) {
    const state: AISourceAgreementState = !normalized.length || missingCount === normalized.length
      ? 'missing'
      : 'unknown';
    return {
      state,
      directionalSourceCount: directional.length,
      sourceCount: normalized.length,
      forWeight,
      againstWeight,
      neutralWeight,
      missingCount,
      confidenceCap: 48,
      reason: state === 'missing' ? 'No source signals were available' : 'No directional source signal was available',
      signals: normalized,
    };
  }

  if (directional.length < 2) {
    return {
      state: missingCount > 0 ? 'split' : 'thin',
      directionalSourceCount: directional.length,
      sourceCount: normalized.length,
      forWeight,
      againstWeight,
      neutralWeight,
      missingCount,
      confidenceCap: missingCount > 0 ? 62 : 56,
      reason: missingCount > 0
        ? 'Directional source proof is mixed with missing source signals'
        : 'Only one directional source supports this read',
      signals: normalized,
    };
  }

  const hasFor = forWeight > 0;
  const hasAgainst = againstWeight > 0;
  if (hasFor && hasAgainst) {
    const diff = Math.abs(forWeight - againstWeight);
    const strongBothSides = forWeight >= 70 && againstWeight >= 70;
    const state: AISourceAgreementState = strongBothSides ? 'conflicted' : 'split';
    return {
      state,
      directionalSourceCount: directional.length,
      sourceCount: normalized.length,
      forWeight,
      againstWeight,
      neutralWeight,
      missingCount,
      confidenceCap: state === 'conflicted' ? 52 : diff / totalDirectionalWeight < 0.35 ? 62 : 68,
      reason: state === 'conflicted'
        ? 'Strong approved sources point in opposite directions'
        : 'Approved sources are split, so confidence stays limited',
      signals: normalized,
    };
  }

  return {
    state: missingCount > 0 ? 'split' : 'aligned',
    directionalSourceCount: directional.length,
    sourceCount: normalized.length,
    forWeight,
    againstWeight,
    neutralWeight,
    missingCount,
    confidenceCap: missingCount > 0 ? 62 : null,
    reason: missingCount > 0 ? 'Directional source proof is mixed with missing source signals' : 'Directional sources align',
    signals: normalized,
  };
}

function buildSourceAgreementReadFromTrace(sourceTrace: AISourceTrace[]): AISourceAgreementRead {
  return buildSourceAgreementRead(
    sourceTrace.slice(0, 8).map(trace => {
      const detail = cleanText(trace.detail);
      const unhealthy = hasMissingSourceStatus({
        source: trace.label,
        direction: 'neutral',
        status: trace.status,
        detail,
      });
      return {
        source: trace.label,
        direction: unhealthy ? 'missing' : 'for',
        confidence: unhealthy ? 0 : 70,
        status: trace.status,
        detail,
      };
    })
  );
}

function eventGroupValue(event: AIPredictionEvent, groupBy: AIPredictionReliabilityGroupBy): string {
  if (groupBy === 'decision') return getEffectivePredictionDecision(event);
  if (groupBy === 'sourceAgreement') return event.sourceAgreement?.state || 'unknown';
  if (groupBy === 'leagueSharpness') return getLeagueSharpnessBucket(event).tier || 'unknown';
  if (groupBy === 'league') return event.leagueId || 'global';
  if (groupBy === 'manager') return event.manager || 'unknown';
  if (groupBy === 'managerArchetype') return cleanText(event.metadata?.managerArchetype) || cleanText(event.metadata?.managerPersonalityArchetype) || 'unknown';
  if (groupBy === 'leagueFormat') return event.decisionSnapshot?.valueMode || String(event.metadata?.valueMode || 'unknown');
  if (groupBy === 'counterfactual') return event.counterfactual?.status || 'missing-baseline';
  if (groupBy === 'realizedEdge') return event.outcome.realizedEdge?.status || 'unresolved';
  return String(event[groupBy] || 'unknown');
}

function getQueueSignals(event: AIPredictionEvent): string[] {
  const raw = event.metadata?.queueSignals;
  if (Array.isArray(raw)) {
    return raw.map(item => cleanText(item)).filter((item): item is string => Boolean(item));
  }
  const text = cleanText(raw);
  return text ? [text] : [];
}

function getLeagueSharpnessBucket(event: AIPredictionEvent): {
  tier: string | null;
  label: string | null;
  score: number | null;
} {
  const metadataTier = cleanText(event.metadata?.leagueSharpnessTier);
  const metadataLabel = cleanText(event.metadata?.leagueSharpnessLabel);
  const metadataScore = numeric(event.metadata?.leagueSharpnessScore);
  if (metadataTier || metadataLabel || metadataScore !== null) {
    return {
      tier: metadataTier || metadataLabel?.toLowerCase().replace(/\s+/g, '-') || null,
      label: metadataLabel || metadataTier,
      score: metadataScore,
    };
  }

  const signal = getQueueSignals(event).find(value =>
    /\b(sleepy|casual|average|sharp|shark tank|shark-tank)\b/i.test(value)
  );
  if (!signal) return { tier: null, label: null, score: null };

  const score = numeric(signal.match(/(\d{1,3})%/)?.[1]);
  const label = signal.replace(/\s+\d{1,3}%.*$/, '').trim();
  const tier = label.toLowerCase().replace(/\s+/g, '-');
  return {
    tier,
    label,
    score,
  };
}

function bucketRecommendation(input: {
  scoredCount: number;
  calibrationGap: number | null;
  brierScore: number | null;
}): AIPredictionReliabilityBucket['recommendation'] {
  if (input.scoredCount < 5) return 'collect-more-samples';
  if (input.brierScore !== null && input.brierScore > 0.28) return 'review-model';
  if (input.calibrationGap !== null && input.calibrationGap > 15) return 'lower-confidence';
  if (input.calibrationGap !== null && input.calibrationGap < -15) return 'raise-confidence';
  return 'calibrated';
}

function buildReliabilityBucket(key: string, group: Record<string, string>, events: AIPredictionEvent[]): AIPredictionReliabilityBucket {
  const hitEvents = events.filter(event => event.outcome.status === 'hit');
  const missEvents = events.filter(event => event.outcome.status === 'miss');
  const pushCount = events.filter(event => event.outcome.status === 'push').length;
  const pendingCount = events.filter(event => event.outcome.status === 'pending').length;
  const blockedCount = events.filter(event => event.outcome.status === 'blocked').length;
  const scored = [...hitEvents, ...missEvents];
  const scoredCount = scored.length;
  const avgConfidence = scoredCount
    ? Math.round(scored.reduce((sum, event) => sum + event.finalScore, 0) / scoredCount)
    : null;
  const hitRate = scoredCount ? Math.round((hitEvents.length / scoredCount) * 1000) / 10 : null;
  const brierScore = scoredCount
    ? Math.round((scored.reduce((sum, event) => {
      const predicted = event.finalScore / 100;
      const actual = event.outcome.status === 'hit' ? 1 : 0;
      return sum + ((predicted - actual) ** 2);
    }, 0) / scoredCount) * 1000) / 1000
    : null;
  const calibrationGap = avgConfidence !== null && hitRate !== null
    ? Math.round((avgConfidence - hitRate) * 10) / 10
    : null;
  const recommendedScoreAdjustment = calibrationGap === null
    ? 0
    : Math.max(-20, Math.min(20, Math.round(-calibrationGap / 2)));

  return {
    key,
    group,
    eventCount: events.length,
    scoredCount,
    hitCount: hitEvents.length,
    missCount: missEvents.length,
    pushCount,
    pendingCount,
    blockedCount,
    avgConfidence,
    hitRate,
    brierScore,
    calibrationGap,
    recommendedScoreAdjustment,
    recommendation: bucketRecommendation({ scoredCount, calibrationGap, brierScore }),
  };
}

function getSampleSizeConfidenceCap(scoredCount: number): number | null {
  if (scoredCount < 5) return 56;
  if (scoredCount < 20) return 68;
  if (scoredCount < 50) return 82;
  return null;
}

export function summarizeAIPredictionReliability(
  events: AIPredictionEvent[],
  options: { groupBy?: AIPredictionReliabilityGroupBy[] } = {}
): AIPredictionReliabilitySummary {
  const groupBy: AIPredictionReliabilityGroupBy[] = options.groupBy?.length ? options.groupBy : ['surface', 'action', 'label'];
  const buckets = new Map<string, { group: Record<string, string>; events: AIPredictionEvent[] }>();

  events.forEach(event => {
    const group = Object.fromEntries(groupBy.map(key => [key, eventGroupValue(event, key)]));
    const key = groupBy.map(item => `${item}=${group[item]}`).join('|');
    const bucket = buckets.get(key) || { group, events: [] };
    bucket.events.push(event);
    buckets.set(key, bucket);
  });

  const allBucket = buildReliabilityBucket('all', { all: 'all' }, events);
  const detailBuckets = Array.from(buckets.entries())
    .map(([key, bucket]) => buildReliabilityBucket(key, bucket.group, bucket.events))
    .sort((a, b) => b.scoredCount - a.scoredCount || b.eventCount - a.eventCount || a.key.localeCompare(b.key));

  return {
    schemaVersion: 1,
    generatedFrom: 'ai-prediction-events',
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    scoredCount: allBucket.scoredCount,
    pendingCount: allBucket.pendingCount,
    buckets: [allBucket, ...detailBuckets],
  };
}

export function summarizeSourceAgreementReliability(events: AIPredictionEvent[]): AIPredictionReliabilitySummary {
  return summarizeAIPredictionReliability(events, { groupBy: ['sourceAgreement'] });
}

function buildCounterfactualBucket(
  status: AICounterfactualStatus | 'all',
  events: AIPredictionEvent[]
): AICounterfactualReliabilityBucket {
  const scored = events.filter(event => event.outcome.status === 'hit' || event.outcome.status === 'miss');
  const hitCount = scored.filter(event => event.outcome.status === 'hit').length;
  const missCount = scored.filter(event => event.outcome.status === 'miss').length;
  const edges = events
    .map(event => event.counterfactual?.edge)
    .filter((edge): edge is number => Number.isFinite(edge));

  return {
    status,
    eventCount: events.length,
    scoredCount: scored.length,
    hitCount,
    missCount,
    avgEdge: edges.length
      ? Math.round((edges.reduce((sum, edge) => sum + edge, 0) / edges.length) * 10) / 10
      : null,
    avgConfidence: scored.length
      ? Math.round(scored.reduce((sum, event) => sum + event.finalScore, 0) / scored.length)
      : null,
    hitRate: scored.length ? Math.round((hitCount / scored.length) * 1000) / 10 : null,
  };
}

export function summarizeAICounterfactualReliability(events: AIPredictionEvent[]): AICounterfactualReliabilitySummary {
  const withCounterfactual = events.filter(event => event.counterfactual);
  const missingBaselineCount = events.filter(event =>
    event.counterfactual?.status === 'missing-baseline' ||
    (!event.counterfactual && getEffectivePredictionDecision(event) === 'do')
  ).length;
  const doWithoutBaselineEdgeCount = events.filter(event =>
    getEffectivePredictionDecision(event) === 'do' &&
    event.counterfactual?.status !== 'beats-baseline'
  ).length;
  const byStatus = new Map<AICounterfactualStatus, AIPredictionEvent[]>();
  withCounterfactual.forEach(event => {
    const status = event.counterfactual?.status || 'missing-baseline';
    const bucket = byStatus.get(status) || [];
    bucket.push(event);
    byStatus.set(status, bucket);
  });

  const buckets = [
    buildCounterfactualBucket('all', withCounterfactual),
    ...Array.from(byStatus.entries())
      .map(([status, bucketEvents]) => buildCounterfactualBucket(status, bucketEvents))
      .sort((a, b) => b.eventCount - a.eventCount || a.status.localeCompare(b.status)),
  ];
  const edges = withCounterfactual
    .map(event => event.counterfactual?.edge)
    .filter((edge): edge is number => Number.isFinite(edge));

  return {
    schemaVersion: 1,
    generatedFrom: 'ai-prediction-events',
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    baselineCount: withCounterfactual.length,
    missingBaselineCount,
    doWithoutBaselineEdgeCount,
    avgEdge: edges.length
      ? Math.round((edges.reduce((sum, edge) => sum + edge, 0) / edges.length) * 10) / 10
      : null,
    buckets,
  };
}

function avg(values: Array<number | null | undefined>): number | null {
  const numericValues = values.filter((value): value is number => Number.isFinite(value));
  return numericValues.length
    ? Math.round((numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length) * 10) / 10
    : null;
}

function getTradeTargetManager(event: AIPredictionEvent): string {
  const metadataTarget = cleanText(event.metadata?.counterparty)
    || cleanText(event.metadata?.targetManager)
    || cleanText(event.metadata?.opposingManager);
  return metadataTarget
    || cleanText(event.outcome.realizedEdge?.source?.replace(/^trade:/i, ''))
    || cleanText(event.entityName)
    || cleanText(event.manager)
    || 'unknown manager';
}

function managerTradeRecommendation(input: {
  scoredCount: number;
  acceptanceRate: number | null;
  avgRealizedEdge: number | null;
}): AIManagerTradeCalibrationRow['recommendation'] {
  if (input.scoredCount < 3) return 'collect-more-samples';
  if ((input.acceptanceRate ?? 0) >= 55 && (input.avgRealizedEdge ?? 0) >= 0) return 'attack';
  if ((input.acceptanceRate ?? 0) >= 30) return 'test-carefully';
  return 'avoid-unless-overpay';
}

export function summarizeAIManagerTradeCalibration(events: AIPredictionEvent[]): AIManagerTradeCalibrationSummary {
  const tradeEvents = events.filter(event => event.action === 'trade' || event.surface === 'trade');
  const byManager = new Map<string, AIPredictionEvent[]>();
  tradeEvents.forEach(event => {
    const manager = getTradeTargetManager(event);
    byManager.set(manager, [...(byManager.get(manager) || []), event]);
  });

  const rows = Array.from(byManager.entries())
    .map(([manager, managerEvents]) => {
      const scored = managerEvents.filter(event => event.outcome.status === 'hit' || event.outcome.status === 'miss');
      const completedCount = managerEvents.filter(event => event.outcome.status === 'hit').length;
      const missCount = managerEvents.filter(event => event.outcome.status === 'miss').length;
      const pendingCount = managerEvents.filter(event => event.outcome.status === 'pending').length;
      const acceptanceRate = scored.length
        ? Math.round((completedCount / scored.length) * 1000) / 10
        : null;
      const avgPredictedEdge = avg(managerEvents.map(event => event.counterfactual?.edge));
      const avgRealizedEdge = avg(scored.map(event => event.outcome.realizedEdge?.realizedEdge));
      const recommendation = managerTradeRecommendation({
        scoredCount: scored.length,
        acceptanceRate,
        avgRealizedEdge,
      });

      return {
        manager,
        eventCount: managerEvents.length,
        scoredCount: scored.length,
        completedCount,
        missCount,
        pendingCount,
        avgPredictedEdge,
        avgRealizedEdge,
        acceptanceRate,
        recommendation,
        note:
          recommendation === 'attack'
            ? 'This manager has accepted enough modeled trade edges to stay in the attack lane.'
            : recommendation === 'test-carefully'
              ? 'This manager is tradeable, but the offer needs a clean edge and clean fit.'
              : recommendation === 'avoid-unless-overpay'
                ? 'This manager has not converted enough offers; avoid thin trade reads here.'
                : 'Collect more trade outcomes before leaning on this manager profile.',
      } satisfies AIManagerTradeCalibrationRow;
    })
    .sort((a, b) =>
      (b.scoredCount - a.scoredCount) ||
      ((b.acceptanceRate ?? -1) - (a.acceptanceRate ?? -1)) ||
      a.manager.localeCompare(b.manager)
    )
    .slice(0, 24);

  return {
    schemaVersion: 1,
    generatedFrom: 'ai-prediction-events',
    generatedAt: new Date().toISOString(),
    eventCount: tradeEvents.length,
    rows,
  };
}

function textFromMetadata(event: AIPredictionEvent, key: string): string {
  return String(event.metadata?.[key] || '').trim().toLowerCase();
}

function eventHasTraceText(event: AIPredictionEvent, pattern: RegExp): boolean {
  return event.sourceTrace.some(trace =>
    pattern.test(trace.label || '') ||
    pattern.test(trace.detail || '')
  ) || event.evidence.some(value => pattern.test(value));
}

function getModuleSampleStatus(scoredCount: number): AIModuleQualityRow['sampleStatus'] {
  if (scoredCount >= 50) return 'ready';
  if (scoredCount >= 20) return 'usable';
  if (scoredCount >= 5) return 'collecting';
  return 'needs-samples';
}

function getModuleConfidenceAction(
  bucket: AIPredictionReliabilityBucket
): AIModuleQualityRow['confidenceAction'] {
  if (bucket.scoredCount < 5) return 'hold-cap';
  if (bucket.recommendation === 'lower-confidence' || bucket.recommendation === 'review-model') return 'lower';
  if (bucket.recommendation === 'raise-confidence') return 'raise';
  return 'keep';
}

function buildModuleQualityRow(input: {
  key: AIModuleQualityKey;
  label: string;
  description: string;
  events: AIPredictionEvent[];
  nextDataNeeded: string;
}): AIModuleQualityRow {
  const bucket = buildReliabilityBucket(input.key, { module: input.key }, input.events);
  return {
    key: input.key,
    label: input.label,
    description: input.description,
    eventCount: bucket.eventCount,
    scoredCount: bucket.scoredCount,
    pendingCount: bucket.pendingCount,
    hitRate: bucket.hitRate,
    avgConfidence: bucket.avgConfidence,
    calibrationGap: bucket.calibrationGap,
    brierScore: bucket.brierScore,
    recommendation: bucket.recommendation,
    sampleStatus: getModuleSampleStatus(bucket.scoredCount),
    confidenceAction: getModuleConfidenceAction(bucket),
    nextDataNeeded: input.nextDataNeeded,
  };
}

export function buildAIModuleQualitySummary(events: AIPredictionEvent[]): AIModuleQualitySummary {
  const waiverEvents = events.filter(event =>
    event.surface === 'waiver' ||
    (event.surface === 'autopilot' && ['pickup', 'stash', 'stream'].includes(event.action))
  );
  const tradeEvents = events.filter(event => event.surface === 'trade' || event.action === 'trade');
  const roleEvents = events.filter(event =>
    event.surface === 'player-detail' ||
    eventHasTraceText(event, /depth|role|starter|snap|route|usage|injur/i) ||
    /depth|role|starter|snap|route|usage|injur/i.test(textFromMetadata(event, 'source'))
  );
  const waiverBidEvents = waiverEvents.filter(event =>
    /faab|bid|claim|waiver/.test(textFromMetadata(event, 'actionText')) ||
    /faab|bid|claim|waiver/.test(textFromMetadata(event, 'recommendationType')) ||
    eventHasTraceText(event, /faab|bid|claim|waiver/i)
  );
  const waiverCompetitionEvents = waiverEvents.filter(event =>
    event.sourceAgreement?.state ||
    event.counterfactual?.baseline.kind === 'highest-ranked-available' ||
    event.counterfactual?.baseline.kind === 'replacement' ||
    Number.isFinite(Number(event.metadata?.trendAdds)) ||
    Number.isFinite(Number(event.metadata?.targetScore))
  );

  return {
    schemaVersion: 1,
    generatedFrom: 'ai-prediction-events',
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    rows: [
      buildModuleQualityRow({
        key: 'waiver-bid-range',
        label: 'Waiver bid range',
        description: 'Checks whether add/claim calls and FAAB-style ranges are landing at the right confidence.',
        events: waiverBidEvents.length ? waiverBidEvents : waiverEvents,
        nextDataNeeded: 'Uses Sleeper winning bids when available; still needs skipped claims, losing bids where visible, priority results, and follow-up production.',
      }),
      buildModuleQualityRow({
        key: 'waiver-competition',
        label: 'Waiver competition',
        description: 'Checks whether the AI is reading crowded waiver rooms and replacement alternatives correctly.',
        events: waiverCompetitionEvents.length ? waiverCompetitionEvents : waiverEvents,
        nextDataNeeded: 'Needs weekly waiver priority, bid competition, trend adds, and highest-available baselines after waivers process.',
      }),
      buildModuleQualityRow({
        key: 'trade-resistance',
        label: 'Trade resistance',
        description: 'Checks whether manager-specific trade calls are realistic instead of just fair on paper.',
        events: tradeEvents,
        nextDataNeeded: 'Needs proposed, accepted, rejected, blocked, and countered trade outcomes by manager and roster context.',
      }),
      buildModuleQualityRow({
        key: 'depth-chart-role-confidence',
        label: 'Depth-chart role confidence',
        description: 'Checks whether role, starter, usage, injury, and depth-chart reads predicted actual playing time.',
        events: roleEvents,
        nextDataNeeded: 'Needs in-season depth-chart changes, injury/practice reports, snaps, routes, targets, carries, and starter outcomes.',
      }),
    ],
  };
}

function adjustmentScopeForGroupBy(groupBy: AIPredictionReliabilityGroupBy[]): AICalibrationAdjustmentScope {
  const key = groupBy.join('|');
  if (key === 'surface') return 'surface';
  if (key === 'action') return 'action';
  if (key === 'label') return 'label';
  if (key === 'sourceAgreement') return 'sourceAgreement';
  if (key === 'leagueFormat') return 'leagueFormat';
  if (key === 'counterfactual') return 'counterfactual';
  if (key === 'realizedEdge') return 'realizedEdge';
  if (key === 'surface|action') return 'surfaceAction';
  if (key === 'surface|action|label') return 'surfaceActionLabel';
  if (key === 'surface|action|sourceAgreement') return 'surfaceActionSourceAgreement';
  if (key === 'surface|action|leagueFormat') return 'surfaceActionLeagueFormat';
  if (key === 'surface|action|counterfactual') return 'surfaceActionCounterfactual';
  if (key === 'surface|action|realizedEdge') return 'surfaceActionRealizedEdge';
  if (key === 'surface|manager') return 'surfaceManager';
  if (key === 'surface|league') return 'surfaceLeague';
  if (key === 'surface|action|league') return 'surfaceActionLeague';
  if (key === 'leagueSharpness') return 'leagueSharpness';
  if (key === 'surface|action|leagueSharpness') return 'surfaceActionLeagueSharpness';
  if (key === 'managerArchetype') return 'managerArchetype';
  if (key === 'surface|action|managerArchetype') return 'surfaceActionManagerArchetype';
  return 'global';
}

function getAdjustmentPriority(bucket: AIPredictionReliabilityBucket): AICalibrationAdjustment['priority'] {
  if (bucket.recommendation === 'review-model') return 'danger';
  if (bucket.recommendation === 'lower-confidence') return 'warn';
  if (bucket.recommendation === 'raise-confidence') return 'info';
  if (bucket.recommendation === 'calibrated') return 'good';
  return 'info';
}

function getRecommendedConfidenceCap(bucket: AIPredictionReliabilityBucket): number | null {
  const sampleCap = getSampleSizeConfidenceCap(bucket.scoredCount);
  if (bucket.scoredCount < 5 || bucket.hitRate === null || bucket.avgConfidence === null) return sampleCap;
  if (bucket.recommendation === 'review-model') {
    return Math.min(sampleCap ?? 100, Math.max(35, Math.min(76, Math.round(bucket.hitRate + 8))));
  }
  if (bucket.recommendation === 'lower-confidence') {
    return Math.min(sampleCap ?? 100, Math.max(38, Math.min(88, Math.round(bucket.hitRate + 12))));
  }
  return sampleCap;
}

function getAdjustmentReason(bucket: AIPredictionReliabilityBucket): string {
  if (bucket.scoredCount < 5) {
    return `Only ${bucket.scoredCount} scored outcome${bucket.scoredCount === 1 ? '' : 's'}; cap confidence until this bucket proves itself.`;
  }
  if (bucket.recommendation === 'review-model') {
    return `High miss error in this bucket: ${bucket.hitRate ?? 0}% hit rate at ${bucket.avgConfidence ?? 0}% average confidence.`;
  }
  if (bucket.recommendation === 'lower-confidence') {
    return `Overconfident by ${bucket.calibrationGap ?? 0} points; lower future reads in this bucket.`;
  }
  if (bucket.recommendation === 'raise-confidence') {
    return `Underconfident by ${Math.abs(bucket.calibrationGap ?? 0)} points; future reads can earn a small bump.`;
  }
  return 'Observed outcomes are close to the emitted confidence.';
}

function adjustmentFromBucket(
  scope: AICalibrationAdjustmentScope,
  bucket: AIPredictionReliabilityBucket
): AICalibrationAdjustment {
  const hasEnoughSample = bucket.scoredCount >= 5;
  const scoreAdjustment = hasEnoughSample ? bucket.recommendedScoreAdjustment : 0;

  return {
    key: `${scope}:${bucket.key}`,
    scope,
    group: bucket.group,
    eventCount: bucket.eventCount,
    scoredCount: bucket.scoredCount,
    pendingCount: bucket.pendingCount,
    hitRate: bucket.hitRate,
    avgConfidence: bucket.avgConfidence,
    calibrationGap: bucket.calibrationGap,
    brierScore: bucket.brierScore,
    scoreAdjustment,
    confidenceCap: getRecommendedConfidenceCap(bucket),
    recommendation: bucket.recommendation,
    priority: getAdjustmentPriority(bucket),
    reason: getAdjustmentReason(bucket),
  };
}

function adjustmentSortValue(adjustment: AICalibrationAdjustment): number {
  const priorityScore = adjustment.priority === 'danger'
    ? 4
    : adjustment.priority === 'warn'
      ? 3
      : adjustment.priority === 'info'
        ? 2
        : 1;
  return priorityScore * 10000 + Math.abs(adjustment.scoreAdjustment) * 100 + adjustment.scoredCount;
}

export function buildAICalibrationAdjustmentProfile(
  events: AIPredictionEvent[],
  options: { limit?: number } = {}
): AICalibrationAdjustmentProfile {
  const limit = Math.max(1, Math.min(Number(options.limit) || 40, 100));
  const globalSummary = summarizeAIPredictionReliability(events, { groupBy: ['surface'] });
  const globalAdjustment = adjustmentFromBucket('global', globalSummary.buckets[0]);
  const groupings: AIPredictionReliabilityGroupBy[][] = [
    ['surface'],
    ['action'],
    ['label'],
    ['sourceAgreement'],
    ['leagueFormat'],
    ['counterfactual'],
    ['realizedEdge'],
    ['surface', 'action'],
    ['surface', 'action', 'label'],
    ['surface', 'action', 'sourceAgreement'],
    ['surface', 'action', 'leagueFormat'],
    ['surface', 'action', 'counterfactual'],
    ['surface', 'action', 'realizedEdge'],
    ['surface', 'manager'],
    ['surface', 'league'],
    ['surface', 'action', 'league'],
    ['leagueSharpness'],
    ['surface', 'action', 'leagueSharpness'],
    ['managerArchetype'],
    ['surface', 'action', 'managerArchetype'],
  ];

  const adjustmentsByKey = new Map<string, AICalibrationAdjustment>();
  groupings.forEach(groupBy => {
    const scope = adjustmentScopeForGroupBy(groupBy);
    summarizeAIPredictionReliability(events, { groupBy }).buckets
      .filter(bucket => bucket.key !== 'all')
      .map(bucket => adjustmentFromBucket(scope, bucket))
      .forEach(adjustment => adjustmentsByKey.set(adjustment.key, adjustment));
  });

  const adjustments = Array.from(adjustmentsByKey.values())
    .sort((a, b) => adjustmentSortValue(b) - adjustmentSortValue(a) || a.key.localeCompare(b.key))
    .slice(0, limit);

  return {
    schemaVersion: 1,
    generatedFrom: 'ai-prediction-events',
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    scoredCount: globalAdjustment.scoredCount,
    pendingCount: globalAdjustment.pendingCount,
    globalAdjustment,
    adjustments,
  };
}

function getOutcomeVerdict(status: AIPredictionOutcomeStatus): AIOutcomeLedgerRow['verdict'] {
  if (status === 'hit') return 'worked';
  if (status === 'miss') return 'missed';
  if (status === 'push') return 'ignored';
  if (status === 'blocked') return 'blocked';
  return 'pending';
}

function getOutcomeModule(event: AIPredictionEvent): string {
  if (event.surface === 'autopilot') {
    const source = cleanText(event.metadata?.source);
    if (source === 'waiver') return 'Action Queue · Waiver';
    if (source === 'trade') return 'Action Queue · Trade';
    if (source === 'lineup') return 'Action Queue · Lineup';
    return 'Action Queue';
  }
  if (event.surface === 'waiver') return 'Waiver AI';
  if (event.surface === 'trade') return 'Trade AI';
  if (event.surface === 'player-detail') return 'Player Modal AI';
  if (event.surface === 'schedule') return 'Matchup AI';
  if (event.surface === 'owner-intel') return 'Owner Intel AI';
  if (event.surface === 'rankings') return 'Rankings AI';
  if (event.surface === 'overview') return 'Overview AI';
  return event.surface;
}

function formatObservedOutcomeStatus(value: string | null): string | null {
  return value ? value.replace(/^observed_/, '').replace(/_/g, ' ') : null;
}

function buildOutcomeLedgerRow(event: AIPredictionEvent): AIOutcomeLedgerRow {
  const sharpness = getLeagueSharpnessBucket(event);
  const observedOutcome = event.outcome.observedOutcome || null;
  const observedReason = cleanText(event.outcome.observedOutcome?.evidence.reason);
  const observedStatus = cleanText(event.outcome.observedOutcome?.status);
  const observedStatusLabel = formatObservedOutcomeStatus(observedStatus);
  const observedDetectedFrom = observedOutcome?.evidence.detectedFrom || null;
  const observedConfidence = Number(observedOutcome?.confidence);
  return {
    eventId: event.eventId,
    predictionKey: event.predictionKey,
    createdAt: event.createdAt,
    updatedAt: cleanText((event as AIPredictionEvent & { updatedAt?: string | null }).updatedAt),
    leagueId: event.leagueId || null,
    manager: event.manager || null,
    surface: event.surface,
    action: event.action,
    module: getOutcomeModule(event),
    decision: getEffectivePredictionDecision(event),
    entityType: event.entityType,
    entityName: event.entityName || null,
    label: event.label,
    finalScore: event.finalScore,
    confidenceCap: event.confidenceCap,
    outcomeStatus: event.outcome.status,
    feedbackSource: event.outcome.feedbackSource || null,
    observedOutcomeStatus: observedOutcome?.status || null,
    observedOutcomeConfidence: Number.isFinite(observedConfidence) ? observedConfidence : null,
    observedOutcomeDetectedFrom: observedDetectedFrom,
    observedOutcomeReason: observedReason,
    sourceAgreement: event.sourceAgreement?.state || 'unknown',
    counterfactualStatus: event.counterfactual?.status || 'missing-baseline',
    baselineLabel: event.counterfactual?.baseline.label || null,
    baselineScore: event.counterfactual?.baseline.score ?? event.outcome.baselineValue ?? null,
    realizedEdgeStatus: event.outcome.realizedEdge?.status || null,
    realizedEdge: event.outcome.realizedEdge?.realizedEdge ?? null,
    sharpnessLabel: sharpness.label,
    sharpnessScore: sharpness.score,
    sharpnessTier: sharpness.tier,
    verdict: getOutcomeVerdict(event.outcome.status),
    evidencePreview: [
      observedReason
        ? `Observed ${observedStatusLabel || 'outcome'}${Number.isFinite(observedConfidence) ? ` · ${observedConfidence}%` : ''}${observedDetectedFrom ? ` · ${observedDetectedFrom.replace(/_/g, ' ')}` : ''}: ${observedReason}`
        : null,
      ...event.evidence,
    ].filter((value): value is string => Boolean(value)).slice(0, 3),
    missingEvidence: event.missingEvidence.slice(0, 3),
    blockers: event.hardBlockers.slice(0, 3),
    why: event.whyThisFired,
  };
}

export function buildAIOutcomeMemorySummary(
  events: AIPredictionEvent[],
  options: { limit?: number } = {}
): AIOutcomeMemorySummary {
  const limit = Math.max(1, Math.min(Number(options.limit) || 50, 200));
  const global = summarizeAIPredictionReliability(events, { groupBy: ['surface'] }).buckets[0];
  const adjustmentProfile = buildAICalibrationAdjustmentProfile(events, { limit: 12 });
  const confidenceBuckets = summarizeAIPredictionReliability(events, { groupBy: ['label'] }).buckets
    .filter(bucket => bucket.key !== 'all');
  const moduleScorecards = summarizeAIPredictionReliability(events, { groupBy: ['surface', 'action'] }).buckets
    .filter(bucket => bucket.key !== 'all')
    .slice(0, 16);
  const sharpnessBuckets = summarizeAIPredictionReliability(events, { groupBy: ['leagueSharpness'] }).buckets
    .filter(bucket => bucket.key !== 'all' && bucket.group.leagueSharpness !== 'unknown');

  return {
    schemaVersion: 1,
    generatedFrom: 'ai-prediction-events',
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    scoredCount: global.scoredCount,
    pendingCount: global.pendingCount,
    ledger: events.slice(0, limit).map(buildOutcomeLedgerRow),
    confidenceBuckets,
    moduleScorecards,
    sharpnessBuckets,
    automaticAdjustments: adjustmentProfile.adjustments
      .filter(adjustment =>
        adjustment.recommendation === 'lower-confidence' ||
        adjustment.recommendation === 'raise-confidence' ||
        adjustment.recommendation === 'review-model'
      )
      .slice(0, 8),
  };
}

function getAdjustmentGroupValue(input: ApplyAICalibrationAdjustmentInput, key: string): string {
  if (key === 'surface') return input.surface;
  if (key === 'action') return input.action;
  if (key === 'label') return input.label;
  if (key === 'sourceAgreement') return input.sourceAgreementState || 'unknown';
  if (key === 'league') return input.leagueId || 'global';
  if (key === 'leagueSharpness') return input.leagueSharpnessTier || 'unknown';
  if (key === 'managerArchetype') return input.managerArchetype || 'unknown';
  return 'unknown';
}

function matchesAdjustment(input: ApplyAICalibrationAdjustmentInput, adjustment: AICalibrationAdjustment): boolean {
  return Object.entries(adjustment.group).every(([key, value]) => getAdjustmentGroupValue(input, key) === value);
}

function adjustmentSpecificity(adjustment: AICalibrationAdjustment): number {
  return Object.keys(adjustment.group).length;
}

function adjustmentFallbackPriority(adjustment: AICalibrationAdjustment): number {
  if (adjustment.group.manager) return 600;
  if (adjustment.group.league) return 500;
  if (adjustment.group.managerArchetype) return 400;
  if (adjustment.group.leagueSharpness) return 300;
  if (adjustment.group.leagueFormat) return 220;
  if (adjustment.scope === 'global') return 0;
  return 100;
}

export function findAICalibrationAdjustment(
  input: ApplyAICalibrationAdjustmentInput
): AICalibrationAdjustment | null {
  const matches = input.profile.adjustments
    .filter(adjustment => adjustment.scoreAdjustment !== 0 || adjustment.confidenceCap !== null)
    .filter(adjustment => matchesAdjustment(input, adjustment))
    .sort((a, b) =>
      adjustmentFallbackPriority(b) - adjustmentFallbackPriority(a) ||
      adjustmentSpecificity(b) - adjustmentSpecificity(a) ||
      Math.abs(b.scoreAdjustment) - Math.abs(a.scoreAdjustment) ||
      b.scoredCount - a.scoredCount
    );

  return matches[0] || null;
}

export function applyAICalibrationAdjustment(
  input: ApplyAICalibrationAdjustmentInput
): AppliedAICalibrationAdjustment {
  const baseScore = clampPercent(input.finalScore);
  const baseCap = clampPercent(input.confidenceCap ?? 100);
  const adjustment = findAICalibrationAdjustment(input);
  if (!adjustment) {
    return {
      finalScore: Math.min(baseScore, baseCap),
      confidenceCap: baseCap,
      appliedAdjustment: null,
      reason: null,
    };
  }

  const adjustedCap = adjustment.confidenceCap === null
    ? baseCap
    : Math.min(baseCap, clampPercent(adjustment.confidenceCap));
  const adjustedScore = clampPercent(baseScore + adjustment.scoreAdjustment);

  return {
    finalScore: Math.min(adjustedScore, adjustedCap),
    confidenceCap: adjustedCap,
    appliedAdjustment: adjustment,
    reason: adjustment.reason,
  };
}
