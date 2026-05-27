import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import { __testing, fetchSportsDataIoNews } from './sportsDataNews';

describe('SportsDataIO news normalization', () => {
  afterEach(() => {
    delete process.env.ENABLE_SPORTSDATAIO_NEWS;
    delete process.env.SPORTSDATAIO_API_KEY;
    delete process.env.SPORTSDATA_IO_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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

  it('normalizes alternate headline, date, url, and team field names', () => {
    const [row] = __testing.normalizeSportsDataIoNewsRows([{
      Subject: 'Injury update',
      Article: 'Full participant in practice.',
      OriginalSource: 'SportsDataIO',
      OriginalSourceUrl: 'https://example.com/injury-update',
      PublishedDate: '2026-05-17T18:30:00Z',
      FantasyPlayerName: 'Amon-Ra St. Brown',
      PlayerTeamID: 'DET',
    }]);

    expect(row).toMatchObject({
      title: 'Injury update',
      summary: 'Full participant in practice.',
      source: 'SportsDataIO',
      url: 'https://example.com/injury-update',
      publishedAt: '2026-05-17T18:30:00Z',
      playerName: 'Amon-Ra St. Brown',
      team: 'DET',
    });
  });

  it('drops rows without a usable headline after HTML cleanup', () => {
    const rows = __testing.normalizeSportsDataIoNewsRows([
      {
        Title: '<b>&nbsp;</b>',
        Content: 'Body without a headline.',
      },
      {
        Title: 'Usable headline',
        Content: '<p>HTML summary</p>',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: 'Usable headline',
      summary: 'HTML summary',
    });
  });

  it('loads stored snapshots without calling SportsDataIO live endpoints', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(db, 'findLatestProviderDataSnapshot').mockResolvedValue({
      snapshotKey: '2026-05-17',
      updatedAt: new Date('2026-05-17T12:00:00Z'),
      payload: JSON.stringify({
        schemaVersion: 1,
        generatedAt: '2026-05-17T12:00:00Z',
        snapshotKey: '2026-05-17',
        items: [{
          title: 'Stored player news',
          source: 'RotoBaller',
          publishedAt: '2026-05-17T11:00:00Z',
          playerName: 'Bijan Robinson',
        }],
      }),
    });

    const news = await fetchSportsDataIoNews({ sourceMode: 'snapshot' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(news).toEqual([expect.objectContaining({
      title: 'Stored player news',
      playerName: 'Bijan Robinson',
    })]);
  });

  it('falls back to cached news when a live refresh fails', async () => {
    process.env.ENABLE_SPORTSDATAIO_NEWS = 'true';
    process.env.SPORTSDATAIO_API_KEY = 'test-sportsdata-key';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        Headline: 'Cached player news',
        PlayerName: 'CeeDee Lamb',
        Updated: '2026-05-17T12:00:00Z',
      }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'down' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchSportsDataIoNews({ forceRefresh: true });
    const second = await fetchSportsDataIoNews({ forceRefresh: true });

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      '[SportsDataIO] Failed to load player news:',
      expect.any(Error),
    );
  });
});
