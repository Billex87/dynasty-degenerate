import { recordApiProviderTelemetryEvent } from './apiProviderTelemetry';
import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';
import { getCurrentRankingSeason } from './rankingSeason';

const FANTASYPROS_MATCHUPS_BASE_URL = 'https://www.fantasypros.com/nfl/matchups';
const SNAPSHOT_VERSION = 1;
const PARSER_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_REQUEST_DELAY_MS = 750;
const PROVIDER = 'FantasyPros';
const JOB = 'fantasypros-matchup-calendar';

export const FANTASYPROS_MATCHUP_CALENDAR_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const;

export type FantasyProsMatchupCalendarPosition = typeof FANTASYPROS_MATCHUP_CALENDAR_POSITIONS[number];
export type FantasyProsMatchupTier = 'easy' | 'neutral' | 'hard' | 'bye';
export type FantasyProsMatchupHomeAway = 'home' | 'away';
export type FantasyProsMatchupCalendarStatus = 'loaded' | 'empty' | 'error' | 'skipped';

export interface FantasyProsMatchupCalendarWeek {
  week: number;
  opponent: string | null;
  homeAway: FantasyProsMatchupHomeAway | null;
  opponentRank: number | null;
  matchupStars: number | null;
  matchupTier: FantasyProsMatchupTier;
  matchupText: string | null;
  isBye: boolean;
}

export interface FantasyProsMatchupCalendarRow {
  fantasyProsId: string;
  name: string;
  position: FantasyProsMatchupCalendarPosition;
  team: string | null;
  rank: number | null;
  positionRank: string | null;
  playerUrl: string | null;
  weeks: FantasyProsMatchupCalendarWeek[];
}

export interface FantasyProsMatchupCalendarSnapshotPayload {
  version: number;
  parserVersion: number;
  source: 'FantasyPros';
  sourceKey: string;
  sourceUrl: string;
  season: string;
  position: FantasyProsMatchupCalendarPosition;
  fetchedAt: string;
  rowCount: number;
  weekCount: number;
  rows: FantasyProsMatchupCalendarRow[];
}

export interface FantasyProsMatchupCalendarResult {
  sourceKey: string;
  sourceUrl: string;
  season: string;
  position: FantasyProsMatchupCalendarPosition;
  status: FantasyProsMatchupCalendarStatus;
  rowCount: number;
  weekCount: number;
  statusCode: number | null;
  persisted: boolean;
  error: string | null;
}

export interface FantasyProsMatchupCalendarSummary {
  sourceKey: string;
  source: string;
  position: FantasyProsMatchupCalendarPosition;
  status: 'loaded' | 'empty' | 'missing';
  rowCount: number;
  weekCount: number;
  fetchedAt: string | null;
  sourceUrl: string | null;
}

export interface FantasyProsMatchupCalendarContextRow extends FantasyProsMatchupCalendarWeek {
  fantasyProsId: string;
  name: string;
  position: FantasyProsMatchupCalendarPosition;
  team: string | null;
  rank: number | null;
  positionRank: string | null;
  sourceKey: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface FantasyProsMatchupCalendarContext {
  generatedAt: string;
  season: string;
  summaries: FantasyProsMatchupCalendarSummary[];
  rowCounts: Array<{ sourceKey: string; rowCount: number | null }>;
  rowsByFantasyProsId: Record<string, FantasyProsMatchupCalendarRow>;
  rowsByPositionWeek: Record<string, Record<string, Record<string, FantasyProsMatchupCalendarContextRow>>>;
}

type RefreshOptions = {
  season?: string;
  positions?: FantasyProsMatchupCalendarPosition[];
  timeoutMs?: number;
  requestDelayMs?: number;
  persistSnapshot?: boolean;
  fetchImpl?: typeof fetch;
  now?: Date;
};

const TEAM_ALIASES: Record<string, string> = {
  ARZ: 'ARI',
  GBP: 'GB',
  GNB: 'GB',
  JAC: 'JAX',
  KAN: 'KC',
  LA: 'LAR',
  NEP: 'NE',
  NOR: 'NO',
  NWE: 'NE',
  OAK: 'LV',
  SD: 'LAC',
  SFO: 'SF',
  TAM: 'TB',
  WSH: 'WAS',
};

const DEFENSE_TEAM_BY_NAME: Record<string, string> = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS',
};

function normalizeTeam(value?: string | null): string | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  return TEAM_ALIASES[normalized] || normalized;
}

function normalizePosition(value?: string | null): FantasyProsMatchupCalendarPosition | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'DEF' || normalized === 'D/ST') return 'DST';
  return FANTASYPROS_MATCHUP_CALENDAR_POSITIONS.includes(normalized as FantasyProsMatchupCalendarPosition)
    ? normalized as FantasyProsMatchupCalendarPosition
    : null;
}

function numberField(value?: string | number | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function attrValue(html: string, attr: string): string | null {
  const match = html.match(new RegExp(`${attr}=["']([^"']*)["']`, 'i'));
  return match ? decodeHtml(match[1]).trim() : null;
}

function extractDataTable(html: string): string | null {
  const match = html.match(/<table\b[^>]*id=["']data["'][^>]*>[\s\S]*?<\/table>/i);
  return match?.[0] || null;
}

function extractCells(rowHtml: string): string[] {
  return Array.from(rowHtml.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)).map((match) => match[0]);
}

function parseWeekHeaders(tableHtml: string): number[] {
  const headerMatch = tableHtml.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i);
  if (!headerMatch) return [];
  return Array.from(headerMatch[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi))
    .map((match) => numberField(stripTags(match[1])))
    .filter((week): week is number => Boolean(week && week > 0));
}

function inferDefenseTeam(playerCell: string, playerName: string): string | null {
  const shortName = playerCell.match(/<span\b[^>]*class=["'][^"']*hidden-desktop[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const shortTeam = stripTags(shortName?.[1] || '').replace(/\s+DST$/i, '');
  return normalizeTeam(shortTeam) || DEFENSE_TEAM_BY_NAME[playerName] || null;
}

function parsePlayerRow(input: {
  rowAttrs: string;
  rowHtml: string;
  position: FantasyProsMatchupCalendarPosition;
  weeks: number[];
}): FantasyProsMatchupCalendarRow | null {
  const cells = extractCells(input.rowHtml);
  if (cells.length < 3) return null;

  const rank = numberField(stripTags(cells[0]));
  const playerCell = cells[1];
  const idFromClass = playerCell.match(/\bfp-id-(\d+)\b/i)?.[1]
    || input.rowAttrs.match(/\bmpb-player-(\d+)\b/i)?.[1]
    || null;
  const playerName = attrValue(playerCell, 'fp-player-name') || stripTags(playerCell.match(/<a\b[\s\S]*?<\/a>/i)?.[0] || '');
  if (!idFromClass || !playerName) return null;

  const greyTeam = stripTags(playerCell.match(/<small\b[^>]*class=["'][^"']*grey[^"']*["'][^>]*>([\s\S]*?)<\/small>/i)?.[1] || '');
  const team = normalizeTeam(greyTeam) || (input.position === 'DST' ? inferDefenseTeam(playerCell, playerName) : null);
  const playerUrl = attrValue(playerCell, 'href');
  const weeks = cells.slice(2).map((cell, index) => parseMatchupCell(cell, input.weeks[index] || index + 1));

  return {
    fantasyProsId: idFromClass,
    name: playerName,
    position: input.position,
    team,
    rank,
    positionRank: rank ? `${input.position}${rank}` : null,
    playerUrl: playerUrl?.startsWith('http')
      ? playerUrl
      : playerUrl
        ? `https://www.fantasypros.com${playerUrl}`
        : null,
    weeks,
  };
}

function parseMatchupCell(cellHtml: string, week: number): FantasyProsMatchupCalendarWeek {
  const cellText = stripTags(cellHtml);
  if (/^BYE$/i.test(cellText)) {
    return {
      week,
      opponent: null,
      homeAway: null,
      opponentRank: null,
      matchupStars: null,
      matchupTier: 'bye',
      matchupText: 'BYE',
      isBye: true,
    };
  }

  const matchupDiv = cellHtml.match(/<div\b([^>]*)class=["']([^"']*matchup-cell__opponents-text[^"']*)["']([^>]*)>([\s\S]*?)<\/div>/i);
  const matchupClass = matchupDiv?.[2] || '';
  const opponentCopy = stripTags(matchupDiv?.[4] || '');
  const homeAway = /^at\b/i.test(opponentCopy)
    ? 'away'
    : /^vs\.?\b/i.test(opponentCopy)
      ? 'home'
      : null;
  const opponent = normalizeTeam(opponentCopy.replace(/^(?:at|vs\.?)\s+/i, ''));
  const tooltip = attrValue(cellHtml, 'data-tooltip');
  const hiddenText = stripTags(cellHtml.match(/<span\b[^>]*class=["'][^"']*hidden-aria[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
  const matchupText = hiddenText || tooltip || null;
  const matchupStars = numberField(matchupText?.match(/This is a\s+(\d+)\s+star/i)?.[1] || null);
  const opponentRank = numberField(
    cellHtml.match(/data-rank=["'](\d+)["']/i)?.[1]
      || cellHtml.match(/data-sort=["'](\d+)["']/i)?.[1]
      || null
  );
  const tier: FantasyProsMatchupTier = /\beasy\b/i.test(matchupClass)
    ? 'easy'
    : /\bhard\b/i.test(matchupClass)
      ? 'hard'
      : matchupStars && matchupStars >= 4
        ? 'easy'
        : matchupStars && matchupStars <= 2
          ? 'hard'
          : 'neutral';

  return {
    week,
    opponent,
    homeAway,
    opponentRank,
    matchupStars,
    matchupTier: tier,
    matchupText,
    isBye: false,
  };
}

export function getFantasyProsMatchupCalendarSourceKey(input: {
  season: string;
  position: FantasyProsMatchupCalendarPosition;
}): string {
  return `fantasypros-matchup-calendar-v1:${input.season}:${input.position}`;
}

export function getFantasyProsMatchupCalendarSourceUrl(position: FantasyProsMatchupCalendarPosition): string {
  return `${FANTASYPROS_MATCHUPS_BASE_URL}/${position.toLowerCase()}.php`;
}

export function parseFantasyProsMatchupCalendarHtml(input: {
  html: string;
  season: string;
  position: FantasyProsMatchupCalendarPosition | string;
  sourceUrl?: string;
  fetchedAt?: string;
}): FantasyProsMatchupCalendarSnapshotPayload {
  const position = normalizePosition(input.position);
  if (!position) {
    throw new Error(`Unsupported FantasyPros matchup calendar position: ${input.position}`);
  }

  const table = extractDataTable(input.html);
  if (!table) {
    throw new Error('FantasyPros matchup calendar table was not found.');
  }

  const weeks = parseWeekHeaders(table);
  const body = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || table;
  const rows = Array.from(body.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi))
    .map((match) => parsePlayerRow({
      rowAttrs: match[1],
      rowHtml: match[2],
      position,
      weeks,
    }))
    .filter((row): row is FantasyProsMatchupCalendarRow => Boolean(row));

  const sourceKey = getFantasyProsMatchupCalendarSourceKey({ season: input.season, position });
  return {
    version: SNAPSHOT_VERSION,
    parserVersion: PARSER_VERSION,
    source: 'FantasyPros',
    sourceKey,
    sourceUrl: input.sourceUrl || getFantasyProsMatchupCalendarSourceUrl(position),
    season: input.season,
    position,
    fetchedAt: input.fetchedAt || new Date().toISOString(),
    rowCount: rows.length,
    weekCount: weeks.length || Math.max(0, ...rows.flatMap((row) => row.weeks.map((week) => week.week))),
    rows,
  };
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

async function persistMatchupCalendarSnapshot(input: {
  payload: FantasyProsMatchupCalendarSnapshotPayload;
  now: Date;
}): Promise<boolean> {
  return upsertProviderDataSnapshot({
    sourceKey: input.payload.sourceKey,
    snapshotKey: getProviderSnapshotDateKey(input.now),
    payload: JSON.stringify(input.payload),
  });
}

async function fetchMatchupCalendarPosition(input: {
  season: string;
  position: FantasyProsMatchupCalendarPosition;
  timeoutMs: number;
  persistSnapshot: boolean;
  fetchImpl: typeof fetch;
  now: Date;
}): Promise<FantasyProsMatchupCalendarResult> {
  const sourceUrl = getFantasyProsMatchupCalendarSourceUrl(input.position);
  const sourceKey = getFantasyProsMatchupCalendarSourceKey({
    season: input.season,
    position: input.position,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await input.fetchImpl(sourceUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0 (compatible; DynastyDegensBot/1.0; +https://dynastydegenerates.com)',
      },
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      recordApiProviderTelemetryEvent({
        provider: PROVIDER,
        endpoint: `matchups/${input.position.toLowerCase()}.php`,
        status: response.status,
        ok: false,
        durationMs,
        cacheStatus: 'miss',
        costUnits: 1,
        job: JOB,
        scope: 'cron',
        message: response.statusText || `HTTP ${response.status}`,
      });
      return {
        sourceKey,
        sourceUrl,
        season: input.season,
        position: input.position,
        status: 'error',
        rowCount: 0,
        weekCount: 0,
        statusCode: response.status,
        persisted: false,
        error: response.statusText || `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const payload = parseFantasyProsMatchupCalendarHtml({
      html,
      season: input.season,
      position: input.position,
      sourceUrl,
      fetchedAt: input.now.toISOString(),
    });
    const persisted = input.persistSnapshot
      ? await persistMatchupCalendarSnapshot({ payload, now: input.now })
      : false;

    recordApiProviderTelemetryEvent({
      provider: PROVIDER,
      endpoint: `matchups/${input.position.toLowerCase()}.php`,
      status: response.status,
      ok: true,
      durationMs,
      cacheStatus: 'miss',
      costUnits: 1,
      job: JOB,
      scope: 'cron',
      message: `${payload.rowCount} rows, ${payload.weekCount} weeks`,
    });

    return {
      sourceKey,
      sourceUrl,
      season: input.season,
      position: input.position,
      status: payload.rowCount > 0 ? 'loaded' : 'empty',
      rowCount: payload.rowCount,
      weekCount: payload.weekCount,
      statusCode: response.status,
      persisted,
      error: null,
    };
  } catch (error) {
    recordApiProviderTelemetryEvent({
      provider: PROVIDER,
      endpoint: `matchups/${input.position.toLowerCase()}.php`,
      status: null,
      ok: false,
      durationMs: Date.now() - startedAt,
      cacheStatus: 'miss',
      costUnits: 1,
      job: JOB,
      scope: 'cron',
      message: error instanceof Error ? error.message : String(error || 'FantasyPros matchup calendar fetch failed.'),
    });

    return {
      sourceKey,
      sourceUrl,
      season: input.season,
      position: input.position,
      status: 'error',
      rowCount: 0,
      weekCount: 0,
      statusCode: null,
      persisted: false,
      error: error instanceof Error ? error.message : String(error || 'Unknown error'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshFantasyProsMatchupCalendarSnapshots(options: RefreshOptions = {}): Promise<FantasyProsMatchupCalendarResult[]> {
  const season = options.season || getCurrentRankingSeason();
  const positions = (options.positions || FANTASYPROS_MATCHUP_CALENDAR_POSITIONS)
    .map((position) => normalizePosition(position))
    .filter((position): position is FantasyProsMatchupCalendarPosition => Boolean(position));
  const timeoutMs = Math.max(1000, Math.min(30000, Math.floor(options.timeoutMs || DEFAULT_TIMEOUT_MS)));
  const requestDelayMs = Math.max(0, Math.min(30000, Math.floor(options.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS)));
  const persistSnapshot = options.persistSnapshot !== false;
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || new Date();
  const results: FantasyProsMatchupCalendarResult[] = [];

  for (let index = 0; index < positions.length; index += 1) {
    results.push(await fetchMatchupCalendarPosition({
      season,
      position: positions[index],
      timeoutMs,
      persistSnapshot,
      fetchImpl,
      now,
    }));
    if (index < positions.length - 1) await delay(requestDelayMs);
  }

  return results;
}

export async function loadFantasyProsMatchupCalendarSnapshot(input: {
  season?: string;
  position: FantasyProsMatchupCalendarPosition;
}): Promise<FantasyProsMatchupCalendarSnapshotPayload | null> {
  const season = input.season || getCurrentRankingSeason();
  const stored = await findLatestProviderDataSnapshot(getFantasyProsMatchupCalendarSourceKey({
    season,
    position: input.position,
  }));
  const parsed = parseProviderSnapshotPayload<FantasyProsMatchupCalendarSnapshotPayload>(stored?.payload);
  return parsed?.version === SNAPSHOT_VERSION && Array.isArray(parsed.rows) ? parsed : null;
}

function snapshotSummary(input: {
  season: string;
  position: FantasyProsMatchupCalendarPosition;
  snapshot: FantasyProsMatchupCalendarSnapshotPayload | null;
}): FantasyProsMatchupCalendarSummary {
  const sourceKey = getFantasyProsMatchupCalendarSourceKey({
    season: input.season,
    position: input.position,
  });
  if (!input.snapshot) {
    return {
      sourceKey,
      source: `FantasyPros ${input.position} matchup calendar`,
      position: input.position,
      status: 'missing',
      rowCount: 0,
      weekCount: 0,
      fetchedAt: null,
      sourceUrl: getFantasyProsMatchupCalendarSourceUrl(input.position),
    };
  }

  return {
    sourceKey,
    source: `FantasyPros ${input.position} matchup calendar`,
    position: input.position,
    status: input.snapshot.rowCount > 0 ? 'loaded' : 'empty',
    rowCount: input.snapshot.rowCount,
    weekCount: input.snapshot.weekCount,
    fetchedAt: input.snapshot.fetchedAt,
    sourceUrl: input.snapshot.sourceUrl,
  };
}

export function buildFantasyProsMatchupCalendarContext(input: {
  season: string;
  snapshots: Partial<Record<FantasyProsMatchupCalendarPosition, FantasyProsMatchupCalendarSnapshotPayload | null>>;
  positions?: FantasyProsMatchupCalendarPosition[];
  generatedAt?: string;
}): FantasyProsMatchupCalendarContext {
  const positions = input.positions || [...FANTASYPROS_MATCHUP_CALENDAR_POSITIONS];
  const summaries = positions.map((position) => snapshotSummary({
    season: input.season,
    position,
    snapshot: input.snapshots[position] || null,
  }));
  const rowsByFantasyProsId: Record<string, FantasyProsMatchupCalendarRow> = {};
  const rowsByPositionWeek: FantasyProsMatchupCalendarContext['rowsByPositionWeek'] = {};

  for (const position of positions) {
    const snapshot = input.snapshots[position] || null;
    if (!snapshot) continue;
    rowsByPositionWeek[position] ||= {};

    for (const row of snapshot.rows || []) {
      rowsByFantasyProsId[row.fantasyProsId] = row;
      for (const week of row.weeks || []) {
        const weekKey = String(week.week);
        rowsByPositionWeek[position][weekKey] ||= {};
        rowsByPositionWeek[position][weekKey][row.fantasyProsId] = {
          ...week,
          fantasyProsId: row.fantasyProsId,
          name: row.name,
          position: row.position,
          team: row.team,
          rank: row.rank,
          positionRank: row.positionRank,
          sourceKey: snapshot.sourceKey,
          sourceUrl: snapshot.sourceUrl,
          fetchedAt: snapshot.fetchedAt,
        };
      }
    }
  }

  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    season: input.season,
    summaries,
    rowCounts: summaries.map((summary) => ({
      sourceKey: summary.sourceKey,
      rowCount: summary.status === 'missing' ? null : summary.rowCount,
    })),
    rowsByFantasyProsId,
    rowsByPositionWeek,
  };
}

export async function loadFantasyProsMatchupCalendarContext(options: {
  season?: string;
  positions?: FantasyProsMatchupCalendarPosition[];
} = {}): Promise<FantasyProsMatchupCalendarContext> {
  const season = options.season || getCurrentRankingSeason();
  const positions = options.positions || [...FANTASYPROS_MATCHUP_CALENDAR_POSITIONS];
  const entries = await Promise.all(positions.map(async (position) => [
    position,
    await loadFantasyProsMatchupCalendarSnapshot({ season, position }),
  ] as const));

  return buildFantasyProsMatchupCalendarContext({
    season,
    positions,
    snapshots: Object.fromEntries(entries) as Partial<Record<FantasyProsMatchupCalendarPosition, FantasyProsMatchupCalendarSnapshotPayload | null>>,
  });
}
