# Dynasty Degens Sleeper Helper Privacy Notes

Dynasty Degens Sleeper Helper is a read-only browser extension for importing pending Sleeper trade and waiver activity into Dynasty Degens.

## What the extension collects

- Pending Sleeper transaction IDs.
- Pending transaction type and status.
- League ID.
- Roster IDs involved in a pending transaction.
- Player IDs involved in adds, drops, and trade packages.
- Draft pick payloads included in a pending transaction.
- Waiver bid fields such as FAAB bid when Sleeper includes them.

## What the extension does not collect

- Sleeper Authorization headers.
- Sleeper cookies.
- Sleeper session credentials.
- Passwords, two-factor codes, email inbox data, or payment data.
- Analytics payloads.
- Arbitrary user profile metadata.

## Where data is stored

Captured snapshots are stored only in `chrome.storage.session` so they clear when the browser session ends.

Dynasty Degens receives only the sanitized transaction snapshot when the user explicitly starts an import from the app or sends a snapshot from the popup.

## Permissions

- `tabs`: used to open or focus Sleeper and Dynasty Degens tabs for the import flow.
- `storage`: used for temporary session-only snapshot storage.
- Sleeper host permissions: used only on supported league trade, player, waiver, and transaction pages.
- Dynasty Degens host permissions: used only to bridge the sanitized snapshot into the app.

## Product boundary

The extension does not accept, reject, propose, cancel, or submit Sleeper trades, waiver claims, lineup changes, or any other account-changing action.
