import crypto from 'node:crypto';
import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { normalizeNflTeamCode, type NflTeamCode } from './nflTeamCodes';
import { parseProviderSnapshotPayload } from './providerDataSnapshots';

export type NflScheduleGameStatus = 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'canceled' | 'unknown';
export type NflScheduleSeasonType = 'pre' | 'regular' | 'post' | 'unknown';

export type NflScheduleGameInput = {
  season: string | number;
  week: string | number;
  gameId?: string | number | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  startsAt?: string | Date | null;
  gameStatus?: string | null;
  venue?: string | null;
  neutralSite?: boolean | string | number | null;
  shortRest?: boolean | string | number | null;
  longRest?: boolean | string | number | null;
  travelDistanceBucket?: string | null;
  venueType?: string | null;
  weatherSensitivity?: string | null;
  internationalGame?: boolean | string | number | null;
  divisionGame?: boolean | string | number | null;
  conferenceGame?: boolean | string | number | null;
  projectedPlayoffWeekRelevance?: boolean | string | number | null;
  seasonType?: string | null;
};

export type NflScheduleGame = {
  season: string;
  week: number;
  gameId: string;
  homeTeam: NflTeamCode;
  awayTeam: NflTeamCode;
  startsAt: string | null;
  gameStatus: NflScheduleGameStatus;
  sourceVersion: string;
  source: string;
  sourceUrl: string | null;
  fetchedAt: string;
  publishedAt: string | null;
  seasonType: NflScheduleSeasonType;
  venue: string | null;
  neutralSite: boolean;
  shortRest: boolean;
  longRest: boolean;
  travelDistanceBucket: string | null;
  venueType: string | null;
  weatherSensitivity: string | null;
  internationalGame: boolean;
  divisionGame: boolean;
  conferenceGame: boolean;
  projectedPlayoffWeekRelevance: boolean;
};

export type NflScheduleSnapshotPayload = {
  schemaVersion: 1;
  sourceKey: typeof NFL_SCHEDULE_GAMES_SOURCE_KEY;
  snapshotKey: string;
  source: string;
  sourceUrl: string | null;
  sourceVersion: string;
  fetchedAt: string;
  publishedAt: string | null;
  seasonType: NflScheduleSeasonType;
  rowCount: number;
  checksum: string;
  parserVersion: number;
  rows: NflScheduleGame[];
};

export type NflScheduleSnapshotDiagnostics = {
  status: 'loaded' | 'empty' | 'invalid';
  season: string | null;
  sourceVersion: string | null;
  rowCount: number;
  missingTeamCount: number;
  duplicateGameCount: number;
  checksum: string | null;
  note: string;
};

export type NflScheduleCoverageDiagnostics = {
  status: 'ready' | 'missing-schedule' | 'week-mismatch' | 'team-gap';
  season: string | null;
  scheduleWeeks: number[];
  sleeperWeeks: number[];
  providerProjectionWeeks: number[];
  missingSleeperWeeks: number[];
  missingProviderProjectionWeeks: number[];
  missingTeamCount: number;
  note: string;
};

export type BuildNflScheduleSnapshotInput = {
  season: string | number;
  source: string;
  sourceVersion: string;
  rows: NflScheduleGameInput[];
  sourceUrl?: string | null;
  fetchedAt?: string | Date | null;
  publishedAt?: string | Date | null;
  seasonType?: string | null;
  parserVersion?: number;
};

export type BuildNflScheduleCoverageDiagnosticsInput = {
  snapshot?: NflScheduleSnapshotPayload | null;
  season?: string | number | null;
  sleeperWeeks?: Array<string | number | null | undefined>;
  providerProjectionWeeks?: Array<string | number | null | undefined>;
};

export const NFL_SCHEDULE_GAMES_SOURCE_KEY = 'nfl-schedule-games-v1';

function parseDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeStatus(value?: string | null): NflScheduleGameStatus {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (['scheduled', 'pregame', 'created'].includes(normalized)) return 'scheduled';
  if (['inprogress', 'live', 'halftime'].includes(normalized)) return 'in_progress';
  if (['final', 'complete', 'completed'].includes(normalized)) return 'final';
  if (['postponed', 'delayed'].includes(normalized)) return 'postponed';
  if (['canceled', 'cancelled'].includes(normalized)) return 'canceled';
  return 'unknown';
}

function normalizeSeasonType(value?: string | null): NflScheduleSeasonType {
  const normalized = String(value || '').trim().toLowerCase();
  if (['pre', 'preseason'].includes(normalized)) return 'pre';
  if (['reg', 'regular', 'regularseason', 'regular-season'].includes(normalized)) return 'regular';
  if (['post', 'postseason', 'playoff', 'playoffs'].includes(normalized)) return 'post';
  return 'unknown';
}

function boolValue(value: boolean | string | number | null | undefined): boolean {
  if (typeof value === 'boolean') return value;
  return /^(?:1|true|yes|neutral)$/i.test(String(value || '').trim());
}

function cleanOptionalLabel(value?: string | null): string | null {
  const raw = String(value || '').trim();
  return raw ? raw.toLowerCase().replace(/[^a-z0-9:_ -]/g, '').replace(/\s+/g, '-') : null;
}

function cleanVersion(value: string | number): string {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 40) || 'unversioned';
}

function buildGameId(input: {
  season: string;
  week: number;
  homeTeam: NflTeamCode;
  awayTeam: NflTeamCode;
  startsAt: string | null;
}): string {
  const datePart = input.startsAt ? input.startsAt.slice(0, 10) : 'date-tbd';
  return `${input.season}-${String(input.week).padStart(2, '0')}-${input.awayTeam}-at-${input.homeTeam}-${datePart}`;
}

function stableChecksum(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildNflScheduleSnapshotKey(season: string | number, sourceVersion: string | number): string {
  return `${String(season)}:${cleanVersion(sourceVersion)}`.slice(0, 64);
}

export function normalizeNflScheduleGames(input: BuildNflScheduleSnapshotInput): NflScheduleGame[] {
  const season = String(input.season);
  const sourceVersion = cleanVersion(input.sourceVersion);
  const source = String(input.source || '').trim() || 'Unknown schedule source';
  const fetchedAt = parseDate(input.fetchedAt) || new Date().toISOString();
  const publishedAt = parseDate(input.publishedAt);
  const seasonType = normalizeSeasonType(input.seasonType);
  const seen = new Set<string>();
  const rows: NflScheduleGame[] = [];

  for (const row of input.rows || []) {
    const week = Number(row.week);
    const homeTeam = normalizeNflTeamCode(row.homeTeam);
    const awayTeam = normalizeNflTeamCode(row.awayTeam);
    if (!Number.isInteger(week) || week < 1 || week > 23 || !homeTeam || !awayTeam || homeTeam === awayTeam) continue;
    const startsAt = parseDate(row.startsAt);
    const gameId = String(row.gameId || '').trim() || buildGameId({ season, week, homeTeam, awayTeam, startsAt });
    const key = `${season}:${week}:${gameId}:${sourceVersion}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      season,
      week,
      gameId,
      homeTeam,
      awayTeam,
      startsAt,
      gameStatus: normalizeStatus(row.gameStatus),
      sourceVersion,
      source,
      sourceUrl: input.sourceUrl || null,
      fetchedAt,
      publishedAt,
      seasonType,
      venue: row.venue ? String(row.venue).trim() || null : null,
      neutralSite: boolValue(row.neutralSite),
      shortRest: boolValue(row.shortRest),
      longRest: boolValue(row.longRest),
      travelDistanceBucket: cleanOptionalLabel(row.travelDistanceBucket),
      venueType: cleanOptionalLabel(row.venueType),
      weatherSensitivity: cleanOptionalLabel(row.weatherSensitivity),
      internationalGame: boolValue(row.internationalGame),
      divisionGame: boolValue(row.divisionGame),
      conferenceGame: boolValue(row.conferenceGame),
      projectedPlayoffWeekRelevance: boolValue(row.projectedPlayoffWeekRelevance),
    });
  }

  return rows.sort((a, b) => (
    Number(a.season) - Number(b.season)
    || a.week - b.week
    || (a.startsAt || '').localeCompare(b.startsAt || '')
    || a.gameId.localeCompare(b.gameId)
  ));
}

export function buildNflScheduleSnapshot(input: BuildNflScheduleSnapshotInput): NflScheduleSnapshotPayload {
  const rows = normalizeNflScheduleGames(input);
  const sourceVersion = cleanVersion(input.sourceVersion);
  const payloadBase = {
    rows,
    sourceVersion,
    parserVersion: input.parserVersion || 1,
  };
  const snapshotKey = buildNflScheduleSnapshotKey(input.season, sourceVersion);

  return {
    schemaVersion: 1,
    sourceKey: NFL_SCHEDULE_GAMES_SOURCE_KEY,
    snapshotKey,
    source: String(input.source || '').trim() || 'Unknown schedule source',
    sourceUrl: input.sourceUrl || null,
    sourceVersion,
    fetchedAt: parseDate(input.fetchedAt) || rows[0]?.fetchedAt || new Date().toISOString(),
    publishedAt: parseDate(input.publishedAt),
    seasonType: normalizeSeasonType(input.seasonType),
    rowCount: rows.length,
    checksum: stableChecksum(payloadBase),
    parserVersion: input.parserVersion || 1,
    rows,
  };
}

export function getNflScheduleSnapshotDiagnostics(snapshot?: NflScheduleSnapshotPayload | null): NflScheduleSnapshotDiagnostics {
  if (!snapshot) {
    return {
      status: 'empty',
      season: null,
      sourceVersion: null,
      rowCount: 0,
      missingTeamCount: 32,
      duplicateGameCount: 0,
      checksum: null,
      note: 'No stored normalized NFL schedule snapshot is available; suppress projection-specific game claims.',
    };
  }

  const teams = new Set(snapshot.rows.flatMap((row) => [row.homeTeam, row.awayTeam]));
  const gameKeys = snapshot.rows.map((row) => `${row.season}:${row.week}:${row.gameId}:${row.sourceVersion}`);
  const duplicateGameCount = gameKeys.length - new Set(gameKeys).size;
  const missingTeamCount = Math.max(0, 32 - teams.size);
  const status = snapshot.schemaVersion === 1 && snapshot.rowCount === snapshot.rows.length && duplicateGameCount === 0
    ? 'loaded'
    : 'invalid';

  return {
    status,
    season: snapshot.rows[0]?.season || null,
    sourceVersion: snapshot.sourceVersion,
    rowCount: snapshot.rowCount,
    missingTeamCount,
    duplicateGameCount,
    checksum: snapshot.checksum,
    note: status === 'loaded'
      ? `${snapshot.rowCount} normalized schedule games loaded from ${snapshot.source} version ${snapshot.sourceVersion}.`
      : 'Stored schedule snapshot is invalid; suppress projection-specific game claims.',
  };
}

function normalizeWeeks(values?: Array<string | number | null | undefined>): number[] {
  return Array.from(new Set((values || [])
    .map((value) => Number(value))
    .filter((week) => Number.isInteger(week) && week >= 1 && week <= 23)))
    .sort((a, b) => a - b);
}

function missingWeeks(expected: number[], actual: Set<number>): number[] {
  return expected.filter((week) => !actual.has(week));
}

export function buildNflScheduleCoverageDiagnostics(input: BuildNflScheduleCoverageDiagnosticsInput): NflScheduleCoverageDiagnostics {
  if (!input.snapshot) {
    return {
      status: 'missing-schedule',
      season: input.season ? String(input.season) : null,
      scheduleWeeks: [],
      sleeperWeeks: normalizeWeeks(input.sleeperWeeks),
      providerProjectionWeeks: normalizeWeeks(input.providerProjectionWeeks),
      missingSleeperWeeks: normalizeWeeks(input.sleeperWeeks),
      missingProviderProjectionWeeks: normalizeWeeks(input.providerProjectionWeeks),
      missingTeamCount: 32,
      note: 'No normalized schedule snapshot is loaded; keep bye-week planning and suppress projection-specific week claims.',
    };
  }

  const scheduleWeeks = normalizeWeeks(input.snapshot.rows.map((row) => row.week));
  const scheduleWeekSet = new Set(scheduleWeeks);
  const sleeperWeeks = normalizeWeeks(input.sleeperWeeks);
  const providerProjectionWeeks = normalizeWeeks(input.providerProjectionWeeks);
  const missingSleeperWeeks = missingWeeks(sleeperWeeks, scheduleWeekSet);
  const missingProviderProjectionWeeks = missingWeeks(providerProjectionWeeks, scheduleWeekSet);
  const teams = new Set(input.snapshot.rows.flatMap((row) => [row.homeTeam, row.awayTeam]));
  const missingTeamCount = Math.max(0, 32 - teams.size);
  const hasWeekMismatch = missingSleeperWeeks.length > 0 || missingProviderProjectionWeeks.length > 0;
  const status: NflScheduleCoverageDiagnostics['status'] = hasWeekMismatch
    ? 'week-mismatch'
    : missingTeamCount > 0
      ? 'team-gap'
      : 'ready';

  return {
    status,
    season: input.snapshot.rows[0]?.season || (input.season ? String(input.season) : null),
    scheduleWeeks,
    sleeperWeeks,
    providerProjectionWeeks,
    missingSleeperWeeks,
    missingProviderProjectionWeeks,
    missingTeamCount,
    note: status === 'ready'
      ? 'Stored schedule weeks align with Sleeper and provider projection week inputs.'
      : status === 'week-mismatch'
        ? 'Stored schedule weeks do not cover every Sleeper/provider projection week; suppress projection-specific claims for missing weeks.'
        : 'Stored schedule has team coverage gaps; keep projection joins gated until coverage is complete.',
  };
}

export async function persistNflScheduleSnapshot(snapshot: NflScheduleSnapshotPayload) {
  return upsertProviderDataSnapshot({
    sourceKey: NFL_SCHEDULE_GAMES_SOURCE_KEY,
    snapshotKey: snapshot.snapshotKey,
    payload: JSON.stringify(snapshot),
  });
}

export async function loadLatestNflScheduleSnapshot(): Promise<NflScheduleSnapshotPayload | null> {
  const stored = await findLatestProviderDataSnapshot(NFL_SCHEDULE_GAMES_SOURCE_KEY);
  const parsed = parseProviderSnapshotPayload<NflScheduleSnapshotPayload>(stored?.payload);
  return parsed?.schemaVersion === 1 && Array.isArray(parsed.rows) ? parsed : null;
}
