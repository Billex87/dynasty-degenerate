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
  options: { admin?: boolean } = {}
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
    page.request.get("/src/features/admin/components/AdminScheduleEdgeSections.tsx", { timeout: 60_000 }).catch(() => null),
  ]);

  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, {
    waitUntil: "domcontentloaded",
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
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if ("weeklyProjection" in value) {
      delete (value as { weeklyProjection?: unknown }).weeklyProjection;
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
    attachSpecialTeamsStreamerTarget(report);

    await loadCachedReport(page, report, "#rankings");

    const scheduleSection = await openReportSection(page, "Schedule Edge Table");
    await expect(scheduleSection.getByText("Streaming Kicker").first()).toBeVisible();
    await expect(scheduleSection.getByText("DraftSharks SOS windows")).toBeVisible();
    await expect(scheduleSection.getByText("Target 94").first()).toBeVisible();
    await expect(scheduleSection.getByText("W1").first()).toBeVisible();
    await expect(scheduleSection.getByLabel("DEN").first()).toBeVisible();
    await expect(scheduleSection.getByLabel("5 star matchup").first()).toBeVisible();
    await expect(scheduleSection.getByText("Snapshot coverage")).toBeVisible();
    await expect(scheduleSection.getByText(/FantasyPros matchup/i)).toHaveCount(0);
  });

  test("projection-disabled report hides projection claims but keeps waiver fallback content", async ({ page }) => {
    const report = createCachedCommandCenterReport("projection-disabled-command-smoke");
    stripWeeklyProjectionContext(report);

    await loadCachedReport(page, report, "#momentum");

    const waiverSection = await openReportSection(page, "Waiver Intelligence");
    await expect(waiverSection.getByText("Waiver Receiver").first()).toBeVisible();
    await expect(waiverSection.getByTestId("weekly-projection-receipt")).toHaveCount(0);
    await expect(waiverSection.getByTestId("projection-player-detail-trigger")).toHaveCount(0);
    await expect(waiverSection.getByText(/stored weekly projection/i)).toHaveCount(0);
    await expect(waiverSection.getByText(/projected pts/i)).toHaveCount(0);
  });

  test("regular command center view does not expose raw SOS source-trace detail", async ({ page }) => {
    const report = createCachedCommandCenterReport("projection-sos-regular-trace-smoke");
    attachSpecialTeamsStreamerTarget(report);

    await loadCachedReport(page, report, "#rankings", { admin: false });

    const scheduleSection = await openReportSection(page, "Schedule Edge Table");
    await expect(scheduleSection.getByText("Streaming Kicker").first()).toBeVisible();
    await expect(scheduleSection.getByText("Stored DraftSharks SOS fixture row.")).toHaveCount(0);
    await expect(scheduleSection.getByText("DraftSharks SOS source trace: W1 from stored percentage snapshots.")).toHaveCount(0);
  });
});
