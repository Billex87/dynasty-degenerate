import { describe, expect, it } from 'vitest';
import { buildFantasyProsPlayerSourceTrace } from './fantasyProsPlayerSourceTrace';

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
});
