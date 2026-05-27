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

  it('sorts merged news by publish time and ignores empty headlines', () => {
    const items = mergePlayerNewsItems([
      {
        title: 'Older note',
        source: 'FantasyPros',
        publishedAt: '2026-05-15T12:00:00Z',
        playerName: 'Garrett Wilson',
      },
      {
        title: '',
        source: 'FantasyPros',
        publishedAt: '2026-05-17T12:00:00Z',
        playerName: 'Garrett Wilson',
      },
    ], [
      {
        title: 'Newest note',
        source: 'SportsDataIO/RotoBaller',
        publishedAt: '2026-05-16T12:00:00Z',
        playerName: 'Garrett Wilson',
      },
    ]);

    expect(items.map((item) => item.title)).toEqual(['Newest note', 'Older note']);
  });

  it('matches suffix variants for player-specific news', () => {
    const latest = findLatestPlayerNewsForPlayer('Brian Thomas Jr.', [
      {
        title: 'Receiver earns more red-zone work',
        source: 'FantasyPros',
        publishedAt: '2026-05-16T12:00:00Z',
        playerName: 'Brian Thomas',
      },
    ]);

    expect(latest?.title).toBe('Receiver earns more red-zone work');
  });

  it('does not match ambiguous very short player names', () => {
    const latest = findLatestPlayerNewsForPlayer('DK', [
      {
        title: 'DK Metcalf dominates red-zone drills',
        source: 'FantasyPros',
        publishedAt: '2026-05-16T12:00:00Z',
        playerName: 'DK Metcalf',
      },
    ]);

    expect(latest).toBeNull();
  });

  it('does not merge same-day headlines for different players', () => {
    const items = mergePlayerNewsItems([
      {
        title: 'Rookie workload rising',
        source: 'FantasyPros',
        publishedAt: '2026-05-16T12:00:00Z',
        playerName: 'Rome Odunze',
      },
      {
        title: 'Rookie workload rising',
        source: 'SportsDataIO/RotoBaller',
        publishedAt: '2026-05-16T12:30:00Z',
        playerName: 'Malik Nabers',
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.playerName).sort()).toEqual(['Malik Nabers', 'Rome Odunze']);
  });
});
