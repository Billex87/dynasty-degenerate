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
import type {
  RecommendationExpectedAction,
  RecommendationObservedOutcome,
  RecommendationPlayerRef,
} from "@shared/recommendationOutcome";
import type { PlayerDetails, ReportData, TrendingPlayer, WaiverWeeklyEcrTarget } from "@shared/types";
import { buildAutopilotData } from "@/lib/autopilot/buildAutopilotData";
import { AUTOPILOT_MOCK_DATA } from "@/lib/autopilot/mockData";
import type { AIActionQueueItem, AutopilotMode, AutopilotRecommendation } from "@/lib/autopilot/types";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { buildPlayerActionArchetypeRead } from "@/lib/playerActionArchetype";
import { buildScheduleEdgeRows, type ScheduleEdgeRow } from "@/lib/scheduleEdgeRows";
import { buildManagerPersonalityIntelRows } from "@/lib/managerPersonalityIntel";

export type ClientAIPredictionDecision = "do" | "dont" | "watch" | "hold" | "blocked";
export type ClientAIPredictionOutcomeStatus = "hit" | "miss" | "push" | "pending" | "blocked";
export type ClientAISourceAgreementState = "aligned" | "split" | "conflicted" | "thin" | "missing" | "unknown";
export type ClientAISourceSignalDirection = "for" | "against" | "neutral" | "missing";
export type ClientAISourceAgreementRead = {
  state: ClientAISourceAgreementState;
  directionalSourceCount: number;
  sourceCount: number;
  forWeight: number;
  againstWeight: number;
  neutralWeight: number;
  missingCount: number;
  confidenceCap: number | null;
  reason: string;
  signals: Array<{
    source: string;
    direction: ClientAISourceSignalDirection;
    confidence?: number | null;
    status?: AISourceTrace["status"] | null;
    detail?: string | null;
  }>;
};

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
  sourceAgreement: ClientAISourceAgreementRead | null;
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
    observedOutcome?: RecommendationObservedOutcome | null;
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

function normalizeManagerKey(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function getManagerArchetypeFromReport(data: ReportData, manager?: string | null): string | null {
  const key = normalizeManagerKey(manager);
  if (!key) return null;
  const row = buildManagerPersonalityIntelRows(data)
    .find(item => normalizeManagerKey(item.manager) === key);
  if (!row) return null;
  return [
    row.tradeStyle,
    row.waiverStyle,
    row.rosterStyle,
  ]
    .filter(Boolean)
    .join(" / ");
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

function getReportValueProfileKey(reportData: ReportData): string {
  const fromTradeAudit = cleanText(reportData.tradeHistoryValueAudit?.profileKey);
  if (fromTradeAudit) return fromTradeAudit;
  const firstTimeline = Object.values(reportData.playerDetailsById || {})
    .map(details => cleanText(details?.valueTimeline?.profileKey))
    .find(Boolean);
  return firstTimeline || "12_sf_ppr_base";
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

function currentPlayerValue(details?: PlayerDetails | null, valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null): number | null {
  const profile = details?.valueProfile;
  if (!profile) return null;
  if (valueMode === "redraft") {
    return Number(profile.seasonValue ?? profile.fantasyProsSeasonValue ?? profile.fantasyCalcRedraft ?? null) || null;
  }
  return Number(profile.dynastyValue ?? profile.balancedValue ?? profile.marketKtc ?? null) || null;
}

function currentPlayerRank(details?: PlayerDetails | null, valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null): string | number | null {
  const profile = details?.valueProfile;
  if (!profile) return null;
  if (valueMode === "redraft") {
    return profile.seasonPositionRank || profile.fantasyProsPositionRank || null;
  }
  return profile.dynastyPositionRank || profile.balancedPositionRank || null;
}

function scoreFromPlayerDetails(details?: PlayerDetails | null, valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null): number {
  const scores = [
    scoreFromRank(currentPlayerRank(details, valueMode), details?.position),
    scoreFromValue(currentPlayerValue(details, valueMode)),
    details?.playerSituationDelta?.confidence ?? null,
    details?.playerCohort?.confidence ?? null,
    details?.playerCohort?.calibration?.evidenceScore ?? null,
    details?.playerCohort?.seasonOutcomeReceipt?.confidence ?? null,
  ].filter((score): score is number => Number.isFinite(score));

  if (!scores.length) return 46;
  return clampPercent(scores.reduce((sum, score) => sum + score, 0) / scores.length);
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

function baselineForPlayerDetails(
  details: PlayerDetails,
  valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null
): AIDecisionBaseline {
  const rankScore = scoreFromRank(currentPlayerRank(details, valueMode), details.position);
  const valueScore = scoreFromValue(currentPlayerValue(details, valueMode));
  const score = rankScore ?? valueScore ?? null;
  return {
    kind: "market-default",
    label: valueMode === "redraft" ? "current-season market default" : "dynasty market default",
    score,
    source: rankScore !== null ? "current rank" : valueScore !== null ? "stored player value" : "missing player market",
    detail: score === null
      ? "No player rank/value baseline was available for this archetype read."
      : `Baseline score ${formatBaselineLabel(score)} from ${rankScore !== null ? "rank" : "stored value"}.`,
  };
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
  if (item.blockers.length) return "blocked";
  if (item.decision === "do") {
    const sourceHealth = item.sourceHealth.join(" ");
    if (item.missingEvidence.length) return "watch";
    if (!item.sourceHealth.length) return "watch";
    if (/stale|missing|error|limited|unavailable|unverified|disabled|empty source|source empty|\b(?:0|zero)\s+rows?\b|no source/i.test(sourceHealth)) {
      return "watch";
    }
    return "do";
  }
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

function primaryExpectedPlayer(expectedAction?: RecommendationExpectedAction | null): RecommendationPlayerRef | null {
  if (!expectedAction) return null;
  return expectedAction.playerIn
    || expectedAction.playerOut
    || expectedAction.playersInvolved?.find(Boolean)
    || null;
}

function decisionFromEvidence(read: AIEvidenceResult, fallbackScore: number): ClientAIPredictionDecision {
  if (read.label === "blocked" || read.hardBlockers.length) return "blocked";
  if (!read.canAct) return read.label === "thin" ? "dont" : "watch";
  if (read.confidenceCapReason || read.missingEvidence.length) return "watch";
  if (fallbackScore >= 58) return "do";
  return "watch";
}

function sourceTraceFromStrings(values: string[]): AISourceTrace[] {
  return values.slice(0, 8).map(value => ({
    label: value,
    status: /missing|stale|error|limited|blocked|rough|unavailable|unverified|disabled|\b(?:0|zero)\s+rows?\b/i.test(value)
      ? "limited"
      : "loaded",
  }));
}

function isAvailableOwnerLabel(value?: string | null): boolean {
  const clean = cleanText(value);
  return !clean || /^(available|fa|free agent|unowned|waiver|waiver wire|none)$/i.test(clean);
}

function isAvailableRosterStatus(value?: string | null): boolean {
  const clean = cleanText(value);
  return Boolean(clean && /available|free agent|\bfa\b|unowned|waiver/i.test(clean));
}

function isRosteredStatus(value?: string | null): boolean {
  const clean = cleanText(value);
  return Boolean(clean && !isAvailableRosterStatus(clean) && /starter|bench|taxi|roster|owned/i.test(clean));
}

function getWaiverCandidateRosterState(player: TrendingPlayer): {
  hasAvailabilityProof: boolean;
  isRostered: boolean;
  ownerLabel: string | null;
} {
  const ownerIsPresent =
    Object.prototype.hasOwnProperty.call(player, "owner") &&
    player.owner !== undefined;
  const ownerLabel = cleanText(player.owner);
  const rosterStatus = cleanText(
    player.playerDetails?.rosterStatus ||
      player.playerDetails?.displayStatus ||
      null
  );
  const hasAvailabilityProof = ownerIsPresent || Boolean(rosterStatus);
  const isRostered = Boolean(
    (ownerLabel && !isAvailableOwnerLabel(ownerLabel)) ||
      isRosteredStatus(rosterStatus)
  );

  return {
    hasAvailabilityProof,
    isRostered,
    ownerLabel,
  };
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

  const rosterState = getWaiverCandidateRosterState(player);
  return sourceTraceFromStrings([
    player.weeklyEcr?.source || "Sleeper availability",
    rosterState.isRostered && rosterState.ownerLabel
      ? `Owned by ${rosterState.ownerLabel}`
      : rosterState.hasAvailabilityProof
        ? "Available player pool"
        : "Unverified roster availability",
  ]);
}

function sourceSignalDirectionFromTrace(
  trace: AISourceTrace,
  hardBlockers: string[],
  missingEvidence: string[],
): ClientAISourceSignalDirection {
  const text = `${trace.label} ${trace.detail || ""}`.toLowerCase();
  if (
    trace.status === "missing" ||
    trace.status === "unavailable" ||
    trace.status === "unverified" ||
    trace.status === "stale" ||
    trace.status === "error" ||
    trace.status === "limited" ||
    /missing|no source|not attached|unavailable|unverified|empty source|source empty|provider disabled|source disabled|\b(?:0|zero)\s+rows?\b/i.test(text)
  ) return "missing";
  if (hardBlockers.some(blocker => text.includes(blocker.toLowerCase()))) return "against";
  if (/rough|avoid|blocked|conflict|drop confidence|penalty/i.test(text)) return "against";
  if (/loaded|available|confirmed|rank|schedule|source|trend|value|matchup|baseline/i.test(text)) return "for";
  return "neutral";
}

function sourceSignalWeight(trace: AISourceTrace): number {
  const text = `${trace.label} ${trace.detail || ""}`;
  if (
    trace.status === "missing" ||
    trace.status === "unavailable" ||
    trace.status === "unverified" ||
    trace.status === "stale" ||
    trace.status === "error" ||
    trace.status === "limited" ||
    /empty source|source empty|provider disabled|source disabled|\b(?:0|zero)\s+rows?\b/i.test(text)
  ) return 0;
  return 70;
}

export function buildClientSourceAgreementRead(input: {
  sourceTrace: AISourceTrace[];
  hardBlockers: string[];
  missingEvidence: string[];
}): ClientAISourceAgreementRead | null {
  const signals = input.sourceTrace.slice(0, 8).map(trace => ({
    source: trace.label || "unknown-source",
    direction: sourceSignalDirectionFromTrace(trace, input.hardBlockers, input.missingEvidence),
    confidence: sourceSignalWeight(trace),
    status: trace.status || null,
    detail: trace.detail || null,
  }));
  if (!signals.length && !input.missingEvidence.length && !input.hardBlockers.length) return null;

  if (!signals.length) {
    input.missingEvidence.slice(0, 3).forEach((reason, index) => {
      signals.push({
        source: `missing-evidence-${index + 1}`,
        direction: "missing",
        confidence: 0,
        status: "missing",
        detail: reason,
      });
    });
  }

  const directional = signals.filter(signal => signal.direction === "for" || signal.direction === "against");
  const forWeight = directional
    .filter(signal => signal.direction === "for")
    .reduce((sum, signal) => sum + (signal.confidence || 0), 0);
  const againstWeight = directional
    .filter(signal => signal.direction === "against")
    .reduce((sum, signal) => sum + (signal.confidence || 0), 0);
  const neutralWeight = signals
    .filter(signal => signal.direction === "neutral")
    .reduce((sum, signal) => sum + (signal.confidence || 0), 0);
  const missingCount = signals.filter(signal => signal.direction === "missing" || signal.status === "missing").length;
  const hasFor = forWeight > 0;
  const hasAgainst = againstWeight > 0 || input.hardBlockers.length > 0;
  const state: ClientAISourceAgreementState = input.hardBlockers.length
    ? "conflicted"
    : !signals.length || missingCount === signals.length
      ? "missing"
      : missingCount > 0
        ? "split"
      : directional.length < 2
        ? "thin"
        : hasFor && hasAgainst
          ? forWeight >= 70 && againstWeight >= 70 ? "conflicted" : "split"
          : hasFor
            ? "aligned"
            : "unknown";
  const confidenceCap =
    state === "conflicted" ? 52 :
    state === "split" ? 62 :
    state === "thin" ? 56 :
    state === "missing" || state === "unknown" ? 48 :
    missingCount > 0 ? 84 :
    null;
  const reason =
    state === "conflicted" ? "Source signals conflict or a hard blocker is present." :
    state === "split" ? "Source signals are split, so calibration should stay cautious." :
    state === "thin" ? "Only one directional source supports this read." :
    state === "missing" ? "No source signal was available for this read." :
    state === "unknown" ? "No directional source signal was available." :
    missingCount > 0 ? "Directional sources align, but one expected signal is missing." :
    "Directional sources align.";

  return {
    state,
    directionalSourceCount: directional.length,
    sourceCount: signals.length,
    forWeight,
    againstWeight,
    neutralWeight,
    missingCount,
    confidenceCap,
    reason,
    signals,
  };
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

function parseFaabMetadata(value?: string | null): Record<string, unknown> | null {
  const text = cleanText(value);
  if (!text) return null;
  const range = text.match(/FAAB\s+(\d+)\s*-\s*(\d+)%/i);
  const single = text.match(/FAAB\s+(\d+)%/i);
  if (!range && !single) return null;
  const min = Number(range?.[1] ?? single?.[1]);
  const max = Number(range?.[2] ?? single?.[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const midpoint = Math.round((min + max) / 2);
  const band = midpoint >= 16 ? "aggressive" : midpoint >= 9 ? "standard" : midpoint >= 4 ? "light" : "free";
  return {
    faabMin: min,
    faabMax: max,
    faabMidpoint: midpoint,
    faabBand: band,
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
  managerArchetype?: string | null;
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
  const sourceTrace = (input.sourceTrace || []).slice(0, 8);
  const hardBlockers = (input.hardBlockers || []).slice(0, 8);
  const missingEvidence = (input.missingEvidence || []).slice(0, 8);
  const sourceAgreement = buildClientSourceAgreementRead({
    sourceTrace,
    hardBlockers,
    missingEvidence,
  });
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
    missingEvidence,
    hardBlockers,
    softPenalties: [...counterfactualPenalty(counterfactual), ...(input.softPenalties || [])].slice(0, 8),
    sourceTrace,
    sourceAgreement,
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
    metadata: {
      valueMode: input.valueMode || "unknown",
      ...input.metadata,
    },
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
  managerArchetype?: string | null;
}) {
  const action = actionFromQueueItem(input.item);
  const expectedAction = input.item.expectedAction || null;
  const primaryPlayer = primaryExpectedPlayer(expectedAction);
  const sharpnessSignal = input.item.signals.find(signal =>
    /\b(sleepy|casual|average|sharp|shark tank|shark-tank)\b/i.test(signal)
  );
  const sharpnessScore = sharpnessSignal
    ? Number(sharpnessSignal.match(/(\d{1,3})%/)?.[1])
    : null;
  const sharpnessLabel = sharpnessSignal
    ? sharpnessSignal.replace(/\s+\d{1,3}%.*$/, "").trim()
    : null;
  const sharpnessTier = sharpnessLabel
    ? sharpnessLabel.toLowerCase().replace(/\s+/g, "-")
    : null;
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
    entityId: primaryPlayer?.id || input.item.id,
    entityName: primaryPlayer?.name || input.item.target,
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
      snapshotFact({ key: "queueSignals", label: "Queue signals", value: input.item.signals.join(" · "), source: "AI action queue" }),
    ],
    counterfactual,
    whyThisFired: input.item.why,
    metadata: {
      source: input.item.source,
      rank: input.item.rank,
      label: input.item.label,
      actionText: input.item.action,
      changeTriggers: input.item.changeTriggers,
      queueSignals: input.item.signals,
      leagueSharpnessLabel: sharpnessLabel,
      leagueSharpnessScore: Number.isFinite(sharpnessScore) ? sharpnessScore : null,
      leagueSharpnessTier: sharpnessTier,
      managerArchetype: input.managerArchetype || null,
      expectedAction,
      playersInvolved: expectedAction?.playersInvolved || (primaryPlayer ? [primaryPlayer] : []),
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
  managerArchetype?: string | null;
}) {
  const surface: AIEvidenceSurface = input.source === "waiver" ? "waiver" : "trade";
  const fallbackAction: AIEvidenceAction = input.source === "waiver" ? "pickup" : "trade";
  const action = actionFromRecommendation(input.recommendation, fallbackAction);
  const expectedAction = input.recommendation.expectedAction || null;
  const primaryPlayer = primaryExpectedPlayer(expectedAction);
  const entityId = primaryPlayer?.id || input.recommendation.playerId || input.recommendation.id || `${input.source}-${input.index}`;
  const rawScore = input.recommendation.evidenceRead?.finalScore ?? input.recommendation.confidence;
  const faabMetadata = input.source === "waiver"
    ? parseFaabMetadata(input.recommendation.secondary)
    : null;
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
      entityName: primaryPlayer?.name || input.recommendation.player,
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
        managerArchetype: input.managerArchetype || null,
        expectedAction,
        playersInvolved: expectedAction?.playersInvolved || (primaryPlayer ? [primaryPlayer] : []),
        ...faabMetadata,
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
    entityName: primaryPlayer?.name || input.recommendation.player,
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
      managerArchetype: input.managerArchetype || null,
      expectedAction,
      playersInvolved: expectedAction?.playersInvolved || (primaryPlayer ? [primaryPlayer] : []),
      ...faabMetadata,
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
  const rosterState = getWaiverCandidateRosterState(input.player);
  const hasOwner = rosterState.isRostered;
  const hasAvailabilityProof = rosterState.hasAvailabilityProof;
  const missingAvailabilityProof = !hasOwner && !hasAvailabilityProof;
  const counterfactual = buildCounterfactual({
    aiScore: score,
    baseline: input.baseline,
    blocked: hasOwner || missingAvailabilityProof,
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
    decision: hasOwner ? "blocked" : missingAvailabilityProof ? "watch" : score >= 58 ? "do" : "watch",
    entityType: "player",
    entityId: input.player.player_id || `waiver-${input.index}`,
    entityName: input.player.name,
    finalScore: score,
    confidenceCap: hasOwner ? Math.min(35, score) : missingAvailabilityProof ? Math.min(55, score) : 100,
    confidenceCapReason: hasOwner
      ? "Player is already rostered in the live report snapshot."
      : missingAvailabilityProof
        ? "Missing roster ownership proof"
        : null,
    evidence: [
      targetReason,
      input.player.count ? `${input.player.count.toLocaleString()} Sleeper adds in the trend window.` : null,
      input.player.currentPositionRank ? `${input.player.currentPositionRank} current-season rank.` : null,
      input.player.ktcValue ? `Market value ${Math.round(input.player.ktcValue).toLocaleString()}.` : null,
    ].filter((value): value is string => Boolean(value)),
    missingEvidence: [
      input.player.weeklyEcr ? null : "No DraftSharks schedule signal attached to this waiver candidate.",
      missingAvailabilityProof ? "No current roster ownership or availability proof returned for this waiver candidate." : null,
    ].filter((value): value is string => Boolean(value)),
    hardBlockers: hasOwner ? [`Already rostered by ${rosterState.ownerLabel || "another manager"}.`] : [],
    sourceTrace: sourceTraceFromWaiverPlayer(input.player),
    decisionSnapshotFacts: [
      snapshotFact({ key: "position", label: "Position", value: input.player.pos, source: "Sleeper player index" }),
      snapshotFact({ key: "team", label: "Team", value: input.player.team, source: "Sleeper player index" }),
      snapshotFact({
        key: "owner",
        label: "Roster owner",
        value: hasOwner
          ? rosterState.ownerLabel
          : hasAvailabilityProof
            ? "Available"
            : "Unverified",
        source: "live roster snapshot",
      }),
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
      trendAdds: input.player.count || 0,
      hasScheduleSignal: Boolean(input.player.weeklyEcr),
      scheduleSource: input.player.weeklyEcr?.source || null,
      currentPositionRank: input.player.currentPositionRank || null,
      ownerStatus: hasOwner ? "rostered" : hasAvailabilityProof ? "available" : "unverified",
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
      : input.row.evidenceRead.canAct
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

function actionFromPlayerArchetype(key: string): AIEvidenceAction {
  if (key === "schedule-streamer") return "stream";
  if (key === "volume-spike" || key === "post-hype-breakout") return "start";
  if (key === "depth-chart-promotion" || key === "protected-runway") return "stash";
  if (key === "market-trap" || key === "fragile-veteran") return "avoid";
  return "watch";
}

function decisionFromPlayerArchetype(key: string, score: number): ClientAIPredictionDecision {
  if (key === "market-trap" || key === "fragile-veteran") return "dont";
  if (key === "thin-role-read") return "watch";
  if (score >= 62) return "do";
  return "watch";
}

function sourceTraceFromPlayerDetails(details: PlayerDetails): AISourceTrace[] {
  const traces: Array<AISourceTrace | null> = [
    details.playerCohort?.calibration ? {
      label: "Player cohort calibration",
      status: details.playerCohort.calibration.evidenceGrade === "blocked" ? "limited" : "loaded",
      detail: details.playerCohort.calibration.note,
    } : null,
    details.playerSituationDelta ? {
      label: "Player situation delta",
      status:
        details.playerSituationDelta.freshness.grade === "fresh" ||
        details.playerSituationDelta.freshness.grade === "usable"
          ? "loaded"
          : details.playerSituationDelta.freshness.grade === "stale"
            ? "stale"
            : "missing",
      detail: details.playerSituationDelta.summary,
    } : null,
    details.schedule ? {
      label: "DraftSharks schedule profile",
      status: "loaded",
      detail: details.schedule.scheduleTier || null,
    } : null,
    details.valueProfile ? {
      label: "Stored player value",
      status: "loaded",
      detail: currentPlayerRank(details) ? `Rank ${currentPlayerRank(details)}.` : null,
    } : null,
  ];

  return traces.filter((trace): trace is AISourceTrace => Boolean(trace));
}

function playerDetailSoftPenalties(details: PlayerDetails): AIEvidencePenalty[] {
  return [
    ...(details.playerCohort?.calibration?.cautionFlags || []),
    ...(details.playerSituationDelta?.cautionFlags || []),
  ].slice(0, 6).map((label) => ({
    label,
    points: 6,
  }));
}

function eventFromPlayerDetails(input: {
  playerId: string;
  details: PlayerDetails;
  reportRunKey: string;
  createdAt: string;
  valueMode?: "dynasty" | "redraft" | "keeper" | "unknown" | null;
  leagueId?: string | null;
  manager?: string | null;
  season?: string | null;
  week?: number | null;
}): ClientAIPredictionEvent | null {
  const name = cleanText(input.details.fullName) || cleanText(input.details.playerCohort?.name) || input.playerId;
  const position = cleanText(input.details.position || input.details.playerCohort?.position);
  const archetype = buildPlayerActionArchetypeRead({
    playerName: name,
    position,
    details: input.details,
  });
  if (!archetype) return null;

  const rawScore = scoreFromPlayerDetails(input.details, input.valueMode);
  const action = actionFromPlayerArchetype(archetype.key);
  const confidenceCap = Math.min(
    100,
    input.details.playerCohort?.calibration?.confidenceCap ?? 100,
    input.details.playerSituationDelta?.freshness?.grade === "stale" ? 66 : 100,
    input.details.playerSituationDelta?.freshness?.grade === "missing" ? 52 : 100,
  );
  const finalScore = Math.min(rawScore, confidenceCap);
  const missingEvidence = [
    ...(input.details.playerCohort?.calibration?.missingSignals || []),
    ...(input.details.playerSituationDelta?.missingSignals || []),
  ].slice(0, 8);
  const counterfactual = buildCounterfactual({
    aiScore: finalScore,
    baseline: baselineForPlayerDetails(input.details, input.valueMode),
    blocked: false,
  });

  return buildEvent({
    reportRunKey: input.reportRunKey,
    createdAt: input.createdAt,
    valueMode: input.valueMode,
    leagueId: input.leagueId,
    manager: input.manager,
    season: input.season,
    week: input.week,
    surface: "player-detail",
    action,
    decision: decisionFromPlayerArchetype(archetype.key, finalScore),
    entityType: "player",
    entityId: input.details.playerId || input.playerId,
    entityName: name,
    finalScore,
    confidenceCap,
    confidenceCapReason:
      confidenceCap < 100
        ? input.details.playerCohort?.calibration?.note || input.details.playerSituationDelta?.freshness?.note || "Player-detail evidence caps confidence."
        : null,
    evidence: archetype.receipts.length ? archetype.receipts : [archetype.note],
    missingEvidence,
    hardBlockers: [],
    softPenalties: playerDetailSoftPenalties(input.details),
    sourceTrace: sourceTraceFromPlayerDetails(input.details),
    decisionSnapshotFacts: [
      snapshotFact({ key: "position", label: "Position", value: position, source: "player detail" }),
      snapshotFact({ key: "team", label: "Team", value: input.details.team || null, source: "player detail" }),
      snapshotFact({ key: "archetype", label: "Archetype", value: archetype.label, source: "player-detail AI" }),
      snapshotFact({ key: "outcomeBucket", label: "Cohort bucket", value: input.details.playerCohort?.outcomeBucket || null, source: "player cohort" }),
      snapshotFact({ key: "situationAction", label: "Situation action", value: input.details.playerSituationDelta?.action || null, source: "situation delta" }),
      snapshotFact({ key: "currentRank", label: "Current rank", value: currentPlayerRank(input.details, input.valueMode), source: "stored value snapshot" }),
      snapshotFact({ key: "baseline", label: "Counterfactual baseline", value: formatBaselineLabel(counterfactual.baseline.score), source: counterfactual.baseline.source }),
    ],
    counterfactual,
    whyThisFired: archetype.note,
    metadata: {
      source: "player-detail-archetype",
      position,
      team: input.details.team || null,
      archetypeKey: archetype.key,
      archetypeLabel: archetype.label,
      archetypeTone: archetype.tone,
      outcomeBucket: input.details.playerCohort?.outcomeBucket || null,
      situationAction: input.details.playerSituationDelta?.action || null,
      situationPrimaryLabel: input.details.playerSituationDelta?.primaryLabel || null,
      currentValue: currentPlayerValue(input.details, input.valueMode),
      currentPositionRank: currentPlayerRank(input.details, input.valueMode),
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
  const valueProfileKey = getReportValueProfileKey(reportData);
  const season = reportData.leagueDiagnostics?.currentSeason || null;
  const week = reportData.leagueDiagnostics?.currentWeek || null;
  const manager = input.manager || reportData.viewerManager || null;
  const managerArchetype = getManagerArchetypeFromReport(reportData, manager);
  const events: ClientAIPredictionEvent[] = [];

  try {
    const autopilot = buildAutopilotData({
      reportData,
      mode,
      fallback: AUTOPILOT_MOCK_DATA[mode],
      leagueId: input.leagueId,
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
          managerArchetype,
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
          managerArchetype,
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
          managerArchetype,
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

  try {
    const playerDetailEvents = Object.entries(reportData.playerDetailsById || {})
      .map(([playerId, details]) => eventFromPlayerDetails({
        playerId,
        details,
        reportRunKey,
        createdAt,
        valueMode,
        leagueId: input.leagueId,
        manager,
        season,
        week,
      }))
      .filter((event): event is ClientAIPredictionEvent => Boolean(event))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 6);
    events.push(...playerDetailEvents);
  } catch {
    // Calibration should never block the report view.
  }

  const byEventId = new Map<string, ClientAIPredictionEvent>();
  events.forEach(event => {
    if (!event.eventId || byEventId.has(event.eventId)) return;
    byEventId.set(event.eventId, event);
  });

  return Array.from(byEventId.values())
    .slice(0, 32)
    .map(event => ({
      ...event,
      metadata: {
        valueMode,
        valueProfileKey,
        ...event.metadata,
      },
    }));
}

export function getAIPredictionEventBatchSignature(events: ClientAIPredictionEvent[]): string {
  return events
    .map(event => `${event.eventId}:${event.finalScore}:${event.outcome.status}`)
    .sort()
    .join("|");
}

export const __testing = {
  decisionFromEvidence,
  decisionFromQueueItem,
};
