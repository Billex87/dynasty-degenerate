import fs from 'fs';
import path from 'path';
import { canonicalPlayerNameKey } from './leagueAnalysis';
import { fetchFantasyProsDraftRankings, type FantasyProsRanking } from './fantasyPros';
import { fetchFantasyNerdsDraftRankings, hasFantasyNerdsApiKey, type FantasyNerdsRanking, type FantasyNerdsScoring } from './fantasyNerds';
import { listRedraftSourceSnapshots, upsertRedraftSourceSnapshot } from './db';
import { annotateDiagnosticsWithTrustHistory } from './sourceTrustDiagnostics';
import type { RankingSourceDiagnostic, RankingSourceWeightEntry } from '../shared/types';

export type RedraftProfileKey = 'redraft_ppr' | 'redraft_half_ppr' | 'redraft_standard';
export type RedraftScoring = 'PPR' | 'HALF' | 'STD';

export type RedraftRankingSourceKey =
  | 'fantasyPros'
  | 'fantasyNerds'
  | 'internalSeasonBlend'
  | 'mflAdp'
  | 'mflRankings'
  | 'espnFantasy'
  | 'fleaflicker'
  | 'yahooDraftAnalysis'
  | 'nflFantasy';

export interface RedraftSourceRow {
  name: string;
  position?: string | null;
  team?: string | null;
  season?: string | null;
  rank?: number | null;
  positionRank?: string | null;
  value?: number | null;
  adp?: number | null;
  projectedPoints?: number | null;
}

export interface RedraftRankingValue {
  name: string;
  position?: string | null;
  team?: string | null;
  overallRank: number;
  positionRank?: string | null;
  value: number;
  adp?: number | null;
  projectedPoints?: number | null;
  fantasyProsSeasonValue?: number | null;
  fantasyCalcRedraft?: number | null;
  sources: string[];
  sourceRanks: Partial<Record<RedraftRankingSourceKey, number | null>>;
  sourceValues: Partial<Record<RedraftRankingSourceKey, number | null>>;
}

export interface RedraftSourceTrust {
  key: RedraftRankingSourceKey;
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

export type RedraftSourceTrustMap = Partial<Record<RedraftRankingSourceKey, RedraftSourceTrust>>;

type KtcValues = Record<string, {
  name?: string;
  redraft_value?: number;
  fantasypros_season_value?: number;
  fantasypros_position_rank?: string | null;
  fantasypros_rank?: number | null;
  position?: string | null;
  position_rank?: string | null;
  team?: string | null;
  value_sources?: string[];
}>;

type CachedRows = {
  loadedAt: number;
  season: string;
  values: Record<string, RedraftSourceRow>;
};

export type RedraftSourceSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  season: string;
  sources: Partial<Record<RedraftRankingSourceKey, Record<string, RedraftSourceRow>>>;
  diagnostics: RankingSourceDiagnostic[];
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const REDRAFT_TRUST_HISTORY_LIMIT = 14;
const REDRAFT_TRUST_MIN_ALIGNMENT_SAMPLE = 20;
const REDRAFT_TRUST_FULL_ALIGNMENT_SAMPLE = 50;
const REDRAFT_TRUST_MIN_MULTIPLIER = 0.65;
const REDRAFT_TRUST_MAX_MULTIPLIER = 1.15;
const REDRAFT_SNAPSHOT_TIME_ZONE = 'America/Vancouver';
export const REDRAFT_SOURCE_SNAPSHOT_DIR = path.join(process.cwd(), 'server', 'redraft-snapshots');
const REDRAFT_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const MFL_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;

const REDRAFT_SOURCE_CONFIG: Record<RedraftRankingSourceKey, {
  source: string;
  weight: number;
  note: string;
}> = {
  fantasyPros: {
    source: 'FantasyPros',
    weight: 0.24,
    note: 'Format-aware current-season ECR and draft rankings when the FantasyPros API key is configured.',
  },
  fantasyNerds: {
    source: 'Fantasy Nerds',
    weight: 0.12,
    note: 'API-backed draft rankings and ADP by scoring format when the Fantasy Nerds API key is configured.',
  },
  internalSeasonBlend: {
    source: 'Internal Season Blend',
    weight: 0.16,
    note: 'Existing app redraft value blend, including FantasyCalc/FantasyPros season value when available.',
  },
  mflAdp: {
    source: 'MyFantasyLeague ADP',
    weight: 0.14,
    note: 'Public MyFantasyLeague ADP export, normalized into a current-season value scale.',
  },
  mflRankings: {
    source: 'MyFantasyLeague Rankings',
    weight: 0.10,
    note: 'Public MyFantasyLeague player-rank exports by position.',
  },
  espnFantasy: {
    source: 'ESPN Fantasy',
    weight: 0.09,
    note: 'ESPN league-default fantasy draft ranks from the lm-api-reads JSON endpoint.',
  },
  yahooDraftAnalysis: {
    source: 'Yahoo Draft Analysis',
    weight: 0.06,
    note: 'Public Yahoo draft-analysis ADP page when it exposes parseable rows.',
  },
  fleaflicker: {
    source: 'Fleaflicker',
    weight: 0.05,
    note: 'Official Fleaflicker API draft-ranking sort. Requires FLEAFLICKER_LEAGUE_ID for a public league.',
  },
  nflFantasy: {
    source: 'NFL Fantasy',
    weight: 0.04,
    note: 'NFL Fantasy public research ranking/projection pages when parseable.',
  },
};

let cachedMflPlayers: { loadedAt: number; season: string; values: Record<string, { name: string; position?: string | null; team?: string | null }> } | null = null;
let cachedMflAdp: CachedRows | null = null;
let cachedMflRankings: CachedRows | null = null;
const cachedEspnFantasy = new Map<string, CachedRows>();
let cachedFleaflicker: CachedRows | null = null;
let cachedYahooDraftAnalysis: CachedRows | null = null;
let cachedNflFantasy: CachedRows | null = null;

const SOURCE_ENV_FLAGS: Record<RedraftRankingSourceKey, string> = {
  fantasyPros: 'ENABLE_REDRAFT_FANTASYPROS',
  fantasyNerds: 'ENABLE_REDRAFT_FANTASY_NERDS',
  internalSeasonBlend: 'ENABLE_REDRAFT_INTERNAL_SEASON_BLEND',
  mflAdp: 'ENABLE_REDRAFT_MFL_ADP',
  mflRankings: 'ENABLE_REDRAFT_MFL_RANKINGS',
  espnFantasy: 'ENABLE_REDRAFT_ESPN',
  fleaflicker: 'ENABLE_REDRAFT_FLEAFLICKER',
  yahooDraftAnalysis: 'ENABLE_REDRAFT_YAHOO',
  nflFantasy: 'ENABLE_REDRAFT_NFL',
};

type RuntimeSourceDiagnostic = Pick<RankingSourceDiagnostic, 'status' | 'note' | 'error'>;

const runtimeSourceDiagnostics = new Map<RedraftRankingSourceKey, RuntimeSourceDiagnostic>();

function isFresh(cache: { loadedAt: number } | null | undefined): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function getFetchTimeoutMs(): number {
  const value = Number(process.env.REDRAFT_SOURCE_TIMEOUT_MS || DEFAULT_FETCH_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_FETCH_TIMEOUT_MS;
}

function isDisabledValue(value?: string | null): boolean {
  return /^(?:0|false|off|no|disabled)$/i.test(String(value || '').trim());
}

function isEnabledValue(value?: string | null): boolean {
  return /^(?:1|true|on|yes|enabled)$/i.test(String(value || '').trim());
}

export function isRedraftSourceEnabled(source: RedraftRankingSourceKey): boolean {
  const configuredValue = process.env[SOURCE_ENV_FLAGS[source]];
  if (isDisabledValue(configuredValue)) return false;
  if (isEnabledValue(configuredValue)) return true;
  if (process.env.NODE_ENV === 'production' && (source === 'yahooDraftAnalysis' || source === 'nflFantasy')) {
    return false;
  }
  return true;
}

function isRedraftAdaptiveTrustEnabled(): boolean {
  return !isDisabledValue(process.env.ENABLE_REDRAFT_ADAPTIVE_TRUST);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown error');
}

function setRuntimeSourceDiagnostic(source: RedraftRankingSourceKey, diagnostic: RuntimeSourceDiagnostic) {
  runtimeSourceDiagnostics.set(source, diagnostic);
}

function getCurrentSeason(): string {
  return String(new Date().getFullYear());
}

function getSnapshotDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REDRAFT_SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePosition(position?: string | null): string | null {
  const normalized = String(position || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return null;
  if (['DST', 'D', 'DEFENSE'].includes(normalized)) return 'DEF';
  if (normalized === 'PK') return 'K';
  return normalized;
}

function normalizePositionRank(positionRank?: string | null, fallbackPosition?: string | null): string | null {
  const rank = String(positionRank || '').match(/\d+/)?.[0] || null;
  const position = normalizePosition(String(positionRank || '').replace(/\d+/g, '') || fallbackPosition);
  if (!rank || !position) return positionRank || null;
  return `${position}${rank}`;
}

function normalizeMflPlayerName(name: string): string {
  const match = name.match(/^([^,]+),\s*(.+)$/);
  if (!match) return name;
  return `${match[2].trim()} ${match[1].trim()}`.replace(/\s+/g, ' ');
}

function getPositionRankNumber(positionRank?: string | null): number | null {
  return toNumber(String(positionRank || '').match(/\d+/)?.[0]);
}

function positionRankToValue(positionRank?: string | null, fallbackRank?: number | null): number | null {
  const position = normalizePosition(String(positionRank || '').replace(/[0-9]/g, ''));
  const rank = getPositionRankNumber(positionRank) || fallbackRank || null;
  if (!rank) return null;

  const replacementByPosition: Record<string, number> = {
    QB: 30,
    RB: 60,
    WR: 72,
    TE: 24,
    K: 20,
    DEF: 20,
  };
  const ceilingByPosition: Record<string, number> = {
    QB: 9000,
    RB: 9000,
    WR: 9000,
    TE: 9000,
    K: 1200,
    DEF: 1200,
  };
  const replacement = replacementByPosition[position || ''] || 160;
  const ceiling = ceilingByPosition[position || ''] || 9000;
  return Math.max(100, Math.round(ceiling * Math.pow(Math.max(0.035, (replacement - rank + 1) / replacement), 1.35)));
}

function overallRankToValue(rank?: number | null): number | null {
  if (!rank || rank <= 0) return null;
  const replacement = 220;
  return Math.max(100, Math.round(9000 * Math.pow(Math.max(0.02, (replacement - rank + 1) / replacement), 1.22)));
}

function adpToValue(adp?: number | null): number | null {
  if (!adp || adp <= 0) return null;
  const replacement = 220;
  return Math.max(100, Math.round(9000 * Math.pow(Math.max(0.02, (replacement - adp + 1) / replacement), 1.28)));
}

function pointsToValue(points?: number | null): number | null {
  if (!points || points <= 0) return null;
  return Math.max(100, Math.min(9000, Math.round(points * 28)));
}

function rowValue(row: RedraftSourceRow): number | null {
  return toNumber(row.value)
    || positionRankToValue(row.positionRank || null, row.rank || null)
    || adpToValue(row.adp || null)
    || overallRankToValue(row.rank || null)
    || pointsToValue(row.projectedPoints || null);
}

function sourceKeyFor(row: RedraftSourceRow, fallbackKey: string): string {
  return canonicalPlayerNameKey(row.name || fallbackKey);
}

function upsertSourceRow(
  rows: Record<string, RedraftSourceRow>,
  key: string,
  row: RedraftSourceRow
) {
  const canonicalKey = sourceKeyFor(row, key);
  if (!canonicalKey || !row.name) return;
  const existing = rows[canonicalKey];
  const value = rowValue(row) || 0;
  const existingValue = existing ? rowValue(existing) || 0 : 0;
  if (!existing || value >= existingValue) {
    rows[canonicalKey] = {
      ...row,
      position: normalizePosition(row.position || row.positionRank || null),
      positionRank: normalizePositionRank(row.positionRank || null, row.position || null),
    };
  }
}

function weightedAverage(values: Array<{ value: number | null | undefined; weight: number }>): number {
  const available = values.filter((item) => Number.isFinite(Number(item.value)) && Number(item.value) > 0 && item.weight > 0);
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  return Math.round(available.reduce((sum, item) => sum + Number(item.value || 0) * item.weight, 0) / totalWeight);
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

function sourceRowsFromFantasyPros(values: Record<string, FantasyProsRanking>, season?: string): Record<string, RedraftSourceRow> {
  const rows: Record<string, RedraftSourceRow> = {};
  for (const [key, value] of Object.entries(values || {})) {
    upsertSourceRow(rows, key, {
      name: value.name,
      position: value.position || null,
      team: value.team || null,
      season: season || value.lastUpdated?.match(/\b(20\d{2})\b/)?.[1] || null,
      rank: value.overallRank || null,
      positionRank: value.positionRank || null,
      value: value.seasonValue || null,
    });
  }
  return rows;
}

function sourceRowsFromFantasyNerds(values: Record<string, FantasyNerdsRanking>): Record<string, RedraftSourceRow> {
  const rows: Record<string, RedraftSourceRow> = {};
  for (const [key, value] of Object.entries(values || {})) {
    upsertSourceRow(rows, key, {
      name: value.name,
      position: value.position || null,
      team: value.team || null,
      season: value.season || null,
      rank: value.overallRank || null,
      positionRank: value.positionRank || null,
      adp: value.adp || null,
      value: value.redraftValue || null,
    });
  }
  return rows;
}

function sourceRowsFromInternalBlend(values: KtcValues): Record<string, RedraftSourceRow> {
  const rows: Record<string, RedraftSourceRow> = {};
  for (const [key, value] of Object.entries(values || {})) {
    const redraftValue = toNumber(value.redraft_value);
    const fantasyProsValue = toNumber(value.fantasypros_season_value);
    const rowSeasonValue = redraftValue || fantasyProsValue;
    if (!rowSeasonValue || !value.name) continue;
    upsertSourceRow(rows, key, {
      name: value.name,
      position: normalizePosition(value.position || value.position_rank || value.fantasypros_position_rank || null),
      team: value.team || null,
      season: null,
      rank: value.fantasypros_rank || null,
      positionRank: value.fantasypros_position_rank || value.position_rank || null,
      value: rowSeasonValue,
    });
  }
  return rows;
}

function mergeSourceRowMaps(...rowSets: Array<Record<string, RedraftSourceRow>>): Record<string, RedraftSourceRow> {
  const merged: Record<string, RedraftSourceRow> = {};
  for (const rowSet of rowSets) {
    for (const [key, row] of Object.entries(rowSet || {})) {
      upsertSourceRow(merged, key, row);
    }
  }
  return merged;
}

function getRepresentativeRow(rows: Array<{ source: RedraftRankingSourceKey; row: RedraftSourceRow }>): RedraftSourceRow {
  const priority: RedraftRankingSourceKey[] = ['fantasyPros', 'fantasyNerds', 'internalSeasonBlend', 'mflAdp', 'mflRankings', 'espnFantasy', 'yahooDraftAnalysis', 'fleaflicker', 'nflFantasy'];
  for (const source of priority) {
    const match = rows.find((item) => item.source === source && item.row.name);
    if (match) return match.row;
  }
  return rows[0]?.row || { name: '' };
}

export function blendRedraftRankingRows(
  sourceMaps: Partial<Record<RedraftRankingSourceKey, Record<string, RedraftSourceRow>>>,
  options: { sourceTrust?: RedraftSourceTrustMap } = {},
): Record<string, RedraftRankingValue> {
  const keys = new Set<string>();
  for (const rows of Object.values(sourceMaps)) {
    Object.keys(rows || {}).forEach((key) => keys.add(canonicalPlayerNameKey(key)));
  }

  const blendedRows: RedraftRankingValue[] = [];

  for (const key of Array.from(keys)) {
    if (!key) continue;
    const sourceRows = (Object.entries(sourceMaps) as Array<[RedraftRankingSourceKey, Record<string, RedraftSourceRow> | undefined]>)
      .map(([source, rows]) => ({ source, row: rows?.[key] }))
      .filter((item): item is { source: RedraftRankingSourceKey; row: RedraftSourceRow } => Boolean(item.row));
    if (!sourceRows.length) continue;

    const representative = getRepresentativeRow(sourceRows);
    const values = sourceRows.map(({ source, row }) => ({
      value: rowValue(row),
      weight: options.sourceTrust?.[source]?.effectiveWeight ?? REDRAFT_SOURCE_CONFIG[source].weight,
    }));
    const value = weightedAverage(values);
    if (!value) continue;

    const sourceRanks: Partial<Record<RedraftRankingSourceKey, number | null>> = {};
    const sourceValues: Partial<Record<RedraftRankingSourceKey, number | null>> = {};
    for (const { source, row } of sourceRows) {
      sourceRanks[source] = row.rank || row.adp || getPositionRankNumber(row.positionRank || null);
      sourceValues[source] = rowValue(row);
    }

    const fantasyProsRow = sourceRows.find((item) => item.source === 'fantasyPros')?.row || null;
    const internalRow = sourceRows.find((item) => item.source === 'internalSeasonBlend')?.row || null;
    const adp = sourceRows.map((item) => item.row.adp).find((item) => Number.isFinite(Number(item)) && Number(item) > 0) || null;
    const projectedPoints = sourceRows.map((item) => item.row.projectedPoints).find((item) => Number.isFinite(Number(item)) && Number(item) > 0) || null;

    blendedRows.push({
      name: representative.name,
      position: normalizePosition(representative.position || representative.positionRank || null),
      team: representative.team || null,
      overallRank: Math.min(...sourceRows.map((item) => item.row.rank || item.row.adp || 9999)),
      positionRank: representative.positionRank || fantasyProsRow?.positionRank || internalRow?.positionRank || null,
      value,
      adp,
      projectedPoints,
      fantasyProsSeasonValue: fantasyProsRow?.value || null,
      fantasyCalcRedraft: internalRow?.value || null,
      sources: sourceRows.map((item) => REDRAFT_SOURCE_CONFIG[item.source].source),
      sourceRanks,
      sourceValues,
    });
  }

  const positionCounts: Record<string, number> = {};
  return Object.fromEntries(
    blendedRows
      .sort((a, b) => b.value - a.value || a.overallRank - b.overallRank || a.name.localeCompare(b.name))
      .map((row, index) => {
        const position = normalizePosition(row.position || row.positionRank || null) || row.position || null;
        const positionRank = position && REDRAFT_POSITIONS.has(position)
          ? `${position}${(positionCounts[position] = (positionCounts[position] || 0) + 1)}`
          : row.positionRank || null;
        const rankedRow: RedraftRankingValue = {
          ...row,
          position,
          overallRank: index + 1,
          positionRank,
        };
        return [canonicalPlayerNameKey(row.name), rankedRow];
      })
  );
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = getFetchTimeoutMs()): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function withTimeout<T>(source: RedraftRankingSourceKey, promise: Promise<T>, timeoutMs = getFetchTimeoutMs()): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${REDRAFT_SOURCE_CONFIG[source].source} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  const response = await fetchWithTimeout(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'dynasty-degenerates/1.0 fantasy rankings aggregation',
      ...headers,
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string | null> {
  const response = await fetchWithTimeout(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,*/*',
      'user-agent': 'dynasty-degenerates/1.0 fantasy rankings aggregation',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function fetchMflPlayers(season: string): Promise<Record<string, { name: string; position?: string | null; team?: string | null }>> {
  if (cachedMflPlayers?.season === season && isFresh(cachedMflPlayers)) return cachedMflPlayers.values;

  try {
    const payload = await fetchJson<{
      players?: {
        player?: Array<{
          id?: string | number;
          name?: string;
          position?: string;
          team?: string;
        }> | {
          id?: string | number;
          name?: string;
          position?: string;
          team?: string;
        };
      };
    }>(`https://api.myfantasyleague.com/${season}/export?TYPE=players&JSON=1`);
    const values: Record<string, { name: string; position?: string | null; team?: string | null }> = {};
    for (const player of toArray(payload?.players?.player)) {
      if (!player?.id || !player.name) continue;
      values[String(player.id)] = {
        name: normalizeMflPlayerName(player.name),
        position: normalizePosition(player.position || null),
        team: player.team || null,
      };
    }
    cachedMflPlayers = { loadedAt: Date.now(), season, values };
    return values;
  } catch (error) {
    console.warn('[RedraftRankings] Failed to load MFL player map:', error);
    return cachedMflPlayers?.values || {};
  }
}

export async function fetchMflAdpRows(season = getCurrentSeason()): Promise<Record<string, RedraftSourceRow>> {
  if (cachedMflAdp?.season === season && isFresh(cachedMflAdp)) return cachedMflAdp.values;

  try {
    const [payload, players] = await Promise.all([
      fetchJson<{
        adp?: {
          player?: Array<{
            id?: string | number;
            rank?: string | number;
            averagePick?: string | number;
            minPick?: string | number;
            maxPick?: string | number;
          }> | {
            id?: string | number;
            rank?: string | number;
            averagePick?: string | number;
            minPick?: string | number;
            maxPick?: string | number;
          };
        };
      }>(`https://api.myfantasyleague.com/${season}/export?TYPE=adp&JSON=1`),
      fetchMflPlayers(season),
    ]);
    const values: Record<string, RedraftSourceRow> = {};
    for (const row of toArray(payload?.adp?.player)) {
      const player = row?.id ? players[String(row.id)] : null;
      if (!player?.name) continue;
      const rank = toNumber(row.rank);
      const adp = toNumber(row.averagePick);
      upsertSourceRow(values, player.name, {
        name: player.name,
        position: player.position || null,
        team: player.team || null,
        season,
        rank,
        adp,
        value: adpToValue(adp) || overallRankToValue(rank),
      });
    }
    cachedMflAdp = { loadedAt: Date.now(), season, values };
    return values;
  } catch (error) {
    console.warn('[RedraftRankings] Failed to load MFL ADP:', error);
    setRuntimeSourceDiagnostic('mflAdp', {
      status: 'error',
      note: 'MyFantasyLeague ADP export failed; redraft blend will use other available sources.',
      error: getErrorMessage(error),
    });
    return cachedMflAdp?.values || {};
  }
}

export async function fetchMflRankingRows(season = getCurrentSeason()): Promise<Record<string, RedraftSourceRow>> {
  if (cachedMflRankings?.season === season && isFresh(cachedMflRankings)) return cachedMflRankings.values;

  try {
    const players = await fetchMflPlayers(season);
    const positionPayloads = await Promise.all(MFL_POSITIONS.map(async (position) => ({
      position,
      payload: await fetchJson<{
        player_ranks?: {
          player?: Array<{
            id?: string | number;
            rank?: string | number;
          }> | {
            id?: string | number;
            rank?: string | number;
          };
        };
      }>(`https://api.myfantasyleague.com/${season}/export?TYPE=playerRanks&POS=${position}&JSON=1`),
    })));
    const values: Record<string, RedraftSourceRow> = {};
    for (const { position, payload } of positionPayloads) {
      for (const row of toArray(payload?.player_ranks?.player)) {
        const player = row?.id ? players[String(row.id)] : null;
        if (!player?.name) continue;
        const rank = toNumber(row.rank);
        const positionRank = rank ? `${position}${rank}` : null;
        upsertSourceRow(values, player.name, {
          name: player.name,
          position: player.position || position,
          team: player.team || null,
          season,
          rank,
          positionRank,
          value: positionRankToValue(positionRank, rank),
        });
      }
    }
    cachedMflRankings = { loadedAt: Date.now(), season, values };
    return values;
  } catch (error) {
    console.warn('[RedraftRankings] Failed to load MFL rankings:', error);
    setRuntimeSourceDiagnostic('mflRankings', {
      status: 'error',
      note: 'MyFantasyLeague position-rank exports failed; redraft blend will use other available sources.',
      error: getErrorMessage(error),
    });
    return cachedMflRankings?.values || {};
  }
}

const ESPN_POSITION_BY_ID: Record<number, string> = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'DEF',
};

const ESPN_TEAM_BY_ID: Record<number, string> = {
  1: 'ATL',
  2: 'BUF',
  3: 'CHI',
  4: 'CIN',
  5: 'CLE',
  6: 'DAL',
  7: 'DEN',
  8: 'DET',
  9: 'GB',
  10: 'TEN',
  11: 'IND',
  12: 'KC',
  13: 'LV',
  14: 'LAR',
  15: 'MIA',
  16: 'MIN',
  17: 'NE',
  18: 'NO',
  19: 'NYG',
  20: 'NYJ',
  21: 'PHI',
  22: 'ARI',
  23: 'PIT',
  24: 'LAC',
  25: 'SF',
  26: 'SEA',
  27: 'TB',
  28: 'WAS',
  29: 'CAR',
  30: 'JAX',
  33: 'BAL',
  34: 'HOU',
};

function getEspnRankType(scoring: RedraftScoring): 'PPR' | 'STANDARD' {
  return scoring === 'STD' ? 'STANDARD' : 'PPR';
}

function getFantasyNerdsScoring(scoring: RedraftScoring): FantasyNerdsScoring {
  if (scoring === 'STD') return 'std';
  if (scoring === 'HALF') return 'half';
  return 'ppr';
}

export async function fetchEspnFantasyRows(scoring: RedraftScoring = 'PPR', season = getCurrentSeason()): Promise<Record<string, RedraftSourceRow>> {
  const rankType = getEspnRankType(scoring);
  const cacheKey = `${season}:${rankType}`;
  const cached = cachedEspnFantasy.get(cacheKey);
  if (cached && isFresh(cached)) return cached.values;

  try {
    const filter = {
      players: {
        limit: 700,
        sortDraftRanks: {
          sortPriority: 1,
          sortAsc: true,
          value: rankType,
        },
      },
    };
    const payload = await fetchJson<{
      players?: Array<{
        player?: {
          fullName?: string;
          defaultPositionId?: number;
          proTeamId?: number;
          draftRanksByRankType?: Partial<Record<'PPR' | 'STANDARD', {
            rank?: number | string | null;
            auctionValue?: number | string | null;
          }>>;
          ownership?: {
            averageDraftPosition?: number | string | null;
          };
        };
      }>;
    }>(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leaguedefaults/3?view=kona_player_info`,
      { 'x-fantasy-filter': JSON.stringify(filter) }
    );
    const values: Record<string, RedraftSourceRow> = {};
    for (const row of payload?.players || []) {
      const player = row.player;
      if (!player?.fullName) continue;
      const rank = toNumber(player.draftRanksByRankType?.[rankType]?.rank);
      const position = ESPN_POSITION_BY_ID[Number(player.defaultPositionId || 0)] || null;
      if (!rank || !position || !REDRAFT_POSITIONS.has(position)) continue;
      const positionRank = `${position}${rank}`;
      const adp = toNumber(player.ownership?.averageDraftPosition);
      upsertSourceRow(values, player.fullName, {
        name: player.fullName,
        position,
        team: ESPN_TEAM_BY_ID[Number(player.proTeamId || 0)] || null,
        season,
        rank,
        positionRank,
        adp,
        value: positionRankToValue(positionRank, rank),
      });
    }
    const cache = { loadedAt: Date.now(), season, values };
    cachedEspnFantasy.set(cacheKey, cache);
    return values;
  } catch (error) {
    console.warn('[RedraftRankings] Failed to load ESPN Fantasy rankings:', error);
    setRuntimeSourceDiagnostic('espnFantasy', {
      status: 'error',
      note: 'ESPN Fantasy league-default rankings failed; redraft blend will use other available sources.',
      error: getErrorMessage(error),
    });
    return cached?.values || {};
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseRowsFromHtml(html: string): string[] {
  return Array.from(html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)).map((match) => match[0]);
}

function extractPlayerNameFromHtmlRow(row: string): string | null {
  const dataName = row.match(/data-player-name=["']([^"']+)["']/i)?.[1];
  if (dataName) return stripHtml(dataName);

  const titleName = row.match(/title=["']([^"']+)["'][^>]*(?:class=["'][^"']*(?:player|ysf)[^"']*["'])/i)?.[1];
  if (titleName) return stripHtml(titleName);

  const playerAnchor = row.match(/<a\b[^>]*(?:player|ysf|name)[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    || row.match(/playerNameFull[^>]*>([\s\S]*?)<\/(?:a|span|div)>/i)?.[1];
  const name = playerAnchor ? stripHtml(playerAnchor) : null;
  return name && /[A-Za-z]/.test(name) ? name : null;
}

function extractPositionTeamFromText(text: string): { position?: string | null; team?: string | null } {
  const match = text.match(/\b(QB|RB|WR|TE|K|DST|DEF|D)\b\s*[-,]\s*([A-Z]{2,3}|FA)\b/i)
    || text.match(/\b([A-Z]{2,3}|FA)\b\s*[-,]\s*\b(QB|RB|WR|TE|K|DST|DEF|D)\b/i);
  if (!match) return {};
  const first = normalizePosition(match[1]);
  const second = normalizePosition(match[2]);
  if (first && REDRAFT_POSITIONS.has(first)) return { position: first, team: match[2]?.toUpperCase() };
  if (second && REDRAFT_POSITIONS.has(second)) return { position: second, team: match[1]?.toUpperCase() };
  return {};
}

export async function fetchFleaflickerRows(season = getCurrentSeason()): Promise<Record<string, RedraftSourceRow>> {
  if (cachedFleaflicker?.season === season && isFresh(cachedFleaflicker)) return cachedFleaflicker.values;

  const leagueId = process.env.FLEAFLICKER_LEAGUE_ID;
  if (!leagueId) {
    setRuntimeSourceDiagnostic('fleaflicker', {
      status: 'disabled',
      note: 'Fleaflicker requires FLEAFLICKER_LEAGUE_ID before its official API can be used.',
      error: null,
    });
    return {};
  }

  try {
    const url = new URL('https://www.fleaflicker.com/api/FetchPlayerListing');
    url.searchParams.set('sport', 'NFL');
    url.searchParams.set('league_id', leagueId);
    url.searchParams.set('sort', 'SORT_DRAFT_RANKING');
    url.searchParams.set('sort_season', process.env.FLEAFLICKER_SEASON || season);
    const payload = await fetchJson<{
      players?: Array<{
        proPlayer?: {
          nameFull?: string;
          position?: string;
          proTeamAbbreviation?: string;
        };
        ranking?: number | string | null;
      }>;
    }>(url.toString());
    const values: Record<string, RedraftSourceRow> = {};
    const playerRows = payload?.players || [];
    for (let index = 0; index < playerRows.length; index += 1) {
      const row = playerRows[index];
      const player = row.proPlayer;
      if (!player?.nameFull) continue;
      const rank = toNumber(row.ranking) || index + 1;
      upsertSourceRow(values, player.nameFull, {
        name: player.nameFull,
        position: player.position || null,
        team: player.proTeamAbbreviation || null,
        season: process.env.FLEAFLICKER_SEASON || season,
        rank,
        value: overallRankToValue(rank),
      });
    }
    cachedFleaflicker = { loadedAt: Date.now(), season, values };
    return values;
  } catch (error) {
    console.warn('[RedraftRankings] Failed to load Fleaflicker rankings:', error);
    setRuntimeSourceDiagnostic('fleaflicker', {
      status: 'error',
      note: 'Fleaflicker ranking API failed; redraft blend will use other available sources.',
      error: getErrorMessage(error),
    });
    return cachedFleaflicker?.values || {};
  }
}

export async function fetchYahooDraftAnalysisRows(season = getCurrentSeason()): Promise<Record<string, RedraftSourceRow>> {
  if (cachedYahooDraftAnalysis?.season === season && isFresh(cachedYahooDraftAnalysis)) return cachedYahooDraftAnalysis.values;

  try {
    const html = await fetchText('https://football.fantasysports.yahoo.com/f1/draftanalysis?pos=ALL');
    const values: Record<string, RedraftSourceRow> = {};
    for (const row of parseRowsFromHtml(html || '')) {
      const name = extractPlayerNameFromHtmlRow(row);
      if (!name) continue;
      const text = stripHtml(row);
      const adp = toNumber(row.match(/average[_-]?pick[^>]*>\s*([0-9.]+)/i)?.[1])
        || toNumber(text.match(/\bAvg(?:erage)?\.?\s*Pick\s*([0-9.]+)/i)?.[1])
        || toNumber(text.match(/\bADP\s*([0-9.]+)/i)?.[1]);
      const rank = toNumber(text.match(/^\s*(\d{1,3})\b/)?.[1]);
      const positionTeam = extractPositionTeamFromText(text);
      if (!adp && !rank) continue;
      upsertSourceRow(values, name, {
        name,
        position: positionTeam.position || null,
        team: positionTeam.team || null,
        season: null,
        rank,
        adp,
        value: adpToValue(adp) || overallRankToValue(rank),
      });
    }
    cachedYahooDraftAnalysis = { loadedAt: Date.now(), season, values };
    return values;
  } catch (error) {
    console.warn('[RedraftRankings] Failed to load Yahoo draft analysis:', error);
    setRuntimeSourceDiagnostic('yahooDraftAnalysis', {
      status: 'error',
      note: 'Yahoo draft-analysis page could not be parsed or fetched; redraft blend will use other available sources.',
      error: getErrorMessage(error),
    });
    return cachedYahooDraftAnalysis?.values || {};
  }
}

export async function fetchNflFantasyRows(season = getCurrentSeason()): Promise<Record<string, RedraftSourceRow>> {
  if (cachedNflFantasy?.season === season && isFresh(cachedNflFantasy)) return cachedNflFantasy.values;

  try {
    const values: Record<string, RedraftSourceRow> = {};
    await Promise.all(MFL_POSITIONS.map(async (position) => {
      const url = new URL('https://fantasy.nfl.com/research/rankings');
      url.searchParams.set('position', position);
      url.searchParams.set('statSeason', season);
      url.searchParams.set('leagueId', '0');
      const html = await fetchText(url.toString());
      for (const row of parseRowsFromHtml(html || '')) {
        const name = extractPlayerNameFromHtmlRow(row);
        if (!name) continue;
        const text = stripHtml(row);
        const rank = toNumber(row.match(/(?:editorDraftRankRank|rank)[^>]*>\s*(\d+)/i)?.[1])
          || toNumber(text.match(/^\s*(\d{1,3})\b/)?.[1]);
        const projectedPoints = toNumber(text.match(/\bProj(?:ected)?\.?\s*([0-9.]+)/i)?.[1]);
        const positionTeam = extractPositionTeamFromText(text);
        if (!rank && !projectedPoints) continue;
        const positionRank = rank ? `${position}${rank}` : null;
        upsertSourceRow(values, name, {
          name,
          position: positionTeam.position || position,
          team: positionTeam.team || null,
          season,
          rank,
          positionRank,
          projectedPoints,
          value: positionRankToValue(positionRank, rank) || pointsToValue(projectedPoints),
        });
      }
    }));
    cachedNflFantasy = { loadedAt: Date.now(), season, values };
    return values;
  } catch (error) {
    console.warn('[RedraftRankings] Failed to load NFL Fantasy rankings:', error);
    setRuntimeSourceDiagnostic('nflFantasy', {
      status: 'error',
      note: 'NFL Fantasy research pages could not be parsed or fetched; redraft blend will use other available sources.',
      error: getErrorMessage(error),
    });
    return cachedNflFantasy?.values || {};
  }
}

export function getRedraftSourceWeightEntries(sourceTrust: RedraftSourceTrustMap = {}): RankingSourceWeightEntry[] {
  const effectiveWeights = (Object.keys(REDRAFT_SOURCE_CONFIG) as RedraftRankingSourceKey[]).map((key) => (
    sourceTrust[key]?.effectiveWeight ?? REDRAFT_SOURCE_CONFIG[key].weight
  ));
  const totalEffectiveWeight = effectiveWeights.reduce((sum, weight) => sum + Math.max(0, weight), 0) || 1;

  return (Object.keys(REDRAFT_SOURCE_CONFIG) as RedraftRankingSourceKey[]).map((key) => {
    const config = REDRAFT_SOURCE_CONFIG[key];
    const trust = sourceTrust[key] || null;
    const effectiveWeight = trust?.effectiveWeight ?? config.weight;
    const trustNote = trust
      ? ` Adaptive trust ${trust.score}/100 (${trust.multiplier.toFixed(2)}x base weight).`
      : '';
    return {
      key,
      source: config.source,
      weight: effectiveWeight,
      percent: Math.round((effectiveWeight / totalEffectiveWeight) * 100),
      note: `${config.note}${trustNote}`,
      baseWeight: config.weight,
      effectiveWeight,
      trustScore: trust?.score ?? null,
      trustMultiplier: trust?.multiplier ?? null,
    };
  });
}

export function formatRedraftSourceWeights(sourceTrust: RedraftSourceTrustMap = {}): string {
  return getRedraftSourceWeightEntries(sourceTrust)
    .filter((entry) => entry.weight > 0)
    .map((entry) => `${entry.source} ${entry.percent}%`)
    .join(', ');
}

export interface RedraftRankingLoadResult {
  profiles: Record<RedraftProfileKey, Record<string, RedraftRankingValue>>;
  diagnostics: RankingSourceDiagnostic[];
  sourceTrust: RedraftSourceTrustMap;
}

function parseRedraftSourceSnapshot(payload?: string | null): RedraftSourceSnapshotPayload | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as Partial<RedraftSourceSnapshotPayload>;
    if (parsed.schemaVersion !== 1 || !parsed.season || !parsed.snapshotKey) return null;
    return parsed as RedraftSourceSnapshotPayload;
  } catch {
    return null;
  }
}

function readLocalRedraftSourceSnapshots(season: string, limit: number): RedraftSourceSnapshotPayload[] {
  try {
    if (!fs.existsSync(REDRAFT_SOURCE_SNAPSHOT_DIR)) return [];
    const filePattern = new RegExp(`^redraft-source-snapshot-${season}-(\\d{4}-\\d{2}-\\d{2})\\.json$`);
    return fs.readdirSync(REDRAFT_SOURCE_SNAPSHOT_DIR)
      .filter((fileName) => filePattern.test(fileName))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit)
      .map((fileName) => {
        const payload = fs.readFileSync(path.join(REDRAFT_SOURCE_SNAPSHOT_DIR, fileName), 'utf8');
        return parseRedraftSourceSnapshot(payload);
      })
      .filter((snapshot): snapshot is RedraftSourceSnapshotPayload => Boolean(snapshot && snapshot.season === season));
  } catch (error) {
    console.warn('[RedraftRankings] Failed to read local redraft source snapshots:', error);
    return [];
  }
}

async function loadRecentRedraftSourceSnapshots(season: string, limit = REDRAFT_TRUST_HISTORY_LIMIT): Promise<RedraftSourceSnapshotPayload[]> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return [];

  const snapshotsByKey = new Map<string, RedraftSourceSnapshotPayload>();

  try {
    const storedSnapshots = await listRedraftSourceSnapshots(season, limit);
    for (const stored of storedSnapshots) {
      const snapshot = parseRedraftSourceSnapshot(stored.payload);
      if (snapshot?.season === season) snapshotsByKey.set(snapshot.snapshotKey, snapshot);
    }
  } catch (error) {
    console.warn('[RedraftRankings] Failed to load database redraft source snapshots:', error);
  }

  for (const snapshot of readLocalRedraftSourceSnapshots(season, limit)) {
    if (!snapshotsByKey.has(snapshot.snapshotKey)) snapshotsByKey.set(snapshot.snapshotKey, snapshot);
  }

  return Array.from(snapshotsByKey.values())
    .sort((a, b) => b.snapshotKey.localeCompare(a.snapshotKey) || b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, limit);
}

function getDiagnosticStatusScore(status: RankingSourceDiagnostic['status']): number | null {
  switch (status) {
    case 'loaded':
      return 1;
    case 'empty':
      return 0.45;
    case 'stale':
      return 0.25;
    case 'error':
      return 0.15;
    case 'disabled':
      return null;
    default:
      return null;
  }
}

function getSnapshotDiagnostic(
  snapshot: RedraftSourceSnapshotPayload,
  source: RedraftRankingSourceKey,
): RankingSourceDiagnostic | null {
  return snapshot.diagnostics.find((diagnostic) => diagnostic.key === source) || null;
}

function getSnapshotSourceRowCount(snapshot: RedraftSourceSnapshotPayload, source: RedraftRankingSourceKey): number {
  const diagnosticCount = getSnapshotDiagnostic(snapshot, source)?.rowCount;
  if (Number.isFinite(Number(diagnosticCount))) return Number(diagnosticCount);
  return Object.keys(snapshot.sources[source] || {}).length;
}

function getRecentSuccessRate(source: RedraftRankingSourceKey, history: RedraftSourceSnapshotPayload[]): number | null {
  const scores = history
    .map((snapshot) => getSnapshotDiagnostic(snapshot, source)?.status)
    .map((status) => status ? getDiagnosticStatusScore(status) : null)
    .filter((score): score is number => score !== null);
  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function getRowCountRatio(
  source: RedraftRankingSourceKey,
  currentRowCount: number,
  history: RedraftSourceSnapshotPayload[],
): number | null {
  const previousCounts = history
    .map((snapshot) => getSnapshotSourceRowCount(snapshot, source))
    .filter((count) => Number.isFinite(count) && count > 0);
  const baseline = medianNumber(previousCounts);
  if (!baseline || baseline <= 0 || !currentRowCount) return null;
  return currentRowCount / baseline;
}

function getConsensusAlignment(
  source: RedraftRankingSourceKey,
  sourceMaps: Partial<Record<RedraftRankingSourceKey, Record<string, RedraftSourceRow>>>,
): { sampleSize: number; medianConsensusDeltaPct: number | null } {
  const rows = sourceMaps[source] || {};
  const deltas: number[] = [];

  for (const [key, row] of Object.entries(rows)) {
    const value = rowValue(row);
    if (!value) continue;

    const otherValues = (Object.entries(sourceMaps) as Array<[RedraftRankingSourceKey, Record<string, RedraftSourceRow> | undefined]>)
      .filter(([otherSource]) => otherSource !== source)
      .map(([otherSource, otherRows]) => ({
        value: otherRows?.[canonicalPlayerNameKey(key)] ? rowValue(otherRows[canonicalPlayerNameKey(key)]) : null,
        weight: REDRAFT_SOURCE_CONFIG[otherSource].weight,
      }))
      .filter((item) => item.value && item.value > 0);
    if (!otherValues.length) continue;

    const consensus = medianNumber(otherValues.map((item) => Number(item.value))) || weightedAverage(otherValues);
    if (!consensus) continue;
    deltas.push(Math.abs(value - consensus) / consensus);
  }

  return {
    sampleSize: deltas.length,
    medianConsensusDeltaPct: medianNumber(deltas),
  };
}

function scoreAlignment(alignment: { sampleSize: number; medianConsensusDeltaPct: number | null }): number {
  if (alignment.sampleSize < REDRAFT_TRUST_MIN_ALIGNMENT_SAMPLE || alignment.medianConsensusDeltaPct === null) {
    return 0;
  }

  const delta = alignment.medianConsensusDeltaPct;
  const rawAdjustment = delta <= 0.08
    ? 12
    : delta <= 0.15
      ? 5
      : delta <= 0.25
        ? -7
        : -16;
  const sampleConfidence = clampNumber(alignment.sampleSize / REDRAFT_TRUST_FULL_ALIGNMENT_SAMPLE, 0.4, 1);
  return rawAdjustment * sampleConfidence;
}

function scoreRowCountRatio(rowCountRatio: number | null): number {
  if (rowCountRatio === null) return 0;
  if (rowCountRatio < 0.5) return -18;
  if (rowCountRatio < 0.75) return -8;
  if (rowCountRatio <= 1.25) return 5;
  if (rowCountRatio > 1.8) return -4;
  return 1;
}

function getCurrentStatusBaseScore(status: RankingSourceDiagnostic['status']): number {
  switch (status) {
    case 'loaded':
      return 70;
    case 'empty':
      return 45;
    case 'stale':
      return 30;
    case 'error':
      return 25;
    case 'disabled':
      return 50;
    default:
      return 50;
  }
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
  if (input.status !== 'loaded') {
    parts.push(`current status is ${input.status}`);
  }
  const alignmentPct = formatPercent(input.alignment.medianConsensusDeltaPct, 1);
  if (alignmentPct && input.alignment.sampleSize >= REDRAFT_TRUST_MIN_ALIGNMENT_SAMPLE) {
    parts.push(`${alignmentPct} median consensus drift across ${input.alignment.sampleSize.toLocaleString('en-US')} overlaps`);
  } else {
    parts.push('waiting for more consensus overlap');
  }
  const recentHealth = formatPercent(input.recentSuccessRate, 0);
  if (recentHealth) parts.push(`${recentHealth} recent source health`);
  const rowRatio = formatRatio(input.rowCountRatio);
  if (rowRatio) parts.push(`${rowRatio} recent row-count baseline`);
  return parts.join('; ');
}

export function calculateRedraftSourceTrust(input: {
  sourceMaps: Partial<Record<RedraftRankingSourceKey, Record<string, RedraftSourceRow>>>;
  diagnostics: RankingSourceDiagnostic[];
  history?: RedraftSourceSnapshotPayload[];
}): RedraftSourceTrustMap {
  const diagnosticBySource = new Map(input.diagnostics.map((diagnostic) => [diagnostic.key as RedraftRankingSourceKey, diagnostic]));
  const history = input.history || [];

  return Object.fromEntries((Object.keys(REDRAFT_SOURCE_CONFIG) as RedraftRankingSourceKey[]).map((source) => {
    const config = REDRAFT_SOURCE_CONFIG[source];
    const diagnostic = diagnosticBySource.get(source);
    const status = diagnostic?.status || 'empty';
    const currentRowCount = diagnostic?.rowCount ?? Object.keys(input.sourceMaps[source] || {}).length;
    const alignment = getConsensusAlignment(source, input.sourceMaps);
    const recentSuccessRate = getRecentSuccessRate(source, history);
    const rowCountRatio = getRowCountRatio(source, currentRowCount, history);

    let score = getCurrentStatusBaseScore(status);
    if (recentSuccessRate !== null) score += (recentSuccessRate - 0.7) * 30;
    score += scoreAlignment(alignment);
    score += scoreRowCountRatio(rowCountRatio);

    const boundedScore = Math.round(clampNumber(score, 0, 100));
    const multiplier = isRedraftAdaptiveTrustEnabled()
      ? Number((REDRAFT_TRUST_MIN_MULTIPLIER + (boundedScore / 100) * (REDRAFT_TRUST_MAX_MULTIPLIER - REDRAFT_TRUST_MIN_MULTIPLIER)).toFixed(3))
      : 1;
    const effectiveWeight = Number((config.weight * multiplier).toFixed(4));

    const trust: RedraftSourceTrust = {
      key: source,
      source: config.source,
      score: boundedScore,
      baseWeight: config.weight,
      multiplier,
      effectiveWeight,
      status,
      sampleSize: alignment.sampleSize,
      medianConsensusDeltaPct: alignment.medianConsensusDeltaPct,
      recentSuccessRate,
      rowCountRatio,
      note: isRedraftAdaptiveTrustEnabled()
        ? buildTrustNote({ status, alignment, recentSuccessRate, rowCountRatio })
        : 'adaptive redraft trust is disabled by ENABLE_REDRAFT_ADAPTIVE_TRUST',
    };
    return [source, trust];
  })) as RedraftSourceTrustMap;
}

function calculatePreviousRedraftSourceTrust(history: RedraftSourceSnapshotPayload[]): RedraftSourceTrustMap {
  const [previousSnapshot, ...olderSnapshots] = history;
  if (!previousSnapshot) return {};

  return calculateRedraftSourceTrust({
    sourceMaps: previousSnapshot.sources || {},
    diagnostics: previousSnapshot.diagnostics || [],
    history: olderSnapshots,
  });
}

function diagnosticForRows(
  source: RedraftRankingSourceKey,
  rows: Record<string, RedraftSourceRow> | Array<Record<string, RedraftSourceRow>>,
  expectedSeason: string,
  trust?: RedraftSourceTrust | null,
): RankingSourceDiagnostic {
  const rowSets = Array.isArray(rows) ? rows : [rows];
  const rowCount = Math.max(0, ...rowSets.map((rowSet) => Object.keys(rowSet || {}).length));
  const sourceSeasons = Array.from(new Set(rowSets.flatMap((rowSet) => Object.values(rowSet || {}).map((row) => row.season || null)).filter(Boolean))) as string[];
  const runtime = runtimeSourceDiagnostics.get(source);
  const config = REDRAFT_SOURCE_CONFIG[source];
  const runtimeStatus = runtime?.status;
  const status = runtimeStatus && !(runtimeStatus === 'empty' && rowCount > 0)
    ? runtimeStatus
    : rowCount > 0 ? 'loaded' : 'empty';

  return {
    key: source,
    source: config.source,
    board: 'redraft',
    status,
    rowCount,
    note: runtime?.note || (rowCount > 0
      ? `${config.source} loaded ${rowCount.toLocaleString('en-US')} row${rowCount === 1 ? '' : 's'} for the redraft board.`
      : `${config.source} returned no usable redraft rows. Other available source weights normalize automatically.`),
    error: runtime?.error || null,
    season: sourceSeasons.length === 1 ? sourceSeasons[0] : sourceSeasons.length ? sourceSeasons.join(', ') : null,
    expectedSeason,
    loadedAt: new Date().toISOString(),
    trustScore: trust?.score ?? null,
    trustMultiplier: trust?.multiplier ?? null,
    baseWeight: trust?.baseWeight ?? REDRAFT_SOURCE_CONFIG[source].weight,
    effectiveWeight: trust?.effectiveWeight ?? REDRAFT_SOURCE_CONFIG[source].weight,
    trustSampleSize: trust?.sampleSize ?? null,
    medianConsensusDeltaPct: trust?.medianConsensusDeltaPct ?? null,
    recentSuccessRate: trust?.recentSuccessRate ?? null,
    rowCountRatio: trust?.rowCountRatio ?? null,
    trustNote: trust?.note ?? null,
  };
}

function disabledSource(source: RedraftRankingSourceKey, note: string): Record<string, RedraftSourceRow> {
  setRuntimeSourceDiagnostic(source, {
    status: 'disabled',
    note,
    error: null,
  });
  return {};
}

function getDisabledSourceNote(source: RedraftRankingSourceKey): string {
  const flag = SOURCE_ENV_FLAGS[source];
  const configuredValue = process.env[flag];
  if (isDisabledValue(configuredValue)) return `${REDRAFT_SOURCE_CONFIG[source].source} is disabled by ${flag}.`;
  if (process.env.NODE_ENV === 'production' && (source === 'yahooDraftAnalysis' || source === 'nflFantasy')) {
    return `${REDRAFT_SOURCE_CONFIG[source].source} is disabled by default in production. Set ${flag}=true to opt into this scraping fallback.`;
  }
  return `${REDRAFT_SOURCE_CONFIG[source].source} is disabled.`;
}

async function persistRedraftSourceSnapshot(input: {
  snapshotKey: string;
  season: string;
  sources: Partial<Record<RedraftRankingSourceKey, Record<string, RedraftSourceRow>>>;
  diagnostics: RankingSourceDiagnostic[];
}) {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') return;
  if (isDisabledValue(process.env.ENABLE_REDRAFT_SOURCE_SNAPSHOTS)) return;

  const payload: RedraftSourceSnapshotPayload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    snapshotKey: input.snapshotKey,
    season: input.season,
    sources: input.sources,
    diagnostics: input.diagnostics,
  };
  const serializedPayload = JSON.stringify(payload, null, 2);

  try {
    fs.mkdirSync(REDRAFT_SOURCE_SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(REDRAFT_SOURCE_SNAPSHOT_DIR, `redraft-source-snapshot-${input.season}-${input.snapshotKey}.json`),
      serializedPayload,
    );
  } catch (error) {
    console.warn('[RedraftRankings] Failed to write local redraft source snapshot:', error);
  }

  try {
    const stored = await upsertRedraftSourceSnapshot({
      snapshotKey: input.snapshotKey,
      season: input.season,
      payload: serializedPayload,
    });
    if (!stored && !process.env.VITEST) {
      console.warn('[RedraftRankings] Database unavailable; redraft source snapshot saved locally only.');
    }
  } catch (error) {
    console.warn('[RedraftRankings] Failed to persist redraft source snapshot:', error);
  }
}

export function filterRedraftRowsForExpectedSeason(
  source: RedraftRankingSourceKey,
  rows: Record<string, RedraftSourceRow>,
  expectedSeason: string,
): Record<string, RedraftSourceRow> {
  const entries = Object.entries(rows || {});
  if (!entries.length) return rows;

  const staleEntries = entries.filter(([, row]) => row.season && row.season !== expectedSeason);
  if (!staleEntries.length) return rows;

  const filtered = Object.fromEntries(entries.filter(([, row]) => !row.season || row.season === expectedSeason));
  const sourceName = REDRAFT_SOURCE_CONFIG[source].source;
  const firstSeason = staleEntries[0]?.[1]?.season || 'unknown';
  const staleNote = `${sourceName} returned ${staleEntries.length.toLocaleString('en-US')} stale ${firstSeason} row${staleEntries.length === 1 ? '' : 's'} while ${expectedSeason} was requested. Stale rows were excluded from the blend.`;

  setRuntimeSourceDiagnostic(source, {
    status: Object.keys(filtered).length ? 'loaded' : 'stale',
    note: staleNote,
    error: null,
  });

  return filtered;
}

async function loadSourceRows(
  source: RedraftRankingSourceKey,
  loader: () => Promise<Record<string, RedraftSourceRow>>,
  expectedSeason: string,
): Promise<Record<string, RedraftSourceRow>> {
  if (!isRedraftSourceEnabled(source)) {
    return disabledSource(source, getDisabledSourceNote(source));
  }

  try {
    const rows = filterRedraftRowsForExpectedSeason(source, await withTimeout(source, loader()), expectedSeason);
    const runtime = runtimeSourceDiagnostics.get(source);
    if (!runtime || (runtime.status !== 'error' && runtime.status !== 'disabled')) {
      setRuntimeSourceDiagnostic(source, {
        status: runtime?.status === 'stale' ? 'stale' : Object.keys(rows || {}).length ? 'loaded' : 'empty',
        note: runtime?.status === 'stale' ? runtime.note : Object.keys(rows || {}).length
          ? `${REDRAFT_SOURCE_CONFIG[source].source} loaded successfully.`
          : `${REDRAFT_SOURCE_CONFIG[source].source} returned no usable rows.`,
        error: null,
      });
    }
    return rows;
  } catch (error) {
    setRuntimeSourceDiagnostic(source, {
      status: 'error',
      note: `${REDRAFT_SOURCE_CONFIG[source].source} failed before the redraft board could use it.`,
      error: getErrorMessage(error),
    });
    return {};
  }
}

export async function loadRedraftRankingProfiles({
  ktcValues = {},
  season = getCurrentSeason(),
}: {
  ktcValues?: KtcValues;
  season?: string;
} = {}): Promise<RedraftRankingLoadResult> {
  runtimeSourceDiagnostics.clear();
  if (!process.env.FANTASYPROS_API_KEY) {
    setRuntimeSourceDiagnostic('fantasyPros', {
      status: 'disabled',
      note: 'FantasyPros redraft rankings require FANTASYPROS_API_KEY.',
      error: null,
    });
  } else if (!isRedraftSourceEnabled('fantasyPros')) {
    setRuntimeSourceDiagnostic('fantasyPros', {
      status: 'disabled',
      note: 'FantasyPros redraft rankings are disabled by ENABLE_REDRAFT_FANTASYPROS.',
      error: null,
    });
  }
  if (!hasFantasyNerdsApiKey()) {
    setRuntimeSourceDiagnostic('fantasyNerds', {
      status: 'disabled',
      note: 'Fantasy Nerds redraft rankings require FANTASY_NERDS_API_KEY.',
      error: null,
    });
  } else if (!isRedraftSourceEnabled('fantasyNerds')) {
    setRuntimeSourceDiagnostic('fantasyNerds', {
      status: 'disabled',
      note: 'Fantasy Nerds redraft rankings are disabled by ENABLE_REDRAFT_FANTASY_NERDS.',
      error: null,
    });
  }

  const [
    fantasyProsPpr,
    fantasyProsHalfPpr,
    fantasyProsStandard,
    fantasyNerdsPpr,
    fantasyNerdsHalfPpr,
    fantasyNerdsStandard,
    internalSeasonBlend,
    mflAdp,
    mflRankings,
    espnPpr,
    espnHalfPpr,
    espnStandard,
    fleaflicker,
    yahooDraftAnalysis,
    nflFantasy,
  ] = await Promise.all([
    process.env.FANTASYPROS_API_KEY && isRedraftSourceEnabled('fantasyPros')
      ? loadSourceRows('fantasyPros', () => fetchFantasyProsDraftRankings(season, 'PPR').then((values) => sourceRowsFromFantasyPros(values, season)), season)
      : Promise.resolve({}),
    process.env.FANTASYPROS_API_KEY && isRedraftSourceEnabled('fantasyPros')
      ? loadSourceRows('fantasyPros', () => fetchFantasyProsDraftRankings(season, 'HALF').then((values) => sourceRowsFromFantasyPros(values, season)), season)
      : Promise.resolve({}),
    process.env.FANTASYPROS_API_KEY && isRedraftSourceEnabled('fantasyPros')
      ? loadSourceRows('fantasyPros', () => fetchFantasyProsDraftRankings(season, 'STD').then((values) => sourceRowsFromFantasyPros(values, season)), season)
      : Promise.resolve({}),
    hasFantasyNerdsApiKey() && isRedraftSourceEnabled('fantasyNerds')
      ? loadSourceRows('fantasyNerds', () => fetchFantasyNerdsDraftRankings(getFantasyNerdsScoring('PPR')).then(sourceRowsFromFantasyNerds), season)
      : Promise.resolve({}),
    hasFantasyNerdsApiKey() && isRedraftSourceEnabled('fantasyNerds')
      ? loadSourceRows('fantasyNerds', () => fetchFantasyNerdsDraftRankings(getFantasyNerdsScoring('HALF')).then(sourceRowsFromFantasyNerds), season)
      : Promise.resolve({}),
    hasFantasyNerdsApiKey() && isRedraftSourceEnabled('fantasyNerds')
      ? loadSourceRows('fantasyNerds', () => fetchFantasyNerdsDraftRankings(getFantasyNerdsScoring('STD')).then(sourceRowsFromFantasyNerds), season)
      : Promise.resolve({}),
    isRedraftSourceEnabled('internalSeasonBlend')
      ? Promise.resolve(sourceRowsFromInternalBlend(ktcValues))
      : Promise.resolve(disabledSource('internalSeasonBlend', 'Internal redraft season blend is disabled by ENABLE_REDRAFT_INTERNAL_SEASON_BLEND.')),
    loadSourceRows('mflAdp', () => fetchMflAdpRows(season), season),
    loadSourceRows('mflRankings', () => fetchMflRankingRows(season), season),
    loadSourceRows('espnFantasy', () => fetchEspnFantasyRows('PPR', season), season),
    loadSourceRows('espnFantasy', () => fetchEspnFantasyRows('HALF', season), season),
    loadSourceRows('espnFantasy', () => fetchEspnFantasyRows('STD', season), season),
    loadSourceRows('fleaflicker', () => fetchFleaflickerRows(season), season),
    loadSourceRows('yahooDraftAnalysis', () => fetchYahooDraftAnalysisRows(season), season),
    loadSourceRows('nflFantasy', () => fetchNflFantasyRows(season), season),
  ]);

  const sharedSources = {
    internalSeasonBlend,
    mflAdp,
    mflRankings,
    fleaflicker,
    yahooDraftAnalysis,
    nflFantasy,
  };

  const trustSourceMaps = {
    fantasyPros: mergeSourceRowMaps(fantasyProsPpr, fantasyProsHalfPpr, fantasyProsStandard),
    fantasyNerds: mergeSourceRowMaps(fantasyNerdsPpr, fantasyNerdsHalfPpr, fantasyNerdsStandard),
    internalSeasonBlend,
    mflAdp,
    mflRankings,
    espnFantasy: mergeSourceRowMaps(espnPpr, espnHalfPpr, espnStandard),
    fleaflicker,
    yahooDraftAnalysis,
    nflFantasy,
  };

  const baseDiagnostics: RankingSourceDiagnostic[] = [
    diagnosticForRows('fantasyPros', [fantasyProsPpr, fantasyProsHalfPpr, fantasyProsStandard], season),
    diagnosticForRows('fantasyNerds', [fantasyNerdsPpr, fantasyNerdsHalfPpr, fantasyNerdsStandard], season),
    diagnosticForRows('internalSeasonBlend', internalSeasonBlend, season),
    diagnosticForRows('mflAdp', mflAdp, season),
    diagnosticForRows('mflRankings', mflRankings, season),
    diagnosticForRows('espnFantasy', [espnPpr, espnHalfPpr, espnStandard], season),
    diagnosticForRows('fleaflicker', fleaflicker, season),
    diagnosticForRows('yahooDraftAnalysis', yahooDraftAnalysis, season),
    diagnosticForRows('nflFantasy', nflFantasy, season),
  ];

  const recentSourceSnapshots = await loadRecentRedraftSourceSnapshots(season);
  const sourceTrust = calculateRedraftSourceTrust({
    sourceMaps: trustSourceMaps,
    diagnostics: baseDiagnostics,
    history: recentSourceSnapshots,
  });
  const previousSourceTrust = calculatePreviousRedraftSourceTrust(recentSourceSnapshots);

  const profiles = {
    redraft_ppr: blendRedraftRankingRows({ fantasyPros: fantasyProsPpr, fantasyNerds: fantasyNerdsPpr, espnFantasy: espnPpr, ...sharedSources }, { sourceTrust }),
    redraft_half_ppr: blendRedraftRankingRows({ fantasyPros: fantasyProsHalfPpr, fantasyNerds: fantasyNerdsHalfPpr, espnFantasy: espnHalfPpr, ...sharedSources }, { sourceTrust }),
    redraft_standard: blendRedraftRankingRows({ fantasyPros: fantasyProsStandard, fantasyNerds: fantasyNerdsStandard, espnFantasy: espnStandard, ...sharedSources }, { sourceTrust }),
  };

  const diagnostics: RankingSourceDiagnostic[] = annotateDiagnosticsWithTrustHistory([
    diagnosticForRows('fantasyPros', [fantasyProsPpr, fantasyProsHalfPpr, fantasyProsStandard], season, sourceTrust.fantasyPros),
    diagnosticForRows('fantasyNerds', [fantasyNerdsPpr, fantasyNerdsHalfPpr, fantasyNerdsStandard], season, sourceTrust.fantasyNerds),
    diagnosticForRows('internalSeasonBlend', internalSeasonBlend, season, sourceTrust.internalSeasonBlend),
    diagnosticForRows('mflAdp', mflAdp, season, sourceTrust.mflAdp),
    diagnosticForRows('mflRankings', mflRankings, season, sourceTrust.mflRankings),
    diagnosticForRows('espnFantasy', [espnPpr, espnHalfPpr, espnStandard], season, sourceTrust.espnFantasy),
    diagnosticForRows('fleaflicker', fleaflicker, season, sourceTrust.fleaflicker),
    diagnosticForRows('yahooDraftAnalysis', yahooDraftAnalysis, season, sourceTrust.yahooDraftAnalysis),
    diagnosticForRows('nflFantasy', nflFantasy, season, sourceTrust.nflFantasy),
  ], previousSourceTrust);

  await persistRedraftSourceSnapshot({
    snapshotKey: getSnapshotDateKey(),
    season,
    sources: {
      fantasyPros: fantasyProsPpr,
      fantasyNerds: fantasyNerdsPpr,
      internalSeasonBlend,
      mflAdp,
      mflRankings,
      espnFantasy: espnPpr,
      fleaflicker,
      yahooDraftAnalysis,
      nflFantasy,
    },
    diagnostics,
  });

  return { profiles, diagnostics, sourceTrust };
}
