import type { ScheduleTier } from '../shared/types';
import { recordApiProviderCacheHit, recordApiProviderTelemetryEvent } from './apiProviderTelemetry';
import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { normalizeNflTeamCode } from './nflTeamCodes';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';

export type DraftSharksScheduleStatus = 'disabled' | 'missing_config' | 'loaded' | 'empty' | 'error';

export type DraftSharksSosProfile = {
  team: string;
  position: string;
  seasonSOS: number | null;
  remainingSOS: number | null;
  scheduleTier: ScheduleTier;
  streamerWeeks: number[];
  avoidWeeks: number[];
  weeklyMatchups: DraftSharksWeeklySos[];
  source: string;
  updatedAt: string;
};

export type DraftSharksWeeklySos = {
  week: number;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  matchupPercent: number;
  matchupTier: ScheduleTier;
};

export type DraftSharksScheduleContext = {
  status: DraftSharksScheduleStatus;
  source: string;
  updatedAt: string | null;
  profiles: Record<string, DraftSharksSosProfile>;
  message?: string | null;
};

type DraftSharksFetchOptions = {
  season?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  sourceMode?: 'live' | 'snapshot';
  persistSnapshot?: boolean;
  forceRefresh?: boolean;
};

const PROVIDER = 'DraftSharks';
const SOURCE = 'DraftSharks SOS';
const ENDPOINT = 'partner-sos-feed';
const DRAFTSHARKS_SOS_SNAPSHOT_SOURCE_KEY = 'draftsharks-sos-v1';
const DEFAULT_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

let cachedContext: { expiresAt: number; value: DraftSharksScheduleContext } | null = null;

type DraftSharksScheduleSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  context: DraftSharksScheduleContext;
};

function enabled() {
  return ENABLED_VALUES.has(String(process.env.ENABLE_DRAFTSHARKS_SOS || '').trim().toLowerCase());
}

function normalizeTeam(value: unknown): string | null {
  return normalizeNflTeamCode(value);
}

function normalizePosition(value: unknown): string | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'DST' || normalized === 'D/ST' || normalized === 'DEFENSE') return 'DEF';
  if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(normalized)) return normalized;
  return null;
}

function numberField(value: unknown): number | null {
  const clean = String(value ?? '').replace(/%/g, '').trim();
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
}

function stringField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return null;
}

function normalizeTier(value: unknown, score: number | null): ScheduleTier {
  const label = String(value || '').trim().toLowerCase();
  if (['elite', 'great', 'best', 'green'].includes(label)) return 'elite';
  if (['easy', 'good', 'favorable', 'soft'].includes(label)) return 'easy';
  if (['hard', 'bad', 'difficult', 'tough', 'red'].includes(label)) return 'hard';
  if (score !== null) {
    if (score >= 75) return 'elite';
    if (score >= 58) return 'easy';
    if (score <= 42) return 'hard';
  }
  return 'neutral';
}

function normalizePercentTier(percent: number | null): ScheduleTier {
  if (percent === null) return 'neutral';
  if (percent >= 25) return 'elite';
  if (percent >= 8) return 'easy';
  if (percent <= -8) return 'hard';
  return 'neutral';
}

function normalizeWeeks(value: unknown): number[] {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[,\s|]+/)
      .filter(Boolean);

  return Array.from(new Set(rawValues
    .map((week) => Number(week))
    .filter((week) => Number.isInteger(week) && week >= 1 && week <= 18)))
    .sort((a, b) => a - b);
}

function normalizeHomeAway(value: unknown): DraftSharksWeeklySos['homeAway'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (['home', 'h', 'vs', 'v'].includes(normalized)) return 'home';
  if (['away', 'a', '@', 'at'].includes(normalized)) return 'away';
  if (['neutral', 'n'].includes(normalized)) return 'neutral';
  return null;
}

function getWeeklyField(row: Record<string, unknown>, week: number, suffixes: string[]): unknown {
  const capitalizedSuffixes = suffixes
    .filter(Boolean)
    .map((suffix) => `${suffix[0].toUpperCase()}${suffix.slice(1)}`);
  const keys = [
    `week${week}`,
    `week_${week}`,
    `wk${week}`,
    `wk_${week}`,
    `w${week}`,
    ...suffixes.flatMap((suffix) => [
      `week${week}${suffix}`,
      `week${week}_${suffix}`,
      `week_${week}_${suffix}`,
      `wk${week}${suffix}`,
      `wk${week}_${suffix}`,
      `wk_${week}_${suffix}`,
      `w${week}${suffix}`,
      `w${week}_${suffix}`,
    ]),
    ...capitalizedSuffixes.flatMap((suffix) => [
      `week${week}${suffix}`,
      `wk${week}${suffix}`,
      `w${week}${suffix}`,
    ]),
  ];
  return stringField(row, keys);
}

function parseWeeklyCell(value: unknown): Pick<DraftSharksWeeklySos, 'matchupPercent' | 'opponent' | 'homeAway'> | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (/^bye$/i.test(raw)) return null;
  const percent = numberField(raw.match(/-?\d+(?:\.\d+)?\s*%?/)?.[0] || raw);
  if (percent === null) return null;
  const opponentMatch = raw.match(/(?:^|[\s\n])(@|at|vs\.?|v)?\s*([A-Z]{2,3})(?:\s|$)/i);
  const homeAway = normalizeHomeAway(opponentMatch?.[1] || null);
  return {
    matchupPercent: percent,
    opponent: normalizeTeam(opponentMatch?.[2]) || null,
    homeAway,
  };
}

function normalizeWeeklyMatchupRows(row: Record<string, unknown>): DraftSharksWeeklySos[] {
  const nestedWeeks = stringField(row, ['weeks', 'weekly', 'matchups', 'schedule']);
  const rows = Array.isArray(nestedWeeks)
    ? nestedWeeks.filter((weekRow): weekRow is Record<string, unknown> => Boolean(weekRow && typeof weekRow === 'object'))
    : [];

  if (rows.length) {
    return rows.map((weekRow) => {
      const week = Number(stringField(weekRow, ['week', 'wk', 'w']));
      const percent = numberField(stringField(weekRow, [
        'matchup_percent',
        'matchupPercent',
        'percent',
        'value',
        'score',
        'sos',
      ]));
      if (!Number.isInteger(week) || week < 1 || week > 18 || percent === null) return null;
      return {
        week,
        opponent: normalizeTeam(stringField(weekRow, ['opponent', 'opp', 'defense', 'team'])) || null,
        homeAway: normalizeHomeAway(stringField(weekRow, ['homeAway', 'home_away', 'site'])),
        matchupPercent: percent,
        matchupTier: normalizePercentTier(percent),
      };
    }).filter((weekRow): weekRow is DraftSharksWeeklySos => Boolean(weekRow));
  }

  const weeklyMatchups: DraftSharksWeeklySos[] = [];
  for (let week = 1; week <= 18; week += 1) {
    const cell = parseWeeklyCell(getWeeklyField(row, week, ['', 'percent', 'pct', 'value', 'sos', 'matchup']));
    const explicitPercent = numberField(getWeeklyField(row, week, ['percent', 'pct', 'value', 'sos', 'matchup']));
    const percent = cell?.matchupPercent ?? explicitPercent;
    if (percent === null) continue;
    const opponent = cell?.opponent || normalizeTeam(getWeeklyField(row, week, ['opponent', 'opp', 'team']));
    weeklyMatchups.push({
      week,
      opponent,
      homeAway: cell?.homeAway || normalizeHomeAway(getWeeklyField(row, week, ['homeAway', 'home_away', 'site'])),
      matchupPercent: percent,
      matchupTier: normalizePercentTier(percent),
    });
  }
  return weeklyMatchups;
}

function rowsFromPayload(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'));
  if (!payload || typeof payload !== 'object') return [];
  const objectPayload = payload as Record<string, unknown>;
  for (const key of ['data', 'rows', 'items', 'sos', 'strengthOfSchedule']) {
    const rows = objectPayload[key];
    if (Array.isArray(rows)) return rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'));
  }
  return [];
}

function safeUpdatedAt(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function buildUrl(baseUrl: string, season?: string): string {
  try {
    const url = new URL(baseUrl);
    if (season && !url.searchParams.has('season')) url.searchParams.set('season', season);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export function normalizeDraftSharksSosPayload(payload: unknown): Record<string, DraftSharksSosProfile> {
  const profiles: Record<string, DraftSharksSosProfile> = {};
  for (const row of rowsFromPayload(payload)) {
    const team = normalizeTeam(stringField(row, ['team', 'team_abbr', 'teamAbbr', 'nfl_team', 'nflTeam']));
    const position = normalizePosition(stringField(row, ['position', 'pos', 'fantasy_position', 'fantasyPosition']));
    if (!team || !position) continue;

    const seasonSOS = numberField(stringField(row, [
      'season_sos',
      'seasonSOS',
      'sos',
      'sos_score',
      'sosScore',
      'score',
    ]));
    const remainingSOS = numberField(stringField(row, [
      'remaining_sos',
      'remainingSOS',
      'remaining',
      'remaining_score',
      'remainingScore',
    ]));
    const scheduleTier = normalizeTier(stringField(row, ['tier', 'schedule_tier', 'scheduleTier', 'difficulty']), seasonSOS);
    const streamerWeeks = normalizeWeeks(stringField(row, [
      'streamer_weeks',
      'streamerWeeks',
      'target_weeks',
      'targetWeeks',
      'good_weeks',
      'goodWeeks',
    ]));
    const avoidWeeks = normalizeWeeks(stringField(row, [
      'avoid_weeks',
      'avoidWeeks',
      'hard_weeks',
      'hardWeeks',
      'fade_weeks',
      'fadeWeeks',
    ]));

    profiles[`${team}:${position}`] = {
      team,
      position,
      seasonSOS,
      remainingSOS,
      scheduleTier,
      streamerWeeks,
      avoidWeeks,
      weeklyMatchups: normalizeWeeklyMatchupRows(row),
      source: SOURCE,
      updatedAt: safeUpdatedAt(stringField(row, ['updated_at', 'updatedAt', 'last_updated', 'lastUpdated'])),
    };
  }
  return profiles;
}

function parseDraftSharksScheduleSnapshot(payload?: string | null): DraftSharksScheduleSnapshotPayload | null {
  const parsed = parseProviderSnapshotPayload<Partial<DraftSharksScheduleSnapshotPayload>>(payload);
  if (
    parsed?.schemaVersion !== 1 ||
    typeof parsed.snapshotKey !== 'string' ||
    !parsed.context ||
    typeof parsed.context !== 'object'
  ) {
    return null;
  }

  return parsed as DraftSharksScheduleSnapshotPayload;
}

async function loadStoredDraftSharksScheduleContext(): Promise<DraftSharksScheduleContext> {
  const stored = await findLatestProviderDataSnapshot(DRAFTSHARKS_SOS_SNAPSHOT_SOURCE_KEY);
  const snapshot = parseDraftSharksScheduleSnapshot(stored?.payload);
  if (snapshot?.context) {
    cachedContext = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value: snapshot.context,
    };
    return snapshot.context;
  }

  return {
    status: 'empty',
    source: SOURCE,
    updatedAt: null,
    profiles: {},
    message: 'No stored DraftSharks SOS snapshot is available.',
  };
}

async function persistDraftSharksScheduleSnapshot(context: DraftSharksScheduleContext, now = new Date()) {
  if (context.status !== 'loaded') return;

  const snapshotKey = getProviderSnapshotDateKey(now);
  const payload: DraftSharksScheduleSnapshotPayload = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    snapshotKey,
    context,
  };

  try {
    await upsertProviderDataSnapshot({
      sourceKey: DRAFTSHARKS_SOS_SNAPSHOT_SOURCE_KEY,
      snapshotKey,
      payload: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('[DraftSharks] Failed to persist SOS snapshot:', error);
  }
}

export async function loadDraftSharksScheduleContext(options: DraftSharksFetchOptions = {}): Promise<DraftSharksScheduleContext> {
  if (!enabled()) {
    return {
      status: 'disabled',
      source: SOURCE,
      updatedAt: null,
      profiles: {},
      message: 'DraftSharks SOS is disabled.',
    };
  }

  if (options.sourceMode === 'snapshot') {
    return loadStoredDraftSharksScheduleContext();
  }

  const apiKey = String(process.env.DRAFTSHARKS_API_KEY || '').trim();
  const baseUrl = String(process.env.DRAFTSHARKS_SOS_URL || '').trim();
  if (!apiKey || !baseUrl) {
    return {
      status: 'missing_config',
      source: SOURCE,
      updatedAt: null,
      profiles: {},
      message: 'DraftSharks SOS requires DRAFTSHARKS_API_KEY and DRAFTSHARKS_SOS_URL.',
    };
  }

  if (!options.forceRefresh && cachedContext && cachedContext.expiresAt > Date.now()) {
    recordApiProviderCacheHit({ provider: PROVIDER, endpoint: ENDPOINT, job: 'schedule-sos', scope: 'cron' });
    if (options.persistSnapshot) await persistDraftSharksScheduleSnapshot(cachedContext.value);
    return cachedContext.value;
  }

  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Math.max(1000, Math.min(30000, Math.floor(options.timeoutMs || DEFAULT_TIMEOUT_MS)));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(buildUrl(baseUrl, options.season), {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
      },
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    const payload = await response.json().catch(() => null);
    const profiles = response.ok ? normalizeDraftSharksSosPayload(payload) : {};
    const updatedAt = Object.values(profiles)
      .map((profile) => profile.updatedAt)
      .sort()
      .at(-1) || new Date().toISOString();
    const context: DraftSharksScheduleContext = {
      status: !response.ok ? 'error' : Object.keys(profiles).length ? 'loaded' : 'empty',
      source: SOURCE,
      updatedAt: response.ok ? updatedAt : null,
      profiles,
      message: response.ok ? null : `DraftSharks SOS returned HTTP ${response.status}.`,
    };

    recordApiProviderTelemetryEvent({
      provider: PROVIDER,
      endpoint: ENDPOINT,
      status: response.status,
      ok: response.ok,
      durationMs,
      cacheStatus: 'miss',
      costUnits: 1,
      job: 'schedule-sos',
      scope: 'cron',
      message: context.message,
    });

    if (response.ok) {
      cachedContext = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: context,
      };
      if (options.persistSnapshot) await persistDraftSharksScheduleSnapshot(context);
    }

    return context;
  } catch (error) {
    recordApiProviderTelemetryEvent({
      provider: PROVIDER,
      endpoint: ENDPOINT,
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      cacheStatus: 'miss',
      costUnits: 1,
      job: 'schedule-sos',
      scope: 'cron',
      message: error instanceof Error ? error.message : 'DraftSharks SOS fetch failed.',
    });

    return {
      status: 'error',
      source: SOURCE,
      updatedAt: null,
      profiles: {},
      message: error instanceof Error ? error.message : 'DraftSharks SOS fetch failed.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function getDraftSharksScheduleProfile(
  context: DraftSharksScheduleContext | null | undefined,
  team?: string | null,
  position?: string | null,
): DraftSharksSosProfile | null {
  if (context?.status !== 'loaded') return null;
  const normalizedTeam = normalizeTeam(team);
  const normalizedPosition = normalizePosition(position);
  if (!normalizedTeam || !normalizedPosition) return null;
  return context.profiles[`${normalizedTeam}:${normalizedPosition}`] || null;
}

export function clearDraftSharksScheduleCacheForTests() {
  cachedContext = null;
}
