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
```

Useful options:

```sh
START_SEASON=2017 END_SEASON=2025 pnpm build:player-season-outcomes
SEASONS=2021,2022,2023 WRITE_ROWS=0 pnpm build:player-season-outcomes
OUT_DIR=/path/outside/repo/player-season-outcomes pnpm build:player-season-outcomes
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
