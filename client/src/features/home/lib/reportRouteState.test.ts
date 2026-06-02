import { describe, expect, it } from "vitest";

import { buildHomeReportTabState, normalizeReportTab } from "./reportRouteState";

describe("reportRouteState", () => {
  it("normalizes legacy and shorthand tab names", () => {
    expect(normalizeReportTab("#rank")).toBe("rankings");
    expect(normalizeReportTab("tab=trade")).toBe("trades");
    expect(normalizeReportTab("drafts")).toBe("draft");
    expect(normalizeReportTab("unknown")).toBeNull();
  });

  it("migrates the retired projections tab to rankings", () => {
    const state = buildHomeReportTabState({
      activeTab: "projections",
      canViewAutopilotTab: false,
      shouldShowDraftHistoryTab: true,
      isAuthLoading: false,
    });

    expect(state.migratedActiveTab).toBe("rankings");
    expect(state.resolvedActiveTab).toBe("rankings");
    expect(state.resolvedReportTabIndex).toBe(2);
  });

  it("keeps autopilot deferred while auth is loading, then resolves to overview when blocked", () => {
    const loadingState = buildHomeReportTabState({
      activeTab: "autopilot",
      canViewAutopilotTab: false,
      shouldShowDraftHistoryTab: true,
      isAuthLoading: true,
    });
    expect(loadingState.shouldDeferAutopilotUrlSync).toBe(true);
    expect(loadingState.resolvedActiveTab).toBe("overview");

    const settledState = buildHomeReportTabState({
      activeTab: "autopilot",
      canViewAutopilotTab: false,
      shouldShowDraftHistoryTab: true,
      isAuthLoading: false,
    });
    expect(settledState.shouldDeferAutopilotUrlSync).toBe(false);
    expect(settledState.resolvedActiveTab).toBe("overview");
  });

  it("hides draft when the report has no draft data", () => {
    const state = buildHomeReportTabState({
      activeTab: "draft",
      canViewAutopilotTab: true,
      shouldShowDraftHistoryTab: false,
      isAuthLoading: false,
    });

    expect(state.resolvedActiveTab).toBe("overview");
    expect(state.visibleReportTabIds).toEqual([
      "overview",
      "autopilot",
      "momentum",
      "rankings",
      "trades",
    ]);
    expect(state.visibleReportTabCount).toBe(5);
    expect(state.reportTabsClassName).toBe("report-tabs report-tabs-five");
  });

  it("reports six visible tabs when admin and draft history are both available", () => {
    const state = buildHomeReportTabState({
      activeTab: "draft",
      canViewAutopilotTab: true,
      shouldShowDraftHistoryTab: true,
      isAuthLoading: false,
    });

    expect(state.visibleReportTabCount).toBe(6);
    expect(state.reportTabsClassName).toBe("report-tabs report-tabs-six");
    expect(state.resolvedActiveTab).toBe("draft");
    expect(state.resolvedReportTabIndex).toBe(5);
  });
});
