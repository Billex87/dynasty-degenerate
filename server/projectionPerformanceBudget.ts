export type ProjectionPerformanceBudgetInput = {
  projectionRowCount: number;
  contextRowCount?: number | null;
  joinDurationMs?: number | null;
  surfaceCount?: number | null;
  cacheHit?: boolean;
  staticSectionPrecomputed?: boolean;
  maxRows?: number;
  maxJoinMs?: number;
  maxPerRowMs?: number;
  maxSurfaceFanout?: number;
};

export type ProjectionPerformanceBudgetResult = {
  status: 'pass' | 'warn' | 'fail';
  rowCount: number;
  joinDurationMs: number | null;
  perRowMs: number | null;
  maxRows: number;
  maxJoinMs: number;
  maxPerRowMs: number;
  maxSurfaceFanout: number;
  cachePolicy: 'cache-hit-ok' | 'precompute-static-section' | 'safe-live-join' | 'block-live-join';
  shouldPrecomputeStaticSection: boolean;
  warnings: string[];
  blockers: string[];
  note: string;
};

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number | null, digits = 3): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

export function evaluateProjectionPerformanceBudget(input: ProjectionPerformanceBudgetInput): ProjectionPerformanceBudgetResult {
  const rowCount = Math.max(0, Math.round(finiteNumber(input.contextRowCount) ?? finiteNumber(input.projectionRowCount) ?? 0));
  const joinDurationMs = finiteNumber(input.joinDurationMs);
  const maxRows = Math.max(1, Math.round(input.maxRows || 2500));
  const maxJoinMs = Math.max(1, Math.round(input.maxJoinMs || 750));
  const maxPerRowMs = input.maxPerRowMs || 0.6;
  const maxSurfaceFanout = Math.max(1, Math.round(input.maxSurfaceFanout || 8));
  const surfaceCount = Math.max(0, Math.round(finiteNumber(input.surfaceCount) ?? 0));
  const perRowMs = joinDurationMs !== null && rowCount > 0 ? round(joinDurationMs / rowCount) : null;
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (rowCount > maxRows) {
    blockers.push(`Projection context has ${rowCount} rows, above the ${maxRows} live-join budget.`);
  } else if (rowCount > maxRows * 0.8) {
    warnings.push(`Projection context has ${rowCount} rows, near the ${maxRows} live-join budget.`);
  }

  if (joinDurationMs !== null && joinDurationMs > maxJoinMs) {
    blockers.push(`Projection join took ${joinDurationMs}ms, above the ${maxJoinMs}ms live-join budget.`);
  } else if (joinDurationMs !== null && joinDurationMs > maxJoinMs * 0.75) {
    warnings.push(`Projection join took ${joinDurationMs}ms, near the ${maxJoinMs}ms live-join budget.`);
  }

  if (perRowMs !== null && perRowMs > maxPerRowMs) {
    blockers.push(`Projection join costs ${perRowMs}ms/row, above the ${maxPerRowMs}ms/row budget.`);
  } else if (perRowMs !== null && perRowMs > maxPerRowMs * 0.75) {
    warnings.push(`Projection join costs ${perRowMs}ms/row, near the ${maxPerRowMs}ms/row budget.`);
  }

  if (surfaceCount > maxSurfaceFanout) {
    warnings.push(`Projection context is planned for ${surfaceCount} surfaces; prefer one cached context over per-surface recomputation.`);
  }

  const shouldPrecomputeStaticSection = Boolean(
    blockers.length ||
    warnings.length ||
    rowCount > 500 ||
    surfaceCount > 2 ||
    !input.cacheHit
  );
  const cachePolicy: ProjectionPerformanceBudgetResult['cachePolicy'] = input.cacheHit
    ? 'cache-hit-ok'
    : blockers.length
      ? 'block-live-join'
      : shouldPrecomputeStaticSection || input.staticSectionPrecomputed
        ? 'precompute-static-section'
        : 'safe-live-join';
  const status: ProjectionPerformanceBudgetResult['status'] = blockers.length
    ? 'fail'
    : warnings.length
      ? 'warn'
      : 'pass';

  return {
    status,
    rowCount,
    joinDurationMs,
    perRowMs,
    maxRows,
    maxJoinMs,
    maxPerRowMs,
    maxSurfaceFanout,
    cachePolicy,
    shouldPrecomputeStaticSection,
    warnings,
    blockers,
    note: status === 'pass'
      ? 'Projection join is inside live-report performance budgets.'
      : status === 'warn'
        ? 'Projection join is close to budget; prefer cached/static projection context before expanding surfaces.'
        : 'Projection join is over budget; block live report recomputation and require cached/static projection context.',
  };
}
