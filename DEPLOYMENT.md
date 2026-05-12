# Deployment Instructions for Dynasty Degenerates

This project is a full-stack application with a React frontend and a Node.js/Express backend. It requires a live server and a MySQL-compatible database.

## Recommended Hosting: Vercel

The app is configured for **Vercel** with a Vite static frontend, serverless API routes, and Vercel Cron for scheduled KTC snapshots. It still needs a hosted database for persisted snapshots and admin/session-backed data.

Current Vercel project:
- Team: `billex87s-projects` (`team_2NIpp2BxO2anhpz3yncCXsDg`)
- Project: `dynasty-degenerate` (`prj_TOKe0q3kAZugtZawFqh34JrqRvFS`)

### Environment Variables

You must configure the following environment variables in your deployment platform:

#### Backend (Node.js)
- `DATABASE_URL`: Your MySQL connection string (e.g., `mysql://user:pass@host:port/db`).
- `JWT_SECRET`: A secure random string for session signing.
- `ADMIN_LOGIN_PASSWORD`: A strong server-only passphrase for the first-party admin telemetry login.
- `ADMIN_PERMISSIONS`: Optional comma-, space-, or newline-separated server-only allowlist for report/admin operators. Accepts Sleeper usernames/display names/user IDs for report-only tools and persisted app auth identifiers for telemetry. This value must stay server-side; the client only receives boolean permission flags from API responses.
- `FANTASYPROS_API_KEY`: FantasyPros API key for rankings, points, and injury data.
- `CRON_SECRET`: A random secret used by Vercel Cron when calling `/api/cron/ktc-snapshot`.
- `LEAGUE_REPORT_WARM_LEAGUE_IDS`: Optional comma- or space-separated Sleeper league IDs to prebuild into the shared server cache after value snapshots.
- `REQUIRE_AUTH_FOR_REPORTS`: Optional internal-only kill switch. Leave unset for the public site so visitors can run reports without signing in. Set to `true` only for a private/staging deployment where every report viewer should have an authenticated app session.

### Build Commands
- **Install**: `pnpm install`
- **Build**: `pnpm build`
- **Start**: `pnpm start`

### Production Verification

After each production deploy, run the live smoke checks against the deployed domain:

```bash
PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm test:e2e:production
```

For a fuller responsive pass across desktop, tablet, and mobile projects:

```bash
PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm test:e2e:production:responsive
```

These tests load the real Sleeper-backed dynasty and redraft example leagues and verify that redraft views do not regress into dynasty-first copy.

### Database Setup
Run the following command to push the schema to your database:
```bash
pnpm db:push
```

## Admin Auth Configuration
Admin traffic telemetry uses a first-party passphrase flow at `/api/trpc/auth.adminLogin`; it does not depend on any external redirect URL allowlist.

Set `ADMIN_LOGIN_PASSWORD` to a strong random value and keep `JWT_SECRET` stable across deploys so existing admin sessions remain valid. The login creates a signed browser-session `app_session_id` cookie and persists a local admin user with role `admin` when the database is available.

## Vercel Cron
`vercel.json` calls `/api/cron/ktc-snapshot` at paired UTC times for `06:00` and `18:00` in `America/Vancouver`. The endpoint checks Pacific time before doing work, so the extra UTC entries are daylight-saving fallbacks.

`/api/cron/league-report-cache` runs 20 minutes after the snapshot windows. Set `LEAGUE_REPORT_WARM_LEAGUE_IDS` to warm shared report and rankings caches for important leagues before users load the site.

## Abuse Protection

The app has in-process throttles on public tRPC procedures, no-store/noindex headers for API responses, and server-only storage for KTC seed value JSON. Keep `REQUIRE_AUTH_FOR_REPORTS` unset on the public production app; use rate limits, cache warmers, and targeted Vercel Firewall rules for abuse control instead of forcing visitors to sign in. Keep `CRON_SECRET` configured in production so cache warmers bypass public throttles without exposing force refresh to visitors.

Admin traffic telemetry is exposed only through the admin tRPC guard, which allows the first-party admin session plus persisted users or identifiers matching server env `ADMIN_PERMISSIONS`. Keep that allowlist limited to trusted operators and prefer the first-party admin login for permanent access.

For edge protection, enable Vercel Firewall managed rules for bot protection in `log` mode first, then move abusive `/api/trpc/league.analyze` and `/api/trpc/league.rankings` traffic to `challenge` or `deny` once logs confirm the pattern. Do not challenge the whole site by default; keep the public landing page crawlable and apply strict rules to API/report paths.

Prepared firewall payloads live in `scripts/vercel-firewall/`. Apply them in log mode with an authenticated Vercel CLI session:

```bash
vercel link --yes --project dynasty-degenerate --scope billex87s-projects
vercel api "/v1/security/firewall/config?projectId=prj_TOKe0q3kAZugtZawFqh34JrqRvFS&teamId=team_2NIpp2BxO2anhpz3yncCXsDg" -X PATCH --input scripts/vercel-firewall/managed-bot-protection-log.json
vercel api "/v1/security/firewall/config?projectId=prj_TOKe0q3kAZugtZawFqh34JrqRvFS&teamId=team_2NIpp2BxO2anhpz3yncCXsDg" -X PATCH --input scripts/vercel-firewall/api-report-paths-log.json
```

Production env rollout:

```bash
vercel env ls production
printf '%s' "$CRON_SECRET" | vercel env add CRON_SECRET production preview development --sensitive
printf '%s' "$ADMIN_LOGIN_PASSWORD" | vercel env add ADMIN_LOGIN_PASSWORD production preview development --sensitive
printf '%s' "$ADMIN_PERMISSIONS" | vercel env add ADMIN_PERMISSIONS production preview development --sensitive
# Do not set REQUIRE_AUTH_FOR_REPORTS on the public production app.
```
