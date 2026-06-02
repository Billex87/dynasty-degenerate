import { describe, expect, it } from "vitest";
import type {
  RecentTransaction,
  ReportData,
  TrendingPlayer,
  WaiverWeeklyEcrSignal,
  WaiverWeeklyEcrWeek,
} from "@shared/types";
import { buildMatchupWindowSet } from "@shared/matchupWindows";
import {
  buildWaiverRecommendationContext,
  buildWaiverDefensePairingPlan,
  buildWaiverValueCards,
} from "./WaiverIntelligencePanel";

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
    signalType: "draftsharks-sos",
    playerId,
    fantasyProsId: null,
    name,
    position: "DEF",
    team,
    source: "DraftSharks",
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

describe("waiver recommendation evidence gate", () => {
  const waiverReceiver: TrendingPlayer = {
    player_id: "waiver1",
    name: "Waiver Receiver",
    pos: "WR",
    team: "NYJ",
    owner: null,
    count: 500,
    ktcValue: 2800,
    currentPositionRank: "WR42",
    playerDetails: {
      playerId: "waiver1",
      fullName: "Waiver Receiver",
      position: "WR",
      team: "NYJ",
      valueProfile: {
        dynastyValue: 2800,
        seasonValue: 3400,
        dynastyPositionRank: "WR42",
        seasonPositionRank: "WR31",
        sources: ["KTC", "FantasyCalc"],
      },
    },
  };

  const baseManagerIntel = {
    manager: "Bill",
    tradePlan: { needPosition: "WR", surplusPosition: null, summary: "Need WR." },
    benchBaseline: [],
    reservePlayers: [],
    rosterPlayers: [],
    droppablePlayers: [
      {
        player_id: "drop1",
        name: "Bench Receiver",
        pos: "WR",
        value: 900,
        seasonValue: 700,
        currentPositionRank: "WR96",
        seasonPositionRank: "WR88",
      },
    ],
    holes: { flexDepth: 0 },
  } as unknown as NonNullable<ReportData["managerRosterIntelligence"]>[number];

  const basePositionCounts = {
    manager: "Bill",
    activePlayerCount: 8,
    reservePlayerCount: 0,
    QB: 1,
    QB_starters: 1,
    RB: 2,
    RB_starters: 2,
    WR: 3,
    WR_starters: 2,
    TE: 1,
    TE_starters: 1,
    K: 0,
    K_starters: 0,
    DEF: 1,
    DEF_starters: 1,
    lineupPlayers: [],
    rosterPlayers: [],
  } as ReportData["managerPositionCounts"][number];

  function waiverData(player: TrendingPlayer): NonNullable<ReportData["waiverIntelligence"]> {
    return {
      rosteredTrendingAdds: [],
      availableTrendingAdds: [player],
      highestKtcAvailable: player,
      bestAvailableByPosition: {
        QB: null,
        RB: null,
        WR: player,
        TE: null,
        K: null,
        DEF: null,
      },
      bestTaxiStashes: [],
      recentlyDroppedValuable: [],
      weeklyEcrTargets: [],
      omittedCandidates: [],
    };
  }

  it("does not recommend a stale available player after a live transaction add", () => {
    const context = buildWaiverRecommendationContext({
      data: waiverData(waiverReceiver),
      viewerManager: "Bill",
      managerRosterIntelligence: [baseManagerIntel],
      managerPositionCounts: [basePositionCounts],
      positionDepth: [{ manager: "Bill", position: "WR", status: "shortage", count: 3 }],
      leagueDiagnostics: {
        rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "DEF", "BN", "BN"],
        valueMode: "redraft",
      } as ReportData["leagueDiagnostics"],
      recentTransactions: [
        transaction({
          id: "tx-claimed",
          date: "2026-05-03",
          manager: "Tester",
          addedPlayer: {
            player_id: "waiver1",
            name: "Waiver Receiver",
            pos: "WR",
            team: "NYJ",
            ktcValue: 2800,
          },
          droppedPlayer: null,
        }),
      ],
      leagueValueMode: "redraft",
    });

    expect(context.recommendations.map(recommendation => recommendation.player.name)).not.toContain("Waiver Receiver");
    expect(context.summary).toBeNull();
  });

  it("uses priority language instead of FAAB ranges for waiver-priority leagues", () => {
    const context = buildWaiverRecommendationContext({
      data: waiverData(waiverReceiver),
      viewerManager: "Bill",
      managerRosterIntelligence: [baseManagerIntel],
      managerPositionCounts: [basePositionCounts],
      positionDepth: [{ manager: "Bill", position: "WR", status: "shortage", count: 3 }],
      leagueDiagnostics: {
        rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "DEF", "BN", "BN"],
        valueMode: "redraft",
        waiverMode: "priority",
        waiverModeLabel: "Waiver priority",
        waiverType: 1,
        waiverBudget: 100,
      } as ReportData["leagueDiagnostics"],
      recentTransactions: [],
      leagueValueMode: "redraft",
    });

    expect(context.recommendations[0]?.bidSource).toBe("priority");
    expect(context.recommendations[0]?.bidRangeLabel).toMatch(/priority|waivers|Free add/i);
    expect(context.recommendations[0]?.bidRangeLabel).not.toContain("FAAB");
    expect(context.recommendations[0]?.bidEvidenceLabel).toContain("Waiver priority");
    expect(context.summary).toContain("Review this");
    expect(context.summary).not.toContain("Do this");
  });

  it("blocks dynasty-only stash evidence from redraft waiver advice", () => {
    const dynastyOnly = {
      ...waiverReceiver,
      player_id: "dynasty-only",
      name: "Dynasty Only Stash",
      playerDetails: {
        ...waiverReceiver.playerDetails,
        playerId: "dynasty-only",
        fullName: "Dynasty Only Stash",
        valueProfile: {
          dynastyValue: 2600,
          dynastyPositionRank: "WR48",
          sources: ["KTC", "FantasyCalc"],
        },
      },
    } as TrendingPlayer;

    const context = buildWaiverRecommendationContext({
      data: waiverData(dynastyOnly),
      viewerManager: "Bill",
      managerRosterIntelligence: [baseManagerIntel],
      managerPositionCounts: [basePositionCounts],
      positionDepth: [{ manager: "Bill", position: "WR", status: "shortage", count: 3 }],
      leagueDiagnostics: {
        rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "DEF", "BN", "BN"],
        valueMode: "redraft",
      } as ReportData["leagueDiagnostics"],
      recentTransactions: [],
      leagueValueMode: "redraft",
    });

    expect(context.recommendations.map(recommendation => recommendation.player.name)).not.toContain("Dynasty Only Stash");
  });
});

describe("waiver value card ordering", () => {
  it("promotes the defense slot when a defense pairing is present", () => {
    const cards = buildWaiverValueCards({
      data: {
        highestKtcAvailable: {
          player_id: "qb1",
          name: "Aaron Rodgers",
          pos: "QB",
          team: "NYJ",
          owner: null,
          count: 0,
          ktcValue: 1200,
          currentPositionRank: "QB12",
        },
        bestAvailableByPosition: {
          QB: null,
          RB: null,
          WR: null,
          TE: null,
          K: null,
          DEF: defensePlayer("def1", "Green Bay Packers", "GB"),
        },
        bestTaxiStashes: [],
      } as NonNullable<ReportData["waiverIntelligence"]>,
      isRedraft: false,
      prioritizeDefense: true,
      omittedCandidateIds: new Set(),
    });

    expect(cards.slice(0, 2).map(card => card.label)).toEqual([
      "Best DEF",
      "Highest Available",
    ]);
    expect(cards[0]?.player.name).toBe("Green Bay Packers");
  });
});
