import crypto from 'node:crypto';
import { findLeagueReportCache, upsertLeagueReportCache } from './db';
import { getLeagueReportCacheTtlMs } from './leagueReportCachePolicy';
import type { PlayerDetails, PlayerScheduleProfile, ProspectProfile } from '../shared/types';
import type { LastSeasonPlayerRank } from './reportGenerator';

const REPORT_PLAYER_ENRICHMENT_CACHE_VERSION = 'league-report-player-enrichment-v1';

type PlayerAvailabilityHistory = {
  availabilityHistory?: PlayerDetails['availabilityHistory'];
  avgGamesMissed?: number | null;
  availabilitySeasons?: number | null;
};

type SleeperResearchSnapshot = {
  owned?: unknown;
  started?: unknown;
};

type LeagueUsageSummary = NonNullable<PlayerDetails['leagueUsage']>;

export type ReportPlayerStaticEnrichment = Pick<
  PlayerDetails,
  | 'valueProfile'
  | 'lastSeasonPositionRank'
  | 'lastSeasonFantasyPoints'
  | 'lastSeasonGames'
  | 'lastSeasonPointsPerGame'
  | 'lastSeasonYear'
  | 'availabilityHistory'
  | 'latestNews'
  | 'avgGamesMissed'
  | 'availabilitySeasons'
  | 'sleeperRosteredPct'
  | 'sleeperStartedPct'
  | 'sleeperResearchSeason'
  | 'sleeperResearchSeasonType'
  | 'leagueUsage'
  | 'schedule'
  | 'similarTradeValues'
  | 'prospectProfile'
>;

export type ReportPlayerStaticEnrichmentPayload = {
  cacheKey: string;
  cacheStatus: 'hit' | 'miss';
  generatedAt: string;
  playerEnrichmentById: Record<string, Partial<ReportPlayerStaticEnrichment>>;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stableHash(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 16);
}

function normalizePlayerIds(playerIds: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(playerIds).map((playerId) => String(playerId || '').trim()).filter(Boolean))).sort();
}

function normalizeSleeperResearchPercent(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : null;
}

export function getReportPlayerEnrichmentCacheKey(input: {
  leagueValueProfileKey: string;
  currentSeason: string;
  lastCompletedSeason: string;
  sleeperResearchSeasonType: string;
  playerIds: Iterable<string>;
  sourceSignature?: string;
}): string {
  const playerIds = normalizePlayerIds(input.playerIds);
  return [
    REPORT_PLAYER_ENRICHMENT_CACHE_VERSION,
    input.leagueValueProfileKey || 'default',
    input.currentSeason || 'current',
    input.lastCompletedSeason || 'previous',
    input.sleeperResearchSeasonType || 'regular',
    stableHash(playerIds),
    input.sourceSignature || 'default',
  ].join(':');
}

export function isReportPlayerStaticEnrichmentPayload(value: unknown): value is Omit<ReportPlayerStaticEnrichmentPayload, 'cacheStatus'> {
  return Boolean(
    isRecord(value) &&
    typeof value.cacheKey === 'string' &&
    typeof value.generatedAt === 'string' &&
    isRecord(value.playerEnrichmentById)
  );
}

export function buildReportPlayerStaticEnrichment(input: {
  playerIds: Iterable<string>;
  currentSeason: string;
  sleeperResearchSeasonType: string;
  valueProfilesById: Record<string, PlayerDetails['valueProfile']>;
  lastSeasonPositionRanks: Record<string, LastSeasonPlayerRank>;
  availabilityHistoryById: Record<string, PlayerAvailabilityHistory>;
  latestNewsByPlayerId: Record<string, NonNullable<PlayerDetails['latestNews']>>;
  sleeperResearchByPlayerId: Record<string, SleeperResearchSnapshot>;
  pastSeasonUsageByPlayerId: Record<string, LeagueUsageSummary>;
  playerScheduleProfiles: Record<string, PlayerScheduleProfile>;
  similarTradeValuesById: Record<string, NonNullable<PlayerDetails['similarTradeValues']>>;
  prospectProfilesById: Record<string, ProspectProfile | null>;
}): Record<string, Partial<ReportPlayerStaticEnrichment>> {
  return Object.fromEntries(
    normalizePlayerIds(input.playerIds).map((playerId) => {
      const lastSeasonRank = input.lastSeasonPositionRanks[playerId];
      const availability = input.availabilityHistoryById[playerId];
      return [
        playerId,
        {
          valueProfile: input.valueProfilesById[playerId],
          lastSeasonPositionRank: lastSeasonRank?.positionRank || null,
          lastSeasonFantasyPoints: lastSeasonRank?.fantasyPoints ?? null,
          lastSeasonGames: lastSeasonRank?.games ?? null,
          lastSeasonPointsPerGame: lastSeasonRank?.pointsPerGame ?? null,
          lastSeasonYear: lastSeasonRank?.season || null,
          availabilityHistory: availability?.availabilityHistory || [],
          latestNews: input.latestNewsByPlayerId[playerId] || null,
          avgGamesMissed: availability?.avgGamesMissed ?? null,
          availabilitySeasons: availability?.availabilitySeasons ?? 0,
          sleeperRosteredPct: normalizeSleeperResearchPercent(input.sleeperResearchByPlayerId[playerId]?.owned),
          sleeperStartedPct: normalizeSleeperResearchPercent(input.sleeperResearchByPlayerId[playerId]?.started),
          sleeperResearchSeason: input.currentSeason,
          sleeperResearchSeasonType: input.sleeperResearchSeasonType,
          leagueUsage: input.pastSeasonUsageByPlayerId[playerId] || null,
          schedule: input.playerScheduleProfiles[playerId] || null,
          similarTradeValues: input.similarTradeValuesById[playerId] || [],
          prospectProfile: input.prospectProfilesById[playerId] || null,
        },
      ];
    })
  );
}

export async function loadReportPlayerStaticEnrichment(input: {
  leagueId: string;
  leagueValueProfileKey: string;
  currentSeason: string;
  lastCompletedSeason: string;
  sleeperResearchSeasonType: string;
  playerIds: Iterable<string>;
  sourceSignature?: string;
  buildEnrichment: () => Promise<Record<string, Partial<ReportPlayerStaticEnrichment>>> | Record<string, Partial<ReportPlayerStaticEnrichment>>;
  forceRefresh?: boolean;
}): Promise<ReportPlayerStaticEnrichmentPayload> {
  const playerIds = normalizePlayerIds(input.playerIds);
  const cacheKey = getReportPlayerEnrichmentCacheKey({
    leagueValueProfileKey: input.leagueValueProfileKey,
    currentSeason: input.currentSeason,
    lastCompletedSeason: input.lastCompletedSeason,
    sleeperResearchSeasonType: input.sleeperResearchSeasonType,
    playerIds,
    sourceSignature: input.sourceSignature,
  });

  if (!input.forceRefresh) {
    const cached = await findLeagueReportCache(cacheKey, getLeagueReportCacheTtlMs());
    if (isReportPlayerStaticEnrichmentPayload(cached)) {
      return {
        ...cached,
        cacheStatus: 'hit',
      };
    }
  }

  const payload: Omit<ReportPlayerStaticEnrichmentPayload, 'cacheStatus'> = {
    cacheKey,
    generatedAt: new Date().toISOString(),
    playerEnrichmentById: await input.buildEnrichment(),
  };

  await upsertLeagueReportCache({
    cacheKey,
    leagueId: input.leagueId,
    viewerUserId: null,
    payload,
  });

  return {
    ...payload,
    cacheStatus: 'miss',
  };
}
