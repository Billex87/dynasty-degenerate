import { describe, expect, it } from 'vitest';
import { findLatestPlayerNewsForPlayer, mergePlayerNewsItems } from './playerNews';

describe('player news aggregation', () => {
  it('merges duplicate provider headlines and keeps source attribution', () => {
    const items = mergePlayerNewsItems([
      {
        title: 'Bijan Robinson workload rising',
        summary: 'FantasyPros note',
        source: 'FantasyPros',
        publishedAt: '2026-05-16T12:00:00Z',
        playerName: 'Bijan Robinson',
      },
    ], [
      {
        title: 'Bijan Robinson workload rising',
        summary: 'RotoBaller note',
        source: 'SportsDataIO/RotoBaller',
        url: 'https://example.com/bijan',
        publishedAt: '2026-05-16T12:15:00Z',
        playerName: 'Bijan Robinson',
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Bijan Robinson workload rising',
      summary: 'FantasyPros note',
      source: 'FantasyPros + SportsDataIO/RotoBaller',
      url: 'https://example.com/bijan',
    });
  });

  it('finds the newest matching player item across aggregated sources', () => {
    const latest = findLatestPlayerNewsForPlayer('CeeDee Lamb', mergePlayerNewsItems([
      {
        title: 'Cowboys receiver gets a rest day',
        summary: 'CeeDee Lamb was held out.',
        source: 'FantasyPros',
        publishedAt: '2026-05-15T12:00:00Z',
      },
      {
        title: 'CeeDee Lamb returns to full practice',
        source: 'SportsDataIO/RotoBaller',
        publishedAt: '2026-05-16T12:00:00Z',
        playerName: 'CeeDee Lamb',
      },
    ]));

    expect(latest?.title).toBe('CeeDee Lamb returns to full practice');
  });
});
