# Action Plan Next Milestone

These items should wait until the required external data/auth paths are available.

## Sleeper Write Flow

- Add an authenticated Sleeper write path for lineup swaps and waiver claims.
- Require a confirmation step before any real league mutation.
- Store request/response audit metadata with the saved action plan.
- Surface failed submissions with recoverable copy and retry actions.

## Weekly Projection Feed

- Map the final weekly projection payload into the report's player records.
- Include kickoff timestamps per player so lock countdowns are driven by real schedule data.
- Record projection source/version metadata in action-plan payloads.
- Add regression coverage once real projection fields are stable.

## Dynamic Data Operations

- Keep `/api/cron/dynamic-data-refresh` enabled in production with `CRON_SECRET`; it refreshes ranking sources, records source-health alerts, and backfills league AI confidence snapshots from cached reports.
- Configure `LEAGUE_REPORT_WARM_LEAGUE_IDS` for the leagues we want warmed automatically; that existing cron refreshes league reports, depth/news/matchup context, rankings, and confidence snapshots for those leagues.
- Set `SOURCE_HEALTH_ALERT_WEBHOOK_URL` when we want critical source-health alerts pushed outside the app. `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL` defaults to `warn`; use `danger` if we only want outage-level notifications.
- Use `ENABLE_SOURCE_HEALTH_BACKFILL=true` for one-off source-alert history backfills from cached reports. Leave it off for normal cron runs unless we intentionally want cached-report alert rows written again.
- Calibrate source-trust and league-confidence thresholds against real 2026 in-season outcomes once enough trades, waivers, injuries, lineup decisions, and standings movement exist.
- Set `NFL_SEASON_START_DATE` once the official season date is final, so calibration status switches from pending to collecting at the right time.
- Monitor fresh report generation latency after current depth-chart enrichment lands; if it adds noticeable delay, move depth chart fetches to a warmed cache or non-blocking enrichment path.

## Source Onboarding Queue

- Store the FantasyPros key only in server env as `FANTASYPROS_API_KEY`, keep it out of source control/client bundles/logs, and document the production deployment step. The app now loads `.env.local` for local development.
- Add the Fantasy Nerds API key as `FANTASY_NERDS_API_KEY` and run a redraft/dynasty source-health check once the live package is active.
- Confirm FantasyPros and Fantasy Nerds license/API terms before enabling them as primary production sources.
- Keep MyFantasyLeague and Fleaflicker as preferred no-key redraft integrations because they expose API-style data without brittle page scraping.
- Keep ESPN below official/API sources because the JSON route is useful but not formally documented as a public rankings API.
- Keep Yahoo and NFL Fantasy as opt-in scraping fallbacks only; production should not depend on them unless they stay stable through draft season.
- Do not use Fantrax rankings until a stable endpoint or explicit integration plan exists.
