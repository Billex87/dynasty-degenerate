/**
 * Scrape Wayback Machine for historical KTC values from May 2025
 */

export async function scrapeWaybackMachineKTC(
  targetDate: string = '20250515' // May 15, 2025
): Promise<Record<string, { name: string; ktc_value: number }>> {
  try {
    // Wayback Machine API endpoint for KTC website
    // Format: https://archive.org/wayback/available?url=<url>&timestamp=<timestamp>
    const ktcUrl = 'www.keeptradecut.com';
    const waybackUrl = `https://archive.org/wayback/available?url=${ktcUrl}&timestamp=${targetDate}`;

    console.log(`[Wayback Machine] Fetching snapshot from ${targetDate}...`);
    const response = await fetch(waybackUrl);
    const data = await response.json();

    if (!data.archived_snapshots || data.archived_snapshots.length === 0) {
      console.warn(`[Wayback Machine] No snapshots found for ${targetDate}`);
      return {};
    }

    // Get the closest snapshot to the target date
    const snapshot = data.archived_snapshots[0];
    const snapshotUrl = `https://web.archive.org/web/${snapshot.timestamp}/${ktcUrl}`;

    console.log(`[Wayback Machine] Found snapshot: ${snapshotUrl}`);

    // Fetch the archived page
    const archivedResponse = await fetch(snapshotUrl);
    const html = await archivedResponse.text();

    // Parse the HTML to extract player data
    // This is a simplified parser - you may need to adjust based on actual KTC HTML structure
    const ktcData = parseKTCHTML(html);

    console.log(`[Wayback Machine] Extracted ${Object.keys(ktcData).length} players from May 2025`);
    return ktcData;
  } catch (error) {
    console.error('[Wayback Machine] Error scraping:', error);
    return {};
  }
}

/**
 * Parse KTC HTML to extract player values
 * This is a simplified parser - adjust based on actual KTC HTML structure
 */
function parseKTCHTML(html: string): Record<string, { name: string; ktc_value: number }> {
  const ktcData: Record<string, { name: string; ktc_value: number }> = {};

  // Look for player data in script tags or data attributes
  // KTC typically stores data in JSON format within the page
  try {
    // Try to find JSON data in the HTML
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[1]);
      // Extract player values from the JSON structure
      // This depends on KTC's actual data structure
      if (jsonData.players) {
        for (const player of jsonData.players) {
          const slug = createSlug(player.name);
          ktcData[slug] = {
            name: player.name,
            ktc_value: player.value || 0,
          };
        }
      }
    }
  } catch (error) {
    console.warn('[Wayback Machine] Could not parse JSON from HTML:', error);
  }

  return ktcData;
}

/**
 * Create a slug from player name for matching
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Alternative: Use a pre-captured KTC snapshot from May 2025
 * If Wayback Machine scraping doesn't work, you can manually provide the data
 */
export function getMay2025KTCSnapshot(): Record<string, { name: string; ktc_value: number }> {
  // This would be populated with actual KTC data from May 2025
  // For now, returning empty object - you'll need to populate this with real data
  return {};
}
