import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const routersPath = path.resolve(__dirname, "routers.ts");
const routersSource = fs.readFileSync(routersPath, "utf8");
const draftAnalysisPath = path.resolve(__dirname, "draftAnalysis.ts");
const draftAnalysisSource = fs.readFileSync(draftAnalysisPath, "utf8");
const reportStaticInputsPath = path.resolve(__dirname, "reportStaticInputs.ts");
const reportStaticInputsSource = fs.readFileSync(reportStaticInputsPath, "utf8");
const reportStaticSectionsPath = path.resolve(__dirname, "reportStaticSections.ts");
const reportStaticSectionsSource = fs.readFileSync(reportStaticSectionsPath, "utf8");
const reportPlayerEnrichmentPath = path.resolve(__dirname, "reportPlayerEnrichment.ts");
const reportPlayerEnrichmentSource = fs.readFileSync(reportPlayerEnrichmentPath, "utf8");
const imageProxyPath = path.resolve(__dirname, "imageProxy.ts");
const imageProxySource = fs.readFileSync(imageProxyPath, "utf8");

function extractSourceFrom(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function extractSource(startMarker: string, endMarker: string): string {
  return extractSourceFrom(routersSource, startMarker, endMarker);
}

describe("user-load provider boundary", () => {
  it("keeps league report generation on Sleeper live calls plus stored snapshots", () => {
    const analyzeSource = extractSource("analyze: publicProcedure", "\n  }),\n\n  players: router");
    const urls = Array.from(analyzeSource.matchAll(/https:\/\/[^`'")\s]+/g), (match) => match[0]);

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => ["api.sleeper.app", "api.sleeper.com", "sleepercdn.com"].includes(new URL(url).hostname))).toBe(true);
    expect(analyzeSource).toContain("loadReportStaticInputs({");
    expect(analyzeSource).toContain("loadReportStaticSections({");
    expect(analyzeSource).toContain("loadReportSourceDiagnosticsSection({");
    expect(analyzeSource).toContain("buildPlayerDetailsMap(detailPlayerIds, players, rosterStatusByPlayerId, actualDepthChartsByPlayerId)");
    expect(analyzeSource).toContain("loadReportPlayerStaticEnrichment({");
    expect(analyzeSource).toContain("fetchEspnDepthChartsForPlayersWithDiagnostics(detailPlayerIds, players, getUserLoadSnapshotOptions())");
    expect(reportStaticInputsSource).toContain("loadBlendedKTCValues(input.leagueValueOptions, getUserLoadSnapshotOptions())");
    expect(reportStaticInputsSource).toContain("loadDraftSharksScheduleContext({");
    expect(reportStaticInputsSource).toContain("...getUserLoadSnapshotOptions()");
    expect(reportStaticInputsSource).toContain("loadPlayerNewsBundle(getUserLoadSnapshotOptions())");
    expect(reportStaticSectionsSource).toContain("buildPlayerScheduleProfiles({");
    expect(reportStaticSectionsSource).toContain("loadSourceSnapshotFreshnessDiagnostics({");
    expect(reportPlayerEnrichmentSource).toContain("playerEnrichmentById");
    expect(reportPlayerEnrichmentSource).not.toContain("rosterStatus");
    expect(reportPlayerEnrichmentSource).not.toContain("injuryStatus");
  });

  it("checks signed-in report-generation usage before fresh user-load work", () => {
    const analyzeSource = extractSource("analyze: publicProcedure", "\n  }),\n\n  players: router");
    const usageLimitIndex = analyzeSource.indexOf('assertPersistedUsageLimit({');
    const leagueFetchIndex = analyzeSource.indexOf('fetchUserLoadJson<any>(\n              `https://api.sleeper.app/v1/league/${normalizedLeagueId}`');
    const usageRecordIndex = analyzeSource.indexOf('recordLimitedUsageEvent({');
    const cacheHitIndex = analyzeSource.indexOf("reportCacheStatus: 'hit' as const");

    expect(usageLimitIndex).toBeGreaterThan(0);
    expect(leagueFetchIndex).toBeGreaterThan(usageLimitIndex);
    expect(cacheHitIndex).toBeLessThan(usageLimitIndex);
    expect(analyzeSource).toContain('featureKey: "report-generation"');
    expect(analyzeSource).toContain('source: "league.analyze"');
    expect(usageRecordIndex).toBeGreaterThan(leagueFetchIndex);
  });

  it("caches live Sleeper activity patches for cached report opens", () => {
    const attachSource = extractSource("async function attachLiveSleeperActivity", "\nfunction ordinalRound");
    const setCacheSource = extractSource("function setCachedLiveSleeperActivityPatch", "\n\nasync function attachLiveSleeperActivity");
    const cacheReadIndex = attachSource.indexOf("const cachedLiveActivity = getCachedLiveSleeperActivityPatch(leagueId)");
    const buildIndex = attachSource.indexOf("buildLiveSleeperActivityPatch(leagueId, payload.reportData)");
    const cacheWriteIndex = attachSource.indexOf("setCachedLiveSleeperActivityPatch(leagueId, liveActivity)");
    const pruneIndex = setCacheSource.indexOf("pruneLiveSleeperActivityPatchCache()");
    const insertIndex = setCacheSource.indexOf("liveSleeperActivityPatchCache.set(normalizedLeagueId");

    expect(routersSource).toContain("const LIVE_SLEEPER_ACTIVITY_CACHE_TTL_MS = 90 * 1000");
    expect(routersSource).toContain("const LIVE_SLEEPER_ACTIVITY_CACHE_MAX_LEAGUES = 80");
    expect(routersSource).toContain("const liveSleeperActivityPatchCache = new Map");
    expect(cacheReadIndex).toBeGreaterThan(0);
    expect(buildIndex).toBeGreaterThan(cacheReadIndex);
    expect(cacheWriteIndex).toBeGreaterThan(buildIndex);
    expect(pruneIndex).toBeGreaterThan(0);
    expect(insertIndex).toBeGreaterThan(pruneIndex);
  });

  it("bounds the full league report memory cache before cache writes", () => {
    const setMemorySource = extractSource("function setMemoryCachedLeagueReport", "\n\nasync function readCachedLeagueReport");
    const readCacheSource = extractSource("async function readCachedLeagueReport", "\n\nasync function writeCachedLeagueReport");
    const writeCacheSource = extractSource("async function writeCachedLeagueReport", "\nasync function readFileCachedLeagueReport");
    const pruneIndex = setMemorySource.indexOf("pruneLeagueReportMemoryCache()");
    const insertIndex = setMemorySource.indexOf("leagueReportMemoryCache.set(cacheKey");

    expect(routersSource).toContain("const LEAGUE_REPORT_MEMORY_CACHE_MAX_ENTRIES = 60");
    expect(pruneIndex).toBeGreaterThan(0);
    expect(insertIndex).toBeGreaterThan(pruneIndex);
    expect(readCacheSource).toContain("setMemoryCachedLeagueReport(cacheKey, slimmedStoredCached)");
    expect(readCacheSource).toContain("setMemoryCachedLeagueReport(cacheKey, slimmedFileCached)");
    expect(writeCacheSource).toContain("setMemoryCachedLeagueReport(cacheKey, slimmedPayload)");
    expect(readCacheSource).not.toContain("leagueReportMemoryCache.set(");
    expect(writeCacheSource).not.toContain("leagueReportMemoryCache.set(");
  });

  it("bounds invalid league-id cache writes before recording misses", () => {
    const markInvalidSource = extractSource("function markInvalidLeagueId", "\ntype KtcValueProfileCandidate");
    const pruneIndex = markInvalidSource.indexOf("pruneInvalidLeagueIdCache()");
    const insertIndex = markInvalidSource.indexOf("invalidLeagueIdCache.set(validLeagueId");

    expect(routersSource).toContain("const INVALID_LEAGUE_ID_CACHE_MAX_ENTRIES = 1000");
    expect(pruneIndex).toBeGreaterThan(0);
    expect(insertIndex).toBeGreaterThan(pruneIndex);
  });

  it("bounds route-limit buckets while preserving the current request key", () => {
    const sweepSource = extractSource("function sweepRateLimitBuckets", "\n\nfunction assertRateLimit");
    const assertSource = extractSource("function assertRateLimit", "\n\nfunction assertReportAccess");
    const keyIndex = assertSource.indexOf("const key = [options.id, clientId, options.scope || 'global'].join(':')");
    const sweepIndex = assertSource.indexOf("sweepRateLimitBuckets(now, key)");
    const readBucketIndex = assertSource.indexOf("const existing = rateLimitBuckets.get(key)");

    expect(routersSource).toContain("const RATE_LIMIT_BUCKET_MAX_ENTRIES = 5000");
    expect(routersSource).toContain("const RATE_LIMIT_BUCKET_SWEEP_INTERVAL_MS = 1000 * 60 * 5");
    expect(sweepSource).toContain("while (rateLimitBuckets.size >= RATE_LIMIT_BUCKET_MAX_ENTRIES)");
    expect(sweepSource).toContain(".filter(([key]) => key !== reserveKey)");
    expect(keyIndex).toBeGreaterThan(0);
    expect(sweepIndex).toBeGreaterThan(keyIndex);
    expect(readBucketIndex).toBeGreaterThan(sweepIndex);
  });

  it("keeps protected account link reads behind the route limiter", () => {
    const guardSource = extractSource("function assertAccountReadRateLimit", "\n\nasync function assertAccountSavedResourceLimit");
    const routeSource = extractSource("links: protectedProcedure", "\n    saveSleeperAccount: protectedProcedure");
    const rateLimitIndex = routeSource.indexOf("assertAccountReadRateLimit(ctx)");
    const readMarkers = [
      "listUserSleeperAccounts(ctx.user.openId)",
      "listUserFavoriteLeagues(ctx.user.openId)",
      "listUserRecentReports(ctx.user.openId)",
      "getUserNotificationPreferences(ctx.user.openId)",
    ];

    expect(guardSource).toContain("assertRateLimit(ctx.req as any");
    expect(guardSource).toContain('id: "account.links"');
    expect(guardSource).toContain("max: 60");
    expect(guardSource).toContain("windowMs: 1000 * 60 * 10");
    expect(guardSource).toContain("scope: getActionPlanUserKey(ctx.user)");
    expect(rateLimitIndex).toBeGreaterThan(0);
    for (const marker of readMarkers) {
      expect(routeSource.indexOf(marker), marker).toBeGreaterThan(rateLimitIndex);
    }
  });

  it("keeps protected account writes behind the route limiter", () => {
    const guardSource = extractSource("function assertAccountWriteRateLimit", "\n\nasync function assertAccountSavedResourceLimit");
    const routeChecks = [
      {
        name: "saveSleeperAccount",
        source: extractSource("saveSleeperAccount: protectedProcedure", "\n    removeSleeperAccount: protectedProcedure"),
        rateLimitId: "account.saveSleeperAccount",
        workMarkers: ["assertAccountPersistenceConfigured()", "upsertUserSleeperAccount({"],
      },
      {
        name: "removeSleeperAccount",
        source: extractSource("removeSleeperAccount: protectedProcedure", "\n    saveFavoriteLeague: protectedProcedure"),
        rateLimitId: "account.removeSleeperAccount",
        workMarkers: ["assertAccountPersistenceConfigured()", "deleteUserSleeperAccount({"],
      },
      {
        name: "saveFavoriteLeague",
        source: extractSource("saveFavoriteLeague: protectedProcedure", "\n    removeFavoriteLeague: protectedProcedure"),
        rateLimitId: "account.saveFavoriteLeague",
        workMarkers: ["assertAccountPersistenceConfigured()", "const favoriteLeagues = await listUserFavoriteLeagues(ctx.user.openId)", "upsertUserFavoriteLeague({"],
      },
      {
        name: "removeFavoriteLeague",
        source: extractSource("removeFavoriteLeague: protectedProcedure", "\n    recordRecentReport: protectedProcedure"),
        rateLimitId: "account.removeFavoriteLeague",
        workMarkers: ["assertAccountPersistenceConfigured()", "deleteUserFavoriteLeague({"],
      },
      {
        name: "recordRecentReport",
        source: extractSource("recordRecentReport: protectedProcedure", "\n    updateNotificationPreferences: protectedProcedure"),
        rateLimitId: "account.recordRecentReport",
        workMarkers: ["assertAccountPersistenceConfigured()", "const recentReports = await listUserRecentReports(ctx.user.openId, 200)", "recordUserRecentReport({"],
      },
      {
        name: "updateNotificationPreferences",
        source: extractSource("updateNotificationPreferences: protectedProcedure", "\n  }),\n\n  billing: router"),
        rateLimitId: "account.updateNotificationPreferences",
        workMarkers: ["assertAccountPersistenceConfigured()", "const persistedAccess = await loadPersistedFeatureAccess({", "upsertUserNotificationPreferences({"],
      },
    ];

    expect(guardSource).toContain("assertRateLimit(ctx.req as any");
    expect(guardSource).toContain("max: 60");
    expect(guardSource).toContain("windowMs: 1000 * 60 * 10");
    expect(guardSource).toContain("scope: getActionPlanUserKey(ctx.user)");

    for (const route of routeChecks) {
      const rateLimitIndex = route.source.indexOf(`assertAccountWriteRateLimit(ctx, "${route.rateLimitId}")`);
      expect(rateLimitIndex, route.name).toBeGreaterThan(0);
      for (const marker of route.workMarkers) {
        expect(route.source.indexOf(marker), `${route.name}:${marker}`).toBeGreaterThan(rateLimitIndex);
      }
    }
  });

  it("bounds Sleeper league usage cache before writing matchup summaries", () => {
    const pruneUsageCacheSource = extractSource("function pruneSleeperLeagueUsageCache", "\n\nfunction setCachedSleeperLeagueUsageSummary");
    const setUsageCacheSource = extractSource("function setCachedSleeperLeagueUsageSummary", "\n\nasync function fetchSleeperLeagueUsageSummary");
    const fetchUsageSource = extractSource("async function fetchSleeperLeagueUsageSummary", "\n\nasync function fetchSleeperPlayerResearchMap");
    const pruneIndex = setUsageCacheSource.indexOf("pruneSleeperLeagueUsageCache()");
    const insertIndex = setUsageCacheSource.indexOf("sleeperLeagueUsageCache.set(cacheKey");

    expect(routersSource).toContain("const SLEEPER_LEAGUE_USAGE_CACHE_MAX_ENTRIES = 80");
    expect(pruneUsageCacheSource).toContain("while (sleeperLeagueUsageCache.size >= SLEEPER_LEAGUE_USAGE_CACHE_MAX_ENTRIES)");
    expect(pruneIndex).toBeGreaterThan(0);
    expect(insertIndex).toBeGreaterThan(pruneIndex);
    expect(fetchUsageSource).toContain("setCachedSleeperLeagueUsageSummary(cacheKey, data)");
    expect(fetchUsageSource).not.toContain("sleeperLeagueUsageCache.set(");
  });

  it("keeps Sleeper username lookup provider calls behind the route limiter", () => {
    const getUserLeaguesSource = extractSource("getUserLeagues: publicProcedure", "\n    getUserLeagueRanks: publicProcedure");
    const rateLimitIndex = getUserLeaguesSource.indexOf("assertRateLimit(ctx.req as any");
    const usernameIndex = getUserLeaguesSource.indexOf("const username = input.username.trim()");
    const userUrlIndex = getUserLeaguesSource.indexOf("const userUrl = `https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`");
    const userAllowedUrlIndex = getUserLeaguesSource.indexOf("assertUserLoadAllowedLiveProviderUrl(userUrl, \"Sleeper username lookup\")");
    const userFetchIndex = getUserLeaguesSource.indexOf("fetchUserLoadResponse(userUrl, \"Sleeper username lookup\")");
    const leaguesUrlIndex = getUserLeaguesSource.indexOf("const leaguesUrl = `https://api.sleeper.app/v1/user/${user.user_id}/leagues/nfl/${currentSeason}`");
    const leaguesAllowedUrlIndex = getUserLeaguesSource.indexOf("assertUserLoadAllowedLiveProviderUrl(leaguesUrl, \"Sleeper user league lookup\")");
    const leaguesFetchIndex = getUserLeaguesSource.indexOf("fetchUserLoadResponse(leaguesUrl, \"Sleeper user league lookup\")");

    expect(rateLimitIndex).toBeGreaterThan(0);
    expect(usernameIndex).toBeGreaterThan(rateLimitIndex);
    expect(userUrlIndex).toBeGreaterThan(rateLimitIndex);
    expect(userAllowedUrlIndex).toBeGreaterThan(rateLimitIndex);
    expect(userFetchIndex).toBeGreaterThan(rateLimitIndex);
    expect(leaguesUrlIndex).toBeGreaterThan(rateLimitIndex);
    expect(leaguesAllowedUrlIndex).toBeGreaterThan(rateLimitIndex);
    expect(leaguesFetchIndex).toBeGreaterThan(rateLimitIndex);
    expect(getUserLeaguesSource).toContain("id: 'league.getUserLeagues'");
    expect(getUserLeaguesSource).toContain("message: 'Too many league lookup attempts. Please wait a few minutes and try again.'");
  });

  it("keeps direct league previews cache-first after route access checks", () => {
    const previewSource = extractSource("getLeaguePreview: publicProcedure", "\n    reportCacheStatus: publicProcedure");
    const cacheHelperSource = extractSource("function setCachedLeaguePreview", "\n\nexport function clearLeaguePreviewCacheForTests");
    const accessIndex = previewSource.indexOf("assertReportAccess(ctx)");
    const rateLimitIndex = previewSource.indexOf("assertRateLimit(ctx.req as any");
    const cacheReadIndex = previewSource.indexOf("const cachedPreview = getCachedLeaguePreview(normalizedLeagueId)");
    const leagueFetchIndex = previewSource.indexOf("fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`)");
    const usersFetchIndex = previewSource.indexOf("fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/users`)");
    const cacheWriteIndex = previewSource.indexOf("return setCachedLeaguePreview(normalizedLeagueId");

    expect(routersSource).toContain("const LEAGUE_PREVIEW_CACHE_MAX_ENTRIES = 100");
    expect(cacheHelperSource).toContain("pruneLeaguePreviewCache()");
    expect(cacheHelperSource).toContain("leaguePreviewCache.set(validLeagueId");
    expect(accessIndex).toBeGreaterThan(0);
    expect(rateLimitIndex).toBeGreaterThan(accessIndex);
    expect(cacheReadIndex).toBeGreaterThan(rateLimitIndex);
    expect(leagueFetchIndex).toBeGreaterThan(cacheReadIndex);
    expect(usersFetchIndex).toBeGreaterThan(leagueFetchIndex);
    expect(cacheWriteIndex).toBeGreaterThan(usersFetchIndex);
    expect(previewSource).toContain("id: 'league.getLeaguePreview'");
  });

  it("records source-trace view usage before returning paid trace details", () => {
    const sanitizeSource = extractSource("async function sanitizeAnalyzePayloadForPaidAccess", "\nfunction assertSessionJwtSecretConfigured");
    const accessIndex = sanitizeSource.indexOf('feature: "source-trace-details"');
    const sanitizeIndex = sanitizeSource.indexOf("sanitizeLeagueReportPayloadForPaidAccess(input.payload", accessIndex);
    const retainedTraceIndex = sanitizeSource.indexOf("sanitized.stats.retainedSourceTraceFields");
    const usageCheckIndex = sanitizeSource.indexOf("checkPersistedUsageLimit({");
    const usageRecordIndex = sanitizeSource.indexOf("recordLimitedUsageEvent({");
    const returnIndex = sanitizeSource.indexOf("return sanitized.payload");

    expect(accessIndex).toBeGreaterThan(0);
    expect(sanitizeIndex).toBeGreaterThan(accessIndex);
    expect(retainedTraceIndex).toBeGreaterThan(sanitizeIndex);
    expect(usageCheckIndex).toBeGreaterThan(retainedTraceIndex);
    expect(usageRecordIndex).toBeGreaterThan(usageCheckIndex);
    expect(returnIndex).toBeGreaterThan(usageRecordIndex);
    expect(sanitizeSource).toContain('featureKey: "source-trace-view"');
    expect(sanitizeSource).toContain('source: "league.analyze.sourceTrace"');
    expect(sanitizeSource).toContain("canViewSourceTraceDetails: false");
  });

  it("keeps ranking and player-detail non-Sleeper enrichments snapshot-only", () => {
    expect(routersSource).toContain("loadBlendedKTCValues(leagueValueOptions, getUserLoadSnapshotOptions())");
    expect(routersSource).toContain("leagueValueCache.set(key, loadBlendedKTCValues(options, getUserLoadSnapshotOptions()))");
    expect(routersSource).toContain("fetchLatestPlayerNews({");
    expect(routersSource).toContain("...getUserLoadSnapshotOptions()");
    expect(routersSource).not.toContain("sourceMode: 'live'");
    expect(routersSource).not.toContain('sourceMode: "live"');
  });

  it("keeps player latest-news lookups behind report access and rate limits", () => {
    const latestNewsSource = extractSource("latestNews: publicProcedure", "\n    redraftValueTimeline: publicProcedure");
    const nameGuardIndex = latestNewsSource.indexOf("if (!playerName) return { latestNews: null }");
    const accessIndex = latestNewsSource.indexOf("assertReportAccess(ctx)");
    const rateLimitIndex = latestNewsSource.indexOf("assertRateLimit(ctx.req as any");
    const fetchIndex = latestNewsSource.indexOf("fetchLatestPlayerNews({");

    expect(nameGuardIndex).toBeGreaterThan(0);
    expect(accessIndex).toBeGreaterThan(nameGuardIndex);
    expect(rateLimitIndex).toBeGreaterThan(accessIndex);
    expect(fetchIndex).toBeGreaterThan(rateLimitIndex);
    expect(latestNewsSource).toContain("playerId: z.string().trim().max(64).optional()");
    expect(latestNewsSource).toContain("playerName: z.string().trim().max(120).optional()");
    expect(latestNewsSource).toContain("team: z.string().trim().max(16).optional().nullable()");
    expect(latestNewsSource).toContain("position: z.string().trim().max(16).optional().nullable()");
    expect(latestNewsSource).toContain("id: 'players.latestNews'");
    expect(latestNewsSource).toContain("...getUserLoadSnapshotOptions()");
  });

  it("keeps player season-game-log live work behind report access and rate limits", () => {
    const seasonLogSource = extractSource("seasonGameLog: publicProcedure", "\n  }),\n\n  images: router");
    const accessIndex = seasonLogSource.indexOf("assertReportAccess(ctx)");
    const rateLimitIndex = seasonLogSource.indexOf("assertRateLimit(ctx.req as any");
    const leagueFetchIndex = seasonLogSource.indexOf("fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`)");
    const logBuildIndex = seasonLogSource.indexOf("buildSleeperSeasonGameLog(");

    expect(seasonLogSource).toContain("leagueId: sleeperLeagueIdSchema");
    expect(seasonLogSource).toContain("playerId: z.string().trim().min(1).max(64)");
    expect(seasonLogSource).toContain("season: z.string().trim().regex(/^\\d{4}$/)");
    expect(accessIndex).toBeGreaterThan(0);
    expect(rateLimitIndex).toBeGreaterThan(accessIndex);
    expect(leagueFetchIndex).toBeGreaterThan(rateLimitIndex);
    expect(logBuildIndex).toBeGreaterThan(leagueFetchIndex);
    expect(seasonLogSource).toContain("id: 'players.seasonGameLog'");
  });

  it("keeps user league-rank fanout behind report access, bounded, and rate-limited", () => {
    const leagueRanksSource = extractSource("getUserLeagueRanks: publicProcedure", "\n    importSleeperTradeCenter: publicProcedure");
    const accessIndex = leagueRanksSource.indexOf("assertReportAccess(ctx)");
    const rateLimitIndex = leagueRanksSource.indexOf("assertRateLimit(ctx.req as any");
    const playerIndexFetch = leagueRanksSource.indexOf("fetchSleeperPlayersIndex()");
    const leagueFetchIndex = leagueRanksSource.indexOf("fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`)");
    const rostersFetchIndex = leagueRanksSource.indexOf("fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/rosters`)");

    expect(leagueRanksSource).toContain("leagueIds: z.array(sleeperLeagueIdSchema).max(10)");
    expect(routersSource).toContain("const LEAGUE_RANK_FANOUT_CONCURRENCY = 3");
    expect(leagueRanksSource).toContain("mapWithConcurrencyLimit(leagueIds, LEAGUE_RANK_FANOUT_CONCURRENCY");
    expect(leagueRanksSource).not.toContain("Promise.all(leagueIds.map");
    expect(accessIndex).toBeGreaterThan(0);
    expect(rateLimitIndex).toBeGreaterThan(accessIndex);
    expect(playerIndexFetch).toBeGreaterThan(rateLimitIndex);
    expect(leagueFetchIndex).toBeGreaterThan(rateLimitIndex);
    expect(rostersFetchIndex).toBeGreaterThan(rateLimitIndex);
    expect(leagueRanksSource).toContain("id: 'league.getUserLeagueRanks'");
  });

  it("keeps hidden Sleeper trade imports behind report access and rate limits", () => {
    const importSource = extractSource("importSleeperTradeCenter: publicProcedure", "\n    rankings: publicProcedure");
    const accessIndex = importSource.indexOf("assertReportAccess(ctx)");
    const rateLimitIndex = importSource.indexOf("assertRateLimit(ctx.req as any");
    const leagueFetchIndex = importSource.indexOf("fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`)");
    const hiddenImportIndex = importSource.indexOf("loadSleeperHiddenTradeCenterImport({");
    const writeIndex = importSource.indexOf("upsertSleeperHiddenLeagueSnapshot({");

    expect(accessIndex).toBeGreaterThan(0);
    expect(rateLimitIndex).toBeGreaterThan(accessIndex);
    expect(leagueFetchIndex).toBeGreaterThan(rateLimitIndex);
    expect(hiddenImportIndex).toBeGreaterThan(rateLimitIndex);
    expect(writeIndex).toBeGreaterThan(hiddenImportIndex);
    expect(importSource).toContain("id: 'league.importSleeperTradeCenter'");
  });

  it("keeps ranking detail endpoints behind report access and rate limits", () => {
    const routeChecks = [
      {
        name: "rankings",
        source: extractSource("rankings: publicProcedure", "\n    rankingsMeta: publicProcedure"),
        rateLimitId: "league.rankings",
        detailMarker: null,
      },
      {
        name: "rankingsMeta",
        source: extractSource("rankingsMeta: publicProcedure", "\n    rankingProfile: publicProcedure"),
        rateLimitId: "league.rankingsMeta",
        detailMarker: "buildRankingsMetadata(payload.rankings)",
      },
      {
        name: "rankingProfile",
        source: extractSource("rankingProfile: publicProcedure", "\n    rankingDraftBuzz: publicProcedure"),
        rateLimitId: "league.rankingProfile",
        detailMarker: "buildRankingProfileDetail(payload.rankings, input.profileKey.trim())",
      },
      {
        name: "rankingDraftBuzz",
        source: extractSource("rankingDraftBuzz: publicProcedure", "\n    analyze: publicProcedure"),
        rateLimitId: "league.rankingDraftBuzz",
        detailMarker: "buildRankingDraftBuzzDetail(payload.rankings)",
      },
    ];

    for (const route of routeChecks) {
      const accessIndex = route.source.indexOf("assertReportAccess(ctx)");
      const rateLimitIndex = route.source.indexOf("assertRateLimit(ctx.req as any");
      const payloadIndex = route.source.indexOf("buildLeagueRankingsPayload(input.leagueId, forceRefresh)");

      expect(accessIndex, route.name).toBeGreaterThan(0);
      expect(rateLimitIndex, route.name).toBeGreaterThan(accessIndex);
      expect(payloadIndex, route.name).toBeGreaterThan(rateLimitIndex);
      expect(route.source, route.name).toContain(`id: '${route.rateLimitId}'`);
      if (route.detailMarker) {
        expect(route.source.indexOf(route.detailMarker), route.name).toBeGreaterThan(payloadIndex);
      }
    }
  });

  it("keeps player headshot provider work bounded behind cache and rate limits", () => {
    const headshotSource = extractSource("playerHeadshot: publicProcedure", "\n  }),\n});");
    const imageCacheWriteSource = extractSourceFrom(imageProxySource, "function setCachedImage", "\n\n/**\n * Fetch a player headshot");
    const missCacheWriteSource = extractSourceFrom(imageProxySource, "function setImageMiss", "\n\nfunction setCachedImage");
    const cacheIndex = headshotSource.indexOf("getCachedImage(input.playerId)");
    const rateLimitIndex = headshotSource.indexOf("assertRateLimit(ctx.req as any");
    const fetchIndex = headshotSource.indexOf("fetchPlayerHeadshot(input.playerId)");
    const prospectIndex = headshotSource.indexOf("loadProspectContext()");

    expect(headshotSource).toContain("playerId: z.string().trim().min(1).max(64)");
    expect(headshotSource).toContain("playerName: z.string().trim().max(120)");
    expect(headshotSource).toContain("position: z.string().trim().max(16)");
    expect(cacheIndex).toBeGreaterThan(0);
    expect(rateLimitIndex).toBeGreaterThan(cacheIndex);
    expect(fetchIndex).toBeGreaterThan(rateLimitIndex);
    expect(prospectIndex).toBeGreaterThan(rateLimitIndex);
    expect(headshotSource).toContain("id: 'images.playerHeadshot'");
    expect(imageProxySource).toContain("const IMAGE_CACHE_MAX_ITEMS = 300");
    expect(imageProxySource).toContain("const IMAGE_MISS_CACHE_MAX_ITEMS = 1000");
    expect(imageCacheWriteSource).toContain("pruneImageCache()");
    expect(imageCacheWriteSource).toContain("IMAGE_CACHE.set(cacheKey");
    expect(missCacheWriteSource).toContain("pruneImageMissCache()");
    expect(missCacheWriteSource).toContain("IMAGE_MISS_CACHE.set(cacheKey");
    expect(imageProxySource).toContain("while (cache.size >= maxItems)");
  });

  it("routes user-load live fetches through the guarded wrapper", () => {
    const liveUrlSources = [routersSource, draftAnalysisSource].join("\n");
    const urls = Array.from(liveUrlSources.matchAll(/https:\/\/[^`'")\s]+/g), (match) => match[0]);

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => ["api.sleeper.app", "api.sleeper.com", "sleepercdn.com"].includes(new URL(url).hostname))).toBe(true);
    expect(routersSource).not.toMatch(/(?<!UserLoadResponse\()fetch\(/);
    expect(draftAnalysisSource).not.toMatch(/(?<!UserLoadJson\()fetch\(/);
    expect(draftAnalysisSource).toContain("fetchUserLoadJson<any[]>(");
  });
});
