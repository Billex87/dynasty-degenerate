import { describe, expect, it } from 'vitest';
import { buildFantasyProsIdBySleeperId, buildFantasyProsPlayerSourceTrace } from './fantasyProsPlayerSourceTrace';

describe('buildFantasyProsPlayerSourceTrace', () => {
  it('emits dynasty and season traces from stored FantasyPros value fields', () => {
    const trace = buildFantasyProsPlayerSourceTrace({
      expert_value_fantasypros: 5120,
      fantasypros_dynasty_rank: 28,
      fantasypros_dynasty_position_rank: 'WR12',
      fantasypros_season_value: 4380,
      fantasypros_rank: 41,
      fantasypros_position_rank: 'WR18',
      fantasypros_tier: 4,
      value_sources: ['KTC', 'FantasyPros'],
    });

    expect(trace).toHaveLength(2);
    expect(trace[0]).toMatchObject({
      source: 'FantasyPros',
      key: 'DYNASTY',
      label: 'FantasyPros Dynasty',
      value: 5120,
      rank: 28,
      positionRank: 'WR12',
    });
    expect(trace[0].evidence).toContain('exact FantasyPros endpoint metadata was not preserved');
    expect(trace[1]).toMatchObject({
      key: 'SEASON',
      label: 'FantasyPros Season',
      value: 4380,
      rank: 41,
      positionRank: 'WR18',
      tier: 4,
    });
  });

  it('suppresses dynasty fields for redraft profiles but keeps current-season FantasyPros fields', () => {
    const trace = buildFantasyProsPlayerSourceTrace(
      {
        expert_value_fantasypros: 5120,
        fantasypros_dynasty_rank: 28,
        fantasypros_season_value: 4380,
        fantasypros_rank: 41,
        fantasypros_position_rank: 'WR18',
      },
      { isRedraftProfile: true }
    );

    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({
      key: 'SEASON',
      label: 'FantasyPros Season',
      value: 4380,
    });
  });

  it('uses preserved endpoint metadata when snapshot rows carry it', () => {
    const trace = buildFantasyProsPlayerSourceTrace({
      fantasypros_endpoint_key: 'fantasypros-endpoint-v1:2026:PPR:fantasypros-ros-rb',
      fantasypros_source_key: 'fantasypros-consensus-rankings:ROS',
      fantasypros_scoring: 'PPR',
      fantasypros_season: '2026',
      fantasypros_last_updated: '2026-09-08T18:55:00.000Z',
      fantasypros_season_value: 6010,
      fantasypros_rank: 18,
      fantasypros_position_rank: 'RB10',
    });

    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({
      key: 'ROS',
      label: 'FantasyPros ROS',
      endpointKey: 'fantasypros-endpoint-v1:2026:PPR:fantasypros-ros-rb',
      sourceKey: 'fantasypros-consensus-rankings:ROS',
      scoring: 'PPR',
      season: '2026',
      lastUpdated: '2026-09-08T18:55:00.000Z',
    });
    expect(trace[0].evidence).toContain('endpoint metadata: fantasypros-endpoint-v1:2026:PPR:fantasypros-ros-rb');
  });

  it('does not relabel dynasty fields with season endpoint metadata from the same blended row', () => {
    const trace = buildFantasyProsPlayerSourceTrace({
      fantasypros_endpoint_key: 'fantasypros-endpoint-v1:2026:PPR:fantasypros-ros-wr',
      expert_value_fantasypros: 5120,
      fantasypros_dynasty_position_rank: 'WR12',
      fantasypros_season_value: 4380,
      fantasypros_position_rank: 'WR18',
    });

    expect(trace.map((row) => row.key)).toEqual(['DYNASTY', 'ROS']);
  });

  it('keeps a low-detail row when FantasyPros is listed but field-level values are absent', () => {
    const trace = buildFantasyProsPlayerSourceTrace({
      value_sources: ['FantasyPros'],
    });

    expect(trace).toEqual([
      {
        source: 'FantasyPros',
        key: 'UNKNOWN',
        label: 'FantasyPros Source Listing',
        sourceKey: null,
        endpointKey: null,
        scoring: null,
        season: null,
        week: null,
        fetchedAt: null,
        lastUpdated: null,
        status: 'listed-without-field-values',
        evidence: 'FantasyPros is listed in value_sources, but this value row did not preserve FantasyPros-specific value, rank, or endpoint fields.',
      },
    ]);
  });

  it('adds capped snapshot-backed traces for normalized FantasyPros context rows', () => {
    const snapshotContext = buildSnapshotContext({
      projectionsByFantasyProsId: {
        fp1: {
          fantasyProsId: 'fp1',
          name: 'Trace Player',
          position: 'WR',
          team: 'MIA',
          projectedPoints: 18.4,
          season: '2026',
          scoring: 'PPR',
          week: 3,
          statLines: {},
        },
      },
      playerPointsByFantasyProsId: {
        fp1: {
          fantasyProsId: 'fp1',
          name: 'Trace Player',
          position: 'WR',
          team: 'MIA',
          games: 2,
          points: 31.6,
          average: 15.8,
          weeks: {},
          season: '2026',
          scoring: 'PPR',
        },
      },
      adpByFantasyProsId: {
        fp1: consensusRow({ rankEcr: 42, positionRank: 'WR19' }),
      },
      rookieRankingsByFantasyProsId: {
        fp1: consensusRow({ rankEcr: 7, positionRank: 'WR3' }),
      },
      newsByFantasyProsId: {
        fp1: [{
          fantasyProsId: 'fp1',
          name: 'Trace Player',
          position: 'WR',
          team: 'MIA',
          title: 'Role expanding after camp usage',
          category: 'news',
          source: 'FantasyPros',
          url: 'https://example.com/news',
          publishedAt: '2026-09-10T12:00:00.000Z',
        }],
      },
      injuriesByFantasyProsId: {
        fp1: {
          fantasyProsId: 'fp1',
          name: 'Trace Player',
          position: 'WR',
          team: 'MIA',
          status: 'Questionable',
          injury: 'Hamstring',
          practiceStatus: 'Limited',
          gameStatus: null,
          updatedAt: '2026-09-11T12:00:00.000Z',
        },
      },
    });

    const trace = buildFantasyProsPlayerSourceTrace(
      { fantasypros_id: 'fp1', value_sources: ['FantasyPros'] },
      { snapshotContext }
    );

    expect(trace.map((row) => row.key)).toEqual([
      'PROJECTIONS',
      'PLAYER_POINTS',
      'ADP',
      'ROOKIES',
      'NEWS',
      'INJURIES',
    ]);
    expect(trace.find((row) => row.key === 'PROJECTIONS')).toMatchObject({
      value: 18.4,
      week: 3,
      endpointKey: 'fantasypros-projections',
      sourceKey: 'fantasypros-projections-v1:2026:PPR',
    });
    expect(trace.find((row) => row.key === 'PLAYER_POINTS')).toMatchObject({
      value: 15.8,
      endpointKey: 'fantasypros-player-points',
    });
    expect(trace.find((row) => row.key === 'NEWS')?.evidence).toContain('Role expanding after camp usage');
    expect(trace.find((row) => row.key === 'INJURIES')).toMatchObject({
      status: 'Questionable',
      lastUpdated: '2026-09-11T12:00:00.000Z',
    });
  });

  it('can match normalized context through a Sleeper ID from the FantasyPros player reference snapshot', () => {
    const snapshotContext = buildSnapshotContext({
      playersByFantasyProsId: {
        fp9: {
          fantasyProsId: 'fp9',
          name: 'Reference Player',
          position: 'RB',
          team: 'BUF',
          age: null,
          birthdate: null,
          sourceUrl: null,
          externalIds: { sleeper_id: 'sleeper-9' },
        },
      },
      projectionsByFantasyProsId: {
        fp9: {
          fantasyProsId: 'fp9',
          name: 'Reference Player',
          position: 'RB',
          team: 'BUF',
          projectedPoints: 12.2,
          season: '2026',
          scoring: 'PPR',
          week: 4,
          statLines: {},
        },
      },
    });
    const fantasyProsIdBySleeperId = buildFantasyProsIdBySleeperId(snapshotContext);

    const trace = buildFantasyProsPlayerSourceTrace(
      { value_sources: [] },
      {
        snapshotContext,
        sleeperPlayerId: 'sleeper-9',
        fantasyProsIdBySleeperId,
      }
    );

    expect({ ...fantasyProsIdBySleeperId }).toEqual({ 'sleeper-9': 'fp9' });
    expect(trace).toHaveLength(1);
    expect(trace[0]).toMatchObject({
      key: 'PROJECTIONS',
      value: 12.2,
    });
  });
});

function buildSnapshotContext(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-09-11T12:00:00.000Z',
    season: '2026',
    scoring: 'PPR',
    summaries: [
      summary('fantasypros-projections'),
      summary('fantasypros-player-points'),
      summary('fantasypros-adp'),
      summary('fantasypros-rookies'),
      summary('fantasypros-news'),
      summary('fantasypros-injuries'),
    ],
    rowCounts: [],
    weeklyEcrByFantasyProsId: {},
    waiverWireByFantasyProsId: {},
    projectionsByFantasyProsId: {},
    playerPointsByFantasyProsId: {},
    playersByFantasyProsId: {},
    comparePlayersByFantasyProsId: {},
    draftRankingsByFantasyProsId: {},
    rosRankingsByFantasyProsId: {},
    dynastyRankingsByFantasyProsId: {},
    devyRankingsByFantasyProsId: {},
    rookieRankingsByFantasyProsId: {},
    adpByFantasyProsId: {},
    dynastyAdpByFantasyProsId: {},
    rookieAdpByFantasyProsId: {},
    newsRows: [],
    newsByFantasyProsId: {},
    injuriesByFantasyProsId: {},
    weeklyEcrByPositionWeek: {},
    ...overrides,
  } as any;
}

function summary(endpointKey: string) {
  return {
    sourceKey: `${endpointKey}-v1:2026:PPR`,
    endpointKey,
    source: endpointKey,
    status: 'loaded',
    rowCount: 1,
    totalExperts: null,
    lastUpdated: '2026-09-11T12:00:00.000Z',
    fetchedAt: '2026-09-11T12:05:00.000Z',
  };
}

function consensusRow(overrides: Record<string, unknown> = {}) {
  return {
    fantasyProsId: 'fp1',
    name: 'Trace Player',
    position: 'WR',
    team: 'MIA',
    rankEcr: null,
    positionRank: null,
    bestRank: null,
    worstRank: null,
    averageRank: null,
    rankStdDev: null,
    byeWeek: null,
    season: '2026',
    scoring: 'PPR',
    week: null,
    lastUpdated: '2026-09-11T12:00:00.000Z',
    ...overrides,
  };
}
