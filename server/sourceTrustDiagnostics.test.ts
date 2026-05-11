import { describe, expect, it } from 'vitest';
import { annotateDiagnosticsWithTrustHistory } from './sourceTrustDiagnostics';
import type { RankingSourceDiagnostic } from '../shared/types';

function createDiagnostic(overrides: Partial<RankingSourceDiagnostic> = {}): RankingSourceDiagnostic {
  return {
    key: 'fantasyCalc',
    source: 'FantasyCalc',
    board: 'dynasty',
    status: 'loaded',
    rowCount: 100,
    note: 'Loaded test rows.',
    trustScore: 72,
    trustMultiplier: 1.016,
    effectiveWeight: 0.1219,
    ...overrides,
  };
}

describe('source trust diagnostics', () => {
  it('annotates diagnostics with previous trust movement', () => {
    const [diagnostic] = annotateDiagnosticsWithTrustHistory([
      createDiagnostic(),
    ], {
      fantasyCalc: {
        score: 64,
        multiplier: 0.987,
        effectiveWeight: 0.1184,
      },
    });

    expect(diagnostic.previousTrustScore).toBe(64);
    expect(diagnostic.trustScoreDelta).toBe(8);
    expect(diagnostic.previousTrustMultiplier).toBe(0.987);
    expect(diagnostic.trustMultiplierDelta).toBeCloseTo(0.029);
    expect(diagnostic.previousEffectiveWeight).toBe(0.1184);
    expect(diagnostic.effectiveWeightDelta).toBeCloseTo(0.0035);
    expect(diagnostic.trustAlert).toBeNull();
  });

  it('raises alerts for source health drops', () => {
    const [diagnostic] = annotateDiagnosticsWithTrustHistory([
      createDiagnostic({
        source: 'KTC',
        key: 'ktc',
        trustScore: 50,
        rowCountRatio: 0.48,
      }),
    ], {
      ktc: {
        score: 70,
        multiplier: 1.009,
        effectiveWeight: 0.1816,
      },
    });

    expect(diagnostic.trustScoreDelta).toBe(-20);
    expect(diagnostic.trustAlert).toMatchObject({
      level: 'danger',
    });
  });
});
