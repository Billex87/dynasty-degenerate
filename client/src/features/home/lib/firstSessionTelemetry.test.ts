import { describe, expect, it } from "vitest";

import {
  getActiveTabBucket,
  getElapsedMsBucket,
  getLeagueCountBucket,
  getReportModeBucket,
  getViewportBucket,
  sanitizeFirstSessionFunnelProperties,
} from "@/features/home/lib/firstSessionTelemetry";
import type { ReportData } from "@shared/types";

describe("first-session telemetry", () => {
  it("drops private identifiers and only keeps allowlisted public buckets", () => {
    const sanitized = sanitizeFirstSessionFunnelProperties({
      entryMethod: "username",
      viewport: "desktop",
      leagueCountBucket: "4-7",
      reportMode: "dynasty",
      leagueId: "123456789",
      leagueName: "Private League",
      username: "private-user",
      managerName: "Private Manager",
      playerName: "Private Player",
      providerName: "Provider Name",
    });

    expect(sanitized).toEqual({
      entryMethod: "username",
      viewport: "desktop",
      leagueCountBucket: "4-7",
      reportMode: "dynasty",
    });
    expect(JSON.stringify(sanitized)).not.toMatch(
      /123456789|Private League|private-user|Private Manager|Private Player|Provider Name/
    );
  });

  it("buckets viewport, league count, elapsed time, and active tab values", () => {
    expect(getViewportBucket(390)).toBe("mobile");
    expect(getViewportBucket(820)).toBe("tablet");
    expect(getViewportBucket(1280)).toBe("desktop");

    expect(getLeagueCountBucket(0)).toBe("0");
    expect(getLeagueCountBucket(1)).toBe("1");
    expect(getLeagueCountBucket(3)).toBe("2-3");
    expect(getLeagueCountBucket(7)).toBe("4-7");
    expect(getLeagueCountBucket(8)).toBe("8+");

    expect(getElapsedMsBucket(999)).toBe("<1s");
    expect(getElapsedMsBucket(2_999)).toBe("1-3s");
    expect(getElapsedMsBucket(9_999)).toBe("3-10s");
    expect(getElapsedMsBucket(29_999)).toBe("10-30s");
    expect(getElapsedMsBucket(30_000)).toBe("30s+");
    expect(getElapsedMsBucket(Number.NaN)).toBe("unknown");

    expect(getActiveTabBucket("overview")).toBe("overview");
    expect(getActiveTabBucket("autopilot")).toBe("other");
    expect(getActiveTabBucket(undefined)).toBeUndefined();
  });

  it("buckets report mode without requiring private league identity", () => {
    expect(getReportModeBucket()).toBe("unknown");
    expect(
      getReportModeBucket({
        leagueValueMode: "redraft",
      } as ReportData)
    ).toBe("redraft");
    expect(
      getReportModeBucket({
        leagueDiagnostics: {
          valueMode: "dynasty",
        },
      } as ReportData)
    ).toBe("dynasty");
  });
});
