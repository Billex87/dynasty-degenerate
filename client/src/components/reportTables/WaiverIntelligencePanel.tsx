import React, { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import type {
  ActionPlanRecord,
  ActionPlanStatus,
  ManagerIntelPlayer,
  PlayerDetails,
  RecentTransactionPlayer,
  ReportData,
  TrendingPlayer,
  WaiverBidHistoryRecord,
} from "@shared/types";
import { trpc } from "@/lib/trpc";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { TeamLogoPill } from "../TeamLogoPill";
import { PlayerIdentityRow } from "../reportPrimitives";
import {
  getPlayerRankForMode,
  normalizeLeagueValueMode,
  type LeagueValueMode,
} from "@/lib/leagueValueMode";
import { getPositionRankClass } from "@/lib/positionRank";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import { getBalancedGridStyle } from "@/lib/balancedGrid";
import {
  buildPlayerModalData,
  formatCompactValue,
  PositionRankPill,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./shared";

type OwnerIntelRow = NonNullable<ReportData["managerRosterIntelligence"]>[number];
type CountPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
const COUNT_POSITIONS: CountPosition[] = ["QB", "RB", "WR", "TE", "K", "DEF"];
const AI_RECOMMENDATION_BADGE_LABEL = "AI TARGET";
const AI_RECOMMENDATION_BANNER_LABEL = "AI PICKUP SIGNAL";
const AI_NEURAL_SURFACE_CLASS = "ai-neural-surface";

function getAiNeuralSurfaceClass(theme = "neutral", extraClassName = "") {
  return [AI_NEURAL_SURFACE_CLASS, `${AI_NEURAL_SURFACE_CLASS}-${theme}`, extraClassName]
    .filter(Boolean)
    .join(" ");
}

function normalizeManagerKey(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\d+$/g, "");
}

function parsePositionRankValue(rank: string | null | undefined): number | null {
  const match = String(rank || "").match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function clampPercentValue(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function WaiverRankPill({
  label,
  rank,
  className = "",
}: {
  label: string;
  rank?: string | null;
  className?: string;
}) {
  if (!rank) return null;
  return (
    <span className={`waiver-intel-rank-pill ${className} ${getPositionRankClass(rank)}`}>
      <em>{label}</em>
      {rank}
    </span>
  );
}

const ACTION_PLAN_STORAGE_KEY = "dynasty-degenerates:action-plans:v1";
const WAIVER_BID_HISTORY_STORAGE_KEY =
  "dynasty-degenerates:waiver-bid-history:v1";

type StoredActionPlanStatus = ActionPlanStatus;
type StoredActionPlan = ActionPlanRecord;
type StoredWaiverBidHistoryItem = WaiverBidHistoryRecord;

function readJsonArrayFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArrayToStorage<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function readStoredActionPlans(): StoredActionPlan[] {
  return readJsonArrayFromStorage<StoredActionPlan>(ACTION_PLAN_STORAGE_KEY);
}

function upsertStoredActionPlan(plan: StoredActionPlan): StoredActionPlan[] {
  const next = [
    plan,
    ...readStoredActionPlans().filter(item => item.id !== plan.id),
  ].slice(0, 80);
  writeJsonArrayToStorage(ACTION_PLAN_STORAGE_KEY, next);
  return next;
}

function mergeActionPlans(...groups: StoredActionPlan[][]): StoredActionPlan[] {
  const byId = new Map<string, StoredActionPlan>();
  groups.flat().forEach(plan => {
    const existing = byId.get(plan.id);
    if (
      !existing ||
      (plan.updatedAt || plan.createdAt) >=
        (existing.updatedAt || existing.createdAt)
    ) {
      byId.set(plan.id, plan);
    }
  });
  return Array.from(byId.values())
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 100);
}

function useStoredActionPlans({ leagueId }: { leagueId?: string } = {}) {
  const [storedActionPlans, setStoredActionPlans] = useState<
    StoredActionPlan[]
  >(() => readStoredActionPlans());
  const utils = trpc.useUtils();
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canUseServerPersistence = Boolean(authQuery.data);
  const serverActionPlansQuery = trpc.actionPlans.list.useQuery(
    { leagueId },
    {
      enabled: canUseServerPersistence,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
    }
  );
  const upsertActionPlanMutation = trpc.actionPlans.upsert.useMutation({
    onSuccess: async () => {
      await utils.actionPlans.list.invalidate({ leagueId });
    },
  });
  const persistStoredActionPlan = (plan: StoredActionPlan) => {
    const next = upsertStoredActionPlan({ ...plan, updatedAt: Date.now() });
    setStoredActionPlans(next);
    if (canUseServerPersistence) {
      upsertActionPlanMutation.mutate({
        plan: { ...plan, updatedAt: Date.now() },
      });
    }
  };
  return {
    storedActionPlans: mergeActionPlans(
      storedActionPlans,
      serverActionPlansQuery.data?.plans || []
    ),
    persistStoredActionPlan,
    isServerPersistenceEnabled: canUseServerPersistence,
  };
}

function readStoredWaiverBidHistory(): StoredWaiverBidHistoryItem[] {
  return readJsonArrayFromStorage<StoredWaiverBidHistoryItem>(
    WAIVER_BID_HISTORY_STORAGE_KEY
  );
}

function upsertStoredWaiverBidHistory(
  item: StoredWaiverBidHistoryItem
): StoredWaiverBidHistoryItem[] {
  const next = [
    item,
    ...readStoredWaiverBidHistory().filter(
      historyItem => historyItem.id !== item.id
    ),
  ].slice(0, 120);
  writeJsonArrayToStorage(WAIVER_BID_HISTORY_STORAGE_KEY, next);
  return next;
}

function mergeWaiverBidHistory(
  ...groups: StoredWaiverBidHistoryItem[][]
): StoredWaiverBidHistoryItem[] {
  const byId = new Map<string, StoredWaiverBidHistoryItem>();
  groups.flat().forEach(item => {
    const existing = byId.get(item.id);
    if (
      !existing ||
      (item.updatedAt || item.createdAt) >=
        (existing.updatedAt || existing.createdAt)
    ) {
      byId.set(item.id, item);
    }
  });
  return Array.from(byId.values())
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 150);
}

function useStoredWaiverBidHistory({ leagueId }: { leagueId?: string } = {}) {
  const [storedWaiverBidHistory, setStoredWaiverBidHistory] = useState<
    StoredWaiverBidHistoryItem[]
  >(() => readStoredWaiverBidHistory());
  const utils = trpc.useUtils();
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const canUseServerPersistence = Boolean(authQuery.data);
  const serverBidHistoryQuery = trpc.actionPlans.listWaiverBidHistory.useQuery(
    { leagueId },
    {
      enabled: canUseServerPersistence,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
    }
  );
  const upsertBidHistoryMutation =
    trpc.actionPlans.upsertWaiverBidHistory.useMutation({
      onSuccess: async () => {
        await utils.actionPlans.listWaiverBidHistory.invalidate({ leagueId });
      },
    });
  const persistStoredWaiverBidHistory = (item: StoredWaiverBidHistoryItem) => {
    const next = upsertStoredWaiverBidHistory({
      ...item,
      updatedAt: Date.now(),
    });
    setStoredWaiverBidHistory(next);
    if (canUseServerPersistence) {
      upsertBidHistoryMutation.mutate({
        item: { ...item, updatedAt: Date.now() },
      });
    }
  };
  return {
    storedWaiverBidHistory: mergeWaiverBidHistory(
      storedWaiverBidHistory,
      serverBidHistoryQuery.data?.bidHistory || []
    ),
    persistStoredWaiverBidHistory,
  };
}

function copyTextToClipboard(value: string): void {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText)
    return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

function openSleeperLeague(leagueId?: string): void {
  if (!leagueId || typeof window === "undefined") return;
  window.open(
    `https://sleeper.com/leagues/${encodeURIComponent(leagueId)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function parseFaabBidRange(label: string): { min: number; max: number } | null {
  const values = (label.match(/\d+/g) || [])
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value >= 0);
  if (!values.length) return null;
  return {
    min: values[0],
    max: values[1] ?? values[0],
  };
}

function formatActionPlanTimestamp(value?: number): string {
  if (!value) return "Saved";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getActionPlanCopy(plan: StoredActionPlan): string {
  const planKindLabel =
    plan.kind === "lineup"
      ? "Lineup"
      : plan.kind === "trade"
        ? "Trade"
        : "Waiver";
  return [
    `${planKindLabel} action plan`,
    plan.title,
    plan.summary,
    `Status: ${plan.status}`,
    plan.manager ? `Manager: ${plan.manager}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function getActionPlanKindLabel(kind: StoredActionPlan["kind"]): string {
  if (kind === "lineup") return "Lineup";
  if (kind === "trade") return "Trade";
  return "Waiver";
}

function getWaiverPlanOutcomeStatus(
  plan: StoredActionPlan,
  recentTransactions?: ReportData["recentTransactions"]
): StoredActionPlanStatus | null {
  if (
    plan.kind !== "waiver" ||
    !plan.playerId ||
    ["won", "lost"].includes(plan.status)
  )
    return null;
  const matchingAdd =
    (recentTransactions || [])
      .filter(
        transaction => transaction.addedPlayer?.player_id === plan.playerId
      )
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0] || null;
  if (!matchingAdd) return null;
  return normalizeManagerKey(matchingAdd.manager) ===
    normalizeManagerKey(plan.manager)
    ? "won"
    : "lost";
}

function ActionPlanHistoryPanel({
  plans,
  leagueId,
  isServerPersistenceEnabled,
  title = "Action History",
}: {
  plans: StoredActionPlan[];
  leagueId?: string;
  isServerPersistenceEnabled?: boolean;
  title?: string;
}) {
  if (!plans.length) return null;

  return (
    <div className="action-plan-history-panel">
      <div className="action-plan-history-head">
        <div>
          <span>Saved decisions</span>
          <h4>{title}</h4>
        </div>
        <em>{isServerPersistenceEnabled ? "Synced" : "Local"}</em>
      </div>
      <div className="action-plan-history-list">
        {plans.slice(0, 5).map(plan => (
          <div
            key={plan.id}
            className={`action-plan-history-item action-plan-history-item-${plan.kind}`}
          >
            <div className="action-plan-history-copy">
              <span>
                {getActionPlanKindLabel(plan.kind)} • {plan.status}
              </span>
              <strong>{plan.title}</strong>
              <p>{plan.summary}</p>
              <small>
                {formatActionPlanTimestamp(plan.updatedAt || plan.createdAt)}
              </small>
            </div>
            <div className="action-plan-history-actions">
              <button
                type="button"
                onClick={() => copyTextToClipboard(getActionPlanCopy(plan))}
                aria-label={`Copy ${plan.title}`}
              >
                <Copy aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={!leagueId}
                onClick={() => openSleeperLeague(leagueId)}
                aria-label={`Open Sleeper for ${plan.title}`}
              >
                <ExternalLink aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type WaiverPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

type WaiverRecommendation = {
  player: TrendingPlayer;
  score: number;
  reason: string;
  label: string;
  targetPosition: WaiverPosition | null;
  bidRangeLabel: string;
  bidConfidencePct: number;
  bidSource: "league-history" | "free-history" | "model";
  bidEvidenceLabel: string;
  competitionRead: WaiverCompetitionRead | null;
  dropCandidate: ManagerIntelPlayer | null;
  dropReason: string | null;
  claimPriority: "Add" | "Add/Drop" | "Watchlist";
};

type WaiverCompetitionRead = {
  manager: string;
  level: "High" | "Medium" | "Low";
  confidencePct: number;
  bidHint: string;
  reason: string;
};

type WaiverRecommendationContext = {
  openRosterSpots: number;
  irOnlyOpenSpots: number;
  targetPositions: WaiverPosition[];
  recommendations: WaiverRecommendation[];
  summary: string | null;
};

const WAIVER_POSITIONS: WaiverPosition[] = ["QB", "RB", "WR", "TE", "K", "DEF"];
const WAIVER_SPECIAL_TEAMS_POSITIONS = ["K", "DEF"] as const;
const WAIVER_RECOMMENDATION_LIMIT = 4;
const WAIVER_RECOMMENDATION_MINIMUM = 2;
export const VALUE_BLEND_HISTORY_START_LABEL = "May 7, 2026";
export const FIRST_FULL_BLEND_WEEK_LABEL = "May 12, 2026 after the 6 PM scrape";

function getWaiverActionPlanId(
  leagueId: string | undefined,
  manager: string | null | undefined,
  recommendation: WaiverRecommendation
): string {
  return [
    "waiver",
    leagueId || "unknown-league",
    normalizeManagerKey(manager),
    recommendation.player.player_id,
  ].join(":");
}

function getWaiverActionPlanCopy(
  manager: string | null | undefined,
  recommendation: WaiverRecommendation
): string {
  return [
    `Waiver plan${manager ? ` for ${manager}` : ""}`,
    `Add: ${recommendation.player.name}`,
    `Bid: ${recommendation.bidRangeLabel} (${recommendation.bidConfidencePct}% confidence)`,
    `Bid evidence: ${recommendation.bidEvidenceLabel}`,
    recommendation.competitionRead
      ? `Competition: ${recommendation.competitionRead.manager} ${recommendation.competitionRead.level.toLowerCase()} threat (${recommendation.competitionRead.bidHint}). ${recommendation.competitionRead.reason}`
      : "Competition: no strong competing manager signal returned",
    recommendation.dropCandidate
      ? `Drop: ${recommendation.dropCandidate.name}`
      : recommendation.claimPriority === "Add"
        ? "Drop: no drop needed"
        : "Drop: manual room needed",
    `Reason: ${recommendation.reason}`,
  ].join("\n");
}

function createWaiverActionPlan({
  leagueId,
  manager,
  recommendation,
  status,
}: {
  leagueId?: string;
  manager?: string | null;
  recommendation: WaiverRecommendation;
  status: StoredActionPlanStatus;
}): StoredActionPlan {
  return {
    id: getWaiverActionPlanId(leagueId, manager, recommendation),
    kind: "waiver",
    leagueId,
    manager,
    playerId: recommendation.player.player_id,
    createdAt: Date.now(),
    title: `Claim ${recommendation.player.name}`,
    summary: `${recommendation.bidRangeLabel}; ${recommendation.dropCandidate ? `drop ${recommendation.dropCandidate.name}` : recommendation.claimPriority}.`,
    status,
    payload: {
      player: {
        playerId: recommendation.player.player_id,
        name: recommendation.player.name,
        position: recommendation.player.pos,
      },
      bidRangeLabel: recommendation.bidRangeLabel,
      bidConfidencePct: recommendation.bidConfidencePct,
      bidSource: recommendation.bidSource,
      bidEvidenceLabel: recommendation.bidEvidenceLabel,
      competitionRead: recommendation.competitionRead,
      claimPriority: recommendation.claimPriority,
      dropCandidate: recommendation.dropCandidate
        ? {
            playerId: recommendation.dropCandidate.player_id,
            name: recommendation.dropCandidate.name,
            position: recommendation.dropCandidate.pos,
          }
        : null,
      reason: recommendation.reason,
    },
  };
}

function createWaiverBidHistoryItem({
  leagueId,
  manager,
  recommendation,
}: {
  leagueId?: string;
  manager?: string | null;
  recommendation: WaiverRecommendation;
}): StoredWaiverBidHistoryItem | null {
  const parsedRange = parseFaabBidRange(recommendation.bidRangeLabel);
  if (!parsedRange) return null;
  return {
    id: [
      "waiver-bid",
      leagueId || "unknown-league",
      normalizeManagerKey(manager),
      recommendation.player.player_id,
    ].join(":"),
    leagueId,
    manager,
    playerId: recommendation.player.player_id,
    playerName: recommendation.player.name,
    position: recommendation.player.pos,
    bidMin: parsedRange.min,
    bidMax: parsedRange.max,
    bidLabel: recommendation.bidRangeLabel,
    source: "submitted-plan",
    createdAt: Date.now(),
  };
}

type WaiverSpecialTeamsPosition =
  (typeof WAIVER_SPECIAL_TEAMS_POSITIONS)[number];
type WaiverManagerPlayer = NonNullable<
  ReportData["managerPositionCounts"][number]["lineupPlayers"]
>[number];
type WaiverSpecialTeamsUpgradeRead = {
  position: WaiverSpecialTeamsPosition;
  playerId: string;
  reason: string;
};

function isWaiverPosition(
  position: string | null | undefined
): position is WaiverPosition {
  return WAIVER_POSITIONS.includes(position as WaiverPosition);
}

function normalizeReportManagerName(manager?: string | null): string {
  return manager?.trim().toLowerCase() || "";
}

function getWaiverPlayerDetails(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): PlayerDetails | undefined {
  const mappedDetails = playerDetailsById?.[player.player_id];
  if (!mappedDetails) return player.playerDetails;
  return {
    ...player.playerDetails,
    ...mappedDetails,
    valueProfile:
      mappedDetails.valueProfile || player.playerDetails?.valueProfile,
  };
}

function isNonDynastyWaiverPosition(
  position: string | null | undefined
): boolean {
  return position === "K" || position === "DEF";
}

function getWaiverDynastyValue(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): number {
  if (isNonDynastyWaiverPosition(player.pos)) return 0;
  const details = getWaiverPlayerDetails(player, playerDetailsById);
  return Math.round(
    details?.valueProfile?.dynastyValue ??
      details?.valueProfile?.balancedValue ??
      player.ktcValue ??
      0
  );
}

function getWaiverSeasonValue(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): number {
  const details = getWaiverPlayerDetails(player, playerDetailsById);
  const fallbackSeasonValue = isNonDynastyWaiverPosition(player.pos)
    ? player.ktcValue
    : null;
  return Math.round(
    details?.valueProfile?.seasonValue ??
      details?.valueProfile?.fantasyProsSeasonValue ??
      fallbackSeasonValue ??
      0
  );
}

function getWaiverPlayerValue(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): number {
  return (
    getWaiverDynastyValue(player, playerDetailsById) ||
    getWaiverSeasonValue(player, playerDetailsById) ||
    Math.round(player.ktcValue || 0)
  );
}

function getWaiverDynastyRank(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): string | null {
  if (isNonDynastyWaiverPosition(player.pos)) return null;
  const details = getWaiverPlayerDetails(player, playerDetailsById);
  const explicitRank =
    details?.valueProfile?.dynastyPositionRank ||
    details?.valueProfile?.balancedPositionRank ||
    null;
  if (explicitRank) return explicitRank;
  return details?.valueProfile?.seasonPositionRank
    ? null
    : player.currentPositionRank || null;
}

function getWaiverSeasonRank(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): string | null {
  const details = getWaiverPlayerDetails(player, playerDetailsById);
  return (
    details?.valueProfile?.seasonPositionRank ||
    details?.valueProfile?.fantasyProsPositionRank ||
    (isNonDynastyWaiverPosition(player.pos)
      ? player.currentPositionRank
      : null) ||
    null
  );
}

function getWaiverPlayerRank(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById
): string | null {
  return (
    getWaiverDynastyRank(player, playerDetailsById) ||
    getWaiverSeasonRank(player, playerDetailsById)
  );
}

function collectWaiverCandidates(
  data: NonNullable<ReportData["waiverIntelligence"]>
): TrendingPlayer[] {
  const byId = new Map<string, TrendingPlayer>();
  const addPlayer = (player: TrendingPlayer | null | undefined) => {
    if (!player?.player_id || player.owner || !isWaiverPosition(player.pos))
      return;
    if (!byId.has(player.player_id)) byId.set(player.player_id, player);
  };

  addPlayer(data.highestKtcAvailable);
  Object.values(data.bestAvailableByPosition).forEach(addPlayer);
  data.bestTaxiStashes.forEach(addPlayer);
  data.availableTrendingAdds.forEach(addPlayer);
  data.recentlyDroppedValuable.forEach(addPlayer);

  return Array.from(byId.values());
}

function getWaiverRosterOpenings(
  viewerIntel: OwnerIntelRow | null | undefined,
  leagueDiagnostics?: ReportData["leagueDiagnostics"],
  positionCountRow?: ReportData["managerPositionCounts"][number] | null
): { activeOpenSpots: number; irOnlyOpenSpots: number } {
  const rosterSlots = leagueDiagnostics?.rosterSlots || [];
  const activeSlotCount = rosterSlots.filter(slot => {
    const normalized = String(slot || "").toUpperCase();
    return (
      normalized &&
      normalized !== "IR" &&
      normalized !== "TAXI" &&
      normalized !== "RESERVE"
    );
  }).length;
  const irSlotCount = rosterSlots.filter(slot => {
    const normalized = String(slot || "").toUpperCase();
    return normalized === "IR" || normalized === "RESERVE";
  }).length;
  const exactActiveRosterCount = Number(
    positionCountRow?.activePlayerCount || 0
  );
  const exactReserveRosterCount = Number(
    positionCountRow?.reservePlayerCount || 0
  );
  const displayedActiveRosterCount =
    positionCountRow?.lineupPlayers?.length ||
    viewerIntel?.rosterPlayers?.length ||
    0;
  const displayedReserveRosterCount = viewerIntel?.reservePlayers?.length || 0;
  const fallbackRosterCount = positionCountRow
    ? COUNT_POSITIONS.reduce(
        (sum, position) => sum + Number(positionCountRow[position] || 0),
        0
      )
    : 0;
  const activeRosterCount =
    exactActiveRosterCount || displayedActiveRosterCount || fallbackRosterCount;
  const reserveRosterCount =
    exactReserveRosterCount || displayedReserveRosterCount;
  return {
    activeOpenSpots: activeSlotCount
      ? Math.max(0, activeSlotCount - activeRosterCount)
      : 0,
    irOnlyOpenSpots: irSlotCount
      ? Math.max(0, irSlotCount - reserveRosterCount)
      : 0,
  };
}

function getWaiverNeedWeights(
  viewerIntel: OwnerIntelRow | null | undefined,
  positionDepth?: ReportData["positionDepth"],
  viewerManager?: string | null
): Record<WaiverPosition, number> {
  const weights: Record<WaiverPosition, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };
  const addWeight = (position: string | null | undefined, amount: number) => {
    if (isWaiverPosition(position)) weights[position] += amount;
    if (position === "FLEX") {
      weights.RB += amount * 0.72;
      weights.WR += amount * 0.72;
      weights.TE += amount * 0.45;
    }
  };

  const normalizedViewer = normalizeReportManagerName(
    viewerManager || viewerIntel?.manager
  );
  positionDepth
    ?.filter(
      row =>
        normalizeReportManagerName(row.manager) === normalizedViewer &&
        row.status === "shortage"
    )
    .forEach(row => addWeight(row.position, 760));

  addWeight(viewerIntel?.tradePlan?.needPosition, 520);

  viewerIntel?.benchBaseline?.forEach(tile => {
    const gradeWeight =
      tile.grade === "Problem"
        ? 680
        : tile.grade === "Playable"
          ? 420
          : tile.grade === "Thin"
            ? 360
            : 0;
    const emptyWeight = tile.player ? 0 : 520;
    const leagueRankWeight = tile.leagueRank && tile.leagueRank >= 7 ? 220 : 0;
    addWeight(tile.key, gradeWeight + emptyWeight + leagueRankWeight);
  });

  if ((viewerIntel?.holes.flexDepth || 0) <= 1) {
    addWeight("FLEX", 320);
  }

  return weights;
}

function normalizeWaiverRosterSlot(
  slot: string | null | undefined
): WaiverPosition | null {
  const normalized = String(slot || "")
    .trim()
    .toUpperCase();
  if (
    normalized === "D" ||
    normalized === "DEF" ||
    normalized === "DST" ||
    normalized === "D/ST"
  )
    return "DEF";
  return isWaiverPosition(normalized) ? normalized : null;
}

function waiverLeagueUsesPosition(
  leagueDiagnostics: ReportData["leagueDiagnostics"] | undefined,
  position: WaiverSpecialTeamsPosition
): boolean {
  return (leagueDiagnostics?.rosterSlots || []).some(
    slot => normalizeWaiverRosterSlot(slot) === position
  );
}

function getWaiverSpecialTeamsLabel(
  position: WaiverSpecialTeamsPosition
): string {
  return position === "DEF" ? "Defense" : "Kicker";
}

function compareWaiverManagerPlayers(
  a: WaiverManagerPlayer,
  b: WaiverManagerPlayer
): number {
  const aRank =
    parsePositionRankValue(a.seasonPositionRank || a.currentPositionRank) ||
    999;
  const bRank =
    parsePositionRankValue(b.seasonPositionRank || b.currentPositionRank) ||
    999;
  const rankDelta = aRank - bRank;
  if (rankDelta !== 0) return rankDelta;
  return (b.seasonValue || b.value || 0) - (a.seasonValue || a.value || 0);
}

function getWaiverManagerPositionPlayers(
  row: ReportData["managerPositionCounts"][number] | null,
  position: WaiverSpecialTeamsPosition
): WaiverManagerPlayer[] {
  const byId = new Map<string, WaiverManagerPlayer>();
  [
    ...(row?.starterPlayers || []),
    ...(row?.lineupPlayers || []),
    ...(row?.rosterPlayers || []),
  ].forEach(player => {
    if (player.pos === position && !byId.has(player.player_id)) {
      byId.set(player.player_id, player);
    }
  });
  return Array.from(byId.values()).sort(compareWaiverManagerPlayers);
}

function buildWaiverSpecialTeamsUpgradeReads({
  data,
  viewerPositionCounts,
  leagueDiagnostics,
  playerDetailsById,
}: {
  data: NonNullable<ReportData["waiverIntelligence"]>;
  viewerPositionCounts: ReportData["managerPositionCounts"][number] | null;
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  playerDetailsById?: PlayerDetailsById;
}): Partial<Record<WaiverSpecialTeamsPosition, WaiverSpecialTeamsUpgradeRead>> {
  const upgrades: Partial<
    Record<WaiverSpecialTeamsPosition, WaiverSpecialTeamsUpgradeRead>
  > = {};

  WAIVER_SPECIAL_TEAMS_POSITIONS.forEach(position => {
    if (!waiverLeagueUsesPosition(leagueDiagnostics, position)) return;
    const available =
      data.bestAvailableByPosition[position] ||
      (data.highestKtcAvailable?.pos === position
        ? data.highestKtcAvailable
        : null);
    if (!available || available.owner) return;

    const current =
      getWaiverManagerPositionPlayers(viewerPositionCounts, position)[0] ||
      null;
    const availableRank =
      getWaiverSeasonRank(available, playerDetailsById) ||
      available.currentPositionRank ||
      null;
    const currentRank =
      current?.seasonPositionRank || current?.currentPositionRank || null;
    const availableRankNumber = parsePositionRankValue(availableRank);
    const currentRankNumber = parsePositionRankValue(currentRank);
    const availableValue =
      getWaiverSeasonValue(available, playerDetailsById) ||
      getWaiverPlayerValue(available, playerDetailsById);
    const currentValue = current
      ? Number(current.seasonValue || current.value || 0)
      : 0;
    const rankUpgrade = current
      ? availableRankNumber !== null &&
        currentRankNumber !== null &&
        availableRankNumber < currentRankNumber
      : availableRankNumber !== null;
    const valueUpgrade = current
      ? (availableRankNumber === null || currentRankNumber === null) &&
        availableValue > currentValue + 50
      : availableValue > 0;
    if (!rankUpgrade && !valueUpgrade) return;

    const label = getWaiverSpecialTeamsLabel(position);
    const rankCopy = availableRank ? ` at ${availableRank}` : "";
    const currentCopy = current
      ? `${current.name}${currentRank ? ` (${currentRank})` : ""}`
      : `your empty ${label.toLowerCase()} slot`;

    upgrades[position] = {
      position,
      playerId: available.player_id,
      reason: current
        ? `${label} upgrade over ${currentCopy}${rankCopy}`
        : `${label} fills an empty starter slot${rankCopy}`,
    };
  });

  return upgrades;
}

function buildWaiverRecommendationReason({
  player,
  playerDetailsById,
  targetPosition,
  needWeight,
  openRosterSpots,
  specialTeamsUpgradeReason,
  leagueValueMode = "dynasty",
}: {
  player: TrendingPlayer;
  playerDetailsById?: PlayerDetailsById;
  targetPosition: WaiverPosition | null;
  needWeight: number;
  openRosterSpots: number;
  specialTeamsUpgradeReason?: string | null;
  leagueValueMode?: LeagueValueMode;
}): string {
  const details = getWaiverPlayerDetails(player, playerDetailsById);
  const isRedraft = leagueValueMode === "redraft";
  const dynastyRank = getWaiverDynastyRank(player, playerDetailsById);
  const seasonRank = getWaiverSeasonRank(player, playerDetailsById);
  const age = details?.age ?? null;
  const depthOrder = details?.depthChartOrder;
  const rookieYear = Number(details?.rookieYear || 0);
  const currentYear = new Date().getFullYear();
  const positionCopy = specialTeamsUpgradeReason
    ? specialTeamsUpgradeReason
    : targetPosition && needWeight > 0
      ? `${targetPosition} matches your roster-depth need`
      : isRedraft
        ? `${player.pos} has the best current opportunity available`
        : `${player.pos} is the best dynasty/role shot available`;
  const ageCopy = age ? `${age} years old` : null;
  const rankCopy = specialTeamsUpgradeReason
    ? null
    : [
        !isRedraft && dynastyRank ? `Dynasty ${dynastyRank}` : null,
        seasonRank ? `Season ${seasonRank}` : null,
      ]
        .filter(Boolean)
        .join(" / ") || null;
  const roleCopy =
    typeof depthOrder === "number" && Number.isFinite(depthOrder)
      ? `depth chart path ${depthOrder}`
      : rookieYear === currentYear
        ? "rookie stash profile"
        : details?.latestNews?.title
          ? "recent role/news signal"
          : null;
  const spotCopy =
    openRosterSpots > 0
      ? openRosterSpots === 1
        ? "fits the active roster opening"
        : `fits one of ${openRosterSpots} active roster openings`
      : "is a priority watchlist add if you create a spot";

  return [positionCopy, ageCopy, rankCopy, roleCopy, spotCopy]
    .filter(Boolean)
    .join(" • ");
}

function getWaiverRecommendationLabel(
  player: TrendingPlayer,
  playerDetailsById?: PlayerDetailsById,
  leagueValueMode: LeagueValueMode = "dynasty"
): string {
  const details = getWaiverPlayerDetails(player, playerDetailsById);
  const dynastyRankNumber = parsePositionRankValue(
    getWaiverDynastyRank(player, playerDetailsById)
  );
  const seasonRankNumber = parsePositionRankValue(
    getWaiverSeasonRank(player, playerDetailsById)
  );
  const depthOrder = Number(details?.depthChartOrder || 0);
  const age = Number(details?.age || 0);
  const rookieYear = Number(details?.rookieYear || 0);
  const currentYear = new Date().getFullYear();

  if (leagueValueMode === "redraft") {
    if (isNonDynastyWaiverPosition(player.pos)) return `${player.pos} Streamer`;
    if (seasonRankNumber && seasonRankNumber <= 48) return "Starter Viability";
    if (depthOrder > 0 && depthOrder <= 2) return "Current Opportunity";
    if (seasonRankNumber && seasonRankNumber <= 84) return "Bench Depth";
    return "Waiver Relevance";
  }

  if (isNonDynastyWaiverPosition(player.pos)) return `${player.pos} Streamer`;
  if (rookieYear === currentYear || (age && age <= 22)) return "Dynasty Stash";
  if (depthOrder > 0 && depthOrder <= 2) return "Role Path";
  if (seasonRankNumber && seasonRankNumber <= 72) return "Season Path";
  if (dynastyRankNumber && dynastyRankNumber <= 120) return "Value Add";
  return "Upside Add";
}

function getPercentile(values: number[], percentile: number): number | null {
  const sorted = values
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

function averagePositive(values: number[]): number | null {
  const finite = values.filter(value => Number.isFinite(value) && value > 0);
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function isWaiverTaxiProfile(
  player: TrendingPlayer | RecentTransactionPlayer | null | undefined
): boolean {
  if (!player) return false;
  const rookieYear = Number(player.playerDetails?.rookieYear || 0);
  const age = Number(player.playerDetails?.age || 0);
  const currentYear = new Date().getFullYear();
  return (
    player.playerDetails?.rosterStatus === "Taxi" ||
    rookieYear === currentYear ||
    (age > 0 && age <= 22)
  );
}

function getManagerWaiverBidSamples({
  manager,
  leagueId,
  position,
  recentTransactions,
  storedWaiverBidHistory,
}: {
  manager?: string | null;
  leagueId?: string;
  position?: string | null;
  recentTransactions?: ReportData["recentTransactions"];
  storedWaiverBidHistory?: StoredWaiverBidHistoryItem[];
}) {
  const managerKey = normalizeManagerKey(manager);
  const transactionBids = (recentTransactions || [])
    .filter(
      transaction => normalizeManagerKey(transaction.manager) === managerKey
    )
    .filter(
      transaction =>
        transaction.type === "Waiver" &&
        Number(transaction.bidAmount || 0) > 0 &&
        transaction.addedPlayer
    )
    .map(transaction => ({
      bid: Number(transaction.bidAmount || 0),
      pos: transaction.addedPlayer?.pos || null,
    }));
  const persistedBids = (storedWaiverBidHistory || [])
    .filter(item => normalizeManagerKey(item.manager) === managerKey)
    .filter(
      item =>
        (!leagueId || !item.leagueId || item.leagueId === leagueId) &&
        item.bidMax > 0
    )
    .map(item => ({
      bid: Math.max(item.bidMin, item.bidMax),
      pos: item.position || null,
    }));
  const samples = [...transactionBids, ...persistedBids];
  const positionSamples = samples
    .filter(sample => sample.pos === position)
    .map(sample => sample.bid);
  const allSamples = samples.map(sample => sample.bid);
  return {
    positionSamples,
    allSamples,
    preferredSamples:
      positionSamples.length >= 2 ? positionSamples : allSamples,
  };
}

function buildWaiverCompetitionRead({
  player,
  viewerManager,
  managerRosterIntelligence,
  managerPositionCounts,
  positionDepth,
  recentTransactions,
  storedWaiverBidHistory,
  leagueId,
}: {
  player: TrendingPlayer;
  viewerManager?: string | null;
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
  managerPositionCounts?: ReportData["managerPositionCounts"];
  positionDepth?: ReportData["positionDepth"];
  recentTransactions?: ReportData["recentTransactions"];
  storedWaiverBidHistory?: StoredWaiverBidHistoryItem[];
  leagueId?: string;
}): WaiverCompetitionRead | null {
  const playerPosition = isWaiverPosition(player.pos) ? player.pos : null;
  if (!playerPosition) return null;
  const viewerKey = normalizeManagerKey(viewerManager);
  const playerIsTaxiProfile = isWaiverTaxiProfile(player);

  const reads = (managerRosterIntelligence || [])
    .filter(intel => normalizeManagerKey(intel.manager) !== viewerKey)
    .map(intel => {
      const managerKey = normalizeManagerKey(intel.manager);
      const managerTransactions = (recentTransactions || []).filter(
        transaction => normalizeManagerKey(transaction.manager) === managerKey
      );
      const waiverTransactions = managerTransactions.filter(
        transaction => transaction.type === "Waiver"
      );
      const samePositionTransactions = managerTransactions.filter(
        transaction =>
          transaction.addedPlayer?.pos === playerPosition ||
          transaction.droppedPlayer?.pos === playerPosition
      );
      const taxiTransactions = managerTransactions.filter(
        transaction =>
          isWaiverTaxiProfile(transaction.addedPlayer) ||
          isWaiverTaxiProfile(transaction.droppedPlayer)
      );
      const needWeights = getWaiverNeedWeights(
        intel,
        positionDepth,
        intel.manager
      );
      const positionNeed = needWeights[playerPosition] || 0;
      const positionCounts =
        managerPositionCounts?.find(
          row => normalizeManagerKey(row.manager) === managerKey
        ) || null;
      const taxiCount = Number(positionCounts?.taxiPlayerCount || 0);
      const bidSamples = getManagerWaiverBidSamples({
        manager: intel.manager,
        leagueId,
        position: playerPosition,
        recentTransactions,
        storedWaiverBidHistory,
      });
      const averageBid = averagePositive(bidSamples.preferredSamples);
      const activityScore = Math.min(
        28,
        managerTransactions.length * 6 + waiverTransactions.length * 3
      );
      const needScore = Math.min(30, positionNeed / 34);
      const positionChurnScore = Math.min(
        12,
        samePositionTransactions.length * 4
      );
      const bidScore = averageBid ? Math.min(16, averageBid * 1.35) : 0;
      const taxiScore = playerIsTaxiProfile
        ? Math.min(12, taxiTransactions.length * 5 + (taxiCount > 0 ? 4 : 0))
        : 0;
      const score = clampPercentValue(
        28 +
          activityScore +
          needScore +
          positionChurnScore +
          bidScore +
          taxiScore
      );
      const level: WaiverCompetitionRead["level"] =
        score >= 76 ? "High" : score >= 58 ? "Medium" : "Low";
      const median = getPercentile(bidSamples.preferredSamples, 50);
      const upper = getPercentile(bidSamples.preferredSamples, 75) || median;
      const bidHint = median
        ? `Likely FAAB ${Math.max(1, Math.round(median * 0.8))}-${Math.max(Math.round(median), Math.round((upper || median) * 1.15))}`
        : managerTransactions.length
          ? "Could try a free claim"
          : "No bid pattern returned";
      const reasonParts = [
        managerTransactions.length
          ? `${managerTransactions.length} recent add/drop move${managerTransactions.length === 1 ? "" : "s"}`
          : null,
        positionNeed > 0 ? `${playerPosition} need` : null,
        samePositionTransactions.length
          ? `${samePositionTransactions.length} ${playerPosition} churn signal${samePositionTransactions.length === 1 ? "" : "s"}`
          : null,
        playerIsTaxiProfile && (taxiTransactions.length || taxiCount)
          ? "taxi/rookie appetite"
          : null,
        averageBid ? `avg bid ${Math.round(averageBid)}` : null,
      ].filter(Boolean);

      return {
        manager: intel.manager,
        level,
        confidencePct: score,
        bidHint,
        reason: reasonParts.length
          ? `${intel.manager}: ${reasonParts.join(", ")}.`
          : `${intel.manager}: no strong competing claim pattern returned.`,
      };
    })
    .filter(read => read.confidencePct >= 42)
    .sort((a, b) => b.confidencePct - a.confidencePct);

  return reads[0] || null;
}

function buildWaiverBidRead({
  player,
  score,
  competitionRead,
  recentTransactions,
  storedWaiverBidHistory,
  leagueId,
  leagueValueMode,
}: {
  player: TrendingPlayer;
  score: number;
  competitionRead?: WaiverCompetitionRead | null;
  recentTransactions?: ReportData["recentTransactions"];
  storedWaiverBidHistory?: StoredWaiverBidHistoryItem[];
  leagueId?: string;
  leagueValueMode: LeagueValueMode;
}): Pick<
  WaiverRecommendation,
  "bidRangeLabel" | "bidConfidencePct" | "bidSource" | "bidEvidenceLabel"
> {
  const transactionBids = (recentTransactions || [])
    .filter(
      transaction =>
        transaction.type === "Waiver" &&
        Number(transaction.bidAmount || 0) > 0 &&
        transaction.addedPlayer
    )
    .map(transaction => ({
      bid: Number(transaction.bidAmount || 0),
      pos: transaction.addedPlayer?.pos || null,
    }));
  const persistedBids = (storedWaiverBidHistory || [])
    .filter(
      item =>
        (!leagueId || !item.leagueId || item.leagueId === leagueId) &&
        item.bidMax > 0
    )
    .map(item => ({
      bid: Math.max(item.bidMin, item.bidMax),
      pos: item.position || null,
    }));
  const waiverBids = [...transactionBids, ...persistedBids];
  const positionBids = waiverBids
    .filter(transaction => transaction.pos === player.pos)
    .map(transaction => transaction.bid);
  const fallbackBids = waiverBids.map(transaction => transaction.bid);
  const historicalBids = positionBids.length >= 2 ? positionBids : fallbackBids;
  const historicalBidLabel =
    positionBids.length >= 2
      ? `${positionBids.length} ${player.pos} bid sample${positionBids.length === 1 ? "" : "s"}`
      : `${historicalBids.length} league bid sample${historicalBids.length === 1 ? "" : "s"}`;
  const scoreAdjustment =
    score >= 3000 ? 4 : score >= 2200 ? 3 : score >= 1500 ? 2 : 0;
  const competitionAdjustment =
    competitionRead?.level === "High"
      ? 3
      : competitionRead?.level === "Medium"
        ? 1
        : 0;

  if (historicalBids.length) {
    const median = getPercentile(historicalBids, 50) || 1;
    const upper = getPercentile(historicalBids, 75) || median;
    const min = Math.max(
      1,
      Math.round(median * 0.78 + scoreAdjustment + competitionAdjustment)
    );
    const max = Math.max(
      min,
      Math.round(upper * 1.15 + scoreAdjustment + competitionAdjustment)
    );
    return {
      bidRangeLabel: min === max ? `FAAB ${min}` : `FAAB ${min}-${max}`,
      bidConfidencePct: clampPercentValue(
        62 +
          Math.min(22, historicalBids.length * 3) +
          Math.min(12, score / 360) +
          (competitionRead ? 4 : 0)
      ),
      bidSource: "league-history",
      bidEvidenceLabel: `Based on ${historicalBidLabel}; ${competitionRead ? `${competitionRead.manager} pressure included` : "no strong competing-claim pressure included"}.`,
    };
  }

  const freeAddSignals = (recentTransactions || []).filter(
    transaction =>
      transaction.type === "Free Agent" &&
      transaction.addedPlayer?.pos === player.pos
  ).length;
  if (
    score < 1500 &&
    (competitionRead?.confidencePct || 0) < 58 &&
    freeAddSignals >= 2
  ) {
    return {
      bidRangeLabel: "Free / FAAB 0-1",
      bidConfidencePct: clampPercentValue(
        58 + Math.min(14, freeAddSignals * 4)
      ),
      bidSource: "free-history",
      bidEvidenceLabel: `${freeAddSignals} recent free ${player.pos} add${freeAddSignals === 1 ? "" : "s"} and low competing-claim pressure.`,
    };
  }

  const isRedraft = leagueValueMode === "redraft";
  const minPct =
    score >= 2600
      ? isRedraft
        ? 12
        : 8
      : score >= 1700
        ? isRedraft
          ? 7
          : 5
        : (competitionRead?.confidencePct || 0) < 48
          ? 0
          : isRedraft
            ? 3
            : 1;
  const maxPct =
    score >= 2600
      ? (isRedraft ? 18 : 14) + competitionAdjustment
      : score >= 1700
        ? (isRedraft ? 11 : 8) + competitionAdjustment
        : (isRedraft ? 6 : 4) + competitionAdjustment;

  return {
    bidRangeLabel:
      minPct <= 0 ? `Free / FAAB 0-${maxPct}%` : `FAAB ${minPct}-${maxPct}%`,
    bidConfidencePct: clampPercentValue(
      54 + Math.min(24, score / 150) + (competitionRead ? 4 : 0)
    ),
    bidSource: "model",
    bidEvidenceLabel: competitionRead
      ? `No direct bid sample; model range includes ${competitionRead.manager}'s ${competitionRead.level.toLowerCase()} competing-claim read.`
      : "No direct league bid sample; model range uses player value, roster need, and available role signals.",
  };
}

function getWaiverDropRead({
  player,
  viewerIntel,
  openRosterSpots,
}: {
  player: TrendingPlayer;
  viewerIntel?: OwnerIntelRow | null;
  openRosterSpots: number;
}): Pick<
  WaiverRecommendation,
  "dropCandidate" | "dropReason" | "claimPriority"
> {
  if (openRosterSpots > 0) {
    return {
      dropCandidate: null,
      dropReason:
        "Active roster space is available, so no forced drop is needed.",
      claimPriority: "Add",
    };
  }

  const candidates = [...(viewerIntel?.droppablePlayers || [])]
    .filter(candidate => candidate.player_id !== player.player_id)
    .filter(candidate => candidate.playerDetails?.rosterStatus !== "Taxi")
    .sort((a, b) => {
      const samePositionA = a.pos === player.pos ? -120 : 0;
      const samePositionB = b.pos === player.pos ? -120 : 0;
      const aRank =
        parsePositionRankValue(a.seasonPositionRank || a.currentPositionRank) ||
        999;
      const bRank =
        parsePositionRankValue(b.seasonPositionRank || b.currentPositionRank) ||
        999;
      return (
        samePositionA - samePositionB ||
        (a.seasonValue || a.value || 0) - (b.seasonValue || b.value || 0) ||
        bRank - aRank
      );
    });
  const dropCandidate = candidates[0] || null;

  if (!dropCandidate) {
    return {
      dropCandidate: null,
      dropReason:
        "No clean drop candidate is returned, so keep this as a watchlist claim unless you manually create room.",
      claimPriority: "Watchlist",
    };
  }

  return {
    dropCandidate,
    dropReason: `${dropCandidate.name} is the lowest-friction cut from the returned droppable list${dropCandidate.pos === player.pos ? ` and clears the same ${player.pos} roster lane` : ""}.`,
    claimPriority: "Add/Drop",
  };
}

function buildWaiverRecommendationContext({
  data,
  leagueId,
  viewerManager,
  managerRosterIntelligence,
  managerPositionCounts,
  positionDepth,
  leagueDiagnostics,
  playerDetailsById,
  recentTransactions,
  storedWaiverBidHistory,
  leagueValueMode: leagueValueModeInput,
}: {
  data: NonNullable<ReportData["waiverIntelligence"]>;
  leagueId?: string;
  viewerManager?: string | null;
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
  managerPositionCounts?: ReportData["managerPositionCounts"];
  positionDepth?: ReportData["positionDepth"];
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  playerDetailsById?: PlayerDetailsById;
  recentTransactions?: ReportData["recentTransactions"];
  storedWaiverBidHistory?: StoredWaiverBidHistoryItem[];
  leagueValueMode?: ReportData["leagueValueMode"];
}): WaiverRecommendationContext {
  const normalizedViewer = normalizeReportManagerName(viewerManager);
  const viewerIntel = managerRosterIntelligence?.find(
    row => normalizeReportManagerName(row.manager) === normalizedViewer
  );
  const viewerPositionCounts =
    managerPositionCounts?.find(
      row => normalizeReportManagerName(row.manager) === normalizedViewer
    ) || null;
  if (!viewerIntel) {
    return {
      openRosterSpots: 0,
      irOnlyOpenSpots: 0,
      targetPositions: [],
      recommendations: [],
      summary: null,
    };
  }

  const { activeOpenSpots: openRosterSpots, irOnlyOpenSpots } =
    getWaiverRosterOpenings(
      viewerIntel,
      leagueDiagnostics,
      viewerPositionCounts
    );
  const needWeights = getWaiverNeedWeights(
    viewerIntel,
    positionDepth,
    viewerManager
  );
  const specialTeamsUpgrades = buildWaiverSpecialTeamsUpgradeReads({
    data,
    viewerPositionCounts,
    leagueDiagnostics,
    playerDetailsById,
  });
  Object.values(specialTeamsUpgrades).forEach(upgrade => {
    if (upgrade) needWeights[upgrade.position] += 920;
  });
  const leagueValueMode = normalizeLeagueValueMode(
    leagueValueModeInput || leagueDiagnostics?.valueMode
  );
  const isDynastyLeague = leagueValueMode === "dynasty";
  const targetPositions = WAIVER_POSITIONS.filter(
    position => needWeights[position] > 0
  ).sort((a, b) => needWeights[b] - needWeights[a]);
  const desiredRecommendationCount = Math.max(
    WAIVER_RECOMMENDATION_MINIMUM,
    openRosterSpots > 0 ? openRosterSpots + 1 : WAIVER_RECOMMENDATION_MINIMUM
  );
  const recommendationLimit = Math.min(
    WAIVER_RECOMMENDATION_LIMIT,
    desiredRecommendationCount
  );
  const recommendations = collectWaiverCandidates(data)
    .map(player => {
      const pos = isWaiverPosition(player.pos) ? player.pos : null;
      const details = getWaiverPlayerDetails(player, playerDetailsById);
      const dynastyValue = isDynastyLeague
        ? getWaiverDynastyValue(player, playerDetailsById)
        : 0;
      const seasonValue = getWaiverSeasonValue(player, playerDetailsById);
      const dynastyRankNumber = isDynastyLeague
        ? parsePositionRankValue(
            getWaiverDynastyRank(player, playerDetailsById)
          )
        : null;
      const seasonRankNumber = parsePositionRankValue(
        getWaiverSeasonRank(player, playerDetailsById)
      );
      const age = details?.age ?? null;
      const rookieYear = Number(details?.rookieYear || 0);
      const currentYear = new Date().getFullYear();
      const depthOrder = Number(details?.depthChartOrder || 0);
      const needWeight = pos ? needWeights[pos] : 0;
      const isSpecialTeams = pos === "K" || pos === "DEF";
      const specialTeamsUpgrade =
        pos === "K" || pos === "DEF" ? specialTeamsUpgrades[pos] : null;
      const isSpecialTeamsUpgrade =
        specialTeamsUpgrade?.playerId === player.player_id;
      const youthScore =
        age && age <= 22
          ? 560
          : age && age <= 25
            ? 320
            : age && age >= 29
              ? -260
              : 0;
      const dynastyRankScore = dynastyRankNumber
        ? Math.max(0, 760 - dynastyRankNumber * 5.4)
        : 0;
      const seasonRankScore = seasonRankNumber
        ? Math.max(0, 360 - seasonRankNumber * 3.1)
        : 0;
      const rolePathScore =
        depthOrder > 0 && depthOrder <= 2 ? 360 : depthOrder === 3 ? 190 : 0;
      const rookieScore = rookieYear === currentYear ? 260 : 0;
      const trendScore = Math.min(player.count || 0, 360);
      const dynastyValueScore = Math.min(dynastyValue / 3.8, 1400);
      const seasonValueScore = Math.min(seasonValue / 9, 520);
      const specialTeamsUpgradeScore = isSpecialTeamsUpgrade ? 2100 : 0;
      const specialTeamsDynastyPenalty =
        isDynastyLeague && isSpecialTeams && !isSpecialTeamsUpgrade ? -2400 : 0;
      const score =
        needWeight +
        dynastyValueScore +
        seasonValueScore +
        dynastyRankScore +
        seasonRankScore +
        youthScore +
        rookieScore +
        rolePathScore +
        trendScore +
        specialTeamsUpgradeScore +
        specialTeamsDynastyPenalty;
      const competitionRead = buildWaiverCompetitionRead({
        player,
        viewerManager,
        managerRosterIntelligence,
        managerPositionCounts,
        positionDepth,
        recentTransactions,
        storedWaiverBidHistory,
        leagueId,
      });
      const bidRead = buildWaiverBidRead({
        player,
        score,
        competitionRead,
        recentTransactions,
        storedWaiverBidHistory,
        leagueId,
        leagueValueMode,
      });
      const dropRead = getWaiverDropRead({
        player,
        viewerIntel,
        openRosterSpots,
      });

      return {
        player,
        score,
        label: getWaiverRecommendationLabel(
          player,
          playerDetailsById,
          leagueValueMode
        ),
        targetPosition: pos,
        competitionRead,
        ...bidRead,
        ...dropRead,
        reason: buildWaiverRecommendationReason({
          player,
          playerDetailsById,
          targetPosition: pos,
          needWeight,
          openRosterSpots,
          specialTeamsUpgradeReason: isSpecialTeamsUpgrade
            ? specialTeamsUpgrade?.reason
            : null,
          leagueValueMode,
        }),
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, recommendationLimit);

  const openSpotCopy =
    openRosterSpots > 0
      ? `${openRosterSpots} active roster opening${openRosterSpots === 1 ? "" : "s"} detected.`
      : "No active roster opening is detected, so treat these as priority watchlist or cut-upgrade targets.";
  const irSpotCopy =
    irOnlyOpenSpots > 0
      ? ` ${irOnlyOpenSpots} IR-only opening${irOnlyOpenSpots === 1 ? "" : "s"} also exists and is not counted for normal free-agent adds.`
      : "";
  const targetCopy = targetPositions.length
    ? `Priority lean: ${targetPositions.slice(0, 3).join(", ")} based on roster depth.`
    : isDynastyLeague
      ? "Priority lean: best available dynasty stash because no single position is screaming for depth."
      : "Priority lean: best available current opportunity because no single position is screaming for depth.";
  const featuredRecommendationCount = Math.min(
    WAIVER_RECOMMENDATION_MINIMUM,
    recommendations.length
  );
  const featuredRecommendationCopy = recommendations
    .slice(0, featuredRecommendationCount)
    .map(recommendation => {
      const bidCopy = recommendation.bidRangeLabel
        .toLowerCase()
        .startsWith("free")
        ? "likely free/near-free"
        : recommendation.bidRangeLabel;
      const competitionCopy = recommendation.competitionRead
        ? `${recommendation.competitionRead.manager} is the top competing-claim risk`
        : "no strong competing-claim risk returned";
      return `${recommendation.player.name}: ${recommendation.reason} (${bidCopy}; ${competitionCopy})`;
    })
    .join(" Next: ");
  const summary = recommendations.length
    ? `${openSpotCopy}${irSpotCopy} Signal read: ${featuredRecommendationCopy}. ${targetCopy}`
    : null;

  return {
    openRosterSpots,
    irOnlyOpenSpots,
    targetPositions,
    recommendations,
    summary,
  };
}

export default function WaiverIntelligencePanel({
  data,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  viewerManager,
  managerRosterIntelligence,
  managerPositionCounts,
  positionDepth,
  leagueDiagnostics,
  recentTransactions,
  leagueValueMode: leagueValueModeInput = "dynasty",
}: {
  data?: ReportData["waiverIntelligence"];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
  managerPositionCounts?: ReportData["managerPositionCounts"];
  positionDepth?: ReportData["positionDepth"];
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  recentTransactions?: ReportData["recentTransactions"];
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const {
    storedActionPlans,
    persistStoredActionPlan,
    isServerPersistenceEnabled,
  } = useStoredActionPlans({ leagueId });
  const { storedWaiverBidHistory, persistStoredWaiverBidHistory } =
    useStoredWaiverBidHistory({ leagueId });
  if (!data) return null;
  const leagueValueMode = normalizeLeagueValueMode(
    leagueValueModeInput || leagueDiagnostics?.valueMode
  );
  const isRedraft = leagueValueMode === "redraft";
  const recommendationContext = buildWaiverRecommendationContext({
    data,
    leagueId,
    viewerManager,
    managerRosterIntelligence,
    managerPositionCounts,
    positionDepth,
    leagueDiagnostics,
    playerDetailsById,
    recentTransactions,
    storedWaiverBidHistory,
    leagueValueMode,
  });
  React.useEffect(() => {
    storedActionPlans
      .filter(plan => plan.kind === "waiver")
      .filter(plan => !leagueId || !plan.leagueId || plan.leagueId === leagueId)
      .forEach(plan => {
        const outcomeStatus = getWaiverPlanOutcomeStatus(
          plan,
          recentTransactions
        );
        if (!outcomeStatus || outcomeStatus === plan.status) return;
        persistStoredActionPlan({
          ...plan,
          status: outcomeStatus,
          summary:
            outcomeStatus === "won"
              ? `${plan.summary} Outcome: your roster added this player.`
              : `${plan.summary} Outcome: another manager added this player first.`,
          payload: {
            ...plan.payload,
            outcomeStatus,
            outcomeCheckedAt: Date.now(),
          },
        });
      });
  }, [
    leagueId,
    persistStoredActionPlan,
    recentTransactions,
    storedActionPlans,
  ]);
  const recommendationByPlayerId = new Map(
    recommendationContext.recommendations.map(recommendation => [
      recommendation.player.player_id,
      recommendation,
    ])
  );
  const recommendationOrderByPlayerId = new Map(
    recommendationContext.recommendations.map((recommendation, index) => [
      recommendation.player.player_id,
      index,
    ])
  );
  const baseCards = [
    { label: "Highest Available", player: data.highestKtcAvailable },
    ...Object.entries(data.bestAvailableByPosition).map(([pos, player]) => ({
      label: `Best ${pos}`,
      player,
    })),
    ...(isRedraft
      ? []
      : data.bestTaxiStashes.slice(0, 2).map((player, index) => ({
          label: `Taxi Stash ${index + 1}`,
          player,
        }))),
  ].filter((card): card is { label: string; player: TrendingPlayer } =>
    Boolean(card.player)
  );
  const basePlayerIds = new Set(baseCards.map(card => card.player.player_id));
  const suggestedCards = recommendationContext.recommendations
    .filter(
      recommendation => !basePlayerIds.has(recommendation.player.player_id)
    )
    .map(recommendation => ({
      label: recommendation.label,
      player: recommendation.player,
    }));
  const cards = [...suggestedCards, ...baseCards].sort((a, b) => {
    const aRecommendationOrder = recommendationOrderByPlayerId.get(
      a.player.player_id
    );
    const bRecommendationOrder = recommendationOrderByPlayerId.get(
      b.player.player_id
    );
    const aIsSuggested = typeof aRecommendationOrder === "number";
    const bIsSuggested = typeof bRecommendationOrder === "number";
    if (aIsSuggested && bIsSuggested)
      return aRecommendationOrder - bRecommendationOrder;
    if (aIsSuggested) return -1;
    if (bIsSuggested) return 1;
    return 0;
  });
  const waiverActionPlans = storedActionPlans
    .filter(plan => plan.kind === "waiver")
    .filter(plan => !leagueId || !plan.leagueId || plan.leagueId === leagueId)
    .filter(
      plan =>
        !viewerManager ||
        normalizeManagerKey(plan.manager) === normalizeManagerKey(viewerManager)
    )
    .slice(0, 5);

  return (
    <div className="waiver-intel-panel">
      {recommendationContext.summary && (
        <div className="waiver-intel-recommendation-banner">
          <span>{AI_RECOMMENDATION_BANNER_LABEL}</span>
          <p>{recommendationContext.summary}</p>
        </div>
      )}
      <ActionPlanHistoryPanel
        plans={waiverActionPlans}
        leagueId={leagueId}
        isServerPersistenceEnabled={isServerPersistenceEnabled}
        title="Waiver Plan History"
      />
      <div
        className="player-tile-grid waiver-intel-grid balanced-tile-grid"
        style={getBalancedGridStyle(cards.length)}
      >
        {cards.map(({ label, player }) => {
          const recommendation = recommendationByPlayerId.get(player.player_id);
          const details = getWaiverPlayerDetails(player, playerDetailsById);
          const rank = isRedraft
            ? getWaiverSeasonRank(player, playerDetailsById) ||
              getWaiverPlayerRank(player, playerDetailsById)
            : getWaiverPlayerRank(player, playerDetailsById);
          const dynastyRank = getWaiverDynastyRank(player, playerDetailsById);
          const seasonRank = getWaiverSeasonRank(player, playerDetailsById);
          const value = isRedraft
            ? getWaiverSeasonValue(player, playerDetailsById) ||
              getWaiverPlayerValue(player, playerDetailsById)
            : getWaiverPlayerValue(player, playerDetailsById);
          const waiverPlanId = recommendation
            ? getWaiverActionPlanId(leagueId, viewerManager, recommendation)
            : null;
          const submittedPlan = waiverPlanId
            ? storedActionPlans.some(
                plan => plan.id === waiverPlanId && plan.kind === "waiver"
              )
            : false;
          const waiverPlanCopy = recommendation
            ? getWaiverActionPlanCopy(viewerManager, recommendation)
            : "";
          return (
            <article
              key={`${label}-${player.player_id}`}
              className={`player-team-tile waiver-intel-card ${recommendation ? getAiNeuralSurfaceClass("trade", "waiver-intel-card-suggested") : ""}`}
              style={getTeamTileStyle(details?.team || player.team)}
            >
              <button
                type="button"
                className="waiver-intel-card-open"
                onClick={() =>
                  setSelectedPlayer(
                    buildPlayerModalData({
                      playerId: player.player_id,
                      playerName: player.name,
                      playerPos: player.pos,
                      value,
                      playerDetails: details,
                      playerDetailsById,
                      currentPositionRank: rank,
                      manager: player.owner || null,
                      managerAvatarUrl: player.owner
                        ? managerAvatars?.[player.owner]
                        : null,
                      valueMode: leagueValueMode,
                    })
                  )
                }
              >
                <div className="waiver-intel-top">
                  <span className="waiver-intel-label">{label}</span>
                  <span
                    className={
                      recommendation
                        ? "waiver-intel-suggestion-label ai-recommendation-badge"
                        : "available-manager-label"
                    }
                  >
                    {recommendation
                      ? AI_RECOMMENDATION_BADGE_LABEL
                      : "Available"}
                  </span>
                </div>
                <PlayerIdentityRow
                  className="waiver-intel-main"
                  playerId={player.player_id}
                  playerName={player.name}
                  team={details?.team || player.team}
                  position={player.pos}
                  hideMeta
                />
                <div
                  className="waiver-intel-pills"
                  aria-label={`${player.name} waiver profile`}
                >
                  <div className="waiver-intel-pill-row waiver-intel-pill-row-primary">
                    <TeamLogoPill team={details?.team || player.team} />
                    {!isRedraft && dynastyRank && (
                      <WaiverRankPill
                        label="Dynasty"
                        rank={dynastyRank}
                        className="waiver-intel-rank-pill-dynasty"
                      />
                    )}
                    {seasonRank && (
                      <WaiverRankPill
                        label="Season"
                        rank={seasonRank}
                        className="waiver-intel-rank-pill-season"
                      />
                    )}
                    {!dynastyRank && !seasonRank && (
                      <PositionRankPill rank={rank || player.pos || "-"} />
                    )}
                  </div>
                  <div className="waiver-intel-pill-row waiver-intel-pill-row-secondary">
                    {!isRedraft && label.startsWith("Taxi Stash") && (
                      <span>Rookie Stash</span>
                    )}
                    {recommendation &&
                      recommendationContext.openRosterSpots > 0 && (
                        <span>Active Spot Fit</span>
                      )}
                    {value > 0 && (
                      <span className="waiver-intel-value-pill">
                        {formatCompactValue(value)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              {recommendation && (
                <div
                  className="waiver-intel-claim-plan"
                  title={recommendation.dropReason || recommendation.reason}
                >
                  <span>
                    <em>
                      {recommendation.bidSource === "league-history"
                        ? "League bid range"
                        : recommendation.bidSource === "free-history"
                          ? "Free-add history"
                          : "Model bid range"}
                    </em>
                    <strong>{recommendation.bidRangeLabel}</strong>
                  </span>
                  <span>
                    <em>{recommendation.claimPriority}</em>
                    <strong>
                      {recommendation.dropCandidate
                        ? `Drop ${recommendation.dropCandidate.name}`
                        : recommendation.claimPriority === "Add"
                          ? "No drop needed"
                          : "Manual room needed"}
                    </strong>
                  </span>
                  <span
                    className={`waiver-intel-threat waiver-intel-threat-${recommendation.competitionRead?.level.toLowerCase() || "low"}`}
                    title={
                      recommendation.competitionRead?.reason ||
                      "No strong competing manager signal returned."
                    }
                  >
                    <em>
                      {recommendation.competitionRead
                        ? `${recommendation.competitionRead.level} threat`
                        : "Claim threat"}
                    </em>
                    <strong>
                      {recommendation.competitionRead
                        ? `${recommendation.competitionRead.manager}: ${recommendation.competitionRead.bidHint}`
                        : "Likely quiet"}
                    </strong>
                  </span>
                  <p className="waiver-intel-history-read">
                    {recommendation.bidEvidenceLabel}{" "}
                    {recommendation.competitionRead?.reason ||
                      "No strong competing manager signal returned."}
                  </p>
                  <button
                    type="button"
                    className="waiver-intel-submit-plan"
                    aria-pressed={submittedPlan}
                    onClick={() => {
                      persistStoredActionPlan(
                        createWaiverActionPlan({
                          leagueId,
                          manager: viewerManager,
                          recommendation,
                          status: "submitted",
                        })
                      );
                      const bidHistoryItem = createWaiverBidHistoryItem({
                        leagueId,
                        manager: viewerManager,
                        recommendation,
                      });
                      if (bidHistoryItem)
                        persistStoredWaiverBidHistory(bidHistoryItem);
                    }}
                  >
                    {submittedPlan ? "Plan submitted" : "Submit plan"}
                    <span>{recommendation.bidConfidencePct}%</span>
                  </button>
                  <div className="waiver-intel-plan-actions">
                    <button
                      type="button"
                      className="waiver-intel-secondary-action"
                      onClick={() => {
                        copyTextToClipboard(waiverPlanCopy);
                        persistStoredActionPlan(
                          createWaiverActionPlan({
                            leagueId,
                            manager: viewerManager,
                            recommendation,
                            status: "copied",
                          })
                        );
                      }}
                    >
                      <Copy aria-hidden="true" />
                      Copy plan
                    </button>
                    <button
                      type="button"
                      className="waiver-intel-secondary-action"
                      disabled={!leagueId}
                      onClick={() => {
                        persistStoredActionPlan(
                          createWaiverActionPlan({
                            leagueId,
                            manager: viewerManager,
                            recommendation,
                            status: "opened",
                          })
                        );
                        openSleeperLeague(leagueId);
                      }}
                    >
                      <ExternalLink aria-hidden="true" />
                      Open Sleeper
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={playerDetailsById}
      />
    </div>
  );
}
