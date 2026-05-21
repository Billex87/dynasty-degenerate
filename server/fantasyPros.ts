import { cleanName, playerNameKeyVariants } from './leagueAnalysis';
import { recordApiProviderCacheHit, recordApiProviderTelemetryEvent } from './apiProviderTelemetry';
import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';
import { getCurrentRankingSeason } from './rankingSeason';

const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const SEASON_RANK_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const FANTASYPROS_NEWS_SNAPSHOT_SOURCE_KEY = 'fantasypros-news-v1';

export type FantasyProsScoring = 'STD' | 'HALF' | 'PPR';
export type FantasyProsRankingType = 'DRAFT' | 'ROS' | 'DYNASTY' | 'DEVY' | 'ROOKIES' | 'ADP' | 'DYNADP' | 'RKADP';
export type FantasyProsSubSource =
  | 'draft'
  | 'ros'
  | 'dynasty'
  | 'devy'
  | 'rookies'
  | 'adp'
  | 'projections'
  | 'injuries'
  | 'news'
  | 'playerPoints';

const FANTASYPROS_SUB_SOURCE_FLAGS: Record<FantasyProsSubSource, string> = {
  draft: 'ENABLE_FANTASYPROS_DRAFT_RANKINGS',
  ros: 'ENABLE_FANTASYPROS_ROS_RANKINGS',
  dynasty: 'ENABLE_FANTASYPROS_DYNASTY_RANKINGS',
  devy: 'ENABLE_FANTASYPROS_DEVY_RANKINGS',
  rookies: 'ENABLE_FANTASYPROS_ROOKIE_RANKINGS',
  adp: 'ENABLE_FANTASYPROS_ADP_RANKINGS',
  projections: 'ENABLE_FANTASYPROS_PROJECTIONS',
  injuries: 'ENABLE_FANTASYPROS_INJURIES',
  news: 'ENABLE_FANTASYPROS_NEWS',
  playerPoints: 'ENABLE_FANTASYPROS_PLAYER_POINTS',
};

export interface FantasyProsRanking {
  name: string;
  position?: string;
  team?: string | null;
  season?: string | null;
  rankingType?: FantasyProsRankingType;
  overallRank?: number;
  positionRank?: string | null;
  tier?: number | null;
  value?: number;
  dynastyValue?: number;
  adpValue?: number;
  adp?: number | null;
  seasonValue?: number;
  totalExperts?: number | null;
  bestRank?: number | null;
  worstRank?: number | null;
  averageRank?: number | null;
  stdDev?: number | null;
  age?: number | null;
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
  sourceUrl?: string | null;
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

type FantasyProsLoadOptions = {
  sourceMode?: 'live' | 'snapshot';
  persistSnapshot?: boolean;
  forceRefresh?: boolean;
};

type FantasyProsNewsSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  items: FantasyProsNewsItem[];
};

let cachedDraftRankings: { loadedAt: number; season: string; scoring: FantasyProsScoring; values: Record<string, FantasyProsRanking> } | null = null;
const cachedConsensusRankings = new Map<string, { loadedAt: number; values: Record<string, FantasyProsRanking> }>();
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

export function hasFantasyProsApiKey(): boolean {
  return Boolean(getFantasyProsApiKey());
}

function isDisabledValue(value?: string | null): boolean {
  return /^(?:0|false|off|no|disabled)$/i.test(String(value || '').trim());
}

export function isFantasyProsSubSourceEnabled(source: FantasyProsSubSource): boolean {
  return !isDisabledValue(process.env[FANTASYPROS_SUB_SOURCE_FLAGS[source]]);
}

function toNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeFantasyProsPosition(position?: string | null): string | null {
  const normalized = String(position || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return null;
  if (['DST', 'D', 'DEFENSE'].includes(normalized)) return 'DEF';
  if (normalized === 'PK') return 'K';
  return normalized;
}

function normalizeFantasyProsPositionRank(positionRank?: string | null, fallbackPosition?: string | null): string | null {
  const rankNumber = positionRank?.match(/\d+/)?.[0];
  const rankPosition = normalizeFantasyProsPosition(positionRank?.replace(/\d+/g, '') || fallbackPosition);
  if (!rankNumber || !rankPosition) return positionRank || null;
  return `${rankPosition}${rankNumber}`;
}

function positionRankToValue(positionRank?: string | null, overallRank?: number): number | undefined {
  if (!positionRank && !overallRank) return undefined;
  const position = normalizeFantasyProsPosition(positionRank?.replace(/[0-9]/g, ''));
  const rank = toNumber(positionRank?.match(/\d+/)?.[0]) || overallRank;
  if (!rank) return undefined;

  const replacementByPosition: Record<string, number> = {
    QB: 30,
    RB: 60,
    WR: 72,
    TE: 24,
    K: 20,
    DEF: 20,
  };
  const ceilingByPosition: Record<string, number> = {
    QB: 9000,
    RB: 9000,
    WR: 9000,
    TE: 9000,
    K: 1200,
    DEF: 1200,
  };
  const replacement = replacementByPosition[position || ''] || 140;
  const ceiling = ceilingByPosition[position || ''] || 9000;
  const value = Math.max(100, Math.round(ceiling * Math.pow(Math.max(0.04, (replacement - rank + 1) / replacement), 1.35)));
  return value;
}

function overallRankToValue(overallRank?: number | null, replacement = 320): number | undefined {
  const rank = toNumber(overallRank);
  if (!rank) return undefined;
  return Math.max(100, Math.round(10000 * Math.pow(Math.max(0.025, (replacement - rank + 1) / replacement), 1.22)));
}

function rankingTypeToSubSource(type: FantasyProsRankingType): FantasyProsSubSource {
  switch (type) {
    case 'DRAFT':
      return 'draft';
    case 'ROS':
      return 'ros';
    case 'DYNASTY':
      return 'dynasty';
    case 'DEVY':
      return 'devy';
    case 'ROOKIES':
      return 'rookies';
    case 'ADP':
    case 'DYNADP':
    case 'RKADP':
      return 'adp';
    default:
      return 'draft';
  }
}

async function fantasyProsFetch<T>(path: string): Promise<T | null> {
  const apiKey = getFantasyProsApiKey();
  if (!apiKey) return null;

  const startedAt = Date.now();
  const endpoint = path.split('?')[0] || path;
  try {
    const response = await fetch(`${FANTASYPROS_BASE_URL}${path}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!response.ok) {
      recordApiProviderTelemetryEvent({
        provider: 'FantasyPros',
        endpoint,
        status: response.status,
        ok: false,
        durationMs: Date.now() - startedAt,
        cacheStatus: 'miss',
        costUnits: 1,
        scope: 'cron',
        message: `FantasyPros ${response.status}`,
      });
      throw new Error(`FantasyPros ${response.status} ${path}`);
    }
    const payload = await response.json() as T;
    recordApiProviderTelemetryEvent({
      provider: 'FantasyPros',
      endpoint,
      status: response.status,
      ok: true,
      durationMs: Date.now() - startedAt,
      cacheStatus: 'miss',
      costUnits: 1,
      scope: 'cron',
      message: null,
    });
    return payload;
  } catch (error) {
    if (!(error instanceof Error && /^FantasyPros \d+ /.test(error.message))) {
      recordApiProviderTelemetryEvent({
        provider: 'FantasyPros',
        endpoint,
        status: null,
        ok: false,
        durationMs: Date.now() - startedAt,
        cacheStatus: 'miss',
        costUnits: 1,
        scope: 'cron',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

export function normalizeFantasyProsRankingsPayload(
  payload: {
    year?: string | number | null;
    last_updated?: string | null;
    total_experts?: number | string | null;
    players?: Array<Record<string, unknown>>;
  } | null | undefined,
  options: {
    season?: string;
    rankingType?: FantasyProsRankingType;
  } = {},
): Record<string, FantasyProsRanking> {
  const rankingType = options.rankingType || 'DRAFT';
  const totalExperts = toNumber(payload?.total_experts) ?? null;
  const values: Record<string, FantasyProsRanking> = {};

  for (const player of payload?.players || []) {
    const name = stringField(player.player_name || player.name);
    if (!name) continue;
    const position = normalizeFantasyProsPosition(stringField(player.player_position_id || player.position_id || player.position));
    const overallRank = toNumber(player.rank_ecr ?? player.rank ?? player.rank_ave ?? player.rank_average ?? player.adp);
    const positionRank = normalizeFantasyProsPositionRank(stringField(player.pos_rank || player.position_rank), position);
    const rankValue = overallRankToValue(overallRank);
    const seasonValue = rankingType === 'DRAFT' || rankingType === 'ROS' || rankingType === 'ADP'
      ? positionRankToValue(positionRank, overallRank) ?? rankValue
      : undefined;
    const dynastyValue = rankingType === 'DYNASTY' ? rankValue : undefined;
    const adpValue = rankingType === 'ADP' || rankingType === 'DYNADP' || rankingType === 'RKADP'
      ? rankValue
      : undefined;

    values[cleanName(name)] = {
      name,
      position: position || undefined,
      team: stringField(player.player_team_id || player.team_id || player.team),
      season: String(options.season || payload?.year || '') || null,
      rankingType,
      overallRank,
      positionRank,
      tier: toNumber(player.tier) ?? null,
      value: dynastyValue ?? seasonValue ?? adpValue ?? rankValue,
      dynastyValue,
      adpValue,
      adp: rankingType === 'ADP' || rankingType === 'DYNADP' || rankingType === 'RKADP' ? overallRank ?? null : null,
      seasonValue,
      totalExperts,
      age: toNumber(player.player_age || player.age) ?? null,
      bestRank: toNumber(player.rank_min || player.best_rank) ?? null,
      worstRank: toNumber(player.rank_max || player.worst_rank) ?? null,
      averageRank: toNumber(player.rank_ave || player.rank_average) ?? null,
      stdDev: toNumber(player.rank_std || player.std_dev) ?? null,
      lastUpdated: payload?.last_updated || null,
    };
  }

  return values;
}

export async function fetchFantasyProsConsensusRankings({
  season = getCurrentRankingSeason(),
  scoring = 'PPR',
  rankingType = 'DRAFT',
  position = 'ALL',
  week = 0,
}: {
  season?: string;
  scoring?: FantasyProsScoring;
  rankingType?: FantasyProsRankingType;
  position?: string;
  week?: number;
} = {}): Promise<Record<string, FantasyProsRanking>> {
  if (!isFantasyProsSubSourceEnabled(rankingTypeToSubSource(rankingType))) return {};
  const cacheKey = `${season}:${scoring}:${rankingType}:${position}:${week}`;
  const cached = cachedConsensusRankings.get(cacheKey);
  if (isFresh(cached || null)) {
    recordApiProviderCacheHit({
      provider: 'FantasyPros',
      endpoint: `/NFL/${season}/consensus-rankings`,
      job: rankingType,
      scope: 'cron',
    });
    return cached?.values || {};
  }

  try {
    const params = new URLSearchParams({
      position,
      type: rankingType,
      scoring,
      week: String(week),
    });
    const payload = await fantasyProsFetch<{
      year?: string | number | null;
      last_updated?: string | null;
      total_experts?: number | string | null;
      players?: Array<Record<string, unknown>>;
    }>(`/NFL/${season}/consensus-rankings?${params.toString()}`);
    const values = normalizeFantasyProsRankingsPayload(payload, { season, rankingType });
    cachedConsensusRankings.set(cacheKey, { loadedAt: Date.now(), values });
    return values;
  } catch (error) {
    console.warn(`[FantasyPros] Failed to load ${rankingType} rankings:`, error);
    return cached?.values || {};
  }
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

function parseFantasyProsNewsSnapshot(payload?: string | null): FantasyProsNewsSnapshotPayload | null {
  const parsed = parseProviderSnapshotPayload<Partial<FantasyProsNewsSnapshotPayload>>(payload);
  if (
    parsed?.schemaVersion !== 1 ||
    typeof parsed.snapshotKey !== 'string' ||
    !Array.isArray(parsed.items)
  ) {
    return null;
  }

  return parsed as FantasyProsNewsSnapshotPayload;
}

async function loadStoredFantasyProsNews(): Promise<FantasyProsNewsItem[]> {
  const stored = await findLatestProviderDataSnapshot(FANTASYPROS_NEWS_SNAPSHOT_SOURCE_KEY);
  const snapshot = parseFantasyProsNewsSnapshot(stored?.payload);
  if (!snapshot) return cachedNews?.values || [];

  cachedNews = { loadedAt: Date.now(), values: snapshot.items };
  return snapshot.items;
}

async function persistFantasyProsNewsSnapshot(items: FantasyProsNewsItem[], now = new Date()) {
  const snapshotKey = getProviderSnapshotDateKey(now);
  const payload: FantasyProsNewsSnapshotPayload = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    snapshotKey,
    items,
  };

  try {
    await upsertProviderDataSnapshot({
      sourceKey: FANTASYPROS_NEWS_SNAPSHOT_SOURCE_KEY,
      snapshotKey,
      payload: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('[FantasyPros] Failed to persist news snapshot:', error);
  }
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
  season = getCurrentRankingSeason(),
  scoring: FantasyProsScoring = 'HALF'
): Promise<Record<string, FantasyProsRanking>> {
  if (cachedDraftRankings?.season === season && cachedDraftRankings.scoring === scoring && isFresh(cachedDraftRankings)) {
    recordApiProviderCacheHit({
      provider: 'FantasyPros',
      endpoint: `/NFL/${season}/consensus-rankings`,
      job: 'DRAFT',
      scope: 'cron',
    });
    return cachedDraftRankings.values;
  }

  const values = await fetchFantasyProsConsensusRankings({ season, scoring, rankingType: 'DRAFT' });
  cachedDraftRankings = { loadedAt: Date.now(), season, scoring, values };
  return values;
}

export async function fetchFantasyProsDynastyRankings(
  season = getCurrentRankingSeason(),
  scoring: FantasyProsScoring = 'PPR'
): Promise<Record<string, FantasyProsRanking>> {
  return fetchFantasyProsConsensusRankings({ season, scoring, rankingType: 'DYNASTY' });
}

export async function fetchFantasyProsDevyRankings(
  season = getCurrentRankingSeason(),
  scoring: FantasyProsScoring = 'PPR'
): Promise<Record<string, FantasyProsRanking>> {
  return fetchFantasyProsConsensusRankings({ season, scoring, rankingType: 'DEVY' });
}

export async function fetchFantasyProsRookieRankings(
  season = getCurrentRankingSeason(),
  scoring: FantasyProsScoring = 'PPR'
): Promise<Record<string, FantasyProsRanking>> {
  return fetchFantasyProsConsensusRankings({ season, scoring, rankingType: 'ROOKIES' });
}

export async function fetchFantasyProsAdpRankings(
  season = getCurrentRankingSeason(),
  scoring: FantasyProsScoring = 'PPR'
): Promise<Record<string, FantasyProsRanking>> {
  return fetchFantasyProsConsensusRankings({ season, scoring, rankingType: 'ADP' });
}

export async function fetchFantasyProsPlayerPoints(
  season: string,
  scoring: FantasyProsScoring = 'HALF'
): Promise<Record<string, FantasyProsPlayerPoints>> {
  if (!isFantasyProsSubSourceEnabled('playerPoints')) return {};
  if (cachedPlayerPoints?.season === season && cachedPlayerPoints.scoring === scoring && isFresh(cachedPlayerPoints)) {
    recordApiProviderCacheHit({
      provider: 'FantasyPros',
      endpoint: `/nfl/${season}/player-points`,
      job: 'playerPoints',
      scope: 'cron',
    });
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
      const position = normalizeFantasyProsPosition(player.position_id);
      if (!player.player_name || !position || !SEASON_RANK_POSITIONS.has(position)) continue;
      values[cleanName(player.player_name)] = {
        name: player.player_name,
        position,
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

export async function fetchFantasyProsNews(options: FantasyProsLoadOptions = {}): Promise<FantasyProsNewsItem[]> {
  if (!isFantasyProsSubSourceEnabled('news')) return [];
  if (options.sourceMode === 'snapshot') {
    return loadStoredFantasyProsNews();
  }

  if (!options.forceRefresh && cachedNews && isFresh(cachedNews)) {
    recordApiProviderCacheHit({
      provider: 'FantasyPros',
      endpoint: '/NFL/news',
      job: 'news',
      scope: 'cron',
    });
    if (options.persistSnapshot) await persistFantasyProsNewsSnapshot(cachedNews.values);
    return cachedNews.values;
  }

  try {
    const payload = await fantasyProsFetch<{
      articles?: Array<Record<string, unknown>>;
      news?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
    }>('/NFL/news?limit=200');

    const rows = payload?.articles || payload?.news || payload?.items || [];
    const values = normalizeNewsRows(rows);

    cachedNews = { loadedAt: Date.now(), values };
    if (options.persistSnapshot) await persistFantasyProsNewsSnapshot(values);
    return values;
  } catch (error) {
    console.warn('[FantasyPros] Failed to load player news:', error);
    return cachedNews?.values || [];
  }
}

export async function fetchFantasyProsPlayers(): Promise<FantasyProsPlayerReference[]> {
  if (!hasFantasyProsApiKey()) return [];
  if (cachedPlayers && isFresh(cachedPlayers)) {
    recordApiProviderCacheHit({
      provider: 'FantasyPros',
      endpoint: '/NFL/players',
      job: 'players',
      scope: 'cron',
    });
    return cachedPlayers.values;
  }

  try {
    const payload = await fantasyProsFetch<{ players?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>('/NFL/players');
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
  if (!isFantasyProsSubSourceEnabled('news')) return [];
  const cacheKey = `${fantasyProsPlayerId}:${limit}`;
  const cached = cachedPlayerNews.get(cacheKey);
  if (isFresh(cached || null)) {
    recordApiProviderCacheHit({
      provider: 'FantasyPros',
      endpoint: '/NFL/news',
      job: 'playerNews',
      scope: 'cron',
    });
    return cached?.values || [];
  }

  try {
    const payload = await fantasyProsFetch<{
      articles?: Array<Record<string, unknown>>;
      news?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
    }>(`/NFL/news?fpid=${encodeURIComponent(fantasyProsPlayerId)}&limit=${limit}`);

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
  sourceMode?: 'live' | 'snapshot';
}): Promise<FantasyProsNewsItem | null> {
  const playerName = input.playerName.trim();
  if (!playerName) return null;

  if (input.sourceMode === 'snapshot') {
    return findLatestFantasyProsNewsForPlayer(playerName, await fetchFantasyProsNews({ sourceMode: 'snapshot' }));
  }

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
