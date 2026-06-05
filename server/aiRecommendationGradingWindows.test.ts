import { describe, expect, it } from "vitest";
import { buildAIRecommendationGradingWindow, parseAIRecommendationGradingWindow } from "../shared/aiRecommendationGradingWindows";

describe("AI recommendation grading windows", () => {
  it("holds redraft season recommendations until end-of-season evidence is available", () => {
    const window = buildAIRecommendationGradingWindow({
      createdAt: "2026-09-01T00:00:00.000Z",
      season: "2026",
      surface: "overview",
      action: "watch",
      entityType: "manager",
      valueMode: "redraft",
      recommendationType: "roster construction",
      actionText: "Draft path can carry final standings and playoff finish",
    });

    expect(window).toMatchObject({
      schemaVersion: 1,
      kind: "redraft-season",
      label: "Redraft season recommendation",
      minimumFinalGradeAt: "2027-01-15T12:00:00.000Z",
      expiresAt: "2027-01-15T12:00:00.000Z",
      evidenceRequired: expect.arrayContaining([
        "final standings",
        "playoff finish",
        "points for",
        "roster usage",
        "title outcome",
      ]),
    });
  });

  it("holds dynasty draft recommendations for a two-year outcome window", () => {
    const window = buildAIRecommendationGradingWindow({
      createdAt: "2026-05-15T00:00:00.000Z",
      season: "2026",
      surface: "rankings",
      action: "watch",
      entityType: "player",
      valueMode: "dynasty",
      recommendationType: "rookie draft pick",
      actionText: "Dynasty rookie draft recommendation",
    });

    expect(window).toMatchObject({
      kind: "dynasty-draft-two-year",
      minimumFinalGradeAt: "2028-01-15T12:00:00.000Z",
      evidenceRequired: expect.arrayContaining([
        "two-year player value movement",
        "two-year roster usage",
      ]),
    });
  });

  it("parses captured grading-window metadata conservatively", () => {
    expect(parseAIRecommendationGradingWindow({
      schemaVersion: 1,
      kind: "redraft-season",
      label: "Redraft season recommendation",
      minimumFinalGradeAt: "2027-01-15T12:00:00.000Z",
      expiresAt: "bad-date",
      evidenceRequired: ["final standings", ""],
      reason: "Captured policy",
    })).toMatchObject({
      kind: "redraft-season",
      minimumFinalGradeAt: "2027-01-15T12:00:00.000Z",
      expiresAt: null,
      evidenceRequired: ["final standings"],
    });

    expect(parseAIRecommendationGradingWindow({ schemaVersion: 1, kind: "unknown" })).toBeNull();
  });
});
