import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WeeklyProjectionContext } from "@shared/types";
import {
  getWeeklyProjectionReceiptParts,
  WeeklyProjectionReceipt,
} from "./WeeklyProjectionReceipt";

const readyProjection: WeeklyProjectionContext = {
  source: "stored-weekly-projection",
  provider: "sleeper",
  season: "2026",
  week: 1,
  scoringProfile: "PPR + 0.5 TEP",
  projectedFantasyPoints: 13.42,
  tightEndPremiumAdjustment: 1.25,
  opponent: "BUF",
  homeAway: "away",
  team: "NYJ",
  updatedAt: "2026-05-26T00:00:00.000Z",
  fetchedAt: "2026-05-26T00:00:00.000Z",
  status: "ready",
  note: "Stored weekly projection fixture.",
  statSummary: "4 rec, 48 rec yds, 0.4 rec TD",
};

describe("WeeklyProjectionReceipt", () => {
  it("renders ready weekly projection receipts with TEP context", () => {
    const html = renderToStaticMarkup(
      createElement(WeeklyProjectionReceipt, { weeklyProjection: readyProjection })
    );

    expect(html).toContain('data-testid="weekly-projection-receipt"');
    expect(html).toContain("Stored weekly projection");
    expect(html).toContain("13.4 pts");
    expect(html).toContain("Week 1");
    expect(html).toContain("at BUF");
    expect(html).toContain("PPR + 0.5 TEP");
    expect(html).toContain("4 rec, 48 rec yds, 0.4 rec TD");
    expect(html).toContain("+1.3 TEP");
  });

  it("renders a reachable Player Detail trigger when a click handler is supplied", () => {
    const html = renderToStaticMarkup(
      createElement(WeeklyProjectionReceipt, {
        weeklyProjection: readyProjection,
        variant: "fact",
        playerName: "Waiver Receiver",
        onOpenPlayerDetail: () => undefined,
      })
    );

    expect(html).toContain('data-testid="projection-player-detail-trigger"');
    expect(html).toContain("Open stored weekly projection for Waiver Receiver");
  });

  it.each(["stale", "missing", "bye", "error"] as const)(
    "renders nothing for %s rows",
    (status) => {
      const html = renderToStaticMarkup(
        createElement(WeeklyProjectionReceipt, {
          weeklyProjection: {
            ...readyProjection,
            status,
          },
        })
      );

      expect(html).toBe("");
      expect(getWeeklyProjectionReceiptParts({ ...readyProjection, status })).toBeNull();
    }
  );

  it("renders nothing for null projection rows", () => {
    expect(
      renderToStaticMarkup(
        createElement(WeeklyProjectionReceipt, { weeklyProjection: null })
      )
    ).toBe("");
    expect(getWeeklyProjectionReceiptParts(null)).toBeNull();
  });
});
