import { describe, expect, it } from 'vitest';
import { buildPlayerSeasonOutcomeRows, summarizePlayerSeasonOutcomes, type PlayerSeasonInput } from './playerSeasonOutcomeModel';

function season(input: Partial<PlayerSeasonInput> & Pick<PlayerSeasonInput, 'playerKey' | 'playerName' | 'position' | 'season' | 'games' | 'fantasyPointsPpr'>): PlayerSeasonInput {
  return {
    team: 'SEA',
    carries: 0,
    targets: 0,
    receptions: 0,
    ...input,
  };
}

describe('player season outcome model', () => {
  it('labels progression, regression, role usage, and next-year outcomes without page data', () => {
    const rows = buildPlayerSeasonOutcomeRows([
      season({
        playerKey: 'wr1',
        playerName: 'Wide Receiver One',
        position: 'WR',
        season: 2023,
        games: 14,
        fantasyPointsPpr: 126,
        targets: 72,
        receptions: 44,
      }),
      season({
        playerKey: 'wr1',
        playerName: 'Wide Receiver One',
        position: 'WR',
        season: 2024,
        games: 16,
        fantasyPointsPpr: 288,
        targets: 142,
        receptions: 96,
        targetShare: 0.26,
        wopr: 0.61,
      }),
      season({
        playerKey: 'wr1',
        playerName: 'Wide Receiver One',
        position: 'WR',
        season: 2025,
        games: 15,
        fantasyPointsPpr: 165,
        targets: 86,
        receptions: 55,
        targetShare: 0.17,
      }),
    ]);

    const breakout = rows.find((row) => row.playerKey === 'wr1' && row.season === 2024);
    const regression = rows.find((row) => row.playerKey === 'wr1' && row.season === 2025);

    expect(breakout).toMatchObject({
      productionTier: 'strong',
      roleTier: 'feature',
      trajectoryFromPrevious: 'breakout',
      nextSeasonOutcome: 'collapse',
      modelEligible: true,
    });
    expect(regression).toMatchObject({
      trajectoryFromPrevious: 'collapse',
      nextSeasonOutcome: null,
    });
    expect(breakout?.note).toContain('next year: collapse');
  });

  it('summarizes eligible rows by position and outcome', () => {
    const rows = buildPlayerSeasonOutcomeRows([
      season({ playerKey: 'rb1', playerName: 'Back One', position: 'RB', season: 2024, games: 16, fantasyPointsPpr: 256, carries: 240, targets: 58 }),
      season({ playerKey: 'rb1', playerName: 'Back One', position: 'RB', season: 2025, games: 15, fantasyPointsPpr: 255, carries: 238, targets: 55 }),
      season({ playerKey: 'te1', playerName: 'Tight End One', position: 'TE', season: 2025, games: 4, fantasyPointsPpr: 25, targets: 20 }),
    ]);
    const summary = summarizePlayerSeasonOutcomes(rows);

    expect(summary.rowCount).toBe(3);
    expect(summary.modelEligibleCount).toBe(2);
    expect(summary.byPosition.RB.trajectories.sustain).toBe(1);
    expect(summary.byPosition.TE.tiers['low-signal']).toBe(1);
  });
});
