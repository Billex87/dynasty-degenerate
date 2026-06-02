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
});
