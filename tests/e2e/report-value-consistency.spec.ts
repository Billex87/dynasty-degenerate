import { expect, test } from '@playwright/test';
import { createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

async function loadCachedReport(page: import('@playwright/test').Page, leagueId: string, hash: string) {
  const cachedReport = createCachedRedraftReport(leagueId);
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: REPORT_CACHE_KEY, value: cachedReport },
  );
  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, { waitUntil: 'domcontentloaded' });
}

async function openFullRosterRankings(page: import('@playwright/test').Page) {
  await page.locator('.report-disclosure-summary').filter({ hasText: 'Full Roster Rankings' }).click();
}

test.describe('redraft value consistency', () => {
  test('uses the same primary season value across ranking row and player modal', async ({ page }) => {
    await loadCachedReport(page, 'value-consistency-rankings-redraft', '#rankings');
    await openFullRosterRankings(page);

    const rankingRow = page.getByRole('button', { name: /#1 .*Sample Starter/ });
    await expect(rankingRow).toBeVisible();
    await expect(rankingRow).toContainText('5,000');

    await rankingRow.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-season-value')).toContainText('5,000');
    await expect(dialog.locator('.player-modal-metric-dynasty-value')).toHaveCount(0);
  });

  test('uses current-season value consistently between draft row and draft player modal', async ({ page }) => {
    await loadCachedReport(page, 'value-consistency-draft-redraft', '#draft');

    await page.getByRole('button', { name: /2026 Draft Recap/ }).click();
    const draftRow = page.getByRole('button', { name: /#1 Sample Starter/ });
    await expect(draftRow).toBeVisible();
    await expect(draftRow).toContainText('5,000');

    await draftRow.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-season-value')).toContainText('5,000');
    await expect(dialog.locator('.player-modal-metric-dynasty-value')).toHaveCount(0);
  });
});
