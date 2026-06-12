import { describe, expect, it } from "vitest";
import {
  buildTradeValueCalibrationNote,
  buildTradeValueCalibrationCoverage,
  classifyStoredValueMove,
  getPlayerTradeValueCalibration,
  getStrongestTradeValueCalibration,
} from "./tradeValueCalibration";

describe("trade value calibration", () => {
  it("uses backtested thresholds and downgrades low baseline spikes", () => {
    expect(
      classifyStoredValueMove({
        startValue: 2500,
        endValue: 3400,
        baselineSourceCount: 3,
        currentSourceCount: 3,
      })
    ).toMatchObject({
      outcome: "confirmed-riser",
      confidence: "high",
      diff: 900,
    });

    expect(
      classifyStoredValueMove({
        startValue: 4200,
        endValue: 3100,
        baselineSourceCount: 3,
        currentSourceCount: 3,
      })
    ).toMatchObject({
      outcome: "confirmed-faller",
      confidence: "high",
      diff: -1100,
    });

    expect(
      classifyStoredValueMove({
        startValue: 400,
        endValue: 850,
        baselineSourceCount: 1,
        currentSourceCount: 2,
      })
    ).toMatchObject({
      outcome: "low-denominator-watch",
      confidence: "low",
    });
  });

  it("reads dynamic player timelines and picks the strongest trade signal", () => {
    const riserDetails = {
      valueTimeline: {
        profileKey: "test",
        source: "stored-value-snapshots" as const,
        points: [
          { date: "2026-05-01", value: 2200, sources: ["KTC", "FantasyCalc"], sourceCount: 2 },
          { date: "2026-05-11", value: 3200, sources: ["KTC", "FantasyCalc"], sourceCount: 2 },
        ],
        summary: {
          startValue: 2200,
          endValue: 3200,
          delta: 1000,
          deltaPct: 45.5,
          sourceSetChanged: false,
          eventCount: 0,
          note: "test",
        },
      },
    };
    const fallerDetails = {
      valueTimeline: {
        profileKey: "test",
        source: "stored-value-snapshots" as const,
        points: [
          { date: "2026-05-01", value: 4800, sources: ["KTC", "FantasyCalc"], sourceCount: 2 },
          { date: "2026-05-11", value: 3900, sources: ["KTC", "FantasyCalc"], sourceCount: 2 },
        ],
        summary: {
          startValue: 4800,
          endValue: 3900,
          delta: -900,
          deltaPct: -18.8,
          sourceSetChanged: false,
          eventCount: 0,
          note: "test",
        },
      },
    };

    expect(getPlayerTradeValueCalibration(riserDetails)).toMatchObject({
      outcome: "confirmed-riser",
      chip: "Riser +",
    });

    const strongest = getStrongestTradeValueCalibration([
      { name: "Stable Guy", playerDetails: undefined },
      { name: "Falling Asset", playerDetails: fallerDetails },
      { name: "Rising Asset", playerDetails: riserDetails },
    ]);

    expect(strongest?.asset.name).toBe("Rising Asset");
    expect(
      buildTradeValueCalibrationNote({
        name: "Rising Asset",
        calibration: strongest!.calibration,
        side: "outgoing",
      })
    ).toContain("confirmed riser (+1,000 since the earliest value check)");
  });

  it("summarizes trade calibration coverage without double-counting repeated assets", () => {
    const details = {
      playerId: "riser",
      fullName: "Repeated Riser",
      valueTimeline: {
        profileKey: "test",
        source: "stored-value-snapshots" as const,
        points: [
          { date: "2026-05-01", value: 2000, sources: ["KTC", "FantasyCalc"], sourceCount: 2 },
          { date: "2026-05-11", value: 3000, sources: ["KTC", "FantasyCalc"], sourceCount: 2 },
        ],
        summary: {
          startValue: 2000,
          endValue: 3000,
          delta: 1000,
          deltaPct: 50,
          sourceSetChanged: false,
          eventCount: 0,
          note: "test",
        },
      },
    };

    expect(
      buildTradeValueCalibrationCoverage([
        { name: "Repeated Riser", playerDetails: details },
        { name: "Repeated Riser", playerDetails: details },
        { name: "Missing Timeline", playerDetails: { playerId: "missing", fullName: "Missing Timeline" } },
      ])
    ).toMatchObject({
      totalPlayers: 2,
      timelinePlayers: 1,
      signalPlayers: 1,
      confirmedRisers: 1,
    });
  });
});
