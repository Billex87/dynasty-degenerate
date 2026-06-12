import type { AIEvidenceResult } from "@shared/aiEvidenceEngine";

export type AIReadDecisionTone = "go" | "watch" | "stop" | "thin";

export type AIReadDecision = {
  label: string;
  detail?: string | null;
  tone?: AIReadDecisionTone;
  status?: string;
};

export type AIReadDecisionInput = {
  decision?: string | AIReadDecision | null;
  evidenceRead?: Pick<
    AIEvidenceResult,
    | "label"
    | "finalScore"
    | "canAct"
    | "whyThisFired"
    | "missingEvidence"
    | "hardBlockers"
    | "confidenceCapReason"
  > | null;
  confidence?: number | null;
  confidenceNote?: string | null;
  severity?: "neutral" | "good" | "info" | "warn" | "danger";
  hasEnabledAction?: boolean;
  hasEvidenceHints?: boolean;
};

function cleanText(value?: string | null): string | null {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean || null;
}

function clampDecisionDetail(value?: string | null): string | null {
  const clean = cleanText(value);
  if (!clean) return null;
  return clean.length > 190 ? `${clean.slice(0, 187).trim()}...` : clean;
}

function getManagerFacingLimitReason(value?: string | null): string {
  const clean = cleanText(value) || "";
  const lower = clean.toLowerCase();

  if (/schedule|sos|matchup|bye/.test(lower)) {
    return "Schedule window is a short-term tiebreaker here; verify the week before acting.";
  }
  if (/role|usage|lineup|starter/.test(lower)) {
    return "Role or lineup context needs one more check before this becomes actionable.";
  }
  if (/availability|injury|roster|active|team|status/.test(lower)) {
    return "Availability and roster status need a final check before acting.";
  }
  if (/trade|partner|offer|transaction/.test(lower)) {
    return "Trade fit needs a cleaner partner or offer path before forcing it.";
  }
  if (/redraft|current-season|season/.test(lower)) {
    return "Current-season context is thin, so treat this as a watch-only read.";
  }
  if (/dynasty|market|value/.test(lower)) {
    return "Market context is not strong enough to force a move by itself.";
  }
  if (/source|trace|evidence|calibration|confidence|proof|row|payload|returned|missing/.test(lower)) {
    return "The read needs a cleaner manager-useful signal before acting.";
  }

  return clampDecisionDetail(clean) || "Verify the current roster, role, and timing before acting.";
}

function normalizeConfidence(value?: number | null): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeDecision(decision: string | AIReadDecision): AIReadDecision {
  if (typeof decision === "string") {
    return {
      label: decision,
      tone: "watch",
      status: "Decision",
    };
  }

  return {
    ...decision,
    label: cleanText(decision.label) || "Don't force it",
    detail: clampDecisionDetail(decision.detail),
    tone: decision.tone || "watch",
    status: cleanText(decision.status) || "Decision",
  };
}

function isGoDecision(decision: AIReadDecision): boolean {
  const label = cleanText(decision.label)?.toLowerCase() || "";
  return decision.tone === "go" || label === "do this" || label.startsWith("do this.");
}

function getEvidenceDecision(
  read: NonNullable<AIReadDecisionInput["evidenceRead"]>,
  hasEnabledAction: boolean
): AIReadDecision {
  const blocker = read.hardBlockers?.[0] || null;
  const evidenceGap = read.confidenceCapReason || read.missingEvidence?.[0] || null;
  const detail = blocker
    ? getManagerFacingLimitReason(blocker)
    : evidenceGap
      ? getManagerFacingLimitReason(evidenceGap)
      : getManagerFacingLimitReason(read.whyThisFired);

  if (read.label === "blocked") {
    return {
      label: "Do not do this",
      detail,
      tone: "stop",
      status: "Blocked",
    };
  }

  if (read.label === "thin") {
    return {
      label: "Not enough signal",
      detail,
      tone: "thin",
      status: "Limited read",
    };
  }

  if (read.canAct) {
    if (!hasEnabledAction) {
      return {
        label: "Watch only",
        detail: "This is useful context, but there is no concrete move attached.",
        tone: "watch",
        status: "Context",
      };
    }

    if (evidenceGap) {
      return {
        label: "Verify first",
        detail,
        tone: "watch",
        status: "Limited read",
      };
    }

    return {
      label: "Do this",
      detail,
      tone: "go",
      status: "Strong read",
    };
  }

  return {
    label: "Watch only",
    detail,
    tone: "watch",
    status: "Limited read",
  };
}

export function buildAIReadDecision(input: AIReadDecisionInput): AIReadDecision {
  if (input.evidenceRead) {
    const evidenceDecision = normalizeDecision(getEvidenceDecision(input.evidenceRead, Boolean(input.hasEnabledAction)));
    if (!input.decision) return evidenceDecision;

    const explicitDecision = normalizeDecision(input.decision);
    if (isGoDecision(explicitDecision) && evidenceDecision.tone !== "go") return evidenceDecision;
    return explicitDecision;
  }
  if (input.decision) return normalizeDecision(input.decision);

  const confidence = normalizeConfidence(input.confidence);
  const severity = input.severity || "info";
  const confidenceDetail = clampDecisionDetail(input.confidenceNote);

  if (severity === "danger") {
    return {
      label: "Do not do this",
      detail: confidenceDetail || "A hard risk flag is active.",
      tone: "stop",
      status: "Blocked",
    };
  }

  if (confidence === null) {
    if (input.hasEvidenceHints && severity !== "warn") {
      return {
        label: "Watch only",
        detail: confidenceDetail || "Context is present, but this read has no scored confidence attached.",
        tone: "watch",
        status: "Context only",
      };
    }

    return {
      label: "Not enough signal",
      detail: confidenceDetail || "This does not have enough manager-useful signal for an action.",
      tone: "thin",
      status: "Limited read",
    };
  }

  if (confidence < 46) {
    return {
      label: "Not enough signal",
      detail: confidenceDetail || "This is below the action threshold.",
      tone: "thin",
      status: "Limited read",
    };
  }

  if (severity === "warn" || confidence < 68) {
    return {
      label: "Watch only",
      detail: confidenceDetail || "Useful signal, but not strong enough to force an action.",
      tone: "watch",
      status: "Limited read",
    };
  }

  if (!input.hasEnabledAction) {
    return {
      label: "Watch only",
      detail: confidenceDetail || "Strong context, but no concrete action is attached to this read.",
      tone: "watch",
      status: "Context",
    };
  }

  return {
    label: "Do this",
    detail: confidenceDetail || "The surfaced action is strong enough to act on after a final roster check.",
    tone: "go",
    status: "Strong read",
  };
}
