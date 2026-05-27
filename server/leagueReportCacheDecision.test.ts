import { describe, expect, it } from 'vitest';
import { shouldBypassLeagueReportCache } from './leagueReportCacheDecision';

describe('league report cache decision', () => {
  it('does not bypass a valid report cache for live Sleeper refreshes', () => {
    expect(shouldBypassLeagueReportCache({ liveRefresh: true })).toBe(false);
    expect(shouldBypassLeagueReportCache({ forceRefresh: false, liveRefresh: true })).toBe(false);
  });

  it('only bypasses the report cache for approved force refreshes', () => {
    expect(shouldBypassLeagueReportCache({ forceRefresh: true })).toBe(true);
    expect(shouldBypassLeagueReportCache({ forceRefresh: true, liveRefresh: true })).toBe(true);
  });
});
