import { describe, expect, it } from "vitest";

import { getReportNextMoveItems } from "@/features/report/lib/reportNextMoveBrief";
import {
  SAMPLE_REPORT_LEAGUE_ID,
  createSampleReportData,
} from "@/features/home/lib/sampleReport";

describe("sample report", () => {
  it("generates a provider-clean public next move", () => {
    const reportData = createSampleReportData();
    const items = getReportNextMoveItems({
      reportData,
      leagueValueMode: "dynasty",
      leagueId: SAMPLE_REPORT_LEAGUE_ID,
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.target).toBeTruthy();
    expect(JSON.stringify(items)).not.toMatch(
      /KTC|FantasyCalc|FantasyPros|DraftSharks|Sleeper/i
    );
  });
});
