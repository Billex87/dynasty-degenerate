import { describe, expect, it } from 'vitest';
import { buildFantasyProsSnapshotContext } from './fantasyProsSnapshotContext';
import type { FantasyProsEndpointSnapshotPayload } from './fantasyProsEndpointSnapshots';

function snapshot(
  endpointKey: string,
  endpointLabel: string,
  data: unknown,
  rowCount: number,
): FantasyProsEndpointSnapshotPayload {
  return {
    version: 1,
    source: 'FantasyPros',
    sourceKey: `fantasypros-endpoint-v1:2026:PPR:${endpointKey}`,
    endpointKey,
    endpointLabel,
    board: 'redraft',
    path: `/nfl/2026/${endpointKey}`,
    season: '2026',
    scoring: 'PPR',
    fetchedAt: '2026-05-19T12:00:00.000Z',
    rowCount,
    totalExperts: 4,
    lastUpdated: '5/19',
    statusCode: 200,
    data,
  };
}

describe('FantasyPros snapshot context', () => {
  it('normalizes stored weekly ECR, projections, points, players, and compare-player snapshots', () => {
    const context = buildFantasyProsSnapshotContext({
      season: '2026',
      scoring: 'PPR',
      generatedAt: '2026-05-19T13:00:00.000Z',
      currentWeek: 2,
      weekWindow: 3,
      snapshots: {
        'fantasypros-weekly-ecr': snapshot('fantasypros-weekly-ecr', 'FantasyPros Weekly ECR QB Week 1', {
          week: 1,
          players: [{
            player_id: '9016',
            player_name: 'Sample QB',
            player_position_id: 'QB',
            player_team_id: 'BUF',
            rank_ecr: 4,
            pos_rank: 'QB4',
            rank_min: 2,
            rank_max: 8,
            rank_ave: 4.5,
            rank_std: 1.4,
            player_bye_week: 7,
          }],
        }, 1),
        'fantasypros-weekly-ecr-rb-week-3': snapshot('fantasypros-weekly-ecr-rb-week-3', 'FantasyPros Weekly ECR RB Week 3', {
          week: 3,
          players: [{
            player_id: '9020',
            player_name: 'Sample RB',
            player_position_id: 'RB',
            player_team_id: 'ATL',
            rank_ecr: 11,
            pos_rank: 'RB6',
            rank_min: 7,
            rank_max: 18,
            rank_ave: 11.2,
            rank_std: 2.1,
            player_bye_week: 12,
          }],
        }, 1),
        'fantasypros-weekly-ecr-dst-week-4': snapshot('fantasypros-weekly-ecr-dst-week-4', 'FantasyPros Weekly ECR DST Week 4', {
          week: 4,
          players: [{
            player_id: '9900',
            player_name: 'Sample DST',
            player_position_id: 'DST',
            player_team_id: 'PIT',
            rank_ecr: 3,
            pos_rank: 'DST3',
          }],
        }, 1),
        'fantasypros-projections': snapshot('fantasypros-projections', 'FantasyPros Projections', {
          week: 1,
          players: [{
            player_id: '9016',
            player_name: 'Sample QB',
            player_position_id: 'QB',
            player_team_id: 'BUF',
            fpts: 22.4,
            pass_yds: 278,
          }],
        }, 1),
        'fantasypros-player-points': snapshot('fantasypros-player-points', 'FantasyPros Player Points', {
          players: [{
            player_id: '9016',
            player_name: 'Sample QB',
            player_position_id: 'QB',
            player_team_id: 'BUF',
            games: 17,
            points: 340.2,
            average: 20,
            weeks: { '1': 24.1, '2': 18.6 },
          }],
        }, 1),
        'fantasypros-players': snapshot('fantasypros-players', 'FantasyPros Players', {
          players: [{
            player_id: '9016',
            player_name: 'Sample QB',
            player_position_id: 'QB',
            player_team_id: 'BUF',
            age: 28,
            birthdate: '1998-01-01',
            espn_id: '123',
            yahoo_id: '456',
            filename: 'https://www.fantasypros.com/nfl/players/sample-qb.php',
          }],
        }, 1),
        'fantasypros-compare-players': snapshot('fantasypros-compare-players', 'FantasyPros Compare Players', {
          ranking_type: 'weekly',
          position_id: 'QB',
          rankings: {
            PPR: {
              '9016': [{ rank: 3 }, { rank: 5 }],
            },
          },
        }, 2),
      },
    });

    expect(context.weeklyEcrByFantasyProsId['9016']).toMatchObject({
      rankEcr: 4,
      positionRank: 'QB4',
      averageRank: 4.5,
      week: 1,
    });
    expect(context.weeklyEcrByPositionWeek.RB['3']['9020']).toMatchObject({
      name: 'Sample RB',
      rankEcr: 11,
      positionRank: 'RB6',
      week: 3,
    });
    expect(context.weeklyEcrByPositionWeek.DST['4']['9900']).toMatchObject({
      name: 'Sample DST',
      rankEcr: 3,
      positionRank: 'DST3',
      week: 4,
    });
    expect(context.weeklyEcrByPositionWeek.QB['2']).toEqual({});
    expect(context.projectionsByFantasyProsId['9016']).toMatchObject({
      projectedPoints: 22.4,
      statLines: { fpts: 22.4, pass_yds: 278 },
    });
    expect(context.playerPointsByFantasyProsId['9016']).toMatchObject({
      games: 17,
      points: 340.2,
      average: 20,
      weeks: { '1': 24.1, '2': 18.6 },
    });
    expect(context.playersByFantasyProsId['9016']).toMatchObject({
      age: 28,
      externalIds: { espn_id: '123', yahoo_id: '456' },
    });
    expect(context.comparePlayersByFantasyProsId['9016']).toMatchObject({
      expertRankCount: 2,
      bestRank: 3,
      worstRank: 5,
      averageRank: 4,
    });
    expect(context.rowCounts).toContainEqual({
      sourceKey: 'fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr',
      rowCount: 1,
    });
    expect(context.rowCounts).toContainEqual({
      sourceKey: 'fantasypros-endpoint-v1:2026:PPR:fantasypros-weekly-ecr-rb-week-3',
      rowCount: 1,
    });
    expect(context.summaries.find((summary) => summary.endpointKey === 'fantasypros-ww')).toMatchObject({
      status: 'missing',
      rowCount: 0,
    });
  });

  it('keeps rows when FantasyPros sends numeric player IDs', () => {
    const context = buildFantasyProsSnapshotContext({
      season: '2026',
      scoring: 'PPR',
      currentWeek: 1,
      weekWindow: 1,
      snapshots: {
        'fantasypros-weekly-ecr-wr-week-1': snapshot('fantasypros-weekly-ecr-wr-week-1', 'FantasyPros Weekly ECR WR Week 1', {
          week: '1',
          players: [{
            player_id: 19788,
            player_name: "Ja'Marr Chase",
            player_position_id: 'WR',
            player_team_id: 'CIN',
            rank_ecr: 1,
            rank_min: '1',
            rank_max: '1',
            rank_ave: '1.00',
            rank_std: '0.00',
            pos_rank: 'WR1',
          }],
        }, 1),
        'fantasypros-players': snapshot('fantasypros-players', 'FantasyPros Players', {
          players: [{
            player_id: 19788,
            player_name: "Ja'Marr Chase",
            player_position_id: 'WR',
            player_team_id: 'CIN',
            espn_id: 4362628,
            yahoo_id: '33393',
          }],
        }, 1),
      },
    });

    expect(context.weeklyEcrByPositionWeek.WR['1']['19788']).toMatchObject({
      name: "Ja'Marr Chase",
      rankEcr: 1,
      positionRank: 'WR1',
      week: 1,
    });
    expect(context.playersByFantasyProsId['19788']).toMatchObject({
      externalIds: {
        espn_id: '4362628',
        yahoo_id: '33393',
      },
    });
  });
});
