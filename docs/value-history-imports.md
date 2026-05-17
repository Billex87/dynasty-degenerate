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
