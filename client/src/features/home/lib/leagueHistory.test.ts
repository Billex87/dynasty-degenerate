import { describe, expect, it } from "vitest";

import {
  getLeagueRankLookupBatch,
  MAX_LEAGUE_RANK_LOOKUP_BATCH,
  type SleeperLeagueOption,
} from "./leagueHistory";

function league(
  leagueId: string,
  overrides: Partial<SleeperLeagueOption> = {}
): SleeperLeagueOption {
  return {
    leagueId,
    name: `League ${leagueId}`,
    avatarUrl: null,
    season: "2026",
    format: "Dynasty",
    mobileFormat: "Dynasty",
    totalRosters: 12,
    standingsRank: null,
    powerRank: null,
    ...overrides,
  };
}

describe("league rank lookup batching", () => {
  it("requests only leagues missing rank or manager-anchor enrichment", () => {
    const batch = getLeagueRankLookupBatch([
      league("10000000000001", {
        standingsRank: 1,
        powerRank: 2,
        managerAnchors: [],
      }),
      league("10000000000002", {
        standingsRank: 3,
        powerRank: null,
        managerAnchors: [],
      }),
      league("10000000000003", {
        standingsRank: 4,
        powerRank: 5,
      }),
      league("10000000000004"),
    ]);

    expect(batch).toEqual([
      "10000000000002",
      "10000000000003",
      "10000000000004",
    ]);
  });

  it("caps rank lookup batches and removes duplicate league IDs", () => {
    const leagues = Array.from({ length: MAX_LEAGUE_RANK_LOOKUP_BATCH + 4 }, (_, index) =>
      league(String(10000000000000 + index))
    );

    const batch = getLeagueRankLookupBatch([
      league("10000000000000"),
      ...leagues,
    ]);

    expect(batch).toHaveLength(MAX_LEAGUE_RANK_LOOKUP_BATCH);
    expect(batch).toEqual(
      Array.from({ length: MAX_LEAGUE_RANK_LOOKUP_BATCH }, (_, index) =>
        String(10000000000000 + index)
      )
    );
  });
});
