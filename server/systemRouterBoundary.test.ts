import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const systemRouterPath = path.resolve(process.cwd(), "server/_core/systemRouter.ts");
const systemRouterSource = fs.readFileSync(systemRouterPath, "utf8");

function extractSource(startMarker: string, endMarker: string): string {
  const start = systemRouterSource.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = systemRouterSource.indexOf(endMarker, start);
  expect(end).toBeGreaterThan(start);
  return systemRouterSource.slice(start, end);
}

describe("system router boundary", () => {
  it("keeps only the lightweight health probe public", () => {
    const healthSource = extractSource("health: publicProcedure", "\n\n  snapshotCoverage:");
    const snapshotCoverageSource = extractSource("snapshotCoverage: adminProcedure", "\n\n  abuseTelemetry:");

    expect(healthSource).toContain("ok: true");
    expect(healthSource).not.toContain("listKtcSnapshotDateKeysSince");
    expect(snapshotCoverageSource).toContain("listKtcSnapshotDateKeysSince(start)");
    expect(snapshotCoverageSource).toContain("listLocalKtcSnapshotDateKeysSince(start)");
  });

  it("keeps admin diagnostic routes behind bounded route limits", () => {
    const pruneSource = extractSource("function pruneSystemAdminRateLimitBuckets", "\n\nfunction assertSystemAdminDiagnosticsRateLimit");
    const guardSource = extractSource("function assertSystemAdminDiagnosticsRateLimit", "\n\nfunction shiftDateByDays");
    const routeChecks = [
      {
        name: "snapshotCoverage",
        source: extractSource("snapshotCoverage: adminProcedure", "\n\n  abuseTelemetry:"),
        rateLimitId: "system.snapshotCoverage",
        workMarkers: ["getSnapshotStatusRange(input.lookbackDays)", "listKtcSnapshotDateKeysSince(start)"],
      },
      {
        name: "abuseTelemetry",
        source: extractSource("abuseTelemetry: adminProcedure", "\n\n  sourceHealth:"),
        rateLimitId: "system.abuseTelemetry",
        workMarkers: ["const since = new Date", "getLoginAttemptsSince(since)"],
      },
      {
        name: "sourceHealth",
        source: extractSource("sourceHealth: adminProcedure", "\n\n  billingOverview:"),
        rateLimitId: "system.sourceHealth",
        workMarkers: ["const since = new Date", "listSourceHealthEventsSince(since, 100)"],
      },
      {
        name: "billingOverview",
        source: extractSource("billingOverview: adminProcedure", "\n\n  sourceCoverageMatrix:"),
        rateLimitId: "system.billingOverview",
        workMarkers: ["const usageSince = new Date", "getAdminBillingOverview({"],
      },
      {
        name: "sourceCoverageMatrix",
        source: extractSource("sourceCoverageMatrix: adminProcedure", "\n\n  apiProviderTelemetry:"),
        rateLimitId: "system.sourceCoverageMatrix",
        workMarkers: ["const previousSeason = String", "loadSourceSnapshotFreshnessDiagnostics({", "listSourceHealthEventsSince(since, 300)"],
      },
      {
        name: "apiProviderTelemetry",
        source: extractSource("apiProviderTelemetry: adminProcedure", "\n\n  aiCalibration:"),
        rateLimitId: "system.apiProviderTelemetry",
        workMarkers: ["getApiProviderTelemetrySnapshot({"],
      },
      {
        name: "aiCalibration",
        source: extractSource("aiCalibration: adminProcedure", "\n\n  markAiPredictionOutcome:"),
        rateLimitId: "system.aiCalibration",
        workMarkers: ["listAiPredictionEvents({", "summarizeAIPredictionReliability(events)"],
      },
      {
        name: "markAiPredictionOutcome",
        source: extractSource("markAiPredictionOutcome: adminProcedure", "\n\n  resolveAiPredictionOutcomes:"),
        rateLimitId: "system.markAiPredictionOutcome",
        workMarkers: ["const statusNote = input.note", "updateAiPredictionOutcome({"],
      },
      {
        name: "resolveAiPredictionOutcomes",
        source: extractSource("resolveAiPredictionOutcomes: adminProcedure", "\n});"),
        rateLimitId: "system.resolveAiPredictionOutcomes",
        workMarkers: ["resolvePendingAIPredictionOutcomes({"],
      },
    ];

    expect(pruneSource).toContain("SYSTEM_ADMIN_RATE_LIMIT_BUCKET_MAX_ENTRIES");
    expect(pruneSource).toContain("systemAdminRateLimitBuckets.delete(oldestKey)");
    expect(guardSource).toContain("systemAdminRateLimitBuckets.set(key, bucket)");
    expect(guardSource).toContain('code: "TOO_MANY_REQUESTS"');

    for (const route of routeChecks) {
      const rateLimitIndex = route.source.indexOf(`assertSystemAdminDiagnosticsRateLimit(ctx, "${route.rateLimitId}")`);
      expect(rateLimitIndex, route.name).toBeGreaterThan(0);
      for (const marker of route.workMarkers) {
        expect(route.source.indexOf(marker), `${route.name}:${marker}`).toBeGreaterThan(rateLimitIndex);
      }
    }
  });
});
