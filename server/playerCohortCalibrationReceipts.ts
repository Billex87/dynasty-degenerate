import fs from 'node:fs';
import path from 'node:path';
import type { PlayerCohortProfile, PlayerCohortSeasonOutcomeReceipt, PlayerDetails } from '../shared/types';
import type { CalibrationConfidenceGrade, CalibrationRecommendation, FailureModeKey } from './playerSeasonCalibration';
import {
  getPlayerSeasonProductionTier,
  getPlayerSeasonRoleTier,
  PLAYER_SEASON_POSITION_BASELINES,
  type PlayerSeasonPosition,
  type ProductionTier,
  type RoleTier,
  type SeasonTrajectory,
} from './playerSeasonOutcomeModel';

export type CompactPlayerSeasonCalibrationBucket = {
  key: string;
  label: string;
  position: PlayerSeasonPosition;
  productionTier: ProductionTier;
  roleTier: RoleTier;
  trajectoryFromPrevious: SeasonTrajectory;
  sampleSize: number;
  improvedOrSustainedRate: number | null;
  breakoutOrProgressionRate: number | null;
  regressionOrCollapseRate: number | null;
  failureRiskRate: number | null;
  medianNextProductionDelta: number | null;
  medianNextRoleDelta: number | null;
  confidence: number;
  confidenceGrade: CalibrationConfidenceGrade;
  recommendation: CalibrationRecommendation;
  primaryFailureModes: Array<{
    key: FailureModeKey;
    label: string;
    rate: number;
  }>;
  summary: string;
};

export type CompactPlayerSeasonCalibration = {
  schemaVersion: 1;
  generatedAt?: string;
  rowCount?: number;
  calibratedRowCount?: number;
  bucketCount?: number;
  buckets: CompactPlayerSeasonCalibrationBucket[];
};

const DEFAULT_CALIBRATION_PATH = path.join(process.cwd(), 'server', 'model-calibration', 'player-cohort-calibration-v1.json');
const MIN_VISIBLE_SAMPLE_SIZE = 14;

let publishedCalibrationCache: CompactPlayerSeasonCalibration | null | undefined;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isModelPosition(position: string): position is PlayerSeasonPosition {
  return position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE' || position === 'K';
}

function bucketKey(input: {
  position: PlayerSeasonPosition;
  productionTier: ProductionTier;
  roleTier: RoleTier;
  trajectoryFromPrevious: SeasonTrajectory;
}): string {
  return [
    input.position,
    input.productionTier,
    input.roleTier,
    input.trajectoryFromPrevious,
  ].join(':');
}

function compactStance(recommendation: CalibrationRecommendation): PlayerCohortSeasonOutcomeReceipt['stance'] {
  if (recommendation === 'amplify' || recommendation === 'lean-positive') return 'upside-supported';
  if (recommendation === 'caution' || recommendation === 'fade-risk') return 'risk-supported';
  return 'neutral-reference';
}

function signed(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return `${value >= 0 ? '+' : ''}${value}`;
}

function deriveRoleScore(
  profile: PlayerCohortProfile,
  details: PlayerDetails,
  position: PlayerSeasonPosition
): { score: number | null; derivedFrom: string[] } {
  const usage = details.usageTrend;
  if (!usage) return { score: null, derivedFrom: ['role tier unavailable because usage trend is missing'] };

  const baseline = PLAYER_SEASON_POSITION_BASELINES[position];
  const ppg = numeric(usage.fantasyPointsPprPerGame) ?? profile.lastSeasonPointsPerGame ?? 0;
  const derivedFrom = [`${usage.season} usage trend`];

  if (position === 'QB') {
    const games = numeric(usage.games) ?? numeric(details.lastSeasonGames) ?? 0;
    const gamesScore = games >= 15 ? 72 : games >= 12 ? 58 : games >= 7 ? 34 : 12;
    const ppgAdjustment = clamp((ppg - baseline.usablePpg) * 3.2, -18, 24);
    derivedFrom.push('QB role uses games and PPG because passing attempts are not stored on player detail cards');
    return { score: Math.round(clamp(gamesScore + ppgAdjustment, 0, 100)), derivedFrom };
  }

  if (position === 'RB') {
    const weightedOpportunity = (numeric(usage.carries) || 0) + (numeric(usage.targets) || 0) * 1.45;
    const volumeScore = ((weightedOpportunity - baseline.rotationVolume) / Math.max(1, baseline.featureVolume - baseline.rotationVolume)) * 100;
    const receivingBoost = (numeric(usage.targets) || 0) * 0.08;
    derivedFrom.push(`${Math.round(weightedOpportunity)} weighted RB opportunities`);
    return { score: Math.round(clamp(volumeScore + receivingBoost, 0, 100)), derivedFrom };
  }

  const targetVolume = numeric(usage.targets) || 0;
  const volumeScore = ((targetVolume - baseline.rotationVolume) / Math.max(1, baseline.featureVolume - baseline.rotationVolume)) * 100;
  const targetShareBoost = (numeric(usage.avgTargetShare) || 0) * 42;
  const woprBoost = (numeric(usage.wopr) || 0) * 24;
  derivedFrom.push(`${Math.round(targetVolume)} targets`, `${Math.round((numeric(usage.avgTargetShare) || 0) * 100)}% target-share proxy`);
  return { score: Math.round(clamp(volumeScore + targetShareBoost + woprBoost, 0, 100)), derivedFrom };
}

function deriveTrajectory(
  profile: PlayerCohortProfile,
  details: PlayerDetails,
  roleTier: RoleTier
): { trajectory: SeasonTrajectory; derivedFrom: string[] } {
  const games = numeric(details.lastSeasonGames);
  const yearsExp = numeric(details.yearsExp);
  const productionScore = profile.productionScore ?? 0;
  const trendUp = details.usageTrend?.targetTrend === 'up' || details.usageTrend?.carryTrend === 'up';
  const trendDown = details.usageTrend?.targetTrend === 'down' || details.usageTrend?.carryTrend === 'down';

  if (games !== null && games < 5) {
    return { trajectory: 'low-signal', derivedFrom: [`${games} latest-season games`] };
  }
  if (yearsExp !== null && yearsExp <= 0) {
    return { trajectory: 'first-season', derivedFrom: ['rookie/first NFL season marker'] };
  }
  if (profile.outcomeBucket === 'breakout') {
    return {
      trajectory: yearsExp !== null && yearsExp <= 1 ? 'breakout' : 'progression',
      derivedFrom: ['cohort breakout bucket', profile.draftCapital.label],
    };
  }
  if (profile.outcomeBucket === 'fade-risk' || profile.outcomeBucket === 'injury-risk') {
    return { trajectory: 'regression', derivedFrom: [`cohort ${profile.outcomeBucket} bucket`] };
  }
  if (trendDown && (productionScore < 55 || roleTier === 'thin' || roleTier === 'rotation')) {
    return { trajectory: 'regression', derivedFrom: ['declining latest usage trend'] };
  }
  if (trendUp && (productionScore >= 48 || roleTier === 'starter' || roleTier === 'feature')) {
    return {
      trajectory: profile.agePhase === 'decline' ? 'late-career-rebound' : 'progression',
      derivedFrom: ['rising latest usage trend'],
    };
  }
  if (profile.outcomeBucket === 'market-under-production' || profile.outcomeBucket === 'market-over-production') {
    return { trajectory: 'sustain', derivedFrom: [`cohort ${profile.outcomeBucket} bucket without a clear production trajectory flag`] };
  }
  return { trajectory: 'sustain', derivedFrom: ['stable cohort bucket'] };
}

function deriveBucketMatch(profile: PlayerCohortProfile, details: PlayerDetails): {
  key: string;
  productionTier: ProductionTier;
  roleTier: RoleTier;
  trajectoryFromPrevious: SeasonTrajectory;
  derivedFrom: string[];
} | null {
  const position = profile.position.toUpperCase();
  if (!isModelPosition(position) || position === 'K') return null;
  const games = numeric(details.lastSeasonGames) ?? 0;
  const productionTier = getPlayerSeasonProductionTier(position, profile.lastSeasonPointsPerGame, games);
  const role = deriveRoleScore(profile, details, position);
  if (role.score === null) return null;
  const roleTier = getPlayerSeasonRoleTier(position, role.score);
  const trajectory = deriveTrajectory(profile, details, roleTier);
  const key = bucketKey({
    position,
    productionTier,
    roleTier,
    trajectoryFromPrevious: trajectory.trajectory,
  });
  return {
    key,
    productionTier,
    roleTier,
    trajectoryFromPrevious: trajectory.trajectory,
    derivedFrom: [
      `${productionTier} production tier from ${profile.lastSeasonPointsPerGame ?? 'n/a'} PPG / ${games || 'n/a'} games`,
      `${roleTier} role tier from role score ${role.score}`,
      ...role.derivedFrom,
      ...trajectory.derivedFrom,
    ],
  };
}

function isDisplayEligible(bucket: CompactPlayerSeasonCalibrationBucket, profile: PlayerCohortProfile): boolean {
  if (bucket.sampleSize < MIN_VISIBLE_SAMPLE_SIZE) return false;
  if (bucket.confidenceGrade === 'thin' || bucket.confidenceGrade === 'blocked') return false;
  if (bucket.recommendation === 'neutral') return false;
  if (profile.calibration.evidenceGrade === 'blocked') return false;
  if ((bucket.recommendation === 'amplify' || bucket.recommendation === 'lean-positive') && !profile.calibration.strongReadEligible) return false;
  return true;
}

function buildReceiptSummary(bucket: CompactPlayerSeasonCalibrationBucket): string {
  const failure = bucket.failureRiskRate !== null ? `${bucket.failureRiskRate}% material failure risk` : 'no material failure rate';
  const positive = bucket.improvedOrSustainedRate !== null ? `${bucket.improvedOrSustainedRate}% improved/sustained` : 'no improved/sustained rate';
  const median = `median next production ${signed(bucket.medianNextProductionDelta)}`;
  const failureMode = bucket.primaryFailureModes[0]?.label
    ? `Main failure mode: ${bucket.primaryFailureModes[0].label.toLowerCase()} (${bucket.primaryFailureModes[0].rate}%).`
    : 'No dominant failure mode.';

  if (bucket.recommendation === 'fade-risk' || bucket.recommendation === 'caution') {
    return `${bucket.label}: ${bucket.sampleSize} historical samples, ${failure}, ${positive}, ${median}. ${failureMode}`;
  }
  if (bucket.recommendation === 'amplify' || bucket.recommendation === 'lean-positive') {
    return `${bucket.label}: ${bucket.sampleSize} historical samples, ${positive}, ${failure}, ${median}. This supports the positive read when the current value and role signals agree.`;
  }
  return `${bucket.label}: ${bucket.sampleSize} historical samples, ${positive}, ${failure}, ${median}.`;
}

export function loadPublishedPlayerCohortCalibration(): CompactPlayerSeasonCalibration | null {
  if (process.env.NODE_ENV === 'test' && process.env.USE_PLAYER_COHORT_CALIBRATION !== '1') return null;
  if (publishedCalibrationCache !== undefined) return publishedCalibrationCache;

  const calibrationPath = process.env.PLAYER_COHORT_CALIBRATION_FILE || DEFAULT_CALIBRATION_PATH;
  if (!fs.existsSync(calibrationPath)) {
    publishedCalibrationCache = null;
    return publishedCalibrationCache;
  }

  try {
    const payload = JSON.parse(fs.readFileSync(calibrationPath, 'utf8')) as CompactPlayerSeasonCalibration;
    publishedCalibrationCache = payload?.schemaVersion === 1 && Array.isArray(payload.buckets)
      ? payload
      : null;
  } catch (error) {
    console.warn('[PlayerCohortCalibration] Failed to load published calibration:', error);
    publishedCalibrationCache = null;
  }

  return publishedCalibrationCache;
}

export function buildPlayerSeasonOutcomeReceipt(input: {
  profile: PlayerCohortProfile;
  details: PlayerDetails;
  calibration: CompactPlayerSeasonCalibration | null;
}): PlayerCohortSeasonOutcomeReceipt | null {
  if (!input.calibration?.buckets?.length) return null;
  const match = deriveBucketMatch(input.profile, input.details);
  if (!match) return null;
  const bucket = input.calibration.buckets.find((candidate) => candidate.key === match.key);
  if (!bucket) return null;

  const displayEligible = isDisplayEligible(bucket, input.profile);
  const stance = compactStance(bucket.recommendation);
  const primaryFailureMode = bucket.primaryFailureModes[0]
    ? {
      key: bucket.primaryFailureModes[0].key,
      label: bucket.primaryFailureModes[0].label,
      rate: bucket.primaryFailureModes[0].rate,
    }
    : null;

  return {
    key: bucket.key,
    label: bucket.label,
    recommendation: bucket.recommendation,
    stance,
    confidence: bucket.confidence,
    confidenceGrade: bucket.confidenceGrade,
    sampleSize: bucket.sampleSize,
    displayEligible,
    productionTier: match.productionTier,
    roleTier: match.roleTier,
    trajectoryFromPrevious: match.trajectoryFromPrevious,
    improvedOrSustainedRate: bucket.improvedOrSustainedRate,
    breakoutOrProgressionRate: bucket.breakoutOrProgressionRate,
    regressionOrCollapseRate: bucket.regressionOrCollapseRate,
    materialFailureRate: bucket.failureRiskRate,
    medianNextProductionDelta: bucket.medianNextProductionDelta,
    medianNextRoleDelta: bucket.medianNextRoleDelta,
    primaryFailureMode,
    summary: buildReceiptSummary(bucket),
    note: displayEligible
      ? 'Historical production/role receipt is eligible to appear in player reads.'
      : 'Historical receipt kept internal because the sample is neutral, thin, or blocked by player evidence.',
    derivedFrom: match.derivedFrom,
  };
}

export function attachPlayerSeasonOutcomeReceipts(input: {
  profilesById: Record<string, PlayerCohortProfile>;
  playerDetailsById: Record<string, PlayerDetails>;
  calibration?: CompactPlayerSeasonCalibration | null;
}): Record<string, PlayerCohortProfile> {
  const calibration = input.calibration === undefined
    ? loadPublishedPlayerCohortCalibration()
    : input.calibration;
  if (!calibration?.buckets?.length) return input.profilesById;

  return Object.fromEntries(
    Object.entries(input.profilesById).map(([playerId, profile]) => {
      const details = input.playerDetailsById[playerId];
      const receipt = details ? buildPlayerSeasonOutcomeReceipt({ profile, details, calibration }) : null;
      return [
        playerId,
        {
          ...profile,
          seasonOutcomeReceipt: receipt,
          trace: receipt
            ? [
              ...profile.trace,
              `Season outcome receipt: ${receipt.summary}`,
              `Season receipt derivation: ${receipt.derivedFrom.join('; ')}.`,
            ]
            : profile.trace,
        },
      ];
    })
  );
}
