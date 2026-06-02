import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";
import {
  type ReportAnalysisMode,
  type ReportLoadTelemetryEvent,
} from "@/features/home/lib/adminSessionState";
import {
  clearBrowserReportCache,
  REPORT_CACHE_DATA_VERSION,
  showMutationErrorToast,
} from "@/features/home/lib/reportCache";
import { updateReportTabUrl } from "@/features/home/lib/reportRouteState";
import { getValidSleeperUserId } from "@/features/home/lib/sleeperIdentity";
import {
  buildLoadingManagerAnchors,
  findKnownSleeperLeague,
  type AnalysisLeaguePreview,
  type CachedSleeperUser,
  type SleeperLeagueOption,
} from "@/features/home/lib/leagueHistory";
import type {
  AnalysisLoadingLeague,
  LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import type { ReportData } from "@shared/types";

const REPORT_SUCCESS_REVEAL_DELAY_MS = 1150;
const REPORT_SUCCESS_READ_AFTER_REVEAL_MS = 850;
const REPORT_SUCCESS_KICK_MS = 900;

type AnalyzeReportInput = {
  leagueId: string;
  viewerUserId?: string;
  liveRefresh?: boolean;
};

type BeginAnalysisLoading = (
  nextLeagueId: string,
  extraKnownLeagues?: SleeperLeagueOption[],
  initialManagerAnchors?: LoaderManagerAnchor[]
) => Promise<void>;

type QueueReportVisibleTelemetry = (
  event: Omit<ReportLoadTelemetryEvent, "createdAt" | "visibleMs">
) => void;

type UseHomeReportAnalysisOptions = {
  activeTab: string;
  cachedSleeperUsers: CachedSleeperUser[];
  leagueId: string;
  reportData: ReportData | null;
  userLeagues: SleeperLeagueOption[];
  viewerUserId: string | null;
  activeAnalysisLeagueIdRef: MutableRefObject<string | null>;
  analysisModeRef: MutableRefObject<ReportAnalysisMode>;
  analyzeRequestStartedAtRef: MutableRefObject<{
    leagueId: string;
    startedAt: number;
  } | null>;
  backgroundRefreshLeagueIdRef: MutableRefObject<string | null>;
  reportLoadStartedAtRef: MutableRefObject<number | null>;
  beginAnalysisLoading: BeginAnalysisLoading;
  clearSuccessTransitionTimers: () => void;
  queueSuccessTransitionTimer: (callback: () => void, delay: number) => void;
  queueReportVisibleTelemetry: QueueReportVisibleTelemetry;
  rememberCurrentUserLeagueShortcut: (leagueId: string) => void;
  rememberLeagueId: (leagueId: string) => void;
  setAdminViewerManager: Dispatch<SetStateAction<string | null>>;
  setAnalysisCompleteMessage: Dispatch<
    SetStateAction<AnalysisLoadingLeague | null>
  >;
  setAnalysisErrorMessage: Dispatch<SetStateAction<string | null>>;
  setHasLoadingTimedOut: Dispatch<SetStateAction<boolean>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setIsReportRefreshing: Dispatch<SetStateAction<boolean>>;
  setLeagueFormat: Dispatch<SetStateAction<string>>;
  setLeagueId: Dispatch<SetStateAction<string>>;
  setLeagueLogo: Dispatch<SetStateAction<string | null>>;
  setLeagueName: Dispatch<SetStateAction<string>>;
  setLoadingManagerAnchors: Dispatch<SetStateAction<LoaderManagerAnchor[]>>;
  setLoadingTransitionPhase: Dispatch<SetStateAction<LoadingTransitionPhase>>;
  setPendingAnalysisLeague: Dispatch<
    SetStateAction<AnalysisLeaguePreview | null>
  >;
  setReportData: Dispatch<SetStateAction<ReportData | null>>;
  setReportDataCacheVersion: Dispatch<SetStateAction<string | null>>;
};

export function useHomeReportAnalysis({
  activeTab,
  cachedSleeperUsers,
  leagueId,
  reportData,
  userLeagues,
  viewerUserId,
  activeAnalysisLeagueIdRef,
  analysisModeRef,
  analyzeRequestStartedAtRef,
  backgroundRefreshLeagueIdRef,
  reportLoadStartedAtRef,
  beginAnalysisLoading,
  clearSuccessTransitionTimers,
  queueSuccessTransitionTimer,
  queueReportVisibleTelemetry,
  rememberCurrentUserLeagueShortcut,
  rememberLeagueId,
  setAdminViewerManager,
  setAnalysisCompleteMessage,
  setAnalysisErrorMessage,
  setHasLoadingTimedOut,
  setIsLoading,
  setIsReportRefreshing,
  setLeagueFormat,
  setLeagueId,
  setLeagueLogo,
  setLeagueName,
  setLoadingManagerAnchors,
  setLoadingTransitionPhase,
  setPendingAnalysisLeague,
  setReportData,
  setReportDataCacheVersion,
}: UseHomeReportAnalysisOptions) {
  const analyzeMutation = trpc.league.analyze.useMutation({
    onMutate: variables => {
      analyzeRequestStartedAtRef.current = {
        leagueId: variables.leagueId,
        startedAt: performance.now(),
      };
    },
    onSuccess: data => {
      if (
        analysisModeRef.current !== "background" &&
        activeAnalysisLeagueIdRef.current !== data.leagueId
      ) {
        return;
      }
      clearSuccessTransitionTimers();
      setHasLoadingTimedOut(false);
      setAnalysisErrorMessage(null);
      const analysisMode = analysisModeRef.current;
      const responseCompletedAt = performance.now();
      const analyzeRequest = analyzeRequestStartedAtRef.current;
      const analyzeStartedAt =
        analyzeRequest && analyzeRequest.leagueId === data.leagueId
          ? analyzeRequest.startedAt
          : null;
      const requestMs =
        analyzeStartedAt === null
          ? null
          : Math.round(responseCompletedAt - analyzeStartedAt);
      if (
        analysisMode === "background" &&
        backgroundRefreshLeagueIdRef.current === data.leagueId
      ) {
        activeAnalysisLeagueIdRef.current = data.leagueId;
        setLeagueId(data.leagueId);
        setLeagueName(data.leagueName);
        setLeagueLogo(data.leagueLogo);
        setLeagueFormat(data.leagueFormat);
        rememberCurrentUserLeagueShortcut(data.leagueId);
        setReportDataCacheVersion(REPORT_CACHE_DATA_VERSION);
        setReportData(data.reportData);
        setIsReportRefreshing(false);
        setAnalysisCompleteMessage(null);
        setPendingAnalysisLeague(null);
        backgroundRefreshLeagueIdRef.current = null;
        activeAnalysisLeagueIdRef.current = null;
        analysisModeRef.current = "blocking";
        queueReportVisibleTelemetry({
          leagueId: data.leagueId,
          leagueName: data.leagueName,
          activeTab,
          source: "server",
          cacheStatus: data.reportCacheStatus || "unknown",
          requestMs,
          payloadVersion: REPORT_CACHE_DATA_VERSION,
        });
        return;
      }
      activeAnalysisLeagueIdRef.current = data.leagueId;
      setLeagueId(data.leagueId);
      setLeagueName(data.leagueName);
      setLeagueLogo(data.leagueLogo);
      setLeagueFormat(data.leagueFormat);
      rememberCurrentUserLeagueShortcut(data.leagueId);
      setPendingAnalysisLeague({
        leagueName: data.leagueName,
        leagueFormat: data.leagueFormat,
        leagueLogo: data.leagueLogo,
      });
      setAnalysisCompleteMessage({
        leagueName: data.leagueName,
        leagueFormat: data.leagueFormat,
        leagueLogo: data.leagueLogo,
      });
      setLoadingManagerAnchors(
        buildLoadingManagerAnchors(
          data.reportData,
          data.reportData.viewerManager ?? null
        )
      );
      updateReportTabUrl(activeTab, data.leagueId);
      if (data.reportCacheStatus === "hit") {
        setReportDataCacheVersion(REPORT_CACHE_DATA_VERSION);
        setReportData(data.reportData);
        setLoadingTransitionPhase("done");
        setIsLoading(false);
        setLoadingManagerAnchors([]);
        setAnalysisCompleteMessage(null);
        setPendingAnalysisLeague(null);
        activeAnalysisLeagueIdRef.current = null;
        queueReportVisibleTelemetry({
          leagueId: data.leagueId,
          leagueName: data.leagueName,
          activeTab,
          source: "server",
          cacheStatus: "hit",
          requestMs,
          payloadVersion: REPORT_CACHE_DATA_VERSION,
        });
        return;
      }
      setLoadingTransitionPhase("success");
      queueSuccessTransitionTimer(() => {
        setReportDataCacheVersion(REPORT_CACHE_DATA_VERSION);
        setReportData(data.reportData);
        setLoadingTransitionPhase("reveal");
        queueReportVisibleTelemetry({
          leagueId: data.leagueId,
          leagueName: data.leagueName,
          activeTab,
          source: "server",
          cacheStatus: data.reportCacheStatus || "unknown",
          requestMs,
          payloadVersion: REPORT_CACHE_DATA_VERSION,
        });
      }, REPORT_SUCCESS_REVEAL_DELAY_MS);
      queueSuccessTransitionTimer(() => {
        setLoadingTransitionPhase("kick");
      }, REPORT_SUCCESS_REVEAL_DELAY_MS + REPORT_SUCCESS_READ_AFTER_REVEAL_MS);
      queueSuccessTransitionTimer(
        () => {
          setLoadingTransitionPhase("done");
          setIsLoading(false);
          setLoadingManagerAnchors([]);
          setAnalysisCompleteMessage(null);
          setPendingAnalysisLeague(null);
          activeAnalysisLeagueIdRef.current = null;
        },
        REPORT_SUCCESS_REVEAL_DELAY_MS +
          REPORT_SUCCESS_READ_AFTER_REVEAL_MS +
          REPORT_SUCCESS_KICK_MS
      );
    },
    onError: (error, variables) => {
      if (
        analysisModeRef.current !== "background" &&
        activeAnalysisLeagueIdRef.current !== variables.leagueId
      ) {
        return;
      }
      clearSuccessTransitionTimers();
      setHasLoadingTimedOut(false);
      if (analysisModeRef.current === "background") {
        setIsReportRefreshing(false);
        backgroundRefreshLeagueIdRef.current = null;
        activeAnalysisLeagueIdRef.current = null;
        analyzeRequestStartedAtRef.current = null;
        analysisModeRef.current = "blocking";
        if (reportData) {
          toast.warning("Could not refresh the report. Keeping the current view.");
          return;
        }
      }
      reportLoadStartedAtRef.current = null;
      analyzeRequestStartedAtRef.current = null;
      setAnalysisCompleteMessage(null);
      setPendingAnalysisLeague(null);
      activeAnalysisLeagueIdRef.current = null;
      setLoadingTransitionPhase("loading");
      setIsLoading(false);
      setLoadingManagerAnchors([]);
      if (!reportData) {
        setAnalysisErrorMessage(
          "We could not load that league. Check the Sleeper league ID, retry, or sign in with your Sleeper username to pick from your leagues."
        );
      }
      showMutationErrorToast(error);
    },
  });

  useEffect(
    () => () => {
      clearSuccessTransitionTimers();
    },
    [clearSuccessTransitionTimers]
  );

  const analyzeReport = (input: AnalyzeReportInput) => {
    analyzeMutation.mutate(input);
  };

  const handleAnalyze = async (targetLeagueId = leagueId) => {
    const nextLeagueId = targetLeagueId.trim();
    if (!nextLeagueId) {
      toast.error("Please enter a league ID");
      return;
    }
    setAnalysisErrorMessage(null);
    const isSameLeague = nextLeagueId === leagueId.trim();
    const knownLeague = findKnownSleeperLeague(
      nextLeagueId,
      userLeagues,
      cachedSleeperUsers
    );
    const initialManagerAnchors = knownLeague?.managerAnchors?.length
      ? knownLeague.managerAnchors
      : isSameLeague
      ? buildLoadingManagerAnchors(
          reportData,
          reportData?.viewerManager ?? null
        )
      : [];
    if (!isSameLeague) {
      setAdminViewerManager(null);
    }
    setLeagueId(nextLeagueId);
    rememberLeagueId(nextLeagueId);
    clearBrowserReportCache(nextLeagueId);
    setReportData(null);
    void beginAnalysisLoading(nextLeagueId, [], initialManagerAnchors).finally(
      () => {
        if (activeAnalysisLeagueIdRef.current !== nextLeagueId) return;
        analyzeMutation.mutate({
          leagueId: nextLeagueId,
          viewerUserId: getValidSleeperUserId(viewerUserId) || undefined,
          liveRefresh: true,
        });
      }
    );
  };

  return {
    analyzeReport,
    handleAnalyze,
  };
}
