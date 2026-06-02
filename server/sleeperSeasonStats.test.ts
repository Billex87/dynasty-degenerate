import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import {
  clearSleeperSeasonStatsCacheForTests,
  fetchSleeperSeasonStats,
  refreshSleeperSeasonStatsSnapshots,
} from './sleeperSeasonStats';

afterEach(() => {
  clearSleeperSeasonStatsCacheForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Sleeper season stat snapshots', () => {
  it('loads aggregate season stats from stored snapshots without calling Sleeper', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(db, 'findLatestProviderDataSnapshot').mockResolvedValue({
      snapshotKey: '2025',
      updatedAt: new Date('2026-05-15T12:00:00Z'),
      payload: JSON.stringify({
        schemaVersion: 1,
        generatedAt: '2026-05-15T12:00:00Z',
        season: '2025',
        week: null,
        values: {
          player1: {
            pts_ppr: 321.4,
            gp: 17,
          },
        },
      }),
    });

    const stats = await fetchSleeperSeasonStats('2025', null, { sourceMode: 'snapshot' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(stats.player1).toMatchObject({
      pts_ppr: 321.4,
      gp: 17,
    });
  });

  it('refreshes requested season snapshots from Sleeper and persists them', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      player1: {
        pts_ppr: 211.7,
        gp: 16,
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const upsertSpy = vi.spyOn(db, 'upsertProviderDataSnapshot').mockResolvedValue(true);

    const result = await refreshSleeperSeasonStatsSnapshots({ seasons: ['2025'] });

    expect(fetchMock).toHaveBeenCalledWith('https://api.sleeper.app/v1/stats/nfl/regular/2025');
    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: 'sleeper-season-stats-v1:2025',
      snapshotKey: '2025',
    }));
    expect(result.seasons).toEqual([{
      season: '2025',
      status: 'loaded',
      rowCount: 1,
    }]);
  });

  it('evicts older cached season stats instead of growing without bound', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const season = url.split('/').pop() || 'unknown';
      return new Response(JSON.stringify({
        [`player-${season}`]: {
          pts_ppr: Number(season) || 0,
          gp: 1,
        },
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    for (let index = 0; index < 65; index += 1) {
      await fetchSleeperSeasonStats(String(2000 + index), null);
    }

    await fetchSleeperSeasonStats('2000', null);
    await fetchSleeperSeasonStats('2064', null);

    const loadedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(loadedUrls.filter((url) => url.endsWith('/2000'))).toHaveLength(2);
    expect(loadedUrls.filter((url) => url.endsWith('/2064'))).toHaveLength(1);
  });
});
