# Operations Readiness Pass - 2026-05-27

## Scope
- Non-refactor backend and operations pass.
- No `Home.tsx`, global CSS, `ReportTables.tsx`, or active `reportTables/*` frontend refactor files edited.

## Completed
- Added a unified read-only readiness script:

```bash
pnpm audit:operations-readiness
```

Output includes:

- source freshness totals and actionable sources
- source coverage totals and stale/blocked/research actionables
- source-health event recency + severity summary
- provider-telemetry network/hit/failure/429 breakdown + top providers/endpoints

- Ran data freshness audit: `pnpm audit:source-freshness`
  - Summary: 72 total, 24 loaded, 42 stale, 6 missing, 0 error.
  - Notable stale families: devy snapshots and weekly FantasyPros ECR rows.
- Ran cache audit: `pnpm audit:league-report-cache`
  - Summary: 300 rows, 71 fresh, 229 stale.
  - Freshness windows show report traffic is healthy (`~91%` analyze hit rate in the latest 24h) and fresh rows include shared report caches.
- Audited cron/prod env assumptions in code:
  - Cron routes in `server/_core/vercelApp.ts` require `CRON_SECRET` in production.
  - `adminLogin` endpoint requires `JWT_SECRET` and `ADMIN_LOGIN_PASSWORD` in production.
- Confirmed source-health alerting path exists:
  - `server/sourceHealth.ts` sends webhook alerts when `SOURCE_HEALTH_ALERT_WEBHOOK_URL` is configured.
- Confirmed no frontend refactor files were touched in this pass.

## Partial/Follow-up
- Vercel usage review is still pending: capture dashboard metrics after a live traffic window and cron cycle.
- Production `SOURCE_HEALTH_ALERT_WEBHOOK_URL` still needs to be set in deployment secrets.
- `CRON_SECRET` was added to `.env.example` for discoverability but production secret provisioning still required.
- Remaining source-missing/stale handling is documented as accepted limitations until provider cadence/terms are improved.

## Deliverables Updated
- `todo.md`: added explicit pass outputs and pending follow-up bullets.
- `.env.example`: added `CRON_SECRET=` placeholder.
