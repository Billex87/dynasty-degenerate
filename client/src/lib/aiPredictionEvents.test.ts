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

  it("does not emit fake calibration events when report data is missing", () => {
    expect(buildAIPredictionEventsForReport({ reportData: null })).toEqual([]);
  });
});
