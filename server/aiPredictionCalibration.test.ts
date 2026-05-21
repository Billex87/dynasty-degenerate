import { describe, expect, it } from 'vitest';
import { evaluateAIEvidence } from '../shared/aiEvidenceEngine';
import { buildAICounterfactualRead } from '../shared/aiDecisionSnapshots';
import {
  applyAICalibrationAdjustment,
  buildAICalibrationAdjustmentProfile,
  buildAIModuleQualitySummary,
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
    evidence: ['DraftSharks SOS loaded', 'live roster availability confirmed'],
    sourceTrace: [{ label: 'DraftSharks SOS', status: 'loaded' }],
    player: { name: 'Test Player', position: 'WR', team: 'BUF', value: 5000, sourceCount: 3 },
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
      doWithoutBaselineEdgeCount: 2,
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
      finalScore: 90,
      confidenceCap: 100,
    });

    expect(adjusted.appliedAdjustment?.scoreAdjustment).toBeLessThan(0);
    expect(adjusted.finalScore).toBeLessThan(90);
    expect(adjusted.confidenceCap).toBeLessThanOrEqual(76);
  });
});
