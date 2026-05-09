import { expect, test } from '@playwright/test';
import { createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

async function loadCachedReport(page: import('@playwright/test').Page, leagueId: string, hash: string) {
  const cachedReport = createCachedRedraftReport(leagueId);
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: REPORT_CACHE_KEY, value: cachedReport },
  );
  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, { waitUntil: 'domcontentloaded' });
  return cachedReport;
}

async function openFullRosterRankings(page: import('@playwright/test').Page) {
  await page.locator('.report-disclosure-summary').filter({ hasText: 'Full Roster Rankings' }).click();
}

test.describe('shareable report control state', () => {
  test('syncs ranking search, sort, and filters into the URL and restores them', async ({ page }) => {
    const cachedReport = await loadCachedReport(page, 'rank-state-redraft-league', '#rankings');
    await openFullRosterRankings(page);

    const search = page.getByPlaceholder('Search player, manager, team');
    await expect(search).toBeVisible();
    await search.fill('Depth');
    await page.getByRole('button', { name: 'Season' }).click();
    await page.locator('.rankings-position-toggle button[aria-label="WR"]').click();

    await expect(page).toHaveURL(/rankSearch=Depth/);
    await expect(page).toHaveURL(/rankSort=value/);
    await expect(page).toHaveURL(/rankPositions=WR/);
    await expect(page.getByRole('button', { name: /#2 .*Depth Receiver/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /#1 .*Sample Starter/ })).toHaveCount(0);

    await page.reload();
    await openFullRosterRankings(page);
    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}.*#rankings$`));
    await expect(search).toHaveValue('Depth');
    await expect(page.locator('.rankings-position-toggle button[aria-label="WR"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Season' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('opens redraft player details with season value first and keyboard close support', async ({ page }) => {
    await loadCachedReport(page, 'modal-redraft-league', '#rankings');
    await openFullRosterRankings(page);

    await page.getByRole('button', { name: /Sample Starter/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-season-value')).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-dynasty-value')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('syncs draft sort and expanded draft years into the URL', async ({ page }) => {
    await loadCachedReport(page, 'draft-state-redraft-league', '#draft');

    await page.getByRole('button', { name: /2026 Draft Recap/ }).click();
    await page.getByRole('button', { name: /Current Season/ }).click();

    await expect(page).toHaveURL(/draftOpen=2026/);
    await expect(page).toHaveURL(/draftSort=currentValue/);
    await expect(page).toHaveURL(/draftDir=desc/);
    await expect(page.getByRole('button', { name: /#1 Sample Starter/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /#1 Sample Starter/ })).toBeVisible();
  });
});
