import type { ReportData } from "../shared/types";

type ReportAccessInput = {
  canViewSourceTraceDetails: boolean;
  canViewAiConfidenceHistory: boolean;
};

type SanitizerStats = {
  removedSourceTraceFields: number;
  removedTraceSummaryFields: number;
  removedAiConfidenceHistoryFields: number;
  retainedSourceTraceFields: number;
  retainedTraceSummaryFields: number;
  retainedAiConfidenceHistoryFields: number;
};

type SanitizerResult<T> = {
  payload: T;
  stats: SanitizerStats;
};

function createStats(): SanitizerStats {
  return {
    removedSourceTraceFields: 0,
    removedTraceSummaryFields: 0,
    removedAiConfidenceHistoryFields: 0,
    retainedSourceTraceFields: 0,
    retainedTraceSummaryFields: 0,
    retainedAiConfidenceHistoryFields: 0,
  };
}

function hasChanges(stats: SanitizerStats): boolean {
  return stats.removedSourceTraceFields > 0 ||
    stats.removedTraceSummaryFields > 0 ||
    stats.removedAiConfidenceHistoryFields > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isSourceTraceDetailKey(key: string): boolean {
  return key === "sourceTrace" || key === "sourceTraceText";
}

function sanitizeValue(value: unknown, access: ReportAccessInput, stats: SanitizerStats): unknown {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const sanitized = sanitizeValue(item, access, stats);
      if (sanitized !== item) changed = true;
      return sanitized;
    });
    return changed ? next : value;
  }

  const record = value as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = {};
  const isAiConfidenceRecord =
    "signals" in record &&
    "score" in record &&
    "label" in record &&
    Array.isArray(record.signals);

  for (const [key, child] of Object.entries(record)) {
    if (!access.canViewSourceTraceDetails && isSourceTraceDetailKey(key)) {
      stats.removedSourceTraceFields += 1;
      changed = true;
      continue;
    }

    if (access.canViewSourceTraceDetails && isSourceTraceDetailKey(key)) {
      stats.retainedSourceTraceFields += 1;
    }

    if (!access.canViewSourceTraceDetails && key === "traceSummary") {
      stats.removedTraceSummaryFields += 1;
      changed = true;
      continue;
    }

    if (access.canViewSourceTraceDetails && key === "traceSummary") {
      stats.retainedTraceSummaryFields += 1;
    }

    if (!access.canViewAiConfidenceHistory && isAiConfidenceRecord && key === "history") {
      stats.removedAiConfidenceHistoryFields += 1;
      changed = true;
      continue;
    }

    if (access.canViewAiConfidenceHistory && isAiConfidenceRecord && key === "history") {
      stats.retainedAiConfidenceHistoryFields += 1;
    }

    const sanitized = sanitizeValue(child, access, stats);
    next[key] = sanitized;
    if (sanitized !== child) changed = true;
  }

  return changed ? next : value;
}

export function sanitizeReportDataForPaidAccess<T extends ReportData>(
  reportData: T,
  access: ReportAccessInput
): SanitizerResult<T> {
  const stats = createStats();
  const payload = sanitizeValue(reportData, access, stats) as T;
  return {
    payload: hasChanges(stats) ? payload : reportData,
    stats,
  };
}

export function sanitizeLeagueReportPayloadForPaidAccess<T>(
  payload: T,
  access: ReportAccessInput
): SanitizerResult<T> {
  if (!isRecord(payload) || !isRecord(payload.reportData)) {
    return {
      payload,
      stats: createStats(),
    };
  }

  const result = sanitizeReportDataForPaidAccess(payload.reportData as unknown as ReportData, access);
  if (!hasChanges(result.stats)) {
    return {
      payload,
      stats: result.stats,
    };
  }

  return {
    payload: {
      ...payload,
      reportData: result.payload,
    } as T,
    stats: result.stats,
  };
}
