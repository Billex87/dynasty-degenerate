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
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  CheckCircle2,
  Crosshair,
  Flame,
  Gavel,
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
import { AdminManagerSwitcher } from "@/features/report/components/AdminManagerSwitcher";
import { AutopilotErrorFallback } from "@/features/report/components/AutopilotErrorFallback";
import {
  ScheduleEdgePlayerCell,
  ScheduleEdgeWeekChip,
} from "@/features/report/components/AdminDiagnosticsPrimitives";
import {
  LeagueRosterScannerModeControls,
  OwnerIntelSortControls,
  type OwnerIntelSortMode,
} from "@/features/report/components/OwnerIntelControls";
import {
  formatDashboardSignedPercentLabel,
  getReportDashboardManagers,
  ReportDashboardSpotlight,
  ReportOverviewHero,
} from "@/features/report/components/ReportDashboardShowcase";
import {
  HomeFooterChrome,
  HomeHeaderChrome,
} from "@/features/home/components/HomeChrome";
import {
  ChangeLeagueDialog,
  LeaguePickerDialog,
} from "@/features/home/components/HomeLeagueDialogs";
import {
  HomePortfolioPanel,
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
  AdminAccessDialog,
  AdminUnlockDialog,
  AnalysisLoadingDialog,
  ClownEasterEggDialog,
  type AnalysisLoadingLeague,
  type LoadingTransitionPhase,
} from "@/features/report/components/ReportDialogs";
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
import type { ReportData } from "@shared/types";
import { buildAutopilotData } from "@/lib/autopilot/buildAutopilotData";
import { AUTOPILOT_MOCK_DATA } from "@/lib/autopilot/mockData";
import type { AIActionQueueItem } from "@/lib/autopilot/types";
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

import {
  AdminLeagueSharpnessSection,
  AdminManagerPersonalityIntelSection,
} from "@/features/admin/components/AdminReadoutSections";
import { AdminAIReadoutDiagnosticsSection } from "@/features/admin/components/AdminAIReadoutSections";
import { AdminPlayerReceiptDiagnosticsSection } from "@/features/admin/components/AdminPlayerReceiptSections";
import { AdminSourceCoverageSection } from "@/features/admin/components/AdminSourceCoverageSections";
import { AdminValueDiagnosticsSection } from "@/features/admin/components/AdminValueDiagnosticsSections";
import {
  AdminProviderTelemetrySection,
  AdminTrafficTelemetrySection,
} from "@/features/admin/components/AdminTrafficSections";
import { AdminAICalibrationSection } from "@/features/admin/components/AdminCalibrationSections";
import { AdminScheduleEdgeSection } from "@/features/admin/components/AdminScheduleEdgeSections";

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

  const leaguePickerDialog = (
    <LeaguePickerDialog
      open={isLeaguePickerOpen}
      leagues={orderedUserLeagues}
      sleeperUsername={sleeperUsername}
      activeCachedSleeperUser={activeCachedSleeperUser}
      isLeaguePickerIntelBusy={isLeaguePickerIntelBusy}
      onOpenChange={setIsLeaguePickerOpen}
      onLeagueSelect={handleAnalyzeLeagueOption}
      onStartOver={handleStartOver}
    />
  );

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
  const clownEasterEggDialog = (
    <ClownEasterEggDialog
      open={isClownModalOpen}
      onOpenChange={setIsClownModalOpen}
      onDismiss={handleClownDismiss}
    />
  );
  const adminAccessDialog = (
    <AdminAccessDialog
      open={isAdminAccessModalOpen}
      passphrase={adminPassphrase}
      isPending={adminLoginMutation.isPending}
      onOpenChange={open => {
        if (open) return;
        setIsAdminAccessModalOpen(false);
        setAdminPassphrase("");
      }}
      onPassphraseChange={setAdminPassphrase}
      onSubmit={() => adminLoginMutation.mutate({ passphrase: adminPassphrase })}
      onStayRegularView={() => {
        setIsAdminAccessModalOpen(false);
        setAdminPassphrase("");
      }}
    />
  );
  const adminUnlockDialog = (
    <AdminUnlockDialog
      open={hasAuthenticatedAdminPermissions && isAdminUnlockModalOpen}
      onDismiss={handleAdminUnlockModalDismiss}
    />
  );
  const loadingDialog = (
    <AnalysisLoadingDialog
      open={isLoading}
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

            <ChangeLeagueDialog
              open={isChangeLeagueModalOpen}
              onOpenChange={setIsChangeLeagueModalOpen}
              onStay={() => setIsChangeLeagueModalOpen(false)}
              onStartOver={handleStartOver}
            />

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
