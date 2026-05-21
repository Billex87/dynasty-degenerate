import { describe, expect, it } from "vitest";
import { buildAIEvidenceLeagueActivityContext } from "@shared/leagueActivityContext";
import { buildLeagueSharpnessProfile } from "@shared/leagueSharpness";
import { evaluateAIEvidence } from "@shared/aiEvidenceEngine";
import type { ReportData } from "@shared/types";

function buildBaseReport(overrides: Partial<ReportData> = {}): ReportData {
  return {
    leagueDiagnostics: {
      teamCount: 12,
      valueMode: "dynasty",
      qbFormat: "superflex",
      rosterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"],
      starterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"],
      lineupSlotSummary: "7 starters",
      starterCountSummary: "7 starters",
      starterCalculation: "test",
      benchCalculation: "test",
      tradeableDepthCalculation: "test",
      scoringSummary: "PPR",
      receptionScoring: 1,
      tightEndPremium: 0,
      ktcProfileLabel: "Superflex",
      valueSnapshotProfileCount: 1,
      valueSnapshotProfiles: ["sf"],
      valueLimitations: [],
    },
    managerRosterValueGrowth: [],
    weeklyRisers: [],
    weeklyFallers: [],
    leagueOverview: [],
    projectedRisers: [],
    projectedFallers: [],
    tradeProfitLeaderboard: [],
    tradeHistory: [],
    positionDepth: [],
    managerPositionCounts: [],
    currentStandings: [],
    ...overrides,
  };
}

describe("league sharpness profile", () => {
  it("scores a deep active league as sharp and feeds the evidence layer", () => {
    const report = buildBaseReport({
      tradeHistory: Array.from({ length: 22 }, (_, index) => ({
        id: `trade-${index}`,
      })) as ReportData["tradeHistory"],
      transactionBackfillDiagnostics: {
        seasonCount: 1,
        completedTradeCount: 22,
        waiverOrFreeAgentCount: 82,
        transactionCount: 118,
        scannedLeagueIds: [],
        failedLeagueIds: [],
        brokenPreviousLeagueIds: [],
      } as ReportData["transactionBackfillDiagnostics"],
      recentTransactions: Array.from({ length: 48 }, (_, index) => ({
        id: `tx-${index}`,
        date: "2026-09-10",
        manager: `manager-${index % 12}`,
        type: index % 2 ? "Waiver" : "Free Agent",
        bidAmount: index % 2 ? 7 : null,
        addedPlayer: null,
        droppedPlayer: null,
        alternativeDrop: null,
        note: "test",
        losingBidsAvailable: false,
      })),
      powerRankings: Array.from({ length: 12 }, (_, index) => ({
        rank: index + 1,
        manager: `manager-${index}`,
        score: 82,
        tier: "contender",
        starterStrength: 84,
        rosterValue: 80,
        positionalBalance: 78,
        draftCapital: 55,
        youthScore: 62,
        tradeEfficiency: 72,
      })),
      managerPositionCounts: Array.from({ length: 12 }, (_, index) => ({
        manager: `manager-${index}`,
        QB: 2,
        QB_starters: 1,
        RB: 5,
        RB_starters: 2,
        WR: 7,
        WR_starters: 3,
        TE: 2,
        TE_starters: 1,
        starterPlayers: Array.from({ length: 7 }, (_, starterIndex) => ({
          player_id: `p-${index}-${starterIndex}`,
          name: `Starter ${starterIndex}`,
          pos: "WR",
          team: "BUF",
          ktcValue: 100,
        })),
      })),
      playerDetailsById: Object.fromEntries(
        Array.from({ length: 260 }, (_, index) => [`p-${index}`, { name: `Player ${index}` }])
      ) as ReportData["playerDetailsById"],
    });

    const profile = buildLeagueSharpnessProfile(report);
    expect(profile?.tier).toMatch(/sharp|shark-tank/);
    expect(profile?.confidence).toBe("usable");

    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      baseScore: 62,
      evidence: ["Value, role, and availability are aligned."],
      leagueActivity: buildAIEvidenceLeagueActivityContext(report),
    });
    expect(read.evidence.join(" ")).toContain("Shark tank");
  });

  it("keeps sleepy leagues from overstating urgency", () => {
    const report = buildBaseReport({
      recentTransactions: [
        {
          id: "tx-1",
          date: "2026-09-10",
          manager: "AwwQQ",
          type: "Free Agent",
          bidAmount: null,
          addedPlayer: null,
          droppedPlayer: null,
          alternativeDrop: null,
          note: "test",
          losingBidsAvailable: false,
        },
      ],
    });

    const profile = buildLeagueSharpnessProfile(report);
    expect(profile?.tier).toBe("sleepy");
    expect(profile?.actionBias).toBe("wait");

    const read = evaluateAIEvidence({
      surface: "trade",
      action: "trade",
      baseScore: 72,
      evidence: ["Trade value and roster fit line up."],
      leagueActivity: buildAIEvidenceLeagueActivityContext(report),
    });
    expect(read.confidenceCapReason).toMatch(/league|trade/i);
  });
});
