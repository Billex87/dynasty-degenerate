# AI Read Correctness Pass - 2026-06-01

## Scope
- First implementation slice for the final ship-readiness AI-read correctness gate.
- Focus: visible Autopilot waiver/action-queue reads, stale weekly source handling, and impossible/over-forceful action copy.
- CSS, broad visual redesign, and real-browser representative-league validation were not part of this slice.

## Current Guardrail Coverage Confirmed
- Shared evidence tests already cover:
  - already-starting start advice
  - bye-week start/stream advice
  - unavailable/out players
  - locked lineup changes
  - redraft reads with dynasty-only evidence
  - stale source confidence caps
  - stale available waiver cards after recent transactions
  - low-value, low-source pickup advice
  - league format position blockers for K/DST
- Autopilot tests already cover:
  - one primary `do` action in the queue
  - stale available waiver players not being promoted after transactions
  - rough D/ST matchup windows not becoming top adds
  - rostered source-only D/ST targets not being promoted
  - low league-confidence reports falling back to `No move is best`

## Fix Landed
- Preserved structured weekly waiver source traces when Autopilot calls `evaluateAIEvidence`.
- Weekly rank/SOS trace status now reaches the shared stale/error source cap logic instead of being flattened into plain strings.
- Capped waiver reads now stay below `Do this` / `Priority add` copy unless they clear the same `68` confidence threshold the AI Action Queue uses for `do` actions.
- Capped waiver reads now persist a `hold` expected action instead of a waiver-add expected action.

## Regression Added
- `client/src/lib/autopilot/buildAutopilotData.test.ts` now verifies that a stale FantasyPros weekly ECR waiver read:
  - renders as `Monitor only`
  - says `Don't add yet`
  - keeps confidence below `68`
  - does not become a waiver queue `do` action
  - exposes stale source health and a refresh-source trigger
- `client/src/features/admin/components/AdminAIReadoutSections.test.ts` now verifies that:
  - the admin AI surface registry has exactly one action owner
  - only `autopilot-actions` / `Action Queue` can make a recommendation claim
  - non-action readouts remain context, hidden, or merge-only surfaces
  - missing confidence evidence removes Action Queue ownership and marks the row as data-only

## Verification
- `pnpm exec vitest run client/src/lib/autopilot/buildAutopilotData.test.ts` passed.
- `pnpm exec vitest run client/src/features/admin/components/AdminAIReadoutSections.test.ts` passed.
- `pnpm run check` passed.
- `pnpm test` passed: `123` files, `612` passed, `1` skipped.
- `pnpm build` passed.

## Remaining AI Correctness Work
- Inventory complete: [ai-read-surface-inventory-2026-06-01.md](ai-read-surface-inventory-2026-06-01.md) maps the visible and admin-only AI read surfaces, current ownership tiers, existing automated coverage, and remaining duplication/correctness risks.
- Tier policy complete: [ai-read-tier-policy-2026-06-01.md](ai-read-tier-policy-2026-06-01.md) defines the single action-owner rule, support tiers, admin diagnostics role, copy rules, and test rules.
- Correctness matrix complete: [ai-read-correctness-matrix-2026-06-01.md](ai-read-correctness-matrix-2026-06-01.md) defines required preconditions, hard blockers, downgrade behavior, and regression coverage for waiver, lineup, trade, market, draft, streamer, cut, hold, and no-action reads.
- Add deeper cross-surface duplicate/conflict assertions beyond the current action-queue owner and admin surface-registry guards.
- Validate Overview, Autopilot, Player Detail, Waiver, Trade, Rankings, Draft, and admin AI surfaces in browser screenshots.
- Validate real representative leagues: `Skids Get Beat`, `The Fantasy Degenerates`, `test league`, and `Gov Tech Grid Iron`, in admin and regular mode across desktop, tablet, and mobile.
