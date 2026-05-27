import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "@/styles/home-backgrounds-v12.css";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Flame,
  Gavel,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Repeat2,
  ClipboardList,
  ListOrdered,
  Radar,
  Swords,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingAnimation } from "@/features/report/components/LoadingAnimation";
import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";
import { HeaderCssLights } from "@/components/HeaderCssLights";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  PremiumFxLayer,
  type PremiumFxVariant,
} from "@/components/PremiumFxLayer";
import { SupportButton } from "@/components/SupportButton";
import { FeedbackButton } from "@/components/FeedbackButton";
import { ManagerChampionshipProvider } from "@/components/ManagerChampionships";
import { TeamLogoPill } from "@/components/TeamLogoPill";
import {
  PlayerPill,
  type PreviewMetric,
} from "@/components/reportPrimitives";
import {
  CollapsibleReportSection,
  ModalReportSection,
  ReportSectionAccordionProvider,
  ReportSectionLoadingFallback,
} from "@/features/report/components/ReportSectionDisclosure";
import { AIVoiceModeMenu } from "@/features/report/components/AIVoiceModeMenu";
import { AutopilotErrorFallback } from "@/features/report/components/AutopilotErrorFallback";
import {
  LeagueRosterScannerModeControls,
  OwnerIntelSortControls,
  type OwnerIntelSortMode,
} from "@/features/report/components/OwnerIntelControls";
import {
  DashboardManagerAvatar,
  DashboardSpotlightFocusGrid,
  DashboardVisualMetric,
  type DashboardHeroMetric,
  type DashboardMetricBar,
  type DashboardMetricTone,
  type DashboardSpotlightBlock,
} from "@/features/report/components/ReportDashboardMetrics";
import {
  HomeFooterChrome,
  HomeHeaderChrome,
} from "@/features/home/components/HomeChrome";
import {
  HomePortfolioPanel,
  LeaguePickerCard,
  type HomePortfolioLeague,
  type HomePortfolioRow,
} from "@/features/home/components/HomeLeagueSelection";
import { RecentEntrySuggestions } from "@/features/home/components/RecentEntrySuggestions";
import {
  ReportSinceLastReportBrief,
  type ReportDeltaChange,
  type ReportDeltaTone,
} from "@/features/report/components/ReportDeltaBrief";
import {
  getLeagueModeCopy,
  getPlayerRankForMode,
  normalizeLeagueValueMode,
  type LeagueValueMode,
} from "@/lib/leagueValueMode";
import {
  getBestDraftAdpValueManager,
  getBestDraftSignalManager,
  getDraftSignalPicks,
  getWorstDraftAdpValueManager,
} from "@/lib/draftDashboardMetrics";
import {
  buildManagerPositionRoomPreview,
  buildRosterStarterPreview,
  buildTaxiTriagePreview,
} from "@/lib/overviewInsights";
import { sanitizeCachedReport } from "@/lib/reportCacheSanitizer";
import { sortRowsByViewerAndStanding } from "@/lib/managerOrdering";
import { isPlaceholderManagerName } from "@/lib/managerDisplay";
import { getPositionRankClass } from "@/lib/positionRank";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import type {
  PlayerDetails,
  RankingSourceDiagnostic,
  ReportData,
  WaiverWeeklyEcrWeek,
} from "@shared/types";
import { getAIEvidenceReceiptItems } from "@shared/aiEvidenceEngine";
import {
  buildLeagueSharpnessProfile,
  type LeagueSharpnessProfile,
} from "@shared/leagueSharpness";
import type { AppRouter } from "../../../server/routers";
import {
  buildScheduleEdgeRows,
  buildScheduleSnapshotHealthRows,
  getScheduleEdgeRangeSummary,
  getScheduleEdgeWeeksInRange,
  formatScheduleEdgeValue,
  normalizeScheduleEdgeWeekRange,
  SCHEDULE_EDGE_POSITION_FILTERS,
  sortScheduleEdgeRows,
  type ScheduleEdgePositionFilter,
  type ScheduleEdgeRow,
  type ScheduleEdgeSortMode,
  type ScheduleEdgeTone,
} from "@/lib/scheduleEdgeRows";
import { buildAutopilotData } from "@/lib/autopilot/buildAutopilotData";
import { AUTOPILOT_MOCK_DATA } from "@/lib/autopilot/mockData";
import type { AIActionQueueItem } from "@/lib/autopilot/types";
import {
  buildAIPredictionEventsForReport,
  getAIPredictionEventBatchSignature,
} from "@/lib/aiPredictionEvents";
import { detectAIActionConflicts } from "@/lib/aiActionMemory";
import {
  buildManagerPersonalityIntelRows,
  type ManagerPersonalityIntelRow,
} from "@/lib/managerPersonalityIntel";
import {
  AI_VOICE_MODE_CHANGE_EVENT,
  getAIVoiceMode,
  getAIVoiceModeLabel,
  setAIVoiceMode as persistAIVoiceMode,
  type AIVoiceMode,
} from "@/lib/aiVoice";

const DraftAnalysis = lazy(() =>
  import("@/components/DraftAnalysis").then(module => ({
    default: module.DraftAnalysis,
  }))
);
const RankingsBoard = lazy(() =>
  import("@/components/RankingsBoard").then(module => ({
    default: module.RankingsBoard,
  }))
);
const WeeklyMomentumTable = lazy(
  () => import("@/components/reportTables/WeeklyMomentumTable")
);
const TradeWarRoom = lazy(
  () => import("@/components/reportTables/TradeWarRoom")
);
const LeagueRosterScanner = lazy(
  () => import("@/components/reportTables/LeagueRosterScanner")
);
const TradeProfitLeaderboardTable = lazy(
  () => import("@/components/reportTables/TradeProfitLeaderboardTable")
);
const TradeHistoryTable = lazy(
  () => import("@/components/reportTables/TradeHistoryTable")
);
const TradeProposalSignalsTable = lazy(
  () => import("@/components/reportTables/TradeProposalSignalsTable")
);
const ManagerPositionCountsTable = lazy(
  () => import("@/components/reportTables/ManagerPositionCountsTable")
);
const OwnerIntelMatrix = lazy(
  () => import("@/components/reportTables/OwnerIntelMatrix")
);
const LeagueCommandCenter = lazy(
  () => import("@/components/reportTables/LeagueCommandCenter")
);
const TradeMarketRadar = lazy(
  () => import("@/components/reportTables/TradeMarketRadar")
);
const TradeTheftDetector = lazy(
  () => import("@/components/reportTables/TradeTheftDetector")
);
const TrendingPlayersTable = lazy(
  () => import("@/components/reportTables/TrendingPlayersTable")
);
const WaiverIntelligencePanel = lazy(
  () => import("@/components/reportTables/WaiverIntelligencePanel")
);
const RecentTransactionsPanel = lazy(
  () => import("@/components/reportTables/RecentTransactionsPanel")
);
const OverviewAIPulse = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.OverviewAIPulse,
  }))
);
const MonthlyTeamBlueprint = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.MonthlyTeamBlueprint,
  }))
);
const LeaguePowerRankings = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.LeaguePowerRankings,
  }))
);
const TeamBreakdownRecon = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.TeamBreakdownRecon,
  }))
);
const TradeFinderGenerator = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.TradeFinderGenerator,
  }))
);
const TradePartnerFinder = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.TradePartnerFinder,
  }))
);
const LeagueExploits = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.LeagueExploits,
  }))
);
const RankingsMarketRead = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.RankingsMarketRead,
  }))
);
const TradeBrowserRead = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.TradeBrowserRead,
  }))
);
const AssistantFeatureShells = lazy(() =>
  import("@/components/CommandCenterExpansion").then(module => ({
    default: module.AssistantFeatureShells,
  }))
);
const AITeamAutopilot = lazy(() => import("@/components/AITeamAutopilot"));

const DYNASTY_MOBILE_REPORT_LOGO_SRC =
  "/brand/logos/png/mobile-dd-stacked-transparent.png?v=20260519-mobile-transparent";
const DYNASTY_REPORT_HEADER_LOGO_SRC =
  "/brand/logos/uploads/report-header-logo-compact-transparent-cropped.png?v=20260518-compact-crop";
const REPORT_CACHE_DATA_VERSION = "sleeper-only-startup-adp-v1";
const REPORT_CACHE_KEY = "dynasty-degenerates:last-report:v29";
const REPORT_DELTA_SNAPSHOT_KEY =
  "dynasty-degenerates:report-delta-snapshots:v1";
const REPORT_DELTA_MAX_LEAGUES = 12;
const REPORT_CACHE_DB_NAME = "dynasty-degenerates-report-cache";
const REPORT_CACHE_DB_VERSION = 1;
const REPORT_CACHE_DB_STORE = "reports";
const REPORT_LOAD_TELEMETRY_KEY =
  "dynasty-degenerates:report-load-telemetry:v1";
const REPORT_CACHE_MAX_AGE_MS = 72 * 60 * 60 * 1000;
// Cached reports render immediately, then refresh volatile Sleeper activity in the background.
const REPORT_BACKGROUND_REFRESH_AFTER_MS = 0;
const REPORT_CACHE_PREFETCH_DEBOUNCE_MS = 10 * 60 * 1000;
const STALE_REPORT_CACHE_KEYS = [
  "dynasty-degenerates:last-report:v10",
  "dynasty-degenerates:last-report:v11",
  "dynasty-degenerates:last-report:v12",
  "dynasty-degenerates:last-report:v13",
  "dynasty-degenerates:last-report:v14",
  "dynasty-degenerates:last-report:v15",
  "dynasty-degenerates:last-report:v16",
  "dynasty-degenerates:last-report:v17",
  "dynasty-degenerates:last-report:v18",
  "dynasty-degenerates:last-report:v19",
  "dynasty-degenerates:last-report:v20",
  "dynasty-degenerates:last-report:v21",
  "dynasty-degenerates:last-report:v22",
  "dynasty-degenerates:last-report:v23",
  "dynasty-degenerates:last-report:v24",
  "dynasty-degenerates:last-report:v25",
  "dynasty-degenerates:last-report:v26",
  "dynasty-degenerates:last-report:v27",
  "dynasty-degenerates:last-report:v28",
];
const LAST_LEAGUE_KEY = "dynasty-degenerates:last-league:v1";
const SLEEPER_SESSION_KEY = "dynasty-degenerates:sleeper-session:v1";
const LEAGUE_ID_HISTORY_KEY = "dynasty-degenerates:league-id-history:v1";
const SLEEPER_USERNAME_HISTORY_KEY =
  "dynasty-degenerates:sleeper-username-history:v1";
const CACHED_SLEEPER_USERS_KEY = "dynasty-degenerates:sleeper-user-history:v1";
const ADMIN_UNLOCK_MODAL_DISMISSED_KEY =
  "dynasty-degenerates:admin-unlock-dismissed:v1";
const ADMIN_PASSPHRASE_VERIFIED_SESSION_KEY =
  "dynasty-degenerates:admin-passphrase-verified-session:v1";
const MAX_AUTOCOMPLETE_HISTORY = 12;
const MAX_CACHED_SLEEPER_USERS = 5;
const MAX_RECENT_LEAGUES_PER_USER = 3;
const LEAGUE_VIEW_MANAGER_VALUE = "__league__";
const ADMIN_VALUE_DIAGNOSTIC_START_DATE = "2026-05-07";
const CLOWN_EASTER_EGG_USERNAMES = new Set(["armchairgmzar", "tjsmoov"]);
const REPORT_SUCCESS_REVEAL_DELAY_MS = 1150;
const REPORT_SUCCESS_READ_AFTER_REVEAL_MS = 850;
const REPORT_SUCCESS_KICK_MS = 900;
const SLEEPER_ID_PATTERN = /^\d{8,24}$/;
const SHOW_LEGACY_LEAGUE_ID_LOGIN = true;
const SHOW_ASSISTANT_FEATURE_RADAR =
  String(
    import.meta.env.VITE_SHOW_ASSISTANT_FEATURE_RADAR || "true"
  ).toLowerCase() !== "false";

type LoadingTransitionPhase =
  | "loading"
  | "success"
  | "reveal"
  | "kick"
  | "done";
type ReportLoadSource = "browser-cache" | "server";
type ReportLoadCacheStatus = "browser" | "hit" | "miss" | "unknown";
type ReportAnalysisMode = "blocking" | "background";
type ReportLoadTelemetryEvent = {
  leagueId: string;
  leagueName?: string | null;
  activeTab: string;
  source: ReportLoadSource;
  cacheStatus: ReportLoadCacheStatus;
  requestMs: number | null;
  visibleMs: number;
  payloadVersion: string;
  createdAt: string;
};

function readAdminPassphraseVerifiedForSession() {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.sessionStorage.getItem(ADMIN_PASSPHRASE_VERIFIED_SESSION_KEY) ===
      "true"
    );
  } catch {
    return false;
  }
}

function rememberAdminPassphraseVerifiedForSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      ADMIN_PASSPHRASE_VERIFIED_SESSION_KEY,
      "true"
    );
  } catch {
    // Admin access still works for the current React session.
  }
}

function getValidSleeperUserId(userId?: string | null) {
  const trimmedUserId = userId?.trim();
  return trimmedUserId && SLEEPER_ID_PATTERN.test(trimmedUserId)
    ? trimmedUserId
    : null;
}

function persistReportLoadTelemetry(event: ReportLoadTelemetryEvent) {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(
      window.localStorage.getItem(REPORT_LOAD_TELEMETRY_KEY) || "[]"
    ) as ReportLoadTelemetryEvent[];
    window.localStorage.setItem(
      REPORT_LOAD_TELEMETRY_KEY,
      JSON.stringify([event, ...existing].slice(0, 25))
    );
    window.dispatchEvent(
      new CustomEvent("dynasty-degenerates:report-load-telemetry", {
        detail: event,
      })
    );
    if (!import.meta.env.PROD) {
      console.info("[ReportLoadTelemetry]", event);
    }
  } catch {
    // Timing telemetry should never block report rendering.
  }
}

function getKtcAdminIdentity(
  user?: SleeperUserSession | null,
  fallbackUsername?: string
): string | null {
  return user?.username || user?.displayName || fallbackUsername || null;
}

function normalizeViewerIdentifier(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

type AdminAuthUser = {
  role?: string | null;
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  isPrivilegedAdmin?: boolean | null;
};

function canViewAdminTelemetryForUser(user?: AdminAuthUser | null): boolean {
  if (!user) return false;
  return user.role === "admin" || Boolean(user.isPrivilegedAdmin);
}

function showMutationErrorToast(error: { message: string }) {
  if (error.message === UNAUTHED_ERR_MSG) return;
  toast.error(`Error: ${error.message}`);
}

const REPORT_TAB_VALUES = [
  "overview",
  "autopilot",
  "momentum",
  "rankings",
  "trades",
  "draft",
] as const;

function normalizeReportTab(value?: string | null): string | null {
  const normalized = String(value || "")
    .replace(/^#/, "")
    .replace(/^tab=/, "")
    .trim()
    .toLowerCase();
  const aliases: Record<string, (typeof REPORT_TAB_VALUES)[number]> = {
    pulse: "momentum",
    rank: "rankings",
    trade: "trades",
    drafts: "draft",
  };
  const canonical = aliases[normalized] || normalized;
  return REPORT_TAB_VALUES.includes(
    canonical as (typeof REPORT_TAB_VALUES)[number]
  )
    ? canonical
    : null;
}

function getInitialReportTabFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hashTab = normalizeReportTab(window.location.hash);
  if (hashTab) return hashTab;
  return normalizeReportTab(
    new URLSearchParams(window.location.search).get("tab")
  );
}

function getInitialReportLeagueIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get("leagueId") || params.get("league");
  const normalized = String(value || "").trim();
  return normalized || null;
}

function updateReportTabUrl(tab: string, leagueId?: string | null) {
  if (typeof window === "undefined") return;
  const normalizedTab = normalizeReportTab(tab) || "overview";
  const params = new URLSearchParams(window.location.search);
  params.delete("tab");
  if (leagueId !== undefined) {
    const normalizedLeagueId = String(leagueId || "").trim();
    if (normalizedLeagueId) {
      params.set("leagueId", normalizedLeagueId);
    } else {
      params.delete("leagueId");
      params.delete("league");
    }
  }
  const nextSearch = params.toString();
  const nextHash = normalizedTab === "overview" ? "" : `#${normalizedTab}`;
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${nextHash}`;
  window.history.replaceState(null, "", nextUrl);
}

function hasDraftReportData(reportData?: ReportData | null): boolean {
  if (!reportData) return false;
  const draftPicks = reportData.draftPicks || [];
  const draftStats = reportData.draftStats || [];
  const leagueValueMode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );

  if (leagueValueMode !== "redraft") {
    return draftPicks.length > 0 || draftStats.length > 0;
  }

  const diagnostics = reportData.leagueDiagnostics;
  if (typeof diagnostics?.hasCurrentSeasonMainDraft === "boolean") {
    return diagnostics.hasCurrentSeasonMainDraft;
  }

  // Older cached reports may have current draft picks but no draft diagnostics.
  const currentSeason = String(
    diagnostics?.currentSeason || new Date().getFullYear()
  );

  return draftPicks.some(pick => {
    const draftYear = pick.draftYear ? String(pick.draftYear) : "";
    const draftKind = pick.draftKind || "main";
    const hasPlayer =
      Boolean(pick.player_id) ||
      (Boolean(pick.playerName) && pick.playerName !== "Unknown");

    return draftYear === currentSeason && draftKind === "main" && hasPlayer;
  });
}

function formatPreviewNumber(value?: number | null): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  if (Math.abs(numeric) >= 1000) return `${Math.round(numeric / 100) / 10}K`;
  return numeric.toLocaleString();
}

function formatPreviewDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatReceptionChip(value?: number | null): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 0) return "Standard";
  if (numeric === 0.5) return "Half PPR";
  if (numeric === 1) return "PPR";
  return `${numeric} PPR`;
}

function formatTepChip(value?: number | null): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric >= 1 ? "TEP+" : "TEP";
}

function buildLeagueFormatPills(
  leagueFormat: string,
  diagnostics?: ReportData["leagueDiagnostics"],
  mode?: LeagueValueMode | string | null
): string[] {
  const chips: string[] = [];
  const normalizedFormat = leagueFormat || "";
  const addChip = (value?: string | null) => {
    const normalized = value?.trim();
    if (normalized && !chips.includes(normalized)) chips.push(normalized);
  };

  const teamCount =
    diagnostics?.teamCount ||
    Number(normalizedFormat.match(/\b(\d{1,2})\s*-?\s*team\b/i)?.[1]);
  if (Number.isFinite(teamCount) && teamCount > 0) addChip(`${teamCount}-Team`);

  const normalizedMode = normalizeLeagueValueMode(
    mode || diagnostics?.valueMode
  );
  addChip(normalizedMode === "redraft" ? "Redraft" : "Dynasty");

  const slotText = [
    normalizedFormat,
    ...(diagnostics?.starterSlots || []),
    ...(diagnostics?.rosterSlots || []),
  ].join(" ");
  if (
    /\b(super[_\s-]?flex|sflex|sf)\b/i.test(slotText) ||
    /\bOP\b/.test(slotText)
  ) {
    addChip("SF");
  } else if (/\b(1\s*QB|one\s*QB|1QB)\b/i.test(slotText)) {
    addChip("1QB");
  }

  const scoringChip = diagnostics
    ? formatReceptionChip(diagnostics.receptionScoring)
    : /\b(half[-\s]?ppr)\b/i.test(normalizedFormat)
      ? "Half PPR"
      : /\b(non[-\s]?ppr|standard|std)\b/i.test(normalizedFormat)
        ? "Standard"
        : /\bppr\b/i.test(normalizedFormat)
          ? "PPR"
          : null;
  addChip(scoringChip);

  const tepChip = diagnostics
    ? formatTepChip(diagnostics.tightEndPremium)
    : /\b(tep\+|1(?:\.0)?\s*tep|1\.5\s*tep|2(?:\.0)?\s*tep|te\s*premium\+)\b/i.test(
          normalizedFormat
        )
      ? "TEP+"
      : /\b(tep|te\s*premium)\b/i.test(normalizedFormat)
        ? "TEP"
        : null;
  addChip(tepChip);

  return chips;
}

function renderPreviewManagerIdentity(
  manager: string | null | undefined,
  managerAvatars?: ReportData["managerAvatars"],
  className = ""
): ReactNode {
  if (!manager) return "-";
  const avatarUrl = managerAvatars?.[manager];

  return (
    <span
      className={`analysis-preview-manager-value ${className}`.trim()}
      title={manager}
      aria-label={manager}
    >
      <span className="analysis-preview-manager-avatar" aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span>{manager[0]?.toUpperCase() || "?"}</span>
        )}
      </span>
      <span className="analysis-preview-manager-name">{manager}</span>
    </span>
  );
}

function buildRosterPreviewMetrics(data: ReportData): PreviewMetric[] {
  const preview = buildRosterStarterPreview(data);
  return [
    {
      label: "Strongest",
      compactLabel: "Best",
      value: renderPreviewManagerIdentity(
        preview.strongestStarterManager,
        data.managerAvatars
      ),
      tone: "good",
      className: "analysis-preview-chip-starter-room",
    },
    preview.weakestStarterManager
      ? {
          label: "Weakest",
          compactLabel: "Weak",
          value: renderPreviewManagerIdentity(
            preview.weakestStarterManager,
            data.managerAvatars
          ),
          tone: "warn",
          className: "analysis-preview-chip-starter-room",
        }
      : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildTaxiPreviewMetrics(data: ReportData): PreviewMetric[] {
  const preview = buildTaxiTriagePreview(data);
  if (!preview) return [];

  return [
    preview.mostPromotableManager
      ? {
          label:
            preview.promoteCount === 1
              ? "Promotable"
              : `Promotable (${preview.promoteCount})`,
          compactLabel: "Promote",
          value: renderPreviewManagerIdentity(
            preview.mostPromotableManager,
            data.managerAvatars
          ),
          tone: "good",
          className: "analysis-preview-chip-manager-preview",
        }
      : null,
    preview.mostCuttableManager
      ? {
          label: preview.cutCount === 1 ? "Cuts" : `Cuts (${preview.cutCount})`,
          compactLabel: "Cuts",
          value: renderPreviewManagerIdentity(
            preview.mostCuttableManager,
            data.managerAvatars
          ),
          tone: "warn",
          className: "analysis-preview-chip-manager-preview",
        }
      : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildOwnerIntelPreviewMetrics(
  data: ReportData,
  sortMode: OwnerIntelSortMode
): PreviewMetric[] {
  const rows = data.managerRosterIntelligence || [];
  if (!rows.length) return [];
  const growthRows = data.managerRosterValueGrowth || [];
  const powerRows = data.powerRankings || [];
  const maxGrowthValue = Math.max(
    0,
    ...growthRows.map(row => row.total_val || 0)
  );
  const getOverviewRow = (manager: string) =>
    data.leagueOverview?.find(row => row.manager === manager);
  const getTimelineRow = (manager: string) =>
    data.dynastyTimelines?.find(row => row.manager === manager);
  const getPowerRow = (manager: string) =>
    powerRows.find(row => row.manager === manager);
  const getGrowthRow = (manager: string) =>
    growthRows.find(row => row.manager === manager);
  const getScore = (row: (typeof rows)[number]) => {
    const timelineRow = getTimelineRow(row.manager);
    if (sortMode === "contender") return timelineRow?.contenderScore ?? -1;
    if (sortMode === "rebuilder") return timelineRow?.rebuildScore ?? -1;
    const rosterValue = getPowerRow(row.manager)?.rosterValue;
    if (typeof rosterValue === "number") return rosterValue;
    const growthValue = getGrowthRow(row.manager)?.total_val;
    return maxGrowthValue > 0 && typeof growthValue === "number"
      ? Math.round((growthValue / maxGrowthValue) * 100)
      : (getOverviewRow(row.manager)?.total_val ?? -1);
  };
  const ordered = [...rows].sort((a, b) => {
    const scoreDiff = getScore(b) - getScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.manager.localeCompare(b.manager);
  });
  return [
    ordered[0]
      ? {
          label: "Truth",
          value: renderPreviewManagerIdentity(
            ordered[0].manager,
            data.managerAvatars
          ),
          tone: "good",
          className: "analysis-preview-chip-manager-preview",
        }
      : null,
    ordered[ordered.length - 1]
      ? {
          label: "Trash",
          value: renderPreviewManagerIdentity(
            ordered[ordered.length - 1].manager,
            data.managerAvatars
          ),
          tone: "warn",
          className: "analysis-preview-chip-manager-preview",
        }
      : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildManagerPositionRoomPreviewMetrics(
  data: ReportData
): PreviewMetric[] {
  const preview = buildManagerPositionRoomPreview(data);
  if (!preview) return [];

  return [
    preview.needToDropManager
      ? {
          label:
            preview.needToDropCount === 1
              ? "Must Drop (1)"
              : `Must Drop (${preview.needToDropCount})`,
          compactLabel: "Drop",
          value: renderPreviewManagerIdentity(
            preview.needToDropManager,
            data.managerAvatars
          ),
          tone: "warn",
          className: "analysis-preview-chip-manager-preview",
        }
      : null,
    preview.openRoomManager
      ? {
          label:
            preview.openRoomCount === 1
              ? "Can Add (1)"
              : `Can Add (${preview.openRoomCount})`,
          compactLabel: "Add",
          value: renderPreviewManagerIdentity(
            preview.openRoomManager,
            data.managerAvatars
          ),
          tone: "good",
          className: "analysis-preview-chip-manager-preview",
        }
      : null,
  ].filter(Boolean) as PreviewMetric[];
}

type TradePreviewSection = "war-room" | "leaderboard" | "theft" | "ledger";

function getTradeLoserManager(
  trade?: ReportData["tradeHistory"][number] | null
): string | null {
  if (!trade) return null;
  if (trade.winner === trade.team_a) return trade.team_b;
  if (trade.winner === trade.team_b) return trade.team_a;
  if (
    trade.winners?.includes(trade.team_a) &&
    !trade.winners.includes(trade.team_b)
  )
    return trade.team_b;
  if (
    trade.winners?.includes(trade.team_b) &&
    !trade.winners.includes(trade.team_a)
  )
    return trade.team_a;
  return null;
}

function buildTradePreviewMetrics(
  data: ReportData,
  _mode: LeagueValueMode,
  section: TradePreviewSection
): PreviewMetric[] {
  const tradeHistory = [...(data.tradeHistory || [])];
  const tradeTendencies = [...(data.tradeTendencies || [])];
  const tradeTendencyByManager = new Map(
    tradeTendencies.map(row => [row.manager, row])
  );
  const leagueTradeActivity = getReportManagerNames(
    data,
    data.viewerManager
  ).map((manager, index) => {
    const tendency = tradeTendencyByManager.get(manager);
    return {
      manager,
      tradeCount: tendency?.tradeCount ?? 0,
      index,
    };
  });

  const biggestGap =
    [...tradeHistory].sort(
      (a, b) => Math.abs(b.point_gap || 0) - Math.abs(a.point_gap || 0)
    )[0] || null;
  const latestTrade =
    [...tradeHistory].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const bestProfit =
    [...tradeTendencies].sort((a, b) => b.profit - a.profit)[0] || null;
  const busiestTrader =
    [...tradeTendencies].sort((a, b) => b.tradeCount - a.tradeCount)[0] || null;
  const bestWinRate =
    [...tradeTendencies].sort((a, b) => b.winPct - a.winPct)[0] || null;
  const worstProfit =
    [...tradeTendencies].sort((a, b) => a.profit - b.profit)[0] || null;
  const quietestTrader =
    [...leagueTradeActivity].sort(
      (a, b) => a.tradeCount - b.tradeCount || a.index - b.index
    )[0] || null;
  const cookedManager = getTradeLoserManager(biggestGap);
  const auraManager = biggestGap?.winner || null;
  const latestTradeGap = latestTrade
    ? formatPreviewNumber(Math.abs(latestTrade.point_gap || 0))
    : null;

  switch (section) {
    case "war-room":
      return [
        bestProfit
          ? {
              label: `Market Shark (${formatPreviewNumber(bestProfit.profit)})`,
              value: renderPreviewManagerIdentity(
                bestProfit.manager,
                data.managerAvatars
              ),
              tone: "good",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
        worstProfit
          ? {
              label: `Bag Holder (${formatPreviewNumber(worstProfit.profit)})`,
              value: renderPreviewManagerIdentity(
                worstProfit.manager,
                data.managerAvatars
              ),
              tone: "danger",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
      ].filter(Boolean) as PreviewMetric[];
    case "leaderboard":
      return [
        busiestTrader
          ? {
              label: `Most trades (${busiestTrader.tradeCount})`,
              value: renderPreviewManagerIdentity(
                busiestTrader.manager,
                data.managerAvatars
              ),
              tone: "info",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
        quietestTrader
          ? {
              label: `Least trades (${quietestTrader.tradeCount})`,
              value: renderPreviewManagerIdentity(
                quietestTrader.manager,
                data.managerAvatars
              ),
              tone: "neutral",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
        bestWinRate
          ? {
              label: `Best win rate (${bestWinRate.winPct}%)`,
              value: renderPreviewManagerIdentity(
                bestWinRate.manager,
                data.managerAvatars
              ),
              tone: "good",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
      ].filter(Boolean) as PreviewMetric[];
    case "theft":
      return [
        auraManager
          ? {
              label: "Aura Farmer",
              value: renderPreviewManagerIdentity(
                auraManager,
                data.managerAvatars
              ),
              tone: "good",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
        cookedManager
          ? {
              label: `Most cooked${biggestGap ? ` (${formatPreviewNumber(Math.abs(biggestGap.point_gap || 0))})` : ""}`,
              value: renderPreviewManagerIdentity(
                cookedManager,
                data.managerAvatars
              ),
              tone: "danger",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
      ].filter(Boolean) as PreviewMetric[];
    case "ledger":
    default:
      return [
        {
          label: "Trades",
          value: tradeHistory.length,
          tone: tradeHistory.length ? "neutral" : "warn",
        },
        latestTrade
          ? {
              label: "Latest trade",
              value: formatPreviewDate(latestTrade.date),
              tone: "info",
            }
          : null,
        latestTradeGap
          ? {
              label: "Last gap",
              value: latestTradeGap,
              tone: "warn",
            }
          : null,
      ].filter(Boolean) as PreviewMetric[];
  }
}

function buildDraftPreviewMetrics(
  data: ReportData,
  mode: LeagueValueMode
): PreviewMetric[] {
  const picks = getDraftSignalPicks(data, mode);
  const topGain = [...picks].sort(
    (a, b) => (b.valueGain || 0) - (a.valueGain || 0)
  )[0];
  const totalSwing = picks.reduce(
    (sum, pick) => sum + (pick.valueGain || 0),
    0
  );
  const hitCount = picks.filter(
    pick => pick.draftOutcome === "hit" || pick.isStarter
  ).length;
  const hitRate = picks.length
    ? `${Math.round((hitCount / picks.length) * 100)}%`
    : "-";
  const renderDraftPreviewPlayer = (
    pick: NonNullable<ReportData["draftPicks"]>[number]
  ) => (
    <PlayerPill
      playerId={pick.player_id}
      playerName={pick.playerName}
      team={pick.playerDetails?.team}
      position={pick.playerDetails?.position || pick.playerPos}
      className="analysis-preview-player"
    />
  );

  return [
    {
      label: "Picks",
      value: picks.length,
      tone: picks.length ? "info" : "warn",
    },
    topGain
      ? {
          label: mode === "redraft" ? "Best Current Gain" : "Top Value Gain",
          value: renderDraftPreviewPlayer(topGain),
          tone: "good",
        }
      : null,
    picks.length
      ? {
          label: mode === "redraft" ? "Starter Hit Rate" : "Hit Rate",
          value: hitRate,
          tone: "info",
        }
      : null,
    picks.length
      ? {
          label: "Total Swing",
          value: `${totalSwing > 0 ? "+" : ""}${formatPreviewNumber(totalSwing)}`,
          tone: totalSwing >= 0 ? "good" : "danger",
        }
      : null,
  ].filter(Boolean) as PreviewMetric[];
}

function renderMomentumPreviewPlayer(
  player: ReportData["weeklyRisers"][number]
) {
  return (
    <PlayerPill
      playerId={player.player_id}
      playerName={player.name}
      team={player.playerDetails?.team}
      position={player.pos}
      className="analysis-preview-player"
    />
  );
}

function renderTrendingPreviewPlayer(
  player: NonNullable<ReportData["trendingAdds"]>[number]
) {
  return (
    <PlayerPill
      playerId={player.player_id}
      playerName={player.name}
      team={player.playerDetails?.team || player.team}
      position={player.pos}
      className="analysis-preview-player"
    />
  );
}

type RecentTransactionPreviewPlayer = NonNullable<
  ReportData["recentTransactions"]
>[number]["addedPlayer"];

function renderPreviewPlayerMetric(
  player: ReactNode,
  metric?: string | null,
  metricClassName?: string
) {
  const metricClass = ["analysis-preview-player-count", metricClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <span className="analysis-preview-player-with-meta">
      {player}
      {metric && <span className={metricClass}>{metric}</span>}
    </span>
  );
}

function renderRecentTransactionPreviewPlayer(
  player: RecentTransactionPreviewPlayer
) {
  if (!player) return null;
  return (
    <PlayerPill
      playerId={player.player_id}
      playerName={player.name}
      team={player.playerDetails?.team || player.team}
      position={player.pos}
      className="analysis-preview-player"
    />
  );
}

function getRecentTransactionPreviewRank(
  player: RecentTransactionPreviewPlayer,
  leagueValueMode: LeagueValueMode
): string | null {
  if (!player) return null;
  return (
    getPlayerRankForMode({
      valueProfile: player.playerDetails?.valueProfile,
      fallbackRank: player.currentPositionRank || player.pos,
      mode: leagueValueMode,
      context: "rankings",
    }) ||
    player.currentPositionRank ||
    player.pos ||
    null
  );
}

function formatPreviewPercent(value?: number | null): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded =
    Math.abs(numeric) >= 10
      ? Math.round(numeric)
      : Math.round(numeric * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatPreviewCount(value?: number | null): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const absolute = Math.abs(numeric);
  if (absolute >= 1000000) return `${Math.round(numeric / 100000) / 10}M`;
  if (absolute >= 1000) return `${Math.round(numeric / 100) / 10}K`;
  return Math.round(numeric).toLocaleString();
}

function buildMomentumPreviewMetrics(data: ReportData): PreviewMetric[] {
  const topRiser = [...(data.weeklyRisers || [])].sort(
    (a, b) => b.pct_change - a.pct_change
  )[0];
  const topFaller = [...(data.weeklyFallers || [])].sort(
    (a, b) => a.pct_change - b.pct_change
  )[0];
  return [
    topRiser
      ? {
          label: "Biggest Riser",
          value: renderPreviewPlayerMetric(
            renderMomentumPreviewPlayer(topRiser),
            formatPreviewPercent(topRiser.pct_change)
          ),
          tone: "good",
          hideLabel: true,
        }
      : null,
    topFaller
      ? {
          label: "Biggest Faller",
          value: renderPreviewPlayerMetric(
            renderMomentumPreviewPlayer(topFaller),
            formatPreviewPercent(topFaller.pct_change)
          ),
          tone: "danger",
          hideLabel: true,
        }
      : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildCombinedTrendingPreviewMetrics(data: ReportData): PreviewMetric[] {
  const topAdd = [...(data.trendingAdds || [])].sort(
    (a, b) => b.count - a.count || (b.ktcValue || 0) - (a.ktcValue || 0)
  )[0];
  const topDrop = [...(data.trendingDrops || [])].sort(
    (a, b) => b.count - a.count || (b.ktcValue || 0) - (a.ktcValue || 0)
  )[0];

  return [
    topAdd
      ? {
          label: "Top add",
          value: renderPreviewPlayerMetric(
            renderTrendingPreviewPlayer(topAdd),
            formatPreviewCount(topAdd.count)
          ),
          tone: "good",
          hideLabel: true,
        }
      : null,
    topDrop
      ? {
          label: "Top drop",
          value: renderPreviewPlayerMetric(
            renderTrendingPreviewPlayer(topDrop),
            formatPreviewCount(topDrop.count)
          ),
          tone: "danger",
          hideLabel: true,
        }
      : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildRecentTransactionPreviewMetrics(
  transactions?: ReportData["recentTransactions"],
  leagueValueMode: LeagueValueMode = "dynasty"
): PreviewMetric[] {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  return [...(transactions || [])]
    .filter(transaction => {
      const timestamp = Date.parse(transaction.date);
      return (
        Number.isFinite(timestamp) &&
        timestamp >= sevenDaysAgo &&
        timestamp <= now
      );
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .map(transaction => ({
      transaction,
      player: transaction.addedPlayer || transaction.droppedPlayer,
      tone: transaction.addedPlayer ? ("good" as const) : ("danger" as const),
      label: transaction.addedPlayer ? "Added" : "Dropped",
    }))
    .filter(item => item.player)
    .slice(0, 4)
    .map((item, index): PreviewMetric => {
      const rank = getRecentTransactionPreviewRank(
        item.player,
        leagueValueMode
      );
      return {
        label: `${item.label} ${index + 1}`,
        value: renderPreviewPlayerMetric(
          renderRecentTransactionPreviewPlayer(item.player),
          rank,
          rank
            ? `analysis-preview-player-count-rank ${getPositionRankClass(rank)}`
            : undefined
        ),
        tone: item.tone,
        hideLabel: true,
      };
    });
}

function formatTradeProposalPreviewDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTradeProposalPreviewStatus(status?: string | null): string {
  const label = String(status || "unknown")
    .replace(/_/g, " ")
    .trim();
  if (!label) return "Unknown";
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function getTradeProposalPreviewTone(
  status?: string | null
): PreviewMetric["tone"] {
  if (!status) return "neutral";
  if (/declin|reject|cancel|veto|expire|fail/i.test(status)) return "danger";
  if (/pending|open|waiting|propos|active/i.test(status)) return "warn";
  if (/accept|complete/i.test(status)) return "good";
  return "info";
}

function buildTradeProposalPreviewMetrics(
  reportData: ReportData
): PreviewMetric[] {
  const signals = [
    ...(reportData.adminTradeProposalSignals ||
      reportData.tradeProposalSignals ||
      []),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const latestSignal = signals[0] || null;

  if (!signals.length) return [];

  return [
    {
      label: "Signals",
      value: signals.length,
      tone: signals.length ? "info" : "warn",
    },
    {
      label: "Latest",
      value: latestSignal
        ? formatTradeProposalPreviewDate(latestSignal.date)
        : "-",
      tone: latestSignal ? "good" : "neutral",
    },
    {
      label: "Status",
      value: latestSignal
        ? formatTradeProposalPreviewStatus(latestSignal.status)
        : "-",
      tone: latestSignal
        ? getTradeProposalPreviewTone(latestSignal.status)
        : "neutral",
    },
  ];
}

function normalizeAdminViewMode(value: unknown): AdminViewMode | null {
  return value === "admin" || value === "regular" ? value : null;
}

type SleeperLeagueOption = {
  leagueId: string;
  name: string;
  avatarUrl: string | null;
  season: string;
  format: string;
  mobileFormat: string;
  totalRosters: number;
  standingsRank: number | null;
  powerRank: number | null;
  rosterPlayers?: PortfolioLeaguePlayer[];
  managerAnchors?: LoaderManagerAnchor[];
};

type LeagueRankResult = Pick<
  SleeperLeagueOption,
  "leagueId" | "standingsRank" | "powerRank" | "rosterPlayers" | "managerAnchors"
>;

type PortfolioLeaguePlayer = {
  playerId: string;
  name: string;
  position: string | null;
  team: string | null;
  value: number;
  positionRank: string | null;
  rosterSpot: "active" | "taxi" | "reserve";
};

type AnalysisLeaguePreview = {
  leagueName: string;
  leagueFormat: string;
  leagueLogo: string | null;
};

type SleeperUserSession = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  hasAdminPermissions?: boolean;
  isPrivilegedReportViewer?: boolean;
};

type AdminViewMode = "admin" | "regular";

type CachedReport = {
  cacheVersion?: string;
  leagueId: string;
  leagueName: string;
  leagueLogo: string | null;
  leagueFormat: string;
  activeTab: string;
  reportData: ReportData;
  savedAt: number;
};

type ReportDeltaPlayer = {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
  metricLabel: string | null;
};

type ReportDeltaAction = {
  id: string;
  decision: AIActionQueueItem["decision"];
  label: string;
  action: string;
  target: string;
  confidence: number;
};

type ReportDeltaSnapshot = {
  schemaVersion: 1;
  leagueId: string;
  leagueName: string;
  savedAt: number;
  valueMode: LeagueValueMode;
  action: ReportDeltaAction | null;
  topRiser: ReportDeltaPlayer | null;
  topFaller: ReportDeltaPlayer | null;
  topWaiver: ReportDeltaPlayer | null;
  tradeCount: number;
  transactionCount: number;
  scheduleStatus: string | null;
  scheduleSignalCount: number;
  aiConfidence: number | null;
  signature: string;
};

type ReportDeltaSnapshotStore = {
  schemaVersion: 1;
  snapshots: Record<string, ReportDeltaSnapshot>;
};

type LastLeague = Omit<CachedReport, "reportData">;

type SleeperSession = {
  username: string;
  user?: SleeperUserSession | null;
  leagues: SleeperLeagueOption[];
  adminViewMode?: AdminViewMode | null;
  savedAt: number;
};

type CachedSleeperUser = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  hasAdminPermissions: boolean;
  isPrivilegedReportViewer?: boolean;
  leagues: SleeperLeagueOption[];
  recentLeagueIds: string[];
  savedAt: number;
};

function getAnalysisLeaguePreview(
  league: SleeperLeagueOption
): AnalysisLeaguePreview {
  return {
    leagueName: league.name,
    leagueFormat:
      league.format ||
      league.mobileFormat ||
      `${league.totalRosters || "?"}-Team League`,
    leagueLogo: league.avatarUrl,
  };
}

function isFreshTimestamp(value: unknown, maxAgeMs: number): boolean {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return false;
  }
  return Date.now() - value <= maxAgeMs;
}

function getReportCacheDbKey(leagueId?: string | null): string {
  const normalizedLeagueId = String(leagueId || "").trim();
  return normalizedLeagueId
    ? `${REPORT_CACHE_KEY}:${normalizedLeagueId}`
    : REPORT_CACHE_KEY;
}

function normalizeReportLeagueId(value: unknown): string {
  return String(value || "").trim();
}

function getReportDataLeagueId(reportData?: ReportData | null): string {
  return normalizeReportLeagueId(reportData?.leagueId);
}

function withReportDataLeagueId(
  reportData: ReportData,
  leagueId?: string | null
): ReportData {
  const normalizedLeagueId = normalizeReportLeagueId(leagueId);
  if (!normalizedLeagueId || getReportDataLeagueId(reportData) === normalizedLeagueId) {
    return reportData;
  }
  return {
    ...reportData,
    leagueId: normalizedLeagueId,
  };
}

function hasMatchingCachedReportLeagueIdentity(
  report: CachedReport,
  leagueId?: string | null
): boolean {
  const expectedLeagueId = normalizeReportLeagueId(leagueId);
  const cachedLeagueId = normalizeReportLeagueId(report.leagueId);
  const reportDataLeagueId = getReportDataLeagueId(report.reportData);
  if (!cachedLeagueId) return false;
  if (expectedLeagueId && cachedLeagueId !== expectedLeagueId) return false;
  if (reportDataLeagueId && reportDataLeagueId !== cachedLeagueId) return false;
  return true;
}

function normalizeCachedReportLeagueIdentity(report: CachedReport): CachedReport {
  const normalizedLeagueId = normalizeReportLeagueId(report.leagueId);
  if (!normalizedLeagueId) return report;
  const reportData = withReportDataLeagueId(report.reportData, normalizedLeagueId);
  return reportData === report.reportData ? report : { ...report, reportData };
}

function isUsableCachedReport(
  report: CachedReport | null,
  leagueId?: string | null
): boolean {
  if (!report) return false;
  return (
    report.cacheVersion === REPORT_CACHE_DATA_VERSION &&
    hasMatchingCachedReportLeagueIdentity(report, leagueId) &&
    isFreshTimestamp(report.savedAt, REPORT_CACHE_MAX_AGE_MS)
  );
}

function shouldBackgroundRefreshCachedReport(report: CachedReport | null) {
  if (!report || !isUsableCachedReport(report)) return false;
  return Date.now() - report.savedAt >= REPORT_BACKGROUND_REFRESH_AFTER_MS;
}

function openReportCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    const request = window.indexedDB.open(
      REPORT_CACHE_DB_NAME,
      REPORT_CACHE_DB_VERSION
    );
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REPORT_CACHE_DB_STORE)) {
        db.createObjectStore(REPORT_CACHE_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readIndexedDbReportCache(
  leagueId?: string | null
): Promise<CachedReport | null> {
  const db = await openReportCacheDb();
  if (!db) return null;

  return new Promise(resolve => {
    const transaction = db.transaction(REPORT_CACHE_DB_STORE, "readonly");
    const store = transaction.objectStore(REPORT_CACHE_DB_STORE);
    const request = store.get(getReportCacheDbKey(leagueId));
    request.onsuccess = () => {
      const cachedReport = (request.result as CachedReport) || null;
      resolve(
        cachedReport
          ? normalizeCachedReportLeagueIdentity(sanitizeCachedReport(cachedReport))
          : null
      );
    };
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

async function writeIndexedDbReportCache(report: CachedReport): Promise<void> {
  const db = await openReportCacheDb();
  if (!db) return;
  const sanitizedReport = normalizeCachedReportLeagueIdentity(
    sanitizeCachedReport(report)
  );

  await new Promise<void>(resolve => {
    const transaction = db.transaction(REPORT_CACHE_DB_STORE, "readwrite");
    const store = transaction.objectStore(REPORT_CACHE_DB_STORE);
    store.put(sanitizedReport, REPORT_CACHE_KEY);
    store.put(sanitizedReport, getReportCacheDbKey(sanitizedReport.leagueId));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

async function clearIndexedDbReportCache(leagueId?: string | null): Promise<void> {
  const db = await openReportCacheDb();
  if (!db) return;

  await new Promise<void>(resolve => {
    const transaction = db.transaction(REPORT_CACHE_DB_STORE, "readwrite");
    const store = transaction.objectStore(REPORT_CACHE_DB_STORE);
    store.delete(REPORT_CACHE_KEY);
    if (leagueId) store.delete(getReportCacheDbKey(leagueId));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

function clearBrowserReportCache(leagueId?: string | null) {
  localStorage.removeItem(REPORT_CACHE_KEY);
  const normalizedLeagueId = normalizeReportLeagueId(leagueId);
  if (normalizedLeagueId) {
    localStorage.removeItem(getReportCacheDbKey(normalizedLeagueId));
  }
  void clearIndexedDbReportCache(leagueId);
}

function readLocalStorageReportCache(key: string): CachedReport | null {
  try {
    const cachedReport = localStorage.getItem(key);
    if (!cachedReport) return null;
    return normalizeCachedReportLeagueIdentity(
      sanitizeCachedReport(JSON.parse(cachedReport) as CachedReport)
    );
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

async function readBrowserReportCache(
  leagueId?: string | null
): Promise<CachedReport | null> {
  const normalizedLeagueId = normalizeReportLeagueId(leagueId);
  if (normalizedLeagueId) {
    const leagueLocalReport = readLocalStorageReportCache(
      getReportCacheDbKey(normalizedLeagueId)
    );
    if (isUsableCachedReport(leagueLocalReport, normalizedLeagueId)) {
      return leagueLocalReport;
    }

    const leagueIndexedReport = await readIndexedDbReportCache(normalizedLeagueId);
    if (isUsableCachedReport(leagueIndexedReport, normalizedLeagueId)) {
      return leagueIndexedReport;
    }

    const globalLocalReport = readLocalStorageReportCache(REPORT_CACHE_KEY);
    return isUsableCachedReport(globalLocalReport, normalizedLeagueId)
      ? globalLocalReport
      : null;
  }

  const globalLocalReport = readLocalStorageReportCache(REPORT_CACHE_KEY);
  if (isUsableCachedReport(globalLocalReport)) return globalLocalReport;
  const globalIndexedReport = await readIndexedDbReportCache();
  return isUsableCachedReport(globalIndexedReport) ? globalIndexedReport : null;
}

function writeBrowserReportCache(report: CachedReport) {
  const sanitizedReport = normalizeCachedReportLeagueIdentity(
    sanitizeCachedReport(report)
  );
  void writeIndexedDbReportCache(sanitizedReport);
  try {
    localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(sanitizedReport));
    localStorage.setItem(
      getReportCacheDbKey(sanitizedReport.leagueId),
      JSON.stringify(sanitizedReport)
    );
  } catch {
    localStorage.removeItem(REPORT_CACHE_KEY);
    localStorage.removeItem(getReportCacheDbKey(sanitizedReport.leagueId));
  }
}

function getEmptyReportDeltaSnapshotStore(): ReportDeltaSnapshotStore {
  return {
    schemaVersion: 1,
    snapshots: {},
  };
}

function readReportDeltaSnapshotStore(): ReportDeltaSnapshotStore {
  if (typeof window === "undefined") return getEmptyReportDeltaSnapshotStore();
  try {
    const raw = window.localStorage.getItem(REPORT_DELTA_SNAPSHOT_KEY);
    if (!raw) return getEmptyReportDeltaSnapshotStore();
    const parsed = JSON.parse(raw) as Partial<ReportDeltaSnapshotStore>;
    if (parsed.schemaVersion !== 1 || !parsed.snapshots) {
      return getEmptyReportDeltaSnapshotStore();
    }
    return {
      schemaVersion: 1,
      snapshots: parsed.snapshots as Record<string, ReportDeltaSnapshot>,
    };
  } catch {
    window.localStorage.removeItem(REPORT_DELTA_SNAPSHOT_KEY);
    return getEmptyReportDeltaSnapshotStore();
  }
}

function readReportDeltaSnapshot(leagueId?: string | null): ReportDeltaSnapshot | null {
  const normalizedLeagueId = String(leagueId || "").trim();
  if (!normalizedLeagueId) return null;
  return readReportDeltaSnapshotStore().snapshots[normalizedLeagueId] || null;
}

function writeReportDeltaSnapshot(snapshot: ReportDeltaSnapshot) {
  if (typeof window === "undefined") return;
  const store = readReportDeltaSnapshotStore();
  const nextSnapshots: Record<string, ReportDeltaSnapshot> = {
    ...store.snapshots,
    [snapshot.leagueId]: snapshot,
  };
  const prunedEntries = Object.entries(nextSnapshots)
    .sort(([, a], [, b]) => (b.savedAt || 0) - (a.savedAt || 0))
    .slice(0, REPORT_DELTA_MAX_LEAGUES);

  try {
    window.localStorage.setItem(
      REPORT_DELTA_SNAPSHOT_KEY,
      JSON.stringify({
        schemaVersion: 1,
        snapshots: prunedEntries.reduce<Record<string, ReportDeltaSnapshot>>(
          (acc, [key, value]) => {
            acc[key] = value;
            return acc;
          },
          {}
        ),
      })
    );
  } catch {
    window.localStorage.removeItem(REPORT_DELTA_SNAPSHOT_KEY);
  }
}

function getReportDeltaPlayerId(
  player?: { player_id?: string | null; id?: string | null; name?: string | null } | null
) {
  return String(player?.player_id || player?.id || player?.name || "").trim();
}

function buildReportDeltaPlayer(
  player?: {
    player_id?: string | null;
    id?: string | null;
    name?: string | null;
    pos?: string | null;
    position?: string | null;
    team?: string | null;
    playerDetails?: { team?: string | null } | null;
  } | null,
  metricLabel?: string | null
): ReportDeltaPlayer | null {
  const name = String(player?.name || "").trim();
  if (!name) return null;
  return {
    id: getReportDeltaPlayerId(player) || name,
    name,
    position: player?.pos || player?.position || null,
    team: player?.playerDetails?.team || player?.team || null,
    metricLabel: metricLabel || null,
  };
}

function getReportDeltaPlayerFingerprint(player?: ReportDeltaPlayer | null) {
  if (!player) return "none";
  return `${player.id || player.name}:${player.position || ""}`;
}

function getReportDeltaActionFingerprint(action?: ReportDeltaAction | null) {
  if (!action) return "none";
  return `${action.id}:${action.decision}:${action.action}:${action.target}:${action.confidence}`;
}

function getReportDeltaSnapshotSignature(snapshot: Omit<ReportDeltaSnapshot, "signature">) {
  return [
    snapshot.valueMode,
    getReportDeltaActionFingerprint(snapshot.action),
    getReportDeltaPlayerFingerprint(snapshot.topRiser),
    getReportDeltaPlayerFingerprint(snapshot.topFaller),
    getReportDeltaPlayerFingerprint(snapshot.topWaiver),
    snapshot.tradeCount,
    snapshot.transactionCount,
    snapshot.scheduleStatus || "none",
    snapshot.scheduleSignalCount,
    snapshot.aiConfidence ?? "none",
  ].join("|");
}

function buildReportDeltaAction(
  reportData: ReportData,
  valueMode: LeagueValueMode
): ReportDeltaAction | null {
  const autopilotMode = valueMode === "redraft" ? "redraft" : "dynasty";
  try {
    const action = buildAutopilotData({
      reportData,
      mode: autopilotMode,
      fallback: AUTOPILOT_MOCK_DATA[autopilotMode],
    }).actionQueue?.[0];
    if (!action) return null;
    return {
      id: action.id,
      decision: action.decision,
      label: action.label,
      action: action.action,
      target: action.target,
      confidence: action.confidence,
    };
  } catch {
    return null;
  }
}

function buildReportDeltaSnapshot(
  reportData: ReportData,
  leagueId: string,
  leagueName: string
): ReportDeltaSnapshot | null {
  const normalizedLeagueId = leagueId.trim();
  if (!normalizedLeagueId) return null;
  const valueMode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );
  const topRiser =
    [...(reportData.weeklyRisers || [])].sort(
      (a, b) => (b.pct_change || 0) - (a.pct_change || 0)
    )[0] || null;
  const topFaller =
    [...(reportData.weeklyFallers || [])].sort(
      (a, b) => (a.pct_change || 0) - (b.pct_change || 0)
    )[0] || null;
  const weeklyWaiverTarget =
    [...(reportData.waiverIntelligence?.weeklyEcrTargets || [])].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    )[0]?.player || null;
  const topWaiver =
    weeklyWaiverTarget ||
    [...(reportData.waiverIntelligence?.availableTrendingAdds || [])].sort(
      (a, b) => (b.count || 0) - (a.count || 0)
    )[0] ||
    null;
  const schedulePlanning = reportData.schedulePlanning || null;
  const scheduleSignalCount =
    (schedulePlanning?.rosterGaps?.length || 0) +
    (schedulePlanning?.streamerCandidates?.length || 0) +
    (schedulePlanning?.byeWeekNotes?.length || 0);
  const snapshotWithoutSignature: Omit<ReportDeltaSnapshot, "signature"> = {
    schemaVersion: 1,
    leagueId: normalizedLeagueId,
    leagueName: leagueName || "Sleeper League",
    savedAt: Date.now(),
    valueMode,
    action: buildReportDeltaAction(reportData, valueMode),
    topRiser: buildReportDeltaPlayer(
      topRiser,
      topRiser ? formatDashboardSignedPercentLabel(topRiser.pct_change) : null
    ),
    topFaller: buildReportDeltaPlayer(
      topFaller,
      topFaller ? formatDashboardSignedPercentLabel(topFaller.pct_change) : null
    ),
    topWaiver: buildReportDeltaPlayer(
      topWaiver,
      topWaiver ? "Top available" : null
    ),
    tradeCount: reportData.tradeHistory?.length || 0,
    transactionCount: reportData.recentTransactions?.length || 0,
    scheduleStatus: schedulePlanning?.status || null,
    scheduleSignalCount,
    aiConfidence: reportData.leagueDiagnostics?.aiConfidence?.score ?? null,
  };

  return {
    ...snapshotWithoutSignature,
    signature: getReportDeltaSnapshotSignature(snapshotWithoutSignature),
  };
}

function getReportDeltaActionTone(action?: ReportDeltaAction | null): ReportDeltaTone {
  if (!action) return "neutral";
  if (action.decision === "do") return "good";
  if (action.decision === "blocked") return "danger";
  if (action.decision === "hold") return "warn";
  return "info";
}

function describeReportDeltaAction(action?: ReportDeltaAction | null): string {
  if (!action) return "no primary action";
  const verb = String(action.action || action.label || "").trim();
  return verb ? `${verb}: ${action.target}` : action.target;
}

function describeReportDeltaPlayer(player?: ReportDeltaPlayer | null): string {
  if (!player) return "No player";
  const meta = [player.position, player.team].filter(Boolean).join(" · ");
  return meta ? `${player.name} (${meta})` : player.name;
}

function buildReportDeltaChanges(
  previous: ReportDeltaSnapshot | null,
  current: ReportDeltaSnapshot | null
): ReportDeltaChange[] {
  if (!previous || !current || previous.signature === current.signature) {
    return [];
  }

  const changes: ReportDeltaChange[] = [];
  const previousAction = previous.action;
  const currentAction = current.action;
  if (getReportDeltaActionFingerprint(previousAction) !== getReportDeltaActionFingerprint(currentAction) && currentAction) {
    changes.push({
      id: "action",
      label: "Decision changed",
      summary: describeReportDeltaAction(currentAction),
      detail: previousAction
        ? `Previously ${describeReportDeltaAction(previousAction)}. Now ${describeReportDeltaAction(currentAction)}.`
        : `${describeReportDeltaAction(currentAction)} is the current primary action.`,
      tone: getReportDeltaActionTone(currentAction),
      receipts: [
        `Previous: ${previousAction ? describeReportDeltaAction(previousAction) : "no action"}`,
        `Current confidence: ${currentAction.confidence}%`,
        `Mode: ${current.valueMode}`,
      ],
      priority: 10,
    });
  }

  if (getReportDeltaPlayerFingerprint(previous.topWaiver) !== getReportDeltaPlayerFingerprint(current.topWaiver) && current.topWaiver) {
    changes.push({
      id: "waiver",
      label: "Waiver target changed",
      summary: describeReportDeltaPlayer(current.topWaiver),
      detail: previous.topWaiver
        ? `Moved ahead of ${previous.topWaiver.name} in the available-player read.`
        : "A new available-player target has enough evidence to surface.",
      tone: "info",
      receipts: [
        current.topWaiver.metricLabel || "Top available",
        `Previous: ${previous.topWaiver?.name || "none"}`,
      ],
      priority: 8,
    });
  }

  if (current.transactionCount > previous.transactionCount) {
    const added = current.transactionCount - previous.transactionCount;
    changes.push({
      id: "transactions",
      label: "Sleeper activity changed",
      summary: `${added} new transaction${added === 1 ? "" : "s"}`,
      detail: "Roster ownership/status moved since the last saved report.",
      tone: "warn",
      receipts: [
        `Previous events: ${previous.transactionCount}`,
        `Current events: ${current.transactionCount}`,
      ],
      priority: 7,
    });
  }

  if (current.tradeCount > previous.tradeCount) {
    const added = current.tradeCount - previous.tradeCount;
    changes.push({
      id: "trades",
      label: "Trade market moved",
      summary: `${added} new trade${added === 1 ? "" : "s"}`,
      detail: "The trade ledger changed enough to re-check manager tendencies.",
      tone: "info",
      receipts: [
        `Previous trades: ${previous.tradeCount}`,
        `Current trades: ${current.tradeCount}`,
      ],
      priority: 6,
    });
  }

  if (getReportDeltaPlayerFingerprint(previous.topRiser) !== getReportDeltaPlayerFingerprint(current.topRiser) && current.topRiser) {
    changes.push({
      id: "riser",
      label: "Top riser changed",
      summary: describeReportDeltaPlayer(current.topRiser),
      detail: `${current.topRiser.name} is now the strongest positive market move.`,
      tone: "good",
      receipts: [
        current.topRiser.metricLabel || "Positive weekly movement",
        `Previous: ${previous.topRiser?.name || "none"}`,
      ],
      priority: 5,
    });
  }

  if (getReportDeltaPlayerFingerprint(previous.topFaller) !== getReportDeltaPlayerFingerprint(current.topFaller) && current.topFaller) {
    changes.push({
      id: "faller",
      label: "Top faller changed",
      summary: describeReportDeltaPlayer(current.topFaller),
      detail: `${current.topFaller.name} is now the sharpest negative market move.`,
      tone: "danger",
      receipts: [
        current.topFaller.metricLabel || "Negative weekly movement",
        `Previous: ${previous.topFaller?.name || "none"}`,
      ],
      priority: 4,
    });
  }

  if (
    previous.scheduleStatus !== current.scheduleStatus ||
    previous.scheduleSignalCount !== current.scheduleSignalCount
  ) {
    changes.push({
      id: "schedule",
      label: "Schedule read updated",
      summary: `${current.scheduleSignalCount} schedule signal${current.scheduleSignalCount === 1 ? "" : "s"}`,
      detail: "Bye-week, streamer, or schedule-planning evidence changed.",
      tone: current.scheduleStatus === "ready" ? "good" : "warn",
      receipts: [
        `Previous: ${previous.scheduleStatus || "missing"}`,
        `Current: ${current.scheduleStatus || "missing"}`,
      ],
      priority: 3,
    });
  }

  if (
    typeof previous.aiConfidence === "number" &&
    typeof current.aiConfidence === "number" &&
    Math.abs(current.aiConfidence - previous.aiConfidence) >= 5
  ) {
    const delta = current.aiConfidence - previous.aiConfidence;
    changes.push({
      id: "confidence",
      label: "Confidence moved",
      summary: `${delta > 0 ? "+" : ""}${delta} AI confidence`,
      detail:
        delta > 0
          ? "More source evidence is supporting the current read."
          : "The current read is capped harder than the previous baseline.",
      tone: delta > 0 ? "good" : "warn",
      receipts: [
        `Previous: ${previous.aiConfidence}`,
        `Current: ${current.aiConfidence}`,
      ],
      priority: 2,
    });
  }

  return changes.sort((a, b) => b.priority - a.priority);
}

function getLeagueIdAnalysisPreview(leagueId: string): AnalysisLeaguePreview {
  return {
    leagueName: "Sleeper League",
    leagueFormat: `League ID ${leagueId}`,
    leagueLogo: null,
  };
}

function findKnownSleeperLeague(
  leagueId: string,
  userLeagues: SleeperLeagueOption[],
  cachedUsers: CachedSleeperUser[],
  extraLeagues: SleeperLeagueOption[] = []
): SleeperLeagueOption | null {
  const normalizedLeagueId = leagueId.trim();
  if (!normalizedLeagueId) return null;

  const leagueGroups = [
    extraLeagues,
    userLeagues,
    ...cachedUsers.map(user => user.leagues),
  ];

  for (const leagues of leagueGroups) {
    const match = leagues.find(
      league => league.leagueId === normalizedLeagueId
    );
    if (match) return match;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeLeagueOption(value: unknown): SleeperLeagueOption | null {
  if (
    !isRecord(value) ||
    typeof value.leagueId !== "string" ||
    typeof value.name !== "string"
  ) {
    return null;
  }

  return {
    leagueId: value.leagueId,
    name: value.name,
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
    season: typeof value.season === "string" ? value.season : "",
    format: typeof value.format === "string" ? value.format : "",
    mobileFormat:
      typeof value.mobileFormat === "string" ? value.mobileFormat : "",
    totalRosters:
      typeof value.totalRosters === "number" ? value.totalRosters : 0,
    standingsRank:
      typeof value.standingsRank === "number" ? value.standingsRank : null,
    powerRank: typeof value.powerRank === "number" ? value.powerRank : null,
    rosterPlayers: Array.isArray(value.rosterPlayers)
      ? value.rosterPlayers
          .map(normalizePortfolioLeaguePlayer)
          .filter((player): player is PortfolioLeaguePlayer => Boolean(player))
      : undefined,
    managerAnchors: Array.isArray(value.managerAnchors)
      ? value.managerAnchors
          .map(normalizeLoaderManagerAnchor)
          .filter((anchor): anchor is LoaderManagerAnchor => Boolean(anchor))
      : undefined,
  };
}

function normalizePortfolioLeaguePlayer(
  value: unknown
): PortfolioLeaguePlayer | null {
  if (
    !isRecord(value) ||
    typeof value.playerId !== "string" ||
    typeof value.name !== "string"
  ) {
    return null;
  }
  const rosterSpot =
    value.rosterSpot === "taxi" || value.rosterSpot === "reserve"
      ? value.rosterSpot
      : "active";
  const valueScore =
    typeof value.value === "number" && Number.isFinite(value.value)
      ? value.value
      : 0;

  return {
    playerId: value.playerId,
    name: value.name,
    position: typeof value.position === "string" ? value.position : null,
    team: typeof value.team === "string" ? value.team : null,
    value: valueScore,
    positionRank:
      typeof value.positionRank === "string" ? value.positionRank : null,
    rosterSpot,
  };
}

function normalizeLoaderManagerAnchor(value: unknown): LoaderManagerAnchor | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
    return null;
  }

  return {
    id: value.id.trim(),
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
  };
}

function normalizeCachedSleeperUser(value: unknown): CachedSleeperUser | null {
  if (!isRecord(value) || typeof value.username !== "string") return null;
  const username = value.username.trim();
  if (!username) return null;
  const leagues = Array.isArray(value.leagues)
    ? value.leagues
        .map(normalizeLeagueOption)
        .filter((league): league is SleeperLeagueOption => Boolean(league))
    : [];
  const validLeagueIds = new Set(leagues.map(league => league.leagueId));
  const recentLeagueIds = Array.isArray(value.recentLeagueIds)
    ? value.recentLeagueIds
        .filter((leagueId): leagueId is string => typeof leagueId === "string")
        .filter((leagueId, index, list) => list.indexOf(leagueId) === index)
        .filter(leagueId => validLeagueIds.has(leagueId))
        .slice(0, MAX_RECENT_LEAGUES_PER_USER)
    : [];
  const userId =
    typeof value.userId === "string" && value.userId.trim()
      ? value.userId
      : username;
  const displayName =
    typeof value.displayName === "string" && value.displayName.trim()
      ? value.displayName
      : username;
  const hasAdminPermissions =
    value.hasAdminPermissions === true ||
    value.isPrivilegedReportViewer === true;

  return {
    userId,
    username,
    displayName,
    avatarUrl:
      typeof value.avatarUrl === "string" && value.avatarUrl.trim()
        ? value.avatarUrl
        : null,
    hasAdminPermissions,
    isPrivilegedReportViewer: hasAdminPermissions,
    leagues,
    recentLeagueIds,
    savedAt: typeof value.savedAt === "number" ? value.savedAt : 0,
  };
}

function readCachedSleeperUsers(): CachedSleeperUser[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(CACHED_SLEEPER_USERS_KEY) || "[]"
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCachedSleeperUser)
      .filter((user): user is CachedSleeperUser => Boolean(user))
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_CACHED_SLEEPER_USERS);
  } catch {
    localStorage.removeItem(CACHED_SLEEPER_USERS_KEY);
    return [];
  }
}

function writeCachedSleeperUsers(
  users: CachedSleeperUser[]
): CachedSleeperUser[] {
  const next = users
    .filter(user => user.username)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_CACHED_SLEEPER_USERS);
  try {
    localStorage.setItem(CACHED_SLEEPER_USERS_KEY, JSON.stringify(next));
  } catch {
    // Recent account shortcuts are a convenience only.
  }
  return next;
}

function rememberCachedSleeperUser(
  user: CachedSleeperUser
): CachedSleeperUser[] {
  const normalizedUsername = normalizeViewerIdentifier(user.username);
  const normalizedUserId = normalizeViewerIdentifier(user.userId);
  const current = readCachedSleeperUsers();
  const existing = current.find(
    cachedUser =>
      normalizeViewerIdentifier(cachedUser.username) === normalizedUsername ||
      normalizeViewerIdentifier(cachedUser.userId) === normalizedUserId
  );
  const leagueIds = new Set(user.leagues.map(league => league.leagueId));
  const recentLeagueIds = (
    user.recentLeagueIds.length
      ? user.recentLeagueIds
      : existing?.recentLeagueIds || []
  )
    .filter((leagueId, index, list) => list.indexOf(leagueId) === index)
    .filter(leagueId => leagueIds.has(leagueId))
    .slice(0, MAX_RECENT_LEAGUES_PER_USER);
  return writeCachedSleeperUsers([
    { ...user, recentLeagueIds, savedAt: Date.now() },
    ...current.filter(
      cachedUser =>
        normalizeViewerIdentifier(cachedUser.username) !== normalizedUsername &&
        normalizeViewerIdentifier(cachedUser.userId) !== normalizedUserId
    ),
  ]);
}

function buildCachedSleeperUser(
  username: string,
  user: SleeperUserSession | null | undefined,
  leagues: SleeperLeagueOption[]
): CachedSleeperUser {
  const userId = user?.userId || username;
  const displayName = user?.displayName || user?.username || username;
  const hasAdminPermissions =
    user?.hasAdminPermissions === true ||
    user?.isPrivilegedReportViewer === true;
  return {
    userId,
    username: user?.username || username,
    displayName,
    avatarUrl: user?.avatarUrl || null,
    hasAdminPermissions,
    isPrivilegedReportViewer: hasAdminPermissions,
    leagues,
    recentLeagueIds: [],
    savedAt: Date.now(),
  };
}

function mergeLeagueRanks(
  leagues: SleeperLeagueOption[],
  ranks: LeagueRankResult[]
): SleeperLeagueOption[] {
  if (!ranks.length) return leagues;
  const rankByLeagueId = new Map(ranks.map(rank => [rank.leagueId, rank]));
  return leagues.map(league => {
    const rank = rankByLeagueId.get(league.leagueId);
    if (!rank) return league;
    return {
      ...league,
      standingsRank: rank.standingsRank,
      powerRank: rank.powerRank,
      rosterPlayers: rank.rosterPlayers || league.rosterPlayers,
      managerAnchors: Array.isArray(rank.managerAnchors)
        ? rank.managerAnchors
        : league.managerAnchors,
    };
  });
}

function findCachedSleeperUser(
  users: CachedSleeperUser[],
  userId?: string | null,
  username?: string | null
): CachedSleeperUser | null {
  const normalizedUserId = normalizeViewerIdentifier(userId);
  const normalizedUsername = normalizeViewerIdentifier(username);
  return (
    users.find(
      user =>
        (normalizedUserId &&
          normalizeViewerIdentifier(user.userId) === normalizedUserId) ||
        (normalizedUsername &&
          normalizeViewerIdentifier(user.username) === normalizedUsername)
    ) ||
    users[0] ||
    null
  );
}

function getLeagueFallbackInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "DD";
}

function getOrderedLeagueOptions(
  leagues: SleeperLeagueOption[],
  cachedUser: CachedSleeperUser | null
): SleeperLeagueOption[] {
  if (!leagues.length) return [];

  const leagueById = new Map(leagues.map(league => [league.leagueId, league]));
  const seen = new Set<string>();
  const recentLeagues = (cachedUser?.recentLeagueIds || [])
    .map(leagueId => leagueById.get(leagueId))
    .filter((league): league is SleeperLeagueOption => {
      if (!league || seen.has(league.leagueId)) return false;
      seen.add(league.leagueId);
      return true;
    });

  return [
    ...recentLeagues,
    ...leagues.filter(league => !seen.has(league.leagueId)),
  ];
}

function normalizePortfolioSearchValue(value?: string | number | null): string {
  return String(value || "").trim().toLowerCase();
}

function getHomePortfolioKey(player: PortfolioLeaguePlayer): string {
  return (
    player.playerId ||
    [
      normalizePortfolioSearchValue(player.name),
      normalizePortfolioSearchValue(player.position),
      normalizePortfolioSearchValue(player.team),
    ]
      .filter(Boolean)
      .join(":")
  );
}

function buildHomePortfolioRows(
  leagues: SleeperLeagueOption[]
): HomePortfolioRow[] {
  const grouped = new Map<string, HomePortfolioRow>();

  leagues.forEach(league => {
    const leaguePlayers = Array.isArray(league.rosterPlayers)
      ? league.rosterPlayers
      : [];
    const seenInLeague = new Set<string>();

    leaguePlayers.forEach(player => {
      const key = getHomePortfolioKey(player);
      if (!key || seenInLeague.has(key)) return;
      seenInLeague.add(key);

      const leagueMeta: HomePortfolioLeague = {
        leagueId: league.leagueId,
        name: league.name,
        avatarUrl: league.avatarUrl,
        format: league.format,
        mobileFormat: league.mobileFormat,
      };
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          id: key,
          playerId: player.playerId,
          name: player.name,
          position: player.position,
          team: player.team,
          value: player.value,
          positionRank: player.positionRank,
          leagueCount: 1,
          leagueShare: leagues.length ? 1 / leagues.length : 0,
          rosterSpots: [player.rosterSpot],
          leagues: [leagueMeta],
        });
        return;
      }

      existing.leagueCount += 1;
      existing.leagueShare = leagues.length
        ? existing.leagueCount / leagues.length
        : 0;
      existing.leagues.push(leagueMeta);
      existing.rosterSpots.push(player.rosterSpot);
      if (player.value > existing.value) existing.value = player.value;
      if (!existing.positionRank && player.positionRank) {
        existing.positionRank = player.positionRank;
      }
      if (!existing.team && player.team) existing.team = player.team;
      if (!existing.position && player.position) existing.position = player.position;
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.leagueCount !== a.leagueCount) return b.leagueCount - a.leagueCount;
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name);
  });
}

function filterHomePortfolioRows(
  rows: HomePortfolioRow[],
  query: string
): HomePortfolioRow[] {
  const normalizedQuery = normalizePortfolioSearchValue(query);
  if (!normalizedQuery) return rows;
  return rows.filter(row => {
    const haystack = [
      row.name,
      row.team,
      row.position,
      row.positionRank,
      ...row.leagues.map(league => league.name),
      ...row.leagues.map(league => league.format),
    ]
      .map(normalizePortfolioSearchValue)
      .join(" ");
    return haystack.includes(normalizedQuery);
  });
}

function getReportManagerNames(
  reportData: ReportData,
  viewerManager?: string | null
): string[] {
  const managerNames = new Set<string>();
  const addManager = (value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed && !isPlaceholderManagerName(trimmed)) {
      managerNames.add(trimmed);
    }
  };

  (reportData.currentStandings || []).forEach(row => addManager(row.manager));

  if (!managerNames.size) {
    (reportData.leagueOverview || []).forEach(row => addManager(row.manager));
    (reportData.managerRosterIntelligence || []).forEach(row =>
      addManager(row.manager)
    );
    (reportData.managerPositionCounts || []).forEach(row =>
      addManager(row.manager)
    );
    (reportData.powerRankings || []).forEach(row => addManager(row.manager));
  }

  if (!managerNames.size) {
    Object.keys(reportData.managerAvatars || {}).forEach(addManager);
    Object.keys(reportData.managerChampionships || {}).forEach(addManager);
    (reportData.standingsHistory || []).forEach(row => addManager(row.manager));
    (reportData.tradeProfitLeaderboard || []).forEach(row =>
      addManager(row.manager)
    );
    (reportData.tradeTendencies || []).forEach(row => addManager(row.manager));
    (reportData.dynastyTimelines || []).forEach(row => addManager(row.manager));
    (reportData.pickPortfolios || []).forEach(row => addManager(row.manager));
    (reportData.monthlyBlueprintHistory || []).forEach(row =>
      addManager(row.manager)
    );
    (reportData.matchupPreviews || []).forEach(row => addManager(row.manager));
    (reportData.recentTransactions || []).forEach(row =>
      addManager(row.manager)
    );
    (reportData.draftPicks || []).forEach(row => addManager(row.manager));
    addManager(reportData.viewerManager);
  }

  return sortRowsByViewerAndStanding(
    Array.from(managerNames),
    manager => manager,
    {
      viewerManager,
      standings: reportData.currentStandings,
      leagueOverview: reportData.leagueOverview,
    }
  );
}

function buildLoadingManagerAnchors(
  reportData: ReportData | null,
  viewerManager?: string | null
): LoaderManagerAnchor[] {
  if (!reportData) return [];

  return getReportManagerNames(reportData, viewerManager).map(manager => ({
    id: manager,
    avatarUrl: reportData.managerAvatars?.[manager] || null,
  }));
}

function buildPreviewLoadingManagerAnchors(count = 12): LoaderManagerAnchor[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `preview-manager-${index + 1}`,
    avatarUrl: null,
  }));
}

function rememberCachedSleeperLeagueShortcut({
  users,
  user,
  username,
  leagues,
  leagueId,
}: {
  users: CachedSleeperUser[];
  user: SleeperUserSession | null;
  username: string;
  leagues: SleeperLeagueOption[];
  leagueId: string;
}): CachedSleeperUser[] {
  const normalizedUsername = normalizeViewerIdentifier(
    user?.username || username
  );
  const normalizedUserId = normalizeViewerIdentifier(user?.userId || username);
  const leagueIds = new Set(leagues.map(league => league.leagueId));
  if (!normalizedUsername || !leagueIds.has(leagueId)) return users;

  const existing = findCachedSleeperUser(
    users,
    user?.userId || null,
    user?.username || username
  );
  const base = existing || buildCachedSleeperUser(username, user, leagues);
  const nextRecentLeagueIds = [leagueId, ...(base.recentLeagueIds || [])]
    .filter((id, index, list) => list.indexOf(id) === index)
    .filter(id => leagueIds.has(id))
    .slice(0, MAX_RECENT_LEAGUES_PER_USER);
  const nextUser: CachedSleeperUser = {
    ...base,
    userId: user?.userId || base.userId || username,
    username: user?.username || base.username || username,
    displayName: user?.displayName || base.displayName || username,
    avatarUrl: user?.avatarUrl || base.avatarUrl || null,
    hasAdminPermissions:
      user?.hasAdminPermissions === true ||
      user?.isPrivilegedReportViewer === true ||
      base.hasAdminPermissions === true ||
      base.isPrivilegedReportViewer === true,
    isPrivilegedReportViewer:
      user?.hasAdminPermissions === true ||
      user?.isPrivilegedReportViewer === true ||
      base.hasAdminPermissions === true ||
      base.isPrivilegedReportViewer === true,
    leagues,
    recentLeagueIds: nextRecentLeagueIds,
    savedAt: Date.now(),
  };

  return writeCachedSleeperUsers([
    nextUser,
    ...users.filter(
      cachedUser =>
        normalizeViewerIdentifier(cachedUser.username) !== normalizedUsername &&
        normalizeViewerIdentifier(cachedUser.userId) !== normalizedUserId
    ),
  ]);
}

function cachedSleeperUserToSessionUser(
  user: CachedSleeperUser
): SleeperUserSession {
  return {
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    hasAdminPermissions: user.hasAdminPermissions,
    isPrivilegedReportViewer: user.hasAdminPermissions,
  };
}

function readAutocompleteHistory(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map(value => value.trim())
      .filter(Boolean)
      .slice(0, MAX_AUTOCOMPLETE_HISTORY);
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function rememberAutocompleteValue(key: string, value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return readAutocompleteHistory(key);
  const current = readAutocompleteHistory(key);
  const next = [
    trimmed,
    ...current.filter(item => item.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_AUTOCOMPLETE_HISTORY);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Autocomplete history is a convenience only.
  }
  return next;
}

function getFilteredAutocompleteOptions(
  history: string[],
  value: string
): string[] {
  const needle = value.trim().toLowerCase();
  return history
    .filter(item => !needle || item.toLowerCase().includes(needle))
    .slice(0, 6);
}

function getLoadingSuccessTitleClassName(leagueName: string): string {
  const length = leagueName.trim().length;
  if (length >= 34)
    return "loading-success-title loading-success-title-compact";
  if (length >= 20) return "loading-success-title loading-success-title-long";
  return "loading-success-title";
}

function HomeActionRow() {
  return (
    <div className="home-action-row">
      <SupportButton className="home-action-button" />
      <FeedbackButton className="home-action-button" />
    </div>
  );
}

function AdminManagerSwitcher({
  managers,
  activeManager,
  managerAvatars,
  onSelect,
}: {
  managers: string[];
  activeManager: string | null;
  managerAvatars?: ReportData["managerAvatars"];
  onSelect: (manager: string | null) => void;
}) {
  if (managers.length < 2) return null;

  const selectedManagerLabel = activeManager || "League View";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="report-header-action report-footer-primary-action !w-auto min-w-0 flex-1 justify-between gap-1.5 px-2.5 sm:!w-auto sm:min-w-[14rem] sm:max-w-[18rem]"
          aria-label={`View as ${selectedManagerLabel}`}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate text-cyan-50/85">
              {selectedManagerLabel}
            </span>
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 opacity-80"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="w-72 border-orange-400/20 bg-slate-950/95 text-slate-100 shadow-2xl shadow-orange-950/20"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
          View As Manager
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800/80" />
        <DropdownMenuRadioGroup
          value={activeManager || LEAGUE_VIEW_MANAGER_VALUE}
          onValueChange={value =>
            onSelect(value === LEAGUE_VIEW_MANAGER_VALUE ? null : value)
          }
        >
          <DropdownMenuRadioItem
            value={LEAGUE_VIEW_MANAGER_VALUE}
            className="gap-3 py-2 pr-3 pl-8"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-400/25 bg-slate-900 text-[10px] font-bold text-orange-300">
                LV
              </span>
              <span className="truncate">League View</span>
            </span>
          </DropdownMenuRadioItem>
          {managers.map(manager => {
            const avatarUrl = managerAvatars?.[manager] || null;
            return (
              <DropdownMenuRadioItem
                key={manager}
                value={manager}
                className="gap-3 py-2 pr-3 pl-8"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0 rounded-full border border-cyan-300/25 object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-slate-900 text-[10px] font-bold text-orange-300">
                      {getLeagueFallbackInitials(manager)}
                    </span>
                  )}
                  <span className="truncate">{manager}</span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getDashboardNumber(
  row: unknown,
  keys: string[]
): number | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function formatDashboardCompactNumber(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000000)
    return `${Math.round(rounded / 100000) / 10}M`;
  if (Math.abs(rounded) >= 1000) return `${Math.round(rounded / 1000)}K`;
  return rounded.toLocaleString();
}

function getReportDashboardManagers(data: ReportData): string[] {
  const managers = new Set<string>();
  const add = (manager?: string | null) => {
    if (manager && !isPlaceholderManagerName(manager)) managers.add(manager);
  };
  data.leagueOverview?.forEach(row => add(row.manager));
  data.managerRosterIntelligence?.forEach(row => add(row.manager));
  data.managerPositionCounts?.forEach(row => add(row.manager));
  data.powerRankings?.forEach(row => add(row.manager));
  data.currentStandings?.forEach(row => add(row.manager));
  return Array.from(managers);
}

function getDashboardManagerAvatar(
  manager: string,
  avatars?: Record<string, string | null | undefined>
) {
  return avatars?.[manager] || null;
}

function renderDashboardHelperStack(primary: string, secondary: string) {
  return (
    <span className="dashboard-helper-stack">
      <b>{primary}</b>
      <span>{secondary}</span>
    </span>
  );
}

function getDashboardPlayerPosition(player: unknown): string {
  if (!player || typeof player !== "object") return "FLEX";
  const record = player as Record<string, unknown>;
  const position = record.pos || record.position;
  return typeof position === "string" && position.trim()
    ? position.toUpperCase()
    : "FLEX";
}

function getDashboardPlayerId(player: unknown): string | null {
  if (!player || typeof player !== "object") return null;
  const record = player as Record<string, unknown>;
  const id = record.player_id || record.playerId || record.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function getDashboardStarterRank(
  player: unknown,
  currentPositionRankById?: Record<string, string | null | undefined>
): string {
  if (!player || typeof player !== "object") return "-";
  const record = player as Record<string, unknown>;
  const playerId = getDashboardPlayerId(player);
  const rank =
    (playerId && currentPositionRankById?.[playerId]) ||
    record.currentPositionRank ||
    record.seasonPositionRank ||
    record.positionRank ||
    record.position_rank ||
    record.rank;
  return typeof rank === "string" || typeof rank === "number" ? String(rank) : "-";
}

function getDashboardPlayerValue(player: unknown): number | null {
  if (!player || typeof player !== "object") return null;
  const record = player as Record<string, unknown>;
  for (const key of ["seasonValue", "value", "val", "ktc_value"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function sumDashboardPlayerValues(players: unknown[]): number | null {
  const total = players.reduce<number>((sum, player) => {
    const value = getDashboardPlayerValue(player);
    return value === null ? sum : sum + value;
  }, 0);
  return total > 0 ? total : null;
}

function getDashboardRankLabel(
  row: unknown,
  keys: string[],
  prefix = "#"
): string {
  const value = getDashboardNumber(row, keys);
  return value === null ? "#-" : `${prefix}${value}`;
}

const DASHBOARD_LINEUP_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
type DashboardLineupPosition = (typeof DASHBOARD_LINEUP_POSITIONS)[number];

function getDashboardPlayers(row: unknown, key: string): unknown[] {
  if (!row || typeof row !== "object") return [];
  const value = (row as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

function getDashboardStarterCount(
  row: unknown,
  position: DashboardLineupPosition
): number {
  return getDashboardNumber(row, [`${position}_starters`]) ?? 0;
}

function getDashboardPositionStarterValue(
  row: unknown,
  position: DashboardLineupPosition
): number {
  const players = getDashboardPlayers(row, "starterPlayers").filter(
    player => getDashboardPlayerPosition(player) === position
  );
  return players.reduce<number>((sum, player) => {
    const value = getDashboardPlayerValue(player);
    return sum + (value ?? 0);
  }, 0);
}

function getDashboardPositionRank(
  reportData: ReportData,
  manager: string,
  position: DashboardLineupPosition
): number | null {
  const rows = reportData.managerPositionCounts || [];
  const scores = rows
    .map(row => ({
      manager: row.manager,
      count: getDashboardStarterCount(row, position),
      value: getDashboardPositionStarterValue(row, position),
    }))
    .filter(row => row.count > 0 || row.value > 0)
    .sort((a, b) => b.value - a.value || b.count - a.count);
  const index = scores.findIndex(row => row.manager === manager);
  return index >= 0 ? index + 1 : null;
}

function formatDashboardRank(rank: number | null): string {
  return rank === null ? "#-" : `#${rank}`;
}

type DashboardStarterGroup = {
  key: string;
  label: string;
  count: number;
  players: unknown[];
};

function getDashboardStarterGroups(row: unknown): DashboardStarterGroup[] {
  if (!row || typeof row !== "object") return [];
  const value = (row as Record<string, unknown>).starterGroups;
  if (!Array.isArray(value)) return [];
  return value
    .map(group => {
      if (!group || typeof group !== "object") return null;
      const record = group as Record<string, unknown>;
      const key = typeof record.key === "string" ? record.key : "";
      const label =
        typeof record.label === "string" && record.label.trim()
          ? record.label
          : key;
      const count =
        typeof record.count === "number" && Number.isFinite(record.count)
          ? record.count
          : Array.isArray(record.players)
            ? record.players.length
            : 0;
      const players = Array.isArray(record.players) ? record.players : [];
      if (!key) return null;
      return { key, label, count, players };
    })
    .filter((group): group is DashboardStarterGroup => Boolean(group));
}

function getDashboardStarterGroupValue(group: DashboardStarterGroup): number {
  return group.players.reduce<number>((sum, player) => {
    const value = getDashboardPlayerValue(player);
    return sum + (value ?? 0);
  }, 0);
}

function getDashboardStarterGroupRank(
  reportData: ReportData,
  manager: string,
  groupKey: string
): { rank: number | null; total: number } {
  const rows = reportData.managerPositionCounts || [];
  const scores = rows
    .map(row => {
      const group = getDashboardStarterGroups(row).find(
        starterGroup => starterGroup.key === groupKey
      );
      return group
        ? {
            manager: row.manager,
            count: group.count,
            value: getDashboardStarterGroupValue(group),
          }
        : null;
    })
    .filter((row): row is { manager: string; count: number; value: number } =>
      Boolean(row)
    )
    .sort((a, b) => b.value - a.value || b.count - a.count);
  const index = scores.findIndex(row => row.manager === manager);
  return { rank: index >= 0 ? index + 1 : null, total: scores.length };
}

function getDashboardRosterQbPairValue(row: unknown): {
  count: number;
  value: number;
} {
  const rosterPlayers = getDashboardPlayers(row, "rosterPlayers");
  const fallbackPlayers = rosterPlayers.length
    ? rosterPlayers
    : [
        ...getDashboardPlayers(row, "lineupPlayers"),
        ...getDashboardStarterGroups(row).flatMap(group => group.players),
      ];
  const qbs = fallbackPlayers
    .filter(player => getDashboardPlayerPosition(player) === "QB")
    .sort(
      (a, b) =>
        (getDashboardPlayerValue(b) || 0) -
        (getDashboardPlayerValue(a) || 0)
    )
    .slice(0, 2);

  return {
    count: qbs.length,
    value: qbs.reduce<number>(
      (sum, player) => sum + (getDashboardPlayerValue(player) || 0),
      0
    ),
  };
}

function getDashboardQbSfRank(
  reportData: ReportData,
  manager: string
): { rank: number | null; total: number } {
  const scores = (reportData.managerPositionCounts || [])
    .map(row => {
      const qbPair = getDashboardRosterQbPairValue(row);
      return {
        manager: row.manager,
        count: qbPair.count,
        value: qbPair.value,
      };
    })
    .filter(row => row.count > 0 || row.value > 0)
    .sort((a, b) => b.value - a.value || b.count - a.count);
  const index = scores.findIndex(row => row.manager === manager);
  return { rank: index >= 0 ? index + 1 : null, total: scores.length };
}

type DashboardStarterRankGroup = DashboardStarterGroup & {
  position: string;
  rank: number | null;
  tier: string;
};

function getDashboardOverviewStarterRankGroups(
  reportData: ReportData,
  manager: string,
  row: unknown
): DashboardStarterRankGroup[] {
  const groups = getDashboardStarterGroups(row);
  const hasSuperFlex = groups.some(group => group.key === "QB_SF");
  const rankedGroups = groups
    .filter(group =>
      hasSuperFlex ? group.key !== "QB" && group.key !== "QB_SF" : true
    )
    .map(group => {
      const { rank, total } = getDashboardStarterGroupRank(
        reportData,
        manager,
        group.key
      );
      return {
        ...group,
        position: getDashboardGroupPosition(group.key),
        rank,
        tier: getDashboardRankTier(rank, total),
      };
    });

  if (!hasSuperFlex) return rankedGroups;

  const { rank, total } = getDashboardQbSfRank(reportData, manager);
  return [
    {
      key: "QB_SF_COMBINED",
      label: "QB/SF x2",
      count: 2,
      players: [],
      position: "QB_SF",
      rank,
      tier: getDashboardRankTier(rank, total),
    },
    ...rankedGroups,
  ];
}

function getDashboardRankTier(rank: number | null, total: number): string {
  if (!rank || total <= 0) return "Pending";
  if (rank <= Math.max(1, Math.ceil(total * 0.25))) return "Elite";
  if (rank <= Math.max(1, Math.ceil(total * 0.5))) return "Strong";
  if (rank <= Math.max(1, Math.ceil(total * 0.75))) return "Playable";
  return "Thin";
}

function getDashboardGroupPosition(groupKey: string): string {
  if (groupKey === "QB_SF") return "QB_SF";
  if (groupKey === "FLEX") return "FLEX";
  return groupKey;
}

type ReportDashboardTab =
  | "overview"
  | "momentum"
  | "rankings"
  | "trades"
  | "draft"
  | "autopilot"
  | string;

type ReportDashboardHeroCopy = {
  headline: string;
  subline: string;
  body: string;
};

const TAB_HERO_COPY = {
  overview: {
    headline: "LEAGUE AUDIT.\nNO MERCY.",
    subline: "Your league thinks it has balance. It does not.",
    body: "We use AI to expose contenders, frauds, rebuilders, and roster rot before the rest of your league realizes their teams are on the table.",
  },
  momentum: {
    headline: "CATCH THE TILT.\nCASH THE CHAOS.",
    subline: "Bad Sundays create great theft.",
    body: "We track who’s rising, who’s crashing, and who’s one injury report away from accepting a trade they’ll hate by Tuesday.",
  },
  rankings: {
    headline: "POWER RANKINGS.\nWITH TEETH.",
    subline: "Everyone gets a number. Some deserve an apology.",
    body: "We rank every team by real dynasty value, not group chat confidence, so you can see who’s loaded, who’s fake, and who should stop talking.",
  },
  trades: {
    headline: "FIND THE MARK.\nSEND THE FLEECE.",
    subline: "Some managers call it negotiation. We call it inventory removal.",
    body: "We use AI to spot weak rosters, desperate needs, bad depth, and trade windows before your league mates realize their bench became your shopping cart.",
  },
  draft: {
    headline: "DRAFT CAPITAL.\nCOURTROOM.",
    subline: "Picks don’t lie. Managers do.",
    body: "We expose wasted picks, rookie value, future leverage, and the managers who turned draft capital into a public safety warning.",
  },
} satisfies Record<
  "overview" | "momentum" | "rankings" | "trades" | "draft",
  ReportDashboardHeroCopy
>;

function getReportDashboardHeroCopy(
  activeTab?: string | null
): ReportDashboardHeroCopy {
  const normalizedTab = normalizeReportTab(activeTab);
  if (
    normalizedTab &&
    Object.prototype.hasOwnProperty.call(TAB_HERO_COPY, normalizedTab)
  ) {
    return TAB_HERO_COPY[normalizedTab as keyof typeof TAB_HERO_COPY];
  }
  return TAB_HERO_COPY.overview;
}

type DashboardSpotlightConfig = {
  eyebrow: string;
  metrics: DashboardHeroMetric[];
  blocks: DashboardSpotlightBlock[];
  chips: string[];
  readTitle: string;
  read: string;
};

type DashboardRankingPlayer =
  NonNullable<ReportData["rankings"]>["dynastySf"][number];

function clampDashboardScore(value?: number | null): number | null {
  if (value === null || value === undefined || !Number.isFinite(value))
    return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDashboardWholeNumber(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  return Math.round(value).toLocaleString();
}

function formatDashboardSignedNumber(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}`;
}

function formatDashboardPercentLabel(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function formatDashboardSignedPercentLabel(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  const rounded = Math.round(normalized * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function getDashboardTeamCount(reportData: ReportData): number {
  return (
    getReportDashboardManagers(reportData).length ||
    reportData.leagueOverview?.length ||
    reportData.managerPositionCounts?.length ||
    reportData.currentStandings?.length ||
    0
  );
}

function getDashboardLeagueValue(reportData: ReportData): number {
  return (reportData.managerRosterValueGrowth || []).reduce(
    (sum, row) => sum + (row.total_val || 0),
    0
  );
}

function getDashboardActivityScore(count: number, target: number): number | null {
  if (!target) return count ? 100 : null;
  return clampDashboardScore((count / target) * 100);
}

function getDashboardRosteredPlayerCount(reportData: ReportData): number | null {
  const positionRows = reportData.managerPositionCounts || [];
  if (positionRows.length) {
    const total = positionRows.reduce((sum, row) => {
      const fallbackCount =
        (row.activePlayerCount || 0) +
        (row.reservePlayerCount || 0) +
        (row.taxiPlayerCount || 0);
      return (
        sum +
        (row.totalRosterPlayerCount ||
          row.rosterPlayers?.length ||
          fallbackCount)
      );
    }, 0);
    return total || null;
  }

  const intelTotal = (reportData.managerRosterIntelligence || []).reduce(
    (sum, row) => sum + (row.rosterPlayers?.length || 0),
    0
  );
  return intelTotal || null;
}

function getDashboardHeroToneForSignedValue(
  value?: number | null
): DashboardMetricTone {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "neutral";
  if (value > 0) return "good";
  if (value < 0) return "danger";
  return "neutral";
}

function getDashboardRankingRows(
  reportData: ReportData,
  leagueValueMode: LeagueValueMode
): DashboardRankingPlayer[] {
  const rankings = reportData.rankings;
  if (!rankings) return [];

  const profileKey =
    leagueValueMode === "redraft"
      ? rankings.defaultRedraftProfileKey || rankings.defaultProfileKey
      : rankings.defaultProfileKey;
  const profileRows = profileKey ? rankings.profiles?.[profileKey] : null;
  if (profileRows?.length) return profileRows;

  if (leagueValueMode === "redraft") {
    return (
      rankings.redraftHalfPpr ||
      rankings.redraftPpr ||
      rankings.redraftStandard ||
      rankings.dynastySf ||
      []
    );
  }

  return rankings.dynastySf?.length
    ? rankings.dynastySf
    : rankings.dynastyOneQb || [];
}

function getDashboardRankingRowCount(
  reportData: ReportData,
  leagueValueMode: LeagueValueMode
): number {
  const rows = getDashboardRankingRows(reportData, leagueValueMode);
  if (rows.length) return rows.length;

  const rankings = reportData.rankings;
  if (!rankings?.profileRowCounts) return 0;
  const profileKey =
    leagueValueMode === "redraft"
      ? rankings.defaultRedraftProfileKey || rankings.defaultProfileKey
      : rankings.defaultProfileKey;
  if (profileKey && rankings.profileRowCounts[profileKey]) {
    return rankings.profileRowCounts[profileKey];
  }

  const fallbackKey =
    leagueValueMode === "redraft"
      ? rankings.defaultRedraftProfileKey
      : rankings.defaultProfileKey;
  return fallbackKey ? rankings.profileRowCounts[fallbackKey] || 0 : 0;
}

function getDashboardRankingProfileLabel(
  reportData: ReportData,
  leagueValueMode: LeagueValueMode
): string {
  const rankings = reportData.rankings;
  if (!rankings) return leagueValueMode === "redraft" ? "Season" : "Dynasty";

  const profileKey =
    leagueValueMode === "redraft"
      ? rankings.defaultRedraftProfileKey || rankings.defaultProfileKey
      : rankings.defaultProfileKey;
  const optionLabel = rankings.profileOptions?.find(
    option => option.key === profileKey
  )?.label;

  return (
    rankings.selectedProfileLabel ||
    optionLabel ||
    (leagueValueMode === "redraft" ? "Season Blend" : "Dynasty Blend")
  );
}

function getDashboardTopRankingPlayer(
  reportData: ReportData,
  leagueValueMode: LeagueValueMode,
  manager?: string | null
): DashboardRankingPlayer | null {
  const rows = getDashboardRankingRows(reportData, leagueValueMode);
  const pool = manager
    ? rows.filter(row => row.owner === manager)
    : rows;
  return (
    [...pool].sort((a, b) => (b.value || 0) - (a.value || 0))[0] || null
  );
}

function getDashboardPlayerName(player?: { name?: string | null } | null) {
  return player?.name || "-";
}

function getDashboardTrendLabel(
  player?: { name?: string; pos?: string; pct_change?: number; diff?: number } | null
) {
  if (!player) return "-";
  const movement =
    typeof player.pct_change === "number"
      ? formatDashboardSignedPercentLabel(player.pct_change)
      : formatDashboardSignedNumber(player.diff);
  return `${player.name} ${movement}`;
}

function getDashboardLeagueTradeManagers(reportData: ReportData): number {
  const managers = new Set<string>();
  reportData.tradeHistory?.forEach(trade => {
    if (trade.team_a) managers.add(trade.team_a);
    if (trade.team_b) managers.add(trade.team_b);
  });
  reportData.tradeTendencies?.forEach(row => {
    if (row.manager) managers.add(row.manager);
  });
  return managers.size;
}

function getDashboardHandshakeRate(reportData: ReportData): number | null {
  const trades = reportData.tradeHistory || [];
  if (!trades.length) return null;
  const fairTrades = trades.filter(
    trade => Math.abs(trade.point_gap || 0) <= 250
  ).length;
  return clampDashboardScore((fairTrades / trades.length) * 100);
}

function getDashboardDraftHitRate(stats?: {
  hits?: number;
  misses?: number;
} | null): number | null {
  const hits = stats?.hits || 0;
  const misses = stats?.misses || 0;
  const total = hits + misses;
  if (!total) return null;
  return clampDashboardScore((hits / total) * 100);
}

function getDashboardLeagueDraftStats(reportData: ReportData) {
  return (reportData.draftStats || []).reduce(
    (totals, row) => ({
      totalPicks: totals.totalPicks + (row.totalPicks || 0),
      hits: totals.hits + (row.hits || 0),
      misses: totals.misses + (row.misses || 0),
      starters: totals.starters + (row.starters || 0),
      avgKtcGainTotal: totals.avgKtcGainTotal + (row.avgKtcGain || 0),
      managerCount: totals.managerCount + 1,
    }),
    {
      totalPicks: 0,
      hits: 0,
      misses: 0,
      starters: 0,
      avgKtcGainTotal: 0,
      managerCount: 0,
    }
  );
}

function isDashboardMeaningfulHole(summary?: string | null): boolean {
  const normalized = String(summary || "").trim();
  return Boolean(
    normalized &&
      !/^no major roster hole flagged$/i.test(normalized) &&
      !/^none$/i.test(normalized)
  );
}

function getDashboardManagerValueRows(reportData: ReportData) {
  const managers = getReportDashboardManagers(reportData);
  return managers
    .map(manager => {
      const growth = reportData.managerRosterValueGrowth?.find(
        row => row.manager === manager
      );
      const overview = reportData.leagueOverview?.find(
        row => row.manager === manager
      );
      const power = reportData.powerRankings?.find(
        row => row.manager === manager
      );
      const value =
        getDashboardNumber(growth, ["total_val"]) ??
        getDashboardNumber(overview, ["total_val"]) ??
        getDashboardNumber(power, ["rosterValue"]) ??
        null;
      return { manager, value, overview, power };
    })
    .filter((row): row is typeof row & { value: number } => row.value !== null);
}

function getDashboardMarketSpread(reportData: ReportData) {
  const valueRows = getDashboardManagerValueRows(reportData).sort(
    (a, b) => b.value - a.value
  );
  const top = valueRows[0] || null;
  const bottom = valueRows[valueRows.length - 1] || null;
  const gap = top && bottom ? top.value - bottom.value : null;
  const gapPercent =
    gap !== null && bottom?.value ? Math.round((gap / bottom.value) * 100) : null;
  return {
    top,
    bottom,
    gap,
    gapPercent,
    score: top?.value ? clampDashboardScore(((gap || 0) / top.value) * 100) : null,
  };
}

function getDashboardPlayerAssetValue(player?: unknown): number {
  return (
    getDashboardNumber(player, [
      "value",
      "seasonValue",
      "ktcValue",
      "currentKtcValue",
    ]) || 0
  );
}

function getDashboardTopHeavy(reportData: ReportData) {
  const rows = (reportData.managerRosterIntelligence || [])
    .map(row => {
      const starterValue =
        getDashboardNumber(row, ["starterSeasonValue", "starterValue"]) || 0;
      const benchValue = getDashboardNumber(row, ["benchValue"]) || 0;
      const starterValuePct = getDashboardNumber(row, ["starterValuePct"]) || 0;
      const gap = starterValue - benchValue;
      return {
        manager: row.manager,
        gap,
        starterValuePct,
        score: Math.max(0, gap) + starterValuePct * 500,
      };
    })
    .filter(row => row.gap > 0 || row.starterValuePct > 0)
    .sort((a, b) => b.score - a.score);

  return rows[0] || null;
}

function getDashboardThinIce(reportData: ReportData) {
  const rows = (reportData.managerRosterIntelligence || [])
    .map(row => {
      const healthScore = getDashboardNumber(row, ["rosterHealthScore"]);
      const availabilityRisk = row.starterAvailability?.riskLevel;
      const riskScore =
        availabilityRisk === "high" ? 30 : availabilityRisk === "medium" ? 16 : 0;
      const positionWeaknesses = Object.values(row.positionGrades || {}).filter(
        grade =>
          grade.rank === null ||
          /thin|weak|bad|poor|f|d/i.test(`${grade.grade} ${grade.note}`)
      ).length;
      const holeScore = isDashboardMeaningfulHole(row.holes?.summary) ? 12 : 0;
      const flexScore =
        typeof row.holes?.flexDepth === "number"
          ? Math.max(0, 3 - row.holes.flexDepth) * 5
          : 0;
      const holeSummary = row.holes?.summary || "";
      const weakestCoveragePosition = (["QB", "RB", "WR", "TE"] as const)
        .map(position => {
          const grade = row.positionGrades?.[position];
          const gradeText = `${grade?.grade || ""} ${grade?.note || ""}`;
          const weakGrade =
            grade?.rank === null ||
            /thin|weak|bad|poor|f|d|behind|trail/i.test(gradeText);
          const holeMatch =
            new RegExp(`\\b${position}\\b|${position.toLowerCase()}\\d?|${position.toLowerCase()} room`, "i").test(
              holeSummary
            );
          const starterMatch = row.weakestStarter?.pos === position;
          return {
            position,
            score:
              (weakGrade ? 20 : 0) +
              (holeMatch ? 14 : 0) +
              (starterMatch ? 10 : 0) +
              (grade?.rank ? Math.min(12, Math.max(0, grade.rank - 12) / 4) : 0),
          };
        })
        .sort((a, b) => b.score - a.score)[0];
      const score =
        riskScore +
        (row.weakestStarter ? 16 : 0) +
        holeScore +
        flexScore +
        positionWeaknesses * 6 +
        (healthScore !== null ? Math.max(0, 62 - healthScore) : 0);

      return {
        manager: row.manager,
        score,
        riskLevel: availabilityRisk || "low",
        coverage:
          weakestCoveragePosition && weakestCoveragePosition.score > 0
            ? `${weakestCoveragePosition.position} backup plan sucks`
            : null,
        hole:
          isDashboardMeaningfulHole(holeSummary)
            ? holeSummary.split(",")[0]?.trim()
            : null,
      };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return rows[0] || null;
}

function getDashboardBenchRot(reportData: ReportData) {
  const rows = (reportData.managerRosterIntelligence || [])
    .map(row => {
      const lowValuePlayers = [
        ...(row.droppablePlayers || []),
        ...(row.benchPlayers || []),
        ...(row.taxiPlayers || []),
      ].filter(player => getDashboardPlayerAssetValue(player) <= 750);
      const uniquePlayers = new Map<string, unknown>();
      lowValuePlayers.forEach((player, index) => {
        const key =
          getDashboardPlayerId(player) ||
          (player && typeof player === "object"
            ? String((player as unknown as Record<string, unknown>).name || index)
            : String(index));
        uniquePlayers.set(key, player);
      });
      const players = Array.from(uniquePlayers.values()) as unknown[];
      const deadValue = players.reduce<number>(
        (sum, player) => sum + getDashboardPlayerAssetValue(player),
        0
      );
      const count = players.length;
      return {
        manager: row.manager,
        count,
        deadValue,
        score: count * 1000 + deadValue,
      };
    })
    .filter(row => row.count > 0 || row.deadValue > 0)
    .sort((a, b) => b.score - a.score);

  return rows[0] || null;
}

function getDashboardManagerWeeklyMovement(reportData: ReportData) {
  type ManagerWeeklyMovementRow = {
    manager: string;
    gain: number;
    loss: number;
    net: number;
    topGainPlayer?: string;
    topLossPlayer?: string;
  };
  const movement = new Map<
    string,
    ManagerWeeklyMovementRow
  >();
  const ensure = (manager: string) => {
    const existing = movement.get(manager);
    if (existing) return existing;
    const next: ManagerWeeklyMovementRow = { manager, gain: 0, loss: 0, net: 0 };
    movement.set(manager, next);
    return next;
  };

  (reportData.weeklyRisers || []).forEach(player => {
    if (!player.owner || isPlaceholderManagerName(player.owner)) return;
    const row = ensure(player.owner);
    const diff = Math.max(0, player.diff || 0);
    row.gain += diff;
    row.net += diff;
    if (!row.topGainPlayer || diff > 0) row.topGainPlayer = player.name;
  });

  (reportData.weeklyFallers || []).forEach(player => {
    if (!player.owner || isPlaceholderManagerName(player.owner)) return;
    const row = ensure(player.owner);
    const diff = Math.min(0, player.diff || 0);
    row.loss += diff;
    row.net += diff;
    if (!row.topLossPlayer || diff < 0) row.topLossPlayer = player.name;
  });

  const rows = Array.from(movement.values());
  return {
    heat:
      rows
        .filter(row => row.gain > 0)
        .sort((a, b) => b.gain - a.gain)[0] || null,
    tilt:
      rows
        .filter(row => row.loss < 0)
        .sort((a, b) => a.loss - b.loss)[0] || null,
  };
}

function getDashboardTrendStack(reportData: ReportData) {
  type TrendStackRow = {
    manager: string;
    playerKeys: Set<string>;
    addCount: number;
    topAddPlayer: string | null;
    topAddCount: number;
  };
  const rows = new Map<string, TrendStackRow>();
  const ensure = (manager: string) => {
    const existing = rows.get(manager);
    if (existing) return existing;
    const next: TrendStackRow = {
      manager,
      playerKeys: new Set<string>(),
      addCount: 0,
      topAddPlayer: null,
      topAddCount: 0,
    };
    rows.set(manager, next);
    return next;
  };
  const addPlayer = (
    player: NonNullable<ReportData["trendingAdds"]>[number]
  ) => {
    if (!player.owner || isPlaceholderManagerName(player.owner)) return;
    const row = ensure(player.owner);
    const playerKey = player.player_id || `${player.name}-${player.pos}`;
    if (row.playerKeys.has(playerKey)) return;
    const count = Math.max(0, player.count || 0);
    row.playerKeys.add(playerKey);
    row.addCount += count;
    if (count > row.topAddCount) {
      row.topAddPlayer = player.name;
      row.topAddCount = count;
    }
  };

  [...(reportData.trendingAdds || [])]
    .sort((a, b) => b.count - a.count || (b.ktcValue || 0) - (a.ktcValue || 0))
    .slice(0, 5)
    .forEach(addPlayer);

  return (
    Array.from(rows.values())
      .map(row => ({
        manager: row.manager,
        movers: row.playerKeys.size,
        addCount: row.addCount,
        topAddPlayer: row.topAddPlayer,
        topAddCount: row.topAddCount,
        score: row.addCount * 100 + row.playerKeys.size,
      }))
      .filter(row => row.addCount > 0)
      .sort((a, b) => b.score - a.score)[0] || null
  );
}

function getDashboardTiltRead(reportData: ReportData, teamCount: number) {
  const pressureManagers = new Map<string, number>();
  (reportData.weeklyFallers || []).forEach(player => {
    if (!player.owner || isPlaceholderManagerName(player.owner)) return;
    const pressure =
      Math.abs(player.pct_change || 0) * 2 + Math.abs(player.diff || 0) / 450;
    pressureManagers.set(
      player.owner,
      (pressureManagers.get(player.owner) || 0) + pressure
    );
  });
  (reportData.managerRosterIntelligence || []).forEach(row => {
    const healthScore = getDashboardNumber(row, ["rosterHealthScore"]);
    if (healthScore !== null && healthScore < 50) {
      pressureManagers.set(row.manager, (pressureManagers.get(row.manager) || 0) + 2);
    }
  });
  return {
    count: pressureManagers.size,
    manager:
      Array.from(pressureManagers.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      null,
    score: teamCount ? clampDashboardScore((pressureManagers.size / teamCount) * 100) : null,
  };
}

function getDashboardBestBuyWindow(reportData: ReportData) {
  const faller =
    [...(reportData.weeklyFallers || [])]
      .filter(player => (player.val_now || 0) > 0)
      .sort(
        (a, b) =>
          Math.abs(b.diff || 0) - Math.abs(a.diff || 0) ||
          (a.pct_change || 0) - (b.pct_change || 0)
      )[0] || null;
  if (faller) {
    return {
      value: faller.name,
      subLabel: `${faller.owner || "Market"} ${formatDashboardSignedPercentLabel(faller.pct_change)}`,
      helper: "Target before they recover.",
      tone: "danger" as DashboardMetricTone,
    };
  }

  const drop =
    [...(reportData.trendingDrops || [])].sort(
      (a, b) => (b.count || 0) - (a.count || 0)
    )[0] || null;
  return {
    value: drop?.name || "No clean dip",
    subLabel: drop ? `${formatDashboardWholeNumber(drop.count)} drops` : "Not enough movement",
    helper: drop ? "Drop heat creates leverage." : "No obvious buy window yet.",
    tone: drop ? ("warn" as DashboardMetricTone) : ("neutral" as DashboardMetricTone),
  };
}

function getDashboardTopDog(reportData: ReportData) {
  const ranked =
    [...(reportData.powerRankings || [])].sort((a, b) => a.rank - b.rank)[0] ||
    null;
  if (ranked) {
    return {
      manager: ranked.manager,
      subLabel: `${Math.round(ranked.score)} power score`,
      badges: [
        { label: `#${ranked.rank}`, tone: "good" as DashboardMetricTone },
        { label: ranked.tier, tone: "info" as DashboardMetricTone },
      ],
    };
  }

  const overview =
    [...(reportData.leagueOverview || [])].sort(
      (a, b) => a.rank_value - b.rank_value
    )[0] || null;
  return overview
    ? {
        manager: overview.manager,
        subLabel: formatDashboardCompactNumber(overview.total_val),
        badges: [
          { label: `#${overview.rank_value}`, tone: "good" as DashboardMetricTone },
        ],
      }
    : null;
}

function getDashboardFraudWatch(reportData: ReportData) {
  const intelByManager = new Map(
    (reportData.managerRosterIntelligence || []).map(row => [row.manager, row])
  );
  const candidates = (reportData.leagueOverview || [])
    .map(row => {
      const intel = intelByManager.get(row.manager);
      const health = getDashboardNumber(intel, ["rosterHealthScore"]);
      const weakness =
        (health !== null ? Math.max(0, 70 - health) : 0) +
        (intel?.weakestStarter ? 8 : 0) +
        (isDashboardMeaningfulHole(intel?.holes?.summary) ? 10 : 0) +
        (intel?.starterAvailability?.riskLevel === "high" ? 8 : 0);
      const rankPressure = Math.max(0, 8 - (row.rank_value || 99));
      return {
        manager: row.manager,
        score: weakness + rankPressure * 2,
        subLabel:
          health !== null
            ? `${Math.round(health)} health, rank #${row.rank_value}`
            : `Rank #${row.rank_value}`,
      };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function getDashboardLoadedCore(reportData: ReportData) {
  const powerRow =
    [...(reportData.powerRankings || [])]
      .sort((a, b) => b.starterStrength - a.starterStrength || a.rank - b.rank)[0] ||
    null;
  if (powerRow) {
    return {
      manager: powerRow.manager,
      subLabel: powerRow.starterStrength >= 80 ? "Elite starters" : "Best starters",
      score: powerRow.starterStrength,
    };
  }

  const intelRow =
    [...(reportData.managerRosterIntelligence || [])]
      .sort(
        (a, b) =>
          (getDashboardNumber(b, ["starterSeasonValue", "starterValue"]) || 0) -
          (getDashboardNumber(a, ["starterSeasonValue", "starterValue"]) || 0)
      )[0] || null;
  return intelRow
    ? {
        manager: intelRow.manager,
        subLabel: "Best starters",
        score: null,
      }
    : null;
}

function getDashboardPaperTiger(reportData: ReportData) {
  const depthRanks = [...(reportData.managerRosterIntelligence || [])]
    .map(row => ({
      manager: row.manager,
      benchValue: getDashboardNumber(row, ["benchValue"]) || 0,
    }))
    .sort((a, b) => b.benchValue - a.benchValue)
    .map((row, index) => ({ ...row, depthRank: index + 1 }));
  const depthByManager = new Map(depthRanks.map(row => [row.manager, row]));
  const candidates = (reportData.powerRankings || [])
    .map(row => {
      const depth = depthByManager.get(row.manager);
      if (!depth) return null;
      const mismatch = depth.depthRank - row.rank;
      return {
        manager: row.manager,
        rank: row.rank,
        depthRank: depth.depthRank,
        mismatch,
        score: mismatch * 100 + Math.max(0, 100 - row.starterStrength),
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> =>
        row !== null && row.mismatch > 0
    )
    .sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function getDashboardDepthCheck(reportData: ReportData) {
  const intelRow =
    [...(reportData.managerRosterIntelligence || [])]
      .map(row => ({
        manager: row.manager,
        benchValue: getDashboardNumber(row, ["benchValue"]) || 0,
      }))
      .filter(row => row.benchValue > 0)
      .sort((a, b) => b.benchValue - a.benchValue)[0] || null;

  return intelRow
    ? {
        manager: intelRow.manager,
        subLabel: "Best bench support",
        benchValue: intelRow.benchValue,
      }
    : null;
}

function getDashboardPowerGap(reportData: ReportData) {
  const powerRows = [...(reportData.powerRankings || [])].sort(
    (a, b) => a.rank - b.rank
  );
  if (powerRows.length >= 2) {
    const top = powerRows[0];
    const median = powerRows[Math.floor(powerRows.length / 2)];
    const last = powerRows[powerRows.length - 1];
    const gap = Math.round(top.score - median.score);
    return {
      value: `${gap > 0 ? "+" : ""}${gap}`,
      subLabel: `#1 to median`,
      score: clampDashboardScore(((top.score - last.score) / Math.max(1, top.score)) * 100),
    };
  }

  const spread = getDashboardMarketSpread(reportData);
  return {
    value: spread.gap !== null ? formatDashboardCompactNumber(spread.gap) : "-",
    subLabel: "Top-to-bottom value gap",
    score: spread.score,
  };
}

function getDashboardContenderWall(reportData: ReportData, teamCount: number) {
  const timelineRows = reportData.dynastyTimelines || [];
  const contenders = timelineRows.filter(row => row.contenderScore >= 70);
  if (timelineRows.length) {
    return {
      count: contenders.length,
      score: teamCount ? clampDashboardScore((contenders.length / teamCount) * 100) : null,
      top:
        [...timelineRows].sort(
          (a, b) => b.contenderScore - a.contenderScore
        )[0] || null,
    };
  }

  const powerRows = reportData.powerRankings || [];
  const powerContenders = powerRows.filter(
    row => row.score >= 75 || /contend|elite|favorite/i.test(row.tier)
  );
  return {
    count: powerContenders.length,
    score: teamCount ? clampDashboardScore((powerContenders.length / teamCount) * 100) : null,
    top:
      [...powerRows].sort((a, b) => b.score - a.score)[0] || null,
  };
}

function getDashboardBestTradeMark(reportData: ReportData) {
  const tradeCounts = new Map(
    (reportData.tradeTendencies || []).map(row => [row.manager, row.tradeCount])
  );
  const candidates = (reportData.managerRosterIntelligence || [])
    .map(row => {
      const health = getDashboardNumber(row, ["rosterHealthScore"]);
      const hasNeed = Boolean(row.tradePlan?.needPosition);
      const hasAsset =
        Boolean(row.tradeChip) ||
        Boolean(row.bestBenchStash) ||
        (row.benchValue || 0) > 0 ||
        (row.tradeableDepth || []).length > 0;
      const score =
        (hasNeed ? 10 : 0) +
        (row.weakestStarter ? 8 : 0) +
        (isDashboardMeaningfulHole(row.holes?.summary) ? 8 : 0) +
        (health !== null ? Math.max(0, 65 - health) / 4 : 0) +
        (hasAsset ? 5 : 0) +
        Math.min(4, tradeCounts.get(row.manager) || 0);
      return {
        manager: row.manager,
        score,
        need:
          row.tradePlan?.needPosition ||
          (isDashboardMeaningfulHole(row.holes?.summary)
            ? row.holes.summary.split(",")[0]?.trim()
            : null),
        hasAsset,
      };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function getDashboardTradeLedger(reportData: ReportData) {
  const rows = reportData.tradeTendencies || [];
  return {
    champ:
      [...rows].sort((a, b) => (b.profit || 0) - (a.profit || 0))[0] || null,
    loser:
      [...rows].sort((a, b) => (a.profit || 0) - (b.profit || 0))[0] || null,
  };
}

function getDashboardTradeShark(reportData: ReportData) {
  const activeRows = (reportData.tradeTendencies || []).filter(
    row => (row.tradeCount || 0) > 0
  );
  const qualifiedRows = activeRows.filter(row => (row.tradeCount || 0) >= 3);
  const pool = qualifiedRows.length ? qualifiedRows : activeRows;
  const row =
    [...pool].sort(
      (a, b) =>
        (b.winPct || 0) - (a.winPct || 0) ||
        (b.wins || 0) - (a.wins || 0) ||
        (b.profit || 0) - (a.profit || 0) ||
        (b.tradeCount || 0) - (a.tradeCount || 0)
    )[0] || null;

  if (!row) {
    return {
      manager: null,
      value: "No trades yet",
      subLabel: "0 deals logged",
      helper: "Are you all allergic to trading?",
      tone: "neutral" as DashboardMetricTone,
    };
  }

  const losses = Math.max(0, (row.tradeCount || 0) - (row.wins || 0));
  const qualified = (row.tradeCount || 0) >= 3;
  return {
    manager: row.manager,
    value: row.manager,
    subLabel: qualified
      ? `${row.winPct}% win rate`
      : `${row.wins || 0}-${losses} record`,
    helper: qualified
      ? "Wins deals, not arguments."
      : "Leader until the sample grows.",
    tone: qualified ? ("good" as DashboardMetricTone) : ("warn" as DashboardMetricTone),
  };
}

function getDashboardNeedHeat(reportData: ReportData): DashboardMetricBar[] {
  const positions = ["QB", "RB", "WR", "TE"] as const;
  const counts = new Map<(typeof positions)[number], number>(
    positions.map(position => [position, 0])
  );
  (reportData.managerRosterIntelligence || []).forEach(row => {
    if (row.tradePlan?.needPosition) {
      counts.set(row.tradePlan.needPosition, (counts.get(row.tradePlan.needPosition) || 0) + 2);
    }
    const summary = row.holes?.summary || "";
    positions.forEach(position => {
      const grade = row.positionGrades?.[position];
      if (
        new RegExp(`\\b${position}\\b`, "i").test(summary) ||
        (grade && /thin|weak|bad|poor|f|d/i.test(`${grade.grade} ${grade.note}`))
      ) {
        counts.set(position, (counts.get(position) || 0) + 1);
      }
    });
  });

  return positions
    .map(position => ({
      label: position,
      value: counts.get(position) || 0,
      displayValue:
        (counts.get(position) || 0) >= 5
          ? "High"
          : (counts.get(position) || 0) >= 2
            ? "Med"
            : "Low",
      tone:
        (counts.get(position) || 0) >= 5
          ? ("danger" as DashboardMetricTone)
          : (counts.get(position) || 0) >= 2
            ? ("warn" as DashboardMetricTone)
            : ("info" as DashboardMetricTone),
    }))
    .sort((a, b) => b.value - a.value);
}

function getDashboardPickHoarder(reportData: ReportData) {
  const portfolio =
    [...(reportData.pickPortfolios || [])].sort((a, b) => {
      const pickDiff =
        (b.futurePicks?.length || 0) - (a.futurePicks?.length || 0);
      return pickDiff || (b.totalValue || 0) - (a.totalValue || 0);
    })[0] || null;
  if (portfolio) {
    const pickCount =
      portfolio.futurePicks?.length ||
      (portfolio.count2026 || 0) + (portfolio.count2027 || 0) + (portfolio.count2028 || 0);
    return {
      manager: portfolio.manager,
      value: `${pickCount} picks`,
      subLabel: formatDashboardCompactNumber(portfolio.totalValue),
      badges: [
        { label: `${portfolio.ownPicks} own`, tone: "info" as DashboardMetricTone },
        { label: `${portfolio.acquiredPicks} raided`, tone: "warn" as DashboardMetricTone },
      ],
    };
  }

  const draftStat =
    [...(reportData.draftStats || [])].sort(
      (a, b) => (b.totalPicks || 0) - (a.totalPicks || 0)
    )[0] || null;
  return draftStat
    ? {
        manager: draftStat.manager,
        value: `${draftStat.totalPicks} picks`,
        subLabel: "Historical draft volume",
        badges: [{ label: "Past drafts", tone: "info" as DashboardMetricTone }],
      }
    : null;
}

function getDashboardFutureGm(reportData: ReportData, leagueValueMode: LeagueValueMode) {
  const best = getBestDraftSignalManager(reportData, leagueValueMode);
  if (!best) return null;
  const decided = (best.hits || 0) + (best.misses || 0);
  const hitRate = decided ? Math.round(((best.hits || 0) / decided) * 100) : null;
  const isRedraft = leagueValueMode === "redraft";
  return {
    manager: best.manager,
    value: formatDashboardSignedNumber(best.avgKtcGain),
    subLabel: isRedraft
      ? "Avg value gained per pick"
      : "Avg rookie value gained per pick",
    badges: [
      { label: `${best.totalPicks} picks`, tone: "info" as DashboardMetricTone },
      {
        label: hitRate === null ? "Hit rate pending" : `${hitRate}% hits`,
        tone:
          hitRate === null
            ? ("neutral" as DashboardMetricTone)
            : hitRate >= 50
              ? ("good" as DashboardMetricTone)
              : ("warn" as DashboardMetricTone),
      },
    ],
  };
}

function getDashboardAdpReach(reportData: ReportData, leagueValueMode: LeagueValueMode) {
  const reachManager = getWorstDraftAdpValueManager(reportData, leagueValueMode);

  return reachManager
    ? {
        manager: reachManager.manager,
        value: `${Math.round(reachManager.totalAdpReach)} ADP`,
        subLabel: "Total rookie ADP overpay",
        badges: [
          {
            label: `${reachManager.adpReachPickCount} reaches`,
            tone: "danger" as DashboardMetricTone,
          },
          {
            label: `${reachManager.totalPicks} picks`,
            tone: "info" as DashboardMetricTone,
          },
        ],
      }
    : null;
}

function getDashboardAdpThief(reportData: ReportData, leagueValueMode: LeagueValueMode) {
  const adpManager = getBestDraftAdpValueManager(reportData, leagueValueMode);

  return adpManager
    ? {
        manager: adpManager.manager,
        value: `+${Math.round(adpManager.totalAdpValue)} ADP`,
        subLabel: "Total rookie ADP value banked",
        badges: [
          {
            label: `${adpManager.adpValuePickCount} steals`,
            tone: "good" as DashboardMetricTone,
          },
          {
            label: `${adpManager.totalPicks} picks`,
            tone: "info" as DashboardMetricTone,
          },
        ],
      }
    : null;
}

function getReportDashboardHeroConfig({
  activeTab,
  leagueValueMode,
  reportData,
}: {
  activeTab: ReportDashboardTab;
  leagueValueMode: LeagueValueMode;
  reportData: ReportData;
}): {
  pillLabel: string;
  pills: string[];
  metrics: DashboardHeroMetric[];
} {
  const teamCount = getDashboardTeamCount(reportData);
  const weeklyRisers = [...(reportData.weeklyRisers || [])].sort(
    (a, b) => (b.pct_change || 0) - (a.pct_change || 0)
  );
  const weeklyFallers = [...(reportData.weeklyFallers || [])].sort(
    (a, b) => (a.pct_change || 0) - (b.pct_change || 0)
  );
  const draftTotals = getDashboardLeagueDraftStats(reportData);
  const aiScore = reportData.leagueDiagnostics?.aiConfidence?.score ?? null;
  const getMetricAvatarUrl = (manager?: string | null) =>
    manager
      ? getDashboardManagerAvatar(manager, reportData.managerAvatars)
      : null;

  if (activeTab === "momentum") {
    const movement = getDashboardManagerWeeklyMovement(reportData);
    const trendStack = getDashboardTrendStack(reportData);

    return {
      pillLabel: "Momentum signals",
      pills: ["Market movement", "Waiver heat", "Buy windows", "Sell pressure"],
      metrics: [
        {
          key: "heat-check",
          kind: "delta",
          label: "Heat Check",
          value: movement.heat?.manager || "No heater",
          subLabel: movement.heat
            ? `${formatDashboardSignedNumber(movement.heat.gain)} in 7 days`
            : "No roster gained value",
          targetManager: movement.heat?.manager,
          avatarUrl: getMetricAvatarUrl(movement.heat?.manager),
          tone: movement.heat ? "good" : "neutral",
          deltaDirection: movement.heat ? "up" : "flat",
          helper: movement.heat?.topGainPlayer
            ? renderDashboardHelperStack(
                movement.heat.topGainPlayer,
                "Sparked the surge."
              )
            : "Roster gain leader is not available yet.",
        },
        {
          key: "cold-streak",
          kind: "delta",
          label: "Cold Streak",
          value: movement.tilt?.manager || "No crash",
          subLabel: movement.tilt
            ? `${formatDashboardSignedNumber(movement.tilt.loss)} in 7 days`
            : "No roster lost value",
          targetManager: movement.tilt?.manager,
          avatarUrl: getMetricAvatarUrl(movement.tilt?.manager),
          tone: movement.tilt ? "danger" : "neutral",
          deltaDirection: movement.tilt ? "down" : "flat",
          helper: movement.tilt?.topLossPlayer
            ? renderDashboardHelperStack(
                movement.tilt.topLossPlayer,
                "Triggered the slide."
              )
            : "No major weekly damage logged.",
        },
        {
          key: "trend-stack",
          kind: "target",
          label: "Trend Stack",
          value: trendStack?.manager || "No trend stack",
          subLabel: trendStack
            ? `${formatPreviewCount(trendStack.addCount) || 0} adds`
            : "No add movement logged",
          targetManager: trendStack?.manager,
          avatarUrl: getMetricAvatarUrl(trendStack?.manager),
          tone: trendStack ? "warn" : "neutral",
          helper: trendStack?.topAddPlayer
            ? renderDashboardHelperStack(
                trendStack.topAddPlayer,
                `${formatPreviewCount(trendStack.topAddCount) || 0} adds`
              )
            : "No add leader logged.",
        },
      ],
    };
  }

  if (activeTab === "rankings") {
    const loadedCore = getDashboardLoadedCore(reportData);
    const paperTiger = getDashboardPaperTiger(reportData);
    const depthCheck = getDashboardDepthCheck(reportData);
    return {
      pillLabel: "Ranking signals",
      pills: ["Format matched", "Rostered values", "Prospect board", "Source blend"],
      metrics: [
        {
          key: "loaded-core",
          kind: "target",
          label: "Loaded Core",
          value: loadedCore?.manager || "No core found",
          subLabel: loadedCore?.subLabel || "Starter strength hidden",
          targetManager: loadedCore?.manager,
          avatarUrl: getMetricAvatarUrl(loadedCore?.manager),
          tone: loadedCore ? "good" : "neutral",
          helper: "The lineup has teeth.",
        },
        {
          key: "paper-tiger",
          kind: "target",
          label: "Paper Tiger",
          value: paperTiger?.manager || "No paper tiger",
          subLabel: paperTiger
            ? `#${paperTiger.rank} rank, #${paperTiger.depthRank} depth`
            : "Rank/depth mismatch hidden",
          targetManager: paperTiger?.manager,
          avatarUrl: getMetricAvatarUrl(paperTiger?.manager),
          tone: paperTiger ? "danger" : "neutral",
          helper: "Looks better than it is.",
        },
        {
          key: "depth-check",
          kind: "target",
          label: "Depth Check",
          value: depthCheck?.manager || "No depth edge",
          subLabel: depthCheck?.subLabel || "Bench support hidden",
          targetManager: depthCheck?.manager,
          avatarUrl: getMetricAvatarUrl(depthCheck?.manager),
          tone: depthCheck ? "good" : "neutral",
          helper: "Built to survive Sundays.",
        },
      ],
    };
  }

  if (activeTab === "trades") {
    const tradeLedger = getDashboardTradeLedger(reportData);
    const tradeShark = getDashboardTradeShark(reportData);
    const champProfitScore = tradeLedger.champ
      ? clampDashboardScore(Math.min(100, Math.abs(tradeLedger.champ.profit || 0) / 50))
      : null;
    const loserProfitScore = tradeLedger.loser
      ? clampDashboardScore(Math.min(100, Math.abs(tradeLedger.loser.profit || 0) / 50))
      : null;
    return {
      pillLabel: "Trade signals",
      pills: ["Roster scanner", "Value gaps", "Profit leaders", "Market behavior"],
      metrics: [
        {
          key: "trade-reaper",
          kind: "delta",
          label: "Trade Reaper",
          value: tradeLedger.champ?.manager || "No winner yet",
          subLabel: tradeLedger.champ
            ? `${formatDashboardSignedNumber(tradeLedger.champ.profit)} all-time`
            : "No trade profit data",
          score: champProfitScore,
          targetManager: tradeLedger.champ?.manager,
          avatarUrl: getMetricAvatarUrl(tradeLedger.champ?.manager),
          tone: tradeLedger.champ ? "good" : "neutral",
          deltaDirection: tradeLedger.champ ? "up" : "flat",
          helper: "Always leaves richer.",
        },
        {
          key: "league-donor",
          kind: "delta",
          label: "League Donor",
          value: tradeLedger.loser?.manager || "No victim yet",
          subLabel: tradeLedger.loser
            ? `${formatDashboardSignedNumber(tradeLedger.loser.profit)} all-time`
            : "No trade loss data",
          score: loserProfitScore,
          targetManager: tradeLedger.loser?.manager,
          avatarUrl: getMetricAvatarUrl(tradeLedger.loser?.manager),
          tone: tradeLedger.loser ? "danger" : "neutral",
          deltaDirection: tradeLedger.loser ? "down" : "flat",
          helper: "Charity work, but worse.",
        },
        {
          key: "deal-demon",
          kind: "target",
          label: "Deal Demon",
          value: tradeShark.value,
          subLabel: tradeShark.subLabel,
          targetManager: tradeShark.manager,
          avatarUrl: getMetricAvatarUrl(tradeShark.manager),
          tone: tradeShark.tone,
          helper: tradeShark.helper,
        },
      ],
    };
  }

  if (activeTab === "draft") {
    const futureGm = getDashboardFutureGm(reportData, leagueValueMode);
    const adpReach = getDashboardAdpReach(reportData, leagueValueMode);
    const adpThief = getDashboardAdpThief(reportData, leagueValueMode);
    return {
      pillLabel: "Draft signals",
      pills: ["Capital efficiency", "Hit rate", "Passed value", "Rookie runway"],
      metrics: [
        {
          key: "future-gm",
          kind: "badges",
          label: "Future GM",
          value: futureGm?.manager || "No GM yet",
          subLabel: futureGm?.subLabel || "No efficiency data",
          badges: futureGm?.badges || [{ label: "Pending", tone: "neutral" }],
          targetManager: futureGm?.manager,
          avatarUrl: getMetricAvatarUrl(futureGm?.manager),
          tone: futureGm ? "good" : "neutral",
          helper: futureGm
            ? `${futureGm.value} average pick value.`
            : "Best pick efficiency is not available.",
        },
        {
          key: "adp-reach",
          kind: "badges",
          label: "ADP Reach",
          value: adpReach?.manager || "No reach logged",
          subLabel: adpReach?.subLabel || "No ADP overpay data",
          badges: adpReach?.badges || [{ label: "Pending", tone: "neutral" }],
          targetManager: adpReach?.manager,
          avatarUrl: getMetricAvatarUrl(adpReach?.manager),
          tone: adpReach ? "danger" : "neutral",
          helper: adpReach
            ? `${adpReach.manager} reached ${adpReach.value} ahead of rookie ADP.`
            : "Worst total ADP reach is not available.",
        },
        {
          key: "adp-thief",
          kind: "badges",
          label: "ADP Thief",
          value: adpThief?.manager || "No ADP theft",
          subLabel: adpThief?.subLabel || "No ADP value data",
          badges: adpThief?.badges || [{ label: "Pending", tone: "neutral" }],
          targetManager: adpThief?.manager,
          avatarUrl: getMetricAvatarUrl(adpThief?.manager),
          tone: adpThief ? "good" : "neutral",
          helper: adpThief
            ? `${adpThief.manager} banked ${adpThief.value} by waiting past market cost.`
            : "Best total ADP value is not available.",
        },
      ],
    };
  }

  if (activeTab === "autopilot") {
    return {
      pillLabel: "AI signals",
      pills: ["Confidence", "Roster reads", "Source checks", "Action plans"],
      metrics: [
        {
          key: "ai-confidence",
          kind: "ring",
          label: "AI Score",
          value: aiScore ?? "-",
          subLabel: reportData.leagueDiagnostics?.aiConfidence?.label || "League read",
          score: aiScore,
          tone: aiScore === null ? "neutral" : aiScore >= 70 ? "good" : "warn",
        },
        {
          key: "manager-reads",
          label: "Manager Reads",
          value: reportData.managerRosterIntelligence?.length || 0,
          subLabel: "Owner profiles",
          tone: reportData.managerRosterIntelligence?.length ? "info" : "warn",
        },
        {
          key: "trade-plans",
          label: "Trade Plans",
          value: reportData.tradeProposalSignals?.length || 0,
          subLabel: "Signal queue",
          tone: reportData.tradeProposalSignals?.length ? "good" : "neutral",
        },
        {
          key: "waiver-plans",
          label: "Waiver Plans",
          value: reportData.waiverIntelligence?.availableTrendingAdds?.length || 0,
          subLabel: "Available adds",
          tone: reportData.waiverIntelligence?.availableTrendingAdds?.length
            ? "good"
            : "neutral",
        },
        {
          key: "coverage",
          kind: "meter",
          label: "Coverage",
          value: `${teamCount || "-"} teams`,
          subLabel: "League context",
          score: teamCount ? 100 : null,
          tone: teamCount ? "good" : "warn",
        },
      ],
    };
  }

  const topHeavy = getDashboardTopHeavy(reportData);
  const thinIce = getDashboardThinIce(reportData);
  const benchRot = getDashboardBenchRot(reportData);

  return {
    pillLabel: "Overview signals",
    pills: ["League health", "Weak spots", "Value spread"],
    metrics: [
      {
        key: "top-heavy",
        kind: "target",
        label: "Top Heavy",
        value: topHeavy?.manager || "No imbalance",
        subLabel: topHeavy
          ? `Starters carry ${topHeavy.starterValuePct}%`
          : "Starter/bench gap hidden",
        targetManager: topHeavy?.manager,
        avatarUrl: getMetricAvatarUrl(topHeavy?.manager),
        tone: topHeavy ? "warn" : "neutral",
        helper: "Bench gets ugly fast.",
      },
      {
        key: "thin-ice",
        kind: "target",
        label: "Thin Ice",
        value: thinIce?.manager || "No cracks found",
        subLabel:
          thinIce?.coverage ||
          thinIce?.hole ||
          (thinIce ? `${thinIce.riskLevel} availability risk` : "Depth risk hidden"),
        targetManager: thinIce?.manager,
        avatarUrl: getMetricAvatarUrl(thinIce?.manager),
        tone: thinIce ? "danger" : "neutral",
        helper: "No safety net.",
      },
      {
        key: "bench-rot",
        kind: "target",
        label: "Bench Rot",
        value: benchRot?.manager || "No rot found",
        subLabel: benchRot
          ? `${benchRot.count} low value spots`
          : "No obvious cut pile",
        targetManager: benchRot?.manager,
        avatarUrl: getMetricAvatarUrl(benchRot?.manager),
        tone: benchRot ? "danger" : "neutral",
        helper: "Dead weight on the bench.",
      },
    ],
  };
}

function ReportOverviewHero({
  leagueName,
  activeTab,
  leagueValueMode,
  reportData,
}: {
  leagueName: string;
  activeTab: ReportDashboardTab;
  leagueValueMode: LeagueValueMode;
  reportData: ReportData;
}) {
  const heroCopy = getReportDashboardHeroCopy(activeTab);
  const heroConfig = getReportDashboardHeroConfig({
    activeTab,
    leagueValueMode,
    reportData,
  });
  const normalizedHeroTab = normalizeReportTab(activeTab) || "overview";

  return (
    <section
      className="report-overview-hero"
      data-dashboard-tab={normalizedHeroTab}
    >
      <div className="report-overview-hero-copy">
        <h1>
          {heroCopy.headline.split("\n").map(line => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p className="report-overview-hero-subline">{heroCopy.subline}</p>
        <p>{heroCopy.body}</p>
      </div>
      <div
        className={`report-overview-metrics report-overview-metrics-${heroConfig.metrics.length}`}
        data-dashboard-tab={normalizedHeroTab}
        aria-label={`${leagueName} ${heroConfig.pillLabel.toLowerCase()}`}
      >
        {heroConfig.metrics.map(metric => (
          <DashboardVisualMetric key={metric.key} metric={metric} />
        ))}
      </div>
    </section>
  );
}

function getReportDashboardSpotlightConfig({
  activeTab,
  manager,
  reportData,
  leagueValueMode,
  starterCount,
  seasonValue,
  healthScore,
  healthLabel,
  valueRank,
  valueRankTier,
  intelSummary,
}: {
  activeTab: ReportDashboardTab;
  manager: string;
  reportData: ReportData;
  leagueValueMode: LeagueValueMode;
  starterCount: number | null;
  seasonValue: number | null;
  healthScore: number | null;
  healthLabel: string;
  valueRank: number | null;
  valueRankTier: string;
  intelSummary?: string | null;
}): DashboardSpotlightConfig {
  const managerRisers = [...(reportData.weeklyRisers || [])]
    .filter(player => player.owner === manager)
    .sort((a, b) => (b.pct_change || 0) - (a.pct_change || 0));
  const managerFallers = [...(reportData.weeklyFallers || [])]
    .filter(player => player.owner === manager)
    .sort((a, b) => (a.pct_change || 0) - (b.pct_change || 0));
  const topAdd = [...(reportData.trendingAdds || [])].sort(
    (a, b) => (b.count || 0) - (a.count || 0)
  )[0];
  const topDrop = [...(reportData.trendingDrops || [])].sort(
    (a, b) => (b.count || 0) - (a.count || 0)
  )[0];
  const rankingRows = getDashboardRankingRows(reportData, leagueValueMode);
  const topRosterPlayer = getDashboardTopRankingPlayer(
    reportData,
    leagueValueMode,
    manager
  );
  const rosteredRows = rankingRows.filter(row => row.owner === manager);
  const managerGrowth = reportData.managerRosterValueGrowth?.find(
    row => row.manager === manager
  );
  const leagueOverview = reportData.leagueOverview?.find(
    row => row.manager === manager
  );
  const tradeTendency = reportData.tradeTendencies?.find(
    row => row.manager === manager
  );
  const managerTrades = (reportData.tradeHistory || []).filter(
    trade => trade.team_a === manager || trade.team_b === manager
  );
  const managerDraftStats = reportData.draftStats?.find(
    row => row.manager === manager
  );
  const managerDraftPicks = (reportData.draftPicks || []).filter(
    pick => pick.manager === manager
  );
  const aiConfidence =
    reportData.leagueDiagnostics?.aiConfidence?.managerConfidence?.find(
      row => row.manager === manager
    ) || null;

  if (activeTab === "momentum") {
    const topRiser = managerRisers[0] || reportData.weeklyRisers?.[0] || null;
    const topFaller =
      managerFallers[0] || reportData.weeklyFallers?.[0] || null;
    const volatility = managerRisers.length + managerFallers.length;

    return {
      eyebrow: "Weekly Action Board",
      metrics: [
        {
          key: "value-swing",
          label: "Value Swing",
          value: getDashboardTrendLabel(topRiser),
          subLabel: topRiser?.owner === manager ? "Your climb" : "League climb",
          tone: "good",
        },
        {
          key: "heat",
          kind: "meter",
          label: "Roster Heat",
          value: `${volatility} moves`,
          subLabel: "Risers/fallers",
          score: getDashboardActivityScore(volatility, 6),
          tone: volatility >= 4 ? "warn" : "info",
        },
        {
          key: "fall-risk",
          label: "Fall Risk",
          value: getDashboardTrendLabel(topFaller),
          subLabel: topFaller?.owner === manager ? "Your dip" : "League dip",
          tone: "danger",
        },
      ],
      blocks: [
        {
          key: "riser",
          label: "Riser to inspect",
          value: getDashboardPlayerName(topRiser),
          subLabel: formatDashboardSignedPercentLabel(topRiser?.pct_change),
          tone: "good",
        },
        {
          key: "faller",
          label: "Pressure point",
          value: getDashboardPlayerName(topFaller),
          subLabel: formatDashboardSignedPercentLabel(topFaller?.pct_change),
          tone: "danger",
        },
        {
          key: "add",
          label: "Waiver heat",
          value: topAdd?.name || "-",
          subLabel: topAdd
            ? `${formatDashboardWholeNumber(topAdd.count)} adds`
            : "No add heat",
          tone: "good",
        },
        {
          key: "drop",
          label: "Drop heat",
          value: topDrop?.name || "-",
          subLabel: topDrop
            ? `${formatDashboardWholeNumber(topDrop.count)} drops`
            : "No drop heat",
          tone: "danger",
        },
      ],
      chips: [
        `${managerRisers.length} risers`,
        `${managerFallers.length} fallers`,
        topAdd ? `${topAdd.name} add heat` : "No add heat",
      ],
      readTitle: "Momentum Read",
      read:
        topRiser?.owner === manager
          ? `${topRiser.name} is the live leverage point. Decide whether to cash out into steadier value or let the weekly spike become lineup edge.`
          : "This roster is not driving the loudest market moves right now. Use the weekly board for opportunistic buys instead of chasing the league's biggest spikes.",
    };
  }

  if (activeTab === "rankings") {
    const rankingRowCount = getDashboardRankingRowCount(
      reportData,
      leagueValueMode
    );
    const hasRankingRows = rankingRows.length > 0;
    const rosterCoverage = rankingRows.length
      ? (rosteredRows.length / rankingRows.length) * 100
      : null;
    const profileLabel = getDashboardRankingProfileLabel(
      reportData,
      leagueValueMode
    );
    const boardLoadScore = hasRankingRows
      ? rosterCoverage
      : rankingRowCount
        ? 55
        : null;
    const sourceBlendLabel = reportData.rankings?.sourceWeightProfiles
      ? "Weighted"
      : "Default";

    return {
      eyebrow: "Market Board",
      metrics: [
        {
          key: "rank",
          label: "Value Rank",
          value: getDashboardRankLabel(leagueOverview, ["rank_value"]),
          subLabel: "Season value",
          tone: "info",
        },
        {
          key: "coverage",
          kind: "meter",
          label: "Board Load",
          value: hasRankingRows ? "Live" : rankingRowCount ? "Metadata" : "-",
          subLabel: hasRankingRows
            ? `${formatDashboardWholeNumber(rosteredRows.length)} rostered`
            : rankingRowCount
              ? `${formatDashboardWholeNumber(rankingRowCount)} indexed`
              : "No board data",
          score: boardLoadScore,
          tone: hasRankingRows
            ? rosterCoverage && rosterCoverage >= 5
              ? "good"
              : "warn"
            : rankingRowCount
              ? "info"
              : "warn",
        },
        {
          key: "profile",
          label: "Value Lens",
          value: "Matched",
          subLabel: profileLabel,
          tone: "info",
        },
      ],
      blocks: [
        {
          key: "top-asset",
          label: topRosterPlayer ? "Top roster asset" : "Board size",
          value: topRosterPlayer?.name || formatDashboardWholeNumber(rankingRowCount),
          subLabel:
            topRosterPlayer?.positionRank ||
            topRosterPlayer?.pos ||
            "Indexed assets",
          tone: topRosterPlayer ? "good" : rankingRowCount ? "info" : "warn",
        },
        {
          key: "value-rank",
          label: "Roster value",
          value: getDashboardRankLabel(leagueOverview, ["rank_value"]),
          subLabel: formatDashboardCompactNumber(
            seasonValue ?? managerGrowth?.total_val
          ),
          tone: "info",
        },
        {
          key: "qb-room",
          label: topRosterPlayer ? "QB room" : "Value lens",
          value: topRosterPlayer
            ? getDashboardRankLabel(leagueOverview, ["rank_qb"])
            : "Matched",
          subLabel: topRosterPlayer ? "Full roster rank" : profileLabel,
          tone: "info",
        },
        {
          key: "rb-room",
          label: topRosterPlayer ? "RB room" : "Source blend",
          value: topRosterPlayer
            ? getDashboardRankLabel(leagueOverview, ["rank_rb"])
            : sourceBlendLabel,
          subLabel: topRosterPlayer ? "Full roster rank" : profileLabel,
          tone: "info",
        },
      ],
      chips: [
        `${formatDashboardWholeNumber(rankingRowCount)} ranked`,
        `${formatDashboardWholeNumber(rosteredRows.length)} rostered`,
        profileLabel,
      ],
      readTitle: "Ranking Read",
      read: topRosterPlayer
        ? `${topRosterPlayer.name} is the roster's highest visible asset in the active value lens. Use that tier as the anchor before packaging depth or dropping into the next value shelf.`
        : rankingRowCount
          ? `The ranking board is loaded as metadata for this view. Open the Rankings sections to hydrate player rows; the active lens is ${profileLabel}.`
          : "Open the rankings board to match this roster against the active value lens and identify the first real tier break.",
    };
  }

  if (activeTab === "trades") {
    const winPct = tradeTendency?.winPct ?? null;
    const avgGap = tradeTendency?.avgGap ?? null;
    const profit = tradeTendency?.profit ?? null;
    const partner = tradeTendency?.favoritePartner || "No repeat partner";

    return {
      eyebrow: "Trade War Room",
      metrics: [
        {
          key: "profit",
          label: "Trade Profit",
          value: formatDashboardSignedNumber(profit),
          subLabel: "All-time ledger",
          tone: getDashboardHeroToneForSignedValue(profit),
        },
        {
          key: "win-rate",
          kind: "ring",
          label: "Win Rate",
          value: formatDashboardPercentLabel(winPct),
          subLabel: "Outcomes",
          score: winPct,
          tone: winPct === null ? "neutral" : winPct >= 50 ? "good" : "danger",
        },
        {
          key: "volume",
          kind: "meter",
          label: "Volume",
          value: tradeTendency?.tradeCount ?? managerTrades.length,
          subLabel: "Completed deals",
          score: getDashboardActivityScore(
            tradeTendency?.tradeCount ?? managerTrades.length,
            10
          ),
          tone:
            (tradeTendency?.tradeCount ?? managerTrades.length) > 0
              ? "info"
              : "warn",
        },
      ],
      blocks: [
        {
          key: "partner",
          label: "Favorite partner",
          value: partner,
          subLabel: "Most common counterparty",
          tone: tradeTendency?.favoritePartner ? "info" : "neutral",
        },
        {
          key: "avg-gap",
          label: "Average gap",
          value: formatDashboardWholeNumber(avgGap),
          subLabel: "Trade tax profile",
          tone:
            avgGap === null
              ? "neutral"
              : Math.abs(avgGap) <= 250
                ? "good"
                : "warn",
        },
        {
          key: "picks",
          label: "Pick bias",
          value: tradeTendency?.overpaysForPicks ? "Pays up" : "Clean",
          subLabel: "Draft capital behavior",
          tone: tradeTendency?.overpaysForPicks ? "warn" : "good",
        },
        {
          key: "vets",
          label: "Veteran bias",
          value: tradeTendency?.overpaysForVeterans ? "Pays up" : "Clean",
          subLabel: "Producer market behavior",
          tone: tradeTendency?.overpaysForVeterans ? "warn" : "good",
        },
      ],
      chips: [
        `${tradeTendency?.tradeCount ?? managerTrades.length} trades`,
        `${formatDashboardPercentLabel(winPct)} win rate`,
        partner,
      ],
      readTitle: "Trade Read",
      read: tradeTendency
        ? `${manager}'s trade ledger shows ${formatDashboardSignedNumber(profit)} profit with a ${formatDashboardPercentLabel(winPct)} win rate. Their average gap and bias flags should set the opening offer, not roster value alone.`
        : "This manager does not have enough trade tendency data yet. Start with the roster scanner and value match finder before assuming a negotiation style.",
    };
  }

  if (activeTab === "draft") {
    const hitRate = getDashboardDraftHitRate(managerDraftStats);
    const avgChange = managerDraftStats?.avgKtcGain ?? null;

    return {
      eyebrow: "Draft Audit",
      metrics: [
        {
          key: "picks",
          label: "Picks",
          value: managerDraftStats?.totalPicks ?? managerDraftPicks.length,
          subLabel: "Audited",
          tone:
            managerDraftStats?.totalPicks || managerDraftPicks.length
              ? "info"
              : "neutral",
        },
        {
          key: "hit-rate",
          kind: "ring",
          label: "Hits",
          value: formatDashboardPercentLabel(hitRate),
          subLabel: "Hits vs misses",
          score: hitRate,
          tone: hitRate === null ? "neutral" : hitRate >= 50 ? "good" : "warn",
        },
        {
          key: "avg-change",
          label: "Avg Change",
          value: formatDashboardSignedNumber(avgChange),
          subLabel: "Value delta",
          tone: getDashboardHeroToneForSignedValue(avgChange),
        },
      ],
      blocks: [
        {
          key: "best",
          label: "Best pick",
          value: managerDraftStats?.bestPick?.playerName || "-",
          subLabel:
            managerDraftStats?.bestPick?.valueGain !== null &&
            managerDraftStats?.bestPick?.valueGain !== undefined
              ? formatDashboardSignedNumber(managerDraftStats.bestPick.valueGain)
              : "No best pick",
          tone: managerDraftStats?.bestPick ? "good" : "neutral",
        },
        {
          key: "worst",
          label: "Worst pick",
          value: managerDraftStats?.worstPick?.playerName || "-",
          subLabel:
            managerDraftStats?.worstPick?.valueGain !== null &&
            managerDraftStats?.worstPick?.valueGain !== undefined
              ? formatDashboardSignedNumber(managerDraftStats.worstPick.valueGain)
              : "No miss logged",
          tone: managerDraftStats?.worstPick ? "danger" : "neutral",
        },
        {
          key: "starters",
          label: "Drafted starters",
          value: managerDraftStats?.starters ?? 0,
          subLabel: "Lineup hits",
          tone: managerDraftStats?.starters ? "good" : "neutral",
        },
        {
          key: "misses",
          label: "Misses",
          value: managerDraftStats?.misses ?? 0,
          subLabel: "Audit flags",
          tone: managerDraftStats?.misses ? "warn" : "good",
        },
      ],
      chips: [
        `${managerDraftStats?.hits ?? 0} hits`,
        `${managerDraftStats?.misses ?? 0} misses`,
        `${managerDraftStats?.starters ?? 0} starters`,
      ],
      readTitle: "Draft Read",
      read: managerDraftStats?.bestPick
        ? `${managerDraftStats.bestPick.playerName} is the cleanest draft win, while ${managerDraftStats.worstPick?.playerName || "the miss bucket"} carries the biggest audit flag. That split is the fastest way to see whether this manager finds value or pays tuition.`
        : "Draft capital efficiency will sharpen once this manager has enough picks in the audit sample.",
    };
  }

  if (activeTab === "autopilot") {
    return {
      eyebrow: "AI Action Plan",
      metrics: [
        {
          key: "confidence",
          kind: "ring",
          label: "Confidence",
          value: aiConfidence?.score ?? "-",
          subLabel: aiConfidence?.label || "Manager read",
          score: aiConfidence?.score ?? null,
          tone:
            aiConfidence?.score === undefined
              ? "neutral"
              : aiConfidence.score >= 70
                ? "good"
                : "warn",
        },
        {
          key: "starters",
          label: "Starters",
          value: starterCount ?? "-",
          subLabel: "Projected",
          tone: "info",
        },
        {
          key: "health",
          kind: "ring",
          label: "Health",
          value: healthScore ?? "-",
          subLabel: healthLabel,
          score: healthScore,
          tone: healthScore === null ? "neutral" : healthScore >= 70 ? "good" : "warn",
        },
      ],
      blocks: [
        {
          key: "confidence-note",
          label: "Confidence note",
          value: aiConfidence?.label || "Building",
          subLabel: aiConfidence?.note || "Open Autopilot for trace details.",
          tone: aiConfidence?.score && aiConfidence.score >= 70 ? "good" : "warn",
        },
        {
          key: "trade-plan",
          label: "Trade signal",
          value: reportData.tradeProposalSignals?.length || 0,
          subLabel: "Open recommendations",
          tone: reportData.tradeProposalSignals?.length ? "good" : "neutral",
        },
        {
          key: "waiver-plan",
          label: "Waiver signal",
          value: reportData.waiverIntelligence?.availableTrendingAdds?.length || 0,
          subLabel: "Available add pool",
          tone: reportData.waiverIntelligence?.availableTrendingAdds?.length
            ? "good"
            : "neutral",
        },
        {
          key: "source-state",
          label: "Data state",
          value: reportData.leagueDiagnostics?.aiConfidence ? "Scored" : "Building",
          subLabel: "AI read inputs",
          tone: reportData.leagueDiagnostics?.aiConfidence ? "good" : "warn",
        },
      ],
      chips: [
        aiConfidence?.label || "AI building",
        `${starterCount ?? "-"} starters`,
        `Health ${healthScore ?? "-"}`,
      ],
      readTitle: "AI Read",
      read:
        aiConfidence?.note ||
        intelSummary ||
        "Autopilot is ready to turn this manager's roster context into ranked next actions.",
    };
  }

  return {
    eyebrow: "Projected Season Roster",
    metrics: [
      {
        key: "value-rank",
        label: "Value Rank",
        value: valueRank === null ? "#-" : `#${valueRank}`,
        subLabel: valueRankTier,
        tone: "info",
      },
      {
        key: "team-value",
        label: "Team Value",
        value: formatDashboardCompactNumber(seasonValue),
        subLabel: "Roster total",
        tone: "good",
      },
      {
        key: "health",
        kind: "ring",
        label: "Teams Health",
        value: healthScore ?? "-",
        subLabel: healthLabel,
        score: healthScore,
        tone:
          healthScore === null
            ? "neutral"
            : healthScore >= 70
              ? "good"
              : healthScore >= 55
                ? "warn"
                : "danger",
      },
    ],
    blocks: [],
    chips: [],
    readTitle: "Roster Outlook",
    read:
      intelSummary ||
      "This manager is ready for a deeper roster read once the overview sections are opened.",
  };
}

function ReportDashboardSpotlight({
  manager,
  activeTab,
  leagueValueMode,
  reportData,
  managerAvatars,
  variant = "sidebar",
}: {
  manager: string | null;
  activeTab: ReportDashboardTab;
  leagueValueMode: LeagueValueMode;
  reportData: ReportData;
  managerAvatars?: Record<string, string | null | undefined>;
  variant?: "sidebar" | "inline";
}) {
  const [inlineSpotlightOpen, setInlineSpotlightOpen] = useState(false);

  if (!manager) return null;

  const intel = reportData.managerRosterIntelligence?.find(
    row => row.manager === manager
  );
  const counts = reportData.managerPositionCounts?.find(
    row => row.manager === manager
  );
  const growth = reportData.managerRosterValueGrowth?.find(
    row => row.manager === manager
  );
  const leagueOverview = reportData.leagueOverview?.find(
    row => row.manager === manager
  );
  const power = reportData.powerRankings?.find(row => row.manager === manager);
  const valueRank = getDashboardNumber(leagueOverview, ["rank_value"]);
  const valueRankTier = getDashboardRankTier(
    valueRank,
    getDashboardTeamCount(reportData)
  );
  const starterCount = counts
    ? (counts.QB_starters || 0) +
      (counts.RB_starters || 0) +
      (counts.WR_starters || 0) +
      (counts.TE_starters || 0) +
      (counts.K_starters || 0) +
      (counts.DEF_starters || 0)
    : null;
  const healthScore = getDashboardNumber(intel, ["rosterHealthScore"]);
  const fallbackHealthScore = healthScore ?? power?.score ?? null;
  const healthLabel =
    fallbackHealthScore === null
      ? "Score"
      : fallbackHealthScore >= 80
        ? "Strong"
        : fallbackHealthScore >= 70
          ? "Good"
          : fallbackHealthScore >= 55
            ? "Watch"
            : "Risk";
  const projectedStarters =
    (counts?.starterPlayers?.length ? counts.starterPlayers : counts?.lineupPlayers) || [];
  const rosterValuePlayers =
    (counts?.lineupPlayers?.length ? counts.lineupPlayers : projectedStarters) || [];
  const seasonValue =
    getDashboardNumber(growth, ["total_val"]) ??
    getDashboardNumber(leagueOverview, ["total_val"]) ??
    getDashboardNumber(intel, ["starterSeasonValue", "starterValue"]) ??
    sumDashboardPlayerValues(rosterValuePlayers);
  const positionRankCards = DASHBOARD_LINEUP_POSITIONS.filter(position => {
    if (["QB", "RB", "WR", "TE"].includes(position)) return true;
    return reportData.managerPositionCounts?.some(
      row => getDashboardStarterCount(row, position) > 0
    );
  }).map(position => {
    const computedRank = getDashboardPositionRank(reportData, manager, position);
    const overviewRank =
      position === "K" || position === "DEF"
        ? null
        : getDashboardNumber(leagueOverview, [`rank_${position.toLowerCase()}`]);
    return {
      position,
      rank: computedRank ?? overviewRank,
    };
  });
  const starterRankGroups = getDashboardOverviewStarterRankGroups(
    reportData,
    manager,
    counts
  );
  const hasSpecialTeamRanks =
    positionRankCards.some(({ position }) => position === "K" || position === "DEF") ||
    starterRankGroups.some(group => group.position === "K" || group.position === "DEF");
  const rankGridClassName = hasSpecialTeamRanks
    ? "dashboard-rank-grid dashboard-rank-grid-special"
    : "dashboard-rank-grid";
  const swapSignals = [
    intel?.tradePlan?.summary,
    intel?.holes?.summary,
    (intel as { nextMove?: string } | undefined)?.nextMove,
  ].filter((signal): signal is string => Boolean(signal));
  const spotlightConfig = getReportDashboardSpotlightConfig({
    activeTab,
    manager,
    reportData,
    leagueValueMode,
    starterCount,
    seasonValue,
    healthScore: fallbackHealthScore,
    healthLabel,
    valueRank,
    valueRankTier,
    intelSummary:
      intel?.summary || (intel as { nextMove?: string } | undefined)?.nextMove,
  });
  const isOverviewSpotlight = activeTab === "overview";
  const spotlightHeader = (
    <div className="dashboard-spotlight-header">
      <span className="dashboard-spotlight-avatar">
        <DashboardManagerAvatar
          manager={manager}
          avatarUrl={getDashboardManagerAvatar(manager, managerAvatars)}
        />
      </span>
      <div>
        <span>{spotlightConfig.eyebrow}</span>
        <strong>{manager}</strong>
      </div>
    </div>
  );
  const spotlightBody = (
    <>
      <div className="dashboard-spotlight-metrics">
        {spotlightConfig.metrics.map(metric => (
          <DashboardVisualMetric key={metric.key} metric={metric} />
        ))}
      </div>
      {isOverviewSpotlight ? (
        <>
          <div className="dashboard-position-rank-block">
            <span>Full Roster Position Ranks</span>
            <div className={`dashboard-position-ranks ${rankGridClassName}`}>
              {positionRankCards.map(({ position, rank }) => (
                <span key={position} data-position={position}>
                  <em>{position}</em>
                  <strong>{formatDashboardRank(rank)}</strong>
                </span>
              ))}
            </div>
          </div>
          {starterRankGroups.length > 0 && (
            <div className="dashboard-starter-ranks">
              <span>Projected Starter Slot Ranks</span>
              <div className={rankGridClassName}>
                {starterRankGroups.map(group => (
                  <span key={group.key} data-position={group.position}>
                    <em>{group.label}</em>
                    <strong>{formatDashboardRank(group.rank)}</strong>
                    <b>{group.tier}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <DashboardSpotlightFocusGrid blocks={spotlightConfig.blocks} />
      )}
      {spotlightConfig.chips.length > 0 && (
        <div className="dashboard-spotlight-chip-row">
          {spotlightConfig.chips.map(chip => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      )}
      {isOverviewSpotlight && swapSignals.length > 0 && (
        <div className="dashboard-swap-signals">
          <span>Start/Sit Swap Signals</span>
          {swapSignals.slice(0, 2).map(signal => (
            <p key={signal}>{signal}</p>
          ))}
        </div>
      )}
      <div className="dashboard-spotlight-read">
        <span>{spotlightConfig.readTitle}</span>
        <p>{spotlightConfig.read}</p>
      </div>
    </>
  );
  const inlineSpotlightClassName = [
    "report-dashboard-spotlight-inline",
    inlineSpotlightOpen
      ? "report-dashboard-spotlight"
      : "dashboard-spotlight-inline-glass",
  ].filter(Boolean).join(" ");

  if (variant === "inline") {
    return (
      <details
        className={inlineSpotlightClassName}
        aria-label="Manager spotlight"
        onToggle={(event) => setInlineSpotlightOpen(event.currentTarget.open)}
      >
        <summary className="dashboard-spotlight-inline-summary">
          {spotlightHeader}
          <span className="dashboard-spotlight-inline-copy">
            <strong>{spotlightConfig.chips[0] || "Manager context"}</strong>
            <span>{spotlightConfig.readTitle}</span>
          </span>
          <ChevronDown className="dashboard-spotlight-inline-icon" aria-hidden="true" />
        </summary>
        <div className="dashboard-spotlight-inline-body">
          {spotlightBody}
        </div>
      </details>
    );
  }

  return (
    <aside
      className={`report-dashboard-spotlight report-dashboard-spotlight-${variant}`}
      aria-label="Manager spotlight"
    >
      {spotlightHeader}
      {spotlightBody}
    </aside>
  );
}

type AdminValueDiagnosticRow = {
  id: string;
  area: string;
  item: string;
  status: string;
  note: string;
  tone?: "good" | "warn" | "danger" | "info";
};

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SourceCoverageMatrixData = RouterOutputs["system"]["sourceCoverageMatrix"];
type SourceCoverageRow = SourceCoverageMatrixData["rows"][number];
type AICalibrationData = RouterOutputs["system"]["aiCalibration"];
type AICalibrationAdjustmentRow =
  AICalibrationData["adjustmentProfile"]["adjustments"][number];

type AdminBlendSummary = {
  id: string;
  title: string;
  profileLabel: string;
  note: string;
  sources: Array<{
    key: string;
    source: string;
    percent: number;
    note?: string;
  }>;
};

type OutlookPlayer = ReportData["projectedRisers"][number];

function getValueCoverageStatus(
  note: string
): Pick<AdminValueDiagnosticRow, "status" | "tone"> {
  if (/benchmark/i.test(note)) {
    return { status: "Benchmark stored", tone: "info" };
  }
  if (/exact custom|closest|bucket/i.test(note)) {
    return { status: "Bucketed", tone: "info" };
  }
  if (/support is wired|no .*present/i.test(note)) {
    return { status: "Awaiting data", tone: "warn" };
  }
  return { status: "Tracked", tone: "good" };
}

function isActionableDiagnosticTone(
  tone?: AdminValueDiagnosticRow["tone"]
): boolean {
  return tone === "warn" || tone === "danger";
}

function getValueCoverageItem(note: string, index: number): string {
  if (/Selected value profile/i.test(note)) return "Selected profile";
  if (/Daily snapshots/i.test(note)) return "Daily storage";
  if (/Flock Fantasy|Dynasty Nerds|Redraft/i.test(note))
    return "Source weighting";
  if (/TE premium|TEP/i.test(note)) return "TE premium bucket";
  if (/Standard|Half|PPR/i.test(note)) return "PPR bucket";
  if (/coverage/i.test(note)) return "Source coverage";
  if (/benchmark/i.test(note)) return "Benchmark source";
  return `Coverage note ${index + 1}`;
}

function getOutlookPlayerValueProfile(
  reportData: ReportData,
  player: OutlookPlayer
) {
  return (
    player.playerDetails?.valueProfile ||
    (player.player_id
      ? reportData.playerDetailsById?.[player.player_id]?.valueProfile
      : undefined)
  );
}

function addUniqueDiagnosticRow(
  rows: AdminValueDiagnosticRow[],
  seen: Set<string>,
  row: AdminValueDiagnosticRow
) {
  if (seen.has(row.id)) return;
  seen.add(row.id);
  rows.push(row);
}

function formatSignedDiagnosticDelta(value?: number | null): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 0) return "0";
  return `${numeric > 0 ? "+" : ""}${numeric}`;
}

function formatLeagueAiConfidenceTrend(reportData: ReportData): string | null {
  const trend = reportData.leagueDiagnostics?.aiConfidence?.history || [];
  if (trend.length < 2) return null;
  return trend
    .slice(-6)
    .map(point => `${point.snapshotKey}: ${point.score}%`)
    .join(" -> ");
}

function isPriorityAdminDiagnosticRow(row: AdminValueDiagnosticRow): boolean {
  if (row.tone === "danger") return true;
  if (row.tone !== "warn") return false;
  if (isHandledSourceTrustDiagnosticRow(row)) return false;
  return /player value|player values|ranking identities|player alias|redraft source|dynasty source|devy source|value blend|value input/i.test(
    row.area
  );
}

function isSourceTrustDiagnosticRow(row: AdminValueDiagnosticRow): boolean {
  return /(redraft|dynasty|devy) source/i.test(row.area);
}

function isSourceErrorOrStale(row: AdminValueDiagnosticRow): boolean {
  return /source error|source issue|stale data/i.test(row.status);
}

function isInformationalEmptySourceRow(
  row: AdminValueDiagnosticRow
): boolean {
  if (!isSourceTrustDiagnosticRow(row)) return false;
  if (!/no rows/i.test(row.status)) return false;
  if (isSourceErrorOrStale(row)) return false;

  return /Other available source weights normalize automatically|current status is empty|waiting for more .* consensus overlap/i.test(
    row.note
  );
}

function isHandledSourceTrustDiagnosticRow(
  row: AdminValueDiagnosticRow
): boolean {
  if (!isSourceTrustDiagnosticRow(row)) return false;
  if (isSourceErrorOrStale(row)) return false;
  if (isInformationalEmptySourceRow(row)) return true;

  return /source-excluded consensus|Trust (?:fell|rose|dropped|was unchanged)/i.test(
    row.note
  );
}

function compareAdminDiagnosticPriority(
  a: AdminValueDiagnosticRow,
  b: AdminValueDiagnosticRow
): number {
  const toneScore = (row: AdminValueDiagnosticRow) =>
    row.tone === "danger" ? 0 : row.tone === "warn" ? 1 : 2;
  return (
    toneScore(a) - toneScore(b) ||
    a.area.localeCompare(b.area) ||
    a.item.localeCompare(b.item)
  );
}

function buildAdminValueDiagnostics(
  reportData: ReportData,
  missingDateKeys: string[]
): AdminValueDiagnosticRow[] {
  const rows: AdminValueDiagnosticRow[] = [];
  const seen = new Set<string>();
  const isRedraftValueMode =
    normalizeLeagueValueMode(
      reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
    ) === "redraft";
  const currentSnapshotGaps = missingDateKeys
    .filter(dateKey => dateKey >= ADMIN_VALUE_DIAGNOSTIC_START_DATE)
    .sort();
  const outlookPlayers = [
    ...reportData.projectedRisers,
    ...reportData.projectedFallers,
  ];
  const leagueDiagnostics = reportData.leagueDiagnostics;

  if (leagueDiagnostics) {
    const leagueConfidence = leagueDiagnostics.aiConfidence;
    const leagueConfidenceDelta = formatSignedDiagnosticDelta(
      leagueConfidence?.scoreDelta
    );
    const leagueConfidenceTrend = formatLeagueAiConfidenceTrend(reportData);
    if (leagueConfidence) {
      const confidenceTone: AdminValueDiagnosticRow["tone"] =
        leagueConfidence.score < 52
          ? "warn"
          : leagueConfidence.score >= 72
            ? "good"
            : "info";
      addUniqueDiagnosticRow(rows, seen, {
        id: "league-ai-confidence",
        area: "AI confidence",
        item: `${leagueConfidence.score}% ${leagueConfidence.label}`,
        status:
          leagueConfidence.score < 52
            ? "Low confidence"
            : leagueConfidence.score >= 72
              ? "Strong"
              : "Building",
        tone: confidenceTone,
        note: leagueConfidence.note,
      });
    }
    if (leagueConfidence && (leagueConfidenceDelta || leagueConfidenceTrend)) {
      addUniqueDiagnosticRow(rows, seen, {
        id: "league-ai-confidence-trend",
        area: "AI confidence trend",
        item: leagueConfidenceDelta
          ? `${leagueConfidenceDelta} since previous snapshot`
          : `${leagueConfidence.score}% current`,
        status:
          leagueConfidence.scoreDelta === null ||
          leagueConfidence.scoreDelta === undefined
            ? "Trend building"
            : leagueConfidence.scoreDelta > 0
              ? "Improving"
              : leagueConfidence.scoreDelta < 0
                ? "Declining"
                : "Flat",
        tone:
          leagueConfidence.scoreDelta === null ||
          leagueConfidence.scoreDelta === undefined
            ? "info"
            : leagueConfidence.scoreDelta < -6
              ? "warn"
              : leagueConfidence.scoreDelta > 0
                ? "good"
                : "info",
        note: leagueConfidenceTrend
          ? `Recent confidence snapshots: ${leagueConfidenceTrend}.`
          : "Confidence deltas compare this report against the latest persisted league confidence snapshot.",
      });
    }
    if (
      leagueConfidence?.calibration &&
      leagueConfidence.calibration.status !== "ready"
    ) {
      addUniqueDiagnosticRow(rows, seen, {
        id: "league-ai-confidence-calibration",
        area: "AI confidence calibration",
        item: `${leagueConfidence.calibration.observedSampleSize}/${leagueConfidence.calibration.targetSampleSize} samples`,
        status:
          leagueConfidence.calibration.status === "pending"
            ? "Pending season"
            : "Collecting",
        tone: "info",
        note: leagueConfidence.calibration.note,
      });
    }
    leagueConfidence?.signals
      .filter(signal => signal.status !== "strong")
      .slice(0, 4)
      .forEach(signal => {
        addUniqueDiagnosticRow(rows, seen, {
          id: `league-ai-confidence-signal-${signal.key}`,
          area: "AI confidence signal",
          item: `${signal.label}: ${signal.score}%`,
          status: signal.status === "low" ? "Low evidence" : "Building",
          tone: signal.status === "low" ? "warn" : "info",
          note: signal.note,
        });
      });
    leagueConfidence?.signals
      .filter(
        signal => signal.scoreDelta !== null && signal.scoreDelta !== undefined
      )
      .sort(
        (a, b) =>
          Math.abs(Number(b.scoreDelta || 0)) -
          Math.abs(Number(a.scoreDelta || 0))
      )
      .slice(0, 6)
      .forEach(signal => {
        const delta = Number(signal.scoreDelta || 0);
        addUniqueDiagnosticRow(rows, seen, {
          id: `league-ai-confidence-signal-trend-${signal.key}`,
          area: "AI confidence signal trend",
          item: `${signal.label}: ${delta > 0 ? "+" : ""}${delta} to ${signal.score}%`,
          status: delta > 0 ? "Gaining" : delta < 0 ? "Dropping" : "Flat",
          tone: delta > 0 ? "good" : delta < -6 ? "warn" : "info",
          note:
            signal.previousScore === null || signal.previousScore === undefined
              ? signal.note
              : `Previous ${signal.previousScore}%. ${signal.note}`,
        });
      });
    leagueConfidence?.managerConfidence
      ?.filter(manager => manager.score < 62)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .forEach(manager => {
        addUniqueDiagnosticRow(rows, seen, {
          id: `manager-ai-confidence-${manager.manager}`,
          area: "Manager AI confidence",
          item: `${manager.manager}: ${manager.score}%`,
          status: manager.score < 50 ? "Low evidence" : "Building",
          tone: manager.score < 50 ? "warn" : "info",
          note: manager.note,
        });
      });

    leagueDiagnostics.valueLimitations.forEach((limitation, index) => {
      const coverageStatus = getValueCoverageStatus(limitation);
      if (!isActionableDiagnosticTone(coverageStatus.tone)) return;
      addUniqueDiagnosticRow(rows, seen, {
        id: `value-limitation-${index}`,
        area: "Value coverage",
        item: getValueCoverageItem(limitation, index),
        status: coverageStatus.status,
        tone: coverageStatus.tone,
        note: limitation,
      });
    });
  }

  if (reportData.depthChartDiagnostics) {
    const diagnostic = reportData.depthChartDiagnostics;
    const checked = diagnostic.checkedPlayerCount || 0;
    const matched = diagnostic.matchedPlayerCount || 0;
    const coveragePct = checked ? Math.round((matched / checked) * 100) : 0;
    const failedTeams = diagnostic.failedTeams.map(team => team.toUpperCase());
    const hasTeamGaps = failedTeams.length > 0;
    const tone: AdminValueDiagnosticRow["tone"] =
      hasTeamGaps || (checked > 0 && coveragePct < 60)
        ? "warn"
        : diagnostic.mismatchCount > 0
          ? "info"
          : "good";
    addUniqueDiagnosticRow(rows, seen, {
      id: "depth-chart-role-coverage",
      area: "Depth chart roles",
      item: checked
        ? `${matched}/${checked} players matched`
        : "No team players checked",
      status: hasTeamGaps
        ? "Team gaps"
        : diagnostic.mismatchCount
          ? "Stale tags found"
          : "Loaded",
      tone,
      note: [
        checked
          ? `Current team chart roles matched ${coveragePct}% of checked report players.`
          : "No active NFL team players were available for current role matching.",
        `${diagnostic.mismatchCount} Sleeper role tag${diagnostic.mismatchCount === 1 ? "" : "s"} differed from the current team chart.`,
        `Teams loaded: ${diagnostic.loadedTeams.length}/${diagnostic.requestedTeams.length}.`,
        diagnostic.cacheMode
          ? `Cache mode: ${diagnostic.cacheMode}${diagnostic.snapshotKey ? ` ${diagnostic.snapshotKey}` : ""}.`
          : null,
        diagnostic.lastWarmAt
          ? `Last warm: ${new Date(diagnostic.lastWarmAt).toLocaleString()}.`
          : null,
        typeof diagnostic.staleTeamCount === "number" && diagnostic.staleTeamCount > 0
          ? `${diagnostic.staleTeamCount} stale or missing team chart${diagnostic.staleTeamCount === 1 ? "" : "s"}.`
          : null,
        `Role enrichment took ${Math.round(diagnostic.durationMs || 0)}ms.`,
        failedTeams.length
          ? `Needs retry for: ${failedTeams.join(", ")}.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (reportData.transactionBackfillDiagnostics) {
    const diagnostic = reportData.transactionBackfillDiagnostics;
    addUniqueDiagnosticRow(rows, seen, {
      id: "historical-sleeper-transactions",
      area: "Sleeper history backfill",
      item: `${diagnostic.transactionCount} transactions`,
      status: diagnostic.checkedLeagueCount
        ? `${diagnostic.seasonCount} season${diagnostic.seasonCount === 1 ? "" : "s"}`
        : "No history",
      tone: diagnostic.checkedLeagueCount ? "good" : "info",
      note: [
        `${diagnostic.checkedLeagueCount} previous league${diagnostic.checkedLeagueCount === 1 ? "" : "s"} checked.`,
        `${diagnostic.waiverOrFreeAgentCount} waiver/free-agent moves and ${diagnostic.tradeProposalCount} non-complete trade signals were backfilled for manager behavior reads.`,
        diagnostic.failedLeagueCount
          ? `${diagnostic.failedLeagueCount} historical league link${diagnostic.failedLeagueCount === 1 ? "" : "s"} failed or returned unusable data.`
          : null,
        diagnostic.brokenPreviousLeagueChainCount
          ? `${diagnostic.brokenPreviousLeagueChainCount} previous-league chain issue${diagnostic.brokenPreviousLeagueChainCount === 1 ? "" : "s"} need review.`
          : null,
      ].filter(Boolean).join(" "),
    });
  }

  if (!isRedraftValueMode && reportData.prospectSourceDiagnostics) {
    const diagnostic = reportData.prospectSourceDiagnostics;
    const tone =
      diagnostic.status === "stored"
        ? "good"
        : diagnostic.status === "partial"
          ? "warn"
          : "warn";
    if (isActionableDiagnosticTone(tone)) {
      const errorNote =
        diagnostic.status === "partial" && diagnostic.errors?.length
          ? ` ${diagnostic.errors.length} scrape gap${diagnostic.errors.length === 1 ? "" : "s"} remain. First: ${diagnostic.errors[0]}.`
          : "";
      addUniqueDiagnosticRow(rows, seen, {
        id: "prospect-context-source",
        area: "Prospect context",
        item: `${diagnostic.playerCount} profiles`,
        status:
          diagnostic.status === "partial"
            ? "Stored with gaps"
            : "Snapshot pending",
        tone,
        note: `${diagnostic.note}${errorNote}`,
      });
    }
  }

  if (
    isRedraftValueMode &&
    reportData.rankings?.redraftSourceDiagnostics?.length
  ) {
    reportData.rankings.redraftSourceDiagnostics.forEach(diagnostic => {
      const tone: AdminValueDiagnosticRow["tone"] =
        diagnostic.status === "loaded"
          ? "good"
          : diagnostic.status === "disabled"
            ? "info"
            : diagnostic.status === "empty"
              ? "warn"
              : diagnostic.status === "stale"
                ? "danger"
                : "danger";
      addUniqueDiagnosticRow(rows, seen, {
        id: `redraft-source-${diagnostic.key}`,
        area: "Redraft source",
        item: `${diagnostic.source}: ${diagnostic.rowCount.toLocaleString()} rows`,
        status:
          diagnostic.status === "loaded"
            ? "Loaded"
            : diagnostic.status === "disabled"
              ? "Disabled"
              : diagnostic.status === "empty"
                ? "No rows"
                : diagnostic.status === "stale"
                  ? "Stale data"
                  : "Source error",
        tone:
          diagnostic.trustAlert?.level === "danger"
            ? "danger"
            : diagnostic.trustAlert?.level === "warn"
              ? "warn"
              : tone,
        note: formatSourceTrustDiagnosticNote(diagnostic),
      });
    });
  }

  if (
    !isRedraftValueMode &&
    reportData.rankings?.dynastySourceDiagnostics?.length
  ) {
    reportData.rankings.dynastySourceDiagnostics.forEach(diagnostic => {
      const tone: AdminValueDiagnosticRow["tone"] =
        diagnostic.status === "loaded"
          ? "good"
          : diagnostic.status === "empty"
            ? "warn"
            : diagnostic.status === "disabled"
              ? "info"
              : "danger";
      addUniqueDiagnosticRow(rows, seen, {
        id: `dynasty-source-${diagnostic.key}`,
        area: "Dynasty source",
        item: `${diagnostic.source}: ${diagnostic.rowCount.toLocaleString()} rows`,
        status:
          diagnostic.status === "loaded"
            ? "Loaded"
            : diagnostic.status === "empty"
              ? "No rows"
              : diagnostic.status === "disabled"
                ? "Disabled"
                : diagnostic.status === "stale"
                  ? "Stale data"
                  : "Source error",
        tone:
          diagnostic.trustAlert?.level === "danger"
            ? "danger"
            : diagnostic.trustAlert?.level === "warn"
              ? "warn"
              : tone,
        note: formatSourceTrustDiagnosticNote(diagnostic),
      });
    });
  }

  if (
    !isRedraftValueMode &&
    reportData.rankings?.devySourceDiagnostics?.length
  ) {
    reportData.rankings.devySourceDiagnostics.forEach(diagnostic => {
      const tone: AdminValueDiagnosticRow["tone"] =
        diagnostic.trustAlert?.level === "danger"
          ? "danger"
          : diagnostic.trustAlert?.level === "warn"
            ? "warn"
            : diagnostic.status === "loaded"
              ? "good"
              : diagnostic.status === "empty"
                ? "warn"
                : "danger";
      addUniqueDiagnosticRow(rows, seen, {
        id: `devy-source-${diagnostic.key}`,
        area: "Devy source",
        item: `${diagnostic.source}: ${diagnostic.rowCount.toLocaleString()} rows`,
        status:
          diagnostic.status === "loaded"
            ? "Loaded"
            : diagnostic.status === "empty"
              ? "No rows"
              : "Source issue",
        tone,
        note: formatSourceTrustDiagnosticNote(diagnostic),
      });
    });
  }

  reportData.sourceSnapshotDiagnostics?.slice(0, 12).forEach(diagnostic => {
    const tone: AdminValueDiagnosticRow["tone"] =
      diagnostic.level === "danger"
        ? "danger"
        : diagnostic.level === "warn"
          ? "warn"
          : "info";
    addUniqueDiagnosticRow(rows, seen, {
      id: `source-snapshot-${diagnostic.sourceKey}`,
      area: "Snapshot freshness",
      item: diagnostic.rowCount !== null && diagnostic.rowCount !== undefined
        ? `${diagnostic.source}: ${diagnostic.rowCount.toLocaleString()} rows`
        : diagnostic.source,
      status:
        diagnostic.status === "loaded"
          ? "Fresh"
          : diagnostic.status === "stale"
            ? "Stale"
            : diagnostic.status === "missing"
              ? "Missing"
              : "Source error",
      tone,
      note: [
        diagnostic.note,
        diagnostic.snapshotKey ? `Snapshot key: ${diagnostic.snapshotKey}.` : null,
        diagnostic.updatedAt ? `Updated: ${formatAdminTelemetryDate(diagnostic.updatedAt)}.` : null,
      ].filter(Boolean).join(" "),
    });
  });

  currentSnapshotGaps.forEach(dateKey => {
    addUniqueDiagnosticRow(rows, seen, {
      id: `snapshot-${dateKey}`,
      area: "Value blend",
      item: dateKey,
      status: "Missing day",
      tone: "warn",
      note: `Daily blend was not stored after the ${ADMIN_VALUE_DIAGNOSTIC_START_DATE} blend cutoff, so any comparison touching this date uses the nearest available stored profile.`,
    });
  });

  const playersWithoutSourceMetadata = outlookPlayers.filter(
    player =>
      player.player_id && !getOutlookPlayerValueProfile(reportData, player)
  );
  if (playersWithoutSourceMetadata.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: "source-metadata-missing",
      area: "Player values",
      item: `${playersWithoutSourceMetadata.length} report players`,
      status: "Source check unavailable",
      tone: "warn",
      note: "The displayed player values exist, but this report payload did not include source-level blend detail.",
    });
  }

  const rankingIdentityDiagnostics =
    reportData.rankings?.identityDiagnostics || [];
  const unmatchedRankingRows = rankingIdentityDiagnostics.filter(
    row => row.status === "unmatched" && row.board !== "devy"
  );

  if (unmatchedRankingRows.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: "ranking-identity-unmatched",
      area: "Ranking identities",
      item: `${unmatchedRankingRows.length} source row${unmatchedRankingRows.length === 1 ? "" : "s"}`,
      status: "Needs mapping",
      tone: "danger",
      note: `Ranking rows did not match a Sleeper player. First example: ${unmatchedRankingRows[0].playerName}. These rows may show the wrong owner/avatar until mapped.`,
    });
  }

  rankingIdentityDiagnostics
    .filter(row => row.board !== "devy")
    .slice(0, 8)
    .forEach((diagnostic, index) => {
      const isCollision = diagnostic.status === "resolved-collision";
      addUniqueDiagnosticRow(rows, seen, {
        id: `ranking-alias-review-${index}-${diagnostic.id}`,
        area: "Player alias review",
        item: diagnostic.playerName,
        status: isCollision ? "Resolved collision" : "Needs mapping",
        tone: isCollision ? "warn" : "danger",
        note:
          isCollision && diagnostic.selectedPlayerName
            ? `${diagnostic.note} Source key: ${diagnostic.sourceKey}.`
            : `${diagnostic.note} Add or adjust an alias if this source row should map to a Sleeper player.`,
      });
    });

  outlookPlayers.forEach(player => {
    const profile = getOutlookPlayerValueProfile(reportData, player);
    if (!profile) return;

    const sources = profile.sources || [];
    const hasCoreMarketSource = isRedraftValueMode
      ? Boolean(
          profile.fantasyCalcRedraft ||
            profile.fantasyProsSeasonValue ||
            profile.seasonValue
        )
      : Boolean(
          profile.flockFantasy ||
            profile.dynastyNerds ||
            profile.marketKtc ||
            profile.fantasyCalcDynasty ||
            profile.dynastyProcess
        );
    if (hasCoreMarketSource) return;

    addUniqueDiagnosticRow(rows, seen, {
      id: `thin-value-${player.player_id || player.name}`,
      area: "Player value",
      item: player.name,
      status: sources.length ? "Non-primary source" : "No source list",
      tone: "warn",
      note: `${sources.length || 0} source${sources.length === 1 ? "" : "s"} found, but none are one of the primary ${isRedraftValueMode ? "redraft/current-season" : "dynasty"} blend sources. The card can render, but admin should verify the player mapping/value source.`,
    });
  });

  const missingAgePlayers = outlookPlayers.filter(player => player.age == null);
  if (missingAgePlayers.length) {
    addUniqueDiagnosticRow(rows, seen, {
      id: "missing-age-value-input",
      area: "Value input",
      item: `${missingAgePlayers.length} report players`,
      status: "Age missing",
      tone: "warn",
      note: "Age-aware value context falls back to the current value when the age curve cannot be applied.",
    });
  }

  if (!rows.length) {
    rows.push({
      id: "no-active-diagnostics",
      area: "Value assumptions",
      item: "Current report",
      status: "No active flags",
      tone: "good",
      note: "No missing post-cutoff snapshot days or unmapped primary-value players were detected. League-format notes still show what is calculated versus bucketed.",
    });
  }

  return rows.slice(0, 32);
}

function formatSourceTrustDiagnosticNote(
  diagnostic: RankingSourceDiagnostic
): string {
  const trustText = Number.isFinite(diagnostic.trustScore)
    ? `Trust ${diagnostic.trustScore}/100 (${Number(diagnostic.trustMultiplier || 1).toFixed(2)}x effective weight).${diagnostic.trustNote ? ` ${diagnostic.trustNote}.` : ""}`
    : "";
  const trustDelta = Number(diagnostic.trustScoreDelta);
  const movementText = Number.isFinite(trustDelta)
    ? trustDelta > 0
      ? `Trust rose +${trustDelta} points since the previous snapshot.`
      : trustDelta < 0
        ? `Trust fell ${Math.abs(trustDelta)} points since the previous snapshot.`
        : "Trust was unchanged since the previous snapshot."
    : "";
  return [
    diagnostic.note,
    trustText,
    movementText,
    diagnostic.trustAlert?.message || "",
    diagnostic.error ? `Error: ${diagnostic.error}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getAdminBlendProfileLabel(
  reportData: ReportData,
  profileKey?: string | null
): string {
  if (!profileKey) return "League-matched profile";
  const profileOption = reportData.rankings?.profileOptions?.find(
    option => option.key === profileKey
  );
  return profileOption?.label || "League-matched profile";
}

function formatAdminBlendSources(
  sources: AdminBlendSummary["sources"],
  isRedraft: boolean
): AdminBlendSummary["sources"] {
  if (!isRedraft) return sources;
  const redraftSources = sources.filter(source => {
    const text = `${source.key} ${source.source} ${source.note || ""}`;
    return (
      /(redraft|season|fantasypros|current|myfantasyleague|mfl|espn|fleaflicker|yahoo|nfl fantasy)/i.test(
        text
      ) && !/(dynasty|devy|college|rookie)/i.test(text)
    );
  });

  return redraftSources.length
    ? redraftSources
    : [
        {
          key: "current-season-model",
          source: "Current-season model",
          percent: 100,
          note: "Redraft reports expose the current-season value lens by default.",
        },
      ];
}

function formatScoutingArchiveCopy(value?: string | null): string {
  return String(value || "")
    .replace(/NFL Draft Buzz/g, "archived scouting data")
    .replace(/Draft Buzz/g, "scouting archive");
}

function buildAdminBlendSummaries(reportData: ReportData): AdminBlendSummary[] {
  const rankings = reportData.rankings;
  const sourceWeightProfiles = rankings?.sourceWeightProfiles;
  if (!rankings || !sourceWeightProfiles) return [];

  const summaries: AdminBlendSummary[] = [];
  const leagueValueMode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );
  const isRedraft = leagueValueMode === "redraft";
  const dynastyProfileKey = isRedraft
    ? rankings.defaultRedraftProfileKey || rankings.defaultProfileKey
    : rankings.defaultProfileKey;
  const devyProfileKey = rankings.defaultDevyProfileKey;

  if (dynastyProfileKey && sourceWeightProfiles[dynastyProfileKey]) {
    summaries.push({
      id: isRedraft
        ? "current-league-redraft-blend"
        : "current-league-dynasty-blend",
      title: isRedraft
        ? "Current League Redraft Blend"
        : "Current League Dynasty Blend",
      profileLabel: isRedraft
        ? "Current-season value blend"
        : getAdminBlendProfileLabel(reportData, dynastyProfileKey),
      note: isRedraft
        ? "Primary current-season blend for rankings, roster values, trades, and redraft owner reads in this league."
        : "Primary dynasty market blend for rankings, roster values, trades, and non-lineup dynasty reads in this league.",
      sources: formatAdminBlendSources(
        sourceWeightProfiles[dynastyProfileKey].sources
          .filter(source => source.percent > 0)
          .map(source => ({
            key: source.key,
            source: formatScoutingArchiveCopy(source.source),
            percent: source.percent,
            note: formatScoutingArchiveCopy(source.note),
          })),
        isRedraft
      ),
    });
  }

  if (!isRedraft && devyProfileKey && sourceWeightProfiles[devyProfileKey]) {
    summaries.push({
      id: "current-league-college-blend",
      title: "College Prospect Blend",
      profileLabel: getAdminBlendProfileLabel(reportData, devyProfileKey),
      note: "Prospect-board blend for college/devy assets. Prospect traits are context only and do not directly change dynasty market values.",
      sources: sourceWeightProfiles[devyProfileKey].sources
        .filter(source => source.percent > 0)
        .map(source => ({
          key: source.key,
          source: formatScoutingArchiveCopy(source.source),
          percent: source.percent,
          note: formatScoutingArchiveCopy(source.note),
        })),
    });
  }

  return summaries;
}

function getActionableMissingSnapshotDates(data?: {
  missingDateKeys?: string[];
  todayDateKey?: string | null;
}): string[] {
  if (!data?.missingDateKeys?.length || !data.todayDateKey) return [];
  return data.missingDateKeys.filter(dateKey => dateKey === data.todayDateKey);
}

function AdminValueDiagnosticsTable({
  reportData,
  rows,
  priorityRows,
  emptySourceRows,
}: {
  reportData: ReportData;
  rows: AdminValueDiagnosticRow[];
  priorityRows: AdminValueDiagnosticRow[];
  emptySourceRows: AdminValueDiagnosticRow[];
}) {
  const blendSummaries = buildAdminBlendSummaries(reportData);
  const leagueConfidence = reportData.leagueDiagnostics?.aiConfidence;
  const managerConfidenceRows = [...(leagueConfidence?.managerConfidence || [])]
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
  const priorityIds = new Set(priorityRows.map(row => row.id));
  const visiblePriorityRows = priorityRows.slice(0, 6);
  const reviewRows = rows.filter(
    row =>
      !priorityIds.has(row.id) &&
      isActionableDiagnosticTone(row.tone) &&
      !isHandledSourceTrustDiagnosticRow(row)
  );
  const showConfidenceDrilldown =
    priorityRows.length > 0 ||
    reviewRows.some(row => /confidence/i.test(row.area));

  return (
    <div className="admin-value-diagnostics">
      <p className="admin-value-diagnostics-intro">
        Admin eyes only. Needs Attention lists real value/source problems. The
        0-row watchlist is informational so we can see optional providers that
        are configured but not currently contributing.
      </p>
      {showConfidenceDrilldown && leagueConfidence && (
        <section
          className="admin-confidence-drilldown"
          aria-label="Admin confidence drilldown"
        >
          <div className="admin-confidence-drilldown-head">
            <span>Confidence Drilldown</span>
            <strong>
              {leagueConfidence.score}% {leagueConfidence.label}
            </strong>
            <p>{leagueConfidence.note}</p>
          </div>
          <div className="admin-confidence-signal-grid">
            {leagueConfidence.signals.map(signal => {
              const delta = Number(signal.scoreDelta || 0);
              return (
                <article
                  key={signal.key}
                  className={`admin-confidence-signal-card admin-confidence-signal-card-${signal.status}`}
                >
                  <div>
                    <span>{signal.label}</span>
                    <strong>{signal.score}%</strong>
                  </div>
                  <em>
                    {signal.previousScore === null ||
                    signal.previousScore === undefined
                      ? "New signal"
                      : `${delta > 0 ? "+" : ""}${delta} from ${signal.previousScore}%`}
                  </em>
                  <p>{signal.note}</p>
                </article>
              );
            })}
          </div>
          {managerConfidenceRows.length > 0 && (
            <div
              className="admin-manager-confidence-strip"
              aria-label="Lowest manager confidence rows"
            >
              <span>Weakest manager reads</span>
              {managerConfidenceRows.map(manager => (
                <small key={manager.manager}>
                  <strong>{manager.manager}</strong>
                  <em>{manager.score}%</em>
                </small>
              ))}
            </div>
          )}
        </section>
      )}
      {visiblePriorityRows.length > 0 && (
        <section
          className="admin-critical-alerts"
          aria-label="Important admin value alerts"
        >
          <div className="admin-critical-alerts-header">
            <span>Needs Admin Attention</span>
            <strong>
              {priorityRows.length} important value/source flag
              {priorityRows.length === 1 ? "" : "s"}
            </strong>
          </div>
          <div className="admin-critical-alerts-grid">
            {visiblePriorityRows.map(row => (
              <article
                key={`priority-${row.id}`}
                className={`admin-critical-alert-card admin-critical-alert-card-${row.tone || "info"}`}
              >
                <div>
                  <span>{row.area}</span>
                  <strong>{row.item}</strong>
                </div>
                <p>{row.note}</p>
                <em>{row.status}</em>
              </article>
            ))}
          </div>
        </section>
      )}
      {blendSummaries.length > 0 && (
        <div className="admin-blend-summary-grid">
          {blendSummaries.map(summary => (
            <article key={summary.id} className="admin-blend-summary-card">
              <div className="admin-blend-summary-top">
                <span>{summary.title}</span>
                <strong>{summary.profileLabel}</strong>
              </div>
              <div
                className="admin-blend-source-list"
                aria-label={`${summary.title} source weights`}
              >
                {summary.sources.map(source => (
                  <span
                    key={source.key}
                    className="admin-blend-source-pill"
                    title={source.note}
                  >
                    <strong>{source.source}</strong>
                    <em>{source.percent}%</em>
                  </span>
                ))}
              </div>
              <p>{summary.note}</p>
            </article>
          ))}
          <article className="admin-blend-summary-card admin-blend-summary-card-note">
            <div className="admin-blend-summary-top">
              <span>Important Blend Detail</span>
              <strong>Weights normalize when sources are missing</strong>
            </div>
            <p>
              {normalizeLeagueValueMode(
                reportData.leagueDiagnostics?.valueMode ||
                  reportData.leagueValueMode
              ) === "redraft"
                ? "If a player is missing one of the current-season sources above, the available weights normalize across only the sources present. Long-term market inputs stay hidden in this report."
                : "If a player is missing one of the sources above, the available weights normalize across only the sources present. Players only get flagged below when no primary blend source is attached. Season and projection data is only for lineup and redraft-style reads, not dynasty market value."}
            </p>
            {reportData.leagueDiagnostics && (
              <p>
                Current league context: {reportData.leagueDiagnostics.teamCount}
                -team {reportData.leagueDiagnostics.scoringSummary}. Starter
                math uses {reportData.leagueDiagnostics.lineupSlotSummary}.
              </p>
            )}
          </article>
        </div>
      )}
      {emptySourceRows.length > 0 && (
        <section
          className="admin-source-history-strip"
          aria-label="Optional sources with zero rows"
        >
          <div className="admin-source-history-head">
            <span>0-row source watchlist</span>
            <strong>
              {emptySourceRows.length} optional source
              {emptySourceRows.length === 1 ? "" : "s"} returned no usable rows
            </strong>
          </div>
          <div className="admin-source-history-grid">
            {emptySourceRows.map(row => (
              <article
                key={`empty-source-${row.id}`}
                className="admin-source-history-card"
              >
                <div>
                  <span>{row.area}</span>
                  <strong>{row.item}</strong>
                </div>
                <p>{row.note}</p>
                <em>{row.status}</em>
              </article>
            ))}
          </div>
        </section>
      )}
      {reviewRows.length > 0 && (
        <div className="admin-value-diagnostics-grid">
          {reviewRows.map(row => (
            <article
              key={row.id}
              className={`admin-value-diagnostics-card admin-value-diagnostics-card-${row.tone || "info"}`}
            >
              <div className="admin-value-diagnostics-card-top">
                <div>
                  <span>{row.area}</span>
                  <strong>{row.item}</strong>
                </div>
                <span className="admin-value-diagnostics-flag">{row.status}</span>
              </div>
              <p>{row.note}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

type AIReadoutDiagnosticTone = "good" | "info" | "warn" | "danger";

type AIReadoutDiagnosticRow = {
  id: string;
  tab: string;
  surface: string;
  owner: string;
  count: number;
  hasConfidence: boolean;
  hasTrace: boolean;
  duplicateRisk: boolean;
  sourceLimited: boolean;
  note: string;
  tone: AIReadoutDiagnosticTone;
};

type AIDecisionLogRow = {
  id: string;
  lane: string;
  surface: string;
  owner: string;
  decision: string;
  confidence: string;
  tone: AIReadoutDiagnosticTone;
  why: string;
  receipts: string[];
  blockers: string[];
  missingEvidence: string[];
  changeTriggers: string[];
};

type AISurfaceRegistryRole = "action-owner" | "context" | "hidden" | "merge";

type AISurfaceRegistryRow = {
  id: string;
  tab: string;
  surface: string;
  owner: string;
  role: AISurfaceRegistryRole;
  roleLabel: string;
  tone: AIReadoutDiagnosticTone;
  visibility: string;
  allowedClaim: string;
  evidenceStatus: string;
  noiseRule: string;
  nextStep: string;
};

type AIReadoutDiagnostics = ReturnType<typeof buildAIReadoutDiagnostics>;

function getAIReadoutDiagnosticTone(row: {
  hasConfidence: boolean;
  hasTrace: boolean;
  duplicateRisk: boolean;
  sourceLimited: boolean;
}): AIReadoutDiagnosticTone {
  if (row.duplicateRisk) return "danger";
  if (!row.hasConfidence || !row.hasTrace) return "warn";
  if (row.sourceLimited) return "info";
  return "good";
}

function buildAIReadoutRow(
  row: Omit<AIReadoutDiagnosticRow, "tone">
): AIReadoutDiagnosticRow {
  return {
    ...row,
    tone: getAIReadoutDiagnosticTone(row),
  };
}

function compactDecisionLogItems(
  values: Array<string | null | undefined>,
  limit = 4
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach(value => {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });

  return result.slice(0, limit);
}

function getAIActionDecisionLabel(decision: AIActionQueueItem["decision"]) {
  if (decision === "do") return "Do";
  if (decision === "blocked") return "Do not";
  if (decision === "hold") return "Hold";
  return "Watch";
}

function getAIActionDecisionTone(
  decision: AIActionQueueItem["decision"],
  fallbackTone: AIActionQueueItem["tone"]
): AIReadoutDiagnosticTone {
  if (decision === "do") return "good";
  if (decision === "blocked") return "danger";
  if (decision === "hold") return "info";
  if (fallbackTone === "danger" || fallbackTone === "warn" || fallbackTone === "info") {
    return fallbackTone;
  }
  return "good";
}

function getReadoutPolicy(row: AIReadoutDiagnosticRow): {
  decision: string;
  tone: AIReadoutDiagnosticTone;
} {
  if (row.duplicateRisk) {
    return {
      decision: "Merge",
      tone: "danger",
    };
  }

  if (row.count <= 0) {
    return {
      decision: "Hide",
      tone: "info",
    };
  }

  if (!row.hasConfidence || !row.hasTrace) {
    return {
      decision: "Data",
      tone: "warn",
    };
  }

  if (row.sourceLimited) {
    return {
      decision: "Support",
      tone: "info",
    };
  }

  if (row.id === "autopilot-actions") {
    return {
      decision: "Owns Action",
      tone: "good",
    };
  }

  return {
    decision: "Support",
    tone: "good",
  };
}

function getAISurfaceRegistryRole(row: AIReadoutDiagnosticRow): {
  role: AISurfaceRegistryRole;
  roleLabel: string;
  tone: AIReadoutDiagnosticTone;
} {
  if (row.duplicateRisk) {
    return {
      role: "merge",
      roleLabel: "Merge",
      tone: "danger",
    };
  }

  if (row.id === "autopilot-actions" && row.count > 0 && row.hasConfidence && row.hasTrace) {
    return {
      role: "action-owner",
      roleLabel: "Acts",
      tone: "good",
    };
  }

  if (row.count <= 0 || !row.hasConfidence || !row.hasTrace) {
    return {
      role: "hidden",
      roleLabel: row.count <= 0 ? "Hidden" : "Data",
      tone: row.count <= 0 ? "info" : "warn",
    };
  }

  return {
    role: "context",
    roleLabel: "Supports",
    tone: row.sourceLimited ? "info" : "good",
  };
}

function buildAISurfaceRegistry(diagnostics: AIReadoutDiagnostics) {
  const rows: AISurfaceRegistryRow[] = diagnostics.rows.map(row => {
    const role = getAISurfaceRegistryRole(row);
    const missing = compactDecisionLogItems([
      !row.hasConfidence ? "confidence" : null,
      !row.hasTrace ? "source trace" : null,
      row.sourceLimited ? "fresh source coverage" : null,
    ], 3);

    return {
      id: row.id,
      tab: row.tab,
      surface: row.surface,
      owner: row.owner,
      role: role.role,
      roleLabel: role.roleLabel,
      tone: role.tone,
      visibility: row.count > 0 ? `${row.count} shown` : "Hidden",
      allowedClaim:
        role.role === "action-owner"
          ? "Can recommend"
          : role.role === "context"
            ? "Evidence only"
            : role.role === "merge"
              ? "No separate claim"
              : "No AI claim",
      evidenceStatus: missing.length
        ? `Missing: ${missing.join(", ")}`
        : row.sourceLimited
          ? "Limited source"
          : "Evidence OK",
      noiseRule:
        role.role === "action-owner"
          ? "Owns the recommendation."
          : role.role === "context"
            ? "Supports only."
            : role.role === "merge"
              ? "Fold into the owner."
              : "Keep hidden.",
      nextStep:
        role.role === "action-owner"
          ? "Hold alternates unless blocked."
          : row.duplicateRisk
            ? "Merge into owner."
            : row.count <= 0
              ? "Wait for data."
              : missing.length
                ? `Add ${missing.join(" + ")}.`
                : row.sourceLimited
                  ? "Refresh sources."
                  : "Keep as support.",
    };
  });

  return {
    rows,
    actionOwners: rows.filter(row => row.role === "action-owner").length,
    contextRows: rows.filter(row => row.role === "context").length,
    hiddenRows: rows.filter(row => row.role === "hidden").length,
    mergeRows: rows.filter(row => row.role === "merge").length,
    riskRows: rows.filter(row =>
      row.role === "hidden" || row.role === "merge" || row.tone === "warn" || row.tone === "danger"
    ).length,
  };
}

function buildAIActionDecisionLogRows(reportData: ReportData): AIDecisionLogRow[] {
  const mode = normalizeLeagueValueMode(
    reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );

  try {
    const actionQueue = buildAutopilotData({
      reportData,
      mode,
      fallback: AUTOPILOT_MOCK_DATA[mode],
    }).actionQueue;

    const primaryRows = (actionQueue || []).slice(0, 1).map(item => {
      const conflicts = detectAIActionConflicts(item);
      const conflictReceipts = conflicts.map(
        conflict => `${conflict.label}: ${conflict.detail}`
      );
      const conflictBlockers = conflicts
        .filter(conflict => conflict.tone === "danger")
        .map(conflict => conflict.detail);
      const conflictMissingEvidence = conflicts
        .filter(conflict => conflict.tone === "warn")
        .map(conflict => conflict.detail);

      return {
        id: `action-${item.id}`,
        lane: "Action Queue",
        surface: item.label,
        owner: `${item.source.charAt(0).toUpperCase()}${item.source.slice(1)} action`,
        decision: getAIActionDecisionLabel(item.decision),
        confidence: `${item.confidence}%`,
        tone: getAIActionDecisionTone(item.decision, item.tone),
        why: item.why || item.detail,
        receipts: compactDecisionLogItems([
          ...conflictReceipts,
          ...item.receipts,
          ...item.sourceHealth,
          item.signals[0] ? `Signal: ${item.signals[0]}` : null,
        ]),
        blockers: compactDecisionLogItems([
          ...item.blockers,
          ...conflictBlockers,
        ], 3),
        missingEvidence: compactDecisionLogItems([
          ...item.missingEvidence,
          ...conflictMissingEvidence,
        ], 3),
        changeTriggers: item.changeTriggers.slice(0, 3),
      };
    });

    const suppressedCount = Math.max(0, (actionQueue || []).length - primaryRows.length);
    if (!suppressedCount) return primaryRows;

    return [
      ...primaryRows,
      {
        id: "action-queue-alternates-held",
        lane: "Action Queue",
        surface: "Alternates",
        owner: "Queue QA",
        decision: "Support",
        confidence: "Held",
        tone: "info" as const,
        why: `${suppressedCount} lower-ranked action${suppressedCount === 1 ? "" : "s"} held back.`,
        receipts: compactDecisionLogItems([
          `${suppressedCount} alternate${suppressedCount === 1 ? "" : "s"}`,
          "Primary owns rec",
          "Details in receipts",
        ]),
        blockers: [],
        missingEvidence: [],
        changeTriggers: ["Primary blocked or weaker"],
      },
    ];
  } catch {
    return [
      {
        id: "action-queue-build-error",
        lane: "Action Queue",
        surface: "Action Queue",
        owner: "Recommendations",
        decision: "Hide",
        confidence: "Error",
        tone: "danger",
        why: "Action Queue failed to build.",
        receipts: ["Builder failed"],
        blockers: ["Build failed"],
        missingEvidence: ["Valid payload"],
        changeTriggers: ["Fix builder"],
      },
    ];
  }
}

function buildAIReadoutPolicyDecisionLogRows(
  diagnostics: AIReadoutDiagnostics
): AIDecisionLogRow[] {
  return diagnostics.rows.map(row => {
    const policy = getReadoutPolicy(row);
    return {
      id: `readout-${row.id}`,
      lane: row.tab,
      surface: row.surface,
      owner: row.owner,
      decision: policy.decision,
      confidence: row.hasConfidence ? "Yes" : "Missing",
      tone: policy.tone,
      why: row.note,
      receipts: compactDecisionLogItems([
        `${row.count} shown`,
        row.owner,
        row.hasTrace ? "Trace" : null,
        row.hasConfidence ? "Confidence" : null,
      ]),
      blockers: row.duplicateRisk
        ? ["Duplicate claim"]
        : [],
      missingEvidence: compactDecisionLogItems([
        !row.hasConfidence ? "Confidence" : null,
        !row.hasTrace ? "Source trace" : null,
        row.sourceLimited ? "Fresh source" : null,
      ]),
      changeTriggers: compactDecisionLogItems([
        row.count <= 0 ? `Return ${row.owner.toLowerCase()} data` : null,
        !row.hasConfidence ? "Add confidence" : null,
        !row.hasTrace ? "Add trace" : null,
        row.duplicateRisk ? "Merge copy" : null,
        row.sourceLimited ? "Refresh source" : null,
      ]),
    };
  });
}

function buildAIDecisionLogRows(
  reportData: ReportData,
  diagnostics: AIReadoutDiagnostics
): AIDecisionLogRow[] {
  const actionRows = buildAIActionDecisionLogRows(reportData);
  const policyRows = buildAIReadoutPolicyDecisionLogRows(diagnostics);
  return [...actionRows, ...policyRows];
}

function buildAIDecisionLogSummary(rows: AIDecisionLogRow[]) {
  return {
    actionRows: rows.filter(row => row.decision === "Owns Action").length,
    contextRows: rows.filter(row =>
      row.decision === "Watch" || row.decision === "Support"
    ).length,
    hiddenRows: rows.filter(row =>
      row.decision === "Hide" || row.decision === "Data"
    ).length,
    mergeRows: rows.filter(row => row.decision === "Merge").length,
  };
}

function getLeagueSharpnessTone(
  profile: LeagueSharpnessProfile
): "good" | "info" | "warn" | "danger" {
  if (profile.tier === "shark-tank" || profile.tier === "sharp") return "good";
  if (profile.tier === "average") return "info";
  if (profile.tier === "casual") return "warn";
  return "danger";
}

function AdminLeagueSharpnessSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const profile = buildLeagueSharpnessProfile(reportData);
  if (!profile) return null;
  const tone = getLeagueSharpnessTone(profile);

  return (
    <CollapsibleReportSection
      title="League Sharpness Score"
      kicker="Admin eyes only"
      previewMetrics={[
        {
          label: "Score",
          value: profile.score,
          tone,
        },
        {
          label: "Samples",
          value: profile.sampleSize,
          tone: profile.confidence === "usable" ? "good" : "warn",
        },
        {
          label: "Inactive",
          value: profile.inactiveManagerCount,
          tone: profile.inactiveManagerCount ? "warn" : "good",
        },
      ]}
      premium
    >
      <div className="admin-ai-readout-diagnostics admin-league-sharpness">
        <div className="admin-league-sharpness-hero">
          <div>
            <span>{profile.label}</span>
            <strong>{profile.score}%</strong>
            <p>{profile.note}</p>
          </div>
          <div className="admin-ai-readout-chip-row">
            <em>{profile.confidence}</em>
            <em>{profile.actionBias}</em>
            <em>{profile.teamCount} teams</em>
            <em>{profile.tradeSignalsPerTeam} trades/team</em>
            <em>{profile.waiverSignalsPerTeam} waiver/team</em>
          </div>
        </div>

        <div className="admin-ai-readout-summary">
          <span>
            <strong>{profile.sampleSize}</strong>
            <em>samples</em>
          </span>
          <span>
            <strong>{profile.transactionSignalsPerTeam}</strong>
            <em>tx/team</em>
          </span>
          <span>
            <strong>{profile.tradeSignalsPerTeam}</strong>
            <em>trade/team</em>
          </span>
          <span>
            <strong>{profile.inactiveManagerCount}</strong>
            <em>inactive</em>
          </span>
        </div>

        <div className="admin-ai-readout-row-grid">
          {profile.signals.map(signal => (
            <article
              key={signal.key}
              className={`admin-ai-readout-row admin-ai-readout-row-${
                signal.status === "strong"
                  ? "good"
                  : signal.status === "building"
                    ? "warn"
                    : "danger"
              }`}
            >
              <div>
                <span>{signal.status}</span>
                <strong>{signal.label}</strong>
              </div>
              <p>{signal.note}</p>
              <div className="admin-ai-readout-chip-row">
                <em>{signal.score}%</em>
                <em>{Math.round(signal.weight * 100)}% weight</em>
              </div>
            </article>
          ))}
        </div>

        <p className="admin-ai-readout-clean">
          Sharpness now feeds the shared AI evidence layer. Strong leagues raise
          urgency on backed reads; sleepy leagues cap urgency so the app does
          not tell users to chase moves the room is unlikely to force.
        </p>
      </div>
    </CollapsibleReportSection>
  );
}

function getManagerPersonalityToneLabel(row: ManagerPersonalityIntelRow): string {
  if (row.confidence === "usable") return "usable";
  if (row.confidence === "building") return "building";
  return "thin";
}

function AdminManagerPersonalityIntelSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const rows = buildManagerPersonalityIntelRows(reportData);
  if (!rows.length) return null;
  const usableCount = rows.filter(row => row.confidence === "usable").length;
  const thinCount = rows.filter(row => row.confidence === "thin").length;
  const highestActivity = rows[0] || null;

  return (
    <CollapsibleReportSection
      title="Leaguemate Personality Intel"
      kicker="Admin eyes only"
      previewMetrics={[
        {
          label: "Managers",
          value: rows.length,
          tone: rows.length ? "info" : "warn",
        },
        {
          label: "Usable",
          value: usableCount,
          tone: usableCount ? "good" : "warn",
        },
        {
          label: "Thin",
          value: thinCount,
          tone: thinCount ? "warn" : "good",
        },
      ]}
      premium
    >
      <div className="admin-ai-readout-diagnostics admin-manager-personality-intel">
        <div className="admin-ai-readout-summary">
          <span>
            <strong>{rows.length}</strong>
            <em>profiles</em>
          </span>
          <span>
            <strong>{usableCount}</strong>
            <em>usable</em>
          </span>
          <span>
            <strong>{thinCount}</strong>
            <em>thin</em>
          </span>
          <span>
            <strong>{highestActivity?.activityScore || 0}</strong>
            <em>top activity</em>
          </span>
        </div>

        <div className="admin-schedule-edge-table-wrap">
          <table className="admin-schedule-edge-table admin-manager-personality-table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Trade Style</th>
                <th>Waiver Style</th>
                <th>Roster Habit</th>
                <th>Action Read</th>
                <th>Receipts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.manager} className={`admin-ai-readout-row-${row.tone}`}>
                  <td>
                    <strong>{row.manager}</strong>
                    <span>{row.activityScore}% activity</span>
                    <em>{getManagerPersonalityToneLabel(row)}</em>
                  </td>
                  <td>{row.tradeStyle}</td>
                  <td>{row.waiverStyle}</td>
                  <td>{row.rosterStyle}</td>
                  <td>{row.actionRead}</td>
                  <td>
                    <div className="admin-ai-readout-chip-row">
                      {row.receipts.slice(0, 4).map(receipt => (
                        <em key={`${row.manager}-${receipt}`}>{receipt}</em>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="admin-ai-readout-clean">
          This table is hidden from normal users. It is a calibration surface for
          future manager-personality models, not a public leaguemate label yet.
        </p>
      </div>
    </CollapsibleReportSection>
  );
}

function buildAIReadoutDiagnostics(reportData: ReportData) {
  const managerCount =
    reportData.managerRosterIntelligence?.length ||
    reportData.leagueOverview?.length ||
    0;
  const hasLeagueConfidence = Boolean(reportData.leagueDiagnostics?.aiConfidence);
  const hasManagerConfidence = Boolean(
    reportData.leagueDiagnostics?.aiConfidence?.managerConfidence?.length
  );
  const hasRosterIntel = Boolean(reportData.managerRosterIntelligence?.length);
  const hasRankings = Boolean(
    reportData.rankings?.profiles?.[reportData.rankings.defaultProfileKey || ""]?.length ||
      reportData.rankings?.dynastySf?.length ||
      reportData.rankings?.redraftPpr?.length
  );
  const hasMarketMovement = Boolean(
    reportData.weeklyRisers?.length || reportData.weeklyFallers?.length
  );
  const hasTrades = Boolean(
    reportData.tradeHistory?.length ||
      reportData.tradeTendencies?.length ||
      reportData.tradeProposalSignals?.length
  );
  const hasWaivers = Boolean(
    reportData.waiverIntelligence?.availableTrendingAdds?.length ||
      reportData.recentTransactions?.length
  );
  const hasScheduleContext = Boolean(
    reportData.matchupPreviews?.length ||
      reportData.schedulePlanning?.rosterGaps?.length ||
      reportData.schedulePlanning?.streamerCandidates?.length ||
      reportData.schedulePlanning?.byeWeekNotes?.length
  );
  const hasDraftContext = Boolean(
    reportData.draftPicks?.length || reportData.draftStats?.length
  );
  const situationDeltas = Object.values(reportData.playerDetailsById || {})
    .map(details => details.playerSituationDelta)
    .filter(Boolean);
  const freshSituationDeltas = situationDeltas.filter(delta =>
    delta?.freshness?.grade === "fresh" || delta?.freshness?.grade === "usable"
  );
  const staleSituationDeltas = situationDeltas.filter(delta =>
    delta?.freshness?.grade === "stale" || delta?.freshness?.grade === "missing"
  );

  const rows = [
    buildAIReadoutRow({
      id: "overview-pulse",
      tab: "Overview",
      surface: "Overview Pulse",
      owner: "League story",
      count: 1,
      hasConfidence: hasLeagueConfidence,
      hasTrace: true,
      duplicateRisk: false,
      sourceLimited: !hasRosterIntel,
      note: hasRosterIntel
        ? "Story only; metrics stay elsewhere."
        : "Limited until roster intel returns.",
    }),
    buildAIReadoutRow({
      id: "overview-blueprint",
      tab: "Overview",
      surface: "Monthly Blueprint",
      owner: "Long plan",
      count: managerCount ? 1 : 0,
      hasConfidence: hasLeagueConfidence || hasManagerConfidence,
      hasTrace: Boolean(reportData.monthlyBlueprintSnapshot || hasRosterIntel),
      duplicateRisk: false,
      sourceLimited: false,
      note: reportData.monthlyBlueprintSnapshot
        ? "Uses stored blueprint context."
        : "Using current report data.",
    }),
    buildAIReadoutRow({
      id: "overview-power",
      tab: "Overview",
      surface: "Power Rankings",
      owner: "League order",
      count: reportData.powerRankings?.length || 0,
      hasConfidence: hasManagerConfidence || hasLeagueConfidence,
      hasTrace: Boolean(reportData.powerRankings?.length),
      duplicateRisk: false,
      sourceLimited: !reportData.powerRankings?.length,
      note: "Rankings only; roster/trade reads live elsewhere.",
    }),
    buildAIReadoutRow({
      id: "overview-recon",
      tab: "Overview",
      surface: "Roster Recon",
      owner: "Roster health",
      count: managerCount ? 1 : 0,
      hasConfidence: hasManagerConfidence || hasLeagueConfidence,
      hasTrace: hasRosterIntel,
      duplicateRisk: false,
      sourceLimited: !hasRosterIntel,
      note: "Strengths, gaps, and next roster move.",
    }),
    buildAIReadoutRow({
      id: "overview-trades",
      tab: "Overview",
      surface: "Trade Finder",
      owner: "Trade fit",
      count: Math.max(0, managerCount ? managerCount : 0),
      hasConfidence: hasManagerConfidence || hasLeagueConfidence,
      hasTrace: hasRosterIntel,
      duplicateRisk: false,
      sourceLimited: false,
      note: hasTrades
        ? "Partners, packages, gaps, and outcomes."
        : "Uses roster fit when trade history is thin.",
    }),
    buildAIReadoutRow({
      id: "autopilot-actions",
      tab: "AI Autopilot",
      surface: "Action Queue",
      owner: "Actions",
      count: hasRosterIntel ? Math.min(6, Math.max(1, managerCount + 2)) : 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasRosterIntel,
      duplicateRisk: false,
      sourceLimited: false,
      note: hasScheduleContext || freshSituationDeltas.length
        ? "Uses schedule, roster, waiver, trade, and player context."
        : "Roster-first until matchup/player data is stable.",
    }),
    buildAIReadoutRow({
      id: "schedule-edge",
      tab: "Schedule",
      surface: "Schedule Edge",
      owner: "SOS/matchups",
      count: hasScheduleContext ? 1 : 0,
      hasConfidence: hasScheduleContext && hasLeagueConfidence,
      hasTrace: hasScheduleContext,
      duplicateRisk: false,
      sourceLimited: !hasScheduleContext,
      note: hasScheduleContext
        ? "DraftSharks-first support read."
        : "Hidden until schedule context returns.",
    }),
    buildAIReadoutRow({
      id: "player-situation",
      tab: "Player Detail",
      surface: "Player Situation",
      owner: "Player role",
      count: situationDeltas.length,
      hasConfidence: situationDeltas.length > 0,
      hasTrace: situationDeltas.some(delta => Boolean(delta?.trace?.length || delta?.dynamicSignals?.length)),
      duplicateRisk: false,
      sourceLimited: !freshSituationDeltas.length || staleSituationDeltas.length > freshSituationDeltas.length,
      note: situationDeltas.length
        ? `${freshSituationDeltas.length}/${situationDeltas.length} fresh; ${staleSituationDeltas.length} stale.`
        : "No player situation payload.",
    }),
    buildAIReadoutRow({
      id: "momentum-waivers",
      tab: "Momentum",
      surface: "Waivers",
      owner: "Claims/drops",
      count: reportData.waiverIntelligence?.availableTrendingAdds?.length || 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasWaivers,
      duplicateRisk: false,
      sourceLimited: !hasWaivers,
      note: hasWaivers
        ? "Players, drops, transactions, and needs."
        : "No waiver/transaction payload.",
    }),
    buildAIReadoutRow({
      id: "momentum-market",
      tab: "Momentum",
      surface: "Market Radar",
      owner: "Buy/sell",
      count: (reportData.weeklyRisers?.length || 0) + (reportData.weeklyFallers?.length || 0),
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasMarketMovement,
      duplicateRisk: false,
      sourceLimited: !hasMarketMovement,
      note: hasMarketMovement
        ? "Weekly value movement."
        : "No riser/faller payload.",
    }),
    buildAIReadoutRow({
      id: "rankings-market",
      tab: "Rankings",
      surface: "Ranking Signal",
      owner: "Board market",
      count: hasRankings ? 1 : 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasRankings,
      duplicateRisk: false,
      sourceLimited: !hasRankings,
      note: hasRankings
        ? "Board-level value movement."
        : "Ranking rows missing/loading.",
    }),
    buildAIReadoutRow({
      id: "trade-browser",
      tab: "Trade History",
      surface: "Trade Browser",
      owner: "Trade ledger",
      count: hasTrades ? 1 : 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasTrades,
      duplicateRisk: false,
      sourceLimited: false,
      note: hasTrades
        ? "Ledger size, gaps, tendencies, and outcomes."
        : "No trade-history payload.",
    }),
    buildAIReadoutRow({
      id: "draft-history",
      tab: "Draft",
      surface: "Draft Capital",
      owner: "Draft runway",
      count: hasDraftContext ? 1 : 0,
      hasConfidence: hasLeagueConfidence,
      hasTrace: hasDraftContext,
      duplicateRisk: false,
      sourceLimited: !hasDraftContext,
      note: hasDraftContext
        ? "Draft slot, runway, and hit context."
        : "Hidden until draft payload returns.",
    }),
  ];

  const totalReadouts = rows.reduce((sum, row) => sum + row.count, 0);
  const missingConfidence = rows.filter(row => row.count > 0 && !row.hasConfidence).length;
  const missingTrace = rows.filter(row => row.count > 0 && !row.hasTrace).length;
  const duplicateRisk = rows.filter(row => row.duplicateRisk).length;
  const sourceLimited = rows.filter(row => row.count > 0 && row.sourceLimited).length;
  const tabSummaries = Array.from(
    rows.reduce((map, row) => {
      const current = map.get(row.tab) || {
        tab: row.tab,
        count: 0,
        warnings: 0,
      };
      current.count += row.count;
      if (
        row.count > 0 &&
        (!row.hasConfidence || !row.hasTrace || row.duplicateRisk)
      ) {
        current.warnings += 1;
      }
      map.set(row.tab, current);
      return map;
    }, new Map<string, { tab: string; count: number; warnings: number }>())
  ).map(([, summary]) => summary);

  return {
    rows,
    tabSummaries,
    totalReadouts,
    missingConfidence,
    missingTrace,
    duplicateRisk,
    sourceLimited,
  };
}

function AdminAIReadoutDiagnosticsSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const diagnostics = buildAIReadoutDiagnostics(reportData);
  const registry = buildAISurfaceRegistry(diagnostics);
  const decisionLogRows = buildAIDecisionLogRows(reportData, diagnostics);
  const decisionLogSummary = buildAIDecisionLogSummary(decisionLogRows);
  const flaggedRows = diagnostics.rows.filter(
    row =>
      row.count > 0 &&
      (!row.hasConfidence || !row.hasTrace || row.duplicateRisk)
  );
  if (!flaggedRows.length && !decisionLogRows.length) return null;

  return (
    <CollapsibleReportSection
      title="AI Readout QA"
      kicker="Ownership and evidence"
      previewMetrics={[
        {
          label: "Rows",
          value: decisionLogRows.length,
          tone: decisionLogRows.length ? "info" : "warn",
        },
        {
          label: "Owner",
          value: registry.actionOwners,
          tone: registry.actionOwners === 1 ? "good" : "warn",
        },
        {
          label: "Needs Work",
          value: registry.hiddenRows + registry.mergeRows,
          tone: registry.hiddenRows || registry.mergeRows ? "warn" : "good",
        },
      ]}
      premium
    >
      <div className="admin-ai-readout-diagnostics">
        <div className="admin-ai-readout-summary">
          <span>
            <strong>{diagnostics.totalReadouts}</strong>
            <em>observed</em>
          </span>
          <span>
            <strong>{diagnostics.missingConfidence}</strong>
            <em>no confidence</em>
          </span>
          <span>
            <strong>{diagnostics.missingTrace}</strong>
            <em>no trace</em>
          </span>
          <span>
            <strong>{diagnostics.duplicateRisk}</strong>
            <em>dupes</em>
          </span>
          <span>
            <strong>{diagnostics.sourceLimited}</strong>
            <em>limited</em>
          </span>
        </div>

        <div className="admin-ai-readout-tab-grid" aria-label="AI readout count by tab">
          {diagnostics.tabSummaries.map(summary => (
            <article key={summary.tab}>
              <span>{summary.tab}</span>
              <strong>{summary.count}</strong>
              <em>{summary.warnings} flag{summary.warnings === 1 ? "" : "s"}</em>
            </article>
          ))}
        </div>

        <section
          className="admin-ai-surface-registry"
          aria-label="AI surface registry"
        >
          <div className="admin-ai-surface-registry-head">
            <div>
              <span>Surface Rules</span>
              <strong>One owner. Others support.</strong>
              <p>Shows what can act, explain, hide, or merge.</p>
            </div>
            <div className="admin-ai-surface-registry-metrics">
              <span>
                <strong>{registry.actionOwners}</strong>
                <em>owner</em>
              </span>
              <span>
                <strong>{registry.contextRows}</strong>
                <em>support</em>
              </span>
              <span>
                <strong>{registry.hiddenRows}</strong>
                <em>hidden</em>
              </span>
              <span>
                <strong>{registry.mergeRows}</strong>
                <em>merge</em>
              </span>
            </div>
          </div>

          <div className="admin-ai-surface-registry-grid">
            {registry.rows.map(row => (
              <article
                key={row.id}
                className={`admin-ai-surface-registry-row admin-ai-surface-registry-row-${row.role} admin-ai-readout-row-${row.tone}`}
              >
                <div className="admin-ai-surface-registry-row-head">
                  <span>{row.tab}</span>
                  <strong>{row.surface}</strong>
                  <em>{row.roleLabel}</em>
                </div>
                <div className="admin-ai-surface-registry-body">
                  <p>{row.noiseRule}</p>
                  <p>{row.nextStep}</p>
                </div>
                <div className="admin-ai-surface-registry-receipts">
                  <span>Own: {row.owner}</span>
                  <span>{row.visibility}</span>
                  <span>{row.allowedClaim}</span>
                  <span>{row.evidenceStatus}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="admin-ai-decision-log"
          aria-label="AI decision log rows"
        >
          <div className="admin-ai-decision-log-head">
            <div>
              <span>Rules Log</span>
              <strong>Own, support, hide, or merge.</strong>
              <p>Quick check for noisy or unsupported AI cards.</p>
            </div>
            <div className="admin-ai-decision-log-metrics">
              <span>
                <strong>{decisionLogSummary.actionRows}</strong>
                <em>owner</em>
              </span>
              <span>
                <strong>{decisionLogSummary.contextRows}</strong>
                <em>support</em>
              </span>
              <span>
                <strong>{decisionLogSummary.hiddenRows}</strong>
                <em>hidden</em>
              </span>
              <span>
                <strong>{decisionLogSummary.mergeRows}</strong>
                <em>merge</em>
              </span>
            </div>
          </div>

          <div className="admin-ai-decision-log-grid">
            {decisionLogRows.map(row => (
              <article
                key={row.id}
                className={`admin-ai-decision-log-row admin-ai-readout-row-${row.tone}`}
              >
                <div className="admin-ai-decision-log-row-head">
                  <span>{row.lane}</span>
                  <strong>{row.surface}</strong>
                  <em>{row.decision}</em>
                </div>
                <p>{row.why}</p>
                <div className="admin-ai-decision-log-receipts">
                  <span>Own: {row.owner}</span>
                  <span>Conf: {row.confidence}</span>
                  {row.receipts.map(receipt => (
                    <span key={receipt}>{receipt}</span>
                  ))}
                </div>
                {(row.blockers.length > 0 ||
                  row.missingEvidence.length > 0 ||
                  row.changeTriggers.length > 0) && (
                  <div className="admin-ai-decision-log-lists">
                    {row.blockers.length > 0 && (
                      <div>
                        <span>Blocks</span>
                        {row.blockers.map(blocker => (
                          <p key={blocker}>{blocker}</p>
                        ))}
                      </div>
                    )}
                    {row.missingEvidence.length > 0 && (
                      <div>
                        <span>Missing</span>
                        {row.missingEvidence.map(item => (
                          <p key={item}>{item}</p>
                        ))}
                      </div>
                    )}
                    {row.changeTriggers.length > 0 && (
                      <div>
                        <span>Changes</span>
                        {row.changeTriggers.map(item => (
                          <p key={item}>{item}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {flaggedRows.length > 0 ? (
          <section
            className="admin-ai-readout-flag-panel"
            aria-label="AI readout coverage flags"
          >
            <div>
              <span>Flags</span>
              <strong>
                {flaggedRows.length} to review
              </strong>
            </div>
            <div className="admin-ai-readout-row-grid">
              {flaggedRows.map(row => (
                <article
                  key={row.id}
                  className={`admin-ai-readout-row admin-ai-readout-row-${row.tone}`}
                >
                  <div>
                    <span>{row.tab}</span>
                    <strong>{row.surface}</strong>
                  </div>
                  <p>{row.note}</p>
                  <div className="admin-ai-readout-chip-row">
                    <em>{row.owner}</em>
                    {!row.hasConfidence && <em>No confidence</em>}
                    {!row.hasTrace && <em>No trace</em>}
                    {row.duplicateRisk && <em>Dupe</em>}
                    {row.sourceLimited && <em>Limited</em>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <p className="admin-ai-readout-clean">
            All observed readouts have confidence, trace, and no duplicate flags.
          </p>
        )}
      </div>
    </CollapsibleReportSection>
  );
}

type ReceiptDiagnosticTone = "good" | "info" | "warn" | "danger";

type PlayerReceiptDiagnosticRow = {
  id: string;
  name: string;
  position: string;
  value: number | null;
  status: "Visible" | "Internal" | "No bucket";
  tone: ReceiptDiagnosticTone;
  bucket: string;
  recommendation: string;
  sampleSize: number | null;
  confidenceGrade: string;
  improvedOrSustainedRate: number | null;
  materialFailureRate: number | null;
  medianNextProductionDelta: number | null;
  reason: string;
  guardrails: string[];
};

type ReceiptBucketSummary = {
  key: string;
  label: string;
  recommendation: string;
  confidenceGrade: string;
  sampleSize: number;
  visibleCount: number;
  internalCount: number;
  tone: ReceiptDiagnosticTone;
};

function getPlayerDiagnosticValue(details: PlayerDetails): number | null {
  const profile = details.valueProfile;
  const values = [
    profile?.dynastyValue,
    profile?.seasonValue,
    profile?.balancedValue,
    profile?.marketKtc,
    profile?.fantasyCalcDynasty,
    profile?.fantasyCalcRedraft,
  ]
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0);
  return values.length ? Math.max(...values) : null;
}

function hasPlayerExternalIdentity(details: PlayerDetails): boolean {
  return Boolean(
    details.externalIds?.gsis ||
      details.externalIds?.pfr ||
      details.externalIds?.espn ||
      details.externalIds?.fantasyPros
  );
}

function getPlayerReceiptGuardrails(details: PlayerDetails): string[] {
  const guardrails: string[] = [];
  const value = getPlayerDiagnosticValue(details);
  const cohort = details.playerCohort;

  if (!hasPlayerExternalIdentity(details)) guardrails.push("missing cross-source ID");
  if (!details.usageTrend) guardrails.push("missing usage trend");
  if (
    details.lastSeasonPointsPerGame === null ||
    details.lastSeasonPointsPerGame === undefined
  ) {
    guardrails.push("missing production baseline");
  }
  if (value === null) guardrails.push("missing value baseline");
  if (cohort?.calibration?.evidenceGrade === "blocked") {
    guardrails.push("cohort evidence blocked");
  }
  if (!details.team && !details.nflDraftTeam) guardrails.push("missing NFL team context");
  if (
    value !== null &&
    value < 300 &&
    !details.usageTrend &&
    !hasPlayerExternalIdentity(details)
  ) {
    guardrails.push("low-value/noise candidate");
  }

  return Array.from(new Set(guardrails));
}

function getReceiptHiddenReason(
  details: PlayerDetails,
  guardrails: string[]
): string {
  const receipt = details.playerCohort?.seasonOutcomeReceipt;
  const calibration = details.playerCohort?.calibration;

  if (!receipt) {
    return guardrails.length
      ? `No calibrated production/role bucket matched; guardrails: ${guardrails.join(", ")}.`
      : "No calibrated production/role bucket matched the current player card inputs.";
  }
  if (receipt.displayEligible) {
    return "Visible because the bucket is non-neutral, sample-backed, usable/strong confidence, and the player evidence is not blocked.";
  }
  if (receipt.sampleSize < 14) {
    return `Internal only because ${receipt.sampleSize} historical samples is below the 14-sample visible threshold.`;
  }
  if (receipt.confidenceGrade === "thin" || receipt.confidenceGrade === "blocked") {
    return `Internal only because the bucket confidence grade is ${receipt.confidenceGrade}.`;
  }
  if (receipt.recommendation === "neutral") {
    return "Internal only because the historical bucket is neutral.";
  }
  if (calibration?.evidenceGrade === "blocked") {
    return "Internal only because the player-level cohort evidence is blocked.";
  }
  if (
    (receipt.recommendation === "amplify" ||
      receipt.recommendation === "lean-positive") &&
    !calibration?.strongReadEligible
  ) {
    return "Internal only because positive receipts require strong-read eligibility.";
  }
  return receipt.note || "Internal only until the receipt passes every display gate.";
}

function getReceiptDiagnosticTone(
  row: Pick<PlayerReceiptDiagnosticRow, "status" | "materialFailureRate" | "recommendation" | "guardrails">
): ReceiptDiagnosticTone {
  if (row.guardrails.includes("low-value/noise candidate") || row.guardrails.includes("cohort evidence blocked")) return "danger";
  if (row.recommendation === "fade-risk" || (row.materialFailureRate || 0) >= 45) return "warn";
  if (row.status === "Visible") return "good";
  if (row.guardrails.length) return "warn";
  return "info";
}

function formatReceiptRate(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return `${value}%`;
}

function formatReceiptDelta(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value}`;
}

function buildPlayerReceiptDiagnostics(reportData: ReportData): {
  rows: PlayerReceiptDiagnosticRow[];
  receiptRows: PlayerReceiptDiagnosticRow[];
  guardrailRows: PlayerReceiptDiagnosticRow[];
  bucketSummaries: ReceiptBucketSummary[];
  totals: {
    players: number;
    withReceipt: number;
    visible: number;
    internal: number;
    noBucket: number;
    guardrails: number;
  };
} {
  const rows = Object.entries(reportData.playerDetailsById || {})
    .map(([playerId, details]) => {
      const receipt = details.playerCohort?.seasonOutcomeReceipt || null;
      const guardrails = getPlayerReceiptGuardrails(details);
      const status: PlayerReceiptDiagnosticRow["status"] = receipt
        ? receipt.displayEligible
          ? "Visible"
          : "Internal"
        : "No bucket";
      const row: PlayerReceiptDiagnosticRow = {
        id: playerId,
        name: details.fullName || playerId,
        position: details.position || "N/A",
        value: getPlayerDiagnosticValue(details),
        status,
        tone: "info",
        bucket: receipt?.label || "No calibrated bucket",
        recommendation: receipt?.recommendation || "n/a",
        sampleSize: receipt?.sampleSize ?? null,
        confidenceGrade: receipt?.confidenceGrade || "n/a",
        improvedOrSustainedRate: receipt?.improvedOrSustainedRate ?? null,
        materialFailureRate: receipt?.materialFailureRate ?? null,
        medianNextProductionDelta: receipt?.medianNextProductionDelta ?? null,
        reason: getReceiptHiddenReason(details, guardrails),
        guardrails,
      };
      return {
        ...row,
        tone: getReceiptDiagnosticTone(row),
      };
    })
    .sort(
      (a, b) =>
        (a.status === "Visible" ? 0 : a.status === "Internal" ? 1 : 2) -
          (b.status === "Visible" ? 0 : b.status === "Internal" ? 1 : 2) ||
        b.guardrails.length - a.guardrails.length ||
        a.name.localeCompare(b.name)
    );

  const receiptRows = rows.filter(row => row.status !== "No bucket");
  const guardrailRows = receiptRows.filter(row => row.guardrails.length > 0);
  const bucketMap = new Map<string, ReceiptBucketSummary>();
  receiptRows.forEach(row => {
    const key = `${row.bucket}:${row.recommendation}:${row.confidenceGrade}:${row.sampleSize ?? "n/a"}`;
    const current =
      bucketMap.get(key) ||
      {
        key,
        label: row.bucket,
        recommendation: row.recommendation,
        confidenceGrade: row.confidenceGrade,
        sampleSize: row.sampleSize || 0,
        visibleCount: 0,
        internalCount: 0,
        tone: row.tone,
      };
    if (row.status === "Visible") current.visibleCount += 1;
    if (row.status === "Internal") current.internalCount += 1;
    if (row.tone === "danger" || (row.tone === "warn" && current.tone !== "danger")) {
      current.tone = row.tone;
    }
    bucketMap.set(key, current);
  });

  return {
    rows,
    receiptRows,
    guardrailRows,
    bucketSummaries: Array.from(bucketMap.values()).sort(
      (a, b) =>
        b.visibleCount - a.visibleCount ||
        b.internalCount - a.internalCount ||
        b.sampleSize - a.sampleSize ||
        a.label.localeCompare(b.label)
    ),
    totals: {
      players: rows.length,
      withReceipt: receiptRows.length,
      visible: rows.filter(row => row.status === "Visible").length,
      internal: rows.filter(row => row.status === "Internal").length,
      noBucket: rows.filter(row => row.status === "No bucket").length,
      guardrails: guardrailRows.length,
    },
  };
}

function AdminPlayerReceiptDiagnosticsSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const diagnostics = buildPlayerReceiptDiagnostics(reportData);
  if (!diagnostics.guardrailRows.length) return null;

  return (
    <CollapsibleReportSection
      title="Player Receipt Audit"
      kicker="Historical receipt display gates and bad-read guardrails"
      previewMetrics={[
        {
          label: "Players",
          value: diagnostics.totals.players,
          tone: diagnostics.totals.players ? "info" : "warn",
        },
        {
          label: "Visible",
          value: diagnostics.totals.visible,
          tone: diagnostics.totals.visible ? "good" : "info",
        },
        {
          label: "Guardrails",
          value: diagnostics.totals.guardrails,
          tone: diagnostics.totals.guardrails ? "warn" : "good",
        },
      ]}
      premium
    >
      <div className="admin-ai-readout-diagnostics admin-player-receipt-diagnostics">
        <div className="admin-ai-readout-summary">
          <span>
            <strong>{diagnostics.totals.players}</strong>
            <em>players checked</em>
          </span>
          <span>
            <strong>{diagnostics.totals.withReceipt}</strong>
            <em>bucket matches</em>
          </span>
          <span>
            <strong>{diagnostics.totals.visible}</strong>
            <em>visible receipts</em>
          </span>
          <span>
            <strong>{diagnostics.totals.internal}</strong>
            <em>internal receipts</em>
          </span>
          <span>
            <strong>{diagnostics.totals.guardrails}</strong>
            <em>guardrail flags</em>
          </span>
        </div>

        {diagnostics.guardrailRows.length > 0 && (
          <div className="admin-ai-readout-surface-grid" aria-label="Player receipt guardrail rows">
            {diagnostics.guardrailRows.map(row => (
              <article
                key={row.id}
                className={`admin-ai-readout-row admin-ai-readout-row-${row.tone}`}
              >
                <div>
                  <span>{row.status}</span>
                  <strong>{row.name} · {row.position}</strong>
                </div>
                <p>{row.reason}</p>
                <div className="admin-ai-readout-chip-row">
                  <em>{row.bucket}</em>
                  <em>{row.recommendation}</em>
                  <em>{row.confidenceGrade}</em>
                  <em>{row.sampleSize ?? "n/a"} samples</em>
                  {row.guardrails.map(flag => (
                    <em key={flag}>{flag}</em>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}

        {diagnostics.guardrailRows.length > 0 ? (
          <section
            className="admin-ai-readout-flag-panel"
            aria-label="Player receipt guardrail flags"
          >
            <div>
              <span>Guardrail Flags</span>
              <strong>
                {diagnostics.guardrailRows.length} player
                {diagnostics.guardrailRows.length === 1 ? "" : "s"} need review before stronger reads
              </strong>
            </div>
            <div className="admin-ai-readout-row-grid">
              {diagnostics.guardrailRows.slice(0, 24).map(row => (
                <article
                  key={`guardrail-${row.id}`}
                  className={`admin-ai-readout-row admin-ai-readout-row-${row.tone}`}
                >
                  <div>
                    <span>{row.status}</span>
                    <strong>{row.name} · {row.position}</strong>
                  </div>
                  <p>{row.reason}</p>
                  <div className="admin-ai-readout-chip-row">
                    {row.guardrails.map(flag => (
                      <em key={flag}>{flag}</em>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <p className="admin-ai-readout-clean">
            No player receipt guardrails fired for this payload.
          </p>
        )}
      </div>
    </CollapsibleReportSection>
  );
}

function AdminAttentionBadge({
  count,
  label,
  tone = "warn",
}: {
  count: number;
  label: string;
  tone?: "warn" | "danger" | "info";
}) {
  if (!Number.isFinite(count) || count <= 0) return null;

  return (
    <span
      className={`admin-attention-badge admin-attention-badge-${tone}`}
      aria-label={`${count} ${label}`}
    >
      <strong>{count > 99 ? "99+" : count.toLocaleString()}</strong>
      <em>{label}</em>
    </span>
  );
}

function AdminValueDiagnosticsSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const { data } = trpc.system.snapshotCoverage.useQuery(
    { lookbackDays: 14 },
    { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5 }
  );
  const rows = buildAdminValueDiagnostics(
    reportData,
    getActionableMissingSnapshotDates(data)
  );
  const priorityRows = rows
    .filter(isPriorityAdminDiagnosticRow)
    .sort(compareAdminDiagnosticPriority);
  const emptySourceRows = rows
    .filter(isInformationalEmptySourceRow)
    .sort(compareAdminDiagnosticPriority);
  if (!priorityRows.length && !emptySourceRows.length) return null;
  const attentionSummary = {
    count: priorityRows.length,
    tone: priorityRows.some(row => row.tone === "danger") ? "danger" as const : "warn" as const,
  };

  return (
    <CollapsibleReportSection
      title="Value Source Health"
      kicker="Actionable flags and 0-row sources"
      previewAccessory={
        attentionSummary.count > 0 ? (
          <AdminAttentionBadge
            count={attentionSummary.count}
            label="Needs attention"
            tone={attentionSummary.tone}
          />
        ) : emptySourceRows.length > 0 ? (
          <AdminAttentionBadge
            count={emptySourceRows.length}
            label="0-row sources"
            tone="info"
          />
        ) : undefined
      }
      premium
      defaultOpen
    >
      <AdminValueDiagnosticsTable
        reportData={reportData}
        rows={rows}
        priorityRows={priorityRows}
        emptySourceRows={emptySourceRows}
      />
    </CollapsibleReportSection>
  );
}

const SCHEDULE_EDGE_SORT_OPTIONS: Array<{
  value: ScheduleEdgeSortMode;
  label: string;
}> = [
  { value: "easiest", label: "Easiest" },
  { value: "toughest", label: "Toughest" },
  { value: "rank", label: "Rank" },
];

const SCHEDULE_EDGE_WEEK_OPTIONS = Array.from(
  { length: 18 },
  (_, index) => index + 1
);

function getScheduleEdgeWeekTone(week: WaiverWeeklyEcrWeek): ScheduleEdgeTone {
  if (week.isBye) return "warn";
  if (week.matchupTier === "easy" || Number(week.matchupStars || 0) >= 4)
    return "good";
  if (
    week.matchupTier === "hard" ||
    (typeof week.matchupStars === "number" && week.matchupStars <= 2)
  )
    return "danger";
  return "info";
}

function getScheduleEdgeWeekSite(week: WaiverWeeklyEcrWeek): string {
  if (week.homeAway === "home") return "vs";
  if (week.homeAway === "away") return "at";
  return "";
}

function getScheduleEdgeWeekStarCount(week: WaiverWeeklyEcrWeek): number | null {
  if (
    typeof week.matchupStars !== "number" ||
    !Number.isFinite(week.matchupStars)
  ) {
    return null;
  }
  return Math.max(1, Math.min(5, Math.round(week.matchupStars)));
}

function ScheduleEdgePlayerCell({ row }: { row: ScheduleEdgeRow }) {
  const isDefenseRow = row.position === "DEF" && row.team;
  const rankBadge = row.seasonRankNumber
    ? `#${row.seasonRankNumber}`
    : row.seasonRank || row.bestRank;

  return (
    <div
      className={[
        "admin-schedule-player-cell",
        isDefenseRow ? "admin-schedule-player-cell-defense" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={row.player.name}
      title={row.player.name}
    >
      {row.team && (
        <TeamLogoPill
          team={row.team}
          className="admin-schedule-player-logo"
        />
      )}
      <div className="admin-schedule-player-copy">
        <span className="admin-schedule-player-rankline">
          <span className="admin-schedule-player-rank-pill">
            {rankBadge}
          </span>
          <span className="admin-schedule-player-rank-source">
            {row.seasonRank ? "Current-season rank" : "Source rank"}
          </span>
        </span>
        <strong>{row.player.name}</strong>
        <span>{[row.position, row.team].filter(Boolean).join(" · ")}</span>
      </div>
    </div>
  );
}

function ScheduleEdgeWeekChip({
  rowId,
  week,
}: {
  rowId: string;
  week: WaiverWeeklyEcrWeek;
}) {
  const starCount = getScheduleEdgeWeekStarCount(week);
  const site = getScheduleEdgeWeekSite(week);
  const titleParts = [
    `Week ${week.week}`,
    week.isBye
      ? "Bye"
      : [site, week.opponent].filter(Boolean).join(" ") || "Opponent TBD",
    starCount ? `${starCount} star matchup` : "Unrated matchup",
    typeof week.opponentRank === "number"
      ? `Opponent rank #${week.opponentRank}`
      : null,
  ].filter(Boolean);

  return (
    <span
      className={`admin-schedule-week-chip admin-schedule-week-chip-${getScheduleEdgeWeekTone(week)}`}
      title={titleParts.join(" - ")}
    >
      <strong>W{week.week}</strong>
      {week.isBye ? (
        <span className="admin-schedule-week-bye">Bye</span>
      ) : (
        <span className="admin-schedule-week-opponent">
          {site && <span className="admin-schedule-week-site">{site}</span>}
          {week.opponent ? (
            <TeamLogoPill
              team={week.opponent}
              className="admin-schedule-opponent-logo"
            />
          ) : (
            <span className="admin-schedule-week-tbd">TBD</span>
          )}
        </span>
      )}
      {starCount ? (
        <span
          className="admin-schedule-week-stars"
          aria-label={`${starCount} star matchup`}
        >
          {Array.from({ length: starCount }, (_, index) => (
            <span key={`${rowId}-${week.week}-star-${index}`} aria-hidden="true">
              ★
            </span>
          ))}
        </span>
      ) : (
        <span className="admin-schedule-week-unrated">Unrated</span>
      )}
    </span>
  );
}

function AdminScheduleEdgeSection({
  reportData,
}: {
  reportData: ReportData;
}) {
  const [positionFilter, setPositionFilter] =
    useState<ScheduleEdgePositionFilter>("ALL");
  const [sortMode, setSortMode] = useState<ScheduleEdgeSortMode>("easiest");
  const [weekStart, setWeekStart] = useState(1);
  const [weekEnd, setWeekEnd] = useState(4);
  const rows = useMemo(() => buildScheduleEdgeRows(reportData), [reportData]);
  const healthRows = useMemo(
    () => buildScheduleSnapshotHealthRows(reportData),
    [reportData]
  );
  const selectedRange = useMemo(
    () => normalizeScheduleEdgeWeekRange({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  );
  const healthPositions = SCHEDULE_EDGE_POSITION_FILTERS.filter(
    (position): position is Exclude<ScheduleEdgePositionFilter, "ALL"> =>
      position !== "ALL"
  );
  const filteredRows = useMemo(
    () =>
      positionFilter === "ALL"
        ? rows
        : rows.filter(row => row.position === positionFilter),
    [positionFilter, rows]
  );
  const visibleRows = useMemo(
    () => sortScheduleEdgeRows(filteredRows, selectedRange, sortMode),
    [filteredRows, selectedRange, sortMode]
  );
  const loadedPositions = new Set(rows.map(row => row.position));
  const sourceWarningCount = rows.filter(
    row => row.sourceTone === "warn" || row.sourceTone === "danger"
  ).length;
  const healthIssueCount = healthRows.reduce(
    (count, row) =>
      count +
      Object.values(row.cells).filter(
        cell => cell?.tone === "warn" || cell?.tone === "danger"
      ).length,
    0
  );
  const issueCount = healthIssueCount + sourceWarningCount;
  const rangeTrackStyle = {
    "--range-start": `${((selectedRange.start - 1) / 17) * 100}%`,
    "--range-end": `${((selectedRange.end - 1) / 17) * 100}%`,
  } as CSSProperties;

  if (!rows.length && !healthRows.length) return null;

  return (
    <CollapsibleReportSection
      title="Schedule Edge Table"
      kicker="DraftSharks SOS windows"
      previewAccessory={
        issueCount > 0 ? (
          <AdminAttentionBadge
            count={issueCount}
            label="Snapshot issues"
            tone={healthRows.some(row =>
              Object.values(row.cells).some(cell => cell?.tone === "danger")
            ) || rows.some(row => row.sourceTone === "danger") ? "danger" : "warn"}
          />
        ) : undefined
      }
      premium
      defaultOpen
    >
      <div className="admin-schedule-edge">
        <div className="admin-schedule-edge-controls">
          <div className="admin-schedule-edge-control-group">
            <span className="admin-schedule-edge-control-label">
              Position
            </span>
            <div className="admin-schedule-edge-toolbar" aria-label="Schedule edge filters">
              {SCHEDULE_EDGE_POSITION_FILTERS.map(position => {
                const disabled = position !== "ALL" && !loadedPositions.has(position);
                return (
                  <button
                    key={position}
                    type="button"
                    className={
                      positionFilter === position
                        ? "admin-schedule-edge-filter admin-schedule-edge-filter-active"
                        : "admin-schedule-edge-filter"
                    }
                    disabled={disabled}
                    onClick={() => setPositionFilter(position)}
                  >
                    {position === "ALL" ? "All" : position}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="admin-schedule-edge-control-group admin-schedule-edge-range-group">
            <div className="admin-schedule-edge-control-heading">
              <span className="admin-schedule-edge-control-label">Weeks</span>
              <strong>{selectedRange.start === selectedRange.end
                ? `Week ${selectedRange.start}`
                : `Weeks ${selectedRange.start}-${selectedRange.end}`}</strong>
            </div>
            <div
              className="admin-schedule-range-slider"
              style={rangeTrackStyle}
            >
              <input
                type="range"
                min={1}
                max={18}
                value={selectedRange.start}
                aria-label="Start week"
                onChange={event => {
                  const next = Number(event.currentTarget.value);
                  setWeekStart(next);
                  if (next > weekEnd) setWeekEnd(next);
                }}
              />
              <input
                type="range"
                min={1}
                max={18}
                value={selectedRange.end}
                aria-label="End week"
                onChange={event => {
                  const next = Number(event.currentTarget.value);
                  setWeekEnd(next);
                  if (next < weekStart) setWeekStart(next);
                }}
              />
            </div>
            <div
              className="admin-schedule-week-ticks"
              aria-label="Weeks 1 through 18"
            >
              {SCHEDULE_EDGE_WEEK_OPTIONS.map(week => {
                const isSelected =
                  week >= selectedRange.start && week <= selectedRange.end;
                const isEdge =
                  week === selectedRange.start || week === selectedRange.end;
                return (
                  <span
                    key={week}
                    className={[
                      "admin-schedule-week-tick",
                      isSelected ? "admin-schedule-week-tick-selected" : "",
                      isEdge ? "admin-schedule-week-tick-edge" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {week}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="admin-schedule-edge-control-group">
            <span className="admin-schedule-edge-control-label">Sort</span>
            <div className="admin-schedule-edge-toolbar" aria-label="Schedule edge sort">
              {SCHEDULE_EDGE_SORT_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={
                  sortMode === option.value
                    ? "admin-schedule-edge-filter admin-schedule-edge-filter-active"
                    : "admin-schedule-edge-filter"
                }
                onClick={() => setSortMode(option.value)}
              >
                {option.label}
              </button>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-schedule-edge-count">
          <strong>{visibleRows.length.toLocaleString()}</strong>
          <span>
            {positionFilter === "ALL" ? "players" : `${positionFilter} rows`}
          </span>
        </div>

        {rows.length ? (
          <div className="admin-schedule-edge-table-wrap">
            <table className="admin-schedule-edge-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Rank</th>
                  <th>Selected Weeks</th>
                  <th>Value</th>
                  <th>Decision</th>
                  <th>League Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => {
                  const weekRows = getScheduleEdgeWeeksInRange(row, selectedRange);
                  const summary = getScheduleEdgeRangeSummary(row, selectedRange);

                  return (
                    <tr key={row.id}>
                      <td>
                        <ScheduleEdgePlayerCell row={row} />
                      </td>
                      <td>
                        <strong>{row.seasonRank || row.bestRank}</strong>
                        <span>
                          {row.seasonRank
                            ? "Current-season rank"
                            : row.bestWeek
                              ? `Best W${row.bestWeek}`
                              : "Rolling"}
                        </span>
                        {row.seasonRank && row.bestRank !== row.seasonRank ? (
                          <span className="admin-schedule-rank-source">
                            SOS row {row.bestRank}
                          </span>
                        ) : null}
                      </td>
                      <td className="admin-schedule-edge-weeks-cell">
                        <div className="admin-schedule-week-chip-list">
                          {weekRows.map(week => (
                            <ScheduleEdgeWeekChip
                              key={`${row.id}-${week.week}`}
                              rowId={row.id}
                              week={week}
                            />
                          ))}
                          {summary.missingWeeks.map(week => (
                            <span
                              key={`${row.id}-missing-${week}`}
                              className="admin-schedule-week-chip admin-schedule-week-chip-missing"
                            >
                              <strong>W{week}</strong>
                              <span>No row</span>
                              <em>Missing</em>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <strong>{formatScheduleEdgeValue(row.value)}</strong>
                        <span>
                          {row.targetScore !== null
                            ? `Target ${Math.round(row.targetScore)}`
                            : row.currentRank
                              ? "Season value"
                              : "No rank"}
                        </span>
                      </td>
                      <td className="admin-schedule-decision-cell">
                        <span
                          className={`admin-schedule-edge-pill admin-schedule-edge-pill-${row.decisionTone}`}
                          title={row.evidenceRead.whyThisFired}
                        >
                          {row.decisionLabel}
                        </span>
                        <span
                          className={`admin-schedule-evidence-label admin-schedule-evidence-label-${row.evidenceRead.label.replace(/\s+/g, "-")}`}
                        >
                          {row.evidenceRead.label} · {row.evidenceRead.finalScore}%
                        </span>
                        <details className="admin-schedule-evidence-receipts">
                          <summary>Receipts</summary>
                          <ul>
                            {getAIEvidenceReceiptItems(row.evidenceRead).map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </details>
                      </td>
                      <td>
                        <span
                          className={`admin-schedule-edge-pill admin-schedule-edge-pill-${row.availabilityTone}`}
                          title={`${row.availabilityDetail} ${row.sourceFreshness}`}
                        >
                          {row.availabilityLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-schedule-edge-empty">
            <strong>No DraftSharks SOS rows yet</strong>
            <p>
              The report did not return stored DraftSharks schedule targets.
              Refresh the DraftSharks SOS snapshot or regenerate after the
              schedule-strength job has percentage rows for the selected window.
            </p>
          </div>
        )}
        {healthRows.length > 0 && (
          <details className="admin-schedule-health-disclosure">
            <summary>
              <span>Snapshot coverage</span>
              <em>{issueCount.toLocaleString()} issues</em>
            </summary>
            <div className="admin-schedule-health">
              <div className="admin-schedule-edge-table-wrap">
                <table className="admin-schedule-edge-table admin-schedule-health-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      {healthPositions.map(position => (
                        <th key={position}>{position}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {healthRows.map(row => (
                      <tr key={row.week}>
                        <td>
                          <strong>Week {row.week}</strong>
                        </td>
                        {healthPositions.map(position => {
                          const cell = row.cells[position];
                          return (
                            <td key={position}>
                              {cell ? (
                                <span
                                  className={`admin-schedule-edge-pill admin-schedule-edge-pill-${cell.tone}`}
                                  title={cell.detail}
                                >
                                  {cell.label}
                                  {typeof cell.rowCount === "number"
                                    ? ` · ${cell.rowCount.toLocaleString()}`
                                    : ""}
                                </span>
                              ) : (
                                <span className="admin-schedule-health-missing">
                                  -
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        )}
      </div>
    </CollapsibleReportSection>
  );
}

function formatAdminTelemetryDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAdminBytes(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  const bytes = Math.max(0, Number(value));
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString()} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSourceCoverageStatusLabel(row: SourceCoverageRow): string {
  if (row.status === "loaded") return "Loaded";
  if (row.status === "stale") return "Stale";
  if (row.status === "missing") return "Missing";
  if (row.status === "error") return "Source error";
  if (row.status === "blocked") return "Needs approval";
  return "Research";
}

function getSourceCoverageToneClass(row: SourceCoverageRow): string {
  if (row.level === "danger") return "admin-source-coverage-row-danger";
  if (row.level === "warn") return "admin-source-coverage-row-warn";
  return "admin-source-coverage-row-good";
}

function isActionableSourceCoverageRow(row: SourceCoverageRow): boolean {
  if (row.status === "blocked" || row.status === "research") return false;
  if (row.status === "missing" && row.level === "info") return false;
  return row.level === "warn" || row.level === "danger";
}

function buildSourceCoverageIssueTotals(
  rows: SourceCoverageRow[]
): SourceCoverageMatrixData["totals"] {
  return {
    sources: rows.length,
    loaded: rows.filter(row => row.status === "loaded").length,
    stale: rows.filter(row => row.status === "stale").length,
    missing: rows.filter(row => row.status === "missing").length,
    error: rows.filter(row => row.status === "error").length,
    blocked: rows.filter(row => row.status === "blocked").length,
    research: rows.filter(row => row.status === "research").length,
    snapshotBacked: rows.filter(row => row.snapshotKey || row.tableName).length,
    needsApproval: rows.filter(row => /approval|approved|terms/i.test(row.complianceNote)).length,
  };
}

function isHandledSourceHealthEvent(event: {
  job?: string | null;
  status?: string | null;
  message?: string | null;
}): boolean {
  const job = String(event.job || "");
  const status = String(event.status || "");
  const message = String(event.message || "");
  if (!/dynamic-data-refresh|cached-report-source-backfill/i.test(job)) {
    return false;
  }
  if (!/^(loaded|empty)$/i.test(status)) return false;

  return /Other available source weights normalize automatically|source-excluded consensus|trust dropped|trust fell|waiting for more .* consensus overlap/i.test(
    message
  );
}

function isPrioritySourceHealthEvent(event: {
  level?: string | null;
  job?: string | null;
  status?: string | null;
  message?: string | null;
}): boolean {
  if (isHandledSourceHealthEvent(event)) return false;
  return event.level === "danger" || event.level === "warn";
}

function getCalibrationTone(row: AICalibrationAdjustmentRow): "danger" | "warn" | "info" | "good" {
  return row.priority === "danger" || row.priority === "warn" || row.priority === "good"
    ? row.priority
    : "info";
}

function formatCalibrationGroup(group: Record<string, string>): string {
  const entries = Object.entries(group);
  if (!entries.length || group.all) return "All AI reads";
  return entries
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1")}: ${value}`)
    .join(" · ");
}

function formatCalibrationAdjustment(row: AICalibrationAdjustmentRow): string {
  const score = row.scoreAdjustment > 0
    ? `+${row.scoreAdjustment}`
    : String(row.scoreAdjustment);
  const cap = row.confidenceCap !== null
    ? ` · cap ${row.confidenceCap}%`
    : "";
  return `${score} score${cap}`;
}

function getOutcomeMemoryBucketTone(bucket: {
  recommendation: string;
  scoredCount: number;
}): "error" | "warn" | "info" | "success" {
  if (bucket.recommendation === "review-model" || bucket.recommendation === "lower-confidence") return "error";
  if (bucket.recommendation === "raise-confidence") return "info";
  if (bucket.scoredCount < 5) return "warn";
  return "success";
}

function getOutcomeLedgerTone(status: string): "error" | "warn" | "info" | "success" {
  if (status === "miss") return "error";
  if (status === "pending") return "warn";
  if (status === "blocked" || status === "push") return "info";
  return "success";
}

function getCalibrationActionCount(data?: AICalibrationData): number {
  if (!data) return 0;
  return data.adjustmentProfile.adjustments.filter(row =>
    row.recommendation === "review-model" ||
    row.recommendation === "lower-confidence"
  ).length;
}

function AdminAICalibrationSection() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const calibrationQuery = trpc.system.aiCalibration.useQuery(
    { limit: 1000 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );
  const actionCount = getCalibrationActionCount(calibrationQuery.data);
  const tone = calibrationQuery.data?.adjustmentProfile.adjustments.some(row => row.priority === "danger")
    ? "danger"
    : "warn";

  return (
    <CollapsibleReportSection
      title="AI Calibration"
      kicker="Outcome feedback loop"
      previewAccessory={
        actionCount > 0 ? (
          <AdminAttentionBadge
            count={actionCount}
            label="Score changes"
            tone={tone}
          />
        ) : undefined
      }
      premium
      defaultOpen
    >
      <AdminAICalibrationPanel
        canViewTelemetry={canViewTelemetry}
        isAuthLoading={authQuery.isLoading}
        data={calibrationQuery.data}
        error={calibrationQuery.error}
        isLoading={calibrationQuery.isLoading}
        isFetching={calibrationQuery.isFetching}
        refetch={calibrationQuery.refetch}
      />
    </CollapsibleReportSection>
  );
}

function AdminAICalibrationPanel({
  canViewTelemetry,
  isAuthLoading,
  data,
  error,
  isLoading,
  isFetching,
  refetch,
}: {
  canViewTelemetry: boolean;
  isAuthLoading: boolean;
  data: AICalibrationData | undefined;
  error: { message: string } | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}) {
  const resolveMutation = trpc.system.resolveAiPredictionOutcomes.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });
  const feedbackMutation = trpc.system.markAiPredictionOutcome.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  if (isAuthLoading) {
    return (
      <div className="rankings-empty-state">
        Checking AI calibration access...
      </div>
    );
  }

  if (!canViewTelemetry) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>AI calibration is locked until Admin Tools are unlocked.</p>
        <span>
          This panel exposes hit rates, confidence drift, and scoring changes
          from stored AI prediction outcomes.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rankings-empty-state">
        Loading AI calibration...
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>AI calibration is unavailable for this session.</p>
        <span>{error.message}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rankings-empty-state">
        No AI calibration events available.
      </div>
    );
  }

  const profile = data.adjustmentProfile;
  const global = profile.globalAdjustment;
  const actionableRows = profile.adjustments
    .filter(row =>
      row.recommendation === "review-model" ||
      row.recommendation === "lower-confidence" ||
      row.recommendation === "raise-confidence"
    )
    .slice(0, 8);
  const recentResolved = data.recentEvents
    .filter(event => event.outcomeStatus !== "pending")
    .slice(0, 8);
  const feedbackRows = data.recentEvents.slice(0, 6);
  const counterfactual = data.counterfactuals;
  const counterfactualBuckets = counterfactual.buckets
    .filter(bucket => bucket.status !== "all")
    .slice(0, 6);
  const managerTradeRows = data.managerTrades.rows.slice(0, 6);
  const moduleQualityRows = data.moduleQuality.rows;
  const outcomeMemory = data.outcomeMemory;
  const outcomeLedgerRows = outcomeMemory.ledger.slice(0, 10);
  const confidenceBuckets = outcomeMemory.confidenceBuckets.slice(0, 6);
  const moduleScorecards = outcomeMemory.moduleScorecards.slice(0, 8);
  const sharpnessBuckets = outcomeMemory.sharpnessBuckets.slice(0, 6);
  const automaticAdjustments = outcomeMemory.automaticAdjustments.slice(0, 6);
  const pendingCount = profile.pendingCount;
  const totalCards = [
    {
      label: "Scored",
      value: profile.scoredCount,
      detail: `${profile.eventCount.toLocaleString()} logged reads`,
      tone: profile.scoredCount >= 20 ? "good" : "neutral",
    },
    {
      label: "Pending",
      value: pendingCount,
      detail: pendingCount ? "Resolve outcomes to calibrate" : "No pending outcomes",
      tone: pendingCount ? "warn" : "good",
    },
    {
      label: "Hit Rate",
      value: global.hitRate === null ? "n/a" : `${global.hitRate}%`,
      detail: `${global.avgConfidence ?? 0}% average confidence`,
      tone: global.recommendation === "review-model" ? "danger" : "neutral",
    },
    {
      label: "Gap",
      value: global.calibrationGap === null ? "n/a" : `${global.calibrationGap}`,
      detail: global.reason,
      tone: global.priority,
    },
    {
      label: "Global Move",
      value: formatCalibrationAdjustment(global),
      detail: global.recommendation.replace(/-/g, " "),
      tone: global.priority,
    },
    {
      label: "Baseline Edge",
      value: counterfactual.avgEdge === null ? "n/a" : `${counterfactual.avgEdge}`,
      detail: `${counterfactual.baselineCount.toLocaleString()} reads with counterfactuals`,
      tone: counterfactual.doWithoutBaselineEdgeCount ? "warn" : "good",
    },
  ];

  return (
    <div className="admin-traffic-panel admin-ai-calibration-panel">
      <div className="admin-traffic-header">
        <div>
          <span>Calibration engine</span>
          <strong>
            Outcome-weighted AI scoring · {formatAdminTelemetryDate(data.generatedAt)}
          </strong>
        </div>
        <div className="admin-ai-calibration-actions">
          <Button
            type="button"
            variant="outline"
            className="admin-traffic-refresh"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            className="admin-traffic-refresh"
            disabled={resolveMutation.isPending}
            onClick={() => resolveMutation.mutate({ limit: 200 })}
          >
            {resolveMutation.isPending ? "Resolving..." : "Resolve Pending"}
          </Button>
        </div>
      </div>

      <div className="admin-traffic-stat-grid">
        {totalCards.map(card => (
          <article
            key={card.label}
            className={`admin-traffic-stat admin-traffic-stat-${card.tone}`}
          >
            <span>{card.label}</span>
            <strong>
              {typeof card.value === "number"
                ? card.value.toLocaleString()
                : card.value}
            </strong>
            <em>{card.detail}</em>
          </article>
        ))}
      </div>

      {resolveMutation.data && (
        <div className="admin-ai-readout-clean">
          Resolved {resolveMutation.data.resolved.toLocaleString()} outcome
          {resolveMutation.data.resolved === 1 ? "" : "s"} ·{" "}
          {resolveMutation.data.pending.toLocaleString()} still pending ·{" "}
          {resolveMutation.data.failed.toLocaleString()} failed
        </div>
      )}

      <section className="admin-outcome-memory">
        <div className="admin-outcome-memory-head">
          <div>
            <span>Outcome Memory 2.0</span>
            <strong>Every AI call gets graded or stays capped.</strong>
            <p>
              Ledger, confidence buckets, module scorecards, sharpness buckets,
              and auto-adjustment recommendations from stored prediction events.
            </p>
          </div>
          <div className="admin-ai-readout-chip-row">
            <em>{outcomeMemory.eventCount.toLocaleString()} logged</em>
            <em>{outcomeMemory.scoredCount.toLocaleString()} scored</em>
            <em>{outcomeMemory.pendingCount.toLocaleString()} pending</em>
          </div>
        </div>

        <div className="admin-traffic-grid admin-provider-telemetry-grid admin-outcome-memory-grid">
          <section className="admin-traffic-card admin-outcome-memory-ledger">
            <h4>Outcome Ledger</h4>
            <div className="admin-traffic-list">
              {outcomeLedgerRows.length ? (
                outcomeLedgerRows.map(row => (
                  <article
                    key={row.eventId}
                    className={`admin-traffic-row admin-traffic-row-${getOutcomeLedgerTone(row.outcomeStatus)}`}
                  >
                    <strong>{row.entityName || row.module}</strong>
                    <span>
                      {row.module} · {row.decision} · {row.outcomeStatus} · {row.finalScore}%
                    </span>
                    <em>
                      {row.label} · cap {row.confidenceCap}% · source {row.sourceAgreement}
                    </em>
                    <em>
                      {row.sharpnessLabel
                        ? `${row.sharpnessLabel}${row.sharpnessScore !== null ? ` ${row.sharpnessScore}%` : ""}`
                        : "sharpness not tagged"} · {row.counterfactualStatus.replace(/-/g, " ")}
                    </em>
                    {row.observedOutcomeStatus ? (
                      <em>
                        observed {row.observedOutcomeStatus.replace(/^observed_/, "").replace(/_/g, " ")}
                        {row.observedOutcomeConfidence !== null
                          ? ` · ${row.observedOutcomeConfidence}% confidence`
                          : ""}
                        {row.observedOutcomeDetectedFrom
                          ? ` · ${row.observedOutcomeDetectedFrom.replace(/_/g, " ")}`
                          : ""}
                      </em>
                    ) : null}
                    {row.evidencePreview.length ? (
                      <em>{row.evidencePreview.slice(0, 2).join(" · ")}</em>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  No AI prediction ledger rows are stored yet.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Confidence Buckets</h4>
            <div className="admin-traffic-list">
              {confidenceBuckets.length ? (
                confidenceBuckets.map(bucket => (
                  <article
                    key={bucket.key}
                    className={`admin-traffic-row admin-traffic-row-${getOutcomeMemoryBucketTone(bucket)}`}
                  >
                    <strong>{bucket.group.label}</strong>
                    <span>
                      {bucket.scoredCount.toLocaleString()} scored · hit {bucket.hitRate ?? "n/a"}%
                    </span>
                    <em>
                      avg {bucket.avgConfidence ?? "n/a"}% · gap {bucket.calibrationGap ?? "n/a"} ·{" "}
                      {bucket.recommendation.replace(/-/g, " ")}
                    </em>
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  Confidence-bucket accuracy needs resolved outcomes.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Module Scorecards</h4>
            <div className="admin-traffic-list">
              {moduleScorecards.length ? (
                moduleScorecards.map(bucket => (
                  <article
                    key={bucket.key}
                    className={`admin-traffic-row admin-traffic-row-${getOutcomeMemoryBucketTone(bucket)}`}
                  >
                    <strong>
                      {bucket.group.surface} · {bucket.group.action}
                    </strong>
                    <span>
                      {bucket.eventCount.toLocaleString()} logged · {bucket.pendingCount.toLocaleString()} pending
                    </span>
                    <em>
                      hit {bucket.hitRate ?? "n/a"}% · avg {bucket.avgConfidence ?? "n/a"}% ·{" "}
                      {bucket.recommendation.replace(/-/g, " ")}
                    </em>
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  Module scorecards need stored AI calls.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Sharpness Calibration</h4>
            <div className="admin-traffic-list">
              {sharpnessBuckets.length ? (
                sharpnessBuckets.map(bucket => (
                  <article
                    key={bucket.key}
                    className={`admin-traffic-row admin-traffic-row-${getOutcomeMemoryBucketTone(bucket)}`}
                  >
                    <strong>{bucket.group.leagueSharpness}</strong>
                    <span>
                      {bucket.scoredCount.toLocaleString()} scored · hit {bucket.hitRate ?? "n/a"}%
                    </span>
                    <em>
                      avg {bucket.avgConfidence ?? "n/a"}% · gap {bucket.calibrationGap ?? "n/a"} ·{" "}
                      {bucket.recommendation.replace(/-/g, " ")}
                    </em>
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  Sharpness calibration starts once tagged Action Queue calls resolve.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Automatic Confidence Adjustments</h4>
            <div className="admin-traffic-list">
              {automaticAdjustments.length ? (
                automaticAdjustments.map(row => (
                  <article
                    key={row.key}
                    className={`admin-traffic-row admin-traffic-row-${getCalibrationTone(row) === "danger" ? "error" : getCalibrationTone(row)}`}
                  >
                    <strong>{formatCalibrationGroup(row.group)}</strong>
                    <span>
                      {formatCalibrationAdjustment(row)} · {row.recommendation.replace(/-/g, " ")}
                    </span>
                    <em>{row.reason}</em>
                  </article>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  No automatic confidence moves yet. Keep collecting outcomes.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>

      <div className="admin-traffic-grid admin-provider-telemetry-grid">
        <section className="admin-traffic-card">
          <h4>Score Adjustments</h4>
          <div className="admin-traffic-list">
            {actionableRows.length ? (
              actionableRows.map(row => (
                <article
                  key={row.key}
                  className={`admin-traffic-row admin-traffic-row-${getCalibrationTone(row) === "danger" ? "error" : getCalibrationTone(row)}`}
                >
                  <strong>{formatCalibrationGroup(row.group)}</strong>
                  <span>
                    {formatCalibrationAdjustment(row)} · {row.recommendation.replace(/-/g, " ")}
                  </span>
                  <em>
                    {row.scoredCount.toLocaleString()} scored · hit{" "}
                    {row.hitRate ?? "n/a"}% · avg {row.avgConfidence ?? "n/a"}%
                  </em>
                  <em>{row.reason}</em>
                </article>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No actionable scoring changes yet. Keep collecting resolved
                outcomes before moving confidence.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Module Accuracy</h4>
          <div className="admin-traffic-list">
            {moduleQualityRows.map(row => (
              <article
                key={row.key}
                className={`admin-traffic-row admin-traffic-row-${
                  row.confidenceAction === "lower"
                    ? "error"
                    : row.confidenceAction === "raise"
                      ? "success"
                      : row.sampleStatus === "needs-samples"
                        ? "warn"
                        : "info"
                }`}
              >
                <strong>{row.label}</strong>
                <span>
                  {row.scoredCount.toLocaleString()} scored · {row.pendingCount.toLocaleString()} pending · hit{" "}
                  {row.hitRate ?? "n/a"}%
                </span>
                <em>
                  {row.sampleStatus.replace(/-/g, " ")} · {row.confidenceAction.replace(/-/g, " ")} · gap{" "}
                  {row.calibrationGap ?? "n/a"}
                </em>
                <em>{row.description}</em>
                {row.sampleStatus === "needs-samples" || row.sampleStatus === "collecting" ? (
                  <em>{row.nextDataNeeded}</em>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Source Agreement</h4>
          <div className="admin-traffic-list">
            {data.sourceAgreement.buckets
              .filter(bucket => bucket.key !== "all")
              .slice(0, 6)
              .map(bucket => (
                <div key={bucket.key} className="admin-traffic-row">
                  <strong>{bucket.group.sourceAgreement || "unknown"}</strong>
                  <span>
                    {bucket.scoredCount.toLocaleString()} scored · hit{" "}
                    {bucket.hitRate ?? "n/a"}% · gap {bucket.calibrationGap ?? "n/a"}
                  </span>
                  <em>{bucket.recommendation.replace(/-/g, " ")}</em>
                </div>
              ))}
            {data.sourceAgreement.buckets.length <= 1 && (
              <p className="admin-traffic-empty">
                Source-agreement samples are still building.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Baseline Tests</h4>
          <div className="admin-traffic-list">
            {counterfactualBuckets.length ? (
              counterfactualBuckets.map(bucket => (
                <div key={bucket.status} className="admin-traffic-row">
                  <strong>{bucket.status.replace(/-/g, " ")}</strong>
                  <span>
                    {bucket.eventCount.toLocaleString()} reads · edge{" "}
                    {bucket.avgEdge ?? "n/a"} · hit {bucket.hitRate ?? "n/a"}%
                  </span>
                  <em>
                    {bucket.scoredCount.toLocaleString()} scored · avg confidence{" "}
                    {bucket.avgConfidence ?? "n/a"}%
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                Counterfactual baselines are still building.
              </p>
            )}
            {counterfactual.doWithoutBaselineEdgeCount > 0 && (
              <p className="admin-ai-readout-clean">
                {counterfactual.doWithoutBaselineEdgeCount.toLocaleString()} do-read
                {counterfactual.doWithoutBaselineEdgeCount === 1 ? "" : "s"} need a stronger baseline edge.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Trade Targets</h4>
          <div className="admin-traffic-list">
            {managerTradeRows.length ? (
              managerTradeRows.map(row => (
                <div key={row.manager} className="admin-traffic-row">
                  <strong>{row.manager}</strong>
                  <span>
                    {row.recommendation.replace(/-/g, " ")} · accept{" "}
                    {row.acceptanceRate ?? "n/a"}% · edge {row.avgRealizedEdge ?? "n/a"}
                  </span>
                  <em>
                    {row.scoredCount.toLocaleString()} scored · {row.pendingCount.toLocaleString()} pending
                  </em>
                  <em>{row.note}</em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                Manager-specific trade acceptance samples are still building.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Recent Outcomes</h4>
          <div className="admin-traffic-list">
            {recentResolved.length ? (
              recentResolved.map(event => (
                <div
                  key={event.eventId}
                  className={`admin-traffic-row admin-traffic-row-${event.outcomeStatus === "miss" ? "error" : "success"}`}
                >
                  <strong>{event.entityName || event.label}</strong>
                  <span>
                    {event.surface} · {event.action} · {event.outcomeStatus} · {event.finalScore}%
                  </span>
                  <em>
                    {event.baselineLabel || "baseline"}{" "}
                    {event.baselineScore === null ? "n/a" : `${event.baselineScore}%`} ·{" "}
                    {event.counterfactualStatus.replace(/-/g, " ")}
                  </em>
                  {event.realizedEdgeStatus ? (
                    <em>
                      realized {event.realizedEdge ?? "n/a"} ·{" "}
                      {event.realizedEdgeStatus.replace(/-/g, " ")}
                      {event.feedbackSource ? ` · ${event.feedbackSource}` : ""}
                    </em>
                  ) : null}
                  <em>{formatAdminTelemetryDate(event.updatedAt)}</em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No resolved AI outcomes in the recent event window.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Manual Feedback</h4>
          <div className="admin-traffic-list">
            {feedbackRows.length ? (
              feedbackRows.map(event => (
                <div key={event.eventId} className="admin-traffic-row">
                  <strong>{event.entityName || event.label}</strong>
                  <span>
                    {event.surface} · {event.action} · {event.outcomeStatus} · expires{" "}
                    {event.expiresAt ? formatAdminTelemetryDate(event.expiresAt) : "n/a"}
                  </span>
                  <div className="admin-ai-calibration-actions">
                    <Button
                      type="button"
                      variant="outline"
                      className="admin-traffic-refresh"
                      disabled={feedbackMutation.isPending}
                      onClick={() => feedbackMutation.mutate({
                        eventId: event.eventId,
                        status: "hit",
                        note: "Admin feedback: this read worked.",
                      })}
                    >
                      Worked
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="admin-traffic-refresh"
                      disabled={feedbackMutation.isPending}
                      onClick={() => feedbackMutation.mutate({
                        eventId: event.eventId,
                        status: "miss",
                        note: "Admin feedback: this was a bad read.",
                      })}
                    >
                      Missed
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="admin-traffic-refresh"
                      disabled={feedbackMutation.isPending}
                      onClick={() => feedbackMutation.mutate({
                        eventId: event.eventId,
                        status: "push",
                        note: "Admin feedback: ignored or not scorable.",
                      })}
                    >
                      Ignored
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No recent AI reads are available for manual feedback.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminTrafficTelemetrySection({
  onLeagueSelect,
}: {
  onLeagueSelect: (leagueId: string) => void | Promise<void>;
}) {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const { data: sourceHealth } = trpc.system.sourceHealth.useQuery(
    { lookbackDays: 7 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );
  const priorityEvents = (sourceHealth?.recentEvents || []).filter(
    isPrioritySourceHealthEvent
  );
  const alertTone = priorityEvents.some(event => event.level === "danger")
    ? "danger"
    : "warn";

  return (
    <CollapsibleReportSection
      title="Traffic Telemetry"
      kicker="Request telemetry"
      previewAccessory={
        priorityEvents.length > 0 ? (
          <AdminAttentionBadge
            count={priorityEvents.length}
            label="Source alerts"
            tone={alertTone}
          />
        ) : undefined
      }
      premium
    >
      <AdminAbuseTelemetryPanel onLeagueSelect={onLeagueSelect} />
    </CollapsibleReportSection>
  );
}

function AdminProviderTelemetrySection() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const { data } = trpc.system.apiProviderTelemetry.useQuery(
    { lookbackDays: 7, limit: 12 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );
  const issueCount =
    (data?.totals.failures || 0) +
    (data?.totals.rateLimited || 0) +
    (data?.totals.userLoadNetworkCalls || 0);
  const issueTone = data?.totals.rateLimited || data?.totals.failures ? "danger" : "warn";

  return (
    <CollapsibleReportSection
      title="API Budget & Rate Limits"
      kicker="Provider telemetry"
      previewAccessory={
        issueCount > 0 ? (
          <AdminAttentionBadge
            count={issueCount}
            label="Provider issues"
            tone={issueTone}
          />
        ) : undefined
      }
      premium
    >
      <AdminProviderTelemetryPanel />
    </CollapsibleReportSection>
  );
}

type AdminProviderTelemetryBucket = {
  label: string;
  calls: number;
  networkCalls: number;
  cacheHits: number;
  cacheHitRatePct: number;
  failures: number;
  rateLimited: number;
  costUnits: number;
  avgDurationMs: number;
  lastSeen: string | null;
  lastStatus: number | null;
  lastMessage: string | null;
};

type AdminProviderTelemetryEventRow = {
  provider: string;
  endpoint: string;
  status: number | null;
  ok: boolean;
  durationMs: number | null;
  cacheStatus: string;
  scope: string;
  message: string | null;
  createdAt: string;
};

function hasProviderTelemetryIssue(row: AdminProviderTelemetryBucket): boolean {
  return row.failures > 0 || row.rateLimited > 0;
}

function isProviderBudgetDriver(row: AdminProviderTelemetryBucket): boolean {
  return hasProviderTelemetryIssue(row) || row.networkCalls > 0 || row.costUnits > 0;
}

function getProviderTelemetryRowClass(row: AdminProviderTelemetryBucket): string {
  if (row.rateLimited > 0 || row.failures > 0) return "admin-traffic-row admin-traffic-row-error";
  if (row.networkCalls > 0) return "admin-traffic-row admin-traffic-row-warn";
  return "admin-traffic-row";
}

function formatProviderTelemetryCallSummary(row: AdminProviderTelemetryBucket): string {
  const parts = [
    `${row.calls.toLocaleString()} calls`,
    `${row.networkCalls.toLocaleString()} network`,
    `${row.cacheHitRatePct}% cached`,
  ];
  if (row.costUnits > 0) parts.push(`${row.costUnits.toLocaleString()} cost`);
  return parts.join(" · ");
}

function formatProviderTelemetryIssueSummary(row: AdminProviderTelemetryBucket): string {
  const issues = [
    row.failures ? `${row.failures.toLocaleString()} failures` : null,
    row.rateLimited ? `${row.rateLimited.toLocaleString()} 429s` : null,
  ].filter(Boolean);
  return issues.length ? issues.join(" · ") : "No failures or 429s";
}

function AdminProviderTelemetryPanel() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const { data, error, isLoading, isFetching, refetch } =
    trpc.system.apiProviderTelemetry.useQuery(
      { lookbackDays: 7, limit: 12 },
      {
        enabled: canViewTelemetry,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 1000 * 60,
      }
    );

  if (authQuery.isLoading) {
    return (
      <div className="rankings-empty-state">
        Checking provider telemetry access...
      </div>
    );
  }

  if (!canViewTelemetry) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Provider telemetry is locked until Admin Tools are unlocked.</p>
        <span>
          This panel is admin-only because it exposes source costs, failures,
          and endpoint behavior.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rankings-empty-state">
        Loading provider telemetry...
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Provider telemetry is unavailable for this session.</p>
        <span>{error.message}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rankings-empty-state">
        No provider telemetry available.
      </div>
    );
  }

  const issueTotal = data.totals.failures + data.totals.rateLimited;
  const userLoadNetworkCalls = data.totals.userLoadNetworkCalls;
  const providerRows = data.byProvider
    .filter(isProviderBudgetDriver)
    .slice(0, 4);
  const endpointRows = data.byEndpoint
    .filter(isProviderBudgetDriver)
    .slice(0, 5);
  const scopeRows = data.byScope
    .filter(row => row.calls > 0)
    .slice(0, 5);
  const attentionRows = [
    ...data.byProvider
      .filter(hasProviderTelemetryIssue)
      .map(row => ({ ...row, group: "Provider" })),
    ...data.byEndpoint
      .filter(hasProviderTelemetryIssue)
      .map(row => ({ ...row, group: "Endpoint" })),
  ].slice(0, 6);
  const recentNetworkEvents: AdminProviderTelemetryEventRow[] = data.recentEvents
    .filter(event => !event.ok || event.status === 429 || event.cacheStatus !== "hit")
    .slice(0, 6);

  const totalCards = [
    {
      label: "Network",
      value: data.totals.networkCalls,
      detail: `${data.totals.calls.toLocaleString()} total calls`,
      tone: userLoadNetworkCalls ? "warn" : "neutral",
    },
    {
      label: "Cache Hit",
      value: `${data.totals.cacheHitRatePct}%`,
      detail: `${data.totals.cacheHits.toLocaleString()} cached responses`,
      tone: data.totals.cacheHitRatePct >= 80 || data.totals.networkCalls === 0 ? "good" : "neutral",
    },
    {
      label: "Issues",
      value: issueTotal,
      detail: issueTotal
        ? `${data.totals.failures.toLocaleString()} failures · ${data.totals.rateLimited.toLocaleString()} 429s`
        : "No failures or 429s",
      tone: data.totals.rateLimited || data.totals.failures ? "danger" : "good",
    },
    {
      label: "User Load Network",
      value: userLoadNetworkCalls,
      detail: userLoadNetworkCalls ? "Review provider boundary" : "Clean boundary",
      tone: userLoadNetworkCalls ? "warn" : "good",
    },
    {
      label: "Cost Units",
      value: data.totals.costUnits,
      detail: `${data.totals.avgDurationMs}ms avg duration`,
      tone: data.totals.costUnits ? "neutral" : "good",
    },
  ];

  return (
    <div className="admin-traffic-panel">
      <div className="admin-traffic-header">
        <div>
          <span>Last 7 days</span>
          <strong>
            Provider budget snapshot ·{" "}
            {formatAdminTelemetryDate(data.generatedAt)}
          </strong>
        </div>
        <Button
          type="button"
          variant="outline"
          className="admin-traffic-refresh"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </div>

      <div className="admin-traffic-stat-grid">
        {totalCards.map(card => (
          <article
            key={card.label}
            className={`admin-traffic-stat admin-traffic-stat-${card.tone}`}
          >
            <span>{card.label}</span>
            <strong>
              {typeof card.value === "number"
                ? card.value.toLocaleString()
                : card.value}
            </strong>
            <em>{card.detail}</em>
          </article>
        ))}
      </div>

      <div className="admin-traffic-grid admin-provider-telemetry-grid">
        <section className="admin-traffic-card">
          <h4>Needs Attention</h4>
          <div className="admin-traffic-list">
            {attentionRows.length || userLoadNetworkCalls ? (
              <>
                {userLoadNetworkCalls > 0 && (
                  <div className="admin-traffic-row admin-traffic-row-warn">
                    <strong>User-load provider calls</strong>
                    <span>
                      {userLoadNetworkCalls.toLocaleString()} network call
                      {userLoadNetworkCalls === 1 ? "" : "s"} happened during user-load scope
                    </span>
                    <em>Normal report loads should stay snapshot-backed for provider data.</em>
                  </div>
                )}
                {attentionRows.map(row => (
                  <div
                    key={`${row.group}:${row.label}`}
                    className={getProviderTelemetryRowClass(row)}
                  >
                    <strong>
                      {row.group}: {row.label}
                    </strong>
                    <span>{formatProviderTelemetryIssueSummary(row)}</span>
                    <em>
                      {formatProviderTelemetryCallSummary(row)} · Last{" "}
                      {formatAdminTelemetryDate(row.lastSeen)}
                      {row.lastMessage ? ` · ${row.lastMessage}` : ""}
                    </em>
                  </div>
                ))}
              </>
            ) : (
              <div className="admin-provider-clean-row">
                <strong>No provider budget issues</strong>
                <span>No failures, 429s, or user-load provider network calls in this window.</span>
              </div>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Top Cost Endpoints</h4>
          <div className="admin-traffic-list">
            {endpointRows.length ? (
              endpointRows.map(endpoint => (
                <div
                  key={endpoint.label}
                  className={getProviderTelemetryRowClass(endpoint)}
                >
                  <strong>{endpoint.label}</strong>
                  <span>{formatProviderTelemetryCallSummary(endpoint)}</span>
                  <em>
                    Avg {endpoint.avgDurationMs}ms · Last{" "}
                    {formatAdminTelemetryDate(endpoint.lastSeen)}
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No endpoint cost rows worth reviewing in this window.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Provider Summary</h4>
          <div className="admin-traffic-list">
            {providerRows.length ? (
              providerRows.map(provider => (
                <div
                  key={provider.label}
                  className={getProviderTelemetryRowClass(provider)}
                >
                  <strong>{provider.label}</strong>
                  <span>{formatProviderTelemetryCallSummary(provider)}</span>
                  <em>
                    {formatProviderTelemetryIssueSummary(provider)}
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No provider rows worth reviewing in this window.
              </p>
            )}
          </div>
        </section>
      </div>

      <details className="admin-provider-telemetry-details">
        <summary>
          <span>Audit detail</span>
          <strong>
            {scopeRows.length.toLocaleString()} scopes ·{" "}
            {recentNetworkEvents.length.toLocaleString()} recent network rows
          </strong>
        </summary>
        <div className="admin-traffic-grid">
          <section className="admin-traffic-card">
            <h4>Call Scope</h4>
            <div className="admin-traffic-list">
              {scopeRows.length ? (
                scopeRows.map(scope => (
                  <div
                    key={scope.label}
                    className={getProviderTelemetryRowClass(scope)}
                  >
                    <strong>{scope.label}</strong>
                    <span>{formatProviderTelemetryCallSummary(scope)}</span>
                    <em>
                      {formatProviderTelemetryIssueSummary(scope)} · Last{" "}
                      {formatAdminTelemetryDate(scope.lastSeen)}
                    </em>
                  </div>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  No scoped provider calls recorded yet.
                </p>
              )}
            </div>
          </section>

          <section className="admin-traffic-card">
            <h4>Recent Network Events</h4>
            <div className="admin-traffic-list">
              {recentNetworkEvents.length ? (
                recentNetworkEvents.map((event, index) => (
                  <div
                    key={`${event.provider}-${event.endpoint}-${event.createdAt}-${index}`}
                    className={`admin-traffic-row ${event.ok ? "" : "admin-traffic-row-error"}`}
                  >
                    <strong>
                      {event.provider} · {event.endpoint}
                    </strong>
                    <span>
                      {event.ok ? "ok" : "failed"} · {event.status ?? "n/a"} ·{" "}
                      {event.cacheStatus} · {event.scope} · {event.durationMs ?? 0}ms
                    </span>
                    <em>
                      {formatAdminTelemetryDate(event.createdAt)}
                      {event.message ? ` · ${event.message}` : ""}
                    </em>
                  </div>
                ))
              ) : (
                <p className="admin-traffic-empty">
                  No recent network events recorded.
                </p>
              )}
            </div>
          </section>
        </div>
      </details>
    </div>
  );
}

function AdminSourceCoverageSection() {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const query = trpc.system.sourceCoverageMatrix.useQuery(
    { lookbackDays: 14 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );
  const needsAttention = (query.data?.rows || []).filter(
    isActionableSourceCoverageRow
  );
  const tone = needsAttention.some(row => row.level === "danger")
    ? "danger"
    : "warn";
  if (query.data && !needsAttention.length) return null;

  return (
    <CollapsibleReportSection
      title="Source Matrix"
      kicker="Actionable snapshot issues"
      previewAccessory={
        needsAttention.length > 0 ? (
          <AdminAttentionBadge
            count={needsAttention.length}
            label="Review sources"
            tone={tone}
          />
        ) : undefined
      }
      premium
      defaultOpen
    >
      <AdminSourceCoveragePanel
        canViewTelemetry={canViewTelemetry}
        isAuthLoading={authQuery.isLoading}
        data={query.data}
        error={query.error}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        refetch={query.refetch}
      />
    </CollapsibleReportSection>
  );
}

function AdminSourceCoveragePanel({
  canViewTelemetry,
  isAuthLoading,
  data,
  error,
  isLoading,
  isFetching,
  refetch,
}: {
  canViewTelemetry: boolean;
  isAuthLoading: boolean;
  data: SourceCoverageMatrixData | undefined;
  error: { message: string } | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}) {
  if (isAuthLoading) {
    return (
      <div className="rankings-empty-state">
        Checking source coverage access...
      </div>
    );
  }

  if (!canViewTelemetry) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Source coverage is locked until Admin Tools are unlocked.</p>
        <span>
          This panel is admin-only because it exposes provider names, refresh
          cadence, and integration gaps.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rankings-empty-state">
        Loading source coverage matrix...
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Source coverage is unavailable for this session.</p>
        <span>{error.message}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rankings-empty-state">
        No source coverage metadata available.
      </div>
    );
  }

  const issueRows = data.rows.filter(isActionableSourceCoverageRow);
  const issueTotals = buildSourceCoverageIssueTotals(issueRows);
  const totalCards = [
    { label: "Issues", value: issueTotals.sources },
    { label: "Errors", value: issueTotals.error },
    { label: "Stale", value: issueTotals.stale },
    { label: "Missing", value: issueTotals.missing },
    { label: "Snapshots", value: issueTotals.snapshotBacked },
    { label: "Needs Approval", value: issueTotals.needsApproval },
  ];

  return (
    <div className="admin-traffic-panel admin-source-coverage-panel">
      <div className="admin-traffic-header">
        <div>
          <span>Last {data.lookbackDays} days</span>
          <strong>
            Source coverage matrix · {formatAdminTelemetryDate(data.generatedAt)}
          </strong>
        </div>
        <Button
          type="button"
          variant="outline"
          className="admin-traffic-refresh"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </div>

      <div className="admin-traffic-stat-grid">
        {totalCards.map(card => (
          <article key={card.label} className="admin-traffic-stat">
            <span>{card.label}</span>
            <strong>{card.value.toLocaleString()}</strong>
          </article>
        ))}
      </div>

      {issueRows.length ? (
        <div className="admin-source-coverage-grid">
          <section className="admin-traffic-card admin-source-coverage-card">
            <h4>Actionable Source Issues</h4>
            <div className="admin-traffic-list">
              {issueRows.map(row => (
                <article
                  key={row.sourceKey}
                  className={`admin-traffic-row admin-source-coverage-row ${getSourceCoverageToneClass(row)}`}
                >
                  <div className="admin-source-coverage-row-head">
                    <strong>{row.source}</strong>
                    <span>{getSourceCoverageStatusLabel(row)}</span>
                  </div>
                  <span>
                    {row.category} · {row.rowCount?.toLocaleString() || "n/a"} rows ·{" "}
                    {formatAdminBytes(row.payloadSizeBytes)}
                  </span>
                  <em>
                    Updated {formatAdminTelemetryDate(row.updatedAt)}
                    {row.snapshotKey ? ` · Snapshot ${row.snapshotKey}` : ""}
                  </em>
                  <div className="admin-source-coverage-fields">
                    <span>Returns</span>
                    <p>{row.fieldMap.join(", ")}</p>
                  </div>
                  <div className="admin-source-coverage-fields">
                    <span>Used now</span>
                    <p>{row.usedNow.join(", ")}</p>
                  </div>
                  <div className="admin-source-coverage-fields">
                    <span>Could power</span>
                    <p>{row.couldPowerLater.join(", ")}</p>
                  </div>
                  {row.lastHealthMessage ? (
                    <em>
                      Health: {row.lastHealthStatus || "n/a"} · {row.lastHealthMessage}
                    </em>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <p className="admin-ai-readout-clean">
          No actionable source coverage issues in this payload. Optional,
          unconfigured, and research-only sources are kept out of admin
          diagnostics.
        </p>
      )}
    </div>
  );
}

const HIDDEN_TRAFFIC_IPS = new Set([
  "205.250.64.165",
  "127.0.0.1",
  "172.226.164.57",
]);

function normalizeTrafficIpLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  const bracketedHost = normalized.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedHost?.[1]) return bracketedHost[1];
  const ipv4WithPort = normalized.match(/^((?:\d{1,3}\.){3}\d{1,3})(?::\d+)?$/);
  if (ipv4WithPort?.[1]) return ipv4WithPort[1];
  return normalized;
}

function isHiddenTrafficIp(label: string): boolean {
  const normalized = normalizeTrafficIpLabel(label);
  if (!normalized) return false;
  if (HIDDEN_TRAFFIC_IPS.has(normalized)) return true;
  if (normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0")
    return true;
  if (normalized.startsWith("127.")) return true;
  if (normalized.startsWith("::ffff:127.")) return true;
  if (normalized.startsWith("::ffff:7f")) return true;
  if (normalized === "0:0:0:0:0:0:0:1") return true;
  return false;
}

function AdminAbuseTelemetryPanel({
  onLeagueSelect,
}: {
  onLeagueSelect: (leagueId: string) => void | Promise<void>;
}) {
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canViewTelemetry = canViewAdminTelemetryForUser(authQuery.data);
  const { data, error, isLoading, isFetching, refetch } =
    trpc.system.abuseTelemetry.useQuery(
      { lookbackDays: 7 },
      {
        enabled: canViewTelemetry,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 1000 * 60,
      }
    );
  const {
    data: sourceHealth,
    isFetching: isSourceHealthFetching,
    refetch: refetchSourceHealth,
  } = trpc.system.sourceHealth.useQuery(
    { lookbackDays: 7 },
    {
      enabled: canViewTelemetry,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60,
    }
  );

  if (authQuery.isLoading) {
    return (
      <div className="rankings-empty-state">
        Checking admin telemetry access...
      </div>
    );
  }

  if (!canViewTelemetry) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>
          Traffic telemetry is locked until you unlock Admin Tools for this
          browser session.
        </p>
        <span>
          Use the footer button to enter the first-party passphrase once, then
          this panel and the rest of the admin tools stay open until the browser
          closes.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rankings-empty-state">Loading traffic telemetry...</div>
    );
  }

  if (error) {
    return (
      <div className="admin-traffic-panel admin-traffic-panel-error">
        <p>Admin traffic telemetry is unavailable for this session.</p>
        <span>{error.message}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rankings-empty-state">
        No traffic telemetry available.
      </div>
    );
  }

  const totalCards = [
    { label: "Events", value: data.totals.events },
    { label: "Generated Reports", value: data.totals.generatedReports },
    { label: "Cached Reports", value: data.totals.cachedReports },
    { label: "Rate Limits", value: data.totals.rateLimitEvents },
    { label: "Unique IPs", value: data.totals.uniqueIps },
    { label: "Unique Leagues", value: data.totals.uniqueLeagueIds },
  ];
  const visibleTopIps = data.topIps.filter(
    entry => !isHiddenTrafficIp(entry.label)
  );
  const prioritySourceHealthEvents = (sourceHealth?.recentEvents || [])
    .filter(isPrioritySourceHealthEvent)
    .slice(0, 6);

  return (
    <div className="admin-traffic-panel">
      <div className="admin-traffic-header">
        <div>
          <span>Last {data.lookbackDays} days</span>
          <strong>
            Generated {formatAdminTelemetryDate(data.generatedAt)}
          </strong>
        </div>
        <Button
          type="button"
          variant="outline"
          className="admin-traffic-refresh"
          disabled={isFetching || isSourceHealthFetching}
          onClick={() => {
            void refetch();
            void refetchSourceHealth();
          }}
        >
          Refresh
        </Button>
      </div>

      {prioritySourceHealthEvents.length > 0 && (
        <section
          className="admin-critical-alerts admin-critical-alerts-traffic"
          aria-label="Important source health alerts"
        >
          <div className="admin-critical-alerts-header">
            <span>Needs Admin Attention</span>
            <strong>
              {prioritySourceHealthEvents.length} source-health alert
              {prioritySourceHealthEvents.length === 1 ? "" : "s"}
            </strong>
          </div>
          <div className="admin-critical-alerts-grid">
            {prioritySourceHealthEvents.map(event => (
              <article
                key={`source-priority-${event.id}`}
                className={`admin-critical-alert-card admin-critical-alert-card-${event.level === "danger" ? "danger" : "warn"}`}
              >
                <div>
                  <span>{event.job}</span>
                  <strong>{event.source}</strong>
                </div>
                <p>{event.message}</p>
                <em>
                  {event.status} · {event.board || "source"} ·{" "}
                  {event.rowCount ?? 0} rows
                </em>
              </article>
            ))}
          </div>
        </section>
      )}

      {prioritySourceHealthEvents.length > 0 && sourceHealth?.bySource?.length ? (
        <section
          className="admin-source-history-strip"
          aria-label="Source alert history"
        >
          <div className="admin-source-history-head">
            <span>Source Alert History</span>
            <strong>
              {sourceHealth.totals.uniqueSources} source
              {sourceHealth.totals.uniqueSources === 1 ? "" : "s"} flagged in{" "}
              {sourceHealth.lookbackDays} days
            </strong>
          </div>
          <div className="admin-source-history-grid">
            {sourceHealth.bySource.slice(0, 6).map(bucket => (
              <article key={bucket.label} className="admin-source-history-card">
                <div>
                  <span>{bucket.label}</span>
                  <strong>
                    {bucket.danger} danger · {bucket.warn} warn
                  </strong>
                </div>
                <p>{bucket.lastMessage || "No message captured."}</p>
                <em>
                  First {formatAdminTelemetryDate(bucket.firstSeen)} · Latest{" "}
                  {formatAdminTelemetryDate(bucket.lastSeen)}
                </em>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="admin-traffic-stat-grid">
        {totalCards.map(card => (
          <article key={card.label} className="admin-traffic-stat">
            <span>{card.label}</span>
            <strong>{card.value.toLocaleString()}</strong>
          </article>
        ))}
      </div>

      <div className="admin-traffic-grid">
        <section className="admin-traffic-card">
          <h4>Top IPs</h4>
          <div className="admin-traffic-list">
            {visibleTopIps.length ? (
              visibleTopIps.map(entry => (
                <div key={entry.label} className="admin-traffic-row">
                  <strong>{entry.label}</strong>
                  <span>
                    {entry.count} events · {entry.rateLimited} limited ·{" "}
                    {entry.uniqueLeagueIds} leagues
                  </span>
                  <em>Last seen {formatAdminTelemetryDate(entry.lastSeen)}</em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No non-local IP traffic in this window.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Top Leagues</h4>
          <div className="admin-traffic-list">
            {data.topLeagueIds.length ? (
              data.topLeagueIds.map(entry => (
                <button
                  key={entry.label}
                  type="button"
                  className="admin-traffic-row admin-traffic-row-button"
                  onClick={() => void onLeagueSelect(entry.label)}
                >
                  <strong>{entry.label}</strong>
                  <span>
                    {entry.count} events · {entry.success} success ·{" "}
                    {entry.error} errors
                  </span>
                  <em>Last seen {formatAdminTelemetryDate(entry.lastSeen)}</em>
                </button>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No league-specific events yet.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Source Health</h4>
          <div className="admin-traffic-list">
            {sourceHealth?.recentEvents?.length ? (
              sourceHealth.recentEvents.slice(0, 8).map(event => (
                <div
                  key={event.id}
                  className={`admin-traffic-row admin-traffic-row-${event.level === "danger" ? "error" : "success"}`}
                >
                  <strong>{event.source}</strong>
                  <span>
                    {event.level} · {event.status} · {event.board || "source"} ·{" "}
                    {event.rowCount ?? 0} rows
                  </span>
                  <em>
                    {formatAdminTelemetryDate(event.createdAt)} ·{" "}
                    {event.message}
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No source-health alerts in the last 7 days.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

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
  const [analysisCompleteMessage, setAnalysisCompleteMessage] = useState<{
    leagueName: string;
    leagueFormat: string;
    leagueLogo: string | null;
  } | null>(null);
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

  const clownEasterEggDialog = (
    <Dialog open={isClownModalOpen} onOpenChange={setIsClownModalOpen}>
      <DialogContent className="clown-easter-egg-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-lg">
        <DialogHeader className="text-center">
          <DialogTitle className="athletic-headline text-3xl text-orange-400">
            Rival Alert
          </DialogTitle>
          <DialogDescription className="text-cyan-100/75">
            This username unlocked a special screen.
          </DialogDescription>
        </DialogHeader>
        <div className="clown-easter-egg-body">
          <div className="clown-easter-egg-face" aria-hidden="true">
            🤡
          </div>
          <p className="clown-easter-egg-copy">Rival league energy detected.</p>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            onClick={handleClownDismiss}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
          >
            Back To Login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const leaguePickerDialog = orderedUserLeagues.length ? (
    <Dialog open={isLeaguePickerOpen} onOpenChange={setIsLeaguePickerOpen}>
      <DialogContent className="league-switch-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-2xl">
        <DialogHeader className="league-switch-header text-center sm:text-center">
          <DialogTitle className="athletic-headline league-switch-title-gradient text-3xl">
            Pick Another League
          </DialogTitle>
          <DialogDescription className="league-switch-description text-cyan-100/70">
            <span className="league-switch-signed-in-line">
              <span>Signed in as</span>
              <span className="league-switch-user-chip">
                {activeCachedSleeperUser?.avatarUrl ? (
                  <img
                    src={activeCachedSleeperUser.avatarUrl}
                    alt=""
                    aria-hidden="true"
                    className="league-switch-user-avatar"
                  />
                ) : (
                  <span
                    className="league-switch-user-fallback"
                    aria-hidden="true"
                  >
                    {(
                      sleeperUsername ||
                      activeCachedSleeperUser?.displayName ||
                      "SA"
                    )
                      .trim()
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
                <strong>
                  {sleeperUsername ||
                    activeCachedSleeperUser?.displayName ||
                    "your Sleeper account"}
                </strong>
              </span>
            </span>
            {isLeaguePickerIntelBusy ? (
              <span>Syncing rankings and manager icons</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="home-league-picker league-switch-picker">
          {orderedUserLeagues.map(league => (
            <LeaguePickerCard
              key={league.leagueId}
              league={league}
              onSelect={handleAnalyzeLeagueOption}
              disabled={isLeaguePickerIntelBusy}
            />
          ))}
        </div>
        <DialogFooter className="league-switch-footer sm:justify-center">
          <Button
            type="button"
            onClick={handleStartOver}
            variant="outline"
            className="league-switch-start-over-button border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
          >
            Back to Sign In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

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
  const loadingDialog = (
    <Dialog
      key="analysis-loading-dialog"
      open={isLoading}
      onOpenChange={() => undefined}
    >
      <DialogContent
        className={`analysis-loading-dialog analysis-loading-dialog-${loadingTransitionPhase} border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-lg`}
        overlayClassName={`analysis-loading-overlay analysis-loading-overlay-${loadingTransitionPhase}`}
        style={{
          filter: "none",
          backdropFilter: "none",
        }}
        showCloseButton={false}
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {analysisCompleteMessage
              ? "League Report Ready"
              : "Analyzing League"}
          </DialogTitle>
          <DialogDescription>
            {analysisCompleteMessage
              ? "The league report is ready."
              : "Generating the selected league report."}
          </DialogDescription>
        </DialogHeader>
        <div className="analysis-loading-modal-body">
          <LoadingAnimation
            key={previewMode === "loading-loop" ? `loading-loop-${previewLoadingLoopTick}` : "loading"}
            isComplete={Boolean(analysisCompleteMessage)}
            phase={loadingTransitionPhase}
            leagueName={loadingLeague?.leagueName}
            leagueFormat={loadingLeague?.leagueFormat}
            leagueLogo={loadingLeague?.leagueLogo}
            managerAnchors={loadingManagerAnchors}
          />
        </div>
      </DialogContent>
    </Dialog>
  );

  const adminAccessDialog = (
    <Dialog
      open={isAdminAccessModalOpen}
      onOpenChange={open => {
        if (open) return;
        setIsAdminAccessModalOpen(false);
        setAdminPassphrase("");
      }}
    >
      <DialogContent className="admin-unlock-dialog border-orange-400/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-orange-950/30 sm:max-w-lg">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="athletic-headline text-center text-3xl text-orange-300">
            Unlock Admin Tools
          </DialogTitle>
          <DialogDescription className="text-center text-slate-300">
            If you do not have the passphrase, stay in regular report view.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            adminLoginMutation.mutate({ passphrase: adminPassphrase });
          }}
        >
          <Input
            type="password"
            value={adminPassphrase}
            onChange={event => setAdminPassphrase(event.target.value)}
            placeholder="Admin passphrase"
            autoComplete="current-password"
            className="admin-unlock-passphrase-input border-orange-400/20 bg-slate-950/80 text-center text-slate-100 placeholder:text-center placeholder:text-slate-500"
          />
          <DialogFooter className="gap-2 sm:items-center sm:justify-center">
            <Button
              type="submit"
              disabled={!adminPassphrase.trim() || adminLoginMutation.isPending}
              className="admin-unlock-primary-button w-full font-black sm:w-auto"
            >
              {adminLoginMutation.isPending
                ? "Unlocking..."
                : "Unlock Admin Tools"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-700 text-slate-200 hover:bg-slate-900 sm:w-auto"
              onClick={() => {
                setIsAdminAccessModalOpen(false);
                setAdminPassphrase("");
              }}
            >
              Stay in Regular View
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  const adminUnlockDialog = (
    <Dialog
      open={hasAuthenticatedAdminPermissions && isAdminUnlockModalOpen}
      onOpenChange={open => {
        if (!open) handleAdminUnlockModalDismiss();
      }}
    >
      <DialogContent className="admin-unlock-dialog border-orange-400/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-orange-950/30 sm:max-w-lg">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="athletic-headline text-center text-3xl text-orange-300">
            Congrats
          </DialogTitle>
          <DialogDescription className="text-center text-slate-300">
            Your admin session has premium AI reads, blueprint
            reports, league power tools and market signals
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:items-center sm:justify-center">
          <Button
            type="button"
            onClick={handleAdminUnlockModalDismiss}
            className="admin-unlock-primary-button w-full font-black sm:w-auto"
          >
            Enter Command Center
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <ManagerChampionshipProvider
          championships={reportData.managerChampionships}
        >
          <div
            className={`report-shell min-h-screen flex flex-col ${isLoadingRevealPhase ? "report-shell-entering" : ""}`}
            data-ai-voice-mode={aiVoiceMode}
          >
            <PremiumFxLayer
              variant={reportFxVariant}
              intensity={resolvedActiveTab === "overview" ? "low" : "medium"}
            />
            <Tabs
              value={resolvedActiveTab}
              onValueChange={handleReportTabChange}
              className="report-dashboard-tabs-root"
            >
            {/* Premium Header */}
            <div className="report-header sticky top-0 z-50">
              <HeaderCssLights />
              <div className="report-header-inner dd-header-content max-w-7xl mx-auto px-4 sm:pl-6 sm:pr-2 md:pl-6 md:pr-1 lg:pr-0 py-3 md:py-2">
                <div className="report-header-grid">
                  {/* Left: Brand */}
                  <div className="report-header-brand min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <button
                        type="button"
                        className={`report-header-mobile-brand-lockup cursor-pointer border-0 bg-transparent p-0 md:hidden ${hasAdminPermissions ? "report-header-mobile-brand-lockup-admin" : ""}`}
                        onClick={handleAnalyzeAnotherLeague}
                        aria-label="Open league picker or return home"
                      >
                        <img
                          src={DYNASTY_MOBILE_REPORT_LOGO_SRC}
                          alt="Dynasty Degenerates"
                          className="report-header-mobile-logo"
                        />
                      </button>
                      <button
                        type="button"
                        className="report-header-logo-button hidden cursor-pointer border-0 bg-transparent p-0 md:block"
                        onClick={handleAnalyzeAnotherLeague}
                        aria-label="Open league picker or return home"
                      >
                        <img
                          src={DYNASTY_REPORT_HEADER_LOGO_SRC}
                          alt="Dynasty Degenerates"
                          className="report-header-logo report-header-logo-left"
                        />
                      </button>
                    </div>
                  </div>

                  <TabsList
                    className={`${reportTabsClassName} ${canViewAutopilotTab ? "report-tabs-with-autopilot" : ""} report-header-tabs`}
                    data-active-tab={resolvedActiveTab}
                    style={reportTabsStyle}
                  >
                    <TabsTrigger
                      value="overview"
                      className="report-tab"
                      aria-label="Overview"
                    >
                      <BarChart3 className="h-4 w-4" aria-hidden="true" />
                      <span className="report-tab-label-full" aria-hidden="true">
                        Overview
                      </span>
                      <span className="report-tab-label-short" aria-hidden="true">
                        View
                      </span>
                    </TabsTrigger>

                    {canViewAutopilotTab && (
                      <TabsTrigger
                        value="autopilot"
                        className="report-tab"
                        aria-label="AI Autopilot"
                      >
                        <Bot className="h-4 w-4" aria-hidden="true" />
                        <span
                          className="report-tab-label-full"
                          aria-hidden="true"
                        >
                          AI Autopilot
                        </span>
                        <span
                          className="report-tab-label-short"
                          aria-hidden="true"
                        >
                          Auto
                        </span>
                      </TabsTrigger>
                    )}

                    <TabsTrigger
                      value="momentum"
                      className="report-tab"
                      aria-label="Weekly Momentum"
                    >
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      <span className="report-tab-label-full" aria-hidden="true">
                        Momentum
                      </span>
                      <span className="report-tab-label-short" aria-hidden="true">
                        Pulse
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="rankings"
                      className="report-tab"
                      aria-label="Rankings"
                    >
                      <ListOrdered className="h-4 w-4" aria-hidden="true" />
                      <span className="report-tab-label-full" aria-hidden="true">
                        Rankings
                      </span>
                      <span className="report-tab-label-short" aria-hidden="true">
                        Rank
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="trades"
                      className="report-tab"
                      aria-label="Trade History"
                    >
                      <Repeat2 className="h-4 w-4" aria-hidden="true" />
                      <span className="report-tab-label-full" aria-hidden="true">
                        Trades
                      </span>
                      <span className="report-tab-label-short" aria-hidden="true">
                        Trade
                      </span>
                    </TabsTrigger>

                    {shouldShowDraftHistoryTab && (
                      <TabsTrigger
                        value="draft"
                        className="report-tab"
                        aria-label="Draft History"
                      >
                        <ClipboardList className="h-4 w-4" aria-hidden="true" />
                        <span
                          className="report-tab-label-full"
                          aria-hidden="true"
                        >
                          Draft
                        </span>
                        <span
                          className="report-tab-label-short"
                          aria-hidden="true"
                        >
                          Drafts
                        </span>
                      </TabsTrigger>
                    )}
                  </TabsList>

                  {/* Right: League Name + shortcuts */}
                  <div className="report-league-zone md:col-start-3">
                    <button
                      type="button"
                      className="report-league-lockup"
                      onClick={handleHeaderLeagueClick}
                      aria-label="Open league switcher"
                    >
                      <div className="min-w-0 text-right">
                        <p className="truncate text-sm font-semibold text-orange-400 sm:text-lg md:text-xl">
                          {leagueName}
                        </p>
                        {leagueFormatPills.length > 0 && (
                          <p
                            className="report-league-format-row text-[11px] font-medium text-cyan-200/70 sm:text-xs"
                            aria-label={`League format: ${leagueFormatPills.join(", ")}`}
                          >
                            {leagueFormatPills.map(chip => (
                              <span
                                key={chip}
                                className="report-inline-pill report-league-format-pill"
                              >
                                {chip}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="report-header-league-avatar"
                      onClick={handleHeaderLeagueClick}
                      aria-label="Open league switcher"
                    >
                      {leagueLogo ? (
                        <img src={leagueLogo} alt="" aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true">
                          {getLeagueFallbackInitials(leagueName)}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <ReportSectionAccordionProvider scopeKey={resolvedActiveTab}>
            <div className="report-dashboard-shell">
              <main className="report-dashboard-main">
                <div
                  className="overview-command-canvas report-command-canvas"
                  data-active-tab={resolvedActiveTab}
                >
                  <ReportOverviewHero
                    leagueName={leagueName}
                    activeTab={resolvedActiveTab}
                    leagueValueMode={leagueValueMode}
                    reportData={reportDataForView}
                  />
                  <ReportSinceLastReportBrief
                    changes={reportDeltaChanges}
                    previousSavedAt={previousReportDeltaSnapshot?.savedAt}
                  />
                  <Suspense fallback={<ReportSectionLoadingFallback />}>
                    <TabsContent value="overview" className="report-tab-content">
                      <div className="dashboard-overview-section-stack space-y-6 sm:space-y-8">
                        {canViewAdminFeatureExpansion && (
                          <>
                          <OverviewAIPulse data={reportDataForView} />
                          <CollapsibleReportSection
                            title="Monthly Team Blueprint"
                            kicker="Monthly direction, roster age, and plan cadence"
                            premium
                            previewMetrics={[
                              {
                                label: "Cadence",
                                value: "Monthly",
                                tone: "neutral",
                              },
                              {
                                label: "Plan Lens",
                                value:
                                  leagueValueMode === "redraft"
                                    ? "Season"
                                    : "Dynasty",
                                tone: "neutral",
                              },
                              {
                                label: "Snapshot",
                                value: reportData.weeklyRisers?.length
                                  ? "Partial"
                                  : "Current",
                                tone: reportData.weeklyRisers?.length
                                  ? "info"
                                  : "warn",
                              },
                            ]}
                          >
                            <MonthlyTeamBlueprint
                              data={reportDataForView}
                              leagueName={leagueName}
                              leagueFormat={leagueFormat}
                              managerAvatars={reportData.managerAvatars}
                            />
                          </CollapsibleReportSection>
                          <CollapsibleReportSection
                            title="League Power Rankings"
                            kicker={
                              isRedraftReport
                                ? "Weekly league ordering and relative strength tiers"
                                : "League ordering, value tiers, and relative strength"
                            }
                            premium
                            previewMetrics={[
                              {
                                label: "Ranked Teams",
                                compactLabel: "Teams",
                                value: reportData.powerRankings?.length || 0,
                                tone: reportData.powerRankings?.length
                                  ? "info"
                                  : "warn",
                              },
                              {
                                label: "Ordering",
                                value: "Power",
                                tone: "neutral",
                              },
                              {
                                label: "Lens",
                                value: isRedraftReport ? "Weekly" : "Dynasty",
                                tone: "neutral",
                              },
                            ]}
                          >
                            <LeaguePowerRankings
                              data={reportDataForView}
                              managerAvatars={reportData.managerAvatars}
                            />
                          </CollapsibleReportSection>
                          <CollapsibleReportSection
                            title="Team Breakdown & Roster Recon"
                            kicker="Per-roster strengths, leaks, surplus, and next move"
                            premium
                            previewMetrics={[
                              {
                                label: "Scope",
                                value: "Team-by-team",
                                tone: "neutral",
                              },
                              {
                                label: "Recon Rows",
                                compactLabel: "Rows",
                                value:
                                  reportData.managerRosterIntelligence
                                    ?.length || 0,
                                tone: reportData.managerRosterIntelligence
                                  ?.length
                                  ? "info"
                                  : "warn",
                              },
                              {
                                label: "Flag Source",
                                compactLabel: "Flags",
                                value: reportData.positionDepth?.length || 0,
                                tone: reportData.positionDepth?.length
                                  ? "warn"
                                  : "neutral",
                              },
                            ]}
                          >
                            <TeamBreakdownRecon
                              data={reportDataForView}
                              managerAvatars={reportData.managerAvatars}
                            />
                          </CollapsibleReportSection>
                          <CollapsibleReportSection
                            title="Trade Finder"
                            kicker={
                              isRedraftReport
                                ? "Trade partners, upgrade lanes, and weekly pressure points"
                                : "Trade partners, package lanes, and league pressure points"
                            }
                            premium
                            previewMetrics={[
                              {
                                label: "Owner",
                                value: "Trade market",
                                tone: "neutral",
                              },
                              {
                                label: "Inputs",
                                value: isRedraftReport
                                  ? "Needs/Fits"
                                  : "Needs/Picks",
                                tone: "info",
                              },
                              {
                                label: isRedraftReport ? "Fit Rows" : "Pick Rows",
                                value: isRedraftReport
                                  ? reportData.managerRosterIntelligence
                                      ?.length || 0
                                  : reportData.pickPortfolios?.length || 0,
                                tone: (
                                  isRedraftReport
                                    ? reportData.managerRosterIntelligence
                                        ?.length
                                    : reportData.pickPortfolios?.length
                                )
                                  ? "info"
                                  : "warn",
                              },
                            ]}
                          >
                            <div className="command-expansion-stack">
                              <TradeFinderGenerator data={reportDataForView} />
                              <TradePartnerFinder
                                data={reportDataForView}
                                managerAvatars={reportData.managerAvatars}
                              />
                              <LeagueExploits
                                data={reportDataForView}
                                managerAvatars={reportData.managerAvatars}
                              />
                            </div>
                          </CollapsibleReportSection>
                          {SHOW_ASSISTANT_FEATURE_RADAR && (
                            <CollapsibleReportSection
                              title="Assistant Feature Radar"
                              kicker="Useful shells without fake data"
                              premium
                              previewMetrics={[
                                {
                                  label: "Status",
                                  value: "Shells",
                                  tone: "neutral",
                                },
                                {
                                  label: "Data",
                                  value: "No fake reads",
                                  tone: "info",
                                },
                                {
                                  label: "Mode",
                                  value: "Inventory",
                                  tone: "neutral",
                                },
                              ]}
                            >
                              <AssistantFeatureShells
                                data={reportDataForView}
                                leagueName={leagueName}
                                leagueId={leagueId}
                              />
                            </CollapsibleReportSection>
                          )}
                        </>
                      )}
                        {(() => {
                          const hasTaxiTriage =
                            !isRedraftReport &&
                            reportData.managerRosterIntelligence?.some(
                              row => (row.taxiTriage?.items.length || 0) > 0
                            );
                          return (
                            <>
                            <CollapsibleReportSection
                              title={modeCopy.ownerTitle}
                              kicker={modeCopy.ownerKicker}
                              defaultOpen
                              previewAccessory={
                                !isRedraftReport ? (
                                  <OwnerIntelSortControls
                                    value={ownerIntelSortMode}
                                    onChange={setOwnerIntelSortMode}
                                  />
                                ) : undefined
                              }
                              previewMetrics={
                                !isRedraftReport
                                  ? buildOwnerIntelPreviewMetrics(
                                      reportDataForView,
                                      ownerIntelSortMode
                                    )
                                  : undefined
                              }
                            >
                              <OwnerIntelMatrix
                                data={reportDataForView}
                                managerAvatars={reportData.managerAvatars}
                                leagueId={leagueId}
                                leagueLogo={leagueLogo}
                                viewerManager={effectiveViewerManager}
                                currentStandings={reportData.currentStandings}
                                leagueValueMode={leagueValueMode}
                                ownerIntelSortMode={ownerIntelSortMode}
                              />
                            </CollapsibleReportSection>
                            <CollapsibleReportSection
                              title={modeCopy.rosterTitle}
                              kicker={modeCopy.rosterKicker}
                              defaultOpen
                              previewMetrics={buildRosterPreviewMetrics(
                                reportData
                              )}
                            >
                              <LeagueCommandCenter
                                data={reportDataForView}
                                managerAvatars={reportData.managerAvatars}
                                leagueId={leagueId}
                                leagueLogo={leagueLogo}
                                section="roster"
                                viewerManager={effectiveViewerManager}
                                currentStandings={reportData.currentStandings}
                                leagueValueMode={leagueValueMode}
                              />
                            </CollapsibleReportSection>
                            {hasTaxiTriage && (
                              <CollapsibleReportSection
                                title="Taxi Squad Triage"
                                kicker="Taxi-only activation checks"
                                defaultOpen
                                previewMetrics={buildTaxiPreviewMetrics(
                                  reportData
                                )}
                              >
                                <LeagueCommandCenter
                                  data={reportDataForView}
                                  managerAvatars={reportData.managerAvatars}
                                  leagueId={leagueId}
                                  leagueLogo={leagueLogo}
                                  section="taxi"
                                  viewerManager={effectiveViewerManager}
                                  currentStandings={reportData.currentStandings}
                                />
                              </CollapsibleReportSection>
                            )}
                            {reportData.managerPositionCounts.length > 0 && (
                              <CollapsibleReportSection
                                title="Manager Position Counts"
                                kicker={
                                  isRedraftReport
                                    ? "Starter depth and position gaps"
                                    : "Full roster depth map"
                                }
                                defaultOpen
                                previewMetrics={buildManagerPositionRoomPreviewMetrics(
                                  reportData
                                )}
                              >
                                <ManagerPositionCountsTable
                                  data={reportData.managerPositionCounts}
                                  positionDepth={reportData.positionDepth}
                                  managerAvatars={reportData.managerAvatars}
                                  playerDetailsById={
                                    reportData.playerDetailsById
                                  }
                                  leagueId={leagueId}
                                  leagueLogo={leagueLogo}
                                  viewerManager={effectiveViewerManager}
                                  leagueValueMode={leagueValueMode}
                                />
                              </CollapsibleReportSection>
                            )}
                            </>
                          );
                        })()}
                      </div>
                    </TabsContent>

                  {canViewAutopilotTab && (
                    <TabsContent
                      value="autopilot"
                      className="report-tab-content report-command-tab-body"
                    >
                      <ErrorBoundary
                        fallback={(error, reset) => (
                          <AutopilotErrorFallback
                            error={error}
                            onRetry={reset}
                          />
                        )}
                      >
                        <AITeamAutopilot
                          reportData={reportDataForView}
                          leagueId={leagueId}
                          leagueName={leagueName}
                          leagueFormat={leagueFormat}
                          leagueValueMode={leagueValueMode}
                        />
                      </ErrorBoundary>
                    </TabsContent>
                  )}

                  <TabsContent
                    value="momentum"
                    className="report-tab-content report-command-tab-body"
                  >
                    <div className="report-command-section-stack space-y-6 sm:space-y-8">
                      {showTradeMarketRadar && (
                        <CollapsibleReportSection
                          title="Trade Market Radar"
                          kicker={
                            isRedraftReport
                              ? "Current-season buy and sell signals"
                              : "Buy and sell signals"
                          }
                          previewMetrics={buildMomentumPreviewMetrics(
                            reportData
                          )}
                        >
                          <TradeMarketRadar
                            risers={reportData.weeklyRisers}
                            fallers={reportData.weeklyFallers}
                            managerAvatars={reportData.managerAvatars}
                            playerDetailsById={reportData.playerDetailsById}
                            leagueId={leagueId}
                            leagueLogo={leagueLogo}
                            viewerManager={effectiveViewerManager}
                            leagueValueMode={leagueValueMode}
                          />
                        </CollapsibleReportSection>
                      )}
                      {canViewAdminFeatureExpansion && (
                        <CollapsibleReportSection
                          title="Waiver Intelligence"
                          kicker={
                            isRedraftReport
                              ? "Opportunity, usage, and roster need"
                              : "Available value"
                          }
                          previewMetrics={buildMomentumPreviewMetrics(
                            reportData
                          )}
                          premium
                        >
                          <WaiverIntelligencePanel
                            data={reportData.waiverIntelligence}
                            managerAvatars={reportData.managerAvatars}
                            playerDetailsById={reportData.playerDetailsById}
                            leagueId={leagueId}
                            leagueLogo={leagueLogo}
                            viewerManager={effectiveViewerManager}
                            managerRosterIntelligence={
                              reportData.managerRosterIntelligence
                            }
                            managerPositionCounts={
                              reportData.managerPositionCounts
                            }
                            positionDepth={reportData.positionDepth}
                            leagueDiagnostics={reportData.leagueDiagnostics}
                            recentTransactions={reportData.recentTransactions}
                            leagueValueMode={leagueValueMode}
                            scheduleEdgeTargets={reportData.scheduleEdgeTargets}
                            calibrationProfile={reportData.aiCalibrationAdjustmentProfile}
                          />
                        </CollapsibleReportSection>
                      )}
                      <CollapsibleReportSection
                        title="Recent Transactions"
                        kicker={
                          isRedraftReport
                            ? "Claims, drops, and weekly churn"
                            : "Claims, drops, and churn"
                        }
                        previewMetrics={buildRecentTransactionPreviewMetrics(
                          reportData.recentTransactions,
                          leagueValueMode
                        )}
                      >
                        <RecentTransactionsPanel
                          data={reportData.recentTransactions}
                          managerAvatars={reportData.managerAvatars}
                          playerDetailsById={reportData.playerDetailsById}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          leagueValueMode={leagueValueMode}
                        />
                      </CollapsibleReportSection>
                      <CollapsibleReportSection
                        title="Market Movers"
                        kicker="Biggest weekly value swings"
                        previewMetrics={buildMomentumPreviewMetrics(
                          reportData
                        )}
                      >
                        <WeeklyMomentumTable
                          data={[]}
                          sections={[
                            {
                              title: "Top Trenders",
                              data: reportData.weeklyRisers,
                            },
                            {
                              title: "Biggest Sliders",
                              data: reportData.weeklyFallers,
                            },
                          ]}
                          title="Market Movers"
                          managerAvatars={reportData.managerAvatars}
                          playerDetailsById={reportData.playerDetailsById}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          viewerManager={effectiveViewerManager}
                          leagueValueMode={leagueValueMode}
                        />
                      </CollapsibleReportSection>
                      <CollapsibleReportSection
                        title="Trending"
                        kicker={
                          isRedraftReport
                            ? "Sleeper add and drop activity"
                            : "Sleeper market heat"
                        }
                        previewMetrics={buildCombinedTrendingPreviewMetrics(
                          reportData
                        )}
                      >
                        <TrendingPlayersTable
                          data={[]}
                          sections={[
                            {
                              title: "Top Trenders",
                              countLabel: "Adds",
                              data: reportData.trendingAdds || [],
                            },
                            {
                              title: "Top Drops",
                              countLabel: "Drops",
                              data: reportData.trendingDrops || [],
                            },
                          ]}
                          title="Trending"
                          countLabel="Adds"
                          managerAvatars={reportData.managerAvatars}
                          playerDetailsById={reportData.playerDetailsById}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          viewerManager={effectiveViewerManager}
                          leagueValueMode={leagueValueMode}
                        />
                      </CollapsibleReportSection>
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="rankings"
                    className="report-tab-content report-command-tab-body"
                  >
                    <div className="report-command-section-stack space-y-6 sm:space-y-8">
                      {reportData.managerRosterIntelligence?.length ? (
                        <CollapsibleReportSection
                          title="Scout Leaguemates"
                          kicker="Manager rank inventory"
                          openSignal={rosterScannerFocusKey}
                          previewAccessory={
                            !isRedraftReport ? (
                              <LeagueRosterScannerModeControls
                                value={leagueRosterScannerMode}
                                onChange={setLeagueRosterScannerMode}
                              />
                            ) : undefined
                          }
                        >
                          <LeagueRosterScanner
                            data={reportData.managerRosterIntelligence}
                            managerAvatars={reportData.managerAvatars}
                            playerDetailsById={reportData.playerDetailsById}
                            leagueOverview={reportData.leagueOverview}
                            powerRankings={reportData.powerRankings}
                            dynastyTimelines={reportData.dynastyTimelines}
                            pickPortfolios={reportData.pickPortfolios}
                            draftPicks={reportData.draftPicks}
                            leagueId={leagueId}
                            leagueLogo={leagueLogo}
                            viewerManager={effectiveViewerManager}
                            currentStandings={reportData.currentStandings}
                            leagueValueMode={leagueValueMode}
                            focusKey={rosterScannerFocusKey}
                            mode={
                              !isRedraftReport
                                ? leagueRosterScannerMode
                                : undefined
                            }
                            onModeChange={
                              !isRedraftReport
                                ? nextMode => {
                                    if (
                                      nextMode === "dynasty" ||
                                      nextMode === "contender" ||
                                      nextMode === "rebuilder"
                                    ) {
                                      setLeagueRosterScannerMode(nextMode);
                                    }
                                  }
                                : undefined
                            }
                          />
                        </CollapsibleReportSection>
                      ) : null}
                      <CollapsibleReportSection
                        title="Full Roster Rankings"
                        kicker={
                          isRedraftReport
                            ? "Current-season player values"
                            : "League-matched player values"
                        }
                      >
                        {rankingsQuery.isLoading && !rankingsForReport ? (
                          <div className="rankings-empty-state">
                            Loading league-matched rankings...
                          </div>
                        ) : (
                          <div className="space-y-4 sm:space-y-5">
                            {canViewAdminFeatureExpansion && (
                              <RankingsMarketRead data={reportDataForView} />
                            )}
                            <RankingsBoard
                              rankings={rankingsForReport}
                              playerDetailsById={reportData.playerDetailsById}
                              managerAvatars={reportData.managerAvatars}
                              leagueId={leagueId}
                              leagueLogo={leagueLogo}
                              viewerManager={effectiveViewerManager}
                              board={isRedraftReport ? "redraft" : "dynasty"}
                              hidePicks={isRedraftReport}
                              leagueValueMode={leagueValueMode}
                              leagueDiagnostics={reportData.leagueDiagnostics}
                              calibrationProfile={reportData.aiCalibrationAdjustmentProfile}
                              showAIReads={canViewAdminFeatureExpansion}
                            />
                          </div>
                        )}
                      </CollapsibleReportSection>
                      {canViewAdminFeatureExpansion && (
                        <AdminScheduleEdgeSection
                          reportData={reportDataForView}
                        />
                      )}
                      {!isRedraftReport && (
                        <CollapsibleReportSection
                          title="College Rankings"
                          kicker="Future rookie pipeline"
                          previewAccessory={
                            <span className="report-inline-pill rankings-header-context-pill">
                              2021-2027 Tracked
                            </span>
                          }
                        >
                          {rankingsQuery.isLoading && !rankingsForReport ? (
                            <div className="rankings-empty-state">
                              Loading college prospect rankings...
                            </div>
                          ) : (
                            <RankingsBoard
                              rankings={rankingsForReport}
                              playerDetailsById={reportData.playerDetailsById}
                              managerAvatars={reportData.managerAvatars}
                              leagueId={leagueId}
                              leagueLogo={leagueLogo}
                              viewerManager={effectiveViewerManager}
                              board="devy"
                              hidePicks
                              leagueValueMode={leagueValueMode}
                              leagueDiagnostics={reportData.leagueDiagnostics}
                              calibrationProfile={reportData.aiCalibrationAdjustmentProfile}
                              showAIReads={canViewAdminFeatureExpansion}
                            />
                          )}
                        </CollapsibleReportSection>
                      )}
                      {canViewAdminDiagnostics && (
                        <section
                          className="admin-diagnostics-shell ai-surface-r3f admin-diagnostics-shell-tron"
                          aria-label="Admin diagnostics"
                        >
                          <div className="admin-diagnostics-shell-header">
                            <span>Admin Diagnostics</span>
                            <p>
                              Operational checks separated from the league
                              report so normal owner analysis stays focused.
                            </p>
                          </div>
                          <AdminAICalibrationSection />
                          <AdminProviderTelemetrySection />
                          <AdminSourceCoverageSection />
                          <AdminTrafficTelemetrySection
                            onLeagueSelect={handleAnalyze}
                          />
                          <AdminValueDiagnosticsSection
                            reportData={reportDataForView}
                          />
                          <AdminLeagueSharpnessSection
                            reportData={reportDataForView}
                          />
                          <AdminManagerPersonalityIntelSection
                            reportData={reportDataForView}
                          />
                          <AdminAIReadoutDiagnosticsSection
                            reportData={reportDataForView}
                          />
                          <AdminPlayerReceiptDiagnosticsSection
                            reportData={reportDataForView}
                          />
                        </section>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="trades"
                    className="report-tab-content report-command-tab-body"
                  >
                    <div className="trade-sections report-command-section-stack space-y-6 sm:space-y-8">
                      {canViewAdminFeatureExpansion && (
                        <TradeBrowserRead data={reportDataForView} />
                      )}
                      {canViewAdminFeatureExpansion && (
                        <CollapsibleReportSection
                          title="Pending Trade Offers"
                          kicker="Pending, declined, rejected, and cancelled Sleeper transactions"
                          previewMetrics={buildTradeProposalPreviewMetrics(
                            reportData
                          )}
                          premium
                          defaultOpen
                        >
                          <TradeProposalSignalsTable
                            data={
                              reportData.adminTradeProposalSignals ||
                              reportData.tradeProposalSignals ||
                              []
                            }
                            managerAvatars={reportData.managerAvatars}
                          />
                        </CollapsibleReportSection>
                      )}
                      <CollapsibleReportSection
                        title="Trade War Room"
                        kicker={modeCopy.tradeWarKicker}
                        previewMetrics={buildTradePreviewMetrics(
                          reportData,
                          leagueValueMode,
                          "war-room"
                        )}
                      >
                        <TradeWarRoom
                          data={reportData.managerRosterIntelligence}
                          managerAvatars={reportData.managerAvatars}
                          playerDetailsById={reportData.playerDetailsById}
                          leagueOverview={reportData.leagueOverview}
                          rankings={rankingsForReport}
                          pickPortfolios={reportData.pickPortfolios}
                          draftPicks={reportData.draftPicks}
                          tradeTendencies={reportData.tradeTendencies}
                          tradeProposalSignals={[
                            ...(reportData.tradeProposalSignals || []),
                            ...(reportData.adminTradeProposalSignals || []),
                            ...(reportData.adminSleeperTradeProposalSignals ||
                              []),
                          ]}
                          recentTransactions={reportData.recentTransactions}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          viewerManager={effectiveViewerManager}
                          currentStandings={reportData.currentStandings}
                          leagueValueMode={leagueValueMode}
                          showManagerPersonalityIntel={canViewAdminDiagnostics}
                          onScoutLeaguemates={handleScoutLeaguemates}
                        />
                      </CollapsibleReportSection>
                      <CollapsibleReportSection
                        title={
                          isRedraftReport
                            ? "Trade Value Board"
                            : "Trade Profit Board"
                        }
                        kicker={
                          isRedraftReport
                            ? "Current-season trade edge"
                            : "Net trade edge"
                        }
                        previewMetrics={buildTradePreviewMetrics(
                          reportData,
                          leagueValueMode,
                          "leaderboard"
                        )}
                      >
                        <TradeProfitLeaderboardTable
                          data={reportData.tradeProfitLeaderboard}
                          managerAvatars={reportData.managerAvatars}
                          tradeHistory={reportData.tradeHistory}
                          draftPicks={reportData.draftPicks || []}
                          playerDetailsById={reportData.playerDetailsById}
                          currentPositionRankById={
                            reportData.currentPositionRankById
                          }
                          tradeTendencies={reportData.tradeTendencies}
                          managerRosterIntelligence={
                            reportData.managerRosterIntelligence
                          }
                          dynastyTimelines={reportData.dynastyTimelines}
                          leagueOverview={reportData.leagueOverview}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          viewerManager={effectiveViewerManager}
                          leagueDiagnostics={reportData.leagueDiagnostics}
                          currentStandings={reportData.currentStandings}
                          standingsHistory={reportData.standingsHistory}
                          leagueValueMode={leagueValueMode}
                        />
                      </CollapsibleReportSection>
                      <CollapsibleReportSection
                        title={
                          isRedraftReport
                            ? "Trade Balance Review"
                            : "Trade Theft Detector"
                        }
                        kicker={
                          isRedraftReport
                            ? "Largest current-season gaps"
                            : "Who got cooked"
                        }
                        previewMetrics={buildTradePreviewMetrics(
                          reportData,
                          leagueValueMode,
                          "theft"
                        )}
                      >
                        <TradeTheftDetector
                          data={reportData.tradeHistory}
                          managerAvatars={reportData.managerAvatars}
                          draftPicks={reportData.draftPicks || []}
                          playerDetailsById={reportData.playerDetailsById}
                          currentPositionRankById={
                            reportData.currentPositionRankById
                          }
                          managerRosterIntelligence={
                            reportData.managerRosterIntelligence
                          }
                          dynastyTimelines={reportData.dynastyTimelines}
                          leagueOverview={reportData.leagueOverview}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          leagueDiagnostics={reportData.leagueDiagnostics}
                          currentStandings={reportData.currentStandings}
                          standingsHistory={reportData.standingsHistory}
                          leagueValueMode={leagueValueMode}
                        />
                      </CollapsibleReportSection>
                      <ModalReportSection
                        title="Trade Receipts"
                        kicker="Every completed trade"
                        previewMetrics={buildTradePreviewMetrics(
                          reportData,
                          leagueValueMode,
                          "ledger"
                        )}
                      >
                        <TradeHistoryTable
                          data={reportData.tradeHistory}
                          draftPicks={reportData.draftPicks || []}
                          managerAvatars={reportData.managerAvatars}
                          playerDetailsById={reportData.playerDetailsById}
                          currentPositionRankById={
                            reportData.currentPositionRankById
                          }
                          managerRosterIntelligence={
                            reportData.managerRosterIntelligence
                          }
                          dynastyTimelines={reportData.dynastyTimelines}
                          leagueOverview={reportData.leagueOverview}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          leagueDiagnostics={reportData.leagueDiagnostics}
                          currentStandings={reportData.currentStandings}
                          standingsHistory={reportData.standingsHistory}
                          leagueValueMode={leagueValueMode}
                          variant="modal"
                        />
                      </ModalReportSection>
                    </div>
                  </TabsContent>

                  {shouldShowDraftHistoryTab && (
                    <TabsContent
                      value="draft"
                      className="report-tab-content report-command-tab-body"
                    >
                      <DraftAnalysis
                        draftPicks={reportData.draftPicks || []}
                        draftStats={reportData.draftStats || []}
                        managerRosterIntelligence={
                          reportData.managerRosterIntelligence
                        }
                        managerAvatars={reportData.managerAvatars}
                        playerDetailsById={reportData.playerDetailsById}
                        leagueId={leagueId}
                        leagueLogo={leagueLogo}
                        viewerManager={effectiveViewerManager}
                        currentStandings={reportData.currentStandings}
                        leagueOverview={reportData.leagueOverview}
                        leagueValueMode={leagueValueMode}
                        leagueDiagnostics={reportData.leagueDiagnostics}
                        calibrationProfile={reportData.aiCalibrationAdjustmentProfile}
                        showAIReads={canViewAdminFeatureExpansion}
                      />
                    </TabsContent>
                  )}
                  </Suspense>
                  <ReportDashboardSpotlight
                    manager={dashboardViewerManager}
                    activeTab={resolvedActiveTab}
                    leagueValueMode={leagueValueMode}
                    reportData={reportDataForView}
                    managerAvatars={reportData.managerAvatars}
                    variant="inline"
                  />
                </div>
              </main>
              <ReportDashboardSpotlight
                manager={dashboardViewerManager}
                activeTab={resolvedActiveTab}
                leagueValueMode={leagueValueMode}
                reportData={reportDataForView}
                managerAvatars={reportData.managerAvatars}
              />
            </div>

            {/* Bottom Action Buttons */}
            <div className="report-footer border-t border-orange-500/20 bg-slate-950/80 backdrop-blur">
              <HeaderCssLights className="dd-footer-css-lights" />
              <div className="dd-header-content mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
                <div className="report-footer-actions">
                  <div className="report-footer-primary-actions">
                    {(canOpenAdminToolsEntry ||
                      (canViewAdminFeatureExpansion && hasManagerViewOptions)) && (
                      <div className="report-footer-admin-row flex w-full max-w-[32rem] items-stretch justify-center gap-1.5 sm:w-auto sm:max-w-none sm:gap-2">
                        {canOpenAdminToolsEntry && (
                          <Button
                            type="button"
                            onClick={handleAdminToolsClick}
                            variant="outline"
                            className={`report-header-action report-footer-primary-action !w-auto shrink-0 px-2.5 sm:px-3 report-header-admin-toggle ${canViewAdminFeatureExpansion ? "report-header-admin-toggle-active" : ""}`}
                            aria-pressed={canViewAdminFeatureExpansion}
                            aria-label={
                              canViewAdminFeatureExpansion
                                ? "Switch to regular report view"
                                : isAdminPassphraseVerifiedForSession
                                  ? "Switch to admin report view"
                                  : "Unlock admin tools"
                            }
                            title={
                              canViewAdminFeatureExpansion
                                ? "Hide admin-only AI annotations and diagnostics"
                                : isAdminPassphraseVerifiedForSession
                                  ? "Show admin-only AI annotations and diagnostics"
                                  : "Enter the admin passphrase for this browser session"
                            }
                          >
                            <span className="report-header-action-label truncate">
                              {canViewAdminFeatureExpansion
                                ? "Regular Report"
                                : "Admin Tools"}
                            </span>
                          </Button>
                        )}
                        {canViewAdminFeatureExpansion && hasManagerViewOptions && (
                          <AdminManagerSwitcher
                            managers={reportManagerNames}
                            activeManager={effectiveViewerManager}
                            managerAvatars={reportData.managerAvatars}
                            onSelect={setAdminViewerManager}
                          />
                        )}
                      </div>
                    )}
                    <AIVoiceModeMenu
                      mode={aiVoiceMode}
                      onChange={handleAIVoiceModeChange}
                    />
                    <Button
                      onClick={handleAnalyzeAnotherLeague}
                      variant="outline"
                      className="report-header-action report-footer-primary-action report-switch-league-trigger !w-full max-w-[32rem] sm:!w-auto sm:max-w-none"
                      aria-label="Switch to another league report"
                    >
                      <span className="report-header-action-label">
                        Switch League
                      </span>
                    </Button>
                  </div>
                  <div className="report-footer-secondary-actions">
                    <SupportButton compact showExternalIcon={false} />
                    <FeedbackButton
                      compact
                      leagueId={leagueId}
                      leagueName={leagueName}
                      leagueFormat={leagueFormat}
                    />
                  </div>
                </div>
              </div>
            </div>
            </ReportSectionAccordionProvider>
            </Tabs>

            {leaguePickerDialog}

            <Dialog
              open={isChangeLeagueModalOpen}
              onOpenChange={setIsChangeLeagueModalOpen}
            >
              <DialogContent className="league-switch-dialog change-league-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-md">
                <DialogHeader className="change-league-header text-center sm:text-center">
                  <DialogTitle className="athletic-headline change-league-title text-3xl text-orange-400">
                    Change Leagues?
                  </DialogTitle>
                  <DialogDescription className="change-league-copy">
                    This report was opened from a league ID, so there is not a
                    saved Sleeper league list for this session. Stay on this
                    report, or start over to analyze a different league.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="league-switch-footer gap-2 sm:justify-center">
                  <button
                    type="button"
                    onClick={() => setIsChangeLeagueModalOpen(false)}
                    className="support-button support-button-compact change-league-stay-button"
                  >
                    Stay Here
                  </button>
                  <Button
                    type="button"
                    onClick={handleStartOver}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
                  >
                    Back to Home
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {clownEasterEggDialog}
          </div>
        </ManagerChampionshipProvider>
        {adminAccessDialog}
        {adminUnlockDialog}
      </>
    );
  }

  return (
    <>
      <div className="home-shell min-h-screen flex flex-col premium-fx-host" style={reportData && analysisCompleteMessage ? { opacity: 0 } : undefined}>
        <HomeHeaderChrome onBrandClick={handleStartOver} />
        <main className="home-main flex flex-col items-center justify-center">
          <div
            className={`home-hero home-hero-dashboard${showHomePortfolioPanel ? " home-hero-dashboard-portfolio" : ""}`}
          >
            {/* Main Title */}
            <div className="home-hero-copy space-y-3 sm:space-y-4 text-center">
              <h2
                className="athletic-title home-title"
                aria-label="Fuck vibes. Use AI."
              >
                <span className="home-title-primary" data-text="FUCK VIBES.">
                  FUCK VIBES...
                </span>
                <span className="home-title-accent" data-text="USE AI.">
                  USE AI.
                </span>
              </h2>
              <p className="home-subtitle text-base sm:text-lg md:text-xl text-slate-300 mx-auto">
                Your league mates are guessing.{" "}
                <span className="home-subtitle-ai">WE'RE NOT!</span>
              </p>
              <p className="home-subtitle-detail">
                We use AI to expose roster cracks,
                <br />
                {" "}
                trade windows, lineup leverage, and draft value before the rest
                of your league realizes
                <br />
                {" "}
                they're playing for second place.
              </p>
            </div>

            {/* Input Section */}
            <div className="home-analyze-card space-y-3 sm:space-y-4 p-4 sm:p-8">
              <div className="text-center">
                <label className="home-field-label block text-sm font-semibold text-slate-200 mb-2">
                  Enter Sleeper. Start Winning.
                </label>
                <div className="home-username-row flex flex-col gap-1.5 sm:flex-row sm:gap-2.5 w-full">
                  <div className="home-autocomplete-anchor flex-1 w-full sm:w-auto">
                    <Input
                      id="sleeper-username"
                      name="sleeper-username"
                      type="text"
                      aria-label="Enter Your Sleeper Username"
                      autoComplete="username"
                      list="sleeper-username-history"
                      placeholder="Sleeper username"
                      value={sleeperUsername}
                      onChange={e => setSleeperUsername(e.target.value)}
                      onFocus={() => setFocusedAutocomplete("username")}
                      onBlur={() =>
                        window.setTimeout(
                          () => setFocusedAutocomplete(null),
                          120
                        )
                      }
                      className="w-full bg-slate-900 border-cyan-500/30 text-white placeholder:text-slate-500 h-12 text-base focus:border-cyan-300 text-center sm:text-left"
                      onKeyDown={e => e.key === "Enter" && handleFindLeagues()}
                    />
                    <datalist id="sleeper-username-history">
                      {sleeperUsernameHistory.map(value => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                    {focusedAutocomplete === "username" ? (
                      <RecentEntrySuggestions
                        label="Recent Sleeper usernames"
                        options={usernameAutocompleteOptions}
                        onSelect={value => {
                          setSleeperUsername(value);
                          setFocusedAutocomplete(null);
                        }}
                      />
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={handleFindLeagues}
                    disabled={userLeaguesMutation.isPending}
                    className="home-find-leagues-button h-12 w-full shrink-0 rounded-lg border border-orange-400/40 bg-gradient-to-r from-orange-500 to-orange-600 px-5 font-bold text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
                  >
                    {userLeaguesMutation.isPending
                      ? "Finding Leagues..."
                      : "Find Leagues"}
                  </Button>
                </div>
              </div>

              {SHOW_LEGACY_LEAGUE_ID_LOGIN ? (
                <>
                  <div className="home-id-divider">
                    <span>or use a league ID</span>
                  </div>

                  <div className="text-center">
                    <label className="home-field-label block text-sm font-semibold text-slate-200 mb-2">
                      Enter Your Sleeper League ID
                    </label>
                    <div className="home-autocomplete-anchor w-full">
                      <Input
                        id="sleeper-league-id"
                        name="sleeper-league-id"
                        type="text"
                        aria-label="Enter Your Sleeper League ID"
                        autoComplete="on"
                        inputMode="numeric"
                        list="sleeper-league-id-history"
                        placeholder="Find in your Sleeper app settings or URL"
                        value={leagueId}
                        onChange={e => setLeagueId(e.target.value)}
                        onFocus={() => setFocusedAutocomplete("league")}
                        onBlur={() =>
                          window.setTimeout(
                            () => setFocusedAutocomplete(null),
                            120
                          )
                        }
                        className="w-full bg-slate-900 border-orange-500/30 text-white placeholder:text-slate-500 h-12 text-base focus:border-orange-400 text-center"
                        onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                      />
                      <datalist id="sleeper-league-id-history">
                        {leagueIdHistory.map(value => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                      {focusedAutocomplete === "league" ? (
                        <RecentEntrySuggestions
                          label="Recent Sleeper league IDs"
                          options={leagueIdAutocompleteOptions}
                          onSelect={value => {
                            setLeagueId(value);
                            setFocusedAutocomplete(null);
                          }}
                        />
                      ) : null}
                    </div>
                  </div>

                  <Button
                    onClick={() => handleAnalyze()}
                    disabled={isLoading}
                    className="home-analyze-button w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-base gap-2 rounded-lg transition-all duration-200 shadow-lg"
                  >
                    Run Degenerate Analysis
                  </Button>
                </>
              ) : null}
            </div>

            {!showHomePortfolioPanel ? (
              <div className="home-weapons-callout">
                <p className="home-weapons-callout-title">
                  <span className="home-weapons-callout-blue">
                    THESE AREN’T FEATURES.
                  </span>
                  <span className="home-weapons-callout-orange">
                    THEY’RE WEAPONS.
                  </span>
                </p>
                <p className="home-weapons-callout-copy">
                  <span className="home-weapons-copy-line">
                    Run the scan. Find the weakness. Send the offer.
                  </span>
                  <br />
                  {" "}
                  <span className="home-weapons-copy-line">
                    Make them regret inviting you.
                  </span>
                </p>
              </div>
            ) : null}

            {showHomePortfolioPanel ? (
              <HomePortfolioPanel
                rows={homePortfolioRows}
                filteredRows={filteredHomePortfolioRows}
                leagues={orderedUserLeagues}
                isLoading={isHomePortfolioLoading}
                query={portfolioSearch}
                onQueryChange={setPortfolioSearch}
                onLeagueSelect={handleAnalyzeLeagueOption}
              />
            ) : null}

            {/* Features Grid */}
            <div className="home-feature-carousel-window">
              <div className="home-feature-grid">
                <div className="home-feature-card home-feature-green p-4 sm:p-6 space-y-3">
                  <div className="home-feature-heading">
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <Flame className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="font-semibold text-white">Roster Roast</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    See who’s stacked, who’s cooked, and who’s one ACL away
                    from rebuilding their <span className="home-keep-together">trash ass team.</span>
                  </p>
                </div>

                <div className="home-feature-card home-feature-blue p-4 sm:p-6 space-y-3">
                  <div className="home-feature-heading">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Crosshair className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="font-semibold text-white">Trade Victims</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Find managers holding drops, fake depth, and players only
                    podcasters <span className="home-keep-together">really believe in.</span>
                  </p>
                </div>

                <div className="home-feature-card home-feature-purple p-4 sm:p-6 space-y-3">
                  <div className="home-feature-heading">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Swords className="w-6 h-6 text-purple-400" />
                    </div>
                    <h3 className="font-semibold text-white">Lineup Abuse</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Spot starter gaps and turn desperation into leverage plays
                    before your <span className="home-keep-together">buddies coffee hits.</span>
                  </p>
                </div>

                <div className="home-feature-card home-feature-orange p-4 sm:p-6 space-y-3">
                  <div className="home-feature-heading">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Gavel className="w-6 h-6 text-orange-300" />
                    </div>
                    <h3 className="font-semibold text-white">Draft Punishment</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Expose bad picks, wasted rookie value, and managers who let
                    their girlfriends <span className="home-keep-together">draft for them.</span>
                  </p>
                </div>

                <div className="home-feature-card home-feature-cyan p-4 sm:p-6 space-y-3">
                  <div className="home-feature-heading">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <Bot className="w-6 h-6 text-cyan-300" />
                    </div>
                    <h3 className="font-semibold text-white">AI League Bully</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Use AI to find weak rosters, bad offers, and managers one
                    panic trade away <span className="home-keep-together">from a Sacko.</span>
                  </p>
                </div>

                <div className="home-feature-card home-feature-amber p-4 sm:p-6 space-y-3">
                  <div className="home-feature-heading">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                      <Radar className="w-6 h-6 text-amber-300" />
                    </div>
                    <h3 className="font-semibold text-white">Waiver Vultures</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Find overlooked players, panic drops, and free scraps
                    before the rest of <span className="home-keep-together">the league notices.</span>
                  </p>
                </div>

                <div className="home-feature-card home-feature-card-clone home-feature-green p-4 sm:p-6 space-y-3" aria-hidden="true">
                  <div className="home-feature-heading">
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <Flame className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="font-semibold text-white">Roster Roast</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    See who’s stacked, who’s cooked, and who’s one ACL away
                    from rebuilding their <span className="home-keep-together">trash ass team.</span>
                  </p>
                </div>

                <div className="home-feature-card home-feature-card-clone home-feature-blue p-4 sm:p-6 space-y-3" aria-hidden="true">
                  <div className="home-feature-heading">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Crosshair className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="font-semibold text-white">Trade Victims</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Find managers holding drops, fake depth, and players only
                    podcasters <span className="home-keep-together">really believe in.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {!reportData && (
          <div className="home-footer mt-auto px-4 py-1">
            <HomeFooterChrome showBrand={!isLoading} />
          </div>
        )}
        {leaguePickerDialog}
        {clownEasterEggDialog}
      </div>
      {adminAccessDialog}
      {adminUnlockDialog}
      {loadingDialog}
    </>
  );
}
