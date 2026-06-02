import { describe, expect, it } from "vitest";
import type { ReportData } from "../shared/types";
import {
  sanitizeLeagueReportPayloadForPaidAccess,
  sanitizeReportDataForPaidAccess,
} from "./reportAccessSanitizer";

function createReportData(): ReportData {
  return {
    leagueDiagnostics: {
      aiConfidence: {
        score: 72,
        label: "Building",
        note: "League confidence note.",
        history: [{
          snapshotKey: "2026-06-02",
          generatedAt: "2026-06-02T00:00:00.000Z",
          score: 72,
          label: "Building",
        }],
        signals: [{
          key: "source-health",
          label: "Source health",
          score: 80,
          weight: 1,
          status: "strong",
          note: "Loaded.",
        }],
      },
    },
    waiverIntelligence: {
      weeklyEcrTargets: [{
        player: {
          player_id: "1",
          name: "Player One",
          pos: "WR",
          owner: "FA",
          val_now: 100,
        },
        score: 90,
        signal: {
          playerId: "1",
          fantasyProsId: "fp-1",
          name: "Player One",
          position: "WR",
          team: "BUF",
          source: "FantasyPros",
          updatedAt: "2026-06-02T00:00:00.000Z",
          weeks: [],
          bestWeek: null,
          bestRankEcr: null,
          bestPositionRank: null,
          averageRankEcr: null,
          rankDelta: null,
          confidence: 70,
          note: "Trace-backed waiver read.",
          sourceTrace: [{
            source: "FantasyPros",
            status: "loaded",
            evidence: "Stored endpoint snapshot.",
          }],
          sourceTraceText: ["Week 1 vs BUF from stored endpoint snapshot."],
          traceSummary: "FantasyPros weekly ECR source trace.",
        },
      }],
    },
    managerRosterValueGrowth: [],
    weeklyRisers: [],
    weeklyFallers: [],
    leagueOverview: [],
    projectedRisers: [],
    projectedFallers: [],
    tradeProfitLeaderboard: [],
    tradeHistory: [],
    positionDepth: [],
    managerPositionCounts: [],
    managerRosterIntelligence: [],
    draftPicks: [],
    draftStats: [],
    powerRankings: [],
    pickPortfolios: [],
    schedulePlanning: null,
    matchupPreviews: [],
    recentTransactions: [],
  } as unknown as ReportData;
}

describe("report access sanitizer", () => {
  it("removes source-trace details and AI confidence history without mutating the original report", () => {
    const report = createReportData();
    const result = sanitizeReportDataForPaidAccess(report, {
      canViewSourceTraceDetails: false,
      canViewAiConfidenceHistory: false,
    });

    expect(result.stats).toMatchObject({
      removedSourceTraceFields: 2,
      removedTraceSummaryFields: 1,
      removedAiConfidenceHistoryFields: 1,
      retainedSourceTraceFields: 0,
      retainedTraceSummaryFields: 0,
      retainedAiConfidenceHistoryFields: 0,
    });
    expect((result.payload as any).waiverIntelligence.weeklyEcrTargets[0].signal).not.toHaveProperty("sourceTrace");
    expect((result.payload as any).waiverIntelligence.weeklyEcrTargets[0].signal).not.toHaveProperty("sourceTraceText");
    expect((result.payload as any).waiverIntelligence.weeklyEcrTargets[0].signal).not.toHaveProperty("traceSummary");
    expect(result.payload.leagueDiagnostics?.aiConfidence).not.toHaveProperty("history");
    expect((report as any).waiverIntelligence.weeklyEcrTargets[0].signal.sourceTrace).toHaveLength(1);
    expect((report as any).waiverIntelligence.weeklyEcrTargets[0].signal.sourceTraceText).toHaveLength(1);
    expect(report.leagueDiagnostics?.aiConfidence?.history).toHaveLength(1);
  });

  it("preserves source traces and confidence history when access is allowed", () => {
    const report = createReportData();
    const result = sanitizeReportDataForPaidAccess(report, {
      canViewSourceTraceDetails: true,
      canViewAiConfidenceHistory: true,
    });

    expect(result.payload).toBe(report);
    expect(result.stats.removedSourceTraceFields).toBe(0);
    expect(result.stats.retainedSourceTraceFields).toBe(2);
    expect(result.stats.retainedTraceSummaryFields).toBe(1);
    expect(result.stats.retainedAiConfidenceHistoryFields).toBe(1);
    expect((result.payload as any).waiverIntelligence.weeklyEcrTargets[0].signal.sourceTrace).toHaveLength(1);
    expect((result.payload as any).waiverIntelligence.weeklyEcrTargets[0].signal.sourceTraceText).toHaveLength(1);
    expect(result.payload.leagueDiagnostics?.aiConfidence?.history).toHaveLength(1);
  });

  it("sanitizes cached league report payloads at the reportData boundary", () => {
    const payload = {
      leagueId: "123456789012345678",
      reportData: createReportData(),
    };
    const result = sanitizeLeagueReportPayloadForPaidAccess(payload, {
      canViewSourceTraceDetails: false,
      canViewAiConfidenceHistory: true,
    });

    expect(result.payload).not.toBe(payload);
    expect(result.payload.reportData).not.toBe(payload.reportData);
    expect((result.payload.reportData as any).waiverIntelligence.weeklyEcrTargets[0].signal).not.toHaveProperty("sourceTrace");
    expect((result.payload.reportData as any).waiverIntelligence.weeklyEcrTargets[0].signal).not.toHaveProperty("sourceTraceText");
    expect(result.payload.reportData.leagueDiagnostics?.aiConfidence?.history).toHaveLength(1);
  });
});
