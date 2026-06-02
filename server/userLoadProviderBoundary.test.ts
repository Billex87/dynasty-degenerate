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

function extractSource(startMarker: string, endMarker: string): string {
  const start = routersSource.indexOf(startMarker);
  const end = routersSource.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routersSource.slice(start, end);
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

  it("keeps user league-rank fanout bounded and rate-limited", () => {
    const leagueRanksSource = extractSource("getUserLeagueRanks: publicProcedure", "\n    importSleeperTradeCenter: publicProcedure");
    const rateLimitIndex = leagueRanksSource.indexOf("assertRateLimit(ctx.req as any");
    const playerIndexFetch = leagueRanksSource.indexOf("fetchSleeperPlayersIndex()");
    const leagueFetchIndex = leagueRanksSource.indexOf("fetchSleeperJson<any>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}`)");
    const rostersFetchIndex = leagueRanksSource.indexOf("fetchSleeperJson<any[]>(`https://api.sleeper.app/v1/league/${normalizedLeagueId}/rosters`)");

    expect(leagueRanksSource).toContain("leagueIds: z.array(sleeperLeagueIdSchema).max(10)");
    expect(routersSource).toContain("const LEAGUE_RANK_FANOUT_CONCURRENCY = 3");
    expect(leagueRanksSource).toContain("mapWithConcurrencyLimit(leagueIds, LEAGUE_RANK_FANOUT_CONCURRENCY");
    expect(leagueRanksSource).not.toContain("Promise.all(leagueIds.map");
    expect(rateLimitIndex).toBeGreaterThan(0);
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

  it("keeps player headshot provider work bounded behind cache and rate limits", () => {
    const headshotSource = extractSource("playerHeadshot: publicProcedure", "\n  }),\n});");
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
