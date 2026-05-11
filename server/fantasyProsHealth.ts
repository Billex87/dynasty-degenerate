import type { SourceHealthEventInput } from './db';

const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';
const DEFAULT_TIMEOUT_MS = 8000;

type FantasyProsEndpointBoard = 'dynasty' | 'redraft' | 'devy' | null;
type FantasyProsEndpointStatus = 'loaded' | 'empty' | 'disabled' | 'error';

export interface FantasyProsEndpointHealth {
  key: string;
  label: string;
  path: string;
  board: FantasyProsEndpointBoard;
  status: FantasyProsEndpointStatus;
  rowCount: number;
  totalExperts: number | null;
  lastUpdated: string | null;
  durationMs: number;
  error: string | null;
  statusCode: number | null;
}

interface FantasyProsEndpointDefinition {
  key: string;
  label: string;
  path: string;
  board: FantasyProsEndpointBoard;
}

interface FantasyProsHealthOptions {
  season?: string;
  scoring?: 'STD' | 'HALF' | 'PPR';
  includeProjections?: boolean;
  timeoutMs?: number;
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
  for (const key of ['players', 'news', 'articles', 'items', 'injuries']) {
    if (Array.isArray(record[key])) return record[key].length;
  }
  return 0;
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

function getTotalExperts(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  return numberField(record.total_experts) || numberField(record.totalExperts);
}

function getEndpointDefinitions(season: string, scoring: string, includeProjections: boolean): FantasyProsEndpointDefinition[] {
  const rankingEndpoint = (type: string, board: FantasyProsEndpointBoard): FantasyProsEndpointDefinition => ({
    key: `fantasypros-${type.toLowerCase()}`,
    label: `FantasyPros ${type}`,
    board,
    path: `/NFL/${season}/consensus-rankings?${new URLSearchParams({
      position: 'ALL',
      type,
      scoring,
      week: '0',
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
        status: 'error',
        rowCount: 0,
        totalExperts: null,
        lastUpdated: null,
        durationMs,
        statusCode: response.status,
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
      durationMs,
      statusCode: response.status,
      error: null,
    };
  } catch (error) {
    return {
      ...endpoint,
      status: 'error',
      rowCount: 0,
      totalExperts: null,
      lastUpdated: null,
      durationMs: Date.now() - startedAt,
      statusCode: null,
      error: error instanceof Error ? error.message : String(error || 'Unknown error'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkFantasyProsApiHealth(options: FantasyProsHealthOptions = {}): Promise<FantasyProsEndpointHealth[]> {
  const season = options.season || String(new Date().getFullYear());
  const scoring = options.scoring || 'PPR';
  const endpoints = getEndpointDefinitions(season, scoring, Boolean(options.includeProjections));
  const apiKey = options.apiKey ?? getFantasyProsApiKey();
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Math.max(1000, Math.min(30000, Math.floor(options.timeoutMs || DEFAULT_TIMEOUT_MS)));

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
      durationMs: 0,
      statusCode: null,
      error: 'FANTASYPROS_API_KEY is not configured.',
    }];
  }

  const results: FantasyProsEndpointHealth[] = [];
  for (const endpoint of endpoints) {
    results.push(await fetchEndpointHealth(endpoint, { apiKey, fetchImpl, timeoutMs }));
  }
  return results;
}

function healthLevel(status: FantasyProsEndpointStatus): SourceHealthEventInput['level'] {
  if (status === 'loaded') return 'info';
  if (status === 'empty' || status === 'disabled') return 'warn';
  return 'danger';
}

function healthMessage(health: FantasyProsEndpointHealth): string {
  if (health.status === 'disabled') return health.error || 'FantasyPros API key is not configured.';
  if (health.status === 'error') return `${health.label} failed${health.statusCode ? ` with HTTP ${health.statusCode}` : ''}: ${health.error || 'unknown error'}.`;
  if (health.status === 'empty') return `${health.label} returned no rows.`;

  const parts = [
    `${health.label} loaded ${health.rowCount.toLocaleString('en-US')} row${health.rowCount === 1 ? '' : 's'}.`,
    health.totalExperts ? `${health.totalExperts} experts.` : null,
    health.lastUpdated ? `Updated ${health.lastUpdated}.` : null,
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
      durationMs: health.durationMs,
      error: health.error,
    },
  }));
}
