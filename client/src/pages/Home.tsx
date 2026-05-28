import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "@/styles/home-backgrounds-v12.css";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";
import { type PremiumFxVariant } from "@/components/PremiumFxLayer";
import {
  buildLeagueFormatPills,
  getReportManagerNames,
} from "@/features/report/lib/reportOverviewPreview";
import { getReportDashboardManagers } from "@/features/report/components/ReportDashboardShowcase";
import { ReportDashboardShell } from "@/features/report/components/ReportDashboardShell";
import { ReportDashboardContent } from "@/features/report/components/ReportDashboardContent";
import { HomeSignedOutLanding } from "@/features/home/components/HomeSignedOutLanding";
import { HomeDialogsContainer } from "@/features/home/components/HomeDialogsContainer";
import { type OwnerIntelSortMode } from "@/features/report/components/OwnerIntelControls";
import {
  buildHomePortfolioRows,
  filterHomePortfolioRows,
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
  getLoadingSuccessTitleClassName,
  MAX_AUTOCOMPLETE_HISTORY,
  readAutocompleteHistory,
  rememberAutocompleteValue,
} from "@/features/home/lib/inputHelpers";
import {
  AdminAuthUser,
  canViewAdminTelemetryForUser,
  persistReportLoadTelemetry,
  readAdminPassphraseVerifiedForSession,
  rememberAdminPassphraseVerifiedForSession,
  ReportAnalysisMode,
  ReportLoadCacheStatus,
  ReportLoadSource,
  type ReportLoadTelemetryEvent,
} from "@/features/home/lib/adminSessionState";
import {
  getInitialReportLeagueIdFromUrl,
  getInitialReportTabFromUrl,
  normalizeReportTab,
  REPORT_TAB_VALUES,
  updateReportTabUrl,
} from "@/features/home/lib/reportRouteState";
import {
  buildReportDeltaChanges,
  buildReportDeltaSnapshot,
  readReportDeltaSnapshot,
  type ReportDeltaSnapshot,
  writeReportDeltaSnapshot,
} from "@/features/home/lib/reportDelta";
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
  showMutationErrorToast,
  withReportDataLeagueId,
  writeBrowserReportCache,
} from "@/features/home/lib/reportCache";
import {
  type AnalysisLeaguePreview,
  type CachedSleeperUser,
  type LeagueRankResult,
  type SleeperLeagueOption,
  type SleeperUserSession,
  buildCachedSleeperUser,
  buildLoadingManagerAnchors,
  buildPreviewLoadingManagerAnchors,
  findCachedSleeperUser,
  findKnownSleeperLeague,
  getAnalysisLeaguePreview,
  getLeagueIdAnalysisPreview,
  getOrderedLeagueOptions,
  mergeLeagueRanks,
  readCachedSleeperUsers,
  rememberCachedSleeperLeagueShortcut,
  rememberCachedSleeperUser,
} from "@/features/home/lib/leagueHistory";
import {
  type HomeLeagueSelectionLeague,
  type HomePortfolioRow,
} from "@/features/home/components/HomeLeagueSelection";
import {
  type ReportDeltaTone,
} from "@/features/report/components/ReportDeltaBrief";
import {
  type AnalysisLoadingLeague,
  type LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import {
  getLeagueModeCopy,
  normalizeLeagueValueMode,
} from "@/lib/leagueValueMode";
import {
  getBestDraftAdpValueManager,
  getBestDraftSignalManager,
  getWorstDraftAdpValueManager,
} from "@/lib/draftDashboardMetrics";
import { sanitizeCachedReport } from "@/lib/reportCacheSanitizer";
import type { ReportData } from "@shared/types";
import {
  buildAIPredictionEventsForReport,
  getAIPredictionEventBatchSignature,
} from "@/lib/aiPredictionEvents";
import {
  AI_VOICE_MODE_CHANGE_EVENT,
  getAIVoiceMode,
  getAIVoiceModeLabel,
  setAIVoiceMode as persistAIVoiceMode,
  type AIVoiceMode,
} from "@/lib/aiVoice";

const DYNASTY_MOBILE_REPORT_LOGO_SRC =
  "/brand/logos/png/mobile-dd-stacked-transparent.png?v=20260519-mobile-transparent";
const DYNASTY_REPORT_HEADER_LOGO_SRC =
  "/brand/logos/uploads/report-header-logo-compact-transparent-cropped.png?v=20260518-compact-crop";
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
const SHOW_LEGACY_LEAGUE_ID_LOGIN = true;
const SHOW_ASSISTANT_FEATURE_RADAR =
  String(
    import.meta.env.VITE_SHOW_ASSISTANT_FEATURE_RADAR || "true"
  ).toLowerCase() !== "false";

export default function Home() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const utils = trpc.useUtils();
  const lastAiPredictionBatchSignatureRef = useRef("");
  const aiPredictionMutation = trpc.aiPredictions.upsertMany.useMutation({
    retry: false,
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
  const [aiVoiceMode, setAiVoiceMode] = useState<AIVoiceMode>(() =>
    getAIVoiceMode()
  );
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportScanCompletedAt, setReportScanCompletedAt] = useState<
    number | null
  >(null);
  const [previousReportDeltaSnapshot, setPreviousReportDeltaSnapshot] =
    useState<ReportDeltaSnapshot | null>(null);
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
  const [previewLoadingLoopTick, setPreviewLoadingLoopTick] = useState(0);
  const previewMode =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("preview");

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (previewMode === 'loading' || previewMode === 'success') {
      setIsLoading(true);
      const previewLeague = {
        leagueName: 'The Fantasy Degenerates',
        leagueFormat: '12-Team Dynasty SF PPR TEP',
        leagueLogo: '/favicon-32x32.png',
      };
      if (previewMode === 'success') {
        setLoadingTransitionPhase("success");
        setAnalysisCompleteMessage(previewLeague);
        setLoadingManagerAnchors([]);
      } else {
        setLoadingTransitionPhase("loading");
        setPendingAnalysisLeague(previewLeague);
        setAnalysisCompleteMessage(null);
        setLoadingManagerAnchors(buildPreviewLoadingManagerAnchors());
      }
      return;
    }

    if (previewMode === "loading-loop") {
      const previewLeague = {
        leagueName: "The Fantasy Degenerates",
        leagueFormat: "12-Team Dynasty SF PPR TEP",
        leagueLogo: "/favicon-32x32.png",
      };
      setIsLoading(true);
      setLoadingTransitionPhase("loading");
      setPendingAnalysisLeague(previewLeague);
      setAnalysisCompleteMessage(null);
      setLoadingManagerAnchors(buildPreviewLoadingManagerAnchors());
      setPreviewLoadingLoopTick(0);

      const timer = window.setInterval(() => {
        setLoadingTransitionPhase("loading");
        setIsLoading(true);
        setPendingAnalysisLeague(previewLeague);
        setAnalysisCompleteMessage(null);
        setLoadingManagerAnchors(buildPreviewLoadingManagerAnchors());
        setPreviewLoadingLoopTick(tick => tick + 1);
      }, 8800);

      return () => window.clearInterval(timer);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncVoiceMode = () => setAiVoiceMode(getAIVoiceMode());
    window.addEventListener("storage", syncVoiceMode);
    window.addEventListener(AI_VOICE_MODE_CHANGE_EVENT, syncVoiceMode);
    return () => {
      window.removeEventListener("storage", syncVoiceMode);
      window.removeEventListener(AI_VOICE_MODE_CHANGE_EVENT, syncVoiceMode);
    };
  }, []);

  const handleAIVoiceModeChange = (mode: AIVoiceMode) => {
    const nextMode = persistAIVoiceMode(mode);
    setAiVoiceMode(nextMode);
    toast.success(`AI voice set to ${getAIVoiceModeLabel(nextMode)}.`);
  };

  const [pendingAnalysisLeague, setPendingAnalysisLeague] =
    useState<AnalysisLeaguePreview | null>(null);
  const [isLeaguePickerOpen, setIsLeaguePickerOpen] = useState(false);
  const [isChangeLeagueModalOpen, setIsChangeLeagueModalOpen] = useState(false);
  const [isClownModalOpen, setIsClownModalOpen] = useState(false);
  const [isAdminUnlockModalOpen, setIsAdminUnlockModalOpen] = useState(false);
  const [isAdminAccessModalOpen, setIsAdminAccessModalOpen] = useState(false);
  const [adminPassphrase, setAdminPassphrase] = useState("");
  const [
    isAdminPassphraseVerifiedForSession,
    setIsAdminPassphraseVerifiedForSession,
  ] = useState(readAdminPassphraseVerifiedForSession);
  const [loadingTransitionPhase, setLoadingTransitionPhase] =
    useState<LoadingTransitionPhase>("loading");
  const successTransitionTimerRefs = useRef<number[]>([]);
  const activeAnalysisLeagueIdRef = useRef<string | null>(null);
  const reportLoadStartedAtRef = useRef<number | null>(null);
  const analyzeRequestStartedAtRef = useRef<{
    leagueId: string;
    startedAt: number;
  } | null>(null);
  const analysisModeRef = useRef<ReportAnalysisMode>("blocking");
  const backgroundRefreshLeagueIdRef = useRef<string | null>(null);
  const lastBackgroundRefreshAtRef = useRef<Record<string, number>>({});
  const appBootStartedAtRef = useRef(
    typeof performance !== "undefined" ? performance.now() : Date.now()
  );
  const autopilotAccessToastShownRef = useRef(false);
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

  const clearSuccessTransitionTimers = () => {
    successTransitionTimerRefs.current.forEach(timer =>
      window.clearTimeout(timer)
    );
    successTransitionTimerRefs.current = [];
  };

  const queueSuccessTransitionTimer = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      successTransitionTimerRefs.current =
        successTransitionTimerRefs.current.filter(
          queuedTimer => queuedTimer !== timer
        );
      callback();
    }, delay);
    successTransitionTimerRefs.current.push(timer);
  };

  const queueReportVisibleTelemetry = (
    event: Omit<ReportLoadTelemetryEvent, "createdAt" | "visibleMs">
  ) => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const startedAt =
          event.source === "browser-cache"
            ? appBootStartedAtRef.current
            : reportLoadStartedAtRef.current || performance.now();
        persistReportLoadTelemetry({
          ...event,
          visibleMs: Math.round(performance.now() - startedAt),
          createdAt: new Date().toISOString(),
        });
        if (event.source === "server") {
          reportLoadStartedAtRef.current = null;
          analyzeRequestStartedAtRef.current = null;
        }
      });
    });
  };

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
      clearSuccessTransitionTimers();
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
    onError: error => {
      clearSuccessTransitionTimers();
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

  function persistSleeperSessionLeagues(nextLeagues: SleeperLeagueOption[]) {
    try {
      const sleeperSession = localStorage.getItem(SLEEPER_SESSION_KEY);
      if (!sleeperSession) return;
      const parsed = JSON.parse(sleeperSession) as SleeperSession;
      localStorage.setItem(
        SLEEPER_SESSION_KEY,
        JSON.stringify({
          ...parsed,
          leagues: nextLeagues,
          savedAt: Date.now(),
        } satisfies SleeperSession)
      );
    } catch {
      // Enriched league cards are a convenience cache; the loader can still fetch preview data.
    }
  }

  const userLeagueRanksMutation = trpc.league.getUserLeagueRanks.useMutation({
    onSuccess: data => {
      setUserLeagues(prev => {
        const nextLeagues = mergeLeagueRanks(prev, data.ranks);
        persistSleeperSessionLeagues(nextLeagues);
        return nextLeagues;
      });
      setIsLeagueIntelLoading(false);
    },
    onError: () => {
      setIsLeagueIntelLoading(false);
    },
  });
  const requestUserLeagueRanks = userLeagueRanksMutation.mutate;

  useEffect(() => {
    if (!viewerUserId || !sleeperUsername || !userLeagues.length) {
      setIsLeagueIntelLoading(false);
      return;
    }
    const validViewerUserId = getValidSleeperUserId(viewerUserId);
    if (!validViewerUserId) {
      setIsLeagueIntelLoading(false);
      return;
    }
    if (
      userLeagues.every(
        league =>
          league.standingsRank != null &&
          league.powerRank != null &&
          Array.isArray(league.managerAnchors)
      )
    ) {
      setIsLeagueIntelLoading(false);
      return;
    }

    setIsLeagueIntelLoading(true);
    requestUserLeagueRanks({
      username: sleeperUsername,
      userId: validViewerUserId,
      displayName: viewerUsername || sleeperUsername,
      leagueIds: userLeagues.map(league => league.leagueId),
    });
  }, [
    requestUserLeagueRanks,
    sleeperUsername,
    userLeagues,
    viewerUserId,
    viewerUsername,
  ]);

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
        persistAdminViewMode("regular");
      }
      toast.success(
        `Found ${data.leagues.length} Sleeper league${data.leagues.length === 1 ? "" : "s"}`
      );
      setIsLeaguePickerOpen(true);
    },
    onError: error => {
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
          setLeagueId(parsed.leagueId);
          setLeagueName(parsed.leagueName);
          setLeagueLogo(parsed.leagueLogo);
          setLeagueFormat(parsed.leagueFormat);
          setActiveTab(urlTab || parsed.activeTab || "overview");
          setLeagueIdHistory(
            rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, parsed.leagueId)
          );
          setPendingAnalysisLeague({
            leagueName: parsed.leagueName,
            leagueFormat: parsed.leagueFormat,
            leagueLogo: parsed.leagueLogo,
          });
          setLoadingTransitionPhase("loading");
          setIsLoading(true);
          analyzeMutation.mutate({
            leagueId: parsed.leagueId,
            viewerUserId:
              getValidSleeperUserId(restoredViewerUserId) || undefined,
          });
          return;
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
      localStorage.setItem(LAST_LEAGUE_KEY, JSON.stringify(lastLeague));
      writeBrowserReportCache({
        ...lastLeague,
        cacheVersion: REPORT_CACHE_DATA_VERSION,
        reportData: cacheReportData,
      });
    } catch {
      clearBrowserReportCache();
      try {
        localStorage.setItem(LAST_LEAGUE_KEY, JSON.stringify(lastLeague));
      } catch {
        localStorage.removeItem(LAST_LEAGUE_KEY);
      }
    }
  }, [activeTab, leagueFormat, leagueId, leagueLogo, leagueName, reportData]);

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
    refreshReportInBackground(leagueId, viewerUserId);
    // This intentionally runs when a preserved React Fast Refresh state has report data
    // from an older browser cache version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData, reportDataCacheVersion, leagueId, isLoading, viewerUserId]);

  const handleAnalyze = async (targetLeagueId = leagueId) => {
    const nextLeagueId = targetLeagueId.trim();
    if (!nextLeagueId) {
      toast.error("Please enter a league ID");
      return;
    }
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
      toast.error("Please enter a Sleeper username");
      return;
    }
    if (CLOWN_EASTER_EGG_USERNAMES.has(normalizedUsername.toLowerCase())) {
      setIsClownModalOpen(true);
      return;
    }
    setPortfolioSearch("");
    setIsLeagueIntelLoading(false);
    userLeaguesMutation.mutate({ username: normalizedUsername });
  };

  const handleClownDismiss = () => {
    setIsClownModalOpen(false);
    setSleeperUsername("");
    setPortfolioSearch("");
    setUserLeagues([]);
    setIsLeagueIntelLoading(false);
    setFocusedAutocomplete(null);
    setAdminViewMode(null);
    setAdminViewerManager(null);
  };

  const persistAdminViewMode = (mode: AdminViewMode) => {
    try {
      const sleeperSession = localStorage.getItem(SLEEPER_SESSION_KEY);
      if (!sleeperSession) return;
      const parsed = JSON.parse(sleeperSession) as SleeperSession;
      localStorage.setItem(
        SLEEPER_SESSION_KEY,
        JSON.stringify({
          ...parsed,
          adminViewMode: mode,
          savedAt: Date.now(),
        } satisfies SleeperSession)
      );
    } catch {
      // The view-mode choice only needs to last for this browser session.
    }
  };

  const handleAdminViewModeChoice = (mode: AdminViewMode) => {
    setAdminViewMode(mode);
    if (mode === "regular") {
      setAdminViewerManager(null);
    }
    persistAdminViewMode(mode);
    if (mode === "regular") {
      setActiveTab("overview");
    }
  };

  const handleAdminModeToggle = () => {
    handleAdminViewModeChoice(
      adminViewMode === "admin" ? "regular" : "admin"
    );
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
    setPendingAnalysisLeague(null);
    setLoadingTransitionPhase("loading");
    setLoadingManagerAnchors([]);
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

  const handleAnalyzeAnotherLeague = () => {
    if (userLeagues.length > 0) {
      setIsLeaguePickerOpen(true);
      return;
    }
    handleStartOver();
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
    isLeagueIntelLoading || userLeagueRanksMutation.isPending;
  const homePortfolioRows = useMemo(
    () => buildHomePortfolioRows(orderedUserLeagues),
    [orderedUserLeagues]
  );
  const filteredHomePortfolioRows = useMemo(
    () => filterHomePortfolioRows(homePortfolioRows, portfolioSearch),
    [homePortfolioRows, portfolioSearch]
  );
  const isHomePortfolioLoading =
    Boolean(orderedUserLeagues.length) &&
    Boolean(viewerUserId) &&
    userLeagueRanksMutation.isPending &&
    !homePortfolioRows.length;
  const showHomePortfolioPanel = false;
  const hasAuthenticatedAdminPermissions = canViewAdminTelemetryForUser(
    authQuery.data
  );
  const hasSleeperAdminPermissions =
    activeCachedSleeperUser?.hasAdminPermissions === true ||
    activeCachedSleeperUser?.isPrivilegedReportViewer === true;
  const hasAdminPermissions =
    hasAuthenticatedAdminPermissions || hasSleeperAdminPermissions;
  const canOpenAdminToolsEntry = hasAdminPermissions || !import.meta.env.PROD;
  const canViewAdminFeatureExpansion =
    isAdminPassphraseVerifiedForSession &&
    (hasAuthenticatedAdminPermissions
      ? adminViewMode === "admin"
      : hasSleeperAdminPermissions && adminViewMode === "admin");
  const canViewAdminDiagnostics = canViewAdminFeatureExpansion;

  useEffect(() => {
    if (
      !hasAuthenticatedAdminPermissions ||
      !reportData ||
      !canViewAdminFeatureExpansion
    )
      return;
    try {
      if (sessionStorage.getItem(ADMIN_UNLOCK_MODAL_DISMISSED_KEY) === "true")
        return;
    } catch {
      // Session storage only prevents repeating this prompt.
    }
    setIsAdminUnlockModalOpen(true);
  }, [
    canViewAdminFeatureExpansion,
    hasAuthenticatedAdminPermissions,
    reportData,
  ]);

  const handleAdminUnlockModalDismiss = () => {
    setIsAdminUnlockModalOpen(false);
    try {
      sessionStorage.setItem(ADMIN_UNLOCK_MODAL_DISMISSED_KEY, "true");
    } catch {
      // Non-critical preference.
    }
  };

  const handleAdminToolsClick = () => {
    if (canOpenAdminToolsEntry) {
      if (!isAdminPassphraseVerifiedForSession) {
        setAdminPassphrase("");
        setIsAdminAccessModalOpen(true);
        return;
      }
      handleAdminModeToggle();
      return;
    }

    setAdminPassphrase("");
    setIsAdminAccessModalOpen(true);
  };

  const migratedActiveTab =
    activeTab === "projections" ? "rankings" : activeTab;
  const canViewAutopilotTab = canViewAdminFeatureExpansion;
  const tabLeagueValueMode = normalizeLeagueValueMode(
    reportData?.leagueDiagnostics?.valueMode || reportData?.leagueValueMode
  );
  const shouldShowDraftHistoryTab =
    tabLeagueValueMode !== "redraft" || hasDraftReportData(reportData);
  const shouldDeferAutopilotUrlSync =
    migratedActiveTab === "autopilot" &&
    !canViewAutopilotTab &&
    authQuery.isLoading;
  const resolvedActiveTab =
    migratedActiveTab === "draft" && !shouldShowDraftHistoryTab
      ? "overview"
      : migratedActiveTab === "autopilot" && !canViewAutopilotTab
      ? "overview"
      : migratedActiveTab;
  const visibleReportTabCount =
    4 + (canViewAutopilotTab ? 1 : 0) + (shouldShowDraftHistoryTab ? 1 : 0);
  const reportTabsClassName = `report-tabs report-tabs-${visibleReportTabCount === 6 ? "six" : visibleReportTabCount === 5 ? "five" : "four"}`;
  const visibleReportTabIds = [
    "overview",
    ...(canViewAutopilotTab ? ["autopilot"] : []),
    "momentum",
    "rankings",
    "trades",
    ...(shouldShowDraftHistoryTab ? ["draft"] : []),
  ];
  const resolvedReportTabIndex = Math.max(
    0,
    visibleReportTabIds.indexOf(resolvedActiveTab)
  );
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
  const aiPredictionEvents = useMemo(
    () =>
      buildAIPredictionEventsForReport({
        reportData: reportDataWithRankings,
        leagueId,
        leagueName,
        manager: reportDataWithRankings?.viewerManager || null,
      }),
    [leagueId, leagueName, reportDataWithRankings]
  );
  const aiPredictionBatchSignature = useMemo(
    () => getAIPredictionEventBatchSignature(aiPredictionEvents),
    [aiPredictionEvents]
  );

  useEffect(() => {
    if (!authQuery.data || !aiPredictionEvents.length || !aiPredictionBatchSignature) {
      return;
    }
    if (lastAiPredictionBatchSignatureRef.current === aiPredictionBatchSignature) {
      return;
    }
    lastAiPredictionBatchSignatureRef.current = aiPredictionBatchSignature;
    aiPredictionMutation.mutate({ events: aiPredictionEvents });
  }, [
    aiPredictionBatchSignature,
    aiPredictionEvents,
    aiPredictionMutation,
    authQuery.data,
  ]);
  const currentReportDeltaSnapshot = useMemo(
    () =>
      reportDataWithRankings
        ? buildReportDeltaSnapshot(reportDataWithRankings, leagueId, leagueName)
        : null,
    [leagueId, leagueName, reportDataWithRankings]
  );
  const showAutopilotAccessToast = () => {
    if (autopilotAccessToastShownRef.current) return;
    autopilotAccessToastShownRef.current = true;
    toast.info("AI Autopilot is available in admin mode for now.");
  };
  const handleReportTabChange = (nextTab: string) => {
    const isBlockedAutopilotTab =
      nextTab === "autopilot" && !canViewAutopilotTab;
    const isBlockedDraftTab =
      nextTab === "draft" && !shouldShowDraftHistoryTab;
    if (isBlockedAutopilotTab) {
      showAutopilotAccessToast();
    }
    const allowedNextTab =
      isBlockedAutopilotTab || isBlockedDraftTab ? "overview" : nextTab;
    setActiveTab(allowedNextTab);
    updateReportTabUrl(allowedNextTab, leagueId);
  };
  const handleScoutLeaguemates = () => {
    setActiveTab("rankings");
    updateReportTabUrl("rankings", leagueId);
    window.setTimeout(() => {
      setRosterScannerFocusKey(current => current + 1);
    }, 0);
  };

  useEffect(() => {
    if (
      activeTab === "autopilot" &&
      !canViewAutopilotTab &&
      !authQuery.isLoading
    ) {
      showAutopilotAccessToast();
      setActiveTab("overview");
      updateReportTabUrl("overview", leagueId);
      return;
    }

    if (activeTab === "projections") {
      setActiveTab("rankings");
      updateReportTabUrl("rankings", leagueId);
    }
  }, [activeTab, authQuery.isLoading, canViewAutopilotTab, leagueId]);

  useEffect(() => {
    setReportScanCompletedAt(reportData ? Date.now() : null);
  }, [reportData]);

  useEffect(() => {
    if (!currentReportDeltaSnapshot) {
      setPreviousReportDeltaSnapshot(null);
      return;
    }

    const previousSnapshot = readReportDeltaSnapshot(
      currentReportDeltaSnapshot.leagueId
    );
    setPreviousReportDeltaSnapshot(previousSnapshot);
    writeReportDeltaSnapshot(currentReportDeltaSnapshot);
  }, [currentReportDeltaSnapshot]);

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

    const getAgeMs = () =>
      Date.now() - (reportScanCompletedAt || Date.now());
    const refreshIfNeeded = () => {
      if (getAgeMs() < REPORT_BACKGROUND_REFRESH_AFTER_MS) return;
      refreshReportInBackground(leagueId, viewerUserId);
    };
    const delay = Math.max(
      REPORT_BACKGROUND_REFRESH_AFTER_MS - getAgeMs(),
      REPORT_CACHE_PREFETCH_DEBOUNCE_MS
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
    reportData,
    reportDataCacheVersion,
    reportScanCompletedAt,
    viewerUserId,
  ]);

  useEffect(() => {
    if (!reportData || activeTab !== "draft" || shouldShowDraftHistoryTab)
      return;

    setActiveTab("overview");
    updateReportTabUrl("overview", leagueId);
  }, [activeTab, leagueId, reportData, shouldShowDraftHistoryTab]);

  useEffect(() => {
    if (!reportData || !leagueId) return;
    if (shouldDeferAutopilotUrlSync) return;
    updateReportTabUrl(resolvedActiveTab, leagueId);
  }, [leagueId, reportData, resolvedActiveTab, shouldDeferAutopilotUrlSync]);

  useEffect(() => {
    if (!reportData) return;
    const syncTabFromUrl = () => {
      const tabFromUrl = getInitialReportTabFromUrl();
      if (!tabFromUrl) return;
      setActiveTab(tabFromUrl);
    };
    syncTabFromUrl();
    window.addEventListener("hashchange", syncTabFromUrl);
    return () => window.removeEventListener("hashchange", syncTabFromUrl);
  }, [reportData]);

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
  const loadingSuccessCardClassName = [
    "loading-success-card",
    analysisCompleteMessage?.leagueLogo ? "loading-success-card-logo" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const reportFxVariant: PremiumFxVariant =
    resolvedActiveTab === "trades"
      ? "trade-flow"
      : resolvedActiveTab === "momentum"
        ? "waiver-radar"
        : resolvedActiveTab === "rankings"
          ? "rankings-grid"
          : resolvedActiveTab === "autopilot"
            ? "autopilot-orbit"
            : "report-shell";
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
    />
  );
  if (reportData && !analysisCompleteMessage) {
    const leagueValueMode = normalizeLeagueValueMode(
      reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
    );
    const isRedraftReport = leagueValueMode === "redraft";
    const modeCopy = getLeagueModeCopy(leagueValueMode);
    const reportDataBase = reportDataWithRankings || reportData;
    const selectedViewerManager = canViewAdminFeatureExpansion
      ? (adminViewerManager ?? reportDataBase.viewerManager ?? null)
      : (reportDataBase.viewerManager ?? null);
    const reportManagerNames = getReportManagerNames(
      reportDataBase,
      selectedViewerManager
    );
    const effectiveViewerManager =
      selectedViewerManager && reportManagerNames.includes(selectedViewerManager)
        ? selectedViewerManager
        : null;
    const reportDataForView: ReportData = {
      ...reportDataBase,
      viewerManager: effectiveViewerManager,
    };
    const dashboardManagers = getReportDashboardManagers(reportDataForView);
    const dashboardViewerManager =
      effectiveViewerManager || dashboardManagers[0] || null;
    const hasManagerViewOptions = reportManagerNames.length > 1;
    const showTradeMarketRadar =
      reportData.weeklyRisers.some(player => player.val_now >= 2500) ||
      reportData.weeklyFallers.some(player => player.val_now >= 1800);
    const reportDeltaChanges = currentReportDeltaSnapshot
      ? buildReportDeltaChanges(
          previousReportDeltaSnapshot,
          currentReportDeltaSnapshot
        )
      : [];
    return (
      <>
        <ReportDashboardShell
          isLoadingRevealPhase={isLoadingRevealPhase}
          aiVoiceMode={aiVoiceMode}
          resolvedActiveTab={resolvedActiveTab}
          reportFxVariant={reportFxVariant}
          onReportTabChange={handleReportTabChange}
          hasAdminPermissions={hasAdminPermissions}
          canViewAutopilotTab={canViewAutopilotTab}
          shouldShowDraftHistoryTab={shouldShowDraftHistoryTab}
          reportTabsClassName={reportTabsClassName}
          reportTabsStyle={reportTabsStyle}
          leagueName={leagueName}
          leagueFormatPills={leagueFormatPills}
          leagueLogo={leagueLogo}
          leagueLogoInitials={leagueLogoInitials}
          onHeaderLeagueClick={handleHeaderLeagueClick}
          onAnalyzeAnotherLeague={handleAnalyzeAnotherLeague}
          mobileLogoSrc={DYNASTY_MOBILE_REPORT_LOGO_SRC}
          headerLogoSrc={DYNASTY_REPORT_HEADER_LOGO_SRC}
          isChangeLeagueModalOpen={isChangeLeagueModalOpen}
          onChangeLeagueOpenChange={setIsChangeLeagueModalOpen}
          onChangeLeagueStay={() => setIsChangeLeagueModalOpen(false)}
          onStartOver={handleStartOver}
          canOpenAdminToolsEntry={canOpenAdminToolsEntry}
          canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
          isAdminPassphraseVerifiedForSession={
            isAdminPassphraseVerifiedForSession
          }
          hasManagerViewOptions={hasManagerViewOptions}
          reportManagerNames={reportManagerNames}
          effectiveViewerManager={effectiveViewerManager}
          managerAvatars={reportData.managerAvatars}
          leagueId={leagueId}
          leagueFormat={leagueFormat}
          onAIVoiceModeChange={handleAIVoiceModeChange}
          onAdminToolsClick={handleAdminToolsClick}
          onAdminViewerManagerChange={setAdminViewerManager}
          managerChampionships={reportData.managerChampionships}
        >
          <ReportDashboardContent
            canViewAdminDiagnostics={canViewAdminDiagnostics}
            canViewAdminFeatureExpansion={canViewAdminFeatureExpansion}
            canViewAutopilotTab={canViewAutopilotTab}
            dashboardViewerManager={dashboardViewerManager}
            isRedraftReport={isRedraftReport}
            leagueFormat={leagueFormat}
            leagueId={leagueId}
            leagueLogo={leagueLogo}
            leagueName={leagueName}
            leagueRosterScannerMode={leagueRosterScannerMode}
            leagueValueMode={leagueValueMode}
            onAnalyze={handleAnalyze}
            onOwnerIntelSortModeChange={setOwnerIntelSortMode}
            onScoutLeaguemates={handleScoutLeaguemates}
            ownerIntelSortMode={ownerIntelSortMode}
            ownerTitle={modeCopy.ownerTitle}
            ownerKicker={modeCopy.ownerKicker}
            previousSavedAt={currentReportDeltaSnapshot?.savedAt}
            rankingsForReport={rankingsForReport}
            rankingsQueryIsLoading={rankingsQuery.isLoading}
            reportData={reportData}
            reportDataForView={reportDataForView}
            reportDeltaChanges={reportDeltaChanges}
            resolvedActiveTab={resolvedActiveTab}
            rosterScannerFocusKey={rosterScannerFocusKey}
            rosterTitle={modeCopy.rosterTitle}
            rosterKicker={modeCopy.rosterKicker}
            setLeagueRosterScannerMode={setLeagueRosterScannerMode}
            showAssistantFeatureRadar={SHOW_ASSISTANT_FEATURE_RADAR}
            showTradeMarketRadar={showTradeMarketRadar}
            shouldShowDraftHistoryTab={shouldShowDraftHistoryTab}
            tradeWarKicker={modeCopy.tradeWarKicker}
            effectiveViewerManager={effectiveViewerManager}
          />
        </ReportDashboardShell>
        {homeDialogs}
      </>
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
        onPortfolioSearchChange={setPortfolioSearch}
        onAnalyzeLeagueOption={handleAnalyzeLeagueOption}
        leagueId={leagueId}
        sleeperUsername={sleeperUsername}
        onSleeperUsernameChange={setSleeperUsername}
        usernameAutocompleteHistory={sleeperUsernameHistory}
        leagueIdHistory={leagueIdHistory}
        onLeagueIdChange={setLeagueId}
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
