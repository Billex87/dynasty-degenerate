/**
 * Wayback Machine scraper for historical KTC data
 * Loads fixed rookie value baselines from archived snapshots
 */

import { getRookieValueBaseline } from './rookieValueBaselines';

/**
 * Get May 2025 KTC rookie values from the archived snapshot
 * Returns a map of player slug to KTC value
 */
export function getMay2025KTCSnapshot(): Record<string, { name: string; ktc_value: number }> {
  return getRookieValueBaseline('2025') || {};
}

/**
 * Get a specific player's May 2025 KTC value by slug
 */
export function getMay2025KTCValue(playerSlug: string): number | null {
  const may2025RookieData = getRookieValueBaseline('2025') || {};
  const data = may2025RookieData[playerSlug];
  return data?.ktc_value || null;
}
