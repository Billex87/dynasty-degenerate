import { describe, expect, it } from 'vitest';
import {
  getLeagueReportCacheTtlHours,
  getLeagueReportCacheTtlMs,
  getLeagueReportFileCacheMaxFiles,
  isLeagueReportCacheExpired,
  shouldPruneLeagueReportFileCacheEntry,
  shouldUseLeagueReportFileCache,
} from './leagueReportCachePolicy';

describe('league report cache policy', () => {
  it('uses the 72 hour serving TTL by default', () => {
    expect(getLeagueReportCacheTtlHours({} as NodeJS.ProcessEnv)).toBe(72);
    expect(getLeagueReportCacheTtlMs({} as NodeJS.ProcessEnv)).toBe(72 * 60 * 60 * 1000);
    expect(getLeagueReportFileCacheMaxFiles({} as NodeJS.ProcessEnv)).toBe(250);
  });

  it('allows explicit TTL and file-retention tuning', () => {
    expect(getLeagueReportCacheTtlHours({ LEAGUE_REPORT_CACHE_TTL_HOURS: '6' } as NodeJS.ProcessEnv)).toBe(6);
    expect(getLeagueReportFileCacheMaxFiles({ LEAGUE_REPORT_FILE_CACHE_MAX_FILES: '12' } as NodeJS.ProcessEnv)).toBe(12);
  });

  it('skips local file-cache reads and writes on Vercel serverless runtimes', () => {
    expect(shouldUseLeagueReportFileCache({} as NodeJS.ProcessEnv)).toBe(true);
    expect(shouldUseLeagueReportFileCache({ VERCEL: '0' } as NodeJS.ProcessEnv)).toBe(true);
    expect(shouldUseLeagueReportFileCache({ VERCEL: '1' } as NodeJS.ProcessEnv)).toBe(false);
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
