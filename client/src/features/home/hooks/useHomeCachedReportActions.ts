import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import { rememberAutocompleteValue } from "@/features/home/lib/inputHelpers";
import { updateReportTabUrl } from "@/features/home/lib/reportRouteState";
import {
  clearBrowserReportCache,
  isUsableCachedReport,
  normalizeCachedReportLeagueIdentity,
  readBrowserReportCache,
  shouldBackgroundRefreshCachedReport,
  REPORT_CACHE_DATA_VERSION,
  type CachedReport,
} from "@/features/home/lib/reportCache";
import type {
  ReportAnalysisMode,
  ReportLoadTelemetryEvent,
} from "@/features/home/lib/adminSessionState";
import type { AnalysisLeaguePreview } from "@/features/home/lib/leagueHistory";
import type {
  AnalysisLoadingLeague,
  LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import { getValidSleeperUserId } from "@/features/home/lib/sleeperIdentity";
import { sanitizeCachedReport } from "@/lib/reportCacheSanitizer";
import type { ReportData } from "@shared/types";

type AnalyzeReportInput = {
  leagueId: string;
  viewerUserId?: string;
};

type QueueReportVisibleTelemetry = (
  event: Omit<ReportLoadTelemetryEvent, "createdAt" | "visibleMs">
) => void;

type UseHomeCachedReportActionsOptions = {
  analysisModeRef: MutableRefObject<ReportAnalysisMode>;
  activeAnalysisLeagueIdRef: MutableRefObject<string | null>;
  backgroundRefreshLeagueIdRef: MutableRefObject<string | null>;
  lastBackgroundRefreshAtRef: MutableRefObject<Record<string, number>>;
  leagueIdHistoryKey: string;
  prefetchDebounceMs: number;
  queueReportVisibleTelemetry: QueueReportVisibleTelemetry;
  onAnalyzeReport: (input: AnalyzeReportInput) => void;
  setActiveTab: Dispatch<SetStateAction<string>>;
  setAnalysisCompleteMessage: Dispatch<
    SetStateAction<AnalysisLoadingLeague | null>
  >;
  setAnalysisErrorMessage: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setIsReportRefreshing: Dispatch<SetStateAction<boolean>>;
  setLeagueFormat: Dispatch<SetStateAction<string>>;
  setLeagueId: Dispatch<SetStateAction<string>>;
  setLeagueIdHistory: Dispatch<SetStateAction<string[]>>;
  setLeagueLogo: Dispatch<SetStateAction<string | null>>;
  setLeagueName: Dispatch<SetStateAction<string>>;
  setLoadingTransitionPhase: Dispatch<SetStateAction<LoadingTransitionPhase>>;
  setPendingAnalysisLeague: Dispatch<
    SetStateAction<AnalysisLeaguePreview | null>
  >;
  setReportData: Dispatch<SetStateAction<ReportData | null>>;
  setReportDataCacheVersion: Dispatch<SetStateAction<string | null>>;
};

export function useHomeCachedReportActions({
  activeAnalysisLeagueIdRef,
  analysisModeRef,
  backgroundRefreshLeagueIdRef,
  lastBackgroundRefreshAtRef,
  leagueIdHistoryKey,
  prefetchDebounceMs,
  queueReportVisibleTelemetry,
  onAnalyzeReport,
  setActiveTab,
  setAnalysisCompleteMessage,
  setAnalysisErrorMessage,
  setIsLoading,
  setIsReportRefreshing,
  setLeagueFormat,
  setLeagueId,
  setLeagueIdHistory,
  setLeagueLogo,
  setLeagueName,
  setLoadingTransitionPhase,
  setPendingAnalysisLeague,
  setReportData,
  setReportDataCacheVersion,
}: UseHomeCachedReportActionsOptions) {
  const applyCachedReport = (
    cachedReport: CachedReport,
    nextActiveTab?: string | null
  ) => {
    const sanitizedReport = normalizeCachedReportLeagueIdentity(
      sanitizeCachedReport(cachedReport)
    );
    if (!isUsableCachedReport(sanitizedReport, sanitizedReport.leagueId)) {
      clearBrowserReportCache(sanitizedReport.leagueId);
      return;
    }
    const tab = nextActiveTab || sanitizedReport.activeTab || "overview";
    setLeagueId(sanitizedReport.leagueId);
    setLeagueName(sanitizedReport.leagueName);
    setLeagueLogo(sanitizedReport.leagueLogo);
    setLeagueFormat(sanitizedReport.leagueFormat);
    setActiveTab(tab);
    setReportDataCacheVersion(
      sanitizedReport.cacheVersion || REPORT_CACHE_DATA_VERSION
    );
    setReportData(sanitizedReport.reportData);
    setAnalysisCompleteMessage(null);
    setAnalysisErrorMessage(null);
    setPendingAnalysisLeague(null);
    setLoadingTransitionPhase("done");
    setIsLoading(false);
    updateReportTabUrl(tab, sanitizedReport.leagueId);
    setLeagueIdHistory(
      rememberAutocompleteValue(leagueIdHistoryKey, sanitizedReport.leagueId)
    );
  };

  const refreshReportInBackground = (
    nextLeagueId: string,
    nextViewerUserId?: string | null
  ) => {
    const normalizedLeagueId = nextLeagueId.trim();
    if (!normalizedLeagueId) return;
    const lastRefreshAt =
      lastBackgroundRefreshAtRef.current[normalizedLeagueId] || 0;
    if (Date.now() - lastRefreshAt < prefetchDebounceMs) return;
    lastBackgroundRefreshAtRef.current[normalizedLeagueId] = Date.now();
    analysisModeRef.current = "background";
    backgroundRefreshLeagueIdRef.current = normalizedLeagueId;
    activeAnalysisLeagueIdRef.current = normalizedLeagueId;
    setIsReportRefreshing(true);
    onAnalyzeReport({
      leagueId: normalizedLeagueId,
      viewerUserId: getValidSleeperUserId(nextViewerUserId) || undefined,
    });
  };

  const restoreFreshCachedReportForLeague = async (
    nextLeagueId: string,
    nextActiveTab?: string | null,
    nextViewerUserId?: string | null
  ) => {
    const cachedReport = await readBrowserReportCache(nextLeagueId);
    if (!cachedReport || !isUsableCachedReport(cachedReport, nextLeagueId)) {
      return false;
    }
    applyCachedReport(cachedReport, nextActiveTab);
    queueReportVisibleTelemetry({
      leagueId: cachedReport.leagueId,
      leagueName: cachedReport.leagueName,
      activeTab: nextActiveTab || cachedReport.activeTab || "overview",
      source: "browser-cache",
      cacheStatus: "browser",
      requestMs: null,
      payloadVersion: cachedReport.cacheVersion || REPORT_CACHE_DATA_VERSION,
    });
    if (shouldBackgroundRefreshCachedReport(cachedReport)) {
      refreshReportInBackground(cachedReport.leagueId, nextViewerUserId);
    }
    return true;
  };

  return {
    applyCachedReport,
    refreshReportInBackground,
    restoreFreshCachedReportForLeague,
  };
}
