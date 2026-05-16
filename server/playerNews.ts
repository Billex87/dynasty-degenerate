import { cleanName } from './leagueAnalysis';
import {
  fetchFantasyProsLatestPlayerNews,
  fetchFantasyProsNews,
  findLatestFantasyProsNewsForPlayer,
  type FantasyProsNewsItem,
} from './fantasyPros';
import {
  SPORTSDATAIO_NEWS_SNAPSHOT_SOURCE_KEY,
  fetchSportsDataIoNews,
} from './sportsDataNews';

export type PlayerNewsItem = FantasyProsNewsItem;

export type PlayerNewsSourceCounts = {
  total: number;
  fantasyPros: number;
  sportsDataIo: number;
};

export type PlayerNewsBundle = {
  items: PlayerNewsItem[];
  sourceCounts: PlayerNewsSourceCounts;
};

type PlayerNewsLoadOptions = {
  sourceMode?: 'live' | 'snapshot';
  persistSnapshot?: boolean;
  forceRefresh?: boolean;
};

function newsTimestamp(value?: string | null): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function newsKey(item: PlayerNewsItem): string {
  return cleanName([
    item.playerName || '',
    item.title,
    item.publishedAt ? item.publishedAt.slice(0, 10) : '',
  ].join(':'));
}

export function mergePlayerNewsItems(...sources: PlayerNewsItem[][]): PlayerNewsItem[] {
  const byKey = new Map<string, PlayerNewsItem>();

  for (const item of sources.flat()) {
    if (!item?.title) continue;
    const key = newsKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    byKey.set(key, {
      ...existing,
      ...item,
      summary: existing.summary || item.summary || null,
      url: existing.url || item.url || null,
      source: Array.from(new Set([existing.source, item.source].filter(Boolean))).join(' + ') || null,
      publishedAt: existing.publishedAt || item.publishedAt || null,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => newsTimestamp(b.publishedAt) - newsTimestamp(a.publishedAt));
}

export async function loadPlayerNewsBundle(options: PlayerNewsLoadOptions = {}): Promise<PlayerNewsBundle> {
  const [fantasyProsNews, sportsDataIoNews] = await Promise.all([
    fetchFantasyProsNews(options),
    fetchSportsDataIoNews(options),
  ]);
  const items = mergePlayerNewsItems(fantasyProsNews, sportsDataIoNews);

  return {
    items,
    sourceCounts: {
      total: items.length,
      fantasyPros: fantasyProsNews.length,
      sportsDataIo: sportsDataIoNews.length,
    },
  };
}

export function findLatestPlayerNewsForPlayer(
  playerName: string,
  newsItems: PlayerNewsItem[]
): PlayerNewsItem | null {
  return findLatestFantasyProsNewsForPlayer(playerName, newsItems);
}

export async function fetchLatestPlayerNews(input: {
  playerName: string;
  team?: string | null;
  position?: string | null;
  sourceMode?: 'live' | 'snapshot';
}): Promise<PlayerNewsItem | null> {
  if (input.sourceMode === 'snapshot') {
    const bundle = await loadPlayerNewsBundle({ sourceMode: 'snapshot' });
    return findLatestPlayerNewsForPlayer(input.playerName, bundle.items);
  }

  const [fantasyProsLatest, alternateNews] = await Promise.all([
    fetchFantasyProsLatestPlayerNews(input),
    fetchSportsDataIoNews(),
  ]);
  const candidates = [
    fantasyProsLatest,
    findLatestPlayerNewsForPlayer(input.playerName, alternateNews),
  ].filter((item): item is PlayerNewsItem => Boolean(item));

  return mergePlayerNewsItems(candidates)[0] || null;
}

export { SPORTSDATAIO_NEWS_SNAPSHOT_SOURCE_KEY };
