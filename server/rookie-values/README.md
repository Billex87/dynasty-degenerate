# Rookie Value Baselines

These files are locked draft-year baselines for rookie draft value-change calculations.

- `2025RookieBlendSnapshot.json`: canonical 2025 rookie historical draft-window value set used for 2025 rookie drafts. It stores the source metadata plus every locked rookie value so we can always audit the draft-window baseline.
- `2025RookieValues.json`: generated values payload used inside the snapshot. It combines May 2025 KTC with DynastyProcess `values-players.csv` from `2025-05-09`, the closest proven historical external source we have.
- `2026RookieValues.json`: First production market value set, captured at `2026-04-29T20:13:16.208Z` (April 29, 2026 at 1:13 PM Pacific). Kept as an audit artifact.
- `../ktc-snapshots/ktc-snapshot-2026-05-07.json`: Active 2026 rookie baseline. This is the first stabilized May 2026 multi-source blend with Flock Fantasy, Dynasty Nerds, KTC, FantasyCalc, and DynastyProcess coverage.

## Baseline Date Policy

Use the first Monday after NFL Draft weekend as the yearly rookie value baseline date. That gives the market a full draft weekend to absorb landing spots, but captures values before training-camp hype, rookie draft ADP, and beat-report movement take over. If the exact date is missing in the archive, use the closest available archived point on or after that date; if none exists, use the nearest point and flag the gap in the audit.

| Year | NFL Draft Window | Baseline Date |
| --- | --- | --- |
| 2022 | 2022-04-28 to 2022-04-30 | 2022-05-02 |
| 2023 | 2023-04-27 to 2023-04-29 | 2023-05-01 |
| 2024 | 2024-04-25 to 2024-04-27 | 2024-04-29 |
| 2025 | 2025-04-24 to 2025-04-26 | 2025-04-28 |
| 2026 | 2026-04-23 to 2026-04-25 | 2026-04-27 |

Do not replace these with rolling nightly snapshots unless we intentionally redefine draft-year baselines.
Draft History should compare historical draft-window value to current value, not raw KTC to current value.
