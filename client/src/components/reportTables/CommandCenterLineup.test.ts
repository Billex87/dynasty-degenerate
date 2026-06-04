import { describe, expect, it } from "vitest";
import type { ManagerStarterPlayer, ReportData } from "@shared/types";
import { buildLineupSwapRecommendations } from "./CommandCenterLineup";

function player(overrides: Partial<ManagerStarterPlayer> & Pick<ManagerStarterPlayer, "player_id" | "name" | "pos">): ManagerStarterPlayer {
  return {
    value: 0,
    seasonValue: 0,
    ...overrides,
  };
}

describe("buildLineupSwapRecommendations", () => {
  it("prefers backend lineup-strength bench alternatives when available", () => {
    const starter = player({
      player_id: "starter-te",
      name: "Starter Tight End",
      pos: "TE",
      value: 4000,
      seasonValue: 4000,
    });
    const alternative = player({
      player_id: "bench-te",
      name: "Bench Tight End",
      pos: "TE",
      value: 4200,
      seasonValue: 4200,
    });
    const reportData = {
      managerPositionCounts: [
        {
          manager: "Tester",
          QB: 0,
          QB_starters: 0,
          RB: 0,
          RB_starters: 0,
          WR: 0,
          WR_starters: 0,
          TE: 2,
          TE_starters: 1,
          starterPlayers: [starter],
          lineupPlayers: [starter, alternative],
          rosterPlayers: [starter, alternative],
          starterGroups: [
            { key: "TE", label: "TE", count: 1, players: [starter] },
          ],
        },
      ],
      lineupStrength: {
        status: "ready",
        source: "stored-report-lineup",
        projectionStatus: "ready",
        scheduleStatus: "ready",
        generatedAt: "2026-06-04T00:00:00.000Z",
        note: "Fixture.",
        rows: [
          {
            manager: "Tester",
            opponentManager: null,
            status: "ready",
            starterSource: "Sleeper",
            starterCount: 1,
            valueScore: 40,
            projectionPoints: 9,
            projectionScore: 36,
            scheduleScore: 0,
            totalScore: 76,
            opponentTotalScore: null,
            edge: null,
            confidence: 82,
            confidenceCapReason: null,
            summary: "Tester lineup strength fixture.",
            topStarter: starter,
            weakestStarter: starter,
            benchAlternatives: [
              {
                starter,
                alternative,
                scoreDelta: 2.4,
                projectionDelta: 1.2,
                valueDelta: 200,
                note: "Bench Tight End grades 2.4 points ahead of Starter Tight End.",
              },
            ],
            positionEdges: [],
          },
        ],
      },
    } as ReportData;

    const recommendations = buildLineupSwapRecommendations({
      data: reportData,
      manager: "Tester",
      lineupGroups: [{ key: "TE", label: "TE", count: 1, players: [starter] }],
      stepInGroups: [{ label: "TE", players: [alternative] }],
      selectedIntel: null,
    });

    expect(recommendations[0]).toMatchObject({
      starterOut: { name: "Starter Tight End" },
      options: [
        {
          player: { name: "Bench Tight End" },
          projectedPointEdge: 1.2,
        },
      ],
    });
    expect(recommendations[0].options[0].reasonBullets.join(" ")).toContain("Lineup strength edge");
  });
});
