export type WaiverPriorityBurnCost = 'high' | 'medium' | 'low' | 'unknown';
export type WaiverPriorityCalibrationStatus = 'ready' | 'partial' | 'missing';

export type WaiverPriorityRosterInput = {
  rosterId?: string | number | null;
  manager?: string | null;
  ownerId?: string | null;
  settings?: {
    waiver_position?: string | number | null;
    waiverBudgetUsed?: string | number | null;
    waiver_budget_used?: string | number | null;
    totalMoves?: string | number | null;
    total_moves?: string | number | null;
    wins?: string | number | null;
    losses?: string | number | null;
    ties?: string | number | null;
    fpts?: string | number | null;
    fpts_decimal?: string | number | null;
  } | null;
};

export type WaiverPriorityCalibrationRow = {
  rosterId: string;
  manager: string;
  waiverPosition: number | null;
  priorityPercentile: number | null;
  priorityBurnCost: WaiverPriorityBurnCost;
  standingsRank: number | null;
  pointsFor: number | null;
  totalMoves: number | null;
  activityLevel: 'active' | 'normal' | 'quiet' | 'unknown';
  confidence: number;
  confidenceCapReason: string;
  cohortKey: string;
  reasons: string[];
};

export type WaiverPriorityCalibrationSummary = {
  status: WaiverPriorityCalibrationStatus;
  rowCount: number;
  rankedRowCount: number;
  maxConfidence: number | null;
  confidenceCapReason: string;
  rows: WaiverPriorityCalibrationRow[];
};

type StandingsRow = {
  roster: WaiverPriorityRosterInput;
  rosterId: string;
  pointsFor: number | null;
};

const PUBLIC_WAIVER_PRIORITY_CONFIDENCE_CAP = 72;
const PUBLIC_WAIVER_PRIORITY_CAP_REASON =
  'Public Sleeper roster settings expose waiver order, standings, and move counts, but skipped, losing, pending, or cancelled claim evidence is not approved.';

function numeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = numeric(value);
  if (parsed === null || parsed <= 0) return null;
  return Math.floor(parsed);
}

function getRosterId(roster: WaiverPriorityRosterInput, index: number): string {
  const raw = roster.rosterId;
  if (raw !== null && raw !== undefined && String(raw).trim()) return String(raw);
  return `roster-${index + 1}`;
}

function getManagerName(
  roster: WaiverPriorityRosterInput,
  rosterId: string,
  managerNameByRosterId?: Record<string, string | undefined>
): string {
  const mapped = managerNameByRosterId?.[rosterId];
  if (mapped?.trim()) return mapped.trim();
  if (roster.manager?.trim()) return roster.manager.trim();
  if (roster.ownerId?.trim()) return roster.ownerId.trim();
  return `Roster ${rosterId}`;
}

function getPointsFor(settings: WaiverPriorityRosterInput['settings']): number | null {
  const whole = numeric(settings?.fpts);
  const decimal = numeric(settings?.fpts_decimal);
  if (whole === null && decimal === null) return null;
  return (whole || 0) + (decimal || 0) / 100;
}

function standingsSortValue(row: StandingsRow) {
  const settings = row.roster.settings || {};
  return {
    wins: numeric(settings.wins) ?? 0,
    losses: numeric(settings.losses) ?? 0,
    ties: numeric(settings.ties) ?? 0,
    pointsFor: row.pointsFor ?? 0,
  };
}

function buildStandingsRanks(rosters: WaiverPriorityRosterInput[]): Map<string, number> {
  const rows: StandingsRow[] = rosters.map((roster, index) => ({
    roster,
    rosterId: getRosterId(roster, index),
    pointsFor: getPointsFor(roster.settings),
  }));

  const hasStandingsSignal = rows.some((row) => {
    const settings = row.roster.settings || {};
    return (
      numeric(settings.wins) !== null ||
      numeric(settings.losses) !== null ||
      numeric(settings.ties) !== null ||
      row.pointsFor !== null
    );
  });
  if (!hasStandingsSignal) return new Map();

  return new Map(
    rows
      .sort((a, b) => {
        const left = standingsSortValue(a);
        const right = standingsSortValue(b);
        return (
          right.wins - left.wins ||
          right.pointsFor - left.pointsFor ||
          left.losses - right.losses ||
          right.ties - left.ties ||
          a.rosterId.localeCompare(b.rosterId)
        );
      })
      .map((row, index) => [row.rosterId, index + 1])
  );
}

function getPriorityPercentile(waiverPosition: number | null, maxWaiverPosition: number | null): number | null {
  if (waiverPosition === null || maxWaiverPosition === null || maxWaiverPosition <= 1) return null;
  return Math.max(0, Math.min(1, (waiverPosition - 1) / (maxWaiverPosition - 1)));
}

function getPriorityBurnCost(percentile: number | null): WaiverPriorityBurnCost {
  if (percentile === null) return 'unknown';
  if (percentile <= 0.25) return 'high';
  if (percentile <= 0.66) return 'medium';
  return 'low';
}

function getActivityLevel(totalMoves: number | null): WaiverPriorityCalibrationRow['activityLevel'] {
  if (totalMoves === null) return 'unknown';
  if (totalMoves >= 18) return 'active';
  if (totalMoves <= 4) return 'quiet';
  return 'normal';
}

function getStandingsBucket(standingsRank: number | null, teamCount: number): string {
  if (standingsRank === null || teamCount <= 0) return 'standings:unknown';
  if (standingsRank <= Math.max(1, Math.ceil(teamCount / 3))) return 'standings:top';
  if (standingsRank > Math.floor((teamCount * 2) / 3)) return 'standings:bottom';
  return 'standings:middle';
}

function getConfidence(input: {
  waiverPosition: number | null;
  priorityPercentile: number | null;
  standingsRank: number | null;
  totalMoves: number | null;
}) {
  let confidence = 34;
  if (input.waiverPosition !== null) confidence += 22;
  if (input.priorityPercentile !== null) confidence += 8;
  if (input.standingsRank !== null) confidence += 5;
  if (input.totalMoves !== null) confidence += 4;
  return Math.min(PUBLIC_WAIVER_PRIORITY_CONFIDENCE_CAP, confidence);
}

export function buildWaiverPriorityCalibrationRows({
  rosters,
  managerNameByRosterId,
}: {
  rosters: WaiverPriorityRosterInput[];
  managerNameByRosterId?: Record<string, string | undefined>;
}): WaiverPriorityCalibrationRow[] {
  const standingsRanks = buildStandingsRanks(rosters);
  const waiverPositions = rosters
    .map((roster) => positiveInteger(roster.settings?.waiver_position))
    .filter((value): value is number => value !== null);
  const maxWaiverPosition = waiverPositions.length ? Math.max(...waiverPositions) : null;
  const teamCount = rosters.length;

  return rosters.map((roster, index) => {
    const rosterId = getRosterId(roster, index);
    const settings = roster.settings || {};
    const waiverPosition = positiveInteger(settings.waiver_position);
    const priorityPercentile = getPriorityPercentile(waiverPosition, maxWaiverPosition);
    const priorityBurnCost = getPriorityBurnCost(priorityPercentile);
    const standingsRank = standingsRanks.get(rosterId) ?? null;
    const pointsFor = getPointsFor(settings);
    const totalMoves = positiveInteger(settings.totalMoves ?? settings.total_moves);
    const activityLevel = getActivityLevel(totalMoves);
    const confidence = getConfidence({ waiverPosition, priorityPercentile, standingsRank, totalMoves });
    const cohortKey = [
      `priority:${priorityBurnCost}`,
      getStandingsBucket(standingsRank, teamCount),
      `activity:${activityLevel}`,
    ].join('|');
    const reasons = [
      waiverPosition !== null ? `Sleeper waiver position ${waiverPosition}.` : 'Sleeper waiver position missing.',
      standingsRank !== null ? `Standings rank ${standingsRank} of ${teamCount}.` : 'Standings context missing.',
      totalMoves !== null ? `${totalMoves} completed moves logged.` : 'Move-count context missing.',
      `${priorityBurnCost === 'unknown' ? 'Unknown' : priorityBurnCost} waiver priority burn cost.`,
    ];

    return {
      rosterId,
      manager: getManagerName(roster, rosterId, managerNameByRosterId),
      waiverPosition,
      priorityPercentile,
      priorityBurnCost,
      standingsRank,
      pointsFor,
      totalMoves,
      activityLevel,
      confidence,
      confidenceCapReason: PUBLIC_WAIVER_PRIORITY_CAP_REASON,
      cohortKey,
      reasons,
    };
  });
}

export function summarizeWaiverPriorityCalibration(input: {
  rosters: WaiverPriorityRosterInput[];
  managerNameByRosterId?: Record<string, string | undefined>;
}): WaiverPriorityCalibrationSummary {
  const rows = buildWaiverPriorityCalibrationRows(input);
  const rankedRowCount = rows.filter((row) => row.waiverPosition !== null).length;
  const status: WaiverPriorityCalibrationStatus =
    rankedRowCount === 0 ? 'missing' : rankedRowCount === rows.length ? 'ready' : 'partial';
  const maxConfidence = rows.length
    ? Math.max(...rows.map((row) => row.confidence))
    : null;

  return {
    status,
    rowCount: rows.length,
    rankedRowCount,
    maxConfidence,
    confidenceCapReason: PUBLIC_WAIVER_PRIORITY_CAP_REASON,
    rows,
  };
}
