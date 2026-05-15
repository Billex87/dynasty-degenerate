# Load-Time Provider Boundary

Normal user-triggered loads should make live calls only to Sleeper current-state endpoints. That includes league metadata, users, rosters, players, transactions, drafts, traded picks, matchups, trending players, and Sleeper research/usage endpoints.

All non-Sleeper value, rankings, news, depth chart, schedule, and player-prop providers must be read from stored snapshots during report generation, ranking board loads, and player detail lookups. Live provider refreshes belong in scheduled jobs, admin refreshes, or explicit maintenance scripts.

Current guardrails:

- `server/loadTimeProviderPolicy.ts` defines the allowed live hosts and the shared `{ sourceMode: "snapshot" }` option for user-load non-Sleeper reads.
- `server/userLoadProviderBoundary.test.ts` checks the report/ranking/player-detail route source code for the expected snapshot calls and Sleeper-only live URL hosts.
- `server/loadTimeProviderPolicy.test.ts` verifies the runtime policy blocks non-Sleeper live URLs before `fetch` is called.
