import { getCurrentKTCRankings } from './liveKTCScraper';

interface CurrentKTCData {
  [key: string]: {
    name: string;
    ktc_value: number;
    position_rank?: string;
  };
}

/**
 * Load current KTC position ranks from live scraper
 */
export async function loadCurrentKTCPositionRanks(): Promise<CurrentKTCData> {
  try {
    const rankings = await getCurrentKTCRankings();
    
    // Convert scraper format to currentKTCData format
    const result: CurrentKTCData = {};
    for (const [key, player] of Object.entries(rankings)) {
      result[key] = {
        name: player.name,
        ktc_value: player.ktc_value,
        position_rank: player.position_rank
      };
    }
    
    return result;
  } catch (error) {
    console.warn('Failed to load current KTC position ranks:', error);
    return {};
  }
}

export function clearCurrentKTCCache() {
  // Cache is managed by liveKTCScraper
}
