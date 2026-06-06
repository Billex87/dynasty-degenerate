import type { CSSProperties } from "react";

import { buildLeagueFormatPills } from "@/features/report/lib/reportOverviewPreview";
import { getLeagueFallbackInitials } from "@/features/home/lib/leagueIdentity";
import { getFilteredAutocompleteOptions } from "@/features/home/lib/inputHelpers";
import { buildHomeReportTabState } from "@/features/home/lib/reportRouteState";
import { hasDraftReportData } from "@/features/home/lib/reportCache";
import type { AnalysisLeaguePreview } from "@/features/home/lib/leagueHistory";
import type {
  AnalysisLoadingLeague,
  LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import type { ReportData } from "@shared/types";

type UseHomeViewStateOptions = {
  activeTab: string;
  analysisCompleteMessage: AnalysisLoadingLeague | null;
  canViewAdminDiagnostics: boolean;
  canViewAdminFeatureExpansion: boolean;
  isAuthLoading: boolean;
  leagueFormat: string;
  leagueId: string;
  leagueIdHistory: string[];
  leagueLogo: string | null;
  leagueName: string;
  loadingTransitionPhase: LoadingTransitionPhase;
  pendingAnalysisLeague: AnalysisLeaguePreview | null;
  reportData: ReportData | null;
  sleeperUsername: string;
  sleeperUsernameHistory: string[];
};

export function useHomeViewState({
  activeTab,
  analysisCompleteMessage,
  canViewAdminDiagnostics,
  canViewAdminFeatureExpansion,
  isAuthLoading,
  leagueFormat,
  leagueId,
  leagueIdHistory,
  leagueLogo,
  leagueName,
  loadingTransitionPhase,
  pendingAnalysisLeague,
  reportData,
  sleeperUsername,
  sleeperUsernameHistory,
}: UseHomeViewStateOptions) {
  const usernameAutocompleteOptions = getFilteredAutocompleteOptions(
    sleeperUsernameHistory,
    sleeperUsername
  );
  const leagueIdAutocompleteOptions = getFilteredAutocompleteOptions(
    leagueIdHistory,
    leagueId
  );
  const canViewAutopilotTab = canViewAdminFeatureExpansion;
  const tabLeagueValueMode = normalizeLeagueValueMode(
    reportData?.leagueDiagnostics?.valueMode || reportData?.leagueValueMode
  );
  const shouldShowDraftHistoryTab =
    tabLeagueValueMode !== "redraft" || hasDraftReportData(reportData);
  const {
    resolvedActiveTab,
    visibleReportTabCount,
    reportTabsClassName,
    resolvedReportTabIndex,
    shouldDeferAutopilotUrlSync,
  } = buildHomeReportTabState({
    activeTab,
    canViewAutopilotTab,
    canViewHacksTab: canViewAdminDiagnostics,
    shouldShowDraftHistoryTab,
    isAuthLoading,
  });
  const reportTabsStyle = {
    width: "100%",
    "--dd-report-tab-count": String(visibleReportTabCount),
    "--dd-report-tab-index": String(resolvedReportTabIndex),
  } as CSSProperties;

  const loadingLeague =
    analysisCompleteMessage ||
    pendingAnalysisLeague ||
    (leagueName || leagueFormat || leagueLogo
      ? { leagueName, leagueFormat, leagueLogo }
      : null);
  const isLoadingRevealPhase =
    loadingTransitionPhase === "reveal" || loadingTransitionPhase === "kick";
  const leagueFormatPills = buildLeagueFormatPills(
    leagueFormat,
    reportData?.leagueDiagnostics,
    reportData?.leagueDiagnostics?.valueMode || reportData?.leagueValueMode
  );
  const leagueLogoInitials = getLeagueFallbackInitials(leagueName);

  return {
    canViewAutopilotTab,
    isLoadingRevealPhase,
    leagueFormatPills,
    leagueIdAutocompleteOptions,
    leagueLogoInitials,
    loadingLeague,
    reportTabsClassName,
    reportTabsStyle,
    resolvedActiveTab,
    shouldDeferAutopilotUrlSync,
    shouldShowDraftHistoryTab,
    usernameAutocompleteOptions,
  };
}
