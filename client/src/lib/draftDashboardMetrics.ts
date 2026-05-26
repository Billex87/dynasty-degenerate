import type { ReportData } from '@shared/types';
import { getDraftKind } from './draftDisplay';
import { normalizeLeagueValueMode, type LeagueValueMode } from './leagueValueMode';

type DraftSignalPick = NonNullable<ReportData['draftPicks']>[number];
type DraftSignalReportData = Pick<ReportData, 'draftPicks' | 'leagueDiagnostics' | 'leagueValueMode'>;

export interface DraftSignalManagerStats {
  manager: string;
  managerDisplayName?: string;
  totalPicks: number;
  avgAdpDiff: number;
  avgKtcGain: number;
  bestPick: DraftSignalPick | null;
  worstPick: DraftSignalPick | null;
  hits: number;
  misses: number;
  starters: number;
  valuePickCount: number;
  totalAdpValue: number;
  adpValuePickCount: number;
  totalAdpReach: number;
  adpReachPickCount: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getSignalMode(reportData: DraftSignalReportData, modeInput?: LeagueValueMode | string | null): LeagueValueMode {
  return normalizeLeagueValueMode(
    modeInput || reportData.leagueDiagnostics?.valueMode || reportData.leagueValueMode
  );
}

export function getDraftSignalPicks(
  reportData: DraftSignalReportData,
  modeInput?: LeagueValueMode | string | null
): DraftSignalPick[] {
  const mode = getSignalMode(reportData, modeInput);
  const signalKind = mode === 'redraft' ? 'main' : 'rookie';

  return (reportData.draftPicks || []).filter(
    (pick) => getDraftKind(pick, mode) === signalKind
  );
}

export function buildDraftSignalManagerStats(
  reportData: DraftSignalReportData,
  modeInput?: LeagueValueMode | string | null
): DraftSignalManagerStats[] {
  const statsByManager = new Map<
    string,
    DraftSignalManagerStats & {
      adpPickCount: number;
      totalAdpDiff: number;
      totalKtcGain: number;
      totalAdpValue: number;
      adpValuePickCount: number;
      totalAdpReach: number;
      adpReachPickCount: number;
    }
  >();

  getDraftSignalPicks(reportData, modeInput).forEach((pick) => {
    const manager = pick.manager || pick.managerDisplayName || 'Unknown';
    const stats =
      statsByManager.get(manager) ||
      {
        manager,
        managerDisplayName: pick.managerDisplayName || manager,
        totalPicks: 0,
        avgAdpDiff: 0,
        avgKtcGain: 0,
        bestPick: null,
        worstPick: null,
        hits: 0,
        misses: 0,
        starters: 0,
        valuePickCount: 0,
        totalAdpValue: 0,
        adpValuePickCount: 0,
        totalAdpReach: 0,
        adpReachPickCount: 0,
        adpPickCount: 0,
        totalAdpDiff: 0,
        totalKtcGain: 0,
      };

    stats.totalPicks += 1;

    if (isFiniteNumber(pick.adp) && isFiniteNumber(pick.pick)) {
      const adpDiff = pick.pick - pick.adp;
      stats.adpPickCount += 1;
      stats.totalAdpDiff += adpDiff;
      if (adpDiff > 0) {
        stats.totalAdpValue += adpDiff;
        stats.adpValuePickCount += 1;
      } else if (adpDiff < 0) {
        stats.totalAdpReach += Math.abs(adpDiff);
        stats.adpReachPickCount += 1;
      }
    }

    if (isFiniteNumber(pick.valueGain)) {
      stats.valuePickCount += 1;
      stats.totalKtcGain += pick.valueGain;

      if (!stats.bestPick || pick.valueGain > (stats.bestPick.valueGain ?? -Infinity)) {
        stats.bestPick = pick;
      }
      if (!stats.worstPick || pick.valueGain < (stats.worstPick.valueGain ?? Infinity)) {
        stats.worstPick = pick;
      }
    }

    if (pick.isStarter) stats.starters += 1;
    if (pick.draftOutcome === 'hit') stats.hits += 1;
    if (pick.draftOutcome === 'miss') stats.misses += 1;

    statsByManager.set(manager, stats);
  });

  return Array.from(statsByManager.values())
    .map(({ totalAdpDiff, totalKtcGain, adpPickCount, ...stats }) => ({
      ...stats,
      avgAdpDiff: adpPickCount ? Math.round((totalAdpDiff / adpPickCount) * 10) / 10 : 0,
      avgKtcGain: stats.valuePickCount ? Math.round(totalKtcGain / stats.valuePickCount) : 0,
    }))
    .sort((a, b) => b.avgKtcGain - a.avgKtcGain);
}

export function getBestDraftSignalManager(
  reportData: DraftSignalReportData,
  modeInput?: LeagueValueMode | string | null
): DraftSignalManagerStats | null {
  return (
    buildDraftSignalManagerStats(reportData, modeInput).filter((stats) => stats.valuePickCount > 0)[0] ||
    null
  );
}

export function getWorstDraftSignalManager(
  reportData: DraftSignalReportData,
  modeInput?: LeagueValueMode | string | null
): DraftSignalManagerStats | null {
  return (
    buildDraftSignalManagerStats(reportData, modeInput)
      .filter((stats) => stats.valuePickCount > 0)
      .sort((a, b) => a.avgKtcGain - b.avgKtcGain)[0] || null
  );
}

export function getBestDraftAdpValueManager(
  reportData: DraftSignalReportData,
  modeInput?: LeagueValueMode | string | null
): DraftSignalManagerStats | null {
  return (
    buildDraftSignalManagerStats(reportData, modeInput)
      .filter((stats) => stats.totalAdpValue > 0)
      .sort(
        (a, b) =>
          b.totalAdpValue - a.totalAdpValue ||
          b.adpValuePickCount - a.adpValuePickCount ||
          b.avgKtcGain - a.avgKtcGain
      )[0] || null
  );
}

export function getWorstDraftAdpValueManager(
  reportData: DraftSignalReportData,
  modeInput?: LeagueValueMode | string | null
): DraftSignalManagerStats | null {
  return (
    buildDraftSignalManagerStats(reportData, modeInput)
      .filter((stats) => stats.totalAdpReach > 0)
      .sort(
        (a, b) =>
          b.totalAdpReach - a.totalAdpReach ||
          b.adpReachPickCount - a.adpReachPickCount ||
          a.avgKtcGain - b.avgKtcGain
      )[0] || null
  );
}
