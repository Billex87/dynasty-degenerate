import fs from 'node:fs';
import path from 'node:path';
import {
  buildProjectionAccuracyBacktest,
  type ProjectionAccuracyBacktestResult,
  type ProjectionAccuracySummary,
  type ProjectionActualInputRow,
} from '../server/projectionAccuracyBacktest';
import type { NflScheduleSnapshotPayload } from '../server/nflScheduleSnapshots';
import type { PlayerProjectionSnapshotPayload } from '../server/playerProjectionSnapshots';

const rootDir = process.cwd();
const projectionPath = path.resolve(rootDir, process.env.PROJECTION_FILE || '.cache/modeling/player-projections/projection-snapshot.json');
const actualsPath = path.resolve(rootDir, process.env.ACTUALS_FILE || '.cache/modeling/player-projections/actuals.json');
const schedulePath = process.env.SCHEDULE_FILE
  ? path.resolve(rootDir, process.env.SCHEDULE_FILE)
  : null;
const outputDir = path.resolve(rootDir, process.env.OUT_DIR || '.cache/modeling/player-projection-backtest');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Backtest stored player projection snapshots against final fantasy-point actuals.',
    '',
    'Default input and output are gitignored .cache files. This is offline diagnostics only.',
    '',
    'Environment:',
    '  PROJECTION_FILE=.cache/modeling/player-projections/projection-snapshot.json',
    '  ACTUALS_FILE=.cache/modeling/player-projections/actuals.json',
    '  SCHEDULE_FILE=.cache/modeling/player-projections/schedule-snapshot.json',
    '  OUT_DIR=.cache/modeling/player-projection-backtest',
    '',
    'Actuals file may be either an array or { rows: [...] }.',
  ].join('\n'));
  process.exit(0);
}

function readJson<T>(filePath: string, label: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${path.relative(rootDir, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readActualRows(filePath: string): ProjectionActualInputRow[] {
  const parsed = readJson<ProjectionActualInputRow[] | { rows?: ProjectionActualInputRow[] }>(filePath, 'Projection actuals file');
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  throw new Error(`Invalid projection actuals file: ${path.relative(rootDir, filePath)}`);
}

function formatPct(value: number | null): string {
  return value === null ? 'n/a' : `${value}%`;
}

function groupTable(rows: Array<{ label: string } & ProjectionAccuracySummary>): string {
  if (!rows.length) return '_None._';
  return [
    '| Group | Compared | MAE | RMSE | Bias | Within 2 | Within 5 | Over Projection | Under Projection |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => `| ${row.label} | ${row.comparedCount} | ${row.meanAbsoluteError ?? 'n/a'} | ${row.rootMeanSquaredError ?? 'n/a'} | ${row.bias ?? 'n/a'} | ${formatPct(row.withinTwoPointRate)} | ${formatPct(row.withinFivePointRate)} | ${formatPct(row.overProjectionRate)} | ${formatPct(row.underProjectionRate)} |`),
  ].join('\n');
}

function summaryRows(groups: Record<string, ProjectionAccuracySummary>): Array<{ label: string } & ProjectionAccuracySummary> {
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, summary]) => ({ label, ...summary }));
}

function writeMarkdownSummary(outputPath: string, result: ProjectionAccuracyBacktestResult) {
  const largestMisses = result.largestMisses.length
    ? [
        '| Player | Pos | Week | Projected | Actual | Error | Context |',
        '| --- | --- | ---: | ---: | ---: | ---: | --- |',
        ...result.largestMisses.map((row) => `| ${row.playerName} | ${row.position} | ${row.week} | ${row.projectedFantasyPoints} | ${row.actualFantasyPoints} | ${row.error} | ${row.homeAway} vs ${row.opponent || 'unknown'}, ${row.opponentStrengthBucket}, ${row.rookieStatus}, ${row.draftCapitalBucket} |`),
      ].join('\n')
    : '_None._';
  const markdown = [
    '# Player Projection Accuracy Backtest',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Source: ${result.source}`,
    `Projection type: ${result.projectionType}`,
    `Scoring: ${result.scoringProfile}`,
    `Season/week: ${result.season}/${result.week ?? 'all'}`,
    `Projection rows: ${result.projectedRowCount}`,
    `Actual rows: ${result.actualRowCount}`,
    `Compared rows: ${result.comparedRowCount}`,
    `Missing actuals: ${result.missingActualCount}`,
    `Decision: ${result.decision}`,
    `Decision reason: ${result.decisionReason}`,
    '',
    '## Overall',
    '',
    groupTable([{ label: 'All', ...result.summary }]),
    '',
    '## By Position',
    '',
    groupTable(summaryRows(result.byPosition as Record<string, ProjectionAccuracySummary>)),
    '',
    '## By Home/Away',
    '',
    groupTable(summaryRows(result.byHomeAway)),
    '',
    '## By Opponent Strength',
    '',
    groupTable(summaryRows(result.byOpponentStrength)),
    '',
    '## By Rookie Status',
    '',
    groupTable(summaryRows(result.byRookieStatus)),
    '',
    '## By Draft Capital',
    '',
    groupTable(summaryRows(result.byDraftCapital)),
    '',
    '## Largest Misses',
    '',
    largestMisses,
    '',
    '## Runtime Boundary',
    '',
    'This is an offline diagnostic artifact. Do not ship raw comparisons or this summary in normal report payloads.',
    '',
  ].join('\n');

  fs.writeFileSync(outputPath, markdown);
}

function main() {
  const projectionSnapshot = readJson<PlayerProjectionSnapshotPayload>(projectionPath, 'Projection snapshot');
  const actualRows = readActualRows(actualsPath);
  const scheduleSnapshot = schedulePath && fs.existsSync(schedulePath)
    ? readJson<NflScheduleSnapshotPayload>(schedulePath, 'Schedule snapshot')
    : null;
  const result = buildProjectionAccuracyBacktest({
    projectionSnapshot,
    actualRows,
    scheduleSnapshot,
  });
  const payload = {
    ...result,
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      projectionSnapshot: path.relative(rootDir, projectionPath),
      actuals: path.relative(rootDir, actualsPath),
      scheduleSnapshot: schedulePath ? path.relative(rootDir, schedulePath) : null,
    },
    outputPolicy: 'offline-diagnostic-only; pages and report payloads should consume only intentionally published compact summaries',
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'diagnostics.json'), `${JSON.stringify(payload, null, 2)}\n`);
  writeMarkdownSummary(path.join(outputDir, 'summary.md'), result);

  console.log(`Backtested ${result.comparedRowCount} projection rows from ${result.projectedRowCount} projected rows.`);
  console.log(`Decision: ${result.decision} (${result.decisionReason})`);
  console.log(`Wrote ${path.relative(rootDir, outputDir)}`);
}

main();
