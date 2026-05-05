# Rookie Value Baselines

These files are locked draft-year baselines for rookie draft value-change calculations.

- `2025RookieBlendSnapshot.json`: canonical 2025 rookie historical draft-window value set used for 2025 rookie drafts. It stores the source metadata plus every locked rookie value so we can always audit the draft-window baseline.
- `2025RookieValues.json`: generated values payload used inside the snapshot. It combines May 2025 KTC with DynastyProcess `values-players.csv` from `2025-05-09`, the closest proven historical external source we have.
- `2026RookieValues.json`: First production market value set, captured at `2026-04-29T20:13:16.208Z` (April 29, 2026 at 1:13 PM Pacific), used for 2026 rookie drafts.

Do not replace these with rolling nightly snapshots unless we intentionally redefine draft-year baselines.
Draft History should compare historical draft-window value to current value, not raw KTC to current value.
