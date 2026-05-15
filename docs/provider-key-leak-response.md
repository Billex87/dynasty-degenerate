# Provider Key Leak Response Plan

Use this when a third-party data provider key may have been exposed and the provider cannot immediately rotate or reissue the key.

## Immediate Containment

1. Disable the feature flag for the affected provider in production.
2. Remove the provider key from production, preview, local `.env.local`, CI secrets, and any deployment dashboard environment.
3. Redeploy the previous stable build or a no-provider build if the current release requires the exposed key.
4. Search the repo and recent logs for the key value, provider header name, and provider URL.
5. Confirm the key is not present in client bundles, sourcemaps, browser logs, server logs, screenshots, or exported reports.

## Verification Commands

```bash
rg -n "FANTASYPROS_API_KEY|FANTASY_NERDS_API_KEY|SOURCE_HEALTH_ALERT_WEBHOOK_URL|x-api-key|Authorization" .
pnpm build
```

Never paste the secret itself into shell history. Search for fixed prefixes, env var names, provider header names, and known URL paths instead.

## Provider-Specific Posture

- FantasyPros: keep `FANTASYPROS_API_KEY` server-only. Do not enable paid/public primary use until production terms are explicitly approved.
- Fantasy Nerds: keep `FANTASY_NERDS_API_KEY` server-only. Do not rely on dev/test keys outside development.
- Source health webhook: treat `SOURCE_HEALTH_ALERT_WEBHOOK_URL` as a write-capable secret because it can post externally.

## Recovery

1. Request provider-side key rotation or revocation even if the provider says keys are not normally rotated.
2. Keep the integration disabled until a clean key or explicit provider approval is available.
3. Re-enable the provider behind the narrowest feature flag first.
4. Run the provider diagnostics command and confirm it prints only status, row counts, freshness, expert counts, and errors.
5. Record the incident in the overnight report or release notes with the affected provider, disabled flags, redeploy hash, and verification result.

