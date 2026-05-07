import { canonicalPlayerNameKey } from './leagueAnalysis';

const FANTASYPROS_DEVY_URL = 'https://www.fantasypros.com/nfl/rankings/devy-overall.php';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const FETCH_TIMEOUT_MS = 1800;
const READER_FETCH_TIMEOUT_MS = 1200;

export interface FantasyProsDevyRanking {
  name: string;
  rank: number;
  positionRank: string;
  position: string;
  age?: number | null;
  bestRank?: number | null;
  worstRank?: number | null;
  averageRank?: number | null;
  stdDev?: number | null;
  sourceUrl: string;
}

let cachedDevyRankings: { loadedAt: number; values: Record<string, FantasyProsDevyRanking> } | null = null;

function parseNumber(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function getReaderUrls(sourceUrl: string) {
  return [
    sourceUrl,
    `https://r.jina.ai/${sourceUrl}`,
  ];
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        accept: 'text/plain, text/markdown, text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'DynastyDegeneratesBot/1.0 devy-rankings',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonAssignment(text: string, variableName: string): unknown | null {
  const marker = `var ${variableName} = `;
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const objectStart = text.indexOf('{', start + marker.length);
  if (objectStart < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') inString = true;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(text.slice(objectStart, index + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function parseFantasyProsEcrData(text: string): Record<string, FantasyProsDevyRanking> {
  const data = extractJsonAssignment(text, 'ecrData') as { players?: Array<Record<string, unknown>> } | null;
  if (!data?.players?.length) return {};
  const values: Record<string, FantasyProsDevyRanking> = {};
  for (const player of data.players) {
    const name = typeof player.player_name === 'string' ? player.player_name.trim() : '';
    const position = typeof player.player_position_id === 'string' ? player.player_position_id.toUpperCase() : '';
    const positionRank = typeof player.pos_rank === 'string' ? player.pos_rank : '';
    const rank = parseNumber(String(player.rank_ecr || ''));
    if (!name || !rank || !['QB', 'RB', 'WR', 'TE'].includes(position)) continue;
    values[canonicalPlayerNameKey(name)] = {
      name,
      rank,
      position,
      positionRank: positionRank || `${position}${rank}`,
      age: parseNumber(String(player.player_age || '')),
      bestRank: parseNumber(String(player.rank_min || '')),
      worstRank: parseNumber(String(player.rank_max || '')),
      averageRank: parseNumber(String(player.rank_ave || '')),
      stdDev: parseNumber(String(player.rank_std || '')),
      sourceUrl: FANTASYPROS_DEVY_URL,
    };
  }
  return values;
}

export function parseFantasyProsDevyMarkdown(markdown: string): Record<string, FantasyProsDevyRanking> {
  const ecrRows = parseFantasyProsEcrData(markdown);
  if (Object.keys(ecrRows).length) return ecrRows;

  const values: Record<string, FantasyProsDevyRanking> = {};
  const tableRowPattern = /^\|\s*(\d+)\s*\|\s*\[([^\]]+)\]\(([^)]*)\)\s*\|\s*([A-Z]+)(\d+)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const match = rawLine.trim().match(tableRowPattern);
    if (!match) continue;

    const rank = Number(match[1]);
    const name = match[2].trim();
    const position = match[4].trim().toUpperCase();
    const positionRank = `${position}${match[5]}`;
    if (!rank || !name || !['QB', 'RB', 'WR', 'TE'].includes(position)) continue;

    values[canonicalPlayerNameKey(name)] = {
      name,
      rank,
      position,
      positionRank,
      age: parseNumber(match[6]),
      bestRank: parseNumber(match[7]),
      worstRank: parseNumber(match[8]),
      averageRank: parseNumber(match[9]),
      stdDev: parseNumber(match[10]),
      sourceUrl: FANTASYPROS_DEVY_URL,
    };
  }

  return values;
}

export async function loadFantasyProsDevyRankings(force = false): Promise<Record<string, FantasyProsDevyRanking>> {
  if (!force && cachedDevyRankings && Date.now() - cachedDevyRankings.loadedAt < CACHE_TTL_MS) {
    return cachedDevyRankings.values;
  }

  let lastError = '';
  const urls = getReaderUrls(FANTASYPROS_DEVY_URL);
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    try {
      const response = await fetchWithTimeout(
        url,
        index === 0 ? FETCH_TIMEOUT_MS : READER_FETCH_TIMEOUT_MS
      );
      const text = await response.text();
      if (!response.ok) {
        lastError = `${response.status} ${response.statusText}`;
        continue;
      }
      const values = parseFantasyProsDevyMarkdown(text);
      if (Object.keys(values).length) {
        cachedDevyRankings = { loadedAt: Date.now(), values };
        return values;
      }
      lastError = 'unexpected page shape';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'fetch failed';
    }
  }

  console.warn('[FantasyPros Devy] Failed to load devy rankings:', lastError);
  cachedDevyRankings = { loadedAt: Date.now(), values: {} };
  return {};
}
