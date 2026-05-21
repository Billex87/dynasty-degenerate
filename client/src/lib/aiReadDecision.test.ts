import { describe, expect, it } from "vitest";
import { buildAIReadDecision } from "./aiReadDecision";

describe("buildAIReadDecision", () => {
  it("turns actionable evidence reads into a direct do-this decision", () => {
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

    expect(decision.label).toBe("Do this");
    expect(decision.tone).toBe("go");
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

  it("keeps warning and mid-confidence reads as watch-only", () => {
    const decision = buildAIReadDecision({
      confidence: 63,
      confidenceNote: "Schedule source is partial.",
      severity: "warn",
    });

    expect(decision.label).toBe("Watch only");
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

  it("keeps unscored context panels watch-only when they still have receipts", () => {
    const decision = buildAIReadDecision({
      confidence: null,
      severity: "info",
      hasEvidenceHints: true,
    });

    expect(decision.label).toBe("Watch only");
    expect(decision.tone).toBe("watch");
    expect(decision.status).toBe("Context only");
  });
});
