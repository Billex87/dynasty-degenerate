import { describe, expect, it } from 'vitest';
import { buildPlayerSeasonCalibration } from './playerSeasonCalibration';
import type { PlayerSeasonOutcomeRow } from './playerSeasonOutcomeModel';

function row(input: Partial<PlayerSeasonOutcomeRow> & Pick<PlayerSeasonOutcomeRow, 'playerName' | 'season' | 'position' | 'productionTier' | 'roleTier' | 'trajectoryFromPrevious' | 'nextSeasonOutcome'>): PlayerSeasonOutcomeRow {
  return {
    playerKey: `${input.playerName}-${input.season}`,
    playerName: input.playerName,
    position: input.position,
    team: 'SEA',
    season: input.season,
    games: 16,
    fantasyPointsPpr: 240,
    fantasyPointsPprPerGame: 15,
    productionScore: 60,
    productionTier: input.productionTier,
    roleScore: 70,
    roleTier: input.roleTier,
    weightedOpportunity: 120,
    targetShare: null,
    airYardsShare: null,
    wopr: null,
    previousSeason: input.season - 1,
    previousProductionScore: 42,
    previousRoleScore: 50,
    productionScoreDelta: 18,
    roleScoreDelta: 20,
    nextSeason: input.season + 1,
    nextProductionScore: input.nextProductionScore ?? 72,
    nextRoleScore: input.nextRoleScore ?? 78,
    nextProductionScoreDelta: input.nextProductionScoreDelta ?? 12,
    nextRoleScoreDelta: input.nextRoleScoreDelta ?? 8,
    modelEligible: true,
    note: '',
    ...input,
  };
}

describe('player season calibration', () => {
  it('calibrates positive archetypes with rates, confidence, and examples', () => {
    const rows = Array.from({ length: 16 }, (_, index) => row({
      playerName: `Positive ${index}`,
      season: 2020 + (index % 2),
      position: 'WR',
      productionTier: 'strong',
      roleTier: 'starter',
      trajectoryFromPrevious: 'progression',
      nextSeasonOutcome: index < 13 ? 'sustain' : 'regression',
      nextProductionScoreDelta: index < 13 ? 10 : -12,
      nextRoleScoreDelta: index < 13 ? 7 : -10,
    }));

    const calibration = buildPlayerSeasonCalibration(rows);
    const bucket = calibration.buckets[0];

    expect(calibration).toMatchObject({
      rowCount: 16,
      calibratedRowCount: 16,
      bucketCount: 1,
    });
    expect(bucket).toMatchObject({
      label: 'WR progression with starter usage',
      sampleSize: 16,
      improvedOrSustainedRate: 81.3,
      regressionOrCollapseRate: 18.8,
      recommendation: 'lean-positive',
    });
    expect(bucket.examples.positive.length).toBeGreaterThan(0);
    expect(calibration.summary.strongestPositiveBuckets[0].key).toBe(bucket.key);
  });

  it('surfaces failure modes for risky archetypes', () => {
    const riskyRows = Array.from({ length: 16 }, (_, index) => row({
      playerName: `Risk ${index}`,
      season: 2022,
      position: 'RB',
      productionTier: 'strong',
      roleTier: 'rotation',
      trajectoryFromPrevious: 'breakout',
      nextSeasonOutcome: index < 12 ? 'collapse' : 'sustain',
      nextProductionScoreDelta: index < 12 ? -34 : 4,
      nextRoleScoreDelta: index < 12 ? -22 : 2,
    }));

    const calibration = buildPlayerSeasonCalibration(riskyRows);
    const bucket = calibration.buckets[0];

    expect(bucket.recommendation).toBe('fade-risk');
    expect(bucket.primaryFailureModes.map((mode) => mode.key)).toEqual(
      expect.arrayContaining(['role-loss', 'production-collapse', 'efficiency-spike-pullback', 'breakout-pullback'])
    );
    expect(calibration.summary.highestRiskBuckets[0].key).toBe(bucket.key);
  });
});
