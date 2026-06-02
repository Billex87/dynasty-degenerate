import { describe, expect, it } from "vitest";

import {
  buildHomePortfolioRows,
  filterHomePortfolioRows,
  sortHomePortfolioRows,
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

  it("filters portfolio rows by high exposure, position, and stash state", () => {
    const quickFilterRows = buildHomePortfolioRows([
      {
        leagueId: "league-a",
        name: "Alpha League",
        avatarUrl: null,
        format: "Dynasty SF PPR",
        mobileFormat: "Dynasty SF",
        rosterPlayers: [
          player({ playerId: "qb1", name: "Shared Quarterback", position: "QB" }),
          player({
            playerId: "wr1",
            name: "Taxi Receiver",
            position: "WR",
            rosterSpot: "taxi",
          }),
        ],
      },
      {
        leagueId: "league-b",
        name: "Beta League",
        avatarUrl: null,
        format: "Dynasty SF PPR",
        mobileFormat: "Dynasty SF",
        rosterPlayers: [
          player({ playerId: "qb1", name: "Shared Quarterback", position: "QB" }),
        ],
      },
      {
        leagueId: "league-c",
        name: "Gamma League",
        avatarUrl: null,
        format: "Dynasty SF PPR",
        mobileFormat: "Dynasty SF",
        rosterPlayers: [
          player({ playerId: "qb1", name: "Shared Quarterback", position: "QB" }),
          player({ playerId: "te1", name: "Single Tight End", position: "TE" }),
        ],
      },
    ]);

    expect(
      filterHomePortfolioRows(quickFilterRows, { exposure: "threePlus" }).map(
        row => row.name
      )
    ).toEqual(["Shared Quarterback"]);
    expect(
      filterHomePortfolioRows(quickFilterRows, { exposure: "qb" }).map(
        row => row.name
      )
    ).toEqual(["Shared Quarterback"]);
    expect(
      filterHomePortfolioRows(quickFilterRows, { exposure: "te" }).map(
        row => row.name
      )
    ).toEqual(["Single Tight End"]);
    expect(
      filterHomePortfolioRows(quickFilterRows, { exposure: "stash" }).map(
        row => row.name
      )
    ).toEqual(["Taxi Receiver"]);
    expect(filterHomePortfolioRows(quickFilterRows, { query: "taxi" }).map(row => row.name)).toEqual([
      "Taxi Receiver",
    ]);
  });

  it("sorts portfolio rows by value, name, and stash priority", () => {
    const sortableRows = buildHomePortfolioRows([
      {
        leagueId: "league-a",
        name: "Alpha League",
        avatarUrl: null,
        format: "Dynasty SF PPR",
        mobileFormat: "Dynasty SF",
        rosterPlayers: [
          player({ playerId: "p1", name: "Shared Back", value: 4000 }),
          player({
            playerId: "p2",
            name: "Taxi Receiver",
            position: "WR",
            value: 900,
            rosterSpot: "taxi",
          }),
          player({ playerId: "p3", name: "Alpha Quarterback", position: "QB", value: 6200 }),
        ],
      },
      {
        leagueId: "league-b",
        name: "Beta League",
        avatarUrl: null,
        format: "Dynasty SF PPR",
        mobileFormat: "Dynasty SF",
        rosterPlayers: [
          player({ playerId: "p1", name: "Shared Back", value: 4100 }),
        ],
      },
    ]);

    expect(sortHomePortfolioRows(sortableRows, "value").map(row => row.name)).toEqual([
      "Alpha Quarterback",
      "Shared Back",
      "Taxi Receiver",
    ]);
    expect(sortHomePortfolioRows(sortableRows, "name").map(row => row.name)).toEqual([
      "Alpha Quarterback",
      "Shared Back",
      "Taxi Receiver",
    ]);
    expect(sortHomePortfolioRows(sortableRows, "stash").map(row => row.name)[0]).toBe(
      "Taxi Receiver"
    );
  });
});
