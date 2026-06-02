import { describe, expect, it } from "vitest";
import type { PlayerDetails } from "@shared/types";

import { buildPlayerAiRead } from "./PlayerDetailModal";

describe("buildPlayerAiRead", () => {
  it("blocks redraft player-detail reads that only have dynasty evidence", () => {
    const read = buildPlayerAiRead({
      playerName: "Dynasty Only Stash",
      position: "TE",
      currentRank: "TE18",
      currentValue: 2600,
      valueMode: "redraft",
      valueProfile: {
        dynastyValue: 2600,
        dynastyPositionRank: "TE18",
        sources: ["KTC"],
      } as PlayerDetails["valueProfile"],
    });

    expect(read).toBeNull();
  });

  it("blocks redraft start-like player-detail reads during bye weeks", () => {
    const read = buildPlayerAiRead({
      playerName: "Bye Week Receiver",
      position: "WR",
      currentRank: "WR8",
      currentValue: 7200,
      valueMode: "redraft",
      valueProfile: {
        fantasyProsSeasonValue: 7200,
        fantasyProsPositionRank: "WR8",
        sources: ["FantasyPros"],
        fantasyProsSourceTrace: [{
          source: "FantasyPros",
          label: "FantasyPros WR weekly ECR",
          status: "loaded",
          positionRank: "WR8",
          fetchedAt: new Date().toISOString(),
        }],
      } as PlayerDetails["valueProfile"],
      details: {
        team: "DAL",
        weeklyProjection: {
          status: "bye",
          homeAway: "bye",
        },
      } as PlayerDetails,
    });

    expect(read).toBeNull();
  });

  it("caps source-thin player-detail reads instead of making them actionable", () => {
    const read = buildPlayerAiRead({
      playerName: "Source Thin Receiver",
      position: "WR",
      currentRank: "WR20",
      currentValue: 4500,
      valueMode: "redraft",
      valueProfile: {
        fantasyProsSeasonValue: 4500,
        fantasyProsPositionRank: "WR20",
        sources: [],
      } as PlayerDetails["valueProfile"],
    });

    expect(read).not.toBeNull();
    expect(read?.evidenceRead.canAct).toBe(false);
    expect(read?.evidenceRead.finalScore).toBeLessThanOrEqual(58);
    expect(read?.confidenceNote).toContain("No player source trace");
  });

  it("caps player-detail reads without current role context", () => {
    const read = buildPlayerAiRead({
      playerName: "Role Thin Receiver",
      position: "WR",
      currentRank: "WR9",
      currentValue: 7600,
      valueMode: "redraft",
      valueProfile: {
        fantasyProsSeasonValue: 7600,
        fantasyProsPositionRank: "WR9",
        sources: ["FantasyPros", "FantasyCalc"],
        fantasyProsSourceTrace: [{
          source: "FantasyPros",
          label: "FantasyPros WR weekly ECR",
          status: "loaded",
          positionRank: "WR9",
          fetchedAt: new Date().toISOString(),
        }],
      } as PlayerDetails["valueProfile"],
      details: {
        team: "DAL",
      } as PlayerDetails,
    });

    expect(read).not.toBeNull();
    expect(read?.evidenceRead.canAct).toBe(false);
    expect(read?.evidenceRead.finalScore).toBeLessThanOrEqual(57);
    expect(read?.evidenceRead.confidenceCapReason).toBe("Missing current role context");
    expect(read?.evidenceRead.missingEvidence).toContain("No cohort or situation-delta context returned.");
    expect(read?.confidenceNote).toContain("Missing current role context");
  });

  it("caps player-detail reads without recent usage trend", () => {
    const read = buildPlayerAiRead({
      playerName: "Usage Thin Receiver",
      position: "WR",
      currentRank: "WR11",
      currentValue: 7300,
      valueMode: "redraft",
      valueProfile: {
        fantasyProsSeasonValue: 7300,
        fantasyProsPositionRank: "WR11",
        sources: ["FantasyPros", "FantasyCalc"],
        fantasyProsSourceTrace: [{
          source: "FantasyPros",
          label: "FantasyPros WR weekly ECR",
          status: "loaded",
          positionRank: "WR11",
          fetchedAt: new Date().toISOString(),
        }],
      } as PlayerDetails["valueProfile"],
      details: {
        team: "DAL",
        playerCohort: {
          calibration: {
            evidenceGrade: "usable",
            note: "Cohort context exists, but usage trend is absent.",
          },
          trace: ["Cohort context attached."],
        },
      } as PlayerDetails,
    });

    expect(read).not.toBeNull();
    expect(read?.evidenceRead.canAct).toBe(false);
    expect(read?.evidenceRead.finalScore).toBeLessThanOrEqual(56);
    expect(read?.evidenceRead.confidenceCapReason).toBe("Missing recent usage trend");
    expect(read?.evidenceRead.missingEvidence).toContain("No recent usage trend returned.");
    expect(read?.confidenceNote).toContain("Missing recent usage trend");
  });
});
