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

## Production Secret Store Check
- 2026-06-01 `npx --yes vercel@latest env ls production` confirmed these required production env names are present and encrypted:
  - `CRON_SECRET`
  - `JWT_SECRET`
  - `ADMIN_LOGIN_PASSWORD`
  - `ADMIN_PERMISSIONS`
  - `FANTASYPROS_API_KEY`
  - `ENABLE_SLEEPER_PROJECTIONS`
  - `ENABLE_PROJECTION_FEATURES`
  - `ENABLE_WEEKLY_PROJECTIONS`
- The same masked env-name check did not show `SOURCE_HEALTH_ALERT_WEBHOOK_URL` or `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL` in production, so source-health alert delivery is still not configured.
- No secret values were printed or copied during the check.

## Rollback And Leak Response References
- Deployment rollback path is already captured in [baseline-map.md](baseline-map.md): use Vercel deployment rollback for production deploy issues, or git revert the specific stage commit when the rollback should be preserved in source history.
- Provider-key incident handling is already captured in [provider-key-leak-response.md](provider-key-leak-response.md): disable the affected feature flag, remove the provider key from all env stores, redeploy a previous stable or no-provider build, search repo/logs by env var/header names instead of secret values, and verify the key is absent from client bundles, sourcemaps, browser logs, server logs, screenshots, and exported reports.
- `SOURCE_HEALTH_ALERT_WEBHOOK_URL` is treated as a write-capable secret in the leak-response plan and should follow the same disable/remove/redeploy/search verification path if exposed.

## Verification
- `pnpm exec vitest run server/auth.logout.test.ts` passed.
- `pnpm exec vitest run server/leagueReportCachePolicy.test.ts server/localDiagnostics.test.ts` passed.
- `pnpm exec vitest run server/auth.logout.test.ts server/leagueReportCachePolicy.test.ts server/localDiagnostics.test.ts` passed after the public missing-cookie log cleanup.
- `pnpm run check` passed.
- `pnpm test` passed: `123` files, `612` passed, `1` skipped.
- `PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome` passed after updating the smoke selectors to the current home page.
- `env -u NO_COLOR PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=mobile-chrome --project=tablet-chrome` passed: `8` tests across the four representative leagues.
- Final post-smoke Vercel log checks found no `/var/task`, league-report file-cache, missing-cookie, or `500` entries in the checked post-traffic window.
- Checked production deployment `dpl_AFqMDXkufYkeg2yXuUyUQVx4hMdP` for `https://dynasty-degenerate-fggoi6z1c-billex87s-projects.vercel.app` was `Ready` and aliased to `https://dynastydegens.com`.
- Post-`18:40` Pacific cron-window checks found no `/var/task`, league-report file-cache, missing-cookie, `500`, or error-level entries in the checked window, but cron execution itself was inconclusive because production redeployed commit `35f3377` as `dpl_JAzH9xMCBNR6c9VdN1cn8TsiTFdL` at `18:40:37` Pacific, overlapping the configured `dynamic-data-refresh` cron minute.

## Production Follow-up (manual)
- Configure `SOURCE_HEALTH_ALERT_WEBHOOK_URL` and, if desired, `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL` in the production secret store.
- Validate webhook target receives a warning/danger alert path test when forced (or at minimum a config validation dry run).
- Confirm cron invocations in logs return expected cheap `202` responses outside configured Pacific windows.
- Confirm no provider key or webhook URL appears in user-facing logs/outputs.
- After the next scheduled cron window that is not overlapped by deployment churn, confirm production cron logs still do not contain `/var/task/server/ktc-snapshots`, `/var/task/.cache/api-provider-telemetry`, or `/var/task/.cache` write failures.

## Decision
- The critical auth and cron production env names are present in Vercel and the deployed code fails closed if they are missing.
- The operations/security gate remains open because source-health alert delivery still needs a real production webhook target, a clean non-overlapped cron window still needs to be checked, and dashboard-level usage/CPU evidence is still unavailable from the current CLI plan.
