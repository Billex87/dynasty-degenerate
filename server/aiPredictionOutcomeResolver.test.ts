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

  it('stores observed completed outcomes for structured add recommendations without waiting for production', () => {
    const resolved = resolveAIPredictionOutcome(event({
      metadata: {
        expectedAction: {
          type: 'waiver_add',
          playerIn: { id: 'p1', name: 'Waiver Receiver' },
        },
      },
    }), {
      resolvedAt: '2026-09-02T00:00:00.000Z',
      transactions: [
        { type: 'add', playerId: 'p1', playerName: 'Waiver Receiver', manager: 'Sample Manager' },
      ],
      playerStats: [],
    });

    expect(resolved).toMatchObject({
      status: 'hit',
      note: 'Recommended player was added to roster',
      observedOutcome: {
        status: 'observed_completed',
        confidence: 92,
        evidence: {
          detectedFrom: 'transaction_history',
        },
      },
    });
  });

  it('stores observed ignored outcomes when a structured lineup swap expires untouched', () => {
    const resolved = resolveAIPredictionOutcome(event({
      surface: 'autopilot',
      action: 'start',
      entityType: 'lineup',
      entityId: 'player-a',
      entityName: 'Player A',
      expiresAt: '2026-09-03T00:00:00.000Z',
      metadata: {
        expectedAction: {
          type: 'swap_starter',
          playerIn: { id: 'player-a', name: 'Player A' },
          playerOut: { id: 'player-b', name: 'Player B' },
        },
      },
    }), {
      resolvedAt: '2026-09-04T00:00:00.000Z',
      rosterStates: [
        {
          manager: 'Sample Manager',
          rosterPlayerIds: ['player-a', 'player-b'],
          starterPlayerIds: ['player-b'],
        },
      ],
    });

    expect(resolved).toMatchObject({
      status: 'miss',
      observedOutcome: {
        status: 'observed_ignored',
        evidence: {
          after: 'original_starter_kept',
        },
      },
    });
  });

  it('stores neutral unknown observed outcomes when only the current roster state matches', () => {
    const resolved = resolveAIPredictionOutcome(event({
      metadata: {
        expectedAction: {
          type: 'add_player',
          playerIn: { id: 'p1', name: 'Waiver Receiver' },
        },
      },
    }), {
      resolvedAt: '2026-09-02T00:00:00.000Z',
      rosterStates: [
        {
          manager: 'Sample Manager',
          rosterPlayerIds: ['p1'],
          starterPlayerIds: [],
        },
      ],
    });

    expect(resolved).toMatchObject({
      status: 'push',
      actualValue: null,
      baselineValue: null,
      observedOutcome: {
        status: 'unknown',
        confidence: 40,
        evidence: {
          reason: 'Recommended player is on the current roster, but the prior roster snapshot was incomplete',
        },
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

  it('grades ignored start reads against the player result', () => {
    const resolved = resolveAIPredictionOutcome(event({
      surface: 'player-detail',
      action: 'start',
      entityId: 'p1',
      entityName: 'Waiver Receiver',
      finalScore: 76,
      metadata: { archetypeKey: 'volume-spike' },
    }), {
      playerStats: [
        { playerId: 'p1', fantasyPoints: 18, baselineFantasyPoints: 10, started: false },
      ],
    });

    expect(resolved).toMatchObject({
      status: 'hit',
      actualValue: 18,
      baselineValue: 10,
    });
    expect(resolved.note).toContain('not started');
  });

  it('grades player-detail avoid archetypes from production', () => {
    const resolved = resolveAIPredictionOutcome(event({
      surface: 'player-detail',
      action: 'avoid',
      decision: 'dont',
      entityId: 'p1',
      entityName: 'Waiver Receiver',
      metadata: { archetypeKey: 'market-trap', archetypeLabel: 'Market trap' },
    }), {
      playerStats: [
        { playerId: 'p1', fantasyPoints: 4, baselineFantasyPoints: 9, started: true },
      ],
    });

    expect(resolved).toMatchObject({
      status: 'hit',
      actualValue: 4,
      baselineValue: 9,
      realizedEdge: {
        source: 'lineup:player-stats',
        status: 'beat-baseline',
      },
    });
  });

  it('grades buy-low style reads from post-call value movement', () => {
    const resolved = resolveAIPredictionOutcome(event({
      surface: 'player-detail',
      action: 'watch',
      decision: 'do',
      entityId: 'p1',
      entityName: 'Waiver Receiver',
      metadata: { archetypeKey: 'post-hype-breakout', actionText: 'Buy low before the value moves' },
    }), {
      valueMovements: [{
        playerId: 'p1',
        playerName: 'Waiver Receiver',
        baselineDate: '2026-09-01',
        followUpDate: '2026-09-10',
        baselineValue: 1000,
        followUpValue: 1225,
        valueDelta: 225,
        valueDeltaPct: 22.5,
        source: 'stored-value-snapshots',
      }],
    });

    expect(resolved).toMatchObject({
      status: 'hit',
      actualValue: 1225,
      baselineValue: 1000,
      realizedEdge: {
        source: 'stored-value-snapshots',
        status: 'beat-baseline',
      },
    });
  });

  it('grades sell-high and do-not-chase reads from post-call value drops', () => {
    const resolved = resolveAIPredictionOutcome(event({
      surface: 'player-detail',
      action: 'avoid',
      decision: 'dont',
      entityId: 'p1',
      entityName: 'Waiver Receiver',
      metadata: { archetypeKey: 'market-trap', actionText: 'Do not chase this market trap' },
    }), {
      valueMovements: [{
        playerId: 'p1',
        playerName: 'Waiver Receiver',
        baselineDate: '2026-09-01',
        followUpDate: '2026-09-10',
        baselineValue: 1200,
        followUpValue: 980,
        valueDelta: -220,
        valueDeltaPct: -18.3,
        source: 'stored-value-snapshots',
      }],
    });

    expect(resolved).toMatchObject({
      status: 'hit',
      actualValue: 980,
      baselineValue: 1200,
      realizedEdge: {
        source: 'stored-value-snapshots',
        status: 'beat-baseline',
      },
    });
  });

  it('keeps value movement reads pending until the move is meaningful or expired', () => {
    const resolved = resolveAIPredictionOutcome(event({
      surface: 'player-detail',
      action: 'watch',
      decision: 'do',
      entityId: 'p1',
      entityName: 'Waiver Receiver',
      metadata: { actionText: 'Buy low' },
    }), {
      resolvedAt: '2026-09-05T00:00:00.000Z',
      valueMovements: [{
        playerId: 'p1',
        baselineDate: '2026-09-01',
        followUpDate: '2026-09-04',
        baselineValue: 1000,
        followUpValue: 1030,
        valueDelta: 30,
      }],
    });

    expect(resolved).toMatchObject({
      status: 'pending',
      note: 'Value movement for Waiver Receiver is not meaningful yet (+30).',
    });
  });

  it('pushes expired value movement reads when the move stayed too small', () => {
    const resolved = resolveAIPredictionOutcome(event({
      surface: 'player-detail',
      action: 'watch',
      decision: 'do',
      entityId: 'p1',
      entityName: 'Waiver Receiver',
      expiresAt: '2026-09-04T00:00:00.000Z',
      metadata: { actionText: 'Buy low' },
    }), {
      resolvedAt: '2026-09-05T00:00:00.000Z',
      valueMovements: [{
        playerId: 'p1',
        baselineDate: '2026-09-01',
        followUpDate: '2026-09-04',
        baselineValue: 1000,
        followUpValue: 1030,
        valueDelta: 30,
      }],
    });

    expect(resolved).toMatchObject({
      status: 'push',
      realizedEdge: {
        status: 'matched-baseline',
      },
    });
  });

  it('marks hold and do-not-chase reads as hits when no action happened before expiry', () => {
    const resolved = resolveAIPredictionOutcome(event({
      action: 'hold',
      decision: 'hold',
      expiresAt: '2026-09-01T01:00:00.000Z',
    }), {
      resolvedAt: '2026-09-02T00:00:00.000Z',
      transactions: [],
      playerStats: [],
    });

    expect(resolved).toMatchObject({
      status: 'hit',
      realizedEdge: {
        source: 'no-action:expiration',
        status: 'action-only',
      },
    });
  });

  it('waits to grade no-action reads when the manager acted but production is missing', () => {
    const resolved = resolveAIPredictionOutcome(event({
      action: 'avoid',
      decision: 'dont',
      metadata: { actionText: 'Do not chase this player' },
    }), {
      transactions: [
        { type: 'add', playerId: 'p1', manager: 'Sample Manager' },
      ],
      playerStats: [],
    });

    expect(resolved).toMatchObject({
      status: 'pending',
      note: 'A related add happened after the no-action read; waiting for production or value evidence before grading it.',
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
