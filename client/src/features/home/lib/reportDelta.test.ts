import { describe, expect, it } from "vitest";

import {
  buildReportDeltaChanges,
  type ReportDeltaSnapshot,
} from "@/features/home/lib/reportDelta";

function createDeltaSnapshot(
  overrides: Partial<ReportDeltaSnapshot> = {}
): ReportDeltaSnapshot {
  return {
    schemaVersion: 1,
    leagueId: "league-1",
    leagueName: "Test League",
    savedAt: 1,
    valueMode: "dynasty",
    action: null,
    topRiser: null,
    topFaller: null,
    topWaiver: null,
    tradeCount: 0,
    transactionCount: 0,
    scheduleStatus: null,
    scheduleSignalCount: 0,
    aiConfidence: null,
    signature: "baseline",
    ...overrides,
  };
}

describe("report delta changes", () => {
  it("adds internal destinations to weekly return changes without provider copy", () => {
    const previous = createDeltaSnapshot({
      signature: "previous",
      action: {
        id: "old-action",
        source: "strategy",
        decision: "watch",
        label: "Old watch",
        action: "Track",
        target: "Old target",
        confidence: 42,
      },
      topRiser: {
        id: "old-riser",
        name: "Old Riser",
        position: "WR",
        team: "BUF",
        metricLabel: "+3%",
      },
      topWaiver: {
        id: "old-waiver",
        name: "Old Waiver",
        position: "TE",
        team: "NYG",
        metricLabel: "Old top available",
      },
      tradeCount: 0,
      transactionCount: 0,
    });
    const current = createDeltaSnapshot({
      signature: "current",
      action: {
        id: "new-waiver-action",
        source: "waiver",
        decision: "do",
        label: "Waiver queue",
        action: "Add",
        target: "Waiver Receiver",
        confidence: 76,
      },
      topRiser: {
        id: "new-riser",
        name: "Market Riser",
        position: "RB",
        team: "KC",
        metricLabel: "+8%",
      },
      topWaiver: {
        id: "new-waiver",
        name: "Waiver Receiver",
        position: "WR",
        team: "SEA",
        metricLabel: "Top available",
      },
      tradeCount: 2,
      transactionCount: 3,
    });

    const changes = buildReportDeltaChanges(previous, current);

    expect(changes.find(change => change.id === "action")?.destination).toMatchObject({
      tab: "momentum",
      sectionKey: "waiver-intelligence",
      buttonLabel: "Open Waiver Intelligence",
      focusText: "Waiver Receiver",
    });
    expect(changes.find(change => change.id === "waiver")?.destination).toMatchObject({
      tab: "momentum",
      sectionKey: "waiver-intelligence",
      buttonLabel: "Open Waiver Intelligence",
      focusText: "Waiver Receiver",
    });
    expect(changes.find(change => change.id === "transactions")?.destination).toMatchObject({
      tab: "momentum",
      sectionKey: "recent-transactions",
      buttonLabel: "Open Recent Transactions",
    });
    expect(changes.find(change => change.id === "trades")?.destination).toMatchObject({
      tab: "trades",
      sectionKey: "trade-war-room",
      buttonLabel: "Open Trade War Room",
    });
    expect(changes.find(change => change.id === "riser")?.destination).toMatchObject({
      tab: "momentum",
      sectionKey: "market-movers",
      buttonLabel: "Open Market Movers",
      focusText: "Market Riser",
    });
    expect(JSON.stringify(changes)).not.toMatch(
      /KTC|FantasyCalc|FantasyPros|DraftSharks|provider/i
    );
  });

  it("does not create an artificial action change for old snapshots without source", () => {
    const previous = createDeltaSnapshot({
      signature: "previous",
      action: {
        id: "same-action",
        decision: "watch",
        label: "Watch",
        action: "Track",
        target: "Waiver Receiver",
        confidence: 64,
      },
    });
    const current = createDeltaSnapshot({
      signature: "current",
      action: {
        id: "same-action",
        source: "waiver",
        decision: "watch",
        label: "Watch",
        action: "Track",
        target: "Waiver Receiver",
        confidence: 64,
      },
    });

    expect(buildReportDeltaChanges(previous, current)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "action",
        }),
      ])
    );
  });

  it("routes lineup action changes to the available rankings section", () => {
    const previous = createDeltaSnapshot({
      signature: "previous",
      action: {
        id: "old-action",
        source: "strategy",
        decision: "watch",
        label: "Watch",
        action: "Track",
        target: "Old target",
        confidence: 40,
      },
    });
    const current = createDeltaSnapshot({
      signature: "current",
      action: {
        id: "lineup-action",
        source: "lineup",
        decision: "hold",
        label: "Lineup check",
        action: "Verify role",
        target: "Sample Quarterback",
        confidence: 68,
      },
    });

    expect(
      buildReportDeltaChanges(previous, current, {
        hasLeaguemateScoutRows: true,
      }).find(change => change.id === "action")?.destination
    ).toMatchObject({
      tab: "rankings",
      sectionKey: "scout-leaguemates",
      buttonLabel: "Open Scout Leaguemates",
      focusText: "Sample Quarterback",
    });

    expect(
      buildReportDeltaChanges(previous, current).find(change => change.id === "action")
        ?.destination
    ).toMatchObject({
      tab: "rankings",
      sectionKey: "full-roster-rankings",
      buttonLabel: "Open Roster Rankings",
    });
  });
});
