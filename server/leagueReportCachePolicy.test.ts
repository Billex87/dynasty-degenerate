import { describe, expect, it } from 'vitest';
import {
  getLeagueReportCacheTtlHours,
  getLeagueReportCacheTtlMs,
  getLeagueReportFileCacheMaxFiles,
  isLeagueReportCacheExpired,
  shouldPruneLeagueReportFileCacheEntry,
} from './leagueReportCachePolicy';

describe('league report cache policy', () => {
  it('uses the 12 hour serving TTL by default', () => {
    expect(getLeagueReportCacheTtlHours({} as NodeJS.ProcessEnv)).toBe(12);
    expect(getLeagueReportCacheTtlMs({} as NodeJS.ProcessEnv)).toBe(12 * 60 * 60 * 1000);
  });

  it('allows explicit TTL and file-retention tuning', () => {
    expect(getLeagueReportCacheTtlHours({ LEAGUE_REPORT_CACHE_TTL_HOURS: '6' } as NodeJS.ProcessEnv)).toBe(6);
    expect(getLeagueReportFileCacheMaxFiles({ LEAGUE_REPORT_FILE_CACHE_MAX_FILES: '12' } as NodeJS.ProcessEnv)).toBe(12);
  });

  it('treats stale or overflow file-cache entries as prunable', () => {
    const now = Date.UTC(2026, 4, 15, 12);
    const ttlMs = 12 * 60 * 60 * 1000;

    expect(isLeagueReportCacheExpired(now - ttlMs - 1, now, ttlMs)).toBe(true);
    expect(isLeagueReportCacheExpired(now - ttlMs + 1, now, ttlMs)).toBe(false);
    expect(shouldPruneLeagueReportFileCacheEntry({ updatedAtMs: now - 1000, index: 4, nowMs: now, ttlMs, maxFiles: 5 })).toBe(false);
    expect(shouldPruneLeagueReportFileCacheEntry({ updatedAtMs: now - 1000, index: 5, nowMs: now, ttlMs, maxFiles: 5 })).toBe(true);
  });
});
