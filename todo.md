# Dynasty Degenerates - Project TODO

- Canonical item-by-item execution prompt: [docs/todo-list-execution-prompt.md](docs/todo-list-execution-prompt.md)
- Latest one-pass execution notes: [docs/todo-execution-notes-2026-05-16.md](docs/todo-execution-notes-2026-05-16.md)

## Launch Audit Closeout

- [x] Close the launch-audit blocker pass from `docs/launch-audit/`: `R-001` league switching/loading, `R-002` league context, `R-003` redraft separation, `R-004` pre-draft gating, `R-005` mobile usability, and `R-006` accessibility basics were implemented and verified on Vercel deployment `4c1af13`.
  - 2026-06-01 production QA: Vercel deployment `4c1af13` was `READY`; `mynameisbillex` loaded Skids Get Beat, The Fantasy Degenerates, test league, and Gov Tech Grid Iron; header tags, TE premium, redraft/pre-draft behavior, rankings, Player Hoard, player modal, and mobile Safari smoke passed.
- [x] Follow up on `R-008` API/error resilience: production QA captured one non-fatal `[API Query Error] TRPCClientError: Failed to fetch` while the flow recovered and all reports loaded. Capture the failing endpoint/request context and either suppress expected transient noise or surface a user-friendly retry/error state if the call affects visible data.
  - 2026-06-01 fix: clean production repro did not reproduce a real failing endpoint; the captured error matched an interrupted client fetch during QA. Client-side tRPC network interruptions now log as `[API Query Warning]` / `[API Mutation Warning]` with query context instead of fatal console errors, and failed username league lookup also renders a persistent inline form error. Local production smoke confirmed normal report load has no console errors, simulated `/api/trpc` abort emits warnings only, and the inline error is visible.

## Final Ship Readiness Gate

- [x] Before calling the product finished, run a production data/source freshness review: `pnpm audit:source-freshness`, `pnpm audit:league-report-cache`, admin source coverage, source-health logs, and provider telemetry; resolve recurring stale/missing/error sources or document accepted source limitations.
  - 2026-05-27 run results: `pnpm audit:source-freshness` -> 72 sources loaded, 42 stale, 6 missing, 0 errors; biggest stale families: Devy+FantasyPros weekly ECR.
  - 2026-05-27 run results: `pnpm audit:league-report-cache` -> 300 rows, 71 fresh, 229 stale; latest cache update was ~1h55m ago; `warm leagues` currently none.
  - 2026-05-28 run results: `pnpm audit:source-freshness` -> 72 sources, 21 loaded, 45 stale, 6 missing, 0 errors; top stale families still Devy + FantasyPros weekly ECR.
  - 2026-05-28 run results: `pnpm audit:league-report-cache` -> 311 rows, 76 fresh, 235 stale; latest cache update was 15h43m ago; 57 analyze attempts, 79% hit rate.
  - Follow-up: capture admin source-coverage report, source-health logs, and provider telemetry before marking this pass closed.
  - 2026-05-27 run: `pnpm audit:operations-readiness` added and executed; it consolidates source freshness, source-coverage, source-health events, and provider telemetry into one snapshot.
  - 2026-05-28 run: `pnpm audit:operations-readiness` -> 31 total coverage sources, 16 loaded, 5 stale, 6 missing, 1 blocked, 3 research; 14-day source-health events at warn/info levels only; provider telemetry dominated by Sleeper (22,020 network calls).
  - 2026-06-01 run: [docs/operations-readiness-pass-2026-06-01.md](docs/operations-readiness-pass-2026-06-01.md) captured source freshness, league cache, source coverage, source-health logs, and provider telemetry. Current state: 72 sources, 20 loaded, 46 stale, 6 missing, 0 error; league cache 325 rows, 26 fresh, 299 stale, 98% recent hit rate, 0 analyze errors; source-health has 0 danger events and provider telemetry has 0 429s. Stale/missing source families are documented as accepted release limitations, not launch blockers.
- [ ] Before calling the product finished, run a Vercel production usage review after real traffic and at least one cron window: Fluid Active CPU, function invocations, transfer, provisioned memory, top function routes, skipped-cron behavior, and cached-report hit rate.
  - 2026-05-28 follow-up: add a dedicated run note in [docs/vercel-usage-review-2026-05-28.md](docs/vercel-usage-review-2026-05-28.md) and fill post-review values after dashboard pass.
  - Pending: review Vercel dashboard metrics after a live production report session and next cron window; no usage validation has been added in this pass.
  - 2026-06-01 partial review: [docs/vercel-usage-review-2026-06-01.md](docs/vercel-usage-review-2026-06-01.md) captured a real production traffic session across all four representative leagues, Ready deployment state, cron config, and empty recent production error/500/cron logs. The item remains open because Vercel CLI metrics returned `payment_required` for Observability Plus and `vercel usage --format json` returned `Costs not found (404)`, so Fluid Active CPU, invocation totals, transfer, memory, and route CPU attribution still require dashboard/plan-level access.
  - 2026-06-01 follow-up: production logs exposed cron local-diagnostic write failures under `/var/task` even though durable cron storage returned `200`; local code now skips local KTC snapshot files, API-provider telemetry JSONL, and source-health JSONL writes on Vercel. Verified with full Vitest (`123` files, `612` passed, `1` skipped), `pnpm run check`, and `pnpm build`. Still needs deploy plus post-cron log check before this sub-risk is closed.
  - 2026-06-01 deployment/env refresh: checked production deployment `dpl_AFqMDXkufYkeg2yXuUyUQVx4hMdP` was `Ready` and aliased to `dynastydegens.com`. Production cron listing still matches the expected 12 `vercel.json` entries, but the Vercel CLI continues to report a `6 local changes pending deploy` schedule warning that appears tied to stale/generated local output or duplicate schedule comparison; confirm in the Vercel dashboard before closing that warning.
  - 2026-06-01 cron-window refresh: the `18:40` Pacific dynamic-data-refresh window was inconclusive because Vercel redeployed the same commit (`35f3377`) as `dpl_JAzH9xMCBNR6c9VdN1cn8TsiTFdL` at `18:40:37`, overlapping the cron minute. Post-window logs showed normal report traffic and no `/var/task`, file-cache, missing-cookie, `500`, or error-level entries, but no cron entries either. Re-check a clean non-overlapped cron window.
  - 2026-06-01 post-Home-threshold deploy refresh: production deployment `dpl_9NEdma6k7r7wuReYbenJ4unj2dYs` was `Ready`, aliased to `dynastydegens.com`, and served production smoke across all four representative leagues on desktop, tablet, and mobile (`12` passed). Post-smoke logs showed live `league.analyze` `200` traffic and no error-level, `500`, `/var/task`, league-report file-cache, missing-cookie, or `ApiProviderTelemetry` matches in the checked `15m` window. The item remains open for dashboard-only CPU/usage metrics and a clean non-overlapped cron execution window.
  - 2026-06-02 post-`15:00 UTC` cron-window refresh: production deployment `dpl_9K865A8TVUKJNvYEDVFSeryoVwGs` was `Ready`, aliased to `dynastydegens.com`, and `vercel crons list` still showed the expected 12 production schedules including `/api/cron/ktc-snapshot` at `0 15 * * *`. Bounded Vercel log queries for `/api/cron/ktc-snapshot`, `/var/task`, error level, `500`, generic `cron`, generic `ktc`, and `ENOENT` returned no rows in the checked post-window ranges. This is clean for visible local-write failures, but still does not prove scheduled cron execution because CLI logs did not return explicit cron request rows and dashboard-only CPU/usage metrics remain unavailable here.
  - 2026-06-02 post-`15:20 UTC` cron-window refresh: production deployment `dpl_HWz1iE3MdEVSSMbxGeZ75HukDqKa` was `Ready` before the `/api/cron/league-report-cache` schedule, aliased to `dynastydegens.com`, and `vercel crons list` still showed the expected 12 production schedules including `/api/cron/league-report-cache` at `20 15 * * *`. Bounded Vercel log queries for `/api/cron/league-report-cache`, `/var/task`, `500`, error level, generic `cron`, generic `league-report`, `ENOENT`, `Failed to write file`, and `league report cache` returned no rows in the checked `10m` post-window range. This clean non-overlapped window is stronger evidence that visible serverless local-write failures did not recur, but the item remains open because CLI logs still did not prove scheduled cron execution and dashboard-only CPU/usage metrics remain unavailable here.
  - 2026-06-02 post-cost-guard deploy refresh: production deployment `dpl_66NCLA3n5EcfoTYQTHHwTfxkiqYP` reached `Ready`, aliased to `dynastydegens.com`, and served a desktop production smoke across all four representative leagues (`4` passed). Post-smoke Vercel logs in the checked `10m` window showed normal `200` report/ranking/headshot traffic and no error-level, `500`, `/var/task`, `ENOENT`, failed file-write, league-report file-cache, or `ApiProviderTelemetry` matches. The item remains open for dashboard-only CPU/usage metrics and future clean cron execution proof.
  - 2026-06-02 post-cost-guard responsive log refresh: the same production deployment `dpl_66NCLA3n5EcfoTYQTHHwTfxkiqYP` served mobile/tablet production smoke for all four representative leagues (`8` passed). Post-smoke Vercel logs in the checked `15m` window again showed normal `200` report/ranking/headshot traffic and no error-level, `500`, `/var/task`, `ENOENT`, failed file-write, league-report file-cache, or `ApiProviderTelemetry` matches. The item remains open for dashboard-only CPU/usage metrics and future clean cron execution proof.
  - 2026-06-02 deploy-quota follow-up: after the `league.getUserLeagueRanks` cache guard, `dynastydegens.com` still pointed at deployment `dpl_66NCLA3n5EcfoTYQTHHwTfxkiqYP` and no newer production deployment appeared. A manual `vercel deploy --prod --yes` initially tried to upload `9.2GB` because local generated archives were included; `.vercelignore` now excludes local-only deploy artifacts and reduced the retry payload to `188.3MB`. The retry then failed before deployment creation with Vercel's `api-deployments-free-per-day` limit (`more than 100`), so latest production smoke/log verification is blocked until the quota resets or the dashboard/Git deployment queue accepts a new production deployment.
  - 2026-06-02 latest production deploy/log refresh: `npx --yes vercel@latest inspect dynastydegens.com` returned Ready deployment `dpl_4Pr7NngLwcP3cYRh7PJ55H8aWWtQ`, created `Tue Jun 02 2026 09:46:02 GMT-0700` after commit `951fddb`, and aliased to `dynastydegens.com`. Post-smoke logs in the checked `20m` window showed normal `200` `league.analyze`, `league.getLeaguePreview`, `league.getUserLeagues`, `league.getUserLeagueRanks`, and `images.playerHeadshot` traffic, and a filtered query for error-level, `500`, `/var/task`, `ENOENT`, failed file writes, league-report file-cache, `ApiProviderTelemetry`, and missing-cookie returned no matches. The item remains open for dashboard-only CPU/usage metrics and future clean cron execution proof.
- [ ] Once `Home.tsx` refactoring is no longer blocked, finish the homepage/report-entry cleanup: reduce the oversized page into stable feature components, keep route/data/cache behavior unchanged, and verify signed-out, recent-league, admin/view-as, cached-restore, and fresh-analysis paths.
  - 2026-06-01 first cleanup slice: extracted the report-dashboard render branch into `HomeReportExperience` so `Home.tsx` keeps owning route state, cache/session behavior, and report loading while the report view wiring lives in a feature component. Verified with `pnpm build` and `pnpm exec tsc --noEmit --pretty false --skipLibCheck`; full path QA still needed before closing.
  - 2026-06-01 focused extraction QA: refreshed stale e2e cached-report fixtures to the current browser-cache contract and reran focused Home/report-entry coverage. Passed `home.spec.ts` (`2`), `report-share-redraft.spec.ts` (`6`), `report-state-redraft.spec.ts` (`7`), and targeted `report-command-center.spec.ts` admin/regular checks (`4`) on desktop Chromium, plus `pnpm run check`. This covers signed-out home, cached URL restore, stale-cache rejection, last-league restore, redraft rankings/draft/modal state, admin view-as switching, admin feature surfaces, and regular-view protection. Still needs fresh-analysis/live real-league path QA before closing.
  - 2026-06-01 live production QA refresh: `PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome` passed all four representative leagues (`Skids Get Beat`, `The Fantasy Degenerates`, `test league`, `Gov Tech Grid Iron`), and the same spec passed on `mobile-chrome` + `tablet-chrome` (`8` more passes). This proves the current public home/report-entry path can load real leagues and preserve dynasty/redraft/pre-draft behavior across responsive viewports. It does not prove trusted `forceRefresh` fresh-generation or admin production mode because local `CRON_SECRET` / admin password envs and Vercel CLI access were unavailable in this shell; `Home.tsx` also remains oversized.
  - 2026-06-01 second cleanup slice: extracted report tab fallback/count/index derivation from `Home.tsx` into `buildHomeReportTabState` with regression coverage for legacy tab aliases, retired `projections` migration, blocked Autopilot fallback, hidden Draft fallback, and six-tab admin/draft state. Verified with `pnpm exec vitest run client/src/features/home/lib/reportRouteState.test.ts` and `pnpm run check`.
  - 2026-06-01 preview-mode cleanup slice: extracted the Home preview loading/success effect into `useHomePreviewMode` under `client/src/features/home/hooks/` while preserving the `?preview=loading`, `?preview=success`, and `?preview=loading-loop` paths. Verified with `pnpm run check` and targeted Playwright preview coverage: `loading-manager-icons.spec.ts`, generated-report desktop/mobile success card, and reduced-motion fallback (`3` passed).
  - 2026-06-01 fourth cleanup slice: extracted AI voice-mode sync into `useHomeAIVoiceMode` and queued success-transition timeout management into `useQueuedTimeouts`, reducing route-local browser/timer plumbing while preserving report loading/cache behavior. Verified with `pnpm run check`, `home.spec.ts` (`2`), and targeted `report-share-redraft.spec.ts` cached restore/layout checks (`2`).
  - 2026-06-01 fifth cleanup slice: extracted the loading-dialog timeout effect into `useHomeLoadingTimeout`, keeping the report loading state in `Home.tsx` but moving browser timer cleanup out of the route. Verified with `pnpm run check` and `pnpm exec playwright test tests/e2e/loading-manager-icons.spec.ts --project=desktop-chrome`.
  - 2026-06-01 sixth cleanup slice: extracted portfolio row/filter derivation and invalid league-filter reset into `useHomePortfolio`, keeping the route responsible for portfolio filter state while moving pure derived portfolio state out of `Home.tsx`. Verified with `pnpm exec vitest run client/src/features/home/lib/portfolioRows.test.ts`, `pnpm run check`, and `PLAYWRIGHT_PORT=3118 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts --project=desktop-chrome` (`8` passed).
  - 2026-06-01 seventh cleanup slice: extracted current/previous report delta snapshot derivation and local persistence into `useReportDeltaSnapshots`, keeping the report shell props unchanged while moving delta snapshot storage out of `Home.tsx`. Verified with `pnpm run check`; `PLAYWRIGHT_PORT=3119 pnpm exec playwright test tests/e2e/report-share-redraft.spec.ts tests/e2e/home.spec.ts --project=desktop-chrome` passed `7`/`8` before the local dev server refused the final navigation, and the failed mobile cached-report case passed immediately on fresh `PLAYWRIGHT_PORT=3120`.
  - 2026-06-01 eighth cleanup slice: extracted report-load visible telemetry queuing into `useReportLoadTelemetry`, preserving the existing browser-cache/server visible timing behavior while moving app-boot timing and telemetry persistence out of `Home.tsx`. Verified with `pnpm run check` and `PLAYWRIGHT_PORT=3121 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts --project=desktop-chrome` (`8` passed).
  - 2026-06-01 ninth cleanup slice: extracted AI prediction telemetry batching into `useHomeAIPredictionTelemetry` and report background-refresh timing into `useReportBackgroundRefresh`, keeping report/rankings/cache context in `Home.tsx` while moving event derivation, signature dedupe, mutation dispatch, report-scan timestamping, and focus/visibility refresh timers out of the route. Verified with `pnpm run check`, `pnpm exec vitest run client/src/lib/aiPredictionEvents.test.ts`, and `PLAYWRIGHT_PORT=3122 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts --project=desktop-chrome` (`8` passed).
  - 2026-06-01 tenth cleanup slice: extracted report cache persistence into `usePersistHomeReportCache` and report-tab action/hash sync behavior into `useHomeReportTabActions`, preserving last-league writes, browser report cache writes, blocked Autopilot fallback, hidden Draft fallback, legacy `projections` migration, URL sync, and Roster Scanner focus behavior. Verified with `pnpm run check`, `pnpm exec vitest run client/src/features/home/lib/reportRouteState.test.ts`, and `PLAYWRIGHT_PORT=3123 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts tests/e2e/report-state-redraft.spec.ts --project=desktop-chrome` (`15` passed).
  - 2026-06-01 eleventh cleanup slice: extracted admin access derivation, admin-view persistence, unlock prompt state, and Admin Tools click behavior into `useHomeAdminAccess`, preserving admin/regular mode switching, protected Autopilot visibility, passphrase unlock flow, and saved Sleeper-session admin view mode. Verified with `pnpm run check` and targeted `PLAYWRIGHT_PORT=3124 pnpm exec playwright test tests/e2e/report-command-center.spec.ts --project=desktop-chrome -g "lets admins return to regular view|keeps admin-only feature surfaces tied|does not expose AI Autopilot to regular report viewers|shows live-data AI Autopilot only for admin view"` (`4` passed).
  - 2026-06-01 twelfth cleanup slice: extracted stale browser-cache version invalidation and refresh kickoff into `useStaleReportCacheRefresh`, preserving old-cache clearing, stale key removal, loading-message reset, and background refresh behavior for preserved Fast Refresh state. Verified with `pnpm run check`, `pnpm exec vitest run client/src/features/home/lib/reportRouteState.test.ts`, and `PLAYWRIGHT_PORT=3126 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts tests/e2e/report-state-redraft.spec.ts --project=desktop-chrome` (`15` passed).
  - 2026-06-01 thirteenth cleanup slice: extracted Sleeper league intel rank enrichment into `useHomeLeagueIntelRanks`, preserving the `getUserLeagueRanks` mutation, standings/power/manager-anchor merge behavior, enriched Sleeper-session cache writes, and league picker busy state. Verified with `pnpm run check` and `PLAYWRIGHT_PORT=3127 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts --project=desktop-chrome` (`8` passed).
  - 2026-06-01 fourteenth cleanup slice: extracted Home navigation/loading actions into `useHomeNavigationActions`, preserving start-over cache/session clearing, loading cancel/retry state resets, league picker/change-league routing, and league-option analysis kickoff behavior. Verified with `pnpm run check` and `PLAYWRIGHT_PORT=3128 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts --project=desktop-chrome` (`8` passed).
  - 2026-06-01 fifteenth cleanup slice: extracted Sleeper username league search into `useHomeSleeperLeagueSearch` and report rankings metadata hydration into `useHomeReportRankings`, preserving the `getUserLeagues` mutation, empty-username/no-league errors, clown modal reset, username history/cache writes, Sleeper session persistence, admin regular-view persistence, success toast/league picker open, visible pending state, rankings metadata fetch gating, and ranked report data passed to report/AI surfaces. Verified with `pnpm run check` and `PLAYWRIGHT_PORT=3129 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts --project=desktop-chrome` (`8` passed).
  - 2026-06-01 sixteenth cleanup slice: extracted report analysis loading setup into `useHomeAnalysisLoading`, preserving the league-preview mutation, blocking-analysis refs, pending league preview fallback, loading timeout reset, manager-anchor preload, and preview-error deferral to the full analysis request. Verified with `pnpm run check` and `PLAYWRIGHT_PORT=3130 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts --project=desktop-chrome` (`8` passed).
  - 2026-06-01 seventeenth cleanup slice: extracted league ID history writes and current-Sleeper-user league shortcut persistence into `useHomeLeagueHistoryActions`, preserving autocomplete history updates, cached Sleeper user identity fallback, admin-capable session flags, and cached league shortcut writes after successful analysis. Verified with `pnpm run check` and `PLAYWRIGHT_PORT=3131 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts --project=desktop-chrome` (`8` passed).
  - 2026-06-01 eighteenth cleanup slice: extracted admin-login submit/modal handlers into `useHomeAdminLogin` and cached-report apply/background-restore actions into `useHomeCachedReportActions`, preserving admin session unlock/invalidation, passphrase modal resets, sanitized browser-cache application, per-league history writes, background refresh debouncing, and cached-report telemetry. Verified with `pnpm run check`, `PLAYWRIGHT_PORT=3136 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts tests/e2e/report-state-redraft.spec.ts --project=desktop-chrome` (`15` passed), and individual admin spot checks on `PLAYWRIGHT_PORT=3133` / `3135` for regular-view protection and admin manager switching. A grouped admin run hit a viewport click flake and is not counted as passing evidence.
  - 2026-06-01 nineteenth cleanup slice: extracted URL/report identity recovery into `useHomeReportIdentityRecovery`, preserving pageshow/visibility recovery, mismatched report cache clearing, per-league restore fallback, loading preview kickoff, and analyzer retry for stale URL/report identity. Verified with `pnpm run check` and `PLAYWRIGHT_PORT=3137 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts tests/e2e/report-state-redraft.spec.ts --project=desktop-chrome` (`15` passed).
  - 2026-06-01 twentieth cleanup slice: extracted boot-time Sleeper session, last-league, and browser-report restore into `useHomeCachedSessionRestore`, preserving Sleeper session identity/admin-view restoration, username and league history writes, cached Sleeper user refresh, stale cache key cleanup, URL league fallback analysis kickoff, last-league freshness checks, cached-report telemetry, and background refresh behavior. Verified with `pnpm run check` and `PLAYWRIGHT_PORT=3138 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts tests/e2e/report-state-redraft.spec.ts --project=desktop-chrome` (`15` passed).
  - 2026-06-01 twenty-first cleanup slice: extracted pure Home render/view-state derivation into `useHomeViewState`, preserving autocomplete option filtering, report tab visibility/fallback state, Autopilot/Draft gating, report tab CSS variables, loading reveal state, league format pills, and league logo fallback initials while keeping cached-user/admin dependency ordering in `Home.tsx`. Verified with `pnpm run check` and `PLAYWRIGHT_PORT=3139 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts tests/e2e/report-state-redraft.spec.ts --project=desktop-chrome` (`15` passed).
  - 2026-06-01 twenty-second cleanup slice: extracted the Home report-analysis mutation and submit handler into `useHomeReportAnalysis`, preserving blocking/background analysis modes, request timing telemetry, cached-hit fast path, success reveal/kick timers, manager-anchor loading context, league shortcut writes, background-refresh fallback behavior, and the `liveRefresh` fresh-analysis request path while reducing `Home.tsx` from `921` to `726` lines. Verified with `pnpm run check`, `PLAYWRIGHT_PORT=3140 pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/report-share-redraft.spec.ts tests/e2e/report-state-redraft.spec.ts --project=desktop-chrome` (`15` passed), and `PLAYWRIGHT_PORT=3141 pnpm exec playwright test tests/e2e/loading-manager-icons.spec.ts --project=desktop-chrome` (`1` passed). Local Playwright logs included rate-limit lines during fixture routes, but all asserted tests passed.
- [ ] Once CSS refactoring is no longer blocked, finish the high-risk stylesheet cleanup: audit global selectors, remove duplicated or dead rules only with evidence, preserve current visuals, and verify homepage, report shell, player modal, tables, mobile header/footer, and dark command-center surfaces.
- [ ] Once Home/CSS work is unlocked, run a visual QA pass before final ship: screenshots or browser checks for homepage, generated report, owner intel, player detail modal, waiver, trade, rankings, draft, admin diagnostics, desktop, tablet, mobile, reduced motion, and loading/error/empty states.
- [ ] Before calling the product finished, run a real-league smoke pass across representative leagues, signed-out flow, signed-in flow, admin mode, cached-report restore, fresh report generation, desktop, tablet, and mobile.
  - 2026-06-01 public production smoke refresh: `tests/e2e/production-smoke.spec.ts` passed on desktop (`4`), mobile (`4`), and tablet (`4`) against `https://dynastydegens.com` for the four representative leagues. Remaining gaps before closing this gate: signed-in/admin production mode, trusted fresh report generation, and deployment/log follow-up through Vercel dashboard or working CLI access.
  - 2026-06-01 latest deployment smoke refresh: `PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome` passed `4`/`4` against deployment `dpl_ohw2DUvovZqHdXKdzZeUPfZSEqC3` after the latest Home cleanup pushes. Remaining gaps stay signed-in/admin production mode, trusted fresh report generation, tablet/mobile refresh on the latest deployment, and dashboard/cron follow-up.
  - 2026-06-01 post-Home-threshold smoke refresh: `PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome --project=mobile-chrome --project=tablet-chrome` passed `12`/`12` against deployment `dpl_9NEdma6k7r7wuReYbenJ4unj2dYs` after `Home.tsx` dropped below the oversized-file threshold. Remaining gaps stay signed-in/admin production mode, trusted fresh report generation, and dashboard/cron follow-up.
  - 2026-06-02 live admin production smoke refresh: `RUN_LIVE_ADMIN_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/live-admin-report.smoke.spec.ts --project=desktop-chrome` passed `3`/`3` after updating the smoke to use the current username league-picker flow, current AI Autopilot cockpit, admin diagnostics disclosures, and pre-draft redraft locked-state copy. This covers signed-in/admin production mode for `The Fantasy Degenerates`, `Gov Tech Grid Iron`, and `test league`; remaining gaps stay trusted fresh report generation and dashboard/cron follow-up.
  - 2026-06-02 post-analysis-hook production smoke refresh: `env -u NO_COLOR PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome --project=mobile-chrome --project=tablet-chrome` passed `12`/`12` across `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron` after commit `d2924a1` was pushed. `curl -I https://dynastydegens.com` returned fresh Vercel content last modified `Tue, 02 Jun 2026 04:36:23 GMT`, but `vercel` was not installed and `npx vercel inspect dynastydegens.com` did not return usable deployment metadata in this shell, so exact deployment-ID proof remains unavailable here. Remaining gaps stay trusted fresh report generation, dashboard-only CPU/usage metrics, and clean cron/log follow-up.
  - 2026-06-02 latest production smoke refresh: `npx --yes vercel@latest inspect dynastydegens.com` returned Ready deployment `dpl_6LzxMFJGdVRcnVNq7PUtVeheqGAv`, created `Tue Jun 02 2026 07:24:06 GMT-0700`, aliased to `dynastydegens.com`; `curl -I https://dynastydegens.com` returned `200` with `last-modified: Tue, 02 Jun 2026 14:38:43 GMT`; `env -u NO_COLOR PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome --project=mobile-chrome --project=tablet-chrome` passed `12`/`12`. Post-smoke Vercel log queries for error level, `500`, and `/var/task` returned no rows in the checked `10m` window. Remaining gaps stay trusted fresh generation, dashboard-only CPU/usage metrics, and clean cron-window proof.
  - 2026-06-02 repeat production smoke confirmation: reran the same public production smoke against `https://dynastydegens.com` at `07:44 PDT`; mobile, tablet, and desktop passed `12`/`12` across the four representative leagues, and Vercel log queries for error level, `500`, and `/var/task` returned no rows in the checked `10m` window. Remaining gaps stay trusted fresh generation, dashboard-only CPU/usage metrics, and clean cron-window proof.
  - 2026-06-02 trusted fresh-generation probe: a direct production `league.analyze` call for `Skids Get Beat` with `forceRefresh: true` and this shell's local `CRON_SECRET` returned `200` but `reportCacheStatus: "hit"`, and the production `/api/cron/league-report-cache?leagueId=1312139584427012096&force=1` probe returned `401 Unauthorized`. This confirms the local secret does not authorize production force refresh, so the trusted fresh-generation gap remains open until rerun with the actual production `CRON_SECRET` or through the Vercel dashboard/cron path.
  - 2026-06-02 post-cost-guard production smoke: deployment `dpl_66NCLA3n5EcfoTYQTHHwTfxkiqYP` was `Ready` and aliased to `dynastydegens.com`; desktop production smoke passed `4`/`4` for `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`. Post-smoke Vercel logs had no error-level, `500`, `/var/task`, `ENOENT`, failed file-write, league-report file-cache, or `ApiProviderTelemetry` matches in the checked `10m` window. Remaining gaps stay trusted fresh generation, dashboard-only CPU/usage metrics, clean cron-window proof, and latest tablet/mobile refresh.
  - 2026-06-02 post-cost-guard responsive smoke: mobile and tablet production smoke passed `8`/`8` on deployment `dpl_66NCLA3n5EcfoTYQTHHwTfxkiqYP` for `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`. Post-smoke Vercel logs had no error-level, `500`, `/var/task`, `ENOENT`, failed file-write, league-report file-cache, or `ApiProviderTelemetry` matches in the checked `15m` window. Remaining gaps stay trusted fresh generation, dashboard-only CPU/usage metrics, and clean cron-window proof.
  - 2026-06-02 latest production smoke refresh: deployment `dpl_4Pr7NngLwcP3cYRh7PJ55H8aWWtQ` was `Ready` after commit `951fddb`; `env -u NO_COLOR PRODUCTION_SMOKE=true PLAYWRIGHT_BASE_URL=https://dynastydegens.com pnpm exec playwright test tests/e2e/production-smoke.spec.ts --project=desktop-chrome --project=mobile-chrome --project=tablet-chrome` passed `12`/`12` across `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`. Post-smoke Vercel log filtering returned no error-level, `500`, `/var/task`, `ENOENT`, failed file-write, league-report file-cache, `ApiProviderTelemetry`, or missing-cookie matches. Remaining gaps stay trusted fresh generation, dashboard-only CPU/usage metrics, and clean cron-window proof.
- [ ] Before calling the product finished, run an AI-read correctness pass so visible recommendations cannot ask for impossible actions: already-starting players, unavailable players, locked games, injured/bye players, stale sources, redraft/dynasty mismatch, roster need already solved, duplicate/conflicting action reads, and missing evidence.
  - 2026-06-01 first pass: [docs/ai-read-correctness-pass-2026-06-01.md](docs/ai-read-correctness-pass-2026-06-01.md) confirmed existing guardrail coverage for already-starting, unavailable, locked, bye, redraft/dynasty mismatch, stale source caps, low-source pickup advice, and one-primary-action queue behavior. Fixed Autopilot waiver reads so structured weekly source trace status reaches the evidence engine, stale weekly sources cap the read, capped waiver reads say `Monitor only` / `Don't add yet`, and capped expected actions persist as `hold` instead of waiver add.
  - 2026-06-01 admin ownership guard: added `AdminAIReadoutSections.test.ts` coverage proving the admin surface registry has exactly one action owner, that only `autopilot-actions` / `Action Queue` can make recommendation claims, and that missing confidence evidence downgrades Action Queue to data-only/no-claim status.
  - 2026-06-01 waiver duplicate-action guard: demoted Waiver Intelligence support receipts from `Do this` to `Review this` so the user-visible waiver panel does not compete with the Autopilot Action Queue. Added rendered Playwright coverage proving the cached Waiver Intelligence section shows `Review this` and no exact `Do this` owner copy, plus unit coverage proving generated waiver receipt summaries use `Review this`. Verified with targeted `report-command-center.spec.ts` waiver test, `WaiverIntelligencePanel.test.ts`, `buildAutopilotData.test.ts`, `AdminAIReadoutSections.test.ts`, and `pnpm run check`.
  - 2026-06-01 player-detail redraft guard: tightened Player Detail AI signal modes so redraft/current evidence is only attached when current-season evidence exists. Added direct `buildPlayerAiRead` coverage for dynasty-only evidence in redraft, bye-week start-like reads, and source-thin confidence caps. Verified with `PlayerDetailModal.test.ts`, `aiEvidenceEngine.test.ts`, `aiReadDecision.test.ts`, and `pnpm run check`.
  - 2026-06-02 Trade War Room package guard: package ideas and suggested add-on picker rows no longer propose an asset that is already selected by normalized player/pick identity, preventing duplicate pick/player instructions inside the same suggested trade package. Also refreshed the rendered Trade War Room assertion away from a stale class selector and fixed missing React keys in trade outcome asset rows so console-audited browser checks stay clean. Verified with `pnpm exec vitest run client/src/components/reportTables/TradeWarRoom.test.ts` (`11` passed), `PLAYWRIGHT_PORT=3142 pnpm exec playwright test tests/e2e/report-command-center.spec.ts --project=desktop-chrome -g "shows trade calibration coverage and ledger value-movement reads"` (`1` passed), and `pnpm run check`.
  - 2026-06-02 Action Queue verification-copy guard: the primary AI Action Queue now explicitly labels source/guardrail rows as `Where to verify` and falls back to a conservative roster/availability/league-format/source-freshness verification reminder when a queue item lacks source-health rows, making the read answer the `Where should I verify?` requirement instead of hiding it behind generic source-health copy. Verified with `PLAYWRIGHT_PORT=3145 pnpm exec playwright test tests/e2e/report-command-center.spec.ts --project=desktop-chrome -g "shows live-data AI Autopilot only for admin view"` (`1` passed) and `pnpm run check`.
  - 2026-06-02 shared AI read verification-copy guard: `AIReadPanel` now derives a `Where to verify` disclosure from attached source traces, hard blockers, missing evidence, confidence caps, or a conservative roster/availability/league-format/source-freshness fallback, so shared Overview/Owner/Rankings/Trade/Draft/Player reads can answer the verification question without every caller hand-writing receipt copy. Verified with `PLAYWRIGHT_PORT=3146 pnpm exec playwright test tests/e2e/report-command-center.spec.ts --project=desktop-chrome -g "keeps admin-only feature surfaces tied"` (`1` passed) and `pnpm run check`.
  - 2026-06-02 Action Queue precondition guard: high-confidence waiver, lineup, stream, add/drop, and trade reads now downshift from `Do this` to `Don't force it` unless the expected action carries concrete player/pick/roster identity and the evidence read has cleared current roster, lineup, transaction, source-health, and league-format preconditions. Mock data was downgraded to watch reads where live precondition proof is absent. Verified with `pnpm exec vitest run client/src/lib/autopilot/buildAutopilotData.test.ts` (`16` passed), `PLAYWRIGHT_PORT=3146 pnpm exec playwright test tests/e2e/report-command-center.spec.ts --project=desktop-chrome -g "keeps admin-only feature surfaces tied"` (`1` passed), and `pnpm run check`.
  - 2026-06-02 Action Queue invariant coverage: added a fixture-wide regression assertion that every `Do this now` queue row has a concrete non-hold expected action and no precondition/concrete-action missing-evidence receipt, while mock/fallback queues cannot emit `do` decisions without live proof. Verified with `pnpm exec vitest run client/src/lib/autopilot/buildAutopilotData.test.ts` (`17` passed).
  - 2026-06-02 reason-only trade guard: tightened Action Queue trade preconditions so a trade expected action can no longer count as concrete from rationale copy alone; it must carry player/pick identity or explicit roster/return details before a high-confidence trade read can become `Do this now`. Added regression coverage for a high-conviction, `canAct` trade fixture with only `reason` text, proving it downshifts to `Don't force it`.
  - 2026-06-02 waiver roster-move guard: tightened Autopilot waiver preconditions so waiver add/stream reads need a concrete drop candidate or explicit open-roster proof before they can be labeled `Queue-backed` or promoted to `Do this now`. Added regression coverage proving a high-confidence waiver fixture without a drop candidate stays `Monitor only` / `No forced move`.
  - 2026-06-02 generic lineup-start guard: generic matchup/best-starter support reads no longer say plain `Start` or emit `start_player` expected actions unless a concrete starter swap exists. They stay `Review starter slot` / `hold` until the exact lineup slot or player-out side is identified, and mock/fallback lineup copy uses the same review language. Explicit stored-projection swaps remain actionable because they carry both sides.
  - 2026-06-02 trade partner/return guard: trade expected actions now need a concrete trade-side identity plus either a true two-sided move or partner/return proof before counting as concrete. Single-player trade ideas without partner proof stay `Don't force it` with an explicit missing-evidence note.
  - 2026-06-02 player-detail availability guard: redraft Player Detail reads that infer a start/lineup lens now require live availability, so players marked out/unavailable are hidden like bye-week blocked reads instead of rendering support copy. Added a regression for a high-rank current-season receiver marked `Out`.
  - 2026-06-02 stale-drop waiver guard: Autopilot waiver add/drop reads now re-check suggested drops against current roster and starter state before treating them as roster-move proof. Stale drop candidates no longer create `drop_for_add` actions and stay `Monitor only` / `hold`.
  - 2026-06-02 starter-drop waiver coverage: added explicit Autopilot regression coverage proving a currently starting player cannot be used as waiver drop proof; those reads stay `Monitor only` / `hold` with the starter-drop evidence gap visible.
  - 2026-06-02 unavailable lineup replacement guard: Autopilot lineup swaps now require the incoming replacement to clear hard availability/bye checks before `swap_starter` can render. Stored-projection edges for players marked `Out` no longer produce direct start-over actions.
  - 2026-06-02 slotless start-action guard: central Action Queue preconditions now reject `start_player` expected actions unless they include either a concrete starter-out side or explicit lineup slot proof, so malformed high-confidence lineup reads cannot say `Do this now` from generic start copy alone.
  - 2026-06-02 same-player action guard: the central Action Queue expected-action precondition now rejects malformed `drop_for_add` / `swap_starter` reads where `playerIn` and `playerOut` resolve to the same player, keeping same-player swaps out of `Do this now`.
  - 2026-06-02 same-player trade guard: the central Action Queue trade precondition now rejects malformed trade expected actions where `playerIn` and `playerOut` resolve to the same player, even if the read has high confidence and two-sided trade copy.
  - 2026-06-02 repeated trade-piece guard: trade expected actions that rely on `playersInvolved` proof now require distinct player identities, so repeating the same player as multiple trade pieces cannot become a `Do this now` Action Queue recommendation.
  - 2026-06-02 same-player add/drop guard: add/start-style expected actions now reject optional `playerOut` proof when it resolves to the same player as `playerIn`, so malformed waiver reads cannot say to add and drop the same player.
  - 2026-06-02 same-player bench/drop guard: drop/bench-style expected actions now reject optional `playerIn` proof when it resolves to the same player as `playerOut`, so malformed lineup reads cannot say to bench and start the same player.
  - 2026-06-02 replacementless bench/drop guard: central Action Queue preconditions now reject `bench_player` actions without a replacement or explicit lineup slot, and `drop_player` actions without a replacement or open roster spot proof, so malformed high-confidence reads cannot say to bench/drop from generic copy alone.
  - 2026-06-02 expired action deadline guard: central Action Queue preconditions now reject expected actions whose parseable deadline is already in the past, so stale cached action receipts cannot render as current `Do this now` recommendations.
  - 2026-06-02 Action Queue source/action guard: queue preconditions now reject expected-action types that belong to a different source lane, so lineup reads cannot promote waiver actions, waiver reads cannot promote trade/lineup actions, and trade reads cannot promote non-trade actions.
  - 2026-06-02 Action Queue source/action coverage: added regression coverage for waiver reads carrying trade expected actions and trade reads carrying lineup expected actions, keeping the source/action guard executable across the high-risk queue lanes.
  - 2026-06-02 redraft stash guard coverage: added Autopilot regression coverage proving dynasty-only taxi/stash waiver evidence does not render as a redraft waiver recommendation or Action Queue target. Verified with `pnpm exec vitest run client/src/lib/autopilot/buildAutopilotData.test.ts` (`41` passed).
- [ ] Before calling the product finished, complete an operations/security pass: production env var names, `CRON_SECRET`, admin passphrase/session behavior, provider feature flags, API-key leak response steps, webhook/alert configuration, no secret logging, and rollback notes.
  - `CRON_SECRET` currently required by cron handlers and guarded in `isCronAuthorized`; add it to production envs now if not already present.
  - Admin auth hardening already present: production requires `JWT_SECRET` + `ADMIN_LOGIN_PASSWORD`, timing-safe admin passphrase check, and session cookies only via `getSessionCookieOptions`.
  - Source-health alerting is implemented server-side (`SOURCE_HEALTH_ALERT_WEBHOOK_URL`, min-level filter); production URL still needs to be configured.
  - 2026-05-28 follow-up: add a dedicated env-hardening execution note in [docs/operations-env-hardening-pass-2026-05-28.md](docs/operations-env-hardening-pass-2026-05-28.md) and close this after production secret verification.
  - 2026-06-01 local hardening: Vercel/serverless runs no longer attempt local diagnostic writes under `/var/task`; durable DB storage and webhook behavior are preserved.
  - 2026-06-01 file-cache hardening: post-deploy logs found the same serverless write issue in the league-report local file cache; Vercel now skips local league-report file-cache reads/writes/pruning while preserving memory cache and durable DB cache.
  - 2026-06-01 auth guard: `server/auth.logout.test.ts` now covers production fail-closed admin login behavior for missing `JWT_SECRET` and missing `ADMIN_LOGIN_PASSWORD`, in addition to invalid passphrase rejection and secure session-cookie options.
  - 2026-06-02 admin-login rate-limit guard: `auth.adminLogin` now uses the shared route limiter after production/password precondition checks but before passphrase comparison, user upsert, or session-cookie issuance. Added route-order coverage so brute-force protection stays ahead of admin session work.
  - 2026-06-02 account-write rate-limit guard: parked account-linking write routes now share a signed-in-user scoped route limiter before persistence checks, DB reads, and DB writes, keeping saved Sleeper accounts, favorite leagues, recent reports, and notification preference mutations from becoming unbounded account-write surfaces. Added route-order coverage for each protected account mutation.
  - 2026-06-02 admin diagnostics rate-limit guard: admin-only system diagnostics now share a bounded admin/IP scoped route limiter before snapshot coverage, abuse telemetry, source health, billing overview, source coverage, provider telemetry, AI calibration, manual outcome feedback, and outcome-resolution aggregation work. Added route-order coverage so admin diagnostics cannot be polled as unbounded DB/local aggregate surfaces.
  - 2026-06-01 log cleanup: public requests without a session cookie now stay anonymous without logging `[Auth] Missing session cookie`; invalid/malformed session cookies still warn.
  - 2026-06-01 production follow-up: final production smoke passed on `dynastydegens.com` for `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`; post-smoke Vercel logs showed no `/var/task`, league-report file-cache, missing-cookie, or `500` entries in the checked window. Still re-check cron logs after the next scheduled cron window.
  - 2026-06-01 responsive smoke follow-up: production smoke also passed on `mobile-chrome` and `tablet-chrome` for the same four leagues (`8 passed`), covering mobile/tablet league load, dynasty draft-history signals, redraft current-season copy, and pre-draft redraft hiding of Draft History.
  - 2026-06-01 post-responsive-smoke logs: checked deployment `dpl_AFqMDXkufYkeg2yXuUyUQVx4hMdP` showed no `/var/task`, league-report file-cache, missing-cookie, or `500` entries in the checked window.
  - 2026-06-01 post-cron-window logs: checked after the `18:40` Pacific window and found no `/var/task`, league-report file-cache, missing-cookie, `500`, or error-level entries, but cron execution was not visible because a same-commit production redeploy overlapped the cron minute. Still re-check a non-overlapped cron window.
  - 2026-06-02 post-`15:00 UTC` cron-window logs: checked after the scheduled `ktc-snapshot` window and found no `/var/task`, `ENOENT`, `500`, or error-level entries, but the Vercel CLI still returned no explicit cron invocation rows. Treat old serverless local-write failure as not reproduced in the checked window, while cron execution proof remains a dashboard/manual gap.
  - 2026-06-01 production env-name check: Vercel production has encrypted `CRON_SECRET`, `JWT_SECRET`, `ADMIN_LOGIN_PASSWORD`, `ADMIN_PERMISSIONS`, `FANTASYPROS_API_KEY`, and projection feature flags. `SOURCE_HEALTH_ALERT_WEBHOOK_URL` and `SOURCE_HEALTH_ALERT_WEBHOOK_MIN_LEVEL` are not configured yet, so alert delivery remains an ops follow-up.
  - 2026-06-01 rollback/leak-response linkage: rollback path is documented in [docs/baseline-map.md](docs/baseline-map.md), and provider/webhook key incident handling is documented in [docs/provider-key-leak-response.md](docs/provider-key-leak-response.md). Continue to verify no API keys appear in logs/output.
  - 2026-06-01 latest deploy log refresh: after desktop/tablet/mobile production smoke on deployment `dpl_9NEdma6k7r7wuReYbenJ4unj2dYs`, Vercel logs had no error-level, `500`, `/var/task`, league-report file-cache, missing-cookie, or `ApiProviderTelemetry` matches in the checked `15m` window.
  - 2026-06-02 repeatable secret-exposure audit: added `pnpm audit:secret-exposure` to scan client source, public assets, and server/script console logging for sensitive env references or raw secret-value logging without printing secret values. Current run passed, and `pnpm run check` also passed. This does not close production-only gaps: source-health webhook configuration, clean cron-window logs, dashboard CPU/usage metrics, and production secret-store verification after any future env changes remain open.
  - 2026-06-02 post-`15:20 UTC` league-report-cache cron logs: checked a non-overlapped production window for `/api/cron/league-report-cache`, `/var/task`, `ENOENT`, `Failed to write file`, `500`, error-level rows, generic `cron`, and league-report cache text. No rows were returned, so the old visible serverless local-write failure did not reproduce in the checked window. Cron execution proof and dashboard CPU/usage review remain manual/dashboard gaps.
  - 2026-06-02 Vercel local deploy context guard: added `.vercelignore` for local dependency/build/test artifacts, generated offline value-history archives, local env files, and prototype inputs. This keeps manual production deploy payloads aligned with the Git deployment shape; the first retry dropped from a `9.2GB` upload attempt to `188.3MB` before hitting the daily Vercel deployment quota.
  - 2026-06-02 Sleeper username lookup cost guard: added a user-load provider-boundary regression proving `league.getUserLeagues` keeps Sleeper user and league fetches behind the route limiter, so username search abuse cannot bypass the cheap rate-limit gate before provider calls.
  - 2026-06-02 Sleeper username lookup cache guard: `league.getUserLeagues` now reuses a short-lived bounded successful username/season lookup cache after the route limiter and before Sleeper user/leagues fetches, reducing repeated entry-flow provider work while still counting repeated requests against the abuse gate.
  - 2026-06-02 direct league-preview cache guard: `league.getLeaguePreview` now reuses a short-lived bounded preview cache after access/rate checks, avoiding repeated Sleeper league/users fetches during direct league-ID loading retries while preserving invalid-league and route-limit protection. Added route-boundary and router coverage for cache-first repeated previews.
  - 2026-06-02 direct league-preview IP-wide rate guard: `league.getLeaguePreview` now runs an IP-wide limiter before the league-scoped limiter, so broad league-ID probing cannot multiply the preview allowance across many IDs before Sleeper league/users fetch work. Extended route-boundary coverage to keep both limiters before cache and provider work.
  - 2026-06-02 league-rank lookup cache guard: `league.getUserLeagueRanks` now reuses a short-lived bounded per-user/per-league rank cache after access/rate-limit checks and before Sleeper player/league/roster/user fanout, reducing repeated league-picker refresh work while preserving the max-10 league input cap and concurrency limit.
  - 2026-06-02 cached-report live-activity cost guard: cached `league.analyze` opens now reuse a short-lived league-scoped live Sleeper activity patch for recent transactions, trends, waiver intelligence, and schedule-edge targets, reducing repeated Sleeper live calls during rapid reloads while keeping cached reports current enough for user-visible activity. Added provider-boundary coverage proving cached report opens check the live-activity cache before rebuilding the patch.
  - 2026-06-02 bounded live-activity cache guard: the cached-report live Sleeper activity patch cache now prunes expired entries and evicts the oldest league before exceeding `80` league patches, so broad league-ID probing cannot grow server memory unbounded. Extended provider-boundary coverage to lock the max-entry guard and prune-before-write order.
  - 2026-06-02 bounded report-memory cache guard: the full league-report memory cache now prunes expired entries and evicts the oldest cached report/rankings payload before exceeding `60` entries, so broad league-ID probing cannot grow heavy in-process report payloads unbounded. Added provider-boundary coverage proving report cache reads/writes go through the bounded helper instead of direct Map writes.
  - 2026-06-02 bounded invalid-league cache guard: the invalid Sleeper league ID cache now prunes expired misses and evicts the oldest miss before exceeding `1000` entries, so broad invalid-ID probing cannot grow the negative-lookup cache unbounded. Added provider-boundary coverage proving invalid league misses prune before cache writes.
  - 2026-06-02 bounded route-limit bucket guard: the shared route limiter now caps in-process rate-limit buckets at `5000`, sweeps expired buckets on the existing interval, and evicts the oldest non-current bucket before reading/writing the current request key. Added provider-boundary coverage so the limiter map cannot grow unbounded under broad IP/scope probing.
  - 2026-06-02 bounded Sleeper league-usage cache guard: the matchup-derived league usage cache now prunes expired entries and evicts the oldest league/season summary before exceeding `80` entries, so broad valid-league probing cannot grow a cache fed by 18-week Sleeper matchup fanout. Added provider-boundary coverage proving league usage summaries write through the bounded helper instead of direct Map writes.
  - 2026-06-02 bounded player-headshot cache guard: the server image proxy now caps binary headshot cache entries at `300` and miss-cache entries at `1000`, pruning expired entries and evicting oldest entries before writes. Extended provider-boundary coverage so headshot route work stays cache-first/rate-limited and image proxy writes stay bounded.
  - 2026-06-02 bounded NFL.com headshot lookup cache guard: the legacy NFL.com headshot fallback now caches by normalized player slug, expires entries after 24 hours, and evicts oldest hits/misses before exceeding `500` entries, preventing broad player-name probes from retaining unbounded lookup results. Added unit coverage proving normalized-name cache reuse and old missing-player eviction.
  - 2026-06-02 bounded Sleeper season-stats cache guard: the stored/live Sleeper season stats cache now prunes expired entries and evicts the oldest season/week payload before exceeding `64` entries, preventing full-stat provider payloads from accumulating across broad season/week loads. Added unit coverage proving older season stats are refetched after eviction while newest entries stay cached.
  - 2026-06-02 season-game-log scoring cache guard: `players.seasonGameLog` now reuses a short-lived bounded league scoring-settings cache before fetching Sleeper league metadata, reducing repeated detail-modal provider work for the same league while keeping route access/rate-limit guards first.
  - 2026-06-02 bounded player-value timeline shard cache guard: the historical value timeline shard cache now evicts oldest shard hits/misses before exceeding `128` entries, preventing broad player-name probes or changing shard directories from retaining unbounded missing-shard cache rows. Added unit coverage proving an evicted missing shard is reread after broad shard probing.
  - 2026-06-02 bounded redraft value timeline shard cache guard: the redraft player-value timeline shard cache now evicts oldest shard hits/misses before exceeding `128` entries, preventing changing shard directories or broad redraft player-name probes from retaining unbounded missing-shard cache rows. Added unit coverage proving an evicted missing redraft shard is checked again after broad directory probing.
  - 2026-06-02 hidden Sleeper import signal cap: the parked hidden trade-center import path still stays behind report access, IP/league rate limits, invalid-league caching, and response-byte caps, and now also bounds derived stored/returned trade and waiver signals from a single import while preserving raw transaction counts. Verified with `pnpm exec vitest run server/userLoadProviderBoundary.test.ts` (`22` passed).
  - 2026-06-02 league-rank invalid-fanout guard: `league.getUserLeagueRanks` now filters invalid or cached-invalid league IDs before loading the full Sleeper player index or KTC value blends, so broad invalid league probes return null rank rows without triggering expensive rank enrichment work. Extended provider-boundary coverage for the valid-missing filter.
  - 2026-06-02 league-rank lazy-player-index guard: `league.getUserLeagueRanks` now waits until a valid-looking league returns Sleeper league metadata before loading the shared player index, so nonexistent valid-format league probes can be marked invalid without paying the full player-index cost. Extended provider-boundary coverage for the provider-call order.
  - 2026-06-02 Sleeper username negative-cache guard: repeated not-found Sleeper username lookups now reuse a short-lived bounded miss cache after the route limiter and before Sleeper provider fetches, while successful lookups clear the miss cache. Extended provider-boundary coverage for the miss-cache read/write order and cache bound.
- [ ] Before charging users or marketing the product publicly, complete legal/product readiness: Terms, Privacy Policy, Refund/Cancellation Policy, data-source disclosures, paid-feature entitlement checks, usage limits, Stripe webhook verification, and support/contact path.
  - 2026-06-02 first legal route pass: added public `/terms`, `/privacy`, `/refunds`, `/data-disclosures`, and `/support` pages, linked them from home/report footers, and documented current launch boundaries for no paid self-serve product, no betting use, provider/source freshness limitations, user verification expectations, privacy/data handling, refund/cancellation prerequisites, support routing, and no provider affiliation. This does not close the legal/product gate because Stripe checkout, webhook verification, entitlement enforcement, usage limits, production billing QA, and legal review are still required before charging users. Verified with `PLAYWRIGHT_PORT=3149 pnpm exec playwright test tests/e2e/home.spec.ts --project=desktop-chrome -g "renders public legal and product policy pages"` and `pnpm run check`.
- [ ] After every active `todo.md` item is checked off, run a full Lighthouse pass against the production-built local app and keep fixing performance, accessibility, best-practices, and SEO issues until the app scores 100 in every category or every remaining non-100 item has a documented product/technical exception.
- [ ] After the Lighthouse score push, run a full code cleanup pass for unused files, dead components, unused exports, unused styles, stale scripts, obsolete design inputs, old audit artifacts, and retired data-source code; delete what is no longer used and verify build, typecheck, tests, and rendered routes afterward.
- [ ] After cleanup, run a full extensive SEO pass covering titles, descriptions, canonical URLs, Open Graph/Twitter cards, structured data, sitemap/robots, crawlability, Core Web Vitals, semantic landmarks, heading hierarchy, internal linking, image alt text, social share previews, and fantasy-football keyword positioning.

## Premium UX / Three.js Roadmap

- [x] Bring the Owner Intel / AI Tron readout grid up to the `best.png` reference quality: flowing circuit-board light paths around each tile, distinct per-card routing, cyan/orange node glow, stronger edge/corner rails, clean readable text lanes, and a full-width Dynasty AI Notes bottom rail with connected mini-modules that feels like one powered PCB system instead of separate generic cards.
- [x] Rebuild the loading and report-generated modals as true Three.js scenes, not just CSS polish. Target a premium fantasy-football command-center feel: a cinematic 3D football fly-by on a real low-to-high arc, a depth-field loading stage, a textured league-logo coin/medallion, and a physical `REPORT GENERATED` stamp slam with ripple shockwaves, subtle camera thud, light sweep, and restrained glow.
- [x] Revisit the full-screen `SuccessTakeover` report-generated modal after the mobile crash is resolved. It is temporarily removed from the live render path; before re-enabling it, consolidate it with the existing loading-dialog success card so users only see one report-generated experience, avoid `RectAreaLightUniformsLib`/`rectAreaLight` mobile failures, add a non-WebGL fallback, and verify with mobile Playwright screenshots.
- [x] Keep the experience responsive and production-safe: code-native readable text/actions, desktop/tablet/mobile framing, reduced-motion fallback, graceful non-WebGL fallback, and no blocking of report generation if the 3D scene fails.
- [x] Add visual QA coverage for the modal rebuild with Playwright screenshots and canvas checks across desktop and mobile viewports so the animation is nonblank, correctly framed, and visibly 3D before shipping.
- [ ] Evaluate a subtle Three.js command-center backdrop for the generated report shell: layered 3D field/grid depth, premium tron-line movement, light sweeps, and parallax that make the report feel alive without reducing table readability or hurting scroll performance.
- [ ] Upgrade player detail moments with restrained 3D depth where it adds signal: player/value medallion, confidence ring, market-movement pulse, and source-weight orbit that visually explains why the AI read is high or low confidence.
- [ ] Explore Three.js reveal treatments for high-value intelligence modules such as Waiver Intelligence, Trade War Room, Weekly Momentum, and Rankings: small 3D radar/scanner/market-map scenes that support the data instead of replacing it.
- [ ] Add an admin-only Three.js source-health cockpit concept for dynamic valuation trust: source nodes, drift warnings, confidence changes, and dynasty/redraft weight movement shown as an interactive 3D map for quick anomaly spotting.
- [ ] Build any Three.js expansion behind a shared lazy-loaded scene layer with strict performance budgets, feature flags, reduced-motion/static fallbacks, and mobile battery/GPU checks before enabling it broadly.

## Data Operations Roadmap

- [ ] After the Vercel CPU patch deploys, use [docs/vercel-function-cpu-runbook.md](docs/vercel-function-cpu-runbook.md) to review `vercel-functions-fluid-cpu-duration`, identify the top CPU routes, and decide whether cron warming, cached report opens, rankings endpoints, or dynamic-data refresh need the next reduction pass.
- [x] Add a unified read-only operations readiness command: `pnpm audit:operations-readiness` to produce a single freshness, coverage, source-health, and provider-telemetry snapshot in one run.
- [x] Add a Neon/Postgres transfer audit command that reports largest tables, largest JSON payload rows, recent `leagueReportCache` sizes, snapshot payload sizes, and recent source-health volume.
- [x] Run the Neon transfer audit with production `DATABASE_URL` and record the main transfer drivers.
- [x] Add transparent compression for large `leagueReportCache` payloads and a one-off compaction command for existing heavy cache rows.
- [x] After the compaction command runs against production, re-run `pnpm audit:neon-transfer` and confirm the 18 MB `league-rankings-v11` rows are reduced.
- [x] Add a dry-run stale `leagueReportCache` cleanup command that keeps current report/rankings cache versions, prints only row metadata and payload size, and requires explicit confirmation before deletion.
- [x] Run `pnpm cleanup:league-report-cache` against production, review the stale cache rows, and delete approved stale cache rows.
- [x] Run one-off source-health history backfill with `ENABLE_SOURCE_HEALTH_BACKFILL=true` after production cached reports exist; production scan found no eligible cached-report diagnostics to backfill.
- [x] Add and run an expired `leagueReportCache` cleanup mode for rows older than the serving TTL.
- [x] Run `pnpm audit:neon-transfer` (2026-05-28): DB growth/radio-topography snapshot (`playerValueSnapshots` ~907 MB, `leagueReportCache` ~205 MB, `playerValueSnapshots` is clear highest transfer/size driver candidate).
- [x] Align browser report cache with the server cache and avoid the extra `league.rankings` request when the loaded report already includes rankings.
- [x] Switch interactive value/ranking generation to latest stored source snapshots so normal report/ranking/rank lookup loads do not call KTC, FantasyCalc, DynastyProcess, Flock, DynastyNerds, FantasyNerds, FantasyPros dynasty/devy, or redraft ranking providers.
- [x] Move remaining non-Sleeper report enrichments to provider snapshots: FantasyPros news, ESPN depth charts, and DraftSharks/SOS now refresh through dynamic-data jobs and read stored snapshots during user-triggered report/player-detail loads.
- [x] Move static Sleeper season stats and historical availability reads to persisted nightly snapshots so normal report loads only live-check current league state, transactions, drafts, trends, matchups, and player index changes.
- [x] Add a user-load provider boundary guard: report/ranking/player-detail loads use live Sleeper current-state calls only, non-Sleeper reads share snapshot-mode options, and tests block accidental live FantasyPros/OpticOdds/etc. calls during user loads.
- [x] Add scoped provider telemetry for the user-load boundary so admin diagnostics separate sanitized Sleeper user-load calls from cron/admin provider refreshes without logging raw payloads, tokens, or league IDs.
- [x] Add source freshness diagnostics for every snapshot-backed provider in the admin/report payload: source key, snapshot key, updated time, row count, payload size, stale/missing status, and last job error where available.
- [x] Add report-payload auditing and transfer slimming for cached league reports: local cache payloads can be measured by section, duplicate embedded `playerDetails` are compacted when `playerDetailsById` already carries that player, and cache metadata can be checked without reading full payloads.
- [x] Reduce rankings transfer by dropping duplicate legacy ranking arrays from transfer/cache payloads and compacting repeated prospect profile details in ranking rows while preserving full prospect detail through the Draft Buzz scoreboard copy.
- [x] Reduce transfer further with ranking metadata/detail endpoints: normal rankings loads now fetch metadata first, then load only the active ranking profile or prospect archive detail when the UI opens it.
- [x] Reduce transfer further with tighter cache TTL/retention and expanded metadata-only cache/status reads: report-cache TTL is configurable, local file-cache fallbacks prune expired/overflow entries, expired cleanup follows the serving TTL by default, and `league.reportCacheStatus` reads freshness metadata without hydrating full payloads.
- [x] Split generated report inputs into Sleeper-current-state and snapshot-backed static sections: `league.analyze` still refreshes live Sleeper league/users/rosters/transactions/drafts/trends/matchups, while cached static inputs reuse nightly-backed values, weekly baselines, FantasyPros news, DraftSharks/SOS, and prospect context.
- [x] Split generated report output sections further so fully static rendered sections can be reused across login refreshes, while mixed sections recompose from fresh Sleeper state plus cached static inputs. First pass caches all-player schedule profiles and source-freshness diagnostics while roster, transaction, waiver, matchup, draft, and standings sections still rebuild from live Sleeper reads.
- [x] Add a report hotspot audit command so the next output-cache split is evidence-based: `pnpm audit:report-hotspots` ranks cached report sections by payload size, nested field-size hotspots, item counts, section class, and optional `league.analyze` timing-log aggregates without printing payload values.
- [x] Split `playerDetailsById` static enrichment into a cache keyed by value profile, season window, and player-set signature: live base player details still come from fresh Sleeper player index plus `rosterStatusByPlayerId`, while cached enrichment overlays value profile, prospect profile, availability/history, latest news, schedule, league usage, and similar-trade values.
- [x] Continue splitting report output caches by section after measuring payload and compute hotspots: recursive transfer/cache slimming now has explicit regression coverage for nested player arrays inside `managerRosterIntelligence`, `managerPositionCounts`, `draftPicks`, and trade-table-like rows so those sections keep using `playerDetailsById` as the canonical full-detail source.
- [x] Confirm production rights/terms for FantasyPros before treating it as a primary paid/API data source.
- [x] Keep Fantrax out of the blend until we confirm a stable API or approved integration path.
- [x] Revisit KeepTradeCut trade-database access later; only integrate it if we can get a stable, approved data path instead of a brittle scrape.
- [x] Confirm whether DraftSharks partner REST API/docs require a partner login or API key, and whether access is only available through their affiliate/control-panel workflow.
- [x] Add an approved-access DraftSharks SOS integration shell behind server-only feature flags without scraping public DraftSharks pages.
- [x] On May 14, 2026, run the projections/SOS rollout checklist below before wiring any schedule-dependent feature to live data: current implementation keeps the approved schedule path to Sleeper current-state plus stored NFL bye-week/DraftSharks SOS snapshots, with projection-driven features still blocked until rights/freshness are validated.
- [ ] Configure `SOURCE_HEALTH_ALERT_WEBHOOK_URL` for Slack/email/webhook alert delivery in production.
- [ ] Calibrate player value confidence thresholds after enough 2026 source snapshots, trades, waivers, and injury/news events accumulate.
- [x] Document a single-key leak response plan for API providers that will not rotate/reissue keys, including immediate disable steps, deploy rollback steps, and local/prod secret audit steps.
- [x] Add backend API provider telemetry foundation showing call volume, failures, 429s, cache hit rate, and highest-cost jobs by provider.
- [x] Add an admin-only API budget and rate-limit dashboard UI backed by provider telemetry.
- [x] Add a new-source probation rule: every new API/feed starts at low effective weight until it has enough stable snapshots, healthy row counts, and acceptable source-consensus drift.
- [x] Add snapshot replay/regression tests that run old stored snapshots through current blend logic and flag unexpected value, rank, or source-weight changes.

## Monetization / Auth Roadmap

- [x] Keep the public funnel low-friction: allow unauthenticated users to run a limited free Sleeper report before asking them to create an account.
- [x] Define the first pricing model before building billing gates: Free, Pro, League Pass, and Elite tiers.
- [ ] Add passwordless email magic-link auth for normal users, reusing the existing first-party `users` table and session-cookie flow instead of introducing password storage.
  - 2026-06-02 magic-link auth scaffold: added hashed-at-rest magic-link token persistence schema, token generation/consume helpers, `auth.requestMagicLink`, and `auth.consumeMagicLink`. The flow normalizes email addresses, stores only token hashes, enforces 15-minute expiry, uses timing-safe hash comparison, atomically rejects replayed tokens, validates redirects to first-party relative paths, upserts normal users into the existing `users` table, and issues the existing session cookie after consumption. This does not close passwordless auth until transactional email delivery, production env configuration, UI wiring, and production QA are complete.
  - 2026-06-02 magic-link email delivery scaffold: `auth.requestMagicLink` now sends configured transactional email, marks delivery as `sent`, keeps non-production `devToken` behavior, and fails closed in production before token creation when email delivery is not configured. Remaining passwordless-auth work: UI request/consume flow, production env configuration, real-domain email QA, and production sign-in QA.
  - 2026-06-02 magic-link request rate-limit guard: `auth.requestMagicLink` now uses the shared route limiter before token creation, DB persistence, or email send, reducing abuse risk for passwordless auth while the full UI remains parked. Added route-order coverage proving the limiter stays before writes and outbound delivery.
  - 2026-06-02 magic-link recipient rate-limit guard: `auth.requestMagicLink` now also applies a hashed-email recipient limiter before token creation, DB persistence, or email delivery, so one inbox cannot be repeatedly targeted even when requests are not all sharing the same ordinary route bucket. Extended route-order coverage for the recipient limiter.
  - 2026-06-02 magic-link consume rate-limit guard: `auth.consumeMagicLink` now rate-limits sign-in attempts after production JWT precondition checks but before token-hash DB lookups, token consumption, user upserts, or session-cookie issuance. Added route-order coverage for the consume path.
  - 2026-06-02 magic-link consume recipient rate-limit guard: `auth.consumeMagicLink` now also applies a hashed-email recipient limiter after the JWT precondition and before token-hash DB lookup, token consumption, user upsert, or session-cookie issuance, reducing distributed guessing pressure against one inbox. Extended consume route-order coverage for the recipient limiter.
- [ ] Add a transactional email provider for magic links, billing notifications, and later alert delivery; keep provider keys server-side only.
  - 2026-06-02 Resend transactional email scaffold: added a server-only fetch adapter for Resend `POST /emails`, `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_FROM`, optional reply-to, first-party magic-link URL generation, HTML/text magic-link content, idempotency keys based on magic-link token IDs, sanitized provider failures, and production `APP_BASE_URL` fail-closed behavior. This does not close the broader provider item until billing notifications, alert templates/events, production domain verification, and deliverability QA are complete.
  - 2026-06-02 billing notification email slice: added sanitized payment-failed and subscription-canceled email builders/senders with billing-event idempotency keys. Stripe webhooks now attempt those notifications only after billing persistence succeeds and only when customer email, email delivery, and `APP_BASE_URL` are configured; notification failures are logged without failing webhook handling. Remaining work: production domain/deliverability QA, billing email copy review, and later alert templates/events.
- [ ] Add account-linking support so a signed-in user can save Sleeper usernames, favorite leagues, recent reports, and notification preferences.
  - 2026-06-02 account-linking backend scaffold: added account tables, idempotent schema bootstrap, migration SQL, DB helpers, and protected `account.*` tRPC procedures for saved Sleeper accounts, favorite leagues, recent reports, and notification preferences. Writes are scoped to the signed-in `ctx.user.openId`, client input cannot choose another account owner, production fails closed without `DATABASE_URL`, and failed persistence does not report a successful save. This does not close the item until the UI is wired, production migration execution is verified, and signed-in account QA proves these records are visible and reusable.
  - 2026-06-02 account-link read rate-limit guard: protected `account.links` now uses a signed-in-user scoped route limiter before saved Sleeper account, favorite league, recent report, and notification preference reads, so the parked account backend cannot be polled as an unbounded DB fanout. Added route-order coverage for the read path.
- [ ] Add Stripe checkout for individual subscriptions, league passes, and one-time seasonal products such as a rookie draft kit or redraft draft kit.
  - 2026-06-02 Stripe checkout scaffold: added authenticated `billing.createCheckoutSession` plus server-only Checkout Session helper coverage for Pro, Elite, League Pass, rookie draft kit, and redraft draft kit product keys. Checkout fails closed without `STRIPE_SECRET_KEY`, the relevant server-side price env var, and production `APP_BASE_URL`; it attaches app metadata to Checkout Sessions and subscription/payment objects, reuses linked Stripe customers when available, requires league IDs for League Pass, and normalizes return paths to first-party relative URLs. Remaining work: configure real Stripe products/prices, wire frontend upgrade/purchase entry points, connect persisted paid entitlements to access checks, and run live Stripe QA.
  - 2026-06-02 billing route rate-limit guard: the parked authenticated checkout and customer-portal procedures now share a signed-in-user scoped route limiter before billing persistence checks, customer lookups, or Stripe session creation. Added route-order coverage so the backend scaffold cannot become an unbounded Stripe/DB call surface while UI/payment launch remains parked.
- [ ] Add Stripe customer portal support so users can self-serve payment updates, cancellations, and plan changes.
  - 2026-06-02 Stripe customer portal scaffold: added authenticated `billing.createCustomerPortalSession` plus server-only Billing Portal Session helper coverage. Portal creation requires an existing persisted Stripe customer, production `APP_BASE_URL`, and server-side Stripe credentials; it supports optional portal configuration IDs and first-party return URLs. Remaining work: configure Stripe portal settings, expose the account/billing UI entry point, and production-test subscription cancellation/plan-change webhook feedback into entitlements.
- [ ] Add Stripe webhook handling for subscription created, updated, canceled, payment failed, and one-time purchase completed events.
  - 2026-06-02 webhook verification scaffold: added `/api/billing/stripe-webhook` in local and Vercel Express entrypoints with raw-body Stripe HMAC verification, timestamp tolerance checks, missing-secret fail-closed behavior, JSON parsing only after signature verification, and supported event recognition for checkout/session, subscription create/update/delete, and payment-failed events.
  - 2026-06-02 webhook-to-DB scaffold: verified checkout, subscription lifecycle, and failed-invoice events now parse app metadata, fail closed with `422` when required billing metadata is missing, retry with `503` when DB upserts fail, upsert billing customers, upsert subscription status/plan/price/product/current-period/cancel-at-period-end fields for `customer.subscription.created`, `updated`, and `deleted`, and mark failed-invoice subscriptions `past_due`. Remaining work: configure real Stripe products/prices/webhook secret, guarantee checkout/subscription metadata is present, and production-test live Stripe webhook delivery.
  - 2026-06-02 one-time checkout entitlement scaffold: extended `checkout.session.completed` handling so League Pass purchases upsert a `leaguePasses` row plus league-scoped source trace, AI confidence history, and export entitlements, while rookie/redraft draft kit purchases upsert user-scoped `draft-kit-tools` entitlements. Missing purchase metadata still fails closed with `422`, persistence failures return retryable `503`, and subscription checkout continues to rely on subscription lifecycle events for plan access. Remaining work: live Stripe QA, product/price configuration, production DB verification, and connecting access checks to persisted league/user entitlement rows.
  - 2026-06-02 webhook billing-email slice: payment-failed and subscription-deleted events now trigger non-blocking transactional notifications when Stripe supplies a customer email and email/app-base-url configuration is present. Email provider failures are logged but do not convert successful billing persistence into Stripe retries. Remaining work: live Stripe QA, product/price configuration, production DB verification, and customer-facing billing UI.
- [ ] Add billing and entitlement tables for `billingCustomers`, `subscriptions`, `leaguePasses`, `featureEntitlements`, and `usageEvents`.
  - 2026-06-02 billing schema scaffold: added Drizzle schema entries, idempotent DB bootstrap DDL, and migration SQL for billing customers, subscriptions, league passes, feature entitlements, and usage events. This does not close the item until Stripe webhook upserts, customer portal/checkout flows, production migration execution, and read/write helpers for persisted entitlements are wired and verified.
  - 2026-06-02 billing persistence helper scaffold: added server DB helpers for billing customer upserts, subscription upserts, subscription reads by user, billing customer lookup by user, idempotent usage-event writes, usage-event counting, active feature-entitlement reads, and active league-pass reads. Local tests cover no-database fail-safe behavior and required identifier validation. Remaining work: production migration execution, live DB verification, and wiring each paid surface to the shared persisted access helper.
  - 2026-06-02 league-pass/entitlement persistence helper scaffold: added update-first helpers for `leaguePasses` and `featureEntitlements`, active user/league feature-entitlement reads, active league-pass reads, no-database fail-safe behavior, and required subject/league/user identifier validation. Remaining work: production migration execution, live DB verification, and wiring each paid surface to the shared persisted access helper.
- [ ] Enforce paid access on the backend with a shared entitlement helper such as `canUseFeature(user, feature, leagueId)`; frontend paywalls should only be UX hints.
  - 2026-06-02 entitlement helper scaffold: added server-side `canUseFeature` / `assertCanUseFeature` policy coverage for free reports, monthly roster blueprints, paid feature keys, and admin diagnostics. The helper fails closed for paid features until `ENABLE_PAID_FEATURES=true`, is wired into public report access and monthly blueprint quota checks, and is covered by `server/featureEntitlements.test.ts` plus the existing monthly quota tests. This does not close the item until Stripe/billing tables provide real user plans, league passes, entitlement overrides, and persisted usage records.
  - 2026-06-02 subscription-plan read scaffold: `canUseFeature` can now derive the highest active `pro`/`elite` plan from subscription records while still failing closed until paid features are enabled. Billing subscription rows cannot grant `admin`; admin diagnostics remain role-only. Remaining work: wire each paid surface to the shared persisted access helper, production DB verification, and real paid/free boundary QA.
  - 2026-06-02 persisted-entitlement access scaffold: `canUseFeature` now accepts active persisted user/league feature-entitlement rows and active league-pass rows, grants matching paid features only after `ENABLE_PAID_FEATURES=true`, respects league scope for League Pass entitlements, ignores future/expired/inactive rows, and still blocks admin diagnostics from persisted billing records. Added `loadPersistedFeatureAccess`, `canUsePersistedFeature`, and `assertCanUsePersistedFeature` to load subscription, entitlement, and league-pass records through one shared path; monthly blueprint checks remain on the existing free reservation path to avoid unnecessary paid-access DB reads on a free quota gate. Remaining work: wire each high-value paid UI/API surface to that helper, production DB verification, and real paid/free boundary QA.
- [ ] Add usage limits by tier, including reports per day, saved leagues, saved reports, alert count, export access, and source-trace visibility.
  - 2026-06-02 usage-limit scaffold: the entitlement policy now documents the active one-monthly-blueprint limit and preserves the existing persisted monthly quota check. Remaining limits still need tier-specific persisted `usageEvents` for daily reports, saved leagues/reports, alerts, exports, and source-trace visibility.
  - 2026-06-02 persisted usage-event scaffold: added idempotent `usageEvents` recording, quantity-summed counting helpers, reusable usage window/key/limit utilities, and monthly roster blueprint usage-event recording for successful new monthly reservations. The current monthly quota still uses the proven reservation table as the enforcement source; remaining work is to enforce tier-specific daily reports, saved leagues/reports, alerts, exports, source trace visibility, and paid/free boundaries from persisted usage events.
  - 2026-06-02 tier usage-policy scaffold: added a shared server-side usage-limit module for daily report generation, saved leagues, saved reports, source-trace views, exports, and anomaly alerts. The module derives active billing plan from persisted subscriptions, requires paid entitlements for paid usage surfaces, applies League Pass grants to league-scoped export/source-trace quotas, builds idempotent `usageEvents`, and fails production writes closed when usage persistence is unavailable. Remaining work: wire exact route/resource enforcement one surface at a time, with saved league/report limits based on current saved-resource counts rather than append-only events alone.
  - 2026-06-02 saved account resource limit slice: wired protected account routes so new saved favorite leagues and recent report records respect Free/Pro/Elite saved-resource caps from persisted subscriptions, while updates to already-saved records remain allowed. Remaining work: enforce daily report, alert, export, source-trace, and other high-value surface limits one route at a time.
  - 2026-06-02 report payload paid-data gate: `league.analyze` now sanitizes cached and fresh report responses before returning them, removing nested `sourceTrace` / `traceSummary` details unless the caller has `source-trace-details`, and removing `leagueDiagnostics.aiConfidence.history` unless the caller has `ai-confidence-history`. The cache can retain full server data, but response shaping happens per caller so cached reports do not bypass paid-access checks. Remaining work: wire export, alert, daily-report, and other high-value route limits.
  - 2026-06-02 source-trace text paid-data guard: the report access sanitizer now treats `sourceTraceText` as source-trace detail alongside `sourceTrace`, so future projection/readout trace text cannot bypass paid-data stripping or source-trace view usage accounting if it enters cached report payloads.
  - 2026-06-02 signed-in fresh report usage slice: `league.analyze` now checks the persisted `report-generation` daily quota for signed-in users before uncached live report generation and records a `usageEvents` row only after a successful fresh cache miss. Cached hits stay free, and anonymous users remain protected by existing IP/league generation throttles while full account linking is parked. Verified with route-boundary coverage and `pnpm run check`.
  - 2026-06-02 analyze view IP-wide rate guard: `league.analyze` now runs an IP-wide view limiter before the existing league-scoped view limiter, cache lookup, live-activity attachment, and fresh-generation path. The stricter fresh-generation IP/league limiters and signed-in usage check remain after cache miss and before live Sleeper report-generation work, so broad league-ID probing cannot multiply cached report-open work across many IDs.
  - 2026-06-02 anomaly alert preference gate: protected account notification preferences now require `anomaly-alerts` feature access before enabling anomaly alerts, while ordinary preference updates and disabling anomaly alerts remain allowed. Free users fail closed until paid features launch; launched elite users can enable the flag through persisted subscription access. Verified with account router coverage and `pnpm run check`.
  - 2026-06-02 source-trace view usage slice: paid `league.analyze` responses now check and record `source-trace-view` usage when retained `sourceTrace` / `traceSummary` fields are actually returned, so cached report hits cannot bypass the daily source-trace quota. Free/unlaunched callers still receive sanitized payloads without usage writes. Remaining work: export, alert, and other first-class paid route gates.
  - 2026-06-02 AI prediction telemetry payload guard: protected `aiPredictions.upsertMany` now validates bounded source-agreement receipts and rejects individual prediction events over 64 KB before persistence, so signed-in clients cannot use telemetry writes to store arbitrary nested payloads. Verified with router coverage for normal events, oversized metadata, and excessive source-agreement signals.
  - 2026-06-02 AI prediction telemetry league-id input guard: protected `aiPredictions.upsertMany` now uses the shared Sleeper league ID schema for event league IDs, so malformed league identifiers are rejected before telemetry persistence.
  - 2026-06-02 AI prediction telemetry rate-limit guard: protected `aiPredictions.upsertMany` now runs through the shared route rate limiter before persistence, scoped by signed-in user key and client IP, so repeated telemetry batches cannot create an unbounded DB write path. Added route-boundary coverage to keep the rate-limit guard attached to the mutation.
  - 2026-06-02 AI prediction outcome update rate-limit guard: protected `aiPredictions.updateOutcome` now uses the same signed-in user/IP route limiter before DB writes, so manual/system outcome feedback cannot become a separate unbounded write path. Extended route-boundary coverage across both prediction write mutations.
  - 2026-06-02 AI prediction history read rate-limit guard: protected `aiPredictions.list` now uses the shared signed-in user/IP route limiter before reading stored prediction history, so the prediction-memory DB surface is guarded on writes and reads. Route-boundary coverage now checks all three prediction-history endpoints.
  - 2026-06-02 AI prediction history league-id input guard: protected `aiPredictions.list` now uses the shared Sleeper league ID schema for optional league filters, so malformed league identifiers are rejected before prediction-history DB reads.
  - 2026-06-02 player news lookup guard: `players.latestNews` now requires report access and uses a scoped route rate limit before snapshot-backed player-news lookups, aligning it with the adjacent value timeline and season-log player-detail routes. Added user-load boundary coverage proving access and rate checks happen before news retrieval.
  - 2026-06-02 player headshot cache-miss guard: `images.playerHeadshot` now validates bounded player IDs/names and rate-limits cache-miss provider/prospect work while preserving free cached-image hits. Added route-boundary coverage proving cache reads happen before the limiter and external image/prospect work happens after it.
  - 2026-06-02 player headshot IP-wide rate guard: `images.playerHeadshot` now runs an IP-wide limiter before the player-scoped cache-miss limiter, so broad player-ID probing cannot multiply image provider/prospect work across many IDs while cached image hits remain free. Extended route-boundary coverage to keep both limiters after cache reads and before miss work.
  - 2026-06-02 action-plan history read guard: protected legacy `actionPlans.list` and `actionPlans.listWaiverBidHistory` now use signed-in user/IP route limits before DB reads, so action-plan and waiver-bid history cannot be polled unbounded. Added route-boundary coverage for both read paths.
  - 2026-06-02 action-plan league-id input guard: protected legacy action-plan and waiver-bid history reads now use the shared Sleeper league ID schema, so malformed league identifiers are rejected before DB history lookups.
  - 2026-06-02 league-rank fanout guard: `league.getUserLeagueRanks` now accepts at most 10 league IDs per call, and the home league-intel hook requests only the next missing rank/anchor batch instead of every returned league at once. This preserves cached league enrichment while bounding Sleeper roster/user/value fanout per request. Added client batching coverage and server route-boundary coverage.
  - 2026-06-02 league-rank concurrency guard: server-side league-rank enrichment now processes the bounded batch with a concurrency cap of 3 instead of firing every league fanout at once, further reducing concurrent Sleeper roster/user/value work during login enrichment. Extended boundary coverage to keep the concurrency limiter attached.
  - 2026-06-02 league-rank access-boundary guard: `league.getUserLeagueRanks` now runs through shared report access before the rate-limited Sleeper/user/value fanout, so future report-auth or free-report entitlement policy applies consistently to the multi-league enrichment path without requiring full account-linking UI.
  - 2026-06-02 hidden Sleeper import access guard: `league.importSleeperTradeCenter` now requires report access before rate-limited hidden-token import work, live Sleeper validation, and hidden snapshot writes. Added boundary coverage so the token-backed import route stays behind access and rate checks.
  - 2026-06-02 hidden Sleeper import response-size guard: the hidden trade-center GraphQL import now rejects declared or decoded response bodies over 5 MB before JSON parsing or signal construction, keeping the token-backed import from becoming an oversized payload parse/store path. Extended boundary coverage to keep the size checks ahead of parsing.
  - 2026-06-02 hidden Sleeper import IP-wide rate guard: `league.importSleeperTradeCenter` now runs an IP-wide limiter before the league-scoped limiter, so broad league-ID/token probing cannot multiply the hidden import allowance across many league IDs. Extended boundary coverage to keep both limiters before validation, import work, and snapshot writes.
  - 2026-06-02 player news input-bound guard: `players.latestNews` now trims and bounds player, team, and position inputs before the access/rate-limited snapshot lookup path, while preserving empty-name no-op behavior. Extended route-boundary coverage so oversized player-news payloads stay rejected before lookup work.
  - 2026-06-02 player news IP-wide rate guard: `players.latestNews` now runs an IP-wide limiter before the player-scoped limiter, so broad player-name probing cannot multiply the news lookup allowance across many names before snapshot-backed lookup work. Extended route-boundary coverage to keep both limiters before news retrieval.
  - 2026-06-02 player value timeline boundary guard: `players.valueTimeline` and `players.redraftValueTimeline` now have route-boundary coverage proving player/profile inputs are bounded and report access plus rate limits run before snapshot/file-cache timeline work, so player-modal timeline probing stays covered by the same free-product guardrails.
  - 2026-06-02 player value timeline IP-wide rate guard: `players.redraftValueTimeline` and `players.valueTimeline` now run IP-wide limiters before their player/league-scoped limiters, so broad player-name probing cannot multiply timeline lookup allowance before redraft timeline work or stored value snapshot reads. Extended route-boundary coverage to keep both limiter layers before timeline work.
  - 2026-06-02 report-cache status metadata guard: `league.reportCacheStatus` now has route-boundary coverage proving report access and rate limits run before cache-status checks, and the status helper stays metadata-only instead of loading full cached report payloads from DB or file storage.
  - 2026-06-02 report-cache status IP-wide rate guard: `league.reportCacheStatus` now runs an IP-wide limiter before the league-scoped limiter, so broad league-ID probing cannot multiply cache metadata reads across many report keys while the helper remains metadata-only.
  - 2026-06-02 system snapshot diagnostics guard: `system.snapshotCoverage` now runs as an admin-only diagnostic instead of a public metadata read, leaving only the lightweight health probe public. Added route-boundary coverage so snapshot DB/local metadata checks do not drift back into anonymous access.
  - 2026-06-02 player season-log route-boundary guard: added coverage proving `players.seasonGameLog` checks report access and route limits before live Sleeper league scoring lookup and season log construction, keeping that player-detail work behind the same public-route cost boundary as the other detail endpoints.
  - 2026-06-02 player season-log IP-wide rate guard: `players.seasonGameLog` now runs an IP-wide limiter before the league/player-scoped limiter, so broad player or league probing cannot multiply live Sleeper league validation and season-log scoring work. Extended route-boundary coverage to keep both limiters before live work.
  - 2026-06-02 ranking detail route-boundary coverage: added regression coverage proving `league.rankings`, `league.rankingsMeta`, `league.rankingProfile`, and `league.rankingDraftBuzz` check report access and route limits before shared ranking payload construction, so ranking metadata/detail reads cannot drift into unguarded expensive work.
  - 2026-06-02 ranking detail IP-wide rate guard: `league.rankings`, `league.rankingsMeta`, `league.rankingProfile`, and `league.rankingDraftBuzz` now run IP-wide limiters before their league/profile-scoped limiters, so broad league/profile probing cannot multiply shared ranking payload work. Extended route-boundary coverage to keep both limiter layers before rankings payload construction.
  - 2026-06-02 player headshot cache-hit rate guard: `images.playerHeadshot` now runs IP-wide and player-scoped route limiters before cached base64 image reads as well as Sleeper/prospect fallback work, so hot cache hits cannot become an unlimited public payload surface. Extended route-boundary coverage to keep both limiter layers before cache reads and provider work.
- [ ] Gate high-cost or high-value features first: unlimited reports, multi-league portfolio, AI confidence history, source trace details, anomaly alerts, exports, and draft kit tools.
  - 2026-06-02 paid gate scaffold: source traces, AI confidence history, anomaly alerts, exports, draft kit tools, multi-league portfolio, and unlimited reports are represented as paid feature keys that fail closed before billing launch. Remaining work is to wire each feature surface to persisted plan/league-pass entitlements when those products are implemented.
  - 2026-06-02 source-trace/AI-history response gate: `league.analyze` now uses persisted plan, entitlement, and League Pass access to strip detailed source traces and AI confidence history from report responses for callers without access, including cached report hits. Remaining work: add first-class upgrade UX and route-level gates for exports, alerts, draft kit tools, and multi-league portfolio.
- [ ] Build a League Pass model where one purchaser can unlock a specific league for all managers or invited league members.
  - 2026-06-02 League Pass audience-policy scaffold: active league passes now default to `all-managers` access for league-scoped paid features, while existing `leaguePasses.metadata` can narrow access to `invited-members` or `purchaser-only` without a schema change. Stripe-created League Passes store `audience: all-managers`, and entitlement checks respect purchaser/invited OpenID lists when metadata requires narrower access. Remaining work: UI/admin controls for invite management, production migration/DB verification, and live League Pass checkout QA.
- [ ] Add paid-feature telemetry for conversion, trial-to-paid movement, active subscribers, MRR, churn, failed payments, report usage, and upgrade prompt performance.
- [ ] Add an admin billing board for active plans, failed payments, entitlement overrides, revenue metrics, and suspicious usage.
  - 2026-06-02 admin billing overview backend scaffold: added an admin-only `system.billingOverview` procedure backed by billing aggregate helpers for customers, active/failed subscriptions, League Passes, feature entitlements, entitlement overrides, recent subscription rows, and usage by feature over a bounded lookback. The route returns an empty safe overview when DB persistence is unavailable, and mock-Neon coverage now proves aggregate row mapping for populated billing tables. Remaining work: build the admin UI board and verify production billing tables after migration.
- [ ] Add legal/compliance pages before charging: Terms, Privacy Policy, Refund/Cancellation Policy, and data-source disclosures.
- [x] Do not use personal/non-commercial API keys inside paid/public feature outputs unless we have provider approval or a commercial license for that source.
- [ ] Add tests for auth token expiry, magic-link replay protection, webhook signature verification, entitlement checks, usage limits, and paid/free report boundaries.
  - 2026-06-02 entitlement test slice: added unit coverage for anonymous free report access, monthly blueprint limit metadata, paid-feature fail-closed behavior before billing launch, pro/elite plan checks when billing is enabled, and admin diagnostics access. Remaining tests: auth token expiry, magic-link replay protection, Stripe webhook signature verification, persisted usage events, and real paid/free report boundaries.
  - 2026-06-02 auth expiry test slice: added coverage proving an expired session JWT is treated as an anonymous public request instead of authenticating the user. Remaining tests: magic-link replay protection, Stripe webhook signature verification, persisted usage events, and real paid/free report boundaries.
  - 2026-06-02 Stripe webhook signature test slice: added HMAC verifier coverage for valid signatures, signature mismatch, stale timestamps, missing secrets, invalid JSON after verification, supported billing events failing closed before DB upserts, and ignored unsupported events. Remaining tests: magic-link replay protection, persisted usage events, webhook-to-DB upserts, and real paid/free report boundaries.
  - 2026-06-02 magic-link replay test slice: added coverage for normalized email handling, hashed token storage, first-party redirect validation, stable email-derived user IDs, one-time consumption, replay rejection after `consumedAt`, expiry rejection, token mismatch rejection, invalid email rejection, request-route persistence, production raw-token suppression, consume-route user/session issuance, replay race rejection, and production JWT precondition checks. Remaining tests: persisted usage events, webhook-to-DB upserts, real paid/free report boundaries, email-provider delivery, and UI-level magic-link flow.
  - 2026-06-02 usage-event test slice: added coverage for usage day/month/season windows, usage keys, deterministic idempotency IDs, defensive quantity totals, limit remaining/blocked calculations, and monthly blueprint usage-event recording only on new successful reservations. Remaining tests: webhook-to-DB upserts, real paid/free report boundaries, email-provider delivery, and UI-level magic-link flow.
  - 2026-06-02 billing persistence test slice: added DB-unavailable and input-validation coverage for billing customer upserts, subscription upserts, subscription reads, usage-event recording, and usage-event counting. Remaining tests: live/mock SQL success paths, webhook-to-DB upserts, tier usage-limit enforcement, real paid/free report boundaries, email-provider delivery, and UI-level magic-link flow.
  - 2026-06-02 webhook-to-DB test slice: added Stripe webhook coverage for subscription upserts, canceled subscription status, failed invoice `past_due` status, checkout customer upserts, missing billing metadata fail-closed behavior, retryable DB persistence failures, signature failures, stale timestamps, missing secrets, invalid JSON, and ignored unsupported events. Remaining tests: live Stripe/DB QA, tier usage-limit enforcement, real paid/free report boundaries, email-provider delivery, and UI-level magic-link flow.
  - 2026-06-02 checkout/portal test slice: added server helper and router coverage for Stripe Checkout Session creation, subscription metadata, one-time League Pass metadata, existing-customer reuse, required price/secret config, sanitized Stripe API failures, Billing Portal Session creation, auth requirements, billing-customer lookup, first-party return path normalization, and missing-customer fail-closed behavior. Remaining tests: live Stripe/DB QA, tier usage-limit enforcement, real paid/free report boundaries, email-provider delivery, UI-level billing entry points, and UI-level magic-link flow.
  - 2026-06-02 one-time entitlement webhook test slice: added webhook coverage for League Pass checkout persistence into `leaguePasses` and league-scoped feature entitlements, rookie draft kit checkout persistence into user-scoped `draft-kit-tools`, retryable entitlement persistence failure, and DB-unavailable/input-validation coverage for the new league-pass/feature-entitlement helpers. Remaining tests: live Stripe/DB QA, tier usage-limit enforcement, real paid/free report boundaries, email-provider delivery, UI-level billing entry points, and UI-level magic-link flow.
  - 2026-06-02 transactional-email test slice: added coverage for Resend config detection, production fail-closed guards, app-base URL resolution, magic-link URL encoding, server-only Resend request headers/body, idempotency headers, sanitized provider failures, route-level configured delivery, production raw-token suppression, and production no-provider rejection before token persistence. Remaining tests: live Stripe/DB QA, tier usage-limit enforcement, real paid/free report boundaries, UI-level billing entry points, and UI-level magic-link flow.
  - 2026-06-02 account-linking test slice: added DB helper fallback/validation coverage and router coverage for auth requirements, account-owned Sleeper username saves, favorite league saves, recent-report recording, notification preference updates, delete scoping, account link reads, and persistence-failure rejection. Remaining tests: live Stripe/DB QA, production account-linking migration/DB verification, UI-level account linking, tier usage-limit enforcement, real paid/free report boundaries, UI-level billing entry points, and UI-level magic-link flow.
  - 2026-06-02 persisted-access test slice: added policy and loader coverage for active persisted user entitlements, league-scoped feature entitlements, active League Pass grants, launch-flag fail-closed behavior, future/expired/inactive entitlement rejection, DB fallback for active league-pass reads, and monthly blueprint compatibility with persisted access loading. Remaining tests: live Stripe/DB QA, production account-linking/billing migration verification, UI-level account linking, tier usage-limit enforcement, real paid/free report boundaries, UI-level billing entry points, and UI-level magic-link flow.
  - 2026-06-02 tier usage-limit policy test slice: added focused coverage for free daily report limits, pro unlimited daily report access from active subscriptions, paid-surface blocking without entitlements, League Pass export quota grants, idempotent limited-usage event writes, and no-write behavior when limits fail. Remaining tests: route-level enforcement for each resource/surface, live Stripe/DB QA, production account-linking/billing migration verification, real paid/free report boundaries, UI-level billing entry points, and UI-level magic-link flow.

## Source Audit / Feature Roadmap

- [x] Audit every live API, partner feed, and scrape we use today, including Sleeper, FantasyPros, DraftSharks, KeepTradeCut, Flock Fantasy, FantasyCalc, Dynasty Nerds, Fantasy Nerds, DynastyProcess, Prospect Archive / NFL Draft Buzz, ESPN prospect metadata, and any internal snapshot jobs.
- [x] For each source, document exactly what comes back: endpoint or URL, auth model, rate limits, payload shape, unique IDs, timestamps/freshness, row counts, and known gaps or failure modes.
- [x] Write down which features each source can power now vs later so we can spot unused data before adding more integrations.
- [x] Save a compact sample payload or field map per source so the team can compare feeds without needing a fresh live fetch.
- [x] Turn that audit into a source coverage matrix in admin so we can see at a glance what each API or scrape is actually returning.
- [x] Use this compact template for each source during the audit: `Source / Returns / Used now / Could power later / Open questions`.
- [x] Sleeper - Returns: league settings, rosters, players, matchups, waivers, trades, news/status, and user/player IDs. Used now: league analysis, roster intelligence, matchup preview plumbing, waiver/trade analysis, and identity matching. Could power later: schedule-week matchup reads, exposure views, alerting, and lineup guidance. Open questions: which endpoints reliably expose current-week matchup and projection context.
- [x] Research the Google query `api to get nfl player nicknames` and compare the useful fields from the results against the NFL APIs we already consider first-class so we can capture any extra nickname/alias data we are missing.
- [x] For each candidate result from that query, document whether it provides player nicknames, alternate display names, alias mappings, pronunciation hints, suffix normalization, social handles, or other identity-enrichment fields beyond our current data.
- [x] Cross-check the nickname/alias sources against the APIs already on our recommended list, including Sleeper, BALLDONTLIE, nflreadr/nflverse player-name mappings, SportsBlaze, FantasyData/SportsDataIO, Sportradar, ESPN, and any other vetted NFL endpoints.
- [x] Decide which extra fields are actually worth storing or normalizing in our player identity layer, and which ones are only nice-to-have research artifacts.
- [x] FantasyPros - Returns: rankings, projections, ADP, injuries, news, compare-players, player-points, and player/external IDs. Used now: dynasty/redraft blends, rookie and devy context, injury/news notes, player modal details, and confidence calibration. Could power later: lineup strength, value movement, matchup preview, and trade explainers. Open questions: rate limits, production terms, and which projection/news endpoints are safe to depend on.
- [ ] Audit the Dynasty Daddy player-page source selector from `https://dynasty-daddy.com/fantasy-rankings/lamarjacksonqb?league=1312139584427012096&year=2026&platform=0&userId=472986961783549952&teamId=3`, including redraft sources Fantasy Daddy, ADP Daddy, KeepTradeCut, Fantasy Navigator, Pro Football Network, and DraftSharks, plus dynasty sources Dynasty Daddy, ADP Daddy, KeepTradeCut, DynastyProcess, Fantasy Navigator, Pro Football Network, and DraftSharks. For each source, capture exact URLs or API paths if discoverable, query params, auth/terms, update cadence, row counts, player IDs, format coverage, response shape, and whether it could power valuations, ADP/value-over-cost, start/sit, waiver wire, projections or matchup reads, draft recommendations, or competitor-feature ideas. Treat the league/user/team query params and league-infused mode as research context only until privacy and redistribution boundaries are clear.
- [ ] Audit configured valuation sources that currently return 0 usable rows in admin source health, including Flock Fantasy dynasty/redraft rows, FantasyPros Dynasty, Dynasty Nerds, Fantasy Nerds, and any redraft/devy equivalents. For each zero-row source, confirm whether the gap is licensing/access, parser drift, player-ID mapping, season/window mismatch, source retirement, or an intentionally optional slot; then decide whether to populate it, leave it as an optional watchlist source, or remove it from the active blend/source configuration. Flock Fantasy devy is already confirmed unavailable and should stay out of the devy blend/watchlist.
- [ ] Audit SportsDataIO / FantasyData NFL endpoints beyond the current news snapshot path: player, team, schedule, injury, depth chart, fantasy scoring, projections, and licensed route-volume fields; decide what can safely improve lineup projections, matchup reads, downstream valuation, and draft recommendations.
- [ ] Exhaustively probe FantasyCalc's public API surface beyond current values and player history: confirm any discoverable trade, draft, rankings, player, comparison, or trend endpoints, then record exact URLs, query params, auth requirements, rate limits, response shapes, row counts, freshness, and whether each endpoint is `used now`, `could power later`, or `research only`.
- [ ] Go through NFL Draft Buzz prospect pages/data later and expand college/devy player modals with more useful fields, including production stats, athletic testing, strengths/weaknesses, scouting summary, source date, and source links.
- [x] DraftSharks - Returns: rankings, SOS, bye weeks, D/ST, matchup data, and possibly projections. Used now: source research only. Could power later: bye-week navigation, streamer planning, matchup reads, and schedule-strength tooling. Open questions: partner/API access and whether the public pages stay stable enough to trust.
- [x] DraftSharks SOS shell - Returns: approved partner REST team/position SOS rows when configured. Used now: gated backend schedule enrichment only. Could power later: streamer weeks, avoid weeks, schedule tiers, matchup reads, and D/ST planning. Open questions: final partner URL, payload shape, and production terms from DraftSharks control panel.
- [x] KeepTradeCut - Returns: trade-database rows, market values, and source metadata where available. Used now: trade/value research. Could power later: dynasty trade comps and market trend views. Open questions: whether access is stable without scraping and whether there is a supported data path.
- [x] Flock Fantasy - Returns: exposure counts, league-share data, and player ranking rows. Used now: dynasty/rookie source research. Could power later: portfolio exposure and roster concentration. Open questions: whether the exposure feed is stable enough to ingest.
- [x] FantasyCalc - Returns: dynasty/redraft value rows and source metadata. Used now: blended-value inputs and confidence support. Could power later: value trend and comparison views. Open questions: refresh cadence and source coverage details.
- [x] Dynasty Nerds - Returns: dynasty, rookie, and format-specific ranking rows. Used now: dynasty and rookie blending. Could power later: format-specific rookie draft reads. Open questions: coverage by format and source freshness.
- [x] Fantasy Nerds - Returns: rankings, projections, or diagnostic rows if available. Used now: source-coverage checks. Could power later: redraft projections and validation. Open questions: which endpoints are current and supported.
- [x] DynastyProcess - Returns: calculator outputs, dynasty values, and trade context. Used now: dynasty value blending. Could power later: trade comparison and roster value explanation. Open questions: which calculator outputs are stable and current.
- [x] Prospect Archive / NFL Draft Buzz - Returns: prospect rankings, scouting notes, draft year, college, team, and image/logo fields. Used now: devy and rookie prospect handling. Could power later: scouting detail cards and prospect comparison. Open questions: source freshness and image/logo consistency.
- [x] ESPN prospect metadata - Returns: player/team/college/external ID fields. Used now: cross-source identity matching. Could power later: better prospect/player normalization. Open questions: which IDs are reliable enough to treat as canonical.
- [x] Internal snapshots/jobs - Returns: historical values, source-health events, league snapshots, and draft records. Used now: trend analysis, backfills, diagnostics, and confidence calibration. Could power later: anomaly detection and source-history dashboards. Open questions: which historical jobs still need backfill or retention tuning.
- [x] Yahoo Fantasy - Official API exists for fantasy football league/team/player/matchup data through OAuth and application approval. Research whether it returns rankings, projected points, percent-started, roster trends, or only league-scoped fantasy data; if integrated, keep it as an opt-in platform connector and nightly snapshot source, not a normal report-load dependency. Probe script: `pnpm run probe:external-sources` checks the OAuth-gated API surface without printing payloads or credentials.
- [x] Fantrax - Investigate whether Fantrax has an approved API/partner path for football rankings, ADP, ownership, projections, or public league data. Current public docs are unofficial bindings, so do not scrape or authenticate with user cookies unless Fantrax approves a supported integration. Probe script checks only public docs and unauthenticated reachability.
- [x] FFPC - Research official/approved access for contest ADP, tournament ownership, draft boards, and high-stakes rankings. Treat as high-value market signal if licensed, but do not scrape pay-to-play contest data. Probe script checks the exposed API help page and a lightweight documented projected-points route.
- [x] Player props / betting lines - Research approved odds/props APIs for Underdog, bet365, Sleeper Picks, PrizePicks, FanDuel, DraftKings, Pinnacle, and aggregator APIs. Use only licensed feeds, snapshot props in cron jobs, and convert them into start/sit, projection-confidence, injury-risk, and market-implied role signals. Probe script checks OpticOdds, SportsGameOdds, ParlayAPI, and public docs for Sleeper/Underdog/bet365 coverage.
- [x] Add player prop snapshot foundation with normalized prop lines, OpticOdds env-gated refresh, provider snapshot persistence, and fixture tests. Keep props provider calls in dynamic-data refresh only; normal report loads should read stored snapshots.
- [x] Add prop-market signal model shell that reads stored prop snapshots only, compares market lines to internal projection inputs, and emits sportsbook agreement, confidence, direction, and neutral start/sit support flags.
- [x] Feed stored prop-market signals into backend manager market reads so report/autopilot intelligence can use props as value/start-sit context without live provider calls.
- [ ] After OpticOdds approves/issues an API key, configure `ENABLE_OPTICODDS_PLAYER_PROPS=true` and `OPTICODDS_API_KEY` only in server/prod env, then run dynamic-data refresh and audit stored `player-props-opticodds-v1` row count, payload size, sportsbook coverage, and market coverage without printing payloads or secrets.
- [ ] After the first real props snapshot, tune `OPTICODDS_SPORTSBOOKS` and `OPTICODDS_PROP_MARKETS` around available NFL markets for Sleeper, Underdog, bet365, and major books, then add source-health/freshness diagnostics before surfacing props publicly.
- [x] Add compliance and responsible-gaming boundaries before public props UI; internal report intelligence can use generic market-signal language first.
- [ ] Tune prop-market signal thresholds after real snapshots exist: compare player props against projection/value snapshots, calibrate meaningful deltas for start/sit decisions, matchup previews, and player confidence, then document jurisdiction/compliance and responsible-gaming boundaries before public release.
- [x] Add a shortlist of features we already have enough data to build from current sources:
  - [x] News-to-value movement analysis using FantasyPros/Sleeper news, injury, and snapshot timing.
  - [x] ADP vs value-over-cost views using FantasyPros ADP / DYNADP / RKADP plus current value blends.
  - [x] Rookie and devy prospect comparison views using the existing prospect and ranking sources.
  - [x] Cross-league exposure, concentration, and roster-share reporting from stored league snapshots.
  - [x] Waiver and trade calibration dashboards from historical outcomes and manager-league history.
  - [x] Player source trace views that show which feeds are contributing to a player's current value or confidence.

## AI Logic / Signal Engineering Roadmap

- [ ] Build a historical player cohort engine that compares value, production, age, draft capital, and role across all players by position, format, and season.
- [ ] Build manager personality profiles from real league behavior so AI recommendations account for aggressive waiver bidders, patient FAAB hoarders, trade addicts, rookie hoarders, name-value chasers, contender overpayers, rebuild discount hunters, and managers who rarely act.
  - [x] Add an admin-only first-pass Leaguemate Personality Intel table from visible trade, waiver, pick, roster, and proposal-status signals.
  - [x] Feed admin-gated manager personality labels into Trade War Room negotiation context without showing them to normal users.
- [x] Build a first-pass league sharpness score from roster quality, transaction volume, waiver behavior, draft discipline, trade frequency, lineup optimization, inactive managers, and source/sample depth so recommendations adjust between casual, average, and sharp leagues.
  - [x] Feed league sharpness into the shared AI evidence layer so sharp leagues raise urgency and sleepy leagues cap chase behavior.
  - [x] Add an admin-only League Sharpness Score diagnostic panel with source signals and confidence.
- [ ] Add unified outcome memory for every AI recommendation type: waiver add, cut, stash, start/sit, trade offer, trade reject, buy-low, sell-high, draft pick, streamer, and prospect read. Store the recommendation, evidence, confidence, result window, eventual outcome, and whether the model should learn from it.
  - [x] Add Outcome Memory 2.0 admin diagnostics with an AI outcome ledger, confidence-bucket accuracy, module scorecards, sharpness calibration, and automatic confidence-adjustment rows.
  - [x] Persist Action Queue sharpness tags into prediction-event metadata so sharpness buckets can be calibrated after outcomes resolve.
  - [x] Expand automatic outcome resolution beyond current backend job coverage for player-modal archetype calls, start/sit calls, sell-high/buy-low style avoid/hold reads, and ignored/no-action calls.
  - [x] Add value-snapshot outcome facts so sell-high/buy-low calls can grade from post-call value movement even when no trade or same-week player-stat fact exists.
  - [ ] Extend value-movement outcome facts into redraft-specific value history once the redraft Draft Coach/player-modal wiring consumes `redraft-value-trends-v1.json` in runtime calibration.
- [ ] Expand player archetype prediction beyond value rank: volume spike, depth-chart promotion, injury-away backup, schedule streamer, age-cliff risk, post-hype breakout, empty-calorie producer, market trap, role loss, target-earner, touchdown-dependent scorer, and fragile-value veteran.
  - [x] Add first-pass player action archetype labels to Player Modal AI reads and Waiver Intelligence signals using situation delta, schedule, cohort, comp, draft-capital, and availability context.
- [ ] Apply hard confidence caps everywhere based on missing data: no projections, no schedule, no current role, no recent usage, no manager history, thin source count, stale source snapshot, redraft/dynasty mismatch, missing ownership status, or insufficient resolved outcomes.
  - [x] Feed stored AI calibration adjustment profiles back into the shared evidence engine so future waiver, schedule, and autopilot reads can inherit earned confidence caps and outcome-memory penalties.
  - [x] Thread report-level calibration profiles into Player Detail Modal AI reads so player-specific buy/sell/hold and archetype confidence can inherit outcome-memory caps.
  - 2026-06-02 shared trade-history cap: the shared AI evidence engine now caps trade-action reads at `57%` and keeps them non-actionable when no league trade or manager-history sample is attached, so roster/value math alone cannot promote a confident trade action. Added focused evidence-engine coverage and receipt assertions for the missing-history cap.
  - 2026-06-02 shared start/sit projection cap: the shared AI evidence engine now caps start/sit reads at `56%` and keeps them non-actionable when no projection, matchup, schedule, SOS, or ECR proof is attached, so current-season rank alone cannot promote a lineup action. Added focused evidence-engine coverage and receipt assertions for the missing projection/matchup cap.
  - 2026-06-02 shared thin-source action cap: non-schedule player action reads now cap at `57%` and stay non-actionable when only one player source is attached, while schedule/matchup reads continue to use their separate source-trace and schedule-data guards. Added focused evidence-engine coverage and receipt assertions for the thin-source cap.
  - 2026-06-02 schedule availability cap: schedule streamer reads now cap at `54%` and stay non-actionable when the cached report has no roster ownership map, so loaded matchup data cannot promote an add before availability is verified. Added focused schedule-row coverage for the unverified ownership state.
  - 2026-06-02 player-detail role-context cap: Player Detail AI reads now cap at `57%` and stay non-actionable when value/source data exists but no cohort or situation-delta role context is attached, so rank/value alone cannot promote a player-specific action. Added focused Player Detail coverage for the missing role-context state.
  - 2026-06-02 player-detail recent-usage cap: Player Detail AI reads now cap at `56%` and stay non-actionable when cohort/situation role context exists but no recent usage trend is attached, so role labels without usage proof cannot promote a player-specific action. Added focused Player Detail coverage for the missing usage-trend state.
  - 2026-06-02 shared stale-source action cap: direct player action reads now cap at `55%` and stay non-actionable when the attached source trace is stale or unhealthy, while non-action support reads keep the existing softer stale-source cap. Added focused evidence-engine coverage and receipt assertions for stale action-source freshness.
  - 2026-06-02 shared dynasty-format cap: dynasty pickup/stash/trade/avoid reads now cap at `56%` and stay non-actionable when only redraft/current evidence is attached and no dynasty, market, or prospect signal is present, so weekly redraft rank cannot promote a dynasty action by itself. Added focused evidence-engine coverage and receipt assertions for the inverse format-mismatch state.
  - 2026-06-02 shared resolved-outcome cap: direct player action reads now cap at `56%` and stay non-actionable when a matching outcome-calibration bucket has fewer than six scored outcomes, so early/pending calibration rows cannot promote confident actions before enough results resolve. Added focused evidence-engine coverage and receipt assertions for low-sample calibration buckets.
- [ ] Collapse noisy AI surfaces into one personalized command center that shows only binary action reads: add this, do not chase this, send this trade, reject this trade, start this player, stash this player, cut this player, or no action because evidence is thin.
  - [x] Tighten generic AI watch/readout language into binary decision copy (`Do this`, `Do not do this`, `Don't force it`, or insufficient evidence) so secondary cards read as support signals instead of extra competing advice.
  - [x] Run the first visible AI surface audit, then restore Owner Intel Lab to separate roster, best-move, market/picks, suggestion, and AI-notes cards because that presentation feels smarter for manager intel.
  - [x] Run the cross-tab AI surface ownership audit and demote repeated per-row AI cards in Trade Partner Finder, League Power Rankings, and League Exploits into signal drawers so those lists stop competing with their owning AI surfaces.
  - [x] Keep Owner Intel Lab evidence-led while showing multiple AI readouts instead of hiding roster, market, suggestion, and notes context behind support modules.
- [ ] Run an AI Read System WOW + Correctness Pass before adding more AI surfaces. Treat AI reads as the highest-trust, biggest-wow product moment on the site: they must be visually premium, easy to understand, source-backed, state-aware, and correct enough that users trust the product after reading them.
  - [x] Inventory every visible and admin-only AI read surface, including `AIReadPanel`, `AIActionQueue`, `AITeamAutopilot`, `OverviewAIPulse`, Owner Intel, Team Breakdown, Player Detail Modal, Rankings, Waiver Intelligence, Trade War Room, Trade Browser, Draft History, Monthly Blueprint, admin diagnostics, and mobile compact variants.
    - 2026-06-01 inventory: [docs/ai-read-surface-inventory-2026-06-01.md](docs/ai-read-surface-inventory-2026-06-01.md) maps current action ownership, support/readout surfaces, admin diagnostics, mobile compact variants, automated coverage, and open duplication/correctness risks. This does not complete the broader AI Read System pass; it only closes the inventory subtask.
  - [x] Define strict readout tiers and ownership: Overview is executive direction only; each tab gets one concise owner read; player/team/table rows can only show support context; AI Autopilot owns full receipts, source health, memory, conflicts, suppressed alternates, and outcome history; admin diagnostics own raw audit/debug detail.
    - 2026-06-01 policy: [docs/ai-read-tier-policy-2026-06-01.md](docs/ai-read-tier-policy-2026-06-01.md) defines the single action-owner rule, executive summary tier, tab owner tier, support receipt tier, admin diagnostics tier, copy rules, and test rules. Code enforcement is still partial and remains covered by the following correctness/test subtasks.
  - [x] Build a correctness matrix for every recommendation type before UI polish: already-starting player, bench swap, locked game, injured/bye player, player already rostered, player unavailable, drop candidate no longer on roster, redraft-vs-dynasty mismatch, superflex/TEP/scoring differences, stale source, missing source, low source count, roster need already solved, contradictory transaction, and no-action/hold scenarios.
    - 2026-06-01 matrix: [docs/ai-read-correctness-matrix-2026-06-01.md](docs/ai-read-correctness-matrix-2026-06-01.md) defines shared preconditions, hard blockers, downgrade behavior, duplicate-surface rules, browser validation targets, and required regression coverage for waiver, start/bench/swap, trade, buy/sell, draft, streamer, cut, hold, and no-action reads.
  - [ ] Require every action read to prove its current-state preconditions from roster, lineup, waiver, transaction, schedule, source-health, and league-format data before rendering as `Do this`; if the roster state already satisfies the call, show a hold/baseline read or hide it instead of telling the user to act.
    - 2026-06-02 weak-starter slot-proof guard: Autopilot lineup weak-starter reviews now stay hold/review-only unless the proposed replacement is actually on that manager's roster and can fit the flagged starter slot. Off-roster or slot-unproven insurance notes no longer attach a bench/swap expected action. Verified with focused Autopilot regression coverage and `pnpm run check`.
    - 2026-06-02 trade receipt/action guard: Autopilot trade cards now attach concrete trade expected-action receipts so outcome tracking knows the proposed roster change, but the Action Queue still keeps those reads as `Don't force it` until current roster, partner, return, transaction, source-health, and league-format preconditions clear. Verified with focused Autopilot regression coverage and `pnpm run check`.
    - 2026-06-02 shared read action-label guard: `AIReadPanel`'s shared decision resolver now refuses to auto-render `Do this` from high-confidence/evidence-backed context unless an enabled action is attached; explicit action-owned panels can still pass an explicit decision. This keeps Overview, Rankings, Trade Browser, Player Detail, and other receipt surfaces from becoming accidental action owners. Remaining work: keep tightening explicit action-owner panels one by one.
    - 2026-06-02 blueprint summary action-owner guard: generated Monthly Blueprint summaries now label returned priorities as `Don't force it` / `Review priority...` instead of exact `Do this`, because the generated report is a planning receipt rather than a live roster/transaction control. Added rendered command-center coverage proving the Blueprint AI Summary does not show exact `Do this`.
    - 2026-06-02 player trajectory action-proof guard: player trajectory reads now carry explicit action-proof blockers and only render exact `Do this` / `Do not do this` decisions when first-pass trajectory inputs are complete, caution flags are clear, cohort calibration is strong-read eligible, and situation-delta confidence clears the action threshold. Caution/source-mix shifts and non-strong cohort calibration now stay as support reads with `Don't force it`.
    - 2026-06-02 shared missing-source action cap: the shared AI evidence engine now caps player-specific action reads at `54%` and keeps them non-actionable when no player source count or explicit source trace is attached, even if the caller passes a high base score. Added focused evidence-engine coverage and receipt assertions for the missing-source cap.
  - [ ] Standardize user-facing copy so every read answers `What should I do?`, `Why?`, `How confident are we?`, `What could change this?`, and `Where should I verify?` without vague labels, duplicate phrasing, confusing confidence names, or table-local jargon.
    - 2026-06-02 trade copy softening slice: Autopilot trade cards and fallback data now say `Shop only if return clears` or `Test offer only` instead of imperative `Trade away` / `Acquire`, and the command strip says `trade reads` instead of implying offers are ready. This keeps supporting trade cards aligned with the Action Queue's `Don't force it` gate until current-state proof clears. Verified with focused Autopilot regression coverage and `pnpm run check`.
    - 2026-06-02 waiver support-copy slice: generated Autopilot waiver support cards now say `Queue-backed` instead of `Do this`, leaving `Do this now` owned by the primary Action Queue. Verified with focused Autopilot regression coverage and `pnpm run check`.
    - 2026-06-02 waiver support-label slice: generated Autopilot waiver support cards now label actionable candidates as `Queue-backed pickup` instead of `Priority add` / `Add if available`, so the support card no longer competes with the primary Action Queue verdict. Verified with focused Autopilot regression coverage and `pnpm run check`.
    - 2026-06-02 weekly recap support-copy slice: generated Autopilot weekly recap lineup reads now say `Lineup pressure test` / `Pressure-test ... with ...` instead of headline-level `Start ... over ...`, making the recap a supporting read while the Action Queue remains the decisive owner. Verified with focused Autopilot regression coverage and `pnpm run check`.
    - 2026-06-02 weekly plan UI support-copy slice: Autopilot weekly-plan UI labels now say `Review starter slot`, `Pressure-test options`, `Best weekly pressure test`, and `Review against` instead of `Take me out`, `start-over options`, `Best weekly correction`, or `Start over`, so the visible cards read as support context rather than a competing action owner. Verified with targeted report-command-center coverage and `pnpm run check`.
    - 2026-06-02 fallback weekly-plan copy slice: redraft fallback Autopilot data now says `Pressure-test the touchdown-dependent flex against the high-route WR` instead of `Start the high-route WR over...`, so mock/fallback states follow the same support-read ownership rules as live data. Verified with focused Autopilot regression coverage and `pnpm run check`.
    - 2026-06-02 Owner Intel suggestion-card slice: Owner Intel's mapped suggestion cards now label positive reads as `Support read` / `Context read` instead of `Do this` / `Action lane`, preserving the primary Best Move panel as the only action-owning card in that grid. Verified with targeted report-command-center coverage and `pnpm run check`.
    - 2026-06-02 matchup support-copy slice: Matchup Preview support rows now say `Starter review` instead of `Must start`, pending copy says `starter review` instead of `must-start`, and Autopilot matchup-derived reasons now say `starter-review profile`; this keeps schedule context out of command-copy territory. Added static component/Autopilot source coverage to prevent that phrase from returning.
    - 2026-06-02 schedule-edge support-copy slice: actionable schedule-edge rows now say `Review this` instead of exact `Do this`, matching Waiver Intelligence support receipts and leaving command phrasing to primary action-owned surfaces. Added unit coverage proving a schedule streamer only reaches that label after loaded source trace, matchup data, and Sleeper roster availability proof are present.
    - 2026-06-02 voice-mode action-copy guard: AI voice styling no longer upgrades softened `go`-tone support labels such as `Review this` into exact `Do this` / `Green light` copy. True direct-action labels still get voice treatment, but support receipts keep their original label/status/detail.
    - 2026-06-02 support-copy command cleanup: remaining Autopilot weekly-plan `start-over option` text now says `review option`, and the trade finder selection label now says `Offer asset` instead of `Trade away`. Extended static AI copy-boundary coverage so support surfaces do not reintroduce those command-owner phrases.
    - 2026-06-02 guardrail-copy cleanup: Autopilot missing-evidence text now says a read cannot enter the `primary action queue` when no concrete expected action is attached, instead of saying it cannot render as `Do this now`. Extended static copy-boundary coverage so guardrail explanations do not borrow the primary action label.
    - 2026-06-02 secondary queue framing slice: secondary Action Queue rows now label their supporting proof line as `Where to verify` when driven by missing evidence or `What changes this` when driven by change triggers, instead of showing an unlabeled sentence. Added source-boundary coverage so compact queue rows keep verification/change framing.
    - 2026-06-02 AI trace-label cleanup: AI read trace sections now use the plain user-facing `Why` label instead of the internal/debug-flavored `Why this fired` copy across shared panels, Owner Intel, ReportTables, and Player Detail. Updated browser expectations and static source coverage so the old phrase does not return.
    - 2026-06-02 disclosure-label cleanup: remaining support disclosure labels now use plain `Why` instead of `Why this swap` or `Why Better Cut`, keeping lineup swap and recent-transaction insight copy aligned with the shared AI-read trace language. Extended static copy-boundary coverage and updated the matching browser expectation.
    - 2026-06-02 evidence-gap copy cleanup: Autopilot change-trigger text now says `Verify evidence gap` instead of `Add missing evidence`, so missing-proof guidance reads as user verification work rather than an internal data-entry task. Extended static copy-boundary coverage so the older phrase does not return.
    - 2026-06-02 Autopilot guardrail-language cleanup: remaining queue/change-trigger copy now says `Verify preconditions`, `Review blocker`, `Review confidence cap`, `Check source freshness`, `top action`, `standing pat`, and `No low-evidence moves are being promoted` instead of internal queue phrases like `do-this-now`, `queue refused`, or `do-nothing counterfactual`. Extended copy-boundary coverage for those phrases.
    - 2026-06-02 shared verification-copy cleanup: shared `AIReadPanel` verification rows now say `Do not act yet`, `Verify first`, and `Confidence limited to... because...` instead of internal receipt labels like `Blocked`, `Missing`, or `Confidence cap`. Extended static copy-boundary coverage so the shared panel keeps user-facing verification language.
    - 2026-06-02 confidence-limit copy cleanup: shared AI decision/status copy and panel confidence notes now say `Confidence limited by...` / `Limited` instead of `Confidence capped by...` / `Capped`, keeping user-facing confidence language less internal. Extended copy-boundary coverage across the shared decision helper and the two high-traffic AI panels.
    - 2026-06-02 transaction-drop review cleanup: Recent Transactions alternate-drop rows now say `Drop review` instead of `Better Cut`, so waiver/transaction support context no longer reads like an imperative cut command. Extended static source coverage so the old table-local label does not return.
    - 2026-06-02 Autopilot confidence-limit copy cleanup: Autopilot support signals, source-health fallback text, guardrail-pressure statuses, and hold expected-action copy now use `limited` / `confidence limit` instead of `capped` / `confidence cap`, keeping downgraded reads in plain user-facing language. Extended static coverage so those old Autopilot phrases do not return.
    - 2026-06-02 player-read confidence-limit copy cleanup: Player Detail and Situation Radar read copy now says `limited` / `confidence limit` instead of `capped` / `confidence cap`, keeping cohort, scheme-risk, and source-limited warnings aligned with the shared AI confidence language. Extended static coverage for the old phrases.
    - 2026-06-02 server AI confidence-limit copy cleanup: server-generated player cohort, situation-delta, source-agreement, and projection fixture notes now use `limited` / `confidence limit` instead of `capped` / `confidence cap`, so cached report payload text stays aligned with the client AI copy language. Added server-side static coverage for those generated-copy files.
    - 2026-06-02 shared AI evidence receipt copy cleanup: shared evidence-engine guardrail labels and report-delta confidence-change copy now use `limits` / `Confidence limited to` instead of user-facing `caps` / `Confidence cap`, keeping AI receipt language aligned with the rest of the trust-copy cleanup.
  - [ ] Redesign the visual presentation rules so AI reads feel like the premium command-center centerpiece: no nested cards inside cards, no table-within-table feel, no giant receipt stacks on overview surfaces, clear max-width/height constraints, strong hierarchy, premium gradients/chrome, restrained motion, readable source chips, and mobile layouts that collapse to one decisive takeaway.
  - [ ] Add automated regression coverage for AI-read correctness and duplication: text assertions for known real/fixture leagues, fixture tests for all action types, source-gating tests, mobile/desktop Playwright screenshots for Overview, Autopilot, Player Detail, Waiver, Trade, Rankings, and Draft surfaces, and a guard that flags multiple surfaces making the same action call.
    - 2026-06-02 explicit action-copy boundary guard: added a static component-source regression test so exact `Do this` copy is limited to reviewed action-owned panels only: the Monthly Blueprint generation CTA and Owner Intel Best Move. New component-level exact `Do this` labels now require an intentional test update.
    - 2026-06-02 schedule calibration semantics guard: AI prediction telemetry now classifies actionable schedule reads from `evidenceRead.canAct` instead of literal display copy, so support labels like `Review this` do not silently downgrade outcome calibration to watch-only events. Added a regression fixture covering a loaded, available WR schedule read with `Review this` display copy and `pickup` calibration semantics.
    - 2026-06-02 duplicate-readout regression guard: admin AI diagnostics now have test coverage proving the representative report has zero duplicate-risk readouts, and any future duplicate-risk surface is routed to `Merge` / `No separate claim` instead of becoming another action or support owner.
    - 2026-06-02 downgraded-queue explanation guard: Autopilot fixture coverage now proves every non-`Do this now` Action Queue row still carries verification/change/blocker/source context, so downgraded reads explain where to verify or what would change the verdict instead of becoming silent no-action rows.
    - 2026-06-02 primary-action proof guard: Autopilot fixture coverage now proves every `Do this now` Action Queue row carries source-health, receipt, change-trigger, and roster-domino context in addition to a concrete expected action, so primary actions cannot become proof-thin imperatives.
    - 2026-06-02 primary-action source-health freshness guard: Autopilot fixture coverage now rejects stale, missing, error, limited, unavailable, unverified, zero-row, or no-source trace text on `Do this now` Action Queue rows, so primary actions cannot be promoted from unhealthy source traces.
    - 2026-06-02 duplicate action-target guard: Autopilot now dedupes direct-action targets before selecting Action Queue rows, preserving the strongest row and suppressing weaker duplicate pickup/start/trade calls for the same player. Added fixture coverage proving a second same-player waiver read cannot compete with the primary action.
    - 2026-06-02 missing-evidence promotion guard: Autopilot now downshifts high-confidence reads from `Do this now` to `Don't force it` whenever attached evidence still has a missing-evidence row, even if a malformed fixture marks `canAct: true`. Added fixture coverage proving primary action rows have zero missing evidence.
    - 2026-06-02 source-health proof promotion guard: central Action Queue preconditions now downshift high-confidence direct-action reads when attached evidence has no source trace or an unhealthy source trace, even if a malformed fixture marks `canAct: true`. Added fixture coverage proving source-health proof is required before `Do this now`.
    - 2026-06-02 zero-row source-health guard: Autopilot weekly-source trace normalization now treats `rowCount: 0` as missing source proof and carries row-count detail into Action Queue source-health text, matching the schedule-edge trace policy so empty source responses cannot look loaded.
    - 2026-06-02 source-agreement health guard: shared AI evidence and Autopilot calibration now classify missing, limited, stale, error, no-source, and zero-row traces as missing/split source-agreement buckets instead of `unknown`, and direct action reads with missing trace proof inherit the unhealthy-source confidence limit.
  - [ ] Validate the pass against real representative leagues before marking it complete: `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`, including admin mode, regular mode, desktop, tablet, mobile, projection-enabled, projection-disabled, and cached-report restore states.
  - [ ] Ship the pass only after `pnpm run check`, focused AI read tests, relevant Playwright visual checks, and `pnpm build` pass; document any remaining source limitations directly in the readout copy instead of implying certainty.
- [ ] Build league-wide prediction backtests for FAAB patterns, draft paths, trade activity, waiver volume, start/sit decisions, prospect stashes, and roster-construction choices so confidence only rises when prior predictions actually beat simple baselines.
- [x] Add age/value curves so AI can tell whether a player is early, normal, or late relative to their position's typical peak and decline window.
- [x] Add an offline player-season outcome builder from nflverse stats so production seasons can be labeled as first-season, progression, breakout, sustain, regression, collapse, or low-signal without putting raw modeling data on pages.
- [ ] Measure production peaks and decline slopes by season, age, and game window so the readouts can flag when a player has already peaked, is peaking now, or is still climbing.
- [x] Add a first snapshot-backed nflverse usage trend layer for targets, carries, receptions, PPR production, target share, and offense snap percentage so player/cohort reads can identify role growth or decline without live report-load calls.
- [x] Add nflverse combine and contract context snapshots so player AI reads can distinguish size/speed archetypes and veteran investment runway from pure market value.
- [ ] Expand breakout and falloff detection into full year-over-year changes in snap share, targets, rush attempts, routes, touchdowns, and efficiency after route participation is available from an approved/stable source.
- [x] Build first-pass player archetype inputs using size, athletic profile, draft capital, contract investment, usage profile, and scoring shape so the AI can explain similar historical outcomes instead of just raw ranks.
- [ ] Add rolling trend, volatility, and momentum features across 3/6/12/24 game and season windows so the readouts distinguish sustained growth from short spikes.
- [x] Add first-pass 3/6/12/24 game usage windows from nflverse weekly `stats_player` rows so situation reads and manager summaries can notice role spikes/dips before the market value changes.
- [ ] Separate opportunity-driven value from talent-driven value by modeling team context, depth-chart changes, injuries, QB changes, offensive environment, and role shifts.
- [x] Build the all-player Player Situation Delta engine from stored public snapshots so rookies, sophomores, veterans on new teams, and veterans whose teams changed around them get role/opportunity reads instead of rookie-only context. See `docs/player-situation-delta-data-plan.md`.
- [x] Migrate the nflverse usage snapshot from the legacy combined `player_stats.csv` source to season-specific `stats_player` releases so current target share, air-yard share, WOPR, carries, targets, and fantasy production stay fresh.
- [x] Add team-environment snapshots from nflverse `stats_team` and `pbp` so AI reads can account for team pass rate, rush rate, neutral-script pass rate, red-zone tendency, non-garbage pass rate, estimated pace, target volume, play volume, and offensive tendency without live report-load calls.
- [x] Add first-pass roster-room delta snapshots from nflverse rosters and depth charts so reads can identify same-position additions, losses, rookie/premium additions, crowded rooms, and vacated opportunity.
- [x] Expand roster-room deltas with weekly rosters and transaction typing so additions/losses can distinguish draft picks, inferred free-agent/claim movement, trades, injury returns, practice-squad churn, and offseason/camp noise.
- [x] Quality-weight roster movement with prior-season targets, carries, receptions, PPR production, target share, WOPR, movement impact score, net opportunity score, and incumbent promotion score so JSN-style breakout windows account for whether added/lost players were actually meaningful.
- [ ] Add a broader official transaction source so roster-room deltas can stop inferring non-trade movement and can explicitly classify free-agent signings, releases, waiver claims, reserve-list moves, and exact signing dates.
- [ ] Add public advanced-efficiency snapshots from nflverse Next Gen Stats, PFR advanced stats, FTN charting, and participation/personnel data while explicitly labeling any route-derived public signal as estimated.
- [ ] Add a curated coach/offensive coordinator/play-caller snapshot with source URLs, verified dates, prior roles, and confidence flags so scheme-change reads can account for new coaching staffs without relying on stale memory.
- [ ] Keep exact routes run, route share, targets per route run, and yards per route run gated until an approved licensed source provides route-volume data; use target share, air-yard share, WOPR, NGS, PFR advanced, and estimated route participation as public-data fallbacks.
- [x] Add age-adjusted market-vs-production deltas so we can spot players whose market value is lagging or overstating what the production curve says.
- [x] Build position-specific aging models for QB, RB, WR, and TE, since the same age means different things by position and role.
- [x] Add snapshot-backed injury-history context from nflverse injury reports so player reads can separate clean availability from recurring limited/out-style report signals.
- [x] Add deeper first-pass historical outcome buckets such as breakout, sustain, regression, collapse, low-signal, and late-career rebound, then map historical player-seasons into those buckets for calibration.
- [x] Add a first-pass player cohort signal engine with position age phases, market-vs-production deltas, current outcome buckets, confidence gating, same-position peer rows, and explanation traces without adding provider calls.
- [x] Add offline player-cohort backtesting against historical seasons to measure archetype sample size, positive rate, regression/collapse risk, median next-year movement, and failure modes; see `docs/player-season-outcome-model.md`.
- [x] Publish compact player-cohort calibration signals so player AI reads can cite historical sample size, failure risk, and median next-year movement without loading raw modeling rows or example players at runtime.
- [x] Add admin-only player signal audit diagnostics so visible/internal historical signals, display reasons, bucket summaries, and bad-read guardrails can be reviewed before stronger AI copy ships.
- [x] Add player-value framing language: `Market Price` for the weighted source value, `Degen Read` for the context layer, `Degen Gap` for the directional adjustment, and `Confidence` for source trust.
- [x] Add full-rankings value confidence visibility and sorting so users can separate high-trust prices from thin market reads.
- [ ] Backtest every new heuristic against historical seasons to measure false positives, false negatives, and calibration drift before exposing it in readouts; start from `docs/player-season-outcome-model.md`.
- [x] Surface a short explanation trace in the UI so each player AI read can show the top reasons the model thinks a player is undervalued, overvalued, peaking, or declining, including draft-capital runway so high picks and late/undrafted profiles are judged with different opportunity patience.
- [x] Add shared player situation freshness and dynamic-signal fields, then aggregate them into manager roster reads so manager copy can react to usage, news, injury, depth-chart, and roster-room changes without duplicating player-level text.
- [x] Add confidence gating so thin, noisy, or conflicting signals reduce certainty instead of forcing a strong read.
- [x] Add player-cohort calibration metadata so every player AI read carries an evidence grade, confidence cap, strong-read eligibility flag, missing-signal list, and caution flags before the UI can present it as a high-confidence take.
- [x] Add a shared AI evidence engine with one evidence shape for readouts: evidence, missing evidence, hard blockers, soft penalties, confidence cap, source trace, final score, confidence label, and why-this-fired copy.
- [x] Route Waiver Intelligence and Autopilot waiver actions through the shared evidence engine first, with binary action language, signal details, live transaction blocking, redraft/current-season gating, D/ST schedule penalties, and no fallback to generic mock advice when real evidence blocks a card.
- [x] Wire Matchup Edge / schedule reads into the shared AI evidence engine so streamer, kicker, D/ST, and start/sit copy cannot exceed schedule-source freshness or matchup-window confidence.
- [x] Wire Player Modal AI reads into the shared AI evidence engine so cohort, situation-delta, source-confidence, schedule, and value-history signals use the same vocabulary.
- [x] Wire Owner Intel / Team Breakdown reads into the shared AI evidence engine so manager-level copy stays evidence-led and avoids repeating weaker table-local conclusions.
- [x] Wire Rankings market reads into the shared AI evidence engine so source-count, source-spread, stale-source, redraft/dynasty, and roster-ownership guardrails are enforced before confident copy renders.
- [x] Wire Trade Browser / Trade War Room reads into the shared AI evidence engine so package suggestions collapse to the strongest actionable read instead of listing several weak alternatives.
- [x] Wire Overview AI Pulse into the shared AI evidence engine last so it summarizes the strongest proven decisions only and never invents extra AI cards for empty or thin tables.
- [x] Add a shared AI decision presentation layer so readouts lead with `Do this`, `Don't force it`, `Do not do this`, or `Insufficient evidence`, keep support signals collapsed, and keep Owner Intel suggestions visible as distinct AI cards.
- [x] Add a unified AI Action Queue for Overview and Autopilot so the product surfaces one ranked best move, demotes weaker reads to watch/hold, and says `No move is best` when confidence is capped.
- [x] Add `What changes this` triggers to AI Action Queue reads so users can see which blocker, stale source, missing evidence, roster change, schedule swing, or partner-fit change would flip the recommendation.
- [x] Add an admin AI Decision Log so action ownership, hidden/data-only reads, duplicate-readout policy, missing evidence, blockers, source signals, and `What changes this` triggers are reviewable without adding more user-facing cards.
- [x] Collapse Assistant Feature Radar from many local AI cards into one owner action queue plus evidence modules, so supporting panels stop acting like separate recommendations.
- [x] Add AI Action Queue decision memory so the top move can say whether it changed since the last tracked read.
- [x] Add compact confidence-history sparklines and source-conflict checks to the AI Action Queue and admin Decision Log.
- [x] Add local post-action outcome tracking for AI queue recommendations so done/skipped calls can be reviewed.
- [x] Add quiet-mode gating so low-value AI readouts hide unless they have a binary decision or a missing-evidence/source-health signal.
- [x] Add league-context modifiers for dynasty, redraft, superflex, and format-specific scoring so the logic stays format-aware.
- [x] Create anomaly rules for unusual cases like age-curve outliers, late breakouts, injury comebacks, small-sample spikes, and role-driven production jumps.
- [x] Build a reusable comparison layer that can answer "who has this player most resembled historically at the same age, usage, and value?" for deeper AI readouts.
- [x] Promote the reusable comparison layer with full season-by-season backtest diagnostics once the historical season warehouse is complete.
- [x] Expand the source-history layer with compact nflverse usage, injury, combine, and contract snapshots stored in `providerDataSnapshots`.
- [x] Add admin diagnostics/freshness coverage for nflverse usage, injury, combine, and contract snapshots so model inputs are visible without raw payloads.

## Overview Tab / Readout Clarity Roadmap

- [x] Audit every table in the Overview tab and list the exact job each one is supposed to do.
- [x] Add cross-tab AI readout feature coverage checklist: see `docs/ai-readout-feature-coverage.md`.
- [x] Identify any repeated signals, summaries, or conclusions that are being shown on multiple tables and document the duplication ownership risk.
- [x] Remove the duplicated Overview readouts from the UI surfaces after the ownership mapping is applied.
- [x] Define one primary message for each table so we can clearly decide what belongs there and what should live elsewhere.
- [x] Move overlapping readouts into the table that owns them, or pull them out entirely if they do not have a clear owner.
- [x] Make sure the Overview tab reads as a set of distinct layers of insight instead of multiple tables saying the same thing in different words.
- [x] Add review pass for each Overview table after logic changes so duplicates do not creep back in during future feature work.
- [x] Build an ownership matrix for every Overview surface with columns for surface, primary job, allowed readouts, banned overlap, and source-of-truth owner.
- [x] Audit the full Overview stack in render order and assign one job to each surface:
  - [x] `OverviewAIPulse`: narrative summary only; it should set the league story, not repeat table metrics.
  - [x] `Monthly Team Blueprint`: long-horizon roster plan only; keep it focused on team direction, age curve, and roster construction.
  - [x] `League Power Rankings`: league-wide strength/value ordering only; do not duplicate owner-level advice or roster-blueprint language.
  - [x] `Team Breakdown & Roster Recon`: strengths, leaks, surplus, and next move only; it should explain the roster, not re-rank the league.
  - [x] `Trade Finder, Partners & League Exploits`: trade opportunities, partner matching, and league pressure points only; do not repeat roster-health or power-rank copy.
  - [x] `Assistant Feature Radar`: placeholder/shell inventory only; it should never echo active analysis from the real readouts.
  - [x] `OwnerIntelMatrix`: owner identity, roster identity, comp lanes, and strategy tags only; keep it as the owner-level source of truth.
  - [x] `LeagueCommandCenter` in roster mode: projected starters, bench depth, step-ins, season read, and injury insurance only.
  - [x] `LeagueCommandCenter` in taxi mode: taxi promote/park/cut decisions only.
  - [x] `Manager Position Counts`: position depth and imbalance only; keep it as the single owner for count-based roster gaps.
- [x] Define the duplicated concepts that must have one clear owner and no copy-paste repetition:
  - [x] league value rank
  - [x] starter count / starter room
  - [x] bench depth
  - [x] age and age flags
  - [x] roster health
  - [x] position imbalance
  - [x] tradeable depth
  - [x] trade partner fit
  - [x] taxi promote/park/cut calls
  - [x] top-manager or best-team claims
- [x] If a concept has to appear in two places, rewrite one instance so it clearly answers a different question instead of repeating the same conclusion.
- [x] Move shared calculations into one source of truth and make the other surfaces reference that result rather than restating the same readout.
- [x] Compare the final Overview stack side-by-side after every logic change and remove any repeated phrasing, repeated ranks, repeated value tags, or repeated "best/worst" labels.
- [x] Add a regression check or snapshot test that fails if two Overview surfaces end up telling the same story with the same metric stack.
- [x] Require an explicit owner review for any new Overview metric so we do not reintroduce duplicate readouts when new features land.
- [x] Enforce the ownership matrix in rendered Overview copy: Power Rankings stays league-ordering only, Team Breakdown stops naming trade chips/sell candidates, and Trade Finder owns specific trade packages/targets.

## May 14, 2026 - Projections / SOS Rollout

- [x] Confirm the approved source blend for projections, strength of schedule, and bye-week data before wiring any feature to live inputs: see `docs/projections-sos-source-policy.md`.
- [x] Set DraftSharks as the long-term SOS decision source after comparing the source options; FantasyPros projections remain blocked for production use until commercial terms/rate limits are approved, and FantasyPros matchup-calendar rows are retired from active SOS refresh/readout paths.
- [x] Populate `schedulePlanning` from the schedule-release data so roster gaps, streamer candidates, and bye-window coverage have real source-backed inputs.
- [x] Wire schedule-aware inputs into matchup preview so weekly win odds, opponent edge, and "how you win" reads can use projection and SOS context.
- [x] Wire schedule-aware inputs into player detail views so bye windows, SOS tiers, and schedule summaries are visible at the player level.
- [x] Wire schedule-aware inputs into weekly autopilot planning so streamer suggestions, roster gaps, and priority actions reflect byes and SOS.
- [x] Wire schedule-aware inputs into D/ST and matchup-streamer logic so upcoming schedule strength can influence start/sit and pickup decisions.
- [ ] Wire projections into lineup-strength, redraft valuation, and confidence calculations only after validating source freshness and endpoint stability.
- [x] Add source-health checks and freshness checks for every projection/SOS feed we plan to depend on: report diagnostics now include DraftSharks SOS, player props, redraft source snapshots, FantasyPros health rows, and stored provider snapshot freshness; projection-driven rollout remains blocked until approved projection snapshots exist.
- [x] Add tests for schedule normalization, bye-window rendering, streamer candidate generation, DraftSharks SOS normalization, and planner output from real schedule inputs.
- [x] Leave a clear fallback state for pre-schedule and missing-data periods so offseason views remain stable.

## Future Full NFL Schedule + Player Projection Roadmap

### Source Access And Policy Gates

- [ ] Confirm the approved full NFL schedule source before using it in production: prefer an official or licensed endpoint that returns season, week, game date/time, home team, away team, venue, neutral-site flag, game status, and source update timestamp.
- [ ] Confirm the approved weekly player projection source before using projections in public reports: FantasyPros, DraftSharks, SportsDataIO, Fantasy Nerds, or another licensed provider is acceptable only after production terms, rate limits, redistribution rules, and freshness guarantees are documented.
- [x] Retire FantasyPros matchup-calendar access from active SOS jobs/source traces; do not use FantasyPros ECR or matchup rows as public SOS recommendation inputs.
- [ ] Keep normal user-triggered report loads snapshot-backed for full schedule and projection data; live calls during login/report generation should remain limited to Sleeper current league state.
- [x] Add feature flags for each projection source and projection type: weekly, rest-of-season, preseason, playoff weeks, position-specific projections, team defense projections, kicker projections, and injury-adjusted projections.
- [x] Add source policy docs for projection display language so the UI never labels internal estimates as provider projections and never implies unavailable provider data is present.
- [x] Add rollout kill switches so bad projection snapshots, stale schedules, or broken source mappings can disable projection-influenced reads without breaking base reports.
- [x] Use DraftSharks percentage-based SOS as the schedule-strength decision source; remove FantasyPros matchup-calendar refresh/readout paths so they cannot create, boost, cap, trace, or override SOS actions.

### Full NFL Schedule Snapshot Layer

- [x] Add a normalized `nflScheduleGames` snapshot model keyed by `season`, `week`, `gameId`, `homeTeam`, `awayTeam`, `startsAt`, `gameStatus`, and `sourceVersion`.
- [x] Add a normalized matchup-calendar/SOS snapshot layer keyed by `season`, `position`, `source`, `playerId` or `teamDefenseId`, `week`, `opponent`, and `sourceVersion`; store ECR, matchup rating/stars, opponent rank, home/away, source URL, fetched timestamp, row count, checksum, and parser version.
- [x] Make matchup-calendar/SOS snapshots dynamic and versioned: refresh on a preseason cadence as rankings stabilize, increase cadence during the season around waiver/start-sit windows, retain prior snapshots for ECR/SOS movement, and expire stale rows without making live provider calls during user report loads.
- [x] Store schedule metadata with `source`, `sourceUrl` or provider key, `fetchedAt`, `publishedAt`, `seasonType`, `rowCount`, `checksum`, and parser version.
- [x] Normalize team codes across Sleeper, provider schedule feeds, FantasyPros, DraftSharks, ESPN, SportsDataIO, and internal abbreviations so `JAC/JAX`, `ARI/ARZ`, `LA/LAR/LAC`, and Washington naming drift do not break joins.
- [x] Capture home/away, short-rest, long-rest, travel distance bucket, dome/outdoor, weather-sensitive stadium, international game, neutral site, division game, conference game, and projected playoff-week relevance.
- [x] Add schedule versioning so corrections, flex scheduling, postponed games, and kickoff changes can be audited without mutating historical reads silently.
- [x] Add diagnostics that compare the stored schedule against Sleeper matchup weeks and provider projection weeks so mismatched season/week boundaries are visible before projections are trusted.
- [x] Add fallback behavior for missing game rows: keep bye-week planning, neutral SOS, and internal value reads available while clearly suppressing projection-specific claims.

### Player Projection Snapshot Layer

- [x] Add a normalized `playerProjectionSnapshots` model keyed by `season`, `week`, `playerId`, `source`, `scoringProfile`, `projectionType`, and `sourceVersion`.
- [x] Store core projection fields: projected fantasy points, passing/rushing/receiving volume, touchdowns, receptions, targets, carries, routes if available, snaps if available, turnovers, field-goal attempts, defensive stats, and confidence or expert-count metadata when provided.
- [x] Store source freshness fields: `fetchedAt`, `publishedAt`, `validForWeek`, `providerUpdatedAt`, `rowCount`, `positionCoverage`, `missingStarterCount`, `sourceError`, and `staleReason`.
- [x] Support scoring-specific projections for PPR, half-PPR, standard, superflex, TE premium, six-point passing touchdown, and custom league settings where provider data supports it.
- [x] Add projection history retention so weekly projection accuracy, source bias, stale reads, and positional calibration can be measured after games complete.
- [x] Add player identity mapping diagnostics for every projected row: Sleeper player ID, provider player ID, full name, team, position, status, rookie flag, and confidence score.
- [x] Add a quarantine path for ambiguous player matches, retired players, duplicate names, team changes, practice-squad players, and rookies without stable provider IDs.

### Schedule + Projection Join Model

- [x] Build a projection context join that links `playerProjectionSnapshots` to the full NFL schedule by player team, week, opponent, home/away, bye status, and game environment.
- [x] Add opponent defensive context once approved data exists: positional fantasy points allowed, pace, pass/rush funnel, pressure rate, explosive-play allowance, red-zone weakness, and D/ST turnover/sack opportunity.
- [x] Add weather and game environment hooks for late-week updates: wind, precipitation, temperature, dome/outdoor, Vegas total if licensed, implied team total if licensed, and postponement risk.
- [x] Add team depth-chart context so projections can be weighted by role stability, injury replacements, starter status, backup pressure, and snap-share trend.
- [x] Add draft-capital and contract-context opportunity weighting so early NFL draft picks, premium rookie picks, and highly paid veterans are understood as likely to get longer opportunity runways than fringe players with similar short-term production.
- [x] Add rookie ramp and opportunity-patience rules by draft round, position, team investment, camp role, depth-chart opening, and historical team behavior so AI reads do not overreact to one quiet early game.
- [x] Add projection-to-value bridge fields that separate dynasty value, redraft weekly projection, rest-of-season projection, long-term role security, and opportunity runway.
- [x] Add explainability traces that show which projection, schedule, opponent, injury, draft-capital, and role signals changed a player read.

### Product Surfaces To Upgrade

- [ ] Upgrade matchup previews from internal schedule/value estimates to source-backed projected points once projection snapshots pass freshness gates.
- [ ] Add lineup-strength reads that compare current starters, optimal starters, bench alternatives, opponent starters, positional edges, floor/ceiling gap, and projected win probability.
- [ ] Add start/sit recommendations that explain projection edge, schedule edge, floor/ceiling, injury risk, draft-capital patience, and when the recommendation is too close to call.
- [ ] Add redraft valuation support that blends weekly projection, rest-of-season projection, role trend, injury/news status, schedule stretch, bye timing, and replacement-level availability.
- [ ] Add dynasty contention context that separates "start now", "hold through development", "sell on projection spike", "buy before role growth", and "do not panic because draft capital buys runway".
- [ ] Add rookie and sophomore development reads that explicitly account for draft position, NFL team investment, early usage, depth-chart barriers, and how long similar players usually get opportunities.
- [ ] Add waiver-wire priority changes based on upcoming schedule, projected usage, bye coverage, injury fill-in windows, and whether the role has multi-week staying power.
- [ ] Add a first-three-week D/ST and kicker streamer planner that scores available options by DraftSharks Week 1-3 SOS percentages, current roster fit, and complement coverage; it should recommend pairings such as keeping one defense while adding another that covers its hard Week 1 or Week 3 matchup.
- [ ] Add a Rankings-tab Schedule Edge table after DraftSharks SOS snapshots are approved: filter by position and week range, show all positions by default, include quick D/ST and K streamer filters for Week 1-3 planning, and show current rank/value, owner/availability, weekly DraftSharks percentage ratings, average/worst matchup, complement fit with rostered options, confidence, source freshness, and recommended action.
- [ ] Add trade recommendation context that distinguishes projected short-term points from dynasty value, playoff schedule leverage, contender/rebuilder fit, and fragile projection spikes.
- [ ] Add Autopilot actions that can say exactly why to start, bench, claim, stash, trade for, trade away, or hold a player based on the joined schedule/projection context.
- [ ] Add player-detail projection cards for weekly outlook, ROS outlook, schedule stretch, opponent notes, role security, draft-capital runway, confidence, and source freshness.
- [ ] Add Overview badges or notes only when projection/schedule context changes the conclusion; avoid duplicating the same read across matchup, roster, and owner tables.
- [ ] Add playoff-week views for contenders: Weeks 15-17 projected lineup strength, opponent difficulty, bye/bench pressure, handcuff value, and stash recommendations.
- [ ] Add D/ST streamer and kicker streamer projection support only if the source coverage is stable enough; otherwise keep those reads schedule/SOS based.

### AI Readout Rules

- [x] Teach AI readouts to distinguish provider projections, internal projections, schedule estimates, market-implied signals, and dynasty values in plain language.
- [x] Add confidence language that drops when projection snapshots are stale, player identity is uncertain, injury status is unresolved, or source coverage is thin.
- [x] Add "opportunity runway" explanations for rookies, high-draft-capital players, and expensive veterans so recommendations account for how long a team is likely to keep giving chances.
- [x] Add guardrails against overreacting to one-week projection swings when draft capital, contract, role, and long-term value all point the other way.
- [x] Add guardrails against blindly trusting draft capital when projection decline, usage collapse, depth-chart loss, or injury recurrence shows the opportunity window may be closing.
- [x] Add source trace text that can answer "why did the AI say this?" with the exact schedule week, opponent, projection source, projection timestamp, and biggest changing signals.
- [x] Add fallback copy for missing projections that says the app is using schedule/value context only, not true weekly projections.

### Admin Tooling, QA, And Observability

- [x] Add admin diagnostics for schedule snapshot health: current season/week coverage, games per week, missing teams, bye weeks, source timestamp, checksum changes, and parser warnings.
- [x] Add admin diagnostics for projection snapshot health: player coverage by position/team/source, stale rows, missing starters, duplicate identities, scoring-profile gaps, and source error rates.
- [x] Add admin diff tooling that compares two projection snapshots and highlights the biggest player moves, team-level shifts, injury-driven changes, and suspicious provider swings.
- [x] Add source accuracy backtests after games finish: projected vs actual by source, position, week, home/away, opponent strength, rookie status, and draft-capital bucket.
- [x] Add regression tests for schedule parsing, team-code normalization, projection normalization, identity matching, scoring conversion, stale-source fallback, and user-load provider guards.
- [ ] Add Playwright coverage for Overview, Matchup Preview, Player Detail, Autopilot, Rankings, waiver, trade, and playoff schedule surfaces with projection-enabled and projection-disabled states.
- [x] Add data seeding fixtures for one normal week, one bye-heavy week, one injury-heavy week, one rookies-heavy roster, and one playoff matchup week.
- [x] Add performance budgets so projection joins do not slow report generation; prefer precomputed static sections and cached projection contexts over per-user recomputation.
- [x] Add cache-version bumps when projection or schedule display semantics change so users do not see stale local report cards; DraftSharks-only SOS bumped both client report cache payloads and server league report cache after retiring FantasyPros matchup-calendar reads.

### Release Gates

- [x] Do not enable projection-driven lineup strength until the schedule snapshot, projection snapshot, source freshness metadata, identity matching, and fallback copy all pass diagnostics.
- [x] Do not enable projection-driven trade or dynasty recommendations until the AI readout can separate short-term projection movement from long-term dynasty value and draft-capital runway.
- [x] Do not enable projection-driven push/email/watch alerts until stale-source handling, opt-out controls, and alert-rate limits are in place.
- [x] Do not show provider names in public-facing projection claims unless the source agreement allows user-facing attribution.
- [x] Ship first to admin-only traces, then internal leagues, then a limited production flag, then general availability after two or more clean weekly refresh cycles.

## FantasyPros Integration Roadmap

- [x] Store the FantasyPros key only in server env as `FANTASYPROS_API_KEY`, keep it out of source control/client bundles/logs, and document the production deployment step.
- [x] Confirm FantasyPros production terms, rate limits, and non-commercial restrictions before making it a primary valuation source.
- [x] Add source-health checks for every FantasyPros endpoint we plan to depend on, including row counts, last updated date, expert count, and rate-limit/error status.
- [x] Add separate feature flags for FantasyPros sub-sources so `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, `ROOKIES`, `ADP`, projections, injuries, news, and player-points can be rolled out or disabled independently.
- [x] Add a safe FantasyPros smoke/diagnostics command that checks planned endpoints and prints only status, row counts, freshness, expert counts, and errors, never the API key or raw payload.
- [x] Audit FantasyPros documented NFL endpoints against Dynasty Degens features and AI readouts; see `docs/fantasypros-endpoint-feature-audit.md`.
- [x] Pin current ranking-source defaults to the 2026 season via `RANKINGS_SEASON`, with FantasyPros/redraft/dynasty loaders sharing the same season helper so they do not silently fall back to 2025.
- [x] Expand the FantasyPros client to support all useful NFL ranking types: `DRAFT`, `ROS`, `DYNASTY`, `DEVY`, `ROOKIES`, `ADP`, `DYNADP`, and `RKADP` where available.
- [x] Wire FantasyPros `DYNASTY` rankings into the dynasty valuation blend as a true dynasty source with its own adaptive trust weight, separate from redraft/season values.
- [x] Wire FantasyPros `DEVY` rankings into the devy/prospect blend and compare against KTC Devy and Prospect Archive before raising its weight; Flock Fantasy devy is excluded because Flock does not publish a devy board.
- [x] Archive historical FantasyPros consensus ranking snapshots from the API for `DYNASTY`, `DRAFT`, `ROS`, `ADP`, `DYNADP`, `RKADP`, `DEVY`, and `ROOKIES`, with source `last_updated`, expert counts, scoring, date policy, and source-specific formats preserved for future reblends.
- [ ] Wire FantasyPros `ROOKIES` rankings into rookie/prospect valuations and rookie draft decision reads.
- [ ] Wire FantasyPros `ADP`, `DYNADP`, and `RKADP` into draft-cost context, value-over-cost reads, and admin source diagnostics.
- [x] Keep FantasyPros `DRAFT` and `ROS` rankings in the redraft/current-season space only, with scoring-aware `PPR`, `HALF`, and `STD` profiles.
- [ ] Add FantasyPros projections after validating the endpoint under normal rate limits; use weekly, preseason, and rest-of-season projections for lineup strength, matchup preview, and redraft valuation support.
- [x] Add throttled FantasyPros source-health probes for underused endpoints: weekly ECR, `WW` rankings, targets, articles, compare-players, projections, player-points, players, news, and injuries; include retry-after/backoff handling before adding more snapshots.
- [x] Add a snapshot writer for responding FantasyPros endpoints behind `ENABLE_FANTASYPROS_ENDPOINT_SNAPSHOTS`, with the same pacing and stop-on-429 behavior as health checks so cron/admin refreshes can persist endpoint payloads without user-load API calls.
- [x] Add a stored-snapshot read/normalization layer for FantasyPros weekly ECR, `WW`, projections, player-points, players/external IDs, and compare-player payloads, then feed row counts into report/admin source freshness diagnostics.
- [x] Add rolling next-three-week FantasyPros weekly ECR snapshot fan-out for QB/RB/WR/TE/K/DST, keyed by current NFL week plus week window so scheduled refreshes and report diagnostics move from Weeks 1-3 to Weeks 2-4 after Week 1.
- [x] Schedule the FantasyPros endpoint snapshot scrape weekly on Tuesdays at noon Pacific, with route-side guards and a daily opt-in flag only if endpoint calls prove cheap enough.
- [ ] Recheck FantasyPros `WW` waiver-wire ranking snapshots closer to the season; the endpoint is reachable but currently returns `200` with zero rows for early 2026 Week 1 probes.
- [ ] Add FantasyPros targets snapshots after package access is approved and the endpoint returns `200`; join them with existing usage context so waiver intelligence can detect role growth without pretending targets are route share.
- [x] Retire FantasyPros matchup-calendar snapshots after DraftSharks coverage is live; keep them out of `PlayerScheduleProfile`, streamer weeks, start/sit edges, D/ST/K pairings, waiver intelligence actions, source freshness checks, and scheduled/admin refreshes.
- [ ] Use FantasyPros player-points history to validate prior-season production, weekly consistency, and value-confidence calibration.
- [ ] Use FantasyPros injuries and practice-report probabilities in player availability, lineup risk, and AI confidence notes.
- [ ] Use FantasyPros news categories for player-specific news, injury, transaction, rumor, and breaking-news context, then connect news timestamps to value movement when snapshots overlap.
- [x] Normalize or enrich `latestNews.url` from upstream news payloads so the player modal's latest-news card stays clickable whenever the source provides a link.
- [ ] Use FantasyPros player IDs and external IDs to improve cross-source identity matching for ESPN, Yahoo, MFL, Fleaflicker, Fantrax, NFL, CBS, DraftKings, and other platform IDs.
- [ ] Add expert metadata and expert publication timestamps to admin diagnostics so stale or thin expert sets lower source trust automatically.
- [ ] Evaluate the FantasyPros compare-players endpoint for player modal context and trade comparison explainers.
- [ ] Evaluate FantasyPros articles as an admin/research-assistant context source only after package access is approved; if used, store attribution, category, URL, published timestamp, and freshness without replacing player-level data signals.
- [x] Add cache/rate-limit protection for FantasyPros calls so report generation does not hammer the API during refresh jobs.
- [x] Add admin-only visibility for FantasyPros endpoint coverage, effective weights, trust movement, stale data, and high-impact valuation changes.
- [x] Add FantasyPros weekly ECR source traces to waiver AI Targets so the card can show exact stored endpoint keys, weeks, row counts, freshness, and rank evidence behind the recommendation.
- [x] Add FantasyPros value-profile rows to the admin per-player source trace UI so admins can see dynasty/current-season FantasyPros fields, preserved endpoint keys when available, and honest fallback copy when a blended row no longer has endpoint lineage.
- [ ] Extend the per-player source trace beyond value-profile rows to normalized `DEVY`, `ROOKIES`, ADP, news, injuries, projections, and player-points snapshot context as those feeds start directly affecting player readouts.
- [ ] Add unit tests for each FantasyPros payload normalizer and integration tests for dynasty, redraft, devy, rookie, ADP, injury, news, projection, and player-points diagnostics.

## Draft Baseline / League Mode Roadmap

- [x] After deployment, run the expanded production smoke checks for all four target leagues: `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`.
- [x] Re-check weekly risers and fallers on May 14 or May 15, 2026 after the temporary May 7 baseline floor ages out of the 7-day lookback; production DB audit compared `2026-05-15` against `2026-05-08`.
- [x] Extreme weekly percentages still appear after the 7-day lookback catches up; investigated source volatility, tiny baseline/current values, and source identity mismatches. Weekly movement rows now reuse a report relevance gate so fringe/unranked TE20-style movement does not surface as user-facing risers/fallers.
- [x] Keep 2026 rookie draft labels as `Early Riser` and `Early Faller` through preseason, then switch to `Hit` and `Miss` when the season evaluation window opens.
- [x] Add an admin-only weekly movement anomaly report for extreme movers, low-denominator baselines, and suspicious source swings.

## Waiver / Trade Intelligence Roadmap

- [ ] Review waiver `won/lost` and trade `acted/blocked` outcomes after enough real samples accumulate, then tune confidence weights against actual results.
- [ ] Track in-season usage trends over the course of the season, especially targets, rush attempts, and snap share, so waiver calculations can surface players whose role is growing before the box score catches up.
- [x] Add all-position rolling FantasyPros ECR context to waiver intelligence so AI Targets can score QB/RB/WR/TE/K/DEF pickups from the next three-week window without defaulting to D/ST or K, while rank gates keep low-quality players from being over-promoted.
- [x] Add an admin accuracy panel for prediction quality by module: waiver bid range, waiver competition, trade resistance, and depth-chart role confidence.
- [x] Extend Full Trade Ledger balancing-piece suggestions from trade-time players to trade-time picks by reconstructing historical pick inventory per roster/date; never suggest a pick unless that manager actually controlled it at the time of the deal.
- [x] Add historical Sleeper backfill observability showing scanned league IDs, transaction counts, seasons loaded, failures, and broken `previous_league_id` chains.
- [x] Add depth-chart cache health diagnostics showing last warm time, loaded teams, failed teams, retry count, and stale team coverage.
- [x] Move recommendation outcome detection into a backend job so confidence can improve even when the user does not reopen the report UI.
- [x] Use Sleeper completed waiver transactions, including prior-season league-chain rows, as winning-bid evidence for waiver ranges; current-season bids are weighted above last-season samples, and stored prediction outcomes can grade FAAB ranges from actual winning bids.
- [ ] Later approved Sleeper hidden-transaction import: safely capture pending/proposed/cancelled/failed/rejected waiver and trade rows, including managers, players, bid or priority context, and pending claim visibility, without depending on normal public completed-transaction feeds.
  - [ ] Research a safe user-consented Sleeper account connection path that does not require users to paste raw OAuth/session tokens: check whether Sleeper offers official OAuth, app authorization, deep-link approval, partner API access, or another approved flow. Do not collect passwords or bypass auth; only use approved access to read cancelled trades, pending/cancelled waiver claims, waiver bid amounts, losing/skipped claims where available, and hidden trade status history.
    - [ ] When testing reaches the account-connection stage, start only with explicitly consenting admin/test accounts: `mynameisbillex`, `zojozo`, and `AwwQQ`. Keep the test scoped to their consented Sleeper accounts and document exactly what hidden trade/waiver fields are readable before expanding.
  - [ ] If Sleeper does not provide an approved account-level connection, document the limitation and design fallback options: explicit user export/import, admin-only manual evidence labeling, public completed-transaction learning, and optional browser-assisted local capture that never sends raw tokens to the server.
- [ ] Add waiver-priority league calibration.
  - [x] Detect Sleeper FAAB versus waiver-priority leagues in league diagnostics and show priority-burn urgency instead of exact bid ranges when no FAAB exists.
  - [ ] Add manager waiver order/standings context when Sleeper exposes it, then tune priority-burn language by league activity and manager history.
- [ ] Add league/cohort calibration fallback: learn manager behavior inside the exact league first, then use similar-league cohorts only when local samples are thin, bucketed by FAAB versus waiver priority, redraft/dynasty, team count, scoring, lineup format, and activity level.
  - [x] Add first-pass calibration fallback priority: exact manager, exact league, manager archetype, league sharpness cohort, format/waiver/QB/team-count cohort, then generic baseline.
- [ ] After 2026 weekly games begin, review the admin Module Accuracy rows weekly and tune confidence caps only when each module has enough resolved samples.
- [ ] After 2026 waivers begin processing, capture skipped claims, losing bids where available, waiver-priority results, and follow-up production so waiver bid-range calibration can move past sample-size caps.
- [ ] After 2026 trades start, classify accepted, rejected, countered, expired, blocked, and regretted trade recommendations from Sleeper statuses where available, then fall back to admin/user labeling only for outcomes Sleeper does not expose.
  - [x] Build first-pass visible proposal-status calibration for Trade War Room so accepted/countered/blocked/pending proposal history can adjust negotiation score, chips, and summary copy.
  - [ ] Extend this calibration with hidden/cancelled/pending account-level fields after the consented Sleeper connection path is approved and tested.
- [ ] Add recommendation grading windows by format: redraft recommendations grade at end of season against final standings, playoff finish, points for, roster usage, and title outcome; dynasty draft recommendations use a 2-year outcome window before final hit/miss labels.
- [ ] In August 2026, ask Billy to re-review projection sources when weekly projections are live: compare Sleeper projections against DraftSharks, FantasyPros, and any approved export/API source, then choose the baseline used for start/sit, streamers, and calibration.
- [ ] After 2026 depth charts and practice reports are live, compare role/depth-chart confidence against snaps, routes, targets, carries, starter status, and injury outcomes before raising role-read confidence.
- [x] Remove the legacy `trade-recommendation-outcomes:v1` localStorage migration read after shared action-plan storage has been live long enough.

## Completed Features

### Core Infrastructure
- [x] Header layout finalized: Dynasty Degenerates logo/title on left, league name (larger font) on right
- [x] League logo from Sleeper API displayed next to league name in header
- [x] All section headers centered across all tabs
- [x] Footer section with "Analyze Another League" and "Export CSV" buttons
- [x] Input field label and league ID value centered on landing page
- [x] All tables updated with consistent centering (flex justify-center wrappers)
- [x] Dynasty Degenerates logo set as favicon

### Draft History Tab
- [x] Draft History tab created with Full Draft Board and Draft Capital Efficiency tables
- [x] Redraft Draft History now stays visible for prior-year draft history when draft data exists, while no-draft redraft leagues hide the empty draft surface and fall back to Overview from `#draft`.
- [x] Draft data fetching updated to pull from both current and previous league seasons
- [x] Filter added to only include rookie drafts with fewer than 100 picks
- [x] Manager names correctly resolved using user_id-to-name mapping
- [x] Draft Capital Efficiency numbers rounded to whole numbers (no decimals)
- [x] Color-coded value change indicators (green/red with trending arrows) implemented
- [x] Draft picks display with proper KTC value matching using slug-based lookup
- [x] Table widths made consistent: Draft Capital Efficiency (max-w-6xl) and Full Draft Board (max-w-7xl)

### KTC Historical Data Integration
- [x] Wayback Machine scraper infrastructure created
- [x] May 2025 KTC rookie data successfully scraped from archive (96 players)
- [x] Verified correct values: Ashton Jeanty = 7830, Omarion Hampton = 6241
- [x] waybackMachineScraper.ts created with getMay2025KTCSnapshot() function
- [x] draftAnalysis.ts updated to use May 2025 KTC values for value change calculations
- [x] routers.ts updated to pass May 2025 KTC data to analyzeDraftPicks
- [x] Value Change column now shows accurate draft-day value comparisons
- [x] Flexible slug matching implemented to handle both simple and hyphenated player slugs
- [x] Browser tested: Value changes correctly calculated (e.g., Ashton Jeanty -364, Omarion Hampton +556)
- [x] Position rank data extracted from May 2025 snapshot (60+ players with RB/WR/QB/TE rankings)
- [x] Position Rank (May 2025) column added to Draft Board table
- [x] DraftPick interface updated with position rank fields
- [x] Browser tested: Position ranks displayed correctly (e.g., Ashton Jeanty RB3, Omarion Hampton RB5)
- [x] All 22 unit tests passing

### Database & Scheduled Jobs
- [x] ktcSnapshots database table confirmed to exist and be properly configured
- [x] KTC Tuesday 11 PM snapshot job confirmed in place (ktcSnapshotJob.ts + scheduledJobs.ts)

### Draft Year & Position Rank Tracking
- [x] Add draft year labels (2025 vs 2026) to Full Draft Board
- [x] Add Current Position Rank column to Draft Board
- [x] Add Position Change column (green/red with spot movement)
- [x] Fetch current KTC position ranks for all players
- [x] Calculate position rank changes (current - May 2025)
- [x] Created currentKTCLoader.ts to load current position ranks
- [x] Updated draftAnalysis.ts to handle position rank calculations
- [x] Updated DraftAnalysis.tsx to display all new columns
- [x] Browser tested: Position changes displaying correctly (e.g., Ashton Jeanty +1, Travis Hunter +3)
- [x] All 22 unit tests passing

### Live KTC Scraper Integration (Superflex)
- [x] Create liveKTCScraper.ts to fetch current KTC rankings from keeptradecut.com
- [x] Parse playersArray JSON from KTC page (500+ players)
- [x] Extract position ranks (RB1, RB2, WR1, etc.) and KTC values from Superflex data
- [x] Use pre-calculated superflex.value and superflex.positionalRank fields
- [x] Update currentKTCLoader.ts to use live scraper instead of static file
- [x] Ensure position rank changes calculate correctly with live Superflex data
- [x] Browser tested: Live Superflex KTC data displaying correctly (Josh Allen 9998, Bijan Robinson 9993, etc.)
- [x] All 22 unit tests passing
- [x] Set up weekly scheduled job to run live KTC scraper (e.g., Tuesday 11 PM)
- [x] Store weekly KTC snapshots in database for historical tracking

## Future Features (Optional)
- [x] Waiver wire activity tracker tab (covered by Weekly Momentum trending adds/drops plus Overview Waiver Intelligence)
- [x] Bench vs Start analysis (covered by projected starter room, bench baseline, and starting roster strength modules)
- [x] Historical KTC tracking for non-rookie drafts (covered by stored weekly market snapshots and 7-day comparison logic)
- [x] Draft class comparison tools (covered by Draft Decision Audit plus dynasty/college rankings boards)

## Current Issues to Fix
- [x] Draft year showing 2026 instead of 2025 for all picks
- [x] Manager names showing "Unknown" instead of resolved names
- [x] Remove Year column from Full Draft Board table
- [x] Remove Draft Pick Position column from Full Draft Board table
- [x] Rename "Position Rank (May 2025)" to "Drafted Rank"
- [x] Rename "Current Position Rank" to "Current Rank"
- [x] Fix table width to prevent column cutoff
- [x] Add header "2025 Rookie Draft" (or appropriate year) above Full Draft Board table

### Draft Capital Efficiency Interactive Feature
- [x] Make manager names clickable in Draft Capital Efficiency table
- [x] Create modal component to display manager's draft picks
- [x] Modal shows: Player Name, Position, Position Change, Value Change
- [x] Test modal functionality and ensure all tests pass

### KTC Data Expansion
- [x] Updated live KTC scraper to fetch 500 players across 10 pages instead of just first page
- [x] Fixed data incongruences for Trevor Etienne and Jarquez Hunter by expanding scraper reach
- [x] Verified all 22 tests passing after scraper update

### Data Quality Fixes
- [x] Fixed Jarquez Hunter and Trevor Etienne showing WR90 instead of N/A when not in current KTC data
- [x] Updated draftAnalysis.ts to return null instead of fallback values
- [x] All 22 tests passing after fix

### Hit/Miss Threshold Update
- [x] Updated hit/miss calculation thresholds from 5 position ranks/500 value to 10 position ranks/750 value
- [x] All 22 tests passing after threshold update

### Modal & Sorting Enhancements
- [x] Added Current Rank and Current Value columns to manager draft picks modal
- [x] Made Current Value column sortable in Full Draft Board table (ascending/descending)
- [x] Made Value Change column sortable in Full Draft Board table (ascending/descending)
- [x] Added visual indicator (arrow icon) to show which column is sorted
- [x] All 22 tests passing after enhancements

### Position Depth & Manager Position Counts
- [x] Update Position Depth Analysis thresholds (QB: 4/5, RB: 8/12, WR: 8/12, TE: 4/6)
- [x] Add Manager Position Counts table to Overview page
- [x] Display QB, RB, WR, TE counts per manager
- [x] All 22 tests passing after changes

### Dynamic Position Depth Thresholds
- [x] Updated Position Depth Analysis to calculate thresholds dynamically
- [x] Thresholds now based on min/max of actual manager position counts
- [x] Shortage = below league minimum, Excess = above league maximum
- [x] All 22 tests passing after dynamic threshold implementation

### Player Headshots Feature
- [x] Attempted Sleeper API headshots (403 Forbidden - blocked)
- [x] Attempted NFL.com headshots (TLS connection errors blocking league data load)
- [x] Attempted Pro Football Reference headshots (403 Forbidden - blocked)
- [x] Attempted ESPN headshots (500 errors - blocked)
- [x] Implemented image proxy service with browser headers to bypass CDN restrictions
- [x] Created imageProxy.ts with caching service (7-day TTL)
- [x] Added images.playerHeadshot tRPC endpoint
- [x] Updated PlayerDetailModal to display headshots
- [x] All 22 tests passing

### Player Detail Modal for Draft Board
- [x] Create PlayerDetailModal component showing all player data in multi-row format
- [x] Make player names clickable in Full Draft Board table
- [x] Modal shows: Drafted Rank, Current Rank, Position Change, Current Value, Value Change, ADP, Manager, Round, Pick #
- [x] Optimize modal layout for mobile (no horizontal scrolling)
- [x] Update Full Draft Board table columns to show: Pick, Player, Position Change, Current Value, Value Change
- [x] Remove other columns from main table (Drafted Rank, Current Rank, ADP, Manager, Round, etc.)
- [x] Restore sorting for Current Value and Value Change columns
- [x] All 22 tests passing after changes

### Modal Refinements
- [x] Remove ADP field from player detail modal
- [x] Fix Draft Value to show original draft-time value (Current Value - Value Change)
- [x] All 22 tests passing after refinements

### GitHub Push & Table Updates
- [x] Push current state to GitHub
- [x] Simplify Trade Ledger table to show: Date, Winner, Loser, Gap (keep modal data as is)
- [x] Make entire rows clickable to open modals (Draft Board and Trade Ledger)
- [x] All 22 tests passing after changes

### Draft Capital Efficiency & Manager Picks Integration
- [x] Make entire rows in Draft Capital Efficiency table clickable to open manager picks modal
- [x] Update ManagerDraftPicksModal to support player detail modal on player row clicks
- [x] Player rows in manager picks modal open the same player detail modal as Draft Board
- [x] Keep dynasty Draft Capital Efficiency stats and manager drilldowns scoped to rookie draft picks only, while leaving redraft recap and full draft boards on their broader draft data.
- [x] All 22 tests passing after changes

### Starters Column in Draft Capital Efficiency
- [x] Add Starters column to Draft Capital Efficiency table
- [x] Count players with KTC value > 4000 for each manager
- [x] Display count in new Starters column
- [x] All 22 tests passing after changes

### Headshots Next to Player Names
- [x] Add small circular headshots next to player names in Draft Board table
- [x] Add small circular headshots next to player names in manager draft picks modal
- [x] Optimize headshot size for mobile readability (6px on mobile, 7px on desktop)
- [x] Use flexbox layout to keep text readable on mobile
- [x] All 22 tests passing after changes

### Headshots in Weekly Risers and Fallers
- [x] Add headshots next to player names in Weekly Risers table
- [x] Add headshots next to player names in Weekly Fallers table
- [x] All 22 tests passing after changes

### Manager Position Counts - Starters Sub-Columns
- [x] Add Starters sub-column next to QB count (QB S)
- [x] Add Starters sub-column next to RB count (RB S)
- [x] Add Starters sub-column next to WR count (WR S)
- [x] Add Starters sub-column next to TE count (TE S)
- [x] Count players with value > 4000 for each position
- [x] Update ManagerDraftStats type to include starter counts per position
- [x] All 22 tests passing after changes

### Trade Ledger Headshots
- [x] Add player headshots next to player names in Full Trade Ledger expanded rows
- [x] Display headshots for both team A and team B players
- [x] All 22 tests passing after changes

### Full Trade Ledger Timeline Lens
- [x] Show contender/rebuilder pills on Full Trade Ledger managers and use that lens for displayed player values, side totals, gap, and winner
- [x] Reconstruct each manager's contender/rebuilder state as of the actual trade date instead of only using the current report timeline snapshot
- [x] Add a small explanatory note or tooltip so managers know when a trade is being skewed by contender vs rebuilder value context

### KTC Scraper Trigger
- [x] Manually trigger KTC scraper to run now (should have run Tuesday 11 PM)
- [x] Verify fresh data is fetched and cached

### KTC Scraper Schedule Update
- [x] Change KTC scraper to run at 5 PM (17:00) Tuesday instead of 11 PM (23:00)
- [x] Update scheduledJobs.ts to reflect new time
- [x] Verify scraper still runs correctly at new time

## Current Debugging Tasks - COMPLETED

### Trade Ledger Headshots Issue
- [x] Debug why headshots not displaying in Full Trade Ledger expanded rows (was splitting by newline instead of comma)
- [x] Verify PlayerNameWithHeadshot component receives correct player names
- [x] Check if trade item parsing is stripping player names correctly (added filtering for picks/adjustments)
- [x] Test headshot display with sample trade data

### KTC Data Freshness Issues
- [x] Verify latest scrape (464 players) was actually cached and is being used
- [x] Check if weekly momentum is comparing correct data (fixed to use previous week snapshot)
- [x] Check if rookie draft comparisons are using May 2025 vs latest scrape (confirmed correct)
- [x] Verify value changes are calculating with fresh data
- [x] Update weekly momentum calculation to use latest scrape vs previous week snapshot
- [x] Update rookie draft to compare May 2025 vs latest scrape (already correct)

### Data Comparison Logic
- [x] Weekly Momentum: Now compares latest scrape to previous Tuesday snapshot (7 days ago)
- [x] Rookie Draft: Confirmed compares May 2025 snapshot to latest scrape
- [x] Verify both comparisons are using correct data sources

## UI & UX Audit (2026-05-04)

### 🔴 Critical Mobile Fixes (High Priority)
- [x] Fix text truncation on mobile hero heading ("OBLITERATE YOUR COMPETITION")
- [x] Make input fields full-width on mobile viewports (iPhone SE/12)
- [x] Stack "Find Leagues" button vertically below the username input on small screens
- [x] Ensure all buttons have a minimum 44px height for touch targets
- [x] Fix "For Degens" header text truncation on mobile

### 🟡 Layout & Spacing Improvements (Medium Priority)
- [x] Standardize vertical gaps between all landing page sections
- [x] Implement responsive padding using CSS `clamp()` for container edges
- [x] Adjust feature cards alignment and spacing on tablet viewports (iPad Pro)
- [x] Fix inconsistent form field spacing on mobile devices

### 🟢 Desktop & Accessibility Optimizations (Low Priority)
- [x] Optimize max-width for ultra-wide screens to reduce excessive whitespace
- [x] Improve feature cards visibility/interaction on mobile (consider carousel or better stacking)
- [x] Add subtle hover states and transitions for interactive elements
- [x] Verify accessibility contrast for all text elements on dark backgrounds

## Admin Premium Command Center Expansion

### Completed Admin/Premium Access
- [x] Rename privileged access constant from `PRIVILEGED_REPORT_VIEWERS` to `ADMIN_PERMISSIONS`
- [x] Gate new premium command-center features behind admin permissions
- [x] Add admin unlock modal / regular-view mode
- [x] Make admin-only tabs and tiles visually identifiable with a subtle premium glow
- [x] Tone down premium glow so it stays behind/inside admin feature tiles instead of washing over the whole report
- [x] Verify `ADMIN_PERMISSIONS` is configured for production/preview/dev

### Completed AI Read System
- [x] Add reusable `AIReadPanel` component
- [x] Support AI Read props for title, subtitle, read type, confidence, severity, chips, body, actions, compact mode, and background variant
- [x] Add AI Read visual language with dark Tron/blueprint styling, glowing border, schematic details, confidence meter, and neon chips
- [x] Add AI Read placements across overview, manager/team cards, player detail modal, rankings, draft history, trade history, and premium command-center modules
- [x] Add AI Read action language such as roster read, market signal, trade window, lineup leak, waiver opportunity, league exploit, and monthly blueprint
- [x] Add AI Read decision bands with evidence-derived action labels, confidence/source-signal status, and concise change-trigger detail so users see the call before the explanation.
- [x] Add the shared AI Action Queue to Overview and AI Autopilot so the app shows one highest-ranked move first, with why, risk, blocker/missing-evidence context, and source-health signals.
- [x] Add `What changes this` signals to the AI Action Queue so confident reads explain the exact conditions that would downgrade, block, or replace the current call.
- [x] Add an AI Surface Registry/noise governor so one surface owns the action call, supporting reads stay context-only, unbacked reads stay hidden/data-only, and duplicate AI surfaces are marked for merge/removal.
- [x] Collapse the visible AI Action Queue to one decision by default and hold lower-ranked alternates back as source-signal context instead of showing multiple competing recommendations.

### Completed Premium Feature Modules
- [x] Monthly Team Blueprint report
- [x] Blueprint report partial-history warning so missing history is never silently invented
- [x] Blueprint copy/share text action
- [x] Blueprint print / save-PDF path
- [x] League Power Rankings
- [x] Team Breakdown and Roster Recon
- [x] Trade Finder / Fair Trade Generator
- [x] Trade Partner Finder
- [x] League Exploits module
- [x] Watch Alerts / Market Signals module
- [x] Local browser-saved watch thresholds
- [x] Local browser-saved watched players
- [x] Waiver / Free Agent Assistant
- [x] Lineup Optimizer / Starter Strength module
- [x] Portfolio View module
- [x] Local browser-saved portfolio snapshots
- [x] Cross-league exposure read when multiple league snapshots are saved locally
- [x] Rookie / Prospect Signal Score module
- [x] Research Assistant using returned FantasyPros/Sleeper news and status payloads
- [x] Matchup Preview shell with typed future `matchupPreviews` payload support
- [x] Matchup Preview schedule-pending state until real weekly matchup/projection data exists
- [x] Feature Coverage diagnostic showing Backed / Partial / Pending / Missing states
- [x] Expanded owner/team type taxonomy beyond contender/rebuilder
- [x] Add score-driven team type labels: Thanos, Title Threat, Playoff Push, Wild Card, Middle Child, Future Rich, Work In Progress, Draft Mode, Lost, and Lunch Money
- [x] Add color-coordinated pills for expanded team type labels on owner cards and manager detail views

### Completed Data Honesty Rules
- [x] Do not fake historical snapshots when missing
- [x] Do not fake player news when no news/status payload exists
- [x] Do not fake weekly matchup projections before schedule-week matchup data exists
- [x] Mark local-only features clearly when server persistence is not available yet
- [x] Mark partial-data modules clearly in Feature Coverage

### Verification Completed
- [x] Typecheck passes with `corepack pnpm check`
- [x] Production build passes with `corepack pnpm build`
- [x] Local browser smoke verified admin feature radar renders
- [x] Local browser smoke verified watch preferences save
- [x] Local browser smoke verified portfolio snapshot saves
- [x] Local browser smoke verified no horizontal overflow
- [x] Production smoke passed for dynasty and redraft leagues

## Premium / Data Roadmap

### Matchup Preview - Waiting on Real Schedule Data
- [ ] After the NFL schedule release, confirm Sleeper exposes current-week matchup IDs, opponent rosters, submitted lineups, and projection context for the target leagues.
- [x] Add server-side matchup ingestion to populate `ReportData.matchupPreviews`.
- [x] Keep the schedule-pending empty state for offseason and pre-schedule periods.
- [x] Use the schedule-release feature checklist below so we do not miss other schedule-driven surfaces.

### Schedule Release Feature Checklist

- [x] Build schedule-release data ingestion and normalization for matchup IDs, opponent rosters, submitted lineups, bye weeks, and target weeks.
- [x] Populate `schedulePlanning` with roster gaps, streamer candidates, bye-window coverage, and schedule notes from the released NFL calendar.
- [x] Fill `ReportData.matchupPreviews` and the matchup preview UI with weekly win odds, opponent edge, boom/bust, must-start, and how-you-win analysis.
- [x] Add player-detail schedule cards for season SOS, bye weeks, streamer windows, and opponent difficulty so player views get real schedule context.
- [x] Wire schedule context into `CommandCenterExpansion`, `PlayerDetailModal`, `AITeamAutopilot`, and `LeagueCommandCenter` so the same schedule data powers every surface without diverging.
- [x] Add schedule-aware autopilot guidance for roster gaps, start/sit calls, streamer targets, waiver timing, and priority actions.
- [x] Add D/ST and matchup-streamer logic driven by schedule strength, bye-week pressure, and upcoming opponent difficulty.
- [ ] Add waiver timing and bench-stash guidance for upcoming bye-week cliffs and short-term lineup pressure.
- [ ] Feed schedule context into redraft lineup strength, valuation, and confidence only after freshness checks pass.
- [ ] Add schedule-aware trade and dynasty context for short-term contention windows, playoff pushes, and easy/hard stretches.
- [ ] Add schedule badges or notes in Overview and owner-level surfaces when schedule context changes the read.
- [x] Add tests for schedule normalization, matchup mapping, bye-window rendering, streamer candidate generation, and fallback/offseason states.
- [ ] Add QA coverage for schedule-dependent surfaces across Overview, Command Center, Matchup Preview, Player Detail, Autopilot, Rankings, and trade/waiver modules.
- [x] Keep pre-schedule and offseason empty states honest until the data exists.

### Watch Alerts - Server Persistence
- [ ] Move watch thresholds from browser-local storage to user/server persistence.
- [ ] Add account-level watchlist persistence.
- [ ] Add alert delivery options later, such as in-app notifications, email, or scheduled reminders.
- [ ] Add threshold controls per watched player instead of only global rise/fall thresholds.

### Portfolio View - True Multi-League
- [ ] Persist multi-league snapshots server-side instead of relying only on browser-local snapshots.
- [ ] Add account-level player shares across all synced leagues.
- [ ] Prototype a Flock-style player exposure view that counts each player across synced leagues and shows share/exposure percentage by player.
- [ ] Add overexposure, underexposure, injury/news risk concentration, and total portfolio value across leagues.
- [ ] Add league-by-league portfolio comparison and exposure filters.

### Blueprint Export / Sharing
- [ ] Add true rendered image export for Team Blueprint.
- [ ] Add polished PDF export beyond browser print.
- [ ] Add shareable report link or saved blueprint artifact.
- [ ] Add team branding and league branding to the exported artifact.

### News / Research Assistant
- [ ] Confirm production FantasyPros news API coverage and rate limits.
- [x] Add a snapshot-backed alternate news source path for SportsDataIO/RotoBaller so player news can merge FantasyPros plus licensed SportsDataIO news when `ENABLE_SPORTSDATAIO_NEWS=true` and `SPORTSDATAIO_API_KEY` are configured.
- [ ] Validate SportsDataIO/RotoBaller news production package access, endpoint shape, rate limits, and player ID mapping before making it a required source-health signal.
- [ ] Add `FANTASY_NERDS_API_KEY` to production env after confirming the live package returns current-season rows, then verify Fantasy Nerds redraft and dynasty diagnostics load cleanly.
- [ ] Revisit GridIron Data once a key or package is available and decide whether it belongs in redraft projections, player news, or source health only.
- [ ] Revisit MySportsFeeds if they approve access, and keep it out of the blend until endpoint coverage and licensing are confirmed.
- [ ] Add source and status diagnostics when news payloads are unavailable.
- [x] Add first-pass value-movement-after-news analysis when player news exists and current/baseline value snapshots overlap; player detail AI traces now say whether news coincided with meaningful stored value movement.
- [ ] Add role and depth-chart change detection when reliable source data exists.
- [x] Add a snapshot-backed nflverse/ffverse draft-capital source so player detail and cohort AI reads can use public Sleeper/GSIS/FantasyPros/ESPN IDs, draft year, round, overall pick, draft team, and college without live provider calls during report loads.
- [x] Add `pnpm audit:situation-delta-sources` to the normal source-audit review before Player Situation Delta work so public dataset coverage, prospect snapshot years, and missing licensed route data stay visible.

### Player Value Timeline / Situation Delta
- [x] Add first-pass player value timeline data to player detail payloads from stored blended value snapshots.
- [x] Add a compact player detail graph showing stored blended value movement, latest rank, source count, and source-mix change warnings.
- [x] Keep player value timelines anchored to historical `Market Price` movement while the `Degen Gap` layer explains context-based buy/sell pressure without replacing the weighted value.
- [x] Add event markers to the graph for draft picks, trades, injuries, depth-chart movement, vacated-opportunity openings, and roster-room squeezes.
- [ ] After the next production KTC/value scrape runs, verify it writes both `ktcSnapshots` and normalized `playerValueSnapshots`, including row counts, latest snapshot timestamps, and a few sample players such as Drake London and Bijan Robinson.
- [ ] After one full seven-day window of new scrapes, re-check Weekly Momentum risers/fallers and confirm current values compare against the DB snapshot from seven days earlier, not deleted local `server/ktc-snapshots` files or stale fallback data.
- [ ] Production-smoke the player value timeline modal after the new scrape: confirm 1M/3M/6M/1Y/All windows update, the graph includes the newest point, and normal users see graph-first movement instead of the old snapshot source-history list.
- [ ] Replace or intentionally retire the skipped dynasty snapshot replay fixture now that checked-in `server/ktc-snapshots` JSON files have been removed.
- [x] Add a rookie valuation mismatch table that compares current rookie price against prospect profile, draft investment, and roster-room opportunity.
- [x] Add player-detail AI read copy that references value timeline movement directly when the value move is backed by situation-delta evidence.
- [x] Add a source-history admin panel for individual players so we can inspect KTC, FantasyCalc, DynastyProcess, Flock, Dynasty Nerds, and blended-value disagreements over time.
- [x] Backtest rookie riser/faller labels against the 2025 and 2026 draft-window baselines before making strong automated trade recommendations from them.

### Command Center Polish
- [ ] Add deeper mobile QA for all premium cards after real matchup data lands.
- [x] Collapse full AI readouts into compact mobile cards with one-line takeaways and Playwright coverage across Overview, Blueprint, Rankings, and Trade History.
- [x] Add admin AI readout coverage diagnostics for readout count by tab, missing traces, missing confidence, duplicate-risk flags, and source-limited reads.
- [x] Add visible "Why this fired" traces to owner-level AI readouts so roster, rank, trade, market, and source signals are explainable in the actual report UI.
- [x] Add E2E coverage for admin-only feature visibility.
- [x] Add E2E coverage for local watch preference persistence.
- [x] Add E2E coverage for portfolio snapshot persistence.
- [x] Add E2E coverage for blueprint print and share controls where practical.
- [ ] Rework the hidden Sleeper trade import into a guided, non-technical flow. The raw auth-token paste path is too brittle for normal users, so replace it with clearer instructions, browser-session-assisted capture, or another safer import path that does not assume users know what a token is or how to retrieve one.

## Report UX / Tooling Roadmap

### ReportTables Split - Remaining Work
- [x] Split `TradeWarRoom` out of `client/src/components/ReportTables.tsx` into a real lazy-loaded module.
- [x] Split `TradeHistoryTable` out of `client/src/components/ReportTables.tsx` into a real lazy-loaded module.
- [x] Split `TradeProfitLeaderboardTable` out of `client/src/components/ReportTables.tsx` into a real lazy-loaded module.
- [x] Keep shared trade/value helpers centralized so split modules do not duplicate logic.
- [x] Run typecheck, unit tests, build, and focused e2e after each split.

### Dirty Worktree Reconciliation
- [x] Separate report UX and tooling changes from unrelated auth, OAuth, and server cleanup changes before committing.
- [x] Review deleted auth and server files and confirm each deletion is intentional.
- [x] Review docs and todo changes separately from runtime code changes.
- [x] Keep `server/dynastySourceTrust.ts` and `server/valueBlend.ts` cleanup isolated from report UX work so typecheck fixes stay easy to verify.
- [x] Refresh the redraft trade-ledger screenshot regression whenever that UI is touched again.
- [x] Stage the final commit in logical groups instead of one mixed worktree commit.

### Production Smoke After Deploy
- [x] After deployment, run the manual `Production Smoke` GitHub workflow against `https://dynastydegens.com`.
- [x] Verify dynasty leagues `Skids Get Beat` and `The Fantasy Degenerates` still render dynasty copy, draft capital and main draft surfaces, rookie draft surfaces, and trade-value context correctly.
- [x] Verify redraft leagues `test league` and `Gov Tech Grid Iron` still avoid dynasty-first copy and prioritize current-season values.
- [x] Verify redraft draft-tab semantics: `Gov Tech Grid Iron` keeps previous-year draft history, `test league` keeps current draft history, and cached no-draft redraft reports hide the empty Draft History tab.
- [x] Confirm internal draft baseline comparison dates are not exposed in the deployed report UI.
- [x] Confirm deployed console logs do not show app errors on desktop or mobile.

### Bundle Cleanup
- [x] Use `pnpm run build:analyze` to inspect `dist/bundle-stats.html` before the next performance pass.
- [x] Reduce the remaining large `RecentTransactionsPanel` lazy chunk.
- [x] Reduce the large `WaiverIntelligencePanel`, `TradeTheftDetector`, and `TradeMarketRadar` lazy chunks while leaving `SuccessCard3D` for last.
- [x] Check whether shared helpers pulled from `ReportTables.tsx` keep too much code in downstream chunks.
- [x] Reduce the deferred `SuccessCard3D` lazy chunk by removing the postprocessing bloom path and adding reduced-motion/non-WebGL fallback rendering.
- [x] Consider extracting trade-ledger helpers into a non-React utility module once `TradeHistoryTable` and `TradeWarRoom` are split.

### Research / Product Ideas
- [x] Investigate FantasyPros VORP rankings on [FantasyPros VORP](https://www.fantasypros.com/nfl/rankings/vorp.php), confirm how the metric is calculated, and decide whether it should inform any existing valuation or draft surfaces.
- [x] Check whether the Sleeper API exposes draft data or trade data from leagues beyond our own so we can store it for later analysis and product ideas.
- [x] Summarize the top fantasy football + AI YouTube videos and extract any repeat ideas, workflows, or features we could implement.
- [x] Outline how a Chrome extension could help draft players using multiple criteria, rankings, and context signals.
- [x] Trace any existing references to the AI chatbot in the codebase and docs, then explain what it currently does or where it still needs to be defined.
- [x] Review [Dynasty Daddy fantasy rankings](https://dynasty-daddy.com/fantasy-rankings/lamarjacksonqb?league=1312139584427012096&year=2026&platform=0&userId=472986961783549952&teamId=3) for feature ideas, layout ideas, and any useful ranking or league-context capabilities we should consider.
- [ ] Build a competitor-inspired Trade Intelligence Hub from FantasyPros, KTC, RosterAudit, Dynasty Nerds, RotoTrade, DraftWiz, and DynastyGPT ideas: one surface for trade finder, trade grading, player/pick comps, closest-value counters, consolidation warnings, roster-fit warnings, and manager-specific acceptability. It should power Trade War Room, trade ledgers, player modals, and AI trade readouts.
- [ ] Add a real-trade comp explorer inspired by RosterAudit/FantasyCalc-style market data: search by player, pick, position bucket, package size, scoring format, league size, and time window; show accepted trade examples, median package shape, overpay/underpay bands, and confidence. Use it for valuations, trade readouts, draft recommendations, and "what would this manager accept" suggestions.
- [ ] Add owner scouting and negotiation profiles inspired by DynastyGPT/RosterAudit: each manager gets trade behavior, pick-hoarding, contender/rebuilder bias, roster-construction habits, position shopping lists, past deal grades, and negotiation notes. Use it for Trade War Room counters, rivalry ledgers, manager inventory, and AI trade explanations.
- [ ] Add a dynasty draft and rookie-pick command center inspired by Dynasty Nerds/Dynasty Daddy/DynastyGPT mock tools: likely available players by pick, trade-up/trade-down partners, rookie ADP vs blended value, class-strength tiers, landing-spot opportunity, and pick liquidity. Use it for rookie drafts, draft pick valuations, breakout reads, and rebuild plans.
- [ ] Add a weekly lineup and waiver command center inspired by FantasyPros, DraftWiz, RotoTrade, and Draft Sharks: start/sit, add/drop, top available, FAAB bid range, matchup/SOS, injury/practice risk, roster needs, and opponent blocking. Use it for redraft reports, contender mode, waiver intelligence, and weekly AI readouts.
- [ ] Add a portfolio and exposure dashboard inspired by FantasyPros Multi-League Assistant and Dynasty Nerds Team Portfolio: player shares, risky overexposure, stack/correlation, bye-week clusters, injury clusters, rebuild/contender exposure, and cross-league buy/sell alerts. Use it for multi-league users, player valuations, and weekly risk notes.
- [ ] Add player trajectory cards inspired by RotoTrade pros/cons, Dynasty Nerds data hub, and DraftWiz rationale: value history, source-rank movement, production vs opportunity, depth-chart competition, coaching/play-calling context, injuries, contract age, and clear buy/sell/hold reasons. Use it for player modals, rankings, trade readouts, and breakout/regression reports.
  - [ ] Wire the server-side `playerTrajectory` signal engine into the Player Detail Modal and lightweight ranking-table chips after the current Home/report-shell refactor settles, keeping the UI follow-up scoped to modal/rankings surfaces.
- [ ] Add league content generation inspired by DynastyGPT: weekly league recap, matchup preview, manager spotlight, trade reaction, rivalry note, and power-ranking movement copy generated from real rosters, standings, trades, waivers, and manager profiles. Keep it optional and league-specific so it adds context without replacing the core report.
- [x] Add a one-time historical value archive pipeline that stores immutable raw source history locally, imports approved CSV/JSON value exports, reblends derived timelines when weights change, and backtests riser/faller outcomes without mutating the original source archive.
- [x] Add a controlled one-time KTC/Flock historical source backfill runner using direct KTC player value graph payloads and direct Flock clicked-player ranking history endpoints, with date windows, throttling, resume/sample controls, league-format capture, and frozen raw source archive output.
- [x] Run the one-time four-year historical value backfill from direct player pages/API endpoints, then archive the raw source values by player/date/source/league format so future blend-weight changes can regenerate charts from the same frozen inputs.
- [x] Add FantasyCalc and FantasyPros to the frozen source-history archive: FantasyCalc direct player value histories for dynasty Superflex/1QB, FantasyPros ranking snapshots for dynasty/redraft/ADP/devy/rookie context, and merged source-coverage audits before reblending.
- [x] Add partial Dynasty Nerds and Fantasy Nerds history from stored Dynasty Degen source snapshots, keep the source metadata explicit, and do not import Fantasy Nerds `TEST` API rows or claim full source-native history when only local snapshots exist.
- [x] Add a weighted-value source registry and coverage audit so KTC/Flock are only the first archived sources, while FantasyCalc, FantasyPros, DynastyProcess, Dynasty Nerds, Fantasy Nerds, benchmark-only sources, and future licensed usage providers all have an explicit archive/import status before they can affect future blend weights.
- [x] Add an app-owned cached blend promotion path so stored SF/1QB/TEP profile snapshots can become durable fallback historical value archives with coverage audits before timeline shard rebuilds.
- [x] Add a waiver AI trust gate and admin review list so thin or guessed waiver candidates are omitted from user-facing pickup ideas, with reasons for deeper source review instead of leaking names like Dallen/Dallas Bentley into AI recommendations.
- [x] Normalize historical value identities with high-confidence suffix/name merges only, preserve kicker/defense/IDP rows for formats that use them, and re-audit/reblend the canonical archive.
- [x] Add historical value weight calibration plus a compact player timeline index so player modals can show 3M/6M/1Y/all-time value, positional rank, and all-time high/low dates from the frozen archive.
- [x] Create a compressed local value-history backup bundle with checksums, plus provider-specific import templates and a merge command so approved future source exports can join the same raw archive before reblending.
- [ ] Build a future Redraft Draft Coach / draft-outcome warehouse that stays separate from the dynasty value-history archive and uses historical draft cost, roster construction, and actual season outcomes to recommend who to select in redraft leagues and why.
  - [x] Audit public internet sources for redraft draft-strategy and league-winner evidence, and document that public articles/datasets are useful benchmark priors but do not replace app-owned aggregate champion draft-path analysis. See `docs/redraft-draft-strategy-source-audit.md`.
  - [ ] Build a public benchmark registry for aggregate/player-level strategy priors from Fantasy Points, CBS, Yahoo championship roster recaps, Kaggle ADP/stat datasets, and similar sources, with source confidence and redistribution notes.
  - [x] Build an aggregate-only redraft draft-winner analyzer that accepts known/shared Sleeper league IDs, counts champion and top-points position sequences by format bucket, and prints only aggregate JSON without storing raw league/user/player rows.
  - [x] Extend the aggregate-only redraft draft-winner analyzer with username-linked manager-network discovery, completed-season-only defaults, strict depth/manager/league/rate caps, optional aggregate JSON output, and no raw league/user/player persistence.
  - [x] Retain the sanitized aggregate-only redraft strategy evidence layer in `server/redraft-draft-outcomes/redraft-draft-outcomes-v2-baseline.json`, with format, season, draft type, draft slot, opening-sequence, champion-strategy, and top-points cross-check counts but no raw league/user/roster/player rows.
  - [x] Build the app-facing derived strategy rules file in `server/redraft-draft-outcomes/redraft-strategy-rules-v1.json` plus `pnpm build:redraft-strategy-rules`, so the future Draft Coach can load confidence-scored format rules without parsing the full aggregate every time.
  - [x] Build a separate redraft value-history archive in `server/redraft-value-history/` plus `pnpm build:redraft-value-history`, using stored FantasyPros `DRAFT`/`ADP`/`ROS` history and current redraft source snapshots for static draft-cost, ROS, high/low, and movement graph inputs without live provider calls.
  - [ ] Later, wire `redraft-strategy-rules-v1.json` into the Draft Coach experience: match the current league format bucket, apply draft-slot notes, explain first-round lean/avoid guidance, and label recommendations as strong, medium, close-call, thin, or research-only.
  - [ ] Store Sleeper redraft draft boards from user-loaded or explicitly shared leagues with draft slot, round, pick number, player, roster position, league size, scoring, lineup slots, draft type, and timestamp.
  - [ ] Backfill final redraft season outcomes for those same leagues: standings, points for, playoff teams, champion, weekly matchups, submitted lineups, optimal lineup where available, transactions, and final rosters.
  - [ ] Normalize league format buckets before comparing drafts: 1QB vs superflex, 10/12/14 teams, PPR/half/standard, flex count, bench size, TE premium, kicker/DST settings, snake vs auction, and draft slot.
  - [ ] Snapshot approved redraft ADP/ECR/projection/auction-value sources at draft time so every pick can compare actual draft cost against pre-draft expectation without relying on future rankings.
  - [ ] Wire `redraft-value-trends-v1.json` into player modals and the future Draft Coach so redraft graphs can show latest value, positional rank, 30/90/180/365-day movement, and all-time high/low by date/source/scoring.
  - [ ] Classify roster-construction strategies by draft path: RB/RB, WR/WR, hero RB, zero RB, elite QB early, late-round QB, early TE, punt TE, balanced start, upside bench, floor bench, handcuff-heavy, and bye-week-aware builds.
  - [ ] Measure which draft paths actually win by comparable format bucket, while controlling for draft slot, injury luck, waiver activity, trade activity, lineup quality, manager activity, and league sharpness.
  - [ ] Build a manager-network FAAB discovery crawl: start from managers in Billy's known/shared Sleeper leagues, enumerate every public league those managers are in, then continue outward through shared managers until the aggregate-only analyzer reaches roughly 5,000 eligible leagues or hits strict rate/privacy caps. Store only sanitized league IDs/format buckets and aggregate counts needed for analysis; avoid raw private user/player persistence unless the league was explicitly shared.
  - [ ] Build a redraft FAAB outcome analyzer for explicitly shared FAAB leagues: normalize each league's FAAB budget to percentages, compare champion/top-points teams against early/mid/late-season spend patterns, first big bid timing, position bought, remaining budget, waiver volume, and draft path, then use it to learn when aggressive FAAB spending actually wins versus when patience wins.
    - [ ] After the FAAB crawl has enough leagues, answer the model questions that matter for recommendations: how often champions spend 0-25/25-50/50-75/75-100% of FAAB by week 4, week 8, and playoffs; which positions deserve the first big bid; what bid sizes win by player archetype; when holding budget beats aggression; how much remaining budget contenders keep entering playoffs; whether trade-heavy leagues need different FAAB advice; and which league formats punish wasted early bids.
    - [ ] Use manager-level behavior features from the crawl as calibration inputs: aggressive versus patient bidders, weekly churn rate, bid concentration on RB/WR/QB/TE/K/DEF, free-agent timing, willingness to spend after injuries, playoff stash behavior, and whether each manager usually overpays, underbids, or waits.
    - [ ] Compare exact-league history against broader cohort priors: exact manager and exact league first, then similar-league fallback by FAAB budget, team count, scoring, roster size, lineup format, waiver activity, trade activity, and historical sharpness.
    - [ ] Add admin diagnostics for FAAB crawl coverage: scanned managers, scanned leagues, eligible FAAB leagues, excluded non-FAAB leagues, public/private failures, rate-limit pauses, season coverage, completed-season count, and sample-size caps by format bucket.
  - [ ] Add draft-pick outcome labels such as value hit, value miss, injury miss, role miss, ADP steal, reach that worked, reach that failed, league-winner pick, replacement-level pick, and dead roster spot.
  - [ ] Build redraft draft strategy backtests that answer questions like "Should this format take QB early?", "When does RB dry up?", "Which positions are usually over-drafted here?", and "What player archetypes outperform ADP?"
  - [ ] Turn the warehouse into a live draft recommendation engine that explains best pick, next-best pivots, tier cliffs, positional scarcity, roster fit, expected next-pick availability, bye/injury risk, and why the recommendation is close or strong.
  - [ ] Add admin diagnostics for redraft draft data coverage: league count, season count, format buckets, missing draft boards, missing final standings, stale ADP/projection snapshots, identity-match confidence, and suspicious/incomplete leagues.
  - [ ] Keep user-load calls limited to Sleeper current-state/explicit league data and use scheduled or maintenance jobs for redraft source snapshots, draft-outcome backfills, and strategy backtests.
