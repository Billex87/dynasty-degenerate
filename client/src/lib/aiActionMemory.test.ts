import { describe, expect, it } from "vitest";
import {
  buildAIConfidenceHistory,
  detectAIActionConflicts,
  recordAIActionSnapshot,
} from "./aiActionMemory";
import type { AIActionQueueItem } from "@/lib/autopilot/types";

function makeQueueItem(overrides: Partial<AIActionQueueItem> = {}): AIActionQueueItem {
  return {
    id: "queue-waiver-1",
    source: "waiver",
    decision: "do",
    rank: 1,
    label: "Do this now",
    action: "Add",
    target: "Waiver Receiver",
    detail: "WR depth add",
    why: "Roster need and available value agree.",
    risk: "Risk Medium; upside High.",
    confidence: 74,
    tone: "good",
    blockers: [],
    missingEvidence: [],
    sourceHealth: ["DraftSharks SOS: loaded", "Sleeper ownership: loaded"],
    receipts: ["Available player", "WR need"],
    changeTriggers: ["Live ownership, roster status, or recent transaction changes would block the pickup."],
    signals: ["Waiver value", "DraftSharks schedule"],
    ...overrides,
  };
}

describe("aiActionMemory", () => {
  it("records changed recommendations and confidence deltas", () => {
    const first = makeQueueItem({ target: "Waiver Receiver", confidence: 70 });
    const second = makeQueueItem({ target: "Streaming Defense", confidence: 82 });
    const initial = recordAIActionSnapshot({
      memory: { history: [], outcomes: [] },
      memoryKey: "overview",
      context: "Overview",
      item: first,
      now: 1000,
    });
    const next = recordAIActionSnapshot({
      memory: initial.memory,
      memoryKey: "overview",
      context: "Overview",
      item: second,
      now: 2000,
    });

    expect(next.change.changed).toBe(true);
    expect(next.change.confidenceDelta).toBe(12);
    expect(next.change.summary).toContain("Changed from Waiver Receiver to Streaming Defense");
  });

  it("builds compact confidence history for sparklines", () => {
    const memory = [1, 2, 3, 4].reduce(
      (current, index) =>
        recordAIActionSnapshot({
          memory: current,
          memoryKey: "autopilot",
          context: "Autopilot",
          item: makeQueueItem({
            target: `Target ${index}`,
            confidence: 60 + index,
          }),
          now: index,
        }).memory,
      { history: [], outcomes: [] }
    );

    const points = buildAIConfidenceHistory(
      memory.history,
      "autopilot",
      makeQueueItem({ target: "Current", confidence: 78 }),
      3
    );

    expect(points).toHaveLength(3);
    expect(points.map(point => point.confidence)).toEqual([63, 64, 78]);
  });

  it("detects blockers, missing evidence, and live source conflicts", () => {
    const conflicts = detectAIActionConflicts(makeQueueItem({
      blockers: ["Player is already rostered."],
      missingEvidence: ["Fresh schedule window."],
      sourceHealth: ["DraftSharks SOS: stale"],
    }));

    expect(conflicts.map(conflict => conflict.label)).toEqual(
      expect.arrayContaining(["Hard blocker", "Missing evidence", "Input health"])
    );
    expect(conflicts.some(conflict => conflict.tone === "danger")).toBe(true);
  });

  it("stores recommendation reads without requiring a manual outcome click", () => {
    const item = makeQueueItem();
    const result = recordAIActionSnapshot({
      memory: { history: [], outcomes: [] },
      memoryKey: "autopilot",
      context: "Autopilot",
      item,
      now: 5000,
    });

    expect(result.memory.history[0]).toMatchObject({
      target: "Waiver Receiver",
      action: "Add",
    });
    expect(result.memory.outcomes).toEqual([]);
  });
});
