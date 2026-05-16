# Projections / SOS Source Policy

Normal user loads must keep weekly projection, schedule, and SOS reads snapshot-backed. Sleeper remains the only live source during login/report load, and only for current league state such as rosters, matchups, submitted lineups, transactions, drafts, and players.

## Approved Blend For Current Schedule Features

| Signal | Current Source | Load Boundary | Notes |
| --- | --- | --- | --- |
| NFL bye weeks | NFL.com 2026 schedule-release map embedded in `server/schedulePlanning.ts` | Static app data | Used for player schedule profiles, roster gap checks, and bye-window notes. |
| League matchups and submitted lineups | Sleeper league matchup/current-state endpoints | Live on report load | Safe to call on login because this is the live league state the user expects to refresh. |
| Strength of schedule | DraftSharks SOS snapshot only when approved partner URL/key are configured | Cron/admin refresh, then stored snapshot | Do not scrape public DraftSharks pages. If not configured, schedule features fall back to bye-week planning with neutral SOS. |
| Weekly projections | Not approved for public production yet | Blocked until endpoint rights/freshness are validated | FantasyPros projections are useful, but paid/public use still needs approved commercial terms and rate-limit validation. |
| Player props / market signal | OpticOdds stored props snapshot after key approval | Cron/admin refresh, then stored snapshot | Can support start/sit confidence once real snapshots exist and responsible-gaming boundaries are in place. |

## DraftSharks vs FantasyPros

DraftSharks is the preferred first SOS source because the integration shell is partner-key gated, position/team based, and maps directly into bye, streamer, avoid-week, and schedule-tier fields. FantasyPros remains valuable for projections, ADP, injuries, news, player-points, and expert context, but it should not be raised as a primary paid/public projection source until production rights and normal rate limits are explicitly approved.

## Implementation Status

- `server/reportStaticInputs.ts` loads DraftSharks/SOS through snapshot mode for report loads.
- `server/reportStaticSections.ts` caches player schedule profiles.
- `server/schedulePlanning.ts` builds schedule planning, streamer candidates, bye windows, and matchup previews from Sleeper current-state plus stored schedule profiles.
- `server/sourceSnapshotFreshness.ts` includes `draftsharks-sos-v1`, `player-props-opticodds-v1`, FantasyPros news, ESPN depth charts, redraft source snapshots, and Sleeper season-stat snapshots in report freshness diagnostics.
- `server/fantasyProsHealth.ts` emits endpoint-level health rows for FantasyPros API coverage without printing payloads or secrets.

## Blocked Before Projection-Driven Features

- FantasyPros projection endpoint terms/rate limits must be approved for production use.
- A first real OpticOdds player-prop snapshot must be stored before prop thresholds are tuned.
- Projection source/version metadata needs to be captured with stored snapshots before lineup-strength or confidence models should treat projections as first-class inputs.

