# Redraft Draft Outcome Aggregates

This folder stores sanitized aggregate-only draft outcome baselines for the future Redraft Draft Coach.

The baseline JSON keeps counts by format, season, draft type, draft slot bucket, opening position sequence, champion strategy, and top-points strategy. It intentionally omits raw league IDs, user IDs, roster IDs, player IDs, manager names, and player names.

The source maintenance command is:

```bash
pnpm analyze:redraft-draft-network --username <sleeper-username> --depth 2 --completed-seasons 4 --rounds 4 --max-managers 750 --max-leagues 5000 --summary-only --out .cache/redraft-draft-outcomes/<run-name>.json
```

Before committing a refreshed baseline, remove seed user identifiers from the `.cache` output and keep only the aggregate payload.

Build the smaller app-facing rules file from the sanitized baseline with:

```bash
pnpm build:redraft-strategy-rules
```

`redraft-strategy-rules-v1.json` is the fast Draft Coach input. The larger baseline stays as the evidence layer for recalibration.
