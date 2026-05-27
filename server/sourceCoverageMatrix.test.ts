import { describe, expect, it } from 'vitest';
import { buildSourceCoverageMatrix } from './sourceCoverageMatrix';
import type { StoredSourceHealthEvent } from './db';
import type { SourceSnapshotFreshnessDiagnostic } from '../shared/types';

function freshness(input: Partial<SourceSnapshotFreshnessDiagnostic> & { sourceKey: string }): SourceSnapshotFreshnessDiagnostic {
  return {
    sourceKey: input.sourceKey,
    source: input.source || input.sourceKey,
    tableName: input.tableName || 'providerDataSnapshots',
    snapshotKey: input.snapshotKey === undefined ? '2026-05-15' : input.snapshotKey,
    updatedAt: input.updatedAt === undefined ? '2026-05-15T12:00:00.000Z' : input.updatedAt,
    ageHours: input.ageHours === undefined ? 6 : input.ageHours,
    payloadSizeBytes: input.payloadSizeBytes === undefined ? 2048 : input.payloadSizeBytes,
    rowCount: input.rowCount === undefined ? 25 : input.rowCount,
    status: input.status || 'loaded',
    level: input.level || 'info',
    note: input.note || 'Metadata only',
    lastHealthStatus: input.lastHealthStatus ?? null,
    lastHealthMessage: input.lastHealthMessage ?? null,
    lastHealthAt: input.lastHealthAt ?? null,
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
    rowCount: input.rowCount ?? 9,
    message: input.message || 'Loaded without payload details',
    payload: input.payload,
    createdAt: input.createdAt ? new Date(input.createdAt) : new Date('2026-05-15T12:30:00.000Z'),
  };
}

describe('source coverage matrix', () => {
  it('combines field maps with stored snapshot metadata without returning payloads', () => {
    const matrix = buildSourceCoverageMatrix({
      currentSeason: '2026',
      previousSeason: '2025',
      valueProfileKey: '12_sf_ppr_base',
      devyProfileKey: 'devy_sf_ppr',
      lookbackDays: 14,
      generatedAt: new Date('2026-05-15T18:00:00.000Z'),
      freshnessDiagnostics: [
        freshness({
          sourceKey: 'redraft-source-snapshot:2026',
          rowCount: 1234,
          payloadSizeBytes: 506_000,
        }),
        freshness({
          sourceKey: 'player-props-opticodds-v1',
          status: 'missing',
          level: 'warn',
          snapshotKey: null,
          updatedAt: null,
          ageHours: null,
          payloadSizeBytes: null,
          rowCount: null,
        }),
      ],
      healthEvents: [
        health({
          sourceKey: 'fantasypros-news-v1',
          rowCount: 44,
          message: 'Loaded 44 news rows',
          payload: { secretToken: 'do-not-return' },
        }),
      ],
    });

    const redraft = matrix.rows.find((row) => row.sourceKey === 'redraft-source-snapshot');
    const props = matrix.rows.find((row) => row.sourceKey === 'player-props-opticodds-v1');
    const serialized = JSON.stringify(matrix);

    expect(redraft).toMatchObject({
      status: 'loaded',
      rowCount: 1234,
      payloadSizeBytes: 506_000,
      tableName: 'providerDataSnapshots',
    });
    expect(redraft?.fieldMap).toContain('projection');
    expect(props).toMatchObject({
      status: 'missing',
      level: 'warn',
      snapshotKey: null,
      payloadSizeBytes: null,
    });
    expect(matrix.totals.sources).toBeGreaterThan(10);
    expect(serialized).not.toContain('do-not-return');
    expect(serialized).not.toContain('payload":');
  });

  it('keeps blocked external candidates visible without treating them as report-load sources', () => {
    const matrix = buildSourceCoverageMatrix({
      currentSeason: '2026',
      valueProfileKey: '12_sf_ppr_base',
      lookbackDays: 14,
      freshnessDiagnostics: [],
      healthEvents: [],
    });

    const candidates = matrix.rows.find((row) => row.sourceKey === 'yahoo-fantrax-ffpc');

    expect(candidates).toMatchObject({
      status: 'blocked',
      level: 'warn',
      refreshCadence: 'Research only until approved',
    });
    expect(candidates?.complianceNote).toContain('Do not scrape');
  });

  it('surfaces FantasyPros endpoint snapshots as snapshot-backed sources', () => {
    const matrix = buildSourceCoverageMatrix({
      currentSeason: '2026',
      valueProfileKey: '12_sf_ppr_base',
      lookbackDays: 14,
      freshnessDiagnostics: [
        freshness({
          sourceKey: 'fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr',
          rowCount: 51,
          payloadSizeBytes: 24_000,
        }),
      ],
      healthEvents: [],
    });

    const row = matrix.rows.find((entry) => entry.sourceKey === 'fantasypros-weekly-ecr-snapshot');
    expect(row).toMatchObject({
      status: 'loaded',
      rowCount: 51,
      tableName: 'providerDataSnapshots',
    });
    expect(row?.couldPowerLater).toContain('weekly streamer reads');
  });

  it('returns stable row shapes and internally consistent totals', () => {
    const matrix = buildSourceCoverageMatrix({
      currentSeason: '2026',
      previousSeason: '2025',
      valueProfileKey: '12_sf_ppr_base',
      lookbackDays: 14,
      freshnessDiagnostics: [
        freshness({
          sourceKey: 'ktc-blended-values-v1:12_sf_ppr_base',
          rowCount: 900,
        }),
        freshness({
          sourceKey: 'fantasypros-news-v1',
          status: 'stale',
          level: 'warn',
          ageHours: 72,
          rowCount: 24,
        }),
      ],
      healthEvents: [
        health({
          sourceKey: 'draftsharks-sos-v1',
          status: 'error',
          level: 'danger',
          rowCount: 0,
          message: 'Provider unavailable',
        }),
      ],
      generatedAt: new Date('2026-05-17T18:00:00.000Z'),
    });

    expect(matrix.generatedAt).toBe('2026-05-17T18:00:00.000Z');
    expect(matrix.rows.length).toBe(matrix.totals.sources);
    expect(
      matrix.totals.loaded
      + matrix.totals.stale
      + matrix.totals.missing
      + matrix.totals.error
      + matrix.totals.blocked
      + matrix.totals.research
    ).toBe(matrix.totals.sources);
    expect(matrix.rows.every((row) => (
      row.sourceKey
      && row.source
      && row.category
      && row.endpoint
      && row.authModel
      && row.refreshCadence
      && Array.isArray(row.fieldMap)
      && Array.isArray(row.usedNow)
      && Array.isArray(row.couldPowerLater)
      && Array.isArray(row.knownGaps)
    ))).toBe(true);
  });
});
