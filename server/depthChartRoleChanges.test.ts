import { describe, expect, it } from 'vitest';
import { buildDepthChartRoleChangeSignals, type DepthChartRoleSnapshotRow } from './depthChartRoleChanges';

function row(overrides: Partial<DepthChartRoleSnapshotRow>): DepthChartRoleSnapshotRow {
  return {
    gsisId: '00-player',
    name: 'Test Receiver',
    team: 'SEA',
    position: 'WR',
    rank: 2,
    slot: 'WR2',
    week: 1,
    source: 'nflverse depth chart snapshot',
    sourceReliable: true,
    ...overrides,
  };
}

describe('depth chart role changes', () => {
  it('detects source-backed promotions into a starter slot', () => {
    const signals = buildDepthChartRoleChangeSignals({
      previousRows: [row({ rank: 3, slot: 'WR3', week: 1 })],
      currentRows: [row({ rank: 1, slot: 'WR1', week: 2 })],
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      playerName: 'Test Receiver',
      team: 'SEA',
      position: 'WR',
      kind: 'promoted-to-starter',
      direction: 'boost',
      previousRank: 3,
      currentRank: 1,
      previousWeek: 1,
      currentWeek: 2,
      confidenceCapReason: null,
      missingEvidence: [],
    });
    expect(signals[0].confidence).toBeGreaterThanOrEqual(80);
    expect(signals[0].note).toContain('WR3 rank 3 to WR1 rank 1');
  });

  it('detects demotions out of a starter slot as risk signals', () => {
    const signals = buildDepthChartRoleChangeSignals({
      previousRows: [row({ rank: 1, slot: 'RB1', position: 'RB' })],
      currentRows: [row({ rank: 3, slot: 'RB3', position: 'RB' })],
    });

    expect(signals[0]).toMatchObject({
      kind: 'demoted-from-starter',
      direction: 'risk',
      previousRank: 1,
      currentRank: 3,
    });
  });

  it('caps confidence when reliable source approval is missing', () => {
    const signals = buildDepthChartRoleChangeSignals({
      previousRows: [row({ rank: 3, slot: 'TE3', position: 'TE', sourceReliable: false })],
      currentRows: [row({ rank: 1, slot: 'TE1', position: 'TE', sourceReliable: false })],
    });

    expect(signals[0]).toMatchObject({
      kind: 'promoted-to-starter',
      confidenceCapReason: 'Reliable depth-chart source approval is missing.',
      missingEvidence: expect.arrayContaining(['reliable depth-chart source approval']),
    });
    expect(signals[0].confidence).toBeLessThanOrEqual(58);
  });

  it('tracks newly listed and removed depth-chart rows without pretending both sides exist', () => {
    const signals = buildDepthChartRoleChangeSignals({
      previousRows: [row({ gsisId: '00-old', name: 'Old Starter', rank: 1, slot: 'RB1', position: 'RB' })],
      currentRows: [row({ gsisId: '00-new', name: 'New Starter', rank: 1, slot: 'RB1', position: 'RB' })],
    });

    expect(signals.map((signal) => signal.kind).sort()).toEqual(['newly-listed', 'removed']);
    expect(signals.find((signal) => signal.kind === 'newly-listed')).toMatchObject({
      playerName: 'New Starter',
      direction: 'boost',
      missingEvidence: expect.arrayContaining(['previous depth-chart row']),
    });
    expect(signals.find((signal) => signal.kind === 'removed')).toMatchObject({
      playerName: 'Old Starter',
      direction: 'risk',
      missingEvidence: expect.arrayContaining(['current depth-chart row']),
    });
  });
});
