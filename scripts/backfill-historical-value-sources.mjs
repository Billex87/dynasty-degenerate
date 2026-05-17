import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ override: false, quiet: true });

const rootDir = process.cwd();
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'one-time-source-history.json');
const sources = new Set(
  String(process.env.SOURCES || 'ktc,flock')
    .split(',')
    .map((source) => source.trim().toLowerCase())
    .filter(Boolean),
);
const now = process.env.TO_DATE ? new Date(`${process.env.TO_DATE}T00:00:00.000Z`) : new Date();
const fromDate = process.env.FROM_DATE
  ? new Date(`${process.env.FROM_DATE}T00:00:00.000Z`)
  : new Date(now.getTime() - (Number(process.env.YEARS_BACK || 4) * 366 * 24 * 60 * 60 * 1000));
const delayMs = Math.max(0, Number(process.env.DELAY_MS || 900));
const retryAttempts = Math.max(1, Number(process.env.RETRY_ATTEMPTS || 5));
const retryBaseMs = Math.max(250, Number(process.env.RETRY_BASE_MS || 1200));
const maxPlayers = Math.max(0, Number(process.env.MAX_PLAYERS || 0));
const maxFlockPlayers = Math.max(0, Number(process.env.MAX_FLOCK_PLAYERS || process.env.MAX_PLAYERS || 0));
const maxFantasyCalcPlayers = Math.max(0, Number(process.env.MAX_FANTASYCALC_PLAYERS || process.env.MAX_PLAYERS || 0));
const startAfter = String(process.env.START_AFTER || '').trim();
const dryRun = process.env.DRY_RUN === '1';
const includeCurrent = process.env.INCLUDE_CURRENT !== '0';
const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const KTC_RANKINGS_URL = 'https://keeptradecut.com/dynasty-rankings?page=0&filters=QB%7CWR%7CRB%7CTE%7CRDP&format=2';
const FLOCK_FORMATS = String(process.env.FLOCK_FORMATS || 'SUPERFLEX,ONEQB,PROSPECTS_SF,PROSPECTS')
  .split(',')
  .map((format) => format.trim())
  .filter(Boolean);
const DYNASTYPROCESS_REPO_URL = process.env.DYNASTYPROCESS_REPO_URL || 'https://github.com/dynastyprocess/data.git';
const DYNASTYPROCESS_REPO_DIR = process.env.DYNASTYPROCESS_REPO_DIR
  ? path.resolve(rootDir, process.env.DYNASTYPROCESS_REPO_DIR)
  : path.join(rootDir, '.cache', 'value-history', 'dynastyprocess-data');
const maxDynastyProcessCommits = Math.max(0, Number(process.env.MAX_DYNASTYPROCESS_COMMITS || 0));
const FANTASYCALC_FORMATS = String(process.env.FANTASYCALC_FORMATS || 'sf_ppr,one_qb_ppr')
  .split(',')
  .map((format) => format.trim())
  .filter(Boolean);
const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';
const FANTASYPROS_SEASONS = String(process.env.FANTASYPROS_SEASONS || `${Math.max(2022, now.getUTCFullYear() - 4)},${Math.max(2023, now.getUTCFullYear() - 3)},${Math.max(2024, now.getUTCFullYear() - 2)},${Math.max(2025, now.getUTCFullYear() - 1)},${now.getUTCFullYear()}`)
  .split(',')
  .map((season) => season.trim())
  .filter(Boolean);
const FANTASYPROS_RANKING_TYPES = String(process.env.FANTASYPROS_RANKING_TYPES || 'DYNASTY,DRAFT,ADP,DYNADP,DEVY,ROOKIES')
  .split(',')
  .map((type) => type.trim().toUpperCase())
  .filter(Boolean);
const FANTASYPROS_SCORINGS = String(process.env.FANTASYPROS_SCORINGS || 'PPR')
  .split(',')
  .map((scoring) => scoring.trim().toUpperCase())
  .filter(Boolean);

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Backfill one-time historical player values from direct source player pages/API payloads.',
    '',
    'Environment:',
    '  SOURCES=ktc,flock,dynastyprocess,fantasycalc,fantasypros',
    '  FROM_DATE=2022-05-17',
    '  TO_DATE=2026-05-17',
    '  YEARS_BACK=4',
    '  MAX_PLAYERS=0          # 0 means no cap',
    '  MAX_FLOCK_PLAYERS=0    # defaults to MAX_PLAYERS when set',
    '  MAX_FANTASYCALC_PLAYERS=0',
    '  MAX_DYNASTYPROCESS_COMMITS=0',
    '  START_AFTER=bijan-robinson-1414',
    '  INCLUDE_CURRENT=1',
    '  FLOCK_FORMATS=SUPERFLEX,ONEQB,PROSPECTS_SF,PROSPECTS',
    '  FANTASYCALC_FORMATS=sf_ppr,one_qb_ppr',
    '  FANTASYPROS_SEASONS=2022,2023,2024,2025,2026',
    '  FANTASYPROS_RANKING_TYPES=DYNASTY,DRAFT,ADP,DYNADP,DEVY,ROOKIES',
    '  FANTASYPROS_SCORINGS=PPR',
    '  DYNASTYPROCESS_REPO_DIR=.cache/value-history/dynastyprocess-data',
    '  DELAY_MS=900',
    '  RETRY_ATTEMPTS=5',
    '  RETRY_BASE_MS=1200',
    '  DRY_RUN=1',
    '  OUT_FILE=server/value-history-archive/one-time-source-history.json',
    '',
    'Output:',
    '  Frozen raw archive with direct provider history/API points.',
    '  Re-run pnpm reblend:value-history against the archive whenever blend weights change.',
  ].join('\n'));
  process.exit(0);
}

function cleanName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function rankToValue(rank, rankCap = 425) {
  const numericRank = toNumber(rank);
  if (!numericRank || numericRank <= 0) return null;
  const score = Math.max(0.015, (rankCap - numericRank + 1) / rankCap);
  return Math.max(50, Math.round(10000 * Math.pow(score, 1.55)));
}

function overallRankToValue(overallRank, replacement = 320) {
  const rank = toNumber(overallRank);
  if (!rank) return null;
  return Math.max(100, Math.round(10000 * Math.pow(Math.max(0.025, (replacement - rank + 1) / replacement), 1.22)));
}

function positionRankToValue(positionRank, overallRank) {
  if (!positionRank && !overallRank) return null;
  const position = normalizePosition(String(positionRank || '').replace(/[0-9]/g, ''));
  const rank = toNumber(String(positionRank || '').match(/\d+/)?.[0]) || toNumber(overallRank);
  if (!rank) return null;

  const replacementByPosition = {
    QB: 30,
    RB: 60,
    WR: 72,
    TE: 24,
    K: 20,
    DEF: 20,
  };
  const ceilingByPosition = {
    QB: 9000,
    RB: 9000,
    WR: 9000,
    TE: 9000,
    K: 1200,
    DEF: 1200,
  };
  const replacement = replacementByPosition[position || ''] || 140;
  const ceiling = ceilingByPosition[position || ''] || 9000;
  return Math.max(100, Math.round(ceiling * Math.pow(Math.max(0.04, (replacement - rank + 1) / replacement), 1.35)));
}

function stripHtml(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function normalizePosition(position) {
  const normalized = String(position || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return null;
  if (['DST', 'D', 'DEFENSE'].includes(normalized)) return 'DEF';
  if (normalized === 'PK') return 'K';
  return normalized;
}

function normalizePositionRank(positionRank, fallbackPosition) {
  const rankNumber = String(positionRank || '').match(/\d+/)?.[0];
  const rankPosition = normalizePosition(String(positionRank || '').replace(/\d+/g, '') || fallbackPosition);
  if (!rankNumber || !rankPosition) return positionRank || null;
  return `${rankPosition}${rankNumber}`;
}

function parseKtcDate(value) {
  const raw = String(value || '');
  if (!/^\d{6}$/.test(raw)) return null;
  const year = Number(raw.slice(0, 2));
  const fullYear = year >= 70 ? 1900 + year : 2000 + year;
  return `${fullYear}-${raw.slice(2, 4)}-${raw.slice(4, 6)}`;
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function inDateWindow(date) {
  if (!date) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed >= fromDate && parsed <= now;
}

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd || rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.quiet ? 'ignore' : 'pipe'],
    maxBuffer: 1024 * 1024 * 128,
  });
}

async function fetchText(url, label, headers = {}) {
  let lastStatus = 0;
  let lastMessage = '';

  for (let attempt = 0; attempt < retryAttempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': userAgent, ...headers } });
      lastStatus = response.status;
      if (response.ok) return response.text();

      const retryAfter = Number(response.headers.get('retry-after') || 0);
      const shouldRetry = [408, 425, 429, 500, 502, 503, 504].includes(response.status) && attempt < retryAttempts - 1;
      if (!shouldRetry) throw new Error(`${label} ${response.status}`);
      const waitMs = retryAfter > 0
        ? retryAfter * 1000
        : retryBaseMs * Math.pow(2, attempt);
      console.warn(`[value-history] ${label} ${response.status}; retrying in ${waitMs}ms`);
      await sleep(waitMs);
    } catch (error) {
      lastMessage = String(error.message || error);
      if (attempt >= retryAttempts - 1) throw error;
      const waitMs = retryBaseMs * Math.pow(2, attempt);
      console.warn(`[value-history] ${label} failed (${lastMessage}); retrying in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }

  throw new Error(`${label} ${lastStatus || lastMessage || 'failed'}`);
}

async function fetchJson(url, label, headers = {}) {
  const text = await fetchText(url, label, headers);
  return JSON.parse(text);
}

function ensureDynastyProcessRepo() {
  if (fs.existsSync(path.join(DYNASTYPROCESS_REPO_DIR, '.git'))) {
    runGit(['fetch', '--quiet', 'origin', 'master'], { cwd: DYNASTYPROCESS_REPO_DIR, quiet: true });
    return;
  }

  fs.mkdirSync(path.dirname(DYNASTYPROCESS_REPO_DIR), { recursive: true });
  runGit(['clone', '--quiet', '--filter=blob:none', '--no-checkout', DYNASTYPROCESS_REPO_URL, DYNASTYPROCESS_REPO_DIR], { quiet: true });
}

function getDynastyProcessCommits() {
  const output = runGit([
    'log',
    '--reverse',
    `--since=${dateKey(fromDate)}T00:00:00Z`,
    `--until=${dateKey(now)}T23:59:59Z`,
    '--format=%H%x09%cI',
    '--',
    'files/values-players.csv',
  ], { cwd: DYNASTYPROCESS_REPO_DIR });

  const commits = output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, committedAt] = line.split('\t');
      return { hash, committedAt };
    });

  return maxDynastyProcessCommits ? commits.slice(0, maxDynastyProcessCommits) : commits;
}

function cleanDateValue(value, fallbackDate) {
  const raw = String(value || '').trim();
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (direct) return direct;
  return fallbackDate;
}

function mapDynastyProcessPoint(row, commit, profile) {
  const name = String(row.player || row.mergename || '').trim();
  const position = String(row.pos || '').trim() || null;
  const value = toNumber(row[profile.valueColumn]);
  const date = cleanDateValue(row.scrape_date, String(commit.committedAt || '').slice(0, 10));
  if (!name || !value || !date || !inDateWindow(date)) return null;

  const overallRank = toNumber(row[profile.rankColumn]);
  const positionRank = toNumber(row.ecr_pos);
  return {
    key: cleanName(name),
    name,
    position,
    sourceIds: { fantasyProsId: row.fp_id || null },
    point: {
      date,
      value,
      rank: getKtcRank(position, positionRank),
      overallRank,
      sources: ['DynastyProcess'],
      importedSource: 'dynastyprocess-github-values-players',
      format: profile.format,
      market: {},
      expert: { dynastyProcess: value },
      sourceMeta: {
        historyMethod: 'official-github-values-players-commit-history',
        sourceUrl: 'https://github.com/dynastyprocess/data/blob/master/files/values-players.csv',
        sourceLicense: 'GPL-3.0',
        commit: commit.hash,
        committedAt: commit.committedAt,
        scrapeDate: row.scrape_date || null,
        ecrOverall: overallRank,
        ecrPosition: positionRank,
        note: 'DynastyProcess does not publish TEP-specific values in values-players.csv; archived points keep the source-native 1QB and Superflex formats only.',
      },
    },
  };
}

async function backfillDynastyProcess(players, manifest) {
  manifest.dynastyprocess = {
    mode: 'official-github-values-players-commit-history',
    repoUrl: DYNASTYPROCESS_REPO_URL,
    repoDir: path.relative(rootDir, DYNASTYPROCESS_REPO_DIR),
    filePath: 'files/values-players.csv',
    sourceUrl: 'https://github.com/dynastyprocess/data',
    sourceLicense: 'GPL-3.0',
    formats: ['one_qb_ppr', 'sf_ppr'],
    errors: [],
  };

  ensureDynastyProcessRepo();
  const commits = getDynastyProcessCommits();
  manifest.dynastyprocess.commitCount = commits.length;
  manifest.dynastyprocess.sampledOnly = Boolean(maxDynastyProcessCommits);

  if (dryRun) return;

  const profiles = [
    { format: 'one_qb_ppr', valueColumn: 'value_1qb', rankColumn: 'ecr_1qb' },
    { format: 'sf_ppr', valueColumn: 'value_2qb', rankColumn: 'ecr_2qb' },
  ];

  for (let index = 0; index < commits.length; index += 1) {
    const commit = commits[index];
    try {
      const csv = runGit(['show', `${commit.hash}:files/values-players.csv`], { cwd: DYNASTYPROCESS_REPO_DIR });
      const rows = parseCsv(csv);
      const headers = rows[0] ? Object.keys(rows[0]) : [];
      if (!headers.includes('player') || !headers.includes('value_1qb') || !headers.includes('value_2qb')) {
        manifest.dynastyprocess.errors.push({ commit: commit.hash, committedAt: commit.committedAt, error: 'missing expected player/value_1qb/value_2qb columns' });
        continue;
      }

      let pointCount = 0;
      for (const row of rows) {
        for (const profile of profiles) {
          const mapped = mapDynastyProcessPoint(row, commit, profile);
          if (!mapped) continue;
          mergePoint(players, mapped);
          pointCount += 1;
        }
      }

      manifest.dynastyprocess.lastProcessed = { index: index + 1, commit: commit.hash, committedAt: commit.committedAt, pointCount };
      if ((index + 1) % 25 === 0) console.log(`DynastyProcess git history: ${index + 1}/${commits.length}`);
    } catch (error) {
      manifest.dynastyprocess.errors.push({ commit: commit.hash, committedAt: commit.committedAt, error: String(error.message || error) });
    }
  }
}

function extractJsVar(html, varName) {
  const marker = `var ${varName} = `;
  const start = html.indexOf(marker);
  if (start === -1) return null;

  let index = start + marker.length;
  const begin = index;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (; index < html.length; index += 1) {
    const char = html[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{' || char === '[') depth += 1;
    if (char === '}' || char === ']') depth -= 1;
    if (char === ';' && depth === 0) return JSON.parse(html.slice(begin, index));
  }

  return null;
}

function mergePoint(players, input) {
  if (!input.key || !input.name || !input.point?.date || !input.point?.value) return;
  const player = players.get(input.key) || {
    key: input.key,
    name: input.name,
    position: input.position || null,
    sourceIds: {},
    points: [],
  };

  player.name = player.name || input.name;
  player.position = player.position || input.position || null;
  player.sourceIds = { ...(player.sourceIds || {}), ...(input.sourceIds || {}) };

  const existing = player.points.find((point) =>
    point.date === input.point.date &&
    point.format === input.point.format &&
    point.importedSource === input.point.importedSource
  );

  if (existing) {
    existing.value = input.point.value || existing.value;
    existing.rank = input.point.rank || existing.rank;
    existing.overallRank = input.point.overallRank || existing.overallRank;
    existing.sources = Array.from(new Set([...(existing.sources || []), ...(input.point.sources || [])]));
    existing.market = { ...(existing.market || {}), ...(input.point.market || {}) };
    existing.expert = { ...(existing.expert || {}), ...(input.point.expert || {}) };
  } else {
    player.points.push(input.point);
  }

  players.set(input.key, player);
}

function currentDateKey() {
  return dateKey(now);
}

function getKtcRank(position, positionRank) {
  const rank = toNumber(positionRank);
  return position && rank ? `${position}${Math.round(rank)}` : null;
}

function getKtcPlayerFromHistoryPayload(payload, player) {
  const candidates = [
    ...(payload?.adjacentOverallPlayers || []),
    ...(payload?.adjacentPositionalPlayers || []),
  ];
  return candidates.find((row) => row.playerID === player.playerID)
    || candidates.find((row) => row.slug === player.slug)
    || null;
}

function buildKtcHistoryPoints({
  player,
  valueHistory,
  rankHistory,
  positionRankHistory,
  currentValues,
  format,
  importedSource,
  sourceMeta = {},
  includeCurrentPoint = includeCurrent,
}) {
  const rankByDate = new Map((rankHistory || []).map((point) => [parseKtcDate(point.d), toNumber(point.v)]));
  const positionRankByDate = new Map((positionRankHistory || []).map((point) => [parseKtcDate(point.d), toNumber(point.v)]));
  const points = [];

  for (const point of valueHistory || []) {
    const date = parseKtcDate(point.d);
    const value = toNumber(point.v);
    if (!date || !value || !inDateWindow(date)) continue;
    const positionRank = positionRankByDate.get(date);
    const overallRank = rankByDate.get(date);
    points.push({
      date,
      value,
      rank: getKtcRank(player.position, positionRank),
      overallRank: overallRank || null,
      sources: ['KTC'],
      importedSource,
      format,
      market: { ktc: value },
      expert: {},
      sourceMeta,
    });
  }

  if (includeCurrentPoint && currentValues?.value) {
    points.push({
      date: currentDateKey(),
      value: toNumber(currentValues.value),
      rank: getKtcRank(player.position, currentValues.positionalRank),
      overallRank: toNumber(currentValues.rank),
      sources: ['KTC'],
      importedSource,
      format,
      market: { ktc: toNumber(currentValues.value) },
      expert: {},
      sourceMeta: { ...sourceMeta, currentPoint: true },
    });
  }

  return points;
}

function getKtcTepHistory(values, basePayload, position, tepLabel) {
  const tepHistory = values?.history || [];
  if (tepHistory.length) {
    return {
      valueHistory: tepHistory,
      includeCurrentPoint: includeCurrent,
      sourceMeta: { historyMethod: 'ktc-tep-specific-history', tep: tepLabel },
    };
  }

  if (position !== 'TE') {
    return {
      valueHistory: [],
      includeCurrentPoint: false,
      sourceMeta: {
        historyMethod: 'ktc-base-history-applies-to-non-te-tep-profile',
        tep: tepLabel,
        note: 'KTC TEP adjusts tight end values only. Non-TE TEP history is intentionally not duplicated; use the matching base history for non-TE players in TEP leagues.',
      },
    };
  }

  return {
    valueHistory: [],
    includeCurrentPoint: true,
    sourceMeta: {
      historyMethod: 'current-only-missing-ktc-tep-specific-history',
      tep: tepLabel,
      note: 'KTC page did not expose a TE-premium historical value graph for this tight end; only the current TEP value is stored for this format.',
    },
  };
}

function getKtcFormatConfigs(player, playerSuperflex, playerOneQb) {
  const adjacentSuperflex = getKtcPlayerFromHistoryPayload(playerSuperflex, player);
  const adjacentOneQb = getKtcPlayerFromHistoryPayload(playerOneQb, player);
  const superflexValues = adjacentSuperflex?.superflexValues || player.superflexValues || {};
  const oneQbValues = adjacentOneQb?.oneQBValues || player.oneQBValues || {};
  const sfTep = getKtcTepHistory(superflexValues.tep, playerSuperflex, player.position, '0.5');
  const sfTepp = getKtcTepHistory(superflexValues.tepp, playerSuperflex, player.position, '1.0');
  const sfTeppp = getKtcTepHistory(superflexValues.teppp, playerSuperflex, player.position, '1.5');
  const oneQbTep = getKtcTepHistory(oneQbValues.tep, playerOneQb, player.position, '0.5');
  const oneQbTepp = getKtcTepHistory(oneQbValues.tepp, playerOneQb, player.position, '1.0');
  const oneQbTeppp = getKtcTepHistory(oneQbValues.teppp, playerOneQb, player.position, '1.5');

  return [
    {
      format: 'sf_ppr',
      importedSource: 'ktc-player-page',
      payload: playerSuperflex,
      valueHistory: playerSuperflex?.overallValue || adjacentSuperflex?.superflexValues?.history || [],
      currentValues: player.superflexValues || superflexValues,
      sourceMeta: { historyMethod: 'ktc-player-page-overall-value' },
      includeCurrentPoint: includeCurrent,
    },
    {
      format: 'one_qb_ppr',
      importedSource: 'ktc-player-page',
      payload: playerOneQb,
      valueHistory: playerOneQb?.overallValue || adjacentOneQb?.oneQBValues?.history || [],
      currentValues: player.oneQBValues || oneQbValues,
      sourceMeta: { historyMethod: 'ktc-player-page-overall-value' },
      includeCurrentPoint: includeCurrent,
    },
    {
      format: 'sf_ppr_tep_0_5',
      importedSource: 'ktc-player-page-tep',
      payload: playerSuperflex,
      valueHistory: sfTep.valueHistory,
      currentValues: player.superflexValues?.tep || superflexValues.tep || player.superflexValues,
      sourceMeta: sfTep.sourceMeta,
      includeCurrentPoint: sfTep.includeCurrentPoint,
    },
    {
      format: 'sf_ppr_tep_1_0',
      importedSource: 'ktc-player-page-tep',
      payload: playerSuperflex,
      valueHistory: sfTepp.valueHistory,
      currentValues: player.superflexValues?.tepp || superflexValues.tepp || player.superflexValues,
      sourceMeta: sfTepp.sourceMeta,
      includeCurrentPoint: sfTepp.includeCurrentPoint,
    },
    {
      format: 'sf_ppr_tep_1_5',
      importedSource: 'ktc-player-page-tep',
      payload: playerSuperflex,
      valueHistory: sfTeppp.valueHistory,
      currentValues: player.superflexValues?.teppp || superflexValues.teppp || player.superflexValues,
      sourceMeta: sfTeppp.sourceMeta,
      includeCurrentPoint: sfTeppp.includeCurrentPoint,
    },
    {
      format: 'one_qb_ppr_tep_0_5',
      importedSource: 'ktc-player-page-tep',
      payload: playerOneQb,
      valueHistory: oneQbTep.valueHistory,
      currentValues: player.oneQBValues?.tep || oneQbValues.tep || player.oneQBValues,
      sourceMeta: oneQbTep.sourceMeta,
      includeCurrentPoint: oneQbTep.includeCurrentPoint,
    },
    {
      format: 'one_qb_ppr_tep_1_0',
      importedSource: 'ktc-player-page-tep',
      payload: playerOneQb,
      valueHistory: oneQbTepp.valueHistory,
      currentValues: player.oneQBValues?.tepp || oneQbValues.tepp || player.oneQBValues,
      sourceMeta: oneQbTepp.sourceMeta,
      includeCurrentPoint: oneQbTepp.includeCurrentPoint,
    },
    {
      format: 'one_qb_ppr_tep_1_5',
      importedSource: 'ktc-player-page-tep',
      payload: playerOneQb,
      valueHistory: oneQbTeppp.valueHistory,
      currentValues: player.oneQBValues?.teppp || oneQbValues.teppp || player.oneQBValues,
      sourceMeta: oneQbTeppp.sourceMeta,
      includeCurrentPoint: oneQbTeppp.includeCurrentPoint,
    },
  ];
}

async function getKtcPlayerList() {
  const html = await fetchText(KTC_RANKINGS_URL, 'KTC rankings');
  const rows = extractJsVar(html, 'playersArray') || [];
  const seen = new Set();
  const players = [];

  for (const row of rows) {
    if (!row?.slug || seen.has(row.slug)) continue;
    seen.add(row.slug);
    players.push({
      playerName: row.playerName,
      playerID: row.playerID,
      slug: row.slug,
      position: row.position,
    });
  }

  const startIndex = startAfter
    ? Math.max(0, players.findIndex((player) => player.slug === startAfter) + 1)
    : 0;
  const selected = players.slice(startIndex);
  return maxPlayers ? selected.slice(0, maxPlayers) : selected;
}

async function backfillKtc(players, manifest) {
  const ktcPlayers = await getKtcPlayerList();
  manifest.ktc = {
    mode: 'direct-player-pages',
    playerPageCount: ktcPlayers.length,
    formats: ['sf_ppr', 'one_qb_ppr', 'sf_ppr_tep_0_5', 'sf_ppr_tep_1_0', 'sf_ppr_tep_1_5', 'one_qb_ppr_tep_0_5', 'one_qb_ppr_tep_1_0', 'one_qb_ppr_tep_1_5'],
    sampledOnly: Boolean(maxPlayers),
    errors: [],
  };

  if (dryRun) return;

  for (let index = 0; index < ktcPlayers.length; index += 1) {
    const listPlayer = ktcPlayers[index];
    try {
      const url = `https://keeptradecut.com/dynasty-rankings/players/${listPlayer.slug}`;
      const html = await fetchText(url, `KTC ${listPlayer.slug}`);
      const player = extractJsVar(html, 'player') || listPlayer;
      const playerSuperflex = extractJsVar(html, 'playerSuperflex');
      const playerOneQb = extractJsVar(html, 'playerOneQB');
      const key = cleanName(player.playerName || listPlayer.playerName);
      const name = player.playerName || listPlayer.playerName;
      const position = player.position || listPlayer.position || null;
      let pointCount = 0;

      for (const config of getKtcFormatConfigs(player, playerSuperflex, playerOneQb)) {
        const points = buildKtcHistoryPoints({
          player: { ...player, position },
          historyPayload: config.payload,
          valueHistory: config.valueHistory,
          rankHistory: config.payload?.overallRankHistory || [],
          positionRankHistory: config.payload?.positionalRankHistory || [],
          currentValues: config.currentValues,
          format: config.format,
          importedSource: config.importedSource,
          sourceMeta: config.sourceMeta,
          includeCurrentPoint: config.includeCurrentPoint,
        });

        for (const point of points) {
          mergePoint(players, {
            key,
            name,
            position,
            sourceIds: { ktcPlayerId: player.playerID || listPlayer.playerID, ktcSlug: player.slug || listPlayer.slug },
            point,
          });
          pointCount += 1;
        }
      }

      manifest.ktc.lastProcessed = { index: index + 1, slug: listPlayer.slug, pointCount };
      if ((index + 1) % 25 === 0) console.log(`KTC direct player pages: ${index + 1}/${ktcPlayers.length}`);
    } catch (error) {
      manifest.ktc.errors.push({ slug: listPlayer.slug, error: String(error.message || error) });
    }
    await sleep(delayMs);
  }
}

function getFlockUpdatedAt(payload, fallbackDate) {
  const timestamps = Object.values(payload?.lastUpdated || {}).filter(Boolean).sort();
  return String(timestamps.at(-1) || fallbackDate).slice(0, 10);
}

function mapFlockPlayer(row, format, snapshotDate) {
  const name = row.playerName;
  const key = cleanName(name);
  const position = ['QB', 'RB', 'WR', 'TE'].includes(row.position || '')
    ? row.position
    : row.isDraftPick || row.pickType
      ? 'PICK'
      : row.position || null;
  const rank = toNumber(row.overallAverageRank) ?? toNumber(row.averageRank);
  const positionRank = toNumber(row.averagePositionalRank);
  const value = rankToValue(rank, format.startsWith('PROSPECTS') ? 90 : 425);
  if (!key || !name || !value) return null;
  return {
    key,
    name,
    position,
    sourceIds: { flockPlayerId: row.playerId, fantasyCalcId: row.fantasyCalcId },
    point: {
      date: snapshotDate,
      value,
      rank: getKtcRank(position, positionRank),
      overallRank: rank,
      sources: ['FlockFantasy'],
      importedSource: 'flock-rankings-api-current',
      format,
      market: {},
      expert: { flockFantasy: value },
      sourceMeta: {
        rankDelta: toNumber(row.rankDelta),
        initialRank: toNumber(row.initialRank),
        finalRank: toNumber(row.finalRank),
        lastUpdated: snapshotDate,
      },
    },
  };
}

async function writeArchive(outputFilePath, archive, archivePlayers) {
  await fs.promises.mkdir(path.dirname(outputFilePath), { recursive: true });
  const stream = fs.createWriteStream(outputFilePath, { encoding: 'utf8' });
  const write = (chunk) => new Promise((resolve, reject) => {
    stream.write(chunk, (error) => (error ? reject(error) : resolve()));
  });

  const header = {
    ...archive,
    players: undefined,
  };
  delete header.players;

  await write('{\n');
  const entries = Object.entries(header);
  for (let index = 0; index < entries.length; index += 1) {
    const [key, value] = entries[index];
    await write(`  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')},\n`);
  }
  await write('  "players": [\n');
  for (let index = 0; index < archivePlayers.length; index += 1) {
    await write(`${index ? ',\n' : ''}${JSON.stringify(archivePlayers[index], null, 2).split('\n').map((line) => `    ${line}`).join('\n')}`);
  }
  await write('\n  ]\n}\n');

  await new Promise((resolve, reject) => {
    stream.end((error) => (error ? reject(error) : resolve()));
  });
}

function getFlockHistoryConfig(format) {
  if (format === 'SUPERFLEX') return { format, historyFormat: 'DYNASTY', subformat: 'SUPERFLEX', rankCap: 425 };
  if (format === 'ONEQB') return { format, historyFormat: 'DYNASTY', subformat: '1QB', rankCap: 425 };
  return null;
}

function mapFlockHistoryPoint(row, positionalRow, player, format, rankCap) {
  const date = String(row?.ranked_on || '').slice(0, 10);
  const rank = toNumber(row?.rank);
  const value = rankToValue(rank, rankCap);
  if (!date || !rank || !value || !inDateWindow(date)) return null;
  const positionRank = toNumber(positionalRow?.rank);
  const position = positionalRow?.position || player.position || null;

  return {
    date,
    value,
    rank: getKtcRank(position, positionRank),
    overallRank: rank,
    tier: toNumber(row.tier),
    sources: ['FlockFantasy'],
    importedSource: 'flock-player-history-api',
    format,
    market: {},
    expert: { flockFantasy: value },
    sourceMeta: {
      promoterCount: toNumber(row.promoter_count),
      positionalTier: toNumber(positionalRow?.tier),
    },
  };
}

async function fetchFlockHistoryPoints(row, historyConfig) {
  const playerId = row.playerId;
  if (!playerId || !historyConfig) return [];

  const baseParams = {
    format: historyConfig.historyFormat,
    subformat: historyConfig.subformat,
    startDate: dateKey(fromDate),
  };
  const overallParams = new URLSearchParams({ ...baseParams, rankType: 'overall' });
  const positionalParams = new URLSearchParams({ ...baseParams, rankType: 'positional' });
  const [overallRows, positionalRows] = await Promise.all([
    fetchJson(`https://api.flockfantasy.com/rankings/history/${playerId}?${overallParams.toString()}`, `Flock history ${playerId} overall`),
    fetchJson(`https://api.flockfantasy.com/rankings/history/${playerId}?${positionalParams.toString()}`, `Flock history ${playerId} positional`),
  ]);

  const positionalByDate = new Map((Array.isArray(positionalRows) ? positionalRows : []).map((point) => [
    String(point?.ranked_on || '').slice(0, 10),
    point,
  ]));

  return (Array.isArray(overallRows) ? overallRows : [])
    .map((point) => mapFlockHistoryPoint(
      point,
      positionalByDate.get(String(point?.ranked_on || '').slice(0, 10)),
      row,
      historyConfig.format,
      historyConfig.rankCap,
    ))
    .filter(Boolean);
}

async function backfillFlock(players, manifest) {
  manifest.flock = {
    mode: 'direct-rankings-and-player-history-api',
    note: 'Flock player cards expose dated ranking history for dynasty Superflex and 1QB through the rankings history endpoint. Prospect-only rows still use current rankings unless their dynasty history endpoint returns rows.',
    formats: {},
    errors: [],
  };

  if (dryRun) return;

  for (const format of FLOCK_FORMATS) {
    const targetUrl = `https://api.flockfantasy.com/rankings?format=${encodeURIComponent(format)}&pickType=general`;
    try {
      const payload = await fetchJson(targetUrl, `Flock ${format}`);
      const snapshotDate = getFlockUpdatedAt(payload, currentDateKey());
      let pointCount = 0;
      let historyPointCount = 0;
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const selectedRows = maxFlockPlayers ? rows.slice(0, maxFlockPlayers) : rows;
      const historyConfig = getFlockHistoryConfig(format);

      for (let index = 0; index < selectedRows.length; index += 1) {
        const row = selectedRows[index];
        const mapped = mapFlockPlayer(row, format, snapshotDate);
        if (mapped) {
          mergePoint(players, mapped);
          pointCount += 1;
        }

        if (historyConfig && row.playerId) {
          try {
            const historyPoints = await fetchFlockHistoryPoints(row, historyConfig);
            for (const point of historyPoints) {
              mergePoint(players, {
                key: cleanName(row.playerName),
                name: row.playerName,
                position: row.position,
                sourceIds: { flockPlayerId: row.playerId, fantasyCalcId: row.fantasyCalcId },
                point,
              });
              historyPointCount += 1;
            }
          } catch (error) {
            manifest.flock.errors.push({ format, playerId: row.playerId, playerName: row.playerName, error: String(error.message || error) });
          }
          await sleep(delayMs);
        }
      }
      manifest.flock.formats[format] = {
        pointCount,
        historyPointCount,
        date: snapshotDate,
        historyConfig,
        sampledOnly: Boolean(maxFlockPlayers),
      };
    } catch (error) {
      manifest.flock.errors.push({ format, error: String(error.message || error) });
    }
    await sleep(delayMs);
  }
}

function getFantasyCalcFormatConfig(format) {
  if (format === 'sf_ppr') return { format, numQbs: 2 };
  if (format === 'one_qb_ppr') return { format, numQbs: 1 };
  return null;
}

function parseFantasyCalcDate(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}

function mapFantasyCalcPlayer(row, format) {
  const player = row?.player || {};
  const name = String(player.name || '').trim();
  const id = toNumber(player.id);
  if (!name || !id) return null;
  const position = normalizePosition(player.position) || player.position || null;
  return {
    id,
    name,
    key: cleanName(name),
    position,
    format,
    currentValue: toNumber(row.value),
    overallRank: toNumber(row.overallRank),
    positionRank: toNumber(row.positionRank),
    sourceIds: {
      fantasyCalcId: id,
      sleeperId: player.sleeperId || null,
      mflId: player.mflId || null,
      espnId: player.espnId || null,
      fleaflickerId: player.fleaflickerId || null,
    },
  };
}

async function backfillFantasyCalc(players, manifest) {
  manifest.fantasycalc = {
    mode: 'direct-player-history-api',
    sourceUrl: 'https://api.fantasycalc.com',
    note: 'FantasyCalc exposes dated player value history through the same API used by its player detail pages. The history endpoint supports dynasty 1QB/Superflex but does not expose team-count, PPR, or TEP-specific history splits.',
    formats: {},
    errors: [],
  };

  if (dryRun) return;

  for (const requestedFormat of FANTASYCALC_FORMATS) {
    const config = getFantasyCalcFormatConfig(requestedFormat);
    if (!config) {
      manifest.fantasycalc.errors.push({ format: requestedFormat, error: 'unsupported FantasyCalc format' });
      continue;
    }

    const currentUrl = `https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${config.numQbs}&numTeams=12&ppr=1`;
    try {
      const rows = await fetchJson(currentUrl, `FantasyCalc current ${config.format}`);
      const mappedRows = (Array.isArray(rows) ? rows : [])
        .map((row) => mapFantasyCalcPlayer(row, config.format))
        .filter(Boolean);
      const selectedRows = maxFantasyCalcPlayers ? mappedRows.slice(0, maxFantasyCalcPlayers) : mappedRows;
      let historyPointCount = 0;
      let currentPointCount = 0;

      for (let index = 0; index < selectedRows.length; index += 1) {
        const player = selectedRows[index];
        try {
          const historyUrl = `https://api.fantasycalc.com/trades/historical/${player.id}?isDynasty=true&numQbs=${config.numQbs}`;
          const historyRows = await fetchJson(historyUrl, `FantasyCalc history ${player.id} ${config.format}`);
          for (const row of Array.isArray(historyRows) ? historyRows : []) {
            const date = parseFantasyCalcDate(row.date);
            const value = toNumber(row.value);
            if (!date || !value || !inDateWindow(date)) continue;
            mergePoint(players, {
              key: player.key,
              name: player.name,
              position: player.position,
              sourceIds: player.sourceIds,
              point: {
                date,
                value,
                rank: getKtcRank(player.position, player.positionRank),
                overallRank: player.overallRank,
                sources: ['FantasyCalc'],
                importedSource: 'fantasycalc-player-history-api',
                format: config.format,
                market: { fantasyCalc: value },
                expert: {},
                sourceMeta: {
                  historyMethod: 'fantasycalc-player-history-api',
                  sourceUrl: historyUrl,
                  isDynasty: true,
                  numQbs: config.numQbs,
                  note: 'FantasyCalc history endpoint does not expose TEP, PPR, or team-count-specific history params; format is mapped from the available QB profile.',
                },
              },
            });
            historyPointCount += 1;
          }

          if (includeCurrent && player.currentValue && inDateWindow(currentDateKey())) {
            mergePoint(players, {
              key: player.key,
              name: player.name,
              position: player.position,
              sourceIds: player.sourceIds,
              point: {
                date: currentDateKey(),
                value: player.currentValue,
                rank: getKtcRank(player.position, player.positionRank),
                overallRank: player.overallRank,
                sources: ['FantasyCalc'],
                importedSource: 'fantasycalc-current-values-api',
                format: config.format,
                market: { fantasyCalc: player.currentValue },
                expert: {},
                sourceMeta: {
                  historyMethod: 'fantasycalc-current-values-api',
                  sourceUrl: currentUrl,
                  isDynasty: true,
                  numQbs: config.numQbs,
                  currentPoint: true,
                },
              },
            });
            currentPointCount += 1;
          }
        } catch (error) {
          manifest.fantasycalc.errors.push({ format: config.format, fantasyCalcId: player.id, playerName: player.name, error: String(error.message || error) });
        }

        if ((index + 1) % 50 === 0) console.log(`FantasyCalc ${config.format}: ${index + 1}/${selectedRows.length}`);
        await sleep(delayMs);
      }

      manifest.fantasycalc.formats[config.format] = {
        playerCount: selectedRows.length,
        historyPointCount,
        currentPointCount,
        sampledOnly: Boolean(maxFantasyCalcPlayers),
      };
    } catch (error) {
      manifest.fantasycalc.errors.push({ format: config.format, error: String(error.message || error) });
    }

    await sleep(delayMs);
  }
}

function parseFantasyProsDate(rawDate, season, rankingType) {
  const raw = String(rawDate || '').trim();
  const direct = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, '0')}-${direct[3].padStart(2, '0')}`;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const seasonYear = Number(season);
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  let year = seasonYear;

  if (rankingType === 'DYNASTY' && month <= 2 && seasonYear < currentYear) {
    year = seasonYear + 1;
  } else if (seasonYear === currentYear && month > currentMonth + 1) {
    year = currentYear - 1;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getFantasyProsFormatConfigs(rankingType, scoring) {
  const scoringSuffix = scoring === 'PPR' ? 'ppr' : scoring === 'HALF' ? 'half_ppr' : 'standard';
  if (rankingType === 'DYNASTY') {
    if (scoring !== 'PPR') return [];
    return ['sf_ppr', 'one_qb_ppr'].map((format) => ({ format, includeInBlend: true }));
  }
  if (rankingType === 'DYNADP') return [{ format: `fantasypros_dynadp_${scoringSuffix}`, includeInBlend: false }];
  if (rankingType === 'ADP') return [{ format: `fantasypros_adp_${scoringSuffix}`, includeInBlend: false }];
  if (rankingType === 'DRAFT') return [{ format: `redraft_${scoringSuffix}`, includeInBlend: false }];
  if (rankingType === 'ROS') return [{ format: `ros_${scoringSuffix}`, includeInBlend: false }];
  if (rankingType === 'DEVY') return [{ format: `devy_${scoringSuffix}`, includeInBlend: false }];
  if (rankingType === 'ROOKIES') return [{ format: `rookie_${scoringSuffix}`, includeInBlend: false }];
  return [{ format: `fantasypros_${rankingType.toLowerCase()}_${scoringSuffix}`, includeInBlend: false }];
}

function mapFantasyProsPlayer(row, payload, options) {
  const name = stripHtml(row.player_name || row.name);
  if (!name) return null;
  const position = normalizePosition(stripHtml(row.player_position_id || row.position_id || row.position));
  const overallRank = toNumber(row.rank_ecr ?? row.rank ?? row.rank_ave ?? row.rank_average ?? row.adp);
  const positionRank = normalizePositionRank(stripHtml(row.pos_rank || row.position_rank), position);
  const rankValue = overallRankToValue(overallRank);
  const seasonValue = ['DRAFT', 'ROS', 'ADP'].includes(options.rankingType)
    ? positionRankToValue(positionRank, overallRank) ?? rankValue
    : null;
  const dynastyValue = options.rankingType === 'DYNASTY' ? rankValue : null;
  const adpValue = ['ADP', 'DYNADP', 'RKADP'].includes(options.rankingType) ? rankValue : null;
  const value = dynastyValue ?? seasonValue ?? adpValue ?? rankValue;
  if (!value) return null;

  return {
    key: cleanName(name),
    name,
    position: position || null,
    team: stripHtml(row.player_team_id || row.team_id || row.team),
    value,
    dynastyValue,
    seasonValue,
    adpValue,
    overallRank,
    positionRank,
    tier: toNumber(row.tier),
    age: toNumber(row.player_age || row.age),
    bestRank: toNumber(row.rank_min || row.best_rank),
    worstRank: toNumber(row.rank_max || row.worst_rank),
    averageRank: toNumber(row.rank_ave || row.rank_average),
    stdDev: toNumber(row.rank_std || row.std_dev),
    fantasyProsId: stripHtml(row.player_id || row.fantasypros_id || row.fp_id || row.id),
    sourceIds: {
      fantasyProsId: stripHtml(row.player_id || row.fantasypros_id || row.fp_id || row.id),
    },
  };
}

async function backfillFantasyPros(players, manifest) {
  const apiKey = process.env.FANTASYPROS_API_KEY || '';
  manifest.fantasypros = {
    mode: 'licensed-api-consensus-rankings',
    sourceUrl: FANTASYPROS_BASE_URL,
    seasons: FANTASYPROS_SEASONS,
    rankingTypes: FANTASYPROS_RANKING_TYPES,
    scorings: FANTASYPROS_SCORINGS,
    note: 'FantasyPros API exposes prior-season consensus ranking snapshots with source last_updated values. Dynasty ranking rows are duplicated into app 1QB/SF base PPR formats because the endpoint does not expose QB-format or TEP-specific splits.',
    errors: [],
    requests: [],
  };

  if (!apiKey) {
    manifest.fantasypros.errors.push({ error: 'FANTASYPROS_API_KEY is not configured' });
    return;
  }
  if (dryRun) return;

  for (const season of FANTASYPROS_SEASONS) {
    for (const rankingType of FANTASYPROS_RANKING_TYPES) {
      for (const scoring of FANTASYPROS_SCORINGS) {
        const params = new URLSearchParams({
          position: 'ALL',
          type: rankingType,
          scoring,
          week: '0',
        });
        const url = `${FANTASYPROS_BASE_URL}/NFL/${season}/consensus-rankings?${params.toString()}`;
        try {
          const payload = await fetchJson(url, `FantasyPros ${season} ${rankingType} ${scoring}`, { 'x-api-key': apiKey });
          const snapshotDate = parseFantasyProsDate(payload?.last_updated, season, rankingType);
          const rows = Array.isArray(payload?.players) ? payload.players : [];
          let pointCount = 0;
          let skippedNoDate = 0;
          const formatConfigs = getFantasyProsFormatConfigs(rankingType, scoring);

          if (!snapshotDate || !inDateWindow(snapshotDate)) {
            skippedNoDate = rows.length;
          } else {
            for (const row of rows) {
              const mapped = mapFantasyProsPlayer(row, payload, { rankingType, scoring });
              if (!mapped) continue;
              for (const formatConfig of formatConfigs) {
                mergePoint(players, {
                  key: mapped.key,
                  name: mapped.name,
                  position: mapped.position,
                  sourceIds: mapped.sourceIds,
                  point: {
                    date: snapshotDate,
                    value: mapped.value,
                    rank: mapped.positionRank,
                    overallRank: mapped.overallRank,
                    tier: mapped.tier,
                    sources: ['FantasyPros'],
                    importedSource: `fantasypros-${rankingType.toLowerCase()}-${scoring.toLowerCase()}-rankings-api`,
                    format: formatConfig.format,
                    market: {},
                    expert: formatConfig.includeInBlend ? { fantasyPros: mapped.dynastyValue || mapped.value } : {},
                    sourceMeta: {
                      historyMethod: 'fantasypros-consensus-rankings-api',
                      sourceUrl: url,
                      season: String(season),
                      rankingType,
                      scoring,
                      rawLastUpdated: payload?.last_updated || null,
                      totalExperts: toNumber(payload?.total_experts),
                      bestRank: mapped.bestRank,
                      worstRank: mapped.worstRank,
                      averageRank: mapped.averageRank,
                      stdDev: mapped.stdDev,
                      age: mapped.age,
                      team: mapped.team,
                      adpValue: mapped.adpValue,
                      seasonValue: mapped.seasonValue,
                      datePolicy: rankingType === 'DYNASTY' ? 'jan-feb-dynasty-rankings-map-to-season-plus-one-for-completed-seasons' : 'ranking-season-year',
                    },
                  },
                });
                pointCount += 1;
              }
            }
          }

          manifest.fantasypros.requests.push({
            season: String(season),
            rankingType,
            scoring,
            lastUpdated: payload?.last_updated || null,
            snapshotDate,
            totalExperts: toNumber(payload?.total_experts),
            playerCount: rows.length,
            pointCount,
            skippedNoDate,
          });
        } catch (error) {
          manifest.fantasypros.errors.push({ season: String(season), rankingType, scoring, error: String(error.message || error) });
        }

        await sleep(delayMs);
      }
    }
  }
}

async function main() {
  const players = new Map();
  const manifest = {
    generatedAt: new Date().toISOString(),
    fromDate: dateKey(fromDate),
    toDate: dateKey(now),
    dryRun,
    includeCurrent,
    sources: Array.from(sources),
    outputMode: 'direct-source-pages',
  };

  if (sources.has('ktc')) await backfillKtc(players, manifest);
  if (sources.has('flock')) await backfillFlock(players, manifest);
  if (sources.has('dynastyprocess')) await backfillDynastyProcess(players, manifest);
  if (sources.has('fantasycalc')) await backfillFantasyCalc(players, manifest);
  if (sources.has('fantasypros')) await backfillFantasyPros(players, manifest);

  const archivePlayers = Array.from(players.values()).map((player) => ({
    ...player,
    points: player.points.sort((a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.format || '').localeCompare(String(b.format || '')) ||
      String(a.importedSource || '').localeCompare(String(b.importedSource || ''))
    ),
  })).sort((a, b) => a.name.localeCompare(b.name));

  const archive = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'one-time-direct-source-history-backfill',
    playerCount: archivePlayers.length,
    pointCount: archivePlayers.reduce((sum, player) => sum + player.points.length, 0),
    manifest,
    policy: {
      note: 'Frozen one-time raw source archive from direct player pages/API payloads. Do not mutate after capture; write reblended derived files when weights change.',
    },
    players: archivePlayers,
  };

  await writeArchive(outputPath, archive, archivePlayers);
  console.log(`${dryRun ? 'Planned' : 'Backfilled'} ${archive.pointCount} points for ${archive.playerCount} players to ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
