import { describe, expect, it } from 'vitest';
import {
  CURRENT_LEAGUE_RANKINGS_VERSION,
  CURRENT_LEAGUE_REPORT_VERSION,
  getBoundedCleanupLimit,
  getExpiredCleanupCutoff,
  isStaleVersionCacheKey,
  parseCacheKeyVersion,
  parseCleanupOptions,
  validateCleanupOptions,
} from '../scripts/league-report-cache-cleanup-policy.mjs';

describe('league report cache cleanup policy', () => {
  it('defaults to a safe dry run', () => {
    const options = parseCleanupOptions({
      DATABASE_URL: 'postgres://example',
    });

    expect(options).toMatchObject({
      dryRun: true,
      confirmDelete: false,
      cleanupMode: 'versions',
      limit: 500,
      servingTtlHours: 12,
      maxAgeHours: 12,
      currentLeagueReportVersion: CURRENT_LEAGUE_REPORT_VERSION,
      currentLeagueRankingsVersion: CURRENT_LEAGUE_RANKINGS_VERSION,
    });
    expect(validateCleanupOptions(options)).toEqual([]);
  });

  it('refuses destructive deletes unless explicitly confirmed', () => {
    const options = parseCleanupOptions({
      DATABASE_URL: 'postgres://example',
      LEAGUE_REPORT_CACHE_CLEANUP_DRY_RUN: 'false',
    });

    expect(options.dryRun).toBe(false);
    expect(validateCleanupOptions(options)).toEqual([
      'Refusing to delete rows without LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE=true.',
      'Run the default dry run first, review the rows, and ask before deleting production rows.',
    ]);
  });

  it('allows destructive mode only when confirm-delete is set', () => {
    const options = parseCleanupOptions({
      DATABASE_URL: 'postgres://example',
      LEAGUE_REPORT_CACHE_CLEANUP_DRY_RUN: 'false',
      LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE: 'true',
    });

    expect(validateCleanupOptions(options)).toEqual([]);
  });

  it('validates cleanup mode and database configuration', () => {
    const options = parseCleanupOptions({
      LEAGUE_REPORT_CACHE_CLEANUP_MODE: 'everything',
    });

    expect(validateCleanupOptions(options)).toEqual([
      'DATABASE_URL is required to clean up leagueReportCache.',
      'LEAGUE_REPORT_CACHE_CLEANUP_MODE must be "versions" or "expired".',
    ]);
  });

  it('uses explicit max-age hours for expired cleanup cutoffs', () => {
    const options = parseCleanupOptions({
      DATABASE_URL: 'postgres://example',
      LEAGUE_REPORT_CACHE_TTL_HOURS: '72',
      LEAGUE_REPORT_CACHE_CLEANUP_MAX_AGE_HOURS: '24',
    });
    const cutoff = getExpiredCleanupCutoff(Date.parse('2026-05-27T12:00:00.000Z'), options.maxAgeHours);

    expect(options.servingTtlHours).toBe(72);
    expect(options.maxAgeHours).toBe(24);
    expect(cutoff.toISOString()).toBe('2026-05-26T12:00:00.000Z');
  });

  it('bounds cleanup limits to avoid accidental huge deletes', () => {
    expect(getBoundedCleanupLimit(-10)).toBe(1);
    expect(getBoundedCleanupLimit(25.8)).toBe(25);
    expect(getBoundedCleanupLimit(50_000)).toBe(5000);
  });

  it('targets stale report and ranking cache versions only', () => {
    const options = {
      currentLeagueReportVersion: 56,
      currentLeagueRankingsVersion: 13,
    };

    expect(parseCacheKeyVersion('league-report-v55:123:league')).toEqual({
      family: 'league-report',
      version: 55,
    });
    expect(isStaleVersionCacheKey('league-report-v55:123:league', options)).toBe(true);
    expect(isStaleVersionCacheKey('league-report-v56:123:league', options)).toBe(false);
    expect(isStaleVersionCacheKey('league-report-v57:123:league', options)).toBe(false);
    expect(isStaleVersionCacheKey('league-rankings-v12:123:league', options)).toBe(true);
    expect(isStaleVersionCacheKey('league-rankings-v13:123:league', options)).toBe(false);
    expect(isStaleVersionCacheKey('league-report-static-inputs-v2:profile', options)).toBe(false);
    expect(isStaleVersionCacheKey('not-a-cache-key', options)).toBe(false);
  });
});
