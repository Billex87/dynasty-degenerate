import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const originalDatabaseUrl = process.env.DATABASE_URL;

function createContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function jsonResponse(value: unknown) {
  return {
    ok: true,
    json: async () => value,
  };
}

function createSleeperFetchMock(leagueId: string) {
  return vi.fn(async (url: string) => {
    if (url === `https://api.sleeper.app/v1/league/${leagueId}`) {
      return jsonResponse({ league_id: leagueId, name: "Extension Test League" });
    }

    if (url === `https://api.sleeper.app/v1/league/${leagueId}/users`) {
      return jsonResponse([
        { user_id: "user-1", display_name: "Manager One" },
        { user_id: "user-2", display_name: "Manager Two" },
      ]);
    }

    if (url === `https://api.sleeper.app/v1/league/${leagueId}/rosters`) {
      return jsonResponse([
        { roster_id: 1, owner_id: "user-1" },
        { roster_id: 2, owner_id: "user-2" },
      ]);
    }

    if (url === "https://api.sleeper.app/v1/players/nfl") {
      return jsonResponse({
        p1: { full_name: "Depth Receiver", first_name: "Depth", last_name: "Receiver" },
        p2: { full_name: "Waiver Receiver", first_name: "Waiver", last_name: "Receiver" },
        p3: { full_name: "Drop Tight End", first_name: "Drop", last_name: "Tight End" },
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });
}

describe("league.importSleeperTradeCenterSnapshot", () => {
  beforeEach(() => {
    delete process.env.REQUIRE_AUTH_FOR_REPORTS;
    delete process.env.DATABASE_URL;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("imports sanitized pending extension transactions and ignores terminal activity", async () => {
    const leagueId = "1312139584427012096";
    const fetchMock = createSleeperFetchMock(leagueId);
    vi.stubGlobal("fetch", fetchMock);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.league.importSleeperTradeCenterSnapshot({
      leagueId,
      capturedAt: Date.now(),
      source: "chrome-extension",
      sharedBy: "playwright-qa",
      transactions: [
        {
          league_id: leagueId,
          transaction_id: "trade-1",
          type: "trade",
          status: "proposed",
          created: 1780621000000,
          status_updated: 1780621100000,
          roster_ids: [1, 2],
          consenter_ids: [1],
          creator: "user-1",
          adds: { p1: 2 },
          drops: null,
          draft_picks: [
            {
              season: "2026",
              round: 2,
              roster_id: 2,
              previous_owner_id: 2,
              owner_id: 1,
              authorization: "SECRET_SHOULD_STRIP",
            },
          ],
          settings: null,
          waiver_budget: null,
          player_map: null,
          authorization: "SECRET_SHOULD_STRIP",
          cookie: "SECRET_SHOULD_STRIP",
          metadata: { email: "secret@example.com" },
        },
        {
          league_id: leagueId,
          transaction_id: "waiver-1",
          type: "waiver",
          status: "pending",
          created: 1780621200000,
          status_updated: 1780621300000,
          roster_ids: [1],
          consenter_ids: [1],
          creator: "user-1",
          adds: { p2: 1 },
          drops: { p3: 1 },
          draft_picks: [],
          settings: { waiver_bid: 7, cookie: "SECRET_SHOULD_STRIP" },
          waiver_budget: null,
          player_map: null,
        },
        {
          league_id: leagueId,
          transaction_id: "completed-1",
          type: "trade",
          status: "complete",
          created: 1780620000000,
          status_updated: 1780620000000,
          roster_ids: [1, 2],
          adds: { p3: 2 },
        },
        {
          league_id: leagueId,
          transaction_id: "rejected-1",
          type: "trade",
          status: "rejected",
          created: 1780620000000,
          status_updated: 1780620000000,
          roster_ids: [1, 2],
          adds: { p3: 2 },
        },
      ],
    } as any);

    expect(result.transactionCount).toBe(2);
    expect(result.tradeCount).toBe(1);
    expect(result.waiverCount).toBe(1);
    expect(result.tradeProposalSignals[0]).toMatchObject({
      id: "trade-1",
      status: "proposed",
      managers: ["Manager One", "Manager Two"],
      playerNames: ["Depth Receiver"],
    });
    expect(result.waiverSignals[0]).toMatchObject({
      id: "waiver-1",
      status: "pending",
      managers: ["Manager One"],
      playerNames: ["Waiver Receiver"],
      dropPlayerNames: ["Drop Tight End"],
      bidAmount: 7,
    });
    expect(JSON.stringify(result)).not.toContain("SECRET_SHOULD_STRIP");
    expect(JSON.stringify(result)).not.toContain("secret@example.com");
  });

  it("rejects oversized extension payloads before live provider loads", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.league.importSleeperTradeCenterSnapshot({
        leagueId: "1312139584427012096",
        capturedAt: Date.now(),
        source: "chrome-extension",
        transactions: Array.from({ length: 501 }, (_, index) => ({
          transaction_id: `trade-${index}`,
          type: "trade",
          status: "pending",
        })),
      } as any)
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
