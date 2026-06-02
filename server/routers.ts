import { COOKIE_NAME, ONE_YEAR_MS, UNAUTHED_ERR_MSG } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { hasAdminPermissionIdentifier, hasAdminPermissionsForUser } from "./_core/adminAccess";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { LOCAL_ADMIN_OPEN_ID, sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { loadBlendedKTCValues, loadKTCValuesLastWeek, loadLatestLocalKtcSnapshotBefore, loadLatestLocalWeeklyMomentumSnapshot } from "./ktcLoader";
import type { KTCValues, LastSeasonPlayerRank } from "./reportGenerator";
import { getKtcSnapshotFromDaysAgo, getKtcSnapshotOnOrBeforeDate } from "./ktcSnapshotJob";
import { generateReport } from "./reportGenerator";
import { fetchDraftData, calculateADPFromPicks, analyzeDraftPicks } from "./draftAnalysis";
import { buildSleeperRookieAdpData } from "./sleeperRookieAdp";
import { buildSleeperStartupAdpData } from "./startupAdpSnapshots";
import { getRookieValueBaseline, getRookieValueBaselines } from "./rookieValueBaselines";
import { fetchPlayerHeadshot, getCachedImage } from "./imageProxy";
import { cleanName, getPickValue, getPlayerName, getPlayerValue, playerNameKeyVariants } from "./leagueAnalysis";
import { fetchLatestPlayerNews, findLatestPlayerNewsForPlayer, type PlayerNewsItem } from "./playerNews";
import { buildRankingsBoard } from "./rankingsBoard";
import { attachLeagueAiConfidence, loadRecentLeagueAiConfidenceSnapshots, persistLeagueAiConfidenceSnapshot } from "./leagueAiConfidence";
import { fetchEspnDepthChartsForPlayersWithDiagnostics, type EspnDepthChartEntry } from "./espnDepthCharts";
import { buildMatchupPreviews, buildSchedulePlanningSummary } from "./schedulePlanning";
import { buildProspectLookup, findProspectProfile, loadProspectContext } from "./prospectSource";
import { fetchSleeperSeasonStats, MIN_SLEEPER_SEASON } from "./sleeperSeasonStats";
import { assertUserLoadAllowedLiveProviderUrl, fetchUserLoadJson, fetchUserLoadResponse, getUserLoadSnapshotOptions } from "./loadTimeProviderPolicy";
import { slimCachedLeagueReportPayload } from "./reportPayloadSlimming";
import { buildRankingDraftBuzzDetail, buildRankingProfileDetail, buildRankingsMetadata } from "./rankingPayloadViews";
import { getLeagueReportCacheTtlHours, getLeagueReportCacheTtlMs, getLeagueReportFileCacheMaxFiles, isLeagueReportCacheExpired, shouldPruneLeagueReportFileCacheEntry, shouldUseLeagueReportFileCache } from "./leagueReportCachePolicy";
import { shouldBypassLeagueReportCache } from "./leagueReportCacheDecision";
import { loadReportStaticInputs } from "./reportStaticInputs";
import { loadReportSourceDiagnosticsSection, loadReportStaticSections } from "./reportStaticSections";
import { buildReportPlayerStaticEnrichment, loadReportPlayerStaticEnrichment } from "./reportPlayerEnrichment";
import { buildPlayerValueTimelineMap, getPlayerValueTimelineForPlayer, loadStoredValueTimelineSnapshotsForPlayers, slimPlayerValueTimelineForReport } from "./playerValueTimeline";
import { getRedraftValueTimelineForPlayer } from "./redraftValueTimeline";
import { buildFantasyProsPlayerSourceTrace } from "./fantasyProsPlayerSourceTrace";
import {
  loadFantasyProsSnapshotContext,
  type FantasyProsConsensusSnapshotRow,
  type FantasyProsSnapshotSummary,
  type FantasyProsSnapshotContext,
} from "./fantasyProsSnapshotContext";
import {
  getDraftSharksScheduleProfile,
  type DraftSharksScheduleContext,
  type DraftSharksSosProfile,
  type DraftSharksWeeklySos,
} from "./draftSharksSchedule";
import { buildPlayerCohortProfiles } from "./playerCohortEngine";
import { buildPlayerSituationDeltas } from "./playerSituationDelta";
import { filterCompletedFuturePickPortfolios } from "../shared/pickPortfolioFilters";
import { assertCanUseFeature } from "./featureEntitlements";
import { buildLeaguePlayoffWeeks, buildMatchupWindowSet, getShortTermMatchupOutlook } from "../shared/matchupWindows";
import {
  buildNflverseDraftCapitalBySleeperId,
  enrichPlayerDetailsWithNflverseDraftCapital,
  loadNflverseDraftCapitalSnapshot,
  NFLVERSE_DRAFT_CAPITAL_SOURCE_KEY,
} from "./nflverseDraftCapital";
import {
  enrichPlayerDetailsWithNflverseContext,
  loadNflversePlayerContext,
} from "./nflversePlayerContext";
import {
  getFantasyProsScoringForPpr,
  getKtcProfileKeyForValueOptions,
  getValueSourceProfileKey,
  getValueSourceProfileLabel,
  normalizePpr,
  normalizeTep,
  type ValueBlendOptions,
} from "./valueBlend";
import { buildProjectionSnapshotHealthDiagnostic } from "./projectionAdminDiagnostics";
import { getProjectionGate, getProjectionReadinessGate } from "./projectionFeatureFlags";
import {
  applySleeperTightEndPremium,
  getSleeperProjectionScoringProfile,
  loadStoredSleeperProjectionSnapshot,
  type SleeperProjectionScoringProfile,
} from "./sleeperProjectionSnapshots";
import { findLatestSleeperHiddenLeagueSnapshot, findLeagueReportCache, findLeagueReportCacheMetadata, insertLoginAttempt, listActionPlans, listAiPredictionEvents, listMonthlyRosterBlueprintSnapshots, listWaiverBidHistory, parseLeagueReportCachePayloadFromStorage, reserveMonthlyReportGeneration, serializeLeagueReportCachePayloadForStorage, updateAiPredictionOutcome, upsertAiPredictionEvent, upsertLeagueReportCache, upsertMonthlyRosterBlueprintSnapshots, upsertSleeperHiddenLeagueSnapshot, upsertUser } from "./db";
import { isCurrentFantasySkillPlayer, isCurrentSeasonLineupPlayer, normalizeSeasonLineupPosition } from "./playerEligibility";
import type { LeagueDraftStatus, LeagueValueMode, ManagerChampionship, ManagerIntelPlayer, ManagerRosterIntelligence, PickPortfolio, PlayerDetails, RecentTransaction, RecentTransactionPlayer, ReportData, SleeperHiddenLeagueSnapshot, SleeperWaiverClaimSignal, TrendingPlayer, WaiverIntelligence, WaiverOmittedCandidate, WaiverSourceTraceEntry, WaiverWeeklyEcrSignal, WaiverWeeklyEcrTarget, WeeklyProjectionContext } from "../shared/types";
import { buildAICalibrationAdjustmentProfile, type AIPredictionEvent, type AIPredictionOutcome, type AISourceAgreementRead } from "./aiPredictionCalibration";
import type { AICounterfactualRead, AIDecisionSnapshot, AIPredictionDecayProfile, AIRealizedEdge } from "../shared/aiDecisionSnapshots";
import type { RecommendationObservedOutcome } from "../shared/recommendationOutcome";

function normalizeManagerName(name: string | undefined): string {
  const fallback = name || 'Unknown';
  return fallback.replace(/\d+$/, '') || fallback;
}

const SLEEPER_ENTITY_ID_PATTERN = /^\d{8,24}$/;

function getValidSleeperEntityId(value: unknown): string {
  const id = String(value || '').trim();
  return SLEEPER_ENTITY_ID_PATTERN.test(id) ? id : '';
}

function getPreviousSleeperLeagueId(leagueInfo: any): string {
  return getValidSleeperEntityId(leagueInfo?.previous_league_id);
}

function buildCurrentSeasonMainDraftDiagnostics(
  draftPicks: any[],
  currentSeason: string
): Pick<
  NonNullable<ReportData['leagueDiagnostics']>,
  | 'hasCurrentSeasonMainDraft'
  | 'currentSeasonMainDraftPickCount'
  | 'currentSeasonMainDraftPickedPlayerCount'
  | 'currentSeasonMainDraftStatus'
> {
  const season = String(currentSeason || '').trim();
  const currentSeasonMainPicks = (draftPicks || []).filter((pick) => {
    const draftYear = String(pick?.draftYear || '').trim();
    const draftKind = String(pick?.draftKind || 'main').toLowerCase();
    return draftYear === season && draftKind === 'main';
  });
  const pickedPlayers = currentSeasonMainPicks.filter((pick) => {
    const playerName = String(pick?.playerName || '').trim();
    return Boolean(pick?.player_id) || (Boolean(playerName) && playerName.toLowerCase() !== 'unknown');
  });
  const expectedPickCount = Math.max(
    0,
    ...currentSeasonMainPicks
      .map((pick) => Number(pick?.draftPickCount || 0))
      .filter((value) => Number.isFinite(value))
  );
  const pickedCount = pickedPlayers.length;
  const status: NonNullable<ReportData['leagueDiagnostics']>['currentSeasonMainDraftStatus'] =
    pickedCount <= 0
      ? 'not_started'
      : expectedPickCount > 0 && pickedCount < expectedPickCount
        ? 'in_progress'
        : 'complete';

  return {
    hasCurrentSeasonMainDraft: pickedCount > 0,
    currentSeasonMainDraftPickCount: currentSeasonMainPicks.length,
    currentSeasonMainDraftPickedPlayerCount: pickedCount,
    currentSeasonMainDraftStatus: status,
  };
}

function normalizeSleeperDraftStatus(leagueInfo: any): Pick<
  NonNullable<ReportData['leagueDiagnostics']>,
  'draftStatus' | 'draftStatusLabel' | 'sleeperStatus' | 'sleeperSeasonType'
> {
  const sleeperStatus = typeof leagueInfo?.status === 'string' ? leagueInfo.status : null;
  const sleeperSeasonType = typeof leagueInfo?.season_type === 'string' ? leagueInfo.season_type : null;
  const normalized = String(sleeperStatus || '').trim().toLowerCase();
  let draftStatus: LeagueDraftStatus = 'unknown';

  if (normalized === 'pre_draft') draftStatus = 'pre_draft';
  else if (normalized === 'drafting') draftStatus = 'drafting';
  else if (normalized === 'in_season') draftStatus = 'in_season';
  else if (normalized === 'complete' || normalized === 'post_season') draftStatus = 'complete';

  const draftStatusLabel =
    draftStatus === 'pre_draft'
      ? 'Pre-draft'
      : draftStatus === 'drafting'
        ? 'Drafting'
        : draftStatus === 'in_season'
          ? 'In season'
          : draftStatus === 'complete'
            ? 'Complete'
            : 'Draft status unknown';

  return {
    draftStatus,
    draftStatusLabel,
    sleeperStatus,
    sleeperSeasonType,
  };
}

function getActionPlanUserKey(user: NonNullable<TrpcContext["user"]>): string {
  return user.openId || String(user.id);
}

function attachEnrichedPlayerDetails<T extends ManagerIntelPlayer | null | undefined>(
  player: T,
  playerDetailsById: Record<string, PlayerDetails>
): T {
  if (!player?.player_id) return player;
  const enriched = playerDetailsById[player.player_id];
  if (!enriched) return player;
  return {
    ...player,
    playerDetails: {
      ...(player.playerDetails || {}),
      ...enriched,
    },
  } as T;
}

function attachEnrichedPlayerDetailsList<T extends ManagerIntelPlayer>(
  players: T[] | undefined,
  playerDetailsById: Record<string, PlayerDetails>
): T[] | undefined {
  return players?.map((player) => attachEnrichedPlayerDetails(player, playerDetailsById) as T);
}

function collectManagerSituationPlayers(row: ManagerRosterIntelligence): ManagerIntelPlayer[] {
  const seen = new Set<string>();
  const players = [
    row.bestBenchStash,
    row.weakestStarter,
    row.oldestPlayer,
    row.youngCorePlayer,
    row.breakoutCandidate,
    row.lastSeasonStud,
    row.buyTarget,
    row.sellCandidate,
    row.tradeChip,
    row.injuryInsurance,
    row.starterAvailability.riskiestStarter,
    ...(row.rosterPlayers || []),
    ...(row.benchPlayers || []),
    ...(row.taxiPlayers || []),
    ...(row.reservePlayers || []),
  ].filter((player): player is ManagerIntelPlayer => Boolean(player?.player_id));

  return players.filter((player) => {
    if (seen.has(player.player_id)) return false;
    seen.add(player.player_id);
    return true;
  });
}

function buildManagerSituationSummary(row: ManagerRosterIntelligence): NonNullable<ManagerRosterIntelligence['situationSummary']> {
  const players = collectManagerSituationPlayers(row);
  const deltas = players
    .map((player) => ({
      player,
      delta: player.playerDetails?.playerSituationDelta || null,
    }))
    .filter((entry) => entry.delta);
  const strong = deltas.filter((entry) => (entry.delta?.confidence || 0) >= 70 && entry.delta?.primaryLabel !== 'source-limited-route-read');
  const boosts = deltas.filter((entry) => entry.delta?.action === 'buy' || entry.delta?.action === 'stash' || entry.delta?.labels.includes('role-boost') || entry.delta?.labels.includes('vacated-opportunity'));
  const risks = deltas.filter((entry) => entry.delta?.action === 'sell' || entry.delta?.action === 'avoid' || entry.delta?.labels.includes('role-threat') || entry.delta?.labels.includes('crowded-room') || entry.delta?.labels.includes('opportunity-cliff'));
  const stale = deltas.filter((entry) => {
    const grade = entry.delta?.freshness?.grade;
    return grade === 'stale' || grade === 'missing';
  });
  const sourceLimited = deltas.filter((entry) => entry.delta?.labels.includes('source-limited-route-read'));
  const topBoost = [...boosts].sort((a, b) => (b.delta?.score || 0) - (a.delta?.score || 0))[0] || null;
  const topRisk = [...risks].sort((a, b) => (a.delta?.score || 100) - (b.delta?.score || 100))[0] || null;
  const dynamicSignalLabels = deltas
    .flatMap((entry) => entry.delta?.dynamicSignals || [])
    .map((signal) => signal.label)
    .filter(Boolean);
  const signals = Array.from(new Set([
    boosts.length ? `${boosts.length} role/opportunity boost${boosts.length === 1 ? '' : 's'}` : null,
    risks.length ? `${risks.length} role-risk signal${risks.length === 1 ? '' : 's'}` : null,
    stale.length ? `${stale.length} stale/thin situation read${stale.length === 1 ? '' : 's'}` : null,
    ...dynamicSignalLabels,
  ].filter(Boolean) as string[])).slice(0, 5);

  return {
    playerCount: players.length,
    backedCount: deltas.length,
    strongCount: strong.length,
    boostCount: boosts.length,
    riskCount: risks.length,
    staleCount: stale.length,
    sourceLimitedCount: sourceLimited.length,
    topBoostPlayer: topBoost?.player.name || null,
    topRiskPlayer: topRisk?.player.name || null,
    note: deltas.length
      ? `${deltas.length}/${players.length} roster assets have football-context reads; ${boosts.length} boost, ${risks.length} risk${topBoost?.player.name ? `, top boost ${topBoost.player.name}` : ''}${topRisk?.player.name ? `, main risk ${topRisk.player.name}` : ''}.`
      : 'No roster assets have a situation-delta read yet, so manager copy should stay on value, age, and roster-shape context.',
    signals,
  };
}

function attachManagerSituationContext(
  rows: ManagerRosterIntelligence[] | undefined,
  playerDetailsById: Record<string, PlayerDetails>
): ManagerRosterIntelligence[] | undefined {
  return rows?.map((row) => {
    const attach = <T extends ManagerIntelPlayer | null | undefined>(player: T) => attachEnrichedPlayerDetails(player, playerDetailsById);
    const next: ManagerRosterIntelligence = {
      ...row,
      bestBenchStash: attach(row.bestBenchStash),
      weakestStarter: attach(row.weakestStarter),
      oldestPlayer: attach(row.oldestPlayer),
      youngCorePlayer: attach(row.youngCorePlayer),
      breakoutCandidate: attach(row.breakoutCandidate),
      lastSeasonStud: attach(row.lastSeasonStud),
      buyTarget: attach(row.buyTarget),
      sellCandidate: attach(row.sellCandidate),
      tradeChip: attach(row.tradeChip),
      injuryInsurance: attach(row.injuryInsurance),
      rosterPlayers: attachEnrichedPlayerDetailsList(row.rosterPlayers, playerDetailsById),
      benchPlayers: attachEnrichedPlayerDetailsList(row.benchPlayers, playerDetailsById),
      taxiPlayers: attachEnrichedPlayerDetailsList(row.taxiPlayers, playerDetailsById),
      reservePlayers: attachEnrichedPlayerDetailsList(row.reservePlayers, playerDetailsById),
      droppablePlayers: attachEnrichedPlayerDetailsList(row.droppablePlayers, playerDetailsById) || [],
      untouchablePlayers: attachEnrichedPlayerDetailsList(row.untouchablePlayers, playerDetailsById) || [],
      tradeBlueprints: row.tradeBlueprints?.map((blueprint) => ({
        ...blueprint,
        givePlayer: attach(blueprint.givePlayer),
        getPlayer: attach(blueprint.getPlayer),
      })),
      tradeableDepth: row.tradeableDepth?.map((tile) => ({
        ...tile,
        player: attach(tile.player),
      })),
      benchBaseline: row.benchBaseline?.map((tile) => ({
        ...tile,
        player: attach(tile.player),
        players: attachEnrichedPlayerDetailsList(tile.players, playerDetailsById),
      })),
      taxiTriage: {
        ...row.taxiTriage,
        items: attachEnrichedPlayerDetailsList(row.taxiTriage.items, playerDetailsById) || [],
      },
      similarValuePlayers: Object.fromEntries(
        (Object.entries(row.similarValuePlayers) as Array<[keyof ManagerRosterIntelligence['similarValuePlayers'], ManagerIntelPlayer | null]>)
          .map(([position, player]) => [position, attach(player)])
      ) as ManagerRosterIntelligence['similarValuePlayers'],
      starterAvailability: {
        ...row.starterAvailability,
        riskiestStarter: attach(row.starterAvailability.riskiestStarter),
      },
    };
    const situationSummary = buildManagerSituationSummary(next);
    return {
      ...next,
      situationSummary,
      pressurePoints: Array.from(new Set([
        situationSummary.riskCount ? `Situation risk: ${situationSummary.note}` : null,
        ...(next.pressurePoints || []),
      ].filter(Boolean) as string[])).slice(0, 6),
      marketSignals: Array.from(new Set([
        situationSummary.boostCount ? `Situation edge: ${situationSummary.note}` : null,
        ...(next.marketSignals || []),
      ].filter(Boolean) as string[])).slice(0, 6),
    };
  });
}

function getManagerDisplayName(name: string | undefined): string {
  return name?.trim() || 'Unknown';
}

function getSleeperManagerName(user: any): string {
  return normalizeManagerName(user?.display_name || user?.username);
}

function getSleeperManagerDisplayName(user: any): string {
  return getManagerDisplayName(user?.display_name || user?.username);
}

function getCanonicalSleeperManagerName(
  user: any,
  currentManagerByUserId: Record<string, string> = {},
  currentManagerByRosterId: Record<string, string> = {},
  rosterId?: string | number | null
): string {
  const rosterKey =
    rosterId !== null && rosterId !== undefined ? String(rosterId) : '';
  const currentRosterManager = rosterKey
    ? currentManagerByRosterId[rosterKey]
    : '';
  if (currentRosterManager && currentRosterManager !== 'Unknown') {
    return currentRosterManager;
  }
  const userId = user?.user_id ? String(user.user_id) : '';
  const currentManager = userId ? currentManagerByUserId[userId] : '';
  return currentManager && currentManager !== 'Unknown'
    ? currentManager
    : getSleeperManagerName(user);
}

function getCanonicalSleeperManagerDisplayName(
  user: any,
  currentManagerDisplayByUserId: Record<string, string> = {},
  currentManagerDisplayByRosterId: Record<string, string> = {},
  rosterId?: string | number | null
): string {
  const rosterKey =
    rosterId !== null && rosterId !== undefined ? String(rosterId) : '';
  const currentRosterManager = rosterKey
    ? currentManagerDisplayByRosterId[rosterKey]
    : '';
  if (currentRosterManager && currentRosterManager !== 'Unknown') {
    return currentRosterManager;
  }
  const userId = user?.user_id ? String(user.user_id) : '';
  const currentManager = userId ? currentManagerDisplayByUserId[userId] : '';
  return currentManager && currentManager !== 'Unknown'
    ? currentManager
    : getSleeperManagerDisplayName(user);
}

const SLEEPER_ID_PATTERN = /^\d{8,24}$/;
const sleeperLeagueIdSchema = z.string().trim().regex(SLEEPER_ID_PATTERN, 'Enter a valid Sleeper league ID');
const sleeperUserIdSchema = z.string().trim().regex(SLEEPER_ID_PATTERN, 'Enter a valid Sleeper user ID');
const sleeperUsernameSchema = z.string().trim().min(1).max(64);
const sleeperAuthTokenSchema = z.string().trim().min(1).max(4096);
const valueTimelineWindowSchema = z.enum(['1m', '3m', '6m', '1y', 'all']);
const aiSourceTraceSchema = z.object({
  label: z.string().min(1).max(240),
  status: z.enum(["loaded", "stale", "missing", "error", "limited"]).optional(),
  detail: z.string().max(500).nullable().optional(),
  ageHours: z.number().finite().nullable().optional(),
});
const aiEvidencePenaltySchema = z.object({
  label: z.string().min(1).max(240),
  points: z.number().finite(),
});
const recommendationObservedOutcomeSchema = z.object({
  status: z.enum([
    "pending",
    "observed_completed",
    "observed_partially_completed",
    "observed_ignored",
    "observed_contradicted",
    "expired",
    "unknown",
  ]),
  observedAt: z.string().max(80).nullable().optional(),
  confidence: z.number().int().min(0).max(100),
  evidence: z.object({
    reason: z.string().min(1).max(500),
    playerId: z.string().max(128).nullable().optional(),
    playerName: z.string().max(240).nullable().optional(),
    before: z.string().max(120).nullable().optional(),
    after: z.string().max(120).nullable().optional(),
    detectedFrom: z.enum(["roster_sync", "lineup_sync", "transaction_history", "expiration", "insufficient_data"]),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
}) satisfies z.ZodType<RecommendationObservedOutcome>;
const aiPredictionOutcomeSchema = z.object({
  status: z.enum(["hit", "miss", "push", "pending", "blocked"]),
  resolvedAt: z.string().max(80).nullable().optional(),
  actualValue: z.number().finite().nullable().optional(),
  baselineValue: z.number().finite().nullable().optional(),
  realizedEdge: z.object({
    status: z.enum(["beat-baseline", "matched-baseline", "trailed-baseline", "action-only", "expired", "manual"]),
    predictedEdge: z.number().finite().nullable(),
    actualValue: z.number().finite().nullable(),
    baselineValue: z.number().finite().nullable(),
    realizedEdge: z.number().finite().nullable(),
    baselineKind: z.enum([
      "do-nothing",
      "replacement",
      "highest-ranked-available",
      "current-starter",
      "market-default",
      "manager-default",
      "unknown",
    ]),
    source: z.string().min(1).max(180),
    note: z.string().min(1).max(500),
  }).nullable().optional() satisfies z.ZodType<AIRealizedEdge | null | undefined>,
  feedbackSource: z.enum(["system", "user", "admin"]).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  observedOutcome: recommendationObservedOutcomeSchema.nullable().optional(),
}) satisfies z.ZodType<AIPredictionOutcome>;
const aiSourceAgreementReadSchema = z.any().nullable().optional() as z.ZodType<AISourceAgreementRead | null | undefined>;
const aiDecisionBaselineSchema = z.object({
  kind: z.enum([
    "do-nothing",
    "replacement",
    "highest-ranked-available",
    "current-starter",
    "market-default",
    "manager-default",
    "unknown",
  ]),
  label: z.string().min(1).max(180),
  score: z.number().int().min(0).max(100).nullable(),
  source: z.string().max(180).nullable().optional(),
  detail: z.string().max(500).nullable().optional(),
});
const aiCounterfactualReadSchema = z.object({
  status: z.enum([
    "beats-baseline",
    "near-baseline",
    "below-baseline",
    "missing-baseline",
    "blocked",
  ]),
  baseline: aiDecisionBaselineSchema,
  edge: z.number().finite().nullable(),
  confidenceImpact: z.enum(["boost", "neutral", "penalty", "block"]),
  reason: z.string().min(1).max(500),
}) satisfies z.ZodType<AICounterfactualRead>;
const aiDecisionSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  capturedAt: z.string().min(1).max(80),
  valueMode: z.enum(["dynasty", "redraft", "keeper", "unknown"]).nullable().optional(),
  surface: z.string().max(64).nullable().optional(),
  action: z.string().max(64).nullable().optional(),
  entityName: z.string().max(240).nullable().optional(),
  entityType: z.string().max(64).nullable().optional(),
  finalScore: z.number().int().min(0).max(100),
  label: z.string().min(1).max(64),
  confidenceCap: z.number().int().min(0).max(100),
  confidenceCapReason: z.string().max(500).nullable().optional(),
  facts: z.array(z.object({
    key: z.string().min(1).max(100),
    label: z.string().min(1).max(160),
    value: z.union([z.string().max(500), z.number().finite(), z.boolean()]).nullable(),
    source: z.string().max(180).nullable().optional(),
    status: z.enum(["loaded", "missing", "stale", "limited", "blocked"]).optional(),
    detail: z.string().max(500).nullable().optional(),
  })).max(24),
  baseline: aiDecisionBaselineSchema.nullable().optional(),
  counterfactual: aiCounterfactualReadSchema.nullable().optional(),
}) satisfies z.ZodType<AIDecisionSnapshot>;
const aiPredictionEventSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(1).max(128),
  predictionKey: z.string().min(1).max(512),
  createdAt: z.string().min(1).max(80),
  surface: z.enum(["autopilot", "waiver", "schedule", "player-detail", "owner-intel", "rankings", "trade", "overview"]),
  action: z.enum(["pickup", "stash", "stream", "start", "sit", "trade", "hold", "watch", "avoid"]),
  decision: z.enum(["do", "dont", "watch", "hold", "blocked"]),
  entityType: z.enum(["player", "team", "manager", "league", "trade", "lineup", "schedule", "unknown"]),
  entityId: z.string().max(128).nullable().optional(),
  entityName: z.string().max(240).nullable().optional(),
  leagueId: z.string().max(64).nullable().optional(),
  manager: z.string().max(160).nullable().optional(),
  season: z.string().max(8).nullable().optional(),
  week: z.number().int().min(1).max(30).nullable().optional(),
  label: z.enum(["blocked", "thin", "watchlist", "actionable", "priority", "high conviction"]),
  finalScore: z.number().int().min(0).max(100),
  confidenceCap: z.number().int().min(0).max(100),
  confidenceCapReason: z.string().max(500).nullable().optional(),
  evidence: z.array(z.string().min(1).max(500)).max(12),
  missingEvidence: z.array(z.string().min(1).max(500)).max(12),
  hardBlockers: z.array(z.string().min(1).max(500)).max(12),
  softPenalties: z.array(aiEvidencePenaltySchema).max(12),
  sourceTrace: z.array(aiSourceTraceSchema).max(12),
  sourceAgreement: aiSourceAgreementReadSchema,
  decisionSnapshot: aiDecisionSnapshotSchema.nullable().optional(),
  counterfactual: aiCounterfactualReadSchema.nullable().optional(),
  decay: z.object({
    expiresAt: z.string().max(80).nullable(),
    decayWindowHours: z.number().int().min(1).max(24 * 60).nullable(),
    reason: z.string().min(1).max(500),
  }).nullable().optional() satisfies z.ZodType<AIPredictionDecayProfile | null | undefined>,
  expiresAt: z.string().max(80).nullable().optional(),
  whyThisFired: z.string().min(1).max(1200),
  outcome: aiPredictionOutcomeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
}) satisfies z.ZodType<AIPredictionEvent>;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
let lastRateLimitSweepAt = 0;

type RequestLike = { headers?: Record<string, any>; socket?: { remoteAddress?: string | null } };
type RateLimitOptions = {
  id: string;
  max: number;
  windowMs: number;
  scope?: string;
  message: string;
};

function getHeaderValue(headers: Record<string, any> | undefined, key: string): string | null {
  const value = headers?.[key];
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item.trim())?.trim() || null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getClientIp(req: { headers: Record<string, any>; socket?: { remoteAddress?: string | null } }): string | null {
  const forwardedFor = req.headers["x-forwarded-for"];
  const vercelForwardedFor = getHeaderValue(req.headers, "x-vercel-forwarded-for");
  const cfConnectingIp = getHeaderValue(req.headers, "cf-connecting-ip");
  const realIp = getHeaderValue(req.headers, "x-real-ip");
  const raw = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string" && forwardedFor.length > 0
      ? forwardedFor.split(",")[0]
      : vercelForwardedFor || cfConnectingIp || realIp || req.socket?.remoteAddress || null;

  if (!raw) return null;
  return String(raw).trim().replace(/^::ffff:/, "") || null;
}

function isTrustedAutomationRequest(req: RequestLike): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  const authHeader = getHeaderValue(req.headers, 'authorization');
  if (configuredSecret) return authHeader === `Bearer ${configuredSecret}`;
  return process.env.NODE_ENV !== 'production' && req.headers?.['x-cache-warmer'] === 'true';
}

function canForceRefreshLeagueCache(req: { headers?: Record<string, any> }): boolean {
  return isTrustedAutomationRequest(req);
}

function getSleeperCurrentWeek(leagueInfo: any): number {
  const candidate = Number(leagueInfo?.leg ?? leagueInfo?.week ?? leagueInfo?.settings?.leg ?? 1);
  return Number.isFinite(candidate) && candidate > 0 ? Math.min(18, Math.floor(candidate)) : 1;
}

function getSleeperPlayoffWeeks(leagueInfo: any): number[] {
  return buildLeaguePlayoffWeeks(leagueInfo?.settings?.playoff_week_start, 3, 18);
}

function getAdminLoginPassword(): string {
  return process.env.ADMIN_LOGIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
}

function hashAdminLoginValue(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

function isValidAdminLoginPassword(input: string): boolean {
  const configuredPassword = getAdminLoginPassword();
  if (!configuredPassword) return false;

  return crypto.timingSafeEqual(
    hashAdminLoginValue(input),
    hashAdminLoginValue(configuredPassword)
  );
}

function sweepRateLimitBuckets(now = Date.now()) {
  if (now - lastRateLimitSweepAt < 1000 * 60 * 5) return;
  lastRateLimitSweepAt = now;
  for (const [key, bucket] of Array.from(rateLimitBuckets.entries())) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }
}

function assertRateLimit(req: RequestLike, options: RateLimitOptions) {
  if (process.env.NODE_ENV === 'test' || isTrustedAutomationRequest(req)) return;

  const now = Date.now();
  sweepRateLimitBuckets(now);
  const clientId = getClientIp({
    headers: req.headers || {},
    socket: req.socket,
  }) || 'anonymous';
  const key = [options.id, clientId, options.scope || 'global'].join(':');
  const existing = rateLimitBuckets.get(key);
  const bucket = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + options.windowMs };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (bucket.count > options.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    console.warn(`[RateLimit] ${options.id} blocked for ${clientId}; retry after ${retryAfterSeconds}s`);
    void insertLoginAttempt({
      eventType: 'rate_limit',
      status: 'error',
      leagueId: options.scope && SLEEPER_ID_PATTERN.test(options.scope) ? options.scope : null,
      ipAddress: clientId,
      userAgent: getHeaderValue(req.headers, 'user-agent'),
      note: `${options.id}; retryAfter=${retryAfterSeconds}s`,
    });
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: options.message,
    });
  }
}

function assertReportAccess(ctx: { user?: TrpcContext["user"] }) {
  if (process.env.REQUIRE_AUTH_FOR_REPORTS === 'true' && !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: UNAUTHED_ERR_MSG });
  }
  assertCanUseFeature({
    user: ctx.user,
    feature: "free-sleeper-report",
  });
}

function getSleeperAvatarUrl(avatarId: string | null | undefined): string | null {
  return avatarId ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : null;
}

function buildManagerAvatarMap(users: any[]): Record<string, string | null> {
  return Object.fromEntries(
    users.map((user: any) => [
      normalizeManagerName(user.display_name),
      getSleeperAvatarUrl(user.avatar),
    ])
  );
}

function buildPlayerOwnerMap(
  rosters: Array<{ players?: string[]; taxi?: string[]; reserve?: string[]; roster_id: number }>,
  rosterUserMap: Record<string, string>
): Record<string, string> {
  const ownerByPlayerId: Record<string, string> = {};

  for (const roster of rosters) {
    const manager = rosterUserMap[String(roster.roster_id)];
    if (!manager) continue;

    for (const playerId of [...(roster.players || []), ...(roster.taxi || []), ...(roster.reserve || [])]) {
      ownerByPlayerId[playerId] = manager;
    }
  }

  return ownerByPlayerId;
}

function normalizeAvailabilityStatus(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const label = String(value).replace(/_/g, ' ').trim();
  if (!label) return null;
  if (/^(active|healthy)$/i.test(label)) return null;
  return label;
}

function getDisplayStatus(player: Record<string, any> | undefined, rosterStatus?: string | null): string {
  const rosterLabel = normalizeAvailabilityStatus(rosterStatus);
  if (rosterLabel) return rosterLabel;

  const injuryLabel = normalizeAvailabilityStatus(player?.injury_status);
  if (injuryLabel) return injuryLabel;

  return normalizeAvailabilityStatus(player?.status) || 'Active';
}

function buildPlayerRosterStatusMap(
  rosters: Array<{ players?: string[]; taxi?: string[]; reserve?: string[] }>
): Record<string, string> {
  const statusByPlayerId: Record<string, string> = {};

  for (const roster of rosters) {
    for (const playerId of roster.reserve || []) {
      statusByPlayerId[String(playerId)] = 'IR';
    }
    for (const playerId of roster.taxi || []) {
      if (!statusByPlayerId[String(playerId)]) {
        statusByPlayerId[String(playerId)] = 'Taxi';
      }
    }
  }

  return statusByPlayerId;
}

function getLeagueValueMode(leagueInfo: any): LeagueValueMode {
  const type = Number(leagueInfo?.settings?.type ?? 0);
  if (type === 2) return 'dynasty';
  if (type === 1) return 'keeper';
  return 'redraft';
}

function countRosterSlot(rosterPositions: unknown, slotName: string): number {
  if (!Array.isArray(rosterPositions)) return 0;
  return rosterPositions.filter((slot) => String(slot) === slotName).length;
}

function getLeagueNumQbs(leagueInfo: any): 1 | 2 {
  const positions = Array.isArray(leagueInfo?.roster_positions) ? leagueInfo.roster_positions : [];
  const qbSlots = countRosterSlot(positions, 'QB');
  const hasSuperflex = positions.some((slot: string) => ['SUPER_FLEX', 'OP'].includes(slot));
  return hasSuperflex || qbSlots >= 2 ? 2 : 1;
}

function getLeagueReceptionScoring(leagueInfo: any): number {
  const value = Number(leagueInfo?.scoring_settings?.rec ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getLeagueTightEndPremium(leagueInfo: any): number {
  const scoring = leagueInfo?.scoring_settings || {};
  const baseReception = getLeagueReceptionScoring(leagueInfo);
  const teReception = Number(scoring.rec_te);
  if (Number.isFinite(teReception) && teReception > baseReception) {
    return teReception - baseReception;
  }

  const bonus = Number(scoring.bonus_rec_te ?? 0);
  return Number.isFinite(bonus) ? bonus : 0;
}

function getLeagueValueBlendOptions(leagueInfo: any): ValueBlendOptions {
  const ppr = normalizePpr(getLeagueReceptionScoring(leagueInfo));
  const tep = normalizeTep(getLeagueTightEndPremium(leagueInfo));
  const options: ValueBlendOptions = {
    numQbs: getLeagueNumQbs(leagueInfo),
    numTeams: Number(leagueInfo?.total_rosters || leagueInfo?.settings?.num_teams || 12),
    ppr,
    tep,
    fantasyProsScoring: getFantasyProsScoringForPpr(ppr),
  };

  return {
    ...options,
    ktcProfileKey: getKtcProfileKeyForValueOptions(options),
  };
}

function getLeagueValueProfileKey(leagueInfo: any): string {
  return getValueSourceProfileKey(getLeagueValueBlendOptions(leagueInfo));
}

function formatSleeperProjectionScoringLabel(profile: SleeperProjectionScoringProfile, tightEndPremium = 0): string {
  const baseLabel = profile === 'HALF_PPR'
    ? 'Half PPR'
    : profile === 'STD'
      ? 'Standard'
      : profile === 'CUSTOM'
        ? 'Custom'
        : 'PPR';
  const tep = Math.round((Number(tightEndPremium) || 0) * 100) / 100;
  return tep > 0 ? `${baseLabel} + ${tep} TEP` : baseLabel;
}

function formatProjectionStatSummary(row: {
  passingYards?: number | null;
  passingTouchdowns?: number | null;
  interceptions?: number | null;
  carries?: number | null;
  rushingYards?: number | null;
  rushingTouchdowns?: number | null;
  targets?: number | null;
  receptions?: number | null;
  receivingYards?: number | null;
  receivingTouchdowns?: number | null;
}, tightEndPremiumAdjustment = 0): string | null {
  const parts = [
    row.passingYards ? `${row.passingYards} pass yds` : null,
    row.passingTouchdowns ? `${row.passingTouchdowns} pass TD` : null,
    row.interceptions ? `${row.interceptions} INT` : null,
    row.carries ? `${row.carries} carries` : null,
    row.rushingYards ? `${row.rushingYards} rush yds` : null,
    row.rushingTouchdowns ? `${row.rushingTouchdowns} rush TD` : null,
    row.targets ? `${row.targets} targets` : null,
    row.receptions ? `${row.receptions} rec` : null,
    row.receivingYards ? `${row.receivingYards} rec yds` : null,
    row.receivingTouchdowns ? `${row.receivingTouchdowns} rec TD` : null,
  ].filter((item): item is string => Boolean(item));
  if (tightEndPremiumAdjustment > 0) {
    return [...parts.slice(0, 3), `+${tightEndPremiumAdjustment} TEP`].join(' · ') || null;
  }
  return parts.slice(0, 4).join(' · ') || null;
}

function buildWeeklyProjectionContextMap(input: {
  snapshot: Awaited<ReturnType<typeof loadStoredSleeperProjectionSnapshot>>;
  season: string;
  week: number;
  scoringProfile: SleeperProjectionScoringProfile;
  tightEndPremium?: number;
  rosteredPlayerIds: string[];
}): {
  weeklyProjectionByPlayerId: Record<string, WeeklyProjectionContext>;
  diagnostics: NonNullable<ReportData['weeklyProjectionDiagnostics']>;
} {
  const health = buildProjectionSnapshotHealthDiagnostic({
    snapshot: input.snapshot,
    expectedScoringProfiles: [input.scoringProfile],
  });
  const readiness = getProjectionReadinessGate({
    source: 'sleeper',
    projectionType: 'weekly',
    projectionSnapshotStatus: health.status === 'ready' ? 'ready' : health.status === 'warning' ? 'stale' : 'missing',
    scheduleSnapshotStatus: 'ready',
    sourceMappingStatus: input.snapshot?.identityDiagnostics.missingIdentityRows ? 'partial' : 'ready',
  });
  const warnings = [
    ...health.parserWarnings,
    readiness.enabled ? null : readiness.reason,
  ].filter((item): item is string => Boolean(item));
  const weeklyProjectionByPlayerId: Record<string, WeeklyProjectionContext> = {};
  const scoringLabel = formatSleeperProjectionScoringLabel(input.scoringProfile, input.tightEndPremium);

  if (input.snapshot && readiness.enabled && health.status === 'ready') {
    for (const row of input.snapshot.rows) {
      if (!row.playerId || row.week !== input.week || row.projectedFantasyPoints === null) continue;
      const homeAway = row.homeAway || (row.opponent ? 'unknown' : 'bye');
      if (homeAway === 'bye') continue;
      const premiumProjection = applySleeperTightEndPremium({
        projectedFantasyPoints: row.projectedFantasyPoints,
        position: row.position,
        receptions: row.receptions,
        tightEndPremium: input.tightEndPremium,
      });
      if (premiumProjection.projectedFantasyPoints === null) continue;
      weeklyProjectionByPlayerId[row.playerId] = {
        source: 'stored-weekly-projection',
        provider: 'sleeper',
        season: row.season,
        week: row.week,
        scoringProfile: scoringLabel,
        projectedFantasyPoints: premiumProjection.projectedFantasyPoints,
        tightEndPremiumAdjustment: premiumProjection.adjustment || null,
        opponent: row.opponent,
        homeAway,
        team: row.team,
        updatedAt: row.providerUpdatedAt || input.snapshot.providerUpdatedAt || null,
        fetchedAt: input.snapshot.fetchedAt,
        status: 'ready',
        note: premiumProjection.adjustment > 0
          ? `Stored weekly projection for Week ${row.week} in ${scoringLabel} scoring, including TE premium.`
          : `Stored weekly projection for Week ${row.week} in ${scoringLabel} scoring.`,
        statSummary: formatProjectionStatSummary(row, premiumProjection.adjustment),
      };
    }
  }

  const uniqueRosteredPlayerIds = Array.from(new Set(input.rosteredPlayerIds.filter(Boolean)));
  const rosteredCount = uniqueRosteredPlayerIds.length;
  const attachedRosteredCount = uniqueRosteredPlayerIds.filter((playerId) => Boolean(weeklyProjectionByPlayerId[playerId])).length;
  return {
    weeklyProjectionByPlayerId,
    diagnostics: {
      status: health.status,
      source: 'stored-weekly-projection',
      provider: 'sleeper',
      season: input.snapshot?.season || input.season,
      week: input.snapshot?.week ?? input.week,
      scoringProfile: scoringLabel,
      rowCount: input.snapshot?.rowCount || 0,
      rosteredCoveragePct: rosteredCount ? Math.round((attachedRosteredCount / rosteredCount) * 1000) / 10 : null,
      attachedPlayerCount: attachedRosteredCount,
      note: readiness.enabled && health.status === 'ready'
        ? 'Stored weekly projections are attached to eligible report players.'
        : 'Stored weekly projections are unavailable or gated, so recommendations fall back to schedule/value context.',
      warnings,
    },
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function formatDateKey(date?: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseSleeperTimestamp(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    const millis = numericValue < 10_000_000_000 ? numericValue * 1000 : numericValue;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function getDraftWindowDate(pick: any): Date | null {
  return parseSleeperTimestamp(pick?.draft_start_time)
    || parseSleeperTimestamp(pick?.draft_created)
    || parseSleeperTimestamp(pick?.draft_last_picked);
}

function getLaborDay(season: number): Date {
  const septemberFirst = new Date(Date.UTC(season, 8, 1, 12, 0, 0, 0));
  const daysUntilMonday = (1 - septemberFirst.getUTCDay() + 7) % 7;
  return addDays(septemberFirst, daysUntilMonday);
}

function getNflWeekStartDate(season: number, week: number): Date {
  const boundedWeek = Math.max(1, Math.floor(week || 1));
  return addDays(getLaborDay(season), 3 + ((boundedWeek - 1) * 7));
}

function getRedraftRegularSeasonEndValueDate(season: number, playoffWeekStart?: number): Date {
  const boundedPlayoffWeekStart = Math.max(2, Math.floor(playoffWeekStart || 15));
  return addDays(getNflWeekStartDate(season, boundedPlayoffWeekStart), -1);
}

function getDynastyStartupBaselineDate(season: number): Date {
  return new Date(Date.UTC(season, 7, 25, 12, 0, 0, 0));
}

function getDynastyBaselineLabel(season: string, valueProfileKey: string): string {
  return valueProfileKey.includes('one_qb')
    ? `FantasyPros ${season} Dynasty 1QB baseline`
    : `FantasyPros ${season} Dynasty SF baseline`;
}

function isMainDraftPick(pick: any): boolean {
  const pickCount = Number(pick?.draft_pick_count || 0);
  const round = Number(pick?.round || 0);
  return pickCount >= 100 || round > 10;
}

async function loadKtcSnapshotForDate(
  targetDate: Date | null,
  valueProfileKey: string,
  fallbackValues: KTCValues,
): Promise<KTCValues> {
  if (!targetDate) return fallbackValues;

  const targetEndOfDay = endOfDay(targetDate);
  const dbSnapshot = await getKtcSnapshotOnOrBeforeDate(targetEndOfDay, valueProfileKey);
  if (dbSnapshot && Object.keys(dbSnapshot).length > 0) {
    return dbSnapshot as KTCValues;
  }

  const localSnapshot = loadLatestLocalKtcSnapshotBefore(addDays(targetEndOfDay, 1), valueProfileKey);
  return Object.keys(localSnapshot).length > 0 ? localSnapshot : fallbackValues;
}

async function buildRedraftValueWindowsBySeason(
  draftPicks: any[],
  fallbackValues: KTCValues,
  valueProfileKey: string,
  playoffWeekStartBySeason: Record<string, number>,
): Promise<Record<string, {
  draftValues: KTCValues;
  currentValues: KTCValues;
  draftValueDate: string | null;
  currentValueDate: string | null;
}>> {
  const seasons = new Set<string>();
  const draftDateBySeason = new Map<string, Date>();

  for (const pick of draftPicks) {
    const season = pick?.season ? String(pick.season) : null;
    if (!season) continue;
    seasons.add(season);

    const draftDate = getDraftWindowDate(pick);
    const existingDate = draftDateBySeason.get(season);
    if (draftDate && (!existingDate || draftDate < existingDate)) {
      draftDateBySeason.set(season, draftDate);
    }
  }

  const windows: Record<string, {
    draftValues: KTCValues;
    currentValues: KTCValues;
    draftValueDate: string | null;
    currentValueDate: string | null;
  }> = {};

  await Promise.all(Array.from(seasons).map(async (season) => {
    const numericSeason = Number(season);
    const regularSeasonEndDate = Number.isFinite(numericSeason)
      ? getRedraftRegularSeasonEndValueDate(numericSeason, playoffWeekStartBySeason[season])
      : null;
    const now = new Date();
    const currentValueDate = regularSeasonEndDate && now > regularSeasonEndDate ? regularSeasonEndDate : now;
    const draftValueDate = draftDateBySeason.get(season) || null;

    const [draftValues, currentValues] = await Promise.all([
      loadKtcSnapshotForDate(draftValueDate, valueProfileKey, fallbackValues),
      loadKtcSnapshotForDate(currentValueDate, valueProfileKey, fallbackValues),
    ]);

    windows[season] = {
      draftValues,
      currentValues,
      draftValueDate: formatDateKey(draftValueDate),
      currentValueDate: formatDateKey(currentValueDate),
    };
  }));

  return windows;
}

async function buildDynastyMainDraftValueWindowsByDraftId(
  draftPicks: any[],
  fallbackValues: KTCValues,
  valueProfileKey: string,
): Promise<Record<string, {
  draftValues: KTCValues;
  currentValues: KTCValues;
  draftValueDate: string | null;
  currentValueDate: string | null;
  draftValueSource?: string | null;
  currentValueSource?: string | null;
  baselineSnapshotKey?: string | null;
}>> {
  const draftSeasonByDraftId = new Map<string, string>();

  for (const pick of draftPicks) {
    const draftId = pick?.draft_id ? String(pick.draft_id) : '';
    if (!draftId || !isMainDraftPick(pick)) continue;
    const season = pick?.season ? String(pick.season) : null;
    if (season && /^\d{4}$/.test(season)) draftSeasonByDraftId.set(draftId, season);
  }

  const windows: Record<string, {
    draftValues: KTCValues;
    currentValues: KTCValues;
    draftValueDate: string | null;
    currentValueDate: string | null;
    draftValueSource?: string | null;
    currentValueSource?: string | null;
    baselineSnapshotKey?: string | null;
  }> = {};

  await Promise.all(Array.from(draftSeasonByDraftId.entries()).map(async ([draftId, season]) => {
    const numericSeason = Number(season);
    const draftValueDate = getDynastyStartupBaselineDate(numericSeason);
    const threeYearEndDate = addYears(draftValueDate, 3);
    const now = new Date();
    const currentValueDate = now > threeYearEndDate ? threeYearEndDate : now;

    const [draftValues, currentValues] = await Promise.all([
      loadKtcSnapshotForDate(draftValueDate, valueProfileKey, fallbackValues),
      loadKtcSnapshotForDate(currentValueDate, valueProfileKey, fallbackValues),
    ]);

    windows[draftId] = {
      draftValues,
      currentValues,
      draftValueDate: formatDateKey(draftValueDate),
      currentValueDate: formatDateKey(currentValueDate),
      draftValueSource: getDynastyBaselineLabel(season, valueProfileKey),
      currentValueSource: 'Current DD dynasty blend',
      baselineSnapshotKey: formatDateKey(draftValueDate),
    };
  }));

  return windows;
}

function formatLeagueFormat(leagueInfo: any): string {
  const totalTeams = leagueInfo.total_rosters ? `${leagueInfo.total_rosters}-Team` : null;
  const valueMode = getLeagueValueMode(leagueInfo);
  const type = valueMode === 'dynasty' ? 'Dynasty' : valueMode === 'keeper' ? 'Keeper' : 'Redraft';
  const positions = Array.isArray(leagueInfo.roster_positions) ? leagueInfo.roster_positions : [];
  const superflex = positions.includes('SUPER_FLEX') ? 'SF' : null;
  const rec = Number(leagueInfo.scoring_settings?.rec ?? 0);
  const teBonus = getLeagueTightEndPremium(leagueInfo);
  const ppr = rec === 1 ? 'PPR' : rec === 0.5 ? 'Half-PPR' : rec === 0 ? 'Standard' : `${rec} PPR`;
  const tep = teBonus > 0 ? 'TE Premium' : null;

  return [totalTeams, type, superflex, ppr, tep].filter(Boolean).join(' ');
}

function formatLeagueMobileFormat(leagueInfo: any): string {
  const totalTeams = leagueInfo.total_rosters ? `${leagueInfo.total_rosters}-Team` : null;
  const valueMode = getLeagueValueMode(leagueInfo);
  const type = valueMode === 'dynasty' ? 'Dynasty' : valueMode === 'keeper' ? 'Keeper' : 'Redraft';
  return [totalTeams, type].filter(Boolean).join(' ');
}

function toSleeperLeagueOption(
  leagueInfo: any,
  season: string,
  extras?: {
    standingsRank?: number | null;
    powerRank?: number | null;
  }
) {
  const leagueId = getValidSleeperEntityId(leagueInfo?.league_id);
  if (!leagueId) return null;

  return {
    leagueId,
    name: leagueInfo.name || 'Unnamed League',
    avatarUrl: getSleeperAvatarUrl(leagueInfo.avatar),
    season,
    format: formatLeagueFormat(leagueInfo),
    mobileFormat: formatLeagueMobileFormat(leagueInfo),
    totalRosters: Number(leagueInfo.total_rosters || leagueInfo.settings?.num_teams || 0),
    standingsRank: extras?.standingsRank ?? null,
    powerRank: extras?.powerRank ?? null,
  };
}

type SleeperLeagueOption = NonNullable<ReturnType<typeof toSleeperLeagueOption>>;

const INVALID_LEAGUE_ID_TTL_MS = 10 * 60 * 1000;
const invalidLeagueIdCache = new Map<string, { fetchedAt: number }>();

function isInvalidLeagueIdCached(leagueId: string): boolean {
  const validLeagueId = getValidSleeperEntityId(leagueId);
  if (!validLeagueId) return false;

  const existing = invalidLeagueIdCache.get(validLeagueId);
  if (!existing) return false;

  if (Date.now() - existing.fetchedAt > INVALID_LEAGUE_ID_TTL_MS) {
    invalidLeagueIdCache.delete(validLeagueId);
    return false;
  }

  return true;
}

function markInvalidLeagueId(leagueId: string): void {
  const validLeagueId = getValidSleeperEntityId(leagueId);
  if (!validLeagueId) return;

  invalidLeagueIdCache.set(validLeagueId, { fetchedAt: Date.now() });
}
type KtcValueProfileCandidate = { key: string; data: KTCValues[string]; score: number };

function buildManagerAnchorsFromSleeperUsers(users: unknown) {
  return Array.isArray(users)
    ? users.map((user: any) => ({
        id: String(user.user_id || user.display_name || ''),
        avatarUrl: getSleeperAvatarUrl(user.avatar),
      })).filter(manager => manager.id)
    : [];
}

const LEAGUE_REPORT_CACHE_VERSION = 'league-report-v56';
const LEAGUE_RANKINGS_CACHE_VERSION = 'league-rankings-v13';
const LEAGUE_REPORT_CACHE_TTL_MS = getLeagueReportCacheTtlMs();
const LEAGUE_REPORT_CACHE_TTL_HOURS = getLeagueReportCacheTtlHours();
const LEAGUE_REPORT_FILE_CACHE_MAX_FILES = getLeagueReportFileCacheMaxFiles();
const RECENT_TRANSACTION_BETTER_CUT_VALUE_GAP = 250;
const SLEEPER_TRENDING_LOOKBACK_HOURS = 24;
const SLEEPER_TRENDING_LIMIT = 25;
const LEAGUE_REPORT_FILE_CACHE_DIR = path.join(process.cwd(), '.cache', 'league-reports');
const MONTHLY_BLUEPRINT_FILE_CACHE_DIR = path.join(process.cwd(), '.cache', 'monthly-blueprints');
const leagueReportMemoryCache = new Map<string, { loadedAt: number; payload: unknown }>();
const ktcValueProfileLookupCache = new WeakMap<KTCValues, Map<string, KtcValueProfileCandidate>>();

function getLeagueReportCacheKey(leagueId: string, viewerUserId?: string | null): string {
  return [
    LEAGUE_REPORT_CACHE_VERSION,
    String(leagueId || '').trim(),
    'league',
  ].join(':');
}

function getProspectRankingsCacheSegment(diagnostics: any): string {
  return [
    'prospects',
    diagnostics?.scrapeMonth || 'none',
    diagnostics?.generatedAt || 'none',
    Number(diagnostics?.playerCount || 0),
    Array.isArray(diagnostics?.yearsTracked) ? diagnostics.yearsTracked.join('-') : 'none',
    Array.isArray(diagnostics?.errors) ? diagnostics.errors.length : 0,
  ].join(':');
}

function getLeagueRankingsCacheKey(leagueId: string, prospectCacheSegment = 'prospects:none'): string {
  return [
    LEAGUE_RANKINGS_CACHE_VERSION,
    String(leagueId || '').trim(),
    prospectCacheSegment,
    'league',
  ].join(':');
}

function getLeagueReportFileCachePath(cacheKey: string): string {
  const digest = crypto.createHash('sha256').update(cacheKey).digest('hex');
  return path.join(LEAGUE_REPORT_FILE_CACHE_DIR, `${digest}.json`);
}

async function getLeagueReportFileCacheMetadata(cacheKey: string): Promise<{
  cacheKey: string;
  updatedAt: Date;
  payloadSizeBytes: number;
} | null> {
  if (!shouldUseLeagueReportFileCache()) return null;

  try {
    const filePath = getLeagueReportFileCachePath(cacheKey);
    const stats = await fs.stat(filePath);
    if (isLeagueReportCacheExpired(stats.mtimeMs, Date.now(), LEAGUE_REPORT_CACHE_TTL_MS)) {
      void fs.unlink(filePath).catch(() => {});
      return null;
    }
    return {
      cacheKey,
      updatedAt: new Date(stats.mtimeMs),
      payloadSizeBytes: stats.size,
    };
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('Failed to read file league report cache metadata:', error);
    }
    return null;
  }
}

async function pruneLeagueReportFileCache(): Promise<void> {
  if (!shouldUseLeagueReportFileCache()) return;

  try {
    const entries = await fs.readdir(LEAGUE_REPORT_FILE_CACHE_DIR);
    const files = (await Promise.all(
      entries
        .filter((fileName) => fileName.endsWith('.json'))
        .map(async (fileName) => {
          const filePath = path.join(LEAGUE_REPORT_FILE_CACHE_DIR, fileName);
          try {
            const stats = await fs.stat(filePath);
            return { filePath, updatedAtMs: stats.mtimeMs };
          } catch {
            return null;
          }
        })
    ))
      .filter((entry): entry is { filePath: string; updatedAtMs: number } => Boolean(entry))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);

    await Promise.allSettled(
      files
        .filter((entry, index) => shouldPruneLeagueReportFileCacheEntry({
          updatedAtMs: entry.updatedAtMs,
          index,
          ttlMs: LEAGUE_REPORT_CACHE_TTL_MS,
          maxFiles: LEAGUE_REPORT_FILE_CACHE_MAX_FILES,
        }))
        .map((entry) => fs.unlink(entry.filePath))
    );
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('Failed to prune file league report cache:', error);
    }
  }
}

function getMemoryCachedLeagueReport(cacheKey: string): unknown | null {
  const cached = leagueReportMemoryCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.loadedAt > LEAGUE_REPORT_CACHE_TTL_MS) {
    leagueReportMemoryCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
}

async function readCachedLeagueReport(cacheKey: string): Promise<unknown | null> {
  const memoryCached = getMemoryCachedLeagueReport(cacheKey);
  if (memoryCached) {
    const { payload: slimmedMemoryCached } = slimCachedLeagueReportPayload(memoryCached);
    if (slimmedMemoryCached !== memoryCached) {
      leagueReportMemoryCache.set(cacheKey, { loadedAt: Date.now(), payload: slimmedMemoryCached });
    }
    return slimmedMemoryCached;
  }

  const storedCached = await findLeagueReportCache(cacheKey, LEAGUE_REPORT_CACHE_TTL_MS);
  if (storedCached) {
    const { payload: slimmedStoredCached } = slimCachedLeagueReportPayload(storedCached);
    leagueReportMemoryCache.set(cacheKey, { loadedAt: Date.now(), payload: slimmedStoredCached });
    void writeFileCachedLeagueReport(cacheKey, slimmedStoredCached);
    return slimmedStoredCached;
  }

  const fileCached = await readFileCachedLeagueReport(cacheKey);
  if (fileCached) {
    const { payload: slimmedFileCached } = slimCachedLeagueReportPayload(fileCached);
    leagueReportMemoryCache.set(cacheKey, { loadedAt: Date.now(), payload: slimmedFileCached });
    if (slimmedFileCached !== fileCached) {
      void writeFileCachedLeagueReport(cacheKey, slimmedFileCached);
    }
    return slimmedFileCached;
  }

  return null;
}

async function writeCachedLeagueReport(
  cacheKey: string,
  leagueId: string,
  viewerUserId: string | undefined,
  payload: unknown
) {
  const { payload: slimmedPayload } = slimCachedLeagueReportPayload(payload);
  leagueReportMemoryCache.set(cacheKey, { loadedAt: Date.now(), payload: slimmedPayload });
  await Promise.allSettled([
    writeFileCachedLeagueReport(cacheKey, slimmedPayload),
    upsertLeagueReportCache({
      cacheKey,
      leagueId,
      viewerUserId: viewerUserId || null,
      payload: slimmedPayload,
    }),
  ]);
}

async function readFileCachedLeagueReport(cacheKey: string): Promise<unknown | null> {
  if (!shouldUseLeagueReportFileCache()) return null;

  try {
    const filePath = getLeagueReportFileCachePath(cacheKey);
    const stats = await fs.stat(filePath);
    if (isLeagueReportCacheExpired(stats.mtimeMs, Date.now(), LEAGUE_REPORT_CACHE_TTL_MS)) {
      void fs.unlink(filePath).catch(() => {});
      return null;
    }
    return parseLeagueReportCachePayloadFromStorage(await fs.readFile(filePath, 'utf-8'));
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('Failed to read file league report cache:', error);
    }
    return null;
  }
}

function getCachedReportData(payload: unknown): ReportData | null {
  if (!payload || typeof payload !== 'object') return null;
  const reportData = (payload as { reportData?: unknown }).reportData;
  return reportData && typeof reportData === 'object' ? reportData as ReportData : null;
}

function clampDeltaPriority(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function formatServerDeltaPercent(value?: number | null): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0%';
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${Math.abs(numeric) >= 10 ? numeric.toFixed(0) : numeric.toFixed(1)}%`;
}

function formatServerDeltaNumber(value?: number | null): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric}`;
}

function getTopMomentumDelta(rows?: ReportData['weeklyRisers']): { name: string; detail: string | null } | null {
  const top = [...(rows || [])]
    .filter((row) => row?.name)
    .sort((a, b) => Math.abs(Number(b.pct_change || 0)) - Math.abs(Number(a.pct_change || 0)))[0];
  if (!top?.name) return null;
  return {
    name: top.name,
    detail: [
      top.currentPositionRank || null,
      Number.isFinite(Number(top.pct_change)) ? formatServerDeltaPercent(top.pct_change) : null,
    ].filter(Boolean).join(' | ') || null,
  };
}

function getTopWaiverDelta(data: ReportData): { name: string; detail: string | null } | null {
  const waiver = data.waiverIntelligence;
  if (!waiver) return null;
  const topTarget = waiver.weeklyEcrTargets?.[0]?.player || waiver.highestKtcAvailable || null;
  if (!topTarget?.name) return null;
  return {
    name: topTarget.name,
    detail: [
      topTarget.currentPositionRank || topTarget.pos || null,
      topTarget.weeklyEcr?.source ? `${topTarget.weeklyEcr.source} schedule` : null,
    ].filter(Boolean).join(' | ') || null,
  };
}

function getScheduleDeltaStatus(data: ReportData): { name: string; detail: string | null; count: number } {
  const planning = data.schedulePlanning;
  const gapCount = planning?.rosterGaps?.length || 0;
  const streamerCount = planning?.streamerCandidates?.length || 0;
  const targetCount = data.scheduleEdgeTargets?.length || 0;
  return {
    name: planning?.status || 'pending',
    detail: [
      planning?.source || null,
      `${gapCount} gap${gapCount === 1 ? '' : 's'}`,
      `${streamerCount + targetCount} schedule target${streamerCount + targetCount === 1 ? '' : 's'}`,
    ].filter(Boolean).join(' | '),
    count: gapCount + streamerCount + targetCount,
  };
}

function getReportAiConfidence(data: ReportData): number | null {
  const score = Number(data.leagueDiagnostics?.aiConfidence?.score);
  return Number.isFinite(score) ? Math.round(score) : null;
}

function getMaterialDelta(value: number | null, previous: number | null, threshold = 1): number | null {
  if (value === null || previous === null) return null;
  const delta = value - previous;
  return Math.abs(delta) >= threshold ? delta : null;
}

function buildServerReportDelta(previous: ReportData | null, current: ReportData) {
  const generatedAt = new Date().toISOString();
  if (!previous) {
    return {
      schemaVersion: 1 as const,
      source: 'none' as const,
      generatedAt,
      baselineGeneratedAt: null,
      summary: 'No prior server report was available, so this run becomes the new comparison baseline.',
      changes: [],
    };
  }

  const changes: NonNullable<ReportData['serverReportDelta']>['changes'] = [];
  const previousRiser = getTopMomentumDelta(previous.weeklyRisers);
  const currentRiser = getTopMomentumDelta(current.weeklyRisers);
  if (previousRiser?.name !== currentRiser?.name && currentRiser?.name) {
    changes.push({
      id: 'top-riser',
      label: 'Top riser changed',
      summary: `${currentRiser.name} is now the main value riser.`,
      detail: currentRiser.detail,
      tone: 'good',
      priority: 4,
      receipts: [
        previousRiser?.name ? `Previous: ${previousRiser.name}` : 'Previous report had no clear riser.',
        currentRiser.detail || 'Current report has a new riser.',
      ],
    });
  }

  const previousFaller = getTopMomentumDelta(previous.weeklyFallers);
  const currentFaller = getTopMomentumDelta(current.weeklyFallers);
  if (previousFaller?.name !== currentFaller?.name && currentFaller?.name) {
    changes.push({
      id: 'top-faller',
      label: 'Top faller changed',
      summary: `${currentFaller.name} is now the main risk read.`,
      detail: currentFaller.detail,
      tone: 'warn',
      priority: 4,
      receipts: [
        previousFaller?.name ? `Previous: ${previousFaller.name}` : 'Previous report had no clear faller.',
        currentFaller.detail || 'Current report has a new faller.',
      ],
    });
  }

  const previousWaiver = getTopWaiverDelta(previous);
  const currentWaiver = getTopWaiverDelta(current);
  if (previousWaiver?.name !== currentWaiver?.name && currentWaiver?.name) {
    changes.push({
      id: 'top-waiver',
      label: 'Waiver target changed',
      summary: `${currentWaiver.name} is now the first waiver name to review.`,
      detail: currentWaiver.detail,
      tone: 'info',
      priority: 5,
      receipts: [
        previousWaiver?.name ? `Previous: ${previousWaiver.name}` : 'Previous report had no top waiver target.',
        currentWaiver.detail || 'Current report has a new waiver target.',
      ],
    });
  }

  const transactionDelta = getMaterialDelta(current.recentTransactions?.length || 0, previous.recentTransactions?.length || 0, 1);
  if (transactionDelta !== null) {
    changes.push({
      id: 'transaction-count',
      label: 'Live market moved',
      summary: `${formatServerDeltaNumber(transactionDelta)} transaction${Math.abs(transactionDelta) === 1 ? '' : 's'} since the cached baseline.`,
      detail: 'Recent add/drop behavior can change availability, churn pressure, and owner intent.',
      tone: transactionDelta > 0 ? 'info' : 'neutral',
      priority: clampDeltaPriority(Math.abs(transactionDelta)),
      receipts: [
        `Previous transactions: ${previous.recentTransactions?.length || 0}`,
        `Current transactions: ${current.recentTransactions?.length || 0}`,
      ],
    });
  }

  const tradeDelta = getMaterialDelta(current.tradeHistory?.length || 0, previous.tradeHistory?.length || 0, 1);
  if (tradeDelta !== null) {
    changes.push({
      id: 'trade-count',
      label: 'Trade market moved',
      summary: `${formatServerDeltaNumber(tradeDelta)} trade${Math.abs(tradeDelta) === 1 ? '' : 's'} since the cached baseline.`,
      detail: 'Trade activity changes partner likelihood and how aggressive the AI should be.',
      tone: tradeDelta > 0 ? 'info' : 'neutral',
      priority: clampDeltaPriority(Math.abs(tradeDelta)),
      receipts: [
        `Previous trades: ${previous.tradeHistory?.length || 0}`,
        `Current trades: ${current.tradeHistory?.length || 0}`,
      ],
    });
  }

  const previousSchedule = getScheduleDeltaStatus(previous);
  const currentSchedule = getScheduleDeltaStatus(current);
  if (previousSchedule.name !== currentSchedule.name || previousSchedule.count !== currentSchedule.count) {
    changes.push({
      id: 'schedule-status',
      label: 'Schedule read changed',
      summary: `Schedule status is ${currentSchedule.name} with ${currentSchedule.count} active signal${currentSchedule.count === 1 ? '' : 's'}.`,
      detail: currentSchedule.detail,
      tone: currentSchedule.name === 'ready' ? 'good' : currentSchedule.name === 'partial' ? 'warn' : 'neutral',
      priority: currentSchedule.name === 'ready' ? 4 : 2,
      receipts: [
        `Previous: ${previousSchedule.name} / ${previousSchedule.count} signals`,
        `Current: ${currentSchedule.name} / ${currentSchedule.count} signals`,
      ],
    });
  }

  const confidenceDelta = getMaterialDelta(getReportAiConfidence(current), getReportAiConfidence(previous), 3);
  if (confidenceDelta !== null) {
    changes.push({
      id: 'ai-confidence',
      label: 'AI confidence moved',
      summary: `League AI confidence moved ${formatServerDeltaNumber(confidenceDelta)} points.`,
      detail: current.leagueDiagnostics?.aiConfidence?.note || null,
      tone: confidenceDelta > 0 ? 'good' : 'warn',
      priority: clampDeltaPriority(Math.abs(confidenceDelta) / 4),
      receipts: [
        `Previous confidence: ${getReportAiConfidence(previous) ?? 'unknown'}`,
        `Current confidence: ${getReportAiConfidence(current) ?? 'unknown'}`,
      ],
    });
  }

  const previousAdjustmentCount = previous.aiCalibrationAdjustmentProfile?.adjustments?.length || 0;
  const currentAdjustmentCount = current.aiCalibrationAdjustmentProfile?.adjustments?.length || 0;
  if (previousAdjustmentCount !== currentAdjustmentCount && current.aiCalibrationAdjustmentProfile) {
    changes.push({
      id: 'calibration-adjustments',
      label: 'Calibration changed',
      summary: `${currentAdjustmentCount} outcome adjustment${currentAdjustmentCount === 1 ? '' : 's'} are now active.`,
      detail: current.aiCalibrationAdjustmentProfile.adjustments[0]?.reason || current.aiCalibrationAdjustmentProfile.globalAdjustment.reason,
      tone: currentAdjustmentCount ? 'info' : 'neutral',
      priority: currentAdjustmentCount ? 4 : 1,
      receipts: [
        `Previous adjustments: ${previousAdjustmentCount}`,
        `Current scored outcomes: ${current.aiCalibrationAdjustmentProfile.scoredCount}`,
      ],
    });
  }

  const sortedChanges = changes
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
  const summary = sortedChanges[0]?.summary || 'No material server-side changes since the cached baseline.';

  return {
    schemaVersion: 1 as const,
    source: 'server-cache' as const,
    generatedAt,
    baselineGeneratedAt: previous.serverReportDelta?.generatedAt || null,
    summary,
    changes: sortedChanges,
  };
}

async function writeFileCachedLeagueReport(cacheKey: string, payload: unknown): Promise<void> {
  if (!shouldUseLeagueReportFileCache()) return;

  try {
    await fs.mkdir(LEAGUE_REPORT_FILE_CACHE_DIR, { recursive: true });
    await fs.writeFile(getLeagueReportFileCachePath(cacheKey), serializeLeagueReportCachePayloadForStorage(payload));
    void pruneLeagueReportFileCache();
  } catch (error) {
    console.warn('Failed to write file league report cache:', error);
  }
}

async function getLeagueReportCacheStatus(cacheKey: string, leagueId: string, viewerUserId?: string | null) {
  const memoryCached = leagueReportMemoryCache.get(cacheKey);
  if (memoryCached && !isLeagueReportCacheExpired(memoryCached.loadedAt, Date.now(), LEAGUE_REPORT_CACHE_TTL_MS)) {
    return {
      cacheKey,
      leagueId,
      viewerUserId: viewerUserId || null,
      status: 'hit' as const,
      source: 'memory' as const,
      updatedAt: new Date(memoryCached.loadedAt).toISOString(),
      ageMs: Date.now() - memoryCached.loadedAt,
      payloadSizeBytes: null,
      maxAgeHours: LEAGUE_REPORT_CACHE_TTL_HOURS,
    };
  }

  const storedMetadata = await findLeagueReportCacheMetadata(cacheKey, LEAGUE_REPORT_CACHE_TTL_MS);
  if (storedMetadata) {
    return {
      cacheKey: storedMetadata.cacheKey,
      leagueId: storedMetadata.leagueId,
      viewerUserId: storedMetadata.viewerUserId,
      status: 'hit' as const,
      source: 'database' as const,
      updatedAt: storedMetadata.updatedAt.toISOString(),
      ageMs: Date.now() - storedMetadata.updatedAt.getTime(),
      payloadSizeBytes: storedMetadata.payloadSizeBytes,
      maxAgeHours: LEAGUE_REPORT_CACHE_TTL_HOURS,
    };
  }

  const fileMetadata = await getLeagueReportFileCacheMetadata(cacheKey);
  if (fileMetadata) {
    return {
      cacheKey,
      leagueId,
      viewerUserId: viewerUserId || null,
      status: 'hit' as const,
      source: 'file' as const,
      updatedAt: fileMetadata.updatedAt.toISOString(),
      ageMs: Date.now() - fileMetadata.updatedAt.getTime(),
      payloadSizeBytes: fileMetadata.payloadSizeBytes,
      maxAgeHours: LEAGUE_REPORT_CACHE_TTL_HOURS,
    };
  }

  return {
    cacheKey,
    leagueId,
    viewerUserId: viewerUserId || null,
    status: 'miss' as const,
    source: 'none' as const,
    updatedAt: null,
    ageMs: null,
    payloadSizeBytes: null,
    maxAgeHours: LEAGUE_REPORT_CACHE_TTL_HOURS,
  };
}

function getBlueprintSnapshotMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || String(date.getUTCFullYear());
  const month = parts.find((part) => part.type === 'month')?.value || String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthlyReportGenerationIdentity(input: {
  user?: TrpcContext["user"];
  viewerUserId?: string | null;
  ipAddress?: string | null;
}) {
  const user = input.user;
  if (user) {
    const stableIdentifier = user.openId || user.email || user.name || String(user.id);
    return {
      userKey: `auth:${stableIdentifier}`.trim().toLowerCase(),
      userLabel: user.email || user.name || user.openId || String(user.id),
    };
  }

  if (input.viewerUserId) {
    return {
      userKey: `sleeper:${input.viewerUserId}`,
      userLabel: input.viewerUserId,
    };
  }

  const ipAddress = input.ipAddress?.trim();
  return {
    userKey: `ip:${ipAddress || 'anonymous'}`,
    userLabel: ipAddress || 'anonymous',
  };
}

export async function assertMonthlyReportGenerationAllowed(input: {
  ctx: TrpcContext;
  leagueId: string;
  viewerUserId?: string | null;
  ipAddress?: string | null;
}) {
  if (isTrustedAutomationRequest(input.ctx.req as any)) return;
  assertCanUseFeature({
    user: input.ctx.user,
    feature: "monthly-roster-blueprint",
    leagueId: input.leagueId,
  });

  const snapshotMonth = getBlueprintSnapshotMonth();
  const identity = getMonthlyReportGenerationIdentity({
    user: input.ctx.user,
    viewerUserId: input.viewerUserId,
    ipAddress: input.ipAddress,
  });
  const reservation = await reserveMonthlyReportGeneration({
    ...identity,
    snapshotMonth,
    leagueId: input.leagueId,
  });

  if (!reservation) {
    if (process.env.NODE_ENV === 'production') {
      throw new TRPCError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Monthly blueprint generation quota is temporarily unavailable. Please try again shortly.',
      });
    }
    return;
  }

  if (reservation.allowed || reservation.existing?.leagueId === input.leagueId) return;

  throw new TRPCError({
    code: 'TOO_MANY_REQUESTS',
    message: `Monthly blueprint generation limit reached for ${snapshotMonth}. You can view cached blueprints now, or generate another fresh blueprint next month.`,
  });
}

function buildMonthlyBlueprintSnapshots(input: {
  leagueId: string;
  leagueName: string;
  leagueFormat: string;
  snapshotMonth: string;
  reportData: any;
}) {
  const reportData = input.reportData || {};
  const positionCountsByManager = new Map((reportData.managerPositionCounts || []).map((row: any) => [row.manager, row]));
  const overviewByManager = new Map((reportData.leagueOverview || []).map((row: any) => [row.manager, row]));
  const powerByManager = new Map((reportData.powerRankings || []).map((row: any) => [row.manager, row]));
  const picksByManager = new Map((reportData.pickPortfolios || []).map((row: any) => [row.manager, row]));
  const tradesByManager = new Map((reportData.tradeTendencies || []).map((row: any) => [row.manager, row]));

  return (reportData.managerRosterIntelligence || []).map((row: any) => ({
    manager: row.manager,
    payload: {
      leagueId: input.leagueId,
      leagueName: input.leagueName,
      leagueFormat: input.leagueFormat,
      snapshotMonth: input.snapshotMonth,
      manager: row.manager,
      capturedAt: new Date().toISOString(),
      rosterIdentity: row.identity,
      timeline: row.timeline,
      summary: row.summary,
      strategySummary: row.strategySummary || row.tradePlan?.summary || null,
      starterValue: row.starterValue,
      starterSeasonValue: row.starterSeasonValue ?? null,
      benchValue: row.benchValue,
      starterValuePct: row.starterValuePct,
      avgAge: row.avgAge,
      avgAgeByPosition: row.avgAgeByPosition || null,
      positionGrades: row.positionGrades || null,
      pressurePoints: row.pressurePoints || [],
      ageFlags: row.ageFlags || [],
      holes: row.holes || null,
      starterAvailability: row.starterAvailability || null,
      keyPlayers: {
        buyTarget: row.buyTarget || null,
        sellCandidate: row.sellCandidate || null,
        tradeChip: row.tradeChip || null,
        youngCorePlayer: row.youngCorePlayer || null,
        oldestPlayer: row.oldestPlayer || null,
      },
      positionCounts: positionCountsByManager.get(row.manager) || null,
      leagueOverview: overviewByManager.get(row.manager) || null,
      powerRanking: powerByManager.get(row.manager) || null,
      pickPortfolio: picksByManager.get(row.manager) || null,
      tradeTendency: tradesByManager.get(row.manager) || null,
    },
  }));
}

async function readMonthlyBlueprintHistory(leagueId: string): Promise<ReportData['monthlyBlueprintHistory']> {
  try {
    const snapshots = await listMonthlyRosterBlueprintSnapshots({ leagueId, months: 6 });
    return snapshots
      .map((snapshot: any) => {
        if (!snapshot || typeof snapshot !== 'object') return null;
        const snapshotMonth = typeof snapshot.snapshotMonth === 'string' ? snapshot.snapshotMonth : '';
        const manager = typeof snapshot.manager === 'string' ? snapshot.manager : '';
        if (!snapshotMonth || !manager) return null;

        return {
          leagueId: typeof snapshot.leagueId === 'string' ? snapshot.leagueId : leagueId,
          leagueName: typeof snapshot.leagueName === 'string' ? snapshot.leagueName : undefined,
          leagueFormat: typeof snapshot.leagueFormat === 'string' ? snapshot.leagueFormat : undefined,
          snapshotMonth,
          manager,
          capturedAt: typeof snapshot.capturedAt === 'string' ? snapshot.capturedAt : null,
          rosterIdentity: typeof snapshot.rosterIdentity === 'string' ? snapshot.rosterIdentity : null,
          timeline: typeof snapshot.timeline === 'string' ? snapshot.timeline : null,
          strategySummary: typeof snapshot.strategySummary === 'string' ? snapshot.strategySummary : null,
          starterValue: Number.isFinite(Number(snapshot.starterValue)) ? Number(snapshot.starterValue) : null,
          starterSeasonValue: Number.isFinite(Number(snapshot.starterSeasonValue)) ? Number(snapshot.starterSeasonValue) : null,
          benchValue: Number.isFinite(Number(snapshot.benchValue)) ? Number(snapshot.benchValue) : null,
          starterValuePct: Number.isFinite(Number(snapshot.starterValuePct)) ? Number(snapshot.starterValuePct) : null,
          avgAge: Number.isFinite(Number(snapshot.avgAge)) ? Number(snapshot.avgAge) : null,
          avgAgeByPosition: snapshot.avgAgeByPosition || undefined,
          positionGrades: snapshot.positionGrades || null,
          pressurePoints: Array.isArray(snapshot.pressurePoints) ? snapshot.pressurePoints.slice(0, 8) : [],
          ageFlags: Array.isArray(snapshot.ageFlags) ? snapshot.ageFlags.slice(0, 8) : [],
          leagueOverview: snapshot.leagueOverview || null,
          powerRanking: snapshot.powerRanking || null,
          pickPortfolio: snapshot.pickPortfolio || null,
          tradeTendency: snapshot.tradeTendency || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (!a || !b) return 0;
        if (a.manager !== b.manager) return a.manager.localeCompare(b.manager);
        return a.snapshotMonth.localeCompare(b.snapshotMonth);
      }) as ReportData['monthlyBlueprintHistory'];
  } catch (error) {
    console.warn('Failed to read monthly blueprint history:', error);
    return [];
  }
}

async function persistMonthlyBlueprintSnapshots(input: {
  leagueId: string;
  leagueName: string;
  leagueFormat: string;
  reportData: any;
}): Promise<NonNullable<ReportData['monthlyBlueprintSnapshot']>> {
  const snapshotMonth = getBlueprintSnapshotMonth();
  const snapshots = buildMonthlyBlueprintSnapshots({
    leagueId: input.leagueId,
    leagueName: input.leagueName,
    leagueFormat: input.leagueFormat,
    snapshotMonth,
    reportData: input.reportData,
  });

  if (!snapshots.length) {
    return {
      month: snapshotMonth,
      status: 'unavailable',
      managerCount: 0,
      source: 'none',
      warning: 'No manager roster intelligence was returned, so no monthly blueprint snapshot was stored.',
    };
  }

  try {
    const stored = await upsertMonthlyRosterBlueprintSnapshots({
      leagueId: input.leagueId,
      snapshotMonth,
      snapshots,
    });
    if (stored) {
      return {
        month: snapshotMonth,
        status: 'stored',
        managerCount: snapshots.length,
        source: 'database',
        warning: null,
      };
    }
  } catch (error) {
    console.warn('Failed to store monthly blueprint snapshots in database:', error);
  }

  try {
    await fs.mkdir(MONTHLY_BLUEPRINT_FILE_CACHE_DIR, { recursive: true });
    await fs.writeFile(
      path.join(MONTHLY_BLUEPRINT_FILE_CACHE_DIR, `${input.leagueId}-${snapshotMonth}.json`),
      JSON.stringify({
        leagueId: input.leagueId,
        leagueName: input.leagueName,
        leagueFormat: input.leagueFormat,
        snapshotMonth,
        snapshots,
      })
    );
    return {
      month: snapshotMonth,
      status: 'local',
      managerCount: snapshots.length,
      source: 'file',
      warning: 'Database was unavailable, so this monthly blueprint snapshot was saved to the local file cache.',
    };
  } catch (error) {
    console.warn('Failed to store monthly blueprint snapshots locally:', error);
    return {
      month: snapshotMonth,
      status: 'unavailable',
      managerCount: snapshots.length,
      source: 'none',
      warning: 'Monthly blueprint snapshot persistence failed; the in-app report still uses the current returned data.',
    };
  }
}

async function getMonthlyBlueprintQuotaUnavailableSnapshot(input: {
  ctx: TrpcContext;
  leagueId: string;
  viewerUserId?: string | null;
  ipAddress?: string | null;
}): Promise<NonNullable<ReportData['monthlyBlueprintSnapshot']> | null> {
  try {
    await assertMonthlyReportGenerationAllowed(input);
    return null;
  } catch (error) {
    const snapshotMonth = getBlueprintSnapshotMonth();
    if (error instanceof TRPCError && error.code === 'TOO_MANY_REQUESTS') {
      return {
        month: snapshotMonth,
        status: 'unavailable',
        managerCount: 0,
        source: 'none',
        warning: `Monthly blueprint generation limit reached for ${snapshotMonth}. The league report loaded, but another fresh monthly blueprint cannot be generated until next month.`,
      };
    }

    if (error instanceof TRPCError && error.code === 'SERVICE_UNAVAILABLE') {
      return {
        month: snapshotMonth,
        status: 'unavailable',
        managerCount: 0,
        source: 'none',
        warning: 'The league report loaded, but monthly blueprint generation quota could not be checked. Try generating the blueprint again shortly.',
      };
    }

    throw error;
  }
}

function cloneReportWithViewerManager(payload: any, viewerUserId?: string | null): any {
  const viewerManager = viewerUserId
    ? payload?.reportData?.viewerManagerByUserId?.[viewerUserId] || null
    : null;

  if (!payload?.reportData || payload.reportData.viewerManager === viewerManager) {
    return payload;
  }

  return {
    ...payload,
    reportData: {
      ...payload.reportData,
      viewerManager,
    },
  };
}

function stripWeeklyProjectionFromPlayer<T extends Record<string, any> | null | undefined>(player: T): T {
  if (!player || typeof player !== 'object' || !('weeklyProjection' in player)) return player;
  const { weeklyProjection: _weeklyProjection, ...rest } = player;
  return rest as T;
}

function stripWeeklyProjectionFromPlayerArray<T>(players?: T[] | null): T[] | undefined | null {
  return Array.isArray(players)
    ? players.map((player) => stripWeeklyProjectionFromPlayer(player as any) as T)
    : players;
}

function stripWeeklyProjectionContextFromReportData(reportData: ReportData): ReportData {
  return {
    ...reportData,
    weeklyProjectionDiagnostics: {
      status: 'blocked',
      source: 'stored-weekly-projection',
      provider: 'sleeper',
      season: reportData.weeklyProjectionDiagnostics?.season || reportData.leagueDiagnostics?.currentSeason || null,
      week: reportData.weeklyProjectionDiagnostics?.week || reportData.leagueDiagnostics?.currentWeek || null,
      scoringProfile: reportData.weeklyProjectionDiagnostics?.scoringProfile || null,
      rowCount: 0,
      rosteredCoveragePct: null,
      attachedPlayerCount: 0,
      note: 'Stored weekly projections are disabled, so cached projection context was stripped before serving this report.',
      warnings: ['Projection feature flags are disabled.'],
    },
    playerDetailsById: Object.fromEntries(
      Object.entries(reportData.playerDetailsById || {}).map(([playerId, details]) => [
        playerId,
        stripWeeklyProjectionFromPlayer(details as any),
      ])
    ) as ReportData['playerDetailsById'],
    managerPositionCounts: (reportData.managerPositionCounts || []).map((row) => ({
      ...row,
      starterPlayers: stripWeeklyProjectionFromPlayerArray(row.starterPlayers) || [],
      lineupPlayers: stripWeeklyProjectionFromPlayerArray(row.lineupPlayers) || [],
      rosterPlayers: stripWeeklyProjectionFromPlayerArray(row.rosterPlayers) || [],
      starterGroups: (row.starterGroups || []).map((group) => ({
        ...group,
        players: stripWeeklyProjectionFromPlayerArray(group.players) || [],
      })),
    })),
    matchupPreviews: (reportData.matchupPreviews || []).filter((preview) => !/stored weekly projection/i.test(preview.source || '')),
    waiverIntelligence: reportData.waiverIntelligence
      ? {
          ...reportData.waiverIntelligence,
          availableTrendingAdds: stripWeeklyProjectionFromPlayerArray(reportData.waiverIntelligence.availableTrendingAdds) || [],
          rosteredTrendingAdds: stripWeeklyProjectionFromPlayerArray(reportData.waiverIntelligence.rosteredTrendingAdds) || [],
          bestTaxiStashes: stripWeeklyProjectionFromPlayerArray(reportData.waiverIntelligence.bestTaxiStashes) || [],
          recentlyDroppedValuable: stripWeeklyProjectionFromPlayerArray(reportData.waiverIntelligence.recentlyDroppedValuable) || [],
          highestKtcAvailable: stripWeeklyProjectionFromPlayer(reportData.waiverIntelligence.highestKtcAvailable as any) || null,
          bestAvailableByPosition: Object.fromEntries(
            Object.entries(reportData.waiverIntelligence.bestAvailableByPosition || {}).map(([position, player]) => [
              position,
              stripWeeklyProjectionFromPlayer(player as any) || null,
            ])
          ) as WaiverIntelligence['bestAvailableByPosition'],
          weeklyEcrTargets: (reportData.waiverIntelligence.weeklyEcrTargets || []).map((target) => ({
            ...target,
            player: stripWeeklyProjectionFromPlayer(target.player as any),
          })),
        }
      : reportData.waiverIntelligence,
  };
}

function stripWeeklyProjectionContextFromPayload(payload: any): any {
  if (!payload?.reportData || getProjectionGate('sleeper', 'weekly').enabled) return payload;
  return {
    ...payload,
    reportData: stripWeeklyProjectionContextFromReportData(payload.reportData),
  };
}

function createLeagueAnalyzeTimer(leagueId: string) {
  if (process.env.LOG_LEAGUE_ANALYZE_TIMING !== 'true') {
    return () => {};
  }
  const started = Date.now();
  let previous = started;
  return (step: string) => {
    const now = Date.now();
    console.log(`[league.analyze ${leagueId}] ${step}: +${now - previous}ms total=${now - started}ms`);
    previous = now;
  };
}

async function fetchLeagueTransactionWeek(leagueId: string, week: number): Promise<any[]> {
  const normalizedLeagueId = getValidSleeperEntityId(leagueId);
  if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
    return [];
  }

  try {
    const response = await fetchUserLoadResponse(
      `https://api.sleeper.app/v1/league/${normalizedLeagueId}/transactions/${week}`,
      "league transaction load"
    );

    if (!response.ok) {
      if (response.status === 404 || response.status === 400) {
        markInvalidLeagueId(normalizedLeagueId);
      }
      return [];
    }

    const payload = await response.json().catch(() => null);
    const transactions = Array.isArray(payload) ? payload : [];
    return transactions;
  } catch (error) {
    console.warn(`Failed to fetch Sleeper transactions for league ${leagueId} week ${week}:`, error);
    return [];
  }
}

async function fetchLeagueTransactions(leagueId: string): Promise<any[]> {
  const normalizedLeagueId = getValidSleeperEntityId(leagueId);
  if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
    return [];
  }

  const weeks = await Promise.all(
    Array.from({ length: 18 }, (_, index) => index + 1).map((week) =>
      fetchLeagueTransactionWeek(normalizedLeagueId, week)
    )
  );
  return weeks.flat();
}

async function fetchLeagueLiveActivityTransactions(leagueId: string, leagueInfo: any): Promise<any[]> {
  const currentWeek = getSleeperCurrentWeek(leagueInfo);
  const weeks = Array.from(new Set([currentWeek, Math.max(1, currentWeek - 1)]));
  const transactions = await Promise.all(
    weeks.map((week) => fetchLeagueTransactionWeek(leagueId, week))
  );
  return transactions.flat();
}

type HistoricalTransactionContext = {
  leagueId: string;
  season: string;
  transactions: any[];
  rosterUserMap: Record<string, string>;
  rosterUserDisplayMap: Record<string, string>;
  previousLeagueId: string | null;
  status: 'loaded' | 'failed' | 'invalid';
  error?: string | null;
};

async function fetchHistoricalTransactionContexts(
  startLeagueId?: string | null,
  seenLeagueIds = new Set<string>(),
  maxDepth = 3,
  currentManagers: {
    byUserId?: Record<string, string>;
    displayByUserId?: Record<string, string>;
    byRosterId?: Record<string, string>;
    displayByRosterId?: Record<string, string>;
  } = {}
): Promise<HistoricalTransactionContext[]> {
  const contexts: HistoricalTransactionContext[] = [];
  let leagueId = getValidSleeperEntityId(startLeagueId) || '';

  for (let depth = 0; leagueId && depth < maxDepth && !seenLeagueIds.has(leagueId); depth += 1) {
    seenLeagueIds.add(leagueId);
    try {
      if (isInvalidLeagueIdCached(leagueId)) {
        break;
      }

      const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${leagueId}`);
      if (!leagueInfo || typeof leagueInfo !== 'object' || !leagueInfo.league_id) {
        markInvalidLeagueId(leagueId);
        contexts.push({
          leagueId,
          season: '',
          transactions: [],
          rosterUserMap: {},
          rosterUserDisplayMap: {},
          previousLeagueId: null,
          status: 'invalid',
          error: 'Invalid league response',
        });
        break;
      }

      const resolvedLeagueId = getValidSleeperEntityId(leagueInfo.league_id);
      if (!resolvedLeagueId || isInvalidLeagueIdCached(resolvedLeagueId)) {
        markInvalidLeagueId(leagueId);
        contexts.push({
          leagueId,
          season: '',
          transactions: [],
          rosterUserMap: {},
          rosterUserDisplayMap: {},
          previousLeagueId: null,
          status: 'invalid',
          error: 'Invalid resolved league ID',
        });
        break;
      }

      const [users, rosters] = await Promise.all([
        fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${resolvedLeagueId}/users`),
        fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${resolvedLeagueId}/rosters`),
      ]);
      if (!Array.isArray(users) || !Array.isArray(rosters)) {
        markInvalidLeagueId(resolvedLeagueId);
        contexts.push({
          leagueId: resolvedLeagueId,
          season: '',
          transactions: [],
          rosterUserMap: {},
          rosterUserDisplayMap: {},
          previousLeagueId: null,
          status: 'invalid',
          error: 'Invalid league, user, or roster response',
        });
        break;
      }
      const userMap = Object.fromEntries(users.map((user: any) => [user.user_id, user]));
      const rosterUserMap = Object.fromEntries(
        rosters.map((roster: any) => [
          roster.roster_id,
          getCanonicalSleeperManagerName(
            userMap[roster.owner_id],
            currentManagers.byUserId,
            currentManagers.byRosterId,
            roster.roster_id
          ),
        ])
      );
      const rosterUserDisplayMap = Object.fromEntries(
        rosters.map((roster: any) => [
          roster.roster_id,
          getCanonicalSleeperManagerDisplayName(
            userMap[roster.owner_id],
            currentManagers.displayByUserId,
            currentManagers.displayByRosterId,
            roster.roster_id
          ),
        ])
      );
      const transactions = await fetchLeagueTransactions(resolvedLeagueId);
      const canonicalPreviousLeagueId = getPreviousSleeperLeagueId(leagueInfo);
      contexts.push({
        leagueId: resolvedLeagueId,
        season: String(leagueInfo.season || ''),
        transactions,
        rosterUserMap,
        rosterUserDisplayMap,
        previousLeagueId: canonicalPreviousLeagueId || null,
        status: 'loaded',
      });
      leagueId = canonicalPreviousLeagueId || '';
      if (leagueId && seenLeagueIds.has(leagueId)) {
        break;
      }
    } catch (error) {
      console.warn(`Failed to fetch historical Sleeper transactions for league ${leagueId}:`, error);
      contexts.push({
        leagueId: leagueId || '',
        season: '',
        transactions: [],
        rosterUserMap: {},
        rosterUserDisplayMap: {},
        previousLeagueId: null,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  return contexts;
}

function buildTransactionBackfillDiagnostics(contexts: HistoricalTransactionContext[]): NonNullable<ReportData['transactionBackfillDiagnostics']> {
  const transactions = contexts.flatMap((context) => context.transactions);
  const failedContexts = contexts.filter((context) => context.status === 'failed' || context.status === 'invalid');
  return {
    checkedLeagueCount: contexts.length,
    seasonCount: new Set(contexts.map((context) => context.season).filter(Boolean)).size,
    transactionCount: transactions.length,
    waiverOrFreeAgentCount: transactions.filter((transaction) => transaction?.status === 'complete' && ['waiver', 'free_agent'].includes(transaction?.type)).length,
    tradeProposalCount: transactions.filter((transaction) => transaction?.type === 'trade' && transaction?.status !== 'complete').length,
    completedTradeCount: transactions.filter((transaction) => transaction?.type === 'trade' && transaction?.status === 'complete').length,
    scannedLeagueIds: contexts.map((context) => context.leagueId),
    failedLeagueCount: failedContexts.length,
    failedLeagueIds: failedContexts.map((context) => context.leagueId),
    brokenPreviousLeagueChainCount: failedContexts.length,
    leagues: contexts.map((context) => ({
      leagueId: context.leagueId,
      season: context.season,
      transactionCount: context.transactions.length,
      previousLeagueId: context.previousLeagueId,
      status: context.status,
      error: context.error || null,
    })),
    generatedAt: new Date().toISOString(),
  };
}

function buildLeagueRosterValueRankings(
  rosters: any[] = [],
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode
) {
  const playerIds = rosters.flatMap((roster: any) => [
    ...(Array.isArray(roster?.players) ? roster.players : []),
    ...(Array.isArray(roster?.taxi) ? roster.taxi : []),
    ...(Array.isArray(roster?.reserve) ? roster.reserve : []),
  ]);
  const valueProfilesById = buildPlayerValueProfileMap(playerIds, players, ktcValues, leagueValueMode);

  return rosters
    .map((roster: any) => {
      const rosterId = Number(roster?.roster_id);
      const totalValue = [...(Array.isArray(roster?.players) ? roster.players : []), ...(Array.isArray(roster?.taxi) ? roster.taxi : []), ...(Array.isArray(roster?.reserve) ? roster.reserve : [])]
        .reduce((sum: number, playerId: string) => (
          sum + getPlayerValueForLeagueMode(String(playerId), players, ktcValues, leagueValueMode, valueProfilesById)
        ), 0);
      return {
        rosterId,
        totalValue,
      };
    })
    .filter((row) => Number.isFinite(row.rosterId))
    .sort((a, b) => {
      if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
      return a.rosterId - b.rosterId;
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

function getRosterPortfolioPlayerRefs(roster: any) {
  const refs = [
    ...(Array.isArray(roster?.players)
      ? roster.players.map((playerId: string) => ({ playerId, rosterSpot: 'active' as const }))
      : []),
    ...(Array.isArray(roster?.taxi)
      ? roster.taxi.map((playerId: string) => ({ playerId, rosterSpot: 'taxi' as const }))
      : []),
    ...(Array.isArray(roster?.reserve)
      ? roster.reserve.map((playerId: string) => ({ playerId, rosterSpot: 'reserve' as const }))
      : []),
  ];
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const playerId = String(ref.playerId || '').trim();
    if (!playerId || seen.has(playerId)) return false;
    seen.add(playerId);
    ref.playerId = playerId;
    return true;
  });
}

function buildUserRosterPortfolioPlayers(
  roster: any,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode
) {
  const refs = getRosterPortfolioPlayerRefs(roster);
  const playerIds = refs.map((ref) => ref.playerId);
  const valueProfilesById = buildPlayerValueProfileMap(playerIds, players, ktcValues, leagueValueMode);

  return refs
    .map((ref) => {
      const player = players[ref.playerId];
      if (!player) return null;
      const name = getPlayerName(ref.playerId, players);
      const position = typeof player.position === 'string' && player.position.trim()
        ? player.position.trim().toUpperCase()
        : null;
      const team = typeof player.team === 'string' && player.team.trim()
        ? player.team.trim().toUpperCase()
        : null;
      const value = getPlayerValueForLeagueMode(
        ref.playerId,
        players,
        ktcValues,
        leagueValueMode,
        valueProfilesById
      );
      const positionRank = getPlayerPositionRankForLeagueMode(
        ref.playerId,
        players,
        ktcValues,
        leagueValueMode,
        valueProfilesById
      );

      return {
        playerId: ref.playerId,
        name,
        position,
        team,
        value,
        positionRank,
        rosterSpot: ref.rosterSpot,
      };
    })
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.name.localeCompare(b.name);
    });
}

async function fetchSleeperJson<T = any>(url: string): Promise<T | null> {
  try {
    const response = await fetchUserLoadResponse(url, "Sleeper API load");
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

type SleeperPlayerResearchSnapshot = {
  owned?: number;
  started?: number;
};

type SleeperLeagueUsageBreakdown = {
  manager: string;
  rosterId: number;
  ownedGames: number;
  startedGames: number;
};

type SleeperLeagueUsageSummary = {
  season: string;
  ownedGames: number;
  startedGames: number;
  managerBreakdown: SleeperLeagueUsageBreakdown[];
};

type SleeperMatchupRow = {
  roster_id?: number | string | null;
  players?: Array<string | number | null | undefined>;
  starters?: Array<string | number | null | undefined>;
};

const sleeperPlayerResearchCache = new Map<string, { fetchedAt: number; data: Record<string, SleeperPlayerResearchSnapshot> }>();
const SLEEPER_PLAYER_RESEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
const sleeperLeagueUsageCache = new Map<string, { fetchedAt: number; data: Record<string, SleeperLeagueUsageSummary> }>();
const SLEEPER_LEAGUE_USAGE_CACHE_TTL_MS = 60 * 60 * 1000;
const SLEEPER_LEAGUE_USAGE_WEEKS = 18;

function normalizeSleeperSeasonType(value: string | null | undefined): string {
  return (value || 'regular').trim().toLowerCase() || 'regular';
}

function normalizeSleeperPlayerIds(ids: Array<string | number | null | undefined> | undefined): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const id of ids || []) {
    if (id === null || id === undefined) continue;
    const key = String(id).trim();
    if (!key || key === '0' || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return normalized;
}

async function fetchSleeperLeagueUsageSummary(
  leagueId: string,
  season: string,
  rosterUserMap: Record<string, string>,
  rosterDisplayMap: Record<string, string> = {},
): Promise<Record<string, SleeperLeagueUsageSummary>> {
  const normalizedLeagueId = getValidSleeperEntityId(leagueId);
  const normalizedSeason = String(season || '').trim();
  if (!normalizedLeagueId || !normalizedSeason) return {};

  const cacheKey = `${normalizedLeagueId}:${normalizedSeason}`;
  const cached = sleeperLeagueUsageCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SLEEPER_LEAGUE_USAGE_CACHE_TTL_MS) {
    return cached.data;
  }

  const matchupResponses = await Promise.all(
    Array.from({ length: SLEEPER_LEAGUE_USAGE_WEEKS }, (_, index) => index + 1).map(async (week) => [
      week,
      await fetchSleeperJson<SleeperMatchupRow[]>(
        `https://api.sleeper.app/v1/league/${encodeURIComponent(normalizedLeagueId)}/matchups/${week}`
      ),
    ] as const)
  );

  const usageByPlayerId = new Map<string, {
    season: string;
    ownedGames: number;
    startedGames: number;
    managerBreakdown: Map<string, SleeperLeagueUsageBreakdown>;
  }>();

  for (const [, matchups] of matchupResponses) {
    if (!Array.isArray(matchups) || matchups.length === 0) continue;

    const activeRows = matchups.filter((row) => {
      const rosterPlayers = normalizeSleeperPlayerIds(row?.players);
      const starterPlayers = normalizeSleeperPlayerIds(row?.starters);
      return rosterPlayers.length > 0 || starterPlayers.length > 0;
    });

    if (!activeRows.length) continue;

    for (const row of activeRows) {
      const rosterId = Number(row?.roster_id);
      if (!Number.isFinite(rosterId)) continue;

      const manager = rosterDisplayMap[String(rosterId)]
        || rosterUserMap[String(rosterId)]
        || `Roster ${rosterId}`;
      const rosterPlayers = normalizeSleeperPlayerIds(row.players);
      const starterPlayers = normalizeSleeperPlayerIds(row.starters);

      const getProfile = (playerId: string) => {
        let profile = usageByPlayerId.get(playerId);
        if (!profile) {
          profile = {
            season: normalizedSeason,
            ownedGames: 0,
            startedGames: 0,
            managerBreakdown: new Map<string, SleeperLeagueUsageBreakdown>(),
          };
          usageByPlayerId.set(playerId, profile);
        }
        return profile;
      };

      for (const playerId of rosterPlayers) {
        const profile = getProfile(playerId);
        profile.ownedGames += 1;
        const managerUsage = profile.managerBreakdown.get(manager) || {
          manager,
          rosterId,
          ownedGames: 0,
          startedGames: 0,
        };
        managerUsage.ownedGames += 1;
        profile.managerBreakdown.set(manager, managerUsage);
      }

      for (const playerId of starterPlayers) {
        const profile = getProfile(playerId);
        profile.startedGames += 1;
        const managerUsage = profile.managerBreakdown.get(manager) || {
          manager,
          rosterId,
          ownedGames: 0,
          startedGames: 0,
        };
        managerUsage.startedGames += 1;
        profile.managerBreakdown.set(manager, managerUsage);
      }
    }
  }

  const data = Object.fromEntries(
    Array.from(usageByPlayerId.entries()).map(([playerId, profile]) => [
      playerId,
      {
        season: profile.season,
        ownedGames: profile.ownedGames,
        startedGames: profile.startedGames,
        managerBreakdown: Array.from(profile.managerBreakdown.values()).sort((a, b) => {
          if (b.ownedGames !== a.ownedGames) return b.ownedGames - a.ownedGames;
          if (b.startedGames !== a.startedGames) return b.startedGames - a.startedGames;
          return a.manager.localeCompare(b.manager);
        }),
      },
    ])
  ) as Record<string, SleeperLeagueUsageSummary>;

  sleeperLeagueUsageCache.set(cacheKey, {
    fetchedAt: Date.now(),
    data,
  });

  return data;
}

async function fetchSleeperPlayerResearchMap(
  seasonType: string,
  season: string
): Promise<Record<string, SleeperPlayerResearchSnapshot>> {
  const normalizedSeasonType = normalizeSleeperSeasonType(seasonType);
  const normalizedSeason = String(season || '').trim();
  if (!normalizedSeason) return {};

  const cacheKey = `${normalizedSeasonType}:${normalizedSeason}`;
  const cached = sleeperPlayerResearchCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SLEEPER_PLAYER_RESEARCH_CACHE_TTL_MS) {
    return cached.data;
  }

  const data = await fetchSleeperJson<Record<string, SleeperPlayerResearchSnapshot>>(
    `https://api.sleeper.com/players/nfl/research/${encodeURIComponent(normalizedSeasonType)}/${encodeURIComponent(normalizedSeason)}`
  );

  if (!data || typeof data !== 'object') return {};

  const researchMap = data as Record<string, SleeperPlayerResearchSnapshot>;
  sleeperPlayerResearchCache.set(cacheKey, {
    fetchedAt: Date.now(),
    data: researchMap,
  });

  return researchMap;
}

type SleeperGraphQLTransactionResponse = {
  data?: {
    league_transactions_filtered?: any[];
  };
  errors?: Array<{ message?: string } | string>;
};

function getSleeperGraphQLErrorMessage(errors: SleeperGraphQLTransactionResponse['errors']): string | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const firstError = errors[0];
  if (typeof firstError === 'string') return firstError;
  return firstError?.message || null;
}

async function fetchSleeperTradeCenterTransactions(leagueId: string, authToken: string): Promise<any[]> {
  const normalizedAuthToken = authToken.replace(/^Bearer\s+/i, '').trim();
  const query = `
    query league_transactions_filtered {
      league_transactions_filtered(
        league_id: ${JSON.stringify(leagueId)},
        roster_id_filters: [],
        type_filters: ${JSON.stringify(['trade', 'waiver'])},
        leg_filters: [],
        status_filters: ${JSON.stringify(['pending', 'proposed', 'cancelled', 'failed', 'rejected'])},
        limit: 500
      ) {
        adds
        consenter_ids
        created
        creator
        draft_picks
        drops
        league_id
        leg
        metadata
        roster_ids
        settings
        status
        status_updated
        transaction_id
        type
        player_map
        waiver_budget
      }
    }
  `;

  const hiddenSleeperGraphqlUrl = 'https://api.sleeper.app/graphql';
  assertUserLoadAllowedLiveProviderUrl(hiddenSleeperGraphqlUrl, "hidden Sleeper import");
  const response = await fetchUserLoadResponse(hiddenSleeperGraphqlUrl, "hidden Sleeper import", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: normalizedAuthToken,
      'X-Sleeper-GraphQL-Op': 'league_transactions_filtered',
    },
    body: JSON.stringify({
      operationName: 'league_transactions_filtered',
      query,
    }),
  });

  const rawBody = await response.text();
  let payload: SleeperGraphQLTransactionResponse | null = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) as SleeperGraphQLTransactionResponse : null;
  } catch {
    payload = null;
  }

  const graphqlErrorMessage = getSleeperGraphQLErrorMessage(payload?.errors);
  const isUnauthorized = response.status === 401 || response.status === 403 || /unauthor/i.test(String(graphqlErrorMessage || ''));
  if (!response.ok || graphqlErrorMessage) {
    const message = isUnauthorized
      ? 'Sleeper auth token was rejected.'
      : graphqlErrorMessage || `Sleeper returned ${response.status} while loading hidden trade center data`;
    throw new TRPCError({
      code: isUnauthorized ? 'UNAUTHORIZED' : 'BAD_REQUEST',
      message,
    });
  }

  const transactions = payload?.data?.league_transactions_filtered;
  return Array.isArray(transactions) ? transactions : [];
}

type SleeperHiddenTradeCenterImport = {
  tradeProposalSignals: NonNullable<ReportData['adminSleeperTradeProposalSignals']>;
  waiverSignals: NonNullable<ReportData['adminSleeperWaiverSignals']>;
  transactionCount: number;
  tradeCount: number;
  waiverCount: number;
};

async function loadSleeperHiddenTradeCenterImport(input: {
  leagueId: string;
  authToken: string;
}): Promise<SleeperHiddenTradeCenterImport> {
  const normalizedLeagueId = getValidSleeperEntityId(input.leagueId);
  if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
  }

  const [users, rosters, players, hiddenTransactions] = await Promise.all([
    fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/users`),
    fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/rosters`),
    fetchSleeperPlayersIndex(),
    fetchSleeperTradeCenterTransactions(normalizedLeagueId, input.authToken.trim()),
  ]);

  if (!Array.isArray(users) || !Array.isArray(rosters)) {
    markInvalidLeagueId(normalizedLeagueId);
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league users or rosters data' });
  }

  const safeUsers = Array.isArray(users) ? users : [];
  const safeRosters = Array.isArray(rosters) ? rosters : [];
  const safePlayers = players && typeof players === 'object' ? players : {};
  const userMap = Object.fromEntries(safeUsers.map((user: any) => [user.user_id, user]));
  const rosterUserMap = Object.fromEntries(
    safeRosters.map((roster: any) => [
      roster.roster_id,
      normalizeManagerName(userMap[roster.owner_id]?.display_name),
    ])
  );

  const tradeProposalSignals = buildTradeProposalSignals(hiddenTransactions, rosterUserMap, safePlayers, null);
  const waiverSignals = buildSleeperWaiverClaimSignals(hiddenTransactions, rosterUserMap, safePlayers, userMap);

  return {
    tradeProposalSignals,
    waiverSignals,
    transactionCount: hiddenTransactions.length,
    tradeCount: tradeProposalSignals.length,
    waiverCount: waiverSignals.length,
  };
}

function buildSleeperHiddenLeagueSnapshotMetadata(input: {
  sharedBy?: string | null;
  sharedAt?: number | Date | null;
  transactionCount: number;
  tradeCount: number;
  waiverCount: number;
}): SleeperHiddenLeagueSnapshot {
  return {
    sharedBy: input.sharedBy?.trim() || null,
    sharedAt: input.sharedAt instanceof Date ? input.sharedAt.getTime() : Number(input.sharedAt || Date.now()),
    transactionCount: Number(input.transactionCount || 0),
    tradeCount: Number(input.tradeCount || 0),
    waiverCount: Number(input.waiverCount || 0),
  };
}

async function attachStoredSleeperHiddenLeagueSnapshot(payload: any, leagueId: string): Promise<any> {
  if (!payload?.reportData) return payload;

  const snapshot = await findLatestSleeperHiddenLeagueSnapshot(leagueId);
  if (!snapshot) return payload;

  return {
    ...payload,
    reportData: {
      ...payload.reportData,
      sleeperHiddenLeagueSnapshot: buildSleeperHiddenLeagueSnapshotMetadata(snapshot),
      adminSleeperTradeProposalSignals: snapshot.tradeProposalSignals,
      adminSleeperWaiverSignals: snapshot.waiverSignals,
    },
  };
}

const SLEEPER_PLAYERS_CACHE_TTL_MS = 60 * 60 * 1000;
let sleeperPlayersCache: {
  expiresAt: number;
  promise: Promise<Record<string, any>>;
} | null = null;

function fetchSleeperPlayersIndex(): Promise<Record<string, any>> {
  const now = Date.now();
  if (sleeperPlayersCache && sleeperPlayersCache.expiresAt > now) {
    return sleeperPlayersCache.promise;
  }

  const playersUrl = "https://api.sleeper.app/v1/players/nfl";
  assertUserLoadAllowedLiveProviderUrl(playersUrl, "Sleeper player index load");
  const promise = fetchUserLoadResponse(playersUrl, "Sleeper player index load")
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));

  sleeperPlayersCache = {
    expiresAt: now + SLEEPER_PLAYERS_CACHE_TTL_MS,
    promise,
  };

  return promise;
}

function getFinalMatchupFromBracket(bracket: any[]): { winner: number | null; loser: number | null } {
  if (!Array.isArray(bracket) || bracket.length === 0) return { winner: null, loser: null };

  const completed = bracket
    .filter((matchup) => matchup && matchup.w !== undefined && matchup.w !== null)
    .map((matchup) => ({
      ...matchup,
      r: Number(matchup.r || 0),
      m: Number(matchup.m || 999),
      w: Number(matchup.w),
      l: Number(matchup.l),
    }))
    .filter((matchup) => Number.isFinite(matchup.w));

  if (completed.length === 0) return { winner: null, loser: null };

  const finalMatchup = completed.sort((a, b) => {
    if (b.r !== a.r) return b.r - a.r;
    return a.m - b.m;
  })[0];

  return {
    winner: Number.isFinite(finalMatchup.w) ? finalMatchup.w : null,
    loser: Number.isFinite(finalMatchup.l) ? finalMatchup.l : null,
  };
}

function getChampionRosterIdFromBracket(bracket: any[]): number | null {
  return getFinalMatchupFromBracket(bracket).winner;
}

function getRunnerUpRosterIdFromBracket(bracket: any[]): number | null {
  return getFinalMatchupFromBracket(bracket).loser;
}

function getRosterIdByFinalRank(rosters: any[] = [], rank: number): number | null {
  const roster = rosters.find((item: any) => Number(item?.settings?.rank) === rank);
  const rosterId = Number(roster?.roster_id);
  return Number.isFinite(rosterId) ? rosterId : null;
}

function getLastPlaceRosterIdFromRosters(rosters: any[] = []): number | null {
  const ranked = rosters
    .map((roster: any) => ({
      rosterId: Number(roster?.roster_id),
      rank: Number(roster?.settings?.rank),
    }))
    .filter((item) => Number.isFinite(item.rosterId) && Number.isFinite(item.rank));

  if (ranked.length === 0) return null;

  ranked.sort((a, b) => b.rank - a.rank);
  return ranked[0]?.rosterId ?? null;
}

type NormalizedLosersBracketMatchup = {
  r: number;
  p: number;
  m: number;
  w: number;
  l: number;
  t1: number;
  t2: number;
};

function normalizeLosersBracket(bracket: any[] = []): NormalizedLosersBracketMatchup[] {
  if (!Array.isArray(bracket) || bracket.length === 0) return [];

  return bracket
    .filter((matchup) => matchup && (matchup.l !== undefined || matchup.w !== undefined))
    .map((matchup) => ({
      r: Number(matchup.r || 0),
      p: Number(matchup.p || 0),
      m: Number(matchup.m || 999),
      w: Number(matchup.w),
      l: Number(matchup.l),
      t1: Number(matchup.t1),
      t2: Number(matchup.t2),
    }))
    .filter((matchup) => Number.isFinite(matchup.w) || Number.isFinite(matchup.l));
}

function getLastPlaceGameFromLosersBracket(bracket: any[] = [], playoffType?: unknown): NormalizedLosersBracketMatchup | null {
  const completed = normalizeLosersBracket(bracket);
  if (completed.length === 0) return null;

  const isToiletBowl = Number(playoffType) === 0;
  const placementGames = completed.filter((matchup) => Number.isFinite(matchup.p) && matchup.p > 0);
  const candidateGames = placementGames.length > 0 ? placementGames : completed;
  const finalRound = Math.max(...candidateGames.map((matchup) => matchup.r));
  const finalRoundGames = candidateGames.filter((matchup) => matchup.r === finalRound);

  const lastPlaceGame = finalRoundGames.sort((a, b) => {
    if (isToiletBowl && a.p !== b.p) return a.p - b.p;
    if (!isToiletBowl && a.p !== b.p) return b.p - a.p;
    return b.m - a.m;
  })[0];

  if (!lastPlaceGame) return null;

  return lastPlaceGame;
}

function getRosterMatchupPoints(matchups: any[] = [], rosterId: number): number | null {
  const row = matchups.find((matchup) => Number(matchup?.roster_id) === rosterId);
  if (!row) return null;
  const customPoints = Number(row.custom_points);
  if (Number.isFinite(customPoints)) return customPoints;
  const points = Number(row.points);
  return Number.isFinite(points) ? points : null;
}

function getLastPlaceRosterIdFromMatchupPoints(
  lastPlaceGame: NormalizedLosersBracketMatchup | null,
  matchups: any[] = []
): number | null {
  if (!lastPlaceGame || !Number.isFinite(lastPlaceGame.t1) || !Number.isFinite(lastPlaceGame.t2)) return null;

  const t1Points = getRosterMatchupPoints(matchups, lastPlaceGame.t1);
  const t2Points = getRosterMatchupPoints(matchups, lastPlaceGame.t2);
  if (t1Points === null || t2Points === null || t1Points === t2Points) return null;

  return t1Points < t2Points ? lastPlaceGame.t1 : lastPlaceGame.t2;
}

function getBracketGameWeek(leagueInfo: any, bracketGame: NormalizedLosersBracketMatchup | null): number | null {
  if (!bracketGame || !Number.isFinite(bracketGame.r)) return null;
  const playoffWeekStart = Number(leagueInfo?.settings?.playoff_week_start || 0);
  if (!Number.isFinite(playoffWeekStart) || playoffWeekStart <= 0) return null;
  return playoffWeekStart + bracketGame.r - 1;
}

export function getLastPlaceRosterIdFromLosersBracket(
  bracket: any[] = [],
  playoffType?: unknown,
  matchups: any[] = []
): number | null {
  const lastPlaceGame = getLastPlaceGameFromLosersBracket(bracket, playoffType);
  if (!lastPlaceGame) return null;

  const matchupPointsLoser = getLastPlaceRosterIdFromMatchupPoints(lastPlaceGame, matchups);
  if (matchupPointsLoser !== null) return matchupPointsLoser;

  const isToiletBowl = Number(playoffType) === 0;
  const lastPlaceRosterId = isToiletBowl
    // Sleeper's toilet-bowl `w` field represents the team that advances through the loser's path.
    ? lastPlaceGame.w
    // In normal consolation placement games, `l` is the loser of the lowest placement game.
    : lastPlaceGame.l;

  if (Number.isFinite(lastPlaceRosterId)) return lastPlaceRosterId;
  const fallbackRosterId = isToiletBowl ? lastPlaceGame.l : lastPlaceGame.w;
  return Number.isFinite(fallbackRosterId) ? fallbackRosterId : null;
}

function getWorstRegularSeasonRosterId(rosters: any[] = []): number | null {
  const ranked = rosters
    .map((roster: any) => ({
      rosterId: Number(roster?.roster_id),
      wins: Number(roster?.settings?.wins || 0),
      losses: Number(roster?.settings?.losses || 0),
      points: Number(roster?.settings?.fpts || 0) + Number(roster?.settings?.fpts_decimal || 0) / 100,
    }))
    .filter((item) => Number.isFinite(item.rosterId));

  if (ranked.length === 0) return null;

  ranked.sort((a, b) => {
    if (a.wins !== b.wins) return a.wins - b.wins;
    if (b.losses !== a.losses) return b.losses - a.losses;
    return a.points - b.points;
  });

  return ranked[0]?.rosterId ?? null;
}

function buildCurrentStandings(rosters: any[] = [], rosterUserMap: Record<string, string> = {}) {
  const ranked = rosters
    .map((roster: any) => {
      const pointsFor = Number(roster?.settings?.fpts || 0) + Number(roster?.settings?.fpts_decimal || 0) / 100;
      return {
        rosterId: Number(roster?.roster_id),
        manager: rosterUserMap[String(roster?.roster_id)] || 'Unknown',
        wins: Number(roster?.settings?.wins || 0),
        losses: Number(roster?.settings?.losses || 0),
        ties: Number(roster?.settings?.ties || 0),
        pointsFor: Number.isFinite(pointsFor) ? pointsFor : 0,
      };
    })
    .filter((row) => row.manager && row.manager !== 'Unknown');

  ranked.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    if (a.ties !== b.ties) return b.ties - a.ties;
    if (a.pointsFor !== b.pointsFor) return b.pointsFor - a.pointsFor;
    return a.manager.localeCompare(b.manager);
  });

  return ranked.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

async function buildManagerChampionships(
  currentLeagueInfo: any,
  currentUsers: any[] = [],
  currentRosters: any[] = [],
  maxSeasons = 8
): Promise<Record<string, ManagerChampionship>> {
  const championships: Record<string, ManagerChampionship> = {};
  const addFinish = (manager: string | undefined, season: string, key: keyof ManagerChampionship) => {
    if (!manager || manager === 'Unknown') return;
    championships[manager] = championships[manager] || { seasons: [] };
    const seasons = championships[manager][key] || [];
    if (!seasons.includes(season)) {
      championships[manager][key] = [...seasons, season];
    }
  };
  const visited = new Set<string>();
  const safeCurrentUsers = Array.isArray(currentUsers) ? currentUsers : [];
  const safeCurrentRosters = Array.isArray(currentRosters) ? currentRosters : [];
  const currentManagerByUserId = Object.fromEntries(
    safeCurrentUsers.map((user: any) => [user.user_id, normalizeManagerName(user.display_name)])
  );
  const currentUserMap = Object.fromEntries(safeCurrentUsers.map((user: any) => [user.user_id, user]));
  const currentManagerByRosterId = Object.fromEntries(
    safeCurrentRosters.map((roster: any) => {
      const rosterId = Number(roster?.roster_id);
      const ownerId = roster?.owner_id ? String(roster.owner_id) : '';
      const manager = currentManagerByUserId[ownerId]
        || normalizeManagerName(currentUserMap[ownerId]?.display_name);
      return [rosterId, manager === 'Unknown' ? undefined : manager];
    })
  );
  let nextLeagueId = getPreviousSleeperLeagueId(currentLeagueInfo);

  for (let depth = 0; nextLeagueId && depth < maxSeasons && !visited.has(nextLeagueId); depth += 1) {
    const normalizedLeagueId = getValidSleeperEntityId(nextLeagueId);
    if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
      break;
    }

    visited.add(normalizedLeagueId);
    const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`);
    if (!leagueInfo?.league_id) {
      markInvalidLeagueId(normalizedLeagueId);
      break;
    }

    const leagueId = String(leagueInfo.league_id);
    if (!leagueId || isInvalidLeagueIdCached(leagueId)) {
      break;
    }

    const [users, rosters, winnersBracket, losersBracket] = await Promise.all([
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/users`),
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/winners_bracket`),
      fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/losers_bracket`),
    ]);
    if (!Array.isArray(users) || !Array.isArray(rosters)) {
      markInvalidLeagueId(leagueId);
      break;
    }

    const userMap = Object.fromEntries((users || []).map((user: any) => [user.user_id, user]));
    const season = String(leagueInfo.season || Number(currentLeagueInfo?.season || new Date().getFullYear()) - depth - 1);
    const managerByRosterId = Object.fromEntries(
      (Array.isArray(rosters) ? rosters : []).map((roster: any) => {
        const rosterId = Number(roster.roster_id);
        const ownerId = roster?.owner_id ? String(roster.owner_id) : '';
        const currentSlotManager = currentManagerByRosterId[rosterId];
        const manager = (currentSlotManager && currentSlotManager !== 'Unknown' ? currentSlotManager : undefined)
          || currentManagerByUserId[ownerId]
          || normalizeManagerName(userMap[ownerId]?.display_name);
        return [rosterId, manager];
      })
    );

    const championRosterId = getChampionRosterIdFromBracket(winnersBracket || [])
      ?? getRosterIdByFinalRank(rosters || [], 1);
    const runnerUpRosterId = getRunnerUpRosterIdFromBracket(winnersBracket || [])
      ?? getRosterIdByFinalRank(rosters || [], 2);
    const lastPlaceGame = getLastPlaceGameFromLosersBracket(losersBracket || [], leagueInfo?.settings?.playoff_type);
    const lastPlaceWeek = getBracketGameWeek(leagueInfo, lastPlaceGame);
    const lastPlaceWeekMatchups = lastPlaceWeek
      ? await fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${lastPlaceWeek}`)
      : null;
    const lastPlaceRosterId = getLastPlaceRosterIdFromLosersBracket(
      losersBracket || [],
      leagueInfo?.settings?.playoff_type,
      lastPlaceWeekMatchups || []
    )
      ?? getLastPlaceRosterIdFromRosters(rosters || [])
      ?? getWorstRegularSeasonRosterId(rosters || []);

    addFinish(managerByRosterId[championRosterId ?? -1], season, 'seasons');
    if (depth === 0 && runnerUpRosterId !== championRosterId) {
      addFinish(managerByRosterId[runnerUpRosterId ?? -1], season, 'runnerUpSeasons');
    }
    if (depth === 0 && lastPlaceRosterId !== championRosterId && lastPlaceRosterId !== runnerUpRosterId) {
      addFinish(managerByRosterId[lastPlaceRosterId ?? -1], season, 'lastPlaceSeasons');
    }

    nextLeagueId = getPreviousSleeperLeagueId(leagueInfo);
  }

  return Object.fromEntries(
    Object.entries(championships).map(([manager, championship]) => [
      manager,
      {
        seasons: [...championship.seasons].sort((a, b) => Number(b) - Number(a)),
        runnerUpSeasons: [...(championship.runnerUpSeasons || [])].sort((a, b) => Number(b) - Number(a)),
        lastPlaceSeasons: [...(championship.lastPlaceSeasons || [])].sort((a, b) => Number(b) - Number(a)),
      },
    ])
  );
}

function normalizeDepthChartPositionForCompare(position: unknown): string | null {
  if (typeof position !== 'string' || !position.trim()) return null;
  const normalized = position.trim().toUpperCase();
  if (['SWR', 'LWR', 'RWR'].includes(normalized)) return 'WR';
  if (normalized === 'PK') return 'K';
  if (normalized === 'HB') return 'RB';
  return normalized;
}

function normalizeDepthChartOrderForCompare(order: unknown): number | null {
  const numeric = Number(order);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function getPlayerDetails(
  playerId: string,
  player: Record<string, any> | undefined,
  rosterStatus?: string | null,
  actualDepthChart?: EspnDepthChartEntry
): PlayerDetails | undefined {
  if (!player) return undefined;

  const sleeperDepthChartPosition = player.depth_chart_position ?? null;
  const sleeperDepthChartOrder = player.depth_chart_order ?? null;
  const actualDepthChartPosition = actualDepthChart?.position ?? null;
  const actualDepthChartOrder = actualDepthChart?.order ?? null;
  const hasActualDepthChart = Boolean(actualDepthChartPosition && actualDepthChartOrder);
  const depthChartMismatch = hasActualDepthChart && (
    normalizeDepthChartPositionForCompare(sleeperDepthChartPosition) !== normalizeDepthChartPositionForCompare(actualDepthChartPosition)
    || normalizeDepthChartOrderForCompare(sleeperDepthChartOrder) !== normalizeDepthChartOrderForCompare(actualDepthChartOrder)
  );

  return {
    playerId,
    fullName: player.full_name || getPlayerName(playerId, { [playerId]: player }),
    position: player.position,
    team: player.team ?? null,
    jerseyNumber: player.number ?? null,
    age: player.age ?? null,
    birthDate: player.birth_date ?? null,
    height: player.height ?? null,
    weight: player.weight ?? null,
    college: player.college ?? null,
    rookieYear: player.metadata?.rookie_year ?? null,
    nflDraftRound: player.metadata?.draft_round ?? player.draft_round ?? null,
    nflDraftPick: player.metadata?.draft_pick ?? player.metadata?.draft_slot ?? player.draft_pick ?? null,
    nflDraftTeam: player.metadata?.draft_team ?? player.draft_team ?? null,
    highSchool: player.high_school ?? null,
    injuryStatus: player.injury_status ?? null,
    rosterStatus: rosterStatus ?? null,
    displayStatus: getDisplayStatus(player, rosterStatus),
    depthChartPosition: actualDepthChartPosition ?? sleeperDepthChartPosition,
    depthChartOrder: actualDepthChartOrder ?? sleeperDepthChartOrder,
    sleeperDepthChartPosition,
    sleeperDepthChartOrder,
    depthChartVerified: hasActualDepthChart,
    depthChartMismatch,
    yearsExp: player.years_exp ?? null,
    status: player.status ?? null,
    sleeperNewsUpdated: player.news_updated ?? null,
    externalIds: {
      fantasyData: player.fantasy_data_id,
      sportradar: player.sportradar_id,
      yahoo: player.yahoo_id,
      gsis: player.gsis_id,
      espn: player.espn_id,
      stats: player.stats_id,
    },
  };
}

async function fetchPlayerAvailabilityHistory(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  scoringSettings: Record<string, any> | undefined,
  lastCompletedSeason: string,
): Promise<Record<string, Pick<PlayerDetails, 'availabilityHistory' | 'avgGamesMissed' | 'availabilitySeasons'>>> {
  const uniquePlayerIds = Array.from(new Set(Array.from(playerIds).filter(Boolean)))
    .filter((playerId) => ['QB', 'RB', 'WR', 'TE'].includes(players[playerId]?.position));
  if (!uniquePlayerIds.length) return {};

  const playerStartSeasonById = Object.fromEntries(
    uniquePlayerIds.map((playerId) => [
      playerId,
      Math.max(MIN_SLEEPER_SEASON, getSeasonLineupPlayerStartSeason(players[playerId], lastCompletedSeason)),
    ])
  );
  const earliestSeason = Math.max(
    MIN_SLEEPER_SEASON,
    Math.min(...Object.values(playerStartSeasonById))
  );
  const seasonRange = Number(lastCompletedSeason) - earliestSeason + 1;
  if (!Number.isFinite(seasonRange) || seasonRange <= 0) {
    return Object.fromEntries(uniquePlayerIds.map((playerId) => [
      playerId,
      {
        availabilityHistory: [],
        avgGamesMissed: null,
        availabilitySeasons: 0,
      },
    ]));
  }

  const seasons = Array.from({ length: seasonRange }, (_, index) => String(earliestSeason + index));
  const seasonRankMaps = await Promise.all(
    seasons.map(async (season) => [
      season,
      await buildSleeperSeasonRankMap(season, players, scoringSettings, ['QB', 'RB', 'WR', 'TE'], getUserLoadSnapshotOptions()),
    ] as const)
  );
  const seasonRankMapBySeason = Object.fromEntries(seasonRankMaps);

  return Object.fromEntries(uniquePlayerIds.map((playerId) => {
    const playerHistoryStartSeason = playerStartSeasonById[playerId] || earliestSeason;
    const history = seasons
      .filter((season) => Number(season) >= playerHistoryStartSeason)
      .map((season) => {
        const summary = seasonRankMapBySeason[season]?.[playerId];
        if (!summary) return null;
        const gamesPlayed = summary.games ?? null;
        return {
          season,
          games: gamesPlayed,
          gamesMissed: gamesPlayed !== null
            ? Math.max(0, getSleeperSeasonWeekCount(season) - gamesPlayed)
            : null,
          pointsPerGame: summary.pointsPerGame ?? null,
          positionRank: summary.positionRank ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const avgGamesMissed = history.length
      ? Math.round((history.reduce((sum, item) => sum + (item.gamesMissed || 0), 0) / history.length) * 10) / 10
      : null;

    return [
      playerId,
      {
        availabilityHistory: history,
        avgGamesMissed,
        availabilitySeasons: history.length,
      },
    ];
  }));
}

function buildPlayerDetailsMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  rosterStatusByPlayerId: Record<string, string> = {},
  actualDepthChartsByPlayerId: Record<string, EspnDepthChartEntry> = {}
): Record<string, PlayerDetails> {
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean)))
      .map((playerId) => {
        const details = getPlayerDetails(playerId, players[playerId], rosterStatusByPlayerId[playerId], actualDepthChartsByPlayerId[playerId]);
        return [playerId, details];
      })
      .filter((entry): entry is [string, PlayerDetails] => Boolean(entry[1]))
  );
}

function getKtcValueProfileLookup(ktcValues: KTCValues): Map<string, KtcValueProfileCandidate> {
  const cached = ktcValueProfileLookupCache.get(ktcValues);
  if (cached) return cached;

  const lookup = new Map<string, KtcValueProfileCandidate>();
  for (const [ktcKey, value] of Object.entries(ktcValues)) {
    const sourceCount = value.value_sources?.length || 0;
    const candidate = { key: ktcKey, data: value, score: sourceCount * 1000 + (value.ktc_value || 0) };
    for (const variant of playerNameKeyVariants(ktcKey).map(cleanName).filter(Boolean)) {
      const current = lookup.get(variant);
      if (!current || candidate.score > current.score) {
        lookup.set(variant, candidate);
      }
    }
  }

  ktcValueProfileLookupCache.set(ktcValues, lookup);
  return lookup;
}

function findKtcValueProfileCandidate(
  key: string,
  ktcValues: KTCValues
): KtcValueProfileCandidate | undefined {
  const lookup = getKtcValueProfileLookup(ktcValues);
  return Array.from(new Set(playerNameKeyVariants(key).map(cleanName).filter(Boolean)))
    .map((variant) => lookup.get(variant))
    .filter((candidate): candidate is KtcValueProfileCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score)[0];
}

function getPlayerCurrentPositionRank(
  playerId: string,
  players: Record<string, any>,
  ktcValues: KTCValues
): string | null {
  const player = players[playerId];
  if (!player) return null;

  const fullName = `${player.first_name || ''}${player.last_name || ''}`;
  const key = cleanName(fullName);
  const rank = findKtcValueProfileCandidate(key, ktcValues)?.data.position_rank;

  return rank || null;
}

function getValueProfileValueForMode(
  profile: PlayerDetails['valueProfile'] | undefined,
  leagueValueMode: LeagueValueMode
): number | null {
  if (!profile) return null;
  if (leagueValueMode === 'redraft') {
    return profile.seasonValue ?? profile.fantasyProsSeasonValue ?? profile.fantasyCalcRedraft ?? null;
  }
  if (leagueValueMode === 'keeper') {
    return profile.balancedValue ?? profile.dynastyValue ?? profile.seasonValue ?? null;
  }
  return profile.dynastyValue ?? profile.balancedValue ?? profile.seasonValue ?? null;
}

function getValueProfileRankForMode(
  profile: PlayerDetails['valueProfile'] | undefined,
  leagueValueMode: LeagueValueMode
): string | null {
  if (!profile) return null;
  if (leagueValueMode === 'redraft') {
    return profile.seasonPositionRank ?? profile.fantasyProsPositionRank ?? null;
  }
  if (leagueValueMode === 'keeper') {
    return profile.balancedPositionRank ?? profile.dynastyPositionRank ?? profile.seasonPositionRank ?? null;
  }
  return profile.dynastyPositionRank ?? profile.balancedPositionRank ?? profile.seasonPositionRank ?? null;
}

function getPlayerValueProfile(
  playerId: string,
  players: Record<string, any>,
  ktcValues: KTCValues,
  rankLookups?: Record<string, Partial<Record<'dynastyPositionRank' | 'seasonPositionRank' | 'contenderPositionRank' | 'rebuilderPositionRank' | 'balancedPositionRank', string>>>,
  leagueValueMode: LeagueValueMode = 'dynasty'
): PlayerDetails['valueProfile'] | undefined {
  const player = players[playerId];
  if (!player) return undefined;

  const key = cleanName(`${player.first_name || ''}${player.last_name || ''}`);
  const best = findKtcValueProfileCandidate(key, ktcValues);
  let data = best?.data;
  let dataKey = best?.key || key;

  if (!data) return undefined;

  const isRedraftProfile = leagueValueMode === 'redraft';
  const dynastyValue = isRedraftProfile ? null : data.dynasty_value ?? data.ktc_value ?? null;
  const seasonValue = isRedraftProfile
    ? data.redraft_value ?? data.fantasypros_season_value ?? null
    : data.redraft_value ?? data.true_value ?? data.ktc_value ?? null;
  const contenderValue = !isRedraftProfile && dynastyValue && seasonValue
    ? Math.round((seasonValue * 0.6) + (dynastyValue * 0.4))
    : isRedraftProfile ? null : seasonValue ?? dynastyValue;
  const rebuilderValue = !isRedraftProfile && dynastyValue && seasonValue
    ? Math.round((dynastyValue * 0.8) + (seasonValue * 0.2))
    : isRedraftProfile ? null : dynastyValue ?? seasonValue;
  const balancedValue = !isRedraftProfile && dynastyValue && seasonValue
    ? Math.round((dynastyValue * 0.55) + (seasonValue * 0.45))
    : isRedraftProfile ? null : dynastyValue ?? seasonValue;

  return {
    dynastyValue,
    seasonValue,
    contenderValue,
    rebuilderValue,
    balancedValue,
    dynastyPositionRank: isRedraftProfile ? null : rankLookups?.[dataKey]?.dynastyPositionRank || data.position_rank || null,
    seasonPositionRank: rankLookups?.[dataKey]?.seasonPositionRank || data.fantasypros_position_rank || null,
    contenderPositionRank: isRedraftProfile ? null : rankLookups?.[dataKey]?.contenderPositionRank || null,
    rebuilderPositionRank: isRedraftProfile ? null : rankLookups?.[dataKey]?.rebuilderPositionRank || null,
    balancedPositionRank: isRedraftProfile ? null : rankLookups?.[dataKey]?.balancedPositionRank || data.position_rank || null,
    marketKtc: isRedraftProfile ? null : data.market_value_ktc ?? null,
    flockFantasy: isRedraftProfile ? null : data.expert_value_flock ?? null,
    flockRank: isRedraftProfile ? null : data.flock_rank ?? null,
    flockPositionRank: isRedraftProfile ? null : data.flock_position_rank ?? null,
    flockTier: isRedraftProfile ? null : data.flock_tier ?? null,
    flockFormat: isRedraftProfile ? null : data.flock_format ?? null,
    flockBestBall: data.flock_best_ball_value ?? null,
    flockBestBallRank: data.flock_best_ball_rank ?? null,
    flockBestBallPositionRank: data.flock_best_ball_position_rank ?? null,
    flockBestBallFormat: data.flock_best_ball_format ?? null,
    fantasyProsDynasty: isRedraftProfile ? null : data.expert_value_fantasypros ?? null,
    fantasyProsDynastyRank: isRedraftProfile ? null : data.fantasypros_dynasty_rank ?? null,
    fantasyProsDynastyPositionRank: isRedraftProfile ? null : data.fantasypros_dynasty_position_rank ?? null,
    fantasyCalcDynasty: isRedraftProfile ? null : data.market_value_fantasycalc ?? null,
    fantasyCalcRedraft: data.redraft_value ?? null,
    dynastyProcess: isRedraftProfile ? null : data.expert_value_dynastyprocess ?? null,
    dynastyNerds: isRedraftProfile ? null : data.expert_value_dynastynerds ?? null,
    fantasyNerds: isRedraftProfile ? null : data.expert_value_fantasynerds ?? null,
    fantasyNerdsRank: isRedraftProfile ? null : data.fantasynerds_rank ?? null,
    fantasyNerdsPositionRank: isRedraftProfile ? null : data.fantasynerds_position_rank ?? null,
    dynastyNerdsRank: isRedraftProfile ? null : data.dynastynerds_rank ?? null,
    dynastyNerdsPositionRank: isRedraftProfile ? null : data.dynastynerds_position_rank ?? null,
    dynastyNerdsFormat: isRedraftProfile ? null : data.dynastynerds_format ?? null,
    dynastyDealerBenchmark: isRedraftProfile ? null : data.benchmark_value_dynastydealer ?? null,
    dynastyDealerVoteRating: isRedraftProfile ? null : data.dynastydealer_vote_rating ?? null,
    dynastyDealerUpdatedAt: isRedraftProfile ? null : data.dynastydealer_updated_at ?? null,
    fantasyProsRank: data.fantasypros_rank ?? null,
    fantasyProsPositionRank: data.fantasypros_position_rank ?? null,
    fantasyProsTier: data.fantasypros_tier ?? null,
    fantasyProsSeasonValue: data.fantasypros_season_value ?? null,
    fantasyProsSourceTrace: buildFantasyProsPlayerSourceTrace(data, { isRedraftProfile }),
    sources: data.value_sources || [],
  };
}

function getPlayerValueForLeagueMode(
  playerId: string,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): number {
  const profile = valueProfilesById?.[playerId] || getPlayerValueProfile(playerId, players, ktcValues, undefined, leagueValueMode);
  const modeValue = getValueProfileValueForMode(profile, leagueValueMode);
  if (typeof modeValue === 'number' && Number.isFinite(modeValue)) return modeValue;
  if (leagueValueMode === 'redraft') return 0;
  return getPlayerValue(playerId, players, ktcValues);
}

function getPlayerPositionRankForLeagueMode(
  playerId: string,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): string | null {
  const profile = valueProfilesById?.[playerId] || getPlayerValueProfile(playerId, players, ktcValues, undefined, leagueValueMode);
  const modeRank = getValueProfileRankForMode(profile, leagueValueMode);
  if (modeRank) return modeRank;
  if (leagueValueMode === 'redraft') return null;
  return getPlayerCurrentPositionRank(playerId, players, ktcValues);
}

type WaiverLineupPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
type WaiverSpecialTeamsPosition = Extract<WaiverLineupPosition, 'K' | 'DEF'>;

function getWaiverRankNumber(positionRank: string | null | undefined): number | null {
  const match = String(positionRank || '').match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function getWaiverRankPosition(positionRank: string | null | undefined): WaiverLineupPosition | null {
  const position = String(positionRank || '').replace(/\d+/g, '');
  const normalized = normalizeSeasonLineupPosition(position);
  return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(normalized || '')
    ? normalized as WaiverLineupPosition
    : null;
}

function getWaiverPositionRankForPosition(
  positionRank: string | null | undefined,
  position: WaiverLineupPosition
): string | null {
  const rankPosition = getWaiverRankPosition(positionRank);
  const rankNumber = getWaiverRankNumber(positionRank);
  if (!rankPosition || rankPosition !== position || !rankNumber) return null;
  return `${position}${rankNumber}`;
}

function getRankBasedWaiverSeasonValue(positionRank: string | null | undefined): number {
  const position = getWaiverRankPosition(positionRank);
  const rank = getWaiverRankNumber(positionRank);
  if (!position || !rank) return 0;

  const replacementByPosition: Record<WaiverLineupPosition, number> = {
    QB: 30,
    RB: 60,
    WR: 72,
    TE: 24,
    K: 20,
    DEF: 20,
  };
  const ceilingByPosition: Record<WaiverLineupPosition, number> = {
    QB: 7000,
    RB: 6500,
    WR: 6500,
    TE: 4500,
    K: 1200,
    DEF: 1200,
  };
  const replacement = replacementByPosition[position];
  const ratio = Math.max(0.04, (replacement - rank + 1) / replacement);
  return Math.max(100, Math.round(ceilingByPosition[position] * Math.pow(ratio, 1.35)));
}

function leagueUsesWaiverSpecialTeamsPosition(
  rosterPositions: string[] | undefined,
  position: WaiverSpecialTeamsPosition
): boolean {
  return (rosterPositions || []).some((slot) => normalizeSeasonLineupPosition(slot) === position);
}

function getSpecialTeamsWaiverRank(
  playerId: string,
  position: WaiverSpecialTeamsPosition,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>,
  lastSeasonPositionRanks?: Record<string, LastSeasonPlayerRank>
): string | null {
  const profile = valueProfilesById?.[playerId];
  return getWaiverPositionRankForPosition(
    profile?.seasonPositionRank
      || profile?.fantasyProsPositionRank
      || lastSeasonPositionRanks?.[playerId]?.positionRank
      || null,
    position
  );
}

function getSpecialTeamsWaiverValue(
  playerId: string,
  position: WaiverSpecialTeamsPosition,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>,
  lastSeasonPositionRanks?: Record<string, LastSeasonPlayerRank>
): number {
  const profile = valueProfilesById?.[playerId];
  const profileValue = profile?.seasonValue ?? profile?.fantasyProsSeasonValue ?? null;
  if (typeof profileValue === 'number' && Number.isFinite(profileValue) && profileValue > 0) return profileValue;
  const rank = getSpecialTeamsWaiverRank(playerId, position, valueProfilesById, lastSeasonPositionRanks);
  return getRankBasedWaiverSeasonValue(rank);
}

function getWaiverCandidateRank(
  playerId: string,
  position: WaiverLineupPosition,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>,
  lastSeasonPositionRanks?: Record<string, LastSeasonPlayerRank>
): string | null {
  if (position === 'K' || position === 'DEF') {
    return getSpecialTeamsWaiverRank(playerId, position, valueProfilesById, lastSeasonPositionRanks)
      || getWaiverPositionRankForPosition(
        getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById),
        position
      );
  }

  return getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
}

function getWaiverCandidateValue(
  playerId: string,
  position: WaiverLineupPosition,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>,
  lastSeasonPositionRanks?: Record<string, LastSeasonPlayerRank>
): number {
  if (position === 'K' || position === 'DEF') {
    return getSpecialTeamsWaiverValue(playerId, position, valueProfilesById, lastSeasonPositionRanks)
      || getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
  }

  return getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
}

const WAIVER_AI_RANK_LIMITS: Record<WaiverLineupPosition, number> = {
  QB: 40,
  RB: 90,
  WR: 105,
  TE: 24,
  K: 20,
  DEF: 20,
};

function getWaiverCandidateSourceCount(profile?: PlayerDetails['valueProfile']): number {
  if (!profile) return 0;
  const sourceKeys = new Set<string>((profile.sources || []).filter(Boolean));
  [
    ['KTC', profile.marketKtc],
    ['FlockFantasy', profile.flockFantasy],
    ['FlockBestBall', profile.flockBestBall],
    ['FantasyPros', profile.fantasyProsDynasty || profile.fantasyProsSeasonValue],
    ['FantasyCalc', profile.fantasyCalcDynasty || profile.fantasyCalcRedraft],
    ['DynastyProcess', profile.dynastyProcess],
    ['DynastyNerds', profile.dynastyNerds],
    ['FantasyNerds', profile.fantasyNerds],
  ].forEach(([source, value]) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      sourceKeys.add(String(source));
    }
  });
  return sourceKeys.size;
}

function buildWaiverCandidateOmission({
  playerId,
  player,
  position,
  value,
  rank,
  sourceCount,
  reason,
}: {
  playerId: string;
  player: Record<string, any>;
  position: WaiverLineupPosition;
  value: number;
  rank: string | null;
  sourceCount: number;
  reason: string;
}): WaiverOmittedCandidate {
  return {
    player_id: playerId,
    name: getPlayerName(playerId, { [playerId]: player }),
    pos: position,
    team: player?.team || null,
    value: value || null,
    rank,
    sourceCount,
    reason,
    action: 'omit',
  };
}

function getWaiverCandidateOmissionReason({
  player,
  position,
  value,
  rank,
  sourceCount,
  leagueValueMode,
}: {
  player: Record<string, any>;
  position: WaiverLineupPosition;
  value: number;
  rank: string | null;
  sourceCount: number;
  leagueValueMode: LeagueValueMode;
}): string | null {
  if (position !== 'DEF' && !player?.team) {
    return 'No active NFL team on the Sleeper player record.';
  }

  const rankNumber = getWaiverRankNumber(rank);
  const rankLimit = WAIVER_AI_RANK_LIMITS[position];
  if (rankNumber && rankNumber > rankLimit) {
    return `Outside the trusted ${position} waiver rank window (${rank}).`;
  }

  if (position === 'K' || position === 'DEF') return null;

  const isRookie = Number(player?.metadata?.rookie_year || player?.rookie_year || 0) >= new Date().getFullYear();
  const lowValueCutoff = leagueValueMode === 'redraft' ? 900 : 1200;
  if (sourceCount <= 1 && value < lowValueCutoff && !isRookie) {
    return 'Thin single-source value below the waiver trust threshold.';
  }

  if (sourceCount === 0 && !rankNumber) {
    return 'No usable value source or positional rank for waiver analysis.';
  }

  return null;
}

type WaiverWeeklyEcrIndex = {
  rowsByKey: Map<string, FantasyProsConsensusSnapshotRow[]>;
  summariesByEndpointKey: Map<string, FantasyProsSnapshotSummary>;
  season: string | null;
  scoring: string | null;
};

const FANTASYPROS_TEAM_ALIASES: Record<string, string> = {
  ARZ: 'ARI',
  GBP: 'GB',
  GNB: 'GB',
  JAC: 'JAX',
  JAX: 'JAX',
  KAN: 'KC',
  LA: 'LAR',
  LAR: 'LAR',
  LV: 'LV',
  NEP: 'NE',
  NOR: 'NO',
  NWE: 'NE',
  OAK: 'LV',
  SD: 'LAC',
  SFO: 'SF',
  STL: 'LAR',
  TAM: 'TB',
  WSH: 'WAS',
};

function normalizeFantasyProsWaiverPosition(position?: string | null): string | null {
  const normalized = normalizeSeasonLineupPosition(position);
  if (normalized === 'DEF') return 'DST';
  return normalized && ['QB', 'RB', 'WR', 'TE', 'K', 'DST'].includes(normalized) ? normalized : null;
}

function normalizeWaiverEcrTeam(team?: string | null): string | null {
  const normalized = String(team || '').trim().toUpperCase();
  if (!normalized) return null;
  return FANTASYPROS_TEAM_ALIASES[normalized] || normalized;
}

function weeklyEcrKey(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(':').toLowerCase();
}

function weeklyEcrEndpointKey(position: string | null | undefined, week: number | null | undefined): string | null {
  const normalizedPosition = normalizeFantasyProsWaiverPosition(position);
  const normalizedWeek = Number(week || 0);
  if (!normalizedPosition || !Number.isFinite(normalizedWeek) || normalizedWeek <= 0) return null;
  return `fantasypros-weekly-ecr-${normalizedPosition.toLowerCase()}-week-${normalizedWeek}`;
}

function addWeeklyEcrIndexRow(
  rowsByKey: Map<string, FantasyProsConsensusSnapshotRow[]>,
  key: string | null,
  row: FantasyProsConsensusSnapshotRow
) {
  if (!key) return;
  const rows = rowsByKey.get(key) || [];
  rows.push(row);
  rowsByKey.set(key, rows);
}

function buildWaiverWeeklyEcrIndex(context?: FantasyProsSnapshotContext | null): WaiverWeeklyEcrIndex {
  const rowsByKey = new Map<string, FantasyProsConsensusSnapshotRow[]>();
  const summariesByEndpointKey = new Map(
    (context?.summaries || []).map((summary) => [summary.endpointKey, summary])
  );
  const emptyIndex = {
    rowsByKey,
    summariesByEndpointKey,
    season: context?.season || null,
    scoring: context?.scoring || null,
  };
  if (!context?.weeklyEcrByPositionWeek) return emptyIndex;

  for (const [positionKey, weeks] of Object.entries(context.weeklyEcrByPositionWeek)) {
    const position = normalizeFantasyProsWaiverPosition(positionKey);
    if (!position) continue;

    for (const rows of Object.values(weeks || {})) {
      for (const row of Object.values(rows || {})) {
        const rowPosition = normalizeFantasyProsWaiverPosition(row.position || position);
        if (!rowPosition || rowPosition !== position) continue;
        const team = normalizeWaiverEcrTeam(row.team);
        const ref = context.playersByFantasyProsId[row.fantasyProsId];

        addWeeklyEcrIndexRow(rowsByKey, weeklyEcrKey(['fp', row.fantasyProsId]), row);
        Object.entries(ref?.externalIds || {})
          .filter(([key]) => /sleeper/i.test(key))
          .forEach(([, value]) => addWeeklyEcrIndexRow(rowsByKey, weeklyEcrKey(['sleeper', String(value)]), row));

        for (const nameKey of playerNameKeyVariants(row.name || ref?.name || '')) {
          addWeeklyEcrIndexRow(rowsByKey, weeklyEcrKey(['name', position, team, nameKey]), row);
          addWeeklyEcrIndexRow(rowsByKey, weeklyEcrKey(['name', position, 'any', nameKey]), row);
        }

        if (position === 'DST' && team) {
          addWeeklyEcrIndexRow(rowsByKey, weeklyEcrKey(['team', position, team]), row);
        }
      }
    }
  }

  return emptyIndex;
}

function getWaiverWeeklyEcrTraceEntry(
  row: FantasyProsConsensusSnapshotRow,
  index: WaiverWeeklyEcrIndex
): WaiverSourceTraceEntry {
  const endpointKey = weeklyEcrEndpointKey(row.position, row.week) || 'fantasypros-weekly-ecr';
  const summary = index.summariesByEndpointKey.get(endpointKey);
  const week = Number(row.week || 0) || null;
  const position = normalizeSeasonLineupPosition(row.position) || row.position || null;
  const rankCopy = row.positionRank || (row.rankEcr ? `ECR ${row.rankEcr}` : 'ranked');
  const rowCount = summary?.rowCount ?? null;
  const freshnessCopy = summary?.fetchedAt
    ? `fetched ${summary.fetchedAt}`
    : summary?.lastUpdated
      ? `updated ${summary.lastUpdated}`
      : 'snapshot freshness unavailable';

  return {
    source: 'FantasyPros',
    sourceKey: summary?.sourceKey || `fantasypros-endpoint-v1:${row.season || index.season || 'unknown'}:${row.scoring || index.scoring || 'PPR'}:${endpointKey}`,
    endpointKey,
    endpointLabel: summary?.source || endpointKey,
    status: summary?.status || 'loaded',
    season: row.season || index.season || '',
    scoring: row.scoring || index.scoring || '',
    week,
    position,
    rowCount,
    fetchedAt: summary?.fetchedAt || null,
    lastUpdated: row.lastUpdated || summary?.lastUpdated || null,
    evidence: `Week ${week || '?'} ${position || row.position || 'ECR'} ${rankCopy}; ${rowCount === null ? 'row count unavailable' : `${rowCount} rows`}; ${freshnessCopy}.`,
  };
}

function buildWaiverWeeklyEcrTraceSummary(trace: WaiverSourceTraceEntry[]): string {
  if (!trace.length) return 'FantasyPros weekly ECR trace unavailable from stored snapshots.';
  const weeks = Array.from(new Set(trace.map((entry) => entry.week).filter(Boolean)))
    .sort((a, b) => Number(a) - Number(b))
    .map((week) => `W${week}`)
    .join('/');
  const latestFetch = trace
    .map((entry) => entry.fetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null;
  const statusSet = Array.from(new Set(trace.map((entry) => entry.status).filter(Boolean)));
  const statusCopy = statusSet.length ? statusSet.join(', ') : 'unknown status';
  return `FantasyPros weekly ECR source trace: ${weeks || 'rolling weeks'} from stored endpoint snapshots (${statusCopy})${latestFetch ? `, latest fetch ${latestFetch}` : ''}.`;
}

function getWaiverWeeklyEcrRows(
  player: Pick<TrendingPlayer, 'player_id' | 'name' | 'pos' | 'team'>,
  index: WaiverWeeklyEcrIndex
): FantasyProsConsensusSnapshotRow[] {
  const position = normalizeFantasyProsWaiverPosition(player.pos);
  if (!position || !index.rowsByKey.size) return [];
  const team = normalizeWaiverEcrTeam(player.team);
  const keys = new Set<string>([
    weeklyEcrKey(['sleeper', player.player_id]),
  ]);

  for (const nameKey of playerNameKeyVariants(player.name)) {
    keys.add(weeklyEcrKey(['name', position, team, nameKey]));
    if (!team) keys.add(weeklyEcrKey(['name', position, 'any', nameKey]));
  }
  if (position === 'DST' && team) keys.add(weeklyEcrKey(['team', position, team]));

  const rows = Array.from(keys).flatMap((key) => index.rowsByKey.get(key) || []);
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const rowPosition = normalizeFantasyProsWaiverPosition(row.position || position);
      if (rowPosition !== position) return false;
      const rowTeam = normalizeWaiverEcrTeam(row.team);
      if (team && rowTeam && team !== rowTeam) return false;
      const key = `${row.fantasyProsId}:${row.week ?? 'season'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.week || 0) - Number(b.week || 0));
}

function buildWaiverWeeklyEcrSignalFromRows(
  player: Pick<TrendingPlayer, 'player_id' | 'name' | 'pos' | 'team'>,
  rows: FantasyProsConsensusSnapshotRow[],
  index: WaiverWeeklyEcrIndex
): WaiverWeeklyEcrSignal | null {
  if (!rows.length) return null;

  const weeks = rows
    .map((row) => {
      const trace = getWaiverWeeklyEcrTraceEntry(row, index);
      return {
        week: Number(row.week || 0),
        rankEcr: row.rankEcr,
        positionRank: row.positionRank,
        bestRank: row.bestRank,
        worstRank: row.worstRank,
        averageRank: row.averageRank,
        rankStdDev: row.rankStdDev,
        lastUpdated: row.lastUpdated,
        sourceKey: trace.sourceKey,
        endpointKey: trace.endpointKey,
        fetchedAt: trace.fetchedAt,
        sourceStatus: trace.status,
      };
    })
    .filter((row) => Number.isFinite(row.week) && row.week > 0);
  if (!weeks.length) return null;

  const sourceTrace = rows
    .map((row) => getWaiverWeeklyEcrTraceEntry(row, index))
    .filter((entry) => entry.week && weeks.some((week) => week.week === entry.week));

  const rankedWeeks = weeks.filter((row) => Number.isFinite(row.rankEcr || NaN) && (row.rankEcr || 0) > 0);
  const positionRankedWeeks = weeks
    .map((row) => ({ ...row, positionRankNumber: getWaiverRankNumber(row.positionRank) }))
    .filter((row) => row.positionRankNumber);
  const bestByPositionRank = positionRankedWeeks.length
    ? positionRankedWeeks.reduce((best, row) =>
        (row.positionRankNumber || Infinity) < (best.positionRankNumber || Infinity) ? row : best
      )
    : null;
  const bestByEcr = rankedWeeks.length
    ? rankedWeeks.reduce((best, row) => (row.rankEcr || Infinity) < (best.rankEcr || Infinity) ? row : best)
    : null;
  const best = bestByPositionRank || bestByEcr;
  const averageRankEcr = rankedWeeks.length
    ? Math.round((rankedWeeks.reduce((total, row) => total + Number(row.rankEcr || 0), 0) / rankedWeeks.length) * 10) / 10
    : null;
  const firstPositionRank = positionRankedWeeks[0]?.positionRankNumber || null;
  const lastPositionRank = positionRankedWeeks[positionRankedWeeks.length - 1]?.positionRankNumber || null;
  const rankDelta = firstPositionRank && lastPositionRank ? firstPositionRank - lastPositionRank : null;
  const latestUpdated = weeks
    .map((row) => row.lastUpdated)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null;
  const lowStdDevWeeks = weeks.filter((row) => typeof row.rankStdDev === 'number' && row.rankStdDev <= 10).length;
  const confidence = Math.min(100, 42 + weeks.length * 12 + lowStdDevWeeks * 6 + (latestUpdated ? 8 : 0));
  const weekCopy = weeks
    .map((row) => `W${row.week} ${row.positionRank || (row.rankEcr ? `ECR ${row.rankEcr}` : 'ranked')}`)
    .join(', ');
  const movementCopy = rankDelta && rankDelta !== 0
    ? rankDelta > 0
      ? `, improving by ${rankDelta} spots`
      : `, fading by ${Math.abs(rankDelta)} spots`
    : '';

  return {
    playerId: player.player_id,
    fantasyProsId: rows[0]?.fantasyProsId || null,
    name: player.name,
    position: player.pos,
    team: player.team || null,
    source: 'FantasyPros',
    updatedAt: latestUpdated,
    weeks,
    bestWeek: best?.week || null,
    bestRankEcr: best?.rankEcr || null,
    bestPositionRank: best?.positionRank || null,
    averageRankEcr,
    rankDelta,
    confidence,
    note: `FantasyPros rolling ECR: ${weekCopy}${movementCopy}.`,
    sourceTrace,
    traceSummary: buildWaiverWeeklyEcrTraceSummary(sourceTrace),
  };
}

function buildWaiverWeeklyEcrSignal(
  player: Pick<TrendingPlayer, 'player_id' | 'name' | 'pos' | 'team'>,
  index: WaiverWeeklyEcrIndex
): WaiverWeeklyEcrSignal | null {
  return buildWaiverWeeklyEcrSignalFromRows(
    player,
    getWaiverWeeklyEcrRows(player, index),
    index
  );
}

const DRAFTSHARKS_SOS_SOURCE_KEY = 'draftsharks-sos-v1';

type WaiverMatchupWindowOptions = {
  currentWeek?: number | null;
  playoffWeeks?: number[] | null;
  playoffWeekStart?: number | null;
};

function isScheduleWindowSignal(
  signal?: WaiverWeeklyEcrSignal | null
): signal is WaiverWeeklyEcrSignal {
  return Boolean(
    signal &&
      signal.signalType === 'draftsharks-sos'
  );
}

function draftSharksEndpointKey(position: string | null | undefined, week: number | null | undefined): string {
  return `draftsharks-sos-${String(position || 'all').toLowerCase()}-week-${week || 'all'}`;
}

function draftSharksMatchupStars(percent: number): number {
  if (percent >= 25) return 5;
  if (percent >= 8) return 4;
  if (percent <= -25) return 1;
  if (percent <= -8) return 2;
  return 3;
}

function formatDraftSharksPercent(percent: number): string {
  return `${percent > 0 ? '+' : ''}${Math.round(percent * 10) / 10}%`;
}

function formatDraftSharksWeekCopy(row: Pick<DraftSharksWeeklySos, 'week' | 'opponent' | 'homeAway' | 'matchupPercent'>): string {
  const site = row.homeAway === 'home' ? 'vs.' : row.homeAway === 'away' ? 'at' : '';
  const opponent = row.opponent ? `${site} ${row.opponent}`.trim() : 'opponent TBD';
  return `W${row.week} ${opponent} ${formatDraftSharksPercent(row.matchupPercent)}`;
}

function getBestDraftSharksWeek(rows: DraftSharksWeeklySos[]): DraftSharksWeeklySos | null {
  const playableRows = rows.filter((row) => Number.isFinite(row.matchupPercent));
  if (!playableRows.length) return null;
  return playableRows.reduce((best, row) => {
    if (row.matchupPercent !== best.matchupPercent) return row.matchupPercent > best.matchupPercent ? row : best;
    return row.week < best.week ? row : best;
  });
}

function getDraftSharksSourceTraceEntry(
  profile: DraftSharksSosProfile,
  row: DraftSharksWeeklySos
): WaiverSourceTraceEntry {
  const endpointKey = draftSharksEndpointKey(profile.position, row.week);
  return {
    source: 'DraftSharks',
    sourceKey: DRAFTSHARKS_SOS_SOURCE_KEY,
    endpointKey,
    endpointLabel: `DraftSharks ${profile.position} SOS Week ${row.week}`,
    status: 'loaded',
    season: '',
    scoring: 'SOS',
    week: row.week,
    position: profile.position,
    rowCount: profile.weeklyMatchups.length,
    fetchedAt: profile.updatedAt || null,
    lastUpdated: profile.updatedAt || null,
    evidence: `${formatDraftSharksWeekCopy(row)} SOS; ${profile.weeklyMatchups.length} weekly rows.`,
  };
}

function buildDraftSharksTraceSummary(trace: WaiverSourceTraceEntry[]): string {
  if (!trace.length) return 'DraftSharks SOS trace unavailable from stored snapshots.';
  const weeks = Array.from(new Set(trace.map((entry) => entry.week).filter(Boolean)))
    .sort((a, b) => Number(a) - Number(b))
    .map((week) => `W${week}`)
    .join('/');
  const latestFetch = trace
    .map((entry) => entry.fetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null;
  return `DraftSharks SOS source trace: ${weeks || 'rolling weeks'} from stored percentage snapshots${latestFetch ? `, latest fetch ${latestFetch}` : ''}.`;
}

function buildWaiverDraftSharksSignal(
  player: Pick<TrendingPlayer, 'player_id' | 'name' | 'pos' | 'team'>,
  profile: DraftSharksSosProfile | null,
  windowOptions: WaiverMatchupWindowOptions & { positionRank?: string | null } = {}
): WaiverWeeklyEcrSignal | null {
  const rows = (profile?.weeklyMatchups || [])
    .filter((row) => Number.isFinite(row.week) && row.week > 0 && Number.isFinite(row.matchupPercent))
    .sort((a, b) => a.week - b.week);
  if (!profile || !rows.length) return null;

  const weeks = rows.map((row) => {
    const trace = getDraftSharksSourceTraceEntry(profile, row);
    return {
      week: row.week,
      rankEcr: null,
      positionRank: windowOptions.positionRank || null,
      bestRank: null,
      worstRank: null,
      averageRank: null,
      rankStdDev: null,
      lastUpdated: profile.updatedAt || null,
      sourceKey: trace.sourceKey,
      endpointKey: trace.endpointKey,
      fetchedAt: trace.fetchedAt,
      sourceStatus: trace.status,
      sourceType: 'draftsharks-sos',
      opponent: row.opponent,
      homeAway: row.homeAway === 'neutral' ? null : row.homeAway,
      opponentRank: null,
      matchupStars: draftSharksMatchupStars(row.matchupPercent),
      matchupTier: row.matchupTier,
      matchupText: `${formatDraftSharksPercent(row.matchupPercent)} DraftSharks SOS`,
      isBye: false,
    };
  });
  const sourceTrace = rows.map((row) => getDraftSharksSourceTraceEntry(profile, row));
  const matchupWindows = buildMatchupWindowSet(weeks, windowOptions);
  const best = getBestDraftSharksWeek(rows);
  const next3 = matchupWindows.next3;
  const nextWindowWeeks = new Set(next3.weeks);
  const weekCopy = rows
    .filter((row) => nextWindowWeeks.has(row.week))
    .map(formatDraftSharksWeekCopy)
    .join(', ') || rows.slice(0, 3).map(formatDraftSharksWeekCopy).join(', ');
  const confidence = Math.max(
    30,
    Math.min(
      94,
      58 + Math.min(rows.length, 6) * 3 + next3.easyWeeks * 6 - next3.hardWeeks * 8 + (profile.updatedAt ? 6 : 0)
    )
  );

  return {
    signalType: 'draftsharks-sos',
    playerId: player.player_id,
    fantasyProsId: null,
    name: player.name,
    position: profile.position || player.pos,
    team: player.team || profile.team || null,
    source: 'DraftSharks',
    updatedAt: profile.updatedAt || null,
    weeks,
    bestWeek: best?.week || null,
    bestRankEcr: null,
    bestPositionRank: windowOptions.positionRank || null,
    averageRankEcr: null,
    rankDelta: null,
    bestMatchupStars: best ? draftSharksMatchupStars(best.matchupPercent) : null,
    bestOpponentRank: null,
    matchupWindows,
    confidence,
    note: `DraftSharks SOS: ${weekCopy}. ${next3.summary}`,
    sourceTrace,
    traceSummary: buildDraftSharksTraceSummary(sourceTrace),
  };
}

function getWaiverWeeklyEcrTrustedRank(signal?: WaiverWeeklyEcrSignal | null): string | null {
  if (!signal) return null;
  if (signal.bestPositionRank) return signal.bestPositionRank;
  const position = normalizeSeasonLineupPosition(signal.position);
  return position && signal.bestRankEcr ? `${position}${Math.round(signal.bestRankEcr)}` : null;
}

function isWaiverSpecialTeamsPosition(position?: string | null): position is WaiverSpecialTeamsPosition {
  return position === 'K' || position === 'DEF';
}

function getScheduleAdjustedSpecialTeamsValue(input: {
  position: WaiverLineupPosition;
  value: number;
  signal?: WaiverWeeklyEcrSignal | null;
  leagueValueMode: LeagueValueMode;
}): number {
  if (!isWaiverSpecialTeamsPosition(input.position) || !isScheduleWindowSignal(input.signal)) {
    return input.value;
  }

  const outlook = getShortTermMatchupOutlook(input.signal.matchupWindows);
  const dynastyCap = input.leagueValueMode === 'dynasty' ? 0.7 : 1.35;
  const multiplier = Math.min(outlook.multiplier, dynastyCap);
  return Math.max(50, Math.round(input.value * multiplier));
}

function getWaiverWeeklyEcrSignalScore(
  signal?: WaiverWeeklyEcrSignal | null,
  options: { leagueValueMode?: LeagueValueMode } = {}
): number {
  if (!signal) return 0;
  const position = normalizeSeasonLineupPosition(signal.position);
  const waiverPosition = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position || '')
    ? position as WaiverLineupPosition
    : null;
  const rankLimit = waiverPosition ? WAIVER_AI_RANK_LIMITS[waiverPosition] : 72;
  const bestRank = getWaiverRankNumber(signal.bestPositionRank) || signal.bestRankEcr || null;
  const rankScore = bestRank
    ? Math.max(0, 1120 - (bestRank / rankLimit) * 840)
    : 0;
  const averageScore = signal.averageRankEcr
    ? Math.max(0, 420 - (signal.averageRankEcr / Math.max(rankLimit, 1)) * 280)
    : 0;
  const trendScore = signal.rankDelta
    ? Math.max(-180, Math.min(240, signal.rankDelta * 18))
    : 0;
  const preferredWindowWeeks = signal.matchupWindows?.next3?.weeks?.length
    ? new Set(signal.matchupWindows.next3.weeks)
    : null;
  const matchupWeeks = (signal.weeks || [])
    .filter((week) => !preferredWindowWeeks || preferredWindowWeeks.has(week.week))
    .filter((week) => !week.isBye);
  const bestStars = (
    signal.matchupWindows?.next3?.bestMatchupStars ??
    signal.bestMatchupStars ??
    matchupWeeks.reduce((best, week) => Math.max(best, Number(week.matchupStars || 0)), 0)
  ) || null;
  const easyWeeks = signal.matchupWindows?.next3?.easyWeeks ??
    matchupWeeks.filter((week) => week.matchupTier === 'easy' || Number(week.matchupStars || 0) >= 4).length;
  const hardWeeks = signal.matchupWindows?.next3?.hardWeeks ??
    matchupWeeks.filter((week) => week.matchupTier === 'hard' || (week.matchupStars !== null && week.matchupStars !== undefined && Number(week.matchupStars) <= 2)).length;
  const playoffScore = signal.matchupWindows?.playoffs?.score
    ? Math.max(0, Math.min(120, signal.matchupWindows.playoffs.score * 1.2))
    : 0;
  if (waiverPosition && isWaiverSpecialTeamsPosition(waiverPosition) && isScheduleWindowSignal(signal)) {
    const outlook = getShortTermMatchupOutlook(signal.matchupWindows);
    const shortTermMatchupScore = outlook.score * 8 + easyWeeks * 110 - hardWeeks * 170;
    const shortTermRankScore = rankScore * (outlook.isRoughStart ? 0.28 : 0.48);
    const specialTeamsPlayoffScore = options.leagueValueMode === 'redraft' ? playoffScore : Math.min(playoffScore, 35);
    const roughStartPenalty = outlook.isRoughStart ? 520 : 0;
    return Math.max(
      0,
      Math.round(
        shortTermRankScore +
        averageScore * 0.15 +
        shortTermMatchupScore +
        specialTeamsPlayoffScore +
        signal.confidence * 1.1 -
        roughStartPenalty
      )
    );
  }

  const matchupScore = bestStars
    ? bestStars * 115 + easyWeeks * 95 - hardWeeks * 45 + playoffScore
    : 0;
  return Math.round(rankScore + averageScore + trendScore + matchupScore + signal.confidence * 3.5);
}

function buildWaiverWeeklyEcrTargets(
  players: TrendingPlayer[],
  options: { leagueValueMode?: LeagueValueMode } = {}
): WaiverWeeklyEcrTarget[] {
  return players
    .map((player) => {
      const signal = player.weeklyEcr || null;
      if (!signal) return null;
      const score = getWaiverWeeklyEcrSignalScore(signal, options) + Math.min(Number(player.ktcValue || 0) / 12, 360);
      if (score <= 0) return null;
      return { player, signal, score };
    })
    .filter((target): target is WaiverWeeklyEcrTarget => Boolean(target))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

const SCHEDULE_EDGE_SOURCE_POSITION_ORDER: Array<'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'> = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const SCHEDULE_EDGE_SOURCE_TARGET_LIMITS: Record<typeof SCHEDULE_EDGE_SOURCE_POSITION_ORDER[number], number> = {
  QB: 80,
  RB: 140,
  WR: 180,
  TE: 90,
  K: 45,
  DEF: 45,
};

function buildScheduleEdgeTargetsFromDraftSharksContext(input: {
  draftSharksContext?: DraftSharksScheduleContext | null;
  players: Record<string, any>;
  ktcValues: KTCValues;
  ownerByPlayerId: Record<string, string>;
  rosterStatusByPlayerId?: Record<string, string>;
  leagueValueMode: LeagueValueMode;
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>;
  lastSeasonPositionRanks?: Record<string, LastSeasonPlayerRank>;
  rosterPositions?: string[];
  currentWeek?: number | null;
  playoffWeeks?: number[] | null;
  playoffWeekStart?: number | null;
}): WaiverWeeklyEcrTarget[] {
  if (input.draftSharksContext?.status !== 'loaded') return [];
  const targetsByPosition = new Map<string, WaiverWeeklyEcrTarget[]>();

  for (const [playerId, player] of Object.entries(input.players || {})) {
    if (!isCurrentSeasonLineupPlayer(player)) continue;
    const position = normalizeSeasonLineupPosition(player?.position);
    if (!position || !SCHEDULE_EDGE_SOURCE_POSITION_ORDER.includes(position as any)) continue;
    const waiverPosition = position as WaiverLineupPosition;
    if (
      (waiverPosition === 'K' || waiverPosition === 'DEF')
      && !leagueUsesWaiverSpecialTeamsPosition(input.rosterPositions, waiverPosition)
    ) {
      continue;
    }

    const team = normalizeWaiverEcrTeam(player?.team);
    const profile = getDraftSharksScheduleProfile(input.draftSharksContext, team, waiverPosition);
    if (!profile?.weeklyMatchups.length) continue;

    // Matchup calendar ranks are current-season ranks even when the league is dynasty.
    const scheduleValueMode: LeagueValueMode = 'redraft';
    const rank = getWaiverCandidateRank(
      playerId,
      waiverPosition,
      input.players,
      input.ktcValues,
      scheduleValueMode,
      input.valueProfilesById,
      input.lastSeasonPositionRanks
    );
    const value = getWaiverCandidateValue(
      playerId,
      waiverPosition,
      input.players,
      input.ktcValues,
      scheduleValueMode,
      input.valueProfilesById,
      input.lastSeasonPositionRanks
    );
    const sourceCount = getWaiverCandidateSourceCount(input.valueProfilesById?.[playerId]) + 1;
    const omissionReason = getWaiverCandidateOmissionReason({
      player,
      position: waiverPosition,
      value,
      rank,
      sourceCount,
      leagueValueMode: scheduleValueMode,
    });
    if (omissionReason) continue;

    const name = getPlayerName(playerId, input.players);
    const signal = buildWaiverDraftSharksSignal(
      {
        player_id: playerId,
        name,
        pos: waiverPosition,
        team,
      },
      profile,
      {
        currentWeek: input.currentWeek,
        playoffWeeks: input.playoffWeeks,
        playoffWeekStart: input.playoffWeekStart,
        positionRank: rank,
      }
    );
    if (!signal) continue;

    const adjustedValue = getScheduleAdjustedSpecialTeamsValue({
      position: waiverPosition,
      value: value || getRankBasedWaiverSeasonValue(rank),
      signal,
      leagueValueMode: scheduleValueMode,
    });
    const targetPlayer: TrendingPlayer = {
      player_id: playerId,
      name,
      playerDetails: getPlayerDetails(playerId, player, input.rosterStatusByPlayerId?.[playerId]),
      currentPositionRank: rank,
      pos: waiverPosition,
      team,
      owner: input.ownerByPlayerId[playerId] || 'Available',
      count: 0,
      ktcValue: adjustedValue || value || null,
      weeklyEcr: signal,
    };
    const score = getWaiverWeeklyEcrSignalScore(signal, { leagueValueMode: 'redraft' })
      + Math.min(Number(targetPlayer.ktcValue || 0) / 12, 360);
    if (score <= 0) continue;

    const current = targetsByPosition.get(waiverPosition) || [];
    current.push({ player: targetPlayer, signal, score });
    targetsByPosition.set(waiverPosition, current);
  }

  return SCHEDULE_EDGE_SOURCE_POSITION_ORDER.flatMap((position) =>
    (targetsByPosition.get(position) || [])
      .sort((a, b) => b.score - a.score)
      .slice(0, SCHEDULE_EDGE_SOURCE_TARGET_LIMITS[position])
  );
}

function getKtcPosition(data: KTCValues[string]): 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | null {
  const position = data?.position_rank?.match(/^[A-Z]+/)?.[0]
    || data?.flock_position_rank?.match(/^[A-Z]+/)?.[0]
    || data?.dynastynerds_position_rank?.match(/^[A-Z]+/)?.[0]
    || data?.fantasypros_position_rank?.match(/^[A-Z]+/)?.[0]
    || null;
  const normalized = normalizeSeasonLineupPosition(position);
  return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(normalized || '') ? normalized as 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' : null;
}

function buildValueProfileRankLookups(
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode = 'dynasty'
): Record<string, Partial<Record<'dynastyPositionRank' | 'seasonPositionRank' | 'contenderPositionRank' | 'rebuilderPositionRank' | 'balancedPositionRank', string>>> {
  type LensKey = 'dynastyPositionRank' | 'seasonPositionRank' | 'contenderPositionRank' | 'rebuilderPositionRank' | 'balancedPositionRank';
  const lensValues: Record<LensKey, Array<{ key: string; position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'; value: number }>> = {
    dynastyPositionRank: [],
    seasonPositionRank: [],
    contenderPositionRank: [],
    rebuilderPositionRank: [],
    balancedPositionRank: [],
  };
  const isRedraftProfile = leagueValueMode === 'redraft';

  for (const [key, data] of Object.entries(ktcValues)) {
    const position = getKtcPosition(data);
    if (!position) continue;
    const dynastyValue = isRedraftProfile ? null : data.dynasty_value ?? data.ktc_value ?? null;
    const seasonValue = isRedraftProfile
      ? data.redraft_value ?? data.fantasypros_season_value ?? null
      : data.redraft_value ?? data.true_value ?? data.ktc_value ?? null;
    const contenderValue = !isRedraftProfile && dynastyValue && seasonValue
      ? Math.round((seasonValue * 0.6) + (dynastyValue * 0.4))
      : isRedraftProfile ? null : seasonValue ?? dynastyValue;
    const rebuilderValue = !isRedraftProfile && dynastyValue && seasonValue
      ? Math.round((dynastyValue * 0.8) + (seasonValue * 0.2))
      : isRedraftProfile ? null : dynastyValue ?? seasonValue;
    const balancedValue = !isRedraftProfile && dynastyValue && seasonValue
      ? Math.round((dynastyValue * 0.55) + (seasonValue * 0.45))
      : isRedraftProfile ? null : dynastyValue ?? seasonValue;
    const values: Record<LensKey, number | null | undefined> = {
      dynastyPositionRank: dynastyValue,
      seasonPositionRank: seasonValue,
      contenderPositionRank: contenderValue,
      rebuilderPositionRank: rebuilderValue,
      balancedPositionRank: balancedValue,
    };

    for (const lens of Object.keys(values) as LensKey[]) {
      const value = values[lens];
      if (value && value > 0) lensValues[lens].push({ key, position, value });
    }
  }

  const ranks: Record<string, Partial<Record<LensKey, string>>> = {};
  for (const [lens, rows] of Object.entries(lensValues) as Array<[LensKey, typeof lensValues[LensKey]]>) {
    for (const position of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const) {
      rows
        .filter((row) => row.position === position)
        .sort((a, b) => b.value - a.value)
        .forEach((row, index) => {
          ranks[row.key] = {
            ...ranks[row.key],
            [lens]: `${position}${index + 1}`,
          };
        });
    }
  }

  return ranks;
}

function buildCurrentPositionRankMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues
): Record<string, string | null> {
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean))).map((playerId) => [
      playerId,
      getPlayerCurrentPositionRank(playerId, players, ktcValues),
    ])
  );
}

function buildPrimaryPositionRankMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues,
  valueProfilesById: Record<string, PlayerDetails['valueProfile']>,
  leagueValueMode: LeagueValueMode
): Record<string, string | null> {
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean))).map((playerId) => {
      const rank = getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
      return [playerId, rank || null];
    })
  );
}

function buildPlayerValueProfileMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode = 'dynasty'
): Record<string, PlayerDetails['valueProfile']> {
  const rankLookups = buildValueProfileRankLookups(ktcValues, leagueValueMode);
  return Object.fromEntries(
    Array.from(new Set(Array.from(playerIds).filter(Boolean)))
      .map((playerId) => [playerId, getPlayerValueProfile(playerId, players, ktcValues, rankLookups, leagueValueMode)])
      .filter((entry): entry is [string, NonNullable<PlayerDetails['valueProfile']>] => Boolean(entry[1]))
  );
}

function buildLazyPlayerValueProfileMap(
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode = 'dynasty'
): Record<string, PlayerDetails['valueProfile']> {
  const rankLookups = buildValueProfileRankLookups(ktcValues, leagueValueMode);
  const cache = Object.create(null) as Record<string, PlayerDetails['valueProfile']>;

  return new Proxy(cache, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      if (Object.prototype.hasOwnProperty.call(target, property)) return target[property];
      if (!players[property]) {
        target[property] = undefined;
        return undefined;
      }

      target[property] = getPlayerValueProfile(property, players, ktcValues, rankLookups, leagueValueMode);
      return target[property];
    },
  });
}

function buildSimilarTradeValueMap(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  ktcValues: KTCValues,
  leagueValueMode: LeagueValueMode,
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): Record<string, NonNullable<PlayerDetails['similarTradeValues']>> {
  const requestedPlayerIds = Array.from(new Set(Array.from(playerIds).filter(Boolean)));
  const candidateIds = Array.from(new Set([
    ...requestedPlayerIds,
    ...Object.keys(players).filter((playerId) => {
      const player = players[playerId];
      return isCurrentFantasySkillPlayer(player)
        && ['Active', 'Inactive', null, undefined].includes(player?.status);
    }),
  ]));
  const candidates = candidateIds
    .map((playerId) => {
      const player = players[playerId];
      const position = player?.position;
      const value = getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
      if (!['QB', 'RB', 'WR', 'TE'].includes(position) || value <= 0) return null;
      const rank = getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById);
      const rankPosition = rank?.match(/^[A-Z]+/)?.[0] || null;
      return {
        playerId,
        name: getPlayerName(playerId, players),
        position,
        team: player.team || null,
        rank: rankPosition === position ? rank : null,
        value,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const rankNumber = (rank?: string | null) => {
    const value = Number(String(rank || '').match(/\d+/)?.[0]);
    return Number.isFinite(value) ? value : null;
  };
  type SimilarTradeCandidate = typeof candidates[number];

  return Object.fromEntries(
    candidates
      .filter((player) => requestedPlayerIds.includes(player.playerId))
      .map((player) => {
    const currentRankNumber = rankNumber(player.rank);
    const peers = (['QB', 'RB', 'WR', 'TE'] as const)
      .map((position) => candidates
        .filter((candidate) => candidate.playerId !== player.playerId && candidate.position === position)
        .sort((a, b) => {
          if (position === player.position && currentRankNumber) {
            const aRankDiff = Math.abs((rankNumber(a.rank) || 999) - currentRankNumber);
            const bRankDiff = Math.abs((rankNumber(b.rank) || 999) - currentRankNumber);
            if (aRankDiff !== bRankDiff) return aRankDiff - bRankDiff;
          }

          return Math.abs(a.value - player.value) - Math.abs(b.value - player.value);
        })[0])
      .filter((peer): peer is SimilarTradeCandidate => Boolean(peer))
      .map((peer) => ({
        playerId: peer.playerId,
        name: peer.name,
        position: peer.position,
        team: peer.team,
        rank: peer.rank,
        value: peer.value,
        difference: peer.value - player.value,
        label: `Nearest ${peer.position}`,
      }));

    return [player.playerId, peers];
  }));
}

function buildLatestNewsByPlayerId(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  newsItems: PlayerNewsItem[]
): Record<string, NonNullable<PlayerDetails['latestNews']>> {
  const requestedIds = Array.from(new Set(Array.from(playerIds).filter(Boolean)));
  const entries: Array<[string, NonNullable<PlayerDetails['latestNews']>]> = [];

  for (const playerId of requestedIds) {
    const player = players[playerId];
    if (!player) continue;
    const fullName = getPlayerName(playerId, players);
    const matched = findLatestPlayerNewsForPlayer(fullName, newsItems);
    if (!matched) continue;
    entries.push([playerId, {
      title: matched.title,
      summary: matched.summary || null,
      source: matched.source || 'FantasyPros',
      url: matched.url || null,
      publishedAt: matched.publishedAt || null,
    }]);
  }

  return Object.fromEntries(entries);
}

function buildNewsValueMovementByPlayerId(
  playerIds: Iterable<string>,
  players: Record<string, any>,
  latestNewsByPlayerId: Record<string, NonNullable<PlayerDetails['latestNews']>>,
  currentValues: KTCValues,
  baselineValues: KTCValues,
): Record<string, NonNullable<PlayerDetails['newsValueMovement']>> {
  const entries: Array<[string, NonNullable<PlayerDetails['newsValueMovement']>]> = [];
  for (const playerId of Array.from(new Set(Array.from(playerIds).filter(Boolean)))) {
    const news = latestNewsByPlayerId[playerId];
    if (!news?.title) continue;
    const currentValue = getPlayerValue(playerId, players, currentValues);
    const previousValue = getPlayerValue(playerId, players, baselineValues);
    const valueDelta = currentValue && previousValue ? currentValue - previousValue : null;
    const valueDeltaPct = valueDelta !== null && previousValue
      ? Math.round((valueDelta / previousValue) * 1000) / 10
      : null;
    const note = valueDeltaPct === null
      ? 'News is attached, but value movement is not available from the stored baseline snapshot.'
      : Math.abs(valueDeltaPct) < 1
      ? 'News is attached, but the stored value baseline has not meaningfully moved.'
      : valueDeltaPct > 0
      ? `News is attached and stored value is up ${valueDeltaPct}% from the baseline snapshot.`
      : `News is attached and stored value is down ${Math.abs(valueDeltaPct)}% from the baseline snapshot.`;

    entries.push([playerId, {
      newsTitle: news.title,
      newsPublishedAt: news.publishedAt || null,
      currentValue: currentValue || null,
      previousValue: previousValue || null,
      valueDelta,
      valueDeltaPct,
      note,
    }]);
  }

  return Object.fromEntries(entries);
}

async function fetchTrendingPlayers(
  type: 'add' | 'drop',
  players: Record<string, any>,
  ktcValues: KTCValues,
  ownerByPlayerId: Record<string, string>,
  rosterStatusByPlayerId: Record<string, string> = {},
  leagueValueMode: LeagueValueMode = 'dynasty',
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): Promise<TrendingPlayer[]> {
  const trending = await fetchUserLoadJson<any[]>(
    `https://api.sleeper.app/v1/players/nfl/trending/${type}?lookback_hours=${SLEEPER_TRENDING_LOOKBACK_HOURS}&limit=${SLEEPER_TRENDING_LIMIT}`,
    "Sleeper trending player load"
  );

  if (!Array.isArray(trending)) return [];

  return trending.map((item: any) => {
    const playerId = String(item.player_id);
    const player = players[playerId];
    return {
      player_id: playerId,
      name: getPlayerName(playerId, players),
      playerDetails: getPlayerDetails(playerId, player, rosterStatusByPlayerId[playerId]),
      currentPositionRank: getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById),
      pos: player?.position || 'N/A',
      team: player?.team || null,
      owner: ownerByPlayerId[playerId] || null,
      count: item.count || 0,
      ktcValue: getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById) || null,
    };
  });
}

function buildPickPortfolios(
  managers: string[],
  draftPicks: Array<{
    manager: string;
    originalOwner?: string | null;
    draftYear?: string;
    currentKtcValue?: number | null;
    ktcValue?: number | null;
    draftSlot?: number;
    pick?: number;
  }>,
  futurePicks: Array<{
    manager: string;
    originalOwner: string;
    season: string;
    round: number;
    value: number;
  }> = []
): PickPortfolio[] {
  return managers.map((manager) => {
    const picks = draftPicks.filter((pick) => pick.manager === manager);
    const future = futurePicks.filter((pick) => pick.manager === manager);
    const picksForYear = (year: string) => picks.filter((pick) => String(pick.draftYear || '') === year);
    const futureForYear = (year: string) => future.filter((pick) => String(pick.season || '') === year);
    const valueForYear = (year: string) => picks
      .filter((pick) => String(pick.draftYear || '') === year)
      .reduce((sum, pick) => sum + (pick.currentKtcValue || pick.ktcValue || 0), 0);
    const futureValueForYear = (year: string) => future
      .filter((pick) => String(pick.season || '') === year)
      .reduce((sum, pick) => sum + pick.value, 0);
    const completedPickValue = picks.reduce((sum, pick) => sum + (pick.currentKtcValue || pick.ktcValue || 0), 0);
    const futurePickValue = future.reduce((sum, pick) => sum + pick.value, 0);
    const totalValue = completedPickValue + futurePickValue;
    const ownPicks = future.filter((pick) => pick.originalOwner === manager).length;
    const acquiredPicks = future.length - ownPicks;
    const projectedSlots = picks
      .filter((pick) => pick.draftYear && (pick.draftSlot || pick.pick))
      .map((pick) => `${pick.draftYear} #${pick.pick || pick.draftSlot}`)
      .slice(0, 6);

    return {
      manager,
      value2025: valueForYear('2025'),
      value2026: valueForYear('2026') + futureValueForYear('2026'),
      value2027: valueForYear('2027') + futureValueForYear('2027'),
      value2028: valueForYear('2028') + futureValueForYear('2028'),
      count2025: picksForYear('2025').length,
      count2026: picksForYear('2026').length + futureForYear('2026').length,
      count2027: picksForYear('2027').length + futureForYear('2027').length,
      count2028: picksForYear('2028').length + futureForYear('2028').length,
      totalValue,
      ownPicks,
      acquiredPicks,
      projectedSlots,
      futurePicks: future
        .map((pick) => ({
          id: `${pick.manager}-${pick.season}-${pick.round}-${pick.originalOwner}`,
          label: `${pick.season} Round ${pick.round}${pick.originalOwner !== pick.manager ? ` (${pick.originalOwner})` : ''}`,
          manager: pick.manager,
          originalOwner: pick.originalOwner,
          season: pick.season,
          round: pick.round,
          value: pick.value,
        }))
        .sort((a, b) => Number(a.season) - Number(b.season) || a.round - b.round),
    };
  }).sort((a, b) => b.totalValue - a.totalValue);
}

function buildFuturePickInventory({
  rosters,
  rosterMap,
  tradedPicks,
  ktcValues,
  draftRounds,
  seasons,
  draftSlotsBySeason,
  totalTeams,
}: {
  rosters: Array<{ roster_id: number }>;
  rosterMap: Record<number, string>;
  tradedPicks: Array<{ season: string; round: number; roster_id: number; owner_id: number }>;
  ktcValues: KTCValues;
  draftRounds: number;
  seasons: string[];
  draftSlotsBySeason?: Record<string, Record<number, number>>;
  totalTeams?: number;
}) {
  const pickOwners = new Map<string, { originalRosterId: number; ownerRosterId: number; season: string; round: number }>();

  for (const season of seasons) {
    for (const roster of rosters) {
      for (let round = 1; round <= draftRounds; round += 1) {
        const key = `${season}-${round}-${roster.roster_id}`;
        pickOwners.set(key, {
          originalRosterId: roster.roster_id,
          ownerRosterId: roster.roster_id,
          season,
          round,
        });
      }
    }
  }

  for (const pick of tradedPicks) {
    const season = String(pick.season);
    if (!seasons.includes(season) || pick.round > draftRounds) continue;
    const key = `${season}-${pick.round}-${pick.roster_id}`;
    pickOwners.set(key, {
      originalRosterId: Number(pick.roster_id),
      ownerRosterId: Number(pick.owner_id),
      season,
      round: Number(pick.round),
    });
  }

  return Array.from(pickOwners.values())
    .map((pick) => {
      const manager = rosterMap[pick.ownerRosterId];
      const originalOwner = rosterMap[pick.originalRosterId];
      if (!manager || !originalOwner) return null;

      return {
        manager,
        originalOwner,
        season: pick.season,
        round: pick.round,
        value: getPickValue(
          Number(pick.season),
          pick.round,
          ktcValues,
          draftSlotsBySeason?.[pick.season]?.[pick.originalRosterId],
          totalTeams
        ),
      };
    })
    .filter((pick): pick is { manager: string; originalOwner: string; season: string; round: number; value: number } => Boolean(pick));
}

export function buildWaiverIntelligence(
  trendingAdds: TrendingPlayer[],
  trendingDrops: TrendingPlayer[],
  players: Record<string, any>,
  ktcValues: KTCValues,
  ownerByPlayerId: Record<string, string>,
  rosterStatusByPlayerId: Record<string, string> = {},
  leagueValueMode: LeagueValueMode = 'dynasty',
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>,
  options: {
    rosterPositions?: string[];
    lastSeasonPositionRanks?: Record<string, LastSeasonPlayerRank>;
    fantasyProsSnapshotContext?: FantasyProsSnapshotContext | null;
    draftSharksScheduleContext?: DraftSharksScheduleContext | null;
    currentWeek?: number | null;
    playoffWeeks?: number[] | null;
    playoffWeekStart?: number | null;
    weeklyProjectionByPlayerId?: Record<string, WeeklyProjectionContext | null | undefined>;
  } = {}
): WaiverIntelligence {
  const availableAdds = trendingAdds.filter((player) => !player.owner);
  const rosteredAdds = trendingAdds.filter((player) => player.owner);
  const omittedCandidates: WaiverOmittedCandidate[] = [];
  const weeklyEcrIndex = buildWaiverWeeklyEcrIndex(options.fantasyProsSnapshotContext);
  const weeklyEcrSignalByPlayerId = new Map<string, WaiverWeeklyEcrSignal | null>();
  const getWeeklyEcrSignal = (player: Pick<TrendingPlayer, 'player_id' | 'name' | 'pos' | 'team'>) => {
    if (!player.player_id) return null;
    if (!weeklyEcrSignalByPlayerId.has(player.player_id)) {
      const position = normalizeSeasonLineupPosition(player.pos);
      const waiverPosition = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position || '')
        ? position as WaiverLineupPosition
        : null;
      const positionRank = waiverPosition
        ? getWaiverCandidateRank(
          player.player_id,
          waiverPosition,
          players,
          ktcValues,
          leagueValueMode,
          valueProfilesById,
          options.lastSeasonPositionRanks
        )
        : null;
      const draftSharksProfile = waiverPosition
        ? getDraftSharksScheduleProfile(options.draftSharksScheduleContext, player.team, waiverPosition)
        : null;
      weeklyEcrSignalByPlayerId.set(
        player.player_id,
        buildWaiverDraftSharksSignal(player, draftSharksProfile, {
          currentWeek: options.currentWeek,
          playoffWeeks: options.playoffWeeks,
          playoffWeekStart: options.playoffWeekStart,
          positionRank,
        }) ||
        buildWaiverWeeklyEcrSignal(player, weeklyEcrIndex)
      );
    }
    return weeklyEcrSignalByPlayerId.get(player.player_id) || null;
  };
  const withWeeklyEcr = (player: TrendingPlayer): TrendingPlayer => {
    const weeklyEcr = getWeeklyEcrSignal(player);
    const weeklyProjection = options.weeklyProjectionByPlayerId?.[player.player_id] || null;
    if (!weeklyEcr) return weeklyProjection ? { ...player, weeklyProjection } : player;
    const ecrRank = getWaiverWeeklyEcrTrustedRank(weeklyEcr);
    const ecrValue = getRankBasedWaiverSeasonValue(ecrRank);
    const position = normalizeSeasonLineupPosition(player.pos);
    const baseValue = player.ktcValue || ecrValue || 0;
    const adjustedValue = position && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position)
      ? getScheduleAdjustedSpecialTeamsValue({
        position: position as WaiverLineupPosition,
        value: baseValue,
        signal: weeklyEcr,
        leagueValueMode,
      })
      : baseValue;
    return {
      ...player,
      currentPositionRank: player.currentPositionRank || ecrRank,
      ktcValue: adjustedValue || null,
      weeklyEcr,
      weeklyProjection,
    };
  };
  const availablePlayerPool: TrendingPlayer[] = Object.entries(players)
    .map(([playerId, player]): TrendingPlayer | null => {
      if (!playerId || ownerByPlayerId[playerId]) return null;
      if (!isCurrentSeasonLineupPlayer(player)) return null;
      const position = normalizeSeasonLineupPosition(player?.position);
      if (!position || !['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position)) return null;
      const waiverPosition = position as WaiverLineupPosition;
      if (
        (waiverPosition === 'K' || waiverPosition === 'DEF')
        && !leagueUsesWaiverSpecialTeamsPosition(options.rosterPositions, waiverPosition)
      ) {
        return null;
      }
      const value = getWaiverCandidateValue(
        playerId,
        waiverPosition,
        players,
        ktcValues,
        leagueValueMode,
        valueProfilesById,
        options.lastSeasonPositionRanks
      );
      const rank = getWaiverCandidateRank(
        playerId,
        waiverPosition,
        players,
        ktcValues,
        leagueValueMode,
        valueProfilesById,
        options.lastSeasonPositionRanks
      );
      const candidateName = getPlayerName(playerId, players);
      const weeklyEcr = getWeeklyEcrSignal({
        player_id: playerId,
        name: candidateName,
        pos: waiverPosition,
        team: player?.team || null,
      });
      const weeklyProjection = options.weeklyProjectionByPlayerId?.[playerId] || null;
      const ecrRank = getWaiverWeeklyEcrTrustedRank(weeklyEcr);
      const ecrValue = getRankBasedWaiverSeasonValue(ecrRank);
      const projectionValue = weeklyProjection?.status === 'ready'
        ? Math.round(weeklyProjection.projectedFantasyPoints * 100)
        : 0;
      const trustedValue = getScheduleAdjustedSpecialTeamsValue({
        position: waiverPosition,
        value: leagueValueMode === 'dynasty' ? value || ecrValue || projectionValue : Math.max(value || 0, ecrValue || 0, projectionValue),
        signal: weeklyEcr,
        leagueValueMode,
      });
      const trustedRank = rank || ecrRank;
      if (trustedValue <= 0 && !trustedRank) return null;
      const sourceCount = getWaiverCandidateSourceCount(valueProfilesById?.[playerId]);
      const trustedSourceCount = sourceCount + (weeklyEcr ? 1 : 0);
      const omissionReason = getWaiverCandidateOmissionReason({
        player,
        position: waiverPosition,
        value: trustedValue,
        rank: trustedRank,
        sourceCount: trustedSourceCount,
        leagueValueMode,
      });
      if (omissionReason) {
        if (omittedCandidates.length < 40) {
          omittedCandidates.push(buildWaiverCandidateOmission({
            playerId,
            player,
            position: waiverPosition,
            value: trustedValue,
            rank: trustedRank,
            sourceCount: trustedSourceCount,
            reason: omissionReason,
          }));
        }
        return null;
      }
      return {
        player_id: playerId,
        name: candidateName,
        playerDetails: getPlayerDetails(playerId, player, rosterStatusByPlayerId[playerId]),
        currentPositionRank: trustedRank,
        pos: waiverPosition,
        team: player?.team || null,
        owner: null,
        count: 0,
        ktcValue: trustedValue || null,
        weeklyEcr,
        weeklyProjection,
      };
    })
    .filter((player): player is TrendingPlayer => Boolean(player))
    .sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0));
  const omittedCandidateIds = new Set(omittedCandidates.map((player) => player.player_id));
  const trustedAvailableAdds = availableAdds
    .filter((player) => !omittedCandidateIds.has(player.player_id))
    .map(withWeeklyEcr);
  const trustedSortedAvailableAdds = [...trustedAvailableAdds].sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0));
  const rankedAvailableCandidates = availablePlayerPool.length ? availablePlayerPool : trustedSortedAvailableAdds;
  const isRoughSpecialTeamsMatchupCandidate = (player: TrendingPlayer) => {
    const position = normalizeSeasonLineupPosition(player.pos);
    return Boolean(
      isWaiverSpecialTeamsPosition(position) &&
      isScheduleWindowSignal(player.weeklyEcr) &&
      getShortTermMatchupOutlook(player.weeklyEcr.matchupWindows).isRoughStart
    );
  };
  const rankedRecommendationCandidates = rankedAvailableCandidates.filter(
    (player) => !isRoughSpecialTeamsMatchupCandidate(player)
  );
  const topCandidatePool = rankedRecommendationCandidates.length
    ? rankedRecommendationCandidates
    : rankedAvailableCandidates;
  const weeklyEcrTargets = buildWaiverWeeklyEcrTargets(topCandidatePool, { leagueValueMode });
  const defensePairingTargets = buildWaiverWeeklyEcrTargets(
    topCandidatePool.filter((player) => player.pos === 'DEF'),
    { leagueValueMode: 'redraft' }
  ).slice(0, 8);
  const usedPlayerIds = new Set<string>();

  const takeBestUnique = (players: TrendingPlayer[]) => {
    const next = players.find((player) => !usedPlayerIds.has(player.player_id)) || null;
    if (next) usedPlayerIds.add(next.player_id);
    return next;
  };

  const highestKtcAvailable = takeBestUnique(topCandidatePool);
  const bestAvailableByPosition = {
    QB: takeBestUnique(topCandidatePool.filter((player) => player.pos === 'QB')),
    RB: takeBestUnique(topCandidatePool.filter((player) => player.pos === 'RB')),
    WR: takeBestUnique(topCandidatePool.filter((player) => player.pos === 'WR')),
    TE: takeBestUnique(topCandidatePool.filter((player) => player.pos === 'TE')),
    K: takeBestUnique(topCandidatePool.filter((player) => player.pos === 'K')),
    DEF: takeBestUnique(topCandidatePool.filter((player) => player.pos === 'DEF')),
  };
  const bestTaxiStashes = rankedAvailableCandidates
    .filter((player) => {
      const rookieYear = Number(player.playerDetails?.rookieYear || 0);
      return rookieYear === new Date().getFullYear() && !usedPlayerIds.has(player.player_id);
    })
    .slice(0, 2);

  return {
    rosteredTrendingAdds: rosteredAdds,
    availableTrendingAdds: trustedAvailableAdds,
    highestKtcAvailable,
    bestAvailableByPosition,
    bestTaxiStashes,
    recentlyDroppedValuable: [...trendingDrops]
      .filter((player) => !omittedCandidateIds.has(player.player_id))
      .map(withWeeklyEcr)
      .filter((player) => (player.ktcValue || 0) > 0)
      .sort((a, b) => (b.ktcValue || 0) - (a.ktcValue || 0))
      .slice(0, 8),
    weeklyEcrTargets,
    defensePairingTargets,
    omittedCandidates,
  };
}

function buildRecentTransactionPlayer(
  playerId: string | null | undefined,
  players: Record<string, any>,
  ktcValues: KTCValues,
  rosterStatusByPlayerId: Record<string, string> = {},
  leagueValueMode: LeagueValueMode = 'dynasty',
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): RecentTransactionPlayer | null {
  if (!playerId || !players[playerId]) return null;
  const player = players[playerId];
  return {
    player_id: playerId,
    name: getPlayerName(playerId, players),
    playerDetails: getPlayerDetails(playerId, player, rosterStatusByPlayerId[playerId]),
    currentPositionRank: getPlayerPositionRankForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById),
    pos: player?.position || 'N/A',
    team: player?.team || null,
    ktcValue: getPlayerValueForLeagueMode(playerId, players, ktcValues, leagueValueMode, valueProfilesById) || null,
  };
}

function getRecentTransactionRankNumber(positionRank: string | null | undefined): number | null {
  const match = String(positionRank || '').match(/\d+/);
  if (!match) return null;
  const rank = Number(match[0]);
  return Number.isFinite(rank) ? rank : null;
}

function getRecentTransactionCandidateValue(candidate: any): number {
  const value = Number(candidate?.value ?? candidate?.ktcValue ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function isBetterRecentTransactionDropCandidate(candidate: any, droppedPlayer: RecentTransactionPlayer | null): boolean {
  if (!candidate || !droppedPlayer) return false;

  const candidatePos = candidate.pos || candidate.playerDetails?.position || null;
  const droppedPos = droppedPlayer.pos || droppedPlayer.playerDetails?.position || null;
  const candidateRank = getRecentTransactionRankNumber(candidate.currentPositionRank);
  const droppedRank = getRecentTransactionRankNumber(droppedPlayer.currentPositionRank);
  const samePosition = Boolean(candidatePos && droppedPos && candidatePos === droppedPos);

  if (samePosition && candidateRank !== null && droppedRank !== null) {
    return candidateRank > droppedRank;
  }

  const candidateValue = getRecentTransactionCandidateValue(candidate);
  const droppedValue = Number(droppedPlayer.ktcValue || 0);
  return candidateValue > 0
    && droppedValue > 0
    && candidateValue + RECENT_TRANSACTION_BETTER_CUT_VALUE_GAP < droppedValue;
}

function buildRecentTransactions(
  transactions: any[],
  rosterUserMap: Record<string, string>,
  players: Record<string, any>,
  ktcValues: KTCValues,
  rosterStatusByPlayerId: Record<string, string> = {},
  ownerByPlayerId: Record<string, string> = {},
  managerIntelByName: Map<string, any> = new Map(),
  currentSeason: string,
  leagueValueMode: LeagueValueMode = 'dynasty',
  valueProfilesById?: Record<string, PlayerDetails['valueProfile']>
): RecentTransaction[] {
  const currentSeasonNumber = Number(currentSeason || new Date().getFullYear());

  return [...transactions]
    .filter((transaction) => transaction?.status === 'complete' && ['waiver', 'free_agent'].includes(transaction?.type))
    .sort((a, b) => Number(b?.status_updated || 0) - Number(a?.status_updated || 0))
    .slice(0, 16)
    .map((transaction) => {
      const manager = rosterUserMap[String(transaction.roster_ids?.[0] ?? transaction.roster_id ?? '')] || 'Unknown';
      const addedPlayerId = Object.keys(transaction.adds || {})[0] || null;
      const droppedPlayerId = Object.keys(transaction.drops || {})[0] || null;
      const addedPlayer = buildRecentTransactionPlayer(addedPlayerId, players, ktcValues, rosterStatusByPlayerId, leagueValueMode, valueProfilesById);
      const droppedPlayer = buildRecentTransactionPlayer(droppedPlayerId, players, ktcValues, rosterStatusByPlayerId, leagueValueMode, valueProfilesById);
      const bidAmount = Number(
        transaction.settings?.waiver_bid ??
        transaction.settings?.bid ??
        transaction.waiver_bid ??
        transaction.metadata?.waiver_bid ??
        0
      ) || null;
      const intel = managerIntelByName.get(manager);
      const droppedIsCurrentRookie = Number(droppedPlayer?.playerDetails?.rookieYear || 0) === currentSeasonNumber;
      const alternativeDrop = droppedPlayer && !droppedIsCurrentRookie
        ? (intel?.droppablePlayers || [])
            .filter((candidate: any) => candidate?.player_id && candidate.player_id !== droppedPlayerId && candidate.player_id !== addedPlayerId)
            .filter((candidate: any) => ownerByPlayerId[String(candidate.player_id)] === manager)
            .filter((candidate: any) => candidate.playerDetails?.rosterStatus !== 'Taxi')
            .filter((candidate: any) => {
              const candidateIsRookie = Number(candidate.playerDetails?.rookieYear || 0) === currentSeasonNumber;
              return candidateIsRookie === droppedIsCurrentRookie;
            })
            .filter((candidate: any) => isBetterRecentTransactionDropCandidate(candidate, droppedPlayer))
            .sort((a: any, b: any) => (a.value || 0) - (b.value || 0))[0] || null
        : null;

      let note = `${transaction.type === 'waiver' ? 'Winning claim' : 'Free-agent add'} logged.`;
      if (droppedPlayer && addedPlayer) {
        const addValue = addedPlayer.ktcValue || 0;
        const dropValue = droppedPlayer.ktcValue || 0;
        if (!droppedIsCurrentRookie && alternativeDrop && (alternativeDrop.value || 0) + 250 < dropValue) {
          note = `Reasonable add, but ${manager} probably should have cut ${alternativeDrop.name} instead of ${droppedPlayer.name}.`;
        } else if (!droppedIsCurrentRookie && dropValue > addValue + 500) {
          note = `${manager} cut more dynasty value than came back. This is a shaky churn move.`;
        } else if (droppedIsCurrentRookie) {
          note = 'Rookie-slot context can distort bench math, so no alternate-cut judgment here.';
        } else {
          note = 'This is a normal churn move unless the roster needed the dropped player type.';
        }
      } else if (addedPlayer && !droppedPlayer) {
        note = transaction.type === 'waiver'
          ? 'Clean claim with no obvious cut cost logged in the public feed.'
          : 'Clean add with no drop attached in the public feed.';
      }

      return {
        id: String(transaction.transaction_id || `${transaction.status_updated}-${manager}-${addedPlayerId || 'none'}`),
        date: new Date(Number(transaction.status_updated || Date.now())).toISOString(),
        season: currentSeason || null,
        manager,
        type: transaction.type === 'waiver' ? 'Waiver' : 'Free Agent',
        bidAmount,
        addedPlayer,
        droppedPlayer,
        alternativeDrop: alternativeDrop
          ? {
              player_id: alternativeDrop.player_id,
              name: alternativeDrop.name,
              playerDetails: alternativeDrop.playerDetails,
              currentPositionRank: alternativeDrop.currentPositionRank,
              pos: alternativeDrop.pos,
              team: alternativeDrop.playerDetails?.team || null,
              ktcValue: alternativeDrop.value || null,
            }
          : null,
        note,
        losingBidsAvailable: false,
      };
    });
}

async function buildLiveSleeperActivityPatch(
  leagueId: string,
  cachedReportData?: ReportData
): Promise<(Pick<ReportData, 'recentTransactions' | 'trendingAdds' | 'trendingDrops' | 'waiverIntelligence'> & Partial<Pick<ReportData, 'scheduleEdgeTargets'>>) | null> {
  const normalizedLeagueId = getValidSleeperEntityId(leagueId);
  if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
    return null;
  }

  try {
    const leagueInfo = await fetchUserLoadJson<any>(
      `https://api.sleeper.app/v1/league/${normalizedLeagueId}`,
      "league activity load"
    );
    if (!leagueInfo?.league_id) {
      markInvalidLeagueId(normalizedLeagueId);
      return null;
    }

    const [users, rosters] = await Promise.all([
      fetchUserLoadJson<any[]>(
        `https://api.sleeper.app/v1/league/${normalizedLeagueId}/users`,
        "league activity users load"
      ),
      fetchUserLoadJson<any[]>(
        `https://api.sleeper.app/v1/league/${normalizedLeagueId}/rosters`,
        "league activity rosters load"
      ),
    ]);
    const players = await fetchSleeperPlayersIndex();

    if (!leagueInfo || !Array.isArray(users) || !Array.isArray(rosters)) {
      markInvalidLeagueId(normalizedLeagueId);
      return null;
    }

    const allTransactions = await fetchLeagueLiveActivityTransactions(normalizedLeagueId, leagueInfo);
    const userMap = Object.fromEntries(users.map((user: any) => [user.user_id, user]));
    const rosterUserMap = Object.fromEntries(
      rosters.map((roster: any) => [
        roster.roster_id,
        normalizeManagerName(userMap[roster.owner_id]?.display_name),
      ])
    );
    const ownerByPlayerId = buildPlayerOwnerMap(rosters, rosterUserMap);
    const rosterStatusByPlayerId = buildPlayerRosterStatusMap(rosters);
    const leagueValueOptions = getLeagueValueBlendOptions(leagueInfo);
    const leagueValueProfileKey = getLeagueValueProfileKey(leagueInfo);
    const leagueValueMode = getLeagueValueMode(leagueInfo);
    const currentSeason = String(leagueInfo.season || new Date().getFullYear());
    const lastCompletedSeason = String(Number(currentSeason) - 1);
    const currentScheduleWeek = getSleeperCurrentWeek(leagueInfo);
    const playoffWeeks = getSleeperPlayoffWeeks(leagueInfo);
    const playoffWeekStart = playoffWeeks[0] || Number(leagueInfo.settings?.playoff_week_start || 15);
    const rosterPositions = Array.isArray(leagueInfo.roster_positions) ? leagueInfo.roster_positions : [];
    let ktcValues: KTCValues = {} as KTCValues;
    let fantasyProsSnapshotContext: FantasyProsSnapshotContext | null = null;
    let draftSharksScheduleContext: DraftSharksScheduleContext | null = null;

    try {
      const staticInputs = await loadReportStaticInputs({
        leagueId,
        leagueValueOptions,
        leagueValueProfileKey,
        currentSeason,
        lastCompletedSeason,
        forceRefresh: false,
      });
      ktcValues = staticInputs.ktcValues;
      draftSharksScheduleContext = staticInputs.draftSharksScheduleContext;
    } catch (error) {
      console.warn(`Failed to load value snapshots for live Sleeper activity ${leagueId}:`, error);
    }

    try {
      fantasyProsSnapshotContext = await loadFantasyProsSnapshotContext({
        season: currentSeason,
        scoring: 'PPR',
        currentWeek: currentScheduleWeek,
        weekWindow: 3,
      });
    } catch (error) {
      console.warn(`Failed to load FantasyPros rank snapshots for live Sleeper activity ${leagueId}:`, error);
    }

    const safePlayers = players || {};
    const valueProfilesById = buildLazyPlayerValueProfileMap(
      safePlayers,
      ktcValues,
      leagueValueMode
    );
    const [trendingAdds, trendingDrops] = await Promise.all([
      fetchTrendingPlayers('add', safePlayers, ktcValues, ownerByPlayerId, rosterStatusByPlayerId, leagueValueMode, valueProfilesById),
      fetchTrendingPlayers('drop', safePlayers, ktcValues, ownerByPlayerId, rosterStatusByPlayerId, leagueValueMode, valueProfilesById),
    ]);
    const managerIntelByName = new Map(
      (cachedReportData?.managerRosterIntelligence || [])
        .filter((row: any) => row?.manager)
        .map((row: any) => [row.manager, row])
    );
    const currentRecentTransactions = buildRecentTransactions(
      allTransactions,
      rosterUserMap,
      safePlayers,
      ktcValues,
      rosterStatusByPlayerId,
      ownerByPlayerId,
      managerIntelByName,
      currentSeason,
      leagueValueMode,
      valueProfilesById
    );
    const currentTransactionIds = new Set(currentRecentTransactions.map((transaction) => transaction.id));
    const recentTransactions = [
      ...currentRecentTransactions,
      ...(cachedReportData?.recentTransactions || []).filter((transaction) => !currentTransactionIds.has(transaction.id)),
    ]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 160);
    const waiverIntelligence = buildWaiverIntelligence(
      trendingAdds,
      trendingDrops,
      safePlayers,
      ktcValues,
      ownerByPlayerId,
      rosterStatusByPlayerId,
      leagueValueMode,
      valueProfilesById,
      {
        rosterPositions,
        fantasyProsSnapshotContext,
        draftSharksScheduleContext,
        currentWeek: currentScheduleWeek,
        playoffWeeks,
        playoffWeekStart,
      }
    );
    const scheduleEdgeTargets = buildScheduleEdgeTargetsFromDraftSharksContext({
      draftSharksContext: draftSharksScheduleContext,
      players: safePlayers,
      ktcValues,
      ownerByPlayerId,
      rosterStatusByPlayerId,
      leagueValueMode,
      valueProfilesById,
      rosterPositions,
      currentWeek: currentScheduleWeek,
      playoffWeeks,
      playoffWeekStart,
    });
    const livePatch: Pick<ReportData, 'recentTransactions' | 'trendingAdds' | 'trendingDrops' | 'waiverIntelligence'> & Partial<Pick<ReportData, 'scheduleEdgeTargets'>> = {
      recentTransactions,
      trendingAdds,
      trendingDrops,
      waiverIntelligence,
    };
    if (scheduleEdgeTargets.length) {
      livePatch.scheduleEdgeTargets = scheduleEdgeTargets;
    }
    return livePatch;
  } catch (error) {
    console.warn(`Failed to refresh live Sleeper activity for league ${normalizedLeagueId}:`, error);
    markInvalidLeagueId(normalizedLeagueId);
    return null;
  }
}

async function attachLiveSleeperActivity(payload: any, leagueId: string): Promise<any> {
  if (!payload?.reportData) return payload;

  const liveActivity = await buildLiveSleeperActivityPatch(leagueId, payload.reportData);
  if (!liveActivity) return payload;

  return {
    ...payload,
    reportData: {
      ...payload.reportData,
      ...liveActivity,
    },
  };
}

function ordinalRound(round: number): string {
  if (round === 1) return '1st';
  if (round === 2) return '2nd';
  if (round === 3) return '3rd';
  return `${round}th`;
}

function formatTradeProposalPickLabel(pick: any, rosterUserMap: Record<string, string>): string | null {
  const season = String(pick?.season || '').trim();
  const round = Number(pick?.round || 0);
  const ownerName = rosterUserMap[String(pick?.owner_id ?? '')] || null;
  const roundLabel = Number.isFinite(round) && round > 0 ? ordinalRound(round) : null;
  const baseLabel = [season, roundLabel].filter(Boolean).join(' ');
  if (!baseLabel && !ownerName) return null;
  if (!baseLabel) return ownerName;
  return ownerName ? `${baseLabel} (${ownerName})` : baseLabel;
}

function buildTradeProposalSignals(
  transactions: any[],
  rosterUserMap: Record<string, string>,
  players: Record<string, any>,
  limit: number | null = 24
): NonNullable<ReportData['tradeProposalSignals']> {
  const orderedTransactions = [...transactions]
    .filter((transaction) => transaction?.type === 'trade' && transaction?.status !== 'complete')
    .sort((a, b) => Number(b?.status_updated || b?.created || 0) - Number(a?.status_updated || a?.created || 0));
  const selectedTransactions = typeof limit === 'number' && Number.isFinite(limit)
    ? orderedTransactions.slice(0, limit)
    : orderedTransactions;

  return selectedTransactions.map((transaction) => {
    const rosterIds = Array.isArray(transaction.roster_ids)
      ? transaction.roster_ids
      : [transaction.roster_id].filter(Boolean);
    const managers = rosterIds
      .map((rosterId: unknown) => rosterUserMap[String(rosterId)])
      .filter((manager: string | undefined): manager is string => Boolean(manager));
    const playerIds = Array.from(new Set(Object.keys(transaction.adds || {}).filter(Boolean)));
    const playerNames = playerIds.map((playerId) => getPlayerName(playerId, players));
    const pickLabels = Array.isArray(transaction.draft_picks)
      ? transaction.draft_picks
          .map((pick: any) => formatTradeProposalPickLabel(pick, rosterUserMap))
          .filter((label: string | null): label is string => Boolean(label))
      : [];
    const signalItems = Array.from(new Set([...playerNames, ...pickLabels]));
    const status = String(transaction.status || 'unknown');

    return {
      id: String(transaction.transaction_id || `${transaction.created || transaction.status_updated}-${status}`),
      date: new Date(Number(transaction.status_updated || transaction.created || Date.now())).toISOString(),
      status,
      managers,
      playerIds,
      playerNames,
      pickLabels,
      note: `Sleeper returned a ${status} trade transaction${signalItems.length ? ` involving ${signalItems.slice(0, 3).join(', ')}` : ''}.`,
    };
  });
}

function getTransactionManagerNames(
  transaction: any,
  rosterUserMap: Record<string, string>,
  userMap?: Record<string, any>
): string[] {
  const rosterIds = Array.isArray(transaction?.roster_ids) ? transaction.roster_ids : [];
  const rosterManagers = rosterIds
    .map((rosterId: unknown) => rosterUserMap[String(rosterId)])
    .filter((manager: string | undefined): manager is string => Boolean(manager));

  if (rosterManagers.length > 0) {
    return Array.from(new Set(rosterManagers));
  }

  const consenterIds = Array.isArray(transaction?.consenter_ids) ? transaction.consenter_ids : [];
  const consenters = consenterIds
    .map((consenterId: unknown) => {
      const user = userMap?.[String(consenterId)];
      return normalizeManagerName(user?.display_name || user?.username || '');
    })
    .filter(Boolean);

  if (consenters.length > 0) {
    return Array.from(new Set(consenters));
  }

  const creator = transaction?.creator != null ? String(transaction.creator) : '';
  if (creator && userMap?.[creator]) {
    const creatorName = normalizeManagerName(userMap[creator]?.display_name || userMap[creator]?.username || '');
    if (creatorName) return [creatorName];
  }

  return [];
}

function getHiddenTransactionPlayerIds(transaction: any): string[] {
  const addIds = Object.keys(transaction?.adds || {});
  if (addIds.length > 0) return Array.from(new Set(addIds));

  const playerMapIds = transaction?.player_map && typeof transaction.player_map === 'object'
    ? Object.keys(transaction.player_map)
    : [];
  return Array.from(new Set(playerMapIds));
}

function getHiddenTransactionDropIds(transaction: any): string[] {
  return Array.from(new Set(Object.keys(transaction?.drops || {})));
}

function buildSleeperWaiverClaimSignals(
  transactions: any[],
  rosterUserMap: Record<string, string>,
  players: Record<string, any>,
  userMap?: Record<string, any>
): SleeperWaiverClaimSignal[] {
  return [...transactions]
    .filter((transaction) => transaction?.type === 'waiver' && transaction?.status !== 'complete')
    .sort((a, b) => Number(b?.status_updated || b?.created || 0) - Number(a?.status_updated || a?.created || 0))
    .map((transaction) => {
      const managers = getTransactionManagerNames(transaction, rosterUserMap, userMap);
      const playerIds = getHiddenTransactionPlayerIds(transaction);
      const dropPlayerIds = getHiddenTransactionDropIds(transaction);
      const playerNames = playerIds.map((playerId) => getPlayerName(playerId, players));
      const dropPlayerNames = dropPlayerIds.map((playerId) => getPlayerName(playerId, players));
      const bidAmount = Number(
        transaction.settings?.waiver_bid ??
        transaction.settings?.bid ??
        transaction.waiver_bid ??
        transaction.metadata?.waiver_bid ??
        0
      ) || null;
      const waiverBudget = Number(
        transaction.waiver_budget ??
        transaction.settings?.waiver_budget ??
        0
      ) || null;
      const signalItems = Array.from(new Set([...playerNames, ...dropPlayerNames]));
      const status = String(transaction.status || 'unknown');
      const bidText = bidAmount !== null ? bidAmount.toLocaleString() : null;

      return {
        id: String(transaction.transaction_id || `${transaction.created || transaction.status_updated}-${status}`),
        date: new Date(Number(transaction.status_updated || transaction.created || Date.now())).toISOString(),
        status,
        managers,
        playerIds,
        playerNames,
        dropPlayerIds,
        dropPlayerNames,
        bidAmount,
        waiverBudget,
        note: `Sleeper returned a ${status} waiver claim${signalItems.length ? ` involving ${signalItems.slice(0, 3).join(', ')}` : ''}${bidText ? ` with ${bidText} FAAB` : ''}.`,
      };
    });
}

function getScoringFamily(scoringSettings: Record<string, any> | undefined): 'std' | 'half_ppr' | 'ppr' | 'custom' {
  const rec = Number(scoringSettings?.rec ?? 0);
  if (rec === 1) return 'ppr';
  if (rec === 0.5) return 'half_ppr';
  if (rec === 0) return 'std';
  return 'custom';
}

function calculateFantasyPointsFromScoring(stats: Record<string, any>, scoringSettings: Record<string, any> | undefined): number {
  return Object.entries(scoringSettings || {}).reduce((sum, [key, scoringValue]) => {
    const statValue = Number(stats[key] ?? 0);
    const multiplier = Number(scoringValue ?? 0);
    if (!Number.isFinite(statValue) || !Number.isFinite(multiplier)) return sum;
    return sum + statValue * multiplier;
  }, 0);
}

function getSleeperSeasonWeekCount(season: string): number {
  return Number(season) >= 2021 ? 18 : 17;
}

function getSeasonLineupPlayerStartSeason(player: Record<string, any> | undefined, fallbackSeason: string): number {
  const rookieYear = Number(player?.metadata?.rookie_year ?? player?.rookieYear ?? 0);
  if (Number.isFinite(rookieYear) && rookieYear > 0) return rookieYear;

  const yearsExp = Number(player?.years_exp ?? player?.yearsExp ?? 0);
  if (Number.isFinite(yearsExp) && yearsExp > 0) {
    return Math.max(MIN_SLEEPER_SEASON, Number(fallbackSeason) - yearsExp + 1);
  }

  return Number(fallbackSeason);
}

function formatNumberValue(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(numeric) ? 0 : 1,
  });
}

function buildSleeperGameStatSummary(stats: Record<string, any>, position?: string | null): string {
  const normalizedPosition = normalizeSeasonLineupPosition(position);
  const format = (value: unknown): string | null => formatNumberValue(value);
  const parts: string[] = [];

  if (normalizedPosition === 'QB') {
    const passYds = format(stats.pass_yd);
    const passTd = format(stats.pass_td);
    const rushYds = format(stats.rush_yd);
    const rushTd = format(stats.rush_td);
    const passInt = format(stats.pass_int);
    if (passYds) parts.push(`${passYds} pass yds`);
    if (passTd) parts.push(`${passTd} pass TD`);
    if (rushYds) parts.push(`${rushYds} rush yds`);
    if (rushTd) parts.push(`${rushTd} rush TD`);
    if (passInt) parts.push(`${passInt} INT`);
  } else if (normalizedPosition === 'RB') {
    const rushAtt = format(stats.rush_att);
    const rushYds = format(stats.rush_yd);
    const rec = format(stats.rec);
    const recYds = format(stats.rec_yd);
    const rushTd = format(stats.rush_td);
    if (rushAtt) parts.push(`${rushAtt} rush att`);
    if (rushYds) parts.push(`${rushYds} rush yds`);
    if (rec) parts.push(`${rec} rec`);
    if (recYds) parts.push(`${recYds} rec yds`);
    if (rushTd) parts.push(`${rushTd} rush TD`);
  } else if (normalizedPosition === 'WR' || normalizedPosition === 'TE') {
    const rec = format(stats.rec);
    const recYds = format(stats.rec_yd);
    const recTd = format(stats.rec_td);
    const rushYds = format(stats.rush_yd);
    if (rec) parts.push(`${rec} rec`);
    if (recYds) parts.push(`${recYds} rec yds`);
    if (recTd) parts.push(`${recTd} rec TD`);
    if (rushYds) parts.push(`${rushYds} rush yds`);
  } else {
    const sacks = format(stats.sack);
    const interceptions = format(stats.int);
    const fumbles = format(stats.fum_rec);
    const touchdowns = format(stats.def_td);
    if (sacks) parts.push(`${sacks} sacks`);
    if (interceptions) parts.push(`${interceptions} INT`);
    if (fumbles) parts.push(`${fumbles} FR`);
    if (touchdowns) parts.push(`${touchdowns} TD`);
  }

  return parts.slice(0, 4).join(' · ') || 'No weekly stat detail returned';
}

type SleeperSeasonScoreRecord = {
  playerId: string;
  position: string;
  points: number;
  games: number | null;
  providedPositionRank: number | null;
};

async function buildSleeperSeasonRankMap(
  season: string,
  players: Record<string, any>,
  scoringSettings: Record<string, any> | undefined,
  positions: string[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
  options: { sourceMode?: 'live' | 'snapshot' } = {}
): Promise<Record<string, LastSeasonPlayerRank>> {
  const scoringFamily = getScoringFamily(scoringSettings);
  const sleeperSeasonStats = await fetchSleeperSeasonStats(season, null, options);
  const scoredPlayers: SleeperSeasonScoreRecord[] = Object.entries(players)
    .map(([playerId, player]) => {
      const position = normalizeSeasonLineupPosition(player?.position);
      if (!position || !positions.includes(position)) return null;

      const rawStats = sleeperSeasonStats[playerId]?.stats || sleeperSeasonStats[playerId];
      if (!rawStats || typeof rawStats !== 'object') return null;

      const providedPositionRank = Number(rawStats[`pos_rank_${scoringFamily}`] ?? rawStats.pos_rank_half_ppr ?? rawStats.pos_rank_ppr ?? rawStats.pos_rank_std);
      const providedPoints = Number(rawStats[`pts_${scoringFamily}`] ?? rawStats.pts_half_ppr ?? rawStats.pts_ppr ?? rawStats.pts_std);
      const points = scoringFamily === 'custom'
        ? calculateFantasyPointsFromScoring(rawStats, scoringSettings)
        : providedPoints;
      const games = Number(rawStats.gp ?? rawStats.gs ?? 0);

      if (!Number.isFinite(points)) return null;

      return {
        playerId,
        position,
        points,
        games: Number.isFinite(games) ? games : null,
        providedPositionRank: Number.isFinite(providedPositionRank) ? providedPositionRank : null,
      };
    })
    .filter((entry): entry is SleeperSeasonScoreRecord => Boolean(entry));

  const ranks: Record<string, LastSeasonPlayerRank> = {};
  for (const position of positions) {
    const positionPlayers = scoredPlayers
      .filter((player) => player.position === position)
      .sort((a, b) => b.points - a.points);

    positionPlayers.forEach((player, index) => {
      const rank = scoringFamily === 'custom'
        ? index + 1
        : player.providedPositionRank || index + 1;
      ranks[player.playerId] = {
        positionRank: `${position}${rank}`,
        fantasyPoints: Math.round(player.points * 10) / 10,
        games: player.games ?? null,
        pointsPerGame: player.games && player.games > 0
          ? Math.round((player.points / player.games) * 10) / 10
          : null,
        season,
      };
    });
  }

  return ranks;
}

type SleeperWeeklyGameLogEntry = {
  week: number;
  fantasyPoints: number | null;
  positionRank: string | null;
  statLine: string;
};

async function buildSleeperSeasonGameLog(
  playerId: string,
  position: string | null | undefined,
  scoringSettings: Record<string, any> | undefined,
  season: string,
): Promise<{
  weeklyGames: SleeperWeeklyGameLogEntry[];
  gamesPlayed: number;
  gamesMissed: number;
  fantasyPoints: number | null;
  pointsPerGame: number | null;
  positionRank: string | null;
}> {
  const scoringFamily = getScoringFamily(scoringSettings);
  const weekCount = getSleeperSeasonWeekCount(season);
  const weeklyStats = await Promise.all(
    Array.from({ length: weekCount }, (_, index) => index + 1).map(async (week) => [
      week,
      await fetchSleeperSeasonStats(season, week),
    ] as const)
  );

  const weeklyGames = weeklyStats
    .map(([week, stats]) => {
      const rawStats = stats[playerId]?.stats || stats[playerId];
      if (!rawStats || typeof rawStats !== 'object') return null;

      const fantasyPoints = scoringFamily === 'custom'
        ? calculateFantasyPointsFromScoring(rawStats, scoringSettings)
        : Number(rawStats[`pts_${scoringFamily}`] ?? rawStats.pts_half_ppr ?? rawStats.pts_ppr ?? rawStats.pts_std ?? 0);
      const positionRankNumber = Number(rawStats[`pos_rank_${scoringFamily}`] ?? rawStats.pos_rank_half_ppr ?? rawStats.pos_rank_ppr ?? rawStats.pos_rank_std);
      const hasPoints = Number.isFinite(fantasyPoints);
      const hasGame = Number(rawStats.gp ?? rawStats.gs ?? 0) > 0 || hasPoints;
      if (!hasGame) return null;

      return {
        week,
        fantasyPoints: Number.isFinite(fantasyPoints) ? Math.round(fantasyPoints * 10) / 10 : null,
        positionRank: Number.isFinite(positionRankNumber)
          ? `${normalizeSeasonLineupPosition(position) || ''}${positionRankNumber}`
          : null,
        statLine: buildSleeperGameStatSummary(rawStats, position),
      };
    })
    .filter((item): item is SleeperWeeklyGameLogEntry => Boolean(item));

  const fantasyPoints = weeklyGames.reduce((sum, entry) => sum + (entry.fantasyPoints || 0), 0);
  const gamesPlayed = weeklyGames.length;
  const gamesMissed = Math.max(0, weekCount - gamesPlayed);
  const pointsPerGame = gamesPlayed > 0 ? Math.round((fantasyPoints / gamesPlayed) * 10) / 10 : null;

  return {
    weeklyGames,
    gamesPlayed,
    gamesMissed,
    fantasyPoints: weeklyGames.length ? Math.round(fantasyPoints * 10) / 10 : null,
    pointsPerGame,
    positionRank: weeklyGames.find((entry) => entry.positionRank)?.positionRank || null,
  };
}

async function fetchLastSeasonPositionRanks(
  playerIds: string[],
  players: Record<string, any>,
  scoringSettings: Record<string, any> | undefined,
  season: string
): Promise<Record<string, LastSeasonPlayerRank>> {
  const rankPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const rankMap = await buildSleeperSeasonRankMap(season, players, scoringSettings, rankPositions, getUserLoadSnapshotOptions());
  return rankMap;
}

async function fetchDraftSlotsBySeason(
  leagueId: string,
  rosters: Array<{ roster_id: number; owner_id: string }>
): Promise<Record<string, Record<number, number>>> {
  const normalizedLeagueId = getValidSleeperEntityId(leagueId);
  if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
    return {};
  }

  let drafts: any[] = [];
  try {
    drafts = await fetchUserLoadJson<any[]>(
      `https://api.sleeper.app/v1/league/${normalizedLeagueId}/drafts`,
      "Sleeper draft load"
    );
  } catch (error) {
    console.warn(`Failed to fetch Sleeper drafts for league ${normalizedLeagueId}:`, error);
    markInvalidLeagueId(normalizedLeagueId);
    return {};
  }

  if (!Array.isArray(drafts)) {
    markInvalidLeagueId(normalizedLeagueId);
    return {};
  }

  const rosterByOwnerId = Object.fromEntries(
    rosters.map((roster) => [roster.owner_id, roster.roster_id])
  );
  const slotsBySeason: Record<string, Record<number, number>> = {};

  for (const draft of drafts) {
    if (!draft?.season || !draft?.draft_order) continue;

    const season = String(draft.season);
    if (!slotsBySeason[season]) slotsBySeason[season] = {};

    for (const [ownerId, draftSlot] of Object.entries(draft.draft_order)) {
      const rosterId = rosterByOwnerId[ownerId];
      if (rosterId && typeof draftSlot === 'number') {
        slotsBySeason[season][rosterId] = draftSlot;
      }
    }
  }

  return slotsBySeason;
}

async function fetchAdditionalDraftLeagueContexts(
  startLeagueId: string | null | undefined,
  alreadyLoadedLeagueIds: Set<string>,
  maxDepth = 4,
  currentManagers: {
    byUserId?: Record<string, string>;
    displayByUserId?: Record<string, string>;
    byRosterId?: Record<string, string>;
    displayByRosterId?: Record<string, string>;
  } = {},
): Promise<{
  contexts: Array<{
    leagueId: string;
    rosterMap: Record<string, string>;
    rosterDisplayMap: Record<string, string>;
    userIdToManagerMap: Record<string, string>;
    userIdToManagerDisplayMap: Record<string, string>;
  }>;
  draftSlotsBySeason: Record<string, Record<number, number>>;
}> {
  const contexts: Array<{
    leagueId: string;
    rosterMap: Record<string, string>;
    rosterDisplayMap: Record<string, string>;
    userIdToManagerMap: Record<string, string>;
    userIdToManagerDisplayMap: Record<string, string>;
  }> = [];
  let draftSlotsBySeason: Record<string, Record<number, number>> = {};
  let nextLeagueId = startLeagueId ? String(startLeagueId) : '';

  for (let depth = 0; depth < maxDepth && nextLeagueId; depth += 1) {
    const normalizedLeagueId = getValidSleeperEntityId(nextLeagueId);
    if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
      break;
    }

    const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`);
    if (!leagueInfo?.league_id) {
      markInvalidLeagueId(normalizedLeagueId);
      break;
    }

    const leagueId = String(leagueInfo.league_id);
    if (isInvalidLeagueIdCached(leagueId)) {
      break;
    }

    if (!alreadyLoadedLeagueIds.has(leagueId)) {
      const [users, rosters] = await Promise.all([
        fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/users`).then((value) => value || []),
        fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then((value) => value || []),
      ]);
      if (!Array.isArray(users) || !Array.isArray(rosters) || users.length === 0 || rosters.length === 0) {
        markInvalidLeagueId(leagueId);
        break;
      }
      const userById = Object.fromEntries(users.map((user: any) => [user.user_id, user]));
      const rosterMap = Object.fromEntries(
        rosters.map((roster: any) => [
          roster.roster_id,
          getCanonicalSleeperManagerName(
            userById[roster.owner_id],
            currentManagers.byUserId,
            currentManagers.byRosterId,
            roster.roster_id
          ),
        ])
      );
      const rosterDisplayMap = Object.fromEntries(
        rosters.map((roster: any) => [
          roster.roster_id,
          getCanonicalSleeperManagerDisplayName(
            userById[roster.owner_id],
            currentManagers.displayByUserId,
            currentManagers.displayByRosterId,
            roster.roster_id
          ),
        ])
      );
      const userIdToManagerMap = Object.fromEntries(
        users.map((user: any) => [
          user.user_id,
          getCanonicalSleeperManagerName(user, currentManagers.byUserId),
        ])
      );
      const userIdToManagerDisplayMap = Object.fromEntries(
        users.map((user: any) => [
          user.user_id,
          getCanonicalSleeperManagerDisplayName(
            user,
            currentManagers.displayByUserId
          ),
        ])
      );

      contexts.push({
        leagueId,
        rosterMap,
        rosterDisplayMap,
        userIdToManagerMap,
        userIdToManagerDisplayMap,
      });
      draftSlotsBySeason = {
        ...(await fetchDraftSlotsBySeason(leagueId, rosters)),
        ...draftSlotsBySeason,
      };
      alreadyLoadedLeagueIds.add(leagueId);
    }

    nextLeagueId = getPreviousSleeperLeagueId(leagueInfo);
  }

  return { contexts, draftSlotsBySeason };
}

async function buildLeagueRankingsPayload(leagueId: string, forceRefresh = false) {
  const normalizedLeagueId = getValidSleeperEntityId(leagueId);
  if (!normalizedLeagueId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
  }

  if (isInvalidLeagueIdCached(normalizedLeagueId)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
  }

  const prospectContext = await loadProspectContext();
  const rankingsCacheKey = getLeagueRankingsCacheKey(
    normalizedLeagueId,
    getProspectRankingsCacheSegment(prospectContext.diagnostics)
  );
  const cachedRankings = forceRefresh ? null : await readCachedLeagueReport(rankingsCacheKey);
  if (!forceRefresh && cachedRankings && typeof cachedRankings === 'object') {
    return cachedRankings as { rankings: Awaited<ReturnType<typeof buildRankingsBoard>> };
  }

  const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`);
  if (!leagueInfo?.league_id) {
    markInvalidLeagueId(normalizedLeagueId);
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
  }

  const [users, rosters, players] = await Promise.all([
    fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/users`),
    fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/rosters`),
    fetchSleeperPlayersIndex(),
  ]);
  if (!Array.isArray(users) || !Array.isArray(rosters)) {
    markInvalidLeagueId(normalizedLeagueId);
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league users or rosters data' });
  }

  const safeUsers = users;
  const safeRosters = rosters;
  const safePlayers = players && typeof players === 'object' ? players : {};
  const userMap = Object.fromEntries(safeUsers.map((user: any) => [user.user_id, user]));
  const rosterUserMap = Object.fromEntries(
    safeRosters.map((roster: any) => [
      roster.roster_id,
      normalizeManagerName(userMap[roster.owner_id]?.display_name),
    ])
  );
  const ownerByPlayerId = buildPlayerOwnerMap(safeRosters, rosterUserMap);
  const rosterStatusByPlayerId = buildPlayerRosterStatusMap(safeRosters);
  const leagueValueOptions = getLeagueValueBlendOptions(leagueInfo);
  const leagueValueProfileKey = getLeagueValueProfileKey(leagueInfo);
  const leagueValueProfileLabel = getValueSourceProfileLabel(leagueValueOptions);
  const now = new Date();
  const currentSeason = String(now.getFullYear());
  const lastCompletedSeason = String(Number(currentSeason) - 1);
  const rankingUsageSeason = now.getMonth() >= 8 ? currentSeason : lastCompletedSeason;
  const [ktcValues, nflversePlayerContext] = await Promise.all([
    loadBlendedKTCValues(leagueValueOptions, getUserLoadSnapshotOptions()),
    loadNflversePlayerContext({
      season: rankingUsageSeason,
      rosterRoomSeason: currentSeason,
      rosterRoomPreviousSeason: lastCompletedSeason,
      ...getUserLoadSnapshotOptions(),
    }),
  ]);
  let ktcValuesLastWeek = await getKtcSnapshotFromDaysAgo(7, leagueValueProfileKey);

  if (!ktcValuesLastWeek || Object.keys(ktcValuesLastWeek).length === 0) {
    ktcValuesLastWeek = loadLatestLocalWeeklyMomentumSnapshot(leagueValueProfileKey);
    if (Object.keys(ktcValuesLastWeek).length === 0) {
      ktcValuesLastWeek = await loadKTCValuesLastWeek();
    }
  }

  const rankings = await buildRankingsBoard({
    players: safePlayers,
    ktcValues,
    baselineKtcValues: ktcValuesLastWeek,
    ownerByPlayerId,
    rosterStatusByPlayerId,
    selectedProfileKey: leagueValueProfileKey,
    selectedProfileLabel: leagueValueProfileLabel,
    prospectLookup: buildProspectLookup(prospectContext.profiles),
    prospectProfiles: prospectContext.profiles,
    leagueTeamCount: Number(leagueInfo?.total_rosters || leagueInfo?.settings?.num_teams || safeRosters.length || 12),
    nflversePlayerContext,
    ...getUserLoadSnapshotOptions(),
  });
  const payload = { rankings };
  await writeCachedLeagueReport(rankingsCacheKey, leagueId, undefined, payload);
  return payload;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user
      ? { ...opts.ctx.user, isPrivilegedAdmin: hasAdminPermissionsForUser(opts.ctx.user) }
      : null),
    adminLogin: publicProcedure
      .input(z.object({ passphrase: z.string().min(1).max(256) }))
      .mutation(async ({ input, ctx }) => {
        if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Admin login requires JWT_SECRET to be configured in production.",
          });
        }

        if (!getAdminLoginPassword()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Admin login requires ADMIN_LOGIN_PASSWORD to be configured.",
          });
        }

        if (!isValidAdminLoginPassword(input.passphrase)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid admin passphrase.",
          });
        }

        const signedInAt = new Date();
        await upsertUser({
          openId: LOCAL_ADMIN_OPEN_ID,
          name: "Admin",
          email: null,
          loginMethod: "admin-passphrase",
          role: "admin",
          lastSignedIn: signedInAt,
        });

        const sessionToken = await sdk.createAdminSessionToken({
          name: "Admin",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return {
          success: true,
        } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  actionPlans: router({
    list: protectedProcedure
      .input(z.object({
        leagueId: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const plans = await listActionPlans({
          userKey: getActionPlanUserKey(ctx.user),
          leagueId: input?.leagueId || null,
          limit: input?.limit,
        });

        return { plans };
      }),
    listWaiverBidHistory: protectedProcedure
      .input(z.object({
        leagueId: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(150).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const bidHistory = await listWaiverBidHistory({
          userKey: getActionPlanUserKey(ctx.user),
          leagueId: input?.leagueId || null,
          limit: input?.limit,
        });

        return { bidHistory };
      }),
  }),

  aiPredictions: router({
    upsertMany: protectedProcedure
      .input(z.object({
        events: z.array(aiPredictionEventSchema).min(1).max(50),
      }))
      .mutation(async ({ input, ctx }) => {
        const userKey = getActionPlanUserKey(ctx.user);
        const results = await Promise.all(
          input.events.map(event => upsertAiPredictionEvent({ userKey, event }))
        );

        return {
          persisted: results.filter(Boolean).length,
          accepted: input.events.length,
        };
      }),
    list: protectedProcedure
      .input(z.object({
        leagueId: z.string().max(64).optional().nullable(),
        limit: z.number().int().min(1).max(200).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const events = await listAiPredictionEvents({
          userKey: getActionPlanUserKey(ctx.user),
          leagueId: input?.leagueId || null,
          limit: input?.limit || 100,
        });

        return { events };
      }),
    updateOutcome: protectedProcedure
      .input(z.object({
        eventId: z.string().min(1).max(128),
        outcome: aiPredictionOutcomeSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        const persisted = await updateAiPredictionOutcome({
          ...input,
          userKey: getActionPlanUserKey(ctx.user),
        });
        return { persisted };
      }),
  }),

  league: router({
    getUserLeagues: publicProcedure
      .input(z.object({ username: sleeperUsernameSchema }))
      .mutation(async ({ input, ctx }) => {
        assertRateLimit(ctx.req as any, {
          id: 'league.getUserLeagues',
          max: 20,
          windowMs: 1000 * 60 * 10,
          message: 'Too many league lookup attempts. Please wait a few minutes and try again.',
        });
        const username = input.username.trim();
        if (!username) throw new Error('Please enter a Sleeper username');
        const ipAddress = getClientIp(ctx.req as any);
        const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"] : null;

        try {
          const userUrl = `https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`;
          assertUserLoadAllowedLiveProviderUrl(userUrl, "Sleeper username lookup");
          const userResponse = await fetchUserLoadResponse(userUrl, "Sleeper username lookup");
          if (!userResponse.ok) {
            await insertLoginAttempt({
              eventType: "find_leagues",
              status: "error",
              username,
              ipAddress,
              userAgent,
              note: "Sleeper user not found",
            });
            throw new Error('Sleeper user not found');
          }

          const user = await userResponse.json();
          if (!user?.user_id) {
            await insertLoginAttempt({
              eventType: "find_leagues",
              status: "error",
              username,
              ipAddress,
              userAgent,
              note: "Sleeper response missing user_id",
            });
            throw new Error('Sleeper user not found');
          }

          const currentSeason = String(new Date().getFullYear());
          const seenLeagueIds = new Set<string>();
          const leagues = [];

          const leaguesUrl = `https://api.sleeper.app/v1/user/${user.user_id}/leagues/nfl/${currentSeason}`;
          assertUserLoadAllowedLiveProviderUrl(leaguesUrl, "Sleeper user league lookup");
          const leaguesResponse = await fetchUserLoadResponse(leaguesUrl, "Sleeper user league lookup");
          const seasonLeagues = leaguesResponse.ok ? await leaguesResponse.json() : [];

          if (Array.isArray(seasonLeagues)) {
            const leagueOptions = seasonLeagues.map((leagueInfo: any) => {
              const leagueId = String(leagueInfo?.league_id || '');
              if (!leagueId || seenLeagueIds.has(leagueId)) return null;
              seenLeagueIds.add(leagueId);

              return toSleeperLeagueOption(leagueInfo, currentSeason);
            });

            leagues.push(...leagueOptions.filter((league): league is SleeperLeagueOption => Boolean(league)));
          }

          await insertLoginAttempt({
            eventType: "find_leagues",
            status: "success",
            username,
            ipAddress,
            userAgent,
            note: `${leagues.length} current-season leagues found`,
          });

          const hasAdminPermissions = hasAdminPermissionIdentifier(
            String(user.user_id),
            user.username || username,
            user.display_name || null,
            username
          );

          return {
            user: {
              userId: String(user.user_id),
              username: user.username || username,
              displayName: user.display_name || user.username || username,
              avatarUrl: getSleeperAvatarUrl(user.avatar),
              hasAdminPermissions,
              isPrivilegedReportViewer: hasAdminPermissions,
            },
            leagues: leagues.sort((a, b) => Number(b.season) - Number(a.season) || a.name.localeCompare(b.name)),
          };
        } catch (error) {
          if (!(error instanceof Error && error.message === 'Sleeper user not found')) {
            await insertLoginAttempt({
              eventType: "find_leagues",
              status: "error",
              username,
              ipAddress,
              userAgent,
              note: error instanceof Error ? error.message : "Unknown error",
            });
          }
          throw error;
        }
      }),

    getLeaguePreview: publicProcedure
      .input(z.object({ leagueId: sleeperLeagueIdSchema }))
      .mutation(async ({ input, ctx }) => {
        assertReportAccess(ctx);
        assertRateLimit(ctx.req as any, {
          id: 'league.getLeaguePreview',
          max: 30,
          windowMs: 1000 * 60 * 10,
          scope: input.leagueId,
          message: 'Too many league lookups. Please wait a few minutes and try again.',
        });

        if (isInvalidLeagueIdCached(input.leagueId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
        }

        const normalizedLeagueId = getValidSleeperEntityId(input.leagueId);
        if (!normalizedLeagueId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
        }

        const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`);
        if (!leagueInfo?.league_id) {
          markInvalidLeagueId(normalizedLeagueId);
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
        }

        const users = await fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/users`).catch(() => null);
        const leagueOption = toSleeperLeagueOption(leagueInfo, String(leagueInfo.season || new Date().getFullYear()));
        if (!leagueOption) {
          markInvalidLeagueId(normalizedLeagueId);
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
        }
        const managerAnchors = buildManagerAnchorsFromSleeperUsers(users);

        return {
          ...leagueOption,
          managerAnchors,
        };
      }),

    reportCacheStatus: publicProcedure
      .input(z.object({ leagueId: sleeperLeagueIdSchema, viewerUserId: sleeperUserIdSchema.optional() }))
        .query(async ({ input, ctx }) => {
        assertReportAccess(ctx);
        assertRateLimit(ctx.req as any, {
          id: 'league.reportCacheStatus',
          max: 60,
          windowMs: 1000 * 60 * 10,
          scope: input.leagueId,
          message: 'Too many report cache status checks for this league. Please wait a few minutes and try again.',
        });

        const reportCacheKey = getLeagueReportCacheKey(input.leagueId, input.viewerUserId);
        return {
          report: await getLeagueReportCacheStatus(reportCacheKey, input.leagueId, input.viewerUserId),
        };
      }),

    getUserLeagueRanks: publicProcedure
      .input(z.object({
        username: sleeperUsernameSchema,
        userId: sleeperUserIdSchema,
        displayName: z.string().optional(),
        leagueIds: z.array(sleeperLeagueIdSchema).max(50),
      }))
      .mutation(async ({ input, ctx }) => {
        assertRateLimit(ctx.req as any, {
          id: 'league.getUserLeagueRanks',
          max: 15,
          windowMs: 1000 * 60 * 10,
          message: 'Too many league rank lookups. Please wait a few minutes and try again.',
        });
        const username = input.username.trim();
        const leagueIds = Array.from(new Set(input.leagueIds.map((leagueId) => leagueId.trim()).filter(Boolean)));
        if (!leagueIds.length) return { ranks: [] };

        const players = await fetchSleeperPlayersIndex();
        const leagueValueCache = new Map<string, Promise<KTCValues>>();
        const getLeagueValues = (leagueInfo: any): Promise<KTCValues> => {
          const options = getLeagueValueBlendOptions(leagueInfo);
          const key = getValueSourceProfileKey(options);
          if (!leagueValueCache.has(key)) {
            leagueValueCache.set(key, loadBlendedKTCValues(options, getUserLoadSnapshotOptions()));
          }
          return leagueValueCache.get(key)!;
        };

        const ranks = await Promise.all(leagueIds.map(async (leagueId) => {
          const normalizedLeagueId = getValidSleeperEntityId(leagueId);
          if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
            return { leagueId, standingsRank: null, powerRank: null };
          }

          const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`);
          if (!leagueInfo?.league_id) {
            markInvalidLeagueId(normalizedLeagueId);
            return { leagueId: normalizedLeagueId, standingsRank: null, powerRank: null };
          }

          const [rosters, users] = await Promise.all([
            fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/rosters`),
            fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/users`),
          ]);

          if (!Array.isArray(rosters) || !Array.isArray(users)) {
            markInvalidLeagueId(normalizedLeagueId);
            return { leagueId: normalizedLeagueId, standingsRank: null, powerRank: null };
          }

          const safeRosters = Array.isArray(rosters) ? rosters : [];
          const safeUsers = Array.isArray(users) ? users : [];
          const rosterUserMap = Object.fromEntries(
            safeRosters.map((roster: any) => [
              roster.roster_id,
              normalizeManagerName(
                safeUsers.find((user: any) => user.user_id === roster.owner_id)?.display_name
              ),
            ])
          );
          const viewerRoster = safeRosters.find((roster: any) => String(roster.owner_id) === String(input.userId));
          const viewerRosterId = Number(viewerRoster?.roster_id);
          const currentStandings = buildCurrentStandings(safeRosters, rosterUserMap);
          const leagueValueMode = getLeagueValueMode(leagueInfo);
          const ktcValues = await getLeagueValues(leagueInfo);
          const powerRankings = buildLeagueRosterValueRankings(safeRosters, players, ktcValues, leagueValueMode);
          const rosterPlayers = viewerRoster
            ? buildUserRosterPortfolioPlayers(viewerRoster, players, ktcValues, leagueValueMode)
            : [];
          const fallbackManagerName = normalizeManagerName(input.displayName || username);
          const standingsRank = currentStandings.find((row) => row.rosterId === viewerRosterId)?.rank
            ?? currentStandings.find((row) => row.manager === fallbackManagerName)?.rank
            ?? null;
          const powerRank = powerRankings.find((row) => row.rosterId === viewerRosterId)?.rank ?? null;
          const managerAnchors = buildManagerAnchorsFromSleeperUsers(safeUsers);

          return { leagueId, standingsRank, powerRank, rosterPlayers, managerAnchors };
        }));

        return { ranks };
      }),

    importSleeperTradeCenter: publicProcedure
      .input(z.object({
        leagueId: sleeperLeagueIdSchema,
        authToken: sleeperAuthTokenSchema,
        sharedBy: z.string().trim().max(128).optional().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        assertRateLimit(ctx.req as any, {
          id: 'league.importSleeperTradeCenter',
          max: 12,
          windowMs: 1000 * 60 * 10,
          scope: input.leagueId,
          message: 'Too many hidden trade center imports. Please wait a few minutes and try again.',
        });

        const normalizedLeagueId = getValidSleeperEntityId(input.leagueId);
        if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid league ID',
          });
        }

        const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`);
        if (!leagueInfo?.league_id) {
          markInvalidLeagueId(normalizedLeagueId);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid league ID',
          });
        }

        const hiddenImport = await loadSleeperHiddenTradeCenterImport({
          leagueId: normalizedLeagueId,
          authToken: input.authToken.trim(),
        });
        const sleeperHiddenLeagueSnapshot = buildSleeperHiddenLeagueSnapshotMetadata({
          sharedBy: input.sharedBy ?? null,
          sharedAt: Date.now(),
          transactionCount: hiddenImport.transactionCount,
          tradeCount: hiddenImport.tradeCount,
          waiverCount: hiddenImport.waiverCount,
        });
        await upsertSleeperHiddenLeagueSnapshot({
          leagueId: leagueInfo.league_id,
          sharedBy: sleeperHiddenLeagueSnapshot.sharedBy,
          sharedAt: sleeperHiddenLeagueSnapshot.sharedAt,
          snapshot: {
            tradeProposalSignals: hiddenImport.tradeProposalSignals,
            waiverSignals: hiddenImport.waiverSignals,
            transactionCount: hiddenImport.transactionCount,
            tradeCount: hiddenImport.tradeCount,
            waiverCount: hiddenImport.waiverCount,
          },
        });

        return {
          sleeperHiddenLeagueSnapshot,
          tradeProposalSignals: hiddenImport.tradeProposalSignals,
          waiverSignals: hiddenImport.waiverSignals,
          transactionCount: hiddenImport.transactionCount,
          tradeCount: hiddenImport.tradeCount,
          waiverCount: hiddenImport.waiverCount,
          leagueId: leagueInfo.league_id,
        } as const;
      }),

    rankings: publicProcedure
      .input(z.object({ leagueId: sleeperLeagueIdSchema, forceRefresh: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        assertReportAccess(ctx);
        assertRateLimit(ctx.req as any, {
          id: 'league.rankings',
          max: 45,
          windowMs: 1000 * 60 * 10,
          scope: input.leagueId,
          message: 'Too many ranking requests for this league. Please wait a few minutes and try again.',
        });
        const forceRefresh = Boolean(input.forceRefresh && canForceRefreshLeagueCache(ctx.req as any));
        return buildLeagueRankingsPayload(input.leagueId, forceRefresh);
      }),

    rankingsMeta: publicProcedure
      .input(z.object({ leagueId: sleeperLeagueIdSchema, forceRefresh: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        assertReportAccess(ctx);
        assertRateLimit(ctx.req as any, {
          id: 'league.rankingsMeta',
          max: 60,
          windowMs: 1000 * 60 * 10,
          scope: input.leagueId,
          message: 'Too many ranking metadata requests for this league. Please wait a few minutes and try again.',
        });
        const forceRefresh = Boolean(input.forceRefresh && canForceRefreshLeagueCache(ctx.req as any));
        const payload = await buildLeagueRankingsPayload(input.leagueId, forceRefresh);
        return {
          rankings: buildRankingsMetadata(payload.rankings),
        };
      }),

    rankingProfile: publicProcedure
      .input(z.object({
        leagueId: sleeperLeagueIdSchema,
        profileKey: z.string().trim().min(1).max(80),
        forceRefresh: z.boolean().optional(),
      }))
      .query(async ({ input, ctx }) => {
        assertReportAccess(ctx);
        assertRateLimit(ctx.req as any, {
          id: 'league.rankingProfile',
          max: 90,
          windowMs: 1000 * 60 * 10,
          scope: `${input.leagueId}:${input.profileKey}`,
          message: 'Too many ranking profile requests for this league. Please wait a few minutes and try again.',
        });
        const forceRefresh = Boolean(input.forceRefresh && canForceRefreshLeagueCache(ctx.req as any));
        const payload = await buildLeagueRankingsPayload(input.leagueId, forceRefresh);
        return buildRankingProfileDetail(payload.rankings, input.profileKey.trim());
      }),

    rankingDraftBuzz: publicProcedure
      .input(z.object({ leagueId: sleeperLeagueIdSchema, forceRefresh: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        assertReportAccess(ctx);
        assertRateLimit(ctx.req as any, {
          id: 'league.rankingDraftBuzz',
          max: 45,
          windowMs: 1000 * 60 * 10,
          scope: input.leagueId,
          message: 'Too many prospect archive requests for this league. Please wait a few minutes and try again.',
        });
        const forceRefresh = Boolean(input.forceRefresh && canForceRefreshLeagueCache(ctx.req as any));
        const payload = await buildLeagueRankingsPayload(input.leagueId, forceRefresh);
        return buildRankingDraftBuzzDetail(payload.rankings);
      }),

    analyze: publicProcedure
      .input(z.object({
        leagueId: sleeperLeagueIdSchema,
        viewerUserId: sleeperUserIdSchema.optional(),
        forceRefresh: z.boolean().optional(),
        liveRefresh: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        assertReportAccess(ctx);
        const ipAddress = getClientIp(ctx.req as any);
        const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"] : null;
        assertRateLimit(ctx.req as any, {
          id: 'league.analyze.view',
          max: 18,
          windowMs: 1000 * 60 * 10,
          scope: input.leagueId,
          message: 'Too many report requests for this league. Please wait a few minutes and try again.',
        });
        const reportCacheKey = getLeagueReportCacheKey(input.leagueId, input.viewerUserId);
        const markAnalyzeStep = createLeagueAnalyzeTimer(input.leagueId);
        const forceRefresh = Boolean(input.forceRefresh && canForceRefreshLeagueCache(ctx.req as any));
        const liveRefresh = Boolean(input.liveRefresh);
        const bypassReportCache = shouldBypassLeagueReportCache({ forceRefresh, liveRefresh });
        const normalizedLeagueId = getValidSleeperEntityId(input.leagueId);
        if (isInvalidLeagueIdCached(input.leagueId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
        }
        if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league ID' });
        }
        try {
          const cachedReport = await readCachedLeagueReport(reportCacheKey);
          markAnalyzeStep('cache lookup');
          if (!bypassReportCache && cachedReport && typeof cachedReport === 'object') {
            const cachedReportWithProjectionPolicy = stripWeeklyProjectionContextFromPayload(cachedReport);
            const cachedReportWithHiddenData = await attachStoredSleeperHiddenLeagueSnapshot(cachedReportWithProjectionPolicy, input.leagueId);
            const cachedReportWithLiveActivity = await attachLiveSleeperActivity(cachedReportWithHiddenData, input.leagueId);
            await insertLoginAttempt({
              eventType: "analyze_league",
              status: "success",
              leagueId: input.leagueId,
              ipAddress,
              userAgent,
              note: liveRefresh
                ? "Served cached league report with requested live Sleeper activity"
                : "Served cached league report with live Sleeper activity",
            });
            return {
              ...(cloneReportWithViewerManager(cachedReportWithLiveActivity, input.viewerUserId) as any),
              reportCacheStatus: 'hit' as const,
            };
          }

          assertRateLimit(ctx.req as any, {
            id: 'league.analyze.generate.ip',
            max: 6,
            windowMs: 1000 * 60 * 60,
            message: 'Too many fresh report generations. Please wait before running another uncached analysis.',
          });
          assertRateLimit(ctx.req as any, {
            id: 'league.analyze.generate.league',
            max: 3,
            windowMs: 1000 * 60 * 60,
            scope: input.leagueId,
            message: 'Fresh report generation is temporarily throttled for this league.',
          });

          let leagueInfo: any;
          try {
            leagueInfo = await fetchUserLoadJson<any>(
              `https://api.sleeper.app/v1/league/${normalizedLeagueId}`,
              "league analyze load"
            );
          } catch (error) {
            markInvalidLeagueId(normalizedLeagueId);
            await insertLoginAttempt({
              eventType: "analyze_league",
              status: "error",
              leagueId: normalizedLeagueId,
              ipAddress,
              userAgent,
              note: error instanceof Error ? error.message : 'Failed to load league info',
            });
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid league ID',
            });
          }
          markAnalyzeStep('league info');

          if (!leagueInfo || typeof leagueInfo !== 'object' || !leagueInfo.league_id) {
            await insertLoginAttempt({
              eventType: "analyze_league",
              status: "error",
              leagueId: normalizedLeagueId,
              ipAddress,
              userAgent,
              note: "Invalid league ID",
            });
            markInvalidLeagueId(normalizedLeagueId);
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid league ID',
            });
          }

          await insertLoginAttempt({
            eventType: "analyze_league",
            status: "success",
            leagueId: normalizedLeagueId,
            ipAddress,
            userAgent,
            note: leagueInfo.name || null,
          });

          const users = await fetchUserLoadJson<any[]>(
            `https://api.sleeper.app/v1/league/${normalizedLeagueId}/users`,
            "league users load"
          );
          if (!Array.isArray(users)) {
            markInvalidLeagueId(normalizedLeagueId);
            await insertLoginAttempt({
              eventType: "analyze_league",
              status: "error",
              leagueId: normalizedLeagueId,
              ipAddress,
              userAgent,
              note: "Invalid league users data",
            });
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league users data' });
          }
          markAnalyzeStep('users');

          const rosters = await fetchUserLoadJson<any[]>(
            `https://api.sleeper.app/v1/league/${normalizedLeagueId}/rosters`,
            "league rosters load"
          );
          if (!Array.isArray(rosters)) {
            markInvalidLeagueId(normalizedLeagueId);
            await insertLoginAttempt({
              eventType: "analyze_league",
              status: "error",
              leagueId: normalizedLeagueId,
              ipAddress,
              userAgent,
              note: "Invalid league rosters data",
            });
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid league rosters data' });
          }
          markAnalyzeStep('rosters');

          const userMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, u])
          );
          const rosterUserMap = Object.fromEntries(
            rosters.map((r: any) => [
              r.roster_id,
              getSleeperManagerName(userMap[r.owner_id]),
            ])
          );
          const rosterUserDisplayMap = Object.fromEntries(
            rosters.map((r: any) => [
              r.roster_id,
              getSleeperManagerDisplayName(userMap[r.owner_id]),
            ])
          );
          const userIdToManagerMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, getSleeperManagerName(u)])
          );
          const userIdToManagerDisplayMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, getSleeperManagerDisplayName(u)])
          );
          const managerDisplayNameByManager = Object.fromEntries(
            users.map((u: any) => [
              getSleeperManagerName(u),
              getSleeperManagerDisplayName(u),
            ])
          );
          const ownerByPlayerId = buildPlayerOwnerMap(rosters, rosterUserMap);
          const rosterStatusByPlayerId = buildPlayerRosterStatusMap(rosters);

          const allTransactions = await fetchLeagueTransactions(normalizedLeagueId);
          const trades = allTransactions.filter(
            (t: any) => t.type === 'trade' && t.status === 'complete'
          );
          markAnalyzeStep('transactions');
          let adminTradeProposalSignals: NonNullable<ReportData['adminTradeProposalSignals']> = [];

          const players = await fetchSleeperPlayersIndex();
          markAnalyzeStep('players');
          adminTradeProposalSignals = buildTradeProposalSignals(allTransactions, rosterUserMap, players, null);

          const leagueValueOptions = getLeagueValueBlendOptions(leagueInfo);
          const leagueValueProfileKey = getLeagueValueProfileKey(leagueInfo);
          const leagueValueProfileLabel = getValueSourceProfileLabel(leagueValueOptions);
          const leagueValueMode = getLeagueValueMode(leagueInfo);
          const prevLeagueId = getPreviousSleeperLeagueId(leagueInfo);
          const currentSeasonLabel = String(leagueInfo.season || new Date().getFullYear());
          const currentScheduleWeek = getSleeperCurrentWeek(leagueInfo);
          const playoffWeeks = getSleeperPlayoffWeeks(leagueInfo);
          const playoffWeekStart = playoffWeeks[0] || Number(leagueInfo.settings?.playoff_week_start || 15);
          const previousSeasonFallbackLabel = String(Number(currentSeasonLabel) - 1);
          const lastCompletedSeason = previousSeasonFallbackLabel;
          const staticInputs = await loadReportStaticInputs({
            leagueId: normalizedLeagueId,
            leagueValueOptions,
            leagueValueProfileKey,
            currentSeason: currentSeasonLabel,
            lastCompletedSeason,
            forceRefresh,
          });
          const {
            ktcValues,
            ktcValuesLastWeek,
            draftSharksScheduleContext,
            prospectContext,
            playerNews,
            newsSourceCounts,
          } = staticInputs;
          markAnalyzeStep(`static snapshot inputs ${staticInputs.cacheStatus}`);
          const playoffWeekStartBySeason: Record<string, number> = {
            [currentSeasonLabel]: playoffWeekStart,
          };
          let pastSeasonData = null;
          let pastRosterDisplayMap: Record<string, string> = {};
          let historicalTransactionContexts: HistoricalTransactionContext[] = [];
          let additionalDraftLeagueContexts: Array<{
            leagueId: string;
            rosterMap: Record<string, string>;
            rosterDisplayMap: Record<string, string>;
            userIdToManagerMap: Record<string, string>;
            userIdToManagerDisplayMap: Record<string, string>;
          }> = [];
          let draftSlotsBySeason = await fetchDraftSlotsBySeason(normalizedLeagueId, rosters);
          let tradedPicks: Array<{ season: string; round: number; roster_id: number; owner_id: number }> = [];
          try {
            const fetchedTradedPicks = await fetchUserLoadJson<any[]>(
              `https://api.sleeper.app/v1/league/${normalizedLeagueId}/traded_picks`,
              "league traded picks load"
            );
            tradedPicks = Array.isArray(fetchedTradedPicks) ? fetchedTradedPicks : [];
          } catch (error) {
            console.warn('Failed to fetch traded picks:', error);
          }

          if (prevLeagueId) {
            const normalizedPrevLeagueId = getValidSleeperEntityId(prevLeagueId);
            if (!normalizedPrevLeagueId || isInvalidLeagueIdCached(normalizedPrevLeagueId)) {
              console.warn('Skipping previous season data due invalid previous league ID:', prevLeagueId);
            } else {
            try {
              const pastLeagueInfo = await fetchUserLoadJson<any>(
                `https://api.sleeper.app/v1/league/${normalizedPrevLeagueId}`,
                "previous Sleeper league load"
              );
              if (!pastLeagueInfo?.league_id) {
                markInvalidLeagueId(normalizedPrevLeagueId);
                throw new Error('Invalid previous league ID');
              }
              const pastUsers = await fetchUserLoadJson<any[]>(
                `https://api.sleeper.app/v1/league/${normalizedPrevLeagueId}/users`,
                "previous Sleeper league users load"
              );
              const pastRosters = await fetchUserLoadJson<any[]>(
                `https://api.sleeper.app/v1/league/${normalizedPrevLeagueId}/rosters`,
                "previous Sleeper league rosters load"
              );
              if (!Array.isArray(pastUsers) || !Array.isArray(pastRosters)) {
                markInvalidLeagueId(normalizedPrevLeagueId);
                throw new Error('Invalid previous league users or rosters data');
              }
              const pastSeasonLabel = String(pastLeagueInfo.season || previousSeasonFallbackLabel);
              playoffWeekStartBySeason[pastSeasonLabel] = Number(pastLeagueInfo.settings?.playoff_week_start || 15);
              const pastUserMap = Object.fromEntries(
                pastUsers.map((u: any) => [u.user_id, u])
              );
              const pastRosterUserMap = Object.fromEntries(
                pastRosters.map((r: any) => [
                  r.roster_id,
                  getCanonicalSleeperManagerName(
                    pastUserMap[r.owner_id],
                    userIdToManagerMap,
                    rosterUserMap,
                    r.roster_id
                  ),
                ])
              );
              const pastRosterUserDisplayMap = Object.fromEntries(
                pastRosters.map((r: any) => [
                  r.roster_id,
                  getCanonicalSleeperManagerDisplayName(
                    pastUserMap[r.owner_id],
                    userIdToManagerDisplayMap,
                    rosterUserDisplayMap,
                    r.roster_id
                  ),
                ])
              );
              pastRosterDisplayMap = pastRosterUserDisplayMap;
              const pastTransactions = await fetchLeagueTransactions(normalizedPrevLeagueId);
              const pastTrades = pastTransactions.filter(
                (t: any) => t.type === "trade" && t.status === "complete"
              );

              const pastDraftSlotsBySeason = await fetchDraftSlotsBySeason(normalizedPrevLeagueId, pastRosters);
              draftSlotsBySeason = {
                ...pastDraftSlotsBySeason,
                ...draftSlotsBySeason,
              };

              pastSeasonData = {
                label: pastSeasonLabel,
                trades: pastTrades,
                rosterMap: pastRosterUserMap,
                rosters: pastRosters,
                finalTradedPicks: tradedPicks,
                draftSlotsBySeason,
                rosterPositions: Array.isArray(pastLeagueInfo.roster_positions) ? pastLeagueInfo.roster_positions : [],
                reserveSlots: Number(pastLeagueInfo.settings?.reserve_slots || 0),
                taxiSlots: Number(pastLeagueInfo.settings?.taxi_slots || 0),
              };
            } catch (e) {
              console.warn('Failed to fetch past season data:', e);
            }
            }
          }
          markAnalyzeStep('previous season');

          historicalTransactionContexts = await fetchHistoricalTransactionContexts(
            prevLeagueId,
            new Set([String(normalizedLeagueId)]),
            3,
            {
              byUserId: userIdToManagerMap,
              displayByUserId: userIdToManagerDisplayMap,
              byRosterId: rosterUserMap,
              displayByRosterId: rosterUserDisplayMap,
            }
          );
          markAnalyzeStep('historical transactions');

          if (leagueValueMode === 'dynasty' && prevLeagueId) {
            const normalizedPrevLeagueId = getValidSleeperEntityId(prevLeagueId);
            try {
              const draftHistory = await fetchAdditionalDraftLeagueContexts(
                normalizedPrevLeagueId || '',
                new Set([String(normalizedLeagueId), String(prevLeagueId)]),
                4,
                {
                  byUserId: userIdToManagerMap,
                  displayByUserId: userIdToManagerDisplayMap,
                  byRosterId: rosterUserMap,
                  displayByRosterId: rosterUserDisplayMap,
                },
              );
              additionalDraftLeagueContexts = draftHistory.contexts;
              draftSlotsBySeason = {
                ...draftHistory.draftSlotsBySeason,
                ...draftSlotsBySeason,
              };
            } catch (error) {
              console.warn('Failed to fetch extended dynasty draft history:', error);
            }
          }
          markAnalyzeStep('extended draft history');

          const viewerManager = input.viewerUserId ? userIdToManagerMap[input.viewerUserId] || null : null;
          const currentStandings = buildCurrentStandings(rosters, rosterUserMap);
          const currentWaiverType = Number(leagueInfo.settings?.waiver_type);
          const currentWaiverBudget = Number(leagueInfo.settings?.waiver_budget);
          const projectionScoringProfile = getSleeperProjectionScoringProfile(leagueInfo.scoring_settings || {});
          const rosteredProjectionPlayerIds = rosters.flatMap((roster: any) => [
            ...(roster.players || []),
            ...(roster.taxi || []),
            ...(roster.reserve || []),
          ]).map((playerId: unknown) => String(playerId || '')).filter(Boolean);
          const storedSleeperProjectionSnapshot = await loadStoredSleeperProjectionSnapshot({
            season: currentSeasonLabel,
            week: currentScheduleWeek,
            scoringProfile: projectionScoringProfile,
          });
          const {
            weeklyProjectionByPlayerId,
            diagnostics: weeklyProjectionDiagnostics,
          } = buildWeeklyProjectionContextMap({
            snapshot: storedSleeperProjectionSnapshot,
            season: currentSeasonLabel,
            week: currentScheduleWeek,
            scoringProfile: projectionScoringProfile,
            tightEndPremium: getLeagueTightEndPremium(leagueInfo),
            rosteredPlayerIds: rosteredProjectionPlayerIds,
          });

          const currentSeasonData = {
            label: currentSeasonLabel,
            trades,
            rosterMap: rosterUserMap,
            rosters,
            finalTradedPicks: tradedPicks,
            draftSlotsBySeason,
            rosterPositions: Array.isArray(leagueInfo.roster_positions) ? leagueInfo.roster_positions : [],
            reserveSlots: Number(leagueInfo.settings?.reserve_slots || 0),
            taxiSlots: Number(leagueInfo.settings?.taxi_slots || 0),
            scoringSettings: leagueInfo.scoring_settings || {},
            currentWeek: currentScheduleWeek,
            waiverType: Number.isFinite(currentWaiverType) ? currentWaiverType : null,
            waiverBudget: Number.isFinite(currentWaiverBudget) ? currentWaiverBudget : null,
            playoffWeekStart,
            playoffWeeks,
            valueBlendProfileKey: leagueValueProfileKey,
            valueBlendProfileLabel: leagueValueProfileLabel,
            weeklyProjectionByPlayerId,
          };
          let lastSeasonPositionRanks: Record<string, LastSeasonPlayerRank> = {};
          try {
            const rosteredPlayerIds = rosters.flatMap((roster: any) => roster.players || []);
            const usesSpecialTeams = (['K', 'DEF'] as const).some((position) =>
              leagueUsesWaiverSpecialTeamsPosition(currentSeasonData.rosterPositions, position)
            );
            const specialTeamsPlayerIds = usesSpecialTeams
              ? Object.entries(players as Record<string, any>)
                .filter(([, player]) => {
                  const position = normalizeSeasonLineupPosition(player?.position);
                  return (position === 'K' || position === 'DEF') && isCurrentSeasonLineupPlayer(player);
                })
                .map(([playerId]) => playerId)
              : [];
            lastSeasonPositionRanks = await fetchLastSeasonPositionRanks(
              [...rosteredPlayerIds, ...specialTeamsPlayerIds],
              players,
              leagueInfo.scoring_settings,
              lastCompletedSeason
            );
          } catch (error) {
            console.warn('Failed to fetch last season player stats:', error);
          }
          markAnalyzeStep('last season ranks');

          const allValueProfilesById = buildPlayerValueProfileMap(Object.keys(players), players, ktcValues, leagueValueMode);
          let currentWeekMatchups: any[] = [];
          try {
            const fetchedMatchups = await fetchSleeperJson<any[]>(
              `https://api.sleeper.app/v1/league/${normalizedLeagueId}/matchups/${currentScheduleWeek}`
            );
            currentWeekMatchups = Array.isArray(fetchedMatchups) ? fetchedMatchups : [];
          } catch (error) {
            console.warn('Failed to fetch current-week Sleeper matchups:', error);
          }
          markAnalyzeStep('schedule inputs');
          const staticSections = await loadReportStaticSections({
            leagueId: normalizedLeagueId,
            leagueValueProfileKey,
            currentSeason: currentSeasonLabel,
            lastCompletedSeason,
            players,
            draftSharksScheduleContext,
            prospectSourceDiagnostics: prospectContext.diagnostics,
            forceRefresh,
          });
          markAnalyzeStep(`static rendered sections ${staticSections.cacheStatus}`);
          const reportData = await generateReport(
            currentSeasonData,
            pastSeasonData,
            players,
            ktcValues,
            ktcValuesLastWeek,
            lastSeasonPositionRanks,
            { leagueValueMode }
          );
          markAnalyzeStep('generate report');
          const schedulePlanning = buildSchedulePlanningSummary({
            season: currentSeasonLabel,
            currentWeek: currentScheduleWeek,
            rosters,
            rosterMap: rosterUserMap,
            players,
            ktcValues,
            rosterPositions: currentSeasonData.rosterPositions,
            draftSharksContext: draftSharksScheduleContext,
            playerSchedules: staticSections.playerScheduleProfiles,
          });
          const matchupPreviews = buildMatchupPreviews({
            season: currentSeasonLabel,
            week: currentScheduleWeek,
            matchups: currentWeekMatchups,
            rosters,
            rosterMap: rosterUserMap,
            players,
            ktcValues,
            playerSchedules: staticSections.playerScheduleProfiles,
            weeklyProjectionByPlayerId,
          });
          markAnalyzeStep('schedule planning');

        // currentUserMap is the same as userIdToManagerMap, so we can reuse it
        const currentUserMap = userIdToManagerMap;
        let pastUserMap: Record<string, string> = {};
        let pastUserDisplayMap: Record<string, string> = {};
        const pastManagerDisplayNameByManager: Record<string, string> = {};
        if (pastSeasonData) {
          const previousLeagueId = getValidSleeperEntityId(prevLeagueId);
          if (previousLeagueId && !isInvalidLeagueIdCached(previousLeagueId)) {
            try {
              const pastUsers = await fetchUserLoadJson<any[]>(
                `https://api.sleeper.app/v1/league/${previousLeagueId}/users`,
                "previous Sleeper league users load"
              );
              if (!Array.isArray(pastUsers)) {
                markInvalidLeagueId(previousLeagueId);
                console.warn('Skipping past user mapping due invalid previous league users:', previousLeagueId);
              } else {
                pastUserMap = Object.fromEntries(
                  pastUsers.map((u: any) => [
                    u.user_id,
                    getCanonicalSleeperManagerName(u, userIdToManagerMap),
                  ])
                );
                pastUserDisplayMap = Object.fromEntries(
                  pastUsers.map((u: any) => [
                    u.user_id,
                    getCanonicalSleeperManagerDisplayName(
                      u,
                      userIdToManagerDisplayMap
                    ),
                  ])
                );
                Object.assign(
                  pastManagerDisplayNameByManager,
                  Object.fromEntries(
                    pastUsers.map((u: any) => [
                      getCanonicalSleeperManagerName(u, userIdToManagerMap),
                      getCanonicalSleeperManagerDisplayName(
                        u,
                        userIdToManagerDisplayMap
                      ),
                    ])
                  )
                );
              }
            } catch (error) {
              markInvalidLeagueId(previousLeagueId);
              console.warn('Skipping past user mapping due invalid previous league users:', previousLeagueId, error);
            }
          } else {
            console.warn('Skipping past user mapping due invalid previous league ID:', previousLeagueId || prevLeagueId);
          }
        }
        markAnalyzeStep('manager maps');

          // Fetch and analyze draft data
          let draftAnalysis: { draftPicks: any[]; draftStats: any[] } = { draftPicks: [], draftStats: [] };
          let trendingAdds: TrendingPlayer[] = [];
          let trendingDrops: TrendingPlayer[] = [];
          try {
            const draftPicks = await fetchDraftData(normalizedLeagueId, {
              currentRosterMap: rosterUserMap,
              currentRosterDisplayMap: rosterUserDisplayMap,
              currentRosters: rosters,
              currentUserMap,
              currentUserIdToManagerMap: userIdToManagerMap,
              currentUserIdToManagerDisplayMap: userIdToManagerDisplayMap,
              pastRosterMap: pastSeasonData?.rosterMap || {},
              pastRosterDisplayMap,
              pastRosters: pastSeasonData?.rosters || [],
              pastUserMap,
              pastUserIdToManagerMap: pastUserMap,
              pastUserIdToManagerDisplayMap: pastUserDisplayMap,
              prevLeagueId,
              draftSlotsBySeason,
              additionalDraftLeagueContexts,
            }, {
              leagueValueMode,
            });
            const dynastyMainDraftValueWindowsByDraftId = leagueValueMode === 'dynasty'
              ? await buildDynastyMainDraftValueWindowsByDraftId(draftPicks, ktcValues, leagueValueProfileKey)
              : undefined;
            const startupBaselineSnapshotKeyBySeason = Object.fromEntries(
              draftPicks
                .filter((pick: any) => pick?.season && pick?.draft_id && dynastyMainDraftValueWindowsByDraftId?.[pick.draft_id]?.baselineSnapshotKey)
                .map((pick: any) => [String(pick.season), dynastyMainDraftValueWindowsByDraftId?.[pick.draft_id]?.baselineSnapshotKey || null])
            );
            const draftDerivedAdpData = calculateADPFromPicks(draftPicks);
            const sleeperRookieAdpData = leagueValueMode === 'dynasty'
              ? await buildSleeperRookieAdpData(draftPicks, players, leagueValueOptions)
              : {};
            const sleeperStartupAdpData = leagueValueMode === 'dynasty'
              ? await buildSleeperStartupAdpData(draftPicks, players, {
                ...leagueValueOptions,
                baselineSnapshotKeyBySeason: startupBaselineSnapshotKeyBySeason,
                currentSeason: currentSeasonLabel,
              })
              : {};
            const adpData = {
              ...draftDerivedAdpData,
              ...sleeperRookieAdpData,
              ...sleeperStartupAdpData,
            };
            if (draftPicks.length > 0) {
              const rookieValues2025 = getRookieValueBaseline('2025');
              const rookieValuesByDraftYear = getRookieValueBaselines();
              const redraftValueWindowsBySeason = leagueValueMode === 'redraft'
                ? await buildRedraftValueWindowsBySeason(draftPicks, ktcValues, leagueValueProfileKey, playoffWeekStartBySeason)
                : undefined;
              draftAnalysis = await analyzeDraftPicks(
                draftPicks,
                players,
                rosterUserMap,
                ktcValues,
                adpData,
                ktcValuesLastWeek,
                rookieValues2025,
                ktcValues,
                rookieValuesByDraftYear,
                {
                  ...pastManagerDisplayNameByManager,
                  ...managerDisplayNameByManager,
                },
                {
                  ...leagueValueOptions,
                  leagueValueMode,
                  redraftValueWindowsBySeason,
                  dynastyMainDraftValueWindowsByDraftId,
                }
              );
            }
          } catch (e) {
            console.warn('Failed to fetch draft data:', e);
          }
          markAnalyzeStep('draft data');

          try {
            [trendingAdds, trendingDrops] = await Promise.all([
              fetchTrendingPlayers('add', players, ktcValues, ownerByPlayerId, rosterStatusByPlayerId, leagueValueMode, allValueProfilesById),
              fetchTrendingPlayers('drop', players, ktcValues, ownerByPlayerId, rosterStatusByPlayerId, leagueValueMode, allValueProfilesById),
            ]);
          } catch (e) {
            console.warn('Failed to fetch trending players:', e);
          }
          markAnalyzeStep('trending players');

          const managers = Object.values(rosterUserMap).filter(Boolean) as string[];
          const currentSeason = String(leagueInfo.season || new Date().getFullYear());
          const fantasyProsSnapshotContext = await loadFantasyProsSnapshotContext({
            season: currentSeason,
            scoring: 'PPR',
            currentWeek: currentScheduleWeek,
            weekWindow: 3,
          });
          const futurePickInventory = buildFuturePickInventory({
            rosters,
            rosterMap: rosterUserMap,
            tradedPicks,
            ktcValues,
            draftRounds: Number(leagueInfo.settings?.draft_rounds || 5),
            seasons: [
              currentSeason,
              String(Number(currentSeason) + 1),
              String(Number(currentSeason) + 2),
            ],
            draftSlotsBySeason,
            totalTeams: Number(leagueInfo.total_rosters || rosters.length || 0),
          });
          const pickPortfolios = filterCompletedFuturePickPortfolios(
            buildPickPortfolios(managers, draftAnalysis.draftPicks, futurePickInventory),
            draftAnalysis.draftPicks
          );
          const maxPickPortfolioValue = Math.max(...pickPortfolios.map((portfolio) => portfolio.totalValue), 1);
          const powerRankings = (reportData.powerRankings || [])
            .map((ranking) => {
              const portfolio = pickPortfolios.find((item) => item.manager === ranking.manager);
              const draftCapital = Math.round(((portfolio?.totalValue || 0) / maxPickPortfolioValue) * 100);
              const score = Math.round(
                ranking.starterStrength * 0.28 +
                ranking.rosterValue * 0.24 +
                ranking.positionalBalance * 0.16 +
                draftCapital * 0.08 +
                ranking.youthScore * 0.14 +
                ranking.tradeEfficiency * 0.10
              );
              return {
                ...ranking,
                draftCapital,
                score,
                tier: score >= 96
                  ? 'Thanos'
                  : score >= 91
                    ? 'Heavyweight'
                    : score >= 86
                      ? 'Might Surprise'
                      : score >= 81
                        ? 'Broke Flex'
                        : score >= 70
                          ? 'Mid As Hell'
                          : 'Free Money',
              };
            })
            .sort((a, b) => b.score - a.score)
            .map((ranking, index) => ({ ...ranking, rank: index + 1 }));
          const waiverIntelligence = buildWaiverIntelligence(
            trendingAdds,
            trendingDrops,
            players,
            ktcValues,
            ownerByPlayerId,
            rosterStatusByPlayerId,
            leagueValueMode,
            allValueProfilesById,
            {
              rosterPositions: currentSeasonData.rosterPositions,
              lastSeasonPositionRanks,
              fantasyProsSnapshotContext,
              draftSharksScheduleContext,
              currentWeek: currentScheduleWeek,
              playoffWeeks,
              playoffWeekStart,
              weeklyProjectionByPlayerId,
            }
          );
          const scheduleEdgeTargets = buildScheduleEdgeTargetsFromDraftSharksContext({
            draftSharksContext: draftSharksScheduleContext,
            players,
            ktcValues,
            ownerByPlayerId,
            rosterStatusByPlayerId,
            leagueValueMode,
            valueProfilesById: allValueProfilesById,
            lastSeasonPositionRanks,
            rosterPositions: currentSeasonData.rosterPositions,
            currentWeek: currentScheduleWeek,
            playoffWeeks,
            playoffWeekStart,
          });
          const managerIntelByName = new Map((reportData.managerRosterIntelligence || []).map((row) => [row.manager, row]));
          const recentTransactions = buildRecentTransactions(
            allTransactions,
            rosterUserMap,
            players,
            ktcValues,
            rosterStatusByPlayerId,
            ownerByPlayerId,
            managerIntelByName,
            currentSeason,
            leagueValueMode,
            allValueProfilesById
          );
          const historicalRecentTransactions = historicalTransactionContexts.flatMap((context) => buildRecentTransactions(
            context.transactions,
            context.rosterUserMap,
            players,
            ktcValues,
            rosterStatusByPlayerId,
            ownerByPlayerId,
            managerIntelByName,
            context.season || currentSeason,
            leagueValueMode,
            allValueProfilesById
          ));
          const allRecentTransactions = [...recentTransactions, ...historicalRecentTransactions]
            .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
            .slice(0, 160);
          const tradeProposalSignals = [
            ...buildTradeProposalSignals(allTransactions, rosterUserMap, players),
            ...historicalTransactionContexts.flatMap((context) => buildTradeProposalSignals(context.transactions, context.rosterUserMap, players)),
          ].slice(0, 80);
          const transactionBackfillDiagnostics = buildTransactionBackfillDiagnostics(historicalTransactionContexts);
          markAnalyzeStep('derived report tables');
          const prospectLookup = buildProspectLookup(prospectContext.profiles);
          const managerChampionships = await buildManagerChampionships(leagueInfo, users, rosters);
          markAnalyzeStep('prospects and crowns');

          const reportPlayerIds = [
            ...rosters.flatMap((roster: any) => [...(roster.players || []), ...(roster.taxi || []), ...(roster.reserve || [])]),
            ...trades.flatMap((trade: any) => Object.keys(trade.adds || {})),
            ...draftAnalysis.draftPicks.map((pick: any) => pick.player_id),
            ...trendingAdds.map((player) => player.player_id),
            ...trendingDrops.map((player) => player.player_id),
            waiverIntelligence.highestKtcAvailable?.player_id,
            ...Object.values(waiverIntelligence.bestAvailableByPosition).map((player) => player?.player_id),
            ...waiverIntelligence.bestTaxiStashes.map((player) => player.player_id),
            ...waiverIntelligence.recentlyDroppedValuable.map((player) => player.player_id),
            ...(waiverIntelligence.weeklyEcrTargets || []).map((target) => target.player.player_id),
          ];
          const similarTradeValuesById = buildSimilarTradeValueMap(reportPlayerIds, players, ktcValues, leagueValueMode, allValueProfilesById);
          const tradeCompPlayerIds = Object.values(similarTradeValuesById)
            .flatMap((peers) => peers.map((peer) => peer.playerId));
          const detailPlayerIds = Array.from(new Set([...reportPlayerIds, ...tradeCompPlayerIds].filter((playerId): playerId is string => Boolean(playerId))));
          const valueProfilesById = Object.fromEntries(
            detailPlayerIds
              .map((playerId) => [playerId, allValueProfilesById[playerId]])
              .filter((entry): entry is [string, NonNullable<PlayerDetails['valueProfile']>] => Boolean(entry[1]))
          );
          const recentStoredValueTimelineSnapshots = await loadStoredValueTimelineSnapshotsForPlayers({
            playerIds: detailPlayerIds,
            players,
            valueProfileKey: leagueValueProfileKey,
          });
          const valueTimelinesById = buildPlayerValueTimelineMap({
            playerIds: detailPlayerIds,
            players,
            valueProfileKey: leagueValueProfileKey,
            leagueValueMode,
            recentStoredSnapshots: recentStoredValueTimelineSnapshots,
          });
          const sleeperResearchSeasonType = String(leagueInfo.season_type || 'regular');
          const depthChartResultPromise = fetchEspnDepthChartsForPlayersWithDiagnostics(detailPlayerIds, players, getUserLoadSnapshotOptions());
          const playerStaticEnrichmentPromise = loadReportPlayerStaticEnrichment({
            leagueId: input.leagueId,
            leagueValueProfileKey,
            currentSeason,
            lastCompletedSeason,
            sleeperResearchSeasonType,
            playerIds: detailPlayerIds,
            forceRefresh,
            buildEnrichment: async () => {
              const [
                availabilityHistoryById,
                sleeperResearchByPlayerId,
                pastSeasonUsageByPlayerId,
              ] = await Promise.all([
                fetchPlayerAvailabilityHistory(
                  detailPlayerIds,
                  players,
                  leagueInfo.scoring_settings,
                  lastCompletedSeason
                ),
                fetchSleeperPlayerResearchMap(sleeperResearchSeasonType, currentSeason),
                prevLeagueId && pastSeasonData
                  ? fetchSleeperLeagueUsageSummary(
                      prevLeagueId,
                      pastSeasonData.label,
                      pastSeasonData.rosterMap as Record<string, string>,
                      pastRosterDisplayMap
                    )
                  : Promise.resolve({} as Record<string, SleeperLeagueUsageSummary>),
              ]);
              const latestNewsByPlayerId = buildLatestNewsByPlayerId(
                detailPlayerIds,
                players,
                playerNews
              );
              const newsValueMovementByPlayerId = buildNewsValueMovementByPlayerId(
                detailPlayerIds,
                players,
                latestNewsByPlayerId,
                ktcValues,
                ktcValuesLastWeek
              );
              const prospectProfilesById = Object.fromEntries(
                detailPlayerIds
                  .map((playerId) => {
                    const player = players[playerId];
                    return [
                      playerId,
                      player
                        ? findProspectProfile(
                            prospectLookup,
                            getPlayerName(playerId, players),
                            player.position,
                            player.college,
                            player.metadata?.rookie_year ?? null
                          )
                        : null,
                    ];
                  })
                  .filter((entry): entry is [string, NonNullable<PlayerDetails['prospectProfile']>] => Boolean(entry[1]))
              );

              return buildReportPlayerStaticEnrichment({
                playerIds: detailPlayerIds,
                currentSeason,
                sleeperResearchSeasonType,
                valueProfilesById,
                valueTimelinesById,
                lastSeasonPositionRanks,
                availabilityHistoryById,
                latestNewsByPlayerId,
                newsValueMovementByPlayerId,
                sleeperResearchByPlayerId,
                pastSeasonUsageByPlayerId,
                playerScheduleProfiles: staticSections.playerScheduleProfiles,
                similarTradeValuesById,
                prospectProfilesById,
              });
            },
          });
          const depthChartResult = await depthChartResultPromise;
          const nflverseDraftCapital = await loadNflverseDraftCapitalSnapshot({ sourceMode: 'snapshot' });
          const useCurrentUsageContext = /regular|post/i.test(sleeperResearchSeasonType)
            && Number(currentSeason) > Number(lastCompletedSeason);
          const nflversePlayerContext = await loadNflversePlayerContext({
            season: useCurrentUsageContext ? currentSeason : lastCompletedSeason,
            rosterRoomSeason: currentSeason,
            rosterRoomPreviousSeason: lastCompletedSeason,
            sourceMode: 'snapshot',
          });
          const sourceDiagnosticRowCounts = [
            { sourceKey: 'ktc-blended-values-v1', rowCount: Object.keys(ktcValues || {}).length },
            { sourceKey: 'fantasypros-news-v1', rowCount: newsSourceCounts.fantasyPros },
            ...fantasyProsSnapshotContext.rowCounts,
            { sourceKey: 'sportsdataio-news-v1', rowCount: newsSourceCounts.sportsDataIo },
            { sourceKey: 'espn-depth-charts-v1', rowCount: depthChartResult.diagnostics.loadedTeams.length },
            { sourceKey: 'draftsharks-sos-v1', rowCount: Object.keys(draftSharksScheduleContext.profiles || {}).length },
            { sourceKey: `player-projection-snapshots-v1:sleeper:${projectionScoringProfile}:weekly`, rowCount: weeklyProjectionDiagnostics.rowCount },
            { sourceKey: NFLVERSE_DRAFT_CAPITAL_SOURCE_KEY, rowCount: nflverseDraftCapital.rowCount },
            ...nflversePlayerContext.rowCounts,
            { sourceKey: `sleeper-season-stats-v1:${lastCompletedSeason}`, rowCount: Object.keys(lastSeasonPositionRanks || {}).length },
            { sourceKey: 'prospect-snapshot:NFL Draft Buzz', rowCount: prospectContext.diagnostics.playerCount },
          ];
          const [sourceDiagnosticsSection, playerStaticEnrichment] = await Promise.all([
            loadReportSourceDiagnosticsSection({
              leagueId: input.leagueId,
              leagueValueProfileKey,
              currentSeason,
              lastCompletedSeason,
              devyProfileKey: `devy_${leagueValueProfileKey}`,
              currentWeek: currentScheduleWeek,
              weekWindow: 3,
              rowCounts: sourceDiagnosticRowCounts,
              forceRefresh,
            }),
            playerStaticEnrichmentPromise,
          ]);
          const sourceSnapshotDiagnostics = sourceDiagnosticsSection.sourceSnapshotDiagnostics;
          const actualDepthChartsByPlayerId = depthChartResult.playerDepthCharts;
          const playerDetailsById = buildPlayerDetailsMap(detailPlayerIds, players, rosterStatusByPlayerId, actualDepthChartsByPlayerId);
          const staticEnrichedPlayerDetailsById = Object.fromEntries(
            Object.entries(playerDetailsById).map(([playerId, details]) => [
              playerId,
              {
                ...details,
                ...playerStaticEnrichment.playerEnrichmentById[playerId],
              },
            ])
          );
          const draftEnrichedPlayerDetailsById = enrichPlayerDetailsWithNflverseDraftCapital(
            staticEnrichedPlayerDetailsById,
            buildNflverseDraftCapitalBySleeperId(nflverseDraftCapital)
          );
          const enrichedPlayerDetailsById = enrichPlayerDetailsWithNflverseContext(
            draftEnrichedPlayerDetailsById,
            nflversePlayerContext
          );
          const valueTimelinesWithEventsById = buildPlayerValueTimelineMap({
            playerIds: detailPlayerIds,
            players,
            playerDetailsById: enrichedPlayerDetailsById,
            valueProfileKey: leagueValueProfileKey,
            leagueValueMode,
            recentStoredSnapshots: recentStoredValueTimelineSnapshots,
          });
          Object.entries(valueTimelinesWithEventsById).forEach(([playerId, valueTimeline]) => {
            enrichedPlayerDetailsById[playerId] = {
              ...enrichedPlayerDetailsById[playerId],
              valueTimeline: slimPlayerValueTimelineForReport(valueTimeline),
            };
          });
          const playerCohortsById = buildPlayerCohortProfiles({
            playerDetailsById: enrichedPlayerDetailsById,
            mode: leagueValueMode === 'redraft' ? 'redraft' : 'dynasty',
          });
          const playerDetailsWithCohortsById = Object.fromEntries(
            Object.entries(enrichedPlayerDetailsById).map(([playerId, details]) => [
              playerId,
              {
                ...details,
                playerCohort: playerCohortsById[playerId] || null,
              },
            ])
          );
          const playerSituationDeltasById = buildPlayerSituationDeltas({
            playerDetailsById: playerDetailsWithCohortsById,
          });
          const playerDetailsWithSituationById = Object.fromEntries(
            Object.entries(playerDetailsWithCohortsById).map(([playerId, details]) => [
              playerId,
              {
                ...details,
                playerSituationDelta: playerSituationDeltasById[playerId] || null,
                weeklyProjection: weeklyProjectionByPlayerId[playerId] || null,
              },
            ])
          );
          markAnalyzeStep(`player static enrichment ${playerStaticEnrichment.cacheStatus}`);

          const currentSeasonDraftDiagnostics = buildCurrentSeasonMainDraftDiagnostics(
            draftAnalysis.draftPicks,
            currentSeasonLabel
          );
          const sleeperDraftStatusDiagnostics = normalizeSleeperDraftStatus(leagueInfo);
          const reportPayloadData = {
            ...reportData,
            leagueDiagnostics: reportData.leagueDiagnostics
              ? {
                  ...reportData.leagueDiagnostics,
                  currentSeason: currentSeasonLabel,
                  ...sleeperDraftStatusDiagnostics,
                  ...currentSeasonDraftDiagnostics,
                }
              : undefined,
            sourceSnapshotDiagnostics,
            weeklyProjectionDiagnostics,
            depthChartDiagnostics: depthChartResult.diagnostics,
            prospectSourceDiagnostics: staticSections.prospectSourceDiagnostics,
            viewerManager,
            viewerManagerByUserId: userIdToManagerMap,
            currentStandings,
            managerAvatars: buildManagerAvatarMap(users),
            managerChampionships,
            managerRosterIntelligence: attachManagerSituationContext(reportData.managerRosterIntelligence, playerDetailsWithSituationById),
            playerDetailsById: playerDetailsWithSituationById,
            currentPositionRankById: buildPrimaryPositionRankMap(detailPlayerIds, players, ktcValues, valueProfilesById, leagueValueMode),
            trendingAdds,
            trendingDrops,
            pickPortfolios,
            powerRankings,
            waiverIntelligence,
            scheduleEdgeTargets,
            schedulePlanning,
            matchupPreviews,
            recentTransactions: allRecentTransactions,
            transactionBackfillDiagnostics,
            adminTradeProposalSignals,
            tradeProposalSignals,
            draftPicks: draftAnalysis.draftPicks,
            draftStats: draftAnalysis.draftStats,
          };
          const quotaUnavailableSnapshot = await getMonthlyBlueprintQuotaUnavailableSnapshot({
            ctx,
            leagueId: input.leagueId,
            viewerUserId: input.viewerUserId,
            ipAddress,
          });
          const monthlyBlueprintSnapshot = quotaUnavailableSnapshot || (await persistMonthlyBlueprintSnapshots({
            leagueId: input.leagueId,
            leagueName: leagueInfo.name,
            leagueFormat: formatLeagueFormat(leagueInfo),
            reportData: reportPayloadData,
          }));
          const monthlyBlueprintHistory = monthlyBlueprintSnapshot.source === 'database' || monthlyBlueprintSnapshot.status === 'unavailable'
            ? await readMonthlyBlueprintHistory(input.leagueId)
            : [];
          markAnalyzeStep('monthly blueprint snapshot');

          const leagueAiConfidenceHistory = await loadRecentLeagueAiConfidenceSnapshots(input.leagueId);
          const reportDataWithConfidence = attachLeagueAiConfidence({
            ...reportPayloadData,
            monthlyBlueprintSnapshot,
            monthlyBlueprintHistory,
          }, leagueAiConfidenceHistory);
          await persistLeagueAiConfidenceSnapshot({
            leagueId: input.leagueId,
            confidence: reportDataWithConfidence.leagueDiagnostics?.aiConfidence,
          });
          markAnalyzeStep('league AI confidence snapshot');

          const aiCalibrationEvents = await listAiPredictionEvents({
            leagueId: input.leagueId,
            limit: 500,
          });
          const aiCalibrationAdjustmentProfile = buildAICalibrationAdjustmentProfile(aiCalibrationEvents);
          const reportDataWithCalibration: ReportData = {
            ...reportDataWithConfidence,
            aiCalibrationAdjustmentProfile,
          };
          const serverReportDelta = buildServerReportDelta(
            getCachedReportData(cachedReport),
            reportDataWithCalibration
          );
          const reportDataWithDailyMemory: ReportData = {
            ...reportDataWithCalibration,
            serverReportDelta,
          };
          markAnalyzeStep('AI calibration memory');

          const reportDataWithHiddenData = await attachStoredSleeperHiddenLeagueSnapshot(reportDataWithDailyMemory, input.leagueId);

          const analyzePayloadRaw = {
            leagueId: input.leagueId,
            leagueName: leagueInfo.name,
            leagueLogo: getSleeperAvatarUrl(leagueInfo.avatar),
            leagueFormat: formatLeagueFormat(leagueInfo),
            reportData: reportDataWithHiddenData,
          };
          const { payload: analyzePayload } = slimCachedLeagueReportPayload(analyzePayloadRaw);
          markAnalyzeStep('payload assembly');

          try {
            await writeCachedLeagueReport(reportCacheKey, input.leagueId, input.viewerUserId, analyzePayload);
            markAnalyzeStep('cache write');
          } catch (cacheError) {
            console.warn('Failed to cache league report:', cacheError);
          }

          return {
            ...analyzePayload,
            reportCacheStatus: 'miss' as const,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error('League analysis error:', error);
          if (!(error instanceof Error && error.message === 'Invalid league ID')) {
            await insertLoginAttempt({
              eventType: "analyze_league",
              status: "error",
              leagueId: input.leagueId,
              ipAddress,
              userAgent,
              note: error instanceof Error ? error.message : "Failed to fetch league data",
            });
          }
          throw new Error('Failed to fetch league data');
        }
    }),
  }),

  players: router({
    latestNews: publicProcedure
      .input(z.object({
        playerId: z.string().optional(),
        playerName: z.string().optional(),
        team: z.string().optional().nullable(),
        position: z.string().optional().nullable(),
      }))
      .query(async ({ input }) => {
        const playerName = input.playerName?.trim();
        if (!playerName) return { latestNews: null };

        const latestNews = await fetchLatestPlayerNews({
          playerName,
          team: input.team || null,
          position: input.position || null,
          ...getUserLoadSnapshotOptions(),
        });

        return {
          latestNews: latestNews ? {
            title: latestNews.title,
            summary: latestNews.summary || null,
            source: latestNews.source || 'FantasyPros',
            sourceUrl: latestNews.sourceUrl || null,
            url: latestNews.url || null,
            publishedAt: latestNews.publishedAt || null,
          } : null,
        };
      }),
    redraftValueTimeline: publicProcedure
      .input(z.object({
        leagueId: sleeperLeagueIdSchema.optional(),
        playerName: z.string().trim().min(1).max(120),
      }))
      .query(({ input, ctx }) => {
        assertReportAccess(ctx);
        assertRateLimit(ctx.req as any, {
          id: 'players.redraftValueTimeline',
          max: 80,
          windowMs: 1000 * 60 * 10,
          scope: input.leagueId || input.playerName,
          message: 'Too many redraft value timeline requests. Please wait a few minutes and try again.',
        });

        return {
          timeline: getRedraftValueTimelineForPlayer(input.playerName),
        };
      }),
    valueTimeline: publicProcedure
      .input(z.object({
        leagueId: sleeperLeagueIdSchema.optional(),
        playerName: z.string().trim().min(1).max(120),
        valueProfileKey: z.string().trim().min(1).max(120).default('12_sf_ppr_base'),
        leagueValueMode: z.enum(['dynasty', 'keeper']).default('dynasty'),
        selectedWindow: valueTimelineWindowSchema.optional(),
      }))
      .query(async ({ input, ctx }) => {
        assertReportAccess(ctx);
        assertRateLimit(ctx.req as any, {
          id: 'players.valueTimeline',
          max: 80,
          windowMs: 1000 * 60 * 10,
          scope: input.leagueId || input.playerName,
          message: 'Too many player value timeline requests. Please wait a few minutes and try again.',
        });

        const playerId = '__player__';
        const recentStoredSnapshots = await loadStoredValueTimelineSnapshotsForPlayers({
          playerIds: [playerId],
          players: {
            [playerId]: {
              full_name: input.playerName,
            },
          },
          valueProfileKey: input.valueProfileKey,
        });

        return {
          timeline: getPlayerValueTimelineForPlayer({
            playerName: input.playerName,
            valueProfileKey: input.valueProfileKey,
            leagueValueMode: input.leagueValueMode,
            selectedWindow: input.selectedWindow,
            recentStoredSnapshots,
          }),
        };
      }),
    seasonGameLog: publicProcedure
      .input(z.object({
        leagueId: sleeperLeagueIdSchema,
        playerId: z.string().trim().min(1).max(64),
        season: z.string().trim().regex(/^\d{4}$/),
        position: z.string().trim().max(8).optional().nullable(),
      }))
      .query(async ({ input, ctx }) => {
        assertReportAccess(ctx);
        assertRateLimit(ctx.req as any, {
          id: 'players.seasonGameLog',
          max: 30,
          windowMs: 1000 * 60 * 10,
          scope: `${input.leagueId}:${input.playerId}`,
          message: 'Too many season log requests. Please wait a few minutes and try again.',
        });

        const normalizedLeagueId = getValidSleeperEntityId(input.leagueId);
        if (!normalizedLeagueId || isInvalidLeagueIdCached(normalizedLeagueId)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid league ID',
          });
        }

        const leagueInfo = await fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`);
        if (!leagueInfo?.league_id) {
          markInvalidLeagueId(normalizedLeagueId);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid league ID',
          });
        }

        const seasonGameLog = await buildSleeperSeasonGameLog(
          input.playerId,
          input.position || null,
          leagueInfo.scoring_settings || {},
          input.season
        );

        return {
          ...seasonGameLog,
          season: input.season,
        } as const;
      }),
  }),

  images: router({
    playerHeadshot: publicProcedure
      .input(z.object({
        playerId: z.string(),
        playerName: z.string().optional().nullable(),
        position: z.string().optional().nullable(),
      }))
      .query(async ({ input }) => {
        // Try to get from cache first
        const cached = getCachedImage(input.playerId);
        if (cached) {
          return {
            success: true,
            cached: true,
            data: cached.data.toString('base64'),
            contentType: cached.contentType,
            imageUrl: null,
            source: 'sleeper' as const,
          };
        }

        // Fetch and cache
        const imageBuffer = await fetchPlayerHeadshot(input.playerId);
        if (imageBuffer) {
          return {
            success: true,
            cached: false,
            data: imageBuffer.toString('base64'),
            contentType: 'image/jpeg',
            imageUrl: null,
            source: 'sleeper' as const,
          };
        }

        if (input.playerName) {
          const prospectContext = await loadProspectContext();
          const prospectProfile = findProspectProfile(
            buildProspectLookup(prospectContext.profiles),
            input.playerName,
            input.position,
            null,
            null
          );
          if (prospectProfile?.playerImageUrl) {
            return {
              success: true,
              cached: false,
              data: null,
              contentType: null,
              imageUrl: prospectProfile.playerImageUrl,
              source: 'prospect' as const,
            };
          }
        }

        return {
          success: false,
          cached: false,
          data: null,
          contentType: null,
          imageUrl: null,
          source: null,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
