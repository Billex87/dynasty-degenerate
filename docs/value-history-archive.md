# Value History Archive

Generated: 2026-05-17

This archive is the frozen raw source history used to regenerate player value timelines when blend weights change.

## Stored Files

- `server/value-history-archive/one-time-source-history.json`
  - Raw source archive from direct KTC player pages, direct Flock player history endpoints, official DynastyProcess GitHub `values-players.csv` commit history, direct FantasyCalc player history endpoints, FantasyPros API ranking snapshots, and local stored Dynasty Nerds/Fantasy Nerds source snapshots.
  - Identity-normalized after source merge so high-confidence suffix/name variants share one player record.
  - Keeps kicker, defense, IDP, and other ranked assets so league formats that use them can still value them.
  - 2,296 players.
  - 2,076,916 raw player/date/source/format points.
  - SHA-256: `95dfc725e50d49cb2db5b361245dfbf8e98c1b8b9bf7c4ff930207376f2718de`
- `server/value-history-archive/player-value-history-audit.json`
  - Audit report for the raw archive.
  - Passed with zero warnings and zero errors.
  - SHA-256: `45ea9497ac72752aa4c611228e1fd2ffd3ce62c634912cfe1076f7e053ace1c7`
- `server/value-history-archive/source-coverage-audit.json`
  - Source coverage report for the raw archive.
  - KeepTradeCut, Flock Fantasy, FantasyCalc, FantasyPros, DynastyProcess, Dynasty Nerds, and Fantasy Nerds are present.
  - Dynasty Nerds/Fantasy Nerds history is partial local stored-source snapshot coverage, not full source-native direct history.
  - SHA-256: `d0f10dccb42f9dad41f889779baa75f322ba96baea1755e79b945713933c39a3`
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
- `server/value-history-archive/local-nerds-source-history.json`
  - Source-specific partial archive from locally stored Dynasty Degen source snapshots for Dynasty Nerds and Fantasy Nerds columns.
  - 358 players.
  - 5,366 raw player/date/source/format points.
  - Includes 5,286 Dynasty Nerds points and 80 Fantasy Nerds points.
  - SHA-256: `6e3dd6aa7eea0a05d980ad984a6c84010099862016666cf33b14ac6e52b22fb2`
- `server/value-history-archive/player-value-history-reblended.json`
  - Derived timeline using current default weights.
  - 2,296 players.
  - 1,268,594 blended player/date/format points.
  - SHA-256: `f3b1ebbbe99bb225319e8c9f4d0efa625b213ed1d04464acf84d4b7abbb1d6ba`
- `server/value-history-archive/value-history-weight-calibration.json`
  - Derived weight-calibration report from raw source values versus later cross-source consensus.
  - 942,831 future comparisons at a 180-day horizon.
  - SHA-256: `da409688f5708e74ee77f973e8ed76e153743e6746ff2f6673544cb50a34d172`
- `server/value-history-archive/player-value-history-timeline-index.json`
  - Compact derived index for player modal charts.
  - 1,724 players, 8,746 player-format timelines, 414,528 compact window points.
  - SHA-256: `834cbdd24977646126e796ae28534510a8a062c2a1673cc4f829e0a88c869ab8`

## Policy

Keep `one-time-source-history.json` as the source of truth. Do not edit it by hand.

After merging any imported source archive, run `pnpm normalize:value-history:identities` against the merged output before audit/reblend. The normalizer only performs high-confidence identity cleanup: suffix variants, explicit known aliases, same-position grouping, and unknown-position inference when a single matching known position exists. It keeps kicker, team defense, IDP, and other ranked rows by default. Use `ONLY_CORE_DYNASTY_ASSETS=1` only for a temporary QB/RB/WR/TE/pick-focused audit output, not for the canonical archive.

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

To review whether weights should change before mutating defaults, rerun:

```bash
ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json \
OUT_FILE=server/value-history-archive/value-history-weight-calibration.json \
pnpm calibrate:value-history:weights
```

To refresh the compact player graph index after reblending, rerun:

```bash
ARCHIVE_FILE=server/value-history-archive/player-value-history-reblended.json \
OUT_FILE=server/value-history-archive/player-value-history-timeline-index.json \
pnpm index:value-history:timelines
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
- `server/value-history-archive/value-history-archive-2026-05-17-all-weighted-sources.tar.gz`
- SHA-256: `25e1049080f04ff519bfa9efbc800f032b846dede49215a6f49ae03c087e5875`
- `server/value-history-archive/value-history-archive-2026-05-17-normalized-all-weighted-sources.tar.gz`
- SHA-256: `06f88eb5efd359708cad8abc1e5141e490e183e5578a3d0c099e672c3cf7ebbc`

The bundles and `.sha256` manifests are gitignored. Copies are also stored under `/Volumes/Mac HD/BuiltByBill/dynasty-degenerate-value-history-backups/`.

## Approved Imports

Use `docs/value-history-imports.md` and the CSV templates in `docs/value-history-import-templates/` when adding approved historical exports for FantasyCalc, FantasyPros, DynastyProcess, Dynasty Nerds, Fantasy Nerds, or future weighted sources.
