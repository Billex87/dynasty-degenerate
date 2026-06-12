import { describe, expect, it } from "vitest";

import {
  getReportNextMoveDestination,
  type ReportNextMoveDestination,
} from "@/features/report/lib/reportNextMoveBrief";
import type { AIActionQueueItem } from "@/lib/autopilot/types";
import type { ReportData } from "@shared/types";

function createActionItem(
  source: AIActionQueueItem["source"]
): AIActionQueueItem {
  return { source, target: "Focus Player" } as AIActionQueueItem;
}

function expectDestination(
  source: AIActionQueueItem["source"],
  expected: Partial<ReportNextMoveDestination>,
  options: {
    reportData?: ReportData;
    canViewAdminFeatureExpansion?: boolean;
  } = {}
) {
  expect(
    getReportNextMoveDestination({
      item: createActionItem(source),
      ...options,
    })
  ).toMatchObject(expected);
}

describe("getReportNextMoveDestination", () => {
  it("routes public waiver and trade actions to their actionable report tabs", () => {
    expectDestination("waiver", {
      tab: "momentum",
      sectionKey: "waiver-intelligence",
      buttonLabel: "Open Waiver Intelligence",
      focusText: "Focus Player",
    });

    expectDestination("trade", {
      tab: "trades",
      sectionKey: "trade-war-room",
      buttonLabel: "Open Trade War Room",
      focusText: "Focus Player",
    });
  });

  it("routes lineup actions to the best public roster surface", () => {
    expectDestination("lineup", {
      tab: "rankings",
      sectionKey: "full-roster-rankings",
      buttonLabel: "Open Roster Rankings",
    });

    expectDestination(
      "lineup",
      {
        tab: "rankings",
        sectionKey: "scout-leaguemates",
        buttonLabel: "Open Scout Leaguemates",
      },
      {
        reportData: {
          managerRosterIntelligence: [{}],
        } as ReportData,
      }
    );
  });

  it("keeps strategy actions on public overview intel unless admin expansion is available", () => {
    expectDestination("strategy", {
      tab: "overview",
      sectionKey: "owner-intel",
      buttonLabel: "Open Owner Intel",
    });

    expectDestination(
      "strategy",
      {
        tab: "overview",
        sectionKey: "monthly-team-blueprint",
        buttonLabel: "Open Monthly Blueprint",
      },
      { canViewAdminFeatureExpansion: true }
    );
  });
});
