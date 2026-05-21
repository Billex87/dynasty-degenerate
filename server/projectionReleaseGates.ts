export type ProjectionRolloutPhase = 'blocked' | 'admin-only' | 'internal-leagues' | 'limited-production' | 'general-availability';

export type ProjectionReleaseGateFeature =
  | 'lineup-strength'
  | 'trade-dynasty'
  | 'alerts'
  | 'provider-claim'
  | 'general-readout';

export type ProjectionReleaseGateInput = {
  feature: ProjectionReleaseGateFeature;
  requestedPhase?: ProjectionRolloutPhase;
  scheduleSnapshotStatus?: 'ready' | 'warning' | 'blocked' | 'missing';
  projectionSnapshotStatus?: 'ready' | 'warning' | 'blocked' | 'missing';
  sourceFreshnessReady?: boolean;
  identityMatchingReady?: boolean;
  fallbackCopyReady?: boolean;
  readoutSeparatesShortAndLongTerm?: boolean;
  draftCapitalRunwayReady?: boolean;
  staleSourceHandlingReady?: boolean;
  optOutControlsReady?: boolean;
  alertRateLimitsReady?: boolean;
  providerAttributionAllowed?: boolean;
  cleanWeeklyRefreshCycles?: number;
  performanceBudgetStatus?: 'pass' | 'warn' | 'fail';
};

export type ProjectionReleaseGateResult = {
  allowed: boolean;
  maxAllowedPhase: ProjectionRolloutPhase;
  requestedPhase: ProjectionRolloutPhase;
  blockers: string[];
  warnings: string[];
  note: string;
};

const PHASE_ORDER: ProjectionRolloutPhase[] = [
  'blocked',
  'admin-only',
  'internal-leagues',
  'limited-production',
  'general-availability',
];

function phaseAtMost(a: ProjectionRolloutPhase, b: ProjectionRolloutPhase): ProjectionRolloutPhase {
  return PHASE_ORDER[Math.min(PHASE_ORDER.indexOf(a), PHASE_ORDER.indexOf(b))] || 'blocked';
}

function isPhaseAllowed(requested: ProjectionRolloutPhase, maxAllowed: ProjectionRolloutPhase): boolean {
  return PHASE_ORDER.indexOf(requested) <= PHASE_ORDER.indexOf(maxAllowed);
}

export function evaluateProjectionReleaseGate(input: ProjectionReleaseGateInput): ProjectionReleaseGateResult {
  const requestedPhase = input.requestedPhase || 'admin-only';
  const blockers: string[] = [];
  const warnings: string[] = [];
  let maxAllowedPhase: ProjectionRolloutPhase = 'general-availability';

  if (input.scheduleSnapshotStatus !== 'ready') {
    blockers.push('Schedule snapshot is not ready.');
  }
  if (input.projectionSnapshotStatus !== 'ready') {
    blockers.push('Projection snapshot is not ready.');
  }
  if (!input.sourceFreshnessReady) {
    blockers.push('Source freshness metadata is not ready.');
  }
  if (!input.identityMatchingReady) {
    blockers.push('Projection identity matching is not ready.');
  }
  if (!input.fallbackCopyReady) {
    blockers.push('Projection fallback copy is not ready.');
  }
  if (input.performanceBudgetStatus === 'fail') {
    blockers.push('Projection context is over the live-report performance budget.');
  } else if (input.performanceBudgetStatus === 'warn') {
    warnings.push('Projection context is near the performance budget; prefer cached/static context.');
    maxAllowedPhase = phaseAtMost(maxAllowedPhase, 'limited-production');
  }

  if (input.feature === 'trade-dynasty') {
    if (!input.readoutSeparatesShortAndLongTerm) {
      blockers.push('Trade/dynasty reads cannot separate short-term projections from dynasty value.');
    }
    if (!input.draftCapitalRunwayReady) {
      blockers.push('Draft-capital runway guardrails are not ready.');
    }
  }

  if (input.feature === 'alerts') {
    if (!input.staleSourceHandlingReady) {
      blockers.push('Alert stale-source handling is not ready.');
    }
    if (!input.optOutControlsReady) {
      blockers.push('Alert opt-out controls are not ready.');
    }
    if (!input.alertRateLimitsReady) {
      blockers.push('Alert rate limits are not ready.');
    }
  }

  if (input.feature === 'provider-claim' && !input.providerAttributionAllowed) {
    blockers.push('Provider attribution is not approved for public projection claims.');
  }

  const cleanWeeklyRefreshCycles = input.cleanWeeklyRefreshCycles || 0;
  if (cleanWeeklyRefreshCycles < 1) {
    maxAllowedPhase = phaseAtMost(maxAllowedPhase, 'admin-only');
    warnings.push('No clean weekly refresh cycle has completed; keep projection reads admin-only.');
  } else if (cleanWeeklyRefreshCycles < 2) {
    maxAllowedPhase = phaseAtMost(maxAllowedPhase, 'limited-production');
    warnings.push('Fewer than two clean weekly refresh cycles have completed; do not ship general availability.');
  }

  if (blockers.length) {
    maxAllowedPhase = 'blocked';
  }

  const allowed = isPhaseAllowed(requestedPhase, maxAllowedPhase) && maxAllowedPhase !== 'blocked';

  return {
    allowed,
    maxAllowedPhase,
    requestedPhase,
    blockers,
    warnings,
    note: allowed
      ? `Projection feature can run at ${requestedPhase}.`
      : maxAllowedPhase === 'blocked'
        ? 'Projection feature is blocked until release gate blockers are cleared.'
        : `Projection feature can run only up to ${maxAllowedPhase}.`,
  };
}
