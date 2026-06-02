import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearHeadshotCache, fetchNFLHeadshot } from './nflHeadshotFetcher';

afterEach(() => {
  clearHeadshotCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function letterSuffix(index: number): string {
  let value = index;
  let suffix = '';
  do {
    suffix = String.fromCharCode(97 + (value % 26)) + suffix;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return suffix;
}

describe('fetchNFLHeadshot', () => {
  it('caches successful headshot lookups by normalized NFL player slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<meta property="og:image" content="https://img.test/aj-brown.jpg">', { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchNFLHeadshot('A.J. Brown')).resolves.toBe('https://img.test/aj-brown.jpg');
    await expect(fetchNFLHeadshot('  AJ Brown  ')).resolves.toBe('https://img.test/aj-brown.jpg');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://www.nfl.com/players/aj-brown/');
  });

  it('evicts old missing headshot entries instead of growing without bound', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchNFLHeadshot('Missing Player A');
    for (let index = 1; index <= 500; index += 1) {
      await fetchNFLHeadshot(`Missing Player ${letterSuffix(index)}`);
    }
    await fetchNFLHeadshot('Missing Player A');

    const firstPlayerCalls = fetchMock.mock.calls
      .map(([target]) => String(target))
      .filter((target) => target === 'https://www.nfl.com/players/missing-player-a/');
    expect(firstPlayerCalls).toHaveLength(2);
  });
});
