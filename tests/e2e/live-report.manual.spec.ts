import { expect, test } from '@playwright/test';

const runLiveReportE2E = process.env.RUN_LIVE_REPORT_E2E === 'true';
const sleeperUsername = process.env.LIVE_SLEEPER_USERNAME || 'mynameisbillex';
const dynastyLeagueName = process.env.LIVE_DYNASTY_LEAGUE || 'Skids Get Beat';
const redraftLeagueName = process.env.LIVE_REDRAFT_LEAGUE || 'test league';

test.describe('manual live report regression', () => {
  test.skip(!runLiveReportE2E, 'Set RUN_LIVE_REPORT_E2E=true to run live Sleeper-backed report checks.');
  test.setTimeout(180_000);

  function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function chooseRegularModeIfPrompted(page: import('@playwright/test').Page) {
    const regularModeButton = page.getByRole('button', { name: 'View Like Regular Person' });
    if (await regularModeButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await regularModeButton.click();
    }
  }

  async function runLeagueReport(page: import('@playwright/test').Page, leagueName: string) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Sleeper username').fill(sleeperUsername);
    await page.getByRole('button', { name: 'Find Leagues' }).click();
    await chooseRegularModeIfPrompted(page);
    await expect(page.getByText(leagueName, { exact: false })).toBeVisible({ timeout: 30_000 });
    await chooseRegularModeIfPrompted(page);
    await page.getByRole('button', { name: new RegExp(escapeRegex(leagueName), 'i') }).first().click();
    await expect(page.getByRole('tab', { name: 'Rankings' })).toBeVisible({ timeout: 120_000 });
  }

  test('Skids Get Beat live dynasty report keeps dynasty-specific surfaces', async ({ page }) => {
    await runLeagueReport(page, dynastyLeagueName);

    await page.getByRole('tab', { name: 'Rankings' }).click();
    await expect(page.getByText('Full Roster Rankings')).toBeVisible();
    await expect(page.getByText('League-matched player values')).toBeVisible();

    await page.getByRole('tab', { name: 'Draft History' }).click();
    await expect(page.getByText('Loading report section...')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText('Rookie Draft', { exact: false }).or(page.getByText('Draft Capital', { exact: false })).first()).toBeVisible();
  });

  test('test league live redraft report avoids dynasty-first copy', async ({ page }) => {
    await runLeagueReport(page, redraftLeagueName);

    await page.getByRole('tab', { name: 'Rankings' }).click();
    await expect(page.getByText('Current-season player values', { exact: false })).toBeVisible();

    await page.getByRole('tab', { name: 'Trade History' }).click();
    await expect(page.getByText('Trade Value Leaderboard')).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('DYNASTY OWNER READS');
    expect(bodyText).not.toContain('DYNASTY VALUE BOARD');
    expect(bodyText).not.toContain('Taxi Stash');
    expect(bodyText).not.toContain('Draft Capital Efficiency');
  });
});
