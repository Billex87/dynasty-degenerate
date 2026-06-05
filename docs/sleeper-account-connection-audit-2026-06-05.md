# Sleeper Account Connection Audit - 2026-06-05

Scope: projection/SOS/source-readiness follow-up for hidden waiver/trade evidence, waiver-priority calibration, and trade-outcome labeling. This audit does not approve any new normal report-load source and does not change runtime behavior.

## Decision

Keep hidden Sleeper account-level transaction import blocked.

As of June 5, 2026, the approved public Sleeper API path is read-only, unauthenticated, and league-data oriented. The official docs do not expose an OAuth, app authorization, partner authorization, or token-grant flow for account-private pending, cancelled, failed, rejected, skipped, or losing waiver/trade rows.

Do not collect raw Sleeper OAuth/session tokens, passwords, cookies, or browser storage values. Do not build public product flows that ask users to paste account tokens.

## Evidence Checked

- Official Sleeper API docs: https://docs.sleeper.com/
  - Public API is described as read-only.
  - No API token is required because the API cannot modify contents.
  - The docs state Sleeper does not perform authentication because the public API is read-only and contains league information.
  - Public roster payloads expose `settings.waiver_position`, `settings.waiver_budget_used`, wins/losses, and roster/player IDs.
  - Public transaction payloads expose completed free-agent, waiver, and trade transactions by league/week, including adds, drops, roster IDs, status, created/status_updated timestamps, and FAAB fields where available.
- Postman Sleeper collection mirror: https://www.postman.com/api-reference-library/sleeper-fantasy-football/documentation/ykss153/sleeper-api
  - Mirrors the public read-only/no-auth endpoint shape and public data categories.

## Usable Now

- Public completed waiver/free-agent/trade transactions remain usable as snapshot or user-load Sleeper league data under the existing user-load boundary.
- Public roster settings can support first-pass waiver-priority context through `waiver_position` when league settings indicate non-FAAB priority behavior.
- Completed FAAB/waiver transactions can keep grading winning-bid evidence after those transactions are public.

## Still Blocked

- Pending waiver claims.
- Cancelled, failed, rejected, skipped, or losing waiver claims.
- Hidden bid amounts before completion.
- Pending/cancelled/rejected trade proposals that are not visible through approved public league endpoints.
- Account-private trade status history.
- Any capture based on raw account tokens, passwords, cookies, local storage, or unsupported private endpoints.

## Approved Fallback Paths

1. Public completed-transaction learning.
2. Admin/user manual outcome labels for rejected/cancelled/skipped outcomes.
3. Explicit sanitized export/import, if Sleeper or the user can provide a file that does not require raw token collection and does not persist private payloads beyond the derived fields.
4. Browser-assisted local capture only if it runs with clear user consent, never sends raw tokens to the server, stores only minimal derived evidence, and passes security/privacy review.
5. Partner/API access only after written source approval, endpoint shape, rate limits, allowed fields, player/roster mapping, retention rules, and attribution language are documented.

## Product Impact

- Waiver-priority calibration can use public `waiver_position` and completed transaction outcomes, but priority-burn language must stay capped until skipped/losing/pending outcomes are approved or manually labeled.
- Trade calibration can use public completed transactions and visible proposal history already captured by approved routes, but cancelled/rejected/private proposal status must stay manual or blocked until an approved source exists.
- No provider-attributed public claims should imply Sleeper private-account coverage.
