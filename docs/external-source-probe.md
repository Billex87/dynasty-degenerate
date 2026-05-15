# External Source Probe

Run:

```sh
pnpm run probe:external-sources
```

The probe checks the current access posture for Yahoo Fantasy, Sleeper, OpticOdds, SportsGameOdds, ParlayAPI, Underdog, bet365, FFPC, and Fantrax. It prints only metadata: source name, target, status code, response size, row count when parseable, response shape, duration, and coverage terms. It does not print response payloads, auth tokens, cookies, or secrets.

## Current Integration Direction

- Yahoo Fantasy is the only official platform connector in this batch. It requires OAuth/application approval before useful league/team/player/matchup data can be pulled.
- Sleeper fantasy stays live only for user and league state that can change at login: league lookup, rosters, users, players, transactions, drafts, matchups, and trends.
- Sleeper Picks, Underdog, and bet365 should come through licensed odds/props aggregators, not direct internal endpoints.
- OpticOdds, SportsGameOdds, and ParlayAPI are the first props candidates because their docs expose normalized odds/player-prop APIs and coverage for the books/apps we care about.
- Fantrax and FFPC need approved access or partner terms before production use. The probe only confirms whether public docs or unauthenticated surfaces are reachable.

## Required Credentials

```sh
YAHOO_ACCESS_TOKEN=
OPTICODDS_API_KEY=
SPORTSGAMEODDS_API_KEY=
PARLAY_API_KEY=
```

Keep these server-only. If we integrate any of them, the production path should be: cron refresh -> provider snapshot -> report/load reads from snapshot. Normal report loads should not call these providers directly.

## Prop Snapshot Foundation

`server/playerPropSnapshots.ts` defines the first normalized prop shape and OpticOdds refresh path. It stays disabled unless `ENABLE_OPTICODDS_PLAYER_PROPS=true` and `OPTICODDS_API_KEY` are configured. Dynamic data refresh can then store daily `player-props-opticodds-v1` provider snapshots for report logic to read later without calling a props provider on normal page/report load.

The default OpticOdds configuration keeps the first pass intentionally narrow:

```sh
ENABLE_OPTICODDS_PLAYER_PROPS=true
OPTICODDS_FIXTURE_LIMIT=8
OPTICODDS_SPORTSBOOKS=sleeper,bet365,underdog_fantasy_2_pick_
OPTICODDS_PROP_MARKETS=player_passing_yards,player_rushing_yards,player_receiving_yards,player_receptions,player_anytime_touchdown
```

The normalized line shape stores player identity, fixture/event metadata, market, line, sportsbook, over/under side, American odds, decimal odds when available, implied probability when available, and provider update timestamps.

`server/playerPropSignals.ts` is the read-only signal layer over those snapshots. It compares stored market lines against internal projection inputs, then returns market direction, sportsbook agreement, confidence, and neutral start/sit support flags. It intentionally reads snapshots only; provider calls remain limited to the dynamic-data refresh path.

Report generation now folds stored prop-market signals into manager `marketSignals` when a signal matches a rostered player. This gives Autopilot/report intelligence a value and start/sit context hook without adding live odds calls to normal report loads.
