import type {
  PlayerSeasonOutcomeRow,
  PlayerSeasonPosition,
  ProductionTier,
  RoleTier,
  SeasonTrajectory,
} from './playerSeasonOutcomeModel';

export type PlayerSeasonComparisonDirection = 'positive' | 'negative' | 'neutral';
export type PlayerSeasonComparisonDecision = 'promote-with-guardrails' | 'review-before-promote' | 'do-not-promote';

export type PlayerSeasonComparisonBacktestOptions = {
  peerLimit?: number;
  minSimilarity?: number;
  maxExamples?: number;
};

export type PlayerSeasonComparisonPeer = {
  playerKey: string;
  playerName: string;
  season: number;
  nextSeason: number | null;
  similarity: number;
  nextSeasonOutcome: SeasonTrajectory;
  nextProductionScoreDelta: number | null;
  nextRoleScoreDelta: number | null;
  matchReasons: string[];
};

export type PlayerSeasonComparisonPrediction = {
  playerKey: string;
  playerName: string;
  position: PlayerSeasonPosition;
  season: number;
  productionTier: ProductionTier;
  roleTier: RoleTier;
  trajectoryFromPrevious: SeasonTrajectory;
  predictedDirection: PlayerSeasonComparisonDirection | null;
  actualDirection: PlayerSeasonComparisonDirection;
  hit: boolean | null;
  falsePositive: boolean;
  falseNegative: boolean;
  averageSimilarity: number | null;
  medianSimilarity: number | null;
  compCount: number;
  topComps: PlayerSeasonComparisonPeer[];
  note: string;
};

export type PlayerSeasonComparisonGroupSummary = {
  eligibleCount: number;
  comparedCount: number;
  noCompCount: number;
  hitRate: number | null;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  positivePrecision: number | null;
  negativePrecision: number | null;
  averageSimilarity: number | null;
  medianSimilarity: number | null;
};

export type PlayerSeasonComparisonBacktestResult = {
  schemaVersion: 1;
  generatedFrom: 'player-season-outcomes';
  rowCount: number;
  eligibleRowCount: number;
  comparedRowCount: number;
  noCompRowCount: number;
  decision: PlayerSeasonComparisonDecision;
  decisionReason: string;
  summary: PlayerSeasonComparisonGroupSummary;
  byPosition: Partial<Record<PlayerSeasonPosition, PlayerSeasonComparisonGroupSummary>>;
  bySeason: Record<string, PlayerSeasonComparisonGroupSummary & { hitRateDriftFromOverall: number | null }>;
  byTrajectory: Partial<Record<SeasonTrajectory, PlayerSeasonComparisonGroupSummary>>;
  calibrationDrift: Array<{
    season: number;
    comparedCount: number;
    hitRate: number | null;
    hitRateDriftFromOverall: number | null;
    falsePositiveRate: number | null;
  }>;
  examples: {
    strongestHits: PlayerSeasonComparisonPrediction[];
    falsePositives: PlayerSeasonComparisonPrediction[];
    falseNegatives: PlayerSeasonComparisonPrediction[];
    noComps: PlayerSeasonComparisonPrediction[];
  };
  predictions: PlayerSeasonComparisonPrediction[];
  featureCoverage: {
    used: string[];
    notYetWarehouseBacked: string[];
  };
};

type ScorePart = {
  label: string;
  weight: number;
  similarity: number;
};

type SimilarityScore = {
  score: number;
  usedWeight: number;
  matchReasons: string[];
};

const DEFAULT_PEER_LIMIT = 8;
const DEFAULT_MIN_SIMILARITY = 58;
const DEFAULT_MAX_EXAMPLES = 20;

const POSITIVE_OUTCOMES = new Set<SeasonTrajectory>(['breakout', 'progression', 'sustain', 'late-career-rebound']);
const NEGATIVE_OUTCOMES = new Set<SeasonTrajectory>(['regression', 'collapse', 'low-signal']);

const PRODUCTION_TIER_ORDER: ProductionTier[] = ['low-signal', 'replacement', 'usable', 'strong', 'elite'];
const ROLE_TIER_ORDER: RoleTier[] = ['thin', 'rotation', 'starter', 'feature'];

const PPG_TOLERANCE: Record<PlayerSeasonPosition, number> = {
  QB: 6,
  RB: 5,
  WR: 5,
  TE: 4,
  K: 2.5,
};

const OPPORTUNITY_TOLERANCE: Record<PlayerSeasonPosition, number> = {
  QB: 180,
  RB: 90,
  WR: 50,
  TE: 35,
  K: 4,
};

function round(value: number | null, digits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function pct(count: number, total: number): number | null {
  if (!total) return null;
  return round((count / total) * 100, 1);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function average(values: number[]): number | null {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function median(values: number[]): number | null {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  if (clean.length % 2) return round(clean[middle]);
  return round((clean[middle - 1] + clean[middle]) / 2);
}

function numericSimilarity(a: number | null | undefined, b: number | null | undefined, tolerance: number): number | null {
  if (!isFiniteNumber(a) || !isFiniteNumber(b)) return null;
  return Math.max(0, 1 - Math.abs(a - b) / Math.max(1, tolerance));
}

function ordinalSimilarity<T extends string>(a: T, b: T, order: T[]): number {
  const aIndex = order.indexOf(a);
  const bIndex = order.indexOf(b);
  if (aIndex < 0 || bIndex < 0) return 0;
  const distance = Math.abs(aIndex - bIndex);
  if (distance === 0) return 1;
  if (distance === 1) return 0.7;
  if (distance === 2) return 0.35;
  return 0;
}

function trajectorySimilarity(a: SeasonTrajectory, b: SeasonTrajectory): number {
  if (a === b) return 1;
  if (POSITIVE_OUTCOMES.has(a) && POSITIVE_OUTCOMES.has(b)) return 0.65;
  if (NEGATIVE_OUTCOMES.has(a) && NEGATIVE_OUTCOMES.has(b)) return 0.65;
  if (a === 'first-season' || b === 'first-season') return 0.35;
  return 0.15;
}

function addPart(parts: ScorePart[], label: string, weight: number, similarity: number | null) {
  if (similarity === null) return;
  parts.push({
    label,
    weight,
    similarity: Math.max(0, Math.min(1, similarity)),
  });
}

function scoreSeasonSimilarity(target: PlayerSeasonOutcomeRow, candidate: PlayerSeasonOutcomeRow): SimilarityScore {
  const parts: ScorePart[] = [];

  addPart(parts, 'production score', 18, numericSimilarity(target.productionScore, candidate.productionScore, 36));
  addPart(parts, 'role score', 18, numericSimilarity(target.roleScore, candidate.roleScore, 36));
  addPart(parts, 'weighted opportunity', 12, numericSimilarity(target.weightedOpportunity, candidate.weightedOpportunity, OPPORTUNITY_TOLERANCE[target.position]));
  addPart(parts, 'fantasy PPG', 12, numericSimilarity(target.fantasyPointsPprPerGame, candidate.fantasyPointsPprPerGame, PPG_TOLERANCE[target.position]));
  addPart(parts, 'production delta', 9, numericSimilarity(target.productionScoreDelta, candidate.productionScoreDelta, 34));
  addPart(parts, 'role delta', 9, numericSimilarity(target.roleScoreDelta, candidate.roleScoreDelta, 34));
  addPart(parts, 'production tier', 8, ordinalSimilarity(target.productionTier, candidate.productionTier, PRODUCTION_TIER_ORDER));
  addPart(parts, 'role tier', 8, ordinalSimilarity(target.roleTier, candidate.roleTier, ROLE_TIER_ORDER));
  addPart(parts, 'prior trajectory', 9, trajectorySimilarity(target.trajectoryFromPrevious, candidate.trajectoryFromPrevious));
  addPart(parts, 'target share', 4, numericSimilarity(target.targetShare, candidate.targetShare, 0.08));
  addPart(parts, 'WOPR', 4, numericSimilarity(target.wopr, candidate.wopr, 0.18));

  const usedWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const weightedScore = parts.reduce((sum, part) => sum + part.weight * part.similarity, 0);
  const score = usedWeight ? Math.round((weightedScore / usedWeight) * 100) : 0;
  const matchReasons = [...parts]
    .filter((part) => part.similarity >= 0.72)
    .sort((a, b) => b.weight * b.similarity - a.weight * a.similarity)
    .slice(0, 4)
    .map((part) => part.label);

  return {
    score,
    usedWeight,
    matchReasons,
  };
}

function isKnownOutcomeRow(row: PlayerSeasonOutcomeRow): boolean {
  return Boolean(row.modelEligible && row.nextSeasonOutcome);
}

function isChronologicallyAvailable(candidate: PlayerSeasonOutcomeRow, target: PlayerSeasonOutcomeRow): boolean {
  return candidate.nextSeason !== null && candidate.nextSeason < target.season;
}

export function findHistoricalSeasonComps(
  target: PlayerSeasonOutcomeRow,
  rows: PlayerSeasonOutcomeRow[],
  options: PlayerSeasonComparisonBacktestOptions = {}
): PlayerSeasonComparisonPeer[] {
  const peerLimit = Math.max(1, options.peerLimit || DEFAULT_PEER_LIMIT);
  const minSimilarity = options.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

  return rows
    .filter((candidate) => (
      candidate.playerKey !== target.playerKey
      && candidate.position === target.position
      && isKnownOutcomeRow(candidate)
      && isChronologicallyAvailable(candidate, target)
    ))
    .map((candidate) => ({
      candidate,
      ...scoreSeasonSimilarity(target, candidate),
    }))
    .filter((item) => item.usedWeight >= 70 && item.score >= minSimilarity)
    .sort((a, b) => b.score - a.score || b.candidate.season - a.candidate.season)
    .slice(0, peerLimit)
    .map(({ candidate, score, matchReasons }) => ({
      playerKey: candidate.playerKey,
      playerName: candidate.playerName,
      season: candidate.season,
      nextSeason: candidate.nextSeason,
      similarity: score,
      nextSeasonOutcome: candidate.nextSeasonOutcome || 'low-signal',
      nextProductionScoreDelta: candidate.nextProductionScoreDelta,
      nextRoleScoreDelta: candidate.nextRoleScoreDelta,
      matchReasons,
    }));
}

export function getSeasonOutcomeDirection(row: Pick<PlayerSeasonOutcomeRow, 'nextSeasonOutcome' | 'nextProductionScoreDelta'>): PlayerSeasonComparisonDirection {
  if (row.nextSeasonOutcome && NEGATIVE_OUTCOMES.has(row.nextSeasonOutcome)) return 'negative';
  if (row.nextSeasonOutcome && POSITIVE_OUTCOMES.has(row.nextSeasonOutcome)) return 'positive';
  if ((row.nextProductionScoreDelta || 0) <= -10) return 'negative';
  if ((row.nextProductionScoreDelta || 0) >= 8) return 'positive';
  return 'neutral';
}

function predictedDirectionFromComps(peers: PlayerSeasonComparisonPeer[]): PlayerSeasonComparisonDirection | null {
  if (!peers.length) return null;
  const totalWeight = peers.reduce((sum, peer) => sum + peer.similarity, 0);
  const positiveWeight = peers
    .filter((peer) => POSITIVE_OUTCOMES.has(peer.nextSeasonOutcome))
    .reduce((sum, peer) => sum + peer.similarity, 0);
  const negativeWeight = peers
    .filter((peer) => NEGATIVE_OUTCOMES.has(peer.nextSeasonOutcome))
    .reduce((sum, peer) => sum + peer.similarity, 0);
  const deltas = peers.flatMap((peer) => isFiniteNumber(peer.nextProductionScoreDelta) ? [peer.nextProductionScoreDelta * peer.similarity] : []);
  const deltaWeight = peers.flatMap((peer) => isFiniteNumber(peer.nextProductionScoreDelta) ? [peer.similarity] : []);
  const weightedDelta = deltaWeight.length
    ? deltas.reduce((sum, value) => sum + value, 0) / deltaWeight.reduce((sum, value) => sum + value, 0)
    : null;
  const positiveShare = totalWeight ? positiveWeight / totalWeight : 0;
  const negativeShare = totalWeight ? negativeWeight / totalWeight : 0;

  if (negativeShare >= 0.48 || (weightedDelta !== null && weightedDelta <= -10 && negativeShare >= 0.34)) return 'negative';
  if (positiveShare >= 0.58 || (weightedDelta !== null && weightedDelta >= 8 && positiveShare >= 0.44)) return 'positive';
  return 'neutral';
}

function predictionNote(prediction: PlayerSeasonComparisonPrediction): string {
  if (prediction.predictedDirection === null) {
    return 'No leak-safe same-position historical comp sample cleared the similarity threshold.';
  }
  const verdict = prediction.hit ? 'hit' : prediction.falsePositive ? 'false positive' : prediction.falseNegative ? 'false negative' : 'miss';
  return `${prediction.predictedDirection} comp read was a ${verdict}; actual next-season direction was ${prediction.actualDirection}.`;
}

function buildPrediction(
  target: PlayerSeasonOutcomeRow,
  rows: PlayerSeasonOutcomeRow[],
  options: PlayerSeasonComparisonBacktestOptions
): PlayerSeasonComparisonPrediction {
  const topComps = findHistoricalSeasonComps(target, rows, options);
  const predictedDirection = predictedDirectionFromComps(topComps);
  const actualDirection = getSeasonOutcomeDirection(target);
  const hit = predictedDirection === null ? null : predictedDirection === actualDirection;
  const falsePositive = predictedDirection === 'positive' && actualDirection === 'negative';
  const falseNegative = predictedDirection === 'negative' && actualDirection === 'positive';
  const prediction: PlayerSeasonComparisonPrediction = {
    playerKey: target.playerKey,
    playerName: target.playerName,
    position: target.position,
    season: target.season,
    productionTier: target.productionTier,
    roleTier: target.roleTier,
    trajectoryFromPrevious: target.trajectoryFromPrevious,
    predictedDirection,
    actualDirection,
    hit,
    falsePositive,
    falseNegative,
    averageSimilarity: average(topComps.map((comp) => comp.similarity)),
    medianSimilarity: median(topComps.map((comp) => comp.similarity)),
    compCount: topComps.length,
    topComps,
    note: '',
  };

  return {
    ...prediction,
    note: predictionNote(prediction),
  };
}

function summarize(predictions: PlayerSeasonComparisonPrediction[]): PlayerSeasonComparisonGroupSummary {
  const compared = predictions.filter((row) => row.predictedDirection !== null);
  const hits = compared.filter((row) => row.hit).length;
  const falsePositives = compared.filter((row) => row.falsePositive).length;
  const falseNegatives = compared.filter((row) => row.falseNegative).length;
  const positivePredictions = compared.filter((row) => row.predictedDirection === 'positive');
  const negativePredictions = compared.filter((row) => row.predictedDirection === 'negative');
  const positiveHits = positivePredictions.filter((row) => row.actualDirection === 'positive').length;
  const negativeHits = negativePredictions.filter((row) => row.actualDirection === 'negative').length;
  const similarities = compared.flatMap((row) => row.averageSimilarity === null ? [] : [row.averageSimilarity]);

  return {
    eligibleCount: predictions.length,
    comparedCount: compared.length,
    noCompCount: predictions.length - compared.length,
    hitRate: pct(hits, compared.length),
    falsePositiveRate: pct(falsePositives, compared.length),
    falseNegativeRate: pct(falseNegatives, compared.length),
    positivePrecision: pct(positiveHits, positivePredictions.length),
    negativePrecision: pct(negativeHits, negativePredictions.length),
    averageSimilarity: average(similarities),
    medianSimilarity: median(similarities),
  };
}

function groupBy<K extends string | number>(
  predictions: PlayerSeasonComparisonPrediction[],
  getKey: (prediction: PlayerSeasonComparisonPrediction) => K
): Record<string, PlayerSeasonComparisonPrediction[]> {
  const grouped: Record<string, PlayerSeasonComparisonPrediction[]> = {};
  for (const prediction of predictions) {
    const key = String(getKey(prediction));
    grouped[key] = [...(grouped[key] || []), prediction];
  }
  return grouped;
}

function comparisonDecision(summary: PlayerSeasonComparisonGroupSummary): Pick<PlayerSeasonComparisonBacktestResult, 'decision' | 'decisionReason'> {
  if (summary.comparedCount < 25) {
    return {
      decision: 'do-not-promote',
      decisionReason: `Only ${summary.comparedCount} rows had leak-safe comps; keep this internal until the sample is larger.`,
    };
  }
  if ((summary.falsePositiveRate || 0) > 22) {
    return {
      decision: 'do-not-promote',
      decisionReason: `False-positive rate is ${summary.falsePositiveRate}%, above the 22% promotion guardrail.`,
    };
  }
  if ((summary.hitRate || 0) >= 58 && (summary.positivePrecision || 0) >= 60) {
    return {
      decision: 'promote-with-guardrails',
      decisionReason: `Hit rate is ${summary.hitRate}% with ${summary.positivePrecision}% positive precision and acceptable false-positive risk.`,
    };
  }
  return {
    decision: 'review-before-promote',
    decisionReason: `Hit rate is ${summary.hitRate ?? 'n/a'}% and positive precision is ${summary.positivePrecision ?? 'n/a'}%; review misses before any stronger copy ships.`,
  };
}

function exampleSort(a: PlayerSeasonComparisonPrediction, b: PlayerSeasonComparisonPrediction): number {
  return (b.averageSimilarity || 0) - (a.averageSimilarity || 0) || b.compCount - a.compCount;
}

export function buildPlayerSeasonComparisonBacktest(
  rows: PlayerSeasonOutcomeRow[],
  options: PlayerSeasonComparisonBacktestOptions = {}
): PlayerSeasonComparisonBacktestResult {
  const maxExamples = Math.max(1, options.maxExamples || DEFAULT_MAX_EXAMPLES);
  const eligibleRows = rows.filter(isKnownOutcomeRow);
  const predictions = eligibleRows
    .map((row) => buildPrediction(row, rows, options))
    .sort((a, b) => a.season - b.season || a.position.localeCompare(b.position) || a.playerName.localeCompare(b.playerName));
  const summary = summarize(predictions);
  const decision = comparisonDecision(summary);
  const byPosition = Object.fromEntries(
    Object.entries(groupBy(predictions, (row) => row.position)).map(([position, group]) => [position, summarize(group)])
  ) as Partial<Record<PlayerSeasonPosition, PlayerSeasonComparisonGroupSummary>>;
  const byTrajectory = Object.fromEntries(
    Object.entries(groupBy(predictions, (row) => row.trajectoryFromPrevious)).map(([trajectory, group]) => [trajectory, summarize(group)])
  ) as Partial<Record<SeasonTrajectory, PlayerSeasonComparisonGroupSummary>>;
  const bySeasonBase = Object.entries(groupBy(predictions, (row) => row.season))
    .map(([season, group]) => {
      const seasonSummary = summarize(group);
      return [
        season,
        {
          ...seasonSummary,
          hitRateDriftFromOverall: seasonSummary.hitRate !== null && summary.hitRate !== null
            ? round(seasonSummary.hitRate - summary.hitRate)
            : null,
        },
      ] as const;
    });
  const bySeason = Object.fromEntries(bySeasonBase);
  const calibrationDrift = Object.entries(bySeason)
    .map(([season, row]) => ({
      season: Number(season),
      comparedCount: row.comparedCount,
      hitRate: row.hitRate,
      hitRateDriftFromOverall: row.hitRateDriftFromOverall,
      falsePositiveRate: row.falsePositiveRate,
    }))
    .filter((row) => row.comparedCount > 0)
    .sort((a, b) => Math.abs(b.hitRateDriftFromOverall || 0) - Math.abs(a.hitRateDriftFromOverall || 0))
    .slice(0, 12);

  return {
    schemaVersion: 1,
    generatedFrom: 'player-season-outcomes',
    rowCount: rows.length,
    eligibleRowCount: eligibleRows.length,
    comparedRowCount: summary.comparedCount,
    noCompRowCount: summary.noCompCount,
    ...decision,
    summary,
    byPosition,
    bySeason,
    byTrajectory,
    calibrationDrift,
    examples: {
      strongestHits: predictions
        .filter((row) => row.hit)
        .sort(exampleSort)
        .slice(0, maxExamples),
      falsePositives: predictions
        .filter((row) => row.falsePositive)
        .sort(exampleSort)
        .slice(0, maxExamples),
      falseNegatives: predictions
        .filter((row) => row.falseNegative)
        .sort(exampleSort)
        .slice(0, maxExamples),
      noComps: predictions
        .filter((row) => row.predictedDirection === null)
        .slice(0, maxExamples),
    },
    predictions,
    featureCoverage: {
      used: [
        'same-position completed historical seasons only',
        'production score and production tier',
        'role score and role tier',
        'weighted opportunity',
        'PPR points per game',
        'prior-season production and role movement',
        'target share and WOPR when present',
        'next-season outcome labels for calibration only',
      ],
      notYetWarehouseBacked: [
        'season-specific market value',
        'season-specific player age',
        'format-specific historical scoring context',
      ],
    },
  };
}
