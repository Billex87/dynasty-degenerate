import { describe, expect, it } from "vitest";

import {
  buildHomePortfolioRows,
  filterHomePortfolioRows,
  type PortfolioLeaguePlayer,
} from "@/features/home/lib/portfolioRows";

const player = (
  overrides: Partial<PortfolioLeaguePlayer>
): PortfolioLeaguePlayer => ({
  playerId: overrides.playerId || "p1",
  name: overrides.name || "Player One",
  position: overrides.position ?? "RB",
  team: overrides.team ?? "DAL",
  value: overrides.value ?? 1000,
  positionRank: overrides.positionRank ?? "RB1",
  rosterSpot: overrides.rosterSpot || "active",
});

const rows = buildHomePortfolioRows([
  {
    leagueId: "league-a",
    name: "Alpha League",
    avatarUrl: null,
    format: "Dynasty SF PPR",
    mobileFormat: "Dynasty SF",
    rosterPlayers: [
      player({ playerId: "p1", name: "Shared Back", value: 4000 }),
      player({ playerId: "p2", name: "Alpha Only", value: 1200 }),
    ],
  },
  {
    leagueId: "league-b",
    name: "Beta League",
    avatarUrl: null,
    format: "Redraft PPR",
    mobileFormat: "Redraft",
    rosterPlayers: [
      player({ playerId: "p1", name: "Shared Back", value: 4200 }),
      player({ playerId: "p3", name: "Beta Only", value: 900 }),
    ],
  },
]);

describe("portfolioRows", () => {
  it("filters portfolio rows by exposure type", () => {
    expect(filterHomePortfolioRows(rows, { exposure: "overlap" })).toEqual([
      expect.objectContaining({ name: "Shared Back", leagueCount: 2 }),
    ]);

    expect(filterHomePortfolioRows(rows, { exposure: "single" }).map(row => row.name)).toEqual([
      "Alpha Only",
      "Beta Only",
    ]);
  });

  it("filters portfolio rows by league and search query together", () => {
    expect(
      filterHomePortfolioRows(rows, {
        leagueId: "league-b",
        query: "alpha only",
      }).map(row => row.name)
    ).toEqual([]);

    expect(
      filterHomePortfolioRows(rows, {
        leagueId: "league-b",
        query: "beta only",
      }).map(row => row.name)
    ).toEqual(["Beta Only"]);
  });
});
