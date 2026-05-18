# Redraft Value History

This folder stores compact, generated redraft value-history artifacts for future Draft Coach and player-modal graphs.

The builder reads stored local archives and redraft source snapshots, then writes normalized player/date/source/rank/value rows. It does not call provider APIs and does not store raw provider payloads or credentials.

Build the archive with:

```bash
pnpm build:redraft-value-history
```

Generated files:

- `redraft-value-history-v1.json`: full normalized redraft history from FantasyPros `DRAFT`, `ADP`, and `ROS` history plus current redraft source snapshots.
- `redraft-value-trends-v1.json`: precomputed latest, high, low, and 30/90/180/365-day movement windows for fast UI reads.
- `redraft-value-history-manifest-v1.json`: small runtime-safe manifest with counts, date ranges, file paths, and load policy.
- `redraft-value-history-audit.json`: source, ranking-type, scoring, phase, player, point, and date-range counts.
- `player-redraft-value-shards/`: player-key prefix shards used by backend/player-modal hydration.

Keep this archive separate from the dynasty value-history archive. Redraft values reset by season and are intended for draft cost, rest-of-season movement, current-season player graphs, and redraft Draft Coach context.

Do not eagerly import the full archive or trends file into client bundles. UI work should read through the backend player lookup, which hydrates a single player shard and keeps provider history out of report payloads.
