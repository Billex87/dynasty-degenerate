import type { RankingSourceDiagnostic } from '../shared/types';

export type SourceTrustLike = {
  score?: number | null;
  multiplier?: number | null;
  effectiveWeight?: number | null;
};

export type SourceTrustLikeMap = Record<string, SourceTrustLike | undefined>;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundDelta(value: number | null, decimals = 3): number | null {
  if (value === null) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function buildTrustAlert(diagnostic: RankingSourceDiagnostic): RankingSourceDiagnostic['trustAlert'] {
  const trustScoreDelta = toNumber(diagnostic.trustScoreDelta);
  const rowCountRatio = toNumber(diagnostic.rowCountRatio);
  const medianConsensusDeltaPct = toNumber(diagnostic.medianConsensusDeltaPct);

  if (diagnostic.status === 'error' || diagnostic.status === 'stale') {
    return {
      level: 'danger',
      message: `${diagnostic.source} is ${diagnostic.status}; verify the source before trusting its movement.`,
    };
  }

  if (trustScoreDelta !== null && trustScoreDelta <= -15) {
    return {
      level: 'danger',
      message: `${diagnostic.source} trust dropped ${Math.abs(trustScoreDelta)} points since the previous snapshot.`,
    };
  }

  if (rowCountRatio !== null && rowCountRatio < 0.5) {
    return {
      level: 'danger',
      message: `${diagnostic.source} row coverage fell below half of its recent baseline.`,
    };
  }

  if (trustScoreDelta !== null && trustScoreDelta <= -8) {
    return {
      level: 'warn',
      message: `${diagnostic.source} trust dropped ${Math.abs(trustScoreDelta)} points since the previous snapshot.`,
    };
  }

  if (medianConsensusDeltaPct !== null && medianConsensusDeltaPct > 0.25) {
    return {
      level: 'warn',
      message: `${diagnostic.source} is drifting more than 25% from the source-excluded consensus.`,
    };
  }

  if (rowCountRatio !== null && rowCountRatio < 0.75) {
    return {
      level: 'warn',
      message: `${diagnostic.source} row coverage is below 75% of its recent baseline.`,
    };
  }

  return null;
}

export function annotateDiagnosticsWithTrustHistory(
  diagnostics: RankingSourceDiagnostic[],
  previousTrustByKey: SourceTrustLikeMap = {},
): RankingSourceDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const previous = previousTrustByKey[diagnostic.key] || null;
    const trustScore = toNumber(diagnostic.trustScore);
    const previousTrustScore = toNumber(previous?.score);
    const trustMultiplier = toNumber(diagnostic.trustMultiplier);
    const previousTrustMultiplier = toNumber(previous?.multiplier);
    const effectiveWeight = toNumber(diagnostic.effectiveWeight);
    const previousEffectiveWeight = toNumber(previous?.effectiveWeight);

    const next: RankingSourceDiagnostic = {
      ...diagnostic,
      previousTrustScore,
      trustScoreDelta: trustScore !== null && previousTrustScore !== null
        ? Math.round(trustScore - previousTrustScore)
        : null,
      previousTrustMultiplier,
      trustMultiplierDelta: trustMultiplier !== null && previousTrustMultiplier !== null
        ? roundDelta(trustMultiplier - previousTrustMultiplier, 3)
        : null,
      previousEffectiveWeight,
      effectiveWeightDelta: effectiveWeight !== null && previousEffectiveWeight !== null
        ? roundDelta(effectiveWeight - previousEffectiveWeight, 4)
        : null,
    };

    return {
      ...next,
      trustAlert: buildTrustAlert(next),
    };
  });
}
