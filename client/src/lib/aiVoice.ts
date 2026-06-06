import type { AIActionQueueItem } from "@/lib/autopilot/types";
import type { AIReadDecision, AIReadDecisionTone } from "@/lib/aiReadDecision";

export type AIVoiceMode = "straight" | "degen" | "roast";

export const AI_VOICE_MODE_STORAGE_KEY =
  "dynasty-degenerates:ai-voice-mode:v1";
export const AI_VOICE_MODE_CHANGE_EVENT =
  "dynasty-degenerates:ai-voice-mode-change";
export const AI_VOICE_MODE_OPTIONS: AIVoiceMode[] = [
  "straight",
  "degen",
  "roast",
];

const DEFAULT_AI_VOICE_MODE: AIVoiceMode = "degen";

const AI_VOICE_MODE_LABELS: Record<AIVoiceMode, string> = {
  straight: "Straight",
  degen: "Degen",
  roast: "Roast",
};

const AI_VOICE_MODE_DESCRIPTIONS: Record<AIVoiceMode, string> = {
  straight: "Clean evidence-first readouts.",
  degen: "Sharper fantasy readouts.",
  roast: "Direct warnings when the signal is weak.",
};

function cleanText(value?: string | null): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeAIVoiceMode(value?: string | null): AIVoiceMode | null {
  const clean = cleanText(value).toLowerCase();
  if (clean === "straight" || clean === "degen" || clean === "roast") {
    return clean;
  }
  return null;
}

export function getAIVoiceModeLabel(mode: AIVoiceMode): string {
  return AI_VOICE_MODE_LABELS[mode];
}

export function getAIVoiceModeDescription(mode: AIVoiceMode): string {
  return AI_VOICE_MODE_DESCRIPTIONS[mode];
}

export function getAIVoiceMode(): AIVoiceMode {
  if (typeof window === "undefined") return DEFAULT_AI_VOICE_MODE;
  try {
    return (
      normalizeAIVoiceMode(
        window.localStorage.getItem(AI_VOICE_MODE_STORAGE_KEY)
      ) ||
      DEFAULT_AI_VOICE_MODE
    );
  } catch {
    return DEFAULT_AI_VOICE_MODE;
  }
}

export function setAIVoiceMode(mode: AIVoiceMode): AIVoiceMode {
  const nextMode = normalizeAIVoiceMode(mode) || DEFAULT_AI_VOICE_MODE;
  if (typeof window === "undefined") return nextMode;
  try {
    window.localStorage.setItem(AI_VOICE_MODE_STORAGE_KEY, nextMode);
    window.dispatchEvent(
      new CustomEvent(AI_VOICE_MODE_CHANGE_EVENT, {
        detail: { mode: nextMode },
      })
    );
  } catch {
    // If storage is unavailable, keep the in-memory UI state moving.
  }
  return nextMode;
}

function appendQuip(
  detail: string | null | undefined,
  quip: string,
  mode: AIVoiceMode
): string | null {
  const clean = cleanText(detail);
  if (mode === "straight") return clean || null;
  if (!clean) return quip;
  if (clean.toLowerCase().includes(quip.toLowerCase())) return clean;
  return `${clean} ${quip}`;
}

function statusWithPrefix(status: string | undefined, prefix: string) {
  const clean = cleanText(status);
  if (!clean) return prefix;
  const separator = clean.includes("·") ? "·" : null;
  if (!separator) return prefix;
  return `${prefix} · ${clean.split("·").slice(1).join("·").trim()}`;
}

function isDirectGoActionLabel(label: string | undefined): boolean {
  const clean = cleanText(label).toLowerCase();
  return (
    clean === "do this" ||
    clean.startsWith("do this.") ||
    clean.startsWith("do this ") ||
    clean === "action cleared" ||
    clean === "green light"
  );
}

function getDecisionLabel(
  tone: AIReadDecisionTone,
  mode: AIVoiceMode,
  fallback: string
) {
  if (mode === "straight") return fallback;
  if (tone === "go" && !isDirectGoActionLabel(fallback)) return fallback;

  if (mode === "roast") {
    if (tone === "go") return "Do this. Keep it simple.";
    if (tone === "stop") return "Absolutely not";
    if (tone === "thin") return "Not enough signal";
    return "Wait for better signal";
  }

  if (tone === "go") return "Do this";
  if (tone === "stop") return "Do not do this";
  if (tone === "thin") return "Not enough signal";
  return "Do not force it";
}

function getDecisionStatus(
  tone: AIReadDecisionTone,
  mode: AIVoiceMode,
  status?: string,
  fallbackLabel?: string
) {
  if (mode === "straight") return cleanText(status) || "Decision";
  if (tone === "go" && !isDirectGoActionLabel(fallbackLabel)) {
    return cleanText(status) || "Decision";
  }

  if (tone === "go") return statusWithPrefix(status, "Green light");
  if (tone === "stop") return statusWithPrefix(status, "Blocked");
  if (tone === "thin") return statusWithPrefix(status, "Thin read");
  return statusWithPrefix(status, "Watch");
}

function getDecisionQuip(tone: AIReadDecisionTone, mode: AIVoiceMode, fallbackLabel?: string) {
  if (mode === "straight") return "";
  if (tone === "go" && !isDirectGoActionLabel(fallbackLabel)) return "";
  if (mode === "roast") {
    if (tone === "go") return "Keep the move simple.";
    if (tone === "stop") {
      return "This move does not clear the bar.";
    }
    if (tone === "thin") return "Not enough signal to act.";
    return "Wait until the read gets cleaner.";
  }

  if (tone === "go") return "Keep the move simple.";
  if (tone === "stop") return "This move does not clear the bar.";
  if (tone === "thin") return "Not enough signal to act yet.";
  return "Wait for a cleaner signal.";
}

export function getVoicedAIReadDecision(
  decision: AIReadDecision,
  mode: AIVoiceMode = getAIVoiceMode()
): AIReadDecision {
  const tone = decision.tone || "watch";
  const quip = getDecisionQuip(tone, mode, decision.label);
  return {
    ...decision,
    label: getDecisionLabel(tone, mode, decision.label),
    status: getDecisionStatus(tone, mode, decision.status, decision.label),
    detail: quip ? appendQuip(decision.detail, quip, mode) : decision.detail,
  };
}

export function getVoicedAIConfidenceLabel(
  value: number,
  mode: AIVoiceMode = getAIVoiceMode()
): string {
  if (mode === "straight") {
    if (value >= 78) return "Strong evidence";
    if (value >= 62) return "Building evidence";
    if (value >= 46) return "Thin evidence";
    return "Low evidence";
  }

  if (value >= 78) return "Strong signal";
  if (value >= 62) return "Building signal";
  if (value >= 46) return "Thin signal";
  return "Low signal";
}

export function getVoicedAIActionDecisionCopy(
  decision: AIActionQueueItem["decision"],
  mode: AIVoiceMode = getAIVoiceMode()
): string {
  if (mode === "straight") {
    if (decision === "do") return "Action cleared";
    if (decision === "blocked") return "Blocked";
    if (decision === "hold") return "No forced move";
    return "Don't force it";
  }

  if (mode === "roast") {
    if (decision === "do") return "Green light";
    if (decision === "blocked") return "Blocked";
    if (decision === "hold") return "No forced move";
    return "Watch only";
  }

  if (decision === "do") return "Green light";
  if (decision === "blocked") return "Blocked";
  if (decision === "hold") return "No forced move";
  return "Watch only";
}

export function getVoicedAIActionLabel(
  label: string,
  decision: AIActionQueueItem["decision"],
  mode: AIVoiceMode = getAIVoiceMode()
): string {
  if (mode === "straight") return label;
  const clean = cleanText(label).toLowerCase();
  if (decision === "do" || clean.includes("do this")) return "Do this";
  if (decision === "blocked" || clean.includes("blocked")) return "Do not do this";
  if (decision === "hold" || clean.includes("no move")) return "Hold current setup";
  return "Watch only";
}

export function getVoicedAIActionDetail(
  detail: string,
  decision: AIActionQueueItem["decision"],
  mode: AIVoiceMode = getAIVoiceMode()
): string {
  if (mode === "straight") return detail;
  const quip =
    decision === "do"
      ? "Do it before your league notices."
      : decision === "blocked"
        ? mode === "roast"
          ? "The blocker is real."
          : "The blocker is real."
        : decision === "hold"
          ? "Hold unless a move clearly improves value, role, or roster fit."
          : "Wait for a clearer signal.";
  return appendQuip(detail, quip, mode) || quip;
}

export function getVoicedAIActionQueueSubtitle(
  subtitle: string,
  mode: AIVoiceMode = getAIVoiceMode()
): string {
  if (mode === "straight") return subtitle;
  if (/next move/i.test(subtitle)) {
    return "Autopilot makes the next move call: do it, watch it, hold it, or block it.";
  }
  if (/overview/i.test(subtitle)) {
    return "Only the top AI move gets the spotlight. Supporting reads stay secondary.";
  }
  return "One call: do it, watch it, hold it, or block it.";
}

export function getVoicedSuppressedAIActionsCopy(
  count: number,
  mode: AIVoiceMode = getAIVoiceMode()
) {
  if (mode === "straight") {
    return {
      label: "Alternates held back",
      countLabel: `${count} supporting read${count === 1 ? "" : "s"}`,
      body:
        "Lower-ranked actions stay secondary so this surface makes one clear call instead of competing with itself.",
    };
  }

  return {
    label: "Bench reads held back",
    countLabel: `${count} bench read${count === 1 ? "" : "s"}`,
    body:
      "Secondary reads stay out of the main verdict so this card makes one clear call.",
  };
}

export function getAIDeltaBriefCopy(
  hiddenCount: number,
  mode: AIVoiceMode = getAIVoiceMode()
) {
  if (mode === "straight") {
    return {
      kicker: "AI Delta Check",
      title: "Changed Since Last Report",
      hidden:
        hiddenCount > 0
          ? `${hiddenCount} lower-signal change${hiddenCount === 1 ? "" : "s"} held back`
          : "",
    };
  }

  return {
    kicker: "AI Delta Check",
    title: "What Changed Since Last Report",
    hidden:
      hiddenCount > 0
        ? `${hiddenCount} bench read${hiddenCount === 1 ? "" : "s"} held back`
        : "",
  };
}
