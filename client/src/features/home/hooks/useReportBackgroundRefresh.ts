import { useEffect, useRef, useState } from "react";

import { REPORT_CACHE_DATA_VERSION } from "@/features/home/lib/reportCache";
import type { ReportData } from "@shared/types";

type UseReportBackgroundRefreshOptions = {
  reportData: ReportData | null;
  leagueId: string;
  reportDataCacheVersion: string | null;
  isLoading: boolean;
  isReportRefreshing: boolean;
  viewerUserId: string | null;
  refreshAfterMs: number;
  prefetchDebounceMs: number;
  onRefreshReport: (leagueId: string, viewerUserId?: string | null) => void;
};

export function useReportBackgroundRefresh({
  reportData,
  leagueId,
  reportDataCacheVersion,
  isLoading,
  isReportRefreshing,
  viewerUserId,
  refreshAfterMs,
  prefetchDebounceMs,
  onRefreshReport,
}: UseReportBackgroundRefreshOptions) {
  const [reportScanCompletedAt, setReportScanCompletedAt] = useState<
    number | null
  >(null);
  const onRefreshReportRef = useRef(onRefreshReport);

  useEffect(() => {
    onRefreshReportRef.current = onRefreshReport;
  }, [onRefreshReport]);

  useEffect(() => {
    setReportScanCompletedAt(reportData ? Date.now() : null);
  }, [reportData]);

  useEffect(() => {
    if (
      !reportData ||
      !leagueId ||
      reportDataCacheVersion !== REPORT_CACHE_DATA_VERSION ||
      isLoading ||
      isReportRefreshing
    ) {
      return;
    }

    const getAgeMs = () => Date.now() - (reportScanCompletedAt || Date.now());
    const refreshIfNeeded = () => {
      if (getAgeMs() < refreshAfterMs) return;
      onRefreshReportRef.current(leagueId, viewerUserId);
    };
    const delay = Math.max(
      refreshAfterMs - getAgeMs(),
      prefetchDebounceMs
    );
    const timer = window.setTimeout(refreshIfNeeded, delay);
    const handleVisible = () => {
      if (document.visibilityState === "visible") refreshIfNeeded();
    };
    window.addEventListener("focus", refreshIfNeeded);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshIfNeeded);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [
    isLoading,
    isReportRefreshing,
    leagueId,
    prefetchDebounceMs,
    refreshAfterMs,
    reportData,
    reportDataCacheVersion,
    reportScanCompletedAt,
    viewerUserId,
  ]);
}
