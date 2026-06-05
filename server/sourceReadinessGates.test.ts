import { describe, expect, it } from 'vitest';
import {
  SOURCE_READINESS_GATES,
  getPublicClaimReadyGates,
  summarizeSourceReadinessGates,
  validatePublicClaimReadiness,
  validateSourceReadinessGates,
  type SourceReadinessGate,
} from './sourceReadinessGates';

describe('source readiness gates', () => {
  it('keeps the built-in gate register internally valid', () => {
    expect(validateSourceReadinessGates()).toEqual([]);
    expect(SOURCE_READINESS_GATES.some((gate) => gate.id === 'fantasypros-projections')).toBe(true);
    expect(SOURCE_READINESS_GATES.some((gate) => gate.id === 'sportsdataio-fantasydata-beyond-news')).toBe(true);
    expect(SOURCE_READINESS_GATES.some((gate) => gate.id === 'sleeper-hidden-account-transactions')).toBe(true);
  });

  it('summarizes blocked, research, and snapshot-approved gates', () => {
    const summary = summarizeSourceReadinessGates();

    expect(summary.total).toBe(SOURCE_READINESS_GATES.length);
    expect(summary.snapshotReady).toBeGreaterThan(0);
    expect(summary.blockedOrResearch).toBeGreaterThan(0);
    expect(summary.publicClaimReady).toBe(0);
    expect(getPublicClaimReadyGates()).toEqual([]);
    expect(validatePublicClaimReadiness()).toContain(
      'No source readiness gate is approved for public provider-attributed claims.',
    );
  });

  it('keeps remaining source-readiness blockers out of normal report loads and public claims', () => {
    const gatesById = new Map(SOURCE_READINESS_GATES.map((gate) => [gate.id, gate]));
    const expectedBoundaries = [
      ['fantasypros-ww', 'research', 'snapshot-only'],
      ['fantasypros-targets', 'blocked', 'blocked'],
      ['fantasypros-articles', 'blocked', 'blocked'],
      ['gridiron-data', 'research', 'blocked'],
      ['dynasty-daddy-source-selector', 'research', 'blocked'],
      ['sleeper-hidden-account-transactions', 'blocked', 'blocked'],
      ['official-transactions', 'research', 'blocked'],
    ] as const;

    for (const [id, status, normalReportLoad] of expectedBoundaries) {
      expect(gatesById.get(id)).toMatchObject({
        id,
        status,
        normalReportLoad,
        publicClaimAllowed: false,
        evidence: {
          allowedAttributionLanguage: null,
        },
      });
    }
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

  it('recognizes a complete public-claim gate only when attribution evidence is complete', () => {
    const gate: SourceReadinessGate = {
      id: 'good-public-claim',
      source: 'Good public claim',
      status: 'approved-for-public-claim',
      normalReportLoad: 'snapshot-only',
      publicClaimAllowed: true,
      evidence: {
        termsApproval: 'approved terms',
        endpointPath: 'providerDataSnapshots good-public-claim-v1',
        authModel: 'cron/admin snapshot only',
        rowCount: '100 current rows',
        freshnessTimestamp: '2026-08-15T00:00:00.000Z',
        rateLimitResult: 'paced snapshot passed',
        mappingCoverage: '99% mapped',
        allowedAttributionLanguage: 'Use Example projections.',
      },
      nextAction: 'monitor freshness',
    };

    expect(getPublicClaimReadyGates([gate])).toEqual([gate]);
    expect(validatePublicClaimReadiness([gate])).toEqual([]);
    expect(summarizeSourceReadinessGates([gate]).publicClaimReady).toBe(1);
  });
});
