import { describe, expect, it } from 'vitest';
import {
  buildNflverseScheduleSnapshot,
  parseNflverseScheduleCsv,
} from './nflverseScheduleSnapshot';

const csv = [
  'game_id,season,game_type,week,gameday,gametime,away_team,home_team,location,result,away_rest,home_rest,stadium,roof',
  '2026_01_ARI_JAX,2026,REG,1,2026-09-13,13:00,ARI,JAC,Home,,7,7,EverBank Stadium,outdoors',
  '2026_15_DAL_PHI,2026,REG,15,2026-12-20,20:20,DAL,PHI,Neutral,,5,10,Neutral Site,dome',
  '2026_01_NYG_WAS,2026,PRE,1,2026-08-15,19:00,NYG,WAS,Home,,7,7,Northwest Stadium,outdoors',
  '2025_01_ARI_JAX,2025,REG,1,2025-09-07,13:00,ARI,JAC,Home,,7,7,EverBank Stadium,outdoors',
].join('\n');

describe('nflverse schedule snapshot import', () => {
  it('parses regular-season nflverse CSV rows into normalized schedule inputs', () => {
    const rows = parseNflverseScheduleCsv(csv, 2026);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      season: '2026',
      week: '1',
      gameId: '2026_01_ARI_JAX',
      awayTeam: 'ARI',
      homeTeam: 'JAC',
      startsAt: '2026-09-13T13:00:00-04:00',
      gameStatus: 'scheduled',
      venue: 'EverBank Stadium',
      neutralSite: false,
      shortRest: false,
      longRest: false,
      venueType: 'outdoor',
      weatherSensitivity: 'weather-sensitive',
      seasonType: 'regular',
      projectedPlayoffWeekRelevance: false,
    });
    expect(rows[1]).toMatchObject({
      neutralSite: true,
      shortRest: true,
      longRest: true,
      venueType: 'dome',
      projectedPlayoffWeekRelevance: true,
    });
  });

  it('builds a persisted snapshot payload with canonical teams and source metadata', () => {
    const snapshot = buildNflverseScheduleSnapshot({
      csv,
      season: 2026,
      sourceVersion: 'nflverse-test-v1',
      fetchedAt: '2026-06-04T12:00:00Z',
      sourceUrl: 'https://example.test/schedules.csv',
    });

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      sourceKey: 'nfl-schedule-games-v1',
      snapshotKey: '2026:nflverse-test-v1',
      source: 'nflverse schedules CSV',
      sourceUrl: 'https://example.test/schedules.csv',
      sourceVersion: 'nflverse-test-v1',
      rowCount: 2,
      parserVersion: 1,
    });
    expect(snapshot.rows[0]).toMatchObject({
      homeTeam: 'JAX',
      awayTeam: 'ARI',
    });
  });
});
