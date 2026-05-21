import { describe, expect, it } from "vitest";
import {
  getLeagueRosterScannerProfileLabel,
  getManagerProfileLabel,
  getOwnerIntelProfileLabel,
} from "./managerProfileLabels";

describe("getManagerProfileLabel", () => {
  it("uses Owner Intel context to promote elite title profiles", () => {
    expect(
      getManagerProfileLabel("Problem", 84, {
        powerRow: {
          score: 84,
          starterStrength: 88,
          rosterValue: 92,
          draftCapital: 58,
          youthScore: 72,
        },
        timelineRow: {
          contenderScore: 96,
          rebuildScore: 55,
        },
        managerRow: {
          starterValuePct: 52,
        },
        overviewRow: {
          rank_value: 3,
        },
        leagueSize: 12,
      }).label
    ).toBe("Thanos");
  });

  it("uses the tighter dynasty scoring bands", () => {
    expect(getManagerProfileLabel(null, 96).label).toBe("Thanos");
    expect(getManagerProfileLabel(null, 92).label).toBe("Heavyweight");
    expect(getManagerProfileLabel(null, 88).label).toBe("Could Be a Threat");
    expect(getManagerProfileLabel(null, 82).label).toBe("Sneaky Problem");
    expect(getManagerProfileLabel(null, 69).label).toBe("Free Money");
  });

  it("keeps real rebuild leverage separate from weak rebuilds", () => {
    expect(
      getManagerProfileLabel(null, null, {
        powerRow: {
          draftCapital: 86,
          youthScore: 78,
          rosterValue: 62,
        },
        timelineRow: {
          contenderScore: 48,
          rebuildScore: 82,
        },
        overviewRow: {
          rank_value: 8,
        },
        leagueSize: 12,
      }).label
    ).toBe("Future Rich");

    expect(getManagerProfileLabel(null, 44).label).toBe("Free Money");
  });
});

describe("getLeagueRosterScannerProfileLabel", () => {
  const profileContext = {
    powerRow: {
      score: 90,
      starterStrength: 78,
      rosterValue: 94,
      draftCapital: 88,
      youthScore: 82,
    },
    timelineRow: {
      contenderScore: 78,
      rebuildScore: 86,
    },
    leagueSize: 10,
  };

  it("uses the selected scanner tab instead of the strongest score", () => {
    expect(
      getLeagueRosterScannerProfileLabel("Thanos", 90, profileContext, "dynasty")
    ).toMatchObject({ label: "Rich as Fuck", tone: "dynasty" });

    expect(
      getLeagueRosterScannerProfileLabel("Thanos", 90, profileContext, "contender")
    ).toMatchObject({ label: "Pain in the Ass", tone: "scanner-contender" });

    expect(
      getLeagueRosterScannerProfileLabel("Thanos", 90, profileContext, "rebuilder")
    ).toMatchObject({ label: "Pick Goblin", tone: "scanner-rebuilder" });
  });

  it("keeps Thanos out of League Roster Scanner labels", () => {
    expect(getLeagueRosterScannerProfileLabel("Thanos", 96).label).toBe(
      "Rich as Fuck"
    );
  });
});

describe("getOwnerIntelProfileLabel", () => {
  it("uses the active Owner Intel tab score for the label family", () => {
    expect(getOwnerIntelProfileLabel("dynasty", 96).label).toBe("Thanos");
    expect(getOwnerIntelProfileLabel("contender", 96).label).toBe("Crown Me");
    expect(getOwnerIntelProfileLabel("rebuilder", 66).label).toBe("Pick Rich");
  });

  it("keeps rebuild labels different from top dynasty labels", () => {
    expect(getOwnerIntelProfileLabel("rebuilder", 72).label).toBe(
      "Future Menace"
    );
  });

  it("uses contender and dynasty context for low rebuild scores", () => {
    expect(
      getOwnerIntelProfileLabel("rebuilder", 37, null, {
        dynastyScore: 86,
        contenderScore: 94,
        rebuilderScore: 37,
      }).label
    ).toBe("All In");

    expect(
      getOwnerIntelProfileLabel("rebuilder", 38, null, {
        dynastyScore: 84,
        contenderScore: 87,
        rebuilderScore: 38,
      }).label
    ).toBe("Time to Rebuild");

    expect(
      getOwnerIntelProfileLabel("rebuilder", 33, null, {
        dynastyScore: 80,
        contenderScore: 80,
        rebuilderScore: 33,
      }).label
    ).toBe("Sell Your Team");
  });

  it("uses rebuild context for contender labels", () => {
    expect(
      getOwnerIntelProfileLabel("contender", 94, null, {
        dynastyScore: 86,
        contenderScore: 94,
        rebuilderScore: 37,
      }).label
    ).toBe("All In");

    expect(
      getOwnerIntelProfileLabel("contender", 83, null, {
        dynastyScore: 84,
        contenderScore: 83,
        rebuilderScore: 50,
      }).label
    ).toBe("Could Steal It");
  });
});
