import { expect, test } from '@playwright/test';
import { createCachedRedraftNoDraftReport, createCachedRedraftReport, REPORT_CACHE_KEY } from './fixtures/cachedReports';

async function loadCachedReport(page: import('@playwright/test').Page, leagueId: string, hash: string) {
  const cachedReport = createCachedRedraftReport(leagueId);
  await loadCachedReportPayload(page, cachedReport, hash);
  return cachedReport;
}

async function loadCachedReportPayload(page: import('@playwright/test').Page, cachedReport: ReturnType<typeof createCachedRedraftReport>, hash: string) {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: REPORT_CACHE_KEY, value: cachedReport },
  );
  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, { waitUntil: 'domcontentloaded' });
}

function createCachedDynastyRookieReport(leagueId = 'draft-state-dynasty-league') {
  const cachedReport = createCachedRedraftReport(leagueId);
  const reportData = cachedReport.reportData as any;
  cachedReport.leagueName = 'Rookie Smoke Dynasty';
  cachedReport.leagueFormat = '4-Team Dynasty SF PPR';
  reportData.leagueValueMode = 'dynasty';
  reportData.leagueDiagnostics = {
    ...reportData.leagueDiagnostics,
    valueMode: 'dynasty',
    ktcProfileLabel: 'Dynasty SF PPR',
  };
  reportData.draftPicks = [
    {
      ...reportData.draftPicks[0],
      draftYear: '2026',
      draftKind: 'rookie',
      draftPickCount: 48,
      draftValueDate: null,
      currentValueDate: null,
      pick: 1,
      playerName: 'Sample Starter',
      playerPos: 'RB',
      manager: 'Tester',
      managerDisplayName: 'Tester',
      ktcValue: 4300,
      currentKtcValue: 5000,
      valueGain: 700,
      positionRankMay2025: 'RB4',
      currentPositionRank: 'RB1',
      positionRankChange: '+3',
      draftOutcome: 'neutral',
      isStarter: true,
    },
    {
      ...reportData.draftPicks[1],
      draftYear: '2026',
      draftKind: 'rookie',
      draftPickCount: 48,
      draftValueDate: null,
      currentValueDate: null,
      pick: 2,
      playerName: 'Depth Receiver',
      playerPos: 'WR',
      manager: 'Rival',
      managerDisplayName: 'Rival',
      ktcValue: 4500,
      currentKtcValue: 4100,
      valueGain: -400,
      positionRankMay2025: 'WR1',
      currentPositionRank: 'WR6',
      positionRankChange: '-5',
      draftOutcome: 'neutral',
      isStarter: false,
    },
  ];
  reportData.draftStats = [
    { manager: 'Tester', managerDisplayName: 'Tester', totalPicks: 1, hits: 0, misses: 0, starters: 1, avgKtcGain: 700 },
    { manager: 'Rival', managerDisplayName: 'Rival', totalPicks: 1, hits: 0, misses: 0, starters: 0, avgKtcGain: -400 },
  ];
  return cachedReport;
}

async function openFullRosterRankings(page: import('@playwright/test').Page) {
  await openReportDisclosure(page, 'Full Roster Rankings');
}

async function openDraftYear(page: import('@playwright/test').Page, title: string) {
  await openReportDisclosure(page, title);
}

async function openReportDisclosure(page: import('@playwright/test').Page, title: string) {
  const section = page.locator('details.report-disclosure').filter({ hasText: title }).first();
  await expect(section).toBeVisible();
  if (!(await section.evaluate(node => node.open))) {
    await section.locator('summary.report-disclosure-summary').click();
  }
  await expect(section).toHaveAttribute('open', '');
}

function draftPickRow(page: import('@playwright/test').Page, playerName: string) {
  return page.locator('.rookie-draft-row').filter({ hasText: playerName });
}

test.describe('shareable report control state', () => {
  test('syncs ranking search, sort, and filters into the URL and restores them', async ({ page }) => {
    const cachedReport = createCachedRedraftReport('rank-state-redraft-league');
    const rankingRows = cachedReport.reportData.rankings.profiles['redraft-ppr'];
    Object.assign(rankingRows[0] as any, { movement: -25, movementLabel: '-25', movementDirection: 'down' });
    Object.assign(rankingRows[1] as any, { movement: 10, movementLabel: '+10', movementDirection: 'up' });
    await loadCachedReportPayload(page, cachedReport, '#rankings');
    await openFullRosterRankings(page);

    const search = page.getByPlaceholder('Search by player, team, manager');
    await expect(search).toBeVisible();
    const movementSort = page.locator('.rankings-movement-sort-button');
    await expect(movementSort).toHaveAttribute('aria-label', /risers/);
    await movementSort.click();
    await expect(page).toHaveURL(/redraftSort=movement/);
    await expect(page).not.toHaveURL(/redraftMovement=/);
    await expect(movementSort).toHaveAttribute('aria-label', /risers/);
    await expect(movementSort).toContainText('Weekly');
    await expect(page.locator('.value-board__row').first()).toContainText('Depth Receiver');
    await movementSort.click();
    await expect(page).toHaveURL(/redraftMovement=down/);
    await expect(movementSort).toHaveAttribute('aria-label', /fallers/);
    await expect(movementSort).toContainText('Weekly');
    await expect(page.locator('.value-board__row').first()).toContainText('Bijan Robinson');

    await search.fill('Depth');
    await page.getByRole('button', { name: 'Season' }).click();
    await page.locator('.rankings-position-toggle button[aria-label="WR"]').click();

    await expect(page).toHaveURL(/redraftSearch=Depth/);
    await expect(page).not.toHaveURL(/redraftSort=/);
    await expect(page).not.toHaveURL(/redraftMovement=/);
    await expect(page).toHaveURL(/redraftPositions=WR/);
    await expect(page.getByRole('button', { name: /#2 .*Depth Receiver/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /#1 .*Bijan Robinson/ })).toHaveCount(0);

    await page.reload();
    await openFullRosterRankings(page);
    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}.*#rankings$`));
    await expect(search).toHaveValue('Depth');
    await expect(page.locator('.rankings-position-toggle button[aria-label="WR"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Season' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.rankings-sort-toggle').getByRole('button', { name: 'Confidence' })).toHaveCount(0);
  });

  test('opens redraft player details with season value first and keyboard close support', async ({ page }) => {
    await loadCachedReport(page, 'modal-redraft-league', '#rankings');
    await openFullRosterRankings(page);

    await expect(page.locator('.ranking-value-confidence-chip')).toHaveCount(0);
    await page.getByRole('button', { name: /Bijan Robinson/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-season-value')).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-last-season')).toHaveCount(0);
    await expect(dialog.locator('.player-modal-metric-dynasty-value')).toHaveCount(0);
    await expect(dialog.getByText('Degen Read', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Market Price', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Degen Gap', { exact: true })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('syncs draft sort but starts draft years collapsed on fresh load', async ({ page }) => {
    await loadCachedReport(page, 'draft-state-redraft-league', '#draft');

    await openDraftYear(page, '2026 Main Draft');
    await page.getByRole('button', { name: /current season value/i }).click();

    await expect(page).not.toHaveURL(/draftOpen=2026/);
    await expect(page).toHaveURL(/draftSort=currentValue/);
    await expect(page).toHaveURL(/draftDir=desc/);
    await expect(page.getByRole('button', { name: /current season value/i })).toBeVisible();
    await expect(page.locator('.rookie-draft-row-header')).toContainText('Current Value');
    await expect(draftPickRow(page, 'Bijan Robinson').filter({ hasText: '#1' })).toBeVisible();

    await page.reload();
    await expect(draftPickRow(page, 'Bijan Robinson')).toHaveCount(0);
    await openDraftYear(page, '2026 Main Draft');
    await expect(draftPickRow(page, 'Bijan Robinson').filter({ hasText: '#1' })).toBeVisible();
  });

  test('keeps draft history visible for legacy redraft cache with current main draft picks', async ({ page }) => {
    const currentSeason = String(new Date().getFullYear());
    const cachedReport = createCachedRedraftReport('legacy-current-draft-redraft-league');
    const reportData = cachedReport.reportData as any;

    reportData.draftPicks = reportData.draftPicks.map((pick: any) => ({
      ...pick,
      draftYear: currentSeason,
      draftKind: 'main',
    }));
    delete reportData.leagueDiagnostics.currentSeason;
    delete reportData.leagueDiagnostics.hasCurrentSeasonMainDraft;
    delete reportData.leagueDiagnostics.currentSeasonMainDraftPickCount;
    delete reportData.leagueDiagnostics.currentSeasonMainDraftPickedPlayerCount;
    delete reportData.leagueDiagnostics.currentSeasonMainDraftStatus;

    await loadCachedReportPayload(page, cachedReport, '#draft');

    await expect(page.getByRole('tab', { name: 'Draft History' })).toBeVisible();
    await openDraftYear(page, `${currentSeason} Main Draft`);
    await expect(draftPickRow(page, 'Bijan Robinson').filter({ hasText: '#1' })).toBeVisible();
  });

  test('hides draft history for redraft leagues with no draft data yet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const cachedReport = createCachedRedraftNoDraftReport();
    await loadCachedReportPayload(page, cachedReport, '#draft');

    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}$`));
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Draft History' })).toHaveCount(0);
    await expect(page.getByText('No draft data available')).toHaveCount(0);
    await expect.poll(async () =>
      page.locator('.report-header-tabs').evaluate(element => {
        const gridColumns = window.getComputedStyle(element).gridTemplateColumns;
        return gridColumns.split(' ').filter(Boolean).length;
      })
    ).toBe(4);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.getByRole('tab', { name: 'Rankings' }).click();
    await openFullRosterRankings(page);
    await expect(page.getByRole('button', { name: /#1 .*Bijan Robinson/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Weekly Momentum' }).click();
    await expect(page.getByRole('tab', { name: 'Weekly Momentum' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Market Movers' })).toBeVisible();

    await page.getByRole('tab', { name: 'Trade History' }).click();
    await expect(page.getByText('Trade reads unlock after the draft')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Draft History' })).toHaveCount(0);
  });

  test('hides draft history for redraft leagues when only prior-season draft data exists', async ({ page }) => {
    const cachedReport = createCachedRedraftReport('prior-draft-redraft-league');
    const reportData = cachedReport.reportData as any;
    reportData.draftPicks = reportData.draftPicks.map((pick: any) => ({
      ...pick,
      draftYear: '2025',
      draftKind: 'main',
    }));
    reportData.leagueDiagnostics = {
      ...reportData.leagueDiagnostics,
      hasCurrentSeasonMainDraft: false,
      currentSeasonMainDraftPickCount: 0,
      currentSeasonMainDraftPickedPlayerCount: 0,
      currentSeasonMainDraftStatus: 'not_started',
    };

    await loadCachedReportPayload(page, cachedReport, '#draft');

    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}$`));
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Draft History' })).toHaveCount(0);
  });

  test('shows rookie draft rows without exposing comparison dates', async ({ page }) => {
    const cachedReport = createCachedDynastyRookieReport();
    await loadCachedReportPayload(page, cachedReport, '#draft');

    await openDraftYear(page, '2026 Rookie Draft');
    await expect(page.getByRole('heading', { name: '2026 Rookie Draft' })).toBeVisible();
    await expect(page.locator('.rookie-draft-row-header')).toContainText('Draft Value');
    await expect(page.locator('.rookie-draft-row-header')).toContainText('Now Value');
    await expect(draftPickRow(page, 'Sample Starter').filter({ hasText: '#1' })).toBeVisible();
    await expect(draftPickRow(page, 'Depth Receiver').filter({ hasText: '#2' })).toBeVisible();
    await expect(page.locator('.rookie-draft-row-list')).not.toContainText(/\bHit\b/);
    await expect(page.locator('.rookie-draft-row-list')).not.toContainText(/\bMiss\b/);

    const draftTabText = await page.locator('.draft-year-card-grid').innerText();
    expect(draftTabText).not.toContain('2026-05-07');
    expect(draftTabText).not.toMatch(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/);
  });
});
