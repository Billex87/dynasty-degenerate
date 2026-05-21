import { describe, expect, it } from "vitest";
import { buildWaiverIntelligence } from "./routers";

describe("buildWaiverIntelligence", () => {
  it("keeps omitted waiver candidates out of visible recommendation surfaces", () => {
    const players = {
      dallen: {
        first_name: "Dallen",
        last_name: "Bentley",
        position: "TE",
        team: null,
        active: true,
        fantasy_positions: ["TE"],
        metadata: { rookie_year: String(new Date().getFullYear()) },
      },
      trusted: {
        first_name: "Trusted",
        last_name: "Tightend",
        position: "TE",
        team: "KC",
        active: true,
        fantasy_positions: ["TE"],
        metadata: { rookie_year: String(new Date().getFullYear()) },
      },
    };
    const ktcValues = {
      dallenbentley: {
        name: "Dallen Bentley",
        ktc_value: 1800,
        dynasty_value: 1800,
        market_value_ktc: 1800,
        position_rank: "TE20",
        value_sources: ["KTC"],
      },
      trustedtightend: {
        name: "Trusted Tightend",
        ktc_value: 2200,
        dynasty_value: 2200,
        market_value_ktc: 2200,
        position_rank: "TE12",
        value_sources: ["KTC", "FantasyCalc"],
      },
    };
    const dallenTrending = {
      player_id: "dallen",
      name: "Dallen Bentley",
      pos: "TE",
      team: null,
      owner: null,
      count: 10,
      ktcValue: 1800,
      currentPositionRank: "TE20",
    };
    const trustedTrending = {
      player_id: "trusted",
      name: "Trusted Tightend",
      pos: "TE",
      team: "KC",
      owner: null,
      count: 8,
      ktcValue: 2200,
      currentPositionRank: "TE12",
    };

    const result = buildWaiverIntelligence(
      [dallenTrending, trustedTrending],
      [dallenTrending, trustedTrending],
      players,
      ktcValues,
      {},
      {},
      "dynasty",
      undefined,
      { rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"] }
    );

    expect(result.omittedCandidates.map(player => player.name)).toContain("Dallen Bentley");
    expect(result.availableTrendingAdds.map(player => player.name)).toEqual(["Trusted Tightend"]);
    expect(result.highestKtcAvailable?.name).toBe("Trusted Tightend");
    expect(result.recentlyDroppedValuable.map(player => player.name)).toEqual(["Trusted Tightend"]);
    expect(JSON.stringify({
      availableTrendingAdds: result.availableTrendingAdds,
      highestKtcAvailable: result.highestKtcAvailable,
      bestAvailableByPosition: result.bestAvailableByPosition,
      bestTaxiStashes: result.bestTaxiStashes,
      recentlyDroppedValuable: result.recentlyDroppedValuable,
    })).not.toContain("Dallen Bentley");
  });

  it("uses rolling FantasyPros ECR as an all-position waiver target signal", () => {
    const players = {
      ecrwr: {
        first_name: "Schedule",
        last_name: "Receiver",
        position: "WR",
        team: "KC",
        active: true,
        fantasy_positions: ["WR"],
      },
      fringe: {
        first_name: "Fringe",
        last_name: "Receiver",
        position: "WR",
        team: "KC",
        active: true,
        fantasy_positions: ["WR"],
      },
    };
    const fantasyProsSnapshotContext = {
      generatedAt: "2026-09-08T19:00:00.000Z",
      season: "2026",
      scoring: "PPR",
      summaries: [
        {
          sourceKey: "fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr-wr-week-2",
          endpointKey: "fantasypros-weekly-ecr-wr-week-2",
          source: "FantasyPros WR weekly ECR Week 2",
          status: "loaded",
          rowCount: 2,
          totalExperts: 34,
          lastUpdated: "2026-09-08T18:55:00.000Z",
          fetchedAt: "2026-09-08T19:00:00.000Z",
        },
        {
          sourceKey: "fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr-wr-week-3",
          endpointKey: "fantasypros-weekly-ecr-wr-week-3",
          source: "FantasyPros WR weekly ECR Week 3",
          status: "loaded",
          rowCount: 1,
          totalExperts: 34,
          lastUpdated: "2026-09-08T18:55:00.000Z",
          fetchedAt: "2026-09-08T19:00:00.000Z",
        },
        {
          sourceKey: "fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr-wr-week-4",
          endpointKey: "fantasypros-weekly-ecr-wr-week-4",
          source: "FantasyPros WR weekly ECR Week 4",
          status: "loaded",
          rowCount: 1,
          totalExperts: 34,
          lastUpdated: "2026-09-08T18:55:00.000Z",
          fetchedAt: "2026-09-08T19:00:00.000Z",
        },
      ],
      rowCounts: [],
      weeklyEcrByFantasyProsId: {},
      waiverWireByFantasyProsId: {},
      projectionsByFantasyProsId: {},
      playerPointsByFantasyProsId: {},
      playersByFantasyProsId: {},
      comparePlayersByFantasyProsId: {},
      weeklyEcrByPositionWeek: {
        WR: {
          "2": {
            fp1: {
              fantasyProsId: "fp1",
              name: "Schedule Receiver",
              position: "WR",
              team: "KC",
              rankEcr: 44,
              positionRank: "WR44",
              bestRank: 38,
              worstRank: 58,
              averageRank: 46.4,
              rankStdDev: 6,
              byeWeek: null,
              season: "2026",
              scoring: "PPR",
              week: 2,
              lastUpdated: "2026-09-08T18:55:00.000Z",
            },
            fp2: {
              fantasyProsId: "fp2",
              name: "Fringe Receiver",
              position: "WR",
              team: "KC",
              rankEcr: 112,
              positionRank: "WR112",
              bestRank: 99,
              worstRank: 130,
              averageRank: 113.2,
              rankStdDev: 12,
              byeWeek: null,
              season: "2026",
              scoring: "PPR",
              week: 2,
              lastUpdated: "2026-09-08T18:55:00.000Z",
            },
          },
          "3": {
            fp1: {
              fantasyProsId: "fp1",
              name: "Schedule Receiver",
              position: "WR",
              team: "KC",
              rankEcr: 42,
              positionRank: "WR42",
              bestRank: 35,
              worstRank: 55,
              averageRank: 43.8,
              rankStdDev: 6,
              byeWeek: null,
              season: "2026",
              scoring: "PPR",
              week: 3,
              lastUpdated: "2026-09-08T18:55:00.000Z",
            },
          },
          "4": {
            fp1: {
              fantasyProsId: "fp1",
              name: "Schedule Receiver",
              position: "WR",
              team: "KC",
              rankEcr: 40,
              positionRank: "WR40",
              bestRank: 33,
              worstRank: 50,
              averageRank: 41.1,
              rankStdDev: 5,
              byeWeek: null,
              season: "2026",
              scoring: "PPR",
              week: 4,
              lastUpdated: "2026-09-08T18:55:00.000Z",
            },
          },
        },
      },
    };

    const result = buildWaiverIntelligence(
      [],
      [],
      players,
      {},
      {},
      {},
      "redraft",
      undefined,
      {
        rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
        fantasyProsSnapshotContext: fantasyProsSnapshotContext as any,
      }
    );

    expect(result.weeklyEcrTargets?.[0]?.player.name).toBe("Schedule Receiver");
    expect(result.weeklyEcrTargets?.[0]?.signal.bestPositionRank).toBe("WR40");
    expect(result.weeklyEcrTargets?.[0]?.signal.rankDelta).toBe(4);
    expect(result.weeklyEcrTargets?.[0]?.signal.traceSummary).toContain("W2/W3/W4");
    expect(result.weeklyEcrTargets?.[0]?.signal.sourceTrace[0]).toMatchObject({
      sourceKey: "fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr-wr-week-2",
      endpointKey: "fantasypros-weekly-ecr-wr-week-2",
      rowCount: 2,
      status: "loaded",
    });
    expect(result.highestKtcAvailable?.weeklyEcr?.note).toContain("W2 WR44");
    expect(result.omittedCandidates.map(player => player.name)).toContain("Fringe Receiver");
  });

  it("uses DraftSharks SOS percentages for defense streamer priority", () => {
    const players = {
      ramsdst: {
        first_name: "Los Angeles",
        last_name: "Rams",
        position: "DEF",
        team: "LAR",
        active: true,
        fantasy_positions: ["DEF"],
      },
      streamdst: {
        first_name: "Streaming",
        last_name: "Defense",
        position: "DEF",
        team: "LV",
        active: true,
        fantasy_positions: ["DEF"],
      },
    };
    const draftSharksScheduleContext = {
      status: "loaded",
      source: "DraftSharks SOS",
      updatedAt: "2026-09-01T18:00:00.000Z",
      profiles: {
        "LAR:DEF": {
          team: "LAR",
          position: "DEF",
          seasonSOS: null,
          remainingSOS: -12,
          scheduleTier: "hard",
          streamerWeeks: [],
          avoidWeeks: [1, 2, 3],
          weeklyMatchups: [
            { week: 1, opponent: "SF", homeAway: "home", matchupPercent: -20, matchupTier: "hard" },
            { week: 2, opponent: "NYG", homeAway: "home", matchupPercent: -14, matchupTier: "hard" },
            { week: 3, opponent: "DEN", homeAway: "home", matchupPercent: -10, matchupTier: "hard" },
          ],
          source: "DraftSharks SOS",
          updatedAt: "2026-09-01T18:00:00.000Z",
        },
        "LV:DEF": {
          team: "LV",
          position: "DEF",
          seasonSOS: null,
          remainingSOS: 18,
          scheduleTier: "easy",
          streamerWeeks: [1, 2, 3],
          avoidWeeks: [],
          weeklyMatchups: [
            { week: 1, opponent: "TEN", homeAway: "home", matchupPercent: 22, matchupTier: "easy" },
            { week: 2, opponent: "NYG", homeAway: "home", matchupPercent: 16, matchupTier: "easy" },
            { week: 3, opponent: "CAR", homeAway: "home", matchupPercent: 11, matchupTier: "easy" },
          ],
          source: "DraftSharks SOS",
          updatedAt: "2026-09-01T18:00:00.000Z",
        },
      },
    };

    const result = buildWaiverIntelligence(
      [],
      [],
      players,
      {},
      {},
      {},
      "redraft",
      undefined,
      {
        rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "DEF", "BN"],
        draftSharksScheduleContext: draftSharksScheduleContext as any,
        currentWeek: 1,
      }
    );

    expect(result.highestKtcAvailable?.name).toBe("Streaming Defense");
    expect(result.bestAvailableByPosition.DEF?.name).not.toBe("Los Angeles Rams");
    expect(result.weeklyEcrTargets?.[0]?.signal.source).toBe("DraftSharks");
    expect(result.weeklyEcrTargets?.[0]?.signal.signalType).toBe("draftsharks-sos");
    expect(result.weeklyEcrTargets?.[0]?.signal.matchupWindows?.next3.easyWeeks).toBe(3);
    expect(result.weeklyEcrTargets?.find(target => target.player.name === "Los Angeles Rams")).toBeUndefined();
  });
});
