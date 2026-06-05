import type { DraftSharksSosProfile, DraftSharksWeeklySos } from './draftSharksSchedule';

export type ScheduleSourceDecisionAction =
  | 'stream'
  | 'target'
  | 'lean-target'
  | 'neutral'
  | 'lean-avoid'
  | 'avoid'
  | 'insufficient-data';

export type ScheduleSourceAgreement = 'draftsharks-only' | 'missing';

export type ScheduleSourceDecisionInput = {
  team: string;
  position: string;
  weekStart: number;
  weekEnd: number;
  draftSharksProfile?: DraftSharksSosProfile | null;
};

export type ScheduleSourceDecision = {
  team: string;
  position: string;
  weekStart: number;
  weekEnd: number;
  action: ScheduleSourceDecisionAction;
  agreement: ScheduleSourceAgreement;
  finalScore: number | null;
  draftSharksAverage: number | null;
  draftSharksWorst: number | null;
  confidence: number;
  confidenceCapReason: string | null;
  easyWeeks: number[];
  hardWeeks: number[];
  sourceTrace: string[];
  whyThisFired: string;
};

function round(value: number | null, digits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function normalizePosition(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z/]/g, '');
  if (normalized === 'DST' || normalized === 'D/ST') return 'DEF';
  return normalized || 'UNKNOWN';
}

function cleanTeam(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function average(values: number[]): number | null {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function actionFromScore(score: number | null, position: string): ScheduleSourceDecisionAction {
  if (score === null) return 'insufficient-data';
  const streamPosition = position === 'K' || position === 'DEF' || position === 'DST';
  if (score >= 12) return streamPosition ? 'stream' : 'target';
  if (score >= 5) return 'lean-target';
  if (score <= -12) return 'avoid';
  if (score <= -5) return 'lean-avoid';
  return 'neutral';
}

function getDraftSharksRows(input: ScheduleSourceDecisionInput): DraftSharksWeeklySos[] {
  const profile = input.draftSharksProfile;
  if (!profile) return [];
  return (profile.weeklyMatchups || [])
    .filter((row) => row.week >= input.weekStart && row.week <= input.weekEnd);
}

function buildSourceTrace(input: {
  draftSharksRows: DraftSharksWeeklySos[];
  draftSharksAverage: number | null;
  agreement: ScheduleSourceAgreement;
}): string[] {
  return [
    input.draftSharksRows.length
      ? `Stored schedule/SOS: ${input.draftSharksRows.length} weekly percentage row(s), avg ${input.draftSharksAverage}%. Used for action and confidence.`
      : 'Stored schedule/SOS: missing weekly percentage rows.',
    `Source context: ${input.agreement}. Stored schedule/SOS decision policy.`,
  ];
}

export function buildScheduleSourceDecision(input: ScheduleSourceDecisionInput): ScheduleSourceDecision {
  const position = normalizePosition(input.position);
  const draftSharksRows = getDraftSharksRows(input);
  const draftSharksAverage = average(draftSharksRows.map((row) => row.matchupPercent));
  const draftSharksWorst = draftSharksRows.length
    ? round(Math.min(...draftSharksRows.map((row) => row.matchupPercent)))
    : null;
  const agreement: ScheduleSourceAgreement = draftSharksAverage === null ? 'missing' : 'draftsharks-only';
  const finalScore = draftSharksAverage;
  const action = actionFromScore(draftSharksAverage, position);
  const confidence = draftSharksAverage !== null ? 82 : 0;
  const confidenceCapReason = draftSharksAverage === null ? 'Schedule/SOS missing' : null;
  const hardWeeks = draftSharksRows
    .filter((row) => row.matchupPercent <= -8)
    .map((row) => row.week);
  const easyWeeks = draftSharksRows
    .filter((row) => row.matchupPercent >= 8)
    .map((row) => row.week);
  const sourceTrace = buildSourceTrace({
    draftSharksRows,
    draftSharksAverage,
    agreement,
  });

  return {
    team: cleanTeam(input.team),
    position,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    action,
    agreement,
    finalScore,
    draftSharksAverage,
    draftSharksWorst,
    confidence,
    confidenceCapReason,
    easyWeeks,
    hardWeeks,
    sourceTrace,
    whyThisFired: draftSharksAverage === null
      ? 'Insufficient schedule/SOS evidence.'
      : `Schedule/SOS average is ${draftSharksAverage}% for Weeks ${input.weekStart}-${input.weekEnd}, so the schedule action is ${action}.`,
  };
}
