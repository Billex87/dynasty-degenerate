#!/usr/bin/env tsx

import '../server/_core/env';
import {
  probeProjectionSosReadiness,
  type ProjectionSosReadinessProbeResult,
} from './probe-projection-sos-readiness';
import type { SleeperProjectionScoringProfile } from '../server/sleeperProjectionSnapshots';

type Mode = 'projection-off' | 'projection-on';

const PROFILES = new Set<SleeperProjectionScoringProfile>(['PPR', 'HALF_PPR', 'STD', 'CUSTOM']);
const PLAYOFF_WEEKS = [15, 16, 17];

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function parseWeek(): number {
  const parsed = Number(getFlag('week') || process.env.PROJECTION_READINESS_WEEK || 1);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 18 ? parsed : 1;
}

function parseLeagueId(): string | null {
  const leagueId = String(getFlag('league-id') || process.env.PROJECTION_READINESS_LEAGUE_ID || '').trim();
  return leagueId || null;
}

function parseReportForceRefresh(): boolean {
  const raw = String(getFlag('report-force-refresh') || process.env.PROJECTION_READINESS_REPORT_FORCE_REFRESH || 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'no';
}

function parseProfiles(): SleeperProjectionScoringProfile[] {
  const raw = getFlag('profiles') || process.env.PROJECTION_READINESS_PROFILES || 'PPR,HALF_PPR,STD';
  const profiles = raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .map((value) => value === 'HALF' ? 'HALF_PPR' : value)
    .filter((value): value is SleeperProjectionScoringProfile => PROFILES.has(value as SleeperProjectionScoringProfile));
  return profiles.length ? Array.from(new Set(profiles)) : ['PPR', 'HALF_PPR', 'STD'];
}

async function withEnv<T>(overrides: Record<string, string>, callback: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(overrides)) {
    previous.set(key, process.env[key]);
    process.env[key] = overrides[key];
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function envForMode(mode: Mode): Record<string, string> {
  const enabled = mode === 'projection-on';
  return {
    ENABLE_DRAFTSHARKS_SOS: 'true',
    ENABLE_PROJECTION_FEATURES: enabled ? 'true' : 'false',
    ENABLE_SLEEPER_PROJECTIONS: enabled ? 'true' : 'false',
    ENABLE_WEEKLY_PROJECTIONS: enabled ? 'true' : 'false',
    DISABLE_PROJECTION_FEATURES: 'false',
    DISABLE_PROJECTION_SNAPSHOTS: 'false',
    DISABLE_PROJECTION_READOUTS: 'false',
    DISABLE_PROJECTION_JOINS: 'false',
  };
}

function summarize(mode: Mode, result: ProjectionSosReadinessProbeResult) {
  return {
    mode,
    ok: result.ok,
    expectation: result.expectation,
    dataReady: result.dataReady,
    scoringProfile: result.scoringProfile,
    draftSharksStatus: result.draftSharks.status,
    draftSharksProfileCount: result.draftSharks.profileCount,
    scheduleStatus: result.schedule.status,
    weeklyProjectionStatus: result.weeklyProjection.status,
    weeklyProjectionRows: 'rowCount' in result.weeklyProjection ? result.weeklyProjection.rowCount : 0,
    readinessEnabled: result.readiness.enabled,
    blockingFlags: result.readiness.blockingFlags,
    reason: result.readiness.reason,
  };
}

function hasProjectionBackedPlayoffWeek(reportData: any): boolean {
  return (reportData?.playoffSchedulePlanning?.managerPlans || []).some((plan: any) =>
    (plan?.weeks || []).some((week: any) =>
      typeof week?.projectedStarterPoints === 'number' ||
      /projection/i.test(String(week?.projectionCoverage?.mode || ''))
    )
  );
}

function hasOnlyScheduleValuePlayoffWeeks(reportData: any): boolean {
  const managerPlans = reportData?.playoffSchedulePlanning?.managerPlans || [];
  const weeks = managerPlans.flatMap((plan: any) => plan?.weeks || []);
  return weeks.length > 0 && weeks.every((week: any) =>
    week?.projectedStarterPoints === null &&
    Number(week?.projectionCoverage?.coveredPlayerCount || 0) === 0 &&
    String(week?.projectionCoverage?.mode || '') === 'schedule-value'
  );
}

function containsStoredWeeklyProjectionClaim(value: unknown): boolean {
  return /stored-weekly-projection|stored weekly projection|stored projection/i.test(JSON.stringify(value || null));
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getPlayoffPlanWeeks(playoffSchedulePlanning: any): any[] {
  return asArray(playoffSchedulePlanning?.managerPlans)
    .flatMap((plan: any) => asArray(plan?.weeks));
}

function summarizePlayoffConfidence(playoffSchedulePlanning: any) {
  const managerPlans = asArray(playoffSchedulePlanning?.managerPlans);
  const planWeeks = getPlayoffPlanWeeks(playoffSchedulePlanning);
  const confidence = finiteNumber(playoffSchedulePlanning?.confidence);
  const confidenceReasons = asArray(playoffSchedulePlanning?.confidenceReasons)
    .filter((reason: unknown): reason is string => typeof reason === 'string' && reason.trim().length > 0);
  const managerConfidences = managerPlans
    .map((plan: any) => finiteNumber(plan?.confidence))
    .filter((value: number | null): value is number => value !== null);
  const weekConfidences = planWeeks
    .map((week: any) => finiteNumber(week?.confidence))
    .filter((value: number | null): value is number => value !== null);
  const weekCapReasons = planWeeks
    .map((week: any) => typeof week?.confidenceCapReason === 'string' ? week.confidenceCapReason.trim() : '')
    .filter(Boolean);
  const weekConfidenceReasons = planWeeks
    .flatMap((week: any) => asArray(week?.confidenceReasons))
    .filter((reason: unknown): reason is string => typeof reason === 'string' && reason.trim().length > 0);

  return {
    confidence,
    confidenceReasonCount: confidenceReasons.length,
    managerConfidenceCount: managerConfidences.length,
    weekConfidenceCount: weekConfidences.length,
    weekConfidenceCapReasonCount: weekCapReasons.length,
    weekConfidenceReasonCount: weekConfidenceReasons.length,
    planCount: managerPlans.length,
    planWeekCount: planWeeks.length,
    minPlanConfidence: managerConfidences.length ? Math.min(...managerConfidences) : null,
    maxPlanConfidence: managerConfidences.length ? Math.max(...managerConfidences) : null,
    minWeekConfidence: weekConfidences.length ? Math.min(...weekConfidences) : null,
    maxWeekConfidence: weekConfidences.length ? Math.max(...weekConfidences) : null,
    hasConfidenceCapEvidence: confidenceReasons.length > 0 || weekCapReasons.length > 0 || weekConfidenceReasons.length > 0,
  };
}

function summarizePlayoffActionItems(playoffSchedulePlanning: any) {
  const actionItems = asArray(playoffSchedulePlanning?.actionItems);
  const confidenceValues = actionItems
    .map((item: any) => finiteNumber(item?.confidence))
    .filter((value: number | null): value is number => value !== null);
  const capReasonCount = actionItems.filter((item: any) =>
    typeof item?.confidenceCapReason === 'string' && item.confidenceCapReason.trim().length > 0
  ).length;
  const confidenceReasonCount = actionItems
    .flatMap((item: any) => asArray(item?.confidenceReasons))
    .filter((reason: unknown): reason is string => typeof reason === 'string' && reason.trim().length > 0)
    .length;
  const coverRiskCount = actionItems.filter((item: any) => item?.type === 'cover-risk').length;
  const reviewFallbackCount = actionItems.filter((item: any) => item?.type === 'review-fallback').length;
  const exploitUpsideCount = actionItems.filter((item: any) => item?.type === 'exploit-upside').length;
  const replacementTargetCount = actionItems.reduce((sum: number, item: any) =>
    sum + asArray(item?.replacementTargets).length, 0);
  const affectedPlayerCount = actionItems.reduce((sum: number, item: any) =>
    sum + asArray(item?.affectedPlayers).length, 0);

  return {
    count: actionItems.length,
    coverRiskCount,
    reviewFallbackCount,
    exploitUpsideCount,
    confidenceCount: confidenceValues.length,
    confidenceReasonCount,
    capReasonCount,
    replacementTargetCount,
    affectedPlayerCount,
    minConfidence: confidenceValues.length ? Math.min(...confidenceValues) : null,
    maxConfidence: confidenceValues.length ? Math.max(...confidenceValues) : null,
    hasRiskOrFallbackAction: coverRiskCount > 0 || reviewFallbackCount > 0,
    containsProjectionClaim: containsStoredWeeklyProjectionClaim(actionItems),
  };
}

function summarizeMatchupPreviews(reportData: any) {
  const previews = asArray(reportData?.matchupPreviews);
  const confidences = previews
    .map((preview: any) => finiteNumber(preview?.confidence))
    .filter((value: number | null): value is number => value !== null);
  const coverageRows = previews
    .map((preview: any) => preview?.projectionCoverage)
    .filter(Boolean);
  const capReasonCount = previews.filter((preview: any) =>
    typeof preview?.confidenceCapReason === 'string' && preview.confidenceCapReason.trim().length > 0
  ).length;
  const confidenceReasonCount = previews
    .flatMap((preview: any) => asArray(preview?.confidenceReasons))
    .filter((reason: unknown): reason is string => typeof reason === 'string' && reason.trim().length > 0)
    .length;
  const projectionBackedCount = coverageRows.filter((coverage: any) =>
    coverage?.mode === 'stored-weekly-projection' ||
    coverage?.mode === 'stored-weekly-projection-blend'
  ).length;
  const scheduleValueCount = coverageRows.filter((coverage: any) =>
    coverage?.mode === 'schedule-value'
  ).length;

  return {
    count: previews.length,
    confidenceCount: confidences.length,
    coverageCount: coverageRows.length,
    confidenceReasonCount,
    capReasonCount,
    projectionBackedCount,
    scheduleValueCount,
    minConfidence: confidences.length ? Math.min(...confidences) : null,
    maxConfidence: confidences.length ? Math.max(...confidences) : null,
    hasProjectionBackedPreview: projectionBackedCount > 0,
    hasConfidenceCapEvidence: capReasonCount > 0 || confidenceReasonCount > 0,
    containsProjectionClaim: containsStoredWeeklyProjectionClaim(previews),
  };
}

function getPriorityWaiverTargets(reportData: any): any[] {
  return asArray(reportData?.waiverIntelligence?.priorityWaiverTargets || reportData?.priorityWaiverTargets);
}

function hasWindowEvidence(window: any): boolean {
  return Boolean(
    window &&
    Array.isArray(window.weeks) &&
    window.weeks.length > 0 &&
    (
      finiteNumber(window.score) !== null ||
      finiteNumber(window.averageStars) !== null ||
      finiteNumber(window.playableWeeks) !== null ||
      finiteNumber(window.easyWeeks) !== null ||
      finiteNumber(window.hardWeeks) !== null
    )
  );
}

function hasScheduleWindowEvidence(target: any): boolean {
  const windows = target?.scheduleSignal?.matchupWindows;
  return Boolean(
    hasWindowEvidence(windows?.next3) ||
    hasWindowEvidence(windows?.next6) ||
    hasWindowEvidence(windows?.playoffs)
  );
}

function hasScheduleWindowReason(target: any): boolean {
  return /schedule|upcoming|six-week|playoff-window|window/i.test(
    asArray(target?.reasons).join(' ')
  );
}

function getPriorityWaiverOpportunityWindows(target: any): any[] {
  return [
    ...asArray(target?.opportunityWindows),
    target?.opportunityWindow,
  ].filter(Boolean);
}

function hasPriorityWaiverOpportunityWindow(target: any): boolean {
  return getPriorityWaiverOpportunityWindows(target).some((window: any) =>
    typeof window?.type === 'string' &&
    typeof window?.source === 'string' &&
    finiteNumber(window?.confidence) !== null
  );
}

function summarizePriorityWaiverTargets(reportData: any) {
  const targets = getPriorityWaiverTargets(reportData);
  const targetsWithScheduleWindows = targets.filter(hasScheduleWindowEvidence);
  const targetsWithScheduleReasons = targets.filter(hasScheduleWindowReason);
  const targetsWithWeeklyProjection = targets.filter((target: any) => Boolean(target?.weeklyProjection));
  const targetsWithOpportunityWindows = targets.filter(hasPriorityWaiverOpportunityWindow);
  const confidenceValues = targets
    .map((target: any) => finiteNumber(target?.confidence))
    .filter((value: number | null): value is number => value !== null);
  const confidenceReasonCount = targets
    .flatMap((target: any) => asArray(target?.confidenceReasons))
    .filter((reason: unknown): reason is string => typeof reason === 'string' && reason.trim().length > 0)
    .length;
  const capReasonCount = targets.filter((target: any) =>
    typeof target?.confidenceCapReason === 'string' && target.confidenceCapReason.trim().length > 0
  ).length;
  const opportunityWindowCount = targets.reduce((sum: number, target: any) =>
    sum + getPriorityWaiverOpportunityWindows(target).length, 0);

  return {
    count: targets.length,
    targetsWithScheduleWindows: targetsWithScheduleWindows.length,
    targetsWithScheduleReasons: targetsWithScheduleReasons.length,
    targetsWithWeeklyProjection: targetsWithWeeklyProjection.length,
    targetsWithOpportunityWindows: targetsWithOpportunityWindows.length,
    opportunityWindowCount,
    confidenceCount: confidenceValues.length,
    confidenceReasonCount,
    capReasonCount,
    minConfidence: confidenceValues.length ? Math.min(...confidenceValues) : null,
    maxConfidence: confidenceValues.length ? Math.max(...confidenceValues) : null,
    hasPriorityWaiverTargets: targets.length > 0,
    hasScheduleWindowBackedTarget: targetsWithScheduleWindows.length > 0,
    hasOpportunityWindowBackedTarget: targetsWithOpportunityWindows.length > 0,
    containsProjectionClaim: containsStoredWeeklyProjectionClaim(targets),
  };
}

function summarizeDynastyContentionContext(reportData: any) {
  const context = reportData?.dynastyContentionContext;
  const rows = asArray(context?.rows);
  const managers = asArray(context?.managers);
  const confidences = rows
    .map((row: any) => finiteNumber(row?.confidence))
    .filter((value: number | null): value is number => value !== null);
  const managerConfidences = managers
    .map((row: any) => finiteNumber(row?.confidence))
    .filter((value: number | null): value is number => value !== null);
  const projectedRows = rows.filter((row: any) => finiteNumber(row?.projectedFantasyPoints) !== null);
  const sellProjectionSpikeRows = rows.filter((row: any) => row?.action === 'sell-on-projection-spike');

  return {
    exists: Boolean(context),
    status: context?.status || null,
    projectionStatus: context?.projectionStatus || null,
    rowCount: rows.length,
    managerCount: managers.length,
    confidenceCount: confidences.length,
    managerConfidenceCount: managerConfidences.length,
    minConfidence: confidences.length ? Math.min(...confidences) : null,
    maxConfidence: confidences.length ? Math.max(...confidences) : null,
    projectedRowCount: projectedRows.length,
    sellProjectionSpikeCount: sellProjectionSpikeRows.length,
    actionTypes: Array.from(new Set(rows.map((row: any) => row?.action).filter(Boolean))).sort(),
    containsProjectionClaim: containsStoredWeeklyProjectionClaim(context),
  };
}

function validateReportContract(input: {
  mode: Mode;
  leagueId: string;
  reportData: any;
}) {
  const failures: string[] = [];
  const reportData = input.reportData || {};
  const schedulePlanning = reportData.schedulePlanning;
  const playoffSchedulePlanning = reportData.playoffSchedulePlanning;
  const playoffWeeks = Array.isArray(playoffSchedulePlanning?.weeks) ? playoffSchedulePlanning.weeks : [];
  const matchupPreviews = Array.isArray(reportData.matchupPreviews) ? reportData.matchupPreviews : [];
  const playoffConfidence = summarizePlayoffConfidence(playoffSchedulePlanning);
  const playoffActionItems = summarizePlayoffActionItems(playoffSchedulePlanning);
  const matchupPreviewSummary = summarizeMatchupPreviews(reportData);
  const priorityWaiverTargets = summarizePriorityWaiverTargets(reportData);
  const dynastyContentionContext = summarizeDynastyContentionContext(reportData);

  if (!schedulePlanning) failures.push('missing schedulePlanning');
  if (!playoffSchedulePlanning) failures.push('missing playoffSchedulePlanning');
  for (const week of PLAYOFF_WEEKS) {
    if (!playoffWeeks.includes(week)) failures.push(`missing playoff week ${week}`);
  }
  if (!playoffSchedulePlanning?.managerPlans?.length) failures.push('missing playoff manager plans');
  if (!reportData.lineupStrength) failures.push('missing lineupStrength');
  if (!reportData.redraftValuation) failures.push('missing redraftValuation');
  if (reportData.leagueValueMode !== 'redraft' && !dynastyContentionContext.exists) failures.push('missing dynastyContentionContext');
  if (!matchupPreviews.length) failures.push('missing matchupPreviews');
  if (matchupPreviewSummary.count > 0 && matchupPreviewSummary.confidenceCount !== matchupPreviewSummary.count) {
    failures.push('missing matchup preview confidence');
  }
  if (matchupPreviewSummary.count > 0 && matchupPreviewSummary.coverageCount !== matchupPreviewSummary.count) {
    failures.push('missing matchup preview projection coverage');
  }
  if (
    matchupPreviewSummary.minConfidence !== null &&
    (matchupPreviewSummary.minConfidence < 0 || (matchupPreviewSummary.maxConfidence ?? 0) > 100)
  ) {
    failures.push(`matchup preview confidence out of range: ${matchupPreviewSummary.minConfidence}-${matchupPreviewSummary.maxConfidence}`);
  }
  if (!priorityWaiverTargets.hasPriorityWaiverTargets) failures.push('missing priorityWaiverTargets');
  if (priorityWaiverTargets.hasPriorityWaiverTargets && !priorityWaiverTargets.hasScheduleWindowBackedTarget) {
    failures.push('priorityWaiverTargets missing source-backed matchup window evidence');
  }
  if (priorityWaiverTargets.count > 0 && priorityWaiverTargets.confidenceCount !== priorityWaiverTargets.count) {
    failures.push('missing priorityWaiverTargets confidence');
  }
  if (
    priorityWaiverTargets.minConfidence !== null &&
    (priorityWaiverTargets.minConfidence < 0 || (priorityWaiverTargets.maxConfidence ?? 0) > 100)
  ) {
    failures.push(`priorityWaiverTargets confidence out of range: ${priorityWaiverTargets.minConfidence}-${priorityWaiverTargets.maxConfidence}`);
  }
  if (priorityWaiverTargets.hasPriorityWaiverTargets && !priorityWaiverTargets.hasOpportunityWindowBackedTarget) {
    failures.push('priorityWaiverTargets missing opportunity-window evidence');
  }
  if (dynastyContentionContext.exists) {
    if (dynastyContentionContext.rowCount > 0 && dynastyContentionContext.confidenceCount !== dynastyContentionContext.rowCount) {
      failures.push('missing dynastyContentionContext row confidence');
    }
    if (dynastyContentionContext.managerCount > 0 && dynastyContentionContext.managerConfidenceCount !== dynastyContentionContext.managerCount) {
      failures.push('missing dynastyContentionContext manager confidence');
    }
    if (
      dynastyContentionContext.minConfidence !== null &&
      (dynastyContentionContext.minConfidence < 0 || (dynastyContentionContext.maxConfidence ?? 0) > 100)
    ) {
      failures.push(`dynastyContentionContext confidence out of range: ${dynastyContentionContext.minConfidence}-${dynastyContentionContext.maxConfidence}`);
    }
  }

  if (playoffSchedulePlanning) {
    if (playoffConfidence.confidence === null) failures.push('missing playoffSchedulePlanning confidence');
    if (playoffConfidence.planCount > 0 && playoffConfidence.managerConfidenceCount !== playoffConfidence.planCount) {
      failures.push('missing playoff manager plan confidence');
    }
    if (playoffConfidence.planWeekCount > 0 && playoffConfidence.weekConfidenceCount !== playoffConfidence.planWeekCount) {
      failures.push('missing playoff week confidence');
    }
    if (
      playoffConfidence.confidence !== null &&
      (playoffConfidence.confidence < 0 || playoffConfidence.confidence > 100)
    ) {
      failures.push(`playoffSchedulePlanning confidence out of range: ${playoffConfidence.confidence}`);
    }
    if (!playoffActionItems.count) {
      failures.push('missing playoffSchedulePlanning actionItems');
    }
    if (playoffActionItems.count > 0 && playoffActionItems.confidenceCount !== playoffActionItems.count) {
      failures.push('missing playoff action item confidence');
    }
    if (playoffActionItems.count > 0 && !playoffActionItems.hasRiskOrFallbackAction) {
      failures.push('playoff actionItems missing cover-risk or review-fallback action');
    }
    if (
      playoffActionItems.minConfidence !== null &&
      (playoffActionItems.minConfidence < 0 || (playoffActionItems.maxConfidence ?? 0) > 100)
    ) {
      failures.push(`playoff action item confidence out of range: ${playoffActionItems.minConfidence}-${playoffActionItems.maxConfidence}`);
    }
  }

  if (input.mode === 'projection-on') {
    if (reportData.weeklyProjectionDiagnostics?.status !== 'ready') {
      failures.push(`weekly projections not ready: ${reportData.weeklyProjectionDiagnostics?.status || 'missing'}`);
    }
    if (!hasProjectionBackedPlayoffWeek(reportData) && !playoffConfidence.hasConfidenceCapEvidence) {
      failures.push('playoffSchedulePlanning has no projection-backed week or confidence cap evidence');
    }
    if (!matchupPreviewSummary.hasProjectionBackedPreview && !matchupPreviewSummary.hasConfidenceCapEvidence) {
      failures.push('matchupPreviews have no projection-backed preview or confidence cap evidence');
    }
  } else {
    if (reportData.weeklyProjectionDiagnostics?.status !== 'blocked') {
      failures.push(`weekly projections not blocked: ${reportData.weeklyProjectionDiagnostics?.status || 'missing'}`);
    }
    if (!hasOnlyScheduleValuePlayoffWeeks(reportData)) {
      failures.push('playoffSchedulePlanning leaked projection-backed week context');
    }
    if (containsStoredWeeklyProjectionClaim({
      playoffSchedulePlanning: reportData.playoffSchedulePlanning,
      matchupPreviews: reportData.matchupPreviews,
      lineupStrength: reportData.lineupStrength,
      redraftValuation: reportData.redraftValuation,
        waiverIntelligence: reportData.waiverIntelligence,
      })) {
      failures.push('projection-off report still contains stored weekly projection claims');
    }
    if (playoffConfidence.confidence !== null && playoffConfidence.confidence > 58) {
      failures.push(`projection-off playoff confidence exceeds fallback cap: ${playoffConfidence.confidence}`);
    }
    if (playoffConfidence.maxPlanConfidence !== null && playoffConfidence.maxPlanConfidence > 58) {
      failures.push(`projection-off manager playoff confidence exceeds fallback cap: ${playoffConfidence.maxPlanConfidence}`);
    }
    if (playoffConfidence.maxWeekConfidence !== null && playoffConfidence.maxWeekConfidence > 58) {
      failures.push(`projection-off week playoff confidence exceeds fallback cap: ${playoffConfidence.maxWeekConfidence}`);
    }
    if (playoffActionItems.maxConfidence !== null && playoffActionItems.maxConfidence > 58) {
      failures.push(`projection-off playoff action confidence exceeds fallback cap: ${playoffActionItems.maxConfidence}`);
    }
    if (playoffActionItems.containsProjectionClaim) {
      failures.push('projection-off playoff actionItems still contain stored weekly projection claims');
    }
    if (matchupPreviewSummary.projectionBackedCount > 0) {
      failures.push('projection-off matchupPreviews still expose projection-backed coverage');
    }
    if (matchupPreviewSummary.maxConfidence !== null && matchupPreviewSummary.maxConfidence > 58) {
      failures.push(`projection-off matchup preview confidence exceeds fallback cap: ${matchupPreviewSummary.maxConfidence}`);
    }
    if (matchupPreviewSummary.containsProjectionClaim) {
      failures.push('projection-off matchupPreviews still contain stored weekly projection claims');
    }
    if (priorityWaiverTargets.targetsWithWeeklyProjection > 0) {
      failures.push('projection-off priorityWaiverTargets still expose weekly projections');
    }
    if (priorityWaiverTargets.maxConfidence !== null && priorityWaiverTargets.maxConfidence > 58) {
      failures.push(`projection-off priorityWaiverTargets confidence exceeds fallback cap: ${priorityWaiverTargets.maxConfidence}`);
    }
    if (priorityWaiverTargets.containsProjectionClaim) {
      failures.push('projection-off priorityWaiverTargets still contain stored weekly projection claims');
    }
    if (dynastyContentionContext.projectedRowCount > 0) {
      failures.push('projection-off dynastyContentionContext still exposes projected fantasy points');
    }
    if (dynastyContentionContext.sellProjectionSpikeCount > 0) {
      failures.push('projection-off dynastyContentionContext still exposes sell-on-projection-spike reads');
    }
    if (dynastyContentionContext.maxConfidence !== null && dynastyContentionContext.maxConfidence > 58) {
      failures.push(`projection-off dynastyContentionContext confidence exceeds fallback cap: ${dynastyContentionContext.maxConfidence}`);
    }
    if (dynastyContentionContext.containsProjectionClaim) {
      failures.push('projection-off dynastyContentionContext still contains stored weekly projection claims');
    }
  }

  return {
    mode: input.mode,
    leagueId: input.leagueId,
    ok: failures.length === 0,
    failures,
    summary: {
      hasSchedulePlanning: Boolean(schedulePlanning),
      hasPlayoffSchedulePlanning: Boolean(playoffSchedulePlanning),
      playoffWeeks,
      playoffManagerPlanCount: playoffSchedulePlanning?.managerPlans?.length || 0,
      hasLineupStrength: Boolean(reportData.lineupStrength),
      hasRedraftValuation: Boolean(reportData.redraftValuation),
      matchupPreviewCount: matchupPreviews.length,
      weeklyProjectionStatus: reportData.weeklyProjectionDiagnostics?.status || null,
      weeklyProjectionRows: reportData.weeklyProjectionDiagnostics?.rowCount || 0,
      playoffConfidence: playoffConfidence.confidence,
      playoffConfidenceReasonCount: playoffConfidence.confidenceReasonCount,
      playoffManagerConfidenceCount: playoffConfidence.managerConfidenceCount,
      playoffWeekConfidenceCount: playoffConfidence.weekConfidenceCount,
      playoffWeekConfidenceCapReasonCount: playoffConfidence.weekConfidenceCapReasonCount,
      playoffWeekConfidenceReasonCount: playoffConfidence.weekConfidenceReasonCount,
      hasPlayoffConfidenceCapEvidence: playoffConfidence.hasConfidenceCapEvidence,
      playoffActionItemCount: playoffActionItems.count,
      playoffCoverRiskActionCount: playoffActionItems.coverRiskCount,
      playoffReviewFallbackActionCount: playoffActionItems.reviewFallbackCount,
      playoffExploitUpsideActionCount: playoffActionItems.exploitUpsideCount,
      playoffActionConfidenceCount: playoffActionItems.confidenceCount,
      playoffActionConfidenceReasonCount: playoffActionItems.confidenceReasonCount,
      playoffActionConfidenceCapReasonCount: playoffActionItems.capReasonCount,
      playoffActionReplacementTargetCount: playoffActionItems.replacementTargetCount,
      playoffActionAffectedPlayerCount: playoffActionItems.affectedPlayerCount,
      playoffActionMinConfidence: playoffActionItems.minConfidence,
      playoffActionMaxConfidence: playoffActionItems.maxConfidence,
      matchupPreviewConfidenceCount: matchupPreviewSummary.confidenceCount,
      matchupPreviewCoverageCount: matchupPreviewSummary.coverageCount,
      matchupPreviewConfidenceReasonCount: matchupPreviewSummary.confidenceReasonCount,
      matchupPreviewConfidenceCapReasonCount: matchupPreviewSummary.capReasonCount,
      matchupPreviewProjectionBackedCount: matchupPreviewSummary.projectionBackedCount,
      matchupPreviewScheduleValueCount: matchupPreviewSummary.scheduleValueCount,
      matchupPreviewMinConfidence: matchupPreviewSummary.minConfidence,
      matchupPreviewMaxConfidence: matchupPreviewSummary.maxConfidence,
      priorityWaiverTargetCount: priorityWaiverTargets.count,
      priorityWaiverTargetsWithScheduleWindows: priorityWaiverTargets.targetsWithScheduleWindows,
      priorityWaiverTargetsWithScheduleReasons: priorityWaiverTargets.targetsWithScheduleReasons,
      priorityWaiverTargetsWithWeeklyProjection: priorityWaiverTargets.targetsWithWeeklyProjection,
      priorityWaiverTargetsWithOpportunityWindows: priorityWaiverTargets.targetsWithOpportunityWindows,
      priorityWaiverOpportunityWindowCount: priorityWaiverTargets.opportunityWindowCount,
      priorityWaiverConfidenceCount: priorityWaiverTargets.confidenceCount,
      priorityWaiverConfidenceReasonCount: priorityWaiverTargets.confidenceReasonCount,
      priorityWaiverConfidenceCapReasonCount: priorityWaiverTargets.capReasonCount,
      priorityWaiverMinConfidence: priorityWaiverTargets.minConfidence,
      priorityWaiverMaxConfidence: priorityWaiverTargets.maxConfidence,
      dynastyContentionStatus: dynastyContentionContext.status,
      dynastyContentionProjectionStatus: dynastyContentionContext.projectionStatus,
      dynastyContentionRowCount: dynastyContentionContext.rowCount,
      dynastyContentionManagerCount: dynastyContentionContext.managerCount,
      dynastyContentionConfidenceCount: dynastyContentionContext.confidenceCount,
      dynastyContentionManagerConfidenceCount: dynastyContentionContext.managerConfidenceCount,
      dynastyContentionProjectedRowCount: dynastyContentionContext.projectedRowCount,
      dynastyContentionSellProjectionSpikeCount: dynastyContentionContext.sellProjectionSpikeCount,
      dynastyContentionActionTypes: dynastyContentionContext.actionTypes,
    },
  };
}

function extractReportData(payload: any): any {
  return payload?.reportData || payload?.data?.reportData || payload;
}

async function runReportContract(input: {
  mode: Mode;
  leagueId: string;
  forceRefresh: boolean;
}) {
  return withEnv(envForMode(input.mode), async () => {
    const { appRouter } = await import('../server/routers');
    const caller = appRouter.createCaller({
      req: {
        headers: {
          'user-agent': 'projection-sos-rollout-verifier',
          'x-cache-warmer': 'true',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as any,
      res: {} as any,
      user: null,
    });
    const reportData = await caller.league.analyze({
      leagueId: input.leagueId,
      forceRefresh: input.forceRefresh,
    });
    return validateReportContract({
      mode: input.mode,
      leagueId: input.leagueId,
      reportData: extractReportData(reportData),
    });
  });
}

async function runMode(input: {
  mode: Mode;
  season: string;
  week: number;
  profile: SleeperProjectionScoringProfile;
}) {
  return withEnv(envForMode(input.mode), async () => {
    const result = await probeProjectionSosReadiness({
      season: input.season,
      week: input.week,
      scoringProfile: input.profile,
      expectation: input.mode === 'projection-on' ? 'enabled' : 'disabled',
    });
    return summarize(input.mode, result);
  });
}

async function main() {
  const season = String(getFlag('season') || process.env.PROJECTION_READINESS_SEASON || new Date().getUTCFullYear());
  const week = parseWeek();
  const profiles = parseProfiles();
  const leagueId = parseLeagueId();
  const reportForceRefresh = parseReportForceRefresh();
  const modes: Mode[] = ['projection-off', 'projection-on'];
  const checks = [];
  const reportContracts = [];

  for (const profile of profiles) {
    for (const mode of modes) {
      checks.push(await runMode({ mode, season, week, profile }));
    }
  }

  if (leagueId) {
    for (const mode of modes) {
      reportContracts.push(await runReportContract({
        mode,
        leagueId,
        forceRefresh: reportForceRefresh,
      }));
    }
  }

  const ok = checks.every((check) => check.ok) && reportContracts.every((check) => check.ok);
  console.log(JSON.stringify({
    ok,
    season,
    week,
    profiles,
    leagueId,
    reportForceRefresh,
    checks,
    reportContracts,
  }, null, 2));

  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[projection-sos-rollout] failed:', error);
  process.exitCode = 1;
});
