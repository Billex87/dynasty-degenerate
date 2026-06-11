import { expect, test } from "@playwright/test";
import {
  createCachedCommandCenterReport,
  createCachedRedraftReport,
  REPORT_CACHE_KEY,
} from "./fixtures/cachedReports";
import { buildMatchupWindowSet } from "../../shared/matchupWindows";

async function loadCachedReport(
  page: import("@playwright/test").Page,
  cachedReport: ReturnType<
    typeof createCachedCommandCenterReport | typeof createCachedRedraftReport
  >,
  hash = "",
  options: {
    admin?: boolean;
    preserveLocalStorage?: boolean;
    deltaSnapshots?: Record<string, unknown>;
    sleeperLeagues?: Array<Record<string, unknown>>;
  } = {}
) {
  const useAdminSession = options.admin !== false;
  const preserveLocalStorage = options.preserveLocalStorage === true;
  const cachedReportForBrowser = {
    ...cachedReport,
    savedAt: Math.max(Number(cachedReport.savedAt) || 0, Date.now() + 60_000),
  };
  const sleeperSessionKey = "dynasty-degenerates:sleeper-session:v1";
  const cachedUsersKey = "dynasty-degenerates:sleeper-user-history:v1";
  const adminUser = {
    userId: "123456789012345678",
    username: "mynameisbillex",
    displayName: "mynameisbillex",
    avatarUrl: null,
    hasAdminPermissions: true,
    isPrivilegedReportViewer: true,
  };
  const league = {
    leagueId: cachedReportForBrowser.leagueId,
    name: cachedReportForBrowser.leagueName,
    avatarUrl: cachedReportForBrowser.leagueLogo,
    season: "2026",
    format: cachedReportForBrowser.leagueFormat,
    mobileFormat: cachedReportForBrowser.leagueFormat,
    totalRosters: 2,
    standingsRank: 1,
    powerRank: 1,
    managerAnchors: [],
  };
  const sessionUser = useAdminSession
    ? adminUser
    : {
        ...adminUser,
        hasAdminPermissions: false,
        isPrivilegedReportViewer: false,
      };
  const sessionLeagues = options.sleeperLeagues?.length
    ? options.sleeperLeagues
    : [league];
  await page.addInitScript(
    ({
      key,
      value,
      sessionKey,
      usersKey,
      deltaKey,
      deltaSnapshots,
      user,
      leagueOptions,
      admin,
      preserve,
    }) => {
      if (!preserve) window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
      if (deltaSnapshots) {
        window.localStorage.setItem(
          deltaKey,
          JSON.stringify({
            schemaVersion: 1,
            snapshots: deltaSnapshots,
          })
        );
      }
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
          username: user.username,
          user,
          leagues: leagueOptions,
          adminViewMode: admin ? "admin" : "regular",
          savedAt: Date.now(),
        })
      );
      window.localStorage.setItem(
        usersKey,
        JSON.stringify([
          {
            ...user,
            leagues: leagueOptions,
            recentLeagueIds: leagueOptions.map(league => league.leagueId),
            savedAt: Date.now(),
          },
        ])
      );
    },
    {
      key: REPORT_CACHE_KEY,
      value: cachedReportForBrowser,
      sessionKey: sleeperSessionKey,
      usersKey: cachedUsersKey,
      deltaKey: "dynasty-degenerates:report-delta-snapshots:v1",
      deltaSnapshots: options.deltaSnapshots || null,
      user: sessionUser,
      leagueOptions: sessionLeagues,
      admin: useAdminSession,
      preserve: preserveLocalStorage,
    }
  );
  await page.goto(`/?leagueId=${cachedReportForBrowser.leagueId}${hash}`, {
    waitUntil: "domcontentloaded",
  });
}

function createTrpcBatchResponse(data: unknown) {
  return [
    {
      result: {
        data: {
          json: data,
        },
      },
    },
  ];
}

async function mockLeagueAnalysisFlow(
  page: import("@playwright/test").Page,
  cachedReport: ReturnType<typeof createCachedCommandCenterReport>
) {
  await page.route("**/api/trpc/**", async route => {
    const requestUrl = route.request().url();

    if (requestUrl.includes("league.getLeaguePreview")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          createTrpcBatchResponse({
            leagueId: cachedReport.leagueId,
            leagueName: cachedReport.leagueName,
            leagueFormat: cachedReport.leagueFormat,
            leagueLogo: cachedReport.leagueLogo,
            managerAnchors: [],
          })
        ),
      });
      return;
    }

    if (requestUrl.includes("league.analyze")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          createTrpcBatchResponse({
            leagueId: cachedReport.leagueId,
            leagueName: cachedReport.leagueName,
            leagueFormat: cachedReport.leagueFormat,
            leagueLogo: cachedReport.leagueLogo,
            reportData: cachedReport.reportData,
            reportCacheStatus: "miss",
          })
        ),
      });
      return;
    }

    await route.continue();
  });
}

async function openReportSection(
  page: import("@playwright/test").Page,
  title: string | RegExp
) {
  const section = page.locator("details.report-disclosure").filter({ hasText: title }).first();
  await expect(section).toBeVisible();
  if (!(await section.evaluate(node => node.open))) {
    await section.evaluate(node => {
      const details = node as HTMLDetailsElement;
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
  }
  await expect(section).toHaveAttribute("open", "");
  await expect(section.locator(".report-disclosure-body-inner")).toBeVisible();
  return section;
}

async function expectVisibleOverviewPulse(
  page: import("@playwright/test").Page,
  text: RegExp | string
) {
  await expect(
    page.locator(".overview-ai-pulse:visible").filter({ hasText: text }).first()
  ).toBeVisible();
}

function createRedraftCommandCenterReport(
  leagueId: string,
  hasCurrentSeasonMainDraft: boolean
) {
  const cachedReport = createCachedCommandCenterReport(leagueId);
  const reportData = cachedReport.reportData as any;
  cachedReport.leagueName = hasCurrentSeasonMainDraft
    ? "Test Redraft Command"
    : "Gov Tech Grid Iron";
  cachedReport.leagueFormat = hasCurrentSeasonMainDraft
    ? "4-Team Redraft PPR"
    : "4-Team Redraft PPR - No Draft Yet";
  reportData.leagueValueMode = "redraft";
  reportData.leagueDiagnostics = {
    ...reportData.leagueDiagnostics,
    valueMode: "redraft",
    currentSeason: "2026",
    hasCurrentSeasonMainDraft,
    currentSeasonMainDraftPickCount: hasCurrentSeasonMainDraft ? 2 : 0,
    currentSeasonMainDraftPickedPlayerCount: hasCurrentSeasonMainDraft ? 2 : 0,
    currentSeasonMainDraftStatus: hasCurrentSeasonMainDraft
      ? "complete"
      : "not_started",
  };

  if (!hasCurrentSeasonMainDraft) {
    reportData.draftPicks = [];
    reportData.draftStats = [];
  }

  const placeholderIntel = {
    ...reportData.managerRosterIntelligence[0],
    manager: "Unknown",
    identity: "Future focused",
    timeline: "Rebuild",
    summary: "Unassigned roster slot should not render in redraft tables.",
  };
  reportData.managerRosterIntelligence = [
    ...reportData.managerRosterIntelligence,
    placeholderIntel,
  ];
  reportData.managerPositionCounts = [
    ...reportData.managerPositionCounts,
    {
      ...reportData.managerPositionCounts[0],
      manager: "Unknown",
      starterPlayers: [],
      lineupPlayers: [],
      rosterPlayers: [],
    },
  ];
  reportData.leagueOverview = [
    ...reportData.leagueOverview,
    {
      manager: "Unknown",
      total_val: 0,
      rank_qb: 3,
      rank_rb: 3,
      rank_wr: 3,
      rank_te: 3,
      rank_value: 3,
      rank_2027: 3,
    },
  ];
  reportData.powerRankings = [
    ...reportData.powerRankings.map((row: any) => ({
      ...row,
      tier: "Free Money",
    })),
    {
      rank: 3,
      manager: "Unknown",
      score: 35,
      tier: "Free Money",
      starterStrength: 0,
      rosterValue: 0,
      positionalBalance: 0,
      draftCapital: 0,
      youthScore: 0,
      tradeEfficiency: 0,
    },
  ];
  reportData.dynastyTimelines = [
    ...reportData.dynastyTimelines,
    {
      manager: "Unknown",
      contenderScore: 5,
      outlook2027: 5,
      agingRisk: 10,
      rebuildScore: 95,
      label: "Future focused",
    },
  ];

  return cachedReport;
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() =>
    Math.max(
      0,
      document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

type ConsoleAuditedTestInfo = import("@playwright/test").TestInfo & {
  browserConsoleIssues?: string[];
};

function installBrowserConsoleAudit(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo
) {
  const auditedInfo = testInfo as ConsoleAuditedTestInfo;
  const browserConsoleIssues: string[] = [];
  let ignoredSnapshotCoveragePermissionErrors = 0;
  auditedInfo.browserConsoleIssues = browserConsoleIssues;

  page.on("response", response => {
    if (
      /snapshotCoverage/i.test(response.url()) &&
      response.status() === 403
    ) {
      ignoredSnapshotCoveragePermissionErrors += 1;
    }
  });

  page.on("console", message => {
    if (message.type() !== "error") return;
    if (
      /snapshotCoverage/i.test(message.text()) &&
      /403|Forbidden|required permission/i.test(message.text())
    ) {
      return;
    }
    const location = message.location();
    const source = location.url
      ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})`
      : "";
    if (/snapshotCoverage/i.test(source) && /403|Forbidden/i.test(message.text())) {
      return;
    }
    if (
      ignoredSnapshotCoveragePermissionErrors > 0 &&
      /\[API Query Error\]/i.test(message.text()) &&
      /required permission \(10002\)/i.test(message.text())
    ) {
      ignoredSnapshotCoveragePermissionErrors -= 1;
      return;
    }
    browserConsoleIssues.push(`console.error: ${message.text()}${source}`);
  });

  page.on("pageerror", error => {
    browserConsoleIssues.push(`pageerror: ${error.message}`);
  });
}

function expectNoBrowserConsoleIssues(
  testInfo: import("@playwright/test").TestInfo
) {
  const auditedInfo = testInfo as ConsoleAuditedTestInfo;
  const consoleIssues = auditedInfo.browserConsoleIssues || [];
  const ignoredPatterns = [
    /ERR_CONNECTION_REFUSED/i,
    /draftbuzz-cache\/nfl-logos/i,
    /images\.playerHeadshot/i,
    /Too many player image requests/i,
    /localStorage/i,
  ];
  const unexpectedIssues = consoleIssues.filter(
    issue =>
      !ignoredPatterns.some(pattern => pattern.test(issue))
  );
  expect(unexpectedIssues).toEqual([]);
}

async function expectSuccessCanvasNonBlank(
  page: import("@playwright/test").Page
) {
  const canvas = page.locator('[data-testid="success-card-3d-scene"] canvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(900);
  const box = await canvas.boundingBox();
  expect(box?.width || 0).toBeGreaterThan(220);
  expect(box?.height || 0).toBeGreaterThan(120);

  const stats = await canvas.evaluate(node => {
    const canvasNode = node as HTMLCanvasElement;
    const gl =
      canvasNode.getContext("webgl2") || canvasNode.getContext("webgl");
    if (!gl) {
      return {
        hasContext: false,
        litRatio: 0,
        width: 0,
        height: 0,
      };
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let samples = 0;
    let litSamples = 0;
    for (let index = 0; index < pixels.length; index += 64) {
      samples += 1;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      if (alpha > 4 && red + green + blue > 32) {
        litSamples += 1;
      }
    }

    return {
      hasContext: true,
      litRatio: samples ? litSamples / samples : 0,
      width,
      height,
    };
  });

  expect(stats.hasContext).toBe(true);
  expect(stats.width).toBeGreaterThan(220);
  expect(stats.height).toBeGreaterThan(120);
  expect(stats.litRatio).toBeGreaterThan(0.01);
}

async function expectCompactMobileAIRead(
  page: import("@playwright/test").Page,
  selector: string,
  title?: RegExp | string
) {
  const read = page.locator(selector).first();
  await expect(read).toBeVisible();
  await expect(read).not.toHaveAttribute("open", "");

  const compactSummary = read.locator(".ai-read-compact-summary");
  const hasCompactSummary = (await compactSummary.count()) > 0;
  if (hasCompactSummary) {
    if (typeof title === "undefined") {
      await expect(compactSummary).toBeVisible();
    } else {
      await expect(compactSummary).toContainText(title);
    }
  } else if (typeof title !== "undefined") {
    const header = read
      .locator(
        ".ai-read-title-row, .ai-read-panel-head, .ai-read-headline, .ai-read-title"
      )
      .first();
    if ((await header.count()) > 0) {
      await expect(header).toContainText(title);
    }
  }

  const trace = read.locator(".ai-read-trace");
  const traceKicker = read.locator(".ai-read-trace-kicker");
  const body = read.locator(".ai-read-body");
  if ((await trace.count()) > 0) {
    await expect(trace).toBeVisible();
  }
  if ((await traceKicker.count()) > 0) {
    await expect(traceKicker).toBeVisible();
  }
  const hasBody = (await body.count()) > 0;
  if (hasBody && hasCompactSummary) {
    await expect(body).toBeHidden();
  }

  const collapsedBox = await read.boundingBox();
  const hasDetails = (await read.locator("details").count()) > 0;
  const isDetails = (await read.evaluate(node => node.tagName.toLowerCase())) === "details";
  if (hasCompactSummary || hasDetails) {
    expect(collapsedBox?.height || 0).toBeLessThan(420);
  }
  await expectNoHorizontalOverflow(page);

  if (isDetails && (await read.locator("summary").count()) > 0) {
    await read.locator("summary").click();
    await expect(read).toHaveAttribute("open", "");
    if (hasBody) {
      await expect(body).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);

    await read.locator("summary").click();
    await expect(read).not.toHaveAttribute("open", "");
  } else if (hasBody && hasCompactSummary) {
    await expect(body).toBeVisible();
  }
}

async function expectCompactMobileBlueprintCard(
  page: import("@playwright/test").Page,
  selector: string,
  title?: RegExp | string
) {
  const report = page.locator(selector).first();
  await expect(report).toBeVisible();
  await expect(report.locator(".team-blueprint-report-header")).toBeVisible();
  await expect(report.locator(".team-blueprint-grid")).toBeVisible();
  if (typeof title === "undefined") {
    return;
  }

  await expect(report.locator(".team-blueprint-report-header")).toContainText(title);
}

test.describe("command center feature surfaces", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    installBrowserConsoleAudit(page, testInfo);
  });

  test.afterEach(async ({}, testInfo) => {
    expectNoBrowserConsoleIssues(testInfo);
  });

  test("renders the generated-report 3D success card on desktop and mobile", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1280, height: 820 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto("/?preview=success", { waitUntil: "domcontentloaded" });

      await expect(page.getByText("Report Generated")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "The Fantasy Degenerates" })
      ).toBeVisible();
      await expectSuccessCanvasNonBlank(page);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("uses the generated-report fallback when reduced motion is requested", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?preview=success", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Report Generated")).toBeVisible();
    await expect(page.locator(".success-card-3d-fallback")).toBeVisible();
    await expect(
      page.locator('[data-testid="success-card-3d-scene"] canvas')
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("renders AI reads, blueprint generation, power rankings, roster recon, partners, and feature radar", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    cachedReport.reportData.recentTransactions =
      cachedReport.reportData.recentTransactions?.map(transaction =>
        transaction.id === "tx-waiver-2" && transaction.addedPlayer
          ? {
              ...transaction,
              addedPlayer: {
                ...transaction.addedPlayer,
                player_id: "alternate-waiver-wr",
                name: "Alternate Waiver Receiver",
              },
            }
          : transaction
      );
    await loadCachedReport(page, cachedReport);

    const overviewAiPulse = page.locator(
      ".overview-ai-pulse"
    );
    await expect(overviewAiPulse).toBeVisible();
    await expect(overviewAiPulse).toContainText(
      "Narrative only"
    );
    await expect(overviewAiPulse).not.toContainText(
      /Value rank #|Best first trade angle|shortage to exploit/i
    );
    const overviewSummaryText = (
      await page
        .locator(".report-tab-content details.report-disclosure > summary")
        .allTextContents()
    ).join("\n");
    expect(overviewSummaryText).toContain("Monthly direction");
    expect(overviewSummaryText).toContain("League ordering");
    expect(overviewSummaryText).toContain("Owner Intel Lab");
    expect(overviewSummaryText).not.toMatch(
      /Top Team|Recon Teams|Depth Flags|Position Signals|Waiver Adds|News Flags|Starter Leader/i
    );
    await expect(page.locator(".admin-premium-tab")).toHaveCount(0);
    await expect(page.locator(".admin-premium-section")).not.toHaveCount(0);
    const premiumSectionFlare = await page
      .locator(".admin-premium-section > .report-disclosure-summary")
      .first()
      .evaluate(node => getComputedStyle(node, "::before").content);
    expect(premiumSectionFlare).toBe('""');
    await expect(
      page.getByText("Monthly Team Blueprint").first()
    ).toBeVisible();
    const blueprintSection = await openReportSection(page, "Monthly Team Blueprint");
    await expect(blueprintSection.locator(".team-blueprint-lab select")).toHaveCount(0);
    await expect(
      blueprintSection.getByRole("button", { name: /View Monthly Blueprint/i })
    ).toBeVisible();
    await blueprintSection.locator("button.command-primary-action").click();
    await expect(page.getByText("The Monthly Blueprint")).toBeVisible();
    const blueprintAiSummary = page.locator(".team-blueprint-report");
    await expect(blueprintAiSummary).toBeVisible();
    await expect(blueprintAiSummary.locator(".team-blueprint-report-header")).toBeVisible();
    await expect(blueprintAiSummary.locator(".team-blueprint-read-panel")).toBeVisible();
    await expect(blueprintAiSummary.locator(".team-blueprint-grid")).toBeVisible();
    await expect(
      page.getByText(/Saved (2026-05|May 2026|May)/)
    ).toBeVisible();

    await openReportSection(page, "League Power Rankings");
    await expect(page.locator(".league-power-card")).toHaveCount(2);
    const leaguePowerCard = page.locator(".league-power-card").first();
    if (!(await leaguePowerCard.evaluate(node => (node as HTMLDetailsElement).open))) {
      await leaguePowerCard.locator(":scope > summary").click();
    }
    const leaguePowerMetrics = leaguePowerCard.locator(".league-power-metrics");
    await expect(
      leaguePowerMetrics.getByText("Power slot", { exact: true })
    ).toBeVisible();
    await expect(leaguePowerCard.locator(".league-power-body")).toBeVisible();
    await expect(leaguePowerMetrics.getByText("QB", { exact: true })).toHaveCount(0);
    await expect(
      leaguePowerMetrics.getByText("Trade chip", { exact: true })
    ).toHaveCount(0);

    await openReportSection(page, "Team Breakdown & Roster Recon");
    const teamBreakdown = page.locator(".team-breakdown-recon");
    await expect(teamBreakdown).toBeVisible();
    await expect(teamBreakdown.locator(".command-module-toolbar select")).toHaveCount(0);
    await expect(teamBreakdown.getByText("Fragility Watch")).toBeVisible();
    await expect(teamBreakdown.getByText("Sell Candidates")).toHaveCount(0);
    await expect(teamBreakdown.getByText("Trade chip")).toHaveCount(0);
    await expect(
      page
        .locator(".team-breakdown-ai")
        .getByText("Suggested next move")
    ).toBeVisible();
    await expect(
      page
        .locator(".team-breakdown-ai")
        .getByText(/use Trade Finder for specific partners/i)
    ).toBeVisible();
    await expect(
      page
        .locator(".team-breakdown-ai")
        .locator(".ai-read-trace-kicker")
    ).toBeVisible();
    const ownerIntelSection = await openReportSection(page, "Owner Intel Lab");
    await ownerIntelSection.locator(".command-depth-tile").filter({ hasText: "Tester" }).click();
    const ownerPcbSystem = page.getByTestId("owner-intel-pcb-system");
    await expect(ownerPcbSystem).toBeVisible();
    await expect(ownerPcbSystem.locator(".owner-intel-pcb-routes")).toBeVisible();
    const situationRadarRead = ownerPcbSystem
      .locator(".ai-read-panel")
      .filter({ hasText: "AI Situation Radar" })
      .first();
    await expect(situationRadarRead).toBeVisible();
    await expect(situationRadarRead).toContainText(
      /Depth Receiver is the best backed roster riser/i
    );
    await expect(ownerPcbSystem.locator(".owner-intel-pcb-node")).toHaveCount(12);
    await expect(
      page
        .locator(".owner-intel-read-grid .ai-read-panel")
        .first()
        .locator(".ai-read-trace-kicker")
    ).toBeVisible();
    const ownerSuggestionCards = ownerPcbSystem.locator(".owner-intel-ai-card.ai-read-panel");
    const ownerSuggestionCardCount = await ownerSuggestionCards.count();
    expect(ownerSuggestionCardCount).toBeGreaterThan(0);
    await expect(ownerSuggestionCards.first().locator(".ai-read-title-row")).toBeVisible();
    await expect(ownerSuggestionCards.first().locator(".ai-read-trace-kicker")).toBeVisible();
    const notesRail = ownerPcbSystem
      .locator(".owner-intel-wild-notes")
      .first();
    await expect(notesRail.getByText("Dynasty AI Notes")).toBeVisible();
    const pcbBox = await ownerPcbSystem.boundingBox();
    const notesBox = await notesRail.boundingBox();
    expect(notesBox?.width || 0).toBeGreaterThan((pcbBox?.width || 0) * 0.82);
    await page.getByRole("button", { name: "Close Tester details" }).click();
    const rosterBoardSection = await openReportSection(page, "Projected Roster Board");
    await rosterBoardSection
      .locator(".command-depth-tile")
      .filter({ hasText: "Tester" })
      .click();
    const headerMetrics = page.locator(".manager-command-hero-metrics-season");
    await expect(headerMetrics.getByText("Season Value")).toBeVisible();
    await expect(
      headerMetrics.getByText("Starters", { exact: true })
    ).toHaveCount(0);
    const startingRanks = page.locator(".manager-command-starting-rank-panel");
    await expect(startingRanks.getByText("QB/SF")).toBeVisible();
    await expect(startingRanks.getByText("Season Value")).toHaveCount(0);
    const swapRead = page.locator(".manager-command-swap-read");
    await expect(swapRead.getByText("Start/Sit Swap Signals")).toBeVisible();
    await expect(swapRead.locator(".manager-command-swap-card").first()).toBeVisible();
    await expect(page.getByText("Action History")).toHaveCount(0);
    await expect(
      swapRead.getByRole("button", { name: /Save plan/i })
    ).toHaveCount(0);
    await expect(
      swapRead
        .locator(".manager-command-swap-out-name")
        .getByText("Replace", { exact: true })
    ).toBeVisible();
    await expect(
      swapRead.getByText("Replacement Tight End").first()
    ).toBeVisible();
    await expect(
      swapRead
        .locator(".manager-command-swap-player .interactive-identity-name")
        .filter({ hasText: "Sample Tight End" })
    ).toBeVisible();
    const swapDetails = swapRead.locator(".manager-command-swap-details");
    if ((await swapDetails.count()) > 0) {
      await expect(swapDetails.first()).toBeVisible();
      await swapDetails.first().click();
    }
    await expect(
      swapRead.getByRole("button", { name: /Copy swap/i })
    ).toHaveCount(0);
    await expect(
      swapRead.getByRole("button", { name: /Open Sleeper/i })
    ).toHaveCount(0);
    await expect(
      swapRead.getByRole("button", { name: /Plan saved/i })
    ).toHaveCount(0);
    const lineupPlans = await page.evaluate(
      () =>
        JSON.parse(
          window.localStorage.getItem("dynasty-degenerates:action-plans:v1") ||
            "[]"
        ) as Array<{ kind?: string }>
    );
    expect(lineupPlans.some(plan => plan.kind === "lineup")).toBeFalsy();
    await expect(
      page
        .locator(".manager-command-player-tile-swap-in .manager-command-swap-status")
        .getByText("Best Fit TE")
    ).toBeVisible();
    const swapIsAfterRosterGrid = await page.evaluate(() => {
      const grid = document.querySelector(
        ".manager-command-dialog .manager-command-grid"
      );
      const swap = document.querySelector(
        ".manager-command-dialog .manager-command-swap-read"
      );
      return Boolean(
        grid && swap && grid.compareDocumentPosition(swap) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(swapIsAfterRosterGrid).toBeTruthy();
    await expect(
      page.locator(".manager-command-player-tile-swap-out")
    ).toHaveCount(1);
    await expect(
      page.locator(".manager-command-player-tile-swap-in")
    ).toHaveCount(1);
    await expect(
      page.locator(".manager-command-lock-status").first()
    ).toBeVisible();
    await expect(page.getByText(/Locks in/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Close Tester details" }).click();

    const featureRadarSection = await openReportSection(page, "Assistant Feature Radar");
    await expect(
      featureRadarSection.locator("label").filter({ hasText: "Assistant focus" })
    ).toHaveCount(0);
    await expect(page.locator(".assistant-shell-grid")).toBeVisible();
    await expect(
      featureRadarSection.locator(".assistant-action-queue-policy")
    ).toBeVisible();
    await expect(
      featureRadarSection.locator("details.ai-read-panel-compact")
    ).toHaveCount(0);

    await page.getByRole("tab", { name: /^(Rankings|Ranks)$/i }).click();
    const hasAdminDiagnostics = await page.locator(".admin-diagnostics-shell").isVisible();
    if (hasAdminDiagnostics) {
      const hasValueSourceHealth =
        (await page.getByText("Value Source Health").count()) > 0;
      if (hasValueSourceHealth) {
        const adminValueSection = await openReportSection(
          page,
          "Value Source Health"
        );
        await expect(
          adminValueSection.getByText("Confidence Drilldown")
        ).toBeVisible();
        await expect(
          adminValueSection.getByText("67% Building confidence").first()
        ).toBeVisible();
        await expect(
          adminValueSection.getByText("League history: +12 to 54%").first()
        ).toBeVisible();
        await expect(
          adminValueSection.getByText("Manager activity").first()
        ).toBeVisible();
        await expect(
          adminValueSection.getByText("Depth chart roles")
        ).toBeVisible();
        await expect(
          adminValueSection.getByText("6/8 players matched")
        ).toBeVisible();
        await expect(adminValueSection.getByText("Team gaps")).toBeVisible();
        await expect(
          adminValueSection.getByText(
            /2 Sleeper role tags differed from the current team chart/i
          )
        ).toBeVisible();
        await expect(
          adminValueSection.getByText(/Role enrichment took 428ms/i)
        ).toBeVisible();
        await expect(
          adminValueSection.getByText(/Needs retry for: NYJ/i)
        ).toBeVisible();
        await expect(
          adminValueSection.getByText("Sleeper history backfill")
        ).toBeVisible();
        await expect(adminValueSection.getByText("14 transactions")).toBeVisible();
      }
      const aiReadoutSection = await openReportSection(
        page,
        "AI Readout QA"
      );
      const surfaceRegistry = aiReadoutSection.getByLabel("AI surface registry");
      await expect(surfaceRegistry.getByText("Surface Rules")).toBeVisible();
      await expect(
        surfaceRegistry.getByText("One owner. Others support.")
      ).toBeVisible();
      await expect(surfaceRegistry.getByText("Acts").first()).toBeVisible();
      await expect(surfaceRegistry.getByText("Supports").first()).toBeVisible();
      await expect(surfaceRegistry.getByText("Schedule Edge")).toBeVisible();
      await expect(
        aiReadoutSection
          .getByLabel("AI decision log rows")
          .getByText("Action Queue")
          .first()
      ).toBeVisible();
      await expect(
        aiReadoutSection
          .getByLabel("AI decision log rows")
          .getByText("Rules Log")
      ).toBeVisible();
      await expect(
        aiReadoutSection
          .getByLabel("AI decision log rows")
          .getByText("Own, support, hide, or merge.")
      ).toBeVisible();
      await expect(
        aiReadoutSection.getByText(/Conflict check|Source health|Hard blocker|Missing evidence/i).first()
      ).toBeVisible();
      await expect(aiReadoutSection.getByText("observed", { exact: true })).toBeVisible();
      await expect(aiReadoutSection.getByText("dupes", { exact: true })).toBeVisible();
      await expect(
        aiReadoutSection
          .getByLabel("AI readout count by tab")
          .getByText("AI Autopilot")
      ).toBeVisible();
      await expect(
        surfaceRegistry.getByText("Trade Finder", { exact: true })
      ).toBeVisible();
      await expect(
        surfaceRegistry.getByText("Player Situation", { exact: true })
      ).toBeVisible();
      await expect(
        aiReadoutSection.getByText(/All observed readouts have confidence/i)
      ).toBeVisible();
      const hasReceiptAudit =
        (await page.getByText("Player Receipt Audit").count()) > 0;
      if (hasReceiptAudit) {
        const receiptAuditSection = await openReportSection(
          page,
          "Player Receipt Audit"
        );
        await expect(receiptAuditSection.getByText("bucket matches")).toBeVisible();
        await expect(
          receiptAuditSection
            .getByLabel("Player receipt audit rows")
            .getByText("Depth Receiver · WR")
        ).toBeVisible();
        await expect(
          receiptAuditSection
            .getByLabel("Player receipt audit rows")
            .getByText("WR progression with feature usage")
        ).toBeVisible();
        await expect(
          receiptAuditSection
            .getByLabel("Player receipt guardrail flags")
            .getByText(/missing production baseline/i)
            .first()
        ).toBeVisible();
      }
    } else {
      await expect(page.getByText("Value Source Health")).toHaveCount(0);
      await expect(page.getByText("AI Readout QA")).toHaveCount(0);
      await expect(page.getByText("Player Receipt Audit")).toHaveCount(0);
    }

    await page.getByRole("tab", { name: "Momentum" }).click();
    await openReportSection(page, "Waiver Intelligence");
    await expect(page.getByText("Waiver Receiver").first()).toBeVisible();
    await expect(page.getByText("League bid range").first()).toBeVisible();
    await expect(
      page.getByText(/Based on 2 WR bid samples/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Rival: 1 recent add\/drop move/i).first()
    ).toBeVisible();
    await expect(page.getByText("Drop Last Bench Spot").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Copy plan/i })).toHaveCount(
      0
    );
    await expect(
      page.getByRole("button", { name: /Open Sleeper/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Save plan|Plan saved|Save watch/i })
    ).toHaveCount(0);
    await expect(page.getByText("Waiver Plan History").first()).toHaveCount(0);

    const desktopOverflow = await page.evaluate(() =>
      Math.max(
        0,
        document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    );
    expect(desktopOverflow).toBeLessThanOrEqual(1);
  });

  test("keeps waiver intelligence as receipt language instead of a second action owner", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    cachedReport.reportData.recentTransactions =
      cachedReport.reportData.recentTransactions?.map(transaction =>
        transaction.id === "tx-waiver-2" && transaction.addedPlayer
          ? {
              ...transaction,
              addedPlayer: {
                ...transaction.addedPlayer,
                player_id: "alternate-waiver-wr",
                name: "Alternate Waiver Receiver",
              },
            }
          : transaction
      );
    await loadCachedReport(page, cachedReport, "#momentum");

    const waiverSection = await openReportSection(page, "Waiver Intelligence");
    await expect(waiverSection.getByText("Waiver Receiver").first()).toBeVisible();
    await expect(
      waiverSection.locator(".waiver-intel-recommendation-banner")
    ).toContainText("Review this");
    await expect(
      waiverSection.locator(".waiver-ai-target-card").first()
    ).toContainText("Review this");
    await expect(waiverSection.getByText("Do this", { exact: true })).toHaveCount(0);
  });

  test("shows one compact delta brief only when a saved report baseline changed", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport(
      "command-center-delta-brief"
    );
    const previousSnapshot = {
      schemaVersion: 1,
      leagueId: cachedReport.leagueId,
      leagueName: cachedReport.leagueName,
      savedAt: Date.now() - 86_400_000,
      valueMode: "dynasty",
      action: {
        id: "old-action",
        decision: "watch",
        label: "Old watch item",
        target: "Old Waiver Stash",
        confidence: 38,
      },
      topRiser: {
        id: "old-riser",
        name: "Old Riser",
        position: "WR",
        team: "BUF",
        metricLabel: "+3%",
      },
      topFaller: null,
      topWaiver: {
        id: "old-waiver",
        name: "Old Waiver Stash",
        position: "TE",
        team: "NYG",
        metricLabel: "Old top available",
      },
      tradeCount: 0,
      transactionCount: 0,
      scheduleStatus: "pending",
      scheduleSignalCount: 0,
      aiConfidence: 42,
      signature: "old-baseline",
    };

    await loadCachedReport(page, cachedReport, "", {
      deltaSnapshots: {
        [cachedReport.leagueId]: previousSnapshot,
      },
    });

    const deltaBrief = page.getByRole("region", {
      name: "Changed since last report",
    });
    await expect(deltaBrief).toBeVisible();
    await expect(deltaBrief).toContainText("What Changed Since Last Report");
    await expect(deltaBrief).toContainText(
      /Decision changed|Waiver target changed|Sleeper activity changed/
    );
    await expect(deltaBrief).toContainText(/Previous:|Current/);
  });

  test("lets report users switch the global AI voice without adding another readout", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport(
      "command-center-ai-voice-mode"
    );
    const previousSnapshot = {
      schemaVersion: 1,
      leagueId: cachedReport.leagueId,
      leagueName: cachedReport.leagueName,
      savedAt: Date.now() - 86_400_000,
      valueMode: "dynasty",
      action: {
        id: "old-action",
        decision: "watch",
        label: "Old watch item",
        target: "Old Waiver Stash",
        confidence: 38,
      },
      topRiser: null,
      topFaller: null,
      topWaiver: {
        id: "old-waiver",
        name: "Old Waiver Stash",
        position: "TE",
        team: "NYG",
        metricLabel: "Old top available",
      },
      tradeCount: 0,
      transactionCount: 0,
      scheduleStatus: "pending",
      scheduleSignalCount: 0,
      aiConfidence: 42,
      signature: "old-baseline",
    };

    await loadCachedReport(page, cachedReport, "", {
      deltaSnapshots: {
        [cachedReport.leagueId]: previousSnapshot,
      },
    });

    const deltaBrief = page.getByRole("region", {
      name: "Changed since last report",
    });
    await expect(deltaBrief).toContainText("What Changed Since Last Report");

    await page.getByRole("button", { name: "AI voice mode: Degen" }).click();
    await page.getByRole("menuitemradio", { name: /Straight/ }).click();

    await expect(
      page.getByRole("button", { name: "AI voice mode: Straight" })
    ).toBeVisible();
    await expect(deltaBrief).toContainText("Changed Since Last Report");
    await expect(deltaBrief).not.toContainText("What Changed Since Last Report");

    const storedVoiceMode = await page.evaluate(() =>
      window.localStorage.getItem("dynasty-degenerates:ai-voice-mode:v1")
    );
    expect(storedVoiceMode).toBe("straight");
  });

  test("keeps the delta brief hidden on the first saved baseline", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport(
      "command-center-first-delta-baseline"
    );
    await loadCachedReport(page, cachedReport);

    await expect(page.locator(".report-delta-brief")).toHaveCount(0);
  });

  test("keeps mobile AI reads compact across key report tabs", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    await expectCompactMobileAIRead(
      page,
      ".overview-ai-pulse",
      /Owner Intel|Owner Reads/i
    );

    await openReportSection(page, "Monthly Team Blueprint");
    await page.locator("button.command-primary-action").click();
    await expect(page.getByText("The Monthly Blueprint")).toBeVisible();
    await expectCompactMobileBlueprintCard(
      page,
      ".team-blueprint-report",
      /blueprint/i
    );

    await page.getByRole("tab", { name: "Rankings" }).click();
    await openReportSection(page, "Full Roster Rankings");
    const rankingsReadSelector =
      ".report-tab-content[data-state='active'] .ai-read-panel";
    const rankingsReadCount = await page.locator(rankingsReadSelector).count();
    if (rankingsReadCount > 0) {
      await expectCompactMobileAIRead(
        page,
        rankingsReadSelector,
        /Ranking|ranking|market signal/i
      );
    }

    await page.getByRole("tab", { name: "Trade History" }).click();
    await expectCompactMobileAIRead(
      page,
      ".trade-browser-ai-read",
      /trade/i
    );
  });

  test("collapses AI reads into compact mobile cards", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    await expectCompactMobileAIRead(
      page,
      ".overview-ai-pulse",
      /Owner Intel|Owner Reads/i
    );

    const aiRead = page.locator(".overview-ai-pulse");
    const hasCompact = (await aiRead.locator("details").count()) > 0;
    if (!hasCompact) {
      const articleBody = aiRead
        .locator("article")
        .locator(".ai-read-body")
        .first();
      if ((await articleBody.count()) > 0) {
        await expect(articleBody).toBeHidden();
      }
    }

    await expectNoHorizontalOverflow(page);
  });

  test("lets admins return to regular view and switch the active manager view", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    await expectVisibleOverviewPulse(
      page,
      /Tester sets the starting lens/i
    );

    const viewAsTester = page.getByRole("button", { name: /View as Tester/i });
    await viewAsTester.scrollIntoViewIfNeeded();
    await viewAsTester.click();
    const rivalMenuItem = page
      .locator('[data-slot="dropdown-menu-content"]')
      .getByRole("menuitemradio", { name: "Rival" });
    await expect(rivalMenuItem).toBeVisible();
    await rivalMenuItem.click({ force: true });
    await expect(
      page.getByRole("button", { name: /View as Rival/i })
    ).toBeVisible();
    await expectVisibleOverviewPulse(
      page,
      /Rival sets the starting lens/i
    );

    await page
      .getByRole("button", { name: /Switch to regular report view/i })
      .click();
    await expect(
      page.getByRole("button", { name: /Switch to admin report view|Admin Tools/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /View as Tester/i })
    ).toHaveCount(0);
    await expect(page.locator(".admin-premium-section")).toHaveCount(0);

    await page
      .getByRole("button", { name: /Return to admin report view|Switch to admin report view|Admin Tools/i })
      .click();
    await expectVisibleOverviewPulse(
      page,
      /Tester sets the starting lens/i
    );
    await expect(page.locator(".admin-premium-section")).not.toHaveCount(0);
  });

  test("keeps admin-only feature surfaces tied to admin feature mode", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toBeVisible();
    const overviewRead = page.locator(".overview-ai-pulse");
    await expect(overviewRead).toBeVisible();
    await expect(overviewRead.locator(".ai-read-title-row")).toBeVisible();
    await expect(overviewRead.locator(".ai-read-body")).toBeVisible();
    const overviewTraceKicker = overviewRead.locator(".ai-read-trace-kicker");
    if ((await overviewTraceKicker.count()) > 0) {
      await expect(overviewTraceKicker).toBeVisible();
    }
    await expect(page.locator(".admin-premium-section")).not.toHaveCount(0);

    await page.getByRole("tab", { name: "Rankings" }).click();
    const adminDiagnosticsShell = page.locator(".admin-diagnostics-shell");
    if ((await adminDiagnosticsShell.count()) > 0) {
      await expect(adminDiagnosticsShell).toBeVisible();
      await expect(page.getByText("Admin Diagnostics")).toBeVisible();
      await expect(page.getByText("AI Readout QA")).toBeVisible();
    }

    await page.getByRole("tab", { name: "Trade History" }).click();
    await expect(
      page
        .locator(".trade-browser-ai-read")
        .locator(".ai-read-panel-head")
    ).toBeVisible();
    await expect(page.getByText("Hidden Sleeper Data Import")).toHaveCount(0);

    await page
      .getByRole("button", { name: /Switch to regular report view/i })
      .click();

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toHaveCount(
      0
    );
    const overviewPulseAfterRegular = page.locator(".overview-ai-pulse");
    if ((await overviewPulseAfterRegular.count()) > 0) {
      await expect(overviewPulseAfterRegular).toBeVisible();
    }
    await expect(
      page.locator(".trade-browser-ai-read")
    ).toHaveCount(0);
    await expect(page.getByText("Hidden Sleeper Data Import")).toHaveCount(0);

    await page
      .getByRole("button", {
        name: /Return to admin report view|Switch to admin report view|Admin Tools/i,
      })
      .click();

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toBeVisible();
    await page.getByRole("tab", { name: "Trade History" }).click();
    await expect(
      page
        .locator(".trade-browser-ai-read")
        .locator(".ai-read-panel-head")
    ).toBeVisible();
    await expect(page.getByText("Hidden Sleeper Data Import")).toHaveCount(0);
  });

  test("keeps one active AI action owner across report tabs", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    const activeActionQueueCount = () =>
      page
        .locator('.report-tab-content[data-state="active"]')
        .locator(".ai-action-queue")
        .count();

    await expect.poll(activeActionQueueCount).toBeLessThanOrEqual(1);

    await page.getByRole("tab", { name: "AI Autopilot" }).click();
    await expect.poll(activeActionQueueCount).toBeLessThanOrEqual(1);
    const overviewTraceKicker = page.locator(
      ".overview-ai-pulse .ai-read-trace-kicker"
    );
    if ((await overviewTraceKicker.count()) > 0) {
      await expect(overviewTraceKicker).toBeVisible();
    }

    await page.getByRole("tab", { name: "Weekly Momentum" }).click();
    await expect.poll(activeActionQueueCount).toBeLessThanOrEqual(1);
    const waiverSection = await openReportSection(page, "Waiver Intelligence");
    await expect(waiverSection.getByText("Do this", { exact: true })).toHaveCount(0);

    await page.getByRole("tab", { name: "Rankings" }).click();
    await expect.poll(activeActionQueueCount).toBeLessThanOrEqual(1);

    await page.getByRole("tab", { name: "Trade History" }).click();
    await expect.poll(activeActionQueueCount).toBeLessThanOrEqual(1);
    await expect(page.locator(".trade-browser-ai-read")).toBeVisible();
  });

  test("shows Schedule Edge table in Hacks when stored DraftSharks SOS snapshots are healthy", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    const player =
      cachedReport.reportData.waiverIntelligence?.availableTrendingAdds[0];
    if (!player) throw new Error("Fixture waiver player is required.");

    const fetchedAt = new Date().toISOString();
    const sourceKey = "draftsharks-sos-v1";
    const weeks = [
      {
        week: 2,
        rankEcr: null,
        positionRank: "WR42",
        bestRank: null,
        worstRank: null,
        averageRank: null,
        rankStdDev: null,
        lastUpdated: fetchedAt,
        sourceKey,
        endpointKey: "draftsharks-sos-wr-week-2",
        fetchedAt,
        sourceStatus: "loaded",
        sourceType: "draftsharks-sos",
        opponent: "MIA",
        homeAway: "away" as const,
        opponentRank: 8,
        matchupStars: 4,
        matchupTier: "easy",
        matchupText: "This is a 4 star matchup.",
        isBye: false,
      },
      {
        week: 3,
        rankEcr: null,
        positionRank: "WR42",
        bestRank: null,
        worstRank: null,
        averageRank: null,
        rankStdDev: null,
        lastUpdated: fetchedAt,
        sourceKey,
        endpointKey: "draftsharks-sos-wr-week-3",
        fetchedAt,
        sourceStatus: "loaded",
        sourceType: "draftsharks-sos",
        opponent: "NE",
        homeAway: "home" as const,
        opponentRank: 11,
        matchupStars: 4,
        matchupTier: "easy",
        matchupText: "This is a 4 star matchup.",
        isBye: false,
      },
      {
        week: 4,
        rankEcr: null,
        positionRank: "WR42",
        bestRank: null,
        worstRank: null,
        averageRank: null,
        rankStdDev: null,
        lastUpdated: fetchedAt,
        sourceKey,
        endpointKey: "draftsharks-sos-wr-week-4",
        fetchedAt,
        sourceStatus: "loaded",
        sourceType: "draftsharks-sos",
        opponent: "LV",
        homeAway: "home" as const,
        opponentRank: 20,
        matchupStars: 3,
        matchupTier: "neutral",
        matchupText: "This is a 3 star matchup.",
        isBye: false,
      },
      {
        week: 15,
        rankEcr: null,
        positionRank: "WR42",
        bestRank: null,
        worstRank: null,
        averageRank: null,
        rankStdDev: null,
        lastUpdated: fetchedAt,
        sourceKey,
        endpointKey: "draftsharks-sos-wr-week-15",
        fetchedAt,
        sourceStatus: "loaded",
        sourceType: "draftsharks-sos",
        opponent: "BUF",
        homeAway: "home" as const,
        opponentRank: 3,
        matchupStars: 5,
        matchupTier: "easy",
        matchupText: "This is a 5 star matchup.",
        isBye: false,
      },
    ];
    const signal = {
      signalType: "draftsharks-sos",
      playerId: player.player_id,
      fantasyProsId: null,
      name: player.name,
      position: "WR",
      team: player.team,
      source: "DraftSharks" as const,
      updatedAt: fetchedAt,
      weeks,
      bestWeek: 15,
      bestRankEcr: null,
      bestPositionRank: "WR42",
      averageRankEcr: null,
      rankDelta: null,
      bestMatchupStars: 5,
      bestOpponentRank: 3,
      matchupWindows: buildMatchupWindowSet(weeks, {
        currentWeek: 2,
        playoffWeeks: [15, 16, 17],
      }),
      confidence: 82,
      note: "DraftSharks SOS: W2 at MIA +14.0%.",
      sourceTrace: weeks.map(week => ({
        source: "DraftSharks",
        sourceKey,
        endpointKey: week.endpointKey,
        endpointLabel: "DraftSharks WR SOS Week 2",
        status: "loaded",
        season: "2026",
        scoring: "SOS",
        week: week.week,
        position: "WR",
        rowCount: 153,
        fetchedAt,
        lastUpdated: fetchedAt,
        evidence: "Stored DraftSharks SOS fixture row.",
      })),
      traceSummary:
        "DraftSharks SOS source trace: W2/W3/W4 from stored percentage snapshots.",
    };

    cachedReport.reportData.sourceSnapshotDiagnostics = [];
    cachedReport.reportData.scheduleEdgeTargets = [
      {
        player,
        signal,
        score: 97,
      },
    ];

    await loadCachedReport(page, cachedReport, "#hacks", { admin: true });

    await expect(page.getByRole("tab", { name: "Hacks" })).toBeVisible();
    const matchupSection = await openReportSection(page, "Schedule Edge Table");
    const weekChips = matchupSection.locator(".admin-schedule-week-chip");
    await expect(matchupSection.getByText("Waiver Receiver").first()).toBeVisible();
    await expect(matchupSection.getByText("DraftSharks SOS windows")).toBeVisible();
    await expect(matchupSection.getByText(/FantasyPros matchup/i)).toHaveCount(0);
    const weekTwoChip = weekChips.filter({ hasText: "W2" }).first();
    await expect(weekTwoChip.getByLabel("MIA")).toBeVisible();
    await expect(weekTwoChip.getByLabel("4 star matchup")).toBeVisible();
    await expect(matchupSection.getByText("League Status")).toBeVisible();
    await expect(matchupSection.getByText("Range", { exact: true })).toHaveCount(0);
    await expect(matchupSection.getByText("Playoffs", { exact: true })).toHaveCount(0);
    await expect(matchupSection.getByText("Read", { exact: true })).toHaveCount(0);

    await page.getByRole("tab", { name: "Weekly Momentum" }).click();
    const waiverSection = await openReportSection(page, "Waiver Intelligence");
    await expect(waiverSection.getByText("Waiver Receiver").first()).toBeVisible();
    await expect(waiverSection.getByText(/Next 3: W2 @ MIA 4\*/i).first()).toBeVisible();
  });

  test("shows insufficient DraftSharks Schedule Edge state when SOS rows are missing", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    cachedReport.reportData.scheduleEdgeTargets = [];
    cachedReport.reportData.sourceSnapshotDiagnostics = [
      {
        sourceKey: "draftsharks-sos-wr-week-2",
        source: "DraftSharks WR SOS Week 2 snapshot",
        tableName: "providerDataSnapshots",
        snapshotKey: null,
        updatedAt: null,
        ageHours: null,
        payloadSizeBytes: null,
        rowCount: null,
        status: "missing",
        level: "warn",
        note: "DraftSharks SOS snapshot missing for WR Week 2.",
      },
    ];
    if (cachedReport.reportData.waiverIntelligence) {
      cachedReport.reportData.waiverIntelligence.weeklyEcrTargets = [];
    }

    await loadCachedReport(page, cachedReport, "#hacks", { admin: true });

    const scheduleSection = await openReportSection(page, "Schedule Edge Table");
    await expect(scheduleSection.getByText("No DraftSharks SOS rows yet")).toBeVisible();
    const snapshotCoverage = scheduleSection.locator(
      "details.admin-schedule-health-disclosure"
    );
    if ((await snapshotCoverage.count()) > 0) {
      await expect(snapshotCoverage.locator("summary")).toContainText(
        /Snapshot coverage/
      );
      await snapshotCoverage.evaluate(node => {
        const details = node as HTMLDetailsElement;
        details.open = true;
        details.dispatchEvent(new Event("toggle"));
      });
      await expect(snapshotCoverage.getByText("Missing")).toBeVisible();
      await expect(snapshotCoverage.getByText(/FantasyPros matchup/i)).toHaveCount(0);
    } else {
      await expect(snapshotCoverage).toHaveCount(0);
    }
  });

  test("persists assistant watch preferences locally across fresh app loads", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    let featureRadar = await openReportSection(page, "Assistant Feature Radar");
    let watchCard = featureRadar
      .locator(".assistant-feature-card")
      .filter({ hasText: "Watch Alerts" })
      .first();
    const riseInput = watchCard.locator('input[type="number"]').nth(0);
    const fallInput = watchCard.locator('input[type="number"]').nth(1);
    await riseInput.fill("17");
    await fallInput.fill("6");
    await watchCard
      .locator(".assistant-feature-list-row")
      .filter({ hasText: "Depth Receiver" })
      .getByRole("button", { name: "Watch" })
      .click();
    await expect(
      watchCard.locator(".assistant-watch-controls em").getByText(
        "Saved locally",
        { exact: true }
      )
    ).toBeVisible();

    const storedPreferences = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem(
          "dynasty-degenerates:watch-alert-preferences:v1"
        ) || "{}"
      )
    );
    expect(storedPreferences).toMatchObject({
      riseThresholdPct: 17,
      fallThresholdPct: 6,
    });
    expect(storedPreferences.trackedPlayerIds).toContain("wr2");

    const reloadedPage = await page.context().newPage();
    await loadCachedReport(reloadedPage, cachedReport, "", {
      preserveLocalStorage: true,
    });
    const reloadedPreferences = await reloadedPage.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem(
          "dynasty-degenerates:watch-alert-preferences:v1"
        ) || "{}"
      )
    );
    expect(reloadedPreferences).toMatchObject({
      riseThresholdPct: 17,
      fallThresholdPct: 6,
    });
    featureRadar = await openReportSection(
      reloadedPage,
      "Assistant Feature Radar"
    );
    watchCard = featureRadar
      .locator(".assistant-feature-card")
      .filter({ hasText: "Watch Alerts" })
      .first();
    await expect(watchCard.locator('input[type="number"]').nth(0)).toHaveValue(
      "17"
    );
    await expect(watchCard.locator('input[type="number"]').nth(1)).toHaveValue(
      "6"
    );
    await expect(
      watchCard
        .locator(".assistant-feature-list-row")
        .filter({ hasText: "Depth Receiver" })
        .getByRole("button", { name: "Watching" })
    ).toBeVisible();
    await reloadedPage.close();
  });

  test("shows trade calibration coverage and ledger value-movement reads", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    const featureRadar = await openReportSection(page, "Assistant Feature Radar");
    const tradeCalibrationRow = featureRadar
      .locator(".assistant-feature-coverage-row")
      .filter({ hasText: "Trade Calibration" });
    await expect(tradeCalibrationRow).toBeVisible();
    await expect(tradeCalibrationRow.getByText("Backed")).toBeVisible();
    await expect(tradeCalibrationRow).toContainText("1/8 players");
    await expect(tradeCalibrationRow).toContainText("1 riser");
    const allCoverageRows = featureRadar.locator(
      ".assistant-feature-coverage-row"
    );
    const situationDeltaRow = allCoverageRows.filter({
      hasText: /Situation|Delta|Role Boost|1 role/i,
    });
    const hasSituationRow = (await situationDeltaRow.count()) > 0;
    if (hasSituationRow) {
      const firstSituationRow = situationDeltaRow.first();
      await expect(firstSituationRow).toBeVisible();
      if ((await firstSituationRow.getByText("Backed").count()) > 0) {
        await expect(firstSituationRow.getByText("Backed")).toBeVisible();
      }
      if ((await firstSituationRow.getByText(/1\/8 players/i).count()) > 0) {
        await expect(firstSituationRow).toContainText(/1\/8 players/i);
      }
      if ((await firstSituationRow.getByText(/1 strong/i).count()) > 0) {
        await expect(firstSituationRow).toContainText(/1 strong/i);
      }
      if ((await firstSituationRow.getByText(/1 role boost/i).count()) > 0) {
        await expect(firstSituationRow).toContainText(/1 role boost/i);
      }
    }

    await page.getByRole("tab", { name: "Rankings" }).click();
    const scoutSection = await openReportSection(page, "Scout Leaguemates");
    const scoutInventoryTitle = scoutSection.getByText(
      /Manager Rank Inventory|Manager Inventory|Roster Rank/i
    );
    if ((await scoutInventoryTitle.count()) > 0) {
      await expect(scoutInventoryTitle).toBeVisible();
    }
    const testerAssetCard = scoutSection
      .locator(".trade-war-manager-board-card")
      .filter({ hasText: "Tester" })
      .first();
    await testerAssetCard.locator("summary").click();
    await expect(testerAssetCard.locator(".trade-war-bar-qb")).toContainText("#");
    await expect(testerAssetCard).toContainText("Dynasty");
    await expect(testerAssetCard).toContainText("Contender");
    await expect(testerAssetCard).toContainText("Rebuilder");
    await expect(testerAssetCard.getByText("Sample Quarterback")).toBeVisible();
    await expect(
      testerAssetCard
        .locator(".trade-war-manager-board-asset")
        .filter({ hasText: "Sample Quarterback" })
        .locator(".interactive-identity-avatar")
        .first()
    ).toBeVisible();
    await expect(
      testerAssetCard.locator(
        ".trade-war-manager-board-section-pick .trade-war-manager-board-section-head"
      )
    ).toContainText("Pick Value");
    await expect(testerAssetCard.locator(".trade-war-manager-board-rank-head").first()).toContainText("Ovr");
    await expect(testerAssetCard.locator(".trade-war-manager-board-rank-head").first()).toContainText("Pos");
    await expect(testerAssetCard.getByText("2027 1st")).toBeVisible();

    await page.getByRole("tab", { name: "Trade History" }).click();
    const tradeWarRoom = await openReportSection(page, "Trade War Room");
    await expect(tradeWarRoom.getByText("Value Match Finder")).toBeVisible();
    const firstTradeSide = tradeWarRoom.locator(".trade-war-side").first();
    const firstTradeSideInput = firstTradeSide.locator("input");
    if (!(await firstTradeSideInput.isVisible())) {
      await firstTradeSide.locator(".trade-war-picker-toggle").click();
      await expect(firstTradeSideInput).toBeVisible();
    }
    await firstTradeSideInput.fill("Depth Receiver");
    await firstTradeSide
      .getByRole("button", { name: /Depth Receiver/i })
      .first()
      .click();
    const valueMatchPanel = tradeWarRoom.locator(".trade-war-value-match-panel");
    await expect(valueMatchPanel.getByText(/Rival can match/i).first()).toBeVisible();
    await expect(valueMatchPanel.getByText("2026 1st").first()).toBeVisible();

    await expect(page.getByText("Trade Receipts").first()).toBeVisible();
    await page.getByRole("button", { name: /Trade Receipts/ }).click();
    const tradeLedgerDialog = page.getByRole("dialog", {
      name: /Trade Receipts/,
    });
    await expect(tradeLedgerDialog.getByText("2026-05-01")).toBeVisible();
    await tradeLedgerDialog
      .getByRole("button", {
        name: /Open trade detail for 2026-05-01: Tester and Rival/i,
      })
      .click();
    const detailDialog = page.getByRole("dialog", {
      name: /Trade Ledger Detail/i,
    });
    await expect(detailDialog.getByText("Riser +").first()).toBeVisible();
    if ((await detailDialog.getByText(/validated/i).count()) > 0) {
      await expect(detailDialog.getByText(/validated/i).first()).toBeVisible();
    }
  });

  test("keeps trade war room rank labels clear and hides completed draft-year picks", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport("trade-war-completed-picks");
    cachedReport.reportData.draftPicks = [
      {
        round: 1,
        pick: 1,
        playerName: "Completed Rookie",
        playerPos: "RB",
        manager: "Tester",
        adp: null,
        ktcValue: null,
        currentKtcValue: null,
        valueGain: null,
        draftYear: "2026",
        draftKind: "rookie",
        player_id: "completed-rookie",
      },
    ];
    await loadCachedReport(page, cachedReport, "#trades");

    await page.getByRole("tab", { name: "Rankings" }).click();
    const scoutSection = await openReportSection(page, "Scout Leaguemates");
    const rosterScanner = scoutSection.locator(".trade-war-manager-rank-inventory");
    const testerAssetCard = rosterScanner
      .locator(".trade-war-manager-board-card")
      .filter({ hasText: "Tester" })
      .first();

    await testerAssetCard.locator("summary").click();
    await expect(rosterScanner).not.toContainText("Room #");
    await expect(rosterScanner).not.toContainText("2026 1st");
    await expect(rosterScanner).not.toContainText("2026 2nd");
    await expect(rosterScanner.getByText("2027 1st")).toBeVisible();
    await expect(testerAssetCard.locator(".trade-war-manager-board-rank-head").first()).toContainText("Ovr");
    await expect(testerAssetCard.locator(".trade-war-manager-board-rank-head").first()).toContainText("Pos");
    await expect(testerAssetCard.locator(".trade-war-manager-board-section-pick .trade-war-manager-board-rank-head")).toContainText("Rnd");
  });

  test("persists portfolio snapshots locally across fresh app loads", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    let featureRadar = await openReportSection(page, "Assistant Feature Radar");
    let portfolioCard = featureRadar
      .locator(".assistant-feature-card")
      .filter({ hasText: "Portfolio View" })
      .first();
    await portfolioCard.getByRole("button", { name: /Save Snapshot/i }).click();
    await expect(portfolioCard.getByText("Portfolio snapshot saved")).toBeVisible();

    const storedSnapshots = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem(
          "dynasty-degenerates:portfolio-snapshots:v1"
        ) || "[]"
      )
    );
    expect(storedSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leagueName: cachedReport.leagueName,
          manager: "Tester",
          playerCount: expect.any(Number),
        }),
      ])
    );

    const reloadedPage = await page.context().newPage();
    await loadCachedReport(reloadedPage, cachedReport, "", {
      preserveLocalStorage: true,
    });
    featureRadar = await openReportSection(
      reloadedPage,
      "Assistant Feature Radar"
    );
    portfolioCard = featureRadar
      .locator(".assistant-feature-card")
      .filter({ hasText: "Portfolio View" })
      .first();
    await expect(
      portfolioCard.getByText(/1 saved team snapshot/i)
    ).toBeVisible();
    await reloadedPage.close();
  });

  test("keeps Owner Intel pills readable on mobile", async ({ page }) => {
    const cachedReport = createCachedCommandCenterReport("owner-intel-mobile-pills");
    await loadCachedReport(page, cachedReport, "#overview", { admin: false });

    const ownerIntelSection = await openReportSection(page, "Owner Intel Lab");
    await expect(ownerIntelSection.getByText(/Thanos|You Better Win|Elite Value/i).first()).toBeVisible();
    const clippedOwnerPills = await ownerIntelSection
      .locator(
        [
          ".command-depth-subtitle",
          ".command-depth-badges .command-mini-badge",
          ".owner-intel-score-strip strong",
          ".owner-intel-score-strip em",
        ].join(", ")
      )
      .evaluateAll(nodes =>
        nodes
          .filter(node => {
            const element = node as HTMLElement;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && Boolean(element.textContent?.trim());
          })
          .map(node => {
            const element = node as HTMLElement;
            return {
              text: element.textContent?.replace(/\s+/g, " ").trim(),
              clippedWidth: element.scrollWidth - element.clientWidth,
              clippedHeight: element.scrollHeight - element.clientHeight,
            };
          })
          .filter(item => item.clippedWidth > 1 || item.clippedHeight > 1)
      );
    expect(clippedOwnerPills).toEqual([]);
  });

  test("shows Cross League Exposure on regular Overview with cross-league filters", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport("player-hoard-overview");
    const sleeperLeagues = [
      {
        leagueId: cachedReport.leagueId,
        name: cachedReport.leagueName,
        avatarUrl: cachedReport.leagueLogo,
        season: "2026",
        format: cachedReport.leagueFormat,
        mobileFormat: cachedReport.leagueFormat,
        totalRosters: 4,
        standingsRank: 1,
        powerRank: 1,
        managerAnchors: [],
        rosterPlayers: [
          {
            playerId: "shared-qb",
            name: "Shared Quarterback",
            position: "QB",
            team: "BUF",
            value: 6200,
            positionRank: "QB4",
            rosterSpot: "active",
          },
          {
            playerId: "taxi-wr",
            name: "Taxi Receiver",
            position: "WR",
            team: "DAL",
            value: 900,
            positionRank: "WR80",
            rosterSpot: "taxi",
          },
        ],
      },
      {
        leagueId: "player-hoard-beta",
        name: "Beta Exposure",
        avatarUrl: null,
        season: "2026",
        format: "Dynasty SF PPR",
        mobileFormat: "Dynasty SF",
        totalRosters: 4,
        standingsRank: 2,
        powerRank: 2,
        managerAnchors: [],
        rosterPlayers: [
          {
            playerId: "shared-qb",
            name: "Shared Quarterback",
            position: "QB",
            team: "BUF",
            value: 6100,
            positionRank: "QB4",
            rosterSpot: "active",
          },
        ],
      },
      {
        leagueId: "player-hoard-gamma",
        name: "Gamma Exposure",
        avatarUrl: null,
        season: "2026",
        format: "Redraft PPR",
        mobileFormat: "Redraft",
        totalRosters: 4,
        standingsRank: 3,
        powerRank: 3,
        managerAnchors: [],
        rosterPlayers: [
          {
            playerId: "shared-qb",
            name: "Shared Quarterback",
            position: "QB",
            team: "BUF",
            value: 6000,
            positionRank: "QB4",
            rosterSpot: "active",
          },
          {
            playerId: "single-te",
            name: "Single Tight End",
            position: "TE",
            team: "KC",
            value: 1400,
            positionRank: "TE18",
            rosterSpot: "active",
          },
        ],
      },
    ];

    await loadCachedReport(page, cachedReport, "#overview", {
      admin: true,
      sleeperLeagues,
    });

    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("Pick The Target")).toHaveCount(0);
    const playerHoard = await openReportSection(page, "Cross League Exposure");
    await expect(playerHoard).toContainText(
      /Roster overlap and stash risk|Every rostered player tied to this Sleeper username/i
    );
    await expect(playerHoard.getByText("Shared Quarterback")).toBeVisible();
    const leagueNames = playerHoard.locator(".home-portfolio-league-names");
    await expect(leagueNames.filter({ hasText: "Beta Exposure" }).first()).toContainText("Beta Exposure");
    await expect(leagueNames.filter({ hasText: "Gamma Exposure" }).first()).toContainText("Gamma Exposure");

    await playerHoard
      .getByLabel("Sort portfolio players")
      .selectOption("value");
    await expect(playerHoard.locator(".home-portfolio-row").first()).toContainText(
      "Shared Quarterback"
    );

    await playerHoard.getByRole("button", { name: "3+ Leagues" }).click();
    await expect(playerHoard.getByText("1 of 3 shown")).toBeVisible();
    await expect(playerHoard.getByText("Shared Quarterback")).toBeVisible();
    await expect(playerHoard.getByText("Single Tight End")).toHaveCount(0);

    await playerHoard.getByRole("button", { name: "Taxi/IR" }).click();
    await expect(playerHoard.getByText("1 of 3 shown")).toBeVisible();
    await expect(playerHoard.getByText("Taxi Receiver")).toBeVisible();
    await expect(playerHoard.getByText("Shared Quarterback")).toHaveCount(0);

    await playerHoard.getByPlaceholder("Search players").fill("nobody here");
    await expect(playerHoard.getByText("No roster edges match those filters.")).toBeVisible();
    await playerHoard
      .locator(".home-portfolio-empty")
      .getByRole("button", { name: "Reset filters" })
      .click();
    await expect(playerHoard.getByText("3 of 3 shown")).toBeVisible();
    await expect(playerHoard.getByText("Shared Quarterback")).toBeVisible();
  });

  test("keeps blueprint export controls print-focused without clipboard copy", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);
    await page.evaluate(() => {
      window.print = () => {
        window.sessionStorage.setItem("blueprint-print-called", "true");
      };
    });

    const blueprintSection = await openReportSection(
      page,
      "Monthly Team Blueprint"
    );
    await blueprintSection
      .getByRole("button", { name: /Generate Team Blueprint/i })
      .click();

    await expect(
      blueprintSection.getByRole("button", { name: /Copy Share Text/i })
    ).toHaveCount(0);
    await expect(
      blueprintSection.getByRole("button", { name: /Print \/ Save PDF/i })
    ).toBeVisible();
    await expect(
      blueprintSection.getByRole("button", { name: /Poster View/i })
    ).toBeVisible();

    await blueprintSection
      .getByRole("button", { name: /Print \/ Save PDF/i })
      .click();
    await expect(
      blueprintSection.getByText("Opening print dialog")
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.sessionStorage.getItem("blueprint-print-called")
        )
      )
      .toBe("true");
  });

  test("keeps command-center expansion hidden for regular report viewers", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, "", { admin: false });

    await expect(page.locator(".overview-ai-pulse:visible")).toHaveCount(0);
    await expect(page.locator(".admin-premium-tab")).toHaveCount(0);
    await expect(page.locator(".admin-premium-section")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /View as/i })).toHaveCount(0);
    await expect(page.getByText("Monthly Team Blueprint")).toHaveCount(0);
    await expect(page.getByText("League Power Rankings")).toHaveCount(0);
    await expect(
      page.locator('details.report-disclosure').filter({ hasText: "Trade Finder" })
    ).toHaveCount(0);
  });

  test("shows pre-draft redraft blocking copy on overview", async ({
    page,
  }) => {
    const cachedReport = createRedraftCommandCenterReport(
      "predraft-redraft-command-league",
      false
    );
    await loadCachedReport(page, cachedReport);

    await expect(
      page.getByText("Draft-dependent analysis unlocks after this league drafts")
    ).toBeVisible();
    await expect(
      page
        .locator(".report-pre-draft-empty-state")
        .filter({
          hasText: "Draft-dependent analysis unlocks after this league drafts",
        })
        .first()
    ).toBeVisible();
    await expect(
      page.locator("details.report-disclosure").filter({
        hasText: "Monthly Team Blueprint",
      })
    ).toHaveCount(0);
  });

  test("locks AI Autopilot to redraft lens for redraft-only leagues", async ({
    page,
  }) => {
    const cachedReport = createRedraftCommandCenterReport(
      "autopilot-redraft-command-league",
      true
    );
    await loadCachedReport(page, cachedReport, "#autopilot");

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toBeVisible();
    await expect(page.getByText("Tester win-now cockpit")).toBeVisible();
    await expect(page.getByText("Tester dynasty cockpit")).toHaveCount(0);
    await expect(page.locator(".autopilot-mode-toggle")).toHaveCount(0);
  });

  test("shows live-data AI Autopilot only for admin view", async ({ page }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, "#autopilot");

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toBeVisible();
    await expect(page.getByText("Tester dynasty cockpit")).toBeVisible();
    await expect(page.getByText("Live report data")).toBeVisible();
    await expect(page.getByText("Team Direction")).toBeVisible();
    const actionQueue = page.locator(".ai-action-queue").first();
    await expect(actionQueue).toBeVisible();
    await expect(actionQueue.getByText("Daily AI Verdict")).toBeVisible();
    await expect(actionQueue.locator(".ai-action-queue-head")).toBeVisible();
    await expect(actionQueue.locator(".ai-action-queue-primary")).toBeVisible();
    await expect(actionQueue.locator(".ai-action-queue-read")).toBeVisible();
    await expect(actionQueue.locator(".ai-action-queue-read p")).toBeVisible();
    await expect(actionQueue.getByRole("button", { name: "Done" })).toHaveCount(0);
    const storedAIOutcomes = await page.evaluate(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("dynasty-degenerates:ai-action-memory:v1") ||
          "{\"outcomes\":[]}"
      ) as { outcomes?: Array<{ status?: string }> };
      return parsed.outcomes || [];
    });
    expect(storedAIOutcomes).toEqual([]);
    await expect(page.getByText("Depth Receiver").first()).toBeVisible();
    await expect(page.getByText("Sample Runner").first()).toBeVisible();
    await expect(page.getByText("Weekly Action Plan")).toBeVisible();
    await expect(page.getByText("Review starter slot")).toBeVisible();
    await expect(page.getByText("Sample Tight End").first()).toBeVisible();
    await expect(page.getByText("Best weekly pressure test")).toBeVisible();
    await expect(page.getByText("Review against")).toBeVisible();
    await expect(page.getByText(/Pressure-test Sample Tight End with Replacement Tight End/).first()).toBeVisible();
    await expect(page.getByText("Take me out")).toHaveCount(0);
    await expect(page.getByText(/Start Replacement Tight End over Sample Tight End/)).toHaveCount(0);
    await expect(page.getByText("AI Edge Review")).toBeVisible();
    await expect(page.getByText("Value and schedule watchlist")).toBeVisible();
    await expect(page.getByText("Fade pressure")).toBeVisible();
    await expect(page.getByText("Add/swap watch")).toBeVisible();
    await expect(page.getByText("Schedule edge")).toBeVisible();
    await expect(
      page.getByText(/Value guardrail|Value and schedule watchlist/i)
    ).toBeVisible();
    await expect(page.getByText("Future Pick Market")).toBeVisible();
    await expect(page.getByText("Likely rookie range")).toBeVisible();
    await expect(page.getByText("Trade screenshot view").first()).toBeVisible();
    await page
      .getByRole("button", { name: /Trade screenshot view/i })
      .first()
      .click();
    await expect(
      page.getByLabel(/Screenshot-ready trade card/i).first()
    ).toBeVisible();
    await expect(page.getByText("Manager Tendency Model")).toBeVisible();
    await expect(page.getByText("Thin history")).toBeVisible();
    await page
      .locator(".autopilot-recommendation-card")
      .filter({ hasText: "Depth Receiver" })
      .locator("details.autopilot-reasoning")
      .first()
      .locator("summary")
      .click();
    const roleBoostText = page.getByText(/Role Boost|fresh context/i);
    if ((await roleBoostText.count()) > 0) {
      await expect(roleBoostText.first()).toBeVisible();
    }

    await page.getByRole("button", { name: "Redraft" }).click();
    await expect(page.getByText("Tester win-now cockpit")).toBeVisible();
    await expect(page.getByText("Weekly ceiling", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Bench reads held back").first()
    ).toBeVisible();
  });

  test("keeps AI Autopilot stable when a report payload has partial new fields", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    const cachedReport = createCachedCommandCenterReport();
    cachedReport.reportData.schedulePlanning = {
      source: "partial-cache",
      status: "ready",
      updatedAt: null,
      rosterGaps: [],
      streamerCandidates: {},
      byeWeekNotes: [],
    } as any;

    await loadCachedReport(page, cachedReport, "#autopilot");

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toBeVisible();
    await expect(page.getByText("AI Team Autopilot")).toBeVisible();
    await expect(page.getByText("Tester dynasty cockpit")).toBeVisible();
    await expect(page.getByText("Live report data")).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("does not expose AI Autopilot to regular report viewers", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    const telemetryEvents: unknown[] = [];
    await page.exposeFunction(
      "captureReportNextMoveTelemetry",
      (event: unknown) => {
        telemetryEvents.push(event);
      }
    );
    await page.addInitScript(() => {
      window.addEventListener(
        "dynasty-degens:report-next-move-visible",
        (event) => {
          const detail = event instanceof CustomEvent ? event.detail : null;
          void (window as any).captureReportNextMoveTelemetry?.(detail);
        }
      );
    });
    await loadCachedReport(page, cachedReport, "#autopilot", { admin: false });

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toHaveCount(
      0
    );
    await expect(page.getByText("AI Team Autopilot")).toHaveCount(0);
    await expect(page.getByText("Tester dynasty cockpit")).toHaveCount(0);
    await expect(page.getByText("Your Next Move")).toBeVisible();
    const nextMove = page.locator(".report-next-move-brief");
    await expect(nextMove).toBeVisible();
    await expect(nextMove.locator(".ai-action-queue-primary")).toBeVisible();
    await expect(nextMove.locator(".ai-action-queue-read p")).toBeVisible();
    await expect(nextMove).not.toContainText(/KTC|FantasyCalc|FantasyPros|DraftSharks|Sleeper/i);
    await expect.poll(() => telemetryEvents.length).toBe(1);
    const telemetryEvent = telemetryEvents[0] as Record<string, unknown>;
    expect(telemetryEvent).toEqual({
      mode: "dynasty",
      decision: expect.any(String),
      actionSource: expect.any(String),
      readStrength: expect.any(String),
      queueCount: 1,
      hasBlockers: expect.any(Boolean),
      hasMissingEvidence: expect.any(Boolean),
    });
    expect(["do", "watch", "hold", "blocked"]).toContain(
      telemetryEvent.decision
    );
    expect(["lineup", "waiver", "trade", "strategy"]).toContain(
      telemetryEvent.actionSource
    );
    expect(JSON.stringify(telemetryEvent)).not.toMatch(
      /command-center-league|Tester|Sample|Waiver Receiver|KTC|FantasyCalc|FantasyPros|DraftSharks|Sleeper/i
    );
    await expect(page).toHaveURL(
      new RegExp(`leagueId=${cachedReport.leagueId}(#overview)?$`)
    );
  });

  test("reveals the report if the success handoff timer stalls", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport("success-handoff-league");
    await mockLeagueAnalysisFlow(page, cachedReport);
    await page.addInitScript(() => {
      const originalSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = ((handler, timeout, ...args) => {
        const delay = Number(timeout || 0);

        if (delay >= 2800 && delay <= 3000) {
          (window as any).__blockedReportSuccessHandoffTimer = true;
          return 987_654_321 as unknown as number;
        }

        return originalSetTimeout(handler, timeout, ...args);
      }) as typeof window.setTimeout;
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Enter Your Sleeper League ID").fill(cachedReport.leagueId);
    await page.getByRole("button", { name: "Run Degenerate Analysis" }).click();

    await expect(
      page.getByRole("heading", { name: "League Report Ready" })
    ).toBeVisible({
      timeout: 8_000,
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean((window as any).__blockedReportSuccessHandoffTimer)
        )
      )
      .toBe(true);
    await expect(
      page.getByRole("heading", { name: "League Report Ready" })
    ).toBeHidden({
      timeout: 9_000,
    });
    await expect(page.getByText("Your Next Move")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
  });

  test("shows waiver intelligence with the other weekly momentum sections for regular viewers", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, "#momentum", { admin: false });

    await expect(
      page.getByRole("tab", { name: "Weekly Momentum" })
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`leagueId=${cachedReport.leagueId}#momentum$`)
    );
    await expect(page.getByText("Recent Transactions")).toBeVisible();
    await expect(page.getByText("Market Movers")).toBeVisible();
    await expect(page.getByText("Trending")).toBeVisible();
    await expect(page.locator(".trade-browser-ai-read")).toHaveCount(0);
    await expect(page.getByText("Waiver Intelligence")).toBeVisible();
    await openReportSection(page, "Waiver Intelligence");
    await expect(page.getByText("Waiver Receiver").first()).toBeVisible();
    const waiverGrid = page.locator(".waiver-intel-grid").first();
    const waiverCards = waiverGrid.locator(".waiver-intel-card");
    await expect(waiverCards.first()).toBeVisible();
    const waiverGridBox = await waiverGrid.boundingBox();
    const nextSectionBox = await page
      .locator("details.report-disclosure")
      .filter({ hasText: "Recent Transactions" })
      .first()
      .boundingBox();
    expect(waiverGridBox?.height || 0).toBeGreaterThan(120);
    if (waiverGridBox && nextSectionBox) {
      expect(waiverGridBox.y + waiverGridBox.height).toBeLessThanOrEqual(
        nextSectionBox.y
      );
    }
    if ((page.viewportSize()?.width || 0) < 640) {
      const firstCardBox = await waiverCards.first().boundingBox();
      const secondCardBox = await waiverCards.nth(1).boundingBox();
      if (firstCardBox && secondCardBox) {
        expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y);
      }
    }

    await page.getByRole("tab", { name: "Trade History" }).click();
    await expect(page.locator(".trade-browser-ai-read")).toBeVisible();
  });

  test("shows waiver intelligence with the other weekly momentum sections for admins", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    const omittedCandidate =
      cachedReport.reportData.waiverIntelligence?.omittedCandidates?.[0];
    if (omittedCandidate && cachedReport.reportData.waiverIntelligence) {
      cachedReport.reportData.waiverIntelligence.bestTaxiStashes = [
        {
          player_id: omittedCandidate.player_id,
          name: omittedCandidate.name,
          pos: omittedCandidate.pos,
          team: omittedCandidate.team,
          owner: null,
          count: 0,
          ktcValue: omittedCandidate.value,
          currentPositionRank: omittedCandidate.rank,
        },
      ];
    }
    await loadCachedReport(page, cachedReport, "#momentum");

    await expect(
      page.getByRole("tab", { name: "Weekly Momentum" })
    ).toBeVisible();
    await expect(page.getByText("Waiver Intelligence")).toBeVisible();
    await openReportSection(page, "Waiver Intelligence");
    const waiverCards = page
      .locator(".waiver-ai-target-strip")
      .locator(".waiver-ai-target-card");
    const gridCards = page
      .locator(".waiver-intel-grid")
      .locator(".waiver-intel-card");
    if ((await waiverCards.count()) > 0) {
      await expect(waiverCards.first()).toBeVisible();
      await expect(waiverCards.filter({ hasText: "Dallen Bentley" })).toHaveCount(
        0
      );
    } else {
      await expect(gridCards.first()).toBeVisible();
      await expect(gridCards.filter({ hasText: "Dallen Bentley" })).toHaveCount(0);
    }
    const noTeamText = page.getByText(
      /No active NFL team|No active team|No NFL team|Free agent/i
    );
    if ((await noTeamText.count()) > 0) {
      await expect(noTeamText.first()).toBeVisible();
    }
    await expect(page.getByText("Recent Transactions")).toBeVisible();
    await expect(page.getByText("Market Movers")).toBeVisible();
    await expect(page.getByText("Trending")).toBeVisible();
  });

  test("opens added transaction players with the current roster owner", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, "#momentum");

    const recentTransactions = await openReportSection(
      page,
      "Recent Transactions"
    );
    const transactionDateGroup = recentTransactions
      .locator(".recent-transaction-date-group")
      .filter({ hasText: "2026-05-07" });
    await expect(transactionDateGroup).toHaveCount(1);
    await transactionDateGroup
      .locator(".recent-transaction-date-toggle")
      .click();

    const addedPlayerButton = transactionDateGroup
      .locator("button.recent-transaction-player-add")
      .filter({ hasText: "Waiver Receiver" });
    await expect(addedPlayerButton).toHaveCount(1);
    await addedPlayerButton.click();

    const dialog = page
      .getByRole("dialog")
      .filter({ hasText: "Waiver Receiver" });
    await expect(dialog.getByText("Rostered By:")).toBeVisible();
    await expect(dialog.getByText("Tester")).toBeVisible();
    await expect(dialog.getByText("AVAILABLE")).toHaveCount(0);
  });

  test("trade browser explains an empty redraft ledger without inventing trades", async ({
    page,
  }) => {
    const cachedReport = createCachedRedraftReport(
      "command-center-empty-trades"
    );
    await loadCachedReport(page, cachedReport, "#trades");

    const tradeRead = page.locator(".trade-browser-ai-read");
    const hasTradeRead = (await tradeRead.count()) > 0;
    if (hasTradeRead) {
      const firstTradeRead = tradeRead.first();
      await expect(firstTradeRead).toBeVisible();
      const titleRow = firstTradeRead
        .locator(".ai-read-title-row, .ai-read-panel-head, .ai-read-headline")
        .first();
      if ((await titleRow.count()) > 0) {
        await expect(titleRow).toBeVisible();
      }
      await expect(firstTradeRead.getByText("0 trades")).toBeVisible();
      const emptyStateMessage = firstTradeRead.getByText(
        /No completed trades were returned\. The browser shows an empty state instead of manufacturing trade history\./i
      );
      if ((await emptyStateMessage.count()) > 0) {
        await expect(emptyStateMessage).toBeVisible();
      }
    }

    if (!hasTradeRead) {
      const tradeReceiptsButton = page.getByRole("button", {
        name: /Completed trades/i,
      });
      await expect(tradeReceiptsButton).toBeVisible();
      await expect(tradeReceiptsButton.locator("strong")).toContainText("0");
      await expect(page.getByRole("dialog", { name: /Trade Ledger Detail/i })).toHaveCount(0);
    }
  });
});
