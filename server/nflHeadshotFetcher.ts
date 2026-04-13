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

    const response = await fetch(playerPageUrl);
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
    console.error(`[NFL Headshot Fetcher] Error fetching headshot for ${playerName}:`, error);
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
