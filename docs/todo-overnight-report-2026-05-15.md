# Todo Overnight Report - 2026-05-15

Scope: processed `todo.md` top to bottom using `docs/todo-list-execution-prompt.md`. UI/visual/frontend polish was deferred for tomorrow. Non-UI actionable work was implemented when safe. Blocked items were logged with reason and next action.

Checklist status after this pass: `282` checked items and `156` unchecked items. The remaining unchecked items are primarily UI/Three.js, auth/billing/legal, schedule/SOS projection expansion, provider-access-dependent integrations, model/backtest work, deeper cache slimming, and future persistence features.

## Implemented Tonight

| Item | Result | Files |
| --- | --- | --- |
| Neon/Postgres transfer audit | Added an executable transfer audit script that reports table size, largest report-cache payloads, recent cache transfer drivers, snapshot payload sizes, and source-health event volume. Requires production `DATABASE_URL` to run. | `scripts/audit-neon-transfer.mjs`, `package.json` |
| League report cache compression | Added transparent gzip/base64 compression for large persistent and file-backed `leagueReportCache` payloads, plus a dry-run-capable one-off compaction command for existing heavy rows. Production top-20 compaction reduced those rows from `252 MB` to `35 MB`. | `server/db.ts`, `server/routers.ts`, `scripts/compact-league-report-cache.mjs`, `server/leagueReportCacheCompression.test.ts` |
| League report cache cleanup | Added a dry-run-first cleanup command for old `leagueReportCache` rows. It supports stale-version cleanup and expired-row cleanup, keeps deletion guarded by explicit confirmation flags, and prints only row metadata plus payload sizes. Production cleanup deleted `34` stale-version rows totaling `89 MB` and `9` expired rows totaling `26 MB`; follow-up dry runs found no remaining stale or expired rows. | `scripts/cleanup-league-report-cache.mjs`, `package.json`, `todo.md` |
| Report load cache hits | Aligned browser report-cache lifetime with the 12-hour server cache and stopped the report screen from calling `league.rankings` when the loaded report already includes rankings. | `client/src/pages/Home.tsx`, `todo.md` |
| Single-key leak response plan | Added provider key leak response plan covering disable, env removal, redeploy/rollback, repo/log audit, provider recovery, and verification commands. | `docs/provider-key-leak-response.md` |
| New-source probation rule | Documented probation rule for every new API/feed/scrape before trust weight can rise. | `docs/source-onboarding-and-coverage-audit.md` |
| Source audit template and matrix | Captured the current source coverage matrix, usage status, later feature potential, and open questions for Sleeper, FantasyPros, DraftSharks, KTC, Flock, FantasyCalc, Dynasty Nerds, Fantasy Nerds, DynastyProcess/nflverse, prospect sources, ESPN metadata, and internal jobs. | `docs/source-onboarding-and-coverage-audit.md` |
| Nickname/API research | Logged alias-field findings and recommended alias normalization over informal nickname storage. | `docs/source-onboarding-and-coverage-audit.md` |
| Research/product idea capture | Logged VORP use, Sleeper data limits, AI product patterns, Chrome extension outline, chatbot trace, and Dynasty Daddy feature ideas. | `docs/product-research-notes.md` |
| ComponentShowcase console log | Removed the leftover dialog submit `console.log`. | `client/src/pages/ComponentShowcase.tsx` |
| API provider telemetry foundation | Added backend provider-call telemetry for call volume, failures, 429s, cache hits, cache hit rate, endpoint cost units, and recent events. Wired FantasyPros network/cache telemetry and exposed an admin tRPC endpoint for a later dashboard. | `server/apiProviderTelemetry.ts`, `server/fantasyPros.ts`, `server/_core/systemRouter.ts`, `server/apiProviderTelemetry.test.ts` |
| API budget/rate-limit admin UI | Added an admin-only provider telemetry panel showing provider calls, network calls, cache hit rate, failures, 429s, cost units, slow/high-cost endpoints, and recent provider events. | `client/src/pages/Home.tsx` |
| Schedule ingestion foundation | Added 2026 NFL bye-week normalization from NFL.com, player schedule profiles, schedule-planning roster gaps, schedule-aware streamer candidates, Sleeper matchup ingestion, matchup preview generation, and schedule tests. | `server/schedulePlanning.ts`, `server/schedulePlanning.test.ts`, `server/routers.ts` |
| DraftSharks SOS shell | Added an approved-access-only DraftSharks SOS fetch/normalization shell behind `ENABLE_DRAFTSHARKS_SOS`, `DRAFTSHARKS_API_KEY`, and `DRAFTSHARKS_SOS_URL`. It enriches player schedule profiles and streamer candidates only when configured, with no public-page scraping. | `server/draftSharksSchedule.ts`, `server/draftSharksSchedule.test.ts`, `server/schedulePlanning.ts`, `.env.example` |

## Concise Implementation Notes

- Neon transfer audit: implemented as a CLI so we can run the audit directly against production `DATABASE_URL` without adding UI or moving large payloads.
- League report cache compression: keeps the API/client payload shape unchanged, but stores large cache entries compressed so repeated rankings/report cache reads transfer less text from Neon. The production top-20 compaction removed the 18 MB `league-rankings-v11` rows from the largest-row list.
- Provider key leak response: implemented as operational docs because the real action is secret disable/rotation and deploy rollback, not runtime code.
- Source probation rule: implemented as source-governance docs so new providers do not enter blends at full weight before health/drift history exists.
- Source coverage audit: implemented as a compact matrix so we can see what each source returns, what it powers now, and what it could power later.
- Nickname research: logged as identity-layer guidance; alias/cross-ID mapping is more useful than informal nickname storage right now.
- Product research: captured VORP, Sleeper data limits, AI product patterns, Chrome extension shape, chatbot status, and Dynasty Daddy ideas for later planning.
- ComponentShowcase cleanup: removed the visible dev console noise with no behavior change.
- API provider telemetry: implemented the backend foundation first; UI dashboard can consume `system.apiProviderTelemetry` later.
- API budget UI: implemented in the existing admin diagnostics shell so provider costs/failures are visible without distracting normal manager analysis.
- Schedule ingestion: implemented backend/data plumbing first; UI cards can now consume `schedulePlanning`, `matchupPreviews`, and player `schedule` profiles without inventing schedule data.
- DraftSharks SOS: implemented the safe integration shell only; real data still requires approved DraftSharks partner REST URL and key.

## Already Implemented Or Mostly Covered

| Todo Area | Status |
| --- | --- |
| `SOURCE_HEALTH_ALERT_WEBHOOK_URL` | Already present in `.env.example`, `docs/action-plan-next-milestone.md`, and `server/sourceHealth.ts`; production still needs the actual secret configured. |
| Source-health backfill | Already wired behind `ENABLE_SOURCE_HEALTH_BACKFILL=true` in `server/dynamicDataJobs.ts`; production one-off scan found no cached-report diagnostics eligible to backfill. |
| FantasyPros endpoint health checks | Already implemented in `server/fantasyProsHealth.ts` with endpoint rows and source-health events. |
| FantasyPros sub-source flags | Already implemented in `server/fantasyPros.ts` and `.env.example`. |
| Schedule/matchup typed payloads | `ReportData.matchupPreviews` and `schedulePlanning` are already typed and consumed by autopilot/command-center logic; live schedule ingestion remains unwired. |
| Schedule UI exposure | Player detail schedule rows/chips, command-center matchup context, and Autopilot schedule planning already consume the schedule payloads. Dedicated D/ST streamer UI and broader schedule badges remain future work. |
| AI chatbot | Existing `AIChatBox` is a showcase/demo component only; no production report chatbot behavior exists yet. |
| Watch/portfolio browser persistence | Current implementation uses local browser storage; server/account persistence remains future auth work. |

## Deferred UI / Visual Work

These were intentionally not implemented tonight per prompt:

- Owner Intel / AI Tron readout grid polish.
- Full Three.js loading/report-generated modal rebuild and `SuccessTakeover` revisit.
- Three.js report shell, player detail moments, intelligence module reveal treatments, and source-health cockpit.
- Visual QA for modal/canvas screenshots.
- All Overview table/readout copy and render-order cleanup.
- D/ST streamer UI and broader schedule badges.
- Watch alert UI controls beyond current local-storage feature.
- Portfolio view UI, exposure tables, blueprint export/share UI.
- Command Center polish and E2E coverage for UI-only features.
- ReportTables component splits because they are large frontend refactors and should be isolated tomorrow.
- Lower-priority UI audit items from the canonical prompt appendices.

## Blocked Items

| Item | Blocker | Next Action |
| --- | --- | --- |
| FantasyPros as primary production source | FantasyPros support page says public API keys are personal/non-commercial and competing-product use is prohibited without approval. | Get written approval/commercial terms before using as primary paid/public data. |
| Fantrax in blend | No official stable public API path confirmed; current useful docs are unofficial bindings. | Keep excluded until Fantrax or an approved provider path exists. |
| KeepTradeCut trade database | KTC FAQ says no API/CSV export and scraping values/data is forbidden. | Use only approved access or user-visible references; do not scrape. |
| DraftSharks live REST/API credentials | DraftSharks affiliate materials mention REST API docs in the partner control panel, but the actual SOS endpoint URL/payload requires approved account access. | Configure `ENABLE_DRAFTSHARKS_SOS=true`, `DRAFTSHARKS_API_KEY`, and `DRAFTSHARKS_SOS_URL` after partner approval. |
| May 14 projections/SOS rollout | Needs approved projection/SOS source blend and live schedule data validation. | Run provider checks after source approvals and schedule ingestion path are chosen. |
| Source-health production backfill | Production one-off scan ran after cache compression/cleanup and found no eligible cached-report source diagnostics. | No action unless future report payloads include backfillable diagnostics. |
| Alert webhook production config | Needs real Slack/email/webhook secret. | Set `SOURCE_HEALTH_ALERT_WEBHOOK_URL` in production secret store. |
| Remaining report-cache bloat | Old stale versions and expired rows were removed; largest remaining cache rows are fresh current `league-report-v37` and `league-rankings-v11` rows. Postgres table-size reporting may continue to show old relation size until normal vacuum/storage reclamation catches up. | Split ranking metadata/detail reads if transfer remains high. |
| Interactive report performance | Normal page/report loads should use nightly source snapshots for value/ranking/news providers and only call Sleeper for league state plus new adds, drops, and trades. | Refactor `buildRankingsBoard` and report generation to use stored source snapshots during user-triggered loads; keep live provider fetches in cron/manual refresh paths. |
| Confidence calibration | Needs enough 2026 source snapshots, trades, waivers, injuries, news events, and standings movement. | Revisit after in-season sample size accumulates. |
| Snapshot replay/regression tests | Needs a stable fixture set and expected drift thresholds. | Start with source-blend replay fixtures after source trust stabilizes. |
| Monetization/auth/billing | Requires pricing, legal pages, email provider, Stripe product model, and entitlement schema decisions. | Draft implementation PRD before code changes. |
| Magic-link auth | Needs email provider and final session/account model. | Implement after pricing/auth plan is approved. |
| Stripe billing | Needs products/prices and legal/compliance pages. | Do not build billing gates before pricing model is final. |
| Server-side watch/portfolio persistence | Depends on auth/account persistence. | Build after magic-link auth and account-linking tables. |
| Manual GitHub production smoke workflow | Local Playwright production smoke passed against `https://dynastydegens.com`, but the manual GitHub workflow was not triggered from here. | Run the GitHub workflow if we want CI-hosted proof in addition to local Playwright proof. |
| `pnpm run build:analyze` bundle cleanup | Not run tonight because current changes are mostly docs/script and no bundle pass was requested. | Run before next frontend performance pass. |

## Feature Ideas / Data Opportunities Captured

- Use VORP as redraft/draft value-over-cost context, not as a dynasty market source.
- Build opt-in Sleeper trade/draft corpus from leagues users analyze/share.
- Add player alias normalization from nflverse/DynastyProcess IDs and merge names before informal nickname storage.
- Add news-to-value movement by joining news timestamps to source snapshots.
- Add ADP vs blended-value views once FantasyPros ADP rights are cleared.
- Add source trace per player so admins can see which feeds moved confidence/value.
- Add Chrome draft companion after account/auth and compact draft payloads exist.
- Add report-scoped chatbot only after retrieval boundaries are defined.
- Add multi-league portfolio/exposure once snapshots are server-persisted.

## Verification

- `pnpm check`: passed.
- `pnpm vitest run server/apiProviderTelemetry.test.ts server/adminTelemetry.test.ts server/fantasyPros.test.ts`: passed, 3 test files and 8 tests.
- `pnpm vitest run server/draftSharksSchedule.test.ts server/schedulePlanning.test.ts`: passed, 2 test files and 8 tests.
- `pnpm test`: passed, 33 test files and 180 tests.
- `curl -I --max-time 15 https://dynastydegens.com`: passed, production returned HTTP 200 from Vercel.
- `PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm test:e2e:production`: passed, 4 production smoke tests covering `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`.
- `set -a; source .vercel/.env.production.local; set +a; pnpm audit:neon-transfer`: passed with production env loaded. Initial audit showed `18 MB` `league-rankings-v11` rows.
- `LEAGUE_REPORT_CACHE_COMPACT_LIMIT=20 pnpm compact:league-report-cache`: dry-run passed; estimated top-20 reduction was `252 MB` to `35 MB`.
- `LEAGUE_REPORT_CACHE_COMPACT_DRY_RUN=false LEAGUE_REPORT_CACHE_COMPACT_LIMIT=20 pnpm compact:league-report-cache`: production compaction passed; 20 rows changed.
- `set -a; source .vercel/.env.production.local; set +a; pnpm audit:neon-transfer`: passed after compaction; largest `leagueReportCache` payload is now `5.4 MB` and the 18 MB `league-rankings-v11` rows no longer appear in the top 20.
- `set -a; source .vercel/.env.production.local; set +a; pnpm cleanup:league-report-cache`: dry-run passed with `34` stale rows and `89 MB` eligible for deletion.
- `LEAGUE_REPORT_CACHE_CLEANUP_DRY_RUN=false LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE=true pnpm cleanup:league-report-cache`: production cleanup passed; deleted `34` stale cache rows totaling `89 MB`.
- `set -a; source .vercel/.env.production.local; set +a; pnpm audit:neon-transfer`: passed after stale cache cleanup; largest `leagueReportCache` rows are current `league-report-v37` and `league-rankings-v11` rows.
- `set -a; source .vercel/.env.production.local; set +a; pnpm cleanup:league-report-cache`: follow-up dry run passed with no stale `leagueReportCache` version rows found.
- `set -a; source .vercel/.env.production.local; set +a; pnpm exec tsx -e "import { backfillSourceHealthFromCachedReports } from './server/dynamicDataJobs.ts'; ..."`: production source-health backfill scan passed; scanned `54`, backfilled `0`, skipped `54`, alertCount `0`.
- `set -a; source .vercel/.env.production.local; set +a; pnpm cleanup:league-report-cache:expired`: dry-run passed with `9` expired rows and `26 MB` eligible for deletion.
- `LEAGUE_REPORT_CACHE_CLEANUP_DRY_RUN=false LEAGUE_REPORT_CACHE_CLEANUP_CONFIRM_DELETE=true pnpm cleanup:league-report-cache:expired`: production expired cleanup passed; deleted `9` expired rows totaling `26 MB`.
- `set -a; source .vercel/.env.production.local; set +a; pnpm cleanup:league-report-cache:expired`: follow-up dry run passed with no expired rows older than `12` hours found.
- `set -a; source .vercel/.env.production.local; set +a; pnpm audit:neon-transfer`: passed after expired cleanup; `leagueReportCache` now has about `10` rows and largest payload rows are fresh current cache keys.
- `node --check scripts/audit-neon-transfer.mjs`: passed.
- `node --check scripts/compact-league-report-cache.mjs`: passed.
- `pnpm build`: passed.
