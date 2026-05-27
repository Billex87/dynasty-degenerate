import { describe, expect, it } from 'vitest';
import { buildSourceFreshnessSummary } from './sourceFreshnessSummary';
import type { SourceSnapshotFreshnessDiagnostic } from '../shared/types';

function diagnostic(input: Partial<SourceSnapshotFreshnessDiagnostic> & { sourceKey: string }): SourceSnapshotFreshnessDiagnostic {
  return {
    sourceKey: input.sourceKey,
    source: input.source || input.sourceKey,
    tableName: input.tableName || 'providerDataSnapshots',
    snapshotKey: input.snapshotKey ?? '2026-05-15',
    updatedAt: input.updatedAt ?? '2026-05-15T12:00:00.000Z',
    ageHours: input.ageHours ?? 6,
    payloadSizeBytes: input.payloadSizeBytes === undefined ? 1024 : input.payloadSizeBytes,
    rowCount: input.rowCount === undefined ? 10 : input.rowCount,
    status: input.status || 'loaded',
    level: input.level || 'info',
    note: input.note || 'Loaded.',
    lastHealthStatus: input.lastHealthStatus ?? null,
    lastHealthMessage: input.lastHealthMessage ?? null,
    lastHealthAt: input.lastHealthAt ?? null,
  };
}

describe('source freshness summary', () => {
  it('counts source status and levels without including raw payloads', () => {
    const summary = buildSourceFreshnessSummary({
      generatedAt: '2026-05-15T18:00:00.000Z',
      currentSeason: '2026',
      valueProfileKey: '12_sf_ppr_base',
      diagnostics: [
        diagnostic({ sourceKey: 'fantasypros-news-v1', payloadSizeBytes: 2048, rowCount: 25 }),
        diagnostic({ sourceKey: 'espn-depth-charts-v1', status: 'stale', level: 'warn', ageHours: 180 }),
        diagnostic({ sourceKey: 'player-props-opticodds-v1', status: 'missing', level: 'info', ageHours: null, payloadSizeBytes: null, rowCount: null }),
        diagnostic({ sourceKey: 'draftsharks-sos-v1', status: 'error', level: 'danger', lastHealthStatus: 'error', lastHealthMessage: 'provider failed' }),
      ],
    });

    expect(summary.totals).toMatchObject({
      sources: 4,
      loaded: 1,
      stale: 1,
      missing: 1,
      error: 1,
      info: 2,
      warn: 1,
      danger: 1,
    });
    expect(summary.payloadBytes).toBe(4096);
    expect(summary.rows).toBe(45);
    expect(JSON.stringify(summary)).not.toContain('rawPayload');
  });

  it('prioritizes danger and stale sources for operational review', () => {
    const summary = buildSourceFreshnessSummary({
      limit: 2,
      diagnostics: [
        diagnostic({ sourceKey: 'loaded-source', status: 'loaded', level: 'info', ageHours: 1 }),
        diagnostic({ sourceKey: 'stale-source', status: 'stale', level: 'warn', ageHours: 96 }),
        diagnostic({ sourceKey: 'danger-source', status: 'error', level: 'danger', ageHours: 12 }),
        diagnostic({ sourceKey: 'missing-source', status: 'missing', level: 'info', ageHours: null }),
      ],
    });

    expect(summary.actionableSources.map((source) => source.sourceKey)).toEqual([
      'danger-source',
      'stale-source',
    ]);
    expect(summary.oldestLoadedSource?.sourceKey).toBe('stale-source');
  });
});
