import { cleanName } from './leagueAnalysis';

const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

export interface FantasyProsRanking {
  name: string;
  position?: string;
  team?: string | null;
  overallRank?: number;
  positionRank?: string | null;
  tier?: number | null;
  seasonValue?: number;
  lastUpdated?: string | null;
}

export interface FantasyProsPlayerPoints {
  name: string;
  position?: string;
  team?: string | null;
  games?: number | null;
  points?: number | null;
  average?: number | null;
  weeks?: Record<string, number>;
}

let cachedDraftRankings: { loadedAt: number; season: string; values: Record<string, FantasyProsRanking> } | null = null;
let cachedPlayerPoints: { loadedAt: number; season: string; scoring: string; values: Record<string, FantasyProsPlayerPoints> } | null = null;

function isFresh(cache: { loadedAt: number } | null): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function getFantasyProsApiKey(): string | null {
  return process.env.FANTASYPROS_API_KEY || null;
}

function toNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function positionRankToValue(positionRank?: string | null, overallRank?: number): number | undefined {
  if (!positionRank && !overallRank) return undefined;
  const position = positionRank?.replace(/[0-9]/g, '').toUpperCase();
  const rank = toNumber(positionRank?.match(/\d+/)?.[0]) || overallRank;
  if (!rank) return undefined;

  const replacementByPosition: Record<string, number> = {
    QB: 30,
    RB: 60,
    WR: 72,
    TE: 24,
  };
  const replacement = replacementByPosition[position || ''] || 140;
  const value = Math.max(100, Math.round(9000 * Math.pow(Math.max(0.04, (replacement - rank + 1) / replacement), 1.35)));
  return value;
}

async function fantasyProsFetch<T>(path: string): Promise<T | null> {
  const apiKey = getFantasyProsApiKey();
  if (!apiKey) return null;

  const response = await fetch(`${FANTASYPROS_BASE_URL}${path}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!response.ok) throw new Error(`FantasyPros ${response.status} ${path}`);
  return response.json() as Promise<T>;
}

export async function fetchFantasyProsDraftRankings(season = String(new Date().getFullYear())): Promise<Record<string, FantasyProsRanking>> {
  if (cachedDraftRankings?.season === season && isFresh(cachedDraftRankings)) return cachedDraftRankings.values;

  try {
    const payload = await fantasyProsFetch<{
      last_updated?: string | null;
      players?: Array<{
        player_name?: string;
        player_position_id?: string;
        player_team_id?: string | null;
        rank_ecr?: number | string;
        pos_rank?: string | null;
        tier?: number | string | null;
      }>;
    }>(`/nfl/${season}/consensus-rankings?position=ALL&type=DRAFT&scoring=HALF&week=0`);

    const values: Record<string, FantasyProsRanking> = {};
    for (const player of payload?.players || []) {
      if (!player.player_name) continue;
      const overallRank = toNumber(player.rank_ecr);
      const positionRank = player.pos_rank || null;
      values[cleanName(player.player_name)] = {
        name: player.player_name,
        position: player.player_position_id,
        team: player.player_team_id || null,
        overallRank,
        positionRank,
        tier: toNumber(player.tier) ?? null,
        seasonValue: positionRankToValue(positionRank, overallRank),
        lastUpdated: payload?.last_updated || null,
      };
    }

    cachedDraftRankings = { loadedAt: Date.now(), season, values };
    return values;
  } catch (error) {
    console.warn('[FantasyPros] Failed to load draft rankings:', error);
    return cachedDraftRankings?.values || {};
  }
}

export async function fetchFantasyProsPlayerPoints(
  season: string,
  scoring: 'STD' | 'HALF' | 'PPR' = 'HALF'
): Promise<Record<string, FantasyProsPlayerPoints>> {
  if (cachedPlayerPoints?.season === season && cachedPlayerPoints.scoring === scoring && isFresh(cachedPlayerPoints)) {
    return cachedPlayerPoints.values;
  }

  try {
    const payload = await fantasyProsFetch<{
      players?: Array<{
        player_name?: string;
        position_id?: string;
        team_id?: string | null;
        games?: number | string | null;
        points?: number | string | null;
        average?: number | string | null;
        weeks?: Record<string, number>;
      }>;
    }>(`/nfl/${season}/player-points?position=ALL&scoring=${scoring}`);

    const values: Record<string, FantasyProsPlayerPoints> = {};
    for (const player of payload?.players || []) {
      if (!player.player_name || !['QB', 'RB', 'WR', 'TE'].includes(player.position_id || '')) continue;
      values[cleanName(player.player_name)] = {
        name: player.player_name,
        position: player.position_id,
        team: player.team_id || null,
        games: toNumber(player.games) ?? null,
        points: toNumber(player.points) ?? null,
        average: toNumber(player.average) ?? null,
        weeks: player.weeks,
      };
    }

    cachedPlayerPoints = { loadedAt: Date.now(), season, scoring, values };
    return values;
  } catch (error) {
    console.warn('[FantasyPros] Failed to load player points:', error);
    return cachedPlayerPoints?.values || {};
  }
}
