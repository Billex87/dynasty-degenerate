# Todo Execution Notes - 2026-05-15 Evening

Scope: process `todo.md` top to bottom after the player-enrichment cache work. Premium UI and Three.js polish are intentionally out of scope per request.

When this pass is done, ask Billy whether he wants the full summary. If he says yes, summarize from this file plus the commits pushed during the pass, including value-blend changes, provider/snapshot changes, new backend features, validation, blocked items, and deferred premium UI/Three.js work.

## Completed During This Pass

| Area | Result | Files |
| --- | --- | --- |
| Report payload slimming regression coverage | Confirmed recursive transfer slimming covers the named hotspot sections: `managerRosterIntelligence`, `managerPositionCounts`, `draftPicks`, and trade-table-like nested player rows. Added a regression test so repeated embedded `playerDetails` in those sections stay compact when `playerDetailsById` is the canonical full detail source. | `server/reportPayloadSlimming.test.ts` |
| Projection/SOS source policy | Documented the approved schedule/projection boundary: Sleeper current-state can be live on user load; NFL bye weeks are static; DraftSharks SOS must be stored snapshot data from approved partner access; FantasyPros projections remain blocked for paid/public use until terms and rate limits are approved. | `docs/projections-sos-source-policy.md`, `todo.md` |
| Schedule-aware matchup previews | `buildMatchupPreviews` now accepts stored player schedule profiles and applies a bounded bye/SOS adjustment to projection-style matchup estimates, win probability, position-edge notes, and how-to-win copy. `league.analyze` passes cached player schedule profiles into matchup preview generation. | `server/schedulePlanning.ts`, `server/routers.ts`, `server/schedulePlanning.test.ts` |
| External source probe refresh | Ran `pnpm run probe:external-sources` and recorded metadata-only results for Yahoo, Sleeper, OpticOdds, SportsGameOdds, ParlayAPI, Underdog, bet365, FFPC, and Fantrax. No payloads or secrets were printed. | `docs/external-source-probe.md`, `todo.md` |
| Props compliance boundaries | Added responsible-gaming and product-language boundaries for public props UI. Internal intelligence can use generic market-signal language while avoiding direct betting recommendations. | `docs/props-compliance-boundaries.md`, `todo.md` |

## Deferred By Request

- Premium Owner Intel / AI Tron readout polish.
- Three.js loading/report-generated modal rebuild.
- `SuccessTakeover` Three.js/mobile fallback work.
- Three.js report shell, player moments, intelligence reveals, and source-health cockpit concepts.

## Blocked / Needs External Action

| Item | Why Blocked | Next Action |
| --- | --- | --- |
| Production `SOURCE_HEALTH_ALERT_WEBHOOK_URL` configuration | Runtime support already exists in `server/sourceHealth.ts`, `.env.example`, and docs, but the actual production webhook secret must be set in the deployment secret store. | Add the Slack/email/webhook URL in production env and choose `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL`. |
| Projection-driven lineup strength/value changes | The current safe schedule layer is bye/SOS-aware, but first-class weekly projection valuation should wait for approved projection snapshots with source/version metadata. | Keep FantasyPros projections blocked until commercial terms/rate limits are approved, then add snapshot-backed projection fields and validation. |
| Real props rollout | OpticOdds, SportsGameOdds, and ParlayAPI all need API keys before real props rows can be stored. | After key approval, configure server/prod env, run dynamic-data refresh, and audit row count, payload size, sportsbook coverage, and market coverage. |
