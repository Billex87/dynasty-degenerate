import { expect, test } from '@playwright/test';

const runProductionSmoke = process.env.PRODUCTION_SMOKE === 'true';
const hasProductionBaseUrl = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const sleeperUsername = process.env.PRODUCTION_SMOKE_SLEEPER_USERNAME || 'mynameisbillex';
const dynastyLeagueName = process.env.PRODUCTION_SMOKE_DYNASTY_LEAGUE || 'Skids Get Beat';
const redraftLeagueName = process.env.PRODUCTION_SMOKE_REDRAFT_LEAGUE || 'test league';

test.describe('production smoke', () => {
  test.skip(!runProductionSmoke || !hasProductionBaseUrl, 'Set PRODUCTION_SMOKE=true and PLAYWRIGHT_BASE_URL to run deployed-site smoke checks.');
  test.setTimeout(180_000);

  function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function chooseRegularModeIfPrompted(page: import('@playwright/test').Page) {
    const regularModeButton = page.getByRole('button', { name: 'View Like Regular Person' });
    if (await regularModeButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await regularModeButton.click();
    }
  }

  async function loadLiveLeague(page: import('@playwright/test').Page, leagueName: string) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Obliterate Your Competition' })).toBeVisible();
    await page.getByPlaceholder('Sleeper username').fill(sleeperUsername);
    await page.getByRole('button', { name: 'Find Leagues' }).click();
    await chooseRegularModeIfPrompted(page);
    await expect(page.getByText(leagueName, { exact: false })).toBeVisible({ timeout: 30_000 });
    await chooseRegularModeIfPrompted(page);
    await page.getByRole('button', { name: new RegExp(escapeRegex(leagueName), 'i') }).first().click();
    await expect(page.getByRole('tab', { name: 'Rankings' })).toBeVisible({ timeout: 120_000 });
  }

  test('homepage and live dynasty league load', async ({ page }) => {
    await loadLiveLeague(page, dynastyLeagueName);
    await page.getByRole('tab', { name: 'Draft History' }).click();
    await expect(page.getByText('Loading report section...')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText('Rookie Draft', { exact: false }).or(page.getByText('Draft Capital', { exact: false })).first()).toBeVisible();
  });

  test('live redraft league avoids dynasty-first copy', async ({ page }) => {
    await loadLiveLeague(page, redraftLeagueName);
    await page.getByRole('tab', { name: 'Rankings' }).click();
    await expect(page.getByText('Current-season player values', { exact: false })).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('DYNASTY OWNER READS');
    expect(bodyText).not.toContain('DYNASTY VALUE BOARD');
    expect(bodyText).not.toContain('Taxi Stash');
    expect(bodyText).not.toContain('Draft Capital Efficiency');
  });
});
