import { describe, expect, it } from 'vitest';
import {
  buildPlayerProjectionIdentityDiagnostics,
  buildPlayerProjectionSnapshot,
  getPlayerProjectionRowKey,
  getPlayerProjectionSnapshotKey,
  getPlayerProjectionSourceKey,
  normalizePlayerProjectionRows,
} from './playerProjectionSnapshots';

describe('player projection snapshots', () => {
  it('normalizes projection rows with scoring, source, and player identity keys', () => {
    const normalized = normalizePlayerProjectionRows({
      season: 2026,
      week: 1,
      source: 'fantasypros',
      scoringProfile: 'ppr-superflex',
      projectionType: 'weekly',
      sourceVersion: 'fp-week1-v1',
      rows: [
        {
          playerId: '123',
          sourcePlayerId: 'fp-123',
          playerName: 'Starter One',
          team: 'JAC',
          position: 'WR',
          projectedFantasyPoints: '15.24',
          targets: 8,
          receptions: 5.4,
          receivingYards: 72.3,
          confidence: 82,
          expertCount: 41,
          rookie: 'false',
          matchConfidence: 99,
          providerUpdatedAt: '2026-09-08T12:00:00Z',
        },
      ],
    });

    expect(normalized.quarantinedRows).toHaveLength(0);
    expect(normalized.rows[0]).toMatchObject({
      rowKey: '2026:w1:fantasypros:weekly:PPR-SUPERFLEX:123:fp-week1-v1',
      playerId: '123',
      sourcePlayerId: 'fp-123',
      team: 'JAX',
      scoringProfile: 'PPR-SUPERFLEX',
      projectedFantasyPoints: 15.24,
      targets: 8,
      identityStatus: 'matched',
    });
    expect(getPlayerProjectionRowKey(normalized.rows[0])).toBe(normalized.rows[0].rowKey);
  });

  it('quarantines ambiguous, unsupported, and projection-less rows before they can power reads', () => {
    const normalized = normalizePlayerProjectionRows({
      season: 2026,
      week: 1,
      source: 'sportsdataio',
      scoringProfile: 'half-ppr',
      projectionType: 'weekly',
      sourceVersion: 'sdio-v1',
      rows: [
        { playerName: 'Ambiguous Name', sourcePlayerId: 'sd-1', team: 'ARI', position: 'RB', projectedFantasyPoints: 11, ambiguousMatch: true },
        { playerName: 'Bad Position', sourcePlayerId: 'sd-2', team: 'ARI', position: 'P', projectedFantasyPoints: 2 },
        { playerName: 'No Points', sourcePlayerId: 'sd-3', team: 'ARI', position: 'WR' },
        { playerName: 'Blank Points', sourcePlayerId: 'sd-4', team: 'ARI', position: 'WR', projectedFantasyPoints: '   ' },
        { position: 'WR', projectedFantasyPoints: 9 },
      ],
    });

    expect(normalized.rows).toHaveLength(0);
    expect(normalized.quarantinedRows.map((row) => row.reason)).toEqual([
      'ambiguous-identity',
      'unsupported-position',
      'missing-projection',
      'missing-projection',
      'missing-player',
    ]);
    expect(buildPlayerProjectionIdentityDiagnostics(normalized.rows, normalized.quarantinedRows)).toMatchObject({
      totalRows: 5,
      normalizedRows: 0,
      quarantinedRows: 5,
      ambiguousRows: 1,
      missingIdentityRows: 1,
    });
  });

  it('builds versioned snapshot payloads with freshness metadata and checksums', () => {
    const snapshot = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'fantasynerds',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'nerds-week1-v3',
      fetchedAt: '2026-09-08T15:00:00Z',
      publishedAt: '2026-09-08T14:30:00Z',
      validForWeek: 1,
      providerUpdatedAt: '2026-09-08T14:45:00Z',
      missingStarterCount: 2,
      parserVersion: 4,
      rows: [
        { playerId: '1', sourcePlayerId: 'fn-1', playerName: 'QB One', team: 'WAS', position: 'QB', projectedFantasyPoints: 21.2, passingAttempts: 34, passingYards: 255, passingTouchdowns: 1.8 },
        { playerId: '2', sourcePlayerId: 'fn-2', playerName: 'Defense One', team: 'LA', position: 'DST', projectedFantasyPoints: 7.4, defensiveSacks: 2.1 },
      ],
    });

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      sourceKey: 'player-projection-snapshots-v1:fantasynerds:PPR:weekly',
      snapshotKey: '2026:w1:nerds-week1-v3',
      source: 'fantasynerds',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'nerds-week1-v3',
      season: '2026',
      week: 1,
      validForWeek: 1,
      rowCount: 2,
      parserVersion: 4,
      positionCoverage: { DEF: 1, QB: 1 },
      identityDiagnostics: {
        totalRows: 2,
        normalizedRows: 2,
        matchedRows: 2,
      },
    });
    expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.rows.find((row) => row.position === 'DEF')).toMatchObject({
      team: 'LAR',
      defensiveSacks: 2.1,
    });
    expect(getPlayerProjectionSourceKey(snapshot)).toBe(snapshot.sourceKey);
    expect(getPlayerProjectionSnapshotKey(snapshot)).toBe(snapshot.snapshotKey);
  });

  it('treats null or blank week metadata as an all-weeks snapshot key, not week zero', () => {
    const snapshot = buildPlayerProjectionSnapshot({
      season: 2026,
      week: null,
      source: 'sleeper',
      scoringProfile: 'PPR',
      projectionType: 'rest_of_season',
      sourceVersion: 'ros-v1',
      rows: [
        { playerId: '1', sourcePlayerId: 'sl-1', playerName: 'Rest Of Season Player', team: 'WAS', position: 'WR', projectedFantasyPoints: 14 },
      ],
    });

    expect(snapshot).toMatchObject({
      snapshotKey: '2026:all:ros-v1',
      week: null,
      validForWeek: null,
    });
    expect(getPlayerProjectionSnapshotKey({ season: 2026, week: ' ', sourceVersion: 'ros-v1' })).toBe('2026:all:ros-v1');
  });
});
