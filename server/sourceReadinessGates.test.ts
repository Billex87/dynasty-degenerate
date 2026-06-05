import { describe, expect, it } from 'vitest';
import {
  SOURCE_READINESS_GATES,
  summarizeSourceReadinessGates,
  validateSourceReadinessGates,
  type SourceReadinessGate,
} from './sourceReadinessGates';

describe('source readiness gates', () => {
  it('keeps the built-in gate register internally valid', () => {
    expect(validateSourceReadinessGates()).toEqual([]);
    expect(SOURCE_READINESS_GATES.some((gate) => gate.id === 'fantasypros-projections')).toBe(true);
    expect(SOURCE_READINESS_GATES.some((gate) => gate.id === 'sportsdataio-fantasydata-beyond-news')).toBe(true);
  });

  it('summarizes blocked, research, and snapshot-approved gates', () => {
    const summary = summarizeSourceReadinessGates();

    expect(summary.total).toBe(SOURCE_READINESS_GATES.length);
    expect(summary.snapshotReady).toBeGreaterThan(0);
    expect(summary.blockedOrResearch).toBeGreaterThan(0);
    expect(summary.publicClaimReady).toBe(0);
  });

  it('rejects public claims without complete evidence', () => {
    const gate: SourceReadinessGate = {
      id: 'bad-public-claim',
      source: 'Bad public claim',
      status: 'approved-for-public-claim',
      normalReportLoad: 'snapshot-only',
      publicClaimAllowed: true,
      evidence: {
        termsApproval: 'approved',
        endpointPath: null,
        authModel: 'api key',
        rowCount: '100',
        freshnessTimestamp: 'fresh',
        rateLimitResult: 'passed',
        mappingCoverage: 'mapped',
        allowedAttributionLanguage: null,
      },
      nextAction: 'fix evidence',
    };

    expect(validateSourceReadinessGates([gate])).toEqual([
      'bad-public-claim is missing public-claim evidence: endpointPath, allowedAttributionLanguage',
    ]);
  });
});
