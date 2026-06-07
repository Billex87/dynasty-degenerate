import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

async function loadCachedReport(page: import('@playwright/test').Page, leagueId: string, hash: string) {
  const cachedReport = createCachedRedraftReport(leagueId);
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: REPORT_CACHE_KEY, value: cachedReport },
  );
  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, { waitUntil: 'domcontentloaded' });
}

test.describe('report accessibility checks', () => {
  test.describe.configure({ timeout: 90_000 });

  test('rankings report has no serious axe violations and no unnamed buttons', async ({ page }) => {
    await loadCachedReport(page, 'axe-rankings-redraft-league', '#rankings');
    await expect(page.getByRole('heading', { name: /Full Roster Rankings/i })).toBeVisible();
    await expect(page.getByText(/Season values/i)).toBeVisible();

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const blockingViolations = axeResults.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact || ''));
    expect(blockingViolations).toEqual([]);

    const unnamedButtons = await page.locator('button').evaluateAll((buttons) =>
      buttons
        .map((button, index) => ({
          index,
          text: button.textContent?.trim() || '',
          ariaLabel: button.getAttribute('aria-label') || '',
          title: button.getAttribute('title') || '',
        }))
        .filter((button) => !button.text && !button.ariaLabel && !button.title),
    );
    expect(unnamedButtons).toEqual([]);
  });
});
