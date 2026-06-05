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
});
