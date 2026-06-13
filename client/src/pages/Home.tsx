import {
  useEffect,
  useRef,
  useState,
} from "react";
import { trpc } from "@/lib/trpc";
import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";
import { HomeSignedOutLanding } from "@/features/home/components/HomeSignedOutLanding";
import { HomeDialogsContainer } from "@/features/home/components/HomeDialogsContainer";
import { HomeReportExperience } from "@/features/home/components/HomeReportExperience";
import { useHomeAdminAccess } from "@/features/home/hooks/useHomeAdminAccess";
import { useHomeAdminLogin } from "@/features/home/hooks/useHomeAdminLogin";
import { useHomeAnalysisLoading } from "@/features/home/hooks/useHomeAnalysisLoading";
import { useHomeAIVoiceMode } from "@/features/home/hooks/useHomeAIVoiceMode";
import { useHomeAIPredictionTelemetry } from "@/features/home/hooks/useHomeAIPredictionTelemetry";
import { useHomeCachedReportActions } from "@/features/home/hooks/useHomeCachedReportActions";
import { useHomeCachedSessionRestore } from "@/features/home/hooks/useHomeCachedSessionRestore";
import { useHomeLoadingTimeout } from "@/features/home/hooks/useHomeLoadingTimeout";
import { useHomeLeagueHistoryActions } from "@/features/home/hooks/useHomeLeagueHistoryActions";
import { useHomeLeagueIntelRanks } from "@/features/home/hooks/useHomeLeagueIntelRanks";
import { useHomeNavigationActions } from "@/features/home/hooks/useHomeNavigationActions";
import { useHomePortfolio } from "@/features/home/hooks/useHomePortfolio";
import { useHomePreviewMode } from "@/features/home/hooks/useHomePreviewMode";
import { useHomeReportIdentityRecovery } from "@/features/home/hooks/useHomeReportIdentityRecovery";
import { useHomeReportAnalysis } from "@/features/home/hooks/useHomeReportAnalysis";
import { useHomeSleeperLeagueSearch } from "@/features/home/hooks/useHomeSleeperLeagueSearch";
import { usePersistHomeReportCache } from "@/features/home/hooks/usePersistHomeReportCache";
import { useHomeReportRankings } from "@/features/home/hooks/useHomeReportRankings";
import { useHomeReportTabActions } from "@/features/home/hooks/useHomeReportTabActions";
import { useHomeViewState } from "@/features/home/hooks/useHomeViewState";
import { useQueuedTimeouts } from "@/features/home/hooks/useQueuedTimeouts";
import { useReportBackgroundRefresh } from "@/features/home/hooks/useReportBackgroundRefresh";
import { useReportLoadTelemetry } from "@/features/home/hooks/useReportLoadTelemetry";
import { useReportDeltaSnapshots } from "@/features/home/hooks/useReportDeltaSnapshots";
import { useStaleReportCacheRefresh } from "@/features/home/hooks/useStaleReportCacheRefresh";
import { type OwnerIntelSortMode } from "@/features/report/components/OwnerIntelControls";
import {
  type HomePortfolioExposureFilter,
} from "@/features/home/lib/portfolioRows";
import { type AdminViewMode } from "@/features/home/lib/adminMode";
import { readAutocompleteHistory } from "@/features/home/lib/inputHelpers";
import {
  readAdminPassphraseVerifiedForSession,
  ReportAnalysisMode,
} from "@/features/home/lib/adminSessionState";
import {
  getInitialReportTabFromUrl,
} from "@/features/home/lib/reportRouteState";
import {
  REPORT_CACHE_KEY,
  REPORT_CACHE_MAX_AGE_MS,
  STALE_REPORT_CACHE_KEYS,
} from "@/features/home/lib/reportCache";
import {
  getViewportBucket,
  trackFirstSessionFunnelEvent,
} from "@/features/home/lib/firstSessionTelemetry";
import {
  SAMPLE_REPORT_LEAGUE_FORMAT,
  SAMPLE_REPORT_LEAGUE_ID,
  SAMPLE_REPORT_LEAGUE_NAME,
  createSampleReportData,
} from "@/features/home/lib/sampleReport";
import {
  type AnalysisLeaguePreview,
  type CachedSleeperUser,
  type SleeperLeagueOption,
  findCachedSleeperUser,
  getOrderedLeagueOptions,
  readCachedSleeperUsers,
} from "@/features/home/lib/leagueHistory";
import {
  type AnalysisLoadingLeague,
  type LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
import {
  getBestDraftAdpValueManager,
  getBestDraftSignalManager,
  getWorstDraftAdpValueManager,
} from "@/lib/draftDashboardMetrics";
import type { ReportData, SleeperExtensionTradeCenterSnapshot } from "@shared/types";

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
const REPORT_LOADING_TIMEOUT_MS = 10_000;
const REPORT_SUCCESS_HANDOFF_FAILSAFE_MS = 2_200;
const SHOW_LEGACY_LEAGUE_ID_LOGIN = true;
const CURRENT_PENDING_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type SleeperTradeCenterImportSummary = {
  transactionCount: number;
  tradeCount: number;
  waiverCount: number;
};

type TradeProposalSignal = NonNullable<ReportData["tradeProposalSignals"]>[number];
type SleeperWaiverSignal = NonNullable<ReportData["adminSleeperWaiverSignals"]>[number];

type SleeperSignalWithIdentity = {
  id?: string | number | null;
  date?: string | null;
  status?: string | null;
};

type SleeperTradeCenterImportResult = SleeperTradeCenterImportSummary & {
  leagueId: string;
  sleeperHiddenLeagueSnapshot: NonNullable<ReportData["sleeperHiddenLeagueSnapshot"]>;
  tradeProposalSignals: NonNullable<ReportData["adminSleeperTradeProposalSignals"]>;
  waiverSignals: NonNullable<ReportData["adminSleeperWaiverSignals"]>;
  currentPositionRankById?: NonNullable<ReportData["currentPositionRankById"]>;
};

type SleeperTradeCenterImportDisplayPatch = Pick<
  SleeperTradeCenterImportResult,
  | "leagueId"
  | "sleeperHiddenLeagueSnapshot"
  | "tradeProposalSignals"
  | "waiverSignals"
  | "currentPositionRankById"
>;

function isPendingSleeperSignalStatus(status?: string | null): boolean {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized.includes("pending") || normalized.includes("proposed");
}

function isCurrentPendingSignalDate(date?: string | null): boolean {
  const timestamp = Date.parse(String(date || ""));
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp <= CURRENT_PENDING_MAX_AGE_MS;
}

function filterPendingSleeperSignals<TSignal extends SleeperSignalWithIdentity>(
  signals: TSignal[] | undefined
): TSignal[] {
  return (signals || []).filter(signal =>
    isPendingSleeperSignalStatus(signal.status) &&
    isCurrentPendingSignalDate(signal.date)
  );
}

function mergeSleeperSignalLists<TSignal extends SleeperSignalWithIdentity>(
  current: TSignal[] | undefined,
  imported: TSignal[] | undefined
): TSignal[] {
  const byId = new Map<string, TSignal>();
  const fallbackKeys = new WeakMap<TSignal, string>();

  [...(current || []), ...(imported || [])].forEach((signal, index) => {
    const explicitId = signal.id === null || signal.id === undefined
      ? ""
      : String(signal.id).trim();
    const fallbackKey =
      fallbackKeys.get(signal) ||
      `${signal.date || "unknown-date"}:${index}`;
    fallbackKeys.set(signal, fallbackKey);
    byId.set(explicitId || fallbackKey, signal);
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = Date.parse(a.date || "");
    const bTime = Date.parse(b.date || "");
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
    if (Number.isFinite(aTime)) return -1;
    if (Number.isFinite(bTime)) return 1;
    return 0;
  });
}

function mapSleeperWaiverSignalToTradeProposalSignal(
  signal: SleeperWaiverSignal
): TradeProposalSignal {
  const playerNames = Array.from(
    new Set([...(signal.playerNames || []), ...(signal.dropPlayerNames || [])])
  );
  const playerIds = Array.from(
    new Set([...(signal.playerIds || []), ...(signal.dropPlayerIds || [])])
  );

  return {
    id: signal.id,
    date: signal.date,
    status: signal.status,
    managers: signal.managers,
    playerIds,
    playerNames,
    pickLabels: [],
    sourceType: "waiver",
    waiverAdds: {
      playerIds: signal.playerIds || [],
      playerNames: signal.playerNames || [],
    },
    waiverDrops: {
      playerIds: signal.dropPlayerIds || [],
      playerNames: signal.dropPlayerNames || [],
    },
    waiverBid: signal.bidAmount,
    note: signal.note,
  };
}

function applySleeperTradeCenterImportDisplayPatch(
  current: ReportData,
  patch: SleeperTradeCenterImportDisplayPatch | null,
  activeLeagueId: string
): ReportData {
  if (!patch || patch.leagueId !== activeLeagueId.trim()) return current;

  const importedDisplaySignals = [
    ...filterPendingSleeperSignals(patch.tradeProposalSignals),
    ...filterPendingSleeperSignals(patch.waiverSignals).map(
      mapSleeperWaiverSignalToTradeProposalSignal
    ),
  ];

  return {
    ...current,
    adminSleeperTradeProposalSignals: mergeSleeperSignalLists(
      filterPendingSleeperSignals(current.adminSleeperTradeProposalSignals),
      patch.tradeProposalSignals
    ),
    adminSleeperWaiverSignals: mergeSleeperSignalLists(
      filterPendingSleeperSignals(current.adminSleeperWaiverSignals),
      patch.waiverSignals
    ),
    currentPositionRankById: {
      ...(current.currentPositionRankById || {}),
      ...(patch.currentPositionRankById || {}),
    },
    tradeProposalSignals: mergeSleeperSignalLists(
      current.tradeProposalSignals,
      importedDisplaySignals
    ),
    sleeperHiddenLeagueSnapshot: patch.sleeperHiddenLeagueSnapshot,
  };
}

function setSampleReportUrl(active: boolean) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  params.delete("leagueId");
  params.delete("league");
  params.delete("tab");
  if (active) {
    params.set("demo", "sample");
  } else {
    params.delete("demo");
  }

  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

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
  const [isSampleReportActive, setIsSampleReportActive] = useState(false);
  const [
    sleeperTradeCenterImportDisplayPatch,
    setSleeperTradeCenterImportDisplayPatch,
  ] = useState<SleeperTradeCenterImportDisplayPatch | null>(null);
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
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    let hasSleeperSession = false;
    try {
      hasSleeperSession = Boolean(localStorage.getItem(SLEEPER_SESSION_KEY));
    } catch {
      hasSleeperSession = false;
    }
    trackFirstSessionFunnelEvent("Home Viewed", {
      trigger: "home",
      viewport: getViewportBucket(),
      hasLeagueParam: Boolean(searchParams.get("leagueId")),
      hasSleeperSession,
    });
  }, []);

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

  const { analyzeReport, handleAnalyze: handleAnalyzeReport } =
    useHomeReportAnalysis({
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
  });

  const handleAnalyze = async (targetLeagueId?: string) => {
    setIsSampleReportActive(false);
    setSampleReportUrl(false);
    await handleAnalyzeReport(targetLeagueId);
  };

  const handleViewSampleReport = (options?: { syncUrl?: boolean }) => {
    clearSuccessTransitionTimers();
    activeAnalysisLeagueIdRef.current = null;
    analyzeRequestStartedAtRef.current = null;
    backgroundRefreshLeagueIdRef.current = null;
    reportLoadStartedAtRef.current = null;
    analysisModeRef.current = "blocking";
    setIsSampleReportActive(true);
    setSleeperTradeCenterImportDisplayPatch(null);
    setAnalysisCompleteMessage(null);
    setAnalysisErrorMessage(null);
    setPendingAnalysisLeague(null);
    setHasLoadingTimedOut(false);
    setLoadingManagerAnchors([]);
    setLoadingTransitionPhase("done");
    setIsLoading(false);
    setIsReportRefreshing(false);
    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    setIsAdminAccessModalOpen(false);
    setAdminViewMode(null);
    setAdminViewerManager(null);
    setLeagueId(SAMPLE_REPORT_LEAGUE_ID);
    setLeagueName(SAMPLE_REPORT_LEAGUE_NAME);
    setLeagueLogo(null);
    setLeagueFormat(SAMPLE_REPORT_LEAGUE_FORMAT);
    setViewerUserId(null);
    setViewerUsername(null);
    setActiveTab("overview");
    setReportDataCacheVersion(null);
    setReportData(createSampleReportData());
    if (options?.syncUrl !== false) {
      setSampleReportUrl(true);
    }
    trackFirstSessionFunnelEvent("Analysis Started", {
      entryMethod: "sample_report",
      viewport: getViewportBucket(),
    });
    trackFirstSessionFunnelEvent("Report Visible", {
      entryMethod: "sample_report",
      viewport: getViewportBucket(),
      reportMode: "dynasty",
      reportSource: "sample",
      cacheStatus: "unknown",
      activeTab: "overview",
      elapsedMsBucket: "<1s",
      requestMsBucket: "<1s",
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") !== "sample") return;
    handleViewSampleReport({ syncUrl: false });
    // The demo deep link should hydrate once on initial page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    onAnalyzeReport: analyzeReport,
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
    onAnalyzeReport: analyzeReport,
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

  useHomeCachedSessionRestore({
    activeAnalysisLeagueIdRef,
    beginAnalysisLoading,
    lastLeagueKey: LAST_LEAGUE_KEY,
    leagueIdHistoryKey: LEAGUE_ID_HISTORY_KEY,
    reportCacheMaxAgeMs: REPORT_CACHE_MAX_AGE_MS,
    sleeperSessionKey: SLEEPER_SESSION_KEY,
    sleeperUsernameHistoryKey: SLEEPER_USERNAME_HISTORY_KEY,
    staleReportCacheKeys: STALE_REPORT_CACHE_KEYS,
    applyCachedReport,
    refreshReportInBackground,
    queueReportVisibleTelemetry,
    onAnalyzeReport: analyzeReport,
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
  });

  const reportDataForPrivateSideEffects = isSampleReportActive
    ? null
    : reportData;

  usePersistHomeReportCache({
    activeTab,
    lastLeagueKey: LAST_LEAGUE_KEY,
    leagueFormat,
    leagueId,
    leagueLogo,
    leagueName,
    reportData: reportDataForPrivateSideEffects,
  });

  useStaleReportCacheRefresh({
    reportData: reportDataForPrivateSideEffects,
    reportDataCacheVersion,
    leagueId,
    isLoading,
    viewerUserId,
    setReportDataCacheVersion,
    setAnalysisCompleteMessage,
    onRefreshReport: refreshReportInBackground,
  });
  useEffect(() => {
    if (!reportData || !analysisCompleteMessage) return;

    const failSafeTimer = window.setTimeout(() => {
      clearSuccessTransitionTimers();
      setLoadingTransitionPhase("done");
      setIsLoading(false);
      setLoadingManagerAnchors([]);
      setAnalysisCompleteMessage(null);
      setPendingAnalysisLeague(null);
      activeAnalysisLeagueIdRef.current = null;
    }, REPORT_SUCCESS_HANDOFF_FAILSAFE_MS);

    return () => window.clearTimeout(failSafeTimer);
  }, [
    analysisCompleteMessage,
    clearSuccessTransitionTimers,
    reportData,
    setAnalysisCompleteMessage,
    setIsLoading,
    setLoadingManagerAnchors,
    setLoadingTransitionPhase,
    setPendingAnalysisLeague,
  ]);

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
    handleStartOver: handleStartOverBase,
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
  const handleStartOver = () => {
    setIsSampleReportActive(false);
    setSampleReportUrl(false);
    handleStartOverBase();
  };
  const handleScanMyLeagueFromSample = () => {
    clearSuccessTransitionTimers();
    activeAnalysisLeagueIdRef.current = null;
    analyzeRequestStartedAtRef.current = null;
    backgroundRefreshLeagueIdRef.current = null;
    reportLoadStartedAtRef.current = null;
    analysisModeRef.current = "blocking";
    setIsSampleReportActive(false);
    setSampleReportUrl(false);
    setSleeperTradeCenterImportDisplayPatch(null);
    setAnalysisCompleteMessage(null);
    setAnalysisErrorMessage(null);
    setPendingAnalysisLeague(null);
    setHasLoadingTimedOut(false);
    setLoadingManagerAnchors([]);
    setLoadingTransitionPhase("loading");
    setIsLoading(false);
    setIsReportRefreshing(false);
    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    setIsAdminAccessModalOpen(false);
    setAdminViewMode(null);
    setAdminViewerManager(null);
    setLeagueId("");
    setLeagueName("");
    setLeagueLogo(null);
    setLeagueFormat("");
    setViewerUserId(null);
    setViewerUsername(null);
    setReportData(null);
    setReportDataCacheVersion(null);
    setActiveTab("overview");
    setFocusedAutocomplete("username");
    trackFirstSessionFunnelEvent("Sample Report CTA Clicked", {
      entryMethod: "sample_report",
      trigger: "sample_report",
      viewport: getViewportBucket(),
    });
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        const input = document.getElementById(
          "sleeper-username"
        ) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }, 0);
    }
  };

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

  const {
    canViewAutopilotTab,
    isLoadingRevealPhase,
    leagueFormatPills,
    leagueIdAutocompleteOptions,
    leagueLogoInitials,
    loadingLeague,
    reportTabsClassName,
    reportTabsStyle,
    resolvedActiveTab,
    shouldDeferAutopilotUrlSync,
    shouldShowDraftHistoryTab,
    usernameAutocompleteOptions,
  } = useHomeViewState({
    activeTab,
    analysisCompleteMessage,
    canViewAdminDiagnostics,
    canViewAdminFeatureExpansion,
    isAuthLoading: authQuery.isLoading,
    leagueFormat,
    leagueId,
    leagueIdHistory,
    leagueLogo,
    leagueName,
    loadingTransitionPhase,
    pendingAnalysisLeague,
    reportData,
    sleeperUsername,
    sleeperUsernameHistory,
  });

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
    reportData: isSampleReportActive ? null : reportDataWithRankings,
    leagueId,
    leagueName,
  });
  useReportBackgroundRefresh({
    reportData: reportDataForPrivateSideEffects,
    leagueId,
    reportDataCacheVersion,
    isLoading,
    isReportRefreshing,
    viewerUserId,
    refreshAfterMs: REPORT_BACKGROUND_REFRESH_AFTER_MS,
    prefetchDebounceMs: REPORT_CACHE_PREFETCH_DEBOUNCE_MS,
    onRefreshReport: refreshReportInBackground,
  });
  const importSleeperTradeCenterSnapshotMutation =
    trpc.league.importSleeperTradeCenterSnapshot.useMutation();
  const applySleeperTradeCenterImport = (
    result: SleeperTradeCenterImportResult
  ): SleeperTradeCenterImportSummary => {
    const displayPatch: SleeperTradeCenterImportDisplayPatch = {
      leagueId: result.leagueId,
      sleeperHiddenLeagueSnapshot: result.sleeperHiddenLeagueSnapshot,
      tradeProposalSignals: result.tradeProposalSignals,
      waiverSignals: result.waiverSignals,
      currentPositionRankById: result.currentPositionRankById,
    };
    setSleeperTradeCenterImportDisplayPatch(displayPatch);
    setReportData(current => {
      if (!current) return current;
      return applySleeperTradeCenterImportDisplayPatch(
        current,
        displayPatch,
        result.leagueId
      );
    });
    setReportDataCacheVersion(
      `sleeper-hidden:${result.leagueId}:${result.sleeperHiddenLeagueSnapshot.sharedAt}`
    );

    return {
      transactionCount: result.transactionCount,
      tradeCount: result.tradeCount,
      waiverCount: result.waiverCount,
    };
  };
  const handleImportSleeperTradeCenterSnapshot = async (
    snapshot: SleeperExtensionTradeCenterSnapshot
  ): Promise<SleeperTradeCenterImportSummary> => {
    const normalizedLeagueId = leagueId.trim();

    if (!normalizedLeagueId) {
      throw new Error("Run a league report before importing Sleeper activity.");
    }

    if (snapshot.leagueId !== normalizedLeagueId) {
      throw new Error(
        `Transaction Sync captured league ${snapshot.leagueId}, but this report is ${normalizedLeagueId}.`
      );
    }

    const result = await importSleeperTradeCenterSnapshotMutation.mutateAsync({
      ...snapshot,
      leagueId: normalizedLeagueId,
      sharedBy: viewerUsername || sleeperUsername || null,
    });

    return applySleeperTradeCenterImport(result);
  };
  const { handleReportTabChange, handleScoutLeaguemates } =
    useHomeReportTabActions({
      activeTab,
      setActiveTab,
      leagueId,
      reportData,
      canViewAutopilotTab,
      canViewHacksTab: canViewAdminDiagnostics,
      shouldShowDraftHistoryTab,
      isAuthLoading: authQuery.isLoading,
      shouldDeferAutopilotUrlSync,
      resolvedActiveTab,
      setRosterScannerFocusKey,
    });
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
    const reportDataForExperience = applySleeperTradeCenterImportDisplayPatch(
      reportData,
      sleeperTradeCenterImportDisplayPatch,
      leagueId
    );
    const reportDataWithRankingsForExperience = reportDataWithRankings
      ? applySleeperTradeCenterImportDisplayPatch(
          reportDataWithRankings,
          sleeperTradeCenterImportDisplayPatch,
          leagueId
        )
      : reportDataForExperience;

    return (
      <HomeReportExperience
        reportData={reportDataForExperience}
        reportDataWithRankings={reportDataWithRankingsForExperience}
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
        isSampleReport={isSampleReportActive}
        onHeaderLeagueClick={handleHeaderLeagueClick}
        onAnalyzeAnotherLeague={handleAnalyzeAnotherLeague}
        onScanMyLeagueFromSample={handleScanMyLeagueFromSample}
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
        onImportSleeperTradeCenterSnapshot={
          handleImportSleeperTradeCenterSnapshot
        }
        isImportingSleeperTradeCenterSnapshot={
          importSleeperTradeCenterSnapshotMutation.isPending
        }
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
        onViewSampleReport={handleViewSampleReport}
        isAnalysisBusy={isLoading}
        showLoadingFooter={!reportData}
        onStartOver={handleStartOver}
        isLandingFaded={Boolean(reportData && analysisCompleteMessage)}
        homeDialogs={homeDialogs}
      />
    </>
  );
}
