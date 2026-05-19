import { describe, expect, it, vi } from 'vitest';
import {
  getFantasyProsSnapshotWeekFromSleeperState,
  resolveFantasyProsSnapshotStartWeek,
} from './fantasyProsSnapshotWindow';

describe('FantasyPros snapshot week window', () => {
  it('uses the matching Sleeper NFL state week when available', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      season: '2026',
      week: 2,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(resolveFantasyProsSnapshotStartWeek({
      season: '2026',
      fallbackWeek: 1,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })).resolves.toBe(2);
  });

  it('falls back when Sleeper state is unavailable or for a different season', async () => {
    expect(getFantasyProsSnapshotWeekFromSleeperState({
      season: '2026',
      fallbackWeek: 3,
      state: { season: '2025', week: 17 },
    })).toBe(3);

    const fetchMock = vi.fn(async () => new Response('not found', { status: 503 }));

    await expect(resolveFantasyProsSnapshotStartWeek({
      season: '2026',
      fallbackWeek: 4,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })).resolves.toBe(4);
  });
});
