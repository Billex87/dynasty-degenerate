import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSleeperStartupAdpData } from './startupAdpSnapshots';

vi.mock('./db', () => ({
  findLatestProviderDataSnapshot: vi.fn(async () => null),
  findProviderDataSnapshotOnOrBefore: vi.fn(async () => null),
  upsertProviderDataSnapshot: vi.fn(async () => true),
}));

describe('Sleeper startup ADP source', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses Sleeper season ADP for drafted startup ADP and current season ADP for current ADP', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (url.includes('/2025?')) {
          return [
            {
              player_id: 'allen',
              stats: { adp_dynasty_2qb: 1.9, adp_dynasty_ppr: 13.1 },
              player: { first_name: 'Josh', last_name: 'Allen', position: 'QB', team: 'BUF' },
            },
          ];
        }
        if (url.includes('/2026?')) {
          return [
            {
              player_id: 'allen',
              stats: { adp_dynasty_2qb: 1.5, adp_dynasty_ppr: 6.7 },
              player: { first_name: 'Josh', last_name: 'Allen', position: 'QB', team: 'BUF' },
            },
          ];
        }
        return [];
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const adpData = await buildSleeperStartupAdpData(
      [
        { player_id: 'allen', round: 1, pick_no: 4, picked_by: 'u1', season: '2025', draft_pick_count: 235 },
      ] as any,
      { allen: { full_name: 'Josh Allen' } },
      { numQbs: 2, ppr: 1, currentSeason: '2026' }
    );

    expect(adpData['2025:allen']).toMatchObject({
      name: 'Josh Allen',
      adp: 1.9,
      source: 'Sleeper 2025 Dynasty SF ADP',
      currentAdp: 1.5,
      currentAdpSource: 'Sleeper 2026 Dynasty SF ADP',
    });
  });
});
