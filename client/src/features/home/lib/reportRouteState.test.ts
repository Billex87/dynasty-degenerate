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
      canViewHacksTab: false,
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
      canViewHacksTab: false,
      shouldShowDraftHistoryTab: true,
      isAuthLoading: true,
    });
    expect(loadingState.shouldDeferAutopilotUrlSync).toBe(true);
    expect(loadingState.resolvedActiveTab).toBe("overview");

    const settledState = buildHomeReportTabState({
      activeTab: "autopilot",
      canViewAutopilotTab: false,
      canViewHacksTab: false,
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
      canViewHacksTab: false,
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
      canViewHacksTab: false,
      shouldShowDraftHistoryTab: true,
      isAuthLoading: false,
    });

    expect(state.visibleReportTabCount).toBe(6);
    expect(state.reportTabsClassName).toBe("report-tabs report-tabs-six");
    expect(state.resolvedActiveTab).toBe("draft");
    expect(state.resolvedReportTabIndex).toBe(5);
  });

  it("adds Hacks only when admin diagnostics are available", () => {
    const blockedState = buildHomeReportTabState({
      activeTab: "hacks",
      canViewAutopilotTab: true,
      canViewHacksTab: false,
      shouldShowDraftHistoryTab: true,
      isAuthLoading: false,
    });
    expect(blockedState.resolvedActiveTab).toBe("overview");
    expect(blockedState.visibleReportTabIds).not.toContain("hacks");

    const adminState = buildHomeReportTabState({
      activeTab: "hacks",
      canViewAutopilotTab: true,
      canViewHacksTab: true,
      shouldShowDraftHistoryTab: true,
      isAuthLoading: false,
    });
    expect(adminState.resolvedActiveTab).toBe("hacks");
    expect(adminState.visibleReportTabIds).toEqual([
      "overview",
      "autopilot",
      "momentum",
      "rankings",
      "trades",
      "draft",
      "hacks",
    ]);
    expect(adminState.visibleReportTabCount).toBe(7);
    expect(adminState.reportTabsClassName).toBe("report-tabs report-tabs-seven");
    expect(adminState.resolvedReportTabIndex).toBe(6);
  });
});
