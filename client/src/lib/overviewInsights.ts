import type { ReportData } from "@shared/types";
import { getLeagueModeCopy, normalizeLeagueValueMode, type LeagueValueMode } from "./leagueValueMode";
import { isPlaceholderManagerName } from "./managerDisplay";

export type OverviewPosition = "QB" | "RB" | "WR" | "TE";
export type OverviewManagerIntelRow = NonNullable<
  ReportData["managerRosterIntelligence"]
>[number];
export type OverviewRow = ReportData["leagueOverview"][number];
export type OverviewPowerRow = NonNullable<ReportData["powerRankings"]>[number];
export type OverviewReadChip =
  | string
  | {
      label: string;
      tone?: "neutral" | "good" | "info" | "warn" | "danger";
    };

export const OVERVIEW_POSITIONS: OverviewPosition[] = ["QB", "RB", "WR", "TE"];

function shouldHidePlaceholderManagers(data: ReportData): boolean {
  return normalizeLeagueValueMode(
    data.leagueDiagnostics?.valueMode || data.leagueValueMode
  ) === "redraft";
}

function isVisibleOverviewManager(data: ReportData, manager?: string | null): boolean {
  return !(shouldHidePlaceholderManagers(data) && isPlaceholderManagerName(manager));
}

export function getOverviewManagerOptions(data: ReportData): string[] {
  const names = [
    ...(data.managerRosterIntelligence || []).map(row => row.manager),
    ...(data.leagueOverview || []).map(row => row.manager),
  ];
  return Array.from(new Set(names))
    .filter(manager => isVisibleOverviewManager(data, manager))
    .sort((a, b) => a.localeCompare(b));
}

export function getOverviewDefaultManager(data: ReportData): string {
  if (data.viewerManager && isVisibleOverviewManager(data, data.viewerManager)) {
    return data.viewerManager;
  }

  return (
    [...(data.leagueOverview || [])].sort(
      (a, b) => a.rank_value - b.rank_value
    ).find(row => isVisibleOverviewManager(data, row.manager))?.manager ||
    data.managerRosterIntelligence?.find(row => isVisibleOverviewManager(data, row.manager))?.manager ||
    ""
  );
}

export function getOverviewIntel(
  data: ReportData,
  manager?: string | null
): OverviewManagerIntelRow | null {
  if (!manager) return null;
  return (
    data.managerRosterIntelligence?.find(row => row.manager === manager) || null
  );
}

export function getOverviewRow(
  data: ReportData,
  manager?: string | null
): OverviewRow | null {
  if (!manager) return null;
  return data.leagueOverview?.find(row => row.manager === manager) || null;
}

export function getOverviewPower(
  data: ReportData,
  manager?: string | null
): OverviewPowerRow | null {
  if (!manager) return null;
  return data.powerRankings?.find(row => row.manager === manager) || null;
}

export function getOverviewLeagueSize(data: ReportData): number {
  return (
    data.leagueDiagnostics?.teamCount ||
    data.leagueOverview?.length ||
    data.managerRosterIntelligence?.length ||
    12
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getOverviewRankGrade(
  rank?: number | null,
  leagueSize = 12
): number {
  const numericRank = Number(rank);
  if (!Number.isFinite(numericRank) || numericRank <= 0) return 5;
  const percentile = 1 - (numericRank - 1) / Math.max(1, leagueSize - 1);
  return clamp(Math.round(2 + percentile * 8), 1, 10);
}

export function getOverviewValueTier(
  rank?: number | null,
  leagueSize = 12
): string {
  const grade = getOverviewRankGrade(rank, leagueSize);
  if (grade >= 9) return "Elite";
  if (grade >= 7) return "Championship";
  if (grade >= 5) return "Contending";
  if (grade >= 3) return "Reload";
  return "Rebuild";
}

export function getOverviewPositionRank(
  overview: OverviewRow | null,
  position: OverviewPosition
): number | null {
  if (!overview) return null;
  if (position === "QB") return overview.rank_qb;
  if (position === "RB") return overview.rank_rb;
  if (position === "WR") return overview.rank_wr;
  return overview.rank_te;
}

export function getOverviewPositionGrade(
  data: ReportData,
  intel: OverviewManagerIntelRow | null,
  overview: OverviewRow | null,
  position: OverviewPosition
): string {
  const directGrade = intel?.positionGrades?.[position]?.grade;
  if (directGrade) return directGrade;
  return String(
    getOverviewRankGrade(getOverviewPositionRank(overview, position), getOverviewLeagueSize(data))
  );
}

export function getOverviewNeedPosition(
  data: ReportData,
  manager: string
): OverviewPosition | null {
  const direct = getOverviewIntel(data, manager)?.tradePlan?.needPosition;
  if (direct && OVERVIEW_POSITIONS.includes(direct)) return direct;
  const shortage = data.positionDepth?.find(
    row => row.manager === manager && row.status === "shortage"
  );
  return OVERVIEW_POSITIONS.includes(shortage?.position as OverviewPosition)
    ? (shortage?.position as OverviewPosition)
    : null;
}

export function getOverviewSurplusPosition(
  data: ReportData,
  manager: string
): OverviewPosition | null {
  const direct = getOverviewIntel(data, manager)?.tradePlan?.surplusPosition;
  if (direct && OVERVIEW_POSITIONS.includes(direct)) return direct;
  const surplus = data.positionDepth?.find(
    row => row.manager === manager && row.status === "excess"
  );
  return OVERVIEW_POSITIONS.includes(surplus?.position as OverviewPosition)
    ? (surplus?.position as OverviewPosition)
    : null;
}

export function buildOverviewPulseRead(data: ReportData): {
  title: string;
  body: string;
  chips: OverviewReadChip[];
  manager: string;
  leagueValueMode: LeagueValueMode;
} {
  const manager = getOverviewDefaultManager(data);
  const leagueValueMode = normalizeLeagueValueMode(
    data.leagueDiagnostics?.valueMode || data.leagueValueMode
  );
  const modeCopy = getLeagueModeCopy(leagueValueMode);
  const hasPowerRanks = Boolean(data.powerRankings?.length);
  const hasRosterRecon = Boolean(data.managerRosterIntelligence?.length);
  const hasMarketSignals = Boolean(
    data.tradeTendencies?.length ||
      data.pickPortfolios?.length ||
      data.positionDepth?.length
  );
  const coverage = [
    hasPowerRanks ? "league ordering" : null,
    hasRosterRecon ? "roster recon" : null,
    hasMarketSignals ? "market pressure" : null,
  ].filter(Boolean);
  const lead = manager
    ? `${manager} sets the starting lens for this Overview pass.`
    : "Run a league report with manager roster data to unlock team-specific reads.";
  const coverageLine = coverage.length
    ? `It checks ${coverage.join(", ")} and leaves exact ranks, roster calls, and trade targets to the sections below.`
    : "It stays limited until league, roster, and market data all load.";
  const drillDownLine =
    leagueValueMode === "redraft"
      ? "Use it as the season-direction header, not as a replacement for the weekly tables."
      : "Use it as the dynasty-direction header, not as a replacement for owner, roster, and trade tables.";

  return {
    title: `${modeCopy.ownerTitle} Upgrade Path`,
    body: `${lead} ${coverageLine} ${drillDownLine}`,
    manager,
    leagueValueMode,
    chips: [
      { label: "Start Here", tone: "good" },
      data.leagueDiagnostics?.aiConfidence
        ? {
            label: data.leagueDiagnostics.aiConfidence.label,
            tone:
              data.leagueDiagnostics.aiConfidence.score >= 70
                ? "good"
                : data.leagueDiagnostics.aiConfidence.score >= 52
                  ? "info"
                  : "warn",
          }
        : null,
      leagueValueMode === "redraft" ? "Season lens" : "Dynasty lens",
      "Overview only",
      hasRosterRecon
        ? "Drill-down ready"
        : { label: "Drill-down limited", tone: "warn" },
    ].filter(Boolean) as OverviewReadChip[],
  };
}

export function buildOwnerIdentityPreview(
  data: ReportData,
  mode: LeagueValueMode,
  sortLabel: string
): {
  profileCount: number;
  identityLens: string;
} {
  return {
    profileCount:
      data.managerRosterIntelligence?.length || data.leagueOverview?.length || 0,
    identityLens: mode === "redraft" ? "Season" : sortLabel,
  };
}

export function buildRosterStarterPreview(data: ReportData): {
  strongestStarterManager: string | null;
  weakestStarterManager: string | null;
} {
  const starterScoreByManager = new Map(
    (data.powerRankings || []).map(row => [
      row.manager,
      row.starterStrength || 0,
    ])
  );
  const orderedStarterRows = [...(data.managerRosterIntelligence || [])]
    .filter(row => row.manager)
    .sort((a, b) => {
      const scoreA =
        a.starterSeasonValue ||
        a.starterValue ||
        starterScoreByManager.get(a.manager) ||
        0;
      const scoreB =
        b.starterSeasonValue ||
        b.starterValue ||
        starterScoreByManager.get(b.manager) ||
        0;
      return scoreB - scoreA;
    });

  return {
    strongestStarterManager: orderedStarterRows[0]?.manager || null,
    weakestStarterManager:
      orderedStarterRows.length > 1
        ? orderedStarterRows[orderedStarterRows.length - 1]?.manager || null
        : null,
  };
}

export function buildTaxiTriagePreview(data: ReportData): {
  mostPromotableManager: string | null;
  promoteCount: number;
  mostCuttableManager: string | null;
  cutCount: number;
} | null {
  const taxiRows = [...(data.managerRosterIntelligence || [])]
    .filter(row => row.manager && (row.taxiTriage?.items.length || 0) > 0)
    .map(row => ({
      manager: row.manager,
      itemCount: row.taxiTriage?.items.length || 0,
      promoteCount: Number(row.taxiTriage?.counts["Promote Now"] || 0),
      cutCount: Number(row.taxiTriage?.counts.Cuttable || 0),
    }));

  if (!taxiRows.length) return null;

  const mostPromotable =
    [...taxiRows]
      .filter(row => row.promoteCount > 0)
      .sort(
        (a, b) =>
          b.promoteCount - a.promoteCount ||
          b.cutCount - a.cutCount ||
          b.itemCount - a.itemCount ||
          a.manager.localeCompare(b.manager)
      )[0] || null;
  const mostCuttable =
    [...taxiRows]
      .filter(row => row.cutCount > 0)
      .sort(
        (a, b) =>
          b.cutCount - a.cutCount ||
          b.promoteCount - a.promoteCount ||
          b.itemCount - a.itemCount ||
          a.manager.localeCompare(b.manager)
      )[0] || null;

  return {
    mostPromotableManager: mostPromotable?.manager || null,
    promoteCount: mostPromotable?.promoteCount || 0,
    mostCuttableManager: mostCuttable?.manager || null,
    cutCount: mostCuttable?.cutCount || 0,
  };
}

export function buildManagerPositionRoomPreview(data: ReportData): {
  needToDropManager: string | null;
  needToDropCount: number;
  openRoomManager: string | null;
  openRoomCount: number;
} | null {
  const rosterCapacity = Number(
    data.leagueDiagnostics?.totalRosterSlots ||
      (data.leagueDiagnostics?.rosterSlots?.length || 0) +
        Number(data.leagueDiagnostics?.reserveSlots || 0) +
        Number(data.leagueDiagnostics?.taxiSlots || 0)
  );
  if (!rosterCapacity) return null;

  const roomRows = [...(data.managerPositionCounts || [])]
    .filter(row => row.manager)
    .map(row => ({
      manager: row.manager,
      totalRosterPlayerCount: Number(row.totalRosterPlayerCount || 0),
      room: rosterCapacity - Number(row.totalRosterPlayerCount || 0),
    }));

  const needToDrop =
    roomRows
      .filter(row => row.room < 0)
      .sort(
        (a, b) =>
          a.room - b.room ||
          b.totalRosterPlayerCount - a.totalRosterPlayerCount ||
          a.manager.localeCompare(b.manager)
      )[0] || null;
  const openRoom =
    roomRows
      .filter(row => row.room > 0)
      .sort(
        (a, b) =>
          b.room - a.room ||
          a.totalRosterPlayerCount - b.totalRosterPlayerCount ||
          a.manager.localeCompare(b.manager)
      )[0] || null;

  return {
    needToDropManager: needToDrop?.manager || null,
    needToDropCount: Math.abs(needToDrop?.room || 0),
    openRoomManager: openRoom?.manager || null,
    openRoomCount: openRoom?.room || 0,
  };
}
