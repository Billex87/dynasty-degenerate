import {
  useEffect,
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
import { useHomeAdminAccess } from "@/features/home/hooks/useHomeAdminAccess";
import { useHomeAdminLogin } from "@/features/home/hooks/useHomeAdminLogin";
import { useHomeAnalysisLoading } from "@/features/home/hooks/useHomeAnalysisLoading";
import { useHomeAIVoiceMode } from "@/features/home/hooks/useHomeAIVoiceMode";
import { useHomeAIPredictionTelemetry } from "@/features/home/hooks/useHomeAIPredictionTelemetry";
import { useHomeCachedReportActions } from "@/features/home/hooks/useHomeCachedReportActions";
import { useHomeLoadingTimeout } from "@/features/home/hooks/useHomeLoadingTimeout";
import { useHomeLeagueHistoryActions } from "@/features/home/hooks/useHomeLeagueHistoryActions";
import { useHomeLeagueIntelRanks } from "@/features/home/hooks/useHomeLeagueIntelRanks";
import { useHomeNavigationActions } from "@/features/home/hooks/useHomeNavigationActions";
import { useHomePortfolio } from "@/features/home/hooks/useHomePortfolio";
import { useHomePreviewMode } from "@/features/home/hooks/useHomePreviewMode";
import { useHomeReportIdentityRecovery } from "@/features/home/hooks/useHomeReportIdentityRecovery";
import { useHomeSleeperLeagueSearch } from "@/features/home/hooks/useHomeSleeperLeagueSearch";
import { usePersistHomeReportCache } from "@/features/home/hooks/usePersistHomeReportCache";
import { useHomeReportRankings } from "@/features/home/hooks/useHomeReportRankings";
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
  readAutocompleteHistory,
  rememberAutocompleteValue,
} from "@/features/home/lib/inputHelpers";
import {
  readAdminPassphraseVerifiedForSession,
  ReportAnalysisMode,
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
  readBrowserReportCache,
  shouldBackgroundRefreshCachedReport,
  formatMutationErrorMessage,
  showMutationErrorToast,
} from "@/features/home/lib/reportCache";
import {
  type AnalysisLeaguePreview,
  type CachedSleeperUser,
  type SleeperLeagueOption,
  buildCachedSleeperUser,
  buildLoadingManagerAnchors,
  findCachedSleeperUser,
  findKnownSleeperLeague,
  getOrderedLeagueOptions,
  readCachedSleeperUsers,
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
  const {
    handleAdminAccessOpenChange,
    handleAdminStayRegularView,
    handleAdminSubmit,
    isAdminLoginPending,
  } = useHomeAdminLogin({
    adminPassphrase,
    setAdminPassphrase,
    setAdminViewMode,
    setAdminViewerManager,
    setIsAdminAccessModalOpen,
    setIsAdminPassphraseVerifiedForSession,
  });

  const { beginAnalysisLoading } = useHomeAnalysisLoading({
    activeAnalysisLeagueIdRef,
    analysisModeRef,
    cachedSleeperUsers,
    reportLoadStartedAtRef,
    userLeagues,
    setAnalysisCompleteMessage,
    setHasLoadingTimedOut,
    setIsLoading,
    setLoadingManagerAnchors,
    setLoadingTransitionPhase,
    setPendingAnalysisLeague,
  });

  const {
    rememberCurrentUserLeagueShortcut,
    rememberLeagueId,
  } = useHomeLeagueHistoryActions({
    cachedSleeperUsers,
    leagueIdHistoryKey: LEAGUE_ID_HISTORY_KEY,
    sleeperUsername,
    userLeagues,
    viewerUserId,
    viewerUsername,
    setCachedSleeperUsers,
    setLeagueIdHistory,
  });

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

  const {
    applyCachedReport,
    refreshReportInBackground,
    restoreFreshCachedReportForLeague,
  } = useHomeCachedReportActions({
    activeAnalysisLeagueIdRef,
    analysisModeRef,
    backgroundRefreshLeagueIdRef,
    lastBackgroundRefreshAtRef,
    leagueIdHistoryKey: LEAGUE_ID_HISTORY_KEY,
    prefetchDebounceMs: REPORT_CACHE_PREFETCH_DEBOUNCE_MS,
    queueReportVisibleTelemetry,
    onAnalyzeReport: variables => analyzeMutation.mutate(variables),
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
  });

  useHomeReportIdentityRecovery({
    activeTab,
    activeAnalysisLeagueIdRef,
    beginAnalysisLoading,
    leagueId,
    reportData,
    restoreFreshCachedReportForLeague,
    userLeagues,
    viewerUserId,
    rememberLeagueId,
    onAnalyzeReport: variables => analyzeMutation.mutate(variables),
    setActiveTab,
    setAnalysisCompleteMessage,
    setLeagueId,
    setPendingAnalysisLeague,
    setReportData,
    setReportDataCacheVersion,
  });

  const { isLeagueRanksPending } = useHomeLeagueIntelRanks({
    sleeperSessionKey: SLEEPER_SESSION_KEY,
    sleeperUsername,
    userLeagues,
    viewerUserId,
    viewerUsername,
    setIsLeagueIntelLoading,
    setUserLeagues,
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

  const {
    handleClownDismiss,
    handleFindLeagues,
    isFindLeaguesPending,
  } = useHomeSleeperLeagueSearch({
    clownUsernames: CLOWN_EASTER_EGG_USERNAMES,
    sleeperSessionKey: SLEEPER_SESSION_KEY,
    sleeperUsername,
    sleeperUsernameHistoryKey: SLEEPER_USERNAME_HISTORY_KEY,
    setAdminViewMode,
    setAdminViewerManager,
    setAnalysisErrorMessage,
    setCachedSleeperUsers,
    setFocusedAutocomplete,
    setIsClownModalOpen,
    setIsLeagueIntelLoading,
    setIsLeaguePickerOpen,
    setPortfolioSearch,
    setSleeperUsername,
    setSleeperUsernameHistory,
    setUserLeagues,
    setViewerUserId,
    setViewerUsername,
  });

  const {
    handleAnalyzeAnotherLeague,
    handleAnalyzeLeagueOption,
    handleCancelLoading,
    handleHeaderLeagueClick,
    handleRetryLoading,
    handleStartOver,
  } = useHomeNavigationActions({
    activeAnalysisLeagueIdRef,
    analysisModeRef,
    analyzeRequestStartedAtRef,
    clearSuccessTransitionTimers,
    lastLeagueKey: LAST_LEAGUE_KEY,
    leagueId,
    reportData,
    reportLoadStartedAtRef,
    sleeperSessionKey: SLEEPER_SESSION_KEY,
    userLeagues,
    handleAnalyze,
    setActiveTab,
    setAdminPassphrase,
    setAdminViewMode,
    setAdminViewerManager,
    setAnalysisCompleteMessage,
    setAnalysisErrorMessage,
    setHasLoadingTimedOut,
    setIsAdminAccessModalOpen,
    setIsChangeLeagueModalOpen,
    setIsLeagueIntelLoading,
    setIsLeaguePickerOpen,
    setIsLoading,
    setLeagueFormat,
    setLeagueId,
    setLeagueLogo,
    setLeagueName,
    setLoadingManagerAnchors,
    setLoadingTransitionPhase,
    setPendingAnalysisLeague,
    setPortfolioSearch,
    setReportData,
    setSleeperUsername,
    setUserLeagues,
    setViewerUserId,
    setViewerUsername,
  });

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
  const {
    rankingsForReport,
    rankingsQueryIsLoading,
    reportDataWithRankings,
  } = useHomeReportRankings({
    leagueId,
    reportData,
  });
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
      isAdminLoginPending={isAdminLoginPending}
      onAdminAccessOpenChange={handleAdminAccessOpenChange}
      onAdminPassphraseChange={setAdminPassphrase}
      onAdminSubmit={handleAdminSubmit}
      onAdminStayRegularView={handleAdminStayRegularView}
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
        rankingsQueryIsLoading={rankingsQueryIsLoading}
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
        isFindLeaguesPending={isFindLeaguesPending}
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
