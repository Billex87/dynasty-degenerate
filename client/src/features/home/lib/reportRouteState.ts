export const REPORT_TAB_VALUES = [
  "overview",
  "autopilot",
  "momentum",
  "rankings",
  "trades",
  "draft",
  "hacks",
] as const;

export function normalizeReportTab(value?: string | null): string | null {
  const normalized = String(value || "")
    .replace(/^#/, "")
    .replace(/^tab=/, "")
    .trim()
    .toLowerCase();
  const aliases: Record<string, (typeof REPORT_TAB_VALUES)[number]> = {
    pulse: "momentum",
    rank: "rankings",
    trade: "trades",
    drafts: "draft",
    hack: "hacks",
    admin: "hacks",
  };
  const canonical = aliases[normalized] || normalized;
  return REPORT_TAB_VALUES.includes(
    canonical as (typeof REPORT_TAB_VALUES)[number]
  )
    ? canonical
    : null;
}

export function getInitialReportTabFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hashTab = normalizeReportTab(window.location.hash);
  if (hashTab) return hashTab;
  return normalizeReportTab(new URLSearchParams(window.location.search).get("tab"));
}

export function getInitialReportLeagueIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get("leagueId") || params.get("league");
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function updateReportTabUrl(tab: string, leagueId?: string | null) {
  if (typeof window === "undefined") return;
  const normalizedTab = normalizeReportTab(tab) || "overview";
  const params = new URLSearchParams(window.location.search);
  params.delete("tab");
  if (leagueId !== undefined) {
    const normalizedLeagueId = String(leagueId || "").trim();
    if (normalizedLeagueId) {
      params.set("leagueId", normalizedLeagueId);
    } else {
      params.delete("leagueId");
      params.delete("league");
    }
  }

  const nextSearch = params.toString();
  const nextHash = normalizedTab === "overview" ? "" : `#${normalizedTab}`;
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${nextHash}`;
  window.history.replaceState(null, "", nextUrl);
}

type HomeReportTabStateInput = {
  activeTab: string;
  canViewAutopilotTab: boolean;
  canViewHacksTab: boolean;
  shouldShowDraftHistoryTab: boolean;
  isAuthLoading: boolean;
};

export function buildHomeReportTabState({
  activeTab,
  canViewAutopilotTab,
  canViewHacksTab,
  shouldShowDraftHistoryTab,
  isAuthLoading,
}: HomeReportTabStateInput) {
  const migratedActiveTab = activeTab === "projections" ? "rankings" : activeTab;
  const shouldDeferAutopilotUrlSync =
    migratedActiveTab === "autopilot" &&
    !canViewAutopilotTab &&
    isAuthLoading;
  const resolvedActiveTab =
    migratedActiveTab === "draft" && !shouldShowDraftHistoryTab
      ? "overview"
      : migratedActiveTab === "hacks" && !canViewHacksTab
        ? "overview"
      : migratedActiveTab === "autopilot" && !canViewAutopilotTab
        ? "overview"
        : migratedActiveTab;
  const visibleReportTabCount =
    4 +
    (canViewAutopilotTab ? 1 : 0) +
    (shouldShowDraftHistoryTab ? 1 : 0) +
    (canViewHacksTab ? 1 : 0);
  const tabCountLabel =
    visibleReportTabCount === 7
      ? "seven"
      : visibleReportTabCount === 6
        ? "six"
        : visibleReportTabCount === 5
          ? "five"
          : "four";
  const reportTabsClassName = `report-tabs report-tabs-${tabCountLabel}`;
  const visibleReportTabIds = [
    "overview",
    ...(canViewAutopilotTab ? ["autopilot"] : []),
    "momentum",
    "rankings",
    "trades",
    ...(shouldShowDraftHistoryTab ? ["draft"] : []),
    ...(canViewHacksTab ? ["hacks"] : []),
  ];
  const resolvedReportTabIndex = Math.max(
    0,
    visibleReportTabIds.indexOf(resolvedActiveTab)
  );

  return {
    migratedActiveTab,
    shouldDeferAutopilotUrlSync,
    resolvedActiveTab,
    visibleReportTabCount,
    reportTabsClassName,
    visibleReportTabIds,
    resolvedReportTabIndex,
  };
}
