export type PlayerSeasonPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K';

export type PlayerSeasonInput = {
  playerKey: string;
  playerName: string;
  position: PlayerSeasonPosition;
  team: string | null;
  season: number;
  games: number;
  fantasyPointsPpr: number;
  passingAttempts?: number | null;
  carries?: number | null;
  targets?: number | null;
  receptions?: number | null;
  targetShare?: number | null;
  airYardsShare?: number | null;
  wopr?: number | null;
};

export type ProductionTier = 'elite' | 'strong' | 'usable' | 'replacement' | 'low-signal';
export type RoleTier = 'feature' | 'starter' | 'rotation' | 'thin';
export type SeasonTrajectory = 'first-season' | 'breakout' | 'progression' | 'sustain' | 'regression' | 'collapse' | 'late-career-rebound' | 'low-signal';

export type PlayerSeasonOutcomeRow = {
  playerKey: string;
  playerName: string;
  position: PlayerSeasonPosition;
  team: string | null;
  season: number;
  games: number;
  fantasyPointsPpr: number;
  fantasyPointsPprPerGame: number | null;
  productionScore: number;
  productionTier: ProductionTier;
  roleScore: number;
  roleTier: RoleTier;
  weightedOpportunity: number;
  targetShare: number | null;
  airYardsShare: number | null;
  wopr: number | null;
  previousSeason: number | null;
  previousProductionScore: number | null;
  previousRoleScore: number | null;
  productionScoreDelta: number | null;
  roleScoreDelta: number | null;
  trajectoryFromPrevious: SeasonTrajectory;
  nextSeason: number | null;
  nextProductionScore: number | null;
  nextRoleScore: number | null;
  nextProductionScoreDelta: number | null;
  nextRoleScoreDelta: number | null;
  nextSeasonOutcome: SeasonTrajectory | null;
  modelEligible: boolean;
  note: string;
};

type DerivedPlayerSeason = {
  input: PlayerSeasonInput;
  fantasyPointsPprPerGame: number | null;
  productionScore: number;
  productionTier: ProductionTier;
  roleScore: number;
  roleTier: RoleTier;
  weightedOpportunity: number;
};

type PositionBaseline = {
  replacementPpg: number;
  usablePpg: number;
  strongPpg: number;
  elitePpg: number;
  rotationVolume: number;
  starterVolume: number;
  featureVolume: number;
};

const POSITION_BASELINES: Record<PlayerSeasonPosition, PositionBaseline> = {
  QB: { replacementPpg: 12, usablePpg: 16.5, strongPpg: 20, elitePpg: 23.5, rotationVolume: 275, starterVolume: 500, featureVolume: 650 },
  RB: { replacementPpg: 7, usablePpg: 10, strongPpg: 14, elitePpg: 19, rotationVolume: 95, starterVolume: 190, featureVolume: 285 },
  WR: { replacementPpg: 7, usablePpg: 10, strongPpg: 14, elitePpg: 19, rotationVolume: 45, starterVolume: 90, featureVolume: 140 },
  TE: { replacementPpg: 5, usablePpg: 7.5, strongPpg: 10.5, elitePpg: 14.5, rotationVolume: 30, starterVolume: 65, featureVolume: 105 },
  K: { replacementPpg: 6, usablePpg: 8, strongPpg: 10, elitePpg: 12, rotationVolume: 10, starterVolume: 12, featureVolume: 15 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function productionScore(position: PlayerSeasonPosition, ppg: number | null, games: number): number {
  if (ppg === null || games <= 0) return 0;
  const baseline = POSITION_BASELINES[position];
  const ppgScore = ((ppg - baseline.replacementPpg) / Math.max(1, baseline.elitePpg - baseline.replacementPpg)) * 100;
  const gamesMultiplier = clamp(games / 14, 0.35, 1);
  return Math.round(clamp(ppgScore, 0, 100) * gamesMultiplier);
}

function productionTier(position: PlayerSeasonPosition, ppg: number | null, games: number): ProductionTier {
  if (ppg === null || games < 5) return 'low-signal';
  const baseline = POSITION_BASELINES[position];
  if (ppg >= baseline.elitePpg) return 'elite';
  if (ppg >= baseline.strongPpg) return 'strong';
  if (ppg >= baseline.usablePpg) return 'usable';
  if (ppg >= baseline.replacementPpg) return 'replacement';
  return 'low-signal';
}

function weightedOpportunity(row: PlayerSeasonInput): number {
  if (row.position === 'QB') return (row.passingAttempts || 0) + (row.carries || 0) * 2.2;
  if (row.position === 'RB') return (row.carries || 0) + (row.targets || 0) * 1.45;
  if (row.position === 'WR' || row.position === 'TE') return row.targets || 0;
  return row.games;
}

function roleScore(row: PlayerSeasonInput): number {
  const baseline = POSITION_BASELINES[row.position];
  const volume = weightedOpportunity(row);
  const volumeScore = ((volume - baseline.rotationVolume) / Math.max(1, baseline.featureVolume - baseline.rotationVolume)) * 100;
  const shareBoost = row.position === 'WR' || row.position === 'TE'
    ? (row.targetShare || 0) * 42 + (row.wopr || 0) * 24
    : row.position === 'RB'
    ? (row.targets || 0) * 0.08
    : 0;
  return Math.round(clamp(volumeScore + shareBoost, 0, 100));
}

function roleTier(position: PlayerSeasonPosition, score: number): RoleTier {
  if (score >= 78) return 'feature';
  if (score >= 48) return 'starter';
  if (score >= (position === 'K' ? 15 : 22)) return 'rotation';
  return 'thin';
}

function trajectory(input: {
  position: PlayerSeasonPosition;
  currentScore: number;
  previousScore: number | null;
  currentRole: number;
  previousRole: number | null;
  currentGames: number;
  previousGames: number | null;
}): SeasonTrajectory {
  if (input.previousScore === null || input.previousRole === null || input.previousGames === null) return 'first-season';
  if (input.currentGames < 5) return 'low-signal';
  const scoreDelta = input.currentScore - input.previousScore;
  const roleDelta = input.currentRole - input.previousRole;
  const wasLowSignal = input.previousGames < 5 || input.previousScore < 35;
  if (scoreDelta >= 28 && roleDelta >= 12) return wasLowSignal ? 'breakout' : 'late-career-rebound';
  if (scoreDelta >= 18 || (scoreDelta >= 10 && roleDelta >= 16)) return 'progression';
  if (scoreDelta <= -30 || (scoreDelta <= -20 && roleDelta <= -12)) return 'collapse';
  if (scoreDelta <= -16 || (scoreDelta <= -9 && roleDelta <= -16)) return 'regression';
  return 'sustain';
}

export function buildPlayerSeasonOutcomeRows(seasons: PlayerSeasonInput[]): PlayerSeasonOutcomeRow[] {
  const normalized: DerivedPlayerSeason[] = seasons
    .filter((row) => row.playerKey && row.playerName && row.season && POSITION_BASELINES[row.position])
    .map((row) => {
      const ppg = row.games > 0 ? round(row.fantasyPointsPpr / row.games, 2) : null;
      const prodScore = productionScore(row.position, ppg, row.games);
      const role = roleScore(row);
      return {
        input: row,
        fantasyPointsPprPerGame: ppg,
        productionScore: prodScore,
        productionTier: productionTier(row.position, ppg, row.games),
        roleScore: role,
        roleTier: roleTier(row.position, role),
        weightedOpportunity: round(weightedOpportunity(row), 2),
      };
    });

  const byPlayer = new Map<string, typeof normalized>();
  for (const row of normalized) {
    const group = byPlayer.get(row.input.playerKey) || [];
    group.push(row);
    byPlayer.set(row.input.playerKey, group);
  }

  const rows: PlayerSeasonOutcomeRow[] = [];
  for (const group of Array.from(byPlayer.values())) {
    const sorted = [...group].sort((a, b) => a.input.season - b.input.season);
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      const previous = sorted[index - 1] || null;
      const next = sorted[index + 1] || null;
      const previousIsAdjacent = previous && previous.input.season === current.input.season - 1 ? previous : null;
      const nextIsAdjacent = next && next.input.season === current.input.season + 1 ? next : null;
      const trajectoryFromPrevious = trajectory({
        position: current.input.position,
        currentScore: current.productionScore,
        previousScore: previousIsAdjacent?.productionScore ?? null,
        currentRole: current.roleScore,
        previousRole: previousIsAdjacent?.roleScore ?? null,
        currentGames: current.input.games,
        previousGames: previousIsAdjacent?.input.games ?? null,
      });
      const nextSeasonOutcome = nextIsAdjacent ? trajectory({
        position: current.input.position,
        currentScore: nextIsAdjacent.productionScore,
        previousScore: current.productionScore,
        currentRole: nextIsAdjacent.roleScore,
        previousRole: current.roleScore,
        currentGames: nextIsAdjacent.input.games,
        previousGames: current.input.games,
      }) : null;
      const modelEligible = current.input.games >= 6 && current.productionTier !== 'low-signal';
      const productionDelta = previousIsAdjacent ? current.productionScore - previousIsAdjacent.productionScore : null;
      const roleDelta = previousIsAdjacent ? current.roleScore - previousIsAdjacent.roleScore : null;

      rows.push({
        playerKey: current.input.playerKey,
        playerName: current.input.playerName,
        position: current.input.position,
        team: current.input.team,
        season: current.input.season,
        games: current.input.games,
        fantasyPointsPpr: round(current.input.fantasyPointsPpr, 1),
        fantasyPointsPprPerGame: current.fantasyPointsPprPerGame,
        productionScore: current.productionScore,
        productionTier: current.productionTier,
        roleScore: current.roleScore,
        roleTier: current.roleTier,
        weightedOpportunity: current.weightedOpportunity,
        targetShare: current.input.targetShare ?? null,
        airYardsShare: current.input.airYardsShare ?? null,
        wopr: current.input.wopr ?? null,
        previousSeason: previousIsAdjacent?.input.season ?? null,
        previousProductionScore: previousIsAdjacent?.productionScore ?? null,
        previousRoleScore: previousIsAdjacent?.roleScore ?? null,
        productionScoreDelta: productionDelta,
        roleScoreDelta: roleDelta,
        trajectoryFromPrevious,
        nextSeason: nextIsAdjacent?.input.season ?? null,
        nextProductionScore: nextIsAdjacent?.productionScore ?? null,
        nextRoleScore: nextIsAdjacent?.roleScore ?? null,
        nextProductionScoreDelta: nextIsAdjacent ? nextIsAdjacent.productionScore - current.productionScore : null,
        nextRoleScoreDelta: nextIsAdjacent ? nextIsAdjacent.roleScore - current.roleScore : null,
        nextSeasonOutcome,
        modelEligible,
        note: buildOutcomeNote({
          current,
          previous: previousIsAdjacent,
          next: nextIsAdjacent,
          trajectoryFromPrevious,
          nextSeasonOutcome,
        }),
      });
    }
  }

  return rows.sort((a, b) => a.season - b.season || a.position.localeCompare(b.position) || b.productionScore - a.productionScore);
}

function buildOutcomeNote(input: {
  current: DerivedPlayerSeason;
  previous: DerivedPlayerSeason | null;
  next: DerivedPlayerSeason | null;
  trajectoryFromPrevious: SeasonTrajectory;
  nextSeasonOutcome: SeasonTrajectory | null;
}): string {
  const current = input.current;
  const ppg = current.fantasyPointsPprPerGame ?? 0;
  const prevText = input.previous
    ? `${input.trajectoryFromPrevious} from ${input.previous.input.season} (${current.productionScore - input.previous.productionScore >= 0 ? '+' : ''}${current.productionScore - input.previous.productionScore} production score)`
    : 'first tracked season';
  const nextText = input.next && input.nextSeasonOutcome
    ? `next year: ${input.nextSeasonOutcome} (${input.next.productionScore - current.productionScore >= 0 ? '+' : ''}${input.next.productionScore - current.productionScore})`
    : 'next-year outcome unavailable';
  return `${current.input.season} ${current.input.position}: ${current.productionTier} production at ${ppg} PPG with ${current.roleTier} role usage; ${prevText}; ${nextText}.`;
}

export function summarizePlayerSeasonOutcomes(rows: PlayerSeasonOutcomeRow[]) {
  const byPosition: Record<string, any> = {};
  const byTrajectory: Record<string, number> = {};
  const byNextOutcome: Record<string, number> = {};
  for (const row of rows) {
    const position = byPosition[row.position] || {
      rowCount: 0,
      modelEligibleCount: 0,
      averageProductionScore: 0,
      averageRoleScore: 0,
      tiers: {},
      trajectories: {},
      nextOutcomes: {},
    };
    position.rowCount += 1;
    if (row.modelEligible) position.modelEligibleCount += 1;
    position.averageProductionScore += row.productionScore;
    position.averageRoleScore += row.roleScore;
    position.tiers[row.productionTier] = (position.tiers[row.productionTier] || 0) + 1;
    position.trajectories[row.trajectoryFromPrevious] = (position.trajectories[row.trajectoryFromPrevious] || 0) + 1;
    if (row.nextSeasonOutcome) position.nextOutcomes[row.nextSeasonOutcome] = (position.nextOutcomes[row.nextSeasonOutcome] || 0) + 1;
    byPosition[row.position] = position;
    byTrajectory[row.trajectoryFromPrevious] = (byTrajectory[row.trajectoryFromPrevious] || 0) + 1;
    if (row.nextSeasonOutcome) byNextOutcome[row.nextSeasonOutcome] = (byNextOutcome[row.nextSeasonOutcome] || 0) + 1;
  }

  for (const position of Object.values(byPosition)) {
    position.averageProductionScore = position.rowCount ? round(position.averageProductionScore / position.rowCount, 1) : 0;
    position.averageRoleScore = position.rowCount ? round(position.averageRoleScore / position.rowCount, 1) : 0;
  }

  return {
    rowCount: rows.length,
    modelEligibleCount: rows.filter((row) => row.modelEligible).length,
    byPosition,
    byTrajectory,
    byNextOutcome,
  };
}
