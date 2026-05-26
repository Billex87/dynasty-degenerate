import { expect, test, type Page } from '@playwright/test';
import {
  createCachedCommandCenterReport,
  REPORT_CACHE_KEY,
} from './fixtures/cachedReports';

const SLEEPER_SESSION_KEY = 'dynasty-degenerates:sleeper-session:v1';
const SLEEPER_USERS_KEY = 'dynasty-degenerates:sleeper-user-history:v1';

async function loadCachedReport(
  page: Page,
  cachedReport: ReturnType<typeof createCachedCommandCenterReport>,
  hash = '#momentum',
) {
  const user = {
    userId: '123456789012345678',
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
    standingsRank: 1,
    powerRank: 1,
  };

  await page.addInitScript(
    ({ reportKey, report, sessionKey, usersKey, sessionUser, leagueOption }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(reportKey, JSON.stringify(report));
      window.localStorage.setItem(`${reportKey}:${report.leagueId}`, JSON.stringify(report));
      window.sessionStorage.setItem(
        'dynasty-degenerates:admin-unlock-dismissed:v1',
        'true',
      );
      window.sessionStorage.setItem(
        'dynasty-degenerates:admin-passphrase-verified-session:v1',
        'true',
      );
      window.localStorage.setItem(
        sessionKey,
        JSON.stringify({
          username: sessionUser.username,
          user: sessionUser,
          leagues: [leagueOption],
          adminViewMode: 'admin',
          savedAt: Date.now(),
        }),
      );
      window.localStorage.setItem(usersKey, JSON.stringify([sessionUser]));
    },
    {
      reportKey: REPORT_CACHE_KEY,
      report: {
        ...cachedReport,
        savedAt: Date.now() + 60_000,
      },
      sessionKey: SLEEPER_SESSION_KEY,
      usersKey: SLEEPER_USERS_KEY,
      sessionUser: user,
      leagueOption: league,
    },
  );

  // This panel is a large lazy-loaded report table. Prewarming it keeps the
  // projection assertions from racing Vite's cold transform in local E2E runs.
  await page.request
    .get('/src/components/reportTables/WaiverIntelligencePanel.tsx', {
      timeout: 60_000,
    })
    .catch(() => null);

  await page.goto(`/?leagueId=${cachedReport.leagueId}${hash}`, {
    waitUntil: 'domcontentloaded',
  });
}

async function openReportSection(page: Page, title: string) {
  const section = page
    .locator('details.report-disclosure')
    .filter({ hasText: title })
    .first();
  await expect(section).toBeVisible();
  if (!(await section.evaluate(node => node.open))) {
    await section.evaluate(node => {
      const details = node as HTMLDetailsElement;
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
  }
  await expect(section.locator('.report-disclosure-body-inner')).toBeVisible();
  return section;
}

function attachProjectionContext(
  report: ReturnType<typeof createCachedCommandCenterReport>,
  scoringProfile: string,
) {
  const reportData = report.reportData as any;
  const fallbackPointsById: Record<string, number> = {
    qb1: 20.8,
    rb1: 15.4,
    wr1: 17.2,
    te1: 8.3,
    te2: 12.4,
    wr2: 7.8,
    waiver1: 10.7,
    drop1: 2.1,
  };
  const toContext = (points: number, team?: string | null) => ({
    source: 'stored-weekly-projection' as const,
    provider: 'sleeper',
    season: '2026',
    week: 1,
    scoringProfile,
    projectedFantasyPoints: points,
    tightEndPremiumAdjustment: null,
    opponent: 'MIA',
    homeAway: 'home' as const,
    team: team || null,
    updatedAt: '2026-05-26T00:00:00.000Z',
    fetchedAt: '2026-05-26T00:00:00.000Z',
    status: 'ready' as const,
    note: 'Stored weekly projection fixture.',
    statSummary: '4 rec, 52 rec yds, 0.4 rec TD',
  });
  Object.entries(reportData.playerDetailsById || {}).forEach(
    ([playerId, details]: [string, any]) => {
      if (!details?.weeklyProjection && fallbackPointsById[playerId]) {
        details.weeklyProjection = toContext(fallbackPointsById[playerId], details.team);
      }
    },
  );
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const row = value as any;
    if (typeof row.weeklyProjection === 'number') {
      row.weeklyProjection = toContext(
        row.weeklyProjection,
        row.team || row.playerDetails?.team,
      );
      if (row.playerDetails && typeof row.playerDetails === 'object') {
        row.playerDetails.weeklyProjection = row.weeklyProjection;
      }
    }
    Object.values(row).forEach(walk);
  };
  walk(reportData.waiverIntelligence);
  walk(reportData.managerRosterIntelligence);
  walk(reportData.managerPositionCounts);
}

function removeProjectionContext(report: ReturnType<typeof createCachedCommandCenterReport>) {
  const reportData = report.reportData as any;
  Object.values(reportData.playerDetailsById || {}).forEach((details: any) => {
    delete details.weeklyProjection;
  });
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if ('weeklyProjection' in value) {
      delete (value as any).weeklyProjection;
    }
    Object.values(value).forEach(walk);
  };
  walk(reportData.waiverIntelligence);
  walk(reportData.managerRosterIntelligence);
  walk(reportData.managerPositionCounts);
  reportData.weeklyProjectionDiagnostics = {
    status: 'blocked',
    season: '2026',
    week: 1,
    scoringProfile: null,
    rowCount: 0,
    readyRowCount: 0,
    attachedPlayerCount: 0,
    note: 'Projection features disabled in regression fixture.',
  };
}

test.describe('projection receipts', () => {
  test('TEP waiver receipt opens Player Detail projection context', async ({ page }) => {
    const report = createCachedCommandCenterReport('1317012764002091008');
    report.leagueFormat = '10-Team Dynasty SF PPR + 0.5 TEP';
    const reportData = report.reportData as any;
    reportData.leagueDiagnostics.tightEndPremium = 0.5;
    reportData.leagueDiagnostics.scoringSummary = 'PPR + 0.5 TEP';
    attachProjectionContext(report, 'PPR + 0.5 TEP');
    reportData.playerDetailsById.te2.weeklyProjection = {
      ...reportData.playerDetailsById.te2.weeklyProjection,
      scoringProfile: 'PPR + 0.5 TEP',
      tightEndPremiumAdjustment: 0.7,
      statSummary: '5 rec, 57 rec yds, 0.5 rec TD',
    };
    const tightEndTarget = {
      player_id: 'te2',
      name: 'Replacement Tight End',
      playerDetails: reportData.playerDetailsById.te2,
      currentPositionRank: 'TE5',
      pos: 'TE',
      team: 'LAC',
      owner: null,
      count: 420,
      ktcValue: 4300,
      weeklyProjection: reportData.playerDetailsById.te2.weeklyProjection,
    };
    reportData.waiverIntelligence.availableTrendingAdds = [tightEndTarget];
    reportData.waiverIntelligence.highestKtcAvailable = tightEndTarget;
    reportData.waiverIntelligence.bestAvailableByPosition = {
      ...reportData.waiverIntelligence.bestAvailableByPosition,
      WR: null,
      TE: tightEndTarget,
    };

    await loadCachedReport(page, report);
    const waiverSection = await openReportSection(page, 'Waiver Intelligence');
    const trigger = waiverSection.getByTestId('projection-player-detail-trigger').first();
    await expect(trigger).toBeVisible();
    await expect(waiverSection.getByTestId('weekly-projection-receipt').first()).toBeVisible();

    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('weekly-projection-receipt')).toBeVisible();
    await expect(dialog.getByTestId('weekly-projection-receipt')).toContainText('PPR + 0.5 TEP');
    await expect(dialog.getByTestId('weekly-projection-receipt')).toContainText('+0.7 TEP');
  });

  test('non-TEP waiver receipt keeps Half PPR copy clean', async ({ page }) => {
    const report = createCachedCommandCenterReport('1312139584427012096');
    report.leagueFormat = '10-Team Dynasty SF Half PPR';
    (report.reportData as any).leagueDiagnostics.receptionScoring = 0.5;
    (report.reportData as any).leagueDiagnostics.tightEndPremium = 0;
    (report.reportData as any).leagueDiagnostics.scoringSummary = 'Half PPR';
    attachProjectionContext(report, 'Half PPR');

    await loadCachedReport(page, report);
    const waiverSection = await openReportSection(page, 'Waiver Intelligence');
    const trigger = waiverSection.getByTestId('projection-player-detail-trigger').first();
    await expect(trigger).toBeVisible();
    await trigger.click();

    const receipt = page.getByRole('dialog').getByTestId('weekly-projection-receipt');
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText('Half PPR');
    await expect(receipt).not.toContainText('TEP');
  });

  test('projection-disabled reports hide projection claims', async ({ page }) => {
    const report = createCachedCommandCenterReport('projection-disabled-fixture');
    removeProjectionContext(report);

    await loadCachedReport(page, report);
    const waiverSection = await openReportSection(page, 'Waiver Intelligence');
    await expect(waiverSection.getByTestId('weekly-projection-receipt')).toHaveCount(0);
    await expect(waiverSection.getByTestId('projection-player-detail-trigger')).toHaveCount(0);
    await expect(waiverSection.getByText(/projected pts/i)).toHaveCount(0);
    await expect(waiverSection.getByText(/stored weekly projection/i)).toHaveCount(0);
    await expect(waiverSection.getByText('Waiver Receiver').first()).toBeVisible();
  });
});
