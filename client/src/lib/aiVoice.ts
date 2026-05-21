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
  degen: "Fantasy lingo with a sharper edge.",
  roast: "More bite when the evidence is ugly.",
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

function getDecisionLabel(
  tone: AIReadDecisionTone,
  mode: AIVoiceMode,
  fallback: string
) {
  if (mode === "straight") return fallback;

  if (mode === "roast") {
    if (tone === "go") return "Do this. Don't overthink it.";
    if (tone === "stop") return "Absolutely not";
    if (tone === "thin") return "Not enough receipts to talk spicy";
    return "Hands off, buddy";
  }

  if (tone === "go") return "Do this";
  if (tone === "stop") return "Do not do this";
  if (tone === "thin") return "Not enough receipts";
  return "Don't get cute yet";
}

function getDecisionStatus(
  tone: AIReadDecisionTone,
  mode: AIVoiceMode,
  status?: string
) {
  if (mode === "straight") return cleanText(status) || "Decision";

  if (tone === "go") return statusWithPrefix(status, "Green light");
  if (tone === "stop") return statusWithPrefix(status, "Blocked");
  if (tone === "thin") return statusWithPrefix(status, "Thin read");
  return statusWithPrefix(status, "Wait for it");
}

function getDecisionQuip(tone: AIReadDecisionTone, mode: AIVoiceMode) {
  if (mode === "straight") return "";
  if (mode === "roast") {
    if (tone === "go") return "Try not to galaxy-brain the obvious answer.";
    if (tone === "stop") {
      return "Buddy, is this your first day playing fantasy football?";
    }
    if (tone === "thin") return "No receipts, no victory lap.";
    return "Your lineup does not need improv comedy right now.";
  }

  if (tone === "go") return "Don't galaxy-brain it.";
  if (tone === "stop") return "Buddy, this is how benches catch fire.";
  if (tone === "thin") return "Not enough receipts to talk spicy yet.";
  return "Hands off until the receipts improve.";
}

export function getVoicedAIReadDecision(
  decision: AIReadDecision,
  mode: AIVoiceMode = getAIVoiceMode()
): AIReadDecision {
  const tone = decision.tone || "watch";
  const quip = getDecisionQuip(tone, mode);
  return {
    ...decision,
    label: getDecisionLabel(tone, mode, decision.label),
    status: getDecisionStatus(tone, mode, decision.status),
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

  if (value >= 78) return mode === "roast" ? "Receipts are loud" : "Loud receipts";
  if (value >= 62) return "Receipts warming up";
  if (value >= 46) return "Thin receipts";
  return mode === "roast" ? "Bad receipts" : "Low receipts";
}

export function getVoicedAIActionDecisionCopy(
  decision: AIActionQueueItem["decision"],
  mode: AIVoiceMode = getAIVoiceMode()
): string {
  if (mode === "straight") {
    if (decision === "do") return "Action cleared";
    if (decision === "blocked") return "Blocked";
    if (decision === "hold") return "No forced move";
    return "Watch only";
  }

  if (mode === "roast") {
    if (decision === "do") return "Green light";
    if (decision === "blocked") return "Blocked. Read the room.";
    if (decision === "hold") return "No move. Chill.";
    return "Watchlist. Hands off.";
  }

  if (decision === "do") return "Green light";
  if (decision === "blocked") return "Blocked";
  if (decision === "hold") return "No move. Chill.";
  return "Watchlist. Hands off.";
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
  if (decision === "hold" || clean.includes("no move")) return "No move is the move";
  return "Don't get cute yet";
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
          ? "Buddy, you cannot wishcast your way through a blocker."
          : "The blocker is real."
        : decision === "hold"
          ? "No need to turn a small leak into a house fire."
          : "Hands off until the receipts get louder.";
  return appendQuip(detail, quip, mode) || quip;
}

export function getVoicedAIActionQueueSubtitle(
  subtitle: string,
  mode: AIVoiceMode = getAIVoiceMode()
): string {
  if (mode === "straight") return subtitle;
  if (/overview/i.test(subtitle)) {
    return "Only the top AI move gets the mic. The rest can sit quietly in receipts.";
  }
  return "One call: do it, watch it, hold it, or block it. No four-card fortune cookie nonsense.";
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
        "Lower-ranked actions stay in receipts and source tables so this surface makes one call instead of competing with itself.",
    };
  }

  return {
    label: "Bench reads held back",
    countLabel: `${count} bench read${count === 1 ? "" : "s"}`,
    body:
      "The extra takes stay in receipts. This card makes one call, because four AI opinions at once is how people talk themselves into bad trades.",
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
    kicker: "AI Receipt Check",
    title: "What Changed Since Last Report",
    hidden:
      hiddenCount > 0
        ? `${hiddenCount} bench read${hiddenCount === 1 ? "" : "s"} held back`
        : "",
  };
}
