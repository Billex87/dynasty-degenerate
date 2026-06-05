# Chrome Web Store Listing Draft

## Name

Dynasty Degens Sleeper Helper

## Short description

Read-only helper that imports pending Sleeper trades and waivers into Dynasty Degens.

## Detailed description

Dynasty Degens Sleeper Helper connects your logged-in Sleeper web session to Dynasty Degens so pending trade offers and waiver claims can be imported without copying developer-tool headers.

The helper is intentionally narrow:

- It runs only on supported Sleeper league activity pages and Dynasty Degens.
- It captures Sleeper pending trade and waiver transaction responses already visible to your logged-in browser.
- It strips those responses down to player IDs, roster IDs, transaction IDs, bid fields, draft picks, type, status, and timestamps.
- It sends sanitized transaction snapshots to Dynasty Degens only after the user starts an import.
- It stores captured snapshots only in Chrome session storage.

The helper does not read, display, store, or transmit Sleeper Authorization headers, cookies, passwords, emails, or arbitrary profile metadata. It does not submit trades, waivers, lineups, accepts, rejects, or any account-changing action.

## Single purpose

Import sanitized pending Sleeper trade and waiver snapshots into Dynasty Degens for roster and Trade War Room analysis.

## Permissions justification

- `tabs`: Opens or focuses Sleeper and Dynasty Degens tabs for a user-initiated import.
- `storage`: Temporarily stores the latest sanitized capture in `chrome.storage.session`.
- `https://sleeper.com/leagues/*/...`: Captures pending transaction responses from Sleeper league trade/player/waiver pages.
- `https://dynastydegens.com/*`: Sends sanitized snapshots to Dynasty Degens.

## Privacy disclosure answer

The extension handles fantasy football league transaction data. It does not collect authentication credentials, cookies, passwords, payment information, health information, personal communications, or browsing history.

## Review notes

To test:

1. Install the unpacked extension.
2. Sign into Sleeper in the same Chrome profile.
3. Open a Dynasty Degens league report.
4. Go to Trades.
5. Click `Import Pending Transactions`.
6. The helper opens Sleeper league pages, captures pending transaction responses, sanitizes them, and imports the snapshot into Dynasty Degens.

Expected result: pending trades and waiver claims appear in Pending Trade Offers and can be opened in Trade War Room.
