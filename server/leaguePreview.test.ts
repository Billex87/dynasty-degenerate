import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

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
    vi.unstubAllGlobals();
    delete process.env.REQUIRE_AUTH_FOR_REPORTS;
  });

  it("returns Sleeper league metadata for direct league ID entry", async () => {
    delete process.env.REQUIRE_AUTH_FOR_REPORTS;
    const fetchMock = vi.fn(async () => ({
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
    }));
    vi.stubGlobal("fetch", fetchMock);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.league.getLeaguePreview({ leagueId: "123456789012" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.sleeper.app/v1/league/123456789012", undefined);
    expect(result).toMatchObject({
      leagueId: "123456789012",
      name: "Known League",
      avatarUrl: "https://sleepercdn.com/avatars/thumbs/league-avatar",
      season: "2026",
      totalRosters: 12,
      standingsRank: null,
      powerRank: null,
    });
    expect(result.format).toContain("12-Team");
    expect(result.format).toContain("Dynasty");
    expect(result.format).toContain("SF");
    expect(result.format).toContain("PPR");
  });
});
