import fs from 'node:fs';
import path from 'node:path';
import { buildPlayerSeasonCalibration } from '../server/playerSeasonCalibration';
import type { PlayerSeasonOutcomeRow } from '../server/playerSeasonOutcomeModel';

const rootDir = process.cwd();
const rowsPath = path.resolve(
  rootDir,
  process.env.ROWS_FILE || '.cache/modeling/player-season-outcomes/rows.json'
);
const outputDir = path.resolve(rootDir, process.env.OUT_DIR || '.cache/modeling/player-cohort-backtest');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Backtest player cohort/archetype buckets against offline player-season outcomes.',
    '',
    'Default input and output are gitignored .cache files. This does not affect pages or report payloads.',
    '',
    'Environment:',
    '  ROWS_FILE=.cache/modeling/player-season-outcomes/rows.json',
    '  OUT_DIR=.cache/modeling/player-cohort-backtest',
    '',
    'Run this after:',
    '  pnpm build:player-season-outcomes',
  ].join('\n'));
  process.exit(0);
}

function readRows(filePath: string): PlayerSeasonOutcomeRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Player-season rows not found: ${path.relative(rootDir, filePath)}. Run pnpm build:player-season-outcomes first.`);
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed?.rows)) throw new Error(`Invalid player-season rows file: ${path.relative(rootDir, filePath)}`);
  return parsed.rows as PlayerSeasonOutcomeRow[];
}

function markdownTable(rows: Array<{ label: string; sampleSize: number; positive: number | null; regression: number | null; failure: number | null; median: number | null; recommendation: string }>): string {
  if (!rows.length) return '_None._';
  return [
    '| Archetype | Samples | Improved/Sustained | Regression/Collapse | Material Failure | Median Next Production | Recommendation |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.map((row) => `| ${row.label} | ${row.sampleSize} | ${row.positive ?? 'n/a'}% | ${row.regression ?? 'n/a'}% | ${row.failure ?? 'n/a'}% | ${row.median ?? 'n/a'} | ${row.recommendation} |`),
  ].join('\n');
}

function writeMarkdownSummary(outputPath: string, calibration: ReturnType<typeof buildPlayerSeasonCalibration>) {
  const positiveRows = calibration.summary.strongestPositiveBuckets.slice(0, 10).map((bucket) => ({
    label: bucket.label,
    sampleSize: bucket.sampleSize,
    positive: bucket.improvedOrSustainedRate,
    regression: bucket.regressionOrCollapseRate,
    failure: bucket.failureRiskRate,
    median: bucket.medianNextProductionDelta,
    recommendation: bucket.recommendation,
  }));
  const riskRows = calibration.summary.highestRiskBuckets.slice(0, 10).map((bucket) => ({
    label: bucket.label,
    sampleSize: bucket.sampleSize,
    positive: bucket.improvedOrSustainedRate,
    regression: bucket.regressionOrCollapseRate,
    failure: bucket.failureRiskRate,
    median: bucket.medianNextProductionDelta,
    recommendation: bucket.recommendation,
  }));
  const positionLines = Object.entries(calibration.summary.byPosition)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([position, row]) => `- ${position}: ${row.sampleSize} samples, ${row.improvedOrSustainedRate ?? 'n/a'}% improved/sustained, ${row.regressionOrCollapseRate ?? 'n/a'}% regressed/collapsed, ${row.failureRiskRate ?? 'n/a'}% material failure, median next production ${row.medianNextProductionDelta ?? 'n/a'}`);

  const markdown = [
    '# Player Cohort Backtest',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Rows: ${calibration.rowCount}`,
    `Calibrated rows: ${calibration.calibratedRowCount}`,
    `Buckets: ${calibration.bucketCount}`,
    '',
    '## By Position',
    '',
    ...positionLines,
    '',
    '## Strongest Positive Buckets',
    '',
    markdownTable(positiveRows),
    '',
    '## Highest Risk Buckets',
    '',
    markdownTable(riskRows),
    '',
    '## Runtime Boundary',
    '',
    'This is an offline calibration artifact. Do not ship raw rows or this summary in normal report payloads.',
    '',
  ].join('\n');

  fs.writeFileSync(outputPath, markdown);
}

function main() {
  const rows = readRows(rowsPath);
  const calibration = buildPlayerSeasonCalibration(rows);
  const payload = {
    ...calibration,
    generatedAt: new Date().toISOString(),
    sourceRowsFile: path.relative(rootDir, rowsPath),
    outputPolicy: 'offline-calibration-only; pages and report payloads should consume only intentionally published compact summaries',
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'calibration.json'), `${JSON.stringify(payload, null, 2)}\n`);
  writeMarkdownSummary(path.join(outputDir, 'summary.md'), calibration);

  console.log(`Backtested ${calibration.calibratedRowCount} calibrated rows into ${calibration.bucketCount} buckets.`);
  const topPositive = calibration.summary.strongestPositiveBuckets[0];
  const topRisk = calibration.summary.highestRiskBuckets[0];
  if (topPositive) console.log(`Top positive: ${topPositive.label} (${topPositive.improvedOrSustainedRate}% improved/sustained, ${topPositive.sampleSize} samples)`);
  if (topRisk) console.log(`Top risk: ${topRisk.label} (${topRisk.failureRiskRate}% material failure, ${topRisk.sampleSize} samples)`);
  console.log(`Wrote ${path.relative(rootDir, outputDir)}`);
}

main();
