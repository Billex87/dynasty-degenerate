import { describe, expect, it } from "vitest";
import { createCachedCommandCenterReport } from "../../../tests/e2e/fixtures/cachedReports";
import {
  __testing,
  buildAIPredictionEventsForReport,
  buildClientSourceAgreementRead,
  getAIPredictionEventBatchSignature,
} from "./aiPredictionEvents";

describe("AI prediction event builder", () => {
  it("builds compact calibration events for core AI surfaces", () => {
    const reportData = createCachedCommandCenterReport().reportData;
    const events = buildAIPredictionEventsForReport({
      reportData,
      leagueId: "13000000000000",
      leagueName: "Test League",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    expect(events.length).toBeGreaterThan(0);
    expect(new Set(events.map(event => event.eventId)).size).toBe(events.length);
    expect(events.map(event => event.surface)).toEqual(expect.arrayContaining([
      "autopilot",
      "waiver",
      "trade",
    ]));
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      leagueId: "13000000000000",
      outcome: { status: expect.any(String) },
      decisionSnapshot: {
        schemaVersion: 1,
        baseline: expect.any(Object),
        facts: expect.any(Array),
      },
      counterfactual: {
        status: expect.any(String),
        baseline: expect.any(Object),
      },
      sourceAgreement: {
        state: expect.any(String),
        sourceCount: expect.any(Number),
        reason: expect.any(String),
      },
      decay: {
        expiresAt: expect.any(String),
        decayWindowHours: expect.any(Number),
      },
      metadata: {
        gradingWindow: {
          schemaVersion: 1,
          kind: expect.any(String),
          expiresAt: expect.any(String),
          evidenceRequired: expect.any(Array),
        },
      },
    });
    expect(events[0].outcome.baselineValue).toBe(events[0].counterfactual?.baseline.score ?? null);
    expect(getAIPredictionEventBatchSignature(events)).toContain(events[0].eventId);
  });

  it("does not keep do decisions when the counterfactual baseline is not beaten", () => {
    const reportData = createCachedCommandCenterReport().reportData;
    const events = buildAIPredictionEventsForReport({
      reportData,
      leagueId: "13000000000000",
      createdAt: "2026-09-01T00:00:00.000Z",
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events.every(event =>
      event.decision !== "do" || event.counterfactual?.status === "beats-baseline"
    )).toBe(true);
  });

  it("captures redraft season grading windows for season-level recommendations", () => {
    const event = __testing.buildEvent({
      reportRunKey: "test-report-run",
      createdAt: "2026-09-01T00:00:00.000Z",
      valueMode: "redraft",
      leagueId: "13000000000000",
      season: "2026",
      week: 1,
      surface: "overview",
      action: "watch",
      decision: "watch",
      entityType: "manager",
      entityId: "manager-redraft",
      entityName: "Redraft Manager",
      finalScore: 64,
      evidence: ["Roster-construction read emitted for the redraft season."],
      sourceTrace: [{
        label: "League diagnostics",
        status: "loaded",
      }],
      metadata: {
        recommendationType: "roster construction",
        actionText: "Redraft season roster construction can only grade after standings and title outcome.",
      },
    });

    expect(event.metadata?.gradingWindow).toMatchObject({
      schemaVersion: 1,
      kind: "redraft-season",
      label: "Redraft season recommendation",
      minimumFinalGradeAt: "2027-01-15T12:00:00.000Z",
      expiresAt: "2027-01-15T12:00:00.000Z",
      evidenceRequired: expect.arrayContaining([
        "final standings",
        "playoff finish",
        "points for",
        "roster usage",
        "title outcome",
      ]),
    });
  });

  it("captures two-year grading windows for dynasty draft recommendations", () => {
    const event = __testing.buildEvent({
      reportRunKey: "test-report-run",
      createdAt: "2026-05-15T00:00:00.000Z",
      valueMode: "dynasty",
      leagueId: "13000000000000",
      season: "2026",
      surface: "rankings",
      action: "watch",
      decision: "watch",
      entityType: "player",
      entityId: "rookie-pick-player",
      entityName: "Rookie Pick Player",
      finalScore: 66,
      evidence: ["Dynasty rookie draft recommendation emitted."],
      sourceTrace: [{
        label: "Draft-cost snapshot",
        status: "loaded",
      }],
      metadata: {
        recommendationType: "rookie draft pick",
        actionText: "Dynasty rookie draft recommendation",
        draftKind: "rookie draft",
      },
    });

    expect(event.metadata?.gradingWindow).toMatchObject({
      schemaVersion: 1,
      kind: "dynasty-draft-two-year",
      label: "Dynasty draft recommendation",
      minimumFinalGradeAt: "2028-01-15T12:00:00.000Z",
      expiresAt: "2028-01-15T12:00:00.000Z",
      evidenceRequired: expect.arrayContaining([
        "two-year player value movement",
        "two-year roster usage",
        "starter or trade-value outcome",
      ]),
    });
  });

  it("stores player-detail archetype reads for outcome calibration", () => {
    const events = buildAIPredictionEventsForReport({
      leagueId: "13000000000000",
      createdAt: "2026-09-01T00:00:00.000Z",
      reportData: {
        leagueDiagnostics: {
          currentSeason: "2026",
          currentWeek: 1,
          valueMode: "dynasty",
        },
        playerDetailsById: {
          p1: {
            playerId: "p1",
            fullName: "Vacated Volume",
            position: "WR",
            team: "BUF",
            valueProfile: {
              dynastyValue: 5200,
              dynastyPositionRank: "WR18",
            },
            playerSituationDelta: {
              playerId: "p1",
              name: "Vacated Volume",
              position: "WR",
              score: 82,
              confidence: 80,
              primaryLabel: "vacated-opportunity",
              labels: ["vacated-opportunity"],
              action: "buy",
              summary: "Targets opened up in this room.",
              trace: ["Vacated opportunity opened a role."],
              missingSignals: [],
              cautionFlags: [],
              components: [],
              freshness: {
                grade: "fresh",
                score: 90,
                signals: ["fresh roster room"],
                note: "Fresh role signal.",
              },
              dynamicSignals: [],
            },
          },
        },
      } as any,
    });

    const playerDetailEvent = events.find(event => event.surface === "player-detail");
    expect(playerDetailEvent).toMatchObject({
      action: "start",
      entityId: "p1",
      entityName: "Vacated Volume",
      metadata: {
        source: "player-detail-archetype",
        valueMode: "dynasty",
        valueProfileKey: "12_sf_ppr_base",
        archetypeKey: "volume-spike",
        archetypeLabel: "Volume spike",
      },
      decisionSnapshot: {
        facts: expect.arrayContaining([
          expect.objectContaining({ key: "archetype", value: "Volume spike" }),
        ]),
      },
    });
  });

  it("classifies actionable schedule support reads from evidence instead of display copy", () => {
    const events = buildAIPredictionEventsForReport({
      leagueId: "13000000000000",
      createdAt: "2026-09-01T00:00:00.000Z",
      reportData: {
        leagueDiagnostics: {
          currentSeason: "2026",
          currentWeek: 2,
          valueMode: "dynasty",
        },
        leagueValueMode: "dynasty",
        managerPositionCounts: [
          {
            manager: "Roster Manager",
            QB: 0,
            QB_starters: 0,
            RB: 0,
            RB_starters: 0,
            WR: 1,
            WR_starters: 1,
            TE: 0,
            TE_starters: 0,
            K: 0,
            K_starters: 0,
            DEF: 0,
            DEF_starters: 0,
            rosterPlayers: [
              {
                player_id: "other-wr",
                name: "Other Receiver",
                pos: "WR",
                playerDetails: { team: "NYG" },
              },
            ],
            lineupPlayers: [],
            starterPlayers: [],
          },
        ],
        scheduleEdgeTargets: [
          {
            score: 96,
            player: {
              player_id: "schedule-wr",
              name: "Schedule Receiver",
              pos: "WR",
              team: "BUF",
              owner: null,
              ktcValue: 5200,
              currentPositionRank: "WR18",
            },
            signal: {
              signalType: "draftsharks-sos",
              playerId: "schedule-wr",
              name: "Schedule Receiver",
              position: "WR",
              team: "BUF",
              source: "DraftSharks",
              updatedAt: "2026-09-01T00:00:00.000Z",
              bestWeek: 2,
              bestRankEcr: 18,
              bestPositionRank: "WR18",
              averageRankEcr: 18,
              rankDelta: null,
              bestMatchupStars: 5,
              bestOpponentRank: 4,
              confidence: 96,
              note: "Strong schedule window.",
              weeks: [
                {
                  week: 2,
                  rankEcr: 18,
                  positionRank: "WR18",
                  bestRank: null,
                  worstRank: null,
                  averageRank: 18,
                  rankStdDev: null,
                  lastUpdated: "2026-09-01T00:00:00.000Z",
                  fetchedAt: "2026-09-01T00:00:00.000Z",
                  sourceStatus: "loaded",
                  opponent: "NYJ",
                  homeAway: "home",
                  opponentRank: 4,
                  matchupStars: 5,
                  matchupTier: "easy",
                  isBye: false,
                },
              ],
              sourceTrace: [
                {
                  source: "DraftSharks",
                  sourceKey: "draftsharks-sos-v1",
                  endpointKey: "draftsharks-sos-wr-week-2",
                  endpointLabel: "DraftSharks WR SOS Week 2",
                  status: "loaded",
                  season: "2026",
                  scoring: "PPR",
                  week: 2,
                  position: "WR",
                  rowCount: 120,
                  fetchedAt: "2026-09-01T00:00:00.000Z",
                  lastUpdated: "2026-09-01T00:00:00.000Z",
                  evidence: "test",
                },
              ],
              traceSummary: "W2",
            },
          },
        ],
      } as any,
    });

    const scheduleEvent = events.find(event => event.surface === "schedule" && event.entityId === "schedule-wr");
    expect(scheduleEvent).toMatchObject({
      action: "pickup",
      metadata: {
        decisionLabel: "Review this",
      },
    });
    expect(scheduleEvent?.decision).toBe("do");
  });

  it("does not calibrate malformed actionable evidence gaps as do decisions", () => {
    const decision = __testing.decisionFromEvidence({
      label: "priority",
      finalScore: 78,
      canAct: true,
      whyThisFired: "Multiple returned sources agree.",
      evidence: ["Loaded market signal."],
      missingEvidence: ["Verify live roster state before acting."],
      hardBlockers: [],
      softPenalties: [],
      sourceTrace: [{
        label: "Sleeper roster snapshot",
        status: "loaded",
      }],
      confidenceCap: 68,
      confidenceCapReason: "Missing live roster proof",
      receipts: [],
      action: "pickup",
      surface: "waiver",
    } as any, 78);

    expect(decision).toBe("watch");
  });

  it("does not calibrate malformed queue items with evidence gaps as do decisions", () => {
    const baseQueueItem = {
      id: "queue-test",
      source: "waiver",
      decision: "do",
      rank: 1,
      label: "Do this now",
      action: "Add Player",
      target: "Waiver Receiver",
      detail: "Add the player.",
      why: "Good waiver edge.",
      risk: "Medium",
      confidence: 78,
      tone: "good",
      blockers: [],
      missingEvidence: [],
      sourceHealth: ["Sleeper roster source loaded"],
      receipts: ["Roster need confirmed."],
      changeTriggers: [],
      signals: [],
      expectedAction: null,
      observedOutcome: null,
    } as const;

    expect(__testing.decisionFromQueueItem(baseQueueItem as any)).toBe("do");
    expect(__testing.decisionFromQueueItem({
      ...baseQueueItem,
      missingEvidence: ["Verify live roster state before acting."],
    } as any)).toBe("watch");
    expect(__testing.decisionFromQueueItem({
      ...baseQueueItem,
      sourceHealth: [],
    } as any)).toBe("watch");
    expect(__testing.decisionFromQueueItem({
      ...baseQueueItem,
      sourceHealth: ["Stored source stale"],
    } as any)).toBe("watch");
    expect(__testing.decisionFromQueueItem({
      ...baseQueueItem,
      sourceHealth: ["Stored source disabled"],
    } as any)).toBe("watch");
    expect(__testing.decisionFromQueueItem({
      ...baseQueueItem,
      blockers: ["Player is already rostered."],
    } as any)).toBe("blocked");
  });

  it("does not keep raw do events when source proof is missing", () => {
    const event = __testing.buildEvent({
      reportRunKey: "test-report-run",
      createdAt: "2026-09-01T00:00:00.000Z",
      valueMode: "redraft",
      leagueId: "13000000000000",
      season: "2026",
      week: 2,
      surface: "autopilot",
      action: "pickup",
      decision: "do",
      entityType: "player",
      entityId: "missing-source-player",
      entityName: "Missing Source Player",
      finalScore: 82,
      evidence: ["Raw caller tried to persist a do event."],
      missingEvidence: [],
      hardBlockers: [],
      sourceTrace: [],
      whyThisFired: "No source proof was attached.",
    });

    expect(event.decision).toBe("watch");
    expect(event.sourceAgreement).toBeNull();
    expect(event.outcome.status).toBe("pending");

    const blockedEvent = __testing.buildEvent({
      reportRunKey: "test-report-run",
      createdAt: "2026-09-01T00:00:00.000Z",
      valueMode: "redraft",
      leagueId: "13000000000000",
      season: "2026",
      week: 2,
      surface: "autopilot",
      action: "pickup",
      decision: "do",
      entityType: "player",
      entityId: "blocked-player",
      entityName: "Blocked Player",
      finalScore: 82,
      evidence: ["Raw caller tried to persist a do event."],
      missingEvidence: [],
      hardBlockers: ["Roster ownership already blocks this add."],
      sourceTrace: [{
        label: "Sleeper roster snapshot",
        status: "loaded",
      }],
    });

    expect(blockedEvent.decision).toBe("blocked");
    expect(blockedEvent.outcome.status).toBe("blocked");
  });

  it("does not calibrate waiver candidates with missing roster proof as do decisions", () => {
    const events = buildAIPredictionEventsForReport({
      leagueId: "13000000000000",
      createdAt: "2026-09-01T00:00:00.000Z",
      reportData: {
        leagueDiagnostics: {
          currentSeason: "2026",
          currentWeek: 2,
          valueMode: "redraft",
        },
        leagueValueMode: "redraft",
        waiverIntelligence: {
          rosteredTrendingAdds: [],
          availableTrendingAdds: [
            {
              player_id: "missing-owner-waiver",
              name: "Missing Owner Receiver",
              pos: "WR",
              team: "BUF",
              count: 4200,
              ktcValue: 5200,
              currentPositionRank: "WR22",
            },
          ],
          highestKtcAvailable: null,
          bestAvailableByPosition: {
            QB: null,
            RB: null,
            WR: null,
            TE: null,
            K: null,
            DEF: null,
          },
          bestTaxiStashes: [],
          recentlyDroppedValuable: [],
          weeklyEcrTargets: [],
          omittedCandidates: [],
        },
      } as any,
    });

    const waiverEvent = events.find(event =>
      event.surface === "waiver" &&
      event.entityId === "missing-owner-waiver"
    );

    expect(waiverEvent).toMatchObject({
      decision: "watch",
      confidenceCap: 55,
      confidenceCapReason: "Missing roster ownership proof",
      metadata: {
        ownerStatus: "unverified",
      },
    });
    expect(waiverEvent?.missingEvidence).toContain(
      "No current roster ownership or availability proof returned for this waiver candidate."
    );
    expect(waiverEvent?.sourceTrace).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Unverified roster availability",
        status: "limited",
      }),
    ]));
  });

  it("classifies unavailable source traces as missing source-agreement proof", () => {
    const agreement = buildClientSourceAgreementRead({
      sourceTrace: [{
        label: "Stored waiver source",
        status: "unavailable",
        detail: "Provider disabled for this environment.",
      }],
      hardBlockers: [],
      missingEvidence: [],
    });

    expect(agreement).toMatchObject({
      state: "missing",
      missingCount: 1,
      confidenceCap: 48,
      reason: "No source signal was available for this read.",
      signals: [{
        direction: "missing",
        confidence: 0,
        status: "unavailable",
      }],
    });
  });

  it("classifies disabled source detail as missing source-agreement proof", () => {
    const agreement = buildClientSourceAgreementRead({
      sourceTrace: [{
        label: "Stored waiver source",
        status: "loaded",
        detail: "Provider disabled for this environment.",
      }],
      hardBlockers: [],
      missingEvidence: [],
    });

    expect(agreement).toMatchObject({
      state: "missing",
      missingCount: 1,
      confidenceCap: 48,
      signals: [{
        direction: "missing",
        confidence: 0,
        status: "loaded",
      }],
    });
  });

  it("splits source agreement when loaded proof is mixed with stale source traces", () => {
    const agreement = buildClientSourceAgreementRead({
      sourceTrace: [{
        label: "Sleeper availability",
        status: "loaded",
        detail: "Availability confirmed.",
      }, {
        label: "Stored waiver source",
        status: "stale",
        detail: "0 rows returned from latest endpoint probe.",
      }],
      hardBlockers: [],
      missingEvidence: [],
    });

    expect(agreement).toMatchObject({
      state: "split",
      directionalSourceCount: 1,
      sourceCount: 2,
      forWeight: 70,
      againstWeight: 0,
      missingCount: 1,
      confidenceCap: 62,
      reason: "Source signals are split, so calibration should stay cautious.",
      signals: expect.arrayContaining([
        expect.objectContaining({
          direction: "for",
          confidence: 70,
          status: "loaded",
        }),
        expect.objectContaining({
          direction: "missing",
          confidence: 0,
          status: "stale",
        }),
      ]),
    });
  });

  it("does not emit fake calibration events when report data is missing", () => {
    expect(buildAIPredictionEventsForReport({ reportData: null })).toEqual([]);
  });
});
