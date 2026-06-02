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
      sourceHealth: ["FantasyPros source stale"],
    } as any)).toBe("watch");
    expect(__testing.decisionFromQueueItem({
      ...baseQueueItem,
      sourceHealth: ["FantasyPros source disabled"],
    } as any)).toBe("watch");
    expect(__testing.decisionFromQueueItem({
      ...baseQueueItem,
      blockers: ["Player is already rostered."],
    } as any)).toBe("blocked");
  });

  it("classifies unavailable source traces as missing source-agreement proof", () => {
    const agreement = buildClientSourceAgreementRead({
      sourceTrace: [{
        label: "FantasyPros waiver source",
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
        label: "FantasyPros waiver source",
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
        label: "FantasyPros waiver source",
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
