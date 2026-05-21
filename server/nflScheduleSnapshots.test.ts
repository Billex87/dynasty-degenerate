import { describe, expect, it } from 'vitest';
import {
  buildNflScheduleSnapshot,
  buildNflScheduleSnapshotKey,
  buildNflScheduleCoverageDiagnostics,
  getNflScheduleSnapshotDiagnostics,
  normalizeNflScheduleGames,
} from './nflScheduleSnapshots';

describe('nfl schedule snapshots', () => {
  it('normalizes schedule games with canonical teams and stable version keys', () => {
    const rows = normalizeNflScheduleGames({
      season: 2026,
      source: 'Official schedule feed',
      sourceVersion: 'release-1',
      sourceUrl: 'https://example.test/schedule',
      fetchedAt: '2026-05-15T12:00:00Z',
      publishedAt: '2026-05-15T09:00:00Z',
      seasonType: 'REG',
      rows: [
        {
          week: 1,
          gameId: 'game-1',
          homeTeam: 'JAC',
          awayTeam: 'ARZ',
          startsAt: '2026-09-13T17:00:00Z',
          gameStatus: 'scheduled',
          venue: 'EverBank Stadium',
          shortRest: true,
          travelDistanceBucket: 'long haul',
          venueType: 'outdoor',
          weatherSensitivity: 'wind-sensitive',
          divisionGame: true,
        },
        {
          week: 1,
          gameId: 'game-1',
          homeTeam: 'JAX',
          awayTeam: 'ARI',
          startsAt: '2026-09-13T17:00:00Z',
          gameStatus: 'scheduled',
        },
        {
          week: 1,
          homeTeam: 'FA',
          awayTeam: 'ARI',
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      season: '2026',
      week: 1,
      gameId: 'game-1',
      homeTeam: 'JAX',
      awayTeam: 'ARI',
      gameStatus: 'scheduled',
      sourceVersion: 'release-1',
      source: 'Official schedule feed',
      sourceUrl: 'https://example.test/schedule',
      publishedAt: '2026-05-15T09:00:00.000Z',
      seasonType: 'regular',
      shortRest: true,
      travelDistanceBucket: 'long-haul',
      venueType: 'outdoor',
      weatherSensitivity: 'wind-sensitive',
      divisionGame: true,
    });
    expect(buildNflScheduleSnapshotKey(2026, 'release-1')).toBe('2026:release-1');
  });

  it('stores metadata, checksum, and diagnostics for versioned schedule payloads', () => {
    const snapshot = buildNflScheduleSnapshot({
      season: 2026,
      source: 'Official schedule feed',
      sourceVersion: 'release-2',
      sourceUrl: 'https://example.test/schedule',
      fetchedAt: '2026-05-16T12:00:00Z',
      publishedAt: '2026-05-15T09:00:00Z',
      seasonType: 'regular',
      parserVersion: 3,
      rows: [
        { week: 1, gameId: 'a', homeTeam: 'JAX', awayTeam: 'ARI', startsAt: '2026-09-13T17:00:00Z', gameStatus: 'Scheduled' },
        { week: 1, gameId: 'b', homeTeam: 'Washington Commanders', awayTeam: 'NYG', startsAt: '2026-09-14T00:20:00Z', gameStatus: 'Final', neutralSite: false, internationalGame: true, projectedPlayoffWeekRelevance: true },
      ],
    });

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      sourceKey: 'nfl-schedule-games-v1',
      snapshotKey: '2026:release-2',
      rowCount: 2,
      parserVersion: 3,
      sourceVersion: 'release-2',
    });
    expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.rows[1]).toMatchObject({
      homeTeam: 'WAS',
      awayTeam: 'NYG',
      gameStatus: 'final',
      internationalGame: true,
      projectedPlayoffWeekRelevance: true,
    });
    expect(getNflScheduleSnapshotDiagnostics(snapshot)).toMatchObject({
      status: 'loaded',
      season: '2026',
      sourceVersion: 'release-2',
      rowCount: 2,
      duplicateGameCount: 0,
    });
  });

  it('returns a suppressive fallback diagnostic when no schedule snapshot exists', () => {
    expect(getNflScheduleSnapshotDiagnostics(null)).toMatchObject({
      status: 'empty',
      rowCount: 0,
      note: expect.stringContaining('suppress projection-specific game claims'),
    });
  });

  it('compares stored schedule weeks against Sleeper and provider projection weeks', () => {
    const snapshot = buildNflScheduleSnapshot({
      season: 2026,
      source: 'Official schedule feed',
      sourceVersion: 'release-2',
      rows: [
        { week: 1, gameId: 'a', homeTeam: 'ARI', awayTeam: 'JAX' },
        { week: 2, gameId: 'b', homeTeam: 'WAS', awayTeam: 'NYG' },
      ],
    });

    expect(buildNflScheduleCoverageDiagnostics({
      snapshot,
      sleeperWeeks: [1, 2, 3],
      providerProjectionWeeks: [2, 4],
    })).toMatchObject({
      status: 'week-mismatch',
      scheduleWeeks: [1, 2],
      missingSleeperWeeks: [3],
      missingProviderProjectionWeeks: [4],
      note: expect.stringContaining('suppress projection-specific claims'),
    });

    expect(buildNflScheduleCoverageDiagnostics({
      snapshot: null,
      season: 2026,
      sleeperWeeks: [1],
    })).toMatchObject({
      status: 'missing-schedule',
      missingSleeperWeeks: [1],
    });
  });
});
