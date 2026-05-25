import { expect, test } from '@playwright/test';
import { createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

const SLEEPER_SESSION_KEY = 'dynasty-degenerates:sleeper-session:v1';
const SLEEPER_USERS_KEY = 'dynasty-degenerates:sleeper-user-history:v1';
const ADMIN_PASSPHRASE_VERIFIED_SESSION_KEY = 'dynasty-degenerates:admin-passphrase-verified-session:v1';

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
    athleticProfile: {
      source: 'nflverse combine',
      draftYear: 2021,
      forty: 4.41,
      bench: 18,
      vertical: 36.5,
      broadJump: 125,
      cone: 6.95,
      shuttle: 4.22,
      speedScore: 105.2,
      note: 'Combine profile loaded with 105.2 speed score.',
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
      sources: ['Dynasty blend', 'KTC market', 'Flock Fantasy'],
    },
    valueTimeline: {
      profileKey: '12_sf_ppr_base',
      source: 'historical-value-index',
      selectedWindow: '1m',
      availableWindows: [
        { key: '1m', label: '1M', days: 31, pointCount: 3, startDate: '2026-04-20', endDate: '2026-05-17', startValue: 5000, endValue: 5200, delta: 200, deltaPct: 4 },
        { key: '3m', label: '3M', days: 92, pointCount: 3, startDate: '2026-02-17', endDate: '2026-05-17', startValue: 4300, endValue: 5200, delta: 900, deltaPct: 20.9 },
        { key: '6m', label: '6M', days: 183, pointCount: 4, startDate: '2025-11-17', endDate: '2026-05-17', startValue: 3900, endValue: 5200, delta: 1300, deltaPct: 33.3 },
        { key: '1y', label: '1Y', days: 366, pointCount: 4, startDate: '2025-05-01', endDate: '2026-05-17', startValue: 3400, endValue: 5200, delta: 1800, deltaPct: 52.9 },
        { key: 'all', label: 'All', days: null, pointCount: 5, startDate: '2024-09-01', endDate: '2026-05-17', startValue: 2800, endValue: 5200, delta: 2400, deltaPct: 85.7 },
      ],
      windows: {
        '1m': {
          key: '1m',
          label: '1M',
          days: 31,
          pointCount: 3,
          startDate: '2026-04-20',
          endDate: '2026-05-17',
          startValue: 5000,
          endValue: 5200,
          delta: 200,
          deltaPct: 4,
          points: [
            { date: '2026-04-20', value: 5000, rank: 'RB6', overallRank: 31, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
            { date: '2026-05-01', value: 5100, rank: 'RB6', overallRank: 30, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
            { date: '2026-05-17', value: 5200, rank: 'RB5', overallRank: 28, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2 },
          ],
        },
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
        '1y': {
          key: '1y',
          label: '1Y',
          days: 366,
          pointCount: 4,
          startDate: '2025-05-01',
          endDate: '2026-05-17',
          startValue: 3400,
          endValue: 5200,
          delta: 1800,
          deltaPct: 52.9,
          points: [
            { date: '2025-05-01', value: 3400, rank: 'RB19', overallRank: 74, sources: ['marketKtc'], sourceCount: 1 },
            { date: '2025-11-17', value: 3900, rank: 'RB14', overallRank: 58, sources: ['marketKtc'], sourceCount: 1 },
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

  const valueTimeline = player1.valueTimeline as NonNullable<typeof player1.valueTimeline>;
  const attachSourceValues = (point: any) => {
    point.marketKtc = point.value - 75;
    point.fantasyCalcDynasty = point.sources.includes('fantasyCalc') ? point.value + 50 : null;
  };
  valueTimeline.points.forEach(attachSourceValues);
  Object.values(valueTimeline.windows || {}).forEach((window) => {
    window.points.forEach(attachSourceValues);
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
      userId: '123456789012345678',
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
        standingsRank: 1,
        powerRank: 1,
      },
    ],
    adminViewMode,
    savedAt: Date.now(),
  };

  await page.addInitScript(
    ({ reportKey, report, sessionKey, session, usersKey, adminPassphraseSessionKey, admin }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(reportKey, JSON.stringify(report));
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
      window.localStorage.setItem(usersKey, JSON.stringify([session.user]));
      if (admin) {
        window.sessionStorage.setItem(adminPassphraseSessionKey, 'true');
      }
    },
    {
      reportKey: REPORT_CACHE_KEY,
      report: cachedReport,
      sessionKey: SLEEPER_SESSION_KEY,
      session: sleeperSession,
      usersKey: SLEEPER_USERS_KEY,
      adminPassphraseSessionKey: ADMIN_PASSPHRASE_VERIFIED_SESSION_KEY,
      admin: adminViewMode === 'admin',
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

function addRankingModalPlayer(
  cachedReport: ReturnType<typeof createCachedRedraftReport>,
  player: {
    id: string;
    name: string;
    position: string;
    team: string | null;
    rank: string;
  },
) {
  const row = {
    id: player.id,
    player_id: player.id,
    name: player.name,
    pos: player.position,
    team: player.team,
    age: null,
    overallRank: 99,
    positionRank: player.rank,
    value: 1200,
    seasonValue: 1200,
    fantasyProsValue: 1180,
    movement: 0,
    owner: null,
    sources: ['Current-season model'],
    sourceCount: 1,
  };

  (cachedReport.reportData.rankings.profiles['redraft-ppr'] as any[]).push(row);
  (cachedReport.reportData.playerDetailsById as Record<string, any>)[player.id] = {
    playerId: player.id,
    fullName: player.name,
    position: player.position,
    team: player.team,
    age: null,
    valueProfile: {
      dynastyValue: null,
      seasonValue: 1200,
      fantasyProsSeasonValue: 1180,
      seasonPositionRank: player.rank,
      sources: ['Current-season model'],
    },
  };
  (cachedReport.reportData.currentPositionRankById as Record<string, string>)[player.id] = player.rank;
}

test.describe('player detail modal', () => {
  test('keeps the hero centered, shows admin source data, and preserves availability history', async ({ page }) => {
    const cachedReport = createModalFixture();
    await loadModalReport(page, cachedReport, 'admin');
    await openRankings(page);

    const dialog = await openPlayerModal(page, 'Bijan Robinson');

    const heroTextAlign = await dialog.locator('.athletic-headline').evaluate((node) => getComputedStyle(node.parentElement!).textAlign);
    expect(heroTextAlign).toBe('center');
    const dialogText = (await dialog.textContent()) || '';
    await expect(dialog.getByText('Value Basis:', { exact: true })).toHaveCount(0);

    await expect(dialog.getByText('College')).toBeVisible();
    await expect(dialog.getByText('40 Time')).toBeVisible();
    await expect(dialog.getByText('Vertical')).toBeVisible();
    await expect(dialog.getByText('Birthday')).toBeVisible();
    expect(dialogText).toContain('4.41s');
    expect(dialogText).toContain('36.5"');
    expect(dialogText).toContain('125"');
    expect(dialogText).toContain('18 reps');
    expect(dialogText).toContain('6.95s');
    expect(dialogText).toContain('4.22s');
    expect(dialogText).toContain('105.2');
    expect(dialogText).toContain('Jan 1, 2000');
    await expect(dialog.getByText('Source Inputs', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Source Detail', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Prospect File', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Prospect Summary', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/This full summary should stay readable in the full-width pill with no truncation or abbreviation/i)).toBeVisible();
    await expect(dialog.getByText('Player News', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Availability History', { exact: true })).toBeVisible();
    await expect(dialog.locator('.ai-read-trace-kicker:visible', { hasText: 'Why this fired' }).first()).toBeVisible();
    await expect(dialog.locator('.ai-read-chip:visible', { hasText: 'Round 1, pick 18' }).first()).toBeVisible();
    await expect(dialog.locator('.ai-read-chip:visible', { hasText: 'Runway 90%' }).first()).toBeVisible();
    await expect(dialog.locator('p').filter({ hasText: 'Availability: 2025: 14 GP' }).first()).toBeVisible();
    await expect(dialog.getByText('AVAILABLE')).toHaveCount(0);
    await dialog.getByRole('button', { name: /Open Bijan Robinson 2025 weekly availability log/i }).click();
    const availabilityDialog = page.getByRole('dialog').filter({ hasText: 'Weekly Availability Log' });
    await expect(availabilityDialog.getByRole('heading', { name: /Bijan Robinson 2025/i })).toBeVisible();
    await expect(availabilityDialog.getByText('Season Snapshot')).toBeVisible();
    await expect(availabilityDialog.getByText(/14 GP \/ 3 missed/i)).toBeVisible();
    await expect(availabilityDialog.getByText('16.4', { exact: true })).toBeVisible();
    await expect(dialog.locator('.player-availability-log-panel')).toHaveCount(0);
    await availabilityDialog.getByRole('button', { name: /Close Bijan Robinson 2025 weekly availability log/i }).click();
    await expect(availabilityDialog).toHaveCount(0);

    await expect(dialog.getByText('Degen Read', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Market Price', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Degen Gap', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Dynasty Market Price Trend')).toHaveCount(0);
    await expect(dialog.getByText('Current Redraft Market Price Trend')).toBeVisible();
    await dialog.getByRole('button', { name: /Open Bijan Robinson value timeline detail/i }).click();
    const timelineDialog = page.getByRole('dialog').filter({ hasText: 'Current Redraft Market Price Timeline' });
    await expect(timelineDialog.getByRole('tab', { name: /1M/i })).toBeVisible();
    await expect(timelineDialog.getByRole('tab', { name: /3M/i })).toBeVisible();
    await expect(timelineDialog.getByRole('tab', { name: /6M/i })).toHaveAttribute('aria-selected', 'true');
    await expect(timelineDialog.getByRole('tab', { name: /1Y/i })).toBeVisible();
    await expect(timelineDialog.getByRole('tab', { name: /All/i })).toBeVisible();
    await expect(timelineDialog.getByText('Current Redraft Market Price Timeline')).toBeVisible();
    const identityHeader = timelineDialog.locator('.player-value-identity-row');
    await expect(identityHeader).toBeVisible();
    await expect(identityHeader.locator('.player-value-timeline-title')).toHaveText('Bijan Robinson');
    await expect(identityHeader.locator('.player-value-identity-team-pill')).toContainText('BUF');
    await expect(identityHeader.locator('.player-value-identity-position-pill')).toHaveCount(0);
    await expect(identityHeader.locator('.player-value-identity-rank-pill')).toHaveText(/^RB\d+$/);
    await expect(identityHeader.locator('.player-value-identity-value-pill')).toHaveText(/^Value \d[\d,]*$/);
    await expect(timelineDialog.locator('.player-value-timeline-description')).toHaveCount(0);
    await expect(timelineDialog.getByText('All-Time Range')).toBeVisible();
    await expect(timelineDialog.getByRole('tab', { name: 'Value' })).toHaveAttribute('aria-selected', 'true');
    await expect(timelineDialog.locator([
      '.player-value-timeline-chart path[stroke="#34d399"]',
      '.player-value-timeline-chart path[stroke="#fb7185"]',
      '.player-value-timeline-chart path[stroke="#38bdf8"]',
    ].join(', '))).toHaveCount(1);
    const pointPopover = timelineDialog.locator('.player-value-point-popover');
    await expect(pointPopover).toBeVisible();
    await expect(pointPopover.locator('strong')).toContainText(/\d/);
    await expect(pointPopover.locator('small')).toContainText(/source/i);
    const firstChartPoint = timelineDialog.locator('.player-value-chart-point').first();
    const firstChartPointLabel = await firstChartPoint.getAttribute('aria-label');
    const firstChartPointValue = firstChartPointLabel?.match(/ value ([^ ]+)/)?.[1] || '';
    expect(firstChartPointValue).not.toBe('');
    await firstChartPoint.click();
    await expect(pointPopover.locator('strong')).toContainText(firstChartPointValue);
    await expect(timelineDialog.locator('.player-value-selected-point')).toBeVisible();
    await expect(timelineDialog.locator('.player-value-timeline-note')).toHaveCount(0);
    await timelineDialog.getByRole('tab', { name: 'Position Rank' }).click();
    await expect(timelineDialog.getByRole('tab', { name: 'Position Rank' })).toHaveAttribute('aria-selected', 'true');
    await expect(timelineDialog.getByText(/rank points/i)).toBeVisible();
    await expect(timelineDialog.getByText('Snapshot Source History')).toHaveCount(0);
    await expect(timelineDialog.getByText('Source Movement')).toHaveCount(0);
    await expect(timelineDialog.locator('.player-value-source-chart-grid')).toHaveCount(0);
    await expect(timelineDialog.getByText('Highest', { exact: true })).toBeVisible();
    await expect(timelineDialog.getByText(/May .*2026 \/ RB/i).first()).toBeVisible();
    const allRangeTab = timelineDialog.getByRole('tab', { name: /All/i });
    await allRangeTab.focus();
    await page.keyboard.press('Enter');
    await expect(allRangeTab).toHaveAttribute('aria-selected', 'true');
    await expect(timelineDialog.getByText('May').first()).toBeVisible();
    await timelineDialog.getByRole('button', { name: /Close Bijan Robinson value timeline detail/i }).click();
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
    await expect(fallbackDialog.getByText('Vertical')).toBeVisible();
    expect(fallbackDialogText).toContain('Vertical-');
  });

  test('hides admin-only source inputs in regular view', async ({ page }) => {
    const cachedReport = createModalFixture('player-modal-regular-view');
    await loadModalReport(page, cachedReport, 'regular');
    await openRankings(page);

    const dialog = await openPlayerModal(page, 'Bijan Robinson');

    await expect(dialog.getByText('Source Inputs', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Prospect Summary', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Player News', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Availability History', { exact: true })).toBeVisible();
  });

  test('uses NFL shield for free agents and team logos for defenses', async ({ page }) => {
    const cachedReport = createModalFixture('player-modal-team-icons');
    addRankingModalPlayer(cachedReport, {
      id: 'free-agent-1',
      name: 'Keenan Allen',
      position: 'WR',
      team: null,
      rank: 'WR42',
    });
    addRankingModalPlayer(cachedReport, {
      id: 'defense-1',
      name: 'Bears D/ST',
      position: 'DEF',
      team: 'CHI',
      rank: 'DEF6',
    });

    await loadModalReport(page, cachedReport, 'regular');
    await openRankings(page);

    const freeAgentDialog = await openPlayerModal(page, 'Keenan Allen');
    const freeAgentTeamMark = freeAgentDialog.locator('.player-modal-team-logo-pill');
    await expect(freeAgentTeamMark.locator('.team-logo-pill-league-mark')).toBeVisible();
    await expect(freeAgentTeamMark).not.toContainText('FA');

    await page.keyboard.press('Escape');
    await expect(freeAgentDialog).toHaveCount(0);

    const defenseDialog = await openPlayerModal(page, 'Bears D/ST');
    const defenseHeroImage = defenseDialog.locator('img[alt="Bears D/ST"]').first();
    await expect(defenseHeroImage).toHaveAttribute('src', /\/assets\/draftbuzz-cache\/nfl-logos\/chi\.png$/);
    await expect(defenseHeroImage).toHaveCSS('object-fit', 'contain');
  });
});
