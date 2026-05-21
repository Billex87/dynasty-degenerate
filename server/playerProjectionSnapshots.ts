import crypto from 'node:crypto';
import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { normalizeNflTeamCode, type NflTeamCode } from './nflTeamCodes';
import { parseProviderSnapshotPayload } from './providerDataSnapshots';

export type PlayerProjectionSource = 'fantasypros' | 'draftsharks' | 'sportsdataio' | 'fantasynerds' | 'internal';
export type PlayerProjectionType = 'weekly' | 'rest_of_season' | 'preseason' | 'playoff_weeks';
export type PlayerProjectionPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'FLEX' | 'UNKNOWN';

export type PlayerProjectionInputRow = {
  season: string | number;
  week?: string | number | null;
  playerId?: string | number | null;
  sourcePlayerId?: string | number | null;
  playerName?: string | null;
  team?: string | null;
  position?: string | null;
  projectedFantasyPoints?: string | number | null;
  passingAttempts?: string | number | null;
  passingYards?: string | number | null;
  passingTouchdowns?: string | number | null;
  interceptions?: string | number | null;
  carries?: string | number | null;
  rushingYards?: string | number | null;
  rushingTouchdowns?: string | number | null;
  targets?: string | number | null;
  receptions?: string | number | null;
  receivingYards?: string | number | null;
  receivingTouchdowns?: string | number | null;
  routes?: string | number | null;
  snaps?: string | number | null;
  turnovers?: string | number | null;
  fieldGoalAttempts?: string | number | null;
  defensiveSacks?: string | number | null;
  defensiveInterceptions?: string | number | null;
  defensiveFumbleRecoveries?: string | number | null;
  defensiveTouchdowns?: string | number | null;
  confidence?: string | number | null;
  expertCount?: string | number | null;
  injuryStatus?: string | null;
  rookie?: boolean | string | number | null;
  matchConfidence?: string | number | null;
  ambiguousMatch?: boolean | string | number | null;
  sourceError?: string | null;
  providerUpdatedAt?: string | Date | null;
  publishedAt?: string | Date | null;
};

export type PlayerProjectionSnapshotRow = {
  rowKey: string;
  season: string;
  week: number | null;
  playerId: string | null;
  sourcePlayerId: string | null;
  playerName: string;
  team: NflTeamCode | null;
  position: PlayerProjectionPosition;
  source: PlayerProjectionSource;
  scoringProfile: string;
  projectionType: PlayerProjectionType;
  sourceVersion: string;
  projectedFantasyPoints: number | null;
  passingAttempts: number | null;
  passingYards: number | null;
  passingTouchdowns: number | null;
  interceptions: number | null;
  carries: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;
  targets: number | null;
  receptions: number | null;
  receivingYards: number | null;
  receivingTouchdowns: number | null;
  routes: number | null;
  snaps: number | null;
  turnovers: number | null;
  fieldGoalAttempts: number | null;
  defensiveSacks: number | null;
  defensiveInterceptions: number | null;
  defensiveFumbleRecoveries: number | null;
  defensiveTouchdowns: number | null;
  confidence: number | null;
  expertCount: number | null;
  injuryStatus: string | null;
  rookie: boolean;
  identityStatus: 'matched' | 'source-only' | 'ambiguous' | 'missing';
  matchConfidence: number | null;
  providerUpdatedAt: string | null;
  publishedAt: string | null;
};

export type QuarantinedProjectionRow = {
  reason: 'missing-player' | 'ambiguous-identity' | 'missing-projection' | 'unsupported-position';
  playerName: string | null;
  sourcePlayerId: string | null;
  team: NflTeamCode | null;
  position: string | null;
  sourceError: string | null;
};

export type PlayerProjectionIdentityDiagnostics = {
  totalRows: number;
  normalizedRows: number;
  quarantinedRows: number;
  matchedRows: number;
  sourceOnlyRows: number;
  ambiguousRows: number;
  missingIdentityRows: number;
  duplicateSourcePlayerIds: string[];
  duplicatePlayerIds: string[];
};

export type PlayerProjectionSnapshotPayload = {
  schemaVersion: 1;
  sourceKey: string;
  snapshotKey: string;
  source: PlayerProjectionSource;
  scoringProfile: string;
  projectionType: PlayerProjectionType;
  sourceVersion: string;
  season: string;
  week: number | null;
  fetchedAt: string;
  publishedAt: string | null;
  validForWeek: number | null;
  providerUpdatedAt: string | null;
  rowCount: number;
  positionCoverage: Record<string, number>;
  missingStarterCount: number | null;
  sourceError: string | null;
  staleReason: string | null;
  checksum: string;
  parserVersion: number;
  rows: PlayerProjectionSnapshotRow[];
  quarantinedRows: QuarantinedProjectionRow[];
  identityDiagnostics: PlayerProjectionIdentityDiagnostics;
};

export const PLAYER_PROJECTION_SNAPSHOT_SOURCE_PREFIX = 'player-projection-snapshots-v1';

type BuildPlayerProjectionSnapshotInput = {
  season: string | number;
  week?: string | number | null;
  source: PlayerProjectionSource;
  scoringProfile: string;
  projectionType: PlayerProjectionType;
  sourceVersion: string | number;
  rows: PlayerProjectionInputRow[];
  fetchedAt?: string | Date | null;
  publishedAt?: string | Date | null;
  validForWeek?: string | number | null;
  providerUpdatedAt?: string | Date | null;
  missingStarterCount?: string | number | null;
  sourceError?: string | null;
  staleReason?: string | null;
  parserVersion?: number;
};

function cleanVersion(value: string | number): string {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 40) || 'unversioned';
}

function cleanScoringProfile(value: string): string {
  return String(value || 'PPR').trim().toUpperCase().replace(/[^A-Z0-9._:-]/g, '_') || 'PPR';
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function intValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function boolValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return /^(?:1|true|yes|y)$/i.test(String(value || '').trim());
}

function parseDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizePosition(value?: string | null): PlayerProjectionPosition {
  const normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z/]/g, '');
  if (normalized === 'DST' || normalized === 'D/ST' || normalized === 'D') return 'DEF';
  if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX'].includes(normalized)) return normalized as PlayerProjectionPosition;
  return 'UNKNOWN';
}

function idValue(value: unknown): string | null {
  const raw = String(value || '').trim();
  return raw && raw !== '0' ? raw : null;
}

function stableChecksum(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function getPlayerProjectionSourceKey(input: {
  source: PlayerProjectionSource;
  scoringProfile: string;
  projectionType: PlayerProjectionType;
}): string {
  return [
    PLAYER_PROJECTION_SNAPSHOT_SOURCE_PREFIX,
    input.source,
    cleanScoringProfile(input.scoringProfile),
    input.projectionType,
  ].join(':');
}

export function getPlayerProjectionSnapshotKey(input: {
  season: string | number;
  week?: string | number | null;
  sourceVersion: string | number;
}): string {
  const week = intValue(input.week);
  return [
    String(input.season),
    week === null ? 'all' : `w${week}`,
    cleanVersion(input.sourceVersion),
  ].join(':').slice(0, 64);
}

export function getPlayerProjectionRowKey(input: Pick<PlayerProjectionSnapshotRow, 'season' | 'week' | 'playerId' | 'sourcePlayerId' | 'source' | 'scoringProfile' | 'projectionType' | 'sourceVersion'>): string {
  return [
    input.season,
    input.week === null ? 'all' : `w${input.week}`,
    input.source,
    input.projectionType,
    input.scoringProfile,
    input.playerId || input.sourcePlayerId || 'unknown-player',
    input.sourceVersion,
  ].join(':');
}

function quarantineReason(row: PlayerProjectionInputRow, position: PlayerProjectionPosition, projectedFantasyPoints: number | null): QuarantinedProjectionRow['reason'] | null {
  if (position === 'UNKNOWN') return 'unsupported-position';
  if (projectedFantasyPoints === null) return 'missing-projection';
  if (boolValue(row.ambiguousMatch)) return 'ambiguous-identity';
  if (!idValue(row.playerId) && !idValue(row.sourcePlayerId) && !String(row.playerName || '').trim()) return 'missing-player';
  return null;
}

export function normalizePlayerProjectionRows(input: BuildPlayerProjectionSnapshotInput): {
  rows: PlayerProjectionSnapshotRow[];
  quarantinedRows: QuarantinedProjectionRow[];
} {
  const season = String(input.season);
  const week = intValue(input.week);
  const sourceVersion = cleanVersion(input.sourceVersion);
  const scoringProfile = cleanScoringProfile(input.scoringProfile);
  const source = input.source;
  const projectionType = input.projectionType;
  const seen = new Set<string>();
  const rows: PlayerProjectionSnapshotRow[] = [];
  const quarantinedRows: QuarantinedProjectionRow[] = [];

  for (const rawRow of input.rows || []) {
    const playerId = idValue(rawRow.playerId);
    const sourcePlayerId = idValue(rawRow.sourcePlayerId);
    const playerName = String(rawRow.playerName || '').trim();
    const team = normalizeNflTeamCode(rawRow.team);
    const position = normalizePosition(rawRow.position);
    const projectedFantasyPoints = numberValue(rawRow.projectedFantasyPoints);
    const reason = quarantineReason(rawRow, position, projectedFantasyPoints);

    if (reason) {
      quarantinedRows.push({
        reason,
        playerName: playerName || null,
        sourcePlayerId,
        team,
        position: rawRow.position || null,
        sourceError: rawRow.sourceError || null,
      });
      continue;
    }

    const identityStatus: PlayerProjectionSnapshotRow['identityStatus'] = boolValue(rawRow.ambiguousMatch)
      ? 'ambiguous'
      : playerId
        ? 'matched'
        : sourcePlayerId
          ? 'source-only'
          : 'missing';
    const baseRow = {
      season,
      week,
      playerId,
      sourcePlayerId,
      playerName: playerName || sourcePlayerId || playerId || 'Unknown player',
      team,
      position,
      source,
      scoringProfile,
      projectionType,
      sourceVersion,
      projectedFantasyPoints,
      passingAttempts: numberValue(rawRow.passingAttempts),
      passingYards: numberValue(rawRow.passingYards),
      passingTouchdowns: numberValue(rawRow.passingTouchdowns),
      interceptions: numberValue(rawRow.interceptions),
      carries: numberValue(rawRow.carries),
      rushingYards: numberValue(rawRow.rushingYards),
      rushingTouchdowns: numberValue(rawRow.rushingTouchdowns),
      targets: numberValue(rawRow.targets),
      receptions: numberValue(rawRow.receptions),
      receivingYards: numberValue(rawRow.receivingYards),
      receivingTouchdowns: numberValue(rawRow.receivingTouchdowns),
      routes: numberValue(rawRow.routes),
      snaps: numberValue(rawRow.snaps),
      turnovers: numberValue(rawRow.turnovers),
      fieldGoalAttempts: numberValue(rawRow.fieldGoalAttempts),
      defensiveSacks: numberValue(rawRow.defensiveSacks),
      defensiveInterceptions: numberValue(rawRow.defensiveInterceptions),
      defensiveFumbleRecoveries: numberValue(rawRow.defensiveFumbleRecoveries),
      defensiveTouchdowns: numberValue(rawRow.defensiveTouchdowns),
      confidence: numberValue(rawRow.confidence),
      expertCount: intValue(rawRow.expertCount),
      injuryStatus: rawRow.injuryStatus ? String(rawRow.injuryStatus) : null,
      rookie: boolValue(rawRow.rookie),
      identityStatus,
      matchConfidence: numberValue(rawRow.matchConfidence),
      providerUpdatedAt: parseDate(rawRow.providerUpdatedAt),
      publishedAt: parseDate(rawRow.publishedAt),
    };
    const row: PlayerProjectionSnapshotRow = {
      ...baseRow,
      rowKey: getPlayerProjectionRowKey(baseRow),
    };
    if (seen.has(row.rowKey)) continue;
    seen.add(row.rowKey);
    rows.push(row);
  }

  return {
    rows: rows.sort((a, b) => a.position.localeCompare(b.position) || b.projectedFantasyPoints! - a.projectedFantasyPoints! || a.playerName.localeCompare(b.playerName)),
    quarantinedRows,
  };
}

function duplicateValues(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return Array.from(duplicates).sort();
}

export function buildPlayerProjectionIdentityDiagnostics(
  rows: PlayerProjectionSnapshotRow[],
  quarantinedRows: QuarantinedProjectionRow[] = []
): PlayerProjectionIdentityDiagnostics {
  return {
    totalRows: rows.length + quarantinedRows.length,
    normalizedRows: rows.length,
    quarantinedRows: quarantinedRows.length,
    matchedRows: rows.filter((row) => row.identityStatus === 'matched').length,
    sourceOnlyRows: rows.filter((row) => row.identityStatus === 'source-only').length,
    ambiguousRows: rows.filter((row) => row.identityStatus === 'ambiguous').length + quarantinedRows.filter((row) => row.reason === 'ambiguous-identity').length,
    missingIdentityRows: rows.filter((row) => row.identityStatus === 'missing').length + quarantinedRows.filter((row) => row.reason === 'missing-player').length,
    duplicateSourcePlayerIds: duplicateValues(rows.map((row) => row.sourcePlayerId)),
    duplicatePlayerIds: duplicateValues(rows.map((row) => row.playerId)),
  };
}

export function buildPlayerProjectionSnapshot(input: BuildPlayerProjectionSnapshotInput): PlayerProjectionSnapshotPayload {
  const normalized = normalizePlayerProjectionRows(input);
  const sourceKey = getPlayerProjectionSourceKey(input);
  const snapshotKey = getPlayerProjectionSnapshotKey(input);
  const identityDiagnostics = buildPlayerProjectionIdentityDiagnostics(normalized.rows, normalized.quarantinedRows);
  const positionCoverage = normalized.rows.reduce((coverage, row) => {
    coverage[row.position] = (coverage[row.position] || 0) + 1;
    return coverage;
  }, {} as Record<string, number>);
  const payloadBase = {
    rows: normalized.rows,
    quarantinedRows: normalized.quarantinedRows,
    sourceVersion: cleanVersion(input.sourceVersion),
    parserVersion: input.parserVersion || 1,
  };

  return {
    schemaVersion: 1,
    sourceKey,
    snapshotKey,
    source: input.source,
    scoringProfile: cleanScoringProfile(input.scoringProfile),
    projectionType: input.projectionType,
    sourceVersion: cleanVersion(input.sourceVersion),
    season: String(input.season),
    week: intValue(input.week),
    fetchedAt: parseDate(input.fetchedAt) || new Date().toISOString(),
    publishedAt: parseDate(input.publishedAt),
    validForWeek: intValue(input.validForWeek) ?? intValue(input.week),
    providerUpdatedAt: parseDate(input.providerUpdatedAt),
    rowCount: normalized.rows.length,
    positionCoverage,
    missingStarterCount: intValue(input.missingStarterCount),
    sourceError: input.sourceError || null,
    staleReason: input.staleReason || null,
    checksum: stableChecksum(payloadBase),
    parserVersion: input.parserVersion || 1,
    rows: normalized.rows,
    quarantinedRows: normalized.quarantinedRows,
    identityDiagnostics,
  };
}

export async function persistPlayerProjectionSnapshot(snapshot: PlayerProjectionSnapshotPayload) {
  return upsertProviderDataSnapshot({
    sourceKey: snapshot.sourceKey,
    snapshotKey: snapshot.snapshotKey,
    payload: JSON.stringify(snapshot),
  });
}

export async function loadLatestPlayerProjectionSnapshot(input: {
  source: PlayerProjectionSource;
  scoringProfile: string;
  projectionType: PlayerProjectionType;
}): Promise<PlayerProjectionSnapshotPayload | null> {
  const stored = await findLatestProviderDataSnapshot(getPlayerProjectionSourceKey(input));
  const parsed = parseProviderSnapshotPayload<PlayerProjectionSnapshotPayload>(stored?.payload);
  return parsed?.schemaVersion === 1 && Array.isArray(parsed.rows) ? parsed : null;
}
