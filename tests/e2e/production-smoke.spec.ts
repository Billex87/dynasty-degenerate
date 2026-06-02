import { expect, test } from '@playwright/test';

const runProductionSmoke = process.env.PRODUCTION_SMOKE === 'true';
const hasProductionBaseUrl = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const sleeperUsername = process.env.PRODUCTION_SMOKE_SLEEPER_USERNAME || 'mynameisbillex';
const dynastyLeagueNames = parseLeagueNames(
  process.env.PRODUCTION_SMOKE_DYNASTY_LEAGUES || process.env.PRODUCTION_SMOKE_DYNASTY_LEAGUE,
  ['Skids Get Beat', 'The Fantasy Degenerates'],
);
const redraftLeagueNames = parseLeagueNames(
  process.env.PRODUCTION_SMOKE_REDRAFT_LEAGUES || process.env.PRODUCTION_SMOKE_REDRAFT_LEAGUE,
  ['test league', 'Gov Tech Grid Iron'],
);
const redraftNoDraftLeagueNames = new Set(
  parseLeagueNames(process.env.PRODUCTION_SMOKE_REDRAFT_NO_DRAFT_LEAGUES, ['Gov Tech Grid Iron']).map(normalizeLeagueName),
);

function parseLeagueNames(value: string | undefined, fallback: string[]) {
  const parsed = String(value || '')
    .split(',')
    .map((leagueName) => leagueName.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function normalizeLeagueName(value: string) {
  return value.trim().toLowerCase();
}

function shouldExpectDraftHistory(leagueName: string) {
  return !redraftNoDraftLeagueNames.has(normalizeLeagueName(leagueName));
}

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
    await expect(page.getByRole('heading', { name: 'Fuck vibes. Use AI.' })).toBeVisible();
    await page.getByPlaceholder('Sleeper username').fill(sleeperUsername);
    await page.getByRole('button', { name: 'Find Leagues' }).click();
    await chooseRegularModeIfPrompted(page);
    await expect(page.getByText(leagueName, { exact: false })).toBeVisible({ timeout: 30_000 });
    await chooseRegularModeIfPrompted(page);
    await page.getByRole('button', { name: new RegExp(escapeRegex(leagueName), 'i') }).first().click();
    await expect(page.getByRole('tab', { name: 'Rankings' })).toBeVisible({ timeout: 120_000 });
  }

  for (const leagueName of dynastyLeagueNames) {
    test(`homepage and live dynasty league load: ${leagueName}`, async ({ page }) => {
      await loadLiveLeague(page, leagueName);
      await page.getByRole('tab', { name: 'Rankings' }).click();
      await expect(page.getByText('League-matched player values', { exact: false })).toBeVisible();

      await page.getByRole('tab', { name: 'Draft History' }).click();
      await expect(
        page.getByText('Rookie Draft', { exact: false })
          .or(page.getByText('Startup Draft', { exact: false }))
          .or(page.getByText('Main Draft', { exact: false }))
          .or(page.getByText('Draft Capital', { exact: false }))
          .first(),
      ).toBeVisible();

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('2026-05-07');
      expect(bodyText).not.toContain('May 7, 2026');
    });
  }

  for (const leagueName of redraftLeagueNames) {
    test(`live redraft league avoids dynasty-first copy: ${leagueName}`, async ({ page }) => {
      await loadLiveLeague(page, leagueName);
      await page.getByRole('tab', { name: 'Rankings' }).click();
      await expect(page.getByText('Current-season player values', { exact: false })).toBeVisible();

      if (shouldExpectDraftHistory(leagueName)) {
        await page.getByRole('tab', { name: 'Draft History' }).click();
        await expect(
          page.getByText('Draft Recap', { exact: false })
            .or(page.getByText('Main Draft', { exact: false }))
            .or(page.getByText('Season value window', { exact: false }))
            .first(),
        ).toBeVisible();
      } else {
        await expect(page.getByRole('tab', { name: 'Draft History' })).toHaveCount(0);
        await expect(page.getByText('No draft data available')).toHaveCount(0);
      }

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('DYNASTY OWNER READS');
      expect(bodyText).not.toContain('DYNASTY VALUE BOARD');
      expect(bodyText).not.toContain('Taxi Stash');
      expect(bodyText).not.toContain('Draft Capital Efficiency');
      expect(bodyText).not.toContain('2026-05-07');
      expect(bodyText).not.toContain('May 7, 2026');
    });
  }
});
