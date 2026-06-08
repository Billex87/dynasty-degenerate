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

  async function fillSleeperUsername(page: import('@playwright/test').Page, username: string) {
    const usernameInput = [
      page.getByPlaceholder('Sleeper username'),
      page.getByRole('textbox', { name: /sleeper username/i }),
      page.locator('input[name="username"]'),
    ];

    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      for (const locator of usernameInput) {
        const control = locator.first();
        const count = await control.count();
        if (!count) continue;

        try {
          await control.waitFor({ state: 'visible', timeout: 2_500 });
          await control.click({ timeout: 1_500 });
          await control.fill('');
          await control.fill(username);
          await expect(control).toHaveValue(username, { timeout: 5_000 });
          return;
        } catch (error) {
          lastError = error;
        }
      }

      await page.waitForTimeout(700 * attempt);
    }

    throw lastError || new Error('Failed to fill Sleeper username field after retries.');
  }

  async function clickLeagueCard(page: import('@playwright/test').Page, leagueName: string) {
    const leagueRegex = new RegExp(escapeRegex(leagueName), 'i');
    const candidates: Array<import('@playwright/test').Locator> = [
      page.getByRole('link', { name: leagueRegex }),
      page.locator('button.home-league-card').filter({ hasText: leagueRegex }),
      page.getByRole('button', { name: leagueRegex }),
      page.getByText(leagueName, { exact: false }),
    ];

    for (const candidate of candidates) {
      const count = await candidate.count();
      if (!count) continue;
      const control = candidate.first();
      if (!(await control.isVisible({ timeout: 2_000 }).catch(() => false))) continue;
      try {
        await control.scrollIntoViewIfNeeded().catch(() => {});
        await expect(control).toBeEnabled({ timeout: 120_000 });
        await control.click();
        return;
      } catch (error) {
        const isVisible = await control.isVisible().catch(() => false);
        if (isVisible) {
          const text = await control.innerText().catch(() => '');
          const isDisabled = await control.isDisabled().catch(() => true);
          throw new Error(
            `League card for "${leagueName}" was found but still not interactable. visible=${isVisible}, disabled=${isDisabled}, text="${text}", candidate=${candidate.toString()}`,
          );
        }
      }
    }

    throw new Error(`Could not find clickable league entry for "${leagueName}"`);
  }

  async function expectActiveReportPanelLoaded(page: import('@playwright/test').Page, tabName: string) {
    const tab = page.getByRole('tab', { name: tabName });
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 });

    const activePanel = page.locator('[data-slot="tabs-content"][data-state="active"]').first();
    await expect(activePanel).toBeVisible({ timeout: 90_000 });
    const loadingText = activePanel.getByText('Loading report section...');
    if (await loadingText.count()) {
      await expect(loadingText.first()).toBeHidden({ timeout: 90_000 }).catch(() => {
        // The loading text is optional in some deployments; this keeps the helper resilient.
      });
    }
    await expect(activePanel).toContainText(/\S/, { timeout: 30_000 });
  }

  async function loadLiveLeague(page: import('@playwright/test').Page, leagueName: string) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Fuck vibes. Use AI.' })).toBeVisible();
    await fillSleeperUsername(page, sleeperUsername);
    await page.getByRole('button', { name: 'Find Leagues' }).click();
    await chooseRegularModeIfPrompted(page);
    await expect(page.getByText(leagueName, { exact: false })).toBeVisible({ timeout: 30_000 });
    await chooseRegularModeIfPrompted(page);
    await clickLeagueCard(page, leagueName);
    await expect(page.getByRole('tab', { name: 'Rankings' })).toBeVisible({ timeout: 120_000 });
  }

  for (const leagueName of dynastyLeagueNames) {
    test(`homepage and live dynasty league load: ${leagueName}`, async ({ browser }) => {
      const page = await browser.newPage();
      try {
        await loadLiveLeague(page, leagueName);
        await page.getByRole('tab', { name: 'Rankings' }).click();
        await expectActiveReportPanelLoaded(page, 'Rankings');

        await page.getByRole('tab', { name: 'Draft History' }).click();
        await expectActiveReportPanelLoaded(page, 'Draft History');

        const bodyText = await page.locator('body').innerText();
        expect(bodyText).not.toContain('2026-05-07');
        expect(bodyText).not.toContain('May 7, 2026');
      } finally {
        await page.close();
      }
    });
  }

  for (const leagueName of redraftLeagueNames) {
    test(`live redraft league avoids dynasty-first copy: ${leagueName}`, async ({ browser }) => {
      const page = await browser.newPage();
      try {
        await loadLiveLeague(page, leagueName);
        await page.getByRole('tab', { name: 'Rankings' }).click();
        await expectActiveReportPanelLoaded(page, 'Rankings');

        if (shouldExpectDraftHistory(leagueName)) {
          await page.getByRole('tab', { name: 'Draft History' }).click();
          await expectActiveReportPanelLoaded(page, 'Draft History');
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
      } finally {
        await page.close();
      }
    });
  }
});
