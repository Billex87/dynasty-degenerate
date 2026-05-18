import fs from 'node:fs';
import path from 'node:path';
import type { PlayerSeasonCalibrationBucket, PlayerSeasonCalibrationResult } from '../server/playerSeasonCalibration';

const rootDir = process.cwd();
const inputPath = path.resolve(
  rootDir,
  process.env.CALIBRATION_FILE || '.cache/modeling/player-cohort-backtest/calibration.json'
);
const outputPath = path.resolve(
  rootDir,
  process.env.OUT_FILE || 'server/model-calibration/player-cohort-calibration-v1.json'
);
const minSampleSize = Math.max(1, Number.parseInt(process.env.MIN_SAMPLE_SIZE || '6', 10) || 6);

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Publish a compact player cohort calibration artifact for runtime AI receipts.',
    '',
    'The source calibration may contain examples and offline audit metadata. This script strips those fields.',
    '',
    'Environment:',
    '  CALIBRATION_FILE=.cache/modeling/player-cohort-backtest/calibration.json',
    '  OUT_FILE=server/model-calibration/player-cohort-calibration-v1.json',
    '  MIN_SAMPLE_SIZE=6',
    '',
    'Run this after:',
    '  pnpm build:player-season-outcomes',
    '  pnpm backtest:player-cohorts',
  ].join('\n'));
  process.exit(0);
}

function readCalibration(filePath: string): PlayerSeasonCalibrationResult & { generatedAt?: string } {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Calibration file not found: ${path.relative(rootDir, filePath)}. Run pnpm backtest:player-cohorts first.`);
  }
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.buckets)) {
    throw new Error(`Invalid calibration file: ${path.relative(rootDir, filePath)}`);
  }
  return payload as PlayerSeasonCalibrationResult & { generatedAt?: string };
}

function compactBucket(bucket: PlayerSeasonCalibrationBucket) {
  return {
    key: bucket.key,
    label: bucket.label,
    position: bucket.position,
    productionTier: bucket.productionTier,
    roleTier: bucket.roleTier,
    trajectoryFromPrevious: bucket.trajectoryFromPrevious,
    sampleSize: bucket.sampleSize,
    improvedOrSustainedRate: bucket.improvedOrSustainedRate,
    breakoutOrProgressionRate: bucket.breakoutOrProgressionRate,
    regressionOrCollapseRate: bucket.regressionOrCollapseRate,
    failureRiskRate: bucket.failureRiskRate,
    medianNextProductionDelta: bucket.medianNextProductionDelta,
    medianNextRoleDelta: bucket.medianNextRoleDelta,
    confidence: bucket.confidence,
    confidenceGrade: bucket.confidenceGrade,
    recommendation: bucket.recommendation,
    primaryFailureModes: bucket.primaryFailureModes.map((mode) => ({
      key: mode.key,
      label: mode.label,
      rate: mode.rate,
    })),
    summary: bucket.summary,
  };
}

function main() {
  const calibration = readCalibration(inputPath);
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: calibration.generatedAt || null,
    sourceRows: calibration.rowCount,
    calibratedRows: calibration.calibratedRowCount,
    bucketCount: calibration.bucketCount,
    outputPolicy: 'compact-runtime-calibration-only; raw player-season rows and player examples stay offline',
    minSampleSize,
    buckets: calibration.buckets
      .filter((bucket) => bucket.sampleSize >= minSampleSize)
      .map(compactBucket),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Published ${payload.buckets.length} compact calibration buckets to ${path.relative(rootDir, outputPath)}.`);
}

main();
