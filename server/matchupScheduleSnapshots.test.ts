import { describe, expect, it } from 'vitest';
import {
  buildMatchupScheduleSnapshot,
  getMatchupScheduleSnapshotKey,
  getMatchupScheduleSnapshotFreshness,
  getMatchupScheduleSourceKey,
  normalizeMatchupScheduleRows,
} from './matchupScheduleSnapshots';

describe('matchup schedule snapshots', () => {
  it('normalizes player and team-defense matchup rows with source versions', () => {
    const rows = normalizeMatchupScheduleRows({
      season: 2026,
      position: 'DST',
      source: 'fantasypros',
      sourceVersion: 'fp-matchups-v1',
      fetchedAt: '2026-08-20T12:00:00Z',
      rows: [
        {
          season: 2026,
          position: 'DST',
          source: 'fantasypros',
          teamDefenseId: 'JAC',
          playerName: 'Jacksonville Jaguars',
          team: 'JAC',
          week: 1,
          opponent: 'ARZ',
          homeAway: 'home',
          ecr: 13,
          matchupStars: 5,
          opponentRank: 30,
          sourceUrl: 'https://example.test/dst',
        },
        {
          season: 2026,
          position: 'WR',
          source: 'fantasypros',
          playerId: 'wr1',
          week: 1,
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowKey: '2026:DST:fantasypros:JAC:1:ARI:fp-matchups-v1',
      teamDefenseId: 'JAC',
      team: 'JAX',
      opponent: 'ARI',
      homeAway: 'home',
      ecr: 13,
      matchupTier: 'easy',
      sourceVersion: 'fp-matchups-v1',
    });
  });

  it('builds a checksum-backed snapshot payload', () => {
    const snapshot = buildMatchupScheduleSnapshot({
      season: 2026,
      position: 'WR',
      source: 'draftsharks',
      sourceVersion: 'release-3',
      fetchedAt: '2026-08-20T12:00:00Z',
      parserVersion: 2,
      rows: [
        {
          season: 2026,
          position: 'WR',
          source: 'draftsharks',
          playerId: 'p1',
          playerName: 'Wide Receiver',
          team: 'WAS',
          week: 2,
          opponent: 'NYG',
          matchupRating: 62,
          matchupTier: 'neutral',
        },
      ],
    });

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      sourceKey: 'matchup-calendar-sos-v1:draftsharks:2026:WR',
      snapshotKey: '2026:release-3',
      source: 'draftsharks',
      position: 'WR',
      rowCount: 1,
      parserVersion: 2,
      refreshCadenceHours: 72,
      expiresAt: '2026-08-23T12:00:00.000Z',
    });
    expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(getMatchupScheduleSourceKey(snapshot)).toBe(snapshot.sourceKey);
    expect(getMatchupScheduleSnapshotKey(snapshot)).toBe(snapshot.snapshotKey);
  });

  it('reports matchup snapshot freshness by preseason and in-season cadence', () => {
    const snapshot = buildMatchupScheduleSnapshot({
      season: 2026,
      position: 'QB',
      source: 'internal',
      sourceVersion: 'release-1',
      fetchedAt: '2026-09-10T12:00:00Z',
      rows: [
        { season: 2026, position: 'QB', source: 'internal', playerId: 'qb1', playerName: 'QB One', week: 1, opponent: 'DAL' },
      ],
    });

    expect(snapshot.refreshCadenceHours).toBe(24);
    expect(getMatchupScheduleSnapshotFreshness(snapshot, new Date('2026-09-11T06:00:00Z'))).toMatchObject({
      status: 'fresh',
      phase: 'in-season',
    });
    expect(getMatchupScheduleSnapshotFreshness(snapshot, new Date('2026-09-11T10:30:00Z'))).toMatchObject({
      status: 'stale',
    });
    expect(getMatchupScheduleSnapshotFreshness(snapshot, new Date('2026-09-12T12:00:00Z'))).toMatchObject({
      status: 'expired',
      note: expect.stringContaining('suppress matchup-driven reads'),
    });
  });
});
