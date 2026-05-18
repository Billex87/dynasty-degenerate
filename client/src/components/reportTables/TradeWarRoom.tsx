import React, { useState } from "react";
import { ChevronDown, X as XIcon } from "lucide-react";
import { filterCompletedFuturePickPortfolios } from "@shared/pickPortfolioFilters";
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
  buildTradeValueCalibrationNote,
  getStrongestTradeValueCalibration,
} from "@/lib/tradeValueCalibration";
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
type TradeTendencyRow = NonNullable<ReportData["tradeTendencies"]>[number];
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
  assetState: "roster" | "bench" | "taxi" | "reserve" | "pick";
  assetKind?: "player" | "pick";
  pickLabel?: string;
  pickSeason?: string;
  pickRound?: number;
  originalOwner?: string;
};

function isTradeWarPickAsset(asset: TradeWarAsset): boolean {
  return asset.assetKind === "pick" || asset.assetState === "pick";
}

function isTradeWarPlayerAsset(asset: TradeWarAsset): boolean {
  return !isTradeWarPickAsset(asset);
}

function getTradeWarAssetValue(
  player: ManagerIntelPlayer,
  mode: TradeWarMode
): number {
  if ((player as TradeWarAsset).assetKind === "pick") {
    return Math.round(player.value || 0);
  }
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
  if ((player as TradeWarAsset).assetKind === "pick") {
    return (player as TradeWarAsset).pickSeason
      ? `${(player as TradeWarAsset).pickSeason} R${(player as TradeWarAsset).pickRound || "?"}`
      : "Pick";
  }
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
  if ((player as TradeWarAsset).assetKind === "pick") return null;
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

function normalizeTradeWarName(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildTradeWarTendencyLabel(
  tendency?: TradeTendencyRow | null
): string {
  if (!tendency) return "No trade ledger";
  if (tendency.overpaysForPicks) return "Pick aggressive";
  if (tendency.overpaysForVeterans) return "Veteran buyer";
  if (tendency.tradeCount >= 6) return "Active dealer";
  if (tendency.winPct >= 58) return "Profit seeker";
  if (tendency.tradeCount <= 1) return "Slow mover";
  return "Balanced trader";
}

function getTradeWarProposalPressure({
  manager,
  otherManager,
  proposalSignals,
}: {
  manager: string;
  otherManager: string;
  proposalSignals?: ReportData["tradeProposalSignals"];
}) {
  const managerKey = normalizeTradeWarName(manager);
  const otherKey = normalizeTradeWarName(otherManager);
  const related = (proposalSignals || []).filter(signal => {
    const managers = signal.managers.map(normalizeTradeWarName);
    return managers.includes(managerKey) && managers.includes(otherKey);
  });
  const openCount = related.filter(signal =>
    /pending|open|propos|counter|active/i.test(signal.status || "")
  ).length;
  const blockedCount = related.filter(signal =>
    /declin|reject|cancel|veto|fail|expire/i.test(signal.status || "")
  ).length;
  return { openCount, blockedCount, totalCount: related.length };
}

function getTradeWarPositionCounts(players: TradeWarAsset[]) {
  return players.filter(isTradeWarPlayerAsset).reduce<Record<string, number>>((acc, player) => {
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

type TradeWarNegotiationRead = {
  manager: string;
  score: number;
  label: string;
  tone: "good" | "warn" | "danger";
  chips: string[];
  summary: string;
};

type TradeWarPackageIdea = {
  id: string;
  label: string;
  summary: string;
  sideAIds: string[];
  sideBIds: string[];
  mode: TradeWarMode;
  gap: number;
  tone: "good" | "warn" | "danger";
  chips: string[];
};

const TRADE_WAR_LINEUP_SLOTS = {
  QB: 2,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 2,
} as const;

function getTradeWarPlayerAge(player: TradeWarAsset): number | null {
  if (isTradeWarPickAsset(player)) return null;
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
    .filter(isTradeWarPlayerAsset)
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
      .filter(isTradeWarPlayerAsset)
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
    .filter(isTradeWarPlayerAsset)
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
  const rosterPlayers = players.filter(isTradeWarPlayerAsset);
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
  const contenderLineup = buildTradeWarLineupScore(rosterPlayers, "contender");
  const rebuildLineup = buildTradeWarLineupScore(rosterPlayers, "rebuilder");
  const dynastyLineup = buildTradeWarLineupScore(rosterPlayers, "dynasty");
  const ages = rosterPlayers
    .map(getTradeWarPlayerAge)
    .filter((age): age is number => age !== null);
  const averageAge = ages.length
    ? ages.reduce((sum, age) => sum + age, 0) / ages.length
    : 0;
  const ageCredit = Math.max(0, 31 - averageAge) * 65;

  return {
    QB: sumTradeWarTopByPosition(
      rosterPlayers,
      "QB",
      TRADE_WAR_LINEUP_SLOTS.QB,
      positionMode
    ),
    RB: sumTradeWarTopByPosition(
      rosterPlayers,
      "RB",
      TRADE_WAR_LINEUP_SLOTS.RB,
      positionMode
    ),
    WR: sumTradeWarTopByPosition(
      rosterPlayers,
      "WR",
      TRADE_WAR_LINEUP_SLOTS.WR,
      positionMode
    ),
    TE: sumTradeWarTopByPosition(
      rosterPlayers,
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

function buildTradeWarPickRankMap(
  managers: string[],
  assetsByManager: Map<string, TradeWarAsset[]>
) {
  const ranked = managers
    .map(manager => ({
      manager,
      value: (assetsByManager.get(manager) || [])
        .filter(isTradeWarPickAsset)
        .reduce((sum, asset) => sum + (asset.value || 0), 0),
    }))
    .sort((a, b) => b.value - a.value);

  return new Map(ranked.map((row, index) => [row.manager, index + 1]));
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
  const isDynastyLens =
    mode === "dynasty" || mode === "contender" || mode === "rebuilder";
  const candidates = allAssets
    .filter(
      asset =>
        asset.manager === manager &&
        !selectedIds.includes(asset.player_id) &&
        !selectedAllIds.has(asset.player_id)
    )
    .filter(asset => {
      if (isTradeWarPickAsset(asset)) return isDynastyLens;
      return !surplus || asset.pos === surplus;
    })
    .map(asset => ({ asset, value: getTradeWarAssetValue(asset, mode) }))
    .filter(({ value }) => value > 0 && value <= absGap * 1.65)
    .sort((a, b) => {
      const distanceA = Math.abs(absGap - a.value);
      const distanceB = Math.abs(absGap - b.value);
      if (distanceA !== distanceB) return distanceA - distanceB;
      if (isTradeWarPickAsset(a.asset) !== isTradeWarPickAsset(b.asset)) {
        return isTradeWarPickAsset(a.asset) ? -1 : 1;
      }
      return b.value - a.value;
    });

  const best = candidates[0];
  if (!best) return null;
  const isPick = isTradeWarPickAsset(best.asset);
  return {
    label: isPick ? `${manager} pick sweetener` : `${manager} add-on`,
    summary: isPick
      ? `${manager} can close the gap by adding ${best.asset.name}; this preserves the player core while paying with dynasty draft capital.`
      : `${manager} can close the gap by floating ${best.asset.name} from the ${best.asset.pos} room.`,
    asset: best.asset,
  };
}

type TradeWarValueMatchIdea = {
  id: string;
  label: string;
  targetManager: string;
  sourceManager: string;
  targetValue: number;
  totalValue: number;
  gap: number;
  assets: TradeWarAsset[];
};

export function buildTradeWarValueMatchIdeas({
  targetManager,
  sourceManager,
  targetAssets,
  sourceAssets,
  selectedAllIds,
  mode,
}: {
  targetManager: string;
  sourceManager: string;
  targetAssets: TradeWarAsset[];
  sourceAssets: TradeWarAsset[];
  selectedAllIds: Set<string>;
  mode: TradeWarMode;
}): TradeWarValueMatchIdea[] {
  const targetValue = targetAssets.reduce(
    (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
    0
  );
  if (!targetValue) return [];

  const candidates = sourceAssets
    .filter(asset => !selectedAllIds.has(asset.player_id))
    .filter(asset => getTradeWarAssetValue(asset, mode) > 0)
    .sort((a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode));

  const ideas: TradeWarValueMatchIdea[] = [];
  candidates.forEach(asset => {
    const totalValue = getTradeWarAssetValue(asset, mode);
    ideas.push({
      id: `${sourceManager}:${asset.player_id}`,
      label: `${asset.name}`,
      targetManager,
      sourceManager,
      targetValue,
      totalValue,
      gap: Math.abs(targetValue - totalValue),
      assets: [asset],
    });
  });

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const first = candidates[i];
      const second = candidates[j];
      const totalValue =
        getTradeWarAssetValue(first, mode) + getTradeWarAssetValue(second, mode);
      if (totalValue > targetValue * 1.75 && totalValue - targetValue > 1200) continue;
      ideas.push({
        id: `${sourceManager}:${first.player_id}:${second.player_id}`,
        label: `${first.name} + ${second.name}`,
        targetManager,
        sourceManager,
        targetValue,
        totalValue,
        gap: Math.abs(targetValue - totalValue),
        assets: [first, second],
      });
    }
  }

  return ideas
    .sort((a, b) => {
      if (a.gap !== b.gap) return a.gap - b.gap;
      if (a.assets.length !== b.assets.length) return a.assets.length - b.assets.length;
      return b.totalValue - a.totalValue;
    })
    .slice(0, 4);
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

function buildTradeWarNegotiationRead({
  manager,
  otherManager,
  tendency,
  row,
  incoming,
  outgoing,
  valueGapForManager,
  proposalSignals,
}: {
  manager: string;
  otherManager: string;
  tendency?: TradeTendencyRow | null;
  row?: OwnerIntelRow;
  incoming: TradeWarAsset[];
  outgoing: TradeWarAsset[];
  valueGapForManager: number;
  proposalSignals?: ReportData["tradeProposalSignals"];
}): TradeWarNegotiationRead {
  const need = row?.tradePlan?.needPosition || null;
  const surplus = row?.tradePlan?.surplusPosition || null;
  const incomingNeed = Boolean(
    need &&
      incoming.some(
        asset => isTradeWarPlayerAsset(asset) && asset.pos === need
      )
  );
  const outgoingSurplus = Boolean(
    surplus &&
      outgoing.some(
        asset => isTradeWarPlayerAsset(asset) && asset.pos === surplus
      )
  );
  const outgoingCore = outgoing.some(asset =>
    row?.untouchablePlayers?.some(core => core.player_id === asset.player_id)
  );
  const incomingPickCount = incoming.filter(isTradeWarPickAsset).length;
  const outgoingPickCount = outgoing.filter(isTradeWarPickAsset).length;
  const incomingValueSignal = getStrongestTradeValueCalibration(
    incoming.filter(isTradeWarPlayerAsset)
  );
  const outgoingValueSignal = getStrongestTradeValueCalibration(
    outgoing.filter(isTradeWarPlayerAsset)
  );
  const pressure = getTradeWarProposalPressure({
    manager,
    otherManager,
    proposalSignals,
  });
  const favoritePartner =
    tendency?.favoritePartner &&
    normalizeTradeWarName(tendency.favoritePartner) ===
      normalizeTradeWarName(otherManager);

  let score = 48;
  if (valueGapForManager >= 650) score += 13;
  else if (valueGapForManager >= 250) score += 7;
  else if (valueGapForManager <= -1400) score -= 23;
  else if (valueGapForManager <= -650) score -= 14;
  else if (valueGapForManager <= -250) score -= 8;
  if (incomingNeed) score += 12;
  if (outgoingSurplus) score += 9;
  if (outgoingCore) score -= 15;
  if (incomingValueSignal?.calibration.outcome === "confirmed-riser") score += 6;
  if (incomingValueSignal?.calibration.outcome === "confirmed-faller") score -= 7;
  if (incomingValueSignal?.calibration.outcome === "low-denominator-watch") score -= 3;
  if (outgoingValueSignal?.calibration.outcome === "confirmed-riser") score -= 8;
  if (outgoingValueSignal?.calibration.outcome === "confirmed-faller") score += 4;
  if (outgoingValueSignal?.calibration.outcome === "watch-riser") score -= 3;
  if (favoritePartner) score += 6;
  if (tendency) {
    if (tendency.tradeCount >= 6) score += 9;
    else if (tendency.tradeCount >= 3) score += 5;
    else if (tendency.tradeCount <= 1) score -= 7;
    if (tendency.winPct >= 58 && valueGapForManager < 250) score -= 5;
    if (tendency.overpaysForPicks && incomingPickCount) score += 5;
    if (tendency.overpaysForPicks && outgoingPickCount) score -= 4;
    if (
      tendency.overpaysForVeterans &&
      incoming.some(
        asset =>
          isTradeWarPlayerAsset(asset) && (asset.playerDetails?.age || 0) >= 27
      )
    ) {
      score += 5;
    }
  }
  if (pressure.openCount) score -= Math.min(8, pressure.openCount * 3);
  if (pressure.blockedCount) score -= Math.min(10, pressure.blockedCount * 4);
  score = Math.max(8, Math.min(94, Math.round(score)));

  const label =
    score >= 72
      ? "Pitchable"
      : score >= 52
        ? "Negotiable"
        : score >= 36
          ? "Needs protection"
          : "Likely resisted";
  const tone = score >= 68 ? "good" : score >= 42 ? "warn" : "danger";
  const chips = [
    buildTradeWarTendencyLabel(tendency),
    favoritePartner ? "Favorite partner" : null,
    incomingNeed ? `${need} need filled` : need ? `${need} need open` : null,
    outgoingSurplus ? `${surplus} surplus spent` : null,
    incomingValueSignal ? `Buying ${incomingValueSignal.calibration.chip}` : null,
    outgoingValueSignal ? `Selling ${outgoingValueSignal.calibration.chip}` : null,
    pressure.blockedCount
      ? `${pressure.blockedCount} blocked signal${pressure.blockedCount === 1 ? "" : "s"}`
      : null,
    pressure.openCount
      ? `${pressure.openCount} open signal${pressure.openCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean) as string[];
  const summaryParts = [
    valueGapForManager > 250
      ? `${manager} is receiving the value edge by ${Math.abs(valueGapForManager).toLocaleString()}.`
      : valueGapForManager < -250
        ? `${manager} is being asked to eat a ${Math.abs(valueGapForManager).toLocaleString()} value gap.`
        : `${manager}'s value math is close enough for a fit-based pitch.`,
    incomingNeed
      ? `The incoming side answers ${need}.`
      : need
        ? `It does not solve the returned ${need} need yet.`
        : null,
    outgoingSurplus
      ? `The outgoing side spends from ${surplus} depth.`
      : surplus && outgoing.length
        ? `It is not clearly using the returned ${surplus} surplus.`
        : null,
    outgoingCore
      ? "It includes a protected/core asset, so expect resistance."
      : null,
    incomingValueSignal
      ? buildTradeValueCalibrationNote({
          name: incomingValueSignal.asset.name,
          calibration: incomingValueSignal.calibration,
          side: "incoming",
        })
      : null,
    outgoingValueSignal
      ? buildTradeValueCalibrationNote({
          name: outgoingValueSignal.asset.name,
          calibration: outgoingValueSignal.calibration,
          side: "outgoing",
        })
      : null,
    pressure.blockedCount
      ? "Recent failed proposal context should lower the opening ask."
      : null,
  ].filter(Boolean);

  return {
    manager,
    score,
    label,
    tone,
    chips: chips.slice(0, 4),
    summary: summaryParts.join(" "),
  };
}

export function buildTradeWarPackageIdeas({
  sideAIds,
  sideBIds,
  sideAAssets,
  sideBAssets,
  assetById,
  addOnSuggestion,
  valueGap,
  managerA,
  managerB,
  mode,
  tradeWarModeOptions,
  allAssets,
  selectedAllIds,
}: {
  sideAIds: string[];
  sideBIds: string[];
  sideAAssets: TradeWarAsset[];
  sideBAssets: TradeWarAsset[];
  assetById: Map<string, TradeWarAsset>;
  addOnSuggestion: { label: string; summary: string; asset: TradeWarAsset } | null;
  valueGap: number;
  managerA: string;
  managerB: string;
  mode: TradeWarMode;
  tradeWarModeOptions: TradeWarMode[];
  allAssets: TradeWarAsset[];
  selectedAllIds: Set<string>;
}): TradeWarPackageIdea[] {
  const ideas: TradeWarPackageIdea[] = [];
  const getIdsTotal = (ids: string[], ideaMode: TradeWarMode) =>
    ids.reduce((sum, id) => {
      const asset = assetById.get(id);
      return asset ? sum + getTradeWarAssetValue(asset, ideaMode) : sum;
    }, 0);
  const makeIdea = ({
    id,
    label,
    summary,
    nextSideAIds,
    nextSideBIds,
    ideaMode = mode,
    chips = [],
  }: {
    id: string;
    label: string;
    summary: string;
    nextSideAIds: string[];
    nextSideBIds: string[];
    ideaMode?: TradeWarMode;
    chips?: string[];
  }) => {
    const nextGap =
      getIdsTotal(nextSideBIds, ideaMode) - getIdsTotal(nextSideAIds, ideaMode);
    const absGap = Math.abs(nextGap);
    ideas.push({
      id,
      label,
      summary,
      sideAIds: nextSideAIds,
      sideBIds: nextSideBIds,
      mode: ideaMode,
      gap: nextGap,
      tone: absGap <= 350 ? "good" : absGap <= 900 ? "warn" : "danger",
      chips: [
        `${getTradeWarModeLabel(ideaMode)} lens`,
        `Gap ${absGap.toLocaleString()}`,
        ...chips,
      ].slice(0, 4),
    });
  };

  if (sideAIds.length || sideBIds.length) {
    makeIdea({
      id: "current",
      label: "Current Structure",
      summary:
        "Keep the current package and judge it through roster fit, negotiation score, and the selected value lens.",
      nextSideAIds: sideAIds,
      nextSideBIds: sideBIds,
      chips: ["Baseline"],
    });
  }

  if (addOnSuggestion) {
    const addToSideA = valueGap > 0;
    makeIdea({
      id: `add-${addOnSuggestion.asset.player_id}`,
      label: isTradeWarPickAsset(addOnSuggestion.asset)
        ? "Add Pick Sweetener"
        : "Add Player Sweetener",
      summary: addOnSuggestion.summary,
      nextSideAIds: addToSideA
        ? [...sideAIds, addOnSuggestion.asset.player_id]
        : sideAIds,
      nextSideBIds: addToSideA
        ? sideBIds
        : [...sideBIds, addOnSuggestion.asset.player_id],
      chips: ["Make it work"],
    });
  }

  const richSideIds = valueGap > 0 ? sideBIds : sideAIds;
  const richSideLabel = valueGap > 0 ? managerB : managerA;
  const bestRemoval = richSideIds
    .map(id => {
      const nextA = valueGap > 0 ? sideAIds : sideAIds.filter(item => item !== id);
      const nextB = valueGap > 0 ? sideBIds.filter(item => item !== id) : sideBIds;
      const removed = assetById.get(id);
      const nextGap = getIdsTotal(nextB, mode) - getIdsTotal(nextA, mode);
      return { id, removed, nextA, nextB, nextGap };
    })
    .filter(item => item.removed)
    .sort((a, b) => Math.abs(a.nextGap) - Math.abs(b.nextGap))[0];
  if (bestRemoval && Math.abs(bestRemoval.nextGap) < Math.abs(valueGap)) {
    makeIdea({
      id: `remove-${bestRemoval.id}`,
      label: "Remove Overpay Piece",
      summary: `${richSideLabel} can pull ${bestRemoval.removed?.name} out of the package to reduce the lopsided side without changing the headline asset.`,
      nextSideAIds: bestRemoval.nextA,
      nextSideBIds: bestRemoval.nextB,
      chips: ["Less lopsided"],
    });
  }

  const richManager = valueGap > 0 ? managerB : managerA;
  const richSelectedAssets = valueGap > 0 ? sideBAssets : sideAAssets;
  const swapCandidates = allAssets.filter(
    asset =>
      asset.manager === richManager &&
      !selectedAllIds.has(asset.player_id) &&
      getTradeWarAssetValue(asset, mode) > 0
  );
  const bestSwap = richSelectedAssets
    .flatMap(currentAsset =>
      swapCandidates.map(candidate => {
        const nextA =
          valueGap > 0
            ? sideAIds
            : sideAIds.map(id =>
                id === currentAsset.player_id ? candidate.player_id : id
              );
        const nextB =
          valueGap > 0
            ? sideBIds.map(id =>
                id === currentAsset.player_id ? candidate.player_id : id
              )
            : sideBIds;
        const nextGap = getIdsTotal(nextB, mode) - getIdsTotal(nextA, mode);
        return { currentAsset, candidate, nextA, nextB, nextGap };
      })
    )
    .filter(item => Math.abs(item.nextGap) < Math.abs(valueGap))
    .sort((a, b) => Math.abs(a.nextGap) - Math.abs(b.nextGap))[0];
  if (bestSwap) {
    makeIdea({
      id: `swap-${bestSwap.currentAsset.player_id}-${bestSwap.candidate.player_id}`,
      label: "Swap Target Down",
      summary: `Swap ${bestSwap.currentAsset.name} for ${bestSwap.candidate.name} to keep the same manager lane while making the math easier to defend.`,
      nextSideAIds: bestSwap.nextA,
      nextSideBIds: bestSwap.nextB,
      chips: ["Same side swap"],
    });
  }

  const bestLens = tradeWarModeOptions
    .filter(option => option !== mode)
    .map(option => {
      const nextGap =
        sideBAssets.reduce(
          (sum, asset) => sum + getTradeWarAssetValue(asset, option),
          0
        ) -
        sideAAssets.reduce(
          (sum, asset) => sum + getTradeWarAssetValue(asset, option),
          0
        );
      return { option, nextGap };
    })
    .sort((a, b) => Math.abs(a.nextGap) - Math.abs(b.nextGap))[0];
  if (bestLens && Math.abs(bestLens.nextGap) + 100 < Math.abs(valueGap)) {
    makeIdea({
      id: `lens-${bestLens.option}`,
      label: "Change The Lens",
      summary: `${getTradeWarModeLabel(bestLens.option)} value makes this package cleaner than the current ${getTradeWarModeLabel(mode).toLowerCase()} lens. Use this only if both managers actually care about that roster window.`,
      nextSideAIds: sideAIds,
      nextSideBIds: sideBIds,
      ideaMode: bestLens.option,
      chips: ["Window-sensitive"],
    });
  }

  const seen = new Set<string>();
  return ideas
    .filter(idea => {
      const key = `${idea.mode}:${idea.sideAIds.join(",")}:${idea.sideBIds.join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
    .slice(0, 5);
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

function TradeWarAssetLabel({ asset }: { asset: TradeWarAsset }) {
  if (isTradeWarPickAsset(asset)) {
    return (
      <span className="trade-war-pick-label">
        <span>{asset.pickLabel || asset.name}</span>
        {asset.originalOwner && asset.originalOwner !== asset.manager ? (
          <small>Original: {asset.originalOwner}</small>
        ) : null}
      </span>
    );
  }

  return (
    <PlayerNameWithHeadshot
      playerId={asset.player_id}
      playerName={asset.name}
      team={getTradeWarAssetTeam(asset)}
      position={asset.pos}
    />
  );
}

function TradeWarAssetPills({
  asset,
  mode,
}: {
  asset: TradeWarAsset;
  mode: TradeWarMode;
}) {
  const value = getTradeWarAssetValue(asset, mode);
  if (isTradeWarPickAsset(asset)) {
    return (
      <span className="trade-war-player-pills">
        <span>Draft Pick</span>
        <PositionRankPill rank={getTradeWarAssetRank(asset, mode) || "Pick"} />
        <span>{formatCompactValue(value)}</span>
      </span>
    );
  }

  return (
    <span className="trade-war-player-pills">
      <TeamLogoPill team={getTradeWarAssetTeam(asset)} />
      <PositionRankPill rank={getTradeWarAssetRank(asset, mode) || asset.pos} />
      <span>{formatCompactValue(value)}</span>
    </span>
  );
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
  const team = getTradeWarAssetTeam(asset);
  return (
    <div
      className={`player-team-tile trade-war-player-card ${isHighlighted ? "" : "trade-war-player-muted"}`}
      style={getTeamTileStyle(team)}
    >
      <button type="button" className="trade-war-player-add" onClick={onAdd}>
        <span className="trade-war-player-name">
          <TradeWarAssetLabel asset={asset} />
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
        <TradeWarAssetPills asset={asset} mode={mode} />
        {!isSideOwner && (
          <span className="trade-war-off-roster-pill">Other roster</span>
        )}
      </button>
      {!isTradeWarPickAsset(asset) && (
        <button
          type="button"
          className="trade-war-detail-button"
          onClick={onDetails}
        >
          Card
        </button>
      )}
    </div>
  );
}

function getTradeWarPositionBuckets(assets: TradeWarAsset[]) {
  const buckets: Record<"QB" | "RB" | "WR" | "TE" | "PICK", TradeWarAsset[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    PICK: [],
  };
  assets.forEach(asset => {
    if (isTradeWarPickAsset(asset)) {
      buckets.PICK.push(asset);
      return;
    }
    const pos = String(asset.pos || "").toUpperCase();
    if (pos === "QB" || pos === "RB" || pos === "WR" || pos === "TE") {
      buckets[pos].push(asset);
    }
  });
  return buckets;
}

function getTradeWarRankNumber(rank?: string | null): number | null {
  const match = String(rank || "").match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function getTradeWarRankTone(rank?: string | null): string {
  const value = getTradeWarRankNumber(rank);
  if (!value) return "empty";
  if (value <= 10) return "top";
  if (value <= 24) return "watch";
  return "deep";
}

function getTradeWarSectionClass(label: "QB" | "RB" | "WR" | "TE" | "PICKS") {
  return label === "PICKS" ? "pick" : label.toLowerCase();
}

function getTradeWarSectionRankLabel({
  label,
  ranks,
  pickRank,
}: {
  label: "QB" | "RB" | "WR" | "TE" | "PICKS";
  ranks?: TradeWarMetricRanks;
  pickRank?: number;
}) {
  if (label === "PICKS") return pickRank ? `#${pickRank}` : "-";
  return ranks?.[label] ? `#${ranks[label]}` : "-";
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
  pickPortfolios,
  draftPicks,
  tradeTendencies,
  tradeProposalSignals,
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
  pickPortfolios?: ReportData["pickPortfolios"];
  draftPicks?: ReportData["draftPicks"];
  tradeTendencies?: ReportData["tradeTendencies"];
  tradeProposalSignals?: ReportData["tradeProposalSignals"];
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
  const tradeTendencyByManager = React.useMemo(
    () =>
      new Map(
        (tradeTendencies || []).map(row => [
          normalizeTradeWarName(row.manager),
          row,
        ])
      ),
    [tradeTendencies]
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
  const [openInventoryManagers, setOpenInventoryManagers] = useState<
    Set<string>
  >(new Set());
  const [mobilePickerOpen, setMobilePickerOpen] = useState<{
    A: boolean;
    B: boolean;
  }>({ A: false, B: false });
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const visiblePickPortfolios = React.useMemo(
    () =>
      filterCompletedFuturePickPortfolios(pickPortfolios || [], draftPicks || []),
    [draftPicks, pickPortfolios]
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
    if (leagueValueMode === "dynasty") {
      visiblePickPortfolios.forEach(portfolio => {
        (portfolio.futurePicks || []).forEach(pick => {
          const assetId = `pick:${pick.id}`;
          if (mapped.has(assetId)) return;
          mapped.set(assetId, {
            player_id: assetId,
            name: pick.label,
            pos: "PICK",
            owner: pick.manager,
            value: pick.value,
            seasonValue: pick.value,
            currentPositionRank: `${pick.season} R${pick.round}`,
            manager: pick.manager,
            assetState: "pick",
            assetKind: "pick",
            pickLabel: pick.label,
            pickSeason: pick.season,
            pickRound: pick.round,
            originalOwner: pick.originalOwner,
          });
        });
      });
    }
    return Array.from(mapped.values()).sort(
      (a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
    );
  }, [data, leagueValueMode, mode, visiblePickPortfolios]);

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
  const pickRankByManager = React.useMemo(
    () => buildTradeWarPickRankMap(managers, assetsByManager),
    [assetsByManager, managers]
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
        asset =>
          !normalized ||
          [
            asset.name,
            asset.manager,
            asset.originalOwner,
            asset.pickLabel,
            asset.pickSeason,
          ]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(normalized))
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
  const packageIdeas = React.useMemo(
    () =>
      buildTradeWarPackageIdeas({
        sideAIds,
        sideBIds,
        sideAAssets,
        sideBAssets,
        assetById,
        addOnSuggestion,
        valueGap,
        managerA,
        managerB,
        mode,
        tradeWarModeOptions,
        allAssets,
        selectedAllIds,
      }),
    [
      addOnSuggestion,
      allAssets,
      assetById,
      managerA,
      managerB,
      mode,
      selectedAllIds,
      sideAAssets,
      sideAIds,
      sideBAssets,
      sideBIds,
      tradeWarModeOptions,
      valueGap,
    ]
  );
  const negotiationReads = React.useMemo(
    () => [
      buildTradeWarNegotiationRead({
        manager: managerA,
        otherManager: managerB,
        tendency: tradeTendencyByManager.get(normalizeTradeWarName(managerA)),
        row: managerARow,
        incoming: sideBAssets,
        outgoing: sideAAssets,
        valueGapForManager: valueGap,
        proposalSignals: tradeProposalSignals,
      }),
      buildTradeWarNegotiationRead({
        manager: managerB,
        otherManager: managerA,
        tendency: tradeTendencyByManager.get(normalizeTradeWarName(managerB)),
        row: managerBRow,
        incoming: sideAAssets,
        outgoing: sideBAssets,
        valueGapForManager: -valueGap,
        proposalSignals: tradeProposalSignals,
      }),
    ],
    [
      managerA,
      managerARow,
      managerB,
      managerBRow,
      sideAAssets,
      sideBAssets,
      tradeProposalSignals,
      tradeTendencyByManager,
      valueGap,
    ]
  );

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
  const pickPortfolioByManager = React.useMemo(
    () => new Map(visiblePickPortfolios.map(row => [row.manager, row])),
    [visiblePickPortfolios]
  );
  const overallAssetRankById = React.useMemo(
    () =>
      new Map(
        [...allAssets]
          .sort(
            (a, b) =>
              getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
          )
          .map((asset, index) => [asset.player_id, index + 1])
      ),
    [allAssets, mode]
  );
  const selectedManagerNames = React.useMemo(
    () => new Set([managerA, managerB]),
    [managerA, managerB]
  );
  const valueMatchIdeas = React.useMemo(
    () => [
      ...buildTradeWarValueMatchIdeas({
        targetManager: managerA,
        sourceManager: managerB,
        targetAssets: sideAAssets,
        sourceAssets: assetsByManager.get(managerB) || [],
        selectedAllIds,
        mode,
      }),
      ...buildTradeWarValueMatchIdeas({
        targetManager: managerB,
        sourceManager: managerA,
        targetAssets: sideBAssets,
        sourceAssets: assetsByManager.get(managerA) || [],
        selectedAllIds,
        mode,
      }),
    ],
    [
      assetsByManager,
      managerA,
      managerB,
      mode,
      selectedAllIds,
      sideAAssets,
      sideBAssets,
    ]
  );

  const renderNegotiationPanel = () => (
    <div className="trade-war-note-panel trade-war-negotiation-panel">
      <span>Negotiation Read</span>
      <div className="trade-war-negotiation-grid">
        {negotiationReads.map(read => (
          <div
            key={read.manager}
            className={`trade-war-negotiation-card trade-war-negotiation-${read.tone}`}
          >
            <div>
              <strong>{read.manager}</strong>
              <em>{read.label}</em>
            </div>
            <b>{read.score}%</b>
            <div className="trade-war-negotiation-chips">
              {read.chips.map(chip => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
            <p>{read.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTradeWarModeTabs = () => (
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
  );

  const renderManagerRankInventory = () => (
    <div className="trade-war-manager-board trade-war-manager-rank-inventory">
      <div className="trade-war-manager-board-head">
        <div>
          <span>Manager Rank Inventory</span>
          <strong>League roster scanner</strong>
        </div>
        {renderTradeWarModeTabs()}
      </div>
      <div className="trade-war-manager-board-grid">
        {managers.map(manager => {
          const assets = assetsByManager.get(manager) || [];
          const buckets = getTradeWarPositionBuckets(assets);
          const ranks = baselineRankMaps.get(manager);
          const powerRow = powerByManager.get(manager);
          const overviewRow = leagueOverviewByManager.get(manager);
          const pickRow = pickPortfolioByManager.get(manager);
          const standing = currentStandings?.find(row => row.manager === manager);
          const pickRank = pickRankByManager.get(manager);
          const isOpen = openInventoryManagers.has(manager);
          const totalValue = assets.reduce(
            (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
            0
          );
          const pickValue = buckets.PICK.reduce(
            (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
            0
          );
          const sectionRows = [
            ["QB", buckets.QB],
            ["RB", buckets.RB],
            ["WR", buckets.WR],
            ["TE", buckets.TE],
            ["PICKS", buckets.PICK],
          ] as const;
          return (
            <details
              key={manager}
              open={isOpen}
              onToggle={event => {
                const nextOpen = event.currentTarget.open;
                setOpenInventoryManagers(current => {
                  const next = new Set(current);
                  if (nextOpen) {
                    next.add(manager);
                  } else {
                    next.delete(manager);
                  }
                  return next;
                });
              }}
              className={`trade-war-manager-board-card ${selectedManagerNames.has(manager) ? "trade-war-manager-board-selected" : ""}`}
            >
              <summary>
                <span className="trade-war-manager-board-rank">
                  {powerRow ? `#${powerRow.rank}` : "-"}
                </span>
                <span className="trade-war-manager-board-lockup">
                  <ChampionAvatarFrame
                    managerName={manager}
                    className="trade-war-owner-avatar"
                  >
                    {managerAvatars?.[manager] ? (
                      <img src={managerAvatars[manager] || ""} alt={manager} />
                    ) : (
                      <span>{manager.trim()[0]?.toUpperCase() || "?"}</span>
                    )}
                  </ChampionAvatarFrame>
                  <span>
                    <strong>{manager}</strong>
                    <em>
                      {powerRow?.tier || "Manager"} · {formatCompactValue(totalValue)}
                    </em>
                  </span>
                </span>
                <span className="trade-war-manager-board-bars" aria-label={`${manager} position ranks`}>
                  {(["QB", "RB", "WR", "TE", "PICK"] as const).map(key => (
                    <i key={key} className={`trade-war-bar-${key.toLowerCase()}`}>
                      <small>{key === "PICK" ? "Picks" : key}</small>
                      #{key === "PICK" ? pickRank || "-" : ranks?.[key] || "-"}
                    </i>
                  ))}
                </span>
              </summary>
              <div className="trade-war-manager-board-meta">
                <span>Power {powerRow?.score ?? "-"}</span>
                <span>Value #{overviewRow?.rank_value ?? "-"}</span>
                <span>
                  Record{" "}
                  {standing
                    ? `${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ""}`
                    : "-"}
                </span>
                {leagueValueMode === "dynasty" && (
                  <span>Picks {formatCompactValue(pickValue || pickRow?.totalValue || 0)}</span>
                )}
              </div>
              <div className="trade-war-manager-lens-ranks">
                <span>
                  <em>Dynasty</em>
                  <strong>#{ranks?.Value || "-"}</strong>
                </span>
                <span>
                  <em>Contender</em>
                  <strong>#{ranks?.Contender || "-"}</strong>
                </span>
                <span>
                  <em>Rebuilder</em>
                  <strong>#{ranks?.Rebuild || "-"}</strong>
                </span>
              </div>
              {isOpen && (
                <div className="trade-war-manager-board-sections">
                  {sectionRows.map(([label, rows]) => {
                    const sectionClass = getTradeWarSectionClass(label);

                    return (
                      <div
                        key={label}
                        className={`trade-war-manager-board-section trade-war-manager-board-section-${sectionClass}`}
                      >
                        <div className="trade-war-manager-board-section-head">
                          <strong>
                            {label === "PICKS" ? "Picks" : `${label} Rank`}
                          </strong>
                          <span>
                            {getTradeWarSectionRankLabel({
                              label,
                              ranks,
                              pickRank,
                            })}
                          </span>
                        </div>
                        <div className="trade-war-manager-board-rank-head">
                          <span>Asset</span>
                          <span>Ovr</span>
                          <span>{label === "PICKS" ? "Rnd" : "Pos"}</span>
                        </div>
                        {rows.length ? (
                          rows
                            .sort(
                              (a, b) =>
                                getTradeWarAssetValue(b, mode) -
                                getTradeWarAssetValue(a, mode)
                            )
                            .map(asset => {
                              const assetRank = getTradeWarAssetRank(asset, mode);
                              const positionRank = getTradeWarRankNumber(assetRank);
                              const overallRank = overallAssetRankById.get(
                                asset.player_id
                              );
                              const rankTone = isTradeWarPickAsset(asset)
                                ? "pick"
                                : getTradeWarRankTone(assetRank);

                              return (
                                <button
                                  key={asset.player_id}
                                  type="button"
                                  className={`trade-war-manager-board-asset trade-war-manager-board-asset-${sectionClass}`}
                                  onClick={() => openAssetModal(asset)}
                                >
                                  <div className="trade-war-manager-board-player">
                                    <TradeWarAssetLabel asset={asset} />
                                  </div>
                                  <span
                                    className="trade-war-manager-board-overall-rank"
                                    title="Overall asset rank"
                                  >
                                    {overallRank || "-"}
                                  </span>
                                  <span
                                    className={`trade-war-manager-board-position-rank trade-war-manager-board-position-rank-${rankTone}`}
                                    title={
                                      isTradeWarPickAsset(asset)
                                        ? "Pick round"
                                        : "Position rank"
                                    }
                                  >
                                    {isTradeWarPickAsset(asset)
                                      ? `R${asset.pickRound || "-"}`
                                      : positionRank || "-"}
                                  </span>
                                </button>
                              );
                            })
                        ) : (
                          <p>No returned assets.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );

  const renderValueMatchPanel = () => (
    <div className="trade-war-note-panel trade-war-value-match-panel">
      <span>Value Match Finder</span>
      {valueMatchIdeas.length ? (
        <div className="trade-war-value-match-grid">
          {valueMatchIdeas.map(idea => (
            <div key={idea.id} className="trade-war-value-match-card">
              <div className="trade-war-value-match-head">
                <strong>{idea.sourceManager} can match</strong>
                <em>{formatCompactValue(idea.totalValue)} · gap {formatCompactValue(idea.gap)}</em>
              </div>
              <p>
                Closest return for {idea.targetManager}'s{" "}
                {formatCompactValue(idea.targetValue)} package.
              </p>
              <div className="trade-war-value-match-assets">
                {idea.assets.map(asset => (
                  <button
                    key={asset.player_id}
                    type="button"
                    className="trade-war-value-match-asset"
                    onClick={() => openAssetModal(asset)}
                  >
                    <span>{asset.name}</span>
                    <em>{getTradeWarAssetRank(asset, mode) || asset.pos}</em>
                    <strong>{formatCompactValue(getTradeWarAssetValue(asset, mode))}</strong>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="trade-war-package-apply"
                onClick={() => {
                  const ids = idea.assets.map(asset => asset.player_id);
                  if (idea.sourceManager === managerA) {
                    setSideAIds(ids);
                  } else if (idea.sourceManager === managerB) {
                    setSideBIds(ids);
                  }
                }}
              >
                Use match
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p>
          Add one player or pick to either side and this will suggest the
          closest matching player or two-piece package from the other manager.
        </p>
      )}
    </div>
  );

  const renderPackageBuilderPanel = () => (
    <div className="trade-war-note-panel trade-war-package-panel">
      <span>Package Builder</span>
      {packageIdeas.length ? (
        <div className="trade-war-package-grid">
          {packageIdeas.map(idea => (
            <div
              key={idea.id}
              className={`trade-war-package-card trade-war-package-${idea.tone}`}
            >
              <div className="trade-war-package-head">
                <strong>{idea.label}</strong>
                <em>{Math.abs(idea.gap).toLocaleString()} gap</em>
              </div>
              <p>{idea.summary}</p>
              <div className="trade-war-package-chips">
                {idea.chips.map(chip => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
              <button
                type="button"
                className="trade-war-package-apply"
                onClick={() => {
                  setSideAIds(idea.sideAIds);
                  setSideBIds(idea.sideBIds);
                  setMode(idea.mode);
                }}
              >
                Apply structure
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p>
          Add at least one player or pick to either side and the builder will
          propose add, remove, swap, and lens alternatives.
        </p>
      )}
    </div>
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
            <TradeWarAssetLabel asset={suggestion.asset} />
            <TradeWarAssetPills asset={suggestion.asset} mode={mode} />
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
    if (isTradeWarPickAsset(asset)) return;
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
                <TradeWarAssetLabel asset={asset} />
                <TradeWarAssetPills asset={asset} mode={mode} />
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
            <span>Add / Browse Assets</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isPickerOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          <div className="trade-war-picker-body">
            <label className="trade-war-search">
              <span>Add player or pick</span>
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={`Search players or picks from ${manager}, ${otherManager}, or anyone`}
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
      {renderManagerRankInventory()}

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
        {renderValueMatchPanel()}
        {renderPackageBuilderPanel()}
        <div className="trade-war-note-panel">
          <span>Roster Fit</span>
          {[...managerAFitNotes, ...managerBFitNotes].map(note => (
            <p key={note}>{note}</p>
          ))}
        </div>
        {renderNegotiationPanel()}
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
