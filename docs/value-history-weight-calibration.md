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
- Calibration report SHA-256: `18ba46cb77a2ec15741246463d8b391b40d3ee42a67bd0e762c0c0def00da472`.

| Source | Samples | Error | Direction hit | Current | Suggested |
| --- | ---: | ---: | ---: | ---: | ---: |
| KeepTradeCut | 760,440 | 59.8% | 81.8% | 0.26 | 0.317 |
| FantasyCalc | 115,816 | 93.2% | 60.7% | 0.15 | 0.181 |
| FantasyPros | 3,403 | 224.7% | 24.5% | 0.06 | 0.033 |
| DynastyProcess | 192,655 | 184.0% | 34.8% | 0.05 | 0.053 |
| Dynasty Nerds | 0 | n/a | n/a | 0.23 | 0.228 |
| Flock Fantasy | 419,084 | 84.3% | 37.5% | 0.25 | 0.188 |

## Recommendation

The production and historical default weights now use the audited 2026-05-17 blend:

- KeepTradeCut: 0.26
- FantasyCalc: 0.15
- FantasyPros: 0.06
- DynastyProcess: 0.05
- Dynasty Nerds: 0.23
- Flock Fantasy: 0.25

This is a controlled move toward the measurable calibration signal: more KTC, FantasyCalc, and DynastyProcess; less FantasyPros and Flock Fantasy; Dynasty Nerds held roughly stable because it does not yet have enough forward local snapshot history.

Do not chase the latest suggested weights automatically. The rerun still wants more KTC/FantasyCalc and less Flock/FantasyPros, but Dynasty Nerds still does not have a forward test window because its archive coverage is local stored snapshots only. Revisit another adjustment after:

- we review report behavior with the audited blend, and
- enough future local snapshots accumulate to test Dynasty Nerds against outcomes.

The current evidence supports a possible future manual test blend closer to KTC 0.32, FantasyCalc 0.18, Flock 0.19, FantasyPros 0.03, while keeping Dynasty Nerds stable until forward evidence exists.
