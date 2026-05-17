import { describe, expect, it } from "vitest";
import type { ManagerIntelPlayer, TradeData } from "@shared/types";
import {
  buildTradeFairnessSuggestion,
  getTradeFairnessSuggestionCopy,
  type TradeLedgerEvaluation,
} from "./tradeLedgerUtils";

function valueTimeline(startValue: number, endValue: number) {
  return {
    profileKey: "test",
    source: "stored-value-snapshots" as const,
    points: [
      {
        date: "2026-05-01",
        value: startValue,
        sources: ["KTC", "FantasyCalc"],
        sourceCount: 2,
      },
      {
        date: "2026-05-11",
        value: endValue,
        sources: ["KTC", "FantasyCalc"],
        sourceCount: 2,
      },
    ],
    summary: {
      startValue,
      endValue,
      delta: endValue - startValue,
      deltaPct: Math.round(((endValue - startValue) / startValue) * 1000) / 10,
      sourceSetChanged: false,
      eventCount: 0,
      note: "test",
    },
  };
}

function player(
  player_id: string,
  name: string,
  value: number,
  timeline?: ReturnType<typeof valueTimeline>
): ManagerIntelPlayer {
  return {
    player_id,
    name,
    pos: "WR",
    owner: "Winner",
    value,
    currentPositionRank: "WR40",
    playerDetails: {
      playerId: player_id,
      fullName: name,
      position: "WR",
      valueTimeline: timeline,
    },
  };
}

function tradeRow(rosterPlayers: ManagerIntelPlayer[]): TradeData {
  return {
    date: "2026-05-01",
    season: "2026",
    team_a: "Winner",
    team_b: "Loser",
    team_a_items: "PLAYER:sent|Sent Player|2500",
    team_b_items: "PLAYER:received|Received Player|1500",
    team_a_total: 2500,
    team_b_total: 1500,
    point_gap: 1000,
    winner: "Winner",
    winners: ["Winner"],
    team_a_context: {
      mode: "dynasty",
      label: "Middle",
      contenderScore: 50,
      rebuildScore: 50,
      agingRisk: 20,
      avgAge: 25,
      starterSeasonValue: 0,
      totalValue: 0,
      source: "historical-roster",
      reason: "test",
      rosterPlayers,
    },
  };
}

function evaluation(pointGap = 1000): TradeLedgerEvaluation {
  return {
    teamA: {
      manager: "Winner",
      lens: { mode: "dynasty", label: "Middle", tone: "middle", reason: "test" },
      values: [2500],
      adjustment: 0,
      total: 2500,
    },
    teamB: {
      manager: "Loser",
      lens: { mode: "dynasty", label: "Middle", tone: "middle", reason: "test" },
      values: [1500],
      adjustment: 0,
      total: 1500,
    },
    pointGap,
    winners: ["Winner"],
  };
}

describe("trade fairness suggestions", () => {
  it("prefers non-riser make-whole assets over a closer validated riser", () => {
    const closeRiser = player("riser", "Close Riser", 1000, valueTimeline(1800, 2800));
    const cleanAsset = player("clean", "Clean Make-Whole", 1150);

    const suggestion = buildTradeFairnessSuggestion(
      tradeRow([closeRiser, cleanAsset]),
      evaluation(),
      "dynasty"
    );

    expect(suggestion?.assetKind).toBe("player");
    expect(suggestion?.player?.name).toBe("Clean Make-Whole");
    expect(suggestion?.valueCalibration).toBeNull();
  });

  it("keeps premium copy when a validated riser is the only controlled make-whole asset", () => {
    const onlyRiser = player("riser", "Only Riser", 1000, valueTimeline(1800, 2800));

    const suggestion = buildTradeFairnessSuggestion(
      tradeRow([onlyRiser]),
      evaluation(),
      "dynasty"
    );

    expect(suggestion?.player?.name).toBe("Only Riser");
    expect(suggestion?.valueCalibration?.outcome).toBe("confirmed-riser");
    expect(getTradeFairnessSuggestionCopy(suggestion!)).toContain(
      "premium make-whole ask"
    );
  });
});
