import { describe, expect, it } from "vitest";
import { applyAnalyzeResponseProjectionPolicy, stripWeeklyProjectionContextFromReportData } from "./routers";

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

function withEnv<T>(overrides: Record<string, string>, callback: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("projection report sanitizer", () => {
  it("strips waiver priority projection context and downgrades projection-backed matchup claims", () => {
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
      redraftValuation: {
        status: "ready",
        source: "stored-redraft-valuation",
        projectionStatus: "ready",
        generatedAt: "2026-06-01T00:00:00.000Z",
        note: "Redraft valuation blends existing current-season value with stored weekly projection and derived rest-of-season projection.",
        rows: [{
          playerId: "wr1",
          name: "Projection Receiver",
          position: "WR",
          team: "BUF",
          owner: "A",
          baseValue: 5200,
          projectionValue: 6880,
          restOfSeasonProjectionPoints: 256,
          restOfSeasonValue: 6656,
          restOfSeasonWeeks: 16,
          scheduleAdjustment: 325,
          byeAdjustment: -275,
          roleAdjustment: 440,
          injuryAdjustment: -325,
          replacementAdjustment: -375,
          finalValue: 5722,
          valueDelta: 522,
          confidence: 88,
          confidenceReasons: ["Derived rest-of-season projection value is available."],
          confidenceCapReason: null,
          status: "ready",
          sourceCount: 7,
          components: [
            { key: "base-value", label: "Current-season value", value: 5200, note: "Existing redraft/season value fallback." },
            { key: "weekly-projection", label: "Weekly projection", value: 6880, note: "Stored weekly projection converted to value scale." },
            { key: "rest-of-season-projection", label: "Rest-of-season projection", value: 6656, note: "Derived rest-of-season projection." },
          ],
          note: "Blended from current-season value, stored weekly projection, derived rest-of-season projection, schedule, bye, role, injury/news, and replacement-level context.",
        }],
      },
      playoffSchedulePlanning: {
        source: "NFL.com 2026 bye weeks + Sleeper league data + DraftSharks SOS",
        status: "ready",
        updatedAt: "2026-06-01T00:00:00.000Z",
        confidence: 82,
        confidenceReasons: ["Fresh schedule, SOS, and projection context support this playoff-week confidence score."],
        weeks: [15, 16, 17],
        actionItems: [{
          id: "a-week-15-cover-risk",
          manager: "A",
          week: 15,
          type: "cover-risk",
          priority: "high",
          score: 250,
          confidence: 82,
          confidenceReasons: ["Projection coverage is partial (8/9); blended with schedule/value fallback."],
          confidenceCapReason: "Projection coverage is partial (8/9); blended with schedule/value fallback.",
          affectedPlayers: [],
          replacementTargets: [],
          note: "A Week 15 uses stored weekly projection blend.",
        }],
        managerPlans: [{
          manager: "A",
          riskScore: 2,
          upsideScore: 1,
          confidence: 82,
          confidenceReasons: ["Projection coverage is partial (8/9); blended with schedule/value fallback."],
          weeks: [{
            week: 15,
            projectedStarterPoints: 112.4,
            projectionCoverage: {
              coveredPlayerCount: 8,
              totalPlayerCount: 9,
              mode: "stored-weekly-projection-blend",
            },
            confidence: 82,
            confidenceReasons: ["Projection coverage is partial (8/9); blended with schedule/value fallback."],
            confidenceCapReason: "Projection coverage is partial (8/9); blended with schedule/value fallback.",
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
        {
          source: "Submitted lineup + stored weekly projection blend",
          mustStarts: [{ player_id: "wr1", name: "Projection Receiver", weeklyProjection: projection }],
          positionEdges: [{
            position: "WR",
            managerProjected: 12.4,
            opponentProjected: 8.1,
            edge: 4.3,
            note: "WR edge from submitted lineup context and stored weekly projections.",
          }],
          projectionCoverage: {
            managerCoveredPlayerCount: 1,
            managerTotalPlayerCount: 2,
            opponentCoveredPlayerCount: 1,
            opponentTotalPlayerCount: 2,
            mode: "stored-weekly-projection-blend",
          },
          confidence: 76,
          confidenceReasons: ["Stored weekly projection coverage is partial; remaining starters use schedule/value fallback."],
          teams: [],
        },
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
          reasons: ["12.4 stored projected points", "2 favorable upcoming schedule weeks"],
          scheduleSignal: null,
          weeklyProjection: projection,
          confidence: 88,
          confidenceReasons: ["Ready stored weekly projection is attached.", "Source-backed schedule window is attached."],
          confidenceCapReason: null,
          opportunityWindow: {
            type: "projected-usage",
            label: "Projected usage",
            weeks: [1],
            score: 124,
            easyWeeks: 0,
            hardWeeks: 0,
            playableWeeks: 1,
            confidence: 83,
            source: "stored-weekly-projection",
            note: "Stored weekly projection usage window.",
          },
          opportunityWindows: [
            {
              type: "projected-usage",
              label: "Projected usage",
              weeks: [1],
              score: 124,
              easyWeeks: 0,
              hardWeeks: 0,
              playableWeeks: 1,
              confidence: 83,
              source: "stored-weekly-projection",
              note: "Stored weekly projection usage window.",
            },
            {
              type: "upcoming-schedule",
              label: "Upcoming schedule",
              weeks: [1, 2, 3],
              score: 180,
              easyWeeks: 2,
              hardWeeks: 0,
              playableWeeks: 2,
              confidence: 70,
              source: "DraftSharks",
              note: "Short-term matchup window remains usable.",
            },
          ],
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
      confidence: 58,
      confidenceCapReason: "Weekly projections are disabled for this response; playoff planning confidence is capped to schedule/value context.",
    });
    expect(sanitized.playoffSchedulePlanning?.confidence).toBe(58);
    expect(sanitized.playoffSchedulePlanning?.managerPlans[0]?.confidence).toBe(58);
    expect(sanitized.playoffSchedulePlanning?.actionItems?.[0]).toMatchObject({
      confidence: 58,
      confidenceCapReason: "Weekly projections are disabled for this response; playoff planning confidence is capped to schedule/value context.",
      note: "Review this playoff action with schedule/value context because weekly projections are disabled for this response.",
    });
    expect(sanitized.redraftValuation?.rows[0]).toMatchObject({
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
      confidence: 56,
      confidenceCapReason: "Weekly projection readiness failed; projection, schedule, role, injury/news, and replacement adjustments are disabled.",
      status: "value-only",
    });
    expect(sanitized.redraftValuation?.rows[0]?.components.map((component) => component.key)).toEqual(["base-value"]);
    expect(sanitized.matchupPreviews?.map((preview) => preview.source)).toEqual([
      "Sleeper + Dynasty Degenerates schedule model",
      "Schedule/value model",
    ]);
    expect(sanitized.matchupPreviews?.[0]?.projectionCoverage).toMatchObject({
      managerCoveredPlayerCount: 0,
      opponentCoveredPlayerCount: 0,
      mode: "schedule-value",
    });
    expect(sanitized.matchupPreviews?.[0]?.confidence).toBe(58);
    expect(sanitized.matchupPreviews?.[0]?.confidenceCapReason).toMatch(/projection context is disabled/i);
    expect(sanitized.matchupPreviews?.[0]?.mustStarts?.[0]).not.toHaveProperty("weeklyProjection");
    expect(sanitized.matchupPreviews?.[0]?.positionEdges?.[0]?.note).not.toContain("stored weekly projection");
    expect(JSON.stringify(sanitized.playerDetailsById)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.playoffSchedulePlanning)).not.toContain("stored weekly projection blend");
    expect(JSON.stringify(sanitized.waiverIntelligence?.availableTrendingAdds)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.highestKtcAvailable)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.bestAvailableByPosition)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.bestTaxiStashes)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.recentlyDroppedValuable)).not.toContain("weeklyProjection");
    expect(sanitized.waiverIntelligence?.priorityWaiverTargets?.[0]?.weeklyProjection).toBeNull();
    expect(sanitized.waiverIntelligence?.priorityWaiverTargets?.[0]?.confidence).toBe(58);
    expect(sanitized.waiverIntelligence?.priorityWaiverTargets?.[0]?.confidenceCapReason).toMatch(/weekly projections are disabled/i);
    expect(sanitized.waiverIntelligence?.priorityWaiverTargets?.[0]?.opportunityWindow?.type).toBe("upcoming-schedule");
    expect(sanitized.waiverIntelligence?.priorityWaiverTargets?.[0]?.opportunityWindows?.some((window) => window.type === "projected-usage")).toBe(false);
    expect(JSON.stringify(sanitized.waiverIntelligence?.priorityWaiverTargets?.[0]?.player)).not.toContain("weeklyProjection");
    expect(JSON.stringify(sanitized.waiverIntelligence?.priorityWaiverTargets?.[0])).not.toContain("stored-weekly-projection");
  });

  it("applies projection-off policy to fresh analyze response payloads", () => {
    const sanitized = withEnv({
      ENABLE_PROJECTION_FEATURES: "false",
      ENABLE_SLEEPER_PROJECTIONS: "false",
      ENABLE_WEEKLY_PROJECTIONS: "false",
      DISABLE_PROJECTION_FEATURES: "false",
      DISABLE_PROJECTION_SNAPSHOTS: "false",
      DISABLE_PROJECTION_READOUTS: "false",
      DISABLE_PROJECTION_JOINS: "false",
    }, () => applyAnalyzeResponseProjectionPolicy({
      reportData: {
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
          rowCount: 492,
          rosteredCoveragePct: 100,
          attachedPlayerCount: 120,
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
      },
    } as any));

    expect(sanitized.reportData.weeklyProjectionDiagnostics.status).toBe("blocked");
    expect(sanitized.reportData.weeklyProjectionDiagnostics.rowCount).toBe(0);
    expect(sanitized.reportData.playoffSchedulePlanning.managerPlans[0].weeks[0]).toMatchObject({
      projectedStarterPoints: null,
      projectionCoverage: {
        coveredPlayerCount: 0,
        totalPlayerCount: 9,
        mode: "schedule-value",
      },
    });
    expect(sanitized.reportData.matchupPreviews.map((preview: any) => preview.source)).toEqual([
      "Sleeper + Dynasty Degenerates schedule model",
      "Schedule/value model",
    ]);
    expect(JSON.stringify(sanitized.reportData.playerDetailsById)).not.toContain("weeklyProjection");
  });
});
