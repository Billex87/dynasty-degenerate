import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const routersPath = path.resolve(__dirname, "routers.ts");
const routersSource = fs.readFileSync(routersPath, "utf8");

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
    expect(urls.every((url) => ["api.sleeper.app", "api.sleeper.com"].includes(new URL(url).hostname))).toBe(true);
    expect(analyzeSource).toContain("loadBlendedKTCValues(leagueValueOptions, getUserLoadSnapshotOptions())");
    expect(analyzeSource).toContain("loadDraftSharksScheduleContext({");
    expect(analyzeSource).toContain("...getUserLoadSnapshotOptions()");
    expect(analyzeSource).toContain("fetchFantasyProsNews(getUserLoadSnapshotOptions())");
    expect(analyzeSource).toContain("fetchEspnDepthChartsForPlayersWithDiagnostics(detailPlayerIds, players, getUserLoadSnapshotOptions())");
  });

  it("keeps ranking and player-detail non-Sleeper enrichments snapshot-only", () => {
    expect(routersSource).toContain("loadBlendedKTCValues(leagueValueOptions, getUserLoadSnapshotOptions())");
    expect(routersSource).toContain("leagueValueCache.set(key, loadBlendedKTCValues(options, getUserLoadSnapshotOptions()))");
    expect(routersSource).toContain("fetchFantasyProsLatestPlayerNews({");
    expect(routersSource).toContain("...getUserLoadSnapshotOptions()");
    expect(routersSource).not.toContain("sourceMode: 'live'");
    expect(routersSource).not.toContain('sourceMode: "live"');
  });
});
