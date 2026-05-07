import { describe, expect, it, vi } from 'vitest';
import { buildProspectLookup } from './prospectSource';
import type { ProspectProfile } from '../shared/types';

const emptyKtcProfiles = {
  sf_ppr: {},
  sf_ppr_tep_0_5: {},
  sf_ppr_tep_1_0: {},
  sf_ppr_tep_1_5: {},
  one_qb_ppr: {},
  one_qb_ppr_tep_0_5: {},
  one_qb_ppr_tep_1_0: {},
  one_qb_ppr_tep_1_5: {},
};

vi.mock('./liveKTCScraper', () => ({
  getCurrentKTCDevyRankingProfiles: vi.fn(async () => emptyKtcProfiles),
}));

vi.mock('./flockFantasy', () => ({
  loadFlockFantasyValueProfiles: vi.fn(async () => ({
    SUPERFLEX: {},
    ONEQB: {},
    PROSPECTS_SF: {},
    PROSPECTS: {},
  })),
}));

vi.mock('./dynastyNerds', () => ({
  getDynastyNerdsFormat: vi.fn(() => 'PPR'),
  loadDynastyNerdsValueProfiles: vi.fn(async () => ({ PPR: {} })),
}));

vi.mock('./fantasyProsDevy', () => ({
  loadFantasyProsDevyRankings: vi.fn(async () => ({})),
}));

describe('rankings board prospect fallback', () => {
  it('builds college rows from NFL Draft Buzz without Sleeper players', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');
    const prospect: ProspectProfile = {
      source: 'NFL Draft Buzz',
      sourceUrl: 'https://www.nfldraftbuzz.com/positions/WR/1/2027',
      scrapeMonth: '2026-05',
      draftYear: 2027,
      name: 'Jeremiah Smith',
      position: 'WR',
      role: 'Alpha',
      college: 'Ohio State',
      playerImageUrl: 'https://www.nfldraftbuzz.com/Content/PlayerHeadShots/Jeremiah-Smith-WR-OhioState.png',
      collegeLogoUrl: 'https://www.nfldraftbuzz.com/Content/collmascots/ohio-state-buckeyes.png',
      overallRank: 1,
      positionRank: 1,
      rating: 94,
      height: '6-3',
      weight: '223lbs',
      fortyYardDash: 4.32,
      summary: 'High-end receiving prospect.',
    };

    const board = await buildRankingsBoard({
      players: {},
      ktcValues: {},
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
      prospectLookup: buildProspectLookup([prospect]),
      leagueTeamCount: 12,
    });

    const row = board.profiles?.devy_sf_ppr?.find((player) => player.name === 'Jeremiah Smith');

    expect(row).toMatchObject({
      player_id: undefined,
      name: 'Jeremiah Smith',
      pos: 'WR',
      college: 'Ohio State',
      collegeLogoUrl: prospect.collegeLogoUrl,
      imageUrl: prospect.playerImageUrl,
      overallRank: 1,
      positionRank: 'WR1',
      isDevy: true,
      sources: ['NFL Draft Buzz'],
      projectedRookiePick: 'Projected 2027 1.01',
    });
    expect(row?.prospectProfile).toMatchObject({
      source: 'NFL Draft Buzz',
      rating: 94,
      height: '6-3',
      weight: '223lbs',
      fortyYardDash: 4.32,
      summary: 'High-end receiving prospect.',
    });
  });
});
