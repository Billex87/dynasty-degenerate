# AGENTS.md

This repo is a Vite/React single-page app with an Express/tRPC server deployed to Vercel. Do not introduce Next.js app-router, pages-router, or server-component conventions.

## Project goals

This repository should be maintained like a senior-level production codebase:
- small focused files
- clear feature boundaries
- predictable folder structure
- minimal global CSS
- no dead code
- no unnecessary dependencies
- no large route/page files
- safe incremental refactors

## Current project shape

- Client app: `client/src`
- Client routes: `client/src/App.tsx` using `wouter`
- Server app: `server`, with Express/tRPC entrypoints in `server/_core`
- Vercel API shims: `api/**`, re-exporting the bundled server app
- Shared types/constants: `shared`
- Database access: existing Drizzle/MySQL helpers in `server/db.ts`
- Styling: Tailwind v4 plus global CSS imported by `client/src/index.css`
- Tests: Vitest unit tests and Playwright e2e tests

## Default skill routing

- Use `graphify` first for architecture, dependency, file-relationship, report-generation, data-flow, and impact-analysis questions when `graphify-out/graph.json` exists. Run `graphify update` before architecture or dependency-impact answers when the graph may be stale or the user asks for an update.
- Use `dynasty-report-qa` for report-generation, report-tab, AI-readout, ranking, trade, draft, waiver, provider/source evidence, final readiness, or visual QA work. It should combine Graphify context, focused report commands, rendered UI checks, provider-copy policy, and mobile smoke coverage.
- Use `dynasty-motion-polish` for loading animation, generated-report animation, success/reveal transitions, football-themed motion, manager orbit, `LoaderKitBackdrop`, `LoadingAnimation`, `SuccessCard3D`, `ThreeRaceScene`, and similar motion polish. For open-ended prompts like "make the loading animation better" or "make it more football themed", use `prototype` first and show 2-3 distinct directions before changing production code unless the user explicitly asks for direct implementation.
- Use `build-web-apps:frontend-testing-debugging` for visible frontend changes, UI regressions, route validation, responsive checks, and visual QA. Verify the rendered route with Browser first when available, otherwise Playwright, and check desktop plus one mobile viewport when practical.
- Use `build-web-apps:frontend-app-builder` for new visual surfaces, dashboards, hero sections, redesigns, modernization, or fidelity-to-concept work. Do not invoke the heavier concept/Image Gen workflow for small fixes inside the existing report design system unless a redesign is requested.
- Use `imagegen` for new visual assets needed by motion work, such as stadium scenes, football-field texture, trophies, cards, helmets, manager/player art, or success imagery.
- Use `hyperframes:gsap` only when a chosen motion direction needs timeline choreography beyond existing CSS/framer-motion. Do not add GSAP as a dependency without explicit justification. Use `remotion-best-practices` only for exportable video/social/promo animations, not normal app UI.
- Use `review` as a final gate before shipping meaningful branches or when asked for review/final readiness. Compare the diff against this repo's standards and the requested scope/spec, then report findings before summaries. Do not run the heavier branch/spec review for every tiny edit unless the user asks.
- Use `diagnose` for bugs, flaky behavior, local/preview mismatches, data import failures, and report-generation surprises. Establish a feedback loop and identify the root cause before patching.
- Use `tdd` for risky business logic, server/report calculations, ranking/value transforms, cache behavior, and provider policy changes. Prefer focused Vitest coverage near `server/**` or `client/src/**` before broad implementation.
- Use `improve-codebase-architecture` for giant-file splits, feature-boundary cleanup, CSS consolidation, and route thinning. Start with audit and plan, then extract one low-risk slice at a time.
- Use `prototype` only for uncertain product interactions, complex UI states, or data/state models where a throwaway implementation can answer the question faster than debating it.
- Use Browser/Playwright for any meaningful frontend completion claim. Screenshots and rendered evidence matter more than code inspection for typography, spacing, wrapping, clipping, overlap, loading states, error states, and mobile polish.
- Use Vercel/GitHub capabilities when the task is deployment, preview QA, CI, production env inspection, or live-route validation. Keep preview/live/manual verification separate from code completion.

## Agent reference docs

- Issue/spec lookup and review context: `docs/agents/issue-tracker.md`
- UI smoke matrix and visual evidence standard: `docs/agents/ui-smoke-matrix.md`

## Refactor rules

- Preserve existing behavior unless the task explicitly says otherwise.
- Preserve current visual behavior unless explicitly asked to redesign.
- Prefer small mechanical changes over large rewrites.
- Do not refactor unrelated areas.
- Do not add dependencies unless necessary and justified.
- Do not delete files without proving they are unused.
- Use `git mv` or equivalent when moving files where possible.
- Keep route entry files thin.
- Move feature logic into `client/src/features/<feature-name>/` where appropriate.
- Keep reusable UI in `client/src/components/ui/`.
- Keep layout components in `client/src/components/layout/`.
- Keep shared app components in `client/src/components/shared/`.
- Keep utilities in `client/src/lib/` or `client/src/utils/`.
- Keep custom hooks in `client/src/hooks/` or feature-local `hooks/`.
- Keep types in `client/src/types/` or feature-local `types.ts`.
- Start with audits and plans before moving files or splitting giant modules.
- Extract one low-risk slice at a time.
- Keep import rewrites mechanical and verify immediately.

## File size guidelines

- Route/page files should ideally stay under 250 lines.
- Components should usually stay under 300 lines.
- Files over 500 lines need justification.
- Files over 1,000 lines should be split unless there is a strong reason not to.
- Extremely large files must be split in staged passes.

## Styling rules

- Avoid scattered CSS.
- Keep global CSS limited to resets, variables, typography, and true app-wide rules.
- Prefer scoped styles for feature-specific UI.
- Move repeated UI into shared components/templates instead of globalizing all styles.
- Do not introduce broad global selectors casually.
- Do not delete CSS without checking references, imports, dynamic classes, and rendered markup.
- Preserve current visual behavior during refactors.
- Treat `client/src/styles/report-responsive.css`, `report-foundation.css`, and `report-surfaces.css` as high-risk global surfaces.

## Vercel CPU rules

- Treat Vercel Fluid Active CPU usage as a first-class risk.
- Avoid unnecessary dynamic rendering or request-time recomputation.
- Do not use `no-store`, `force-dynamic`, or `revalidate = 0` patterns unless needed. This is not a Next.js app, so apply the equivalent cache caution to Express/tRPC routes and fetch behavior.
- Use safe CDN/server caching only for public, non-user-specific data.
- Never cache private, authenticated, session-based, or user-specific responses.
- Avoid expensive computation inside hot request paths.
- Keep middleware/security handlers lightweight.
- Avoid repeated server fetches and accidental polling.
- Prefer existing server-side cache paths, payload slimming, cron boundaries, and client query gating before adding new infrastructure.
- Keep `/api/:path*` responses private/no-store unless a route is proven public and non-sensitive.
- Cron handlers require `CRON_SECRET` in production and live in `server/_core/vercelApp.ts`.

## Safety rules

- Be careful with auth, payments, webhooks, API routes, cron jobs, middleware, and dynamic routes.
- Do not cache private or user-specific data.
- Do not remove environment variable usage without checking deployment config.
- Do not remove public assets without checking references.
- Do not change behavior while reorganizing files.
- Do not delete files without evidence.
- Do not print secret values.
- Do not remove SEO, metadata, sitemap, robots, Open Graph, icons, favicons, analytics, or error tracking casually.
- Do not remove tests, mocks, fixtures, scripts, or config files just because production code does not import them.
- Do not expose server-only code to client bundles.
- Preserve webhook signature verification if any webhook routes are added.
- Preserve auth redirects, admin passphrase behavior, session cookie behavior, and protected procedure behavior.
- Do not edit generated files or large data snapshots unless the task is specifically about those artifacts.
- Do not combine CPU fixes, CSS moves, component extraction, dependency cleanup, and file deletion in the same commit.

## Backend rules

- Validate tRPC inputs with the existing Zod patterns.
- Use existing database helpers and query conventions.
- Keep provider integrations behind current feature flags and source-policy boundaries.
- Explain performance or query changes when they affect report generation, rankings, provider loads, or cron work.

## Verification

Before finalizing a change, run the lightest relevant checks available, such as:
- docs-only: `git diff --check`
- type/import changes: `pnpm run check`
- unit tests: `pnpm test` or targeted Vitest files
- report safety: `pnpm run validate:report`
- build: `pnpm build`
- e2e: `pnpm run test:e2e`

Avoid repeatedly running expensive full builds.

## Finished-work protocol

When asked "is this finished?", "is it done?", "are we good?", "ready to ship?", "final check", or similar, perform a finished-work review before answering.

Check:
- requested scope completion
- `git status` and changed files
- build, typecheck, lint/test results when available
- security-sensitive issues such as secrets, unsafe auth, missing validation, SQL injection, unsafe redirects, or exposed credentials
- frontend responsiveness, accessibility, loading states, error states, and visual polish when relevant
- performance and Vercel CPU risks when relevant

Start the answer with one of:
- `Finished`
- `Not finished`
- `Functionally finished, but needs verification`

Then include what passed, what failed or was not checked, risks/regressions, and the recommended next action.
