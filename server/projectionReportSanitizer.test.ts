import { describe, expect, it } from "vitest";
import { stripWeeklyProjectionContextFromReportData } from "./routers";

const projection = {
  source: "stored-weekly-projection",
  provider: "sleeper",
  season: "2026",
  week: 1,
  scoringProfile: "PPR",
  projectedFantasyPoints: 12.4,
  status: "ready",
  note: "Stored weekly projection fixture.",
};

describe("projection report sanitizer", () => {
  it("strips waiver priority projection context and projection-backed matchup claims", () => {
    const sanitized = stripWeeklyProjectionContextFromReportData({
      leagueDiagnostics: {
        currentSeason: "2026",
        currentWeek: 1,
      },
      weeklyProjectionDiagnostics: {
        status: "ready",
        source: "stored-weekly-projection",
        provider: "sleeper",
        season: "2026",
        week: 1,
        scoringProfile: "PPR",
        rowCount: 1,
        rosteredCoveragePct: 100,
        attachedPlayerCount: 1,
        note: "Ready.",
        warnings: [],
      },
      playerDetailsById: {
        wr1: { id: "wr1", name: "Projection Receiver", weeklyProjection: projection },
      },
      managerPositionCounts: [],
      lineupStrength: null,
      redraftValuation: null,
      playoffSchedulePlanning: {
        source: "NFL.com 2026 bye weeks + Sleeper league data + DraftSharks SOS",
        status: "ready",
        updatedAt: "2026-06-01T00:00:00.000Z",
        weeks: [15, 16, 17],
        managerPlans: [{
          manager: "A",
          riskScore: 2,
          upsideScore: 1,
          weeks: [{
            week: 15,
            projectedStarterPoints: 112.4,
            projectionCoverage: {
              coveredPlayerCount: 8,
              totalPlayerCount: 9,
              mode: "stored-weekly-projection-blend",
            },
            byePlayers: [],
            avoidPlayers: [],
            streamerPlayers: [],
            note: "A has stored weekly projection context.",
          }],
          priorityAdds: [],
          note: "A should cover playoff risk.",
        }],
      },
      matchupPreviews: [
        { source: "Submitted lineup + stored weekly projection blend", teams: [] },
        { source: "Schedule/value model", teams: [] },
      ],
      waiverIntelligence: {
        rosteredTrendingAdds: [{ player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: "A", weeklyProjection: projection }],
        availableTrendingAdds: [{ player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: null, weeklyProjection: projection }],
        highestKtcAvailable: { player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: null, weeklyProjection: projection },
        bestAvailableByPosition: {
          QB: null,
          RB: null,
          WR: { player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: null, weeklyProjection: projection },
          TE: null,
          K: null,
          DEF: null,
        },
        bestTaxiStashes: [{ player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: null, weeklyProjection: projection }],
        recentlyDroppedValuable: [{ player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: null, weeklyProjection: projection }],
        priorityWaiverTargets: [{
          player: { player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: null, weeklyProjection: projection },
          score: 1400,
          priority: "add-now",
          reasons: ["12.4 stored projected points"],
          scheduleSignal: null,
          weeklyProjection: projection,
        }],
        weeklyEcrTargets: [{
          player: { player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: null, weeklyProjection: projection },
          score: 100,
          signal: null,
        }],
        specialTeamsStreamerTargets: [{
          player: { player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: null, weeklyProjection: projection },
          signal: null,
          weeks: [],
        }],
        defensePairingTargets: [{
          player: { player_id: "wr1", name: "Projection Receiver", pos: "WR", owner: null, weeklyProjection: projection },
          score: 100,
          signal: null,
        }],
        omittedCandidates: [],
      },
    } as any);

    expect(sanitized.weeklyProjectionDiagnostics.status).toBe("blocked");
    expect(sanitized.weeklyProjectionDiagnostics.attachedPlayerCount).toBe(0);
    expect(sanitized.playoffSchedulePlanning?.managerPlans[0]?.weeks[0]).toMatchObject({
      projectedStarterPoints: null,
      projectionCoverage: {
        coveredPlayerCount: 0,
        totalPlayerCount: 9,
        mode: "schedule-value",
      },
    });
    expect(sanitized.matchupPreviews?.map((preview) => preview.source)).toEqual(["Schedule/value model"]);
    expect(JSON.stringify(sanitized.playerDetailsById)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.availableTrendingAdds)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.highestKtcAvailable)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.bestAvailableByPosition)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.bestTaxiStashes)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.recentlyDroppedValuable)).not.toContain("weeklyProjection");
    expect(sanitized.waiverIntelligence?.priorityWaiverTargets?.[0]?.weeklyProjection).toBeNull();
    expect(JSON.stringify(sanitized.waiverIntelligence?.priorityWaiverTargets?.[0]?.player)).not.toContain("weeklyProjection");
  });
});
