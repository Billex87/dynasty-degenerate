import { describe, expect, it } from "vitest";
import {
  buildScheduleEdgeRows,
  buildScheduleSnapshotHealthRows,
  formatScheduleEdgeValue,
  getScheduleEdgeRangeAction,
  getScheduleEdgeRangeSummary,
  sortScheduleEdgeRows,
} from "./scheduleEdgeRows";
import { buildMatchupWindowSet } from "@shared/matchupWindows";
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
    playerDetails: overrides.playerDetails,
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
    source: overrides.source || "DraftSharks",
    sourceKey: overrides.sourceKey || "draftsharks-sos-v1",
    endpointKey: overrides.endpointKey || "draftsharks-sos-wr-week-2",
    endpointLabel: overrides.endpointLabel || "DraftSharks WR SOS Week 2",
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
    signalType: overrides.signalType || "draftsharks-sos",
    playerId,
    fantasyProsId: overrides.fantasyProsId ?? null,
    name,
    position,
    team: overrides.team ?? "BUF",
    source: overrides.source || "DraftSharks",
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
    bestMatchupStars: overrides.bestMatchupStars ?? null,
    bestOpponentRank: overrides.bestOpponentRank ?? null,
    matchupWindows: overrides.matchupWindows,
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

function withRosterOwnershipMap(report: ReportData): ReportData {
  return {
    ...report,
    managerPositionCounts: [
      {
        manager: "Roster Manager",
        QB: 0,
        QB_starters: 0,
        RB: 0,
        RB_starters: 0,
        WR: 1,
        WR_starters: 0,
        TE: 0,
        TE_starters: 0,
        K: 0,
        K_starters: 0,
        DEF: 0,
        DEF_starters: 0,
        rosterPlayers: [
          {
            player_id: "unrelated-roster-player",
            name: "Unrelated Roster Player",
            pos: "WR",
            value: 1000,
            playerDetails: { team: "DAL" },
          },
        ],
        lineupPlayers: [],
        starterPlayers: [],
      },
    ],
  } as ReportData;
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
          opponent: "NYJ",
          homeAway: "home",
          opponentRank: 4,
          matchupStars: 5,
          matchupTier: "easy",
          isBye: false,
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
    report.managerPositionCounts = [
      {
        manager: "Roster Manager",
        QB: 0,
        QB_starters: 0,
        RB: 0,
        RB_starters: 0,
        WR: 0,
        WR_starters: 0,
        TE: 0,
        TE_starters: 0,
        K: 0,
        K_starters: 0,
        DEF: 1,
        DEF_starters: 1,
        rosterPlayers: [
          {
            player_id: "other-defense",
            name: "Other Defense",
            pos: "DEF",
            value: 0,
            playerDetails: { team: "NYG" },
          },
        ],
        lineupPlayers: [],
        starterPlayers: [],
      },
    ];

    const [row] = buildScheduleEdgeRows(report, { now: NOW });

    expect(row.position).toBe("DEF");
    expect(row.bestRank).toBe("Rank 3");
    expect(row.seasonRank).toBeNull();
    expect(row.seasonRankNumber).toBe(3);
    expect(row.window).toContain("W2 vs. NYJ 5-star");
    expect(row.window).not.toContain("ECR");
    expect(row.action).toBe("Streamer target");
    expect(row.sourceTone).toBe("good");
    expect(row.evidenceRead.canAct).toBe(true);
    expect(row.decisionLabel).toBe("Review this");
  });

  it("excludes FantasyPros weekly rank rows from Schedule Edge", () => {
    const weeklyRankSignal = makeSignal({
      playerId: "fp-rank-1",
      name: "Weekly Rank Receiver",
      source: "FantasyPros",
      signalType: "weekly-rank",
      sourceTrace: [
        makeTrace({
          source: "FantasyPros",
          sourceKey: "fantasypros-weekly-ecr-wr-week-2",
          endpointKey: "fantasypros-weekly-ecr-wr-week-2",
          endpointLabel: "FantasyPros WR Weekly ECR Week 2",
        }),
      ],
    });
    const mislabeledRankSignal = makeSignal({
      playerId: "fp-rank-2",
      name: "Mislabeled Rank Receiver",
      source: "FantasyPros",
      signalType: "draftsharks-sos",
      sourceTrace: [
        makeTrace({
          source: "FantasyPros",
          sourceKey: "fantasypros-weekly-ecr-wr-week-3",
          endpointKey: "fantasypros-weekly-ecr-wr-week-3",
          endpointLabel: "FantasyPros WR Weekly ECR Week 3",
        }),
      ],
    });
    const report = makeReport({
      weeklyEcrTargets: [
        {
          player: makePlayer({
            player_id: "fp-rank-1",
            name: "Weekly Rank Receiver",
          }),
          signal: weeklyRankSignal,
          score: 80,
        },
        {
          player: makePlayer({
            player_id: "fp-rank-2",
            name: "Mislabeled Rank Receiver",
          }),
          signal: mislabeledRankSignal,
          score: 85,
        },
      ],
    });

    expect(buildScheduleEdgeRows(report, { now: NOW })).toEqual([]);
  });

  it("uses current-season redraft rank for matchup calendar rows in dynasty reports", () => {
    const seasonRankedSignal = makeSignal({
      playerId: "season-rank-receiver",
      name: "Season Rank Receiver",
      position: "WR",
      bestPositionRank: "WR64",
      bestRankEcr: 64,
    });
    const dynastyRankedSignal = makeSignal({
      playerId: "dynasty-rank-receiver",
      name: "Dynasty Rank Receiver",
      position: "WR",
      bestPositionRank: "WR14",
      bestRankEcr: 14,
    });
    const report = makeReportWithScheduleTargets([
      {
        player: makePlayer({
          player_id: "season-rank-receiver",
          name: "Season Rank Receiver",
          pos: "WR",
          currentPositionRank: "WR90",
          playerDetails: {
            valueProfile: {
              dynastyPositionRank: "WR90",
              seasonPositionRank: "WR8",
            },
          } as TrendingPlayer["playerDetails"],
        }),
        signal: seasonRankedSignal,
        score: 70,
      },
      {
        player: makePlayer({
          player_id: "dynasty-rank-receiver",
          name: "Dynasty Rank Receiver",
          pos: "WR",
          currentPositionRank: "WR2",
          playerDetails: {
            valueProfile: {
              dynastyPositionRank: "WR2",
              seasonPositionRank: "WR42",
            },
          } as TrendingPlayer["playerDetails"],
        }),
        signal: dynastyRankedSignal,
        score: 82,
      },
    ]);
    report.leagueValueMode = "dynasty";

    const rows = buildScheduleEdgeRows(report, { now: NOW });
    const seasonRankRow = rows.find(row => row.id === "season-rank-receiver")!;
    const dynastyRankRow = rows.find(row => row.id === "dynasty-rank-receiver")!;

    expect(seasonRankRow.seasonRank).toBe("WR8");
    expect(seasonRankRow.currentRank).toBe("WR8");
    expect(dynastyRankRow.seasonRank).toBe("WR42");
    expect(
      sortScheduleEdgeRows(rows, { start: 1, end: 3 }, "rank")[0].id
    ).toBe("season-rank-receiver");
  });

  it("warns on special teams with a rough next-three matchup window", () => {
    const weeks: WaiverWeeklyEcrSignal["weeks"] = [
      {
        week: 1,
        rankEcr: 4,
        positionRank: "DST4",
        bestRank: null,
        worstRank: null,
        averageRank: 4,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "SF",
        homeAway: "home",
        opponentRank: 28,
        matchupStars: 1,
        matchupTier: "hard",
        isBye: false,
      },
      {
        week: 2,
        rankEcr: 4,
        positionRank: "DST4",
        bestRank: null,
        worstRank: null,
        averageRank: 4,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "NYG",
        homeAway: "home",
        opponentRank: 13,
        matchupStars: 3,
        matchupTier: "neutral",
        isBye: false,
      },
      {
        week: 3,
        rankEcr: 4,
        positionRank: "DST4",
        bestRank: null,
        worstRank: null,
        averageRank: 4,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "DEN",
        homeAway: "away",
        opponentRank: 22,
        matchupStars: 2,
        matchupTier: "hard",
        isBye: false,
      },
    ];
    const signal = makeSignal({
      signalType: "draftsharks-sos",
      playerId: "rams",
      name: "Los Angeles Rams",
      position: "DST",
      bestRankEcr: 4,
      bestPositionRank: "DST4",
      weeks,
      matchupWindows: buildMatchupWindowSet(weeks, { currentWeek: 1 }),
      sourceTrace: [makeTrace({ position: "DST" })],
    });
    const [row] = buildScheduleEdgeRows(
      makeReportWithScheduleTargets([
        {
          player: makePlayer({
            player_id: "rams",
            name: "Los Angeles Rams",
            pos: "DST",
            ktcValue: 340,
          }),
          signal,
          score: 30,
        },
      ]),
      { now: NOW }
    );

    expect(row.action).toBe("Avoid early stream");
    expect(row.actionTone).toBe("warn");
    expect(row.evidenceRead.canAct).toBe(false);
    expect(row.evidenceRead.finalScore).toBeLessThanOrEqual(52);
    expect(row.evidenceRead.confidenceCapReason).toBe("Rough early schedule");
    expect(row.decisionLabel).toBe("Don't force it");
  });

  it("caps streamer confidence when DraftSharks schedule data is missing", () => {
    const signal = makeSignal({
      playerId: "rank-only-kicker",
      name: "Rank Only Kicker",
      position: "K",
      bestRankEcr: 4,
      bestPositionRank: "K4",
      weeks: [
        {
          week: 1,
          rankEcr: 4,
          positionRank: "K4",
          bestRank: null,
          worstRank: null,
          averageRank: 4,
          rankStdDev: null,
          lastUpdated: "2026-09-08T18:00:00.000Z",
          fetchedAt: "2026-09-08T18:00:00.000Z",
          sourceStatus: "loaded",
        },
      ],
      sourceTrace: [makeTrace({ position: "K" })],
    });
    const [row] = buildScheduleEdgeRows(
      withRosterOwnershipMap(
        makeReportWithScheduleTargets([
          {
            player: makePlayer({
              player_id: "rank-only-kicker",
              name: "Rank Only Kicker",
              pos: "K",
              team: "BUF",
              ktcValue: 220,
            }),
            signal,
            score: 93,
          },
        ])
      ),
      { now: NOW }
    );

    expect(row.evidenceRead.canAct).toBe(false);
    expect(row.evidenceRead.confidenceCap).toBe(56);
    expect(row.evidenceRead.confidenceCapReason).toBe("Missing schedule data");
    expect(row.evidenceRead.missingEvidence.join(" ")).toContain(
      "No opponent or schedule-strength data"
    );
    expect(row.decisionLabel).toBe("Don't force it");
  });

  it("summarizes and sorts rows by the selected week range", () => {
    const easyWeeks: WaiverWeeklyEcrSignal["weeks"] = [
      {
        week: 1,
        rankEcr: 12,
        positionRank: "DEF12",
        bestRank: null,
        worstRank: null,
        averageRank: 12,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "TEN",
        homeAway: "home",
        opponentRank: 3,
        matchupStars: 5,
        matchupTier: "easy",
        isBye: false,
      },
      {
        week: 2,
        rankEcr: 12,
        positionRank: "DEF12",
        bestRank: null,
        worstRank: null,
        averageRank: 12,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "CLE",
        homeAway: "away",
        opponentRank: 6,
        matchupStars: 4,
        matchupTier: "easy",
        isBye: false,
      },
    ];
    const hardWeeks: WaiverWeeklyEcrSignal["weeks"] = [
      {
        week: 1,
        rankEcr: 2,
        positionRank: "DEF2",
        bestRank: null,
        worstRank: null,
        averageRank: 2,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "KC",
        homeAway: "home",
        opponentRank: 32,
        matchupStars: 1,
        matchupTier: "hard",
        isBye: false,
      },
      {
        week: 2,
        rankEcr: 2,
        positionRank: "DEF2",
        bestRank: null,
        worstRank: null,
        averageRank: 2,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "BUF",
        homeAway: "away",
        opponentRank: 29,
        matchupStars: 2,
        matchupTier: "hard",
        isBye: false,
      },
    ];
    const rows = buildScheduleEdgeRows(
      makeReportWithScheduleTargets([
        {
          player: makePlayer({
            player_id: "easy-defense",
            name: "Easy Defense",
            pos: "DEF",
          }),
          signal: makeSignal({
            signalType: "draftsharks-sos",
            playerId: "easy-defense",
            name: "Easy Defense",
            position: "DEF",
            bestRankEcr: 12,
            bestPositionRank: "DEF12",
            weeks: easyWeeks,
          }),
          score: 20,
        },
        {
          player: makePlayer({
            player_id: "hard-defense",
            name: "Hard Defense",
            pos: "DEF",
          }),
          signal: makeSignal({
            signalType: "draftsharks-sos",
            playerId: "hard-defense",
            name: "Hard Defense",
            position: "DEF",
            bestRankEcr: 2,
            bestPositionRank: "DEF2",
            weeks: hardWeeks,
          }),
          score: 30,
        },
      ]),
      { now: NOW }
    );

    const range = { start: 1, end: 2 };
    const easyRow = rows.find(row => row.id === "easy-defense")!;
    const hardRow = rows.find(row => row.id === "hard-defense")!;

    expect(getScheduleEdgeRangeSummary(easyRow, range)).toMatchObject({
      averageStars: 4.5,
      easyWeeks: 2,
      hardWeeks: 0,
    });
    expect(getScheduleEdgeRangeAction(hardRow, range)).toEqual({
      action: "Avoid window",
      actionTone: "warn",
    });
    expect(sortScheduleEdgeRows(rows, range, "easiest")[0].id).toBe(
      "easy-defense"
    );
    expect(sortScheduleEdgeRows(rows, range, "toughest")[0].id).toBe(
      "hard-defense"
    );
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

  it("resolves source-only matchup rows against league roster ownership", () => {
    const signal = makeSignal({
      playerId: "fantasypros:hou",
      fantasyProsId: "hou",
      name: "Houston Texans",
      position: "DST",
      team: "Houston Texans",
      bestPositionRank: "DST10",
      bestRankEcr: 10,
    });
    const report = makeReportWithScheduleTargets([
      {
        player: makePlayer({
          player_id: "fantasypros:hou",
          name: "Houston Texans",
          pos: "DST",
          team: "Houston Texans",
          owner: "Available",
        }),
        signal,
        score: 80,
      },
    ]);
    report.managerPositionCounts = [
      {
        manager: "Roster Manager",
        QB: 0,
        QB_starters: 0,
        RB: 0,
        RB_starters: 0,
        WR: 0,
        WR_starters: 0,
        TE: 0,
        TE_starters: 0,
        K: 0,
        K_starters: 0,
        DEF: 1,
        DEF_starters: 1,
        rosterPlayers: [
          {
            player_id: "sleeper-hou",
            name: "Houston Texans",
            pos: "DEF",
            value: 0,
            playerDetails: { team: "HOU" },
          },
        ],
        lineupPlayers: [],
        starterPlayers: [],
      },
    ];

    const [row] = buildScheduleEdgeRows(report, { now: NOW });

    expect(row.team).toBe("HOU");
    expect(row.availabilityLabel).toBe("Roster Manager");
    expect(row.availabilityTone).toBe("warn");
    expect(row.evidenceRead.label).toBe("blocked");
    expect(row.evidenceRead.hardBlockers.join(" ")).toContain(
      "already on Roster Manager"
    );
    expect(row.decisionLabel).toBe("Don't add");
  });

  it("uses league-aware next-three and playoff matchup windows", () => {
    const weeks: WaiverWeeklyEcrSignal["weeks"] = [
      {
        week: 2,
        rankEcr: 18,
        positionRank: "WR18",
        bestRank: null,
        worstRank: null,
        averageRank: 18,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "LV",
        homeAway: "home",
        opponentRank: 2,
        matchupStars: 5,
        matchupTier: "easy",
        isBye: false,
      },
      {
        week: 3,
        rankEcr: 18,
        positionRank: "WR18",
        bestRank: null,
        worstRank: null,
        averageRank: 18,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "MIA",
        homeAway: "away",
        opponentRank: 8,
        matchupStars: 4,
        matchupTier: "easy",
        isBye: false,
      },
      {
        week: 15,
        rankEcr: 18,
        positionRank: "WR18",
        bestRank: null,
        worstRank: null,
        averageRank: 18,
        rankStdDev: null,
        lastUpdated: "2026-09-08T18:00:00.000Z",
        opponent: "NYJ",
        homeAway: "home",
        opponentRank: 3,
        matchupStars: 5,
        matchupTier: "easy",
        isBye: false,
      },
    ];
    const signal = makeSignal({
      playerId: "matchup-wr",
      name: "Matchup Receiver",
      position: "WR",
      bestPositionRank: "WR18",
      weeks,
      matchupWindows: buildMatchupWindowSet(weeks, {
        currentWeek: 3,
        playoffWeeks: [15, 16, 17],
      }),
    });
    const [row] = buildScheduleEdgeRows(
      makeReportWithScheduleTargets([
        {
          player: makePlayer({
            player_id: "matchup-wr",
            name: "Matchup Receiver",
            pos: "WR",
          }),
          signal,
          score: 90,
        },
      ]),
      { now: NOW }
    );

    expect(row.window).toContain("W3 at MIA 4-star");
    expect(row.window).not.toContain("W2 vs. LV");
    expect(row.playoffWindow).toContain("W15 vs. NYJ 5-star");
  });

  it("summarizes weekly snapshot health by week and position", () => {
    const rows = buildScheduleSnapshotHealthRows({
      sourceSnapshotDiagnostics: [
        {
          sourceKey: "draftsharks-sos-qb-week-1",
          source: "DraftSharks QB SOS Week 1 snapshot",
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
          sourceKey: "draftsharks-sos-rb-week-2",
          source: "DraftSharks RB SOS Week 2 snapshot",
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
          sourceKey: "draftsharks-sos-wr-week-3",
          source: "DraftSharks WR SOS Week 3 snapshot",
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

  it("summarizes DraftSharks trace health by week and position", () => {
    const rows = buildScheduleSnapshotHealthRows(
      makeReport({
        weeklyEcrTargets: [
          {
            player: makePlayer({ player_id: "matchup", name: "Matchup Receiver" }),
            signal: makeSignal({
              playerId: "matchup",
              name: "Matchup Receiver",
              sourceTrace: [
                makeTrace({
                  sourceKey: "draftsharks-sos-v1",
                  endpointKey: "draftsharks-sos-wr-week-2",
                  endpointLabel: "DraftSharks WR SOS Week 2",
                  rowCount: 160,
                }),
              ],
            }),
            score: 80,
          },
        ],
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].cells.WR).toMatchObject({
      label: "Loaded",
      tone: "good",
      rowCount: 160,
    });
  });

  it("summarizes DraftSharks trace health from special-teams streamer targets", () => {
    const rows = buildScheduleSnapshotHealthRows(
      makeReport({
        specialTeamsStreamerTargets: [
          {
            player: makePlayer({
              player_id: "stream-defense",
              name: "Streaming Defense",
              pos: "DST",
            }),
            signal: makeSignal({
              signalType: "draftsharks-sos",
              playerId: "stream-defense",
              name: "Streaming Defense",
              position: "DST",
              sourceTrace: [
                makeTrace({
                  sourceKey: "draftsharks-sos-v1",
                  endpointKey: "draftsharks-sos-def-week-1",
                  endpointLabel: "DraftSharks DEF SOS Week 1",
                  position: "DEF",
                  week: 1,
                  rowCount: 32,
                }),
              ],
            }),
            score: 91,
          },
        ],
      })
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].cells.DEF).toMatchObject({
      label: "Loaded",
      tone: "good",
      rowCount: 32,
    });
  });

  it("includes special-teams streamer targets in schedule edge rows", () => {
    const signal = makeSignal({
      signalType: "draftsharks-sos",
      playerId: "stream-kicker",
      name: "Streaming Kicker",
      position: "K",
      team: "LV",
      bestRankEcr: 7,
      bestPositionRank: "K7",
      note: "DraftSharks streamer window.",
      weeks: [
        {
          week: 1,
          rankEcr: 7,
          positionRank: "K7",
          bestRank: null,
          worstRank: null,
          averageRank: 7,
          rankStdDev: null,
          lastUpdated: "2026-09-08T18:00:00.000Z",
          opponent: "DEN",
          homeAway: "home",
          opponentRank: 28,
          matchupStars: 5,
          matchupTier: "easy",
          isBye: false,
        },
      ],
      sourceTrace: [
        makeTrace({
          sourceKey: "draftsharks-sos-v1",
          endpointKey: "draftsharks-sos-k-week-1",
          endpointLabel: "DraftSharks K SOS Week 1",
          position: "K",
          week: 1,
          rowCount: 32,
        }),
      ],
    });

    const rows = buildScheduleEdgeRows(
      makeReport({
        specialTeamsStreamerTargets: [
          {
            player: makePlayer({
              player_id: "stream-kicker",
              name: "Streaming Kicker",
              pos: "K",
              team: "LV",
            }),
            signal,
            score: 94,
          },
        ],
      }),
      { now: NOW }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "stream-kicker",
      position: "K",
      action: "Streamer target",
      targetScore: 94,
      note: "DraftSharks streamer window.",
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
      withRosterOwnershipMap(
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
        })
      ),
      { now: NOW }
    );
    const partialRows = buildScheduleEdgeRows(
      withRosterOwnershipMap(
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
        })
      ),
      { now: NOW }
    );

    expect(staleRows[0].sourceFreshness).toMatch(/^Stale - /);
    expect(staleRows[0].sourceTone).toBe("warn");
    expect(staleRows[0].evidenceRead.canAct).toBe(false);
    expect(staleRows[0].evidenceRead.confidenceCap).toBe(55);
    expect(staleRows[0].evidenceRead.confidenceCapReason).toContain(
      "evidence freshness"
    );
    expect(partialRows[0].sourceFreshness).toMatch(/^Partial - /);
    expect(partialRows[0].sourceTone).toBe("warn");
    expect(partialRows[0].evidenceRead.canAct).toBe(false);
    expect(partialRows[0].evidenceRead.confidenceCap).toBe(48);
    expect(partialRows[0].evidenceRead.confidenceCapReason).toContain(
      "evidence freshness"
    );
    expect(partialRows[0].evidenceRead.missingEvidence).toContain(
      "Fresh stored evidence is stale or unhealthy for this action read."
    );
  });

  it("caps schedule rows without source trace instead of rendering a confident decision", () => {
    const [row] = buildScheduleEdgeRows(
      makeReportWithScheduleTargets([
        {
          player: makePlayer({ player_id: "no-trace", name: "No Trace Runner" }),
          signal: makeSignal({
            playerId: "no-trace",
            name: "No Trace Runner",
            sourceTrace: [],
          }),
          score: 84,
        },
      ]),
      { now: NOW }
    );

    expect(row.evidenceRead.canAct).toBe(false);
    expect(row.evidenceRead.confidenceCap).toBe(48);
    expect(row.evidenceRead.confidenceCapReason).toBe("No schedule source trace");
    expect(row.decisionLabel).toBe("Don't force it");
  });

  it("caps schedule rows when roster availability is unverified", () => {
    const [row] = buildScheduleEdgeRows(
      makeReportWithScheduleTargets([
        {
          player: makePlayer({
            player_id: "unverified-streamer",
            name: "Unverified Streamer",
            pos: "DEF",
            team: "SEA",
            ktcValue: 1800,
          }),
          signal: makeSignal({
            playerId: "unverified-streamer",
            name: "Unverified Streamer",
            position: "DEF",
            team: "SEA",
            bestRankEcr: 3,
            sourceTrace: [makeTrace({ position: "DEF" })],
            weeks: [
              {
                week: 2,
                rankEcr: 3,
                positionRank: "DEF3",
                bestRank: null,
                worstRank: null,
                averageRank: null,
                rankStdDev: null,
                lastUpdated: "2026-09-08T18:00:00.000Z",
                opponent: "NYJ",
                homeAway: "home",
                opponentRank: 4,
                matchupStars: 5,
                matchupTier: "easy",
                isBye: false,
              },
            ],
          }),
          score: 90,
        },
      ]),
      { now: NOW }
    );

    expect(row.availabilityLabel).toBe("Unverified");
    expect(row.availabilityTone).toBe("info");
    expect(row.evidenceRead.canAct).toBe(false);
    expect(row.evidenceRead.confidenceCap).toBe(54);
    expect(row.evidenceRead.confidenceCapReason).toBe("Unverified roster availability");
    expect(row.evidenceRead.missingEvidence).toContain(
      "No league roster ownership map was present on this cached report."
    );
    expect(row.decisionLabel).toBe("Don't force it");
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
