import { describe, expect, it } from 'vitest';
import {
  parseLeagueReportCachePayloadFromStorage,
  serializeLeagueReportCachePayloadForStorage,
} from './db';

describe('league report cache compression', () => {
  it('keeps small payloads as plain JSON for readability', () => {
    const payload = { reportData: { leagueName: 'Skids Get Beat' } };
    const stored = serializeLeagueReportCachePayloadForStorage(payload);

    expect(stored).toBe(JSON.stringify(payload));
    expect(parseLeagueReportCachePayloadFromStorage(stored)).toEqual(payload);
  });

  it('compresses large payloads and restores the original object shape', () => {
    const rows = Array.from({ length: 3500 }, (_, index) => ({
      id: `rank-${index}`,
      name: `Player ${index}`,
      source: 'league-rankings-v13',
      note: 'Repeated rankings data should compress before it is written to the persistent cache.',
    }));
    const payload = { rankings: { profiles: { devy_sf_ppr: rows } } };
    const raw = JSON.stringify(payload);
    const stored = serializeLeagueReportCachePayloadForStorage(payload);

    expect(stored).toContain('__ddCacheEncoding');
    expect(stored.length).toBeLessThan(raw.length / 4);
    expect(parseLeagueReportCachePayloadFromStorage(stored)).toEqual(payload);
  });
});
