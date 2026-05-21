import React, { useState } from "react";
import { ChevronDown, UsersRound, X as XIcon } from "lucide-react";
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
export type TradeWarMode =
  | "dynasty"
  | "contender"
  | "rebuilder"
  | "starter-upgrade"
  | "depth-fix"
  | "positional-need"
  | "playoff-push"
  | "waiver-leverage";
export type TradeWarAsset = ManagerIntelPlayer & {
  manager: string;
  assetState: "roster" | "bench" | "taxi" | "reserve" | "pick";
  assetKind?: "player" | "pick";
  pickLabel?: string;
  pickSeason?: string;
  pickRound?: number;
  originalOwner?: string;
};

const TRADE_WAR_FALLBACK_PICK_VALUES_BY_ROUND: Record<number, number> = {
  1: 4500,
  2: 1800,
  3: 600,
  4: 250,
  5: 100,
};

export function isTradeWarPickAsset(asset: TradeWarAsset): boolean {
  return asset.assetKind === "pick" || asset.assetState === "pick";
}

export function isTradeWarPlayerAsset(asset: TradeWarAsset): boolean {
  return !isTradeWarPickAsset(asset);
}

function getTradeWarPickValue(asset: TradeWarAsset): number {
  const providedValue = Math.round(asset.value || asset.seasonValue || 0);
  if (providedValue > 0) return providedValue;

  const round = Number(asset.pickRound || 0);
  return TRADE_WAR_FALLBACK_PICK_VALUES_BY_ROUND[round] || 50;
}

export function getTradeWarAssetValue(
  player: ManagerIntelPlayer,
  mode: TradeWarMode
): number {
  if (isTradeWarPickAsset(player as TradeWarAsset)) {
    return getTradeWarPickValue(player as TradeWarAsset);
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

export function getTradeWarAssetRank(
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
export function getTradeWarAssetTeam(
  player: ManagerIntelPlayer
): string | null | undefined {
  if ((player as TradeWarAsset).assetKind === "pick") return null;
  return player.playerDetails?.team;
}

export function getTradeWarModeLabel(mode: TradeWarMode): string {
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

export function buildTradeWarMetrics(
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

export function buildTradeWarRankMaps(
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

export function buildTradeWarPickRankMap(
  managers: string[],
  assetsByManager: Map<string, TradeWarAsset[]>
) {
  const ranked = managers
    .map(manager => ({
      manager,
      value: (assetsByManager.get(manager) || [])
        .filter(isTradeWarPickAsset)
        .reduce((sum, asset) => sum + getTradeWarAssetValue(asset, "dynasty"), 0),
    }))
    .sort((a, b) => b.value - a.value);

  return new Map(ranked.map((row, index) => [row.manager, index + 1]));
}

function getTradeWarMetricClass(key: TradeWarMetricKey): string {
  if (key === "Value") return "value";
  if (key === "Contender") return "contender";
  if (key === "Rebuild") return "rebuilder";
  return key.toLowerCase();
}

function getTradeWarTextPieces(text: string) {
  const parts = text.split(/\b(QB|RB|WR|TE)\b/g);
  return parts.map((part, index) => {
    const position = part.toUpperCase();
    if (["QB", "RB", "WR", "TE"].includes(position)) {
      return (
        <em
          key={`${part}-${index}`}
          className={`trade-war-position-text trade-war-position-text-${position.toLowerCase()}`}
        >
          {part}
        </em>
      );
    }
    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
}

function getTradeWarNegotiationChipClass(chip: string): string {
  const normalized = chip.toLowerCase();
  if (/\bqb\b/.test(normalized)) return "qb";
  if (/\brb\b/.test(normalized)) return "rb";
  if (/\bwr\b/.test(normalized)) return "wr";
  if (/\bte\b/.test(normalized)) return "te";
  if (/pick aggressive|blocked|slow mover/.test(normalized)) return "danger";
  if (/profit seeker|favorite partner|need filled/.test(normalized)) return "good";
  if (/veteran buyer|active dealer|open signal|buying|selling/.test(normalized))
    return "warn";
  if (/balanced/.test(normalized)) return "balanced";
  if (/surplus/.test(normalized)) return "surplus";
  return "neutral";
}

function getTradeWarRankTierStyle(rank: number): React.CSSProperties {
  const clamped = Math.max(1, Math.min(10, rank || 10));
  const ratio = (clamped - 1) / 9;
  const hue = 142 - ratio * 142;
  return {
    color: `hsl(${hue} 88% 76%)`,
  };
}

function buildTradeWarRankChanges(
  before: TradeWarRosterSnapshot,
  after: TradeWarRosterSnapshot,
  leagueValueMode: ReportData["leagueValueMode"]
) {
  const keys: Array<{ key: TradeWarMetricKey; label: string }> = [
    { key: "QB", label: "QB" },
    { key: "RB", label: "RB" },
    { key: "WR", label: "WR" },
    { key: "TE", label: "TE" },
    { key: "Value", label: "Value" },
    { key: "Power", label: "Power" },
  ];

  if (leagueValueMode === "dynasty") {
    keys.push(
      { key: "Contender", label: "Contender" },
      { key: "Rebuild", label: "Rebuilder" }
    );
  }

  return keys
    .filter(({ key }) => before.ranks[key] !== after.ranks[key])
    .map(({ key, label }) => ({
      key,
      label,
      beforeRank: before.ranks[key],
      afterRank: after.ranks[key],
      metricDelta: after.metrics[key] - before.metrics[key],
    }));
}

function buildTradeWarBeforeAfterSummary({
  before,
  after,
  incoming,
  outgoing,
  mode,
  leagueValueMode,
}: {
  before: TradeWarRosterSnapshot;
  after: TradeWarRosterSnapshot;
  incoming: TradeWarAsset[];
  outgoing: TradeWarAsset[];
  mode: TradeWarMode;
  leagueValueMode: ReportData["leagueValueMode"];
}) {
  const incomingValue = incoming.reduce(
    (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
    0
  );
  const outgoingValue = outgoing.reduce(
    (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
    0
  );
  const netValue = incomingValue - outgoingValue;
  const primaryMove = buildTradeWarRankChanges(before, after, leagueValueMode)
    .filter(change => ["QB", "RB", "WR", "TE"].includes(change.key))
    .sort((a, b) => Math.abs(b.metricDelta) - Math.abs(a.metricDelta))[0];

  if (!primaryMove) {
    return { netValue, primaryMove: null };
  }

  const direction =
    primaryMove.afterRank < primaryMove.beforeRank ? "improves" : "falls";
  return {
    netValue,
    primaryMove: {
      ...primaryMove,
      direction,
    },
  };
}

export function getTradeWarSearchResults({
  query,
  sideManager,
  otherManager,
  allAssets,
  selectedAllIds,
  mode,
}: {
  query: string;
  sideManager: string;
  otherManager: string;
  allAssets: TradeWarAsset[];
  selectedAllIds: Set<string>;
  mode: TradeWarMode;
}) {
  const normalized = query.trim().toLowerCase();
  return allAssets
    .filter(asset => !selectedAllIds.has(asset.player_id))
    .filter(asset => {
      if (normalized) return asset.manager !== otherManager;
      if (sideManager) return asset.manager === sideManager;
      if (otherManager) return asset.manager !== otherManager;
      return true;
    })
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
      return getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode);
    })
    .slice(0, normalized ? 8 : 6);
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

type TradeWarSweetenerSuggestion = {
  label: string;
  summary: string;
  asset: TradeWarAsset;
};

function buildTradeWarSweetenerSuggestions({
  manager,
  row,
  selectedIds,
  selectedAllIds,
  allAssets,
  gap,
  mode,
  limit = 3,
}: {
  manager: string;
  row?: OwnerIntelRow;
  selectedIds: string[];
  selectedAllIds: Set<string>;
  allAssets: TradeWarAsset[];
  gap: number;
  mode: TradeWarMode;
  limit?: number;
}): TradeWarSweetenerSuggestion[] {
  const absGap = Math.abs(gap);
  if (absGap <= 250) return [];
  const surplus = row?.tradePlan?.surplusPosition;
  const maxUsefulValue = Math.max(absGap * 1.65, absGap + 1200);
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
      return true;
    })
    .map(asset => ({ asset, value: getTradeWarAssetValue(asset, mode) }))
    .filter(({ value }) => value > 0 && value <= maxUsefulValue)
    .sort((a, b) => {
      const distanceA = Math.abs(absGap - a.value);
      const distanceB = Math.abs(absGap - b.value);
      if (distanceA !== distanceB) return distanceA - distanceB;
      if (surplus) {
        const surplusDelta =
          Number(b.asset.pos === surplus) - Number(a.asset.pos === surplus);
        if (surplusDelta) return surplusDelta;
      }
      if (isTradeWarPickAsset(a.asset) !== isTradeWarPickAsset(b.asset)) {
        return isTradeWarPickAsset(a.asset) ? -1 : 1;
      }
      return b.value - a.value;
    });

  return candidates.slice(0, limit).map(({ asset }) => {
    const isPick = isTradeWarPickAsset(asset);
    return {
      label: isPick ? `${manager} pick sweetener` : `${manager} add-on`,
      summary: isPick
        ? `${manager} can close the gap by adding ${asset.name}; this preserves the player core while paying with dynasty draft capital.`
        : `${manager} can close the gap by floating ${asset.name} from the ${asset.pos} room.`,
      asset,
    };
  });
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

  const candidatesByManager = new Map<string, TradeWarAsset[]>();
  sourceAssets
    .filter(asset => !selectedAllIds.has(asset.player_id))
    .filter(asset => getTradeWarAssetValue(asset, mode) > 0)
    .forEach(asset => {
      const manager = asset.manager || sourceManager;
      const current = candidatesByManager.get(manager) || [];
      current.push(asset);
      candidatesByManager.set(manager, current);
    });

  const ideas: TradeWarValueMatchIdea[] = [];
  candidatesByManager.forEach((sourceManagerAssets, manager) => {
    const candidates = sourceManagerAssets.sort(
      (a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
    );

    candidates.forEach(asset => {
      const totalValue = getTradeWarAssetValue(asset, mode);
      ideas.push({
        id: `${manager}:${asset.player_id}`,
        label: `${asset.name}`,
        targetManager,
        sourceManager: manager,
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
          id: `${manager}:${first.player_id}:${second.player_id}`,
          label: `${first.name} + ${second.name}`,
          targetManager,
          sourceManager: manager,
          targetValue,
          totalValue,
          gap: Math.abs(targetValue - totalValue),
          assets: [first, second],
        });
      }
    }
  });

  return ideas
    .sort((a, b) => {
      if (a.gap !== b.gap) return a.gap - b.gap;
      if (a.assets.length !== b.assets.length) return a.assets.length - b.assets.length;
      return b.totalValue - a.totalValue;
    })
    .slice(0, 4);
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
  addOnSuggestion: TradeWarSweetenerSuggestion | null;
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
        `${getTradeWarModeLabel(ideaMode)} values`,
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
        "Keep this package and judge it through trade math, negotiation score, and the selected value view.",
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
      chips: ["Add-on"],
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
    const bestLensLabel = getTradeWarModeLabel(bestLens.option);
    const windowCopy =
      bestLens.option === "contender"
        ? "both managers are trying to win now"
        : bestLens.option === "rebuilder"
          ? "both managers are building for later"
          : "both managers are judging long-term value";
    makeIdea({
      id: `lens-${bestLens.option}`,
      label: `${bestLensLabel} Values`,
      summary: `Use this if ${windowCopy}.`,
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

export function buildTradeWarModalData({
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
    valueChangeNote: `${getTradeWarModeLabel(mode)} trade value.`,
  });
}

export function TradeWarAssetLabel({ asset }: { asset: TradeWarAsset }) {
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

function getTradeWarAssetDisplayName(asset: TradeWarAsset): string {
  return isTradeWarPickAsset(asset)
    ? asset.pickLabel || asset.name
    : asset.name;
}

export function TradeWarManagerAvatar({
  manager,
  managerAvatars,
  className = "trade-war-owner-avatar",
  showAccolades = false,
}: {
  manager: string;
  managerAvatars?: ManagerAvatars;
  className?: string;
  showAccolades?: boolean;
}) {
  return (
    <ChampionAvatarFrame
      managerName={manager}
      className={className}
      showAccolades={showAccolades}
    >
      {managerAvatars?.[manager] ? (
        <img src={managerAvatars[manager] || ""} alt={manager} />
      ) : (
        <span>{manager.trim()[0]?.toUpperCase() || "?"}</span>
      )}
    </ChampionAvatarFrame>
  );
}

function TradeWarAssetPills({
  asset,
  mode,
  managerAvatars,
  showManagerAvatar = false,
}: {
  asset: TradeWarAsset;
  mode: TradeWarMode;
  managerAvatars?: ManagerAvatars;
  showManagerAvatar?: boolean;
}) {
  const value = getTradeWarAssetValue(asset, mode);
  if (isTradeWarPickAsset(asset)) {
    return (
      <span className="trade-war-player-pills">
        <PositionRankPill rank={getTradeWarAssetRank(asset, mode) || "Pick"} />
        <span>{formatCompactValue(value)}</span>
        {showManagerAvatar && (
          <TradeWarManagerAvatar
            manager={asset.manager}
            managerAvatars={managerAvatars}
            className="trade-war-owner-avatar trade-war-meta-owner-avatar"
          />
        )}
      </span>
    );
  }

  return (
    <span className="trade-war-player-pills">
      <TeamLogoPill team={getTradeWarAssetTeam(asset)} />
      <PositionRankPill rank={getTradeWarAssetRank(asset, mode) || asset.pos} />
      <span>{formatCompactValue(value)}</span>
      {showManagerAvatar && (
        <TradeWarManagerAvatar
          manager={asset.manager}
          managerAvatars={managerAvatars}
          className="trade-war-owner-avatar trade-war-meta-owner-avatar"
        />
      )}
    </span>
  );
}

function TradeWarPlayerCard({
  asset,
  mode,
  isHighlighted,
  isSuggestedAdd,
  isDifferentManager,
  managerAvatars,
  onAdd,
}: {
  asset: TradeWarAsset;
  mode: TradeWarMode;
  isHighlighted: boolean;
  isSuggestedAdd: boolean;
  isDifferentManager: boolean;
  managerAvatars?: ManagerAvatars;
  onAdd: () => void;
}) {
  const team = getTradeWarAssetTeam(asset);
  const assetLabel = getTradeWarAssetDisplayName(asset);
  return (
    <div
      className={`player-team-tile trade-war-player-card ${isHighlighted ? "" : "trade-war-player-muted"} ${isSuggestedAdd ? "trade-war-player-card-suggested" : ""}`}
      style={getTeamTileStyle(team)}
    >
      {isSuggestedAdd && (
        <span className="trade-war-suggested-add-overlay">
          {isTradeWarPickAsset(asset) ? "Match" : "Balance"}
        </span>
      )}
      {isDifferentManager && (
        <span className="trade-war-other-manager-banner">
          <span>Other Roster</span>
        </span>
      )}
      <button
        type="button"
        className="trade-war-player-add"
        onClick={onAdd}
        title={`Add ${assetLabel} from ${asset.manager}`}
        aria-label={`Add ${assetLabel} from ${asset.manager}`}
      >
        <span className="trade-war-player-name" title={assetLabel}>
          <TradeWarAssetLabel asset={asset} />
        </span>
        <TradeWarAssetPills
          asset={asset}
          mode={mode}
          managerAvatars={managerAvatars}
          showManagerAvatar
        />
      </button>
    </div>
  );
}

export function getTradeWarPositionBuckets(assets: TradeWarAsset[]) {
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

export function getTradeWarRankNumber(rank?: string | null): number | null {
  const match = String(rank || "").match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export function getTradeWarRankTone(rank?: string | null): string {
  const value = getTradeWarRankNumber(rank);
  if (!value) return "empty";
  if (value <= 10) return "top";
  if (value <= 24) return "watch";
  return "deep";
}

export function getTradeWarSectionClass(label: "QB" | "RB" | "WR" | "TE" | "PICKS") {
  return label === "PICKS" ? "pick" : label.toLowerCase();
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
  onScoutLeaguemates,
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
  onScoutLeaguemates?: () => void;
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
  const inferredManagerA = sideAAssets[0]?.manager || "";
  const inferredManagerB = sideBAssets[0]?.manager || "";
  const managerA = inferredManagerA || managerAState;
  const managerB = inferredManagerB || managerBState;
  const managerALabel = managerA || "League wide";
  const managerBLabel = managerB || "League wide";
  const hasSelectedTradeAssets =
    sideAAssets.length > 0 || sideBAssets.length > 0;
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
  const managerARow = managerA ? managerRows.get(managerA) : undefined;
  const managerBRow = managerB ? managerRows.get(managerB) : undefined;
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

    if (managerA) applySwap(managerA, sideAIds, sideBAssets);
    if (managerB) applySwap(managerB, sideBIds, sideAAssets);
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

  const addOnManager = valueGap > 0 ? managerA : managerB;
  const addOnSide: "A" | "B" = valueGap > 0 ? "A" : "B";
  const addOnSuggestions = addOnManager
    ? buildTradeWarSweetenerSuggestions({
        manager: addOnManager,
        row: valueGap > 0 ? managerARow : managerBRow,
        selectedIds: valueGap > 0 ? sideAIds : sideBIds,
        selectedAllIds,
        allAssets,
        gap: valueGap,
        mode,
      })
    : [];
  const addOnSuggestion = addOnSuggestions[0] || null;
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
        managerA: managerA || "Side A",
        managerB: managerB || "Side B",
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
    () =>
      managerA && managerB
        ? [
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
          ]
        : [],
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

  const sideAValueMatchIdeas = React.useMemo(
    () =>
      buildTradeWarValueMatchIdeas({
        targetManager: managerA || "Side A",
        sourceManager: managerB || "League wide",
        targetAssets: sideAAssets,
        sourceAssets: managerB
          ? assetsByManager.get(managerB) || []
          : allAssets.filter(asset => !managerA || asset.manager !== managerA),
        selectedAllIds,
        mode,
      }).slice(0, 4),
    [
      allAssets,
      assetsByManager,
      managerA,
      managerB,
      mode,
      selectedAllIds,
      sideAAssets,
    ]
  );
  const sideBValueMatchIdeas = React.useMemo(
    () =>
      buildTradeWarValueMatchIdeas({
        targetManager: managerB || "Side B",
        sourceManager: managerA || "League wide",
        targetAssets: sideBAssets,
        sourceAssets: managerA
          ? assetsByManager.get(managerA) || []
          : allAssets.filter(asset => !managerB || asset.manager !== managerB),
        selectedAllIds,
        mode,
      }).slice(0, 4),
    [
      allAssets,
      assetsByManager,
      managerA,
      managerB,
      mode,
      selectedAllIds,
      sideBAssets,
    ]
  );

  const renderNegotiationPanel = () => {
    if (!negotiationReads.length) return null;

    return (
      <div className="trade-war-note-panel trade-war-negotiation-panel">
        <span>Negotiation Read</span>
        <div className="trade-war-negotiation-grid">
          {negotiationReads.map(read => (
            <div
              key={read.manager}
              className={`trade-war-negotiation-card trade-war-negotiation-${read.tone}`}
            >
              <div className="trade-war-negotiation-manager">
                <TradeWarManagerAvatar
                  manager={read.manager}
                  managerAvatars={managerAvatars}
                  className="trade-war-owner-avatar trade-war-negotiation-avatar"
                />
                <span>
                  <strong>{read.manager}</strong>
                  <em>{read.label}</em>
                </span>
              </div>
              <b>{read.score}%</b>
              <div className="trade-war-negotiation-chips">
                {read.chips.map(chip => (
                  <span
                    key={chip}
                    className={`trade-war-negotiation-chip-${getTradeWarNegotiationChipClass(chip)}`}
                  >
                    {getTradeWarTextPieces(chip)}
                  </span>
                ))}
              </div>
              <p>{getTradeWarTextPieces(read.summary)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTradeWarModeTabs = () => (
    <div
      className="trade-war-mode-tabs"
      role="tablist"
      aria-label="Trade value view"
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

  const getAssetManagerForIds = (ids: string[]) =>
    ids
      .map(id => assetById.get(id)?.manager)
      .find((manager): manager is string => Boolean(manager)) || "";

  const setSideAssetPackage = (
    sideKey: "A" | "B",
    ids: string[],
    manager = ""
  ) => {
    const nextIds = ids.filter(id => assetById.has(id));
    const nextManager = manager || getAssetManagerForIds(nextIds);

    if (sideKey === "A") {
      setSideAIds(nextIds);
      setManagerAState(nextManager);
      setQueryA("");
      return;
    }

    setSideBIds(nextIds);
    setManagerBState(nextManager);
    setQueryB("");
  };

  const addAssetToSide = (sideKey: "A" | "B", asset: TradeWarAsset) => {
    if (sideKey === "A") {
      if (managerB && managerB === asset.manager) return;
      if (managerA && managerA !== asset.manager) {
        setSideAIds([asset.player_id]);
        setManagerAState(asset.manager);
        setQueryA("");
        return;
      }
      setSideAIds(current =>
        current.includes(asset.player_id) ? current : [...current, asset.player_id]
      );
      setManagerAState(asset.manager);
      setQueryA("");
      return;
    }

    if (managerA && managerA === asset.manager) return;
    if (managerB && managerB !== asset.manager) {
      setSideBIds([asset.player_id]);
      setManagerBState(asset.manager);
      setQueryB("");
      return;
    }
    setSideBIds(current =>
      current.includes(asset.player_id) ? current : [...current, asset.player_id]
    );
    setManagerBState(asset.manager);
    setQueryB("");
  };

  const removeAssetFromSide = (sideKey: "A" | "B", playerId: string) => {
    if (sideKey === "A") {
      const nextIds = sideAIds.filter(id => id !== playerId);
      setSideAIds(nextIds);
      if (!nextIds.length) setManagerAState("");
      return;
    }

    const nextIds = sideBIds.filter(id => id !== playerId);
    setSideBIds(nextIds);
    if (!nextIds.length) setManagerBState("");
  };

  const applyTradeStructure = (idea: TradeWarPackageIdea) => {
    setSideAssetPackage("A", idea.sideAIds);
    setSideAssetPackage("B", idea.sideBIds);
    setMode(idea.mode);
  };

  const renderValueMatchRow = ({
    ideas,
    matchSide,
  }: {
    ideas: TradeWarValueMatchIdea[];
    matchSide: "A" | "B";
  }) => {
    if (!ideas.length) return null;

    return (
      <div className="trade-war-value-match-row">
        <div className="trade-war-value-match-grid">
          {ideas.map(idea => (
            <div key={idea.id} className="trade-war-value-match-card">
              <div className="trade-war-value-match-head">
                <strong>{idea.sourceManager} can match</strong>
                <em>{formatCompactValue(idea.totalValue)} · gap {formatCompactValue(idea.gap)}</em>
              </div>
              <div className="trade-war-value-match-body">
                <div className="trade-war-value-match-assets">
                  {idea.assets.map(asset => (
                    <button
                      key={asset.player_id}
                      type="button"
                      className="player-team-tile trade-war-value-match-asset"
                      style={getTeamTileStyle(getTradeWarAssetTeam(asset))}
                      onClick={() => openAssetModal(asset)}
                    >
                      <span className="trade-war-value-match-name trade-war-player-name">
                        <TradeWarAssetLabel asset={asset} />
                      </span>
                      <TradeWarAssetPills
                        asset={asset}
                        mode={mode}
                        managerAvatars={managerAvatars}
                        showManagerAvatar
                      />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="trade-war-package-apply trade-war-value-match-use"
                  onClick={() => {
                    const ids = idea.assets.map(asset => asset.player_id);
                    setSideAssetPackage(matchSide, ids, idea.sourceManager);
                  }}
                >
                  Use This
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderValueMatchPanel = () => {
    const hasIdeas = sideAValueMatchIdeas.length || sideBValueMatchIdeas.length;

    return (
      <div className="trade-war-note-panel trade-war-value-match-panel">
        <span>Value Match Finder</span>
        {hasIdeas ? (
          <>
            {renderValueMatchRow({
              ideas: sideAValueMatchIdeas,
              matchSide: "B",
            })}
            {renderValueMatchRow({
              ideas: sideBValueMatchIdeas,
              matchSide: "A",
            })}
          </>
        ) : (
          <p>
            Add one player or pick to either side and this will suggest the
            closest matching player or two-piece package from the league.
          </p>
        )}
      </div>
    );
  };

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
              <button
                type="button"
                className="trade-war-package-apply"
                title="Replace the selected assets with this suggested structure"
                onClick={() => applyTradeStructure(idea)}
              >
                Apply This
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p>
          Add at least one player or pick to either side and the builder will
          propose add, remove, swap, and value-view alternatives.
        </p>
      )}
    </div>
  );

  const renderRankPanel = (
    manager: string,
    before: TradeWarRosterSnapshot,
    after: TradeWarRosterSnapshot,
    incoming: TradeWarAsset[],
    outgoing: TradeWarAsset[]
  ) => {
    const rankChanges = buildTradeWarRankChanges(before, after, leagueValueMode);
    const summary = buildTradeWarBeforeAfterSummary({
      before,
      after,
      incoming,
      outgoing,
      mode,
      leagueValueMode,
    });

    return (
      <div className="trade-war-note-panel trade-war-before-after-panel">
        <div className="trade-war-before-after-title">
          <div className="trade-war-before-after-topline">
            <em className="trade-war-before-after-eyebrow">Before / After</em>
            <span className="trade-war-before-after-summary">
              <strong>{manager}</strong>{" "}
              {summary.netValue > 0 ? (
                <>
                  <span>adds</span>{" "}
                  <b className="trade-war-read-value">
                    {formatCompactValue(summary.netValue)}.
                  </b>
                </>
              ) : summary.netValue < 0 ? (
                <>
                  <span>sends out</span>{" "}
                  <b className="trade-war-read-value">
                    {formatCompactValue(Math.abs(summary.netValue))}.
                  </b>
                </>
              ) : (
                <span>keeps value even.</span>
              )}
            </span>
          </div>
          <div className="trade-war-before-after-heading-row">
            <TradeWarManagerAvatar
              manager={manager}
              managerAvatars={managerAvatars}
              className="trade-war-owner-avatar trade-war-before-after-avatar"
            />
            <div className="trade-war-before-after-manager-stack">
              <strong>{manager}</strong>
              <div className="trade-war-rank-pills">
                {rankChanges.length ? (
                  rankChanges.map(change => {
                    const metricClass = getTradeWarMetricClass(change.key);
                    return (
                      <span
                        key={change.key}
                        className={`trade-war-rank-shift-pill trade-war-rank-shift-pill-${metricClass}`}
                      >
                        <em>{change.label}</em>
                        <strong style={getTradeWarRankTierStyle(change.beforeRank)}>
                          #{change.beforeRank}
                        </strong>
                        <i aria-hidden="true">-&gt;</i>
                        <strong style={getTradeWarRankTierStyle(change.afterRank)}>
                          #{change.afterRank}
                        </strong>
                      </span>
                    );
                  })
                ) : (
                  <span>No rank movement</span>
                )}
              </div>
            </div>
          </div>
        </div>
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
    removeAsset: (playerId: string) => void
  ) => {
    if (!assets.length) {
      return null;
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
                <TradeWarAssetPills
                  asset={asset}
                  mode={mode}
                  managerAvatars={managerAvatars}
                  showManagerAvatar
                />
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
    total,
  }: {
    label: string;
    sideKey: "A" | "B";
    manager: string;
    otherManager: string;
    query: string;
    setQuery: (value: string) => void;
    assets: TradeWarAsset[];
    total: number;
  }) => {
    const managerLabel = manager || "League wide";
    const hasSearchQuery = Boolean(query.trim());
    const baseResults = getTradeWarSearchResults({
      query,
      sideManager: manager,
      otherManager,
      allAssets,
      selectedAllIds,
      mode,
    });
    const suggestedAddAssets =
      sideKey === addOnSide && !hasSearchQuery
        ? addOnSuggestions
            .map(suggestion => suggestion.asset)
            .filter(asset => !selectedAllIds.has(asset.player_id))
            .filter(asset => !manager || asset.manager === manager)
        : [];
    const suggestedAddIds = new Set(
      sideKey === addOnSide
        ? addOnSuggestions.map(suggestion => suggestion.asset.player_id)
        : []
    );
    const results = [
      ...suggestedAddAssets,
      ...baseResults.filter(asset => !suggestedAddIds.has(asset.player_id)),
    ].slice(0, hasSearchQuery ? baseResults.length : 6);
    const highlightedManagers = new Set([
      manager,
      ...assets.map(asset => asset.manager),
    ].filter(Boolean));
    const isPickerOpen = mobilePickerOpen[sideKey];

    return (
      <div
        className={`trade-war-side ${assets.length ? "trade-war-side-loaded" : ""}`}
        data-side={sideKey}
      >
        <div className="trade-war-side-header">
          <div className="trade-war-manager-lockup">
            {manager ? (
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
            ) : (
              <span className="trade-war-manager-avatar trade-war-league-avatar">
                LW
              </span>
            )}
            <div>
              <span>{label}</span>
              <strong>{managerLabel}</strong>
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
          playerId => removeAssetFromSide(sideKey, playerId)
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
                placeholder="Search league-wide players or picks"
              />
            </label>

            <div
              className="trade-war-player-grid balanced-tile-grid"
              style={getBalancedGridStyle(results.length, 2)}
            >
              {results.map(asset => (
                <TradeWarPlayerCard
                  key={asset.player_id}
                  asset={asset}
                  mode={mode}
                  managerAvatars={managerAvatars}
                  isHighlighted={
                    !manager || hasSearchQuery || highlightedManagers.has(asset.manager)
                  }
                  isSuggestedAdd={suggestedAddIds.has(asset.player_id)}
                  isDifferentManager={
                    Boolean(manager && hasSearchQuery && asset.manager !== manager)
                  }
                  onAdd={() => addAssetToSide(sideKey, asset)}
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
      <div className="trade-war-room-toolbar">
        {renderTradeWarModeTabs()}
        {onScoutLeaguemates && (
          <button
            type="button"
            className="trade-war-scout-button"
            onClick={onScoutLeaguemates}
          >
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            <span>Scout Leaguemates</span>
          </button>
        )}
      </div>

      {!hasSelectedTradeAssets && (
        <>
          <div className="trade-war-manager-selects">
            <label>
              <span>Side A</span>
              <select
                value={managerA}
                onChange={event => {
                  const nextManager = event.target.value;
                  setManagerAState(nextManager);
                  setSideAIds(current =>
                    nextManager
                      ? current.filter(
                          id => assetById.get(id)?.manager === nextManager
                        )
                      : []
                  );
                  if (nextManager === managerB) {
                    setManagerBState("");
                    setSideBIds([]);
                  }
                }}
              >
                <option value="">League wide</option>
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
                  setSideBIds(current =>
                    nextManager
                      ? current.filter(
                          id => assetById.get(id)?.manager === nextManager
                        )
                      : []
                  );
                  if (nextManager === managerA) {
                    setManagerAState("");
                    setSideAIds([]);
                  }
                }}
              >
                <option value="">League wide</option>
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
              <span>{managerALabel} sends</span>
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
                    ? `${managerALabel} receives more`
                    : `${managerBLabel} receives more`}
              </small>
            </div>
            <div
              className="trade-war-score-card"
              key={`score-b-${mode}-${sideBTotal}`}
            >
              <span>{managerBLabel} sends</span>
              <strong>{sideBTotal.toLocaleString()}</strong>
            </div>
          </div>
        </>
      )}

      <div className="trade-war-side-grid">
        {renderTradeSide({
          label: "Side A",
          sideKey: "A",
          manager: managerA,
          otherManager: managerB,
          query: queryA,
          setQuery: setQueryA,
          assets: sideAAssets,
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
          total: sideBTotal,
        })}
      </div>

      <div className="trade-war-read-grid">
        {managerA
          ? renderRankPanel(managerA, beforeA, afterA, sideBAssets, sideAAssets)
          : null}
        {managerB
          ? renderRankPanel(managerB, beforeB, afterB, sideAAssets, sideBAssets)
          : null}
        {renderValueMatchPanel()}
        {renderPackageBuilderPanel()}
        {renderNegotiationPanel()}
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
