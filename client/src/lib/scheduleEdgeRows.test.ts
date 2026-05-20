import { describe, expect, it } from "vitest";
import {
  buildScheduleEdgeRows,
  buildScheduleSnapshotHealthRows,
  formatScheduleEdgeValue,
} from "./scheduleEdgeRows";
import type {
  ReportData,
  TrendingPlayer,
  WaiverSourceTraceEntry,
  WaiverWeeklyEcrSignal,
  WaiverWeeklyEcrTarget,
} from "@shared/types";

const NOW = Date.parse("2026-09-09T18:00:00.000Z");

function makePlayer(
  overrides: Partial<TrendingPlayer> & Pick<TrendingPlayer, "player_id" | "name">
): TrendingPlayer {
  return {
    player_id: overrides.player_id,
    name: overrides.name,
    pos: overrides.pos || "WR",
    team: overrides.team ?? "BUF",
    count: overrides.count ?? 0,
    ktcValue: overrides.ktcValue ?? 1200,
    currentPositionRank: overrides.currentPositionRank ?? null,
    owner: overrides.owner ?? null,
    weeklyEcr: overrides.weeklyEcr ?? null,
  };
}

function makeTrace(
  overrides: Partial<WaiverSourceTraceEntry> = {}
): WaiverSourceTraceEntry {
  return {
    source: "FantasyPros",
    sourceKey: overrides.sourceKey || "fantasypros-endpoint-v1:2026:PPR:test",
    endpointKey: overrides.endpointKey || "fantasypros-weekly-rank-test",
    endpointLabel: overrides.endpointLabel || "Weekly rank test",
    status: overrides.status || "loaded",
    season: overrides.season || "2026",
    scoring: overrides.scoring || "PPR",
    week: overrides.week ?? 2,
    position: overrides.position || "WR",
    rowCount: overrides.rowCount ?? 120,
    fetchedAt: overrides.fetchedAt || "2026-09-08T18:00:00.000Z",
    lastUpdated: overrides.lastUpdated || "2026-09-08T18:00:00.000Z",
    evidence: overrides.evidence || "test",
  };
}

function makeSignal(
  overrides: Partial<WaiverWeeklyEcrSignal> = {}
): WaiverWeeklyEcrSignal {
  const position = overrides.position || "WR";
  const name = overrides.name || "Schedule Receiver";
  const playerId = overrides.playerId || "player-1";
  const bestRankEcr = overrides.bestRankEcr ?? 18;
  const bestWeek = overrides.bestWeek ?? 2;
  const bestPositionRank = Object.prototype.hasOwnProperty.call(
    overrides,
    "bestPositionRank"
  )
    ? overrides.bestPositionRank ?? null
    : `${position}${bestRankEcr}`;

  return {
    playerId,
    fantasyProsId: overrides.fantasyProsId ?? null,
    name,
    position,
    team: overrides.team ?? "BUF",
    source: "FantasyPros",
    updatedAt: overrides.updatedAt ?? "2026-09-08T18:00:00.000Z",
    weeks:
      overrides.weeks ||
      [
        {
          week: bestWeek,
          rankEcr: bestRankEcr,
          positionRank: bestPositionRank,
          bestRank: null,
          worstRank: null,
          averageRank: null,
          rankStdDev: null,
          lastUpdated: "2026-09-08T18:00:00.000Z",
          fetchedAt: "2026-09-08T18:00:00.000Z",
          sourceStatus: "loaded",
        },
      ],
    bestWeek,
    bestRankEcr,
    bestPositionRank,
    averageRankEcr: overrides.averageRankEcr ?? bestRankEcr,
    rankDelta: overrides.rankDelta ?? null,
    confidence: overrides.confidence ?? 80,
    note: overrides.note || `W${bestWeek} ${position}${bestRankEcr}`,
    sourceTrace: overrides.sourceTrace || [makeTrace({ position })],
    traceSummary: overrides.traceSummary || `W${bestWeek}`,
  };
}

function makeReport(
  waiver: Partial<NonNullable<ReportData["waiverIntelligence"]>>
): ReportData {
  return {
    waiverIntelligence: {
      rosteredTrendingAdds: [],
      availableTrendingAdds: [],
      highestKtcAvailable: null,
      bestAvailableByPosition: {
        QB: null,
        RB: null,
        WR: null,
        TE: null,
        K: null,
        DEF: null,
      },
      bestTaxiStashes: [],
      recentlyDroppedValuable: [],
      weeklyEcrTargets: [],
      omittedCandidates: [],
      ...waiver,
    },
  } as ReportData;
}

function makeReportWithScheduleTargets(
  scheduleEdgeTargets: WaiverWeeklyEcrTarget[]
): ReportData {
  return { scheduleEdgeTargets } as ReportData;
}

describe("schedule edge rows", () => {
  it("builds rank-first rows without exposing ECR copy in the table values", () => {
    const signal = makeSignal({
      playerId: "dst-1",
      name: "Bills Defense",
      position: "DST",
      bestRankEcr: 3,
      bestPositionRank: null,
      weeks: [
        {
          week: 2,
          rankEcr: 3,
          positionRank: null,
          bestRank: null,
          worstRank: null,
          averageRank: null,
          rankStdDev: null,
          lastUpdated: "2026-09-08T18:00:00.000Z",
        },
      ],
      sourceTrace: [makeTrace({ position: "DST" })],
    });
    const report = makeReport({
      weeklyEcrTargets: [
        {
          player: makePlayer({
            player_id: "dst-1",
            name: "Bills Defense",
            pos: "DST",
            ktcValue: 1500,
          }),
          signal,
          score: 90,
        },
      ],
    });

    const [row] = buildScheduleEdgeRows(report, { now: NOW });

    expect(row.position).toBe("DEF");
    expect(row.bestRank).toBe("Rank 3");
    expect(row.window).toContain("W2 Rank 3");
    expect(row.window).not.toContain("ECR");
    expect(row.action).toBe("Streamer target");
    expect(row.sourceTone).toBe("good");
  });

  it("can build admin schedule rows from report-level snapshot targets", () => {
    const signal = makeSignal({
      playerId: "fantasypros:9016",
      fantasyProsId: "9016",
      name: "Snapshot Quarterback",
      position: "QB",
      bestPositionRank: "QB4",
      bestRankEcr: 4,
    });
    const rows = buildScheduleEdgeRows(
      makeReportWithScheduleTargets([
        {
          player: makePlayer({
            player_id: "fantasypros:9016",
            name: "Snapshot Quarterback",
            pos: "QB",
            ktcValue: null,
          }),
          signal,
          score: 80,
        },
      ]),
      { now: NOW }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("fantasypros:9016");
    expect(rows[0].bestRank).toBe("QB4");
    expect(rows[0].sourceTone).toBe("good");
  });

  it("summarizes weekly snapshot health by week and position", () => {
    const rows = buildScheduleSnapshotHealthRows({
      sourceSnapshotDiagnostics: [
        {
          sourceKey:
            "fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr-qb-week-1",
          source: "FantasyPros weekly ECR QB Week 1 endpoint snapshot",
          tableName: "providerDataSnapshots",
          snapshotKey: "latest",
          updatedAt: "2026-09-08T18:00:00.000Z",
          ageHours: 12,
          payloadSizeBytes: 1200,
          rowCount: 51,
          status: "loaded",
          level: "info",
          note: "loaded",
        },
        {
          sourceKey:
            "fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr-rb-week-2",
          source: "FantasyPros weekly ECR RB Week 2 endpoint snapshot",
          tableName: "providerDataSnapshots",
          snapshotKey: "latest",
          updatedAt: "2026-09-08T18:00:00.000Z",
          ageHours: 12,
          payloadSizeBytes: 1200,
          rowCount: 0,
          status: "loaded",
          level: "info",
          note: "empty",
        },
        {
          sourceKey:
            "fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr-wr-week-3",
          source: "FantasyPros weekly ECR WR Week 3 endpoint snapshot",
          tableName: "providerDataSnapshots",
          snapshotKey: null,
          updatedAt: null,
          ageHours: null,
          payloadSizeBytes: null,
          rowCount: null,
          status: "missing",
          level: "warn",
          note: "missing",
          lastHealthStatus: "rate_limited",
          lastHealthMessage: "Too Many Requests",
        },
      ],
    } as ReportData);

    expect(rows).toHaveLength(3);
    expect(rows[0].cells.QB).toMatchObject({
      label: "Loaded",
      tone: "good",
      rowCount: 51,
    });
    expect(rows[1].cells.RB).toMatchObject({
      label: "No rows yet",
      tone: "info",
      rowCount: 0,
    });
    expect(rows[2].cells.WR).toMatchObject({
      label: "Rate limited",
      tone: "danger",
    });
  });

  it("includes attached waiver candidates and sorts target score before rank", () => {
    const highScoreSignal = makeSignal({
      playerId: "target-hi",
      name: "Priority Receiver",
      bestPositionRank: "WR30",
      bestRankEcr: 30,
    });
    const lowScoreSignal = makeSignal({
      playerId: "target-low",
      name: "Secondary Receiver",
      bestPositionRank: "WR12",
      bestRankEcr: 12,
    });
    const attachedSignal = makeSignal({
      playerId: "attached",
      name: "Available Tight End",
      position: "TE",
      bestPositionRank: "TE12",
      bestRankEcr: 12,
    });
    const report = makeReport({
      weeklyEcrTargets: [
        {
          player: makePlayer({
            player_id: "target-low",
            name: "Secondary Receiver",
            ktcValue: 1100,
          }),
          signal: lowScoreSignal,
          score: 40,
        },
        {
          player: makePlayer({
            player_id: "target-hi",
            name: "Priority Receiver",
            ktcValue: 1400,
          }),
          signal: highScoreSignal,
          score: 70,
        },
      ],
      availableTrendingAdds: [
        makePlayer({
          player_id: "attached",
          name: "Available Tight End",
          pos: "TE",
          ktcValue: 900,
          weeklyEcr: attachedSignal,
        }),
      ],
    });

    const rows = buildScheduleEdgeRows(report, { now: NOW });

    expect(rows.map(row => row.id)).toEqual([
      "target-hi",
      "target-low",
      "attached",
    ]);
    expect(rows.find(row => row.id === "attached")?.action).toBe("Depth option");
  });

  it("flags stale and partial source traces", () => {
    const staleRows = buildScheduleEdgeRows(
      makeReport({
        weeklyEcrTargets: [
          {
            player: makePlayer({ player_id: "stale", name: "Stale Runner" }),
            signal: makeSignal({
              playerId: "stale",
              name: "Stale Runner",
              sourceTrace: [
                makeTrace({
                  fetchedAt: "2026-08-25T18:00:00.000Z",
                  lastUpdated: "2026-08-25T18:00:00.000Z",
                }),
              ],
            }),
            score: 50,
          },
        ],
      }),
      { now: NOW }
    );
    const partialRows = buildScheduleEdgeRows(
      makeReport({
        weeklyEcrTargets: [
          {
            player: makePlayer({ player_id: "partial", name: "Partial Runner" }),
            signal: makeSignal({
              playerId: "partial",
              name: "Partial Runner",
              sourceTrace: [makeTrace({ status: "missing", rowCount: 0 })],
            }),
            score: 50,
          },
        ],
      }),
      { now: NOW }
    );

    expect(staleRows[0].sourceFreshness).toMatch(/^Stale - /);
    expect(staleRows[0].sourceTone).toBe("warn");
    expect(partialRows[0].sourceFreshness).toMatch(/^Partial - /);
    expect(partialRows[0].sourceTone).toBe("warn");
  });

  it("uses the newest parseable source timestamp for freshness", () => {
    const [row] = buildScheduleEdgeRows(
      makeReport({
        weeklyEcrTargets: [
          {
            player: makePlayer({ player_id: "fresh", name: "Fresh Runner" }),
            signal: makeSignal({
              playerId: "fresh",
              name: "Fresh Runner",
              sourceTrace: [
                makeTrace({
                  fetchedAt: "2026-09-08T18:00:00.000Z",
                  lastUpdated: "5/18",
                }),
              ],
            }),
            score: 50,
          },
        ],
      }),
      { now: NOW }
    );

    expect(row.sourceFreshness).toMatch(/^Fresh - /);
    expect(row.sourceTone).toBe("good");
  });

  it("formats source values compactly", () => {
    expect(formatScheduleEdgeValue(1728)).toBe("1.7K");
    expect(formatScheduleEdgeValue(640)).toBe("640");
    expect(formatScheduleEdgeValue(null)).toBe("-");
  });
});
