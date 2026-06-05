export type CalibrationFallbackScope =
  | 'exact-manager'
  | 'exact-league'
  | 'manager-archetype'
  | 'league-sharpness'
  | 'format-waiver-cohort'
  | 'generic-baseline';

export type CalibrationFallbackInput = {
  managerId?: string | null;
  managerName?: string | null;
  leagueId?: string | null;
  managerArchetype?: string | null;
  leagueSharpness?: string | null;
  leagueFormat?: 'redraft' | 'dynasty' | 'keeper' | 'unknown' | string | null;
  waiverMode?: 'faab' | 'priority' | 'unknown' | string | null;
  qbFormat?: 'one_qb' | 'superflex' | 'sf' | 'unknown' | string | null;
  teamCount?: number | null;
  scoring?: string | null;
  lineupFormat?: string | null;
  activityLevel?: 'quiet' | 'normal' | 'active' | 'unknown' | string | null;
};

export type CalibrationFallbackCandidate = {
  scope: CalibrationFallbackScope;
  key: string;
  label: string;
  minSamples: number;
  reason: string;
};

export type CalibrationFallbackSelection = {
  selected: CalibrationFallbackCandidate;
  sampleCount: number;
  fallbackUsed: boolean;
  rejected: Array<CalibrationFallbackCandidate & { sampleCount: number }>;
};

const DEFAULT_MIN_SAMPLES_BY_SCOPE: Record<CalibrationFallbackScope, number> = {
  'exact-manager': 12,
  'exact-league': 24,
  'manager-archetype': 48,
  'league-sharpness': 72,
  'format-waiver-cohort': 96,
  'generic-baseline': 0,
};

function normalize(value: unknown, fallback = 'unknown'): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || fallback;
}

function normalizeQbFormat(value: unknown): string {
  const normalized = normalize(value);
  if (normalized === 'sf' || normalized === 'super_flex' || normalized === 'superflex') return 'superflex';
  if (normalized === '1qb' || normalized === 'one-qb' || normalized === 'one_qb') return 'one_qb';
  return normalized;
}

function getTeamCountBucket(teamCount?: number | null): string {
  if (!Number.isFinite(teamCount || NaN) || !teamCount) return 'teams:unknown';
  if (teamCount <= 10) return 'teams:small';
  if (teamCount <= 12) return 'teams:standard';
  return 'teams:deep';
}

function compactKey(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join('|');
}

function candidate(
  scope: CalibrationFallbackScope,
  key: string,
  label: string,
  reason: string,
  minSamples = DEFAULT_MIN_SAMPLES_BY_SCOPE[scope]
): CalibrationFallbackCandidate {
  return { scope, key, label, reason, minSamples };
}

export function buildLeagueCohortCalibrationFallbackCandidates(
  input: CalibrationFallbackInput
): CalibrationFallbackCandidate[] {
  const managerKey = normalize(input.managerId || input.managerName);
  const leagueKey = normalize(input.leagueId);
  const managerArchetype = normalize(input.managerArchetype);
  const leagueSharpness = normalize(input.leagueSharpness);
  const leagueFormat = normalize(input.leagueFormat);
  const waiverMode = normalize(input.waiverMode);
  const qbFormat = normalizeQbFormat(input.qbFormat);
  const teamBucket = getTeamCountBucket(input.teamCount);
  const scoring = normalize(input.scoring);
  const lineup = normalize(input.lineupFormat);
  const activity = normalize(input.activityLevel);

  return [
    candidate(
      'exact-manager',
      compactKey(['manager', managerKey, 'league', leagueKey]),
      'Exact manager in exact league',
      'Use the manager history inside this league first when enough outcomes exist.'
    ),
    candidate(
      'exact-league',
      compactKey(['league', leagueKey]),
      'Exact league',
      'Use league-level behavior before broader cohorts when manager samples are thin.'
    ),
    candidate(
      'manager-archetype',
      compactKey(['manager-archetype', managerArchetype, 'format', leagueFormat]),
      'Manager archetype',
      'Use similar manager behavior before format-wide assumptions.'
    ),
    candidate(
      'league-sharpness',
      compactKey(['sharpness', leagueSharpness, 'activity', activity, 'format', leagueFormat]),
      'League sharpness cohort',
      'Use similar league competitiveness and activity when exact league history is thin.'
    ),
    candidate(
      'format-waiver-cohort',
      compactKey([
        'format',
        leagueFormat,
        'waiver',
        waiverMode,
        'qb',
        qbFormat,
        teamBucket,
        'scoring',
        scoring,
        'lineup',
        lineup,
        'activity',
        activity,
      ]),
      'Format and waiver cohort',
      'Use similar-league cohorts bucketed by waiver mode, format, team count, scoring, lineup, and activity.'
    ),
    candidate(
      'generic-baseline',
      'generic-baseline',
      'Generic baseline',
      'Use only when all exact and similar-league samples are too thin.'
    ),
  ];
}

export function selectCalibrationFallbackCandidate(
  candidates: CalibrationFallbackCandidate[],
  sampleCountByKey: Record<string, number | undefined>,
  minSamplesByScope: Partial<Record<CalibrationFallbackScope, number>> = {}
): CalibrationFallbackSelection {
  const rejected: CalibrationFallbackSelection['rejected'] = [];

  for (const baseCandidate of candidates) {
    const candidateMinSamples = minSamplesByScope[baseCandidate.scope] ?? baseCandidate.minSamples;
    const row = { ...baseCandidate, minSamples: candidateMinSamples };
    const sampleCount = Math.max(0, Math.floor(Number(sampleCountByKey[row.key]) || 0));
    if (sampleCount >= candidateMinSamples) {
      return {
        selected: row,
        sampleCount,
        fallbackUsed: rejected.length > 0,
        rejected,
      };
    }
    rejected.push({ ...row, sampleCount });
  }

  const generic = candidates[candidates.length - 1] || candidate(
    'generic-baseline',
    'generic-baseline',
    'Generic baseline',
    'Use only when all exact and similar-league samples are too thin.'
  );

  return {
    selected: generic,
    sampleCount: Math.max(0, Math.floor(Number(sampleCountByKey[generic.key]) || 0)),
    fallbackUsed: true,
    rejected,
  };
}
