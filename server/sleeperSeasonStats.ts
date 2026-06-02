import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { parseProviderSnapshotPayload } from './providerDataSnapshots';

export const MIN_SLEEPER_SEASON = 2017;

const SLEEPER_SEASON_STATS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SLEEPER_SEASON_STATS_CACHE_MAX_ENTRIES = 64;
const SLEEPER_SEASON_STATS_SOURCE_PREFIX = 'sleeper-season-stats-v1';
const sleeperSeasonStatsCache = new Map<string, { loadedAt: number; values: Record<string, any> }>();

type SleeperSeasonStatsLoadOptions = {
  sourceMode?: 'live' | 'snapshot';
  persistSnapshot?: boolean;
  forceRefresh?: boolean;
};

type SleeperSeasonStatsSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  season: string;
  week: number | null;
  values: Record<string, any>;
};

function getCacheKey(season: string, week?: number | null): string {
  return week ? `${season}:${week}` : season;
}

function getSourceKey(season: string, week?: number | null): string {
  return week
    ? `${SLEEPER_SEASON_STATS_SOURCE_PREFIX}:${season}:week-${week}`
    : `${SLEEPER_SEASON_STATS_SOURCE_PREFIX}:${season}`;
}

function pruneSleeperSeasonStatsCache(now = Date.now()) {
  for (const [cacheKey, cached] of Array.from(sleeperSeasonStatsCache.entries())) {
    if (now - cached.loadedAt > SLEEPER_SEASON_STATS_CACHE_TTL_MS) {
      sleeperSeasonStatsCache.delete(cacheKey);
    }
  }

  while (sleeperSeasonStatsCache.size >= SLEEPER_SEASON_STATS_CACHE_MAX_ENTRIES) {
    const oldestCacheKey = Array.from(sleeperSeasonStatsCache.entries())
      .sort((a, b) => a[1].loadedAt - b[1].loadedAt)[0]?.[0];
    if (!oldestCacheKey) break;
    sleeperSeasonStatsCache.delete(oldestCacheKey);
  }
}

function setCachedSleeperSeasonStats(cacheKey: string, values: Record<string, any>) {
  pruneSleeperSeasonStatsCache();
  sleeperSeasonStatsCache.set(cacheKey, {
    loadedAt: Date.now(),
    values,
  });
}

function parseSleeperSeasonStatsSnapshot(payload?: string | null): SleeperSeasonStatsSnapshotPayload | null {
  const parsed = parseProviderSnapshotPayload<Partial<SleeperSeasonStatsSnapshotPayload>>(payload);
  if (
    parsed?.schemaVersion !== 1 ||
    typeof parsed.season !== 'string' ||
    !parsed.values ||
    typeof parsed.values !== 'object' ||
    Array.isArray(parsed.values)
  ) {
    return null;
  }

  return parsed as SleeperSeasonStatsSnapshotPayload;
}

async function loadStoredSleeperSeasonStats(season: string, week?: number | null): Promise<Record<string, any>> {
  const cached = sleeperSeasonStatsCache.get(getCacheKey(season, week));
  if (cached && Date.now() - cached.loadedAt < SLEEPER_SEASON_STATS_CACHE_TTL_MS) {
    return cached.values;
  }

  const stored = await findLatestProviderDataSnapshot(getSourceKey(season, week));
  const snapshot = parseSleeperSeasonStatsSnapshot(stored?.payload);
  if (!snapshot || snapshot.season !== season || (snapshot.week ?? null) !== (week ?? null)) {
    return {};
  }

  setCachedSleeperSeasonStats(getCacheKey(season, week), snapshot.values);
  return snapshot.values;
}

async function persistSleeperSeasonStatsSnapshot(season: string, week: number | null, values: Record<string, any>) {
  const now = new Date();
  const payload: SleeperSeasonStatsSnapshotPayload = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    season,
    week,
    values,
  };

  await upsertProviderDataSnapshot({
    sourceKey: getSourceKey(season, week),
    snapshotKey: week ? `${season}-week-${String(week).padStart(2, '0')}` : season,
    payload: JSON.stringify(payload),
  });
}

async function fetchSleeperSeasonStatsFromApi(season: string, week?: number | null): Promise<Record<string, any>> {
  const response = await fetch(
    week
      ? `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`
      : `https://api.sleeper.app/v1/stats/nfl/regular/${season}`
  );
  if (!response.ok) {
    throw new Error(`Sleeper season stats ${response.status}`);
  }
  const values = await response.json();
  return values && typeof values === 'object' && !Array.isArray(values) ? values : {};
}

export async function fetchSleeperSeasonStats(
  season: string,
  week?: number | null,
  options: SleeperSeasonStatsLoadOptions = {}
): Promise<Record<string, any>> {
  if (options.sourceMode === 'snapshot') {
    return loadStoredSleeperSeasonStats(season, week);
  }

  const cacheKey = getCacheKey(season, week);
  const cached = sleeperSeasonStatsCache.get(cacheKey);
  if (!options.forceRefresh && cached && Date.now() - cached.loadedAt < SLEEPER_SEASON_STATS_CACHE_TTL_MS) {
    if (options.persistSnapshot) await persistSleeperSeasonStatsSnapshot(season, week ?? null, cached.values);
    return cached.values;
  }

  const values = await fetchSleeperSeasonStatsFromApi(season, week);
  setCachedSleeperSeasonStats(cacheKey, values);
  if (options.persistSnapshot) await persistSleeperSeasonStatsSnapshot(season, week ?? null, values);
  return values;
}

export async function refreshSleeperSeasonStatsSnapshots(options: {
  seasons?: string[];
} = {}) {
  const currentYear = new Date().getFullYear();
  const seasons = (options.seasons?.length
    ? options.seasons
    : Array.from({ length: Math.max(0, currentYear - MIN_SLEEPER_SEASON) }, (_, index) => String(MIN_SLEEPER_SEASON + index))
  ).filter((season) => /^\d{4}$/.test(season));

  const results = [];
  for (const season of seasons) {
    try {
      const values = await fetchSleeperSeasonStats(season, null, {
        forceRefresh: true,
        persistSnapshot: true,
      });
      results.push({
        season,
        status: 'loaded' as const,
        rowCount: Object.keys(values).length,
      });
    } catch (error) {
      results.push({
        season,
        status: 'error' as const,
        rowCount: 0,
        error: error instanceof Error ? error.message : String(error || 'Unknown error'),
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    seasons: results,
  };
}

export function clearSleeperSeasonStatsCacheForTests() {
  sleeperSeasonStatsCache.clear();
}
