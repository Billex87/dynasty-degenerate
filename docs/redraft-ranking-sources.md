# Redraft Ranking Sources

Redraft rankings are built separately from dynasty and devy rankings. Dynasty boards keep using dynasty market and expert sources; redraft boards use current-season ranking, ADP, and projection-style signals.

## Active Sources

- FantasyPros API: used when `FANTASYPROS_API_KEY` is configured. Provides scoring-aware draft ECR for `PPR`, `HALF`, and `STD`.
- Fantasy Nerds API: used when `FANTASY_NERDS_API_KEY` is configured. Provides scoring-aware draft rankings and ADP from the official API.
- MyFantasyLeague public API: uses `TYPE=adp`, `TYPE=playerRanks`, and `TYPE=players` JSON exports. No key required.
- ESPN Fantasy JSON endpoint: uses the public league-default `lm-api-reads.fantasy.espn.com` player info endpoint. This is not formally documented by ESPN, so it is weighted below the official/public exports.
- Fleaflicker official API: uses `FetchPlayerListing` sorted by draft ranking. Requires `FLEAFLICKER_LEAGUE_ID` because Fleaflicker ranks are league-contextual.
- Yahoo draft analysis: parses the public draft-analysis page if it exposes readable ADP rows.
- NFL Fantasy research pages: parses public rankings/projection rows when available.
- Internal Season Blend: carries the app's existing redraft value blend into the redraft board so reports still work when one or more external sites are unavailable.

## Deliberately Excluded For Now

- Fantrax: no stable public rankings API was confirmed. Avoid scraping it until there is a predictable endpoint or an authenticated integration plan.
- ESPN page scraping: the public fantasy landing pages are not the source of truth; use the JSON endpoint instead.

## Environment

```bash
FANTASYPROS_API_KEY=
FANTASY_NERDS_API_KEY=
FLEAFLICKER_LEAGUE_ID=
FLEAFLICKER_SEASON=
REDRAFT_SOURCE_TIMEOUT_MS=8000
ENABLE_REDRAFT_ADAPTIVE_TRUST=
ENABLE_REDRAFT_SOURCE_SNAPSHOTS=
ENABLE_REDRAFT_FANTASYPROS=
ENABLE_REDRAFT_FANTASY_NERDS=
ENABLE_REDRAFT_INTERNAL_SEASON_BLEND=
ENABLE_REDRAFT_MFL_ADP=
ENABLE_REDRAFT_MFL_RANKINGS=
ENABLE_REDRAFT_ESPN=
ENABLE_REDRAFT_FLEAFLICKER=
ENABLE_REDRAFT_YAHOO=
ENABLE_REDRAFT_NFL=
```

Missing sources fail closed and the available source weights normalize across whatever data was loaded. Set an `ENABLE_*` value to `false`, `0`, `off`, `no`, or `disabled` to skip that source.

In production, Yahoo and NFL Fantasy scraping fallbacks are disabled by default unless `ENABLE_REDRAFT_YAHOO=true` or `ENABLE_REDRAFT_NFL=true` is set. This keeps the default production posture on API-like sources first.

Adaptive trust is enabled by default. Each source keeps its base weight, then gets a bounded multiplier from `0.65x` to `1.15x` based on current health, recent snapshot health, row-count stability, and median drift from a source-excluded consensus. Set `ENABLE_REDRAFT_ADAPTIVE_TRUST=false` to force all redraft sources back to their base weights while keeping diagnostics visible.

## Operational Diagnostics

Every redraft board payload includes `rankings.redraftSourceDiagnostics`. The admin diagnostics panel shows source status, row counts, disabled-source notes, stale-season exclusions, fetch/parse errors, adaptive trust details, previous trust score, and weight movement since the previous snapshot. This is meant to catch silent upstream shape changes before they affect rankings.

Trust alerts are raised when a source goes stale/errors, loses more than 8 trust points, loses more than 25% consensus alignment, or has a major row-count collapse. Those alerts lower effective weight through the adaptive trust multiplier and show up directly in the admin value diagnostics table.

Normalized source payloads are snapshotted once per season/day to:

- `server/redraft-snapshots/redraft-source-snapshot-{season}-{YYYY-MM-DD}.json`
- the `redraftSourceSnapshots` database table when `DATABASE_URL` is available

Set `ENABLE_REDRAFT_SOURCE_SNAPSHOTS=false` to disable snapshot writes.

## Terms And Licensing Notes

- Prefer official/API-style sources first: FantasyPros, Fantasy Nerds, MyFantasyLeague, and Fleaflicker are the cleanest integrations here.
- Treat ESPN as useful but undocumented. Keep its weight below official sources and keep diagnostics visible.
- Treat Yahoo and NFL Fantasy as scraping fallbacks. Keep source toggles available and disable either quickly if markup changes or terms become a concern.
- Do not redistribute raw third-party rankings as a standalone dataset. The app should expose normalized blended values and source attribution inside league reports.
- Keep raw normalized source snapshots private. They are for drift debugging and mapping QA, not product export.
