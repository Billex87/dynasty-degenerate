import { describe, expect, it } from "vitest";
import { evaluateAIEvidence, getAIEvidenceReceiptItems } from "@shared/aiEvidenceEngine";
import { buildAIEvidenceLeagueActivityContext } from "@shared/leagueActivityContext";

describe("ai evidence engine", () => {
  it("blocks prospect-only waiver values from active roster advice", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "dynasty",
      baseScore: 88,
      evidence: ["TE20 rank is attached."],
      signalModes: ["prospect"],
      player: {
        name: "Dallen Bentley",
        position: "TE",
        team: null,
        value: 900,
        sourceCount: 1,
        hasProspectOnlyValue: true,
      },
    });

    expect(read.label).toBe("blocked");
    expect(read.shouldRender).toBe(false);
    expect(read.hardBlockers.join(" ")).toMatch(/Prospect-only value|No active NFL team/i);
  });

  it("penalizes a D/ST pickup with a rough early schedule even when rank is strong", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "stream",
      leagueValueMode: "redraft",
      baseScore: 92,
      evidence: ["DEF4 rank is attached.", "DraftSharks SOS source loaded."],
      signalModes: ["redraft", "schedule"],
      player: {
        name: "Los Angeles Rams",
        position: "DEF",
        team: "LAR",
        value: 5000,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
      },
      schedule: {
        hasScheduleData: true,
        isRoughStart: true,
      },
    });

    expect(read.label).not.toBe("high conviction");
    expect(read.finalScore).toBeLessThanOrEqual(52);
    expect(read.softPenalties.map(penalty => penalty.label).join(" ")).toContain("Rough early");
  });

  it("blocks stale available cards when live transactions already added the player", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "redraft",
      baseScore: 80,
      evidence: ["WR31 rank is attached.", "Current-season value is attached."],
      signalModes: ["redraft", "current"],
      player: {
        name: "Waiver Receiver",
        position: "WR",
        team: "NYJ",
        recentlyAddedBy: "Tester",
        value: 3400,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
      },
    });

    expect(read.label).toBe("blocked");
    expect(read.hardBlockers.join(" ")).toContain("already show Waiver Receiver added by Tester");
  });

  it("blocks redraft pickup reads that only have dynasty evidence", () => {
    const read = evaluateAIEvidence({
      surface: "autopilot",
      action: "pickup",
      leagueValueMode: "redraft",
      baseScore: 74,
      evidence: ["Dynasty TE18 rank is attached."],
      signalModes: ["dynasty", "market"],
      player: {
        name: "Dynasty Stash Tight End",
        position: "TE",
        team: "KC",
        value: 2600,
        sourceCount: 2,
        hasDynastyValue: true,
      },
    });

    expect(read.label).toBe("blocked");
    expect(read.hardBlockers.join(" ")).toContain("Redraft read has no current-season evidence");
  });

  it("caps confidence when sources are stale", () => {
    const read = evaluateAIEvidence({
      surface: "player-detail",
      action: "hold",
      baseScore: 90,
      evidence: ["Value trend is attached.", "Usage trend is attached."],
      sourceTrace: [{
        label: "FantasyPros weekly snapshot",
        status: "stale",
      }],
      player: {
        name: "Source Sensitive Player",
        position: "WR",
        team: "DAL",
        value: 5000,
        sourceCount: 3,
      },
    });

    expect(read.finalScore).toBeLessThanOrEqual(64);
    expect(read.confidenceCapReason).toContain("FantasyPros weekly snapshot");
  });

  it("marks empty readouts insufficient instead of confident", () => {
    const read = evaluateAIEvidence({
      surface: "overview",
      action: "watch",
      baseScore: 95,
      evidence: [],
      missingEvidence: ["No league history returned."],
    });

    expect(read.label).toBe("blocked");
    expect(read.shouldRender).toBe(false);
    expect(read.whyThisFired).toMatch(/No positive evidence|Blocked/i);
  });

  it("uses superflex context before blocking low-source QB pickup advice", () => {
    const superflexRead = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "dynasty",
      leagueContext: {
        teamCount: 12,
        qbFormat: "superflex",
        starterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "SUPER_FLEX"],
        scoringSummary: "PPR",
      },
      baseScore: 66,
      evidence: ["QB34 rank is attached."],
      signalModes: ["dynasty", "market"],
      player: {
        name: "Superflex Quarterback",
        position: "QB",
        team: "LV",
        value: 800,
        sourceCount: 1,
        hasDynastyValue: true,
      },
    });

    const oneQbRead = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "dynasty",
      leagueContext: {
        teamCount: 12,
        qbFormat: "one_qb",
        starterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"],
        scoringSummary: "PPR",
      },
      baseScore: 66,
      evidence: ["QB34 rank is attached."],
      signalModes: ["dynasty", "market"],
      player: {
        name: "One-QB Quarterback",
        position: "QB",
        team: "LV",
        value: 800,
        sourceCount: 1,
        hasDynastyValue: true,
      },
    });

    expect(superflexRead.label).not.toBe("blocked");
    expect(superflexRead.evidence.join(" ")).toContain("Superflex format raises QB scarcity");
    expect(getAIEvidenceReceiptItems(superflexRead).join(" ")).toContain("League format context");
    expect(oneQbRead.label).toBe("blocked");
    expect(oneQbRead.hardBlockers.join(" ")).toContain("Low source count plus low value");
  });

  it("blocks special-teams pickup reads when the league does not start that position", () => {
    const read = evaluateAIEvidence({
      surface: "schedule",
      action: "stream",
      leagueValueMode: "redraft",
      leagueContext: {
        teamCount: 10,
        qbFormat: "one_qb",
        starterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"],
        scoringSummary: "Half-PPR",
      },
      baseScore: 92,
      evidence: ["DEF5 rank is attached.", "Schedule source loaded."],
      signalModes: ["redraft", "schedule"],
      player: {
        name: "Unused Defense",
        position: "DEF",
        team: "BUF",
        value: 2400,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
      },
      schedule: {
        hasScheduleData: true,
      },
    });

    expect(read.label).toBe("blocked");
    expect(read.hardBlockers.join(" ")).toContain("does not start DEF");
  });

  it("adds TE premium context to tight end evidence receipts", () => {
    const read = evaluateAIEvidence({
      surface: "player-detail",
      action: "hold",
      leagueValueMode: "dynasty",
      leagueContext: {
        teamCount: 12,
        qbFormat: "superflex",
        starterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "SUPER_FLEX"],
        receptionScoring: 1,
        tightEndPremium: 0.5,
        scoringSummary: "PPR, TE +0.5/rec",
      },
      baseScore: 64,
      evidence: ["TE9 rank loaded.", "3 value sources returned."],
      signalModes: ["dynasty", "market"],
      player: {
        name: "Premium Tight End",
        position: "TE",
        team: "ARI",
        value: 3800,
        sourceCount: 3,
        hasDynastyValue: true,
      },
    });

    expect(read.evidence.join(" ")).toContain("TE premium scoring adds +0.5/rec context");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("PPR, TE +0.5/rec");
  });

  it("uses active league trade tempo as evidence for trade confidence", () => {
    const read = evaluateAIEvidence({
      surface: "trade",
      action: "trade",
      leagueValueMode: "dynasty",
      baseScore: 70,
      evidence: ["Roster fit returned.", "Value gap is playable."],
      leagueActivity: {
        tradeTempo: "active",
        waiverTempo: "balanced",
        tradeSignalCount: 24,
        waiverSignalCount: 18,
        sampleSize: 42,
      },
      player: {
        name: "Trade browser",
        sourceCount: 3,
        hasDynastyValue: true,
      },
      requiresActiveTeam: false,
      requiresLiveAvailability: false,
    });

    expect(read.evidence.join(" ")).toContain("Active league trade market");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("League activity profile");
  });

  it("caps trade confidence in quiet trade markets", () => {
    const read = evaluateAIEvidence({
      surface: "trade",
      action: "trade",
      leagueValueMode: "dynasty",
      baseScore: 94,
      evidence: ["Roster fit returned.", "Value gap is playable."],
      leagueActivity: {
        tradeTempo: "quiet",
        waiverTempo: "balanced",
        tradeSignalCount: 2,
        waiverSignalCount: 18,
        sampleSize: 20,
      },
      player: {
        name: "Trade browser",
        sourceCount: 3,
        hasDynastyValue: true,
      },
      requiresActiveTeam: false,
      requiresLiveAvailability: false,
    });

    expect(read.finalScore).toBeLessThanOrEqual(72);
    expect(read.confidenceCapReason).toBe("Quiet league trade market");
    expect(read.softPenalties.map(penalty => penalty.label).join(" ")).toContain("Quiet league trade market");
  });

  it("applies stored outcome calibration caps to future matching reads", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "redraft",
      baseScore: 92,
      evidence: ["WR31 current-season rank is attached.", "Roster need is attached."],
      signalModes: ["redraft", "current"],
      player: {
        name: "Outcome Calibrated Receiver",
        position: "WR",
        team: "GB",
        value: 4100,
        sourceCount: 3,
        hasCurrentSeasonValue: true,
      },
      calibrationProfile: {
        globalAdjustment: null,
        adjustments: [{
          key: "surfaceAction:waiver|pickup",
          scope: "surfaceAction",
          group: { surface: "waiver", action: "pickup" },
          eventCount: 14,
          scoredCount: 11,
          pendingCount: 3,
          hitRate: 38,
          scoreAdjustment: -18,
          confidenceCap: 54,
          recommendation: "lower-confidence",
          priority: "warn",
          reason: "Waiver pickup reads have been too hot against resolved outcomes.",
        }],
      },
    });

    expect(read.finalScore).toBeLessThanOrEqual(54);
    expect(read.confidenceCap).toBe(54);
    expect(read.confidenceCapReason).toContain("Calibration memory");
    expect(read.calibrationAdjustment).toMatchObject({
      scope: "surfaceAction",
      scoredCount: 11,
      adjustedFinalScore: read.finalScore,
    });
    expect(read.softPenalties.map(penalty => penalty.label).join(" ")).toContain("too hot");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("Calibration memory");
  });

  it("prefers exact manager calibration over exact league and cohort fallbacks", () => {
    const read = evaluateAIEvidence({
      surface: "trade",
      action: "trade",
      leagueValueMode: "dynasty",
      leagueActivity: {
        sharpnessTier: "sharp",
        sharpnessLabel: "Sharp league",
        sampleSize: 20,
      },
      baseScore: 88,
      evidence: ["Roster fit returned.", "Trade market returned."],
      player: {
        name: "Trade read",
        sourceCount: 3,
        hasDynastyValue: true,
      },
      requiresActiveTeam: false,
      requiresLiveAvailability: false,
      calibrationManager: "Billy",
      calibrationLeagueId: "league-1",
      calibrationManagerArchetype: "Active dealer / Aggressive bidder / Contender buyer",
      calibrationProfile: {
        globalAdjustment: null,
        adjustments: [
          {
            scope: "surfaceActionLeagueSharpness",
            group: { surface: "trade", action: "trade", leagueSharpness: "sharp" },
            scoredCount: 25,
            scoreAdjustment: -4,
            confidenceCap: 72,
            reason: "Sharp trade leagues run a little hot.",
          },
          {
            scope: "surfaceActionLeague",
            group: { surface: "trade", action: "trade", league: "league-1" },
            scoredCount: 12,
            scoreAdjustment: -8,
            confidenceCap: 64,
            reason: "This league has rejected similar trade calls.",
          },
          {
            scope: "surfaceManager",
            group: { surface: "trade", manager: "Billy" },
            scoredCount: 7,
            scoreAdjustment: -14,
            confidenceCap: 51,
            reason: "Billy-specific trade calls have missed.",
          },
        ],
      },
    });

    expect(read.confidenceCap).toBe(51);
    expect(read.calibrationAdjustment).toMatchObject({
      scope: "surfaceManager",
      reason: "Billy-specific trade calls have missed.",
    });
  });

  it("falls back to similar league sharpness calibration when exact history is missing", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "redraft",
      leagueActivity: {
        sharpnessTier: "sleepy",
        sharpnessLabel: "Sleepy league",
        sampleSize: 16,
      },
      baseScore: 82,
      evidence: ["WR44 rank is attached.", "Roster need is attached."],
      signalModes: ["redraft", "current"],
      player: {
        name: "Fallback Receiver",
        position: "WR",
        team: "JAC",
        value: 3200,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
      },
      calibrationProfile: {
        globalAdjustment: null,
        adjustments: [{
          scope: "surfaceActionLeagueSharpness",
          group: { surface: "waiver", action: "pickup", leagueSharpness: "sleepy" },
          scoredCount: 18,
          scoreAdjustment: -10,
          confidenceCap: 60,
          reason: "Sleepy leagues reward patience on non-elite adds.",
        }],
      },
    });

    expect(read.confidenceCap).toBe(60);
    expect(read.calibrationAdjustment).toMatchObject({
      scope: "surfaceActionLeagueSharpness",
      scoredCount: 18,
    });
  });

  it("derives league activity tempo from trade and waiver history", () => {
    const activity = buildAIEvidenceLeagueActivityContext({
      leagueDiagnostics: { teamCount: 12 } as any,
      tradeHistory: Array.from({ length: 28 }, (_, index) => ({ id: `trade-${index}` })) as any,
      recentTransactions: Array.from({ length: 74 }, (_, index) => ({ id: `tx-${index}` })) as any,
      transactionBackfillDiagnostics: {
        checkedLeagueCount: 1,
        seasonCount: 2,
        transactionCount: 160,
        waiverOrFreeAgentCount: 120,
        tradeProposalCount: 0,
        completedTradeCount: 40,
        leagues: [],
        generatedAt: "2026-05-20T00:00:00.000Z",
      },
    });

    expect(activity).toMatchObject({
      tradeTempo: "hyperactive",
      waiverTempo: "hyperactive",
    });
    expect(activity?.evidenceLabel).toContain("trade market");
  });
});
