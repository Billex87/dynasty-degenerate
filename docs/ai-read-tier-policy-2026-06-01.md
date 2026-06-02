# AI Read Tier And Ownership Policy - 2026-06-01

## Scope
- Define strict AI readout tiers and ownership rules for the final AI Read System WOW + Correctness Pass.
- This policy uses [ai-read-surface-inventory-2026-06-01.md](ai-read-surface-inventory-2026-06-01.md) as the source surface list.
- This is a product/engineering policy slice only. It does not change UI code, CSS, or recommendation logic.

## Non-Negotiable Rule
Only one surface can own a user action at a time: the Autopilot `AIActionQueue`.

Every other AI surface must either summarize, explain, provide receipts, or stay hidden. If a support surface uses action-sounding copy, it must make clear that the action is contextual and not a separate competing recommendation.

## Tier 1: Action Owner

Primary surface:
- `AIActionQueue` rendered inside `AITeamAutopilot`.

Allowed claims:
- `Do this`
- `Do not do this`
- `Hold`
- `Watch`
- blocked/suppressed alternate explanations

Required evidence before `Do this`:
- current roster ownership and lineup context
- player availability and injury/bye/locked status where relevant
- league format and scoring mode
- source freshness and source count
- transaction/waiver/trade context where relevant
- confidence score, confidence cap, or blocker explanation
- outcome-memory context when available

Failure behavior:
- If hard preconditions are missing, downgrade to `Watch`, `Hold`, or `Do not do this`.
- If sources are stale/thin, cap confidence and explain what would change the read.
- If another surface has a stronger action claim, merge it into the queue rather than rendering two action owners.

## Tier 2: Executive Summary

Primary surface:
- `OverviewAIPulse`.

Allowed claims:
- broad direction
- strongest proven lane
- compact summary of the action queue
- "where to look next" guidance

Not allowed:
- independent add/drop/start/trade instructions
- new player names that do not appear in the action queue or owning tab receipts
- extra `Do this` decisions separate from Autopilot

Failure behavior:
- Hide if there is no evidence read.
- Render as summary only when confidence is capped or source-limited.

## Tier 3: Tab Owner Reads

Primary surfaces:
- `TeamBreakdownRecon`
- `RankingsMarketRead`
- `TradeBrowserRead`
- `TradePartnerFinder`
- `MonthlyTeamBlueprint`
- future single owner read per Waiver, Draft, and Player Detail section when needed

Allowed claims:
- section-specific interpretation
- strongest local signal
- confidence/source context
- narrow next-step context, such as "check this market" or "review this package"

Not allowed:
- competing commands that override the action queue
- multiple cards in the same tab each claiming to be the AI recommendation
- table-local jargon that hides what the user should verify

Failure behavior:
- If a tab owner lacks confidence or trace evidence, render as data/context only.
- If the read is redundant with another tab owner, merge into the stronger owner or move to receipts.

## Tier 4: Support Receipts

Primary surfaces:
- waiver pickup receipts
- player modal AI trace items
- rankings row AI reads
- trade package receipts
- league power receipts
- league exploit receipts
- proposal status context
- draft-history receipts

Allowed claims:
- why a row/card/package appeared
- source trace, blockers, missing evidence, confidence cap
- local warnings such as "do not move this QB without another QB coming back"

Not allowed:
- standalone recommendation ownership
- repeated "Do this" cards across many rows
- hidden assumptions about roster ownership or availability

Failure behavior:
- If evidence is thin, show receipt language such as "watch", "verify", "context only", or hide.
- If a receipt implies a real action, it must either be promoted into the Action Queue or rewritten as support context.

## Tier 5: Admin Diagnostics

Primary surfaces:
- `AdminAIReadoutSections`
- source coverage diagnostics
- outcome-memory diagnostics
- calibration diagnostics
- player signal audit diagnostics

Allowed claims:
- raw policy state
- action-owner/context/hidden/merge classification
- missing confidence/source trace
- duplicate risk
- source-limited status
- suppressed alternate reasons

Not allowed:
- normal-user recommendation copy
- unguarded raw provider payloads
- secret values, webhook URLs, API keys, league/user identifiers beyond existing sanitized IDs

Failure behavior:
- If a diagnostic row has no confidence or no trace, mark it data-only/hidden instead of recommendation-capable.
- If more than one action owner appears, tests should fail.

## Copy Rules
- Every actionable read must answer: what to do, why, confidence, what could change it, and where to verify.
- Support reads may answer why and where to verify, but should not command action unless promoted to the action queue.
- Avoid vague labels such as "AI says", "smart move", "edge", or "lock" unless the read includes evidence and a confidence cap.
- Avoid duplicate phrasing across Overview, Autopilot, Waiver, Trade, Rankings, and Player Detail. Duplicate language is a signal that one surface should be merged or demoted.
- If a read is generated from partial history, stale source data, missing source data, or optional/admin-only source coverage, say so directly.

## Test Rules
- Unit tests should enforce one action owner in the admin registry.
- Fixture tests should cover each action type: add, drop, stash, start, bench, trade send, trade reject, buy low, sell high, draft, streamer, hold, and no-action.
- Playwright tests should assert rendered pages do not show two independent action owners for the same player/action.
- Mobile tests should assert compact AI reads preserve the same decision tier and do not hide blockers or confidence caps.

## Current Status
- Inventory is complete.
- Tier policy is now defined.
- Code enforcement is partial: admin registry tests already assert one action owner, but rendered duplicate/conflict tests and full recommendation-type correctness matrix are still pending.
