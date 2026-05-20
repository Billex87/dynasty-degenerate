import { describe, expect, it } from "vitest";
import type {
  ActionPlanRecord,
  RecentTransaction,
  ReportData,
  TrendingPlayer,
  WaiverWeeklyEcrSignal,
  WaiverWeeklyEcrWeek,
} from "@shared/types";
import { buildMatchupWindowSet } from "@shared/matchupWindows";
import {
  buildWaiverDefensePairingPlan,
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

function defensePlayer(
  player_id: string,
  name: string,
  team: string
): TrendingPlayer {
  return {
    player_id,
    name,
    pos: "DEF",
    team,
    owner: null,
    count: 0,
    ktcValue: 500,
    currentPositionRank: "DEF12",
  };
}

function defenseSignal(
  playerId: string,
  name: string,
  team: string,
  stars: number[]
): WaiverWeeklyEcrSignal {
  const weeks: WaiverWeeklyEcrWeek[] = stars.map((star, index) => ({
    week: index + 1,
    rankEcr: 12,
    positionRank: "DEF12",
    bestRank: null,
    worstRank: null,
    averageRank: 12,
    rankStdDev: null,
    lastUpdated: "2026-09-08T18:00:00.000Z",
    opponent: `T${index + 1}`,
    homeAway: index % 2 ? "away" : "home",
    opponentRank: star >= 4 ? 4 : star <= 2 ? 28 : 16,
    matchupStars: star,
    matchupTier: star >= 4 ? "easy" : star <= 2 ? "hard" : "neutral",
    isBye: false,
  }));
  return {
    signalType: "matchup-calendar",
    playerId,
    fantasyProsId: playerId,
    name,
    position: "DEF",
    team,
    source: "FantasyPros",
    updatedAt: "2026-09-08T18:00:00.000Z",
    weeks,
    bestWeek: 1,
    bestRankEcr: 12,
    bestPositionRank: "DEF12",
    averageRankEcr: 12,
    rankDelta: null,
    bestMatchupStars: Math.max(...stars),
    bestOpponentRank: 4,
    matchupWindows: buildMatchupWindowSet(weeks, { currentWeek: 1 }),
    confidence: 90,
    note: `${name} matchup test.`,
    sourceTrace: [],
    traceSummary: "test",
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

describe("waiver defense pairing read", () => {
  it("pairs a rostered defense with an available defense that covers hard weeks", () => {
    const rosteredSignal = defenseSignal(
      "owned-defense",
      "Owned Defense",
      "BUF",
      [5, 1, 5, 1, 3, 3]
    );
    const available = defensePlayer("available-defense", "Available Defense", "SEA");
    const availableSignal = defenseSignal(
      "available-defense",
      "Available Defense",
      "SEA",
      [2, 5, 2, 5, 4, 3]
    );
    const plan = buildWaiverDefensePairingPlan({
      data: {
        rosteredTrendingAdds: [],
        availableTrendingAdds: [available],
        highestKtcAvailable: null,
        bestAvailableByPosition: {
          QB: null,
          RB: null,
          WR: null,
          TE: null,
          K: null,
          DEF: available,
        },
        bestTaxiStashes: [],
        recentlyDroppedValuable: [],
        weeklyEcrTargets: [
          { player: available, signal: availableSignal, score: 90 },
        ],
        defensePairingTargets: [
          { player: available, signal: availableSignal, score: 90 },
        ],
      },
      viewerPositionCounts: {
        manager: "Bill",
        QB: 0,
        RB: 0,
        WR: 0,
        TE: 0,
        K: 0,
        DEF: 1,
        starterPlayers: [],
        lineupPlayers: [
          {
            player_id: "owned-defense",
            name: "Owned Defense",
            pos: "DEF",
            team: "BUF",
            value: 400,
            currentPositionRank: "DEF10",
          },
        ],
        rosterPlayers: [],
      } as ReportData["managerPositionCounts"][number],
      leagueDiagnostics: { rosterSlots: ["QB", "RB", "WR", "TE", "DEF", "BN"] } as ReportData["leagueDiagnostics"],
      scheduleEdgeTargets: [
        {
          player: defensePlayer("fantasypros-owned", "Owned Defense", "BUF"),
          signal: rosteredSignal,
          score: 70,
        },
      ],
    });

    expect(plan).toMatchObject({
      action: "pair",
      title: "Pair Owned Defense with Available Defense",
    });
    expect(plan?.summary).toContain("easy");
    expect(plan?.evidence.join(" ")).toContain("Available Defense");
  });
});
