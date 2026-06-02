import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import "@/styles/home-backgrounds-v12.css";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";
import { buildLeagueFormatPills } from "@/features/report/lib/reportOverviewPreview";
import { HomeSignedOutLanding } from "@/features/home/components/HomeSignedOutLanding";
import { HomeDialogsContainer } from "@/features/home/components/HomeDialogsContainer";
import { HomeReportExperience } from "@/features/home/components/HomeReportExperience";
import {
  persistHomeAdminViewMode,
  useHomeAdminAccess,
} from "@/features/home/hooks/useHomeAdminAccess";
import { useHomeAIVoiceMode } from "@/features/home/hooks/useHomeAIVoiceMode";
import { useHomeAIPredictionTelemetry } from "@/features/home/hooks/useHomeAIPredictionTelemetry";
import { useHomeLoadingTimeout } from "@/features/home/hooks/useHomeLoadingTimeout";
import { useHomeLeagueIntelRanks } from "@/features/home/hooks/useHomeLeagueIntelRanks";
import { useHomePortfolio } from "@/features/home/hooks/useHomePortfolio";
import { useHomePreviewMode } from "@/features/home/hooks/useHomePreviewMode";
import { usePersistHomeReportCache } from "@/features/home/hooks/usePersistHomeReportCache";
import { useHomeReportTabActions } from "@/features/home/hooks/useHomeReportTabActions";
import { useQueuedTimeouts } from "@/features/home/hooks/useQueuedTimeouts";
import { useReportBackgroundRefresh } from "@/features/home/hooks/useReportBackgroundRefresh";
import { useReportLoadTelemetry } from "@/features/home/hooks/useReportLoadTelemetry";
import { useReportDeltaSnapshots } from "@/features/home/hooks/useReportDeltaSnapshots";
import { useStaleReportCacheRefresh } from "@/features/home/hooks/useStaleReportCacheRefresh";
import { type OwnerIntelSortMode } from "@/features/report/components/OwnerIntelControls";
import {
  type HomePortfolioExposureFilter,
} from "@/features/home/lib/portfolioRows";
import { getLeagueFallbackInitials } from "@/features/home/lib/leagueIdentity";
import {
  getKtcAdminIdentity,
  type AdminViewMode,
  normalizeAdminViewMode,
} from "@/features/home/lib/adminMode";
import {
  getValidSleeperUserId,
} from "@/features/home/lib/sleeperIdentity";
import {
  getFilteredAutocompleteOptions,
  MAX_AUTOCOMPLETE_HISTORY,
  readAutocompleteHistory,
  rememberAutocompleteValue,
} from "@/features/home/lib/inputHelpers";
import {
  readAdminPassphraseVerifiedForSession,
  rememberAdminPassphraseVerifiedForSession,
  ReportAnalysisMode,
  ReportLoadCacheStatus,
  ReportLoadSource,
} from "@/features/home/lib/adminSessionState";
import {
  buildHomeReportTabState,
  getInitialReportLeagueIdFromUrl,
  getInitialReportTabFromUrl,
  updateReportTabUrl,
} from "@/features/home/lib/reportRouteState";
import {
  type CachedReport,
  type LastLeague,
  type SleeperSession,
  REPORT_CACHE_DATA_VERSION,
  REPORT_CACHE_KEY,
  REPORT_CACHE_MAX_AGE_MS,
  STALE_REPORT_CACHE_KEYS,
  clearBrowserReportCache,
  hasDraftReportData,
  isFreshTimestamp,
  isUsableCachedReport,
  normalizeCachedReportLeagueIdentity,
  normalizeReportLeagueId,
  getReportDataLeagueId,
  readBrowserReportCache,
  shouldBackgroundRefreshCachedReport,
  formatMutationErrorMessage,
  showMutationErrorToast,
} from "@/features/home/lib/reportCache";
import {
  type AnalysisLeaguePreview,
  type CachedSleeperUser,
  type SleeperLeagueOption,
  type SleeperUserSession,
  buildCachedSleeperUser,
  buildLoadingManagerAnchors,
  findCachedSleeperUser,
  findKnownSleeperLeague,
  getAnalysisLeaguePreview,
  getLeagueIdAnalysisPreview,
  getOrderedLeagueOptions,
  readCachedSleeperUsers,
  rememberCachedSleeperLeagueShortcut,
  rememberCachedSleeperUser,
} from "@/features/home/lib/leagueHistory";
import {
  type AnalysisLoadingLeague,
  type LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import {
  getBestDraftAdpValueManager,
  getBestDraftSignalManager,
  getWorstDraftAdpValueManager,
} from "@/lib/draftDashboardMetrics";
import { sanitizeCachedReport } from "@/lib/reportCacheSanitizer";
import type { ReportData } from "@shared/types";

// Cached reports render immediately, then refresh volatile Sleeper activity in the background.
const REPORT_BACKGROUND_REFRESH_AFTER_MS = 0;
const REPORT_CACHE_PREFETCH_DEBOUNCE_MS = 10 * 60 * 1000;
const LAST_LEAGUE_KEY = "dynasty-degenerates:last-league:v1";
const SLEEPER_SESSION_KEY = "dynasty-degenerates:sleeper-session:v1";
const LEAGUE_ID_HISTORY_KEY = "dynasty-degenerates:league-id-history:v1";
const SLEEPER_USERNAME_HISTORY_KEY =
  "dynasty-degenerates:sleeper-username-history:v1";
const ADMIN_UNLOCK_MODAL_DISMISSED_KEY =
  "dynasty-degenerates:admin-unlock-dismissed:v1";
const CLOWN_EASTER_EGG_USERNAMES = new Set(["armchairgmzar", "tjsmoov"]);
const REPORT_SUCCESS_REVEAL_DELAY_MS = 1150;
const REPORT_SUCCESS_READ_AFTER_REVEAL_MS = 850;
const REPORT_SUCCESS_KICK_MS = 900;
const REPORT_LOADING_TIMEOUT_MS = 10_000;
const SHOW_LEGACY_LEAGUE_ID_LOGIN = true;

export default function Home() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const utils = trpc.useUtils();
  const [leagueId, setLeagueId] = useState("");
  const [sleeperUsername, setSleeperUsername] = useState("");
  const [leagueIdHistory, setLeagueIdHistory] = useState<string[]>(() =>
    readAutocompleteHistory(LEAGUE_ID_HISTORY_KEY)
  );
  const [sleeperUsernameHistory, setSleeperUsernameHistory] = useState<
    string[]
  >(() => readAutocompleteHistory(SLEEPER_USERNAME_HISTORY_KEY));
  const [cachedSleeperUsers, setCachedSleeperUsers] = useState<
    CachedSleeperUser[]
  >(() => readCachedSleeperUsers());
  const [focusedAutocomplete, setFocusedAutocomplete] = useState<
    "username" | "league" | null
  >(null);
  const [portfolioSearch, setPortfolioSearch] = useState("");
  const [portfolioExposureFilter, setPortfolioExposureFilter] =
    useState<HomePortfolioExposureFilter>("all");
  const [portfolioLeagueFilter, setPortfolioLeagueFilter] = useState("all");
  const [analysisErrorMessage, setAnalysisErrorMessage] = useState<
    string | null
  >(null);
  const [userLeagues, setUserLeagues] = useState<SleeperLeagueOption[]>([]);
  const [isLeagueIntelLoading, setIsLeagueIntelLoading] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerUsername, setViewerUsername] = useState<string | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<AdminViewMode | null>(
    null
  );
  const [adminViewerManager, setAdminViewerManager] = useState<string | null>(
    null
  );
  const { aiVoiceMode, handleAIVoiceModeChange } = useHomeAIVoiceMode();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportDataCacheVersion, setReportDataCacheVersion] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState(
    () => getInitialReportTabFromUrl() || "overview"
  );
  const [rosterScannerFocusKey, setRosterScannerFocusKey] = useState(0);
  const [leagueName, setLeagueName] = useState("");
  const [leagueLogo, setLeagueLogo] = useState<string | null>(null);
  const [leagueFormat, setLeagueFormat] = useState("");
  const [ownerIntelSortMode, setOwnerIntelSortMode] =
    useState<OwnerIntelSortMode>("dynasty");
  const [leagueRosterScannerMode, setLeagueRosterScannerMode] =
    useState<OwnerIntelSortMode>("dynasty");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingManagerAnchors, setLoadingManagerAnchors] = useState<
    LoaderManagerAnchor[]
  >([]);
  const [isReportRefreshing, setIsReportRefreshing] = useState(false);
  const [analysisCompleteMessage, setAnalysisCompleteMessage] =
    useState<AnalysisLoadingLeague | null>(null);
  const [pendingAnalysisLeague, setPendingAnalysisLeague] =
    useState<AnalysisLeaguePreview | null>(null);
  const [previewLoadingLoopTick, setPreviewLoadingLoopTick] = useState(0);
  const previewMode =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("preview");

  const [isLeaguePickerOpen, setIsLeaguePickerOpen] = useState(false);
  const [isChangeLeagueModalOpen, setIsChangeLeagueModalOpen] = useState(false);
  const [isClownModalOpen, setIsClownModalOpen] = useState(false);
  const [isAdminAccessModalOpen, setIsAdminAccessModalOpen] = useState(false);
  const [adminPassphrase, setAdminPassphrase] = useState("");
  const [
    isAdminPassphraseVerifiedForSession,
    setIsAdminPassphraseVerifiedForSession,
  ] = useState(readAdminPassphraseVerifiedForSession);
  const [loadingTransitionPhase, setLoadingTransitionPhase] =
    useState<LoadingTransitionPhase>("loading");
  const [hasLoadingTimedOut, setHasLoadingTimedOut] = useState(false);
  useHomeLoadingTimeout({
    isLoading,
    loadingTransitionPhase,
    timeoutMs: REPORT_LOADING_TIMEOUT_MS,
    setHasLoadingTimedOut,
  });
  useHomePreviewMode({
    previewMode,
    setIsLoading,
    setLoadingTransitionPhase,
    setPendingAnalysisLeague,
    setAnalysisCompleteMessage,
    setLoadingManagerAnchors,
    setPreviewLoadingLoopTick,
  });
  const {
    clearQueuedTimeouts: clearSuccessTransitionTimers,
    queueTimeout: queueSuccessTransitionTimer,
  } = useQueuedTimeouts();
  const activeAnalysisLeagueIdRef = useRef<string | null>(null);
  const reportLoadStartedAtRef = useRef<number | null>(null);
  const analyzeRequestStartedAtRef = useRef<{
    leagueId: string;
    startedAt: number;
  } | null>(null);
  const analysisModeRef = useRef<ReportAnalysisMode>("blocking");
  const backgroundRefreshLeagueIdRef = useRef<string | null>(null);
  const lastBackgroundRefreshAtRef = useRef<Record<string, number>>({});
  const queueReportVisibleTelemetry = useReportLoadTelemetry({
    reportLoadStartedAtRef,
    analyzeRequestStartedAtRef,
  });
  const adminLoginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: async () => {
      rememberAdminPassphraseVerifiedForSession();
      setIsAdminPassphraseVerifiedForSession(true);
      setAdminPassphrase("");
      setIsAdminAccessModalOpen(false);
      setAdminViewMode("admin");
      setAdminViewerManager(null);
      await utils.auth.me.invalidate();
      toast.success("Admin session unlocked.");
    },
    onError: loginError => {
      toast.error(loginError.message);
    },
  });

  const leaguePreviewMutation = trpc.league.getLeaguePreview.useMutation();

  const beginAnalysisLoading = async (
    nextLeagueId: string,
    extraKnownLeagues: SleeperLeagueOption[] = [],
    initialManagerAnchors: LoaderManagerAnchor[] = []
  ) => {
    analysisModeRef.current = "blocking";
    activeAnalysisLeagueIdRef.current = nextLeagueId;
    reportLoadStartedAtRef.current = performance.now();
    const knownLeague = findKnownSleeperLeague(
      nextLeagueId,
      userLeagues,
      cachedSleeperUsers,
      extraKnownLeagues
    );

    setPendingAnalysisLeague(
      knownLeague
        ? getAnalysisLeaguePreview(knownLeague)
        : getLeagueIdAnalysisPreview(nextLeagueId)
    );
    setAnalysisCompleteMessage(null);
    setLoadingTransitionPhase("loading");
    setHasLoadingTimedOut(false);
    setIsLoading(true);
    setLoadingManagerAnchors(initialManagerAnchors);

    try {
      const league = await leaguePreviewMutation.mutateAsync({
        leagueId: nextLeagueId,
      });
      if (activeAnalysisLeagueIdRef.current !== league.leagueId) return;
      if (!knownLeague) {
        setPendingAnalysisLeague(getAnalysisLeaguePreview(league));
      }
      if (league.managerAnchors?.length) {
        setLoadingManagerAnchors(league.managerAnchors);
      }
    } catch {
      // The full analysis request owns the user-facing error state.
    }
  };

  const rememberLeagueId = (value: string) => {
    setLeagueIdHistory(rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, value));
  };

  const rememberSleeperUsername = (value: string) => {
    setSleeperUsernameHistory(
      rememberAutocompleteValue(SLEEPER_USERNAME_HISTORY_KEY, value)
    );
  };

  const getCurrentSessionUserForCache = (): SleeperUserSession | null => {
    const cachedUser = findCachedSleeperUser(
      cachedSleeperUsers,
      viewerUserId,
      sleeperUsername
    );
    const username = sleeperUsername.trim() || cachedUser?.username || "";
    if (!username) return null;

    return {
      userId: viewerUserId || cachedUser?.userId || username,
      username: cachedUser?.username || viewerUsername || username,
      displayName: cachedUser?.displayName || viewerUsername || username,
      avatarUrl: cachedUser?.avatarUrl || null,
      hasAdminPermissions:
        cachedUser?.hasAdminPermissions === true ||
        cachedUser?.isPrivilegedReportViewer === true,
      isPrivilegedReportViewer:
        cachedUser?.hasAdminPermissions === true ||
        cachedUser?.isPrivilegedReportViewer === true,
    };
  };

  const rememberCurrentUserLeagueShortcut = (nextLeagueId: string) => {
    if (!userLeagues.some(league => league.leagueId === nextLeagueId)) return;
    const sessionUser = getCurrentSessionUserForCache();
    const username = sleeperUsername.trim() || sessionUser?.username || "";
    if (!sessionUser || !username) return;

    const nextUsers = rememberCachedSleeperLeagueShortcut({
      users: readCachedSleeperUsers(),
      user: sessionUser,
      username,
      leagues: userLeagues,
      leagueId: nextLeagueId,
    });
    setCachedSleeperUsers(nextUsers);
  };

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
    []
  );

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
    setReportDataCacheVersion(sanitizedReport.cacheVersion || REPORT_CACHE_DATA_VERSION);
    setReportData(sanitizedReport.reportData);
    setAnalysisCompleteMessage(null);
    setAnalysisErrorMessage(null);
    setPendingAnalysisLeague(null);
    setLoadingTransitionPhase("done");
    setIsLoading(false);
    updateReportTabUrl(tab, sanitizedReport.leagueId);
    setLeagueIdHistory(
      rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, sanitizedReport.leagueId)
    );
  };

  const refreshReportInBackground = (
    nextLeagueId: string,
    nextViewerUserId?: string | null
  ) => {
    const normalizedLeagueId = nextLeagueId.trim();
    if (!normalizedLeagueId) return;
    const lastRefreshAt = lastBackgroundRefreshAtRef.current[normalizedLeagueId] || 0;
    if (Date.now() - lastRefreshAt < REPORT_CACHE_PREFETCH_DEBOUNCE_MS) return;
    lastBackgroundRefreshAtRef.current[normalizedLeagueId] = Date.now();
    analysisModeRef.current = "background";
    backgroundRefreshLeagueIdRef.current = normalizedLeagueId;
    activeAnalysisLeagueIdRef.current = normalizedLeagueId;
    setIsReportRefreshing(true);
    analyzeMutation.mutate({
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
      analyzeMutation.mutate({
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

  const { isLeagueRanksPending } = useHomeLeagueIntelRanks({
    sleeperSessionKey: SLEEPER_SESSION_KEY,
    sleeperUsername,
    userLeagues,
    viewerUserId,
    viewerUsername,
    setIsLeagueIntelLoading,
    setUserLeagues,
  });

  const userLeaguesMutation = trpc.league.getUserLeagues.useMutation({
    onSuccess: (data, variables) => {
      const username = variables.username.trim();
      const nextViewerUserId = data.user?.userId || null;
      const nextViewerIdentity = getKtcAdminIdentity(data.user, username);
      const nextHasAdminPermissions =
        data.user?.hasAdminPermissions === true ||
        data.user?.isPrivilegedReportViewer === true;
      setUserLeagues(data.leagues);
      setIsLeagueIntelLoading(Boolean(nextViewerUserId && data.leagues.length));
      setViewerUserId(nextViewerUserId);
      setViewerUsername(nextViewerIdentity);
      setAdminViewMode(null);
      setAdminViewerManager(null);
      if (data.leagues.length === 0) {
        toast.error("No Sleeper leagues found for this username");
        return;
      }
      rememberSleeperUsername(username);
      setCachedSleeperUsers(
        rememberCachedSleeperUser(
          buildCachedSleeperUser(username, data.user, data.leagues)
        )
      );
      try {
        localStorage.setItem(
          SLEEPER_SESSION_KEY,
          JSON.stringify({
            username,
            user: data.user || null,
            leagues: data.leagues,
            adminViewMode: null,
            savedAt: Date.now(),
          } satisfies SleeperSession)
        );
      } catch {
        // Losing this cache only affects the league switcher, not the report itself.
      }
      if (nextHasAdminPermissions) {
        setAdminViewMode("regular");
        persistHomeAdminViewMode({
          mode: "regular",
          sleeperSessionKey: SLEEPER_SESSION_KEY,
        });
      }
      toast.success(
        `Found ${data.leagues.length} Sleeper league${data.leagues.length === 1 ? "" : "s"}`
      );
      setIsLeaguePickerOpen(true);
    },
    onError: error => {
      setAnalysisErrorMessage(formatMutationErrorMessage(error));
      showMutationErrorToast(error);
    },
  });

  useEffect(() => {
    let isCancelled = false;

    const restoreCachedSession = async () => {
      let restoredViewerUserId: string | null = null;
      let restoredLeagues: SleeperLeagueOption[] = [];
      const urlLeagueId = getInitialReportLeagueIdFromUrl();
      const urlTab = getInitialReportTabFromUrl();
      try {
        const sleeperSession = localStorage.getItem(SLEEPER_SESSION_KEY);
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
                SLEEPER_USERNAME_HISTORY_KEY,
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
        localStorage.removeItem(SLEEPER_SESSION_KEY);
      }

      try {
        STALE_REPORT_CACHE_KEYS.forEach(key => localStorage.removeItem(key));
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
            rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, urlLeagueId)
          );
          void beginAnalysisLoading(urlLeagueId, restoredLeagues).finally(() => {
            if (activeAnalysisLeagueIdRef.current !== urlLeagueId) return;
            analyzeMutation.mutate({
              leagueId: urlLeagueId,
              viewerUserId:
                getValidSleeperUserId(restoredViewerUserId) || undefined,
            });
          });
          return;
        }

        const lastLeague = localStorage.getItem(LAST_LEAGUE_KEY);
        if (lastLeague) {
          const parsed = JSON.parse(lastLeague) as LastLeague;
          const lastLeagueIsFresh = isFreshTimestamp(
            parsed.savedAt,
            REPORT_CACHE_MAX_AGE_MS
          );
          if (!lastLeagueIsFresh) {
            localStorage.removeItem(LAST_LEAGUE_KEY);
            return;
          }
          const cachedLastLeagueReport = await readBrowserReportCache(parsed.leagueId);
          if (isCancelled) return;
          if (
            cachedLastLeagueReport &&
            isUsableCachedReport(cachedLastLeagueReport, parsed.leagueId)
          ) {
            restoreReportFromCache(cachedLastLeagueReport);
            return;
          }
          localStorage.removeItem(LAST_LEAGUE_KEY);
          setLeagueIdHistory(
            rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, parsed.leagueId)
          );
        }

        const parsed = await readBrowserReportCache();
        if (isCancelled) return;
        if (parsed && isUsableCachedReport(parsed)) {
          restoreReportFromCache(parsed);
        }
      } catch {
        clearBrowserReportCache();
        localStorage.removeItem(LAST_LEAGUE_KEY);
      }
    };

    void restoreCachedSession();
    return () => {
      isCancelled = true;
    };
    // Run once on boot so phone refreshes land back in the last league.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePersistHomeReportCache({
    activeTab,
    lastLeagueKey: LAST_LEAGUE_KEY,
    leagueFormat,
    leagueId,
    leagueLogo,
    leagueName,
    reportData,
  });

  useStaleReportCacheRefresh({
    reportData,
    reportDataCacheVersion,
    leagueId,
    isLoading,
    viewerUserId,
    setReportDataCacheVersion,
    setAnalysisCompleteMessage,
    onRefreshReport: refreshReportInBackground,
  });

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

  const handleFindLeagues = async () => {
    const normalizedUsername = sleeperUsername.trim();
    if (!normalizedUsername) {
      setAnalysisErrorMessage("Please enter a Sleeper username.");
      toast.error("Please enter a Sleeper username");
      return;
    }
    if (CLOWN_EASTER_EGG_USERNAMES.has(normalizedUsername.toLowerCase())) {
      setIsClownModalOpen(true);
      return;
    }
    setPortfolioSearch("");
    setAnalysisErrorMessage(null);
    setIsLeagueIntelLoading(false);
    userLeaguesMutation.mutate({ username: normalizedUsername });
  };

  const handleClownDismiss = () => {
    setIsClownModalOpen(false);
    setSleeperUsername("");
    setPortfolioSearch("");
    setAnalysisErrorMessage(null);
    setUserLeagues([]);
    setIsLeagueIntelLoading(false);
    setFocusedAutocomplete(null);
    setAdminViewMode(null);
    setAdminViewerManager(null);
  };

  const handleStartOver = () => {
    clearBrowserReportCache();
    localStorage.removeItem(LAST_LEAGUE_KEY);
    localStorage.removeItem(SLEEPER_SESSION_KEY);
    updateReportTabUrl("overview", "");
    clearSuccessTransitionTimers();
    activeAnalysisLeagueIdRef.current = null;
    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    setIsAdminAccessModalOpen(false);
    setAnalysisCompleteMessage(null);
    setAnalysisErrorMessage(null);
    setPendingAnalysisLeague(null);
    setLoadingTransitionPhase("loading");
    setHasLoadingTimedOut(false);
    setLoadingManagerAnchors([]);
    setIsLoading(false);
    setReportData(null);
    setLeagueId("");
    setSleeperUsername("");
    setPortfolioSearch("");
    setLeagueName("");
    setLeagueLogo(null);
    setLeagueFormat("");
    setUserLeagues([]);
    setIsLeagueIntelLoading(false);
    setViewerUserId(null);
    setViewerUsername(null);
    setAdminViewMode(null);
    setAdminViewerManager(null);
    setAdminPassphrase("");
    setActiveTab("overview");
  };

  const handleCancelLoading = () => {
    clearSuccessTransitionTimers();
    activeAnalysisLeagueIdRef.current = null;
    reportLoadStartedAtRef.current = null;
    analyzeRequestStartedAtRef.current = null;
    analysisModeRef.current = "blocking";
    setAnalysisCompleteMessage(null);
    setPendingAnalysisLeague(null);
    setLoadingTransitionPhase("loading");
    setHasLoadingTimedOut(false);
    setLoadingManagerAnchors([]);
    setIsLoading(false);

    if (userLeagues.length > 0) {
      setIsLeaguePickerOpen(true);
      return;
    }

    if (!reportData) {
      updateReportTabUrl("overview", "");
      setLeagueId("");
      setAnalysisErrorMessage(null);
      setLeagueName("");
      setLeagueLogo(null);
      setLeagueFormat("");
      setActiveTab("overview");
    }
  };

  const handleRetryLoading = () => {
    const retryLeagueId =
      activeAnalysisLeagueIdRef.current || normalizeReportLeagueId(leagueId);
    if (!retryLeagueId) {
      handleCancelLoading();
      return;
    }
    void handleAnalyze(retryLeagueId);
  };

  const handleAnalyzeAnotherLeague = () => {
    if (userLeagues.length > 0) {
      setIsLeaguePickerOpen(true);
      return;
    }
    setIsChangeLeagueModalOpen(true);
  };

  const handleHeaderLeagueClick = () => {
    if (userLeagues.length > 0) {
      setIsLeaguePickerOpen(true);
      return;
    }
    setIsChangeLeagueModalOpen(true);
  };

  const handleAnalyzeLeagueOption = async (nextLeagueId: string) => {
    setIsLeaguePickerOpen(false);
    clearBrowserReportCache(nextLeagueId);
    await handleAnalyze(nextLeagueId);
  };

  const usernameAutocompleteOptions = getFilteredAutocompleteOptions(
    sleeperUsernameHistory,
    sleeperUsername
  );
  const leagueIdAutocompleteOptions = getFilteredAutocompleteOptions(
    leagueIdHistory,
    leagueId
  );
  const activeCachedSleeperUser = findCachedSleeperUser(
    cachedSleeperUsers,
    viewerUserId,
    sleeperUsername
  );
  const orderedUserLeagues = getOrderedLeagueOptions(
    userLeagues,
    activeCachedSleeperUser
  );
  const isLeaguePickerIntelBusy =
    isLeagueIntelLoading || isLeagueRanksPending;
  const {
    homePortfolioRows,
    filteredHomePortfolioRows,
    isHomePortfolioLoading,
  } = useHomePortfolio({
    orderedUserLeagues,
    viewerUserId,
    isLeagueRanksPending,
    portfolioSearch,
    portfolioExposureFilter,
    portfolioLeagueFilter,
    setPortfolioLeagueFilter,
  });
  const showHomePortfolioPanel = false;
  const {
    canOpenAdminToolsEntry,
    canViewAdminDiagnostics,
    canViewAdminFeatureExpansion,
    handleAdminToolsClick,
    handleAdminUnlockModalDismiss,
    hasAdminPermissions,
    hasAuthenticatedAdminPermissions,
    isAdminUnlockModalOpen,
  } = useHomeAdminAccess({
    activeCachedSleeperUser,
    adminViewMode,
    authUser: authQuery.data,
    isAdminPassphraseVerifiedForSession,
    isProduction: import.meta.env.PROD,
    reportData,
    sleeperSessionKey: SLEEPER_SESSION_KEY,
    unlockDismissedKey: ADMIN_UNLOCK_MODAL_DISMISSED_KEY,
    setActiveTab,
    setAdminPassphrase,
    setAdminViewMode,
    setAdminViewerManager,
    setIsAdminAccessModalOpen,
  });

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
    shouldShowDraftHistoryTab,
    isAuthLoading: authQuery.isLoading,
  });
  const reportTabsStyle = {
    width: "100%",
    "--dd-report-tab-count": String(visibleReportTabCount),
    "--dd-report-tab-index": String(resolvedReportTabIndex),
  } as CSSProperties;
  const rankingsQuery = trpc.league.rankingsMeta.useQuery(
    { leagueId },
    {
      enabled: Boolean(reportData && leagueId && !reportData.rankings),
      staleTime: 1000 * 60 * 60 * 12,
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );
  const rankingsForReport =
    rankingsQuery.data?.rankings || reportData?.rankings;
  const reportDataWithRankings = useMemo(
    () =>
      reportData && rankingsForReport
        ? { ...reportData, rankings: rankingsForReport }
        : reportData,
    [rankingsForReport, reportData]
  );
  useHomeAIPredictionTelemetry({
    enabled: Boolean(authQuery.data),
    reportData: reportDataWithRankings,
    leagueId,
    leagueName,
  });
  const {
    currentReportDeltaSnapshot,
    previousReportDeltaSnapshot,
  } = useReportDeltaSnapshots({
    reportData: reportDataWithRankings,
    leagueId,
    leagueName,
  });
  useReportBackgroundRefresh({
    reportData,
    leagueId,
    reportDataCacheVersion,
    isLoading,
    isReportRefreshing,
    viewerUserId,
    refreshAfterMs: REPORT_BACKGROUND_REFRESH_AFTER_MS,
    prefetchDebounceMs: REPORT_CACHE_PREFETCH_DEBOUNCE_MS,
    onRefreshReport: refreshReportInBackground,
  });
  const { handleReportTabChange, handleScoutLeaguemates } =
    useHomeReportTabActions({
      activeTab,
      setActiveTab,
      leagueId,
      reportData,
      canViewAutopilotTab,
      shouldShowDraftHistoryTab,
      isAuthLoading: authQuery.isLoading,
      shouldDeferAutopilotUrlSync,
      resolvedActiveTab,
      setRosterScannerFocusKey,
    });

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
  const homeDialogs = (
    <HomeDialogsContainer
      isLeaguePickerOpen={isLeaguePickerOpen}
      leagues={orderedUserLeagues}
      sleeperUsername={sleeperUsername}
      activeCachedSleeperUser={activeCachedSleeperUser}
      isLeaguePickerIntelBusy={isLeaguePickerIntelBusy}
      onLeaguePickerOpenChange={setIsLeaguePickerOpen}
      onLeagueSelect={handleAnalyzeLeagueOption}
      onStartOver={handleStartOver}
      isClownModalOpen={isClownModalOpen}
      onClownDismiss={handleClownDismiss}
      isAdminAccessModalOpen={isAdminAccessModalOpen}
      adminPassphrase={adminPassphrase}
      isAdminLoginPending={adminLoginMutation.isPending}
      onAdminAccessOpenChange={open => {
        if (open) return;
        setIsAdminAccessModalOpen(false);
        setAdminPassphrase("");
      }}
      onAdminPassphraseChange={setAdminPassphrase}
      onAdminSubmit={() =>
        adminLoginMutation.mutate({ passphrase: adminPassphrase })
      }
      onAdminStayRegularView={() => {
        setIsAdminAccessModalOpen(false);
        setAdminPassphrase("");
      }}
      hasAuthenticatedAdminPermissions={hasAuthenticatedAdminPermissions}
      isAdminUnlockModalOpen={isAdminUnlockModalOpen}
      onAdminUnlockDismiss={handleAdminUnlockModalDismiss}
      isLoading={isLoading}
      previewMode={previewMode}
      previewLoadingLoopTick={previewLoadingLoopTick}
      analysisCompleteMessage={analysisCompleteMessage}
      loadingTransitionPhase={loadingTransitionPhase}
      loadingLeague={loadingLeague}
      loadingManagerAnchors={loadingManagerAnchors}
      hasLoadingTimedOut={hasLoadingTimedOut}
      onLoadingCancel={handleCancelLoading}
      onLoadingRetry={handleRetryLoading}
    />
  );
  if (reportData && !analysisCompleteMessage) {
    return (
      <HomeReportExperience
        reportData={reportData}
        reportDataWithRankings={reportDataWithRankings}
        isLoadingRevealPhase={isLoadingRevealPhase}
        aiVoiceMode={aiVoiceMode}
        resolvedActiveTab={resolvedActiveTab}
        onReportTabChange={handleReportTabChange}
        hasAdminPermissions={hasAdminPermissions}
        canViewAutopilotTab={canViewAutopilotTab}
        shouldShowDraftHistoryTab={shouldShowDraftHistoryTab}
        reportTabsClassName={reportTabsClassName}
        reportTabsStyle={reportTabsStyle}
        leagueName={leagueName}
        leagueFormat={leagueFormat}
        leagueId={leagueId}
        leagueFormatPills={leagueFormatPills}
        leagueLogo={leagueLogo}
        leagueLogoInitials={leagueLogoInitials}
        onHeaderLeagueClick={handleHeaderLeagueClick}
        onAnalyzeAnotherLeague={handleAnalyzeAnotherLeague}
        isChangeLeagueModalOpen={isChangeLeagueModalOpen}
        onChangeLeagueOpenChange={setIsChangeLeagueModalOpen}
        onStartOver={handleStartOver}
        canOpenAdminToolsEntry={canOpenAdminToolsEntry}
        canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
        canViewAdminDiagnostics={canViewAdminDiagnostics}
        isAdminPassphraseVerifiedForSession={
          isAdminPassphraseVerifiedForSession
        }
        adminViewerManager={adminViewerManager}
        onAIVoiceModeChange={handleAIVoiceModeChange}
        onAdminToolsClick={handleAdminToolsClick}
        onAdminViewerManagerChange={setAdminViewerManager}
        leagueRosterScannerMode={leagueRosterScannerMode}
        onLeagueRosterScannerModeChange={setLeagueRosterScannerMode}
        ownerIntelSortMode={ownerIntelSortMode}
        onOwnerIntelSortModeChange={setOwnerIntelSortMode}
        rankingsForReport={rankingsForReport}
        rankingsQueryIsLoading={rankingsQuery.isLoading}
        onAnalyze={() => handleAnalyze()}
        onScoutLeaguemates={handleScoutLeaguemates}
        currentReportDeltaSnapshot={currentReportDeltaSnapshot}
        previousReportDeltaSnapshot={previousReportDeltaSnapshot}
        rosterScannerFocusKey={rosterScannerFocusKey}
        homePortfolioRows={homePortfolioRows}
        filteredHomePortfolioRows={filteredHomePortfolioRows}
        orderedUserLeagues={orderedUserLeagues}
        isHomePortfolioLoading={isHomePortfolioLoading}
        portfolioSearch={portfolioSearch}
        portfolioExposureFilter={portfolioExposureFilter}
        portfolioLeagueFilter={portfolioLeagueFilter}
        onPortfolioSearchChange={setPortfolioSearch}
        onPortfolioExposureFilterChange={setPortfolioExposureFilter}
        onPortfolioLeagueFilterChange={setPortfolioLeagueFilter}
        homeDialogs={homeDialogs}
      />
    );
  }

  return (
    <>
      <HomeSignedOutLanding
        showHomePortfolioPanel={showHomePortfolioPanel}
        homePortfolioRows={homePortfolioRows}
        filteredHomePortfolioRows={filteredHomePortfolioRows}
        orderedUserLeagues={orderedUserLeagues}
        isHomePortfolioLoading={isHomePortfolioLoading}
        portfolioSearch={portfolioSearch}
        portfolioExposureFilter={portfolioExposureFilter}
        portfolioLeagueFilter={portfolioLeagueFilter}
        onPortfolioSearchChange={setPortfolioSearch}
        onPortfolioExposureFilterChange={setPortfolioExposureFilter}
        onPortfolioLeagueFilterChange={setPortfolioLeagueFilter}
        onAnalyzeLeagueOption={handleAnalyzeLeagueOption}
        leagueId={leagueId}
        sleeperUsername={sleeperUsername}
        onSleeperUsernameChange={value => {
          setSleeperUsername(value);
          setAnalysisErrorMessage(null);
        }}
        leagueIdHistory={leagueIdHistory}
        onLeagueIdChange={value => {
          setLeagueId(value);
          setAnalysisErrorMessage(null);
        }}
        focusedAutocomplete={focusedAutocomplete}
        onFocusedAutocompleteChange={setFocusedAutocomplete}
        usernameAutocompleteOptions={usernameAutocompleteOptions}
        leagueIdAutocompleteOptions={leagueIdAutocompleteOptions}
        onUsernameAutocompleteSelect={value => {
          setSleeperUsername(value);
          setFocusedAutocomplete(null);
        }}
        onLeagueIdAutocompleteSelect={value => {
          setLeagueId(value);
          setFocusedAutocomplete(null);
        }}
        handleFindLeagues={handleFindLeagues}
        isFindLeaguesPending={userLeaguesMutation.isPending}
        analysisErrorMessage={analysisErrorMessage}
        showLegacyLeagueIdLogin={SHOW_LEGACY_LEAGUE_ID_LOGIN}
        handleAnalyze={() => handleAnalyze()}
        isAnalysisBusy={isLoading}
        showLoadingFooter={!reportData}
        onStartOver={handleStartOver}
        isLandingFaded={Boolean(reportData && analysisCompleteMessage)}
        homeDialogs={homeDialogs}
      />
    </>
  );
}
