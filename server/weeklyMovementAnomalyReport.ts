import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY,
  WEEKLY_MOMENTUM_MIN_ABSOLUTE_CHANGE,
  getWeeklyMomentumBaselineTargetDateKey,
} from './valueBaselinePolicy';
import { KTC_SNAPSHOT_DIR, loadLocalKtcSnapshotForDate } from './ktcLoader';
import { getDb } from './db';

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
  sourceMode: 'local' | 'db';
  snapshotDir: string;
  valueProfileKey: string | null;
  currentDateKey: string | null;
  currentSnapshotAt: string | null;
  baselineDateKey: string | null;
  baselineSnapshotAt: string | null;
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

type KtcSnapshotSelection = {
  dateKey: string | null;
  snapshotAt: string | null;
  values: SnapshotValues;
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
    sourceMode: 'local',
    snapshotDir,
    valueProfileKey,
    currentDateKey,
    currentSnapshotAt: null,
    baselineDateKey,
    baselineSnapshotAt: null,
    baselineTargetDateKey,
    baselineFloorDateKey: WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY,
    comparedPlayers: result.comparedPlayers,
    totalAnomalies: result.rows.length,
    limit,
    rows: result.rows.slice(0, limit),
  };
}

export async function buildWeeklyMovementAnomalySummaryFromDb(input: {
  valueProfileKey?: string | null;
  currentDateKey?: string | null;
  baselineDateKey?: string | null;
  now?: Date;
  limit?: number;
  options?: AnomalyOptions;
} = {}): Promise<WeeklyMovementAnomalySummary> {
  const valueProfileKey = input.valueProfileKey || null;
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 25)));
  const todayKey = toDateKey(input.now || new Date());
  const baselineTargetDateKey = getWeeklyMomentumBaselineTargetDateKey(7, input.now || new Date());
  const [current, baseline] = await Promise.all([
    loadDbSnapshotOnOrBefore(input.currentDateKey || todayKey, valueProfileKey),
    loadDbSnapshotOnOrBefore(
      input.baselineDateKey || baselineTargetDateKey,
      valueProfileKey,
      WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY,
    ),
  ]);
  const result = findWeeklyMovementAnomalies(current.values, baseline.values, input.options);

  return {
    sourceMode: 'db',
    snapshotDir: '',
    valueProfileKey,
    currentDateKey: current.dateKey,
    currentSnapshotAt: current.snapshotAt,
    baselineDateKey: baseline.dateKey,
    baselineSnapshotAt: baseline.snapshotAt,
    baselineTargetDateKey,
    baselineFloorDateKey: WEEKLY_MOMENTUM_BASELINE_FLOOR_DATE_KEY,
    comparedPlayers: result.comparedPlayers,
    totalAnomalies: result.rows.length,
    limit,
    rows: result.rows.slice(0, limit),
  };
}

async function loadDbSnapshotOnOrBefore(
  maxDateKey: string,
  valueProfileKey?: string | null,
  minDateKey?: string,
): Promise<KtcSnapshotSelection> {
  const sql = await getDb();
  if (!sql) return { dateKey: null, snapshotAt: null, values: {} };

  const rows = await sql`
    SELECT
      to_char("snapshotDate" AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD') AS "dateKey",
      "snapshotDate",
      "ktcData"
    FROM "ktcSnapshots"
    WHERE to_char("snapshotDate" AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD') <= ${maxDateKey}
      AND (${minDateKey || null}::text IS NULL OR to_char("snapshotDate" AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD') >= ${minDateKey || null})
    ORDER BY "snapshotDate" DESC
    LIMIT 1
  ` as Array<{ dateKey?: string | null; snapshotDate?: Date | string | null; ktcData?: string | null }>;

  const row = rows[0];
  if (!row?.ktcData) return { dateKey: null, snapshotAt: null, values: {} };
  return {
    dateKey: row.dateKey || null,
    snapshotAt: row.snapshotDate ? new Date(row.snapshotDate).toISOString() : null,
    values: parseSnapshotValues(row.ktcData, valueProfileKey || undefined),
  };
}

function parseSnapshotValues(payload: string, valueProfileKey?: string): SnapshotValues {
  try {
    const parsed = JSON.parse(payload);
    if (
      valueProfileKey &&
      parsed &&
      typeof parsed === 'object' &&
      parsed.blendedProfiles &&
      typeof parsed.blendedProfiles === 'object' &&
      parsed.blendedProfiles[valueProfileKey] &&
      typeof parsed.blendedProfiles[valueProfileKey] === 'object'
    ) {
      return parsed.blendedProfiles[valueProfileKey] as SnapshotValues;
    }
    if (parsed && typeof parsed === 'object' && parsed.values && typeof parsed.values === 'object') {
      return parsed.values as SnapshotValues;
    }
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as SnapshotValues
      : {};
  } catch {
    return {};
  }
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
  sourceMode: 'local' | 'db';
  valueProfileKey: string | null;
  currentDateKey: string | null;
  baselineDateKey: string | null;
  limit: number;
} {
  const getFlag = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
  const sourceMode = getFlag('source') === 'db' ? 'db' : 'local';
  return {
    sourceMode,
    valueProfileKey: getFlag('profile'),
    currentDateKey: getFlag('current'),
    baselineDateKey: getFlag('baseline'),
    limit: Number.parseInt(getFlag('limit') || '25', 10) || 25,
  };
}

async function runCli() {
  const args = parseCliArgs();
  const summary = args.sourceMode === 'db'
    ? await buildWeeklyMovementAnomalySummaryFromDb({
      valueProfileKey: args.valueProfileKey,
      currentDateKey: args.currentDateKey,
      baselineDateKey: args.baselineDateKey,
      limit: args.limit,
    })
    : buildWeeklyMovementAnomalySummary({
      valueProfileKey: args.valueProfileKey,
      currentDateKey: args.currentDateKey,
      baselineDateKey: args.baselineDateKey,
      limit: args.limit,
    });
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
