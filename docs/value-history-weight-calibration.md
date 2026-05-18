# Value History Weight Calibration

Generated: 2026-05-17

Calibration compares raw source values against later cross-source consensus for the same player and format. It is a decision-support report, not an automatic production-weight mutation.

## Latest Run

Command:

```bash
ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json \
OUT_FILE=server/value-history-archive/value-history-weight-calibration.json \
pnpm calibrate:value-history:weights
```

Result:

- Horizon: 180 days.
- Future comparisons: 942,831.
- Calibration report SHA-256: `da409688f5708e74ee77f973e8ed76e153743e6746ff2f6673544cb50a34d172`.

| Source | Samples | Error | Direction hit | Current | Suggested |
| --- | ---: | ---: | ---: | ---: | ---: |
| KeepTradeCut | 760,440 | 59.8% | 81.8% | 0.14 | 0.194 |
| FantasyCalc | 115,816 | 93.2% | 60.7% | 0.10 | 0.155 |
| FantasyPros | 3,403 | 224.7% | 24.5% | 0.12 | 0.058 |
| DynastyProcess | 192,655 | 184.0% | 34.8% | 0.02 | 0.051 |
| Dynasty Nerds | 0 | n/a | n/a | 0.23 | 0.223 |
| Fantasy Nerds | 0 | n/a | n/a | 0.07 | 0.068 |
| Flock Fantasy | 419,084 | 84.3% | 37.5% | 0.32 | 0.252 |

## Recommendation

Do not auto-apply the suggested weights yet. The direct historical sources are now measurable, but Dynasty Nerds and Fantasy Nerds do not have a forward test window because their archive coverage is local stored snapshots only. Keep current production weights until either:

- we accept a cautious manual adjustment after reviewing report behavior, or
- enough future local snapshots accumulate to test Dynasty Nerds/Fantasy Nerds against outcomes.

The current evidence supports a future manual test blend that gives more weight to KTC and FantasyCalc, less to FantasyPros and Flock, and keeps Dynasty Nerds/Fantasy Nerds roughly stable until forward evidence exists.
