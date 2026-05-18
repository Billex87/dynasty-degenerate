import { describe, expect, it } from "vitest";
import { buildWaiverIntelligence } from "./routers";

describe("buildWaiverIntelligence", () => {
  it("keeps omitted waiver candidates out of visible recommendation surfaces", () => {
    const players = {
      dallen: {
        first_name: "Dallen",
        last_name: "Bentley",
        position: "TE",
        team: null,
        active: true,
        fantasy_positions: ["TE"],
        metadata: { rookie_year: String(new Date().getFullYear()) },
      },
      trusted: {
        first_name: "Trusted",
        last_name: "Tightend",
        position: "TE",
        team: "KC",
        active: true,
        fantasy_positions: ["TE"],
        metadata: { rookie_year: String(new Date().getFullYear()) },
      },
    };
    const ktcValues = {
      dallenbentley: {
        name: "Dallen Bentley",
        ktc_value: 1800,
        dynasty_value: 1800,
        market_value_ktc: 1800,
        position_rank: "TE20",
        value_sources: ["KTC"],
      },
      trustedtightend: {
        name: "Trusted Tightend",
        ktc_value: 2200,
        dynasty_value: 2200,
        market_value_ktc: 2200,
        position_rank: "TE12",
        value_sources: ["KTC", "FantasyCalc"],
      },
    };
    const dallenTrending = {
      player_id: "dallen",
      name: "Dallen Bentley",
      pos: "TE",
      team: null,
      owner: null,
      count: 10,
      ktcValue: 1800,
      currentPositionRank: "TE20",
    };
    const trustedTrending = {
      player_id: "trusted",
      name: "Trusted Tightend",
      pos: "TE",
      team: "KC",
      owner: null,
      count: 8,
      ktcValue: 2200,
      currentPositionRank: "TE12",
    };

    const result = buildWaiverIntelligence(
      [dallenTrending, trustedTrending],
      [dallenTrending, trustedTrending],
      players,
      ktcValues,
      {},
      {},
      "dynasty",
      undefined,
      { rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"] }
    );

    expect(result.omittedCandidates.map(player => player.name)).toContain("Dallen Bentley");
    expect(result.availableTrendingAdds.map(player => player.name)).toEqual(["Trusted Tightend"]);
    expect(result.highestKtcAvailable?.name).toBe("Trusted Tightend");
    expect(result.recentlyDroppedValuable.map(player => player.name)).toEqual(["Trusted Tightend"]);
    expect(JSON.stringify({
      availableTrendingAdds: result.availableTrendingAdds,
      highestKtcAvailable: result.highestKtcAvailable,
      bestAvailableByPosition: result.bestAvailableByPosition,
      bestTaxiStashes: result.bestTaxiStashes,
      recentlyDroppedValuable: result.recentlyDroppedValuable,
    })).not.toContain("Dallen Bentley");
  });
});
