import { createHash } from 'node:crypto';
import { normalizeDraftSharksSosPayload, type DraftSharksScheduleContext } from './draftSharksSchedule';

export const DRAFTSHARKS_SOS_SOURCE_KEY = 'draftsharks-sos-v1';
export const DRAFTSHARKS_SOS_IMPORT_PARSER_VERSION = 1;

export type DraftSharksSosSnapshotImportPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  sourceVersion: string;
  sourceName: string;
  sourceFile?: string | null;
  rowCount: number;
  profileCount: number;
  checksum: string;
  parserVersion: number;
  context: DraftSharksScheduleContext;
};

export type DraftSharksSosSnapshotImportResult = {
  sourceKey: typeof DRAFTSHARKS_SOS_SOURCE_KEY;
  snapshotKey: string;
  sourceVersion: string;
  rowCount: number;
  profileCount: number;
  checksum: string;
  payload: DraftSharksSosSnapshotImportPayload;
};

type DraftSharksImportRow = Record<string, unknown>;

function parseDelimitedLine(line: string, delimiter: ',' | '\t'): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function parseDelimitedRows(text: string): DraftSharksImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter: ',' | '\t' = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseDelimitedLine(lines[0], delimiter).map((header) => header.trim());
  if (!headers.length) return [];

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function rowsFromJson(payload: unknown): DraftSharksImportRow[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is DraftSharksImportRow => Boolean(row && typeof row === 'object'));
  }
  if (!payload || typeof payload !== 'object') return [];

  const objectPayload = payload as Record<string, unknown>;
  for (const key of ['rows', 'data', 'items', 'sos', 'strengthOfSchedule']) {
    const rows = objectPayload[key];
    if (Array.isArray(rows)) {
      return rows.filter((row): row is DraftSharksImportRow => Boolean(row && typeof row === 'object'));
    }
  }

  return [];
}

export function parseDraftSharksSosImportRows(input: {
  text: string;
  fileName?: string | null;
}): DraftSharksImportRow[] {
  const text = input.text.trim();
  if (!text) return [];

  const looksJson = /^[\[{]/.test(text) || /\.json$/i.test(String(input.fileName || ''));
  if (looksJson) {
    return rowsFromJson(JSON.parse(text));
  }

  return parseDelimitedRows(text);
}

function defaultSourceVersion(season: string | number, now: Date): string {
  return `manual-${season}-${now.toISOString().slice(0, 10)}`;
}

function checksumFor(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

export function buildDraftSharksSosSnapshotImport(input: {
  rows: DraftSharksImportRow[];
  season: string | number;
  sourceVersion?: string | null;
  sourceName?: string | null;
  sourceFile?: string | null;
  importedAt?: string | Date | null;
}): DraftSharksSosSnapshotImportResult {
  const importedAt = input.importedAt ? new Date(input.importedAt) : new Date();
  const generatedAt = Number.isFinite(importedAt.getTime()) ? importedAt.toISOString() : new Date().toISOString();
  const sourceVersion = String(input.sourceVersion || defaultSourceVersion(input.season, new Date(generatedAt))).trim();
  const snapshotKey = `${input.season}:${sourceVersion}`;
  const profiles = normalizeDraftSharksSosPayload({ rows: input.rows });
  const profileCount = Object.keys(profiles).length;

  if (!input.rows.length) {
    throw new Error('DraftSharks SOS import did not contain any rows.');
  }
  if (!profileCount) {
    throw new Error('DraftSharks SOS import did not produce any team/position profiles.');
  }

  const updatedAt = Object.values(profiles)
    .map((profile) => profile.updatedAt)
    .sort()
    .at(-1) || generatedAt;
  const context: DraftSharksScheduleContext = {
    status: 'loaded',
    source: 'DraftSharks SOS',
    updatedAt,
    profiles,
    message: null,
  };
  const checksum = checksumFor({
    season: String(input.season),
    sourceVersion,
    profiles,
  });
  const payload: DraftSharksSosSnapshotImportPayload = {
    schemaVersion: 1,
    generatedAt,
    snapshotKey,
    sourceVersion,
    sourceName: input.sourceName || 'DraftSharks manual SOS snapshot',
    sourceFile: input.sourceFile || null,
    rowCount: input.rows.length,
    profileCount,
    checksum,
    parserVersion: DRAFTSHARKS_SOS_IMPORT_PARSER_VERSION,
    context,
  };

  return {
    sourceKey: DRAFTSHARKS_SOS_SOURCE_KEY,
    snapshotKey,
    sourceVersion,
    rowCount: input.rows.length,
    profileCount,
    checksum,
    payload,
  };
}
