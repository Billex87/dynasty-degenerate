import fs from 'node:fs';
import path from 'node:path';
import {
  buildPlayerSeasonComparisonBacktest,
  type PlayerSeasonComparisonBacktestResult,
  type PlayerSeasonComparisonGroupSummary,
} from '../server/playerSeasonComparisonBacktest';
import type { PlayerSeasonOutcomeRow } from '../server/playerSeasonOutcomeModel';

const rootDir = process.cwd();
const rowsPath = path.resolve(
  rootDir,
  process.env.ROWS_FILE || '.cache/modeling/player-season-outcomes/rows.json'
);
const outputDir = path.resolve(rootDir, process.env.OUT_DIR || '.cache/modeling/player-comparison-backtest');
const peerLimit = Number(process.env.PEER_LIMIT || 8);
const minSimilarity = Number(process.env.MIN_SIMILARITY || 58);

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Backtest historical player comparison reads against offline player-season outcomes.',
    '',
    'Default input and output are gitignored .cache files. This does not affect pages or report payloads.',
    '',
    'Environment:',
    '  ROWS_FILE=.cache/modeling/player-season-outcomes/rows.json',
    '  OUT_DIR=.cache/modeling/player-comparison-backtest',
    '  PEER_LIMIT=8',
    '  MIN_SIMILARITY=58',
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

function formatPct(value: number | null): string {
  return value === null ? 'n/a' : `${value}%`;
}

function groupTable(rows: Array<{ label: string } & PlayerSeasonComparisonGroupSummary>): string {
  if (!rows.length) return '_None._';
  return [
    '| Group | Eligible | Compared | No Comp | Hit Rate | False Positive | False Negative | Positive Precision | Negative Precision | Avg Similarity |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => `| ${row.label} | ${row.eligibleCount} | ${row.comparedCount} | ${row.noCompCount} | ${formatPct(row.hitRate)} | ${formatPct(row.falsePositiveRate)} | ${formatPct(row.falseNegativeRate)} | ${formatPct(row.positivePrecision)} | ${formatPct(row.negativePrecision)} | ${row.averageSimilarity ?? 'n/a'} |`),
  ].join('\n');
}

function exampleTable(rows: PlayerSeasonComparisonBacktestResult['examples']['falsePositives']): string {
  if (!rows.length) return '_None._';
  return [
    '| Player Season | Position | Predicted | Actual | Avg Similarity | Comps | Note |',
    '| --- | --- | --- | --- | ---: | ---: | --- |',
    ...rows.map((row) => `| ${row.playerName} ${row.season} | ${row.position} | ${row.predictedDirection ?? 'none'} | ${row.actualDirection} | ${row.averageSimilarity ?? 'n/a'} | ${row.compCount} | ${row.note} |`),
  ].join('\n');
}

function writeMarkdownSummary(outputPath: string, result: PlayerSeasonComparisonBacktestResult) {
  const positionRows = Object.entries(result.byPosition)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([position, summary]) => ({ label: position, ...summary }));
  const seasonRows = Object.entries(result.bySeason)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([season, summary]) => ({ label: season, ...summary }));
  const trajectoryRows = Object.entries(result.byTrajectory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([trajectory, summary]) => ({ label: trajectory.replace(/-/g, ' '), ...summary }));
  const driftRows = result.calibrationDrift.length
    ? [
        '| Season | Compared | Hit Rate | Hit-Rate Drift | False Positive |',
        '| --- | ---: | ---: | ---: | ---: |',
        ...result.calibrationDrift.map((row) => `| ${row.season} | ${row.comparedCount} | ${formatPct(row.hitRate)} | ${row.hitRateDriftFromOverall === null ? 'n/a' : `${row.hitRateDriftFromOverall}%`} | ${formatPct(row.falsePositiveRate)} |`),
      ].join('\n')
    : '_None._';

  const markdown = [
    '# Player Comparison Backtest',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Rows: ${result.rowCount}`,
    `Eligible rows: ${result.eligibleRowCount}`,
    `Compared rows: ${result.comparedRowCount}`,
    `No-comp rows: ${result.noCompRowCount}`,
    `Decision: ${result.decision}`,
    `Decision reason: ${result.decisionReason}`,
    '',
    '## Overall',
    '',
    groupTable([{ label: 'All', ...result.summary }]),
    '',
    '## By Position',
    '',
    groupTable(positionRows),
    '',
    '## By Season',
    '',
    groupTable(seasonRows),
    '',
    '## By Prior Trajectory',
    '',
    groupTable(trajectoryRows),
    '',
    '## Calibration Drift',
    '',
    driftRows,
    '',
    '## False Positives',
    '',
    exampleTable(result.examples.falsePositives),
    '',
    '## False Negatives',
    '',
    exampleTable(result.examples.falseNegatives),
    '',
    '## Strongest Hits',
    '',
    exampleTable(result.examples.strongestHits),
    '',
    '## Feature Coverage',
    '',
    'Used:',
    ...result.featureCoverage.used.map((item) => `- ${item}`),
    '',
    'Not yet warehouse-backed:',
    ...result.featureCoverage.notYetWarehouseBacked.map((item) => `- ${item}`),
    '',
    '## Runtime Boundary',
    '',
    'This is an offline diagnostic artifact. Do not ship raw rows, examples, or this summary in normal report payloads.',
    '',
  ].join('\n');

  fs.writeFileSync(outputPath, markdown);
}

function main() {
  const rows = readRows(rowsPath);
  const diagnostics = buildPlayerSeasonComparisonBacktest(rows, {
    peerLimit: Number.isFinite(peerLimit) ? peerLimit : 8,
    minSimilarity: Number.isFinite(minSimilarity) ? minSimilarity : 58,
  });
  const payload = {
    ...diagnostics,
    generatedAt: new Date().toISOString(),
    sourceRowsFile: path.relative(rootDir, rowsPath),
    options: {
      peerLimit: Number.isFinite(peerLimit) ? peerLimit : 8,
      minSimilarity: Number.isFinite(minSimilarity) ? minSimilarity : 58,
    },
    outputPolicy: 'offline-diagnostic-only; pages and report payloads should consume only intentionally published compact summaries',
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'diagnostics.json'), `${JSON.stringify(payload, null, 2)}\n`);
  writeMarkdownSummary(path.join(outputDir, 'summary.md'), diagnostics);

  console.log(`Backtested ${diagnostics.comparedRowCount} comparison reads across ${diagnostics.eligibleRowCount} eligible rows.`);
  console.log(`Decision: ${diagnostics.decision} (${diagnostics.decisionReason})`);
  console.log(`Wrote ${path.relative(rootDir, outputDir)}`);
}

main();
