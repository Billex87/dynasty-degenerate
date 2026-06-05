import { describe, expect, it } from 'vitest';
import { buildFantasyProsDraftAdpData } from './fantasyProsDraftCostContext';
import { buildFantasyProsSnapshotContext } from './fantasyProsSnapshotContext';
import type { FantasyProsEndpointSnapshotPayload } from './fantasyProsEndpointSnapshots';

function snapshot(
  endpointKey: string,
  data: unknown,
  rowCount = 1,
): FantasyProsEndpointSnapshotPayload {
  return {
    version: 1,
    source: 'FantasyPros',
    sourceKey: `fantasypros-endpoint-v1:2026:PPR:${endpointKey}`,
    endpointKey,
    endpointLabel: endpointKey,
    board: 'redraft',
    path: `/nfl/2026/${endpointKey}`,
    season: '2026',
    scoring: 'PPR',
    fetchedAt: '2026-06-05T12:00:00.000Z',
    rowCount,
    totalExperts: 4,
    lastUpdated: '2026-06-05T11:00:00.000Z',
    statusCode: 200,
    data,
  };
}

function rankingPlayer(input: {
  fantasyProsId: string;
  name: string;
  position: string;
  team?: string;
  rank: number;
  averageRank?: number;
  positionRank?: string;
}) {
  return {
    player_id: input.fantasyProsId,
    player_name: input.name,
    player_position_id: input.position,
    player_team_id: input.team || 'MIA',
    rank_ecr: input.rank,
    rank_ave: input.averageRank ?? input.rank,
    pos_rank: input.positionRank || `${input.position}${input.rank}`,
  };
}

describe('buildFantasyProsDraftAdpData', () => {
  it('maps redraft main-draft picks to FantasyPros ADP through direct FantasyPros IDs', () => {
    const context = buildFantasyProsSnapshotContext({
      season: '2026',
      scoring: 'PPR',
      snapshots: {
        'fantasypros-adp': snapshot('fantasypros-adp', {
          players: [rankingPlayer({
            fantasyProsId: 'fp-redraft',
            name: 'Redraft Runner',
            position: 'RB',
            rank: 19,
            averageRank: 21.4,
            positionRank: 'RB9',
          })],
        }),
      },
    });

    const rows = buildFantasyProsDraftAdpData({
      draftPicks: [{
        player_id: 'sleeper-redraft',
        picked_by: 'user1',
        pick_no: 10,
        round: 1,
        season: '2026',
        draft_pick_count: 120,
      }] as any,
      players: {
        'sleeper-redraft': {
          full_name: 'Redraft Runner',
          position: 'RB',
          fantasypros_id: 'fp-redraft',
        },
      },
      fantasyProsSnapshotContext: context,
      leagueValueMode: 'redraft',
    });

    expect(rows['2026:sleeper-redraft']).toEqual({
      name: 'Redraft Runner',
      adp: 21.4,
      source: 'FantasyPros ADP',
      rank: 19,
      positionRank: 'RB9',
    });
  });

  it('maps dynasty startup picks to FantasyPros Dynasty ADP through stored Sleeper external IDs', () => {
    const context = buildFantasyProsSnapshotContext({
      season: '2026',
      scoring: 'PPR',
      snapshots: {
        'fantasypros-players': snapshot('fantasypros-players', {
          players: [{
            player_id: 'fp-startup',
            player_name: 'Startup Wideout',
            player_position_id: 'WR',
            player_team_id: 'BUF',
            sleeper_id: 'sleeper-startup',
          }],
        }),
        'fantasypros-dynadp': snapshot('fantasypros-dynadp', {
          players: [rankingPlayer({
            fantasyProsId: 'fp-startup',
            name: 'Startup Wideout',
            position: 'WR',
            rank: 34,
            averageRank: 36.2,
            positionRank: 'WR16',
          })],
        }),
      },
    });

    const rows = buildFantasyProsDraftAdpData({
      draftPicks: [{
        player_id: 'sleeper-startup',
        picked_by: 'user1',
        pick_no: 25,
        round: 3,
        season: '2026',
        draft_pick_count: 180,
      }] as any,
      players: {
        'sleeper-startup': {
          full_name: 'Startup Wideout',
          position: 'WR',
        },
      },
      fantasyProsSnapshotContext: context,
      leagueValueMode: 'dynasty',
    });

    expect(rows['2026:sleeper-startup']).toMatchObject({
      adp: 36.2,
      source: 'FantasyPros Dynasty ADP',
      rank: 34,
      positionRank: 'WR16',
    });
  });

  it('maps dynasty rookie picks to Rookie ADP and falls back to ROOKIES rankings when RKADP is absent', () => {
    const context = buildFantasyProsSnapshotContext({
      season: '2026',
      scoring: 'PPR',
      snapshots: {
        'fantasypros-rkadp': snapshot('fantasypros-rkadp', {
          players: [rankingPlayer({
            fantasyProsId: 'fp-rkadp',
            name: 'Rookie Back',
            position: 'RB',
            rank: 5,
            averageRank: 6.1,
            positionRank: 'RB2',
          })],
        }),
        'fantasypros-rookies': snapshot('fantasypros-rookies', {
          players: [rankingPlayer({
            fantasyProsId: 'fp-rookies',
            name: 'Ranking Receiver',
            position: 'WR',
            rank: 9,
            averageRank: 9.8,
            positionRank: 'WR4',
          })],
        }),
      },
    });

    const rows = buildFantasyProsDraftAdpData({
      draftPicks: [
        {
          player_id: 'sleeper-rkadp',
          picked_by: 'user1',
          pick_no: 4,
          round: 1,
          season: '2026',
          draft_pick_count: 36,
        },
        {
          player_id: 'sleeper-rookies',
          picked_by: 'user1',
          pick_no: 8,
          round: 1,
          season: '2026',
          draft_pick_count: 36,
        },
      ] as any,
      players: {
        'sleeper-rkadp': {
          full_name: 'Rookie Back',
          position: 'RB',
          fantasypros_id: 'fp-rkadp',
        },
        'sleeper-rookies': {
          full_name: 'Ranking Receiver',
          position: 'WR',
          fantasypros_id: 'fp-rookies',
        },
      },
      fantasyProsSnapshotContext: context,
      leagueValueMode: 'dynasty',
    });

    expect(rows['2026:sleeper-rkadp']).toMatchObject({
      adp: 6.1,
      source: 'FantasyPros Rookie ADP',
      rank: 5,
      positionRank: 'RB2',
    });
    expect(rows['2026:sleeper-rookies']).toMatchObject({
      adp: 9.8,
      source: 'FantasyPros Rookie ADP',
      rank: 9,
      positionRank: 'WR4',
    });
  });

  it('fails closed for unmatched or different-season picks', () => {
    const context = buildFantasyProsSnapshotContext({
      season: '2026',
      scoring: 'PPR',
      snapshots: {
        'fantasypros-adp': snapshot('fantasypros-adp', {
          players: [rankingPlayer({
            fantasyProsId: 'fp-redraft',
            name: 'Redraft Runner',
            position: 'RB',
            rank: 19,
          })],
        }),
      },
    });

    const rows = buildFantasyProsDraftAdpData({
      draftPicks: [
        {
          player_id: 'sleeper-redraft',
          picked_by: 'user1',
          pick_no: 10,
          round: 1,
          season: '2025',
        },
        {
          player_id: 'unmatched',
          picked_by: 'user1',
          pick_no: 11,
          round: 1,
          season: '2026',
        },
      ] as any,
      players: {
        'sleeper-redraft': {
          full_name: 'Redraft Runner',
          position: 'RB',
          fantasypros_id: 'fp-redraft',
        },
      },
      fantasyProsSnapshotContext: context,
      leagueValueMode: 'redraft',
    });

    expect(rows).toEqual({});
  });
});
