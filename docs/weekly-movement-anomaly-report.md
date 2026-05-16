# Weekly Movement Anomaly Report

`pnpm audit:weekly-movement` compares stored value snapshots and prints a metadata-only anomaly report for weekly risers/fallers.

The report is intentionally admin-safe:

- It reads stored KTC/blended value snapshots only.
- It prints player key, display name, position rank, baseline/current values, delta, percent change, contributing source names, and anomaly reasons.
- It does not print raw snapshot payloads, API keys, league IDs, manager IDs, or secrets.

Default behavior:

- Current snapshot: latest local `server/ktc-snapshots/ktc-snapshot-YYYY-MM-DD.json` on or before today.
- Baseline snapshot: latest local snapshot on or before the 7-day target, respecting the temporary `2026-05-07` weekly baseline floor.
- Default limit: 25 rows.

Useful commands:

```bash
pnpm audit:weekly-movement
pnpm audit:weekly-movement -- --limit=10
pnpm audit:weekly-movement -- --profile=12_sf_ppr_base
pnpm audit:weekly-movement -- --current=2026-05-11 --baseline=2026-05-07
```

Anomaly reasons:

- `extreme-pct-change`: percent move is unusually large.
- `large-absolute-change`: raw value delta is unusually large.
- `low-baseline-denominator`: the baseline value is small enough that percentages can look misleading.
- `source-set-changed`: the player's contributing value sources changed while the value moved materially.

May 15, 2026 local run:

- Command: `pnpm audit:weekly-movement -- --limit=10`
- Current local snapshot: `2026-05-11`
- Baseline local snapshot: `2026-05-07`
- Compared players: 735
- Total anomaly candidates: 204

The local repo did not contain a May 14 or May 15 snapshot during this run, so the production/current-snapshot riser/faller recheck remains open until a newer stored snapshot is available in the runtime being audited.
