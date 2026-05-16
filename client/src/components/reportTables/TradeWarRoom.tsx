import React, { useState } from "react";
import { ChevronDown, X as XIcon } from "lucide-react";
import type { ManagerIntelPlayer, ReportData } from "@shared/types";
import { Input } from "@/components/ui/input";
import { PlayerNameWithHeadshot } from "../PlayerNameWithHeadshot";
import { ChampionAvatarFrame } from "../ManagerChampionships";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { TeamLogoPill } from "../TeamLogoPill";
import { getBalancedGridStyle } from "@/lib/balancedGrid";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { sortRowsByViewerAndStanding } from "@/lib/managerOrdering";
import { getTeamTileStyle } from "@/lib/teamTileStyle";
import {
  buildPlayerModalData,
  formatCompactValue,
  PositionRankPill,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./shared";

type OwnerIntelRow = NonNullable<
  ReportData["managerRosterIntelligence"]
>[number];
type TradeWarMode =
  | "dynasty"
  | "contender"
  | "rebuilder"
  | "starter-upgrade"
  | "depth-fix"
  | "positional-need"
  | "playoff-push"
  | "waiver-leverage";
type TradeWarAsset = ManagerIntelPlayer & {
  manager: string;
  assetState: "roster" | "bench" | "taxi" | "reserve";
};

function getTradeWarAssetValue(
  player: ManagerIntelPlayer,
  mode: TradeWarMode
): number {
  const profile = player.playerDetails?.valueProfile;
  const dynasty =
    profile?.dynastyValue ?? profile?.balancedValue ?? player.value ?? 0;
  const season =
    player.seasonValue ??
    profile?.seasonValue ??
    profile?.fantasyProsSeasonValue ??
    dynasty;
  if (
    mode === "starter-upgrade" ||
    mode === "depth-fix" ||
    mode === "positional-need" ||
    mode === "playoff-push" ||
    mode === "waiver-leverage"
  )
    return Math.round(season);
  if (mode === "contender")
    return Math.round(profile?.contenderValue ?? dynasty * 0.4 + season * 0.6);
  if (mode === "rebuilder")
    return Math.round(profile?.rebuilderValue ?? dynasty);
  return Math.round(dynasty);
}

function getTradeWarAssetRank(
  player: ManagerIntelPlayer,
  mode: TradeWarMode
): string | null | undefined {
  const profile = player.playerDetails?.valueProfile;
  if (
    mode === "starter-upgrade" ||
    mode === "depth-fix" ||
    mode === "positional-need" ||
    mode === "playoff-push" ||
    mode === "waiver-leverage"
  ) {
    return (
      player.seasonPositionRank ||
      profile?.seasonPositionRank ||
      profile?.fantasyProsPositionRank ||
      player.currentPositionRank
    );
  }
  if (mode === "contender")
    return (
      profile?.contenderPositionRank ||
      profile?.seasonPositionRank ||
      player.seasonPositionRank ||
      player.currentPositionRank
    );
  if (mode === "rebuilder")
    return (
      profile?.rebuilderPositionRank ||
      profile?.dynastyPositionRank ||
      player.currentPositionRank ||
      player.seasonPositionRank
    );
  return (
    profile?.dynastyPositionRank ||
    profile?.balancedPositionRank ||
    player.currentPositionRank ||
    player.seasonPositionRank
  );
}
function getTradeWarAssetTeam(
  player: ManagerIntelPlayer
): string | null | undefined {
  return player.playerDetails?.team;
}

function getTradeWarModeLabel(mode: TradeWarMode): string {
  if (mode === "starter-upgrade") return "Starter Upgrade";
  if (mode === "depth-fix") return "Depth Fix";
  if (mode === "positional-need") return "Positional Need";
  if (mode === "playoff-push") return "Playoff Push";
  if (mode === "waiver-leverage") return "Waiver / Bench Leverage";
  if (mode === "contender") return "Contender";
  if (mode === "rebuilder") return "Rebuilder";
  return "Dynasty";
}

function getTradeWarGapLabel(gap: number): {
  label: string;
  className: string;
} {
  const absGap = Math.abs(gap);
  if (absGap <= 250)
    return { label: "Clean Enough", className: "trade-war-gap-even" };
  if (absGap <= 650)
    return { label: "Needs Sweetener", className: "trade-war-gap-close" };
  if (absGap <= 1400)
    return { label: "Side Needs Help", className: "trade-war-gap-warn" };
  return { label: "Too Lopsided", className: "trade-war-gap-danger" };
}

function getTradeWarPositionCounts(players: TradeWarAsset[]) {
  return players.reduce<Record<string, number>>((acc, player) => {
    acc[player.pos] = (acc[player.pos] || 0) + 1;
    return acc;
  }, {});
}

type TradeWarMetricKey =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "Value"
  | "Power"
  | "Contender"
  | "Rebuild";

type TradeWarRosterMetrics = Record<TradeWarMetricKey, number>;

type TradeWarMetricRanks = Record<TradeWarMetricKey, number>;

type TradeWarRosterSnapshot = {
  metrics: TradeWarRosterMetrics;
  ranks: TradeWarMetricRanks;
  needPosition: string | null;
  surplusPosition: string | null;
  avgAge: number | null;
};

const TRADE_WAR_LINEUP_SLOTS = {
  QB: 2,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 2,
} as const;

function getTradeWarPlayerAge(player: TradeWarAsset): number | null {
  const raw = player.playerDetails?.age;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function getTradeWarModeRankLabel(mode: TradeWarMode): string {
  if (
    mode === "starter-upgrade" ||
    mode === "depth-fix" ||
    mode === "positional-need" ||
    mode === "playoff-push" ||
    mode === "waiver-leverage"
  )
    return "Current-season";
  if (mode === "contender") return "Season";
  if (mode === "rebuilder") return "Rebuild";
  return "Dynasty";
}

function sumTradeWarTopByPosition(
  players: TradeWarAsset[],
  position: "QB" | "RB" | "WR" | "TE",
  count: number,
  mode: TradeWarMode
) {
  return players
    .filter(player => player.pos === position)
    .sort(
      (a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
    )
    .slice(0, count)
    .reduce((sum, player) => sum + getTradeWarAssetValue(player, mode), 0);
}

function buildTradeWarLineupScore(
  players: TradeWarAsset[],
  mode: TradeWarMode
) {
  const used = new Set<string>();
  const lockPosition = (position: "QB" | "RB" | "WR" | "TE", count: number) => {
    const chosen = players
      .filter(player => player.pos === position)
      .sort(
        (a, b) =>
          getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
      )
      .slice(0, count);
    chosen.forEach(player => used.add(player.player_id));
    return chosen;
  };

  const qbs = lockPosition("QB", TRADE_WAR_LINEUP_SLOTS.QB);
  const rbs = lockPosition("RB", TRADE_WAR_LINEUP_SLOTS.RB);
  const wrs = lockPosition("WR", TRADE_WAR_LINEUP_SLOTS.WR);
  const tes = lockPosition("TE", TRADE_WAR_LINEUP_SLOTS.TE);
  const flex = players
    .filter(
      player =>
        ["RB", "WR", "TE"].includes(player.pos) && !used.has(player.player_id)
    )
    .sort(
      (a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
    )
    .slice(0, TRADE_WAR_LINEUP_SLOTS.FLEX);

  const total = [...qbs, ...rbs, ...wrs, ...tes, ...flex].reduce(
    (sum, player) => sum + getTradeWarAssetValue(player, mode),
    0
  );
  return {
    total,
    flexTotal: flex.reduce(
      (sum, player) => sum + getTradeWarAssetValue(player, mode),
      0
    ),
  };
}

function buildTradeWarMetrics(
  players: TradeWarAsset[],
  positionMode: TradeWarMode = "contender"
): TradeWarRosterMetrics {
  const dynastyTotal = players.reduce(
    (sum, player) => sum + getTradeWarAssetValue(player, "dynasty"),
    0
  );
  const contenderTotal = players.reduce(
    (sum, player) => sum + getTradeWarAssetValue(player, "contender"),
    0
  );
  const rebuildTotal = players.reduce(
    (sum, player) => sum + getTradeWarAssetValue(player, "rebuilder"),
    0
  );
  const contenderLineup = buildTradeWarLineupScore(players, "contender");
  const rebuildLineup = buildTradeWarLineupScore(players, "rebuilder");
  const dynastyLineup = buildTradeWarLineupScore(players, "dynasty");
  const ages = players
    .map(getTradeWarPlayerAge)
    .filter((age): age is number => age !== null);
  const averageAge = ages.length
    ? ages.reduce((sum, age) => sum + age, 0) / ages.length
    : 0;
  const ageCredit = Math.max(0, 31 - averageAge) * 65;

  return {
    QB: sumTradeWarTopByPosition(
      players,
      "QB",
      TRADE_WAR_LINEUP_SLOTS.QB,
      positionMode
    ),
    RB: sumTradeWarTopByPosition(
      players,
      "RB",
      TRADE_WAR_LINEUP_SLOTS.RB,
      positionMode
    ),
    WR: sumTradeWarTopByPosition(
      players,
      "WR",
      TRADE_WAR_LINEUP_SLOTS.WR,
      positionMode
    ),
    TE: sumTradeWarTopByPosition(
      players,
      "TE",
      TRADE_WAR_LINEUP_SLOTS.TE,
      positionMode
    ),
    Value: dynastyTotal,
    Power: Math.round(
      contenderLineup.total * 0.52 +
        dynastyLineup.total * 0.3 +
        rebuildTotal * 0.14 +
        ageCredit
    ),
    Contender: Math.round(contenderLineup.total),
    Rebuild: Math.round(
      rebuildTotal * 0.72 + rebuildLineup.total * 0.22 + ageCredit
    ),
  };
}

function buildTradeWarRankMaps(
  metricsByManager: Map<string, TradeWarRosterMetrics>
) {
  const metricKeys: TradeWarMetricKey[] = [
    "QB",
    "RB",
    "WR",
    "TE",
    "Value",
    "Power",
    "Contender",
    "Rebuild",
  ];
  const rankMaps = new Map<string, TradeWarMetricRanks>();

  metricsByManager.forEach((_metrics, manager) => {
    rankMaps.set(manager, {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      Value: 0,
      Power: 0,
      Contender: 0,
      Rebuild: 0,
    });
  });

  metricKeys.forEach(metric => {
    const ranked = Array.from(metricsByManager.entries()).sort(
      (a, b) => b[1][metric] - a[1][metric]
    );
    ranked.forEach(([manager], index) => {
      rankMaps.get(manager)![metric] = index + 1;
    });
  });

  return rankMaps;
}

function formatTradeWarRankShift(label: string, before: number, after: number) {
  const delta = before - after;
  if (delta === 0) return `${label} #${before}`;
  return `${label} #${before} -> #${after}`;
}

function buildTradeWarSnapshot({
  manager,
  row,
  metricsByManager,
  rankMaps,
  assets,
}: {
  manager: string;
  row?: OwnerIntelRow;
  metricsByManager: Map<string, TradeWarRosterMetrics>;
  rankMaps: Map<string, TradeWarMetricRanks>;
  assets: TradeWarAsset[];
}): TradeWarRosterSnapshot {
  const metrics = metricsByManager.get(manager) || buildTradeWarMetrics(assets);
  const ages = assets
    .map(getTradeWarPlayerAge)
    .filter((age): age is number => age !== null);
  return {
    metrics,
    ranks: rankMaps.get(manager) || {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      Value: 0,
      Power: 0,
      Contender: 0,
      Rebuild: 0,
    },
    needPosition: row?.tradePlan?.needPosition || null,
    surplusPosition: row?.tradePlan?.surplusPosition || null,
    avgAge: ages.length
      ? Number(
          (ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(1)
        )
      : null,
  };
}

function buildTradeWarSimulationNotes({
  manager,
  before,
  after,
  mode,
}: {
  manager: string;
  before: TradeWarRosterSnapshot;
  after: TradeWarRosterSnapshot;
  mode: TradeWarMode;
}) {
  const notes: string[] = [];
  const need = before.needPosition;
  const surplus = before.surplusPosition;

  if (need) {
    const beforeNeedRank = before.ranks[need as "QB" | "RB" | "WR" | "TE"];
    const afterNeedRank = after.ranks[need as "QB" | "RB" | "WR" | "TE"];
    if (afterNeedRank < beforeNeedRank) {
      notes.push(
        `${manager} improves the ${need} room from #${beforeNeedRank} to #${afterNeedRank}.`
      );
    } else if (afterNeedRank > beforeNeedRank) {
      notes.push(
        `${manager} leaves ${need} weaker, sliding from #${beforeNeedRank} to #${afterNeedRank}.`
      );
    } else {
      notes.push(`${manager}'s ${need} room stays flat at #${afterNeedRank}.`);
    }
  }

  if (surplus) {
    const beforeSurplusRank =
      before.ranks[surplus as "QB" | "RB" | "WR" | "TE"];
    const afterSurplusRank = after.ranks[surplus as "QB" | "RB" | "WR" | "TE"];
    if (afterSurplusRank > beforeSurplusRank) {
      notes.push(
        `${manager} is spending down ${surplus} depth, moving that room from #${beforeSurplusRank} to #${afterSurplusRank}.`
      );
    }
  }

  const isRedraftTradeMode =
    mode === "starter-upgrade" ||
    mode === "depth-fix" ||
    mode === "positional-need" ||
    mode === "playoff-push" ||
    mode === "waiver-leverage";
  const metricKey =
    mode === "contender"
      ? "Contender"
      : mode === "rebuilder"
        ? "Rebuild"
        : "Value";
  const metricLabel =
    mode === "contender"
      ? "contender score"
      : mode === "rebuilder"
        ? "rebuild score"
        : isRedraftTradeMode
          ? "current-season value"
          : "dynasty value";
  const beforeMetricRank = before.ranks[metricKey];
  const afterMetricRank = after.ranks[metricKey];
  if (afterMetricRank < beforeMetricRank) {
    notes.push(
      `The ${getTradeWarModeLabel(mode).toLowerCase()} lens likes it: ${metricLabel} improves from #${beforeMetricRank} to #${afterMetricRank}.`
    );
  } else if (afterMetricRank > beforeMetricRank) {
    notes.push(
      `The ${getTradeWarModeLabel(mode).toLowerCase()} lens pushes back: ${metricLabel} falls from #${beforeMetricRank} to #${afterMetricRank}.`
    );
  }

  if (after.ranks.Power !== before.ranks.Power) {
    notes.push(
      `Overall power moves from #${before.ranks.Power} to #${after.ranks.Power}.`
    );
  }

  if (!notes.length) {
    notes.push(
      `${manager}'s roster shape barely moves. This is mostly a value swap.`
    );
  }

  return notes.slice(0, 4);
}

function buildTradeWarTargetSuggestion({
  manager,
  otherManager,
  row,
  currentIncoming,
  opponentAssets,
  mode,
}: {
  manager: string;
  otherManager: string;
  row?: OwnerIntelRow;
  currentIncoming: TradeWarAsset[];
  opponentAssets: TradeWarAsset[];
  mode: TradeWarMode;
}) {
  const need = row?.tradePlan?.needPosition;
  if (!need) return null;
  const currentlyBuyingNeed = currentIncoming.some(asset => asset.pos === need);
  const candidates = opponentAssets
    .filter(asset => asset.pos === need)
    .sort(
      (a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
    );

  if (!candidates.length) return null;
  const best = candidates[0];
  const currentNeedPiece = currentIncoming
    .filter(asset => asset.pos === need)
    .sort(
      (a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
    )[0];

  if (
    currentNeedPiece &&
    getTradeWarAssetValue(currentNeedPiece, mode) >=
      getTradeWarAssetValue(best, mode) - 75
  ) {
    return null;
  }

  return {
    label: currentlyBuyingNeed
      ? `Better ${need} target from ${otherManager}`
      : `Need target from ${otherManager}`,
    summary: currentlyBuyingNeed
      ? `${manager} is buying ${need}, but ${best.name} is the cleaner ${getTradeWarModeLabel(mode).toLowerCase()} fit from ${otherManager}.`
      : `${manager} still needs ${need}. ${best.name} is the best ${need} target sitting on ${otherManager}'s roster.`,
    asset: best,
  };
}

function buildTradeWarSweetenerSuggestion({
  manager,
  row,
  selectedIds,
  selectedAllIds,
  allAssets,
  gap,
  mode,
}: {
  manager: string;
  row?: OwnerIntelRow;
  selectedIds: string[];
  selectedAllIds: Set<string>;
  allAssets: TradeWarAsset[];
  gap: number;
  mode: TradeWarMode;
}) {
  const absGap = Math.abs(gap);
  if (absGap <= 250) return null;
  const surplus = row?.tradePlan?.surplusPosition;
  const candidates = allAssets
    .filter(
      asset =>
        asset.manager === manager &&
        !selectedIds.includes(asset.player_id) &&
        !selectedAllIds.has(asset.player_id)
    )
    .filter(asset => !surplus || asset.pos === surplus)
    .map(asset => ({ asset, value: getTradeWarAssetValue(asset, mode) }))
    .filter(({ value }) => value > 0 && value <= absGap * 1.65)
    .sort((a, b) => Math.abs(absGap - a.value) - Math.abs(absGap - b.value));

  const best = candidates[0];
  if (!best) return null;
  return {
    label: `${manager} add-on`,
    summary: `${manager} can close the gap by floating ${best.asset.name} from the ${best.asset.pos} room.`,
    asset: best.asset,
  };
}

function buildTradeWarFitNotes({
  manager,
  row,
  incoming,
  outgoing,
}: {
  manager: string;
  row?: OwnerIntelRow;
  incoming: TradeWarAsset[];
  outgoing: TradeWarAsset[];
}): string[] {
  if (!row)
    return [
      `Pick ${manager}'s roster first so this can judge the construction fit.`,
    ];
  const notes: string[] = [];
  const incomingCounts = getTradeWarPositionCounts(incoming);
  const outgoingCounts = getTradeWarPositionCounts(outgoing);
  const need = row.tradePlan?.needPosition;
  const surplus = row.tradePlan?.surplusPosition;

  if (need && incomingCounts[need]) {
    notes.push(`${manager} is actually buying a need at ${need}.`);
  }
  if (surplus && outgoingCounts[surplus]) {
    notes.push(`${manager} is spending from surplus ${surplus} depth.`);
  }
  if (surplus && incomingCounts[surplus]) {
    notes.push(
      `Warning: this adds more ${surplus} to a room already flagged as surplus.`
    );
  }
  if (need && outgoingCounts[need]) {
    notes.push(
      `Warning: this ships out ${need}, which is the roster's cleanest need spot.`
    );
  }

  if (!notes.length && incoming.length) {
    notes.push(
      `${manager}'s roster fit is neutral. The deal is mostly about value, not construction.`
    );
  }
  if (!incoming.length) {
    notes.push(`${manager} has not received anything yet.`);
  }
  return notes.slice(0, 3);
}

function buildTradeWarModalData({
  asset,
  playerDetailsById,
  managerAvatars,
  value,
  mode,
}: {
  asset: TradeWarAsset;
  playerDetailsById?: PlayerDetailsById;
  managerAvatars?: ManagerAvatars;
  value: number;
  mode: TradeWarMode;
}) {
  return buildPlayerModalData({
    playerId: asset.player_id,
    playerName: asset.name,
    playerPos: asset.pos,
    value,
    playerDetails: asset.playerDetails,
    playerDetailsById,
    currentPositionRank: getTradeWarAssetRank(asset, mode),
    manager: asset.manager,
    managerAvatarUrl: managerAvatars?.[asset.manager],
    valueChangeNote: `${getTradeWarModeLabel(mode)} trade lens value.`,
  });
}

function TradeWarPlayerCard({
  asset,
  mode,
  isHighlighted,
  isSideOwner,
  managerAvatars,
  onAdd,
  onDetails,
}: {
  asset: TradeWarAsset;
  mode: TradeWarMode;
  isHighlighted: boolean;
  isSideOwner: boolean;
  managerAvatars?: ManagerAvatars;
  onAdd: () => void;
  onDetails: () => void;
}) {
  const value = getTradeWarAssetValue(asset, mode);
  const rank = getTradeWarAssetRank(asset, mode);
  const team = getTradeWarAssetTeam(asset);
  return (
    <div
      className={`player-team-tile trade-war-player-card ${isHighlighted ? "" : "trade-war-player-muted"}`}
      style={getTeamTileStyle(team)}
    >
      <button type="button" className="trade-war-player-add" onClick={onAdd}>
        <span className="trade-war-player-name">
          <PlayerNameWithHeadshot
            playerId={asset.player_id}
            playerName={asset.name}
            team={team}
            position={asset.pos}
          />
        </span>
        <span className="trade-war-owner">
          <ChampionAvatarFrame
            managerName={asset.manager}
            className="trade-war-owner-avatar"
          >
            {managerAvatars?.[asset.manager] ? (
              <img
                src={managerAvatars[asset.manager] || ""}
                alt={asset.manager}
              />
            ) : (
              <span>{asset.manager.trim()[0]?.toUpperCase() || "?"}</span>
            )}
          </ChampionAvatarFrame>
          <span>{asset.manager}</span>
        </span>
        <span className="trade-war-player-pills">
          <TeamLogoPill team={team} />
          <PositionRankPill rank={rank || asset.pos} />
          <span>{formatCompactValue(value)}</span>
          {!isSideOwner && (
            <span className="trade-war-off-roster-pill">Other roster</span>
          )}
        </span>
      </button>
      <button
        type="button"
        className="trade-war-detail-button"
        onClick={onDetails}
      >
        Card
      </button>
    </div>
  );
}

export default function TradeWarRoom({
  data,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  leagueOverview,
  powerRankings,
  dynastyTimelines,
  viewerManager,
  currentStandings,
  leagueValueMode: leagueValueModeInput = "dynasty",
}: {
  data?: ReportData["managerRosterIntelligence"];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
  leagueOverview?: ReportData["leagueOverview"];
  powerRankings?: ReportData["powerRankings"];
  dynastyTimelines?: ReportData["dynastyTimelines"];
  viewerManager?: string | null;
  currentStandings?: ReportData["currentStandings"];
  leagueValueMode?: ReportData["leagueValueMode"];
}) {
  const leagueValueMode = normalizeLeagueValueMode(leagueValueModeInput);
  const tradeWarModeOptions: TradeWarMode[] =
    leagueValueMode === "redraft"
      ? [
          "starter-upgrade",
          "depth-fix",
          "positional-need",
          "playoff-push",
          "waiver-leverage",
        ]
      : ["dynasty", "contender", "rebuilder"];
  const managers = React.useMemo(
    () =>
      sortRowsByViewerAndStanding(data || [], row => row.manager, {
        viewerManager,
        standings: currentStandings,
        leagueOverview,
      }).map(row => row.manager),
    [currentStandings, data, leagueOverview, viewerManager]
  );
  const managerRows = React.useMemo(
    () => new Map((data || []).map(row => [row.manager, row])),
    [data]
  );
  const [mode, setMode] = useState<TradeWarMode>(tradeWarModeOptions[0]);
  const [managerAState, setManagerAState] = useState("");
  const [managerBState, setManagerBState] = useState("");
  const managerA = managerAState || managers[0] || "";
  const managerB =
    managerBState ||
    managers.find(manager => manager !== managerA) ||
    managers[0] ||
    "";
  const [sideAIds, setSideAIds] = useState<string[]>([]);
  const [sideBIds, setSideBIds] = useState<string[]>([]);
  const [queryA, setQueryA] = useState("");
  const [queryB, setQueryB] = useState("");
  const [mobilePickerOpen, setMobilePickerOpen] = useState<{
    A: boolean;
    B: boolean;
  }>({ A: false, B: false });
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );

  React.useEffect(() => {
    if (!tradeWarModeOptions.includes(mode)) {
      setMode(tradeWarModeOptions[0]);
    }
  }, [mode, tradeWarModeOptions]);

  const allAssets = React.useMemo(() => {
    const mapped = new Map<string, TradeWarAsset>();
    (data || []).forEach(row => {
      const addPlayers = (
        players: ManagerIntelPlayer[] | undefined,
        assetState: TradeWarAsset["assetState"]
      ) => {
        (players || []).forEach(player => {
          if (!player?.player_id || mapped.has(player.player_id)) return;
          mapped.set(player.player_id, {
            ...player,
            manager: player.owner || row.manager,
            assetState,
          });
        });
      };
      addPlayers(row.rosterPlayers, "roster");
      addPlayers(row.benchPlayers, "bench");
      addPlayers(row.reservePlayers, "reserve");
      addPlayers(row.taxiPlayers, "taxi");
    });
    return Array.from(mapped.values()).sort(
      (a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
    );
  }, [data, mode]);

  const assetById = React.useMemo(
    () => new Map(allAssets.map(asset => [asset.player_id, asset])),
    [allAssets]
  );
  const selectedAllIds = React.useMemo(
    () => new Set([...sideAIds, ...sideBIds]),
    [sideAIds, sideBIds]
  );
  const sideAAssets = sideAIds
    .map(id => assetById.get(id))
    .filter((asset): asset is TradeWarAsset => Boolean(asset));
  const sideBAssets = sideBIds
    .map(id => assetById.get(id))
    .filter((asset): asset is TradeWarAsset => Boolean(asset));
  const sideATotal = sideAAssets.reduce(
    (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
    0
  );
  const sideBTotal = sideBAssets.reduce(
    (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
    0
  );
  const valueGap = sideBTotal - sideATotal;
  const gapRead = getTradeWarGapLabel(valueGap);
  const tradeWarPulseKey = `${mode}-${sideATotal}-${sideBTotal}-${gapRead.className}`;
  const managerARow = managerRows.get(managerA);
  const managerBRow = managerRows.get(managerB);
  const assetsByManager = React.useMemo(() => {
    const grouped = new Map<string, TradeWarAsset[]>();
    allAssets.forEach(asset => {
      const existing = grouped.get(asset.manager) || [];
      existing.push(asset);
      grouped.set(asset.manager, existing);
    });
    return grouped;
  }, [allAssets]);

  const baselineMetricsByManager = React.useMemo(() => {
    const mapped = new Map<string, TradeWarRosterMetrics>();
    assetsByManager.forEach((assets, manager) => {
      mapped.set(manager, buildTradeWarMetrics(assets, mode));
    });
    return mapped;
  }, [assetsByManager, mode]);

  const simulatedAssetsByManager = React.useMemo(() => {
    const next = new Map<string, TradeWarAsset[]>();
    assetsByManager.forEach((assets, manager) => {
      next.set(manager, [...assets]);
    });

    const applySwap = (
      manager: string,
      outgoingIds: string[],
      incomingAssets: TradeWarAsset[]
    ) => {
      const current = next.get(manager) || [];
      const filtered = current.filter(
        asset => !outgoingIds.includes(asset.player_id)
      );
      next.set(manager, [...filtered, ...incomingAssets]);
    };

    applySwap(managerA, sideAIds, sideBAssets);
    applySwap(managerB, sideBIds, sideAAssets);
    return next;
  }, [
    assetsByManager,
    managerA,
    managerB,
    sideAAssets,
    sideAIds,
    sideBAssets,
    sideBIds,
  ]);

  const simulatedMetricsByManager = React.useMemo(() => {
    const mapped = new Map<string, TradeWarRosterMetrics>();
    simulatedAssetsByManager.forEach((assets, manager) => {
      mapped.set(manager, buildTradeWarMetrics(assets, mode));
    });
    return mapped;
  }, [simulatedAssetsByManager, mode]);

  const baselineRankMaps = React.useMemo(
    () => buildTradeWarRankMaps(baselineMetricsByManager),
    [baselineMetricsByManager]
  );
  const simulatedRankMaps = React.useMemo(
    () => buildTradeWarRankMaps(simulatedMetricsByManager),
    [simulatedMetricsByManager]
  );

  const beforeA = buildTradeWarSnapshot({
    manager: managerA,
    row: managerARow,
    metricsByManager: baselineMetricsByManager,
    rankMaps: baselineRankMaps,
    assets: assetsByManager.get(managerA) || [],
  });
  const afterA = buildTradeWarSnapshot({
    manager: managerA,
    row: managerARow,
    metricsByManager: simulatedMetricsByManager,
    rankMaps: simulatedRankMaps,
    assets: simulatedAssetsByManager.get(managerA) || [],
  });
  const beforeB = buildTradeWarSnapshot({
    manager: managerB,
    row: managerBRow,
    metricsByManager: baselineMetricsByManager,
    rankMaps: baselineRankMaps,
    assets: assetsByManager.get(managerB) || [],
  });
  const afterB = buildTradeWarSnapshot({
    manager: managerB,
    row: managerBRow,
    metricsByManager: simulatedMetricsByManager,
    rankMaps: simulatedRankMaps,
    assets: simulatedAssetsByManager.get(managerB) || [],
  });

  const managerAFitNotes = buildTradeWarSimulationNotes({
    manager: managerA,
    before: beforeA,
    after: afterA,
    mode,
  });
  const managerBFitNotes = buildTradeWarSimulationNotes({
    manager: managerB,
    before: beforeB,
    after: afterB,
    mode,
  });

  const managerATarget = buildTradeWarTargetSuggestion({
    manager: managerA,
    otherManager: managerB,
    row: managerARow,
    currentIncoming: sideBAssets,
    opponentAssets: assetsByManager.get(managerB) || [],
    mode,
  });
  const managerBTarget = buildTradeWarTargetSuggestion({
    manager: managerB,
    otherManager: managerA,
    row: managerBRow,
    currentIncoming: sideAAssets,
    opponentAssets: assetsByManager.get(managerA) || [],
    mode,
  });

  const getSearchResults = (query: string, sideManager: string) => {
    const normalized = query.trim().toLowerCase();
    return allAssets
      .filter(asset => !selectedAllIds.has(asset.player_id))
      .filter(
        asset => !normalized || asset.name.toLowerCase().includes(normalized)
      )
      .sort((a, b) => {
        const ownedDelta =
          Number(b.manager === sideManager) - Number(a.manager === sideManager);
        if (ownedDelta) return ownedDelta;
        return getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode);
      })
      .slice(0, normalized ? 12 : 8);
  };

  const addOnSuggestion = buildTradeWarSweetenerSuggestion({
    manager: valueGap > 0 ? managerA : managerB,
    row: valueGap > 0 ? managerARow : managerBRow,
    selectedIds: valueGap > 0 ? sideAIds : sideBIds,
    selectedAllIds,
    allAssets,
    gap: valueGap,
    mode,
  });

  const leagueOverviewByManager = React.useMemo(
    () => new Map((leagueOverview || []).map(row => [row.manager, row])),
    [leagueOverview]
  );
  const powerByManager = React.useMemo(
    () => new Map((powerRankings || []).map(row => [row.manager, row])),
    [powerRankings]
  );
  const timelineByManager = React.useMemo(
    () => new Map((dynastyTimelines || []).map(row => [row.manager, row])),
    [dynastyTimelines]
  );

  const renderSuggestedAsset = (
    suggestion: { label: string; summary: string; asset: TradeWarAsset } | null
  ) => {
    if (!suggestion) return null;
    const team = getTradeWarAssetTeam(suggestion.asset);
    return (
      <div className="trade-war-suggestion-block">
        <span>{suggestion.label}</span>
        <p>{suggestion.summary}</p>
        <button
          type="button"
          className="player-team-tile trade-war-suggested-asset"
          style={getTeamTileStyle(team)}
          onClick={() => openAssetModal(suggestion.asset)}
        >
          <div className="trade-war-suggested-main">
            <PlayerNameWithHeadshot
              playerId={suggestion.asset.player_id}
              playerName={suggestion.asset.name}
              team={team}
              position={suggestion.asset.pos}
            />
            <span className="trade-war-player-pills">
              <TeamLogoPill team={team} />
              <PositionRankPill
                rank={
                  getTradeWarAssetRank(suggestion.asset, mode) ||
                  suggestion.asset.pos
                }
              />
              <span>
                {formatCompactValue(
                  getTradeWarAssetValue(suggestion.asset, mode)
                )}
              </span>
            </span>
          </div>
        </button>
      </div>
    );
  };

  const renderRankPanel = (
    manager: string,
    before: TradeWarRosterSnapshot,
    after: TradeWarRosterSnapshot
  ) => {
    const powerRow = powerByManager.get(manager);
    const timelineRow = timelineByManager.get(manager);
    const overviewRow = leagueOverviewByManager.get(manager);
    return (
      <div className="trade-war-note-panel">
        <span>{manager} Before / After</span>
        <div className="trade-war-rank-pills">
          <span>
            {formatTradeWarRankShift("QB", before.ranks.QB, after.ranks.QB)}
          </span>
          <span>
            {formatTradeWarRankShift("RB", before.ranks.RB, after.ranks.RB)}
          </span>
          <span>
            {formatTradeWarRankShift("WR", before.ranks.WR, after.ranks.WR)}
          </span>
          <span>
            {formatTradeWarRankShift("TE", before.ranks.TE, after.ranks.TE)}
          </span>
          <span>
            {formatTradeWarRankShift(
              "Value",
              before.ranks.Value,
              after.ranks.Value
            )}
          </span>
          <span>
            {formatTradeWarRankShift(
              "Power",
              before.ranks.Power,
              after.ranks.Power
            )}
          </span>
          {leagueValueMode === "dynasty" && (
            <>
              <span>
                {formatTradeWarRankShift(
                  "Contender",
                  before.ranks.Contender,
                  after.ranks.Contender
                )}
              </span>
              <span>
                {formatTradeWarRankShift(
                  "Rebuild",
                  before.ranks.Rebuild,
                  after.ranks.Rebuild
                )}
              </span>
            </>
          )}
        </div>
        <p>
          {getTradeWarModeLabel(mode)} lens focuses on{" "}
          {getTradeWarModeRankLabel(mode).toLowerCase()} value.
          {overviewRow
            ? ` Current overview ranks were QB #${overviewRow.rank_qb}, RB #${overviewRow.rank_rb}, WR #${overviewRow.rank_wr}, TE #${overviewRow.rank_te}, Value #${overviewRow.rank_value}.`
            : ""}
          {powerRow ? ` Stored power score ${powerRow.score}.` : ""}
          {leagueValueMode === "dynasty" && timelineRow
            ? ` Stored timeline reads contender ${timelineRow.contenderScore}, rebuild ${timelineRow.rebuildScore}.`
            : ""}
        </p>
      </div>
    );
  };

  const openAssetModal = (asset: TradeWarAsset) => {
    setSelectedPlayer(
      buildTradeWarModalData({
        asset,
        playerDetailsById,
        managerAvatars,
        value: getTradeWarAssetValue(asset, mode),
        mode,
      })
    );
  };

  const renderSelectedAssets = (
    assets: TradeWarAsset[],
    removeAsset: (playerId: string) => void,
    emptyText: string
  ) => {
    if (!assets.length) {
      return <div className="trade-war-empty">{emptyText}</div>;
    }

    return (
      <div className="trade-war-selected-assets">
        {assets.map(asset => {
          const team = getTradeWarAssetTeam(asset);
          const value = getTradeWarAssetValue(asset, mode);
          return (
            <div
              key={asset.player_id}
              className="player-team-tile trade-war-selected-asset"
              style={getTeamTileStyle(team)}
            >
              <button
                type="button"
                className="trade-war-selected-main"
                onClick={() => openAssetModal(asset)}
              >
                <PlayerNameWithHeadshot
                  playerId={asset.player_id}
                  playerName={asset.name}
                  team={team}
                  position={asset.pos}
                />
                <span className="trade-war-player-pills">
                  <TeamLogoPill team={team} />
                  <PositionRankPill
                    rank={getTradeWarAssetRank(asset, mode) || asset.pos}
                  />
                  <span>{formatCompactValue(value)}</span>
                </span>
              </button>
              <button
                type="button"
                className="trade-war-remove"
                aria-label={`Remove ${asset.name}`}
                onClick={event => {
                  event.stopPropagation();
                  removeAsset(asset.player_id);
                }}
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTradeSide = ({
    label,
    sideKey,
    manager,
    otherManager,
    query,
    setQuery,
    assets,
    setAssets,
    total,
  }: {
    label: string;
    sideKey: "A" | "B";
    manager: string;
    otherManager: string;
    query: string;
    setQuery: (value: string) => void;
    assets: TradeWarAsset[];
    setAssets: React.Dispatch<React.SetStateAction<string[]>>;
    total: number;
  }) => {
    const results = getSearchResults(query, manager);
    const highlightedManagers = new Set([
      manager,
      ...assets.map(asset => asset.manager),
    ]);
    const isPickerOpen = mobilePickerOpen[sideKey];

    return (
      <div
        className={`trade-war-side ${assets.length ? "trade-war-side-loaded" : ""}`}
        data-side={sideKey}
      >
        <div className="trade-war-side-header">
          <div className="trade-war-manager-lockup">
            <ChampionAvatarFrame
              managerName={manager}
              className="trade-war-manager-avatar"
            >
              {managerAvatars?.[manager] ? (
                <img src={managerAvatars[manager] || ""} alt={manager} />
              ) : (
                <span>{manager.trim()[0]?.toUpperCase() || "?"}</span>
              )}
            </ChampionAvatarFrame>
            <div>
              <span>{label}</span>
              <strong>{manager}</strong>
            </div>
          </div>
          <div className="trade-war-side-total">
            <span>Sends</span>
            <strong key={`${sideKey}-${mode}-${total}`}>
              {total.toLocaleString()}
            </strong>
          </div>
        </div>

        {renderSelectedAssets(
          assets,
          playerId =>
            setAssets(current => current.filter(id => id !== playerId)),
          `${manager} has not added assets yet.`
        )}

        <div
          className={`trade-war-picker ${isPickerOpen ? "trade-war-picker-open" : ""}`}
        >
          <button
            type="button"
            className="trade-war-picker-toggle"
            onClick={() =>
              setMobilePickerOpen(current => ({
                ...current,
                [sideKey]: !current[sideKey],
              }))
            }
            aria-expanded={isPickerOpen}
          >
            <span>Add / Browse Players</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isPickerOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          <div className="trade-war-picker-body">
            <label className="trade-war-search">
              <span>Add player</span>
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={`Search ${manager}, ${otherManager}, or anyone`}
              />
            </label>

            <div
              className="trade-war-player-grid balanced-tile-grid"
              style={getBalancedGridStyle(results.length)}
            >
              {results.map(asset => (
                <TradeWarPlayerCard
                  key={asset.player_id}
                  asset={asset}
                  mode={mode}
                  managerAvatars={managerAvatars}
                  isHighlighted={highlightedManagers.has(asset.manager)}
                  isSideOwner={asset.manager === manager}
                  onAdd={() =>
                    setAssets(current =>
                      current.includes(asset.player_id)
                        ? current
                        : [...current, asset.player_id]
                    )
                  }
                  onDetails={() => openAssetModal(asset)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!data?.length) return null;

  return (
    <div className="trade-war-room">
      <div className="trade-war-top">
        <div
          className="trade-war-mode-tabs"
          role="tablist"
          aria-label="Trade value lens"
        >
          {tradeWarModeOptions.map(option => (
            <button
              key={option}
              type="button"
              className={mode === option ? "active" : ""}
              onClick={() => setMode(option)}
            >
              {getTradeWarModeLabel(option)}
            </button>
          ))}
        </div>
      </div>

      <div className="trade-war-manager-selects">
        <label>
          <span>Side A</span>
          <select
            value={managerA}
            onChange={event => {
              const nextManager = event.target.value;
              setManagerAState(nextManager);
              if (nextManager === managerB) {
                setManagerBState(
                  managers.find(manager => manager !== nextManager) ||
                    nextManager
                );
              }
            }}
          >
            {managers.map(manager => (
              <option key={manager} value={manager}>
                {manager}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Side B</span>
          <select
            value={managerB}
            onChange={event => {
              const nextManager = event.target.value;
              setManagerBState(nextManager);
              if (nextManager === managerA) {
                setManagerAState(
                  managers.find(manager => manager !== nextManager) ||
                    nextManager
                );
              }
            }}
          >
            {managers.map(manager => (
              <option key={manager} value={manager}>
                {manager}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="trade-war-scoreboard">
        <div
          className="trade-war-score-card"
          key={`score-a-${mode}-${sideATotal}`}
        >
          <span>{managerA} sends</span>
          <strong>{sideATotal.toLocaleString()}</strong>
        </div>
        <div
          className={`trade-war-gap ${gapRead.className}`}
          key={tradeWarPulseKey}
          aria-live="polite"
        >
          <span>{gapRead.label}</span>
          <strong>{Math.abs(valueGap).toLocaleString()}</strong>
          <small>
            {valueGap === 0
              ? "No value gap"
              : valueGap > 0
                ? `${managerA} receives more`
                : `${managerB} receives more`}
          </small>
        </div>
        <div
          className="trade-war-score-card"
          key={`score-b-${mode}-${sideBTotal}`}
        >
          <span>{managerB} sends</span>
          <strong>{sideBTotal.toLocaleString()}</strong>
        </div>
      </div>

      <div className="trade-war-side-grid">
        {renderTradeSide({
          label: "Side A",
          sideKey: "A",
          manager: managerA,
          otherManager: managerB,
          query: queryA,
          setQuery: setQueryA,
          assets: sideAAssets,
          setAssets: setSideAIds,
          total: sideATotal,
        })}
        {renderTradeSide({
          label: "Side B",
          sideKey: "B",
          manager: managerB,
          otherManager: managerA,
          query: queryB,
          setQuery: setQueryB,
          assets: sideBAssets,
          setAssets: setSideBIds,
          total: sideBTotal,
        })}
      </div>

      <div className="trade-war-read-grid">
        {renderRankPanel(managerA, beforeA, afterA)}
        {renderRankPanel(managerB, beforeB, afterB)}
        <div className="trade-war-note-panel">
          <span>Roster Fit</span>
          {[...managerAFitNotes, ...managerBFitNotes].map(note => (
            <p key={note}>{note}</p>
          ))}
        </div>
        <div className="trade-war-note-panel trade-war-suggestions">
          <span>Make It Work</span>
          {renderSuggestedAsset(managerATarget)}
          {renderSuggestedAsset(managerBTarget)}
          {renderSuggestedAsset(addOnSuggestion)}
          {!managerATarget && !managerBTarget && !addOnSuggestion && (
            <p>
              This is already inside a normal negotiation window. Use fit, not
              just exact math, to decide.
            </p>
          )}
        </div>
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
