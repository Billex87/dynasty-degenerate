export function shouldBypassLeagueReportCache(input: {
  forceRefresh?: boolean;
  liveRefresh?: boolean;
}): boolean {
  return Boolean(input.forceRefresh);
}
