import { findLeagueReportCache, upsertLeagueReportCache } from './db';
import { loadDraftSharksScheduleContext } from './draftSharksSchedule';
import { loadKTCValuesLastWeek, loadLatestLocalWeeklyMomentumSnapshot, loadBlendedKTCValues } from './ktcLoader';
import { getKtcSnapshotFromDaysAgo } from './ktcSnapshotJob';
import { getLeagueReportCacheTtlMs } from './leagueReportCachePolicy';
import { getUserLoadSnapshotOptions } from './loadTimeProviderPolicy';
import { loadPlayerNewsBundle, type PlayerNewsSourceCounts } from './playerNews';
import { loadProspectContext } from './prospectSource';
import type { KTCValues } from './reportGenerator';
import type { ValueBlendOptions } from './valueBlend';

const REPORT_STATIC_INPUTS_CACHE_VERSION = 'league-report-static-inputs-v2';

export type ReportStaticInputs = {
  cacheKey: string;
  cacheStatus: 'hit' | 'miss';
  generatedAt: string;
  ktcValues: KTCValues;
  ktcValuesLastWeek: KTCValues;
  draftSharksScheduleContext: Awaited<ReturnType<typeof loadDraftSharksScheduleContext>>;
  prospectContext: Awaited<ReturnType<typeof loadProspectContext>>;
  playerNews: Awaited<ReturnType<typeof loadPlayerNewsBundle>>['items'];
  newsSourceCounts: PlayerNewsSourceCounts;
};

export function getReportStaticInputsCacheKey(input: {
  leagueValueProfileKey: string;
  currentSeason: string;
  lastCompletedSeason: string;
}): string {
  return [
    REPORT_STATIC_INPUTS_CACHE_VERSION,
    input.leagueValueProfileKey || 'default',
    input.currentSeason || 'current',
    input.lastCompletedSeason || 'previous',
  ].join(':');
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function isReportStaticInputsPayload(value: unknown): value is Omit<ReportStaticInputs, 'cacheStatus'> {
  return Boolean(
    isRecord(value) &&
    typeof value.cacheKey === 'string' &&
    typeof value.generatedAt === 'string' &&
    isRecord(value.ktcValues) &&
    isRecord(value.ktcValuesLastWeek) &&
    isRecord(value.draftSharksScheduleContext) &&
    isRecord(value.prospectContext) &&
    Array.isArray(value.playerNews) &&
    isRecord(value.newsSourceCounts)
  );
}

async function loadWeeklyBaselineValues(leagueValueProfileKey: string): Promise<KTCValues> {
  const ktcValuesLastWeekRaw = await getKtcSnapshotFromDaysAgo(7, leagueValueProfileKey);
  if (ktcValuesLastWeekRaw && Object.keys(ktcValuesLastWeekRaw).length > 0) {
    return ktcValuesLastWeekRaw;
  }

  const localWeeklyMomentumSnapshot = loadLatestLocalWeeklyMomentumSnapshot(leagueValueProfileKey);
  if (Object.keys(localWeeklyMomentumSnapshot).length > 0) {
    return localWeeklyMomentumSnapshot;
  }

  return loadKTCValuesLastWeek();
}

export async function loadReportStaticInputs(input: {
  leagueId: string;
  leagueValueOptions: ValueBlendOptions;
  leagueValueProfileKey: string;
  currentSeason: string;
  lastCompletedSeason: string;
  forceRefresh?: boolean;
}): Promise<ReportStaticInputs> {
  const cacheKey = getReportStaticInputsCacheKey(input);

  if (!input.forceRefresh) {
    const cached = await findLeagueReportCache(cacheKey, getLeagueReportCacheTtlMs());
    if (isReportStaticInputsPayload(cached)) {
      return {
        ...cached,
        cacheStatus: 'hit',
      };
    }
  }

  const [
    ktcValues,
    ktcValuesLastWeek,
    draftSharksScheduleContext,
    prospectContext,
    playerNewsBundle,
  ] = await Promise.all([
    loadBlendedKTCValues(input.leagueValueOptions, getUserLoadSnapshotOptions()),
    loadWeeklyBaselineValues(input.leagueValueProfileKey),
    loadDraftSharksScheduleContext({
      season: input.currentSeason,
      ...getUserLoadSnapshotOptions(),
    }),
    loadProspectContext(),
    loadPlayerNewsBundle(getUserLoadSnapshotOptions()),
  ]);

  const payload: Omit<ReportStaticInputs, 'cacheStatus'> = {
    cacheKey,
    generatedAt: new Date().toISOString(),
    ktcValues,
    ktcValuesLastWeek,
    draftSharksScheduleContext,
    prospectContext,
    playerNews: playerNewsBundle.items,
    newsSourceCounts: playerNewsBundle.sourceCounts,
  };

  await upsertLeagueReportCache({
    cacheKey,
    leagueId: input.leagueId,
    viewerUserId: null,
    payload,
  });

  return {
    ...payload,
    cacheStatus: 'miss',
  };
}
