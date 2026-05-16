import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findLeagueReportCache: vi.fn(),
  upsertLeagueReportCache: vi.fn(),
  loadDraftSharksScheduleContext: vi.fn(),
  loadPlayerNewsBundle: vi.fn(),
  loadKTCValuesLastWeek: vi.fn(),
  loadLatestLocalWeeklyMomentumSnapshot: vi.fn(),
  loadBlendedKTCValues: vi.fn(),
  getKtcSnapshotFromDaysAgo: vi.fn(),
  getLeagueReportCacheTtlMs: vi.fn(),
  getUserLoadSnapshotOptions: vi.fn(),
  loadProspectContext: vi.fn(),
}));

vi.mock('./db', () => ({
  findLeagueReportCache: mocks.findLeagueReportCache,
  upsertLeagueReportCache: mocks.upsertLeagueReportCache,
}));

vi.mock('./draftSharksSchedule', () => ({
  loadDraftSharksScheduleContext: mocks.loadDraftSharksScheduleContext,
}));

vi.mock('./playerNews', () => ({
  loadPlayerNewsBundle: mocks.loadPlayerNewsBundle,
}));

vi.mock('./ktcLoader', () => ({
  loadKTCValuesLastWeek: mocks.loadKTCValuesLastWeek,
  loadLatestLocalWeeklyMomentumSnapshot: mocks.loadLatestLocalWeeklyMomentumSnapshot,
  loadBlendedKTCValues: mocks.loadBlendedKTCValues,
}));

vi.mock('./ktcSnapshotJob', () => ({
  getKtcSnapshotFromDaysAgo: mocks.getKtcSnapshotFromDaysAgo,
}));

vi.mock('./leagueReportCachePolicy', () => ({
  getLeagueReportCacheTtlMs: mocks.getLeagueReportCacheTtlMs,
}));

vi.mock('./loadTimeProviderPolicy', () => ({
  getUserLoadSnapshotOptions: mocks.getUserLoadSnapshotOptions,
}));

vi.mock('./prospectSource', () => ({
  loadProspectContext: mocks.loadProspectContext,
}));

import {
  getReportStaticInputsCacheKey,
  isReportStaticInputsPayload,
  loadReportStaticInputs,
} from './reportStaticInputs';

const input = {
  leagueId: 'league-1',
  leagueValueOptions: { sourceProfile: 'fantasycalc' } as any,
  leagueValueProfileKey: '12_sf_ppr_base',
  currentSeason: '2026',
  lastCompletedSeason: '2025',
};

const cachedPayload = {
  cacheKey: 'league-report-static-inputs-v2:12_sf_ppr_base:2026:2025',
  generatedAt: '2026-05-15T00:00:00.000Z',
  ktcValues: { cached: { value: 100 } },
  ktcValuesLastWeek: { cached: { value: 90 } },
  draftSharksScheduleContext: { source: 'cached-schedule' },
  prospectContext: { profiles: [] },
  playerNews: [],
  newsSourceCounts: { total: 0, fantasyPros: 0, sportsDataIo: 0 },
};

describe('report static inputs cache loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findLeagueReportCache.mockResolvedValue(null);
    mocks.upsertLeagueReportCache.mockResolvedValue(undefined);
    mocks.loadDraftSharksScheduleContext.mockResolvedValue({ source: 'fresh-schedule' });
    mocks.loadPlayerNewsBundle.mockResolvedValue({
      items: [{ playerName: 'A Player' }],
      sourceCounts: { total: 1, fantasyPros: 0, sportsDataIo: 1 },
    });
    mocks.loadKTCValuesLastWeek.mockResolvedValue({ fallback: { value: 70 } });
    mocks.loadLatestLocalWeeklyMomentumSnapshot.mockReturnValue({});
    mocks.loadBlendedKTCValues.mockResolvedValue({ fresh: { value: 110 } });
    mocks.getKtcSnapshotFromDaysAgo.mockResolvedValue({ fresh: { value: 95 } });
    mocks.getLeagueReportCacheTtlMs.mockReturnValue(12 * 60 * 60 * 1000);
    mocks.getUserLoadSnapshotOptions.mockReturnValue({ sourceMode: 'snapshot' });
    mocks.loadProspectContext.mockResolvedValue({ profiles: [{ playerId: '1' }] });
  });

  it('returns a fresh cached payload without calling snapshot loaders', async () => {
    mocks.findLeagueReportCache.mockResolvedValue(cachedPayload);

    const result = await loadReportStaticInputs(input);

    expect(result).toEqual({ ...cachedPayload, cacheStatus: 'hit' });
    expect(mocks.findLeagueReportCache).toHaveBeenCalledWith(cachedPayload.cacheKey, 12 * 60 * 60 * 1000);
    expect(mocks.loadBlendedKTCValues).not.toHaveBeenCalled();
    expect(mocks.loadDraftSharksScheduleContext).not.toHaveBeenCalled();
    expect(mocks.loadPlayerNewsBundle).not.toHaveBeenCalled();
    expect(mocks.loadProspectContext).not.toHaveBeenCalled();
    expect(mocks.upsertLeagueReportCache).not.toHaveBeenCalled();
  });

  it('loads and stores static inputs when the cache misses', async () => {
    const result = await loadReportStaticInputs(input);

    expect(result.cacheStatus).toBe('miss');
    expect(result.cacheKey).toBe(cachedPayload.cacheKey);
    expect(result.ktcValues).toEqual({ fresh: { value: 110 } });
    expect(result.ktcValuesLastWeek).toEqual({ fresh: { value: 95 } });
    expect(mocks.loadBlendedKTCValues).toHaveBeenCalledWith(input.leagueValueOptions, { sourceMode: 'snapshot' });
    expect(mocks.loadDraftSharksScheduleContext).toHaveBeenCalledWith({
      season: '2026',
      sourceMode: 'snapshot',
    });
    expect(mocks.loadPlayerNewsBundle).toHaveBeenCalledWith({ sourceMode: 'snapshot' });
    expect(mocks.upsertLeagueReportCache).toHaveBeenCalledWith({
      cacheKey: cachedPayload.cacheKey,
      leagueId: 'league-1',
      viewerUserId: null,
      payload: expect.objectContaining({
        cacheKey: cachedPayload.cacheKey,
        ktcValues: { fresh: { value: 110 } },
        ktcValuesLastWeek: { fresh: { value: 95 } },
      }),
    });
  });

  it('bypasses the cached row when force refresh is requested', async () => {
    mocks.findLeagueReportCache.mockResolvedValue(cachedPayload);

    const result = await loadReportStaticInputs({ ...input, forceRefresh: true });

    expect(result.cacheStatus).toBe('miss');
    expect(mocks.findLeagueReportCache).not.toHaveBeenCalled();
    expect(mocks.loadBlendedKTCValues).toHaveBeenCalled();
    expect(mocks.upsertLeagueReportCache).toHaveBeenCalled();
  });
});

describe('report static inputs', () => {
  it('keys static inputs by value profile and season window', () => {
    expect(getReportStaticInputsCacheKey({
      leagueValueProfileKey: '12_sf_ppr_base',
      currentSeason: '2026',
      lastCompletedSeason: '2025',
    })).toBe('league-report-static-inputs-v2:12_sf_ppr_base:2026:2025');
  });

  it('accepts only payloads with the static snapshot-backed inputs', () => {
    expect(isReportStaticInputsPayload({
      cacheKey: 'league-report-static-inputs-v2:12_sf_ppr_base:2026:2025',
      generatedAt: '2026-05-15T00:00:00.000Z',
      ktcValues: {},
      ktcValuesLastWeek: {},
      draftSharksScheduleContext: {},
      prospectContext: {},
      playerNews: [],
      newsSourceCounts: { total: 0, fantasyPros: 0, sportsDataIo: 0 },
    })).toBe(true);

    expect(isReportStaticInputsPayload({
      cacheKey: 'league-report-static-inputs-v2:12_sf_ppr_base:2026:2025',
      generatedAt: '2026-05-15T00:00:00.000Z',
      reportData: { leagueOverview: [] },
    })).toBe(false);
  });
});
