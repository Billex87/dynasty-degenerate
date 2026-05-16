import type { PlayerCohortDraftCapital, PlayerCohortOutcomeBucket, PlayerCohortPhase, PlayerCohortProfile, PlayerDetails } from '../shared/types';

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
}): PlayerCohortOutcomeBucket {
  if (input.productionScore === null || input.marketScore === null || input.marketProductionDelta === null) return 'thin-signal';
  if ((input.avgGamesMissed || 0) >= 4 && (input.availabilitySeasons || 0) >= 2) return 'injury-risk';
  if ((input.agePhase === 'decline' || input.agePhase === 'late-prime') && input.marketScore >= 58 && input.productionScore < 55) return 'fade-risk';
  if (input.marketProductionDelta >= 24) return 'market-over-production';
  if (input.marketProductionDelta <= -18) return 'market-under-production';
  if (input.agePhase === 'early' && input.productionScore >= 55) return 'breakout';
  return 'sustain';
}

function getConfidence(details: PlayerDetails, productionScore: number | null, marketScore: number | null): number {
  const sources = sourceCount(details);
  const availability = details.availabilitySeasons || 0;
  const draftCapital = getDraftCapital(details);
  return Math.round(clamp(
    28
    + Math.min(30, sources * 6)
    + (productionScore === null ? 0 : 16)
    + (marketScore === null ? 0 : 14)
    + Math.min(12, availability * 4)
    + (draftCapital.tier === 'unknown' ? 0 : draftCapital.tier === 'premium' ? 6 : 3),
    0,
    100,
  ));
}

function buildTrace(input: {
  details: PlayerDetails;
  value: number | null;
  agePhase: PlayerCohortPhase;
  productionScore: number | null;
  marketProductionDelta: number | null;
  outcomeBucket: PlayerCohortOutcomeBucket;
  draftCapital: PlayerCohortDraftCapital;
}): string[] {
  return [
    input.agePhase !== 'unknown' ? `Age phase: ${input.agePhase}.` : 'Age phase is unavailable.',
    `Draft capital: ${input.draftCapital.label}; ${input.draftCapital.note}`,
    input.value !== null ? `Primary value: ${input.value}.` : 'Primary value is unavailable.',
    input.productionScore !== null ? `Production score: ${input.productionScore}.` : 'Production score is unavailable.',
    input.marketProductionDelta !== null ? `Market vs production delta: ${input.marketProductionDelta}.` : 'Market-production delta is unavailable.',
    `Outcome bucket: ${input.outcomeBucket}.`,
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
    .map(([playerId, details]) => {
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
      });
      const confidence = getConfidence(details, productionScore, marketScore);

      return {
        playerId,
        details,
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
          draftCapital,
          peers: [],
          trace: [] as string[],
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const profilesById: Record<string, PlayerCohortProfile> = {};
  for (const row of baseProfiles) {
    const peers = baseProfiles
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
      trace: buildTrace({
        details: row.details,
        value: row.profile.value,
        agePhase: row.profile.agePhase,
        productionScore: row.profile.productionScore,
        marketProductionDelta: row.profile.marketProductionDelta,
        outcomeBucket: row.profile.outcomeBucket,
        draftCapital: row.profile.draftCapital,
      }),
    };
  }

  return profilesById;
}
