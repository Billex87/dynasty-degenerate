# League AI Confidence

League AI confidence is separate from source trust. Source trust asks whether a ranking site should get more or less weight. League confidence asks how much league-specific evidence the report has for this exact league.

The score is allowed to start low. That is useful because a new league, a league with little trade history, or a report without stored snapshots should not look as certain as a league with months of accumulated behavior.

## Inputs

- roster coverage and starter-slot parsing
- market value coverage and ranking source trust
- standings seasons and trade history
- recent transactions, waiver context, and draft context
- monthly blueprint snapshots for this league
- schedule and matchup previews when available

The report stores this at `reportData.leagueDiagnostics.aiConfidence`. UI confidence panels use it when present, and admin diagnostics show it when the league read is still building or moving.

## Dynamic Behavior

- `previousScore` and `scoreDelta` prefer the latest persisted `leagueAiConfidenceSnapshots` row, then fall back to the prior monthly blueprint window when snapshot history does not exist yet.
- `history` exposes recent persisted confidence snapshots for admin trend diagnostics.
- `calibration` shows whether the league has enough real in-season samples to tune thresholds. Before the season window, this is intentionally marked pending.
- `managerConfidence` breaks the score down by manager, so a manager with no trade/transaction/snapshot history can remain low confidence even when the overall league confidence is stronger.
- Trade and transaction history is recency weighted. Recent manager behavior matters more than old behavior.
- AI recommendation confidence is capped by league and manager confidence, so player cards, waiver reads, trade reads, projections, and weekly actions cannot look more certain than the evidence behind the league.
- Player cards also show a separate value-confidence read. That score is derived from available player value sources, primary-source count, source agreement/spread, and rank coverage. It is intentionally separate from league AI confidence because a league can be well understood while a specific player value is still thin.

## Storage

- Snapshot writes happen during league report generation unless `ENABLE_LEAGUE_AI_CONFIDENCE_SNAPSHOTS=false`.
- Database storage uses `leagueAiConfidenceSnapshots`; local JSON fallback files live under `server/league-ai-confidence-snapshots/` and are ignored by git.
- `/api/cron/dynamic-data-refresh` can backfill confidence snapshots from existing cached reports and refresh source-health diagnostics.
- Set `NFL_SEASON_START_DATE=YYYY-MM-DD` when the official season date is final so calibration status uses the right window.

## Expected Behavior

- Low confidence is not a failure. It means the app has a thinner league memory.
- Confidence should rise as monthly snapshots, standings, trades, transactions, and matchup context accumulate.
- Strong player/source data can improve the score, but it should not fully replace actual league behavior history.
