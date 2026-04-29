import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { registerOAuthRoutes } from '../server/_core/oauth';
import { appRouter } from '../server/routers';
import { createContext } from '../server/_core/context';
import { storeKtcSnapshot } from '../server/ktcSnapshotJob';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

registerOAuthRoutes(app);

function getPacificHour(date: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Vancouver',
    hour: '2-digit',
    hour12: false,
  }).format(date);
  return Number(hour);
}

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

  if (!forceRun && getPacificHour(new Date()) !== 18) {
    res.status(200).json({ ok: true, skipped: true, reason: 'Not 6 PM America/Vancouver' });
    return;
  }

  try {
    await storeKtcSnapshot();
    res.status(200).json({ ok: true });
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
