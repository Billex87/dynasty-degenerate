import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findLeagueReportCache: vi.fn(),
  upsertLeagueReportCache: vi.fn(),
  getLeagueReportCacheTtlMs: vi.fn(),
  loadSourceSnapshotFreshnessDiagnostics: vi.fn(),
}));

vi.mock('./db', () => ({
  findLeagueReportCache: mocks.findLeagueReportCache,
  upsertLeagueReportCache: mocks.upsertLeagueReportCache,
}));

vi.mock('./leagueReportCachePolicy', () => ({
  getLeagueReportCacheTtlMs: mocks.getLeagueReportCacheTtlMs,
}));

vi.mock('./sourceSnapshotFreshness', () => ({
  loadSourceSnapshotFreshnessDiagnostics: mocks.loadSourceSnapshotFreshnessDiagnostics,
}));

import {
  getReportSourceDiagnosticsCacheKey,
  getReportStaticSectionsCacheKey,
  isReportSourceDiagnosticsPayload,
  isReportStaticSectionsPayload,
  loadReportSourceDiagnosticsSection,
  loadReportStaticSections,
} from './reportStaticSections';

const baseInput = {
  leagueId: 'league-1',
  leagueValueProfileKey: '12_sf_ppr_base',
  currentSeason: '2026',
  lastCompletedSeason: '2025',
};

describe('report static rendered sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findLeagueReportCache.mockResolvedValue(null);
    mocks.upsertLeagueReportCache.mockResolvedValue(undefined);
    mocks.getLeagueReportCacheTtlMs.mockReturnValue(12 * 60 * 60 * 1000);
    mocks.loadSourceSnapshotFreshnessDiagnostics.mockResolvedValue([
      { sourceKey: 'ktc-blended-values-v1', source: 'KTC', status: 'fresh', level: 'info' },
    ]);
  });

  it('keys static rendered sections by value profile and season window', () => {
    expect(getReportStaticSectionsCacheKey(baseInput)).toBe(
      'league-report-static-sections-v1:12_sf_ppr_base:2026:2025:default'
    );
  });

  it('loads player schedule profiles once and stores the rendered static section', async () => {
    const result = await loadReportStaticSections({
      ...baseInput,
      players: {
        carRb: { full_name: 'Carolina Back', position: 'RB', team: 'CAR', status: 'Active' },
      },
      prospectSourceDiagnostics: { status: 'ready', playerCount: 1, source: 'NFL Draft Buzz' } as any,
    });

    expect(result.cacheStatus).toBe('miss');
    expect(result.playerScheduleProfiles.carRb).toMatchObject({
      byeWeek: 5,
      scheduleTier: 'neutral',
    });
    expect(result.cacheKey).toMatch(/^league-report-static-sections-v1:12_sf_ppr_base:2026:2025:[a-f0-9]{16}$/);
    expect(mocks.upsertLeagueReportCache).toHaveBeenCalledWith({
      cacheKey: result.cacheKey,
      leagueId: 'league-1',
      viewerUserId: null,
      payload: expect.objectContaining({
        playerScheduleProfiles: expect.objectContaining({
          carRb: expect.objectContaining({ byeWeek: 5 }),
        }),
      }),
    });
  });

  it('returns cached static rendered sections without rebuilding them', async () => {
    const cachedPayload = {
      cacheKey: 'league-report-static-sections-v1:12_sf_ppr_base:2026:2025',
      generatedAt: '2026-05-15T00:00:00.000Z',
      playerScheduleProfiles: {
        carRb: { byeWeek: 5, scheduleTier: 'neutral' },
      },
      prospectSourceDiagnostics: { status: 'ready' },
    };
    mocks.findLeagueReportCache.mockResolvedValue(cachedPayload);

    const result = await loadReportStaticSections({
      ...baseInput,
      players: {
        carRb: { full_name: 'Changed Team', position: 'RB', team: 'DEN', status: 'Active' },
      },
    });

    expect(result).toEqual({ ...cachedPayload, cacheStatus: 'hit' });
    expect(mocks.upsertLeagueReportCache).not.toHaveBeenCalled();
  });

  it('keys source diagnostics by row-count signature and caches the rendered diagnostics', async () => {
    const rowCounts = [
      { sourceKey: 'fantasypros-news-v1', rowCount: 5 },
      { sourceKey: 'ktc-blended-values-v1', rowCount: 100 },
    ];

    expect(getReportSourceDiagnosticsCacheKey({ ...baseInput, rowCounts })).toBe(
      'league-report-source-diagnostics-v1:12_sf_ppr_base:2026:2025:fantasypros-news-v1:5|ktc-blended-values-v1:100'
    );

    const result = await loadReportSourceDiagnosticsSection({
      ...baseInput,
      devyProfileKey: 'devy_12_sf_ppr_base',
      rowCounts,
    });

    expect(result.cacheStatus).toBe('miss');
    expect(mocks.loadSourceSnapshotFreshnessDiagnostics).toHaveBeenCalledWith({
      currentSeason: '2026',
      previousSeason: '2025',
      valueProfileKey: '12_sf_ppr_base',
      devyProfileKey: 'devy_12_sf_ppr_base',
      rowCounts,
    });
    expect(mocks.upsertLeagueReportCache).toHaveBeenCalledWith({
      cacheKey: result.cacheKey,
      leagueId: 'league-1',
      viewerUserId: null,
      payload: expect.objectContaining({
        sourceSnapshotDiagnostics: expect.any(Array),
      }),
    });
  });

  it('accepts only static section and diagnostics payload shapes', () => {
    expect(isReportStaticSectionsPayload({
      cacheKey: 'league-report-static-sections-v1:12_sf_ppr_base:2026:2025',
      generatedAt: '2026-05-15T00:00:00.000Z',
      playerScheduleProfiles: {},
    })).toBe(true);
    expect(isReportStaticSectionsPayload({ reportData: {} })).toBe(false);

    expect(isReportSourceDiagnosticsPayload({
      cacheKey: 'league-report-source-diagnostics-v1:12_sf_ppr_base:2026:2025:none',
      generatedAt: '2026-05-15T00:00:00.000Z',
      sourceSnapshotDiagnostics: [],
    })).toBe(true);
    expect(isReportSourceDiagnosticsPayload({ sourceSnapshotDiagnostics: {} })).toBe(false);
  });
});
