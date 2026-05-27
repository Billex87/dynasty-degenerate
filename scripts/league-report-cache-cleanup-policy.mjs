export const CURRENT_LEAGUE_REPORT_VERSION = 56;
export const CURRENT_LEAGUE_RANKINGS_VERSION = 13;

export function parseCleanupOptions(env = process.env) {
  const servingTtlHours = Number.parseFloat(env.LEAGUE_REPORT_CACHE_TTL_HOURS || '12') || 12;
  return {
    databaseUrl: env.DATABASE_URL || '',
    limit: Number.parseInt(env.LEAGUE_REPORT_CACHE_CLEANUP_LIMIT || '500', 10) || 500,
    dryRun: env.LEAGUE_REPORT_CACHE_CLEANUP_DRY_RUN !== 'false',
    confirmDelete: env.LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE === 'true',
    cleanupMode: env.LEAGUE_REPORT_CACHE_CLEANUP_MODE || 'versions',
    servingTtlHours,
    maxAgeHours: Number.parseFloat(env.LEAGUE_REPORT_CACHE_CLEANUP_MAX_AGE_HOURS || String(servingTtlHours)) || servingTtlHours,
    currentLeagueReportVersion: Number.parseInt(env.LEAGUE_REPORT_CACHE_CURRENT_VERSION || String(CURRENT_LEAGUE_REPORT_VERSION), 10) || CURRENT_LEAGUE_REPORT_VERSION,
    currentLeagueRankingsVersion: Number.parseInt(env.LEAGUE_RANKINGS_CACHE_CURRENT_VERSION || String(CURRENT_LEAGUE_RANKINGS_VERSION), 10) || CURRENT_LEAGUE_RANKINGS_VERSION,
  };
}

export function validateCleanupOptions(options) {
  const errors = [];
  if (!options.databaseUrl) {
    errors.push('DATABASE_URL is required to clean up leagueReportCache.');
  }
  if (!['versions', 'expired'].includes(options.cleanupMode)) {
    errors.push('LEAGUE_REPORT_CACHE_CLEANUP_MODE must be "versions" or "expired".');
  }
  if (!options.dryRun && !options.confirmDelete) {
    errors.push('Refusing to delete rows without LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE=true.');
    errors.push('Run the default dry run first, review the rows, and ask before deleting production rows.');
  }
  return errors;
}

export function getBoundedCleanupLimit(limit) {
  return Math.max(1, Math.min(5000, Math.floor(Number(limit) || 500)));
}

export function getExpiredCleanupCutoff(nowMs, maxAgeHours) {
  return new Date(nowMs - Math.max(1, Number(maxAgeHours) || 1) * 60 * 60 * 1000);
}

export function parseCacheKeyVersion(cacheKey) {
  const reportMatch = String(cacheKey || '').match(/^league-report-v([0-9]+):/);
  if (reportMatch) {
    return {
      family: 'league-report',
      version: Number(reportMatch[1]),
    };
  }

  const rankingsMatch = String(cacheKey || '').match(/^league-rankings-v([0-9]+):/);
  if (rankingsMatch) {
    return {
      family: 'league-rankings',
      version: Number(rankingsMatch[1]),
    };
  }

  return null;
}

export function isStaleVersionCacheKey(cacheKey, options = {}) {
  const parsed = parseCacheKeyVersion(cacheKey);
  if (!parsed) return false;

  const currentReportVersion = options.currentLeagueReportVersion || CURRENT_LEAGUE_REPORT_VERSION;
  const currentRankingsVersion = options.currentLeagueRankingsVersion || CURRENT_LEAGUE_RANKINGS_VERSION;

  if (parsed.family === 'league-report') return parsed.version < currentReportVersion;
  if (parsed.family === 'league-rankings') return parsed.version < currentRankingsVersion;
  return false;
}
