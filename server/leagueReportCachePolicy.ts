const DEFAULT_CACHE_TTL_HOURS = 12;
const DEFAULT_FILE_CACHE_MAX_FILES = 50;

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getLeagueReportCacheTtlHours(env: NodeJS.ProcessEnv = process.env): number {
  return readPositiveNumber(env.LEAGUE_REPORT_CACHE_TTL_HOURS, DEFAULT_CACHE_TTL_HOURS);
}

export function getLeagueReportCacheTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  return getLeagueReportCacheTtlHours(env) * 60 * 60 * 1000;
}

export function getLeagueReportFileCacheMaxFiles(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(env.LEAGUE_REPORT_FILE_CACHE_MAX_FILES || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FILE_CACHE_MAX_FILES;
}

export function isLeagueReportCacheExpired(updatedAtMs: number, nowMs = Date.now(), ttlMs = getLeagueReportCacheTtlMs()): boolean {
  return nowMs - updatedAtMs > ttlMs;
}

export function shouldPruneLeagueReportFileCacheEntry(input: {
  updatedAtMs: number;
  index: number;
  nowMs?: number;
  ttlMs?: number;
  maxFiles?: number;
}): boolean {
  const ttlMs = input.ttlMs ?? getLeagueReportCacheTtlMs();
  const maxFiles = input.maxFiles ?? getLeagueReportFileCacheMaxFiles();
  return isLeagueReportCacheExpired(input.updatedAtMs, input.nowMs ?? Date.now(), ttlMs) || input.index >= maxFiles;
}
