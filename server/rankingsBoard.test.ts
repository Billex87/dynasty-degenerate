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

vi.mock('./redraftRankings', () => ({
  formatRedraftSourceWeights: vi.fn(() => 'FantasyPros 28%, Internal Season Blend 18%, MyFantasyLeague ADP 16%'),
  getRedraftSourceWeightEntries: vi.fn(() => [
    { key: 'fantasyPros', source: 'FantasyPros', weight: 0.28, percent: 28, note: 'Current-season ECR.' },
    { key: 'internalSeasonBlend', source: 'Internal Season Blend', weight: 0.18, percent: 18, note: 'Existing redraft blend.' },
  ]),
  loadRedraftRankingProfiles: vi.fn(async () => ({
    profiles: {
      redraft_ppr: {},
      redraft_half_ppr: {},
      redraft_standard: {},
    },
    diagnostics: [],
  })),
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

  it('keeps redraft profile rows separate from dynasty profile rows', async () => {
    const { loadRedraftRankingProfiles } = await import('./redraftRankings');
    vi.mocked(loadRedraftRankingProfiles).mockResolvedValueOnce({
      profiles: {
        redraft_ppr: {
          christianmccaffrey: {
            name: 'Christian McCaffrey',
            position: 'RB',
            team: 'SF',
            overallRank: 1,
            positionRank: 'RB1',
            value: 8800,
            adp: 2.4,
            fantasyProsSeasonValue: 8700,
            fantasyCalcRedraft: 8200,
            sources: ['FantasyPros', 'MyFantasyLeague ADP'],
            sourceRanks: { fantasyPros: 1, mflAdp: 2.4 },
            sourceValues: { fantasyPros: 8700, mflAdp: 8600 },
          },
        },
        redraft_half_ppr: {},
        redraft_standard: {},
      },
      diagnostics: [{
        key: 'mflAdp',
        source: 'MyFantasyLeague ADP',
        board: 'redraft',
        status: 'loaded',
        rowCount: 1,
        note: 'Loaded one test row.',
        error: null,
        loadedAt: '2026-05-11T00:00:00.000Z',
      }],
    });
    const { buildRankingsBoard } = await import('./rankingsBoard');

    const board = await buildRankingsBoard({
      players: {
        '4034': {
          full_name: 'Christian McCaffrey',
          first_name: 'Christian',
          last_name: 'McCaffrey',
          position: 'RB',
          team: 'SF',
          active: true,
        },
      },
      ktcValues: {
        christianmccaffrey: {
          name: 'Christian McCaffrey',
          ktc_value: 1200,
          redraft_value: 8200,
          position_rank: 'RB80',
          value_sources: ['KTC'],
        },
      },
      ownerByPlayerId: { '4034': 'Tester' },
      rosterStatusByPlayerId: { '4034': 'starter' },
      selectedProfileKey: 'redraft_ppr',
    });

    const redraftRow = board.redraftPpr?.find((row) => row.name === 'Christian McCaffrey');
    const dynastyRow = board.dynastySf.find((row) => row.name === 'Christian McCaffrey');

    expect(board.defaultRedraftProfileKey).toBe('redraft_ppr');
    expect(board.redraftSourceDiagnostics).toHaveLength(1);
    expect(redraftRow).toMatchObject({
      player_id: '4034',
      value: 8800,
      seasonValue: 8800,
      fantasyProsValue: 8700,
      redraftAveragePick: 2.4,
      sources: ['FantasyPros', 'MyFantasyLeague ADP'],
    });
    expect(dynastyRow?.value).toBe(1200);
  });

  it('builds college rows from NFL Draft Buzz without Sleeper players', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');
    const futureYear = new Date().getFullYear() + 1;
    const prospect: ProspectProfile = {
      source: 'NFL Draft Buzz',
      sourceUrl: `https://www.nfldraftbuzz.com/positions/WR/1/${futureYear}`,
      scrapeMonth: '2026-05',
      draftYear: futureYear,
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
      projectedRookiePick: `Projected ${futureYear} 1.01`,
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

  it('excludes current-year prospects from the college board', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');
    const currentYear = new Date().getFullYear();
    const futureYear = currentYear + 1;
    const currentYearProspect: ProspectProfile = {
      source: 'NFL Draft Buzz',
      sourceUrl: `https://www.nfldraftbuzz.com/positions/QB/1/${currentYear}`,
      scrapeMonth: `${currentYear}-05`,
      draftYear: currentYear,
      name: 'Current Year Prospect',
      position: 'QB',
      college: 'Test State',
      overallRank: 3,
      positionRank: 2,
      rating: 88,
    };
    const futureYearProspect: ProspectProfile = {
      source: 'NFL Draft Buzz',
      sourceUrl: `https://www.nfldraftbuzz.com/positions/QB/1/${futureYear}`,
      scrapeMonth: `${currentYear}-05`,
      draftYear: futureYear,
      name: 'Future Year Prospect',
      position: 'QB',
      college: 'Future State',
      overallRank: 4,
      positionRank: 3,
      rating: 87,
    };

    const board = await buildRankingsBoard({
      players: {},
      ktcValues: {},
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
      prospectLookup: buildProspectLookup([currentYearProspect, futureYearProspect]),
      prospectProfiles: [currentYearProspect, futureYearProspect],
      leagueTeamCount: 12,
    });

    const row = board.profiles?.devy_sf_ppr?.find((player) => player.name === 'Current Year Prospect');
    const futureRow = board.profiles?.devy_sf_ppr?.find((player) => player.name === 'Future Year Prospect');

    expect(row).toBeUndefined();
    expect(futureRow).toMatchObject({
      draftYear: futureYear,
      positionRank: 'QB1',
      projectedRookiePick: `Projected ${futureYear} 1.01`,
    });
    expect(board.draftBuzzScoreboard?.map((entry) => entry.name)).toEqual([
      'Current Year Prospect',
      'Future Year Prospect',
    ]);
  });

  it('uses the verified prospect draft class when ranking sources disagree', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');
    const { getCurrentKTCDevyRankingProfiles } = await import('./liveKTCScraper');
    const currentYear = new Date().getFullYear();
    const futureYear = currentYear + 1;
    const prospect: ProspectProfile = {
      source: 'NFL Draft Buzz',
      sourceUrl: `https://www.nfldraftbuzz.com/positions/QB/1/${futureYear}`,
      scrapeMonth: `${currentYear}-05`,
      draftYear: futureYear,
      name: 'Disputed Class Prospect',
      position: 'QB',
      college: 'Test State',
      overallRank: 7,
      positionRank: 4,
      rating: 84,
    };
    vi.mocked(getCurrentKTCDevyRankingProfiles).mockResolvedValueOnce({
      ...emptyKtcProfiles,
      sf_ppr: {
        disputedclassprospect: {
          name: 'Disputed Class Prospect',
          position: 'QB',
          rank: 10,
          ktc_value: 3200,
          draftYear: currentYear,
        },
      },
    });

    const board = await buildRankingsBoard({
      players: {},
      ktcValues: {},
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
      prospectLookup: buildProspectLookup([prospect]),
      leagueTeamCount: 12,
    });

    const row = board.profiles?.devy_sf_ppr?.find((player) => player.name === 'Disputed Class Prospect');

    expect(row).toMatchObject({
      draftYear: futureYear,
      projectedRookiePick: `Projected ${futureYear} 1.01`,
    });
  });
});
