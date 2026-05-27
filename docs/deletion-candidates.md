# Deletion Candidates

## Safe To Delete

- `client/src/components/LeagueGlobe3D.tsx`
  - Evidence: no static imports, dynamic imports, route references, docs references, or non-self string references were found for `LeagueGlobe3D`, `LeagueGlobeNode`, `LeagueGlobeConnection`, `league-globe`, or `overview-league-globe` outside the component file and existing global CSS.
  - Action taken: deleted in Stage 7B.
  - Notes: related `league-globe` CSS selectors were left in place for now because CSS selector deletion is higher-risk and should be handled in a dedicated CSS cleanup pass.

## Probably Unused, Needs Human Review

- `client/src/components/SuccessTakeover.tsx`
  - Evidence: no live component imports were found. It imports `client/src/styles/dd-success-takeover.css`, and docs/todo notes explicitly mention a future `SuccessTakeover` revisit after prior mobile/WebGL issues.
  - Risk: deleting it could discard planned fallback/rebuild work. Keep until the success/loading experience is intentionally consolidated.

## Keep

- API, cron, server scripts, public assets, config files, tests, generated-like cached assets, and route files were kept by default unless there was strong evidence they were unused.
- Showcase and preview routes such as `ComponentShowcase`, `ReportComponentShowcase`, and `LoaderKitPreview` are still route-referenced from `client/src/App.tsx`.
- `DashboardLayout.tsx` and `DashboardLayoutSkeleton.tsx` look isolated but are paired components and should not be deleted without a product decision.
