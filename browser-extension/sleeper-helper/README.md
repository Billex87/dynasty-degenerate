# Dynasty Degens Transaction Sync

Chrome extension for importing pending Sleeper trade and waiver activity into Dynasty Degens without copying Authorization headers.

## Scope

- Read-only capture only.
- Runs only on Sleeper league activity pages: Trades, Players/Waivers, and Transactions, plus `http://localhost:3000/*`, `https://dynastydegens.com/*`, and `https://www.dynastydegens.com/*`.
- Does not read, display, store, or transmit Sleeper Authorization headers or cookies.
- Keeps the latest sanitized capture in Chrome session storage and clears it when the browser session ends.
- Lets Dynasty Degens request a fresh capture from the app button; the popup remains a manual fallback only.

## Install from Chrome Web Store

Use the published Chrome Web Store listing:

`https://chromewebstore.google.com/detail/dynasty-degens-transactio/hfbmbbcndhdoldlofakfbengicobmgpp`

After installing, open Dynasty Degens on desktop Chrome and use the Trades tab import button.

## Install unpacked for local testing

Use this only for local development or package QA.

1. Open Chrome Extensions: `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `browser-extension/sleeper-helper` from this repo.
5. Confirm the extension shows version `0.2.0` or newer.

If you are testing the packaged zip instead, unzip
`dist/browser-extension/sleeper-helper/dynasty-degens-transaction-sync-0.2.0.zip`
first, then load the unzipped folder with Load unpacked.

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

## Expected app states

- `Waiting for Chrome Helper`: the extension is not installed, disabled, or the app tab needs a refresh.
- `Chrome Helper detected`: the app can talk to the extension and is ready to import.
- `Importing pending transactions`: the helper is opening Sleeper and waiting for Sleeper's logged-in pages to return pending activity.
- `Captured ... pending items`: the helper found sanitized pending transactions and sent them back to Dynasty Degens.
- `Still waiting on Sleeper`: refresh the Sleeper Trades and Players/Waivers tabs in the same Chrome profile, then click `Import Pending Transactions` again.

## Package for Chrome Web Store review

From the repo root:

```bash
pnpm package:sleeper-helper
```

The script regenerates extension icons and writes the review zip to `dist/browser-extension/sleeper-helper/`.

The checked-in unpacked manifest keeps `http://localhost:3000/*` for local QA.
The packaged Chrome Web Store zip strips that development-only match and keeps
only Sleeper plus production Dynasty Degens host permissions.

Before submission, complete `SUBMISSION_CHECKLIST.md`.

## Troubleshooting

- If Dynasty Degens says the helper is not detected, reload the extension in `chrome://extensions`, then reload Dynasty Degens.
- If Sleeper does not return a snapshot, make sure the same Chrome profile is signed into Sleeper, refresh the Sleeper Trades and Players/Waivers tabs, then retry.
- If no pending items are imported, Sleeper responded but did not expose any current pending trades or waiver claims on the refreshed pages.
- If the popup cannot send manually, open Dynasty Degens first and retry from the Trades tab.

## Privacy boundary

- The extension does not send Sleeper Authorization headers, cookies, emails, analytics payloads, or profile metadata to Dynasty Degens.
- The extension sends only sanitized pending transaction fields needed for trade and waiver import.
- Captured data is stored in `chrome.storage.session`, not persistent Chrome storage.
- Phase 1 is read-only. It does not submit lineups, waivers, trades, accepts, rejects, or any other Sleeper account-changing action.
