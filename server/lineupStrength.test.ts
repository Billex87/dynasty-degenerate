import { describe, expect, it } from "vitest";
import type { ManagerStarterPlayer, ReportData, WeeklyProjectionContext } from "../shared/types";
import { buildLineupStrength } from "./lineupStrength";

function projection(playerId: string, points: number): WeeklyProjectionContext {
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
    updatedAt: "2026-06-04T00:00:00.000Z",
    fetchedAt: "2026-06-04T00:00:00.000Z",
    status: "ready",
    note: `Stored weekly projection for ${playerId}.`,
  };
}

function player(overrides: Partial<ManagerStarterPlayer> & Pick<ManagerStarterPlayer, "player_id" | "name" | "pos">): ManagerStarterPlayer {
  return {
    value: 0,
    seasonValue: 0,
    ...overrides,
  };
}

function reportWithLineups(overrides: Partial<ReportData> = {}): ReportData {
  const alphaQb = player({
    player_id: "alpha-qb",
    name: "Alpha QB",
    pos: "QB",
    value: 7000,
    seasonValue: 7000,
    weeklyProjection: projection("alpha-qb", 24),
  });
  const alphaBenchQb = player({
    player_id: "alpha-bench-qb",
    name: "Alpha Bench QB",
    pos: "QB",
    value: 6900,
    seasonValue: 6900,
    weeklyProjection: projection("alpha-bench-qb", 25),
  });
  const alphaRb = player({
    player_id: "alpha-rb",
    name: "Alpha RB",
    pos: "RB",
    value: 5200,
    seasonValue: 5200,
    weeklyProjection: projection("alpha-rb", 16),
  });
  const betaQb = player({
    player_id: "beta-qb",
    name: "Beta QB",
    pos: "QB",
    value: 6200,
    seasonValue: 6200,
    weeklyProjection: projection("beta-qb", 19),
  });
  const betaRb = player({
    player_id: "beta-rb",
    name: "Beta RB",
    pos: "RB",
    value: 4800,
    seasonValue: 4800,
    weeklyProjection: projection("beta-rb", 14),
  });

  return {
    weeklyProjectionDiagnostics: {
      status: "ready",
      source: "stored-weekly-projection",
      provider: "sleeper",
      season: "2026",
      week: 1,
      scoringProfile: "PPR",
      rowCount: 5,
      rosteredCoveragePct: 100,
      attachedPlayerCount: 5,
      note: "Ready.",
      warnings: [],
    },
    playerDetailsById: {
      "alpha-qb": { playerId: "alpha-qb", fullName: "Alpha QB", position: "QB", schedule: { scheduleTier: "easy" } } as any,
      "alpha-bench-qb": { playerId: "alpha-bench-qb", fullName: "Alpha Bench QB", position: "QB", schedule: { scheduleTier: "elite" } } as any,
      "alpha-rb": { playerId: "alpha-rb", fullName: "Alpha RB", position: "RB", schedule: { scheduleTier: "neutral" } } as any,
      "beta-qb": { playerId: "beta-qb", fullName: "Beta QB", position: "QB", schedule: { scheduleTier: "hard" } } as any,
      "beta-rb": { playerId: "beta-rb", fullName: "Beta RB", position: "RB", schedule: { scheduleTier: "neutral" } } as any,
    },
    managerPositionCounts: [
      {
        manager: "Alpha",
        QB: 2,
        QB_starters: 1,
        RB: 1,
        RB_starters: 1,
        WR: 0,
        WR_starters: 0,
        TE: 0,
        TE_starters: 0,
        starterSource: "Sleeper",
        starterPlayers: [alphaQb, alphaRb],
        lineupPlayers: [alphaQb, alphaBenchQb, alphaRb],
        rosterPlayers: [alphaQb, alphaBenchQb, alphaRb],
        starterGroups: [
          { key: "QB", label: "QB", count: 1, players: [alphaQb] },
          { key: "RB", label: "RB", count: 1, players: [alphaRb] },
        ],
      },
      {
        manager: "Beta",
        QB: 1,
        QB_starters: 1,
        RB: 1,
        RB_starters: 1,
        WR: 0,
        WR_starters: 0,
        TE: 0,
        TE_starters: 0,
        starterSource: "Sleeper",
        starterPlayers: [betaQb, betaRb],
        lineupPlayers: [betaQb, betaRb],
        rosterPlayers: [betaQb, betaRb],
        starterGroups: [
          { key: "QB", label: "QB", count: 1, players: [betaQb] },
          { key: "RB", label: "RB", count: 1, players: [betaRb] },
        ],
      },
    ],
    matchupPreviews: [
      { week: 1, manager: "Alpha", opponentManager: "Beta" },
      { week: 1, manager: "Beta", opponentManager: "Alpha" },
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
    ...overrides,
  } as ReportData;
}

describe("buildLineupStrength", () => {
  it("uses starter value, ready weekly projections, SOS, opponent rows, and bench alternatives", () => {
    const result = buildLineupStrength(reportWithLineups(), {
      generatedAt: "2026-06-04T00:00:00.000Z",
    });

    const alpha = result.rows.find(row => row.manager === "Alpha");
    expect(result.status).toBe("ready");
    expect(result.projectionStatus).toBe("ready");
    expect(result.scheduleStatus).toBe("ready");
    expect(alpha).toMatchObject({
      opponentManager: "Beta",
      projectionPoints: 40,
      projectionScore: 160,
      projectionRange: {
        floorPoints: 34.3,
        ceilingPoints: 45.7,
        spread: 11.4,
        confidence: 72,
        source: "derived-weekly-projection",
      },
      scheduleScore: 8,
      valueScore: 122,
      opponentTotalScore: 234,
      edge: 56,
      projectedWinProbability: {
        probability: 66.8,
        projectionPointEdge: 7,
        confidence: 75,
        confidenceLabel: "medium",
        source: "derived-weekly-projection",
      },
      status: "ready",
    });
    expect(alpha?.benchAlternatives[0]).toMatchObject({
      starter: { name: "Alpha QB" },
      alternative: { name: "Alpha Bench QB" },
      projectionDelta: 1,
      decision: "close-call",
      confidence: 60,
      closeCallReason: "Projection edge is under two points or the composite score edge is thin.",
    });
    expect(alpha?.positionEdges.find(edge => edge.position === "QB")).toMatchObject({
      opponentScore: 130,
      edge: 44,
    });
  });

  it("fails closed to value-only lineup reads when weekly projections are blocked", () => {
    const report = reportWithLineups({
      weeklyProjectionDiagnostics: {
        status: "blocked",
        source: "stored-weekly-projection",
        provider: "sleeper",
        season: "2026",
        week: 1,
        scoringProfile: null,
        rowCount: 0,
        rosteredCoveragePct: null,
        attachedPlayerCount: 0,
        note: "Blocked.",
        warnings: ["Projection flags disabled."],
      },
    });

    const result = buildLineupStrength(report);
    const alpha = result.rows.find(row => row.manager === "Alpha");

    expect(result.status).toBe("value-only");
    expect(result.projectionStatus).toBe("blocked");
    expect(alpha).toMatchObject({
      status: "value-only",
      projectionPoints: null,
      projectionScore: 0,
      projectionRange: null,
      projectedWinProbability: null,
      valueScore: 122,
      confidenceCapReason: "Weekly projection readiness failed, so lineup strength is value/rank first.",
    });
    expect(alpha?.benchAlternatives[0]?.projectionDelta).toBeNull();
    expect(alpha?.benchAlternatives[0]).toMatchObject({
      decision: "close-call",
      confidence: 56,
      closeCallReason: "Projection edge is unavailable, so the positive value/SOS score stays review-only.",
    });
  });

  it("does not emit projection range or win probability when starter projection coverage is partial", () => {
    const report = reportWithLineups();
    const alphaStarter = report.managerPositionCounts?.[0]?.starterPlayers?.find(player => player.player_id === "alpha-rb");
    if (alphaStarter) alphaStarter.weeklyProjection = null;

    const result = buildLineupStrength(report);
    const alpha = result.rows.find(row => row.manager === "Alpha");

    expect(result.status).toBe("ready");
    expect(alpha?.projectionPoints).toBe(24);
    expect(alpha?.projectionRange).toBeNull();
    expect(alpha?.projectedWinProbability).toBeNull();
  });
});
