import type {
  AIEvidenceAction,
  AIEvidencePenalty,
  AIEvidenceResult,
  AIEvidenceSurface,
  AIConfidenceLabel,
  AISourceTrace,
} from "@shared/aiEvidenceEngine";
import {
  buildAICounterfactualRead,
  buildAIDecisionSnapshot,
  buildAIPredictionDecayProfile,
  clampAIDecisionScore,
  createAIDecisionBaseline,
  type AICounterfactualRead,
  type AIDecisionBaseline,
  type AIDecisionSnapshot,
  type AIDecisionSnapshotFact,
  type AIPredictionDecayProfile,
  type AIRealizedEdge,
} from "@shared/aiDecisionSnapshots";
import type { ReportData, TrendingPlayer, WaiverWeeklyEcrTarget } from "@shared/types";
import { buildAutopilotData } from "@/lib/autopilot/buildAutopilotData";
import { AUTOPILOT_MOCK_DATA } from "@/lib/autopilot/mockData";
import type { AIActionQueueItem, AutopilotMode, AutopilotRecommendation } from "@/lib/autopilot/types";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { buildScheduleEdgeRows, type ScheduleEdgeRow } from "@/lib/scheduleEdgeRows";

export type ClientAIPredictionDecision = "do" | "dont" | "watch" | "hold" | "blocked";
export type ClientAIPredictionOutcomeStatus = "hit" | "miss" | "push" | "pending" | "blocked";

export type ClientAIPredictionEvent = {
  schemaVersion: 1;
  eventId: string;
  predictionKey: string;
  createdAt: string;
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  decision: ClientAIPredictionDecision;
  entityType: "player" | "team" | "manager" | "league" | "trade" | "lineup" | "schedule" | "unknown";
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
  sourceAgreement: null;
  decisionSnapshot?: AIDecisionSnapshot | null;
  counterfactual?: AICounterfactualRead | null;
  decay?: AIPredictionDecayProfile | null;
  expiresAt?: string | null;
  whyThisFired: string;
  outcome: {
    status: ClientAIPredictionOutcomeStatus;
    resolvedAt?: string | null;
    actualValue?: number | null;
    baselineValue?: number | null;
    realizedEdge?: AIRealizedEdge | null;
    feedbackSource?: "system" | "user" | "admin" | null;
    note?: string | null;
  };
  metadata?: Record<string, unknown>;
};

export type BuildAIPredictionEventsForReportInput = {
  reportData?: ReportData | null;
  leagueId?: string | null;
  leagueName?: string | null;
  manager?: string | null;
  createdAt?: string | Date | null;
};

function cleanText(value: unknown): string | null {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  return clean || null;
}

function clampPercent(value: unknown): number {
  return clampAIDecisionScore(value);
}

function hashText(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function getReportCreatedAt(reportData: ReportData, fallback?: string | Date | null): string {
  const candidate =
    fallback ||
    reportData.depthChartDiagnostics?.generatedAt ||
    reportData.transactionBackfillDiagnostics?.generatedAt ||
    reportData.prospectSourceDiagnostics?.generatedAt ||
    reportData.leagueDiagnostics?.aiConfidence?.history?.at(-1)?.generatedAt ||
    null;
  const parsed = candidate ? new Date(candidate) : null;
  if (parsed && Number.isFinite(parsed.getTime())) return parsed.toISOString();

  const season = reportData.leagueDiagnostics?.currentSeason || new Date().getFullYear();
  const week = reportData.leagueDiagnostics?.currentWeek || "offseason";
  return `${season}-W${week}`;
}

function getReportRunKey(reportData: ReportData, leagueId?: string | null): string {
  return [
    cleanText(leagueId) || "league",
    reportData.leagueDiagnostics?.currentSeason || "season",
    reportData.leagueDiagnostics?.currentWeek || "offseason",
    reportData.leagueDiagnostics?.aiConfidence?.score ?? "ai",
    reportData.recentTransactions?.[0]?.id || "tx",
    reportData.waiverIntelligence?.weeklyEcrTargets?.[0]?.player?.player_id || "waiver",
  ].join(":");
}

function labelFromScore(score: number): AIConfidenceLabel {
  if (score >= 84) return "high conviction";
  if (score >= 72) return "priority";
  if (score >= 58) return "actionable";
  if (score >= 42) return "watchlist";
  return "thin";
}

function parseRankNumber(rank?: string | number | null): number | null {
  if (rank === null || rank === undefined) return null;
  const parsed = String(rank).match(/\d+/)?.[0];
  if (!parsed) return null;
  const numeric = Number(parsed);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function positionRankLimit(position?: string | null): number {
  const pos = String(position || "").toUpperCase();
  if (pos === "QB") return 36;
  if (pos === "RB") return 84;
  if (pos === "WR") return 108;
  if (pos === "TE") return 42;
  if (pos === "K" || pos === "DEF" || pos === "DST" || pos === "D/ST") return 24;
  return 96;
}

function scoreFromRank(rank?: string | number | null, position?: string | null): number | null {
  const rankNumber = parseRankNumber(rank);
  if (!rankNumber) return null;
  const limit = positionRankLimit(position);
  const score = 96 - ((rankNumber - 1) / limit) * 58;
  return clampPercent(score);
}

function scoreFromValue(value?: number | null): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return clampPercent(34 + Math.min(58, numeric / 120));
}

function marketBaselineScore(player: TrendingPlayer): number | null {
  const rankScore = scoreFromRank(
    player.currentPositionRank || player.weeklyEcr?.bestPositionRank || player.weeklyEcr?.bestRankEcr,
    player.pos
  );
  const valueScore = scoreFromValue(player.ktcValue);
  const trendScore = player.count ? clampPercent(42 + Math.min(28, player.count / 30)) : null;
  const scores = [rankScore, valueScore, trendScore].filter((score): score is number => score !== null);
  if (!scores.length) return null;
  return clampPercent(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function formatBaselineLabel(value: number | null): string {
  return value === null ? "n/a" : `${value}%`;
}

function snapshotFact(input: AIDecisionSnapshotFact | null | undefined): AIDecisionSnapshotFact | null {
  if (!input) return null;
  if (input.value === null || input.value === undefined || input.value === "") return null;
  return input;
}

function counterfactualPenalty(counterfactual?: AICounterfactualRead | null): AIEvidencePenalty[] {
  if (!counterfactual) return [];
  if (counterfactual.status === "below-baseline") {
    return [{ label: counterfactual.reason, points: Math.min(18, Math.max(6, Math.abs(counterfactual.edge || 0))) }];
  }
  if (counterfactual.status === "near-baseline") {
    return [{ label: counterfactual.reason, points: 4 }];
  }
  if (counterfactual.status === "missing-baseline") {
    return [{ label: counterfactual.reason, points: 6 }];
  }
  return [];
}

function decisionAfterCounterfactual(
  decision: ClientAIPredictionDecision,
  counterfactual?: AICounterfactualRead | null
): ClientAIPredictionDecision {
  if (decision !== "do" || !counterfactual) return decision;
  return counterfactual.status === "beats-baseline" ? decision : "watch";
}

function scoreAfterCounterfactual(score: number, counterfactual?: AICounterfactualRead | null): number {
  if (!counterfactual) return clampPercent(score);
  if (counterfactual.status === "below-baseline") return Math.min(clampPercent(score), 57);
  if (counterfactual.status === "near-baseline") return Math.min(clampPercent(score), 63);
  if (counterfactual.status === "missing-baseline") return Math.min(clampPercent(score), 58);
  return clampPercent(score);
}

function actionFromQueueItem(item: AIActionQueueItem): AIEvidenceAction {
  if (item.decision === "blocked") return "avoid";
  if (item.source === "waiver") return /stash/i.test(item.action) ? "stash" : "pickup";
  if (item.source === "lineup") return /sit/i.test(item.action) ? "sit" : "start";
  if (item.source === "trade") return "trade";
  if (item.decision === "hold") return "hold";
  return "watch";
}

function decisionFromQueueItem(item: AIActionQueueItem): ClientAIPredictionDecision {
  if (item.decision === "do") return "do";
  if (item.decision === "watch") return "watch";
  if (item.decision === "blocked") return "blocked";
  return "hold";
}

function actionFromRecommendation(recommendation: AutopilotRecommendation, fallback: AIEvidenceAction): AIEvidenceAction {
  const action = `${recommendation.action} ${recommendation.type}`.toLowerCase();
  if (/trade/.test(action)) return "trade";
  if (/stash/.test(action)) return "stash";
  if (/start/.test(action)) return "start";
  if (/sit|bench/.test(action)) return "sit";
  if (/avoid/.test(action)) return "avoid";
  if (/hold/.test(action)) return "hold";
  if (/stream/.test(action)) return "stream";
  if (/pickup|add|claim|waiver/.test(action)) return "pickup";
  return fallback;
}

function decisionFromEvidence(read: AIEvidenceResult, fallbackScore: number): ClientAIPredictionDecision {
  if (read.label === "blocked" || read.hardBlockers.length) return "blocked";
  if (!read.canAct) return read.label === "thin" ? "dont" : "watch";
  if (fallbackScore >= 58) return "do";
  return "watch";
}

function sourceTraceFromStrings(values: string[]): AISourceTrace[] {
  return values.slice(0, 8).map(value => ({
    label: value,
    status: /missing|stale|error|limited|blocked|rough/i.test(value)
      ? "limited"
      : "loaded",
  }));
}

function sourceTraceFromWaiverPlayer(player: TrendingPlayer): AISourceTrace[] {
  const trace = player.weeklyEcr?.sourceTrace || [];
  if (trace.length) {
    return trace.slice(0, 8).map(item => ({
      label: item.endpointLabel || item.source || item.sourceKey || "Waiver source",
      status:
        item.status === "loaded" ||
        item.status === "stale" ||
        item.status === "missing" ||
        item.status === "error" ||
        item.status === "limited"
          ? item.status
          : "loaded",
      detail: item.evidence || item.endpointKey || null,
    }));
  }

  return sourceTraceFromStrings([
    player.weeklyEcr?.source || "Sleeper availability",
    player.owner ? `Owned by ${player.owner}` : "Available player pool",
  ]);
}

function buildCounterfactual(input: {
  aiScore: number;
  baseline: AIDecisionBaseline;
  blocked?: boolean;
}): AICounterfactualRead {
  return buildAICounterfactualRead({
    aiScore: input.aiScore,
    baseline: createAIDecisionBaseline(input.baseline),
    blocked: input.blocked,
  });
}

function baselineForQueueItem(item: AIActionQueueItem): AIDecisionBaseline {
  if (item.source === "trade") {
    return {
      kind: "manager-default",
      label: "no-trade manager default",
      score: 50,
      source: "counterfactual",
      detail: "Trade advice has to beat the neutral no-trade baseline before it stays actionable.",
    };
  }
  if (item.source === "lineup") {
    return {
      kind: "current-starter",
      label: "current lineup default",
      score: 56,
      source: "counterfactual",
      detail: "Lineup advice has to beat leaving the current lineup alone.",
    };
  }
  if (item.source === "waiver") {
    return {
      kind: "replacement",
      label: "replacement waiver option",
      score: 52,
      source: "counterfactual",
      detail: "Waiver advice has to beat a generic replacement-level pickup.",
    };
  }
  return {
    kind: "do-nothing",
    label: "do-nothing default",
    score: 50,
    source: "counterfactual",
    detail: "Strategy advice has to beat no immediate move.",
  };
}

function baselineForRecommendation(
  recommendation: AutopilotRecommendation,
  source: "waiver" | "trade"
): AIDecisionBaseline {
  if (source === "trade") {
    return {
      kind: "manager-default",
      label: "no-trade manager default",
      score: 50,
      source: "counterfactual",
      detail: "Trade recommendation compared against holding the roster as-is.",
    };
  }

  const evidenceScore = recommendation.evidenceRead?.finalScore ?? recommendation.confidence;
  return {
    kind: "replacement",
    label: "replacement waiver option",
    score: Math.min(64, Math.max(48, evidenceScore - 10)),
    source: "counterfactual",
    detail: "Waiver recommendation compared against a replacement-level add.",
  };
}

function highestAvailableWaiverBaseline(candidates: TrendingPlayer[]): AIDecisionBaseline {
  const scored = candidates
    .map(player => ({
      player,
      score: marketBaselineScore(player),
    }))
    .filter((row): row is { player: TrendingPlayer; score: number } => row.score !== null)
    .sort((a, b) => b.score - a.score || (b.player.ktcValue || 0) - (a.player.ktcValue || 0));
  const best = scored[0];

  return {
    kind: "highest-ranked-available",
    label: "highest-ranked available",
    score: best?.score ?? null,
    source: "rank/value baseline",
    detail: best
      ? `${best.player.name} was the strongest boring rank/value option at ${formatBaselineLabel(best.score)}.`
      : "No available player had enough rank or value data to build a boring baseline.",
  };
}

function baselineForScheduleRow(row: ScheduleEdgeRow): AIDecisionBaseline {
  const rankScore = scoreFromRank(row.currentRank || row.bestRank, row.position);
  const marketScore = marketBaselineScore(row.player);
  const score = rankScore ?? marketScore ?? null;
  return {
    kind: row.position === "K" || row.position === "DEF" ? "replacement" : "market-default",
    label: row.position === "K" || row.position === "DEF" ? "replacement streamer" : "rank/value default",
    score,
    source: row.currentRank ? "current rank" : row.bestRank ? "schedule rank" : "market value",
    detail: score === null
      ? "No rank/value baseline was available for this schedule read."
      : `Baseline score ${formatBaselineLabel(score)} from ${row.currentRank || row.bestRank || "market value"}.`,
  };
}

function makePredictionKey(input: {
  leagueId?: string | null;
  manager?: string | null;
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  entityType: ClientAIPredictionEvent["entityType"];
  entityId?: string | null;
  season?: string | null;
  week?: number | null;
}) {
  return [
    input.surface,
    input.action,
    cleanText(input.leagueId) || "global",
    cleanText(input.manager) || "all",
    input.entityType,
    cleanText(input.entityId) || "unknown",
    cleanText(input.season) || "season",
    input.week || "week",
  ].join(":");
}

function buildEvent(input: {
  reportRunKey: string;
  createdAt: string;
  valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | null;
  week?: number | null;
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  decision: ClientAIPredictionDecision;
  entityType: ClientAIPredictionEvent["entityType"];
  entityId?: string | null;
  entityName?: string | null;
  label?: AIConfidenceLabel;
  finalScore: number;
  confidenceCap?: number | null;
  confidenceCapReason?: string | null;
  evidence?: string[];
  missingEvidence?: string[];
  hardBlockers?: string[];
  softPenalties?: AIEvidencePenalty[];
  sourceTrace?: AISourceTrace[];
  decisionSnapshotFacts?: Array<AIDecisionSnapshotFact | null | undefined>;
  counterfactual?: AICounterfactualRead | null;
  whyThisFired?: string | null;
  metadata?: Record<string, unknown>;
}): ClientAIPredictionEvent {
  const counterfactual = input.counterfactual || null;
  const finalScore = scoreAfterCounterfactual(input.finalScore, counterfactual);
  const decision = decisionAfterCounterfactual(input.decision, counterfactual);
  const label = input.label || labelFromScore(finalScore);
  const confidenceCap = clampPercent(input.confidenceCap ?? 100);
  const decisionSnapshot = buildAIDecisionSnapshot({
    capturedAt: input.createdAt,
    valueMode: input.valueMode || "unknown",
    surface: input.surface,
    action: input.action,
    entityName: input.entityName,
    entityType: input.entityType,
    finalScore,
    label,
    confidenceCap,
    confidenceCapReason: input.confidenceCapReason,
    facts: input.decisionSnapshotFacts,
    counterfactual,
  });
  const decay = buildAIPredictionDecayProfile({
    createdAt: input.createdAt,
    surface: input.surface,
    action: input.action,
  });
  const predictionKey = makePredictionKey(input);
  const eventId = `ai-${hashText(`${input.reportRunKey}:${predictionKey}:${decision}:${finalScore}`)}`;
  return {
    schemaVersion: 1,
    eventId,
    predictionKey,
    createdAt: input.createdAt,
    surface: input.surface,
    action: input.action,
    decision,
    entityType: input.entityType,
    entityId: cleanText(input.entityId),
    entityName: cleanText(input.entityName),
    leagueId: cleanText(input.leagueId),
    manager: cleanText(input.manager),
    season: cleanText(input.season),
    week: input.week ?? null,
    label,
    finalScore,
    confidenceCap,
    confidenceCapReason: cleanText(input.confidenceCapReason),
    evidence: (input.evidence || []).slice(0, 8),
    missingEvidence: (input.missingEvidence || []).slice(0, 8),
    hardBlockers: (input.hardBlockers || []).slice(0, 8),
    softPenalties: [...counterfactualPenalty(counterfactual), ...(input.softPenalties || [])].slice(0, 8),
    sourceTrace: (input.sourceTrace || []).slice(0, 8),
    sourceAgreement: null,
    decisionSnapshot,
    counterfactual,
    decay,
    expiresAt: decay.expiresAt,
    whyThisFired: cleanText(input.whyThisFired) || "AI read was rendered with traceable evidence.",
    outcome: {
      status: decision === "blocked" ? "blocked" : "pending",
      baselineValue: counterfactual?.baseline.score ?? null,
      feedbackSource: "system",
    },
    metadata: input.metadata,
  };
}

function buildEventFromEvidence(input: {
  read: AIEvidenceResult;
  reportRunKey: string;
  createdAt: string;
  valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | null;
  week?: number | null;
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  entityType: ClientAIPredictionEvent["entityType"];
  entityId?: string | null;
  entityName?: string | null;
  decisionSnapshotFacts?: Array<AIDecisionSnapshotFact | null | undefined>;
  counterfactual?: AICounterfactualRead | null;
  metadata?: Record<string, unknown>;
}): ClientAIPredictionEvent {
  return buildEvent({
    ...input,
    decision: decisionFromEvidence(input.read, input.read.finalScore),
    label: input.read.label,
    finalScore: input.read.finalScore,
    confidenceCap: input.read.confidenceCap,
    confidenceCapReason: input.read.confidenceCapReason,
    evidence: input.read.evidence,
    missingEvidence: input.read.missingEvidence,
    hardBlockers: input.read.hardBlockers,
    softPenalties: input.read.softPenalties,
    sourceTrace: input.read.sourceTrace,
    whyThisFired: input.read.whyThisFired,
  });
}

function eventFromQueueItem(input: {
  item: AIActionQueueItem;
  reportRunKey: string;
  createdAt: string;
  valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | null;
  week?: number | null;
}) {
  const action = actionFromQueueItem(input.item);
  const counterfactual = buildCounterfactual({
    aiScore: input.item.confidence,
    baseline: baselineForQueueItem(input.item),
    blocked: input.item.decision === "blocked",
  });
  return buildEvent({
    reportRunKey: input.reportRunKey,
    createdAt: input.createdAt,
    valueMode: input.valueMode,
    leagueId: input.leagueId,
    manager: input.manager,
    season: input.season,
    week: input.week,
    surface: "autopilot",
    action,
    decision: decisionFromQueueItem(input.item),
    entityType: input.item.source === "lineup" ? "lineup" : input.item.source === "trade" ? "trade" : "player",
    entityId: input.item.id,
    entityName: input.item.target,
    finalScore: input.item.confidence,
    confidenceCap: input.item.decision === "blocked" ? Math.min(input.item.confidence, 35) : 100,
    confidenceCapReason: input.item.blockers[0] || input.item.missingEvidence[0] || null,
    evidence: input.item.receipts,
    missingEvidence: input.item.missingEvidence,
    hardBlockers: input.item.blockers,
    sourceTrace: sourceTraceFromStrings(input.item.sourceHealth),
    decisionSnapshotFacts: [
      snapshotFact({ key: "source", label: "Queue source", value: input.item.source, source: "AI action queue" }),
      snapshotFact({ key: "rank", label: "Queue rank", value: input.item.rank, source: "AI action queue" }),
      snapshotFact({ key: "rawDecision", label: "Raw decision", value: input.item.decision, source: "AI action queue" }),
      snapshotFact({ key: "baseline", label: "Counterfactual baseline", value: formatBaselineLabel(counterfactual.baseline.score), source: counterfactual.baseline.source }),
      snapshotFact({ key: "sourceHealthCount", label: "Source health rows", value: input.item.sourceHealth.length, source: "AI receipts" }),
    ],
    counterfactual,
    whyThisFired: input.item.why,
    metadata: {
      source: input.item.source,
      rank: input.item.rank,
      label: input.item.label,
      actionText: input.item.action,
      changeTriggers: input.item.changeTriggers,
    },
  });
}

function eventFromRecommendation(input: {
  recommendation: AutopilotRecommendation;
  source: "waiver" | "trade";
  index: number;
  reportRunKey: string;
  createdAt: string;
  valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | null;
  week?: number | null;
}) {
  const surface: AIEvidenceSurface = input.source === "waiver" ? "waiver" : "trade";
  const fallbackAction: AIEvidenceAction = input.source === "waiver" ? "pickup" : "trade";
  const action = actionFromRecommendation(input.recommendation, fallbackAction);
  const entityId = input.recommendation.id || `${input.source}-${input.index}`;
  const rawScore = input.recommendation.evidenceRead?.finalScore ?? input.recommendation.confidence;
  const counterfactual = buildCounterfactual({
    aiScore: rawScore,
    baseline: baselineForRecommendation(input.recommendation, input.source),
  });
  if (input.recommendation.evidenceRead) {
    return buildEventFromEvidence({
      read: input.recommendation.evidenceRead,
      reportRunKey: input.reportRunKey,
      createdAt: input.createdAt,
      valueMode: input.valueMode,
      leagueId: input.leagueId,
      manager: input.manager,
      season: input.season,
      week: input.week,
      surface,
      action,
      entityType: input.source === "trade" ? "trade" : "player",
      entityId,
      entityName: input.recommendation.player,
      decisionSnapshotFacts: [
        snapshotFact({ key: "source", label: "Recommendation source", value: input.source, source: "AI Autopilot" }),
        snapshotFact({ key: "type", label: "Recommendation type", value: input.recommendation.type, source: "AI Autopilot" }),
        snapshotFact({ key: "risk", label: "Risk", value: input.recommendation.risk, source: "AI Autopilot" }),
        snapshotFact({ key: "upside", label: "Upside", value: input.recommendation.upside, source: "AI Autopilot" }),
        snapshotFact({ key: "baseline", label: "Counterfactual baseline", value: formatBaselineLabel(counterfactual.baseline.score), source: counterfactual.baseline.source }),
      ],
      counterfactual,
      metadata: {
        recommendationType: input.recommendation.type,
        actionText: input.recommendation.action,
        source: input.source,
      },
    });
  }

  return buildEvent({
    reportRunKey: input.reportRunKey,
    createdAt: input.createdAt,
    valueMode: input.valueMode,
    leagueId: input.leagueId,
    manager: input.manager,
    season: input.season,
    week: input.week,
    surface,
    action,
    decision: input.recommendation.confidence >= 58 ? "do" : "watch",
    entityType: input.source === "trade" ? "trade" : "player",
    entityId,
    entityName: input.recommendation.player,
    finalScore: input.recommendation.confidence,
    evidence: input.recommendation.reasons,
    missingEvidence: [],
    hardBlockers: [],
    sourceTrace: sourceTraceFromStrings(input.recommendation.signals),
    decisionSnapshotFacts: [
      snapshotFact({ key: "source", label: "Recommendation source", value: input.source, source: "AI Autopilot" }),
      snapshotFact({ key: "type", label: "Recommendation type", value: input.recommendation.type, source: "AI Autopilot" }),
      snapshotFact({ key: "risk", label: "Risk", value: input.recommendation.risk, source: "AI Autopilot" }),
      snapshotFact({ key: "upside", label: "Upside", value: input.recommendation.upside, source: "AI Autopilot" }),
      snapshotFact({ key: "baseline", label: "Counterfactual baseline", value: formatBaselineLabel(counterfactual.baseline.score), source: counterfactual.baseline.source }),
    ],
    counterfactual,
    whyThisFired: input.recommendation.summary,
    metadata: {
      recommendationType: input.recommendation.type,
      actionText: input.recommendation.action,
      source: input.source,
    },
  });
}

function eventFromWaiverCandidate(input: {
  player: TrendingPlayer;
  target?: WaiverWeeklyEcrTarget | null;
  baseline: AIDecisionBaseline;
  index: number;
  reportRunKey: string;
  createdAt: string;
  valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | null;
  week?: number | null;
}) {
  const score = input.target?.score ?? input.player.weeklyEcr?.confidence ?? Math.min(74, 44 + Math.round((input.player.count || 0) / 200));
  const targetReason = input.target
    ? `${input.target.signal.position} schedule score ${Math.round(input.target.score)} from ${input.target.signal.source}.`
    : null;
  const isTaxi = /stash|taxi|rookie/i.test(targetReason || "");
  const hasOwner = Boolean(input.player.owner);
  const counterfactual = buildCounterfactual({
    aiScore: score,
    baseline: input.baseline,
    blocked: hasOwner,
  });

  return buildEvent({
    reportRunKey: input.reportRunKey,
    createdAt: input.createdAt,
    valueMode: input.valueMode,
    leagueId: input.leagueId,
    manager: input.manager,
    season: input.season,
    week: input.week,
    surface: "waiver",
    action: isTaxi ? "stash" : "pickup",
    decision: hasOwner ? "blocked" : score >= 58 ? "do" : "watch",
    entityType: "player",
    entityId: input.player.player_id || `waiver-${input.index}`,
    entityName: input.player.name,
    finalScore: score,
    confidenceCap: hasOwner ? Math.min(35, score) : 100,
    confidenceCapReason: hasOwner ? "Player is already rostered in the live report snapshot." : null,
    evidence: [
      targetReason,
      input.player.count ? `${input.player.count.toLocaleString()} Sleeper adds in the trend window.` : null,
      input.player.currentPositionRank ? `${input.player.currentPositionRank} current-season rank.` : null,
      input.player.ktcValue ? `Market value ${Math.round(input.player.ktcValue).toLocaleString()}.` : null,
    ].filter((value): value is string => Boolean(value)),
    missingEvidence: input.player.weeklyEcr ? [] : ["No DraftSharks schedule signal attached to this waiver candidate."],
    hardBlockers: hasOwner ? [`Already rostered by ${input.player.owner}.`] : [],
    sourceTrace: sourceTraceFromWaiverPlayer(input.player),
    decisionSnapshotFacts: [
      snapshotFact({ key: "position", label: "Position", value: input.player.pos, source: "Sleeper player index" }),
      snapshotFact({ key: "team", label: "Team", value: input.player.team, source: "Sleeper player index" }),
      snapshotFact({ key: "owner", label: "Roster owner", value: input.player.owner || "Available", source: "live roster snapshot" }),
      snapshotFact({ key: "trendAdds", label: "Trend adds", value: input.player.count || 0, source: "Sleeper trends" }),
      snapshotFact({ key: "marketValue", label: "Market value", value: input.player.ktcValue, source: "stored value snapshot" }),
      snapshotFact({ key: "currentRank", label: "Current rank", value: input.player.currentPositionRank ?? null, source: "redraft/current rank snapshot" }),
      snapshotFact({ key: "scheduleScore", label: "Schedule score", value: input.target?.score ?? input.player.weeklyEcr?.confidence ?? null, source: input.player.weeklyEcr?.source || input.target?.signal.source || "DraftSharks SOS" }),
      snapshotFact({ key: "baseline", label: "Counterfactual baseline", value: formatBaselineLabel(counterfactual.baseline.score), source: counterfactual.baseline.source }),
    ],
    counterfactual,
    whyThisFired: targetReason || `${input.player.name} appeared in the Waiver Intelligence candidate pool.`,
    metadata: {
      source: "waiver-intelligence",
      position: input.player.pos,
      team: input.player.team,
      targetScore: input.target?.score ?? null,
    },
  });
}

function eventFromScheduleRow(input: {
  row: ScheduleEdgeRow;
  index: number;
  reportRunKey: string;
  createdAt: string;
  valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | null;
  week?: number | null;
}) {
  const action: AIEvidenceAction =
    input.row.position === "K" || input.row.position === "DEF"
      ? "stream"
      : input.row.decisionLabel === "Do this"
        ? "pickup"
        : "watch";
  const counterfactual = buildCounterfactual({
    aiScore: input.row.evidenceRead.finalScore,
    baseline: baselineForScheduleRow(input.row),
    blocked: input.row.evidenceRead.label === "blocked" || input.row.evidenceRead.hardBlockers.length > 0,
  });

  return buildEventFromEvidence({
    read: input.row.evidenceRead,
    reportRunKey: input.reportRunKey,
    createdAt: input.createdAt,
    valueMode: input.valueMode,
    leagueId: input.leagueId,
    manager: input.manager,
    season: input.season,
    week: input.week,
    surface: "schedule",
    action,
    entityType: "schedule",
    entityId: input.row.id || `schedule-${input.index}`,
    entityName: input.row.player.name || input.row.signal.name,
    decisionSnapshotFacts: [
      snapshotFact({ key: "position", label: "Position", value: input.row.position, source: "schedule edge row" }),
      snapshotFact({ key: "team", label: "Team", value: input.row.team, source: "schedule edge row" }),
      snapshotFact({ key: "bestRank", label: "Schedule rank", value: input.row.bestRank, source: input.row.signal.source }),
      snapshotFact({ key: "currentRank", label: "Current rank", value: input.row.currentRank, source: "redraft/current rank snapshot" }),
      snapshotFact({ key: "window", label: "Schedule window", value: input.row.window, source: input.row.signal.source }),
      snapshotFact({ key: "sourceFreshness", label: "Source freshness", value: input.row.sourceFreshness, source: input.row.signal.source }),
      snapshotFact({ key: "availability", label: "Availability", value: input.row.availabilityLabel, source: "live roster snapshot" }),
      snapshotFact({ key: "baseline", label: "Counterfactual baseline", value: formatBaselineLabel(counterfactual.baseline.score), source: counterfactual.baseline.source }),
    ],
    counterfactual,
    metadata: {
      position: input.row.position,
      team: input.row.team,
      bestRank: input.row.bestRank,
      window: input.row.window,
      sourceFreshness: input.row.sourceFreshness,
      decisionLabel: input.row.decisionLabel,
    },
  });
}

export function buildAIPredictionEventsForReport(input: BuildAIPredictionEventsForReportInput): ClientAIPredictionEvent[] {
  const reportData = input.reportData;
  if (!reportData) return [];

  const valueMode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );
  const mode: AutopilotMode = valueMode === "redraft" ? "redraft" : "dynasty";
  const createdAt = getReportCreatedAt(reportData, input.createdAt);
  const reportRunKey = getReportRunKey(reportData, input.leagueId);
  const season = reportData.leagueDiagnostics?.currentSeason || null;
  const week = reportData.leagueDiagnostics?.currentWeek || null;
  const manager = input.manager || reportData.viewerManager || null;
  const events: ClientAIPredictionEvent[] = [];

  try {
    const autopilot = buildAutopilotData({
      reportData,
      mode,
      fallback: AUTOPILOT_MOCK_DATA[mode],
    });
    events.push(
      ...autopilot.actionQueue
        .slice(0, 4)
        .map(item => eventFromQueueItem({
          item,
          reportRunKey,
          createdAt,
          valueMode,
          leagueId: input.leagueId,
          manager: manager || autopilot.focusManager,
          season,
          week,
        })),
      ...autopilot.waivers
        .slice(0, 4)
        .map((recommendation, index) => eventFromRecommendation({
          recommendation,
          source: "waiver",
          index,
          reportRunKey,
          createdAt,
          valueMode,
          leagueId: input.leagueId,
          manager: manager || autopilot.focusManager,
          season,
          week,
        })),
      ...autopilot.trades
        .slice(0, 4)
        .map((recommendation, index) => eventFromRecommendation({
          recommendation,
          source: "trade",
          index,
          reportRunKey,
          createdAt,
          valueMode,
          leagueId: input.leagueId,
          manager: manager || autopilot.focusManager,
          season,
          week,
        })),
    );
  } catch {
    // Calibration should never block the report view.
  }

  try {
    const waiver = reportData.waiverIntelligence;
    const targetByPlayerId = new Map(
      (waiver?.weeklyEcrTargets || []).map(target => [target.player.player_id, target])
    );
    const waiverCandidates = [
      ...(waiver?.weeklyEcrTargets || []).map(target => target.player),
      ...(waiver?.availableTrendingAdds || []),
      ...Object.values(waiver?.bestAvailableByPosition || {}),
      waiver?.highestKtcAvailable,
    ].filter((player): player is TrendingPlayer => Boolean(player?.player_id));
    const waiverBaseline = highestAvailableWaiverBaseline(waiverCandidates);
    const seenWaiverIds = new Set<string>();
    events.push(
      ...waiverCandidates
        .filter(player => {
          if (seenWaiverIds.has(player.player_id)) return false;
          seenWaiverIds.add(player.player_id);
          return true;
        })
        .slice(0, 4)
        .map((player, index) => eventFromWaiverCandidate({
          player,
          target: targetByPlayerId.get(player.player_id) || null,
          baseline: waiverBaseline,
          index,
          reportRunKey,
          createdAt,
          valueMode,
          leagueId: input.leagueId,
          manager,
          season,
          week,
        })),
    );
  } catch {
    // Calibration should never block the report view.
  }

  try {
    events.push(
      ...buildScheduleEdgeRows(reportData)
        .slice(0, 8)
        .map((row, index) => eventFromScheduleRow({
          row,
          index,
          reportRunKey,
          createdAt,
          valueMode,
          leagueId: input.leagueId,
          manager,
          season,
          week,
        })),
    );
  } catch {
    // Calibration should never block the report view.
  }

  const byEventId = new Map<string, ClientAIPredictionEvent>();
  events.forEach(event => {
    if (!event.eventId || byEventId.has(event.eventId)) return;
    byEventId.set(event.eventId, event);
  });

  return Array.from(byEventId.values()).slice(0, 24);
}

export function getAIPredictionEventBatchSignature(events: ClientAIPredictionEvent[]): string {
  return events
    .map(event => `${event.eventId}:${event.finalScore}:${event.outcome.status}`)
    .sort()
    .join("|");
}
