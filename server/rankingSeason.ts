const MIN_CURRENT_RANKING_SEASON = 2026;

function normalizeRankingSeason(value?: string | number | null): string | null {
  const season = String(value || '').trim();
  if (!/^20\d{2}$/.test(season)) return null;
  return season;
}

export function getCurrentRankingSeason(
  date = new Date(),
  env: Record<string, string | undefined> = process.env,
): string {
  const configuredSeason = normalizeRankingSeason(env.RANKINGS_SEASON)
    || normalizeRankingSeason(env.FANTASYPROS_RANKINGS_SEASON);
  if (configuredSeason) return configuredSeason;

  return String(Math.max(MIN_CURRENT_RANKING_SEASON, date.getFullYear()));
}
