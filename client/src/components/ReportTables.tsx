import { Card } from "@/components/ui/card";
import { AIReadPanel } from "@/components/AIReadPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Crown,
  LockKeyhole,
  Scissors,
  ShieldCheck,
  Star,
  Target,
  X as XIcon,
} from "lucide-react";
import type {
  DraftPick,
  ManagerIntelPlayer,
  PlayerDetails,
  RecentTransactionPlayer,
  ReportData,
  SleeperWaiverClaimSignal,
  TaxiTriageItem,
  TrendingPlayer,
} from "@shared/types";
export { SleeperWaiverClaimsTable } from "./reportTables/SleeperWaiverClaimsTable";
export { TradeProposalSignalsTable } from "./reportTables/TradeProposalSignalsTable";
import { PlayerNameWithHeadshot } from "./PlayerNameWithHeadshot";
import {
  ChampionAvatarFrame,
  ManagerChampionshipPills,
} from "./ManagerChampionships";
import { PlayerDetailModal, type PlayerModalData } from "./PlayerDetailModal";
import { TeamLogoPill } from "./TeamLogoPill";
import {
  EmptyState,
  PlayerIdentityRow,
  ReportCard,
} from "./reportPrimitives";
import { AITronSurface, type AITronTheme } from "./AITronSurface";
import {
  buildPlayerModalData,
  clampPercentValue,
  CommandMiniBadge,
  FeatureCard,
  formatCompactValue,
  formatOutcomeDeltaLabel,
  getAiNeuralSurfaceClass,
  getManagerHeadingClassName,
  getPlayerStatusClass,
  getPlayerStatusLabel,
  getTradeGapVerdict as getSharedTradeGapVerdict,
  IntelligenceMetric,
  normalizeManagerKey,
  OwnerMetricPill,
  OwnerSummaryTile,
  parsePositionRankValue,
  PositionRankPill,
  renderManagerName,
  TradeFitReadCard,
  TradeFairnessCardDisplay,
  TradeLedgerManagerName,
  TradeOutcomeAssetLine,
  TradeOutcomePanelDisplay,
  TradeSideManager,
  TradeSideImpactRead,
  TradeValuePill,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./reportTables/shared";
import {
  getPlayerRankForMode,
  getPlayerValueForMode,
  normalizeLeagueValueMode,
  type LeagueValueMode,
} from "@/lib/leagueValueMode";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import { getPlayerAvailability } from "@/lib/playerStatus";
import {
  compareManagersByViewerAndStanding,
  sortRowsByViewerAndStanding,
} from "@/lib/managerOrdering";
import { isPlaceholderManagerName } from "@/lib/managerDisplay";
import {
  getManagerProfileLabel,
  getOwnerIntelProfileLabel,
} from "@/lib/managerProfileLabels";
import { viewerOwnedHighlightClass } from "@/lib/viewerHighlight";
import { getBalancedGridStyle } from "@/lib/balancedGrid";

export {
  buildPlayerModalData,
  CommandMiniBadge,
  FeatureCard,
  formatCompactValue,
  getAiNeuralSurfaceClass,
  getManagerHeadingClassName,
  getPlayerStatusClass,
  getPlayerStatusLabel,
  IntelligenceMetric,
  OwnerMetricPill,
  OwnerSummaryTile,
  parsePositionRankValue,
  PositionRankPill,
};
export type { ManagerAvatars, PlayerDetailsById };
type CurrentPositionRankById = ReportData["currentPositionRankById"];
type LeagueOverviewRows = ReportData["leagueOverview"];
type ManagerRosterIntelRows = NonNullable<
  ReportData["managerRosterIntelligence"]
>;
type DynastyTimelineRows = NonNullable<ReportData["dynastyTimelines"]>;
type ManagerCountRow = ReportData["managerPositionCounts"][number];
type CountPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

const COUNT_POSITIONS: CountPosition[] = ["QB", "RB", "WR", "TE", "K", "DEF"];

function normalizeReportManagerName(manager?: string | null): string {
  return manager?.trim().toLowerCase() || "";
}

function renderTradeSideManager(
  manager: string,
  isWinner: boolean,
  managerAvatars?: ManagerAvatars,
  buildLens?: ManagerBuildLens
) {
  return (
    <TradeSideManager
      manager={manager}
      isWinner={isWinner}
      managerAvatars={managerAvatars}
      buildLens={buildLens}
    />
  );
}

function renderTradeLedgerManagerName(
  manager: string,
  managerAvatars?: ManagerAvatars,
  buildLens?: ManagerBuildLens
) {
  return (
    <TradeLedgerManagerName
      manager={manager}
      managerAvatars={managerAvatars}
      buildLens={buildLens}
    />
  );
}

function renderTradeFitRead(
  read: TradeFitRead,
  {
    managerAvatars,
    playerDetailsById,
    onPlayerClick,
  }: {
    managerAvatars?: ManagerAvatars;
    playerDetailsById?: PlayerDetailsById;
    onPlayerClick?: (player: PlayerModalData) => void;
  }
) {
  return (
    <TradeFitReadCard
      read={read}
      managerAvatars={managerAvatars}
      playerDetailsById={playerDetailsById}
      onPlayerClick={onPlayerClick}
    />
  );
}

function getTradeGapVerdict(gap: number) {
  return getSharedTradeGapVerdict(gap);
}

function getManagerTradeEvaluationSwing(
  evaluation: TradeLedgerEvaluation,
  manager: string
) {
  if (evaluation.teamA.manager === manager)
    return evaluation.teamA.total - evaluation.teamB.total;
  if (evaluation.teamB.manager === manager)
    return evaluation.teamB.total - evaluation.teamA.total;
  return 0;
}

function getManagerTradeEvaluationResult(
  evaluation: TradeLedgerEvaluation,
  manager: string
) {
  if (evaluation.winners.length > 1 && evaluation.winners.includes(manager))
    return "Even Win";
  return evaluation.winners.includes(manager) ? "Win" : "Loss";
}

const TRADE_LEDGER_MUTUAL_WIN_GAP = 250;

type ManagerBuildLens = {
  mode: TradeWarMode;
  label: string;
  tone: "contender" | "rebuilder" | "middle";
  reason: string;
};

function isRedraftTradeWarMode(
  mode: TradeWarMode | ReportData["leagueValueMode"] | null | undefined
): boolean {
  return (
    mode === "redraft" ||
    mode === "starter-upgrade" ||
    mode === "depth-fix" ||
    mode === "positional-need" ||
    mode === "playoff-push" ||
    mode === "waiver-leverage"
  );
}

function getTradeWarLeagueValueMode(
  mode: TradeWarMode | ReportData["leagueValueMode"] | null | undefined
): LeagueValueMode {
  return isRedraftTradeWarMode(mode) ? "redraft" : "dynasty";
}

function getRedraftTradeLens(
  reason = "Current-season roster fit and lineup usefulness"
): ManagerBuildLens {
  return {
    mode: "starter-upgrade",
    label: "Season Fit",
    tone: "middle",
    reason,
  };
}

type TradeLedgerSideEvaluation = {
  manager: string;
  lens: ManagerBuildLens;
  values: number[];
  adjustment: number;
  total: number;
};

type TradeLedgerEvaluation = {
  teamA: TradeLedgerSideEvaluation;
  teamB: TradeLedgerSideEvaluation;
  pointGap: number;
  winners: string[];
};

function getManagerBuildLens(
  manager: string,
  dynastyTimelines?: DynastyTimelineRows,
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"],
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): ManagerBuildLens {
  if (normalizeLeagueValueMode(leagueValueMode) === "redraft") {
    const intel = managerRosterIntelligence?.find(
      row => row.manager === manager
    );
    const redraftReason = intel?.tradePlan?.needPosition
      ? `Current-season roster need: ${intel.tradePlan.needPosition}`
      : intel?.holes?.summary ||
        intel?.identity ||
        intel?.timeline ||
        "Current-season roster fit";
    return getRedraftTradeLens(redraftReason);
  }

  const timeline = dynastyTimelines?.find(row => row.manager === manager);
  if (timeline) {
    const { contenderScore, rebuildScore, label } = timeline;
    const reason = `${label}: contender ${contenderScore}, rebuild ${rebuildScore}`;

    if (contenderScore >= 74 && contenderScore >= rebuildScore - 6) {
      return {
        mode: "contender",
        label: "Contender",
        tone: "contender",
        reason,
      };
    }

    if (rebuildScore >= 68 && rebuildScore > contenderScore) {
      return {
        mode: "rebuilder",
        label: "Rebuilder",
        tone: "rebuilder",
        reason,
      };
    }

    if (/contender|win|playoff/i.test(label)) {
      return {
        mode: "contender",
        label: "Contender",
        tone: "contender",
        reason,
      };
    }

    if (/rebuild|future/i.test(label)) {
      return {
        mode: "rebuilder",
        label: "Rebuilder",
        tone: "rebuilder",
        reason,
      };
    }

    return { mode: "dynasty", label: "Middle", tone: "middle", reason };
  }

  const intel = managerRosterIntelligence?.find(row => row.manager === manager);
  const fallbackLabel = `${intel?.timeline || intel?.identity || "No timeline score"}`;
  if (/rebuild|future|youth/i.test(fallbackLabel)) {
    return {
      mode: "rebuilder",
      label: "Rebuilder",
      tone: "rebuilder",
      reason: fallbackLabel,
    };
  }
  if (/contender|win|playoff/i.test(fallbackLabel)) {
    return {
      mode: "contender",
      label: "Contender",
      tone: "contender",
      reason: fallbackLabel,
    };
  }

  return {
    mode: "dynasty",
    label: "Middle",
    tone: "middle",
    reason: fallbackLabel,
  };
}

function getTradeContextLens(
  context?: ReportData["tradeHistory"][number]["team_a_context"],
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): ManagerBuildLens | null {
  if (normalizeLeagueValueMode(leagueValueMode) === "redraft") {
    return getRedraftTradeLens(context?.reason || "Current-season roster fit");
  }
  if (!context) return null;
  return {
    mode: context.mode,
    label:
      context.mode === "contender"
        ? "Contender"
        : context.mode === "rebuilder"
          ? "Rebuilder"
          : "Middle",
    tone:
      context.mode === "contender"
        ? "contender"
        : context.mode === "rebuilder"
          ? "rebuilder"
          : "middle",
    reason: context.reason,
  };
}

function getTradeRowBuildLens(
  row: ReportData["tradeHistory"][number],
  manager: string,
  dynastyTimelines?: DynastyTimelineRows,
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"],
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): ManagerBuildLens {
  const context =
    row.team_a === manager
      ? row.team_a_context
      : row.team_b === manager
        ? row.team_b_context
        : undefined;

  return (
    getTradeContextLens(context, leagueValueMode) ||
    getManagerBuildLens(
      manager,
      dynastyTimelines,
      managerRosterIntelligence,
      leagueValueMode
    )
  );
}

function getTradeLensNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function getTradeLedgerPlayerValue(
  playerItem: ReturnType<typeof parseTradePlayerItem>,
  details: PlayerDetails | undefined,
  mode: TradeWarMode
): number | null {
  if (!playerItem) return null;
  const profile = details?.valueProfile;
  if (isRedraftTradeWarMode(mode)) {
    return (
      getTradeLensNumber(profile?.seasonValue) ??
      getTradeLensNumber(profile?.fantasyProsSeasonValue) ??
      getTradeLensNumber(profile?.fantasyCalcRedraft) ??
      getTradeLensNumber(details?.lastSeasonFantasyPoints) ??
      playerItem.value
    );
  }
  if (mode === "contender") {
    return (
      getTradeLensNumber(profile?.contenderValue) ??
      getTradeLensNumber(profile?.seasonValue) ??
      playerItem.value
    );
  }
  if (mode === "rebuilder") {
    return (
      getTradeLensNumber(profile?.rebuilderValue) ??
      getTradeLensNumber(profile?.dynastyValue) ??
      playerItem.value
    );
  }
  return playerItem.tradeDateValue ?? playerItem.value;
}

function getTradeLedgerPlayerRank(
  playerId: string,
  details: PlayerDetails | undefined,
  currentPositionRankById: CurrentPositionRankById | undefined,
  mode: TradeWarMode
) {
  const profile = details?.valueProfile;
  if (isRedraftTradeWarMode(mode)) {
    return (
      profile?.seasonPositionRank ||
      profile?.fantasyProsPositionRank ||
      currentPositionRankById?.[playerId] ||
      details?.position ||
      null
    );
  }
  if (mode === "contender") {
    return (
      profile?.contenderPositionRank ||
      profile?.seasonPositionRank ||
      currentPositionRankById?.[playerId] ||
      profile?.dynastyPositionRank ||
      details?.position ||
      null
    );
  }
  if (mode === "rebuilder") {
    return (
      profile?.rebuilderPositionRank ||
      profile?.dynastyPositionRank ||
      currentPositionRankById?.[playerId] ||
      profile?.balancedPositionRank ||
      details?.position ||
      null
    );
  }
  return (
    currentPositionRankById?.[playerId] ||
    profile?.dynastyPositionRank ||
    profile?.balancedPositionRank ||
    profile?.seasonPositionRank ||
    details?.position ||
    null
  );
}

function getTradeLedgerItemValues(
  items: string,
  mode: TradeWarMode,
  playerDetailsById?: PlayerDetailsById,
  draftPicks: DraftPick[] = [],
  manager?: string
) {
  return splitTradeItems(items)
    .map(item =>
      getTradeLedgerItemValue(
        item,
        mode,
        playerDetailsById,
        draftPicks,
        manager
      )
    )
    .filter(
      (value): value is number => value !== null && Number.isFinite(value)
    );
}

function getTradeLedgerItemValue(
  item: string,
  mode: TradeWarMode,
  playerDetailsById?: PlayerDetailsById,
  draftPicks: DraftPick[] = [],
  manager?: string
): number | null {
  const trimmed = item.trim();
  if (!trimmed || parseValueAdjustmentItem(trimmed) !== null) return null;

  const playerItem = parseTradePlayerItem(trimmed);
  if (playerItem) {
    return getTradeLedgerPlayerValue(
      playerItem,
      playerDetailsById?.[playerItem.playerId],
      mode
    );
  }

  const pickItem = parseTradePickItem(trimmed);
  if (pickItem) {
    const basisValue = getTradeLensNumber(pickItem.value);
    const landedPick = findLandedPick(pickItem, draftPicks);
    if (landedPick && didManagerMakeLandedPick(manager, landedPick)) {
      return (
        getTradeLensNumber(landedPick.currentKtcValue ?? landedPick.ktcValue) ??
        basisValue
      );
    }

    return basisValue;
  }

  return null;
}

function calculateTradeLedgerValueAdjustment(
  sideValues: number[],
  otherSideValues: number[]
): number {
  if (!sideValues.length || !otherSideValues.length) return 0;
  const bestPlayerVal = Math.max(...sideValues, ...otherSideValues);
  if (
    sideValues.includes(bestPlayerVal) &&
    sideValues.length < otherSideValues.length
  ) {
    const diff = otherSideValues.length - sideValues.length;
    const avgPkgVal =
      otherSideValues.reduce((sum, value) => sum + value, 0) /
      otherSideValues.length;
    return Math.floor(avgPkgVal * 0.25 * diff);
  }
  return 0;
}

function chooseTradeLedgerWinners(
  managerA: string,
  managerB: string,
  valueA: number,
  valueB: number
): string[] {
  const pointGap = Math.abs(valueA - valueB);
  if (pointGap <= TRADE_LEDGER_MUTUAL_WIN_GAP) return [managerA, managerB];
  return valueA > valueB ? [managerA] : [managerB];
}

function buildTradeLedgerEvaluation(
  row: ReportData["tradeHistory"][number],
  dynastyTimelines?: DynastyTimelineRows,
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"],
  playerDetailsById?: PlayerDetailsById,
  draftPicks: DraftPick[] = [],
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): TradeLedgerEvaluation {
  const teamALens = getTradeRowBuildLens(
    row,
    row.team_a,
    dynastyTimelines,
    managerRosterIntelligence,
    leagueValueMode
  );
  const teamBLens = getTradeRowBuildLens(
    row,
    row.team_b,
    dynastyTimelines,
    managerRosterIntelligence,
    leagueValueMode
  );
  const teamAValues = getTradeLedgerItemValues(
    row.team_a_items,
    teamALens.mode,
    playerDetailsById,
    draftPicks,
    row.team_a
  );
  const teamBValues = getTradeLedgerItemValues(
    row.team_b_items,
    teamBLens.mode,
    playerDetailsById,
    draftPicks,
    row.team_b
  );
  const teamAAdjustment = calculateTradeLedgerValueAdjustment(
    teamAValues,
    teamBValues
  );
  const teamBAdjustment = calculateTradeLedgerValueAdjustment(
    teamBValues,
    teamAValues
  );
  const teamATotal =
    teamAValues.reduce((sum, value) => sum + value, 0) + teamAAdjustment;
  const teamBTotal =
    teamBValues.reduce((sum, value) => sum + value, 0) + teamBAdjustment;
  const evaluatedTeamATotal = teamATotal || row.team_a_total;
  const evaluatedTeamBTotal = teamBTotal || row.team_b_total;

  return {
    teamA: {
      manager: row.team_a,
      lens: teamALens,
      values: teamAValues,
      adjustment: teamAAdjustment,
      total: evaluatedTeamATotal,
    },
    teamB: {
      manager: row.team_b,
      lens: teamBLens,
      values: teamBValues,
      adjustment: teamBAdjustment,
      total: evaluatedTeamBTotal,
    },
    pointGap: Math.abs(evaluatedTeamATotal - evaluatedTeamBTotal),
    winners: chooseTradeLedgerWinners(
      row.team_a,
      row.team_b,
      evaluatedTeamATotal,
      evaluatedTeamBTotal
    ),
  };
}

function getTradeLensSourceNote(
  row: ReportData["tradeHistory"][number],
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): string | null {
  if (normalizeLeagueValueMode(leagueValueMode) === "redraft") {
    return "Values are shown through a current-season roster lens.";
  }
  const contextA = row.team_a_context;
  const contextB = row.team_b_context;
  if (!contextA && !contextB) return null;
  if (
    contextA?.source === "historical-roster" ||
    contextB?.source === "historical-roster"
  ) {
    return "Values are shown through each manager's pre-trade roster lens, not today's roster identity.";
  }
  return null;
}

function getTradeSideEvaluation(
  manager: string,
  evaluation: TradeLedgerEvaluation
): TradeLedgerSideEvaluation {
  return evaluation.teamA.manager === manager
    ? evaluation.teamA
    : evaluation.teamB;
}

type TradeDisplaySide = {
  manager: string;
  items: string;
  total: number;
  isWinner: boolean;
};

function getTradeDisplaySides(
  row: ReportData["tradeHistory"][number],
  evaluation?: TradeLedgerEvaluation,
  sideOrder?: [string, string]
) {
  const winners =
    evaluation?.winners || (row.winners?.length ? row.winners : [row.winner]);
  const isTeamAWinner = winners.includes(row.team_a);
  const isTeamBWinner = winners.includes(row.team_b);
  const isMutualWin = isTeamAWinner && isTeamBWinner;
  const winnerSide = isTeamBWinner && !isTeamAWinner ? "team_b" : "team_a";
  const teamATotal = evaluation?.teamA.total ?? row.team_a_total;
  const teamBTotal = evaluation?.teamB.total ?? row.team_b_total;
  const loserName = isMutualWin
    ? "Both Win"
    : winnerSide === "team_a"
      ? row.team_b
      : row.team_a;

  const teamASide: TradeDisplaySide = {
    manager: row.team_a,
    items: row.team_a_items,
    total: teamATotal,
    isWinner: isTeamAWinner,
  };
  const teamBSide: TradeDisplaySide = {
    manager: row.team_b,
    items: row.team_b_items,
    total: teamBTotal,
    isWinner: isTeamBWinner,
  };
  const sideByManager = new Map<string, TradeDisplaySide>([
    [row.team_a, teamASide],
    [row.team_b, teamBSide],
  ]);
  const requestedSides = sideOrder
    ?.map(manager => sideByManager.get(manager))
    .filter((side): side is TradeDisplaySide => Boolean(side));
  const defaultSides = isMutualWin
    ? [teamASide, teamBSide]
    : winnerSide === "team_a"
      ? [teamASide, teamBSide]
      : [teamBSide, teamASide];
  const [leftSide, rightSide] =
    requestedSides?.length === 2 ? requestedSides : defaultSides;

  return { winners, loserName, leftSide, rightSide };
}

type TradeOutcomeAsset = {
  id: string;
  label: string;
  name: string;
  kind: "player" | "pick";
  value: number;
  basisValue: number;
  valueDelta: number;
  seasonValue: number;
  rank?: string | null;
  detail?: string | null;
  outcomeNote?: string | null;
  status?: string | null;
  playerId?: string;
  children?: TradeOutcomeAsset[];
};

type TradeOutcomeSide = {
  manager: string;
  side: TradeDisplaySide;
  evaluation: TradeLedgerSideEvaluation;
  assets: TradeOutcomeAsset[];
  assetValue: number;
  basisValue: number;
  valueDelta: number;
  seasonValue: number;
};

type TradeOutcomeRecord = {
  manager: string;
  seasons: string[];
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  latestRank: number | null;
};

type TradeOutcomeReview = {
  statusLabel: string;
  windowLabel: string;
  windowSubtitle: string;
  observedThroughLabel: string;
  verdict: string;
  metrics: Array<{
    label: string;
    value: string;
    note: string;
    tone: "good" | "bad" | "neutral";
  }>;
  notes: string[];
  sides: TradeOutcomeSide[];
  records: TradeOutcomeRecord[];
};

function parseTradeOutcomeDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function formatOutcomeDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getOutcomePlayerSeasonValue(details?: PlayerDetails): number {
  return (
    getTradeLensNumber(
      details?.valueProfile?.seasonValue ??
        details?.valueProfile?.fantasyProsSeasonValue
    ) ??
    getTradeLensNumber(details?.lastSeasonFantasyPoints) ??
    0
  );
}

function getOutcomeAssetStatus(details?: PlayerDetails): string | null {
  const status = getPlayerAvailability(details).label;
  if (status && !/^(active|healthy)$/i.test(status)) return status;
  const avgMissed = getTradeLensNumber(details?.avgGamesMissed);
  if (avgMissed && avgMissed >= 3) return `${avgMissed} avg missed games`;
  return null;
}

function getOutcomeAssetsFromItems(
  items: string,
  mode: TradeWarMode,
  playerDetailsById?: PlayerDetailsById,
  currentPositionRankById?: CurrentPositionRankById,
  draftPicks: DraftPick[] = [],
  manager?: string
): TradeOutcomeAsset[] {
  return splitTradeItems(items)
    .filter(item => parseValueAdjustmentItem(item.trim()) === null)
    .flatMap((item, index): TradeOutcomeAsset[] => {
      const trimmed = item.trim();
      const playerItem = parseTradePlayerItem(trimmed);
      if (playerItem) {
        const details = playerDetailsById?.[playerItem.playerId];
        const value =
          getTradeLedgerPlayerValue(playerItem, details, mode) ??
          playerItem.value ??
          0;
        const basisValue =
          getTradeLensNumber(playerItem.tradeDateValue) ??
          getTradeLensNumber(playerItem.value) ??
          value;
        const rank = getTradeLedgerPlayerRank(
          playerItem.playerId,
          details,
          currentPositionRankById,
          mode
        );
        const points = getTradeLensNumber(details?.lastSeasonFantasyPoints);
        const detail = points
          ? `${points.toLocaleString()} last-season pts${details?.lastSeasonYear ? ` (${details.lastSeasonYear})` : ""}`
          : details?.valueProfile?.seasonPositionRank
            ? `${details.valueProfile.seasonPositionRank} season lens`
            : null;
        return [
          {
            id: `${index}-${playerItem.playerId}`,
            label: playerItem.playerName,
            name: playerItem.playerName,
            kind: "player",
            value,
            basisValue,
            valueDelta: value - basisValue,
            seasonValue: getOutcomePlayerSeasonValue(details),
            rank,
            detail,
            status: getOutcomeAssetStatus(details),
            playerId: playerItem.playerId,
          },
        ];
      }

      const pickItem = parseTradePickItem(trimmed);
      if (!pickItem) return [];
      const isRedraftLens = isRedraftTradeWarMode(mode);

      const landedPick = findLandedPick(pickItem, draftPicks);
      const displayedPickLabel =
        landedPick?.draftSlot && pickItem.draftYear && pickItem.round
          ? `${pickItem.draftYear} ${formatPickRound(pickItem.round)} (${pickItem.round}.${String(landedPick.draftSlot).padStart(2, "0")})`
          : pickItem.displayLabel;
      const basisValue = getTradeLensNumber(pickItem.value) ?? 0;
      const managerMadePick = didManagerMakeLandedPick(manager, landedPick);
      const movedAfterTrade = Boolean(pickItem.flipOutcome?.assets?.length);

      if (landedPick && managerMadePick) {
        const details = landedPick.player_id
          ? playerDetailsById?.[landedPick.player_id] ||
            landedPick.playerDetails
          : landedPick.playerDetails;
        const value =
          getTradeLensNumber(
            landedPick.currentKtcValue ?? landedPick.ktcValue
          ) ?? basisValue;
        const rank =
          landedPick.currentPositionRank ||
          (landedPick.player_id
            ? currentPositionRankById?.[landedPick.player_id]
            : null) ||
          landedPick.playerPos;
        return [
          {
            id: `${index}-${displayedPickLabel}`,
            label: displayedPickLabel,
            name: landedPick.playerName,
            kind: "pick",
            value,
            basisValue,
            valueDelta: value - basisValue,
            seasonValue: getOutcomePlayerSeasonValue(details),
            rank,
            detail: `${displayedPickLabel} selected by ${landedPick.manager || "unknown"}`,
            status: getOutcomeAssetStatus(details),
            playerId: landedPick.player_id,
          },
        ];
      }

      if (landedPick) {
        const selectedBy = landedPick.manager || "another manager";
        const movedNote =
          movedAfterTrade && pickItem.flipOutcome?.date
            ? `${manager || "This side"} moved ${displayedPickLabel} on ${pickItem.flipOutcome.date}; the outcome keeps the ${isRedraftLens ? "original draft value" : "pick-market value"} instead of chasing later returns. ${selectedBy} selected ${landedPick.playerName}.`
            : `${manager || "This side"} did not make ${displayedPickLabel}; the outcome keeps the ${isRedraftLens ? "original draft value" : "pick-market value"}. ${selectedBy} selected ${landedPick.playerName}.`;
        return [
          {
            id: `${index}-${displayedPickLabel}`,
            label: displayedPickLabel,
            name: displayedPickLabel,
            kind: "pick",
            value: basisValue,
            basisValue,
            valueDelta: 0,
            seasonValue: 0,
            detail: `${displayedPickLabel} selected by ${selectedBy}`,
            outcomeNote: movedNote,
            playerId: landedPick.player_id,
          },
        ];
      }

      if (movedAfterTrade) {
        return [
          {
            id: `${index}-${displayedPickLabel}`,
            label: displayedPickLabel,
            name: displayedPickLabel,
            kind: "pick",
            value: basisValue,
            basisValue,
            valueDelta: 0,
            seasonValue: 0,
            detail: `Moved${pickItem.flipOutcome?.date ? ` on ${pickItem.flipOutcome.date}` : ""}; retained at ${isRedraftLens ? "original draft value" : "pick-market value"}`,
            outcomeNote: `${manager || "This side"} moved ${displayedPickLabel} after this deal; the outcome keeps the ${isRedraftLens ? "original draft value" : "pick-market value"} instead of chasing later returns.`,
          },
        ];
      }

      return [
        {
          id: `${index}-${displayedPickLabel}`,
          label: displayedPickLabel,
          name: displayedPickLabel,
          kind: "pick",
          value: basisValue,
          basisValue,
          valueDelta: 0,
          seasonValue: 0,
          detail: isRedraftLens
            ? "Unresolved draft pick"
            : "Still unresolved draft capital",
        },
      ];
    });
}

function buildOutcomeRecords(
  row: ReportData["tradeHistory"][number],
  managers: string[],
  observedThrough: Date,
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty",
  standingsHistory?: ReportData["standingsHistory"],
  currentStandings?: ReportData["currentStandings"]
): TradeOutcomeRecord[] {
  const tradeYear = Number(row.date.slice(0, 4));
  const maxYear =
    normalizeLeagueValueMode(leagueValueMode) === "redraft"
      ? tradeYear
      : observedThrough.getUTCFullYear();
  const historicalRows = (standingsHistory || []).filter(standing => {
    const seasonYear = Number(standing.season);
    return (
      managers.includes(standing.manager) &&
      Number.isFinite(seasonYear) &&
      seasonYear >= tradeYear &&
      seasonYear <= maxYear &&
      (standing.wins > 0 ||
        standing.losses > 0 ||
        standing.ties > 0 ||
        standing.pointsFor > 0)
    );
  });

  const fallbackRows = historicalRows.length
    ? historicalRows
    : (currentStandings || [])
        .filter(
          standing =>
            managers.includes(standing.manager) &&
            (standing.wins > 0 ||
              standing.losses > 0 ||
              standing.ties > 0 ||
              standing.pointsFor > 0)
        )
        .map(standing => ({
          ...standing,
          season: String(observedThrough.getUTCFullYear()),
        }));

  return managers
    .map(manager => {
      const rows = fallbackRows.filter(
        standing => standing.manager === manager
      );
      return {
        manager,
        seasons: rows.map(standing => standing.season),
        wins: rows.reduce((sum, standing) => sum + standing.wins, 0),
        losses: rows.reduce((sum, standing) => sum + standing.losses, 0),
        ties: rows.reduce((sum, standing) => sum + standing.ties, 0),
        pointsFor: rows.reduce((sum, standing) => sum + standing.pointsFor, 0),
        latestRank: rows.length ? rows[rows.length - 1].rank : null,
      };
    })
    .filter(record => record.seasons.length > 0);
}

function buildTradeOutcomeReview({
  row,
  tradeEvaluation,
  sides,
  draftPicks,
  playerDetailsById,
  currentPositionRankById,
  leagueDiagnostics,
  standingsHistory,
  currentStandings,
  leagueValueMode = "dynasty",
}: {
  row: ReportData["tradeHistory"][number];
  tradeEvaluation: TradeLedgerEvaluation;
  sides: [TradeDisplaySide, TradeDisplaySide];
  draftPicks: DraftPick[];
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  standingsHistory?: ReportData["standingsHistory"];
  currentStandings?: ReportData["currentStandings"];
  leagueValueMode?: ReportData["leagueValueMode"];
}): TradeOutcomeReview {
  const tradeDate = parseTradeOutcomeDate(row.date);
  const redraftWindowEnd = leagueDiagnostics?.redraftTradeWindowEndDate
    ? new Date(`${leagueDiagnostics.redraftTradeWindowEndDate}T00:00:00Z`)
    : null;
  const tradeSeasonNumber = Number(row.season);
  const fallbackRedraftFinalDate = Number.isFinite(tradeSeasonNumber)
    ? new Date(Date.UTC(tradeSeasonNumber + 1, 0, 1))
    : addYears(tradeDate, 1);
  const finalDate =
    normalizeLeagueValueMode(leagueValueMode) === "redraft"
      ? redraftWindowEnd &&
        !Number.isNaN(redraftWindowEnd.getTime()) &&
        redraftWindowEnd > tradeDate
        ? redraftWindowEnd
        : fallbackRedraftFinalDate
      : addYears(tradeDate, 2);
  const today = new Date();
  const observedThrough = today > finalDate ? finalDate : today;
  const isFinal = today >= finalDate;
  const outcomeSides = sides.map(side => {
    const sideEvaluation = getTradeSideEvaluation(
      side.manager,
      tradeEvaluation
    );
    const assets = getOutcomeAssetsFromItems(
      side.items,
      sideEvaluation.lens.mode,
      playerDetailsById,
      currentPositionRankById,
      draftPicks,
      side.manager
    );
    const assetValue = assets.reduce((sum, asset) => sum + asset.value, 0);
    const basisValue = assets.reduce((sum, asset) => sum + asset.basisValue, 0);
    const valueDelta = assets.reduce((sum, asset) => sum + asset.valueDelta, 0);
    const seasonValue = assets.reduce(
      (sum, asset) => sum + asset.seasonValue,
      0
    );

    return {
      manager: side.manager,
      side,
      evaluation: sideEvaluation,
      assets,
      assetValue,
      basisValue,
      valueDelta,
      seasonValue,
    };
  });
  const [firstOutcome, secondOutcome] = outcomeSides;
  const leadingSide =
    firstOutcome.evaluation.total >= secondOutcome.evaluation.total
      ? firstOutcome
      : secondOutcome;
  const trailingSide =
    leadingSide === firstOutcome ? secondOutcome : firstOutcome;
  const valueGap = Math.abs(
    firstOutcome.evaluation.total - secondOutcome.evaluation.total
  );
  const seasonGap = Math.abs(
    firstOutcome.seasonValue - secondOutcome.seasonValue
  );
  const seasonLeader =
    firstOutcome.seasonValue >= secondOutcome.seasonValue
      ? firstOutcome
      : secondOutcome;
  const hasLineupSignal = seasonGap >= 450;
  const records = buildOutcomeRecords(
    row,
    outcomeSides.map(side => side.manager),
    observedThrough,
    leagueValueMode,
    standingsHistory,
    currentStandings
  );
  const recordDelta =
    records.length === 2
      ? {
          wins: records[0].wins - records[1].wins,
          points: Math.round(records[0].pointsFor - records[1].pointsFor),
        }
      : null;
  const recordNote =
    records.length === 2
      ? `${records[0].manager} went ${records[0].wins}-${records[0].losses}${records[0].ties ? `-${records[0].ties}` : ""}; ${records[1].manager} went ${records[1].wins}-${records[1].losses}${records[1].ties ? `-${records[1].ties}` : ""}. That is a ${Math.abs(recordDelta!.wins)} win and ${formatCompactValue(Math.abs(recordDelta!.points))} points-for spread in the tracked window, context rather than direct causality.`
      : "No completed-season win/loss record is available inside this outcome window yet, so the record read falls back to current lineup value.";
  const pickLineageNotes = outcomeSides.flatMap(side =>
    side.assets
      .filter(asset => asset.outcomeNote)
      .map(asset => asset.outcomeNote!)
  );
  const availabilityNotes = outcomeSides.flatMap(side =>
    side.assets
      .flatMap(asset => [asset, ...(asset.children || [])])
      .filter(asset => asset.status)
      .slice(0, 2)
      .map(
        asset =>
          `${asset.name} carries ${asset.status} risk/status on ${side.manager}'s outcome side.`
      )
  );
  const recordMetricValue =
    records.length === 2
      ? recordDelta!.wins === 0
        ? "Even"
        : `${recordDelta!.wins > 0 ? records[0].manager : records[1].manager} +${Math.abs(recordDelta!.wins)} W`
      : "No record";
  const verdict = `${leadingSide.manager} is ahead by ${valueGap.toLocaleString()} in realized ledger value through ${formatOutcomeDate(observedThrough)}. ${
    hasLineupSignal
      ? `${seasonLeader.manager} also owns the stronger current lineup-value signal by roughly ${formatCompactValue(seasonGap)}. This is not a direct win estimate.`
      : "The current lineup-value signal is thin, so this is mainly an asset-value read."
  }`;

  return {
    statusLabel: isFinal ? "Final Outcome" : "Outcome So Far",
    windowLabel: `${formatOutcomeDate(tradeDate)} - ${formatOutcomeDate(finalDate)}`,
    windowSubtitle:
      normalizeLeagueValueMode(leagueValueMode) === "redraft"
        ? `Redraft window ends at championship week. Window: ${formatOutcomeDate(tradeDate)} - ${formatOutcomeDate(finalDate)}`
        : `Window: ${formatOutcomeDate(tradeDate)} - ${formatOutcomeDate(finalDate)}`,
    observedThroughLabel: formatOutcomeDate(observedThrough),
    verdict,
    metrics: [
      {
        label: "Realized Edge",
        value: valueGap.toLocaleString(),
        note: `${leadingSide.manager} context-adjusted value edge over ${trailingSide.manager}`,
        tone: valueGap >= 1000 ? "good" : valueGap >= 300 ? "neutral" : "bad",
      },
      {
        label: "Asset Change",
        value: formatOutcomeDeltaLabel(leadingSide.valueDelta),
        note: `current value minus trade-day value for ${leadingSide.manager}'s side`,
        tone:
          leadingSide.valueDelta > 0
            ? "good"
            : leadingSide.valueDelta < 0
              ? "bad"
              : "neutral",
      },
      {
        label: "Lineup Signal",
        value: hasLineupSignal
          ? `Lean +${formatCompactValue(seasonGap)}`
          : "Thin",
        note: hasLineupSignal
          ? `${seasonLeader.manager} current weekly lineup-value lean, not projected wins`
          : "no clear weekly lineup-value lean",
        tone: hasLineupSignal ? "good" : "neutral",
      },
      {
        label: "Actual Record",
        value: recordMetricValue,
        note:
          records.length === 2
            ? "standings context, not trade credit"
            : "current league standings are not meaningful yet",
        tone: "neutral",
      },
    ],
    notes: [
      recordNote,
      ...pickLineageNotes,
      ...(availabilityNotes.length
        ? availabilityNotes
        : [
            "No major injury/status drag is visible on the primary outcome assets.",
          ]),
    ].slice(0, 5),
    sides: outcomeSides,
    records,
  };
}

function renderOutcomeAssetLine(asset: TradeOutcomeAsset) {
  return <TradeOutcomeAssetLine asset={asset} />;
}

function TradeOutcomePanel({ outcome }: { outcome: TradeOutcomeReview }) {
  return (
    <TradeOutcomePanelDisplay
      outcome={outcome}
      renderAssetLine={asset =>
        renderOutcomeAssetLine(asset as TradeOutcomeSide["assets"][number])
      }
    />
  );
}

function getTradeFairnessSuggestionCopy(
  suggestion: TradeFairnessSuggestion
): string {
  return `${suggestion.fromManager} should have added ${suggestion.player.name} to ${suggestion.toManager}'s side to make this trade closer to even.`;
}

function TradeFairnessCard({
  suggestion,
  leagueValueMode,
  managerAvatars,
  playerDetailsById,
  onPlayerClick,
}: {
  suggestion: TradeFairnessSuggestion;
  leagueValueMode: ReportData["leagueValueMode"];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  onPlayerClick?: (player: PlayerModalData) => void;
}) {
  const playerDetails =
    suggestion.player.playerDetails ||
    playerDetailsById?.[suggestion.player.player_id];

  return (
    <TradeFairnessCardDisplay
      description={getTradeFairnessSuggestionCopy(suggestion)}
      tileStyle={getTeamTileStyle(playerDetails?.team)}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        if (!onPlayerClick) return;
        onPlayerClick(
          buildPlayerModalData({
            playerId: suggestion.player.player_id,
            playerName: suggestion.player.name,
            playerPos: suggestion.player.pos,
            value: suggestion.player.value,
            playerDetails,
            playerDetailsById,
            manager: suggestion.player.owner || suggestion.fromManager,
            managerAvatarUrl: managerAvatars?.[suggestion.fromManager],
            currentPositionRank:
              suggestion.player.currentPositionRank ||
              suggestion.player.seasonPositionRank,
          })
        );
      }}
      metric={
        leagueValueMode === "redraft" ? (
          <span className="trade-fairness-value">
            {formatCompactValue(suggestion.displayValue)}
          </span>
        ) : (
          <PositionRankPill
            rank={suggestion.displayRank || suggestion.player.pos}
          />
        )
      }
    >
      <PlayerNameWithHeadshot
        playerId={suggestion.player.player_id}
        playerName={suggestion.player.name}
        team={playerDetails?.team}
        position={suggestion.player.pos}
      />
    </TradeFairnessCardDisplay>
  );
}

function TradeDetailPanel({
  row,
  draftPicks = [],
  managerAvatars,
  playerDetailsById,
  currentPositionRankById,
  managerRosterIntelligence,
  dynastyTimelines,
  leagueOverview,
  sideOrder,
  leagueDiagnostics,
  standingsHistory,
  currentStandings,
  leagueValueMode = "dynasty",
  onPlayerClick,
}: {
  row: ReportData["tradeHistory"][number];
  draftPicks?: DraftPick[];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  currentPositionRankById?: CurrentPositionRankById;
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"];
  dynastyTimelines?: DynastyTimelineRows;
  leagueOverview?: LeagueOverviewRows;
  sideOrder?: [string, string];
  leagueDiagnostics?: ReportData["leagueDiagnostics"];
  standingsHistory?: ReportData["standingsHistory"];
  currentStandings?: ReportData["currentStandings"];
  leagueValueMode?: ReportData["leagueValueMode"];
  onPlayerClick?: (player: PlayerModalData) => void;
}) {
  const tradeEvaluation = buildTradeLedgerEvaluation(
    row,
    dynastyTimelines,
    managerRosterIntelligence,
    playerDetailsById,
    draftPicks,
    leagueValueMode
  );
  const { leftSide, rightSide } = getTradeDisplaySides(
    row,
    tradeEvaluation,
    sideOrder
  );
  const tradeFitReads = buildTradeFitReads(
    row,
    managerRosterIntelligence,
    playerDetailsById
  );
  const tradeFitReadsByManager = new Map(
    tradeFitReads.map(read => [read.manager, read])
  );
  const intelByManager = new Map(
    (managerRosterIntelligence || []).map(intel => [intel.manager, intel])
  );
  const tradeLensNote = getTradeLensSourceNote(row, leagueValueMode);
  const fairnessSuggestion = buildTradeFairnessSuggestion(
    row,
    tradeEvaluation,
    leagueValueMode
  );
  const outcomeReview = buildTradeOutcomeReview({
    row,
    tradeEvaluation,
    sides: [leftSide, rightSide],
    draftPicks,
    playerDetailsById,
    currentPositionRankById,
    leagueDiagnostics,
    standingsHistory,
    currentStandings,
    leagueValueMode,
  });

  return (
    <div className="trade-detail-panel">
      <div className="trade-detail-header">
        <div className="trade-detail-heading">
          <div className="trade-detail-kicker">Trade Detail</div>
          <div className="trade-detail-title">Trade Ledger</div>
          {tradeLensNote && (
            <p className="mt-1 max-w-xl text-xs text-cyan-200/75">
              {tradeLensNote}
            </p>
          )}
        </div>
        <div
          className={`trade-detail-decision-bar ${fairnessSuggestion ? "trade-detail-decision-bar-with-balance" : ""}`}
        >
          <div className="trade-detail-gap">
            <span>Value Gap</span>
            <strong>{tradeEvaluation.pointGap.toLocaleString()}</strong>
            <small>context-adjusted edge</small>
          </div>
          {fairnessSuggestion && (
            <TradeFairnessCard
              suggestion={fairnessSuggestion}
              leagueValueMode={leagueValueMode}
              managerAvatars={managerAvatars}
              playerDetailsById={playerDetailsById}
              onPlayerClick={onPlayerClick}
            />
          )}
        </div>
      </div>
      <TradeOutcomePanel outcome={outcomeReview} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {[leftSide, rightSide].map(side => {
          const sideEvaluation = getTradeSideEvaluation(
            side.manager,
            tradeEvaluation
          );
          const displayItems = splitTradeItems(side.items).filter(
            item => parseValueAdjustmentItem(item.trim()) === null
          );

          return (
            <div
              key={side.manager}
              className={`trade-side ${side.isWinner ? "trade-side-winner" : "trade-side-loser"}`}
            >
              {managerAvatars?.[side.manager] && (
                <img
                  src={managerAvatars[side.manager] || ""}
                  alt=""
                  className="trade-side-watermark"
                />
              )}
              <div className="trade-side-header relative flex items-center justify-between gap-3 border-b border-orange-300/15 pb-3">
                <div className="min-w-0">
                  <span
                    className={`trade-side-label ${side.isWinner ? "trade-side-label-win" : "trade-side-label-other"}`}
                  >
                    {side.isWinner ? "Winner" : "Other Side"}
                  </span>
                </div>
                {renderTradeSideManager(
                  side.manager,
                  side.isWinner,
                  managerAvatars,
                  sideEvaluation.lens
                )}
                <div
                  className={`trade-side-total ${side.isWinner ? "trade-side-total-win" : "trade-side-total-other"}`}
                >
                  <span>Total</span>
                  <strong>{sideEvaluation.total.toLocaleString()}</strong>
                </div>
              </div>
              <div className="relative pt-3">
                <div className="trade-side-assets text-sm text-slate-300">
                  {displayItems.map((item, i) =>
                    renderTradeItem(item, i, {
                      draftPicks,
                      playerDetailsById,
                      currentPositionRankById,
                      onPlayerClick,
                      manager: side.manager,
                      managerAvatarUrl: managerAvatars?.[side.manager],
                      valueMode: sideEvaluation.lens.mode,
                    })
                  )}
                  {sideEvaluation.adjustment > 0 &&
                    renderTradeItem(
                      `VALUE_ADJUSTMENT:+${sideEvaluation.adjustment}`,
                      displayItems.length
                    )}
                </div>
                {renderTradeOverviewImpact({
                  manager: side.manager,
                  incomingItems: side.items,
                  outgoingItems:
                    side === leftSide ? rightSide.items : leftSide.items,
                  intel: intelByManager.get(side.manager),
                  playerDetailsById,
                })}
                {tradeFitReadsByManager.has(side.manager) && (
                  <div className="trade-side-fit-reads">
                    {renderTradeFitRead(
                      tradeFitReadsByManager.get(side.manager)!,
                      {
                        managerAvatars,
                        playerDetailsById,
                        onPlayerClick,
                      }
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parseTradePlayerItem(trimmed: string) {
  if (!trimmed.startsWith("PLAYER:")) return null;
  const payload = trimmed.replace("PLAYER:", "");
  const parts = payload.split("|");
  const [playerId, playerName, rawValue, rawTradeDateValue, tradeDate] = parts;
  const value =
    rawValue !== undefined && rawValue !== "" ? Number(rawValue) : null;
  const tradeDateValue =
    rawTradeDateValue !== undefined && rawTradeDateValue !== ""
      ? Number(rawTradeDateValue)
      : null;

  return {
    playerId,
    playerName,
    value: Number.isFinite(value) ? value : null,
    tradeDateValue: Number.isFinite(tradeDateValue) ? tradeDateValue : null,
    tradeDate: tradeDate || null,
  };
}

function parseValueAdjustmentItem(trimmed: string) {
  if (!trimmed.startsWith("VALUE_ADJUSTMENT:")) return null;
  const value = Number(
    trimmed.replace("VALUE_ADJUSTMENT:", "").replace("+", "")
  );
  return Number.isFinite(value) ? value : null;
}

type TradePickFlipOutcome = {
  date: string | null;
  fromRosterId: number | null;
  toRosterId: number | null;
  assets: string[];
};

function parseTradePickFlipOutcome(
  rawValue: string | undefined
): TradePickFlipOutcome | null {
  if (!rawValue?.startsWith("FLIP:")) return null;

  try {
    const parsed = JSON.parse(
      decodeURIComponent(rawValue.replace(/^FLIP:/, ""))
    );
    const assets = Array.isArray(parsed?.assets)
      ? parsed.assets.filter(
          (asset: unknown): asset is string =>
            typeof asset === "string" && asset.trim().length > 0
        )
      : [];
    if (!assets.length) return null;

    const fromRosterId = Number(parsed?.fromRosterId);
    const toRosterId = Number(parsed?.toRosterId);
    return {
      date: typeof parsed?.date === "string" ? parsed.date : null,
      fromRosterId: Number.isFinite(fromRosterId) ? fromRosterId : null,
      toRosterId: Number.isFinite(toRosterId) ? toRosterId : null,
      assets,
    };
  } catch {
    return null;
  }
}

function parseTradePickItem(trimmed: string) {
  if (!trimmed.startsWith("PICK:")) return null;
  const payload = trimmed.replace("PICK:", "");
  const [
    label,
    value,
    metadataDraftYear,
    metadataRound,
    metadataOriginalRosterId,
    metadataFinalOwnerRosterId,
    metadataFlipOutcome,
  ] = payload.split("|");
  const match = label.match(
    /^(\d{4}) (.+) (\d+)(?:st|nd|rd|th)(?: \((\d+\.\d+)\))?$/
  );
  const draftYear = metadataDraftYear || match?.[1] || null;
  const round = metadataRound
    ? Number(metadataRound)
    : match?.[3]
      ? Number(match[3])
      : null;
  const originalRosterId = metadataOriginalRosterId
    ? Number(metadataOriginalRosterId)
    : null;
  const finalOwnerRosterId = metadataFinalOwnerRosterId
    ? Number(metadataFinalOwnerRosterId)
    : null;
  const pickNumber = match?.[4] ?? null;

  return {
    label,
    displayLabel:
      draftYear && round
        ? `${draftYear} ${formatPickRound(round)}${pickNumber ? ` (${pickNumber})` : ""}`
        : label,
    value: value ? Number(value) : null,
    draftYear,
    originalOwner: match?.[2] ?? null,
    originalRosterId: Number.isFinite(originalRosterId)
      ? originalRosterId
      : null,
    finalOwnerRosterId: Number.isFinite(finalOwnerRosterId)
      ? finalOwnerRosterId
      : null,
    flipOutcome: parseTradePickFlipOutcome(metadataFlipOutcome),
    round,
    pickNumber,
  };
}

function formatPickRound(round: number): string {
  if (round === 1) return "1st";
  if (round === 2) return "2nd";
  if (round === 3) return "3rd";
  return `${round}th`;
}

function findLandedPick(
  parsedPick: ReturnType<typeof parseTradePickItem>,
  draftPicks: DraftPick[]
) {
  if (!parsedPick?.draftYear || !parsedPick.round) {
    return null;
  }

  const byOriginalRosterId = parsedPick.originalRosterId
    ? draftPicks.find(
        pick =>
          pick.draftYear === parsedPick.draftYear &&
          pick.round === parsedPick.round &&
          pick.originalRosterId === parsedPick.originalRosterId
      )
    : null;
  const byFinalOwnerRosterId = parsedPick.finalOwnerRosterId
    ? draftPicks.filter(
        pick =>
          pick.draftYear === parsedPick.draftYear &&
          pick.round === parsedPick.round &&
          pick.managerRosterId === parsedPick.finalOwnerRosterId
      )
    : [];
  if (byFinalOwnerRosterId.length === 1) return byFinalOwnerRosterId[0];

  const parsedDraftSlot = parsedPick.pickNumber
    ? Number(parsedPick.pickNumber.split(".")[1])
    : null;
  const byFinalOwnerAndSlot = byFinalOwnerRosterId.find(
    pick =>
      Number.isFinite(parsedDraftSlot) && pick.draftSlot === parsedDraftSlot
  );
  if (byFinalOwnerAndSlot) return byFinalOwnerAndSlot;
  if (byOriginalRosterId) return byOriginalRosterId;
  if (!parsedPick.originalOwner) return null;

  const parsedOwner = normalizeManagerKey(parsedPick.originalOwner);

  const candidates = draftPicks.filter(pick => {
    const baseMatch =
      pick.draftYear === parsedPick.draftYear &&
      pick.round === parsedPick.round &&
      normalizeManagerKey(pick.originalOwner) === parsedOwner;

    if (!baseMatch) return false;
    if (!Number.isFinite(parsedDraftSlot)) return true;
    return pick.draftSlot === parsedDraftSlot;
  });

  if (candidates[0]) return candidates[0];

  const ownerRoundCandidates = draftPicks.filter(
    pick =>
      pick.draftYear === parsedPick.draftYear &&
      pick.round === parsedPick.round &&
      normalizeManagerKey(pick.originalOwner) === parsedOwner
  );

  return ownerRoundCandidates.length === 1 ? ownerRoundCandidates[0] : null;
}

function didManagerMakeLandedPick(
  manager: string | undefined,
  landedPick: DraftPick | null | undefined
): boolean {
  if (!manager || !landedPick?.manager) return false;
  return (
    normalizeManagerKey(manager) === normalizeManagerKey(landedPick.manager)
  );
}

function renderTradeItem(
  item: string,
  key: number,
  {
    draftPicks = [],
    playerDetailsById,
    currentPositionRankById,
    onPlayerClick,
    manager,
    managerAvatarUrl,
    valueMode = "dynasty",
  }: {
    draftPicks?: DraftPick[];
    playerDetailsById?: PlayerDetailsById;
    currentPositionRankById?: CurrentPositionRankById;
    onPlayerClick?: (player: PlayerModalData) => void;
    manager?: string;
    managerAvatarUrl?: string | null;
    valueMode?: TradeWarMode;
  } = {}
) {
  const trimmed = item.trim();
  if (!trimmed) return null;

  const valueAdjustment = parseValueAdjustmentItem(trimmed);
  if (valueAdjustment !== null) {
    return (
      <div key={key} className="trade-asset trade-asset-boost">
        <span className="inline-flex h-6 items-center justify-center rounded-md bg-blue-500/15 px-2 font-black">
          STUD BOOST
        </span>
        <span>+{valueAdjustment.toLocaleString()}</span>
      </div>
    );
  }

  const playerItem = parseTradePlayerItem(trimmed);
  if (playerItem) {
    const details = playerDetailsById?.[playerItem.playerId];
    const teamStyle = getTeamTileStyle(details?.team);
    const currentRank = getTradeLedgerPlayerRank(
      playerItem.playerId,
      details,
      currentPositionRankById,
      valueMode
    );
    const displayedValue = getTradeLedgerPlayerValue(
      playerItem,
      details,
      valueMode
    );
    const valueGain =
      valueMode === "dynasty" &&
      playerItem.value !== null &&
      playerItem.tradeDateValue !== null
        ? playerItem.value - playerItem.tradeDateValue
        : undefined;
    const content = (
      <>
        <span className="trade-asset-player-main">
          <PlayerNameWithHeadshot
            playerId={playerItem.playerId}
            playerName={playerItem.playerName}
            team={details?.team}
            position={details?.position}
          />
        </span>
        <span className="trade-asset-player-meta">
          <span className="trade-asset-player-pills">
            <TeamLogoPill team={details?.team} />
            <PositionRankPill rank={currentRank || "Player"} />
          </span>
          {displayedValue !== null && (
            <TradeValuePill className="trade-asset-player-value">
              {displayedValue.toLocaleString()}
            </TradeValuePill>
          )}
        </span>
      </>
    );

    if (onPlayerClick) {
      return (
        <button
          key={key}
          type="button"
          className="player-team-tile trade-asset trade-asset-clickable trade-asset-player"
          style={teamStyle}
          aria-label={`Open ${playerItem.playerName} player card`}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onPlayerClick(
              buildPlayerModalData({
                playerId: playerItem.playerId,
                playerName: playerItem.playerName,
                value: displayedValue,
                valueGain,
                valueChangeNote:
                  valueMode === "dynasty" && playerItem.tradeDate
                    ? `Change from this trade on ${playerItem.tradeDate} to today.`
                    : undefined,
                playerDetails: details,
                playerDetailsById,
                manager,
                managerAvatarUrl,
                currentPositionRank: currentRank,
                valueMode: getTradeWarLeagueValueMode(valueMode),
              })
            );
          }}
        >
          {content}
        </button>
      );
    }

    return (
      <div
        key={key}
        className="player-team-tile trade-asset trade-asset-player"
        style={teamStyle}
      >
        {content}
      </div>
    );
  }

  const pickItem = parseTradePickItem(trimmed);
  if (pickItem) {
    const landedPick = findLandedPick(pickItem, draftPicks);
    const landedValue =
      landedPick?.currentKtcValue ?? landedPick?.ktcValue ?? null;
    const displayedPickValue = pickItem.value;
    const flippedAssets = pickItem.flipOutcome?.assets || [];
    const wasFlipped = flippedAssets.length > 0;
    const displayedPickLabel =
      landedPick?.draftSlot && pickItem.draftYear && pickItem.round
        ? `${pickItem.draftYear} ${formatPickRound(pickItem.round)} (${pickItem.round}.${String(landedPick.draftSlot).padStart(2, "0")})`
        : pickItem.displayLabel;
    const landedManager = landedPick?.manager || null;
    const selectedByDifferentManager = Boolean(
      manager &&
        landedManager &&
        normalizeManagerKey(manager) !== normalizeManagerKey(landedManager)
    );
    const landedLabel = selectedByDifferentManager
      ? `Selected by ${landedManager}`
      : "Landed";

    return (
      <div key={key} className="trade-asset-block">
        <div
          className={`trade-asset ${wasFlipped ? "trade-asset-flipped" : ""}`}
          title={
            wasFlipped && pickItem.flipOutcome?.date
              ? `This pick was traded again on ${pickItem.flipOutcome.date}.`
              : undefined
          }
        >
          {wasFlipped && (
            <span className="trade-asset-flip-icon" aria-hidden="true">
              <XIcon size={14} strokeWidth={3} />
            </span>
          )}
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-orange-500/15 px-2 text-xs font-black text-orange-300">
            PICK
          </span>
          <span
            className="trade-asset-pick-label min-w-0 flex-1 truncate"
            title={pickItem.label}
          >
            {displayedPickLabel}
          </span>
          {displayedPickValue !== null && (
            <TradeValuePill title="Pick value at the time of the trade">
              {displayedPickValue.toLocaleString()}
            </TradeValuePill>
          )}
        </div>
        {wasFlipped ? (
          <div
            className="trade-asset-flip-return"
            title="Context only: original trade outcome keeps this pick at market value unless this manager made the selection."
          >
            <span className="trade-asset-flip-label">Later traded for</span>
            <div className="trade-asset-flip-assets">
              {flippedAssets.map((asset, assetIndex) =>
                renderTradeItem(asset, assetIndex, {
                  draftPicks,
                  playerDetailsById,
                  currentPositionRankById,
                  onPlayerClick,
                  manager,
                  managerAvatarUrl,
                  valueMode,
                })
              )}
            </div>
          </div>
        ) : (
          landedPick && (
            <div className="trade-asset-landed ml-2 mt-2 flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-950/45 px-3 py-2 text-xs text-slate-400 sm:ml-10">
              <span
                className="shrink-0 font-bold uppercase tracking-[0.12em] text-cyan-300/80"
                title={
                  selectedByDifferentManager
                    ? `This pick was later moved again and selected by ${landedManager}.`
                    : undefined
                }
              >
                {landedLabel}
              </span>
              {onPlayerClick ? (
                <button
                  type="button"
                  className="min-w-0 hover:text-orange-300"
                  onClick={event => {
                    event.stopPropagation();
                    onPlayerClick({
                      ...landedPick,
                      manager: landedPick.manager || manager,
                      managerAvatarUrl,
                      currentPositionRank:
                        landedPick.currentPositionRank ||
                        (landedPick.player_id
                          ? currentPositionRankById?.[landedPick.player_id]
                          : null),
                      playerDetails:
                        landedPick.playerDetails ||
                        (landedPick.player_id
                          ? playerDetailsById?.[landedPick.player_id]
                          : undefined),
                      valueMode: getTradeWarLeagueValueMode(valueMode),
                    });
                  }}
                >
                  <PlayerNameWithHeadshot
                    playerId={landedPick.player_id}
                    playerName={landedPick.playerName}
                    team={landedPick.playerDetails?.team}
                    position={landedPick.playerPos}
                  />
                </button>
              ) : (
                <PlayerNameWithHeadshot
                  playerId={landedPick.player_id}
                  playerName={landedPick.playerName}
                  team={landedPick.playerDetails?.team}
                  position={landedPick.playerPos}
                />
              )}
              <PositionRankPill
                rank={
                  landedPick.currentPositionRank ||
                  (landedPick.player_id
                    ? currentPositionRankById?.[landedPick.player_id]
                    : null) ||
                  landedPick.playerPos
                }
              />
              {landedValue !== null && (
                <span
                  className="text-slate-500"
                  title={
                    selectedByDifferentManager
                      ? "Drafted-player value is context only; pick market value drives this side of the ledger."
                      : "Landed player value used in the trade ledger total"
                  }
                >
                  {landedValue.toLocaleString()}
                </span>
              )}
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div key={key} className="flex items-center gap-2">
      <PlayerNameWithHeadshot playerName={trimmed} />
    </div>
  );
}

function getCommandPlayerValueLens(
  player: Pick<ManagerIntelPlayer, "seasonValue" | "value">
) {
  const hasSeasonValue =
    typeof player.seasonValue === "number" &&
    Number.isFinite(player.seasonValue) &&
    player.seasonValue > 0;
  return {
    label: hasSeasonValue ? "Season" : "Dynasty",
    value: hasSeasonValue ? Number(player.seasonValue) : player.value,
    className: hasSeasonValue
      ? "manager-command-season-value"
      : "manager-command-season-value manager-command-dynasty-value",
    kind: hasSeasonValue ? ("season" as const) : ("dynasty" as const),
  };
}

function getCommandPlayerDynastyLens(player: CommandPlayer) {
  const profile = player.playerDetails?.valueProfile;
  return {
    value:
      profile?.dynastyValue ?? profile?.balancedValue ?? player.value ?? null,
    rank:
      profile?.dynastyPositionRank ||
      profile?.balancedPositionRank ||
      player.currentPositionRank ||
      null,
  };
}

function getCommandPlayerSeasonLens(player: CommandPlayer) {
  const profile = player.playerDetails?.valueProfile;
  return {
    value:
      player.seasonValue ??
      profile?.seasonValue ??
      profile?.fantasyProsSeasonValue ??
      null,
    rank:
      player.seasonPositionRank ||
      profile?.seasonPositionRank ||
      profile?.fantasyProsPositionRank ||
      null,
  };
}

function getTaxiActionClassName(action?: string | null) {
  return (
    String(action || "default")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "default"
  );
}

function getTaxiDisplayAction(action?: string | null) {
  if (action === "Cuttable") return "Cuts";
  return action || undefined;
}

function getTaxiActionSortRank(action?: string | null) {
  switch (action) {
    case "Promote Now":
      return 0;
    case "Keep Parked":
      return 1;
    case "Trade Sweetener":
      return 2;
    case "Taxi Risk":
      return 3;
    case "Cuttable":
      return 4;
    default:
      return 5;
  }
}

function sortTaxiTriageItems(items: TaxiTriageItem[]) {
  return [...items].sort((a, b) => {
    const actionRank =
      getTaxiActionSortRank(a.taxiAction) - getTaxiActionSortRank(b.taxiAction);
    if (actionRank) return actionRank;

    return (
      (b.taxiScore || 0) - (a.taxiScore || 0) ||
      (b.seasonValue || b.value || 0) - (a.seasonValue || a.value || 0) ||
      a.name.localeCompare(b.name)
    );
  });
}

function splitTradeItems(items: string): string[] {
  return items
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function getTradeItemSignal(
  items: string,
  playerDetailsById?: PlayerDetailsById
) {
  const positions = new Set<string>();
  const positionValue: Partial<Record<"QB" | "RB" | "WR" | "TE", number>> = {};
  let hasPick = false;
  const playerNames: string[] = [];

  splitTradeItems(items).forEach(item => {
    const player = parseTradePlayerItem(item);
    if (player) {
      playerNames.push(player.playerName);
      const position = playerDetailsById?.[player.playerId]?.position;
      if (position && ["QB", "RB", "WR", "TE"].includes(position)) {
        const corePosition = position as "QB" | "RB" | "WR" | "TE";
        positions.add(corePosition);
        const value =
          getTradeLensNumber(player.tradeDateValue) ??
          getTradeLensNumber(player.value) ??
          0;
        positionValue[corePosition] =
          (positionValue[corePosition] || 0) + value;
      }
      return;
    }

    if (parseTradePickItem(item)) {
      hasPick = true;
    }
  });

  return { positions, positionValue, hasPick, playerNames };
}

function getTradePositionNet(
  incoming: ReturnType<typeof getTradeItemSignal>,
  outgoing: ReturnType<typeof getTradeItemSignal>,
  position: string | null | undefined
): number {
  if (!position || !["QB", "RB", "WR", "TE"].includes(position)) return 0;
  const key = position as "QB" | "RB" | "WR" | "TE";
  return (
    (incoming.positionValue[key] || 0) - (outgoing.positionValue[key] || 0)
  );
}

function getTradeContextForManager(
  row: ReportData["tradeHistory"][number],
  manager: string
) {
  if (row.team_a === manager) return row.team_a_context || null;
  if (row.team_b === manager) return row.team_b_context || null;
  return null;
}

function getTradePartnerManager(
  row: ReportData["tradeHistory"][number],
  manager: string
): string | null {
  if (row.team_a === manager) return row.team_b;
  if (row.team_b === manager) return row.team_a;
  return null;
}

function getTradeItemPlayerIds(items: string): Set<string> {
  const ids = new Set<string>();
  splitTradeItems(items).forEach(item => {
    const player = parseTradePlayerItem(item.trim());
    if (player?.playerId) ids.add(player.playerId);
  });
  return ids;
}

function getTradeItemTotalValue(
  items: string,
  mode: TradeWarMode,
  playerDetailsById?: PlayerDetailsById,
  draftPicks: DraftPick[] = []
): number {
  return getTradeLedgerItemValues(
    items,
    mode,
    playerDetailsById,
    draftPicks
  ).reduce((sum, value) => sum + value, 0);
}

function chooseTradeDateTarget({
  row,
  manager,
  need,
  outgoingItems,
  incomingItems,
  playerDetailsById,
}: {
  row: ReportData["tradeHistory"][number];
  manager: string;
  need: string | null;
  outgoingItems: string;
  incomingItems: string;
  playerDetailsById?: PlayerDetailsById;
}): ManagerIntelPlayer | null {
  if (!need) return null;

  const partner = getTradePartnerManager(row, manager);
  if (!partner) return null;

  const partnerContext = getTradeContextForManager(row, partner);
  const partnerPlayers =
    partnerContext?.source === "historical-roster"
      ? partnerContext.rosterPlayers || []
      : [];
  if (!partnerPlayers.length) return null;

  const tradedPlayerIds = new Set([
    ...Array.from(getTradeItemPlayerIds(incomingItems)),
    ...Array.from(getTradeItemPlayerIds(outgoingItems)),
  ]);
  const outgoingBudget = getTradeItemTotalValue(
    outgoingItems,
    "dynasty",
    playerDetailsById
  );
  const targetBudget = outgoingBudget > 0 ? outgoingBudget : null;

  return (
    partnerPlayers
      .filter(
        player =>
          player.pos === need &&
          player.value > 0 &&
          !tradedPlayerIds.has(player.player_id)
      )
      .sort((a, b) => {
        if (targetBudget) {
          const distanceA = Math.abs(a.value - targetBudget);
          const distanceB = Math.abs(b.value - targetBudget);
          if (distanceA !== distanceB) return distanceA - distanceB;
        }
        return b.value - a.value;
      })[0] || null
  );
}

type TradeFairnessSuggestion = {
  fromManager: string;
  toManager: string;
  gap: number;
  player: ManagerIntelPlayer;
  displayRank?: string | null;
  displayValue?: number | null;
};

function getFairnessPlayerValue(
  player: ManagerIntelPlayer,
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): number {
  if (leagueValueMode === "redraft") {
    const seasonValue = getTradeLensNumber(player.seasonValue);
    if (seasonValue !== null) return seasonValue;
  }
  return getTradeLensNumber(player.value) ?? 0;
}

function getFairnessPlayerRank(
  player: ManagerIntelPlayer,
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): string | null {
  if (leagueValueMode === "redraft") return null;
  return (
    player.currentPositionRank ||
    player.seasonPositionRank ||
    player.pos ||
    null
  );
}

function buildTradeFairnessSuggestion(
  row: ReportData["tradeHistory"][number],
  evaluation: TradeLedgerEvaluation,
  leagueValueMode: ReportData["leagueValueMode"] = "dynasty"
): TradeFairnessSuggestion | null {
  if (evaluation.winners.length !== 1 || evaluation.pointGap < 500) return null;

  const winner = evaluation.winners[0];
  const loser = winner === row.team_a ? row.team_b : row.team_a;
  const winnerContext = getTradeContextForManager(row, winner);
  if (
    winnerContext?.source !== "historical-roster" ||
    !winnerContext.rosterPlayers?.length
  )
    return null;

  const tradedPlayerIds = new Set([
    ...Array.from(getTradeItemPlayerIds(row.team_a_items)),
    ...Array.from(getTradeItemPlayerIds(row.team_b_items)),
  ]);
  const candidates = winnerContext.rosterPlayers
    .filter(
      player =>
        getFairnessPlayerValue(player, leagueValueMode) > 0 &&
        !tradedPlayerIds.has(player.player_id) &&
        (!player.owner ||
          normalizeManagerKey(player.owner) === normalizeManagerKey(winner))
    )
    .sort((a, b) => {
      const valueA = getFairnessPlayerValue(a, leagueValueMode);
      const valueB = getFairnessPlayerValue(b, leagueValueMode);
      const distanceA = Math.abs(valueA - evaluation.pointGap);
      const distanceB = Math.abs(valueB - evaluation.pointGap);
      if (distanceA !== distanceB) return distanceA - distanceB;
      return valueB - valueA;
    });
  const player =
    candidates.find(
      candidate =>
        getFairnessPlayerValue(candidate, leagueValueMode) <=
        evaluation.pointGap + 450
    ) ||
    candidates[0] ||
    null;
  if (!player) return null;

  return {
    fromManager: winner,
    toManager: loser,
    gap: evaluation.pointGap,
    player,
    displayRank: getFairnessPlayerRank(player, leagueValueMode),
    displayValue:
      leagueValueMode === "redraft"
        ? getFairnessPlayerValue(player, leagueValueMode)
        : null,
  };
}

function buildTradeFitReads(
  row: ReportData["tradeHistory"][number],
  managerRosterIntelligence?: ReportData["managerRosterIntelligence"],
  playerDetailsById?: PlayerDetailsById
): TradeFitRead[] {
  if (!managerRosterIntelligence?.length) return [];

  const intelByManager = new Map(
    managerRosterIntelligence.map(intel => [intel.manager, intel])
  );
  const sides = [
    {
      manager: row.team_a,
      incoming: row.team_a_items,
      outgoing: row.team_b_items,
    },
    {
      manager: row.team_b,
      incoming: row.team_b_items,
      outgoing: row.team_a_items,
    },
  ];

  const reads: TradeFitRead[] = [];

  sides.forEach(side => {
    const intel = intelByManager.get(side.manager);
    if (!intel) return;

    const incoming = getTradeItemSignal(side.incoming, playerDetailsById);
    const outgoing = getTradeItemSignal(side.outgoing, playerDetailsById);
    const need = intel.tradePlan?.needPosition || null;
    const surplus = intel.tradePlan?.surplusPosition || null;
    const boughtNeed = Boolean(need && incoming.positions.has(need));
    const soldSurplus = Boolean(surplus && outgoing.positions.has(surplus));
    const boughtSurplus = Boolean(surplus && incoming.positions.has(surplus));
    const soldNeed = Boolean(need && outgoing.positions.has(need));
    const needNet = getTradePositionNet(incoming, outgoing, need);
    const target = !boughtNeed
      ? chooseTradeDateTarget({
          row,
          manager: side.manager,
          need,
          outgoingItems: side.outgoing,
          incomingItems: side.incoming,
          playerDetailsById,
        })
      : null;
    const targetRank =
      target?.seasonPositionRank || target?.currentPositionRank || target?.pos;

    if (need && boughtNeed && soldNeed) {
      if (needNet >= 700) {
        reads.push({
          manager: side.manager,
          label: `${need} Upgrade`,
          tone: "good",
          note: `${side.manager} improved the ${need} room, but this was an upgrade, not a clean need solve, because ${need} value also went out.`,
        });
        return;
      }

      if (needNet <= -700) {
        reads.push({
          manager: side.manager,
          label: `${need} Step Back`,
          tone: "warn",
          note: `${side.manager} added a ${need}, but the outgoing ${need} value was stronger. The deal leans more like value extraction than a roster fix.`,
          target,
        });
        return;
      }

      reads.push({
        manager: side.manager,
        label: `${need} Shuffle`,
        tone: "neutral",
        note: `${side.manager} moved ${need} value both ways, so this does not materially change the roster's biggest positional pressure point.`,
        target,
      });
      return;
    }

    if (boughtNeed && soldSurplus) {
      reads.push({
        manager: side.manager,
        label: "Clean Fit",
        tone: "good",
        note: `This lines up with the roster map: added ${need} help while selling from the ${surplus} surplus.`,
      });
      return;
    }

    if (boughtNeed) {
      reads.push({
        manager: side.manager,
        label: `${need} Buy`,
        tone: "good",
        note: `${side.manager} added ${need} value without sending the same position back. That is a clearer positional fit than a same-room swap.`,
      });
      return;
    }

    if (soldNeed) {
      reads.push({
        manager: side.manager,
        label: "Roster Fit Problem",
        tone: "warn",
        note: `This deal moved value away from ${side.manager}'s biggest ${need} pressure point. The cleaner move was buying that position, not spending it.`,
        target,
      });
      return;
    }

    if (boughtSurplus && surplus) {
      reads.push({
        manager: side.manager,
        label: "More Of The Same",
        tone: "warn",
        note: `This adds more ${surplus} value to an area that already looked like the surplus. The roster would probably feel cleaner if that value chased ${need || "a weaker spot"}.`,
        target,
      });
      return;
    }

    if (incoming.hasPick && intel.timeline.toLowerCase().includes("rebuild")) {
      reads.push({
        manager: side.manager,
        label: "Timeline Match",
        tone: "good",
        note: `Getting picks fits the rebuild timeline. This is the kind of value that gives the roster more shots without forcing a short-term lineup decision.`,
      });
      return;
    }

    if (
      outgoing.hasPick &&
      intel.timeline.toLowerCase().includes("contender")
    ) {
      reads.push({
        manager: side.manager,
        label: "Contender Move",
        tone: "good",
        note: `Spending pick value can make sense for a contender if the player acquired starts right away or protects a fragile position.`,
      });
      return;
    }

    if (target) {
      reads.push({
        manager: side.manager,
        label: "Alternative Target",
        tone: "neutral",
        note: `${target.name}${targetRank ? ` (${targetRank})` : ""} was on the other roster at the time and lined up more directly with ${side.manager}'s stated need.`,
        target,
      });
      return;
    }

    reads.push({
      manager: side.manager,
      label: "Neutral Fit",
      tone: "neutral",
      note: `No obvious roster-fit issue. This reads more like a value bet than a clear positional fix.`,
    });
  });

  return reads;
}

function renderTradeOverviewImpact({
  manager,
  incomingItems,
  outgoingItems,
  intel,
  playerDetailsById,
}: {
  manager: string;
  incomingItems: string;
  outgoingItems: string;
  intel?: ManagerRosterIntelRows[number];
  playerDetailsById?: PlayerDetailsById;
}) {
  if (!intel) return null;

  const incoming = getTradeItemSignal(incomingItems, playerDetailsById);
  const outgoing = getTradeItemSignal(outgoingItems, playerDetailsById);
  const need = intel?.tradePlan?.needPosition || null;
  const surplus = intel?.tradePlan?.surplusPosition || null;
  const boughtNeed = Boolean(need && incoming.positions.has(need));
  const soldNeed = Boolean(need && outgoing.positions.has(need));
  const soldSurplus = Boolean(surplus && outgoing.positions.has(surplus));
  const boughtSurplus = Boolean(surplus && incoming.positions.has(surplus));
  const needNet = getTradePositionNet(incoming, outgoing, need);

  const impactPills: Array<{
    label: string;
    tone?: "neutral" | "good" | "warn" | "danger" | "info";
  }> = [];
  if (need) {
    const needLabel =
      boughtNeed && soldNeed
        ? needNet >= 700
          ? `Upgraded ${need}`
          : needNet <= -700
            ? `${need} Step Back`
            : `${need} Shuffle`
        : boughtNeed
          ? `Added ${need}`
          : `${need} Still Thin`;
    const needTone =
      boughtNeed && soldNeed
        ? needNet >= 700
          ? "good"
          : needNet <= -700
            ? "danger"
            : "neutral"
        : boughtNeed
          ? "good"
          : "warn";
    impactPills.push({
      label: needLabel,
      tone: needTone,
    });
  }
  if (surplus && soldSurplus)
    impactPills.push({ label: `Moved ${surplus} Surplus`, tone: "info" });
  if (need && soldNeed)
    impactPills.push({ label: `Spent ${need}`, tone: "danger" });
  if (surplus && boughtSurplus)
    impactPills.push({ label: `Added More ${surplus}`, tone: "warn" });

  const notes: string[] = [];
  if (need && boughtNeed && soldNeed) {
    if (needNet >= 700) {
      notes.push(
        `${manager} upgraded the ${need} room, but still spent from that same position group.`
      );
    } else if (needNet <= -700) {
      notes.push(
        `${manager} took a step back at ${need}; the extra value has to justify worsening the pressure point.`
      );
    } else {
      notes.push(
        `${manager} mostly shuffled ${need} value around instead of clearly fixing the need.`
      );
    }
  } else if (boughtNeed && soldSurplus) {
    notes.push(`${manager} converted ${surplus} depth into ${need} help.`);
  } else if (boughtNeed && need) {
    notes.push(
      `${manager} added ${need} help without sending the same position out.`
    );
  } else if (need) {
    notes.push(
      `${manager} still came out of this trade without solving ${need}.`
    );
  }
  if (soldNeed && need && !boughtNeed) {
    notes.push(`They also moved pieces from the same ${need} room.`);
  }
  if (!notes.length && intel?.holes.summary) {
    notes.push(intel.holes.summary);
  }

  if (impactPills.length === 0 && notes.length === 0) return null;

  return <TradeSideImpactRead pills={impactPills} notes={notes} />;
}

function titleCasePill(value: string): string {
  const acronyms = new Set(["QB", "RB", "WR", "TE", "SF", "PPR", "FA"]);
  return value.replace(/\w\S*/g, word => {
    const upper = word.toUpperCase();
    if (/^(QB|RB|WR|TE)\d+$/i.test(word)) return upper;
    if (acronyms.has(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function getPillToneClass(value: string): string {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("old") ||
    normalized.includes("risk") ||
    normalized.includes("weak") ||
    normalized.includes("behind") ||
    normalized.includes("thin") ||
    normalized.includes("fragile") ||
    normalized.includes("cuttable")
  ) {
    return "manager-intel-pill-danger";
  }
  if (
    normalized.includes("young") ||
    normalized.includes("contender") ||
    normalized.includes("win") ||
    normalized.includes("elite") ||
    normalized.includes("shark") ||
    normalized.includes("war chest") ||
    normalized.includes("final boss") ||
    normalized.includes("thanos") ||
    normalized.includes("heavyweight") ||
    normalized.includes("problem") ||
    normalized.includes("spoiler") ||
    normalized.includes("title threat") ||
    normalized.includes("playoff push") ||
    normalized.includes("no brakes")
  ) {
    return "manager-intel-pill-good";
  }
  if (
    normalized.includes("rebuild") ||
    normalized.includes("future") ||
    normalized.includes("youth") ||
    normalized.includes("draft mode")
  ) {
    return "manager-intel-pill-future";
  }
  return "manager-intel-pill-neutral";
}

function buildManagerSignalTags({
  identity,
  starterCount,
  powerScore,
  timeline,
  rosterHealthScore,
  avgAge,
  starterAvailability,
  holesSummary,
  tradeRow,
  pickRow,
  ageFlags = [],
}: {
  identity?: string | null;
  starterCount?: number | null;
  powerScore?: number | null;
  timeline?: OwnerTimelineRow | null;
  rosterHealthScore?: number | null;
  avgAge?: number | null;
  starterAvailability?: OwnerIntelRow["starterAvailability"] | null;
  holesSummary?: string | null;
  tradeRow?: OwnerTradeRow | null;
  pickRow?: OwnerPickRow | null;
  ageFlags?: string[];
}): Array<{
  label: string;
  tone: "neutral" | "good" | "warn" | "danger" | "future" | "elite";
}> {
  const contenders = timeline?.contenderScore ?? 0;
  const rebuild = timeline?.rebuildScore ?? 0;
  const agingRisk = timeline?.agingRisk ?? 0;
  const futurePickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  const tags: Array<{
    label: string;
    tone: "neutral" | "good" | "warn" | "danger" | "future" | "elite";
  }> = [];

  if (powerScore !== null && powerScore !== undefined && powerScore >= 90)
    tags.push({ label: `Thanos ${powerScore}`, tone: "elite" });
  else if (powerScore !== null && powerScore !== undefined && powerScore <= 48)
    tags.push({ label: `Needs Work ${powerScore}`, tone: "danger" });

  if (contenders >= 90 && contenders - rebuild >= 22)
    tags.push({ label: `Title Threat ${contenders}`, tone: "good" });
  else if (contenders >= 80 && contenders - rebuild >= 14)
    tags.push({ label: `Might Surprise ${contenders}`, tone: "good" });
  else if (contenders >= 70 && contenders - rebuild >= 4)
    tags.push({ label: `Could Steal It ${contenders}`, tone: "warn" });
  else if (rebuild >= 68 && rebuild - contenders >= 10)
    tags.push({ label: `Future Rich ${rebuild}`, tone: "future" });
  else if (contenders >= 70 && rebuild >= 52)
    tags.push({ label: "Fork In Road", tone: "warn" });

  if (
    identity &&
    !["Balanced", "Middle Build"].includes(titleCasePill(identity))
  ) {
    tags.push({
      label: titleCasePill(identity),
      tone: getPillToneClass(identity).includes("danger")
        ? "danger"
        : getPillToneClass(identity).includes("future")
          ? "future"
          : "neutral",
    });
  }
  if (starterCount !== null && starterCount !== undefined && starterCount >= 12)
    tags.push({ label: `${starterCount} Starters`, tone: "good" });
  if (starterCount !== null && starterCount !== undefined && starterCount <= 8)
    tags.push({ label: `${starterCount} Starters`, tone: "warn" });
  if (
    rosterHealthScore !== null &&
    rosterHealthScore !== undefined &&
    rosterHealthScore >= 82
  )
    tags.push({ label: `Durable ${rosterHealthScore}`, tone: "good" });
  if (
    rosterHealthScore !== null &&
    rosterHealthScore !== undefined &&
    rosterHealthScore <= 48
  )
    tags.push({ label: `Fragile ${rosterHealthScore}`, tone: "danger" });
  if (starterAvailability?.riskLevel === "high")
    tags.push({ label: "Injury Watch", tone: "danger" });
  if (avgAge !== null && avgAge !== undefined && avgAge >= 27.6)
    tags.push({ label: "Age Cliff Watch", tone: "danger" });
  if (avgAge !== null && avgAge !== undefined && avgAge <= 25)
    tags.push({ label: "Youth Core", tone: "future" });
  if (agingRisk >= 58)
    tags.push({ label: `Age Risk ${agingRisk}`, tone: "danger" });
  if (futurePickCount >= 17)
    tags.push({ label: "Pick War Chest", tone: "future" });
  if (futurePickCount <= 12 && futurePickCount > 0)
    tags.push({ label: "Pick Light", tone: "warn" });
  if (
    tradeRow &&
    tradeRow.tradeCount >= 5 &&
    tradeRow.profit >= 2500 &&
    tradeRow.winPct >= 60
  )
    tags.push({ label: "Trade Shark", tone: "good" });
  if (tradeRow && tradeRow.tradeCount >= 4 && tradeRow.profit <= -2500)
    tags.push({ label: "Trade Tax", tone: "danger" });
  const primaryNeed =
    holesSummary && holesSummary !== "No major roster hole flagged"
      ? holesSummary.split(",")[0]?.trim()
      : null;
  if (primaryNeed)
    tags.push({ label: titleCasePill(primaryNeed), tone: "warn" });
  ageFlags
    .filter(flag => /old|young|durable|availability/i.test(flag))
    .slice(0, 1)
    .forEach(flag =>
      tags.push({
        label: titleCasePill(flag),
        tone: getPillToneClass(flag).includes("danger")
          ? "danger"
          : getPillToneClass(flag).includes("future")
            ? "future"
            : "neutral",
      })
    );

  const seen = new Set<string>();
  return tags
    .filter(tag => {
      const key = tag.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 7);
}

function buildOwnerIntelTileTags({
  identity,
  powerRow,
  timeline,
  growthRow,
  starterAvailability,
  holesSummary,
  pickRow,
}: {
  identity?: string | null;
  powerRow?: OwnerPowerRow | null;
  timeline?: OwnerTimelineRow | null;
  growthRow?: OwnerGrowthRow | null;
  starterAvailability?: OwnerIntelRow["starterAvailability"] | null;
  holesSummary?: string | null;
  pickRow?: OwnerPickRow | null;
}): Array<{
  label: string;
  tone: "neutral" | "good" | "warn" | "danger" | "future";
}> {
  const tags: Array<{
    label: string;
    tone: "neutral" | "good" | "warn" | "danger" | "future";
  }> = [];

  if (powerRow) {
    tags.push({
      label: `#${powerRow.rank} ${getManagerProfileLabel(powerRow.tier, powerRow.score).label}`,
      tone:
        powerRow.score >= 78
          ? "good"
          : powerRow.score <= 50
            ? "danger"
            : "neutral",
    });
  }

  if (growthRow) {
    tags.push({
      label: `${growthRow.growth >= 0 ? "+" : ""}${growthRow.growth.toFixed(1)}% growth`,
      tone: growthRow.growth >= 0 ? "good" : "danger",
    });
  }

  const contenderScore = timeline?.contenderScore ?? 0;
  const rebuildScore = timeline?.rebuildScore ?? 0;
  if (contenderScore >= 84 && contenderScore - rebuildScore >= 18) {
    tags.push({ label: "Contender Window", tone: "good" });
  } else if (rebuildScore >= 68 && rebuildScore - contenderScore >= 10) {
    tags.push({ label: "Rebuild Window", tone: "future" });
  } else if (contenderScore >= 70 && rebuildScore >= 52) {
    tags.push({ label: "Fork In Road", tone: "warn" });
  } else if (identity) {
    const normalizedIdentity = titleCasePill(identity);
    if (!["Balanced", "Middle Build"].includes(normalizedIdentity)) {
      tags.push({
        label: normalizedIdentity,
        tone: getPillToneClass(identity).includes("danger")
          ? "danger"
          : getPillToneClass(identity).includes("future")
            ? "future"
            : "neutral",
      });
    }
  }

  const primaryNeed =
    holesSummary && holesSummary !== "No major roster hole flagged"
      ? holesSummary.split(",")[0]?.trim()
      : null;
  if (primaryNeed) {
    tags.push({ label: titleCasePill(primaryNeed), tone: "warn" });
  } else if (starterAvailability?.riskLevel === "high") {
    tags.push({ label: "Injury Watch", tone: "danger" });
  }

  const futurePickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  if (futurePickCount >= 17) {
    tags.push({ label: "Pick War Chest", tone: "future" });
  }

  const seen = new Set<string>();
  return tags
    .filter(tag => {
      const key = tag.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function normalizeIntelNote(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|with|for|and|or|to|of|in|if|it|is|this|that)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeIntelNotes(
  notes: Array<string | null | undefined>,
  suppress: Array<string | null | undefined> = []
) {
  const seen = new Set<string>();
  const suppressKeys = suppress
    .filter((note): note is string => Boolean(note))
    .map(normalizeIntelNote)
    .filter(Boolean);

  return notes
    .filter((note): note is string => Boolean(note))
    .filter(note => {
      const key = normalizeIntelNote(note);
      if (!key || seen.has(key)) return false;
      if (
        suppressKeys.some(
          suppressKey => suppressKey.includes(key) || key.includes(suppressKey)
        )
      )
        return false;
      seen.add(key);
      return true;
    });
}

function normalizeIntelPlayerName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function noteMentionsPlayerName(note: string, name: string): boolean {
  const normalizedName = normalizeIntelPlayerName(name);
  return (
    normalizedName.length >= 3 && note.toLowerCase().includes(normalizedName)
  );
}

function getDynastyTradeTrackedNames(row: OwnerIntelRow): string[] {
  const names = [
    row.buyTarget?.name,
    row.sellCandidate?.name,
    row.tradeChip?.name,
    row.oldestPlayer?.name,
  ].filter((name): name is string => Boolean(name));
  return Array.from(new Set(names.map(name => name.trim()).filter(Boolean)));
}

function filterByPlayerNameMentionBudget<T>(
  items: T[],
  getCopy: (item: T) => string,
  trackedNames: string[],
  seededCopies: string[] = [],
  maxMentions = 2
): T[] {
  if (!trackedNames.length) return items;

  const counts = new Map<string, number>();
  seededCopies.forEach(copy => {
    trackedNames.forEach(name => {
      if (copy && noteMentionsPlayerName(copy, name)) {
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    });
  });

  return items.filter(item => {
    const copy = getCopy(item);
    const mentionedNames = trackedNames.filter(name =>
      noteMentionsPlayerName(copy, name)
    );
    if (mentionedNames.some(name => (counts.get(name) || 0) >= maxMentions))
      return false;
    mentionedNames.forEach(name =>
      counts.set(name, (counts.get(name) || 0) + 1)
    );
    return true;
  });
}

type OwnerIntelRow = NonNullable<
  ReportData["managerRosterIntelligence"]
>[number];
type OwnerTradeRow = NonNullable<ReportData["tradeTendencies"]>[number];
type OwnerPickRow = NonNullable<ReportData["pickPortfolios"]>[number];
type OwnerTimelineRow = NonNullable<ReportData["dynastyTimelines"]>[number];
type OwnerPowerRow = NonNullable<ReportData["powerRankings"]>[number];
type OwnerGrowthRow = NonNullable<
  ReportData["managerRosterValueGrowth"]
>[number];
type OwnerNeedPosition = "QB" | "RB" | "WR" | "TE";
type OwnerSignalTone =
  | "neutral"
  | "dynasty"
  | "contender"
  | "rebuilder"
  | "good"
  | "contender-gold"
  | "warn"
  | "danger"
  | "future"
  | "elite"
  | "balanced"
  | "weak-contender"
  | "weak-rebuilder"
  | "squeak";
type DynastyAiTheme =
  | "trade"
  | "window"
  | "draft"
  | "churn"
  | "risk"
  | "upside"
  | "sell"
  | "core"
  | "neutral";
type OwnerSignalTag = { label: string; tone?: OwnerSignalTone };
type OwnerBuildLabel =
  | "Thanos"
  | "Heavyweight"
  | "Rich Fraud"
  | "Loaded Loser"
  | "Broke Flex"
  | "You Better Win"
  | "Might Surprise"
  | "Pick Hoarder"
  | "Felony Roster"
  | "No Future"
  | "Mid As Hell"
  | "Crown Me"
  | "Title Threat"
  | "Ring Ready"
  | "Could Be a Threat"
  | "Dangerous"
  | "Real Threat"
  | "One Move Away"
  | "Scares Me a Little"
  | "Could Steal It"
  | "Fake Tough"
  | "Upset Alert"
  | "Meh"
  | "Free Win"
  | "Future Rich"
  | "Future Menace"
  | "Future Stacked"
  | "Pick Rich"
  | "Growth"
  | "Cooking"
  | "Actually Building"
  | "Half Built"
  | "Still Cooking"
  | "All In"
  | "Time to Rebuild"
  | "Rebuilding"
  | "Work In Progress"
  | "Free Money"
  | "Sell Your Team"
  | "Try Harder"
  | "Playoff Push"
  | "Starter Need"
  | "Depth Build";
type OwnerScoreLens = {
  fullRosterScore: number | null;
  dynastyScore: number | null;
  contenderScore: number | null;
  rebuilderScore: number | null;
  buildLabel: OwnerBuildLabel;
  buildTone: OwnerSignalTone;
};
type OwnerIntelSortMode = "dynasty" | "contender" | "rebuilder";
type DynastyAiSuggestion = {
  title: string;
  copy: string;
  tone: OwnerSignalTone;
  theme?: DynastyAiTheme;
  wide?: boolean;
};

const AI_RECOMMENDATION_BADGE_LABEL = "AI TARGET";
const AI_RECOMMENDATION_BANNER_LABEL = "AI PICKUP SIGNAL";

function getAITronThemeForDynastySurface(
  theme: DynastyAiTheme = "neutral"
): AITronTheme {
  switch (theme) {
    case "core":
    case "upside":
      return "green";
    case "draft":
    case "risk":
      return "amber";
    case "sell":
      return "red";
    case "trade":
    case "window":
      return "blue";
    case "churn":
    case "neutral":
    default:
      return "cyan";
  }
}

const STARTING_ROSTER_STRENGTH_TITLE = "Starting Lineup Slot Ranks";
const STARTING_ROSTER_STRENGTH_COMPARISON =
  "league rank by required lineup slot";
const STARTING_ROSTER_STRENGTH_NOTE =
  "Ranks this manager’s submitted Sleeper starters when returned, otherwise the slot-aware projected lineup, against every roster using this league’s actual required slots. QB/SF includes the superflex QB path; K and DEF appear only when the league starts them.";
const BENCH_BASELINE_NOTE =
  "Compares the best non-starting QB, RB, WR, and TE using season value and season position rank after the submitted or projected starters are removed.";
const TRADEABLE_DEPTH_NOTE =
  "Shows active bench trade chips by season value and season rank only. Taxi and IR players are left out.";

type TradeWarMode =
  | "dynasty"
  | "contender"
  | "rebuilder"
  | "starter-upgrade"
  | "depth-fix"
  | "positional-need"
  | "playoff-push"
  | "waiver-leverage";
type TradeFitRead = {
  manager: string;
  label: string;
  note: string;
  tone: "good" | "warn" | "neutral";
  target?: ManagerIntelPlayer | null;
};

function formatSignedCompactValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${value > 0 ? "+" : ""}${formatCompactValue(value)}`;
}

function buildOwnerBestMove(row: OwnerIntelRow): string {
  const need = row.tradePlan?.needPosition;
  const surplus = row.tradePlan?.surplusPosition;
  const buyName = row.buyTarget?.name;
  const sellName = row.sellCandidate?.name || row.tradeChip?.name;
  const sellValue = row.sellCandidate?.value || row.tradeChip?.value || 0;
  const buyValue = row.buyTarget?.value || 0;
  const targetValueGapIsTooWide =
    sellValue > 0 && buyValue > sellValue * 1.35 + 250;
  const buildLens = /rebuild/i.test(row.timeline || row.identity)
    ? "rebuild timeline"
    : /contend|win/i.test(row.timeline || row.identity)
      ? "contender lineup"
      : "team window";

  if (need && surplus && buyName && sellName) {
    if (targetValueGapIsTooWide) {
      return `${sellName} should not be priced as a one-for-one for ${buyName}. Either package him with added value for ${need} help, or shop him for a similar-value ${need} who fits this ${buildLens}.`;
    }

    return `Shop ${surplus} surplus (${sellName}) for similar-value ${need} help like ${buyName}. That is the cleanest way to turn excess roster value into a lineup fix.`;
  }

  if (need && buyName) {
    return `The clearest add is ${need} help. Start with players in the same value band as the movable bench pieces; only chase ${buyName} if picks or a package make the price realistic.`;
  }

  if (surplus && sellName) {
    return `This roster has extra ${surplus} value. ${sellName} is the easiest trade chip if another manager overpays.`;
  }

  if (row.tradePlan?.summary) return row.tradePlan.summary;

  return "No forced trade path. This roster should wait for another manager to pay above market instead of creating a move just to move.";
}

function buildOwnerWindowCopy(
  row: OwnerIntelRow,
  timelineRow: OwnerTimelineRow | null | undefined
): string {
  if (!timelineRow) {
    return `${titleCasePill(row.identity)} build. The model does not have enough timeline data to call a clean contender or rebuild lane yet.`;
  }

  const contenderScore = timelineRow.contenderScore;
  const rebuildScore = timelineRow.rebuildScore;
  const agingRisk = timelineRow.agingRisk;

  if (contenderScore >= 75 && contenderScore >= rebuildScore + 12) {
    return `Win-now lean. Contender score ${contenderScore}/100, rebuild score ${rebuildScore}/100, aging risk ${agingRisk}/100. This team should protect weekly starters and buy injury insurance before chasing long-term value.`;
  }

  if (rebuildScore >= contenderScore + 10) {
    return `Rebuild lean. Rebuild score ${rebuildScore}/100 beats contender score ${contenderScore}/100. Move older short-window points for younger assets, picks, or players rising in dynasty value.`;
  }

  return `Middle-build profile. Contender score ${contenderScore}/100 and rebuild score ${rebuildScore}/100 are close enough that this team should avoid all-in trades unless the upgrade clearly changes the lineup.`;
}

function buildOwnerShapeCopy(row: OwnerIntelRow): string {
  const starterShare = Math.round(row.starterValuePct);
  const ageCopy =
    row.avgAge !== null
      ? `Average roster age is ${row.avgAge}.`
      : "Age profile is still incomplete.";
  const benchCopy = row.bestBenchStash
    ? `${row.bestBenchStash.name} is the best bench leverage piece.`
    : "There is no obvious bench leverage piece yet.";
  const depthCopy =
    starterShare >= 58
      ? `${starterShare}% of value sits in starters, so this team is built to score now.`
      : starterShare <= 45
        ? `${starterShare}% of value sits in starters, so too much value may be parked outside the weekly lineup.`
        : `${starterShare}% of value sits in starters, which is a balanced roster shape.`;

  return `${titleCasePill(row.identity)} profile. ${depthCopy} ${ageCopy} ${benchCopy}`;
}

function buildOwnerTradeDraftProfile(
  tradeRow: OwnerTradeRow | null | undefined,
  pickRow: OwnerPickRow | null | undefined
): string {
  const parts = [
    tradeRow ? `${tradeRow.tradeCount} trades` : null,
    tradeRow ? `${tradeRow.winPct}% win rate` : null,
    tradeRow ? `${formatSignedCompactValue(tradeRow.profit)} net profit` : null,
    tradeRow?.favoritePartner
      ? `favorite partner: ${tradeRow.favoritePartner}`
      : null,
    pickRow ? `${pickRow.count2026 + pickRow.count2027} future picks` : null,
    pickRow ? `${formatCompactValue(pickRow.totalValue)} draft capital` : null,
  ].filter(Boolean);

  return parts.length
    ? `${parts.join(" • ")}.`
    : "No trade or draft-capital profile yet.";
}

function buildOwnerHealthCopy(row: OwnerIntelRow): string {
  const missed = row.starterAvailability.avgGamesMissed;
  const risk = titleCasePill(row.starterAvailability.riskLevel);
  const healthScore =
    row.rosterHealthScore !== null && row.rosterHealthScore !== undefined
      ? `Health score ${row.rosterHealthScore}/100`
      : "Health score unavailable";
  const riskiest = row.starterAvailability.riskiestStarter?.name;
  const insurance = row.injuryInsurance
    ? `Best internal cover is ${row.injuryInsurance.name} (${row.injuryInsurance.currentPositionRank || row.injuryInsurance.seasonPositionRank || row.injuryInsurance.pos}).`
    : "No clear internal insurance piece stands out.";
  const depthCoverCount = [
    ...(row.benchPlayers || []),
    ...(row.reservePlayers || []),
  ].filter(
    player =>
      ["RB", "WR", "TE"].includes(player.pos) &&
      (player.seasonValue || player.value) >= 900
  ).length;
  const depthCopy = `${depthCoverCount} bench/reserve skill player${depthCoverCount === 1 ? "" : "s"} clear useful depth value.`;

  if (missed === null || missed === undefined) {
    return `${healthScore}. Availability sample is still thin, so lean more on current role, depth value, and roster age. ${insurance}`;
  }

  if (missed >= 3) {
    return `${healthScore}. ${risk} availability risk: starters averaged ${missed} missed games. ${riskiest ? `${riskiest} is the biggest risk flag.` : "Bench insurance should matter more than luxury depth."} ${insurance} ${depthCopy}`;
  }

  if (missed >= 1.5) {
    return `${healthScore}. ${risk} availability risk: starters averaged ${missed} missed games. ${riskiest ? `${riskiest} is the player to insure around.` : "This roster should keep one extra usable spot starter."} ${insurance} ${depthCopy}`;
  }

  return `${healthScore}. ${risk} availability risk: starters averaged ${missed} missed games, so this roster can be more aggressive consolidating depth. ${insurance} ${depthCopy}`;
}

function buildOwnerWeakSpotCopy(row: OwnerIntelRow): string {
  if (row.benchBaseline?.length) {
    const weakBench = [...row.benchBaseline]
      .filter(tile => tile.leagueRank !== null)
      .sort((a, b) => (b.leagueRank || 0) - (a.leagueRank || 0))[0];
    const bestBench = [...row.benchBaseline]
      .filter(tile => tile.leagueRank !== null)
      .sort((a, b) => (a.leagueRank || 99) - (b.leagueRank || 99))[0];

    if (
      weakBench &&
      weakBench.leagueRank &&
      ["Playable", "Problem"].includes(weakBench.grade)
    ) {
      return `${weakBench.label} is the softest bench lane. ${weakBench.player ? `${weakBench.player.name} is the first option there` : "There is no clear player there"}, and that depth ranks #${weakBench.leagueRank} in this league.`;
    }

    if (bestBench?.player) {
      return `The bench baseline is usable. ${bestBench.player.name} is the cleanest next-man-up profile, and ${bestBench.label} ranks #${bestBench.leagueRank} in this league.`;
    }

    return "The bench baseline is thin because there are not enough ranked non-starters to compare cleanly.";
  }

  const qbRank = parsePositionRankValue(row.holes.bestQbRank);
  const rb2Rank = parsePositionRankValue(row.holes.rb2Rank);
  const wr3Rank = parsePositionRankValue(row.holes.wr3Rank);
  const teRank = parsePositionRankValue(row.holes.te1Rank);
  const notes = [
    qbRank !== null && qbRank > 18
      ? `QB is led by ${row.holes.bestQbRank}, so superflex depth is the first place to compare against the league.`
      : null,
    rb2Rank !== null && rb2Rank > 28
      ? `RB2 sits at ${row.holes.rb2Rank}, below the comfort line for a weekly contender.`
      : null,
    wr3Rank !== null && wr3Rank > 36
      ? `WR3 sits at ${row.holes.wr3Rank}, so receiver depth is thinner than the top name suggests.`
      : null,
    teRank !== null && teRank > 14
      ? `TE is led by ${row.holes.te1Rank}, which can cap weekly ceiling.`
      : null,
    row.holes.flexDepth <= 5
      ? `Flex depth is ${row.holes.flexDepth}, so the bench cushion is limited.`
      : null,
  ].filter(Boolean);

  if (notes.length) return notes.join(" ");

  return "The required starter spots are all in a playable range, so there is no obvious position to attack. The better angle is manager preference, timing, or offering a clear upgrade instead of treating this roster like it has a glaring hole.";
}

function buildDynastyOwnerTags({
  row,
  overviewRow,
  growthRow,
  pickRow,
  allGrowthRows = [],
  allPickRows = [],
  leagueSize = 0,
}: {
  row: OwnerIntelRow;
  overviewRow?: LeagueOverviewRows[number] | null;
  growthRow?: OwnerGrowthRow | null;
  pickRow?: OwnerPickRow | null;
  allGrowthRows?: OwnerGrowthRow[];
  allPickRows?: OwnerPickRow[];
  leagueSize?: number;
}): OwnerSignalTag[] {
  const tags: Array<OwnerSignalTag | null> = [
    buildOwnerValueTag(overviewRow, leagueSize),
    buildOwnerPickTag(pickRow, allPickRows),
    buildOwnerGrowthTag(growthRow, allGrowthRows),
    buildOwnerRosterShapeTag(row, overviewRow, leagueSize),
    ...row.ageFlags
      .filter(flag => !/availability|durable/i.test(flag))
      .slice(0, 2)
      .map(flag => ({
        label: titleCasePill(flag),
        tone:
          flag.toLowerCase().includes("old") ||
          flag.toLowerCase().includes("aging")
            ? ("danger" as const)
            : ("future" as const),
      })),
  ];

  const seen = new Set<string>();
  return tags
    .filter((tag): tag is OwnerSignalTag => Boolean(tag))
    .filter(tag => {
      const key = tag.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function buildOwnerValueTag(
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): OwnerSignalTag | null {
  if (!overviewRow) return null;
  const rank = overviewRow.rank_value;
  const bottomCutoff = leagueSize > 0 ? Math.max(leagueSize - 1, 8) : 8;

  if (rank <= 3) return { label: `Elite Value #${rank}`, tone: "good" };
  if (rank >= bottomCutoff)
    return { label: `Value #${rank}`, tone: "warn" };
  return { label: `Value #${rank}`, tone: "neutral" };
}

function getFuturePickCount(pickRow?: OwnerPickRow | null): number {
  return (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
}

function averageFinite(values: number[]): number {
  const finite = values.filter(value => Number.isFinite(value));
  if (!finite.length) return 0;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function rankScoreWithinLeague<T>(
  rows: T[],
  target: T | null | undefined,
  getScore: (row: T) => number | null | undefined,
  direction: "asc" | "desc" = "desc"
): number | null {
  if (!target) return null;
  const targetScore = getScore(target);
  if (
    targetScore === null ||
    targetScore === undefined ||
    !Number.isFinite(targetScore)
  )
    return null;
  const scores = rows
    .map(getScore)
    .filter(
      (score): score is number =>
        score !== null && score !== undefined && Number.isFinite(score)
    );
  if (!scores.length) return null;
  const betterScores = scores.filter(score =>
    direction === "desc" ? score > targetScore : score < targetScore
  );
  return betterScores.length + 1;
}

function getLeagueSignalWindow(rowCount: number): number {
  return Math.max(1, Math.ceil(rowCount * 0.2));
}

function buildOwnerPickTag(
  pickRow?: OwnerPickRow | null,
  allPickRows: OwnerPickRow[] = []
): OwnerSignalTag | null {
  if (!pickRow || !allPickRows.length) return null;

  const pickCount = getFuturePickCount(pickRow);
  const pickCounts = allPickRows.map(getFuturePickCount);
  const pickValues = allPickRows.map(row => row.totalValue || 0);
  const acquiredCounts = allPickRows.map(row => row.acquiredPicks || 0);
  const averagePickCount = averageFinite(pickCounts);
  const averagePickValue = averageFinite(pickValues);
  const averageAcquired = averageFinite(acquiredCounts);
  const valueRank = rankScoreWithinLeague(
    allPickRows,
    pickRow,
    row => row.totalValue || 0
  );
  const countRank = rankScoreWithinLeague(
    allPickRows,
    pickRow,
    getFuturePickCount
  );
  const acquiredRank = rankScoreWithinLeague(
    allPickRows,
    pickRow,
    row => row.acquiredPicks || 0
  );
  const topWindow = getLeagueSignalWindow(allPickRows.length);
  const bottomWindowStart = Math.max(1, allPickRows.length - topWindow + 1);
  const clearlyAboveLeague =
    pickCount >= averagePickCount + 2 ||
    (pickRow.totalValue || 0) >= averagePickValue * 1.18 ||
    (pickRow.acquiredPicks || 0) >= Math.max(2, averageAcquired + 1);
  const clearlyBelowLeague =
    pickCount <= averagePickCount - 2 ||
    (pickRow.totalValue || 0) <= averagePickValue * 0.82;

  if (valueRank !== null && valueRank <= topWindow && clearlyAboveLeague) {
    return { label: `Pick War Chest #${valueRank}`, tone: "future" };
  }

  if (countRank !== null && countRank <= topWindow && clearlyAboveLeague) {
    return { label: `${pickCount} Future Picks`, tone: "future" };
  }

  if (
    acquiredRank !== null &&
    acquiredRank <= topWindow &&
    (pickRow.acquiredPicks || 0) >= Math.max(2, averageAcquired + 1)
  ) {
    return { label: `${pickRow.acquiredPicks} Extra Picks`, tone: "future" };
  }

  if (
    valueRank !== null &&
    valueRank >= bottomWindowStart &&
    clearlyBelowLeague
  ) {
    return { label: `Pick Light #${valueRank}`, tone: "warn" };
  }

  return null;
}

function buildOwnerGrowthTag(
  growthRow?: OwnerGrowthRow | null,
  allGrowthRows: OwnerGrowthRow[] = []
): OwnerSignalTag | null {
  if (!growthRow || !allGrowthRows.length) return null;
  const rank = rankScoreWithinLeague(
    allGrowthRows,
    growthRow,
    row => row.growth
  );
  const topWindow = getLeagueSignalWindow(allGrowthRows.length);
  const bottomWindowStart = Math.max(1, allGrowthRows.length - topWindow + 1);
  const averageGrowth = averageFinite(allGrowthRows.map(row => row.growth));
  const growthCopy = `${growthRow.growth >= 0 ? "+" : ""}${growthRow.growth.toFixed(1)}%`;

  if (
    rank !== null &&
    rank <= topWindow &&
    growthRow.growth >= Math.max(5, averageGrowth + 2)
  ) {
    return { label: `Growth ${growthCopy}`, tone: "good" };
  }

  if (
    rank !== null &&
    rank >= bottomWindowStart &&
    growthRow.growth <= Math.min(-2, averageGrowth - 2)
  ) {
    return { label: `Value Slide ${growthCopy}`, tone: "danger" };
  }

  return null;
}

function getOwnerPositionRank(
  overviewRow: LeagueOverviewRows[number] | null | undefined,
  position?: string | null
): number | null {
  if (!overviewRow || !position) return null;
  if (position === "QB") return overviewRow.rank_qb ?? null;
  if (position === "RB") return overviewRow.rank_rb ?? null;
  if (position === "WR") return overviewRow.rank_wr ?? null;
  if (position === "TE") return overviewRow.rank_te ?? null;
  return null;
}

function isOwnerNeedPosition(
  position?: string | null
): position is OwnerNeedPosition {
  return (
    position === "QB" ||
    position === "RB" ||
    position === "WR" ||
    position === "TE"
  );
}

function getOwnerSlotGrade(
  row: OwnerIntelRow,
  position?: string | null
): string {
  if (!position) return "";
  const slotKey = position === "QB" ? "QB_SF" : position;
  const slotGrade = row.startingRosterStrength?.find(
    slot => slot.key === slotKey
  )?.grade;
  return (
    slotGrade ||
    row.positionGrades?.[position as "QB" | "RB" | "WR" | "TE"]?.grade ||
    ""
  );
}

function getOwnerPositionGrade(
  row: OwnerIntelRow,
  position?: string | null
): string {
  if (!isOwnerNeedPosition(position)) return "";
  return row.positionGrades?.[position]?.grade || "";
}

function getOwnerRosterPositionCount(
  row: OwnerIntelRow,
  position: OwnerNeedPosition
): number {
  return (
    row.rosterPlayers?.filter(player => player.pos === position).length || 0
  );
}

function hasOwnerPositionDepthCover(
  row: OwnerIntelRow,
  position?: string | null
): boolean {
  if (position !== "WR" && position !== "RB") return false;

  const positionGrade = getOwnerPositionGrade(row, position).toLowerCase();
  const tradePlanCopy = row.tradePlan?.summary?.toLowerCase() || "";
  const hasTradeableDepth = Boolean(
    row.tradeableDepth?.some(tile => tile.position === position && tile.player)
  );
  const rosterCount = getOwnerRosterPositionCount(row, position);
  const depthCountThreshold = position === "WR" ? 7 : 6;

  return (
    row.holes.flexDepth >= 8 &&
    (/elite|strong/.test(positionGrade) ||
      hasTradeableDepth ||
      rosterCount >= depthCountThreshold ||
      new RegExp(
        `\\b${position}\\b.*\\b(surplus|depth)\\b|\\b(surplus|depth)\\b.*\\b${position}\\b`,
        "i"
      ).test(tradePlanCopy))
  );
}

function isOwnerCredibleNeed(
  row: OwnerIntelRow,
  position?: string | null,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): boolean {
  if (!position) return false;
  const slotGrade = getOwnerSlotGrade(row, position).toLowerCase();
  const positionGrade = getOwnerPositionGrade(row, position).toLowerCase();
  const grade = `${slotGrade} ${positionGrade}`.trim();
  const summary = row.holes?.summary || "";
  const hasExplicitHole = new RegExp(`\\b${position}\\b`, "i").test(summary);
  const positionRank = getOwnerPositionRank(overviewRow, position);
  const bottomWindowStart =
    leagueSize > 0 ? Math.max(1, Math.floor(leagueSize * 0.7)) : 8;
  const isBottomRoom =
    positionRank !== null && positionRank >= bottomWindowStart;
  const hasDepthCover = hasOwnerPositionDepthCover(row, position);
  const hasWeakPositionGrade = /problem|weak/i.test(positionGrade);
  const hasWeakStarterGrade = /problem|weak/i.test(slotGrade);

  if (hasDepthCover && !hasWeakPositionGrade) return false;
  if (/elite|strong/i.test(grade) && !hasExplicitHole && !isBottomRoom)
    return false;
  if (hasWeakPositionGrade || (hasWeakStarterGrade && !hasDepthCover))
    return true;
  if (hasExplicitHole && !/elite|strong/i.test(grade)) return true;
  if (hasExplicitHole && isBottomRoom && !hasDepthCover) return true;
  return isBottomRoom && /playable/i.test(grade) && !hasDepthCover;
}

function getOwnerEffectiveNeedPosition(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): string | null {
  const plannedNeed = row.tradePlan?.needPosition || null;
  if (isOwnerCredibleNeed(row, plannedNeed, overviewRow, leagueSize))
    return plannedNeed;

  const fallbackNeeds = (["QB", "RB", "WR", "TE"] as const)
    .filter(position =>
      isOwnerCredibleNeed(row, position, overviewRow, leagueSize)
    )
    .sort(
      (a, b) =>
        (getOwnerPositionRank(overviewRow, b) || 0) -
        (getOwnerPositionRank(overviewRow, a) || 0)
    );

  return fallbackNeeds[0] || null;
}

function buildOwnerRosterShapeTag(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): OwnerSignalTag | null {
  const surplus = row.tradePlan?.surplusPosition;
  const effectiveNeed = getOwnerEffectiveNeedPosition(
    row,
    overviewRow,
    leagueSize
  );

  if (effectiveNeed) return { label: `Needs ${effectiveNeed}`, tone: "warn" };
  if (surplus) return { label: `${surplus} Surplus`, tone: "good" };
  if (row.starterAvailability?.riskLevel === "high")
    return { label: "Injury Watch", tone: "danger" };
  return null;
}

function toOwnerScore(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function formatOwnerScore(value?: number | null): string {
  const score = toOwnerScore(value);
  return score === null ? "-" : String(score);
}

function normalizeOwnerValueScore(
  value?: number | null,
  maxValue = 0
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || maxValue <= 0)
    return null;
  return Math.round(Math.max(0, Math.min(100, (value / maxValue) * 100)));
}

function isOwnerRebuildLane(label?: string | null): boolean {
  return Boolean(
    label &&
      /rebuild|draft mode|future rich|future menace|future stacked|pick rich|pick hoarder|pick stash|growth rocket|cooking|actually building|half built|time to rebuild|work in progress|lunch money/i.test(label)
  );
}

function isOwnerStrongRebuildLane(label?: string | null): boolean {
  return Boolean(
    label &&
      /strong rebuild|future rich|future menace|future stacked|pick rich|pick hoarder|pick stash|growth rocket|draft mode/i.test(
        label.toLowerCase()
      )
  );
}

function isOwnerContenderLane(label?: string | null): boolean {
  return Boolean(
    label &&
      /contender|final boss|thanos|heavyweight|rich fraud|loaded loser|you better win|crown me|all in|ring ready|one move away|scares me|could steal it|fake tough|dangerous|upset alert|problem|spoiler|title threat|playoff push|wild card/i.test(label)
  );
}

function isOwnerStrongContenderLane(label?: string | null): boolean {
  return Boolean(
    label &&
      /strong contender|final boss|thanos|heavyweight|crown me|all in|title threat|you better win/i.test(
        label.toLowerCase()
      )
  );
}

function getOwnerTeamTypeLabel({
  row,
  timelineRow,
  powerRow,
  overviewRow,
  leagueSize = 0,
  dynastyScore,
}: {
  row: OwnerIntelRow;
  timelineRow?: OwnerTimelineRow | null;
  powerRow?: OwnerPowerRow | null;
  overviewRow?: LeagueOverviewRows[number] | null;
  leagueSize?: number;
  dynastyScore?: number | null;
}): OwnerBuildLabel {
  return getManagerProfileLabel(powerRow?.tier, powerRow?.score, {
    powerRow,
    timelineRow,
    managerRow: row,
    overviewRow,
    dynastyScore,
    leagueSize,
  }).label as OwnerBuildLabel;
}

function getOwnerTeamTypeTone(label: string): OwnerSignalTone {
  if (/final boss|thanos/i.test(label)) return "elite";
  if (/crown me/i.test(label)) return "contender-gold";
  if (/heavyweight|rich fraud|loaded loser|you better win|ring ready|real threat|one move away|all in|title threat|playoff/i.test(label)) return "good";
  if (/might surprise|scares me|could steal it|fake tough|broke flex|upset alert|spoiler|wild card|dangerous|problem/i.test(label)) return "weak-contender";
  if (/starter need/i.test(label)) return "weak-contender";
  if (/meh|mid as hell|middle child|balanced|depth build/i.test(label))
    return "balanced";
  if (/future rich|future menace|future stacked|pick rich|pick hoarder|pick stash|growth rocket|rebuilding|draft mode/i.test(label))
    return "future";
  if (/actually building|cooking|half built|time to rebuild|still cooking|work in progress/i.test(label))
    return "weak-rebuilder";
  if (/all in/i.test(label)) return "good";
  if (/free money|free win|sell your team|felony roster|no future|try harder|lunch money/i.test(label))
    return "squeak";
  return isOwnerRebuildLane(label) ? "future" : "good";
}

function getOwnerTeamTypeToneForMode(
  label: string,
  sortMode: OwnerIntelSortMode
): OwnerSignalTone {
  if (/thanos/i.test(label)) return "elite";
  if (sortMode === "dynasty") return "dynasty";
  if (sortMode === "contender") {
    return /crown me/i.test(label) ? "contender-gold" : "contender";
  }
  return "rebuilder";
}

function buildOwnerScoreLens({
  row,
  timelineRow,
  powerRow,
  overviewRow,
  growthRow,
  maxGrowthValue,
  leagueSize = 0,
  sortMode = "dynasty",
}: {
  row: OwnerIntelRow;
  timelineRow?: OwnerTimelineRow | null;
  powerRow?: OwnerPowerRow | null;
  overviewRow?: LeagueOverviewRows[number] | null;
  growthRow?: OwnerGrowthRow | null;
  maxGrowthValue: number;
  leagueSize?: number;
  sortMode?: OwnerIntelSortMode;
}): OwnerScoreLens {
  const fullRosterScore = toOwnerScore(powerRow?.score);
  const dynastyScore =
    toOwnerScore(powerRow?.rosterValue) ??
    normalizeOwnerValueScore(growthRow?.total_val, maxGrowthValue);
  const contenderScore = toOwnerScore(timelineRow?.contenderScore);
  const rebuilderScore = toOwnerScore(timelineRow?.rebuildScore);
  const fallbackBuildLabel = getOwnerTeamTypeLabel({
    row,
    timelineRow,
    powerRow,
    overviewRow,
    leagueSize,
    dynastyScore,
  });
  const activeScore =
    sortMode === "contender"
      ? contenderScore
      : sortMode === "rebuilder"
        ? rebuilderScore
        : dynastyScore;
  const buildLabel = getOwnerIntelProfileLabel(
    sortMode,
    activeScore,
    fallbackBuildLabel,
    {
      dynastyScore,
      contenderScore,
      rebuilderScore,
    }
  ).label as OwnerBuildLabel;

  return {
    fullRosterScore,
    dynastyScore,
    contenderScore,
    rebuilderScore,
    buildLabel,
    buildTone: getOwnerTeamTypeToneForMode(buildLabel, sortMode),
  };
}

function OwnerScoreStrip({
  scores,
  compact = false,
  leagueValueMode = "dynasty",
}: {
  scores: OwnerScoreLens;
  compact?: boolean;
  leagueValueMode?: LeagueValueMode;
}) {
  const isRedraft = leagueValueMode === "redraft";
  const renderLabel = (fullLabel: string, shortLabel: string) => (
    <strong>
      <span className="owner-intel-score-label-full">{fullLabel}</span>
      <span className="owner-intel-score-label-short">{shortLabel}</span>
    </strong>
  );

  return (
    <span
      className={`owner-intel-score-strip${compact ? " owner-intel-score-strip-compact" : ""}`}
      aria-label="Manager score lenses"
    >
      <span>
        {renderLabel("Roster", "Full")}
        <em>{formatOwnerScore(scores.fullRosterScore)}</em>
      </span>
      <span>
        {renderLabel(
          isRedraft ? "Current" : "Dynasty",
          isRedraft ? "Cur" : "Dyn"
        )}
        <em>{formatOwnerScore(scores.dynastyScore)}</em>
      </span>
      <span>
        {renderLabel(
          isRedraft ? "Starters" : "Contend",
          isRedraft ? "St" : "Cnt"
        )}
        <em>{formatOwnerScore(scores.contenderScore)}</em>
      </span>
      <span>
        {renderLabel(
          isRedraft ? "Bench" : "Rebuild",
          isRedraft ? "Bn" : "Reb"
        )}
        <em>{formatOwnerScore(scores.rebuilderScore)}</em>
      </span>
    </span>
  );
}

function buildRedraftOwnerProfileLabel(
  row: OwnerIntelRow,
  powerRow?: OwnerPowerRow | null,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): OwnerBuildLabel {
  const starterRank = powerRow?.starterStrength ?? 0;
  const valueRank = overviewRow?.rank_value ?? leagueSize;
  if (
    starterRank >= 78 ||
    valueRank <= Math.max(1, Math.ceil(leagueSize * 0.3))
  )
    return "Playoff Push";
  if (
    row.pressurePoints?.length ||
    row.holes.summary !== "No major roster hole flagged"
  )
    return "Starter Need";
  return "Depth Build";
}

function buildRedraftOwnerTags({
  row,
  overviewRow,
}: {
  row: OwnerIntelRow;
  overviewRow?: LeagueOverviewRows[number] | null;
}): OwnerSignalTag[] {
  const tags: OwnerSignalTag[] = [
    overviewRow
      ? { label: `Current value #${overviewRow.rank_value}`, tone: "info" }
      : null,
    row.starterSeasonValue
      ? {
          label: `Starters ${formatCompactValue(row.starterSeasonValue)}`,
          tone: "good",
        }
      : null,
    row.benchValue
      ? {
          label: `Bench ${formatCompactValue(row.benchValue)}`,
          tone: "neutral",
        }
      : null,
    row.holes.summary && row.holes.summary !== "No major roster hole flagged"
      ? {
          label: titleCasePill(
            row.holes.summary.split(",")[0]?.trim() || "Position gap"
          ),
          tone: "warn",
        }
      : null,
    row.pressurePoints?.length
      ? { label: `${row.pressurePoints.length} pressure flags`, tone: "warn" }
      : null,
  ].filter(Boolean) as OwnerSignalTag[];
  return tags.slice(0, 5);
}

function buildRedraftRosterRead(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null
): string {
  const valueRank = overviewRow ? `#${overviewRow.rank_value}` : "unranked";
  const starterValue = row.starterSeasonValue || row.starterValue;
  const bestStarter =
    row.untouchablePlayers?.[0] || row.lastSeasonStud || row.breakoutCandidate;
  const weakest = row.weakestStarter;
  const gap =
    row.holes.summary && row.holes.summary !== "No major roster hole flagged"
      ? row.holes.summary
      : "no obvious position gap";
  return `Current-season roster profile is ${valueRank} by value with ${formatCompactValue(starterValue)} in projected starter strength. ${bestStarter ? `${bestStarter.name} is the headline weekly asset.` : "No single weekly anchor is separated from the roster yet."} ${weakest ? `${weakest.name} is the starter spot to pressure-test.` : "Starter floor is not clearly exposed by one player."} Main roster gap: ${gap}.`;
}

function buildRedraftBestMove(row: OwnerIntelRow): string {
  const buy = row.buyTarget || row.injuryInsurance || row.breakoutCandidate;
  const sell =
    row.sellCandidate || row.droppablePlayers?.[0] || row.bestBenchStash;
  const need = row.tradePlan?.needPosition || null;
  if (need && buy) {
    return `Starter upgrade lens: chase a current-season ${need} improvement such as ${buy.name} if the cost comes from bench depth, not a locked starter.`;
  }
  if (sell) {
    return `Depth fix lens: use ${sell.name} as waiver or trade leverage if it improves weekly starter viability or cleans up a bench clog.`;
  }
  return `No forced redraft move. Prioritize current opportunity, weekly role, and positional need before chasing raw market value.`;
}

function buildRedraftActionNotes(row: OwnerIntelRow): string[] {
  return [
    row.weakestStarter
      ? `Starter pressure: ${row.weakestStarter.name} is the first lineup spot to upgrade.`
      : null,
    row.injuryInsurance
      ? `Bench insurance: ${row.injuryInsurance.name} protects weekly lineup depth.`
      : null,
    row.breakoutCandidate
      ? `Opportunity watch: ${row.breakoutCandidate.name} has enough current-season upside to hold.`
      : null,
    row.droppablePlayers?.length
      ? `Churn list: ${row.droppablePlayers
          .map(player => player.name)
          .slice(0, 2)
          .join(", ")} are waiver-upgrade candidates.`
      : null,
    row.tradePlan?.needPosition
      ? `Position gap: prioritize ${row.tradePlan.needPosition} starter viability over long-term value.`
      : null,
  ]
    .filter(Boolean)
    .slice(0, 4) as string[];
}

function buildDynastyRosterRead(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null,
  buildLabel?: OwnerBuildLabel
): string {
  const valueRank = overviewRow ? `#${overviewRow.rank_value}` : "unranked";
  const ageCopy =
    row.avgAge !== null
      ? `Average roster age is ${row.avgAge}, with ${row.avgAgeByPosition.RB ?? "-"} RB age and ${row.avgAgeByPosition.WR ?? "-"} WR age.`
      : "Age profile is incomplete.";
  const core = row.untouchablePlayers?.length
    ? `Core assets: ${row.untouchablePlayers
        .map(
          player =>
            `${player.name} (${player.currentPositionRank || player.pos})`
        )
        .slice(0, 3)
        .join(", ")}.`
    : row.youngCorePlayer
      ? `Best core asset is ${row.youngCorePlayer.name} (${row.youngCorePlayer.currentPositionRank || row.youngCorePlayer.pos}).`
      : "No obvious elite young core asset is separated from the pack yet.";
  const risk =
    row.oldestPlayer &&
    (row.oldestPlayer.playerDetails?.age || 0) >= 28 &&
    row.oldestPlayer.value >= 1200
      ? `${row.oldestPlayer.name} is the dynasty age/liquidity risk to monitor.`
      : row.sellCandidate
        ? `${row.sellCandidate.name} is the cleanest dynasty sell candidate if market value can be turned into younger value.`
        : "There is no forced age/liquidity sell from the current blend.";

  return `${buildLabel || "Contender"} dynasty profile with roster value ${valueRank}. ${ageCopy} ${core} ${risk}`;
}

function buildDynastyBestMove(
  row: OwnerIntelRow,
  pickRow?: OwnerPickRow | null,
  buildLabel?: OwnerBuildLabel | null,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): string {
  const buy = row.buyTarget;
  const sell = row.sellCandidate || row.oldestPlayer;
  const tradeChip = row.tradeChip || row.bestBenchStash;
  const effectiveNeed = getOwnerEffectiveNeedPosition(
    row,
    overviewRow,
    leagueSize
  );
  const buyPosition = isOwnerNeedPosition(buy?.pos) ? buy.pos : null;
  const buyIsCoveredDepth =
    Boolean(buyPosition) &&
    (!effectiveNeed || buyPosition !== effectiveNeed) &&
    hasOwnerPositionDepthCover(row, buyPosition);
  const hasPickWarChest = Boolean(
    pickRow && pickRow.count2026 + pickRow.count2027 >= 15
  );
  const pickAsk = hasPickWarChest
    ? "future firsts or younger insulated players"
    : "future firsts, seconds, or young players who can gain market value";

  if (
    isOwnerRebuildLane(buildLabel) ||
    /rebuild/i.test(row.identity) ||
    /rebuild/i.test(row.timeline)
  ) {
    if (sell) {
      return `${isOwnerStrongRebuildLane(buildLabel) ? "Strong rebuild" : "Soft rebuild"} lens: shop ${sell.name} for ${pickAsk}. This roster is not being treated like a title team, so do not buy short-window points unless the player can still gain dynasty value.`;
    }
    return `${isOwnerStrongRebuildLane(buildLabel) ? "Strong rebuild" : "Soft rebuild"} lens: keep collecting liquid assets. ${hasPickWarChest ? "The pick bank is already useful, so wait for a manager to overpay for a veteran." : "Add picks or young insulated players before chasing points."}`;
  }

  if (
    isOwnerContenderLane(buildLabel) &&
    tradeChip &&
    buy &&
    !buyIsCoveredDepth
  ) {
    return `${isOwnerStrongContenderLane(buildLabel) ? "Strong contender" : "Contender"} dynasty lens: use movable value like ${tradeChip.name} to chase a stable long-term asset such as ${buy.name}. ${isOwnerStrongContenderLane(buildLabel) ? "This roster can justify paying from depth for a real title-edge upgrade." : "The goal is not just this season’s points; it is keeping the contender window liquid."}`;
  }

  if (isOwnerContenderLane(buildLabel) && tradeChip) {
    return `${isOwnerStrongContenderLane(buildLabel) ? "Strong contender" : "Contender"} dynasty lens: no forced buy from a covered room. Use ${tradeChip.name} only when the return creates a clear weekly starter edge${effectiveNeed ? ` at ${effectiveNeed}` : ""}, otherwise preserve the depth advantage and make the room overpay.`;
  }

  if (
    /contend|win/i.test(row.identity) &&
    tradeChip &&
    buy &&
    !buyIsCoveredDepth
  ) {
    return `Contender dynasty lens: use movable value like ${tradeChip.name} to chase a stable long-term asset such as ${buy.name}. The goal is not just this season's points; it is keeping the contender window liquid.`;
  }

  if (buy && sell && !buyIsCoveredDepth) {
    return `Value arbitrage: compare ${sell.name} against younger or safer market profiles like ${buy.name}. If the room prices them similarly, take the side with better dynasty insulation.`;
  }

  return `No forced dynasty move. Keep the core intact, keep the liquid assets liquid, and only move when another manager pays above the blended market.`;
}

function buildDynastyActionNotes(
  row: OwnerIntelRow,
  pickRow?: OwnerPickRow | null
): string[] {
  const notes = [
    row.buyTarget
      ? `Target watchlist: ${row.buyTarget.name} is the cleanest outside dynasty target in this value band.`
      : null,
    row.sellCandidate
      ? `Sell discipline: ${row.sellCandidate.name} should be shopped before role, age, or market liquidity moves against him.`
      : null,
    row.breakoutCandidate
      ? `Upside hold: ${row.breakoutCandidate.name} has enough age/value runway to keep unless the offer includes a safer asset tier.`
      : null,
    row.droppablePlayers?.length
      ? `Roster churn: ${row.droppablePlayers
          .map(player => player.name)
          .slice(0, 2)
          .join(
            ", "
          )} are the first dynasty-value cuts if a better stash appears.`
      : null,
    pickRow && pickRow.count2026 + pickRow.count2027 >= 15
      ? `Draft capital gives this manager leverage: ${pickRow.count2026} 2026 picks and ${pickRow.count2027} 2027 picks can buy a distressed asset without touching the core.`
      : null,
  ].filter(Boolean) as string[];

  return notes.slice(0, 4);
}

function buildDynastyCoreProtection(
  row: OwnerIntelRow,
  buildLabel?: OwnerBuildLabel | null
): DynastyAiSuggestion | null {
  const protectedCore = (row.untouchablePlayers || []).slice(0, 2);
  const core = protectedCore[0] || row.youngCorePlayer;
  if (!core) return null;

  const protectedNames = protectedCore.length
    ? protectedCore
        .map(player => `${player.name} (${getPlayerRankCopy(player)})`)
        .join(" and ")
    : `${core.name} (${getPlayerRankCopy(core)})`;
  const isContender =
    isOwnerContenderLane(buildLabel) || /contend|win/i.test(row.identity);
  const isRebuild =
    isOwnerRebuildLane(buildLabel) || /rebuild/i.test(row.identity);

  return {
    title: "AI Core Protection",
    tone: isRebuild ? "future" : isContender ? "good" : "neutral",
    theme: "core",
    copy: `${protectedNames} should be treated as the roster spine. ${isRebuild ? "Only move core value if the return resets the age curve and adds liquid draft capital." : isContender ? "Contender upgrades should be funded from depth or picks before this tier enters the offer." : "Use this tier as the comparison point for any consolidation offer before accepting a flatter asset package."}`,
  };
}

function buildDynastySellLine(row: OwnerIntelRow): DynastyAiSuggestion | null {
  const sell = row.sellCandidate || row.oldestPlayer || row.tradeChip;
  if (!sell) return null;
  const age = sell.playerDetails?.age;
  const rankCopy = getPlayerRankCopy(sell);
  const ageCopy = age ? `${age}-year-old ` : "";

  return {
    title: "AI Sell Line",
    tone: row.oldestPlayer?.player_id === sell.player_id ? "danger" : "warn",
    theme: "sell",
    copy: `${sell.name} is the ${ageCopy}${rankCopy} exit monitor. Set the sell line before sending offers: the return should add better age, safer role insulation, or at least one liquid pick. Do not let a lateral points offer become the new baseline.`,
  };
}

function buildDynastyUpsideSignal(
  row: OwnerIntelRow
): DynastyAiSuggestion | null {
  const upside =
    row.breakoutCandidate || row.bestBenchStash || row.youngCorePlayer;
  if (!upside) return null;

  return {
    title: "AI Upside Signal",
    tone: "future",
    theme: "upside",
    copy: `${upside.name} is the asymmetric hold. The model is treating the profile as more useful than a flat value chip, so the exit price should be a safer young asset tier, a meaningful pick upgrade, or a starter who clearly changes lineup math.`,
  };
}

function getPlayerRankCopy(player?: ManagerIntelPlayer | null): string {
  if (!player) return "";
  return (
    player.currentPositionRank ||
    player.seasonPositionRank ||
    player.pos ||
    "asset"
  );
}

function buildDynastyTradeBuilder(
  row: OwnerIntelRow,
  pickRow?: OwnerPickRow | null,
  buildLabel?: OwnerBuildLabel | null,
  overviewRow?: LeagueOverviewRows[number] | null,
  leagueSize = 0
): string {
  const need = getOwnerEffectiveNeedPosition(row, overviewRow, leagueSize);
  const surplus = row.tradePlan?.surplusPosition;
  const buy = row.buyTarget;
  const sell = row.sellCandidate || row.tradeChip || row.bestBenchStash;
  const buyPosition = isOwnerNeedPosition(buy?.pos) ? buy.pos : null;
  const buyFitsNeed = Boolean(
    buy && (!need || !buyPosition || buyPosition === need)
  );
  const buyIsCoveredDepth =
    Boolean(buyPosition) &&
    (!need || buyPosition !== need) &&
    hasOwnerPositionDepthCover(row, buyPosition);
  const pickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);

  if (isOwnerRebuildLane(buildLabel)) {
    const olderSell = row.oldestPlayer || row.sellCandidate || sell;
    if (olderSell) {
      return `${isOwnerStrongRebuildLane(buildLabel) ? "Hard reset path" : "Soft pivot path"}: start with ${olderSell.name} (${getPlayerRankCopy(olderSell)}) and ask for future draft leverage or a younger insulated asset. The model is prioritizing future draft position and market liquidity over this season's points.`;
    }
    return `${isOwnerStrongRebuildLane(buildLabel) ? "Hard reset path" : "Soft pivot path"}: do not spend picks into the current lineup. Float veterans first and use every deal to improve future draft capital, youth, or liquidity.`;
  }

  if (
    isOwnerStrongContenderLane(buildLabel) &&
    buy &&
    sell &&
    !buyIsCoveredDepth
  ) {
    return `Title push path: start with ${sell.name} (${getPlayerRankCopy(sell)}) as movable depth and target ${buy.name} only if the deal creates a clear weekly edge. Strong contenders can spend, but the core should stay intact.`;
  }

  if (need && surplus && buyFitsNeed && buy && sell) {
    return `Build offers from the roster shape, not the player name. Start with ${sell.name} (${getPlayerRankCopy(sell)}) as the movable ${surplus} piece, then price up only if ${buy.name} fixes ${need} without draining the core.`;
  }

  if (need && buyFitsNeed && buy) {
    return `The model sees ${need} as the cleanest outside add. Use ${buy.name} as the market anchor, then search one value tier below if the ask includes premium picks.`;
  }

  if (surplus && sell) {
    return `This roster has extra ${surplus} value. Float ${sell.name} as the first name in packages and ask for youth, picks, or a cleaner starter fit before accepting lateral points.`;
  }

  if (pickCount >= 15 && buy && !buyIsCoveredDepth) {
    return `The pick bank creates optionality. Open with a future pick before touching the core, then walk away if ${buy.name} costs a cornerstone player plus draft capital.`;
  }

  return "No clean package is forced. Let the room create the overpay, then use the roster read to decide whether the return improves age, liquidity, or weekly lineup leverage.";
}

function buildDynastyWindowGuardrail(
  row: OwnerIntelRow,
  pickRow?: OwnerPickRow | null,
  buildLabel?: OwnerBuildLabel | null
): DynastyAiSuggestion {
  const pickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  const core = row.untouchablePlayers?.[0] || row.youngCorePlayer;
  const olderRisk =
    row.oldestPlayer && (row.oldestPlayer.playerDetails?.age || 0) >= 28
      ? row.oldestPlayer
      : null;
  const isRebuild =
    isOwnerRebuildLane(buildLabel) ||
    /rebuild/i.test(row.identity) ||
    /rebuild/i.test(row.timeline);
  const isStrongRebuild = isOwnerStrongRebuildLane(buildLabel);
  const isStrongContender = isOwnerStrongContenderLane(buildLabel);
  const isContender =
    isOwnerContenderLane(buildLabel) ||
    /contend|win/i.test(row.identity) ||
    /contend|win/i.test(row.timeline);

  if (isRebuild) {
    return {
      title: "AI Window Guardrail",
      tone: isStrongRebuild ? "future" : "warn",
      theme: "window",
      copy: `${isStrongRebuild ? "Strong rebuild rule" : "Soft rebuild rule"}: every accepted deal should improve future draft position, add a younger insulated asset, or create more liquid draft capital. ${core ? `Keep ${core.name} as the core reference point.` : "Do not sell young value just to make the current lineup look cleaner."} ${pickCount >= 15 ? "The pick base is strong enough to wait for distressed sellers." : "Add picks before buying short-window production."}`,
    };
  }

  if (isContender) {
    return {
      title: "AI Window Guardrail",
      tone: "good",
      theme: "window",
      copy: `${isStrongContender ? "Strong contender rule" : "Contender rule"}: spend from depth, not the spine of the roster. ${isStrongContender ? "You can pay for a title-edge starter, but do not turn the elite core into a one-week rental bet." : olderRisk ? `${olderRisk.name} is the veteran value to keep liquid.` : "Avoid converting young value into aging points unless the weekly lineup clearly jumps a tier."}`,
    };
  }

  return {
    title: "AI Window Guardrail",
    tone: "warn",
    theme: "window",
    copy: `Soft rebuild rule: do not let one trade pick the direction by accident. Only buy points if the upgrade is a clear starter, and sell veterans when the return adds youth or picks without making the lineup collapse.`,
  };
}

function buildDynastyRosterChurn(row: OwnerIntelRow): DynastyAiSuggestion {
  const cutNames =
    row.droppablePlayers?.slice(0, 2).map(player => player.name) || [];
  const stash =
    row.bestBenchStash || row.breakoutCandidate || row.youngCorePlayer;
  const upside = row.breakoutCandidate;

  if (cutNames.length && stash) {
    return {
      title: "AI Roster Churn",
      tone: "warn",
      theme: "churn",
      copy: `First churn path: protect ${stash.name} and use ${cutNames.join(", ")} as the first cut candidate${cutNames.length === 1 ? "" : "s"} when a better stash appears. The back of the roster should create upside, not hold low-liquidity names.`,
    };
  }

  if (upside) {
    return {
      title: "AI Roster Churn",
      tone: "future",
      theme: "churn",
      copy: `${upside.name} is the upside hold. Do not cash that profile out for a flat value return unless the deal adds a safer young asset or a meaningful pick upgrade.`,
    };
  }

  return {
    title: "AI Roster Churn",
    tone: "neutral",
    theme: "churn",
    copy: "No obvious dynasty cut pressure is showing. Keep the last roster spots flexible and make waivers beat the current stash value before churning.",
  };
}

function buildDynastyPickLeverage(
  pickRow?: OwnerPickRow | null
): DynastyAiSuggestion {
  const pickCount = (pickRow?.count2026 || 0) + (pickRow?.count2027 || 0);
  const draftValue = pickRow ? formatCompactValue(pickRow.totalValue) : null;

  if (!pickRow) {
    return {
      title: "AI Pick Leverage",
      tone: "neutral",
      theme: "draft",
      copy: "Draft-capital data is thin for this manager, so the model should price trades through player liquidity first and avoid assuming picks can solve the roster shape.",
    };
  }

  if (pickCount >= 15) {
    return {
      title: "AI Pick Leverage",
      tone: "future",
      theme: "draft",
      copy: `${pickCount} future picks and ${draftValue} of draft capital gives this roster leverage. Use picks as the first sweetener before attaching core players. A pick-rich team should make other managers solve their lineup urgency.`,
    };
  }

  if (pickCount <= 12) {
    return {
      title: "AI Pick Leverage",
      tone: "warn",
      theme: "draft",
      copy: `${pickCount} future picks is light enough that draft capital should be protected. If a veteran is moved, ask for at least one liquid pick or a younger player who can gain market value.`,
    };
  }

  return {
    title: "AI Pick Leverage",
    tone: "neutral",
    theme: "draft",
    copy: `${pickCount} future picks and ${draftValue} of draft capital is a workable bank. Spend one pick only when it turns a bench asset into a true starter or a safer dynasty profile.`,
  };
}

function buildDynastySituationRadar(row: OwnerIntelRow): DynastyAiSuggestion | null {
  const summary = row.situationSummary;
  if (!summary?.backedCount) return null;
  const topBoost = summary.topBoostPlayer;
  const topRisk = summary.topRiskPlayer;

  if (summary.riskCount > summary.boostCount && topRisk) {
    return {
      title: "AI Situation Radar",
      tone: "warn",
      theme: "risk",
      copy: `${summary.note} Do not treat this as a pure market-value roster; role pressure is showing up before the trade card should get more aggressive.`,
    };
  }

  if (summary.boostCount && topBoost) {
    return {
      title: "AI Situation Radar",
      tone: "good",
      theme: "upside",
      copy: `${summary.note} That gives this manager a reason to hold or price the upside above a flat blended-value number.`,
    };
  }

  if (summary.sourceLimitedCount || summary.staleCount) {
    return {
      title: "AI Situation Radar",
      tone: "warn",
      theme: "risk",
      copy: `${summary.note} Keep the read capped until usage, news, injury, or depth-chart context refreshes.`,
    };
  }

  return {
    title: "AI Situation Radar",
    tone: "neutral",
    theme: "neutral",
    copy: `${summary.note} No strong role swing is forcing action, so trades should stay anchored to roster construction and market value.`,
  };
}

function buildDynastyRiskRadar(row: OwnerIntelRow): DynastyAiSuggestion {
  const riskStarter = row.starterAvailability?.riskiestStarter;
  const insurance = row.injuryInsurance;
  const oldest = row.oldestPlayer;
  const missed = row.starterAvailability?.avgGamesMissed;

  if (riskStarter && insurance) {
    return {
      title: "AI Risk Radar",
      tone: "danger",
      theme: "risk",
      copy: `${riskStarter.name} is the availability flag. Keep ${insurance.name} as internal cover unless the trade return materially improves age, role security, or pick liquidity.`,
    };
  }

  if (missed !== null && missed !== undefined && missed >= 2) {
    return {
      title: "AI Risk Radar",
      tone: "warn",
      theme: "risk",
      copy: `Starters averaged ${missed} missed games, so depth is not just decoration here. Consolidate only when the incoming player is durable enough to reduce weekly fragility.`,
    };
  }

  if (
    oldest &&
    (oldest.playerDetails?.age || 0) >= 28 &&
    oldest.value >= 1200
  ) {
    return {
      title: "AI Risk Radar",
      tone: "warn",
      theme: "risk",
      copy: `${oldest.name} is the age/liquidity monitor. Keep him if the lineup needs points, but set the sell line before the market starts treating the profile like declining value.`,
    };
  }

  return {
    title: "AI Risk Radar",
    tone: "good",
    theme: "risk",
    copy: "No severe health or age flag is forcing action. That gives this roster permission to be selective instead of accepting discounts for safer but lower-upside assets.",
  };
}

function buildDynastyOfferFilter(
  row: OwnerIntelRow,
  overviewRow?: LeagueOverviewRows[number] | null
): DynastyAiSuggestion {
  const buy = row.buyTarget;
  const sell = row.sellCandidate || row.tradeChip || row.bestBenchStash;
  const valueRank = overviewRow?.rank_value;
  const rankCopy = valueRank
    ? `roster value rank #${valueRank}`
    : "the current roster value";

  if (buy && sell) {
    return {
      title: "AI Offer Filter",
      tone: "good",
      theme: "trade",
      copy: `Auto-compare every offer to this baseline: would you rather hold ${sell.name}, or reset that value into ${buy.name} plus better age, liquidity, or lineup fit? If the answer is not obvious, make the other manager add.`,
    };
  }

  return {
    title: "AI Offer Filter",
    tone: "neutral",
    theme: "trade",
    copy: `Use ${rankCopy} as the floor. Decline trades that make the roster older, thinner, and less liquid unless the weekly starter upgrade is immediate and measurable.`,
  };
}

function buildDynastyAiSuggestions({
  row,
  pickRow,
  overviewRow,
  buildLabel,
  leagueSize = 0,
  seededTradeCopies = [],
  suppress = [],
}: {
  row: OwnerIntelRow;
  pickRow?: OwnerPickRow | null;
  overviewRow?: LeagueOverviewRows[number] | null;
  buildLabel?: OwnerBuildLabel | null;
  leagueSize?: number;
  seededTradeCopies?: string[];
  suppress?: Array<string | null | undefined>;
}): DynastyAiSuggestion[] {
  const effectiveNeed = getOwnerEffectiveNeedPosition(
    row,
    overviewRow,
    leagueSize
  );
  const baseCards: DynastyAiSuggestion[] = [
    {
      title: "AI Trade Builder",
      tone: isOwnerRebuildLane(buildLabel)
        ? isOwnerStrongRebuildLane(buildLabel)
          ? "future"
          : "warn"
        : effectiveNeed
          ? "good"
          : "neutral",
      theme: "trade",
      copy: buildDynastyTradeBuilder(
        row,
        pickRow,
        buildLabel,
        overviewRow,
        leagueSize
      ),
    },
    buildDynastySituationRadar(row),
    buildDynastyWindowGuardrail(row, pickRow, buildLabel),
    buildDynastyPickLeverage(pickRow),
    buildDynastyRosterChurn(row),
    buildDynastyRiskRadar(row),
    buildDynastyOfferFilter(row, overviewRow),
    buildDynastyCoreProtection(row, buildLabel),
    buildDynastySellLine(row),
    buildDynastyUpsideSignal(row),
  ].filter((card): card is DynastyAiSuggestion => Boolean(card));
  const actionMeta: Array<{
    title: string;
    tone: OwnerSignalTone;
    theme: DynastyAiTheme;
  }> = [
    { title: "AI Watchlist", tone: "good", theme: "trade" },
    { title: "AI Sell Discipline", tone: "warn", theme: "sell" },
    { title: "AI Upside Hold", tone: "future", theme: "upside" },
    { title: "AI Cut List", tone: "danger", theme: "churn" },
    { title: "AI Draft Leverage", tone: "future", theme: "draft" },
  ];
  const actionCards = buildDynastyActionNotes(row, pickRow).map(
    (copy, index) => ({
      ...(actionMeta[index] || {
        title: "AI Note",
        tone: "neutral" as const,
        theme: "neutral" as const,
      }),
      copy,
    })
  );
  const dedupedCopy = dedupeIntelNotes(
    [...baseCards, ...actionCards].map(card => card.copy),
    suppress
  );
  const candidateCards = dedupedCopy
    .map(copy =>
      [...baseCards, ...actionCards].find(card => card.copy === copy)
    )
    .filter((card): card is DynastyAiSuggestion => Boolean(card));

  return filterByPlayerNameMentionBudget(
    candidateCards,
    card => card.copy,
    getDynastyTradeTrackedNames(row),
    seededTradeCopies
  ).slice(0, 3);
}

function buildSeasonRosterRead({
  selectedIntel,
  selectedCounts,
  lineupGroups,
  canStepInGroups,
}: {
  selectedIntel?: OwnerIntelRow | null;
  selectedCounts?: ManagerCountRow | null;
  lineupGroups: Array<{
    label: string;
    count?: number;
    players: CommandPlayer[];
  }>;
  canStepInGroups: Array<{ label: string; players: CommandPlayer[] }>;
}): string {
  const missingGroups = lineupGroups.filter(
    group => group.players.length < Math.max(1, group.count ?? 1)
  );
  const starterCount = selectedCounts
    ? selectedCounts.QB_starters +
      selectedCounts.RB_starters +
      selectedCounts.WR_starters +
      selectedCounts.TE_starters +
      (selectedCounts.K_starters || 0) +
      (selectedCounts.DEF_starters || 0)
    : lineupGroups.reduce((sum, group) => sum + group.players.length, 0);
  const depthNames = canStepInGroups.flatMap(group =>
    group.players
      .slice(0, 2)
      .map(
        player =>
          `${player.name} (${player.seasonPositionRank || player.currentPositionRank || player.pos})`
      )
  );
  const weakStarter = selectedIntel?.weakestStarter;
  const riskStarter = selectedIntel?.starterAvailability?.riskiestStarter;
  const starterSourceLabel =
    selectedCounts?.starterSource === "Sleeper"
      ? "submitted Sleeper starters"
      : "projected starters";
  const riskCopy =
    selectedIntel?.starterAvailability?.avgGamesMissed !== null &&
    selectedIntel?.starterAvailability?.avgGamesMissed !== undefined
      ? `Availability risk is ${selectedIntel.starterAvailability.riskLevel}; ${starterSourceLabel} averaged ${selectedIntel.starterAvailability.avgGamesMissed} missed games.`
      : "Availability history is limited, so current season rank and role carry more weight.";
  const weakCopy = weakStarter
    ? `${weakStarter.name} (${weakStarter.seasonPositionRank || weakStarter.currentPositionRank || weakStarter.pos}) is the first starter to upgrade.`
    : "No starter is clearly below the league line.";
  const depthCopy = depthNames.length
    ? `Best next-man-up options: ${depthNames.slice(0, 4).join(", ")}.`
    : `There is not much starter-grade depth behind the ${starterSourceLabel}.`;
  const missingCopy = missingGroups.length
    ? `Lineup fill warning: ${missingGroups.map(group => group.label).join(", ")} needs a better season-rank option.`
    : `${starterCount} ${starterSourceLabel} fill from ranked active players.`;
  const situationCopy = selectedIntel?.situationSummary?.backedCount
    ? `Football context: ${selectedIntel.situationSummary.note}`
    : "Football-context role reads are still thin for this roster, so the season read stays rank/value driven.";

  return `${missingCopy} ${weakCopy} ${riskCopy} ${depthCopy} ${situationCopy}`;
}

function buildSeasonInsuranceRead(row?: OwnerIntelRow | null): string | null {
  if (!row?.injuryInsurance && !row?.starterAvailability?.riskiestStarter)
    return null;
  const risky = row.starterAvailability?.riskiestStarter;
  const cover = row.injuryInsurance;

  if (risky && cover) {
    return `${risky.name} is the player to insure around. ${cover.name} (${cover.seasonPositionRank || cover.currentPositionRank || cover.pos}) is the best internal emergency cover. If the real-life backup is cheap on waivers or in a small trade, compare that role path against keeping ${cover.name} as the first in-house patch.`;
  }

  if (cover) {
    return `${cover.name} is the cleanest internal injury cover. This roster should avoid cutting that profile unless waivers produce a clearer season role.`;
  }

  return `${risky?.name} is the main availability concern, but there is no clean internal cover showing in the current season ranks.`;
}

function FullRosterRankTiles({
  overviewRow,
}: {
  overviewRow: LeagueOverviewRows[number];
}) {
  const tiles = [
    {
      key: "QB",
      label: "QB",
      rank: overviewRow.rank_qb,
      className: "owner-intel-heat-position-qb",
    },
    {
      key: "RB",
      label: "RB",
      rank: overviewRow.rank_rb,
      className: "owner-intel-heat-position-rb",
    },
    {
      key: "WR",
      label: "WR",
      rank: overviewRow.rank_wr,
      className: "owner-intel-heat-position-wr",
    },
    {
      key: "TE",
      label: "TE",
      rank: overviewRow.rank_te,
      className: "owner-intel-heat-position-te",
    },
    {
      key: "VALUE",
      label: "Value",
      rank: overviewRow.rank_value,
      className: "owner-intel-heat-position-value",
    },
  ];

  return (
    <div className="owner-intel-full-rank-panel">
      <h4>Full Roster Rankings</h4>
      <div className="owner-intel-heat-grid owner-intel-full-rank-grid">
        {tiles.map(tile => (
          <span
            key={tile.key}
            className={`owner-intel-heat-pill owner-intel-full-rank-tile ${tile.className}`}
          >
            <strong>{tile.label}</strong>
            <em>#{tile.rank}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

type StartingRosterRankPosition = "QB_SF" | "RB" | "WR" | "TE" | "K" | "DEF";
type StartingRosterPlayer = NonNullable<
  ReportData["managerPositionCounts"][number]["starterPlayers"]
>[number];

const STARTING_ROSTER_RANK_POSITIONS: StartingRosterRankPosition[] = [
  "QB_SF",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
];

function getStartingRosterRankLabel(position: StartingRosterRankPosition) {
  if (position === "QB_SF") return "QB/SF";
  return position;
}

function getStartingRosterRankClass(position: StartingRosterRankPosition) {
  if (position === "QB_SF") return "owner-intel-heat-position-qb";
  return `owner-intel-heat-position-${position.toLowerCase()}`;
}

function shouldShowStartingRosterRankPosition(
  rows: ReportData["managerPositionCounts"],
  position: StartingRosterRankPosition
): boolean {
  if (position !== "K" && position !== "DEF") return true;
  return rows.some(row =>
    getStartingRosterPlayers(row).some(player => player.pos === position)
  );
}

function getStartingRosterSeasonValue(
  player: Pick<StartingRosterPlayer, "seasonValue" | "value">
): number {
  const value = Number(player.seasonValue ?? player.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getStartingRosterPlayers(
  row?: ReportData["managerPositionCounts"][number] | null
): StartingRosterPlayer[] {
  const players = row?.starterPlayers?.length
    ? row.starterPlayers
    : row?.starterGroups?.flatMap(group => group.players || []) || [];
  const uniquePlayers = new Map<string, StartingRosterPlayer>();

  players.forEach((player, index) => {
    const key = player.player_id || `${player.name}-${player.pos}-${index}`;
    if (!uniquePlayers.has(key)) uniquePlayers.set(key, player);
  });

  return Array.from(uniquePlayers.values());
}

function getStartingRosterPositionScore(
  row: ReportData["managerPositionCounts"][number] | null | undefined,
  position: StartingRosterRankPosition
): number {
  const playerPosition = position === "QB_SF" ? "QB" : position;
  return getStartingRosterPlayers(row)
    .filter(player => player.pos === playerPosition)
    .reduce((sum, player) => sum + getStartingRosterSeasonValue(player), 0);
}

function getStartingRosterTotalScore(
  row: ReportData["managerPositionCounts"][number] | null | undefined
): number {
  return getStartingRosterPlayers(row).reduce(
    (sum, player) => sum + getStartingRosterSeasonValue(player),
    0
  );
}

function getRankFromDescendingScores(
  score: number,
  scores: number[]
): number | null {
  if (!Number.isFinite(score) || score <= 0) return null;
  return (
    scores.filter(value => Number.isFinite(value) && value > score).length + 1
  );
}

function getLineupDisplayOrder(group: {
  key?: string;
  label?: string;
}): number {
  const key = String(group.key || group.label || "").toUpperCase();
  if (key.includes("QB_SF") || key.includes("QB/SF") || key === "QB") return 0;
  if (key === "RB" || key.startsWith("RB ")) return 1;
  if (key === "WR" || key.startsWith("WR ")) return 2;
  if (key === "TE" || key.startsWith("TE ")) return 3;
  if (key === "FLEX" || key.startsWith("FLEX")) return 4;
  if (key === "K" || key.startsWith("K ")) return 5;
  if (key === "DEF" || key.startsWith("DEF")) return 6;
  return 99;
}

function sortLineupGroupsForDisplay<T extends { key?: string; label?: string }>(
  groups: T[]
): T[] {
  return [...groups].sort(
    (a, b) =>
      getLineupDisplayOrder(a) - getLineupDisplayOrder(b) ||
      String(a.label || "").localeCompare(String(b.label || ""))
  );
}

function isQuarterbackLineupGroup(group: { key?: string; label?: string }) {
  const key = String(group.key || group.label || "").toUpperCase();
  return key === "QB" || key.startsWith("QB ") || key.includes("QB_SF") || key.includes("QB/SF");
}

function getSwapFitLabel(label?: string | null) {
  const normalized = String(label || "").trim();
  if (/QB\/SF|QB_SF/i.test(normalized)) return "QB/SF";
  if (/FLEX/i.test(normalized)) return "Flex";
  if (/DEF/i.test(normalized)) return "DEF";
  if (/\bK\b/i.test(normalized)) return "K";
  if (/\bTE\b/i.test(normalized)) return "TE";
  if (/\bWR\b/i.test(normalized)) return "WR";
  if (/\bRB\b/i.test(normalized)) return "RB";
  if (/\bQB\b/i.test(normalized)) return "QB";
  return normalized || "Lineup";
}

function combineSuperflexQuarterbackGroups<
  T extends { key?: string; label?: string; count?: number; players: CommandPlayer[] },
>(groups: T[]): T[] {
  const quarterbackGroups = groups.filter(isQuarterbackLineupGroup);
  if (quarterbackGroups.length <= 1) return groups;

  const usedPlayers = new Set<string>();
  const combinedPlayers = quarterbackGroups.flatMap(group => group.players || [])
    .filter(player => {
      const key = player.player_id || `${player.name}-${player.pos}`;
      if (usedPlayers.has(key)) return false;
      usedPlayers.add(key);
      return true;
    });
  const combinedCount =
    quarterbackGroups.reduce(
      (sum, group) => sum + (group.count || group.players.length || 0),
      0
    ) || combinedPlayers.length;
  const combined = {
    ...quarterbackGroups[0],
    key: "QB_SF",
    label: `QB/SF x${combinedCount}`,
    count: combinedCount,
    players: combinedPlayers,
  } as T;

  return sortLineupGroupsForDisplay([
    combined,
    ...groups.filter(group => !isQuarterbackLineupGroup(group)),
  ]);
}

function StartingRosterRankTiles({
  manager,
  managerPositionCounts,
}: {
  manager: string;
  managerPositionCounts: ReportData["managerPositionCounts"];
}) {
  const selectedRow = managerPositionCounts.find(
    row => row.manager === manager
  );
  if (!selectedRow) return null;

  const tiles = STARTING_ROSTER_RANK_POSITIONS.filter(position =>
    shouldShowStartingRosterRankPosition(managerPositionCounts, position)
  ).map(position => {
    const score = getStartingRosterPositionScore(selectedRow, position);
    const scores = managerPositionCounts.map(row =>
      getStartingRosterPositionScore(row, position)
    );

    return {
      key: position,
      label: getStartingRosterRankLabel(position),
      rank: getRankFromDescendingScores(score, scores),
      className: getStartingRosterRankClass(position),
    };
  });

  return (
    <div className="owner-intel-full-rank-panel manager-command-starting-rank-panel">
      <h4>Projected Starter Position Ranks</h4>
      <div className="owner-intel-heat-grid owner-intel-full-rank-grid">
        {tiles.map(tile => (
          <span
            key={tile.key}
            className={`owner-intel-heat-pill owner-intel-full-rank-tile ${tile.className}`}
          >
            <strong>{tile.label}</strong>
            <em>{tile.rank ? `#${tile.rank}` : "-"}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

function OwnerIntelDepthPlayerButton({
  player,
  manager,
  managerAvatars,
  playerDetailsById,
  onSelect,
}: {
  player: ManagerIntelPlayer;
  manager: string;
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  onSelect: (player: PlayerModalData) => void;
}) {
  const playerDetails =
    player.playerDetails ||
    (player.player_id ? playerDetailsById?.[player.player_id] : undefined);
  const team = playerDetails?.team || null;
  const rank =
    player.seasonPositionRank ||
    player.currentPositionRank ||
    player.pos ||
    "-";
  const seasonValue = player.seasonValue || player.value;

  return (
    <button
      type="button"
      className="owner-intel-bench-player player-team-tile"
      style={getTeamTileStyle(team)}
      onClick={() =>
        onSelect(
          buildPlayerModalData({
            playerId: player.player_id,
            playerName: player.name,
            playerPos: player.pos,
            value: seasonValue,
            playerDetails,
            playerDetailsById,
            currentPositionRank: rank,
            valueMode: "redraft",
            manager: player.owner || manager,
            managerAvatarUrl:
              (player.owner && managerAvatars?.[player.owner]) ||
              managerAvatars?.[manager],
          })
        )
      }
    >
      <PlayerNameWithHeadshot
        playerId={player.player_id}
        playerName={player.name}
        team={team}
        position={player.pos}
      />
      <span className="owner-intel-bench-player-meta">
        <TeamLogoPill team={team} />
        <span className="owner-intel-bench-player-value">
          {formatCompactValue(seasonValue)}
        </span>
        <PositionRankPill rank={rank} />
      </span>
    </button>
  );
}

function BenchBaselineList({
  row,
  playerDetailsById,
  managerAvatars,
  onSelect,
}: {
  row: OwnerIntelRow;
  playerDetailsById?: PlayerDetailsById;
  managerAvatars?: ManagerAvatars;
  onSelect: (player: PlayerModalData) => void;
}) {
  if (!row.benchBaseline?.length) {
    return (
      <div className="owner-intel-attack-list">
        <span>
          <strong>QB/SF</strong>
          <PositionRankPill rank={row.holes.bestQbRank} />
        </span>
        <span>
          <strong>RB2</strong>
          <PositionRankPill rank={row.holes.rb2Rank} />
        </span>
        <span>
          <strong>WR3</strong>
          <PositionRankPill rank={row.holes.wr3Rank} />
        </span>
        <span>
          <strong>TE1</strong>
          <PositionRankPill rank={row.holes.te1Rank} />
        </span>
        <span>
          <strong>Flex depth</strong>
          <em>{row.holes.flexDepth}</em>
        </span>
      </div>
    );
  }

  return (
    <div className="owner-intel-bench-list">
      {row.benchBaseline.map(tile => {
        const player = tile.player;
        const players = tile.players?.length
          ? tile.players
          : player
            ? [player]
            : [];

        return (
          <div
            key={tile.key}
            className="owner-intel-bench-row"
            title={tile.note}
          >
            <div className="owner-intel-bench-rank">
              <strong>{tile.label}</strong>
              <em>{tile.leagueRank ? `#${tile.leagueRank}` : "-"}</em>
            </div>
            {players.length ? (
              <div className="owner-intel-bench-player-stack">
                {players.map(depthPlayer => (
                  <OwnerIntelDepthPlayerButton
                    key={depthPlayer.player_id}
                    player={depthPlayer}
                    manager={row.manager}
                    playerDetailsById={playerDetailsById}
                    managerAvatars={managerAvatars}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            ) : (
              <span className="owner-intel-bench-player owner-intel-bench-player-empty">
                No bench option
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TradeableDepthList({
  items,
  row,
  playerDetailsById,
  managerAvatars,
  onSelect,
}: {
  items: Array<{
    position: "QB" | "RB" | "WR" | "TE";
    player: ManagerIntelPlayer;
    note: string;
  }>;
  row: OwnerIntelRow;
  playerDetailsById?: PlayerDetailsById;
  managerAvatars?: ManagerAvatars;
  onSelect: (player: PlayerModalData) => void;
}) {
  return (
    <div className="owner-intel-bench-list owner-intel-tradeable-depth-list">
      {items.map(({ position, player, note }) => (
        <div
          key={`${position}-${player.player_id}`}
          className="owner-intel-bench-row"
          title={note}
        >
          <div className="owner-intel-bench-rank">
            <strong>Tradeable {position}</strong>
          </div>
          <OwnerIntelDepthPlayerButton
            player={player}
            manager={row.manager}
            playerDetailsById={playerDetailsById}
            managerAvatars={managerAvatars}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  );
}

function getPlayerInsightLabelHelp(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("untouchable"))
    return "Core asset. Only move this player for a clear overpay.";
  if (normalized.includes("buy"))
    return "Target profile that fits this roster shape or market window.";
  if (normalized.includes("sell"))
    return "Player whose value, role, or roster fit makes them worth shopping.";
  if (normalized.includes("trade chip"))
    return "Useful value piece to consolidate into a better starter, picks, or cleaner roster fit.";
  if (normalized.includes("insurance"))
    return "Depth piece that protects a fragile starter or position room.";
  if (normalized.includes("droppable"))
    return "First cut candidate when waivers or roster churn matter.";
  if (normalized.includes("weak"))
    return "Projected starter or roster spot opponents can attack.";
  if (normalized.includes("injury"))
    return "Health or availability concern that changes this roster read.";
  if (normalized.includes("bench"))
    return "Best non-starting stash based on value and roster fit.";
  if (normalized.includes("stud"))
    return "Last-season production marker worth keeping in context.";
  return `${label} roster insight.`;
}

function PlayerInsightTile({
  label,
  player,
  manager,
  managerAvatarUrl,
  playerDetailsById,
  onSelect,
  tone = "neutral",
  extraPill,
  crownedRank,
  leagueValueMode = "dynasty",
}: {
  label: string;
  player: ManagerIntelPlayer | null | undefined;
  manager: string;
  managerAvatarUrl?: string | null;
  playerDetailsById?: PlayerDetailsById;
  onSelect: (player: PlayerModalData) => void;
  tone?: "neutral" | "warn" | "danger";
  extraPill?: string | null;
  crownedRank?: string | null;
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  if (!player) return null;
  const normalizedMode = normalizeLeagueValueMode(leagueValueMode);
  const playerDetails =
    player.playerDetails ||
    (player.player_id ? playerDetailsById?.[player.player_id] : undefined);
  const playerTeam = playerDetails?.team || null;
  const displayedValue = getPlayerValueForMode({
    valueProfile: playerDetails?.valueProfile,
    fallbackValue:
      normalizedMode === "redraft"
        ? (player.seasonValue ?? player.value)
        : player.value,
    mode: normalizedMode,
    context: "overview",
  });
  const displayedRank = getPlayerRankForMode({
    valueProfile: playerDetails?.valueProfile,
    fallbackRank:
      normalizedMode === "redraft"
        ? player.seasonPositionRank || player.currentPositionRank || player.pos
        : player.currentPositionRank || player.seasonPositionRank || player.pos,
    mode: normalizedMode,
    context: "overview",
  });
  const insightKey = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const insightTitle = getPlayerInsightLabelHelp(label);

  return (
    <button
      type="button"
      className={`player-team-tile manager-intel-player ${tone === "warn" ? "manager-intel-player-warn" : ""} ${tone === "danger" ? "manager-intel-player-danger" : ""}`}
      data-insight-label={insightKey}
      style={getTeamTileStyle(playerTeam)}
      title={insightTitle}
      aria-label={`${label}: ${player.name}`}
      onClick={() =>
        onSelect(
          buildPlayerModalData({
            playerId: player.player_id,
            playerName: player.name,
            playerPos: player.pos,
            value: displayedValue,
            playerDetails,
            playerDetailsById,
            currentPositionRank:
              displayedRank ||
              player.currentPositionRank ||
              player.seasonPositionRank,
            manager: player.owner || manager,
            managerAvatarUrl: player.owner ? undefined : managerAvatarUrl,
            valueMode: normalizedMode,
          })
        )
      }
    >
      <div className="manager-intel-player-kicker">{label}</div>
      <div className="manager-intel-player-main">
        <PlayerNameWithHeadshot
          playerId={player.player_id}
          playerName={player.name}
          team={playerTeam}
          position={player.pos}
        />
      </div>
      <div className="manager-intel-player-pills">
        <TeamLogoPill team={playerTeam} />
        <PositionRankPill rank={displayedRank || player.pos} />
        {extraPill && <span>{extraPill}</span>}
        <span>{formatCompactValue(displayedValue)}</span>
      </div>
      {crownedRank && (
        <div className="manager-intel-crown-rank">
          <Crown className="h-3.5 w-3.5" />
          <span>{crownedRank}</span>
        </div>
      )}
    </button>
  );
}

function getHeatPillClass(position: string, grade?: string | null) {
  const normalizedPosition = String(position || "slot")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return `owner-intel-heat-pill owner-intel-heat-position-${normalizedPosition} owner-intel-heat-${String(grade || "empty").toLowerCase()}`;
}

function CommandPlayerTile({
  player,
  onClick,
  variant = "default",
  label,
  note,
  showValueStack = false,
  swapSignal,
}: {
  player: CommandPlayer;
  onClick: () => void;
  variant?: "default" | "step";
  label?: string;
  note?: string | null;
  showValueStack?: boolean;
  swapSignal?: CommandSwapSignal;
}) {
  const valueLens = getCommandPlayerValueLens(player);
  const seasonRank =
    player.seasonPositionRank || player.currentPositionRank || player.pos;
  const dynastyLens = getCommandPlayerDynastyLens(player);
  const seasonLens = getCommandPlayerSeasonLens(player);
  const availability = getPlayerAvailability(player.playerDetails);
  const gameLockState = getCommandPlayerGameLockState(player);
  const shouldShowStatusPill =
    Boolean(gameLockState.label) ||
    !showValueStack ||
    availability.tone !== "taxi";

  return (
    <button
      type="button"
      className={`player-team-tile manager-command-player-tile ${variant === "step" ? "manager-command-player-tile-step" : ""} ${swapSignal ? `manager-command-player-tile-swap manager-command-player-tile-swap-${swapSignal.role}` : ""}`}
      style={getTeamTileStyle(player.playerDetails?.team)}
      onClick={onClick}
      aria-label={
        swapSignal
          ? `${player.name}, ${swapSignal.label}, ${swapSignal.confidencePct}% confidence`
          : undefined
      }
    >
      {label && (
        <div
          className={`manager-intel-player-kicker manager-command-action-pill manager-command-action-${getTaxiActionClassName(label)}`}
        >
          {label}
        </div>
      )}
      {swapSignal && (
        <div
          className={`manager-command-swap-corner manager-command-swap-corner-${swapSignal.role}`}
        >
          <span>{swapSignal.label}</span>
          <strong>{swapSignal.confidencePct}%</strong>
        </div>
      )}
      <div className="manager-command-player-tile-main">
        <PlayerNameWithHeadshot
          playerId={player.player_id}
          playerName={player.name}
          team={player.playerDetails?.team}
          position={player.pos}
        />
      </div>
      {note && <p className="manager-command-player-tile-note">{note}</p>}
      <div className="manager-command-player-tile-pills">
        <div className="manager-command-player-tile-pills-main">
          <TeamLogoPill team={player.playerDetails?.team} />
          {showValueStack ? (
            <>
              <span className="manager-command-season-value manager-command-dynasty-value manager-command-value-rank-pill">
                <span className="manager-command-value-label">
                  <em>Dynasty</em>
                  {formatCompactValue(dynastyLens.value)}
                </span>
                <PositionRankPill rank={dynastyLens.rank} />
              </span>
              <span className="manager-command-season-value manager-command-value-rank-pill">
                <span className="manager-command-value-label">
                  <em>Season</em>
                  {formatCompactValue(seasonLens.value)}
                </span>
                <PositionRankPill rank={seasonLens.rank} />
              </span>
            </>
          ) : (
            <>
              <span className={valueLens.className}>
                <em>{valueLens.label}</em>
                {formatCompactValue(valueLens.value)}
              </span>
              <PositionRankPill rank={seasonRank} />
            </>
          )}
        </div>
        {shouldShowStatusPill && (
          <div className="manager-command-player-status-row">
            <span
              className={`manager-command-status-pill is-${availability.tone}`}
            >
              {availability.label}
            </span>
            {gameLockState.label && (
              <span
                className={`manager-command-status-pill manager-command-lock-status ${gameLockState.isLocked ? "is-locked" : "is-locking"}`}
                title={gameLockState.reason || undefined}
              >
                <LockKeyhole aria-hidden="true" />
                {gameLockState.label}
              </span>
            )}
            {swapSignal?.detail && (
              <span
                className={`manager-command-status-pill manager-command-swap-status is-${swapSignal.role === "out" ? "risk" : "active"}`}
              >
                {swapSignal.detail}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

type CommandPlayer =
  | ManagerIntelPlayer
  | NonNullable<
      ReportData["managerPositionCounts"][number]["starterPlayers"]
    >[number];

type LineupSwapSeverity = "watch" | "recommended" | "urgent";

type LineupSwapOption = {
  player: CommandPlayer;
  confidencePct: number;
  scoreEdge: number;
  projectedPointEdge: number | null;
  fitLabel: string;
  reason: string;
  reasonBullets: string[];
};

type LineupSwapRecommendation = {
  starterOut: CommandPlayer;
  groupLabel: string;
  severity: LineupSwapSeverity;
  summary: string;
  options: LineupSwapOption[];
};

type CommandSwapSignal = {
  role: "out" | "in";
  confidencePct: number;
  label: string;
  detail?: string;
};

function getFiniteNumber(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function getFirstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = getFiniteNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

function getFirstTextValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getCommandPlayerProjectionRead(player: CommandPlayer): {
  projectedPoints: number | null;
  sourceLabel: string | null;
} {
  const playerRecord = player as unknown as Record<string, unknown>;
  const details = player.playerDetails as
    | (PlayerDetails & Record<string, unknown>)
    | undefined;
  const valueProfile = details?.valueProfile as
    | (NonNullable<PlayerDetails["valueProfile"]> & Record<string, unknown>)
    | undefined;
  const projectedPoints = getFirstFiniteNumber(
    playerRecord.weeklyProjection,
    playerRecord.projectedPoints,
    playerRecord.projectedFantasyPoints,
    playerRecord.projection,
    playerRecord.fantasyProjection,
    details?.weeklyProjection,
    details?.projectedPoints,
    details?.projectedFantasyPoints,
    details?.projection,
    details?.fantasyProjection,
    valueProfile?.weeklyProjection,
    valueProfile?.projectedPoints,
    valueProfile?.projectedFantasyPoints,
    valueProfile?.fantasyProsProjection,
    valueProfile?.fantasyProsProjectedPoints
  );

  return {
    projectedPoints,
    sourceLabel: projectedPoints !== null ? "stored weekly projection" : null,
  };
}

function formatLineupLockCountdown(
  kickoffMs: number,
  nowMs = Date.now()
): string {
  const remainingMs = Math.max(0, kickoffMs - nowMs);
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Locks in ${days}d ${hours}h`;
  if (hours > 0) return `Locks in ${hours}h ${minutes}m`;
  return `Locks in ${minutes}m`;
}

function getCommandPlayerGameLockState(player: CommandPlayer): {
  isLocked: boolean;
  label: string | null;
  reason: string | null;
} {
  const playerRecord = player as unknown as Record<string, unknown>;
  const details = player.playerDetails as
    | (PlayerDetails & Record<string, unknown>)
    | undefined;
  const explicitLock = [
    playerRecord.isLocked,
    playerRecord.locked,
    playerRecord.gameLocked,
    playerRecord.lineupLocked,
    details?.isLocked,
    details?.locked,
    details?.gameLocked,
    details?.lineupLocked,
  ].some(
    value => value === true || value === "true" || value === 1 || value === "1"
  );

  if (explicitLock) {
    return {
      isLocked: true,
      label: "Locked",
      reason: "The player is marked as lineup locked by the report data.",
    };
  }

  const status = getFirstTextValue(
    playerRecord.gameStatus,
    playerRecord.status,
    playerRecord.lineupStatus,
    details?.gameStatus,
    details?.status,
    details?.lineupStatus
  );
  if (
    status &&
    !/pre|scheduled|upcoming|not[_\s-]?started/i.test(status) &&
    /locked|started|live|in[_\s-]?progress|halftime|final|complete/i.test(
      status
    )
  ) {
    return {
      isLocked: true,
      label: "Locked",
      reason: `Game status is ${status}.`,
    };
  }

  const kickoffValue =
    getFirstTextValue(
      playerRecord.kickoffAt,
      playerRecord.gameStartTime,
      playerRecord.gameStart,
      playerRecord.startTime,
      playerRecord.kickoff,
      details?.kickoffAt,
      details?.gameStartTime,
      details?.gameStart,
      details?.startTime,
      details?.kickoff
    ) ??
    getFirstFiniteNumber(
      playerRecord.kickoffAt,
      playerRecord.gameStartTime,
      playerRecord.gameStart,
      playerRecord.startTime,
      playerRecord.kickoff,
      details?.kickoffAt,
      details?.gameStartTime,
      details?.gameStart,
      details?.startTime,
      details?.kickoff
    );
  if (kickoffValue !== null) {
    const rawTime =
      typeof kickoffValue === "number"
        ? kickoffValue
        : Date.parse(kickoffValue);
    const kickoffMs =
      rawTime && rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime;
    if (Number.isFinite(kickoffMs) && kickoffMs <= Date.now()) {
      return {
        isLocked: true,
        label: "Locked",
        reason: "Kickoff time has passed.",
      };
    }
    if (Number.isFinite(kickoffMs)) {
      return {
        isLocked: false,
        label: formatLineupLockCountdown(kickoffMs),
        reason:
          "Projected lineup lock is based on kickoff time in the report data.",
      };
    }
  }

  return { isLocked: false, label: null, reason: null };
}

function formatProjectedPointEdge(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)} pts`;
}

function getCommandPlayerSeasonScore(player: CommandPlayer): number {
  const seasonLens = getCommandPlayerSeasonLens(player);
  const projectionRead = getCommandPlayerProjectionRead(player);
  const projectionScore =
    projectionRead.projectedPoints !== null
      ? projectionRead.projectedPoints * 420
      : 0;
  const value = Number(
    seasonLens.value ?? player.seasonValue ?? player.value ?? 0
  );
  const rank = parsePositionRankValue(
    seasonLens.rank || player.seasonPositionRank || player.currentPositionRank
  );
  const rankScore = rank ? Math.max(0, 2300 - rank * 24) : 0;
  const availability = getPlayerAvailability(player.playerDetails);
  const availabilityPenalty =
    availability.tone === "risk"
      ? 420
      : availability.tone === "warning"
        ? 220
        : 0;
  return Math.max(projectionScore, value || 0, rankScore) - availabilityPenalty;
}

function getLineupGroupEligiblePositions(group: {
  key?: string;
  label?: string;
}): CountPosition[] {
  const key = String(group.key || group.label || "").toUpperCase();
  if (key.includes("QB_SF") || key.includes("QB/SF") || key.includes("SUPER"))
    return ["QB", "RB", "WR", "TE"];
  if (key.includes("FLEX")) return ["RB", "WR", "TE"];
  if (key.includes("QB")) return ["QB"];
  if (key.includes("RB")) return ["RB"];
  if (key.includes("WR")) return ["WR"];
  if (key.includes("TE")) return ["TE"];
  if (key.includes("DEF")) return ["DEF"];
  if (key.includes("K")) return ["K"];
  return ["RB", "WR", "TE"];
}

function isLineupSwapEligible(
  group: { key?: string; label?: string },
  player: CommandPlayer
): boolean {
  return getLineupGroupEligiblePositions(group).includes(
    player.pos as CountPosition
  );
}

function getLineupSwapSeverity(
  confidencePct: number,
  scoreEdge: number,
  projectedPointEdge: number | null
): LineupSwapSeverity {
  if (projectedPointEdge !== null && projectedPointEdge >= 4) return "urgent";
  if (projectedPointEdge !== null && projectedPointEdge >= 2.2)
    return "recommended";
  if (confidencePct >= 82 || scoreEdge >= 650) return "urgent";
  if (confidencePct >= 70 || scoreEdge >= 360) return "recommended";
  return "watch";
}

function getLineupSwapSeverityLabel(severity: LineupSwapSeverity): string {
  if (severity === "urgent") return "Swap pressure";
  if (severity === "recommended") return "Recommended";
  return "Watch";
}

function getManagerMatchupPreview(data: ReportData, manager?: string | null) {
  if (!manager) return null;
  const normalized = normalizeReportManagerName(manager);
  return (
    data.matchupPreviews?.find(
      row => normalizeReportManagerName(row.manager) === normalized
    ) || null
  );
}

function buildLineupSwapRecommendations({
  data,
  manager,
  lineupGroups,
  stepInGroups,
  selectedIntel,
}: {
  data: ReportData;
  manager?: string | null;
  lineupGroups: Array<{
    key?: string;
    label?: string;
    count?: number;
    players: CommandPlayer[];
  }>;
  stepInGroups: Array<{ label: string; players: CommandPlayer[] }>;
  selectedIntel?: ManagerRosterIntelRows[number] | null;
}): LineupSwapRecommendation[] {
  const benchPlayers = stepInGroups.flatMap(group => group.players);
  if (!benchPlayers.length) return [];

  const matchup = getManagerMatchupPreview(data, manager);
  const vulnerableIds = new Set(
    [
      ...(matchup?.vulnerableSpots || []),
      ...(matchup?.boomBustRisks || []),
      selectedIntel?.weakestStarter,
      selectedIntel?.starterAvailability?.riskiestStarter,
    ]
      .filter(Boolean)
      .map(player => player?.player_id)
  );
  const mustStartIds = new Set(
    (matchup?.mustStarts || []).map(player => player.player_id)
  );
  const recommendations: LineupSwapRecommendation[] = [];

  lineupGroups.forEach(group => {
    const fitLabel = getSwapFitLabel(group.label || group.key);
    group.players.forEach(starter => {
      if (mustStartIds.has(starter.player_id)) return;
      if (getCommandPlayerGameLockState(starter).isLocked) return;

      const starterScore = getCommandPlayerSeasonScore(starter);
      const starterProjection = getCommandPlayerProjectionRead(starter);
      const starterIsFlagged = vulnerableIds.has(starter.player_id);
      const options = benchPlayers
        .filter(
          candidate =>
            candidate.player_id !== starter.player_id &&
            isLineupSwapEligible(group, candidate)
        )
        .filter(candidate => !getCommandPlayerGameLockState(candidate).isLocked)
        .map(candidate => {
          const candidateScore = getCommandPlayerSeasonScore(candidate);
          const candidateProjection = getCommandPlayerProjectionRead(candidate);
          const scoreEdge = candidateScore - starterScore;
          const projectedPointEdge =
            candidateProjection.projectedPoints !== null &&
            starterProjection.projectedPoints !== null
              ? Math.round(
                  (candidateProjection.projectedPoints -
                    starterProjection.projectedPoints) *
                    10
                ) / 10
              : null;
          const samePositionBonus = candidate.pos === starter.pos ? 4 : 0;
          const flaggedBonus = starterIsFlagged ? 8 : 0;
          const edgePct =
            starterScore > 0
              ? (scoreEdge / Math.max(starterScore, 1)) * 100
              : scoreEdge > 0
                ? 14
                : 0;
          const projectionBonus =
            projectedPointEdge !== null
              ? Math.max(-8, Math.min(18, projectedPointEdge * 4.5))
              : 0;
          const confidencePct = clampPercentValue(
            58 +
              edgePct * 1.35 +
              projectionBonus +
              samePositionBonus +
              flaggedBonus
          );
          const candidateRank =
            getCommandPlayerSeasonLens(candidate).rank ||
            candidate.seasonPositionRank ||
            candidate.currentPositionRank ||
            candidate.pos;
          const starterRank =
            getCommandPlayerSeasonLens(starter).rank ||
            starter.seasonPositionRank ||
            starter.currentPositionRank ||
            starter.pos;
          const projectedPointCopy =
            formatProjectedPointEdge(projectedPointEdge);
          const reasonBullets = [
            projectedPointCopy
              ? `Stored weekly projection edge: ${candidate.name} is ${projectedPointCopy} ahead of ${starter.name}.`
              : `No ready stored weekly projection is attached for this matchup; using current-season value, rank, and availability.`,
            scoreEdge > 0
              ? `Starter-score edge: ${formatCompactValue(scoreEdge)} in the current-season model.`
              : starterIsFlagged
                ? `${starter.name} is already flagged by the matchup or availability model.`
                : `${candidate.name} is close enough to monitor before lineup lock.`,
            candidateRank && starterRank
              ? `Season ranks: ${candidate.name} ${candidateRank}, ${starter.name} ${starterRank}.`
              : null,
            starterIsFlagged
              ? `${starter.name} appears in the vulnerable starter set for this manager.`
              : null,
            candidateProjection.sourceLabel
              ? `Stored weekly projection context is attached.`
              : null,
          ].filter(Boolean) as string[];
          const reason =
            scoreEdge > 0
              ? `${candidate.name} clears ${starter.name} by ${formatCompactValue(scoreEdge)} in current-season starter score.`
              : starterIsFlagged
                ? `${starter.name} is already flagged, and ${candidate.name} is the closest eligible cover.`
                : `${candidate.name} is close enough to monitor against ${starter.name} before lock.`;
          return {
            player: candidate,
            confidencePct,
            scoreEdge,
            projectedPointEdge,
            fitLabel,
            reason:
              `${reason} ${projectedPointCopy ? `${projectedPointCopy} weekly projection edge.` : ""} ${candidateRank && starterRank ? `${candidateRank} vs ${starterRank}.` : ""}`.trim(),
            reasonBullets,
          };
        })
        .filter(
          option =>
            option.scoreEdge >= 125 ||
            (option.projectedPointEdge !== null &&
              option.projectedPointEdge >= 0.8) ||
            (starterIsFlagged && option.confidencePct >= 62)
        )
        .sort(
          (a, b) =>
            b.confidencePct - a.confidencePct || b.scoreEdge - a.scoreEdge
        )
        .slice(0, 3)
        .reduce<LineupSwapOption[]>((adjusted, option, index) => {
          const previousConfidence =
            adjusted[index - 1]?.confidencePct ?? option.confidencePct;
          adjusted.push({
            ...option,
            confidencePct:
              index === 0
                ? option.confidencePct
                : Math.min(
                    option.confidencePct,
                    Math.max(0, previousConfidence - 7)
                  ),
          });
          return adjusted;
        }, []);

      if (!options.length) return;
      const topOption = options[0];
      const severity = getLineupSwapSeverity(
        topOption.confidencePct,
        topOption.scoreEdge,
        topOption.projectedPointEdge
      );
      recommendations.push({
        starterOut: starter,
        groupLabel: fitLabel,
        severity,
        summary: `${starter.name} is the tile to pressure-test. ${topOption.player.name} is the strongest replacement signal at ${topOption.confidencePct}% confidence${formatProjectedPointEdge(topOption.projectedPointEdge) ? ` with a ${formatProjectedPointEdge(topOption.projectedPointEdge)} projection edge` : ""}.`,
        options,
      });
    });
  });

  return recommendations
    .sort((a, b) => {
      const severityRank: Record<LineupSwapSeverity, number> = {
        urgent: 0,
        recommended: 1,
        watch: 2,
      };
      return (
        severityRank[a.severity] - severityRank[b.severity] ||
        b.options[0].confidencePct - a.options[0].confidencePct ||
        b.options[0].scoreEdge - a.options[0].scoreEdge
      );
    })
    .slice(0, 4);
}

function ManagerDepthTile({
  manager,
  avatarUrl,
  badges,
  subtitle,
  subtitleTone = "neutral",
  scoreStrip,
  onClick,
  className = "",
}: {
  manager: string;
  avatarUrl?: string | null;
  badges: OwnerSignalTag[];
  subtitle?: string | null;
  subtitleTone?: OwnerSignalTone;
  scoreStrip?: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  const isViewerTile = className.includes("viewer-owned-highlight");
  const orderedBadges = orderOwnerBadgesForCompactRows(badges);

  return (
    <button
      type="button"
      className={`command-depth-tile ${className}`}
      onClick={onClick}
      aria-label={`Open ${manager} manager details`}
    >
      {avatarUrl && (
        <>
          <img src={avatarUrl} alt="" className="command-depth-tile-wash" />
          <img src={avatarUrl} alt="" className="command-depth-tile-mark" />
        </>
      )}
      <span className="command-depth-tile-scrim" />
      <span className="command-depth-tile-main">
        <ChampionAvatarFrame
          managerName={manager}
          className="command-depth-champion"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={manager}
              className="command-depth-avatar"
            />
          ) : (
            <span className="command-depth-avatar">
              {manager[0]?.toUpperCase() || "?"}
            </span>
          )}
        </ChampionAvatarFrame>
        <span className="command-depth-copy">
          <span className="command-depth-name">{manager}</span>
          {subtitle && (
            <span
              className={`command-depth-subtitle command-depth-subtitle-${subtitleTone}`}
            >
              {subtitle}
            </span>
          )}
        </span>
      </span>
      {scoreStrip && (
        <span className="command-depth-score-row">{scoreStrip}</span>
      )}
      <span className="command-depth-badges">
        {orderedBadges.map(badge => (
          <CommandMiniBadge key={badge.label} tone={badge.tone}>
            {badge.label}
          </CommandMiniBadge>
        ))}
      </span>
      {isViewerTile && (
        <span className="active-owner-badge">
          <span>Your</span>
          <span>Team</span>
        </span>
      )}
    </button>
  );
}

function orderOwnerBadgesForCompactRows(badges: OwnerSignalTag[]) {
  const remaining = [...badges].sort(
    (a, b) => b.label.length - a.label.length
  );
  const ordered: OwnerSignalTag[] = [];

  while (remaining.length) {
    const longest = remaining.shift();
    if (longest) ordered.push(longest);

    const shortest = remaining.pop();
    if (shortest) ordered.push(shortest);
  }

  return ordered;
}

function OwnerQuickModal({
  open,
  onOpenChange,
  title,
  manager,
  avatarUrl,
  metrics,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  manager?: string | null;
  avatarUrl?: string | null;
  metrics: Array<{
    label: string;
    value: React.ReactNode;
    tone?: "neutral" | "positive" | "negative";
  }>;
  note?: string;
}) {
  if (!manager) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="owner-quick-modal manager-command-dialog max-w-2xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {manager} {title}
          </DialogTitle>
          <DialogDescription>Owner detail summary.</DialogDescription>
        </DialogHeader>
        <div className="manager-command-modal-inner">
          <div className="manager-command-hero owner-quick-hero">
            {avatarUrl && (
              <>
                <img src={avatarUrl} alt="" className="manager-hero-wash" />
                <img
                  src={avatarUrl}
                  alt=""
                  className="manager-hero-watermark"
                />
              </>
            )}
            <div className="manager-hero-scrim" />
            <button
              type="button"
              className="manager-modal-close"
              onClick={() => onOpenChange(false)}
              aria-label={`Close ${manager} details`}
            >
              <XIcon aria-hidden="true" />
            </button>
            <div className="manager-command-title-lockup">
              <ChampionAvatarFrame
                managerName={manager}
                className="manager-command-champion-frame"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={manager}
                    className="manager-command-avatar"
                  />
                ) : (
                  <span className="manager-command-avatar">
                    {manager[0]?.toUpperCase() || "?"}
                  </span>
                )}
              </ChampionAvatarFrame>
              <div className="min-w-0">
                <p>{title}</p>
                <h3 className={getManagerHeadingClassName(manager)}>
                  {manager}
                </h3>
                <ManagerChampionshipPills
                  managerName={manager}
                  className="manager-command-championships"
                />
              </div>
            </div>
            <div className="manager-command-hero-metrics owner-quick-metrics">
              {metrics.slice(0, 6).map(metric => (
                <IntelligenceMetric
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  tone={metric.tone}
                />
              ))}
            </div>
          </div>
          {note && (
            <div className="manager-command-body owner-quick-body">
              <div className="manager-command-section manager-command-read">
                <h4>Read</h4>
                <p>{note}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LeagueCommandCenter({
  data,
  managerAvatars,
  leagueId,
  leagueLogo,
  section = "all",
  viewerManager,
  currentStandings,
  leagueValueMode: leagueValueModeInput = "dynasty",
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
  section?: "all" | "roster" | "taxi";
  viewerManager?: string | null;
  currentStandings?: ReportData["currentStandings"];
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const intel = data.managerRosterIntelligence || [];
  const leagueValueMode = normalizeLeagueValueMode(
    leagueValueModeInput ||
      data.leagueDiagnostics?.valueMode ||
      data.leagueValueMode
  );
  const isRedraft = leagueValueMode === "redraft";
  const isVisibleManager = (manager?: string | null) =>
    !(isRedraft && isPlaceholderManagerName(manager));
  const visibleIntel = intel.filter(row => isVisibleManager(row.manager));
  const starterDepth = (data.managerPositionCounts || [])
    .filter(row => isVisibleManager(row.manager))
    .map(row => {
      const rowIntel = intel.find(item => item.manager === row.manager);
      const starterSeasonValue = (row.starterPlayers || []).reduce(
        (sum, player) => sum + (player.seasonValue || player.value || 0),
        0
      );

      return {
        manager: row.manager,
        starterCount:
          row.QB_starters +
          row.RB_starters +
          row.WR_starters +
          row.TE_starters +
          (row.K_starters || 0) +
          (row.DEF_starters || 0),
        totalPlayers:
          row.QB + row.RB + row.WR + row.TE + (row.K || 0) + (row.DEF || 0),
        starterSeasonValue,
        starterAvailability: rowIntel?.starterAvailability,
        rosterHealthScore: rowIntel?.rosterHealthScore,
        pressurePoints: rowIntel?.pressurePoints || [],
      };
    })
    .sort(
      (a, b) =>
        b.starterCount - a.starterCount ||
        b.starterSeasonValue - a.starterSeasonValue ||
        b.totalPlayers - a.totalPlayers ||
        compareManagersByViewerAndStanding(a.manager, b.manager, {
          viewerManager,
          standings: currentStandings,
          leagueOverview: data.leagueOverview,
        })
    );
  const taxiDepth = visibleIntel
    .filter(row => row.taxiTriage?.items.length)
    .map(row => ({
      manager: row.manager,
      taxiTriage: row.taxiTriage,
    }))
    .sort((a, b) => {
      const aPromote = a.taxiTriage.counts["Promote Now"] || 0;
      const bPromote = b.taxiTriage.counts["Promote Now"] || 0;
      const aCut = a.taxiTriage.counts.Cuttable || 0;
      const bCut = b.taxiTriage.counts.Cuttable || 0;
      return (
        bPromote - aPromote ||
        bCut - aCut ||
        b.taxiTriage.items.length - a.taxiTriage.items.length ||
        compareManagersByViewerAndStanding(a.manager, b.manager, {
          viewerManager,
          standings: currentStandings,
          leagueOverview: data.leagueOverview,
        })
      );
    });
  const selectedIntel = selectedManager
    ? visibleIntel.find(row => row.manager === selectedManager)
    : null;
  const selectedCounts = selectedManager
    ? data.managerPositionCounts.find(row => row.manager === selectedManager && isVisibleManager(row.manager))
    : null;
  const openManager = (manager: string) => setSelectedManager(manager);
  const openCommandPlayerForManager = (
    manager: string,
    player: CommandPlayer
  ) => {
    const valueLens =
      leagueValueMode === "redraft"
        ? {
            label: "Season",
            value:
              getCommandPlayerSeasonLens(player).value ??
              player.seasonValue ??
              player.value,
            className: "manager-command-season-value",
            kind: "season" as const,
          }
        : getCommandPlayerValueLens(player);
    const rank =
      valueLens.kind === "season"
        ? player.seasonPositionRank || player.currentPositionRank || player.pos
        : player.currentPositionRank || player.seasonPositionRank || player.pos;
    const taxiRead = player as Partial<TaxiTriageItem>;
    setSelectedPlayer(
      buildPlayerModalData({
        playerId: player.player_id,
        playerName: player.name,
        playerPos: player.pos,
        value: valueLens.value,
        playerDetails: player.playerDetails,
        playerDetailsById: data.playerDetailsById,
        manager: player.owner || manager,
        managerAvatarUrl: managerAvatars?.[player.owner || manager],
        currentPositionRank: rank,
        valueMode:
          leagueValueMode === "redraft" || valueLens.kind === "season"
            ? "redraft"
            : "dynasty",
        taxiAction: taxiRead.taxiAction,
        taxiReason: taxiRead.taxiReason,
      })
    );
  };
  const openCommandPlayer = (player: CommandPlayer) => {
    if (!selectedManager) return;
    openCommandPlayerForManager(selectedManager, player);
  };
  const selectedStarters = selectedCounts?.starterPlayers || [];
  const selectedLineupPlayers =
    selectedCounts?.lineupPlayers || selectedStarters;
  const fallbackStarterGroups = (players: typeof selectedStarters) => {
    const used = new Set<string>();
    const take = (position: string, count: number) => {
      const picked = players
        .filter(
          player => player.pos === position && !used.has(player.player_id)
        )
        .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value))
        .slice(0, count);
      picked.forEach(player => used.add(player.player_id));
      return picked;
    };
    const qbs = take("QB", 2);
    const rbs = take("RB", 2);
    const wrs = take("WR", 2);
    const tes = take("TE", 1);
    const flex = players
      .filter(
        player =>
          ["RB", "WR", "TE"].includes(player.pos) && !used.has(player.player_id)
      )
      .sort((a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value))
      .slice(0, 2);
    return [
      { key: "QB_SF", label: "QB / SF", count: 2, players: qbs },
      { key: "RB", label: "RB", count: 2, players: rbs },
      { key: "WR", label: "WR", count: 2, players: wrs },
      { key: "TE", label: "TE", count: 1, players: tes },
      { key: "FLEX", label: "Flex", count: 2, players: flex },
    ];
  };
  const rawLineupGroups = selectedCounts?.starterGroups?.length
    ? sortLineupGroupsForDisplay(
        selectedCounts.starterGroups.map(group => ({
          key: group.key,
          label: group.label,
          count: group.count,
          players: group.players || [],
        }))
      )
    : sortLineupGroupsForDisplay(fallbackStarterGroups(selectedStarters));
  const lineupGroups = combineSuperflexQuarterbackGroups(rawLineupGroups);
  const projectedLineupIds = new Set(
    (selectedStarters.length
      ? selectedStarters
      : lineupGroups.flatMap(group => group.players)
    ).map(player => player.player_id)
  );
  const hasKickerSlot = lineupGroups.some(
    group =>
      group.players.some(player => player.pos === "K") ||
      /^K\b/i.test(group.label)
  );
  const hasDefenseSlot = lineupGroups.some(
    group =>
      group.players.some(player => player.pos === "DEF") ||
      /^DEF\b/i.test(group.label)
  );
  const canStepInGroups = [
    {
      label: "QB",
      players: selectedLineupPlayers
        .filter(
          player =>
            player.pos === "QB" && !projectedLineupIds.has(player.player_id)
        )
        .sort(
          (a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)
        ),
    },
    {
      label: "Flex",
      players: selectedLineupPlayers
        .filter(
          player =>
            ["RB", "WR", "TE"].includes(player.pos) &&
            !projectedLineupIds.has(player.player_id)
        )
        .sort(
          (a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)
        ),
    },
    hasKickerSlot
      ? {
          label: "K",
          players: selectedLineupPlayers
            .filter(
              player =>
                player.pos === "K" && !projectedLineupIds.has(player.player_id)
            )
            .sort(
              (a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)
            ),
        }
      : null,
    hasDefenseSlot
      ? {
          label: "DEF",
          players: selectedLineupPlayers
            .filter(
              player =>
                player.pos === "DEF" &&
                !projectedLineupIds.has(player.player_id)
            )
            .sort(
              (a, b) => (b.seasonValue || b.value) - (a.seasonValue || a.value)
            ),
        }
      : null,
  ].filter(
    (
      group
    ): group is { label: string; players: typeof selectedLineupPlayers } =>
      Boolean(group && group.players.length)
  );
  const lineupSwapRecommendations = buildLineupSwapRecommendations({
    data,
    manager: selectedManager,
    lineupGroups,
    stepInGroups: canStepInGroups,
    selectedIntel,
  });
  const swapByStarterId = new Map(
    lineupSwapRecommendations.map(recommendation => [
      recommendation.starterOut.player_id,
      recommendation,
    ])
  );
  const swapOptionByPlayerId = new Map<string, LineupSwapOption>();
  lineupSwapRecommendations.forEach(recommendation => {
    recommendation.options.forEach(option => {
      const existing = swapOptionByPlayerId.get(option.player.player_id);
      if (!existing || option.confidencePct > existing.confidencePct) {
        swapOptionByPlayerId.set(option.player.player_id, option);
      }
    });
  });
  const selectedStarterSeasonValue = selectedStarters.reduce(
    (sum, player) => sum + (player.seasonValue || player.value || 0),
    0
  );
  const selectedTaxiCount = selectedIntel?.taxiTriage?.items.length || 0;
  const selectedTaxiPromoteCount =
    selectedIntel?.taxiTriage?.counts["Promote Now"] || 0;
  const selectedTaxiParkedCount =
    selectedIntel?.taxiTriage?.counts["Keep Parked"] || 0;
  const selectedTaxiCutCount = selectedIntel?.taxiTriage?.counts.Cuttable || 0;
  const selectedTaxiItems = sortTaxiTriageItems(
    selectedIntel?.taxiTriage?.items || []
  );
  const selectedSeasonTags = (() => {
    if (!selectedIntel) return [];
    const starterCount = selectedCounts
      ? selectedCounts.QB_starters +
        selectedCounts.RB_starters +
        selectedCounts.WR_starters +
        selectedCounts.TE_starters +
        (selectedCounts.K_starters || 0) +
        (selectedCounts.DEF_starters || 0)
      : 0;
    const tags: Array<{
      label: string;
      tone: "neutral" | "good" | "warn" | "danger" | "future";
    }> = [
      starterCount
        ? {
            label: `${starterCount} ${selectedCounts?.starterSource === "Sleeper" ? "Sleeper starters" : "projected starters"}`,
            tone: "neutral",
          }
        : null,
      selectedStarterSeasonValue
        ? {
            label: `Season value ${formatCompactValue(selectedStarterSeasonValue)}`,
            tone: "good",
          }
        : null,
      selectedIntel.rosterHealthScore !== null &&
      selectedIntel.rosterHealthScore !== undefined
        ? {
            label: `Health ${selectedIntel.rosterHealthScore}`,
            tone:
              selectedIntel.rosterHealthScore >= 75
                ? "good"
                : selectedIntel.rosterHealthScore <= 45
                  ? "danger"
                  : "warn",
          }
        : null,
      selectedIntel.starterAvailability?.riskLevel === "high"
        ? { label: "Injury Watch", tone: "danger" }
        : null,
      selectedIntel.holes.summary &&
      selectedIntel.holes.summary !== "No major roster hole flagged"
        ? {
            label: titleCasePill(
              selectedIntel.holes.summary.split(",")[0]?.trim() ||
                "Lineup Pressure"
            ),
            tone: "warn",
          }
        : null,
      lineupSwapRecommendations.length
        ? {
            label: `${lineupSwapRecommendations.length} start/sit calls`,
            tone: "warn",
          }
        : null,
      selectedIntel.pressurePoints?.length
        ? {
            label: `${selectedIntel.pressurePoints.length} pressure flags`,
            tone: "warn",
          }
        : null,
    ].filter(Boolean) as Array<{
      label: string;
      tone: "neutral" | "good" | "warn" | "danger" | "future";
    }>;
    return tags.slice(0, 6);
  })();
  const startingRosterStrengthTiles = sortLineupGroupsForDisplay(
    selectedIntel?.startingRosterStrength || []
  );
  const hasStartingRosterStrength =
    startingRosterStrengthTiles.length > 0 ||
    Boolean(selectedIntel?.positionGrades);

  return (
    <>
      <div className="command-center-grid">
        {section !== "taxi" && (
          <FeatureCard
            number={1}
            title="Projected Roster Board"
            kicker="Season starter room"
            className="command-feature-card-wide"
            hideNumber
            hideHeader={section !== "all"}
          >
            <div
              className="command-depth-grid balanced-tile-grid"
              style={getBalancedGridStyle(starterDepth.length)}
            >
              {starterDepth.map(row => (
                <ManagerDepthTile
                  key={row.manager}
                  manager={row.manager}
                  avatarUrl={managerAvatars?.[row.manager]}
                  className={`${viewerOwnedHighlightClass(
                    row.manager,
                    viewerManager
                  )} projected-roster-depth-tile`.trim()}
                  badges={[
                    { label: `${row.starterCount} starters`, tone: "neutral" },
                    ...(row.starterSeasonValue
                      ? [
                          {
                            label: `Starters ${formatCompactValue(row.starterSeasonValue)}`,
                            tone: "good" as const,
                          },
                        ]
                      : []),
                    ...(row.starterAvailability?.avgGamesMissed !== null &&
                    row.starterAvailability?.avgGamesMissed !== undefined
                      ? [
                          {
                            label: `${row.starterAvailability.avgGamesMissed} missed/gm`,
                            tone:
                              row.starterAvailability.riskLevel === "high"
                                ? ("danger" as const)
                                : row.starterAvailability.riskLevel === "medium"
                                  ? ("warn" as const)
                                  : ("good" as const),
                          },
                        ]
                      : []),
                    ...(row.rosterHealthScore
                      ? [
                          {
                            label: `Health ${row.rosterHealthScore}`,
                            tone:
                              row.rosterHealthScore >= 75
                                ? ("good" as const)
                                : row.rosterHealthScore <= 45
                                  ? ("danger" as const)
                                  : ("warn" as const),
                          },
                        ]
                      : []),
                  ]}
                  onClick={() => openManager(row.manager)}
                />
              ))}
            </div>
          </FeatureCard>
        )}

        {section !== "roster" && taxiDepth.length ? (
          <FeatureCard
            number={2}
            title="Taxi Squad Triage"
            kicker="Taxi-only activation checks"
            className="command-feature-card-wide"
            hideNumber
            hideHeader={section !== "all"}
          >
            {section === "taxi" ? (
              <div className="manager-command-taxi-overview-list">
                {taxiDepth.map(row => {
                  const taxiItems = sortTaxiTriageItems(
                    row.taxiTriage.items || []
                  );

                  return (
                    <section
                      key={row.manager}
                      className="manager-command-taxi-overview-group"
                    >
                      <ManagerDepthTile
                        manager={row.manager}
                        avatarUrl={managerAvatars?.[row.manager]}
                        className={`taxi-triage-depth-tile ${viewerOwnedHighlightClass(
                          row.manager,
                          viewerManager
                        )}`}
                        subtitle={
                          row.taxiTriage.counts["Promote Now"]
                            ? `${row.taxiTriage.counts["Promote Now"]} promote`
                            : null
                        }
                        subtitleTone="balanced"
                        badges={[
                          {
                            label: `${row.taxiTriage.items.length} taxi`,
                            tone: "neutral",
                          },
                          ...(row.taxiTriage.counts["Keep Parked"]
                            ? [
                                {
                                  label: `${row.taxiTriage.counts["Keep Parked"]} stash`,
                                  tone: "future" as const,
                                },
                              ]
                            : []),
                          ...(row.taxiTriage.counts["Taxi Risk"]
                            ? [
                                {
                                  label: `${row.taxiTriage.counts["Taxi Risk"]} risk`,
                                  tone: "warn" as const,
                                },
                              ]
                            : []),
                          ...(row.taxiTriage.counts.Cuttable
                            ? [
                                {
                                  label: `${row.taxiTriage.counts.Cuttable} cuts`,
                                  tone: "danger" as const,
                                },
                              ]
                            : []),
                        ]}
                        onClick={() => openManager(row.manager)}
                      />
                      <div
                        className="manager-command-taxi-overview-player-grid manager-command-tile-grid balanced-tile-grid balanced-centered-tile-grid"
                        style={getBalancedGridStyle(
                          Math.max(taxiItems.length, 2),
                          2
                        )}
                      >
                        {taxiItems.map(player => (
                          <CommandPlayerTile
                            key={player.player_id}
                            label={getTaxiDisplayAction(player.taxiAction)}
                            note={player.taxiReason}
                            player={player}
                            showValueStack
                            onClick={() =>
                              openCommandPlayerForManager(row.manager, player)
                            }
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div
                className="command-depth-grid balanced-tile-grid"
                style={getBalancedGridStyle(taxiDepth.length)}
              >
                {taxiDepth.map(row => (
                  <ManagerDepthTile
                    key={row.manager}
                    manager={row.manager}
                    avatarUrl={managerAvatars?.[row.manager]}
                    className={`taxi-triage-depth-tile ${viewerOwnedHighlightClass(
                      row.manager,
                      viewerManager
                    )}`}
                    subtitle={
                      row.taxiTriage.counts["Promote Now"]
                        ? `${row.taxiTriage.counts["Promote Now"]} promote`
                        : null
                    }
                    subtitleTone="balanced"
                    badges={[
                      {
                        label: `${row.taxiTriage.items.length} taxi`,
                        tone: "neutral",
                      },
                      ...(row.taxiTriage.counts["Keep Parked"]
                        ? [
                            {
                              label: `${row.taxiTriage.counts["Keep Parked"]} stash`,
                              tone: "future" as const,
                            },
                          ]
                        : []),
                      ...(row.taxiTriage.counts["Taxi Risk"]
                        ? [
                            {
                              label: `${row.taxiTriage.counts["Taxi Risk"]} risk`,
                              tone: "warn" as const,
                            },
                          ]
                        : []),
                      ...(row.taxiTriage.counts.Cuttable
                        ? [
                            {
                              label: `${row.taxiTriage.counts.Cuttable} cuts`,
                              tone: "danger" as const,
                            },
                          ]
                        : []),
                    ]}
                    onClick={() => openManager(row.manager)}
                  />
                ))}
              </div>
            )}
          </FeatureCard>
        ) : null}
      </div>
      <Dialog
        open={selectedManager !== null}
        onOpenChange={open => !open && setSelectedManager(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="manager-command-dialog max-w-3xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedManager || "Manager"} Command Center
            </DialogTitle>
            <DialogDescription>
              Manager-level calculation details and data points.
            </DialogDescription>
          </DialogHeader>
          {selectedManager && (
            <div className="manager-command-modal-inner">
              <div className="manager-command-hero">
                {managerAvatars?.[selectedManager] && (
                  <>
                    <img
                      src={managerAvatars[selectedManager] || ""}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={managerAvatars[selectedManager] || ""}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <button
                  type="button"
                  className="manager-modal-close"
                  onClick={() => setSelectedManager(null)}
                  aria-label={`Close ${selectedManager} details`}
                >
                  <XIcon aria-hidden="true" />
                </button>
                <div className="manager-command-title-lockup">
                  <ChampionAvatarFrame
                    managerName={selectedManager}
                    className="manager-command-champion-frame"
                  >
                    {managerAvatars?.[selectedManager] ? (
                      <img
                        src={managerAvatars[selectedManager] || ""}
                        alt={selectedManager}
                        className="manager-command-avatar"
                      />
                    ) : (
                      <span className="manager-command-avatar">
                        {selectedManager[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>
                      {section === "taxi"
                        ? "Taxi Squad Triage"
                        : "Projected Season Roster"}
                    </p>
                    <h3 className={getManagerHeadingClassName(selectedManager)}>
                      {selectedManager}
                    </h3>
                    <ManagerChampionshipPills
                      managerName={selectedManager}
                      className="manager-command-championships"
                    />
                  </div>
                </div>
                <div
                  className={`manager-command-hero-metrics ${section === "taxi" ? "manager-command-hero-metrics-taxi" : "manager-command-hero-metrics-season"}`}
                >
                  {section === "taxi" ? (
                    <>
                      <IntelligenceMetric
                        label="Taxi"
                        value={selectedTaxiCount || "-"}
                      />
                      <IntelligenceMetric
                        label="Promote"
                        value={selectedTaxiPromoteCount || 0}
                        tone={selectedTaxiPromoteCount ? "positive" : "neutral"}
                      />
                      <IntelligenceMetric
                        label="Stash"
                        value={selectedTaxiParkedCount || 0}
                      />
                      <IntelligenceMetric
                        label="Cuts"
                        value={selectedTaxiCutCount || 0}
                        tone={selectedTaxiCutCount ? "negative" : "neutral"}
                      />
                    </>
                  ) : (
                    <>
                      <IntelligenceMetric
                        label="Season Value"
                        value={
                          selectedStarterSeasonValue
                            ? formatCompactValue(selectedStarterSeasonValue)
                            : "-"
                        }
                      />
                      <IntelligenceMetric
                        label="Health"
                        value={selectedIntel?.rosterHealthScore ?? "-"}
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="manager-command-body">
                {section === "taxi" ? (
                  selectedIntel?.taxiTriage?.items.length ? (
                    <div className="manager-command-section manager-command-taxi">
                      <p className="manager-command-taxi-note manager-command-taxi-note-primary">
                        Activation calls use current-season values and ranks
                        against active starters and injury fill-ins.
                      </p>
                      <div
                        className="manager-command-tile-grid balanced-tile-grid balanced-centered-tile-grid"
                        style={getBalancedGridStyle(
                          Math.max(selectedTaxiItems.length, 4),
                          4
                        )}
                      >
                        {selectedTaxiItems.map(player => (
                          <CommandPlayerTile
                            key={player.player_id}
                            label={getTaxiDisplayAction(player.taxiAction)}
                            note={player.taxiReason}
                            player={player}
                            showValueStack
                            onClick={() => openCommandPlayer(player)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="manager-command-section manager-command-taxi">
                      <h4>Taxi Squad Triage</h4>
                      <p className="manager-command-taxi-summary">
                        No taxi players reported by Sleeper for this roster.
                      </p>
                    </div>
                  )
                ) : (
                  <>
                    <StartingRosterRankTiles
                      manager={selectedManager}
                      managerPositionCounts={data.managerPositionCounts}
                    />
                    {hasStartingRosterStrength ? (
                      <div className="manager-command-section">
                        <h4 className="owner-intel-comparison-heading">
                          <span>{STARTING_ROSTER_STRENGTH_TITLE}</span>
                          <small>{STARTING_ROSTER_STRENGTH_COMPARISON}</small>
                        </h4>
                        <p className="owner-intel-section-note">
                          {STARTING_ROSTER_STRENGTH_NOTE}
                        </p>
                        <div className="owner-intel-heat-grid">
                          {startingRosterStrengthTiles.length
                            ? startingRosterStrengthTiles.map(tile => (
                                <span
                                  key={tile.key}
                                  className={getHeatPillClass(
                                    tile.key,
                                    tile.grade
                                  )}
                                  title={tile.note}
                                >
                                  <strong>{tile.label}</strong>
                                  <em>
                                    {tile.leagueRank
                                      ? `#${tile.leagueRank}`
                                      : "-"}
                                  </em>
                                  <small>{tile.grade || "Empty"}</small>
                                </span>
                              ))
                            : (["QB", "RB", "WR", "TE"] as const).map(pos => {
                                const grade =
                                  selectedIntel?.positionGrades?.[pos];
                                return (
                                  <span
                                    key={pos}
                                    className={getHeatPillClass(
                                      pos,
                                      grade?.grade
                                    )}
                                  >
                                    <strong>{pos}</strong>
                                    <em>
                                      {grade?.rank ? `#${grade.rank}` : "-"}
                                    </em>
                                    <small>{grade?.grade || "Empty"}</small>
                                  </span>
                                );
                              })}
                        </div>
                      </div>
                    ) : null}
                    {selectedSeasonTags.length ? (
                      <div
                        className="manager-command-tag-row"
                        aria-label="Season roster tags"
                      >
                        {selectedSeasonTags.map(tag => (
                          <span
                            key={tag.label}
                            className={`manager-intel-pill command-mini-badge-${tag.tone}`}
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="manager-command-grid">
                      <div className="manager-command-lineup-panel">
                        <h4>Projected Starters</h4>
                        <div className="manager-command-tile-lineup">
                          {lineupGroups.map(group => (
                            <div
                              key={group.label}
                              className="manager-command-tile-group"
                            >
                              <span>{group.label}</span>
                              <div
                                className="manager-command-tile-grid balanced-tile-grid"
                                style={getBalancedGridStyle(
                                  Math.max(group.players.length, 1)
                                )}
                              >
                                {group.players.length ? (
                                  group.players.map(player => (
                                    <CommandPlayerTile
                                      key={player.player_id}
                                      player={player}
                                      swapSignal={
                                        swapByStarterId.has(player.player_id)
                                          ? {
                                              role: "out",
                                              label: "Review",
                                              confidencePct:
                                                swapByStarterId.get(
                                                  player.player_id
                                                )?.options[0]?.confidencePct ||
                                                0,
                                              detail: "Swap watch",
                                            }
                                          : undefined
                                      }
                                      onClick={() => openCommandPlayer(player)}
                                    />
                                  ))
                                ) : (
                                  <span className="manager-command-empty-tile">
                                    Needs Help
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="manager-command-lineup-panel manager-command-lineup-panel-step">
                        <h4>Can Step In</h4>
                        <div className="manager-command-tile-lineup manager-command-step-in">
                          {canStepInGroups.length ? (
                            canStepInGroups.map(group => (
                              <div
                                key={group.label}
                                className="manager-command-tile-group"
                              >
                                <span>{group.label}</span>
                                <div
                                  className="manager-command-tile-grid balanced-tile-grid"
                                  style={getBalancedGridStyle(
                                    group.players.length
                                  )}
                                >
                                  {group.players.map(player => (
                                    <CommandPlayerTile
                                      key={player.player_id}
                                      player={player}
                                      variant="step"
                                      swapSignal={
                                        swapOptionByPlayerId.has(
                                          player.player_id
                                        )
                                          ? {
                                              role: "in",
                                              label: `Best Fit ${
                                                swapOptionByPlayerId.get(
                                                  player.player_id
                                                )?.fitLabel || group.label
                                              }`,
                                              confidencePct:
                                                swapOptionByPlayerId.get(
                                                  player.player_id
                                                )?.confidencePct || 0,
                                              detail: `Best Fit ${
                                                swapOptionByPlayerId.get(
                                                  player.player_id
                                                )?.fitLabel || group.label
                                              }`,
                                            }
                                          : undefined
                                      }
                                      onClick={() => openCommandPlayer(player)}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="manager-command-empty-tile">
                              No starter-grade depth
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {lineupSwapRecommendations.length ? (
                      <div className="manager-command-section manager-command-swap-read">
                        <h4>Start/Sit Swap Signals</h4>
                        <div className="manager-command-swap-grid">
                          {lineupSwapRecommendations.map(recommendation => {
                            const topOption = recommendation.options[0];
                            return (
                              <div
                                key={recommendation.starterOut.player_id}
                                className={`manager-command-swap-card manager-command-swap-card-${recommendation.severity}`}
                              >
                                <div className="manager-command-swap-card-head">
                                  <span>
                                    {getLineupSwapSeverityLabel(
                                      recommendation.severity
                                    )}
                                  </span>
                                  <strong>{recommendation.groupLabel}</strong>
                                </div>
                                <p>{recommendation.summary}</p>
                                <div className="manager-command-swap-flow">
                                  <span className="manager-command-swap-out-name">
                                    <em>Replace</em>
                                    <span className="manager-command-swap-player">
                                      <PlayerNameWithHeadshot
                                        playerId={
                                          recommendation.starterOut.player_id
                                        }
                                        playerName={
                                          recommendation.starterOut.name
                                        }
                                        team={
                                          recommendation.starterOut
                                            .playerDetails?.team
                                        }
                                        position={recommendation.starterOut.pos}
                                      />
                                    </span>
                                  </span>
                                  <ArrowRight
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  <div className="manager-command-swap-options">
                                    {recommendation.options.map(option => (
                                      <span
                                        key={option.player.player_id}
                                        title={option.reason}
                                      >
                                        <span className="manager-command-swap-player">
                                          <PlayerNameWithHeadshot
                                            playerId={option.player.player_id}
                                            playerName={option.player.name}
                                            team={option.player.playerDetails?.team}
                                            position={option.player.pos}
                                          />
                                        </span>
                                        <em>
                                          {option.confidencePct}%
                                          {formatProjectedPointEdge(
                                            option.projectedPointEdge
                                          )
                                            ? ` • ${formatProjectedPointEdge(option.projectedPointEdge)}`
                                            : ""}
                                        </em>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {topOption?.reasonBullets.length ? (
                                  <details className="manager-command-swap-details">
                                    <summary>Why this swap</summary>
                                    <ul>
                                      {topOption.reasonBullets.map(reason => (
                                        <li key={reason}>{reason}</li>
                                      ))}
                                    </ul>
                                  </details>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {selectedIntel?.pressurePoints?.length ? (
                      <div className="manager-command-section manager-command-pressure-points">
                        <h4>Pressure Points</h4>
                        <ul>
                          {selectedIntel.pressurePoints.map(point => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={data.playerDetailsById}
      />
    </>
  );
}

export function ManagerIntelligenceCards({
  data,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
}: {
  data?: ReportData["managerRosterIntelligence"];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  if (!data?.length) return null;
  const selectedRow = selectedManager
    ? data.find(row => row.manager === selectedManager)
    : null;
  const selectedInsightPlayerCount = selectedRow
    ? [
        selectedRow.bestBenchStash,
        selectedRow.weakestStarter,
        selectedRow.oldestPlayer,
        selectedRow.youngCorePlayer,
        selectedRow.breakoutCandidate,
        selectedRow.buyTarget,
        selectedRow.sellCandidate,
        selectedRow.tradeChip,
        selectedRow.injuryInsurance,
        selectedRow.lastSeasonStud,
      ].filter(Boolean).length
    : 0;

  return (
    <>
      <div
        className="command-depth-grid balanced-tile-grid"
        style={getBalancedGridStyle(data.length)}
      >
        {data.map(row => (
          <ManagerDepthTile
            key={row.manager}
            manager={row.manager}
            avatarUrl={managerAvatars?.[row.manager]}
            badges={[
              {
                label: titleCasePill(row.identity),
                tone: getPillToneClass(row.identity).includes("good")
                  ? "good"
                  : "neutral",
              },
              {
                label: `${Math.round(row.starterValuePct)}% starters`,
                tone:
                  row.starterValuePct >= 58
                    ? "good"
                    : row.starterValuePct <= 45
                      ? "warn"
                      : "neutral",
              },
              ...(row.avgAge !== null
                ? [
                    {
                      label: `${row.avgAge} avg age`,
                      tone:
                        row.avgAge >= 27.5
                          ? ("warn" as const)
                          : row.avgAge <= 25
                            ? ("future" as const)
                            : ("good" as const),
                    },
                  ]
                : []),
              {
                label: titleCasePill(row.timeline),
                tone: getPillToneClass(row.timeline).includes("future")
                  ? "future"
                  : getPillToneClass(row.timeline).includes("danger")
                    ? "danger"
                    : "good",
              },
              ...row.ageFlags.slice(0, 2).map(flag => ({
                label: titleCasePill(flag),
                tone:
                  flag.toLowerCase().includes("old") ||
                  flag.toLowerCase().includes("aging") ||
                  flag.toLowerCase().includes("risk")
                    ? ("danger" as const)
                    : ("future" as const),
              })),
              ...(row.starterAvailability.avgGamesMissed !== null
                ? [
                    {
                      label: `${row.starterAvailability.avgGamesMissed} missed/gm`,
                      tone:
                        row.starterAvailability.riskLevel === "high"
                          ? ("danger" as const)
                          : row.starterAvailability.riskLevel === "medium"
                            ? ("warn" as const)
                            : ("good" as const),
                    },
                  ]
                : []),
            ]}
            onClick={() => setSelectedManager(row.manager)}
          />
        ))}
      </div>

      <Dialog
        open={selectedRow !== null}
        onOpenChange={open => !open && setSelectedManager(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="manager-command-dialog max-w-4xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedRow?.manager || "Manager"} Identity Timeline
            </DialogTitle>
            <DialogDescription>
              Roster identity, age curve, depth signals, and key players.
            </DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="manager-command-modal-inner">
              <div className="manager-command-hero">
                {managerAvatars?.[selectedRow.manager] && (
                  <>
                    <img
                      src={managerAvatars[selectedRow.manager] || ""}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={managerAvatars[selectedRow.manager] || ""}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <button
                  type="button"
                  className="manager-modal-close"
                  onClick={() => setSelectedManager(null)}
                  aria-label={`Close ${selectedRow.manager} details`}
                >
                  <XIcon aria-hidden="true" />
                </button>
                <div className="manager-command-title-lockup">
                  <ChampionAvatarFrame
                    managerName={selectedRow.manager}
                    className="manager-command-champion-frame"
                  >
                    {managerAvatars?.[selectedRow.manager] ? (
                      <img
                        src={managerAvatars[selectedRow.manager] || ""}
                        alt={selectedRow.manager}
                        className="manager-command-avatar"
                      />
                    ) : (
                      <span className="manager-command-avatar">
                        {selectedRow.manager[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>Team Identity</p>
                    <h3
                      className={getManagerHeadingClassName(
                        selectedRow.manager
                      )}
                    >
                      {selectedRow.manager}
                    </h3>
                    <ManagerChampionshipPills
                      managerName={selectedRow.manager}
                      className="manager-command-championships"
                    />
                  </div>
                </div>
                <div className="manager-command-hero-metrics">
                  <IntelligenceMetric
                    label="Starters"
                    value={formatCompactValue(selectedRow.starterValue)}
                  />
                  <IntelligenceMetric
                    label="Bench"
                    value={formatCompactValue(selectedRow.benchValue)}
                  />
                  <IntelligenceMetric
                    label="Starter Share"
                    value={`${Math.round(selectedRow.starterValuePct)}%`}
                  />
                </div>
              </div>

              <div className="manager-command-body">
                <div
                  className="manager-command-tag-row"
                  aria-label="Manager identity tags"
                >
                  {[
                    selectedRow.identity,
                    selectedRow.timeline,
                    ...selectedRow.ageFlags,
                    selectedRow.holes.summary,
                  ]
                    .filter(Boolean)
                    .slice(0, 6)
                    .map(tag => (
                      <span
                        key={tag}
                        className={`manager-intel-pill ${getPillToneClass(tag)}`}
                      >
                        {titleCasePill(tag)}
                      </span>
                    ))}
                </div>

                <div className="manager-command-rank-summary">
                  <div>
                    <span>Avg Age</span>
                    <strong>{selectedRow.avgAge ?? "-"}</strong>
                  </div>
                  <div>
                    <span>QB Age</span>
                    <strong>{selectedRow.avgAgeByPosition.QB ?? "-"}</strong>
                  </div>
                  <div>
                    <span>RB Age</span>
                    <strong>{selectedRow.avgAgeByPosition.RB ?? "-"}</strong>
                  </div>
                  <div>
                    <span>WR Age</span>
                    <strong>{selectedRow.avgAgeByPosition.WR ?? "-"}</strong>
                  </div>
                  <div>
                    <span>TE Age</span>
                    <strong>{selectedRow.avgAgeByPosition.TE ?? "-"}</strong>
                  </div>
                </div>

                <div className="manager-command-grid">
                  <div className="manager-command-section">
                    <h4>Key Players</h4>
                    <div
                      className="manager-intel-player-grid balanced-tile-grid"
                      style={getBalancedGridStyle(selectedInsightPlayerCount)}
                    >
                      <PlayerInsightTile
                        label="Bench Stash"
                        player={selectedRow.bestBenchStash}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                      />
                      <PlayerInsightTile
                        label="Upgrade Spot"
                        player={selectedRow.weakestStarter}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                        tone="warn"
                      />
                      <PlayerInsightTile
                        label="Age Risk"
                        player={selectedRow.oldestPlayer}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                        tone="danger"
                      />
                      <PlayerInsightTile
                        label="Young Core"
                        player={selectedRow.youngCorePlayer}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                      />
                      <PlayerInsightTile
                        label="Upside Play"
                        player={selectedRow.breakoutCandidate}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                      />
                      <PlayerInsightTile
                        label="Buy Target"
                        player={selectedRow.buyTarget}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                      />
                      <PlayerInsightTile
                        label="Sell Candidate"
                        player={selectedRow.sellCandidate}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                        tone="warn"
                      />
                      <PlayerInsightTile
                        label="Trade Chip"
                        player={selectedRow.tradeChip}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                      />
                      <PlayerInsightTile
                        label="Insurance"
                        player={selectedRow.injuryInsurance}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                      />
                      <PlayerInsightTile
                        label={
                          selectedRow.lastSeasonStud?.lastSeasonYear
                            ? `${selectedRow.lastSeasonStud.lastSeasonYear} Stud`
                            : "Previous Stud"
                        }
                        player={selectedRow.lastSeasonStud}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={playerDetailsById}
                        onSelect={setSelectedPlayer}
                        crownedRank={
                          selectedRow.lastSeasonStud?.lastSeasonPositionRank
                            ? selectedRow.lastSeasonStud.lastSeasonPositionRank
                            : null
                        }
                      />
                    </div>
                  </div>

                  <div className="manager-command-section manager-command-read">
                    <h4>Roster Read</h4>
                    <p>{selectedRow.strategySummary || selectedRow.summary}</p>
                    <div className="manager-command-inline-read">
                      <h4>Attack Points</h4>
                      <p>
                        QB: {selectedRow.holes.bestQbRank || "-"} · RB2:{" "}
                        {selectedRow.holes.rb2Rank || "-"} · WR3:{" "}
                        {selectedRow.holes.wr3Rank || "-"} · TE1:{" "}
                        {selectedRow.holes.te1Rank || "-"} · Flex depth:{" "}
                        {selectedRow.holes.flexDepth}
                      </p>
                    </div>
                    <div className="manager-command-inline-read">
                      <h4>Availability</h4>
                      <p>
                        {selectedRow.starterAvailability.avgGamesMissed !== null
                          ? `${selectedRow.starterAvailability.riskLevel.toUpperCase()} risk. Starters averaged ${selectedRow.starterAvailability.avgGamesMissed} missed games last season${selectedRow.starterAvailability.riskiestStarter ? `; ${selectedRow.starterAvailability.riskiestStarter.name} is the biggest availability flag` : ""}.`
                          : "Availability sample is not deep enough yet."}
                      </p>
                    </div>
                    <div className="manager-command-inline-read">
                      <h4>Tradeable Depth</h4>
                      <p>
                        {selectedRow.tradeableDepth?.length
                          ? selectedRow.tradeableDepth
                              .map(tile =>
                                tile.player
                                  ? `${tile.position}: ${tile.player.name} (${tile.player.seasonPositionRank || tile.player.currentPositionRank || tile.position})`
                                  : null
                              )
                              .filter(Boolean)
                              .join(" · ") ||
                            "No clean non-starting trade chip on this roster."
                          : (["QB", "RB", "WR", "TE"] as const)
                              .map(pos =>
                                selectedRow.similarValuePlayers[pos]
                                  ? `${pos}: ${selectedRow.similarValuePlayers[pos]?.name} (${selectedRow.similarValuePlayers[pos]?.currentPositionRank || pos})`
                                  : null
                              )
                              .filter(Boolean)
                              .join(" · ") ||
                            "No clean non-starting trade chip on this roster."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={playerDetailsById}
      />
    </>
  );
}

function OwnerIntelPcbRoutes() {
  return (
    <svg
      className="owner-intel-pcb-routes"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="owner-intel-pcb-glow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="0.58" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="owner-intel-pcb-route-bed" fill="none" filter="url(#owner-intel-pcb-glow)">
        <path d="M4 18 H18 L22 24 H43 L47 30 H62 L67 24 H82 L87 18 H96" />
        <path d="M5 47 H21 L26 42 H44 L49 47 H63 L68 42 H80 L85 47 H96" />
        <path d="M6 76 H18 L23 70 H35 L40 76 H58 L63 70 H77 L82 76 H95" />
        <path d="M14 10 V23 M36 7 V31 M64 7 V31 M87 10 V23" />
        <path d="M15 51 V68 M38 44 V78 M62 44 V78 M85 51 V68" />
      </g>
      <g className="owner-intel-pcb-route-current" fill="none" filter="url(#owner-intel-pcb-glow)">
        <path
          className="owner-intel-pcb-route owner-intel-pcb-route-cyan"
          d="M4 18 H18 L22 24 H43 L47 30 H62 L67 24 H82 L87 18 H96"
        />
        <path
          className="owner-intel-pcb-route owner-intel-pcb-route-cyan owner-intel-pcb-route-alt"
          d="M5 47 H21 L26 42 H44 L49 47 H63 L68 42 H80 L85 47 H96"
        />
        <path
          className="owner-intel-pcb-route owner-intel-pcb-route-amber"
          d="M6 76 H18 L23 70 H35 L40 76 H58 L63 70 H77 L82 76 H95"
        />
      </g>
      <g className="owner-intel-pcb-route-nodes" filter="url(#owner-intel-pcb-glow)">
        {[
          [22, 24, "cyan"],
          [47, 30, "amber"],
          [67, 24, "cyan"],
          [87, 18, "amber"],
          [26, 42, "cyan"],
          [49, 47, "amber"],
          [68, 42, "cyan"],
          [85, 47, "amber"],
          [23, 70, "amber"],
          [40, 76, "cyan"],
          [63, 70, "amber"],
          [82, 76, "cyan"],
        ].map(([cx, cy, tone]) => (
          <circle
            key={`${cx}-${cy}-${tone}`}
            className={`owner-intel-pcb-node owner-intel-pcb-node-${tone}`}
            cx={cx}
            cy={cy}
            r="0.74"
          />
        ))}
      </g>
    </svg>
  );
}

export function OwnerIntelMatrix({
  data,
  managerAvatars,
  leagueId,
  leagueLogo,
  viewerManager,
  currentStandings: _currentStandings,
  leagueValueMode: leagueValueModeInput = "dynasty",
  ownerIntelSortMode = "dynasty",
}: {
  data: ReportData;
  managerAvatars?: ManagerAvatars;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  currentStandings?: ReportData["currentStandings"];
  leagueValueMode?: ReportData["leagueValueMode"];
  ownerIntelSortMode?: OwnerIntelSortMode;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const intelRows = data.managerRosterIntelligence || [];
  const leagueValueMode = normalizeLeagueValueMode(
    leagueValueModeInput ||
      data.leagueDiagnostics?.valueMode ||
      data.leagueValueMode
  );
  const isRedraft = leagueValueMode === "redraft";
  const visibleIntelRows = isRedraft
    ? intelRows.filter(row => !isPlaceholderManagerName(row.manager))
    : intelRows;
  if (!visibleIntelRows.length) return null;

  const pickRows = data.pickPortfolios || [];
  const growthRows = data.managerRosterValueGrowth || [];
  const powerRows = data.powerRankings || [];
  const maxGrowthValue = Math.max(
    0,
    ...growthRows.map(row => row.total_val || 0)
  );
  const getTradeRow = (manager: string) =>
    data.tradeTendencies?.find(row => row.manager === manager);
  const getPickRow = (manager: string) =>
    pickRows.find(row => row.manager === manager);
  const getOverviewRow = (manager: string) =>
    data.leagueOverview.find(row => row.manager === manager);
  const getGrowthRow = (manager: string) =>
    growthRows.find(row => row.manager === manager);
  const getPowerRow = (manager: string) =>
    powerRows.find(row => row.manager === manager);
  const getTimelineRow = (manager: string) =>
    data.dynastyTimelines?.find(row => row.manager === manager);
  const getScoreLensForRow = (row: OwnerIntelRow) =>
    buildOwnerScoreLens({
      row,
      timelineRow: getTimelineRow(row.manager),
      powerRow: getPowerRow(row.manager),
      overviewRow: getOverviewRow(row.manager),
      growthRow: getGrowthRow(row.manager),
      maxGrowthValue,
      leagueSize: visibleIntelRows.length,
      sortMode: ownerIntelSortMode,
    });
  const getSortScoreForRow = (row: OwnerIntelRow) => {
    const scoreLens = getScoreLensForRow(row);
    if (ownerIntelSortMode === "contender")
      return scoreLens.contenderScore ?? -1;
    if (ownerIntelSortMode === "rebuilder")
      return scoreLens.rebuilderScore ?? -1;
    return scoreLens.dynastyScore ?? -1;
  };
  const orderedIntelRows = [...visibleIntelRows].sort((a, b) => {
    const scoreDiff = getSortScoreForRow(b) - getSortScoreForRow(a);
    if (scoreDiff !== 0) return scoreDiff;
    const aRank =
      getOverviewRow(a.manager)?.rank_value ?? Number.MAX_SAFE_INTEGER;
    const bRank =
      getOverviewRow(b.manager)?.rank_value ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    if (
      viewerManager &&
      a.manager === viewerManager &&
      b.manager !== viewerManager
    )
      return -1;
    if (
      viewerManager &&
      b.manager === viewerManager &&
      a.manager !== viewerManager
    )
      return 1;
    return a.manager.localeCompare(b.manager);
  });
  const selectedRow = selectedOwner
    ? orderedIntelRows.find(row => row.manager === selectedOwner)
    : null;
  const selectedTradeRow = selectedRow
    ? getTradeRow(selectedRow.manager)
    : null;
  const selectedPickRow = selectedRow ? getPickRow(selectedRow.manager) : null;
  const selectedOverviewRow = selectedRow
    ? getOverviewRow(selectedRow.manager)
    : null;
  const selectedGrowthRow = selectedRow
    ? getGrowthRow(selectedRow.manager)
    : null;
  const selectedPowerRow = selectedRow
    ? getPowerRow(selectedRow.manager)
    : null;
  const selectedScoreLens = selectedRow
    ? getScoreLensForRow(selectedRow)
    : null;
  const selectedTeamType =
    selectedRow && isRedraft
      ? buildRedraftOwnerProfileLabel(
          selectedRow,
          selectedPowerRow,
          selectedOverviewRow,
          orderedIntelRows.length
        )
      : selectedScoreLens?.buildLabel || null;
  const selectedOwnerTags = selectedRow
    ? isRedraft
      ? buildRedraftOwnerTags({
          row: selectedRow,
          overviewRow: selectedOverviewRow,
        })
      : buildDynastyOwnerTags({
          row: selectedRow,
          overviewRow: selectedOverviewRow,
          growthRow: selectedGrowthRow,
          pickRow: selectedPickRow,
          allGrowthRows: growthRows,
          allPickRows: pickRows,
          leagueSize: orderedIntelRows.length,
        })
    : [];
  const selectedPlayerSectionsBase: Array<{
    label: string;
    player: ManagerIntelPlayer | null;
    tone?: "neutral" | "warn" | "danger";
    crownedRank?: string | null;
  }> = selectedRow
    ? isRedraft
      ? [
          {
            label: "Starter Anchor",
            player:
              selectedRow.untouchablePlayers?.[0] || selectedRow.lastSeasonStud,
          },
          { label: "Starter Upgrade", player: selectedRow.buyTarget },
          {
            label: "Bench Leverage",
            player: selectedRow.tradeChip || selectedRow.bestBenchStash,
          },
          {
            label: "Position Gap",
            player: selectedRow.weakestStarter,
            tone: "warn",
          },
          {
            label: "Waiver Cut",
            player: selectedRow.droppablePlayers?.[0] || null,
            tone: "danger",
          },
          { label: "Injury Cover", player: selectedRow.injuryInsurance },
          { label: "Opportunity Play", player: selectedRow.breakoutCandidate },
        ]
      : [
          {
            label: "Untouchable",
            player:
              selectedRow.untouchablePlayers?.[0] ||
              selectedRow.youngCorePlayer,
          },
          { label: "Buy Idea", player: selectedRow.buyTarget },
          {
            label: "Sell Idea",
            player: selectedRow.sellCandidate,
            tone: "warn",
          },
          { label: "Trade Chip", player: selectedRow.tradeChip },
          {
            label: "Droppable",
            player: selectedRow.droppablePlayers?.[0] || null,
            tone: "danger",
          },
          { label: "Bench Stash", player: selectedRow.bestBenchStash },
          { label: "Young Core", player: selectedRow.youngCorePlayer },
          { label: "Upside Play", player: selectedRow.breakoutCandidate },
          { label: "Age Risk", player: selectedRow.oldestPlayer, tone: "warn" },
        ]
    : [];
  const selectedPlayerSections = selectedPlayerSectionsBase.filter(
    (item, index, rows) => {
      if (!item.player) return false;
      return (
        rows.findIndex(
          candidate => candidate.player?.player_id === item.player?.player_id
        ) === index
      );
    }
  );
  const selectedRosterRead = selectedRow
    ? isRedraft
      ? buildRedraftRosterRead(selectedRow, selectedOverviewRow)
      : buildDynastyRosterRead(
          selectedRow,
          selectedOverviewRow,
          selectedScoreLens?.buildLabel
        )
    : "";
  const selectedBestMove = selectedRow
    ? isRedraft
      ? buildRedraftBestMove(selectedRow)
      : buildDynastyBestMove(
          selectedRow,
          selectedPickRow,
          selectedScoreLens?.buildLabel,
          selectedOverviewRow,
          orderedIntelRows.length
        )
    : "";
  const selectedTradeDraftProfile = selectedRow
    ? isRedraft
      ? `Current-season context: prioritize starter strength (${formatCompactValue(selectedRow.starterSeasonValue || selectedRow.starterValue)}), bench depth (${formatCompactValue(selectedRow.benchValue)}), and position gaps over long-term asset leverage.`
      : buildOwnerTradeDraftProfile(selectedTradeRow, selectedPickRow)
    : "";
  const selectedRosterTraceItems = selectedRow
    ? [
        `${selectedRow.manager} profile: ${selectedRow.identity || 'returned owner identity'} / ${selectedRow.timeline || 'unknown timeline'}.`,
        selectedOverviewRow ? `League value rank #${selectedOverviewRow.rank_value}; QB/RB/WR/TE ranks stay in the position tiles.` : 'No league overview rank row returned.',
        `Starter value ${formatCompactValue(selectedRow.starterSeasonValue || selectedRow.starterValue)} and bench value ${formatCompactValue(selectedRow.benchValue)} drive the roster read.`,
        `${selectedRow.starterAvailability?.riskLevel || 'unknown'} starter availability risk from returned roster data.`,
      ]
    : [];
  const selectedMoveTraceItems = selectedRow
    ? [
        selectedRow.tradePlan?.needPosition ? `Need signal: ${selectedRow.tradePlan.needPosition}.` : 'No clean need position returned.',
        selectedRow.tradePlan?.surplusPosition ? `Surplus signal: ${selectedRow.tradePlan.surplusPosition}.` : 'No clean surplus position returned.',
        selectedRow.buyTarget ? `Buy target evidence: ${selectedRow.buyTarget.name}.` : 'No buy target returned.',
        selectedRow.sellCandidate ? `Sell/watch evidence: ${selectedRow.sellCandidate.name}.` : 'No sell/watch candidate returned.',
      ]
    : [];
  const selectedMarketTraceItems = selectedRow
    ? [
        selectedTradeRow ? `Manager trade tendency: ${selectedTradeRow.tradeCount} trades, ${formatCompactValue(selectedTradeRow.profit)} profit.` : 'No manager trade tendency row returned.',
        selectedPickRow ? `Pick portfolio: ${selectedPickRow.count2026 + selectedPickRow.count2027} future picks worth ${formatCompactValue(selectedPickRow.totalValue)}.` : 'No pick portfolio row returned.',
        selectedPowerRow ? `Power context: #${selectedPowerRow.rank} with ${selectedPowerRow.score} score.` : 'No power ranking row returned.',
        selectedGrowthRow ? `Value growth context: ${formatCompactValue(selectedGrowthRow.growth)} movement.` : 'No value-growth row returned.',
      ]
    : [];
  const selectedAiSuggestions =
    selectedRow && !isRedraft
      ? buildDynastyAiSuggestions({
          row: selectedRow,
          pickRow: selectedPickRow,
          overviewRow: selectedOverviewRow,
          buildLabel: selectedScoreLens?.buildLabel,
          leagueSize: orderedIntelRows.length,
          seededTradeCopies: [selectedBestMove],
          suppress: [
            selectedRosterRead,
            selectedBestMove,
            selectedTradeDraftProfile,
          ],
        })
      : [];
  const selectedActionNotes = selectedRow
    ? isRedraft
      ? buildRedraftActionNotes(selectedRow)
      : filterByPlayerNameMentionBudget(
          dedupeIntelNotes(
            buildDynastyActionNotes(selectedRow, selectedPickRow),
            [
              selectedRosterRead,
              selectedBestMove,
              selectedTradeDraftProfile,
              ...selectedAiSuggestions.map(card => card.copy),
            ]
          ),
          note => note,
          getDynastyTradeTrackedNames(selectedRow),
          [selectedBestMove, ...selectedAiSuggestions.map(card => card.copy)]
        ).slice(0, 4)
    : [];
  const selectedActionNoteCards = selectedActionNotes
    .slice(0, 3)
    .map((note, index) => {
      const splitIndex = note.indexOf(":");
      const title =
        splitIndex > 0
          ? note.slice(0, splitIndex).trim()
          : ["Target watchlist", "Upside hold", "Roster churn"][index] ||
            "AI note";
      const copy = splitIndex > 0 ? note.slice(splitIndex + 1).trim() : note;
      const Icon = [Target, ShieldCheck, Star][index % 3];

      return {
        note,
        title,
        copy,
        Icon,
        tone: index === 0 ? "target" : index === 1 ? "hold" : "churn",
      };
    });
  const selectedActionRailCards = selectedActionNoteCards.length || !selectedRow
    ? selectedActionNoteCards
    : [
        {
          note: `${selectedRow.manager}-roster-signal`,
          title: "Roster signal",
          copy: selectedTeamType || selectedRow.identity || "Owner profile needs more league evidence.",
          Icon: ShieldCheck,
          tone: "hold",
        },
        {
          note: `${selectedRow.manager}-move-signal`,
          title: "Move signal",
          copy: selectedRow.tradePlan?.needPosition
            ? `Prioritize the ${selectedRow.tradePlan.needPosition} lane before adding luxury depth.`
            : "No single position need is clean enough to force a move.",
          Icon: Target,
          tone: "target",
        },
        {
          note: `${selectedRow.manager}-market-signal`,
          title: "Market signal",
          copy: selectedTradeDraftProfile || "Trade and pick context is thin for this owner.",
          Icon: Star,
          tone: "churn",
        },
      ];

  return (
    <>
      <div
        className="command-depth-grid balanced-tile-grid"
        style={getBalancedGridStyle(orderedIntelRows.length)}
      >
        {orderedIntelRows.map(row => {
          const pickRow = getPickRow(row.manager);
          const overviewRow = getOverviewRow(row.manager);
          const growthRow = getGrowthRow(row.manager);
          const powerRow = getPowerRow(row.manager);
          const scoreLens = getScoreLensForRow(row);
          return (
            <ManagerDepthTile
              key={row.manager}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              className={viewerOwnedHighlightClass(row.manager, viewerManager)}
              subtitle={
                isRedraft
                  ? buildRedraftOwnerProfileLabel(
                      row,
                      powerRow,
                      overviewRow,
                      orderedIntelRows.length
                    )
                  : scoreLens.buildLabel
              }
              subtitleTone={
                isRedraft
                  ? getOwnerTeamTypeTone(
                      buildRedraftOwnerProfileLabel(
                        row,
                        powerRow,
                        overviewRow,
                        orderedIntelRows.length
                      )
                    )
                  : scoreLens.buildTone
              }
              scoreStrip={
                <OwnerScoreStrip
                  scores={scoreLens}
                  compact
                  leagueValueMode={leagueValueMode}
                />
              }
              badges={
                isRedraft
                  ? buildRedraftOwnerTags({ row, overviewRow })
                  : buildDynastyOwnerTags({
                      row,
                      overviewRow,
                      growthRow,
                      pickRow,
                      allGrowthRows: growthRows,
                      allPickRows: pickRows,
                      leagueSize: orderedIntelRows.length,
                    })
              }
              onClick={() => setSelectedOwner(row.manager)}
            />
          );
        })}
      </div>

      <Dialog
        open={selectedRow !== null}
        onOpenChange={open => !open && setSelectedOwner(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="manager-command-dialog owner-intel-dialog max-w-5xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedRow?.manager || "Owner"} Intel Lab
            </DialogTitle>
            <DialogDescription>
              Owner intelligence, trade ideas, player flags, and roster notes.
            </DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="manager-command-modal-inner">
              <div className="manager-command-hero">
                {managerAvatars?.[selectedRow.manager] && (
                  <>
                    <img
                      src={managerAvatars[selectedRow.manager] || ""}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={managerAvatars[selectedRow.manager] || ""}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <button
                  type="button"
                  className="manager-modal-close"
                  onClick={() => setSelectedOwner(null)}
                  aria-label={`Close ${selectedRow.manager} details`}
                >
                  <XIcon aria-hidden="true" />
                </button>
                <div className="manager-command-title-lockup">
                  <ChampionAvatarFrame
                    managerName={selectedRow.manager}
                    className="manager-command-champion-frame"
                  >
                    {managerAvatars?.[selectedRow.manager] ? (
                      <img
                        src={managerAvatars[selectedRow.manager] || ""}
                        alt={selectedRow.manager}
                        className="manager-command-avatar"
                      />
                    ) : (
                      <span className="manager-command-avatar">
                        {selectedRow.manager[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>{isRedraft ? "Owner Reads" : "Owner Intel Lab"}</p>
                    <h3
                      className={getManagerHeadingClassName(
                        selectedRow.manager
                      )}
                    >
                      {selectedRow.manager}
                    </h3>
                    {selectedTeamType && (
                      <span
                        className={`manager-command-team-type manager-command-team-type-${selectedScoreLens?.buildTone || getOwnerTeamTypeTone(selectedTeamType)}`}
                      >
                        {selectedTeamType}
                      </span>
                    )}
                    <ManagerChampionshipPills
                      managerName={selectedRow.manager}
                      className="manager-command-championships"
                    />
                  </div>
                </div>
                <div className="manager-command-hero-metrics owner-intel-hero-metrics">
                  <IntelligenceMetric
                    label={isRedraft ? "Current" : "Dynasty"}
                    value={formatOwnerScore(selectedScoreLens?.dynastyScore)}
                  />
                  <IntelligenceMetric
                    label={isRedraft ? "Starters" : "Contender"}
                    value={formatOwnerScore(selectedScoreLens?.contenderScore)}
                    tone={
                      isOwnerContenderLane(selectedScoreLens?.buildLabel)
                        ? "positive"
                        : "neutral"
                    }
                  />
                  <IntelligenceMetric
                    label={isRedraft ? "Bench" : "Rebuilder"}
                    value={formatOwnerScore(selectedScoreLens?.rebuilderScore)}
                    tone={
                      isOwnerRebuildLane(selectedScoreLens?.buildLabel)
                        ? "positive"
                        : "neutral"
                    }
                  />
                </div>
              </div>

              <div className="manager-command-body">
                <div className="owner-intel-tags">
                  {selectedOwnerTags.map(tag => (
                    <span
                      key={tag.label}
                      className={`manager-intel-pill command-mini-badge-${tag.tone}`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>

                {selectedOverviewRow ? (
                  <FullRosterRankTiles overviewRow={selectedOverviewRow} />
                ) : null}

                <div
                  className="owner-intel-player-grid balanced-tile-grid"
                  style={getBalancedGridStyle(
                    selectedPlayerSections.filter(item => item.player).length
                  )}
                >
                  {selectedPlayerSections.map(item =>
                    item.player ? (
                      <PlayerInsightTile
                        key={`${item.label}-${item.player.player_id}`}
                        label={item.label}
                        player={item.player}
                        manager={selectedRow.manager}
                        managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                        playerDetailsById={data.playerDetailsById}
                        onSelect={setSelectedPlayer}
                        tone={item.tone}
                        crownedRank={item.crownedRank}
                        leagueValueMode={leagueValueMode}
                      />
                    ) : null
                  )}
                </div>

                <div
                  className="owner-intel-pcb-system"
                  data-testid="owner-intel-pcb-system"
                >
                  <OwnerIntelPcbRoutes />
                  <div className="owner-intel-read-grid owner-intel-read-grid-pcb">
                    <AIReadPanel
                      title={isRedraft ? "Roster Read" : "Dynasty Roster Read"}
                      body={selectedRosterRead}
                      decision={{
                        label: "Watch",
                        detail:
                          "Roster shape is context for the actual move; do not treat it as a transaction by itself.",
                        tone: "watch",
                        status: "Context read",
                      }}
                      traceLabel="Why this fired"
                      traceItems={selectedRosterTraceItems}
                      backgroundVariant="roster"
                      severity="info"
                      className="owner-intel-read-wide"
                    />

                    <AIReadPanel
                      title={isRedraft ? "Best Move" : "Dynasty Best Move"}
                      body={selectedBestMove}
                      decision={{
                        label: "Do this",
                        detail: selectedBestMove,
                        tone: "go",
                        status: "Primary move",
                      }}
                      traceItems={selectedMoveTraceItems}
                      backgroundVariant="trade"
                      severity="info"
                    />

                    <AIReadPanel
                      title={
                        isRedraft ? "Starter / Bench Context" : "Market / Picks"
                      }
                      body={selectedTradeDraftProfile}
                      decision={{
                        label: "Watch",
                        detail:
                          "Use this as deal context; the Best Move panel owns the action call.",
                        tone: "watch",
                        status: "Context read",
                      }}
                      traceLabel="Why this fired"
                      traceItems={selectedMarketTraceItems}
                      backgroundVariant="market"
                      severity="warn"
                    />

                    {selectedAiSuggestions.map(card => {
                      const titleKey = card.title.toLowerCase();
                      const panelVariant = card.wide
                        ? "monthly"
                        : titleKey.includes("trade")
                          ? "trade"
                          : titleKey.includes("pick") ||
                              titleKey.includes("market") ||
                              titleKey.includes("leverage")
                            ? "market"
                            : titleKey.includes("offer") ||
                                titleKey.includes("filter")
                              ? "waiver"
                              : titleKey.includes("churn")
                                ? "lineup"
                                : titleKey.includes("risk")
                                  ? "draft"
                                  : titleKey.includes("guardrail") ||
                                      titleKey.includes("core")
                                    ? "league"
                                    : "blueprint";

                      const panelSeverity =
                        card.tone === "danger"
                          ? "danger"
                          : card.tone === "warn"
                            ? "warn"
                            : card.tone === "good"
                              ? "good"
                              : "info";
                      const cardDecision =
                        card.tone === "danger"
                          ? {
                              label: "Do not force it",
                              detail: card.copy,
                              tone: "stop" as const,
                              status: "Guardrail",
                            }
                          : card.tone === "warn"
                            ? {
                                label: "Watch",
                                detail: card.copy,
                                tone: "watch" as const,
                                status: "Caution",
                              }
                            : {
                                label: "Do this",
                                detail: card.copy,
                                tone: "go" as const,
                                status: "Action lane",
                              };

                      return (
                        <AIReadPanel
                          key={`${card.title}-${card.copy}`}
                          title={card.title}
                          body={card.copy}
                          decision={cardDecision}
                          traceLabel="Why this fired"
                          traceItems={[
                            `Owner profile: ${selectedRow.identity || 'returned owner identity'}.`,
                            `Timeline: ${selectedRow.timeline || selectedTeamType || 'unknown'}.`,
                            selectedOverviewRow ? `Value rank #${selectedOverviewRow.rank_value}.` : 'No league value rank returned.',
                            `Signal source: ${card.title}.`,
                          ]}
                          backgroundVariant={panelVariant}
                          severity={panelSeverity}
                          className={getAiNeuralSurfaceClass(
                            card.theme || "neutral",
                            `owner-intel-ai-card owner-intel-ai-card-${card.tone} ${card.theme ? `owner-intel-ai-theme-${card.theme}` : ""} ${card.wide ? "owner-intel-read-wide" : ""}`
                          )}
                        />
                      );
                    })}

                    {selectedRow ? (
                      <AIReadPanel
                        title={isRedraft ? "Lineup Notes" : "Dynasty AI Notes"}
                        backgroundVariant="monthly"
                        severity="info"
                        className={getAiNeuralSurfaceClass(
                          "neutral",
                          "owner-intel-wild-notes"
                        )}
                        body={
                          <div className="ai-notes-feature-shell">
                            <svg
                              className="ai-notes-feature-rail"
                              viewBox="0 0 100 24"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path
                                className="ai-notes-feature-route ai-notes-feature-route-cyan ai-notes-feature-route-primary"
                                d="M1 17.5 H13 L17 13.25 H29 L33 10.5 H48 L53 13.25 H67 L72 17.5 H99"
                              />
                              <path
                                className="ai-notes-feature-route ai-notes-feature-route-cyan ai-notes-feature-route-secondary"
                                d="M2 5.5 H18 L22 8.25 H39 L43 6 H58 L62 8.75 H79 L83 5.75 H98"
                              />
                              <path
                                className="ai-notes-feature-route ai-notes-feature-route-amber ai-notes-feature-route-tertiary"
                                d="M5 20.5 H21 V18.25 H35 L39 15.5 H61 L65 18.25 H78 V20.5 H96"
                              />
                              <path
                                className="ai-notes-feature-route ai-notes-feature-route-amber ai-notes-feature-route-corner"
                                d="M9 2.75 H24 V5.25 H35 M65 5.25 H76 V2.75 H91"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-cyan"
                                cx="17"
                                cy="13.25"
                                r="0.7"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-cyan"
                                cx="33"
                                cy="10.5"
                                r="0.65"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-cyan"
                                cx="53"
                                cy="13.25"
                                r="0.72"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-cyan"
                                cx="72"
                                cy="17.5"
                                r="0.65"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-amber"
                                cx="39"
                                cy="15.5"
                                r="0.62"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-amber"
                                cx="65"
                                cy="18.25"
                                r="0.68"
                              />
                              <circle
                                className="ai-notes-feature-node ai-notes-feature-node-amber"
                                cx="83"
                                cy="5.75"
                                r="0.6"
                              />
                            </svg>

                            <div className="ai-notes-module-grid">
                              {selectedActionRailCards.map(card => {
                                const NoteIcon = card.Icon;

                                return (
                                  <section
                                    key={card.note}
                                    className={`ai-notes-module ai-notes-module-${card.tone}`}
                                  >
                                    <span
                                      className="ai-notes-module-icon"
                                      aria-hidden="true"
                                    >
                                      <NoteIcon />
                                    </span>
                                    <p>
                                      <strong>{card.title}:</strong> {card.copy}
                                    </p>
                                  </section>
                                );
                              })}
                            </div>
                          </div>
                        }
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={data.playerDetailsById}
      />
    </>
  );
}
