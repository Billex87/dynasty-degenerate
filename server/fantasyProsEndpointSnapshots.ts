import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import {
  getFantasyProsEndpointDefinitions,
  type FantasyProsEndpointBoard,
  type FantasyProsEndpointDefinition,
  type FantasyProsScoring,
  type FantasyProsWeeklyEcrPosition,
} from './fantasyProsHealth';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';
import { getCurrentRankingSeason } from './rankingSeason';

const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_REQUEST_DELAY_MS = 750;
const DEFAULT_RATE_LIMIT_RETRY_DELAY_MS = 5000;
const DEFAULT_RATE_LIMIT_RETRY_ATTEMPTS = 1;
const SNAPSHOT_VERSION = 1;

type FantasyProsEndpointSnapshotStatus = 'loaded' | 'empty' | 'disabled' | 'error' | 'rate_limited' | 'skipped';

export interface FantasyProsEndpointSnapshotPayload {
  version: number;
  source: 'FantasyPros';
  sourceKey: string;
  endpointKey: string;
  endpointLabel: string;
  board: FantasyProsEndpointBoard;
  path: string;
  season: string;
  scoring: FantasyProsScoring;
  fetchedAt: string;
  rowCount: number;
  totalExperts: number | null;
  lastUpdated: string | null;
  publishedAt: string | null;
  statusCode: number;
  data: unknown;
}

export interface FantasyProsEndpointSnapshotResult {
  sourceKey: string;
  endpointKey: string;
  endpointLabel: string;
  board: FantasyProsEndpointBoard;
  path: string;
  season: string;
  scoring: FantasyProsScoring;
  status: FantasyProsEndpointSnapshotStatus;
  rowCount: number;
  totalExperts: number | null;
  lastUpdated: string | null;
  publishedAt: string | null;
  statusCode: number | null;
  retryAfterMs: number | null;
  persisted: boolean;
  error: string | null;
}

interface RefreshOptions {
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
  rateLimitRetryAttempts?: number;
  rateLimitRetryDelayMs?: number;
  stopOnRateLimit?: boolean;
  persistSnapshot?: boolean;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
  now?: Date;
}

function getFantasyProsApiKey(): string | null {
  return process.env.FANTASYPROS_API_KEY || null;
}

export function getFantasyProsEndpointSnapshotSourceKey(input: {
  endpointKey: string;
  season: string;
  scoring: FantasyProsScoring;
}): string {
  return `fantasypros-endpoint-v1:${input.season}:${input.scoring}:${input.endpointKey}`;
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

function clampRateLimitRetryAttempts(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RATE_LIMIT_RETRY_ATTEMPTS;
  return Math.max(0, Math.min(3, Math.floor(parsed)));
}

function clampRateLimitDelayMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RATE_LIMIT_RETRY_DELAY_MS;
  return Math.max(0, Math.min(120000, Math.floor(parsed)));
}

function getRateLimitDelayMs(retryAfterMs: number | null, fallbackMs: number): number {
  if (retryAfterMs !== null && Number.isFinite(retryAfterMs)) {
    return Math.max(0, Math.min(120000, Math.floor(retryAfterMs)));
  }
  return fallbackMs;
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function baseResult(input: {
  endpoint: FantasyProsEndpointDefinition;
  season: string;
  scoring: FantasyProsScoring;
}): Omit<FantasyProsEndpointSnapshotResult, 'status' | 'rowCount' | 'totalExperts' | 'lastUpdated' | 'statusCode' | 'retryAfterMs' | 'persisted' | 'error'> {
  return {
    sourceKey: getFantasyProsEndpointSnapshotSourceKey({
      endpointKey: input.endpoint.key,
      season: input.season,
      scoring: input.scoring,
    }),
    endpointKey: input.endpoint.key,
    endpointLabel: input.endpoint.label,
    board: input.endpoint.board,
    path: input.endpoint.path,
    season: input.season,
    scoring: input.scoring,
    publishedAt: null,
  };
}

function skippedResult(input: {
  endpoint: FantasyProsEndpointDefinition;
  season: string;
  scoring: FantasyProsScoring;
  reason: string;
}): FantasyProsEndpointSnapshotResult {
  return {
    ...baseResult(input),
    status: 'skipped',
    rowCount: 0,
    totalExperts: null,
    lastUpdated: null,
    publishedAt: null,
    statusCode: null,
    retryAfterMs: null,
    persisted: false,
    error: input.reason,
  };
}

async function persistEndpointPayload(input: {
  endpoint: FantasyProsEndpointDefinition;
  season: string;
  scoring: FantasyProsScoring;
  now: Date;
  payload: unknown;
  statusCode: number;
}): Promise<{ persisted: boolean; rowCount: number; totalExperts: number | null; lastUpdated: string | null; publishedAt: string | null }> {
  const rowCount = countRows(input.payload);
  const totalExperts = getTotalExperts(input.payload);
  const lastUpdated = getLastUpdated(input.payload);
  const publishedAt = getPublishedAt(input.payload);
  const sourceKey = getFantasyProsEndpointSnapshotSourceKey({
    endpointKey: input.endpoint.key,
    season: input.season,
    scoring: input.scoring,
  });
  const snapshot: FantasyProsEndpointSnapshotPayload = {
    version: SNAPSHOT_VERSION,
    source: 'FantasyPros',
    sourceKey,
    endpointKey: input.endpoint.key,
    endpointLabel: input.endpoint.label,
    board: input.endpoint.board,
    path: input.endpoint.path,
    season: input.season,
    scoring: input.scoring,
    fetchedAt: input.now.toISOString(),
    rowCount,
    totalExperts,
    lastUpdated,
    publishedAt,
    statusCode: input.statusCode,
    data: input.payload,
  };
  const persisted = await upsertProviderDataSnapshot({
    sourceKey,
    snapshotKey: getProviderSnapshotDateKey(input.now),
    payload: JSON.stringify(snapshot),
  });
  return { persisted, rowCount, totalExperts, lastUpdated, publishedAt };
}

async function fetchEndpointSnapshot(
  endpoint: FantasyProsEndpointDefinition,
  input: {
    apiKey: string;
    fetchImpl: typeof fetch;
    timeoutMs: number;
    persistSnapshot: boolean;
    rateLimitRetryAttempts: number;
    rateLimitRetryDelayMs: number;
    season: string;
    scoring: FantasyProsScoring;
    now: Date;
  },
): Promise<FantasyProsEndpointSnapshotResult> {
  for (let attempt = 0; attempt <= input.rateLimitRetryAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const response = await input.fetchImpl(`${FANTASYPROS_BASE_URL}${endpoint.path}`, {
        headers: { 'x-api-key': input.apiKey },
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
        if (response.status === 429 && attempt < input.rateLimitRetryAttempts) {
          await delay(getRateLimitDelayMs(retryAfterMs, input.rateLimitRetryDelayMs));
          continue;
        }

        return {
          ...baseResult({ endpoint, season: input.season, scoring: input.scoring }),
          status: response.status === 429 ? 'rate_limited' : 'error',
          rowCount: 0,
          totalExperts: null,
          lastUpdated: null,
          publishedAt: null,
          statusCode: response.status,
          retryAfterMs,
          persisted: false,
          error: response.statusText || `HTTP ${response.status}`,
        };
      }

      const payload = await response.json();
      const metadata = input.persistSnapshot
        ? await persistEndpointPayload({
          endpoint,
          season: input.season,
          scoring: input.scoring,
          now: input.now,
          payload,
          statusCode: response.status,
        })
        : {
          persisted: false,
          rowCount: countRows(payload),
          totalExperts: getTotalExperts(payload),
          lastUpdated: getLastUpdated(payload),
          publishedAt: getPublishedAt(payload),
        };

      return {
        ...baseResult({ endpoint, season: input.season, scoring: input.scoring }),
        status: metadata.rowCount > 0 ? 'loaded' : 'empty',
        rowCount: metadata.rowCount,
        totalExperts: metadata.totalExperts,
        lastUpdated: metadata.lastUpdated,
        publishedAt: metadata.publishedAt,
        statusCode: response.status,
        retryAfterMs: null,
        persisted: metadata.persisted,
        error: null,
      };
    } catch (error) {
      return {
        ...baseResult({ endpoint, season: input.season, scoring: input.scoring }),
        status: 'error',
        rowCount: 0,
        totalExperts: null,
        lastUpdated: null,
        publishedAt: null,
        statusCode: null,
        retryAfterMs: null,
        persisted: false,
        error: error instanceof Error ? error.message : String(error || 'Unknown error'),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ...baseResult({ endpoint, season: input.season, scoring: input.scoring }),
    status: 'error',
    rowCount: 0,
    totalExperts: null,
    lastUpdated: null,
    publishedAt: null,
    statusCode: null,
    retryAfterMs: null,
    persisted: false,
    error: 'FantasyPros endpoint snapshot request did not complete.',
  };
}

export async function refreshFantasyProsEndpointSnapshots(options: RefreshOptions = {}): Promise<FantasyProsEndpointSnapshotResult[]> {
  const season = options.season || getCurrentRankingSeason();
  const scoring = options.scoring || 'PPR';
  const apiKey = options.apiKey ?? getFantasyProsApiKey();
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Math.max(1000, Math.min(30000, Math.floor(options.timeoutMs || DEFAULT_TIMEOUT_MS)));
  const requestDelayMs = clampDelayMs(options.requestDelayMs);
  const rateLimitRetryAttempts = clampRateLimitRetryAttempts(options.rateLimitRetryAttempts);
  const rateLimitRetryDelayMs = clampRateLimitDelayMs(options.rateLimitRetryDelayMs);
  const stopOnRateLimit = options.stopOnRateLimit !== false;
  const persistSnapshot = options.persistSnapshot !== false;
  const now = options.now || new Date();
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

  if (!apiKey) {
    return [{
      sourceKey: 'fantasypros-endpoint-v1:api-key',
      endpointKey: 'fantasypros-api-key',
      endpointLabel: 'FantasyPros API Key',
      board: null,
      path: '',
      season,
      scoring,
      status: 'disabled',
      rowCount: 0,
      totalExperts: null,
      lastUpdated: null,
      publishedAt: null,
      statusCode: null,
      retryAfterMs: null,
      persisted: false,
      error: 'FANTASYPROS_API_KEY is not configured.',
    }];
  }

  const results: FantasyProsEndpointSnapshotResult[] = [];
  let stoppedReason: string | null = null;
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    if (stoppedReason) {
      results.push(skippedResult({ endpoint, season, scoring, reason: stoppedReason }));
      continue;
    }

    const result = await fetchEndpointSnapshot(endpoint, {
      apiKey,
      fetchImpl,
      timeoutMs,
      persistSnapshot,
      rateLimitRetryAttempts,
      rateLimitRetryDelayMs,
      season,
      scoring,
      now,
    });
    results.push(result);

    if (result.status === 'rate_limited' && stopOnRateLimit) {
      const retryCopy = result.retryAfterMs ? ` Retry after ${Math.ceil(result.retryAfterMs / 1000)}s.` : '';
      stoppedReason = `${result.endpointLabel} hit FantasyPros rate limits.${retryCopy}`;
      continue;
    }

    if (index < endpoints.length - 1) {
      const nextDelayMs = result.status === 'rate_limited'
        ? Math.max(requestDelayMs, getRateLimitDelayMs(result.retryAfterMs, rateLimitRetryDelayMs))
        : requestDelayMs;
      await delay(nextDelayMs);
    }
  }

  return results;
}

export async function loadFantasyProsEndpointSnapshot(input: {
  endpointKey: string;
  season?: string;
  scoring?: 'STD' | 'HALF' | 'PPR';
}): Promise<FantasyProsEndpointSnapshotPayload | null> {
  const season = input.season || getCurrentRankingSeason();
  const scoring = input.scoring || 'PPR';
  const stored = await findLatestProviderDataSnapshot(getFantasyProsEndpointSnapshotSourceKey({
    endpointKey: input.endpointKey,
    season,
    scoring,
  }));
  return parseProviderSnapshotPayload<FantasyProsEndpointSnapshotPayload>(stored?.payload);
}
