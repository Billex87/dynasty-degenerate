import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findLeagueReportCache: vi.fn(),
  upsertLeagueReportCache: vi.fn(),
  getLeagueReportCacheTtlMs: vi.fn(),
}));

vi.mock('./db', () => ({
  findLeagueReportCache: mocks.findLeagueReportCache,
  upsertLeagueReportCache: mocks.upsertLeagueReportCache,
}));

vi.mock('./leagueReportCachePolicy', () => ({
  getLeagueReportCacheTtlMs: mocks.getLeagueReportCacheTtlMs,
}));

import {
  buildReportPlayerStaticEnrichment,
  getReportPlayerEnrichmentCacheKey,
  isReportPlayerStaticEnrichmentPayload,
  loadReportPlayerStaticEnrichment,
} from './reportPlayerEnrichment';

const baseInput = {
  leagueId: 'league-1',
  leagueValueProfileKey: '12_sf_ppr_base',
  currentSeason: '2026',
  lastCompletedSeason: '2025',
  sleeperResearchSeasonType: 'regular',
  playerIds: ['p2', 'p1'],
  valueProfilesById: {
    p1: { dynastyValue: 5000, sources: ['FantasyCalc'] },
  },
  valueTimelinesById: {
    p1: {
      profileKey: '12_sf_ppr_base',
      source: 'stored-value-snapshots' as const,
      points: [
        { date: '2026-05-07', value: 4500, rank: 'WR18', sources: ['FantasyCalc'], sourceCount: 1 },
        { date: '2026-05-15', value: 5000, rank: 'WR12', sources: ['FantasyCalc'], sourceCount: 1 },
      ],
      summary: {
        startValue: 4500,
        endValue: 5000,
        delta: 500,
        deltaPct: 11.1,
        sourceSetChanged: false,
        eventCount: 0,
        note: 'Stored value history uses the same source set at the start and end of this window.',
      },
    },
  },
  lastSeasonPositionRanks: {
    p1: {
      positionRank: 'WR12',
      fantasyPoints: 215,
      games: 16,
      pointsPerGame: 13.4,
      season: '2025',
    },
  },
  availabilityHistoryById: {
    p1: {
      availabilityHistory: [{ season: '2025', games: 16, gamesMissed: 1, pointsPerGame: 13.4, positionRank: 'WR12' }],
      avgGamesMissed: 1,
      availabilitySeasons: 1,
    },
  },
  latestNewsByPlayerId: {
    p1: {
      title: 'Practice note',
      summary: null,
      source: 'FantasyPros',
      url: null,
      publishedAt: '2026-05-15T00:00:00.000Z',
    },
  },
  sleeperResearchByPlayerId: {
    p1: { owned: 81.2, started: 47.8 },
  },
  pastSeasonUsageByPlayerId: {
    p1: {
      season: '2025',
      ownedGames: 16,
      startedGames: 12,
      managerBreakdown: [],
    },
  },
  playerScheduleProfiles: {
    p1: { byeWeek: 6, scheduleTier: 'neutral' as const },
  },
  similarTradeValuesById: {
    p1: [{ playerId: 'p2', name: 'Peer Player', position: 'RB', team: 'BUF', rank: 'RB20', value: 4800, difference: -200, label: 'Nearest RB' }],
  },
  prospectProfilesById: {
    p1: { source: 'NFL Draft Buzz' as const, draftYear: 2024, name: 'Player One', position: 'WR' },
  },
};

describe('report player static enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findLeagueReportCache.mockResolvedValue(null);
    mocks.upsertLeagueReportCache.mockResolvedValue(undefined);
    mocks.getLeagueReportCacheTtlMs.mockReturnValue(12 * 60 * 60 * 1000);
  });

  it('keys player enrichment independent of input player order', () => {
    const first = getReportPlayerEnrichmentCacheKey({
      leagueValueProfileKey: '12_sf_ppr_base',
      currentSeason: '2026',
      lastCompletedSeason: '2025',
      sleeperResearchSeasonType: 'regular',
      playerIds: ['p2', 'p1'],
      sourceSignature: 'sources',
    });
    const second = getReportPlayerEnrichmentCacheKey({
      leagueValueProfileKey: '12_sf_ppr_base',
      currentSeason: '2026',
      lastCompletedSeason: '2025',
      sleeperResearchSeasonType: 'regular',
      playerIds: ['p1', 'p2'],
      sourceSignature: 'sources',
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^league-report-player-enrichment-v3:12_sf_ppr_base:2026:2025:regular:[a-f0-9]{16}:sources$/);
  });

  it('builds static enrichment without live roster status fields', () => {
    const result = buildReportPlayerStaticEnrichment(baseInput);

    expect(result.p1).toMatchObject({
      valueProfile: { dynastyValue: 5000 },
      valueTimeline: { summary: { delta: 500 } },
      lastSeasonPositionRank: 'WR12',
      avgGamesMissed: 1,
      sleeperRosteredPct: 81.2,
      sleeperStartedPct: 47.8,
      sleeperResearchSeason: '2026',
      sleeperResearchSeasonType: 'regular',
      schedule: { byeWeek: 6 },
      prospectProfile: { name: 'Player One' },
    });
    expect(result.p1).not.toHaveProperty('rosterStatus');
    expect(result.p1).not.toHaveProperty('injuryStatus');
    expect(result.p2).toMatchObject({
      availabilityHistory: [],
      latestNews: null,
      avgGamesMissed: null,
      availabilitySeasons: 0,
      leagueUsage: null,
      schedule: null,
      similarTradeValues: [],
      prospectProfile: null,
      valueTimeline: null,
    });
  });

  it('returns cached enrichment without upserting', async () => {
    const cachedPayload = {
      cacheKey: 'league-report-player-enrichment-v3:cached',
      generatedAt: '2026-05-15T00:00:00.000Z',
      playerEnrichmentById: {
        p1: { valueProfile: { dynastyValue: 5000 } },
      },
    };
    mocks.findLeagueReportCache.mockResolvedValue(cachedPayload);

    const buildEnrichment = vi.fn(() => buildReportPlayerStaticEnrichment(baseInput));
    const result = await loadReportPlayerStaticEnrichment({ ...baseInput, buildEnrichment });

    expect(result).toEqual({ ...cachedPayload, cacheStatus: 'hit' });
    expect(mocks.findLeagueReportCache).toHaveBeenCalledWith(expect.stringMatching(/^league-report-player-enrichment-v3:/), 12 * 60 * 60 * 1000);
    expect(buildEnrichment).not.toHaveBeenCalled();
    expect(mocks.upsertLeagueReportCache).not.toHaveBeenCalled();
  });

  it('stores enrichment on cache miss and bypasses cache on force refresh', async () => {
    const result = await loadReportPlayerStaticEnrichment({
      ...baseInput,
      buildEnrichment: () => buildReportPlayerStaticEnrichment(baseInput),
    });

    expect(result.cacheStatus).toBe('miss');
    expect(result.playerEnrichmentById.p1?.valueProfile).toMatchObject({ dynastyValue: 5000 });
    expect(mocks.upsertLeagueReportCache).toHaveBeenCalledWith({
      cacheKey: result.cacheKey,
      leagueId: 'league-1',
      viewerUserId: null,
      payload: expect.objectContaining({
        playerEnrichmentById: expect.objectContaining({
          p1: expect.objectContaining({ lastSeasonPositionRank: 'WR12' }),
        }),
      }),
    });

    vi.clearAllMocks();
    mocks.findLeagueReportCache.mockResolvedValue({ cacheKey: 'old', generatedAt: 'old', playerEnrichmentById: {} });
    mocks.upsertLeagueReportCache.mockResolvedValue(undefined);
    await loadReportPlayerStaticEnrichment({
      ...baseInput,
      forceRefresh: true,
      buildEnrichment: () => buildReportPlayerStaticEnrichment(baseInput),
    });
    expect(mocks.findLeagueReportCache).not.toHaveBeenCalled();
    expect(mocks.upsertLeagueReportCache).toHaveBeenCalled();
  });

  it('accepts only player enrichment payloads', () => {
    expect(isReportPlayerStaticEnrichmentPayload({
      cacheKey: 'league-report-player-enrichment-v3:cached',
      generatedAt: '2026-05-15T00:00:00.000Z',
      playerEnrichmentById: {},
    })).toBe(true);
    expect(isReportPlayerStaticEnrichmentPayload({ reportData: {} })).toBe(false);
  });
});
