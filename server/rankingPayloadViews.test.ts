import { describe, expect, it } from 'vitest';
import { buildRankingDraftBuzzDetail, buildRankingProfileDetail, buildRankingsMetadata } from './rankingPayloadViews';
import type { RankingsBoard } from '../shared/types';

function createRankings(): RankingsBoard {
  const dynastyRow = {
    id: 'dynasty_sf_ppr:one',
    player_id: '1',
    name: 'Player One',
    pos: 'QB',
    team: 'BUF',
    overallRank: 1,
    value: 9000,
    sources: ['KTC'],
    sourceCount: 1,
  };
  const devyRow = {
    id: 'devy_sf_ppr:future',
    name: 'Future Star',
    pos: 'WR',
    overallRank: 1,
    value: 8000,
    sources: ['NFL Draft Buzz'],
    sourceCount: 1,
    isDevy: true,
  };
  return {
    generatedAt: '2026-05-15T12:00:00.000Z',
    selectedProfileKey: 'dynasty_sf_ppr',
    selectedProfileLabel: '12 Team SF PPR',
    defaultProfileKey: 'dynasty_sf_ppr',
    defaultDevyProfileKey: 'devy_sf_ppr',
    profileOptions: [
      { key: 'dynasty_sf_ppr', label: 'Dynasty SF', board: 'dynasty', qbFormat: 'sf', tep: 0, ppr: 1 },
      { key: 'devy_sf_ppr', label: 'Devy SF', board: 'devy', qbFormat: 'sf', tep: 0, ppr: 1 },
    ],
    sourceWeightProfiles: {},
    profiles: {
      dynasty_sf_ppr: [dynastyRow],
      devy_sf_ppr: [devyRow],
    },
    identityDiagnostics: [],
    dynastySourceDiagnostics: [],
    redraftSourceDiagnostics: [],
    devySourceDiagnostics: [],
    draftBuzzScoreboard: [{
      id: 'future-star',
      draftYear: 2027,
      name: 'Future Star',
      position: 'WR',
      college: 'Ohio State',
      rating: 92,
      summary: 'Full scouting summary stays behind the detail endpoint.',
      prospectProfile: {
        source: 'NFL Draft Buzz',
        draftYear: 2027,
        name: 'Future Star',
        position: 'WR',
        college: 'Ohio State',
        summary: 'Full scouting summary stays behind the detail endpoint.',
      },
    }],
    dynastySf: [dynastyRow],
    dynastyOneQb: [],
    devySf: [devyRow],
    devyOneQb: [],
  };
}

describe('ranking payload views', () => {
  it('builds metadata without profile rows or prospect archive entries', () => {
    const metadata = buildRankingsMetadata(createRankings());

    expect(metadata.payloadMode).toBe('metadata');
    expect(metadata.profileRowCounts).toEqual({
      dynasty_sf_ppr: 1,
      devy_sf_ppr: 1,
    });
    expect(metadata.draftBuzzScoreboardCount).toBe(1);
    expect(metadata.profiles).toEqual({});
    expect(metadata.dynastySf).toEqual([]);
    expect(metadata.devySf).toEqual([]);
    expect(metadata.draftBuzzScoreboard).toEqual([]);
    expect(JSON.stringify(metadata)).not.toContain('Full scouting summary');
  });

  it('returns one ranking profile detail at a time', () => {
    const detail = buildRankingProfileDetail(createRankings(), 'devy_sf_ppr');

    expect(detail).toMatchObject({
      profileKey: 'devy_sf_ppr',
      rowCount: 1,
    });
    expect(detail.rows[0]).toMatchObject({
      id: 'devy_sf_ppr:future',
      name: 'Future Star',
    });
  });

  it('keeps prospect archive detail behind its own payload', () => {
    const detail = buildRankingDraftBuzzDetail(createRankings());

    expect(detail.rowCount).toBe(1);
    expect(detail.entries[0].prospectProfile.summary).toContain('Full scouting summary');
  });
});
