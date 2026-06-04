# Operations Security Readiness Pass - 2026-06-04

## Scope

- Backend/ops/security only.
- No UI, CSS, legal-page, or AI-readout rendering changes.
- Goal: make the production env/security posture repeatable before paid traffic or broader launch.

## Changes Landed

- Added `pnpm audit:ops-security`.
- Added a reusable server-side operations security readiness evaluator.
- Integrated operations security readiness into `pnpm audit:operations-readiness`.
- Hardened source-health alert delivery so production webhook URLs must be valid HTTPS URLs and cannot target localhost/private-network hosts.
- Added focused backend tests for env readiness and source-health webhook URL safety.

## Local Audit Result

Command:

```bash
pnpm audit:ops-security
```

Result on June 4, 2026:

- `pass=11`
- `warn=1`
- `blocker=0`

Expected local warning:

- `SOURCE_HEALTH_ALERT_WEBHOOK_URL` is not configured locally, so external source-health alert delivery is not active.

The command reports only env names and status messages. It does not print secret values.

## Verification

- `pnpm exec vitest run server/operationsSecurityReadiness.test.ts server/localDiagnostics.test.ts server/usageLimits.test.ts server/featureEntitlements.test.ts server/stripeWebhook.test.ts server/transactionalEmail.test.ts`
  - Passed: 6 files, 60 tests.
- `pnpm exec tsc -p tsconfig.node.json --noEmit`
  - Passed.
- `pnpm audit:ops-security`
  - Passed with expected local source-health webhook warning.
- `pnpm audit:secret-exposure`
  - Passed: no client/public secret env references or unsafe env logging found.
- `pnpm audit:operations-readiness`
  - Passed and included the new operations-security section.
  - Operations security: `pass=11`, `warn=1`, `blocker=0`.
  - Source freshness: `72` sources, `20` loaded, `46` stale, `6` missing, `0` error.
  - Source coverage: `31` sources, `15` loaded, `6` stale, `6` missing, `1` blocked, `3` research.
  - Source-health events: `40` in the 14-day window; `0` danger, `16` warn, `24` info.
  - Provider telemetry cache: `11,083` calls, `11,082` network, `672` failures, `0` 429s.
- `pnpm build`
  - Passed.

Known unrelated verification gap:

- Full `pnpm run check` currently fails in frontend report UI files outside this backend-only scope:
  - `client/src/features/report/components/ReportDashboardMetrics.tsx`
  - `client/src/features/report/components/ReportDashboardSpotlight.tsx`

## Production Follow-up

- 2026-06-04 production env-name check confirmed these current production names are present and encrypted:
  - `JWT_SECRET`
  - `DATABASE_URL`
  - `ADMIN_LOGIN_PASSWORD`
  - `CRON_SECRET`
  - `ADMIN_PERMISSIONS`
  - `FANTASYPROS_API_KEY`
  - `ENABLE_SLEEPER_PROJECTIONS`
  - `ENABLE_PROJECTION_FEATURES`
  - `ENABLE_WEEKLY_PROJECTIONS`
- These env names were not listed in production and are still required before enabling the corresponding flows:
  - `APP_BASE_URL`
  - `RESEND_API_KEY`
  - `TRANSACTIONAL_EMAIL_FROM`
  - `TRANSACTIONAL_EMAIL_REPLY_TO`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - Stripe product price env vars
  - `STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID`
  - `SOURCE_HEALTH_ALERT_WEBHOOK_URL`
  - `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL`
- Confirm Vercel production env names again after the next deployment/env change:
  - `JWT_SECRET`
  - `DATABASE_URL`
  - `ADMIN_LOGIN_PASSWORD`
  - `CRON_SECRET`
  - `RESEND_API_KEY`
  - `TRANSACTIONAL_EMAIL_FROM`
  - `APP_BASE_URL`
  - `STRIPE_WEBHOOK_SECRET`
  - Stripe price env vars before enabling `ENABLE_PAID_FEATURES=true`
- Configure `SOURCE_HEALTH_ALERT_WEBHOOK_URL` in production when external alert delivery is desired.
- Keep `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL=warn` by default, or set it to `danger` for outage-only alerting.
- 2026-06-04 production alias check: `dynastydegens.com` pointed at Ready deployment `dpl_EdXeMV2VnWWmDPSDjqysa3mmNcKC`; `curl -I https://dynastydegens.com --max-time 20` returned `HTTP/2 200` with `x-vercel-cache: HIT`.
- 2026-06-04 cron listing returned the expected 12 cron entries but still showed the known `6 local changes pending deploy` schedule comparison warning; dashboard confirmation is still needed.
- 2026-06-04 bounded `vercel usage` and `vercel logs` attempts produced no output before a 25-second guard stopped them, so CPU/log proof remains dashboard/manual.
- After deployment, run:

```bash
pnpm audit:ops-security
pnpm audit:secret-exposure
pnpm audit:operations-readiness
```

- Verify one source-health warning/danger path reaches the configured webhook without printing webhook URLs or provider secrets.
- Re-check Vercel cron logs and dashboard CPU/usage after one real traffic session plus one clean cron window.

## Decision

Backend ops/security readiness is now repeatable locally and integrated into the readiness workflow. The launch gate remains open until the production secret store is rechecked, the source-health webhook is configured or explicitly deferred, and dashboard-only Vercel usage/CPU evidence is captured.
