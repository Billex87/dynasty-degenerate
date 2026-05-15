# Load-Time Provider Boundary

Normal user-triggered loads should make live calls only to Sleeper current-state endpoints. That includes league metadata, users, rosters, players, transactions, drafts, traded picks, matchups, trending players, and Sleeper research/usage endpoints.

All non-Sleeper value, rankings, news, depth chart, schedule, and player-prop providers must be read from stored snapshots during report generation, ranking board loads, and player detail lookups. Live provider refreshes belong in scheduled jobs, admin refreshes, or explicit maintenance scripts.

Current guardrails:

- `server/loadTimeProviderPolicy.ts` defines the allowed live hosts and the shared `{ sourceMode: "snapshot" }` option for user-load non-Sleeper reads.
- `server/userLoadProviderBoundary.test.ts` checks the report/ranking/player-detail route source code for the expected snapshot calls and Sleeper-only live URL hosts.
- `server/loadTimeProviderPolicy.test.ts` verifies the runtime policy blocks non-Sleeper live URLs before `fetch` is called.
- `server/sourceSnapshotFreshness.ts` builds metadata-only freshness diagnostics from snapshot tables and source-health rows, then attaches the rows to report admin diagnostics without copying full provider payloads.
- `scripts/audit-report-payload.mjs` measures local cached report/ranking payload size by section without printing payload values, secrets, or raw row data.
- `server/reportPayloadSlimming.ts` compacts duplicate embedded `playerDetails` in report transfer/cache payloads when the same player is already present in `playerDetailsById`, keeping a small display-safe shell for inline cards.
- Ranking transfer payloads keep `rankings.profiles` as the canonical board data and drop duplicate legacy arrays (`dynastySf`, `redraftPpr`, etc.) from cache/response copies. Repeated devy row `prospectProfile` objects are compacted, and the UI hydrates full prospect modal detail from the single `draftBuzzScoreboard` copy.
