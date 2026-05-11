import { expect, test } from '@playwright/test';
import {
  createCachedCommandCenterReport,
  createCachedRedraftReport,
  createCachedRedraftTradeLedgerRegressionReport,
  REPORT_CACHE_KEY,
} from './fixtures/cachedReports';

type CachedReport = ReturnType<typeof createCachedRedraftReport> | ReturnType<typeof createCachedCommandCenterReport>;

async function loadCachedReport(page: import('@playwright/test').Page, cachedReport: CachedReport, hash: string) {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: REPORT_CACHE_KEY, value: cachedReport },
  );
  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, { waitUntil: 'domcontentloaded' });
}

test.describe('cached report visual regression', () => {
  test('redraft rankings viewport remains visually stable', async ({ page }) => {
    await loadCachedReport(page, createCachedRedraftReport('visual-rankings-redraft-league'), '#rankings');
    await expect(page.getByText('CURRENT-SEASON PLAYER VALUES').first()).toBeVisible();
    await expect(page).toHaveScreenshot('redraft-rankings-viewport.png', {
      animations: 'disabled',
      mask: [page.locator('img')],
      maxDiffPixelRatio: 0.03,
    });
  });

  test('redraft draft recap expanded viewport remains visually stable', async ({ page }) => {
    await loadCachedReport(page, createCachedRedraftReport('visual-draft-redraft-league'), '#draft');
    await page.getByRole('button', { name: /2026 Draft Recap/ }).click();
    await expect(page.getByRole('button', { name: /#1 Sample Starter/ })).toBeVisible();
    await expect(page).toHaveScreenshot('redraft-draft-expanded-viewport.png', {
      animations: 'disabled',
      mask: [page.locator('img')],
      maxDiffPixelRatio: 0.03,
    });
  });

  test('dynasty overview command cards remain visually stable', async ({ page }) => {
    await loadCachedReport(page, createCachedCommandCenterReport('visual-dynasty-overview-league'), '#overview');
    await expect(page.getByText('Owner Intel Lab').first()).toBeVisible();
    await expect(page.getByText('Projected Roster Board').first()).toBeVisible();
    await expect(page).toHaveScreenshot('dynasty-overview-command-viewport.png', {
      animations: 'disabled',
      mask: [page.locator('img')],
      maxDiffPixelRatio: 0.03,
    });
  });

  test('dynasty trade history viewport remains visually stable', async ({ page }) => {
    await loadCachedReport(page, createCachedCommandCenterReport('visual-dynasty-trades-league'), '#trades');
    await expect(page.getByText('Full Trade Ledger').first()).toBeVisible();
    await page.getByRole('button', { name: /Full Trade Ledger/ }).click();
    const tradeLedgerDialog = page.getByRole('dialog', { name: /Full Trade Ledger/ });
    await expect(tradeLedgerDialog.getByText('2026-05-01')).toBeVisible();
    await expect(page).toHaveScreenshot('dynasty-trade-history-viewport.png', {
      animations: 'disabled',
      mask: [page.locator('img')],
      maxDiffPixelRatio: 0.03,
    });
  });

  test('redraft trade ledger keeps the long verdict readable and the balancing piece hidden on mobile', async ({ page }, testInfo) => {
    const cachedReport = createCachedRedraftTradeLedgerRegressionReport();
    await loadCachedReport(page, cachedReport, '#trades');
    const tradeLedgerToggle = page.getByRole('button', { name: /Full Trade Ledger/ }).first();
    await expect(tradeLedgerToggle).toBeVisible();
    await tradeLedgerToggle.click();

    const tradeLedgerDialog = page.getByRole('dialog', { name: /Full Trade Ledger/ });
    await expect(tradeLedgerDialog.getByText('2026-05-01')).toBeVisible();

    const verdict = tradeLedgerDialog.locator('.trade-gap-verdict').filter({ hasText: 'Generational Fleece' }).first();
    await expect(verdict).toBeVisible();
    const verdictBox = await verdict.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }));
    expect(verdictBox.scrollWidth).toBeLessThanOrEqual(verdictBox.clientWidth);

    const balancingChip = tradeLedgerDialog.locator('.trade-row-balance-chip').first();
    if (testInfo.project.name === 'mobile-chrome') {
      await expect(balancingChip).not.toBeVisible();
    } else {
      await expect(balancingChip).toBeVisible();
    }

    if (testInfo.project.name === 'mobile-chrome' || testInfo.project.name === 'desktop-chrome') {
      await expect(page).toHaveScreenshot('redraft-trade-ledger-regression.png', {
        animations: 'disabled',
        mask: [page.locator('img')],
        maxDiffPixelRatio: 0.03,
      });
    }

    await tradeLedgerDialog.getByRole('button', { name: /Open trade detail for 2026-05-01: Tester and Rival/i }).click();
    const detailDialog = page.getByRole('dialog', { name: /Trade Ledger Detail/i });
    await expect(detailDialog).toContainText('Redraft window ends at championship week.');
    await expect(detailDialog.getByText(/Window: .*Observed through/i)).toBeVisible();
  });
});
