/**
 * Image Proxy Service
 * Fetches and caches player headshots from external sources
 * Bypasses CDN restrictions by using proper browser headers
 */

// Using built-in fetch (Node 18+)

const IMAGE_CACHE = new Map<string, { data: Buffer; contentType: string; timestamp: number }>();
const IMAGE_MISS_CACHE = new Map<string, { status?: number; timestamp: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MISS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const IMAGE_CACHE_MAX_ITEMS = 300;
const IMAGE_MISS_CACHE_MAX_ITEMS = 1000;

// Sleeper player image URL pattern
// Format: https://sleepercdn.com/content/nfl/players/{player_id}.jpg
function getSleeperImageUrl(playerId: string): string {
  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
}

function pruneTimedCache<T extends { timestamp: number }>(
  cache: Map<string, T>,
  ttlMs: number,
  maxItems: number,
  now = Date.now()
): void {
  for (const [cacheKey, cached] of Array.from(cache.entries())) {
    if (now - cached.timestamp > ttlMs) {
      cache.delete(cacheKey);
    }
  }

  while (cache.size >= maxItems) {
    const oldestCacheKey = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
    if (!oldestCacheKey) break;
    cache.delete(oldestCacheKey);
  }
}

function pruneImageCache(now = Date.now()): void {
  pruneTimedCache(IMAGE_CACHE, CACHE_TTL, IMAGE_CACHE_MAX_ITEMS, now);
}

function pruneImageMissCache(now = Date.now()): void {
  pruneTimedCache(IMAGE_MISS_CACHE, MISS_CACHE_TTL, IMAGE_MISS_CACHE_MAX_ITEMS, now);
}

function pruneImageCaches(now = Date.now()): void {
  pruneImageCache(now);
  pruneImageMissCache(now);
}

function setImageMiss(cacheKey: string, value: { status?: number; timestamp?: number }): void {
  pruneImageMissCache();
  IMAGE_MISS_CACHE.set(cacheKey, { ...value, timestamp: value.timestamp ?? Date.now() });
}

function setCachedImage(cacheKey: string, value: { data: Buffer; contentType: string; timestamp?: number }): void {
  pruneImageCache();
  IMAGE_CACHE.set(cacheKey, { ...value, timestamp: value.timestamp ?? Date.now() });
  IMAGE_MISS_CACHE.delete(cacheKey);
}

/**
 * Fetch a player headshot image with proper browser headers
 */
export async function fetchPlayerHeadshot(playerId: string): Promise<Buffer | null> {
  const cacheKey = `sleeper-${playerId}`;

  // Check cache
  const cached = IMAGE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const cachedMiss = IMAGE_MISS_CACHE.get(cacheKey);
  if (cachedMiss && Date.now() - cachedMiss.timestamp < MISS_CACHE_TTL) {
    return null;
  } else if (cachedMiss) {
    IMAGE_MISS_CACHE.delete(cacheKey);
  }

  try {
    const imageUrl = getSleeperImageUrl(playerId);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Fetch with browser-like headers to bypass restrictions
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://sleeper.app/',
        'Origin': 'https://sleeper.app',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      setImageMiss(cacheKey, { status: response.status });
      if (response.status !== 403 && response.status !== 404) {
        console.warn(`Failed to fetch image for player ${playerId}: ${response.status}`);
      }
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cache the image
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    setCachedImage(cacheKey, {
      data: buffer,
      contentType,
    });

    return buffer;
  } catch (error) {
    setImageMiss(cacheKey, {});
    if (!(error instanceof Error && error.name === 'AbortError')) {
      console.warn(`Error fetching headshot for player ${playerId}:`, error);
    }
    return null;
  }
}

/**
 * Get cached image data
 */
export function getCachedImage(playerId: string): { data: Buffer; contentType: string } | null {
  const cacheKey = `sleeper-${playerId}`;
  const cached = IMAGE_CACHE.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { data: cached.data, contentType: cached.contentType };
  }

  if (cached) IMAGE_CACHE.delete(cacheKey);

  return null;
}

/**
 * Clear image cache
 */
export function clearImageCache(): void {
  IMAGE_CACHE.clear();
  IMAGE_MISS_CACHE.clear();
}

/**
 * Get cache statistics
 */
export function getImageCacheStats(): { size: number; items: number; misses: number } {
  pruneImageCaches();
  return {
    size: Array.from(IMAGE_CACHE.values()).reduce((sum, item) => sum + item.data.length, 0),
    items: IMAGE_CACHE.size,
    misses: IMAGE_MISS_CACHE.size,
  };
}
