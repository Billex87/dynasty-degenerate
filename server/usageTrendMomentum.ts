export type UsageTrendMomentumDirection =
  | 'sustained-growth'
  | 'short-spike'
  | 'declining'
  | 'volatile'
  | 'flat'
  | 'thin-sample';

export type WeeklyUsageObservation = {
  week: number | string;
  targets?: number | string | null;
  carries?: number | string | null;
  rushAttempts?: number | string | null;
  offenseSnapPct?: number | string | null;
  fantasyPointsPpr?: number | string | null;
};

export type UsageTrendMomentumWindow = {
  games: number;
  weeks: number[];
  targetsPerGame: number | null;
  carriesPerGame: number | null;
  fantasyPointsPprPerGame: number | null;
  offenseSnapPct: number | null;
  targetDeltaPerGame: number | null;
  carryDeltaPerGame: number | null;
  fantasyPointDeltaPerGame: number | null;
  snapDeltaPct: number | null;
  volatilityScore: number;
  momentumScore: number;
  direction: UsageTrendMomentumDirection;
  note: string;
};

export type UsageTrendMomentumSummary = {
  gameCount: number;
  weeks: number[];
  seasonTargetsPerGame: number | null;
  seasonCarriesPerGame: number | null;
  seasonFantasyPointsPprPerGame: number | null;
  seasonOffenseSnapPct: number | null;
  windows: UsageTrendMomentumWindow[];
  primaryDirection: UsageTrendMomentumDirection;
  confidence: number;
  confidenceCapReason: string | null;
  missingEvidence: string[];
  note: string;
};

type NormalizedUsageObservation = {
  week: number;
  targets: number | null;
  carries: number | null;
  fantasyPointsPpr: number | null;
  offenseSnapPct: number | null;
};

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: Array<number | null>): number | null {
  const clean = values.filter((value): value is number => Number.isFinite(value));
  if (!clean.length) return null;
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function sum(values: Array<number | null>): number | null {
  const clean = values.filter((value): value is number => Number.isFinite(value));
  if (!clean.length) return null;
  return round(clean.reduce((total, value) => total + value, 0));
}

function standardDeviation(values: Array<number | null>): number {
  const clean = values.filter((value): value is number => Number.isFinite(value));
  if (clean.length < 2) return 0;
  const avg = clean.reduce((total, value) => total + value, 0) / clean.length;
  const variance = clean.reduce((total, value) => total + (value - avg) ** 2, 0) / clean.length;
  return round(Math.sqrt(variance));
}

function normalizeSnapPct(value: unknown): number | null {
  const parsed = num(value);
  if (parsed === null) return null;
  const pct = parsed <= 1 ? parsed * 100 : parsed;
  return Math.max(0, Math.min(100, round(pct)));
}

function normalizeObservation(row: WeeklyUsageObservation): NormalizedUsageObservation | null {
  const week = num(row.week);
  if (week === null || week <= 0) return null;
  const carries = num(row.carries) ?? num(row.rushAttempts);
  return {
    week: Math.round(week),
    targets: num(row.targets),
    carries,
    fantasyPointsPpr: num(row.fantasyPointsPpr),
    offenseSnapPct: normalizeSnapPct(row.offenseSnapPct),
  };
}

function pctDelta(current: number | null, baseline: number | null): number | null {
  if (current === null || baseline === null) return null;
  return round(current - baseline);
}

function metricMomentumScore(input: {
  targetDeltaPerGame: number | null;
  carryDeltaPerGame: number | null;
  snapDeltaPct: number | null;
  fantasyPointDeltaPerGame: number | null;
  volatilityScore: number;
}): number {
  const score =
    (input.targetDeltaPerGame || 0) * 8
    + (input.carryDeltaPerGame || 0) * 5
    + (input.snapDeltaPct || 0) * 0.9
    + (input.fantasyPointDeltaPerGame || 0) * 2
    - input.volatilityScore * 0.35;
  return round(Math.max(-100, Math.min(100, score)));
}

function directionForWindow(score: number, volatilityScore: number): UsageTrendMomentumDirection {
  if (volatilityScore >= 24 && Math.abs(score) < 18) return 'volatile';
  if (score >= 24) return 'sustained-growth';
  if (score >= 10) return 'short-spike';
  if (score <= -14) return 'declining';
  return 'flat';
}

function summarizeWindow(
  observations: NormalizedUsageObservation[],
  games: number,
  season: {
    targetsPerGame: number | null;
    carriesPerGame: number | null;
    fantasyPointsPprPerGame: number | null;
    offenseSnapPct: number | null;
  }
): UsageTrendMomentumWindow | null {
  const rows = observations.slice(-games);
  if (rows.length < Math.min(2, games)) return null;
  const gameCount = rows.length;
  const targets = sum(rows.map((row) => row.targets));
  const carries = sum(rows.map((row) => row.carries));
  const points = sum(rows.map((row) => row.fantasyPointsPpr));
  const targetsPerGame = targets === null ? null : round(targets / gameCount);
  const carriesPerGame = carries === null ? null : round(carries / gameCount);
  const fantasyPointsPprPerGame = points === null ? null : round(points / gameCount);
  const offenseSnapPct = average(rows.map((row) => row.offenseSnapPct));
  const targetDeltaPerGame = pctDelta(targetsPerGame, season.targetsPerGame);
  const carryDeltaPerGame = pctDelta(carriesPerGame, season.carriesPerGame);
  const fantasyPointDeltaPerGame = pctDelta(fantasyPointsPprPerGame, season.fantasyPointsPprPerGame);
  const snapDeltaPct = pctDelta(offenseSnapPct, season.offenseSnapPct);
  const volatilityScore = round(
    standardDeviation(rows.map((row) => row.targets)) * 3
    + standardDeviation(rows.map((row) => row.carries)) * 2
    + standardDeviation(rows.map((row) => row.offenseSnapPct)) * 0.35
  );
  const momentumScore = metricMomentumScore({
    targetDeltaPerGame,
    carryDeltaPerGame,
    snapDeltaPct,
    fantasyPointDeltaPerGame,
    volatilityScore,
  });
  const direction = directionForWindow(momentumScore, volatilityScore);

  return {
    games,
    weeks: rows.map((row) => row.week),
    targetsPerGame,
    carriesPerGame,
    fantasyPointsPprPerGame,
    offenseSnapPct,
    targetDeltaPerGame,
    carryDeltaPerGame,
    fantasyPointDeltaPerGame,
    snapDeltaPct,
    volatilityScore,
    momentumScore,
    direction,
    note: `Last ${gameCount} tracked game${gameCount === 1 ? '' : 's'}: ${targetsPerGame ?? 'n/a'} targets/g, ${carriesPerGame ?? 'n/a'} carries/g, ${offenseSnapPct ?? 'n/a'}% snaps; momentum ${momentumScore}.`,
  };
}

function recentConfirmationCount(
  observations: NormalizedUsageObservation[],
  season: {
    targetsPerGame: number | null;
    carriesPerGame: number | null;
    offenseSnapPct: number | null;
  },
  direction: 'growth' | 'decline'
): number {
  return observations.slice(-3).filter((row) => {
    const targetDelta = pctDelta(row.targets, season.targetsPerGame) || 0;
    const carryDelta = pctDelta(row.carries, season.carriesPerGame) || 0;
    const snapDelta = pctDelta(row.offenseSnapPct, season.offenseSnapPct) || 0;
    const score = targetDelta * 8 + carryDelta * 5 + snapDelta * 0.9;
    return direction === 'growth' ? score >= 10 : score <= -10;
  }).length;
}

function primaryDirection(
  windows: UsageTrendMomentumWindow[],
  observations: NormalizedUsageObservation[],
  season: {
    targetsPerGame: number | null;
    carriesPerGame: number | null;
    offenseSnapPct: number | null;
  }
): UsageTrendMomentumDirection {
  if (observations.length < 3) return 'thin-sample';
  const three = windows.find((window) => window.games === 3);
  const six = windows.find((window) => window.games === 6);
  const recentGrowthConfirmations = recentConfirmationCount(observations, season, 'growth');
  const recentDeclineConfirmations = recentConfirmationCount(observations, season, 'decline');
  if ((three?.direction === 'sustained-growth' || three?.direction === 'short-spike') && six && recentGrowthConfirmations >= 2) return 'sustained-growth';
  if (three?.direction === 'declining' && recentDeclineConfirmations >= 2) return 'declining';
  if (three?.direction === 'short-spike' || three?.direction === 'sustained-growth') return 'short-spike';
  if (three?.direction === 'volatile' || six?.direction === 'volatile') return 'volatile';
  return three?.direction || 'flat';
}

function confidenceFor(input: {
  direction: UsageTrendMomentumDirection;
  gameCount: number;
  missingEvidence: string[];
  windows: UsageTrendMomentumWindow[];
}): { confidence: number; confidenceCapReason: string | null } {
  const base = input.direction === 'sustained-growth'
    ? 76
    : input.direction === 'declining'
    ? 72
    : input.direction === 'short-spike'
    ? 58
    : input.direction === 'volatile'
    ? 52
    : input.direction === 'thin-sample'
    ? 40
    : 48;
  const hasSixGameWindow = input.windows.some((window) => window.games === 6);
  const cap = input.gameCount < 3
    ? 44
    : !hasSixGameWindow
    ? 62
    : input.missingEvidence.length
    ? 66
    : 84;
  const confidence = Math.max(25, Math.min(cap, base - input.missingEvidence.length * 3));
  const confidenceCapReason = input.gameCount < 3
    ? 'Usage momentum sample is too thin.'
    : !hasSixGameWindow
    ? 'Usage momentum lacks a six-game confirmation window.'
    : input.missingEvidence.length
    ? `Usage momentum missing evidence: ${input.missingEvidence.join(', ')}.`
    : null;
  return { confidence, confidenceCapReason };
}

export function buildUsageTrendMomentumSummary(rows: WeeklyUsageObservation[]): UsageTrendMomentumSummary {
  const observations = rows
    .map(normalizeObservation)
    .filter((row): row is NormalizedUsageObservation => Boolean(row))
    .sort((a, b) => a.week - b.week);
  const gameCount = observations.length;
  const weeks = observations.map((row) => row.week);
  const targets = sum(observations.map((row) => row.targets));
  const carries = sum(observations.map((row) => row.carries));
  const points = sum(observations.map((row) => row.fantasyPointsPpr));
  const season = {
    targetsPerGame: targets === null || !gameCount ? null : round(targets / gameCount),
    carriesPerGame: carries === null || !gameCount ? null : round(carries / gameCount),
    fantasyPointsPprPerGame: points === null || !gameCount ? null : round(points / gameCount),
    offenseSnapPct: average(observations.map((row) => row.offenseSnapPct)),
  };
  const windows = [3, 6, 12, 24]
    .map((games) => summarizeWindow(observations, games, season))
    .filter((window): window is UsageTrendMomentumWindow => Boolean(window));
  const missingEvidence = [
    gameCount < 3 ? 'three-game usage sample' : null,
    observations.some((row) => row.targets !== null) ? null : 'weekly targets',
    observations.some((row) => row.carries !== null) ? null : 'weekly rush attempts',
    observations.some((row) => row.offenseSnapPct !== null) ? null : 'weekly snap share',
  ].filter((item): item is string => Boolean(item));
  const direction = primaryDirection(windows, observations, season);
  const confidence = confidenceFor({ direction, gameCount, missingEvidence, windows });

  return {
    gameCount,
    weeks,
    seasonTargetsPerGame: season.targetsPerGame,
    seasonCarriesPerGame: season.carriesPerGame,
    seasonFantasyPointsPprPerGame: season.fantasyPointsPprPerGame,
    seasonOffenseSnapPct: season.offenseSnapPct,
    windows,
    primaryDirection: direction,
    confidence: confidence.confidence,
    confidenceCapReason: confidence.confidenceCapReason,
    missingEvidence,
    note: direction === 'sustained-growth'
      ? 'Recent usage growth is backed by a multi-game confirmation window.'
      : direction === 'short-spike'
      ? 'Recent usage popped, but it still needs a longer confirmation window before confidence rises.'
      : direction === 'declining'
      ? 'Recent usage is declining against the season baseline.'
      : direction === 'volatile'
      ? 'Recent usage is too volatile to treat as a stable role change.'
      : direction === 'thin-sample'
      ? 'Usage momentum needs at least three tracked games.'
      : 'Usage momentum is close to the season baseline.',
  };
}
