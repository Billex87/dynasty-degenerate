import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter, clearLeaguePreviewCacheForTests } from "./routers";

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

describe("league.getLeaguePreview", () => {
  afterEach(() => {
    clearLeaguePreviewCacheForTests();
    vi.unstubAllGlobals();
    delete process.env.REQUIRE_AUTH_FOR_REPORTS;
  });

  it("returns Sleeper league metadata for direct league ID entry", async () => {
    delete process.env.REQUIRE_AUTH_FOR_REPORTS;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/users")) {
        return {
          ok: true,
          json: async () => [
            {
              user_id: "user-1",
              display_name: "Manager One",
              avatar: "manager-avatar",
            },
            {
              user_id: "user-2",
              display_name: "Manager Two",
              avatar: null,
            },
          ],
        };
      }

      return {
        ok: true,
        json: async () => ({
          league_id: "123456789012",
          name: "Known League",
          avatar: "league-avatar",
          season: "2026",
          total_rosters: 12,
          settings: {
            type: 2,
          },
          roster_positions: ["QB", "RB", "WR", "TE", "SUPER_FLEX"],
          scoring_settings: {
            rec: 1,
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.league.getLeaguePreview({ leagueId: "123456789012" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.sleeper.app/v1/league/123456789012", undefined);
    expect(fetchMock).toHaveBeenCalledWith("https://api.sleeper.app/v1/league/123456789012/users", undefined);
    expect(result).toMatchObject({
      leagueId: "123456789012",
      name: "Known League",
      avatarUrl: "https://sleepercdn.com/avatars/thumbs/league-avatar",
      season: "2026",
      totalRosters: 12,
      standingsRank: null,
      powerRank: null,
      managerAnchors: [
        {
          id: "user-1",
          avatarUrl: "https://sleepercdn.com/avatars/thumbs/manager-avatar",
        },
        {
          id: "user-2",
          avatarUrl: null,
        },
      ],
    });
    expect(result.format).toContain("12-Team");
    expect(result.format).toContain("Dynasty");
    expect(result.format).toContain("SF");
    expect(result.format).toContain("PPR");
  });

  it("reuses bounded preview metadata for repeated direct league ID entries", async () => {
    delete process.env.REQUIRE_AUTH_FOR_REPORTS;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/users")) {
        return {
          ok: true,
          json: async () => [
            {
              user_id: "cached-user",
              display_name: "Cached Manager",
              avatar: "cached-manager-avatar",
            },
          ],
        };
      }

      return {
        ok: true,
        json: async () => ({
          league_id: "987654321098",
          name: "Cached League",
          avatar: null,
          season: "2026",
          total_rosters: 10,
          settings: {
            type: 2,
          },
          roster_positions: ["QB", "RB", "WR", "TE", "SUPER_FLEX"],
          scoring_settings: {
            rec: 0.5,
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const caller = appRouter.createCaller(createContext());
    const first = await caller.league.getLeaguePreview({ leagueId: "987654321098" });
    const second = await caller.league.getLeaguePreview({ leagueId: "987654321098" });

    expect(first).toEqual(second);
    expect(second.managerAnchors).toEqual([
      {
        id: "cached-user",
        avatarUrl: "https://sleepercdn.com/avatars/thumbs/cached-manager-avatar",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("https://api.sleeper.app/v1/league/987654321098", undefined);
    expect(fetchMock).toHaveBeenCalledWith("https://api.sleeper.app/v1/league/987654321098/users", undefined);
  });
});
