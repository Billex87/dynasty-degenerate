import { describe, expect, it } from 'vitest';
import {
  buildZeroRowValuationAudit,
  classifyZeroRowValuationSource,
} from './valueSourceZeroRowAudit';

describe('zero-row valuation source audit', () => {
  it('marks active weighted zero-row sources as fix', () => {
    expect(classifyZeroRowValuationSource({
      key: 'weighted',
      label: 'Weighted Source',
      currentWeight: 0.2,
      configuredStatus: 'archived',
      archiveStatus: 'archived',
      archivedPointCount: 0,
    })).toMatchObject({
      disposition: 'fix',
    });
  });

  it('keeps benchmark and future sources visible without treating them as active fixes', () => {
    expect(classifyZeroRowValuationSource({
      key: 'benchmark',
      label: 'Benchmark Source',
      currentWeight: 0,
      configuredStatus: 'benchmark-only',
      archiveStatus: 'benchmark-only',
      archivedPointCount: 0,
    }).disposition).toBe('benchmark-only');

    expect(classifyZeroRowValuationSource({
      key: 'future',
      label: 'Future Source',
      currentWeight: 0,
      configuredStatus: 'future',
      archiveStatus: 'future',
      archivedPointCount: 0,
    }).disposition).toBe('watch');
  });

  it('returns only zero-row sources ordered by action priority', () => {
    const rows = buildZeroRowValuationAudit([
      {
        key: 'active',
        label: 'Active Source',
        currentWeight: 0.1,
        configuredStatus: 'archived',
        archiveStatus: 'present',
        archivedPointCount: 10,
      },
      {
        key: 'future',
        label: 'Future Source',
        currentWeight: 0,
        configuredStatus: 'future',
        archiveStatus: 'future',
        archivedPointCount: 0,
      },
      {
        key: 'weighted',
        label: 'Weighted Source',
        currentWeight: 0.1,
        configuredStatus: 'archived',
        archiveStatus: 'archived',
        archivedPointCount: 0,
      },
    ]);

    expect(rows.map((row) => row.key)).toEqual(['weighted', 'future']);
    expect(rows.map((row) => row.disposition)).toEqual(['fix', 'watch']);
  });
});
