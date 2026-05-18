# AI Readout Feature Coverage

This checklist keeps AI features useful, distinct, and traceable. A new readout should answer a real decision question, show why it fired, state confidence, and avoid repeating a conclusion already owned by another surface.

## Global Rules

- [ ] Every major readout has a clear user decision: start, sit, hold, shop, buy, sell, stash, drop, add, trade, monitor, or ignore.
- [ ] Every major readout includes a source trace: value, age, role, draft capital, schedule, manager tendency, league context, and source freshness where available.
- [ ] Every confidence number has a reason and drops when source coverage, identity matching, historical data, or league memory is thin.
- [ ] Every fallback state says what is missing instead of pretending a projection, schedule, or transaction signal exists.
- [ ] No readout duplicates another tab's owned conclusion; secondary mentions must answer a different question.

## Overview

- [x] `OverviewAIPulse` owns the league narrative only.
- [x] Monthly Blueprint owns long-range team direction and roster construction.
- [x] Power Rankings owns league-wide ordering.
- [x] Team Breakdown owns roster strengths, leaks, surplus, and next move.
- [x] Trade Finder owns partner fit, pressure points, and league exploitation.
- [x] Manager Position Counts owns position-count depth and imbalance.
- [x] Add visible "why this fired" traces to owner-level cards when the read changes because of roster, rank, trade, draft capital, or source freshness.
- [x] Add owner-level action queue: do now, monitor, shop, stash, avoid.

## AI Autopilot

- [x] Generates lineup, waiver, trade, direction, system-read, and projection-style actions from report data.
- [x] Caps recommendation confidence when league AI confidence is low.
- [ ] Add a compact trace under each action showing the exact value, roster, manager, schedule, and confidence signals.
- [ ] Add direct links from each action back to the player, trade, waiver, or roster table that generated it.
- [ ] Split "projection" language from true provider projections until projection snapshots are approved.

## Weekly Momentum / Waivers

- [x] Waiver Intelligence has competition, bid, special-teams, and history reads.
- [x] Trade Market Radar shows buy/sell movement context.
- [x] Add drop-side AI for every waiver add: exact suggested drop, why that player is expendable, and what risk remains.
- [ ] Add in-season usage trend signals once targets, carries, routes, snaps, and role growth are snapshot-backed.
- [ ] Add source trace for recent transaction/trending add/drop tables so plain activity becomes actionable.
- [x] Add first-pass persisted outcome learning for waiver won/lost results from saved plans and returned transactions.
- [ ] Add add/drop aftermath learning after enough post-claim roster/value windows exist.

## Rankings / Player Detail

- [x] Rankings can expose AI read chips that open the player modal.
- [x] Player Detail has an AI read with value confidence, cohort trace, schedule context, draft-capital runway, cohort evidence calibration, and first-pass situation-delta role/opportunity labels.
- [ ] Add richer ranking-table microreads for value tier, source disagreement, confidence, and roster fit.
- [x] Add "similar historical profile" reads with cohort confidence, closest comps, and signal traces in the player modal.
- [ ] Promote the historical comp lens with season-by-season backtest diagnostics once the full historical season warehouse is complete.
- [ ] Add provider projection trace only after projection snapshots are approved.

## Trades

- [x] Trade War Room supports player and dynasty pick assets.
- [x] Trade War Room "Make It Work" can suggest player or pick sweeteners.
- [x] Full Trade Ledger evaluates trades with historical roster lenses.
- [x] Full Trade Ledger balancing suggestions can use trade-time players or trade-time picks.
- [x] Full Trade Ledger outcome review shows realized edge, asset change, lineup signal, record context, pick lineage, and injury/status notes.
- [x] Add manager tendency negotiation reads: pick hoarder, veteran buyer, rookie seller, fair-offer resistor, favorite partner, and overpay profile.
- [x] Add package-builder AI that proposes multiple viable structures: add pick, remove player, swap target, or change lens.
- [x] Add acceptance/resistance score for each side using manager tendencies, pending offers, roster fit, and value gap.
- [x] Add first-pass persisted trade outcome learning for completed trades and blocked proposal signals.
- [ ] Add ignored/stale trade recommendation learning after a clear aging window is defined.

## Draft

- [x] Draft tab has a draft capital AI read and opportunity notes.
- [x] Player Detail uses draft-capital runway for rookie/young-player patience.
- [ ] Add manager-level draft style reads: value drafter, positional reach, roster-fit drafter, upside chaser, or safe floor.
- [ ] Add draft miss/hit explanations that account for original slot, opportunity runway, current role, and value change.
- [ ] Add rookie patience rules across trade, waiver, ranking, and overview reads so high draft capital is not judged like a fringe profile.

## Admin / Diagnostics

- [x] Admin diagnostics show provider/source coverage and value diagnostics.
- [x] Add AI readout coverage diagnostics: readout count by tab, missing traces, missing confidence, duplicated concept risk, and stale source dependencies.
- [ ] Add model input diagnostics for player cohort, trade package, waiver, and manager tendency reads.
- [ ] Add backtests for every new heuristic before promoting it from admin-only to user-visible.
