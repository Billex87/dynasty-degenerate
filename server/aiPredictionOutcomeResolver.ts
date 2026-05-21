import type { AIPredictionEvent, AIPredictionOutcome } from './aiPredictionCalibration';
import { buildAIRealizedEdge, isAIPredictionExpired } from '../shared/aiDecisionSnapshots';

export type AIPredictionResolvedTransaction = {
  type: 'add' | 'drop' | 'trade';
  playerId?: string | null;
  playerName?: string | null;
  manager?: string | null;
  counterparty?: string | null;
  occurredAt?: string | null;
  valueDelta?: number | null;
};

export type AIPredictionResolvedPlayerStat = {
  playerId?: string | null;
  playerName?: string | null;
  fantasyPoints?: number | null;
  projectedFantasyPoints?: number | null;
  baselineFantasyPoints?: number | null;
  replacementFantasyPoints?: number | null;
  started?: boolean | null;
};

export type AIPredictionOutcomeResolverContext = {
  resolvedAt?: string | Date | null;
  transactions?: AIPredictionResolvedTransaction[];
  playerStats?: AIPredictionResolvedPlayerStat[];
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

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  const stat = (context.playerStats || []).find(row => sameEntity(event, row));
  if (!stat) return null;

  const actual = numeric(stat.fantasyPoints);
  if (actual === null) return null;
  const baseline = resolvedFantasyBaseline(event, stat);

  if (event.action === 'sit' || event.action === 'avoid') {
    const badGame = actual <= baseline;
    const note = badGame ? 'Avoid/sit read was supported by the actual result.' : 'Avoid/sit read missed because the player beat the baseline.';
    return outcome(
      badGame ? 'hit' : 'miss',
      context,
      note,
      {
        actualValue: actual,
        baselineValue: baseline,
        realizedEdge: realizedEdgeForEvent({
          event,
          actualValue: baseline,
          baselineValue: actual,
          source: 'lineup:player-stats',
          note,
        }),
      }
    );
  }

  const cleared = actual >= baseline;
  const note = cleared ? 'Start/stream read beat the actual-result baseline.' : 'Start/stream read missed the actual-result baseline.';
  return outcome(
    cleared ? 'hit' : 'miss',
    context,
    note,
    {
      actualValue: actual,
      baselineValue: baseline,
      realizedEdge: realizedEdgeForEvent({
        event,
        actualValue: actual,
        baselineValue: baseline,
        source: event.action === 'stream' ? 'stream:player-stats' : 'lineup:player-stats',
        note,
      }),
    }
  );
}

export function resolveAIPredictionOutcome(
  event: AIPredictionEvent,
  context: AIPredictionOutcomeResolverContext
): AIPredictionOutcome {
  if (event.outcome.status !== 'pending') return event.outcome;
  if (event.decision === 'blocked') {
    return outcome('blocked', context, 'Prediction was blocked at render time.');
  }

  const resolved =
    event.action === 'pickup' || event.action === 'stash'
      ? resolvePickupOrStash(event, context)
      : event.action === 'trade'
        ? resolveTrade(event, context)
        : event.action === 'start' || event.action === 'sit' || event.action === 'stream' || event.action === 'avoid'
          ? resolveStartSitOrStream(event, context)
          : null;

  if (resolved) return resolved;

  if (isAIPredictionExpired({ expiresAt: event.expiresAt || event.decay?.expiresAt, now: context.resolvedAt })) {
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
