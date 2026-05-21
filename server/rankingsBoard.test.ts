import { describe, expect, it, vi } from 'vitest';
import { buildProspectLookup } from './prospectSource';
import type { ProspectProfile } from '../shared/types';
import type { NflversePlayerContext } from './nflversePlayerContext';

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

  it('merges common first-name aliases across devy ranking sources', async () => {
    const { getCurrentKTCDevyRankingProfiles } = await import('./liveKTCScraper');
    const { loadFantasyProsDevyRankings } = await import('./fantasyProsDevy');
    const futureYear = new Date().getFullYear() + 1;

    vi.mocked(getCurrentKTCDevyRankingProfiles).mockResolvedValueOnce({
      ...emptyKtcProfiles,
      sf_ppr: {
        nicksingleton: {
          name: 'Nick Singleton',
          position: 'RB',
          position_rank: 'RB1',
          rank: 1,
          ktc_value: 6200,
          college: 'Penn State',
          draftYear: futureYear,
        },
      },
    });
    vi.mocked(loadFantasyProsDevyRankings).mockResolvedValueOnce({
      nicholassingleton: {
        name: 'Nicholas Singleton',
        position: 'RB',
        positionRank: 'RB2',
        rank: 2,
        age: 21,
        sourceUrl: 'https://www.fantasypros.com/nfl/rankings/devy-overall.php',
      },
    });
    const { buildRankingsBoard } = await import('./rankingsBoard');

    const board = await buildRankingsBoard({
      players: {},
      ktcValues: {},
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
    });
    const singletonRows = board.devySf.filter((row) => /singleton/i.test(row.name));

    expect(singletonRows).toHaveLength(1);
    expect(singletonRows[0]).toMatchObject({
      name: 'Nick Singleton',
      pos: 'RB',
    });
    expect(singletonRows[0]?.sources).toEqual(expect.arrayContaining(['KTC', 'FantasyPros']));
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

  it('includes stored FantasyPros dynasty rows in admin source diagnostics', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');

    const board = await buildRankingsBoard({
      players: {
        '4984': {
          full_name: 'Josh Allen',
          first_name: 'Josh',
          last_name: 'Allen',
          position: 'QB',
          team: 'BUF',
          active: true,
        },
      },
      ktcValues: {
        joshallen: {
          name: 'Josh Allen',
          ktc_value: 9400,
          market_value_ktc: 9300,
          expert_value_fantasypros: 9450,
          fantasypros_dynasty_rank: 1,
          fantasypros_dynasty_position_rank: 'QB1',
          value_sources: ['KTC', 'FantasyPros'],
        },
      },
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
      selectedProfileKey: 'dynasty_sf_ppr',
    });

    expect(board.dynastySourceDiagnostics?.find((row) => row.key === 'fantasyPros')).toMatchObject({
      source: 'FantasyPros Dynasty',
      status: 'loaded',
      rowCount: 1,
    });
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
    const nflversePlayerContext: NflversePlayerContext = {
      usageByGsisId: {},
      teamEnvironmentByTeam: {},
      rosterRoomByTeamPosition: {},
      injuryByGsisId: {},
      athleticByPfrId: {},
      athleticByNamePosition: {
        'jeremiahsmith:WR': [{
          source: 'nflverse combine',
          playerName: 'Jeremiah Smith',
          position: 'WR',
          draftYear: futureYear,
          height: '6-3',
          weight: 223,
          forty: 4.32,
          bench: 18,
          vertical: 41,
          broadJump: 132,
          cone: 6.82,
          shuttle: 4.12,
          speedScore: 118.4,
          note: 'Combine profile loaded with 118.4 speed score.',
        }],
      },
      contractByName: {},
      rowCounts: [],
    };

    const board = await buildRankingsBoard({
      players: {},
      ktcValues: {},
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
      prospectLookup: buildProspectLookup([prospect]),
      prospectProfiles: [prospect],
      leagueTeamCount: 12,
      nflversePlayerContext,
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
    expect(row?.athleticProfile).toMatchObject({
      draftYear: futureYear,
      forty: 4.32,
      bench: 18,
      vertical: 41,
      broadJump: 132,
      cone: 6.82,
      shuttle: 4.12,
    });
    expect(board.draftBuzzScoreboard?.find((entry) => entry.name === 'Jeremiah Smith')?.athleticProfile).toMatchObject({
      vertical: 41,
      broadJump: 132,
    });
  });

  it('preserves devy source ranks separately from the final board rank', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');
    const { loadFantasyProsDevyRankings } = await import('./fantasyProsDevy');
    const futureYear = new Date().getFullYear() + 1;
    const prospects: ProspectProfile[] = [
      {
        source: 'NFL Draft Buzz',
        sourceUrl: `https://www.nfldraftbuzz.com/positions/WR/1/${futureYear}`,
        scrapeMonth: '2026-05',
        draftYear: futureYear,
        name: 'Board Leader Prospect',
        position: 'WR',
        college: 'Board State',
        overallRank: 1,
        positionRank: 5,
        rating: 97,
      },
      {
        source: 'NFL Draft Buzz',
        sourceUrl: `https://www.nfldraftbuzz.com/positions/WR/2/${futureYear}`,
        scrapeMonth: '2026-05',
        draftYear: futureYear,
        name: 'Position Leader Prospect',
        position: 'WR',
        college: 'Position State',
        overallRank: 5,
        positionRank: 1,
        rating: 91,
      },
    ];

    vi.mocked(loadFantasyProsDevyRankings).mockResolvedValueOnce({
      boardleaderprospect: {
        name: 'Board Leader Prospect',
        rank: 1,
        positionRank: 'WR5',
        position: 'WR',
        age: 20,
        bestRank: 1,
        worstRank: 5,
        averageRank: 2,
        stdDev: 1,
        sourceUrl: 'https://www.fantasypros.com/nfl/rankings/devy-overall.php',
      },
      positionleaderprospect: {
        name: 'Position Leader Prospect',
        rank: 5,
        positionRank: 'WR1',
        position: 'WR',
        age: 20,
        bestRank: 2,
        worstRank: 7,
        averageRank: 4,
        stdDev: 1,
        sourceUrl: 'https://www.fantasypros.com/nfl/rankings/devy-overall.php',
      },
    });

    const board = await buildRankingsBoard({
      players: {},
      ktcValues: {},
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
      prospectLookup: buildProspectLookup(prospects),
      prospectProfiles: prospects,
      leagueTeamCount: 12,
    });

    const boardLeader = board.profiles?.devy_sf_ppr?.find((player) => player.name === 'Board Leader Prospect');
    const positionLeader = board.profiles?.devy_sf_ppr?.find((player) => player.name === 'Position Leader Prospect');

    expect(boardLeader).toMatchObject({
      sourceOverallRank: 1,
      sourcePositionRank: 'WR5',
      overallRank: 1,
      positionRank: 'WR1',
    });
    expect(positionLeader).toMatchObject({
      sourceOverallRank: 5,
      sourcePositionRank: 'WR1',
      overallRank: 2,
      positionRank: 'WR2',
    });
  });

  it('keeps devy prospect ranks out of dynasty value rows', async () => {
    const { buildRankingsBoard } = await import('./rankingsBoard');
    const futureYear = new Date().getFullYear() + 1;
    const prospect: ProspectProfile = {
      source: 'NFL Draft Buzz',
      sourceUrl: `https://www.nfldraftbuzz.com/positions/WR/1/${futureYear}`,
      scrapeMonth: '2026-05',
      draftYear: futureYear,
      name: 'Dynasty Prospect',
      position: 'WR',
      college: 'Dynasty State',
      overallRank: 1,
      positionRank: 1,
      rating: 90,
    };

    const board = await buildRankingsBoard({
      players: {
        '9999': {
          full_name: 'Dynasty Prospect',
          first_name: 'Dynasty',
          last_name: 'Prospect',
          position: 'WR',
          team: 'NYG',
          active: true,
        },
      },
      ktcValues: {
        dynastyprospect: {
          name: 'Dynasty Prospect',
          ktc_value: 1700,
          rank: 25,
          position_rank: 'WR12',
          value_sources: ['KTC'],
        },
      },
      ownerByPlayerId: {},
      rosterStatusByPlayerId: {},
      prospectLookup: buildProspectLookup([prospect]),
    });

    const dynastyRow = board.dynastySf.find((player) => player.name === 'Dynasty Prospect');

    expect(dynastyRow).toMatchObject({
      sourceOverallRank: 25,
      sourcePositionRank: 'WR12',
    });
    expect(dynastyRow?.sourceOverallRank).not.toBe(1);
    expect(dynastyRow?.sourcePositionRank).not.toBe('WR1');
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
