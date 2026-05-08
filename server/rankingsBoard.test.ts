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
  it('does not emit Sleeper identity diagnostics for rookie pick rows', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');

    const board = await buildRankingsBoard({
      players: {},
      ktcValues: {
        '2026pick101': {
          name: '2026 Pick 1.01',
          ktc_value: 5000,
          value_sources: ['KTC'],
        },
      },
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
    });

    expect(board.identityDiagnostics?.filter((row) => row.status === 'unmatched')).toEqual([]);
    expect(board.dynastySf.find((row) => row.name === '2026 Pick 1.01')).toMatchObject({
      isPick: true,
      player_id: undefined,
    });
  });

  it('maps curated source aliases to Sleeper player identities', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');

    const board = await buildRankingsBoard({
      players: {
        '6943': {
          full_name: 'Gabe Davis',
          first_name: 'Gabe',
          last_name: 'Davis',
          position: 'WR',
          active: true,
        },
        '5848': {
          full_name: 'Marquise Brown',
          first_name: 'Marquise',
          last_name: 'Brown',
          position: 'WR',
          active: true,
        },
        '13333': {
          full_name: 'Deion Burks',
          first_name: 'Deion',
          last_name: 'Burks',
          position: 'WR',
          active: true,
        },
      },
      ktcValues: {
        gabrieldavis: {
          name: 'Gabriel Davis',
          ktc_value: 1100,
          position_rank: 'WR90',
          value_sources: ['KTC'],
        },
        hollywoodbrown: {
          name: 'Hollywood Brown',
          ktc_value: 900,
          position_rank: 'WR100',
          value_sources: ['KTC'],
        },
        deionburksduplicate: {
          name: 'Deion Burks (Duplicate)',
          ktc_value: 700,
          position_rank: 'WR120',
          value_sources: ['KTC'],
        },
      },
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
    });

    expect(board.identityDiagnostics?.filter((row) => row.status === 'unmatched')).toEqual([]);
    expect(board.dynastySf.find((row) => row.name === 'Gabriel Davis')?.player_id).toBe('6943');
    expect(board.dynastySf.find((row) => row.name === 'Hollywood Brown')?.player_id).toBe('5848');
    expect(board.dynastySf.find((row) => row.name === 'Deion Burks')?.player_id).toBe('13333');
  });

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

  it('preserves the source draft class for current-year college prospects', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');
    const currentYear = new Date().getFullYear();
    const prospect: ProspectProfile = {
      source: 'NFL Draft Buzz',
      sourceUrl: `https://www.nfldraftbuzz.com/positions/QB/1/${currentYear}`,
      scrapeMonth: `${currentYear}-05`,
      draftYear: currentYear,
      name: 'Current Year Prospect',
      position: 'QB',
      college: 'Test State',
      overallRank: 3,
      positionRank: 2,
    };

    const board = await buildRankingsBoard({
      players: {},
      ktcValues: {},
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
      prospectLookup: buildProspectLookup([prospect]),
      leagueTeamCount: 12,
    });

    const row = board.profiles?.devy_sf_ppr?.find((player) => player.name === 'Current Year Prospect');

    expect(row).toMatchObject({
      draftYear: currentYear,
      positionRank: 'QB1',
      projectedRookiePick: `Projected ${currentYear} 1.01`,
    });
    expect(row?.prospectProfile?.draftYear).toBe(currentYear);
  });
});
