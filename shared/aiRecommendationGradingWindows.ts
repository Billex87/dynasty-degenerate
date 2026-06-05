export type AIRecommendationGradingWindowKind =
  | "weekly-lineup"
  | "waiver-follow-up"
  | "trade-follow-up"
  | "redraft-season"
  | "dynasty-draft-two-year"
  | "default";

export type AIRecommendationGradingWindow = {
  schemaVersion: 1;
  kind: AIRecommendationGradingWindowKind;
  label: string;
  minimumFinalGradeAt: string | null;
  expiresAt: string | null;
  evidenceRequired: string[];
  reason: string;
};

export type AIRecommendationGradingWindowInput = {
  createdAt: string | Date;
  season?: string | number | null;
  week?: string | number | null;
  surface?: string | null;
  action?: string | null;
  entityType?: string | null;
  valueMode?: string | null;
  recommendationType?: unknown;
  actionText?: unknown;
  archetypeKey?: unknown;
  archetypeLabel?: unknown;
  draftKind?: unknown;
};

const REDRAFT_SEASON_EVIDENCE = [
  "final standings",
  "playoff finish",
  "points for",
  "roster usage",
  "title outcome",
];

const DYNASTY_DRAFT_EVIDENCE = [
  "two-year player value movement",
  "two-year roster usage",
  "starter or trade-value outcome",
  "draft cost versus replacement outcome",
];

const SHORT_ACTION_EVIDENCE = [
  "transaction follow-through",
  "lineup or roster state",
  "near-term production or value movement",
];

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function lowerText(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function validDate(value?: string | Date | null): Date | null {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function toIsoDate(date: Date | null): string | null {
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function addHours(createdAt: Date | null, hours: number): string | null {
  if (!createdAt) return null;
  return toIsoDate(new Date(createdAt.getTime() + hours * 60 * 60 * 1000));
}

function seasonYear(input: AIRecommendationGradingWindowInput, createdAt: Date | null): number | null {
  const parsedSeason = Number(input.season);
  if (Number.isInteger(parsedSeason) && parsedSeason >= 2000 && parsedSeason <= 2100) return parsedSeason;
  return createdAt && Number.isFinite(createdAt.getTime()) ? createdAt.getUTCFullYear() : null;
}

function januaryFifteenthUtc(year: number | null): string | null {
  if (!year || !Number.isInteger(year)) return null;
  return new Date(Date.UTC(year, 0, 15, 12, 0, 0)).toISOString();
}

function combinedSignalText(input: AIRecommendationGradingWindowInput): string {
  return [
    input.surface,
    input.action,
    input.entityType,
    input.valueMode,
    input.recommendationType,
    input.actionText,
    input.archetypeKey,
    input.archetypeLabel,
    input.draftKind,
  ].map(lowerText).filter(Boolean).join(" ");
}

function isRedraftSeasonRead(input: AIRecommendationGradingWindowInput, text: string): boolean {
  if (lowerText(input.valueMode) !== "redraft") return false;
  const surface = lowerText(input.surface);
  const entityType = lowerText(input.entityType);
  return Boolean(
    surface === "overview" ||
    surface === "rankings" ||
    surface === "owner-intel" ||
    entityType === "league" ||
    entityType === "manager" ||
    /\b(roster construction|draft path|draft grade|season outcome|standings|playoff|points for|points-for|title|championship|league winner|redraft season)\b/.test(text)
  );
}

function isDynastyDraftRead(input: AIRecommendationGradingWindowInput, text: string): boolean {
  const mode = lowerText(input.valueMode);
  if (mode === "redraft") return false;
  return /\b(dynasty draft|rookie draft|startup draft|draft pick|draft path|draft grade|draft capital|rookie pick|rookie adp|startup adp)\b/.test(text);
}

function shortWindowHours(input: AIRecommendationGradingWindowInput): number {
  const action = lowerText(input.action);
  const surface = lowerText(input.surface);
  if (action === "stream" || action === "start" || action === "sit" || surface === "autopilot") return 36;
  if (surface === "waiver" || action === "pickup" || action === "stash") return 72;
  if (surface === "trade" || action === "trade") return 14 * 24;
  if (surface === "owner-intel" || surface === "rankings" || surface === "overview") return 30 * 24;
  return 7 * 24;
}

export function buildAIRecommendationGradingWindow(
  input: AIRecommendationGradingWindowInput
): AIRecommendationGradingWindow {
  const createdAt = validDate(input.createdAt);
  const year = seasonYear(input, createdAt);
  const text = combinedSignalText(input);

  if (isRedraftSeasonRead(input, text)) {
    const finalAt = januaryFifteenthUtc(year ? year + 1 : null);
    return {
      schemaVersion: 1,
      kind: "redraft-season",
      label: "Redraft season recommendation",
      minimumFinalGradeAt: finalAt,
      expiresAt: finalAt,
      evidenceRequired: REDRAFT_SEASON_EVIDENCE,
      reason: "Redraft roster-construction recommendations wait for end-of-season standings, playoff, points-for, roster-usage, and title evidence before final hit/miss grading.",
    };
  }

  if (isDynastyDraftRead(input, text)) {
    const finalAt = januaryFifteenthUtc(year ? year + 2 : null);
    return {
      schemaVersion: 1,
      kind: "dynasty-draft-two-year",
      label: "Dynasty draft recommendation",
      minimumFinalGradeAt: finalAt,
      expiresAt: finalAt,
      evidenceRequired: DYNASTY_DRAFT_EVIDENCE,
      reason: "Dynasty draft recommendations wait for a two-year outcome window before final hit/miss grading.",
    };
  }

  const action = lowerText(input.action);
  const surface = lowerText(input.surface);
  const expiresAt = addHours(createdAt, shortWindowHours(input));
  const kind: AIRecommendationGradingWindowKind =
    action === "stream" || action === "start" || action === "sit" || surface === "autopilot"
      ? "weekly-lineup"
      : surface === "waiver" || action === "pickup" || action === "stash"
        ? "waiver-follow-up"
        : surface === "trade" || action === "trade"
          ? "trade-follow-up"
          : "default";

  return {
    schemaVersion: 1,
    kind,
    label:
      kind === "weekly-lineup"
        ? "Weekly lineup recommendation"
        : kind === "waiver-follow-up"
          ? "Waiver recommendation"
          : kind === "trade-follow-up"
            ? "Trade recommendation"
            : "Recommendation",
    minimumFinalGradeAt: expiresAt,
    expiresAt,
    evidenceRequired: SHORT_ACTION_EVIDENCE,
    reason: "Short-action recommendations can grade once transaction, lineup, production, or value-movement evidence is available.",
  };
}

export function parseAIRecommendationGradingWindow(value: unknown): AIRecommendationGradingWindow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<AIRecommendationGradingWindow>;
  if (row.schemaVersion !== 1) return null;
  if (
    row.kind !== "weekly-lineup" &&
    row.kind !== "waiver-follow-up" &&
    row.kind !== "trade-follow-up" &&
    row.kind !== "redraft-season" &&
    row.kind !== "dynasty-draft-two-year" &&
    row.kind !== "default"
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    kind: row.kind,
    label: cleanText(row.label) || "Recommendation",
    minimumFinalGradeAt: toIsoDate(validDate(row.minimumFinalGradeAt || null)),
    expiresAt: toIsoDate(validDate(row.expiresAt || null)),
    evidenceRequired: Array.isArray(row.evidenceRequired)
      ? row.evidenceRequired.map(cleanText).filter(Boolean).slice(0, 8)
      : [],
    reason: cleanText(row.reason) || "Recommendation grading window was captured.",
  };
}

export function isLongHorizonRecommendationWindow(window: AIRecommendationGradingWindow | null | undefined): boolean {
  return window?.kind === "redraft-season" || window?.kind === "dynasty-draft-two-year";
}
