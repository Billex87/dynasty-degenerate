# DraftBuzz Asset Cache

The Prospect Score Archive renders player headshots, NFL team marks, and college marks from local files under:

```text
client/public/assets/draftbuzz-cache
```

Refresh the cache after updating any NFL Draft Buzz or ESPN prospect snapshots:

```bash
pnpm cache:draftbuzz-assets
```

The script reads every JSON file in `server/prospect-snapshots`, downloads stable image targets, writes `manifest.json`, and leaves true upstream misses marked as `failed`. Runtime image helpers intentionally avoid known failed player headshot paths so those rows fall back to initials instead of creating local 404s.

After refreshing the cache, resize the assets before committing:

```bash
find client/public/assets/draftbuzz-cache -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' \) -print0 | xargs -0 sips -Z 180
```

Then update manifest byte sizes by rerunning a small stat pass or rerunning the cache script if the upstream source should be checked again. Keep the cache around 20-30 MB unless the UI starts rendering larger thumbnails.
