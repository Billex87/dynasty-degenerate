import type { ReactNode } from "react";

import { PlayerPill } from "@/components/reportPrimitives";
import { getPositionRankClass } from "@/lib/positionRank";
import {
  buildManagerPositionRoomPreview,
  buildRosterStarterPreview,
  buildTaxiTriagePreview,
} from "@/lib/overviewInsights";
import { getDraftSignalPicks } from "@/lib/draftDashboardMetrics";
import {
  getLeagueModeCopy,
  getPlayerRankForMode,
  normalizeLeagueValueMode,
  type LeagueValueMode as NormalizedLeagueValueMode,
  type LeagueValueMode,
} from "@/lib/leagueValueMode";
import { isPlaceholderManagerName } from "@/lib/managerDisplay";
import { sortRowsByViewerAndStanding } from "@/lib/managerOrdering";
import { PreviewMetric } from "@/components/reportPrimitives";
import type { ReportData } from "@shared/types";
import type { OwnerIntelSortMode } from "@/features/report/components/OwnerIntelControls";

type ReportPreviewLeagueValueMode = NormalizedLeagueValueMode | string | null;

function formatPreviewNumber(value?: number | null): string | null {
  if (!value || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000000) return `${Math.round(rounded / 100000) / 10}M`;
  if (Math.abs(rounded) >= 1000) return `${Math.round(rounded / 1000)}K`;
  return rounded.toLocaleString();
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

export function buildLeagueFormatPills(
  leagueFormat: string,
  diagnostics?: ReportData["leagueDiagnostics"],
  mode?: ReportPreviewLeagueValueMode
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

  const normalizedMode = normalizeLeagueValueMode(mode || diagnostics?.valueMode);
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

export function renderPreviewManagerIdentity(
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
        {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{manager[0]?.toUpperCase() || "?"}</span>}
      </span>
      <span className="analysis-preview-manager-name">{manager}</span>
    </span>
  );
}

export function buildRosterPreviewMetrics(data: ReportData): PreviewMetric[] {
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

export function buildTaxiPreviewMetrics(data: ReportData): PreviewMetric[] {
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

export function buildOwnerIntelPreviewMetrics(
  data: ReportData,
  sortMode: OwnerIntelSortMode
): PreviewMetric[] {
  const rows = data.managerRosterIntelligence || [];
  if (!rows.length) return [];
  const growthRows = data.managerRosterValueGrowth || [];
  const powerRows = data.powerRankings || [];
  const maxGrowthValue = Math.max(0, ...growthRows.map(row => row.total_val || 0));
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

export function buildManagerPositionRoomPreviewMetrics(
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

export function buildDraftPreviewMetrics(
  data: ReportData,
  mode: NormalizedLeagueValueMode
): PreviewMetric[] {
  const picks = getDraftSignalPicks(data, mode);
  const topGain = [...picks].sort(
    (a, b) => (b.valueGain || 0) - (a.valueGain || 0)
  )[0];
  const totalSwing = picks.reduce((sum, pick) => sum + (pick.valueGain || 0), 0);
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
  leagueValueMode: NormalizedLeagueValueMode
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

export function buildMomentumPreviewMetrics(data: ReportData): PreviewMetric[] {
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

export function buildCombinedTrendingPreviewMetrics(
  data: ReportData
): PreviewMetric[] {
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

export function buildRecentTransactionPreviewMetrics(
  transactions?: ReportData["recentTransactions"],
  leagueValueMode: NormalizedLeagueValueMode = "dynasty"
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

export type TradePreviewSection = "war-room" | "leaderboard" | "theft" | "ledger";

function formatTradePreviewNumber(value?: number | null): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  if (Math.abs(numeric) >= 1000) return `${Math.round(numeric / 100) / 10}K`;
  return numeric.toLocaleString();
}

function formatTradePreviewDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

export function getReportManagerNames(
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
    (reportData.recentTransactions || []).forEach(row => addManager(row.manager));
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

export function buildTradeProposalPreviewMetrics(
  reportData: ReportData
): PreviewMetric[] {
  const signals = [
    ...(reportData.adminTradeProposalSignals || reportData.tradeProposalSignals || []),
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
      value: latestSignal ? formatTradeProposalPreviewDate(latestSignal.date) : "-",
      tone: latestSignal ? "good" : "neutral",
    },
    {
      label: "Status",
      value: latestSignal
        ? formatTradeProposalPreviewStatus(latestSignal.status)
        : "-",
      tone: latestSignal ? getTradeProposalPreviewTone(latestSignal.status) : "neutral",
    },
  ].filter(Boolean) as PreviewMetric[];
}

export function buildTradePreviewMetrics(
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
    ? formatTradePreviewNumber(Math.abs(latestTrade.point_gap || 0))
    : null;

  switch (section) {
    case "war-room":
      return [
        bestProfit
          ? {
              label: `Market Shark (${formatTradePreviewNumber(bestProfit.profit)})`,
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
              label: `Bag Holder (${formatTradePreviewNumber(worstProfit.profit)})`,
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
              value: renderPreviewManagerIdentity(auraManager, data.managerAvatars),
              tone: "good",
              className: "analysis-preview-chip-manager-preview",
            }
          : null,
        cookedManager
          ? {
              label: `Most cooked${
                biggestGap
                  ? ` (${formatTradePreviewNumber(Math.abs(biggestGap.point_gap || 0))})`
                  : ""
              }`,
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
              label: "Latest",
              value: formatTradePreviewDate(latestTrade.date),
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

export function formatTradeProposalPreviewDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatTradeProposalPreviewStatus(status?: string | null): string {
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

export function getTradeProposalPreviewTone(
  status?: string | null
): PreviewMetric["tone"] {
  if (!status) return "neutral";
  if (/declin|reject|cancel|veto|expire|fail/i.test(status)) return "danger";
  if (/pending|open|waiting|propos|active/i.test(status)) return "warn";
  if (/accept|complete/i.test(status)) return "good";
  return "info";
}
