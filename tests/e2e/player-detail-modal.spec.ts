import { expect, test } from '@playwright/test';
import { createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

const SLEEPER_SESSION_KEY = 'dynasty-degenerates:sleeper-session:v1';
const SLEEPER_USERS_KEY = 'dynasty-degenerates:sleeper-user-history:v1';

function createModalFixture(leagueId = 'player-modal-regression-league') {
  const cachedReport = createCachedRedraftReport(leagueId);
  const player1 = cachedReport.reportData.playerDetailsById['player-1'];
  const player2 = cachedReport.reportData.playerDetailsById['player-2'];

  Object.assign(player1, {
    birthDate: '2000-01-01',
    college: 'Clemson',
    availabilityHistory: [
      { season: '2025', games: 14, gamesMissed: 3, pointsPerGame: 16.4 },
      { season: '2024', games: 11, gamesMissed: 6, pointsPerGame: 15.1 },
    ],
    prospectProfile: {
      summary:
        'Explosive back with strong contact balance and receiving upside. This full summary should stay readable in the full-width pill with no truncation or abbreviation.',
      fortyYardDash: 4.41,
      college: 'Clemson',
      source: 'Prospect Archive',
      draftYear: '2021',
      role: 'RB',
      overallRank: 2,
      position: 'RB',
      positionRank: 1,
      rating: 89,
      averageOverallRank: 26.4,
      height: '5-10',
      weight: 205,
      birthPlace: 'Bennettsville, SC',
      status: 'Active',
      jersey: '9',
    },
    latestNews: {
      title: 'Travis Etienne Jr. signing with Saints',
      source: 'FantasyPros',
      summary:
        'The Saints are signing RB Travis Etienne Jr. to a four-year, $52 million deal. This summary should be fully readable and clickable without any truncation.',
      url: 'https://example.com/news/travis-etienne-saints',
      publishedAt: '2026-03-09T00:00:00.000Z',
    },
    valueProfile: {
      ...player1.valueProfile,
      fantasyCalcRedraft: 4875,
      fantasyProsSeasonValue: 4930,
      seasonValue: 5000,
      sources: ['Current-season model', 'FantasyPros Season', 'FantasyCalc Redraft'],
    },
    valueTimeline: {
      profileKey: '12_sf_ppr_base',
      source: 'historical-value-index',
      selectedWindow: '6m',
      availableWindows: [
        { key: '3m', label: '3M', days: 92, pointCount: 3, startDate: '2026-02-17', endDate: '2026-05-17', startValue: 4300, endValue: 5200, delta: 900, deltaPct: 20.9 },
        { key: '6m', label: '6M', days: 183, pointCount: 4, startDate: '2025-11-17', endDate: '2026-05-17', startValue: 3900, endValue: 5200, delta: 1300, deltaPct: 33.3 },
        { key: 'all', label: 'All', days: null, pointCount: 5, startDate: '2024-09-01', endDate: '2026-05-17', startValue: 2800, endValue: 5200, delta: 2400, deltaPct: 85.7 },
      ],
      windows: {
        '3m': {
          key: '3m',
          label: '3M',
          days: 92,
          pointCount: 3,
          startDate: '2026-02-17',
          endDate: '2026-05-17',
          startValue: 4300,
          endValue: 5200,
          delta: 900,
          deltaPct: 20.9,
          points: [
            { date: '2026-02-17', value: 4300, rank: 'RB9', overallRank: 42, sources: ['marketKtc'], sourceCount: 1 },
            { date: '2026-04-01', value: 4800, rank: 'RB7', overallRank: 35, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
            { date: '2026-05-17', value: 5200, rank: 'RB5', overallRank: 28, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
          ],
        },
        '6m': {
          key: '6m',
          label: '6M',
          days: 183,
          pointCount: 4,
          startDate: '2025-11-17',
          endDate: '2026-05-17',
          startValue: 3900,
          endValue: 5200,
          delta: 1300,
          deltaPct: 33.3,
          points: [
            { date: '2025-11-17', value: 3900, rank: 'RB14', overallRank: 58, sources: ['marketKtc'], sourceCount: 1 },
            { date: '2026-02-17', value: 4300, rank: 'RB9', overallRank: 42, sources: ['marketKtc'], sourceCount: 1 },
            { date: '2026-04-01', value: 4800, rank: 'RB7', overallRank: 35, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
            { date: '2026-05-17', value: 5200, rank: 'RB5', overallRank: 28, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
          ],
        },
        all: {
          key: 'all',
          label: 'All',
          days: null,
          pointCount: 5,
          startDate: '2024-09-01',
          endDate: '2026-05-17',
          startValue: 2800,
          endValue: 5200,
          delta: 2400,
          deltaPct: 85.7,
          points: [
            { date: '2024-09-01', value: 2800, rank: 'RB28', overallRank: 122, sources: ['marketKtc'], sourceCount: 1 },
            { date: '2025-05-01', value: 3400, rank: 'RB19', overallRank: 74, sources: ['marketKtc'], sourceCount: 1 },
            { date: '2025-11-17', value: 3900, rank: 'RB14', overallRank: 58, sources: ['marketKtc'], sourceCount: 1 },
            { date: '2026-04-01', value: 4800, rank: 'RB7', overallRank: 35, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
            { date: '2026-05-17', value: 5200, rank: 'RB5', overallRank: 28, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
          ],
        },
      },
      extremes: {
        high: { date: '2026-05-17', value: 5200, rank: 'RB5', overallRank: 28, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
        low: { date: '2024-09-01', value: 2800, rank: 'RB28', overallRank: 122, sources: ['marketKtc'], sourceCount: 1 },
      },
      yearlyExtremes: [
        {
          year: '2025',
          high: { date: '2025-11-17', value: 3900, rank: 'RB14', overallRank: 58, sources: ['marketKtc'], sourceCount: 1 },
          low: { date: '2025-05-01', value: 3400, rank: 'RB19', overallRank: 74, sources: ['marketKtc'], sourceCount: 1 },
        },
        {
          year: '2026',
          high: { date: '2026-05-17', value: 5200, rank: 'RB5', overallRank: 28, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
          low: { date: '2026-02-17', value: 4300, rank: 'RB9', overallRank: 42, sources: ['marketKtc'], sourceCount: 1 },
        },
      ],
      allTimePointCount: 5,
      points: [
        { date: '2025-11-17', value: 3900, rank: 'RB14', overallRank: 58, sources: ['marketKtc'], sourceCount: 1 },
        { date: '2026-02-17', value: 4300, rank: 'RB9', overallRank: 42, sources: ['marketKtc'], sourceCount: 1 },
        { date: '2026-04-01', value: 4800, rank: 'RB7', overallRank: 35, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
        { date: '2026-05-17', value: 5200, rank: 'RB5', overallRank: 28, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
      ],
      summary: {
        startValue: 3900,
        endValue: 5200,
        delta: 1300,
        deltaPct: 33.3,
        sourceSetChanged: true,
        eventCount: 0,
        note: 'Historical value archive includes source coverage changes.',
      },
    },
  });

  Object.assign(player2, {
    birthDate: '1998-06-15',
    college: 'Ohio State',
    latestNews: null,
    prospectProfile: null,
  });

  return cachedReport;
}

async function loadModalReport(
  page: import('@playwright/test').Page,
  cachedReport: ReturnType<typeof createCachedRedraftReport>,
  adminViewMode: 'admin' | 'regular',
) {
  const sleeperSession = {
    username: 'mynameisbillex',
    user: {
      userId: 'mynameisbillex',
      username: 'mynameisbillex',
      displayName: 'mynameisbillex',
      avatarUrl: null,
      hasAdminPermissions: adminViewMode === 'admin',
      isPrivilegedReportViewer: adminViewMode === 'admin',
    },
    leagues: [
      {
        leagueId: cachedReport.leagueId,
        name: cachedReport.leagueName,
        avatarUrl: cachedReport.leagueLogo,
        season: '2026',
        format: cachedReport.leagueFormat,
        mobileFormat: cachedReport.leagueFormat,
        totalRosters: 2,
        standingsRank: null,
        powerRank: null,
      },
    ],
    adminViewMode,
    savedAt: Date.now(),
  };

  await page.addInitScript(
    ({ reportKey, report, sessionKey, session, usersKey }) => {
      window.localStorage.clear();
      window.localStorage.setItem(reportKey, JSON.stringify(report));
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
      window.localStorage.setItem(usersKey, JSON.stringify([session.user]));
    },
    {
      reportKey: REPORT_CACHE_KEY,
      report: cachedReport,
      sessionKey: SLEEPER_SESSION_KEY,
      session: sleeperSession,
      usersKey: SLEEPER_USERS_KEY,
    },
  );

  await page.goto(`/?leagueId=${cachedReport.leagueId}#rankings`, { waitUntil: 'domcontentloaded' });
}

async function openRankings(page: import('@playwright/test').Page) {
  const disclosure = page.locator('.report-disclosure-summary').filter({ hasText: 'Full Roster Rankings' }).first();
  await expect(disclosure).toBeVisible();
  await disclosure.click();
}

async function openPlayerModal(page: import('@playwright/test').Page, playerName: string) {
  const rowButton = page.getByRole('button', { name: new RegExp(playerName) }).first();
  await expect(rowButton).toBeVisible();
  await rowButton.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('player detail modal', () => {
  test('keeps the hero centered, shows admin source data, and preserves availability history', async ({ page }) => {
    const cachedReport = createModalFixture();
    await loadModalReport(page, cachedReport, 'admin');
    await openRankings(page);

    const dialog = await openPlayerModal(page, 'Sample Starter');

    const heroTextAlign = await dialog.locator('.athletic-headline').evaluate((node) => getComputedStyle(node.parentElement!).textAlign);
    expect(heroTextAlign).toBe('center');
    const dialogText = (await dialog.textContent()) || '';

    await expect(dialog.getByText('College')).toBeVisible();
    await expect(dialog.getByText('40 Time')).toBeVisible();
    await expect(dialog.getByText('Birthday')).toBeVisible();
    expect(dialogText).toContain('4.41s');
    expect(dialogText).toContain('Jan 1, 2000');
    await expect(dialog.getByText('Source Inputs', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Prospect Summary', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Latest News', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Availability History', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Why this fired').first()).toBeVisible();
    await expect(dialog.getByText(/Draft capital: Round 1, pick 18/i).first()).toBeVisible();
    await expect(dialog.getByText('Runway 90%').first()).toBeVisible();
    await expect(dialog.locator('p').filter({ hasText: 'Availability: 2025: 14 GP' }).first()).toBeVisible();
    await expect(dialog.getByText('AVAILABLE')).toHaveCount(0);
    await dialog.getByRole('button', { name: /Open Sample Starter 2025 weekly availability log/i }).click();
    const availabilityDialog = page.getByRole('dialog').filter({ hasText: 'Weekly Availability Log' });
    await expect(availabilityDialog.getByRole('heading', { name: /Sample Starter 2025/i })).toBeVisible();
    await expect(availabilityDialog.getByText('Season Snapshot')).toBeVisible();
    await expect(availabilityDialog.getByText(/14 GP \/ 3 missed/i)).toBeVisible();
    await expect(availabilityDialog.getByText('16.4', { exact: true })).toBeVisible();
    await expect(dialog.locator('.player-availability-log-panel')).toHaveCount(0);
    await availabilityDialog.getByRole('button', { name: /Close Sample Starter 2025 weekly availability log/i }).click();
    await expect(availabilityDialog).toHaveCount(0);

    await dialog.getByRole('button', { name: /Open Sample Starter value timeline detail/i }).click();
    const timelineDialog = page.getByRole('dialog').filter({ hasText: 'Stored Value Timeline' });
    await expect(timelineDialog.getByRole('tab', { name: /3M/i })).toBeVisible();
    await expect(timelineDialog.getByRole('tab', { name: /6M/i })).toHaveAttribute('aria-selected', 'true');
    await expect(timelineDialog.getByText('All-Time Range')).toBeVisible();
    await expect(timelineDialog.getByText('Highest')).toBeVisible();
    await expect(timelineDialog.getByText('May 17, 2026 / RB5')).toBeVisible();
    await timelineDialog.getByRole('tab', { name: /All/i }).click();
    await expect(timelineDialog.getByRole('tab', { name: /All/i })).toHaveAttribute('aria-selected', 'true');
    await expect(timelineDialog.getByText('Sep 1').first()).toBeVisible();
    await timelineDialog.getByRole('button', { name: /Close Sample Starter value timeline detail/i }).click();
    await expect(timelineDialog).toHaveCount(0);

    const newsLink = dialog.locator('a[href="https://example.com/news/travis-etienne-saints"]');
    await expect(newsLink).toHaveAttribute('target', '_blank');
    await expect(newsLink).toContainText('Travis Etienne Jr. signing with Saints');
    await expect(newsLink).toContainText('The Saints are signing RB Travis Etienne Jr.');

    const popupPromise = page.waitForEvent('popup');
    await newsLink.click();
    const popup = await popupPromise;
    expect(popup.url()).toContain('https://example.com/news/travis-etienne-saints');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    const fallbackDialog = await openPlayerModal(page, 'Depth Receiver');
    const fallbackDialogText = (await fallbackDialog.textContent()) || '';
    await expect(fallbackDialog.getByText('40 Time')).toBeVisible();
    expect(fallbackDialogText).toContain('40 Time-');
  });

  test('hides admin-only source inputs in regular view', async ({ page }) => {
    const cachedReport = createModalFixture('player-modal-regular-view');
    await loadModalReport(page, cachedReport, 'regular');
    await openRankings(page);

    const dialog = await openPlayerModal(page, 'Sample Starter');

    await expect(dialog.getByText('Source Inputs', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Prospect Summary', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Latest News', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Availability History', { exact: true })).toBeVisible();
  });
});
