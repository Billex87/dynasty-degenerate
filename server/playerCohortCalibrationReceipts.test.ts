import { describe, expect, it } from 'vitest';
import { buildPlayerCohortProfiles } from './playerCohortEngine';
import type { CompactPlayerSeasonCalibration } from './playerCohortCalibrationReceipts';
import type { PlayerDetails } from '../shared/types';

function player(input: Partial<PlayerDetails> & { fullName: string; position: string }): PlayerDetails {
  return input as PlayerDetails;
}

const calibration: CompactPlayerSeasonCalibration = {
  schemaVersion: 1,
  buckets: [
    {
      key: 'WR:strong:feature:breakout',
      label: 'WR breakout with feature usage',
      position: 'WR',
      productionTier: 'strong',
      roleTier: 'feature',
      trajectoryFromPrevious: 'breakout',
      sampleSize: 20,
      improvedOrSustainedRate: 40,
      breakoutOrProgressionRate: 10,
      regressionOrCollapseRate: 60,
      failureRiskRate: 50,
      medianNextProductionDelta: -20,
      medianNextRoleDelta: -12,
      confidence: 74,
      confidenceGrade: 'usable',
      recommendation: 'fade-risk',
      primaryFailureModes: [
        { key: 'breakout-pullback', label: 'Breakout pullback', rate: 45 },
      ],
      summary: 'WR breakout with feature usage: 20 historical samples.',
    },
    {
      key: 'WR:strong:feature:sustain',
      label: 'WR proven feature scorer',
      position: 'WR',
      productionTier: 'strong',
      roleTier: 'feature',
      trajectoryFromPrevious: 'sustain',
      sampleSize: 5,
      improvedOrSustainedRate: 60,
      breakoutOrProgressionRate: 20,
      regressionOrCollapseRate: 40,
      failureRiskRate: 20,
      medianNextProductionDelta: 4,
      medianNextRoleDelta: 2,
      confidence: 40,
      confidenceGrade: 'thin',
      recommendation: 'lean-positive',
      primaryFailureModes: [],
      summary: 'Thin bucket.',
    },
  ],
};

describe('player cohort calibration receipts', () => {
  it('attaches a visible historical receipt when a player maps to a strong calibrated bucket', () => {
    const profiles = buildPlayerCohortProfiles({
      seasonOutcomeCalibration: calibration,
      playerDetailsById: {
        target: player({
          fullName: 'Feature Breakout Receiver',
          position: 'WR',
          age: 23,
          externalIds: { gsis: '00-target' },
          nflDraftRound: 1,
          nflDraftPick: 22,
          yearsExp: 1,
          lastSeasonPointsPerGame: 16,
          lastSeasonGames: 16,
          valueProfile: {
            dynastyValue: 5600,
            marketKtc: 5500,
            fantasyCalcDynasty: 5700,
            sources: ['KTC', 'FantasyCalc'],
          },
          usageTrend: {
            season: '2025',
            team: 'SEA',
            games: 16,
            targets: 118,
            carries: 2,
            receptions: 82,
            fantasyPointsPpr: 256,
            fantasyPointsPprPerGame: 16,
            avgTargetShare: 0.25,
            avgOffenseSnapPct: 0.84,
            recentTargets: 34,
            recentCarries: 0,
            targetTrend: 'up',
            carryTrend: 'flat',
            note: 'Usage trend from 16 games with targets up.',
          },
          rosterRoom: {
            source: 'nflverse rosters/weekly rosters/depth charts/trades',
            season: '2026',
            previousSeason: '2025',
            team: 'SEA',
            position: 'WR',
            currentCount: 6,
            previousCount: 7,
            netChange: -1,
            additions: [],
            losses: [],
            rookieAdditions: [],
            premiumAdditions: [],
            depthChartTop: [{ name: 'Feature Breakout Receiver', gsisId: '00-target', rank: 1, slot: 'WR1' }],
            opportunityDelta: {
              vacatedTargets: 130,
              vacatedCarries: 0,
              vacatedReceptions: 80,
              vacatedFantasyPointsPpr: 220,
              addedPriorTargets: 15,
              addedPriorCarries: 0,
              addedPriorReceptions: 9,
              addedPriorFantasyPointsPpr: 50,
              vacatedImpactScore: 78,
              addedThreatScore: 16,
              netOpportunityScore: 62,
              qualitySignal: 'major-opening',
              topReturningDepthPlayer: 'Feature Breakout Receiver',
              incumbentOpportunitySignal: 'major-promotion',
              note: 'SEA WR net opportunity major-opening with the target player promoted.',
            },
            competitionLevel: 'normal',
            vacatedOpportunitySignal: 'opening',
            note: 'SEA WR room has a meaningful opening.',
          },
        }),
        peer: player({
          fullName: 'Similar Receiver',
          position: 'WR',
          age: 24,
          lastSeasonPointsPerGame: 15,
          lastSeasonGames: 16,
          valueProfile: {
            dynastyValue: 5400,
            marketKtc: 5350,
            fantasyCalcDynasty: 5450,
          },
        }),
      },
    });

    expect(profiles.target.seasonOutcomeReceipt).toMatchObject({
      key: 'WR:strong:feature:breakout',
      displayEligible: true,
      stance: 'risk-supported',
      sampleSize: 20,
      materialFailureRate: 50,
    });
    expect(profiles.target.trace.join(' ')).toContain('Season outcome receipt: WR breakout with feature usage');
    expect(profiles.target.trace.join(' ')).toContain('strong production tier');
  });

  it('keeps thin historical receipts internal', () => {
    const profiles = buildPlayerCohortProfiles({
      seasonOutcomeCalibration: calibration,
      playerDetailsById: {
        target: player({
          fullName: 'Stable Feature Receiver',
          position: 'WR',
          age: 26,
          yearsExp: 4,
          lastSeasonPointsPerGame: 16,
          lastSeasonGames: 16,
          valueProfile: {
            dynastyValue: 5600,
            marketKtc: 5500,
            fantasyCalcDynasty: 5700,
            sources: ['KTC', 'FantasyCalc'],
          },
          usageTrend: {
            season: '2025',
            games: 16,
            targets: 118,
            carries: 0,
            receptions: 82,
            fantasyPointsPpr: 256,
            fantasyPointsPprPerGame: 16,
            avgTargetShare: 0.25,
            avgOffenseSnapPct: 0.84,
            recentTargets: 30,
            recentCarries: 0,
            targetTrend: 'flat',
            carryTrend: 'flat',
            note: 'Usage trend from 16 games.',
          },
        }),
      },
    });

    expect(profiles.target.seasonOutcomeReceipt).toMatchObject({
      key: 'WR:strong:feature:sustain',
      displayEligible: false,
      confidenceGrade: 'thin',
    });
  });
});
