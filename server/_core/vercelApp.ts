import './env';
import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from '../routers';
import { createContext } from './context';
import { apiErrorHandler, apiNotFoundHandler, configureSecurity } from './security';
import { storeKtcSnapshot } from '../ktcSnapshotJob';
import { getSnapshotDateKey } from '../ktcLoader';
import { getProspectSnapshotMonth, shouldRunMonthlyProspectSnapshot, storeNflDraftBuzzProspectSnapshot } from '../prospectSource';
import { refreshFantasyProsEndpointSnapshotRefresh, refreshPlayerNewsSnapshots, runDynamicDataRefresh } from '../dynamicDataJobs';
import {
  getFantasyProsEndpointSnapshotScheduleLabel,
  getPacificScheduleParts,
  isFantasyProsEndpointSnapshotWindow,
} from '../fantasyProsEndpointSnapshotSchedule';
import {
  LEAGUE_REPORT_SNAPSHOT_HOURS,
  PACIFIC_TIME_ZONE,
  getPacificHour,
  isLeagueReportSnapshotWindow,
} from '../pacificCronWindows';

const app = express();

function parseLeagueIds(value: string | undefined): string[] {
  return Array.from(
    new Set(
      String(value || '')
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function isTruthyFlag(value: unknown): boolean {
  return /^(?:1|true|yes|on)$/i.test(String(value || ''));
}

function isCronAuthorized(req: express.Request): { ok: true; configuredSecret?: string } | { ok: false; status: number; error: string } {
  const configuredSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (!configuredSecret && process.env.NODE_ENV === 'production') {
    return { ok: false, status: 500, error: 'CRON_SECRET is not configured' };
  }

  if (configuredSecret && authHeader !== `Bearer ${configuredSecret}`) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true, configuredSecret };
}

configureSecurity(app);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true, parameterLimit: 100 }));

app.get('/api/cron/ktc-snapshot', async (req, res) => {
  const auth = isCronAuthorized(req);
  const forceRun = req.query.force === 'true';

  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }

  const now = new Date();
  const pacificHour = getPacificHour(now);
  if (!forceRun && !isLeagueReportSnapshotWindow(now)) {
    res.status(202).json({
      ok: true,
      skipped: true,
      reason: `Snapshot only runs at ${LEAGUE_REPORT_SNAPSHOT_HOURS.join(':00 or ')}:00 ${PACIFIC_TIME_ZONE}`,
      pacificHour,
      snapshotDateKey: getSnapshotDateKey(now),
    });
    return;
  }

  try {
    await storeKtcSnapshot();
    res.status(200).json({
      ok: true,
      forced: forceRun,
      snapshotDateKey: getSnapshotDateKey(new Date()),
    });
  } catch (error) {
    console.error('[Cron] KTC snapshot failed', error);
    res.status(500).json({ ok: false, error: 'KTC snapshot failed' });
  }
});

app.get('/api/cron/league-report-cache', async (req, res) => {
  const auth = isCronAuthorized(req);
  const forceRun = req.query.force === 'true';
  const warmRankingsOnReportHit =
    req.query.rankings === 'true' ||
    isTruthyFlag(process.env.LEAGUE_REPORT_WARM_RANKINGS_ON_HIT);
  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }

  const now = new Date();
  const pacificHour = getPacificHour(now);
  if (!forceRun && !isLeagueReportSnapshotWindow(now)) {
    res.status(202).json({
      ok: true,
      skipped: true,
      reason: `Cache warming only runs after ${LEAGUE_REPORT_SNAPSHOT_HOURS.join(':00 or ')}:00 ${PACIFIC_TIME_ZONE} snapshots`,
      pacificHour,
    });
    return;
  }

  const requestedLeagueIds = [
    ...parseLeagueIds(process.env.LEAGUE_REPORT_WARM_LEAGUE_IDS),
    ...parseLeagueIds(typeof req.query.leagueId === 'string' ? req.query.leagueId : undefined),
  ];
  const leagueIds = Array.from(new Set(requestedLeagueIds));

  if (leagueIds.length === 0) {
    res.status(202).json({
      ok: true,
      skipped: true,
      reason: 'Set LEAGUE_REPORT_WARM_LEAGUE_IDS to warm shared report caches.',
    });
    return;
  }

  const caller = appRouter.createCaller({
    req: {
      headers: {
        authorization: auth.configuredSecret ? `Bearer ${auth.configuredSecret}` : undefined,
        'user-agent': 'league-report-cache-warmer',
        'x-cache-warmer': 'true',
      },
      socket: { remoteAddress: '127.0.0.1' },
    } as any,
    res: {} as any,
    user: null,
  });
  const startedAt = Date.now();
  const results = [];

  for (const leagueId of leagueIds) {
    const leagueStartedAt = Date.now();
    try {
      const reportCache = forceRun
        ? null
        : await caller.league.reportCacheStatus({ leagueId });
      const reportCacheHit = reportCache?.report.status === 'hit';

      if (!reportCacheHit) {
        await caller.league.analyze({ leagueId, forceRefresh: forceRun });
      }
      if (forceRun || !reportCacheHit || warmRankingsOnReportHit) {
        await caller.league.rankings({ leagueId, forceRefresh: forceRun });
      }
      results.push({
        leagueId,
        ok: true,
        reportCacheStatus: reportCacheHit ? 'hit' : 'warmed',
        forceRefresh: forceRun,
        durationMs: Date.now() - leagueStartedAt,
      });
    } catch (error) {
      console.error(`[Cron] League report cache warm failed for ${leagueId}`, error);
      results.push({
        leagueId,
        ok: false,
        durationMs: Date.now() - leagueStartedAt,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const failed = results.filter((result) => !result.ok);
  res.status(failed.length ? 207 : 200).json({
    ok: failed.length === 0,
    leagueCount: leagueIds.length,
    durationMs: Date.now() - startedAt,
    results,
  });
});

app.get('/api/cron/prospect-snapshot', async (req, res) => {
  const auth = isCronAuthorized(req);
  const forceRun = req.query.force === 'true';

  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }

  const now = new Date();
  if (!forceRun && !shouldRunMonthlyProspectSnapshot(now)) {
    res.status(202).json({
      ok: true,
      skipped: true,
      reason: 'Prospect snapshot only runs on the first day of each month at 07:00 America/Vancouver',
      snapshotMonth: getProspectSnapshotMonth(now),
    });
    return;
  }

  try {
    const snapshot = await storeNflDraftBuzzProspectSnapshot();
    res.status(200).json({
      ok: true,
      forced: forceRun,
      snapshotMonth: snapshot.scrapeMonth,
      playerCount: snapshot.players.length,
      errors: snapshot.errors,
    });
  } catch (error) {
    console.error('[Cron] Prospect snapshot failed', error);
    res.status(500).json({ ok: false, error: 'Prospect snapshot failed' });
  }
});

app.get('/api/cron/dynamic-data-refresh', async (req, res) => {
  const auth = isCronAuthorized(req);
  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }

  const backfillLimit = typeof req.query.backfillLimit === 'string'
    ? Number(req.query.backfillLimit)
    : 100;

  try {
    const result = await runDynamicDataRefresh({
      backfillLimit: Number.isFinite(backfillLimit) && backfillLimit > 0 ? backfillLimit : 100,
    });
    res.status(result.ok ? 200 : 207).json(result);
  } catch (error) {
    console.error('[Cron] Dynamic data refresh failed', error);
    res.status(500).json({ ok: false, error: 'Dynamic data refresh failed' });
  }
});

app.get('/api/cron/player-news-refresh', async (req, res) => {
  const auth = isCronAuthorized(req);
  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }

  try {
    const result = await refreshPlayerNewsSnapshots();
    res.status(200).json(result);
  } catch (error) {
    console.error('[Cron] Player news refresh failed', error);
    res.status(500).json({ ok: false, error: 'Player news refresh failed' });
  }
});

app.get('/api/cron/fantasypros-endpoint-snapshots', async (req, res) => {
  const auth = isCronAuthorized(req);
  const forceRun = req.query.force === 'true';

  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return;
  }

  const now = new Date();
  const scheduleParts = getPacificScheduleParts(now);
  if (!forceRun && !isFantasyProsEndpointSnapshotWindow(now)) {
    res.status(202).json({
      ok: true,
      skipped: true,
      reason: `FantasyPros endpoint snapshots only run ${getFantasyProsEndpointSnapshotScheduleLabel()}`,
      pacificDateKey: scheduleParts.dateKey,
      pacificWeekday: scheduleParts.weekday,
      pacificHour: scheduleParts.hour,
      pacificMinute: scheduleParts.minute,
    });
    return;
  }

  try {
    const result = await refreshFantasyProsEndpointSnapshotRefresh({ force: forceRun });
    const skipped = result.skipped;
    res.status(skipped ? 202 : 200).json({
      ok: true,
      forced: forceRun,
      skipped,
      reason: result.reason,
      season: result.season,
      currentWeek: result.currentWeek,
      weekWindow: result.weekWindow,
      endpointCount: result.results.length,
      persistedCount: result.results.filter((row) => row.persisted).length,
      errorCount: result.results.filter((row) => row.status === 'error' || row.status === 'rate_limited').length,
      results: result.results.map((row) => ({
        key: row.endpointKey,
        sourceKey: row.sourceKey,
        status: row.status,
        rowCount: row.rowCount,
        totalExperts: row.totalExperts,
        lastUpdated: row.lastUpdated,
        persisted: row.persisted,
        error: row.error,
      })),
    });
  } catch (error) {
    console.error('[Cron] FantasyPros endpoint snapshots failed', error);
    res.status(500).json({ ok: false, error: 'FantasyPros endpoint snapshots failed' });
  }
});

app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.use(apiNotFoundHandler);
app.use(apiErrorHandler);

export default app;
