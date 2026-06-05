import { describe, expect, it } from 'vitest';
import type { AIPredictionEvent } from './aiPredictionCalibration';
import {
  buildLeagueWidePredictionBacktest,
  classifyAIPredictionBacktestModule,
} from './aiPredictionLeagueBacktest';

function event(overrides: Partial<AIPredictionEvent> = {}): AIPredictionEvent {
  return {
    schemaVersion: 1,
    eventId: overrides.eventId || `event-${overrides.entityId || 'p1'}`,
    predictionKey: 'waiver:pickup:league-a:manager:player:p1:2026:1',
    createdAt: '2026-09-01T00:00:00.000Z',
    surface: 'waiver',
    action: 'pickup',
    decision: 'do',
    entityType: 'player',
    entityId: 'p1',
    entityName: 'Waiver Receiver',
    leagueId: 'league-a',
    manager: 'Sample Manager',
    season: '2026',
    week: 1,
    label: 'priority',
    finalScore: 80,
    confidenceCap: 100,
    evidence: ['available'],
    missingEvidence: [],
    hardBlockers: [],
    softPenalties: [],
    sourceTrace: [{ label: 'Sleeper transactions', status: 'loaded' }],
    sourceAgreement: null,
    whyThisFired: 'Waiver read fired.',
    outcome: { status: 'pending' },
    ...overrides,
  };
}

function hit(index: number, overrides: Partial<AIPredictionEvent> = {}): AIPredictionEvent {
  return event({
    eventId: `hit-${index}`,
    entityId: `hit-${index}`,
    finalScore: 80 + (index % 10),
    outcome: {
      status: 'hit',
      realizedEdge: {
        status: 'beat-baseline',
        predictedEdge: 8,
        actualValue: 18,
        baselineValue: 10,
        realizedEdge: 8,
        baselineKind: 'replacement',
        source: 'test',
        note: 'Beat baseline.',
      },
    },
    ...overrides,
  });
}

function miss(index: number, overrides: Partial<AIPredictionEvent> = {}): AIPredictionEvent {
  return event({
    eventId: `miss-${index}`,
    entityId: `miss-${index}`,
    finalScore: 72,
    outcome: {
      status: 'miss',
      realizedEdge: {
        status: 'trailed-baseline',
        predictedEdge: 8,
        actualValue: 6,
        baselineValue: 10,
        realizedEdge: -4,
        baselineKind: 'replacement',
        source: 'test',
        note: 'Trailed baseline.',
      },
    },
    ...overrides,
  });
}

describe('AI prediction league backtest', () => {
  it('classifies prediction events into model backtest modules', () => {
    expect(classifyAIPredictionBacktestModule(event({
      metadata: { actionText: 'FAAB 8-12% bid range' },
    }))).toBe('faab-patterns');
    expect(classifyAIPredictionBacktestModule(event({
      surface: 'trade',
      action: 'trade',
      metadata: { actionText: 'Offer a trade' },
    }))).toBe('trade-activity');
    expect(classifyAIPredictionBacktestModule(event({
      surface: 'autopilot',
      action: 'start',
      metadata: { actionText: 'Start this player' },
    }))).toBe('start-sit-decisions');
    expect(classifyAIPredictionBacktestModule(event({
      surface: 'rankings',
      action: 'watch',
      metadata: { actionText: 'Dynasty rookie draft pick value' },
    }))).toBe('draft-paths');
    expect(classifyAIPredictionBacktestModule(event({
      action: 'stash',
      metadata: { actionText: 'Prospect stash' },
    }))).toBe('prospect-stashes');
    expect(classifyAIPredictionBacktestModule(event({
      surface: 'overview',
      action: 'watch',
      metadata: { actionText: 'Roster construction for playoff standings' },
    }))).toBe('roster-construction');
  });

  it('marks buckets raise-eligible only when scored outcomes beat simple baselines', () => {
    const events = Array.from({ length: 9 }, (_, index) => hit(index, {
      metadata: { actionText: 'FAAB bid range' },
    })).concat(
      miss(1, { metadata: { actionText: 'FAAB bid range' } }),
      event({
        eventId: 'pending',
        entityId: 'pending',
        metadata: { actionText: 'FAAB bid range' },
      }),
    );

    const summary = buildLeagueWidePredictionBacktest(events);
    const faab = summary.rows.find(row => row.key === 'module:faab-patterns');

    expect(summary).toMatchObject({
      eventCount: 11,
      scoredCount: 10,
      pendingCount: 1,
    });
    expect(faab).toMatchObject({
      eventCount: 11,
      scoredCount: 10,
      hitCount: 9,
      missCount: 1,
      modelHitRate: 90,
      baselineComparisonCount: 10,
      modelBeatBaselineCount: 9,
      baselineBeatModelCount: 1,
      confidenceAction: 'eligible-to-raise',
    });
  });

  it('holds confidence when the model has samples but not baseline edge', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, index) => hit(index, {
        outcome: {
          status: 'hit',
          realizedEdge: {
            status: 'matched-baseline',
            predictedEdge: 3,
            actualValue: 10,
            baselineValue: 10,
            realizedEdge: 0,
            baselineKind: 'market-default',
            source: 'test',
            note: 'Matched baseline.',
          },
        },
      })),
      ...Array.from({ length: 4 }, (_, index) => miss(index, {
        outcome: {
          status: 'miss',
          realizedEdge: {
            status: 'matched-baseline',
            predictedEdge: 3,
            actualValue: 10,
            baselineValue: 10,
            realizedEdge: 0,
            baselineKind: 'market-default',
            source: 'test',
            note: 'Matched baseline.',
          },
        },
      })),
    ];

    const summary = buildLeagueWidePredictionBacktest(events);
    const waiver = summary.rows.find(row => row.key === 'module:waiver-volume');

    expect(waiver).toMatchObject({
      scoredCount: 10,
      modelHitRate: 60,
      matchedBaselineCount: 10,
      confidenceAction: 'hold-no-baseline-edge',
    });
  });
});
