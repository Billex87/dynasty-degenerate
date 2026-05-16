# Player Props Compliance Boundaries

Player props can improve start/sit, role, injury-risk, and projection-confidence reads, but public UX must stay compliance-safe and should avoid gambling instruction language.

## Data Boundary

- Provider calls run only in scheduled/admin refresh paths.
- Normal report loads read stored `player-props-opticodds-v1` snapshots and never call odds providers directly.
- No full provider payloads, API keys, sportsbook account data, or user betting data should be logged or returned to the browser.
- Only licensed/approved providers are eligible for production. Direct Sleeper Picks, Underdog, or bet365 internal endpoints are out of scope unless an official developer agreement exists.

## Product Language Boundary

Allowed for internal/report intelligence:

- "Market-implied role support"
- "Sportsbook agreement"
- "Prop market confidence"
- "Neutral start/sit support"
- "Line movement suggests stronger/weaker usage expectation"

Avoid in public UI until legal review:

- direct betting recommendations
- stake sizing
- guaranteed pick language
- calls to place a bet
- jurisdiction-specific sportsbook availability claims

## Rollout Gate

Before public props UI:

1. Store at least one real approved props snapshot.
2. Audit row count, payload size, sportsbook coverage, and market coverage without printing payloads or secrets.
3. Tune `OPTICODDS_SPORTSBOOKS` and `OPTICODDS_PROP_MARKETS` against actual NFL coverage.
4. Add source-health/freshness diagnostics for props rows.
5. Calibrate thresholds against projection/value snapshots.
6. Review responsible-gaming/legal copy before exposing any betting-adjacent UI.

