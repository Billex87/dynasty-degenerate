import { cleanName } from './leagueAnalysis';
import {
  fetchFantasyProsLatestPlayerNews,
  fetchFantasyProsNews,
  findLatestFantasyProsNewsForPlayer,
  hasFantasyProsApiKey,
  isFantasyProsSubSourceEnabled,
  type FantasyProsNewsItem,
} from './fantasyPros';
import {
  SPORTSDATAIO_NEWS_SNAPSHOT_SOURCE_KEY,
  fetchSportsDataIoNews,
  hasSportsDataIoNewsApiKey,
  isSportsDataIoNewsSourceEnabled,
} from './sportsDataNews';

export type PlayerNewsItem = FantasyProsNewsItem;

export type PlayerNewsSourceCounts = {
  total: number;
  fantasyPros: number;
  sportsDataIo: number;
};

export type PlayerNewsSourceStatus = 'loaded' | 'empty' | 'disabled' | 'missing_config' | 'missing_snapshot' | 'cache_fallback';

export type PlayerNewsSourceDiagnostic = {
  sourceKey: string;
  source: string;
  status: PlayerNewsSourceStatus;
  rowCount: number;
  sourceMode: 'live' | 'snapshot';
  message: string;
};

export type PlayerNewsBundle = {
  items: PlayerNewsItem[];
  sourceCounts: PlayerNewsSourceCounts;
  sourceDiagnostics: PlayerNewsSourceDiagnostic[];
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

function sourceStatus(input: {
  rowCount: number;
  sourceMode: 'live' | 'snapshot';
  enabled: boolean;
  hasConfig: boolean;
}): PlayerNewsSourceStatus {
  if (!input.enabled) return 'disabled';
  if (input.rowCount > 0) {
    return input.sourceMode === 'live' && !input.hasConfig ? 'cache_fallback' : 'loaded';
  }
  if (input.sourceMode === 'snapshot') return 'missing_snapshot';
  if (!input.hasConfig) return 'missing_config';
  return 'empty';
}

function sourceMessage(input: {
  source: string;
  status: PlayerNewsSourceStatus;
  rowCount: number;
  sourceMode: 'live' | 'snapshot';
}): string {
  if (input.status === 'loaded') return `${input.source} returned ${input.rowCount.toLocaleString('en-US')} news row${input.rowCount === 1 ? '' : 's'} from ${input.sourceMode} mode.`;
  if (input.status === 'cache_fallback') return `${input.source} is missing live configuration but returned ${input.rowCount.toLocaleString('en-US')} cached news row${input.rowCount === 1 ? '' : 's'}.`;
  if (input.status === 'disabled') return `${input.source} news source is disabled.`;
  if (input.status === 'missing_config') return `${input.source} news source is enabled but required API configuration is missing.`;
  if (input.status === 'missing_snapshot') return `${input.source} snapshot mode returned no stored news rows.`;
  return `${input.source} returned no usable news rows.`;
}

export function buildPlayerNewsSourceDiagnostics(input: {
  sourceMode?: 'live' | 'snapshot';
  fantasyProsCount: number;
  sportsDataIoCount: number;
}): PlayerNewsSourceDiagnostic[] {
  const sourceMode = input.sourceMode || 'live';
  const fantasyProsStatus = sourceStatus({
    rowCount: input.fantasyProsCount,
    sourceMode,
    enabled: isFantasyProsSubSourceEnabled('news'),
    hasConfig: sourceMode === 'snapshot' || hasFantasyProsApiKey(),
  });
  const sportsDataIoStatus = sourceStatus({
    rowCount: input.sportsDataIoCount,
    sourceMode,
    enabled: sourceMode === 'snapshot' || isSportsDataIoNewsSourceEnabled(),
    hasConfig: sourceMode === 'snapshot' || hasSportsDataIoNewsApiKey(),
  });
  const rows = [
    {
      sourceKey: 'fantasypros-news-v1',
      source: 'FantasyPros news snapshot',
      status: fantasyProsStatus,
      rowCount: input.fantasyProsCount,
      sourceMode,
    },
    {
      sourceKey: SPORTSDATAIO_NEWS_SNAPSHOT_SOURCE_KEY,
      source: 'SportsDataIO/RotoBaller news snapshot',
      status: sportsDataIoStatus,
      rowCount: input.sportsDataIoCount,
      sourceMode,
    },
  ];

  return rows.map((row) => ({
    ...row,
    message: sourceMessage(row),
  }));
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
    sourceDiagnostics: buildPlayerNewsSourceDiagnostics({
      sourceMode: options.sourceMode,
      fantasyProsCount: fantasyProsNews.length,
      sportsDataIoCount: sportsDataIoNews.length,
    }),
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
