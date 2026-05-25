import { canonicalPlayerNameKey } from './leagueAnalysis';
import { fetchFantasyProsRookieRankings, type FantasyProsRanking } from './fantasyPros';

const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

export interface FantasyProsRookieRanking {
  name: string;
  rank: number;
  positionRank: string;
  position: string;
  age?: number | null;
  bestRank?: number | null;
  worstRank?: number | null;
  averageRank?: number | null;
  stdDev?: number | null;
}

let cachedRookieRankings: { loadedAt: number; values: Record<string, FantasyProsRookieRanking> } | null = null;

function rankingsFromApiRows(rows: Record<string, FantasyProsRanking>): Record<string, FantasyProsRookieRanking> {
  const values: Record<string, FantasyProsRookieRanking> = {};
  for (const [key, row] of Object.entries(rows || {})) {
    const rank = Number(row.overallRank || 0);
    const position = String(row.position || '').toUpperCase();
    if (!rank || !row.name || !['QB', 'RB', 'WR', 'TE'].includes(position)) continue;
    values[canonicalPlayerNameKey(row.name || key)] = {
      name: row.name,
      rank,
      position,
      positionRank: row.positionRank || `${position}${rank}`,
      age: row.age ?? null,
      bestRank: row.bestRank ?? null,
      worstRank: row.worstRank ?? null,
      averageRank: row.averageRank ?? null,
      stdDev: row.stdDev ?? null,
    };
  }
  return values;
}

export async function loadFantasyProsRookieRankings(force = false): Promise<Record<string, FantasyProsRookieRanking>> {
  if (!force && cachedRookieRankings && Date.now() - cachedRookieRankings.loadedAt < CACHE_TTL_MS) {
    return cachedRookieRankings.values;
  }

  try {
    const apiRows = await fetchFantasyProsRookieRankings();
    const values = rankingsFromApiRows(apiRows);
    cachedRookieRankings = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[FantasyPros Rookies] Failed to load rookie rankings:', error instanceof Error ? error.message : error);
    cachedRookieRankings = { loadedAt: Date.now(), values: {} };
    return {};
  }
}
