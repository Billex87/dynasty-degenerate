# Dynasty Degens Sleeper Helper

Chrome extension helper for importing pending Sleeper trade and waiver activity into Dynasty Degens without copying Authorization headers.

## Phase 1 scope

- Read-only capture only.
- Runs only on Sleeper league activity pages: Trades, Players/Waivers, and Transactions, plus `http://localhost:3000/*`, `https://dynastydegens.com/*`, and `https://www.dynastydegens.com/*`.
- Does not read, display, store, or transmit Sleeper Authorization headers or cookies.
- Keeps the latest sanitized capture in Chrome session storage and clears it when the browser session ends.
- Lets Dynasty Degens request a fresh capture from the app button; the popup remains a manual fallback only.

## Install locally

1. Open Chrome Extensions: `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `browser-extension/sleeper-helper`.
5. Confirm the extension shows version `0.2.0` or newer.

## Local test flow

1. Start Dynasty Degens locally at `http://localhost:3000`.
2. Open a report for the target Sleeper league and go to Trades.
3. Click `Import Pending Transactions`.
4. The helper opens/refreshes Sleeper Trades and Players pages.
5. Dynasty Degens automatically imports the sanitized pending trade/waiver snapshot.

## Production test flow

1. Reload the unpacked extension in `chrome://extensions` after pulling changes.
2. Open `https://dynastydegens.com/?leagueId=<leagueId>#trades`.
3. Click `Import Pending Transactions`.
4. The helper opens/refreshes Sleeper Trades and Players pages.
5. Dynasty Degens automatically imports the sanitized pending trade/waiver snapshot.

## Package for Chrome Web Store review

From the repo root:

```bash
pnpm package:sleeper-helper
```

The script regenerates extension icons and writes the review zip to `dist/browser-extension/sleeper-helper/`.

## Troubleshooting

- If Dynasty Degens says the helper is not detected, reload the extension in `chrome://extensions`, then reload Dynasty Degens.
- If Sleeper does not return a snapshot, make sure the same Chrome profile is signed into Sleeper and retry.
- If no pending items are imported, Sleeper responded but did not expose any current pending trades or waiver claims on the refreshed pages.
- If the popup cannot send manually, open Dynasty Degens first and retry from the Trades tab.
