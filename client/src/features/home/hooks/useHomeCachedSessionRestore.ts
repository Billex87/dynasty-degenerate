import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import {
  getKtcAdminIdentity,
  normalizeAdminViewMode,
  type AdminViewMode,
} from "@/features/home/lib/adminMode";
import { rememberAutocompleteValue } from "@/features/home/lib/inputHelpers";
import {
  getInitialReportLeagueIdFromUrl,
  getInitialReportTabFromUrl,
} from "@/features/home/lib/reportRouteState";
import { getValidSleeperUserId } from "@/features/home/lib/sleeperIdentity";
import {
  clearBrowserReportCache,
  isFreshTimestamp,
  isUsableCachedReport,
  readBrowserReportCache,
  shouldBackgroundRefreshCachedReport,
  REPORT_CACHE_DATA_VERSION,
  type CachedReport,
  type LastLeague,
  type SleeperSession,
} from "@/features/home/lib/reportCache";
import {
  buildCachedSleeperUser,
  rememberCachedSleeperUser,
  type CachedSleeperUser,
  type SleeperLeagueOption,
} from "@/features/home/lib/leagueHistory";
import type { ReportLoadTelemetryEvent } from "@/features/home/lib/adminSessionState";

type BeginAnalysisLoading = (
  nextLeagueId: string,
  extraKnownLeagues?: SleeperLeagueOption[]
) => Promise<void>;

type QueueReportVisibleTelemetry = (
  event: Omit<ReportLoadTelemetryEvent, "createdAt" | "visibleMs">
) => void;

type UseHomeCachedSessionRestoreOptions = {
  activeAnalysisLeagueIdRef: MutableRefObject<string | null>;
  beginAnalysisLoading: BeginAnalysisLoading;
  lastLeagueKey: string;
  leagueIdHistoryKey: string;
  reportCacheMaxAgeMs: number;
  sleeperSessionKey: string;
  sleeperUsernameHistoryKey: string;
  staleReportCacheKeys: string[];
  applyCachedReport: (
    cachedReport: CachedReport,
    nextActiveTab?: string | null
  ) => void;
  refreshReportInBackground: (
    nextLeagueId: string,
    nextViewerUserId?: string | null
  ) => void;
  queueReportVisibleTelemetry: QueueReportVisibleTelemetry;
  onAnalyzeReport: (input: { leagueId: string; viewerUserId?: string }) => void;
  setActiveTab: Dispatch<SetStateAction<string>>;
  setAdminViewMode: Dispatch<SetStateAction<AdminViewMode | null>>;
  setAdminViewerManager: Dispatch<SetStateAction<string | null>>;
  setAnalysisErrorMessage: Dispatch<SetStateAction<string | null>>;
  setCachedSleeperUsers: Dispatch<SetStateAction<CachedSleeperUser[]>>;
  setLeagueId: Dispatch<SetStateAction<string>>;
  setLeagueIdHistory: Dispatch<SetStateAction<string[]>>;
  setSleeperUsername: Dispatch<SetStateAction<string>>;
  setSleeperUsernameHistory: Dispatch<SetStateAction<string[]>>;
  setUserLeagues: Dispatch<SetStateAction<SleeperLeagueOption[]>>;
  setViewerUserId: Dispatch<SetStateAction<string | null>>;
  setViewerUsername: Dispatch<SetStateAction<string | null>>;
};

export function useHomeCachedSessionRestore({
  activeAnalysisLeagueIdRef,
  beginAnalysisLoading,
  lastLeagueKey,
  leagueIdHistoryKey,
  reportCacheMaxAgeMs,
  sleeperSessionKey,
  sleeperUsernameHistoryKey,
  staleReportCacheKeys,
  applyCachedReport,
  refreshReportInBackground,
  queueReportVisibleTelemetry,
  onAnalyzeReport,
  setActiveTab,
  setAdminViewMode,
  setAdminViewerManager,
  setAnalysisErrorMessage,
  setCachedSleeperUsers,
  setLeagueId,
  setLeagueIdHistory,
  setSleeperUsername,
  setSleeperUsernameHistory,
  setUserLeagues,
  setViewerUserId,
  setViewerUsername,
}: UseHomeCachedSessionRestoreOptions) {
  useEffect(() => {
    let isCancelled = false;

    const restoreCachedSession = async () => {
      let restoredViewerUserId: string | null = null;
      let restoredLeagues: SleeperLeagueOption[] = [];
      const urlLeagueId = getInitialReportLeagueIdFromUrl();
      const urlTab = getInitialReportTabFromUrl();
      try {
        const sleeperSession = localStorage.getItem(sleeperSessionKey);
        if (sleeperSession) {
          const parsed = JSON.parse(sleeperSession) as SleeperSession;
          const parsedLeagues = Array.isArray(parsed.leagues)
            ? parsed.leagues
            : [];
          restoredLeagues = parsedLeagues;
          const restoredViewerIdentity = getKtcAdminIdentity(
            parsed.user,
            parsed.username
          );
          const restoredAdminViewMode = normalizeAdminViewMode(
            parsed.adminViewMode
          );
          const restoredHasAdminPermissions =
            parsed.user?.hasAdminPermissions === true ||
            parsed.user?.isPrivilegedReportViewer === true;
          setSleeperUsername(parsed.username || "");
          restoredViewerUserId = parsed.user?.userId || null;
          setViewerUserId(restoredViewerUserId);
          setViewerUsername(restoredViewerIdentity);
          setAdminViewMode(
            restoredHasAdminPermissions
              ? restoredAdminViewMode || "regular"
              : null
          );
          setAdminViewerManager(null);
          if (parsed.username) {
            setSleeperUsernameHistory(
              rememberAutocompleteValue(
                sleeperUsernameHistoryKey,
                parsed.username
              )
            );
          }
          if (parsed.username && parsedLeagues.length) {
            setCachedSleeperUsers(
              rememberCachedSleeperUser(
                buildCachedSleeperUser(
                  parsed.username,
                  parsed.user,
                  parsedLeagues
                )
              )
            );
          }
          setUserLeagues(parsedLeagues);
        }
      } catch {
        localStorage.removeItem(sleeperSessionKey);
      }

      try {
        staleReportCacheKeys.forEach(key => localStorage.removeItem(key));
        const restoreReportFromCache = (cachedReport: CachedReport) => {
          const tab = urlTab || cachedReport.activeTab || "overview";
          applyCachedReport(cachedReport, tab);
          queueReportVisibleTelemetry({
            leagueId: cachedReport.leagueId,
            leagueName: cachedReport.leagueName,
            activeTab: tab,
            source: "browser-cache",
            cacheStatus: "browser",
            requestMs: null,
            payloadVersion:
              cachedReport.cacheVersion || REPORT_CACHE_DATA_VERSION,
          });
          if (shouldBackgroundRefreshCachedReport(cachedReport)) {
            refreshReportInBackground(
              cachedReport.leagueId,
              restoredViewerUserId
            );
          }
        };

        if (urlLeagueId) {
          const parsed = await readBrowserReportCache(urlLeagueId);
          if (isCancelled) return;
          if (parsed && isUsableCachedReport(parsed, urlLeagueId)) {
            restoreReportFromCache(parsed);
            return;
          }
          if (parsed) clearBrowserReportCache(parsed.leagueId);
          setLeagueId(urlLeagueId);
          setAnalysisErrorMessage(null);
          setActiveTab(urlTab || "overview");
          setLeagueIdHistory(
            rememberAutocompleteValue(leagueIdHistoryKey, urlLeagueId)
          );
          void beginAnalysisLoading(urlLeagueId, restoredLeagues).finally(() => {
            if (activeAnalysisLeagueIdRef.current !== urlLeagueId) return;
            onAnalyzeReport({
              leagueId: urlLeagueId,
              viewerUserId:
                getValidSleeperUserId(restoredViewerUserId) || undefined,
            });
          });
          return;
        }

        const lastLeague = localStorage.getItem(lastLeagueKey);
        if (lastLeague) {
          const parsed = JSON.parse(lastLeague) as LastLeague;
          const lastLeagueIsFresh = isFreshTimestamp(
            parsed.savedAt,
            reportCacheMaxAgeMs
          );
          if (!lastLeagueIsFresh) {
            localStorage.removeItem(lastLeagueKey);
            return;
          }
          const cachedLastLeagueReport = await readBrowserReportCache(
            parsed.leagueId
          );
          if (isCancelled) return;
          if (
            cachedLastLeagueReport &&
            isUsableCachedReport(cachedLastLeagueReport, parsed.leagueId)
          ) {
            restoreReportFromCache(cachedLastLeagueReport);
            return;
          }
          localStorage.removeItem(lastLeagueKey);
          setLeagueIdHistory(
            rememberAutocompleteValue(leagueIdHistoryKey, parsed.leagueId)
          );
        }

        const parsed = await readBrowserReportCache();
        if (isCancelled) return;
        if (parsed && isUsableCachedReport(parsed)) {
          restoreReportFromCache(parsed);
        }
      } catch {
        clearBrowserReportCache();
        localStorage.removeItem(lastLeagueKey);
      }
    };

    void restoreCachedSession();
    return () => {
      isCancelled = true;
    };
    // Run once on boot so phone refreshes land back in the last league.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
