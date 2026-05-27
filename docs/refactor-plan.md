# Refactor Plan

This roadmap sequences the refactor so behavior, visuals, SEO, auth, cron jobs, and production deployment assumptions stay stable.

## Refactor Principles

- Preserve behavior and copy unless a prompt explicitly asks for product changes.
- Keep Vite/React + Express/tRPC architecture.
- Do not introduce Next.js conventions.
- Keep each implementation stage small enough to review and commit independently.
- Do not mix CPU fixes, giant-file extraction, CSS refactors, feature-folder moves, dependency cleanup, and file deletion in one commit.
- Do not delete files until a dedicated unused-file stage proves they are safe.

## Target Structure

Preferred long-term shape:

```txt
client/src/
  pages/
  components/
    ui/
    layout/
    shared/
  features/
    report/
    rankings/
    draft-analysis/
    admin/
    player-detail/
    home/
  lib/
  hooks/
  styles/
  types/

server/
  _core/
  routers/
  features/
  services/
  jobs/
  data/
shared/
api/
```

Use this as a destination, not a single sweeping move.

## Current Architecture Summary

- `client/src/pages/Home.tsx` owns the homepage, report runtime, admin panels, report cache restore, and most top-level state.
- `client/src/components/ReportTables.tsx` and `client/src/components/reportTables/**` own much of the report UI.
- `server/routers.ts` owns most public/protected tRPC procedures and report/rankings orchestration.
- `server/reportGenerator.ts`, provider loaders, and `server/db.ts` are core backend risk surfaces.
- CSS is global-first through `client/src/index.css` imports.

## Top Risky Files

- `client/src/styles/report-responsive.css` - largest responsive/global CSS surface.
- `client/src/styles/report-foundation.css` - foundational report styling and animation surface.
- `client/src/pages/Home.tsx` - giant route/controller file.
- `client/src/styles/report-surfaces.css` - large report component style surface.
- `client/src/components/ReportTables.tsx` - mixed rendering logic and shared report UI.
- `server/routers.ts` - large tRPC API surface.
- `client/src/components/PlayerDetailModal.tsx` - modal UI plus multiple data fetch paths.
- `server/reportGenerator.ts` - core report generation logic.
- `client/src/components/CommandCenterExpansion.tsx`
- `client/src/components/reportTables/TradeWarRoom.tsx`
- `client/src/components/reportTables/WaiverIntelligencePanel.tsx`
- `client/src/lib/autopilot/buildAutopilotData.ts`
- `server/db.ts`

## Largest Files

- Over 10,000 lines: the three largest report CSS files, `Home.tsx`, and generated/data JSON snapshots.
- Over 5,000 lines: `ReportTables.tsx`, `server/routers.ts`, and the above.
- Over 1,000 lines: major report components, player modal, rankings/draft UI, provider loaders, report/ranking server modules, and several tests/data files.
- Over 500 lines: broad across report UI, provider integrations, tests, and server data modules.

## Repeated Page And Component Candidates

- Report section shells and collapsible section wrappers.
- Table/card hybrids across trade, waiver, draft, rankings, and manager-intel surfaces.
- Toolbar/search/filter/pagination controls in rankings, draft, trade, and admin sections.
- Empty/loading/error states repeated across report panels.
- Modal shells and player/manager identity rows.
- Admin diagnostic panel layout patterns.

Do not abstract until differences are mapped as either data/config differences or true custom behavior.

## CSS Cleanup Strategy

- Keep global CSS stable until component ownership is known.
- Start by mapping selectors to owning components and rendered routes.
- Split only one feature-owned CSS slice at a time.
- Avoid deleting selectors until dynamic class names, imported CSS, and rendered markup have been checked.
- Preserve class output during component extractions where possible.
- Verify visual output on desktop, tablet, and mobile after each CSS slice.

## Vercel CPU Risk Areas

- `league.analyze` and report generation.
- Rankings payload creation and cache reads.
- League report cache warmer cron.
- Dynamic data refresh cron.
- Provider loaders with live fetches or expensive fallback behavior.
- Player detail modal query fan-out.
- Admin diagnostics queries.

Stage 2 work should first produce evidence, then apply only safe CPU fixes.

## Deletion Candidate Policy

- Deletion requires import/search evidence, route/build/test evidence where relevant, and a clear rollback path.
- Do not delete SEO assets, metadata, public images, tests, mocks, fixtures, scripts, config files, or generated data casually.
- Treat design/reference folders and preview routes as review-only until the user confirms product intent.

## Dependency And Package Safety Notes

- Critical dependencies include React, Vite, Tailwind, Express, tRPC, React Query, Drizzle, MySQL client, Zod, Radix UI, `wouter`, Vercel telemetry, and provider/storage packages.
- Review-only dependencies include packages that may be unused or limited to specific visual effects, but removal needs import and runtime evidence.
- Do not remove dependencies in the same stage as file movement or CSS extraction.

## Testing And QA Gaps

- No eslint config was found during the audit.
- Visual safety depends heavily on Playwright and manual viewport review.
- CPU fixes need targeted server tests or route-level smoke evidence.
- File moves need `pnpm run check` at minimum.
- Broad report changes should use `pnpm run validate:report`.

## Staged Plan

### Stage 1B: Repo Guidance And Docs

- Add repo-local `AGENTS.md`.
- Add durable docs for baseline audit and staged cleanup roadmap.
- No application behavior changes.
- Verification: `git diff --check`.

### Stage 2A: Vercel CPU Audit

- Inspect heavy tRPC procedures, cron handlers, cache paths, and client query triggers.
- Identify CPU risks with evidence before changing code.
- Pay special attention to `league.analyze`, rankings, report cache warming, dynamic data refresh, player modal queries, and admin diagnostics.

### Stage 2B: Safe Vercel CPU Fixes

- Implement only low-risk CPU improvements.
- Favor cache-hit reuse, client query gating, payload slimming, and safer cron bounds.
- Do not cache private/authenticated/user-specific HTTP responses.
- Verify with targeted unit tests and focused route smoke checks.

### Stage 3A: Giant File Split Plan

- Plan extraction boundaries for `Home.tsx`, `ReportTables.tsx`, `server/routers.ts`, `PlayerDetailModal.tsx`, and the report CSS files.
- Choose one low-risk first extraction.
- Define exact import/export boundaries before implementation.

### Stage 3B: Giant File Extraction Slice

- Extract one coherent section with no behavior or copy change.
- Prefer pure components/helpers before stateful flow rewrites.
- Verify with typecheck and targeted tests.

### Stage 4A: Repeated Pages/Templates Audit

- Identify repeated report sections, table shells, cards, toolbar patterns, modal shells, and empty/loading states.
- Mark which differences are data/config and which are real custom behavior.

### Stage 4B: One Shared Template

- Extract one shared template used by a narrow set of repeated UI.
- Keep markup and CSS class output stable unless explicitly approved.

### Stage 5A: CSS Architecture Audit

- Map the largest global CSS areas to owning components/features.
- Identify duplicate selectors, overlapping media queries, duplicated keyframes, and risky global selectors.
- Decide one scoped CSS slice to move or simplify.

### Stage 5B: One CSS Refactor Slice

- Refactor one scoped CSS area.
- Preserve visual output across desktop/tablet/mobile.
- Use screenshots or Playwright visual checks when practical.

### Stage 6A: Feature-Folder Organization Plan

- Pick one feature folder with low import churn.
- Define exact source/destination paths and import rewrite strategy.

### Stage 6B: One Feature-Folder Move

- Move one small feature surface.
- Keep public imports stable where possible.
- Verify typecheck and affected tests.

### Stage 7A: Unused File Candidate Report

- Re-audit review-only candidates such as design kits, preview pages, `.DS_Store`, logs, temp env files, and copied loader kit assets.
- Require evidence for every deletion candidate.

### Stage 7B: Verified Safe Deletions

- Delete only files proven safe.
- Never delete SEO assets, tests, fixtures, mocks, generated data, or public assets casually.
- Verify with search, typecheck, build, and route smoke where relevant.

### Stage 8: Final Senior Review

- Review diff, architecture, security, performance, visual risk, and test coverage.
- Check for accidental copy, behavior, auth, env, cron, SEO, or metadata changes.

### Stage 8B: Small Final Fixes

- Apply only bounded cleanup discovered in Stage 8.
- Avoid opening new refactor fronts.

### Stage 9: Post-Refactor Safety Audit

- Run final verification.
- Confirm Vercel deployment assumptions and rollback path.
- Produce final changed-file and residual-risk summary.

## Verification Ladder

Use the smallest sufficient verification for each stage:

- Docs-only: `git diff --check`
- Type/import changes: `pnpm run check`
- Shared logic changes: targeted Vitest files, then `pnpm test` when risk warrants
- Report semantics: `pnpm run audit:report-semantics`
- Broad report changes: `pnpm run validate:report`
- Visual changes: local preview plus targeted Playwright viewport checks
- Deployment-sensitive changes: `pnpm build` and Vercel preview before production

## Verification Commands

- Build: `pnpm build`
- Typecheck: `pnpm run check`
- Unit tests: `pnpm test`
- E2E: `pnpm run test:e2e`
- Report safety gate: `pnpm run validate:report`

## Stage 1B Completion Criteria

- `AGENTS.md` exists at repo root.
- Baseline audit doc exists under `docs/`.
- Refactor roadmap doc exists under `docs/`.
- No application source files changed.
- `git diff --check` passes.
