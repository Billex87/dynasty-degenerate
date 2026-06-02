import { useEffect, type Dispatch, type SetStateAction } from "react";

import {
  REPORT_CACHE_DATA_VERSION,
  STALE_REPORT_CACHE_KEYS,
  clearBrowserReportCache,
} from "@/features/home/lib/reportCache";
import type { AnalysisLoadingLeague } from "@/features/report/components/ReportDialogs";
import type { ReportData } from "@shared/types";

type UseStaleReportCacheRefreshOptions = {
  reportData: ReportData | null;
  reportDataCacheVersion: string | null;
  leagueId: string;
  isLoading: boolean;
  viewerUserId: string | null;
  setReportDataCacheVersion: Dispatch<SetStateAction<string | null>>;
  setAnalysisCompleteMessage: Dispatch<SetStateAction<AnalysisLoadingLeague | null>>;
  onRefreshReport: (leagueId: string, viewerUserId?: string | null) => void;
};

export function useStaleReportCacheRefresh({
  reportData,
  reportDataCacheVersion,
  leagueId,
  isLoading,
  viewerUserId,
  setReportDataCacheVersion,
  setAnalysisCompleteMessage,
  onRefreshReport,
}: UseStaleReportCacheRefreshOptions) {
  useEffect(() => {
    if (
      !reportData ||
      reportDataCacheVersion === REPORT_CACHE_DATA_VERSION ||
      !leagueId ||
      isLoading
    )
      return;

    clearBrowserReportCache(leagueId);
    STALE_REPORT_CACHE_KEYS.forEach(key => localStorage.removeItem(key));
    setReportDataCacheVersion(null);
    setAnalysisCompleteMessage(null);
    onRefreshReport(leagueId, viewerUserId);
    // This intentionally runs when a preserved React Fast Refresh state has report data
    // from an older browser cache version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData, reportDataCacheVersion, leagueId, isLoading, viewerUserId]);
}
