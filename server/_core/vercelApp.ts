import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { registerOAuthRoutes } from './oauth';
import { appRouter } from '../routers';
import { createContext } from './context';
import { storeKtcSnapshot } from '../ktcSnapshotJob';
import { getSnapshotDateKey } from '../ktcLoader';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

registerOAuthRoutes(app);

app.get('/api/cron/ktc-snapshot', async (req, res) => {
  const configuredSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const forceRun = req.query.force === 'true';

  if (!configuredSecret && process.env.NODE_ENV === 'production') {
    res.status(500).json({ ok: false, error: 'CRON_SECRET is not configured' });
    return;
  }

  if (configuredSecret && authHeader !== `Bearer ${configuredSecret}`) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
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

app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
