# Vercel Production Usage / Ops Review - 2026-06-04

## Scope

- Read-only production/Vercel verification.
- No code changes, deploys, or env mutations.
- Target domain: `https://dynastydegens.com`.

## Production Alias

Command:

```bash
npx --yes vercel@latest inspect dynastydegens.com --no-color
```

Result:

- Deployment ID: `dpl_EdXeMV2VnWWmDPSDjqysa3mmNcKC`
- Target: production
- Status: Ready
- Created: Tue Jun 02 2026 19:24:33 GMT-0700
- Production URL: `https://dynasty-degenerate-3ojyptddv-billex87s-projects.vercel.app`
- Aliases include:
  - `https://dynastydegens.com`
  - `https://dynasty-degenerate.vercel.app`
  - `https://dynasty-degenerate-billex87s-projects.vercel.app`
  - `https://dynasty-degenerate-git-main-billex87s-projects.vercel.app`

Live domain check:

```bash
curl -I https://dynastydegens.com --max-time 20
```

Result:

- `HTTP/2 200`
- `server: Vercel`
- `x-vercel-cache: HIT`
- `last-modified: Wed, 03 Jun 2026 05:17:27 GMT`

## Production Env Name Check

Command:

```bash
npx --yes vercel@latest env ls production --no-color
```

Confirmed encrypted production env names:

- `ENABLE_SLEEPER_PROJECTIONS`
- `ENABLE_PROJECTION_FEATURES`
- `ENABLE_WEEKLY_PROJECTIONS`
- `ADMIN_LOGIN_PASSWORD`
- `ADMIN_PERMISSIONS`
- `FANTASYPROS_API_KEY`
- `CRON_SECRET`
- `JWT_SECRET`
- `DATABASE_URL`
- Neon/Postgres companion variables such as `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `PGUSER`, `PGPASSWORD`, and related host/database names

Not listed in production and still needed before enabling the corresponding flows:

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

No secret values were printed.

## Cron Listing

Command:

```bash
npx --yes vercel@latest crons list --no-color
```

Production cron entries returned:

- `/api/cron/dynamic-data-refresh` at `40 1 * * *`
- `/api/cron/fantasypros-endpoint-snapshots` at `0 19 * * 2`
- `/api/cron/fantasypros-endpoint-snapshots` at `0 20 * * 2`
- `/api/cron/ktc-snapshot` at `0 15 * * *`
- `/api/cron/ktc-snapshot` at `0 16 * * *`
- `/api/cron/ktc-snapshot` at `0 23 * * *`
- `/api/cron/ktc-snapshot` at `0 0 * * *`
- `/api/cron/league-report-cache` at `20 15 * * *`
- `/api/cron/league-report-cache` at `20 16 * * *`
- `/api/cron/player-news-refresh` at `10 16 * * *`
- `/api/cron/prospect-snapshot` at `0 14 1 * *`
- `/api/cron/prospect-snapshot` at `0 15 1 * *`

The CLI still reports the known `6 local changes pending deploy` schedule comparison warning. This appears to be a Vercel CLI local/deployed schedule-diff interpretation and still needs dashboard confirmation before closing.

## CLI Gaps

The following bounded commands produced no output before the 25-second guard stopped them:

```bash
perl -e 'alarm shift; exec @ARGV' 25 npx --yes vercel@latest usage --format json --no-color
perl -e 'alarm shift; exec @ARGV' 25 npx --yes vercel@latest logs dynastydegens.com --since 30m --no-color
```

Because of that, this pass does not prove:

- Fluid Active CPU usage
- Function invocation totals
- Transfer totals
- Provisioned memory usage
- Top route/function CPU attribution
- Recent production log health
- Explicit scheduled cron execution rows

These remain dashboard/manual verification items.

## Local Integrated Readiness Snapshot

Command:

```bash
pnpm audit:operations-readiness
```

Result:

- Operations security: `pass=11`, `warn=1`, `blocker=0`.
- Remaining security warning: `SOURCE_HEALTH_ALERT_WEBHOOK_URL` is not configured.
- Source freshness: `72` sources, `20` loaded, `46` stale, `6` missing, `0` error.
- Source coverage: `31` sources, `15` loaded, `6` stale, `6` missing, `1` blocked, `3` research.
- Source-health events in the 14-day window: `40`; `0` danger, `16` warn, `24` info.
- Provider telemetry cache: `11,083` calls, `11,082` network, `672` failures, `0` 429s.

## Decision

Production is currently serving `200` from a Ready Vercel deployment, critical current auth/cron/database env names are present, and the expected cron definitions are listed. The operations/security and Vercel usage gates remain open because source-health alert delivery is not configured, paid/email/Stripe envs are absent, the cron schedule diff warning still needs dashboard review, and dashboard-only CPU/log evidence is still unavailable from CLI.
