import { expect, test } from '@playwright/test';

const runLiveAdminSmoke = process.env.RUN_LIVE_ADMIN_SMOKE === 'true';
const sleeperUsername = process.env.LIVE_SLEEPER_USERNAME || 'mynameisbillex';
const adminPassphrase = process.env.ADMIN_LOGIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
const dynastyLeagueName = process.env.LIVE_ADMIN_DYNASTY_LEAGUE || 'The Fantasy Degenerates';
const redraftDraftLeagueName = process.env.LIVE_ADMIN_REDRAFT_DRAFT_LEAGUE || 'test league';
const redraftNoDraftLeagueName =
  process.env.LIVE_ADMIN_REDRAFT_NO_DRAFT_LEAGUE ||
  process.env.LIVE_ADMIN_REDRAFT_PREVIOUS_DRAFT_LEAGUE ||
  process.env.LIVE_ADMIN_REDRAFT_LEAGUE ||
  'Gov Tech Grid Iron';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function unlockAdmin(page: import('@playwright/test').Page) {
  if (!adminPassphrase) {
    throw new Error('ADMIN_LOGIN_PASSWORD or ADMIN_PASSWORD is required for live admin smoke.');
  }

  const response = await page.request.post('/api/trpc/auth.adminLogin?batch=1', {
    data: {
      0: {
        json: {
          passphrase: adminPassphrase,
        },
      },
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function dismissAdminIntroIfVisible(page: import('@playwright/test').Page) {
  const enterCommandCenter = page.getByRole('button', { name: /Enter Command Center/i });
  if (await enterCommandCenter.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await enterCommandCenter.click();
  }
}

async function enterAdminReportView(page: import('@playwright/test').Page) {
  const autopilotTab = page.getByRole('tab', { name: /AI Autopilot/i });
  if (await autopilotTab.isVisible({ timeout: 2_000 }).catch(() => false)) return;

  const adminToolsButton = page.getByRole('button', { name: /Return to admin report view|Admin Tools/i }).first();
  await expect(adminToolsButton).toBeVisible({ timeout: 10_000 });
  await adminToolsButton.click();
  await expect(autopilotTab).toBeVisible({ timeout: 15_000 });
}

async function openReportDisclosure(page: import('@playwright/test').Page, title: string) {
  const section = page.locator('details.report-disclosure').filter({ hasText: title }).first();
  await expect(section).toBeVisible();
  if (!(await section.evaluate(node => node.open))) {
    await section.locator('summary.report-disclosure-summary').click();
  }
  await expect(section).toHaveAttribute('open', '');
  return section;
}

async function runLeagueReport(page: import('@playwright/test').Page, leagueName: string) {
  await unlockAdmin(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.setItem('dynasty-degenerates:admin-unlock-dismissed:v1', 'true');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Sleeper username').fill(sleeperUsername);
  await page.getByRole('button', { name: 'Find Leagues' }).click();
  await expect(page.getByText(leagueName, { exact: false })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: new RegExp(escapeRegex(leagueName), 'i') }).first().click();
  await expect(page.getByRole('tab', { name: 'Rankings' })).toBeVisible({ timeout: 150_000 });
  await dismissAdminIntroIfVisible(page);
  await enterAdminReportView(page);
}

async function expectDraftHistoryVisibility(page: import('@playwright/test').Page, shouldBeVisible: boolean) {
  const draftTab = page.getByRole('tab', { name: 'Draft History' });

  if (!shouldBeVisible) {
    await expect(draftTab).toHaveCount(0);
    await expect(page.getByText('No draft data available')).toHaveCount(0);
    return;
  }

  await expect(draftTab).toBeVisible();
  await draftTab.click();
  await expect(page.getByText('Loading report section...')).toBeHidden({ timeout: 30_000 });
  await expect(
    page.getByText('Draft Recap', { exact: false })
      .or(page.getByText('Rookie Draft', { exact: false }))
      .or(page.getByText('Startup Draft', { exact: false }))
      .or(page.getByText('Main Draft', { exact: false }))
      .or(page.getByText('Season value window', { exact: false }))
      .or(page.getByText('Draft Capital', { exact: false }))
      .first(),
  ).toBeVisible();
}

async function expectAdminSurfaces(
  page: import('@playwright/test').Page,
  options: { shouldShowDraftHistory: boolean },
) {
  await expect(page.getByRole('tab', { name: /AI Autopilot/i })).toBeVisible();
  await expect(page.getByText('Assistant Feature Radar').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Rankings' }).click();
  await expect(page.getByText('Admin Diagnostics').first()).toBeVisible();
  await expect(page.getByText('Provider Telemetry').first()).toBeVisible();
  await expect(page.getByText('Source Coverage').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Switch to regular report view/i })).toBeVisible();
  await expect(page.getByText(/locked until Admin Tools are unlocked/i)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Weekly Momentum' }).click();
  await expect(page.getByText('Waiver Intelligence').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Trade History' }).click();
  const tradeWarRoom = await openReportDisclosure(page, 'Trade War Room');
  await expect(tradeWarRoom.getByText('Package Builder').first()).toBeVisible();

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/Submit to Sleeper|Open Sleeper|Copy plan|Copy swap/i);
  expect(bodyText).not.toContain('Dallas Bentley');

  await expectDraftHistoryVisibility(page, options.shouldShowDraftHistory);
}

test.describe('live admin report smoke', () => {
  test.skip(!runLiveAdminSmoke, 'Set RUN_LIVE_ADMIN_SMOKE=true to run live admin report checks.');
  test.setTimeout(240_000);

  test(`${dynastyLeagueName} admin report surfaces load`, async ({ page }) => {
    await runLeagueReport(page, dynastyLeagueName);
    await expectAdminSurfaces(page, { shouldShowDraftHistory: true });
    await expect(page.locator('body')).toContainText(/Dynasty|SF|PPR/i);
  });

  test(`${redraftNoDraftLeagueName} admin report hides draft history until current draft exists`, async ({ page }) => {
    await runLeagueReport(page, redraftNoDraftLeagueName);
    await expectAdminSurfaces(page, { shouldShowDraftHistory: false });
    await page.getByRole('tab', { name: 'Rankings' }).click();
    await expect(page.getByText(/Current-season player values/i).first()).toBeVisible();
  });

  test(`${redraftDraftLeagueName} admin report keeps draft history when draft data exists`, async ({ page }) => {
    await runLeagueReport(page, redraftDraftLeagueName);
    await expectAdminSurfaces(page, { shouldShowDraftHistory: true });
    await page.getByRole('tab', { name: 'Rankings' }).click();
    await expect(page.getByText(/Current-season player values/i).first()).toBeVisible();
  });
});
