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

  it("blocks start advice when the player is already starting", () => {
    const read = evaluateAIEvidence({
      surface: "player-detail",
      action: "start",
      leagueValueMode: "redraft",
      baseScore: 82,
      evidence: ["WR24 current-season rank is attached."],
      signalModes: ["redraft", "current"],
      player: {
        name: "Already Starter",
        position: "WR",
        team: "DET",
        value: 4200,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
        isStarter: true,
      },
      requiresCurrentSeasonEvidence: true,
    });

    expect(read.label).toBe("blocked");
    expect(read.hardBlockers.join(" ")).toContain("Already Starter is already in the starting lineup");
  });

  it("blocks start and stream advice during bye weeks", () => {
    const read = evaluateAIEvidence({
      surface: "schedule",
      action: "stream",
      leagueValueMode: "redraft",
      baseScore: 76,
      evidence: ["DEF8 schedule rank is attached."],
      signalModes: ["redraft", "current", "schedule"],
      player: {
        name: "Bye Week Defense",
        position: "DEF",
        team: "DAL",
        value: 1900,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
        weeklyProjectionStatus: "bye",
      },
      schedule: {
        hasScheduleData: true,
      },
    });

    expect(read.label).toBe("blocked");
    expect(read.hardBlockers.join(" ")).toContain("Bye Week Defense is on bye");
  });

  it("caps start/sit reads without projection or matchup proof", () => {
    const read = evaluateAIEvidence({
      surface: "player-detail",
      action: "start",
      leagueValueMode: "redraft",
      baseScore: 94,
      evidence: ["WR18 current-season rank is attached.", "Roster need is attached."],
      signalModes: ["redraft", "current"],
      player: {
        name: "Projectionless Receiver",
        position: "WR",
        team: "MIN",
        value: 5300,
        sourceCount: 3,
        hasCurrentSeasonValue: true,
      },
      requiresCurrentSeasonEvidence: true,
    });

    expect(read.canAct).toBe(false);
    expect(read.finalScore).toBeLessThanOrEqual(56);
    expect(read.confidenceCapReason).toBe("Missing start/sit projection or matchup proof");
    expect(read.missingEvidence).toContain("No projection or matchup proof returned for this start/sit read.");
    expect(read.softPenalties.map(penalty => penalty.label)).toContain("Missing projection or matchup proof caps start/sit confidence");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("Confidence cap: 56% from Missing start/sit projection or matchup proof");
  });

  it("blocks immediate add/start actions for unavailable players", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "redraft",
      baseScore: 84,
      evidence: ["RB35 current-season rank is attached."],
      signalModes: ["redraft", "current"],
      player: {
        name: "Unavailable Runner",
        position: "RB",
        team: "SEA",
        value: 3500,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
        injuryStatus: "Out",
      },
    });

    expect(read.label).toBe("blocked");
    expect(read.hardBlockers.join(" ")).toContain("Unavailable Runner is unavailable (Out)");
  });

  it("caps start advice for unresolved availability tags", () => {
    const read = evaluateAIEvidence({
      surface: "player-detail",
      action: "start",
      leagueValueMode: "redraft",
      baseScore: 94,
      evidence: ["WR18 current-season rank is attached.", "Latest projection is attached."],
      signalModes: ["redraft", "current"],
      player: {
        name: "Questionable Receiver",
        position: "WR",
        team: "MIN",
        value: 5300,
        sourceCount: 3,
        hasCurrentSeasonValue: true,
        weeklyProjectionStatus: "projected",
        injuryStatus: "Questionable",
      },
      requiresCurrentSeasonEvidence: true,
    });

    expect(read.label).not.toBe("blocked");
    expect(read.finalScore).toBeLessThanOrEqual(58);
    expect(read.softPenalties.map(penalty => penalty.label).join(" ")).toContain("unresolved availability tag");
    expect(read.confidenceCapReason).toBe("Unresolved player availability");
  });

  it("blocks lineup changes when the game is already locked", () => {
    const read = evaluateAIEvidence({
      surface: "player-detail",
      action: "sit",
      leagueValueMode: "redraft",
      baseScore: 72,
      evidence: ["Bench alternative is attached."],
      signalModes: ["redraft", "current"],
      player: {
        name: "Locked Starter",
        position: "RB",
        team: "PHI",
        value: 5100,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
        isGameLocked: true,
      },
      requiresCurrentSeasonEvidence: true,
    });

    expect(read.label).toBe("blocked");
    expect(read.hardBlockers.join(" ")).toContain("Locked Starter cannot be changed because the game is already locked");
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

  it("caps dynasty action reads that only have redraft evidence", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "dynasty",
      baseScore: 94,
      evidence: ["WR31 current-season rank is attached.", "Roster need is attached."],
      sourceTrace: [{
        label: "FantasyPros redraft waiver snapshot",
        status: "loaded",
      }, {
        label: "Sleeper trend snapshot",
        status: "loaded",
      }],
      signalModes: ["redraft", "current"],
      player: {
        name: "Redraft Only Receiver",
        position: "WR",
        team: "SEA",
        value: 4200,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
      },
    });

    expect(read.canAct).toBe(false);
    expect(read.finalScore).toBeLessThanOrEqual(56);
    expect(read.confidenceCapReason).toBe("Missing dynasty/market evidence");
    expect(read.missingEvidence).toContain("No dynasty or market evidence returned for this dynasty action read.");
    expect(read.softPenalties.map(penalty => penalty.label)).toContain("Missing dynasty/market evidence caps dynasty action confidence");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("Confidence cap: 56% from Missing dynasty/market evidence");
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

  it("caps stale source action reads below actionable confidence", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "redraft",
      baseScore: 96,
      evidence: ["WR28 current-season rank is attached.", "Roster need is attached."],
      signalModes: ["redraft", "current"],
      sourceTrace: [{
        label: "FantasyPros waiver snapshot",
        status: "stale",
        ageHours: 190,
      }],
      player: {
        name: "Stale Source Receiver",
        position: "WR",
        team: "HOU",
        value: 5200,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
      },
    });

    expect(read.canAct).toBe(false);
    expect(read.finalScore).toBeLessThanOrEqual(55);
    expect(read.confidenceCapReason).toBe("FantasyPros waiver snapshot source freshness");
    expect(read.missingEvidence).toContain("Fresh source proof is stale or unhealthy for this action read.");
    expect(read.softPenalties.map(penalty => penalty.label)).toContain("FantasyPros waiver snapshot is stale or unhealthy");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("Confidence cap: 55% from FantasyPros waiver snapshot source freshness");
  });

  it("caps player action reads without source count or source trace", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "redraft",
      baseScore: 96,
      evidence: ["WR18 rank is attached.", "Roster need is attached."],
      signalModes: ["redraft", "current"],
      player: {
        name: "Untraced Receiver",
        position: "WR",
        team: "DET",
        value: 6800,
        sourceCount: 0,
        hasCurrentSeasonValue: true,
      },
    });

    expect(read.canAct).toBe(false);
    expect(read.finalScore).toBeLessThanOrEqual(54);
    expect(read.confidenceCapReason).toBe("Missing player source trace");
    expect(read.missingEvidence).toContain("No player source trace returned for this read.");
    expect(read.softPenalties.map(penalty => penalty.label)).toContain("Missing player source trace caps action confidence");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("Confidence cap: 54% from Missing player source trace");
  });

  it("caps non-schedule player action reads with only one source", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "redraft",
      baseScore: 96,
      evidence: ["WR22 current-season rank is attached.", "Roster need is attached."],
      sourceTrace: [{
        label: "FantasyPros waiver snapshot",
        status: "loaded",
      }],
      signalModes: ["redraft", "current"],
      player: {
        name: "Single Source Receiver",
        position: "WR",
        team: "LAC",
        value: 6900,
        sourceCount: 1,
        hasCurrentSeasonValue: true,
      },
    });

    expect(read.canAct).toBe(false);
    expect(read.finalScore).toBeLessThanOrEqual(57);
    expect(read.confidenceCapReason).toBe("Thin player source count");
    expect(read.missingEvidence).toContain("Only one player source returned for this action read.");
    expect(read.softPenalties.map(penalty => penalty.label)).toContain("Thin player source count caps action confidence");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("Confidence cap: 57% from Thin player source count");
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

  it("caps trade action reads without league trade or manager-history samples", () => {
    const read = evaluateAIEvidence({
      surface: "trade",
      action: "trade",
      leagueValueMode: "dynasty",
      baseScore: 94,
      evidence: ["Roster fit returned.", "Value gap is playable."],
      player: {
        name: "Trade browser",
        sourceCount: 3,
        hasDynastyValue: true,
      },
      requiresActiveTeam: false,
      requiresLiveAvailability: false,
    });

    expect(read.canAct).toBe(false);
    expect(read.finalScore).toBeLessThanOrEqual(57);
    expect(read.confidenceCapReason).toBe("Missing trade/manager history");
    expect(read.missingEvidence).toContain("No league trade or manager-history sample returned.");
    expect(read.softPenalties.map(penalty => penalty.label)).toContain("Missing trade/manager history caps trade-action confidence");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("Confidence cap: 57% from Missing trade/manager history");
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

  it("caps action reads when matching outcome calibration has too few resolved samples", () => {
    const read = evaluateAIEvidence({
      surface: "waiver",
      action: "pickup",
      leagueValueMode: "redraft",
      baseScore: 92,
      evidence: ["WR33 current-season rank is attached.", "Roster need is attached."],
      sourceTrace: [{
        label: "FantasyPros waiver snapshot",
        status: "loaded",
      }, {
        label: "Sleeper availability snapshot",
        status: "loaded",
      }],
      signalModes: ["redraft", "current"],
      player: {
        name: "Low Sample Receiver",
        position: "WR",
        team: "LV",
        value: 4300,
        sourceCount: 2,
        hasCurrentSeasonValue: true,
      },
      calibrationProfile: {
        globalAdjustment: null,
        adjustments: [{
          key: "surfaceAction:waiver|pickup",
          scope: "surfaceAction",
          group: { surface: "waiver", action: "pickup" },
          eventCount: 9,
          scoredCount: 2,
          pendingCount: 7,
          hitRate: 100,
          scoreAdjustment: 12,
          confidenceCap: null,
          recommendation: "raise-confidence",
          priority: "info",
          reason: "Early pickup calls have hit, but most outcomes are still pending.",
        }],
      },
    });

    expect(read.canAct).toBe(false);
    expect(read.finalScore).toBeLessThanOrEqual(56);
    expect(read.confidenceCapReason).toBe("Insufficient resolved outcomes");
    expect(read.missingEvidence).toContain("Too few resolved outcomes returned for this action read's calibration bucket.");
    expect(read.softPenalties.map(penalty => penalty.label)).toContain("Insufficient resolved outcomes cap action confidence");
    expect(getAIEvidenceReceiptItems(read).join(" ")).toContain("Confidence cap: 56% from Insufficient resolved outcomes");
    expect(read.calibrationAdjustment).toMatchObject({
      scope: "surfaceAction",
      scoredCount: 2,
    });
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
