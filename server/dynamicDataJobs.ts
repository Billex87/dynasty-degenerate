import fs from 'fs';
import path from 'path';
import { listLeagueReportCacheEntries } from './db';
import { loadDraftSharksScheduleContext } from './draftSharksSchedule';
import { warmEspnDepthChartsForTeams } from './espnDepthCharts';
import { buildFantasyProsSourceHealthEvents, checkFantasyProsApiHealth } from './fantasyProsHealth';
import { loadBlendedKTCValues, loadLatestLocalWeeklyMomentumSnapshot } from './ktcLoader';
import { attachLeagueAiConfidence, persistLeagueAiConfidenceSnapshot } from './leagueAiConfidence';
import { loadPlayerNewsBundle } from './playerNews';
import { loadNflverseDraftCapitalSnapshot } from './nflverseDraftCapital';
import { loadNflversePlayerContext } from './nflversePlayerContext';
import { refreshPlayerPropSnapshots } from './playerPropSnapshots';
import { buildProspectLookup, loadProspectContext } from './prospectSource';
import { buildRankingsBoard } from './rankingsBoard';
import { refreshSleeperSeasonStatsSnapshots } from './sleeperSeasonStats';
import { buildSourceHealthEvents, recordSourceHealthEvents } from './sourceHealth';
import { getValueSourceProfileKey, getValueSourceProfileLabel, type ValueBlendOptions } from './valueBlend';
import type { RankingSourceDiagnostic, ReportData } from '../shared/types';

const LEAGUE_REPORT_FILE_CACHE_DIR = path.join(process.cwd(), '.cache', 'league-reports');
const DEFAULT_REFRESH_VALUE_OPTIONS: ValueBlendOptions = {
  numQbs: 2,
  numTeams: 12,
  ppr: 1,
  tep: 0,
};

type CachedReportEntry = {
  cacheKey: string;
  leagueId: string;
  payload: unknown;
  updatedAt: Date;
};

type CachedReportDataWithDiagnostics = ReportData & {
  leagueDiagnostics: NonNullable<ReportData['leagueDiagnostics']>;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function extractCachedReport(payload: unknown): { leagueId: string; reportData: CachedReportDataWithDiagnostics } | null {
  if (!isRecord(payload)) return null;
  const leagueId = typeof payload.leagueId === 'string' ? payload.leagueId : null;
  const reportData = isRecord(payload.reportData) ? payload.reportData as ReportData : null;
  if (!leagueId || !reportData?.leagueDiagnostics) return null;
  return { leagueId, reportData: reportData as CachedReportDataWithDiagnostics };
}

export function collectDepthChartWarmTeamsFromReportData(reportData: ReportData): string[] {
  const teams = new Set<string>();
  const addTeam = (team: unknown) => {
    if (typeof team === 'string' && team.trim()) teams.add(team.trim().toUpperCase());
  };

  Object.values(reportData.playerDetailsById || {}).forEach((details) => addTeam(details?.team));
  [
    ...(reportData.weeklyRisers || []),
    ...(reportData.weeklyFallers || []),
    ...(reportData.trendingAdds || []),
    ...(reportData.trendingDrops || []),
  ].forEach((player) => {
    const playerRecord = player as unknown as Record<string, unknown>;
    addTeam(playerRecord.team);
    addTeam(player.playerDetails?.team);
  });
  (reportData.recentTransactions || []).forEach((transaction) => {
    addTeam(transaction.addedPlayer?.team);
    addTeam(transaction.addedPlayer?.playerDetails?.team);
    addTeam(transaction.droppedPlayer?.team);
    addTeam(transaction.droppedPlayer?.playerDetails?.team);
    addTeam(transaction.alternativeDrop?.team);
    addTeam(transaction.alternativeDrop?.playerDetails?.team);
  });
  if (reportData.waiverIntelligence) {
    [
      ...reportData.waiverIntelligence.availableTrendingAdds,
      ...reportData.waiverIntelligence.rosteredTrendingAdds,
      ...reportData.waiverIntelligence.bestTaxiStashes,
      ...reportData.waiverIntelligence.recentlyDroppedValuable,
      reportData.waiverIntelligence.highestKtcAvailable,
      ...Object.values(reportData.waiverIntelligence.bestAvailableByPosition),
    ].forEach((player) => {
      if (!player) return;
      addTeam(player.team);
      addTeam(player.playerDetails?.team);
    });
  }

  return Array.from(teams).sort();
}

function readLocalLeagueReportCacheEntries(limit: number): CachedReportEntry[] {
  try {
    if (!fs.existsSync(LEAGUE_REPORT_FILE_CACHE_DIR)) return [];
    return fs.readdirSync(LEAGUE_REPORT_FILE_CACHE_DIR)
      .filter((fileName) => fileName.endsWith('.json'))
      .map((fileName) => {
        const filePath = path.join(LEAGUE_REPORT_FILE_CACHE_DIR, fileName);
        const stats = fs.statSync(filePath);
        return { fileName, filePath, updatedAt: new Date(stats.mtimeMs) };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
      .map((entry) => {
        const payload = JSON.parse(fs.readFileSync(entry.filePath, 'utf8'));
        const extracted = extractCachedReport(payload);
        return extracted
          ? {
            cacheKey: entry.fileName.replace(/\.json$/, ''),
            leagueId: extracted.leagueId,
            payload,
            updatedAt: entry.updatedAt,
          }
          : null;
      })
      .filter((entry): entry is CachedReportEntry => Boolean(entry));
  } catch (error) {
    console.warn('[DynamicDataJobs] Failed to read local league report cache:', error);
    return [];
  }
}

async function loadCachedReportEntries(limit: number): Promise<CachedReportEntry[]> {
  const entriesByKey = new Map<string, CachedReportEntry>();

  try {
    for (const entry of await listLeagueReportCacheEntries(limit)) {
      entriesByKey.set(entry.cacheKey, {
        cacheKey: entry.cacheKey,
        leagueId: entry.leagueId,
        payload: entry.payload,
        updatedAt: entry.updatedAt,
      });
    }
  } catch (error) {
    console.warn('[DynamicDataJobs] Failed to load database league report cache entries:', error);
  }

  for (const entry of readLocalLeagueReportCacheEntries(limit)) {
    if (!entriesByKey.has(entry.cacheKey)) entriesByKey.set(entry.cacheKey, entry);
  }

  return Array.from(entriesByKey.values())
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export async function backfillLeagueAiConfidenceSnapshots(options: {
  limit?: number;
} = {}) {
  const limit = Math.max(1, Math.min(1000, Math.floor(options.limit || 100)));
  const entries = await loadCachedReportEntries(limit);
  let scanned = 0;
  let backfilled = 0;
  let skipped = 0;

  for (const entry of entries) {
    scanned += 1;
    const extracted = extractCachedReport(entry.payload);
    if (!extracted) {
      skipped += 1;
      continue;
    }

    const reportData = extracted.reportData.leagueDiagnostics.aiConfidence
      ? extracted.reportData
      : attachLeagueAiConfidence(extracted.reportData);
    const confidence = reportData.leagueDiagnostics?.aiConfidence || null;
    if (!confidence) {
      skipped += 1;
      continue;
    }

    const persisted = await persistLeagueAiConfidenceSnapshot({
      leagueId: extracted.leagueId,
      confidence,
      snapshotDate: entry.updatedAt,
      generatedAt: entry.updatedAt.toISOString(),
    });
    if (persisted) {
      backfilled += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    scanned,
    backfilled,
    skipped,
  };
}

function getCachedReportSourceDiagnostics(reportData: ReportData): RankingSourceDiagnostic[] {
  return [
    ...(reportData.rankings?.dynastySourceDiagnostics || []),
    ...(reportData.rankings?.redraftSourceDiagnostics || []),
    ...(reportData.rankings?.devySourceDiagnostics || []),
  ];
}

export async function backfillSourceHealthFromCachedReports(options: {
  limit?: number;
} = {}) {
  const limit = Math.max(1, Math.min(1000, Math.floor(options.limit || 100)));
  const entries = await loadCachedReportEntries(limit);
  let scanned = 0;
  let backfilled = 0;
  let skipped = 0;
  let alertCount = 0;

  for (const entry of entries) {
    scanned += 1;
    const extracted = extractCachedReport(entry.payload);
    if (!extracted) {
      skipped += 1;
      continue;
    }

    const diagnostics = getCachedReportSourceDiagnostics(extracted.reportData);
    if (!diagnostics.length) {
      skipped += 1;
      continue;
    }

    const sourceHealthEvents = buildSourceHealthEvents({
      job: 'cached-report-source-backfill',
      diagnostics,
    }).map((event) => ({
      ...event,
      createdAt: entry.updatedAt,
      payload: {
        ...(isRecord(event.payload) ? event.payload : {}),
        leagueId: extracted.leagueId,
        cacheKey: entry.cacheKey,
        cacheUpdatedAt: entry.updatedAt.toISOString(),
      },
    }));

    if (!sourceHealthEvents.length) {
      skipped += 1;
      continue;
    }

    const sourceHealth = await recordSourceHealthEvents(sourceHealthEvents);
    alertCount += sourceHealthEvents.length;
    if (sourceHealth.stored) {
      backfilled += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    scanned,
    backfilled,
    skipped,
    alertCount,
  };
}

export async function refreshRankingSourceSnapshots() {
  const valueProfileKey = getValueSourceProfileKey(DEFAULT_REFRESH_VALUE_OPTIONS);
  const [prospectContext, ktcValues] = await Promise.all([
    loadProspectContext(),
    loadBlendedKTCValues(DEFAULT_REFRESH_VALUE_OPTIONS),
  ]);
  const baselineKtcValues = loadLatestLocalWeeklyMomentumSnapshot(valueProfileKey);
  const rankings = await buildRankingsBoard({
    players: {},
    ktcValues,
    baselineKtcValues,
    ownerByPlayerId: {},
    rosterStatusByPlayerId: {},
    selectedProfileKey: valueProfileKey,
    selectedProfileLabel: getValueSourceProfileLabel(DEFAULT_REFRESH_VALUE_OPTIONS),
    prospectLookup: buildProspectLookup(prospectContext.profiles),
    prospectProfiles: prospectContext.profiles,
    leagueTeamCount: 12,
  });
  const diagnostics: RankingSourceDiagnostic[] = [
    ...(rankings.dynastySourceDiagnostics || []),
    ...(rankings.redraftSourceDiagnostics || []),
    ...(rankings.devySourceDiagnostics || []),
  ];
  const sourceHealthEvents = buildSourceHealthEvents({
    job: 'dynamic-data-refresh',
    diagnostics,
  });
  const fantasyProsHealthRows = await checkFantasyProsApiHealth({
    season: String(new Date().getFullYear()),
    scoring: 'PPR',
    includeProjections: /^(?:1|true|yes|on)$/i.test(String(process.env.ENABLE_FANTASYPROS_PROJECTIONS || '')),
  });
  const fantasyProsHealthEvents = buildFantasyProsSourceHealthEvents(fantasyProsHealthRows);
  const sourceHealth = await recordSourceHealthEvents([
    ...sourceHealthEvents,
    ...fantasyProsHealthEvents,
  ]);

  return {
    generatedAt: rankings.generatedAt,
    profileKey: valueProfileKey,
    diagnosticCount: diagnostics.length,
    fantasyProsEndpointCount: fantasyProsHealthRows.length,
    alertCount: sourceHealthEvents.length + fantasyProsHealthEvents.filter((event) => event.level !== 'info').length,
    sourceHealthStored: sourceHealth.stored,
    fantasyProsHealth: fantasyProsHealthRows.map((row) => ({
      key: row.key,
      source: row.label,
      board: row.board,
      status: row.status,
      rowCount: row.rowCount,
      totalExperts: row.totalExperts,
      lastUpdated: row.lastUpdated,
      error: row.error,
    })),
    diagnostics: diagnostics.map((diagnostic) => ({
      key: diagnostic.key,
      source: diagnostic.source,
      board: diagnostic.board,
      status: diagnostic.status,
      rowCount: diagnostic.rowCount,
      trustScore: diagnostic.trustScore ?? null,
      alert: diagnostic.trustAlert ?? null,
    })),
  };
}

export async function warmDepthChartCacheFromCachedReports(options: {
  limit?: number;
} = {}) {
  const limit = Math.max(1, Math.min(1000, Math.floor(options.limit || 100)));
  const entries = await loadCachedReportEntries(limit);
  const teams = new Set<string>();
  let scanned = 0;

  for (const entry of entries) {
    const extracted = extractCachedReport(entry.payload);
    if (!extracted) continue;
    scanned += 1;
    collectDepthChartWarmTeamsFromReportData(extracted.reportData).forEach((team) => teams.add(team));
  }

  const warmResult = await warmEspnDepthChartsForTeams(teams);
  return {
    scannedReports: scanned,
    requestedTeams: warmResult.requestedTeams,
    loadedTeams: warmResult.loadedTeams,
    failedTeams: warmResult.failedTeams,
    durationMs: warmResult.durationMs,
    generatedAt: warmResult.generatedAt,
  };
}

export async function refreshReportEnrichmentSnapshots(options: {
  backfillLimit?: number;
  season?: string;
} = {}) {
  const season = options.season || String(new Date().getFullYear() - 1);
  const [playerNews, draftSharksSchedule, depthChartWarmCache, sleeperSeasonStats, playerProps, nflverseDraftCapital, nflversePlayerContext] = await Promise.all([
    loadPlayerNewsBundle({ persistSnapshot: true, forceRefresh: true }),
    loadDraftSharksScheduleContext({
      season: String(new Date().getFullYear()),
      persistSnapshot: true,
      forceRefresh: true,
    }),
    warmDepthChartCacheFromCachedReports({
      limit: options.backfillLimit || 100,
    }),
    refreshSleeperSeasonStatsSnapshots(),
    refreshPlayerPropSnapshots(),
    loadNflverseDraftCapitalSnapshot({ persistSnapshot: true, forceRefresh: true }),
    loadNflversePlayerContext({ season, persistSnapshot: true, forceRefresh: true }),
  ]);

  return {
    playerNewsCount: playerNews.sourceCounts.total,
    fantasyProsNewsCount: playerNews.sourceCounts.fantasyPros,
    sportsDataIoNewsCount: playerNews.sourceCounts.sportsDataIo,
    draftSharksStatus: draftSharksSchedule.status,
    draftSharksProfileCount: Object.keys(draftSharksSchedule.profiles || {}).length,
    depthChartWarmCache,
    sleeperSeasonStats,
    playerProps,
    nflverseDraftCapitalRows: nflverseDraftCapital.rowCount,
    nflversePlayerContextRows: Object.fromEntries(nflversePlayerContext.rowCounts.map((row) => [row.sourceKey, row.rowCount])),
  };
}

export async function runDynamicDataRefresh(options: {
  backfillLimit?: number;
} = {}) {
  const startedAt = Date.now();
  const result: {
    ok: boolean;
    durationMs: number;
    sourceRefresh?: Awaited<ReturnType<typeof refreshRankingSourceSnapshots>>;
    enrichmentRefresh?: Awaited<ReturnType<typeof refreshReportEnrichmentSnapshots>>;
    confidenceBackfill?: Awaited<ReturnType<typeof backfillLeagueAiConfidenceSnapshots>>;
    sourceHealthBackfill?: Awaited<ReturnType<typeof backfillSourceHealthFromCachedReports>>;
    errors: string[];
  } = {
    ok: true,
    durationMs: 0,
    errors: [],
  };

  try {
    result.sourceRefresh = await refreshRankingSourceSnapshots();
  } catch (error) {
    result.ok = false;
    result.errors.push(`source refresh: ${getErrorMessage(error)}`);
    await recordSourceHealthEvents([{
      job: 'dynamic-data-refresh',
      board: null,
      sourceKey: 'dynamicDataRefresh',
      source: 'Dynamic Data Refresh',
      level: 'danger',
      status: 'error',
      rowCount: null,
      message: getErrorMessage(error),
    }]);
  }

  try {
    result.enrichmentRefresh = await refreshReportEnrichmentSnapshots({
      backfillLimit: options.backfillLimit || 100,
    });
  } catch (error) {
    result.ok = false;
    result.errors.push(`enrichment refresh: ${getErrorMessage(error)}`);
  }

  try {
    result.confidenceBackfill = await backfillLeagueAiConfidenceSnapshots({
      limit: options.backfillLimit || 100,
    });
  } catch (error) {
    result.ok = false;
    result.errors.push(`confidence backfill: ${getErrorMessage(error)}`);
  }

  if (/^(?:1|true|yes|on)$/i.test(String(process.env.ENABLE_SOURCE_HEALTH_BACKFILL || ''))) {
    try {
      result.sourceHealthBackfill = await backfillSourceHealthFromCachedReports({
        limit: options.backfillLimit || 100,
      });
    } catch (error) {
      result.ok = false;
      result.errors.push(`source health backfill: ${getErrorMessage(error)}`);
    }
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}
