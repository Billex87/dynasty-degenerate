import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

const BASE_URL = 'https://api.fantasypros.com/public/v2/json';
const season = process.env.FANTASYPROS_CHECK_SEASON || String(new Date().getFullYear());
const scoring = process.env.FANTASYPROS_CHECK_SCORING || 'PPR';
const apiKey = process.env.FANTASYPROS_API_KEY;

if (!apiKey) {
  console.error('FantasyPros check failed: FANTASYPROS_API_KEY is not set in server env.');
  process.exit(1);
}

function countRows(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  if (Array.isArray(payload)) return payload.length;
  for (const key of ['players', 'news', 'articles', 'items', 'injuries']) {
    if (Array.isArray(payload[key])) return payload[key].length;
  }
  return 0;
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
        error: response.statusText || `HTTP ${response.status}`,
      };
    }

    const payload = await response.json();
    return {
      name: check.name,
      status: response.status,
      ok: true,
      durationMs,
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

if (/^(?:1|true|yes|on)$/i.test(process.env.CHECK_FANTASYPROS_PROJECTIONS || '')) {
  checks.push({
    name: 'projections',
    path: `/nfl/${season}/projections?position=ALL&week=0&scoring=${encodeURIComponent(scoring)}`,
  });
}

const results = [];
for (const check of checks) {
  results.push(await checkEndpoint(check));
}

console.table(results.map((result) => ({
  endpoint: result.name,
  ok: result.ok,
  status: result.status ?? '-',
  rows: result.rows,
  experts: result.totalExperts ?? '-',
  lastUpdated: result.lastUpdated ?? '-',
  durationMs: result.durationMs,
  error: result.error ?? '',
})));

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`FantasyPros check completed with ${failed.length} failing endpoint${failed.length === 1 ? '' : 's'}.`);
  process.exitCode = 1;
}
