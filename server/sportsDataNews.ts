import { recordApiProviderCacheHit, recordApiProviderTelemetryEvent } from './apiProviderTelemetry';
import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';
import type { FantasyProsNewsItem } from './fantasyPros';

export const SPORTSDATAIO_NEWS_SNAPSHOT_SOURCE_KEY = 'sportsdataio-news-v1';
const ROTOBALLER_PLAYER_NEWS_URL = 'https://www.rotoballer.com/player-news?sport=nfl';

const SPORTSDATAIO_BASE_URL = 'https://api.sportsdata.io';
const SPORTSDATAIO_NEWS_ENDPOINT = '/v3/nfl/scores/json/News';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

type SportsDataNewsLoadOptions = {
  sourceMode?: 'live' | 'snapshot';
  persistSnapshot?: boolean;
  forceRefresh?: boolean;
};

type SportsDataNewsSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  items: FantasyProsNewsItem[];
};

let cachedNews: { loadedAt: number; values: FantasyProsNewsItem[] } | null = null;

function isFresh(cache: { loadedAt: number } | null): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function getSportsDataIoApiKey(): string | null {
  return process.env.SPORTSDATAIO_API_KEY || process.env.SPORTSDATA_IO_API_KEY || null;
}

function isEnabled(): boolean {
  return /^(?:1|true|yes|on)$/i.test(String(process.env.ENABLE_SPORTSDATAIO_NEWS || ''));
}

function stripHtml(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function field(row: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    const value = stripHtml(row[name]);
    if (value) return value;
  }
  return null;
}

function normalizeSportsDataIoNewsRows(rows: Array<Record<string, unknown>>): FantasyProsNewsItem[] {
  return rows
    .map((row) => {
      const firstName = field(row, ['FirstName', 'PlayerFirstName']);
      const lastName = field(row, ['LastName', 'PlayerLastName']);
      const playerName = field(row, ['PlayerName', 'Name', 'Player', 'FantasyPlayerName'])
        || [firstName, lastName].filter(Boolean).join(' ')
        || null;

      return {
        title: field(row, ['Title', 'Headline', 'NewsTitle', 'Subject']) || '',
        summary: field(row, ['Content', 'Summary', 'Body', 'Description', 'News', 'Article']),
        source: field(row, ['Source', 'OriginalSource', 'Provider', 'Site']) || 'SportsDataIO/RotoBaller',
        sourceUrl: ROTOBALLER_PLAYER_NEWS_URL,
        url: field(row, ['Url', 'URL', 'Link', 'SourceUrl', 'OriginalSourceUrl']),
        publishedAt: field(row, ['Updated', 'Created', 'Published', 'PublishedAt', 'PublishedDate', 'DateTime', 'NewsDate', 'TimeStamp']),
        playerName,
        team: field(row, ['Team', 'TeamID', 'PlayerTeam', 'PlayerTeamID']),
      };
    })
    .filter((item) => item.title);
}

function parseSportsDataIoNewsSnapshot(payload?: string | null): SportsDataNewsSnapshotPayload | null {
  const parsed = parseProviderSnapshotPayload<Partial<SportsDataNewsSnapshotPayload>>(payload);
  if (
    parsed?.schemaVersion !== 1 ||
    typeof parsed.snapshotKey !== 'string' ||
    !Array.isArray(parsed.items)
  ) {
    return null;
  }

  return parsed as SportsDataNewsSnapshotPayload;
}

async function loadStoredSportsDataIoNews(): Promise<FantasyProsNewsItem[]> {
  const stored = await findLatestProviderDataSnapshot(SPORTSDATAIO_NEWS_SNAPSHOT_SOURCE_KEY);
  const snapshot = parseSportsDataIoNewsSnapshot(stored?.payload);
  if (!snapshot) return cachedNews?.values || [];

  cachedNews = { loadedAt: Date.now(), values: snapshot.items };
  return snapshot.items;
}

async function persistSportsDataIoNewsSnapshot(items: FantasyProsNewsItem[], now = new Date()) {
  const snapshotKey = getProviderSnapshotDateKey(now);
  const payload: SportsDataNewsSnapshotPayload = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    snapshotKey,
    items,
  };

  try {
    await upsertProviderDataSnapshot({
      sourceKey: SPORTSDATAIO_NEWS_SNAPSHOT_SOURCE_KEY,
      snapshotKey,
      payload: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('[SportsDataIO] Failed to persist news snapshot:', error);
  }
}

function getNewsUrl(): string {
  const configured = process.env.SPORTSDATAIO_NEWS_URL || process.env.SPORTSDATAIO_NEWS_ENDPOINT;
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  const endpoint = configured || SPORTSDATAIO_NEWS_ENDPOINT;
  return `${SPORTSDATAIO_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

export async function fetchSportsDataIoNews(options: SportsDataNewsLoadOptions = {}): Promise<FantasyProsNewsItem[]> {
  if (options.sourceMode === 'snapshot') {
    return loadStoredSportsDataIoNews();
  }

  if (!isEnabled()) return [];
  const apiKey = getSportsDataIoApiKey();
  if (!apiKey) return cachedNews?.values || [];

  if (!options.forceRefresh && cachedNews && isFresh(cachedNews)) {
    recordApiProviderCacheHit({
      provider: 'SportsDataIO',
      endpoint: '/v3/nfl/scores/json/News',
      job: 'news',
      scope: 'cron',
    });
    if (options.persistSnapshot) await persistSportsDataIoNewsSnapshot(cachedNews.values);
    return cachedNews.values;
  }

  const startedAt = Date.now();
  const url = getNewsUrl();
  try {
    const response = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    });

    if (!response.ok) {
      recordApiProviderTelemetryEvent({
        provider: 'SportsDataIO',
        endpoint: new URL(url).pathname,
        status: response.status,
        ok: false,
        durationMs: Date.now() - startedAt,
        cacheStatus: 'miss',
        costUnits: 1,
        scope: 'cron',
        message: `SportsDataIO ${response.status}`,
      });
      throw new Error(`SportsDataIO ${response.status} ${new URL(url).pathname}`);
    }

    const payload = await response.json() as Array<Record<string, unknown>> | { news?: Array<Record<string, unknown>>; items?: Array<Record<string, unknown>> };
    const rows = Array.isArray(payload) ? payload : payload.news || payload.items || [];
    const values = normalizeSportsDataIoNewsRows(rows);
    cachedNews = { loadedAt: Date.now(), values };
    if (options.persistSnapshot) await persistSportsDataIoNewsSnapshot(values);

    recordApiProviderTelemetryEvent({
      provider: 'SportsDataIO',
      endpoint: new URL(url).pathname,
      status: response.status,
      ok: true,
      durationMs: Date.now() - startedAt,
      cacheStatus: 'miss',
      costUnits: 1,
      scope: 'cron',
      message: null,
    });

    return values;
  } catch (error) {
    if (!(error instanceof Error && /^SportsDataIO \d+ /.test(error.message))) {
      recordApiProviderTelemetryEvent({
        provider: 'SportsDataIO',
        endpoint: new URL(url).pathname,
        status: null,
        ok: false,
        durationMs: Date.now() - startedAt,
        cacheStatus: 'miss',
        costUnits: 1,
        scope: 'cron',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    console.warn('[SportsDataIO] Failed to load player news:', error);
    return cachedNews?.values || [];
  }
}

export const __testing = {
  normalizeSportsDataIoNewsRows,
};
