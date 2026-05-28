# Neon/Postgres Transfer Audit - 2026-05-28

## Scope
- Run `pnpm audit:neon-transfer` after loading local DB credentials.
- Read-only transfer/size diagnostics for next-round optimization decisions.

## Command
- `source .env.local && pnpm audit:neon-transfer`

## Results
- Generated: `2026-05-28T16:46:22.939Z`
- Limit: `20`

### Largest Tables
1. `playerValueSnapshots`: `907 MB` total (`615 MB` table, `292 MB` indexes), ~`1,563,226` rows
2. `ktcSnapshots`: `341 MB` total
3. `leagueReportCache`: `205 MB` total
4. `providerDataSnapshots`: `33 MB` total

### Largest `leagueReportCache` Payloads
- Largest single entries are `3.4–4.3 MB`, still around `311` rows across the table.
- Top recent transfer driver from the last sample:
  - `league 1312139584427012096`: `37 MB` over `37` writes (avg `1019 KB`)

### Snapshot Payloads
- Top payloads are mainly `redraftSourceSnapshots` in the `500–600 KB` range.
- `monthlyRosterBlueprintSnapshots` are in the `300 KB` range.

### Source Health Event Volume
- Recent rows are mostly repeated `FantasyPros*`, `KTC`, and major non-Sleeper feed activity from the most recent scheduled runs.
- No immediate transfer-size anomaly was introduced by source health in this sample; this audit is a size signal to target compression/metadata splits.

## Follow-up
- `playerValueSnapshots` is the primary DB growth and transfer surface now.
- If transfer remains elevated after runtime tuning, the next safe reductions are:
  - enforce/strengthen value-snapshot compaction targets,
  - continue report payload metadata-first reads (already present),
  - review stale-vs-usable cache retention windows for the heaviest league entries.
