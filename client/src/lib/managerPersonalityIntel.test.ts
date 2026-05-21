import { describe, expect, it } from "vitest";
import type { ReportData } from "@shared/types";
import { buildManagerPersonalityIntelRows } from "./managerPersonalityIntel";

describe("manager personality intel", () => {
  it("builds admin-only leaguemate behavior rows from existing report signals", () => {
    const rows = buildManagerPersonalityIntelRows({
      currentStandings: [
        { manager: "AwwQQ", rank: 1, wins: 9, losses: 4, ties: 0, pointsFor: 1800 },
        { manager: "zojozo", rank: 2, wins: 8, losses: 5, ties: 0, pointsFor: 1700 },
      ],
      tradeTendencies: [
        {
          manager: "AwwQQ",
          tradeCount: 7,
          wins: 4,
          winPct: 57,
          profit: 1200,
          avgGap: 240,
          favoritePartner: "zojozo",
          overpaysForPicks: false,
          overpaysForVeterans: true,
        },
      ],
      tradeProposalSignals: [
        {
          id: "proposal-1",
          date: "2026-05-21T12:00:00.000Z",
          status: "countered",
          managers: ["AwwQQ"],
          playerIds: [],
          playerNames: [],
          note: "Countered trade.",
        },
        {
          id: "proposal-2",
          date: "2026-05-20T12:00:00.000Z",
          status: "countered",
          managers: ["AwwQQ"],
          playerIds: [],
          playerNames: [],
          note: "Countered trade.",
        },
      ],
      recentTransactions: [
        {
          id: "tx-1",
          date: "2026-05-19",
          manager: "zojozo",
          type: "Waiver",
          bidAmount: 18,
          addedPlayer: null,
          droppedPlayer: null,
          alternativeDrop: null,
          note: "Added player.",
          losingBidsAvailable: false,
        },
      ],
      managerRosterIntelligence: [
        {
          manager: "AwwQQ",
          taxiPlayers: [{ player_id: "r1", name: "Rookie", pos: "WR", value: 1000 }],
          reservePlayers: [],
          droppablePlayers: [],
        },
      ],
      pickPortfolios: [
        {
          manager: "zojozo",
          value2025: 0,
          value2026: 4000,
          value2027: 6000,
          value2028: 3000,
          count2025: 0,
          count2026: 3,
          count2027: 4,
          count2028: 2,
          totalValue: 13000,
          ownPicks: 5,
          acquiredPicks: 4,
          projectedSlots: [],
        },
      ],
      leagueOverview: [],
      managerRosterValueGrowth: [],
      weeklyRisers: [],
      weeklyFallers: [],
      projectedRisers: [],
      projectedFallers: [],
      tradeProfitLeaderboard: [],
      tradeHistory: [],
      positionDepth: [],
      managerPositionCounts: [],
      powerRankings: [],
      dynastyTimelines: [],
      draftPicks: [],
      draftStats: [],
    } as unknown as ReportData);

    expect(rows.find(row => row.manager === "AwwQQ")).toMatchObject({
      tradeStyle: "Counter-heavy",
      confidence: "building",
    });
    expect(rows.find(row => row.manager === "AwwQQ")?.actionRead).toContain("counter");
    expect(rows.find(row => row.manager === "zojozo")).toMatchObject({
      waiverStyle: "Selective claims",
      rosterStyle: "Pick hoarder",
    });
  });
});
