# Value History Archive

Generated: 2026-05-17

This archive is the frozen raw source history used to regenerate player value timelines when blend weights change.

## Stored Files

- `server/value-history-archive/one-time-source-history.json`
  - Raw source archive from direct KTC player pages, direct Flock player history endpoints, official DynastyProcess GitHub `values-players.csv` commit history, direct FantasyCalc player history endpoints, FantasyPros API ranking snapshots, and local stored Dynasty Nerds source snapshots.
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
  - KeepTradeCut, Flock Fantasy, FantasyCalc, FantasyPros, DynastyProcess, and Dynasty Nerds are present.
  - Dynasty Nerds history is partial local stored-source snapshot coverage, not full source-native direct history.
  - SHA-256: `67c2f2c8ab9a92be6c0f4dcf308a5620cc87733223566b3a758149d8adeecfca`
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
  - Source-specific partial archive from locally stored Dynasty Degen source snapshots for Dynasty Nerds columns.
  - 358 players.
  - 5,366 raw player/date/source/format points.
  - Includes 5,286 Dynasty Nerds points.
  - SHA-256: `6e3dd6aa7eea0a05d980ad984a6c84010099862016666cf33b14ac6e52b22fb2`
- `server/value-history-archive/player-value-history-reblended.json`
  - Derived timeline using audited 2026-05-17 default weights.
  - 2,296 players.
  - 1,268,594 blended player/date/format points.
  - SHA-256: `c4595f627d38448639f65c0061098be5b39b4dfd21239466eb3c2a59ac2790ee`
- `server/value-history-archive/value-history-weight-calibration.json`
  - Derived weight-calibration report from raw source values versus later cross-source consensus.
  - 942,831 future comparisons at a 180-day horizon.
  - SHA-256: `18ba46cb77a2ec15741246463d8b391b40d3ee42a67bd0e762c0c0def00da472`
- `server/value-history-archive/player-value-history-timeline-index.json`
  - Compact derived index for player modal charts and historical trade-date value lookup.
  - 1,724 players, 8,746 player-format timelines, 414,528 compact window points, and 508,216 as-of lookup points.
  - SHA-256: `e2643cdd6506d6877990ae0d17b60f11ec0deb0db47a251833c89ea9569a7168`
- `server/value-history-archive/player-value-history-shards/`
  - Sharded derived index for production player graphs and trade-date value lookup.
  - Keeps the same graph windows and as-of lookup points as the full timeline index, but report generation reads only the shard matching the requested player name.
  - Generated locally as 179 shard files plus `manifest.json`.
  - Total local size is about 115 MB, but the largest shard is about 10 MB and most requests only touch a few shards.

## Policy

Keep `one-time-source-history.json` as the source of truth. Do not edit it by hand.

After merging any imported source archive, run `pnpm normalize:value-history:identities` against the merged output before audit/reblend. The normalizer only performs high-confidence identity cleanup: suffix variants, explicit known aliases, same-position grouping, and unknown-position inference when a single matching known position exists. It keeps kicker, team defense, IDP, and other ranked rows by default. Use `ONLY_CORE_DYNASTY_ASSETS=1` only for a temporary QB/RB/WR/TE/pick-focused audit output, not for the canonical archive.

Every current or future weighted provider should be tracked in `scripts/value-history-source-registry.mjs` before it can affect the blend. Sources should use one of these capture paths:

- `archived`: raw historical source points already exist in the frozen archive.
- `import-ready`: the importer can accept an approved CSV/JSON/API export and add raw source points without changing the archive contract.
- `benchmark-only`: source is useful context, but not part of the default weighted blend.
- `future`: source is planned, but should not affect weights until the raw history and source-health path exists.

The app-owned cached blended profiles are handled separately from provider-native source history. Use:

```bash
VALUE_PROFILE_KEYS=12_sf_ppr_base,12_sf_ppr_tep_0_5,12_sf_ppr_tep_1_0,12_sf_ppr_tep_1_5,12_one_qb_ppr_base,12_one_qb_ppr_tep_0_5,12_one_qb_ppr_tep_1_0,12_one_qb_ppr_tep_1_5 \
OUT_FILE=server/value-history-archive/local-cache-blended-history.json \
AUDIT_FILE=server/value-history-archive/local-cache-blended-history-audit.json \
pnpm promote:value-history:cached
```

This archive represents Dynasty Degen's own stored profile values by date and format. Keep it as fallback history for TEP/profile gaps and trade-date lookups; do not treat it as another independent provider signal when recalibrating source weights.

When weights change, rerun:

```bash
ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json \
OUT_FILE=server/value-history-archive/player-value-history-reblended.json \
BLEND_NAME=audited-2026-05-17-weights \
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

To refresh the production-oriented sharded history store after reblending, rerun:

```bash
ARCHIVE_FILE=server/value-history-archive/player-value-history-reblended.json \
OUT_DIR=server/value-history-archive/player-value-history-shards \
pnpm index:value-history:shards
```

To refresh a static/CDN-ready copy for browser-side graph hydration, rerun:

```bash
ARCHIVE_FILE=server/value-history-archive/player-value-history-reblended.json \
OUT_DIR=client/public/assets/value-history/player-value-history-shards \
pnpm index:value-history:shards
```

Audit either shard directory before using it:

```bash
SHARD_DIR=server/value-history-archive/player-value-history-shards \
pnpm audit:value-history:shards

SHARD_DIR=client/public/assets/value-history/player-value-history-shards \
pnpm audit:value-history:shards
```

Upload the generated shard directory to S3/R2-compatible object storage with a dry run first:

```bash
SHARD_DIR=server/value-history-archive/player-value-history-shards \
VALUE_HISTORY_SHARDS_BUCKET=your-bucket \
VALUE_HISTORY_SHARDS_PREFIX=value-history/player-value-history-shards \
DRY_RUN=1 \
pnpm upload:value-history:shards
```

Set `DRY_RUN=0` only after the dry-run file count and total size match the audit output. The uploader gives `manifest.json` a short CDN cache window and shard files a long immutable cache window.

The sharded store is the preferred runtime path for historical player graphs and trade-date values. The full `player-value-history-timeline-index.json` remains useful for local inspection and one-file backups, but normal report generation should avoid loading the full file when shards are available. The report payload keeps only the selected timeline window; the player modal hydrates full windows, all-time range, and yearly extremes from `/assets/value-history/player-value-history-shards` when the user opens the chart. Set `VITE_VALUE_HISTORY_SHARDS_BASE_URL` when the shards are hosted outside the app, such as an object store or CDN. If that URL is not same-origin, the production CSP `connect-src` must explicitly allow the CDN host. The raw archive and reblended archive should stay offline/generated; production should mount, upload, or restore the shard directory as a generated artifact rather than calling external providers during user traffic.

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

Use `docs/value-history-imports.md` and the CSV templates in `docs/value-history-import-templates/` when adding approved historical exports for FantasyCalc, FantasyPros, DynastyProcess, Dynasty Nerds, or future weighted sources.
