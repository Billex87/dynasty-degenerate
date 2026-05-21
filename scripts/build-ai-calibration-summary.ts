import fs from 'node:fs';
import path from 'node:path';
import {
  summarizeAIPredictionReliability,
  summarizeSourceAgreementReliability,
  type AIPredictionEvent,
  type AIPredictionReliabilitySummary,
} from '../server/aiPredictionCalibration';

const rootDir = process.cwd();
const inputPath = path.resolve(rootDir, process.env.AI_PREDICTIONS_FILE || '.cache/modeling/ai-prediction-events.json');
const outputDir = path.resolve(rootDir, process.env.OUT_DIR || '.cache/modeling/ai-calibration');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Build offline AI prediction calibration summaries.',
    '',
    'This turns saved AI prediction events into reliability buckets that can power admin calibration boards.',
    '',
    'Environment:',
    '  AI_PREDICTIONS_FILE=.cache/modeling/ai-prediction-events.json',
    '  OUT_DIR=.cache/modeling/ai-calibration',
    '',
    'Input may be an array or { events: [...] } of AIPredictionEvent objects.',
  ].join('\n'));
  process.exit(0);
}

function readJson<T>(filePath: string, label: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${path.relative(rootDir, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function isEvent(value: unknown): value is AIPredictionEvent {
  const candidate = value as Partial<AIPredictionEvent>;
  return Boolean(
    candidate?.schemaVersion === 1
    && candidate.eventId
    && candidate.predictionKey
    && candidate.surface
    && candidate.action
    && candidate.outcome
  );
}

function readEvents(filePath: string): AIPredictionEvent[] {
  const parsed = readJson<unknown>(filePath, 'AI prediction events file');
  if (Array.isArray(parsed)) return parsed.filter(isEvent);
  const wrapped = parsed as { events?: unknown[] };
  if (Array.isArray(wrapped.events)) return wrapped.events.filter(isEvent);
  throw new Error(`Invalid AI prediction events file: ${path.relative(rootDir, filePath)}`);
}

function formatPct(value: number | null): string {
  return value === null ? 'n/a' : `${value}%`;
}

function writeMarkdownSummary(filePath: string, title: string, summary: AIPredictionReliabilitySummary) {
  const rows = summary.buckets.slice(0, 40);
  const markdown = [
    `# ${title}`,
    '',
    `Generated from ${summary.eventCount} AI prediction events with ${summary.scoredCount} scored outcomes.`,
    '',
    '| Bucket | Events | Scored | Hits | Misses | Pending | Avg confidence | Hit rate | Gap | Brier | Recommendation | Adj |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |',
    ...rows.map(bucket => `| ${bucket.key} | ${bucket.eventCount} | ${bucket.scoredCount} | ${bucket.hitCount} | ${bucket.missCount} | ${bucket.pendingCount} | ${formatPct(bucket.avgConfidence)} | ${formatPct(bucket.hitRate)} | ${bucket.calibrationGap ?? 'n/a'} | ${bucket.brierScore ?? 'n/a'} | ${bucket.recommendation} | ${bucket.recommendedScoreAdjustment} |`),
    '',
  ].join('\n');

  fs.writeFileSync(filePath, markdown);
}

const events = readEvents(inputPath);
const reliability = summarizeAIPredictionReliability(events);
const sourceAgreement = summarizeSourceAgreementReliability(events);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'reliability.json'), `${JSON.stringify(reliability, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'source-agreement.json'), `${JSON.stringify(sourceAgreement, null, 2)}\n`);
writeMarkdownSummary(path.join(outputDir, 'reliability.md'), 'AI Prediction Reliability', reliability);
writeMarkdownSummary(path.join(outputDir, 'source-agreement.md'), 'AI Source Agreement Reliability', sourceAgreement);

console.log(`Wrote ${path.relative(rootDir, outputDir)}`);
console.log(`Events: ${events.length}, scored: ${reliability.scoredCount}, pending: ${reliability.pendingCount}`);
