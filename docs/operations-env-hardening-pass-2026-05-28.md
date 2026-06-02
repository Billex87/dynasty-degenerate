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
- League-report local file-cache reads/writes/pruning now skip Vercel/serverless runtimes; memory and durable database cache still remain active.
- Admin login fails closed when production is missing `JWT_SECRET` or when `ADMIN_LOGIN_PASSWORD` is not configured.
- Missing cookies on public requests are treated as anonymous without warning; malformed/invalid session cookies still warn.

## Local/Repo Status
- `CRON_SECRET=` present in `.env.example`.
- `SOURCE_HEALTH_ALERT_WEBHOOK_URL=` present in `.env.example`.
- `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL=` present in `.env.example`.
- `server/auth.logout.test.ts` covers secure logout cookie clearing, valid admin login cookie options, invalid passphrase rejection, production `JWT_SECRET` precondition, and required admin-password configuration.
- `server/auth.logout.test.ts` also covers anonymous public request context creation without logging a missing-cookie warning.
- `server/leagueReportCachePolicy.test.ts` covers the Vercel/serverless file-cache skip policy.

## Verification
- `pnpm exec vitest run server/auth.logout.test.ts` passed.
- `pnpm exec vitest run server/leagueReportCachePolicy.test.ts server/localDiagnostics.test.ts` passed.
- `pnpm exec vitest run server/auth.logout.test.ts server/leagueReportCachePolicy.test.ts server/localDiagnostics.test.ts` passed after the public missing-cookie log cleanup.
- `pnpm run check` passed.
- `pnpm test` passed: `123` files, `612` passed, `1` skipped.
- `PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome` passed after updating the smoke selectors to the current home page.
- Final post-smoke Vercel log checks found no `/var/task`, league-report file-cache, missing-cookie, or `500` entries in the checked post-traffic window.

## Production Follow-up (manual)
- Confirm all three values are set in deployment secret store (masked read in platform). In local `.vercel/.env.production.local`, `CRON_SECRET` is intentionally blank and both `SOURCE_HEALTH_ALERT_WEBHOOK_URL` and `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL` are absent, so platform-level verification is still required.
- Validate webhook target receives a warning/danger alert path test when forced (or at minimum a config validation dry run).
- Confirm cron invocations in logs return expected cheap `202` responses outside configured Pacific windows.
- Confirm no provider key or webhook URL appears in user-facing logs/outputs.
- After the next scheduled cron window, confirm production cron logs still do not contain `/var/task/server/ktc-snapshots`, `/var/task/.cache/api-provider-telemetry`, or `/var/task/.cache` write failures.

## Decision
- This pass is captured for execution once you have deploy-secret access.
