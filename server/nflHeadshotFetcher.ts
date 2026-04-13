const headshotCache: Map<string, string | null> = new Map();

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
  // Check cache first
  if (headshotCache.has(playerName)) {
    return headshotCache.get(playerName) || null;
  }

  try {
    const nflUrlName = playerNameToNFLUrl(playerName);
    const playerPageUrl = `https://www.nfl.com/players/${nflUrlName}/`;

    const response = await fetchWithTimeout(playerPageUrl, 3000);
    if (!response.ok) {
      headshotCache.set(playerName, null);
      return null;
    }

    const html = await response.text();
    
    // Look for og:image meta tag which contains the headshot
    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    
    if (ogImageMatch && ogImageMatch[1]) {
      const headshotUrl = ogImageMatch[1];
      headshotCache.set(playerName, headshotUrl);
      return headshotUrl;
    }

    headshotCache.set(playerName, null);
    return null;
  } catch (error) {
    console.warn(`[NFL Headshot Fetcher] Timeout or error fetching headshot for ${playerName}, continuing without headshot`);
    headshotCache.set(playerName, null);
    return null;
  }
}

/**
 * Clear the headshot cache
 */
export function clearHeadshotCache(): void {
  headshotCache.clear();
}
