import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
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
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Repeat2,
  ClipboardList,
  ListOrdered,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import {
  PremiumFxLayer,
  type PremiumFxVariant,
} from "@/components/PremiumFxLayer";
const SuccessCard3D = lazy(() => import("@/components/SuccessCard3D"));
import { SupportButton } from "@/components/SupportButton";
import { FeedbackButton } from "@/components/FeedbackButton";
import { ManagerChampionshipProvider } from "@/components/ManagerChampionships";
import {
  PlayerPill,
  PreviewMetricChips,
  ReportSectionHeader,
  type PreviewMetric,
} from "@/components/reportPrimitives";
import {
  getLeagueModeCopy,
  getPlayerRankForMode,
  normalizeLeagueValueMode,
  type LeagueValueMode,
} from "@/lib/leagueValueMode";
import { sortRowsByViewerAndStanding } from "@/lib/managerOrdering";
import { getPositionRankClass } from "@/lib/positionRank";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import type { RankingSourceDiagnostic, ReportData } from "@shared/types";
import type { AppRouter } from "../../../server/routers";

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
const TradeProfitLeaderboardTable = lazy(
  () => import("@/components/reportTables/TradeProfitLeaderboardTable")
);
const TradeHistoryTable = lazy(
  () => import("@/components/reportTables/TradeHistoryTable")
);
const TradeProposalSignalsTable = lazy(
  () => import("@/components/reportTables/TradeProposalSignalsTable")
);
const SleeperWaiverClaimsTable = lazy(
  () => import("@/components/reportTables/SleeperWaiverClaimsTable")
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

const DYNASTY_LOGO_SRC =
  "/assets/dynasty-logo-cropped.png?v=20260512-orange-dd-monogram";
const REPORT_CACHE_DATA_VERSION = "draft-baseline-v2";
const REPORT_CACHE_KEY = "dynasty-degenerates:last-report:v20";
const REPORT_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
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
];
const LAST_LEAGUE_KEY = "dynasty-degenerates:last-league:v1";
const SLEEPER_SESSION_KEY = "dynasty-degenerates:sleeper-session:v1";
const LEAGUE_ID_HISTORY_KEY = "dynasty-degenerates:league-id-history:v1";
const SLEEPER_USERNAME_HISTORY_KEY =
  "dynasty-degenerates:sleeper-username-history:v1";
const CACHED_SLEEPER_USERS_KEY = "dynasty-degenerates:sleeper-user-history:v1";
const ADMIN_UNLOCK_MODAL_DISMISSED_KEY =
  "dynasty-degenerates:admin-unlock-dismissed:v1";
const SLEEPER_HIDDEN_CONSENT_KEY =
  "dynasty-degenerates:sleeper-hidden-consent:v1";
const MAX_AUTOCOMPLETE_HISTORY = 12;
const MAX_CACHED_SLEEPER_USERS = 5;
const MAX_RECENT_LEAGUES_PER_USER = 3;
const MAX_REPORT_HEADER_LEAGUES = 4;
const LEAGUE_VIEW_MANAGER_VALUE = "__league__";
const ADMIN_VALUE_DIAGNOSTIC_START_DATE = "2026-05-07";
const CLOWN_EASTER_EGG_USERNAMES = new Set(["armchairgmzar", "tjsmoov"]);
const REPORT_SUCCESS_REVEAL_DELAY_MS = 1150;
const REPORT_SUCCESS_READ_AFTER_REVEAL_MS = 850;
const REPORT_SUCCESS_KICK_MS = 900;
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
type OwnerIntelSortMode = "dynasty" | "contender" | "rebuilder";
type SleeperHiddenConsentRecord = {
  acknowledgedAt: number;
  sharedAt: number | null;
};
type SleeperHiddenConsentMap = Record<string, SleeperHiddenConsentRecord>;

function getKtcAdminIdentity(
  user?: SleeperUserSession | null,
  fallbackUsername?: string
): string | null {
  return user?.username || user?.displayName || fallbackUsername || null;
}

function normalizeViewerIdentifier(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function getSleeperHiddenConsentStorageKey(
  leagueId?: string | null,
  userKey?: string | null
): string | null {
  const normalizedLeagueId = String(leagueId || "").trim();
  if (!normalizedLeagueId) return null;
  const normalizedUserKey = normalizeViewerIdentifier(userKey);
  return `${normalizedLeagueId}:${normalizedUserKey || "league"}`;
}

function readSleeperHiddenConsentMap(): SleeperHiddenConsentMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SLEEPER_HIDDEN_CONSENT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as SleeperHiddenConsentMap)
      : {};
  } catch {
    return {};
  }
}

function writeSleeperHiddenConsentMap(map: SleeperHiddenConsentMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SLEEPER_HIDDEN_CONSENT_KEY,
      JSON.stringify(map)
    );
  } catch {
    // Local storage can be unavailable in privacy-restricted contexts.
  }
}

function rememberSleeperHiddenConsent(input: {
  leagueId: string;
  userKey?: string | null;
  sharedAt?: number | null;
}): SleeperHiddenConsentMap {
  const key = getSleeperHiddenConsentStorageKey(input.leagueId, input.userKey);
  if (!key) return readSleeperHiddenConsentMap();

  const next = {
    ...readSleeperHiddenConsentMap(),
    [key]: {
      acknowledgedAt: Date.now(),
      sharedAt: Number(input.sharedAt || Date.now()),
    },
  };
  writeSleeperHiddenConsentMap(next);
  return next;
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

function ReportSectionLoadingFallback() {
  return (
    <div className="rankings-empty-state" role="status" aria-live="polite">
      Loading report section...
    </div>
  );
}

function ProspectArchiveLoadingState() {
  return (
    <div className="prospect-archive-loading" role="status" aria-live="polite">
      <div className="prospect-archive-loading__logo" aria-hidden="true">
        <img src="/assets/ncaa-logo.svg" alt="" />
      </div>
      <div className="prospect-archive-loading__copy">
        <span>Scouting Data Archive</span>
        <strong>Getting college prospects</strong>
        <p>
          Loading Draft Buzz scores, class filters, position ranks, and verified
          combine measurables.
        </p>
      </div>
      <div className="prospect-archive-loading__badges" aria-hidden="true">
        <span>NCAA</span>
        <span>Draft Buzz</span>
        <span>Prospect Scores</span>
      </div>
    </div>
  );
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
  return REPORT_TAB_VALUES.includes(
    normalized as (typeof REPORT_TAB_VALUES)[number]
  )
    ? normalized
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

function getBestManagerByValue(data: ReportData): string | null {
  return (
    [...(data.leagueOverview || [])].sort(
      (a, b) => a.rank_value - b.rank_value
    )[0]?.manager || null
  );
}

const OWNER_INTEL_SORT_OPTIONS: Array<{
  key: OwnerIntelSortMode;
  label: string;
  shortLabel: string;
}> = [
  { key: "dynasty", label: "Dynasty", shortLabel: "DYN" },
  { key: "contender", label: "Contender", shortLabel: "CON" },
  { key: "rebuilder", label: "Rebuilder", shortLabel: "REB" },
];

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

function getOwnerIntelPreviewScore(
  data: ReportData,
  manager: string,
  sortMode: OwnerIntelSortMode
): number | null {
  const powerRow = data.powerRankings?.find(row => row.manager === manager);
  const timelineRow = data.dynastyTimelines?.find(
    row => row.manager === manager
  );

  const score =
    sortMode === "contender"
      ? (timelineRow?.contenderScore ?? powerRow?.starterStrength)
      : sortMode === "rebuilder"
        ? (timelineRow?.rebuildScore ?? powerRow?.draftCapital)
        : powerRow?.rosterValue;

  const numericScore = Number(score);
  return Number.isFinite(numericScore) ? numericScore : null;
}

function getOwnerIntelPreviewManagers(
  data: ReportData,
  sortMode: OwnerIntelSortMode
): {
  leader: string | null;
  weakest: string | null;
} {
  const managers = Array.from(
    new Set(
      [
        ...(data.managerRosterIntelligence || []).map(row => row.manager),
        ...(data.leagueOverview || []).map(row => row.manager),
      ].filter(Boolean)
    )
  );

  const scoredManagers = managers
    .map(manager => ({
      manager,
      score: getOwnerIntelPreviewScore(data, manager, sortMode),
    }))
    .filter(
      (item): item is { manager: string; score: number } => item.score !== null
    )
    .sort((a, b) => b.score - a.score || a.manager.localeCompare(b.manager));

  return {
    leader: scoredManagers[0]?.manager || null,
    weakest:
      scoredManagers.length > 1
        ? scoredManagers[scoredManagers.length - 1].manager
        : null,
  };
}

function OwnerIntelSortControls({
  value,
  onChange,
}: {
  value: OwnerIntelSortMode;
  onChange: (nextValue: OwnerIntelSortMode) => void;
}) {
  return (
    <span className="owner-intel-sort-controls" aria-label="Sort managers">
      {OWNER_INTEL_SORT_OPTIONS.map(option => (
        <button
          key={option.key}
          type="button"
          className={`owner-intel-sort-button${value === option.key ? " owner-intel-sort-button-active" : ""}`}
          aria-pressed={value === option.key}
          data-owner-intel-sort={option.key}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onChange(option.key);
          }}
        >
          <span className="owner-intel-sort-label-full">{option.label}</span>
          <span className="owner-intel-sort-label-short">
            {option.shortLabel}
          </span>
        </button>
      ))}
    </span>
  );
}

function buildOwnerPreviewMetrics(
  data: ReportData,
  mode: LeagueValueMode,
  sortMode: OwnerIntelSortMode = "dynasty"
): PreviewMetric[] {
  const valueLeader = getBestManagerByValue(data);
  const starterLeader = [...(data.powerRankings || [])].sort(
    (a, b) => b.starterStrength - a.starterStrength
  )[0]?.manager;
  const starterWeakest = [...(data.powerRankings || [])].sort(
    (a, b) => a.starterStrength - b.starterStrength
  )[0]?.manager;
  const ownerPreviewManagers = getOwnerIntelPreviewManagers(data, sortMode);

  return mode === "redraft"
    ? ([
        {
          label: "Starter Leader",
          value: renderPreviewManagerIdentity(
            starterLeader || valueLeader,
            data.managerAvatars
          ),
          tone: "good",
          className: "analysis-preview-chip-manager-preview",
        },
        starterWeakest
          ? {
              label: "Weakest",
              value: renderPreviewManagerIdentity(
                starterWeakest,
                data.managerAvatars
              ),
              tone: "warn",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
      ].filter(Boolean) as PreviewMetric[])
    : ([
        {
          label: "Leader",
          value: renderPreviewManagerIdentity(
            ownerPreviewManagers.leader || valueLeader,
            data.managerAvatars
          ),
          tone: "good",
          className: "analysis-preview-chip-manager-preview",
        },
        ownerPreviewManagers.weakest
          ? {
              label: "Weakest",
              value: renderPreviewManagerIdentity(
                ownerPreviewManagers.weakest,
                data.managerAvatars
              ),
              tone: "warn",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
      ].filter(Boolean) as PreviewMetric[]);
}

function buildRosterPreviewMetrics(data: ReportData): PreviewMetric[] {
  const starterRows = [...(data.managerRosterIntelligence || [])].filter(
    row => row.manager
  );
  const starterScoreByManager = new Map(
    (data.powerRankings || []).map(row => [
      row.manager,
      row.starterStrength || 0,
    ])
  );
  const getStarterPreviewScore = (
    row: NonNullable<ReportData["managerRosterIntelligence"]>[number]
  ) =>
    row.starterSeasonValue ||
    row.starterValue ||
    starterScoreByManager.get(row.manager) ||
    0;
  const orderedStarterRows = starterRows.sort(
    (a, b) => getStarterPreviewScore(b) - getStarterPreviewScore(a)
  );
  const strongestStarterManager = orderedStarterRows[0]?.manager || null;
  const weakestStarterManager =
    orderedStarterRows.length > 1
      ? orderedStarterRows[orderedStarterRows.length - 1]?.manager || null
      : null;
  return [
    {
      label: "Strongest Starters",
      compactLabel: "Strongest",
      value: renderPreviewManagerIdentity(
        strongestStarterManager,
        data.managerAvatars
      ),
      tone: "good",
      className: "analysis-preview-chip-starter-room",
    },
    weakestStarterManager
      ? {
          label: "Weakest Starters",
          compactLabel: "Weakest",
          value: renderPreviewManagerIdentity(
            weakestStarterManager,
            data.managerAvatars
          ),
          tone: "warn",
          className: "analysis-preview-chip-starter-room",
        }
      : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildTaxiPreviewMetrics(data: ReportData): PreviewMetric[] {
  const taxiRows = [...(data.managerRosterIntelligence || [])]
    .filter(row => row.manager && (row.taxiTriage?.items.length || 0) > 0)
    .map(row => ({
      row,
      promoteCount: Number(row.taxiTriage?.counts["Promote Now"] || 0),
      cutCount: Number(row.taxiTriage?.counts.Cuttable || 0),
    }));

  if (!taxiRows.length) return [];

  const mostPromotable =
    [...taxiRows]
      .filter(({ promoteCount }) => promoteCount > 0)
      .sort(
        (a, b) =>
          b.promoteCount - a.promoteCount ||
          b.cutCount - a.cutCount ||
          (b.row.taxiTriage?.items.length || 0) -
            (a.row.taxiTriage?.items.length || 0) ||
          a.row.manager.localeCompare(b.row.manager)
      )[0] || null;
  const mostCuttable =
    [...taxiRows]
      .filter(({ cutCount }) => cutCount > 0)
      .sort(
        (a, b) =>
          b.cutCount - a.cutCount ||
          b.promoteCount - a.promoteCount ||
          (b.row.taxiTriage?.items.length || 0) -
            (a.row.taxiTriage?.items.length || 0) ||
          a.row.manager.localeCompare(b.row.manager)
      )[0] || null;

  return [
    mostPromotable
      ? {
          label:
            mostPromotable.promoteCount === 1
              ? "Most Promotable"
              : `Most Promotable (${mostPromotable.promoteCount})`,
          value: renderPreviewManagerIdentity(
            mostPromotable.row.manager,
            data.managerAvatars
          ),
          tone: "good",
          className: "analysis-preview-chip-manager-preview",
        }
      : null,
    mostCuttable
      ? {
          label:
            mostCuttable.cutCount === 1
              ? "Most Cuttable"
              : `Most Cuttable (${mostCuttable.cutCount})`,
          value: renderPreviewManagerIdentity(
            mostCuttable.row.manager,
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
  const rosterCapacity = Number(
    data.leagueDiagnostics?.totalRosterSlots ||
      (data.leagueDiagnostics?.rosterSlots?.length || 0) +
        Number(data.leagueDiagnostics?.reserveSlots || 0) +
        Number(data.leagueDiagnostics?.taxiSlots || 0)
  );
  if (!rosterCapacity) return [];

  const roomRows = [...(data.managerPositionCounts || [])]
    .filter(row => row.manager)
    .map(row => ({
      row,
      room: rosterCapacity - Number(row.totalRosterPlayerCount || 0),
    }));

  const needToDrop =
    roomRows
      .filter(({ room }) => room < 0)
      .sort(
        (a, b) =>
          a.room - b.room ||
          Number(b.row.totalRosterPlayerCount || 0) -
            Number(a.row.totalRosterPlayerCount || 0) ||
          a.row.manager.localeCompare(b.row.manager)
      )[0] || null;
  const openRoom =
    roomRows
      .filter(({ room }) => room > 0)
      .sort(
        (a, b) =>
          b.room - a.room ||
          Number(a.row.totalRosterPlayerCount || 0) -
            Number(b.row.totalRosterPlayerCount || 0) ||
          a.row.manager.localeCompare(b.row.manager)
      )[0] || null;

  return [
    needToDrop
      ? {
          label:
            needToDrop.room === -1
              ? "Must Drop (1)"
              : `Must Drop (${Math.abs(needToDrop.room)})`,
          value: renderPreviewManagerIdentity(
            needToDrop.row.manager,
            data.managerAvatars
          ),
          tone: "warn",
          className: "analysis-preview-chip-manager-preview",
        }
      : null,
    openRoom
      ? {
          label:
            openRoom.room === 1 ? "Can Add (1)" : `Can Add (${openRoom.room})`,
          value: renderPreviewManagerIdentity(
            openRoom.row.manager,
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
  const managerIntel = data.managerRosterIntelligence || [];

  const uniqueTradeManagers = new Set<string>();
  tradeHistory.forEach(trade => {
    if (trade.team_a) uniqueTradeManagers.add(trade.team_a);
    if (trade.team_b) uniqueTradeManagers.add(trade.team_b);
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
  const taxiRows = managerIntel.filter(
    row => (row.taxiTriage?.items.length || 0) > 0
  );
  const promotableRows = [...managerIntel]
    .filter(row => (row.taxiTriage?.counts["Promote Now"] || 0) > 0)
    .sort(
      (a, b) =>
        (b.taxiTriage?.counts["Promote Now"] || 0) -
          (a.taxiTriage?.counts["Promote Now"] || 0) ||
        a.manager.localeCompare(b.manager)
    );
  const cuttableRows = [...managerIntel]
    .filter(row => (row.taxiTriage?.counts.Cuttable || 0) > 0)
    .sort(
      (a, b) =>
        (b.taxiTriage?.counts.Cuttable || 0) -
          (a.taxiTriage?.counts.Cuttable || 0) ||
        a.manager.localeCompare(b.manager)
    );
  const topPromotable = promotableRows[0] || null;
  const topCuttable = cuttableRows[0] || null;
  const topPromotableCount =
    topPromotable?.taxiTriage?.counts["Promote Now"] || 0;
  const topCuttableCount = topCuttable?.taxiTriage?.counts.Cuttable || 0;
  const cookedManager = getTradeLoserManager(biggestGap);

  switch (section) {
    case "war-room":
      return [
        {
          label: "Managers",
          value: managerIntel.length,
          tone: managerIntel.length ? "info" : "warn",
        },
        topPromotable
          ? {
              label: `Most promotable${topPromotableCount ? ` (${topPromotableCount})` : ""}`,
              value: renderPreviewManagerIdentity(
                topPromotable.manager,
                data.managerAvatars
              ),
              tone: "good",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
        topCuttable
          ? {
              label: `Most cuttable${topCuttableCount ? ` (${topCuttableCount})` : ""}`,
              value: renderPreviewManagerIdentity(
                topCuttable.manager,
                data.managerAvatars
              ),
              tone: "danger",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
        {
          label: "Taxi triage",
          value: taxiRows.length,
          tone: taxiRows.length ? "info" : "neutral",
        },
      ].filter(Boolean) as PreviewMetric[];
    case "leaderboard":
      return [
        {
          label: "Trades",
          value: tradeTendencies.length,
          tone: tradeTendencies.length ? "info" : "warn",
        },
        bestProfit
          ? {
              label: `Top profit (${formatPreviewNumber(bestProfit.profit)})`,
              value: renderPreviewManagerIdentity(
                bestProfit.manager,
                data.managerAvatars
              ),
              tone: bestProfit.profit >= 0 ? "good" : "danger",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
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
        {
          label: "Trades",
          value: tradeHistory.length,
          tone: tradeHistory.length ? "info" : "warn",
        },
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
        biggestGap
          ? {
              label: "Largest gap",
              value: formatPreviewNumber(Math.abs(biggestGap.point_gap || 0)),
              tone: "warn",
            }
          : null,
        {
          label: "Trade managers",
          value: uniqueTradeManagers.size,
          tone: uniqueTradeManagers.size ? "neutral" : "warn",
        },
      ].filter(Boolean) as PreviewMetric[];
    case "ledger":
    default:
      return [
        {
          label: "Trades",
          value: tradeHistory.length,
          tone: tradeHistory.length ? "info" : "warn",
        },
        {
          label: "Trade managers",
          value: uniqueTradeManagers.size,
          tone: uniqueTradeManagers.size ? "neutral" : "warn",
        },
        latestTrade
          ? {
              label: "Latest trade",
              value: formatPreviewDate(latestTrade.date),
              tone: "info",
            }
          : null,
        biggestGap
          ? {
              label: `Largest gap (${formatPreviewNumber(Math.abs(biggestGap.point_gap || 0))})`,
              value: renderPreviewManagerIdentity(
                biggestGap.winner,
                data.managerAvatars
              ),
              tone: "warn",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
      ].filter(Boolean) as PreviewMetric[];
  }
}

function buildDraftPreviewMetrics(
  data: ReportData,
  mode: LeagueValueMode
): PreviewMetric[] {
  const picks = data.draftPicks || [];
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
  return [
    {
      label: "Picks",
      value: picks.length,
      tone: picks.length ? "info" : "warn",
    },
    topGain
      ? {
          label: mode === "redraft" ? "Best Current Gain" : "Top Value Gain",
          value: topGain.playerName,
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

function buildWeeklyRiserPreviewMetrics(data: ReportData): PreviewMetric[] {
  return [...(data.weeklyRisers || [])]
    .sort((a, b) => b.pct_change - a.pct_change)
    .slice(0, 2)
    .map(
      (player, index): PreviewMetric => ({
        label: `Riser ${index + 1}`,
        value: renderPreviewPlayerMetric(
          renderMomentumPreviewPlayer(player),
          formatPreviewPercent(player.pct_change)
        ),
        tone: "good",
        hideLabel: true,
      })
    );
}

function buildWeeklyFallerPreviewMetrics(data: ReportData): PreviewMetric[] {
  return [...(data.weeklyFallers || [])]
    .sort((a, b) => a.pct_change - b.pct_change)
    .slice(0, 2)
    .map(
      (player, index): PreviewMetric => ({
        label: `Faller ${index + 1}`,
        value: renderPreviewPlayerMetric(
          renderMomentumPreviewPlayer(player),
          formatPreviewPercent(player.pct_change)
        ),
        tone: "danger",
        hideLabel: true,
      })
    );
}

function buildTrendingPreviewMetrics(
  players: NonNullable<ReportData["trendingAdds"]>,
  direction: "up" | "down"
): PreviewMetric[] {
  return [...players]
    .sort((a, b) => b.count - a.count || (b.ktcValue || 0) - (a.ktcValue || 0))
    .slice(0, 4)
    .map(
      (player, index): PreviewMetric => ({
        label: `${direction === "up" ? "Add" : "Drop"} ${index + 1}`,
        value: renderPreviewPlayerMetric(
          renderTrendingPreviewPlayer(player),
          formatPreviewCount(player.count)
        ),
        tone: direction === "up" ? "good" : "danger",
        hideLabel: true,
      })
    );
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

function buildSleeperHiddenPreviewMetrics(
  reportData: ReportData
): PreviewMetric[] {
  const snapshot = reportData.sleeperHiddenLeagueSnapshot || null;
  const tradeSignals = [
    ...(reportData.adminSleeperTradeProposalSignals || []),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const waiverSignals = [...(reportData.adminSleeperWaiverSignals || [])].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date)
  );
  const latestSignal =
    [...tradeSignals, ...waiverSignals].sort(
      (a, b) => Date.parse(b.date) - Date.parse(a.date)
    )[0] || null;
  const sharedAtLabel = snapshot?.sharedAt
    ? new Date(snapshot.sharedAt).toLocaleDateString()
    : null;

  return [
    {
      label: "Trades",
      value: tradeSignals.length || snapshot?.tradeCount || 0,
      tone: tradeSignals.length || snapshot?.tradeCount || 0 ? "info" : "warn",
    },
    {
      label: "Waivers",
      value: waiverSignals.length || snapshot?.waiverCount || 0,
      tone:
        waiverSignals.length || snapshot?.waiverCount || 0 ? "info" : "warn",
    },
    {
      label: "Latest",
      value: latestSignal
        ? formatTradeProposalPreviewDate(latestSignal.date)
        : sharedAtLabel || "-",
      tone: latestSignal || sharedAtLabel ? "good" : "neutral",
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
};

type LeagueRankResult = Pick<
  SleeperLeagueOption,
  "leagueId" | "standingsRank" | "powerRank"
>;

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

function getLeagueShortcutsForUser(
  cachedUser: CachedSleeperUser | null,
  userLeagues: SleeperLeagueOption[],
  activeLeagueId?: string | null
): SleeperLeagueOption[] {
  const leagues = cachedUser?.leagues.length ? cachedUser.leagues : userLeagues;
  if (!leagues.length) return [];

  const leagueById = new Map(leagues.map(league => [league.leagueId, league]));
  const orderedIds = cachedUser?.recentLeagueIds || [];
  const seen = new Set<string>();
  return orderedIds
    .filter(leagueId => leagueId !== activeLeagueId)
    .filter(leagueId => {
      if (seen.has(leagueId)) return false;
      seen.add(leagueId);
      return leagueById.has(leagueId);
    })
    .map(leagueId => leagueById.get(leagueId))
    .filter((league): league is SleeperLeagueOption => Boolean(league))
    .slice(0, MAX_RECENT_LEAGUES_PER_USER);
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

function getReportHeaderLeagueShortcuts(
  leagues: SleeperLeagueOption[],
  activeLeagueId?: string | null
): SleeperLeagueOption[] {
  if (!leagues.length) return [];

  const activeLeague = leagues.find(
    league => league.leagueId === activeLeagueId
  );
  const orderedLeagues = activeLeague
    ? [
        activeLeague,
        ...leagues.filter(league => league.leagueId !== activeLeagueId),
      ]
    : leagues;

  return orderedLeagues.slice(0, MAX_REPORT_HEADER_LEAGUES);
}

function getReportManagerNames(
  reportData: ReportData,
  viewerManager?: string | null
): string[] {
  const managerNames = new Set<string>();
  const addManager = (value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) managerNames.add(trimmed);
  };

  Object.keys(reportData.managerAvatars || {}).forEach(addManager);
  Object.keys(reportData.managerChampionships || {}).forEach(addManager);
  (reportData.currentStandings || []).forEach(row => addManager(row.manager));
  (reportData.standingsHistory || []).forEach(row => addManager(row.manager));
  (reportData.leagueOverview || []).forEach(row => addManager(row.manager));
  (reportData.tradeProfitLeaderboard || []).forEach(row =>
    addManager(row.manager)
  );
  (reportData.managerPositionCounts || []).forEach(row =>
    addManager(row.manager)
  );
  (reportData.managerRosterIntelligence || []).forEach(row =>
    addManager(row.manager)
  );
  (reportData.tradeTendencies || []).forEach(row => addManager(row.manager));
  (reportData.powerRankings || []).forEach(row => addManager(row.manager));
  (reportData.dynastyTimelines || []).forEach(row => addManager(row.manager));
  (reportData.pickPortfolios || []).forEach(row => addManager(row.manager));
  (reportData.monthlyBlueprintHistory || []).forEach(row =>
    addManager(row.manager)
  );
  (reportData.matchupPreviews || []).forEach(row => addManager(row.manager));
  (reportData.recentTransactions || []).forEach(row => addManager(row.manager));
  (reportData.draftPicks || []).forEach(row => addManager(row.manager));
  addManager(reportData.viewerManager);

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
          className="report-header-action report-footer-primary-action !w-full justify-between gap-2 sm:!w-auto sm:min-w-[14rem] sm:max-w-[18rem]"
          aria-label={`View as ${selectedManagerLabel}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="report-header-action-label">View As</span>
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

function HomeLogoChrome() {
  return (
    <div className="home-header-inner max-w-7xl mx-auto">
      <div className="home-header-logo-wrap">
        <img
          src={DYNASTY_LOGO_SRC}
          alt="Dynasty Degenerates Logo"
          className="home-header-logo"
        />
      </div>
      <p className="home-header-slogan">
        Just some degens with scraping tools and A.I.
      </p>
    </div>
  );
}

function HomeCachedUserSwitcher({
  users,
  activeUsername,
  onSelect,
}: {
  users: CachedSleeperUser[];
  activeUsername: string;
  onSelect: (user: CachedSleeperUser) => void;
}) {
  if (!users.length) return null;

  const visibleUsers = users.slice(0, MAX_CACHED_SLEEPER_USERS).reverse();
  const activeIdentifier = normalizeViewerIdentifier(activeUsername);

  return (
    <div className="home-user-switcher" aria-label="Recent Sleeper accounts">
      <span className="home-user-switcher-label">Recent</span>
      <div className="home-user-stack">
        {visibleUsers.map((user, index) => {
          const label = user.displayName || user.username;
          const initials = label.slice(0, 2).toUpperCase();
          const isActive =
            activeIdentifier &&
            normalizeViewerIdentifier(user.username) === activeIdentifier;
          return (
            <button
              key={`${user.userId}-${user.username}`}
              type="button"
              className={`home-user-button${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(user)}
              style={{ zIndex: index + 1 }}
              title={`Use ${label}`}
              aria-label={`Use ${label}`}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" aria-hidden="true" />
              ) : (
                <span>{initials}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LeagueShortcutStack({
  leagues,
  activeLeagueId,
  onSelect,
  className,
  label = "Leagues",
  limit,
}: {
  leagues: SleeperLeagueOption[];
  activeLeagueId?: string | null;
  onSelect: (leagueId: string) => void;
  className?: string;
  label?: string;
  limit?: number;
}) {
  if (!leagues.length) return null;

  const visibleLeagueLimit =
    typeof limit === "number" ? limit : MAX_RECENT_LEAGUES_PER_USER;
  const visibleLeagues = leagues.slice(0, visibleLeagueLimit);

  return (
    <div
      className={`league-shortcut-switcher${className ? ` ${className}` : ""}`}
      aria-label="Previous league shortcuts"
    >
      <span className="league-shortcut-label">{label}</span>
      <div className="league-shortcut-stack">
        {visibleLeagues.map((league, index) => {
          const isActive = league.leagueId === activeLeagueId;
          return (
            <button
              key={league.leagueId}
              type="button"
              className={`league-shortcut-button${isActive ? " is-active" : ""}`}
              onClick={() => {
                if (!isActive) onSelect(league.leagueId);
              }}
              style={{ zIndex: visibleLeagues.length - index }}
              title={
                isActive ? `${league.name} is open` : `Open ${league.name}`
              }
              aria-label={
                isActive ? `${league.name} is open` : `Open ${league.name}`
              }
              aria-current={isActive ? "page" : undefined}
            >
              {league.avatarUrl ? (
                <img src={league.avatarUrl} alt="" aria-hidden="true" />
              ) : (
                <span>{getLeagueFallbackInitials(league.name)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HomeHeaderShortcuts({
  leagues,
  users,
  activeUsername,
  onLeagueSelect,
  onUserSelect,
}: {
  leagues: SleeperLeagueOption[];
  users: CachedSleeperUser[];
  activeUsername: string;
  onLeagueSelect: (leagueId: string) => void;
  onUserSelect: (user: CachedSleeperUser) => void;
}) {
  if (leagues.length) {
    return (
      <LeagueShortcutStack
        leagues={leagues}
        onSelect={onLeagueSelect}
        className="home-user-switcher home-league-shortcuts"
        label="Previous Leagues"
      />
    );
  }

  return (
    <HomeCachedUserSwitcher
      users={users}
      activeUsername={activeUsername}
      onSelect={onUserSelect}
    />
  );
}

function HomeBrandLockup() {
  return (
    <div className="home-footer-brand">
      <h1 className="home-header-title athletic-title mb-2">
        Dynasty
        <br />
        Degenerates
      </h1>
      <p className="home-header-tagline">For Degens, By Degens</p>
    </div>
  );
}

function HomeFooterChrome({ showBrand = true }: { showBrand?: boolean }) {
  return (
    <div className="home-footer-inner max-w-7xl mx-auto">
      <HomeActionRow />
      {showBrand && <HomeBrandLockup />}
    </div>
  );
}

function RecentEntrySuggestions({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  if (!options.length) return null;

  return (
    <div className="home-autocomplete-panel" role="listbox" aria-label={label}>
      <span>Recent</span>
      {options.map(option => (
        <button
          key={option}
          type="button"
          role="option"
          onMouseDown={event => event.preventDefault()}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function getLeagueCardNameClassName(name: string): string {
  const length = name.trim().length;
  if (length >= 30) return "home-league-card-name home-league-card-name-xxlong";
  if (length >= 23) return "home-league-card-name home-league-card-name-xlong";
  if (length >= 17) return "home-league-card-name home-league-card-name-long";
  return "home-league-card-name";
}

function getLeagueCardFormatClassName(format: string): string {
  const length = format.trim().length;
  if (length >= 31)
    return "home-league-card-format home-league-card-format-xlong";
  if (length >= 24)
    return "home-league-card-format home-league-card-format-long";
  return "home-league-card-format";
}

function LeaguePickerCard({
  league,
  onSelect,
}: {
  league: SleeperLeagueOption;
  onSelect: (leagueId: string) => void;
}) {
  const desktopFormat =
    league.format || `${league.totalRosters || "?"}-Team Dynasty`;
  const mobileFormat = league.mobileFormat || desktopFormat;

  return (
    <button
      type="button"
      className="home-league-card"
      aria-label={`${league.name} ${desktopFormat}`}
      onClick={() => onSelect(league.leagueId)}
    >
      {league.avatarUrl ? (
        <img
          src={league.avatarUrl}
          alt=""
          aria-hidden="true"
          className="home-league-card-watermark"
        />
      ) : null}
      <div className="home-league-card-top">
        <span className="home-league-card-icon-wrap">
          {league.avatarUrl ? (
            <img
              src={league.avatarUrl}
              alt={`${league.name} icon`}
              className="home-league-card-icon"
            />
          ) : (
            <span className="home-league-card-icon home-league-card-fallback">
              {league.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>
        <span className="home-league-card-body">
          <span
            className={getLeagueCardNameClassName(league.name)}
            aria-label={league.name}
            title={league.name}
          >
            {league.name}
          </span>
        </span>
      </div>
      <span
        className={`${getLeagueCardFormatClassName(desktopFormat)} home-league-card-format-desktop`}
        title={desktopFormat}
      >
        {desktopFormat}
      </span>
      <span
        className={`${getLeagueCardFormatClassName(mobileFormat)} home-league-card-format-mobile`}
        title={mobileFormat}
      >
        {mobileFormat}
      </span>
      <span
        className="home-league-card-ranks"
        aria-label={`${league.name} current league standing and power rank`}
      >
        {league.powerRank ? (
          <span className="home-league-pill home-league-pill-power">
            Power #{league.powerRank}
          </span>
        ) : null}
        {league.standingsRank ? (
          <span className="home-league-pill home-league-pill-standings">
            Standings #{league.standingsRank}
          </span>
        ) : null}
      </span>
    </button>
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
  return /player value|player values|ranking identities|player alias|redraft source|dynasty source|devy source|value blend|value input/i.test(
    row.area
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

function getAdminValueAttentionSummary(reportData: ReportData): {
  count: number;
  tone: "warn" | "danger";
} {
  const priorityRows = buildAdminValueDiagnostics(reportData, []).filter(
    isPriorityAdminDiagnosticRow
  );

  return {
    count: priorityRows.length,
    tone: priorityRows.some(row => row.tone === "danger") ? "danger" : "warn",
  };
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
      ].join(" "),
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
  const blendSummaries = buildAdminBlendSummaries(reportData);
  const leagueConfidence = reportData.leagueDiagnostics?.aiConfidence;
  const managerConfidenceRows = [...(leagueConfidence?.managerConfidence || [])]
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
  const priorityRows = rows
    .filter(isPriorityAdminDiagnosticRow)
    .sort(compareAdminDiagnosticPriority)
    .slice(0, 6);
  const priorityIds = new Set(priorityRows.map(row => row.id));
  const remainingRows = rows.filter(row => !priorityIds.has(row.id));

  return (
    <div className="admin-value-diagnostics">
      <p className="admin-value-diagnostics-intro">
        Admin eyes only. This shows what is calculated from Sleeper league
        settings, what is covered by stored market values, and source health for
        the active value lens.
      </p>
      {leagueConfidence && (
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
      {priorityRows.length > 0 && (
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
            {priorityRows.map(row => (
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
      <div className="admin-value-diagnostics-grid">
        {remainingRows.map(row => (
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
    </div>
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
  const attentionSummary = getAdminValueAttentionSummary(reportData);

  return (
    <CollapsibleReportSection
      title="Admin Eyes Only: Value Assumptions"
      kicker="Hidden diagnostics"
      previewAccessory={
        attentionSummary.count > 0 ? (
          <AdminAttentionBadge
            count={attentionSummary.count}
            label="Needs attention"
            tone={attentionSummary.tone}
          />
        ) : undefined
      }
      premium
    >
      <AdminValueDiagnosticsTable reportData={reportData} />
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

function isPrioritySourceHealthEvent(event: {
  level?: string | null;
}): boolean {
  return event.level === "danger" || event.level === "warn";
}

function AdminTrafficTelemetrySection() {
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
      title="Admin Eyes Only: Traffic & Abuse"
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
      <AdminAbuseTelemetryPanel />
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
  const issueCount = (data?.totals.failures || 0) + (data?.totals.rateLimited || 0);
  const issueTone = data?.totals.rateLimited ? "danger" : "warn";

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

  const totalCards = [
    { label: "Calls", value: data.totals.calls },
    { label: "Network Calls", value: data.totals.networkCalls },
    { label: "Cache Hits", value: data.totals.cacheHits },
    { label: "Cache Hit Rate", value: `${data.totals.cacheHitRatePct}%` },
    { label: "Failures", value: data.totals.failures },
    { label: "429s", value: data.totals.rateLimited },
    { label: "User Load", value: data.totals.userLoadNetworkCalls },
    { label: "Cron Calls", value: data.totals.cronCalls },
    { label: "Admin Calls", value: data.totals.adminCalls },
    { label: "Cost Units", value: data.totals.costUnits },
    { label: "Avg Duration", value: `${data.totals.avgDurationMs}ms` },
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
          <article key={card.label} className="admin-traffic-stat">
            <span>{card.label}</span>
            <strong>
              {typeof card.value === "number"
                ? card.value.toLocaleString()
                : card.value}
            </strong>
          </article>
        ))}
      </div>

      <div className="admin-traffic-grid">
        <section className="admin-traffic-card">
          <h4>Providers</h4>
          <div className="admin-traffic-list">
            {data.byProvider.length ? (
              data.byProvider.map(provider => (
                <div
                  key={provider.label}
                  className={`admin-traffic-row ${provider.failures || provider.rateLimited ? "admin-traffic-row-error" : ""}`}
                >
                  <strong>{provider.label}</strong>
                  <span>
                    {provider.calls} calls · {provider.networkCalls} network ·{" "}
                    {provider.cacheHitRatePct}% cached
                  </span>
                  <em>
                    {provider.failures} failures · {provider.rateLimited} 429s ·{" "}
                    {provider.costUnits} cost units
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No provider calls recorded in this window.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Highest Cost Endpoints</h4>
          <div className="admin-traffic-list">
            {data.byEndpoint.length ? (
              data.byEndpoint.map(endpoint => (
                <div
                  key={endpoint.label}
                  className={`admin-traffic-row ${endpoint.failures || endpoint.rateLimited ? "admin-traffic-row-error" : ""}`}
                >
                  <strong>{endpoint.label}</strong>
                  <span>
                    {endpoint.costUnits} cost units · {endpoint.calls} calls ·{" "}
                    {endpoint.cacheHitRatePct}% cached
                  </span>
                  <em>
                    Avg {endpoint.avgDurationMs}ms · Last{" "}
                    {formatAdminTelemetryDate(endpoint.lastSeen)}
                  </em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No endpoint cost rows recorded yet.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Call Scope</h4>
          <div className="admin-traffic-list">
            {data.byScope.length ? (
              data.byScope.map(scope => (
                <div
                  key={scope.label}
                  className={`admin-traffic-row ${scope.failures || scope.rateLimited ? "admin-traffic-row-error" : ""}`}
                >
                  <strong>{scope.label}</strong>
                  <span>
                    {scope.calls} calls · {scope.networkCalls} network ·{" "}
                    {scope.cacheHitRatePct}% cached
                  </span>
                  <em>
                    {scope.failures} failures · {scope.rateLimited} 429s · Last{" "}
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
          <h4>Recent Provider Events</h4>
          <div className="admin-traffic-list">
            {data.recentEvents.length ? (
              data.recentEvents.slice(0, 10).map((event, index) => (
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
                No recent provider events recorded.
              </p>
            )}
          </div>
        </section>
      </div>
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
    row => row.level !== "info" || row.status === "blocked" || row.status === "research"
  );
  const tone = needsAttention.some(row => row.level === "danger")
    ? "danger"
    : "warn";

  return (
    <CollapsibleReportSection
      title="Admin Eyes Only: Source Coverage"
      kicker="Snapshot field map"
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

  const totalCards = [
    { label: "Sources", value: data.totals.sources },
    { label: "Loaded", value: data.totals.loaded },
    { label: "Stale", value: data.totals.stale },
    { label: "Missing", value: data.totals.missing },
    { label: "Blocked", value: data.totals.blocked },
    { label: "Research", value: data.totals.research },
    { label: "Snapshots", value: data.totals.snapshotBacked },
    { label: "Needs Approval", value: data.totals.needsApproval },
  ];
  const snapshotRows = data.rows.filter(row => row.snapshotKey || row.tableName);
  const candidateRows = data.rows.filter(row => !row.snapshotKey && !row.tableName);

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

      <div className="admin-source-coverage-grid">
        <section className="admin-traffic-card admin-source-coverage-card">
          <h4>Snapshot-backed Sources</h4>
          <div className="admin-traffic-list">
            {snapshotRows.map(row => (
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

        <section className="admin-traffic-card admin-source-coverage-card">
          <h4>Research / Approval Queue</h4>
          <div className="admin-traffic-list">
            {candidateRows.map(row => (
              <article
                key={row.sourceKey}
                className={`admin-traffic-row admin-source-coverage-row ${getSourceCoverageToneClass(row)}`}
              >
                <div className="admin-source-coverage-row-head">
                  <strong>{row.source}</strong>
                  <span>{getSourceCoverageStatusLabel(row)}</span>
                </div>
                <span>{row.endpoint}</span>
                <em>{row.authModel}</em>
                <div className="admin-source-coverage-fields">
                  <span>Returns</span>
                  <p>{row.fieldMap.join(", ")}</p>
                </div>
                <div className="admin-source-coverage-fields">
                  <span>Gaps</span>
                  <p>{row.knownGaps.join(", ")}</p>
                </div>
                <div className="admin-source-coverage-fields">
                  <span>Boundary</span>
                  <p>{row.complianceNote}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminAbuseTelemetryPanel() {
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

      {sourceHealth?.bySource?.length ? (
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
            {data.topIps.map(entry => (
              <div key={entry.label} className="admin-traffic-row">
                <strong>{entry.label}</strong>
                <span>
                  {entry.count} events · {entry.rateLimited} limited ·{" "}
                  {entry.uniqueLeagueIds} leagues
                </span>
                <em>Last seen {formatAdminTelemetryDate(entry.lastSeen)}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Top Leagues</h4>
          <div className="admin-traffic-list">
            {data.topLeagueIds.length ? (
              data.topLeagueIds.map(entry => (
                <div key={entry.label} className="admin-traffic-row">
                  <strong>{entry.label}</strong>
                  <span>
                    {entry.count} events · {entry.success} success ·{" "}
                    {entry.error} errors
                  </span>
                  <em>Last seen {formatAdminTelemetryDate(entry.lastSeen)}</em>
                </div>
              ))
            ) : (
              <p className="admin-traffic-empty">
                No league-specific events yet.
              </p>
            )}
          </div>
        </section>

        <section className="admin-traffic-card">
          <h4>Recent Events</h4>
          <div className="admin-traffic-list">
            {data.recentEvents.map(event => (
              <div
                key={event.id}
                className={`admin-traffic-row admin-traffic-row-${event.status}`}
              >
                <strong>{event.eventType.replace(/_/g, " ")}</strong>
                <span>
                  {event.status} ·{" "}
                  {event.username ||
                    event.leagueId ||
                    event.ipAddress ||
                    "unknown"}
                </span>
                <em>
                  {formatAdminTelemetryDate(event.createdAt)}
                  {event.note ? ` · ${event.note}` : ""}
                </em>
              </div>
            ))}
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
  const [userLeagues, setUserLeagues] = useState<SleeperLeagueOption[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerUsername, setViewerUsername] = useState<string | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<AdminViewMode | null>(
    null
  );
  const [adminViewerManager, setAdminViewerManager] = useState<string | null>(
    null
  );
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportDataCacheVersion, setReportDataCacheVersion] = useState<
    string | null
  >(null);
  const [sleeperTradeCenterToken, setSleeperTradeCenterToken] = useState("");
  const [sleeperHiddenConsentMap, setSleeperHiddenConsentMap] =
    useState<SleeperHiddenConsentMap>(() => readSleeperHiddenConsentMap());
  const [activeTab, setActiveTab] = useState(
    () => getInitialReportTabFromUrl() || "overview"
  );
  const [leagueName, setLeagueName] = useState("");
  const [leagueLogo, setLeagueLogo] = useState<string | null>(null);
  const [leagueFormat, setLeagueFormat] = useState("");
  const [ownerIntelSortMode, setOwnerIntelSortMode] =
    useState<OwnerIntelSortMode>("dynasty");
  const [isLoading, setIsLoading] = useState(false);
  const [analysisCompleteMessage, setAnalysisCompleteMessage] = useState<{
    leagueName: string;
    leagueFormat: string;
    leagueLogo: string | null;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('preview') === 'success') {
      setIsLoading(true);
      setAnalysisCompleteMessage({
        leagueName: 'The Fantasy Degenerates',
        leagueFormat: '12-Team Dynasty SF PPR TEP',
        leagueLogo: '/favicon-32x32.png',
      });
    }
  }, []);

  const [pendingAnalysisLeague, setPendingAnalysisLeague] =
    useState<AnalysisLeaguePreview | null>(null);
  const [isLeaguePickerOpen, setIsLeaguePickerOpen] = useState(false);
  const [isChangeLeagueModalOpen, setIsChangeLeagueModalOpen] = useState(false);
  const [isClownModalOpen, setIsClownModalOpen] = useState(false);
  const [isAdminUnlockModalOpen, setIsAdminUnlockModalOpen] = useState(false);
  const [isAdminAccessModalOpen, setIsAdminAccessModalOpen] = useState(false);
  const [adminPassphrase, setAdminPassphrase] = useState("");
  const [loadingTransitionPhase, setLoadingTransitionPhase] =
    useState<LoadingTransitionPhase>("loading");
  const [
    prospectArchiveOpenedWhileLoading,
    setProspectArchiveOpenedWhileLoading,
  ] = useState(false);
  const successTransitionTimerRefs = useRef<number[]>([]);
  const activeAnalysisLeagueIdRef = useRef<string | null>(null);
  const adminLoginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: async () => {
      setAdminPassphrase("");
      setIsAdminAccessModalOpen(false);
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

  const leaguePreviewMutation = trpc.league.getLeaguePreview.useMutation();

  const beginAnalysisLoading = async (
    nextLeagueId: string,
    extraKnownLeagues: SleeperLeagueOption[] = []
  ) => {
    activeAnalysisLeagueIdRef.current = nextLeagueId;
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

    if (knownLeague) return;

    try {
      const league = await leaguePreviewMutation.mutateAsync({
        leagueId: nextLeagueId,
      });
      if (activeAnalysisLeagueIdRef.current !== league.leagueId) return;
      setPendingAnalysisLeague(getAnalysisLeaguePreview(league));
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

  const sleeperHiddenConsentKey = getSleeperHiddenConsentStorageKey(
    leagueId,
    sleeperUsername || viewerUsername || viewerUserId
  );
  const sleeperHiddenConsent = sleeperHiddenConsentKey
    ? sleeperHiddenConsentMap[sleeperHiddenConsentKey] || null
    : null;

  const analyzeMutation = trpc.league.analyze.useMutation({
    onSuccess: data => {
      clearSuccessTransitionTimers();
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
      setLoadingTransitionPhase("success");
      updateReportTabUrl(activeTab, data.leagueId);
      queueSuccessTransitionTimer(() => {
        setReportDataCacheVersion(REPORT_CACHE_DATA_VERSION);
        setReportData(data.reportData);
        setLoadingTransitionPhase("reveal");
      }, REPORT_SUCCESS_REVEAL_DELAY_MS);
      queueSuccessTransitionTimer(() => {
        setLoadingTransitionPhase("kick");
      }, REPORT_SUCCESS_REVEAL_DELAY_MS + REPORT_SUCCESS_READ_AFTER_REVEAL_MS);
      queueSuccessTransitionTimer(
        () => {
          setLoadingTransitionPhase("done");
          setIsLoading(false);
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
      setAnalysisCompleteMessage(null);
      setPendingAnalysisLeague(null);
      activeAnalysisLeagueIdRef.current = null;
      setLoadingTransitionPhase("loading");
      setIsLoading(false);
      showMutationErrorToast(error);
    },
  });

  const hiddenSleeperTradeCenterMutation =
    trpc.league.importSleeperTradeCenter.useMutation({
      onSuccess: data => {
        setReportData(current =>
          current
            ? {
                ...current,
                adminSleeperTradeProposalSignals: data.tradeProposalSignals,
                adminSleeperWaiverSignals: data.waiverSignals,
                sleeperHiddenLeagueSnapshot:
                  data.sleeperHiddenLeagueSnapshot || {
                    sharedBy: null,
                    sharedAt: Date.now(),
                    transactionCount: data.transactionCount,
                    tradeCount: data.tradeCount,
                    waiverCount: data.waiverCount,
                  },
              }
            : current
        );
        const nextHiddenConsentMap = rememberSleeperHiddenConsent({
          leagueId: data.leagueId,
          userKey: sleeperUsername || viewerUsername || viewerUserId,
          sharedAt: data.sleeperHiddenLeagueSnapshot?.sharedAt || Date.now(),
        });
        setSleeperHiddenConsentMap(nextHiddenConsentMap);
        setSleeperTradeCenterToken("");
        toast.success(
          `Shared ${data.tradeCount} hidden trade row${data.tradeCount === 1 ? "" : "s"} and ${data.waiverCount} waiver claim${data.waiverCount === 1 ? "" : "s"} from Sleeper.`
        );
      },
      onError: error => {
        showMutationErrorToast(error);
      },
    });

  useEffect(
    () => () => {
      clearSuccessTransitionTimers();
    },
    []
  );

  const userLeagueRanksMutation = trpc.league.getUserLeagueRanks.useMutation({
    onSuccess: data => {
      setUserLeagues(prev => mergeLeagueRanks(prev, data.ranks));
    },
  });
  const requestUserLeagueRanks = userLeagueRanksMutation.mutate;

  useEffect(() => {
    if (!viewerUserId || !sleeperUsername || !userLeagues.length) return;
    if (
      userLeagues.every(
        league => league.standingsRank != null && league.powerRank != null
      )
    )
      return;

    requestUserLeagueRanks({
      username: sleeperUsername,
      userId: viewerUserId,
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
    },
    onError: error => {
      showMutationErrorToast(error);
    },
  });

  useEffect(() => {
    let restoredViewerUserId: string | null = null;
    let restoredLeagues: SleeperLeagueOption[] = [];
    let sleeperSessionSavedAt: number | null = null;
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
        sleeperSessionSavedAt = parsed.savedAt || null;
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
      const cachedReport = localStorage.getItem(REPORT_CACHE_KEY);
      if (cachedReport) {
        const parsed = JSON.parse(cachedReport) as CachedReport;
        const cachedReportIsFresh = isFreshTimestamp(
          parsed.savedAt,
          REPORT_CACHE_MAX_AGE_MS
        );
        const sleeperSessionIsFresh =
          sleeperSessionSavedAt === null
            ? true
            : isFreshTimestamp(sleeperSessionSavedAt, REPORT_CACHE_MAX_AGE_MS);
        if (
          parsed.cacheVersion === REPORT_CACHE_DATA_VERSION &&
          (!urlLeagueId || parsed.leagueId === urlLeagueId) &&
          cachedReportIsFresh &&
          sleeperSessionIsFresh
        ) {
          setLeagueId(parsed.leagueId);
          setLeagueName(parsed.leagueName);
          setLeagueLogo(parsed.leagueLogo);
          setLeagueFormat(parsed.leagueFormat);
          setActiveTab(urlTab || parsed.activeTab || "overview");
          setReportDataCacheVersion(parsed.cacheVersion);
          setReportData(parsed.reportData);
          setLeagueIdHistory(
            rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, parsed.leagueId)
          );
          return;
        }
        localStorage.removeItem(REPORT_CACHE_KEY);
      }

      if (urlLeagueId) {
        setLeagueId(urlLeagueId);
        setActiveTab(urlTab || "overview");
        setLeagueIdHistory(
          rememberAutocompleteValue(LEAGUE_ID_HISTORY_KEY, urlLeagueId)
        );
        void beginAnalysisLoading(urlLeagueId, restoredLeagues).finally(() => {
          if (activeAnalysisLeagueIdRef.current !== urlLeagueId) return;
          analyzeMutation.mutate({
            leagueId: urlLeagueId,
            viewerUserId: restoredViewerUserId || undefined,
          });
        });
        return;
      }

      const lastLeague = localStorage.getItem(LAST_LEAGUE_KEY);
      if (lastLeague) {
        const parsed = JSON.parse(lastLeague) as LastLeague;
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
          viewerUserId: restoredViewerUserId || undefined,
        });
      }
    } catch {
      localStorage.removeItem(REPORT_CACHE_KEY);
      localStorage.removeItem(LAST_LEAGUE_KEY);
    }
    // Run once on boot so phone refreshes land back in the last league.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!reportData) return;

    const lastLeague: LastLeague = {
      leagueId,
      leagueName,
      leagueLogo,
      leagueFormat,
      activeTab,
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(LAST_LEAGUE_KEY, JSON.stringify(lastLeague));
      localStorage.setItem(
        REPORT_CACHE_KEY,
        JSON.stringify({
          ...lastLeague,
          cacheVersion: REPORT_CACHE_DATA_VERSION,
          reportData,
        } satisfies CachedReport)
      );
    } catch {
      localStorage.removeItem(REPORT_CACHE_KEY);
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

    localStorage.removeItem(REPORT_CACHE_KEY);
    STALE_REPORT_CACHE_KEYS.forEach(key => localStorage.removeItem(key));
    setReportData(null);
    setReportDataCacheVersion(null);
    setAnalysisCompleteMessage(null);
    setPendingAnalysisLeague({
      leagueName,
      leagueFormat,
      leagueLogo,
    });
    setLoadingTransitionPhase("loading");
    setIsLoading(true);
    analyzeMutation.mutate({
      leagueId,
      viewerUserId: viewerUserId || undefined,
    });
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
    if (nextLeagueId !== leagueId.trim()) {
      setAdminViewerManager(null);
    }
    setLeagueId(nextLeagueId);
    rememberLeagueId(nextLeagueId);
    void beginAnalysisLoading(nextLeagueId).finally(() => {
      if (activeAnalysisLeagueIdRef.current !== nextLeagueId) return;
      analyzeMutation.mutate({
        leagueId: nextLeagueId,
        viewerUserId: viewerUserId || undefined,
      });
    });
  };

  const handleImportSleeperTradeCenter = () => {
    const nextLeagueId = leagueId.trim();
    const authToken = sleeperTradeCenterToken.trim();
    if (!nextLeagueId) {
      toast.error("Please load a league first");
      return;
    }
    if (!authToken) {
      toast.error("Please paste a Sleeper auth token");
      return;
    }
    hiddenSleeperTradeCenterMutation.mutate({
      leagueId: nextLeagueId,
      authToken,
      sharedBy:
        sleeperUsername.trim() || viewerUsername || viewerUserId || null,
    });
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
    userLeaguesMutation.mutate({ username: normalizedUsername });
  };

  const handleCachedSleeperUserSelect = (cachedUser: CachedSleeperUser) => {
    const sessionUser = cachedSleeperUserToSessionUser(cachedUser);
    const nextViewerIdentity = getKtcAdminIdentity(
      sessionUser,
      cachedUser.username
    );
    const nextHasAdminPermissions =
      sessionUser.hasAdminPermissions === true ||
      sessionUser.isPrivilegedReportViewer === true;
    setSleeperUsername(cachedUser.username);
    setFocusedAutocomplete(null);
    setUserLeagues(cachedUser.leagues);
    setViewerUserId(cachedUser.userId);
    setViewerUsername(nextViewerIdentity);
    setAdminViewMode(nextHasAdminPermissions ? "regular" : null);
    setAdminViewerManager(null);
    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    rememberSleeperUsername(cachedUser.username);
    setCachedSleeperUsers(rememberCachedSleeperUser(cachedUser));

    try {
      localStorage.setItem(
        SLEEPER_SESSION_KEY,
        JSON.stringify({
          username: cachedUser.username,
          user: sessionUser,
          leagues: cachedUser.leagues,
          adminViewMode: nextHasAdminPermissions ? "regular" : null,
          savedAt: Date.now(),
        } satisfies SleeperSession)
      );
    } catch {
      // Account shortcuts still work for this page load.
    }

    if (!cachedUser.leagues.length) {
      userLeaguesMutation.mutate({ username: cachedUser.username });
    }
  };

  const handleClownDismiss = () => {
    setIsClownModalOpen(false);
    setSleeperUsername("");
    setUserLeagues([]);
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
      adminViewMode === "regular" ? "admin" : "regular"
    );
  };

  const handleStartOver = () => {
    localStorage.removeItem(REPORT_CACHE_KEY);
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
    setReportData(null);
    setLeagueId("");
    setSleeperUsername("");
    setLeagueName("");
    setLeagueLogo(null);
    setLeagueFormat("");
    setUserLeagues([]);
    setViewerUserId(null);
    setViewerUsername(null);
    setAdminViewMode(null);
    setAdminViewerManager(null);
    setAdminPassphrase("");
    setSleeperTradeCenterToken("");
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

  const handleAnalyzeLeagueOption = (nextLeagueId: string) => {
    setIsLeaguePickerOpen(false);
    localStorage.removeItem(REPORT_CACHE_KEY);
    setReportData(null);
    handleAnalyze(nextLeagueId);
  };

  const handleCachedLeagueShortcutSelect = (nextLeagueId: string) => {
    const cachedUser = findCachedSleeperUser(
      cachedSleeperUsers,
      viewerUserId,
      sleeperUsername
    );
    const sessionUser = cachedUser
      ? cachedSleeperUserToSessionUser(cachedUser)
      : null;
    setAdminViewerManager(null);
    if (cachedUser && sessionUser) {
      const nextViewerIdentity = getKtcAdminIdentity(
        sessionUser,
        cachedUser.username
      );
      const nextHasAdminPermissions =
        sessionUser.hasAdminPermissions === true ||
        sessionUser.isPrivilegedReportViewer === true;
      setSleeperUsername(cachedUser.username);
      setFocusedAutocomplete(null);
      setUserLeagues(cachedUser.leagues);
      setViewerUserId(cachedUser.userId);
      setViewerUsername(nextViewerIdentity);
      setAdminViewMode(nextHasAdminPermissions ? adminViewMode : null);
      rememberSleeperUsername(cachedUser.username);
      setCachedSleeperUsers(
        rememberCachedSleeperLeagueShortcut({
          users: readCachedSleeperUsers(),
          user: sessionUser,
          username: cachedUser.username,
          leagues: cachedUser.leagues,
          leagueId: nextLeagueId,
        })
      );

      try {
        localStorage.setItem(
          SLEEPER_SESSION_KEY,
          JSON.stringify({
            username: cachedUser.username,
            user: sessionUser,
            leagues: cachedUser.leagues,
            adminViewMode: nextHasAdminPermissions ? adminViewMode : null,
            savedAt: Date.now(),
          } satisfies SleeperSession)
        );
      } catch {
        // League shortcuts are still usable for this page load.
      }
    }

    setIsLeaguePickerOpen(false);
    setIsChangeLeagueModalOpen(false);
    localStorage.removeItem(REPORT_CACHE_KEY);
    setReportData(null);
    setLeagueId(nextLeagueId);
    rememberLeagueId(nextLeagueId);
    void beginAnalysisLoading(nextLeagueId, cachedUser?.leagues || []).finally(
      () => {
        if (activeAnalysisLeagueIdRef.current !== nextLeagueId) return;
        analyzeMutation.mutate({
          leagueId: nextLeagueId,
          viewerUserId: cachedUser?.userId || viewerUserId || undefined,
        });
      }
    );
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
  const reportHeaderLeagueShortcuts = getReportHeaderLeagueShortcuts(
    orderedUserLeagues,
    leagueId
  );
  const cachedLeagueShortcuts = getLeagueShortcutsForUser(
    activeCachedSleeperUser,
    userLeagues,
    reportData ? leagueId : null
  );
  const hasAuthenticatedAdminPermissions = canViewAdminTelemetryForUser(
    authQuery.data
  );
  const hasSleeperAdminPermissions =
    activeCachedSleeperUser?.hasAdminPermissions === true ||
    activeCachedSleeperUser?.isPrivilegedReportViewer === true;
  const hasAdminPermissions =
    hasAuthenticatedAdminPermissions || hasSleeperAdminPermissions;
  const canViewAdminFeatureExpansion = hasAuthenticatedAdminPermissions
    ? adminViewMode !== "regular"
    : hasSleeperAdminPermissions && adminViewMode === "admin";

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
    if (hasAdminPermissions) {
      handleAdminModeToggle();
      return;
    }

    setAdminPassphrase("");
    setIsAdminAccessModalOpen(true);
  };

  const migratedActiveTab =
    activeTab === "projections" ? "rankings" : activeTab;
  const canViewAutopilotTab = canViewAdminFeatureExpansion;
  const shouldDeferAutopilotUrlSync =
    migratedActiveTab === "autopilot" &&
    !canViewAutopilotTab &&
    authQuery.isLoading;
  const resolvedActiveTab =
    migratedActiveTab === "autopilot" && !canViewAutopilotTab
      ? "overview"
      : migratedActiveTab;
  const reportTabsClassName = `report-tabs ${canViewAutopilotTab ? "report-tabs-six" : "report-tabs-five"}`;
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
  const isProspectArchiveLoading =
    rankingsQuery.isLoading && !rankingsForReport;
  const reportDataWithRankings =
    reportData && rankingsForReport
      ? { ...reportData, rankings: rankingsForReport }
      : reportData;
  const handleReportTabChange = (nextTab: string) => {
    const allowedNextTab =
      nextTab === "autopilot" && !canViewAutopilotTab ? "overview" : nextTab;
    setActiveTab(allowedNextTab);
    updateReportTabUrl(allowedNextTab, leagueId);
  };

  useEffect(() => {
    if (
      activeTab === "autopilot" &&
      !canViewAutopilotTab &&
      !authQuery.isLoading
    ) {
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

  useEffect(() => {
    if (!isProspectArchiveLoading) {
      setProspectArchiveOpenedWhileLoading(false);
    }
  }, [isProspectArchiveLoading]);

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
    loadingTransitionPhase === "reveal" ? "loading-success-card-reveal" : "",
    loadingTransitionPhase === "kick" ? "loading-success-card-kick" : "",
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
            isComplete={Boolean(analysisCompleteMessage)}
            leagueName={loadingLeague?.leagueName}
            leagueFormat={loadingLeague?.leagueFormat}
            leagueLogo={loadingLeague?.leagueLogo}
          />
          {analysisCompleteMessage && (
            <div
              className={loadingSuccessCardClassName}
              role="status"
              aria-live="polite"
            >
              <Suspense fallback={null}>
                <SuccessCard3D exit={loadingTransitionPhase === "kick"} />
              </Suspense>
              <span
                className="loading-success-impact-core"
                aria-hidden="true"
              />
              <span className="loading-success-scanline" aria-hidden="true" />
              <div className="loading-success-copy">
                <p className="loading-success-kicker">
                  <CheckCircle2 aria-hidden="true" />
                  Report Generated
                </p>
                <div className="loading-success-icon">
                  {analysisCompleteMessage.leagueLogo ? (
                    <img
                      src={analysisCompleteMessage.leagueLogo}
                      alt=""
                      className="loading-success-logo-image"
                    />
                  ) : (
                    <CheckCircle2 aria-hidden="true" />
                  )}
                </div>
                <h2
                  className={`${getLoadingSuccessTitleClassName(analysisCompleteMessage.leagueName || "League report")} loading-success-league-name loading-gradient-text`}
                >
                  {analysisCompleteMessage.leagueName || "League report"}
                </h2>
                <div className="loading-success-bar" aria-hidden="true">
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  const adminAccessDialog = (
    <Dialog
      open={isAdminAccessModalOpen && !hasAuthenticatedAdminPermissions}
      onOpenChange={open => {
        if (open) return;
        setIsAdminAccessModalOpen(false);
        setAdminPassphrase("");
      }}
    >
      <DialogContent className="admin-unlock-dialog border-orange-400/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-orange-950/30 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="athletic-headline text-3xl text-orange-300">
            Unlock Admin Tools
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Enter the passphrase once to open telemetry and admin diagnostics
            for this browser session.
          </DialogDescription>
        </DialogHeader>
        <div className="admin-unlock-dialog-grid">
          <span>Session only</span>
          <span>Telemetry</span>
          <span>Admin diagnostics</span>
          <span>One passphrase</span>
        </div>
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
            className="border-orange-400/20 bg-slate-950/80 text-slate-100 placeholder:text-slate-500"
          />
          <DialogFooter className="gap-2 sm:items-center sm:justify-center">
            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-700 text-slate-200 hover:bg-slate-900 sm:w-auto"
              onClick={() => {
                setIsAdminAccessModalOpen(false);
                setAdminPassphrase("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!adminPassphrase.trim() || adminLoginMutation.isPending}
              className="w-full bg-gradient-to-r from-orange-500 to-cyan-400 font-black text-slate-950 hover:from-orange-400 hover:to-cyan-300 sm:w-auto"
            >
              {adminLoginMutation.isPending
                ? "Unlocking..."
                : "Unlock Admin Tools"}
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
        <DialogHeader>
          <DialogTitle className="athletic-headline text-3xl text-orange-300">
            Admin Command Center Unlocked
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Your signed-in admin session has premium AI reads, blueprint
            reports, league power tools, market signals, and admin-only
            diagnostics turned on.
          </DialogDescription>
        </DialogHeader>
        <div className="admin-unlock-dialog-grid">
          <span>Premium AI Reads</span>
          <span>Monthly Blueprints</span>
          <span>Power Rankings</span>
          <span>Trade Intel</span>
        </div>
        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            onClick={handleAdminUnlockModalDismiss}
            className="w-full bg-gradient-to-r from-orange-500 to-cyan-400 font-black text-slate-950 hover:from-orange-400 hover:to-cyan-300 sm:w-auto"
          >
            Enter Command Center
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (reportData) {
    const leagueValueMode = normalizeLeagueValueMode(
      reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
    );
    const isRedraftReport = leagueValueMode === "redraft";
    const modeCopy = getLeagueModeCopy(leagueValueMode);
    const reportDataBase = reportDataWithRankings || reportData;
    const effectiveViewerManager = hasAdminPermissions
      ? (adminViewerManager ?? reportDataBase.viewerManager ?? null)
      : (reportDataBase.viewerManager ?? null);
    const reportManagerNames = getReportManagerNames(
      reportDataBase,
      effectiveViewerManager
    );
    const reportDataForView: ReportData = {
      ...reportDataBase,
      viewerManager: effectiveViewerManager,
    };
    const hasManagerViewOptions = reportManagerNames.length > 1;
    const hiddenSleeperTradeSignals =
      reportData.adminSleeperTradeProposalSignals;
    const hiddenSleeperWaiverSignals = reportData.adminSleeperWaiverSignals;
    const hiddenSleeperSnapshot =
      reportData.sleeperHiddenLeagueSnapshot || null;
    const hiddenSleeperImportLoaded =
      hiddenSleeperTradeSignals !== undefined ||
      hiddenSleeperWaiverSignals !== undefined ||
      hiddenSleeperSnapshot !== null;
    const hiddenSleeperBrowserConsent = Boolean(sleeperHiddenConsent);
    const hiddenSleeperConsentResolved =
      hiddenSleeperBrowserConsent || hiddenSleeperSnapshot !== null;
    const hiddenSleeperShareButtonLabel =
      hiddenSleeperBrowserConsent || hiddenSleeperSnapshot
        ? "Refresh hidden rows"
        : "Share hidden rows";
    const hiddenSleeperShareStatusLabel = hiddenSleeperBrowserConsent
      ? "Remembered on this browser"
      : hiddenSleeperSnapshot
        ? "Stored for this league"
        : "One-time share";
    const showTradeMarketRadar =
      reportData.weeklyRisers.some(player => player.val_now >= 2500) ||
      reportData.weeklyFallers.some(player => player.val_now >= 1800);
    return (
      <>
        <ManagerChampionshipProvider
          championships={reportData.managerChampionships}
        >
          <div
            className={`report-shell min-h-screen flex flex-col ${isLoadingRevealPhase ? "report-shell-entering" : ""}`}
          >
            <PremiumFxLayer
              variant={reportFxVariant}
              intensity={resolvedActiveTab === "overview" ? "low" : "medium"}
            />
            {/* Premium Header */}
            <div className="report-header sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 sm:pl-6 sm:pr-2 md:pl-6 md:pr-1 lg:pr-0 py-3 md:py-2">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
                  {/* Left: Brand */}
                  <div className="report-header-brand min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div
                        className={`report-header-mobile-brand-lockup md:hidden ${hasAdminPermissions ? "report-header-mobile-brand-lockup-admin" : ""}`}
                      >
                        <img
                          src={DYNASTY_LOGO_SRC}
                          alt="Dynasty Degenerates"
                          className="report-header-mobile-logo"
                        />
                      </div>
                      <h2 className="report-header-wordmark athletic-headline hidden truncate text-base sm:text-xl md:block">
                        <span>Dynasty</span> <span>Degenerates</span>
                      </h2>
                    </div>
                    <span
                      className="report-live-indicator hidden md:inline-flex"
                      aria-label="League analysis loaded"
                    >
                      <span aria-hidden="true" />
                      League scan complete
                    </span>
                  </div>

                  {/* Center: Logo */}
                  <div className="hidden md:col-start-2 md:flex items-center justify-center">
                    <img
                      src={DYNASTY_LOGO_SRC}
                      alt="Dynasty Degenerates Logo"
                      className="report-header-logo"
                    />
                  </div>

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
                                className="report-league-format-pill"
                              >
                                {chip}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </button>
                    {reportHeaderLeagueShortcuts.length > 0 && (
                      <LeagueShortcutStack
                        leagues={reportHeaderLeagueShortcuts}
                        activeLeagueId={leagueId}
                        onSelect={handleCachedLeagueShortcutSelect}
                        className="report-league-shortcuts"
                        label="Switch"
                        limit={MAX_REPORT_HEADER_LEAGUES}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 w-full">
              <Tabs
                value={resolvedActiveTab}
                onValueChange={handleReportTabChange}
                className="w-full"
              >
                <TabsList
                  className={reportTabsClassName}
                  data-active-tab={resolvedActiveTab}
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
                      Weekly Momentum
                    </span>
                    <span className="report-tab-label-short" aria-hidden="true">
                      Trend
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
                      Ranks
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="trades"
                    className="report-tab"
                    aria-label="Trade History"
                  >
                    <Repeat2 className="h-4 w-4" aria-hidden="true" />
                    <span className="report-tab-label-full" aria-hidden="true">
                      Trade History
                    </span>
                    <span className="report-tab-label-short" aria-hidden="true">
                      Trades
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="draft"
                    className="report-tab"
                    aria-label="Draft History"
                  >
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    <span className="report-tab-label-full" aria-hidden="true">
                      Draft History
                    </span>
                    <span className="report-tab-label-short" aria-hidden="true">
                      Draft
                    </span>
                  </TabsTrigger>
                </TabsList>

                <Suspense fallback={<ReportSectionLoadingFallback />}>
                  <TabsContent value="overview" className="report-tab-content">
                    <div className="space-y-6 sm:space-y-8">
                      {canViewAdminFeatureExpansion && (
                        <>
                          <OverviewAIPulse data={reportDataForView} />
                          <CollapsibleReportSection
                            title="Monthly Team Blueprint"
                            kicker="Roster blueprint report"
                            premium
                            previewMetrics={[
                              {
                                label: "Managers",
                                value:
                                  reportData.managerRosterIntelligence
                                    ?.length || 0,
                                tone: "info",
                              },
                              {
                                label: "Format",
                                value:
                                  leagueValueMode === "redraft"
                                    ? "Season"
                                    : "Dynasty",
                                tone: "neutral",
                              },
                              {
                                label: "History",
                                value: reportData.weeklyRisers?.length
                                  ? "Partial"
                                  : "Current",
                                tone: reportData.weeklyRisers?.length
                                  ? "warn"
                                  : "neutral",
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
                                ? "Weekly power, starter strength, depth, and roster flaws"
                                : "Power, roster value, starters, age, and flaws"
                            }
                            premium
                            previewMetrics={[
                              {
                                label: "Teams",
                                value: reportData.powerRankings?.length || 0,
                                tone: reportData.powerRankings?.length
                                  ? "info"
                                  : "warn",
                              },
                              {
                                label: "Top Team",
                                value:
                                  reportData.powerRankings?.[0]?.manager || "-",
                                tone: "good",
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
                            kicker="Strengths, leaks, surplus, and next move"
                            premium
                            previewMetrics={[
                              {
                                label: "Recon Teams",
                                value:
                                  reportData.managerRosterIntelligence
                                    ?.length || 0,
                                tone: "info",
                              },
                              {
                                label: "Depth Flags",
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
                            title="Trade Finder, Partners & League Exploits"
                            kicker={
                              isRedraftReport
                                ? "Starter upgrades, roster need matching, and weekly pressure points"
                                : "Fair packages, roster need matching, and league-wide pressure points"
                            }
                            premium
                            previewMetrics={[
                              {
                                label: "Managers",
                                value:
                                  reportData.managerRosterIntelligence
                                    ?.length || 0,
                                tone: "info",
                              },
                              {
                                label: "Position Signals",
                                value: reportData.positionDepth?.length || 0,
                                tone: reportData.positionDepth?.length
                                  ? "warn"
                                  : "neutral",
                              },
                              {
                                label: isRedraftReport
                                  ? "Roster Fits"
                                  : "Pick Portfolios",
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
                                leagueId={leagueId}
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
                                  label: "Waiver Adds",
                                  value:
                                    reportData.waiverIntelligence
                                      ?.availableTrendingAdds?.length || 0,
                                  tone: reportData.waiverIntelligence
                                    ?.availableTrendingAdds?.length
                                    ? "good"
                                    : "warn",
                                },
                                {
                                  label: "Lineup Maps",
                                  value:
                                    reportData.managerPositionCounts?.length ||
                                    0,
                                  tone: "info",
                                },
                                {
                                  label: "News Flags",
                                  value: Object.values(
                                    reportData.playerDetailsById || {}
                                  ).filter(details => details.latestNews)
                                    .length,
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
                              previewMetrics={buildOwnerPreviewMetrics(
                                reportData,
                                leagueValueMode,
                                ownerIntelSortMode
                              )}
                              previewAccessoryPlacement="middle"
                              previewAccessory={
                                !isRedraftReport ? (
                                  <OwnerIntelSortControls
                                    value={ownerIntelSortMode}
                                    onChange={setOwnerIntelSortMode}
                                  />
                                ) : undefined
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
                      className="report-tab-content"
                    >
                      <AITeamAutopilot
                        reportData={reportDataForView}
                        leagueName={leagueName}
                        leagueFormat={leagueFormat}
                        leagueValueMode={leagueValueMode}
                      />
                    </TabsContent>
                  )}

                  <TabsContent value="momentum" className="report-tab-content">
                    <div className="space-y-6 sm:space-y-8">
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
                        title="Top 10 Weekly Risers"
                        kicker="7-day % gainers"
                        previewMetrics={buildWeeklyRiserPreviewMetrics(
                          reportData
                        )}
                      >
                        <WeeklyMomentumTable
                          data={reportData.weeklyRisers}
                          title="Weekly Risers"
                          managerAvatars={reportData.managerAvatars}
                          playerDetailsById={reportData.playerDetailsById}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          viewerManager={effectiveViewerManager}
                          leagueValueMode={leagueValueMode}
                        />
                      </CollapsibleReportSection>
                      <CollapsibleReportSection
                        title="Top 10 Weekly Fallers"
                        kicker="7-day % drops"
                        previewMetrics={buildWeeklyFallerPreviewMetrics(
                          reportData
                        )}
                      >
                        <WeeklyMomentumTable
                          data={reportData.weeklyFallers}
                          title="Weekly Fallers"
                          managerAvatars={reportData.managerAvatars}
                          playerDetailsById={reportData.playerDetailsById}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          viewerManager={effectiveViewerManager}
                          leagueValueMode={leagueValueMode}
                        />
                      </CollapsibleReportSection>
                      <CollapsibleReportSection
                        title="Trending Adds"
                        kicker={
                          isRedraftReport
                            ? "Sleeper add activity"
                            : "Sleeper activity"
                        }
                        previewMetrics={buildTrendingPreviewMetrics(
                          reportData.trendingAdds || [],
                          "up"
                        )}
                      >
                        <TrendingPlayersTable
                          data={reportData.trendingAdds || []}
                          title="Trending Adds"
                          countLabel="Adds"
                          managerAvatars={reportData.managerAvatars}
                          playerDetailsById={reportData.playerDetailsById}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          viewerManager={effectiveViewerManager}
                          leagueValueMode={leagueValueMode}
                        />
                      </CollapsibleReportSection>
                      <CollapsibleReportSection
                        title="Trending Drops"
                        kicker={
                          isRedraftReport
                            ? "Sleeper drop activity"
                            : "Sleeper activity"
                        }
                        previewMetrics={buildTrendingPreviewMetrics(
                          reportData.trendingDrops || [],
                          "down"
                        )}
                      >
                        <TrendingPlayersTable
                          data={reportData.trendingDrops || []}
                          title="Trending Drops"
                          countLabel="Drops"
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

                  <TabsContent value="rankings" className="report-tab-content">
                    <div className="space-y-6 sm:space-y-8">
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
                              board="dynasty"
                              hidePicks={isRedraftReport}
                              leagueValueMode={leagueValueMode}
                              showAIReads={canViewAdminFeatureExpansion}
                            />
                          </div>
                        )}
                      </CollapsibleReportSection>
                      {!isRedraftReport && (
                        <CollapsibleReportSection
                          title="College Rankings"
                          kicker="Future rookie pipeline"
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
                              showAIReads={canViewAdminFeatureExpansion}
                            />
                          )}
                        </CollapsibleReportSection>
                      )}
                      {!isRedraftReport && (
                        <CollapsibleReportSection
                          title="Prospect Score Archive"
                          kicker="Scouting data archive"
                          onOpenChange={open => {
                            if (open && isProspectArchiveLoading) {
                              setProspectArchiveOpenedWhileLoading(true);
                            }
                          }}
                        >
                          {isProspectArchiveLoading &&
                          prospectArchiveOpenedWhileLoading ? (
                            <ProspectArchiveLoadingState />
                          ) : isProspectArchiveLoading ? null : (
                            <RankingsBoard
                              rankings={rankingsForReport}
                              playerDetailsById={reportData.playerDetailsById}
                              managerAvatars={reportData.managerAvatars}
                              leagueId={leagueId}
                              leagueLogo={leagueLogo}
                              viewerManager={effectiveViewerManager}
                              board="draftbuzz"
                              hidePicks
                              leagueValueMode={leagueValueMode}
                              showAIReads={canViewAdminFeatureExpansion}
                            />
                          )}
                        </CollapsibleReportSection>
                      )}
                      {canViewAdminFeatureExpansion && (
                        <section
                          className="admin-diagnostics-shell"
                          aria-label="Admin diagnostics"
                        >
                          <div className="admin-diagnostics-shell-header">
                            <span>Admin Diagnostics</span>
                            <p>
                              Operational checks separated from the league
                              report so normal owner analysis stays focused.
                            </p>
                          </div>
                          <AdminProviderTelemetrySection />
                          <AdminSourceCoverageSection />
                          <AdminTrafficTelemetrySection />
                          <AdminValueDiagnosticsSection
                            reportData={reportDataForView}
                          />
                        </section>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="trades" className="report-tab-content">
                    <div className="trade-sections space-y-6 sm:space-y-8">
                      {canViewAdminFeatureExpansion && (
                        <TradeBrowserRead data={reportDataForView} />
                      )}
                      {canViewAdminFeatureExpansion && (
                        <CollapsibleReportSection
                          title="Admin Eyes Only: Share Hidden Sleeper Data"
                          kicker="Share pending, cancelled, rejected, and waiver rows once. We remember this browser for this league."
                          previewMetrics={buildSleeperHiddenPreviewMetrics(
                            reportData
                          )}
                          defaultOpen={!hiddenSleeperConsentResolved}
                        >
                          <div className="space-y-6">
                            <Card className="border-slate-800 bg-slate-950/70 p-4 shadow-inner shadow-cyan-950/20 sm:p-5">
                              <form
                                className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
                                onSubmit={event => {
                                  event.preventDefault();
                                  handleImportSleeperTradeCenter();
                                }}
                              >
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                                    Hidden Sleeper Feed
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-semibold text-white">
                                      {hiddenSleeperShareButtonLabel}
                                    </h3>
                                    <span className="command-mini-badge command-mini-badge-info">
                                      {hiddenSleeperShareStatusLabel}
                                    </span>
                                  </div>
                                  <p className="max-w-2xl text-sm leading-6 text-slate-300">
                                    Paste a live Sleeper auth token from an
                                    authenticated browser session. We store the
                                    resulting hidden rows for this league and do
                                    not keep the token.
                                  </p>
                                  {hiddenSleeperSnapshot && (
                                    <p className="text-xs leading-5 text-slate-400">
                                      {hiddenSleeperSnapshot.sharedBy
                                        ? `Shared by ${hiddenSleeperSnapshot.sharedBy}`
                                        : "Shared by this browser"}
                                      {hiddenSleeperSnapshot.sharedAt
                                        ? ` · ${new Date(hiddenSleeperSnapshot.sharedAt).toLocaleString()}`
                                        : ""}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2 sm:min-w-[22rem] sm:flex-row sm:items-center">
                                  <Input
                                    type="password"
                                    value={sleeperTradeCenterToken}
                                    onChange={event =>
                                      setSleeperTradeCenterToken(
                                        event.target.value
                                      )
                                    }
                                    placeholder="Sleeper auth token"
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="w-full bg-slate-950/80 sm:min-w-[18rem]"
                                  />
                                  <Button
                                    type="submit"
                                    disabled={
                                      hiddenSleeperTradeCenterMutation.isPending
                                    }
                                    className="shrink-0 whitespace-nowrap bg-gradient-to-r from-cyan-500 to-orange-500 text-slate-950 hover:from-cyan-400 hover:to-orange-400"
                                  >
                                    {hiddenSleeperTradeCenterMutation.isPending
                                      ? "Sharing..."
                                      : hiddenSleeperShareButtonLabel}
                                  </Button>
                                </div>
                              </form>
                            </Card>

                            <div className="space-y-6">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                                    Hidden Trade Center Rows
                                  </span>
                                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    {hiddenSleeperImportLoaded
                                      ? "Shared"
                                      : "Run share to populate"}
                                  </span>
                                </div>
                                {hiddenSleeperTradeSignals !== undefined ? (
                                  <TradeProposalSignalsTable
                                    data={hiddenSleeperTradeSignals}
                                    managerAvatars={reportData.managerAvatars}
                                  />
                                ) : (
                                  <Card className="border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
                                    No hidden trade-center rows have been shared
                                    yet. Paste a token above to load pending,
                                    rejected, and cancelled trade offers.
                                  </Card>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
                                    Hidden Waiver Claims
                                  </span>
                                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    {hiddenSleeperImportLoaded
                                      ? "Shared"
                                      : "Run share to populate"}
                                  </span>
                                </div>
                                {hiddenSleeperWaiverSignals !== undefined ? (
                                  <SleeperWaiverClaimsTable
                                    data={hiddenSleeperWaiverSignals}
                                    managerAvatars={reportData.managerAvatars}
                                  />
                                ) : (
                                  <Card className="border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
                                    No hidden waiver claims have been shared yet.
                                    This table will show the player claims and
                                    FAAB bids from Sleeper once the token is
                                    loaded.
                                  </Card>
                                )}
                              </div>
                            </div>
                          </div>
                        </CollapsibleReportSection>
                      )}

                      {canViewAdminFeatureExpansion && (
                        <CollapsibleReportSection
                          title="Admin Eyes Only: Open Trade Offers"
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
                          powerRankings={reportData.powerRankings}
                          dynastyTimelines={reportData.dynastyTimelines}
                          leagueId={leagueId}
                          leagueLogo={leagueLogo}
                          viewerManager={effectiveViewerManager}
                          currentStandings={reportData.currentStandings}
                          leagueValueMode={leagueValueMode}
                        />
                      </CollapsibleReportSection>
                      <CollapsibleReportSection
                        title={
                          isRedraftReport
                            ? "Trade Value Leaderboard"
                            : "All-Time Trade Profit Leaderboard"
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
                        title="Full Trade Ledger"
                        kicker="Every completed deal"
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

                  <TabsContent value="draft" className="report-tab-content">
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
                      showAIReads={canViewAdminFeatureExpansion}
                    />
                  </TabsContent>
                </Suspense>
              </Tabs>
            </div>

            {/* Bottom Action Buttons */}
            <div className="report-footer border-t border-orange-500/20 bg-slate-950/80 backdrop-blur">
              <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
                <div className="report-footer-actions">
                  <div className="report-footer-primary-actions">
                    {hasAdminPermissions && (
                      <Button
                        type="button"
                        onClick={handleAdminToolsClick}
                        variant="outline"
                        className={`report-header-action report-footer-primary-action !w-full sm:!w-auto report-header-admin-toggle ${canViewAdminFeatureExpansion ? "report-header-admin-toggle-active" : ""}`}
                        aria-pressed={canViewAdminFeatureExpansion}
                        aria-label={
                          canViewAdminFeatureExpansion
                            ? "Switch to regular report view"
                            : "Return to admin report view"
                        }
                      >
                        <span className="report-header-action-label">
                          {canViewAdminFeatureExpansion
                            ? "Regular View"
                            : "Admin Tools"}
                        </span>
                      </Button>
                    )}
                    {hasAdminPermissions && hasManagerViewOptions && (
                      <AdminManagerSwitcher
                        managers={reportManagerNames}
                        activeManager={effectiveViewerManager}
                        managerAvatars={reportData.managerAvatars}
                        onSelect={setAdminViewerManager}
                      />
                    )}
                    <Button
                      onClick={handleAnalyzeAnotherLeague}
                      variant="outline"
                      className="report-header-action report-footer-primary-action !w-full sm:!w-auto"
                    >
                      <span className="report-header-action-label">
                        Analyze Another League
                      </span>
                    </Button>
                  </div>
                  <div className="report-footer-secondary-actions">
                    <SupportButton compact />
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

            <Dialog
              open={isLeaguePickerOpen}
              onOpenChange={setIsLeaguePickerOpen}
            >
              <DialogContent className="league-switch-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-2xl">
                <DialogHeader className="league-switch-header text-center sm:text-center">
                  <DialogTitle className="athletic-headline text-3xl text-orange-400">
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
                      <span>.</span>
                    </span>
                    <span>Choose one of your current Sleeper leagues.</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="home-league-picker league-switch-picker">
                  {orderedUserLeagues.map(league => (
                    <LeaguePickerCard
                      key={league.leagueId}
                      league={league}
                      onSelect={handleAnalyzeLeagueOption}
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
                    Back to Home
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
        {loadingDialog}
      </>
    );
  }

  return (
    <>
      <div className="home-shell min-h-screen flex flex-col premium-fx-host">
        <PremiumFxLayer variant="home-hero" intensity="low" />
        <div className="home-header px-4 py-4 sm:py-5">
          <HomeLogoChrome />
          <HomeHeaderShortcuts
            leagues={cachedLeagueShortcuts}
            users={cachedSleeperUsers}
            activeUsername={sleeperUsername}
            onLeagueSelect={handleCachedLeagueShortcutSelect}
            onUserSelect={handleCachedSleeperUserSelect}
          />
        </div>
        <div className="home-main flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16">
          <div className="home-hero w-full max-w-3xl space-y-8 sm:space-y-12">
            {/* Main Title */}
            <div className="home-hero-copy space-y-3 sm:space-y-4 text-center">
              <h2
                className="athletic-title home-title text-4xl sm:text-6xl md:text-7xl bg-gradient-to-r from-orange-400 via-orange-300 to-yellow-300 bg-clip-text text-transparent"
                aria-label="Obliterate Your Competition"
              >
                <span>Obliterate Your</span>
                <span>Competition</span>
              </h2>
              <p className="home-subtitle text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
                Stop guessing. Start dominating.{" "}
                <span className="home-subtitle-name">Dynasty Degenerates</span>{" "}
                blends dynasty market data, redraft season value, roster
                context, and AI-driven reads to give you an unfair advantage in
                every Sleeper league.
              </p>
            </div>

            {/* Input Section */}
            <div className="home-analyze-card space-y-4 sm:space-y-6 p-4 sm:p-8">
              <div className="text-center">
                <label className="home-field-label block text-sm font-semibold text-slate-200 mb-3">
                  Enter Your Sleeper Username
                </label>
                <div className="home-username-row flex flex-col gap-2 sm:gap-3 sm:flex-row w-full">
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
                    className="home-find-leagues-button w-full sm:w-auto h-12 shrink-0 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-5 font-bold text-cyan-100 hover:bg-cyan-400/15"
                  >
                    {userLeaguesMutation.isPending
                      ? "Finding..."
                      : "Find Leagues"}
                  </Button>
                </div>
                <p className="home-field-helper text-xs text-slate-400 mt-2">
                  Pick one of your Sleeper leagues and this will run the report
                  automatically.
                </p>
              </div>

              {userLeagues.length > 0 && (
                <div className="home-league-picker">
                  {orderedUserLeagues.map(league => (
                    <LeaguePickerCard
                      key={league.leagueId}
                      league={league}
                      onSelect={handleAnalyze}
                    />
                  ))}
                </div>
              )}

              <div className="home-id-divider">
                <span>or use a league ID</span>
              </div>

              <div className="text-center">
                <label className="home-field-label block text-sm font-semibold text-slate-200 mb-3">
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
                      window.setTimeout(() => setFocusedAutocomplete(null), 120)
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
                <p className="home-field-helper text-xs text-slate-400 mt-2">
                  In the Sleeper app, open your league → go to General Settings
                  → scroll to the bottom to find your League ID.
                </p>
              </div>

              <Button
                onClick={() => handleAnalyze()}
                disabled={isLoading}
                className="home-analyze-button w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-base gap-2 rounded-lg transition-all duration-200 shadow-lg"
              >
                <Zap size={20} />
                Run Degenerate Analysis
              </Button>
            </div>

            {/* Features Grid */}
            <div className="home-feature-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
              <div className="home-feature-card home-feature-green p-4 sm:p-6 space-y-3">
                <div className="home-feature-heading">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white">League Overview</h3>
                </div>
                <p className="text-sm text-slate-400">
                  See every manager's format-aware value with position strength,
                  starter depth, and roster context. No bullshit, just the
                  numbers.
                </p>
              </div>

              <div className="home-feature-card home-feature-blue p-4 sm:p-6 space-y-3">
                <div className="home-feature-heading">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-white">Trade History</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Track dynasty market swings or redraft current-season trade
                  gaps with the correct value lens for the league.
                </p>
              </div>

              <div className="home-feature-card home-feature-purple p-4 sm:p-6 space-y-3">
                <div className="home-feature-heading">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <ListOrdered className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-white">Player Rankings</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Browse league-matched dynasty, redraft, and prospect boards
                  across SuperFlex, Standard, PPR, and TE-premium formats.
                </p>
              </div>
            </div>
          </div>
        </div>

        {!reportData && (
          <div className="home-footer mt-auto px-4 py-6 sm:py-8">
            <HomeFooterChrome showBrand={!isLoading} />
          </div>
        )}
        {clownEasterEggDialog}
      </div>
      {adminAccessDialog}
      {adminUnlockDialog}
      {loadingDialog}
    </>
  );
}

function CollapsibleReportSection({
  title,
  kicker,
  previewMetrics,
  previewAccessory,
  previewAccessoryPlacement = "end",
  defaultOpen = false,
  premium = false,
  onOpenChange,
  children,
}: {
  title: string;
  kicker?: string;
  previewMetrics?: PreviewMetric[];
  previewAccessory?: ReactNode;
  previewAccessoryPlacement?: "end" | "middle";
  defaultOpen?: boolean;
  premium?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasRenderedContent, setHasRenderedContent] = useState(defaultOpen);
  const visiblePreviewMetrics = (previewMetrics || []).filter(metric => metric.value !== null && metric.value !== undefined && metric.value !== "");
  const useMiddleAccessoryLayout = previewAccessoryPlacement === "middle" && Boolean(previewAccessory) && visiblePreviewMetrics.length === 2;

  useEffect(() => {
    setIsOpen(defaultOpen);
    if (defaultOpen) {
      setHasRenderedContent(true);
    }
  }, [defaultOpen]);

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpen = event.currentTarget.open;
    setIsOpen(nextOpen);
    if (nextOpen) {
      setHasRenderedContent(true);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <details
      className={`report-section report-disclosure${premium ? " admin-premium-flare admin-premium-section" : ""}`}
      open={isOpen}
      onToggle={handleToggle}
    >
      <summary className="report-disclosure-summary">
        <ReportSectionHeader title={title} kicker={kicker} />
        {previewAccessory ? (
          useMiddleAccessoryLayout ? (
            <span className="report-disclosure-preview-row report-disclosure-preview-row-middle">
              <span className="report-disclosure-preview-slot report-disclosure-preview-slot-lead">
                <PreviewMetricChips
                  metrics={[visiblePreviewMetrics[0]]}
                  className="report-disclosure-preview"
                />
              </span>
              <span className="report-disclosure-preview-accessory">
                {previewAccessory}
              </span>
              <span className="report-disclosure-preview-slot report-disclosure-preview-slot-trail">
                <PreviewMetricChips
                  metrics={[visiblePreviewMetrics[1]]}
                  className="report-disclosure-preview"
                />
              </span>
            </span>
          ) : (
            <span className="report-disclosure-preview-row">
              <PreviewMetricChips
                metrics={visiblePreviewMetrics}
                className="report-disclosure-preview"
              />
              <span className="report-disclosure-preview-accessory">
                {previewAccessory}
              </span>
            </span>
          )
        ) : (
          <PreviewMetricChips
            metrics={visiblePreviewMetrics}
            className="report-disclosure-preview"
          />
        )}
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </summary>
      <div className="report-disclosure-body">
        {hasRenderedContent ? (
          <div className="report-disclosure-body-inner">
            <Suspense fallback={<ReportSectionLoadingFallback />}>
              {children}
            </Suspense>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ModalReportSection({
  title,
  kicker,
  previewMetrics,
  children,
}: {
  title: string;
  kicker?: string;
  previewMetrics?: PreviewMetric[];
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="report-section report-disclosure report-modal-section">
      <button
        type="button"
        className="report-disclosure-summary report-modal-trigger"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <ReportSectionHeader title={title} kicker={kicker} />
        <PreviewMetricChips
          metrics={previewMetrics}
          className="report-disclosure-preview"
        />
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="full-trade-ledger-modal flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-h-[90vh] sm:max-w-6xl">
          <DialogHeader className="trade-ledger-modal-header">
            <DialogTitle className="trade-ledger-modal-title">
              {title}
            </DialogTitle>
            {kicker && (
              <DialogDescription className="trade-ledger-modal-kicker">
                {kicker}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="trade-ledger-modal-body">
            <Suspense fallback={<ReportSectionLoadingFallback />}>
              {children}
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
