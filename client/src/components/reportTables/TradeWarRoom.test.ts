import { describe, expect, it } from "vitest";
import type { ManagerIntelPlayer } from "@shared/types";
import { buildTradeWarPackageIdeas } from "./TradeWarRoom";

type TradeWarAssetForTest = ManagerIntelPlayer & {
  manager: string;
  assetState: "roster" | "bench" | "taxi" | "reserve" | "pick";
  assetKind?: "player" | "pick";
};

function asset(
  player_id: string,
  name: string,
  manager: string,
  value: number,
  overrides: Partial<TradeWarAssetForTest> = {}
): TradeWarAssetForTest {
  return {
    player_id,
    name,
    manager,
    owner: manager,
    pos: "WR",
    value,
    seasonValue: value,
    assetState: "roster",
    ...overrides,
  };
}

describe("buildTradeWarPackageIdeas", () => {
  it("proposes add, remove, swap, and lens alternatives for lopsided packages", () => {
    const a1 = asset("a1", "Sender WR", "Bill", 1000);
    const b1 = asset("b1", "Target WR", "Rival", 1800);
    const b2 = asset("b2", "Target Add", "Rival", 500);
    const aPick = asset("pick-a", "2027 Round 2", "Bill", 650, {
      pos: "PICK",
      assetState: "pick",
      assetKind: "pick",
    });
    const bSwap = asset("b3", "Cheaper Target", "Rival", 1150);
    const allAssets = [a1, b1, b2, aPick, bSwap];
    const assetById = new Map(allAssets.map(row => [row.player_id, row]));

    const ideas = buildTradeWarPackageIdeas({
      sideAIds: [a1.player_id],
      sideBIds: [b1.player_id, b2.player_id],
      sideAAssets: [a1],
      sideBAssets: [b1, b2],
      assetById,
      addOnSuggestion: {
        label: "Bill pick sweetener",
        summary: "Bill can add a second.",
        asset: aPick,
      },
      valueGap: 1300,
      managerA: "Bill",
      managerB: "Rival",
      mode: "dynasty",
      tradeWarModeOptions: ["dynasty", "contender"],
      allAssets,
      selectedAllIds: new Set([a1.player_id, b1.player_id, b2.player_id]),
    });

    expect(ideas.map(idea => idea.label)).toEqual(
      expect.arrayContaining([
        "Add Pick Sweetener",
        "Remove Overpay Piece",
        "Swap Target Down",
      ])
    );
    expect(ideas[0].gap).toBeLessThanOrEqual(650);
  });
});
