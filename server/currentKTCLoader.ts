import fs from 'fs';
import path from 'path';

interface CurrentKTCData {
  [key: string]: {
    name: string;
    ktc_value: number;
    position_rank?: string;
  };
}

let currentKTCCache: CurrentKTCData | null = null;

/**
 * Load current KTC position ranks
 * This loads from a JSON file that should be updated regularly with current KTC data
 */
export async function loadCurrentKTCPositionRanks(): Promise<CurrentKTCData> {
  if (currentKTCCache) return currentKTCCache;

  try {
    // Try to load from current KTC file
    const filePath = path.join(process.cwd(), 'client', 'public', 'ktc_current_ranks.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      currentKTCCache = JSON.parse(data);
      return currentKTCCache || {};
    }
  } catch (error) {
    console.warn('Failed to load current KTC position ranks:', error);
  }

  // Return empty object if file doesn't exist or fails to load
  return {};
}

export function clearCurrentKTCCache() {
  currentKTCCache = null;
}
