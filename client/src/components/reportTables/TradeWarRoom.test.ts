import { describe, expect, it } from "vitest";
import type { ManagerIntelPlayer } from "@shared/types";
import { buildTradeWarPackageIdeas, buildTradeWarValueMatchIdeas } from "./TradeWarRoom";

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

describe("buildTradeWarValueMatchIdeas", () => {
  it("suggests the closest single player or pick from the trade partner", () => {
    const target = asset("a1", "Depth Receiver", "Bill", 3000);
    const closePick = asset("pick-b", "2026 1st", "Rival", 2950, {
      pos: "PICK",
      assetState: "pick",
      assetKind: "pick",
    });
    const farPlayer = asset("b1", "Star Receiver", "Rival", 6200);
    const cheapPlayer = asset("b2", "Bench Receiver", "Rival", 1200);

    const ideas = buildTradeWarValueMatchIdeas({
      targetManager: "Bill",
      sourceManager: "Rival",
      targetAssets: [target],
      sourceAssets: [farPlayer, closePick, cheapPlayer],
      selectedAllIds: new Set([target.player_id]),
      mode: "dynasty",
    });

    expect(ideas[0]).toMatchObject({
      label: "2026 1st",
      targetValue: 3000,
      totalValue: 2950,
      gap: 50,
    });
    expect(ideas[0].assets.map(row => row.player_id)).toEqual(["pick-b"]);
  });

  it("can rank a two-piece package ahead of a worse single-asset match", () => {
    const target = asset("a1", "Premium Target", "Bill", 3000);
    const playerPiece = asset("b1", "Young Back", "Rival", 1800, {
      pos: "RB",
    });
    const pickPiece = asset("pick-b", "2027 2nd", "Rival", 1150, {
      pos: "PICK",
      assetState: "pick",
      assetKind: "pick",
    });
    const singleMiss = asset("b2", "Veteran Receiver", "Rival", 2500);

    const ideas = buildTradeWarValueMatchIdeas({
      targetManager: "Bill",
      sourceManager: "Rival",
      targetAssets: [target],
      sourceAssets: [playerPiece, pickPiece, singleMiss],
      selectedAllIds: new Set([target.player_id]),
      mode: "dynasty",
    });

    expect(ideas[0]).toMatchObject({
      label: "Young Back + 2027 2nd",
      totalValue: 2950,
      gap: 50,
    });
    expect(ideas[0].assets.map(row => row.player_id)).toEqual(["b1", "pick-b"]);
  });

  it("does not suggest assets already selected in the trade", () => {
    const target = asset("a1", "Target Receiver", "Bill", 3000);
    const alreadySelected = asset("b1", "Selected Receiver", "Rival", 3000);
    const fallback = asset("b2", "Fallback Receiver", "Rival", 2700);

    const ideas = buildTradeWarValueMatchIdeas({
      targetManager: "Bill",
      sourceManager: "Rival",
      targetAssets: [target],
      sourceAssets: [alreadySelected, fallback],
      selectedAllIds: new Set([target.player_id, alreadySelected.player_id]),
      mode: "dynasty",
    });

    expect(ideas[0].assets.map(row => row.player_id)).toEqual(["b2"]);
  });
});
