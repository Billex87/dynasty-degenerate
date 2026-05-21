# Dynasty Value Sources

Dynasty values use a long-term blend that stays separate from redraft. Redraft ranks current-season usefulness; dynasty ranks multi-year market value.

## Active Sources

- Flock Fantasy: expert-ranking anchor when available from the dynasty Superflex and 1QB boards, trimmed by the 2026-05-17 historical calibration so it does not overpower market movement.
- Dynasty Nerds: format-aware expert/community dynasty support, including PPR, 1QB, Superflex, and Superflex TEP buckets.
- KTC: dynasty market/liquidity signal, raised by the historical value audit because it had the strongest tested direction hit rate.
- FantasyCalc: secondary market value support with team count, QB format, and PPR knobs, raised by the historical value audit.
- FantasyPros Dynasty: API-backed ECR support at a lower weight because the public dynasty board is full PPR and not league-format specific.
- DynastyProcess: broad public fallback/stabilizer.

Fantasy Nerds dynasty rankings are included as a modest API-backed consensus source when `FANTASY_NERDS_API_KEY` is configured. FantasyPros season rankings and Dynasty Dealer benchmark values can be stored for context, but they do not directly set primary dynasty values.

The default audited dynasty blend is KTC 19%, FantasyCalc 15%, FantasyPros 6%, DynastyProcess 5%, Dynasty Nerds 23%, Fantasy Nerds 7%, and Flock Fantasy 25%. Format-specific profiles rebalance around that baseline, especially for Superflex and TEP leagues.

## Adaptive Trust

Adaptive dynasty trust is enabled by default. Each source keeps its league-format base weight, then gets a bounded multiplier from `0.75x` to `1.12x` based on:

- current source coverage
- recent snapshot health
- row-count stability against recent snapshots
- median drift from a source-excluded dynasty consensus

Set `ENABLE_DYNASTY_ADAPTIVE_TRUST=false` to force dynasty sources back to base weights while keeping diagnostics visible.

Devy/prospect boards have their own separate adaptive trust pass. FantasyPros Devy, KTC Devy, and Prospect Archive each keep a base weight, then get a bounded multiplier from `0.75x` to `1.12x` from cross-source prospect overlap and consensus drift. Flock Fantasy is intentionally excluded from devy because it does not publish a devy board. Set `ENABLE_DEVY_ADAPTIVE_TRUST=false` to force those devy/prospect weights back to base weights.

## Operational Diagnostics

The admin diagnostics panel shows `rankings.dynastySourceDiagnostics` for dynasty reports and `rankings.devySourceDiagnostics` for devy reports. Each source includes row count, trust score, effective multiplier, consensus drift, recent health where available, row-count baseline where available, previous trust score, and weight movement since the previous snapshot.

Trust alerts are raised when a source goes stale/errors, loses more than 8 trust points, loses more than 25% consensus alignment, or has a major row-count collapse. These alerts do not remove the source outright; they lower the effective weight and make the movement visible in admin diagnostics.

Daily KTC snapshots provide historical source context from:

- `server/ktc-snapshots/ktc-snapshot-{YYYY-MM-DD}.json`
- the `ktcSnapshots` database table when `DATABASE_URL` is available

The scheduled value snapshot stores raw source profiles plus blended profiles, so trust can improve as the app accumulates history.

The default devy profile also writes normalized source snapshots to:

- `server/devy-source-snapshots/devy-source-snapshot-{profileKey}-{YYYY-MM-DD}.json`
- the `devySourceSnapshots` database table when `DATABASE_URL` is available

Set `ENABLE_DEVY_SOURCE_SNAPSHOTS=false` to disable devy source snapshot writes.
