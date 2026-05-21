# Player Season Outcome Model

This is an offline modeling layer for AI read calibration. It should not be loaded by normal pages, report payloads, or player modals.

## Goal

Build compact player-season rows that answer:

- Was this a productive season for the player's position?
- Was it a breakout, progression, sustain, regression, or collapse versus the previous year?
- What happened the next year after that profile?
- Which historical profiles are useful for future backtests and AI confidence calibration?

## Runtime Boundary

Default output goes to `.cache/modeling/player-season-outcomes`, which is gitignored. This keeps bulk model data out of the repo and out of user traffic.

Run:

```sh
pnpm build:player-season-outcomes
pnpm backtest:player-cohorts
pnpm backtest:player-comparisons
pnpm publish:player-cohort-calibration
```

Useful options:

```sh
START_SEASON=2017 END_SEASON=2025 pnpm build:player-season-outcomes
SEASONS=2021,2022,2023 WRITE_ROWS=0 pnpm build:player-season-outcomes
OUT_DIR=/path/outside/repo/player-season-outcomes pnpm build:player-season-outcomes
MIN_SAMPLE_SIZE=6 pnpm publish:player-cohort-calibration
MIN_SIMILARITY=62 PEER_LIMIT=6 pnpm backtest:player-comparisons
```

## Source

The first pass uses nflverse `stats_player_reg_{season}.csv` regular-season weekly player stats. The script aggregates by player-season and derives:

- PPR points and PPG
- weighted opportunity by position
- production score
- role score
- production tier
- role tier
- previous-year trajectory
- next-year outcome

This is intentionally stats-only. Draft capital, prospect buzz, contracts, team environment, roster-room deltas, and value-history signals should be joined later into a compact model table, not shipped as raw page data.

## Product Use

The site should eventually consume only derived calibration summaries, such as:

- similar-profile sample size
- historical riser/faller rate
- median 12-month production/value move
- failure rate for the same archetype
- confidence caps when samples are thin

Do not expose the raw row file in the UI.

## Cohort Backtest

After building player-season outcomes, run `pnpm backtest:player-cohorts`.

The backtest groups eligible player-seasons by position, production tier, role tier, and prior-year trajectory, then measures the next-year outcome distribution. It writes:

- `.cache/modeling/player-cohort-backtest/calibration.json`
- `.cache/modeling/player-cohort-backtest/summary.md`

The calibration output includes:

- improved/sustained rate
- breakout/progression rate
- regression/collapse rate
- material failure rate, which separates normal mean reversion from true production/role failure
- median next-year production and role movement
- confidence grade
- recommendation (`amplify`, `lean-positive`, `neutral`, `caution`, `fade-risk`)
- primary failure modes such as role loss, production collapse, efficiency-spike pullback, and breakout pullback

This is the evidence layer that should eventually inform player AI confidence. Keep it offline until we intentionally promote a compact, versioned summary.

## Historical Comparison Backtest

After building player-season outcomes, run `pnpm backtest:player-comparisons`.

The comparison backtest tests whether a player-season's closest same-position historical seasons would have predicted the correct next-season direction. It only uses candidates whose next-season result was already complete before the tested season, which prevents current-season or future-outcome leakage.

It writes:

- `.cache/modeling/player-comparison-backtest/diagnostics.json`
- `.cache/modeling/player-comparison-backtest/summary.md`

The diagnostics include:

- eligible rows, compared rows, and no-comp rows
- hit rate
- false-positive and false-negative rates
- positive and negative precision
- season-by-season drift
- position and prior-trajectory summaries
- strongest hits, false positives, false negatives, and no-comp examples

The current season warehouse supports production, role, usage, target-share/WOPR, and prior-trajectory matching. It does not yet provide season-specific market value, season-specific age, or format-specific scoring context, so those remain explicitly listed as missing warehouse-backed features in the diagnostic output.

## Runtime Receipts

`pnpm publish:player-cohort-calibration` promotes only compact bucket summaries into `server/model-calibration/player-cohort-calibration-v1.json`.

That runtime artifact strips raw player-season rows and example players. Player cards can consume it as a conservative "historical receipt" when the current player maps to a calibrated production/role/trajectory bucket with enough sample size. Thin, neutral, or blocked buckets remain internal traces and should not become loud user-facing copy.
