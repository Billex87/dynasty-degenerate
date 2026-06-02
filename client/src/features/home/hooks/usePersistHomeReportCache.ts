import { useEffect } from "react";

import {
  type LastLeague,
  REPORT_CACHE_DATA_VERSION,
  clearBrowserReportCache,
  getReportDataLeagueId,
  normalizeReportLeagueId,
  withReportDataLeagueId,
  writeBrowserReportCache,
} from "@/features/home/lib/reportCache";
import type { ReportData } from "@shared/types";

type UsePersistHomeReportCacheOptions = {
  activeTab: string;
  lastLeagueKey: string;
  leagueFormat: string;
  leagueId: string;
  leagueLogo: string | null;
  leagueName: string;
  reportData: ReportData | null;
};

export function usePersistHomeReportCache({
  activeTab,
  lastLeagueKey,
  leagueFormat,
  leagueId,
  leagueLogo,
  leagueName,
  reportData,
}: UsePersistHomeReportCacheOptions) {
  useEffect(() => {
    if (!reportData) return;
    const normalizedLeagueId = normalizeReportLeagueId(leagueId);
    const reportDataLeagueId = getReportDataLeagueId(reportData);
    if (
      !normalizedLeagueId ||
      (reportDataLeagueId && reportDataLeagueId !== normalizedLeagueId)
    ) {
      return;
    }
    const cacheReportData = withReportDataLeagueId(reportData, normalizedLeagueId);

    const lastLeague: LastLeague = {
      leagueId: normalizedLeagueId,
      leagueName,
      leagueLogo,
      leagueFormat,
      activeTab,
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(lastLeagueKey, JSON.stringify(lastLeague));
      writeBrowserReportCache({
        ...lastLeague,
        cacheVersion: REPORT_CACHE_DATA_VERSION,
        reportData: cacheReportData,
      });
    } catch {
      clearBrowserReportCache();
      try {
        localStorage.setItem(lastLeagueKey, JSON.stringify(lastLeague));
      } catch {
        localStorage.removeItem(lastLeagueKey);
      }
    }
  }, [
    activeTab,
    lastLeagueKey,
    leagueFormat,
    leagueId,
    leagueLogo,
    leagueName,
    reportData,
  ]);
}
