import {
  evaluateAIEvidence,
  type AIEvidenceAction,
  type AIEvidenceMode,
  type AIEvidenceResult,
  type AIEvidenceSurface,
  type AISourceTrace,
} from '../shared/aiEvidenceEngine';
import type { NflScheduleSnapshotPayload } from './nflScheduleSnapshots';
import type { PlayerProjectionContextRow } from './playerProjectionContext';
import type {
  PlayerProjectionSnapshotPayload,
  PlayerProjectionSnapshotRow,
  PlayerProjectionSource,
  PlayerProjectionType,
} from './playerProjectionSnapshots';

export type ProjectionEvidenceKind =
  | 'stored projection'
  | 'internal projection'
  | 'schedule estimate'
  | 'market signal'
  | 'dynasty value'
  | 'schedule/value context only';

export type ProjectionReadoutPolicyInput = {
  surface: AIEvidenceSurface;
  action: AIEvidenceAction;
  leagueValueMode?: 'dynasty' | 'redraft';
  row?: PlayerProjectionContextRow | null;
  projectionSnapshot?: PlayerProjectionSnapshotPayload | null;
  scheduleSnapshot?: NflScheduleSnapshotPayload | null;
  now?: Date;
  sourcePolicy?: {
    projectionDisplayAllowed?: boolean;
    providerAttributionAllowed?: boolean;
    providerNamesAllowed?: Partial<Record<PlayerProjectionSource, boolean>>;
  };
  baseScore?: number | null;
  previousProjectedFantasyPoints?: number | null;
  roleTrend?: 'gaining' | 'stable' | 'declining' | 'lost' | 'unknown';
  usageTrend?: 'gaining' | 'stable' | 'declining' | 'collapsed' | 'unknown';
  injuryTrend?: 'clear' | 'new' | 'recurring' | 'unknown';
  sourceCount?: number | null;
};

export type ProjectionReadoutPolicyResult = {
  evidenceKind: ProjectionEvidenceKind;
  evidenceLanguage: string;
  canUseProjectionClaim: boolean;
  canNameProvider: boolean;
  hardBlockers: string[];
  softWarnings: string[];
  confidenceCap: number;
  confidenceCapReason: string | null;
  sourceTraceText: string[];
  fallbackCopy: string | null;
  opportunityRunwayText: string | null;
  whyThisFired: string;
  evidenceRead: AIEvidenceResult;
};

const PROVIDER_SOURCES = new Set<PlayerProjectionSource>([
  'fantasypros',
  'draftsharks',
  'sportsdataio',
]);

function cleanText(value: unknown): string | null {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean || null;
}

function uniqueTexts(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = cleanText(value);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function capConfidence(
  currentCap: number,
  currentReason: string | null,
  nextCap: number,
  nextReason: string
): { cap: number; reason: string | null } {
  if (nextCap >= currentCap) return { cap: currentCap, reason: currentReason };
  return { cap: clampPercent(nextCap), reason: nextReason };
}

function dateAgeHours(value: string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return Math.max(0, Math.round(((now.getTime() - parsed.getTime()) / (60 * 60 * 1000)) * 10) / 10);
}

function projectionFreshnessHours(type?: PlayerProjectionType | string): number {
  if (type === 'weekly') return 72;
  if (type === 'rest_of_season') return 168;
  if (type === 'playoff_weeks') return 168;
  if (type === 'preseason') return 336;
  return 168;
}

function displaySourceName(source?: PlayerProjectionSource | string, canNameProvider = false): string {
  if (!source) return 'projection source';
  if (source === 'internal') return canNameProvider ? 'app projection' : 'internal';
  return 'stored projection';
}

function findProjectionRow(
  row?: PlayerProjectionContextRow | null,
  snapshot?: PlayerProjectionSnapshotPayload | null
): PlayerProjectionSnapshotRow | null {
  if (!row || !snapshot) return null;
  return snapshot.rows.find((candidate) => candidate.rowKey === row.rowKey)
    || snapshot.rows.find((candidate) => (
      Boolean(row.playerId && candidate.playerId === row.playerId)
      || Boolean(row.sourcePlayerId && candidate.sourcePlayerId === row.sourcePlayerId)
    ))
    || null;
}

function getEvidenceKind(input: {
  row?: PlayerProjectionContextRow | null;
  projectionRow?: PlayerProjectionSnapshotRow | null;
  projectionDisplayAllowed: boolean;
  canNameProvider: boolean;
}): ProjectionEvidenceKind {
  if (!input.row || !input.projectionRow || !input.projectionDisplayAllowed) {
    if (input.row?.valueBridge.dynastyValue !== null) return 'dynasty value';
    if (input.row?.schedule.opponent) return 'schedule estimate';
    return 'schedule/value context only';
  }

  if (input.projectionRow.source === 'internal') return 'internal projection';
  if (PROVIDER_SOURCES.has(input.projectionRow.source)) {
    return 'stored projection';
  }
  return 'schedule/value context only';
}

function isUnresolvedInjury(value?: string | null): boolean {
  return /questionable|doubtful|out|ir|pup|nfi|injur|limited|did not practice|dnp|recurring/i.test(value || '');
}

function isPositiveRunway(text?: string | null): boolean {
  return /day 1|round 1|round 2|early|premium|protected|starter|stable|highly paid|contract|runway|team investment/i.test(text || '');
}

function isNegativeRole(input: ProjectionReadoutPolicyInput): boolean {
  return input.roleTrend === 'declining'
    || input.roleTrend === 'lost'
    || input.usageTrend === 'declining'
    || input.usageTrend === 'collapsed'
    || input.injuryTrend === 'recurring';
}

function getOpportunityRunwayText(row?: PlayerProjectionContextRow | null): string | null {
  if (!row) return null;
  const runway = cleanText(row.valueBridge.opportunityRunway);
  const draftCapital = cleanText(row.valueBridge.draftCapitalSignal);
  const roleSecurity = cleanText(row.valueBridge.longTermRoleSecurity);
  const parts = [
    runway ? `Opportunity runway: ${runway}.` : null,
    draftCapital ? `Draft-capital context: ${draftCapital}.` : null,
    roleSecurity ? `Role security: ${roleSecurity}.` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

function getProjectionSwingWarning(input: {
  row?: PlayerProjectionContextRow | null;
  previousProjectedFantasyPoints?: number | null;
  hasPositiveRunway: boolean;
  negativeRole: boolean;
}): { warning: string | null; capReason: string | null; cap: number | null } {
  const current = Number(input.row?.projectedFantasyPoints);
  const previous = Number(input.previousProjectedFantasyPoints);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return { warning: null, capReason: null, cap: null };
  }

  const delta = current - previous;
  const absDelta = Math.abs(delta);
  const pctDelta = absDelta / previous;
  const isMaterialSwing = absDelta >= 4 || pctDelta >= 0.3;
  if (!isMaterialSwing) return { warning: null, capReason: null, cap: null };

  if (delta < 0 && input.hasPositiveRunway) {
    return {
      warning: 'One-week projection drop conflicts with opportunity runway, draft capital, or stable role context.',
      capReason: 'One-week projection swing',
      cap: 68,
    };
  }

  if (delta > 0 && input.negativeRole) {
    return {
      warning: 'One-week projection spike conflicts with role, usage, or injury risk context.',
      capReason: 'One-week projection swing',
      cap: 66,
    };
  }

  return {
    warning: 'Material one-week projection swing should not be treated as a full value change by itself.',
    capReason: 'One-week projection swing',
    cap: 74,
  };
}

function getSourceTrace(input: {
  row?: PlayerProjectionContextRow | null;
  projectionSnapshot?: PlayerProjectionSnapshotPayload | null;
  scheduleSnapshot?: NflScheduleSnapshotPayload | null;
  projectionRow?: PlayerProjectionSnapshotRow | null;
  now: Date;
  canNameProvider: boolean;
}): AISourceTrace[] {
  const trace: AISourceTrace[] = [];
  const row = input.row;
  const projectionSnapshot = input.projectionSnapshot;
  const projectionRow = input.projectionRow;

  if (projectionSnapshot) {
    const sourceLabel = displaySourceName(projectionSnapshot.source, input.canNameProvider);
    const ageHours =
      dateAgeHours(projectionSnapshot.providerUpdatedAt, input.now)
      ?? dateAgeHours(projectionSnapshot.publishedAt, input.now)
      ?? dateAgeHours(projectionSnapshot.fetchedAt, input.now);
    trace.push({
      label: `${sourceLabel} ${projectionSnapshot.projectionType}`,
      status: projectionSnapshot.sourceError || projectionSnapshot.staleReason ? 'stale' : 'loaded',
      ageHours,
      detail: [
        row?.schedule.week ? `Week ${row.schedule.week}` : projectionSnapshot.week ? `Week ${projectionSnapshot.week}` : null,
        row?.schedule.opponent ? `vs ${row.schedule.opponent}` : null,
        `source version ${projectionSnapshot.sourceVersion}`,
        projectionSnapshot.providerUpdatedAt ? `provider updated ${projectionSnapshot.providerUpdatedAt}` : null,
        projectionSnapshot.publishedAt ? `published ${projectionSnapshot.publishedAt}` : null,
        `fetched ${projectionSnapshot.fetchedAt}`,
      ].filter(Boolean).join(', '),
    });
  }

  if (input.scheduleSnapshot) {
    trace.push({
      label: 'NFL schedule snapshot',
      status: row?.schedule.opponent ? 'loaded' : 'missing',
      detail: [
        row?.schedule.week ? `Week ${row.schedule.week}` : null,
        row?.schedule.team && row?.schedule.opponent ? `${row.schedule.team} ${row.schedule.homeAway} vs ${row.schedule.opponent}` : null,
        `source version ${input.scheduleSnapshot.sourceVersion}`,
        input.scheduleSnapshot.publishedAt ? `published ${input.scheduleSnapshot.publishedAt}` : null,
        `fetched ${input.scheduleSnapshot.fetchedAt}`,
      ].filter(Boolean).join(', '),
    });
  }

  if (projectionRow?.expertCount !== null && projectionRow?.expertCount !== undefined) {
    trace.push({
      label: 'Projection evidence count',
      status: projectionRow.expertCount > 1 ? 'loaded' : 'limited',
      detail: `${projectionRow.expertCount} expert${projectionRow.expertCount === 1 ? '' : 's'}`,
    });
  }

  if (row?.matchupActuals) {
    trace.push({
      label: 'Historical matchup actuals',
      status: row.matchupActuals.recommendation === 'blocked' ? 'limited' : 'loaded',
      detail: [
        `${row.matchupActuals.sampleSize} similar ${row.matchupActuals.position}/${row.matchupActuals.roleBucket}/${row.matchupActuals.opponentStrengthBucket}/${row.matchupActuals.homeAway} rows`,
        `recommendation ${row.matchupActuals.recommendation}`,
        `confidence ${row.matchupActuals.confidence}`,
      ].join(', '),
    });
  }

  if (row?.playerOpponentHistory) {
    trace.push({
      label: 'Player opponent history',
      status: row.playerOpponentHistory.recommendation === 'blocked' ? 'limited' : 'loaded',
      detail: [
        `${row.playerOpponentHistory.sampleSize} career game${row.playerOpponentHistory.sampleSize === 1 ? '' : 's'} vs ${row.playerOpponentHistory.opponent}`,
        `avg ${row.playerOpponentHistory.avgFantasyPoints ?? 'n/a'} pts`,
        `recommendation ${row.playerOpponentHistory.recommendation}`,
      ].join(', '),
    });
  }

  return trace;
}

function getSourceTraceText(trace: AISourceTrace[]): string[] {
  return trace.map((item) => [
    item.label,
    item.status ? `(${item.status})` : null,
    item.ageHours !== null && item.ageHours !== undefined ? `${item.ageHours}h old` : null,
    item.detail,
  ].filter(Boolean).join(' '));
}

function getEvidenceLanguage(input: {
  row?: PlayerProjectionContextRow | null;
  projectionSnapshot?: PlayerProjectionSnapshotPayload | null;
  evidenceKind: ProjectionEvidenceKind;
  canNameProvider: boolean;
}): string {
  const row = input.row;
  if (!row) return 'No projection row is available; do not make a weekly projection claim.';
  if (input.evidenceKind === 'stored projection') {
    const source = displaySourceName(input.projectionSnapshot?.source, input.canNameProvider);
    return `${source} ${row.projectionType} is ${row.projectedFantasyPoints ?? 'n/a'} points for ${row.scoringProfile}.`;
  }
  if (input.evidenceKind === 'internal projection') {
    return `Internal ${row.projectionType} projection is ${row.projectedFantasyPoints ?? 'n/a'} points for ${row.scoringProfile}.`;
  }
  if (input.evidenceKind === 'schedule estimate') {
    return `Schedule context is available for Week ${row.schedule.week ?? 'n/a'}${row.schedule.opponent ? ` vs ${row.schedule.opponent}` : ''}, but no approved weekly projection claim is available.`;
  }
  if (input.evidenceKind === 'dynasty value') {
    return 'Dynasty value context is available, but it is not a weekly projection.';
  }
  if (input.evidenceKind === 'market signal') {
    return 'Market signal context is available, but it is not a weekly projection.';
  }
  return 'Projection data is missing; this read can use schedule/value context only.';
}

function getSignalModes(row?: PlayerProjectionContextRow | null, canUseProjectionClaim = false): AIEvidenceMode[] {
  const modes = new Set<AIEvidenceMode>();
  if (row?.schedule.opponent) modes.add('schedule');
  if (canUseProjectionClaim || row?.valueBridge.redraftValue !== null || row?.valueBridge.weeklyProjection !== null) {
    modes.add('redraft');
    modes.add('current');
  }
  if (row?.valueBridge.dynastyValue !== null) modes.add('dynasty');
  if (row?.valueBridge.valueContext === 'dynasty-premium') modes.add('market');
  return Array.from(modes);
}

function getMatchupActualsRead(row?: PlayerProjectionContextRow | null): {
  evidence: string | null;
  missingEvidence: string | null;
  warning: string | null;
  cap: number | null;
  capReason: string | null;
} {
  const matchup = row?.matchupActuals;
  if (!matchup) {
    return {
      evidence: null,
      missingEvidence: 'No historical matchup-actuals archetype is attached to this projection row.',
      warning: null,
      cap: null,
      capReason: null,
    };
  }

  if (matchup.recommendation === 'blocked') {
    return {
      evidence: null,
      missingEvidence: matchup.reason,
      warning: null,
      cap: 52,
      capReason: 'Historical matchup sample too thin',
    };
  }

  if (matchup.recommendation === 'caution') {
    return {
      evidence: `Historical matchup actuals are available for ${matchup.sampleSize} similar ${matchup.position}/${matchup.roleBucket}/${matchup.opponentStrengthBucket}/${matchup.homeAway} rows.`,
      missingEvidence: null,
      warning: matchup.reason,
      cap: Math.max(44, Math.min(66, matchup.confidence)),
      capReason: 'Historical matchup caution',
    };
  }

  if (matchup.recommendation === 'boost') {
    return {
      evidence: `Historical matchup actuals support this read: ${matchup.sampleSize} similar ${matchup.position}/${matchup.roleBucket}/${matchup.opponentStrengthBucket}/${matchup.homeAway} rows, ${matchup.beatProjectionRate ?? 'n/a'}% beat projection.`,
      missingEvidence: null,
      warning: null,
      cap: null,
      capReason: null,
    };
  }

  return {
    evidence: `Historical matchup actuals are neutral across ${matchup.sampleSize} similar ${matchup.position}/${matchup.roleBucket}/${matchup.opponentStrengthBucket}/${matchup.homeAway} rows.`,
    missingEvidence: null,
    warning: null,
    cap: null,
    capReason: null,
  };
}

function getPlayerOpponentHistoryRead(row?: PlayerProjectionContextRow | null): {
  evidence: string | null;
  warning: string | null;
  cap: number | null;
  capReason: string | null;
} {
  const history = row?.playerOpponentHistory;
  if (!history) return { evidence: null, warning: null, cap: null, capReason: null };

  const intro = `${history.playerName || row?.playerName || 'Player'} has ${history.sampleSize} career game${history.sampleSize === 1 ? '' : 's'} vs ${history.opponent}, averaging ${history.avgFantasyPoints ?? 'n/a'} fantasy points.`;
  if (history.recommendation === 'blocked') {
    return {
      evidence: `${intro} Direct opponent history is thin, so it is a receipt only.`,
      warning: history.reason,
      cap: 72,
      capReason: 'Thin player-opponent history',
    };
  }
  if (history.recommendation === 'caution') {
    return {
      evidence: intro,
      warning: history.reason,
      cap: Math.max(48, Math.min(66, history.confidence)),
      capReason: 'Player-opponent history caution',
    };
  }
  if (history.recommendation === 'boost') {
    return {
      evidence: `${intro} He has beaten projection in ${history.beatProjectionRate ?? 'n/a'}% of those games.`,
      warning: null,
      cap: null,
      capReason: null,
    };
  }
  return {
    evidence: `${intro} Direct opponent history is neutral, so broader matchup and projection signals still lead.`,
    warning: null,
    cap: null,
    capReason: null,
  };
}

export function buildProjectionReadoutPolicy(input: ProjectionReadoutPolicyInput): ProjectionReadoutPolicyResult {
  const now = input.now || new Date();
  const projectionSnapshot = input.projectionSnapshot || null;
  const projectionRow = findProjectionRow(input.row, projectionSnapshot);
  const sourcePolicy = input.sourcePolicy || {};
  const projectionDisplayAllowed = sourcePolicy.projectionDisplayAllowed !== false;
  const providerAttributionAllowed = sourcePolicy.providerAttributionAllowed === true;
  const providerNameAllowed = projectionRow?.source
    ? sourcePolicy.providerNamesAllowed?.[projectionRow.source] === true
    : false;
  const canNameProvider = projectionRow?.source === 'internal' && providerAttributionAllowed && providerNameAllowed;
  const canUseProjectionClaim = Boolean(input.row && projectionRow && projectionDisplayAllowed && projectionRow.projectedFantasyPoints !== null);
  const evidenceKind = getEvidenceKind({
    row: input.row,
    projectionRow,
    projectionDisplayAllowed,
    canNameProvider,
  });

  let confidenceCap = 100;
  let confidenceCapReason: string | null = null;
  const hardBlockers: string[] = [];
  const softWarnings: string[] = [];
  const missingEvidence: string[] = [];
  const evidence: string[] = [];

  if (!input.row || !projectionSnapshot || !projectionRow) {
    missingEvidence.push('No normalized projection snapshot row is available.');
  }

  if (!projectionDisplayAllowed && projectionRow) {
    hardBlockers.push('Projection source is not approved for public display.');
  }

  if (projectionSnapshot?.sourceError) {
    softWarnings.push(`Projection source error: ${projectionSnapshot.sourceError}.`);
    const capped = capConfidence(confidenceCap, confidenceCapReason, 48, 'Projection source error');
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if (projectionSnapshot?.staleReason) {
    softWarnings.push(`Projection snapshot is stale: ${projectionSnapshot.staleReason}.`);
    const capped = capConfidence(confidenceCap, confidenceCapReason, 58, 'Projection snapshot stale');
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  const projectionAge =
    dateAgeHours(projectionSnapshot?.providerUpdatedAt || null, now)
    ?? dateAgeHours(projectionSnapshot?.publishedAt || null, now)
    ?? dateAgeHours(projectionSnapshot?.fetchedAt || null, now);
  if (projectionSnapshot && projectionAge !== null && projectionAge > projectionFreshnessHours(projectionSnapshot.projectionType)) {
    softWarnings.push(`${displaySourceName(projectionSnapshot.source, canNameProvider)} snapshot is ${projectionAge} hours old.`);
    const capped = capConfidence(confidenceCap, confidenceCapReason, 62, 'Projection source freshness');
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if (projectionRow && projectionRow.identityStatus !== 'matched') {
    softWarnings.push(`Player identity is ${projectionRow.identityStatus}; do not write high-conviction copy.`);
    const capped = capConfidence(confidenceCap, confidenceCapReason, 54, 'Projection identity confidence');
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if (projectionRow?.matchConfidence !== null && projectionRow?.matchConfidence !== undefined && projectionRow.matchConfidence < 85) {
    softWarnings.push(`Player identity match confidence is ${projectionRow.matchConfidence}%.`);
    const capped = capConfidence(confidenceCap, confidenceCapReason, 58, 'Projection identity confidence');
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  const sourceCount = input.sourceCount ?? projectionRow?.expertCount ?? null;
  if (sourceCount !== null && Number(sourceCount) <= 1) {
    softWarnings.push('Projection source coverage is thin.');
    const capped = capConfidence(confidenceCap, confidenceCapReason, 60, 'Thin projection coverage');
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if (projectionRow?.injuryStatus && isUnresolvedInjury(projectionRow.injuryStatus)) {
    softWarnings.push(`Injury status is unresolved: ${projectionRow.injuryStatus}.`);
    const capped = capConfidence(confidenceCap, confidenceCapReason, 64, 'Unresolved injury status');
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  if (input.row && input.row.projectionType === 'weekly' && !input.row.schedule.opponent) {
    missingEvidence.push(input.row.schedule.note || 'Weekly projection is missing a matched schedule opponent.');
    const capped = capConfidence(confidenceCap, confidenceCapReason, 56, 'Missing schedule data');
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  const opportunityRunwayText = getOpportunityRunwayText(input.row);
  if (opportunityRunwayText) evidence.push(opportunityRunwayText);

  const matchupActualsRead = getMatchupActualsRead(input.row);
  if (matchupActualsRead.evidence) evidence.push(matchupActualsRead.evidence);
  if (matchupActualsRead.missingEvidence && input.row?.projectionType === 'weekly') {
    missingEvidence.push(matchupActualsRead.missingEvidence);
  }
  if (matchupActualsRead.warning) softWarnings.push(matchupActualsRead.warning);
  if (matchupActualsRead.cap && matchupActualsRead.capReason) {
    const capped = capConfidence(confidenceCap, confidenceCapReason, matchupActualsRead.cap, matchupActualsRead.capReason);
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  const playerOpponentHistoryRead = getPlayerOpponentHistoryRead(input.row);
  if (playerOpponentHistoryRead.evidence) evidence.push(playerOpponentHistoryRead.evidence);
  if (playerOpponentHistoryRead.warning) softWarnings.push(playerOpponentHistoryRead.warning);
  if (playerOpponentHistoryRead.cap && playerOpponentHistoryRead.capReason) {
    const capped = capConfidence(confidenceCap, confidenceCapReason, playerOpponentHistoryRead.cap, playerOpponentHistoryRead.capReason);
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  const positiveRunway = isPositiveRunway([
    input.row?.valueBridge.opportunityRunway,
    input.row?.valueBridge.draftCapitalSignal,
    input.row?.valueBridge.longTermRoleSecurity,
  ].filter(Boolean).join(' '));
  const swingWarning = getProjectionSwingWarning({
    row: input.row,
    previousProjectedFantasyPoints: input.previousProjectedFantasyPoints,
    hasPositiveRunway: positiveRunway,
    negativeRole: isNegativeRole(input),
  });
  if (swingWarning.warning) {
    softWarnings.push(swingWarning.warning);
    if (swingWarning.cap && swingWarning.capReason) {
      const capped = capConfidence(confidenceCap, confidenceCapReason, swingWarning.cap, swingWarning.capReason);
      confidenceCap = capped.cap;
      confidenceCapReason = capped.reason;
    }
  }

  const currentProjection = Number(input.row?.projectedFantasyPoints);
  const previousProjection = Number(input.previousProjectedFantasyPoints);
  if (
    positiveRunway
    && isNegativeRole(input)
    && Number.isFinite(currentProjection)
    && Number.isFinite(previousProjection)
    && currentProjection < previousProjection * 0.8
  ) {
    softWarnings.push('Draft capital or contract runway is not enough by itself because projection, usage, injury, or depth-chart signals are deteriorating.');
    const capped = capConfidence(confidenceCap, confidenceCapReason, 62, 'Draft-capital guardrail');
    confidenceCap = capped.cap;
    confidenceCapReason = capped.reason;
  }

  const evidenceLanguage = getEvidenceLanguage({
    row: input.row,
    projectionSnapshot,
    evidenceKind,
    canNameProvider,
  });
  if (input.row && (canUseProjectionClaim || input.row.schedule.opponent || input.row.valueBridge.dynastyValue !== null)) {
    evidence.unshift(evidenceLanguage);
  }

  const trace = getSourceTrace({
    row: input.row,
    projectionSnapshot,
    scheduleSnapshot: input.scheduleSnapshot || null,
    projectionRow,
    now,
    canNameProvider,
  });
  const sourceTraceText = getSourceTraceText(trace);
  const fallbackCopy = canUseProjectionClaim
    ? null
    : 'Projection data is unavailable or not approved here, so this read is using schedule/value context only and should avoid weekly-points language.';

  const evidenceRead = evaluateAIEvidence({
    surface: input.surface,
    action: input.action,
    leagueValueMode: input.leagueValueMode,
    baseScore: input.baseScore ?? (canUseProjectionClaim ? 68 : input.row ? 48 : 0),
    evidence,
    missingEvidence: [
      ...missingEvidence,
      ...(!canUseProjectionClaim ? [fallbackCopy] : []),
    ].filter((item): item is string => Boolean(item)),
    sourceTrace: trace,
    signalModes: getSignalModes(input.row, canUseProjectionClaim),
    confidenceCap,
    confidenceCapReason,
    player: {
      name: input.row?.playerName,
      position: input.row?.position,
      team: input.row?.team,
      injuryStatus: input.row?.valueBridge.injuryStatus || projectionRow?.injuryStatus || null,
      weeklyProjectionStatus: input.row?.schedule.homeAway === 'bye' ? 'bye' : null,
      hasByeWeek: input.row?.schedule.homeAway === 'bye',
      isGameLocked: /in_progress|live|final|closed|complete/i.test(input.row?.schedule.gameStatus || ''),
      value: input.leagueValueMode === 'redraft'
        ? input.row?.valueBridge.redraftValue
        : input.row?.valueBridge.dynastyValue,
      sourceCount: sourceCount ?? undefined,
      hasCurrentSeasonValue: canUseProjectionClaim || Boolean(input.row?.valueBridge.redraftValue),
      hasDynastyValue: Boolean(input.row?.valueBridge.dynastyValue),
    },
    schedule: {
      hasScheduleData: Boolean(input.row?.schedule.opponent),
      missingReason: input.row?.schedule.note,
    },
    requiresActiveTeam: input.action === 'pickup' || input.action === 'stash' || input.action === 'stream' || input.action === 'start',
    requiresCurrentSeasonEvidence: input.leagueValueMode === 'redraft',
  });

  return {
    evidenceKind,
    evidenceLanguage,
    canUseProjectionClaim,
    canNameProvider,
    hardBlockers: uniqueTexts([...hardBlockers, ...evidenceRead.hardBlockers]),
    softWarnings: uniqueTexts([...softWarnings, ...evidenceRead.softPenalties.map((penalty) => penalty.label)]),
    confidenceCap: evidenceRead.confidenceCap,
    confidenceCapReason: evidenceRead.confidenceCapReason,
    sourceTraceText,
    fallbackCopy,
    opportunityRunwayText,
    whyThisFired: evidenceRead.whyThisFired,
    evidenceRead,
  };
}
