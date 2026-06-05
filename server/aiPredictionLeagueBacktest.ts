import type { AIPredictionEvent, AIPredictionOutcomeStatus } from './aiPredictionCalibration';

export type AIPredictionBacktestModule =
  | 'faab-patterns'
  | 'draft-paths'
  | 'trade-activity'
  | 'waiver-volume'
  | 'start-sit-decisions'
  | 'prospect-stashes'
  | 'roster-construction'
  | 'other';

export type AIPredictionBacktestConfidenceAction =
  | 'eligible-to-raise'
  | 'hold-sample-size'
  | 'hold-no-baseline-edge'
  | 'lower-confidence'
  | 'monitor';

export type AIPredictionBacktestRow = {
  key: string;
  leagueId: string;
  module: AIPredictionBacktestModule | 'all';
  eventCount: number;
  scoredCount: number;
  pendingCount: number;
  hitCount: number;
  missCount: number;
  pushCount: number;
  blockedCount: number;
  avgConfidence: number | null;
  modelHitRate: number | null;
  baselineComparisonCount: number;
  modelBeatBaselineCount: number;
  baselineBeatModelCount: number;
  matchedBaselineCount: number;
  modelBaselineWinRate: number | null;
  baselineWinRate: number | null;
  confidenceAction: AIPredictionBacktestConfidenceAction;
  note: string;
};

export type AIPredictionLeagueBacktestSummary = {
  schemaVersion: 1;
  generatedFrom: 'ai-prediction-events';
  generatedAt: string;
  eventCount: number;
  scoredCount: number;
  pendingCount: number;
  rows: AIPredictionBacktestRow[];
};

type MutableBacktestRow = Omit<
  AIPredictionBacktestRow,
  | 'avgConfidence'
  | 'modelHitRate'
  | 'modelBaselineWinRate'
  | 'baselineWinRate'
  | 'confidenceAction'
  | 'note'
> & {
  confidenceTotal: number;
  confidenceCount: number;
};

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function lowerText(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function eventText(event: AIPredictionEvent): string {
  return [
    event.surface,
    event.action,
    event.decision,
    event.entityType,
    event.entityName,
    event.metadata?.source,
    event.metadata?.recommendationType,
    event.metadata?.actionText,
    event.metadata?.archetypeKey,
    event.metadata?.archetypeLabel,
    event.metadata?.draftKind,
    event.whyThisFired,
    ...event.evidence,
  ].map(lowerText).filter(Boolean).join(' ');
}

export function classifyAIPredictionBacktestModule(event: AIPredictionEvent): AIPredictionBacktestModule {
  const text = eventText(event);
  if (/\b(faab|bid|bid range|waiver budget|winning bid)\b/.test(text)) return 'faab-patterns';
  if (/\b(draft path|draft grade|draft pick|rookie draft|startup draft|adp|draft capital)\b/.test(text)) return 'draft-paths';
  if (event.surface === 'trade' || event.action === 'trade' || /\b(trade|counter|offer|accept|reject)\b/.test(text)) return 'trade-activity';
  if (event.action === 'start' || event.action === 'sit' || event.action === 'stream' || /\b(start\/sit|lineup|starter|bench|stream)\b/.test(text)) return 'start-sit-decisions';
  if (/\b(prospect|stash|taxi|rookie stash|development stash)\b/.test(text)) return 'prospect-stashes';
  if (/\b(roster construction|standings|playoff|points for|points-for|title|championship|league winner)\b/.test(text)) return 'roster-construction';
  if (event.surface === 'waiver' || event.action === 'pickup' || event.action === 'stash') return 'waiver-volume';
  return 'other';
}

function scoredStatus(status: AIPredictionOutcomeStatus): boolean {
  return status === 'hit' || status === 'miss' || status === 'push' || status === 'blocked';
}

function roundedPct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function roundedAverage(total: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((total / count) * 10) / 10;
}

function createMutableRow(key: string, leagueId: string, module: AIPredictionBacktestRow['module']): MutableBacktestRow {
  return {
    key,
    leagueId,
    module,
    eventCount: 0,
    scoredCount: 0,
    pendingCount: 0,
    hitCount: 0,
    missCount: 0,
    pushCount: 0,
    blockedCount: 0,
    confidenceTotal: 0,
    confidenceCount: 0,
    baselineComparisonCount: 0,
    modelBeatBaselineCount: 0,
    baselineBeatModelCount: 0,
    matchedBaselineCount: 0,
  };
}

function addEvent(row: MutableBacktestRow, event: AIPredictionEvent) {
  row.eventCount += 1;
  const confidence = Number(event.finalScore);
  if (Number.isFinite(confidence)) {
    row.confidenceTotal += confidence;
    row.confidenceCount += 1;
  }

  const status = event.outcome.status;
  if (status === 'pending') row.pendingCount += 1;
  if (status === 'hit') row.hitCount += 1;
  if (status === 'miss') row.missCount += 1;
  if (status === 'push') row.pushCount += 1;
  if (status === 'blocked') row.blockedCount += 1;
  if (scoredStatus(status)) row.scoredCount += 1;

  const edgeStatus = event.outcome.realizedEdge?.status || null;
  if (edgeStatus === 'beat-baseline') {
    row.baselineComparisonCount += 1;
    row.modelBeatBaselineCount += 1;
  } else if (edgeStatus === 'trailed-baseline') {
    row.baselineComparisonCount += 1;
    row.baselineBeatModelCount += 1;
  } else if (edgeStatus === 'matched-baseline') {
    row.baselineComparisonCount += 1;
    row.matchedBaselineCount += 1;
  }
}

function confidenceAction(row: MutableBacktestRow): {
  confidenceAction: AIPredictionBacktestConfidenceAction;
  note: string;
} {
  const modelHitRate = roundedPct(row.hitCount, row.hitCount + row.missCount);
  if (row.scoredCount < 10 || row.baselineComparisonCount < 5) {
    return {
      confidenceAction: 'hold-sample-size',
      note: 'Hold confidence changes until this bucket has at least 10 scored events and 5 baseline comparisons.',
    };
  }
  if (modelHitRate !== null && modelHitRate < 45) {
    return {
      confidenceAction: 'lower-confidence',
      note: `Model hit rate is ${modelHitRate}%, so confidence should move down before any raise is considered.`,
    };
  }
  if (row.baselineBeatModelCount > row.modelBeatBaselineCount) {
    return {
      confidenceAction: 'lower-confidence',
      note: 'Simple baseline beat the model more often than the model beat the baseline.',
    };
  }
  if (row.modelBeatBaselineCount <= row.baselineBeatModelCount + row.matchedBaselineCount) {
    return {
      confidenceAction: 'hold-no-baseline-edge',
      note: 'Model outcomes have not yet beaten the simple baseline by a clear margin.',
    };
  }
  if (modelHitRate !== null && modelHitRate >= 55) {
    return {
      confidenceAction: 'eligible-to-raise',
      note: 'Bucket has enough scored samples, clears hit-rate floor, and beats the simple baseline.',
    };
  }
  return {
    confidenceAction: 'monitor',
    note: 'Bucket has samples, but the model edge is not strong enough for a confidence increase.',
  };
}

function finalizeRow(row: MutableBacktestRow): AIPredictionBacktestRow {
  const action = confidenceAction(row);
  return {
    key: row.key,
    leagueId: row.leagueId,
    module: row.module,
    eventCount: row.eventCount,
    scoredCount: row.scoredCount,
    pendingCount: row.pendingCount,
    hitCount: row.hitCount,
    missCount: row.missCount,
    pushCount: row.pushCount,
    blockedCount: row.blockedCount,
    avgConfidence: roundedAverage(row.confidenceTotal, row.confidenceCount),
    modelHitRate: roundedPct(row.hitCount, row.hitCount + row.missCount),
    baselineComparisonCount: row.baselineComparisonCount,
    modelBeatBaselineCount: row.modelBeatBaselineCount,
    baselineBeatModelCount: row.baselineBeatModelCount,
    matchedBaselineCount: row.matchedBaselineCount,
    modelBaselineWinRate: roundedPct(row.modelBeatBaselineCount, row.baselineComparisonCount),
    baselineWinRate: roundedPct(row.baselineBeatModelCount, row.baselineComparisonCount),
    confidenceAction: action.confidenceAction,
    note: action.note,
  };
}

function rowSortValue(row: AIPredictionBacktestRow): number {
  const actionPriority =
    row.confidenceAction === 'lower-confidence' ? 5 :
      row.confidenceAction === 'eligible-to-raise' ? 4 :
        row.confidenceAction === 'hold-no-baseline-edge' ? 3 :
          row.confidenceAction === 'monitor' ? 2 : 1;
  return actionPriority * 100000 + row.scoredCount * 100 + row.baselineComparisonCount;
}

export function buildLeagueWidePredictionBacktest(
  events: AIPredictionEvent[],
  options: { limit?: number } = {}
): AIPredictionLeagueBacktestSummary {
  const limit = Math.max(1, Math.min(Number(options.limit) || 80, 200));
  const rows = new Map<string, MutableBacktestRow>();
  const getRow = (key: string, leagueId: string, module: AIPredictionBacktestRow['module']) => {
    const existing = rows.get(key);
    if (existing) return existing;
    const row = createMutableRow(key, leagueId, module);
    rows.set(key, row);
    return row;
  };

  events.forEach((event) => {
    const leagueId = cleanText(event.leagueId) || 'global';
    const module = classifyAIPredictionBacktestModule(event);
    addEvent(getRow('all', 'all', 'all'), event);
    addEvent(getRow(`module:${module}`, 'all', module), event);
    addEvent(getRow(`league:${leagueId}`, leagueId, 'all'), event);
    addEvent(getRow(`league-module:${leagueId}:${module}`, leagueId, module), event);
  });

  const finalizedRows = Array.from(rows.values())
    .map(finalizeRow)
    .sort((a, b) => rowSortValue(b) - rowSortValue(a) || a.key.localeCompare(b.key))
    .slice(0, limit);
  const global = finalizedRows.find(row => row.key === 'all') || finalizeRow(createMutableRow('all', 'all', 'all'));

  return {
    schemaVersion: 1,
    generatedFrom: 'ai-prediction-events',
    generatedAt: new Date().toISOString(),
    eventCount: global.eventCount,
    scoredCount: global.scoredCount,
    pendingCount: global.pendingCount,
    rows: finalizedRows,
  };
}
