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

  it("prefers FantasyPros matchup-calendar rows for waiver target context", () => {
    const players = {
      matchupwr: {
        first_name: "Matchup",
        last_name: "Receiver",
        position: "WR",
        team: "KC",
        active: true,
        fantasy_positions: ["WR"],
      },
      hardwr: {
        first_name: "Hard",
        last_name: "Receiver",
        position: "WR",
        team: "KC",
        active: true,
        fantasy_positions: ["WR"],
      },
    };
    const fantasyProsMatchupCalendarContext = {
      generatedAt: "2026-09-08T19:00:00.000Z",
      season: "2026",
      summaries: [{
        sourceKey: "fantasypros-matchup-calendar-v1:2026:WR",
        source: "FantasyPros WR matchup calendar",
        position: "WR",
        status: "loaded",
        rowCount: 3,
        weekCount: 3,
        fetchedAt: "2026-09-08T19:00:00.000Z",
        sourceUrl: "https://www.fantasypros.com/nfl/matchups/wr.php",
      }],
      rowCounts: [{ sourceKey: "fantasypros-matchup-calendar-v1:2026:WR", rowCount: 3 }],
      rowsByFantasyProsId: {},
      rowsByPositionWeek: {
        WR: {
          "2": {
            fp1: {
              fantasyProsId: "fp1",
              name: "Matchup Receiver",
              position: "WR",
              team: "KC",
              rank: 44,
              positionRank: "WR44",
              week: 2,
              opponent: "LV",
              homeAway: "home",
              opponentRank: 2,
              matchupStars: 5,
              matchupTier: "easy",
              matchupText: "This is a 5 star matchup.",
              isBye: false,
              sourceKey: "fantasypros-matchup-calendar-v1:2026:WR",
              sourceUrl: "https://www.fantasypros.com/nfl/matchups/wr.php",
              fetchedAt: "2026-09-08T19:00:00.000Z",
            },
            fp2: {
              fantasyProsId: "fp2",
              name: "Hard Receiver",
              position: "WR",
              team: "KC",
              rank: 125,
              positionRank: "WR125",
              week: 2,
              opponent: "DEN",
              homeAway: "away",
              opponentRank: 31,
              matchupStars: 1,
              matchupTier: "hard",
              matchupText: "This is a 1 star matchup.",
              isBye: false,
              sourceKey: "fantasypros-matchup-calendar-v1:2026:WR",
              sourceUrl: "https://www.fantasypros.com/nfl/matchups/wr.php",
              fetchedAt: "2026-09-08T19:00:00.000Z",
            },
          },
          "3": {
            fp1: {
              fantasyProsId: "fp1",
              name: "Matchup Receiver",
              position: "WR",
              team: "KC",
              rank: 44,
              positionRank: "WR44",
              week: 3,
              opponent: "LAC",
              homeAway: "away",
              opponentRank: 8,
              matchupStars: 4,
              matchupTier: "easy",
              matchupText: "This is a 4 star matchup.",
              isBye: false,
              sourceKey: "fantasypros-matchup-calendar-v1:2026:WR",
              sourceUrl: "https://www.fantasypros.com/nfl/matchups/wr.php",
              fetchedAt: "2026-09-08T19:00:00.000Z",
            },
          },
          "15": {
            fp1: {
              fantasyProsId: "fp1",
              name: "Matchup Receiver",
              position: "WR",
              team: "KC",
              rank: 44,
              positionRank: "WR44",
              week: 15,
              opponent: "LV",
              homeAway: "home",
              opponentRank: 3,
              matchupStars: 5,
              matchupTier: "easy",
              matchupText: "This is a 5 star matchup.",
              isBye: false,
              sourceKey: "fantasypros-matchup-calendar-v1:2026:WR",
              sourceUrl: "https://www.fantasypros.com/nfl/matchups/wr.php",
              fetchedAt: "2026-09-08T19:00:00.000Z",
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
        fantasyProsMatchupCalendarContext: fantasyProsMatchupCalendarContext as any,
        currentWeek: 3,
        playoffWeeks: [15, 16, 17],
      }
    );

    expect(result.weeklyEcrTargets?.[0]?.player.name).toBe("Matchup Receiver");
    expect(result.weeklyEcrTargets?.[0]?.signal.signalType).toBe("matchup-calendar");
    expect(result.weeklyEcrTargets?.[0]?.signal.bestMatchupStars).toBe(5);
    expect(result.weeklyEcrTargets?.[0]?.signal.note).toContain("W3 at LAC 4-star");
    expect(result.weeklyEcrTargets?.[0]?.signal.note).not.toContain("W2 vs. LV");
    expect(result.weeklyEcrTargets?.[0]?.signal.matchupWindows?.currentWeek).toBe(3);
    expect(result.weeklyEcrTargets?.[0]?.signal.matchupWindows?.playoffs.weeks).toEqual([15, 16, 17]);
    expect(result.weeklyEcrTargets?.[0]?.signal.matchupWindows?.playoffs.easyWeeks).toBe(1);
    expect(result.weeklyEcrTargets?.[0]?.signal.sourceTrace[0]).toMatchObject({
      sourceKey: "fantasypros-matchup-calendar-v1:2026:WR",
      endpointKey: "fantasypros-matchup-calendar-wr-week-2",
      rowCount: 3,
      status: "loaded",
    });
    expect(result.omittedCandidates.map(player => player.name)).toContain("Hard Receiver");
  });

  it("does not treat a rough next-three defense schedule as a pickup just because the defense is highly ranked", () => {
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
    const fetchedAt = "2026-09-01T18:00:00.000Z";
    const sourceKey = "fantasypros-matchup-calendar-v1:2026:DST";
    const makeDstRow = (
      fantasyProsId: string,
      name: string,
      team: string,
      rank: number,
      week: number,
      opponent: string,
      opponentRank: number,
      matchupStars: number,
      matchupTier: "easy" | "neutral" | "hard"
    ) => ({
      fantasyProsId,
      name,
      position: "DST",
      team,
      rank,
      positionRank: `DST${rank}`,
      week,
      opponent,
      homeAway: "home",
      opponentRank,
      matchupStars,
      matchupTier,
      matchupText: `This is a ${matchupStars} star matchup.`,
      isBye: false,
      sourceKey,
      sourceUrl: "https://www.fantasypros.com/nfl/matchups/dst.php",
      fetchedAt,
    });
    const fantasyProsMatchupCalendarContext = {
      generatedAt: fetchedAt,
      season: "2026",
      summaries: [{
        sourceKey,
        source: "FantasyPros DST matchup calendar",
        position: "DST",
        status: "loaded",
        rowCount: 6,
        weekCount: 3,
        fetchedAt,
        sourceUrl: "https://www.fantasypros.com/nfl/matchups/dst.php",
      }],
      rowCounts: [{ sourceKey, rowCount: 6 }],
      rowsByFantasyProsId: {},
      rowsByPositionWeek: {
        DST: {
          "1": {
            rams: makeDstRow("rams", "Los Angeles Rams", "LAR", 4, 1, "SF", 28, 1, "hard"),
            stream: makeDstRow("stream", "Streaming Defense", "LV", 12, 1, "TEN", 1, 5, "easy"),
          },
          "2": {
            rams: makeDstRow("rams", "Los Angeles Rams", "LAR", 4, 2, "NYG", 13, 3, "neutral"),
            stream: makeDstRow("stream", "Streaming Defense", "LV", 12, 2, "NYG", 8, 4, "easy"),
          },
          "3": {
            rams: makeDstRow("rams", "Los Angeles Rams", "LAR", 4, 3, "DEN", 22, 2, "hard"),
            stream: makeDstRow("stream", "Streaming Defense", "LV", 12, 3, "CAR", 7, 4, "easy"),
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
        rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "DEF", "BN"],
        fantasyProsMatchupCalendarContext: fantasyProsMatchupCalendarContext as any,
        currentWeek: 1,
      }
    );

    expect(result.highestKtcAvailable?.name).toBe("Streaming Defense");
    expect(result.bestAvailableByPosition.DEF?.name).not.toBe("Los Angeles Rams");
    expect(result.highestKtcAvailable?.weeklyEcr?.matchupWindows?.next3.easyWeeks).toBe(3);
    expect(result.weeklyEcrTargets?.[0]?.player.name).toBe("Streaming Defense");
    expect(result.weeklyEcrTargets?.[0]?.score || 0).toBeGreaterThan(
      result.weeklyEcrTargets?.find(target => target.player.name === "Los Angeles Rams")?.score || 0
    );
  });
});
