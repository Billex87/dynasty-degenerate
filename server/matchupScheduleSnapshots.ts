import crypto from 'node:crypto';
import { normalizeNflTeamCode, type NflTeamCode } from './nflTeamCodes';

export type MatchupScheduleSource = 'fantasypros' | 'draftsharks' | 'internal';
export type MatchupSchedulePosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
export type MatchupScheduleTier = 'easy' | 'neutral' | 'hard' | 'bye';
export type MatchupScheduleHomeAway = 'home' | 'away' | 'neutral' | null;

export type MatchupScheduleInputRow = {
  season: string | number;
  position: string;
  source: MatchupScheduleSource;
  playerId?: string | number | null;
  teamDefenseId?: string | number | null;
  playerName?: string | null;
  team?: string | null;
  week: string | number;
  opponent?: string | null;
  homeAway?: string | null;
  ecr?: string | number | null;
  matchupRating?: string | number | null;
  matchupStars?: string | number | null;
  opponentRank?: string | number | null;
  matchupTier?: string | null;
  sourceUrl?: string | null;
  fetchedAt?: string | Date | null;
};

export type MatchupScheduleSnapshotRow = {
  rowKey: string;
  season: string;
  position: MatchupSchedulePosition;
  source: MatchupScheduleSource;
  playerId: string | null;
  teamDefenseId: string | null;
  playerName: string | null;
  team: NflTeamCode | null;
  week: number;
  opponent: NflTeamCode | null;
  homeAway: MatchupScheduleHomeAway;
  ecr: number | null;
  matchupRating: number | null;
  matchupStars: number | null;
  opponentRank: number | null;
  matchupTier: MatchupScheduleTier;
  sourceUrl: string | null;
  fetchedAt: string;
  sourceVersion: string;
};

export type MatchupScheduleSnapshotPayload = {
  schemaVersion: 1;
  sourceKey: string;
  snapshotKey: string;
  source: MatchupScheduleSource;
  season: string;
  position: MatchupSchedulePosition;
  sourceVersion: string;
  fetchedAt: string;
  refreshCadenceHours: number;
  expiresAt: string;
  rowCount: number;
  checksum: string;
  parserVersion: number;
  rows: MatchupScheduleSnapshotRow[];
};

export type MatchupScheduleSnapshotFreshness = {
  status: 'fresh' | 'stale' | 'expired';
  phase: 'preseason' | 'in-season' | 'offseason';
  refreshCadenceHours: number;
  ageHours: number | null;
  expiresAt: string | null;
  note: string;
};

export const MATCHUP_SCHEDULE_SNAPSHOT_SOURCE_PREFIX = 'matchup-calendar-sos-v1';

type BuildMatchupScheduleSnapshotInput = {
  season: string | number;
  position: MatchupSchedulePosition | string;
  source: MatchupScheduleSource;
  sourceVersion: string | number;
  rows: MatchupScheduleInputRow[];
  fetchedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  parserVersion?: number;
};

function cleanVersion(value: string | number): string {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 40) || 'unversioned';
}

function normalizePosition(value: string): MatchupSchedulePosition | null {
  const normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z/]/g, '');
  if (normalized === 'DEF' || normalized === 'D/ST') return 'DST';
  return ['QB', 'RB', 'WR', 'TE', 'K', 'DST'].includes(normalized) ? normalized as MatchupSchedulePosition : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function parseDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function idValue(value: unknown): string | null {
  const raw = String(value || '').trim();
  return raw && raw !== '0' ? raw : null;
}

function normalizeHomeAway(value?: string | null): MatchupScheduleHomeAway {
  const normalized = String(value || '').trim().toLowerCase();
  if (['home', 'h', '@home'].includes(normalized)) return 'home';
  if (['away', 'a', '@'].includes(normalized)) return 'away';
  if (['neutral', 'n'].includes(normalized)) return 'neutral';
  return null;
}

function normalizeTier(value: string | null | undefined, stars: number | null, opponentRank: number | null): MatchupScheduleTier {
  const normalized = String(value || '').trim().toLowerCase();
  if (['bye'].includes(normalized)) return 'bye';
  if (['easy', 'green', 'good', 'favorable'].includes(normalized)) return 'easy';
  if (['hard', 'red', 'bad', 'tough'].includes(normalized)) return 'hard';
  if (stars !== null) {
    if (stars >= 4) return 'easy';
    if (stars <= 2) return 'hard';
  }
  if (opponentRank !== null) {
    if (opponentRank >= 25) return 'easy';
    if (opponentRank <= 8) return 'hard';
  }
  return 'neutral';
}

function stableChecksum(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function getMatchupScheduleRefreshPolicy(now = new Date()): Pick<MatchupScheduleSnapshotFreshness, 'phase' | 'refreshCadenceHours'> {
  const month = now.getUTCMonth() + 1;
  if (month >= 9 || month <= 1) return { phase: 'in-season', refreshCadenceHours: 24 };
  if (month >= 5 && month <= 8) return { phase: 'preseason', refreshCadenceHours: 72 };
  return { phase: 'offseason', refreshCadenceHours: 168 };
}

function addHours(isoDate: string, hours: number): string {
  const date = new Date(isoDate);
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function getMatchupScheduleSourceKey(input: {
  source: MatchupScheduleSource;
  season: string | number;
  position: MatchupSchedulePosition | string;
}): string {
  const position = normalizePosition(String(input.position)) || 'DST';
  return `${MATCHUP_SCHEDULE_SNAPSHOT_SOURCE_PREFIX}:${input.source}:${String(input.season)}:${position}`;
}

export function getMatchupScheduleSnapshotKey(input: {
  season: string | number;
  sourceVersion: string | number;
}): string {
  return `${String(input.season)}:${cleanVersion(input.sourceVersion)}`.slice(0, 64);
}

export function normalizeMatchupScheduleRows(input: BuildMatchupScheduleSnapshotInput): MatchupScheduleSnapshotRow[] {
  const season = String(input.season);
  const position = normalizePosition(String(input.position));
  if (!position) return [];
  const sourceVersion = cleanVersion(input.sourceVersion);
  const fetchedAt = parseDate(input.fetchedAt) || new Date().toISOString();
  const seen = new Set<string>();
  const rows: MatchupScheduleSnapshotRow[] = [];

  for (const row of input.rows || []) {
    const rowPosition = normalizePosition(row.position);
    if (rowPosition !== position) continue;
    const week = Number(row.week);
    const playerId = idValue(row.playerId);
    const teamDefenseId = idValue(row.teamDefenseId);
    const playerName = String(row.playerName || '').trim() || null;
    if (!Number.isInteger(week) || week < 1 || week > 23 || (!playerId && !teamDefenseId && !playerName)) continue;
    const matchupStars = numberValue(row.matchupStars);
    const opponentRank = numberValue(row.opponentRank);
    const normalizedRow = {
      season,
      position,
      source: input.source,
      playerId,
      teamDefenseId,
      playerName,
      team: normalizeNflTeamCode(row.team),
      week,
      opponent: normalizeNflTeamCode(row.opponent),
      homeAway: normalizeHomeAway(row.homeAway),
      ecr: numberValue(row.ecr),
      matchupRating: numberValue(row.matchupRating),
      matchupStars,
      opponentRank,
      matchupTier: normalizeTier(row.matchupTier, matchupStars, opponentRank),
      sourceUrl: row.sourceUrl || null,
      fetchedAt: parseDate(row.fetchedAt) || fetchedAt,
      sourceVersion,
    };
    const rowKey = [
      season,
      position,
      input.source,
      playerId || teamDefenseId || playerName,
      week,
      normalizedRow.opponent || 'bye',
      sourceVersion,
    ].join(':');
    if (seen.has(rowKey)) continue;
    seen.add(rowKey);
    rows.push({ ...normalizedRow, rowKey });
  }

  return rows.sort((a, b) => a.week - b.week || (a.ecr || 9999) - (b.ecr || 9999) || (a.playerName || '').localeCompare(b.playerName || ''));
}

export function buildMatchupScheduleSnapshot(input: BuildMatchupScheduleSnapshotInput): MatchupScheduleSnapshotPayload {
  const position = normalizePosition(String(input.position));
  if (!position) throw new Error(`Unsupported matchup schedule position: ${input.position}`);
  const rows = normalizeMatchupScheduleRows(input);
  const sourceVersion = cleanVersion(input.sourceVersion);
  const fetchedAt = parseDate(input.fetchedAt) || new Date().toISOString();
  const refreshPolicy = getMatchupScheduleRefreshPolicy(new Date(fetchedAt));
  const expiresAt = parseDate(input.expiresAt) || addHours(fetchedAt, refreshPolicy.refreshCadenceHours);
  const payloadBase = {
    rows,
    sourceVersion,
    parserVersion: input.parserVersion || 1,
  };

  return {
    schemaVersion: 1,
    sourceKey: getMatchupScheduleSourceKey({ source: input.source, season: input.season, position }),
    snapshotKey: getMatchupScheduleSnapshotKey(input),
    source: input.source,
    season: String(input.season),
    position,
    sourceVersion,
    fetchedAt,
    refreshCadenceHours: refreshPolicy.refreshCadenceHours,
    expiresAt,
    rowCount: rows.length,
    checksum: stableChecksum(payloadBase),
    parserVersion: input.parserVersion || 1,
    rows,
  };
}

export function getMatchupScheduleSnapshotFreshness(
  snapshot: MatchupScheduleSnapshotPayload | null | undefined,
  now = new Date()
): MatchupScheduleSnapshotFreshness {
  const policy = getMatchupScheduleRefreshPolicy(now);
  if (!snapshot) {
    return {
      status: 'expired',
      phase: policy.phase,
      refreshCadenceHours: policy.refreshCadenceHours,
      ageHours: null,
      expiresAt: null,
      note: 'No matchup/SOS snapshot is stored; keep matchup-driven reads suppressed.',
    };
  }
  const fetchedAt = new Date(snapshot.fetchedAt);
  const ageHours = Number.isFinite(fetchedAt.getTime())
    ? Math.round(((now.getTime() - fetchedAt.getTime()) / (60 * 60 * 1000)) * 10) / 10
    : null;
  const expiresAt = snapshot.expiresAt || addHours(snapshot.fetchedAt, snapshot.refreshCadenceHours || policy.refreshCadenceHours);
  const expired = new Date(expiresAt).getTime() <= now.getTime();
  const stale = ageHours !== null && ageHours > (snapshot.refreshCadenceHours || policy.refreshCadenceHours) * 0.75;
  const status: MatchupScheduleSnapshotFreshness['status'] = expired ? 'expired' : stale ? 'stale' : 'fresh';
  return {
    status,
    phase: policy.phase,
    refreshCadenceHours: snapshot.refreshCadenceHours || policy.refreshCadenceHours,
    ageHours,
    expiresAt,
    note: status === 'fresh'
      ? 'Stored matchup/SOS snapshot is fresh enough for gated reads.'
      : status === 'stale'
        ? 'Stored matchup/SOS snapshot is approaching expiration; cap confidence until refreshed.'
        : 'Stored matchup/SOS snapshot is expired; suppress matchup-driven reads until a refresh job stores a new version.',
  };
}
