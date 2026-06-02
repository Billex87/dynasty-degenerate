const NFL_HEADSHOT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NFL_HEADSHOT_CACHE_MAX_ENTRIES = 500;
const headshotCache: Map<string, { cachedAt: number; url: string | null }> = new Map();

/**
 * Convert player name to NFL.com URL format
 * Example: "Ashton Jeanty" -> "ashton-jeanty"
 */
function playerNameToNFLUrl(playerName: string): string {
  return playerName
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // Remove special characters
    .trim()
    .replace(/\s+/g, '-'); // Replace spaces with hyphens
}

function getCachedHeadshot(cacheKey: string): string | null | undefined {
  const cached = headshotCache.get(cacheKey);
  if (!cached) return undefined;
  if (Date.now() - cached.cachedAt > NFL_HEADSHOT_CACHE_TTL_MS) {
    headshotCache.delete(cacheKey);
    return undefined;
  }
  return cached.url;
}

function pruneHeadshotCache(now = Date.now()): void {
  for (const [cacheKey, cached] of Array.from(headshotCache.entries())) {
    if (now - cached.cachedAt > NFL_HEADSHOT_CACHE_TTL_MS) {
      headshotCache.delete(cacheKey);
    }
  }

  while (headshotCache.size >= NFL_HEADSHOT_CACHE_MAX_ENTRIES) {
    const oldestCacheKey = headshotCache.keys().next().value;
    if (!oldestCacheKey) break;
    headshotCache.delete(oldestCacheKey);
  }
}

function setCachedHeadshot(cacheKey: string, url: string | null): void {
  headshotCache.delete(cacheKey);
  pruneHeadshotCache();
  headshotCache.set(cacheKey, { cachedAt: Date.now(), url });
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 3000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch player headshot from NFL.com
 * Returns the headshot URL or null if not found
 */
export async function fetchNFLHeadshot(playerName: string): Promise<string | null> {
  const cacheKey = playerNameToNFLUrl(playerName);
  if (!cacheKey) return null;

  // Check cache first
  const cached = getCachedHeadshot(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const playerPageUrl = `https://www.nfl.com/players/${cacheKey}/`;

    const response = await fetchWithTimeout(playerPageUrl, 3000);
    if (!response.ok) {
      setCachedHeadshot(cacheKey, null);
      return null;
    }

    const html = await response.text();
    
    // Look for og:image meta tag which contains the headshot
    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    
    if (ogImageMatch && ogImageMatch[1]) {
      const headshotUrl = ogImageMatch[1];
      setCachedHeadshot(cacheKey, headshotUrl);
      return headshotUrl;
    }

    setCachedHeadshot(cacheKey, null);
    return null;
  } catch (error) {
    console.warn(`[NFL Headshot Fetcher] Timeout or error fetching headshot for ${playerName}, continuing without headshot`);
    setCachedHeadshot(cacheKey, null);
    return null;
  }
}

/**
 * Clear the headshot cache
 */
export function clearHeadshotCache(): void {
  headshotCache.clear();
}
