import { describe, expect, it } from 'vitest';
import {
  buildPlayerSeasonComparisonBacktest,
  findHistoricalSeasonComps,
} from './playerSeasonComparisonBacktest';
import type {
  PlayerSeasonOutcomeRow,
  PlayerSeasonPosition,
  ProductionTier,
  RoleTier,
  SeasonTrajectory,
} from './playerSeasonOutcomeModel';

let nextId = 0;

function row(overrides: Partial<PlayerSeasonOutcomeRow> = {}): PlayerSeasonOutcomeRow {
  nextId += 1;
  const season = overrides.season || 2020;
  const position: PlayerSeasonPosition = overrides.position || 'WR';
  const productionScore = overrides.productionScore ?? 62;
  const roleScore = overrides.roleScore ?? 58;
  const productionTier: ProductionTier = overrides.productionTier || 'usable';
  const roleTier: RoleTier = overrides.roleTier || 'starter';
  const trajectoryFromPrevious: SeasonTrajectory = overrides.trajectoryFromPrevious || 'sustain';
  const nextSeasonOutcome: SeasonTrajectory | null = overrides.nextSeasonOutcome === undefined ? 'progression' : overrides.nextSeasonOutcome;
  const nextProductionScoreDelta = overrides.nextProductionScoreDelta === undefined ? 12 : overrides.nextProductionScoreDelta;
  const nextRoleScoreDelta = overrides.nextRoleScoreDelta === undefined ? 6 : overrides.nextRoleScoreDelta;

  return {
    playerKey: overrides.playerKey || `player-${nextId}`,
    playerName: overrides.playerName || `Player ${nextId}`,
    position,
    team: overrides.team === undefined ? 'BUF' : overrides.team,
    season,
    games: overrides.games ?? 16,
    fantasyPointsPpr: overrides.fantasyPointsPpr ?? 190,
    fantasyPointsPprPerGame: overrides.fantasyPointsPprPerGame ?? 11.9,
    productionScore,
    productionTier,
    roleScore,
    roleTier,
    weightedOpportunity: overrides.weightedOpportunity ?? 105,
    targetShare: overrides.targetShare === undefined ? 0.22 : overrides.targetShare,
    airYardsShare: overrides.airYardsShare === undefined ? 0.24 : overrides.airYardsShare,
    wopr: overrides.wopr === undefined ? 0.55 : overrides.wopr,
    previousSeason: overrides.previousSeason === undefined ? season - 1 : overrides.previousSeason,
    previousProductionScore: overrides.previousProductionScore === undefined ? productionScore - 8 : overrides.previousProductionScore,
    previousRoleScore: overrides.previousRoleScore === undefined ? roleScore - 4 : overrides.previousRoleScore,
    productionScoreDelta: overrides.productionScoreDelta === undefined ? 8 : overrides.productionScoreDelta,
    roleScoreDelta: overrides.roleScoreDelta === undefined ? 4 : overrides.roleScoreDelta,
    trajectoryFromPrevious,
    nextSeason: overrides.nextSeason === undefined ? season + 1 : overrides.nextSeason,
    nextProductionScore: overrides.nextProductionScore === undefined ? productionScore + (nextProductionScoreDelta || 0) : overrides.nextProductionScore,
    nextRoleScore: overrides.nextRoleScore === undefined ? roleScore + (nextRoleScoreDelta || 0) : overrides.nextRoleScore,
    nextProductionScoreDelta,
    nextRoleScoreDelta,
    nextSeasonOutcome,
    modelEligible: overrides.modelEligible ?? true,
    note: overrides.note || 'test row',
  };
}

describe('player season comparison backtest', () => {
  it('uses only same-position seasons with completed prior outcomes', () => {
    const target = row({ playerKey: 'target', playerName: 'Target WR', season: 2024 });
    const completedHistorical = row({
      playerKey: 'old-hit',
      playerName: 'Old Hit',
      season: 2021,
      nextSeason: 2022,
    });
    const leakCandidate = row({
      playerKey: 'leak',
      playerName: 'Leak Candidate',
      season: 2023,
      nextSeason: 2024,
      nextSeasonOutcome: 'collapse',
      nextProductionScoreDelta: -30,
    });
    const wrongPosition = row({
      playerKey: 'wrong-position',
      playerName: 'Wrong Position',
      position: 'RB',
      season: 2021,
      nextSeason: 2022,
    });

    const comps = findHistoricalSeasonComps(target, [target, completedHistorical, leakCandidate, wrongPosition], {
      minSimilarity: 40,
    });

    expect(comps.map((comp) => comp.playerKey)).toEqual(['old-hit']);
    expect(comps[0].matchReasons).toContain('production score');
  });

  it('reports hit rates, false positives, and season drift from leak-safe comps', () => {
    const rows: PlayerSeasonOutcomeRow[] = [
      row({ playerKey: 'wr-old-1', playerName: 'WR Old 1', season: 2018, nextSeason: 2019 }),
      row({ playerKey: 'wr-old-2', playerName: 'WR Old 2', season: 2019, nextSeason: 2020, productionScore: 64, roleScore: 61 }),
      row({ playerKey: 'wr-old-3', playerName: 'WR Old 3', season: 2020, nextSeason: 2021, productionScore: 60, roleScore: 57 }),
      row({
        playerKey: 'wr-hit',
        playerName: 'WR Hit',
        season: 2022,
        nextSeason: 2023,
        nextSeasonOutcome: 'progression',
        nextProductionScoreDelta: 14,
      }),
      row({
        playerKey: 'wr-false-positive',
        playerName: 'WR False Positive',
        season: 2023,
        nextSeason: 2024,
        nextSeasonOutcome: 'collapse',
        nextProductionScoreDelta: -34,
        nextRoleScoreDelta: -20,
      }),
      row({
        playerKey: 'rb-old-1',
        playerName: 'RB Old 1',
        position: 'RB',
        season: 2018,
        nextSeason: 2019,
        productionScore: 45,
        roleScore: 46,
        weightedOpportunity: 175,
        targetShare: null,
        wopr: null,
        nextSeasonOutcome: 'collapse',
        nextProductionScoreDelta: -22,
        nextRoleScoreDelta: -16,
      }),
      row({
        playerKey: 'rb-old-2',
        playerName: 'RB Old 2',
        position: 'RB',
        season: 2019,
        nextSeason: 2020,
        productionScore: 47,
        roleScore: 45,
        weightedOpportunity: 170,
        targetShare: null,
        wopr: null,
        nextSeasonOutcome: 'regression',
        nextProductionScoreDelta: -17,
        nextRoleScoreDelta: -11,
      }),
      row({
        playerKey: 'rb-false-negative',
        playerName: 'RB False Negative',
        position: 'RB',
        season: 2022,
        nextSeason: 2023,
        productionScore: 46,
        roleScore: 45,
        weightedOpportunity: 172,
        targetShare: null,
        wopr: null,
        nextSeasonOutcome: 'breakout',
        nextProductionScoreDelta: 29,
        nextRoleScoreDelta: 18,
      }),
    ];

    const result = buildPlayerSeasonComparisonBacktest(rows, {
      minSimilarity: 50,
      peerLimit: 3,
    });

    expect(result.eligibleRowCount).toBe(8);
    expect(result.comparedRowCount).toBeGreaterThanOrEqual(3);
    expect(result.summary.falsePositiveRate).toBeGreaterThan(0);
    expect(result.summary.falseNegativeRate).toBeGreaterThan(0);
    expect(result.examples.falsePositives[0]).toMatchObject({
      playerKey: 'wr-false-positive',
      predictedDirection: 'positive',
      actualDirection: 'negative',
    });
    expect(result.examples.falseNegatives[0]).toMatchObject({
      playerKey: 'rb-false-negative',
      predictedDirection: 'negative',
      actualDirection: 'positive',
    });
    expect(result.byPosition.WR?.comparedCount).toBeGreaterThan(0);
    expect(result.byPosition.RB?.comparedCount).toBeGreaterThan(0);
    expect(result.bySeason['2022'].hitRateDriftFromOverall).not.toBeNull();
    expect(result.featureCoverage.notYetWarehouseBacked).toContain('season-specific market value');
  });

  it('keeps rows without a historical comp sample out of confident diagnostics', () => {
    const result = buildPlayerSeasonComparisonBacktest([
      row({
        playerKey: 'first-season',
        playerName: 'First Season',
        season: 2018,
        nextSeason: 2019,
      }),
    ]);

    expect(result.comparedRowCount).toBe(0);
    expect(result.noCompRowCount).toBe(1);
    expect(result.examples.noComps[0]).toMatchObject({
      playerKey: 'first-season',
      predictedDirection: null,
      hit: null,
    });
    expect(result.decision).toBe('do-not-promote');
  });
});
