import { describe, expect, it } from 'vitest';
import { buildSourceSnapshotFreshnessDiagnostics } from './sourceSnapshotFreshness';
import type { StoredSnapshotMetadata, StoredSourceHealthEvent } from './db';

const now = new Date('2026-05-15T18:00:00.000Z');

function metadata(input: Partial<StoredSnapshotMetadata> & { sourceKey: string }): StoredSnapshotMetadata {
  return {
    sourceKey: input.sourceKey,
    source: input.source || input.sourceKey,
    snapshotKey: input.snapshotKey ?? '2026-05-15',
    updatedAt: input.updatedAt ?? new Date('2026-05-15T12:00:00.000Z'),
    payloadSizeBytes: input.payloadSizeBytes ?? 1024,
    tableName: input.tableName || 'providerDataSnapshots',
  };
}

function health(input: Partial<StoredSourceHealthEvent> & { sourceKey: string }): StoredSourceHealthEvent {
  return {
    id: input.id ?? 1,
    job: input.job || 'dynamic-data-refresh',
    board: input.board ?? null,
    sourceKey: input.sourceKey,
    source: input.source || input.sourceKey,
    level: input.level || 'info',
    status: input.status || 'loaded',
    rowCount: input.rowCount ?? 12,
    message: input.message || 'Loaded',
    payload: input.payload,
    createdAt: input.createdAt ? new Date(input.createdAt) : new Date('2026-05-15T12:30:00.000Z'),
  };
}

describe('source snapshot freshness diagnostics', () => {
  it('combines metadata, row counts, payload size, and health status without payloads', () => {
    const [diagnostic] = buildSourceSnapshotFreshnessDiagnostics({
      now,
      metadata: [metadata({
        sourceKey: 'fantasypros-news-v1',
        payloadSizeBytes: 2048,
      })],
      healthEvents: [health({
        sourceKey: 'fantasypros-news-v1',
        rowCount: 34,
      })],
      expectedSources: [{
        sourceKey: 'fantasypros-news-v1',
        source: 'FantasyPros news snapshot',
        tableName: 'providerDataSnapshots',
        staleAfterHours: 36,
      }],
    });

    expect(diagnostic).toMatchObject({
      sourceKey: 'fantasypros-news-v1',
      source: 'FantasyPros news snapshot',
      status: 'loaded',
      level: 'info',
      rowCount: 34,
      payloadSizeBytes: 2048,
      snapshotKey: '2026-05-15',
    });
    expect(diagnostic.note).not.toContain('{');
  });

  it('marks stale and missing expected snapshots as actionable', () => {
    const diagnostics = buildSourceSnapshotFreshnessDiagnostics({
      now,
      metadata: [metadata({
        sourceKey: 'espn-depth-charts-v1',
        updatedAt: new Date('2026-05-13T00:00:00.000Z'),
      })],
      expectedSources: [
        {
          sourceKey: 'espn-depth-charts-v1',
          source: 'ESPN depth-chart snapshot',
          tableName: 'providerDataSnapshots',
          staleAfterHours: 24,
        },
        {
          sourceKey: 'player-props-opticodds-v1',
          source: 'OpticOdds player props snapshot',
          tableName: 'providerDataSnapshots',
          staleAfterHours: 24,
          missingLevel: 'warn',
        },
      ],
    });

    expect(diagnostics.map((diagnostic) => [diagnostic.sourceKey, diagnostic.status, diagnostic.level])).toEqual([
      ['espn-depth-charts-v1', 'stale', 'warn'],
      ['player-props-opticodds-v1', 'missing', 'warn'],
    ]);
  });

  it('lets report-time row counts override older source-health counts', () => {
    const [diagnostic] = buildSourceSnapshotFreshnessDiagnostics({
      now,
      metadata: [metadata({ sourceKey: 'ktc-blended-values-v1' })],
      healthEvents: [health({
        sourceKey: 'ktc-blended-values-v1',
        rowCount: 10,
      })],
      rowCounts: [{
        sourceKey: 'ktc-blended-values-v1',
        rowCount: 999,
      }],
      expectedSources: [{
        sourceKey: 'ktc-blended-values-v1',
        source: 'Blended value snapshot',
        tableName: 'ktcSnapshots',
        staleAfterHours: 36,
      }],
    });

    expect(diagnostic.rowCount).toBe(999);
  });

  it('tracks normalized NFL schedule snapshots as projection-readiness inputs', () => {
    const [diagnostic] = buildSourceSnapshotFreshnessDiagnostics({
      now,
      metadata: [metadata({
        sourceKey: 'nfl-schedule-games-v1',
        source: 'raw-provider-label',
        snapshotKey: '2026:official-v1',
      })],
      rowCounts: [{
        sourceKey: 'nfl-schedule-games-v1',
        rowCount: 272,
      }],
      expectedSources: [{
        sourceKey: 'nfl-schedule-games-v1',
        source: 'Normalized NFL schedule snapshot',
        tableName: 'providerDataSnapshots',
        staleAfterHours: 168,
        missingLevel: 'warn',
      }],
    });

    expect(diagnostic).toMatchObject({
      sourceKey: 'nfl-schedule-games-v1',
      source: 'Normalized NFL schedule snapshot',
      status: 'loaded',
      level: 'info',
      rowCount: 272,
      snapshotKey: '2026:official-v1',
    });
  });

  it('ignores retired FantasyPros matchup calendar snapshots from generic freshness fallback', () => {
    const diagnostics = buildSourceSnapshotFreshnessDiagnostics({
      now,
      metadata: [metadata({
        sourceKey: 'fantasypros-matchup-calendar-v1:2026:QB',
        source: 'FantasyPros matchup calendar QB',
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      })],
      expectedSources: [],
    });

    expect(diagnostics).toEqual([]);
  });

  it('ignores stale devy source snapshot variants that are not the selected devy profile', () => {
    const diagnostics = buildSourceSnapshotFreshnessDiagnostics({
      now,
      metadata: [
        metadata({
          sourceKey: 'devy-source-snapshot:devy_sf_ppr',
          source: 'Devy source snapshot: devy_sf_ppr',
        }),
        metadata({
          sourceKey: 'devy-source-snapshot:devy_one_qb_ppr',
          source: 'Devy source snapshot: devy_one_qb_ppr',
          updatedAt: new Date('2026-05-01T00:00:00.000Z'),
        }),
      ],
      expectedSources: [{
        sourceKey: 'devy-source-snapshot:devy_sf_ppr',
        source: 'Devy source snapshot: devy_sf_ppr',
        tableName: 'devySourceSnapshots',
        staleAfterHours: 168,
      }],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.sourceKey)).toEqual([
      'devy-source-snapshot:devy_sf_ppr',
    ]);
    expect(diagnostics[0]).toMatchObject({
      status: 'loaded',
      level: 'info',
    });
  });
});
