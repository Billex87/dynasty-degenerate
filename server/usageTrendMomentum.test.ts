import { describe, expect, it } from 'vitest';
import { buildUsageTrendMomentumSummary, type WeeklyUsageObservation } from './usageTrendMomentum';

function weeks(rows: Array<Partial<WeeklyUsageObservation>>): WeeklyUsageObservation[] {
  return rows.map((row, index) => ({
    week: index + 1,
    targets: 0,
    rushAttempts: 0,
    offenseSnapPct: 0.4,
    fantasyPointsPpr: 0,
    ...row,
  }));
}

describe('usage trend momentum', () => {
  it('classifies sustained growth when short and medium windows both beat the season baseline', () => {
    const summary = buildUsageTrendMomentumSummary(weeks([
      { targets: 2, rushAttempts: 0, offenseSnapPct: 0.42, fantasyPointsPpr: 4 },
      { targets: 3, rushAttempts: 0, offenseSnapPct: 0.48, fantasyPointsPpr: 6 },
      { targets: 4, rushAttempts: 1, offenseSnapPct: 0.55, fantasyPointsPpr: 8 },
      { targets: 8, rushAttempts: 1, offenseSnapPct: 0.7, fantasyPointsPpr: 14 },
      { targets: 9, rushAttempts: 2, offenseSnapPct: 0.75, fantasyPointsPpr: 17 },
      { targets: 10, rushAttempts: 2, offenseSnapPct: 0.82, fantasyPointsPpr: 20 },
    ]));

    expect(summary).toMatchObject({
      gameCount: 6,
      primaryDirection: 'sustained-growth',
      missingEvidence: [],
      confidenceCapReason: null,
    });
    expect(summary.confidence).toBeGreaterThanOrEqual(70);
    expect(summary.windows.find((window) => window.games === 3)).toMatchObject({
      weeks: [4, 5, 6],
      targetsPerGame: 9,
      snapDeltaPct: expect.any(Number),
      direction: 'sustained-growth',
    });
  });

  it('separates a short spike from confirmed role growth', () => {
    const summary = buildUsageTrendMomentumSummary(weeks([
      { targets: 2, rushAttempts: 1, offenseSnapPct: 45, fantasyPointsPpr: 4 },
      { targets: 2, rushAttempts: 1, offenseSnapPct: 45, fantasyPointsPpr: 4 },
      { targets: 2, rushAttempts: 1, offenseSnapPct: 46, fantasyPointsPpr: 5 },
      { targets: 2, rushAttempts: 1, offenseSnapPct: 45, fantasyPointsPpr: 4 },
      { targets: 3, rushAttempts: 1, offenseSnapPct: 46, fantasyPointsPpr: 6 },
      { targets: 12, rushAttempts: 4, offenseSnapPct: 85, fantasyPointsPpr: 24 },
    ]));

    expect(summary.primaryDirection).toBe('short-spike');
    expect(summary.note).toContain('needs a longer confirmation window');
    expect(summary.confidence).toBeLessThan(70);
  });

  it('classifies declining usage against the season baseline', () => {
    const summary = buildUsageTrendMomentumSummary(weeks([
      { targets: 10, rushAttempts: 2, offenseSnapPct: 82, fantasyPointsPpr: 22 },
      { targets: 9, rushAttempts: 2, offenseSnapPct: 78, fantasyPointsPpr: 18 },
      { targets: 8, rushAttempts: 1, offenseSnapPct: 72, fantasyPointsPpr: 15 },
      { targets: 3, rushAttempts: 0, offenseSnapPct: 45, fantasyPointsPpr: 5 },
      { targets: 2, rushAttempts: 0, offenseSnapPct: 38, fantasyPointsPpr: 4 },
      { targets: 2, rushAttempts: 0, offenseSnapPct: 35, fantasyPointsPpr: 3 },
    ]));

    expect(summary.primaryDirection).toBe('declining');
    expect(summary.windows.find((window) => window.games === 3)).toMatchObject({
      weeks: [4, 5, 6],
      direction: 'declining',
    });
  });

  it('caps confidence for thin samples and missing snap evidence', () => {
    const summary = buildUsageTrendMomentumSummary([
      { week: 1, targets: 6, rushAttempts: 0, fantasyPointsPpr: 8 },
      { week: 2, targets: 8, rushAttempts: 0, fantasyPointsPpr: 11 },
    ]);

    expect(summary).toMatchObject({
      primaryDirection: 'thin-sample',
      confidenceCapReason: 'Usage momentum sample is too thin.',
      missingEvidence: expect.arrayContaining(['three-game usage sample', 'weekly snap share']),
    });
    expect(summary.confidence).toBeLessThanOrEqual(44);
  });

  it('does not treat explicit null provider fields as zero-volume evidence', () => {
    const summary = buildUsageTrendMomentumSummary([
      { week: 1, targets: null, carries: null, offenseSnapPct: null, fantasyPointsPpr: null },
      { week: 2, targets: null, carries: null, offenseSnapPct: null, fantasyPointsPpr: null },
      { week: 3, targets: null, carries: null, offenseSnapPct: null, fantasyPointsPpr: null },
    ]);

    expect(summary).toMatchObject({
      seasonTargetsPerGame: null,
      seasonCarriesPerGame: null,
      seasonOffenseSnapPct: null,
      confidenceCapReason: 'Usage momentum missing evidence: weekly targets, weekly rush attempts, weekly snap share.',
      missingEvidence: expect.arrayContaining(['weekly targets', 'weekly rush attempts', 'weekly snap share']),
    });
  });
});
