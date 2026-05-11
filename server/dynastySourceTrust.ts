import fs from 'fs';
import path from 'path';
import { canonicalPlayerNameKey } from './leagueAnalysis';
import type { DynastySourceWeightKey, DynastySourceWeights } from './dynastySourceWeights';
import { annotateDiagnosticsWithTrustHistory } from './sourceTrustDiagnostics';
import type { RankingSourceDiagnostic } from '../shared/types';

export interface DynastySourceRow {
  name: string;
  value?: number | null;
  position?: string | null;
  rank?: number | null;
}

export interface DynastySourceTrust {
  key: DynastySourceWeightKey;
  source: string;
  score: number;
  baseWeight: number;
  multiplier: number;
  effectiveWeight: number;
  status: RankingSourceDiagnostic['status'];
  sampleSize: number;
  medianConsensusDeltaPct: number | null;
  recentSuccessRate: number | null;
  rowCountRatio: number | null;
  note: string;
}

export type DynastySourceRows = Partial<Record<DynastySourceWeightKey, Record<string, DynastySourceRow>>>;
export type DynastySourceTrustMap = Partial<Record<DynastySourceWeightKey, DynastySourceTrust>>;

type SnapshotValue = {
  name?: string;
  ktc_value?: number;
  market_value_ktc?: number;
  expert_value_flock?: number;
  expert_value_fantasypros?: number;
  fantasypros_dynasty_rank?: number | null;
  fantasypros_dynasty_position_rank?: string | null;
  expert_value_dynastynerds?: number;
  expert_value_fantasynerds?: number;
  market_value_fantasycalc?: number;
  expert_value_dynastyprocess?: number;
  position_rank?: string | null;
  value_sources?: string[];
};

const DYNASTY_SOURCE_LABELS: Record<DynastySourceWeightKey, string> = {
  flock: 'Flock Fantasy',
  fantasyPros: 'FantasyPros Dynasty',
  dynastyNerds: 'Dynasty Nerds',
  fantasyNerds: 'Fantasy Nerds',
  ktc: 'KTC',
  fantasyCalc: 'FantasyCalc',
  dynastyProcess: 'DynastyProcess',
};

const KTC_SNAPSHOT_DIR = path.join(process.cwd(), 'server', 'ktc-snapshots');
const DYNASTY_TRUST_HISTORY_LIMIT = 14;
const DYNASTY_TRUST_MIN_ALIGNMENT_SAMPLE = 20;
const DYNASTY_TRUST_FULL_ALIGNMENT_SAMPLE = 60;
const DYNASTY_TRUST_MIN_MULTIPLIER = 0.75;
const DYNASTY_TRUST_MAX_MULTIPLIER = 1.12;

function isDisabledValue(value?: string | null): boolean {
  return /^(?:0|false|off|no|disabled)$/i.test(String(value || '').trim());
}

function isDynastyAdaptiveTrustEnabled(): boolean {
  return !isDisabledValue(process.env.ENABLE_DYNASTY_ADAPTIVE_TRUST);
}

function toNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function medianNumber(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function sourceRowValue(row?: DynastySourceRow | null): number | null {
  return toNumber(row?.value);
}

function upsertSourceRow(rows: Record<string, DynastySourceRow>, key: string, row: DynastySourceRow) {
  const canonicalKey = canonicalPlayerNameKey(row.name || key);
  const value = sourceRowValue(row);
  if (!canonicalKey || !row.name || !value) return;

  const existing = rows[canonicalKey];
  const existingValue = sourceRowValue(existing) || 0;
  if (!existing || value >= existingValue) {
    rows[canonicalKey] = row;
  }
}

export function createDynastySourceRows<T>(
  values: Record<string, T>,
  selectRow: (row: T, key: string) => DynastySourceRow | null | undefined,
): Record<string, DynastySourceRow> {
  const rows: Record<string, DynastySourceRow> = {};
  for (const [key, value] of Object.entries(values || {})) {
    const row = selectRow(value, key);
    if (row) upsertSourceRow(rows, key, row);
  }
  return rows;
}

export function getDynastySourceRowsFromSnapshotValues(values: Record<string, SnapshotValue>): DynastySourceRows {
  const rows: DynastySourceRows = {
    flock: {},
    fantasyPros: {},
    dynastyNerds: {},
    fantasyNerds: {},
    ktc: {},
    fantasyCalc: {},
    dynastyProcess: {},
  };

  for (const [key, value] of Object.entries(values || {})) {
    const name = value.name || key;
    const position = value.position_rank?.match(/^[A-Z]+/)?.[0] || null;
    const sources = new Set(value.value_sources || []);
    const ktcValue = toNumber(value.market_value_ktc) || (sources.has('KTC') ? toNumber(value.ktc_value) : null);
    const sourceValues: Array<[DynastySourceWeightKey, number | null]> = [
      ['flock', toNumber(value.expert_value_flock)],
      ['fantasyPros', toNumber(value.expert_value_fantasypros)],
      ['dynastyNerds', toNumber(value.expert_value_dynastynerds)],
      ['fantasyNerds', toNumber(value.expert_value_fantasynerds)],
      ['ktc', ktcValue],
      ['fantasyCalc', toNumber(value.market_value_fantasycalc)],
      ['dynastyProcess', toNumber(value.expert_value_dynastyprocess)],
    ];

    for (const [source, sourceValue] of sourceValues) {
      if (!sourceValue) continue;
      upsertSourceRow(rows[source] || (rows[source] = {}), key, {
        name,
        position,
        value: sourceValue,
      });
    }
  }

  return rows;
}

function getSnapshotValues(payload: unknown, valueProfileKey?: string): Record<string, SnapshotValue> {
  const data = payload as Record<string, any> | null;
  if (!data || typeof data !== 'object') return {};
  if (valueProfileKey && data.blendedProfiles?.[valueProfileKey] && typeof data.blendedProfiles[valueProfileKey] === 'object') {
    return data.blendedProfiles[valueProfileKey] as Record<string, SnapshotValue>;
  }
  if (data.values && typeof data.values === 'object') return data.values as Record<string, SnapshotValue>;
  return data as Record<string, SnapshotValue>;
}

export function loadRecentDynastySourceRowsFromLocalSnapshots(
  valueProfileKey?: string,
  limit = DYNASTY_TRUST_HISTORY_LIMIT,
): DynastySourceRows[] {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return [];

  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) return [];
    return fs.readdirSync(KTC_SNAPSHOT_DIR)
      .filter((fileName) => /^ktc-snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(fileName))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit)
      .map((fileName) => {
        const payload = JSON.parse(fs.readFileSync(path.join(KTC_SNAPSHOT_DIR, fileName), 'utf8'));
        return getDynastySourceRowsFromSnapshotValues(getSnapshotValues(payload, valueProfileKey));
      })
      .filter((sourceRows) => Object.values(sourceRows).some((rows) => Object.keys(rows || {}).length > 0));
  } catch (error) {
    console.warn('[DynastySourceTrust] Failed to load local dynasty source history:', error);
    return [];
  }
}

function getConsensusAlignment(
  source: DynastySourceWeightKey,
  sourceMaps: DynastySourceRows,
): { sampleSize: number; medianConsensusDeltaPct: number | null } {
  const rows = sourceMaps[source] || {};
  const deltas: number[] = [];

  for (const [key, row] of Object.entries(rows)) {
    const value = sourceRowValue(row);
    if (!value) continue;

    const otherValues = (Object.entries(sourceMaps) as Array<[DynastySourceWeightKey, Record<string, DynastySourceRow> | undefined]>)
      .filter(([otherSource]) => otherSource !== source)
      .map(([, otherRows]) => sourceRowValue(otherRows?.[canonicalPlayerNameKey(key)]))
      .filter((otherValue): otherValue is number => Boolean(otherValue && otherValue > 0));
    if (!otherValues.length) continue;

    const consensus = medianNumber(otherValues);
    if (!consensus) continue;
    deltas.push(Math.abs(value - consensus) / consensus);
  }

  return {
    sampleSize: deltas.length,
    medianConsensusDeltaPct: medianNumber(deltas),
  };
}

function getRecentSuccessRate(source: DynastySourceWeightKey, history: DynastySourceRows[]): number | null {
  if (!history.length) return null;
  const scores = history.map((sourceRows) => (Object.keys(sourceRows[source] || {}).length > 0 ? 1 : 0.35));
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function getRowCountRatio(source: DynastySourceWeightKey, currentRowCount: number, history: DynastySourceRows[]): number | null {
  const previousCounts = history
    .map((sourceRows) => Object.keys(sourceRows[source] || {}).length)
    .filter((count) => count > 0);
  const baseline = medianNumber(previousCounts);
  if (!baseline || !currentRowCount) return null;
  return currentRowCount / baseline;
}

function getCurrentStatusBaseScore(status: RankingSourceDiagnostic['status']): number {
  switch (status) {
    case 'loaded':
      return 68;
    case 'empty':
      return 42;
    case 'stale':
      return 32;
    case 'error':
      return 25;
    case 'disabled':
      return 50;
    default:
      return 50;
  }
}

function scoreAlignment(alignment: { sampleSize: number; medianConsensusDeltaPct: number | null }): number {
  if (alignment.sampleSize < DYNASTY_TRUST_MIN_ALIGNMENT_SAMPLE || alignment.medianConsensusDeltaPct === null) return 0;

  const delta = alignment.medianConsensusDeltaPct;
  const rawAdjustment = delta <= 0.08
    ? 11
    : delta <= 0.15
      ? 5
      : delta <= 0.25
        ? -8
        : -17;
  const sampleConfidence = clampNumber(alignment.sampleSize / DYNASTY_TRUST_FULL_ALIGNMENT_SAMPLE, 0.35, 1);
  return rawAdjustment * sampleConfidence;
}

function scoreRowCountRatio(rowCountRatio: number | null): number {
  if (rowCountRatio === null) return 0;
  if (rowCountRatio < 0.5) return -18;
  if (rowCountRatio < 0.75) return -8;
  if (rowCountRatio <= 1.25) return 5;
  if (rowCountRatio > 1.8) return -5;
  return 1;
}

function formatPercent(value: number | null, decimals = 0): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(decimals)}%`;
}

function formatRatio(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${value.toFixed(2)}x`;
}

function buildTrustNote(input: {
  status: RankingSourceDiagnostic['status'];
  alignment: { sampleSize: number; medianConsensusDeltaPct: number | null };
  recentSuccessRate: number | null;
  rowCountRatio: number | null;
}): string {
  const parts: string[] = [];
  if (input.status !== 'loaded') parts.push(`current status is ${input.status}`);
  const alignmentPct = formatPercent(input.alignment.medianConsensusDeltaPct, 1);
  if (alignmentPct && input.alignment.sampleSize >= DYNASTY_TRUST_MIN_ALIGNMENT_SAMPLE) {
    parts.push(`${alignmentPct} median consensus drift across ${input.alignment.sampleSize.toLocaleString('en-US')} overlaps`);
  } else {
    parts.push('waiting for more dynasty consensus overlap');
  }
  const recentHealth = formatPercent(input.recentSuccessRate, 0);
  if (recentHealth) parts.push(`${recentHealth} recent source health`);
  const rowRatio = formatRatio(input.rowCountRatio);
  if (rowRatio) parts.push(`${rowRatio} recent row-count baseline`);
  return parts.join('; ');
}

export function calculateDynastySourceTrust(input: {
  sourceMaps: DynastySourceRows;
  baseWeights: DynastySourceWeights;
  history?: DynastySourceRows[];
}): DynastySourceTrustMap {
  const history = input.history || [];

  return Object.fromEntries((Object.keys(input.baseWeights) as DynastySourceWeightKey[]).map((source) => {
    const sourceRows = input.sourceMaps[source] || {};
    const status: RankingSourceDiagnostic['status'] = Object.keys(sourceRows).length > 0 ? 'loaded' : 'empty';
    const alignment = getConsensusAlignment(source, input.sourceMaps);
    const recentSuccessRate = getRecentSuccessRate(source, history);
    const rowCountRatio = getRowCountRatio(source, Object.keys(sourceRows).length, history);
    const hasTrustEvidence = status !== 'loaded'
      || recentSuccessRate !== null
      || rowCountRatio !== null
      || alignment.sampleSize >= DYNASTY_TRUST_MIN_ALIGNMENT_SAMPLE;

    let score = getCurrentStatusBaseScore(status);
    if (recentSuccessRate !== null) score += (recentSuccessRate - 0.7) * 28;
    score += scoreAlignment(alignment);
    score += scoreRowCountRatio(rowCountRatio);

    const boundedScore = Math.round(clampNumber(score, 0, 100));
    const multiplier = isDynastyAdaptiveTrustEnabled() && hasTrustEvidence
      ? Number((DYNASTY_TRUST_MIN_MULTIPLIER + (boundedScore / 100) * (DYNASTY_TRUST_MAX_MULTIPLIER - DYNASTY_TRUST_MIN_MULTIPLIER)).toFixed(3))
      : 1;
    const baseWeight = input.baseWeights[source] || 0;
    const effectiveWeight = Number((baseWeight * multiplier).toFixed(4));

    const trust: DynastySourceTrust = {
      key: source,
      source: DYNASTY_SOURCE_LABELS[source],
      score: boundedScore,
      baseWeight,
      multiplier,
      effectiveWeight,
      status,
      sampleSize: alignment.sampleSize,
      medianConsensusDeltaPct: alignment.medianConsensusDeltaPct,
      recentSuccessRate,
      rowCountRatio,
      note: isDynastyAdaptiveTrustEnabled()
        ? buildTrustNote({ status, alignment, recentSuccessRate, rowCountRatio })
        : 'adaptive dynasty trust is disabled by ENABLE_DYNASTY_ADAPTIVE_TRUST',
    };
    return [source, trust];
  })) as DynastySourceTrustMap;
}

export function calculatePreviousDynastySourceTrust(input: {
  baseWeights: DynastySourceWeights;
  history?: DynastySourceRows[];
}): DynastySourceTrustMap {
  const [previousSourceRows, ...olderSourceRows] = input.history || [];
  if (!previousSourceRows) return {};

  return calculateDynastySourceTrust({
    sourceMaps: previousSourceRows,
    baseWeights: input.baseWeights,
    history: olderSourceRows,
  });
}

export function applyDynastySourceTrust(
  baseWeights: DynastySourceWeights,
  sourceTrust: DynastySourceTrustMap = {},
): DynastySourceWeights {
  return {
    flock: sourceTrust.flock?.effectiveWeight ?? baseWeights.flock,
    fantasyPros: sourceTrust.fantasyPros?.effectiveWeight ?? baseWeights.fantasyPros,
    dynastyNerds: sourceTrust.dynastyNerds?.effectiveWeight ?? baseWeights.dynastyNerds,
    fantasyNerds: sourceTrust.fantasyNerds?.effectiveWeight ?? baseWeights.fantasyNerds,
    ktc: sourceTrust.ktc?.effectiveWeight ?? baseWeights.ktc,
    fantasyCalc: sourceTrust.fantasyCalc?.effectiveWeight ?? baseWeights.fantasyCalc,
    dynastyProcess: sourceTrust.dynastyProcess?.effectiveWeight ?? baseWeights.dynastyProcess,
  };
}

export function buildDynastySourceDiagnostics(
  sourceMaps: DynastySourceRows,
  sourceTrust: DynastySourceTrustMap = {},
  previousSourceTrust: DynastySourceTrustMap = {},
): RankingSourceDiagnostic[] {
  return annotateDiagnosticsWithTrustHistory((Object.keys(DYNASTY_SOURCE_LABELS) as DynastySourceWeightKey[]).map((source) => {
    const rows = sourceMaps[source] || {};
    const trust = sourceTrust[source] || null;
    const rowCount = Object.keys(rows).length;
    const status: RankingSourceDiagnostic['status'] = rowCount > 0 ? 'loaded' : 'empty';
    return {
      key: source,
      source: DYNASTY_SOURCE_LABELS[source],
      board: 'dynasty',
      status,
      rowCount,
      note: rowCount > 0
        ? `${DYNASTY_SOURCE_LABELS[source]} loaded ${rowCount.toLocaleString('en-US')} dynasty row${rowCount === 1 ? '' : 's'} for the value blend.`
        : `${DYNASTY_SOURCE_LABELS[source]} returned no usable dynasty rows. Other available source weights normalize automatically.`,
      error: null,
      loadedAt: new Date().toISOString(),
      trustScore: trust?.score ?? null,
      trustMultiplier: trust?.multiplier ?? null,
      baseWeight: trust?.baseWeight ?? null,
      effectiveWeight: trust?.effectiveWeight ?? null,
      trustSampleSize: trust?.sampleSize ?? null,
      medianConsensusDeltaPct: trust?.medianConsensusDeltaPct ?? null,
      recentSuccessRate: trust?.recentSuccessRate ?? null,
      rowCountRatio: trust?.rowCountRatio ?? null,
      trustNote: trust?.note ?? null,
    };
  }), previousSourceTrust);
}
