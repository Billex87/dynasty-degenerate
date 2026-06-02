import { describe, expect, it } from 'vitest';
import { buildPlayerTrajectorySignal, buildPlayerTrajectorySignals } from './playerTrajectory';
import type { PlayerDetails } from '../shared/types';

function player(input: Partial<PlayerDetails> & { fullName: string; position: string }): PlayerDetails {
  return input as PlayerDetails;
}

function valueTimeline(deltaPct: number, delta = 300): NonNullable<PlayerDetails['valueTimeline']> {
  return {
    profileKey: '12_sf_ppr_base',
    source: 'historical-value-index',
    allTimePointCount: 220,
    points: [],
    extremes: {
      high: {
        date: '2026-05-01',
        value: 5200,
        sources: ['KTC', 'FantasyCalc'],
        sourceCount: 2,
      },
      low: null,
    },
    summary: {
      startValue: 4000,
      endValue: 4000 + delta,
      delta,
      deltaPct,
      sourceSetChanged: false,
      eventCount: 1,
      note: `Stored value moved ${deltaPct}%.`,
    },
  };
}

function valueTimelineWithSourceChange(deltaPct: number, delta = 300): NonNullable<PlayerDetails['valueTimeline']> {
  return {
    ...valueTimeline(deltaPct, delta),
    summary: {
      ...valueTimeline(deltaPct, delta).summary,
      sourceSetChanged: true,
    },
  };
}

function cohort(overrides: Partial<NonNullable<PlayerDetails['playerCohort']>> = {}): NonNullable<PlayerDetails['playerCohort']> {
  return {
    playerId: 'p1',
    name: 'Test Player',
    position: 'WR',
    age: 23,
    value: 4300,
    lastSeasonPointsPerGame: 12,
    agePhase: 'early',
    productionScore: 64,
    marketScore: 50,
    marketProductionDelta: -14,
    outcomeBucket: 'breakout',
    confidence: 78,
    calibration: {
      evidenceGrade: 'strong',
      evidenceScore: 86,
      confidenceCap: 88,
      strongReadEligible: true,
      missingSignals: [],
      cautionFlags: [],
      note: 'Strong cohort read.',
    },
    draftCapital: {
      round: 1,
      pick: 18,
      tier: 'premium',
      label: 'Round 1, pick 18',
      opportunityWindow: 'protected-runway',
      patienceScore: 92,
      note: 'Premium draft capital supports patience.',
    },
    peers: [],
    trace: [],
    ...overrides,
  };
}

function situation(overrides: Partial<NonNullable<PlayerDetails['playerSituationDelta']>> = {}): NonNullable<PlayerDetails['playerSituationDelta']> {
  return {
    playerId: 'p1',
    name: 'Test Player',
    position: 'WR',
    score: 78,
    confidence: 80,
    primaryLabel: 'role-boost',
    labels: ['role-boost', 'vacated-opportunity'],
    action: 'buy',
    summary: 'Test Player has a role boost from vacated opportunity.',
    trace: [],
    missingSignals: [],
    cautionFlags: [],
    components: [],
    freshness: {
      grade: 'fresh',
      score: 88,
      signals: ['usage 2025', 'roster room 2026'],
      note: 'Fresh situation context.',
    },
    dynamicSignals: [],
    ...overrides,
  };
}

describe('player trajectory signals', () => {
  it('flags players with improving role evidence before the market catches up', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Ascending Receiver',
      position: 'WR',
      age: 23,
      valueProfile: {
        dynastyValue: 4300,
        marketKtc: 4200,
        fantasyCalcDynasty: 4400,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(4, 170),
      usageTrend: {
        season: '2025',
        team: 'SEA',
        games: 17,
        targets: 110,
        carries: 2,
        receptions: 75,
        fantasyPointsPpr: 240,
        fantasyPointsPprPerGame: 14.1,
        avgTargetShare: 0.24,
        avgOffenseSnapPct: 0.82,
        recentTargets: 34,
        recentCarries: 1,
        rollingWindows: [{
          games: 3,
          weeks: [15, 16, 17],
          targetsPerGame: 9.5,
          carriesPerGame: 0.3,
          receptionsPerGame: 6,
          fantasyPointsPprPerGame: 17,
          targetDeltaPerGame: 2.2,
          carryDeltaPerGame: 0,
          note: 'Recent target volume jumped.',
        }],
        targetTrend: 'up',
        carryTrend: 'flat',
        note: 'Usage trend from 17 games; targets climbed late.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: 72,
          incumbentPromotionScore: 28,
          qualitySignal: 'major-opening',
          note: 'Major target volume opened in the room.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort(),
      playerSituationDelta: situation(),
    }), 'wr1');

    expect(signal).toMatchObject({
      label: 'rising-role',
      action: 'buy',
      confidenceGrade: 'strong',
      readout: {
        decision: 'Do this',
        headline: 'Rising Role: Ascending Receiver',
      },
    });
    expect(signal?.evidence.join(' ')).toContain('Usage trend');
    expect(signal?.readout.whyThisFired.join(' ')).toContain('Usage trend');
    expect(signal?.readout.whatChangesThis.join(' ')).toContain('Role signal flips');
    expect(signal?.actionProof).toMatchObject({ eligible: true });
    expect(signal?.trace.join(' ')).toContain('All first-pass trajectory inputs are present');
    expect(signal?.trace.join(' ')).toContain('Action proof: complete');
  });

  it('keeps rising-role trajectory reads below exact action copy when caution flags are active', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Source Shift Riser',
      position: 'WR',
      age: 23,
      valueProfile: {
        dynastyValue: 4300,
        marketKtc: 4200,
        fantasyCalcDynasty: 4400,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimelineWithSourceChange(4, 170),
      usageTrend: {
        season: '2025',
        games: 17,
        targets: 110,
        carries: 2,
        receptions: 75,
        fantasyPointsPpr: 240,
        fantasyPointsPprPerGame: 14.1,
        avgTargetShare: 0.24,
        avgOffenseSnapPct: 0.82,
        recentTargets: 34,
        recentCarries: 1,
        rollingWindows: [{
          games: 3,
          weeks: [15, 16, 17],
          targetsPerGame: 9.5,
          carriesPerGame: 0.3,
          receptionsPerGame: 6,
          fantasyPointsPprPerGame: 17,
          targetDeltaPerGame: 2.2,
          carryDeltaPerGame: 0,
          note: 'Recent target volume jumped.',
        }],
        targetTrend: 'up',
        carryTrend: 'flat',
        note: 'Usage trend from 17 games; targets climbed late.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: 72,
          incumbentPromotionScore: 28,
          qualitySignal: 'major-opening',
          note: 'Major target volume opened in the room.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort(),
      playerSituationDelta: situation(),
    }), 'wr-source-shift');

    expect(signal).toMatchObject({
      label: 'rising-role',
      action: 'buy',
      readout: {
        decision: "Don't force it",
      },
      actionProof: {
        eligible: false,
      },
    });
    expect(signal?.cautionFlags).toContain('value source mix changed');
    expect(signal?.actionProof.blockers.join(' ')).toContain('value source mix changed');
    expect(signal?.trace.join(' ')).toContain('Action proof blocked');
  });

  it('keeps post-hype trajectory reads below exact action copy when cohort calibration is not strong-read eligible', () => {
    const baseCohort = cohort();
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Uncalibrated Prospect',
      position: 'WR',
      age: 22,
      valueProfile: {
        dynastyValue: 3600,
        marketKtc: 3500,
        fantasyCalcDynasty: 3700,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(-12, -520),
      usageTrend: {
        season: '2025',
        games: 12,
        targets: 72,
        carries: 0,
        receptions: 44,
        fantasyPointsPpr: 125,
        fantasyPointsPprPerGame: 10.4,
        avgTargetShare: 0.19,
        avgOffenseSnapPct: 0.66,
        recentTargets: 24,
        recentCarries: 0,
        rollingWindows: [{
          games: 3,
          weeks: [15, 16, 17],
          targetsPerGame: 7.7,
          carriesPerGame: 0,
          receptionsPerGame: 4.3,
          fantasyPointsPprPerGame: 12,
          targetDeltaPerGame: 1.3,
          carryDeltaPerGame: 0,
          note: 'Role stabilized late.',
        }],
        targetTrend: 'up',
        carryTrend: 'flat',
        note: 'Targets improved after a slow start.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: 38,
          incumbentPromotionScore: 20,
          qualitySignal: 'minor-opening',
          note: 'Some room opened for a young receiver.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort({
        outcomeBucket: 'steady',
        calibration: {
          ...baseCohort.calibration,
          strongReadEligible: false,
          note: 'Cohort evidence is usable but not strong enough for action copy.',
        },
        draftCapital: {
          round: 1,
          pick: 22,
          tier: 'premium',
          label: 'Round 1, pick 22',
          opportunityWindow: 'protected-runway',
          patienceScore: 88,
          note: 'Premium draft capital supports patience.',
        },
      }),
      playerSituationDelta: situation({
        primaryLabel: 'draft-capital-patience',
        labels: ['draft-capital-patience'],
        action: 'monitor',
        score: 66,
        summary: 'Draft capital still supports patience.',
      }),
    }), 'wr-uncalibrated');

    expect(signal).toMatchObject({
      label: 'post-hype-window',
      readout: {
        decision: "Don't force it",
      },
      actionProof: {
        eligible: false,
      },
    });
    expect(signal?.actionProof.blockers.join(' ')).toContain('Cohort calibration is not strong-read eligible');
  });

  it('flags market traps when price rises into declining role evidence', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Priced Up Veteran',
      position: 'WR',
      age: 28,
      valueProfile: {
        dynastyValue: 5600,
        marketKtc: 5700,
        fantasyCalcDynasty: 5500,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(28, 1200),
      usageTrend: {
        season: '2025',
        games: 16,
        targets: 102,
        carries: 0,
        receptions: 65,
        fantasyPointsPpr: 205,
        fantasyPointsPprPerGame: 12.8,
        avgTargetShare: 0.2,
        avgOffenseSnapPct: 0.71,
        recentTargets: 12,
        recentCarries: 0,
        rollingWindows: [{
          games: 3,
          weeks: [15, 16, 17],
          targetsPerGame: 4,
          carriesPerGame: 0,
          receptionsPerGame: 2.7,
          fantasyPointsPprPerGame: 8,
          targetDeltaPerGame: -2.1,
          carryDeltaPerGame: 0,
          note: 'Recent target volume dipped.',
        }],
        targetTrend: 'down',
        carryTrend: 'flat',
        note: 'Targets slipped in the recent window.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: -62,
          incumbentPromotionScore: 0,
          qualitySignal: 'major-squeeze',
          note: 'Premium competition squeezed the room.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort({
        outcomeBucket: 'market-over-production',
        confidence: 74,
      }),
      playerSituationDelta: situation({
        score: 36,
        confidence: 72,
        primaryLabel: 'role-threat',
        labels: ['role-threat', 'crowded-room'],
        action: 'monitor',
        summary: 'Role threat from premium competition.',
      }),
    }), 'wr2');

    expect(signal).toMatchObject({
      label: 'market-trap',
      action: 'avoid',
      tone: 'danger',
      readout: {
        decision: 'Do not do this',
        status: expect.stringMatching(/^Risk/),
      },
    });
    expect(signal?.scoreBreakdown.marketMomentum).toBeGreaterThanOrEqual(80);
    expect(signal?.readout.detail).toContain('headline market price');
  });

  it('flags peak risk for older players with weak situation or injury evidence', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Aging Runner',
      position: 'RB',
      age: 29,
      valueProfile: {
        dynastyValue: 4100,
        marketKtc: 4000,
        fantasyCalcDynasty: 4200,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(0, 0),
      usageTrend: {
        season: '2025',
        games: 13,
        targets: 30,
        carries: 185,
        receptions: 22,
        fantasyPointsPpr: 185,
        fantasyPointsPprPerGame: 14.2,
        avgTargetShare: 0.08,
        avgOffenseSnapPct: 0.55,
        recentTargets: 4,
        recentCarries: 28,
        targetTrend: 'down',
        carryTrend: 'down',
        note: 'Usage declined late.',
      },
      playerCohort: cohort({
        position: 'RB',
        outcomeBucket: 'injury-risk',
        confidence: 70,
      }),
      playerSituationDelta: situation({
        position: 'RB',
        score: 42,
        confidence: 64,
        primaryLabel: 'opportunity-cliff',
        labels: ['opportunity-cliff'],
        action: 'sell',
        summary: 'Aging back profile has opportunity cliff risk.',
      }),
    }), 'rb1');

    expect(signal).toMatchObject({
      label: 'peak-risk',
      action: 'sell',
      tone: 'warn',
    });
    expect(signal?.evidence.join(' ')).toContain('Age curve');
  });

  it('flags post-hype windows when market falls but runway and role evidence remain', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Discounted Prospect',
      position: 'WR',
      age: 22,
      valueProfile: {
        dynastyValue: 3600,
        marketKtc: 3500,
        fantasyCalcDynasty: 3700,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(-12, -520),
      usageTrend: {
        season: '2025',
        games: 12,
        targets: 72,
        carries: 0,
        receptions: 44,
        fantasyPointsPpr: 125,
        fantasyPointsPprPerGame: 10.4,
        avgTargetShare: 0.19,
        avgOffenseSnapPct: 0.66,
        recentTargets: 24,
        recentCarries: 0,
        rollingWindows: [{
          games: 3,
          weeks: [15, 16, 17],
          targetsPerGame: 7.7,
          carriesPerGame: 0,
          receptionsPerGame: 4.3,
          fantasyPointsPprPerGame: 12,
          targetDeltaPerGame: 1.3,
          carryDeltaPerGame: 0,
          note: 'Role stabilized late.',
        }],
        targetTrend: 'up',
        carryTrend: 'flat',
        note: 'Targets improved after a slow start.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: 38,
          incumbentPromotionScore: 20,
          qualitySignal: 'minor-opening',
          note: 'Some room opened for a young receiver.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort({
        outcomeBucket: 'steady',
        draftCapital: {
          round: 1,
          pick: 22,
          tier: 'premium',
          label: 'Round 1, pick 22',
          opportunityWindow: 'protected-runway',
          patienceScore: 88,
          note: 'Premium draft capital supports patience.',
        },
      }),
      playerSituationDelta: situation({
        primaryLabel: 'draft-capital-patience',
        labels: ['draft-capital-patience'],
        action: 'monitor',
        score: 66,
        summary: 'Draft capital still supports patience.',
      }),
    }), 'wr3');

    expect(signal).toMatchObject({
      label: 'post-hype-window',
      action: 'monitor',
      tone: 'info',
      readout: {
        headline: 'Post-Hype Window: Discounted Prospect',
      },
    });
    expect(signal?.readout.detail).toContain('market has cooled');
  });

  it('keeps balanced profiles as stable holds', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Balanced Starter',
      position: 'QB',
      age: 27,
      valueProfile: {
        dynastyValue: 5100,
        marketKtc: 5050,
        fantasyCalcDynasty: 5150,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(2, 100),
      usageTrend: {
        season: '2025',
        games: 17,
        targets: 0,
        carries: 60,
        receptions: 0,
        fantasyPointsPpr: 310,
        fantasyPointsPprPerGame: 18.2,
        avgTargetShare: 0,
        avgOffenseSnapPct: 0.99,
        recentTargets: 0,
        recentCarries: 10,
        targetTrend: 'flat',
        carryTrend: 'flat',
        note: 'Role stayed stable.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: 0,
          incumbentPromotionScore: 0,
          qualitySignal: 'neutral',
          note: 'No major room change.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort({
        position: 'QB',
        outcomeBucket: 'steady',
        confidence: 70,
      }),
      playerSituationDelta: situation({
        position: 'QB',
        score: 58,
        confidence: 70,
        primaryLabel: 'stable-role',
        labels: [],
        action: 'hold',
        summary: 'Stable starting profile.',
      }),
    }), 'qb1');

    expect(signal).toMatchObject({
      label: 'stable-hold',
      action: 'hold',
      tone: 'neutral',
      readout: {
        decision: "Don't force it",
      },
    });
  });

  it('uses running back carry growth as rising-role evidence', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Emerging Runner',
      position: 'RB',
      age: 23,
      valueProfile: {
        dynastyValue: 3300,
        marketKtc: 3200,
        fantasyCalcDynasty: 3400,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(3, 95),
      usageTrend: {
        season: '2025',
        games: 16,
        targets: 38,
        carries: 155,
        receptions: 28,
        fantasyPointsPpr: 170,
        fantasyPointsPprPerGame: 10.6,
        avgTargetShare: 0.12,
        avgOffenseSnapPct: 0.63,
        recentTargets: 10,
        recentCarries: 58,
        rollingWindows: [{
          games: 3,
          weeks: [15, 16, 17],
          targetsPerGame: 3.3,
          carriesPerGame: 19.3,
          receptionsPerGame: 2.3,
          fantasyPointsPprPerGame: 16.5,
          targetDeltaPerGame: 0.4,
          carryDeltaPerGame: 5.5,
          note: 'Recent rushing volume jumped.',
        }],
        targetTrend: 'flat',
        carryTrend: 'up',
        note: 'Carry share climbed late.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: 64,
          incumbentPromotionScore: 35,
          qualitySignal: 'major-opening',
          note: 'Backfield touches opened up.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort({
        position: 'RB',
        outcomeBucket: 'breakout',
      }),
      playerSituationDelta: situation({
        position: 'RB',
        score: 74,
        primaryLabel: 'role-boost',
        labels: ['role-boost', 'vacated-opportunity'],
        action: 'buy',
        summary: 'Backfield role is expanding.',
      }),
    }), 'rb2');

    expect(signal).toMatchObject({
      label: 'rising-role',
      action: 'buy',
      position: 'RB',
    });
    expect(signal?.evidence.join(' ')).toContain('Carry share climbed late');
    expect(signal?.scoreBreakdown.roleMomentum).toBeGreaterThanOrEqual(66);
  });

  it('does not apply early age-curve pressure to quarterbacks', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Veteran Quarterback',
      position: 'QB',
      age: 32,
      valueProfile: {
        dynastyValue: 4800,
        marketKtc: 4700,
        fantasyCalcDynasty: 4900,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(1, 40),
      usageTrend: {
        season: '2025',
        games: 17,
        targets: 0,
        carries: 52,
        receptions: 0,
        fantasyPointsPpr: 295,
        fantasyPointsPprPerGame: 17.4,
        avgTargetShare: 0,
        avgOffenseSnapPct: 0.98,
        recentTargets: 0,
        recentCarries: 9,
        targetTrend: 'flat',
        carryTrend: 'flat',
        note: 'Starting role stayed stable.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: 0,
          incumbentPromotionScore: 0,
          qualitySignal: 'neutral',
          note: 'No quarterback room change.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort({
        position: 'QB',
        outcomeBucket: 'steady',
      }),
      playerSituationDelta: situation({
        position: 'QB',
        score: 60,
        primaryLabel: 'stable-role',
        labels: [],
        action: 'hold',
        summary: 'Stable quarterback starter.',
      }),
    }), 'qb2');

    expect(signal?.scoreBreakdown.ageRisk).toBe(20);
    expect(signal?.cautionFlags).not.toContain('age curve risk');
    expect(signal?.label).toBe('stable-hold');
  });

  it('flags quarterback market traps when price rises into role-threat evidence', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Expensive Quarterback',
      position: 'QB',
      age: 30,
      valueProfile: {
        dynastyValue: 6900,
        marketKtc: 7000,
        fantasyCalcDynasty: 6800,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(18, 1050),
      usageTrend: {
        season: '2025',
        games: 16,
        targets: 0,
        carries: 38,
        receptions: 0,
        fantasyPointsPpr: 255,
        fantasyPointsPprPerGame: 15.9,
        avgTargetShare: 0,
        avgOffenseSnapPct: 0.9,
        recentTargets: 0,
        recentCarries: 4,
        targetTrend: 'flat',
        carryTrend: 'down',
        note: 'Late-season rushing volume and job security slipped.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: -46,
          incumbentPromotionScore: 0,
          qualitySignal: 'major-squeeze',
          note: 'Team added credible quarterback competition.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort({
        position: 'QB',
        outcomeBucket: 'market-over-production',
        confidence: 76,
      }),
      playerSituationDelta: situation({
        position: 'QB',
        score: 42,
        confidence: 72,
        primaryLabel: 'role-threat',
        labels: ['role-threat', 'crowded-room'],
        action: 'monitor',
        summary: 'Quarterback room added a role threat.',
      }),
    }), 'qb3');

    expect(signal).toMatchObject({
      label: 'market-trap',
      action: 'avoid',
      position: 'QB',
    });
    expect(signal?.scoreBreakdown.marketMomentum).toBeGreaterThanOrEqual(70);
    expect(signal?.readout.detail).toContain('headline market price');
  });

  it('keeps tight end post-hype windows alive when draft runway offsets a market dip', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Patient Tight End',
      position: 'TE',
      age: 23,
      valueProfile: {
        dynastyValue: 2800,
        marketKtc: 2700,
        fantasyCalcDynasty: 2900,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimeline(-10, -330),
      usageTrend: {
        season: '2025',
        games: 15,
        targets: 74,
        carries: 0,
        receptions: 49,
        fantasyPointsPpr: 145,
        fantasyPointsPprPerGame: 9.7,
        avgTargetShare: 0.19,
        avgOffenseSnapPct: 0.74,
        recentTargets: 24,
        recentCarries: 0,
        rollingWindows: [{
          games: 3,
          weeks: [15, 16, 17],
          targetsPerGame: 8,
          carriesPerGame: 0,
          receptionsPerGame: 5,
          fantasyPointsPprPerGame: 12.4,
          targetDeltaPerGame: 1.5,
          carryDeltaPerGame: 0,
          note: 'Tight end route involvement improved late.',
        }],
        targetTrend: 'up',
        carryTrend: 'flat',
        note: 'Role improved late even as market cooled.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: 28,
          incumbentPromotionScore: 14,
          qualitySignal: 'minor-opening',
          note: 'Passing-game room remains workable.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort({
        position: 'TE',
        outcomeBucket: 'steady',
        draftCapital: {
          round: 2,
          pick: 38,
          tier: 'premium',
          label: 'Round 2, pick 38',
          opportunityWindow: 'protected-runway',
          patienceScore: 82,
          note: 'Day-two draft capital keeps runway intact.',
        },
      }),
      playerSituationDelta: situation({
        position: 'TE',
        score: 64,
        primaryLabel: 'draft-capital-patience',
        labels: ['draft-capital-patience'],
        action: 'monitor',
        summary: 'Tight end runway still supports patience.',
      }),
    }), 'te3');

    expect(signal).toMatchObject({
      label: 'post-hype-window',
      action: 'monitor',
      position: 'TE',
    });
    expect(signal?.readout.detail).toContain('market has cooled');
    expect(signal?.scoreBreakdown.roleMomentum).toBeGreaterThanOrEqual(58);
  });

  it('keeps thin profiles source-limited instead of inventing a strong read', () => {
    const signals = buildPlayerTrajectorySignals({
      playerDetailsById: {
        te1: player({
          fullName: 'Thin Tight End',
          position: 'TE',
          valueProfile: {
            dynastyValue: 900,
          },
        }),
      },
    });

    expect(signals.te1).toMatchObject({
      label: 'source-limited',
      confidenceGrade: 'blocked',
      readout: {
        decision: 'Insufficient evidence',
      },
    });
    expect(signals.te1.confidence).toBeLessThanOrEqual(44);
    expect(signals.te1.missingSignals).toContain('stored value timeline');
    expect(signals.te1.missingSignals).toContain('cohort profile');
    expect(signals.te1.readout.whatChangesThis.join(' ')).toContain('stored value timeline');
  });

  it('tracks value-source changes as caution flags', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Source Shift Player',
      position: 'TE',
      age: 25,
      valueProfile: {
        dynastyValue: 2600,
        marketKtc: 2500,
        fantasyCalcDynasty: 2700,
        sources: ['KTC', 'FantasyCalc'],
      },
      valueTimeline: valueTimelineWithSourceChange(5, 120),
      usageTrend: {
        season: '2025',
        games: 15,
        targets: 70,
        carries: 0,
        receptions: 48,
        fantasyPointsPpr: 150,
        fantasyPointsPprPerGame: 10,
        avgTargetShare: 0.18,
        avgOffenseSnapPct: 0.7,
        recentTargets: 18,
        recentCarries: 0,
        targetTrend: 'flat',
        carryTrend: 'flat',
        note: 'Role was mostly stable.',
      },
      rosterRoom: {
        opportunityDelta: {
          netOpportunityScore: 5,
          incumbentPromotionScore: 0,
          qualitySignal: 'neutral',
          note: 'No major room change.',
        },
      } as PlayerDetails['rosterRoom'],
      playerCohort: cohort({
        position: 'TE',
        outcomeBucket: 'steady',
      }),
      playerSituationDelta: situation({
        position: 'TE',
        score: 56,
        primaryLabel: 'stable-role',
        labels: [],
        action: 'hold',
        summary: 'Stable tight end profile.',
      }),
    }), 'te2');

    expect(signal?.cautionFlags).toContain('value source mix changed');
    expect(signal?.readout.whatChangesThis.join(' ')).toContain('Resolve caution flags');
  });

  it('does not emit trajectory signals for unsupported positions', () => {
    const signal = buildPlayerTrajectorySignal(player({
      fullName: 'Defense Streamer',
      position: 'DEF',
      valueProfile: {
        dynastyValue: 100,
        sources: ['KTC'],
      },
    }), 'def1');

    expect(signal).toBeNull();
  });
});
