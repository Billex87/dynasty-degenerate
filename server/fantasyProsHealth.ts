import type { SourceHealthEventInput } from './db';
import { getCurrentRankingSeason } from './rankingSeason';

const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_REQUEST_DELAY_MS = 350;

export type FantasyProsEndpointBoard = 'dynasty' | 'redraft' | 'devy' | null;
export type FantasyProsScoring = 'STD' | 'HALF' | 'PPR';
export type FantasyProsWeeklyEcrPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
type FantasyProsEndpointStatus = 'loaded' | 'empty' | 'disabled' | 'error' | 'rate_limited' | 'skipped';

export interface FantasyProsEndpointHealth {
  key: string;
  label: string;
  path: string;
  board: FantasyProsEndpointBoard;
  status: FantasyProsEndpointStatus;
  rowCount: number;
  totalExperts: number | null;
  lastUpdated: string | null;
  publishedAt: string | null;
  durationMs: number;
  error: string | null;
  statusCode: number | null;
  retryAfterMs: number | null;
  skippedReason: string | null;
}

export interface FantasyProsEndpointDefinition {
  key: string;
  label: string;
  path: string;
  board: FantasyProsEndpointBoard;
}

interface FantasyProsHealthOptions {
  season?: string;
  scoring?: FantasyProsScoring;
  includeProjections?: boolean;
  includeExpanded?: boolean;
  includeTargets?: boolean;
  includeArticles?: boolean;
  currentWeek?: number;
  weekWindow?: number;
  weeklyEcrPositions?: FantasyProsWeeklyEcrPosition[];
  timeoutMs?: number;
  requestDelayMs?: number;
  stopOnRateLimit?: boolean;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
}

function getFantasyProsApiKey(): string | null {
  return process.env.FANTASYPROS_API_KEY || null;
}

function countRows(payload: unknown): number {
  if (!payload || typeof payload !== 'object') return 0;
  if (Array.isArray(payload)) return payload.length;
  const record = payload as Record<string, unknown>;
  for (const key of ['players', 'news', 'articles', 'items', 'injuries', 'projections', 'data']) {
    if (Array.isArray(record[key])) return record[key].length;
  }
  if (record.rankings && typeof record.rankings === 'object') return countNestedRows(record.rankings);
  return 0;
}

function countNestedRows(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.length;
  let total = 0;
  for (const child of Object.values(value as Record<string, unknown>)) {
    total += countNestedRows(child);
  }
  return total;
}

function numberField(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getLastUpdated(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  return stringField(record.last_updated)
    || stringField(record.lastUpdated)
    || stringField(record.updated_at)
    || stringField(record.updated)
    || null;
}

function getPublishedAt(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  return stringField(record.published_at)
    || stringField(record.publishedAt)
    || stringField(record.publication_date)
    || stringField(record.publicationDate)
    || getLastUpdated(payload);
}

function getTotalExperts(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  return numberField(record.total_experts) || numberField(record.totalExperts);
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const retryDateMs = Date.parse(value);
  if (!Number.isFinite(retryDateMs)) return null;
  return Math.max(0, retryDateMs - Date.now());
}

function clampDelayMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_REQUEST_DELAY_MS;
  return Math.max(0, Math.min(30000, Math.floor(parsed)));
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function clampWeek(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(18, Math.floor(parsed)));
}

function clampWeekWindow(value: unknown, fallback = 3): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(6, Math.floor(parsed)));
}

export function getFantasyProsRollingWeeks(currentWeek?: number, weekWindow?: number): number[] {
  const startWeek = clampWeek(currentWeek, 1);
  const count = clampWeekWindow(weekWindow, 3);
  return Array.from({ length: count }, (_, index) => startWeek + index)
    .filter((week) => week <= 18);
}

const DEFAULT_WEEKLY_ECR_POSITIONS: FantasyProsWeeklyEcrPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

function getWeeklyEcrPositions(positions?: FantasyProsWeeklyEcrPosition[]): FantasyProsWeeklyEcrPosition[] {
  const normalized = (positions || DEFAULT_WEEKLY_ECR_POSITIONS)
    .map((position) => String(position || '').trim().toUpperCase())
    .filter((position): position is FantasyProsWeeklyEcrPosition =>
      position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE' || position === 'K' || position === 'DST'
    );
  return normalized.length ? Array.from(new Set(normalized)) : DEFAULT_WEEKLY_ECR_POSITIONS;
}

function getEndpointDefinitions(
  season: string,
  scoring: string,
  includeProjections: boolean,
  includeExpanded: boolean,
  includeTargets: boolean,
  includeArticles: boolean,
  currentWeek?: number,
  weekWindow?: number,
  weeklyEcrPositions?: FantasyProsWeeklyEcrPosition[],
): FantasyProsEndpointDefinition[] {
  const rankingEndpoint = (type: string, board: FantasyProsEndpointBoard, week = '0'): FantasyProsEndpointDefinition => ({
    key: `fantasypros-${type.toLowerCase()}`,
    label: `FantasyPros ${type}`,
    board,
    path: `/NFL/${season}/consensus-rankings?${new URLSearchParams({
      position: 'ALL',
      type,
      scoring,
      week,
    }).toString()}`,
  });
  const weeklyEcrEndpoint = (position: string, week: number, keySuffix?: string): FantasyProsEndpointDefinition => ({
    key: keySuffix || `fantasypros-weekly-ecr-${position.toLowerCase()}-week-${week}`,
    label: `FantasyPros Weekly ECR ${position} Week ${week}`,
    board: 'redraft',
    path: `/nfl/${season}/consensus-rankings?${new URLSearchParams({
      position,
      scoring,
      week: String(week),
    }).toString()}`,
  });

  const endpoints: FantasyProsEndpointDefinition[] = [
    rankingEndpoint('DRAFT', 'redraft'),
    rankingEndpoint('ROS', 'redraft'),
    rankingEndpoint('DYNASTY', 'dynasty'),
    rankingEndpoint('DEVY', 'devy'),
    rankingEndpoint('ROOKIES', 'devy'),
    rankingEndpoint('ADP', 'redraft'),
    rankingEndpoint('DYNADP', 'dynasty'),
    rankingEndpoint('RKADP', 'devy'),
    { key: 'fantasypros-players', label: 'FantasyPros Players', board: null, path: '/NFL/players' },
    { key: 'fantasypros-news', label: 'FantasyPros News', board: null, path: '/NFL/news?limit=25' },
    { key: 'fantasypros-injuries', label: 'FantasyPros Injuries', board: 'redraft', path: '/NFL/injuries?week=0' },
    { key: 'fantasypros-player-points', label: 'FantasyPros Player Points', board: 'redraft', path: `/nfl/${season}/player-points?position=ALL&scoring=${encodeURIComponent(scoring)}` },
  ];

  if (includeExpanded) {
    const rollingWeeks = getFantasyProsRollingWeeks(currentWeek, weekWindow);
    const startWeek = rollingWeeks[0] || 1;
    const weeklyEcrEndpoints = rollingWeeks.flatMap((week) =>
      getWeeklyEcrPositions(weeklyEcrPositions).map((position) => weeklyEcrEndpoint(position, week))
    );
    endpoints.push(
      weeklyEcrEndpoint('QB', startWeek, 'fantasypros-weekly-ecr'),
      rankingEndpoint('WW', 'redraft', String(startWeek)),
      ...weeklyEcrEndpoints,
      {
        key: 'fantasypros-compare-players',
        label: 'FantasyPros Compare Players',
        board: 'redraft',
        path: `/nfl/compare-players?${new URLSearchParams({
          players: '9016:9020',
          position: 'WR',
          ranking_type: 'weekly',
          details: 'players',
        }).toString()}`,
      },
    );

    if (includeTargets) {
      endpoints.push({ key: 'fantasypros-targets', label: 'FantasyPros Targets', board: 'redraft', path: `/nfl/${season}/targets` });
    }

    if (includeArticles) {
      endpoints.push({ key: 'fantasypros-articles', label: 'FantasyPros Articles', board: null, path: '/nfl/articles' });
    }
  }

  if (includeProjections) {
    endpoints.push({
      key: 'fantasypros-projections',
      label: 'FantasyPros Projections',
      board: 'redraft',
      path: `/nfl/${season}/projections?position=ALL&week=0&scoring=${encodeURIComponent(scoring)}`,
    });
  }

  return endpoints;
}

export function getFantasyProsEndpointDefinitions(options: {
  season: string;
  scoring: FantasyProsScoring;
  includeProjections?: boolean;
  includeExpanded?: boolean;
  includeTargets?: boolean;
  includeArticles?: boolean;
  currentWeek?: number;
  weekWindow?: number;
  weeklyEcrPositions?: FantasyProsWeeklyEcrPosition[];
}): FantasyProsEndpointDefinition[] {
  return getEndpointDefinitions(
    options.season,
    options.scoring,
    Boolean(options.includeProjections),
    Boolean(options.includeExpanded),
    Boolean(options.includeTargets),
    Boolean(options.includeArticles),
    options.currentWeek,
    options.weekWindow,
    options.weeklyEcrPositions,
  );
}

async function fetchEndpointHealth(
  endpoint: FantasyProsEndpointDefinition,
  input: {
    apiKey: string;
    fetchImpl: typeof fetch;
    timeoutMs: number;
  },
): Promise<FantasyProsEndpointHealth> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await input.fetchImpl(`${FANTASYPROS_BASE_URL}${endpoint.path}`, {
      headers: { 'x-api-key': input.apiKey },
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        ...endpoint,
        status: response.status === 429 ? 'rate_limited' : 'error',
        rowCount: 0,
        totalExperts: null,
        lastUpdated: null,
        publishedAt: null,
        durationMs,
        statusCode: response.status,
        retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')),
        skippedReason: null,
        error: response.statusText || `HTTP ${response.status}`,
      };
    }

    const payload = await response.json();
    const rowCount = countRows(payload);
    return {
      ...endpoint,
      status: rowCount > 0 ? 'loaded' : 'empty',
      rowCount,
      totalExperts: getTotalExperts(payload),
      lastUpdated: getLastUpdated(payload),
      publishedAt: getPublishedAt(payload),
      durationMs,
      statusCode: response.status,
      retryAfterMs: null,
      skippedReason: null,
      error: null,
    };
  } catch (error) {
    return {
      ...endpoint,
      status: 'error',
      rowCount: 0,
      totalExperts: null,
      lastUpdated: null,
      publishedAt: null,
      durationMs: Date.now() - startedAt,
      statusCode: null,
      retryAfterMs: null,
      skippedReason: null,
      error: error instanceof Error ? error.message : String(error || 'Unknown error'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildSkippedEndpointHealth(endpoint: FantasyProsEndpointDefinition, skippedReason: string): FantasyProsEndpointHealth {
  return {
    ...endpoint,
    status: 'skipped',
    rowCount: 0,
    totalExperts: null,
    lastUpdated: null,
    publishedAt: null,
    durationMs: 0,
    statusCode: null,
    retryAfterMs: null,
    skippedReason,
    error: skippedReason,
  };
}

export async function checkFantasyProsApiHealth(options: FantasyProsHealthOptions = {}): Promise<FantasyProsEndpointHealth[]> {
  const season = options.season || getCurrentRankingSeason();
  const scoring = options.scoring || 'PPR';
  const endpoints = getFantasyProsEndpointDefinitions({
    season,
    scoring,
    includeProjections: options.includeProjections,
    includeExpanded: options.includeExpanded,
    includeTargets: options.includeTargets,
    includeArticles: options.includeArticles,
    currentWeek: options.currentWeek,
    weekWindow: options.weekWindow,
    weeklyEcrPositions: options.weeklyEcrPositions,
  });
  const apiKey = options.apiKey ?? getFantasyProsApiKey();
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Math.max(1000, Math.min(30000, Math.floor(options.timeoutMs || DEFAULT_TIMEOUT_MS)));
  const requestDelayMs = clampDelayMs(options.requestDelayMs);
  const stopOnRateLimit = options.stopOnRateLimit !== false;

  if (!apiKey) {
    return [{
      key: 'fantasypros-api-key',
      label: 'FantasyPros API Key',
      path: '',
      board: null,
      status: 'disabled',
      rowCount: 0,
      totalExperts: null,
      lastUpdated: null,
      publishedAt: null,
      durationMs: 0,
      statusCode: null,
      retryAfterMs: null,
      skippedReason: null,
      error: 'FANTASYPROS_API_KEY is not configured.',
    }];
  }

  const results: FantasyProsEndpointHealth[] = [];
  let stoppedReason: string | null = null;
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    if (stoppedReason) {
      results.push(buildSkippedEndpointHealth(endpoint, stoppedReason));
      continue;
    }

    const result = await fetchEndpointHealth(endpoint, { apiKey, fetchImpl, timeoutMs });
    results.push(result);

    if (result.status === 'rate_limited' && stopOnRateLimit) {
      const retryCopy = result.retryAfterMs ? ` Retry after ${Math.ceil(result.retryAfterMs / 1000)}s.` : '';
      stoppedReason = `${result.label} hit FantasyPros rate limits.${retryCopy}`;
      continue;
    }

    if (index < endpoints.length - 1) await delay(requestDelayMs);
  }
  return results;
}

function healthLevel(status: FantasyProsEndpointStatus): SourceHealthEventInput['level'] {
  if (status === 'loaded') return 'info';
  if (status === 'empty' || status === 'disabled' || status === 'skipped') return 'warn';
  return 'danger';
}

function healthMessage(health: FantasyProsEndpointHealth): string {
  if (health.status === 'disabled') return health.error || 'FantasyPros API key is not configured.';
  if (health.status === 'skipped') return health.skippedReason || health.error || `${health.label} was skipped.`;
  if (health.status === 'rate_limited') {
    const retryCopy = health.retryAfterMs ? ` Retry after ${Math.ceil(health.retryAfterMs / 1000)}s.` : '';
    return `${health.label} failed with HTTP 429: ${health.error || 'rate limited'}.${retryCopy}`;
  }
  if (health.status === 'error') return `${health.label} failed${health.statusCode ? ` with HTTP ${health.statusCode}` : ''}: ${health.error || 'unknown error'}.`;
  if (health.status === 'empty') return `${health.label} returned no rows.`;

  const parts = [
    `${health.label} loaded ${health.rowCount.toLocaleString('en-US')} row${health.rowCount === 1 ? '' : 's'}.`,
    health.totalExperts ? `${health.totalExperts} experts.` : null,
    health.lastUpdated ? `Updated ${health.lastUpdated}.` : null,
    health.publishedAt && health.publishedAt !== health.lastUpdated ? `Published ${health.publishedAt}.` : null,
  ];
  return parts.filter(Boolean).join(' ');
}

export function buildFantasyProsSourceHealthEvents(healthRows: FantasyProsEndpointHealth[]): SourceHealthEventInput[] {
  return healthRows.map((health) => ({
    job: 'fantasypros-api-health',
    board: health.board,
    sourceKey: health.key,
    source: health.label,
    level: healthLevel(health.status),
    status: health.status,
    rowCount: health.rowCount,
    message: healthMessage(health),
    payload: {
      statusCode: health.statusCode,
      totalExperts: health.totalExperts,
      lastUpdated: health.lastUpdated,
      publishedAt: health.publishedAt,
      durationMs: health.durationMs,
      error: health.error,
      retryAfterMs: health.retryAfterMs,
      skippedReason: health.skippedReason,
    },
  }));
}
