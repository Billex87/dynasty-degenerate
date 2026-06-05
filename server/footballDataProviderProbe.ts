export type FootballDataProviderProbeCategory =
  | 'players'
  | 'teams'
  | 'schedule'
  | 'injuries'
  | 'depth-charts'
  | 'scoring'
  | 'projections'
  | 'usage-route-fields'
  | 'news';

export type FootballDataProviderProbeDefinition = {
  id: string;
  provider: 'SportsDataIO' | 'FantasyData' | 'SportsDataIO docs';
  target: string;
  category: FootballDataProviderProbeCategory;
  url: string;
  credentialEnv: string[];
  credentialHeader?: string;
  coverageTerms: string[];
  note: string;
  normalReportLoadAllowed: false;
};

export type FootballDataProviderProbeStatus =
  | 'missing_config'
  | 'reachable'
  | 'credentials_required'
  | 'credential_rejected'
  | 'http_error'
  | 'network_error'
  | 'timeout';

export type FootballDataProviderProbeResult = {
  id: string;
  provider: string;
  target: string;
  category: FootballDataProviderProbeCategory;
  status: FootballDataProviderProbeStatus;
  httpStatus: number | null;
  rows: number | null;
  shape: string | null;
  bytes: number;
  durationMs: number;
  credentialConfigured: boolean;
  coverage: string[];
  note: string;
};

const DEFAULT_SEASON = '2026';
const DEFAULT_WEEK = '1';

function url(path: string): string {
  return `https://api.sportsdata.io${path}`;
}

export const FOOTBALL_DATA_PROVIDER_PROBES: FootballDataProviderProbeDefinition[] = [
  {
    id: 'sportsdataio-players',
    provider: 'SportsDataIO',
    target: 'Players',
    category: 'players',
    url: url('/v3/nfl/scores/json/Players'),
    credentialEnv: ['SPORTSDATAIO_API_KEY', 'SPORTSDATA_IO_API_KEY', 'FANTASYDATA_API_KEY'],
    credentialHeader: 'Ocp-Apim-Subscription-Key',
    coverageTerms: ['PlayerID', 'Name', 'Team', 'Position', 'FantasyDataPlayerID'],
    note: 'Player identity and provider-ID mapping candidate.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'sportsdataio-teams',
    provider: 'SportsDataIO',
    target: 'Teams',
    category: 'teams',
    url: url('/v3/nfl/scores/json/Teams'),
    credentialEnv: ['SPORTSDATAIO_API_KEY', 'SPORTSDATA_IO_API_KEY', 'FANTASYDATA_API_KEY'],
    credentialHeader: 'Ocp-Apim-Subscription-Key',
    coverageTerms: ['TeamID', 'Key', 'FullName'],
    note: 'Team-code mapping candidate for schedule/projection joins.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'sportsdataio-schedule',
    provider: 'SportsDataIO',
    target: 'Season schedules',
    category: 'schedule',
    url: url(`/v3/nfl/scores/json/Schedules/${DEFAULT_SEASON}`),
    credentialEnv: ['SPORTSDATAIO_API_KEY', 'SPORTSDATA_IO_API_KEY', 'FANTASYDATA_API_KEY'],
    credentialHeader: 'Ocp-Apim-Subscription-Key',
    coverageTerms: ['GameKey', 'AwayTeam', 'HomeTeam', 'DateTime'],
    note: 'Schedule candidate must remain snapshot-only and versioned.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'sportsdataio-injuries',
    provider: 'SportsDataIO',
    target: 'Injuries',
    category: 'injuries',
    url: url(`/v3/nfl/scores/json/Injuries/${DEFAULT_SEASON}REG/${DEFAULT_WEEK}`),
    credentialEnv: ['SPORTSDATAIO_API_KEY', 'SPORTSDATA_IO_API_KEY', 'FANTASYDATA_API_KEY'],
    credentialHeader: 'Ocp-Apim-Subscription-Key',
    coverageTerms: ['InjuryStatus', 'Practice', 'PlayerID', 'Team'],
    note: 'Injury data requires package validation and freshness windows before confidence models consume it.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'sportsdataio-depth-charts',
    provider: 'SportsDataIO',
    target: 'Depth charts',
    category: 'depth-charts',
    url: url('/v3/nfl/scores/json/DepthCharts'),
    credentialEnv: ['SPORTSDATAIO_API_KEY', 'SPORTSDATA_IO_API_KEY', 'FANTASYDATA_API_KEY'],
    credentialHeader: 'Ocp-Apim-Subscription-Key',
    coverageTerms: ['DepthOrder', 'DepthDisplayOrder', 'Position', 'PlayerID'],
    note: 'Depth-chart role changes must be stored before model use.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'sportsdataio-weekly-projections',
    provider: 'SportsDataIO',
    target: 'Weekly player projections',
    category: 'projections',
    url: url(`/v3/nfl/projections/json/PlayerGameProjectionStatsByWeek/${DEFAULT_SEASON}REG/${DEFAULT_WEEK}`),
    credentialEnv: ['SPORTSDATAIO_API_KEY', 'SPORTSDATA_IO_API_KEY', 'FANTASYDATA_API_KEY'],
    credentialHeader: 'Ocp-Apim-Subscription-Key',
    coverageTerms: ['FantasyPoints', 'PassingYards', 'ReceivingYards', 'RushingYards'],
    note: 'Projection endpoint shape, terms, rate limits, and player mapping must pass before lineup/matchup use.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'sportsdataio-scoring-fields',
    provider: 'SportsDataIO',
    target: 'Fantasy scoring fields',
    category: 'scoring',
    url: url(`/v3/nfl/stats/json/PlayerGameStatsByWeek/${DEFAULT_SEASON}REG/${DEFAULT_WEEK}`),
    credentialEnv: ['SPORTSDATAIO_API_KEY', 'SPORTSDATA_IO_API_KEY', 'FANTASYDATA_API_KEY'],
    credentialHeader: 'Ocp-Apim-Subscription-Key',
    coverageTerms: ['FantasyPoints', 'FantasyPointsPPR', 'DraftKingsSalary', 'FanDuelSalary'],
    note: 'Scoring fields are useful for backtests only after scoring-profile semantics are documented.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'sportsdataio-route-usage-candidate',
    provider: 'SportsDataIO docs',
    target: 'Licensed usage and route-volume fields',
    category: 'usage-route-fields',
    url: 'https://sportsdata.io/developers/workflow-guide/nfl',
    credentialEnv: [],
    coverageTerms: ['Depth Charts', 'Projections', 'Fantasy Points', 'Stats & Points'],
    note: 'Docs metadata only; exact routes, route share, YPRR, and first-read fields stay licensed-source gated until package coverage is confirmed.',
    normalReportLoadAllowed: false,
  },
  {
    id: 'sportsdataio-news',
    provider: 'SportsDataIO',
    target: 'RotoBaller news',
    category: 'news',
    url: url('/v3/nfl/scores/json/News'),
    credentialEnv: ['SPORTSDATAIO_API_KEY', 'SPORTSDATA_IO_API_KEY', 'FANTASYDATA_API_KEY'],
    credentialHeader: 'Ocp-Apim-Subscription-Key',
    coverageTerms: ['Title', 'Content', 'PlayerID', 'Updated'],
    note: 'News package access, rate limits, and player mapping must pass before model use beyond stored news context.',
    normalReportLoadAllowed: false,
  },
];

function pickCredential(env: Record<string, string | undefined>, names: string[]): string | null {
  for (const name of names) {
    const value = String(env[name] || '').trim();
    if (value) return value;
  }
  return null;
}

function summarizeRows(payload: unknown): { rows: number | null; shape: string | null } {
  if (!payload || typeof payload !== 'object') return { rows: null, shape: null };
  if (Array.isArray(payload)) return { rows: payload.length, shape: 'array' };
  const record = payload as Record<string, unknown>;
  for (const key of ['data', 'items', 'players', 'teams', 'games', 'news', 'projections']) {
    if (Array.isArray(record[key])) return { rows: record[key].length, shape: key };
  }
  return { rows: null, shape: 'object' };
}

function matchCoverage(text: string, terms: string[]): string[] {
  const normalized = text.toLowerCase();
  return terms.filter((term) => normalized.includes(term.toLowerCase()));
}

function classifyHttpStatus(status: number, credentialConfigured: boolean): FootballDataProviderProbeStatus {
  if (status >= 200 && status < 300) return 'reachable';
  if ((status === 401 || status === 403) && credentialConfigured) return 'credential_rejected';
  if (status === 401 || status === 403) return 'credentials_required';
  return 'http_error';
}

export async function runFootballDataProviderProbe(
  probe: FootballDataProviderProbeDefinition,
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<FootballDataProviderProbeResult> {
  const env = options.env || process.env;
  const credential = pickCredential(env, probe.credentialEnv);
  const credentialConfigured = Boolean(credential);

  if (probe.credentialEnv.length > 0 && !credentialConfigured) {
    return {
      id: probe.id,
      provider: probe.provider,
      target: probe.target,
      category: probe.category,
      status: 'missing_config',
      httpStatus: null,
      rows: null,
      shape: null,
      bytes: 0,
      durationMs: 0,
      credentialConfigured,
      coverage: [],
      note: probe.note,
    };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Math.max(1000, Math.min(30000, Math.floor(options.timeoutMs || 12000)));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const headers: Record<string, string> = {
      accept: 'application/json,text/plain;q=0.9,text/html;q=0.8',
    };
    if (credential && probe.credentialHeader) headers[probe.credentialHeader] = credential;
    const response = await fetchImpl(probe.url, {
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let rows: number | null = null;
    let shape: string | null = response.headers.get('content-type')?.split(';')[0] || null;
    try {
      const parsed = JSON.parse(text);
      const summary = summarizeRows(parsed);
      rows = summary.rows;
      shape = summary.shape || shape;
    } catch {
      // Metadata probe only; text/html docs are acceptable for docs probes.
    }

    return {
      id: probe.id,
      provider: probe.provider,
      target: probe.target,
      category: probe.category,
      status: classifyHttpStatus(response.status, credentialConfigured),
      httpStatus: response.status,
      rows,
      shape,
      bytes: Buffer.byteLength(text),
      durationMs: Date.now() - startedAt,
      credentialConfigured,
      coverage: matchCoverage(text, probe.coverageTerms),
      note: probe.note,
    };
  } catch (error) {
    return {
      id: probe.id,
      provider: probe.provider,
      target: probe.target,
      category: probe.category,
      status: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
      httpStatus: null,
      rows: null,
      shape: null,
      bytes: 0,
      durationMs: Date.now() - startedAt,
      credentialConfigured,
      coverage: [],
      note: error instanceof Error ? error.message : String(error || probe.note),
    };
  } finally {
    clearTimeout(timeout);
  }
}
