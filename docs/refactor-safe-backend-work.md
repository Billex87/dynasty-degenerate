# Refactor-Safe Backend Work

Last updated: 2026-05-27

Use this list when `Home.tsx`, global CSS, or report-table frontend refactors
are active in another thread.

## Do Not Touch During Frontend Refactors

- `client/src/pages/Home.tsx`
- `client/src/styles/*`
- `client/src/components/ReportTables.tsx`
- `client/src/components/reportTables/*`
- shared UI primitives used by the active report-table refactor

## Safe Work Completed

- CPU cache behavior tests:
  - `server/leagueReportCacheDecision.test.ts`
  - `server/pacificCronWindows.test.ts`
- Player news refresh snapshot-path test:
  - `server/dynamicDataJobs.test.ts`
- Cache audit command:
  - `pnpm audit:league-report-cache`
- Player news matching and SportsDataIO normalization tests:
  - `server/playerNews.test.ts`
  - `server/sportsDataNews.test.ts`
- Player trajectory backend tests:
  - `server/playerTrajectory.test.ts`
- Source freshness audit command:
  - `pnpm audit:source-freshness`
- Source freshness summary tests:
  - `server/sourceFreshnessSummary.test.ts`
- Source coverage matrix output-shape tests:
  - `server/sourceCoverageMatrix.test.ts`
- User-load provider boundary tests:
  - `server/loadTimeProviderPolicy.test.ts`
  - `server/userLoadProviderBoundary.test.ts`

## Safe Work Still Available

- Add more provider-specific source freshness fixtures as new sources are added.

## Validation Commands

```bash
pnpm test server/playerNews.test.ts server/sportsDataNews.test.ts
pnpm test server/playerTrajectory.test.ts
pnpm test server/sourceFreshnessSummary.test.ts server/sourceSnapshotFreshness.test.ts
pnpm test server/sourceCoverageMatrix.test.ts
pnpm test server/loadTimeProviderPolicy.test.ts server/userLoadProviderBoundary.test.ts
pnpm run check
pnpm audit:league-report-cache
pnpm audit:source-freshness
```

Keep commits path-limited while unrelated frontend files are dirty.
