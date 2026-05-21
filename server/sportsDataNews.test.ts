import { describe, expect, it } from 'vitest';
import { __testing } from './sportsDataNews';

describe('SportsDataIO news normalization', () => {
  it('normalizes RotoBaller-style player news rows into player news items', () => {
    const rows = __testing.normalizeSportsDataIoNewsRows([
      {
        Title: '<b>Bijan Robinson workload rising</b>',
        Content: 'Coaches expect more passing-game work &amp; red-zone touches.',
        Source: 'RotoBaller',
        Url: 'https://example.com/bijan',
        Updated: '2026-05-16T12:00:00Z',
        PlayerName: 'Bijan Robinson',
        Team: 'ATL',
      },
      {
        Headline: '',
        Content: 'No headline should be ignored.',
      },
    ]);

    expect(rows).toEqual([{
      title: 'Bijan Robinson workload rising',
      summary: 'Coaches expect more passing-game work & red-zone touches.',
      source: 'RotoBaller',
      sourceUrl: 'https://www.rotoballer.com/player-news?sport=nfl',
      url: 'https://example.com/bijan',
      publishedAt: '2026-05-16T12:00:00Z',
      playerName: 'Bijan Robinson',
      team: 'ATL',
    }]);
  });

  it('builds player names from first and last name fields when PlayerName is absent', () => {
    const [row] = __testing.normalizeSportsDataIoNewsRows([{
      Headline: 'Practice status upgraded',
      FirstName: 'CeeDee',
      LastName: 'Lamb',
      TeamID: 'DAL',
    }]);

    expect(row).toMatchObject({
      title: 'Practice status upgraded',
      playerName: 'CeeDee Lamb',
      team: 'DAL',
      source: 'SportsDataIO/RotoBaller',
    });
  });
});
