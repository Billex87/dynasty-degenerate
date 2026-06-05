import type { NflScheduleGame, NflScheduleSnapshotPayload } from './nflScheduleSnapshots';
import type {
  PlayerProjectionPosition,
  PlayerProjectionSnapshotPayload,
  PlayerProjectionSnapshotRow,
} from './playerProjectionSnapshots';

export type ProjectionActualInputRow = {
  season: string | number;
  week: string | number;
  playerId?: string | number | null;
  sourcePlayerId?: string | number | null;
  playerName?: string | null;
  team?: string | null;
  position?: string | null;
  actualFantasyPoints?: string | number | null;
  opponent?: string | null;
  homeAway?: 'home' | 'away' | 'neutral' | 'unknown' | string | null;
  rookie?: boolean | string | number | null;
  draftCapitalBucket?: string | null;
  opponentStrengthBucket?: string | null;
};

export type ProjectionAccuracyBucket =
  | 'source'
  | 'position'
  | 'week'
  | 'homeAway'
  | 'opponentStrength'
  | 'rookieStatus'
  | 'draftCapital';

export type ProjectionAccuracySummary = {
  comparedCount: number;
  meanAbsoluteError: number | null;
  rootMeanSquaredError: number | null;
  bias: number | null;
  withinTwoPointRate: number | null;
  withinFivePointRate: number | null;
  overProjectionRate: number | null;
  underProjectionRate: number | null;
};

export type ProjectionAccuracyComparison = {
  playerKey: string;
  playerId: string | null;
  sourcePlayerId: string | null;
  playerName: string;
  season: string;
  week: number;
  source: string;
  projectionType: string;
  scoringProfile: string;
  position: PlayerProjectionPosition;
  team: string | null;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | 'unknown';
  projectedFantasyPoints: number;
  actualFantasyPoints: number;
  error: number;
  absoluteError: number;
  squaredError: number;
  rookieStatus: 'rookie' | 'veteran' | 'unknown';
  draftCapitalBucket: string;
  opponentStrengthBucket: string;
};

export type ProjectionAccuracyBacktestResult = {
  schemaVersion: 1;
  generatedFrom: 'player-projection-snapshots';
  source: string;
  projectionType: string;
  scoringProfile: string;
  season: string;
  week: number | null;
  projectedRowCount: number;
  actualRowCount: number;
  comparedRowCount: number;
  missingActualCount: number;
  decision: 'promote-with-guardrails' | 'review-before-promote' | 'do-not-promote';
  decisionReason: string;
  summary: ProjectionAccuracySummary;
  bySource: Record<string, ProjectionAccuracySummary>;
  byPosition: Partial<Record<PlayerProjectionPosition, ProjectionAccuracySummary>>;
  byWeek: Record<string, ProjectionAccuracySummary>;
  byHomeAway: Record<string, ProjectionAccuracySummary>;
  byOpponentStrength: Record<string, ProjectionAccuracySummary>;
  byRookieStatus: Record<string, ProjectionAccuracySummary>;
  byDraftCapital: Record<string, ProjectionAccuracySummary>;
  largestMisses: ProjectionAccuracyComparison[];
  comparisons: ProjectionAccuracyComparison[];
  featureCoverage: {
    used: string[];
    optionalInputs: string[];
  };
};

type BuildProjectionAccuracyBacktestInput = {
  projectionSnapshot: PlayerProjectionSnapshotPayload;
  actualRows: ProjectionActualInputRow[];
  scheduleSnapshot?: NflScheduleSnapshotPayload | null;
  rookieByPlayerId?: Record<string, boolean | null | undefined>;
  draftCapitalBucketByPlayerId?: Record<string, string | null | undefined>;
  opponentStrengthByTeamPosition?: Record<string, string | null | undefined>;
  largestMissLimit?: number;
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function intValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function cleanText(value: unknown): string | null {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean || null;
}

function boolValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (['1', 'true', 'yes', 'y', 'rookie'].includes(raw)) return true;
  if (['0', 'false', 'no', 'n', 'veteran'].includes(raw)) return false;
  return null;
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function pct(count: number, total: number): number | null {
  if (!total) return null;
  return round((count / total) * 100, 1);
}

function playerKey(input: {
  season: string | number;
  week: string | number | null | undefined;
  playerId?: string | number | null;
  sourcePlayerId?: string | number | null;
  playerName?: string | null;
  team?: string | null;
  position?: string | null;
}): string {
  const week = intValue(input.week);
  const identity = cleanText(input.playerId)
    || cleanText(input.sourcePlayerId)
    || [
      cleanText(input.playerName)?.toLowerCase(),
      cleanText(input.team)?.toUpperCase(),
      cleanText(input.position)?.toUpperCase(),
    ].filter(Boolean).join(':');
  return [
    String(input.season),
    week === null ? 'all' : `w${week}`,
    identity || 'unknown-player',
  ].join(':');
}

function normalizeHomeAway(value: unknown): ProjectionAccuracyComparison['homeAway'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (['home', 'h'].includes(normalized)) return 'home';
  if (['away', 'a'].includes(normalized)) return 'away';
  if (['neutral', 'n'].includes(normalized)) return 'neutral';
  return 'unknown';
}

function findGame(row: PlayerProjectionSnapshotRow, scheduleSnapshot?: NflScheduleSnapshotPayload | null): NflScheduleGame | null {
  if (!scheduleSnapshot || !row.team || row.week === null) return null;
  return scheduleSnapshot.rows.find((game) => (
    game.season === row.season
    && game.week === row.week
    && (game.homeTeam === row.team || game.awayTeam === row.team)
  )) || null;
}

function getOpponentStrengthKey(opponent: string | null, position: string): string {
  return `${opponent || 'UNKNOWN'}:${position || 'UNKNOWN'}`;
}

function buildSummary(rows: ProjectionAccuracyComparison[]): ProjectionAccuracySummary {
  if (!rows.length) {
    return {
      comparedCount: 0,
      meanAbsoluteError: null,
      rootMeanSquaredError: null,
      bias: null,
      withinTwoPointRate: null,
      withinFivePointRate: null,
      overProjectionRate: null,
      underProjectionRate: null,
    };
  }
  const absoluteError = rows.reduce((sum, row) => sum + row.absoluteError, 0);
  const squaredError = rows.reduce((sum, row) => sum + row.squaredError, 0);
  const bias = rows.reduce((sum, row) => sum + row.error, 0);
  return {
    comparedCount: rows.length,
    meanAbsoluteError: round(absoluteError / rows.length),
    rootMeanSquaredError: round(Math.sqrt(squaredError / rows.length)),
    bias: round(bias / rows.length),
    withinTwoPointRate: pct(rows.filter((row) => row.absoluteError <= 2).length, rows.length),
    withinFivePointRate: pct(rows.filter((row) => row.absoluteError <= 5).length, rows.length),
    overProjectionRate: pct(rows.filter((row) => row.error > 0).length, rows.length),
    underProjectionRate: pct(rows.filter((row) => row.error < 0).length, rows.length),
  };
}

function groupSummary<K extends string>(
  rows: ProjectionAccuracyComparison[],
  getKey: (row: ProjectionAccuracyComparison) => K | null | undefined
): Record<K, ProjectionAccuracySummary> {
  const groups = new Map<K, ProjectionAccuracyComparison[]>();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .reduce((result, [key, groupRows]) => {
      result[key] = buildSummary(groupRows);
      return result;
    }, {} as Record<K, ProjectionAccuracySummary>);
}

function getDecision(summary: ProjectionAccuracySummary): Pick<ProjectionAccuracyBacktestResult, 'decision' | 'decisionReason'> {
  if (summary.comparedCount < 25) {
    return {
      decision: 'do-not-promote',
      decisionReason: 'Too few projection rows have final actuals for a stable accuracy read.',
    };
  }
  if ((summary.meanAbsoluteError || 99) <= 4 && (summary.withinFivePointRate || 0) >= 70) {
    return {
      decision: 'promote-with-guardrails',
      decisionReason: 'Projection accuracy is strong enough for gated use with normal source freshness checks.',
    };
  }
  if ((summary.meanAbsoluteError || 99) <= 6 && (summary.withinFivePointRate || 0) >= 55) {
    return {
      decision: 'review-before-promote',
      decisionReason: 'Projection accuracy is usable but needs source, position, and outlier review before promotion.',
    };
  }
  return {
    decision: 'do-not-promote',
    decisionReason: 'Projection error is too high for confident product readouts.',
  };
}

export function buildProjectionAccuracyBacktest(input: BuildProjectionAccuracyBacktestInput): ProjectionAccuracyBacktestResult {
  const actualsByKey = new Map<string, ProjectionActualInputRow>();
  for (const actual of input.actualRows || []) {
    const actualPoints = finiteNumber(actual.actualFantasyPoints);
    if (actualPoints === null) continue;
    actualsByKey.set(playerKey(actual), actual);
  }

  const comparisons: ProjectionAccuracyComparison[] = [];
  for (const projected of input.projectionSnapshot.rows) {
    const projectedPoints = finiteNumber(projected.projectedFantasyPoints);
    if (projectedPoints === null) continue;
    const actual = actualsByKey.get(playerKey(projected));
    const actualPoints = finiteNumber(actual?.actualFantasyPoints);
    if (!actual || actualPoints === null) continue;

    const game = findGame(projected, input.scheduleSnapshot);
    const scheduleHomeAway = game && projected.team
      ? game.homeTeam === projected.team ? 'home' : 'away'
      : 'unknown';
    const opponent = cleanText(actual.opponent)
      || (game && projected.team ? (game.homeTeam === projected.team ? game.awayTeam : game.homeTeam) : null);
    const homeAway = normalizeHomeAway(actual.homeAway || scheduleHomeAway);
    const rookie = projected.playerId ? input.rookieByPlayerId?.[projected.playerId] : undefined;
    const actualRookie = boolValue(actual.rookie);
    const rookieStatus = (rookie ?? actualRookie) === true
      ? 'rookie'
      : (rookie ?? actualRookie) === false
        ? 'veteran'
        : 'unknown';
    const draftCapitalBucket = cleanText(projected.playerId ? input.draftCapitalBucketByPlayerId?.[projected.playerId] : null)
      || cleanText(actual.draftCapitalBucket)
      || 'unknown';
    const opponentStrengthBucket = cleanText(actual.opponentStrengthBucket)
      || cleanText(input.opponentStrengthByTeamPosition?.[getOpponentStrengthKey(opponent, projected.position)])
      || 'unknown';
    const error = round(projectedPoints - actualPoints) || 0;

    comparisons.push({
      playerKey: playerKey(projected),
      playerId: projected.playerId,
      sourcePlayerId: projected.sourcePlayerId,
      playerName: projected.playerName,
      season: projected.season,
      week: projected.week || Number(actual.week),
      source: projected.source,
      projectionType: projected.projectionType,
      scoringProfile: projected.scoringProfile,
      position: projected.position,
      team: projected.team,
      opponent,
      homeAway,
      projectedFantasyPoints: projectedPoints,
      actualFantasyPoints: actualPoints,
      error,
      absoluteError: Math.abs(error),
      squaredError: round(error * error) || 0,
      rookieStatus,
      draftCapitalBucket,
      opponentStrengthBucket,
    });
  }

  const summary = buildSummary(comparisons);
  const decision = getDecision(summary);
  const largestMissLimit = Math.max(1, input.largestMissLimit || 20);

  return {
    schemaVersion: 1,
    generatedFrom: 'player-projection-snapshots',
    source: input.projectionSnapshot.source,
    projectionType: input.projectionSnapshot.projectionType,
    scoringProfile: input.projectionSnapshot.scoringProfile,
    season: input.projectionSnapshot.season,
    week: input.projectionSnapshot.week,
    projectedRowCount: input.projectionSnapshot.rowCount,
    actualRowCount: actualsByKey.size,
    comparedRowCount: comparisons.length,
    missingActualCount: Math.max(0, input.projectionSnapshot.rowCount - comparisons.length),
    ...decision,
    summary,
    bySource: groupSummary(comparisons, (row) => row.source),
    byPosition: groupSummary(comparisons, (row) => row.position),
    byWeek: groupSummary(comparisons, (row) => String(row.week)),
    byHomeAway: groupSummary(comparisons, (row) => row.homeAway),
    byOpponentStrength: groupSummary(comparisons, (row) => row.opponentStrengthBucket),
    byRookieStatus: groupSummary(comparisons, (row) => row.rookieStatus),
    byDraftCapital: groupSummary(comparisons, (row) => row.draftCapitalBucket),
    largestMisses: [...comparisons]
      .sort((a, b) => b.absoluteError - a.absoluteError)
      .slice(0, largestMissLimit),
    comparisons,
    featureCoverage: {
      used: [
        'projected fantasy points',
        'actual fantasy points',
        'source',
        'position',
        'week',
        'home/away',
      ],
      optionalInputs: [
        'schedule snapshot for opponent and home/away',
        'opponent strength bucket',
        'rookie status',
        'draft-capital bucket',
      ],
    },
  };
}
