import { describe, expect, it } from "vitest";
import type { ReportData } from "@shared/types";
import { sanitizeCachedReportData } from "./reportCacheSanitizer";

const baseReportData = (): ReportData => ({
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
});

describe("sanitizeCachedReportData", () => {
  it("removes omitted waiver candidates from visible cached waiver surfaces", () => {
    const omitted = {
      player_id: "dallen",
      name: "Dallen Bentley",
      pos: "TE",
      team: null,
      owner: null,
      count: 12,
      ktcValue: 1500,
      currentPositionRank: "TE20",
    };
    const trusted = {
      player_id: "trusted",
      name: "Trusted Tight End",
      pos: "TE",
      team: "KC",
      owner: null,
      count: 7,
      ktcValue: 2200,
      currentPositionRank: "TE12",
    };
    const reportData: ReportData = {
      ...baseReportData(),
      trendingAdds: [omitted, trusted],
      waiverIntelligence: {
        rosteredTrendingAdds: [],
        availableTrendingAdds: [omitted, trusted],
        highestKtcAvailable: omitted,
        bestAvailableByPosition: {
          QB: null,
          RB: null,
          WR: null,
          TE: omitted,
          K: null,
          DEF: null,
        },
        bestTaxiStashes: [omitted],
        recentlyDroppedValuable: [omitted, trusted],
        omittedCandidates: [{
          player_id: "dallen",
          name: "Dallen Bentley",
          pos: "TE",
          team: null,
          value: 1500,
          rank: "TE20",
          sourceCount: 1,
          reason: "No active NFL team on the Sleeper player record.",
          action: "omit",
        }],
      },
    };

    const sanitized = sanitizeCachedReportData(reportData);

    const visibleWaiverSurfaces = {
      availableTrendingAdds: sanitized.waiverIntelligence?.availableTrendingAdds,
      highestKtcAvailable: sanitized.waiverIntelligence?.highestKtcAvailable,
      bestAvailableByPosition: sanitized.waiverIntelligence?.bestAvailableByPosition,
      bestTaxiStashes: sanitized.waiverIntelligence?.bestTaxiStashes,
      recentlyDroppedValuable: sanitized.waiverIntelligence?.recentlyDroppedValuable,
    };

    expect(JSON.stringify(visibleWaiverSurfaces)).not.toContain("Dallen Bentley");
    expect(sanitized.trendingAdds?.map(player => player.name)).toEqual(["Trusted Tight End"]);
    expect(sanitized.waiverIntelligence?.highestKtcAvailable).toBeNull();
    expect(sanitized.waiverIntelligence?.bestAvailableByPosition.TE).toBeNull();
    expect(sanitized.waiverIntelligence?.availableTrendingAdds.map(player => player.name)).toEqual(["Trusted Tight End"]);
    expect(sanitized.waiverIntelligence?.recentlyDroppedValuable.map(player => player.name)).toEqual(["Trusted Tight End"]);
    expect(sanitized.waiverIntelligence?.omittedCandidates?.[0]?.name).toBe("Dallen Bentley");
  });

  it("repairs starter groups from starter players and downgrades unfillable counts", () => {
    const qb = { player_id: "qb1", name: "Starter QB", pos: "QB", value: 5000 };
    const rb = { player_id: "rb1", name: "Starter RB", pos: "RB", value: 4200 };
    const wr = { player_id: "wr1", name: "Starter WR", pos: "WR", value: 4000 };
    const reportData: ReportData = {
      ...baseReportData(),
      managerPositionCounts: [{
        manager: "Tester",
        QB: 1,
        QB_starters: 1,
        RB: 1,
        RB_starters: 1,
        WR: 1,
        WR_starters: 1,
        TE: 0,
        TE_starters: 0,
        starterPlayers: [qb, rb, wr],
        lineupPlayers: [qb, rb, wr],
        rosterPlayers: [qb, rb, wr],
        starterGroups: [
          { key: "QB", label: "QB", count: 1, players: [] },
          { key: "RB", label: "RB", count: 1, players: [] },
          { key: "WR", label: "WR", count: 1, players: [] },
          { key: "TE", label: "TE", count: 1, players: [] },
        ],
      }],
    };

    const sanitized = sanitizeCachedReportData(reportData);
    const groups = sanitized.managerPositionCounts[0]?.starterGroups || [];

    expect(groups.find(group => group.key === "QB")?.players.map(player => player.name)).toEqual(["Starter QB"]);
    expect(groups.find(group => group.key === "RB")?.players.map(player => player.name)).toEqual(["Starter RB"]);
    expect(groups.find(group => group.key === "WR")?.players.map(player => player.name)).toEqual(["Starter WR"]);
    expect(groups.find(group => group.key === "TE")?.count).toBe(0);
  });
});
