import type { PlayerDetails, PlayerSituationDeltaComponent, PlayerSituationDeltaLabel, PlayerSituationDeltaProfile } from '../shared/types';

type Direction = PlayerSituationDeltaComponent['direction'];
type PlayerSituationDynamicSignal = PlayerSituationDeltaProfile['dynamicSignals'][number];
type PlayerSituationFreshness = PlayerSituationDeltaProfile['freshness'];

const SUPPORTED_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

const AGE_CLIFFS: Record<string, number> = {
  QB: 34,
  RB: 27,
  WR: 29,
  TE: 30,
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

function cleanName(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeText(value?: string | null): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTopReturningDepthPlayer(details: PlayerDetails): boolean {
  const topReturning = details.rosterRoom?.opportunityDelta?.topReturningDepthPlayer;
  return Boolean(topReturning && cleanName(topReturning) === cleanName(details.fullName));
}

function component(
  key: PlayerSituationDeltaComponent['key'],
  label: string,
  score: number,
  direction: Direction,
  trace: string
): PlayerSituationDeltaComponent {
  return { key, label, score: round(score), direction, trace };
}

function labelForScore(score: number, boostLabel: string, riskLabel: string, neutralLabel: string): string {
  if (score >= 65) return boostLabel;
  if (score <= 38) return riskLabel;
  return neutralLabel;
}

function directionForScore(score: number): Direction {
  if (score >= 62) return 'boost';
  if (score <= 40) return 'risk';
  return 'neutral';
}

function getPrimaryValue(details: PlayerDetails): number | null {
  const profile = details.valueProfile;
  return numeric(profile?.dynastyValue)
    ?? numeric(profile?.balancedValue)
    ?? numeric(profile?.seasonValue)
    ?? numeric(profile?.marketKtc)
    ?? numeric(profile?.fantasyCalcDynasty)
    ?? numeric(profile?.fantasyCalcRedraft)
    ?? null;
}

function getRecentValueDelta(details: PlayerDetails): number | null {
  return numeric(details.valueTimeline?.summary?.deltaPct);
}

function parseDateMs(value?: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

function daysSince(value?: string | number | null): number | null {
  const parsed = parseDateMs(value);
  if (parsed === null) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86_400_000));
}

function addDynamicSignal(
  signals: PlayerSituationDynamicSignal[],
  signal: PlayerSituationDynamicSignal | null
) {
  if (!signal) return;
  const key = `${signal.type}:${signal.label}:${signal.detail}`.toLowerCase();
  if (signals.some((existing) => `${existing.type}:${existing.label}:${existing.detail}`.toLowerCase() === key)) return;
  signals.push(signal);
}

function getFantasyProsSourceTrace(details: PlayerDetails, key: string) {
  return details.valueProfile?.fantasyProsSourceTrace?.find((row) => row.key === key) || null;
}

function getNewsMovementDirection(details: PlayerDetails): PlayerSituationDynamicSignal['direction'] | null {
  const valueDelta = numeric(details.newsValueMovement?.valueDelta);
  if (valueDelta === null || valueDelta === 0) return null;
  return valueDelta > 0 ? 'boost' : 'risk';
}

function datesOverlapWithinDays(first?: string | number | null, second?: string | number | null, days = 7): boolean {
  const firstMs = parseDateMs(first);
  const secondMs = parseDateMs(second);
  if (firstMs === null || secondMs === null) return false;
  return Math.abs(firstMs - secondMs) <= days * 86_400_000;
}

function fantasyProsNewsCategory(details: PlayerDetails): {
  categoryLabel: string;
  defaultDirection: PlayerSituationDynamicSignal['direction'];
  eventAt: string | null;
  detail: string;
  hasValueMovementOverlap: boolean;
} | null {
  const trace = getFantasyProsSourceTrace(details, 'NEWS');
  if (!trace) return null;

  const text = normalizeText([
    trace.status,
    trace.evidence,
    details.latestNews?.title,
    details.latestNews?.summary,
  ].filter(Boolean).join(' '));
  if (!text) return null;

  const categoryLabel = text.includes('INJURY') || text.includes('PRACTICE') || text.includes('QUESTIONABLE') || text.includes('DOUBTFUL')
    ? 'injury news'
    : text.includes('TRADE') || text.includes('TRADED') || text.includes('SIGNED') || text.includes('WAIVED') || text.includes('RELEASED') || text.includes('CLAIMED') || text.includes('ACTIVATED') || text.includes('TRANSACTION')
    ? 'transaction news'
    : text.includes('RUMOR') || text.includes('SPECULATION')
    ? 'rumor news'
    : text.includes('BREAKING')
    ? 'breaking news'
    : 'player news';
  const defaultDirection: PlayerSituationDynamicSignal['direction'] = categoryLabel === 'injury news'
    ? 'risk'
    : categoryLabel === 'rumor news'
    ? 'neutral'
    : 'neutral';
  const eventAt = trace.lastUpdated || details.latestNews?.publishedAt || trace.fetchedAt || null;
  const movementPublishedAt = details.newsValueMovement?.newsPublishedAt || details.latestNews?.publishedAt || null;
  const hasValueMovementOverlap = Boolean(
    details.newsValueMovement &&
    (
      datesOverlapWithinDays(eventAt, movementPublishedAt) ||
      (!eventAt && movementPublishedAt)
    )
  );
  const detail = details.newsValueMovement?.note && hasValueMovementOverlap
    ? `${details.newsValueMovement.note} Stored news category: ${categoryLabel}.`
    : trace.evidence || details.latestNews?.summary || details.latestNews?.title || `Stored ${categoryLabel} is attached.`;

  return {
    categoryLabel,
    defaultDirection,
    eventAt,
    detail,
    hasValueMovementOverlap,
  };
}

function buildDynamicSignals(details: PlayerDetails): PlayerSituationDynamicSignal[] {
  const signals: PlayerSituationDynamicSignal[] = [];
  const delta = details.rosterRoom?.opportunityDelta;
  const usageMomentum = details.usageTrend?.momentum || null;
  const rollingWindow = details.usageTrend?.rollingWindows?.find((window) => window.games === 3)
    || details.usageTrend?.rollingWindows?.[0]
    || null;

  if (delta?.qualitySignal === 'major-opening' || delta?.qualitySignal === 'minor-opening') {
    addDynamicSignal(signals, {
      type: 'roster-room',
      label: delta.qualitySignal === 'major-opening' ? 'Major room opening' : 'Room opening',
      direction: 'boost',
      detail: delta.note,
    });
  }
  if (delta?.qualitySignal === 'major-squeeze' || delta?.qualitySignal === 'squeeze') {
    addDynamicSignal(signals, {
      type: 'roster-room',
      label: delta.qualitySignal === 'major-squeeze' ? 'Major room squeeze' : 'Room squeeze',
      direction: 'risk',
      detail: delta.topAddedThreat ? `${delta.topAddedThreat} is the top added threat. ${delta.note}` : delta.note,
    });
  }
  if (details.rosterRoom?.premiumAdditions?.length) {
    const addition = details.rosterRoom.premiumAdditions[0];
    addDynamicSignal(signals, {
      type: 'roster-room',
      label: 'Premium competition added',
      direction: 'risk',
      detail: `${addition.name} adds same-position pressure${addition.movementQualityTier ? ` as a ${addition.movementQualityTier} profile` : ''}.`,
      eventAt: addition.tradeDate || null,
    });
  }
  if (details.rosterRoom?.movementTypes?.includes('free-agent-or-claim')) {
    addDynamicSignal(signals, {
      type: 'source',
      label: 'Inferred free-agent/claim movement',
      direction: 'neutral',
      detail: 'Roster-room movement is real, but the exact non-trade transaction type is inferred until an official transaction feed is added.',
    });
  }

  if (details.usageTrend?.targetTrend === 'up' || details.usageTrend?.carryTrend === 'up') {
    addDynamicSignal(signals, {
      type: 'usage',
      label: 'Usage climbing',
      direction: 'boost',
      detail: details.usageTrend.note,
    });
  }
  if (details.usageTrend?.targetTrend === 'down' || details.usageTrend?.carryTrend === 'down') {
    addDynamicSignal(signals, {
      type: 'usage',
      label: 'Usage slipping',
      direction: 'risk',
      detail: details.usageTrend.note,
    });
  }
  if (rollingWindow) {
    const targetDelta = numeric(rollingWindow.targetDeltaPerGame) || 0;
    const carryDelta = numeric(rollingWindow.carryDeltaPerGame) || 0;
    const direction: PlayerSituationDynamicSignal['direction'] = targetDelta >= 1.5 || carryDelta >= 2.5
      ? 'boost'
      : targetDelta <= -1.5 || carryDelta <= -2.5
      ? 'risk'
      : 'neutral';
    if (direction !== 'neutral') {
      addDynamicSignal(signals, {
        type: 'usage',
        label: direction === 'boost' ? 'Rolling role spike' : 'Rolling role dip',
        direction,
        detail: rollingWindow.note,
      });
    }
  }
  if (usageMomentum && usageMomentum.primaryDirection !== 'flat' && usageMomentum.primaryDirection !== 'thin-sample') {
    const direction: PlayerSituationDynamicSignal['direction'] = usageMomentum.primaryDirection === 'declining'
      ? 'risk'
      : usageMomentum.primaryDirection === 'volatile'
      ? 'neutral'
      : 'boost';
    const label = usageMomentum.primaryDirection === 'sustained-growth'
      ? 'Sustained usage growth'
      : usageMomentum.primaryDirection === 'short-spike'
      ? 'Short usage spike'
      : usageMomentum.primaryDirection === 'declining'
      ? 'Usage momentum declining'
      : 'Usage volatility';
    addDynamicSignal(signals, {
      type: 'usage',
      label,
      direction,
      detail: usageMomentum.confidenceCapReason
        ? `${usageMomentum.note} ${usageMomentum.confidenceCapReason}`
        : usageMomentum.note,
    });
  }

  if (details.injuryStatus && !['healthy', 'active'].includes(String(details.injuryStatus).toLowerCase())) {
    addDynamicSignal(signals, {
      type: 'injury',
      label: 'Current injury flag',
      direction: 'risk',
      detail: `Current status is ${details.injuryStatus}.`,
    });
  }
  if (details.injuryHistory?.latestStatus && !/healthy|active/i.test(details.injuryHistory.latestStatus)) {
    addDynamicSignal(signals, {
      type: 'injury',
      label: 'Practice-report drag',
      direction: 'risk',
      detail: details.injuryHistory.note,
    });
  }

  if (details.latestNews?.title) {
    const movement = details.newsValueMovement;
    const valueDelta = numeric(movement?.valueDelta);
    addDynamicSignal(signals, {
      type: 'news',
      label: valueDelta !== null && valueDelta !== 0 ? 'News moved value' : 'News attached',
      direction: valueDelta === null ? 'neutral' : valueDelta > 0 ? 'boost' : valueDelta < 0 ? 'risk' : 'neutral',
      detail: movement?.note || details.latestNews.summary || details.latestNews.title,
      eventAt: details.latestNews.publishedAt || movement?.newsPublishedAt || null,
    });
  }

  const fantasyProsNews = fantasyProsNewsCategory(details);
  if (fantasyProsNews) {
    const movementDirection = fantasyProsNews.hasValueMovementOverlap
      ? getNewsMovementDirection(details)
      : null;
    addDynamicSignal(signals, {
      type: 'news',
      label: movementDirection
        ? `Stored ${fantasyProsNews.categoryLabel} moved value`
        : `Stored ${fantasyProsNews.categoryLabel}`,
      direction: movementDirection || fantasyProsNews.defaultDirection,
      detail: fantasyProsNews.detail,
      eventAt: fantasyProsNews.eventAt,
    });
  }

  const marketDelta = getRecentValueDelta(details);
  if (marketDelta !== null && Math.abs(marketDelta) >= 8) {
    addDynamicSignal(signals, {
      type: 'market',
      label: marketDelta > 0 ? 'Market repricing up' : 'Market repricing down',
      direction: marketDelta > 0 ? 'boost' : 'risk',
      detail: details.valueTimeline?.summary?.note || `${marketDelta}% recent value movement.`,
    });
  }
  if (details.valueTimeline?.summary?.sourceSetChanged) {
    addDynamicSignal(signals, {
      type: 'source',
      label: 'Source mix changed',
      direction: 'neutral',
      detail: 'Stored value history changed source coverage, so market movement should be read with source-mix context.',
    });
  }

  return signals.slice(0, 8);
}

function buildFreshnessProfile(
  details: PlayerDetails,
  dynamicSignals: PlayerSituationDynamicSignal[],
  missingSignals: string[],
  cautionFlags: string[]
): PlayerSituationFreshness {
  let score = 28;
  const signals: string[] = [];

  if (details.usageTrend) {
    score += 12;
    signals.push(`usage ${details.usageTrend.season}`);
    if (details.usageTrend.rollingWindows?.length) {
      score += 7;
      signals.push('rolling usage windows');
    }
    if (details.usageTrend.momentum) {
      score += details.usageTrend.momentum.confidenceCapReason ? 3 : 6;
      signals.push(details.usageTrend.momentum.confidenceCapReason ? 'capped usage momentum' : 'usage momentum');
    }
  }
  if (details.rosterRoom?.opportunityDelta) {
    score += 14;
    signals.push(`roster room ${details.rosterRoom.season}`);
  } else if (details.rosterRoom) {
    score += 8;
    signals.push(`roster room ${details.rosterRoom.season}`);
  }
  if (details.teamEnvironment) {
    score += 6;
    signals.push(`team environment ${details.teamEnvironment.season}`);
  }
  if (details.injuryHistory || details.injuryStatus) {
    score += details.injuryStatus ? 8 : 5;
    signals.push(details.injuryStatus ? 'current injury status' : 'injury history');
  }
  if (details.valueTimeline) {
    score += 6;
    signals.push('stored value timeline');
  }
  if (details.latestNews?.title) {
    const ageDays = daysSince(details.latestNews.publishedAt);
    score += ageDays === null ? 5 : ageDays <= 7 ? 13 : ageDays <= 30 ? 9 : 4;
    signals.push(ageDays === null ? 'player news' : `player news ${ageDays}d old`);
  }
  const fantasyProsNews = fantasyProsNewsCategory(details);
  if (fantasyProsNews) {
    const ageDays = daysSince(fantasyProsNews.eventAt);
    score += details.latestNews?.title
      ? 3
      : ageDays === null ? 5 : ageDays <= 7 ? 12 : ageDays <= 30 ? 8 : 3;
    signals.push(ageDays === null ? `Stored ${fantasyProsNews.categoryLabel}` : `Stored ${fantasyProsNews.categoryLabel} ${ageDays}d old`);
  }
  if (details.schedule) {
    score += 4;
    signals.push('schedule context');
  }
  if (dynamicSignals.length) {
    score += Math.min(12, dynamicSignals.length * 2);
  }

  score -= Math.min(18, missingSignals.length * 3);
  score -= Math.min(10, cautionFlags.length * 2);
  const roundedScore = round(score);
  const datedSignals = dynamicSignals
    .map((signal) => signal.eventAt)
    .concat(details.latestNews?.publishedAt || null)
    .filter((value): value is string => Boolean(value));
  const latestEventAt = datedSignals
    .map((value) => ({ value, ms: parseDateMs(value) || 0 }))
    .sort((a, b) => b.ms - a.ms)[0]?.value || null;
  const grade: PlayerSituationFreshness['grade'] = roundedScore >= 72
    ? 'fresh'
    : roundedScore >= 56
    ? 'usable'
    : roundedScore >= 40
    ? 'stale'
    : 'missing';

  return {
    grade,
    score: roundedScore,
    latestEventAt,
    signals: Array.from(new Set(signals)).slice(0, 6),
    note: grade === 'fresh'
      ? 'Situation read is backed by recent or multi-source football context.'
      : grade === 'usable'
      ? 'Situation read is usable, but at least one role, news, injury, or source input is thinner than ideal.'
      : grade === 'stale'
      ? 'Situation read is stale or incomplete enough that confidence should stay limited.'
      : 'Situation read is missing too many football-context inputs for a strong recommendation.',
  };
}

function getPriorOpportunityComponent(details: PlayerDetails, position: string): PlayerSituationDeltaComponent | null {
  const usage = details.usageTrend;
  if (!usage) return null;

  const snapPct = pct(usage.avgOffenseSnapPct);
  const targetShare = pct(usage.avgTargetShare);
  const airYardsShare = pct(usage.airYardsShare);
  const wopr = pct(usage.wopr);
  const ppg = numeric(usage.fantasyPointsPprPerGame);
  const targetsPerGame = usage.games ? usage.targets / Math.max(1, usage.games) : 0;
  const carriesPerGame = usage.games ? usage.carries / Math.max(1, usage.games) : 0;
  const trendBoost =
    (usage.targetTrend === 'up' ? 9 : usage.targetTrend === 'down' ? -11 : 0)
    + (usage.carryTrend === 'up' ? 8 : usage.carryTrend === 'down' ? -10 : 0);
  const momentumBoost = usage.momentum?.primaryDirection === 'sustained-growth'
    ? 9
    : usage.momentum?.primaryDirection === 'short-spike'
    ? 4
    : usage.momentum?.primaryDirection === 'declining'
    ? -10
    : usage.momentum?.primaryDirection === 'volatile'
    ? -4
    : 0;

  const receiverScore = 34
    + (snapPct ?? 0) * 0.24
    + (targetShare ?? 0) * 0.95
    + (airYardsShare ?? 0) * 0.22
    + (wopr ?? 0) * 0.18
    + targetsPerGame * 2.6
    + (ppg ?? 0) * 0.8
    + trendBoost
    + momentumBoost;
  const runnerScore = 34
    + (snapPct ?? 0) * 0.22
    + carriesPerGame * 3.5
    + targetsPerGame * 1.8
    + (ppg ?? 0) * 0.9
    + trendBoost
    + momentumBoost;
  const qbScore = 38 + (ppg ?? 0) * 1.8 + trendBoost + momentumBoost + (snapPct ?? 0) * 0.18;
  const score = position === 'QB'
    ? qbScore
    : position === 'RB'
    ? runnerScore
    : receiverScore;

  return component(
    'prior-opportunity',
    labelForScore(score, 'Bankable role', 'Thin prior role', 'Usable role'),
    score,
    directionForScore(score),
    usage.momentum
      ? `Prior usage: ${usage.note} Momentum: ${usage.momentum.note}`
      : `Prior usage: ${usage.note}`
  );
}

function getTeamVolumeComponent(details: PlayerDetails, position: string): PlayerSituationDeltaComponent | null {
  const env = details.teamEnvironment;
  if (!env) return null;

  const passRate = pct(env.passRate);
  const neutralPassRate = pct(env.neutralScriptPassRate);
  const targetsPerGame = numeric(env.targetsPerGame);
  const playsPerGame = numeric(env.playsPerGame);
  const paceRank = numeric(env.paceRank);
  let score = 50;

  if (position === 'QB' || position === 'WR' || position === 'TE') {
    score += ((passRate ?? 56) - 56) * 1.15;
    score += ((neutralPassRate ?? passRate ?? 56) - 56) * 0.8;
    score += ((targetsPerGame ?? 32) - 32) * 0.9;
  } else if (position === 'RB') {
    score += (56 - (passRate ?? 56)) * 0.75;
    score += ((pct(env.rushRate) ?? 42) - 42) * 0.85;
    score += ((playsPerGame ?? 62) - 62) * 0.45;
  }
  if (paceRank !== null && paceRank <= 10) score += 5;
  if (paceRank !== null && paceRank >= 24) score -= 5;
  if (env.tendency === 'pass-heavy' && (position === 'QB' || position === 'WR' || position === 'TE')) score += 8;
  if (env.tendency === 'run-heavy' && position === 'RB') score += 7;
  if (env.tendency === 'run-heavy' && (position === 'WR' || position === 'TE')) score -= 8;

  return component(
    'team-volume',
    labelForScore(score, 'Scheme volume boost', 'Scheme volume risk', 'Neutral scheme volume'),
    score,
    directionForScore(score),
    `Team environment: ${env.note}`
  );
}

function getSamePositionRoomComponent(details: PlayerDetails): PlayerSituationDeltaComponent | null {
  const room = details.rosterRoom;
  if (!room) return null;

  const delta = room.opportunityDelta;
  let score = 50;
  if (room.competitionLevel === 'thin') score += 10;
  if (room.competitionLevel === 'crowded') score -= 12;
  if (room.vacatedOpportunitySignal === 'opening') score += 8;
  if (room.vacatedOpportunitySignal === 'squeeze') score -= 8;
  if (room.premiumAdditions?.length) score -= Math.min(20, room.premiumAdditions.length * 9);

  if (delta) {
    score += clamp((delta.netOpportunityScore || 0) / 2.8, -24, 24);
    if (delta.qualitySignal === 'major-opening') score += 21;
    if (delta.qualitySignal === 'minor-opening') score += 11;
    if (delta.qualitySignal === 'squeeze') score -= 13;
    if (delta.qualitySignal === 'major-squeeze') score -= 24;
    if (isTopReturningDepthPlayer(details) && delta.incumbentOpportunitySignal === 'major-promotion') score += 18;
    if (isTopReturningDepthPlayer(details) && delta.incumbentOpportunitySignal === 'minor-promotion') score += 10;
    if (isTopReturningDepthPlayer(details) && delta.incumbentOpportunitySignal === 'blocked') score -= 18;
  }

  return component(
    'same-position-room',
    labelForScore(score, 'Room opened', 'Room squeeze', 'Room stable'),
    score,
    directionForScore(score),
    delta?.note ? `Roster room: ${delta.note}` : `Roster room: ${room.note}`
  );
}

function getInvestmentRunwayComponent(details: PlayerDetails, position: string): PlayerSituationDeltaComponent | null {
  const draft = details.playerCohort?.draftCapital;
  const contract = details.contractProfile;
  const age = numeric(details.age);
  const ageCliff = AGE_CLIFFS[position] || 30;

  if (!draft && !contract && age === null) return null;

  let score = 48;
  if (draft?.patienceScore !== null && draft?.patienceScore !== undefined) score = draft.patienceScore;
  if (draft?.tier === 'premium') score += 6;
  if (draft?.tier === 'day-two') score += 2;
  if (draft?.tier === 'late-round') score -= 7;
  if (draft?.tier === 'undrafted') score -= 12;
  if (contract?.investmentTier === 'premium') score += 14;
  if (contract?.investmentTier === 'solid') score += 6;
  if (contract?.investmentTier === 'fringe') score -= 12;
  if (age !== null && age >= ageCliff) score -= Math.min(22, (age - ageCliff + 1) * 6);
  if (age !== null && age <= 23 && draft?.tier !== 'undrafted') score += 5;

  return component(
    'investment-runway',
    labelForScore(score, 'Protected runway', 'Short leash', 'Prove-it runway'),
    score,
    directionForScore(score),
    [
      draft?.note ? `Draft runway: ${draft.note}` : null,
      contract?.note ? `Contract: ${contract.note}` : null,
      age !== null ? `Age ${age} versus ${position || 'position'} cliff ${ageCliff}.` : null,
    ].filter(Boolean).join(' ')
  );
}

function getEfficiencyQualityComponent(details: PlayerDetails, position: string): PlayerSituationDeltaComponent | null {
  const usage = details.usageTrend;
  if (!usage) return null;

  const targetShare = pct(usage.avgTargetShare);
  const airYardsShare = pct(usage.airYardsShare);
  const wopr = pct(usage.wopr);
  const snapPct = pct(usage.avgOffenseSnapPct);
  const ppg = numeric(usage.fantasyPointsPprPerGame);
  let score = 50;

  if (position === 'WR' || position === 'TE') {
    score += ((targetShare ?? 13) - 13) * 1.1;
    score += ((airYardsShare ?? 18) - 18) * 0.45;
    score += ((wopr ?? 36) - 36) * 0.28;
    if ((ppg ?? 0) >= 12 && (targetShare ?? 0) < 13 && (snapPct ?? 100) < 65) score -= 16;
  } else if (position === 'RB') {
    const touches = usage.games ? (usage.carries + usage.receptions) / Math.max(1, usage.games) : 0;
    score += (touches - 9) * 2.4;
    if ((ppg ?? 0) >= 14 && touches < 10) score -= 12;
  } else if (position === 'QB') {
    score += ((ppg ?? 14) - 14) * 1.7;
  }
  if ((snapPct ?? 0) >= 70) score += 7;
  if ((snapPct ?? 100) < 45) score -= 9;

  return component(
    'efficiency-quality',
    labelForScore(score, 'Earned usage quality', 'Fragile production quality', 'Usable efficiency quality'),
    score,
    directionForScore(score),
    `Efficiency proxy: ${usage.note}`
  );
}

function getAvailabilityComponent(details: PlayerDetails): PlayerSituationDeltaComponent | null {
  const injury = details.injuryHistory;
  const avgMissed = numeric(details.avgGamesMissed);
  if (!injury && avgMissed === null) return null;

  let score = 72;
  if (avgMissed !== null) score -= Math.min(34, avgMissed * 5.5);
  if (injury) score -= Math.min(28, injury.missedOrLimitedCount * 3.5);
  if (details.injuryStatus && !['healthy', 'active'].includes(String(details.injuryStatus).toLowerCase())) score -= 8;

  return component(
    'availability',
    labelForScore(score, 'Clean availability', 'Availability drag', 'Manageable availability'),
    score,
    directionForScore(score),
    injury?.note ? `Availability: ${injury.note}` : `Availability: ${avgMissed} average missed games per season.`
  );
}

function getMarketMovementComponent(details: PlayerDetails): PlayerSituationDeltaComponent | null {
  const deltaPct = getRecentValueDelta(details);
  const value = getPrimaryValue(details);
  if (deltaPct === null && value === null) return null;

  const score = 50 + clamp(deltaPct ?? 0, -35, 35) * 0.85 + (value ? clamp(value / 1000, 0, 8) : 0);
  return component(
    'market-movement',
    labelForScore(score, 'Market confirming', 'Market fading', 'Market neutral'),
    score,
    directionForScore(score),
    details.valueTimeline?.summary?.note ? `Market movement: ${details.valueTimeline.summary.note}` : `Market movement: ${deltaPct ?? 0}% recent value delta.`
  );
}

function uniqueLabels(labels: PlayerSituationDeltaLabel[]): PlayerSituationDeltaLabel[] {
  return Array.from(new Set(labels));
}

function deriveLabels(details: PlayerDetails, components: PlayerSituationDeltaComponent[], confidence: number): PlayerSituationDeltaLabel[] {
  const labels: PlayerSituationDeltaLabel[] = [];
  const byKey = Object.fromEntries(components.map((item) => [item.key, item]));
  const room = byKey['same-position-room'];
  const runway = byKey['investment-runway'];
  const efficiency = byKey['efficiency-quality'];
  const team = byKey['team-volume'];
  const prior = byKey['prior-opportunity'];
  const market = byKey['market-movement'];
  const delta = details.rosterRoom?.opportunityDelta;
  const position = String(details.position || '').toUpperCase();
  const age = numeric(details.age);
  const ageCliff = AGE_CLIFFS[position] || 30;

  if (room?.score >= 66) labels.push('role-boost');
  if (delta?.qualitySignal === 'major-opening' || delta?.qualitySignal === 'minor-opening') labels.push('vacated-opportunity');
  if (room?.score <= 38) labels.push('role-threat');
  if (details.rosterRoom?.competitionLevel === 'crowded' || (details.rosterRoom?.premiumAdditions?.length || 0) > 0) labels.push('crowded-room');
  if (team?.score >= 65) labels.push('scheme-boost');
  if (team?.score <= 38) labels.push('scheme-risk');
  if (details.usageTrend?.team && details.team && details.usageTrend.team !== details.team) labels.push('new-team-uncertainty');
  if ((market?.score || 0) >= 68 && ((efficiency?.score || 50) <= 45 || (prior?.score || 50) <= 42)) labels.push('fragile-breakout');
  if ((details.contractProfile?.investmentTier === 'premium' || details.contractProfile?.investmentTier === 'solid') && runway?.score && runway.score >= 60) labels.push('veteran-runway');
  if (
    (runway?.score && runway.score <= 38)
    || (
      age !== null
      && age >= ageCliff
      && (details.contractProfile?.investmentTier === 'fringe' || details.playerCohort?.draftCapital?.opportunityWindow === 'short-leash')
      && ((prior?.score || 50) <= 46 || details.usageTrend?.targetTrend === 'down' || details.usageTrend?.carryTrend === 'down')
    )
  ) labels.push('opportunity-cliff');
  if (details.playerCohort?.draftCapital?.opportunityWindow === 'protected-runway') labels.push('draft-capital-patience');
  if (details.playerCohort?.draftCapital?.opportunityWindow === 'short-leash') labels.push('late-capital-urgency');
  if (confidence < 54 || !details.usageTrend || !details.rosterRoom?.opportunityDelta) labels.push('source-limited-route-read');

  return uniqueLabels(labels.length ? labels : ['source-limited-route-read']);
}

function deriveAction(primaryLabel: PlayerSituationDeltaLabel, score: number): PlayerSituationDeltaProfile['action'] {
  if (primaryLabel === 'role-boost' || primaryLabel === 'vacated-opportunity' || primaryLabel === 'scheme-boost') return score >= 66 ? 'buy' : 'monitor';
  if (primaryLabel === 'draft-capital-patience') return 'stash';
  if (primaryLabel === 'role-threat' || primaryLabel === 'crowded-room' || primaryLabel === 'scheme-risk' || primaryLabel === 'opportunity-cliff') return score <= 34 ? 'sell' : 'monitor';
  if (primaryLabel === 'fragile-breakout') return 'sell';
  if (primaryLabel === 'late-capital-urgency') return 'monitor';
  if (primaryLabel === 'new-team-uncertainty' || primaryLabel === 'source-limited-route-read') return 'monitor';
  return 'hold';
}

function labelCopy(label: PlayerSituationDeltaLabel): string {
  const labels: Record<PlayerSituationDeltaLabel, string> = {
    'role-boost': 'role boost',
    'role-threat': 'role threat',
    'crowded-room': 'crowded room',
    'vacated-opportunity': 'vacated opportunity',
    'scheme-boost': 'scheme boost',
    'scheme-risk': 'scheme risk',
    'new-team-uncertainty': 'new-team uncertainty',
    'fragile-breakout': 'fragile breakout',
    'veteran-runway': 'veteran runway',
    'opportunity-cliff': 'opportunity cliff',
    'draft-capital-patience': 'draft-capital patience',
    'late-capital-urgency': 'late-capital urgency',
    'source-limited-route-read': 'source-limited route read',
  };
  return labels[label] || label;
}

function buildSummary(name: string, primaryLabel: PlayerSituationDeltaLabel, action: PlayerSituationDeltaProfile['action'], components: PlayerSituationDeltaComponent[]): string {
  const strongestBoost = components.filter((item) => item.direction === 'boost').sort((a, b) => b.score - a.score)[0];
  const strongestRisk = components.filter((item) => item.direction === 'risk').sort((a, b) => a.score - b.score)[0];
  const read = labelCopy(primaryLabel);

  if (strongestBoost && strongestRisk) {
    return `${name} carries a ${read} read: ${strongestBoost.label.toLowerCase()} is helping, but ${strongestRisk.label.toLowerCase()} keeps this as a ${action} decision instead of a blind value call.`;
  }
  if (strongestBoost) {
    return `${name} carries a ${read} read because ${strongestBoost.label.toLowerCase()} is supported by stored usage, room, or runway context.`;
  }
  if (strongestRisk) {
    return `${name} carries a ${read} read because ${strongestRisk.label.toLowerCase()} is pressuring the future opportunity path.`;
  }
  return `${name} carries a ${read} read, but the source stack is thin enough that the next move should stay conservative.`;
}

export function buildPlayerSituationDelta(details: PlayerDetails, playerId: string): PlayerSituationDeltaProfile | null {
  const position = String(details.position || '').toUpperCase();
  if (!SUPPORTED_POSITIONS.has(position)) return null;

  const components = [
    getPriorOpportunityComponent(details, position),
    getTeamVolumeComponent(details, position),
    getSamePositionRoomComponent(details),
    getInvestmentRunwayComponent(details, position),
    getEfficiencyQualityComponent(details, position),
    getAvailabilityComponent(details),
    getMarketMovementComponent(details),
  ].filter((item): item is PlayerSituationDeltaComponent => Boolean(item));

  if (!components.length) return null;

  const missingSignals: string[] = [];
  if (!details.usageTrend) missingSignals.push('usage trend');
  if (!details.teamEnvironment) missingSignals.push('team environment');
  if (!details.rosterRoom?.opportunityDelta) missingSignals.push('quality-weighted roster-room delta');
  if (!details.playerCohort?.draftCapital) missingSignals.push('draft-capital runway');
  if (!details.contractProfile) missingSignals.push('contract context');
  if (!details.valueTimeline) missingSignals.push('stored value timeline');

  const cautionFlags = components
    .filter((item) => item.direction === 'risk')
    .map((item) => item.label);
  if (details.rosterRoom?.movementTypes?.includes('free-agent-or-claim')) cautionFlags.push('inferred free-agent/claim movement');
  if (!details.rosterRoom?.opportunityDelta && details.rosterRoom) cautionFlags.push('roster-room movement lacks quality weighting');
  const fantasyProsNews = fantasyProsNewsCategory(details);
  if (fantasyProsNews?.categoryLabel === 'rumor news') cautionFlags.push('Stored rumor news category');
  const dynamicSignals = buildDynamicSignals(details);
  const freshness = buildFreshnessProfile(details, dynamicSignals, missingSignals, cautionFlags);

  const score = round(
    components.reduce((sum, item) => sum + item.score, 0) / components.length
  );
  const freshnessCap = freshness.grade === 'fresh'
    ? 100
    : freshness.grade === 'usable'
    ? 82
    : freshness.grade === 'stale'
    ? 62
    : 48;
  const confidence = Math.min(
    round(
      34
      + Math.min(42, components.length * 7)
      - Math.min(24, missingSignals.length * 4)
      - Math.min(12, cautionFlags.length * 2)
    ),
    freshnessCap
  );
  const labels = deriveLabels(details, components, confidence);
  const sortedLabels = labels.sort((a, b) => {
    const priority: Record<PlayerSituationDeltaLabel, number> = {
      'role-boost': 1,
      'vacated-opportunity': 2,
      'role-threat': 3,
      'crowded-room': 4,
      'fragile-breakout': 5,
      'opportunity-cliff': 6,
      'draft-capital-patience': 7,
      'late-capital-urgency': 8,
      'scheme-boost': 9,
      'scheme-risk': 10,
      'new-team-uncertainty': 11,
      'veteran-runway': 12,
      'source-limited-route-read': 13,
    };
    return priority[a] - priority[b];
  });
  const primaryLabel = sortedLabels[0];
  const action = deriveAction(primaryLabel, score);
  const name = details.fullName || playerId;
  const trace = [
    buildSummary(name, primaryLabel, action, components),
    ...components
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
      .slice(0, 5)
      .map((item) => `${item.label}: ${item.trace}`),
    missingSignals.length
      ? `Missing situation inputs: ${missingSignals.join(', ')}.`
      : 'All first-pass situation inputs are present.',
  ];

  return {
    playerId,
    name,
    position,
    score,
    confidence,
    primaryLabel,
    labels: sortedLabels,
    action,
    summary: trace[0],
    trace,
    missingSignals,
    cautionFlags,
    components,
    freshness,
    dynamicSignals,
  };
}

export function buildPlayerSituationDeltas(input: {
  playerDetailsById: Record<string, PlayerDetails>;
}): Record<string, PlayerSituationDeltaProfile> {
  return Object.fromEntries(
    Object.entries(input.playerDetailsById || {})
      .map(([playerId, details]) => [playerId, buildPlayerSituationDelta(details, playerId)] as const)
      .filter((entry): entry is [string, PlayerSituationDeltaProfile] => Boolean(entry[1]))
  );
}
