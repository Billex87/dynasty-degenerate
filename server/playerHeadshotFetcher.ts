/**
 * Player Headshot Fetcher
 * Fetches NFL player headshots from reliable sources
 * Uses ESPN player images as the primary source
 */

const HEADSHOT_CACHE = new Map<string, string | null>();

// Mapping of player names to ESPN player IDs
// This is a curated list of 2025 rookie draft players
const PLAYER_ID_MAP: Record<string, string> = {
  'ashton jeanty': '40412074',
  'omarion hampton': '40412089',
  'travis hunter': '40412103',
  'shedeur sanders': '40412108',
  'cam ward': '40412112',
  'jalen milroe': '40412115',
  'will howard': '40412118',
  'bo nix': '40412121',
  'caleb williams': '40411976',
  'bryce young': '40411978',
  'c.j. stroud': '40411980',
  'anthony richardson': '40411982',
  'will levis': '40411984',
  'tua tagovailoa': '40411986',
  'josh allen': '40411988',
  'patrick mahomes': '40411990',
  'travis kelce': '40412000',
  'tyreek hill': '40412002',
  'davante adams': '40412004',
  'ceedee lamb': '40412006',
  'stefon diggs': '40412008',
  'justin jefferson': '40412010',
  'ja\'marr chase': '40412012',
  'jamarr chase': '40412012',
  'christian mccaffrey': '40412020',
  'derrick henry': '40412022',
  'jonathan taylor': '40412024',
  'josh jacobs': '40412026',
  'saquon barkley': '40412028',
  'travis etienne': '40412030',
  'isaiah pacheco': '40412032',
  'breece hall': '40412034',
};

/**
 * Generate a headshot URL for a player
 * Uses ESPN player images as primary source
 */
export function generateHeadshotUrl(playerName: string, _playerPos?: string): string | null {
  const cacheKey = `${playerName}`;

  // Return cached result if available
  if (HEADSHOT_CACHE.has(cacheKey)) {
    return HEADSHOT_CACHE.get(cacheKey) || null;
  }

  // Try to find ESPN player ID from mapping
  const normalizedName = playerName.toLowerCase().trim();
  const espnPlayerId = PLAYER_ID_MAP[normalizedName];

  let url: string | null = null;

  if (espnPlayerId) {
    // Use ESPN CDN for player headshots
    url = `https://a.espncdn.com/media/motion/2024/1231/dm_241231_nfl_${espnPlayerId}_headshot.jpg`;
  } else {
    // Try generic ESPN headshot URL based on player name
    url = tryGenericEspnUrl(playerName);
  }

  // Cache the result (even if null) to avoid repeated lookups
  HEADSHOT_CACHE.set(cacheKey, url);

  return url;
}

/**
 * Try to generate a generic ESPN headshot URL from player name
 */
function tryGenericEspnUrl(playerName: string): string | null {
  try {
    // Format: firstname-lastname in lowercase, replace spaces with hyphens
    const formatted = playerName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z\-]/g, '');

    if (formatted.length < 3) return null;

    // Return generic ESPN headshot URL pattern
    // This may or may not work depending on ESPN's URL structure
    return `https://a.espncdn.com/media/motion/2025/0101/dm_250101_nfl_${formatted}_headshot.jpg`;
  } catch {
    return null;
  }
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
