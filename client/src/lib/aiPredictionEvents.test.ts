import { describe, expect, it } from "vitest";
import { createCachedCommandCenterReport } from "../../../tests/e2e/fixtures/cachedReports";
import {
  buildAIPredictionEventsForReport,
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

  it("does not emit fake calibration events when report data is missing", () => {
    expect(buildAIPredictionEventsForReport({ reportData: null })).toEqual([]);
  });
});
