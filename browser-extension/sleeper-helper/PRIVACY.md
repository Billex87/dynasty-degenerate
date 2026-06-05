# Dynasty Degens Transaction Sync Privacy Notes

Dynasty Degens Transaction Sync is a read-only browser extension for importing pending Sleeper trade and waiver activity into Dynasty Degens.

## What the extension collects

- Pending Sleeper transaction IDs.
- Pending transaction type and status.
- League ID.
- Roster IDs involved in a pending transaction.
- Player IDs involved in adds, drops, and trade packages.
- Draft pick payloads included in a pending transaction.
- Waiver bid fields such as FAAB bid when Sleeper includes them.

Chrome Web Store disclosure category: this should be treated as `Website content`
because the helper observes Sleeper page responses that contain fantasy football
transaction content visible in the user's logged-in browser.

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

The extension does not sell this data, transfer it for unrelated purposes, use it
for advertising, or use it for credit/lending decisions.

## Remote code

The extension does not load or execute remotely hosted code. Runtime logic is
included in the extension package.

## Permissions

- `tabs`: used to open or focus Sleeper and Dynasty Degens tabs for the import flow.
- `storage`: used for temporary session-only snapshot storage.
- Sleeper host permissions: used only on supported league trade, player, waiver, and transaction pages.
- Dynasty Degens host permissions: used only to bridge the sanitized snapshot into the app.
- The Chrome Web Store package excludes the development-only `http://localhost:3000/*` permission that exists in the unpacked local manifest.

## Product boundary

The extension does not accept, reject, propose, cancel, or submit Sleeper trades, waiver claims, lineup changes, or any other account-changing action.
