import { describe, expect, it } from 'vitest';
import type { AIPredictionEvent } from './aiPredictionCalibration';
import { resolveAIPredictionOutcome } from './aiPredictionOutcomeResolver';

function event(overrides: Partial<AIPredictionEvent> = {}): AIPredictionEvent {
  return {
    schemaVersion: 1,
    eventId: 'event-1',
    predictionKey: 'waiver:pickup:league:manager:player:p1:2026:1',
    createdAt: '2026-09-01T00:00:00.000Z',
    surface: 'waiver',
    action: 'pickup',
    decision: 'do',
    entityType: 'player',
    entityId: 'p1',
    entityName: 'Waiver Receiver',
    leagueId: '13000000000000',
    manager: 'Sample Manager',
    season: '2026',
    week: 1,
    label: 'priority',
    finalScore: 78,
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

describe('AI prediction outcome resolver', () => {
  it('marks waiver pickup reads as hits when the target manager added the player', () => {
    const resolved = resolveAIPredictionOutcome(event(), {
      resolvedAt: '2026-09-02T00:00:00.000Z',
      transactions: [
        { type: 'add', playerId: 'p1', playerName: 'Waiver Receiver', manager: 'Sample Manager' },
      ],
      playerStats: [
        { playerId: 'p1', playerName: 'Waiver Receiver', fantasyPoints: 14, baselineFantasyPoints: 8 },
      ],
    });

    expect(resolved).toMatchObject({
      status: 'hit',
      resolvedAt: '2026-09-02T00:00:00.000Z',
      actualValue: 14,
      baselineValue: 8,
      realizedEdge: {
        status: 'beat-baseline',
        realizedEdge: 6,
      },
    });
  });

  it('waits to grade waiver pickups until production is available', () => {
    const resolved = resolveAIPredictionOutcome(event(), {
      transactions: [
        { type: 'add', playerId: 'p1', playerName: 'Waiver Receiver', manager: 'Sample Manager' },
      ],
      playerStats: [],
    });

    expect(resolved).toMatchObject({
      status: 'pending',
      note: 'Recommended player was added by Sample Manager; waiting for production to grade realized edge.',
    });
  });

  it('grades FAAB ranges from Sleeper winning bid amounts before production lands', () => {
    const resolved = resolveAIPredictionOutcome(event({
      metadata: { faabMin: 7, faabMax: 11 },
    }), {
      resolvedAt: '2026-09-02T00:00:00.000Z',
      transactions: [
        {
          type: 'add',
          playerId: 'p1',
          playerName: 'Waiver Receiver',
          manager: 'Sample Manager',
          bidAmount: 18,
          waiverBudget: 200,
        },
      ],
      playerStats: [],
    });

    expect(resolved).toMatchObject({
      status: 'hit',
      actualValue: 9,
      baselineValue: 9,
      realizedEdge: {
        source: 'waiver:winning-bid',
        status: 'matched-baseline',
      },
    });
    expect(resolved.note).toContain('Sleeper winning bid was 18 FAAB');
  });

  it('marks waiver pickup reads as misses when another manager beat the user to the add', () => {
    const resolved = resolveAIPredictionOutcome(event(), {
      transactions: [
        { type: 'add', playerId: 'p1', playerName: 'Waiver Receiver', manager: 'Rival Manager' },
      ],
    });

    expect(resolved.status).toBe('miss');
  });

  it('scores start and stream reads against actual fantasy points', () => {
    const resolved = resolveAIPredictionOutcome(event({
      surface: 'schedule',
      action: 'stream',
      entityType: 'schedule',
      entityId: 'def-ne',
      entityName: 'New England Patriots',
      finalScore: 70,
    }), {
      playerStats: [
        { playerId: 'def-ne', playerName: 'New England Patriots', fantasyPoints: 12, projectedFantasyPoints: 8 },
      ],
    });

    expect(resolved).toMatchObject({
      status: 'hit',
      actualValue: 12,
      baselineValue: 8,
      realizedEdge: {
        status: 'beat-baseline',
        realizedEdge: 4,
      },
    });
  });

  it('expires stale unresolved reads as push outcomes', () => {
    const resolved = resolveAIPredictionOutcome(event({
      expiresAt: '2026-09-01T01:00:00.000Z',
    }), {
      resolvedAt: '2026-09-02T00:00:00.000Z',
      transactions: [],
      playerStats: [],
    });

    expect(resolved).toMatchObject({
      status: 'push',
      realizedEdge: {
        status: 'expired',
      },
    });
  });

  it('matches team defense stream reads against Sleeper defense shorthand ids', () => {
    const resolved = resolveAIPredictionOutcome(event({
      surface: 'schedule',
      action: 'stream',
      entityType: 'schedule',
      entityId: 'def-ne',
      entityName: 'New England Patriots',
    }), {
      playerStats: [
        { playerId: 'NE', fantasyPoints: 11, projectedFantasyPoints: 8 },
      ],
    });

    expect(resolved.status).toBe('hit');
  });

  it('matches manager team names against Sleeper display-name labels', () => {
    const resolved = resolveAIPredictionOutcome(event({
      manager: 'The Sample Squad',
    }), {
      transactions: [
        { type: 'add', playerId: 'p1', manager: 'The Sample Squad / Sample Manager' },
      ],
      playerStats: [
        { playerId: 'p1', fantasyPoints: 10, baselineFantasyPoints: 8 },
      ],
    });

    expect(resolved.status).toBe('hit');
  });

  it('keeps unresolved events pending when no outcome fact matches', () => {
    const resolved = resolveAIPredictionOutcome(event(), {
      transactions: [],
      playerStats: [],
    });

    expect(resolved).toMatchObject({
      status: 'pending',
      note: 'No matching outcome fact was available yet.',
    });
  });
});
