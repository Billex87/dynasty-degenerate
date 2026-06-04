import { expect, test } from '@playwright/test';
import { createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

function getPerLeagueReportCacheKey(leagueId: string) {
  return `${REPORT_CACHE_KEY}:${leagueId}`;
}

async function loadCachedReport(page: import('@playwright/test').Page, leagueId: string, hash: string) {
  const cachedReport = createCachedRedraftReport(leagueId);
  await page.addInitScript(
    ({ globalKey, leagueKey, value }) => {
      window.localStorage.setItem(globalKey, JSON.stringify(value));
      window.localStorage.setItem(leagueKey, JSON.stringify(value));
    },
    {
      globalKey: REPORT_CACHE_KEY,
      leagueKey: getPerLeagueReportCacheKey(cachedReport.leagueId),
      value: cachedReport,
    },
  );
  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, { waitUntil: 'domcontentloaded' });
}

async function openFullRosterRankings(page: import('@playwright/test').Page) {
  const section = page.locator('details.report-disclosure').filter({ hasText: 'Full Roster Rankings' }).first();
  await expect(section).toBeVisible();
  if (!(await section.evaluate(node => node.open))) {
    await section.locator('summary.report-disclosure-summary').click();
  }
  await expect(section).toHaveAttribute('open', '');
}

async function openDraftYear(page: import('@playwright/test').Page, title: string) {
  const section = page.locator('details.report-disclosure').filter({ hasText: title }).first();
  await expect(section).toBeVisible();
  if (!(await section.evaluate(node => node.open))) {
    await section.locator('summary.report-disclosure-summary').click();
  }
  await expect(section).toHaveAttribute('open', '');
}

test.describe('redraft value consistency', () => {
  test('uses the same primary season value across ranking row and player modal', async ({ page }) => {
    await loadCachedReport(page, 'value-consistency-rankings-redraft', '#rankings');
    await openFullRosterRankings(page);

    const rankingRow = page.locator('.value-board__row').filter({ hasText: 'Bijan Robinson' }).first();
    await expect(rankingRow).toBeVisible();
    await expect(rankingRow).toContainText('#1');
    await expect(rankingRow).toContainText('5,000');

    await rankingRow.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-season-value')).toContainText('5,000');
    await expect(dialog.locator('.player-modal-metric-dynasty-value')).toHaveCount(0);
  });

  test('uses current-season value consistently between draft row and draft player modal', async ({ page }) => {
    await loadCachedReport(page, 'value-consistency-draft-redraft', '#draft');

    await openDraftYear(page, '2026 Main Draft');
    const draftRow = page.locator('.rookie-draft-row').filter({ hasText: 'Bijan Robinson' }).first();
    await expect(draftRow).toBeVisible();
    await expect(draftRow).toContainText('#1');
    await expect(draftRow).toContainText('5,000');

    await draftRow.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-season-value')).toContainText('5,000');
    await expect(dialog.locator('.player-modal-metric-dynasty-value')).toHaveCount(0);
  });
});
