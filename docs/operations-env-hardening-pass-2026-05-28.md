# Operations Security / Env Hardening Pass - 2026-05-28

## Scope
- Confirm production-ready environment hardening items from the readiness gate:
  - `CRON_SECRET`
  - `SOURCE_HEALTH_ALERT_WEBHOOK_URL`
  - `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL`
- No behavior changes.

## Checks
- `CRON_SECRET` required by cron handlers in production (`server/_core/vercelApp.ts`).
- `sourceHealth` alert path reads `SOURCE_HEALTH_ALERT_WEBHOOK_URL` and optional min-level filter.
- API routes remain private/no-store (`vercel.json`).

## Local/Repo Status
- `CRON_SECRET=` present in `.env.example`.
- `SOURCE_HEALTH_ALERT_WEBHOOK_URL=` present in `.env.example`.
- `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL=` present in `.env.example`.

## Production Follow-up (manual)
- Confirm all three values are set in deployment secret store (masked read in platform).
- Validate webhook target receives a warning/danger alert path test when forced (or at least a config validation dry run).
- Confirm cron invocations in logs return expected cheap `202` responses outside configured Pacific windows.
- Confirm no provider key or webhook URL appears in user-facing logs/outputs.

## Decision
- This pass is captured for execution once you have deploy-secret access.
