import { describe, expect, it } from 'vitest';
import { evaluateAIEvidence } from '../shared/aiEvidenceEngine';
import { buildAICounterfactualRead } from '../shared/aiDecisionSnapshots';
import {
  applyAICalibrationAdjustment,
  buildAICalibrationAdjustmentProfile,
  buildAIModuleQualitySummary,
  buildAIOutcomeMemorySummary,
  buildSourceAgreementRead,
  createAIPredictionEvent,
  summarizeAICounterfactualReliability,
  summarizeAIManagerTradeCalibration,
  summarizeAIPredictionReliability,
  summarizeSourceAgreementReliability,
  type AIPredictionEvent,
} from './aiPredictionCalibration';

function event(overrides: Partial<AIPredictionEvent> = {}): AIPredictionEvent {
  const evidenceRead = evaluateAIEvidence({
    surface: overrides.surface || 'waiver',
    action: overrides.action || 'pickup',
    baseScore: overrides.finalScore ?? 80,
    evidence: ['DraftSharks SOS loaded', 'live roster availability confirmed', 'recent usage trend confirmed'],
    sourceTrace: [
      { label: 'DraftSharks SOS', status: 'loaded' },
      { label: 'Sleeper roster ownership', status: 'loaded' },
      { label: 'Usage trend snapshot', status: 'loaded' },
    ],
    player: {
      name: 'Test Player',
      position: 'WR',
      team: 'BUF',
      owner: null,
      value: 5000,
      sourceCount: 3,
      hasRecentUsage: true,
    },
    schedule: { hasScheduleData: true },
    requiresActiveTeam: true,
    requiresLiveAvailability: true,
  });

  return {
    ...createAIPredictionEvent({
      evidenceRead,
      surface: overrides.surface || 'waiver',
      action: overrides.action || 'pickup',
      entityType: 'player',
      entityId: overrides.entityId || 'p1',
      entityName: 'Test Player',
      sourceAgreement: overrides.sourceAgreement,
      createdAt: '2026-05-20T00:00:00.000Z',
    }),
    ...overrides,
    outcome: overrides.outcome || { status: 'pending' },
  };
}

describe('AI prediction calibration', () => {
  it('creates stable prediction events from evidence receipts', () => {
    const created = event({ finalScore: 88, outcome: { status: 'hit' } });

    expect(created).toMatchObject({
      schemaVersion: 1,
      surface: 'waiver',
      action: 'pickup',
      entityType: 'player',
      label: 'high conviction',
      decision: 'do',
      confidenceCap: 100,
      outcome: { status: 'hit' },
    });
    expect(created.eventId).toMatch(/^ai-/);
    expect(created.predictionKey).toContain('waiver:pickup');
    expect(created.evidence.length).toBeGreaterThan(0);
  });

  it('does not persist do decisions when caller-supplied evidence still has gaps', () => {
    const evidenceRead = evaluateAIEvidence({
      surface: 'waiver',
      action: 'pickup',
      baseScore: 86,
      evidence: ['Market signal is loaded.'],
      missingEvidence: ['Verify live roster state before acting.'],
      sourceTrace: [{ label: 'Sleeper roster source', status: 'loaded' }],
      confidenceCap: 68,
      confidenceCapReason: 'Missing live roster proof',
      player: { name: 'Gap Player', position: 'WR', team: 'BUF', value: 5000, sourceCount: 1 },
      requiresActiveTeam: true,
      requiresLiveAvailability: true,
    });

    const created = createAIPredictionEvent({
      evidenceRead,
      decision: 'do',
      surface: 'waiver',
      action: 'pickup',
      entityType: 'player',
      entityId: 'gap-player',
      createdAt: '2026-05-20T00:00:00.000Z',
    });

    expect(created.decision).toBe('watch');
    expect(created.missingEvidence).toContain('Verify live roster state before acting.');
  });

  it('does not persist do decisions when the read fails its decision-time baseline', () => {
    const evidenceRead = evaluateAIEvidence({
      surface: 'waiver',
      action: 'pickup',
      baseScore: 86,
      evidence: ['Live roster availability and market value are loaded.'],
      sourceTrace: [
        { label: 'Sleeper roster source', status: 'loaded' },
        { label: 'Market value source', status: 'loaded' },
      ],
      player: { name: 'Baseline Player', position: 'WR', team: 'BUF', value: 5000, sourceCount: 3 },
      requiresActiveTeam: true,
      requiresLiveAvailability: true,
    });
    const counterfactual = buildAICounterfactualRead({
      aiScore: 76,
      baseline: {
        kind: 'highest-ranked-available',
        label: 'highest-ranked available',
        score: 82,
      },
    });

    const created = createAIPredictionEvent({
      evidenceRead,
      decision: 'do',
      counterfactual,
      surface: 'waiver',
      action: 'pickup',
      entityType: 'player',
      entityId: 'baseline-player',
      createdAt: '2026-05-20T00:00:00.000Z',
    });

    expect(counterfactual.status).toBe('below-baseline');
    expect(created.decision).toBe('watch');
  });

  it('does not persist do decisions when caller-supplied evidence still has blockers', () => {
    const evidenceRead = evaluateAIEvidence({
      surface: 'waiver',
      action: 'pickup',
      baseScore: 82,
      evidence: ['Market signal is loaded.'],
      hardBlockers: ['Player is already rostered.'],
      sourceTrace: [{ label: 'Sleeper roster source', status: 'loaded' }],
      player: {
        name: 'Blocked Player',
        position: 'WR',
        team: 'BUF',
        value: 5000,
        sourceCount: 1,
        owner: 'Rival',
      },
      requiresActiveTeam: true,
      requiresLiveAvailability: true,
    });

    const created = createAIPredictionEvent({
      evidenceRead,
      decision: 'do',
      surface: 'waiver',
      action: 'pickup',
      entityType: 'player',
      entityId: 'blocked-player',
      createdAt: '2026-05-20T00:00:00.000Z',
    });

    expect(created.decision).toBe('blocked');
    expect(created.hardBlockers.join(' ')).toContain('already on Rival');
  });

  it('summarizes hit rate, brier score, and overconfidence by bucket', () => {
    const summary = summarizeAIPredictionReliability([
      event({ entityId: 'p1', finalScore: 90, outcome: { status: 'miss' } }),
      event({ entityId: 'p2', finalScore: 85, outcome: { status: 'miss' } }),
      event({ entityId: 'p3', finalScore: 80, outcome: { status: 'miss' } }),
      event({ entityId: 'p4', finalScore: 75, outcome: { status: 'hit' } }),
      event({ entityId: 'p5', finalScore: 70, outcome: { status: 'hit' } }),
      event({ entityId: 'p6', finalScore: 60, outcome: { status: 'pending' } }),
    ], { groupBy: ['surface', 'action'] });

    expect(summary).toMatchObject({
      eventCount: 6,
      scoredCount: 5,
      pendingCount: 1,
    });
    expect(summary.buckets[0]).toMatchObject({
      key: 'all',
      scoredCount: 5,
      hitCount: 2,
      missCount: 3,
      avgConfidence: 80,
      hitRate: 40,
      calibrationGap: 40,
      recommendedScoreAdjustment: -20,
      recommendation: 'review-model',
    });
  });

  it('caps confidence when approved sources are split or conflicted', () => {
    const split = buildSourceAgreementRead([
      { source: 'DraftSharks SOS', direction: 'for', confidence: 78, status: 'loaded' },
      { source: 'Historical actuals', direction: 'against', confidence: 68, status: 'loaded' },
    ]);
    const aligned = buildSourceAgreementRead([
      { source: 'DraftSharks SOS', direction: 'for', confidence: 78, status: 'loaded' },
      { source: 'Historical actuals', direction: 'for', confidence: 68, status: 'loaded' },
    ]);
    const thin = buildSourceAgreementRead([
      { source: 'DraftSharks SOS', direction: 'for', confidence: 78, status: 'loaded' },
    ]);

    expect(split).toMatchObject({
      state: 'split',
      confidenceCap: 62,
    });
    expect(aligned).toMatchObject({
      state: 'aligned',
      confidenceCap: null,
    });
    expect(thin).toMatchObject({
      state: 'thin',
      confidenceCap: 56,
    });
  });

  it('summarizes reliability by source agreement state', () => {
    const aligned = buildSourceAgreementRead([
      { source: 'DraftSharks SOS', direction: 'for', confidence: 78, status: 'loaded' },
      { source: 'Historical actuals', direction: 'for', confidence: 68, status: 'loaded' },
    ]);
    const split = buildSourceAgreementRead([
      { source: 'DraftSharks SOS', direction: 'for', confidence: 78, status: 'loaded' },
      { source: 'Historical actuals', direction: 'against', confidence: 68, status: 'loaded' },
    ]);

    const summary = summarizeSourceAgreementReliability([
      event({ entityId: 'aligned-1', sourceAgreement: aligned, outcome: { status: 'hit' } }),
      event({ entityId: 'aligned-2', sourceAgreement: aligned, outcome: { status: 'hit' } }),
      event({ entityId: 'split-1', sourceAgreement: split, outcome: { status: 'miss' } }),
    ]);

    expect(summary.buckets.find(bucket => bucket.key === 'sourceAgreement=aligned')).toMatchObject({
      hitCount: 2,
      missCount: 0,
    });
    expect(summary.buckets.find(bucket => bucket.key === 'sourceAgreement=split')).toMatchObject({
      hitCount: 0,
      missCount: 1,
    });
  });

  it('groups old unsafe do decisions by effective decision in summaries', () => {
    const summary = summarizeAIPredictionReliability([
      event({ entityId: 'safe-do', decision: 'do', outcome: { status: 'hit' } }),
      event({
        entityId: 'gap-do',
        decision: 'do',
        confidenceCapReason: 'Missing live roster proof',
        missingEvidence: ['Verify live roster state before acting.'],
        outcome: { status: 'miss' },
      }),
      event({
        entityId: 'blocked-do',
        decision: 'do',
        label: 'blocked',
        hardBlockers: ['Player is already rostered.'],
        outcome: { status: 'blocked' },
      }),
    ], { groupBy: ['decision'] });

    expect(summary.buckets.find(bucket => bucket.key === 'decision=do')).toMatchObject({
      eventCount: 1,
      hitCount: 1,
    });
    expect(summary.buckets.find(bucket => bucket.key === 'decision=watch')).toMatchObject({
      eventCount: 1,
      missCount: 1,
    });
    expect(summary.buckets.find(bucket => bucket.key === 'decision=blocked')).toMatchObject({
      eventCount: 1,
      blockedCount: 1,
    });
  });

  it('treats unavailable source agreement signals as missing proof', () => {
    const read = buildSourceAgreementRead([
      {
        source: 'FantasyPros waiver snapshot',
        direction: 'for',
        confidence: 90,
        status: 'unavailable',
        detail: 'Provider disabled for this environment.',
      },
    ]);

    expect(read).toMatchObject({
      state: 'missing',
      directionalSourceCount: 0,
      sourceCount: 1,
      forWeight: 0,
      againstWeight: 0,
      neutralWeight: 0,
      missingCount: 1,
      confidenceCap: 48,
      reason: 'No source signals were available',
      signals: [{
        direction: 'missing',
        confidence: 90,
        status: 'unavailable',
      }],
    });
  });

  it('splits source agreement when loaded proof is mixed with stale source signals', () => {
    const read = buildSourceAgreementRead([
      {
        source: 'Sleeper availability',
        direction: 'for',
        confidence: 80,
        status: 'loaded',
        detail: 'Availability confirmed.',
      },
      {
        source: 'FantasyPros waiver snapshot',
        direction: 'for',
        confidence: 90,
        status: 'stale',
        detail: '0 rows returned from latest endpoint probe.',
      },
    ]);

    expect(read).toMatchObject({
      state: 'split',
      directionalSourceCount: 1,
      sourceCount: 2,
      forWeight: 80,
      againstWeight: 0,
      neutralWeight: 0,
      missingCount: 1,
      confidenceCap: 62,
      reason: 'Directional source proof is mixed with missing source signals',
      signals: [{
        direction: 'for',
        confidence: 80,
        status: 'loaded',
      }, {
        direction: 'missing',
        confidence: 90,
        status: 'stale',
      }],
    });
  });

  it('summarizes whether AI reads beat decision-time baselines', () => {
    const beats = buildAICounterfactualRead({
      aiScore: 84,
      baseline: {
        kind: 'highest-ranked-available',
        label: 'highest-ranked available',
        score: 70,
      },
    });
    const below = buildAICounterfactualRead({
      aiScore: 54,
      baseline: {
        kind: 'replacement',
        label: 'replacement waiver option',
        score: 62,
      },
    });

    const summary = summarizeAICounterfactualReliability([
      event({ entityId: 'p1', finalScore: 84, counterfactual: beats, outcome: { status: 'hit' } }),
      event({ entityId: 'p2', finalScore: 54, counterfactual: below, outcome: { status: 'miss' } }),
      event({ entityId: 'p3', finalScore: 80, outcome: { status: 'pending' } }),
    ]);

    expect(summary).toMatchObject({
      eventCount: 3,
      baselineCount: 2,
      missingBaselineCount: 1,
      doWithoutBaselineEdgeCount: 1,
      avgEdge: 3,
    });
    expect(summary.buckets.find(bucket => bucket.status === 'beats-baseline')).toMatchObject({
      eventCount: 1,
      hitRate: 100,
    });
    expect(summary.buckets.find(bucket => bucket.status === 'below-baseline')).toMatchObject({
      eventCount: 1,
      hitRate: 0,
    });
  });

  it('does not count old unsafe do decisions as missing-baseline do actions', () => {
    const below = buildAICounterfactualRead({
      aiScore: 54,
      baseline: {
        kind: 'replacement',
        label: 'replacement waiver option',
        score: 62,
      },
    });

    const summary = summarizeAICounterfactualReliability([
      event({
        entityId: 'gap-do',
        decision: 'do',
        confidenceCapReason: 'Missing live roster proof',
        missingEvidence: ['Verify live roster state before acting.'],
        outcome: { status: 'pending' },
      }),
      event({
        entityId: 'below-do',
        decision: 'do',
        counterfactual: below,
        outcome: { status: 'miss' },
      }),
      event({ entityId: 'safe-do', decision: 'do', outcome: { status: 'pending' } }),
    ]);

    expect(summary.missingBaselineCount).toBe(1);
    expect(summary.doWithoutBaselineEdgeCount).toBe(1);
  });

  it('builds actionable calibration adjustments from scored prediction outcomes', () => {
    const profile = buildAICalibrationAdjustmentProfile([
      event({ entityId: 'p1', finalScore: 90, outcome: { status: 'miss' } }),
      event({ entityId: 'p2', finalScore: 88, outcome: { status: 'miss' } }),
      event({ entityId: 'p3', finalScore: 86, outcome: { status: 'miss' } }),
      event({ entityId: 'p4', finalScore: 84, outcome: { status: 'miss' } }),
      event({ entityId: 'p5', finalScore: 82, outcome: { status: 'hit' } }),
      event({ entityId: 'p6', finalScore: 80, outcome: { status: 'pending' } }),
    ]);

    expect(profile.globalAdjustment).toMatchObject({
      scoredCount: 5,
      hitRate: 20,
      recommendation: 'review-model',
      priority: 'danger',
      scoreAdjustment: -20,
    });
    expect(profile.adjustments.some(adjustment =>
      adjustment.scope === 'surfaceAction' &&
      adjustment.group.surface === 'waiver' &&
      adjustment.group.action === 'pickup' &&
      adjustment.scoreAdjustment < 0
    )).toBe(true);
  });

  it('builds exact-league and cohort calibration fallback buckets', () => {
    const events = [
      event({
        entityId: 'league-1',
        leagueId: 'league-a',
        finalScore: 92,
        metadata: { leagueSharpnessTier: 'sharp', managerArchetype: 'Active dealer / Aggressive bidder' },
        outcome: { status: 'miss' },
      }),
      event({
        entityId: 'league-2',
        leagueId: 'league-a',
        finalScore: 88,
        metadata: { leagueSharpnessTier: 'sharp', managerArchetype: 'Active dealer / Aggressive bidder' },
        outcome: { status: 'miss' },
      }),
      event({
        entityId: 'league-3',
        leagueId: 'league-a',
        finalScore: 86,
        metadata: { leagueSharpnessTier: 'sharp', managerArchetype: 'Active dealer / Aggressive bidder' },
        outcome: { status: 'miss' },
      }),
      event({
        entityId: 'league-4',
        leagueId: 'league-a',
        finalScore: 84,
        metadata: { leagueSharpnessTier: 'sharp', managerArchetype: 'Active dealer / Aggressive bidder' },
        outcome: { status: 'miss' },
      }),
      event({
        entityId: 'league-5',
        leagueId: 'league-a',
        finalScore: 82,
        metadata: { leagueSharpnessTier: 'sharp', managerArchetype: 'Active dealer / Aggressive bidder' },
        outcome: { status: 'hit' },
      }),
    ];
    const profile = buildAICalibrationAdjustmentProfile(events);

    expect(profile.adjustments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'surfaceActionLeague',
        group: expect.objectContaining({ surface: 'waiver', action: 'pickup', league: 'league-a' }),
      }),
      expect.objectContaining({
        scope: 'surfaceActionLeagueSharpness',
        group: expect.objectContaining({ surface: 'waiver', action: 'pickup', leagueSharpness: 'sharp' }),
      }),
      expect.objectContaining({
        scope: 'surfaceActionManagerArchetype',
        group: expect.objectContaining({ surface: 'waiver', action: 'pickup', managerArchetype: 'Active dealer / Aggressive bidder' }),
      }),
    ]));
  });

  it('adds sample-size confidence caps before buckets earn high conviction', () => {
    const profile = buildAICalibrationAdjustmentProfile([
      event({ entityId: 'p1', finalScore: 75, outcome: { status: 'hit' } }),
      event({ entityId: 'p2', finalScore: 75, outcome: { status: 'hit' } }),
      event({ entityId: 'p3', finalScore: 75, outcome: { status: 'hit' } }),
    ]);

    expect(profile.globalAdjustment).toMatchObject({
      scoredCount: 3,
      confidenceCap: 56,
      recommendation: 'collect-more-samples',
    });
  });

  it('summarizes manager-specific trade calibration', () => {
    const tradeHit = event({
      surface: 'trade',
      action: 'trade',
      entityId: 'deal-1',
      entityName: 'Counter Manager',
      outcome: {
        status: 'hit',
        realizedEdge: {
          status: 'beat-baseline',
          predictedEdge: 12,
          actualValue: 22,
          baselineValue: 0,
          realizedEdge: 22,
          baselineKind: 'manager-default',
          source: 'trade:Counter Manager',
          note: 'Trade beat hold.',
        },
      },
    });
    const tradeMiss = event({
      surface: 'trade',
      action: 'trade',
      entityId: 'deal-2',
      entityName: 'Counter Manager',
      outcome: {
        status: 'miss',
        realizedEdge: {
          status: 'trailed-baseline',
          predictedEdge: 8,
          actualValue: -4,
          baselineValue: 0,
          realizedEdge: -4,
          baselineKind: 'manager-default',
          source: 'trade:Counter Manager',
          note: 'Trade missed hold.',
        },
      },
    });

    const summary = summarizeAIManagerTradeCalibration([tradeHit, tradeMiss]);

    expect(summary.rows[0]).toMatchObject({
      manager: 'Counter Manager',
      eventCount: 2,
      scoredCount: 2,
      completedCount: 1,
      missCount: 1,
      acceptanceRate: 50,
      avgRealizedEdge: 9,
      recommendation: 'collect-more-samples',
    });
  });

  it('summarizes module quality for admin accuracy calibration', () => {
    const summary = buildAIModuleQualitySummary([
      event({
        entityId: 'waiver-1',
        surface: 'waiver',
        action: 'pickup',
        outcome: { status: 'hit' },
        metadata: { source: 'waiver-intelligence', targetScore: 82, trendAdds: 42, faabBand: 'standard' },
      }),
      event({
        entityId: 'waiver-2',
        surface: 'waiver',
        action: 'pickup',
        outcome: { status: 'miss' },
        metadata: { source: 'waiver-intelligence', targetScore: 76, trendAdds: 18, faabBand: 'light' },
      }),
      event({
        entityId: 'trade-1',
        surface: 'trade',
        action: 'trade',
        outcome: { status: 'pending' },
      }),
      event({
        entityId: 'role-1',
        surface: 'player-detail',
        action: 'watch',
        outcome: { status: 'pending' },
        sourceTrace: [{ label: 'Depth chart role', status: 'loaded', detail: 'Starter role check.' }],
      }),
    ]);

    expect(summary.rows.map(row => row.key)).toEqual([
      'waiver-bid-range',
      'waiver-competition',
      'trade-resistance',
      'depth-chart-role-confidence',
    ]);
    expect(summary.rows.find(row => row.key === 'waiver-competition')).toMatchObject({
      scoredCount: 2,
      hitRate: 50,
    });
    expect(summary.rows.find(row => row.key === 'trade-resistance')?.nextDataNeeded).toMatch(/accepted/i);
  });

  it('builds outcome memory ledgers, confidence buckets, and sharpness calibration', () => {
    const hit = event({
      entityId: 'p1',
      finalScore: 84,
      label: 'priority',
      outcome: {
        status: 'hit',
        feedbackSource: 'system',
        observedOutcome: {
          status: 'observed_completed',
          observedAt: '2026-09-02T00:00:00.000Z',
          confidence: 92,
          evidence: {
            reason: 'Recommended player was added to roster',
            playerId: 'p1',
            before: 'not_on_roster',
            after: 'on_roster',
            detectedFrom: 'transaction_history',
          },
        },
      },
      metadata: {
        source: 'waiver',
        leagueSharpnessTier: 'sharp',
        leagueSharpnessLabel: 'Sharp league',
        leagueSharpnessScore: 78,
      },
    });
    const miss = event({
      entityId: 'p2',
      surface: 'trade',
      action: 'trade',
      finalScore: 72,
      label: 'priority',
      outcome: { status: 'miss', feedbackSource: 'admin' },
      metadata: {
        source: 'trade',
        leagueSharpnessTier: 'sleepy',
        leagueSharpnessLabel: 'Sleepy league',
        leagueSharpnessScore: 28,
      },
    });
    const pending = event({
      entityId: 'p3',
      surface: 'player-detail',
      action: 'watch',
      finalScore: 55,
      outcome: { status: 'pending' },
    });
    const unsafeLegacyDo = event({
      entityId: 'legacy-gap',
      decision: 'do',
      confidenceCapReason: 'Missing live roster proof',
      missingEvidence: ['Verify live roster state before acting.'],
      outcome: { status: 'pending' },
    });

    const memory = buildAIOutcomeMemorySummary([hit, miss, pending, unsafeLegacyDo]);

    expect(memory).toMatchObject({
      schemaVersion: 1,
      eventCount: 4,
      scoredCount: 2,
      pendingCount: 2,
    });
    expect(memory.ledger[0]).toMatchObject({
      module: 'Waiver AI',
      verdict: 'worked',
      sharpnessLabel: 'Sharp league',
      sharpnessScore: 78,
      observedOutcomeStatus: 'observed_completed',
      observedOutcomeConfidence: 92,
      observedOutcomeDetectedFrom: 'transaction_history',
      observedOutcomeReason: 'Recommended player was added to roster',
    });
    expect(memory.ledger[0].evidencePreview[0]).toContain('Observed completed · 92% · transaction history');
    expect(memory.confidenceBuckets.find(bucket => bucket.group.label === 'priority')).toMatchObject({
      scoredCount: 2,
      hitRate: 50,
    });
    expect(memory.sharpnessBuckets.map(bucket => bucket.group.leagueSharpness)).toEqual(
      expect.arrayContaining(['sharp', 'sleepy'])
    );
    expect(memory.moduleScorecards.some(bucket => bucket.group.surface === 'trade')).toBe(true);
    expect(memory.ledger.find(row => row.eventId === unsafeLegacyDo.eventId)).toMatchObject({
      decision: 'watch',
      missingEvidence: ['Verify live roster state before acting.'],
    });
  });

  it('applies the most specific calibration adjustment to future reads', () => {
    const profile = buildAICalibrationAdjustmentProfile([
      event({ entityId: 'p1', finalScore: 90, outcome: { status: 'miss' } }),
      event({ entityId: 'p2', finalScore: 88, outcome: { status: 'miss' } }),
      event({ entityId: 'p3', finalScore: 86, outcome: { status: 'miss' } }),
      event({ entityId: 'p4', finalScore: 84, outcome: { status: 'miss' } }),
      event({ entityId: 'p5', finalScore: 82, outcome: { status: 'hit' } }),
    ]);

    const adjusted = applyAICalibrationAdjustment({
      profile,
      surface: 'waiver',
      action: 'pickup',
      label: 'high conviction',
      sourceAgreementState: 'unknown',
      leagueId: 'league-a',
      leagueSharpnessTier: 'sharp',
      finalScore: 90,
      confidenceCap: 100,
    });

    expect(adjusted.appliedAdjustment?.scoreAdjustment).toBeLessThan(0);
    expect(adjusted.finalScore).toBeLessThan(90);
    expect(adjusted.confidenceCap).toBeLessThanOrEqual(76);
  });
});
