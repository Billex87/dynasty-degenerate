import { describe, expect, it } from 'vitest';
import type { ManagerIntelPlayer } from '@shared/types';
import { buildLeagueComparatives, summarizeManagerRoster, type ManagerBlueprintRollup } from './leagueComparatives';

function player(overrides: Partial<ManagerIntelPlayer> & { player_id: string; pos: string; value: number }): ManagerIntelPlayer {
  return { name: overrides.player_id, ...overrides } as ManagerIntelPlayer;
}

function rollup(over: Partial<ManagerBlueprintRollup> & { manager: string }): ManagerBlueprintRollup {
  return { rosterValue: 0, productionPoints: 0, overallGrade: 0, buildLabel: 'Well Rounded', ...over };
}

describe('summarizeManagerRoster', () => {
  it('sums value + production and grades the roster', () => {
    const summary = summarizeManagerRoster({
      manager: 'A',
      buildLabel: 'Well Rounded',
      valueMode: 'dynasty',
      players: [
        player({ player_id: 'wr1', pos: 'WR', value: 6000, lastSeasonFantasyPoints: 250, playerDetails: { age: 24, isStarter: true } }),
        player({ player_id: 'rb1', pos: 'RB', value: 3000, lastSeasonFantasyPoints: 180, playerDetails: { age: 26 } }),
      ],
    });
    expect(summary.rosterValue).toBe(9000);
    expect(summary.productionPoints).toBe(430);
    expect(summary.overallGrade).toBeGreaterThan(0);
    expect(summary.buildLabel).toBe('Well Rounded');
  });

  it('normalizes a missing build label to Unclassified', () => {
    const summary = summarizeManagerRoster({ manager: 'A', players: [], buildLabel: '  ' });
    expect(summary.buildLabel).toBe('Unclassified');
  });
});

describe('buildLeagueComparatives', () => {
  const league: ManagerBlueprintRollup[] = [
    rollup({ manager: 'A', rosterValue: 40000, productionPoints: 1000, overallGrade: 7.5, buildLabel: 'Well Rounded' }),
    rollup({ manager: 'B', rosterValue: 30000, productionPoints: 800, overallGrade: 6, buildLabel: 'Well Rounded' }),
    rollup({ manager: 'C', rosterValue: 20000, productionPoints: 600, overallGrade: 5, buildLabel: 'Top Heavy' }),
    rollup({ manager: 'D', rosterValue: 10000, productionPoints: 400, overallGrade: 3, buildLabel: 'Rebuild' }),
  ];

  it('computes value share + rank for the focused manager', () => {
    const result = buildLeagueComparatives(league, 'A');
    expect(result.valueShare).toBeCloseTo(40, 0); // 40k of 100k
    expect(result.valueShareRank).toBe(1);
    expect(result.teamCount).toBe(4);
  });

  it('computes production share + rank', () => {
    const result = buildLeagueComparatives(league, 'C');
    expect(result.productionShare).toBeCloseTo(21.4, 0); // 600 / 2800
    expect(result.productionShareRank).toBe(3);
  });

  it('computes blueprint percentile by overall grade', () => {
    expect(buildLeagueComparatives(league, 'A').percentile).toBe(100); // best of 4
    expect(buildLeagueComparatives(league, 'D').percentile).toBe(25); // worst of 4
  });

  it('computes build rarity as share of teams with the same build', () => {
    expect(buildLeagueComparatives(league, 'A').buildRarity).toBe(50); // 2 of 4 Well Rounded
    expect(buildLeagueComparatives(league, 'C').buildRarity).toBe(25); // 1 of 4 Top Heavy
  });

  it('returns nulls when there is no league to compare against', () => {
    const solo = buildLeagueComparatives([rollup({ manager: 'A', rosterValue: 100 })], 'A');
    expect(solo.valueShare).toBeNull();
    expect(solo.percentile).toBeNull();
    expect(solo.buildRarity).toBeNull();
  });

  it('leaves production null when no team has production points', () => {
    const noProd = league.map((r) => ({ ...r, productionPoints: 0 }));
    const result = buildLeagueComparatives(noProd, 'A');
    expect(result.productionShare).toBeNull();
    expect(result.productionShareRank).toBeNull();
    expect(result.valueShare).not.toBeNull();
  });
});
