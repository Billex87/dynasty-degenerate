# Phase 10 — Ungate AI readout content (decouple from admin tools)

Status: ready
Designer/reviewer: Claude · Implementer: Codex
Type: product/access change (NOT visual). Approved by Billy 2026-06-13.

## Goal

Make the AI readout content visible to ALL report viewers (no admin passphrase), scoped to the viewer's own team. KEEP the genuine admin powers behind the existing passphrase gate. This is an access-control change — be precise; do not over- or under-expose.

## Current state

`canViewAdminFeatureExpansion` (derived in `client/src/features/home/hooks/useHomeAdminAccess.ts` from `isAdminPassphraseVerifiedForSession && admin perms && adminViewMode==="admin"`) currently gates BOTH:
- **AI readout CONTENT** (the panels Billy wants public): `showAIReads` on DraftAnalysis (ReportDashboardContent ~line 677), the AI reads in `ReportOverviewTab` (~line 486), the next-move/owner-intel reads (~line 450), and the CommandCenterExpansion / ReportTables AI read panels they feed.
- **ADMIN POWERS (must stay gated):** "view as any manager" (`selectedViewerManager` admin branch + `adminViewerManager` + `AdminManagerSwitcher` in HomeReportExperience.tsx ~line 180), the Hacks/diagnostics tab (`canViewAdminDiagnostics`), the Autopilot tab (`canViewAutopilotTab`), and the admin-tools entry.

## Required change

1. **Introduce a dedicated flag** for AI-read content visibility, e.g. `showReportAIReads` (or `aiReadsVisibleToAllViewers`). It is always `true` for any report viewer (admin or not). Thread it from the same place the admin flags originate so it's a single source of truth.

2. **Replace the content gates only.** Every `canViewAdminFeatureExpansion` usage whose purpose is to GATE AI-READ CONTENT must switch to the new always-on flag:
   - `showAIReads={canViewAdminFeatureExpansion}` → `showAIReads={showReportAIReads}` (DraftAnalysis).
   - The `canViewAdminFeatureExpansion` prop passed into `ReportOverviewTab`, the next-move/owner-intel read component, and any CommandCenterExpansion/ReportTables AI-read render gate → use the content flag.
   - Trace each usage and classify it as content vs power; only flip the content ones.

3. **KEEP on `canViewAdminFeatureExpansion` (passphrase):**
   - `selectedViewerManager` admin branch (the `canViewAdminFeatureExpansion ? (adminViewerManager ?? ...) : (reportDataBase.viewerManager ?? null)` logic) — non-admins keep being scoped to their OWN `reportDataBase.viewerManager`. Do not let non-admins pick another manager.
   - `AdminManagerSwitcher` and the admin-tools entry button.
   - `canViewAdminDiagnostics` (Hacks tab) and `canViewAutopilotTab` (Autopilot tab) — unchanged.

4. **Scoping guarantee:** a non-admin viewer's AI reads render for `reportDataBase.viewerManager` (their own team) only. No path lets a non-admin view another manager's deep reads or the admin tabs.

## Acceptance criteria

1. `fnm exec --using 24.12.0 pnpm check` + `pnpm test` green (update `useHomeAdminAccess`/route-state tests as needed; keep their intent).
2. With NO admin passphrase (default viewer): the AI readout panels render in the report (Overview owner-intel reads, draft reads, next-move read), scoped to the viewer's own team.
3. Still hidden without passphrase: Hacks tab, Autopilot tab, AdminManagerSwitcher / "view as any manager", admin-tools-only surfaces.
4. With passphrase (admin): behavior unchanged from today (incl. view-as-any-manager).
5. Report exactly which `canViewAdminFeatureExpansion` usages were flipped vs kept, so the reviewer can confirm no admin power leaked.
6. No visual regression to the phase-9 AI panels; no server/data changes.
