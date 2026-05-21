import { describe, expect, it } from 'vitest';
import { buildPlayerCohortProfiles } from './playerCohortEngine';
import type { PlayerDetails } from '../shared/types';

function player(input: Partial<PlayerDetails> & { fullName: string; position: string }): PlayerDetails {
  return input as PlayerDetails;
}

describe('player cohort engine', () => {
  it('builds age, market-production, peer, and trace reads from stored player details', () => {
    const profiles = buildPlayerCohortProfiles({
      playerDetailsById: {
        wr1: player({
          fullName: 'Young Breakout',
          position: 'WR',
          age: 23,
          externalIds: { gsis: '00-1', pfr: 'YounBr00' },
          nflDraftRound: 1,
          nflDraftPick: 18,
          yearsExp: 1,
          lastSeasonPointsPerGame: 16,
          lastSeasonGames: 16,
          availabilitySeasons: 2,
          valueProfile: {
            dynastyValue: 5600,
            marketKtc: 5500,
            fantasyCalcDynasty: 5700,
            dynastyPositionRank: 'WR18',
            sources: ['KTC', 'FantasyCalc'],
          },
          usageTrend: {
            season: '2025',
            team: 'BUF',
            games: 16,
            targets: 116,
            carries: 4,
            receptions: 78,
            fantasyPointsPpr: 256,
            fantasyPointsPprPerGame: 16,
            avgTargetShare: 0.24,
            avgOffenseSnapPct: 0.83,
            recentTargets: 33,
            recentCarries: 1,
            targetTrend: 'up',
            carryTrend: 'flat',
            note: 'Usage trend from 16 2025 regular-season games; recent four-game targets up and carries flat.',
          },
          teamEnvironment: {
            source: 'nflverse team stats',
            season: '2025',
            team: 'BUF',
            games: 17,
            passAttempts: 560,
            carries: 470,
            targets: 535,
            dropbacks: 598,
            designedPlayVolume: 1068,
            passRate: 0.56,
            rushRate: 0.44,
            playsPerGame: 62.8,
            targetsPerGame: 31.5,
            passingEpa: 97,
            rushingEpa: 41,
            passRateRank: 18,
            rushRateRank: 9,
            neutralScriptPlays: 600,
            neutralScriptPassRate: 0.54,
            redZonePlays: 130,
            redZonePassRate: 0.48,
            redZoneRushRate: 0.52,
            nonGarbagePlays: 970,
            nonGarbagePassRate: 0.55,
            estimatedSecondsPerPlay: 28.5,
            paceRank: 11,
            noHuddleRate: 0.09,
            tendency: 'balanced',
            note: 'BUF played as a balanced offense in 2025.',
          },
          rosterRoom: {
            source: 'nflverse rosters/weekly rosters/depth charts/trades',
            season: '2026',
            previousSeason: '2025',
            team: 'BUF',
            position: 'WR',
            currentCount: 5,
            previousCount: 5,
            netChange: 0,
            additions: [],
            losses: [],
            rookieAdditions: [],
            premiumAdditions: [],
            depthChartTop: [{ name: 'Young Breakout', gsisId: '00-1', rank: 1, slot: 'WR1' }],
            opportunityDelta: {
              vacatedTargets: 131,
              vacatedCarries: 1,
              vacatedReceptions: 84,
              vacatedFantasyPointsPpr: 221,
              addedPriorTargets: 12,
              addedPriorCarries: 0,
              addedPriorReceptions: 7,
              addedPriorFantasyPointsPpr: 41,
              vacatedImpactScore: 78,
              addedThreatScore: 12,
              netOpportunityScore: 66,
              qualitySignal: 'major-opening',
              topVacatedPlayer: 'Veteran Target Hog',
              topAddedThreat: 'Depth Add',
              note: 'BUF WR net opportunity major-opening: vacated 131 targets from departures led by Veteran Target Hog.',
            },
            competitionLevel: 'normal',
            vacatedOpportunitySignal: 'stable',
            note: 'BUF WR room is normal with stable opportunity.',
          },
        }),
        wr2: player({
          fullName: 'Prime Peer',
          position: 'WR',
          age: 25,
          lastSeasonPointsPerGame: 15,
          lastSeasonGames: 15,
          availabilitySeasons: 2,
          valueProfile: {
            dynastyValue: 5400,
            marketKtc: 5300,
            fantasyCalcDynasty: 5500,
          },
        }),
        rb1: player({
          fullName: 'Older RB',
          position: 'RB',
          age: 29,
          lastSeasonPointsPerGame: 9,
          lastSeasonGames: 11,
          avgGamesMissed: 4.5,
          availabilitySeasons: 3,
          valueProfile: {
            dynastyValue: 5100,
            marketKtc: 5200,
            fantasyCalcDynasty: 5000,
          },
        }),
      },
    });

    expect(profiles.wr1).toMatchObject({
      agePhase: 'early',
      outcomeBucket: 'breakout',
      position: 'WR',
    });
    expect(profiles.wr1.peers).toEqual([
      expect.objectContaining({ playerId: 'wr2', name: 'Prime Peer' }),
    ]);
    expect(profiles.wr1.trace.join(' ')).toContain('Age phase: early');
    expect(profiles.wr1.trace.join(' ')).toContain('Draft capital: Round 1, pick 18');
    expect(profiles.wr1.draftCapital).toMatchObject({
      tier: 'premium',
      opportunityWindow: 'protected-runway',
    });
    expect(profiles.wr1.calibration).toMatchObject({
      evidenceGrade: 'strong',
      strongReadEligible: true,
      missingSignals: [],
    });
    expect(profiles.wr1.confidence).toBeGreaterThanOrEqual(70);
    expect(profiles.wr1.trace.join(' ')).toContain('Strong read eligible');
    expect(profiles.wr1.trace.join(' ')).toContain('Opportunity math: BUF WR net opportunity major-opening');
    expect(profiles.wr1.historicalComps).toMatchObject({
      archetype: 'early WR opportunity riser',
      sampleSize: 1,
      consensusOutcome: 'sustain',
    });
    expect(profiles.wr1.historicalComps?.closest[0]).toMatchObject({
      playerId: 'wr2',
      name: 'Prime Peer',
      resultSignal: 'Hold/sustain profile',
    });
    expect(profiles.wr1.historicalComps?.signals.map((signal) => signal.label)).toContain('Opportunity Math');
    expect(profiles.wr1.trace.join(' ')).toContain('Historical comps: early WR opportunity riser');
    expect(profiles.rb1.outcomeBucket).toBe('injury-risk');
  });

  it('keeps late or undrafted profiles on a shorter opportunity leash', () => {
    const profiles = buildPlayerCohortProfiles({
      playerDetailsById: {
        late: player({
          fullName: 'Late Round Bet',
          position: 'RB',
          age: 24,
          nflDraftRound: 6,
          nflDraftPick: 190,
          yearsExp: 2,
          lastSeasonPointsPerGame: 6,
          lastSeasonGames: 10,
          availabilitySeasons: 1,
          valueProfile: {
            dynastyValue: 1200,
            marketKtc: 1200,
          },
        }),
      },
    });

    expect(profiles.late.draftCapital).toMatchObject({
      tier: 'late-round',
      opportunityWindow: 'short-leash',
    });
    expect(profiles.late.trace.join(' ')).toContain('Low draft capital usually means opportunity has to be earned quickly');
  });

  it('flags unusual player anomaly cases for cautious AI receipts', () => {
    const profiles = buildPlayerCohortProfiles({
      playerDetailsById: {
        ageRb: player({
          fullName: 'Old Producer',
          position: 'RB',
          age: 29,
          nflDraftRound: 2,
          lastSeasonPointsPerGame: 18,
          lastSeasonGames: 16,
          valueProfile: {
            dynastyValue: 3200,
            marketKtc: 3200,
            sources: ['KTC', 'FantasyCalc'],
          },
        }),
        lateWr: player({
          fullName: 'Late Breakout Receiver',
          position: 'WR',
          age: 27,
          nflDraftRound: 6,
          lastSeasonPointsPerGame: 16,
          lastSeasonGames: 16,
          valueProfile: {
            dynastyValue: 3000,
            marketKtc: 3000,
            sources: ['KTC', 'FantasyCalc'],
          },
        }),
        injuryRb: player({
          fullName: 'Comeback Runner',
          position: 'RB',
          age: 25,
          lastSeasonPointsPerGame: 16,
          lastSeasonGames: 12,
          avgGamesMissed: 4,
          injuryHistory: {
            season: '2025',
            reportCount: 8,
            missedOrLimitedCount: 5,
            injuryTypes: ['ankle'],
            note: 'Recurring ankle report signal.',
          },
          valueProfile: {
            dynastyValue: 4200,
            marketKtc: 4200,
            sources: ['KTC', 'FantasyCalc'],
          },
        }),
        spikeWr: player({
          fullName: 'Four Game Spike',
          position: 'WR',
          age: 24,
          lastSeasonPointsPerGame: 21,
          lastSeasonGames: 4,
          valueProfile: {
            dynastyValue: 6200,
            marketKtc: 6200,
            sources: ['KTC', 'FantasyCalc'],
          },
        }),
        roleWr: player({
          fullName: 'Vacated Role Receiver',
          position: 'WR',
          age: 23,
          nflDraftRound: 2,
          lastSeasonPointsPerGame: 9,
          lastSeasonGames: 16,
          valueProfile: {
            dynastyValue: 3300,
            marketKtc: 3300,
            sources: ['KTC', 'FantasyCalc'],
          },
          rosterRoom: {
            source: 'nflverse rosters/weekly rosters/depth charts/trades',
            season: '2026',
            previousSeason: '2025',
            team: 'KC',
            position: 'WR',
            currentCount: 5,
            previousCount: 6,
            netChange: -1,
            additions: [],
            losses: [],
            rookieAdditions: [],
            premiumAdditions: [],
            depthChartTop: [{ name: 'Vacated Role Receiver', gsisId: '00-role', rank: 1, slot: 'WR1' }],
            opportunityDelta: {
              vacatedTargets: 165,
              vacatedCarries: 2,
              vacatedReceptions: 102,
              vacatedFantasyPointsPpr: 275,
              addedPriorTargets: 18,
              addedPriorCarries: 0,
              addedPriorReceptions: 10,
              addedPriorFantasyPointsPpr: 42,
              vacatedImpactScore: 88,
              addedThreatScore: 10,
              netOpportunityScore: 78,
              qualitySignal: 'major-opening',
              topVacatedPlayer: 'Departed Alpha',
              topAddedThreat: 'Depth Signing',
              note: 'KC WR net opportunity major-opening from Departed Alpha leaving 165 targets.',
            },
            competitionLevel: 'thin',
            vacatedOpportunitySignal: 'opening',
            note: 'KC WR room has a major opening.',
          },
        }),
      },
    });

    expect(profiles.ageRb.anomalyFlags?.map(flag => flag.key)).toContain('age-curve-outlier');
    expect(profiles.lateWr.anomalyFlags?.map(flag => flag.key)).toContain('late-breakout');
    expect(profiles.injuryRb.anomalyFlags?.map(flag => flag.key)).toContain('injury-comeback');
    expect(profiles.spikeWr.anomalyFlags?.map(flag => flag.key)).toContain('small-sample-spike');
    expect(profiles.roleWr.anomalyFlags?.map(flag => flag.key)).toContain('role-driven-jump');
    expect(profiles.spikeWr.calibration.cautionFlags).toContain('small-sample spike');
    expect(profiles.roleWr.trace.join(' ')).toContain('Anomaly rules: Role-driven jump');
  });

  it('flags JSN-style top returning receivers when vacated alpha volume creates a promotion window', () => {
    const profiles = buildPlayerCohortProfiles({
      playerDetailsById: {
        jsn: player({
          fullName: 'Jaxon Smith-Njigba',
          position: 'WR',
          age: 23,
          nflDraftRound: 1,
          nflDraftPick: 20,
          yearsExp: 2,
          lastSeasonPointsPerGame: 11.5,
          lastSeasonGames: 17,
          availabilitySeasons: 2,
          valueProfile: {
            dynastyValue: 4700,
            marketKtc: 4600,
            fantasyCalcDynasty: 4800,
            sources: ['KTC', 'FantasyCalc'],
          },
          rosterRoom: {
            source: 'nflverse rosters/weekly rosters/depth charts/trades',
            season: '2025',
            previousSeason: '2024',
            team: 'SEA',
            position: 'WR',
            currentCount: 7,
            previousCount: 9,
            netChange: -2,
            additions: [],
            losses: [],
            rookieAdditions: [],
            premiumAdditions: [],
            depthChartTop: [{ name: 'Jaxon Smith-Njigba', gsisId: '00-0038543', rank: 1, slot: 'WR1' }],
            movementTypes: ['roster-loss'],
            weeklyCoverage: { currentSeasonPlayers: 0, previousSeasonPlayers: 2 },
            opportunityDelta: {
              vacatedTargets: 183,
              vacatedCarries: 0,
              vacatedReceptions: 116,
              vacatedFantasyPointsPpr: 313.8,
              addedPriorTargets: 141,
              addedPriorCarries: 8,
              addedPriorReceptions: 87,
              addedPriorFantasyPointsPpr: 256.8,
              vacatedImpactScore: 100,
              addedThreatScore: 100,
              netOpportunityScore: 0,
              qualitySignal: 'stable',
              incumbentPromotionScore: 40,
              incumbentOpportunitySignal: 'minor-promotion',
              topVacatedPlayer: 'DK Metcalf',
              topAddedThreat: 'Cooper Kupp',
              topReturningDepthPlayer: 'Jaxon Smith-Njigba',
              note: 'SEA WR net opportunity stable with top returning depth-chart player Jaxon Smith-Njigba carrying a minor-promotion signal.',
            },
            competitionLevel: 'crowded',
            vacatedOpportunitySignal: 'opening',
            note: 'SEA WR room lost DK Metcalf and Tyler Lockett but added Cooper Kupp.',
          },
        }),
      },
    });

    expect(profiles.jsn.outcomeBucket).toBe('breakout');
    expect(profiles.jsn.trace.join(' ')).toContain('top returning depth-chart player Jaxon Smith-Njigba');
  });

  it('keeps thin players conservative when value or production is missing', () => {
    const profiles = buildPlayerCohortProfiles({
      playerDetailsById: {
        te1: player({
          fullName: 'Thin Tight End',
          position: 'TE',
          age: 24,
        }),
      },
    });

    expect(profiles.te1.outcomeBucket).toBe('thin-signal');
    expect(profiles.te1.calibration).toMatchObject({
      evidenceGrade: 'blocked',
      strongReadEligible: false,
    });
    expect(profiles.te1.calibration.missingSignals).toContain('market value');
    expect(profiles.te1.calibration.missingSignals).toContain('last-season production');
    expect(profiles.te1.confidence).toBeLessThan(50);
    expect(profiles.te1.confidence).toBeLessThanOrEqual(profiles.te1.calibration.confidenceCap);
    expect(profiles.te1.trace).toContain('Primary value is unavailable.');
    expect(profiles.te1.trace).toContain('Production score is unavailable.');
  });

  it('uses prospect buzz and athletic context when matching younger profiles', () => {
    const profiles = buildPlayerCohortProfiles({
      playerDetailsById: {
        rbA: player({
          fullName: 'Explosive Rookie Back',
          position: 'RB',
          age: 22,
          nflDraftRound: 1,
          nflDraftPick: 24,
          yearsExp: 1,
          lastSeasonPointsPerGame: 9.4,
          lastSeasonGames: 10,
          valueProfile: {
            dynastyValue: 3700,
            marketKtc: 3650,
            fantasyCalcDynasty: 3800,
            sources: ['KTC', 'FantasyCalc'],
          },
          prospectProfile: {
            source: 'NFL Draft Buzz',
            name: 'Explosive Rookie Back',
            position: 'RB',
            rating: 89,
            overallRank: 18,
            positionRank: 2,
            draftYear: 2025,
          },
          athleticProfile: {
            source: 'nflverse combine',
            draftYear: 2025,
            forty: 4.39,
            vertical: 39,
            broadJump: 128,
            speedScore: 112,
            note: 'Combine profile loaded with 112 speed score.',
          },
        }),
        rbB: player({
          fullName: 'Similar Rookie Back',
          position: 'RB',
          age: 22,
          nflDraftRound: 1,
          nflDraftPick: 29,
          yearsExp: 1,
          lastSeasonPointsPerGame: 8.9,
          lastSeasonGames: 11,
          valueProfile: {
            dynastyValue: 3550,
            marketKtc: 3500,
            fantasyCalcDynasty: 3600,
            sources: ['KTC', 'FantasyCalc'],
          },
          prospectProfile: {
            source: 'NFL Draft Buzz',
            name: 'Similar Rookie Back',
            position: 'RB',
            rating: 87,
            overallRank: 21,
            positionRank: 3,
            draftYear: 2025,
          },
          athleticProfile: {
            source: 'nflverse combine',
            draftYear: 2025,
            forty: 4.42,
            vertical: 38,
            broadJump: 126,
            speedScore: 109,
            note: 'Combine profile loaded with 109 speed score.',
          },
        }),
      },
    });

    const comp = profiles.rbA.historicalComps?.closest[0];
    expect(comp).toMatchObject({
      playerId: 'rbB',
      name: 'Similar Rookie Back',
    });
    expect(comp?.matchReasons).toContain('similar prospect/buzz signal');
    expect(comp?.matchReasons).toContain('similar athletic profile');
    expect(profiles.rbA.historicalComps?.signals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(['Buzz / Devy Prior', 'Athletic Fit', 'Price vs Production Gap'])
    );
    expect(profiles.rbA.trace.join(' ')).toContain('Historical comps: early RB prospect heat check');
  });
});
