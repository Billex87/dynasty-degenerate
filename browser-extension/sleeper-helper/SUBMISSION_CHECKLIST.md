# Dynasty Degens Transaction Sync Store Checklist

Use this checklist for Chrome Web Store package or listing updates.

Published listing:

`https://chromewebstore.google.com/detail/dynasty-degens-transactio/hfbmbbcndhdoldlofakfbengicobmgpp`

## Package

- Run `pnpm package:sleeper-helper`.
- Upload `dist/browser-extension/sleeper-helper/dynasty-degens-transaction-sync-0.2.0.zip`.
- Confirm the uploaded manifest version is `0.2.0`.
- Confirm the uploaded package manifest does not include `http://localhost/*`.
- Confirm the package uses Manifest V3.

## Store Listing tab

- Name: `Dynasty Degens Transaction Sync`.
- Short description: `Read-only helper that imports pending Sleeper trades and waivers into Dynasty Degens.`
- Detailed description: use the dashboard-safe paragraph copy in `STORE_LISTING.md`.
- Category: `Sports`.
- Language: `English`.
- Website: `https://dynastydegens.com`.
- Support/help URL: `https://dynastydegens.com/sleeper-helper`.

## Required images

- Extension icon: `browser-extension/sleeper-helper/icons/icon-128.png`.
- Small promotional image: 440x280 PNG.
- Screenshots: at least one, preferably five, 1280x800 PNGs.
- Recommended screenshots:
  - Dynasty Degens Trades tab before import.
  - Importing state with progress animation.
  - Imported pending trade and waiver cards.
  - Trade War Room opened from a pending trade.
  - Extension popup privacy boundary.

## Privacy tab

- Single purpose: `Import sanitized pending Sleeper trade and waiver snapshots into Dynasty Degens for roster and Trade War Room analysis.`
- Data disclosure: select `Website content`.
- Remote code: `No`.
- Privacy policy URL: `https://dynastydegens.com/sleeper-helper`.
- Limited use: certify that data is used only for the user-facing import, is not sold, is not transferred for unrelated purposes, is not used for advertising, and is not used for credit/lending decisions.

## Permission justifications

- `tabs`: Opens or focuses Sleeper and Dynasty Degens tabs for a user-initiated import.
- `storage`: Temporarily stores the latest sanitized capture in `chrome.storage.session`.
- `https://sleeper.com/leagues/*/trades*`: Runs the read-only capture helper on Sleeper trade pages for the selected league.
- `https://sleeper.com/leagues/*/players*`: Runs the read-only capture helper on Sleeper player and waiver pages where pending waiver claims are exposed.
- `https://sleeper.com/leagues/*/waivers*`: Runs the read-only capture helper on Sleeper waiver pages when Sleeper routes users there.
- `https://sleeper.com/leagues/*/transactions*`: Allows the helper to capture pending activity if Sleeper serves the same GraphQL transaction response on the transaction route.
- `https://dynastydegens.com/*`: Bridges sanitized snapshots into the Dynasty Degens report tab.
- `https://www.dynastydegens.com/*`: Same as above for the `www` production host.

## Test instructions tab

Paste this:

```text
1. Install the extension in Chrome.
2. Sign into Sleeper in the same Chrome profile.
3. Open a Dynasty Degens league report for a Sleeper league with pending trade or waiver activity.
4. Open the Trades tab.
5. Click Import Pending Transactions.
6. The helper opens Sleeper league pages, captures only pending transaction responses, sanitizes them, and imports the snapshot into Dynasty Degens.

Expected result: pending trades and waiver claims appear in Pending Trade Offers and can be opened in Trade War Room.

If the reviewer does not have a Sleeper league with pending activity, the extension should still show as installed and detected on the Dynasty Degens Trades tab, but no pending items will import because Sleeper did not expose current pending activity.
```

## Release recommendation

- Use deferred publishing if available for package changes so the approved item can be manually released.
- After approval or listing edits, test the store-installed extension against `https://dynastydegens.com/?leagueId=1312139584427012096#trades`.
- Confirm the public listing still shows the correct privacy disclosure: `Website content`.
