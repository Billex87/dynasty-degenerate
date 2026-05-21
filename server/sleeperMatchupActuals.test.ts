import { describe, expect, it } from 'vitest';
import { buildNflScheduleSnapshot } from './nflScheduleSnapshots';
import { buildPlayerMatchupActuals } from './playerMatchupActuals';
import {
  buildSleeperMatchupActualRowsForSeason,
  buildSleeperMatchupActualRowsForWeek,
  calculateSleeperFantasyPointsFromScoring,
  getSleeperFantasyPoints,
} from './sleeperMatchupActuals';

const players = {
  '4984': {
    first_name: 'Josh',
    last_name: 'Allen',
    full_name: 'Josh Allen',
    position: 'QB',
    team: 'BUF',
    fantasy_positions: ['QB'],
  },
  wr1: {
    first_name: 'Wide',
    last_name: 'Receiver',
    full_name: 'Wide Receiver',
    position: 'WR',
    team: 'DAL',
    fantasy_positions: ['WR'],
  },
};

describe('sleeper matchup actuals adapter', () => {
  it('converts weekly Sleeper stats into matchup actual rows with historical team maps', () => {
    const rows = buildSleeperMatchupActualRowsForWeek({
      season: 2022,
      week: 6,
      players,
      teamMaps: {
        byPlayerSeasonWeek: {
          '4984:2022:6': 'BUF',
        },
      },
      stats: {
        '4984': {
          stats: {
            pts_ppr: 27.4,
            gp: 1,
            pass_att: 40,
            pass_yd: 329,
            pass_td: 3,
            pass_int: 1,
            rush_att: 10,
            rush_yd: 32,
            off_snp: 66,
            tm_off_snp: 70,
          },
        },
      },
      projectedFantasyPointsByPlayerId: {
        '4984': 24,
      },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        season: 2022,
        week: 6,
        playerId: '4984',
        playerName: 'Josh Allen',
        team: 'BUF',
        position: 'QB',
        actualFantasyPoints: 27.4,
        projectedFantasyPoints: 24,
        passAttempts: 40,
        passingYards: 329,
        passingTouchdowns: 3,
        interceptions: 1,
        rushAttempts: 10,
        rushingYards: 32,
        offenseSnapPct: 0.9429,
        source: 'sleeper-weekly-stats:historical-team-map',
      }),
    ]);
  });

  it('does not use current player team as historical team unless explicitly allowed', () => {
    const blocked = buildSleeperMatchupActualRowsForWeek({
      season: 2021,
      week: 1,
      players,
      stats: {
        wr1: {
          pts_ppr: 14.2,
          gp: 1,
          rec: 5,
          rec_yd: 92,
          rec_td: 1,
        },
      },
    });
    const fallback = buildSleeperMatchupActualRowsForWeek({
      season: 2021,
      week: 1,
      players,
      allowPlayerMetadataTeamFallback: true,
      stats: {
        wr1: {
          pts_ppr: 14.2,
          gp: 1,
          rec: 5,
          rec_yd: 92,
          rec_td: 1,
        },
      },
    });

    expect(blocked).toEqual([]);
    expect(fallback[0]).toMatchObject({
      playerId: 'wr1',
      team: 'DAL',
      source: 'sleeper-weekly-stats:player-metadata-current-team-fallback',
    });
  });

  it('supports custom league scoring when Sleeper preset scoring is not enough', () => {
    const stats = {
      pass_yd: 300,
      pass_td: 3,
      pass_int: 1,
      rush_yd: 40,
      rush_td: 1,
      gp: 1,
    };
    const scoringSettings = {
      pass_yd: 0.04,
      pass_td: 6,
      pass_int: -2,
      rush_yd: 0.1,
      rush_td: 6,
      rec: 0.25,
    };

    expect(calculateSleeperFantasyPointsFromScoring(stats, scoringSettings)).toBe(38);
    expect(getSleeperFantasyPoints(stats, scoringSettings)).toBe(38);
  });

  it('feeds Sleeper rows into player-vs-opponent calibration through schedule joins', () => {
    const schedule2021 = buildNflScheduleSnapshot({
      season: 2021,
      source: 'NFL schedule',
      sourceVersion: '2021',
      rows: [
        { season: 2021, week: 5, gameId: 'kc-buf-2021', homeTeam: 'KC', awayTeam: 'BUF', gameStatus: 'final' },
      ],
    });
    const schedule2022 = buildNflScheduleSnapshot({
      season: 2022,
      source: 'NFL schedule',
      sourceVersion: '2022',
      rows: [
        { season: 2022, week: 6, gameId: 'kc-buf-2022', homeTeam: 'KC', awayTeam: 'BUF', gameStatus: 'final' },
      ],
    });
    const actualRows = buildSleeperMatchupActualRowsForSeason({
      players,
      teamMaps: {
        byPlayerSeason: {
          '4984:2021': 'BUF',
          '4984:2022': 'BUF',
        },
      },
      projectedFantasyPointsByPlayerId: {
        '4984': 24,
      },
      weeks: [
        {
          season: 2021,
          week: 5,
          values: {
            '4984': { pts_ppr: 36.5, gp: 1, pass_att: 26, pass_yd: 315, pass_td: 3, rush_yd: 59, rush_td: 1 },
          },
        },
        {
          season: 2022,
          week: 6,
          values: {
            '4984': { pts_ppr: 27.4, gp: 1, pass_att: 40, pass_yd: 329, pass_td: 3, pass_int: 1, rush_yd: 32 },
          },
        },
      ],
    });

    const result = buildPlayerMatchupActuals({
      actualRows,
      scheduleSnapshots: [schedule2021, schedule2022],
      playerOpponentMinSampleSize: 2,
    });

    expect(result.playerOpponentHistories[0]).toMatchObject({
      historyKey: '4984:QB:KC',
      playerName: 'Josh Allen',
      opponent: 'KC',
      sampleSize: 2,
      avgFantasyPoints: 31.95,
      recommendation: 'boost',
    });
    expect(result.playerOpponentHistories[0].games[0].statLine).toContain('329 pass yds');
  });
});
