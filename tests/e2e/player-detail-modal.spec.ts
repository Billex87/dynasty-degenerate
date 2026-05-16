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
    await expect(dialog.getByText('Why this fired')).toBeVisible();
    await expect(dialog.getByText(/Draft capital: Round 1, pick 18/i)).toBeVisible();
    await expect(dialog.getByText('Runway 90%')).toBeVisible();
    await expect(dialog.locator('p').filter({ hasText: 'Availability: 2025: 14 GP' }).first()).toBeVisible();
    await expect(dialog.getByText('AVAILABLE')).toHaveCount(0);

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
