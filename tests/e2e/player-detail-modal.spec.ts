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
    weeklyProjection: {
      source: 'stored-weekly-projection',
      provider: 'sleeper',
      season: '2026',
      week: 1,
      scoringProfile: 'Half PPR',
      projectedFantasyPoints: 14.8,
      tightEndPremiumAdjustment: null,
      opponent: 'NYJ',
      homeAway: 'home',
      team: 'BUF',
      updatedAt: '2026-05-26T00:00:00.000Z',
      fetchedAt: '2026-05-26T00:00:00.000Z',
      status: 'ready',
      note: 'Stored weekly projection fixture.',
      statSummary: '4 rec, 61 rec yds, 0.5 rec TD',
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

function stripPlayerProjection(
  cachedReport: ReturnType<typeof createCachedRedraftReport>,
  playerId = 'player-1',
) {
  const details = cachedReport.reportData.playerDetailsById[playerId] as any;
  if (!details) return;
  delete details.weeklyProjection;
  if (details.valueProfile) {
    delete details.valueProfile.weeklyProjection;
    delete details.valueProfile.projectedPoints;
    delete details.valueProfile.projectedFantasyPoints;
    delete details.valueProfile.projection;
    delete details.valueProfile.fantasyProjection;
    delete details.valueProfile.fantasyProsProjection;
    delete details.valueProfile.fantasyProsProjectedPoints;
  }
}

function setDivergentValueRankTimeline(cachedReport: ReturnType<typeof createCachedRedraftReport>) {
  const player1 = cachedReport.reportData.playerDetailsById['player-1'] as any;
  const timeline = player1.valueTimeline;
  if (!timeline) return;

  const points = [
    { date: '2025-11-17', value: 5200, rank: 'RB9', overallRank: 42, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2, marketKtc: 5125, fantasyCalcDynasty: 5250 },
    { date: '2026-02-17', value: 5000, rank: 'RB7', overallRank: 35, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2, marketKtc: 4925, fantasyCalcDynasty: 5050 },
    { date: '2026-05-17', value: 4600, rank: 'RB5', overallRank: 28, sources: ['marketKtc', 'fantasyCalc'], sourceCount: 2, marketKtc: 4525, fantasyCalcDynasty: 4650 },
  ];
  const divergentWindow = {
    key: '6m',
    label: '6M',
    days: 183,
    pointCount: points.length,
    startDate: points[0].date,
    endDate: points[points.length - 1].date,
    startValue: points[0].value,
    endValue: points[points.length - 1].value,
    delta: -600,
    deltaPct: -11.5,
    points,
  };

  timeline.selectedWindow = '6m';
  timeline.availableWindows = timeline.availableWindows.map((window: any) => (
    window.key === '6m'
      ? { ...divergentWindow, points: undefined }
      : window
  ));
  timeline.windows = {
    ...timeline.windows,
    '6m': divergentWindow,
  };
  timeline.points = points;
  timeline.summary = {
    ...timeline.summary,
    startValue: divergentWindow.startValue,
    endValue: divergentWindow.endValue,
    delta: divergentWindow.delta,
    deltaPct: divergentWindow.deltaPct,
  };
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
        managerAnchors: [],
      },
    ],
    adminViewMode,
    savedAt: Date.now(),
  };
  const report = {
    ...cachedReport,
    savedAt: Math.max(Number(cachedReport.savedAt) || 0, Date.now() + 60_000),
  };

  await page.addInitScript(
    ({ reportKey, report, sessionKey, session, usersKey, adminPassphraseSessionKey, admin }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(reportKey, JSON.stringify(report));
      window.localStorage.setItem(`${reportKey}:${report.leagueId}`, JSON.stringify(report));
      window.localStorage.setItem(sessionKey, JSON.stringify(session));
      window.localStorage.setItem(usersKey, JSON.stringify([{
        ...session.user,
        leagues: session.leagues,
        recentLeagueIds: [report.leagueId],
        savedAt: Date.now(),
      }]));
      if (admin) {
        window.sessionStorage.setItem(adminPassphraseSessionKey, 'true');
      }
    },
    {
      reportKey: REPORT_CACHE_KEY,
      report,
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
  await expect(rowButton).toBeVisible({ timeout: 30_000 });
  await rowButton.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function tabUntilFocused(
  page: import('@playwright/test').Page,
  target: import('@playwright/test').Locator,
  maxTabs = 80,
) {
  for (let index = 0; index < maxTabs; index += 1) {
    const isFocused = await target.evaluate((element) => element === document.activeElement).catch(() => false);
    if (isFocused) return;
    await page.keyboard.press('Tab');
  }

  await expect(target).toBeFocused();
}

async function expectValueTimelineModalFitsViewport(
  page: import('@playwright/test').Page,
  timelineDialog: import('@playwright/test').Locator,
) {
  const viewport = page.viewportSize();
  const modalBox = await timelineDialog.boundingBox();

  expect(modalBox).not.toBeNull();
  if (!viewport || !modalBox) return;

  expect(modalBox.x).toBeGreaterThanOrEqual(0);
  expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(modalBox.width).toBeLessThanOrEqual(Math.min(viewport.width - 4, 920));
  expect(Math.abs((modalBox.x + modalBox.width / 2) - viewport.width / 2)).toBeLessThanOrEqual(2);

  if (viewport.width <= 480) {
    const backButtonBox = await timelineDialog.getByRole('button', { name: 'Back to player' }).boundingBox();
    const closeAllButtonBox = await timelineDialog.getByRole('button', { name: 'Close all' }).boundingBox();

    expect(backButtonBox).not.toBeNull();
    expect(closeAllButtonBox).not.toBeNull();
    if (backButtonBox && closeAllButtonBox) {
      const verticalOverlap = Math.min(
        backButtonBox.y + backButtonBox.height,
        closeAllButtonBox.y + closeAllButtonBox.height,
      ) - Math.max(backButtonBox.y, closeAllButtonBox.y);
      expect(verticalOverlap).toBeGreaterThanOrEqual(Math.min(backButtonBox.height, closeAllButtonBox.height) * 0.5);
      expect(backButtonBox.height).toBeGreaterThanOrEqual(40);
      expect(closeAllButtonBox.height).toBeGreaterThanOrEqual(40);
      expect(closeAllButtonBox.x + closeAllButtonBox.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  }
}

async function expectValueTimelineResponsivePolish(
  page: import('@playwright/test').Page,
  timelineDialog: import('@playwright/test').Locator,
) {
  const viewport = page.viewportSize();
  await expectValueTimelineModalFitsViewport(page, timelineDialog);
  if (!viewport) return;

  const horizontalOverflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  const headerBox = await timelineDialog.locator('.player-value-timeline-modal-header').boundingBox();
  const backgroundBox = await timelineDialog.locator('.player-value-team-backdrop').boundingBox();
  expect(headerBox).not.toBeNull();
  expect(backgroundBox).not.toBeNull();
  if (headerBox && backgroundBox) {
    expect(backgroundBox.width).toBeGreaterThanOrEqual(headerBox.width - 1);
    expect(backgroundBox.height).toBeGreaterThanOrEqual(headerBox.height - 1);
  }

  const actionButtons = timelineDialog.locator('.player-value-timeline-back-button, .player-value-timeline-close-all-button');
  const actionButtonCount = await actionButtons.count();
  for (let index = 0; index < actionButtonCount; index += 1) {
    const button = actionButtons.nth(index);
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    const doesTextFit = await button.evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
    expect(doesTextFit).toBe(true);
  }

  const interactiveControls = timelineDialog.locator('.player-value-window-tab, .player-value-chart-mode-button');
  const interactiveControlCount = await interactiveControls.count();
  for (let index = 0; index < interactiveControlCount; index += 1) {
    const control = interactiveControls.nth(index);
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  }

  const chartStageBox = await timelineDialog.locator('.player-value-chart-stage').boundingBox();
  expect(chartStageBox).not.toBeNull();
  if (chartStageBox) {
    expect(chartStageBox.x).toBeGreaterThanOrEqual(0);
    expect(chartStageBox.x + chartStageBox.width).toBeLessThanOrEqual(viewport.width + 1);
  }

  await expect(timelineDialog.locator('.player-value-timeline-title')).toBeVisible();
  await expect(timelineDialog.locator('.player-value-timeline-description')).toBeVisible();
  await expect(timelineDialog.getByText('Select points for exact value and rank.')).toBeVisible();
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
    await expect(dialog.getByText('Value Basis:', { exact: true })).toHaveCount(0);

    await expect(dialog.getByText('College')).toBeVisible();
    await expect(dialog.getByText('40 Time')).toBeVisible();
    await expect(dialog.getByText('Vertical')).toBeVisible();
    await expect(dialog.getByText('Birthday')).toBeVisible();
    const productionDialogText = (await dialog.textContent()) || '';
    expect(productionDialogText).toContain('4.41s');
    expect(productionDialogText).toContain('36.5"');
    expect(productionDialogText).toContain('125"');
    expect(productionDialogText).toContain('18 reps');
    expect(productionDialogText).toContain('6.95s');
    expect(productionDialogText).toContain('4.22s');
    expect(productionDialogText).toContain('105.2');
    expect(productionDialogText).toContain('Jan 1, 2000');
    await expect(dialog.locator('p').filter({ hasText: 'Availability: 2025: 14 GP' }).first()).toBeVisible();

    await expect(dialog.getByText('Blend Evidence', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Prospect Summary', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/This full summary should stay readable in the full-width pill with no truncation or abbreviation/i)).toBeVisible();
    await expect(dialog.getByText('Player News', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Availability History', { exact: true })).toBeVisible();

    const projectionReceipt = dialog.getByTestId('weekly-projection-receipt');
    await expect(projectionReceipt).toBeVisible();
    await expect(projectionReceipt).toContainText(/Weekly projection/i);
    await expect(projectionReceipt).toContainText('14.8 pts');
    await expect(projectionReceipt).toContainText('Week 1');
    await expect(projectionReceipt).toContainText('Half PPR');
    await expect(projectionReceipt).toContainText('4 rec, 61 rec yds, 0.5 rec TD');
    await expect(
      dialog.locator('.ai-read-trace-kicker').filter({ hasText: /^Read details/i })
    ).toBeVisible();
    await expect(
      dialog.locator('.ai-read-chip').filter({ hasText: 'Round 1, pick 18' })
    ).toBeVisible();
    await expect(
      dialog.locator('.ai-read-chip').filter({ hasText: 'Runway 90%' })
    ).toBeVisible();
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
    await dialog.getByRole('button', { name: /View Bijan Robinson value history/i }).click();
    const timelineDialog = page.getByRole('dialog').filter({ hasText: 'Current Redraft Market Price Timeline' });
    await expect(timelineDialog.getByRole('tab', { name: /1M/i })).toBeVisible();
    await expect(timelineDialog.getByRole('tab', { name: /3M/i })).toBeVisible();
    await expect(timelineDialog.getByRole('tab', { name: /6M/i })).toHaveAttribute('aria-selected', 'true');
    await expect(timelineDialog.getByRole('tab', { name: /1Y/i })).toBeVisible();
    await expect(timelineDialog.getByRole('tab', { name: /All/i })).toBeVisible();
    await expect(timelineDialog.getByText('Current Redraft Market Price Timeline')).toBeVisible();
    await expectValueTimelineModalFitsViewport(page, timelineDialog);
    await expect(timelineDialog.locator('.player-value-team-backdrop')).toHaveAttribute('style', /buf\.jpg/i);
    const identityHeader = timelineDialog.locator('.player-value-identity-row');
    await expect(identityHeader).toBeVisible();
    await expect(identityHeader.locator('.player-value-timeline-title')).toHaveText('Bijan Robinson Value History');
    await expect(identityHeader.locator('.player-value-timeline-title')).toBeFocused();
    await expect(identityHeader.locator('.player-value-identity-team-pill')).toContainText('BUF');
    await expect(identityHeader.locator('.player-value-identity-position-pill')).toHaveCount(0);
    await expect(identityHeader.locator('.player-value-identity-rank-pill')).toHaveText(/^RB\d+$/);
    await expect(identityHeader.locator('.player-value-identity-value-pill')).toHaveText(/^Value \d[\d,]*$/);
    await expect(timelineDialog.locator('.player-value-timeline-description')).toBeVisible();
    await expect(timelineDialog.locator('.player-value-timeline-description')).toContainText(/current value .* net move .* rank movement/i);
    await expect(timelineDialog.getByRole('button', { name: 'Back to player' })).toBeVisible();
    await expect(timelineDialog.getByRole('button', { name: 'Close all' })).toBeVisible();
    await expect(timelineDialog.getByText('Current Value', { exact: true })).toBeVisible();
    await expect(timelineDialog.getByText('Net Move', { exact: true })).toBeVisible();
    await expect(timelineDialog.getByText('Rank Move', { exact: true })).toBeVisible();
    await expect(timelineDialog.getByText('Range', { exact: true })).toBeVisible();
    await expect(timelineDialog.getByText('All-Time Range')).toBeVisible();
    await expect(timelineDialog.getByRole('tab', { name: /market value chart/i })).toHaveAttribute('aria-selected', 'true');
    await expect(timelineDialog.getByText('Select points for exact value and rank.')).toBeVisible();
    await expect(timelineDialog.locator([
      '.player-value-timeline-chart path[stroke="#34d399"]',
      '.player-value-timeline-chart path[stroke="#fb7185"]',
      '.player-value-timeline-chart path[stroke="#94a3b8"]',
    ].join(', '))).toHaveCount(1);
    const pointPopover = timelineDialog.locator('.player-value-point-popover');
    await expect(pointPopover).toBeVisible();
    await expect(pointPopover.locator('strong')).toContainText(/\d/);
    await expect(pointPopover.locator('small')).toContainText(/blend inputs|source/i);
    const firstChartPoint = timelineDialog.locator('.player-value-chart-point').first();
    const firstChartPointLabel = await firstChartPoint.getAttribute('aria-label');
    const firstChartPointValue = firstChartPointLabel?.match(/value ([\d,]+), rank/)?.[1] || '';
    expect(firstChartPointValue).not.toBe('');
    await firstChartPoint.click();
    await expect(pointPopover.locator('strong')).toContainText(firstChartPointValue);
    await expect(timelineDialog.locator('.player-value-selected-point')).toBeVisible();
    await expect(timelineDialog.locator('.player-value-timeline-note')).toHaveCount(0);
    await timelineDialog.getByRole('tab', { name: /position rank chart/i }).click();
    await expect(timelineDialog.getByRole('tab', { name: /position rank chart/i })).toHaveAttribute('aria-selected', 'true');
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
    await timelineDialog.getByRole('button', { name: 'Back to player' }).click();
    await expect(timelineDialog).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /View Bijan Robinson value history/i })).toBeFocused();

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

  test('hides weekly projection receipt when player projection context is disabled', async ({ page }) => {
    const cachedReport = createModalFixture('player-modal-projection-disabled');
    stripPlayerProjection(cachedReport);
    await loadModalReport(page, cachedReport, 'regular');
    await openRankings(page);

    const dialog = await openPlayerModal(page, 'Bijan Robinson');

    await expect(dialog.getByTestId('weekly-projection-receipt')).toHaveCount(0);
    await expect(dialog.getByText(/Stored weekly projection|Weekly projection/i)).toHaveCount(0);
    await expect(dialog.getByText('14.8 pts')).toHaveCount(0);
    await expect(dialog.getByText('Half PPR')).toHaveCount(0);
  });

  test('closes player detail from value history close-all action', async ({ page }) => {
    const cachedReport = createModalFixture('player-modal-value-history-close-all');
    await loadModalReport(page, cachedReport, 'regular');
    await openRankings(page);

    const dialog = await openPlayerModal(page, 'Bijan Robinson');
    await dialog.getByRole('button', { name: /View Bijan Robinson value history/i }).click();

    const timelineDialog = page.getByRole('dialog').filter({ hasText: 'Current Redraft Market Price Timeline' });
    await expect(timelineDialog.getByRole('heading', { name: 'Bijan Robinson Value History' })).toBeVisible();
    await timelineDialog.getByRole('button', { name: 'Close all' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('supports keyboard focus through player and value history modals', async ({ page }) => {
    const cachedReport = createModalFixture('player-modal-keyboard-focus-flow');
    await loadModalReport(page, cachedReport, 'regular');
    await openRankings(page);

    const rowButton = page.getByRole('button', { name: /Bijan Robinson/ }).first();
    await expect(rowButton).toBeVisible();
    await rowButton.focus();
    await expect(rowButton).toBeFocused();
    await page.keyboard.press('Enter');

    let dialog = page.getByRole('dialog').filter({ hasText: 'Bijan Robinson' });
    await expect(dialog.getByRole('heading', { name: 'Bijan Robinson', exact: true })).toBeFocused();

    const closePlayerButton = dialog.getByRole('button', { name: /Close Bijan Robinson details/i });
    await closePlayerButton.focus();
    await expect(closePlayerButton).toBeFocused();

    let valueHistoryTrigger = dialog.getByRole('button', { name: /View Bijan Robinson value history/i });
    await tabUntilFocused(page, valueHistoryTrigger);
    await page.keyboard.press('Enter');

    let timelineDialog = page.getByRole('dialog').filter({ hasText: 'Current Redraft Market Price Timeline' });
    let timelineTitle = timelineDialog.getByRole('heading', { name: 'Bijan Robinson Value History' });
    await expect(timelineTitle).toBeFocused();

    await timelineTitle.press('Escape');
    await expect(timelineDialog).toHaveCount(0);
    await expect(valueHistoryTrigger).toBeFocused();

    await page.keyboard.press('Enter');
    timelineDialog = page.getByRole('dialog').filter({ hasText: 'Current Redraft Market Price Timeline' });
    timelineTitle = timelineDialog.getByRole('heading', { name: 'Bijan Robinson Value History' });
    await expect(timelineTitle).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(timelineDialog.getByRole('button', { name: 'Close all' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(rowButton).toBeFocused();

    await page.keyboard.press('Enter');
    dialog = page.getByRole('dialog').filter({ hasText: 'Bijan Robinson' });
    await expect(dialog.getByRole('heading', { name: 'Bijan Robinson', exact: true })).toBeFocused();

    valueHistoryTrigger = dialog.getByRole('button', { name: /View Bijan Robinson value history/i });
    await tabUntilFocused(page, valueHistoryTrigger);
    await page.keyboard.press('Enter');
    timelineDialog = page.getByRole('dialog').filter({ hasText: 'Current Redraft Market Price Timeline' });
    await expect(timelineDialog.getByRole('heading', { name: 'Bijan Robinson Value History' })).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(timelineDialog.getByRole('button', { name: 'Back to player' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(timelineDialog).toHaveCount(0);
    await expect(valueHistoryTrigger).toBeFocused();
  });

  test('colors value and rank charts by the selected metric direction', async ({ page }) => {
    const cachedReport = createModalFixture('player-modal-value-rank-color-direction');
    setDivergentValueRankTimeline(cachedReport);
    await loadModalReport(page, cachedReport, 'regular');
    await openRankings(page);

    const dialog = await openPlayerModal(page, 'Bijan Robinson');
    await dialog.getByRole('button', { name: /View Bijan Robinson value history/i }).click();

    const timelineDialog = page.getByRole('dialog').filter({ hasText: 'Current Redraft Market Price Timeline' });
    await expect(timelineDialog.getByRole('heading', { name: 'Bijan Robinson Value History' })).toBeVisible();
    const sixMonthTab = timelineDialog.getByRole('tab', { name: /6M/i });
    await expect(sixMonthTab).toHaveAttribute('aria-selected', 'true');
    await expect(sixMonthTab).toHaveClass(/player-value-window-tab-down/);
    await expect(timelineDialog.locator('.player-value-timeline-chart path[stroke="#fb7185"]')).toHaveCount(1);

    await timelineDialog.getByRole('tab', { name: /position rank chart/i }).click();
    await expect(timelineDialog.getByRole('tab', { name: /position rank chart/i })).toHaveAttribute('aria-selected', 'true');
    await expect(timelineDialog.locator('.player-value-timeline-chart path[stroke="#34d399"]')).toHaveCount(1);
  });

  test('keeps value history modal centered and readable across the polish viewport matrix', async ({ page }) => {
    const viewports = [
      { width: 320, height: 720 },
      { width: 360, height: 780 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 414, height: 896 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 1000 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const cachedReport = createModalFixture(`player-modal-value-responsive-${viewport.width}`);
      await loadModalReport(page, cachedReport, 'regular');
      await openRankings(page);

      const dialog = await openPlayerModal(page, 'Bijan Robinson');
      await dialog.getByRole('button', { name: /View Bijan Robinson value history/i }).click();
      const timelineDialog = page.getByRole('dialog').filter({ hasText: 'Current Redraft Market Price Timeline' });

      await expect(timelineDialog.getByRole('heading', { name: 'Bijan Robinson Value History' })).toBeVisible();
      await expect(timelineDialog.locator('.player-value-team-backdrop')).toHaveAttribute('style', /buf\.jpg/i);
      await expectValueTimelineResponsivePolish(page, timelineDialog);

      await timelineDialog.getByRole('button', { name: 'Close all' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });

  test('hides admin-only source inputs in regular view', async ({ page }) => {
    const cachedReport = createModalFixture('player-modal-regular-view');
    await loadModalReport(page, cachedReport, 'regular');
    await openRankings(page);

    const dialog = await openPlayerModal(page, 'Bijan Robinson');

    await expect(dialog.getByText('Blend Evidence', { exact: true })).toHaveCount(0);
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
