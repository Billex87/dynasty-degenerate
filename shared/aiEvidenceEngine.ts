export type AIEvidenceSurface =
  | "autopilot"
  | "waiver"
  | "schedule"
  | "player-detail"
  | "owner-intel"
  | "rankings"
  | "trade"
  | "overview";

export type AIEvidenceAction =
  | "pickup"
  | "stash"
  | "stream"
  | "start"
  | "sit"
  | "trade"
  | "hold"
  | "watch"
  | "avoid";

export type AIEvidenceMode = "dynasty" | "redraft" | "current" | "schedule" | "market" | "prospect";

export type AIEvidenceQbFormat = "one_qb" | "superflex" | "two_qb" | "unknown";
export type AIEvidenceLeagueValueMode = "dynasty" | "redraft" | "keeper";
export type AIEvidenceLeagueTempo = "unknown" | "quiet" | "balanced" | "active" | "hyperactive";
export type AIEvidenceLeagueWaiverMode = "faab" | "priority" | "unknown";

export type AIEvidenceLeagueContext = {
  valueMode?: AIEvidenceLeagueValueMode | null;
  teamCount?: number | null;
  qbFormat?: AIEvidenceQbFormat | null;
  receptionScoring?: number | null;
  tightEndPremium?: number | null;
  passingTdPoints?: number | null;
  rosterSlots?: string[];
  starterSlots?: string[];
  scoringSummary?: string | null;
  formatLabel?: string | null;
  waiverMode?: AIEvidenceLeagueWaiverMode | null;
};

export type AIEvidenceLeagueActivityContext = {
  tradeTempo?: AIEvidenceLeagueTempo | null;
  waiverTempo?: AIEvidenceLeagueTempo | null;
  sharpnessScore?: number | null;
  sharpnessTier?: string | null;
  sharpnessLabel?: string | null;
  sharpnessActionBias?: string | null;
  tradeSignalCount?: number | null;
  waiverSignalCount?: number | null;
  transactionSignalCount?: number | null;
  sampleSize?: number | null;
  evidenceLabel?: string | null;
};

export type AIEvidenceCalibrationAdjustment = {
  key?: string;
  scope: string;
  group: Record<string, string>;
  eventCount?: number;
  scoredCount: number;
  pendingCount?: number;
  hitRate?: number | null;
  scoreAdjustment: number;
  confidenceCap: number | null;
  recommendation?: string;
  priority?: "danger" | "warn" | "info" | "good" | string;
  reason: string;
};

export type AIEvidenceCalibrationProfile = {
  globalAdjustment?: AIEvidenceCalibrationAdjustment | null;
  adjustments?: AIEvidenceCalibrationAdjustment[] | null;
};

export type AIEvidenceLeagueDiagnosticsLike = {
  teamCount?: number | null;
  valueMode?: AIEvidenceLeagueValueMode | null;
  qbFormat?: AIEvidenceQbFormat | null;
  receptionScoring?: number | null;
  tightEndPremium?: number | null;
  passingTdPoints?: number | null;
  rosterSlots?: string[] | null;
  starterSlots?: string[] | null;
  scoringSummary?: string | null;
  waiverMode?: AIEvidenceLeagueWaiverMode | null;
};

export type AIConfidenceLabel =
  | "blocked"
  | "thin"
  | "watchlist"
  | "actionable"
  | "priority"
  | "high conviction";

export type AISourceTrace = {
  label: string;
  status?: "loaded" | "stale" | "missing" | "error" | "limited" | "unavailable" | "unverified";
  detail?: string | null;
  ageHours?: number | null;
};

export type AIEvidencePenalty = {
  label: string;
  points: number;
};

export type AIEvidencePlayerContext = {
  name?: string | null;
  position?: string | null;
  team?: string | null;
  owner?: string | null;
  rosterStatus?: string | null;
  injuryStatus?: string | null;
  nflStatus?: string | null;
  weeklyProjectionStatus?: string | null;
  recentlyAddedBy?: string | null;
  value?: number | null;
  sourceCount?: number | null;
  hasCurrentSeasonValue?: boolean;
  hasDynastyValue?: boolean;
  hasProspectOnlyValue?: boolean;
  hasRecentUsage?: boolean;
  hasRoleContext?: boolean;
  isStarter?: boolean | null;
  hasByeWeek?: boolean | null;
  isGameLocked?: boolean | null;
};

export type AIEvidenceScheduleContext = {
  hasScheduleData?: boolean;
  isRoughStart?: boolean;
  isStrongStart?: boolean;
  missingReason?: string | null;
};

export type AIEvidenceInput = {
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  leagueValueMode?: "dynasty" | "redraft";
  baseScore?: number | null;
  evidence?: string[];
  missingEvidence?: string[];
  sourceTrace?: Array<string | AISourceTrace>;
  signalModes?: AIEvidenceMode[];
  leagueContext?: AIEvidenceLeagueContext | null;
  leagueActivity?: AIEvidenceLeagueActivityContext | null;
  confidenceCap?: number | null;
  confidenceCapReason?: string | null;
  player?: AIEvidencePlayerContext;
  schedule?: AIEvidenceScheduleContext;
  requiresActiveTeam?: boolean;
  requiresLiveAvailability?: boolean;
  requiresCurrentSeasonEvidence?: boolean;
  lowValueThreshold?: number;
  staleSourceCap?: number;
  calibrationProfile?: AIEvidenceCalibrationProfile | null;
  calibrationManager?: string | null;
  calibrationLeagueId?: string | null;
  calibrationManagerArchetype?: string | null;
};

export type AIEvidenceAppliedCalibrationAdjustment = {
  key: string | null;
  scope: string;
  reason: string;
  scoreAdjustment: number;
  confidenceCap: number | null;
  priority?: string | null;
  recommendation?: string | null;
  scoredCount: number;
  pendingCount: number;
  hitRate: number | null;
  baseFinalScore: number;
  adjustedFinalScore: number;
};

export type AIEvidenceResult = {
  evidence: string[];
  missingEvidence: string[];
  hardBlockers: string[];
  softPenalties: AIEvidencePenalty[];
  confidenceCap: number;
  confidenceCapReason: string | null;
  sourceTrace: AISourceTrace[];
  rawScore: number;
  finalScore: number;
  label: AIConfidenceLabel;
  shouldRender: boolean;
  canAct: boolean;
  whyThisFired: string;
  calibrationAdjustment?: AIEvidenceAppliedCalibrationAdjustment | null;
};

const STRONG_LABEL_MINIMUMS: Array<[AIConfidenceLabel, number]> = [
  ["high conviction", 84],
  ["priority", 72],
  ["actionable", 58],
  ["watchlist", 42],
  ["thin", 0],
];
const MIN_RESOLVED_OUTCOMES_FOR_ACTION_CONFIDENCE = 6;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanText(value: string | null | undefined): string | null {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean || null;
}

function uniqueTexts(values: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach(value => {
    const clean = cleanText(value);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result.slice(0, limit);
}

function normalizeTeam(value?: string | null): string {
  return String(value || "").trim().toUpperCase();
}

function isNoActiveTeam(team?: string | null): boolean {
  const normalized = normalizeTeam(team);
  return !normalized || normalized === "FA" || normalized === "N/A" || normalized === "NONE";
}

function normalizeStatus(value?: string | null): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isStartLikeAction(action: AIEvidenceAction): boolean {
  return action === "start" || action === "stream";
}

function isImmediateAvailabilityAction(action: AIEvidenceAction): boolean {
  return action === "pickup" || isStartLikeAction(action);
}

function canActionBecomeExecutable(action: AIEvidenceAction): boolean {
  return (
    action === "pickup" ||
    action === "stash" ||
    action === "stream" ||
    action === "start" ||
    action === "sit" ||
    action === "trade" ||
    action === "avoid"
  );
}

function hasRosterAvailabilityProof(player: AIEvidencePlayerContext): boolean {
  return (
    (Object.prototype.hasOwnProperty.call(player, "owner") &&
      player.owner !== undefined) ||
    Boolean(cleanText(player.rosterStatus))
  );
}

function hasLineupStateProof(player: AIEvidencePlayerContext): boolean {
  return (
    Object.prototype.hasOwnProperty.call(player, "isStarter") &&
    typeof player.isStarter === "boolean"
  );
}

function isSkillPlayerPosition(position?: string | null): boolean {
  const clean = String(position || "").toUpperCase();
  return clean === "QB" || clean === "RB" || clean === "WR" || clean === "TE";
}

function isHardUnavailableStatus(value?: string | null): boolean {
  const normalized = normalizeStatus(value);
  if (!normalized) return false;
  if (normalized === "OUT" || normalized === "O" || normalized === "IR") return true;
  return [
    "INJURED RESERVE",
    "PHYSICALLY UNABLE",
    "PUP",
    "NON FOOTBALL INJURY",
    " NFI",
    "SUSPENDED",
    "SUSP",
    "INACTIVE",
    "RESERVE",
  ].some(pattern => normalized.includes(pattern.trim()));
}

function isQuestionableAvailabilityStatus(value?: string | null): boolean {
  const normalized = normalizeStatus(value);
  if (!normalized) return false;
  return (
    normalized === "Q" ||
    normalized === "QUESTIONABLE" ||
    normalized === "DOUBTFUL" ||
    normalized.includes("QUESTIONABLE") ||
    normalized.includes("DOUBTFUL") ||
    normalized.includes("LIMITED") ||
    normalized.includes("DNP")
  );
}

function getPlayerAvailabilityStatus(player: AIEvidencePlayerContext): string | null {
  return cleanText(player.injuryStatus) ||
    cleanText(player.nflStatus) ||
    cleanText(player.rosterStatus) ||
    cleanText(player.weeklyProjectionStatus);
}

const PROVIDER_ATTRIBUTION_PATTERN = /\b(?:FantasyPros|DraftSharks|KeepTradeCut|KTC|FantasyCalc|Flock Fantasy|DynastyProcess|Dynasty Nerds|Fantasy Nerds|Dynasty Dealer)\b/i;

function sanitizeProviderDetail(value?: string | null): string | null {
  const clean = cleanText(value);
  if (!clean) return null;
  return clean.replace(PROVIDER_ATTRIBUTION_PATTERN, "stored source");
}

function sanitizeSourceTraceLabel(value?: string | null): string {
  const clean = cleanText(value) || "Source trace";
  if (!PROVIDER_ATTRIBUTION_PATTERN.test(clean)) return clean;
  if (/schedule|sos|matchup/i.test(clean)) return "Stored schedule snapshot";
  if (/projection/i.test(clean)) return "Stored projection snapshot";
  if (/news/i.test(clean)) return "Stored news snapshot";
  if (/injur|practice|availability/i.test(clean)) return "Stored injury snapshot";
  if (/rank|ecr|adp|ros|ww|waiver/i.test(clean)) return "Stored ranking snapshot";
  if (/value|market|source/i.test(clean)) return "Stored value evidence";
  return "Stored evidence";
}

function normalizeSourceTrace(sourceTrace?: Array<string | AISourceTrace>): AISourceTrace[] {
  const seen = new Set<string>();
  const result: AISourceTrace[] = [];
  (sourceTrace || []).forEach(item => {
    const rawTrace = typeof item === "string" ? { label: item } : item;
    const label = sanitizeSourceTraceLabel(rawTrace.label);
    const trace: AISourceTrace =
      typeof item === "string"
        ? { label }
        : { ...item, label, detail: sanitizeProviderDetail(item.detail) };
    const key = `${trace.label}|${trace.status || ""}|${trace.detail || ""}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trace);
  });
  return result.slice(0, 8);
}

function normalizeCalibrationText(value?: string | null): string | null {
  const clean = cleanText(value);
  return clean ? clean.toLowerCase() : null;
}

function getSourceTraceHealth(trace: AISourceTrace): "loaded" | "missing" | "unhealthy" | "unknown" {
  const status = String(trace.status || "").trim().toLowerCase();
  const detail = String(trace.detail || "").trim();
  if (
    status === "missing" ||
    /\b(?:0|zero)\s+rows?\b|no source|empty source|source empty|provider disabled|source disabled/i.test(detail)
  ) return "missing";
  if (
    status === "stale" ||
    status === "error" ||
    status === "limited" ||
    status === "unavailable" ||
    status === "unverified"
  ) return "unhealthy";
  if (!status || status === "loaded") return "loaded";
  return "unknown";
}

function getCalibrationSourceAgreement(input: {
  hardBlockers: string[];
  missingEvidence: string[];
  sourceTrace: AISourceTrace[];
}): string {
  if (input.hardBlockers.length) return "conflicted";
  if (input.missingEvidence.length >= 2) return "thin";
  if (!input.sourceTrace.length) return "missing";
  const traceHealth = input.sourceTrace.map(getSourceTraceHealth);
  if (traceHealth.every(status => status === "missing")) return "missing";
  if (traceHealth.some(status => status === "missing" || status === "unhealthy")) return "split";
  if (traceHealth.every(status => status === "loaded")) return "aligned";
  return "unknown";
}

function getCalibrationGroupValue(
  input: AIEvidenceInput,
  leagueContext: AIEvidenceLeagueContext,
  label: AIConfidenceLabel,
  sourceAgreement: string,
  key: string
): string | null {
  if (key === "surface") return input.surface;
  if (key === "action") return input.action;
  if (key === "label") return label;
  if (key === "sourceAgreement") return sourceAgreement;
  if (key === "leagueFormat") return input.leagueValueMode || leagueContext.valueMode || null;
  if (key === "manager") return input.calibrationManager || null;
  if (key === "league") return input.calibrationLeagueId || null;
  if (key === "leagueSharpness") return input.leagueActivity?.sharpnessTier || null;
  if (key === "managerArchetype") return input.calibrationManagerArchetype || null;
  if (key === "waiverMode") return leagueContext.waiverMode || null;
  if (key === "qbFormat") return leagueContext.qbFormat || null;
  if (key === "teamCountBucket") {
    const teamCount = Number(leagueContext.teamCount || 0);
    if (!teamCount) return null;
    if (teamCount <= 10) return "small";
    if (teamCount >= 14) return "deep";
    return "standard";
  }
  return null;
}

function calibrationAdjustmentMatches(input: {
  adjustment: AIEvidenceCalibrationAdjustment;
  evidenceInput: AIEvidenceInput;
  leagueContext: AIEvidenceLeagueContext;
  label: AIConfidenceLabel;
  sourceAgreement: string;
}): boolean {
  if (input.adjustment.scope === "global") return true;
  const entries = Object.entries(input.adjustment.group || {});
  if (!entries.length) return false;
  return entries.every(([key, expected]) => {
    const actual = getCalibrationGroupValue(
      input.evidenceInput,
      input.leagueContext,
      input.label,
      input.sourceAgreement,
      key
    );
    return normalizeCalibrationText(actual) === normalizeCalibrationText(expected);
  });
}

function getCalibrationAdjustmentSpecificity(adjustment: AIEvidenceCalibrationAdjustment): number {
  return Object.keys(adjustment.group || {}).length;
}

function getCalibrationFallbackPriority(adjustment: AIEvidenceCalibrationAdjustment): number {
  const group = adjustment.group || {};
  if (group.manager) return 600;
  if (group.league) return 500;
  if (group.managerArchetype) return 400;
  if (group.leagueSharpness) return 300;
  if (group.waiverMode || group.qbFormat || group.teamCountBucket || group.leagueFormat) return 220;
  if (adjustment.scope === "global") return 0;
  return 100;
}

function findEvidenceCalibrationAdjustment(input: {
  evidenceInput: AIEvidenceInput;
  leagueContext: AIEvidenceLeagueContext;
  label: AIConfidenceLabel;
  sourceAgreement: string;
}): AIEvidenceCalibrationAdjustment | null {
  const profile = input.evidenceInput.calibrationProfile;
  const candidates = [
    profile?.globalAdjustment || null,
    ...(profile?.adjustments || []),
  ].filter((adjustment): adjustment is AIEvidenceCalibrationAdjustment => Boolean(adjustment));

  return candidates
    .filter(adjustment => adjustment.scoreAdjustment !== 0 || adjustment.confidenceCap !== null)
    .filter(adjustment => calibrationAdjustmentMatches({ ...input, adjustment }))
    .sort((a, b) =>
      getCalibrationFallbackPriority(b) - getCalibrationFallbackPriority(a) ||
      getCalibrationAdjustmentSpecificity(b) - getCalibrationAdjustmentSpecificity(a) ||
      Math.abs(b.scoreAdjustment) - Math.abs(a.scoreAdjustment) ||
      Number(b.scoredCount || 0) - Number(a.scoredCount || 0)
    )[0] || null;
}

function normalizeSlot(slot?: string | null): string {
  const normalized = String(slot || "").toUpperCase().replace(/[^A-Z_]/g, "");
  if (normalized === "DST" || normalized === "D" || normalized === "DEFENSE") return "DEF";
  if (normalized === "PK") return "K";
  if (normalized === "OP") return "SUPER_FLEX";
  return normalized;
}

function normalizeQbFormat(value?: string | null): AIEvidenceQbFormat {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (normalized === "sf" || normalized === "sflex" || normalized === "superflex" || normalized === "super_flex") {
    return "superflex";
  }
  if (normalized === "2qb" || normalized === "two_qb" || normalized === "twoqb") return "two_qb";
  if (normalized === "1qb" || normalized === "one_qb" || normalized === "oneqb") return "one_qb";
  return "unknown";
}

function inferQbFormat(rosterSlots: string[], starterSlots: string[]): AIEvidenceQbFormat {
  const slots = (starterSlots.length ? starterSlots : rosterSlots).map(normalizeSlot);
  if (slots.some(slot => slot === "SUPER_FLEX")) return "superflex";
  if (slots.filter(slot => slot === "QB").length >= 2) return "two_qb";
  if (slots.length) return "one_qb";
  return "unknown";
}

function safeNumeric(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getPassingTdPointsFromSummary(summary?: string | null): number | null {
  const match = String(summary || "").match(/(\d+(?:\.\d+)?)\s*-?\s*point passing TD/i);
  if (!match) return null;
  return safeNumeric(match[1]);
}

function getLeagueContextScoringLabel(context: AIEvidenceLeagueContext): string {
  const scoring = cleanText(context.scoringSummary);
  if (scoring) return scoring;

  const reception = safeNumeric(context.receptionScoring);
  const ppr =
    reception === 1
      ? "PPR"
      : reception === 0.5
        ? "Half-PPR"
        : reception === 0
          ? "Standard"
          : reception !== null
            ? `${reception} PPR`
            : null;
  const tep = safeNumeric(context.tightEndPremium);
  const passTd = safeNumeric(context.passingTdPoints);
  return [
    ppr,
    tep && tep > 0 ? `TE +${tep}/rec` : null,
    passTd && passTd > 0 ? `${passTd}-point passing TD` : null,
  ].filter(Boolean).join(", ");
}

function normalizeLeagueContext(input: AIEvidenceInput): AIEvidenceLeagueContext {
  const provided = input.leagueContext || {};
  const rosterSlots = (provided.rosterSlots || []).map(normalizeSlot).filter(Boolean);
  const starterSlots = (provided.starterSlots || []).map(normalizeSlot).filter(Boolean);
  const qbFormat = normalizeQbFormat(provided.qbFormat) !== "unknown"
    ? normalizeQbFormat(provided.qbFormat)
    : inferQbFormat(rosterSlots, starterSlots);
  const scoringSummary = cleanText(provided.scoringSummary);

  return {
    valueMode: provided.valueMode || input.leagueValueMode || null,
    teamCount: safeNumeric(provided.teamCount),
    qbFormat,
    receptionScoring: safeNumeric(provided.receptionScoring),
    tightEndPremium: safeNumeric(provided.tightEndPremium),
    passingTdPoints:
      safeNumeric(provided.passingTdPoints) ??
      getPassingTdPointsFromSummary(scoringSummary),
    rosterSlots,
    starterSlots,
    scoringSummary,
    waiverMode: provided.waiverMode || null,
    formatLabel: cleanText(provided.formatLabel),
  };
}

function hasKnownStarterSlots(context: AIEvidenceLeagueContext): boolean {
  return Boolean(context.starterSlots?.length || context.rosterSlots?.length);
}

function leagueStartsPosition(context: AIEvidenceLeagueContext, position: string): boolean {
  const starterSlots = context.starterSlots?.length ? context.starterSlots : context.rosterSlots || [];
  if (!starterSlots.length) return true;
  const normalizedPosition = normalizeSlot(position);
  return starterSlots.some(slot => {
    if (slot === normalizedPosition) return true;
    if (normalizedPosition === "QB" && slot === "SUPER_FLEX") return true;
    if ((normalizedPosition === "RB" || normalizedPosition === "WR" || normalizedPosition === "TE") && (slot === "FLEX" || slot === "SUPER_FLEX")) return true;
    if ((normalizedPosition === "WR" || normalizedPosition === "TE") && slot === "WRRB_FLEX") return true;
    if ((normalizedPosition === "RB" || normalizedPosition === "WR") && slot === "REC_FLEX") return true;
    return false;
  });
}

function formatQbFormatLabel(format?: AIEvidenceQbFormat | null): string | null {
  if (format === "superflex") return "Superflex";
  if (format === "two_qb") return "2QB";
  if (format === "one_qb") return "1QB";
  return null;
}

function getLeagueContextTrace(context: AIEvidenceLeagueContext): AISourceTrace | null {
  const details = [
    context.teamCount ? `${context.teamCount}-team` : null,
    formatQbFormatLabel(context.qbFormat),
    getLeagueContextScoringLabel(context),
  ].filter(Boolean);
  if (!details.length && !context.formatLabel) return null;
  return {
    label: "League format context",
    status: "loaded",
    detail: context.formatLabel || details.join(" "),
  };
}

function normalizeLeagueTempo(value?: string | null): AIEvidenceLeagueTempo {
  if (value === "quiet" || value === "balanced" || value === "active" || value === "hyperactive") {
    return value;
  }
  return "unknown";
}

function getLeagueActivityTrace(activity?: AIEvidenceLeagueActivityContext | null): AISourceTrace | null {
  if (!activity) return null;
  const tradeTempo = normalizeLeagueTempo(activity.tradeTempo);
  const waiverTempo = normalizeLeagueTempo(activity.waiverTempo);
  const hasSignal = Boolean(
    tradeTempo !== "unknown" ||
    waiverTempo !== "unknown" ||
    activity.tradeSignalCount ||
    activity.waiverSignalCount ||
    activity.transactionSignalCount
  );
  if (!hasSignal) return null;

  const detail = cleanText(activity.evidenceLabel) || [
    tradeTempo !== "unknown" ? `${tradeTempo} trade market` : null,
    waiverTempo !== "unknown" ? `${waiverTempo} waiver market` : null,
    activity.tradeSignalCount ? `${activity.tradeSignalCount} trade signals` : null,
    activity.waiverSignalCount ? `${activity.waiverSignalCount} waiver signals` : null,
  ].filter(Boolean).join(", ");

  return {
    label: "League activity profile",
    status: (activity.sampleSize || 0) > 0 ? "loaded" : "limited",
    detail,
  };
}

function traceMentionsAny(trace: AISourceTrace, patterns: RegExp[]): boolean {
  const text = [trace.label, trace.detail].filter(Boolean).join(" ");
  return patterns.some(pattern => pattern.test(text));
}

function hasRecentRoleOrUsageProof(input: AIEvidenceInput, player: AIEvidencePlayerContext, sourceTrace: AISourceTrace[]): boolean {
  if (player.hasRecentUsage || player.hasRoleContext) return true;
  if (cleanText(player.weeklyProjectionStatus)) return true;
  if (input.schedule?.hasScheduleData) return true;

  const signalModes = new Set(input.signalModes || []);
  if (signalModes.has("schedule")) return true;

  return sourceTrace.some(trace =>
    traceMentionsAny(trace, [
      /usage/i,
      /\brole\b/i,
      /\bsnaps?\b/i,
      /route/i,
      /target/i,
      /carr(?:y|ies)/i,
      /touch/i,
      /projection/i,
      /\bECR\b/i,
      /matchup/i,
    ])
  );
}

export function getAIEvidenceLeagueContextFromDiagnostics(
  diagnostics?: AIEvidenceLeagueDiagnosticsLike | null,
  fallbackValueMode?: AIEvidenceLeagueValueMode | null
): AIEvidenceLeagueContext {
  const rosterSlots = diagnostics?.rosterSlots || [];
  const starterSlots = diagnostics?.starterSlots || [];
  const inferredQbFormat = inferQbFormat(rosterSlots, starterSlots);
  const scoringSummary = diagnostics?.scoringSummary || null;

  return {
    valueMode: diagnostics?.valueMode || fallbackValueMode || null,
    teamCount: diagnostics?.teamCount ?? null,
    qbFormat: diagnostics?.qbFormat || inferredQbFormat,
    receptionScoring: diagnostics?.receptionScoring ?? null,
    tightEndPremium: diagnostics?.tightEndPremium ?? null,
    waiverMode: diagnostics?.waiverMode || null,
    passingTdPoints:
      diagnostics?.passingTdPoints ??
      getPassingTdPointsFromSummary(scoringSummary),
    rosterSlots,
    starterSlots,
    scoringSummary,
    formatLabel: [
      diagnostics?.teamCount ? `${diagnostics.teamCount}-team` : null,
      formatQbFormatLabel(diagnostics?.qbFormat || inferredQbFormat),
      scoringSummary,
    ].filter(Boolean).join(" "),
  };
}

function getLeagueContextLowValueThreshold(input: AIEvidenceInput, context: AIEvidenceLeagueContext, position: string): number {
  let threshold = input.leagueValueMode === "redraft" ? 900 : 1200;
  const teamCount = context.teamCount || null;
  if (teamCount && teamCount <= 10) threshold += 250;
  if (teamCount && teamCount >= 14) threshold -= 250;

  if (position === "QB") {
    if (context.qbFormat === "superflex" || context.qbFormat === "two_qb") {
      threshold -= 450;
    } else if (context.qbFormat === "one_qb") {
      threshold += 450;
    }
  }

  if (position === "TE" && (context.tightEndPremium || 0) > 0) {
    threshold -= Math.min(350, Math.round((context.tightEndPremium || 0) * 300));
  }

  if ((position === "WR" || position === "TE") && context.receptionScoring === 0) {
    threshold += 150;
  }

  return Math.max(300, threshold);
}

function applyLeagueContextModifiers(input: AIEvidenceInput, context: AIEvidenceLeagueContext, position: string, isPickupLike: boolean): {
  evidence: string[];
  penalties: AIEvidencePenalty[];
} {
  const evidence: string[] = [];
  const penalties: AIEvidencePenalty[] = [];
  const actionCanBeFormatSensitive =
    isPickupLike ||
    input.action === "start" ||
    input.action === "trade" ||
    input.action === "hold";

  if (position === "QB" && actionCanBeFormatSensitive) {
    if (context.qbFormat === "superflex" || context.qbFormat === "two_qb") {
      evidence.push(`${formatQbFormatLabel(context.qbFormat)} format raises QB scarcity.`);
    } else if (context.qbFormat === "one_qb" && isPickupLike) {
      penalties.push({
        label: "1QB format prevents fringe QB pickup advice from inflating",
        points: 8,
      });
    }
  }

  if (position === "TE" && actionCanBeFormatSensitive && (context.tightEndPremium || 0) > 0) {
    evidence.push(`TE premium scoring adds +${context.tightEndPremium}/rec context.`);
  }

  if ((position === "K" || position === "DEF") && isPickupLike && hasKnownStarterSlots(context) && !leagueStartsPosition(context, position)) {
    penalties.push({
      label: `This league does not start ${position}, so pickup advice is limited`,
      points: 30,
    });
  }

  if ((position === "WR" || position === "TE") && context.receptionScoring === 0 && actionCanBeFormatSensitive) {
    penalties.push({
      label: "Standard scoring reduces reception-only signal confidence",
      points: 4,
    });
  }

  return { evidence, penalties };
}

function applyLeagueActivityModifiers(input: AIEvidenceInput, activity: AIEvidenceLeagueActivityContext | null | undefined, isPickupLike: boolean): {
  evidence: string[];
  penalties: AIEvidencePenalty[];
  confidenceCap?: { value: number; reason: string } | null;
} {
  const tradeTempo = normalizeLeagueTempo(activity?.tradeTempo);
  const waiverTempo = normalizeLeagueTempo(activity?.waiverTempo);
  const tradeSignals = Number(activity?.tradeSignalCount || 0);
  const waiverSignals = Number(activity?.waiverSignalCount || 0);
  const sharpnessScore = Number(activity?.sharpnessScore || 0);
  const sharpnessLabel = cleanText(activity?.sharpnessLabel);
  const sharpnessActionBias = cleanText(activity?.sharpnessActionBias);
  const sampleSize = Number(activity?.sampleSize || 0);
  const evidence: string[] = [];
  const penalties: AIEvidencePenalty[] = [];
  let confidenceCap: { value: number; reason: string } | null = null;

  if (input.action === "trade") {
    if (tradeTempo === "active" || tradeTempo === "hyperactive") {
      evidence.push(`${tradeTempo === "hyperactive" ? "Very active" : "Active"} league trade market supports trade-action confidence.`);
    } else if (tradeTempo === "quiet") {
      penalties.push({
        label: "Quiet league trade market lowers trade-action confidence",
        points: 8,
      });
      confidenceCap = { value: 72, reason: "Quiet league trade market" };
    } else if (sampleSize > 0 && tradeSignals <= 1) {
      penalties.push({
        label: "Thin league trade history limits trade-action confidence",
        points: 5,
      });
      confidenceCap = { value: 76, reason: "Thin league trade history" };
    }

    if (sharpnessScore >= 72) {
      evidence.push(`${sharpnessLabel || "Sharp league"} context supports acting before clean trade windows disappear.`);
    } else if (sharpnessScore > 0 && sharpnessScore < 38) {
      penalties.push({
        label: "Sleepy league context lowers trade urgency",
        points: 6,
      });
      confidenceCap = confidenceCap || { value: 76, reason: "Low league sharpness" };
    }
  }

  if (isPickupLike) {
    if (waiverTempo === "active" || waiverTempo === "hyperactive") {
      evidence.push(`${waiverTempo === "hyperactive" ? "Very fast" : "Active"} waiver market raises urgency for available-player reads.`);
    } else if (waiverTempo === "quiet" && waiverSignals > 0) {
      penalties.push({
        label: "Quiet waiver market lowers urgency for pickup advice",
        points: 4,
      });
    }

    if (sharpnessScore >= 86 || sharpnessActionBias === "overpay-or-pass") {
      evidence.push(`${sharpnessLabel || "Shark-tank league"} context means obvious adds rarely stay cheap.`);
    } else if (sharpnessScore >= 72 || sharpnessActionBias === "attack") {
      evidence.push(`${sharpnessLabel || "Sharp league"} context raises timing urgency on backed pickup reads.`);
    } else if (sharpnessScore > 0 && sharpnessScore < 38) {
      penalties.push({
        label: "Sleepy league context rewards patience over chase bids",
        points: 3,
      });
    }
  }

  return { evidence, penalties, confidenceCap };
}

function applyCap(
  currentCap: number,
  currentReason: string | null,
  nextCap: number,
  nextReason: string
): { cap: number; reason: string | null } {
  if (nextCap >= currentCap) return { cap: currentCap, reason: currentReason };
  return { cap: clampPercent(nextCap), reason: nextReason };
}

function getLabel(score: number, blockers: string[], evidenceCount: number): AIConfidenceLabel {
  if (blockers.length) return "blocked";
  if (evidenceCount <= 0) return "thin";
  const found = STRONG_LABEL_MINIMUMS.find(([, minimum]) => score >= minimum);
  return found?.[0] || "thin";
}

function getWhyThisFired(result: {
  label: AIConfidenceLabel;
  evidence: string[];
  missingEvidence: string[];
  hardBlockers: string[];
  softPenalties: AIEvidencePenalty[];
}): string {
  if (result.hardBlockers.length) {
    return `Do not act yet: ${result.hardBlockers.slice(0, 2).join(" ")}`;
  }

  if (!result.evidence.length) {
    const missing = result.missingEvidence.slice(0, 2).join(" ");
    return missing
      ? `Verify first: ${missing}`
      : "Verify first: no usable signal was supplied.";
  }

  const evidence = result.evidence.slice(0, 3).join(" ");
  const penalty = result.softPenalties[0]?.label;
  return penalty ? `${evidence} Check: ${penalty}.` : evidence;
}

export function evaluateAIEvidence(input: AIEvidenceInput): AIEvidenceResult {
  const evidence = uniqueTexts(input.evidence || []);
  const missingEvidence = uniqueTexts(input.missingEvidence || []);
  const hardBlockers: string[] = [];
  const softPenalties: AIEvidencePenalty[] = [];
  const leagueContext = normalizeLeagueContext(input);
  const leagueContextTrace = getLeagueContextTrace(leagueContext);
  const leagueActivityTrace = getLeagueActivityTrace(input.leagueActivity);
  const explicitSourceTrace = normalizeSourceTrace(input.sourceTrace || []);
  const sourceTrace = normalizeSourceTrace([
    ...(leagueContextTrace ? [leagueContextTrace] : []),
    ...(leagueActivityTrace ? [leagueActivityTrace] : []),
    ...explicitSourceTrace,
  ]);
  const player = input.player || {};
  const schedule = input.schedule || {};
  const position = String(player.position || "").toUpperCase();
  const isPickupLike =
    input.action === "pickup" ||
    input.action === "stash" ||
    input.action === "stream";
  const needsActiveTeam = input.requiresActiveTeam ?? isPickupLike;
  const needsLiveAvailability = input.requiresLiveAvailability ?? isPickupLike;
  const sourceCount = Number(player.sourceCount || 0);
  const value = Number(player.value || 0);
  let confidenceCap = clampPercent(input.confidenceCap ?? 100);
  let confidenceCapReason = cleanText(input.confidenceCapReason);
  const leagueModifiers = applyLeagueContextModifiers(input, leagueContext, position, isPickupLike);
  leagueModifiers.evidence.forEach(item => evidence.push(item));
  leagueModifiers.penalties.forEach(item => softPenalties.push(item));
  const leagueActivityModifiers = applyLeagueActivityModifiers(input, input.leagueActivity, isPickupLike);
  leagueActivityModifiers.evidence.forEach(item => evidence.push(item));
  leagueActivityModifiers.penalties.forEach(item => softPenalties.push(item));
  if (leagueActivityModifiers.confidenceCap) {
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      leagueActivityModifiers.confidenceCap.value,
      leagueActivityModifiers.confidenceCap.reason
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }
  if (
    input.action === "trade" &&
    !Number(input.leagueActivity?.sampleSize || 0) &&
    !Number(input.leagueActivity?.tradeSignalCount || 0)
  ) {
    missingEvidence.push("No league trade or manager-history sample returned.");
    softPenalties.push({
      label: "Missing trade/manager history limits trade-action confidence",
      points: 8,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      57,
      "Missing trade/manager history"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if (needsLiveAvailability && player.owner) {
    hardBlockers.push(`Roster ownership says ${player.name || "this player"} is already on ${player.owner}.`);
  }

  if (isPickupLike && needsLiveAvailability && input.player && !hasRosterAvailabilityProof(player)) {
    missingEvidence.push("No current roster ownership or availability proof returned for this action read.");
    softPenalties.push({
      label: "Missing roster ownership proof limits available-player confidence",
      points: 8,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      55,
      "Missing roster ownership proof"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if (needsLiveAvailability && player.recentlyAddedBy) {
    hardBlockers.push(`Recent transactions already show ${player.name || "this player"} added by ${player.recentlyAddedBy}.`);
  }

  if (input.action === "start" && player.isStarter) {
    hardBlockers.push(`${player.name || "This player"} is already in the starting lineup.`);
  }

  if (input.action === "sit" && player.isStarter === false) {
    hardBlockers.push(`${player.name || "This player"} is already out of the starting lineup.`);
  }

  if ((input.action === "start" || input.action === "sit") && input.player && !hasLineupStateProof(player)) {
    missingEvidence.push("No current lineup state proof returned for this start/sit read.");
    softPenalties.push({
      label: "Missing lineup state proof limits start/sit confidence",
      points: 10,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      55,
      "Missing lineup state proof"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if ((input.action === "start" || input.action === "sit") && player.isGameLocked) {
    hardBlockers.push(`${player.name || "This player"} cannot be changed because the game is already locked.`);
  }

  if (isStartLikeAction(input.action) && (player.hasByeWeek || normalizeStatus(player.weeklyProjectionStatus) === "BYE")) {
    hardBlockers.push(`${player.name || "This player"} is on bye for this matchup window.`);
  }

  const availabilityStatus = getPlayerAvailabilityStatus(player);
  const unavailableStatuses = [
    player.injuryStatus,
    player.nflStatus,
    player.rosterStatus,
    player.weeklyProjectionStatus,
  ];
  if (isImmediateAvailabilityAction(input.action) && unavailableStatuses.some(isHardUnavailableStatus)) {
    hardBlockers.push(`${player.name || "This player"} is unavailable${availabilityStatus ? ` (${availabilityStatus})` : ""}.`);
  } else if (isStartLikeAction(input.action) && unavailableStatuses.some(isQuestionableAvailabilityStatus)) {
    softPenalties.push({
      label: `${player.name || "This player"} has an unresolved availability tag${availabilityStatus ? ` (${availabilityStatus})` : ""}`,
      points: 12,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      58,
      "Unresolved player availability"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if (needsActiveTeam && position !== "DEF" && isNoActiveTeam(player.team)) {
    hardBlockers.push(`No active NFL team is attached to ${player.name || "this player"}.`);
  }

  if ((position === "K" || position === "DEF") && isPickupLike && hasKnownStarterSlots(leagueContext) && !leagueStartsPosition(leagueContext, position)) {
    hardBlockers.push(`League format does not start ${position}, so pickup advice is blocked.`);
  }

  if (isPickupLike && player.hasProspectOnlyValue) {
    hardBlockers.push("Prospect-only value cannot power active-roster waiver advice.");
  }

  const signalModes = new Set(input.signalModes || []);
  const hasCurrentSignal =
    signalModes.has("redraft") ||
    signalModes.has("current") ||
    signalModes.has("schedule") ||
    Boolean(player.hasCurrentSeasonValue);
  const hasDynastySignal =
    signalModes.has("dynasty") ||
    signalModes.has("market") ||
    signalModes.has("prospect") ||
    Boolean(player.hasDynastyValue);
  const requiresCurrentSeasonForRedraftAction =
    input.requiresCurrentSeasonEvidence ??
    (isPickupLike || input.action === "start" || input.action === "sit");
  if (
    input.leagueValueMode === "redraft" &&
    requiresCurrentSeasonForRedraftAction &&
    !hasCurrentSignal
  ) {
    hardBlockers.push("Redraft read has no current-season evidence.");
  }

  const hasStartSitProjectionProof = Boolean(
    cleanText(player.weeklyProjectionStatus) ||
    player.hasByeWeek ||
    schedule.hasScheduleData ||
    signalModes.has("schedule") ||
    explicitSourceTrace.some(trace => traceMentionsAny(trace, [/projection/i, /matchup/i, /schedule/i, /\bSOS\b/i, /\bECR\b/i]))
  );
  if ((input.action === "start" || input.action === "sit") && !hasStartSitProjectionProof) {
    missingEvidence.push("No projection or matchup proof returned for this start/sit read.");
    softPenalties.push({
      label: "Missing projection or matchup proof limits start/sit confidence",
      points: 10,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      56,
      "Missing start/sit projection or matchup proof"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  const lowValueThreshold = input.lowValueThreshold ?? getLeagueContextLowValueThreshold(input, leagueContext, position);
  const hasScheduleEvidence = Boolean(schedule.hasScheduleData || signalModes.has("schedule"));
  const isDirectPlayerAction =
    input.action === "pickup" ||
    input.action === "stash" ||
    input.action === "start" ||
    input.action === "sit" ||
    input.action === "trade" ||
    input.action === "avoid";
  if (
    input.player &&
    isDirectPlayerAction &&
    isSkillPlayerPosition(position) &&
    !hasRecentRoleOrUsageProof(input, player, explicitSourceTrace)
  ) {
    missingEvidence.push("No recent role, usage, projection, or matchup proof returned for this player action read.");
    softPenalties.push({
      label: "Missing role or usage proof limits player-action confidence",
      points: 8,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      57,
      "Missing role or usage proof"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }
  const needsDynastyMarketEvidence =
    input.leagueValueMode === "dynasty" &&
    (input.action === "pickup" ||
      input.action === "stash" ||
      input.action === "trade" ||
      input.action === "avoid") &&
    !hasScheduleEvidence;
  if (input.player && needsDynastyMarketEvidence && !hasDynastySignal) {
    missingEvidence.push("No dynasty or market evidence returned for this dynasty action read.");
    softPenalties.push({
      label: "Missing dynasty/market evidence limits dynasty action confidence",
      points: 10,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      56,
      "Missing dynasty/market evidence"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }
  if (
    input.player &&
    isDirectPlayerAction &&
    !hasScheduleEvidence &&
    sourceCount === 1 &&
    explicitSourceTrace.length <= 1
  ) {
    missingEvidence.push("Only one player source returned for this action read.");
    softPenalties.push({
      label: "Thin player source count limits action confidence",
      points: 8,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      57,
      "Thin player source count"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }
  if (isPickupLike && sourceCount <= 1 && value > 0 && value < lowValueThreshold && !hasScheduleEvidence) {
    hardBlockers.push("Low source count plus low value cannot become a best-available recommendation.");
  }

  if (input.player && sourceCount <= 0 && !explicitSourceTrace.length && input.action !== "hold") {
    missingEvidence.push("No player source trace returned for this read.");
    softPenalties.push({
      label: "Missing player source trace limits action confidence",
      points: 10,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      54,
      "Missing player source trace"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if (!evidence.length) {
    hardBlockers.push("No positive evidence was supplied.");
  }

  if ((position === "K" || position === "DEF" || input.action === "stream") && !schedule.hasScheduleData) {
    missingEvidence.push(schedule.missingReason || "Missing schedule data limits streamer, kicker, and D/ST confidence.");
    softPenalties.push({
      label: "Missing schedule data limits streamer/K/DST confidence",
      points: 18,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      56,
      "Missing schedule data"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if ((position === "K" || position === "DEF" || input.action === "stream") && schedule.isRoughStart) {
    softPenalties.push({
      label: "Rough early K/DST schedule strongly penalizes pickup advice",
      points: 42,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      52,
      "Rough early schedule"
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  } else if (schedule.isStrongStart) {
    evidence.push("Short-term schedule window supports the action.");
  }

  const staleTrace = sourceTrace.find(trace => {
    const health = getSourceTraceHealth(trace);
    if (health === "missing" || health === "unhealthy") return true;
    return Number(trace.ageHours || 0) >= 168;
  });
  if (staleTrace) {
    const traceHealth = getSourceTraceHealth(staleTrace);
    const defaultStaleSourceCap = input.staleSourceCap ?? (traceHealth === "missing" || staleTrace.status === "error" ? 48 : 64);
    const staleSourceCap = isDirectPlayerAction
      ? Math.min(defaultStaleSourceCap, traceHealth === "missing" || staleTrace.status === "error" ? 48 : 55)
      : defaultStaleSourceCap;
    if (isDirectPlayerAction && (staleSourceCap < defaultStaleSourceCap || traceHealth === "missing" || traceHealth === "unhealthy")) {
      missingEvidence.push("Fresh stored evidence is stale or unhealthy for this action read.");
    }
    softPenalties.push({
      label: `${staleTrace.label} is stale or unhealthy`,
      points: traceHealth === "missing" || staleTrace.status === "error" ? 24 : 16,
    });
    const capped = applyCap(
      confidenceCap,
      confidenceCapReason,
      staleSourceCap,
      `${staleTrace.label} evidence freshness`
    );
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  const rawScore = clampPercent(input.baseScore ?? 0);
  const penaltyPoints = softPenalties.reduce((sum, penalty) => sum + penalty.points, 0);
  const evidenceBonus = Math.min(12, evidence.length * 3);
  const missingPenalty = Math.min(18, missingEvidence.length * 4);
  const uncappedScore = hardBlockers.length
    ? 0
    : rawScore + evidenceBonus - penaltyPoints - missingPenalty;
  const preliminaryFinalScore = clampPercent(Math.min(confidenceCap, uncappedScore));
  const preliminaryLabel = getLabel(preliminaryFinalScore, hardBlockers, evidence.length);
  const sourceAgreement = getCalibrationSourceAgreement({
    hardBlockers,
    missingEvidence,
    sourceTrace,
  });
  const calibrationAdjustment = findEvidenceCalibrationAdjustment({
    evidenceInput: input,
    leagueContext,
    label: preliminaryLabel,
    sourceAgreement,
  });
  let calibrationScoreAdjustment = 0;
  let appliedCalibrationAdjustment: AIEvidenceAppliedCalibrationAdjustment | null = null;
  if (calibrationAdjustment) {
    calibrationScoreAdjustment = Number(calibrationAdjustment.scoreAdjustment || 0);
    if (calibrationAdjustment.confidenceCap !== null) {
      const capped = applyCap(
        confidenceCap,
        confidenceCapReason,
        calibrationAdjustment.confidenceCap,
        `Calibration memory: ${calibrationAdjustment.reason}`
      );
      confidenceCap = capped.cap;
      confidenceCapReason = capped.reason;
    }

    if (calibrationScoreAdjustment < 0) {
      softPenalties.push({
        label: `Calibration memory: ${calibrationAdjustment.reason}`,
        points: Math.abs(calibrationScoreAdjustment),
      });
    } else if (calibrationScoreAdjustment > 0) {
      evidence.push(`Calibration memory supports this read: ${calibrationAdjustment.reason}`);
    }

    if (
      isDirectPlayerAction &&
      Number(calibrationAdjustment.scoredCount || 0) < MIN_RESOLVED_OUTCOMES_FOR_ACTION_CONFIDENCE
    ) {
      missingEvidence.push("Too few resolved outcomes returned for this action read's calibration bucket.");
      softPenalties.push({
        label: "Insufficient resolved outcomes limit action confidence",
        points: 6,
      });
      const capped = applyCap(
        confidenceCap,
        confidenceCapReason,
        56,
        "Insufficient resolved outcomes"
      );
      confidenceCap = capped.cap;
      confidenceCapReason = capped.reason;
    }
  }
  const adjustedScore = hardBlockers.length
    ? 0
    : uncappedScore + calibrationScoreAdjustment;
  const finalScore = clampPercent(Math.min(confidenceCap, adjustedScore));
  const label = getLabel(finalScore, hardBlockers, evidence.length);
  if (calibrationAdjustment) {
    appliedCalibrationAdjustment = {
      key: calibrationAdjustment.key || null,
      scope: calibrationAdjustment.scope,
      reason: calibrationAdjustment.reason,
      scoreAdjustment: calibrationScoreAdjustment,
      confidenceCap: calibrationAdjustment.confidenceCap,
      priority: calibrationAdjustment.priority || null,
      recommendation: calibrationAdjustment.recommendation || null,
      scoredCount: Number(calibrationAdjustment.scoredCount || 0),
      pendingCount: Number(calibrationAdjustment.pendingCount || 0),
      hitRate: calibrationAdjustment.hitRate ?? null,
      baseFinalScore: preliminaryFinalScore,
      adjustedFinalScore: finalScore,
    };
  }
  const shouldRender = label !== "blocked" && evidence.length > 0;
  const canAct = canActionBecomeExecutable(input.action) && (
    label === "actionable" || label === "priority" || label === "high conviction"
  ) && !hardBlockers.length && !missingEvidence.length && !confidenceCapReason;
  const result = {
    evidence,
    missingEvidence,
    hardBlockers: uniqueTexts(hardBlockers),
    softPenalties,
    confidenceCap,
    confidenceCapReason,
    sourceTrace,
    rawScore,
    finalScore,
    label,
    shouldRender,
    canAct,
    whyThisFired: "",
    calibrationAdjustment: appliedCalibrationAdjustment,
  };
  result.whyThisFired = getWhyThisFired(result);
  return result;
}

export function getAIEvidenceReceiptItems(result: AIEvidenceResult): string[] {
  return uniqueTexts([
    ...result.evidence,
    ...result.hardBlockers.map(item => `Do not act yet: ${item}`),
    ...result.softPenalties.map(item => `Check: ${item.label}`),
    ...result.missingEvidence.map(item => `Verify first: ${item}`),
    result.confidenceCapReason
      ? `Confidence limited to ${result.confidenceCap}% because ${result.confidenceCapReason}`
      : null,
    result.calibrationAdjustment
      ? `Calibration memory: ${result.calibrationAdjustment.reason}`
      : null,
    ...result.sourceTrace.map(trace =>
      [
        trace.label,
        trace.status ? `(${trace.status})` : null,
        trace.detail,
      ]
        .filter(Boolean)
        .join(" ")
    ),
  ]);
}
