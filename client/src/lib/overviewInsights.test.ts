import { describe, expect, it } from "vitest";
import type { ReportData } from "@shared/types";
import {
  buildManagerPositionRoomPreview,
  buildOverviewPulseRead,
  buildRosterStarterPreview,
  buildTaxiTriagePreview,
  getOverviewDefaultManager,
  getOverviewNeedPosition,
  getOverviewPositionGrade,
  getOverviewSurplusPosition,
} from "./overviewInsights";

function report(overrides: Partial<ReportData> = {}): ReportData {
  return {
    leagueOverview: [
      {
        manager: "Alpha",
        rank_value: 2,
        rank_qb: 1,
        rank_rb: 4,
        rank_wr: 2,
        rank_te: 3,
        total_val: 1000,
      },
      {
        manager: "Beta",
        rank_value: 1,
        rank_qb: 5,
        rank_rb: 2,
        rank_wr: 3,
        rank_te: 1,
        total_val: 1100,
      },
    ],
    managerRosterIntelligence: [
      {
        manager: "Alpha",
        starterValue: 500,
        starterSeasonValue: 700,
        tradePlan: { needPosition: "RB", surplusPosition: "WR" },
        taxiTriage: {
          items: [{ name: "Taxi One" }],
          counts: { "Promote Now": 1, Cuttable: 0 },
        },
        positionGrades: { QB: { grade: "A", note: "Direct grade" } },
      },
      {
        manager: "Beta",
        starterValue: 400,
        starterSeasonValue: 450,
        taxiTriage: {
          items: [{ name: "Taxi Two" }, { name: "Taxi Three" }],
          counts: { "Promote Now": 0, Cuttable: 2 },
        },
      },
    ],
    powerRankings: [
      { manager: "Alpha", starterStrength: 70 },
      { manager: "Beta", starterStrength: 90 },
    ],
    positionDepth: [
      { manager: "Beta", position: "TE", status: "shortage" },
      { manager: "Beta", position: "QB", status: "excess" },
    ],
    managerPositionCounts: [
      { manager: "Alpha", totalRosterPlayerCount: 11 },
      { manager: "Beta", totalRosterPlayerCount: 13 },
    ],
    leagueDiagnostics: {
      teamCount: 2,
      totalRosterSlots: 12,
      aiConfidence: { score: 72, label: "Building confidence" },
    },
    ...overrides,
  } as ReportData;
}

describe("overviewInsights", () => {
  it("uses the shared default-manager and narrative pulse rules", () => {
    const data = report();

    expect(getOverviewDefaultManager(data)).toBe("Beta");

    const pulse = buildOverviewPulseRead(data);
    expect(pulse.manager).toBe("Beta");
    expect(pulse.body).toContain("narrative handoff");
    expect(pulse.body).not.toMatch(
      /Value rank #|Best first trade angle|shortage to exploit/i
    );
    expect(pulse.chips).toContain("Narrative only");
  });

  it("centralizes roster, taxi, and room preview leaders", () => {
    const data = report();

    expect(buildRosterStarterPreview(data)).toMatchObject({
      strongestStarterManager: "Alpha",
      weakestStarterManager: "Beta",
    });
    expect(buildTaxiTriagePreview(data)).toMatchObject({
      mostPromotableManager: "Alpha",
      promoteCount: 1,
      mostCuttableManager: "Beta",
      cutCount: 2,
    });
    expect(buildManagerPositionRoomPreview(data)).toMatchObject({
      needToDropManager: "Beta",
      needToDropCount: 1,
      openRoomManager: "Alpha",
      openRoomCount: 1,
    });
  });

  it("keeps need, surplus, and position grades in one place", () => {
    const data = report();

    expect(getOverviewNeedPosition(data, "Alpha")).toBe("RB");
    expect(getOverviewSurplusPosition(data, "Alpha")).toBe("WR");
    expect(getOverviewNeedPosition(data, "Beta")).toBe("TE");
    expect(getOverviewSurplusPosition(data, "Beta")).toBe("QB");
    expect(
      getOverviewPositionGrade(data, data.managerRosterIntelligence[0], data.leagueOverview[0], "QB")
    ).toBe("A");
  });
});
