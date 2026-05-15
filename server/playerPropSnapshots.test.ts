import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import {
  clearPlayerPropSnapshotCacheForTests,
  loadPlayerPropSnapshot,
  normalizeOpticOddsPlayerProps,
  refreshPlayerPropSnapshots,
} from "./playerPropSnapshots";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  clearPlayerPropSnapshotCacheForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("player prop snapshots", () => {
  it("normalizes OpticOdds fixture odds into player prop lines", () => {
    const lines = normalizeOpticOddsPlayerProps({
      data: [
        {
          id: "fixture-1",
          sport: "football",
          league: "nfl",
          start_date: "2026-09-11T00:20:00Z",
          home_competitors: [{ name: "Kansas City Chiefs" }],
          away_competitors: [{ name: "Denver Broncos" }],
          odds: [
            {
              sportsbook: { id: "sleeper", name: "Sleeper" },
              market: "player_receiving_yards",
              market_display_name: "Receiving Yards",
              player: { id: "player-1", name: "Courtland Sutton" },
              team: "DEN",
              name: "Over",
              points: 54.5,
              price: -112,
              last_updated: "2026-09-10T18:00:00Z",
            },
            {
              sportsbook: { id: "sleeper", name: "Sleeper" },
              market: "player_receiving_yards",
              market_display_name: "Receiving Yards",
              player: { id: "player-1", name: "Courtland Sutton" },
              team: "DEN",
              name: "Under",
              points: 54.5,
              price: -108,
              last_updated: "2026-09-10T18:00:00Z",
            },
          ],
        },
      ],
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      fixtureId: "fixture-1",
      eventName: "Denver Broncos at Kansas City Chiefs",
      playerId: "player-1",
      playerName: "Courtland Sutton",
      market: "player_receiving_yards",
      marketLabel: "Receiving Yards",
      line: 54.5,
    });
    expect(lines[0].outcomes).toEqual([
      expect.objectContaining({
        side: "over",
        priceAmerican: -112,
        sportsbookId: "sleeper",
      }),
      expect.objectContaining({
        side: "under",
        priceAmerican: -108,
        sportsbookName: "Sleeper",
      }),
    ]);
  });

  it("loads stored prop snapshots without calling a provider", async () => {
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
          lines: [
            {
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
              outcomes: [],
            },
          ],
        },
      }),
    });

    const snapshot = await loadPlayerPropSnapshot({ sourceMode: "snapshot" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(snapshot.status).toBe("loaded");
    expect(snapshot.lines[0].playerName).toBe("Courtland Sutton");
  });

  it("does not fetch live props unless OpticOdds is enabled and keyed", async () => {
    process.env.ENABLE_OPTICODDS_PLAYER_PROPS = "";
    process.env.OPTICODDS_API_KEY = "";
    const fetchMock = vi.fn();

    const disabled = await loadPlayerPropSnapshot({
      fetchImpl: fetchMock as unknown as typeof fetch,
      forceRefresh: true,
    });
    expect(disabled.status).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.ENABLE_OPTICODDS_PLAYER_PROPS = "true";
    const missingConfig = await loadPlayerPropSnapshot({
      fetchImpl: fetchMock as unknown as typeof fetch,
      forceRefresh: true,
    });
    expect(missingConfig.status).toBe("missing_config");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes OpticOdds snapshots behind env flags and persists normalized lines", async () => {
    process.env.ENABLE_OPTICODDS_PLAYER_PROPS = "true";
    process.env.OPTICODDS_API_KEY = "test-key";
    process.env.OPTICODDS_FIXTURE_LIMIT = "1";
    process.env.OPTICODDS_SPORTSBOOKS = "sleeper,bet365";
    process.env.OPTICODDS_PROP_MARKETS = "player_receiving_yards";

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-Api-Key"]).toBe("test-key");
      expect(url).not.toContain("test-key");

      if (url.includes("/fixtures/active")) {
        return new Response(JSON.stringify({ data: [{ id: "fixture-1" }] }), {
          status: 200,
        });
      }

      expect(url).toContain("/fixtures/odds");
      expect(url).toContain("fixture_id=fixture-1");
      expect(url).toContain("sportsbook=sleeper");
      expect(url).toContain("sportsbook=bet365");
      expect(url).toContain("market=player_receiving_yards");
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "fixture-1",
              odds: [
                {
                  sportsbook: "Sleeper",
                  market: "player_receiving_yards",
                  player_name: "Courtland Sutton",
                  name: "Over",
                  points: 54.5,
                  price: -112,
                },
              ],
            },
          ],
        }),
        { status: 200 }
      );
    });
    const upsertSpy = vi
      .spyOn(db, "upsertProviderDataSnapshot")
      .mockResolvedValue(true);

    const result = await refreshPlayerPropSnapshots({
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: new Date("2026-09-10T18:00:00Z"),
    });

    expect(result).toMatchObject({
      status: "loaded",
      source: "OpticOdds Player Props",
      snapshotKey: "2026-09-10",
      lineCount: 1,
    });
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "player-props-opticodds-v1",
        snapshotKey: "2026-09-10",
      })
    );
    expect(upsertSpy.mock.calls[0][0].payload).not.toContain("test-key");
  });
});
