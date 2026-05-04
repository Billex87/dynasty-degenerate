import type { ReportData } from '@shared/types';

type StandingRow = NonNullable<ReportData['currentStandings']>[number];

export function buildStandingRankMap(
  standings?: ReportData['currentStandings'],
  leagueOverview?: ReportData['leagueOverview']
) {
  const rankMap = new Map<string, number>();
  (standings || []).forEach((row) => {
    rankMap.set(row.manager, row.rank);
  });
  if (rankMap.size === 0) {
    (leagueOverview || []).forEach((row) => {
      rankMap.set(row.manager, row.rank_value);
    });
  }
  return rankMap;
}

export function compareManagersByViewerAndStanding(
  a: string,
  b: string,
  options: {
    viewerManager?: string | null;
    standings?: ReportData['currentStandings'];
    leagueOverview?: ReportData['leagueOverview'];
  }
) {
  const { viewerManager } = options;
  if (viewerManager && a === viewerManager && b !== viewerManager) return -1;
  if (viewerManager && b === viewerManager && a !== viewerManager) return 1;

  const rankMap = buildStandingRankMap(options.standings, options.leagueOverview);
  const aRank = rankMap.get(a) ?? Number.MAX_SAFE_INTEGER;
  const bRank = rankMap.get(b) ?? Number.MAX_SAFE_INTEGER;
  if (aRank !== bRank) return aRank - bRank;
  return a.localeCompare(b);
}

export function sortRowsByViewerAndStanding<T>(
  rows: T[],
  getManager: (row: T) => string,
  options: {
    viewerManager?: string | null;
    standings?: ReportData['currentStandings'];
    leagueOverview?: ReportData['leagueOverview'];
  }
) {
  return [...rows].sort((a, b) => compareManagersByViewerAndStanding(getManager(a), getManager(b), options));
}

export function compareManagersByOverviewStrength(
  a: string,
  b: string,
  options: {
    powerRankings?: ReportData['powerRankings'];
    dynastyTimelines?: ReportData['dynastyTimelines'];
    leagueOverview?: ReportData['leagueOverview'];
  }
) {
  const powerRankMap = new Map((options.powerRankings || []).map((row) => [row.manager, row.rank]));
  const contenderMap = new Map((options.dynastyTimelines || []).map((row) => [row.manager, row.contenderScore]));
  const valueRankMap = new Map((options.leagueOverview || []).map((row) => [row.manager, row.rank_value]));

  const aPower = powerRankMap.get(a) ?? Number.MAX_SAFE_INTEGER;
  const bPower = powerRankMap.get(b) ?? Number.MAX_SAFE_INTEGER;
  if (aPower !== bPower) return aPower - bPower;

  const aContender = contenderMap.get(a) ?? Number.NEGATIVE_INFINITY;
  const bContender = contenderMap.get(b) ?? Number.NEGATIVE_INFINITY;
  if (aContender !== bContender) return bContender - aContender;

  const aValue = valueRankMap.get(a) ?? Number.MAX_SAFE_INTEGER;
  const bValue = valueRankMap.get(b) ?? Number.MAX_SAFE_INTEGER;
  if (aValue !== bValue) return aValue - bValue;

  return a.localeCompare(b);
}

export function sortRowsByOverviewStrength<T>(
  rows: T[],
  getManager: (row: T) => string,
  options: {
    powerRankings?: ReportData['powerRankings'];
    dynastyTimelines?: ReportData['dynastyTimelines'];
    leagueOverview?: ReportData['leagueOverview'];
  }
) {
  return [...rows].sort((a, b) => compareManagersByOverviewStrength(getManager(a), getManager(b), options));
}

export function getStandingRowForManager(
  manager: string,
  standings?: ReportData['currentStandings']
): StandingRow | undefined {
  return (standings || []).find((row) => row.manager === manager);
}
