import {
  getBestDraftAdpValueManager,
  getBestDraftSignalManager,
  getWorstDraftAdpValueManager,
} from "@/lib/draftDashboardMetrics";
import type { LeagueValueMode } from "@/lib/leagueValueMode";
import { isPlaceholderManagerName } from "@/lib/managerDisplay";
import {
  formatDashboardSignedPercentLabel,
  getReportDashboardManagers,
} from "@/features/report/lib/reportDashboardUtils";
import {
  type DashboardHeroMetric,
  type DashboardMetricBar,
  type DashboardMetricTone,
  type DashboardSpotlightBlock,
} from "@/features/report/components/ReportDashboardMetrics";
import { ReportOverviewHero as ReportOverviewHeroSection } from "@/features/report/components/ReportOverviewHero";
import {
  type DashboardSpotlightConfig,
  ReportDashboardSpotlight as ReportDashboardSpotlightPanel,
} from "@/features/report/components/ReportDashboardSpotlight";
import type { ReportData } from "@shared/types";

const REPORT_DASHBOARD_TAB_VALUES = [
  "overview",
  "autopilot",
  "momentum",
  "rankings",
  "trades",
  "draft",
  "hacks",
] as const;

function normalizeDashboardTab(value?: string | null): string | null {
  const normalized = String(value || "")
    .replace(/^#/, "")
    .replace(/^tab=/, "")
    .trim()
    .toLowerCase();
  const aliases: Record<string, (typeof REPORT_DASHBOARD_TAB_VALUES)[number]> = {
    pulse: "momentum",
    rank: "rankings",
    trade: "trades",
    drafts: "draft",
    hack: "hacks",
    admin: "hacks",
  };
  const canonical = aliases[normalized] || normalized;
  return REPORT_DASHBOARD_TAB_VALUES.includes(
    canonical as (typeof REPORT_DASHBOARD_TAB_VALUES)[number]
  )
    ? canonical
    : null;
}

function getDashboardNumber(
  row: unknown,
  keys: string[]
): number | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function formatDashboardCompactNumber(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000000)
    return `${Math.round(rounded / 100000) / 10}M`;
  if (Math.abs(rounded) >= 1000) return `${Math.round(rounded / 1000)}K`;
  return rounded.toLocaleString();
}

function formatDashboardPreviewCount(value?: number | null): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const absolute = Math.abs(numeric);
  if (absolute >= 1000000) return `${Math.round(numeric / 100000) / 10}M`;
  if (absolute >= 1000) return `${Math.round(numeric / 100) / 10}K`;
  return Math.round(numeric).toLocaleString();
}

function getDashboardManagerAvatar(
  manager: string,
  avatars?: Record<string, string | null | undefined>
) {
  return avatars?.[manager] || null;
}

function renderDashboardHelperStack(primary: string, secondary: string) {
  return (
    <span className="dashboard-helper-stack">
      <b>{primary}</b>
      <span>{secondary}</span>
    </span>
  );
}

function getDashboardPlayerPosition(player: unknown): string {
  if (!player || typeof player !== "object") return "FLEX";
  const record = player as Record<string, unknown>;
  const position = record.pos || record.position;
  return typeof position === "string" && position.trim()
    ? position.toUpperCase()
    : "FLEX";
}

function getDashboardPlayerId(player: unknown): string | null {
  if (!player || typeof player !== "object") return null;
  const record = player as Record<string, unknown>;
  const id = record.player_id || record.playerId || record.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function getDashboardStarterRank(
  player: unknown,
  currentPositionRankById?: Record<string, string | null | undefined>
): string {
  if (!player || typeof player !== "object") return "-";
  const record = player as Record<string, unknown>;
  const playerId = getDashboardPlayerId(player);
  const rank =
    (playerId && currentPositionRankById?.[playerId]) ||
    record.currentPositionRank ||
    record.seasonPositionRank ||
    record.positionRank ||
    record.position_rank ||
    record.rank;
  return typeof rank === "string" || typeof rank === "number" ? String(rank) : "-";
}

function getDashboardPlayerValue(player: unknown): number | null {
  if (!player || typeof player !== "object") return null;
  const record = player as Record<string, unknown>;
  for (const key of ["seasonValue", "value", "val", "ktc_value"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function sumDashboardPlayerValues(players: unknown[]): number | null {
  const total = players.reduce<number>((sum, player) => {
    const value = getDashboardPlayerValue(player);
    return value === null ? sum : sum + value;
  }, 0);
  return total > 0 ? total : null;
}

function getDashboardRankLabel(
  row: unknown,
  keys: string[],
  prefix = "#"
): string {
  const value = getDashboardNumber(row, keys);
  return value === null ? "#-" : `${prefix}${value}`;
}

const DASHBOARD_LINEUP_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
type DashboardLineupPosition = (typeof DASHBOARD_LINEUP_POSITIONS)[number];

function getDashboardPlayers(row: unknown, key: string): unknown[] {
  if (!row || typeof row !== "object") return [];
  const value = (row as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

function getDashboardStarterCount(
  row: unknown,
  position: DashboardLineupPosition
): number {
  return getDashboardNumber(row, [`${position}_starters`]) ?? 0;
}

function getDashboardPositionStarterValue(
  row: unknown,
  position: DashboardLineupPosition
): number {
  const players = getDashboardPlayers(row, "starterPlayers").filter(
    player => getDashboardPlayerPosition(player) === position
  );
  return players.reduce<number>((sum, player) => {
    const value = getDashboardPlayerValue(player);
    return sum + (value ?? 0);
  }, 0);
}

function getDashboardPositionRank(
  reportData: ReportData,
  manager: string,
  position: DashboardLineupPosition
): { rank: number | null; total: number } {
  const rows = reportData.managerPositionCounts || [];
  const scores = rows
    .map(row => ({
      manager: row.manager,
      count: getDashboardStarterCount(row, position),
      value: getDashboardPositionStarterValue(row, position),
    }))
    .filter(row => row.count > 0 || row.value > 0)
    .sort((a, b) => b.value - a.value || b.count - a.count);
  const index = scores.findIndex(row => row.manager === manager);
  return { rank: index >= 0 ? index + 1 : null, total: scores.length };
}

type DashboardStarterGroup = {
  key: string;
  label: string;
  count: number;
  players: unknown[];
};

function getDashboardStarterGroups(row: unknown): DashboardStarterGroup[] {
  if (!row || typeof row !== "object") return [];
  const value = (row as Record<string, unknown>).starterGroups;
  if (!Array.isArray(value)) return [];
  return value
    .map(group => {
      if (!group || typeof group !== "object") return null;
      const record = group as Record<string, unknown>;
      const key = typeof record.key === "string" ? record.key : "";
      const label =
        typeof record.label === "string" && record.label.trim()
          ? record.label
          : key;
      const count =
        typeof record.count === "number" && Number.isFinite(record.count)
          ? record.count
          : Array.isArray(record.players)
            ? record.players.length
            : 0;
      const players = Array.isArray(record.players) ? record.players : [];
      if (!key) return null;
      return { key, label, count, players };
    })
    .filter((group): group is DashboardStarterGroup => Boolean(group));
}

function getDashboardStarterGroupValue(group: DashboardStarterGroup): number {
  return group.players.reduce<number>((sum, player) => {
    const value = getDashboardPlayerValue(player);
    return sum + (value ?? 0);
  }, 0);
}

function getDashboardStarterGroupRank(
  reportData: ReportData,
  manager: string,
  groupKey: string
): { rank: number | null; total: number } {
  const rows = reportData.managerPositionCounts || [];
  const scores = rows
    .map(row => {
      const group = getDashboardStarterGroups(row).find(
        starterGroup => starterGroup.key === groupKey
      );
      return group
        ? {
            manager: row.manager,
            count: group.count,
            value: getDashboardStarterGroupValue(group),
          }
        : null;
    })
    .filter((row): row is { manager: string; count: number; value: number } =>
      Boolean(row)
    )
    .sort((a, b) => b.value - a.value || b.count - a.count);
  const index = scores.findIndex(row => row.manager === manager);
  return { rank: index >= 0 ? index + 1 : null, total: scores.length };
}

function getDashboardRosterQbPairValue(row: unknown): {
  count: number;
  value: number;
} {
  const rosterPlayers = getDashboardPlayers(row, "rosterPlayers");
  const fallbackPlayers = rosterPlayers.length
    ? rosterPlayers
    : [
        ...getDashboardPlayers(row, "lineupPlayers"),
        ...getDashboardStarterGroups(row).flatMap(group => group.players),
      ];
  const qbs = fallbackPlayers
    .filter(player => getDashboardPlayerPosition(player) === "QB")
    .sort(
      (a, b) =>
        (getDashboardPlayerValue(b) || 0) -
        (getDashboardPlayerValue(a) || 0)
    )
    .slice(0, 2);

  return {
    count: qbs.length,
    value: qbs.reduce<number>(
      (sum, player) => sum + (getDashboardPlayerValue(player) || 0),
      0
    ),
  };
}

function getDashboardQbSfRank(
  reportData: ReportData,
  manager: string
): { rank: number | null; total: number } {
  const scores = (reportData.managerPositionCounts || [])
    .map(row => {
      const qbPair = getDashboardRosterQbPairValue(row);
      return {
        manager: row.manager,
        count: qbPair.count,
        value: qbPair.value,
      };
    })
    .filter(row => row.count > 0 || row.value > 0)
    .sort((a, b) => b.value - a.value || b.count - a.count);
  const index = scores.findIndex(row => row.manager === manager);
  return { rank: index >= 0 ? index + 1 : null, total: scores.length };
}

type DashboardStarterRankGroup = DashboardStarterGroup & {
  position: string;
  rank: number | null;
  tier: string;
};

function getDashboardOverviewStarterRankGroups(
  reportData: ReportData,
  manager: string,
  row: unknown
): DashboardStarterRankGroup[] {
  const groups = getDashboardStarterGroups(row);
  const hasSuperFlex = groups.some(group => group.key === "QB_SF");
  const rankedGroups = groups
    .filter(group =>
      hasSuperFlex ? group.key !== "QB" && group.key !== "QB_SF" : true
    )
    .map(group => {
      const { rank, total } = getDashboardStarterGroupRank(
        reportData,
        manager,
        group.key
      );
      return {
        ...group,
        position: getDashboardGroupPosition(group.key),
        rank,
        tier: getDashboardRankTier(rank, total),
      };
    });

  if (!hasSuperFlex) return rankedGroups;

  const { rank, total } = getDashboardQbSfRank(reportData, manager);
  return [
    {
      key: "QB_SF_COMBINED",
      label: "QB/SF x2",
      count: 2,
      players: [],
      position: "QB_SF",
      rank,
      tier: getDashboardRankTier(rank, total),
    },
    ...rankedGroups,
  ];
}

function getDashboardRankTier(rank: number | null, total: number): string {
  if (!rank || total <= 0) return "Pending";
  if (rank <= Math.max(1, Math.ceil(total * 0.25))) return "Elite";
  if (rank <= Math.max(1, Math.ceil(total * 0.5))) return "Strong";
  if (rank <= Math.max(1, Math.ceil(total * 0.75))) return "Playable";
  return "Thin";
}

function getDashboardGroupPosition(groupKey: string): string {
  if (groupKey === "QB_SF") return "QB_SF";
  if (groupKey === "FLEX") return "FLEX";
  return groupKey;
}

type ReportDashboardTab =
  | "overview"
  | "momentum"
  | "rankings"
  | "trades"
  | "draft"
  | "autopilot"
  | string;

type ReportDashboardHeroCopy = {
  headline: string;
  subline: string;
  body: string;
};

const TAB_HERO_COPY = {
  overview: {
    headline: "LEAGUE AUDIT.\nNO MERCY.",
    subline: "Your league thinks it has balance. It does not.",
    body: "We use AI to expose contenders, frauds, rebuilders, and roster rot before the rest of your league realizes their teams are on the table.",
  },
  momentum: {
    headline: "CATCH THE TILT.\nCASH THE CHAOS.",
    subline: "Bad Sundays create great theft.",
    body: "We track who’s rising, who’s crashing, and who’s one injury report away from accepting a trade they’ll hate by Tuesday.",
  },
  rankings: {
    headline: "POWER RANKINGS.\nWITH TEETH.",
    subline: "Everyone gets a number. Some deserve an apology.",
    body: "We rank every team by real dynasty value, not group chat confidence, so you can see who’s loaded, who’s fake, and who should stop talking.",
  },
  trades: {
    headline: "FIND THE MARK.\nSEND THE FLEECE.",
    subline: "Some managers call it negotiation. We call it inventory removal.",
    body: "We use AI to spot weak rosters, desperate needs, bad depth, and trade windows before your league mates realize their bench became your shopping cart.",
  },
  draft: {
    headline: "DRAFT CAPITAL.\nCOURTROOM.",
    subline: "Picks don’t lie. Managers do.",
    body: "We expose wasted picks, rookie value, future leverage, and the managers who turned draft capital into a public safety warning.",
  },
  hacks: {
    headline: "ADMIN HACKS.\nEYES ONLY.",
    subline: "The stuff normal league mates should not see.",
    body: "Diagnostics, hidden snapshots, source health, and operational receipts live here so the main report can stay clean.",
  },
} satisfies Record<
  "overview" | "momentum" | "rankings" | "trades" | "draft" | "hacks",
  ReportDashboardHeroCopy
>;

const REDRAFT_TAB_HERO_COPY = {
  overview: {
    headline: "SEASON AUDIT.\nNO MERCY.",
    subline: "Your weekly edge starts with the roster in front of you.",
    body: "We surface current-season starters, depth gaps, injury leverage, and waiver pressure without pretending this is a multi-year build.",
  },
  momentum: {
    headline: "CATCH THE TILT.\nCASH THE CHAOS.",
    subline: "Bad Sundays create great theft.",
    body: "We track who is rising, who is crashing, and who is one injury report away from becoming useful this season.",
  },
  rankings: {
    headline: "SEASON RANKINGS.\nWITH TEETH.",
    subline: "Current value first. Noise second.",
    body: "We rank players by current-season value, weekly usefulness, and roster fit so redraft decisions stay focused on this season.",
  },
  trades: {
    headline: "FIND THE NEED.\nSEND THE OFFER.",
    subline: "Redraft trades are about weeks, not trophies in 2028.",
    body: "We spot short-term roster pressure, positional gaps, and usable trade windows before the next lineup lock closes.",
  },
  draft: {
    headline: "DRAFT ROOM.\nNO GUESSWORK.",
    subline: "Plan the board before the clock starts.",
    body: "We keep draft planning centered on current-season value, lineup scarcity, and roster construction instead of future pick leverage.",
  },
  hacks: {
    headline: "ADMIN HACKS.\nEYES ONLY.",
    subline: "Diagnostics stay out of the public report.",
    body: "Hidden snapshots, source health, and operational receipts live here so the standard redraft report remains focused.",
  },
} satisfies Record<
  "overview" | "momentum" | "rankings" | "trades" | "draft" | "hacks",
  ReportDashboardHeroCopy
>;

function getReportDashboardHeroCopy(
  activeTab?: string | null,
  leagueValueMode: LeagueValueMode = "dynasty"
): ReportDashboardHeroCopy {
  const normalizedTab = normalizeDashboardTab(activeTab);
  const copySource =
    leagueValueMode === "redraft" ? REDRAFT_TAB_HERO_COPY : TAB_HERO_COPY;
  if (
    normalizedTab &&
    Object.prototype.hasOwnProperty.call(copySource, normalizedTab)
  ) {
    return copySource[normalizedTab as keyof typeof copySource];
  }
  return copySource.overview;
}

type DashboardRankingPlayer =
  NonNullable<ReportData["rankings"]>["dynastySf"][number];

function clampDashboardScore(value?: number | null): number | null {
  if (value === null || value === undefined || !Number.isFinite(value))
    return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDashboardWholeNumber(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  return Math.round(value).toLocaleString();
}

function formatDashboardSignedNumber(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}`;
}

function formatDashboardPercentLabel(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function getDashboardTeamCount(reportData: ReportData): number {
  return (
    getReportDashboardManagers(reportData).length ||
    reportData.leagueOverview?.length ||
    reportData.managerPositionCounts?.length ||
    reportData.currentStandings?.length ||
    0
  );
}

function getDashboardLeagueValue(reportData: ReportData): number {
  return (reportData.managerRosterValueGrowth || []).reduce(
    (sum, row) => sum + (row.total_val || 0),
    0
  );
}

function getDashboardActivityScore(count: number, target: number): number | null {
  if (!target) return count ? 100 : null;
  return clampDashboardScore((count / target) * 100);
}

function getDashboardRosteredPlayerCount(reportData: ReportData): number | null {
  const positionRows = reportData.managerPositionCounts || [];
  if (positionRows.length) {
    const total = positionRows.reduce((sum, row) => {
      const fallbackCount =
        (row.activePlayerCount || 0) +
        (row.reservePlayerCount || 0) +
        (row.taxiPlayerCount || 0);
      return (
        sum +
        (row.totalRosterPlayerCount ||
          row.rosterPlayers?.length ||
          fallbackCount)
      );
    }, 0);
    return total || null;
  }

  const intelTotal = (reportData.managerRosterIntelligence || []).reduce(
    (sum, row) => sum + (row.rosterPlayers?.length || 0),
    0
  );
  return intelTotal || null;
}

function getDashboardHeroToneForSignedValue(
  value?: number | null
): DashboardMetricTone {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "neutral";
  if (value > 0) return "good";
  if (value < 0) return "danger";
  return "neutral";
}

function getDashboardRankingRows(
  reportData: ReportData,
  leagueValueMode: LeagueValueMode
): DashboardRankingPlayer[] {
  const rankings = reportData.rankings;
  if (!rankings) return [];

  const profileKey =
    leagueValueMode === "redraft"
      ? rankings.defaultRedraftProfileKey || rankings.defaultProfileKey
      : rankings.defaultProfileKey;
  const profileRows = profileKey ? rankings.profiles?.[profileKey] : null;
  if (profileRows?.length) return profileRows;

  if (leagueValueMode === "redraft") {
    return (
      rankings.redraftHalfPpr ||
      rankings.redraftPpr ||
      rankings.redraftStandard ||
      rankings.dynastySf ||
      []
    );
  }

  return rankings.dynastySf?.length
    ? rankings.dynastySf
    : rankings.dynastyOneQb || [];
}

function getDashboardRankingRowCount(
  reportData: ReportData,
  leagueValueMode: LeagueValueMode
): number {
  const rows = getDashboardRankingRows(reportData, leagueValueMode);
  if (rows.length) return rows.length;

  const rankings = reportData.rankings;
  if (!rankings?.profileRowCounts) return 0;
  const profileKey =
    leagueValueMode === "redraft"
      ? rankings.defaultRedraftProfileKey || rankings.defaultProfileKey
      : rankings.defaultProfileKey;
  if (profileKey && rankings.profileRowCounts[profileKey]) {
    return rankings.profileRowCounts[profileKey];
  }

  const fallbackKey =
    leagueValueMode === "redraft"
      ? rankings.defaultRedraftProfileKey
      : rankings.defaultProfileKey;
  return fallbackKey ? rankings.profileRowCounts[fallbackKey] || 0 : 0;
}

function getDashboardRankingProfileLabel(
  reportData: ReportData,
  leagueValueMode: LeagueValueMode
): string {
  const rankings = reportData.rankings;
  if (!rankings) return leagueValueMode === "redraft" ? "Season" : "Dynasty";

  const profileKey =
    leagueValueMode === "redraft"
      ? rankings.defaultRedraftProfileKey || rankings.defaultProfileKey
      : rankings.defaultProfileKey;
  const optionLabel = rankings.profileOptions?.find(
    option => option.key === profileKey
  )?.label;

  return (
    rankings.selectedProfileLabel ||
    optionLabel ||
    (leagueValueMode === "redraft" ? "Season Blend" : "Dynasty Blend")
  );
}

function getDashboardTopRankingPlayer(
  reportData: ReportData,
  leagueValueMode: LeagueValueMode,
  manager?: string | null
): DashboardRankingPlayer | null {
  const rows = getDashboardRankingRows(reportData, leagueValueMode);
  const pool = manager
    ? rows.filter(row => row.owner === manager)
    : rows;
  return (
    [...pool].sort((a, b) => (b.value || 0) - (a.value || 0))[0] || null
  );
}

function getDashboardPlayerName(player?: { name?: string | null } | null) {
  return player?.name || "-";
}

function getDashboardTrendLabel(
  player?: { name?: string; pos?: string; pct_change?: number; diff?: number } | null
) {
  if (!player) return "-";
  const movement =
    typeof player.pct_change === "number"
      ? formatDashboardSignedPercentLabel(player.pct_change)
      : formatDashboardSignedNumber(player.diff);
  return `${player.name} ${movement}`;
}

function getDashboardLeagueTradeManagers(reportData: ReportData): number {
  const managers = new Set<string>();
  reportData.tradeHistory?.forEach(trade => {
    if (trade.team_a) managers.add(trade.team_a);
    if (trade.team_b) managers.add(trade.team_b);
  });
  reportData.tradeTendencies?.forEach(row => {
    if (row.manager) managers.add(row.manager);
  });
  return managers.size;
}

function getDashboardHandshakeRate(reportData: ReportData): number | null {
  const trades = reportData.tradeHistory || [];
  if (!trades.length) return null;
  const fairTrades = trades.filter(
    trade => Math.abs(trade.point_gap || 0) <= 250
  ).length;
  return clampDashboardScore((fairTrades / trades.length) * 100);
}

function getDashboardDraftHitRate(stats?: {
  hits?: number;
  misses?: number;
} | null): number | null {
  const hits = stats?.hits || 0;
  const misses = stats?.misses || 0;
  const total = hits + misses;
  if (!total) return null;
  return clampDashboardScore((hits / total) * 100);
}

function getDashboardLeagueDraftStats(reportData: ReportData) {
  return (reportData.draftStats || []).reduce(
    (totals, row) => ({
      totalPicks: totals.totalPicks + (row.totalPicks || 0),
      hits: totals.hits + (row.hits || 0),
      misses: totals.misses + (row.misses || 0),
      starters: totals.starters + (row.starters || 0),
      avgKtcGainTotal: totals.avgKtcGainTotal + (row.avgKtcGain || 0),
      managerCount: totals.managerCount + 1,
    }),
    {
      totalPicks: 0,
      hits: 0,
      misses: 0,
      starters: 0,
      avgKtcGainTotal: 0,
      managerCount: 0,
    }
  );
}

function isDashboardMeaningfulHole(summary?: string | null): boolean {
  const normalized = String(summary || "").trim();
  return Boolean(
    normalized &&
      !/^no major roster hole flagged$/i.test(normalized) &&
      !/^none$/i.test(normalized)
  );
}

function getDashboardManagerValueRows(reportData: ReportData) {
  const managers = getReportDashboardManagers(reportData);
  return managers
    .map(manager => {
      const growth = reportData.managerRosterValueGrowth?.find(
        row => row.manager === manager
      );
      const overview = reportData.leagueOverview?.find(
        row => row.manager === manager
      );
      const power = reportData.powerRankings?.find(
        row => row.manager === manager
      );
      const value =
        getDashboardNumber(growth, ["total_val"]) ??
        getDashboardNumber(overview, ["total_val"]) ??
        getDashboardNumber(power, ["rosterValue"]) ??
        null;
      return { manager, value, overview, power };
    })
    .filter((row): row is typeof row & { value: number } => row.value !== null);
}

function getDashboardMarketSpread(reportData: ReportData) {
  const valueRows = getDashboardManagerValueRows(reportData).sort(
    (a, b) => b.value - a.value
  );
  const top = valueRows[0] || null;
  const bottom = valueRows[valueRows.length - 1] || null;
  const gap = top && bottom ? top.value - bottom.value : null;
  const gapPercent =
    gap !== null && bottom?.value ? Math.round((gap / bottom.value) * 100) : null;
  return {
    top,
    bottom,
    gap,
    gapPercent,
    score: top?.value ? clampDashboardScore(((gap || 0) / top.value) * 100) : null,
  };
}

function getDashboardPlayerAssetValue(player?: unknown): number {
  return (
    getDashboardNumber(player, [
      "value",
      "seasonValue",
      "ktcValue",
      "currentKtcValue",
    ]) || 0
  );
}

function getDashboardTopHeavy(reportData: ReportData) {
  const rows = (reportData.managerRosterIntelligence || [])
    .map(row => {
      const starterValue =
        getDashboardNumber(row, ["starterSeasonValue", "starterValue"]) || 0;
      const benchValue = getDashboardNumber(row, ["benchValue"]) || 0;
      const starterValuePct = getDashboardNumber(row, ["starterValuePct"]) || 0;
      const gap = starterValue - benchValue;
      return {
        manager: row.manager,
        gap,
        starterValuePct,
        score: Math.max(0, gap) + starterValuePct * 500,
      };
    })
    .filter(row => row.gap > 0 || row.starterValuePct > 0)
    .sort((a, b) => b.score - a.score);

  return rows[0] || null;
}

function getDashboardThinIce(reportData: ReportData) {
  const rows = (reportData.managerRosterIntelligence || [])
    .map(row => {
      const healthScore = getDashboardNumber(row, ["rosterHealthScore"]);
      const availabilityRisk = row.starterAvailability?.riskLevel;
      const riskScore =
        availabilityRisk === "high" ? 30 : availabilityRisk === "medium" ? 16 : 0;
      const positionWeaknesses = Object.values(row.positionGrades || {}).filter(
        grade =>
          grade.rank === null ||
          /thin|weak|bad|poor|f|d/i.test(`${grade.grade} ${grade.note}`)
      ).length;
      const holeScore = isDashboardMeaningfulHole(row.holes?.summary) ? 12 : 0;
      const flexScore =
        typeof row.holes?.flexDepth === "number"
          ? Math.max(0, 3 - row.holes.flexDepth) * 5
          : 0;
      const holeSummary = row.holes?.summary || "";
      const weakestCoveragePosition = (["QB", "RB", "WR", "TE"] as const)
        .map(position => {
          const grade = row.positionGrades?.[position];
          const gradeText = `${grade?.grade || ""} ${grade?.note || ""}`;
          const weakGrade =
            grade?.rank === null ||
            /thin|weak|bad|poor|f|d|behind|trail/i.test(gradeText);
          const holeMatch =
            new RegExp(`\\b${position}\\b|${position.toLowerCase()}\\d?|${position.toLowerCase()} room`, "i").test(
              holeSummary
            );
          const starterMatch = row.weakestStarter?.pos === position;
          return {
            position,
            score:
              (weakGrade ? 20 : 0) +
              (holeMatch ? 14 : 0) +
              (starterMatch ? 10 : 0) +
              (grade?.rank ? Math.min(12, Math.max(0, grade.rank - 12) / 4) : 0),
          };
        })
        .sort((a, b) => b.score - a.score)[0];
      const score =
        riskScore +
        (row.weakestStarter ? 16 : 0) +
        holeScore +
        flexScore +
        positionWeaknesses * 6 +
        (healthScore !== null ? Math.max(0, 62 - healthScore) : 0);

      return {
        manager: row.manager,
        score,
        riskLevel: availabilityRisk || "low",
        coverage:
          weakestCoveragePosition && weakestCoveragePosition.score > 0
            ? `${weakestCoveragePosition.position} backup plan sucks`
            : null,
        hole:
          isDashboardMeaningfulHole(holeSummary)
            ? holeSummary.split(",")[0]?.trim()
            : null,
      };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return rows[0] || null;
}

function getDashboardBenchRot(reportData: ReportData) {
  const rows = (reportData.managerRosterIntelligence || [])
    .map(row => {
      const lowValuePlayers = [
        ...(row.droppablePlayers || []),
        ...(row.benchPlayers || []),
        ...(row.taxiPlayers || []),
      ].filter(player => getDashboardPlayerAssetValue(player) <= 750);
      const uniquePlayers = new Map<string, unknown>();
      lowValuePlayers.forEach((player, index) => {
        const key =
          getDashboardPlayerId(player) ||
          (player && typeof player === "object"
            ? String((player as unknown as Record<string, unknown>).name || index)
            : String(index));
        uniquePlayers.set(key, player);
      });
      const players = Array.from(uniquePlayers.values()) as unknown[];
      const deadValue = players.reduce<number>(
        (sum, player) => sum + getDashboardPlayerAssetValue(player),
        0
      );
      const count = players.length;
      return {
        manager: row.manager,
        count,
        deadValue,
        score: count * 1000 + deadValue,
      };
    })
    .filter(row => row.count > 0 || row.deadValue > 0)
    .sort((a, b) => b.score - a.score);

  return rows[0] || null;
}

function getDashboardManagerWeeklyMovement(reportData: ReportData) {
  type ManagerWeeklyMovementRow = {
    manager: string;
    gain: number;
    loss: number;
    net: number;
    topGainPlayer?: string;
    topLossPlayer?: string;
  };
  const movement = new Map<
    string,
    ManagerWeeklyMovementRow
  >();
  const ensure = (manager: string) => {
    const existing = movement.get(manager);
    if (existing) return existing;
    const next: ManagerWeeklyMovementRow = { manager, gain: 0, loss: 0, net: 0 };
    movement.set(manager, next);
    return next;
  };

  (reportData.weeklyRisers || []).forEach(player => {
    if (!player.owner || isPlaceholderManagerName(player.owner)) return;
    const row = ensure(player.owner);
    const diff = Math.max(0, player.diff || 0);
    row.gain += diff;
    row.net += diff;
    if (!row.topGainPlayer || diff > 0) row.topGainPlayer = player.name;
  });

  (reportData.weeklyFallers || []).forEach(player => {
    if (!player.owner || isPlaceholderManagerName(player.owner)) return;
    const row = ensure(player.owner);
    const diff = Math.min(0, player.diff || 0);
    row.loss += diff;
    row.net += diff;
    if (!row.topLossPlayer || diff < 0) row.topLossPlayer = player.name;
  });

  const rows = Array.from(movement.values());
  return {
    heat:
      rows
        .filter(row => row.gain > 0)
        .sort((a, b) => b.gain - a.gain)[0] || null,
    tilt:
      rows
        .filter(row => row.loss < 0)
        .sort((a, b) => a.loss - b.loss)[0] || null,
  };
}

function getDashboardTrendStack(reportData: ReportData) {
  type TrendStackRow = {
    manager: string;
    playerKeys: Set<string>;
    addCount: number;
    topAddPlayer: string | null;
    topAddCount: number;
  };
  const rows = new Map<string, TrendStackRow>();
  const ensure = (manager: string) => {
    const existing = rows.get(manager);
    if (existing) return existing;
    const next: TrendStackRow = {
      manager,
      playerKeys: new Set<string>(),
      addCount: 0,
      topAddPlayer: null,
      topAddCount: 0,
    };
    rows.set(manager, next);
    return next;
  };
  const addPlayer = (
    player: NonNullable<ReportData["trendingAdds"]>[number]
  ) => {
    if (!player.owner || isPlaceholderManagerName(player.owner)) return;
    const row = ensure(player.owner);
    const playerKey = player.player_id || `${player.name}-${player.pos}`;
    if (row.playerKeys.has(playerKey)) return;
    const count = Math.max(0, player.count || 0);
    row.playerKeys.add(playerKey);
    row.addCount += count;
    if (count > row.topAddCount) {
      row.topAddPlayer = player.name;
      row.topAddCount = count;
    }
  };

  [...(reportData.trendingAdds || [])]
    .sort((a, b) => b.count - a.count || (b.ktcValue || 0) - (a.ktcValue || 0))
    .slice(0, 5)
    .forEach(addPlayer);

  return (
    Array.from(rows.values())
      .map(row => ({
        manager: row.manager,
        movers: row.playerKeys.size,
        addCount: row.addCount,
        topAddPlayer: row.topAddPlayer,
        topAddCount: row.topAddCount,
        score: row.addCount * 100 + row.playerKeys.size,
      }))
      .filter(row => row.addCount > 0)
      .sort((a, b) => b.score - a.score)[0] || null
  );
}

function getDashboardTiltRead(reportData: ReportData, teamCount: number) {
  const pressureManagers = new Map<string, number>();
  (reportData.weeklyFallers || []).forEach(player => {
    if (!player.owner || isPlaceholderManagerName(player.owner)) return;
    const pressure =
      Math.abs(player.pct_change || 0) * 2 + Math.abs(player.diff || 0) / 450;
    pressureManagers.set(
      player.owner,
      (pressureManagers.get(player.owner) || 0) + pressure
    );
  });
  (reportData.managerRosterIntelligence || []).forEach(row => {
    const healthScore = getDashboardNumber(row, ["rosterHealthScore"]);
    if (healthScore !== null && healthScore < 50) {
      pressureManagers.set(row.manager, (pressureManagers.get(row.manager) || 0) + 2);
    }
  });
  return {
    count: pressureManagers.size,
    manager:
      Array.from(pressureManagers.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      null,
    score: teamCount ? clampDashboardScore((pressureManagers.size / teamCount) * 100) : null,
  };
}

function getDashboardBestBuyWindow(reportData: ReportData) {
  const faller =
    [...(reportData.weeklyFallers || [])]
      .filter(player => (player.val_now || 0) > 0)
      .sort(
        (a, b) =>
          Math.abs(b.diff || 0) - Math.abs(a.diff || 0) ||
          (a.pct_change || 0) - (b.pct_change || 0)
      )[0] || null;
  if (faller) {
    return {
      value: faller.name,
      subLabel: `${faller.owner || "Market"} ${formatDashboardSignedPercentLabel(faller.pct_change)}`,
      helper: "Target before they recover.",
      tone: "danger" as DashboardMetricTone,
    };
  }

  const drop =
    [...(reportData.trendingDrops || [])].sort(
      (a, b) => (b.count || 0) - (a.count || 0)
    )[0] || null;
  return {
    value: drop?.name || "No clean dip",
    subLabel: drop ? `${formatDashboardWholeNumber(drop.count)} drops` : "Not enough movement",
    helper: drop ? "Drop heat creates leverage." : "No obvious buy window yet.",
    tone: drop ? ("warn" as DashboardMetricTone) : ("neutral" as DashboardMetricTone),
  };
}

function getDashboardTopDog(reportData: ReportData) {
  const ranked =
    [...(reportData.powerRankings || [])].sort((a, b) => a.rank - b.rank)[0] ||
    null;
  if (ranked) {
    return {
      manager: ranked.manager,
      subLabel: `${Math.round(ranked.score)} power score`,
      badges: [
        { label: `#${ranked.rank}`, tone: "good" as DashboardMetricTone },
        { label: ranked.tier, tone: "info" as DashboardMetricTone },
      ],
    };
  }

  const overview =
    [...(reportData.leagueOverview || [])].sort(
      (a, b) => a.rank_value - b.rank_value
    )[0] || null;
  return overview
    ? {
        manager: overview.manager,
        subLabel: formatDashboardCompactNumber(overview.total_val),
        badges: [
          { label: `#${overview.rank_value}`, tone: "good" as DashboardMetricTone },
        ],
      }
    : null;
}

function getDashboardFraudWatch(reportData: ReportData) {
  const intelByManager = new Map(
    (reportData.managerRosterIntelligence || []).map(row => [row.manager, row])
  );
  const candidates = (reportData.leagueOverview || [])
    .map(row => {
      const intel = intelByManager.get(row.manager);
      const health = getDashboardNumber(intel, ["rosterHealthScore"]);
      const weakness =
        (health !== null ? Math.max(0, 70 - health) : 0) +
        (intel?.weakestStarter ? 8 : 0) +
        (isDashboardMeaningfulHole(intel?.holes?.summary) ? 10 : 0) +
        (intel?.starterAvailability?.riskLevel === "high" ? 8 : 0);
      const rankPressure = Math.max(0, 8 - (row.rank_value || 99));
      return {
        manager: row.manager,
        score: weakness + rankPressure * 2,
        subLabel:
          health !== null
            ? `${Math.round(health)} health, rank #${row.rank_value}`
            : `Rank #${row.rank_value}`,
      };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function getDashboardLoadedCore(reportData: ReportData) {
  const powerRow =
    [...(reportData.powerRankings || [])]
      .sort((a, b) => b.starterStrength - a.starterStrength || a.rank - b.rank)[0] ||
    null;
  if (powerRow) {
    return {
      manager: powerRow.manager,
      subLabel: powerRow.starterStrength >= 80 ? "Elite starters" : "Best starters",
      score: powerRow.starterStrength,
    };
  }

  const intelRow =
    [...(reportData.managerRosterIntelligence || [])]
      .sort(
        (a, b) =>
          (getDashboardNumber(b, ["starterSeasonValue", "starterValue"]) || 0) -
          (getDashboardNumber(a, ["starterSeasonValue", "starterValue"]) || 0)
      )[0] || null;
  return intelRow
    ? {
        manager: intelRow.manager,
        subLabel: "Best starters",
        score: null,
      }
    : null;
}

function getDashboardPaperTiger(reportData: ReportData) {
  const depthRanks = [...(reportData.managerRosterIntelligence || [])]
    .map(row => ({
      manager: row.manager,
      benchValue: getDashboardNumber(row, ["benchValue"]) || 0,
    }))
    .sort((a, b) => b.benchValue - a.benchValue)
    .map((row, index) => ({ ...row, depthRank: index + 1 }));
  const depthByManager = new Map(depthRanks.map(row => [row.manager, row]));
  const candidates = (reportData.powerRankings || [])
    .map(row => {
      const depth = depthByManager.get(row.manager);
      if (!depth) return null;
      const mismatch = depth.depthRank - row.rank;
      return {
        manager: row.manager,
        rank: row.rank,
        depthRank: depth.depthRank,
        mismatch,
        score: mismatch * 100 + Math.max(0, 100 - row.starterStrength),
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> =>
        row !== null && row.mismatch > 0
    )
    .sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function getDashboardDepthCheck(reportData: ReportData) {
  const intelRow =
    [...(reportData.managerRosterIntelligence || [])]
      .map(row => ({
        manager: row.manager,
        benchValue: getDashboardNumber(row, ["benchValue"]) || 0,
      }))
      .filter(row => row.benchValue > 0)
      .sort((a, b) => b.benchValue - a.benchValue)[0] || null;

  return intelRow
    ? {
        manager: intelRow.manager,
        subLabel: "Best bench support",
        benchValue: intelRow.benchValue,
      }
    : null;
}

function getDashboardPowerGap(reportData: ReportData) {
  const powerRows = [...(reportData.powerRankings || [])].sort(
    (a, b) => a.rank - b.rank
  );
  if (powerRows.length >= 2) {
    const top = powerRows[0];
    const median = powerRows[Math.floor(powerRows.length / 2)];
    const last = powerRows[powerRows.length - 1];
    const gap = Math.round(top.score - median.score);
    return {
      value: `${gap > 0 ? "+" : ""}${gap}`,
      subLabel: `#1 to median`,
      score: clampDashboardScore(((top.score - last.score) / Math.max(1, top.score)) * 100),
    };
  }

  const spread = getDashboardMarketSpread(reportData);
  return {
    value: spread.gap !== null ? formatDashboardCompactNumber(spread.gap) : "-",
    subLabel: "Top-to-bottom value gap",
    score: spread.score,
  };
}

function getDashboardContenderWall(reportData: ReportData, teamCount: number) {
  const timelineRows = reportData.dynastyTimelines || [];
  const contenders = timelineRows.filter(row => row.contenderScore >= 70);
  if (timelineRows.length) {
    return {
      count: contenders.length,
      score: teamCount ? clampDashboardScore((contenders.length / teamCount) * 100) : null,
      top:
        [...timelineRows].sort(
          (a, b) => b.contenderScore - a.contenderScore
        )[0] || null,
    };
  }

  const powerRows = reportData.powerRankings || [];
  const powerContenders = powerRows.filter(
    row => row.score >= 75 || /contend|elite|favorite/i.test(row.tier)
  );
  return {
    count: powerContenders.length,
    score: teamCount ? clampDashboardScore((powerContenders.length / teamCount) * 100) : null,
    top:
      [...powerRows].sort((a, b) => b.score - a.score)[0] || null,
  };
}

function getDashboardBestTradeMark(reportData: ReportData) {
  const tradeCounts = new Map(
    (reportData.tradeTendencies || []).map(row => [row.manager, row.tradeCount])
  );
  const candidates = (reportData.managerRosterIntelligence || [])
    .map(row => {
      const health = getDashboardNumber(row, ["rosterHealthScore"]);
      const hasNeed = Boolean(row.tradePlan?.needPosition);
      const hasAsset =
        Boolean(row.tradeChip) ||
        Boolean(row.bestBenchStash) ||
        (row.benchValue || 0) > 0 ||
        (row.tradeableDepth || []).length > 0;
      const score =
        (hasNeed ? 10 : 0) +
        (row.weakestStarter ? 8 : 0) +
        (isDashboardMeaningfulHole(row.holes?.summary) ? 8 : 0) +
        (health !== null ? Math.max(0, 65 - health) / 4 : 0) +
        (hasAsset ? 5 : 0) +
        Math.min(4, tradeCounts.get(row.manager) || 0);
      return {
        manager: row.manager,
        score,
        need:
          row.tradePlan?.needPosition ||
          (isDashboardMeaningfulHole(row.holes?.summary)
            ? row.holes.summary.split(",")[0]?.trim()
            : null),
        hasAsset,
      };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function getDashboardTradeLedger(reportData: ReportData) {
  const rows = reportData.tradeTendencies || [];
  return {
    champ:
      [...rows].sort((a, b) => (b.profit || 0) - (a.profit || 0))[0] || null,
    loser:
      [...rows].sort((a, b) => (a.profit || 0) - (b.profit || 0))[0] || null,
  };
}

function getDashboardTradeShark(reportData: ReportData) {
  const activeRows = (reportData.tradeTendencies || []).filter(
    row => (row.tradeCount || 0) > 0
  );
  const qualifiedRows = activeRows.filter(row => (row.tradeCount || 0) >= 3);
  const pool = qualifiedRows.length ? qualifiedRows : activeRows;
  const row =
    [...pool].sort(
      (a, b) =>
        (b.winPct || 0) - (a.winPct || 0) ||
        (b.wins || 0) - (a.wins || 0) ||
        (b.profit || 0) - (a.profit || 0) ||
        (b.tradeCount || 0) - (a.tradeCount || 0)
    )[0] || null;

  if (!row) {
    return {
      manager: null,
      value: "No trades yet",
      subLabel: "0 deals logged",
      helper: "Are you all allergic to trading?",
      tone: "neutral" as DashboardMetricTone,
    };
  }

  const losses = Math.max(0, (row.tradeCount || 0) - (row.wins || 0));
  const qualified = (row.tradeCount || 0) >= 3;
  return {
    manager: row.manager,
    value: row.manager,
    subLabel: qualified
      ? `${row.winPct}% win rate`
      : `${row.wins || 0}-${losses} record`,
    helper: qualified
      ? "Wins deals, not arguments."
      : "Leader until the sample grows.",
    tone: qualified ? ("good" as DashboardMetricTone) : ("warn" as DashboardMetricTone),
  };
}

function getDashboardNeedHeat(reportData: ReportData): DashboardMetricBar[] {
  const positions = ["QB", "RB", "WR", "TE"] as const;
  const counts = new Map<(typeof positions)[number], number>(
    positions.map(position => [position, 0])
  );
  (reportData.managerRosterIntelligence || []).forEach(row => {
    if (row.tradePlan?.needPosition) {
      counts.set(row.tradePlan.needPosition, (counts.get(row.tradePlan.needPosition) || 0) + 2);
    }
    const summary = row.holes?.summary || "";
    positions.forEach(position => {
      const grade = row.positionGrades?.[position];
      if (
        new RegExp(`\\b${position}\\b`, "i").test(summary) ||
        (grade && /thin|weak|bad|poor|f|d/i.test(`${grade.grade} ${grade.note}`))
      ) {
        counts.set(position, (counts.get(position) || 0) + 1);
      }
    });
  });

  return positions
    .map(position => ({
      label: position,
      value: counts.get(position) || 0,
      displayValue:
        (counts.get(position) || 0) >= 5
          ? "High"
          : (counts.get(position) || 0) >= 2
            ? "Med"
            : "Low",
      tone:
        (counts.get(position) || 0) >= 5
          ? ("danger" as DashboardMetricTone)
          : (counts.get(position) || 0) >= 2
            ? ("warn" as DashboardMetricTone)
            : ("info" as DashboardMetricTone),
    }))
    .sort((a, b) => b.value - a.value);
}

function getDashboardPickHoarder(reportData: ReportData) {
  const portfolio =
    [...(reportData.pickPortfolios || [])].sort((a, b) => {
      const pickDiff =
        (b.futurePicks?.length || 0) - (a.futurePicks?.length || 0);
      return pickDiff || (b.totalValue || 0) - (a.totalValue || 0);
    })[0] || null;
  if (portfolio) {
    const pickCount =
      portfolio.futurePicks?.length ||
      (portfolio.count2026 || 0) + (portfolio.count2027 || 0) + (portfolio.count2028 || 0);
    return {
      manager: portfolio.manager,
      value: `${pickCount} picks`,
      subLabel: formatDashboardCompactNumber(portfolio.totalValue),
      badges: [
        { label: `${portfolio.ownPicks} own`, tone: "info" as DashboardMetricTone },
        { label: `${portfolio.acquiredPicks} raided`, tone: "warn" as DashboardMetricTone },
      ],
    };
  }

  const draftStat =
    [...(reportData.draftStats || [])].sort(
      (a, b) => (b.totalPicks || 0) - (a.totalPicks || 0)
    )[0] || null;
  return draftStat
    ? {
        manager: draftStat.manager,
        value: `${draftStat.totalPicks} picks`,
        subLabel: "Historical draft volume",
        badges: [{ label: "Past drafts", tone: "info" as DashboardMetricTone }],
      }
    : null;
}

function getDashboardFutureGm(reportData: ReportData, leagueValueMode: LeagueValueMode) {
  const best = getBestDraftSignalManager(reportData, leagueValueMode);
  if (!best) return null;
  const decided = (best.hits || 0) + (best.misses || 0);
  const hitRate = decided ? Math.round(((best.hits || 0) / decided) * 100) : null;
  const isRedraft = leagueValueMode === "redraft";
  return {
    manager: best.manager,
    value: formatDashboardSignedNumber(best.avgKtcGain),
    subLabel: isRedraft
      ? "Avg value gained per pick"
      : "Avg rookie value gained per pick",
    badges: [
      { label: `${best.totalPicks} picks`, tone: "info" as DashboardMetricTone },
      {
        label: hitRate === null ? "Hit rate pending" : `${hitRate}% hits`,
        tone:
          hitRate === null
            ? ("neutral" as DashboardMetricTone)
            : hitRate >= 50
              ? ("good" as DashboardMetricTone)
              : ("warn" as DashboardMetricTone),
      },
    ],
  };
}

function getDashboardAdpReach(reportData: ReportData, leagueValueMode: LeagueValueMode) {
  const reachManager = getWorstDraftAdpValueManager(reportData, leagueValueMode);

  return reachManager
    ? {
        manager: reachManager.manager,
        value: `${Math.round(reachManager.totalAdpReach)} ADP`,
        subLabel: "Total rookie ADP overpay",
        badges: [
          {
            label: `${reachManager.adpReachPickCount} reaches`,
            tone: "danger" as DashboardMetricTone,
          },
          {
            label: `${reachManager.totalPicks} picks`,
            tone: "info" as DashboardMetricTone,
          },
        ],
      }
    : null;
}

function getDashboardAdpThief(reportData: ReportData, leagueValueMode: LeagueValueMode) {
  const adpManager = getBestDraftAdpValueManager(reportData, leagueValueMode);

  return adpManager
    ? {
        manager: adpManager.manager,
        value: `+${Math.round(adpManager.totalAdpValue)} ADP`,
        subLabel: "Total rookie ADP value banked",
        badges: [
          {
            label: `${adpManager.adpValuePickCount} steals`,
            tone: "good" as DashboardMetricTone,
          },
          {
            label: `${adpManager.totalPicks} picks`,
            tone: "info" as DashboardMetricTone,
          },
        ],
      }
    : null;
}

function getReportDashboardHeroConfig({
  activeTab,
  leagueValueMode,
  reportData,
}: {
  activeTab: ReportDashboardTab;
  leagueValueMode: LeagueValueMode;
  reportData: ReportData;
}): {
  pillLabel: string;
  pills: string[];
  metrics: DashboardHeroMetric[];
} {
  const teamCount = getDashboardTeamCount(reportData);
  const weeklyRisers = [...(reportData.weeklyRisers || [])].sort(
    (a, b) => (b.pct_change || 0) - (a.pct_change || 0)
  );
  const weeklyFallers = [...(reportData.weeklyFallers || [])].sort(
    (a, b) => (a.pct_change || 0) - (b.pct_change || 0)
  );
  const draftTotals = getDashboardLeagueDraftStats(reportData);
  const aiScore = reportData.leagueDiagnostics?.aiConfidence?.score ?? null;
  const getMetricAvatarUrl = (manager?: string | null) =>
    manager
      ? getDashboardManagerAvatar(manager, reportData.managerAvatars)
      : null;

  if (activeTab === "momentum") {
    const movement = getDashboardManagerWeeklyMovement(reportData);
    const trendStack = getDashboardTrendStack(reportData);

    return {
      pillLabel: "Momentum signals",
      pills: ["Market movement", "Waiver heat", "Buy windows", "Sell pressure"],
      metrics: [
        {
          key: "heat-check",
          kind: "delta",
          label: "Heat Check",
          value: movement.heat?.manager || "No heater",
          subLabel: movement.heat
            ? `${formatDashboardSignedNumber(movement.heat.gain)} in 7 days`
            : "No roster gained value",
          targetManager: movement.heat?.manager,
          avatarUrl: getMetricAvatarUrl(movement.heat?.manager),
          tone: movement.heat ? "good" : "neutral",
          deltaDirection: movement.heat ? "up" : "flat",
          helper: movement.heat?.topGainPlayer
            ? renderDashboardHelperStack(
                movement.heat.topGainPlayer,
                "Sparked the surge."
              )
            : "Roster gain leader is not available yet.",
        },
        {
          key: "cold-streak",
          kind: "delta",
          label: "Cold Streak",
          value: movement.tilt?.manager || "No crash",
          subLabel: movement.tilt
            ? `${formatDashboardSignedNumber(movement.tilt.loss)} in 7 days`
            : "No roster lost value",
          targetManager: movement.tilt?.manager,
          avatarUrl: getMetricAvatarUrl(movement.tilt?.manager),
          tone: movement.tilt ? "danger" : "neutral",
          deltaDirection: movement.tilt ? "down" : "flat",
          helper: movement.tilt?.topLossPlayer
            ? renderDashboardHelperStack(
                movement.tilt.topLossPlayer,
                "Triggered the slide."
              )
            : "No major weekly damage logged.",
        },
        {
          key: "trend-stack",
          kind: "target",
          label: "Trend Stack",
          value: trendStack?.manager || "No trend stack",
          subLabel: trendStack
            ? `${formatDashboardPreviewCount(trendStack.addCount) || 0} adds`
            : "No add movement logged",
          targetManager: trendStack?.manager,
          avatarUrl: getMetricAvatarUrl(trendStack?.manager),
          tone: trendStack ? "warn" : "neutral",
          helper: trendStack?.topAddPlayer
            ? renderDashboardHelperStack(
                trendStack.topAddPlayer,
                `${formatDashboardPreviewCount(trendStack.topAddCount) || 0} adds`
              )
            : "No add leader logged.",
        },
      ],
    };
  }

  if (activeTab === "rankings") {
    const loadedCore = getDashboardLoadedCore(reportData);
    const paperTiger = getDashboardPaperTiger(reportData);
    const depthCheck = getDashboardDepthCheck(reportData);
    return {
      pillLabel: "Ranking signals",
      pills: ["Format matched", "Rostered values", "Prospect board", "Source blend"],
      metrics: [
        {
          key: "loaded-core",
          kind: "target",
          label: "Loaded Core",
          value: loadedCore?.manager || "No core found",
          subLabel: loadedCore?.subLabel || "Starter strength hidden",
          targetManager: loadedCore?.manager,
          avatarUrl: getMetricAvatarUrl(loadedCore?.manager),
          tone: loadedCore ? "good" : "neutral",
          helper: "The lineup has teeth.",
        },
        {
          key: "paper-tiger",
          kind: "target",
          label: "Paper Tiger",
          value: paperTiger?.manager || "No paper tiger",
          subLabel: paperTiger
            ? `#${paperTiger.rank} rank, #${paperTiger.depthRank} depth`
            : "Rank/depth mismatch hidden",
          targetManager: paperTiger?.manager,
          avatarUrl: getMetricAvatarUrl(paperTiger?.manager),
          tone: paperTiger ? "danger" : "neutral",
          helper: "Looks better than it is.",
        },
        {
          key: "depth-check",
          kind: "target",
          label: "Depth Check",
          value: depthCheck?.manager || "No depth edge",
          subLabel: depthCheck?.subLabel || "Bench support hidden",
          targetManager: depthCheck?.manager,
          avatarUrl: getMetricAvatarUrl(depthCheck?.manager),
          tone: depthCheck ? "good" : "neutral",
          helper: "Built to survive Sundays.",
        },
      ],
    };
  }

  if (activeTab === "trades") {
    const tradeLedger = getDashboardTradeLedger(reportData);
    const tradeShark = getDashboardTradeShark(reportData);
    const champProfitScore = tradeLedger.champ
      ? clampDashboardScore(Math.min(100, Math.abs(tradeLedger.champ.profit || 0) / 50))
      : null;
    const loserProfitScore = tradeLedger.loser
      ? clampDashboardScore(Math.min(100, Math.abs(tradeLedger.loser.profit || 0) / 50))
      : null;
    return {
      pillLabel: "Trade signals",
      pills: ["Roster scanner", "Value gaps", "Profit leaders", "Market behavior"],
      metrics: [
        {
          key: "trade-reaper",
          kind: "delta",
          label: "Trade Reaper",
          value: tradeLedger.champ?.manager || "No winner yet",
          subLabel: tradeLedger.champ
            ? `${formatDashboardSignedNumber(tradeLedger.champ.profit)} all-time`
            : "No trade profit data",
          score: champProfitScore,
          targetManager: tradeLedger.champ?.manager,
          avatarUrl: getMetricAvatarUrl(tradeLedger.champ?.manager),
          tone: tradeLedger.champ ? "good" : "neutral",
          deltaDirection: tradeLedger.champ ? "up" : "flat",
          helper: "Always leaves richer.",
        },
        {
          key: "league-donor",
          kind: "delta",
          label: "League Donor",
          value: tradeLedger.loser?.manager || "No victim yet",
          subLabel: tradeLedger.loser
            ? `${formatDashboardSignedNumber(tradeLedger.loser.profit)} all-time`
            : "No trade loss data",
          score: loserProfitScore,
          targetManager: tradeLedger.loser?.manager,
          avatarUrl: getMetricAvatarUrl(tradeLedger.loser?.manager),
          tone: tradeLedger.loser ? "danger" : "neutral",
          deltaDirection: tradeLedger.loser ? "down" : "flat",
          helper: "Charity work, but worse.",
        },
        {
          key: "deal-demon",
          kind: "target",
          label: "Deal Demon",
          value: tradeShark.value,
          subLabel: tradeShark.subLabel,
          targetManager: tradeShark.manager,
          avatarUrl: getMetricAvatarUrl(tradeShark.manager),
          tone: tradeShark.tone,
          helper: tradeShark.helper,
        },
      ],
    };
  }

  if (activeTab === "draft") {
    const futureGm = getDashboardFutureGm(reportData, leagueValueMode);
    const adpReach = getDashboardAdpReach(reportData, leagueValueMode);
    const adpThief = getDashboardAdpThief(reportData, leagueValueMode);
    return {
      pillLabel: "Draft signals",
      pills: ["Capital efficiency", "Hit rate", "Passed value", "Rookie runway"],
      metrics: [
        {
          key: "future-gm",
          kind: "badges",
          label: "Future GM",
          value: futureGm?.manager || "No GM yet",
          subLabel: futureGm?.subLabel || "No efficiency data",
          badges: futureGm?.badges || [{ label: "Pending", tone: "neutral" }],
          targetManager: futureGm?.manager,
          avatarUrl: getMetricAvatarUrl(futureGm?.manager),
          tone: futureGm ? "good" : "neutral",
          helper: futureGm
            ? `${futureGm.value} average pick value.`
            : "Best pick efficiency is not available.",
        },
        {
          key: "adp-reach",
          kind: "badges",
          label: "ADP Reach",
          value: adpReach?.manager || "No reach logged",
          subLabel: adpReach?.subLabel || "No ADP overpay data",
          badges: adpReach?.badges || [{ label: "Pending", tone: "neutral" }],
          targetManager: adpReach?.manager,
          avatarUrl: getMetricAvatarUrl(adpReach?.manager),
          tone: adpReach ? "danger" : "neutral",
          helper: adpReach
            ? `${adpReach.manager} reached ${adpReach.value} ahead of rookie ADP.`
            : "Worst total ADP reach is not available.",
        },
        {
          key: "adp-thief",
          kind: "badges",
          label: "ADP Thief",
          value: adpThief?.manager || "No ADP theft",
          subLabel: adpThief?.subLabel || "No ADP value data",
          badges: adpThief?.badges || [{ label: "Pending", tone: "neutral" }],
          targetManager: adpThief?.manager,
          avatarUrl: getMetricAvatarUrl(adpThief?.manager),
          tone: adpThief ? "good" : "neutral",
          helper: adpThief
            ? `${adpThief.manager} banked ${adpThief.value} by waiting past market cost.`
            : "Best total ADP value is not available.",
        },
      ],
    };
  }

  if (activeTab === "autopilot") {
    return {
      pillLabel: "AI signals",
      pills: ["Confidence", "Roster reads", "Source checks", "Action plans"],
      metrics: [
        {
          key: "ai-confidence",
          kind: "ring",
          label: "AI Score",
          value: aiScore ?? "-",
          subLabel: reportData.leagueDiagnostics?.aiConfidence?.label || "League read",
          score: aiScore,
          tone: aiScore === null ? "neutral" : aiScore >= 70 ? "good" : "warn",
        },
        {
          key: "manager-reads",
          label: "Manager Reads",
          value: reportData.managerRosterIntelligence?.length || 0,
          subLabel: "Owner profiles",
          tone: reportData.managerRosterIntelligence?.length ? "info" : "warn",
        },
        {
          key: "trade-plans",
          label: "Trade Plans",
          value: reportData.tradeProposalSignals?.length || 0,
          subLabel: "Signal queue",
          tone: reportData.tradeProposalSignals?.length ? "good" : "neutral",
        },
        {
          key: "waiver-plans",
          label: "Waiver Plans",
          value: reportData.waiverIntelligence?.availableTrendingAdds?.length || 0,
          subLabel: "Available adds",
          tone: reportData.waiverIntelligence?.availableTrendingAdds?.length
            ? "good"
            : "neutral",
        },
        {
          key: "coverage",
          kind: "meter",
          label: "Coverage",
          value: `${teamCount || "-"} teams`,
          subLabel: "League context",
          score: teamCount ? 100 : null,
          tone: teamCount ? "good" : "warn",
        },
      ],
    };
  }

  const topHeavy = getDashboardTopHeavy(reportData);
  const thinIce = getDashboardThinIce(reportData);
  const benchRot = getDashboardBenchRot(reportData);

  return {
    pillLabel: "Overview signals",
    pills: ["League health", "Weak spots", "Value spread"],
    metrics: [
      {
        key: "top-heavy",
        kind: "target",
        label: "Top Heavy",
        value: topHeavy?.manager || "No imbalance",
        subLabel: topHeavy
          ? `Starters carry ${topHeavy.starterValuePct}%`
          : "Starter/bench gap hidden",
        targetManager: topHeavy?.manager,
        avatarUrl: getMetricAvatarUrl(topHeavy?.manager),
        tone: topHeavy ? "warn" : "neutral",
        helper: "Bench gets ugly fast.",
      },
      {
        key: "thin-ice",
        kind: "target",
        label: "Thin Ice",
        value: thinIce?.manager || "No cracks found",
        subLabel:
          thinIce?.coverage ||
          thinIce?.hole ||
          (thinIce ? `${thinIce.riskLevel} availability risk` : "Depth risk hidden"),
        targetManager: thinIce?.manager,
        avatarUrl: getMetricAvatarUrl(thinIce?.manager),
        tone: thinIce ? "danger" : "neutral",
        helper: "No safety net.",
      },
      {
        key: "bench-rot",
        kind: "target",
        label: "Bench Rot",
        value: benchRot?.manager || "No rot found",
        subLabel: benchRot
          ? `${benchRot.count} low value spots`
          : "No obvious cut pile",
        targetManager: benchRot?.manager,
        avatarUrl: getMetricAvatarUrl(benchRot?.manager),
        tone: benchRot ? "danger" : "neutral",
        helper: "Dead weight on the bench.",
      },
    ],
  };
}

export function ReportOverviewHero({
  leagueName,
  activeTab,
  leagueValueMode,
  reportData,
}: {
  leagueName: string;
  activeTab: ReportDashboardTab;
  leagueValueMode: LeagueValueMode;
  reportData: ReportData;
}) {
  const heroCopy = getReportDashboardHeroCopy(activeTab, leagueValueMode);
  const heroConfig = getReportDashboardHeroConfig({
    activeTab,
    leagueValueMode,
    reportData,
  });
  const normalizedHeroTab = normalizeDashboardTab(activeTab) || "overview";

  return (
    <ReportOverviewHeroSection
      leagueName={leagueName}
      activeTab={normalizedHeroTab}
      heroCopy={heroCopy}
      heroConfig={heroConfig}
    />
  );
}

function getReportDashboardSpotlightConfig({
  activeTab,
  manager,
  reportData,
  leagueValueMode,
  starterCount,
  seasonValue,
  healthScore,
  healthLabel,
  valueRank,
  valueRankTier,
  intelSummary,
}: {
  activeTab: ReportDashboardTab;
  manager: string;
  reportData: ReportData;
  leagueValueMode: LeagueValueMode;
  starterCount: number | null;
  seasonValue: number | null;
  healthScore: number | null;
  healthLabel: string;
  valueRank: number | null;
  valueRankTier: string;
  intelSummary?: string | null;
}): DashboardSpotlightConfig {
  const managerRisers = [...(reportData.weeklyRisers || [])]
    .filter(player => player.owner === manager)
    .sort((a, b) => (b.pct_change || 0) - (a.pct_change || 0));
  const managerFallers = [...(reportData.weeklyFallers || [])]
    .filter(player => player.owner === manager)
    .sort((a, b) => (a.pct_change || 0) - (b.pct_change || 0));
  const topAdd = [...(reportData.trendingAdds || [])].sort(
    (a, b) => (b.count || 0) - (a.count || 0)
  )[0];
  const topDrop = [...(reportData.trendingDrops || [])].sort(
    (a, b) => (b.count || 0) - (a.count || 0)
  )[0];
  const rankingRows = getDashboardRankingRows(reportData, leagueValueMode);
  const topRosterPlayer = getDashboardTopRankingPlayer(
    reportData,
    leagueValueMode,
    manager
  );
  const rosteredRows = rankingRows.filter(row => row.owner === manager);
  const managerGrowth = reportData.managerRosterValueGrowth?.find(
    row => row.manager === manager
  );
  const leagueOverview = reportData.leagueOverview?.find(
    row => row.manager === manager
  );
  const tradeTendency = reportData.tradeTendencies?.find(
    row => row.manager === manager
  );
  const managerTrades = (reportData.tradeHistory || []).filter(
    trade => trade.team_a === manager || trade.team_b === manager
  );
  const managerDraftStats = reportData.draftStats?.find(
    row => row.manager === manager
  );
  const managerDraftPicks = (reportData.draftPicks || []).filter(
    pick => pick.manager === manager
  );
  const aiConfidence =
    reportData.leagueDiagnostics?.aiConfidence?.managerConfidence?.find(
      row => row.manager === manager
    ) || null;

  if (activeTab === "momentum") {
    const topRiser = managerRisers[0] || reportData.weeklyRisers?.[0] || null;
    const topFaller =
      managerFallers[0] || reportData.weeklyFallers?.[0] || null;
    const volatility = managerRisers.length + managerFallers.length;

    return {
      eyebrow: "Weekly Action Board",
      metrics: [
        {
          key: "value-swing",
          label: "Value Swing",
          value: getDashboardTrendLabel(topRiser),
          subLabel: topRiser?.owner === manager ? "Your climb" : "League climb",
          tone: "good",
        },
        {
          key: "heat",
          kind: "meter",
          label: "Roster Heat",
          value: `${volatility} moves`,
          subLabel: "Risers/fallers",
          score: getDashboardActivityScore(volatility, 6),
          tone: volatility >= 4 ? "warn" : "info",
        },
        {
          key: "fall-risk",
          label: "Fall Risk",
          value: getDashboardTrendLabel(topFaller),
          subLabel: topFaller?.owner === manager ? "Your dip" : "League dip",
          tone: "danger",
        },
      ],
      blocks: [
        {
          key: "riser",
          label: "Riser to inspect",
          value: getDashboardPlayerName(topRiser),
          subLabel: formatDashboardSignedPercentLabel(topRiser?.pct_change),
          tone: "good",
        },
        {
          key: "faller",
          label: "Pressure point",
          value: getDashboardPlayerName(topFaller),
          subLabel: formatDashboardSignedPercentLabel(topFaller?.pct_change),
          tone: "danger",
        },
        {
          key: "add",
          label: "Waiver heat",
          value: topAdd?.name || "-",
          subLabel: topAdd
            ? `${formatDashboardWholeNumber(topAdd.count)} adds`
            : "No add heat",
          tone: "good",
        },
        {
          key: "drop",
          label: "Drop heat",
          value: topDrop?.name || "-",
          subLabel: topDrop
            ? `${formatDashboardWholeNumber(topDrop.count)} drops`
            : "No drop heat",
          tone: "danger",
        },
      ],
      chips: [
        `${managerRisers.length} risers`,
        `${managerFallers.length} fallers`,
        topAdd ? `${topAdd.name} add heat` : "No add heat",
      ],
      readTitle: "Momentum Read",
      read:
        topRiser?.owner === manager
          ? `${topRiser.name} is the live leverage point. Decide whether to cash out into steadier value or let the weekly spike become lineup edge.`
          : "This roster is not driving the loudest market moves right now. Use the weekly board for opportunistic buys instead of chasing the league's biggest spikes.",
    };
  }

  if (activeTab === "rankings") {
    const rankingRowCount = getDashboardRankingRowCount(
      reportData,
      leagueValueMode
    );
    const hasRankingRows = rankingRows.length > 0;
    const rosterCoverage = rankingRows.length
      ? (rosteredRows.length / rankingRows.length) * 100
      : null;
    const profileLabel = getDashboardRankingProfileLabel(
      reportData,
      leagueValueMode
    );
    const boardLoadScore = hasRankingRows
      ? rosterCoverage
      : rankingRowCount
        ? 55
        : null;
    const sourceBlendLabel = reportData.rankings?.sourceWeightProfiles
      ? "Weighted"
      : "Default";

    return {
      eyebrow: "Market Board",
      metrics: [
        {
          key: "rank",
          label: "Value Rank",
          value: getDashboardRankLabel(leagueOverview, ["rank_value"]),
          subLabel: "Season value",
          tone: "info",
        },
        {
          key: "coverage",
          kind: "meter",
          label: "Board Load",
          value: hasRankingRows ? "Live" : rankingRowCount ? "Metadata" : "-",
          subLabel: hasRankingRows
            ? `${formatDashboardWholeNumber(rosteredRows.length)} rostered`
            : rankingRowCount
              ? `${formatDashboardWholeNumber(rankingRowCount)} indexed`
              : "No board data",
          score: boardLoadScore,
          tone: hasRankingRows
            ? rosterCoverage && rosterCoverage >= 5
              ? "good"
              : "warn"
            : rankingRowCount
              ? "info"
              : "warn",
        },
        {
          key: "profile",
          label: "Value Lens",
          value: "Matched",
          subLabel: profileLabel,
          tone: "info",
        },
      ],
      blocks: [
        {
          key: "top-asset",
          label: topRosterPlayer ? "Top roster asset" : "Board size",
          value: topRosterPlayer?.name || formatDashboardWholeNumber(rankingRowCount),
          subLabel:
            topRosterPlayer?.positionRank ||
            topRosterPlayer?.pos ||
            "Indexed assets",
          tone: topRosterPlayer ? "good" : rankingRowCount ? "info" : "warn",
        },
        {
          key: "value-rank",
          label: "Roster value",
          value: getDashboardRankLabel(leagueOverview, ["rank_value"]),
          subLabel: formatDashboardCompactNumber(
            seasonValue ?? managerGrowth?.total_val
          ),
          tone: "info",
        },
        {
          key: "qb-room",
          label: topRosterPlayer ? "QB room" : "Value lens",
          value: topRosterPlayer
            ? getDashboardRankLabel(leagueOverview, ["rank_qb"])
            : "Matched",
          subLabel: topRosterPlayer ? "Full roster rank" : profileLabel,
          tone: "info",
        },
        {
          key: "rb-room",
          label: topRosterPlayer ? "RB room" : "Source blend",
          value: topRosterPlayer
            ? getDashboardRankLabel(leagueOverview, ["rank_rb"])
            : sourceBlendLabel,
          subLabel: topRosterPlayer ? "Full roster rank" : profileLabel,
          tone: "info",
        },
      ],
      chips: [
        `${formatDashboardWholeNumber(rankingRowCount)} ranked`,
        `${formatDashboardWholeNumber(rosteredRows.length)} rostered`,
        profileLabel,
      ],
      readTitle: "Ranking Read",
      read: topRosterPlayer
        ? `${topRosterPlayer.name} is the roster's highest visible asset in the active value lens. Use that tier as the anchor before packaging depth or dropping into the next value shelf.`
        : rankingRowCount
          ? `The ranking board is loaded as metadata for this view. Open the Rankings sections to hydrate player rows; the active lens is ${profileLabel}.`
          : "Open the rankings board to match this roster against the active value lens and identify the first real tier break.",
    };
  }

  if (activeTab === "trades") {
    const winPct = tradeTendency?.winPct ?? null;
    const avgGap = tradeTendency?.avgGap ?? null;
    const profit = tradeTendency?.profit ?? null;
    const partner = tradeTendency?.favoritePartner || "No repeat partner";

    return {
      eyebrow: "Trade War Room",
      metrics: [
        {
          key: "profit",
          label: "Trade Profit",
          value: formatDashboardSignedNumber(profit),
          subLabel: "All-time ledger",
          tone: getDashboardHeroToneForSignedValue(profit),
        },
        {
          key: "win-rate",
          kind: "ring",
          label: "Win Rate",
          value: formatDashboardPercentLabel(winPct),
          subLabel: "Outcomes",
          score: winPct,
          tone: winPct === null ? "neutral" : winPct >= 50 ? "good" : "danger",
        },
        {
          key: "volume",
          kind: "meter",
          label: "Volume",
          value: tradeTendency?.tradeCount ?? managerTrades.length,
          subLabel: "Completed deals",
          score: getDashboardActivityScore(
            tradeTendency?.tradeCount ?? managerTrades.length,
            10
          ),
          tone:
            (tradeTendency?.tradeCount ?? managerTrades.length) > 0
              ? "info"
              : "warn",
        },
      ],
      blocks: [
        {
          key: "partner",
          label: "Favorite partner",
          value: partner,
          subLabel: "Most common counterparty",
          tone: tradeTendency?.favoritePartner ? "info" : "neutral",
        },
        {
          key: "avg-gap",
          label: "Average gap",
          value: formatDashboardWholeNumber(avgGap),
          subLabel: "Trade tax profile",
          tone:
            avgGap === null
              ? "neutral"
              : Math.abs(avgGap) <= 250
                ? "good"
                : "warn",
        },
        {
          key: "picks",
          label: "Pick bias",
          value: tradeTendency?.overpaysForPicks ? "Pays up" : "Clean",
          subLabel: "Draft capital behavior",
          tone: tradeTendency?.overpaysForPicks ? "warn" : "good",
        },
        {
          key: "vets",
          label: "Veteran bias",
          value: tradeTendency?.overpaysForVeterans ? "Pays up" : "Clean",
          subLabel: "Producer market behavior",
          tone: tradeTendency?.overpaysForVeterans ? "warn" : "good",
        },
      ],
      chips: [
        `${tradeTendency?.tradeCount ?? managerTrades.length} trades`,
        `${formatDashboardPercentLabel(winPct)} win rate`,
        partner,
      ],
      readTitle: "Trade Read",
      read: tradeTendency
        ? `${manager}'s trade ledger shows ${formatDashboardSignedNumber(profit)} profit with a ${formatDashboardPercentLabel(winPct)} win rate. Their average gap and bias flags should set the opening offer, not roster value alone.`
        : "This manager does not have enough trade tendency data yet. Start with the roster scanner and value match finder before assuming a negotiation style.",
    };
  }

  if (activeTab === "draft") {
    const hitRate = getDashboardDraftHitRate(managerDraftStats);
    const avgChange = managerDraftStats?.avgKtcGain ?? null;

    return {
      eyebrow: "Draft Audit",
      metrics: [
        {
          key: "picks",
          label: "Picks",
          value: managerDraftStats?.totalPicks ?? managerDraftPicks.length,
          subLabel: "Audited",
          tone:
            managerDraftStats?.totalPicks || managerDraftPicks.length
              ? "info"
              : "neutral",
        },
        {
          key: "hit-rate",
          kind: "ring",
          label: "Hits",
          value: formatDashboardPercentLabel(hitRate),
          subLabel: "Hits vs misses",
          score: hitRate,
          tone: hitRate === null ? "neutral" : hitRate >= 50 ? "good" : "warn",
        },
        {
          key: "avg-change",
          label: "Avg Change",
          value: formatDashboardSignedNumber(avgChange),
          subLabel: "Value delta",
          tone: getDashboardHeroToneForSignedValue(avgChange),
        },
      ],
      blocks: [
        {
          key: "best",
          label: "Best pick",
          value: managerDraftStats?.bestPick?.playerName || "-",
          subLabel:
            managerDraftStats?.bestPick?.valueGain !== null &&
            managerDraftStats?.bestPick?.valueGain !== undefined
              ? formatDashboardSignedNumber(managerDraftStats.bestPick.valueGain)
              : "No best pick",
          tone: managerDraftStats?.bestPick ? "good" : "neutral",
        },
        {
          key: "worst",
          label: "Worst pick",
          value: managerDraftStats?.worstPick?.playerName || "-",
          subLabel:
            managerDraftStats?.worstPick?.valueGain !== null &&
            managerDraftStats?.worstPick?.valueGain !== undefined
              ? formatDashboardSignedNumber(managerDraftStats.worstPick.valueGain)
              : "No miss logged",
          tone: managerDraftStats?.worstPick ? "danger" : "neutral",
        },
        {
          key: "starters",
          label: "Drafted starters",
          value: managerDraftStats?.starters ?? 0,
          subLabel: "Lineup hits",
          tone: managerDraftStats?.starters ? "good" : "neutral",
        },
        {
          key: "misses",
          label: "Misses",
          value: managerDraftStats?.misses ?? 0,
          subLabel: "Audit flags",
          tone: managerDraftStats?.misses ? "warn" : "good",
        },
      ],
      chips: [
        `${managerDraftStats?.hits ?? 0} hits`,
        `${managerDraftStats?.misses ?? 0} misses`,
        `${managerDraftStats?.starters ?? 0} starters`,
      ],
      readTitle: "Draft Read",
      read: managerDraftStats?.bestPick
        ? `${managerDraftStats.bestPick.playerName} is the cleanest draft win, while ${managerDraftStats.worstPick?.playerName || "the miss bucket"} carries the biggest audit flag. That split is the fastest way to see whether this manager finds value or pays tuition.`
        : "Draft capital efficiency will sharpen once this manager has enough picks in the audit sample.",
    };
  }

  if (activeTab === "autopilot") {
    return {
      eyebrow: "AI Action Plan",
      metrics: [
        {
          key: "confidence",
          kind: "ring",
          label: "Confidence",
          value: aiConfidence?.score ?? "-",
          subLabel: aiConfidence?.label || "Manager read",
          score: aiConfidence?.score ?? null,
          tone:
            aiConfidence?.score === undefined
              ? "neutral"
              : aiConfidence.score >= 70
                ? "good"
                : "warn",
        },
        {
          key: "starters",
          label: "Starters",
          value: starterCount ?? "-",
          subLabel: "Projected",
          tone: "info",
        },
        {
          key: "health",
          kind: "ring",
          label: "Health",
          value: healthScore ?? "-",
          subLabel: healthLabel,
          score: healthScore,
          tone: healthScore === null ? "neutral" : healthScore >= 70 ? "good" : "warn",
        },
      ],
      blocks: [
        {
          key: "confidence-note",
          label: "Confidence note",
          value: aiConfidence?.label || "Building",
          subLabel: aiConfidence?.note || "Open Autopilot for trace details.",
          tone: aiConfidence?.score && aiConfidence.score >= 70 ? "good" : "warn",
        },
        {
          key: "trade-plan",
          label: "Trade signal",
          value: reportData.tradeProposalSignals?.length || 0,
          subLabel: "Open recommendations",
          tone: reportData.tradeProposalSignals?.length ? "good" : "neutral",
        },
        {
          key: "waiver-plan",
          label: "Waiver signal",
          value: reportData.waiverIntelligence?.availableTrendingAdds?.length || 0,
          subLabel: "Available add pool",
          tone: reportData.waiverIntelligence?.availableTrendingAdds?.length
            ? "good"
            : "neutral",
        },
        {
          key: "source-state",
          label: "Data state",
          value: reportData.leagueDiagnostics?.aiConfidence ? "Scored" : "Building",
          subLabel: "AI read inputs",
          tone: reportData.leagueDiagnostics?.aiConfidence ? "good" : "warn",
        },
      ],
      chips: [
        aiConfidence?.label || "AI building",
        `${starterCount ?? "-"} starters`,
        `Health ${healthScore ?? "-"}`,
      ],
      readTitle: "AI Read",
      read:
        aiConfidence?.note ||
        intelSummary ||
        "Autopilot is ready to turn this manager's roster context into ranked next actions.",
    };
  }

  return {
    eyebrow: "Projected Season Roster",
    metrics: [
      {
        key: "value-rank",
        label: "Value Rank",
        value: valueRank === null ? "#-" : `#${valueRank}`,
        subLabel: valueRankTier,
        tone: "info",
      },
      {
        key: "team-value",
        label: "Team Value",
        value: formatDashboardCompactNumber(seasonValue),
        subLabel: "Roster total",
        tone: "good",
      },
      {
        key: "health",
        kind: "ring",
        label: "Teams Health",
        value: healthScore ?? "-",
        subLabel: healthLabel,
        score: healthScore,
        tone:
          healthScore === null
            ? "neutral"
            : healthScore >= 70
              ? "good"
              : healthScore >= 55
                ? "warn"
                : "danger",
      },
    ],
    blocks: [],
    chips: [],
    readTitle: "Roster Outlook",
    read:
      intelSummary ||
      "This manager is ready for a deeper roster read once the overview sections are opened.",
  };
}

export function ReportDashboardSpotlight({
  manager,
  activeTab,
  leagueValueMode,
  reportData,
  managerAvatars,
  variant = "sidebar",
}: {
  manager: string | null;
  activeTab: ReportDashboardTab;
  leagueValueMode: LeagueValueMode;
  reportData: ReportData;
  managerAvatars?: Record<string, string | null | undefined>;
  variant?: "sidebar" | "inline";
}) {
  if (!manager) return null;

  const intel = reportData.managerRosterIntelligence?.find(
    row => row.manager === manager
  );
  const counts = reportData.managerPositionCounts?.find(
    row => row.manager === manager
  );
  const growth = reportData.managerRosterValueGrowth?.find(
    row => row.manager === manager
  );
  const leagueOverview = reportData.leagueOverview?.find(
    row => row.manager === manager
  );
  const power = reportData.powerRankings?.find(row => row.manager === manager);
  const valueRank = getDashboardNumber(leagueOverview, ["rank_value"]);
  const valueRankTier = getDashboardRankTier(
    valueRank,
    getDashboardTeamCount(reportData)
  );
  const starterCount = counts
    ? (counts.QB_starters || 0) +
      (counts.RB_starters || 0) +
      (counts.WR_starters || 0) +
      (counts.TE_starters || 0) +
      (counts.K_starters || 0) +
      (counts.DEF_starters || 0)
    : null;
  const healthScore = getDashboardNumber(intel, ["rosterHealthScore"]);
  const fallbackHealthScore = healthScore ?? power?.score ?? null;
  const healthLabel =
    fallbackHealthScore === null
      ? "Score"
      : fallbackHealthScore >= 80
        ? "Strong"
        : fallbackHealthScore >= 70
          ? "Good"
          : fallbackHealthScore >= 55
            ? "Watch"
            : "Risk";
  const projectedStarters =
    (counts?.starterPlayers?.length ? counts.starterPlayers : counts?.lineupPlayers) || [];
  const rosterValuePlayers =
    (counts?.lineupPlayers?.length ? counts.lineupPlayers : projectedStarters) || [];
  const seasonValue =
    getDashboardNumber(growth, ["total_val"]) ??
    getDashboardNumber(leagueOverview, ["total_val"]) ??
    getDashboardNumber(intel, ["starterSeasonValue", "starterValue"]) ??
    sumDashboardPlayerValues(rosterValuePlayers);
  const positionRankCards = DASHBOARD_LINEUP_POSITIONS.filter(position => {
    if (["QB", "RB", "WR", "TE"].includes(position)) return true;
    return reportData.managerPositionCounts?.some(
      row => getDashboardStarterCount(row, position) > 0
    );
  }).map(position => {
    const computed = getDashboardPositionRank(reportData, manager, position);
    const overviewRank =
      position === "K" || position === "DEF"
        ? null
        : getDashboardNumber(leagueOverview, [`rank_${position.toLowerCase()}`]);
    const rank = computed.rank ?? overviewRank;
    return {
      position,
      rank,
      tier: getDashboardRankTier(
        rank,
        computed.total || getDashboardTeamCount(reportData)
      ),
    };
  });
  const starterRankGroups = getDashboardOverviewStarterRankGroups(
    reportData,
    manager,
    counts
  );
  const hasSpecialTeamRanks =
    positionRankCards.some(({ position }) => position === "K" || position === "DEF") ||
    starterRankGroups.some(group => group.position === "K" || group.position === "DEF");
  const swapSignals = [
    intel?.tradePlan?.summary,
    intel?.holes?.summary,
    (intel as { nextMove?: string } | undefined)?.nextMove,
  ].filter((signal): signal is string => Boolean(signal));
  const spotlightConfig = getReportDashboardSpotlightConfig({
    activeTab,
    manager,
    reportData,
    leagueValueMode,
    starterCount,
    seasonValue,
    healthScore: fallbackHealthScore,
    healthLabel,
    valueRank,
    valueRankTier,
    intelSummary:
      intel?.summary || (intel as { nextMove?: string } | undefined)?.nextMove,
  });
  const isOverviewSpotlight = activeTab === "overview";
  return (
    <ReportDashboardSpotlightPanel
      manager={manager}
      managerAvatarUrl={getDashboardManagerAvatar(manager, managerAvatars)}
      spotlightConfig={spotlightConfig}
      positionRankCards={positionRankCards}
      starterRankGroups={starterRankGroups}
      swapSignals={swapSignals}
      isOverviewSpotlight={isOverviewSpotlight}
      hasSpecialTeamRanks={hasSpecialTeamRanks}
      variant={variant}
    />
  );
}
