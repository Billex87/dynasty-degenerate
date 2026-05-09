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

test.describe('cached report visual regression', () => {
  test('redraft rankings viewport remains visually stable', async ({ page }) => {
    await loadCachedReport(page, 'visual-rankings-redraft-league', '#rankings');
    await expect(page.getByText('CURRENT-SEASON PLAYER VALUES').first()).toBeVisible();
    await expect(page).toHaveScreenshot('redraft-rankings-viewport.png', {
      animations: 'disabled',
      mask: [page.locator('img')],
      maxDiffPixelRatio: 0.03,
    });
  });

  test('redraft draft recap expanded viewport remains visually stable', async ({ page }) => {
    await loadCachedReport(page, 'visual-draft-redraft-league', '#draft');
    await page.getByRole('button', { name: /2026 Draft Recap/ }).click();
    await expect(page.getByRole('button', { name: /#1 Sample Starter/ })).toBeVisible();
    await expect(page).toHaveScreenshot('redraft-draft-expanded-viewport.png', {
      animations: 'disabled',
      mask: [page.locator('img')],
      maxDiffPixelRatio: 0.03,
    });
  });
});
