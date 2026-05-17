# Value History Archive

Generated: 2026-05-17

This archive is the frozen raw source history used to regenerate player value timelines when blend weights change.

## Stored Files

- `server/value-history-archive/one-time-source-history.json`
  - Raw source archive from direct KTC player pages, direct Flock player history endpoints, and official DynastyProcess GitHub `values-players.csv` commit history.
  - 1,346 players.
  - 1,783,092 raw player/date/source/format points.
  - SHA-256: `df42f4dbbe724904b140374994c4ebccc63c696e6eddb409562152dc991f9248`
- `server/value-history-archive/player-value-history-audit.json`
  - Audit report for the raw archive.
  - Passed with zero warnings and zero errors.
  - SHA-256: `2ece0ba276b0f3d847ee0050ce90e73508a59e069448a11676b71745655535b1`
- `server/value-history-archive/source-coverage-audit.json`
  - Source coverage report for the raw archive.
  - KeepTradeCut, Flock Fantasy, and DynastyProcess are present.
  - FantasyCalc, FantasyPros, Dynasty Nerds, and Fantasy Nerds remain import-ready until a direct approved history/export path is confirmed.
  - SHA-256: `defdca7dc6fedf4eccb3274774986de01f66114dcc3c45bd55c1484ca6c30b3b`
- `server/value-history-archive/dynastyprocess-git-history.json`
  - Source-specific DynastyProcess archive from 196 official Git commits between 2022-05-17 and 2026-05-17.
  - 1,268 players.
  - 221,759 raw player/date/source/format points.
  - SHA-256: `d861bc9b7c4153cda30a54deda260704731a091c6f233be843557969cacfac3a`
- `server/value-history-archive/player-value-history-reblended.json`
  - Derived timeline using current default weights.
  - 1,346 players.
  - 1,189,309 blended player/date/format points.
  - SHA-256: `19633eb16375e215fe29fa528e4a8dad5e039f2b051c3f92a781c737e55f81a7`

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

The bundles and `.sha256` manifests are gitignored. Copies are also stored under `/Volumes/Mac HD/BuiltByBill/dynasty-degenerate-value-history-backups/`.

## Approved Imports

Use `docs/value-history-imports.md` and the CSV templates in `docs/value-history-import-templates/` when adding approved historical exports for FantasyCalc, FantasyPros, DynastyProcess, Dynasty Nerds, Fantasy Nerds, or future weighted sources.
