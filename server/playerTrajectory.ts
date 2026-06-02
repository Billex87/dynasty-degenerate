import type { PlayerCohortEvidenceGrade, PlayerDetails, PlayerSituationDeltaLabel } from '../shared/types';

export type PlayerTrajectoryLabel =
  | 'rising-role'
  | 'post-hype-window'
  | 'market-trap'
  | 'peak-risk'
  | 'stable-hold'
  | 'source-limited';

export type PlayerTrajectoryTone = 'good' | 'info' | 'warn' | 'danger' | 'neutral';

export interface PlayerTrajectorySignal {
  playerId: string;
  name: string;
  position: string;
  label: PlayerTrajectoryLabel;
  title: string;
  action: 'buy' | 'hold' | 'sell' | 'monitor' | 'avoid';
  tone: PlayerTrajectoryTone;
  confidence: number;
  confidenceGrade: PlayerCohortEvidenceGrade;
  summary: string;
  readout: PlayerTrajectoryReadout;
  evidence: string[];
  missingSignals: string[];
  cautionFlags: string[];
  actionProof: {
    eligible: boolean;
    blockers: string[];
  };
  scoreBreakdown: {
    marketMomentum: number | null;
    roleMomentum: number | null;
    ageRisk: number | null;
    situationScore: number | null;
    cohortScore: number | null;
    sourceScore: number | null;
  };
  trace: string[];
}

export interface PlayerTrajectoryReadout {
  decision: 'Do this' | "Don't force it" | 'Do not do this' | 'Insufficient evidence';
  status: string;
  headline: string;
  detail: string;
  whyThisFired: string[];
  whatChangesThis: string[];
  receipts: string[];
}

const SUPPORTED_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

const AGE_RISK_START: Record<string, number> = {
  QB: 33,
  RB: 26,
  WR: 29,
  TE: 30,
};

const LABEL_META: Record<PlayerTrajectoryLabel, {
  title: string;
  action: PlayerTrajectorySignal['action'];
  tone: PlayerTrajectoryTone;
}> = {
  'rising-role': {
    title: 'Rising Role',
    action: 'buy',
    tone: 'good',
  },
  'post-hype-window': {
    title: 'Post-Hype Window',
    action: 'monitor',
    tone: 'info',
  },
  'market-trap': {
    title: 'Market Trap',
    action: 'avoid',
    tone: 'danger',
  },
  'peak-risk': {
    title: 'Peak Risk',
    action: 'sell',
    tone: 'warn',
  },
  'stable-hold': {
    title: 'Stable Hold',
    action: 'hold',
    tone: 'neutral',
  },
  'source-limited': {
    title: 'Source Limited',
    action: 'monitor',
    tone: 'warn',
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pct(value: unknown): number | null {
  const parsed = numeric(value);
  if (parsed === null) return null;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function round(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function sourceCount(details: PlayerDetails): number {
  return Math.max(
    details.valueProfile?.sources?.length || 0,
    [
      details.valueProfile?.marketKtc,
      details.valueProfile?.flockFantasy,
      details.valueProfile?.fantasyProsDynasty,
      details.valueProfile?.fantasyCalcDynasty,
      details.valueProfile?.fantasyProsSeasonValue,
      details.valueProfile?.fantasyCalcRedraft,
      details.valueProfile?.dynastyNerds,
      details.valueProfile?.fantasyNerds,
      details.valueProfile?.dynastyProcess,
    ].filter((value) => numeric(value) !== null && Number(value) > 0).length,
  );
}

function valueDeltaPct(details: PlayerDetails): number | null {
  return numeric(details.valueTimeline?.summary?.deltaPct);
}

function valueDelta(details: PlayerDetails): number | null {
  return numeric(details.valueTimeline?.summary?.delta);
}

function roleMomentum(details: PlayerDetails): number | null {
  const usage = details.usageTrend;
  const delta = details.rosterRoom?.opportunityDelta;
  const situation = details.playerSituationDelta;
  const pieces: number[] = [];

  if (usage) {
    let usageScore = 50;
    if (usage.targetTrend === 'up') usageScore += 18;
    if (usage.carryTrend === 'up') usageScore += 18;
    if (usage.targetTrend === 'down') usageScore -= 18;
    if (usage.carryTrend === 'down') usageScore -= 18;

    const rolling = usage.rollingWindows?.find((window) => window.games === 3) || usage.rollingWindows?.[0];
    const targetDelta = numeric(rolling?.targetDeltaPerGame) || 0;
    const carryDelta = numeric(rolling?.carryDeltaPerGame) || 0;
    usageScore += clamp(targetDelta * 7 + carryDelta * 4, -24, 24);

    const targetShare = pct(usage.avgTargetShare);
    const snapPct = pct(usage.avgOffenseSnapPct);
    if (targetShare !== null && targetShare >= 22) usageScore += 8;
    if (snapPct !== null && snapPct >= 72) usageScore += 6;
    pieces.push(round(usageScore));
  }

  if (delta) {
    pieces.push(round(50 + delta.netOpportunityScore * 0.45 + (delta.incumbentPromotionScore || 0) * 0.25));
  }

  if (situation) {
    const direction = situation.action === 'buy' || situation.action === 'stash'
      ? 12
      : situation.action === 'sell' || situation.action === 'avoid'
      ? -14
      : 0;
    pieces.push(round(situation.score + direction));
  }

  if (!pieces.length) return null;
  return round(pieces.reduce((sum, value) => sum + value, 0) / pieces.length);
}

function ageRisk(details: PlayerDetails, position: string): number | null {
  const age = numeric(details.age);
  const riskStart = AGE_RISK_START[position];
  if (age === null || riskStart === undefined) return null;
  return round(20 + Math.max(0, age - riskStart) * 18);
}

function marketMomentum(details: PlayerDetails): number | null {
  const deltaPct = valueDeltaPct(details);
  if (deltaPct === null) return null;
  return round(50 + deltaPct * 1.2);
}

function sourceScore(details: PlayerDetails): number {
  const count = sourceCount(details);
  const timeline = details.valueTimeline;
  const pointCount = timeline?.allTimePointCount ?? timeline?.points?.length ?? 0;
  return round(22 + Math.min(38, count * 12) + Math.min(30, pointCount / 8) - (timeline?.summary?.sourceSetChanged ? 10 : 0));
}

function cohortScore(details: PlayerDetails): number | null {
  const cohort = details.playerCohort;
  if (!cohort) return null;
  const bucketBonus = cohort.outcomeBucket === 'breakout' || cohort.outcomeBucket === 'market-under-production'
    ? 12
    : cohort.outcomeBucket === 'fade-risk' || cohort.outcomeBucket === 'injury-risk' || cohort.outcomeBucket === 'market-over-production'
    ? -12
    : 0;
  return round(cohort.confidence + bucketBonus);
}

function hasSituationLabel(details: PlayerDetails, labels: PlayerSituationDeltaLabel[]): boolean {
  const current = details.playerSituationDelta?.labels || [];
  return labels.some((label) => current.includes(label));
}

function collectMissingSignals(details: PlayerDetails): string[] {
  const missing: string[] = [];
  if (!details.valueTimeline) missing.push('stored value timeline');
  if (!details.usageTrend) missing.push('usage trend');
  if (!details.playerCohort) missing.push('cohort profile');
  if (!details.playerSituationDelta) missing.push('situation delta');
  if (!details.rosterRoom?.opportunityDelta) missing.push('quality-weighted roster-room delta');
  return missing;
}

function collectCautionFlags(details: PlayerDetails, scores: PlayerTrajectorySignal['scoreBreakdown']): string[] {
  const flags: string[] = [];
  if (details.valueTimeline?.summary?.sourceSetChanged) flags.push('value source mix changed');
  if (sourceCount(details) < 2) flags.push('thin value source coverage');
  if (details.playerCohort?.calibration.cautionFlags.length) {
    flags.push(...details.playerCohort.calibration.cautionFlags.slice(0, 3));
  }
  if (details.playerSituationDelta?.cautionFlags.length) {
    flags.push(...details.playerSituationDelta.cautionFlags.slice(0, 3));
  }
  if ((scores.ageRisk || 0) >= 74) flags.push('age curve risk');
  if (details.injuryStatus && !/healthy|active/i.test(String(details.injuryStatus))) flags.push(`current injury status: ${details.injuryStatus}`);
  return Array.from(new Set(flags));
}

function buildActionProof(
  details: PlayerDetails,
  missingSignals: string[],
  cautionFlags: string[]
): PlayerTrajectorySignal['actionProof'] {
  const blockers: string[] = [];
  if (missingSignals.length) {
    blockers.push(`Missing trajectory inputs: ${missingSignals.slice(0, 3).join(', ')}`);
  }
  if (cautionFlags.length) {
    blockers.push(`Resolve caution flags: ${cautionFlags.slice(0, 3).join(', ')}`);
  }
  if (details.playerCohort?.calibration.strongReadEligible !== true) {
    blockers.push('Cohort calibration is not strong-read eligible');
  }
  const situationConfidence = numeric(details.playerSituationDelta?.confidence) || 0;
  if (situationConfidence < 65) {
    blockers.push('Situation-delta confidence is below the action threshold');
  }

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}

function gradeForConfidence(confidence: number, missingSignals: string[]): PlayerCohortEvidenceGrade {
  if (missingSignals.includes('stored value timeline') || missingSignals.includes('cohort profile')) return 'blocked';
  if (confidence >= 76 && missingSignals.length <= 1) return 'strong';
  if (confidence >= 58 && missingSignals.length <= 3) return 'usable';
  return 'thin';
}

function classify(details: PlayerDetails, scores: PlayerTrajectorySignal['scoreBreakdown'], missingSignals: string[]): PlayerTrajectoryLabel {
  const market = scores.marketMomentum;
  const role = scores.roleMomentum;
  const age = scores.ageRisk;
  const cohort = details.playerCohort;
  const situationScore = scores.situationScore;
  const source = scores.sourceScore || 0;
  const deltaPct = valueDeltaPct(details);

  if (source < 46 || missingSignals.includes('stored value timeline') || missingSignals.includes('cohort profile')) {
    return 'source-limited';
  }

  if (
    (role || 0) >= 66
    && (market === null || market <= 62)
    && (cohort?.outcomeBucket === 'breakout' || cohort?.outcomeBucket === 'market-under-production' || hasSituationLabel(details, ['role-boost', 'vacated-opportunity']))
  ) {
    return 'rising-role';
  }

  if (
    (role || 0) >= 58
    && (deltaPct !== null && deltaPct <= -8)
    && (cohort?.draftCapital?.opportunityWindow === 'protected-runway' || hasSituationLabel(details, ['draft-capital-patience']))
  ) {
    return 'post-hype-window';
  }

  if (
    (market || 0) >= 66
    && ((role !== null && role <= 46) || cohort?.outcomeBucket === 'market-over-production' || hasSituationLabel(details, ['role-threat', 'crowded-room']))
  ) {
    return 'market-trap';
  }

  if (
    (age || 0) >= 66
    && ((situationScore !== null && situationScore <= 48) || cohort?.outcomeBucket === 'fade-risk' || cohort?.outcomeBucket === 'injury-risk')
  ) {
    return 'peak-risk';
  }

  return 'stable-hold';
}

function buildEvidence(details: PlayerDetails, scores: PlayerTrajectorySignal['scoreBreakdown']): string[] {
  const evidence: string[] = [];
  const delta = valueDelta(details);
  const deltaPct = valueDeltaPct(details);
  if (delta !== null || deltaPct !== null) {
    const pctText = deltaPct !== null ? `${deltaPct >= 0 ? '+' : ''}${Math.round(deltaPct)}%` : 'unknown %';
    const rawText = delta !== null ? `${delta >= 0 ? '+' : ''}${Math.round(delta)} value` : 'unknown value';
    evidence.push(`Market movement: ${rawText} (${pctText}) in the selected value window.`);
  }
  if (details.usageTrend?.note) evidence.push(`Usage: ${details.usageTrend.note}`);
  if (details.playerSituationDelta?.summary) evidence.push(`Situation: ${details.playerSituationDelta.summary}`);
  if (details.playerCohort) {
    evidence.push(`Cohort: ${details.playerCohort.outcomeBucket.replace(/-/g, ' ')} with ${details.playerCohort.confidence}% cohort confidence.`);
  }
  if (details.valueTimeline?.extremes?.high) {
    evidence.push(`All-time high: ${details.valueTimeline.extremes.high.value} on ${details.valueTimeline.extremes.high.date}.`);
  }
  if ((scores.ageRisk || 0) >= 58 && details.age) {
    evidence.push(`Age curve: ${details.age} at ${String(details.position || '').toUpperCase()} creates ${scores.ageRisk}% age-risk pressure.`);
  }
  return evidence.slice(0, 6);
}

function buildSummary(name: string, label: PlayerTrajectoryLabel, confidence: number): string {
  const title = LABEL_META[label].title.toLowerCase();
  if (label === 'source-limited') {
    return `${name} needs more stored value, cohort, and role evidence before a strong trajectory read.`;
  }
  return `${name} grades as a ${title} at ${confidence}% confidence.`;
}

function decisionForSignal(
  label: PlayerTrajectoryLabel,
  confidence: number,
  confidenceGrade: PlayerCohortEvidenceGrade,
  actionProof: PlayerTrajectorySignal['actionProof']
): PlayerTrajectoryReadout['decision'] {
  if (confidenceGrade === 'blocked' || label === 'source-limited' || confidence < 46) {
    return 'Insufficient evidence';
  }
  const hasActionProof = actionProof.eligible;
  if (label === 'market-trap' || label === 'peak-risk') {
    return hasActionProof && confidence >= 64 ? 'Do not do this' : "Don't force it";
  }
  if (label === 'rising-role' || label === 'post-hype-window') {
    return hasActionProof && confidence >= 68 ? 'Do this' : "Don't force it";
  }
  return "Don't force it";
}

function detailForSignal(signal: Omit<PlayerTrajectorySignal, 'readout' | 'trace'>): string {
  switch (signal.label) {
    case 'rising-role':
      return `Treat ${signal.name} as a role-growth target before the market fully prices it in.`;
    case 'post-hype-window':
      return `Monitor or buy carefully: the market has cooled, but runway and role evidence still support patience.`;
    case 'market-trap':
      return `Do not pay the headline market price unless fresh role evidence improves.`;
    case 'peak-risk':
      return `Price in age, availability, and role-cliff risk before treating this as a stable asset.`;
    case 'stable-hold':
      return `Hold the current valuation unless stronger role, market, or injury evidence appears.`;
    case 'source-limited':
      return `Keep the read conservative until value history, cohort, and role inputs are attached.`;
  }
}

function buildWhatChangesThis(
  signal: Omit<PlayerTrajectorySignal, 'readout' | 'trace'>
): string[] {
  const changes: string[] = [];

  if (signal.missingSignals.length) {
    changes.push(`Add missing inputs: ${signal.missingSignals.slice(0, 3).join(', ')}.`);
  }
  if (signal.label === 'rising-role' || signal.label === 'post-hype-window') {
    changes.push('Role signal flips if usage drops, a premium same-position threat arrives, or the market jumps without production support.');
  }
  if (signal.label === 'market-trap' || signal.label === 'peak-risk') {
    changes.push('Risk softens if usage rebounds, situation score improves, or source-backed market value falls into a cheaper range.');
  }
  if (signal.cautionFlags.length) {
    changes.push(`Resolve caution flags: ${signal.cautionFlags.slice(0, 2).join(', ')}.`);
  }
  if (!changes.length) {
    changes.push('A material value move, new usage trend, injury update, or roster-room change can update this read.');
  }

  return changes.slice(0, 4);
}

function buildReceipts(signal: Omit<PlayerTrajectorySignal, 'readout' | 'trace'>): string[] {
  const score = signal.scoreBreakdown;
  return [
    `Trajectory: ${signal.title}`,
    `Confidence: ${signal.confidence}% (${signal.confidenceGrade})`,
    score.marketMomentum !== null ? `Market momentum: ${score.marketMomentum}` : null,
    score.roleMomentum !== null ? `Role momentum: ${score.roleMomentum}` : null,
    score.situationScore !== null ? `Situation score: ${score.situationScore}` : null,
    score.cohortScore !== null ? `Cohort score: ${score.cohortScore}` : null,
    score.ageRisk !== null ? `Age risk: ${score.ageRisk}` : null,
    score.sourceScore !== null ? `Source score: ${score.sourceScore}` : null,
  ].filter((value): value is string => Boolean(value));
}

function buildPlayerTrajectoryReadout(
  signal: Omit<PlayerTrajectorySignal, 'readout' | 'trace'>
): PlayerTrajectoryReadout {
  const decision = decisionForSignal(signal.label, signal.confidence, signal.confidenceGrade, signal.actionProof);
  const statusPrefix = decision === 'Do this'
    ? 'Actionable'
    : decision === 'Do not do this'
    ? 'Risk'
    : decision === 'Insufficient evidence'
    ? 'Thin'
    : 'Watch';

  return {
    decision,
    status: `${statusPrefix} · ${signal.confidence}%`,
    headline: `${signal.title}: ${signal.name}`,
    detail: detailForSignal(signal),
    whyThisFired: signal.evidence.length
      ? signal.evidence.slice(0, 4)
      : [signal.summary],
    whatChangesThis: buildWhatChangesThis(signal),
    receipts: buildReceipts(signal),
  };
}

export function buildPlayerTrajectorySignal(details: PlayerDetails, playerId: string): PlayerTrajectorySignal | null {
  const position = String(details.position || '').toUpperCase();
  if (!SUPPORTED_POSITIONS.has(position)) return null;

  const scoreBreakdown = {
    marketMomentum: marketMomentum(details),
    roleMomentum: roleMomentum(details),
    ageRisk: ageRisk(details, position),
    situationScore: details.playerSituationDelta?.score ?? null,
    cohortScore: cohortScore(details),
    sourceScore: sourceScore(details),
  };
  const missingSignals = collectMissingSignals(details);
  const cautionFlags = collectCautionFlags(details, scoreBreakdown);
  const actionProof = buildActionProof(details, missingSignals, cautionFlags);
  const label = classify(details, scoreBreakdown, missingSignals);
  const meta = LABEL_META[label];
  const baseConfidence = round(
    24
    + (scoreBreakdown.sourceScore || 0) * 0.24
    + (details.playerCohort?.confidence || 0) * 0.22
    + (details.playerSituationDelta?.confidence || 0) * 0.18
    + Math.max(0, 28 - missingSignals.length * 7)
    - Math.min(14, cautionFlags.length * 2)
  );
  const confidence = label === 'source-limited'
    ? Math.min(baseConfidence, 44)
    : baseConfidence;
  const confidenceGrade = gradeForConfidence(confidence, missingSignals);
  const name = details.fullName || playerId;
  const evidence = buildEvidence(details, scoreBreakdown);
  const summary = buildSummary(name, label, confidence);
  const baseSignal = {
    playerId,
    name,
    position,
    label,
    title: meta.title,
    action: meta.action,
    tone: meta.tone,
    confidence,
    confidenceGrade,
    summary,
    evidence,
    missingSignals,
    cautionFlags,
    actionProof,
    scoreBreakdown,
  };
  const readout = buildPlayerTrajectoryReadout(baseSignal);

  return {
    ...baseSignal,
    readout,
    trace: [
      summary,
      `Readout: ${readout.decision} (${readout.status}).`,
      `Scores: market ${scoreBreakdown.marketMomentum ?? 'n/a'}, role ${scoreBreakdown.roleMomentum ?? 'n/a'}, situation ${scoreBreakdown.situationScore ?? 'n/a'}, cohort ${scoreBreakdown.cohortScore ?? 'n/a'}, age risk ${scoreBreakdown.ageRisk ?? 'n/a'}, source ${scoreBreakdown.sourceScore ?? 'n/a'}.`,
      missingSignals.length ? `Missing signals: ${missingSignals.join(', ')}.` : 'All first-pass trajectory inputs are present.',
      cautionFlags.length ? `Caution flags: ${cautionFlags.join(', ')}.` : 'No major trajectory caution flags detected.',
      actionProof.eligible ? 'Action proof: complete.' : `Action proof blocked: ${actionProof.blockers.join('; ')}.`,
    ],
  };
}

export function buildPlayerTrajectorySignals(input: {
  playerDetailsById: Record<string, PlayerDetails>;
}): Record<string, PlayerTrajectorySignal> {
  return Object.fromEntries(
    Object.entries(input.playerDetailsById || {})
      .map(([playerId, details]) => [playerId, buildPlayerTrajectorySignal(details, playerId)] as const)
      .filter((entry): entry is readonly [string, PlayerTrajectorySignal] => Boolean(entry[1])),
  );
}
