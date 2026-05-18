import type { PlayerSeasonOutcomeRow, PlayerSeasonPosition, ProductionTier, RoleTier, SeasonTrajectory } from './playerSeasonOutcomeModel';

export type CalibrationConfidenceGrade = 'strong' | 'usable' | 'thin' | 'blocked';
export type CalibrationRecommendation = 'amplify' | 'lean-positive' | 'neutral' | 'caution' | 'fade-risk';
export type FailureModeKey =
  | 'role-loss'
  | 'production-collapse'
  | 'availability-or-low-signal'
  | 'efficiency-spike-pullback'
  | 'breakout-pullback'
  | 'volume-without-production';

export type PlayerSeasonCalibrationBucket = {
  key: string;
  label: string;
  position: PlayerSeasonPosition;
  productionTier: ProductionTier;
  roleTier: RoleTier;
  trajectoryFromPrevious: SeasonTrajectory;
  sampleSize: number;
  modelEligibleSampleSize: number;
  nextOutcomeCounts: Partial<Record<SeasonTrajectory, number>>;
  improvedOrSustainedRate: number | null;
  breakoutOrProgressionRate: number | null;
  regressionOrCollapseRate: number | null;
  failureRiskRate: number | null;
  lowSignalRate: number | null;
  medianNextProductionDelta: number | null;
  medianNextRoleDelta: number | null;
  averageNextProductionDelta: number | null;
  averageNextRoleDelta: number | null;
  confidence: number;
  confidenceGrade: CalibrationConfidenceGrade;
  recommendation: CalibrationRecommendation;
  primaryFailureModes: Array<{
    key: FailureModeKey;
    label: string;
    count: number;
    rate: number;
  }>;
  examples: {
    positive: Array<CalibrationExample>;
    negative: Array<CalibrationExample>;
  };
  summary: string;
};

export type CalibrationExample = {
  playerName: string;
  season: number;
  position: PlayerSeasonPosition;
  productionTier: ProductionTier;
  roleTier: RoleTier;
  trajectoryFromPrevious: SeasonTrajectory;
  nextSeasonOutcome: SeasonTrajectory;
  nextProductionScoreDelta: number | null;
  nextRoleScoreDelta: number | null;
};

export type PlayerSeasonCalibrationSummary = {
  rowCount: number;
  calibratedRowCount: number;
  bucketCount: number;
  byPosition: Record<string, {
    sampleSize: number;
    improvedOrSustainedRate: number | null;
    regressionOrCollapseRate: number | null;
    failureRiskRate: number | null;
    medianNextProductionDelta: number | null;
  }>;
  strongestPositiveBuckets: PlayerSeasonCalibrationBucket[];
  highestRiskBuckets: PlayerSeasonCalibrationBucket[];
  thinBuckets: PlayerSeasonCalibrationBucket[];
};

export type PlayerSeasonCalibrationResult = {
  schemaVersion: 1;
  rowCount: number;
  calibratedRowCount: number;
  bucketCount: number;
  generatedFrom: 'player-season-outcomes';
  buckets: PlayerSeasonCalibrationBucket[];
  summary: PlayerSeasonCalibrationSummary;
};

const POSITIVE_OUTCOMES = new Set<SeasonTrajectory>(['breakout', 'progression', 'sustain', 'late-career-rebound']);
const UPSIDE_OUTCOMES = new Set<SeasonTrajectory>(['breakout', 'progression', 'late-career-rebound']);
const NEGATIVE_OUTCOMES = new Set<SeasonTrajectory>(['regression', 'collapse']);

function round(value: number | null, digits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function pct(count: number, total: number): number | null {
  if (!total) return null;
  return round((count / total) * 100, 1);
}

function average(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length, 1);
}

function median(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  if (clean.length % 2) return round(clean[middle], 1);
  return round((clean[middle - 1] + clean[middle]) / 2, 1);
}

function compactLabel(value: string): string {
  return value.replace(/-/g, ' ');
}

function bucketKey(row: PlayerSeasonOutcomeRow): string {
  return [
    row.position,
    row.productionTier,
    row.roleTier,
    row.trajectoryFromPrevious,
  ].join(':');
}

function bucketLabel(row: PlayerSeasonOutcomeRow): string {
  const trajectory = compactLabel(row.trajectoryFromPrevious);
  const production = compactLabel(row.productionTier);
  const role = compactLabel(row.roleTier);
  if ((row.trajectoryFromPrevious === 'breakout' || row.trajectoryFromPrevious === 'progression') && (row.roleTier === 'feature' || row.roleTier === 'starter')) {
    return `${row.position} ${trajectory} with ${role} usage`;
  }
  if ((row.productionTier === 'elite' || row.productionTier === 'strong') && row.roleTier === 'feature') {
    return `${row.position} proven feature scorer`;
  }
  if ((row.productionTier === 'elite' || row.productionTier === 'strong') && (row.roleTier === 'rotation' || row.roleTier === 'thin')) {
    return `${row.position} efficiency spike watch`;
  }
  if ((row.productionTier === 'replacement' || row.productionTier === 'low-signal') && (row.roleTier === 'feature' || row.roleTier === 'starter')) {
    return `${row.position} volume without production`;
  }
  if (row.trajectoryFromPrevious === 'regression' || row.trajectoryFromPrevious === 'collapse') {
    return `${row.position} rebound or cliff check`;
  }
  return `${row.position} ${production} production / ${role} role`;
}

function confidenceGrade(sampleSize: number): CalibrationConfidenceGrade {
  if (sampleSize >= 30) return 'strong';
  if (sampleSize >= 14) return 'usable';
  if (sampleSize >= 6) return 'thin';
  return 'blocked';
}

function confidenceScore(input: {
  sampleSize: number;
  improvedOrSustainedRate: number | null;
  regressionOrCollapseRate: number | null;
  medianNextProductionDelta: number | null;
}): number {
  const sampleScore = Math.min(42, input.sampleSize * 1.6);
  const directionalSeparation = input.improvedOrSustainedRate !== null && input.regressionOrCollapseRate !== null
    ? Math.abs(input.improvedOrSustainedRate - input.regressionOrCollapseRate) * 0.28
    : 0;
  const movementScore = Math.min(18, Math.abs(input.medianNextProductionDelta || 0) * 0.45);
  return Math.round(Math.max(0, Math.min(95, 22 + sampleScore + directionalSeparation + movementScore)));
}

function recommendation(input: {
  sampleSize: number;
  productionTier: ProductionTier;
  roleTier: RoleTier;
  improvedOrSustainedRate: number | null;
  regressionOrCollapseRate: number | null;
  failureRiskRate: number | null;
  breakoutOrProgressionRate: number | null;
  medianNextProductionDelta: number | null;
}): CalibrationRecommendation {
  if (input.sampleSize < 6) return 'neutral';
  const positive = input.improvedOrSustainedRate || 0;
  const failureRisk = input.failureRiskRate || 0;
  const upside = input.breakoutOrProgressionRate || 0;
  const medianDelta = input.medianNextProductionDelta || 0;
  if (failureRisk >= 42 && medianDelta <= -10) return 'fade-risk';
  if (failureRisk >= 30 || medianDelta <= -12) return 'caution';
  if (input.productionTier === 'replacement' || input.productionTier === 'low-signal') return 'neutral';
  if (positive >= 68 && upside >= 28 && medianDelta >= 8 && failureRisk <= 22) return 'amplify';
  if (positive >= 58 && failureRisk <= 24) return 'lean-positive';
  return 'neutral';
}

function isMaterialFailure(row: PlayerSeasonOutcomeRow): boolean {
  if (row.nextSeasonOutcome === 'low-signal' || row.nextSeasonOutcome === 'collapse') return true;
  if (row.nextSeasonOutcome !== 'regression') return false;
  if ((row.nextProductionScore || 0) < 45) return true;
  if ((row.nextRoleScore || 0) < 30) return true;
  return (row.nextProductionScoreDelta || 0) <= -24 && (row.nextProductionScore || 0) < 58;
}

function failureModes(row: PlayerSeasonOutcomeRow): FailureModeKey[] {
  if (!row.nextSeasonOutcome || !isMaterialFailure(row)) return [];
  const modes: FailureModeKey[] = [];
  if ((row.nextRoleScoreDelta || 0) <= -16) modes.push('role-loss');
  if ((row.nextProductionScoreDelta || 0) <= -20) modes.push('production-collapse');
  if (row.nextSeasonOutcome === 'low-signal') modes.push('availability-or-low-signal');
  if ((row.productionTier === 'elite' || row.productionTier === 'strong') && (row.roleTier === 'rotation' || row.roleTier === 'thin')) modes.push('efficiency-spike-pullback');
  if (row.trajectoryFromPrevious === 'breakout' || row.trajectoryFromPrevious === 'progression') modes.push('breakout-pullback');
  if ((row.productionTier === 'replacement' || row.productionTier === 'low-signal') && (row.roleTier === 'feature' || row.roleTier === 'starter')) modes.push('volume-without-production');
  return modes.length ? modes : ['production-collapse'];
}

function failureModeLabel(key: FailureModeKey): string {
  switch (key) {
    case 'role-loss':
      return 'Role loss';
    case 'production-collapse':
      return 'Production collapse';
    case 'availability-or-low-signal':
      return 'Availability / low-signal follow-up';
    case 'efficiency-spike-pullback':
      return 'Efficiency spike pullback';
    case 'breakout-pullback':
      return 'Breakout pullback';
    case 'volume-without-production':
      return 'Volume without production';
  }
}

function example(row: PlayerSeasonOutcomeRow): CalibrationExample {
  return {
    playerName: row.playerName,
    season: row.season,
    position: row.position,
    productionTier: row.productionTier,
    roleTier: row.roleTier,
    trajectoryFromPrevious: row.trajectoryFromPrevious,
    nextSeasonOutcome: row.nextSeasonOutcome || 'low-signal',
    nextProductionScoreDelta: row.nextProductionScoreDelta,
    nextRoleScoreDelta: row.nextRoleScoreDelta,
  };
}

function bucketSummary(bucket: Omit<PlayerSeasonCalibrationBucket, 'summary'>): string {
  const positive = bucket.improvedOrSustainedRate !== null ? `${bucket.improvedOrSustainedRate}% improved/sustained` : 'no positive rate';
  const negative = bucket.regressionOrCollapseRate !== null ? `${bucket.regressionOrCollapseRate}% regressed/collapsed` : 'no risk rate';
  const failure = bucket.failureRiskRate !== null ? `${bucket.failureRiskRate}% material failure risk` : 'no failure risk';
  const median = bucket.medianNextProductionDelta !== null ? `${bucket.medianNextProductionDelta >= 0 ? '+' : ''}${bucket.medianNextProductionDelta} median production score` : 'no median movement';
  const failureMode = bucket.primaryFailureModes[0] ? `Main failure mode: ${bucket.primaryFailureModes[0].label.toLowerCase()} (${bucket.primaryFailureModes[0].rate}%).` : 'No dominant failure mode.';
  return `${bucket.label}: ${bucket.sampleSize} historical samples, ${positive}, ${negative}, ${failure}, ${median}. Recommendation: ${bucket.recommendation}. ${failureMode}`;
}

function buildBucket(rows: PlayerSeasonOutcomeRow[]): PlayerSeasonCalibrationBucket {
  const first = rows[0];
  const counts: Partial<Record<SeasonTrajectory, number>> = {};
  const failureCounts = new Map<FailureModeKey, number>();
  rows.forEach((row) => {
    if (row.nextSeasonOutcome) counts[row.nextSeasonOutcome] = (counts[row.nextSeasonOutcome] || 0) + 1;
    failureModes(row).forEach((mode) => failureCounts.set(mode, (failureCounts.get(mode) || 0) + 1));
  });
  const positiveCount = rows.filter((row) => row.nextSeasonOutcome && POSITIVE_OUTCOMES.has(row.nextSeasonOutcome)).length;
  const upsideCount = rows.filter((row) => row.nextSeasonOutcome && UPSIDE_OUTCOMES.has(row.nextSeasonOutcome)).length;
  const negativeCount = rows.filter((row) => row.nextSeasonOutcome && NEGATIVE_OUTCOMES.has(row.nextSeasonOutcome)).length;
  const failureCount = rows.filter(isMaterialFailure).length;
  const lowSignalCount = rows.filter((row) => row.nextSeasonOutcome === 'low-signal').length;
  const productionDeltas = rows.flatMap((row) => row.nextProductionScoreDelta === null ? [] : [row.nextProductionScoreDelta]);
  const roleDeltas = rows.flatMap((row) => row.nextRoleScoreDelta === null ? [] : [row.nextRoleScoreDelta]);
  const sampleSize = rows.length;
  const improvedOrSustainedRate = pct(positiveCount, sampleSize);
  const breakoutOrProgressionRate = pct(upsideCount, sampleSize);
  const regressionOrCollapseRate = pct(negativeCount, sampleSize);
  const failureRiskRate = pct(failureCount, sampleSize);
  const lowSignalRate = pct(lowSignalCount, sampleSize);
  const medianNextProductionDelta = median(productionDeltas);
  const medianNextRoleDelta = median(roleDeltas);
  const modelEligibleSampleSize = rows.filter((row) => row.modelEligible).length;
  const bucketBase = {
    key: bucketKey(first),
    label: bucketLabel(first),
    position: first.position,
    productionTier: first.productionTier,
    roleTier: first.roleTier,
    trajectoryFromPrevious: first.trajectoryFromPrevious,
    sampleSize,
    modelEligibleSampleSize,
    nextOutcomeCounts: counts,
    improvedOrSustainedRate,
    breakoutOrProgressionRate,
    regressionOrCollapseRate,
    failureRiskRate,
    lowSignalRate,
    medianNextProductionDelta,
    medianNextRoleDelta,
    averageNextProductionDelta: average(productionDeltas),
    averageNextRoleDelta: average(roleDeltas),
    confidence: confidenceScore({ sampleSize, improvedOrSustainedRate, regressionOrCollapseRate, medianNextProductionDelta }),
    confidenceGrade: confidenceGrade(sampleSize),
    recommendation: recommendation({ sampleSize, productionTier: first.productionTier, roleTier: first.roleTier, improvedOrSustainedRate, regressionOrCollapseRate, failureRiskRate, breakoutOrProgressionRate, medianNextProductionDelta }),
    primaryFailureModes: Array.from(failureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([key, count]) => ({ key, label: failureModeLabel(key), count, rate: pct(count, sampleSize) || 0 })),
    examples: {
      positive: rows
        .filter((row) => row.nextSeasonOutcome && POSITIVE_OUTCOMES.has(row.nextSeasonOutcome))
        .sort((a, b) => (b.nextProductionScoreDelta || 0) - (a.nextProductionScoreDelta || 0))
        .slice(0, 5)
        .map(example),
      negative: rows
        .filter(isMaterialFailure)
        .sort((a, b) => (a.nextProductionScoreDelta || 0) - (b.nextProductionScoreDelta || 0))
        .slice(0, 5)
        .map(example),
    },
  };

  return {
    ...bucketBase,
    summary: bucketSummary(bucketBase),
  };
}

function positionSummary(rows: PlayerSeasonOutcomeRow[]) {
  const byPosition: PlayerSeasonCalibrationSummary['byPosition'] = {};
  for (const position of Array.from(new Set(rows.map((row) => row.position)))) {
    const sample = rows.filter((row) => row.position === position);
    const positiveCount = sample.filter((row) => row.nextSeasonOutcome && POSITIVE_OUTCOMES.has(row.nextSeasonOutcome)).length;
    const negativeCount = sample.filter((row) => row.nextSeasonOutcome && NEGATIVE_OUTCOMES.has(row.nextSeasonOutcome)).length;
    const failureCount = sample.filter(isMaterialFailure).length;
    byPosition[position] = {
      sampleSize: sample.length,
      improvedOrSustainedRate: pct(positiveCount, sample.length),
      regressionOrCollapseRate: pct(negativeCount, sample.length),
      failureRiskRate: pct(failureCount, sample.length),
      medianNextProductionDelta: median(sample.flatMap((row) => row.nextProductionScoreDelta === null ? [] : [row.nextProductionScoreDelta])),
    };
  }
  return byPosition;
}

export function buildPlayerSeasonCalibration(rows: PlayerSeasonOutcomeRow[]): PlayerSeasonCalibrationResult {
  const calibratedRows = rows.filter((row) => row.nextSeasonOutcome && row.modelEligible);
  const byBucket = new Map<string, PlayerSeasonOutcomeRow[]>();
  for (const row of calibratedRows) {
    const key = bucketKey(row);
    byBucket.set(key, [...(byBucket.get(key) || []), row]);
  }
  const buckets = Array.from(byBucket.values())
    .map(buildBucket)
    .sort((a, b) => b.sampleSize - a.sampleSize || b.confidence - a.confidence);
  const strongestPositiveBuckets = buckets
    .filter((bucket) => bucket.sampleSize >= 14 && (bucket.recommendation === 'amplify' || bucket.recommendation === 'lean-positive'))
    .sort((a, b) => (b.improvedOrSustainedRate || 0) - (a.improvedOrSustainedRate || 0) || (b.medianNextProductionDelta || 0) - (a.medianNextProductionDelta || 0))
    .slice(0, 12);
  const highestRiskBuckets = buckets
    .filter((bucket) => bucket.sampleSize >= 14 && (bucket.recommendation === 'caution' || bucket.recommendation === 'fade-risk'))
    .sort((a, b) => (b.failureRiskRate || 0) - (a.failureRiskRate || 0) || (b.regressionOrCollapseRate || 0) - (a.regressionOrCollapseRate || 0) || (a.medianNextProductionDelta || 0) - (b.medianNextProductionDelta || 0))
    .slice(0, 12);
  const thinBuckets = buckets
    .filter((bucket) => bucket.confidenceGrade === 'thin' || bucket.confidenceGrade === 'blocked')
    .sort((a, b) => a.sampleSize - b.sampleSize)
    .slice(0, 12);

  return {
    schemaVersion: 1,
    rowCount: rows.length,
    calibratedRowCount: calibratedRows.length,
    bucketCount: buckets.length,
    generatedFrom: 'player-season-outcomes',
    buckets,
    summary: {
      rowCount: rows.length,
      calibratedRowCount: calibratedRows.length,
      bucketCount: buckets.length,
      byPosition: positionSummary(calibratedRows),
      strongestPositiveBuckets,
      highestRiskBuckets,
      thinBuckets,
    },
  };
}
