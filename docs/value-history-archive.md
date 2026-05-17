# Value History Archive

Generated: 2026-05-17

This archive is the frozen raw source history used to regenerate player value timelines when blend weights change.

## Stored Files

- `server/value-history-archive/one-time-source-history.json`
  - Raw source archive from direct KTC player pages, direct Flock player history endpoints, official DynastyProcess GitHub `values-players.csv` commit history, direct FantasyCalc player history endpoints, and FantasyPros API ranking snapshots.
  - 2,316 players.
  - 2,071,550 raw player/date/source/format points.
  - SHA-256: `08695ae2e8788c7bff1a7aad5d4b550c314df8c3f2ff851bce16bcb8d07ba698`
- `server/value-history-archive/player-value-history-audit.json`
  - Audit report for the raw archive.
  - Passed with zero warnings and zero errors.
  - SHA-256: `114e7ddb4511807c25b5d3f1eb43f6b1e00cec4b533cef1fe350bb002933e0e1`
- `server/value-history-archive/source-coverage-audit.json`
  - Source coverage report for the raw archive.
  - KeepTradeCut, Flock Fantasy, FantasyCalc, FantasyPros, and DynastyProcess are present.
  - Dynasty Nerds and Fantasy Nerds remain import-ready until a direct approved history/export path is confirmed.
  - SHA-256: `7e9bae52497540e493156883e07ff91ee903e94c0efd3bc329601705e368c9b7`
- `server/value-history-archive/fantasycalc-history.json`
  - Source-specific FantasyCalc archive from direct player history endpoints.
  - 461 players.
  - 270,894 raw player/date/source/format points.
  - SHA-256: `1db07238e4275b9a3a32ecdb829905f8753b027229643d1d1e655e8f9f5147f5`
- `server/value-history-archive/fantasypros-history.json`
  - Source-specific FantasyPros archive from API consensus ranking snapshots for `DYNASTY`, `DRAFT`, `ROS`, `ADP`, `DYNADP`, `RKADP`, `DEVY`, and `ROOKIES`.
  - 2,035 players.
  - 17,564 raw player/date/source/format points.
  - SHA-256: `ac91ad6a6fc144e92c2b953c851973a08a4bf24522e395d03361014cfdcb0c40`
- `server/value-history-archive/dynastyprocess-git-history.json`
  - Source-specific DynastyProcess archive from 196 official Git commits between 2022-05-17 and 2026-05-17.
  - 1,268 players.
  - 221,759 raw player/date/source/format points.
  - SHA-256: `d861bc9b7c4153cda30a54deda260704731a091c6f233be843557969cacfac3a`
- `server/value-history-archive/player-value-history-reblended.json`
  - Derived timeline using current default weights.
  - 2,316 players.
  - 1,269,644 blended player/date/format points.
  - SHA-256: `6f50d1b3e284b64df8c41a4147ed61fbdee4b6163d11d477e0ade0c60228b1a0`

## Policy

Keep `one-time-source-history.json` as the source of truth. Do not edit it by hand.

Every current or future weighted provider should be tracked in `scripts/value-history-source-registry.mjs` before it can affect the blend. Sources should use one of these capture paths:

- `archived`: raw historical source points already exist in the frozen archive.
- `import-ready`: the importer can accept an approved CSV/JSON/API export and add raw source points without changing the archive contract.
- `benchmark-only`: source is useful context, but not part of the default weighted blend.
- `future`: source is planned, but should not affect weights until the raw history and source-health path exists.

When weights change, rerun:

```bash
ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json \
OUT_FILE=server/value-history-archive/player-value-history-reblended.json \
BLEND_NAME=current-default-weights \
pnpm reblend:value-history
```

Before using a regenerated archive in product logic, rerun:

```bash
ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json \
OUT_FILE=server/value-history-archive/player-value-history-audit.json \
pnpm audit:value-history
```

The large JSON files are gitignored because they are generated data. Back them up outside Git before deleting the local archive directory.

For future weighting changes, preserve `one-time-source-history.json` and its SHA-256 checksum. The reblended file is disposable because it can always be regenerated from the raw archive with a new `WEIGHTS` value.

To audit source coverage before adding a new provider to the weighted blend:

```bash
ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json \
OUT_FILE=server/value-history-archive/source-coverage-audit.json \
pnpm audit:value-history:sources
```

If a provider has no archived points, leave its effective weight at zero or import an approved historical export first. Do not fill missing source history by guessing.

## Backup

A local compressed backup bundle was created at:

- `server/value-history-archive/value-history-archive-2026-05-17.tar.gz`
- SHA-256: `fe76db944325ed507d80e6a03e9bccdc3d292bdce4be1aa10e48caf8c1d7b858`
- `server/value-history-archive/value-history-archive-2026-05-17-dynastyprocess.tar.gz`
- SHA-256: `b62afd89955e933769bce7efe82c6f95179f86ea8ae2b72a80b724377af2bca1`
- `server/value-history-archive/value-history-archive-2026-05-17-fantasycalc-fantasypros.tar.gz`
- SHA-256: `2e46d29f3d1dc1e78b29be8f3a4e5b0073f534018fc2887efb286809bb56b213`

The bundles and `.sha256` manifests are gitignored. Copies are also stored under `/Volumes/Mac HD/BuiltByBill/dynasty-degenerate-value-history-backups/`.

## Approved Imports

Use `docs/value-history-imports.md` and the CSV templates in `docs/value-history-import-templates/` when adding approved historical exports for FantasyCalc, FantasyPros, DynastyProcess, Dynasty Nerds, Fantasy Nerds, or future weighted sources.
