import { describe, expect, it } from "vitest";
import {
  summarizeFantasyProsExpertSpread,
  summarizeFantasyProsExpertSpreadRows,
} from "@shared/fantasyProsExpertSpread";

describe("FantasyPros expert spread", () => {
  it("labels tight expert agreement as stable consensus", () => {
    expect(
      summarizeFantasyProsExpertSpread({
        bestRank: 22,
        worstRank: 30,
        averageRank: 25,
        rankStdDev: 6,
      })
    ).toMatchObject({
      tone: "stable",
      label: "Stable consensus",
      confidenceAdjustment: 6,
      range: 8,
      stdDev: 6,
    });
  });

  it("labels high disagreement as a wide expert range", () => {
    expect(
      summarizeFantasyProsExpertSpread({
        bestRank: 10,
        worstRank: 55,
        averageRank: 24,
        rankStdDev: 19,
      })
    ).toMatchObject({
      tone: "wide",
      label: "Wide expert range",
      confidenceAdjustment: -10,
      range: 45,
      stdDev: 19,
    });
  });

  it("lets wide rows dominate stable rows in a multi-week summary", () => {
    expect(
      summarizeFantasyProsExpertSpreadRows([
        { bestRank: 24, worstRank: 30, averageRank: 26, rankStdDev: 5 },
        { bestRank: 8, worstRank: 49, averageRank: 28, rankStdDev: 16 },
      ])
    ).toMatchObject({
      tone: "wide",
      label: "Wide expert range",
      confidenceAdjustment: -10,
    });
  });
});
