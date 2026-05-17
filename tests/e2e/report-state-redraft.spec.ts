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
  await page.locator('.report-disclosure-summary').filter({ hasText: 'Full Roster Rankings' }).click();
}

async function openDraftYear(page: import('@playwright/test').Page, title: string) {
  await page.locator('.report-disclosure-summary').filter({ hasText: title }).click();
}

test.describe('shareable report control state', () => {
  test('syncs ranking search, sort, and filters into the URL and restores them', async ({ page }) => {
    const cachedReport = await loadCachedReport(page, 'rank-state-redraft-league', '#rankings');
    await openFullRosterRankings(page);

    const search = page.getByPlaceholder('Search player');
    await expect(search).toBeVisible();
    await search.fill('Depth');
    await page.getByRole('button', { name: 'Season' }).click();
    await page.locator('.rankings-position-toggle button[aria-label="WR"]').click();

    await expect(page).toHaveURL(/rankSearch=Depth/);
    await expect(page).toHaveURL(/rankSort=value/);
    await expect(page).toHaveURL(/rankPositions=WR/);
    await expect(page.getByRole('button', { name: /#2 .*Depth Receiver/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /#1 .*Sample Starter/ })).toHaveCount(0);

    await page.reload();
    await openFullRosterRankings(page);
    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}.*#rankings$`));
    await expect(search).toHaveValue('Depth');
    await expect(page.locator('.rankings-position-toggle button[aria-label="WR"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Season' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('opens redraft player details with season value first and keyboard close support', async ({ page }) => {
    await loadCachedReport(page, 'modal-redraft-league', '#rankings');
    await openFullRosterRankings(page);

    await expect(page.locator('.ranking-value-confidence-chip').first()).toBeVisible();
    await page.getByRole('button', { name: /Sample Starter/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-season-value')).toBeVisible();
    await expect(dialog.locator('.player-modal-metric-dynasty-value')).toHaveCount(0);
    await expect(dialog.getByText('Value Confidence', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/value confidence from/i)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('syncs draft sort but starts draft years collapsed on fresh load', async ({ page }) => {
    await loadCachedReport(page, 'draft-state-redraft-league', '#draft');

    await openDraftYear(page, '2026 Main Draft');
    await page.getByRole('button', { name: /Current Season/ }).click();

    await expect(page).not.toHaveURL(/draftOpen=2026/);
    await expect(page).toHaveURL(/draftSort=currentValue/);
    await expect(page).toHaveURL(/draftDir=desc/);
    await expect(page.getByText('Season value window').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /#1 Sample Starter/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /#1 Sample Starter/ })).toHaveCount(0);
    await openDraftYear(page, '2026 Main Draft');
    await expect(page.getByRole('button', { name: /#1 Sample Starter/ })).toBeVisible();
  });

  test('hides draft history for redraft leagues with no draft data yet', async ({ page }) => {
    const cachedReport = createCachedRedraftNoDraftReport();
    await loadCachedReportPayload(page, cachedReport, '#draft');

    await expect(page).toHaveURL(new RegExp(`leagueId=${cachedReport.leagueId}$`));
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Draft History' })).toHaveCount(0);
    await expect(page.getByText('No draft data available')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Rankings' }).click();
    await openFullRosterRankings(page);
    await expect(page.getByRole('button', { name: /#1 .*Sample Starter/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Weekly Momentum' }).click();
    await expect(page.getByRole('tab', { name: 'Weekly Momentum' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Top 10 Weekly Risers')).toBeVisible();

    await page.getByRole('tab', { name: 'Trade History' }).click();
    await expect(page.getByText('Trade Value Leaderboard')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Draft History' })).toHaveCount(0);
  });

  test('shows early rookie market labels without exposing comparison dates', async ({ page }) => {
    const cachedReport = createCachedDynastyRookieReport();
    await loadCachedReportPayload(page, cachedReport, '#draft');

    await openDraftYear(page, '2026 Rookie Draft');
    await expect(page.getByText('Stabilized rookie baseline').first()).toBeVisible();
    await expect(page.getByText('Early Riser')).toBeVisible();
    await expect(page.getByText('Early Faller')).toBeVisible();
    await expect(page.getByText('Hit', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Miss', { exact: true })).toHaveCount(0);

    const draftTabText = await page.locator('.draft-year-card-grid').innerText();
    expect(draftTabText).not.toContain('2026-05-07');
    expect(draftTabText).not.toMatch(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/);
  });
});
