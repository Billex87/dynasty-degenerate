import { describe, expect, it } from 'vitest';
import {
  buildZeroRowValuationAudit,
  classifyZeroRowValuationSource,
  summarizeZeroRowValuationAudit,
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

  it('treats weighted future or benchmark zero-row sources as fixes', () => {
    expect(classifyZeroRowValuationSource({
      key: 'weightedBenchmark',
      label: 'Weighted Benchmark',
      currentWeight: 0.05,
      configuredStatus: 'benchmark-only',
      archiveStatus: 'benchmark-only',
      archivedPointCount: 0,
    }).disposition).toBe('fix');

    expect(classifyZeroRowValuationSource({
      key: 'weightedFuture',
      label: 'Weighted Future',
      currentWeight: 0.05,
      configuredStatus: 'future',
      archiveStatus: 'future',
      archivedPointCount: 0,
    }).disposition).toBe('fix');
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

  it('keeps malformed numeric coverage rows in the zero-row audit instead of dropping them', () => {
    const rows = buildZeroRowValuationAudit([
      {
        key: 'malformed',
        label: 'Malformed Source',
        currentWeight: Number.NaN,
        configuredStatus: 'disabled',
        archiveStatus: 'disabled',
        archivedPointCount: Number.NaN,
      },
      {
        key: 'negative',
        label: 'Negative Source',
        currentWeight: -0.1,
        configuredStatus: 'future',
        archiveStatus: 'future',
        archivedPointCount: -10,
      },
    ]);

    expect(rows).toMatchObject([
      {
        key: 'negative',
        currentWeight: 0,
        archivedPointCount: 0,
        disposition: 'watch',
      },
      {
        key: 'malformed',
        currentWeight: 0,
        archivedPointCount: 0,
        disposition: 'disable',
      },
    ]);
  });

  it('summarizes classified zero-row sources and validation errors', () => {
    const summary = summarizeZeroRowValuationAudit([
      {
        key: 'future',
        label: 'Future Source',
        currentWeight: 0,
        configuredStatus: 'future',
        archiveStatus: 'future',
        archivedPointCount: 0,
      },
      {
        key: 'benchmark',
        label: 'Benchmark Source',
        currentWeight: 0,
        configuredStatus: 'benchmark-only',
        archiveStatus: 'benchmark-only',
        archivedPointCount: 0,
      },
      {
        key: 'disabled',
        label: 'Disabled Source',
        currentWeight: 0,
        configuredStatus: 'disabled',
        archiveStatus: 'disabled',
        archivedPointCount: 0,
      },
    ]);

    expect(summary).toMatchObject({
      totalSources: 3,
      zeroRowSources: 3,
      byDisposition: {
        fix: 0,
        watch: 1,
        disable: 1,
        'benchmark-only': 1,
      },
      errors: [],
    });
  });
});
