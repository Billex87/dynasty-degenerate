# AI Read Surface Inventory - 2026-06-01

## Scope
- Inventory visible and admin-only AI read surfaces for the final AI Read System WOW + Correctness Pass.
- This is an audit/documentation slice only. It does not change UI, styling, copy, or recommendation logic.
- Source files inspected include:
  - `client/src/components/AIReadPanel.tsx`
  - `client/src/components/AIActionQueue.tsx`
  - `client/src/components/AITeamAutopilot.tsx`
  - `client/src/components/CommandCenterExpansion.tsx`
  - `client/src/components/PlayerDetailModal.tsx`
  - `client/src/components/reportTables/WaiverIntelligencePanel.tsx`
  - `client/src/components/reportTables/TradeWarRoom.tsx`
  - `client/src/features/report/components/ReportOverviewTab.tsx`
  - `client/src/features/report/components/ReportMomentumTab.tsx`
  - `client/src/features/report/components/ReportRankingsTab.tsx`
  - `client/src/features/report/components/ReportTradesTab.tsx`
  - `client/src/features/report/components/ReportDashboardContent.tsx`
  - `client/src/features/admin/components/AdminAIReadoutSections.tsx`

## Ownership Tiers
- Action owner: `AIActionQueue` inside `AITeamAutopilot`. This is the only surface currently allowed to own `Do this`, `hold`, `watch`, or `blocked` recommendation decisions.
- Executive summary: `OverviewAIPulse`. It can summarize the strongest proven direction and embed a compact action queue preview, but it should not create an independent second action claim.
- Tab owner reads: one concise support read per tab or tab section, such as `TeamBreakdownRecon`, `RankingsMarketRead`, `TradeBrowserRead`, and `TradePartnerFinder`.
- Support receipts: row/table/detail traces such as league power receipts, league exploit receipts, waiver pickup receipts, rankings row AI reads, and trade package receipts. These should explain source context without competing with the action owner.
- Admin diagnostics: `AdminAIReadoutSections` owns raw policy/registry/debug detail and is not a user-facing recommendation surface.

## Surface Matrix

| Surface | Route / tab | Component or file | Visibility | Current role | Notes / risk |
| --- | --- | --- | --- | --- | --- |
| Shared read shell | Many report surfaces | `AIReadPanel` | User/admin depending caller | Shared presentation shell | Desktop/mobile compact behavior lives here, so future visual rules should be enforced once rather than per caller. |
| Autopilot action queue | AI Autopilot tab | `AITeamAutopilot` -> `AIActionQueue` | Admin-gated today | Action owner | Current admin registry tests prove this is the only action owner when confidence and trace exist. |
| Autopilot recommendation cards | AI Autopilot tab | `AITeamAutopilot` recommendation sections | Admin-gated today | Support/action detail | Start-over, waiver, and trade sections can look action-like; keep them subordinate to the queue. |
| Autopilot edge review | AI Autopilot tab | `AIEdgeReview` inside `AITeamAutopilot` | Admin-gated today | Receipts / rejected reads | Good place for blocked/suppressed alternates, but should not create a second active recommendation. |
| Overview AI Pulse | Overview | `OverviewAIPulse` | Visible when evidence renders | Executive summary | Embeds compact `AIActionQueue`; keep as summary only. |
| Monthly Blueprint locked read | Overview / blueprint | `MonthlyTeamBlueprint` pre-draft branch | Visible when pre-draft redraft blocks blueprint | Guardrail read | Correctly uses locked/stop copy instead of inventing a plan. |
| Monthly Blueprint ready/read summary | Overview / blueprint | `MonthlyTeamBlueprint` ready and generated states | Visible after manager data | Tab owner / blueprint support | Can say `Do this` for generating the blueprint itself; must not imply a roster action unless the evidence owner supports it. |
| League Power receipts | Overview | `LeaguePowerRankings` details receipts | Visible per expanded card | Support receipts | Receipts explain rank/readiness only; keep action language out. |
| Team Breakdown AI | Overview | `TeamBreakdownRecon` | Visible when owner evidence renders | Tab owner read | Owns roster-shape explanation only; Trade Finder owns package/target specifics. |
| Trade Partner Finder | Overview | `TradePartnerFinder` | Visible when enough managers/assets exist | Tab owner read | Builds a fair trade read and packages; Superflex QB-depth blocker is good guardrail evidence. |
| League Exploits receipts | Overview | `LeagueExploits` | Visible per card | Support receipts | Suggested moves can sound actionable; should remain exploit context unless promoted through Autopilot. |
| Rankings Market Read | Rankings | `RankingsMarketRead` | Admin feature expansion | Tab owner support | Uses evidence engine and source/row counts; keep as market context, not add/drop/trade command. |
| Rankings row AI reads | Rankings | `RankingsBoard` with `showAIReads` | Admin feature expansion | Row support | Needs duplicate/conflict guard because row-level reads can multiply quickly. |
| Waiver Intelligence panel | Weekly Momentum | `WaiverIntelligencePanel` | User-visible section | Support/action receipts | Uses shared evidence engine and shows `Do this` only when `evidenceRead.canAct`; still needs browser validation that it does not compete with Autopilot. |
| Player Detail Modal AI read | Player modal | `PlayerDetailModal` | Visible when player read is returned | Player-level support read | Uses `AIReadPanel` with `mobileDefaultOpen`; needs impossible-action matrix coverage for rostered/unavailable/locked/injured/source-thin cases. |
| Trade Browser Read | Trades | `TradeBrowserRead` | Admin feature expansion | Tab support | Summarizes trade history/tendencies; should not create independent trade commands. |
| Trade War Room | Trades | `TradeWarRoom` | User-visible section | Trade tool / package builder | Package suggestions and calibration can feel actionable; preconditions and current selected assets need correctness coverage. |
| Pending Trade Offers | Trades | `TradeProposalSignalsTable` | Admin feature expansion | Admin/context receipts | Proposal status context should inform but not independently recommend. |
| Draft History / Draft Analysis | Draft tab | `DraftAnalysis` | Visible when draft payload exists | Draft receipts/support | Inventory item exists, but no `AIReadPanel` ownership was found in the inspected entry points. Keep draft recommendations out unless evidence/copy rules are explicit. |
| Admin AI registry | Admin diagnostics | `AdminAIReadoutSections` | Admin-only | Raw diagnostics | Already computes roles: action-owner, context, hidden, merge. Tests currently assert one action owner. |
| Mobile compact variants | Shared read shell and e2e coverage | `AIReadPanel`, `report-command-center.spec.ts` | Mobile/tablet | Presentation variant | Inventory confirms the shared compact path exists; real representative-league mobile screenshots remain pending. |

## Current Automated Coverage
- `client/src/features/admin/components/AdminAIReadoutSections.test.ts` verifies:
  - exactly one action owner
  - `autopilot-actions` / `Action Queue` owns recommendations
  - missing confidence downgrades Action Queue to data-only/no-claim
- `client/src/lib/autopilot/buildAutopilotData.test.ts` verifies stale weekly waiver sources cap Autopilot waiver action copy and keep capped expected actions as `hold`.
- `tests/e2e/report-command-center.spec.ts` contains fixture-based mobile/desktop AI read coverage, including mobile compact behavior, but this inventory pass did not rerun those visual tests.
- Production smoke on `mobile-chrome`, `tablet-chrome`, and prior `desktop-chrome` validates representative report navigation and league-format copy, not deep AI-read visual/correctness behavior.

## Open Risks
- Multiple support surfaces still use action-sounding copy (`Do this`, suggested moves, packages, pickup receipts). The current policy says only Autopilot owns real action, but browser-level duplication/conflict assertions still need to prove this in rendered reports.
- Waiver Intelligence is user-visible and can display `Do this` when evidence allows. It needs explicit ownership language or test coverage so it does not conflict with Autopilot when both are visible to admins.
- Trade War Room package suggestions are generated from selected assets and value math; tests should cover stale selected assets, roster ownership, Superflex QB depth, redraft/dynasty mode, and already-resolved proposal contexts.
- Player modal reads need the full impossible-action matrix: already rostered, unavailable, locked, injured/bye, stale source, missing source, and roster need already solved.
- Admin diagnostics prove registry policy from data, but they do not prove that every rendered user-visible support surface follows that policy in the browser.

## Next Work
- Define strict readout tiers and copy rules using this inventory as the source list.
- Build the correctness matrix for every recommendation type before any UI polish.
- Add rendered duplicate/conflict tests for Overview, Autopilot, Waiver, Trade, Rankings, Player Detail, Draft, and admin diagnostics.
- Validate the surfaces against `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron` in regular and admin modes across desktop, tablet, and mobile.
