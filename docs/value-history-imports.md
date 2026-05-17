# Value History Source Imports

Use these templates when a provider gives us an approved CSV, JSON export, or licensed API history that we are allowed to store privately for blend calibration.

## Templates

- `docs/value-history-import-templates/fantasycalc.csv`
- `docs/value-history-import-templates/fantasypros.csv`
- `docs/value-history-import-templates/dynastyprocess.csv`
- `docs/value-history-import-templates/dynastynerds.csv`
- `docs/value-history-import-templates/fantasynerds.csv`

## Required Fields

- `date`: source snapshot or historical value date, preferably `YYYY-MM-DD`.
- `playerName`: display name from the provider.
- `playerId`: provider player ID when available.
- `position`: `QB`, `RB`, `WR`, `TE`, `K`, or `DEF`.
- `format`: provider/league format such as `12_sf_ppr_base`, `superflex`, `PPR`, `SFLEXTEP`, or `dynasty`.
- `value`: source value normalized to the provider's native value scale.

Provider-specific value columns should be filled when that source is the owner of the row:

- FantasyCalc: `fantasyCalcValue`
- FantasyPros: `fantasyProsValue`
- DynastyProcess: `dynastyProcessValue`
- Dynasty Nerds: `dynastyNerdsValue`
- Fantasy Nerds: `fantasyNerdsValue`

Optional fields such as `overallRank`, `positionRank`, `tier`, `team`, `sourceUrl`, and `notes` are kept for review and audit context.

## Import Flow

Import one approved source export into a source-specific raw archive:

```bash
INPUT_FILE=docs/value-history-import-templates/fantasycalc.csv \
SOURCE_KEY=fantasycalc-approved-export-2026-05-17 \
SOURCE_NAME=FantasyCalc \
OUT_FILE=server/value-history-archive/fantasycalc-approved-history.json \
pnpm import:value-history
```

Merge one or more approved import archives with the immutable KTC/Flock base archive:

```bash
BASE_ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json \
IMPORT_FILES=server/value-history-archive/fantasycalc-approved-history.json \
OUT_FILE=server/value-history-archive/one-time-source-history-merged.json \
pnpm merge:value-history
```

Audit, then reblend from the merged archive:

```bash
ARCHIVE_FILE=server/value-history-archive/one-time-source-history-merged.json \
pnpm audit:value-history

ARCHIVE_FILE=server/value-history-archive/one-time-source-history-merged.json \
OUT_FILE=server/value-history-archive/player-value-history-reblended.json \
BLEND_NAME=current-default-weights \
pnpm reblend:value-history
```

Keep every imported source archive and merged archive gitignored. The committed artifacts are the scripts, templates, checksums, and docs.

## Local Snapshot Baseline

Before looking for external historical exports, capture the provider values we already stored in our own local blended snapshots:

```bash
VALUE_PROFILE_KEYS=12_sf_ppr_base,12_sf_ppr_tep_0_5,12_sf_ppr_tep_1_0,12_sf_ppr_tep_1_5,12_one_qb_ppr_base,12_one_qb_ppr_tep_0_5,12_one_qb_ppr_tep_1_0,12_one_qb_ppr_tep_1_5 \
SOURCES=fantasyCalc,fantasyPros,dynastyProcess,dynastyNerds,fantasyNerds \
OUT_FILE=server/value-history-archive/local-weighted-source-history.json \
pnpm export:value-history:sources
```

This produces source-specific raw points from the stored snapshot columns only. It does not call provider sites.

Treat this as a baseline, not as a complete provider backfill. It preserves the provider-specific columns already captured by Dynasty Degen snapshots, but the higher-confidence path is still to backfill each weighted provider one at a time from a direct historical page, official export, licensed API, or official versioned data repository.

## Provider-by-Provider Backfill Standard

For every remaining weighted source:

1. Confirm the exact source path and terms before importing rows.
2. Capture raw source-native values with source URL, capture method, format, date, and provider identifiers.
3. Preserve source-specific archives as gitignored raw files.
4. Merge into a derived combined archive only after audit passes.
5. Reblend from the combined raw archive so future weight changes stay reproducible.

Archived direct/source-history targets:

- DynastyProcess: official GitHub `files/values-players.csv` history can be replayed from commits and mapped to source-native 1QB/Superflex values. It does not expose TEP-specific values, so do not fabricate TEP rows.
- FantasyCalc: direct player history endpoints can be replayed for dynasty Superflex and 1QB profiles. The endpoint does not expose TEP, PPR, or team-count-specific history splits, so the archive keeps only the source-supported base profiles.
- FantasyPros: API consensus ranking snapshots can be captured by season/type/scoring with source `last_updated` dates. Dynasty rows are stored in app 1QB/SF base PPR formats because the endpoint does not expose QB-format or TEP splits; redraft, ROS, ADP, devy, and rookie ranking snapshots stay in source-specific formats.

Blocked until approved direct history/export path:

- Dynasty Nerds
- Fantasy Nerds
