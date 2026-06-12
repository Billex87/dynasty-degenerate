import { describe, expect, it } from 'vitest';
import { buildDepthChartMovers } from './depthChartMovers';
import type { EspnDepthChartEntry } from './espnDepthCharts';

function entry(overrides: Partial<EspnDepthChartEntry>): EspnDepthChartEntry {
  return {
    team: 'sea',
    position: 'WR',
    order: 2,
    playerName: 'Test Receiver',
    espnId: '100',
    groupName: 'Offense',
    ...overrides,
  };
}

function snapshot(snapshotKey: string, entries: EspnDepthChartEntry[]) {
  return {
    schemaVersion: 1 as const,
    generatedAt: `${snapshotKey}T12:00:00.000Z`,
    snapshotKey,
    teams: {
      sea: entries,
    },
  };
}

function player(id: string, overrides: Record<string, unknown> = {}) {
  return {
    full_name: `Player ${id}`,
    team: 'SEA',
    position: 'WR',
    espn_id: id,
    ...overrides,
  };
}

describe('depth chart movers', () => {
  it('returns only report players who moved up or down and caps each side at six', () => {
    const upIds = Array.from({ length: 7 }, (_, index) => `up-${index + 1}`);
    const downIds = Array.from({ length: 7 }, (_, index) => `down-${index + 1}`);
    const playersById = Object.fromEntries([
      ...upIds.map((id) => [id, player(id)]),
      ...downIds.map((id) => [id, player(id)]),
      ['flat', player('flat')],
      ['untracked', player('untracked')],
    ]);
    const playerIds = [...upIds, ...downIds, 'flat'];

    const baselineEntries = [
      ...upIds.map((id, index) => entry({
        espnId: id,
        playerName: `Player ${id}`,
        order: index === 0 ? 4 : 3,
      })),
      ...downIds.map((id) => entry({
        espnId: id,
        playerName: `Player ${id}`,
        order: 1,
      })),
      entry({ espnId: 'flat', playerName: 'Player flat', order: 2 }),
      entry({ espnId: 'untracked', playerName: 'Player untracked', order: 4 }),
    ];
    const currentEntries = [
      ...upIds.map((id) => entry({
        espnId: id,
        playerName: `Player ${id}`,
        order: 1,
      })),
      ...downIds.map((id, index) => entry({
        espnId: id,
        playerName: `Player ${id}`,
        order: index === 0 ? 5 : 3,
      })),
      entry({ espnId: 'flat', playerName: 'Player flat', order: 2 }),
      entry({ espnId: 'untracked', playerName: 'Player untracked', order: 1 }),
    ];

    const result = buildDepthChartMovers({
      currentSnapshot: snapshot('2026-06-12', currentEntries),
      baselineSnapshot: snapshot('2026-06-05', baselineEntries),
      playersById,
      playerIds,
      ownerByPlayerId: { 'up-1': 'Manager A', 'down-1': 'Manager B' },
      currentPositionRankById: { 'up-1': 'WR42' },
    });

    expect(result.currentSnapshotKey).toBe('2026-06-12');
    expect(result.baselineSnapshotKey).toBe('2026-06-05');
    expect(result.up).toHaveLength(6);
    expect(result.down).toHaveLength(6);
    expect(result.up.map((mover) => mover.playerId)).not.toContain('flat');
    expect(result.down.map((mover) => mover.playerId)).not.toContain('flat');
    expect([...result.up, ...result.down].map((mover) => mover.playerId)).not.toContain('untracked');
    expect(result.up[0]).toMatchObject({
      playerId: 'up-1',
      direction: 'up',
      previousRank: 4,
      currentRank: 1,
      owner: 'Manager A',
      currentPositionRank: 'WR42',
    });
    expect(result.down[0]).toMatchObject({
      playerId: 'down-1',
      direction: 'down',
      previousRank: 1,
      currentRank: 5,
      owner: 'Manager B',
    });
  });

  it('treats newly listed starters and removed starters as directional moves', () => {
    const result = buildDepthChartMovers({
      currentSnapshot: snapshot('2026-06-12', [
        entry({ espnId: 'new-starter', playerName: 'New Starter', order: 1 }),
      ]),
      baselineSnapshot: snapshot('2026-06-05', [
        entry({ espnId: 'old-starter', playerName: 'Old Starter', order: 1 }),
      ]),
      playersById: {
        'new-starter': player('new-starter', { full_name: 'New Starter' }),
        'old-starter': player('old-starter', { full_name: 'Old Starter' }),
      },
    });

    expect(result.up).toEqual([
      expect.objectContaining({
        playerId: 'new-starter',
        kind: 'newly-listed',
        direction: 'up',
      }),
    ]);
    expect(result.down).toEqual([
      expect.objectContaining({
        playerId: 'old-starter',
        kind: 'removed',
        direction: 'down',
      }),
    ]);
  });
});
