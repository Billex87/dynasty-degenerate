# NFL Modal Backgrounds

`meta.json` is the canonical source for NFL team gradient colors used by player detail modal headers and shared team color styling.

Do not add separate hardcoded NFL color maps in components. If a team gradient changes, update `meta.json` and let `client/src/lib/teamTileStyle.ts` derive the runtime color helpers from it.
