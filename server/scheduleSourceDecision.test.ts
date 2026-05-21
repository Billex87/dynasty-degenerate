import { describe, expect, it } from 'vitest';
import type { DraftSharksSosProfile } from './draftSharksSchedule';
import { buildScheduleSourceDecision } from './scheduleSourceDecision';

function draftSharksProfile(overrides: Partial<DraftSharksSosProfile> = {}): DraftSharksSosProfile {
  return {
    team: 'PHI',
    position: 'QB',
    seasonSOS: null,
    remainingSOS: 8.8,
    scheduleTier: 'easy',
    streamerWeeks: [1, 2],
    avoidWeeks: [6],
    weeklyMatchups: [
      { week: 1, opponent: 'WAS', homeAway: 'home', matchupPercent: 19.1, matchupTier: 'easy' },
      { week: 2, opponent: 'TEN', homeAway: 'away', matchupPercent: 14, matchupTier: 'easy' },
      { week: 3, opponent: 'CHI', homeAway: 'away', matchupPercent: 17.4, matchupTier: 'easy' },
    ],
    source: 'DraftSharks SOS',
    updatedAt: '2026-05-20T12:00:00Z',
    ...overrides,
  };
}

describe('schedule source decision', () => {
  it('uses DraftSharks percentages for SOS action and confidence', () => {
    const decision = buildScheduleSourceDecision({
      team: 'PHI',
      position: 'QB',
      weekStart: 1,
      weekEnd: 3,
      draftSharksProfile: draftSharksProfile(),
    });

    expect(decision).toMatchObject({
      action: 'target',
      agreement: 'draftsharks-only',
      draftSharksAverage: 16.8,
      confidence: 82,
      confidenceCapReason: null,
      easyWeeks: [1, 2, 3],
      hardWeeks: [],
    });
    expect(decision.sourceTrace.join(' ')).toContain('DraftSharks SOS');
    expect(decision.sourceTrace.join(' ')).toContain('DraftSharks-only SOS decision policy');
    expect(decision.whyThisFired).toContain('DraftSharks SOS average');
  });

  it('returns avoid when DraftSharks percentages are rough', () => {
    const decision = buildScheduleSourceDecision({
      team: 'PHI',
      position: 'QB',
      weekStart: 1,
      weekEnd: 2,
      draftSharksProfile: draftSharksProfile({
        weeklyMatchups: [
          { week: 1, opponent: 'WAS', homeAway: 'home', matchupPercent: -18, matchupTier: 'hard' },
          { week: 2, opponent: 'TEN', homeAway: 'away', matchupPercent: -12, matchupTier: 'hard' },
        ],
      }),
    });

    expect(decision.action).toBe('avoid');
    expect(decision.agreement).toBe('draftsharks-only');
    expect(decision.finalScore).toBe(-15);
    expect(decision.confidence).toBe(82);
    expect(decision.confidenceCapReason).toBeNull();
    expect(decision.whyThisFired).toContain('DraftSharks SOS average is -15%');
  });

  it('does not fall back when DraftSharks percentage rows are missing', () => {
    const decision = buildScheduleSourceDecision({
      team: 'PHI',
      position: 'QB',
      weekStart: 1,
      weekEnd: 2,
    });

    expect(decision.action).toBe('insufficient-data');
    expect(decision.agreement).toBe('missing');
    expect(decision.finalScore).toBeNull();
    expect(decision.confidence).toBe(0);
    expect(decision.confidenceCapReason).toBe('DraftSharks SOS missing');
  });

  it('returns insufficient-data when DraftSharks has no usable rows', () => {
    const decision = buildScheduleSourceDecision({
      team: 'PHI',
      position: 'QB',
      weekStart: 1,
      weekEnd: 3,
      draftSharksProfile: draftSharksProfile({ weeklyMatchups: [] }),
    });

    expect(decision).toMatchObject({
      action: 'insufficient-data',
      agreement: 'missing',
      finalScore: null,
      confidence: 0,
    });
  });
});
