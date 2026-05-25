import { expect, test } from '@playwright/test';
import { createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

const LAST_LEAGUE_KEY = 'dynasty-degenerates:last-league:v1';

function getPerLeagueReportCacheKey(leagueId: string) {
  return `${REPORT_CACHE_KEY}:${leagueId}`;
}

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
    await expect(page.getByText('Trade Value Board')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}#trades$`));

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('DYNASTY OWNER READS');
    expect(bodyText).not.toContain('DYNASTY VALUE BOARD');
    expect(bodyText).not.toContain('Rookie Draft');
    expect(bodyText).not.toContain('Draft Capital Efficiency');
    expect(bodyText).not.toContain('Taxi Stash');
  });

  test('does not hydrate a stale global report for a different URL league', async ({ page }) => {
    const staleReport = createCachedRedraftReport('stale-global-redraft-league');
    const targetReport = createCachedRedraftReport('target-url-redraft-league');
    staleReport.leagueName = 'Stale Global League';
    targetReport.leagueName = 'Target URL League';

    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
      { key: REPORT_CACHE_KEY, value: staleReport },
    );

    await page.goto(`/?leagueId=${targetReport.leagueId}#overview`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Stale Global League')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`leagueId=${targetReport.leagueId}`));
  });

  test('prefers the matching per-league cache over a stale global report', async ({ page }) => {
    const staleReport = createCachedRedraftReport('stale-global-redraft-league');
    const targetReport = createCachedRedraftReport('target-url-redraft-league');
    staleReport.leagueName = 'Stale Global League';
    targetReport.leagueName = 'Target URL League';

    await page.addInitScript(
      ({ globalKey, leagueKey, globalValue, leagueValue }) => {
        window.localStorage.setItem(globalKey, JSON.stringify(globalValue));
        window.localStorage.setItem(leagueKey, JSON.stringify(leagueValue));
      },
      {
        globalKey: REPORT_CACHE_KEY,
        leagueKey: getPerLeagueReportCacheKey(targetReport.leagueId),
        globalValue: staleReport,
        leagueValue: targetReport,
      },
    );

    await page.goto(`/?leagueId=${targetReport.leagueId}#overview`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Target URL League')).toBeVisible();
    await expect(page.getByText('Stale Global League')).toHaveCount(0);
  });

  test('restores the session league cache instead of a stale global last report', async ({ page }) => {
    const staleReport = createCachedRedraftReport('stale-session-global-redraft-league');
    const targetReport = createCachedRedraftReport('target-session-redraft-league');
    staleReport.leagueName = 'Stale Session Global League';
    targetReport.leagueName = 'Target Session League';

    const lastLeague = {
      leagueId: targetReport.leagueId,
      leagueName: targetReport.leagueName,
      leagueLogo: targetReport.leagueLogo,
      leagueFormat: targetReport.leagueFormat,
      activeTab: 'overview',
      savedAt: Date.now(),
    };

    await page.addInitScript(
      ({ globalKey, lastLeagueKey, leagueKey, globalValue, leagueValue, lastLeagueValue }) => {
        window.localStorage.setItem(globalKey, JSON.stringify(globalValue));
        window.localStorage.setItem(lastLeagueKey, JSON.stringify(lastLeagueValue));
        window.localStorage.setItem(leagueKey, JSON.stringify(leagueValue));
      },
      {
        globalKey: REPORT_CACHE_KEY,
        lastLeagueKey: LAST_LEAGUE_KEY,
        leagueKey: getPerLeagueReportCacheKey(targetReport.leagueId),
        globalValue: staleReport,
        leagueValue: targetReport,
        lastLeagueValue: lastLeague,
      },
    );

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Target Session League')).toBeVisible();
    await expect(page.getByText('Stale Session Global League')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`leagueId=${targetReport.leagueId}`));
  });

  test('self-corrects a restored tab when the URL league changes under a cached report', async ({ page }) => {
    const staleReport = createCachedRedraftReport('stale-restored-redraft-league');
    const targetReport = createCachedRedraftReport('target-restored-redraft-league');
    staleReport.leagueName = 'Stale Restored League';
    targetReport.leagueName = 'Target Restored League';

    await page.addInitScript(
      ({ globalKey, targetKey, staleValue, targetValue }) => {
        window.localStorage.setItem(globalKey, JSON.stringify(staleValue));
        window.localStorage.setItem(targetKey, JSON.stringify(targetValue));
      },
      {
        globalKey: REPORT_CACHE_KEY,
        targetKey: getPerLeagueReportCacheKey(targetReport.leagueId),
        staleValue: staleReport,
        targetValue: targetReport,
      },
    );

    await page.goto(`/?leagueId=${staleReport.leagueId}#overview`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Stale Restored League')).toBeVisible();

    await page.evaluate((targetLeagueId) => {
      window.history.replaceState(null, '', `/?leagueId=${targetLeagueId}#overview`);
      window.dispatchEvent(new Event('pageshow'));
    }, targetReport.leagueId);

    await expect(page.getByText('Target Restored League')).toBeVisible();
    await expect(page.getByText('Stale Restored League')).toHaveCount(0);
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
