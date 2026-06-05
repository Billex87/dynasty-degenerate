# Dynasty Degens Sleeper Helper

Local unpacked Chrome extension MVP for importing pending Sleeper trade and waiver activity into Dynasty Degens without copying Authorization headers.

## Phase 1 scope

- Read-only capture only.
- Runs only on Sleeper league activity pages: Trades, Players/Waivers, and Transactions, plus `http://localhost:3000/*`.
- Does not read, display, store, or transmit Sleeper Authorization headers or cookies.
- Keeps the latest sanitized capture in Chrome session storage and clears it when the browser session ends.
- Lets Dynasty Degens request a fresh capture from the app button; the popup remains a manual fallback only.

## Install locally

1. Open Chrome Extensions: `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `browser-extension/sleeper-helper`.

## Test flow

1. Start Dynasty Degens locally at `http://localhost:3000`.
2. Open a report for the target Sleeper league and go to Trades.
3. Click `Import Pending Transactions`.
4. The helper opens/refreshes Sleeper Trades and Players pages.
5. Dynasty Degens automatically imports the sanitized pending trade/waiver snapshot.
