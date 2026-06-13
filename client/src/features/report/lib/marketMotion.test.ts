import { describe, expect, it } from "vitest";
import type { RecentTransaction, WeeklyMomentum } from "@shared/types";
import {
  buildMarketMoverItems,
  buildMarketPulsePath,
  buildTransactionActivitySeries,
  formatMarketCompactValue,
  formatMarketSignedPercent,
} from "./marketMotion";

function mover(overrides: Partial<WeeklyMomentum>): WeeklyMomentum {
  return {
    name: "Player",
    owner: "Manager",
    pos: "WR",
    val_last: 1000,
    val_now: 1200,
    diff: 200,
    pct_change: 20,
    ...overrides,
  };
}

function transaction(
  id: string,
  date: string,
): RecentTransaction {
  return {
    id,
    date,
    manager: "Manager",
    type: "Waiver",
    bidAmount: null,
    addedPlayer: null,
    droppedPlayer: null,
    alternativeDrop: null,
    note: "Transaction",
    losingBidsAvailable: false,
  };
}

describe("market motion helpers", () => {
  it("formats compact market values and signed percentages", () => {
    expect(formatMarketCompactValue(48210)).toBe("48.2K");
    expect(formatMarketCompactValue(1200)).toBe("1.2K");
    expect(formatMarketSignedPercent(15.44)).toBe("+15.4%");
    expect(formatMarketSignedPercent(-8)).toBe("-8%");
  });

  it("combines and sorts risers and fallers by movement size", () => {
    const items = buildMarketMoverItems({
      risers: [
        mover({ name: "Small Riser", pct_change: 4, diff: 100 }),
        mover({ name: "Big Riser", pct_change: 18, diff: 800 }),
      ],
      fallers: [
        mover({ name: "Big Faller", pct_change: -22, diff: -900 }),
      ],
      limit: 2,
    });

    expect(items.map(item => item.name)).toEqual(["Big Faller", "Big Riser"]);
    expect(items[0].direction).toBe("down");
    expect(items[1].direction).toBe("up");
  });

  it("buckets parseable transaction timestamps by recent week", () => {
    const series = buildTransactionActivitySeries([
      transaction("1", "2026-05-29T00:00:00.000Z"),
      transaction("2", "2026-05-30T00:00:00.000Z"),
      transaction("3", "2026-06-03T00:00:00.000Z"),
    ]);

    expect(series.mode).toBe("timestamped");
    expect(series.total).toBe(3);
    expect(series.buckets.map(bucket => bucket.count)).toEqual([2, 1]);
  });

  it("falls back to report-order activity when timestamps are unusable", () => {
    const series = buildTransactionActivitySeries([
      transaction("1", ""),
      transaction("2", "not-a-date"),
      transaction("3", ""),
    ], 2);

    expect(series.mode).toBe("activity");
    expect(series.buckets.map(bucket => bucket.count)).toEqual([2, 1]);
    expect(series.note).toContain("recent-activity sparkline");
  });

  it("builds an EKG path from bucket counts", () => {
    const path = buildMarketPulsePath(
      [
        { key: "a", label: "A", count: 1 },
        { key: "b", label: "B", count: 4 },
      ],
      120,
      48,
    );

    expect(path).toMatch(/^M /);
    expect(path).toContain("L 120 32.64");
  });
});
