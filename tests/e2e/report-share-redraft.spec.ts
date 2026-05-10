import { expect, test } from '@playwright/test';
import { createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

test.describe('shareable report URLs and redraft copy', () => {
  test('restores a cached redraft league from leagueId plus tab hash', async ({ page }) => {
    const cachedReport = createCachedRedraftReport();
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
      { key: REPORT_CACHE_KEY, value: cachedReport },
    );

    await page.goto(`/?leagueId=${cachedReport.leagueId}#trades`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('test league')).toBeVisible();
    await expect(page.locator('.report-league-format-row')).toContainText('Redraft');
    await expect(page.getByRole('tab', { name: 'Trade History' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Trade Value Leaderboard')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}#trades$`));

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('DYNASTY OWNER READS');
    expect(bodyText).not.toContain('DYNASTY VALUE BOARD');
    expect(bodyText).not.toContain('Rookie Draft');
    expect(bodyText).not.toContain('Draft Capital Efficiency');
    expect(bodyText).not.toContain('Taxi Stash');
  });

  test('keeps report layouts inside the viewport on mobile cached reports', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cachedReport = createCachedRedraftReport('mobile-redraft-league');
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
      { key: REPORT_CACHE_KEY, value: cachedReport },
    );

    await page.goto(`/?leagueId=${cachedReport.leagueId}#rankings`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('CURRENT-SEASON PLAYER VALUES').first()).toBeVisible();

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
    });

    expect(overflow).toBeLessThanOrEqual(1);
  });
});
