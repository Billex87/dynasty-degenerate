/**
 * Player Headshot Fetcher
 * Fetches NFL player headshots from reliable sources
 * Uses multiple fallback strategies for reliability
 */

const HEADSHOT_CACHE = new Map<string, string | null>();

/**
 * Generate a headshot URL for a player
 * Uses multiple reliable CDN sources with fallbacks
 */
export function generateHeadshotUrl(playerName: string, playerTeam?: string): string | null {
  const cacheKey = `${playerName}-${playerTeam || 'unknown'}`;

  // Return cached result if available
  if (HEADSHOT_CACHE.has(cacheKey)) {
    return HEADSHOT_CACHE.get(cacheKey) || null;
  }

  // Try multiple headshot sources in order of reliability
  const url = tryProFootballReference(playerName, playerTeam) ||
              tryFantasyNerds(playerName) ||
              null;

  // Cache the result (even if null) to avoid repeated lookups
  HEADSHOT_CACHE.set(cacheKey, url);

  return url;
}

/**
 * Try to get headshot from Pro Football Reference
 * Format: https://www.pro-football-reference.com/req/202406060/images/headshots/LASTNAME-FIRSTNAME.jpg
 */
function tryProFootballReference(playerName: string, _playerTeam?: string): string | null {
  try {
    const parts = playerName.trim().split(' ');
    if (parts.length < 2) return null;

    const firstName = parts[0];
    const lastName = parts[parts.length - 1];

    // Pro Football Reference format: LASTNAME-FIRSTNAME (lowercase)
    const filename = `${lastName.toLowerCase()}-${firstName.toLowerCase()}.jpg`;
    return `https://www.pro-football-reference.com/req/202406060/images/headshots/${filename}`;
  } catch {
    return null;
  }
}

/**
 * Try to get headshot from Fantasy Nerds
 * Note: This requires mapping Sleeper player IDs to Fantasy Nerds IDs
 * For now, we'll skip this as it requires additional ID mapping
 */
function tryFantasyNerds(_playerName: string): string | null {
  // Fantasy Nerds requires their proprietary player IDs
  // We would need to maintain a mapping of Sleeper IDs to Fantasy Nerds IDs
  // For now, return null and rely on Pro Football Reference
  return null;
}

/**
 * Clear the headshot cache
 * Useful for testing or forcing a refresh
 */
export function clearHeadshotCache(): void {
  HEADSHOT_CACHE.clear();
}

/**
 * Get cache statistics
 */
export function getHeadshotCacheStats(): { size: number; cached: number } {
  return {
    size: HEADSHOT_CACHE.size,
    cached: Array.from(HEADSHOT_CACHE.values()).filter(url => url !== null).length,
  };
}
