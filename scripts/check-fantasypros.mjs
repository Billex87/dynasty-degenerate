import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

const BASE_URL = 'https://api.fantasypros.com/public/v2/json';
const season = process.env.FANTASYPROS_CHECK_SEASON
  || process.env.RANKINGS_SEASON
  || process.env.FANTASYPROS_RANKINGS_SEASON
  || String(Math.max(2026, new Date().getFullYear()));
const scoring = process.env.FANTASYPROS_CHECK_SCORING || 'PPR';
const apiKey = process.env.FANTASYPROS_API_KEY;
const requestDelayMs = clampNumber(process.env.FANTASYPROS_CHECK_DELAY_MS, 750, 0, 30000);
const stopOnRateLimit = !/^(?:0|false|no|off)$/i.test(String(process.env.FANTASYPROS_CHECK_STOP_ON_RATE_LIMIT || 'true'));
const currentWeek = clampNumber(process.env.FANTASYPROS_CHECK_START_WEEK || process.env.FANTASYPROS_SNAPSHOT_START_WEEK, 1, 1, 18);
const weekWindow = clampNumber(process.env.FANTASYPROS_CHECK_WEEK_WINDOW || process.env.FANTASYPROS_SNAPSHOT_WEEK_WINDOW, 3, 1, 6);

if (!apiKey) {
  console.error('FantasyPros check failed: FANTASYPROS_API_KEY is not set in server env.');
  process.exit(1);
}

function envFlag(name) {
  return /^(?:1|true|yes|on)$/i.test(String(process.env[name] || ''));
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function delay(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function rollingWeeks(startWeek, count) {
  return Array.from({ length: count }, (_, index) => startWeek + index).filter((week) => week <= 18);
}

function parseRetryAfterMs(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const retryDateMs = Date.parse(value);
  if (!Number.isFinite(retryDateMs)) return null;
  return Math.max(0, retryDateMs - Date.now());
}

function countRows(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  if (Array.isArray(payload)) return payload.length;
  for (const key of ['players', 'news', 'articles', 'items', 'injuries', 'projections', 'data']) {
    if (Array.isArray(payload[key])) return payload[key].length;
  }
  if (payload.rankings && typeof payload.rankings === 'object') return countNestedRows(payload.rankings);
  return 0;
}

function countNestedRows(value) {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.length;
  return Object.values(value).reduce((total, child) => total + countNestedRows(child), 0);
}

function summarizePayload(payload) {
  return {
    rows: countRows(payload),
    lastUpdated: payload?.last_updated || payload?.lastUpdated || payload?.updated_at || payload?.updated || null,
    totalExperts: Number(payload?.total_experts || payload?.totalExperts || 0) || null,
  };
}

async function checkEndpoint(check) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${check.path}`, {
      headers: { 'x-api-key': apiKey },
    });
    const durationMs = Date.now() - startedAt;
    if (!response.ok) {
      return {
        name: check.name,
        status: response.status,
        ok: false,
        rows: 0,
        lastUpdated: null,
        totalExperts: null,
        durationMs,
        retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')),
        skipped: false,
        error: response.statusText || `HTTP ${response.status}`,
      };
    }

    const payload = await response.json();
    return {
      name: check.name,
      status: response.status,
      ok: true,
      durationMs,
      retryAfterMs: null,
      skipped: false,
      error: null,
      ...summarizePayload(payload),
    };
  } catch (error) {
    return {
      name: check.name,
      status: null,
      ok: false,
      rows: 0,
      lastUpdated: null,
      totalExperts: null,
      durationMs: Date.now() - startedAt,
      retryAfterMs: null,
      skipped: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const rankingTypes = ['DRAFT', 'ROS', 'DYNASTY', 'DEVY', 'ROOKIES', 'ADP', 'DYNADP', 'RKADP'];
const checks = [
  ...rankingTypes.map((type) => ({
    name: `rankings:${type}`,
    path: `/NFL/${season}/consensus-rankings?${new URLSearchParams({
      position: 'ALL',
      type,
      scoring,
      week: '0',
    }).toString()}`,
  })),
  { name: 'players', path: '/NFL/players' },
  { name: 'news', path: '/NFL/news?limit=25' },
  { name: 'injuries', path: '/NFL/injuries?week=0' },
  { name: 'player-points', path: `/nfl/${season}/player-points?position=ALL&scoring=${encodeURIComponent(scoring)}` },
];

if (envFlag('CHECK_FANTASYPROS_EXPANDED')) {
  const weeklyEcrChecks = rollingWeeks(currentWeek, weekWindow).flatMap((week) =>
    ['QB', 'RB', 'WR', 'TE', 'K', 'DST'].map((position) => ({
      name: `weekly-ecr:${position}:week${week}`,
      path: `/nfl/${season}/consensus-rankings?${new URLSearchParams({
        position,
        scoring,
        week: String(week),
      }).toString()}`,
    }))
  );

  checks.push(
    {
      name: `rankings:WW:week${currentWeek}`,
      path: `/NFL/${season}/consensus-rankings?${new URLSearchParams({
        position: 'ALL',
        type: 'WW',
        scoring,
        week: String(currentWeek),
      }).toString()}`,
    },
    ...weeklyEcrChecks,
    { name: 'targets', path: `/nfl/${season}/targets` },
    { name: 'articles', path: '/nfl/articles' },
    {
      name: 'compare-players',
      path: `/nfl/compare-players?${new URLSearchParams({
        players: '9016:9020',
        position: 'WR',
        ranking_type: 'weekly',
        details: 'players',
      }).toString()}`,
    },
  );
}

if (envFlag('CHECK_FANTASYPROS_PROJECTIONS')) {
  checks.push({
    name: 'projections',
    path: `/nfl/${season}/projections?position=ALL&week=0&scoring=${encodeURIComponent(scoring)}`,
  });
}

const results = [];
let stoppedReason = null;
for (const [index, check] of checks.entries()) {
  if (stoppedReason) {
    results.push({
      name: check.name,
      status: 'skipped',
      ok: false,
      skipped: true,
      rows: 0,
      lastUpdated: null,
      totalExperts: null,
      durationMs: 0,
      retryAfterMs: null,
      error: stoppedReason,
    });
    continue;
  }

  const result = await checkEndpoint(check);
  results.push(result);
  if (result.status === 429 && stopOnRateLimit) {
    const retryCopy = result.retryAfterMs ? ` Retry after ${Math.ceil(result.retryAfterMs / 1000)}s.` : '';
    stoppedReason = `${result.name} hit FantasyPros rate limits.${retryCopy}`;
    continue;
  }
  if (index < checks.length - 1) await delay(requestDelayMs);
}

console.table(results.map((result) => ({
  endpoint: result.name,
  ok: result.ok,
  status: result.status ?? '-',
  rows: result.rows,
  experts: result.totalExperts ?? '-',
  lastUpdated: result.lastUpdated ?? '-',
  durationMs: result.durationMs,
  retryAfterMs: result.retryAfterMs ?? '-',
  error: result.error ?? '',
})));

const failed = results.filter((result) => !result.ok && !result.skipped);
if (failed.length) {
  console.error(`FantasyPros check completed with ${failed.length} failing endpoint${failed.length === 1 ? '' : 's'}.`);
  process.exitCode = 1;
}
