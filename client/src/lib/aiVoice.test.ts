import { describe, expect, it } from "vitest";
import {
  getVoicedAIActionDecisionCopy,
  getVoicedAIActionLabel,
  getVoicedAIActionQueueSubtitle,
  getVoicedAIReadDecision,
  getVoicedSuppressedAIActionsCopy,
} from "./aiVoice";

describe("aiVoice", () => {
  it("keeps straight mode plain for serious/pro views", () => {
    const decision = getVoicedAIReadDecision(
      {
        label: "Don't force it",
        detail: "Useful signal, but not strong enough to force an action.",
        tone: "watch",
        status: "Limited · 63%",
      },
      "straight"
    );

    expect(decision).toMatchObject({
      label: "Don't force it",
      status: "Limited · 63%",
      detail: "Useful signal, but not strong enough to force an action.",
    });
  });

  it("turns generic AI decisions into Dynasty Degenerates lingo", () => {
    const decision = getVoicedAIReadDecision(
      {
        label: "Don't force it",
        detail: "Useful signal, but not strong enough to force an action.",
        tone: "watch",
        status: "Limited · 63%",
      },
      "degen"
    );

    expect(decision.label).toBe("Do not force it");
    expect(decision.status).toBe("Watch · 63%");
    expect(decision.detail).toContain("Wait for a cleaner signal.");
  });

  it("keeps blocked reads strict even when roast mode is louder", () => {
    const decision = getVoicedAIReadDecision(
      {
        label: "Do not do this",
        detail: "Player is already rostered.",
        tone: "stop",
        status: "Blocked · 34%",
      },
      "roast"
    );

    expect(decision.label).toBe("Absolutely not");
    expect(decision.status).toBe("Blocked · 34%");
    expect(decision.detail).toContain(
      "This move does not clear the bar."
    );
  });

  it("voices action queues as one-call surfaces", () => {
    expect(getVoicedAIActionDecisionCopy("do", "degen")).toBe("Green light");
    expect(getVoicedAIActionLabel("Don't force it", "watch", "degen")).toBe(
      "Watch only"
    );
    expect(
      getVoicedAIActionQueueSubtitle(
        "Next move engine: act, watch, hold, or block.",
        "degen"
      )
    ).toContain("next move call");
    expect(getVoicedSuppressedAIActionsCopy(2, "degen")).toMatchObject({
      label: "Bench reads held back",
      countLabel: "2 bench reads",
    });
  });

  it("does not upgrade softened go-tone support reads into direct action copy", () => {
    const decision = getVoicedAIReadDecision(
      {
        label: "Review this",
        detail: "Schedule source cleared, but this is still a support receipt.",
        tone: "go",
        status: "priority · 82%",
      },
      "degen"
    );

    expect(decision).toMatchObject({
      label: "Review this",
      status: "priority · 82%",
      detail: "Schedule source cleared, but this is still a support receipt.",
    });
    expect(JSON.stringify(decision)).not.toContain("Do this");
    expect(JSON.stringify(decision)).not.toContain("Green light");
  });

  it("still voices explicit direct-action reads", () => {
    const decision = getVoicedAIReadDecision(
      {
        label: "Do this",
        detail: "A concrete action is attached and the evidence cleared.",
        tone: "go",
        status: "Actionable · 86%",
      },
      "roast"
    );

    expect(decision.label).toBe("Do this. Keep it simple.");
    expect(decision.status).toBe("Green light · 86%");
    expect(decision.detail).toContain("Keep the move simple.");
  });
});
