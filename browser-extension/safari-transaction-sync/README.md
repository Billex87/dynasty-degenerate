# Dynasty Degens Transaction Sync for Safari

Safari support is generated from the Chrome extension source in
`browser-extension/sleeper-helper`. Do not hand-edit a second copy of the
extension logic unless Safari forces a platform-specific patch.

## Product boundary

- Read-only capture only.
- No Sleeper cookies or Authorization headers are read, displayed, stored, or sent.
- Only sanitized pending Sleeper trade and waiver transaction fields are sent to Dynasty Degens.
- No lineup, waiver, trade, accept, reject, or other Sleeper write actions.

## Prepare Safari web-extension source

Production/App Store source:

```bash
pnpm prepare:safari-transaction-sync
```

Local source with `http://localhost:3000/*` still enabled:

```bash
pnpm prepare:safari-transaction-sync -- --local
```

The generated source lands in:

- `dist/browser-extension/safari-transaction-sync/extension`
- `dist/browser-extension/safari-transaction-sync/local-extension`

`dist/` is generated output and should not be treated as the canonical source.

## Convert to an Xcode Safari Web Extension app

Full Xcode must be installed. Command Line Tools alone are not enough.

```bash
xcrun safari-web-extension-converter \
  dist/browser-extension/safari-transaction-sync/extension \
  --app-name "Dynasty Degens Transaction Sync" \
  --bundle-identifier "com.dynastydegens.transactionsync"
```

For local QA against `localhost:3000`, convert `local-extension` instead.

## Local QA order

1. Run `pnpm prepare:safari-transaction-sync -- --local`.
2. Convert the generated `local-extension` source with Xcode's Safari converter.
3. Open the generated Xcode project.
4. Run the macOS app target once.
5. Enable the extension in Safari Settings > Extensions.
6. Sign into Sleeper in Safari.
7. Open Dynasty Degens in Safari and use Trades > Import Pending Transactions.
8. Confirm Sleeper tabs open/refresh, the sanitized snapshot imports, and no manual token flow is needed.

## iPhone/iPad follow-up

After Mac Safari works, add the iOS target in Xcode and test on iPhone Safari.
Users must run the Safari extension in Safari; Chrome on iOS cannot run Chrome
extensions, and standalone home-screen PWAs should not be treated as extension
hosts.

## Known risks

- Safari Web Extension API compatibility can differ from Chrome, especially around
  background lifetime and promise/callback behavior.
- If Safari does not support `chrome.storage.session` in the same way, the helper
  should fall back to in-memory capture only rather than persistent storage.
- App Store review will require Safari-specific screenshots, privacy answers, and
  a clear explanation that the extension is read-only and user-triggered.
