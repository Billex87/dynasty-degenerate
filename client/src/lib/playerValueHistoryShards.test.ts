import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlayerDetails } from '@shared/types';
import { loadStaticPlayerValueTimeline } from './playerValueHistoryShards';

type PlayerValueTimeline = NonNullable<PlayerDetails['valueTimeline']>;

const fallbackTimeline: PlayerValueTimeline = {
  profileKey: '12_sf_ppr_base',
  source: 'historical-value-index',
  selectedWindow: 'all',
  points: [
    {
      date: '2026-05-01',
      value: 700,
      rank: 'WR64',
      sources: ['fantasyPros'],
      sourceCount: 1,
    },
    {
      date: '2026-05-17',
      value: 900,
      rank: 'WR58',
      sources: ['fantasyPros', 'flockFantasy'],
      sourceCount: 2,
      events: [
        {
          type: 'roster-room',
          label: 'Room opened',
          tone: 'up',
          detail: 'Vacated targets improved',
        },
      ],
    },
  ],
  summary: {
    startValue: 700,
    endValue: 900,
    delta: 200,
    deltaPct: 28.6,
    sourceSetChanged: true,
    eventCount: 1,
    note: 'Fallback report note.',
  },
};

const allWindow = {
  key: 'all' as const,
  label: 'All',
  days: null,
  pointCount: 3,
  startDate: '2026-04-01',
  endDate: '2026-05-17',
  startValue: 500,
  endValue: 900,
  delta: 400,
  deltaPct: 80,
  points: [
    {
      date: '2026-04-01',
      value: 500,
      rank: 'WR80',
      sources: ['flockFantasy'],
      sourceCount: 1,
    },
    {
      date: '2026-05-01',
      value: 700,
      rank: 'WR64',
      sources: ['fantasyPros'],
      sourceCount: 1,
    },
    {
      date: '2026-05-17',
      value: 900,
      rank: 'WR58',
      overallRank: 212,
      sources: ['fantasyPros', 'flockFantasy'],
      sourceCount: 2,
      marketKtc: 850,
      fantasyNerds: 875,
      flockFantasy: 950,
    },
  ],
};

describe('loadStaticPlayerValueTimeline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the matching player shard and merges report-only event markers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        players: {
          malachifields: {
            key: 'malachifields',
            name: 'Malachi Fields',
            position: 'WR',
            lookupKeys: ['malachifields'],
            formats: {
              sf_ppr: {
                format: 'sf_ppr',
                rawPointCount: 3,
                windows: {
                  all: allWindow,
                },
                extremes: {
                  high: allWindow.points[2],
                  low: allWindow.points[0],
                },
                yearlyExtremes: [
                  {
                    year: '2026',
                    high: allWindow.points[2],
                    low: allWindow.points[0],
                  },
                ],
              },
            },
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const timeline = await loadStaticPlayerValueTimeline({
      playerName: 'Malachi Fields',
      valueProfileKey: '12_sf_ppr_base',
      selectedWindow: 'all',
      fallbackTimeline,
    });

    expect(fetchMock).toHaveBeenCalledWith('/assets/value-history/player-value-history-shards/ma.json', {
      cache: 'no-cache',
    });
    expect(timeline?.source).toBe('historical-value-index');
    expect(timeline?.points).toHaveLength(3);
    expect(timeline?.windows?.all?.points[2].events?.[0]?.label).toBe('Room opened');
    expect(timeline?.summary.note).toBe('Fallback report note.');
    expect(timeline?.availableWindows?.map((window) => window.key)).toEqual(['1m', '3m', '6m', '1y', 'all']);
    expect(timeline?.points[2]).toMatchObject({ marketKtc: 850, fantasyNerds: 875, flockFantasy: 950 });
    expect(timeline?.extremes?.high?.date).toBe('2026-05-17');
    expect(timeline?.yearlyExtremes?.[0]?.high?.value).toBe(900);
  });

  it('returns null when the static shard is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const timeline = await loadStaticPlayerValueTimeline({
      playerName: 'Unlisted Player',
      valueProfileKey: '12_sf_ppr_base',
    });

    expect(timeline).toBeNull();
  });

  it('retries a shard after a missing response instead of caching the miss', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          players: {
            retryplayer: {
              key: 'retryplayer',
              name: 'Retry Player',
              position: 'WR',
              lookupKeys: ['retryplayer'],
              formats: {
                sf_ppr: {
                  format: 'sf_ppr',
                  rawPointCount: 3,
                  windows: {
                    all: allWindow,
                  },
                },
              },
            },
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    expect(await loadStaticPlayerValueTimeline({
      playerName: 'Retry Player',
      valueProfileKey: '12_sf_ppr_base',
    })).toBeNull();

    const timeline = await loadStaticPlayerValueTimeline({
      playerName: 'Retry Player',
      valueProfileKey: '12_sf_ppr_base',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(timeline?.source).toBe('historical-value-index');
  });
});
