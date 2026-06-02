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
