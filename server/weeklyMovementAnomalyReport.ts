import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY,
  WEEKLY_MOMENTUM_MIN_ABSOLUTE_CHANGE,
  getWeeklyMomentumBaselineTargetDateKey,
} from './valueBaselinePolicy';
import { KTC_SNAPSHOT_DIR, loadLocalKtcSnapshotForDate } from './ktcLoader';

type SnapshotValue = {
  name?: string;
  ktc_value?: number;
  dynasty_value?: number;
  true_value?: number;
  redraft_value?: number;
  market_value_ktc?: number;
  position_rank?: string | null;
  fantasypros_position_rank?: string | null;
  dynastynerds_position_rank?: string | null;
  fantasynerds_position_rank?: string | null;
  value_sources?: string[];
  benchmark_sources?: string[];
};

type SnapshotValues = Record<string, SnapshotValue>;

export type WeeklyMovementAnomalyReason =
  | 'extreme-pct-change'
  | 'large-absolute-change'
  | 'low-baseline-denominator'
  | 'source-set-changed';

export type WeeklyMovementAnomalyRow = {
  playerKey: string;
  name: string;
  positionRank: string | null;
  baselineValue: number;
  currentValue: number;
  diff: number;
  pctChange: number;
  baselineSources: string[];
  currentSources: string[];
  reasons: WeeklyMovementAnomalyReason[];
};

export type WeeklyMovementAnomalySummary = {
  snapshotDir: string;
  valueProfileKey: string | null;
  currentDateKey: string | null;
  baselineDateKey: string | null;
  baselineTargetDateKey: string;
  baselineFloorDateKey: string;
  comparedPlayers: number;
  totalAnomalies: number;
  limit: number;
  rows: WeeklyMovementAnomalyRow[];
};

type AnomalyOptions = {
  minAbsoluteChange?: number;
  extremePctChange?: number;
  lowBaselineValue?: number;
  sourceSwingMinAbsoluteChange?: number;
};

export function findWeeklyMovementAnomalies(
  currentValues: SnapshotValues,
  baselineValues: SnapshotValues,
  options: AnomalyOptions = {},
): { comparedPlayers: number; rows: WeeklyMovementAnomalyRow[] } {
  const minAbsoluteChange = options.minAbsoluteChange ?? WEEKLY_MOMENTUM_MIN_ABSOLUTE_CHANGE;
  const extremePctChange = options.extremePctChange ?? 35;
  const lowBaselineValue = options.lowBaselineValue ?? 500;
  const sourceSwingMinAbsoluteChange = options.sourceSwingMinAbsoluteChange ?? 250;
  const rows: WeeklyMovementAnomalyRow[] = [];
  let comparedPlayers = 0;

  for (const [playerKey, currentRow] of Object.entries(currentValues)) {
    const baselineRow = baselineValues[playerKey];
    if (!baselineRow) continue;

    const currentValue = getPrimaryValue(currentRow);
    const baselineValue = getPrimaryValue(baselineRow);
    if (currentValue === null || baselineValue === null || currentValue <= 0 || baselineValue <= 0) continue;

    comparedPlayers += 1;
    const diff = currentValue - baselineValue;
    if (diff === 0) continue;

    const pctChange = (diff / baselineValue) * 100;
    const baselineSources = normalizeSources(baselineRow);
    const currentSources = normalizeSources(currentRow);
    const sourceSetChanged = baselineSources.join('|') !== currentSources.join('|');
    const reasons: WeeklyMovementAnomalyReason[] = [];

    if (Math.abs(pctChange) >= extremePctChange) reasons.push('extreme-pct-change');
    if (Math.abs(diff) >= Math.max(minAbsoluteChange * 3, 300)) reasons.push('large-absolute-change');
    if (baselineValue <= lowBaselineValue && Math.abs(diff) >= minAbsoluteChange) reasons.push('low-baseline-denominator');
    if (sourceSetChanged && Math.abs(diff) >= sourceSwingMinAbsoluteChange) reasons.push('source-set-changed');
    if (!reasons.length) continue;

    rows.push({
      playerKey,
      name: currentRow.name || baselineRow.name || playerKey,
      positionRank: getPositionRank(currentRow) || getPositionRank(baselineRow),
      baselineValue,
      currentValue,
      diff,
      pctChange: Math.round(pctChange * 10) / 10,
      baselineSources,
      currentSources,
      reasons,
    });
  }

  rows.sort((a, b) => (
    Math.abs(b.diff) - Math.abs(a.diff)
    || Math.abs(b.pctChange) - Math.abs(a.pctChange)
    || a.name.localeCompare(b.name)
  ));

  return { comparedPlayers, rows };
}

export function buildWeeklyMovementAnomalySummary(input: {
  snapshotDir?: string;
  valueProfileKey?: string | null;
  currentDateKey?: string | null;
  baselineDateKey?: string | null;
  now?: Date;
  limit?: number;
  options?: AnomalyOptions;
} = {}): WeeklyMovementAnomalySummary {
  const snapshotDir = input.snapshotDir || KTC_SNAPSHOT_DIR;
  const valueProfileKey = input.valueProfileKey || null;
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 25)));
  const dateKeys = listSnapshotDateKeys(snapshotDir);
  const todayKey = toDateKey(input.now || new Date());
  const baselineTargetDateKey = getWeeklyMomentumBaselineTargetDateKey(7, input.now || new Date());
  const currentDateKey = input.currentDateKey || latestOnOrBefore(dateKeys, todayKey);
  const baselineDateKey = input.baselineDateKey || latestOnOrBefore(
    dateKeys.filter((dateKey) => dateKey >= WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY),
    baselineTargetDateKey,
  );

  const currentValues = currentDateKey
    ? loadLocalKtcSnapshotForDate(currentDateKey, valueProfileKey || undefined)
    : {};
  const baselineValues = baselineDateKey
    ? loadLocalKtcSnapshotForDate(baselineDateKey, valueProfileKey || undefined)
    : {};
  const result = findWeeklyMovementAnomalies(currentValues, baselineValues, input.options);

  return {
    snapshotDir,
    valueProfileKey,
    currentDateKey,
    baselineDateKey,
    baselineTargetDateKey,
    baselineFloorDateKey: WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY,
    comparedPlayers: result.comparedPlayers,
    totalAnomalies: result.rows.length,
    limit,
    rows: result.rows.slice(0, limit),
  };
}

function getPrimaryValue(row: SnapshotValue): number | null {
  return positive(row.ktc_value)
    ?? positive(row.dynasty_value)
    ?? positive(row.true_value)
    ?? positive(row.market_value_ktc)
    ?? positive(row.redraft_value)
    ?? null;
}

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeSources(row: SnapshotValue): string[] {
  return Array.from(new Set([
    ...(row.value_sources || []),
    ...(row.benchmark_sources || []),
  ].map((source) => String(source).trim()).filter(Boolean))).sort();
}

function getPositionRank(row: SnapshotValue): string | null {
  return row.position_rank
    || row.fantasypros_position_rank
    || row.dynastynerds_position_rank
    || row.fantasynerds_position_rank
    || null;
}

function listSnapshotDateKeys(snapshotDir: string): string[] {
  try {
    if (!fs.existsSync(snapshotDir)) return [];
    return fs
      .readdirSync(snapshotDir)
      .map((fileName) => fileName.match(/^ktc-snapshot-(\d{4}-\d{2}-\d{2})\.json$/)?.[1] || null)
      .filter((dateKey): dateKey is string => Boolean(dateKey))
      .sort();
  } catch {
    return [];
  }
}

function latestOnOrBefore(dateKeys: string[], maxDateKey: string): string | null {
  return [...dateKeys].filter((dateKey) => dateKey <= maxDateKey).sort().at(-1) || null;
}

function toDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseCliArgs(): {
  valueProfileKey: string | null;
  currentDateKey: string | null;
  baselineDateKey: string | null;
  limit: number;
} {
  const getFlag = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
  return {
    valueProfileKey: getFlag('profile'),
    currentDateKey: getFlag('current'),
    baselineDateKey: getFlag('baseline'),
    limit: Number.parseInt(getFlag('limit') || '25', 10) || 25,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseCliArgs();
  const summary = buildWeeklyMovementAnomalySummary({
    valueProfileKey: args.valueProfileKey,
    currentDateKey: args.currentDateKey,
    baselineDateKey: args.baselineDateKey,
    limit: args.limit,
  });
  console.log(JSON.stringify(summary, null, 2));
}
