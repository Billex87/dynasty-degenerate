import { describe, expect, it } from "vitest";
import type { ManagerStarterPlayer, ReportData, WeeklyProjectionContext } from "../shared/types";
import { buildRedraftValuation } from "./redraftValuation";

function projection(points: number): WeeklyProjectionContext {
  return {
    source: "stored-weekly-projection",
    provider: "sleeper",
    season: "2026",
    week: 1,
    scoringProfile: "PPR",
    projectedFantasyPoints: points,
    opponent: "MIA",
    homeAway: "home",
    team: "BUF",
    status: "ready",
    note: "Stored weekly projection fixture.",
  };
}

function player(overrides: Partial<ManagerStarterPlayer> & Pick<ManagerStarterPlayer, "player_id" | "name" | "pos">): ManagerStarterPlayer {
  return {
    value: 0,
    seasonValue: 0,
    ...overrides,
  };
}

function baseReport(status: "ready" | "blocked" = "ready"): ReportData {
  const starter = player({
    player_id: "wr1",
    name: "Schedule Receiver",
    pos: "WR",
    value: 5100,
    seasonValue: 5200,
    weeklyProjection: projection(16),
  });

  return {
    weeklyProjectionDiagnostics: {
      status,
      source: "stored-weekly-projection",
      provider: "sleeper",
      season: "2026",
      week: 1,
      scoringProfile: status === "ready" ? "PPR" : null,
      rowCount: status === "ready" ? 1 : 0,
      rosteredCoveragePct: status === "ready" ? 100 : null,
      attachedPlayerCount: status === "ready" ? 1 : 0,
      note: status === "ready" ? "Ready." : "Blocked.",
      warnings: status === "ready" ? [] : ["Projection flags disabled."],
    },
    playerDetailsById: {
      wr1: {
        playerId: "wr1",
        fullName: "Schedule Receiver",
        position: "WR",
        team: "BUF",
        weeklyProjection: projection(16),
        valueProfile: {
          seasonValue: 5200,
          fantasyProsSeasonValue: 5100,
          fantasyCalcRedraft: 5000,
          sources: ["FantasyCalc", "FantasyPros"],
        },
        schedule: {
          byeWeek: 2,
          scheduleTier: "easy",
        },
        usageTrend: {
          season: "2025",
          team: "BUF",
          games: 16,
          targets: 110,
          carries: 0,
          receptions: 72,
          fantasyPointsPpr: 240,
          fantasyPointsPprPerGame: 15,
          avgTargetShare: 0.24,
          avgOffenseSnapPct: 0.82,
          recentTargets: 28,
          recentCarries: 0,
          targetTrend: "up",
          carryTrend: "flat",
          note: "Usage up.",
        },
        playerSituationDelta: {
          playerId: "wr1",
          name: "Schedule Receiver",
          position: "WR",
          score: 70,
          confidence: 80,
          primaryLabel: "role-boost",
          labels: ["role-boost"],
          action: "buy",
          summary: "Role boost.",
          trace: [],
          missingSignals: [],
          cautionFlags: [],
          components: [],
          freshness: { grade: "fresh", score: 80, signals: [], note: "Fresh." },
          dynamicSignals: [],
        },
      } as any,
    },
    managerPositionCounts: [
      {
        manager: "Tester",
        QB: 0,
        QB_starters: 0,
        RB: 0,
        RB_starters: 0,
        WR: 1,
        WR_starters: 1,
        TE: 0,
        TE_starters: 0,
        starterPlayers: [starter],
        lineupPlayers: [starter],
        rosterPlayers: [starter],
        starterGroups: [{ key: "WR", label: "WR", count: 1, players: [starter] }],
      },
    ],
    managerRosterValueGrowth: [],
    weeklyRisers: [],
    weeklyFallers: [],
    leagueOverview: [],
    projectedRisers: [],
    projectedFallers: [],
    tradeProfitLeaderboard: [],
    tradeHistory: [],
    positionDepth: [],
    recentTransactions: [],
  } as ReportData;
}

describe("buildRedraftValuation", () => {
  it("blends current-season value with ready projection, SOS, bye, and role context", () => {
    const result = buildRedraftValuation(baseReport("ready"), {
      generatedAt: "2026-06-04T00:00:00.000Z",
      currentWeek: 1,
    });

    expect(result.status).toBe("ready");
    expect(result.projectionStatus).toBe("ready");
    expect(result.rows[0]).toMatchObject({
      playerId: "wr1",
      name: "Schedule Receiver",
      baseValue: 5200,
      projectionValue: 6880,
      restOfSeasonProjectionPoints: 256,
      restOfSeasonValue: 6656,
      restOfSeasonWeeks: 16,
      scheduleAdjustment: 325,
      byeAdjustment: -275,
      roleAdjustment: 440,
      finalValue: 6422,
      valueDelta: 1222,
      confidenceCapReason: null,
      status: "ready",
    });
    expect(result.rows[0].components.map(component => component.key)).toEqual([
      "base-value",
      "weekly-projection",
      "rest-of-season-projection",
      "schedule-sos",
      "bye-context",
      "role-trend",
    ]);
    expect(result.rows[0].confidenceReasons).toEqual(expect.arrayContaining([
      "Ready weekly projection is blended into the redraft value.",
      "Derived rest-of-season projection value is available.",
    ]));
  });

  it("adds injury/news and replacement-level context when projection readiness passes", () => {
    const report = baseReport("ready");
    const details = report.playerDetailsById?.wr1 as any;
    details.injuryStatus = "Questionable";
    const replacement = player({
      player_id: "wire-wr",
      name: "Wire Receiver",
      pos: "WR",
      value: 5000,
      seasonValue: 5000,
    });
    report.waiverIntelligence = {
      rosteredTrendingAdds: [],
      availableTrendingAdds: [replacement],
      highestKtcAvailable: replacement,
      bestAvailableByPosition: { WR: replacement },
      bestTaxiStashes: [],
      recentlyDroppedValuable: [],
      omittedCandidates: [],
    } as any;

    const result = buildRedraftValuation(report, {
      currentWeek: 1,
    });
    const row = result.rows.find(item => item.playerId === "wr1");

    expect(row).toMatchObject({
      injuryAdjustment: -325,
      replacementAdjustment: -375,
      restOfSeasonValue: 6656,
      finalValue: 5722,
      valueDelta: 522,
      status: "ready",
    });
    expect(row?.components.map(component => component.key)).toEqual([
      "base-value",
      "weekly-projection",
      "rest-of-season-projection",
      "schedule-sos",
      "bye-context",
      "role-trend",
      "injury-news",
      "replacement-level",
    ]);
  });

  it("uses stored FantasyPros player-points history to calibrate redraft valuation confidence", () => {
    const report = baseReport("ready");
    const details = report.playerDetailsById?.wr1 as any;
    details.valueProfile.fantasyProsSourceTrace = [{
      source: "FantasyPros",
      key: "PLAYER_POINTS",
      label: "Stored player points",
      value: 15.2,
      evidence: "season points 258.4; average 15.2; games 17; endpoint metadata: fantasypros-player-points.",
    }];

    const result = buildRedraftValuation(report, {
      currentWeek: 1,
    });
    const row = result.rows.find(item => item.playerId === "wr1");

    expect(row).toMatchObject({
      playerPointsAdjustment: 120,
      finalValue: 6542,
      valueDelta: 1342,
      status: "ready",
    });
    expect(row?.components.map(component => component.key)).toEqual([
      "base-value",
      "weekly-projection",
      "rest-of-season-projection",
      "schedule-sos",
      "bye-context",
      "role-trend",
      "player-points-history",
    ]);
    expect(row?.confidenceReasons).toContain("Stored player-points history calibrated the value.");
  });

  it("uses stored FantasyPros injury traces as backend availability risk evidence", () => {
    const report = baseReport("ready");
    const details = report.playerDetailsById?.wr1 as any;
    details.valueProfile.fantasyProsSourceTrace = [{
      source: "FantasyPros",
      key: "INJURIES",
      label: "Stored injuries",
      status: "Questionable",
      evidence: "status Questionable; injury Hamstring; practice Limited; endpoint metadata: fantasypros-injuries.",
    }];

    const result = buildRedraftValuation(report, {
      currentWeek: 1,
    });
    const row = result.rows.find(item => item.playerId === "wr1");

    expect(row).toMatchObject({
      injuryAdjustment: -325,
      finalValue: 6097,
      valueDelta: 897,
      status: "ready",
    });
    expect(row?.components.find(component => component.key === "injury-news")).toMatchObject({
      value: -325,
      note: "Availability/news adjustment from Stored injury/practice snapshot flags a questionable or limited-practice risk.",
    });
    expect(row?.confidenceReasons).toContain("Injury/news context adjusted the value.");
  });

  it("fails closed to existing current-season value when projections are blocked", () => {
    const result = buildRedraftValuation(baseReport("blocked"), {
      currentWeek: 1,
    });

    expect(result.status).toBe("value-only");
    expect(result.projectionStatus).toBe("blocked");
    expect(result.rows[0]).toMatchObject({
      baseValue: 5200,
      projectionValue: null,
      restOfSeasonProjectionPoints: null,
      restOfSeasonValue: null,
      restOfSeasonWeeks: null,
      scheduleAdjustment: 0,
      byeAdjustment: 0,
      roleAdjustment: 0,
      injuryAdjustment: 0,
      replacementAdjustment: 0,
      finalValue: 5200,
      valueDelta: 0,
      confidenceCapReason: "Weekly projection readiness failed; projection, schedule, role, injury/news, and replacement adjustments are disabled.",
      status: "value-only",
    });
    expect(result.rows[0].components.map(component => component.key)).toEqual(["base-value"]);
  });
});
