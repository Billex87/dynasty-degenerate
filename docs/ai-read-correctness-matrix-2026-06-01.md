# AI Read Correctness Matrix - 2026-06-01

## Scope
- Define the preconditions, blockers, downgrade behavior, and required tests for every AI recommendation type before UI polish.
- This matrix complements:
  - [ai-read-surface-inventory-2026-06-01.md](ai-read-surface-inventory-2026-06-01.md)
  - [ai-read-tier-policy-2026-06-01.md](ai-read-tier-policy-2026-06-01.md)
- This is a specification slice only. It does not implement new guards or tests.

## Shared Preconditions For Any Action Read

An AI read may render as `Do this` only when all applicable preconditions are proven from current report data:

- League format is known: dynasty/redraft, superflex/1QB, TE premium/scoring where available.
- Current roster ownership is known for the player or asset involved.
- Current lineup or roster slot state is known when the read involves start/bench/drop/stash.
- Availability state is acceptable: not locked, unavailable, out, or otherwise blocked for the action.
- Source trace exists and is not stale beyond the cap for the read type.
- Confidence is present and above the action threshold for that action family.
- Missing evidence, hard blockers, and soft penalties have been evaluated through the shared evidence engine or an equivalent explicit guard.
- The action is not already satisfied by the current roster, lineup, transaction, or proposal state.

If a required precondition is missing, the read must render as `Watch`, `Hold`, `Do not do this`, context-only, or hidden.

## Matrix

| Recommendation type | Must prove before action | Hard blockers | Downgrade behavior | Required regression coverage |
| --- | --- | --- | --- | --- |
| Waiver add | Player is available, league allows add, roster need exists, source/weekly/value signal is fresh enough, confidence clears action threshold. | Player already rostered, player unavailable, stale/errored source cap, low source count, no roster need, locked league/waiver state. | `Watch` or `Hold`; copy should say why not to chase yet. | Fixture where stale weekly ECR caps the add; fixture where player becomes rostered after transaction; rendered no duplicate action owner with Autopilot. |
| Waiver add/drop | Add target available, drop target still on roster, drop target is droppable, value/need delta justifies move. | Drop candidate no longer rostered, locked player, invalid roster state, add target already rostered, no current ownership data. | Convert to add-only watch, hold, or hide drop language. | Fixture with drop candidate removed from roster; fixture with locked starter selected as drop; Playwright assertion that UI does not show impossible drop. |
| Stash | Player is available or rostered in a valid stash/taxi context, league format supports stash logic, current roster has stash runway. | Redraft mode without stash context, no taxi/bench room, stale prospect/source context, player already occupying intended stash role. | Context-only "watchlist" read. | Dynasty stash fixture; redraft fixture suppressing dynasty stash language. |
| Start | Player is on roster, eligible, not locked/out/bye, lineup slot exists, projected/schedule/source context is fresh enough. | Already starting, game locked, out/injured, bye week, no valid slot, insufficient current-season evidence. | If already starting, show baseline/hold; if blocked, `Do not do this`. | Already-starting fixture; locked-game fixture; bye/out fixture; mobile rendered copy check. |
| Bench | Player is currently starting or eligible to bench, replacement context exists, lineup state is current. | Player not starting, lineup locked, replacement unavailable/invalid, no lineup data. | Hold/baseline read or hide. | Fixture where bench target is already benched; fixture where replacement is unavailable. |
| Start/bench swap | Both players are rostered, slot eligibility works, incoming player is eligible, outgoing player is currently starting, lineup is not locked. | Same player on both sides, incoming unavailable, outgoing not starting, locked lineup, no eligibility fit. | Watch or "verify manually"; never render as direct swap. | Swap fixture covering same-player and eligibility mismatch. |
| Trade send | Assets are rostered/owned by correct managers, selected assets are current, package value/fit clears confidence threshold, league format supports the valuation basis. | Outgoing asset no longer owned, incoming asset not owned by target, Superflex QB depth blocker, stale selected asset, contradicted proposal status. | `Watch`, "review package", or `Do not move` for hard blockers. | TradeWarRoom fixture for stale selected assets; Superflex QB-depth blocker; already-resolved proposal context. |
| Trade reject / block | Incoming offer exists or proposal status is current, asset ownership and value context are known, manager/team need makes rejection defensible. | Offer no longer pending, missing proposal status, value context stale, target assets no longer owned. | Hide or show context-only proposal receipt. | Pending/expired/cancelled proposal fixtures. |
| Buy low | Player ownership is known, value/production/situation signal supports upside, source freshness and source count clear confidence threshold. | Player unavailable in league context, roster need already solved, stale/missing source, redraft/dynasty mismatch. | Market watch only; avoid "send offer" unless trade package owner owns action. | Fixture with dynasty-only buy signal in redraft; fixture with source-thin value spike. |
| Sell high | Player is on user's roster or selected manager roster, current value/situation supports risk, replacement/roster construction context is known. | Player not rostered by target manager, no viable replacement/read, stale value source, action would create roster hole. | Hold or context-only risk warning. | Fixture where sell candidate is no longer rostered; fixture where selling would break lineup need. |
| Draft pick / draft path | Draft payload exists, current league draft status supports the action, pick ownership/order is current, scoring/format is known. | Pre-draft redraft without draft payload, completed draft mismatch, missing pick ownership, old baseline exposed as current. | Draft planning context only; hide team-specific draft action. | Pre-draft Gov Tech style fixture; completed draft fixture; no exposed stale date assertion. |
| Streamer | Player is available/rostered as needed, schedule/matchup source is fresh, position is streamable in format, current week/window is known. | Missing schedule, bye/locked game, no current-week context, player unavailable, stale SOS/projection source. | Watch/verify matchup; cap confidence. | D/ST/K streamer stale schedule fixture; missing schedule source fixture. |
| Cut | Player is on roster, replacement/add plan exists, roster spot pressure is real, player is droppable. | Player not rostered, locked/undroppable, no replacement, source-thin recommendation. | Hold or no-action. | Fixture with no roster pressure; fixture with undroppable/locked player. |
| Hold / no action | Evidence is thin, action is already satisfied, or blockers outweigh upside. | None; hold is the safe fallback. | Render clear no-action reason with change trigger. | Fixture where no action is best; source-thin fixture; already-satisfied roster need fixture. |

## Cross-Surface Duplicate Rules
- A player/action pair may appear in support receipts on multiple surfaces, but only Autopilot may own the action label.
- If Waiver Intelligence and Autopilot both discuss the same player, Waiver must either match the Autopilot decision tier or explain that it is a receipt/support view.
- If Trade War Room and Overview both discuss the same package/player, Overview must point to Trade War Room, not invent a separate package.
- If Player Detail Modal and Rankings both discuss a player, Rankings should stay market context and Player Detail should stay player-specific evidence, with neither overriding Autopilot.

## Browser Validation Targets
- `Skids Get Beat`: dynasty, Superflex-style action ownership and trade/waiver/player reads.
- `The Fantasy Degenerates`: second dynasty league to catch league-specific manager/roster edge cases.
- `test league`: redraft completed-draft behavior and current-season copy.
- `Gov Tech Grid Iron`: redraft pre-draft empty states and draft-dependent suppression.

## Next Implementation Work
- Convert this matrix into focused unit fixtures around the shared evidence engine, Autopilot builder, Waiver Intelligence, Trade War Room, Player Detail Modal, Rankings, and Draft behavior.
- Add Playwright rendered assertions that no page shows multiple independent action owners for the same player/action.
- Add admin-mode and regular-mode browser checks for the four representative leagues across desktop, tablet, and mobile.
