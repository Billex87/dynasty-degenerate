/**
 * Wayback Machine scraper for historical KTC data
 * Loads May 2025 rookie KTC values from archived snapshots
 */

import may2025RookieData from './may2025RookieKTCData.json' assert { type: 'json' };

/**
 * Get May 2025 KTC rookie values from the archived snapshot
 * Returns a map of player slug to KTC value
 */
export function getMay2025KTCSnapshot(): Record<string, { name: string; ktc_value: number }> {
  return may2025RookieData;
}

/**
 * Get a specific player's May 2025 KTC value by slug
 */
export function getMay2025KTCValue(playerSlug: string): number | null {
  const data = may2025RookieData[playerSlug as keyof typeof may2025RookieData];
  return data?.ktc_value || null;
}
