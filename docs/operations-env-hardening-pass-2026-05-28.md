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
- Local diagnostic file writers now skip Vercel/serverless runtimes instead of trying to write under the deployed bundle path.
- Admin login fails closed when production is missing `JWT_SECRET` or when `ADMIN_LOGIN_PASSWORD` is not configured.

## Local/Repo Status
- `CRON_SECRET=` present in `.env.example`.
- `SOURCE_HEALTH_ALERT_WEBHOOK_URL=` present in `.env.example`.
- `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL=` present in `.env.example`.
- `server/auth.logout.test.ts` covers secure logout cookie clearing, valid admin login cookie options, invalid passphrase rejection, production `JWT_SECRET` precondition, and required admin-password configuration.

## Verification
- `pnpm exec vitest run server/auth.logout.test.ts` passed.
- `pnpm run check` passed.
- `pnpm test` passed: `123` files, `612` passed, `1` skipped.

## Production Follow-up (manual)
- Confirm all three values are set in deployment secret store (masked read in platform). In local `.vercel/.env.production.local`, `CRON_SECRET` is intentionally blank and both `SOURCE_HEALTH_ALERT_WEBHOOK_URL` and `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL` are absent, so platform-level verification is still required.
- Validate webhook target receives a warning/danger alert path test when forced (or at minimum a config validation dry run).
- Confirm cron invocations in logs return expected cheap `202` responses outside configured Pacific windows.
- Confirm no provider key or webhook URL appears in user-facing logs/outputs.
- After deploying the local diagnostic write guard, confirm production cron/error logs no longer contain `/var/task/server/ktc-snapshots` or `/var/task/.cache/api-provider-telemetry` write failures.

## Decision
- This pass is captured for execution once you have deploy-secret access.
