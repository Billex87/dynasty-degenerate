import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshPlayerNewsSnapshots } from './dynamicDataJobs';
import { loadPlayerNewsBundle } from './playerNews';

vi.mock('./playerNews', () => ({
  loadPlayerNewsBundle: vi.fn(),
}));

const mockedLoadPlayerNewsBundle = vi.mocked(loadPlayerNewsBundle);

describe('dynamic data jobs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T16:10:00.000Z'));
    mockedLoadPlayerNewsBundle.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes player news through the persistent snapshot path', async () => {
    mockedLoadPlayerNewsBundle.mockResolvedValue({
      items: [],
      sourceCounts: {
        total: 14,
        fantasyPros: 9,
        sportsDataIo: 5,
      },
    });

    const result = await refreshPlayerNewsSnapshots();

    expect(mockedLoadPlayerNewsBundle).toHaveBeenCalledWith({
      persistSnapshot: true,
      forceRefresh: true,
    });
    expect(result).toMatchObject({
      ok: true,
      generatedAt: '2026-05-27T16:10:00.000Z',
      playerNewsCount: 14,
      fantasyProsNewsCount: 9,
      sportsDataIoNewsCount: 5,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
