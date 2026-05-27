import { Crown, X as XIcon } from "lucide-react";
import type { DraftPick, ManagerIntelPlayer, PlayerDetails, ReportData, TradeTimePickAsset } from "@shared/types";
import { PlayerNameWithHeadshot } from "../PlayerNameWithHeadshot";
import { ChampionAvatarFrame } from "../ManagerChampionships";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { TeamLogoPill } from "../TeamLogoPill";
import { getPlayerAvailability } from "@/lib/playerStatus";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import { normalizeLeagueValueMode, type LeagueValueMode } from "@/lib/leagueValueMode";
import {
  buildTradeValueCalibrationNote,
  getPlayerTradeValueCalibration,
  getStrongestTradeValueCalibration,
  type TradeValueCalibration,
} from "@/lib/tradeValueCalibration";
import {
  buildPlayerModalData,
  CommandMiniBadge,
  formatCompactValue,
  normalizeManagerKey,
  PositionRankPill,
  renderManagerName,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./shared";
export { renderManagerName } from "./shared";

type CurrentPositionRankById = ReportData["currentPositionRankById"];
type LeagueOverviewRows = ReportData["leagueOverview"];
type ManagerRosterIntelRows = NonNullable<
  ReportData["managerRosterIntelligence"]
>;
type DynastyTimelineRows = NonNullable<ReportData["dynastyTimelines"]>;
export type TradeWarMode =
  | "dynasty"
  | "contender"
  | "rebuilder"
  | "starter-upgrade"
  | "depth-fix"
  | "positional-need"
  | "playoff-push"
  | "waiver-leverage";
export type TradeFitRead = {
  manager: string;
  label: string;
  note: string;
  tone: "good" | "warn" | "neutral";
  target?: ManagerIntelPlayer | null;
};

export function stableTradeSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function renderTradeSummaryManager(
  manager: string,
  isWinner: boolean,
  managerAvatars?: ManagerAvatars
) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || "?";

  return (
    <span
      className={`trade-mobile-manager ${isWinner ? "trade-mobile-winner" : "trade-mobile-loser"}`}
    >
      <span className="report-identity-chip manager-chip flex min-w-0 items-center gap-2">
        <span className="trade-mobile-avatar-wrap">
          <ChampionAvatarFrame managerName={manager} showAccolades={false}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={manager}
                className="h-7 w-7 flex-shrink-0 rounded-full border border-cyan-300/30 object-cover shadow-sm shadow-black/30"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-800 text-[11px] font-bold text-orange-300"
              >
                {initial}
              </span>
            )}
          </ChampionAvatarFrame>
          {isWinner && (
            <Crown className="trade-winner-crown" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0">{manager}</span>
      </span>
    </span>
  );
}

function renderTradeSideManager(
  manager: string,
  isWinner: boolean,
  managerAvatars?: ManagerAvatars,
  buildLens?: ManagerBuildLens
) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || "?";

  return (
    <span
      className={`trade-side-manager ${isWinner ? "trade-side-manager-winner" : "trade-side-manager-other"}`}
    >
      <span className="trade-mobile-avatar-wrap">
        <ChampionAvatarFrame managerName={manager} showAccolades={false}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={manager}
              className="h-7 w-7 flex-shrink-0 rounded-full border border-cyan-300/30 object-cover shadow-sm shadow-black/30"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-800 text-[11px] font-bold text-orange-300"
            >
              {initial}
            </span>
          )}
        </ChampionAvatarFrame>
        {isWinner && (
          <Crown className="trade-winner-crown" aria-hidden="true" />
        )}
      </span>
      <span className="trade-side-manager-lockup">
        <span className="trade-side-manager-name">{manager}</span>
        {buildLens && <ManagerBuildPill lens={buildLens} />}
      </span>
    </span>
  );
}

function ManagerBuildPill({ lens }: { lens: ManagerBuildLens }) {
  return (
    <span
      className={`trade-build-pill trade-build-pill-${lens.tone}`}
      title={lens.reason}
    >
      {lens.label}
    </span>
  );
}

export function renderTradeLedgerManagerName(
  manager: string,
  managerAvatars?: ManagerAvatars,
  buildLens?: ManagerBuildLens
) {
  return (
    <span className="trade-ledger-manager-lockup">
      {renderManagerName(manager, managerAvatars)}
      {buildLens && <ManagerBuildPill lens={buildLens} />}
    </span>
  );
}

function renderTradeFitReadManager(
  manager: string,
  managerAvatars?: ManagerAvatars
) {
  const avatarUrl = managerAvatars?.[manager];
  const initial = manager.trim()[0]?.toUpperCase() || "?";

  return (
    <span className="trade-fit-read-manager">
      <span>{manager}</span>
      <ChampionAvatarFrame managerName={manager} showAccolades={false}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={manager} />
        ) : (
          <span aria-hidden="true" className="trade-fit-read-manager-fallback">
            {initial}
          </span>
        )}
      </ChampionAvatarFrame>
    </span>
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
    <div
      key={read.manager}
      className={`trade-fit-read trade-fit-read-${read.tone}`}
    >
      <div className="trade-fit-read-top">
        <span>{read.label}</span>
        {renderTradeFitReadManager(read.manager, managerAvatars)}
      </div>
      <p>{read.note}</p>
      {read.target && (
        <button
          type="button"
          className="trade-fit-target"
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            if (!onPlayerClick) return;
            onPlayerClick(
              buildPlayerModalData({
                playerId: read.target?.player_id,
                playerName: read.target?.name || "",
                playerPos: read.target?.pos,
                value: read.target?.value,
                playerDetails: read.target?.playerDetails,
                playerDetailsById,
                manager: read.target?.owner,
                currentPositionRank:
                  read.target?.seasonPositionRank ||
                  read.target?.currentPositionRank,
              })
            );
          }}
        >
          <span className="trade-fit-target-label">
            Trade-date target: {read.target.name}
          </span>
          <PositionRankPill
            rank={
              read.target.seasonPositionRank ||
              read.target.currentPositionRank ||
              read.target.pos
            }
          />
        </button>
      )}
    </div>
  );
}

export function getTradeGapVerdict(gap: number) {
  if (gap === 0)
    return { label: "Even Steven", className: "trade-gap-verdict-even" };
  if (gap < 100)
    return { label: "Coin Flip", className: "trade-gap-verdict-even" };
  if (gap < 200)
    return { label: "Tiny Tax", className: "trade-gap-verdict-soft" };
  if (gap < 350)
    return { label: "Tip Jar", className: "trade-gap-verdict-soft" };
  if (gap < 500)
    return { label: "Pocket Change", className: "trade-gap-verdict-soft" };
  if (gap < 650)
    return { label: "Lunch Money", className: "trade-gap-verdict-medium" };
  if (gap < 800)
    return { label: "Got Finessed", className: "trade-gap-verdict-medium" };
  if (gap < 1000)
    return { label: "Sneaky L", className: "trade-gap-verdict-medium" };
  if (gap < 1250)
    return { label: "Ouch Tax", className: "trade-gap-verdict-hot" };
  if (gap < 1500)
    return { label: "Got Robbed", className: "trade-gap-verdict-hot" };
  if (gap < 1750)
    return { label: "Trade Mugging", className: "trade-gap-verdict-hot" };
  if (gap < 2000)
    return { label: "Hide the Chat", className: "trade-gap-verdict-hot" };
  if (gap < 2250)
    return { label: "Call 911", className: "trade-gap-verdict-fire" };
  if (gap < 2500)
    return { label: "League Probe", className: "trade-gap-verdict-fire" };
  if (gap < 2750)
    return { label: "Veto Bait", className: "trade-gap-verdict-fire" };
  if (gap < 3000)
    return { label: "Receipts Needed", className: "trade-gap-verdict-fire" };
  if (gap < 3500)
    return { label: "Crime Scene", className: "trade-gap-verdict-nuclear" };
  if (gap < 4000)
    return { label: "Witness Needed", className: "trade-gap-verdict-nuclear" };
  if (gap < 5000)
    return { label: "Delete the App", className: "trade-gap-verdict-nuclear" };
  if (gap < 6000)
    return { label: "Call the Lawyer", className: "trade-gap-verdict-nuclear" };
  if (gap < 7500)
    return {
      label: "Generational Fleece",
      className: "trade-gap-verdict-nuclear",
    };
  return { label: "Eternal Shame", className: "trade-gap-verdict-nuclear" };
}

const TRADE_LEDGER_MUTUAL_WIN_GAP = 250;

export function getManagerTradeSwing(
  trade: ReportData["tradeHistory"][number],
  manager: string
) {
  if (trade.team_a === manager) return trade.team_a_total - trade.team_b_total;
  if (trade.team_b === manager) return trade.team_b_total - trade.team_a_total;
  return 0;
}

export function getManagerTradeEvaluationSwing(
  evaluation: TradeLedgerEvaluation,
  manager: string
) {
  if (evaluation.teamA.manager === manager)
    return evaluation.teamA.total - evaluation.teamB.total;
  if (evaluation.teamB.manager === manager)
    return evaluation.teamB.total - evaluation.teamA.total;
  return 0;
}

export function getManagerTradeEvaluationResult(
  evaluation: TradeLedgerEvaluation,
  manager: string
) {
  if (evaluation.winners.length > 1 && evaluation.winners.includes(manager))
    return "Even Win";
  return evaluation.winners.includes(manager) ? "Win" : "Loss";
}

export function getTradeOpponent(
  trade: ReportData["tradeHistory"][number],
  manager: string
) {
  return trade.team_a === manager ? trade.team_b : trade.team_a;
}

export function getManagerTradeResult(
  trade: ReportData["tradeHistory"][number],
  manager: string
) {
  const winners = trade.winners?.length ? trade.winners : [trade.winner];
  if (winners.length > 1 && winners.includes(manager)) return "Even Win";
  return winners.includes(manager) ? "Win" : "Loss";
}

export type ManagerBuildLens = {
  mode: TradeWarMode;
  label: string;
  tone: "contender" | "rebuilder" | "middle";
  reason: string;
};

export function isRedraftTradeWarMode(
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

export function getTradeWarLeagueValueMode(
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

export type TradeLedgerSideEvaluation = {
  manager: string;
  lens: ManagerBuildLens;
  values: number[];
  adjustment: number;
  total: number;
};

export type TradeLedgerEvaluation = {
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

export function getTradeLensNumber(value: number | null | undefined): number | null {
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

export function buildTradeLedgerEvaluation(
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

export function getTradeLensSourceNote(
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

export function getTradeSideEvaluation(
  manager: string,
  evaluation: TradeLedgerEvaluation
): TradeLedgerSideEvaluation {
  return evaluation.teamA.manager === manager
    ? evaluation.teamA
    : evaluation.teamB;
}

export type TradeDisplaySide = {
  manager: string;
  items: string;
  total: number;
  isWinner: boolean;
};

export function getTradeDisplaySides(
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
  valueCalibration?: TradeValueCalibration | null;
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
            valueCalibration: getPlayerTradeValueCalibration(details),
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
            valueCalibration: getPlayerTradeValueCalibration(details),
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
  const valueCalibrationNotes = outcomeSides.flatMap(side =>
    side.assets
      .flatMap(asset => [asset, ...(asset.children || [])])
      .filter(asset => asset.valueCalibration)
      .slice(0, 2)
      .map(asset =>
        buildTradeValueCalibrationNote({
          name: asset.name,
          calibration: asset.valueCalibration!,
          side: "neutral",
        })
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
      ...valueCalibrationNotes,
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

function formatOutcomeDeltaLabel(value: number): string {
  if (value === 0) return "No change";
  return `${value > 0 ? "Gained" : "Lost"} ${Math.abs(value).toLocaleString()}`;
}

function renderOutcomeAssetLine(asset: TradeOutcomeAsset) {
  const resolvedText =
    asset.kind === "pick" && asset.name && asset.name !== asset.label
      ? ` -> ${asset.name}`
      : "";
  const childText = asset.children?.length
    ? ` -> ${asset.children.map(child => child.name).join(" + ")}`
    : resolvedText;
  return (
    <li key={asset.id}>
      <span>
        {asset.label}
        {childText}
        {asset.valueCalibration &&
          asset.valueCalibration.outcome !== "stable-hold" && (
            <CommandMiniBadge
              as="em"
              tone={asset.valueCalibration.tone}
              title={buildTradeValueCalibrationNote({
                name: asset.name,
                calibration: asset.valueCalibration,
                side: "neutral",
              })}
            >
              {asset.valueCalibration.chip}
            </CommandMiniBadge>
          )}
      </span>
      <strong
        className={
          asset.valueDelta > 0
            ? "text-emerald-300"
            : asset.valueDelta < 0
              ? "text-rose-300"
              : "text-slate-300"
        }
        title="Current value minus the value at the time of the trade"
      >
        <span className="trade-outcome-change-label">Value change</span>
        <span>{formatOutcomeDeltaLabel(asset.valueDelta)}</span>
      </strong>
    </li>
  );
}

function TradeOutcomePanel({ outcome }: { outcome: TradeOutcomeReview }) {
  return (
    <div className="trade-outcome-card">
      <div className="trade-outcome-header">
        <div>
          <span className="trade-outcome-kicker">{outcome.statusLabel}</span>
          <h4>True Trade Outcome</h4>
          <p>
            {outcome.windowSubtitle}. Observed through{" "}
            {outcome.observedThroughLabel}.
          </p>
        </div>
        <span className="trade-outcome-status">{outcome.statusLabel}</span>
      </div>
      <p className="trade-outcome-verdict">{outcome.verdict}</p>
      <div className="trade-outcome-metrics">
        {outcome.metrics.map(metric => (
          <div
            key={metric.label}
            className={`trade-outcome-metric trade-outcome-metric-${metric.tone}`}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </div>
        ))}
      </div>
      <div className="trade-outcome-sides">
        {outcome.sides.map(side => (
          <div key={side.manager} className="trade-outcome-side">
            <div className="trade-outcome-side-top">
              <span>{side.manager}</span>
              <strong>{side.evaluation.total.toLocaleString()}</strong>
            </div>
            <ul>{side.assets.slice(0, 4).map(renderOutcomeAssetLine)}</ul>
          </div>
        ))}
      </div>
      <ul className="trade-outcome-notes">
        {outcome.notes.map(note => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

export function getTradeFairnessSuggestionCopy(
  suggestion: TradeFairnessSuggestion
): string {
  const assetName =
    suggestion.assetKind === "pick"
      ? suggestion.pick?.label || "a controlled pick"
      : suggestion.player?.name || "a controlled player";
  const base = `${suggestion.fromManager} should have added ${assetName} to ${suggestion.toManager}'s side to make this trade closer to even.`;
  if (suggestion.valueCalibration?.outcome === "confirmed-riser") {
    return `${base} ${assetName} is a validated riser, so this is a premium make-whole ask, not filler.`;
  }
  if (suggestion.valueCalibration?.outcome === "watch-riser") {
    return `${base} ${assetName} has a soft riser signal, so do not treat it like a disposable throw-in.`;
  }
  if (suggestion.valueCalibration?.outcome === "low-denominator-watch") {
    return `${base} ${assetName} has a low-baseline value move, so this should stay a watch-list sweetener instead of a hard demand by itself.`;
  }
  if (suggestion.valueCalibration?.outcome === "confirmed-faller") {
    return `${base} ${assetName} is a validated faller, so the receiving side should still require role or timeline context.`;
  }
  return base;
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
  const playerDetails = suggestion.player
    ? suggestion.player.playerDetails ||
      playerDetailsById?.[suggestion.player.player_id]
    : undefined;
  const isPickSuggestion = suggestion.assetKind === "pick";

  return (
    <div className="trade-fairness-card">
      <div>
        <span>Balancing Piece</span>
        <p>{getTradeFairnessSuggestionCopy(suggestion)}</p>
      </div>
      <button
        type="button"
        className="trade-fairness-player"
        style={getTeamTileStyle(playerDetails?.team)}
        disabled={isPickSuggestion}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          if (!onPlayerClick || !suggestion.player) return;
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
      >
        {isPickSuggestion ? (
          <span className="trade-fairness-pick">
            <strong>{suggestion.pick?.label || "Controlled pick"}</strong>
            <small>
              {suggestion.pick?.originalOwner &&
              suggestion.pick.originalOwner !== suggestion.fromManager
                ? `Original: ${suggestion.pick.originalOwner}`
                : "Trade-time pick inventory"}
            </small>
          </span>
        ) : suggestion.player ? (
          <PlayerNameWithHeadshot
            playerId={suggestion.player.player_id}
            playerName={suggestion.player.name}
            team={playerDetails?.team}
            position={suggestion.player.pos}
          />
        ) : null}
        {suggestion.valueCalibration &&
          suggestion.valueCalibration.outcome !== "stable-hold" && (
            <CommandMiniBadge
              tone={suggestion.valueCalibration.tone}
              title={buildTradeValueCalibrationNote({
                name: suggestion.player?.name || "Suggested asset",
                calibration: suggestion.valueCalibration,
                side: "outgoing",
              })}
            >
              {suggestion.valueCalibration.chip}
            </CommandMiniBadge>
          )}
        {leagueValueMode === "redraft" || isPickSuggestion ? (
          <span className="trade-fairness-value">
            {formatCompactValue(suggestion.displayValue)}
          </span>
        ) : (
          <PositionRankPill
            rank={suggestion.displayRank || suggestion.player?.pos || "Player"}
          />
        )}
      </button>
    </div>
  );
}

export function TradeDetailPanel({
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

export function parseTradePlayerItem(trimmed: string) {
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

export function parseValueAdjustmentItem(trimmed: string) {
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

export function parseTradePickItem(trimmed: string) {
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

export function findLandedPick(
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

export function didManagerMakeLandedPick(
  manager: string | undefined,
  landedPick: DraftPick | null | undefined
): boolean {
  if (!manager || !landedPick?.manager) return false;
  return (
    normalizeManagerKey(manager) === normalizeManagerKey(landedPick.manager)
  );
}

export function renderTradeItem(
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
            <span className="value-pill trade-asset-player-value">
              {displayedValue.toLocaleString()}
            </span>
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
            <span
              className="value-pill"
              title="Pick value at the time of the trade"
            >
              {displayedPickValue.toLocaleString()}
            </span>
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

export function splitTradeItems(items: string): string[] {
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

function getTradeItemCalibrationAssets(
  items: string,
  playerDetailsById?: PlayerDetailsById
) {
  return splitTradeItems(items)
    .map(item => parseTradePlayerItem(item.trim()))
    .filter((player): player is NonNullable<ReturnType<typeof parseTradePlayerItem>> => Boolean(player))
    .map(player => ({
      name: player.playerName,
      playerDetails: playerDetailsById?.[player.playerId],
    }));
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

export type TradeFairnessSuggestion = {
  fromManager: string;
  toManager: string;
  gap: number;
  assetKind: "player" | "pick";
  player?: ManagerIntelPlayer;
  pick?: TradeTimePickAsset;
  valueCalibration?: TradeValueCalibration | null;
  displayRank?: string | null;
  displayValue?: number | null;
};

type TradeFairnessCandidate =
  | {
      assetKind: "player";
      player: ManagerIntelPlayer;
      value: number;
      valueCalibration: TradeValueCalibration | null;
    }
  | {
      assetKind: "pick";
      pick: TradeTimePickAsset;
      value: number;
      valueCalibration: null;
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

function getFairnessPickRank(pick: TradeTimePickAsset): string {
  return `${pick.season} R${pick.round}`;
}

function isProtectedFairnessRiser(candidate: TradeFairnessCandidate): boolean {
  return (
    candidate.assetKind === "player" &&
    (
      candidate.valueCalibration?.outcome === "confirmed-riser" ||
      candidate.valueCalibration?.outcome === "watch-riser"
    )
  );
}

function getFairnessCandidateScore(
  candidate: TradeFairnessCandidate,
  targetGap: number
): number {
  const distance = Math.abs(candidate.value - targetGap);
  const overpayPenalty = candidate.value > targetGap ? (candidate.value - targetGap) * 0.35 : 0;
  const kindPenalty = candidate.assetKind === "pick" ? -160 : 0;
  const calibrationPenalty =
    candidate.valueCalibration?.outcome === "confirmed-riser"
      ? 900
      : candidate.valueCalibration?.outcome === "watch-riser"
        ? 425
        : candidate.valueCalibration?.outcome === "low-denominator-watch"
          ? 225
          : candidate.valueCalibration?.outcome === "confirmed-faller"
            ? -75
            : 0;

  return distance + overpayPenalty + kindPenalty + calibrationPenalty;
}

export function buildTradeFairnessSuggestion(
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
    (!winnerContext.rosterPlayers?.length && !winnerContext.tradeTimePicks?.length)
  )
    return null;

  const tradedPlayerIds = new Set([
    ...Array.from(getTradeItemPlayerIds(row.team_a_items)),
    ...Array.from(getTradeItemPlayerIds(row.team_b_items)),
  ]);
  const tradedPickKeys = new Set(
    [...splitTradeItems(row.team_a_items), ...splitTradeItems(row.team_b_items)]
      .map(item => parseTradePickItem(item.trim()))
      .filter((pick): pick is NonNullable<ReturnType<typeof parseTradePickItem>> => Boolean(pick))
      .map(pick => `${pick.draftYear}-${pick.round}-${pick.originalRosterId}`)
  );
  const playerCandidates = (winnerContext.rosterPlayers || [])
    .filter(
      player =>
        getFairnessPlayerValue(player, leagueValueMode) > 0 &&
        !tradedPlayerIds.has(player.player_id) &&
        (!player.owner ||
          normalizeManagerKey(player.owner) === normalizeManagerKey(winner))
    )
    .map(player => ({
      assetKind: "player" as const,
      player,
      value: getFairnessPlayerValue(player, leagueValueMode),
      valueCalibration: getPlayerTradeValueCalibration(player.playerDetails),
    }));
  const pickCandidates = (winnerContext.tradeTimePicks || [])
    .filter(
      pick =>
        pick.value > 0 &&
        normalizeManagerKey(pick.owner) === normalizeManagerKey(winner) &&
        !tradedPickKeys.has(`${pick.season}-${pick.round}-${pick.originalRosterId}`)
    )
    .map(pick => ({
      assetKind: "pick" as const,
      pick,
      value: pick.value,
      valueCalibration: null,
    }));
  const candidates = [...playerCandidates, ...pickCandidates]
    .sort((a, b) => {
      const scoreA = getFairnessCandidateScore(a, evaluation.pointGap);
      const scoreB = getFairnessCandidateScore(b, evaluation.pointGap);
      if (scoreA !== scoreB) return scoreA - scoreB;
      if (a.assetKind !== b.assetKind) return a.assetKind === "pick" ? -1 : 1;
      return b.value - a.value;
    });
  const balancedCandidates = candidates.filter(
    candidate => candidate.value <= evaluation.pointGap + 450
  );
  const asset =
    balancedCandidates.find(candidate => !isProtectedFairnessRiser(candidate)) ||
    balancedCandidates[0] ||
    candidates[0] ||
    null;
  if (!asset) return null;

  return {
    fromManager: winner,
    toManager: loser,
    gap: evaluation.pointGap,
    assetKind: asset.assetKind,
    player: asset.assetKind === "player" ? asset.player : undefined,
    pick: asset.assetKind === "pick" ? asset.pick : undefined,
    valueCalibration: asset.valueCalibration,
    displayRank:
      asset.assetKind === "pick"
        ? getFairnessPickRank(asset.pick)
        : getFairnessPlayerRank(asset.player, leagueValueMode),
    displayValue:
      leagueValueMode === "redraft" || asset.assetKind === "pick"
        ? asset.value
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
  const incomingValueSignal = getStrongestTradeValueCalibration(
    getTradeItemCalibrationAssets(incomingItems, playerDetailsById)
  );
  const outgoingValueSignal = getStrongestTradeValueCalibration(
    getTradeItemCalibrationAssets(outgoingItems, playerDetailsById)
  );

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
  if (incomingValueSignal) {
    impactPills.push({
      label: `Buying ${incomingValueSignal.calibration.chip}`,
      tone: incomingValueSignal.calibration.tone,
    });
  }
  if (outgoingValueSignal) {
    impactPills.push({
      label: `Selling ${outgoingValueSignal.calibration.chip}`,
      tone: outgoingValueSignal.calibration.tone,
    });
  }

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
  if (incomingValueSignal) {
    notes.push(
      buildTradeValueCalibrationNote({
        name: incomingValueSignal.asset.name,
        calibration: incomingValueSignal.calibration,
        side: "incoming",
      })
    );
  }
  if (outgoingValueSignal) {
    notes.push(
      buildTradeValueCalibrationNote({
        name: outgoingValueSignal.asset.name,
        calibration: outgoingValueSignal.calibration,
        side: "outgoing",
      })
    );
  }

  if (impactPills.length === 0 && notes.length === 0) return null;

  return (
    <div className="trade-side-impact">
      {(impactPills.length > 0 || notes.length > 0) && (
        <div className="trade-side-impact-read">
          {impactPills.length > 0 && (
            <div className="trade-side-impact-pill-row">
              {impactPills.map(pill => (
                <CommandMiniBadge key={pill.label} tone={pill.tone}>
                  {pill.label}
                </CommandMiniBadge>
              ))}
            </div>
          )}
          {notes.length > 0 && <p>{notes.join(" ")}</p>}
        </div>
      )}
    </div>
  );
}
