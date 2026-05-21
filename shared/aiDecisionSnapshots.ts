export type AIDecisionSnapshotFactStatus =
  | "loaded"
  | "missing"
  | "stale"
  | "limited"
  | "blocked";

export type AIDecisionSnapshotFact = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  source?: string | null;
  status?: AIDecisionSnapshotFactStatus;
  detail?: string | null;
};

export type AIDecisionBaselineKind =
  | "do-nothing"
  | "replacement"
  | "highest-ranked-available"
  | "current-starter"
  | "market-default"
  | "manager-default"
  | "unknown";

export type AIDecisionBaseline = {
  kind: AIDecisionBaselineKind;
  label: string;
  score: number | null;
  source?: string | null;
  detail?: string | null;
};

export type AICounterfactualStatus =
  | "beats-baseline"
  | "near-baseline"
  | "below-baseline"
  | "missing-baseline"
  | "blocked";

export type AICounterfactualRead = {
  status: AICounterfactualStatus;
  baseline: AIDecisionBaseline;
  edge: number | null;
  confidenceImpact: "boost" | "neutral" | "penalty" | "block";
  reason: string;
};

export type AIPredictionDecayProfile = {
  expiresAt: string | null;
  decayWindowHours: number | null;
  reason: string;
};

export type AIRealizedEdgeStatus =
  | "beat-baseline"
  | "matched-baseline"
  | "trailed-baseline"
  | "action-only"
  | "expired"
  | "manual";

export type AIRealizedEdge = {
  status: AIRealizedEdgeStatus;
  predictedEdge: number | null;
  actualValue: number | null;
  baselineValue: number | null;
  realizedEdge: number | null;
  baselineKind: AIDecisionBaselineKind | "unknown";
  source: string;
  note: string;
};

export type AIDecisionSnapshot = {
  schemaVersion: 1;
  capturedAt: string;
  valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null;
  surface?: string | null;
  action?: string | null;
  entityName?: string | null;
  entityType?: string | null;
  finalScore: number;
  label: string;
  confidenceCap: number;
  confidenceCapReason?: string | null;
  facts: AIDecisionSnapshotFact[];
  baseline?: AIDecisionBaseline | null;
  counterfactual?: AICounterfactualRead | null;
};

function cleanText(value: unknown): string | null {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  return clean || null;
}

export function clampAIDecisionScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function toIsoDate(value?: string | Date | null): string | null {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function getAIPredictionDecayWindowHours(input: {
  surface?: string | null;
  action?: string | null;
}): number {
  const surface = String(input.surface || "").toLowerCase();
  const action = String(input.action || "").toLowerCase();
  if (action === "stream" || action === "start" || action === "sit") return 36;
  if (surface === "schedule" || action === "pickup" || action === "stash") return 72;
  if (action === "trade" || surface === "trade") return 14 * 24;
  if (surface === "owner-intel" || surface === "rankings" || surface === "overview") return 30 * 24;
  return 7 * 24;
}

export function buildAIPredictionDecayProfile(input: {
  createdAt: string | Date;
  surface?: string | null;
  action?: string | null;
  overrideHours?: number | null;
}): AIPredictionDecayProfile {
  const createdAt = new Date(input.createdAt);
  const decayWindowHours = Number.isFinite(Number(input.overrideHours)) && Number(input.overrideHours) > 0
    ? Math.round(Number(input.overrideHours))
    : getAIPredictionDecayWindowHours(input);
  if (!Number.isFinite(createdAt.getTime())) {
    return {
      expiresAt: null,
      decayWindowHours,
      reason: "No valid creation timestamp was available for decay.",
    };
  }

  return {
    expiresAt: new Date(createdAt.getTime() + decayWindowHours * 60 * 60 * 1000).toISOString(),
    decayWindowHours,
    reason: `${input.surface || "AI"} ${input.action || "read"} expires after ${decayWindowHours} hours unless outcome evidence resolves first.`,
  };
}

export function isAIPredictionExpired(input: {
  expiresAt?: string | Date | null;
  now?: string | Date | null;
}): boolean {
  const expiresAt = toIsoDate(input.expiresAt);
  if (!expiresAt) return false;
  const now = input.now ? new Date(input.now) : new Date();
  return Number.isFinite(now.getTime()) && now.getTime() > new Date(expiresAt).getTime();
}

export function buildAIRealizedEdge(input: {
  predictedEdge?: number | null;
  actualValue?: number | null;
  baselineValue?: number | null;
  baselineKind?: AIDecisionBaselineKind | "unknown" | null;
  source: string;
  note: string;
  status?: AIRealizedEdgeStatus | null;
}): AIRealizedEdge {
  const actualValue = Number(input.actualValue);
  const baselineValue = Number(input.baselineValue);
  const hasActual = Number.isFinite(actualValue);
  const hasBaseline = Number.isFinite(baselineValue);
  const realizedEdge = hasActual && hasBaseline
    ? Math.round((actualValue - baselineValue) * 10) / 10
    : null;
  const status = input.status || (
    realizedEdge === null
      ? "action-only"
      : realizedEdge > 0
        ? "beat-baseline"
        : realizedEdge === 0
          ? "matched-baseline"
          : "trailed-baseline"
  );

  return {
    status,
    predictedEdge: input.predictedEdge === null || input.predictedEdge === undefined || !Number.isFinite(Number(input.predictedEdge))
      ? null
      : Math.round(Number(input.predictedEdge) * 10) / 10,
    actualValue: hasActual ? Math.round(actualValue * 10) / 10 : null,
    baselineValue: hasBaseline ? Math.round(baselineValue * 10) / 10 : null,
    realizedEdge,
    baselineKind: input.baselineKind || "unknown",
    source: cleanText(input.source) || "unknown",
    note: cleanText(input.note) || "Outcome was resolved.",
  };
}

export function createAIDecisionFact(input: AIDecisionSnapshotFact): AIDecisionSnapshotFact {
  return {
    key: cleanText(input.key) || "unknown",
    label: cleanText(input.label) || "Unknown",
    value:
      typeof input.value === "number"
        ? Math.round(input.value * 10) / 10
        : typeof input.value === "boolean"
          ? input.value
          : cleanText(input.value),
    source: cleanText(input.source),
    status: input.status || "loaded",
    detail: cleanText(input.detail),
  };
}

export function createAIDecisionBaseline(input: AIDecisionBaseline): AIDecisionBaseline {
  return {
    kind: input.kind || "unknown",
    label: cleanText(input.label) || "Unknown baseline",
    score: input.score === null || input.score === undefined
      ? null
      : clampAIDecisionScore(input.score),
    source: cleanText(input.source),
    detail: cleanText(input.detail),
  };
}

export function buildAICounterfactualRead(input: {
  aiScore: number;
  baseline: AIDecisionBaseline;
  blocked?: boolean;
}): AICounterfactualRead {
  const baseline = createAIDecisionBaseline(input.baseline);
  if (input.blocked) {
    return {
      status: "blocked",
      baseline,
      edge: null,
      confidenceImpact: "block",
      reason: "The read was blocked before comparing against a baseline.",
    };
  }

  if (baseline.score === null) {
    return {
      status: "missing-baseline",
      baseline,
      edge: null,
      confidenceImpact: "penalty",
      reason: "No comparable baseline score was available, so the read cannot claim an edge.",
    };
  }

  const aiScore = clampAIDecisionScore(input.aiScore);
  const edge = Math.round((aiScore - baseline.score) * 10) / 10;
  if (edge >= 8) {
    return {
      status: "beats-baseline",
      baseline,
      edge,
      confidenceImpact: "boost",
      reason: `AI beat the ${baseline.label} baseline by ${edge} points.`,
    };
  }

  if (edge >= 0) {
    return {
      status: "near-baseline",
      baseline,
      edge,
      confidenceImpact: "neutral",
      reason: `AI was only ${edge} points ahead of the ${baseline.label} baseline.`,
    };
  }

  return {
    status: "below-baseline",
    baseline,
    edge,
    confidenceImpact: "penalty",
    reason: `AI trailed the ${baseline.label} baseline by ${Math.abs(edge)} points.`,
  };
}

export function buildAIDecisionSnapshot(input: {
  capturedAt: string;
  valueMode?: AIDecisionSnapshot["valueMode"];
  surface?: string | null;
  action?: string | null;
  entityName?: string | null;
  entityType?: string | null;
  finalScore: number;
  label: string;
  confidenceCap: number;
  confidenceCapReason?: string | null;
  facts?: Array<AIDecisionSnapshotFact | null | undefined>;
  counterfactual?: AICounterfactualRead | null;
}): AIDecisionSnapshot {
  const counterfactual = input.counterfactual || null;
  return {
    schemaVersion: 1,
    capturedAt: input.capturedAt,
    valueMode: input.valueMode || "unknown",
    surface: cleanText(input.surface),
    action: cleanText(input.action),
    entityName: cleanText(input.entityName),
    entityType: cleanText(input.entityType),
    finalScore: clampAIDecisionScore(input.finalScore),
    label: cleanText(input.label) || "unknown",
    confidenceCap: clampAIDecisionScore(input.confidenceCap),
    confidenceCapReason: cleanText(input.confidenceCapReason),
    facts: (input.facts || [])
      .filter((fact): fact is AIDecisionSnapshotFact => Boolean(fact))
      .map(createAIDecisionFact)
      .slice(0, 16),
    baseline: counterfactual?.baseline || null,
    counterfactual,
  };
}
