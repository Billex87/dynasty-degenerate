import { expect, test } from '@playwright/test';
import { createCachedCommandCenterReport, createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

async function loadCachedReport(
  page: import('@playwright/test').Page,
  cachedReport: ReturnType<typeof createCachedCommandCenterReport | typeof createCachedRedraftReport>,
  hash = '',
  options: { admin?: boolean } = {},
) {
  const useAdminSession = options.admin !== false;
  const sleeperSessionKey = 'dynasty-degenerates:sleeper-session:v1';
  const cachedUsersKey = 'dynasty-degenerates:sleeper-user-history:v1';
  const adminUser = {
    userId: 'mynameisbillex',
    username: 'mynameisbillex',
    displayName: 'mynameisbillex',
    avatarUrl: null,
    hasAdminPermissions: true,
    isPrivilegedReportViewer: true,
  };
  const league = {
    leagueId: cachedReport.leagueId,
    name: cachedReport.leagueName,
    avatarUrl: cachedReport.leagueLogo,
    season: '2026',
    format: cachedReport.leagueFormat,
    mobileFormat: cachedReport.leagueFormat,
    totalRosters: 2,
    standingsRank: null,
    powerRank: null,
  };
  await page.addInitScript(
    ({ key, value, sessionKey, usersKey, user, leagueOption, admin }) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
      if (!admin) return;
      window.localStorage.setItem(sessionKey, JSON.stringify({
        username: user.username,
        user,
        leagues: [leagueOption],
        adminViewMode: 'admin',
        savedAt: Date.now(),
      }));
      window.localStorage.setItem(usersKey, JSON.stringify([{
        ...user,
        leagues: [leagueOption],
        recentLeagueIds: [leagueOption.leagueId],
        savedAt: Date.now(),
      }]));
    },
    { key: REPORT_CACHE_KEY, value: cachedReport, sessionKey: sleeperSessionKey, usersKey: cachedUsersKey, user: adminUser, leagueOption: league, admin: useAdminSession },
  );
  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, { waitUntil: 'domcontentloaded' });
}

async function openReportSection(page: import('@playwright/test').Page, title: string) {
  const section = page.locator('details.report-disclosure').filter({ hasText: title }).first();
  await expect(section).toBeVisible();
  await section.evaluate((node) => {
    if (!node.hasAttribute('open')) node.setAttribute('open', '');
  });
  return section;
}

test.describe('command center feature surfaces', () => {
  test('renders AI reads, blueprint generation, power rankings, roster recon, partners, and feature radar', async ({ page }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport);

    await expect(page.locator('.overview-ai-pulse')).toBeVisible();
    await expect(page.locator('.admin-premium-tab')).toHaveCount(0);
    await expect(page.locator('.admin-premium-section')).toHaveCount(5);
    const premiumSectionFlare = await page.locator('.admin-premium-section > .report-disclosure-summary').first().evaluate((node) => getComputedStyle(node, '::before').content);
    expect(premiumSectionFlare).toBe('""');
    await expect(page.getByText('Monthly Team Blueprint').first()).toBeVisible();
    await page.locator('button.command-primary-action').click();
    await expect(page.getByText('The Monthly Blueprint')).toBeVisible();
    await expect(page.getByText('Blueprint AI Summary')).toBeVisible();
    await expect(page.getByText('Stored 2026-05')).toBeVisible();

    await openReportSection(page, 'League Power Rankings');
    await expect(page.locator('.league-power-card')).toHaveCount(2);

    await openReportSection(page, 'Team Breakdown & Roster Recon');
    await expect(page.locator('.team-breakdown-recon')).toBeVisible();
    await expect(page.getByText('Suggested next move')).toBeVisible();

    await openReportSection(page, 'Trade Finder, Partners & League Exploits');
    await expect(page.getByText('Fair trade finder')).toBeVisible();
    await expect(page.locator('.trade-finder-package-card').first()).toBeVisible();
    await expect(page.locator('.trade-partner-card')).toHaveCount(1);
    await expect(page.locator('.league-exploit-card').first()).toBeVisible();

    await openReportSection(page, 'Assistant Feature Radar');
    await expect(page.locator('.assistant-shell-grid')).toBeVisible();

    const desktopOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    expect(desktopOverflow).toBeLessThanOrEqual(1);
  });

  test('keeps command-center expansion hidden for regular report viewers', async ({ page }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, '', { admin: false });

    await expect(page.locator('.overview-ai-pulse')).toHaveCount(0);
    await expect(page.locator('.admin-premium-tab')).toHaveCount(0);
    await expect(page.locator('.admin-premium-section')).toHaveCount(0);
    await expect(page.getByText('Monthly Team Blueprint')).toHaveCount(0);
    await expect(page.getByText('League Power Rankings')).toHaveCount(0);
    await expect(page.getByText('Trade Finder, Partners & League Exploits')).toHaveCount(0);
  });

  test('shows live-data AI Autopilot only for admin view', async ({ page }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, '#autopilot');

    await expect(page.getByRole('tab', { name: 'AI Autopilot' })).toBeVisible();
    await expect(page.getByText('Tester dynasty cockpit')).toBeVisible();
    await expect(page.getByText('Live report data')).toBeVisible();
    await expect(page.getByText('Team Direction')).toBeVisible();
    await expect(page.getByText('Depth Receiver').first()).toBeVisible();
    await expect(page.getByText('Sample Runner').first()).toBeVisible();

    await page.getByRole('button', { name: 'Redraft' }).click();
    await expect(page.getByText('Tester win-now cockpit')).toBeVisible();
    await expect(page.getByText('Weekly ceiling')).toBeVisible();
    await expect(page.getByText('current-season profile from the waiver data').first()).toBeVisible();
  });

  test('does not expose AI Autopilot to regular report viewers', async ({ page }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, '#autopilot', { admin: false });

    await expect(page.getByRole('tab', { name: 'AI Autopilot' })).toHaveCount(0);
    await expect(page.getByText('AI Team Autopilot')).toHaveCount(0);
    await expect(page.getByText('Tester dynasty cockpit')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}(#overview)?$`));
  });

  test('keeps weekly momentum public while hiding waiver intelligence from regular viewers', async ({ page }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, '#momentum', { admin: false });

    await expect(page.getByRole('tab', { name: 'Weekly Momentum' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}#momentum$`));
    await expect(page.getByText('Recent Transactions')).toBeVisible();
    await expect(page.getByText('Top 10 Weekly Risers')).toBeVisible();
    await expect(page.getByText('Top 10 Weekly Fallers')).toBeVisible();
    await expect(page.getByText('Trending Adds')).toBeVisible();
    await expect(page.getByText('Trending Drops')).toBeVisible();
    await expect(page.getByText('Waiver Intelligence')).toHaveCount(0);
  });

  test('shows waiver intelligence with the other weekly momentum sections for admins', async ({ page }) => {
    const cachedReport = createCachedCommandCenterReport();
    await loadCachedReport(page, cachedReport, '#momentum');

    await expect(page.getByRole('tab', { name: 'Weekly Momentum' })).toBeVisible();
    await expect(page.getByText('Waiver Intelligence')).toBeVisible();
    await expect(page.getByText('Recent Transactions')).toBeVisible();
    await expect(page.getByText('Top 10 Weekly Risers')).toBeVisible();
    await expect(page.getByText('Top 10 Weekly Fallers')).toBeVisible();
    await expect(page.getByText('Trending Adds')).toBeVisible();
    await expect(page.getByText('Trending Drops')).toBeVisible();
  });

  test('trade browser explains an empty redraft ledger without inventing trades', async ({ page }) => {
    const cachedReport = createCachedRedraftReport('command-center-empty-trades');
    await loadCachedReport(page, cachedReport, '#trades');

    await expect(page.getByText('Trade browser read')).toBeVisible();
    await expect(page.getByText('0 trades')).toBeVisible();
    await expect(page.getByText('No completed trades were returned. The browser shows an empty state instead of manufacturing trade history.')).toBeVisible();
  });
});
