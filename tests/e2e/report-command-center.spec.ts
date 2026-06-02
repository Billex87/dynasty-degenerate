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
  await page.addInitScript(
    ({
      key,
      value,
      sessionKey,
      usersKey,
      deltaKey,
      deltaSnapshots,
      user,
      leagueOption,
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
      if (!admin) return;
      window.sessionStorage.setItem(
        "dynasty-degenerates:admin-unlock-dismissed:v1",
        "true"
      );
      window.sessionStorage.setItem(
        "dynasty-degenerates:admin-passphrase-verified-session:v1",
        "true"
      );
      window.localStorage.setItem(
        sessionKey,
        JSON.stringify({
          username: user.username,
          user,
          leagues: [leagueOption],
          adminViewMode: "admin",
          savedAt: Date.now(),
        })
      );
      window.localStorage.setItem(
        usersKey,
        JSON.stringify([
          {
            ...user,
            leagues: [leagueOption],
            recentLeagueIds: [leagueOption.leagueId],
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
      user: adminUser,
      leagueOption: league,
      admin: useAdminSession,
      preserve: preserveLocalStorage,
    }
  );
  await page.goto(`/?leagueId=${cachedReportForBrowser.leagueId}${hash}`, {
    waitUntil: "domcontentloaded",
  });
}

async function openReportSection(
  page: import("@playwright/test").Page,
  title: string
) {
  const section = page
    .locator("details.report-disclosure")
    .filter({ hasText: title })
    .first();
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
  auditedInfo.browserConsoleIssues = browserConsoleIssues;

  page.on("console", message => {
    if (message.type() !== "error") return;
    const location = message.location();
    const source = location.url
      ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})`
      : "";
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
  expect(auditedInfo.browserConsoleIssues || []).toEqual([]);
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
  title: RegExp | string
) {
  const read = page.locator(selector).first();
  await expect(read).toBeVisible();
  await expect(read).not.toHaveAttribute("open", "");
  await expect(read.locator(".ai-read-mobile-title")).toContainText(title);
  await expect(read.locator(".ai-read-mobile-takeaway")).toBeVisible();
  await expect(read.locator(".ai-read-mobile-toggle")).toContainText(
    "Read more"
  );
  await expect(read.locator(".ai-read-mobile-expanded")).toBeHidden();

  const collapsedBox = await read.boundingBox();
  expect(collapsedBox?.height || 0).toBeLessThan(150);
  await expectNoHorizontalOverflow(page);

  await read.locator("summary").click();
  await expect(read).toHaveAttribute("open", "");
  await expect(read.locator(".ai-read-mobile-expanded")).toBeVisible();
  await expect(read.locator(".ai-read-body")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await read.locator("summary").click();
  await expect(read).not.toHaveAttribute("open", "");
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
      ".overview-ai-pulse.ai-read-panel-desktop"
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
    await expect(page.locator(".admin-premium-section")).toHaveCount(5);
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
    await expect(
      page
        .locator(".team-blueprint-ai.ai-read-panel-desktop")
        .getByText("Blueprint AI Summary")
    ).toBeVisible();
    await expect(page.getByText("Stored 2026-05")).toBeVisible();

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
    await leaguePowerCard
      .locator("details.ai-read-panel-compact")
      .evaluate(node => node.setAttribute("open", ""));
    await expect(leaguePowerCard.getByText("ranking-only")).toBeVisible();
    await expect(leaguePowerCard.getByText("Why this fired")).toBeVisible();
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
        .locator(".team-breakdown-recon .ai-read-panel-desktop")
        .getByText("Suggested next move")
    ).toBeVisible();
    await expect(
      page
        .locator(".team-breakdown-recon .ai-read-panel-desktop")
        .getByText(/use Trade Finder for specific partners/i)
    ).toBeVisible();
    await expect(
      page
        .locator(".team-breakdown-recon .ai-read-panel-desktop")
        .getByText("Why this fired")
    ).toBeVisible();
    await openReportSection(page, "Owner Intel Lab");
    await page.locator(".command-depth-tile").filter({ hasText: "Tester" }).click();
    const ownerPcbSystem = page.getByTestId("owner-intel-pcb-system");
    await expect(ownerPcbSystem).toBeVisible();
    await expect(ownerPcbSystem.locator(".owner-intel-pcb-routes")).toBeVisible();
    const situationRadarRead = ownerPcbSystem
      .locator(".ai-read-panel-desktop")
      .filter({ hasText: "AI Situation Radar" })
      .first();
    await expect(situationRadarRead).toBeVisible();
    await expect(situationRadarRead).toContainText(
      /Depth Receiver is the best backed roster riser/i
    );
    await expect(ownerPcbSystem.locator(".owner-intel-pcb-node")).toHaveCount(12);
    await expect(
      page
        .locator(".owner-intel-read-grid .ai-read-panel-desktop")
        .first()
        .getByText("Why this fired")
    ).toBeVisible();
    const notesRail = ownerPcbSystem
      .locator(".owner-intel-wild-notes.ai-read-panel-desktop")
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
    await expect(page.getByText("Season AI Read")).toHaveCount(0);
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
    await expect(swapRead.getByText("Why this swap").first()).toBeVisible();
    await swapRead.getByText("Why this swap").first().click();
    await expect(swapRead.getByText(/Projected edge/i).first()).toBeVisible();
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

    const tradeFinderSection = await openReportSection(page, "Trade partners, package lanes");
    await expect(
      tradeFinderSection.locator("label").filter({ hasText: "Your team" })
    ).toHaveCount(0);
    await expect(
      page
        .locator(".ai-read-panel-desktop")
        .filter({ hasText: "Fair trade finder" })
        .first()
    ).toBeVisible();
    await expect(
      page.locator(".trade-finder-package-card").first()
    ).toBeVisible();
    await expect(page.locator(".trade-partner-card")).toHaveCount(1);
    const tradePartnerRead = page
      .locator(".trade-partner-card details.ai-read-panel-compact")
      .first();
    await tradePartnerRead.evaluate(node => node.setAttribute("open", ""));
    await expect(tradePartnerRead.getByText("Why this fired")).toBeVisible();
    await expect(
      tradePartnerRead.getByRole("button", { name: /Save trade read/i })
    ).toHaveCount(0);
    await expect(page.getByText("Observed trade reads")).toHaveCount(0);
    await expect(page.locator(".league-exploit-card").first()).toBeVisible();

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
      await expect(aiReadoutSection.getByText("One action owner")).toBeVisible();
      const surfaceRegistry = aiReadoutSection.getByLabel("AI surface registry");
      await expect(surfaceRegistry.getByText("Surface Registry")).toBeVisible();
      await expect(
        surfaceRegistry.getByText("One action owner, every other read is evidence")
      ).toBeVisible();
      await expect(surfaceRegistry.getByText("Action owner").first()).toBeVisible();
      await expect(surfaceRegistry.getByText("Context only").first()).toBeVisible();
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
          .getByText("Lower-ranked alternates")
      ).toBeVisible();
      await expect(
        aiReadoutSection.getByText(/Conflict check|Source health|Hard blocker|Missing evidence/i).first()
      ).toBeVisible();
      await expect(aiReadoutSection.getByText("readouts observed")).toBeVisible();
      await expect(aiReadoutSection.getByText("duplicate-risk flags", { exact: true })).toBeVisible();
      await expect(
        aiReadoutSection
          .getByLabel("AI readout count by tab")
          .getByText("AI Autopilot")
      ).toBeVisible();
      await expect(
        aiReadoutSection.getByText("Trade Finder / Partner Reads")
      ).toBeVisible();
      await expect(
        aiReadoutSection.getByText("Player Situation Reads", { exact: true })
      ).toBeVisible();
      await expect(
        aiReadoutSection.getByText(/player situation reads have fresh or usable context/i)
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
      ".overview-ai-pulse.ai-read-panel-mobile",
      "Owner Intel Lab Upgrade Path"
    );

    await openReportSection(page, "Monthly Team Blueprint");
    await page.locator("button.command-primary-action").click();
    await expect(page.getByText("The Monthly Blueprint")).toBeVisible();
    await expectCompactMobileAIRead(
      page,
      ".team-blueprint-ai.ai-read-panel-mobile",
      "Blueprint AI Summary"
    );

    await page.getByRole("tab", { name: "Rankings" }).click();
    await openReportSection(page, "Full Roster Rankings");
    await expectCompactMobileAIRead(
      page,
      ".rankings-ai-read.ai-read-panel-mobile",
      "Ranking board market signal"
    );

    await page.getByRole("tab", { name: "Trade History" }).click();
    await expectCompactMobileAIRead(
      page,
      ".trade-browser-ai-read.ai-read-panel-mobile",
      "Trade browser read"
    );
  });

  test("collapses AI reads into compact mobile cards", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    const desktopRead = page
      .locator(".overview-ai-pulse.ai-read-panel-desktop")
      .first();
    const mobileRead = page
      .locator(".overview-ai-pulse.ai-read-panel-mobile")
      .first();

    await expect(desktopRead).toBeHidden();
    await expect(mobileRead).toBeVisible();
    await expect(mobileRead).not.toHaveAttribute("open", "");
    await expect(mobileRead.locator(".ai-read-mobile-title")).toBeVisible();
    await expect(mobileRead.locator(".ai-read-mobile-takeaway")).toBeVisible();
    await expect(mobileRead.locator(".ai-read-mobile-toggle")).toContainText(
      "Read more"
    );
    await expect(mobileRead.locator(".ai-read-mobile-expanded")).toBeHidden();

    const collapsedBox = await mobileRead.boundingBox();
    expect(collapsedBox?.height || 0).toBeLessThan(150);

    await mobileRead.locator("summary").click();
    await expect(mobileRead).toHaveAttribute("open", "");
    await expect(mobileRead.locator(".ai-read-mobile-expanded")).toBeVisible();
    await expect(mobileRead.locator(".ai-read-body")).toBeVisible();
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
    await expect(page.locator(".admin-premium-section")).toHaveCount(5);
  });

  test("keeps admin-only feature surfaces tied to admin feature mode", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toBeVisible();
    await expect(
      page.locator(".overview-ai-pulse.ai-read-panel-desktop")
    ).toBeVisible();
    await expect(page.locator(".admin-premium-section")).toHaveCount(5);

    await page.getByRole("tab", { name: "Rankings" }).click();
    await expect(page.locator(".admin-diagnostics-shell")).toBeVisible();
    await expect(page.getByText("Admin Diagnostics")).toBeVisible();
    await expect(page.getByText("AI Readout QA")).toBeVisible();

    await page.getByRole("tab", { name: "Trade History" }).click();
    await expect(
      page
        .locator(".trade-browser-ai-read.ai-read-panel-desktop")
        .getByText("Trade browser read")
    ).toBeVisible();
    await expect(page.getByText("Hidden Sleeper Data Import")).toHaveCount(0);

    await page
      .getByRole("button", { name: /Switch to regular report view/i })
      .click();

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toHaveCount(
      0
    );
    await expect(page.locator(".overview-ai-pulse")).toHaveCount(0);
    await expect(page.locator(".admin-premium-section")).toHaveCount(0);
    await expect(page.locator(".admin-diagnostics-shell")).toHaveCount(0);
    await expect(page.getByText("AI Readout QA")).toHaveCount(0);
    await expect(page.getByText("Player Receipt Audit")).toHaveCount(0);
    await expect(page.getByText("Trade browser read")).toHaveCount(0);
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
        .locator(".trade-browser-ai-read.ai-read-panel-desktop")
        .getByText("Trade browser read")
    ).toBeVisible();
    await expect(page.getByText("Hidden Sleeper Data Import")).toHaveCount(0);
  });

  test("shows Schedule Edge table when stored DraftSharks SOS snapshots are healthy", async ({
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

    await loadCachedReport(page, cachedReport, "#rankings");

    await expect(page.getByText("Schedule Edge Table")).toBeVisible();
    await expect
      .poll(() =>
        page.locator("details.report-disclosure > summary").evaluateAll(nodes =>
          nodes.map(node => node.textContent || "")
        )
      )
      .toEqual(
        expect.arrayContaining([
          expect.stringContaining("Full Roster Rankings"),
          expect.stringContaining("Schedule Edge Table"),
          expect.stringContaining("College Rankings"),
        ])
      );
    await expect
      .poll(() =>
        page.locator("details.report-disclosure > summary").evaluateAll(nodes =>
          nodes
            .map((node, index) => ({ index, text: node.textContent || "" }))
            .filter(item =>
              /Full Roster Rankings|Schedule Edge Table|College Rankings/.test(
                item.text
              )
            )
            .map(item =>
              item.text.includes("Full Roster Rankings")
                ? "roster"
                : item.text.includes("Schedule Edge Table")
                  ? "matchups"
                  : "college"
            )
        )
      )
      .toEqual(["roster", "matchups", "college"]);
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

    await loadCachedReport(page, cachedReport, "#rankings");

    const scheduleSection = await openReportSection(page, "Schedule Edge Table");
    await expect(scheduleSection.getByText("No DraftSharks SOS rows yet")).toBeVisible();
    await expect(scheduleSection.getByText("Snapshot coverage")).toBeVisible();
    const snapshotCoverage = scheduleSection
      .locator("details.admin-schedule-health-disclosure")
      .first();
    await snapshotCoverage.evaluate(node => {
      const details = node as HTMLDetailsElement;
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    await expect(scheduleSection.getByText("Missing").first()).toBeVisible();
    await expect(scheduleSection.getByText(/FantasyPros matchup/i)).toHaveCount(0);
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
    const situationDeltaRow = featureRadar
      .locator(".assistant-feature-coverage-row")
      .filter({ hasText: "Situation Delta" });
    await expect(situationDeltaRow).toBeVisible();
    await expect(situationDeltaRow.getByText("Backed")).toBeVisible();
    await expect(situationDeltaRow).toContainText("1/8 players");
    await expect(situationDeltaRow).toContainText("1 strong");
    await expect(situationDeltaRow).toContainText("1 role boost");

    await page.getByRole("tab", { name: "Rankings" }).click();
    const scoutSection = await openReportSection(page, "Scout Leaguemates");
    await expect(scoutSection.getByText("Manager Rank Inventory")).toBeVisible();
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
    await expect(detailDialog.getByText(/validated riser/i).first()).toBeVisible();
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

    await expect(page.locator(".overview-ai-pulse")).toHaveCount(0);
    await expect(page.locator(".admin-premium-tab")).toHaveCount(0);
    await expect(page.locator(".admin-premium-section")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /View as/i })).toHaveCount(0);
    await expect(page.getByText("Monthly Team Blueprint")).toHaveCount(0);
    await expect(page.getByText("League Power Rankings")).toHaveCount(0);
    await expect(page.getByText("Schedule Edge Table")).toHaveCount(0);
    await expect(
      page.getByText("Trade Finder, Partners & League Exploits")
    ).toHaveCount(0);
  });

  test("locks pre-draft redraft blueprints and suppresses dynasty-only owner copy", async ({
    page,
  }) => {
    const cachedReport = createRedraftCommandCenterReport(
      "predraft-redraft-command-league",
      false
    );
    await loadCachedReport(page, cachedReport);

    const blueprintSection = await openReportSection(
      page,
      "Monthly Team Blueprint"
    );
    await expect(
      blueprintSection
        .locator(".ai-read-panel:visible")
        .filter({ hasText: "Available after the draft" })
        .first()
    ).toBeVisible();
    await expect(
      blueprintSection
        .locator(".ai-read-actions button")
        .filter({ hasText: "Blueprint Locked Until Draft" })
        .first()
    ).toBeDisabled();

    const powerSection = await openReportSection(page, "League Power Rankings");
    await expect(powerSection.locator(".league-power-card")).toHaveCount(2);
    await expect(
      powerSection.getByText("1 open roster is not assigned yet.")
    ).toBeVisible();
    await expect(powerSection).not.toContainText(/Unknown|REBUILD MODE/i);

    const rosterReconSection = await openReportSection(
      page,
      "Team Breakdown & Roster Recon"
    );
    await expect(rosterReconSection).not.toContainText(
      /Future focused|REBUILD MODE/i
    );
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
    await expect(actionQueue.getByText("Roster domino")).toBeVisible();
    await expect(actionQueue.getByText("Where to verify")).toBeVisible();
    await expect(actionQueue.getByText("Source conflict check")).toBeVisible();
    await expect(actionQueue.getByText("Decision memory")).toBeVisible();
    await expect(actionQueue.getByText("Outcome observer")).toBeVisible();
    await expect(actionQueue.getByText("Passive data sync")).toBeVisible();
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
    await expect(page.getByText("Take me out")).toBeVisible();
    await expect(page.getByText("Sample Tight End").first()).toBeVisible();
    await expect(page.getByText("Best weekly correction")).toBeVisible();
    await expect(page.getByText(/Start Replacement Tight End over Sample Tight End/).first()).toBeVisible();
    await expect(page.getByText("AI Edge Review")).toBeVisible();
    await expect(page.getByText("Weekly AI report card")).toBeVisible();
    await expect(page.getByText("Bad idea alert")).toBeVisible();
    await expect(page.getByText("Market anomaly scan").first()).toBeVisible();
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
    await expect(
      page.getByText(/Role Boost \(78% confidence, fresh context\)/i).first()
    ).toBeVisible();

    await page.getByRole("button", { name: "Redraft" }).click();
    await expect(page.getByText("Tester win-now cockpit")).toBeVisible();
    await expect(page.getByText("Weekly ceiling")).toBeVisible();
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
    await loadCachedReport(page, cachedReport, "#autopilot", { admin: false });

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toHaveCount(
      0
    );
    await expect(page.getByText("AI Team Autopilot")).toHaveCount(0);
    await expect(page.getByText("Tester dynasty cockpit")).toHaveCount(0);
    await expect(page).toHaveURL(
      new RegExp(`leagueId=${cachedReport.leagueId}(#overview)?$`)
    );
  });

  test("keeps weekly momentum public while hiding waiver intelligence from regular viewers", async ({
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
    await expect(page.getByText("Top 10 Weekly Risers")).toBeVisible();
    await expect(page.getByText("Top 10 Weekly Fallers")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Trending Adds" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Trending Drops" })
    ).toBeVisible();
    await expect(page.getByText("Waiver Intelligence")).toHaveCount(0);
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
    await expect(page.getByText("1 waiver ideas omitted")).toBeVisible();
    await expect(page.getByText("Dallen Bentley")).toBeHidden();
    await page.getByText("1 waiver ideas omitted").click();
    await expect(page.getByText("Dallen Bentley")).toBeVisible();
    await expect(
      page.getByText("No active NFL team on the Sleeper player record.")
    ).toBeVisible();
    await expect(page.getByText("Recent Transactions")).toBeVisible();
    await expect(page.getByText("Top 10 Weekly Risers")).toBeVisible();
    await expect(page.getByText("Top 10 Weekly Fallers")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Trending Adds" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Trending Drops" })
    ).toBeVisible();
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

    await expect(
      page
        .locator(".trade-browser-ai-read.ai-read-panel-desktop")
        .getByText("Trade browser read")
    ).toBeVisible();
    const tradeRead = page.locator(".trade-browser-ai-read.ai-read-panel-desktop");
    await expect(tradeRead.getByText("0 trades")).toBeVisible();
    await expect(
      tradeRead.getByText(
        "No completed trades were returned. The browser shows an empty state instead of manufacturing trade history."
      )
    ).toBeVisible();
  });
});
