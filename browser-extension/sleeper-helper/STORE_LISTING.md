# Chrome Web Store Listing Draft

Use this as the Chrome Developer Dashboard copy source for listing edits.

## Name

Dynasty Degens Transaction Sync

## Short description

Read-only helper that imports pending Sleeper trades and waivers into Dynasty Degens.

## Detailed description

Dynasty Degens Transaction Sync connects your logged-in Sleeper web session to Dynasty Degens so pending trade offers and waiver claims can be imported without copying developer-tool headers.

Sleeper's public API does not expose a user's private pending trade offers or waiver claims. This helper runs only when you start an import from Dynasty Degens, watches the supported Sleeper league pages that open in your own Chrome profile, and sends Dynasty Degens a sanitized pending-transaction snapshot for roster and Trade War Room analysis.

The helper is intentionally narrow. It runs only on supported Sleeper league activity pages and Dynasty Degens. It captures Sleeper pending trade and waiver transaction responses already visible to your logged-in browser. It strips those responses down to player IDs, roster IDs, transaction IDs, bid fields, draft picks, type, status, and timestamps. It sends sanitized transaction snapshots to Dynasty Degens only after you start an import. It stores captured snapshots only in Chrome session storage.

The helper does not read, display, store, or transmit Sleeper Authorization headers, cookies, passwords, emails, or arbitrary profile metadata. It does not submit trades, waivers, lineups, accepts, rejects, or any other account-changing action.

## Single purpose

Import sanitized pending Sleeper trade and waiver snapshots into Dynasty Degens for roster and Trade War Room analysis.

## Category

Sports

## Language

English

## Current visibility

Published Chrome Web Store listing:

`https://chromewebstore.google.com/detail/dynasty-degens-transactio/hfbmbbcndhdoldlofakfbengicobmgpp`

## Permissions justification

- `tabs`: Opens or focuses Sleeper and Dynasty Degens tabs for a user-initiated import.
- `storage`: Temporarily stores the latest sanitized capture in `chrome.storage.session`.
- `https://sleeper.com/leagues/*/trades*`: Runs the read-only capture helper on Sleeper trade pages for the selected league.
- `https://sleeper.com/leagues/*/players*`: Runs the read-only capture helper on Sleeper player and waiver pages where pending waiver claims are exposed.
- `https://sleeper.com/leagues/*/waivers*`: Runs the read-only capture helper on Sleeper waiver pages when Sleeper routes users there.
- `https://sleeper.com/leagues/*/transactions*`: Allows the helper to capture pending activity if Sleeper serves the same GraphQL transaction response on the transaction route.
- `https://dynastydegens.com/*`: Bridges sanitized snapshots into the Dynasty Degens report tab.
- `https://www.dynastydegens.com/*`: Same as above for the `www` production host.

Store package note: the review zip excludes the development-only `http://localhost/*` host permission. That match exists only in the unpacked local manifest.

## Privacy disclosure answer

The extension handles fantasy football league transaction data visible inside the user's logged-in Sleeper web session. It collects only sanitized pending transaction data needed to import trade offers and waiver claims into Dynasty Degens: league ID, transaction IDs, transaction type/status, timestamps, roster IDs, player IDs, draft-pick fields, add/drop fields, and waiver bid fields.

Recommended Chrome data disclosure: `Website content`, because the extension observes Sleeper page responses that contain fantasy football transaction content. Do not declare authentication information, passwords, payment information, health information, personal communications, location, or browsing history, because those fields are not collected, displayed, stored, or transmitted.

Remote code answer: `No`. The extension package contains its runtime logic and does not load or execute remotely hosted code.

Limited use certification: certify that data is used only to provide the user-facing Sleeper pending-transaction import and is not sold, transferred for unrelated purposes, used for advertising, or used for credit/lending decisions.

Privacy policy URL:

`https://dynastydegens.com/sleeper-helper`

## Review notes

To test:

1. Install the submitted extension in Chrome.
2. Sign into Sleeper in the same Chrome profile.
3. Open a Dynasty Degens league report for a Sleeper league that has at least one pending trade offer or pending waiver claim.
4. Go to Trades.
5. Click `Import Pending Transactions`.
6. The helper opens Sleeper league pages, captures pending transaction responses, sanitizes them, and imports the snapshot into Dynasty Degens.

Expected result: pending trades and waiver claims appear in Pending Trade Offers and can be opened in Trade War Room.

If reviewers do not have a Sleeper league with pending activity, the extension should still show as installed and detected on the Dynasty Degens Trades tab, but no pending items will import because Sleeper did not expose any current pending activity.

## Current public listing QA notes

- Public listing name, short description, version, privacy disclosure, and support links are correct.
- Public listing currently has five screenshots.
- Chrome Web Store does not preserve Markdown bullets inside the detailed description reliably, so use the paragraph version above for future dashboard edits.

## Screenshot plan

- Dynasty Degens Trades tab before import with `Import Pending Transactions` visible.
- Importing state with the cyan/orange progress animation.
- Imported pending trade and waiver cards.
- Trade War Room opened from a pending trade.
- Extension popup showing the read-only privacy boundaries.

Screenshots should be 1280x800 where possible.

## Promotional image direction

Required small promo image: 440x280.

Direction: dark Dynasty Degens background, large DD logo, Transaction Sync naming, and a visual bridge from Sleeper pending activity into Trade War Room. Avoid heavy text so it remains readable when reduced.
