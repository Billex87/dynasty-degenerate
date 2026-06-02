import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import { getValidSleeperUserId } from "@/features/home/lib/sleeperIdentity";
import {
  getInitialReportLeagueIdFromUrl,
  getInitialReportTabFromUrl,
} from "@/features/home/lib/reportRouteState";
import {
  clearBrowserReportCache,
  getReportDataLeagueId,
  normalizeReportLeagueId,
} from "@/features/home/lib/reportCache";
import type {
  AnalysisLeaguePreview,
  SleeperLeagueOption,
} from "@/features/home/lib/leagueHistory";
import type { AnalysisLoadingLeague } from "@/features/report/components/ReportDialogs";
import type { ReportData } from "@shared/types";

type BeginAnalysisLoading = (
  nextLeagueId: string,
  extraKnownLeagues?: SleeperLeagueOption[]
) => Promise<void>;

type RestoreFreshCachedReportForLeague = (
  nextLeagueId: string,
  nextActiveTab?: string | null,
  nextViewerUserId?: string | null
) => Promise<boolean>;

type UseHomeReportIdentityRecoveryOptions = {
  activeTab: string;
  activeAnalysisLeagueIdRef: MutableRefObject<string | null>;
  beginAnalysisLoading: BeginAnalysisLoading;
  leagueId: string;
  reportData: ReportData | null;
  restoreFreshCachedReportForLeague: RestoreFreshCachedReportForLeague;
  userLeagues: SleeperLeagueOption[];
  viewerUserId: string | null;
  rememberLeagueId: (value: string) => void;
  onAnalyzeReport: (input: { leagueId: string; viewerUserId?: string }) => void;
  setActiveTab: Dispatch<SetStateAction<string>>;
  setAnalysisCompleteMessage: Dispatch<
    SetStateAction<AnalysisLoadingLeague | null>
  >;
  setLeagueId: Dispatch<SetStateAction<string>>;
  setPendingAnalysisLeague: Dispatch<
    SetStateAction<AnalysisLeaguePreview | null>
  >;
  setReportData: Dispatch<SetStateAction<ReportData | null>>;
  setReportDataCacheVersion: Dispatch<SetStateAction<string | null>>;
};

export function useHomeReportIdentityRecovery({
  activeTab,
  activeAnalysisLeagueIdRef,
  beginAnalysisLoading,
  leagueId,
  reportData,
  restoreFreshCachedReportForLeague,
  userLeagues,
  viewerUserId,
  rememberLeagueId,
  onAnalyzeReport,
  setActiveTab,
  setAnalysisCompleteMessage,
  setLeagueId,
  setPendingAnalysisLeague,
  setReportData,
  setReportDataCacheVersion,
}: UseHomeReportIdentityRecoveryOptions) {
  useEffect(() => {
    if (!reportData) return;
    let isCancelled = false;

    const recoverMismatchedReportIdentity = async () => {
      const urlLeagueId = getInitialReportLeagueIdFromUrl();
      const expectedLeagueId = normalizeReportLeagueId(urlLeagueId || leagueId);
      if (!expectedLeagueId) return;

      const currentLeagueId = normalizeReportLeagueId(leagueId);
      const reportDataLeagueId = getReportDataLeagueId(reportData);
      const urlMismatch = Boolean(urlLeagueId && currentLeagueId !== urlLeagueId);
      const reportMismatch = Boolean(
        reportDataLeagueId && reportDataLeagueId !== expectedLeagueId
      );
      if (!urlMismatch && !reportMismatch) return;

      const tab = getInitialReportTabFromUrl() || activeTab || "overview";
      clearBrowserReportCache(currentLeagueId || reportDataLeagueId);
      setReportData(null);
      setReportDataCacheVersion(null);
      setAnalysisCompleteMessage(null);
      setPendingAnalysisLeague(null);
      setLeagueId(expectedLeagueId);
      setActiveTab(tab);
      rememberLeagueId(expectedLeagueId);

      const restored = await restoreFreshCachedReportForLeague(
        expectedLeagueId,
        tab,
        viewerUserId
      );
      if (isCancelled || restored) return;

      await beginAnalysisLoading(expectedLeagueId, userLeagues);
      if (isCancelled || activeAnalysisLeagueIdRef.current !== expectedLeagueId) {
        return;
      }
      onAnalyzeReport({
        leagueId: expectedLeagueId,
        viewerUserId: getValidSleeperUserId(viewerUserId) || undefined,
      });
    };

    const handlePageShow = () => {
      void recoverMismatchedReportIdentity();
    };
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        void recoverMismatchedReportIdentity();
      }
    };

    void recoverMismatchedReportIdentity();
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      isCancelled = true;
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisible);
    };
    // The function dependencies are intentionally omitted so this guard runs
    // from report/URL identity state instead of rebinding on every mutation state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, leagueId, reportData, userLeagues, viewerUserId]);
}
