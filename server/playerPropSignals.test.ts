import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import {
  buildPlayerPropMarketSignals,
  loadStoredPlayerPropMarketSignals,
} from "./playerPropSignals";
import {
  clearPlayerPropSnapshotCacheForTests,
  type PlayerPropLine,
} from "./playerPropSnapshots";

afterEach(() => {
  clearPlayerPropSnapshotCacheForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function propLine(overrides: Partial<PlayerPropLine> = {}): PlayerPropLine {
  return {
    source: "OpticOdds",
    league: "nfl",
    sport: "football",
    fixtureId: "fixture-1",
    eventName: "DEN at KC",
    startTime: "2026-09-11T00:20:00.000Z",
    playerId: "player-1",
    playerName: "Courtland Sutton",
    team: "DEN",
    market: "player_receiving_yards",
    marketLabel: "Receiving Yards",
    line: 54.5,
    outcomes: [
      {
        label: "Over",
        side: "over",
        priceAmerican: -112,
        priceDecimal: null,
        impliedProbability: null,
        sportsbookId: "sleeper",
        sportsbookName: "Sleeper",
        lastUpdated: "2026-09-10T18:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("player prop market signals", () => {
  it("builds high-confidence start support when market lines beat our projection", () => {
    const signals = buildPlayerPropMarketSignals({
      lines: [
        propLine({ line: 54.5 }),
        propLine({
          line: 55.5,
          outcomes: [
            {
              label: "Over",
              side: "over",
              priceAmerican: -110,
              priceDecimal: null,
              impliedProbability: null,
              sportsbookId: "bet365",
              sportsbookName: "bet365",
              lastUpdated: "2026-09-10T18:00:00.000Z",
            },
          ],
        }),
        propLine({
          line: 54.5,
          outcomes: [
            {
              label: "Over",
              side: "over",
              priceAmerican: -115,
              priceDecimal: null,
              impliedProbability: null,
              sportsbookId: "underdog_fantasy_2_pick_",
              sportsbookName: "Underdog Fantasy",
              lastUpdated: "2026-09-10T18:00:00.000Z",
            },
          ],
        }),
      ],
      projections: [
        {
          playerId: "player-1",
          playerName: "Courtland Sutton",
          market: "player_receiving_yards",
          projection: 50,
          source: "internal",
        },
      ],
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      playerName: "Courtland Sutton",
      marketLine: 54.5,
      modelProjection: 50,
      direction: "market_higher",
      sportsbookCount: 3,
      agreement: "strong",
      confidence: "high",
      startSitSupport: "supports_start",
    });
    expect(signals[0].summary).toContain(
      "above our player_receiving_yards projection"
    );
  });

  it("flags sit support and mixed agreement when books disagree materially", () => {
    const signals = buildPlayerPropMarketSignals({
      lines: [
        propLine({ line: 46.5 }),
        propLine({
          line: 61.5,
          outcomes: [
            {
              label: "Over",
              side: "over",
              priceAmerican: -110,
              priceDecimal: null,
              impliedProbability: null,
              sportsbookId: "bet365",
              sportsbookName: "bet365",
              lastUpdated: "2026-09-10T18:00:00.000Z",
            },
          ],
        }),
      ],
      projections: [
        {
          playerId: "player-1",
          playerName: "Courtland Sutton",
          market: "player_receiving_yards",
          projection: 70,
        },
      ],
    });

    expect(signals[0]).toMatchObject({
      marketLine: 54,
      modelProjection: 70,
      direction: "market_lower",
      agreement: "mixed",
      confidence: "low",
      startSitSupport: "supports_sit",
    });
  });

  it("loads stored snapshot signals without calling a props provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(db, "findLatestProviderDataSnapshot").mockResolvedValue({
      snapshotKey: "2026-09-10",
      updatedAt: new Date("2026-09-10T18:00:00Z"),
      payload: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-09-10T18:00:00Z",
        snapshotKey: "2026-09-10",
        snapshot: {
          status: "loaded",
          source: "OpticOdds Player Props",
          generatedAt: "2026-09-10T18:00:00Z",
          snapshotKey: "2026-09-10",
          lines: [propLine()],
        },
      }),
    });

    const result = await loadStoredPlayerPropMarketSignals({
      projections: [
        {
          playerId: "player-1",
          playerName: "Courtland Sutton",
          market: "player_receiving_yards",
          projection: 54,
        },
      ],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.snapshotStatus).toBe("loaded");
    expect(result.snapshotKey).toBe("2026-09-10");
    expect(result.signals[0]).toMatchObject({
      direction: "aligned",
      startSitSupport: "neutral",
    });
  });
});
