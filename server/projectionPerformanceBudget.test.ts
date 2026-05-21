import { describe, expect, it } from 'vitest';
import { evaluateProjectionPerformanceBudget } from './projectionPerformanceBudget';

describe('projection performance budget', () => {
  it('passes small cached joins that are inside row and duration budgets', () => {
    const budget = evaluateProjectionPerformanceBudget({
      projectionRowCount: 120,
      contextRowCount: 120,
      joinDurationMs: 36,
      surfaceCount: 1,
      cacheHit: true,
    });

    expect(budget).toMatchObject({
      status: 'pass',
      cachePolicy: 'cache-hit-ok',
      shouldPrecomputeStaticSection: false,
      perRowMs: 0.3,
      warnings: [],
      blockers: [],
    });
  });

  it('warns near budget and recommends one precomputed context for multi-surface use', () => {
    const budget = evaluateProjectionPerformanceBudget({
      projectionRowCount: 2200,
      contextRowCount: 2200,
      joinDurationMs: 620,
      surfaceCount: 9,
      cacheHit: false,
    });

    expect(budget.status).toBe('warn');
    expect(budget.cachePolicy).toBe('precompute-static-section');
    expect(budget.shouldPrecomputeStaticSection).toBe(true);
    expect(budget.warnings.join(' ')).toContain('near the 2500 live-join budget');
    expect(budget.warnings.join(' ')).toContain('one cached context');
  });

  it('fails joins that are too large or too slow for user-triggered report loads', () => {
    const budget = evaluateProjectionPerformanceBudget({
      projectionRowCount: 3000,
      contextRowCount: 3000,
      joinDurationMs: 2200,
      surfaceCount: 10,
      cacheHit: false,
    });

    expect(budget.status).toBe('fail');
    expect(budget.cachePolicy).toBe('block-live-join');
    expect(budget.blockers.join(' ')).toContain('above the 2500 live-join budget');
    expect(budget.blockers.join(' ')).toContain('above the 750ms live-join budget');
  });
});
