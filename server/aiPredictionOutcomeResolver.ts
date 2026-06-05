import type { AIPredictionEvent, AIPredictionOutcome } from './aiPredictionCalibration';
import { buildAIRealizedEdge, isAIPredictionExpired } from '../shared/aiDecisionSnapshots';
import {
  buildAIRecommendationGradingWindow,
  isLongHorizonRecommendationWindow,
  parseAIRecommendationGradingWindow,
  type AIRecommendationGradingWindow,
} from '../shared/aiRecommendationGradingWindows';
import {
  evaluateRecommendationOutcome,
  type RecommendationExpectedAction,
  type RecommendationObservedOutcome,
  type RecommendationStateSnapshot,
} from '../shared/recommendationOutcome';

export type AIPredictionResolvedTransaction = {
  type: 'add' | 'drop' | 'trade';
  playerId?: string | null;
  playerName?: string | null;
  manager?: string | null;
  counterparty?: string | null;
  occurredAt?: string | null;
  valueDelta?: number | null;
  bidAmount?: number | null;
  waiverBudget?: number | null;
  season?: string | null;
  week?: number | null;
};

export type AIPredictionResolvedPlayerStat = {
  playerId?: string | null;
  playerName?: string | null;
  fantasyPoints?: number | null;
  projectedFantasyPoints?: number | null;
  baselineFantasyPoints?: number | null;
  replacementFantasyPoints?: number | null;
  started?: boolean | null;
  week?: number | null;
};

export type AIPredictionResolvedValueMovement = {
  playerId?: string | null;
  playerName?: string | null;
  baselineDate?: string | null;
  followUpDate?: string | null;
  baselineValue?: number | null;
  followUpValue?: number | null;
  valueDelta?: number | null;
  valueDeltaPct?: number | null;
  sourceCount?: number | null;
  source?: string | null;
};

export type AIPredictionOutcomeResolverContext = {
  resolvedAt?: string | Date | null;
  transactions?: AIPredictionResolvedTransaction[];
  playerStats?: AIPredictionResolvedPlayerStat[];
  valueMovements?: AIPredictionResolvedValueMovement[];
  rosterStates?: RecommendationStateSnapshot[];
};

function cleanText(value: unknown): string | null {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean || null;
}

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sameEntity(event: AIPredictionEvent, candidate: { playerId?: string | null; playerName?: string | null }) {
  const eventId = cleanText(event.entityId);
  const eventName = normalizeKey(event.entityName);
  const candidateId = cleanText(candidate.playerId);
  const candidateName = normalizeKey(candidate.playerName);
  const eventIdKey = normalizeKey(eventId);
  const candidateIdKey = normalizeKey(candidateId);
  return Boolean(
    (eventId && candidateId && eventId === candidateId) ||
    (eventIdKey && candidateIdKey && eventIdKey === candidateIdKey) ||
    (eventIdKey && candidateIdKey && eventIdKey === `def${candidateIdKey}`) ||
    (eventIdKey && candidateIdKey && candidateIdKey === `def${eventIdKey}`) ||
    (eventName && candidateName && eventName === candidateName)
  );
}

function sameManager(event: AIPredictionEvent, manager?: string | null) {
  const eventManager = normalizeKey(event.manager);
  const candidateManager = normalizeKey(manager);
  return Boolean(
    !eventManager ||
    !candidateManager ||
    eventManager === candidateManager ||
    eventManager.includes(candidateManager) ||
    candidateManager.includes(eventManager)
  );
}

function resolvedAt(input?: string | Date | null): string {
  const date = input ? new Date(input) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function outcome(
  status: AIPredictionOutcome['status'],
  context: AIPredictionOutcomeResolverContext,
  note: string,
  values: Pick<AIPredictionOutcome, 'actualValue' | 'baselineValue' | 'realizedEdge' | 'feedbackSource'> = {}
): AIPredictionOutcome {
  return {
    status,
    resolvedAt: resolvedAt(context.resolvedAt),
    note,
    actualValue: values.actualValue ?? null,
    baselineValue: values.baselineValue ?? null,
    realizedEdge: values.realizedEdge ?? null,
    feedbackSource: values.feedbackSource || 'system',
  };
}

function isRecommendationExpectedAction(value: unknown): value is RecommendationExpectedAction {
  return Boolean(value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string');
}

function getExpectedAction(event: AIPredictionEvent): RecommendationExpectedAction | null {
  const expectedAction = event.metadata?.expectedAction;
  return isRecommendationExpectedAction(expectedAction) ? expectedAction : null;
}

function getEventValueMode(event: AIPredictionEvent): string {
  return cleanText(event.metadata?.valueMode)
    || cleanText(event.decisionSnapshot?.valueMode)
    || 'unknown';
}

function getRecommendationGradingWindow(event: AIPredictionEvent): AIRecommendationGradingWindow {
  return parseAIRecommendationGradingWindow(event.metadata?.gradingWindow)
    || buildAIRecommendationGradingWindow({
      createdAt: event.createdAt,
      season: event.season,
      week: event.week,
      surface: event.surface,
      action: event.action,
      entityType: event.entityType,
      valueMode: getEventValueMode(event),
      recommendationType: event.metadata?.recommendationType,
      actionText: event.metadata?.actionText,
      archetypeKey: event.metadata?.archetypeKey,
      archetypeLabel: event.metadata?.archetypeLabel,
      draftKind: event.metadata?.draftKind,
    });
}

function latestIsoDate(values: Array<string | Date | null | undefined>): string | null {
  let latestIso: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  values.forEach((value) => {
    const date = value ? new Date(value) : null;
    if (!date || !Number.isFinite(date.getTime())) return;
    if (date.getTime() > latestMs) {
      latestMs = date.getTime();
      latestIso = date.toISOString();
    }
  });
  return latestIso;
}

function effectivePredictionExpiresAt(
  event: AIPredictionEvent,
  extraExpiresAt?: string | Date | null
): string | null {
  const gradingWindow = getRecommendationGradingWindow(event);
  const longHorizonWindow = isLongHorizonRecommendationWindow(gradingWindow);
  return latestIsoDate([
    event.expiresAt,
    event.decay?.expiresAt,
    extraExpiresAt,
    longHorizonWindow ? gradingWindow.minimumFinalGradeAt : null,
    longHorizonWindow ? gradingWindow.expiresAt : null,
  ]);
}

function predictionExpired(
  event: AIPredictionEvent,
  context: AIPredictionOutcomeResolverContext,
  extraExpiresAt?: string | Date | null
): boolean {
  return isAIPredictionExpired({
    expiresAt: effectivePredictionExpiresAt(event, extraExpiresAt),
    now: context.resolvedAt,
  });
}

function pendingLongHorizonWindowOutcome(
  event: AIPredictionEvent,
  context: AIPredictionOutcomeResolverContext
): AIPredictionOutcome | null {
  const gradingWindow = getRecommendationGradingWindow(event);
  if (!isLongHorizonRecommendationWindow(gradingWindow)) return null;
  const finalGradeAt = gradingWindow.minimumFinalGradeAt || gradingWindow.expiresAt;
  if (!finalGradeAt || isAIPredictionExpired({ expiresAt: finalGradeAt, now: context.resolvedAt })) return null;
  const evidence = gradingWindow.evidenceRequired.length
    ? gradingWindow.evidenceRequired.join(', ')
    : 'the required outcome evidence';
  return {
    ...event.outcome,
    status: 'pending',
    note: `${gradingWindow.label} remains inside its grading window until ${finalGradeAt}; final hit/miss waits for ${evidence}.`,
  };
}

function observedStatusToPredictionStatus(
  observed: RecommendationObservedOutcome
): AIPredictionOutcome['status'] {
  if (observed.status === 'observed_completed') return 'hit';
  if (observed.status === 'observed_partially_completed') return 'push';
  if (observed.status === 'observed_ignored' || observed.status === 'observed_contradicted') return 'miss';
  if (observed.status === 'expired') return 'push';
  if (observed.status === 'unknown') return 'push';
  if (observed.status === 'pending') return 'pending';
  return 'pending';
}

function observedStatusToRealizedEdgeStatus(
  observed: RecommendationObservedOutcome
): NonNullable<AIPredictionOutcome['realizedEdge']>['status'] {
  if (observed.status === 'observed_completed') return 'action-only';
  if (observed.status === 'observed_partially_completed') return 'matched-baseline';
  if (observed.status === 'observed_ignored' || observed.status === 'observed_contradicted') return 'trailed-baseline';
  if (observed.status === 'expired') return 'expired';
  if (observed.status === 'unknown') return 'matched-baseline';
  return 'action-only';
}

function resolveObservedRecommendationOutcome(
  event: AIPredictionEvent,
  context: AIPredictionOutcomeResolverContext
): AIPredictionOutcome | null {
  const expectedAction = getExpectedAction(event);
  if (!expectedAction) return null;
  if (expectedAction.type === 'hold' || expectedAction.type === 'trade' || expectedAction.type === 'unknown') return null;

  const currentRosterState = (context.rosterStates || [])
    .find(row => sameManager(event, row.manager));
  const scopedTransactions = (context.transactions || [])
    .filter(transaction => sameManager(event, transaction.manager));
  const observed = evaluateRecommendationOutcome({
    expectedAction,
    currentRosterState,
    currentLineupState: currentRosterState,
    transactionHistory: scopedTransactions,
    now: context.resolvedAt,
    expiresAt: effectivePredictionExpiresAt(event, expectedAction.deadline || null),
  });
  if (observed.status === 'pending') return null;
  if (observed.status === 'unknown' && observed.evidence.detectedFrom === 'insufficient_data') return null;
  const status = observedStatusToPredictionStatus(observed);

  const neutralOutcome = observed.status === 'expired' || observed.status === 'unknown';
  const actualValue =
    observed.status === 'observed_completed'
      ? 1
      : observed.status === 'observed_partially_completed'
        ? 0.5
        : neutralOutcome
          ? null
          : 0;
  const baselineValue = neutralOutcome ? null : status === 'push' ? 0.5 : 1;
  const resolved = outcome(status, context, observed.evidence.reason, {
    actualValue,
    baselineValue,
    realizedEdge: buildAIRealizedEdge({
      predictedEdge: event.counterfactual?.edge ?? null,
      actualValue,
      baselineValue,
      baselineKind: baselineKind(event),
      source: `recommendation-observer:${observed.evidence.detectedFrom}`,
      note: observed.evidence.reason,
      status: observedStatusToRealizedEdgeStatus(observed),
    }),
  });
  return {
    ...resolved,
    observedOutcome: observed,
  };
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFaabRangeFromText(value: unknown): { min: number; max: number } | null {
  const text = cleanText(value);
  if (!text) return null;
  const range = text.match(/FAAB\s+(\d+)\s*-\s*(\d+)%?/i);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return {
        min: Math.max(0, Math.min(min, max)),
        max: Math.max(min, max),
      };
    }
  }

  const single = text.match(/FAAB\s+(\d+)%?/i);
  if (single) {
    const value = Number(single[1]);
    if (Number.isFinite(value)) return { min: value, max: value };
  }

  return null;
}

function getPredictedFaabRange(event: AIPredictionEvent): { min: number; max: number } | null {
  const metadataMin = numeric(event.metadata?.faabMin);
  const metadataMax = numeric(event.metadata?.faabMax);
  if (metadataMin !== null || metadataMax !== null) {
    const min = metadataMin ?? metadataMax ?? 0;
    const max = metadataMax ?? metadataMin ?? min;
    return {
      min: Math.max(0, Math.min(min, max)),
      max: Math.max(min, max),
    };
  }

  return parseFaabRangeFromText(event.metadata?.actionText)
    || parseFaabRangeFromText(event.metadata?.recommendationType)
    || parseFaabRangeFromText(event.whyThisFired)
    || event.evidence.map(parseFaabRangeFromText).find(Boolean)
    || null;
}

function getWinningBidPercent(transaction: AIPredictionResolvedTransaction): {
  bidAmount: number;
  bidPercent: number;
  budget: number | null;
} | null {
  const bidAmount = numeric(transaction.bidAmount);
  if (bidAmount === null || bidAmount < 0) return null;
  const budget = numeric(transaction.waiverBudget);
  const safeBudget = budget !== null && budget > 0 ? budget : null;
  const bidPercent = safeBudget && safeBudget !== 100
    ? Math.round((bidAmount / safeBudget) * 1000) / 10
    : Math.round(bidAmount * 10) / 10;
  return { bidAmount, bidPercent, budget: safeBudget };
}

function resolveWaiverBidRangeOutcome(
  event: AIPredictionEvent,
  context: AIPredictionOutcomeResolverContext,
  transaction: AIPredictionResolvedTransaction,
  actorLabel: string
): AIPredictionOutcome | null {
  const predictedRange = getPredictedFaabRange(event);
  const actualBid = getWinningBidPercent(transaction);
  if (!predictedRange || !actualBid) return null;

  const midpoint = Math.round(((predictedRange.min + predictedRange.max) / 2) * 10) / 10;
  const withinRange = actualBid.bidPercent >= predictedRange.min && actualBid.bidPercent <= predictedRange.max;
  const budgetText = actualBid.budget
    ? `${actualBid.bidPercent}% of ${actualBid.budget} budget`
    : `${actualBid.bidPercent}% on the default 100-budget scale`;
  const note = `Sleeper winning bid was ${actualBid.bidAmount} FAAB (${budgetText}) by ${actorLabel}; predicted range was FAAB ${predictedRange.min}-${predictedRange.max}%.`;

  return outcome(
    withinRange && sameManager(event, transaction.manager) ? 'hit' : 'miss',
    context,
    note,
    {
      actualValue: actualBid.bidPercent,
      baselineValue: midpoint,
      realizedEdge: buildAIRealizedEdge({
        predictedEdge: event.counterfactual?.edge ?? null,
        actualValue: actualBid.bidPercent,
        baselineValue: midpoint,
        baselineKind: 'market-default',
        source: 'waiver:winning-bid',
        note,
        status: withinRange ? 'matched-baseline' : 'trailed-baseline',
      }),
    }
  );
}

function eventPosition(event: AIPredictionEvent): string | null {
  return cleanText(event.metadata?.position)
    || event.decisionSnapshot?.facts.find(fact => fact.key === 'position')?.value?.toString()
    || null;
}

function defaultFantasyBaseline(event: AIPredictionEvent): number {
  const position = String(eventPosition(event) || '').toUpperCase();
  if (event.action === 'stream' && (position === 'K' || position === 'DEF' || position === 'DST' || event.entityType === 'schedule')) return 7;
  if (position === 'QB') return 16;
  if (position === 'RB') return 9;
  if (position === 'WR') return 9;
  if (position === 'TE') return 7;
  if (position === 'K' || position === 'DEF' || position === 'DST') return 7;
  return 8;
}

function baselineKind(event: AIPredictionEvent) {
  return event.counterfactual?.baseline.kind || event.decisionSnapshot?.baseline?.kind || 'unknown';
}

function resolvedFantasyBaseline(event: AIPredictionEvent, stat?: AIPredictionResolvedPlayerStat | null): number {
  return numeric(stat?.baselineFantasyPoints)
    ?? numeric(stat?.replacementFantasyPoints)
    ?? numeric(stat?.projectedFantasyPoints)
    ?? defaultFantasyBaseline(event);
}

function realizedEdgeOutcomeStatus(event: AIPredictionEvent, actual: number, baseline: number): AIPredictionOutcome['status'] {
  const edge = actual - baseline;
  if (event.action === 'sit' || event.action === 'avoid') return edge <= 0 ? 'hit' : 'miss';
  return edge >= 0 ? 'hit' : 'miss';
}

function eventText(event: AIPredictionEvent): string {
  return [
    event.action,
    event.decision,
    event.surface,
    event.metadata?.recommendationType,
    event.metadata?.actionText,
    event.metadata?.archetypeKey,
    event.metadata?.archetypeLabel,
    event.whyThisFired,
    ...event.evidence,
  ].map(value => cleanText(value)).filter(Boolean).join(' ').toLowerCase();
}

function isNegativePlayerRead(event: AIPredictionEvent): boolean {
  const text = eventText(event);
  return Boolean(
    event.action === 'sit' ||
    event.action === 'avoid' ||
    event.decision === 'dont' ||
    /\b(sell|sell-high|fade|avoid|sit|bench|do not chase|don't chase|market trap|fragile|role risk|trap)\b/i.test(text)
  );
}

function isPositiveMarketRead(event: AIPredictionEvent): boolean {
  const text = eventText(event);
  return Boolean(
    event.action === 'pickup' ||
    event.action === 'stash' ||
    event.action === 'start' ||
    /\b(buy|buy-low|add|stash|start|volume spike|protected runway|post-hype|breakout|promotion|undervalued)\b/i.test(text)
  );
}

function isMarketValueRead(event: AIPredictionEvent): boolean {
  const text = eventText(event);
  return Boolean(
    event.surface === 'player-detail' ||
    /\b(buy|buy-low|sell|sell-high|hold|avoid|do not chase|don't chase|market|value|trap|stash|breakout|protected runway|fragile)\b/i.test(text)
  );
}

function isFirmNoActionRead(event: AIPredictionEvent): boolean {
  return Boolean(
    event.action === 'hold' ||
    event.action === 'avoid' ||
    event.decision === 'dont' ||
    /\b(hold|do not chase|don't chase|avoid|reject|no action)\b/i.test(eventText(event))
  );
}

function findPlayerStat(event: AIPredictionEvent, context: AIPredictionOutcomeResolverContext): AIPredictionResolvedPlayerStat | null {
  return (context.playerStats || []).find(row => sameEntity(event, row)) || null;
}

function findValueMovement(event: AIPredictionEvent, context: AIPredictionOutcomeResolverContext): AIPredictionResolvedValueMovement | null {
  return (context.valueMovements || []).find(row => sameEntity(event, row)) || null;
}

function findRelatedTransaction(
  event: AIPredictionEvent,
  context: AIPredictionOutcomeResolverContext,
  types: AIPredictionResolvedTransaction['type'][]
): AIPredictionResolvedTransaction | null {
  return (context.transactions || []).find(transaction =>
    types.includes(transaction.type) &&
    sameEntity(event, transaction) &&
    sameManager(event, transaction.manager)
  ) || null;
}

function realizedEdgeForEvent(input: {
  event: AIPredictionEvent;
  actualValue?: number | null;
  baselineValue?: number | null;
  source: string;
  note: string;
}) {
  return buildAIRealizedEdge({
    predictedEdge: input.event.counterfactual?.edge ?? null,
    actualValue: input.actualValue ?? null,
    baselineValue: input.baselineValue ?? null,
    baselineKind: baselineKind(input.event),
    source: input.source,
    note: input.note,
  });
}

function resolvePickupOrStash(event: AIPredictionEvent, context: AIPredictionOutcomeResolverContext): AIPredictionOutcome | null {
  const relatedAdd = (context.transactions || []).find(transaction =>
    transaction.type === 'add' &&
    sameEntity(event, transaction)
  );
  if (!relatedAdd) return null;

  if (sameManager(event, relatedAdd.manager)) {
    const bidOutcome = resolveWaiverBidRangeOutcome(
      event,
      context,
      relatedAdd,
      relatedAdd.manager || 'the target manager'
    );
    if (bidOutcome) return bidOutcome;

    const stat = (context.playerStats || []).find(row => sameEntity(event, row));
    const actual = numeric(stat?.fantasyPoints);
    if (actual !== null) {
      const baseline = resolvedFantasyBaseline(event, stat);
      const note = `Recommended player was added${relatedAdd.manager ? ` by ${relatedAdd.manager}` : ''} and then measured against replacement output.`;
      return outcome(
        realizedEdgeOutcomeStatus(event, actual, baseline),
        context,
        note,
        {
          actualValue: actual,
          baselineValue: baseline,
          realizedEdge: realizedEdgeForEvent({
            event,
            actualValue: actual,
            baselineValue: baseline,
            source: 'waiver:player-stats',
            note,
          }),
        }
      );
    }

    return {
      ...event.outcome,
      status: 'pending',
      note: `Recommended player was added${relatedAdd.manager ? ` by ${relatedAdd.manager}` : ''}; waiting for production to grade realized edge.`,
    };
  }

  const bidOutcome = resolveWaiverBidRangeOutcome(
    event,
    context,
    relatedAdd,
    relatedAdd.manager || 'another manager'
  );
  if (bidOutcome) return bidOutcome;

  return outcome('miss', context, `Recommended player was added by another manager before this read was acted on.`, {
    realizedEdge: buildAIRealizedEdge({
      predictedEdge: event.counterfactual?.edge ?? null,
      actualValue: 0,
      baselineValue: 1,
      baselineKind: baselineKind(event),
      source: 'waiver:transaction',
      note: 'The player was unavailable to the target manager after another roster added him.',
    }),
  });
}

function resolvePlayerPerformanceRead(
  event: AIPredictionEvent,
  context: AIPredictionOutcomeResolverContext,
  source: string
): AIPredictionOutcome | null {
  const stat = findPlayerStat(event, context);
  if (!stat) return null;

  const actual = numeric(stat.fantasyPoints);
  if (actual === null) return null;
  const baseline = resolvedFantasyBaseline(event, stat);
  const negativeRead = isNegativePlayerRead(event);
  const cleared = negativeRead ? actual <= baseline : actual >= baseline;
  const startedText =
    stat.started === true ? ' The player was started.' :
    stat.started === false ? ' The player was not started, so this also grades whether the ignored read was directionally right.' :
    '';
  const note = negativeRead
    ? `${event.action === 'sit' ? 'Sit' : 'Avoid/don\'t-chase'} read ${cleared ? 'was supported' : 'missed'} against the actual-result baseline.${startedText}`
    : `${event.action === 'stream' ? 'Stream' : event.action === 'start' ? 'Start' : 'Player'} read ${cleared ? 'beat' : 'missed'} the actual-result baseline.${startedText}`;

  return outcome(
    cleared ? 'hit' : 'miss',
    context,
    note,
    {
      actualValue: actual,
      baselineValue: baseline,
      realizedEdge: realizedEdgeForEvent({
        event,
        actualValue: negativeRead ? baseline : actual,
        baselineValue: negativeRead ? actual : baseline,
        source,
        note,
      }),
    }
  );
}

function resolveValueMovementRead(event: AIPredictionEvent, context: AIPredictionOutcomeResolverContext): AIPredictionOutcome | null {
  if (!isMarketValueRead(event)) return null;
  const movement = findValueMovement(event, context);
  if (!movement) return null;

  const baseline = numeric(movement.baselineValue);
  const followUp = numeric(movement.followUpValue);
  const delta = numeric(movement.valueDelta) ?? (baseline !== null && followUp !== null ? followUp - baseline : null);
  if (baseline === null || followUp === null || delta === null) return null;

  const pct = numeric(movement.valueDeltaPct) ?? (baseline > 0 ? (delta / baseline) * 100 : null);
  const minMeaningfulMove = Math.max(75, Math.round(baseline * 0.04));
  const movedUp = delta >= minMeaningfulMove;
  const movedDown = delta <= -minMeaningfulMove;
  const negativeRead = isNegativePlayerRead(event);
  const positiveRead = isPositiveMarketRead(event);
  const expired = predictionExpired(event, context);

  if (!movedUp && !movedDown) {
    if (!expired) {
      return {
        ...event.outcome,
        status: 'pending',
        note: `Value movement for ${event.entityName || 'this player'} is not meaningful yet (${delta >= 0 ? '+' : ''}${Math.round(delta)}).`,
      };
    }
    const note = `Value-movement window expired without a meaningful move (${delta >= 0 ? '+' : ''}${Math.round(delta)} value).`;
    return outcome('push', context, note, {
      actualValue: followUp,
      baselineValue: baseline,
      realizedEdge: buildAIRealizedEdge({
        predictedEdge: event.counterfactual?.edge ?? null,
        actualValue: followUp,
        baselineValue: baseline,
        baselineKind: baselineKind(event),
        source: movement.source || 'value:snapshot-movement',
        note,
        status: 'matched-baseline',
      }),
    });
  }

  const hit = negativeRead ? movedDown : positiveRead ? movedUp : movedUp;
  const direction = delta >= 0 ? `gained ${Math.round(delta)}` : `lost ${Math.abs(Math.round(delta))}`;
  const pctText = pct === null ? '' : ` (${pct >= 0 ? '+' : ''}${Math.round(pct * 10) / 10}%)`;
  const note = `${event.entityName || 'Player'} ${direction} value${pctText} from ${movement.baselineDate || 'baseline'} to ${movement.followUpDate || 'follow-up'}; ${negativeRead ? 'negative/sell/avoid reads want value to fall or fail to rise' : 'positive/buy reads want value to rise'}.`;

  return outcome(
    hit ? 'hit' : 'miss',
    context,
    note,
    {
      actualValue: followUp,
      baselineValue: baseline,
      realizedEdge: buildAIRealizedEdge({
        predictedEdge: event.counterfactual?.edge ?? null,
        actualValue: negativeRead ? baseline : followUp,
        baselineValue: negativeRead ? followUp : baseline,
        baselineKind: baselineKind(event),
        source: movement.source || 'value:snapshot-movement',
        note,
      }),
    }
  );
}

function resolveTrade(event: AIPredictionEvent, context: AIPredictionOutcomeResolverContext): AIPredictionOutcome | null {
  const relatedTrade = (context.transactions || []).find(transaction => {
    if (transaction.type !== 'trade') return false;
    if (sameEntity(event, transaction)) return true;
    const eventName = normalizeKey(event.entityName);
    return Boolean(eventName && normalizeKey(transaction.counterparty) && eventName.includes(normalizeKey(transaction.counterparty)));
  });
  if (!relatedTrade) return null;

  const valueDelta = Number(relatedTrade.valueDelta);
  if (Number.isFinite(valueDelta)) {
    const note = valueDelta >= 0 ? 'Completed trade beat the hold baseline by value delta.' : 'Completed trade trailed the hold baseline by value delta.';
    return outcome(
      valueDelta >= 0 ? 'hit' : 'miss',
      context,
      note,
      {
        actualValue: valueDelta,
        baselineValue: 0,
        realizedEdge: buildAIRealizedEdge({
          predictedEdge: event.counterfactual?.edge ?? null,
          actualValue: valueDelta,
          baselineValue: 0,
          baselineKind: baselineKind(event),
          source: `trade:${relatedTrade.counterparty || relatedTrade.manager || 'unknown'}`,
          note,
        }),
      }
    );
  }

  return outcome('hit', context, 'A related trade was completed after the read.', {
    realizedEdge: buildAIRealizedEdge({
      predictedEdge: event.counterfactual?.edge ?? null,
      actualValue: 1,
      baselineValue: 0,
      baselineKind: baselineKind(event),
      source: `trade:${relatedTrade.counterparty || relatedTrade.manager || 'unknown'}`,
      note: 'Trade converted, but no value delta was available.',
      status: 'action-only',
    }),
  });
}

function resolveStartSitOrStream(event: AIPredictionEvent, context: AIPredictionOutcomeResolverContext): AIPredictionOutcome | null {
  return resolvePlayerPerformanceRead(
    event,
    context,
    event.action === 'stream' ? 'stream:player-stats' : 'lineup:player-stats'
  );
}

function resolveHoldOrNoAction(event: AIPredictionEvent, context: AIPredictionOutcomeResolverContext): AIPredictionOutcome | null {
  if (!isFirmNoActionRead(event)) return null;
  const gradingWindow = getRecommendationGradingWindow(event);
  const waitsForFinalOutcomeEvidence = isLongHorizonRecommendationWindow(gradingWindow);

  const actedAgainstRead = findRelatedTransaction(event, context, ['add', 'drop', 'trade']);
  if (actedAgainstRead) {
    const performance = resolvePlayerPerformanceRead(event, context, `no-action:${actedAgainstRead.type}`);
    if (performance) return performance;

    return {
      ...event.outcome,
      status: 'pending',
      note: `A related ${actedAgainstRead.type} happened after the no-action read; waiting for production or value evidence before grading it.`,
    };
  }

  if (predictionExpired(event, context)) {
    if (waitsForFinalOutcomeEvidence) return null;
    const note = event.action === 'hold'
      ? 'Hold/no-action read was followed through until the recommendation expired.'
      : 'Do-not-chase read expired without a matching action against it.';
    return outcome('hit', context, note, {
      actualValue: 1,
      baselineValue: 0,
      realizedEdge: buildAIRealizedEdge({
        predictedEdge: event.counterfactual?.edge ?? null,
        actualValue: 1,
        baselineValue: 0,
        baselineKind: baselineKind(event),
        source: 'no-action:expiration',
        note,
        status: 'action-only',
      }),
    });
  }

  return null;
}

export function resolveAIPredictionOutcome(
  event: AIPredictionEvent,
  context: AIPredictionOutcomeResolverContext
): AIPredictionOutcome {
  if (event.outcome.status !== 'pending') return event.outcome;
  if (event.decision === 'blocked') {
    return outcome('blocked', context, 'Prediction was blocked at render time.');
  }

  const observedRecommendationOutcome = resolveObservedRecommendationOutcome(event, context);
  if (observedRecommendationOutcome) return observedRecommendationOutcome;

  const resolved =
    event.action === 'pickup' || event.action === 'stash'
      ? resolvePickupOrStash(event, context) || resolveValueMovementRead(event, context)
      : event.action === 'trade'
        ? resolveTrade(event, context)
        : event.action === 'start' || event.action === 'sit' || event.action === 'stream' || event.action === 'avoid'
          ? resolveStartSitOrStream(event, context) || resolveValueMovementRead(event, context)
          : event.action === 'watch' || event.action === 'hold'
            ? resolvePlayerPerformanceRead(event, context, 'player-detail:player-stats') || resolveValueMovementRead(event, context) || resolveHoldOrNoAction(event, context)
            : null;

  if (resolved) return resolved;

  const noActionResolved = resolveHoldOrNoAction(event, context);
  if (noActionResolved) return noActionResolved;

  const valueResolved = resolveValueMovementRead(event, context);
  if (valueResolved) return valueResolved;

  const pendingLongHorizonWindow = pendingLongHorizonWindowOutcome(event, context);
  if (pendingLongHorizonWindow) return pendingLongHorizonWindow;

  if (predictionExpired(event, context)) {
    return outcome('push', context, 'Prediction expired before enough outcome evidence was available.', {
      realizedEdge: buildAIRealizedEdge({
        predictedEdge: event.counterfactual?.edge ?? null,
        actualValue: null,
        baselineValue: null,
        baselineKind: baselineKind(event),
        source: 'expiration',
        note: 'Prediction expired before enough outcome evidence was available.',
        status: 'expired',
      }),
    });
  }

  return {
    ...event.outcome,
    status: 'pending',
    note: event.outcome.note || 'No matching outcome fact was available yet.',
  };
}
