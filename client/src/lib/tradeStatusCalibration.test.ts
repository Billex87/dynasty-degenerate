import { describe, expect, it } from "vitest";
import type { TradeProposalSignal } from "@shared/types";
import {
  buildTradeStatusCalibration,
  getTradeStatusCalibrationForManager,
  normalizeTradeStatusBucket,
} from "@shared/tradeStatusCalibration";

function signal(
  status: string,
  managers: string[] = ["Bill", "Rival"]
): TradeProposalSignal {
  return {
    id: `${status}-${managers.join("-")}`,
    date: "2026-05-21T12:00:00.000Z",
    status,
    managers,
    playerIds: [],
    playerNames: [],
    note: `${status} trade`,
  };
}

describe("trade status calibration", () => {
  it("normalizes Sleeper-visible proposal statuses", () => {
    expect(normalizeTradeStatusBucket("complete")).toBe("accepted");
    expect(normalizeTradeStatusBucket("countered")).toBe("countered");
    expect(normalizeTradeStatusBucket("cancelled")).toBe("blocked");
    expect(normalizeTradeStatusBucket("rejected")).toBe("blocked");
    expect(normalizeTradeStatusBucket("pending")).toBe("pending");
  });

  it("builds manager action bias from visible trade proposal history", () => {
    const summary = buildTradeStatusCalibration([
      signal("cancelled", ["Rival"]),
      signal("rejected", ["Rival"]),
      signal("countered", ["Counter"]),
      signal("countered", ["Counter"]),
      signal("complete", ["Closer"]),
      signal("accepted", ["Closer"]),
      signal("rejected", ["Closer"]),
      signal("pending", ["Staller"]),
      signal("proposed", ["Staller"]),
      signal("open", ["Staller"]),
    ]);

    expect(getTradeStatusCalibrationForManager(summary, "Rival")).toMatchObject({
      actionBias: "avoid",
      blockedCount: 2,
      label: "Rejects often",
    });
    expect(getTradeStatusCalibrationForManager(summary, "Counter")).toMatchObject({
      actionBias: "soften",
      counterCount: 2,
      label: "Counter-heavy",
    });
    expect(getTradeStatusCalibrationForManager(summary, "Closer")).toMatchObject({
      actionBias: "send",
      acceptedCount: 2,
      label: "Trade-friendly",
    });
    expect(getTradeStatusCalibrationForManager(summary, "Staller")).toMatchObject({
      actionBias: "wait",
      pendingCount: 3,
      label: "Slow responder",
    });
  });
});
