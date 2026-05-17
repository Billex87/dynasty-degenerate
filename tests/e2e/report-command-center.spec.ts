import { expect, test } from "@playwright/test";
import {
  createCachedCommandCenterReport,
  createCachedRedraftReport,
  REPORT_CACHE_KEY,
} from "./fixtures/cachedReports";

async function loadCachedReport(
  page: import("@playwright/test").Page,
  cachedReport: ReturnType<
    typeof createCachedCommandCenterReport | typeof createCachedRedraftReport
  >,
  hash = "",
  options: { admin?: boolean; preserveLocalStorage?: boolean } = {}
) {
  const useAdminSession = options.admin !== false;
  const preserveLocalStorage = options.preserveLocalStorage === true;
  const sleeperSessionKey = "dynasty-degenerates:sleeper-session:v1";
  const cachedUsersKey = "dynasty-degenerates:sleeper-user-history:v1";
  const adminUser = {
    userId: "mynameisbillex",
    username: "mynameisbillex",
    displayName: "mynameisbillex",
    avatarUrl: null,
    hasAdminPermissions: true,
    isPrivilegedReportViewer: true,
  };
  const league = {
    leagueId: cachedReport.leagueId,
    name: cachedReport.leagueName,
    avatarUrl: cachedReport.leagueLogo,
    season: "2026",
    format: cachedReport.leagueFormat,
    mobileFormat: cachedReport.leagueFormat,
    totalRosters: 2,
    standingsRank: null,
    powerRank: null,
  };
  await page.addInitScript(
    ({
      key,
      value,
      sessionKey,
      usersKey,
      user,
      leagueOption,
      admin,
      preserve,
    }) => {
      if (!preserve) window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
      if (!admin) return;
      window.sessionStorage.setItem(
        "dynasty-degenerates:admin-unlock-dismissed:v1",
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
      value: cachedReport,
      sessionKey: sleeperSessionKey,
      usersKey: cachedUsersKey,
      user: adminUser,
      leagueOption: league,
      admin: useAdminSession,
      preserve: preserveLocalStorage,
    }
  );
  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, {
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
    expect(overviewSummaryText).toContain("Owner Profiles");
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
    await openReportSection(page, "Monthly Team Blueprint");
    await page.locator("button.command-primary-action").click();
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
    const swapRead = page.locator(".manager-command-swap-read");
    await expect(swapRead.getByText("Start/Sit Swap Signals")).toBeVisible();
    await expect(
      swapRead
        .locator(".manager-command-swap-out-name")
        .getByText("Replace", { exact: true })
    ).toBeVisible();
    await expect(
      swapRead.getByText("Replacement Tight End").first()
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
    await swapRead
      .getByRole("button", { name: /Save plan/i })
      .first()
      .click();
    await expect(
      swapRead.getByRole("button", { name: /Plan saved/i }).first()
    ).toBeVisible();
    await expect(page.getByText("Action History").first()).toBeVisible();
    const lineupPlans = await page.evaluate(
      () =>
        JSON.parse(
          window.localStorage.getItem("dynasty-degenerates:action-plans:v1") ||
            "[]"
        ) as Array<{ kind?: string }>
    );
    expect(lineupPlans.some(plan => plan.kind === "lineup")).toBeTruthy();
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

    await openReportSection(page, "Trade Finder, Partners & League Exploits");
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
    await tradePartnerRead
      .getByRole("button", { name: /Track trade read/i })
      .click();
    await expect(page.getByText("Tracked trade reads")).toBeVisible();
    const trackedTradePlans = await page.evaluate(
      () =>
        JSON.parse(
          window.localStorage.getItem("dynasty-degenerates:action-plans:v1") ||
            "[]"
        ) as Array<{ kind?: string; status?: string }>
    );
    expect(
      trackedTradePlans.some(
        plan => plan.kind === "trade" && plan.status === "tracked"
      )
    ).toBeTruthy();
    await expect(page.locator(".league-exploit-card").first()).toBeVisible();

    await openReportSection(page, "Assistant Feature Radar");
    await expect(page.locator(".assistant-shell-grid")).toBeVisible();

    await page.getByRole("tab", { name: "Rankings" }).click();
    const adminValueSection = await openReportSection(
      page,
      "Value Source Configuration"
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
    const aiReadoutSection = await openReportSection(
      page,
      "AI Readout Coverage"
    );
    await expect(aiReadoutSection.getByText("readouts tracked")).toBeVisible();
    await expect(aiReadoutSection.getByText("duplicate-risk flags")).toBeVisible();
    await expect(
      aiReadoutSection
        .getByLabel("AI readout count by tab")
        .getByText("AI Autopilot")
    ).toBeVisible();
    await expect(
      aiReadoutSection.getByText("Trade Finder / Partner Reads")
    ).toBeVisible();
    await expect(
      aiReadoutSection
        .getByLabel("AI readout coverage flags")
        .getByText(/Schedule\/projection traces stay limited/i)
    ).toBeVisible();

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
    await page
      .getByRole("button", { name: /Save plan/i })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /Plan saved/i }).first()
    ).toBeVisible();
    await expect(page.getByText("Waiver Plan History").first()).toBeVisible();
    const submittedPlans = await page.evaluate(
      () =>
        JSON.parse(
          window.localStorage.getItem("dynasty-degenerates:action-plans:v1") ||
            "[]"
        ) as Array<{ kind?: string; playerId?: string }>
    );
    expect(
      submittedPlans.some(
        plan => plan.kind === "waiver" && plan.playerId === "waiver1"
      )
    ).toBeTruthy();
    const bidHistory = await page.evaluate(
      () =>
        JSON.parse(
          window.localStorage.getItem(
            "dynasty-degenerates:waiver-bid-history:v1"
          ) || "[]"
        ) as Array<{ playerId?: string; bidMax?: number }>
    );
    expect(
      bidHistory.some(
        item => item.playerId === "waiver1" && Number(item.bidMax) > 0
      )
    ).toBeTruthy();

    const desktopOverflow = await page.evaluate(() =>
      Math.max(
        0,
        document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    );
    expect(desktopOverflow).toBeLessThanOrEqual(1);
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

    await expect(
      page
        .locator(".overview-ai-pulse.ai-read-panel-desktop")
        .getByText(/Tester sets the starting lens for this Overview pass/i)
    ).toBeVisible();

    await page.getByRole("button", { name: /View as Tester/i }).click();
    await page
      .locator('[data-slot="dropdown-menu-content"]')
      .getByRole("menuitemradio", { name: "Rival" })
      .click();
    await expect(
      page.getByRole("button", { name: /View as Rival/i })
    ).toBeVisible();
    await expect(
      page
        .locator(".overview-ai-pulse.ai-read-panel-desktop")
        .getByText(/Rival sets the starting lens for this Overview pass/i)
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Switch to regular report view/i })
      .click();
    await expect(
      page.getByRole("button", { name: /Return to admin report view/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /View as Tester/i })
    ).toBeVisible();
    await expect(page.locator(".admin-premium-section")).toHaveCount(0);

    await page
      .getByRole("button", { name: /Return to admin report view/i })
      .click();
    await expect(
      page
        .locator(".overview-ai-pulse.ai-read-panel-desktop")
        .getByText(/Tester sets the starting lens for this Overview pass/i)
    ).toBeVisible();
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
    await expect(page.getByText("Value Source Configuration")).toBeVisible();

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
    await expect(page.getByText("AI Readout Coverage")).toHaveCount(0);
    await expect(page.getByText("Trade browser read")).toHaveCount(0);
    await expect(page.getByText("Hidden Sleeper Data Import")).toHaveCount(0);

    await page
      .getByRole("button", { name: /Return to admin report view/i })
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

    await page.getByRole("tab", { name: "Trade History" }).click();
    const tradeWarRoom = await openReportSection(page, "Trade War Room");
    await expect(tradeWarRoom.getByText("Manager Asset Board")).toBeVisible();
    const testerAssetCard = tradeWarRoom
      .locator(".trade-war-manager-board-card")
      .filter({ hasText: "Tester" })
      .first();
    await testerAssetCard.locator("summary").click();
    await expect(
      testerAssetCard.locator(".trade-war-manager-board-section-head").filter({ hasText: "PICKS" })
    ).toBeVisible();
    await expect(testerAssetCard.getByText("2027 1st")).toBeVisible();
    await expect(tradeWarRoom.getByText("Value Match Finder")).toBeVisible();
    await tradeWarRoom.locator(".trade-war-side").first().locator("input").fill("Depth Receiver");
    await tradeWarRoom
      .locator(".trade-war-side")
      .first()
      .getByRole("button", { name: /Depth Receiver/i })
      .first()
      .click();
    const valueMatchPanel = tradeWarRoom.locator(".trade-war-value-match-panel");
    await expect(valueMatchPanel.getByText(/Rival can match/i).first()).toBeVisible();
    await expect(valueMatchPanel.getByText("2026 1st").first()).toBeVisible();

    await expect(page.getByText("Full Trade Ledger").first()).toBeVisible();
    await page.getByRole("button", { name: /Full Trade Ledger/ }).click();
    const tradeLedgerDialog = page.getByRole("dialog", {
      name: /Full Trade Ledger/,
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
    await expect(
      page.getByText("Trade Finder, Partners & League Exploits")
    ).toHaveCount(0);
  });

  test("shows live-data AI Autopilot only for admin view", async ({ page }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, "#autopilot");

    await expect(page.getByRole("tab", { name: "AI Autopilot" })).toBeVisible();
    await expect(page.getByText("Tester dynasty cockpit")).toBeVisible();
    await expect(page.getByText("Live report data")).toBeVisible();
    await expect(page.getByText("Team Direction")).toBeVisible();
    await expect(page.getByText("Depth Receiver").first()).toBeVisible();
    await expect(page.getByText("Sample Runner").first()).toBeVisible();
    await expect(page.getByText("Weekly Action Plan")).toBeVisible();
    await expect(page.getByText("Take me out")).toBeVisible();
    await expect(page.getByText("Sample Tight End").first()).toBeVisible();
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

    await page.getByRole("button", { name: "Redraft" }).click();
    await expect(page.getByText("Tester win-now cockpit")).toBeVisible();
    await expect(page.getByText("Weekly ceiling")).toBeVisible();
    await expect(
      page.getByText("current-season profile from the waiver data").first()
    ).toBeVisible();
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
    await expect(page.getByText("Trending Adds")).toBeVisible();
    await expect(page.getByText("Trending Drops")).toBeVisible();
    await expect(page.getByText("Waiver Intelligence")).toHaveCount(0);
  });

  test("shows waiver intelligence with the other weekly momentum sections for admins", async ({
    page,
  }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, "#momentum");

    await expect(
      page.getByRole("tab", { name: "Weekly Momentum" })
    ).toBeVisible();
    await expect(page.getByText("Waiver Intelligence")).toBeVisible();
    await expect(page.getByText("Recent Transactions")).toBeVisible();
    await expect(page.getByText("Top 10 Weekly Risers")).toBeVisible();
    await expect(page.getByText("Top 10 Weekly Fallers")).toBeVisible();
    await expect(page.getByText("Trending Adds")).toBeVisible();
    await expect(page.getByText("Trending Drops")).toBeVisible();
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
