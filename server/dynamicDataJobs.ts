import fs from 'fs';
import path from 'path';
import { resolvePendingAIPredictionOutcomes } from './aiPredictionOutcomeJob';
import { listLeagueReportCacheEntries } from './db';
import { loadDraftSharksScheduleContext } from './draftSharksSchedule';
import { warmEspnDepthChartsForTeams } from './espnDepthCharts';
import { refreshFantasyProsEndpointSnapshots } from './fantasyProsEndpointSnapshots';
import { buildFantasyProsSourceHealthEvents, checkFantasyProsApiHealth } from './fantasyProsHealth';
import { resolveFantasyProsSnapshotStartWeek } from './fantasyProsSnapshotWindow';
import { loadBlendedKTCValues, loadLatestLocalWeeklyMomentumSnapshot } from './ktcLoader';
import { attachLeagueAiConfidence, persistLeagueAiConfidenceSnapshot } from './leagueAiConfidence';
import { loadPlayerNewsBundle } from './playerNews';
import { loadNflverseDraftCapitalSnapshot } from './nflverseDraftCapital';
import { loadNflversePlayerContext } from './nflversePlayerContext';
import { refreshPlayerPropSnapshots } from './playerPropSnapshots';
import { isAnyProjectionTypeEnabled } from './projectionFeatureFlags';
import { buildProspectLookup, loadProspectContext } from './prospectSource';
import { getCurrentRankingSeason } from './rankingSeason';
import { buildRankingsBoard } from './rankingsBoard';
import { refreshSleeperProjectionSnapshotSet } from './sleeperProjectionSnapshots';
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

function envFlag(name: string): boolean {
  return /^(?:1|true|yes|on)$/i.test(String(process.env[name] || ''));
}

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envOptionalNumber(name: string): number | null {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : null;
}

function includeFantasyProsProjectionSnapshots(): boolean {
  return isAnyProjectionTypeEnabled('fantasypros', [
    'weekly',
    'restOfSeason',
    'preseason',
    'playoffWeeks',
    'positionSpecific',
    'teamDefense',
    'kicker',
    'injuryAdjusted',
  ]);
}

function includeSleeperProjectionSnapshots(): boolean {
  return envFlag('ENABLE_SLEEPER_PROJECTION_SNAPSHOTS') || isAnyProjectionTypeEnabled('sleeper', ['weekly']);
}

async function resolveFantasyProsSnapshotWindow(shouldResolveWeek: boolean) {
  const season = getCurrentRankingSeason();
  const fallbackWeek = envNumber('FANTASYPROS_SNAPSHOT_START_WEEK', 1);
  const forcedStartWeek = envOptionalNumber('FANTASYPROS_SNAPSHOT_FORCE_START_WEEK');
  const currentWeek = forcedStartWeek
    ?? (shouldResolveWeek
      ? await resolveFantasyProsSnapshotStartWeek({
        season,
        fallbackWeek,
      })
      : fallbackWeek);

  return {
    season,
    currentWeek,
    weekWindow: envNumber('FANTASYPROS_SNAPSHOT_WEEK_WINDOW', 3),
  };
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

export async function refreshFantasyProsEndpointSnapshotRefresh(options: {
  force?: boolean;
} = {}) {
  const enabled = envFlag('ENABLE_FANTASYPROS_ENDPOINT_SNAPSHOTS') || options.force === true;
  const expanded = envFlag('ENABLE_FANTASYPROS_EXPANDED_SNAPSHOTS') || envFlag('ENABLE_FANTASYPROS_EXPANDED_HEALTH');
  const snapshotWindow = await resolveFantasyProsSnapshotWindow(expanded);

  if (!enabled) {
    return {
      skipped: true,
      reason: 'ENABLE_FANTASYPROS_ENDPOINT_SNAPSHOTS is not enabled.',
      season: snapshotWindow.season,
      currentWeek: snapshotWindow.currentWeek,
      weekWindow: snapshotWindow.weekWindow,
      results: [] as Awaited<ReturnType<typeof refreshFantasyProsEndpointSnapshots>>,
    };
  }

  const results = await refreshFantasyProsEndpointSnapshots({
    season: snapshotWindow.season,
    scoring: 'PPR',
    includeProjections: includeFantasyProsProjectionSnapshots(),
    includeExpanded: expanded,
    currentWeek: snapshotWindow.currentWeek,
    weekWindow: snapshotWindow.weekWindow,
    requestDelayMs: envNumber('FANTASYPROS_SNAPSHOT_REQUEST_DELAY_MS', envNumber('FANTASYPROS_HEALTH_REQUEST_DELAY_MS', 750)),
    rateLimitRetryAttempts: envNumber('FANTASYPROS_SNAPSHOT_RATE_LIMIT_RETRY_ATTEMPTS', 1),
    rateLimitRetryDelayMs: envNumber('FANTASYPROS_SNAPSHOT_RATE_LIMIT_RETRY_DELAY_MS', 5000),
    stopOnRateLimit: envFlag('FANTASYPROS_SNAPSHOT_STOP_ON_RATE_LIMIT'),
  });

  return {
    skipped: false,
    reason: null,
    season: snapshotWindow.season,
    currentWeek: snapshotWindow.currentWeek,
    weekWindow: snapshotWindow.weekWindow,
    results,
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
  const fantasyProsExpandedHealth = envFlag('ENABLE_FANTASYPROS_EXPANDED_HEALTH');
  const fantasyProsSnapshotWindow = await resolveFantasyProsSnapshotWindow(fantasyProsExpandedHealth);
  const fantasyProsHealthRows = await checkFantasyProsApiHealth({
    season: fantasyProsSnapshotWindow.season,
    scoring: 'PPR',
    includeProjections: includeFantasyProsProjectionSnapshots(),
    includeExpanded: fantasyProsExpandedHealth,
    currentWeek: fantasyProsSnapshotWindow.currentWeek,
    weekWindow: fantasyProsSnapshotWindow.weekWindow,
    requestDelayMs: envNumber('FANTASYPROS_HEALTH_REQUEST_DELAY_MS', 750),
  });
  const fantasyProsEndpointSnapshotRefresh = envFlag('ENABLE_FANTASYPROS_ENDPOINT_SNAPSHOTS_DAILY')
    ? await refreshFantasyProsEndpointSnapshotRefresh()
    : null;
  const fantasyProsEndpointSnapshots = fantasyProsEndpointSnapshotRefresh?.results || [];
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
    fantasyProsEndpointSnapshotCount: fantasyProsEndpointSnapshots.length,
    alertCount: sourceHealthEvents.length + fantasyProsHealthEvents.filter((event) => event.level !== 'info').length,
    sourceHealthStored: sourceHealth.stored,
    fantasyProsEndpointSnapshotRefresh: fantasyProsEndpointSnapshotRefresh
      ? {
        skipped: fantasyProsEndpointSnapshotRefresh.skipped,
        reason: fantasyProsEndpointSnapshotRefresh.reason,
        season: fantasyProsEndpointSnapshotRefresh.season,
        currentWeek: fantasyProsEndpointSnapshotRefresh.currentWeek,
        weekWindow: fantasyProsEndpointSnapshotRefresh.weekWindow,
      }
      : null,
    fantasyProsHealth: fantasyProsHealthRows.map((row) => ({
      key: row.key,
      source: row.label,
      board: row.board,
      status: row.status,
      rowCount: row.rowCount,
      totalExperts: row.totalExperts,
      lastUpdated: row.lastUpdated,
      retryAfterMs: row.retryAfterMs,
      skippedReason: row.skippedReason,
      error: row.error,
    })),
    fantasyProsEndpointSnapshots: fantasyProsEndpointSnapshots.map((row) => ({
      key: row.endpointKey,
      sourceKey: row.sourceKey,
      source: row.endpointLabel,
      board: row.board,
      status: row.status,
      rowCount: row.rowCount,
      totalExperts: row.totalExperts,
      lastUpdated: row.lastUpdated,
      persisted: row.persisted,
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
  const now = new Date();
  const currentSeason = String(now.getFullYear());
  const previousSeason = String(now.getFullYear() - 1);
  const season = options.season || (now.getMonth() >= 8 ? currentSeason : previousSeason);
  const rosterRoomSeason = season === currentSeason ? currentSeason : String(Number(season) + 1);
  const rosterRoomPreviousSeason = season === currentSeason ? previousSeason : season;
  const [playerNews, draftSharksSchedule, depthChartWarmCache, sleeperSeasonStats, sleeperProjectionStats, playerProps, nflverseDraftCapital, nflversePlayerContext] = await Promise.all([
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
    includeSleeperProjectionSnapshots()
      ? refreshSleeperProjectionSnapshotSet({
        season: rosterRoomSeason,
        requestDelayMs: envNumber('SLEEPER_PROJECTION_SNAPSHOT_REQUEST_DELAY_MS', 150),
      })
      : Promise.resolve(null),
    refreshPlayerPropSnapshots(),
    loadNflverseDraftCapitalSnapshot({ persistSnapshot: true, forceRefresh: true }),
    loadNflversePlayerContext({
      season,
      rosterRoomSeason,
      rosterRoomPreviousSeason,
      persistSnapshot: true,
      forceRefresh: true,
    }),
  ]);

  return {
    playerNewsCount: playerNews.sourceCounts.total,
    fantasyProsNewsCount: playerNews.sourceCounts.fantasyPros,
    sportsDataIoNewsCount: playerNews.sourceCounts.sportsDataIo,
    draftSharksStatus: draftSharksSchedule.status,
    draftSharksProfileCount: Object.keys(draftSharksSchedule.profiles || {}).length,
    depthChartWarmCache,
    sleeperSeasonStats,
    sleeperProjectionStats,
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
    aiPredictionOutcomeResolution?: Awaited<ReturnType<typeof resolvePendingAIPredictionOutcomes>>;
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

  try {
    result.aiPredictionOutcomeResolution = await resolvePendingAIPredictionOutcomes({
      limit: options.backfillLimit || 100,
    });
    if (!result.aiPredictionOutcomeResolution.ok) {
      result.ok = false;
      result.errors.push('AI prediction outcome resolution completed with unresolved errors.');
    }
  } catch (error) {
    result.ok = false;
    result.errors.push(`AI prediction outcome resolution: ${getErrorMessage(error)}`);
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
