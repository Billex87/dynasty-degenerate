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
  const detail =
    read.confidenceCapReason
      ? `Confidence limited by ${read.confidenceCapReason}.`
      : blocker || read.missingEvidence?.[0] || read.whyThisFired;

  if (read.label === "blocked") {
    return {
      label: "Do not do this",
      detail: blocker || detail,
      tone: "stop",
      status: `Blocked · ${read.finalScore}%`,
    };
  }

  if (read.label === "thin") {
    return {
      label: "Insufficient evidence",
      detail,
      tone: "thin",
      status: `Thin · ${read.finalScore}%`,
    };
  }

  if (read.canAct) {
    if (!hasEnabledAction) {
      return {
        label: "Don't force it",
        detail: `Evidence cleared, but no concrete action is attached to this read. ${detail || ""}`.trim(),
        tone: "watch",
        status: `${read.label} · ${read.finalScore}%`,
      };
    }

    if (evidenceGap) {
      return {
        label: "Don't force it",
        detail,
        tone: "watch",
        status: `Limited · ${read.finalScore}%`,
      };
    }

    return {
      label: "Do this",
      detail,
      tone: "go",
      status: `${read.label} · ${read.finalScore}%`,
    };
  }

  return {
    label: "Don't force it",
    detail,
    tone: "watch",
    status: `${read.label} · ${read.finalScore}%`,
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
      status: confidence === null ? "Blocked" : `Blocked · ${confidence}%`,
    };
  }

  if (confidence === null) {
    if (input.hasEvidenceHints && severity !== "warn") {
      return {
        label: "Don't force it",
        detail: confidenceDetail || "Context is present, but this read has no scored confidence attached.",
        tone: "watch",
        status: "Context only",
      };
    }

    return {
      label: "Insufficient evidence",
      detail: confidenceDetail || "The report did not return enough scored evidence for a confident action.",
      tone: "thin",
      status: "No score",
    };
  }

  if (confidence < 46) {
    return {
      label: "Insufficient evidence",
      detail: confidenceDetail || "Evidence is below the action threshold.",
      tone: "thin",
      status: `Thin · ${confidence}%`,
    };
  }

  if (severity === "warn" || confidence < 68) {
    return {
      label: "Don't force it",
      detail: confidenceDetail || "Useful signal, but not strong enough to force an action.",
      tone: "watch",
      status: `Limited · ${confidence}%`,
    };
  }

  if (!input.hasEnabledAction) {
    return {
      label: "Don't force it",
      detail: confidenceDetail || "Strong context, but no concrete action is attached to this read.",
      tone: "watch",
      status: `Context · ${confidence}%`,
    };
  }

  return {
    label: "Do this",
    detail: confidenceDetail || "Evidence is strong enough to take the surfaced action.",
    tone: "go",
    status: `Actionable · ${confidence}%`,
  };
}
