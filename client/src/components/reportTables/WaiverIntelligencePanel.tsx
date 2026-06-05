import { useState, type CSSProperties } from "react";
import type {
  ManagerIntelPlayer,
  PlayerDetails,
  RecentTransactionPlayer,
  ReportData,
  TrendingPlayer,
  WaiverSourceTraceEntry,
  WaiverWeeklyEcrSignal,
  WaiverWeeklyEcrTarget,
  WaiverWeeklyEcrWeek,
} from "@shared/types";
import { getShortTermMatchupOutlook } from "@shared/matchupWindows";
import {
  evaluateAIEvidence,
  getAIEvidenceLeagueContextFromDiagnostics,
  getAIEvidenceReceiptItems,
  type AIEvidenceLeagueActivityContext,
  type AIEvidenceMode,
  type AIEvidenceResult,
  type AISourceTrace,
} from "@shared/aiEvidenceEngine";
import { buildAIEvidenceLeagueActivityContext } from "@shared/leagueActivityContext";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { TeamLogoPill } from "../TeamLogoPill";
import { PlayerIdentityRow } from "../reportPrimitives";
import {
  getPlayerRankForMode,
  normalizeLeagueValueMode,
  type LeagueValueMode,
} from "@/lib/leagueValueMode";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import { getBalancedGridStyle } from "@/lib/balancedGrid";
import { getVoicedAIActionLabel } from "@/lib/aiVoice";
import { buildPlayerActionArchetypeRead } from "@/lib/playerActionArchetype";
import {
  buildPlayerModalData,
  clampPercentValue,
  FIRST_FULL_BLEND_WEEK_LABEL,
  formatCompactValue,
  getAiNeuralSurfaceClass,
  normalizeManagerKey,
  parsePositionRankValue,
  PositionRankPill,
  VALUE_BLEND_HISTORY_START_LABEL,
  WaiverRankPill,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./shared";
import { WeeklyProjectionReceipt } from "../WeeklyProjectionReceipt";

type OwnerIntelRow = NonNullable<ReportData["managerRosterIntelligence"]>[number];
type CountPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
const COUNT_POSITIONS: CountPosition[] = ["QB", "RB", "WR", "TE", "K", "DEF"];
const AI_RECOMMENDATION_BANNER_LABEL = "AI PICKUP RECEIPTS";

type WaiverPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

type WaiverRecommendation = {
  player: TrendingPlayer;
  score: number;
  reason: string;
  evidenceRead: AIEvidenceResult;
  label: string;
  targetPosition: WaiverPosition | null;
  bidRangeLabel: string;
  bidConfidencePct: number;
  bidSource: "league-history" | "free-history" | "model" | "priority";
  bidEvidenceLabel: string;
  competitionRead: WaiverCompetitionRead | null;
  dropCandidate: ManagerIntelPlayer | null;
  dropAlternatives: ManagerIntelPlayer[];
  dropReason: string | null;
  dropValueDelta: number | null;
  dropConfidencePct: number;
  claimPriority: "Add" | "Add/Drop" | "Watchlist";
  weeklyEcrSignal: WaiverWeeklyEcrSignal | null;
  archetypeLabel?: string | null;
  archetypeNote?: string | null;
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
  defensePairingPlan: WaiverDefensePairingPlan | null;
  summary: string | null;
};

const WAIVER_POSITIONS: WaiverPosition[] = ["QB", "RB", "WR", "TE", "K", "DEF"];
const WAIVER_SPECIAL_TEAMS_POSITIONS = ["K", "DEF"] as const;
const WAIVER_RECOMMENDATION_LIMIT = 2;
const WAIVER_RECOMMENDATION_MINIMUM = 1;

export function buildWaiverValueCards({
  data,
  isRedraft,
  prioritizeDefense,
  omittedCandidateIds,
}: {
  data: NonNullable<ReportData["waiverIntelligence"]>;
  isRedraft: boolean;
  prioritizeDefense: boolean;
  omittedCandidateIds: Set<string>;
}): Array<{ label: string; player: TrendingPlayer }> {
  const baseCards = [
    { label: "Highest Available", player: data.highestKtcAvailable },
    ...Object.entries(data.bestAvailableByPosition)
      .filter(([pos]) => !(prioritizeDefense && pos === "DEF"))
      .map(([pos, player]) => ({
        label: `Best ${pos}`,
        player,
      })),
    ...(isRedraft
      ? []
      : data.bestTaxiStashes.slice(0, 2).map((player, index) => ({
          label: `Taxi Stash ${index + 1}`,
          player,
        }))),
  ].filter((card): card is { label: string; player: TrendingPlayer } => {
    const playerId = card.player?.player_id;
    if (!playerId) return false;
    return !omittedCandidateIds.has(playerId);
  });

  if (!prioritizeDefense) return baseCards;

  const defenseCard = data.bestAvailableByPosition.DEF;
  if (!defenseCard || omittedCandidateIds.has(defenseCard.player_id)) {
    return baseCards;
  }

  const reordered = [
    { label: "Best DEF", player: defenseCard },
    ...baseCards.filter(card => card.player.player_id !== defenseCard.player_id),
  ];

  return reordered;
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
type WaiverDefensePlayer = Pick<TrendingPlayer, "player_id" | "name" | "pos"> & {
  team?: string | null;
  owner?: string | null;
};
type WaiverDefenseRosterCandidate = {
  player: WaiverDefensePlayer;
  signal: WaiverWeeklyEcrSignal;
  source: "rostered" | "available";
};
type WaiverDefensePairingPlan = {
  title: string;
  summary: string;
  action: "pair" | "replace" | "add-two";
  confidencePct: number;
  keep: WaiverDefenseRosterCandidate[];
  add: WaiverDefenseRosterCandidate[];
  drop: WaiverDefenseRosterCandidate[];
  currentScore: number | null;
  proposedScore: number;
  evidence: string[];
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

const WAIVER_WEEKLY_ECR_RANK_LIMITS: Record<WaiverPosition, number> = {
  QB: 40,
  RB: 90,
  WR: 105,
  TE: 24,
  K: 20,
  DEF: 20,
};
const DRAFTSHARKS_SCHEDULE_SOURCE = "DraftSharks";
const DRAFTSHARKS_SOS_SIGNAL_TYPE = "draftsharks-sos";
const UNUSABLE_FANTASYPROS_STATUS_PATTERN =
  /stale|missing|empty|gated|blocked|forbidden|unauthorized|disabled|unavailable|error|fail|rate|limited|research/i;

function getWaiverWeeklyEcrSignal(
  player: TrendingPlayer,
  data?: NonNullable<ReportData["waiverIntelligence"]>
): WaiverWeeklyEcrSignal | null {
  if (player.weeklyEcr) return player.weeklyEcr;
  return (
    data?.weeklyEcrTargets?.find(
      target => target.player.player_id === player.player_id
    )?.signal || null
  );
}

function isWaiverScheduleWindowSignal(
  signal?: WaiverWeeklyEcrSignal | null
): signal is WaiverWeeklyEcrSignal {
  return Boolean(
    signal &&
      signal.source === DRAFTSHARKS_SCHEDULE_SOURCE &&
      signal.signalType === DRAFTSHARKS_SOS_SIGNAL_TYPE
  );
}

function isFantasyProsRankSignal(
  signal?: WaiverWeeklyEcrSignal | null
): signal is WaiverWeeklyEcrSignal {
  return Boolean(signal && signal.source === "FantasyPros" && !isWaiverScheduleWindowSignal(signal));
}

function isUsableFantasyProsSignalStatus(
  status?: string | null,
  rowCount?: number | null
): boolean {
  if (rowCount === 0) return false;
  const normalized = String(status || "").trim();
  if (!normalized) return false;
  return !UNUSABLE_FANTASYPROS_STATUS_PATTERN.test(normalized);
}

function hasUsableFantasyProsRankSignal(signal?: WaiverWeeklyEcrSignal | null): boolean {
  if (!isFantasyProsRankSignal(signal)) return false;
  const hasRank = Boolean(getWaiverWeeklyEcrBestRank(signal));
  if (!hasRank) return false;
  const usableWeek = getUsableWaiverWeeklyEcrWeeks(signal).length > 0;
  const usableTrace = getUsableWaiverWeeklyEcrSourceTrace(signal).length > 0;
  return usableWeek || usableTrace;
}

function shouldUseWaiverWeeklyEcrSignal(signal?: WaiverWeeklyEcrSignal | null): boolean {
  return isWaiverScheduleWindowSignal(signal) || hasUsableFantasyProsRankSignal(signal);
}

function getUsableWaiverWeeklyEcrWeeks(signal?: WaiverWeeklyEcrSignal | null): WaiverWeeklyEcrSignal["weeks"] {
  const weeks = signal?.weeks || [];
  if (!signal || !weeks.length) return [];
  if (isWaiverScheduleWindowSignal(signal)) return weeks;
  if (!isFantasyProsRankSignal(signal)) return [];
  return weeks.filter(
    (week: WaiverWeeklyEcrWeek) =>
      Boolean(week.positionRank || week.rankEcr) &&
      isUsableFantasyProsSignalStatus(week.sourceStatus, week.sourceRowCount)
  );
}

function getUsableWaiverWeeklyEcrSourceTrace(signal?: WaiverWeeklyEcrSignal | null): WaiverSourceTraceEntry[] {
  const sourceTrace = signal?.sourceTrace || [];
  if (!signal || !sourceTrace.length) return [];
  if (isWaiverScheduleWindowSignal(signal)) return sourceTrace;
  if (!isFantasyProsRankSignal(signal)) return [];
  return sourceTrace.filter((trace: WaiverSourceTraceEntry) =>
    isUsableFantasyProsSignalStatus(trace.status, trace.rowCount)
  );
}

function normalizeWaiverDefenseLookup(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getWaiverWeeklyEcrSignalForPlayer(
  player: Pick<TrendingPlayer, "player_id" | "name" | "pos"> & {
    team?: string | null;
  },
  data?: NonNullable<ReportData["waiverIntelligence"]>,
  scheduleEdgeTargets: WaiverWeeklyEcrTarget[] = []
): WaiverWeeklyEcrSignal | null {
  const direct = getWaiverWeeklyEcrSignal(player as TrendingPlayer, data);
  if (direct) return direct;

  const position = player.pos === "DST" ? "DEF" : player.pos;
  const teamKey = normalizeWaiverDefenseLookup(player.team);
  const nameKey = normalizeWaiverDefenseLookup(player.name);
  const targets = [
    ...(data?.weeklyEcrTargets || []),
    ...(data?.specialTeamsStreamerTargets || []),
    ...(data?.defensePairingTargets || []),
    ...scheduleEdgeTargets,
  ];

  return (
    targets.find(target => target.player.player_id === player.player_id)
      ?.signal ||
    targets.find(target => {
      const targetPosition =
        target.signal.position === "DST" ? "DEF" : target.signal.position;
      return (
        targetPosition === position &&
        teamKey &&
        normalizeWaiverDefenseLookup(target.signal.team || target.player.team) ===
          teamKey
      );
    })?.signal ||
    targets.find(target => {
      const targetPosition =
        target.signal.position === "DST" ? "DEF" : target.signal.position;
      return (
        targetPosition === position &&
        nameKey &&
        normalizeWaiverDefenseLookup(target.signal.name || target.player.name) ===
          nameKey
      );
    })?.signal ||
    null
  );
}

function getWaiverMatchupStarValue(week: WaiverWeeklyEcrWeek): number | null {
  if (
    typeof week.matchupStars === "number" &&
    Number.isFinite(week.matchupStars)
  ) {
    return Math.max(1, Math.min(5, week.matchupStars));
  }
  if (
    typeof week.opponentRank === "number" &&
    Number.isFinite(week.opponentRank)
  ) {
    const rank = Math.max(1, Math.min(32, week.opponentRank));
    return 1 + ((32 - rank) / 31) * 4;
  }
  return null;
}

function getWaiverDefenseWeekLabel(week: WaiverWeeklyEcrWeek): string {
  if (week.isBye) return `W${week.week} bye`;
  const site =
    week.homeAway === "home"
      ? "vs"
      : week.homeAway === "away"
        ? "at"
        : "";
  const opponent = week.opponent
    ? `${site} ${week.opponent}`.trim()
    : "opponent TBD";
  const stars =
    typeof week.matchupStars === "number"
      ? `${week.matchupStars}-star`
      : "unrated";
  return `W${week.week} ${opponent} ${stars}`;
}

function getWaiverWeeklyEcrBestRank(
  signal?: WaiverWeeklyEcrSignal | null
): string | null {
  if (!signal) return null;
  if (signal.bestPositionRank) return signal.bestPositionRank;
  const position = isWaiverPosition(signal.position) ? signal.position : null;
  return position && signal.bestRankEcr
    ? `${position}${Math.round(signal.bestRankEcr)}`
    : null;
}

function getWaiverWeeklyEcrRankNumber(
  signal?: WaiverWeeklyEcrSignal | null
): number | null {
  return parsePositionRankValue(getWaiverWeeklyEcrBestRank(signal));
}

function formatWaiverWeeklyEcrWindow(
  signal?: WaiverWeeklyEcrSignal | null
): string | null {
  const displayWeeks = getUsableWaiverWeeklyEcrWeeks(signal);
  if (!displayWeeks.length) return null;
  const windowWeeks = signal?.matchupWindows?.next3?.weeks || null;
  const rows = windowWeeks?.length
    ? displayWeeks.filter(week => windowWeeks.includes(week.week))
    : displayWeeks.slice(0, 3);

  const formattedRows = rows
    .map(week => {
      if (week.isBye) return `W${week.week} BYE`;
      if (week.opponent || week.matchupStars || week.opponentRank) {
        const site =
          week.homeAway === "home"
            ? "vs"
            : week.homeAway === "away"
              ? "@"
              : "";
        const opponent = week.opponent
          ? `${site} ${week.opponent}`.trim()
          : "opponent TBD";
        const stars =
          typeof week.matchupStars === "number"
            ? `${week.matchupStars}*`
            : null;
        const rank =
          typeof week.opponentRank === "number" ? `#${week.opponentRank}` : null;
        return `W${week.week} ${[opponent, stars, rank].filter(Boolean).join(" ")}`;
      }
      return `W${week.week} ${week.positionRank || (week.rankEcr ? `Rank ${week.rankEcr}` : "ranked")}`;
    });

  return formattedRows.length ? `Next 3: ${formattedRows.join(" / ")}` : null;
}

function formatWaiverWeeklyEcrReason(
  signal?: WaiverWeeklyEcrSignal | null
): string | null {
  if (!signal || !shouldUseWaiverWeeklyEcrSignal(signal)) return null;
  const bestRank = getWaiverWeeklyEcrBestRank(signal);
  const window = formatWaiverWeeklyEcrWindow(signal);
  const playoffSummary = signal.matchupWindows?.playoffs?.playableWeeks
    ? signal.matchupWindows.playoffs.summary
    : null;
  const movement =
    signal.rankDelta && signal.rankDelta !== 0
      ? signal.rankDelta > 0
        ? `improved ${signal.rankDelta} spots`
        : `slipped ${Math.abs(signal.rankDelta)} spots`
      : null;
  const label = isWaiverScheduleWindowSignal(signal)
    ? "Next-3 schedule window"
    : "Next-3 weekly rank window";
  return [bestRank ? `${label}: ${bestRank}` : null, window, playoffSummary, movement]
    .filter(Boolean)
    .join(" • ") || null;
}

function getWaiverWeeklyEcrRecommendationScore(
  signal: WaiverWeeklyEcrSignal | null,
  position: WaiverPosition | null,
  leagueValueMode: LeagueValueMode = "dynasty"
): number {
  if (!signal || !position || !shouldUseWaiverWeeklyEcrSignal(signal)) return 0;
  const rankLimit = WAIVER_WEEKLY_ECR_RANK_LIMITS[position];
  const bestRank = getWaiverWeeklyEcrRankNumber(signal) || signal.bestRankEcr || null;
  if ((!bestRank || bestRank > rankLimit) && !isWaiverScheduleWindowSignal(signal)) return 0;
  const rankScore = bestRank ? Math.max(0, 860 - (bestRank / rankLimit) * 520) : 0;
  if (isNonDynastyWaiverPosition(position) && isWaiverScheduleWindowSignal(signal)) {
    const outlook = getShortTermMatchupOutlook(signal.matchupWindows);
    const next3 = signal.matchupWindows?.next3;
    const easyWeeks = next3?.easyWeeks ?? 0;
    const hardWeeks = next3?.hardWeeks ?? 0;
    const shortTermScore =
      outlook.score * 6 +
      easyWeeks * 90 -
      hardWeeks * 140 -
      (outlook.isRoughStart ? 420 : 0);
    const rankWeight = outlook.isRoughStart ? 0.2 : leagueValueMode === "redraft" ? 0.42 : 0.28;
    return Math.max(
      0,
      Math.round(rankScore * rankWeight + shortTermScore + Math.min(signal.confidence || 0, 100))
    );
  }
  const trendScore = signal.rankDelta
    ? Math.max(-120, Math.min(180, signal.rankDelta * 14))
    : 0;
  const confidenceScore = Math.min(signal.confidence || 0, 100) * 2.4;
  return Math.round(rankScore + trendScore + confidenceScore);
}

function hasRoughSpecialTeamsMatchupStart(
  signal?: WaiverWeeklyEcrSignal | null
): boolean {
  return Boolean(
    isWaiverScheduleWindowSignal(signal) &&
      getShortTermMatchupOutlook(signal.matchupWindows).isRoughStart
  );
}

function collectWaiverCandidates(
  data: NonNullable<ReportData["waiverIntelligence"]>
): TrendingPlayer[] {
  const byId = new Map<string, TrendingPlayer>();
  const omittedCandidateIds = new Set(
    (data.omittedCandidates || [])
      .filter(candidate => candidate.action === "omit")
      .map(candidate => candidate.player_id)
  );
  const addPlayer = (player: TrendingPlayer | null | undefined) => {
    if (!player?.player_id || player.owner || !isWaiverPosition(player.pos))
      return;
    if (omittedCandidateIds.has(player.player_id)) return;
    if (!byId.has(player.player_id)) byId.set(player.player_id, player);
  };

  addPlayer(data.highestKtcAvailable);
  Object.values(data.bestAvailableByPosition).forEach(addPlayer);
  data.bestTaxiStashes.forEach(addPlayer);
  data.availableTrendingAdds.forEach(addPlayer);
  data.recentlyDroppedValuable.forEach(addPlayer);
  data.weeklyEcrTargets?.forEach(target => addPlayer(target.player));

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

function getWaiverDefenseCoverageRead(
  defenses: WaiverDefenseRosterCandidate[],
  preferredWeeks?: number[]
): {
  score: number;
  easyWeeks: number;
  hardWeeks: number;
  labels: string[];
} | null {
  const weekNumbers =
    preferredWeeks?.length
      ? Array.from(new Set(preferredWeeks)).sort((a, b) => a - b)
      : Array.from(
          new Set(
            defenses.flatMap(defense =>
              defense.signal.matchupWindows?.next6?.weeks?.length
                ? defense.signal.matchupWindows.next6.weeks
                : defense.signal.weeks.slice(0, 6).map(week => week.week)
            )
          )
        ).sort((a, b) => a - b);
  if (!weekNumbers.length) return null;

  let easyWeeks = 0;
  let hardWeeks = 0;
  const labels: string[] = [];
  const weeklyScores = weekNumbers
    .map(weekNumber => {
      const options = defenses
        .map(defense => ({
          defense,
          week: defense.signal.weeks.find(week => week.week === weekNumber),
        }))
        .filter(
          (entry): entry is {
            defense: WaiverDefenseRosterCandidate;
            week: WaiverWeeklyEcrWeek;
          } => Boolean(entry.week && !entry.week.isBye)
        )
        .map(entry => ({
          ...entry,
          stars: getWaiverMatchupStarValue(entry.week),
        }))
        .filter(
          (entry): entry is {
            defense: WaiverDefenseRosterCandidate;
            week: WaiverWeeklyEcrWeek;
            stars: number;
          } => entry.stars !== null
        )
        .sort((a, b) => b.stars - a.stars);
      const best = options[0] || null;
      if (!best) return null;
      if (best.stars >= 4) easyWeeks += 1;
      if (best.stars <= 2) hardWeeks += 1;
      labels.push(`${best.defense.player.name}: ${getWaiverDefenseWeekLabel(best.week)}`);
      return ((best.stars - 1) / 4) * 100;
    })
    .filter((value): value is number => value !== null);

  if (!weeklyScores.length) return null;
  return {
    score: Math.round(
      weeklyScores.reduce((sum, value) => sum + value, 0) / weeklyScores.length
    ),
    easyWeeks,
    hardWeeks,
    labels,
  };
}

function buildWaiverDefenseCandidates({
  data,
  viewerPositionCounts,
  scheduleEdgeTargets,
}: {
  data: NonNullable<ReportData["waiverIntelligence"]>;
  viewerPositionCounts: ReportData["managerPositionCounts"][number] | null;
  scheduleEdgeTargets?: WaiverWeeklyEcrTarget[];
}): {
  rostered: WaiverDefenseRosterCandidate[];
  available: WaiverDefenseRosterCandidate[];
} {
  const rostered = getWaiverManagerPositionPlayers(viewerPositionCounts, "DEF")
    .map((player): WaiverDefenseRosterCandidate | null => {
      const signal = getWaiverWeeklyEcrSignalForPlayer(
        player,
        data,
        scheduleEdgeTargets
      );
      return signal ? { player, signal, source: "rostered" as const } : null;
    })
    .filter(
      (candidate): candidate is WaiverDefenseRosterCandidate =>
        Boolean(candidate)
    );
  const availableById = new Map<string, WaiverDefenseRosterCandidate>();
  const addAvailable = (player?: TrendingPlayer | null) => {
    if (!player || player.owner || player.pos !== "DEF") return;
    if (availableById.has(player.player_id)) return;
    const signal = getWaiverWeeklyEcrSignalForPlayer(
      player,
      data,
      scheduleEdgeTargets
    );
    if (!signal) return;
    availableById.set(player.player_id, {
      player,
      signal,
      source: "available",
    });
  };

  data.defensePairingTargets?.forEach(target => addAvailable(target.player));
  data.specialTeamsStreamerTargets?.forEach(target => addAvailable(target.player));
  data.weeklyEcrTargets?.forEach(target => addAvailable(target.player));
  addAvailable(data.bestAvailableByPosition.DEF);
  data.availableTrendingAdds.forEach(addAvailable);
  data.recentlyDroppedValuable.forEach(addAvailable);

  return {
    rostered,
    available: Array.from(availableById.values()).sort((a, b) => {
      const aScore = getWaiverDefenseCoverageRead([a])?.score ?? 0;
      const bScore = getWaiverDefenseCoverageRead([b])?.score ?? 0;
      return bScore - aScore;
    }),
  };
}

export function buildWaiverDefensePairingPlan({
  data,
  viewerPositionCounts,
  leagueDiagnostics,
  scheduleEdgeTargets,
}: {
  data: NonNullable<ReportData["waiverIntelligence"]>;
  viewerPositionCounts: ReportData["managerPositionCounts"][number] | null;
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  scheduleEdgeTargets?: WaiverWeeklyEcrTarget[];
}): WaiverDefensePairingPlan | null {
  if (!waiverLeagueUsesPosition(leagueDiagnostics, "DEF")) return null;
  const { rostered, available } = buildWaiverDefenseCandidates({
    data,
    viewerPositionCounts,
    scheduleEdgeTargets,
  });
  if (!available.length) return null;

  const preferredWeeks =
    rostered[0]?.signal.matchupWindows?.next6?.weeks ||
    available[0]?.signal.matchupWindows?.next6?.weeks ||
    undefined;
  const currentRead = rostered.length
    ? getWaiverDefenseCoverageRead(rostered.slice(0, 2), preferredWeeks)
    : null;
  const ownedPairOptions = rostered.flatMap(rosteredDefense =>
    available.map(availableDefense => ({
      keep: [rosteredDefense],
      add: [availableDefense],
      read: getWaiverDefenseCoverageRead(
        [rosteredDefense, availableDefense],
        preferredWeeks
      ),
    }))
  );
  const availablePairOptions = available.flatMap((first, index) =>
    available.slice(index + 1).map(second => ({
      keep: [],
      add: [first, second],
      read: getWaiverDefenseCoverageRead([first, second], preferredWeeks),
    }))
  );
  const bestOwnedPair = ownedPairOptions
    .filter(option => option.read)
    .sort((a, b) => (b.read?.score || 0) - (a.read?.score || 0))[0];
  const bestAvailablePair = availablePairOptions
    .filter(option => option.read)
    .sort((a, b) => (b.read?.score || 0) - (a.read?.score || 0))[0];
  const currentScore = currentRead?.score ?? null;
  const shouldReplace =
    bestAvailablePair?.read &&
    (!bestOwnedPair?.read ||
      !rostered.length ||
      (currentScore !== null && bestAvailablePair.read.score >= currentScore + 18) ||
      (bestOwnedPair.read.score && bestAvailablePair.read.score >= bestOwnedPair.read.score + 12));
  const chosen = shouldReplace ? bestAvailablePair : bestOwnedPair || bestAvailablePair;
  if (!chosen?.read) return null;

  const action: WaiverDefensePairingPlan["action"] =
    rostered.length && shouldReplace ? "replace" : rostered.length ? "pair" : "add-two";
  const drop =
    action === "replace"
      ? rostered.slice(0, Math.min(rostered.length, chosen.add.length || 1))
      : [];
  const proposedNames = [
    ...chosen.keep.map(item => item.player.name),
    ...chosen.add.map(item => item.player.name),
  ];
  const dropNames = drop.map(item => item.player.name);
  const title =
    action === "replace"
      ? `Replace your D/ST room with ${proposedNames.join(" + ")}`
      : action === "pair"
        ? `Pair ${chosen.keep[0].player.name} with ${chosen.add[0].player.name}`
        : `Add ${proposedNames.join(" + ")} as a D/ST stream pair`;
  const comparison =
    currentScore === null
      ? null
      : `current room ${currentScore}/100, proposed ${chosen.read.score}/100`;
  const dropCopy = dropNames.length ? ` Drop ${dropNames.join(" and ")}.` : "";

  return {
    title,
    summary: `${chosen.read.easyWeeks} easy week${chosen.read.easyWeeks === 1 ? "" : "s"} and ${chosen.read.hardWeeks} hard week${chosen.read.hardWeeks === 1 ? "" : "s"} across the next matchup window${comparison ? ` (${comparison})` : ""}.${dropCopy}`,
    action,
    confidencePct: clampPercentValue(
      58 +
        chosen.read.score / 3 +
        Math.max(0, (chosen.read.score - (currentScore || 45)) / 2)
    ),
    keep: chosen.keep,
    add: chosen.add,
    drop,
    currentScore,
    proposedScore: chosen.read.score,
    evidence: chosen.read.labels.slice(0, 6),
  };
}

function buildWaiverSpecialTeamsUpgradeReads({
  data,
  viewerPositionCounts,
  leagueDiagnostics,
  playerDetailsById,
  scheduleEdgeTargets,
}: {
  data: NonNullable<ReportData["waiverIntelligence"]>;
  viewerPositionCounts: ReportData["managerPositionCounts"][number] | null;
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  playerDetailsById?: PlayerDetailsById;
  scheduleEdgeTargets?: WaiverWeeklyEcrTarget[];
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
    if (
      hasRoughSpecialTeamsMatchupStart(
        getWaiverWeeklyEcrSignalForPlayer(
          available,
          data,
          scheduleEdgeTargets || []
        )
      )
    )
      return;

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
  weeklyEcrSignal,
  leagueValueMode = "dynasty",
}: {
  player: TrendingPlayer;
  playerDetailsById?: PlayerDetailsById;
  targetPosition: WaiverPosition | null;
  needWeight: number;
  openRosterSpots: number;
  specialTeamsUpgradeReason?: string | null;
  weeklyEcrSignal?: WaiverWeeklyEcrSignal | null;
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
  const weeklyEcrCopy = formatWaiverWeeklyEcrReason(weeklyEcrSignal);
  const spotCopy =
    openRosterSpots > 0
      ? openRosterSpots === 1
        ? "fits the active roster opening"
        : `fits one of ${openRosterSpots} active roster openings`
      : "is a priority watchlist add if you create a spot";

  return [positionCopy, weeklyEcrCopy, ageCopy, rankCopy, roleCopy, spotCopy]
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

type WaiverBidSample = {
  bid: number;
  pos: string | null;
  manager?: string | null;
  date?: string | null;
  season?: string | null;
  source: "sleeper-transaction";
};

function getCurrentSeasonNumber(currentSeason?: string | null): number {
  const parsed = Number(currentSeason);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : new Date().getFullYear();
}

function getBidSampleSeason(sample: WaiverBidSample): number | null {
  const explicitSeason = Number(sample.season);
  if (Number.isFinite(explicitSeason) && explicitSeason > 0) {
    return explicitSeason;
  }

  const date = sample.date ? new Date(sample.date) : null;
  return date && Number.isFinite(date.getTime()) ? date.getFullYear() : null;
}

function getBidSampleRepeatCount(
  sample: WaiverBidSample,
  currentSeason?: string | null
): number {
  const season = getBidSampleSeason(sample);
  const current = getCurrentSeasonNumber(currentSeason);
  if (season === current) return 3;
  if (season === current - 1) return 2;
  return 1;
}

function expandBidSamplesByRecency(
  samples: WaiverBidSample[],
  currentSeason?: string | null
): number[] {
  return samples.flatMap(sample =>
    Array.from(
      { length: getBidSampleRepeatCount(sample, currentSeason) },
      () => sample.bid
    )
  );
}

function buildTransactionBidSamples(
  recentTransactions?: ReportData["recentTransactions"]
): WaiverBidSample[] {
  return (recentTransactions || [])
    .filter(
      transaction =>
        transaction.type === "Waiver" &&
        Number(transaction.bidAmount || 0) > 0 &&
        transaction.addedPlayer
    )
    .map(transaction => ({
      bid: Number(transaction.bidAmount || 0),
      pos: transaction.addedPlayer?.pos || null,
      manager: transaction.manager || null,
      date: transaction.date || null,
      season: transaction.season || null,
      source: "sleeper-transaction" as const,
    }));
}

function describeBidSampleMix(
  samples: WaiverBidSample[],
  label: string,
  currentSeason?: string | null
): string {
  const current = getCurrentSeasonNumber(currentSeason);
  const currentCount = samples.filter(
    sample => getBidSampleSeason(sample) === current
  ).length;
  const lastSeasonCount = samples.filter(
    sample => getBidSampleSeason(sample) === current - 1
  ).length;
  const olderCount = samples.length - currentCount - lastSeasonCount;
  const parts = [
    currentCount ? `${currentCount} current-season` : null,
    lastSeasonCount ? `${lastSeasonCount} last-season` : null,
    olderCount ? `${olderCount} older` : null,
  ].filter(Boolean);

  return `${samples.length} ${label} sample${samples.length === 1 ? "" : "s"}${parts.length ? ` (${parts.join(", ")})` : ""}`;
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
  position,
  currentSeason,
  recentTransactions,
}: {
  manager?: string | null;
  position?: string | null;
  currentSeason?: string | null;
  recentTransactions?: ReportData["recentTransactions"];
}) {
  const managerKey = normalizeManagerKey(manager);
  const samples = buildTransactionBidSamples(recentTransactions)
    .filter(sample => normalizeManagerKey(sample.manager) === managerKey);
  const positionSamples = samples.filter(sample => sample.pos === position);
  return {
    positionSamples: expandBidSamplesByRecency(positionSamples, currentSeason),
    allSamples: expandBidSamplesByRecency(samples, currentSeason),
    preferredSamples:
      positionSamples.length >= 2
        ? expandBidSamplesByRecency(positionSamples, currentSeason)
        : expandBidSamplesByRecency(samples, currentSeason),
  };
}

function buildWaiverCompetitionRead({
  player,
  viewerManager,
  managerRosterIntelligence,
  managerPositionCounts,
  positionDepth,
  recentTransactions,
  currentSeason,
}: {
  player: TrendingPlayer;
  viewerManager?: string | null;
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
  managerPositionCounts?: ReportData["managerPositionCounts"];
  positionDepth?: ReportData["positionDepth"];
  recentTransactions?: ReportData["recentTransactions"];
  currentSeason?: string | null;
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
        position: playerPosition,
        currentSeason,
        recentTransactions,
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
  leagueValueMode,
  currentSeason,
  leagueDiagnostics,
}: {
  player: TrendingPlayer;
  score: number;
  competitionRead?: WaiverCompetitionRead | null;
  recentTransactions?: ReportData["recentTransactions"];
  leagueValueMode: LeagueValueMode;
  currentSeason?: string | null;
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
}): Pick<
  WaiverRecommendation,
  "bidRangeLabel" | "bidConfidencePct" | "bidSource" | "bidEvidenceLabel"
> {
  if (leagueDiagnostics?.waiverMode === "priority") {
    const pressureBoost =
      competitionRead?.level === "High" ? 8 : competitionRead?.level === "Medium" ? 4 : 0;
    const bidRangeLabel =
      score >= 2600 || competitionRead?.level === "High"
        ? "Burn priority"
        : score >= 1700 || competitionRead?.level === "Medium"
          ? "Use priority"
          : score >= 1100
            ? "Wait for waivers"
            : "Free add only";
    const pressureLabel = competitionRead
      ? `${competitionRead.manager}'s ${competitionRead.level.toLowerCase()} claim pressure`
      : "no strong competing-claim pressure";

    return {
      bidRangeLabel,
      bidConfidencePct: clampPercentValue(
        56 + Math.min(24, score / 170) + pressureBoost
      ),
      bidSource: "priority",
      bidEvidenceLabel: `${leagueDiagnostics.waiverModeLabel || "Waiver priority"} detected; ${pressureLabel} included.`,
    };
  }

  const waiverBidSamples = buildTransactionBidSamples(recentTransactions);
  const positionBidSamples = waiverBidSamples.filter(sample => sample.pos === player.pos);
  const selectedBidSamples = positionBidSamples.length >= 2
    ? positionBidSamples
    : waiverBidSamples;
  const historicalBids = expandBidSamplesByRecency(selectedBidSamples, currentSeason);
  const historicalBidLabel =
    positionBidSamples.length >= 2
      ? describeBidSampleMix(selectedBidSamples, `${player.pos} bid`, currentSeason)
      : describeBidSampleMix(selectedBidSamples, "league bid", currentSeason);
  const scoreAdjustment =
    score >= 3000 ? 4 : score >= 2200 ? 3 : score >= 1500 ? 2 : 0;
  const competitionAdjustment =
    competitionRead?.level === "High"
      ? 3
      : competitionRead?.level === "Medium"
        ? 1
        : 0;

  if (selectedBidSamples.length && historicalBids.length) {
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
          Math.min(22, selectedBidSamples.length * 3) +
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
  addValue,
  leagueValueMode,
}: {
  player: TrendingPlayer;
  viewerIntel?: OwnerIntelRow | null;
  openRosterSpots: number;
  addValue: number;
  leagueValueMode: "dynasty" | "redraft";
}): Pick<
  WaiverRecommendation,
  | "dropCandidate"
  | "dropAlternatives"
  | "dropReason"
  | "dropValueDelta"
  | "dropConfidencePct"
  | "claimPriority"
> {
  if (openRosterSpots > 0) {
    return {
      dropCandidate: null,
      dropAlternatives: [],
      dropReason:
        "Active roster space is available, so no forced drop is needed.",
      dropValueDelta: null,
      dropConfidencePct: 88,
      claimPriority: "Add",
    };
  }

  const getDropValue = (candidate: ManagerIntelPlayer) =>
    Math.round(
      leagueValueMode === "redraft"
        ? candidate.seasonValue || candidate.value || 0
        : candidate.value || candidate.seasonValue || 0
    );
  const candidates = [...(viewerIntel?.droppablePlayers || [])]
    .filter(candidate => candidate.player_id !== player.player_id)
    .filter(candidate => candidate.playerDetails?.rosterStatus !== "Taxi")
    .map(candidate => {
      const samePositionBonus = candidate.pos === player.pos ? 120 : 0;
      const value = getDropValue(candidate);
      const rank =
        parsePositionRankValue(
          candidate.seasonPositionRank || candidate.currentPositionRank
        ) || 999;
      const upgrade = Math.round(addValue - value);
      const score =
        samePositionBonus +
        Math.max(0, upgrade / 9) +
        Math.max(0, rank - 55) * 1.4 -
        value / 110;
      return { candidate, value, rank, upgrade, score };
    })
    .sort((a, b) => {
      const aRank =
        parsePositionRankValue(
          a.candidate.seasonPositionRank || a.candidate.currentPositionRank
        ) || 999;
      const bRank =
        parsePositionRankValue(
          b.candidate.seasonPositionRank || b.candidate.currentPositionRank
        ) || 999;
      return (
        b.score - a.score ||
        a.value - b.value ||
        bRank - aRank
      );
    });
  const best = candidates[0] || null;
  const dropCandidate = best?.candidate || null;

  if (!dropCandidate) {
    return {
      dropCandidate: null,
      dropAlternatives: [],
      dropReason:
        "No clean drop candidate is returned, so keep this as a watchlist claim unless you manually create room.",
      dropValueDelta: null,
      dropConfidencePct: 42,
      claimPriority: "Watchlist",
    };
  }

  const dropAlternatives = candidates
    .slice(1, 3)
    .map(candidate => candidate.candidate);
  const samePositionCopy =
    dropCandidate.pos === player.pos
      ? ` and clears the same ${player.pos} roster lane`
      : "";
  const upgradeCopy =
    best.upgrade > 0
      ? ` The model sees about ${formatCompactValue(best.upgrade)} more ${leagueValueMode === "redraft" ? "season" : "dynasty"} value coming in than going out.`
      : best.upgrade < -150
        ? ` This is not a clean value-upgrade cut, so only use it if the roster role matters more than stored value.`
        : " The value exchange is close, so roster construction is the deciding factor.";
  return {
    dropCandidate,
    dropAlternatives,
    dropReason: `${dropCandidate.name} is the lowest-friction cut from the returned droppable list${samePositionCopy}.${upgradeCopy}`,
    dropValueDelta: best.upgrade,
    dropConfidencePct: clampPercentValue(
      54 +
        (dropCandidate.pos === player.pos ? 10 : 0) +
        Math.min(18, Math.max(-6, best.upgrade / 180)) +
        Math.min(10, dropAlternatives.length * 3)
    ),
    claimPriority: "Add/Drop",
  };
}

function getWaiverEvidenceSourceCount(
  details?: PlayerDetails | null,
  weeklyEcrSignal?: WaiverWeeklyEcrSignal | null
): number {
  const valueSources = details?.valueProfile?.sources || [];
  const uniqueSources = new Set(valueSources.filter(Boolean));
  if (weeklyEcrSignal && shouldUseWaiverWeeklyEcrSignal(weeklyEcrSignal)) {
    uniqueSources.add(
      weeklyEcrSignal.source === DRAFTSHARKS_SCHEDULE_SOURCE
        ? "Schedule snapshot"
        : "Weekly rank snapshot"
    );
  }
  return uniqueSources.size;
}

function getLatestWaiverAvailabilityBlocker(
  player: TrendingPlayer,
  recentTransactions?: ReportData["recentTransactions"]
): string | null {
  const playerId = player.player_id;
  if (!playerId || !recentTransactions?.length) return null;
  const sorted = [...recentTransactions].sort((a, b) => {
    const aDate = Date.parse(a.date);
    const bDate = Date.parse(b.date);
    return (Number.isFinite(aDate) ? aDate : 0) - (Number.isFinite(bDate) ? bDate : 0);
  });
  let latestAction: { type: "added" | "dropped"; manager: string | null } | null = null;
  for (const transaction of sorted) {
    if (transaction.addedPlayer?.player_id === playerId) {
      latestAction = {
        type: "added",
        manager: transaction.manager || null,
      };
    }
    if (transaction.droppedPlayer?.player_id === playerId) {
      latestAction = {
        type: "dropped",
        manager: transaction.manager || null,
      };
    }
  }
  if (!latestAction) return null;
  return latestAction.type === "added"
    ? latestAction.manager || "another manager"
    : null;
}

function normalizeAiSourceTraceStatus(
  status?: string | null
): AISourceTrace["status"] {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "loaded") return "loaded";
  if (normalized === "stale") return "stale";
  if (normalized === "missing") return "missing";
  if (normalized === "error") return "error";
  if (normalized) return "limited";
  return undefined;
}

function getWaiverEvidenceSourceTrace({
  details,
  weeklyEcrSignal,
  bidEvidenceLabel,
}: {
  details?: PlayerDetails | null;
  weeklyEcrSignal?: WaiverWeeklyEcrSignal | null;
  bidEvidenceLabel?: string | null;
}): Array<string | AISourceTrace> {
  const traces: Array<string | AISourceTrace> = [];
  const valueSources = details?.valueProfile?.sources || [];
  if (valueSources.length) {
    traces.push(`${valueSources.length} blended value input${valueSources.length === 1 ? "" : "s"} loaded.`);
  }
  if (bidEvidenceLabel) traces.push(`Bid model: ${bidEvidenceLabel}`);
  const canShowWeeklySignal = shouldUseWaiverWeeklyEcrSignal(weeklyEcrSignal);
  if (weeklyEcrSignal?.traceSummary && canShowWeeklySignal) {
    const traceLabel =
      isWaiverScheduleWindowSignal(weeklyEcrSignal)
        ? "Schedule context trace"
        : "Weekly rank context trace";
    traces.push({
      label: traceLabel,
      status: "loaded",
      detail: weeklyEcrSignal.traceSummary,
    });
  }
  if (!canShowWeeklySignal) return traces;
  getUsableWaiverWeeklyEcrSourceTrace(weeklyEcrSignal).slice(0, 3).forEach(trace => {
    const traceLabel = isWaiverScheduleWindowSignal(weeklyEcrSignal)
      ? "Schedule snapshot"
      : "Weekly rank snapshot";
    traces.push({
      label: trace.week ? `${traceLabel} W${trace.week}` : traceLabel,
      status: normalizeAiSourceTraceStatus(trace.status),
      detail: [
        trace.rowCount ? `${trace.rowCount} rows` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  });
  return traces;
}

function buildWaiverEvidenceRead({
  player,
  details,
  score,
  targetPosition,
  needWeight,
  openRosterSpots,
  dynastyValue,
  seasonValue,
  dynastyRank,
  seasonRank,
  weeklyEcrSignal,
  competitionRead,
  bidEvidenceLabel,
  dropCandidate,
  dropReason,
  recentTransactions,
  leagueDiagnostics,
  leagueActivity,
  leagueValueMode,
  calibrationProfile,
  calibrationManager,
  calibrationLeagueId,
}: {
  player: TrendingPlayer;
  details?: PlayerDetails | null;
  score: number;
  targetPosition: WaiverPosition | null;
  needWeight: number;
  openRosterSpots: number;
  dynastyValue: number;
  seasonValue: number;
  dynastyRank?: string | null;
  seasonRank?: string | null;
  weeklyEcrSignal?: WaiverWeeklyEcrSignal | null;
  competitionRead?: WaiverCompetitionRead | null;
  bidEvidenceLabel?: string | null;
  dropCandidate?: ManagerIntelPlayer | null;
  dropReason?: string | null;
  recentTransactions?: ReportData["recentTransactions"];
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  leagueActivity?: AIEvidenceLeagueActivityContext | null;
  leagueValueMode: LeagueValueMode;
  calibrationProfile?: ReportData["aiCalibrationAdjustmentProfile"];
  calibrationManager?: string | null;
  calibrationLeagueId?: string | null;
}): AIEvidenceResult {
  const isRedraft = leagueValueMode === "redraft";
  const position = isWaiverPosition(player.pos) ? player.pos : targetPosition;
  const value = isRedraft ? seasonValue || dynastyValue : dynastyValue || seasonValue;
  const rank = isRedraft ? seasonRank || dynastyRank : dynastyRank || seasonRank;
  const sourceCount = getWaiverEvidenceSourceCount(details, weeklyEcrSignal);
  const weeklyRead = formatWaiverWeeklyEcrReason(weeklyEcrSignal);
  const hasUsableWeeklyEcrSignal = shouldUseWaiverWeeklyEcrSignal(weeklyEcrSignal);
  const weeklyProjection = player.weeklyProjection || details?.weeklyProjection || null;
  const hasRecentUsage = Boolean(weeklyProjection || details?.usageTrend);
  const hasRoleContext = Boolean(details?.playerCohort || details?.playerSituationDelta);
  const matchupOutlook =
    isWaiverScheduleWindowSignal(weeklyEcrSignal)
      ? getShortTermMatchupOutlook(weeklyEcrSignal.matchupWindows)
      : null;
  const recentlyAddedBy = getLatestWaiverAvailabilityBlocker(
    player,
    recentTransactions
  );
  const hasCurrentSeasonValue = seasonValue > 0 || hasUsableWeeklyEcrSignal;
  const hasDynastyValue = dynastyValue > 0;
  const hasProspectOnlyValue = Boolean(
    details?.prospectProfile &&
      !hasCurrentSeasonValue &&
      !hasDynastyValue
  );
  const signalModes: AIEvidenceMode[] = [
    isRedraft && hasCurrentSeasonValue ? "redraft" : null,
    hasCurrentSeasonValue ? "current" : null,
    !isRedraft && hasDynastyValue ? "dynasty" : null,
    isWaiverScheduleWindowSignal(weeklyEcrSignal) ? "schedule" : null,
    player.count ? "market" : null,
    details?.prospectProfile ? "prospect" : null,
  ].filter((item): item is AIEvidenceMode => Boolean(item));

  return evaluateAIEvidence({
    surface: "waiver",
    action: position === "K" || position === "DEF" ? "stream" : "pickup",
    leagueValueMode,
    leagueContext: getAIEvidenceLeagueContextFromDiagnostics(
      leagueDiagnostics,
      leagueValueMode
    ),
    leagueActivity,
    baseScore: Math.min(100, score / 38),
    evidence: [
      needWeight > 0 && position
        ? `${position} matches the roster need profile.`
        : null,
      rank ? `${rank} rank is attached to this recommendation.` : null,
      value > 0 ? `${formatCompactValue(value)} ${isRedraft ? "season" : "market"} value is attached.` : null,
      player.count ? `${formatCompactValue(player.count)} trend signal from add/drop activity.` : null,
      weeklyRead,
      competitionRead?.reason,
      dropCandidate
        ? `${dropCandidate.name} is the suggested drop path.`
        : openRosterSpots > 0
          ? "Active roster space is available."
          : null,
      dropReason,
    ].filter((item): item is string => Boolean(item)),
    missingEvidence: [
      rank ? null : "No trusted positional rank is attached.",
      sourceCount ? null : "No blend evidence count is attached.",
      position === "K" || position === "DEF"
        ? isWaiverScheduleWindowSignal(weeklyEcrSignal)
          ? null
          : "No short-window schedule source is attached."
        : null,
    ].filter((item): item is string => Boolean(item)),
    sourceTrace: getWaiverEvidenceSourceTrace({
      details,
      weeklyEcrSignal,
      bidEvidenceLabel,
    }),
    signalModes,
    player: {
      name: player.name,
      position: position || player.pos,
      team: details?.team || player.team,
      owner: player.owner,
      rosterStatus: details?.rosterStatus || details?.displayStatus || null,
      injuryStatus: details?.injuryStatus || null,
      nflStatus: details?.status || null,
      weeklyProjectionStatus: weeklyProjection?.status || null,
      hasByeWeek: weeklyProjection?.homeAway === "bye" || weeklyProjection?.status === "bye",
      recentlyAddedBy,
      value,
      sourceCount,
      hasCurrentSeasonValue,
      hasDynastyValue,
      hasProspectOnlyValue,
      hasRecentUsage,
      hasRoleContext,
    },
    schedule: {
      hasScheduleData: isWaiverScheduleWindowSignal(weeklyEcrSignal),
      isRoughStart: Boolean(matchupOutlook?.isRoughStart),
      isStrongStart: Boolean(matchupOutlook?.isStrongStart),
      missingReason: "No stored matchup window is attached to this streamer read.",
    },
    confidenceCap: 94,
    confidenceCapReason: null,
    calibrationProfile,
    calibrationManager,
    calibrationLeagueId,
  });
}

export function buildWaiverRecommendationContext({
  data,
  leagueId,
  viewerManager,
  managerRosterIntelligence,
  managerPositionCounts,
  positionDepth,
  leagueDiagnostics,
  playerDetailsById,
  recentTransactions,
  leagueValueMode: leagueValueModeInput,
  scheduleEdgeTargets,
  calibrationProfile,
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
  leagueValueMode?: ReportData["leagueValueMode"];
  scheduleEdgeTargets?: ReportData["scheduleEdgeTargets"];
  calibrationProfile?: ReportData["aiCalibrationAdjustmentProfile"];
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
      defensePairingPlan: null,
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
    scheduleEdgeTargets,
  });
  const defensePairingPlan = buildWaiverDefensePairingPlan({
    data,
    viewerPositionCounts,
    leagueDiagnostics,
    scheduleEdgeTargets,
  });
  Object.values(specialTeamsUpgrades).forEach(upgrade => {
    if (upgrade) needWeights[upgrade.position] += 920;
  });
  if (defensePairingPlan?.add.length) {
    needWeights.DEF += defensePairingPlan.action === "replace" ? 1300 : 980;
  }
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
      const weeklyEcrSignal = getWaiverWeeklyEcrSignalForPlayer(
        player,
        data,
        scheduleEdgeTargets || []
      );
      const details = getWaiverPlayerDetails(player, playerDetailsById);
      const dynastyValue = isDynastyLeague
        ? getWaiverDynastyValue(player, playerDetailsById)
        : 0;
      const seasonValue = getWaiverSeasonValue(player, playerDetailsById);
      const dynastyRank = isDynastyLeague
        ? getWaiverDynastyRank(player, playerDetailsById)
        : null;
      const seasonRank = getWaiverSeasonRank(player, playerDetailsById);
      const dynastyRankNumber = isDynastyLeague
        ? parsePositionRankValue(dynastyRank)
        : null;
      const seasonRankNumber = parsePositionRankValue(seasonRank);
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
      const defensePairingAdd =
        pos === "DEF"
          ? defensePairingPlan?.add.find(
              candidate => candidate.player.player_id === player.player_id
            )
          : null;
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
      const defensePairingScore = defensePairingAdd
        ? defensePairingPlan?.action === "replace"
          ? 2300
          : 1650
        : 0;
      const specialTeamsDynastyPenalty =
        isDynastyLeague &&
        isSpecialTeams &&
        !isSpecialTeamsUpgrade &&
        !defensePairingAdd
          ? -2400
          : 0;
      const weeklyEcrScore = getWaiverWeeklyEcrRecommendationScore(
        weeklyEcrSignal,
        pos,
        leagueValueMode
      );
      const matchupOutlook =
        isWaiverScheduleWindowSignal(weeklyEcrSignal)
          ? getShortTermMatchupOutlook(weeklyEcrSignal.matchupWindows)
          : null;
      const matchupGuardScore = matchupOutlook?.isRoughStart
        ? isSpecialTeams
          ? -2600
          : -360
        : matchupOutlook?.isStrongStart
          ? isSpecialTeams
            ? 420
            : 180
          : 0;
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
        weeklyEcrScore +
        matchupGuardScore +
        specialTeamsUpgradeScore +
        defensePairingScore +
        specialTeamsDynastyPenalty;
      const competitionRead = buildWaiverCompetitionRead({
        player,
        viewerManager,
        managerRosterIntelligence,
        managerPositionCounts,
        positionDepth,
        recentTransactions,
        currentSeason: leagueDiagnostics?.currentSeason,
      });
      const bidRead = buildWaiverBidRead({
        player,
        score,
        competitionRead,
        recentTransactions,
        leagueValueMode,
        currentSeason: leagueDiagnostics?.currentSeason,
        leagueDiagnostics,
      });
      const dropRead = getWaiverDropRead({
        player,
        viewerIntel,
        openRosterSpots,
        addValue: Math.round(
          isDynastyLeague ? dynastyValue || seasonValue : seasonValue || dynastyValue
        ),
        leagueValueMode,
      });
      const reason = buildWaiverRecommendationReason({
        player,
        playerDetailsById,
        targetPosition: pos,
        needWeight,
        openRosterSpots,
        specialTeamsUpgradeReason: isSpecialTeamsUpgrade
          ? specialTeamsUpgrade?.reason
          : defensePairingAdd && defensePairingPlan
            ? defensePairingPlan.title
            : null,
        weeklyEcrSignal,
        leagueValueMode,
      });
      const evidenceRead = buildWaiverEvidenceRead({
        player,
        details,
        score,
        targetPosition: pos,
        needWeight,
        openRosterSpots,
        dynastyValue,
        seasonValue,
        dynastyRank,
        seasonRank,
        weeklyEcrSignal,
        competitionRead,
        bidEvidenceLabel: bidRead.bidEvidenceLabel,
        dropCandidate: dropRead.dropCandidate,
        dropReason: dropRead.dropReason,
        recentTransactions,
        leagueDiagnostics,
        leagueActivity: buildAIEvidenceLeagueActivityContext({
          leagueDiagnostics,
          recentTransactions,
          waiverIntelligence: data,
        }),
        leagueValueMode,
        calibrationProfile,
        calibrationManager: viewerManager,
        calibrationLeagueId: leagueId,
      });
      const archetypeRead = buildPlayerActionArchetypeRead({
        playerName: player.name,
        position: player.pos,
        details,
      });

      return {
        player,
        score,
        evidenceRead,
        label: getWaiverRecommendationLabel(
          player,
          playerDetailsById,
          leagueValueMode
        ),
        targetPosition: pos,
        competitionRead,
        ...bidRead,
        ...dropRead,
        weeklyEcrSignal,
        reason,
        archetypeLabel: archetypeRead?.label || null,
        archetypeNote: archetypeRead?.note || null,
      };
    })
    .filter(item => item.score > 0 && item.evidenceRead.shouldRender && item.evidenceRead.label !== "thin")
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
      const decisionLabel = recommendation.evidenceRead.canAct
        ? "Review this"
        : getVoicedAIActionLabel("Don't force it", "watch");
      return `${recommendation.player.name}: ${decisionLabel} - ${recommendation.reason} (${recommendation.evidenceRead.label}; ${bidCopy}; ${competitionCopy})`;
    })
    .join(" Next: ");
  const summary = recommendations.length
    ? `${openSpotCopy}${irSpotCopy} Pickup receipts: ${featuredRecommendationCopy}. ${targetCopy}`
    : null;

  return {
    openRosterSpots,
    irOnlyOpenSpots,
    targetPositions,
    recommendations,
    defensePairingPlan,
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
  scheduleEdgeTargets,
  calibrationProfile,
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
  scheduleEdgeTargets?: ReportData["scheduleEdgeTargets"];
  calibrationProfile?: ReportData["aiCalibrationAdjustmentProfile"];
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
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
    leagueValueMode,
    scheduleEdgeTargets,
    calibrationProfile,
  });
  const aiTargetCards = recommendationContext.recommendations;
  const omittedCandidateIds = new Set(
    (data.omittedCandidates || [])
      .filter(candidate => candidate.action === "omit")
      .map(candidate => candidate.player_id)
  );
  const cards = buildWaiverValueCards({
    data,
    isRedraft,
    prioritizeDefense: Boolean(recommendationContext.defensePairingPlan?.add.length),
    omittedCandidateIds,
  });
  return (
    <div className="waiver-intel-panel">
      {recommendationContext.summary && (
        <div className="waiver-intel-recommendation-banner">
          <span>{AI_RECOMMENDATION_BANNER_LABEL}</span>
          <p>{recommendationContext.summary}</p>
        </div>
      )}
      {recommendationContext.defensePairingPlan && (
        <div className="waiver-defense-pairing-read">
          <div className="waiver-defense-pairing-head">
            <span>D/ST pairing read</span>
            <strong>{recommendationContext.defensePairingPlan.title}</strong>
            <em>
              {recommendationContext.defensePairingPlan.confidencePct}% confidence
            </em>
          </div>
          <p>{recommendationContext.defensePairingPlan.summary}</p>
          <div className="waiver-defense-pairing-lanes">
            {recommendationContext.defensePairingPlan.keep.length > 0 && (
              <span>
                <em>Keep</em>
                <strong>
                  {recommendationContext.defensePairingPlan.keep
                    .map(item => item.player.name)
                    .join(" + ")}
                </strong>
              </span>
            )}
            {recommendationContext.defensePairingPlan.add.length > 0 && (
              <span>
                <em>Add</em>
                <strong>
                  {recommendationContext.defensePairingPlan.add
                    .map(item => item.player.name)
                    .join(" + ")}
                </strong>
              </span>
            )}
            {recommendationContext.defensePairingPlan.drop.length > 0 && (
              <span className="waiver-defense-pairing-drop">
                <em>Drop</em>
                <strong>
                  {recommendationContext.defensePairingPlan.drop
                    .map(item => item.player.name)
                    .join(" + ")}
                </strong>
              </span>
            )}
          </div>
          <div className="waiver-defense-pairing-evidence">
            {recommendationContext.defensePairingPlan.evidence.map(item => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      )}
      {data.omittedCandidates?.length ? (
        <details className="waiver-intel-source-review">
          <summary>
            <span>Admin source review</span>
            <strong>{data.omittedCandidates.length} waiver ideas omitted</strong>
          </summary>
          <div className="waiver-intel-source-review-list">
            {data.omittedCandidates.slice(0, 8).map(candidate => (
              <div
                key={candidate.player_id}
                className="waiver-intel-source-review-row"
              >
                <span>
                  {candidate.name} · {candidate.pos}
                  {candidate.team ? ` · ${candidate.team}` : ""}
                </span>
                <em>
                  {candidate.rank || "No rank"} · {candidate.sourceCount} source
                  {candidate.sourceCount === 1 ? "" : "s"}
                </em>
                <p>{candidate.reason}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {aiTargetCards.length > 0 && (
        <div className="waiver-ai-target-strip">
          <div className="waiver-ai-target-strip-head">
            <span>Waiver Decision</span>
            <strong>
              {aiTargetCards.length} {isRedraft ? "redraft" : "dynasty"} read
              {aiTargetCards.length === 1 ? "" : "s"}
            </strong>
          </div>
          <div className="waiver-ai-target-row">
            {aiTargetCards.map(recommendation => {
              const player = recommendation.player;
              const details = getWaiverPlayerDetails(player, playerDetailsById);
              const rank = isRedraft
                ? getWaiverSeasonRank(player, playerDetailsById) ||
                  getWaiverPlayerRank(player, playerDetailsById)
                : getWaiverPlayerRank(player, playerDetailsById);
              const value = isRedraft
                ? getWaiverSeasonValue(player, playerDetailsById) ||
                  getWaiverPlayerValue(player, playerDetailsById)
                : getWaiverPlayerValue(player, playerDetailsById);
              const weeklyEcrSignal = recommendation.weeklyEcrSignal;
              const weeklyEcrRank = getWaiverWeeklyEcrBestRank(weeklyEcrSignal);
              const weeklyEcrWindow = formatWaiverWeeklyEcrWindow(weeklyEcrSignal);
              const weeklyProjection = player.weeklyProjection || details?.weeklyProjection || null;
              const receiptItems = getAIEvidenceReceiptItems(
                recommendation.evidenceRead
              );
              const openPlayerDetail = () =>
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
                );

              return (
                <article
                  key={`ai-target-${player.player_id}`}
                  className={`waiver-ai-target-card ${getAiNeuralSurfaceClass("trade", "waiver-intel-card-suggested")}`}
                  style={getTeamTileStyle(details?.team || player.team)}
                >
                  <button
                    type="button"
                    className="waiver-ai-target-player"
                    data-testid={weeklyProjection?.status === "ready" ? "projection-player-detail-trigger" : undefined}
                    onClick={openPlayerDetail}
                  >
                    <span className="waiver-intel-label">{recommendation.label}</span>
                    <PlayerIdentityRow
                      className="waiver-ai-target-main"
                      playerId={player.player_id}
                      playerName={player.name}
                      team={details?.team || player.team}
                      position={player.pos}
                      hideMeta
                    />
                  </button>
                  <div className="waiver-ai-target-read">
                    <div className="waiver-ai-target-verdict">
                      <span className={`waiver-ai-evidence-label waiver-ai-evidence-label-${recommendation.evidenceRead.label.replace(/\s+/g, "-")}`}>
                        {recommendation.evidenceRead.label}
                      </span>
                      <strong>
                        {recommendation.evidenceRead.canAct
                          ? "Review this"
                          : "Don't add yet"}
                      </strong>
                    </div>
                    <p>{recommendation.reason}</p>
                    <div className="waiver-ai-target-facts">
                      <span>
                        <em>
                          {recommendation.bidSource === "priority"
                            ? "Waiver priority"
                            : "League bid range"}
                        </em>
                        <strong>{recommendation.bidRangeLabel}</strong>
                        <small>{recommendation.bidEvidenceLabel}</small>
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
                      {recommendation.archetypeLabel && (
                        <span>
                          <em>Archetype</em>
                          <strong>{recommendation.archetypeLabel}</strong>
                          <small>{recommendation.archetypeNote}</small>
                        </span>
                      )}
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
                        <small>
                          {recommendation.competitionRead?.reason ||
                            "No strong competing-claim signal returned."}
                        </small>
                      </span>
                      {weeklyEcrSignal && (
                        <span>
                          <em>Matchups</em>
                          <strong>
                            {weeklyEcrWindow || weeklyEcrRank || "Rolling rank"}
                          </strong>
                        </span>
                      )}
                      <WeeklyProjectionReceipt
                        weeklyProjection={weeklyProjection}
                        variant="fact"
                        playerName={player.name}
                        onOpenPlayerDetail={openPlayerDetail}
                      />
                    </div>
                    {receiptItems.length > 0 && (
                      <details className="waiver-ai-evidence-receipts">
                        <summary>Receipts</summary>
                        <ul>
                          {receiptItems.slice(0, 6).map(item => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
      <div
        className="player-tile-grid waiver-intel-grid balanced-tile-grid"
        style={{
          ...getBalancedGridStyle(cards.length),
          "--dd-balanced-grid-item-width-xs": "min(100%, 20rem)",
        } as CSSProperties}
      >
        {cards.map(({ label, player }) => {
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
          const weeklyEcrSignal = getWaiverWeeklyEcrSignalForPlayer(
            player,
            data,
            scheduleEdgeTargets || []
          );
          const weeklyEcrRank = getWaiverWeeklyEcrBestRank(weeklyEcrSignal);
          const weeklyEcrWindow = formatWaiverWeeklyEcrWindow(weeklyEcrSignal);
          const weeklyProjection = player.weeklyProjection || details?.weeklyProjection || null;
          const openPlayerDetail = () =>
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
            );
          return (
            <article
              key={`${label}-${player.player_id}`}
              className="player-team-tile waiver-intel-card"
              style={getTeamTileStyle(details?.team || player.team)}
            >
              <button
                type="button"
                className="waiver-intel-card-open"
                data-testid={weeklyProjection?.status === "ready" ? "projection-player-detail-trigger" : undefined}
                onClick={openPlayerDetail}
              >
                <div className="waiver-intel-top">
                  <span className="waiver-intel-label">{label}</span>
                  <span className="available-manager-label">
                    Available
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
                    {weeklyEcrRank && (
                      <WaiverRankPill
                        label="Next rank"
                        rank={weeklyEcrRank}
                        className="waiver-intel-rank-pill-season"
                      />
                    )}
                    {!dynastyRank && !seasonRank && !weeklyEcrRank && (
                      <PositionRankPill rank={rank || player.pos || "-"} />
                    )}
                  </div>
                  <div className="waiver-intel-pill-row waiver-intel-pill-row-secondary">
                    {!isRedraft && label.startsWith("Taxi Stash") && (
                      <span>Rookie Stash</span>
                    )}
                    {weeklyEcrWindow && <span>{weeklyEcrWindow}</span>}
                    <WeeklyProjectionReceipt
                      weeklyProjection={weeklyProjection}
                      variant="pill"
                    />
                    {value > 0 && (
                      <span className="waiver-intel-value-pill">
                        {formatCompactValue(value)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
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
        leagueDiagnostics={leagueDiagnostics}
        calibrationProfile={calibrationProfile}
      />
    </div>
  );
}
