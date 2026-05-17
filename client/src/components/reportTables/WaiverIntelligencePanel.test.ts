import { describe, expect, it } from "vitest";
import type { ActionPlanRecord, RecentTransaction } from "@shared/types";
import {
  buildWaiverOutcomeLearning,
  getWaiverPlanOutcomeRead,
} from "./WaiverIntelligencePanel";

const basePlan: ActionPlanRecord = {
  id: "waiver:league:bill:wr1",
  kind: "waiver",
  leagueId: "league",
  manager: "Bill",
  playerId: "wr1",
  createdAt: Date.parse("2026-05-01T12:00:00.000Z"),
  title: "Claim Waiver Receiver",
  summary: "FAAB 7-12; drop Bench Receiver.",
  status: "submitted",
  payload: {
    dropCandidate: {
      player_id: "drop1",
      name: "Bench Receiver",
      pos: "WR",
      ktcValue: 800,
    },
  },
};

function transaction(overrides: Partial<RecentTransaction>): RecentTransaction {
  return {
    id: "tx-1",
    date: "2026-05-02",
    manager: "Bill",
    type: "Waiver",
    bidAmount: 9,
    addedPlayer: {
      player_id: "wr1",
      name: "Waiver Receiver",
      pos: "WR",
      team: "DAL",
      ktcValue: 1400,
    },
    droppedPlayer: {
      player_id: "drop1",
      name: "Bench Receiver",
      pos: "WR",
      team: "NYG",
      ktcValue: 800,
    },
    alternativeDrop: null,
    note: "Added Waiver Receiver.",
    losingBidsAvailable: false,
    ...overrides,
  };
}

describe("waiver outcome learning", () => {
  it("adds post-claim aftermath for won claims", () => {
    const outcome = getWaiverPlanOutcomeRead(basePlan, [transaction({})]);

    expect(outcome).toMatchObject({
      status: "won",
      valueDelta: 600,
    });
    expect(outcome?.aftermathSummary).toContain("+600");
  });

  it("detects quick churn after a won claim is later dropped", () => {
    const outcome = getWaiverPlanOutcomeRead(basePlan, [
      transaction({}),
      transaction({
        id: "tx-2",
        date: "2026-05-05",
        addedPlayer: null,
        droppedPlayer: {
          player_id: "wr1",
          name: "Waiver Receiver",
          pos: "WR",
          team: "DAL",
          ktcValue: 1300,
        },
      }),
    ]);

    expect(outcome?.aftermathSummary).toContain("later dropped");
  });

  it("summarizes won, lost, pending, and aftermath counts", () => {
    const learning = buildWaiverOutcomeLearning([
      {
        ...basePlan,
        id: "won",
        status: "won",
        payload: {
          outcomeAftermathSummary: "Won claim with +600 value delta.",
          outcomeValueDelta: 600,
        },
      },
      { ...basePlan, id: "lost", status: "lost" },
      { ...basePlan, id: "pending", status: "submitted" },
    ]);

    expect(learning).toMatchObject({
      won: 1,
      lost: 1,
      open: 1,
      winRate: 50,
      aftermathCount: 1,
      positiveAftermath: 1,
    });
  });
});
