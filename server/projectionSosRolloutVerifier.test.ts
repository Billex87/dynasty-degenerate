import { describe, expect, it } from 'vitest';
import { validateReportContract } from '../scripts/verify-projection-sos-rollout';

function baseReportData(overrides: Record<string, any> = {}) {
  const reportData = {
    leagueValueMode: 'redraft',
    weeklyProjectionDiagnostics: {
      status: 'blocked',
      rowCount: 0,
    },
    schedulePlanning: {
      status: 'ready',
    },
    playoffSchedulePlanning: {
      status: 'ready',
      confidence: 54,
      confidenceReasons: ['Fixture schedule/value fallback.'],
      weeks: [15, 16, 17],
      managerPlans: [{
        manager: 'Fixture',
        confidence: 54,
        weeks: [{
          week: 15,
          projectedStarterPoints: null,
          confidence: 54,
          confidenceCapReason: 'Fixture fallback cap.',
          confidenceReasons: ['Fixture schedule/value fallback.'],
          projectionCoverage: {
            coveredPlayerCount: 0,
            mode: 'schedule-value',
          },
        }],
      }],
      actionItems: [{
        id: 'fixture-cover-risk',
        manager: 'Fixture',
        week: 15,
        type: 'cover-risk',
        confidence: 54,
        confidenceReasons: ['Fixture schedule/value fallback.'],
        confidenceCapReason: 'Fixture fallback cap.',
        replacementTargets: [{}],
        affectedPlayers: [{}],
      }],
    },
    matchupPreviews: [{
      confidence: 54,
      confidenceCapReason: 'Fixture fallback cap.',
      confidenceReasons: ['Fixture schedule/value fallback.'],
      projectionCoverage: {
        mode: 'schedule-value',
      },
    }],
    lineupStrength: {
      status: 'value-only',
    },
    redraftValuation: {
      status: 'value-only',
    },
    tradeRecommendationContext: {
      status: 'partial',
      source: 'stored-report-trade-recommendation',
      projectionStatus: 'blocked',
      generatedAt: '2026-06-05T00:00:00.000Z',
      note: 'Fixture trade context is capped to value and schedule evidence.',
      rows: [{
        id: 'fixture-trade-hold',
        manager: 'Fixture',
        targetManager: 'Rival',
        action: 'hold',
        rosterWindow: 'middle',
        player: { player_id: 'fixture-wr', name: 'Fixture Receiver', pos: 'WR', team: 'NYJ' },
        score: 58,
        confidence: 58,
        confidenceReasons: ['Fixture trade context uses schedule/value fallback.'],
        confidenceCapReason: 'Fixture fallback cap.',
        shortTermValue: 3000,
        dynastyValue: 3200,
        valueGap: 200,
        projectedFantasyPoints: null,
        projectionStatus: 'blocked',
        playoffLeverageScore: null,
        scheduleAdjustment: 0,
        byeAdjustment: 0,
        scheduleContextScore: 12,
        contenderFitScore: 46,
        rebuilderFitScore: 54,
        fragileProjectionSpike: false,
        signals: ['schedule-value'],
        sourceTrace: ['fixture-trade-value'],
      }],
      managers: [{
        manager: 'Fixture',
        rosterWindow: 'middle',
        tradeFor: [],
        tradeAway: [],
        hold: [],
      }],
    },
    contenderPlayoffContext: {
      status: 'partial',
      source: 'stored-report-contender-playoff',
      projectionStatus: 'blocked',
      generatedAt: '2026-06-05T00:00:00.000Z',
      weeks: [15],
      note: 'Fixture contender context is capped to schedule/value evidence.',
      rows: [{
        id: 'fixture-playoff-week-15',
        manager: 'Fixture',
        week: 15,
        projectedStarterPoints: null,
        projectionCoverage: {
          coveredPlayerCount: 0,
          totalPlayerCount: 1,
          mode: 'schedule-value',
        },
        opponentDifficultyScore: 20,
        byeBenchPressureScore: 10,
        stashValueScore: 8,
        affectedPlayers: [],
        stashRecommendations: [],
        confidence: 58,
        confidenceReasons: ['Fixture contender context uses schedule/value fallback.'],
        confidenceCapReason: 'Fixture fallback cap.',
        sourceTrace: ['fixture-playoff-schedule'],
      }],
      managers: [{
        manager: 'Fixture',
        rosterWindow: 'middle',
        contenderScore: 62,
        rebuildScore: 38,
        projectedLineupStrength: null,
        opponentDifficultyScore: 20,
        byeBenchPressureScore: 10,
        stashValueScore: 8,
        confidence: 58,
        confidenceReasons: ['Fixture contender context uses schedule/value fallback.'],
        confidenceCapReason: 'Fixture fallback cap.',
        weeks: [],
        stashRecommendations: [],
      }],
    },
    waiverIntelligence: {
      priorityWaiverTargets: [{
        confidence: 58,
        reasons: ['schedule window fixture'],
        scheduleSignal: {
          matchupWindows: {
            next3: {
              weeks: [1],
              score: 12,
              easyWeeks: 1,
              hardWeeks: 0,
              playableWeeks: 1,
            },
          },
        },
        opportunityWindows: [{
          type: 'upcoming-schedule',
          source: 'DraftSharks',
          confidence: 58,
        }],
      }],
      specialTeamsStreamerTargets: [{
        weeklyProjection: null,
        projectionSupport: {
          status: 'blocked',
          position: 'DEF',
          candidateCount: 4,
          readyProjectionCount: 0,
          coveragePct: 0,
          projectedFantasyPoints: null,
          confidence: 38,
          confidenceCapReason: 'Fixture fallback cap.',
          sourceTrace: ['schedule-sos-streamer-gate'],
          note: 'Fixture schedule-only streamer.',
        },
      }],
    },
  };

  return {
    ...reportData,
    ...overrides,
    playoffSchedulePlanning: {
      ...reportData.playoffSchedulePlanning,
      ...(overrides.playoffSchedulePlanning || {}),
    },
    waiverIntelligence: {
      ...reportData.waiverIntelligence,
      ...(overrides.waiverIntelligence || {}),
    },
  };
}

describe('validateReportContract', () => {
  it('accepts a clean projection-off fallback report contract', () => {
    const result = validateReportContract({
      mode: 'projection-off',
      leagueId: 'fixture',
      reportData: baseReportData(),
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.summary.specialTeamsStreamerProjectionSupportCount).toBe(1);
    expect(result.summary.tradeRecommendationProjectedRowCount).toBe(0);
    expect(result.summary.contenderPlayoffProjectedRowCount).toBe(0);
  });

  it('accepts a projection-on report with projection-backed matchup coverage and streamer support', () => {
    const result = validateReportContract({
      mode: 'projection-on',
      leagueId: 'fixture',
      reportData: baseReportData({
        weeklyProjectionDiagnostics: {
          status: 'ready',
          rowCount: 492,
        },
        playoffSchedulePlanning: {
          confidence: 58,
          confidenceReasons: ['Projection readiness ready with fallback playoff cap.'],
        },
        matchupPreviews: [{
          confidence: 76,
          confidenceReasons: ['Fixture projection-backed matchup.'],
          projectionCoverage: {
            mode: 'stored-weekly-projection',
          },
        }],
        waiverIntelligence: {
          ...baseReportData().waiverIntelligence,
          specialTeamsStreamerTargets: [{
            weeklyProjection: {
              status: 'ready',
              projectedFantasyPoints: 8.4,
            },
            projectionSupport: {
              status: 'projection-backed',
              position: 'K',
              candidateCount: 3,
              readyProjectionCount: 3,
              coveragePct: 100,
              projectedFantasyPoints: 8.4,
              confidence: 83,
              confidenceCapReason: null,
              sourceTrace: ['stored-weekly-projection:fixture'],
              note: 'Fixture projection-backed streamer.',
            },
          }],
        },
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.summary.matchupPreviewProjectionBackedCount).toBe(1);
    expect(result.summary.specialTeamsStreamerProjectionBackedCount).toBe(1);
  });

  it('rejects projection-off reports that leak special-teams weekly projections', () => {
    const reportData = baseReportData({
      waiverIntelligence: {
        ...baseReportData().waiverIntelligence,
        specialTeamsStreamerTargets: [{
          weeklyProjection: {
            status: 'ready',
            source: 'stored-weekly-projection',
            projectedFantasyPoints: 9.1,
          },
          projectionSupport: {
            status: 'projection-backed',
            position: 'DEF',
            candidateCount: 3,
            readyProjectionCount: 3,
            coveragePct: 100,
            projectedFantasyPoints: 9.1,
            confidence: 83,
            confidenceCapReason: null,
            sourceTrace: ['stored-weekly-projection:fixture'],
            note: 'Fixture leak.',
          },
        }],
      },
    });

    const result = validateReportContract({
      mode: 'projection-off',
      leagueId: 'fixture',
      reportData,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('projection-off specialTeamsStreamerTargets still expose projection-backed support');
    expect(result.failures).toContain('projection-off specialTeamsStreamerTargets still expose weekly projections');
    expect(result.failures).toContain('projection-off specialTeamsStreamerTargets still expose projected fantasy points');
  });

  it('rejects projection-off reports that leak trade or playoff projection context', () => {
    const reportData = baseReportData({
      tradeRecommendationContext: {
        ...baseReportData().tradeRecommendationContext,
        rows: [{
          ...baseReportData().tradeRecommendationContext.rows[0],
          projectedFantasyPoints: 18.6,
          projectionStatus: 'ready',
          fragileProjectionSpike: true,
          confidence: 79,
          confidenceReasons: ['Stored weekly projection spike fixture.'],
          sourceTrace: ['stored-weekly-projection:fixture'],
        }],
      },
      contenderPlayoffContext: {
        ...baseReportData().contenderPlayoffContext,
        rows: [{
          ...baseReportData().contenderPlayoffContext.rows[0],
          projectedStarterPoints: 128.4,
          projectionCoverage: {
            coveredPlayerCount: 1,
            totalPlayerCount: 1,
            mode: 'stored-weekly-projection',
          },
          confidence: 79,
          confidenceReasons: ['Stored weekly projection playoff fixture.'],
          sourceTrace: ['stored-weekly-projection:fixture'],
        }],
      },
    });

    const result = validateReportContract({
      mode: 'projection-off',
      leagueId: 'fixture',
      reportData,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain('projection-off report still contains stored weekly projection claims');
    expect(result.failures).toContain('projection-off tradeRecommendationContext still exposes projected fantasy points');
    expect(result.failures).toContain('projection-off tradeRecommendationContext still exposes fragile projection spikes');
    expect(result.failures).toContain('projection-off tradeRecommendationContext confidence exceeds fallback cap: 79');
    expect(result.failures).toContain('projection-off contenderPlayoffContext still exposes projected starter points');
    expect(result.failures).toContain('projection-off contenderPlayoffContext still exposes projection-backed coverage');
    expect(result.failures).toContain('projection-off contenderPlayoffContext confidence exceeds fallback cap: 79');
  });
});
