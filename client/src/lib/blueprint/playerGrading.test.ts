import { describe, expect, it } from 'vitest';
import type { ManagerIntelPlayer } from '@shared/types';
import { gradePlayer, gradeRoster } from '@shared/blueprint/playerGrading';

function makePlayer(overrides: Partial<ManagerIntelPlayer> & { player_id: string; pos: string }): ManagerIntelPlayer {
  return {
    name: overrides.name || `Player ${overrides.player_id}`,
    value: overrides.value ?? 5000,
    ...overrides,
  } as ManagerIntelPlayer;
}

describe('gradePlayer', () => {
  it('grades a young, productive, secure WR as a top archetype', () => {
    const player = makePlayer({
      player_id: 'wr-elite',
      pos: 'WR',
      currentPositionRank: 'WR2',
      seasonPositionRank: 'WR3',
      lastSeasonPointsPerGame: 18,
      lastSeasonGames: 17,
      playerDetails: {
        age: 24,
        isStarter: true,
        injuryStatus: 'Active',
        sleeperStartedPct: 96,
        depthChartOrder: 1,
        schedule: { seasonSOS: 0.4 },
        valueTimeline: { profileKey: 'k', source: 'stored-value-snapshots', windows: { '3m': { key: '3m', label: '3m', days: 90, pointCount: 3, startDate: '', endDate: '', startValue: 4000, endValue: 5000, delta: 1000, deltaPct: 12 } } },
      },
    });

    const grade = gradePlayer(player, 'dynasty');
    expect(grade).not.toBeNull();
    expect(grade!.composite).toBeGreaterThanOrEqual(7.3);
    expect(['Foundational', 'Cornerstone']).toContain(grade!.archetype);
    expect(grade!.thinFactors).toHaveLength(0);
  });

  it('grades an aging, declining RB lower than its raw value would suggest', () => {
    const player = makePlayer({
      player_id: 'rb-old',
      pos: 'RB',
      value: 6000,
      currentPositionRank: 'RB28',
      seasonPositionRank: 'RB35',
      lastSeasonPointsPerGame: 8,
      lastSeasonGames: 11,
      playerDetails: {
        age: 30,
        injuryStatus: 'Questionable',
        depthChartOrder: 2,
        sleeperStartedPct: 40,
        schedule: { seasonSOS: 0.7 },
      },
    });

    const grade = gradePlayer(player, 'dynasty')!;
    expect(grade.composite).toBeLessThan(5);
    expect(grade.insulation).toBeLessThan(5);
    expect(['JAG-Insurance', 'Serviceable']).toContain(grade.archetype);
  });

  it('flags thin factors and falls back to neutral instead of inventing a grade', () => {
    const player = makePlayer({ player_id: 'wr-bare', pos: 'WR' });
    const grade = gradePlayer(player, 'dynasty')!;
    expect(grade.thinFactors).toEqual(['insulation', 'production', 'situational']);
    expect(grade.composite).toBe(5);
  });

  it('classifies a young, high-upside but unproven player as an Upside Shot', () => {
    const player = makePlayer({
      player_id: 'wr-young',
      pos: 'WR',
      lastSeasonPointsPerGame: 7,
      lastSeasonGames: 8,
      currentPositionRank: 'WR55',
      playerDetails: {
        age: 22,
        isStarter: false,
        depthChartOrder: 2,
        schedule: { seasonSOS: 0.3 },
        valueTimeline: { profileKey: 'k', source: 'stored-value-snapshots', windows: { '3m': { key: '3m', label: '3m', days: 90, pointCount: 3, startDate: '', endDate: '', startValue: 1000, endValue: 1600, delta: 600, deltaPct: 30 } } },
      },
    });
    const grade = gradePlayer(player, 'dynasty')!;
    expect(grade.archetype).toBe('Upside Shot');
  });

  it('returns null for non-graded positions', () => {
    expect(gradePlayer(makePlayer({ player_id: 'k1', pos: 'K' }), 'dynasty')).toBeNull();
    expect(gradePlayer(makePlayer({ player_id: 'def1', pos: 'DEF' }), 'dynasty')).toBeNull();
  });

  it('weights production higher in redraft than dynasty', () => {
    const producer = makePlayer({
      player_id: 'rb-producer',
      pos: 'RB',
      lastSeasonPointsPerGame: 19,
      lastSeasonGames: 17,
      seasonPositionRank: 'RB4',
      currentPositionRank: 'RB6',
      playerDetails: { age: 28, isStarter: true, injuryStatus: 'Active', sleeperStartedPct: 95, depthChartOrder: 1 },
    });
    const dynasty = gradePlayer(producer, 'dynasty')!;
    const redraft = gradePlayer(producer, 'redraft')!;
    // Same inputs, but a strong producer past dynasty-prime age should grade up in redraft.
    expect(redraft.composite).toBeGreaterThan(dynasty.composite);
  });
});

describe('gradeRoster', () => {
  it('assigns composite position ranks and sorts best-first', () => {
    const roster = [
      makePlayer({ player_id: 'wr-b', pos: 'WR', lastSeasonPointsPerGame: 10, lastSeasonGames: 15, currentPositionRank: 'WR30', playerDetails: { age: 27 } }),
      makePlayer({ player_id: 'wr-a', pos: 'WR', lastSeasonPointsPerGame: 18, lastSeasonGames: 17, currentPositionRank: 'WR4', playerDetails: { age: 24, isStarter: true } }),
      makePlayer({ player_id: 'qb-a', pos: 'QB', lastSeasonPointsPerGame: 22, lastSeasonGames: 17, currentPositionRank: 'QB3', playerDetails: { age: 27, isStarter: true } }),
    ];
    const graded = gradeRoster(roster, 'dynasty');

    // WR-a outranks WR-b within position.
    const wrA = graded.find((g) => g.player.player_id === 'wr-a')!;
    const wrB = graded.find((g) => g.player.player_id === 'wr-b')!;
    expect(wrA.compositePositionRank).toBe('WR1');
    expect(wrB.compositePositionRank).toBe('WR2');
    expect(graded.find((g) => g.player.player_id === 'qb-a')!.compositePositionRank).toBe('QB1');

    // Sorted best-first by composite.
    for (let i = 1; i < graded.length; i += 1) {
      expect(graded[i - 1].composite).toBeGreaterThanOrEqual(graded[i].composite);
    }
  });
});
