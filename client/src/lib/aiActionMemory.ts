import type { AIActionQueueItem } from "@/lib/autopilot/types";

export const AI_ACTION_MEMORY_STORAGE_KEY =
  "dynasty-degenerates:ai-action-memory:v1";

export type AIActionSnapshot = {
  id: string;
  memoryKey: string;
  context: string;
  signature: string;
  source: AIActionQueueItem["source"];
  decision: AIActionQueueItem["decision"];
  label: string;
  action: string;
  target: string;
  confidence: number;
  why: string;
  blockers: string[];
  missingEvidence: string[];
  sourceHealth: string[];
  recordedAt: number;
};

export type AIActionChange = {
  previous: AIActionSnapshot | null;
  current: AIActionSnapshot;
  changed: boolean;
  confidenceDelta: number;
  summary: string;
};

export type AIConfidencePoint = {
  id: string;
  confidence: number;
  label: string;
  recordedAt: number;
};

export type AIActionConflict = {
  id: string;
  label: string;
  detail: string;
  tone: "good" | "info" | "warn" | "danger";
};

export type AIActionMemory = {
  history: AIActionSnapshot[];
  outcomes: unknown[];
};

const EMPTY_MEMORY: AIActionMemory = {
  history: [],
  outcomes: [],
};

function cleanText(value?: string | null): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stableKey(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 5): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach(value => {
    const clean = cleanText(value);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });

  return result.slice(0, limit);
}

export function getAIActionSignature(item: AIActionQueueItem): string {
  return [
    item.source,
    item.decision,
    item.action,
    item.target,
    item.confidence,
    item.blockers[0] || "",
    item.missingEvidence[0] || "",
  ].map(value => cleanText(String(value))).join("|");
}

export function buildAIActionSnapshot({
  memoryKey,
  context,
  item,
  now = Date.now(),
}: {
  memoryKey: string;
  context: string;
  item: AIActionQueueItem;
  now?: number;
}): AIActionSnapshot {
  const signature = getAIActionSignature(item);
  return {
    id: `${stableKey(memoryKey)}-${now}`,
    memoryKey,
    context: cleanText(context) || "AI Action Queue",
    signature,
    source: item.source,
    decision: item.decision,
    label: item.label,
    action: item.action,
    target: item.target,
    confidence: item.confidence,
    why: item.why,
    blockers: item.blockers.slice(0, 4),
    missingEvidence: item.missingEvidence.slice(0, 4),
    sourceHealth: item.sourceHealth.slice(0, 4),
    recordedAt: now,
  };
}

export function getPreviousAIActionSnapshot(
  history: AIActionSnapshot[],
  memoryKey: string
): AIActionSnapshot | null {
  return [...history]
    .filter(snapshot => snapshot.memoryKey === memoryKey)
    .sort((a, b) => b.recordedAt - a.recordedAt)[0] || null;
}

export function describeAIActionChange(
  current: AIActionSnapshot,
  previous: AIActionSnapshot | null
): AIActionChange {
  if (!previous) {
    return {
      previous,
      current,
      changed: false,
      confidenceDelta: 0,
      summary: "First observed decision for this queue.",
    };
  }

  const changed =
    previous.signature !== current.signature ||
    previous.decision !== current.decision ||
    previous.target !== current.target ||
    previous.action !== current.action;
  const confidenceDelta = current.confidence - previous.confidence;

  if (!changed && Math.abs(confidenceDelta) < 4) {
    return {
      previous,
      current,
      changed: false,
      confidenceDelta,
      summary: "Same recommendation as the previous observed read.",
    };
  }

  const targetChanged = previous.target !== current.target;
  const decisionChanged = previous.decision !== current.decision;
  const actionChanged = previous.action !== current.action;
  const confidenceCopy =
    confidenceDelta > 0
      ? `confidence rose ${confidenceDelta} points`
      : confidenceDelta < 0
        ? `confidence fell ${Math.abs(confidenceDelta)} points`
        : "confidence stayed flat";

  return {
    previous,
    current,
    changed: true,
    confidenceDelta,
    summary: targetChanged
      ? `Changed from ${previous.target} to ${current.target}; ${confidenceCopy}.`
      : decisionChanged
        ? `Decision changed from ${previous.label} to ${current.label}; ${confidenceCopy}.`
        : actionChanged
          ? `Action changed from ${previous.action} to ${current.action}; ${confidenceCopy}.`
          : `Recommendation details changed; ${confidenceCopy}.`,
  };
}

export function recordAIActionSnapshot({
  memory,
  memoryKey,
  context,
  item,
  now = Date.now(),
  limit = 36,
}: {
  memory: AIActionMemory;
  memoryKey: string;
  context: string;
  item: AIActionQueueItem;
  now?: number;
  limit?: number;
}): { memory: AIActionMemory; change: AIActionChange } {
  const current = buildAIActionSnapshot({ memoryKey, context, item, now });
  const previous = getPreviousAIActionSnapshot(memory.history, memoryKey);
  const change = describeAIActionChange(current, previous);
  const shouldAppend = !previous || previous.signature !== current.signature;
  const history = shouldAppend
    ? [current, ...memory.history.filter(snapshot => snapshot.id !== current.id)]
    : memory.history;

  return {
    memory: {
      history: history
        .sort((a, b) => b.recordedAt - a.recordedAt)
        .slice(0, limit),
      outcomes: memory.outcomes.slice(0, limit),
    },
    change,
  };
}

export function buildAIConfidenceHistory(
  history: AIActionSnapshot[],
  memoryKey: string,
  current?: AIActionQueueItem | null,
  limit = 8
): AIConfidencePoint[] {
  const points = history
    .filter(snapshot => snapshot.memoryKey === memoryKey)
    .sort((a, b) => a.recordedAt - b.recordedAt)
    .map(snapshot => ({
      id: snapshot.id,
      confidence: snapshot.confidence,
      label: snapshot.target,
      recordedAt: snapshot.recordedAt,
    }));

  if (current) {
    const signature = getAIActionSignature(current);
    const hasCurrent = history.some(
      snapshot => snapshot.memoryKey === memoryKey && snapshot.signature === signature
    );
    if (!hasCurrent) {
      points.push({
        id: `${stableKey(memoryKey)}-current`,
        confidence: current.confidence,
        label: current.target,
        recordedAt: Date.now(),
      });
    }
  }

  return points.slice(-limit);
}

export function detectAIActionConflicts(item: AIActionQueueItem): AIActionConflict[] {
  const blockers = uniqueStrings(item.blockers, 2);
  const missing = uniqueStrings(item.missingEvidence, 2);
  const unhealthySources = item.sourceHealth.filter(source =>
    /missing|stale|error|limited|0 rows|no source/i.test(source)
  );
  const scheduleRisk = [...item.signals, ...item.sourceHealth, ...item.changeTriggers]
    .some(value => /schedule|draftsharks|matchup|weather|vegas|odds|stream/i.test(value));
  const liveRosterRisk = [...item.changeTriggers, ...item.receipts, ...item.sourceHealth]
    .some(value => /ownership|transaction|roster status|live|available|pickup/i.test(value));
  const conflicts: AIActionConflict[] = [];

  blockers.forEach((blocker, index) => {
    conflicts.push({
      id: `blocker-${index}`,
      label: "Hard blocker",
      detail: blocker,
      tone: "danger",
    });
  });

  missing.forEach((itemMissing, index) => {
    conflicts.push({
      id: `missing-${index}`,
      label: "Missing evidence",
      detail: itemMissing,
      tone: "warn",
    });
  });

  unhealthySources.slice(0, 2).forEach((source, index) => {
    conflicts.push({
      id: `source-${index}`,
      label: "Source health",
      detail: source,
      tone: "warn",
    });
  });

  if (scheduleRisk && item.decision === "do") {
    conflicts.push({
      id: "schedule-watch",
      label: "Schedule check",
      detail: "Schedule/weather/odds movement can still flip this before kickoff.",
      tone: "info",
    });
  }

  if (liveRosterRisk && item.decision === "do") {
    conflicts.push({
      id: "live-roster-check",
      label: "Live roster check",
      detail: "Confirm ownership, roster status, and transactions before acting.",
      tone: "info",
    });
  }

  if (!conflicts.length) {
    return [{
      id: "clean",
      label: "Conflict check",
      detail: "No blocker, stale-source, missing-evidence, or live-status conflict is attached to this read.",
      tone: "good",
    }];
  }

  return conflicts.slice(0, 4);
}

export function readAIActionMemory(): AIActionMemory {
  if (typeof window === "undefined") return EMPTY_MEMORY;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(AI_ACTION_MEMORY_STORAGE_KEY) || "null"
    );
    return {
      history: Array.isArray(parsed?.history) ? parsed.history : [],
      outcomes: Array.isArray(parsed?.outcomes) ? parsed.outcomes : [],
    };
  } catch {
    return EMPTY_MEMORY;
  }
}

export function writeAIActionMemory(memory: AIActionMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AI_ACTION_MEMORY_STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Local persistence is a convenience layer; rendering should not fail if storage is blocked.
  }
}
