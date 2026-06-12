import { expect, test, type Page } from "@playwright/test";
import { buildMatchupWindowSet } from "../../shared/matchupWindows";
import {
  createCachedCommandCenterReport,
  REPORT_CACHE_KEY,
} from "./fixtures/cachedReports";

const SLEEPER_SESSION_KEY = "dynasty-degenerates:sleeper-session:v1";
const SLEEPER_USERS_KEY = "dynasty-degenerates:sleeper-user-history:v1";

type CachedCommandCenterReport = ReturnType<typeof createCachedCommandCenterReport>;

async function loadCachedReport(
  page: Page,
  cachedReport: CachedCommandCenterReport,
  hash = "#rankings",
  options: { admin?: boolean; readySelector?: string } = {}
) {
  const useAdminSession = options.admin === true;
  const user = {
    userId: "123456789012345678",
    username: "projection-sos-smoke",
    displayName: "projection-sos-smoke",
    avatarUrl: null,
    hasAdminPermissions: useAdminSession,
    isPrivilegedReportViewer: useAdminSession,
  };
  const league = {
    leagueId: cachedReport.leagueId,
    name: cachedReport.leagueName,
    avatarUrl: cachedReport.leagueLogo,
    season: "2026",
    format: cachedReport.leagueFormat,
    mobileFormat: cachedReport.leagueFormat,
    totalRosters: 2,
    standingsRank: 1,
    powerRank: 1,
    managerAnchors: [],
  };
  const report = {
    ...cachedReport,
    savedAt: Math.max(Number(cachedReport.savedAt) || 0, Date.now() + 60_000),
  };

  await page.addInitScript(
    ({ reportKey, reportValue, sessionKey, usersKey, sessionUser, leagueOption, admin }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(reportKey, JSON.stringify(reportValue));
      window.localStorage.setItem(
        `${reportKey}:${reportValue.leagueId}`,
        JSON.stringify(reportValue)
      );
      if (admin) {
        window.sessionStorage.setItem(
          "dynasty-degenerates:admin-unlock-dismissed:v1",
          "true"
        );
        window.sessionStorage.setItem(
          "dynasty-degenerates:admin-passphrase-verified-session:v1",
          "true"
        );
      }
      window.localStorage.setItem(
        sessionKey,
        JSON.stringify({
          username: sessionUser.username,
          user: sessionUser,
          leagues: [leagueOption],
          adminViewMode: admin ? "admin" : "regular",
          savedAt: Date.now(),
        })
      );
      window.localStorage.setItem(
        usersKey,
        JSON.stringify([
          {
            ...sessionUser,
            leagues: [leagueOption],
            recentLeagueIds: [leagueOption.leagueId],
            savedAt: Date.now(),
          },
        ])
      );
    },
    {
      reportKey: REPORT_CACHE_KEY,
      reportValue: report,
      sessionKey: SLEEPER_SESSION_KEY,
      usersKey: SLEEPER_USERS_KEY,
      sessionUser: user,
      leagueOption: league,
      admin: useAdminSession,
    }
  );

  await Promise.all([
    page.request.get("/src/components/reportTables/WaiverIntelligencePanel.tsx", { timeout: 60_000 }).catch(() => null),
    page.request.get("/src/components/AITeamAutopilot.tsx", { timeout: 60_000 }).catch(() => null),
    page.request.get("/src/components/RankingsBoard.tsx", { timeout: 60_000 }).catch(() => null),
    page.request.get("/src/components/reportTables/TradeWarRoom.tsx", { timeout: 60_000 }).catch(() => null),
    page.request.get("/src/features/admin/components/AdminScheduleEdgeSections.tsx", { timeout: 60_000 }).catch(() => null),
    page.request.get("/src/features/report/components/ReportRankingsTab.tsx", { timeout: 60_000 }).catch(() => null),
    page.request.get("/src/features/report/components/ReportTradesTab.tsx", { timeout: 60_000 }).catch(() => null),
  ]);

  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(options.readySelector || "details.report-disclosure").first()).toBeVisible({
    timeout: 45_000,
  });
}

async function openReportSection(page: Page, title: string) {
  const section = page
    .locator("details.report-disclosure")
    .filter({ hasText: title })
    .first();
  await expect(section).toBeVisible();
  if (!(await section.evaluate(node => (node as HTMLDetailsElement).open))) {
    await section.evaluate(node => {
      const details = node as HTMLDetailsElement;
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
  }
  await expect(section.locator(".report-disclosure-body-inner")).toBeVisible();
  return section;
}

function stripWeeklyProjectionContext(report: CachedCommandCenterReport) {
  const reportData = report.reportData as any;
  const projectionFields = [
    "weeklyProjection",
    "projectedPoints",
    "projectedFantasyPoints",
    "projection",
    "fantasyProjection",
  ];
  const valueProfileProjectionFields = [
    ...projectionFields,
    "fantasyProsProjection",
    "fantasyProsProjectedPoints",
  ];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    for (const field of projectionFields) {
      if (field in value) {
        delete (value as Record<string, unknown>)[field];
      }
    }
    const valueProfile = (value as Record<string, unknown>).valueProfile;
    if (valueProfile && typeof valueProfile === "object") {
      for (const field of valueProfileProjectionFields) {
        if (field in valueProfile) {
          delete (valueProfile as Record<string, unknown>)[field];
        }
      }
    }
    Object.values(value).forEach(walk);
  };

  walk(reportData.playerDetailsById);
  walk(reportData.waiverIntelligence);
  walk(reportData.managerRosterIntelligence);
  walk(reportData.managerPositionCounts);
  reportData.matchupPreviews = (reportData.matchupPreviews || []).filter(
    (preview: { source?: string | null }) =>
      !/stored weekly projection/i.test(preview.source || "")
  );
  if (reportData.lineupStrength) {
    reportData.lineupStrength = {
      ...reportData.lineupStrength,
      status: reportData.lineupStrength.status === "ready" ? "partial" : reportData.lineupStrength.status,
      projectionStatus: "blocked",
      note: "Stored weekly projections are disabled, so lineup strength is served with value/rank context only.",
      rows: (reportData.lineupStrength.rows || []).map((row: any) => ({
        ...row,
        projectionPoints: null,
        projectionScore: 0,
        projectedWinProbability: null,
        benchAlternatives: (row.benchAlternatives || []).map((alternative: any) => ({
          ...alternative,
          projectionDelta: null,
          decision: alternative.decision === "upgrade" ? "close-call" : alternative.decision,
          note: "Projection-disabled lineup alternative requires manual review.",
        })),
      })),
    };
  }
  if (reportData.redraftValuation) {
    reportData.redraftValuation = {
      ...reportData.redraftValuation,
      status: "value-only",
      projectionStatus: "blocked",
      scheduleStatus: "blocked",
      note: "Stored weekly projections are disabled, so redraft valuation is served with base value only.",
      rows: (reportData.redraftValuation.rows || []).map((row: any) => ({
        ...row,
        projectionValue: 0,
        scheduleAdjustment: 0,
        byeAdjustment: 0,
        roleAdjustment: 0,
        injuryAdjustment: 0,
        replacementAdjustment: 0,
        finalValue: row.baseValue,
        valueDelta: 0,
        status: "value-only",
      })),
    };
  }
  reportData.weeklyProjectionDiagnostics = {
    status: "blocked",
    source: "stored-weekly-projection",
    provider: "sleeper",
    season: "2026",
    week: 1,
    scoringProfile: null,
    rowCount: 0,
    rosteredCoveragePct: null,
    attachedPlayerCount: 0,
    note: "Stored weekly projections are disabled in this smoke fixture.",
    warnings: ["Projection feature flags are disabled."],
  };
}

function attachProjectionBackedReportMechanics(report: CachedCommandCenterReport) {
  const reportData = report.reportData as any;
  const testerCounts = reportData.managerPositionCounts?.find(
    (row: { manager?: string }) => row.manager === "Tester"
  );
  const starter = testerCounts?.starterPlayers?.find(
    (player: { player_id?: string }) => player.player_id === "te1"
  );
  const alternative = testerCounts?.benchPlayers?.find(
    (player: { player_id?: string }) => player.player_id === "te2"
  ) || testerCounts?.rosterPlayers?.find(
    (player: { player_id?: string }) => player.player_id === "te2"
  );
  const mustStart = testerCounts?.starterPlayers?.find(
    (player: { player_id?: string }) => player.player_id === "wr1"
  );
  const fetchedAt = "2026-06-04T17:45:00.000Z";

  reportData.weeklyProjectionDiagnostics = {
    status: "ready",
    source: "stored-weekly-projection",
    provider: "sleeper",
    season: "2026",
    week: 1,
    scoringProfile: "PPR",
    rowCount: 492,
    rosteredCoveragePct: 100,
    attachedPlayerCount: 7,
    note: "Stored Sleeper weekly projections are attached to the smoke fixture.",
    warnings: [],
  };
  reportData.matchupPreviews = [
    {
      manager: "Tester",
      opponentManager: "Rival",
      week: 1,
      source: "stored weekly projection",
      projectedPoints: 123.4,
      opponentProjectedPoints: 112.1,
      winProbability: 0.62,
      mustStarts: mustStart ? [mustStart] : [],
      vulnerableSpots: starter ? [starter] : [],
      boomBustRisks: starter ? [starter] : [],
      howToWin: [
        "Projection Scout: stored weekly projection math gives Tester a narrow matchup edge.",
      ],
      positionEdges: [
        {
          position: "TE",
          managerPoints: 8.3,
          opponentPoints: 6.1,
          edge: 2.2,
          winner: "Tester",
        },
      ],
    },
  ];
  reportData.lineupStrength = {
    status: "ready",
    source: "stored-report-lineup",
    projectionStatus: "ready",
    scheduleStatus: "ready",
    generatedAt: fetchedAt,
    note: "Projection Scout lineup-strength fixture.",
    rows: [
      {
        manager: "Tester",
        opponentManager: "Rival",
        status: "ready",
        starterSource: "Sleeper",
        starterCount: 4,
        valueScore: 79,
        projectionPoints: 61.7,
        projectionScore: 82,
        scheduleScore: 4,
        totalScore: 165,
        opponentTotalScore: 151,
        edge: 14,
        confidence: 84,
        confidenceCapReason: null,
        summary: "Tester has a projection-backed lineup edge.",
        topStarter: mustStart,
        weakestStarter: starter,
        projectedWinProbability: {
          managerProjectedPoints: 123.4,
          opponentProjectedPoints: 112.1,
          winProbability: 0.62,
          source: "stored weekly projection",
          status: "ready",
        },
        benchAlternatives: starter && alternative ? [
          {
            starter,
            alternative,
            scoreDelta: 4.1,
            projectionDelta: 4.1,
            valueDelta: 1450,
            decision: "upgrade",
            confidence: 88,
            closeCallReason: null,
            note: "Replacement Tight End grades 4.1 points ahead of Sample Tight End.",
          },
        ] : [],
        positionEdges: [
          {
            position: "TE",
            managerScore: 8.3,
            opponentScore: 6.1,
            edge: 2.2,
            confidence: 82,
            note: "Projection-backed TE edge.",
          },
        ],
      },
    ],
  };
  reportData.redraftValuation = {
    status: "ready",
    source: "stored-redraft-valuation",
    projectionStatus: "ready",
    scheduleStatus: "ready",
    generatedAt: fetchedAt,
    note: "Stored redraft valuation fixture.",
    rows: [
      {
        playerId: "waiver1",
        playerName: "Waiver Receiver",
        position: "WR",
        team: "NYJ",
        rosterStatus: "available",
        baseValue: 3400,
        projectionValue: 1070,
        scheduleAdjustment: 240,
        byeAdjustment: 0,
        roleAdjustment: 180,
        injuryAdjustment: 0,
        replacementAdjustment: 220,
        finalValue: 5110,
        valueDelta: 1710,
        confidence: 78,
        status: "ready",
        components: [
          { key: "base-value", label: "Base value", value: 3400, weight: 1, note: "Fixture base value." },
          { key: "projection", label: "Stored projection", value: 1070, weight: 1, note: "10.7 stored projected points." },
        ],
      },
    ],
  };
}

function attachSpecialTeamsStreamerTarget(report: CachedCommandCenterReport) {
  const reportData = report.reportData as any;
  const fetchedAt = "2026-06-04T17:30:00.000Z";
  reportData.leagueDiagnostics.rosterSlots = [
    "QB",
    "RB",
    "RB",
    "WR",
    "WR",
    "TE",
    "FLEX",
    "SUPER_FLEX",
    "K",
    "BN",
  ];
  reportData.leagueDiagnostics.starterSlots = [
    "QB",
    "RB",
    "RB",
    "WR",
    "WR",
    "TE",
    "FLEX",
    "SUPER_FLEX",
    "K",
  ];
  reportData.leagueDiagnostics.lineupSlotSummary =
    "1 QB, 2 RB, 2 WR, 1 TE, Flex, Superflex, K";
  reportData.leagueDiagnostics.starterCountSummary = "9 starters";
  const weeks = [
    {
      week: 1,
      rankEcr: 7,
      positionRank: "K7",
      bestRank: null,
      worstRank: null,
      averageRank: 7,
      rankStdDev: null,
      lastUpdated: fetchedAt,
      fetchedAt,
      opponent: "DEN",
      homeAway: "home",
      opponentRank: 28,
      matchupStars: 5,
      matchupTier: "easy",
      matchupText: "This is a 5 star matchup.",
      isBye: false,
      sourceStatus: "loaded",
      endpointKey: "draftsharks-sos-k-week-1",
    },
  ];
  const signal = {
    signalType: "draftsharks-sos",
    playerId: "stream-kicker",
    fantasyProsId: null,
    name: "Streaming Kicker",
    position: "K",
    team: "LV",
    source: "DraftSharks",
    updatedAt: fetchedAt,
    weeks,
    bestWeek: 1,
    bestRankEcr: 7,
    bestPositionRank: "K7",
    averageRankEcr: 7,
    rankDelta: null,
    bestMatchupStars: 5,
    bestOpponentRank: 28,
    matchupWindows: buildMatchupWindowSet(weeks, { currentWeek: 1 }),
    confidence: 84,
    note: "DraftSharks streamer window. Covers rostered K rough Week 1.",
    sourceTrace: [
      {
        source: "DraftSharks",
        sourceKey: "draftsharks-sos-v1",
        endpointKey: "draftsharks-sos-k-week-1",
        endpointLabel: "DraftSharks K SOS Week 1",
        status: "loaded",
        season: "2026",
        scoring: "SOS",
        week: 1,
        position: "K",
        rowCount: 32,
        fetchedAt,
        lastUpdated: fetchedAt,
        evidence: "Stored DraftSharks SOS fixture row.",
      },
    ],
    traceSummary:
      "DraftSharks SOS source trace: W1 from stored percentage snapshots.",
  };
  const player = {
    player_id: "stream-kicker",
    name: "Streaming Kicker",
    pos: "K",
    team: "LV",
    owner: null,
    count: 0,
    ktcValue: 800,
    currentPositionRank: "K7",
    weeklyEcr: signal,
  };

  reportData.waiverIntelligence.specialTeamsStreamerTargets = [
    {
      player,
      signal,
      score: 94,
    },
  ];
  reportData.sourceSnapshotDiagnostics = [];
}

test.describe("projection/SOS command center smoke", () => {
  test("projection and SOS enabled report shows source-backed special-teams schedule mechanics", async ({ page }) => {
    const report = createCachedCommandCenterReport("projection-sos-enabled-smoke");
    attachProjectionBackedReportMechanics(report);
    attachSpecialTeamsStreamerTarget(report);

    await loadCachedReport(page, report, "#overview", { admin: true });

    const assistantSection = await openReportSection(page, "Assistant Feature Radar");
    await expect(assistantSection.getByText("Waiver Assistant").first()).toBeVisible();
    await expect(assistantSection.getByText("10.7 projected pts").first()).toBeVisible();
    const matchupCard = assistantSection
      .locator(".assistant-feature-card")
      .filter({ hasText: "Matchup Preview" })
      .first();
    await expect(matchupCard).toBeVisible();
    await expect(matchupCard.getByText("Rival")).toBeVisible();
    await expect(matchupCard.getByText("123.4")).toBeVisible();
    await expect(matchupCard.getByText(/62/)).toBeVisible();

    const rosterBoardSection = await openReportSection(page, "Projected Roster Board");
    await rosterBoardSection
      .locator(".command-depth-tile")
      .filter({ hasText: "Tester" })
      .click();
    const swapRead = page.locator(".manager-command-swap-read");
    await expect(swapRead.getByText("Start/Sit Swap Signals")).toBeVisible();
    await expect(swapRead.getByText("Replacement Tight End").first()).toBeVisible();
    await expect(swapRead.getByText(/\+4\.1 pts/).first()).toBeVisible();

    await loadCachedReport(page, report, "#hacks", { admin: true });
    const scheduleSection = await openReportSection(page, "Schedule Edge Table");
    await expect(scheduleSection.getByText("Streaming Kicker").first()).toBeVisible();
    await expect(scheduleSection.getByText("DraftSharks SOS windows")).toBeVisible();
    await expect(scheduleSection.getByText("Target 94").first()).toBeVisible();
    await expect(scheduleSection.getByText("W1").first()).toBeVisible();
    await expect(scheduleSection.getByLabel("DEN").first()).toBeVisible();
    await expect(scheduleSection.getByLabel("5 star matchup").first()).toBeVisible();
    await expect(scheduleSection.getByText("Snapshot coverage", { exact: true }).first()).toBeVisible();
    await expect(scheduleSection.getByText(/FantasyPros matchup/i)).toHaveCount(0);
  });

  test("projection-disabled report hides projection claims but keeps waiver fallback content", async ({ page }) => {
    const report = createCachedCommandCenterReport("projection-disabled-command-smoke");
    attachProjectionBackedReportMechanics(report);
    stripWeeklyProjectionContext(report);

    await loadCachedReport(page, report, "#overview", { admin: true });

    const assistantSection = await openReportSection(page, "Assistant Feature Radar");
    await expect(assistantSection.getByText("Waiver Assistant").first()).toBeVisible();
    await expect(assistantSection.getByText("Projection Scout")).toHaveCount(0);
    await expect(assistantSection.getByText("10.7 stored projection pts")).toHaveCount(0);
    await expect(assistantSection.getByText("123.4")).toHaveCount(0);
    const pendingMatchupCard = assistantSection
      .locator(".assistant-feature-card")
      .filter({ hasText: "Matchup Preview" })
      .first();
    await expect(pendingMatchupCard).toBeVisible();
    await expect(pendingMatchupCard.getByText("Schedule pending")).toBeVisible();
    await expect(pendingMatchupCard.getByText("NFL schedule dependent")).toBeVisible();

    const rosterBoardSection = await openReportSection(page, "Projected Roster Board");
    await rosterBoardSection
      .locator(".command-depth-tile")
      .filter({ hasText: "Tester" })
      .click();
    await expect(page.locator(".manager-command-swap-read").getByText(/\+4\.1 pts/)).toHaveCount(0);
    await expect(page.locator(".manager-command-swap-read").getByText(/stored weekly projection/i)).toHaveCount(0);

    await loadCachedReport(page, report, "#momentum", { admin: true });

    await expect(page.getByText("10.7 stored projection pts")).toHaveCount(0);
    await expect(page.getByText("Projection Scout")).toHaveCount(0);
    await expect(page.getByText("123.4")).toHaveCount(0);

    const waiverSection = await openReportSection(page, "Waiver Intelligence");
    await expect(waiverSection.getByText("Waiver Receiver").first()).toBeVisible();
    await expect(waiverSection.getByTestId("weekly-projection-receipt")).toHaveCount(0);
    await expect(waiverSection.getByTestId("projection-player-detail-trigger")).toHaveCount(0);
    await expect(waiverSection.getByText(/stored weekly projection/i)).toHaveCount(0);
    await expect(waiverSection.getByText(/projected pts/i)).toHaveCount(0);
  });

  test("admin Autopilot stays source-safe while Rankings reads cached SOS evidence", async ({ page }) => {
    const report = createCachedCommandCenterReport("projection-sos-autopilot-enabled-smoke");
    attachProjectionBackedReportMechanics(report);
    attachSpecialTeamsStreamerTarget(report);

    await loadCachedReport(page, report, "#autopilot", {
      admin: true,
      readySelector: ".autopilot-dashboard",
    });

    const autopilot = page.locator(".autopilot-dashboard");
    await expect(autopilot.getByText("AI Team Autopilot")).toBeVisible();
    await expect(autopilot.getByText("Daily AI Verdict")).toBeVisible();
    await expect(autopilot.getByText(/stored weekly projection/i)).toHaveCount(0);
    await expect(autopilot.getByText(/DraftSharks SOS/i)).toHaveCount(0);
    await expect(autopilot.getByText(/FantasyPros matchup/i)).toHaveCount(0);

    await loadCachedReport(page, report, "#hacks", { admin: true });
    const scheduleSection = await openReportSection(page, "Schedule Edge Table");
    await expect(scheduleSection.getByText("Streaming Kicker").first()).toBeVisible();
    await expect(scheduleSection.getByText("DraftSharks SOS windows")).toBeVisible();
    await expect(scheduleSection.getByText(/FantasyPros matchup/i)).toHaveCount(0);

    await loadCachedReport(page, report, "#trades", { admin: true });
    const tradeWarSection = await openReportSection(page, "Trade War Room");
    await expect(tradeWarSection.getByText("Side A").first()).toBeVisible();
    await expect(tradeWarSection.getByText("Side B").first()).toBeVisible();
    await expect(tradeWarSection.getByText("Scout Leaguemates")).toBeVisible();
    await expect(tradeWarSection.getByText(/stored weekly projection/i)).toHaveCount(0);
    await expect(tradeWarSection.getByText(/DraftSharks SOS/i)).toHaveCount(0);
    await expect(tradeWarSection.getByText(/FantasyPros matchup/i)).toHaveCount(0);
  });

  test("admin Autopilot and Trade surfaces stay projection-safe when weekly projections are disabled", async ({ page }) => {
    const report = createCachedCommandCenterReport("projection-sos-autopilot-disabled-smoke");
    attachProjectionBackedReportMechanics(report);
    stripWeeklyProjectionContext(report);

    await loadCachedReport(page, report, "#autopilot", {
      admin: true,
      readySelector: ".autopilot-dashboard",
    });

    const autopilot = page.locator(".autopilot-dashboard");
    await expect(autopilot.getByText("AI Team Autopilot")).toBeVisible();
    await expect(autopilot.getByText("Daily AI Verdict")).toBeVisible();
    await expect(autopilot.getByText(/stored weekly projection edge/i)).toHaveCount(0);
    await expect(autopilot.getByText("Stored weekly projection")).toHaveCount(0);

    await loadCachedReport(page, report, "#trades", { admin: true });
    const tradeWarSection = await openReportSection(page, "Trade War Room");
    await expect(tradeWarSection.getByText("Side A").first()).toBeVisible();
    await expect(tradeWarSection.getByText("Side B").first()).toBeVisible();
    await expect(tradeWarSection.getByText(/stored weekly projection/i)).toHaveCount(0);
    await expect(tradeWarSection.getByText(/projected pts/i)).toHaveCount(0);
    await expect(tradeWarSection.getByText(/FantasyPros matchup/i)).toHaveCount(0);
  });

  test("regular command center view does not expose raw SOS source-trace detail", async ({ page }) => {
    const report = createCachedCommandCenterReport("projection-sos-regular-trace-smoke");
    attachSpecialTeamsStreamerTarget(report);

    await loadCachedReport(page, report, "#rankings", { admin: false });

    await expect(page.locator("details.report-disclosure").filter({ hasText: "Schedule Edge Table" })).toHaveCount(0);
    await expect(page.getByText("Stored DraftSharks SOS fixture row.")).toHaveCount(0);
    await expect(page.getByText("DraftSharks SOS source trace: W1 from stored percentage snapshots.")).toHaveCount(0);
  });
});
