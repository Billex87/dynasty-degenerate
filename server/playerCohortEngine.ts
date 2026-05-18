import type { PlayerCohortDraftCapital, PlayerCohortEvidenceGrade, PlayerCohortOutcomeBucket, PlayerCohortPhase, PlayerCohortProfile, PlayerDetails } from '../shared/types';

const AGE_CURVES: Record<string, { earlyMax: number; primeMax: number; latePrimeMax: number }> = {
  QB: { earlyMax: 26, primeMax: 32, latePrimeMax: 36 },
  RB: { earlyMax: 23, primeMax: 26, latePrimeMax: 28 },
  WR: { earlyMax: 24, primeMax: 29, latePrimeMax: 31 },
  TE: { earlyMax: 25, primeMax: 30, latePrimeMax: 32 },
};

const PPG_BASELINES: Record<string, { replacement: number; elite: number }> = {
  QB: { replacement: 12, elite: 24 },
  RB: { replacement: 7, elite: 20 },
  WR: { replacement: 7, elite: 20 },
  TE: { replacement: 5, elite: 15 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value: unknown): number | null {
  const parsed = numeric(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function getPrimaryValue(details: PlayerDetails, mode: 'dynasty' | 'redraft'): number | null {
  const profile = details.valueProfile;
  if (!profile) return null;
  if (mode === 'redraft') {
    return positive(profile.seasonValue)
      ?? positive(profile.fantasyProsSeasonValue)
      ?? positive(profile.fantasyCalcRedraft)
      ?? positive(profile.dynastyValue)
      ?? null;
  }
  return positive(profile.dynastyValue)
    ?? positive(profile.balancedValue)
    ?? positive(profile.marketKtc)
    ?? positive(profile.fantasyCalcDynasty)
    ?? null;
}

function getAgePhase(position: string, age: number | null): PlayerCohortPhase {
  if (!age) return 'unknown';
  const curve = AGE_CURVES[position];
  if (!curve) return 'unknown';
  if (age <= curve.earlyMax) return 'early';
  if (age <= curve.primeMax) return 'prime';
  if (age <= curve.latePrimeMax) return 'late-prime';
  return 'decline';
}

function getProductionScore(position: string, pointsPerGame: number | null, games: number | null): number | null {
  if (pointsPerGame === null) return null;
  const baseline = PPG_BASELINES[position];
  if (!baseline) return null;
  const raw = ((pointsPerGame - baseline.replacement) / Math.max(1, baseline.elite - baseline.replacement)) * 100;
  const gamesMultiplier = games === null ? 0.85 : clamp(games / 14, 0.45, 1);
  return Math.round(clamp(raw, 0, 100) * gamesMultiplier);
}

function getMarketScore(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(clamp((value / 8500) * 100, 0, 100));
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
    ].filter((value) => positive(value) !== null).length,
  );
}

function scoreSignal(key: string, label: string, score: number | null, detail: string, tone?: HistoricalCompSignal['tone']): HistoricalCompSignal | null {
  if (score === null || !Number.isFinite(score)) return null;
  const rounded = Math.round(clamp(score, 0, 100));
  return {
    key,
    label,
    score: rounded,
    tone: tone || (rounded >= 72 ? 'good' : rounded >= 48 ? 'info' : rounded >= 28 ? 'warn' : 'danger'),
    detail,
  };
}

function getUsageScore(details: PlayerDetails, position: string): number | null {
  const usage = details.usageTrend;
  if (!usage) return null;
  const targetShare = usage.avgTargetShare !== null && usage.avgTargetShare !== undefined ? usage.avgTargetShare * 100 : null;
  const snapPct = usage.avgOffenseSnapPct !== null && usage.avgOffenseSnapPct !== undefined ? usage.avgOffenseSnapPct * 100 : null;
  const ppg = usage.fantasyPointsPprPerGame;
  const wopr = usage.wopr !== null && usage.wopr !== undefined ? usage.wopr * 100 : null;
  const trendBoost = usage.targetTrend === 'up' || usage.carryTrend === 'up'
    ? 8
    : usage.targetTrend === 'down' || usage.carryTrend === 'down'
    ? -8
    : 0;

  if (position === 'RB') {
    const carryWork = clamp((usage.carries / Math.max(1, usage.games)) * 9, 0, 52);
    const receivingWork = clamp((usage.receptions / Math.max(1, usage.games)) * 10, 0, 30);
    return Math.round(clamp(carryWork + receivingWork + (ppg || 0) * 1.8 + trendBoost, 0, 100));
  }

  if (position === 'QB') {
    const rushWork = clamp((usage.carries / Math.max(1, usage.games)) * 8, 0, 32);
    return Math.round(clamp((ppg || 0) * 3 + rushWork + trendBoost, 0, 100));
  }

  const receivingScore = [
    targetShare !== null ? targetShare * 2.1 : null,
    snapPct !== null ? snapPct * 0.24 : null,
    wopr !== null ? wopr * 0.42 : null,
    ppg !== null && ppg !== undefined ? ppg * (position === 'TE' ? 4.2 : 3.2) : null,
  ].filter((value): value is number => value !== null && Number.isFinite(value));

  if (!receivingScore.length) return null;
  return Math.round(clamp(receivingScore.reduce((sum, value) => sum + value, 0) + trendBoost, 0, 100));
}

function getOpportunityScore(details: PlayerDetails): number | null {
  const room = details.rosterRoom;
  if (!room) return null;
  const delta = room.opportunityDelta;
  const base = room.competitionLevel === 'thin'
    ? 62
    : room.competitionLevel === 'crowded'
    ? 38
    : 50;
  const deltaScore = delta
    ? clamp(50 + delta.netOpportunityScore * 0.42 + (delta.incumbentPromotionScore || 0) * 0.35, 0, 100)
    : base;
  const qualityBoost = delta?.qualitySignal === 'major-opening'
    ? 18
    : delta?.qualitySignal === 'minor-opening'
    ? 9
    : delta?.qualitySignal === 'major-squeeze'
    ? -18
    : delta?.qualitySignal === 'squeeze'
    ? -9
    : 0;
  return Math.round(clamp((deltaScore + base) / 2 + qualityBoost, 0, 100));
}

function getTeamFitScore(details: PlayerDetails, position: string): number | null {
  const env = details.teamEnvironment;
  if (!env) return null;
  const passRate = env.nonGarbagePassRate ?? env.neutralScriptPassRate ?? env.passRate;
  const pace = env.paceRank ? clamp(38 - env.paceRank, 0, 32) : 14;
  if (position === 'QB' || position === 'WR' || position === 'TE') {
    const passScore = passRate !== null && passRate !== undefined ? clamp((passRate - 0.46) * 210, 0, 60) : 30;
    return Math.round(clamp(24 + passScore + pace, 0, 100));
  }
  const rushRate = env.rushRate ?? (passRate !== null && passRate !== undefined ? 1 - passRate : null);
  const rushScore = rushRate !== null && rushRate !== undefined ? clamp((rushRate - 0.34) * 220, 0, 58) : 28;
  const redZoneRush = env.redZoneRushRate !== null && env.redZoneRushRate !== undefined ? clamp((env.redZoneRushRate - 0.36) * 95, 0, 24) : 10;
  return Math.round(clamp(22 + rushScore + redZoneRush + pace * 0.55, 0, 100));
}

function getInjuryRiskScore(details: PlayerDetails): number | null {
  const history = details.injuryHistory;
  const avgMissed = numeric(details.avgGamesMissed);
  if (!history && avgMissed === null) return null;
  const reportPressure = history ? clamp(history.missedOrLimitedCount * 8, 0, 62) : 0;
  const missedPressure = avgMissed !== null ? clamp(avgMissed * 11, 0, 56) : 0;
  return Math.round(clamp(Math.max(reportPressure, missedPressure), 0, 100));
}

function getProspectScore(details: PlayerDetails, draftCapital: PlayerCohortDraftCapital): number | null {
  const prospect = details.prospectProfile;
  const rating = numeric(prospect?.rating);
  const overallRank = numeric(prospect?.overallRank ?? prospect?.averageOverallRank ?? prospect?.fantasyProsDevyRank);
  const positionRankText = prospect?.fantasyProsDevyPositionRank || (prospect?.positionRank ? `${prospect.position}${prospect.positionRank}` : null);
  const positionRank = positionRankText ? Number(String(positionRankText).replace(/^[A-Z]+/i, '')) : null;
  const pieces = [
    rating !== null ? clamp(rating, 0, 100) : null,
    overallRank !== null ? clamp(100 - overallRank, 0, 100) : null,
    positionRank !== null && Number.isFinite(positionRank) ? clamp(92 - positionRank * 8, 0, 100) : null,
    draftCapital.patienceScore,
  ].filter((value): value is number => value !== null && Number.isFinite(value));
  if (!pieces.length) return null;
  return Math.round(pieces.reduce((sum, value) => sum + value, 0) / pieces.length);
}

function getAthleticScore(details: PlayerDetails, position: string): number | null {
  const athletic = details.athleticProfile;
  if (!athletic) return null;
  const speedScore = numeric(athletic.speedScore);
  const forty = numeric(athletic.forty);
  const vertical = numeric(athletic.vertical);
  const broad = numeric(athletic.broadJump);
  const pieces = [
    speedScore !== null ? clamp((speedScore - 78) * 2.7, 0, 100) : null,
    forty !== null
      ? position === 'QB'
        ? clamp((5.05 - forty) * 75, 0, 100)
        : clamp((4.85 - forty) * 145, 0, 100)
      : null,
    vertical !== null ? clamp((vertical - 25) * 6.1, 0, 100) : null,
    broad !== null ? clamp((broad - 100) * 3.8, 0, 100) : null,
  ].filter((value): value is number => value !== null && Number.isFinite(value));
  if (!pieces.length) return null;
  return Math.round(pieces.reduce((sum, value) => sum + value, 0) / pieces.length);
}

function getValueMomentumScore(details: PlayerDetails): number | null {
  const deltaPct = numeric(details.valueTimeline?.summary?.deltaPct);
  if (deltaPct === null) return null;
  return Math.round(clamp(50 + deltaPct * 1.35, 0, 100));
}

function getContractScore(details: PlayerDetails): number | null {
  const contract = details.contractProfile;
  if (!contract) return null;
  const tierScore = contract.investmentTier === 'premium'
    ? 86
    : contract.investmentTier === 'solid'
    ? 66
    : contract.investmentTier === 'fringe'
    ? 26
    : 44;
  const years = numeric(contract.years);
  const guarantee = numeric(contract.guaranteed);
  const value = numeric(contract.value);
  const runwayBoost = years !== null ? clamp((years - 1) * 6, 0, 14) : 0;
  const guaranteeBoost = guarantee !== null && value !== null && value > 0 ? clamp((guarantee / value) * 18, 0, 18) : 0;
  return Math.round(clamp(tierScore + runwayBoost + guaranteeBoost, 0, 100));
}

function buildFeatureVector(input: {
  details: PlayerDetails;
  age: number | null;
  value: number | null;
  productionScore: number | null;
  marketProductionDelta: number | null;
  draftCapital: PlayerCohortDraftCapital;
  position: string;
}): CohortFeatureVector {
  return {
    age: input.age,
    valueScore: getMarketScore(input.value),
    productionScore: input.productionScore,
    marketProductionDelta: input.marketProductionDelta,
    draftPatience: input.draftCapital.patienceScore,
    usageScore: getUsageScore(input.details, input.position),
    opportunityScore: getOpportunityScore(input.details),
    teamFitScore: getTeamFitScore(input.details, input.position),
    injuryRiskScore: getInjuryRiskScore(input.details),
    prospectScore: getProspectScore(input.details, input.draftCapital),
    athleticScore: getAthleticScore(input.details, input.position),
    valueMomentumScore: getValueMomentumScore(input.details),
    contractScore: getContractScore(input.details),
  };
}

type PlayerCohortCalibration = PlayerCohortProfile['calibration'];
type HistoricalCompSignal = NonNullable<PlayerCohortProfile['historicalComps']>['signals'][number];

type CohortFeatureVector = {
  age: number | null;
  valueScore: number | null;
  productionScore: number | null;
  marketProductionDelta: number | null;
  draftPatience: number | null;
  usageScore: number | null;
  opportunityScore: number | null;
  teamFitScore: number | null;
  injuryRiskScore: number | null;
  prospectScore: number | null;
  athleticScore: number | null;
  valueMomentumScore: number | null;
  contractScore: number | null;
};

type BaseProfileRow = {
  playerId: string;
  details: PlayerDetails;
  features: CohortFeatureVector;
  profile: PlayerCohortProfile;
};

function playerNameKey(name: unknown): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isTopReturningDepthPlayer(details: PlayerDetails): boolean {
  const topReturning = details.rosterRoom?.opportunityDelta?.topReturningDepthPlayer;
  return Boolean(topReturning && playerNameKey(topReturning) === playerNameKey(details.fullName));
}

function hasBreakoutOpportunitySignal(details: PlayerDetails): boolean {
  const delta = details.rosterRoom?.opportunityDelta;
  if (!delta) return false;
  if ((delta.qualitySignal === 'major-opening' || delta.qualitySignal === 'minor-opening') && delta.vacatedImpactScore >= 40) return true;
  return isTopReturningDepthPlayer(details)
    && (delta.incumbentOpportunitySignal === 'major-promotion' || delta.incumbentOpportunitySignal === 'minor-promotion');
}

function getDraftCapital(details: PlayerDetails): PlayerCohortDraftCapital {
  const round = positive(details.nflDraftRound);
  const pick = positive(details.nflDraftPick);
  const yearsExp = numeric(details.yearsExp);
  const hasDraftSignal = round !== null || pick !== null;
  const hasNflSignal = hasDraftSignal || (details.rookieYear !== null && details.rookieYear !== undefined) || yearsExp !== null;
  const tier = (round !== null && round <= 1) || (pick !== null && pick <= 32)
    ? 'premium'
    : (round !== null && round <= 3) || (pick !== null && pick <= 100)
    ? 'day-two'
    : (round !== null && round <= 7) || pick !== null
    ? 'late-round'
    : hasNflSignal
    ? 'undrafted'
    : 'unknown';

  const basePatience = tier === 'premium'
    ? 88
    : tier === 'day-two'
    ? 72
    : tier === 'late-round'
    ? 48
    : tier === 'undrafted'
    ? 34
    : null;
  const experienceAdjustment = yearsExp === null
    ? 0
    : yearsExp <= 0
    ? 8
    : yearsExp === 1
    ? 2
    : yearsExp === 2
    ? -8
    : -16;
  const patienceScore = basePatience === null ? null : Math.round(clamp(basePatience + experienceAdjustment, 18, 96));
  const opportunityWindow = patienceScore === null
    ? 'unknown'
    : patienceScore >= 76
    ? 'protected-runway'
    : patienceScore >= 46
    ? 'prove-it-window'
    : 'short-leash';
  const label = round !== null
    ? `Round ${round}${pick !== null ? `, pick ${pick}` : ''}`
    : pick !== null
    ? `Pick ${pick}`
    : tier === 'undrafted'
    ? 'Undrafted/low-capital profile'
    : 'Draft capital unknown';
  const note = opportunityWindow === 'protected-runway'
    ? 'Draft capital should buy patience, so weak early production is a warning flag, not an automatic opportunity loss.'
    : opportunityWindow === 'prove-it-window'
    ? 'Draft capital gives some runway, but role and production need to show up before the market keeps paying.'
    : opportunityWindow === 'short-leash'
    ? 'Low draft capital usually means opportunity has to be earned quickly through role, health, or production.'
    : 'Draft-capital runway is not available, so opportunity confidence stays conservative.';

  return {
    round,
    pick,
    tier,
    label,
    opportunityWindow,
    patienceScore,
    note,
  };
}

function getOutcomeBucket(input: {
  agePhase: PlayerCohortPhase;
  productionScore: number | null;
  marketScore: number | null;
  marketProductionDelta: number | null;
  avgGamesMissed: number | null;
  availabilitySeasons: number | null;
  breakoutOpportunitySignal?: boolean;
  draftCapitalTier?: PlayerCohortDraftCapital['tier'];
}): PlayerCohortOutcomeBucket {
  if (input.productionScore === null || input.marketScore === null || input.marketProductionDelta === null) return 'thin-signal';
  if ((input.avgGamesMissed || 0) >= 4 && (input.availabilitySeasons || 0) >= 2) return 'injury-risk';
  if ((input.agePhase === 'decline' || input.agePhase === 'late-prime') && input.marketScore >= 58 && input.productionScore < 55) return 'fade-risk';
  if (
    input.agePhase === 'early'
    && input.breakoutOpportunitySignal
    && (input.draftCapitalTier === 'premium' || input.draftCapitalTier === 'day-two' || (input.marketScore || 0) >= 45)
  ) return 'breakout';
  if (input.marketProductionDelta >= 24) return 'market-over-production';
  if (input.marketProductionDelta <= -18) return 'market-under-production';
  if (input.agePhase === 'early' && input.productionScore >= 55) return 'breakout';
  return 'sustain';
}

function getRawConfidence(details: PlayerDetails, productionScore: number | null, marketScore: number | null, draftCapital: PlayerCohortDraftCapital): number {
  const sources = sourceCount(details);
  const availability = details.availabilitySeasons || 0;
  return Math.round(clamp(
    28
    + Math.min(30, sources * 6)
    + (productionScore === null ? 0 : 16)
    + (marketScore === null ? 0 : 14)
    + Math.min(12, availability * 4)
    + (draftCapital.tier === 'unknown' ? 0 : draftCapital.tier === 'premium' ? 6 : 3)
    + (details.usageTrend ? 5 : 0)
    + (details.teamEnvironment ? 3 : 0)
    + (details.rosterRoom ? 3 : 0)
    + (details.rosterRoom?.opportunityDelta ? 3 : 0)
    + (details.contractProfile?.investmentTier === 'premium' ? 4 : details.contractProfile?.investmentTier === 'solid' ? 2 : 0)
    + (details.athleticProfile ? 2 : 0),
    0,
    100,
  ));
}

function featureSimilarity(a: number | null, b: number | null, maxDistance: number): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return clamp(1 - Math.abs(a - b) / maxDistance, 0, 1);
}

function getSimilarityScore(a: CohortFeatureVector, b: CohortFeatureVector): { score: number; usedWeight: number } {
  const weighted = [
    { value: featureSimilarity(a.age, b.age, 7), weight: 1.1 },
    { value: featureSimilarity(a.valueScore, b.valueScore, 42), weight: 1.2 },
    { value: featureSimilarity(a.productionScore, b.productionScore, 38), weight: 1.15 },
    { value: featureSimilarity(a.marketProductionDelta, b.marketProductionDelta, 48), weight: 0.9 },
    { value: featureSimilarity(a.draftPatience, b.draftPatience, 48), weight: 0.9 },
    { value: featureSimilarity(a.usageScore, b.usageScore, 42), weight: 1.2 },
    { value: featureSimilarity(a.opportunityScore, b.opportunityScore, 48), weight: 1.2 },
    { value: featureSimilarity(a.teamFitScore, b.teamFitScore, 42), weight: 0.7 },
    { value: featureSimilarity(a.injuryRiskScore, b.injuryRiskScore, 52), weight: 0.65 },
    { value: featureSimilarity(a.prospectScore, b.prospectScore, 44), weight: 0.8 },
    { value: featureSimilarity(a.athleticScore, b.athleticScore, 44), weight: 0.55 },
    { value: featureSimilarity(a.valueMomentumScore, b.valueMomentumScore, 54), weight: 0.75 },
    { value: featureSimilarity(a.contractScore, b.contractScore, 48), weight: 0.65 },
  ];
  const usable = weighted.filter((item): item is { value: number; weight: number } => item.value !== null);
  if (!usable.length) return { score: 0, usedWeight: 0 };
  const totalWeight = usable.reduce((sum, item) => sum + item.weight, 0);
  const score = usable.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
  return {
    score: Math.round(clamp(score * 100, 0, 100)),
    usedWeight: Math.round(totalWeight * 10) / 10,
  };
}

function closeEnough(a: number | null, b: number | null, maxDistance: number): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= maxDistance;
}

function buildMatchReasons(row: BaseProfileRow, candidate: BaseProfileRow): string[] {
  const reasons: string[] = [];
  if (row.profile.agePhase === candidate.profile.agePhase && row.profile.agePhase !== 'unknown') reasons.push(`same ${row.profile.agePhase} age phase`);
  if (closeEnough(row.features.valueScore, candidate.features.valueScore, 12)) reasons.push('similar market tier');
  if (closeEnough(row.features.productionScore, candidate.features.productionScore, 12)) reasons.push('similar production baseline');
  if (closeEnough(row.features.usageScore, candidate.features.usageScore, 14)) reasons.push('similar usage shape');
  if (closeEnough(row.features.opportunityScore, candidate.features.opportunityScore, 16)) reasons.push('similar opportunity window');
  if (row.profile.draftCapital.tier === candidate.profile.draftCapital.tier && row.profile.draftCapital.tier !== 'unknown') reasons.push(`${row.profile.draftCapital.tier} draft-capital match`);
  if (closeEnough(row.features.prospectScore, candidate.features.prospectScore, 14)) reasons.push('similar prospect/buzz signal');
  if (closeEnough(row.features.athleticScore, candidate.features.athleticScore, 16)) reasons.push('similar athletic profile');
  if (closeEnough(row.features.valueMomentumScore, candidate.features.valueMomentumScore, 16)) reasons.push('similar value momentum');
  if (closeEnough(row.features.contractScore, candidate.features.contractScore, 16)) reasons.push('similar contract runway');
  return reasons.slice(0, 6);
}

function resultSignalFor(profile: PlayerCohortProfile): string {
  switch (profile.outcomeBucket) {
    case 'breakout':
      return 'Riser-style profile';
    case 'market-under-production':
      return 'Production outran price';
    case 'market-over-production':
      return 'Price outran production';
    case 'fade-risk':
      return 'Fade-risk profile';
    case 'injury-risk':
      return 'Availability-tax profile';
    case 'sustain':
      return 'Hold/sustain profile';
    default:
      return 'Thin-signal comp';
  }
}

function dominantOutcome(comps: Array<{ outcomeBucket: PlayerCohortOutcomeBucket }>): PlayerCohortOutcomeBucket | null {
  if (!comps.length) return null;
  const counts = new Map<PlayerCohortOutcomeBucket, number>();
  comps.forEach((comp) => counts.set(comp.outcomeBucket, (counts.get(comp.outcomeBucket) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function buildArchetype(row: BaseProfileRow): string {
  const { profile, features, details } = row;
  const phase = profile.agePhase === 'unknown' ? '' : `${profile.agePhase.replace('-', ' ')} `;
  const hasProspectRunway = profile.agePhase === 'early'
    && ((features.prospectScore || 0) >= 72 || (features.athleticScore || 0) >= 78 || profile.draftCapital.opportunityWindow === 'protected-runway');
  const hasContractRunway = (features.contractScore || 0) >= 72;
  if (profile.outcomeBucket === 'breakout' && (features.opportunityScore || 0) >= 62) return `${phase}${profile.position} opportunity riser`;
  if (profile.outcomeBucket === 'breakout') return `${phase}${profile.position} growth profile`;
  if (profile.outcomeBucket === 'market-over-production' && hasProspectRunway) return `${phase}${profile.position} prospect heat check`;
  if (profile.outcomeBucket === 'market-over-production' && hasContractRunway) return `${phase}${profile.position} paid-runway heat check`;
  if (profile.outcomeBucket === 'market-over-production') return `${profile.position} market heat check`;
  if (profile.outcomeBucket === 'market-under-production') return `${profile.position} production discount`;
  if (profile.outcomeBucket === 'fade-risk') return `${profile.position} curve-risk veteran`;
  if (profile.outcomeBucket === 'injury-risk') return `${profile.position} availability-tax profile`;
  if (hasProspectRunway || details.prospectProfile?.rating) return `${phase}${profile.position} prospect-backed runway`.trim();
  if (hasContractRunway) return `${phase}${profile.position} contract-backed runway`.trim();
  if ((features.teamFitScore || 0) >= 72) return `${profile.position} environment boost`;
  return `${phase}${profile.position} sustain profile`.trim();
}

function buildMarketGapSignal(row: BaseProfileRow): HistoricalCompSignal | null {
  const delta = row.profile.marketProductionDelta;
  if (delta === null || !Number.isFinite(delta)) return null;
  const pressure = Math.round(clamp(50 + Math.abs(delta) * 1.15, 0, 100));
  const tone: HistoricalCompSignal['tone'] = delta >= 24
    ? 'warn'
    : delta <= -18
    ? 'good'
    : Math.abs(delta) <= 8
    ? 'neutral'
    : 'info';
  const detail = delta > 0
    ? `Market score is ${Math.round(delta)} points ahead of the production score; the price needs role, prospect, contract, or environment support.`
    : delta < 0
    ? `Production score is ${Math.abs(Math.round(delta))} points ahead of the market score; check for an underpriced scoring profile.`
    : 'Market and production scores are even.';

  return {
    key: 'market-gap',
    label: 'Price vs Production Gap',
    score: pressure,
    tone,
    detail,
  };
}

function buildHistoricalSignals(row: BaseProfileRow): HistoricalCompSignal[] {
  const details = row.details;
  const features = row.features;
  return [
    buildMarketGapSignal(row),
    scoreSignal('value', 'Market Value', features.valueScore, row.profile.value !== null ? `Current blended value ${row.profile.value}.` : 'No blended value available.'),
    scoreSignal('production', 'Production Baseline', features.productionScore, row.profile.lastSeasonPointsPerGame !== null ? `${row.profile.lastSeasonPointsPerGame} PPG in the latest completed season.` : 'No latest-season production baseline.'),
    scoreSignal('usage', 'Usage Shape', features.usageScore, details.usageTrend?.note || 'No usage trend snapshot.', features.usageScore !== null && features.usageScore >= 68 ? 'good' : undefined),
    scoreSignal('opportunity', 'Opportunity Math', features.opportunityScore, details.rosterRoom?.opportunityDelta?.note || details.rosterRoom?.note || 'No roster-room delta snapshot.'),
    scoreSignal('runway', 'Draft Runway', features.draftPatience, row.profile.draftCapital.note, row.profile.draftCapital.opportunityWindow === 'protected-runway' ? 'good' : row.profile.draftCapital.opportunityWindow === 'short-leash' ? 'warn' : undefined),
    scoreSignal('prospect', 'Buzz / Devy Prior', features.prospectScore, details.prospectProfile?.rating ? `Draft Buzz/prospect rating ${details.prospectProfile.rating}.` : 'Prospect prior from draft capital and profile data.'),
    scoreSignal('athletic', 'Athletic Fit', features.athleticScore, details.athleticProfile?.note || 'No combine profile attached.'),
    scoreSignal('contract', 'Contract / Team Investment', features.contractScore, details.contractProfile?.note || 'No contract investment snapshot.'),
    scoreSignal('team', 'Team Environment', features.teamFitScore, details.teamEnvironment?.note || 'No team environment snapshot.'),
    scoreSignal('momentum', 'Value Momentum', features.valueMomentumScore, details.valueTimeline?.summary?.note || 'No value timeline movement available.'),
    scoreSignal('risk', 'Availability Risk', features.injuryRiskScore, details.injuryHistory?.note || (details.avgGamesMissed !== null && details.avgGamesMissed !== undefined ? `${details.avgGamesMissed} average missed games.` : 'No injury risk signal.'), features.injuryRiskScore !== null && features.injuryRiskScore >= 55 ? 'warn' : 'info'),
  ].filter((signal): signal is HistoricalCompSignal => Boolean(signal));
}

function buildHistoricalComps(row: BaseProfileRow, baseProfiles: BaseProfileRow[], peerLimit: number): NonNullable<PlayerCohortProfile['historicalComps']> {
  const sample = baseProfiles.filter((candidate) => candidate.playerId !== row.playerId && candidate.profile.position === row.profile.position);
  const scored = sample
    .map((candidate) => ({
      candidate,
      ...getSimilarityScore(row.features, candidate.features),
    }))
    .filter((item) => item.usedWeight >= 2.4)
    .sort((a, b) => b.score - a.score);
  const reliableSampleSize = scored.length;
  const closest = scored.slice(0, Math.max(3, peerLimit)).map(({ candidate, score }) => ({
    playerId: candidate.playerId,
    name: candidate.profile.name,
    age: candidate.profile.age,
    value: candidate.profile.value,
    lastSeasonPointsPerGame: candidate.profile.lastSeasonPointsPerGame,
    similarity: score,
    outcomeBucket: candidate.profile.outcomeBucket,
    matchReasons: buildMatchReasons(row, candidate),
    resultSignal: resultSignalFor(candidate.profile),
  }));
  const averageSimilarity = closest.length
    ? Math.round(closest.reduce((sum, comp) => sum + comp.similarity, 0) / closest.length)
    : null;
  const consensusOutcome = dominantOutcome(closest);
  const signals = buildHistoricalSignals(row);
  const strongestSignal = [...signals].sort((a, b) => b.score - a.score)[0] || null;
  const riskSignal = [...signals].filter((signal) => signal.tone === 'warn' || signal.tone === 'danger').sort((a, b) => b.score - a.score)[0] || null;
  const confidence = Math.round(clamp(
    28
    + Math.min(30, reliableSampleSize * 7)
    + (averageSimilarity !== null ? averageSimilarity * 0.28 : 0)
    + Math.min(18, signals.length * 2)
    - (row.profile.calibration.evidenceGrade === 'blocked' ? 24 : row.profile.calibration.evidenceGrade === 'thin' ? 10 : 0),
    0,
    row.profile.calibration.confidenceCap,
  ));
  const archetype = buildArchetype(row);
  const compText = closest.length
    ? `Closest stored comps average ${averageSimilarity}% similarity across ${reliableSampleSize} reliable same-position comps (${sample.length} profiles checked); consensus outcome is ${consensusOutcome || 'mixed'}.`
    : sample.length
    ? `No reliable same-position comp sample was available from ${sample.length} profiles checked, so this read leans on direct player signals instead of peer history.`
    : `No same-position comp sample was available, so this read leans on direct player signals instead of peer history.`;
  const signalText = strongestSignal
    ? `Top signal is ${strongestSignal.label.toLowerCase()} (${strongestSignal.score}).`
    : 'No top signal separated from the sample.';
  const riskText = riskSignal && riskSignal.key !== strongestSignal?.key
    ? ` Main caution is ${riskSignal.label.toLowerCase()} (${riskSignal.score}).`
    : '';

  return {
    archetype,
    summary: `${archetype}: ${compText} ${signalText}${riskText}`.replace(/\s+/g, ' ').trim(),
    sampleSize: reliableSampleSize,
    confidence,
    averageSimilarity,
    consensusOutcome,
    signals,
    closest,
  };
}

function buildCalibration(input: {
  details: PlayerDetails;
  value: number | null;
  agePhase: PlayerCohortPhase;
  productionScore: number | null;
  marketScore: number | null;
  marketProductionDelta: number | null;
  draftCapital: PlayerCohortDraftCapital;
}): PlayerCohortCalibration {
  const sources = sourceCount(input.details);
  const missingSignals: string[] = [];
  const cautionFlags: string[] = [];
  const hasIdentity = Boolean(input.details.externalIds?.gsis || input.details.externalIds?.pfr || input.details.externalIds?.espn || input.details.externalIds?.fantasyPros);

  if (input.value === null || input.marketScore === null) missingSignals.push('market value');
  if (input.productionScore === null) missingSignals.push('last-season production');
  if (input.agePhase === 'unknown') missingSignals.push('age curve');
  if (sources < 2) missingSignals.push('multi-source value support');
  if (!input.details.usageTrend) missingSignals.push('usage/snap trend');
  if (!input.details.teamEnvironment) missingSignals.push('team pass/run environment');
  if (!input.details.rosterRoom) missingSignals.push('roster-room delta');
  if (input.draftCapital.tier === 'unknown') missingSignals.push('draft-capital runway');
  if (!hasIdentity) missingSignals.push('cross-source player ID');

  if (input.details.injuryHistory && input.details.injuryHistory.missedOrLimitedCount >= 5) cautionFlags.push('recurring injury-report signal');
  if (input.details.contractProfile?.investmentTier === 'fringe') cautionFlags.push('weak veteran contract insulation');
  if (input.details.newsValueMovement?.valueDeltaPct === null) cautionFlags.push('news attached without value baseline movement');
  if (input.marketProductionDelta !== null && Math.abs(input.marketProductionDelta) >= 30) cautionFlags.push('large market-production disagreement');
  if (input.details.usageTrend?.targetTrend === 'down' || input.details.usageTrend?.carryTrend === 'down') cautionFlags.push('declining recent usage window');
  if (input.details.rosterRoom?.competitionLevel === 'crowded') cautionFlags.push('crowded position room');
  if (input.details.rosterRoom?.premiumAdditions.length) cautionFlags.push('premium same-position addition');
  if (input.details.rosterRoom?.opportunityDelta?.qualitySignal === 'major-squeeze') cautionFlags.push('high-quality same-position addition pressure');
  if (input.details.rosterRoom?.opportunityDelta?.incumbentOpportunitySignal === 'blocked' && isTopReturningDepthPlayer(input.details)) cautionFlags.push('returning role blocked by incoming production');
  if (input.details.rosterRoom?.movementTypes?.includes('trade')) cautionFlags.push('same-position trade movement');
  if (input.details.rosterRoom?.weeklyCoverage && input.details.rosterRoom.weeklyCoverage.currentSeasonPlayers + input.details.rosterRoom.weeklyCoverage.previousSeasonPlayers === 0) {
    cautionFlags.push('roster movement timing unavailable');
  }

  const evidenceScore = Math.round(clamp(
    12
    + Math.min(24, sources * 8)
    + (input.value === null ? 0 : 14)
    + (input.productionScore === null ? 0 : 16)
    + (input.agePhase === 'unknown' ? 0 : 10)
    + (input.details.usageTrend ? 10 : 0)
    + (input.details.teamEnvironment ? 6 : 0)
    + (input.details.rosterRoom ? 6 : 0)
    + (input.details.rosterRoom?.opportunityDelta ? 4 : 0)
    + (input.draftCapital.tier === 'unknown' ? 0 : 8)
    + (hasIdentity ? 6 : 0),
    0,
    100,
  ));
  const evidenceGrade: PlayerCohortEvidenceGrade = missingSignals.includes('market value') || missingSignals.includes('last-season production')
    ? 'blocked'
    : evidenceScore >= 78 && missingSignals.length <= 1
    ? 'strong'
    : evidenceScore >= 58 && missingSignals.length <= 3
    ? 'usable'
    : 'thin';
  const confidenceCap = evidenceGrade === 'strong'
    ? 92
    : evidenceGrade === 'usable'
    ? 78
    : evidenceGrade === 'thin'
    ? 58
    : 46;
  const strongReadEligible = evidenceGrade === 'strong' && cautionFlags.length <= 1;
  const note = strongReadEligible
    ? 'Strong read eligible: value, production, age, usage, and identity evidence are aligned enough for a louder player read.'
    : evidenceGrade === 'blocked'
    ? `Blocked from a strong read until ${missingSignals.slice(0, 2).join(' and ')} are available.`
    : evidenceGrade === 'thin'
    ? `Thin read: keep language cautious until ${missingSignals.slice(0, 3).join(', ') || 'more evidence'} improves.`
    : cautionFlags.length
    ? `Usable read, but confidence is capped by ${cautionFlags.slice(0, 2).join(' and ')}.`
    : 'Usable read: enough evidence for direction, but not enough for max-confidence language.';

  return {
    evidenceGrade,
    evidenceScore,
    confidenceCap,
    strongReadEligible,
    missingSignals,
    cautionFlags,
    note,
  };
}

function buildTrace(input: {
  details: PlayerDetails;
  value: number | null;
  agePhase: PlayerCohortPhase;
  productionScore: number | null;
  marketProductionDelta: number | null;
  outcomeBucket: PlayerCohortOutcomeBucket;
  draftCapital: PlayerCohortDraftCapital;
  calibration: PlayerCohortCalibration;
}): string[] {
  return [
    `Calibration: ${input.calibration.note}`,
    input.agePhase !== 'unknown' ? `Age phase: ${input.agePhase}.` : 'Age phase is unavailable.',
    `Draft capital: ${input.draftCapital.label}; ${input.draftCapital.note}`,
    input.details.contractProfile ? `Contract context: ${input.details.contractProfile.note}` : 'Contract context is unavailable.',
    input.details.usageTrend ? `Usage trend: ${input.details.usageTrend.note}` : 'Usage trend is unavailable.',
    input.details.teamEnvironment ? `Team environment: ${input.details.teamEnvironment.note}` : 'Team pass/run environment is unavailable.',
    input.details.rosterRoom ? `Roster room: ${input.details.rosterRoom.note}` : 'Roster-room delta is unavailable.',
    input.details.rosterRoom?.opportunityDelta ? `Opportunity math: ${input.details.rosterRoom.opportunityDelta.note}` : 'Opportunity math is unavailable.',
    input.details.athleticProfile ? `Athletic profile: ${input.details.athleticProfile.note}` : 'Athletic profile is unavailable.',
    input.details.injuryHistory ? `Injury history: ${input.details.injuryHistory.note}` : 'Injury history is unavailable.',
    input.details.newsValueMovement ? `News/value movement: ${input.details.newsValueMovement.note}` : 'News/value movement is unavailable.',
    input.value !== null ? `Primary value: ${input.value}.` : 'Primary value is unavailable.',
    input.productionScore !== null ? `Production score: ${input.productionScore}.` : 'Production score is unavailable.',
    input.marketProductionDelta !== null ? `Market vs production delta: ${input.marketProductionDelta}.` : 'Market-production delta is unavailable.',
    `Outcome bucket: ${input.outcomeBucket}.`,
    `Evidence grade: ${input.calibration.evidenceGrade}; evidence score ${input.calibration.evidenceScore}; confidence cap ${input.calibration.confidenceCap}.`,
    input.calibration.missingSignals.length ? `Missing signals: ${input.calibration.missingSignals.join(', ')}.` : 'No major calibration gaps detected.',
    input.calibration.cautionFlags.length ? `Caution flags: ${input.calibration.cautionFlags.join(', ')}.` : 'No major caution flags detected.',
    `${sourceCount(input.details)} value source signal${sourceCount(input.details) === 1 ? '' : 's'} attached.`,
  ];
}

export function buildPlayerCohortProfiles(input: {
  playerDetailsById: Record<string, PlayerDetails>;
  mode?: 'dynasty' | 'redraft';
  peerLimit?: number;
}): Record<string, PlayerCohortProfile> {
  const mode = input.mode || 'dynasty';
  const peerLimit = Math.max(0, Math.min(12, Math.floor(input.peerLimit ?? 5)));
  const baseProfiles = Object.entries(input.playerDetailsById || {})
    .map(([playerId, details]): BaseProfileRow | null => {
      const position = String(details.position || '').toUpperCase();
      if (!AGE_CURVES[position]) return null;
      const age = numeric(details.age);
      const value = getPrimaryValue(details, mode);
      const lastSeasonPointsPerGame = numeric(details.lastSeasonPointsPerGame);
      const lastSeasonGames = numeric(details.lastSeasonGames);
      const agePhase = getAgePhase(position, age);
      const productionScore = getProductionScore(position, lastSeasonPointsPerGame, lastSeasonGames);
      const marketScore = getMarketScore(value);
      const draftCapital = getDraftCapital(details);
      const marketProductionDelta = marketScore !== null && productionScore !== null
        ? marketScore - productionScore
        : null;
      const outcomeBucket = getOutcomeBucket({
        agePhase,
        productionScore,
        marketScore,
        marketProductionDelta,
        avgGamesMissed: numeric(details.avgGamesMissed),
        availabilitySeasons: numeric(details.availabilitySeasons),
        breakoutOpportunitySignal: hasBreakoutOpportunitySignal(details),
        draftCapitalTier: draftCapital.tier,
      });
      const calibration = buildCalibration({
        details,
        value,
        agePhase,
        productionScore,
        marketScore,
        marketProductionDelta,
        draftCapital,
      });
      const confidence = Math.min(
        getRawConfidence(details, productionScore, marketScore, draftCapital),
        calibration.confidenceCap
      );
      const features = buildFeatureVector({
        details,
        age,
        value,
        productionScore,
        marketProductionDelta,
        draftCapital,
        position,
      });

      return {
        playerId,
        details,
        features,
        profile: {
          playerId,
          name: details.fullName || playerId,
          position,
          age,
          value,
          lastSeasonPointsPerGame,
          agePhase,
          productionScore,
          marketScore,
          marketProductionDelta,
          outcomeBucket,
          confidence,
          calibration,
          draftCapital,
          peers: [],
          historicalComps: undefined,
          trace: [] as string[],
        },
      };
    })
    .filter((row): row is BaseProfileRow => Boolean(row));

  const profilesById: Record<string, PlayerCohortProfile> = {};
  for (const row of baseProfiles) {
    const historicalComps = buildHistoricalComps(row, baseProfiles, peerLimit);
    const peers = historicalComps.closest.length
      ? historicalComps.closest
      : baseProfiles
      .filter((candidate) => candidate.playerId !== row.playerId && candidate.profile.position === row.profile.position)
      .map((candidate) => ({
        candidate,
        distance: Math.abs((candidate.profile.age || 0) - (row.profile.age || 0)) * 2
          + Math.abs((candidate.profile.value || 0) - (row.profile.value || 0)) / 1200
          + Math.abs((candidate.profile.productionScore || 0) - (row.profile.productionScore || 0)) / 12,
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, peerLimit)
      .map(({ candidate }) => ({
        playerId: candidate.playerId,
        name: candidate.profile.name,
        age: candidate.profile.age,
        value: candidate.profile.value,
        lastSeasonPointsPerGame: candidate.profile.lastSeasonPointsPerGame,
      }));

    profilesById[row.playerId] = {
      ...row.profile,
      peers,
      historicalComps,
      trace: [
        ...buildTrace({
          details: row.details,
          value: row.profile.value,
          agePhase: row.profile.agePhase,
          productionScore: row.profile.productionScore,
          marketProductionDelta: row.profile.marketProductionDelta,
          outcomeBucket: row.profile.outcomeBucket,
          draftCapital: row.profile.draftCapital,
          calibration: row.profile.calibration,
        }),
        `Historical comps: ${historicalComps.summary}`,
        historicalComps.closest.length
          ? `Closest comps: ${historicalComps.closest.slice(0, 3).map((comp) => `${comp.name} (${comp.similarity}%, ${comp.resultSignal})`).join('; ')}.`
          : 'Closest comps are unavailable.',
      ],
    };
  }

  return profilesById;
}
