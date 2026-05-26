import { describe, expect, it } from 'vitest';
import {
  applySleeperTightEndPremium,
  buildSleeperProjectionInputRows,
  buildSleeperProjectionSnapshot,
  getSleeperProjectedFantasyPoints,
  getSleeperProjectionScoringProfile,
} from './sleeperProjectionSnapshots';

describe('sleeper projection snapshots', () => {
  it('maps Sleeper PPR, half-PPR, standard, volume stats, teams, opponents, and freshness', () => {
    const rows = [{
      status: 'scheduled',
      stats: {
        pts_ppr: 17.34,
        pts_half_ppr: 14.84,
        pts_std: 12.34,
        rec_tgt: 8,
        rec: 5,
        rec_yd: 72.3,
        rec_td: 0.5,
      },
      updated_at: Date.parse('2026-09-08T12:00:00.000Z'),
      week: 1,
      season: '2026',
      player_id: 'wr1',
      game_id: 'game-1',
      opponent: 'KC',
      team: 'JAC',
      player: {
        first_name: 'Stored',
        last_name: 'Receiver',
        position: 'WR',
        team: 'JAC',
        fantasy_positions: ['WR'],
      },
    }];

    const inputRows = buildSleeperProjectionInputRows({ rows, scoringProfile: 'PPR' });
    expect(inputRows[0]).toMatchObject({
      playerId: 'wr1',
      sourcePlayerId: 'wr1',
      playerName: 'Stored Receiver',
      team: 'JAC',
      opponent: 'KC',
      homeAway: 'unknown',
      sourceStatus: 'scheduled',
      position: 'WR',
      projectedFantasyPoints: 17.34,
      targets: 8,
      receptions: 5,
      receivingYards: 72.3,
      receivingTouchdowns: 0.5,
      providerUpdatedAt: '2026-09-08T12:00:00.000Z',
    });
    expect(getSleeperProjectedFantasyPoints(rows[0].stats, 'HALF_PPR')).toBe(14.84);
    expect(getSleeperProjectedFantasyPoints(rows[0].stats, 'STD')).toBe(12.34);
  });

  it('quarantines null projection rows before they can power recommendations', () => {
    const snapshot = buildSleeperProjectionSnapshot({
      season: '2026',
      week: 1,
      scoringProfile: 'PPR',
      fetchedAt: '2026-09-08T12:00:00.000Z',
      rows: [
        {
          stats: { pts_ppr: 11.2 },
          week: 1,
          season: '2026',
          player_id: 'rb1',
          opponent: 'ARI',
          team: 'LAR',
          player: { first_name: 'Ready', last_name: 'Runner', position: 'RB', fantasy_positions: ['RB'] },
        },
        {
          stats: { pts_ppr: null },
          week: 1,
          season: '2026',
          player_id: 'bye1',
          opponent: null,
          team: 'BAL',
          player: { first_name: 'Bye', last_name: 'Runner', position: 'RB', fantasy_positions: ['RB'] },
        },
      ],
    });

    expect(snapshot).toMatchObject({
      source: 'sleeper',
      sourceKey: 'player-projection-snapshots-v1:sleeper:PPR:weekly',
      snapshotKey: '2026:w1:sleeper-ppr-2026-w1',
      rowCount: 1,
      positionCoverage: { RB: 1 },
    });
    expect(snapshot.rows[0]).toMatchObject({
      playerId: 'rb1',
      projectedFantasyPoints: 11.2,
      opponent: 'ARI',
    });
    expect(snapshot.quarantinedRows.map((row) => row.reason)).toEqual(['missing-projection']);
  });

  it('detects league scoring family and calculates custom points only when needed', () => {
    expect(getSleeperProjectionScoringProfile({ rec: 1 })).toBe('PPR');
    expect(getSleeperProjectionScoringProfile({ rec: 0.5 })).toBe('HALF_PPR');
    expect(getSleeperProjectionScoringProfile({ rec: 0 })).toBe('STD');
    expect(getSleeperProjectionScoringProfile({ rec: 1.25 })).toBe('CUSTOM');
    expect(getSleeperProjectedFantasyPoints(
      { rec: 6, rec_yd: 80, rec_td: 1 },
      'CUSTOM',
      { rec: 1.25, rec_yd: 0.1, rec_td: 6 }
    )).toBe(21.5);
  });

  it('applies tight end premium from league settings without changing non-TE projections', () => {
    expect(applySleeperTightEndPremium({
      projectedFantasyPoints: 10,
      position: 'TE',
      receptions: 4,
      tightEndPremium: 0.5,
    })).toEqual({ projectedFantasyPoints: 12, adjustment: 2 });

    expect(applySleeperTightEndPremium({
      projectedFantasyPoints: 10,
      position: 'WR',
      receptions: 4,
      tightEndPremium: 0.5,
    })).toEqual({ projectedFantasyPoints: 10, adjustment: 0 });

    expect(applySleeperTightEndPremium({
      projectedFantasyPoints: null,
      position: 'TE',
      receptions: 4,
      tightEndPremium: 0.5,
    })).toEqual({ projectedFantasyPoints: null, adjustment: 0 });
  });
});
