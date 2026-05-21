import fs from 'fs';
import path from 'path';
import { canonicalPlayerNameKey } from './leagueAnalysis';
import { listDevySourceSnapshots, upsertDevySourceSnapshot } from './db';
import { annotateDiagnosticsWithTrustHistory } from './sourceTrustDiagnostics';
import type { RankingSourceDiagnostic, RankingSourceWeightEntry } from '../shared/types';

export type ProspectSourceKey = 'fantasyProsDevy' | 'flock' | 'ktc' | 'prospectArchive';

export interface ProspectSourceRow {
  name: string;
  value?: number | null;
  position?: string | null;
  rank?: number | null;
}

export interface ProspectSourceTrust {
  key: ProspectSourceKey;
  source: string;
  score: number;
  baseWeight: number;
  multiplier: number;
  effectiveWeight: number;
  status: RankingSourceDiagnostic['status'];
  sampleSize: number;
  medianConsensusDeltaPct: number | null;
  note: string;
}

export type ProspectSourceRows = Partial<Record<ProspectSourceKey, Record<string, ProspectSourceRow>>>;
export type ProspectSourceWeights = Record<ProspectSourceKey, number>;
export type ProspectSourceTrustMap = Partial<Record<ProspectSourceKey, ProspectSourceTrust>>;

export type ProspectSourceSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  profileKey: string;
  sources: ProspectSourceRows;
  diagnostics: RankingSourceDiagnostic[];
};

const PROSPECT_SOURCE_LABELS: Record<ProspectSourceKey, string> = {
  fantasyProsDevy: 'FantasyPros Devy',
  flock: 'Flock Fantasy Devy',
  ktc: 'KTC Devy',
  prospectArchive: 'Prospect Archive',
};

const PROSPECT_SOURCE_NOTES: Record<ProspectSourceKey, string> = {
  fantasyProsDevy: 'Expert devy ECR/rank source for college and rookie-class ordering.',
  flock: 'Prospect and rookie market/rank source from Flock Fantasy.',
  ktc: 'Market signal from KTC devy/prospect profile values when available.',
  prospectArchive: 'Stored scouting archive rank/rating context; kept below market and rank sources.',
};

const PROSPECT_TRUST_MIN_ALIGNMENT_SAMPLE = 10;
const PROSPECT_TRUST_FULL_ALIGNMENT_SAMPLE = 35;
const PROSPECT_TRUST_MIN_MULTIPLIER = 0.75;
const PROSPECT_TRUST_MAX_MULTIPLIER = 1.12;
const PROSPECT_TRUST_HISTORY_LIMIT = 14;
const PROSPECT_SOURCE_SNAPSHOT_TIME_ZONE = 'America/Vancouver';
export const PROSPECT_SOURCE_SNAPSHOT_DIR = path.join(process.cwd(), 'server', 'devy-source-snapshots');

export const BASE_PROSPECT_SOURCE_WEIGHTS: ProspectSourceWeights = {
  fantasyProsDevy: 0.35,
  flock: 0.25,
  ktc: 0.30,
  prospectArchive: 0.10,
};

function isDisabledValue(value?: string | null): boolean {
  return /^(?:0|false|off|no|disabled)$/i.test(String(value || '').trim());
}

function isProspectAdaptiveTrustEnabled(): boolean {
  return !isDisabledValue(process.env.ENABLE_DEVY_ADAPTIVE_TRUST);
}

function areProspectSourceSnapshotsEnabled(): boolean {
  return !isDisabledValue(process.env.ENABLE_DEVY_SOURCE_SNAPSHOTS);
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

function sourceRowValue(row?: ProspectSourceRow | null): number | null {
  return toNumber(row?.value);
}

function getSnapshotDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PROSPECT_SOURCE_SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeProfileKey(profileKey: string): string {
  return profileKey.replace(/[^a-z0-9_-]/gi, '_');
}

function parseProspectSourceSnapshot(payload?: string | null): ProspectSourceSnapshotPayload | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as Partial<ProspectSourceSnapshotPayload>;
    if (parsed.schemaVersion !== 1 || !parsed.snapshotKey || !parsed.profileKey || !parsed.sources) return null;
    return parsed as ProspectSourceSnapshotPayload;
  } catch {
    return null;
  }
}

function readLocalProspectSourceSnapshots(profileKey: string, limit: number): ProspectSourceSnapshotPayload[] {
  try {
    if (!fs.existsSync(PROSPECT_SOURCE_SNAPSHOT_DIR)) return [];
    const safeProfileKey = sanitizeProfileKey(profileKey);
    const filePattern = new RegExp(`^devy-source-snapshot-${escapeRegExp(safeProfileKey)}-(\\d{4}-\\d{2}-\\d{2})\\.json$`);
    return fs.readdirSync(PROSPECT_SOURCE_SNAPSHOT_DIR)
      .filter((fileName) => filePattern.test(fileName))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit)
      .map((fileName) => {
        const payload = fs.readFileSync(path.join(PROSPECT_SOURCE_SNAPSHOT_DIR, fileName), 'utf8');
        return parseProspectSourceSnapshot(payload);
      })
      .filter((snapshot): snapshot is ProspectSourceSnapshotPayload => Boolean(snapshot && snapshot.profileKey === profileKey));
  } catch (error) {
    console.warn('[ProspectSourceTrust] Failed to read local devy source snapshots:', error);
    return [];
  }
}

export async function loadRecentProspectSourceSnapshots(
  profileKey: string,
  limit = PROSPECT_TRUST_HISTORY_LIMIT,
): Promise<ProspectSourceSnapshotPayload[]> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return [];

  const snapshotsByKey = new Map<string, ProspectSourceSnapshotPayload>();

  try {
    const storedSnapshots = await listDevySourceSnapshots(profileKey, limit);
    for (const stored of storedSnapshots) {
      const snapshot = parseProspectSourceSnapshot(stored.payload);
      if (snapshot?.profileKey === profileKey) snapshotsByKey.set(snapshot.snapshotKey, snapshot);
    }
  } catch (error) {
    console.warn('[ProspectSourceTrust] Failed to load database devy source snapshots:', error);
  }

  for (const snapshot of readLocalProspectSourceSnapshots(profileKey, limit)) {
    if (!snapshotsByKey.has(snapshot.snapshotKey)) snapshotsByKey.set(snapshot.snapshotKey, snapshot);
  }

  return Array.from(snapshotsByKey.values())
    .sort((a, b) => b.snapshotKey.localeCompare(a.snapshotKey) || b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, limit);
}

export function prospectRankToValue(rank?: number | null): number | null {
  const numericRank = toNumber(rank);
  if (!numericRank) return null;
  return Math.max(100, Math.round(10000 - (numericRank - 1) * 30));
}

export function createProspectSourceRows<T>(
  values: Record<string, T>,
  selectRow: (row: T, key: string) => ProspectSourceRow | null | undefined,
): Record<string, ProspectSourceRow> {
  const rows: Record<string, ProspectSourceRow> = {};
  for (const [key, value] of Object.entries(values || {})) {
    const row = selectRow(value, key);
    const canonicalKey = canonicalPlayerNameKey(row?.name || key);
    const rowValue = sourceRowValue(row);
    if (!row || !canonicalKey || !row.name || !rowValue) continue;
    const existing = rows[canonicalKey];
    const existingValue = sourceRowValue(existing) || 0;
    if (!existing || rowValue >= existingValue) rows[canonicalKey] = row;
  }
  return rows;
}

function getConsensusAlignment(
  source: ProspectSourceKey,
  sourceMaps: ProspectSourceRows,
): { sampleSize: number; medianConsensusDeltaPct: number | null } {
  const rows = sourceMaps[source] || {};
  const deltas: number[] = [];

  for (const [key, row] of Object.entries(rows)) {
    const value = sourceRowValue(row);
    if (!value) continue;

    const otherValues = (Object.entries(sourceMaps) as Array<[ProspectSourceKey, Record<string, ProspectSourceRow> | undefined]>)
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

function scoreAlignment(alignment: { sampleSize: number; medianConsensusDeltaPct: number | null }): number {
  if (alignment.sampleSize < PROSPECT_TRUST_MIN_ALIGNMENT_SAMPLE || alignment.medianConsensusDeltaPct === null) return 0;

  const delta = alignment.medianConsensusDeltaPct;
  const rawAdjustment = delta <= 0.10
    ? 10
    : delta <= 0.18
      ? 4
      : delta <= 0.30
        ? -7
        : -16;
  const sampleConfidence = clampNumber(alignment.sampleSize / PROSPECT_TRUST_FULL_ALIGNMENT_SAMPLE, 0.35, 1);
  return rawAdjustment * sampleConfidence;
}

function buildTrustNote(input: {
  status: RankingSourceDiagnostic['status'];
  alignment: { sampleSize: number; medianConsensusDeltaPct: number | null };
}): string {
  const parts: string[] = [];
  if (input.status !== 'loaded') parts.push(`current status is ${input.status}`);
  if (input.alignment.medianConsensusDeltaPct !== null && input.alignment.sampleSize >= PROSPECT_TRUST_MIN_ALIGNMENT_SAMPLE) {
    parts.push(`${(input.alignment.medianConsensusDeltaPct * 100).toFixed(1)}% median consensus drift across ${input.alignment.sampleSize.toLocaleString('en-US')} overlaps`);
  } else {
    parts.push('waiting for more prospect consensus overlap');
  }
  return parts.join('; ');
}

export function calculateProspectSourceTrust(input: {
  sourceMaps: ProspectSourceRows;
  baseWeights?: ProspectSourceWeights;
}): ProspectSourceTrustMap {
  const baseWeights = input.baseWeights || BASE_PROSPECT_SOURCE_WEIGHTS;
  return Object.fromEntries((Object.keys(baseWeights) as ProspectSourceKey[]).map((source) => {
    const rows = input.sourceMaps[source] || {};
    const status: RankingSourceDiagnostic['status'] = Object.keys(rows).length > 0 ? 'loaded' : 'empty';
    const alignment = getConsensusAlignment(source, input.sourceMaps);
    const hasTrustEvidence = status !== 'loaded' || alignment.sampleSize >= PROSPECT_TRUST_MIN_ALIGNMENT_SAMPLE;
    let score = status === 'loaded' ? 68 : 42;
    score += scoreAlignment(alignment);
    const boundedScore = Math.round(clampNumber(score, 0, 100));
    const multiplier = isProspectAdaptiveTrustEnabled() && hasTrustEvidence
      ? Number((PROSPECT_TRUST_MIN_MULTIPLIER + (boundedScore / 100) * (PROSPECT_TRUST_MAX_MULTIPLIER - PROSPECT_TRUST_MIN_MULTIPLIER)).toFixed(3))
      : 1;
    const baseWeight = baseWeights[source] || 0;

    const trust: ProspectSourceTrust = {
      key: source,
      source: PROSPECT_SOURCE_LABELS[source],
      score: boundedScore,
      baseWeight,
      multiplier,
      effectiveWeight: Number((baseWeight * multiplier).toFixed(4)),
      status,
      sampleSize: alignment.sampleSize,
      medianConsensusDeltaPct: alignment.medianConsensusDeltaPct,
      note: isProspectAdaptiveTrustEnabled()
        ? buildTrustNote({ status, alignment })
        : 'adaptive devy trust is disabled by ENABLE_DEVY_ADAPTIVE_TRUST',
    };
    return [source, trust];
  })) as ProspectSourceTrustMap;
}

export function calculatePreviousProspectSourceTrust(history: ProspectSourceSnapshotPayload[]): ProspectSourceTrustMap {
  const [previousSnapshot] = history;
  if (!previousSnapshot) return {};

  return calculateProspectSourceTrust({
    sourceMaps: previousSnapshot.sources || {},
  });
}

export function applyProspectSourceTrust(
  baseWeights: ProspectSourceWeights = BASE_PROSPECT_SOURCE_WEIGHTS,
  sourceTrust: ProspectSourceTrustMap = {},
): ProspectSourceWeights {
  return {
    fantasyProsDevy: sourceTrust.fantasyProsDevy?.effectiveWeight ?? baseWeights.fantasyProsDevy,
    flock: sourceTrust.flock?.effectiveWeight ?? baseWeights.flock,
    ktc: sourceTrust.ktc?.effectiveWeight ?? baseWeights.ktc,
    prospectArchive: sourceTrust.prospectArchive?.effectiveWeight ?? baseWeights.prospectArchive,
  };
}

export function getProspectSourceWeightEntries(
  sourceTrust: ProspectSourceTrustMap = {},
  baseWeights: ProspectSourceWeights = BASE_PROSPECT_SOURCE_WEIGHTS,
): RankingSourceWeightEntry[] {
  const effectiveWeights = (Object.keys(baseWeights) as ProspectSourceKey[]).map((source) => (
    sourceTrust[source]?.effectiveWeight ?? baseWeights[source]
  ));
  const totalEffectiveWeight = effectiveWeights.reduce((sum, weight) => sum + Math.max(0, weight), 0) || 1;

  return (Object.keys(baseWeights) as ProspectSourceKey[]).map((source) => {
    const trust = sourceTrust[source] || null;
    const effectiveWeight = trust?.effectiveWeight ?? baseWeights[source];
    const trustNote = trust ? ` Adaptive trust ${trust.score}/100 (${trust.multiplier.toFixed(2)}x base weight).` : '';
    return {
      key: source,
      source: PROSPECT_SOURCE_LABELS[source],
      weight: effectiveWeight,
      percent: Math.round((effectiveWeight / totalEffectiveWeight) * 100),
      note: `${PROSPECT_SOURCE_NOTES[source]}${trustNote}`,
      baseWeight: trust?.baseWeight ?? baseWeights[source],
      effectiveWeight,
      trustScore: trust?.score ?? null,
      trustMultiplier: trust?.multiplier ?? null,
    };
  });
}

export function formatProspectSourceWeights(sourceTrust: ProspectSourceTrustMap = {}): string {
  return getProspectSourceWeightEntries(sourceTrust)
    .filter((entry) => entry.weight > 0)
    .map((entry) => `${entry.source} ${entry.percent}%`)
    .join(', ');
}

export function buildProspectSourceDiagnostics(
  sourceMaps: ProspectSourceRows,
  sourceTrust: ProspectSourceTrustMap = {},
  previousSourceTrust: ProspectSourceTrustMap = {},
): RankingSourceDiagnostic[] {
  return annotateDiagnosticsWithTrustHistory((Object.keys(BASE_PROSPECT_SOURCE_WEIGHTS) as ProspectSourceKey[]).map((source) => {
    const rows = sourceMaps[source] || {};
    const trust = sourceTrust[source] || null;
    const rowCount = Object.keys(rows).length;
    const status: RankingSourceDiagnostic['status'] = rowCount > 0 ? 'loaded' : 'empty';
    return {
      key: source,
      source: PROSPECT_SOURCE_LABELS[source],
      board: 'devy',
      status,
      rowCount,
      note: rowCount > 0
        ? `${PROSPECT_SOURCE_LABELS[source]} loaded ${rowCount.toLocaleString('en-US')} prospect row${rowCount === 1 ? '' : 's'} for the devy board.`
        : `${PROSPECT_SOURCE_LABELS[source]} returned no usable prospect rows. Other available source weights normalize automatically.`,
      error: null,
      loadedAt: new Date().toISOString(),
      trustScore: trust?.score ?? null,
      trustMultiplier: trust?.multiplier ?? null,
      baseWeight: trust?.baseWeight ?? null,
      effectiveWeight: trust?.effectiveWeight ?? null,
      trustSampleSize: trust?.sampleSize ?? null,
      medianConsensusDeltaPct: trust?.medianConsensusDeltaPct ?? null,
      recentSuccessRate: null,
      rowCountRatio: null,
      trustNote: trust?.note ?? null,
    };
  }), previousSourceTrust);
}

export async function persistProspectSourceSnapshot(input: {
  profileKey: string;
  sources: ProspectSourceRows;
  diagnostics: RankingSourceDiagnostic[];
}) {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return;
  if (!areProspectSourceSnapshotsEnabled()) return;

  const snapshotKey = getSnapshotDateKey();
  const payload: ProspectSourceSnapshotPayload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    snapshotKey,
    profileKey: input.profileKey,
    sources: input.sources,
    diagnostics: input.diagnostics,
  };
  const serializedPayload = JSON.stringify(payload, null, 2);
  const safeProfileKey = sanitizeProfileKey(input.profileKey);

  try {
    fs.mkdirSync(PROSPECT_SOURCE_SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(PROSPECT_SOURCE_SNAPSHOT_DIR, `devy-source-snapshot-${safeProfileKey}-${snapshotKey}.json`),
      serializedPayload,
    );
  } catch (error) {
    console.warn('[ProspectSourceTrust] Failed to write local devy source snapshot:', error);
  }

  try {
    const stored = await upsertDevySourceSnapshot({
      snapshotKey,
      profileKey: input.profileKey,
      payload: serializedPayload,
    });
    if (!stored && !process.env.VITEST) {
      console.warn('[ProspectSourceTrust] Database unavailable; devy source snapshot saved locally only.');
    }
  } catch (error) {
    console.warn('[ProspectSourceTrust] Failed to persist devy source snapshot:', error);
  }
}
