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
    expect(decision.status).toBe("Strong read");
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

    expect(decision.label).toBe("Watch only");
    expect(decision.tone).toBe("watch");
    expect(decision.detail).toContain("no concrete move attached");
    expect(decision.status).toBe("Context");
  });

  it("keeps capped actionable evidence from rendering as do-this copy", () => {
    const decision = buildAIReadDecision({
      hasEnabledAction: true,
      evidenceRead: {
        label: "priority",
        finalScore: 72,
        canAct: true,
        whyThisFired: "Multiple returned sources agree.",
        missingEvidence: [],
        hardBlockers: [],
        confidenceCapReason: "Missing source-health proof",
      },
    });

    expect(decision.label).toBe("Verify first");
    expect(decision.tone).toBe("watch");
    expect(decision.detail).toContain("needs a cleaner manager-useful signal");
    expect(decision.status).toBe("Watch only");
  });

  it("keeps actionable evidence with unresolved evidence gaps from rendering as do-this copy", () => {
    const decision = buildAIReadDecision({
      hasEnabledAction: true,
      evidenceRead: {
        label: "priority",
        finalScore: 74,
        canAct: true,
        whyThisFired: "Multiple returned sources agree.",
        missingEvidence: ["No live roster proof returned for this action read."],
        hardBlockers: [],
        confidenceCapReason: null,
      },
    });

    expect(decision.label).toBe("Verify first");
    expect(decision.tone).toBe("watch");
    expect(decision.detail).toContain("Availability and roster status need a final check");
    expect(decision.status).toBe("Watch only");
  });

  it("does not let explicit do-this copy override unresolved evidence gaps", () => {
    const decision = buildAIReadDecision({
      decision: "Do this",
      hasEnabledAction: true,
      evidenceRead: {
        label: "priority",
        finalScore: 76,
        canAct: true,
        whyThisFired: "Multiple returned sources agree.",
        missingEvidence: ["Verify live roster state before acting."],
        hardBlockers: [],
        confidenceCapReason: null,
      },
    });

    expect(decision.label).toBe("Verify first");
    expect(decision.tone).toBe("watch");
    expect(decision.detail).toContain("Availability and roster status need a final check");
  });

  it("does not let explicit go-tone decisions override hard blockers", () => {
    const decision = buildAIReadDecision({
      decision: {
        label: "Do this. Don't overthink it.",
        tone: "go",
        status: "Actionable",
      },
      hasEnabledAction: true,
      evidenceRead: {
        label: "blocked",
        finalScore: 0,
        canAct: false,
        whyThisFired: "Blocked by roster status.",
        missingEvidence: [],
        hardBlockers: ["Player is already rostered."],
        confidenceCapReason: null,
      },
    });

    expect(decision.label).toBe("Do not do this");
    expect(decision.tone).toBe("stop");
    expect(decision.detail).toContain("Availability and roster status need a final check");
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
    expect(decision.detail).toContain("Availability and roster status need a final check");
  });

  it("keeps warning and mid-confidence reads as watch-only decisions", () => {
    const decision = buildAIReadDecision({
      confidence: 63,
      confidenceNote: "Schedule source is partial.",
      severity: "warn",
    });

    expect(decision.label).toBe("Watch only");
    expect(decision.tone).toBe("watch");
    expect(decision.status).toBe("Verify first");
  });

  it("does not invent action when no score exists", () => {
    const decision = buildAIReadDecision({
      confidence: null,
      severity: "info",
    });

    expect(decision.label).toBe("Not enough signal");
    expect(decision.tone).toBe("thin");
  });

  it("keeps unscored context panels as watch-only decisions when they still have receipts", () => {
    const decision = buildAIReadDecision({
      confidence: null,
      severity: "info",
      hasEvidenceHints: true,
    });

    expect(decision.label).toBe("Watch only");
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

    expect(contextOnly.label).toBe("Watch only");
    expect(contextOnly.tone).toBe("watch");
    expect(contextOnly.status).toBe("Context");
    expect(actionAttached.label).toBe("Do this");
    expect(actionAttached.tone).toBe("go");
  });
});
