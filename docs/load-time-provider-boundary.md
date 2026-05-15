# Load-Time Provider Boundary

Normal user-triggered loads should make live calls only to Sleeper current-state endpoints. That includes league metadata, users, rosters, players, transactions, drafts, traded picks, matchups, trending players, and Sleeper research/usage endpoints.

All non-Sleeper value, rankings, news, depth chart, schedule, and player-prop providers must be read from stored snapshots during report generation, ranking board loads, and player detail lookups. Live provider refreshes belong in scheduled jobs, admin refreshes, or explicit maintenance scripts.

Current guardrails:

- `server/loadTimeProviderPolicy.ts` defines the allowed live hosts and the shared `{ sourceMode: "snapshot" }` option for user-load non-Sleeper reads.
- User-load network calls go through `fetchUserLoadResponse` / `fetchUserLoadJson`, which block non-Sleeper hosts before the network call and record sanitized `scope: "user-load"` provider telemetry. Numeric league/user/draft IDs are collapsed to `:id` in telemetry endpoints.
- `server/userLoadProviderBoundary.test.ts` checks the report/ranking/player-detail route source code for the expected snapshot calls and Sleeper-only live URL hosts.
- `server/loadTimeProviderPolicy.test.ts` verifies the runtime policy blocks non-Sleeper live URLs before `fetch` is called and that allowed Sleeper calls are tracked without raw IDs or payloads.
- `server/apiProviderTelemetry.ts` groups calls by provider, endpoint, and call scope so admin diagnostics can separate `user-load` network work from cron/admin refreshes.
- `server/sourceSnapshotFreshness.ts` builds metadata-only freshness diagnostics from snapshot tables and source-health rows, then attaches the rows to report admin diagnostics without copying full provider payloads.
- `scripts/audit-report-payload.mjs` measures local cached report/ranking payload size by section without printing payload values, secrets, or raw row data.
- `server/reportPayloadSlimming.ts` compacts duplicate embedded `playerDetails` in report transfer/cache payloads when the same player is already present in `playerDetailsById`, keeping a small display-safe shell for inline cards.
- Ranking transfer payloads keep `rankings.profiles` as the canonical board data and drop duplicate legacy arrays (`dynastySf`, `redraftPpr`, etc.) from cache/response copies. Repeated devy row `prospectProfile` objects are compacted, and the UI hydrates full prospect modal detail from the single `draftBuzzScoreboard` copy.
- Ranking UI loads now start with `league.rankingsMeta`, then fetch one selected profile through `league.rankingProfile` or the prospect archive through `league.rankingDraftBuzz`. This keeps full ranking rows and scouting summaries out of the initial rankings payload.
- `league.reportCacheStatus` checks report-cache freshness with metadata only: cache key, source, updated time, age, and payload byte size. It does not deserialize or return the cached report payload.
- Server report-cache serving TTL defaults to 12 hours and can be tuned with `LEAGUE_REPORT_CACHE_TTL_HOURS`. The local file cache is pruned by the same TTL plus `LEAGUE_REPORT_FILE_CACHE_MAX_FILES` so stale fallback blobs do not accumulate.

## Runtime Contract

- User login, league lookup, report generation, ranking preview, player detail, and hidden Sleeper import may call Sleeper live when they need current league state.
- FantasyPros, ESPN, DraftSharks, OpticOdds, KTC, FantasyCalc, DynastyProcess, Flock, Dynasty Nerds, Fantasy Nerds, and prospect sources must not be called live from normal user-load paths.
- Non-Sleeper refreshes belong in scheduled jobs, admin-only diagnostics, maintenance scripts, or explicit one-off probes.
- Stored snapshot reads can be used freely during report loads because they do not add live provider latency or API cost.
- Cache status checks should use metadata-only helpers/endpoints unless the caller needs to render the actual report.
