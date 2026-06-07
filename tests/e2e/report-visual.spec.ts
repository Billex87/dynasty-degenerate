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

async function openTradeReceiptsModal(page: import('@playwright/test').Page) {
  const tradeReceiptsButton = page.getByRole('button', { name: /Trade Receipts|Completed trades/i });
  await expect(tradeReceiptsButton).toBeVisible();
  await tradeReceiptsButton.click();
  const tradeReceiptsDialog = page.getByRole('dialog', { name: /Trade Receipts/i });
  await expect(tradeReceiptsDialog).toBeVisible();
  return tradeReceiptsDialog;
}

async function openReportDisclosure(page: import('@playwright/test').Page, title: string) {
  const section = page.locator('details.report-disclosure').filter({ hasText: title }).first();
  await expect(section).toBeVisible();
  if (!(await section.evaluate(node => (node as HTMLDetailsElement).open))) {
    await section.locator('summary.report-disclosure-summary').click();
  }
  await expect(section).toHaveAttribute('open', '');
}

async function openFirstTradeLedgerDetail(page: import('@playwright/test').Page) {
  const tradeReceiptsDialog = await openTradeReceiptsModal(page);
  const tradeLedgerRow = tradeReceiptsDialog
    .locator('[role="button"]')
    .filter({ hasText: /\d{4}-\d{2}-\d{2}/ })
    .first();
  await expect(tradeLedgerRow).toBeVisible();
  await tradeLedgerRow.click();
  const tradeLedgerDialog = page.getByRole('dialog', { name: /Trade Ledger Detail/i });
  await expect(tradeLedgerDialog).toBeVisible();
  return { tradeLedgerDialog, tradeLedgerRow };
}

test.describe('cached report visual regression', () => {
  test('redraft rankings viewport remains visually stable', async ({ page }) => {
    await loadCachedReport(page, createCachedRedraftReport('visual-rankings-redraft-league'), '#rankings');
    await expect(page.getByRole('heading', { name: /Full Roster Rankings/i })).toBeVisible();
    await expect(page.getByText(/Season values/i)).toBeVisible();
    await expect(page).toHaveScreenshot('redraft-rankings-viewport.png', {
      animations: 'disabled',
      mask: [page.locator('img')],
      maxDiffPixelRatio: 0.03,
    });
  });

  test('redraft draft recap expanded viewport remains visually stable', async ({ page }) => {
    await loadCachedReport(page, createCachedRedraftReport('visual-draft-redraft-league'), '#draft');
    await expect(page.getByRole('heading', { name: /^2026 Main Draft$/i })).toBeVisible();
    await openReportDisclosure(page, '2026 Main Draft');
    await expect(page.locator('.rookie-draft-row').filter({ hasText: '#1' }).first()).toBeVisible();
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
    const { tradeLedgerDialog: ledgerDialog } = await openFirstTradeLedgerDetail(page);
    await expect(ledgerDialog.locator('.trade-outcome-verdict')).toBeVisible();
    await expect(page).toHaveScreenshot('dynasty-trade-history-viewport.png', {
      animations: 'disabled',
      mask: [page.locator('img')],
      maxDiffPixelRatio: 0.03,
    });
  });

  test('redraft trade ledger keeps the long verdict readable and the balancing piece hidden on mobile', async ({ page }, testInfo) => {
    const cachedReport = createCachedRedraftTradeLedgerRegressionReport();
    await loadCachedReport(page, cachedReport, '#trades');
    const { tradeLedgerDialog, tradeLedgerRow } = await openFirstTradeLedgerDetail(page);
    const detailLedgerDialog = tradeLedgerDialog;
    await expect(detailLedgerDialog).toBeVisible();
    await expect(detailLedgerDialog.locator('.trade-side-manager').first()).toBeVisible();

    const verdict = detailLedgerDialog.locator('.trade-outcome-verdict, .trade-gap-verdict').first();
    await expect(verdict).toBeVisible();
    const verdictBox = await verdict.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }));
    expect(verdictBox.scrollWidth).toBeLessThanOrEqual(verdictBox.clientWidth);

    const balancingChip = tradeLedgerRow.locator('.trade-row-balance-chip').first();
    const balancingChipCount = await balancingChip.count();
    if (balancingChipCount > 0) {
      if (testInfo.project.name === 'mobile-chrome') {
        await expect(balancingChip).not.toBeVisible();
      } else {
        await expect(balancingChip).toBeVisible();
      }
    }

    if (testInfo.project.name === 'mobile-chrome' || testInfo.project.name === 'desktop-chrome') {
      await expect(page).toHaveScreenshot('redraft-trade-ledger-regression.png', {
        animations: 'disabled',
        mask: [page.locator('img')],
        maxDiffPixelRatio: 0.03,
      });
    }

    const detailDialog = page.getByRole('dialog', { name: /Trade Ledger Detail/i });
    await expect(detailDialog).toContainText('Redraft window ends at championship week.');
    await expect(detailDialog.getByText(/Window: .*Observed through/i)).toBeVisible();
  });
});
