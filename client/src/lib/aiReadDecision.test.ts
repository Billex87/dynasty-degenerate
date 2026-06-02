import { describe, expect, it } from "vitest";
import { buildAIReadDecision } from "./aiReadDecision";

describe("buildAIReadDecision", () => {
  it("turns actionable evidence reads into a direct do-this decision", () => {
    const decision = buildAIReadDecision({
      hasEnabledAction: true,
      evidenceRead: {
        label: "priority",
        finalScore: 82,
        canAct: true,
        whyThisFired: "Multiple returned sources agree.",
        hardBlockers: [],
        confidenceCapReason: null,
      },
    });

    expect(decision.label).toBe("Do this");
    expect(decision.tone).toBe("go");
    expect(decision.status).toBe("priority · 82%");
  });

  it("does not invent do-this copy for actionable evidence without an attached action", () => {
    const decision = buildAIReadDecision({
      evidenceRead: {
        label: "priority",
        finalScore: 82,
        canAct: true,
        whyThisFired: "Multiple returned sources agree.",
        hardBlockers: [],
        confidenceCapReason: null,
      },
    });

    expect(decision.label).toBe("Don't force it");
    expect(decision.tone).toBe("watch");
    expect(decision.detail).toContain("no concrete action");
    expect(decision.status).toBe("priority · 82%");
  });

  it("turns blocked evidence reads into a do-not decision", () => {
    const decision = buildAIReadDecision({
      evidenceRead: {
        label: "blocked",
        finalScore: 0,
        canAct: false,
        whyThisFired: "Blocked by roster status.",
        hardBlockers: ["Player is already rostered."],
        confidenceCapReason: null,
      },
    });

    expect(decision.label).toBe("Do not do this");
    expect(decision.tone).toBe("stop");
    expect(decision.detail).toContain("already rostered");
  });

  it("keeps warning and mid-confidence reads as do-not-force decisions", () => {
    const decision = buildAIReadDecision({
      confidence: 63,
      confidenceNote: "Schedule source is partial.",
      severity: "warn",
    });

    expect(decision.label).toBe("Don't force it");
    expect(decision.tone).toBe("watch");
    expect(decision.status).toBe("Capped · 63%");
  });

  it("does not invent action when no score exists", () => {
    const decision = buildAIReadDecision({
      confidence: null,
      severity: "info",
    });

    expect(decision.label).toBe("Insufficient evidence");
    expect(decision.tone).toBe("thin");
  });

  it("keeps unscored context panels as do-not-force decisions when they still have receipts", () => {
    const decision = buildAIReadDecision({
      confidence: null,
      severity: "info",
      hasEvidenceHints: true,
    });

    expect(decision.label).toBe("Don't force it");
    expect(decision.tone).toBe("watch");
    expect(decision.status).toBe("Context only");
  });

  it("keeps high-confidence context reads out of do-this copy unless an action exists", () => {
    const contextOnly = buildAIReadDecision({
      confidence: 84,
      confidenceNote: "Strong source mix.",
      severity: "good",
    });
    const actionAttached = buildAIReadDecision({
      confidence: 84,
      confidenceNote: "Strong source mix.",
      severity: "good",
      hasEnabledAction: true,
    });

    expect(contextOnly.label).toBe("Don't force it");
    expect(contextOnly.tone).toBe("watch");
    expect(contextOnly.status).toBe("Context · 84%");
    expect(actionAttached.label).toBe("Do this");
    expect(actionAttached.tone).toBe("go");
  });
});
