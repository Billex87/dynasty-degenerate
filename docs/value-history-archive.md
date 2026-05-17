# Value History Archive

Generated: 2026-05-17

This archive is the frozen raw source history used to regenerate player value timelines when blend weights change.

## Stored Files

- `server/value-history-archive/one-time-source-history.json`
  - Raw source archive from direct KTC player pages and direct Flock player history endpoints.
  - 580 players.
  - 1,561,333 raw player/date/source/format points.
  - SHA-256: `19a67ed904fb181655ca6b399df8e1755a06ecaec397079c5de5379cbaeb941b`
- `server/value-history-archive/player-value-history-audit.json`
  - Audit report for the raw archive.
  - Passed with zero warnings and zero errors.
  - SHA-256: `c431890e28fe9d061e4c634ff635113abff8988168fd2526c2adafff4f0acfa4`
- `server/value-history-archive/player-value-history-reblended.json`
  - Derived timeline using current default weights.
  - 580 players.
  - 1,079,913 blended player/date/format points.
  - SHA-256: `e8b21472a47f9c063ce9088d273266da53e77d8db673c93143c1f20914c18ee2`

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

The bundle and `.sha256` manifest are gitignored. Move a copy to durable storage before relying on this as the long-term source archive.

## Approved Imports

Use `docs/value-history-imports.md` and the CSV templates in `docs/value-history-import-templates/` when adding approved historical exports for FantasyCalc, FantasyPros, DynastyProcess, Dynasty Nerds, Fantasy Nerds, or future weighted sources.
