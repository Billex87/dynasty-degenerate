import { describe, expect, it } from 'vitest';
import { evaluateProjectionReleaseGate } from './projectionReleaseGates';

const READY_BASE = {
  scheduleSnapshotStatus: 'ready' as const,
  projectionSnapshotStatus: 'ready' as const,
  sourceFreshnessReady: true,
  identityMatchingReady: true,
  fallbackCopyReady: true,
  performanceBudgetStatus: 'pass' as const,
};

describe('projection release gates', () => {
  it('keeps projection-driven lineup strength blocked until core diagnostics are ready', () => {
    const gate = evaluateProjectionReleaseGate({
      feature: 'lineup-strength',
      requestedPhase: 'admin-only',
      scheduleSnapshotStatus: 'missing',
      projectionSnapshotStatus: 'ready',
      sourceFreshnessReady: false,
      identityMatchingReady: true,
      fallbackCopyReady: true,
      performanceBudgetStatus: 'pass',
    });

    expect(gate.allowed).toBe(false);
    expect(gate.maxAllowedPhase).toBe('blocked');
    expect(gate.blockers.join(' ')).toContain('Schedule snapshot is not ready');
    expect(gate.blockers.join(' ')).toContain('Source freshness metadata is not ready');
  });

  it('allows admin-only first and blocks general availability until two clean cycles finish', () => {
    const adminGate = evaluateProjectionReleaseGate({
      ...READY_BASE,
      feature: 'general-readout',
      requestedPhase: 'admin-only',
      cleanWeeklyRefreshCycles: 0,
    });
    const gaGate = evaluateProjectionReleaseGate({
      ...READY_BASE,
      feature: 'general-readout',
      requestedPhase: 'general-availability',
      cleanWeeklyRefreshCycles: 1,
    });

    expect(adminGate.allowed).toBe(true);
    expect(adminGate.maxAllowedPhase).toBe('admin-only');
    expect(gaGate.allowed).toBe(false);
    expect(gaGate.maxAllowedPhase).toBe('limited-production');
  });

  it('requires trade and dynasty reads to separate projection movement from long-term value', () => {
    const gate = evaluateProjectionReleaseGate({
      ...READY_BASE,
      feature: 'trade-dynasty',
      requestedPhase: 'internal-leagues',
      cleanWeeklyRefreshCycles: 2,
      readoutSeparatesShortAndLongTerm: false,
      draftCapitalRunwayReady: true,
    });

    expect(gate.allowed).toBe(false);
    expect(gate.blockers.join(' ')).toContain('short-term projections from dynasty value');
  });

  it('requires stale-source handling, opt-out controls, and rate limits for alerts', () => {
    const gate = evaluateProjectionReleaseGate({
      ...READY_BASE,
      feature: 'alerts',
      requestedPhase: 'limited-production',
      cleanWeeklyRefreshCycles: 2,
      staleSourceHandlingReady: true,
      optOutControlsReady: false,
      alertRateLimitsReady: true,
    });

    expect(gate.allowed).toBe(false);
    expect(gate.blockers.join(' ')).toContain('Alert opt-out controls are not ready');
  });

  it('does not allow provider names in public claims without attribution approval', () => {
    const gate = evaluateProjectionReleaseGate({
      ...READY_BASE,
      feature: 'provider-claim',
      requestedPhase: 'limited-production',
      cleanWeeklyRefreshCycles: 2,
      providerAttributionAllowed: false,
    });

    expect(gate.allowed).toBe(false);
    expect(gate.blockers.join(' ')).toContain('Provider attribution is not approved');
  });
});
