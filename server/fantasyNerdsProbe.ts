export type FantasyNerdsPackageProbeCategory =
  | 'player-reference'
  | 'team-reference'
  | 'rankings'
  | 'adp'
  | 'projections';

export type FantasyNerdsPackageProbeDefinition = {
  id: string;
  label: string;
  category: FantasyNerdsPackageProbeCategory;
  path: string;
  params?: Record<string, string | number | null | undefined>;
  coverageTerms: string[];
  note: string;
  normalReportLoadAllowed: false;
};

export type FantasyNerdsPackageProbeStatus =
  | 'missing_config'
  | 'loaded'
  | 'empty'
  | 'credentials_required'
  | 'credential_rejected'
  | 'rate_limited'
  | 'api_error'
  | 'http_error'
  | 'network_error'
  | 'timeout';

export type FantasyNerdsPackageProbeResult = {
  id: string;
  label: string;
  category: FantasyNerdsPackageProbeCategory;
  path: string;
  status: FantasyNerdsPackageProbeStatus;
  httpStatus: number | null;
  rows: number | null;
  shape: string | null;
  bytes: number;
  durationMs: number;
  credentialConfigured: boolean;
  usesTestKey: boolean;
  sourceSeason: string | null;
  freshnessTimestamp: string | null;
  currentSeasonRows: boolean;
  nonTestRows: boolean;
  currentSeasonNonTestRows: boolean;
  coverage: string[];
  note: string;
};

export type FantasyNerdsPackageProbeSummary = {
  expectedSeason: string;
  credentialConfigured: boolean;
  usesTestKey: boolean;
  loadedEndpoints: number;
  currentSeasonNonTestRowsConfirmed: boolean;
  gateStatus: 'blocked' | 'research';
  blockedReasons: string[];
};

const FANTASY_NERDS_BASE_URL = 'https://api.fantasynerds.com/v1/nfl';
const FANTASY_NERDS_CREDENTIAL_ENVS = ['FANTASY_NERDS_API_KEY', 'FANTASYNERDS_API_KEY'];

export const FANTASY_NERDS_PACKAGE_PROBES: FantasyNerdsPackageProbeDefinition[] = [
  {
    id: 'fantasy-nerds-players',
    label: 'Fantasy Nerds Players',
    category: 'player-reference',
    path: '/players',
    params: { include_inactive: 1 },
    coverageTerms: ['playerId', 'displayName', 'position', 'team'],
    note: 'Player-reference probe for provider-to-Sleeper mapping coverage.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'fantasy-nerds-teams',
    label: 'Fantasy Nerds Teams',
    category: 'team-reference',
    path: '/teams',
    coverageTerms: ['code', 'team', 'city', 'name'],
    note: 'Team-reference probe for schedule/projection team-code mapping.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'fantasy-nerds-draft-rankings',
    label: 'Fantasy Nerds Draft Rankings',
    category: 'rankings',
    path: '/draft-rankings',
    params: { format: 'ppr' },
    coverageTerms: ['rank', 'position', 'team', 'players'],
    note: 'Redraft ranking row proof candidate; existing loaders can consume only after source gate evidence passes.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'fantasy-nerds-adp',
    label: 'Fantasy Nerds ADP',
    category: 'adp',
    path: '/adp',
    params: { teams: 12, format: 'ppr' },
    coverageTerms: ['pick', 'adp', 'position', 'players'],
    note: 'ADP row proof candidate for redraft value support; not a normal report-load source.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'fantasy-nerds-dynasty',
    label: 'Fantasy Nerds Dynasty Rankings',
    category: 'rankings',
    path: '/dynasty',
    coverageTerms: ['rank', 'position', 'team', 'players'],
    note: 'Dynasty ranking row proof candidate; stale seasons must stay out of production blends.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'fantasy-nerds-draft-projections',
    label: 'Fantasy Nerds Draft Projections',
    category: 'projections',
    path: '/draft-projections',
    coverageTerms: ['projected', 'fantasy', 'points', 'players'],
    note: 'Draft projection row proof candidate; public projection claims remain legal/source gated.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'fantasy-nerds-weekly-projections',
    label: 'Fantasy Nerds Weekly Projections',
    category: 'projections',
    path: '/weekly-projections',
    coverageTerms: ['projected', 'fantasy', 'points', 'players'],
    note: 'Weekly projection row proof candidate; use only for cron/admin metadata checks until approved.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'fantasy-nerds-weekly-rankings',
    label: 'Fantasy Nerds Weekly Rankings',
    category: 'rankings',
    path: '/weekly-rankings',
    params: { format: 'ppr' },
    coverageTerms: ['rank', 'projected', 'points', 'players'],
    note: 'Weekly ranking row proof candidate for in-season freshness checks.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'fantasy-nerds-ros',
    label: 'Fantasy Nerds Rest of Season Projections',
    category: 'projections',
    path: '/ros',
    coverageTerms: ['projected', 'fantasy', 'points', 'players'],
    note: 'Rest-of-season projection row proof candidate; keep public claims blocked until terms and attribution pass.',
    normalReportLoadAllowed: false,
  },
];

function pickFantasyNerdsCredential(env: Record<string, string | undefined>): string | null {
  for (const name of FANTASY_NERDS_CREDENTIAL_ENVS) {
    const value = String(env[name] || '').trim();
    if (value) return value;
  }
  return null;
}

export function resolveFantasyNerdsProbeCredential(env: Record<string, string | undefined> = process.env) {
  const value = pickFantasyNerdsCredential(env);
  return {
    configured: Boolean(value),
    value,
    usesTestKey: /^TEST$/i.test(value || ''),
    envNames: FANTASY_NERDS_CREDENTIAL_ENVS,
  };
}

function buildProbePath(probe: FantasyNerdsPackageProbeDefinition): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(probe.params || {})) {
    if (value !== null && value !== undefined && String(value) !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return `${probe.path}${query ? `?${query}` : ''}`;
}

function buildProbeUrl(probe: FantasyNerdsPackageProbeDefinition, apiKey: string): string {
  const url = new URL(`${FANTASY_NERDS_BASE_URL}${probe.path}`);
  url.searchParams.set('apikey', apiKey);
  for (const [key, value] of Object.entries(probe.params || {})) {
    if (value !== null && value !== undefined && String(value) !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function countNestedRows(value: unknown, depth = 0): number {
  if (depth > 4 || !value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.length;

  let total = 0;
  for (const child of Object.values(value as Record<string, unknown>)) {
    total += countNestedRows(child, depth + 1);
  }
  return total;
}

function summarizeRows(payload: unknown): { rows: number | null; shape: string | null } {
  if (!payload || typeof payload !== 'object') return { rows: null, shape: null };
  if (Array.isArray(payload)) return { rows: payload.length, shape: 'array' };

  const record = payload as Record<string, unknown>;
  for (const key of ['players', 'teams', 'rankings', 'projections', 'data', 'items', 'results', 'news', 'games']) {
    if (Array.isArray(record[key])) return { rows: record[key].length, shape: key };
    if (record[key] && typeof record[key] === 'object') {
      const nestedRows = countNestedRows(record[key]);
      if (nestedRows > 0) return { rows: nestedRows, shape: key };
    }
  }

  return { rows: null, shape: 'object' };
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function findFreshnessTimestamp(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  return stringField(record.lastUpdated)
    || stringField(record.last_updated)
    || stringField(record.updatedAt)
    || stringField(record.updated_at)
    || stringField(record.publishedAt)
    || stringField(record.published_at)
    || null;
}

function numberField(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findSeason(payload: unknown, depth = 0): string | null {
  if (depth > 4 || !payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload)) {
    for (const row of payload.slice(0, 10)) {
      const season = findSeason(row, depth + 1);
      if (season) return season;
    }
    return null;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ['season', 'Season', 'year', 'Year']) {
    const numeric = numberField(record[key]);
    if (numeric && numeric >= 2000 && numeric <= 2100) return String(Math.trunc(numeric));
  }

  for (const child of Object.values(record).slice(0, 20)) {
    const season = findSeason(child, depth + 1);
    if (season) return season;
  }
  return null;
}

function getFantasyNerdsErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const error = stringField(record.Error) || stringField(record.error) || stringField(record.message);
  return error;
}

function matchCoverage(text: string, terms: string[]): string[] {
  const normalized = text.toLowerCase();
  return terms.filter((term) => normalized.includes(term.toLowerCase()));
}

function classifyFantasyNerdsStatus(
  httpStatus: number,
  rows: number | null,
  credentialConfigured: boolean,
  apiErrorMessage: string | null,
): FantasyNerdsPackageProbeStatus {
  if (apiErrorMessage) {
    return /rate|limit/i.test(apiErrorMessage) ? 'rate_limited' : 'api_error';
  }
  if (httpStatus >= 200 && httpStatus < 300) return rows && rows > 0 ? 'loaded' : 'empty';
  if ((httpStatus === 401 || httpStatus === 403) && credentialConfigured) return 'credential_rejected';
  if (httpStatus === 401 || httpStatus === 403) return 'credentials_required';
  return 'http_error';
}

function createBaseResult(
  probe: FantasyNerdsPackageProbeDefinition,
  credentialConfigured: boolean,
  usesTestKey: boolean,
): Omit<FantasyNerdsPackageProbeResult, 'status' | 'httpStatus' | 'rows' | 'shape' | 'bytes' | 'durationMs' | 'sourceSeason' | 'freshnessTimestamp' | 'currentSeasonRows' | 'nonTestRows' | 'currentSeasonNonTestRows' | 'coverage' | 'note'> {
  return {
    id: probe.id,
    label: probe.label,
    category: probe.category,
    path: buildProbePath(probe),
    credentialConfigured,
    usesTestKey,
  };
}

export async function runFantasyNerdsPackageProbe(
  probe: FantasyNerdsPackageProbeDefinition,
  options: {
    env?: Record<string, string | undefined>;
    apiKey?: string | null;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    expectedSeason?: string;
  } = {},
): Promise<FantasyNerdsPackageProbeResult> {
  const env = options.env || process.env;
  const apiKey = options.apiKey ?? pickFantasyNerdsCredential(env);
  const credentialConfigured = Boolean(apiKey);
  const usesTestKey = /^TEST$/i.test(apiKey || '');
  const base = createBaseResult(probe, credentialConfigured, usesTestKey);
  const expectedSeason = String(options.expectedSeason || new Date().getFullYear());

  if (!apiKey) {
    return {
      ...base,
      status: 'missing_config',
      httpStatus: null,
      rows: null,
      shape: null,
      bytes: 0,
      durationMs: 0,
      sourceSeason: null,
      freshnessTimestamp: null,
      currentSeasonRows: false,
      nonTestRows: false,
      currentSeasonNonTestRows: false,
      coverage: [],
      note: 'No FANTASY_NERDS_API_KEY or FANTASYNERDS_API_KEY is configured; dev TEST fallback is not production evidence.',
    };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Math.max(1000, Math.min(30000, Math.floor(options.timeoutMs || 12000)));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(buildProbeUrl(probe, apiKey), {
      headers: {
        accept: 'application/json,text/plain,*/*',
        'user-agent': 'dynasty-degenerates/1.0 fantasy-nerds-source-probe',
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    let rows: number | null = null;
    let shape: string | null = response.headers.get('content-type')?.split(';')[0] || null;
    let sourceSeason: string | null = null;
    let freshnessTimestamp: string | null = null;
    let apiErrorMessage: string | null = null;

    try {
      parsed = JSON.parse(text);
      const summary = summarizeRows(parsed);
      rows = summary.rows;
      shape = summary.shape || shape;
      sourceSeason = findSeason(parsed);
      freshnessTimestamp = findFreshnessTimestamp(parsed);
      apiErrorMessage = getFantasyNerdsErrorMessage(parsed);
    } catch {
      // Keep text/html or malformed responses as metadata-only HTTP evidence.
    }

    const currentSeasonRows = Boolean(rows && rows > 0 && sourceSeason === expectedSeason);
    const nonTestRows = Boolean(rows && rows > 0 && !usesTestKey);
    return {
      ...base,
      status: classifyFantasyNerdsStatus(response.status, rows, credentialConfigured, apiErrorMessage),
      httpStatus: response.status,
      rows,
      shape,
      bytes: Buffer.byteLength(text),
      durationMs: Date.now() - startedAt,
      sourceSeason,
      freshnessTimestamp,
      currentSeasonRows,
      nonTestRows,
      currentSeasonNonTestRows: currentSeasonRows && nonTestRows,
      coverage: matchCoverage(text, probe.coverageTerms),
      note: apiErrorMessage || probe.note,
    };
  } catch (error) {
    return {
      ...base,
      status: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
      httpStatus: null,
      rows: null,
      shape: null,
      bytes: 0,
      durationMs: Date.now() - startedAt,
      sourceSeason: null,
      freshnessTimestamp: null,
      currentSeasonRows: false,
      nonTestRows: false,
      currentSeasonNonTestRows: false,
      coverage: [],
      note: error instanceof Error ? error.message : String(error || probe.note),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function summarizeFantasyNerdsPackageProbeResults(
  results: FantasyNerdsPackageProbeResult[],
  options: { expectedSeason?: string } = {},
): FantasyNerdsPackageProbeSummary {
  const expectedSeason = String(options.expectedSeason || new Date().getFullYear());
  const credentialConfigured = results.some((result) => result.credentialConfigured);
  const usesTestKey = results.some((result) => result.usesTestKey);
  const loadedEndpoints = results.filter((result) => result.status === 'loaded').length;
  const currentSeasonNonTestRowsConfirmed = results.some((result) => result.currentSeasonNonTestRows);
  const blockedReasons: string[] = [];

  if (!credentialConfigured) {
    blockedReasons.push('No Fantasy Nerds API key is configured for this probe.');
  }
  if (usesTestKey) {
    blockedReasons.push('TEST payloads are allowed for development diagnostics only and do not prove production package access.');
  }
  if (!currentSeasonNonTestRowsConfirmed) {
    blockedReasons.push(`No endpoint proved non-TEST rows with source season ${expectedSeason}.`);
  }
  if (results.some((result) => result.status === 'credential_rejected' || result.status === 'credentials_required')) {
    blockedReasons.push('At least one endpoint rejected or required credentials.');
  }
  if (results.some((result) => result.status === 'rate_limited')) {
    blockedReasons.push('At least one endpoint reported a rate-limit error node.');
  }

  return {
    expectedSeason,
    credentialConfigured,
    usesTestKey,
    loadedEndpoints,
    currentSeasonNonTestRowsConfirmed,
    gateStatus: currentSeasonNonTestRowsConfirmed && !usesTestKey ? 'research' : 'blocked',
    blockedReasons,
  };
}
