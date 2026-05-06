import { cleanName, playerNameKeyVariants } from './leagueAnalysis';

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

export interface FantasyProsNewsItem {
  title: string;
  summary?: string | null;
  source?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  playerName?: string | null;
  team?: string | null;
}

interface FantasyProsPlayerReference {
  fantasyProsId: string;
  name: string;
  position: string | null;
  team: string | null;
}

let cachedDraftRankings: { loadedAt: number; season: string; scoring: 'STD' | 'HALF' | 'PPR'; values: Record<string, FantasyProsRanking> } | null = null;
let cachedPlayerPoints: { loadedAt: number; season: string; scoring: string; values: Record<string, FantasyProsPlayerPoints> } | null = null;
let cachedNews: { loadedAt: number; values: FantasyProsNewsItem[] } | null = null;
let cachedPlayers: { loadedAt: number; values: FantasyProsPlayerReference[] } | null = null;
const cachedPlayerNews = new Map<string, { loadedAt: number; values: FantasyProsNewsItem[] }>();

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

function stripHtml(value: unknown): string | null {
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

function stringField(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return stripHtml(value);
}

function normalizeNewsRows(rows: Array<Record<string, unknown>>): FantasyProsNewsItem[] {
  return rows
    .map((item) => ({
      title: stripHtml(item.title || item.headline || item.news_title) || '',
      summary: stripHtml(item.summary || item.description || item.desc || item.news_content || item.article_body),
      source: stripHtml(item.source || item.site || item.publisher) || 'FantasyPros',
      url: stripHtml(item.url || item.link || item.article_url),
      publishedAt: stripHtml(item.published || item.published_at || item.date || item.updated_at || item.created || item.datetime),
      playerName: stripHtml(item.player_name || item.player || item.playerName),
      team: stringField(item.team_id || item.team || item.player_team_id),
    }))
    .filter((item) => item.title);
}

function newsTimestamp(value?: string | null): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortedNews(newsItems: FantasyProsNewsItem[]): FantasyProsNewsItem[] {
  return newsItems
    .map((item, index) => ({ item, index, publishedAt: newsTimestamp(item.publishedAt) }))
    .sort((a, b) => b.publishedAt - a.publishedAt || a.index - b.index)
    .map(({ item }) => item);
}

function playerNameMatches(sourceName: string, candidateName: string): boolean {
  const sourceKeys = playerNameKeyVariants(sourceName).map(cleanName).filter((key) => key.length >= 5);
  const candidateKeys = playerNameKeyVariants(candidateName).map(cleanName).filter((key) => key.length >= 5);
  return sourceKeys.some((sourceKey) => candidateKeys.includes(sourceKey));
}

export function findLatestFantasyProsNewsForPlayer(
  playerName: string,
  newsItems: FantasyProsNewsItem[]
): FantasyProsNewsItem | null {
  const playerKeys = playerNameKeyVariants(playerName).map(cleanName).filter((key) => key.length >= 5);
  if (playerKeys.length === 0) return null;

  return sortedNews(newsItems).find((item) => {
    const playerNameKey = item.playerName ? cleanName(item.playerName) : '';
    const haystack = cleanName(`${item.playerName || ''} ${item.title} ${item.summary || ''}`);
    return playerKeys.some((key) => playerNameKey === key || haystack.includes(key));
  }) || null;
}

export async function fetchFantasyProsDraftRankings(
  season = String(new Date().getFullYear()),
  scoring: 'STD' | 'HALF' | 'PPR' = 'HALF'
): Promise<Record<string, FantasyProsRanking>> {
  if (cachedDraftRankings?.season === season && cachedDraftRankings.scoring === scoring && isFresh(cachedDraftRankings)) {
    return cachedDraftRankings.values;
  }

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
    }>(`/nfl/${season}/consensus-rankings?position=ALL&type=DRAFT&scoring=${scoring}&week=0`);

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

    cachedDraftRankings = { loadedAt: Date.now(), season, scoring, values };
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

export async function fetchFantasyProsNews(): Promise<FantasyProsNewsItem[]> {
  if (cachedNews && isFresh(cachedNews)) return cachedNews.values;

  try {
    const payload = await fantasyProsFetch<{
      articles?: Array<Record<string, unknown>>;
      news?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
    }>('/nfl/news?limit=200');

    const rows = payload?.articles || payload?.news || payload?.items || [];
    const values = normalizeNewsRows(rows);

    cachedNews = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[FantasyPros] Failed to load player news:', error);
    return cachedNews?.values || [];
  }
}

export async function fetchFantasyProsPlayers(): Promise<FantasyProsPlayerReference[]> {
  if (cachedPlayers && isFresh(cachedPlayers)) return cachedPlayers.values;

  try {
    const payload = await fantasyProsFetch<{ players?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>('/nfl/players');
    const rows = Array.isArray(payload) ? payload : payload?.players || [];
    const values = rows
      .map((player) => {
        const fantasyProsId = stringField(player.fpid || player.fp_player_id || player.fantasypros_player_id || player.player_id || player.id);
        const name = stripHtml(player.player_name || player.name || player.full_name);
        if (!fantasyProsId || !name) return null;
        return {
          fantasyProsId,
          name,
          position: stripHtml(player.player_position_id || player.position_id || player.position),
          team: stringField(player.player_team_id || player.team_id || player.team),
        };
      })
      .filter((player): player is FantasyProsPlayerReference => Boolean(player));

    cachedPlayers = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[FantasyPros] Failed to load player references:', error);
    return cachedPlayers?.values || [];
  }
}

export async function fetchFantasyProsNewsForPlayer(
  fantasyProsPlayerId: string,
  limit = 5
): Promise<FantasyProsNewsItem[]> {
  const cacheKey = `${fantasyProsPlayerId}:${limit}`;
  const cached = cachedPlayerNews.get(cacheKey);
  if (isFresh(cached || null)) return cached?.values || [];

  try {
    const payload = await fantasyProsFetch<{
      articles?: Array<Record<string, unknown>>;
      news?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
    }>(`/nfl/news?fpid=${encodeURIComponent(fantasyProsPlayerId)}&limit=${limit}`);

    const rows = payload?.articles || payload?.news || payload?.items || [];
    const values = normalizeNewsRows(rows);
    cachedPlayerNews.set(cacheKey, { loadedAt: Date.now(), values });
    return values;
  } catch (error) {
    console.warn('[FantasyPros] Failed to load player-specific news:', error);
    return cached?.values || [];
  }
}

export async function fetchFantasyProsLatestPlayerNews(input: {
  playerName: string;
  team?: string | null;
  position?: string | null;
}): Promise<FantasyProsNewsItem | null> {
  const playerName = input.playerName.trim();
  if (!playerName) return null;

  const targetTeam = input.team?.toUpperCase() || null;
  const targetPosition = input.position?.toUpperCase() || null;
  const references = await fetchFantasyProsPlayers();
  const candidates = references
    .filter((reference) => playerNameMatches(playerName, reference.name))
    .map((reference) => {
      const teamMatch = targetTeam && reference.team?.toUpperCase() === targetTeam ? 1 : 0;
      const positionMatch = targetPosition && reference.position?.toUpperCase() === targetPosition ? 1 : 0;
      const exactName = cleanName(reference.name) === cleanName(playerName) ? 1 : 0;
      return {
        reference,
        score: exactName * 4 + positionMatch * 3 + teamMatch * 2,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  for (const candidate of candidates) {
    const playerNews = await fetchFantasyProsNewsForPlayer(candidate.reference.fantasyProsId, 5);
    const matchedNews = findLatestFantasyProsNewsForPlayer(playerName, playerNews) || sortedNews(playerNews)[0] || null;
    if (matchedNews) return matchedNews;
  }

  return findLatestFantasyProsNewsForPlayer(playerName, await fetchFantasyProsNews());
}
