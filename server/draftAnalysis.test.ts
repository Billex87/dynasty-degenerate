import { afterEach, describe, it, expect, vi } from 'vitest';
import { analyzeDraftPicks, calculateADPFromPicks, fetchDraftData } from './draftAnalysis';
import * as nflHeadshotFetcher from './nflHeadshotFetcher';
import { getRookieValueBaseline, getRookieValueBaselineMetadata } from './rookieValueBaselines';

// Mock the NFL headshot fetcher to avoid actual HTTP requests
vi.mock('./nflHeadshotFetcher', () => ({
  fetchNFLHeadshot: vi.fn().mockResolvedValue('https://example.com/headshot.jpg'),
}));

describe('Draft Analysis', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('loads the locked 2025 rookie value snapshot with source metadata', () => {
    const baseline = getRookieValueBaseline('2025');
    const metadata = getRookieValueBaselineMetadata('2025');
    const emeka =
      baseline?.['emeka-egbuka-1781'] ||
      Object.values(baseline || {}).find((record) => record.name === 'Emeka Egbuka');

    expect(metadata?.label).toBe('2025 Rookie Draft-Window Values');
    expect(metadata?.comparisonMode).toBe('value-to-value');
    expect(metadata?.sourceCoverage?.map((source) => source.source)).toEqual(
      expect.arrayContaining(['KTC', 'DynastyProcess', 'FantasyCalc', 'FantasyPros'])
    );
    expect(emeka?.market_value_ktc).toBe(4881);
    expect(emeka?.expert_value_dynastyprocess).toBe(1719);
    expect(emeka?.ktc_value).toBe(3908);
  });

  it('should analyze draft picks correctly', async () => {
    const mockDraftPicks = [
      {
        round: 1,
        pick_no: 1,
        player_id: 'player1',
        picked_by: 'roster1',
        user_id_to_manager_map: { 'roster1': 'Manager A', 'roster2': 'Manager B' },
      },
      {
        round: 1,
        pick_no: 2,
        player_id: 'player2',
        picked_by: 'roster2',
        user_id_to_manager_map: { 'roster1': 'Manager A', 'roster2': 'Manager B' },
      },
    ] as any;

    const mockPlayers = {
      player1: { full_name: 'Player One', position: 'QB' },
      player2: { full_name: 'Player Two', position: 'RB' },
    };

    const mockRosterMap = {
      roster1: 'Manager A',
      roster2: 'Manager B',
    };

    const mockKtcValues = {
      playerone: { name: 'Player One', ktc_value: 1000 },
      playertwo: { name: 'Player Two', ktc_value: 800 },
    };

    const mockAdpData = {
      player1: { name: 'Player One', pos: 'QB', adp: 5 },
      player2: { name: 'Player Two', pos: 'RB', adp: 1 },
    };

    const result = await analyzeDraftPicks(
      mockDraftPicks,
      mockPlayers,
      mockRosterMap,
      mockKtcValues,
      mockAdpData
    );

    expect(result.draftPicks).toHaveLength(2);
    expect(result.draftStats).toHaveLength(2);

    // Check first pick
    expect(result.draftPicks[0]).toMatchObject({
      round: 1,
      pick: 1,
      playerName: 'Player One',
      playerPos: 'QB',
      manager: 'Manager A',
      adp: 5,
      currentKtcValue: 1000,
    });

    // Check manager stats
    const managerAStats = result.draftStats.find((s) => s.manager === 'Manager A');
    expect(managerAStats).toBeDefined();
    expect(managerAStats?.totalPicks).toBe(1);
    // Note: hits/misses are based on position rank change or value gain, not ADP
    expect(managerAStats?.hits).toBeDefined();
    expect(managerAStats?.misses).toBeDefined();
  });

  it('keeps dynasty draft capital efficiency scoped to rookie drafts', async () => {
    const result = await analyzeDraftPicks(
      [
        {
          round: 1,
          pick_no: 1,
          player_id: 'rookie1',
          picked_by: 'roster1',
          season: '2026',
          draft_id: 'rookie-draft',
          draft_pick_count: 36,
          user_id_to_manager_map: { roster1: 'Manager A' },
        },
        {
          round: 1,
          pick_no: 1,
          player_id: 'startup1',
          picked_by: 'roster1',
          season: '2026',
          draft_id: 'startup-draft',
          draft_pick_count: 120,
          user_id_to_manager_map: { roster1: 'Manager A' },
        },
      ] as any,
      {
        rookie1: { full_name: 'Rookie One', position: 'WR' },
        startup1: { full_name: 'Startup One', position: 'QB' },
      },
      { roster1: 'Manager A' },
      {
        rookieone: { name: 'Rookie One', ktc_value: 3000, position_rank: 'WR30' },
        startupone: { name: 'Startup One', ktc_value: 9000, position_rank: 'QB2' },
      },
      {},
      undefined,
      { rookieone: { name: 'Rookie One', ktc_value: 2000, position_rank_may2025: 'WR45' } },
      { rookieone: { name: 'Rookie One', ktc_value: 3000, position_rank: 'WR30' } },
      undefined,
      {},
      { leagueValueMode: 'dynasty' }
    );

    expect(result.draftPicks.map((pick) => pick.draftKind)).toEqual(['rookie', 'startup']);
    expect(result.draftStats[0]).toMatchObject({
      manager: 'Manager A',
      totalPicks: 1,
      avgKtcGain: 1000,
      bestPick: expect.objectContaining({ playerName: 'Rookie One' }),
      worstPick: expect.objectContaining({ playerName: 'Rookie One' }),
    });
  });

  it('should calculate ADP differences correctly', async () => {
    const mockDraftPicks = [
      {
        round: 1,
        pick_no: 10,
        player_id: 'player1',
        picked_by: 'roster1',
        user_id_to_manager_map: { 'roster1': 'Manager A' },
      },
    ] as any;

    const mockPlayers = {
      player1: { full_name: 'Player One', position: 'WR' },
    };

    const mockRosterMap = {
      roster1: 'Manager A',
    };

    const mockKtcValues = {
      playerone: { name: 'Player One', ktc_value: 500 },
    };

    const mockAdpData = {
      player1: { name: 'Player One', pos: 'WR', adp: 5 },
    };

    const result = await analyzeDraftPicks(
      mockDraftPicks,
      mockPlayers,
      mockRosterMap,
      mockKtcValues,
      mockAdpData
    );

    const managerStats = result.draftStats[0];
    expect(managerStats.avgAdpDiff).toBe(5); // Picked at 10, ADP was 5 (positive = reach)
    // Note: hits/misses are based on position rank change or value gain, not ADP
    expect(managerStats.hits).toBeDefined();
    expect(managerStats.misses).toBeDefined();
  });

  it('keeps the original pick owner when a traded draft slot is selected by another manager', async () => {
    const result = await analyzeDraftPicks(
      [
        {
          round: 3,
          pick_no: 28,
          draft_slot: 8,
          player_id: 'downs',
          picked_by: 'user9',
          roster_id: 9,
          original_roster_id: 1,
          season: '2026',
          roster_map: { 1: 'AwwQQ', 9: 'Beaston' },
          user_id_to_manager_map: { user9: 'Beaston' },
        },
      ] as any,
      {
        downs: { full_name: 'Josh Downs', position: 'WR' },
      },
      { 1: 'AwwQQ', 9: 'Beaston' },
      { joshdowns: { name: 'Josh Downs', ktc_value: 3200, position_rank: 'WR45' } },
      { downs: { name: 'Josh Downs', adp: 28 } }
    );

    expect(result.draftPicks[0]).toMatchObject({
      manager: 'Beaston',
      originalOwner: 'AwwQQ',
      originalRosterId: 1,
      draftSlot: 8,
    });
  });

  it('uses the current roster-slot owner when historical draft data has an old user', async () => {
    const result = await analyzeDraftPicks(
      [
        {
          round: 1,
          pick_no: 3,
          draft_slot: 3,
          player_id: 'london',
          picked_by: 'old-user',
          roster_id: 3,
          original_roster_id: 3,
          season: '2025',
          roster_map: { 3: 'NewManager' },
          roster_display_map: { 3: 'New Manager' },
          user_id_to_manager_map: { 'old-user': 'OldManager' },
          user_id_to_manager_display_map: { 'old-user': 'Old Manager' },
        },
      ] as any,
      {
        london: { full_name: 'Drake London', position: 'WR' },
      },
      { 3: 'NewManager' },
      { drakelondon: { name: 'Drake London', ktc_value: 8500, position_rank: 'WR5' } },
      { london: { name: 'Drake London', adp: 3 } }
    );

    expect(result.draftPicks[0]).toMatchObject({
      manager: 'NewManager',
      managerDisplayName: 'New Manager',
      originalOwner: 'NewManager',
      originalRosterId: 3,
    });
    expect(result.draftStats.map((row) => row.manager)).toEqual(['NewManager']);
  });

  it('carries full manager display names for draft UI without changing manager keys', async () => {
    const result = await analyzeDraftPicks(
      [
        {
          round: 1,
          pick_no: 4,
          player_id: 'player1',
          picked_by: 'user1',
          roster_map: { 1: 'PurpleHaze' },
          roster_display_map: { 1: 'PurpleHaze89' },
          user_id_to_manager_map: { user1: 'PurpleHaze' },
          user_id_to_manager_display_map: { user1: 'PurpleHaze89' },
        },
      ] as any,
      {
        player1: { full_name: 'Player One', position: 'RB' },
      },
      { 1: 'PurpleHaze' },
      { playerone: { name: 'Player One', ktc_value: 1000 } },
      { player1: { name: 'Player One', adp: 4 } },
      undefined,
      undefined,
      undefined,
      undefined,
      { PurpleHaze: 'PurpleHaze89' }
    );

    expect(result.draftPicks[0]).toMatchObject({
      manager: 'PurpleHaze',
      managerDisplayName: 'PurpleHaze89',
    });
    expect(result.draftStats[0]).toMatchObject({
      manager: 'PurpleHaze',
      managerDisplayName: 'PurpleHaze89',
    });
  });

  it('should keep draft value separate from current value', async () => {
    const mockDraftPicks = [
      {
        round: 1,
        pick_no: 10,
        player_id: 'player1',
        picked_by: 'roster1',
        user_id_to_manager_map: { roster1: 'Manager A' },
      },
    ] as any;

    const mockPlayers = {
      player1: { full_name: 'Emeka Egbuka', position: 'WR' },
    };

    const result = await analyzeDraftPicks(
      mockDraftPicks,
      mockPlayers,
      { roster1: 'Manager A' },
      { emekaegbuka: { name: 'Emeka Egbuka', ktc_value: 6117 } },
      { player1: { name: 'Emeka Egbuka', pos: 'WR', adp: 10 } },
      undefined,
      { emekaegbuka: { name: 'Emeka Egbuka', ktc_value: 4881, position_rank_may2025: 'WR21' } }
    );

    expect(result.draftPicks[0].ktcValue).toBe(4881);
    expect(result.draftPicks[0].currentKtcValue).toBe(6117);
    expect(result.draftPicks[0].valueGain).toBe(1236);
  });

  it('should use the matching draft-year rookie baseline when available', async () => {
    const mockDraftPicks = [
      {
        round: 1,
        pick_no: 10,
        player_id: 'player1',
        picked_by: 'roster1',
        season: '2026',
        user_id_to_manager_map: { roster1: 'Manager A' },
      },
    ] as any;

    const mockPlayers = {
      player1: { full_name: 'Emeka Egbuka', position: 'WR' },
    };

    const result = await analyzeDraftPicks(
      mockDraftPicks,
      mockPlayers,
      { roster1: 'Manager A' },
      { emekaegbuka: { name: 'Emeka Egbuka', ktc_value: 6117 } },
      { player1: { name: 'Emeka Egbuka', pos: 'WR', adp: 10 } },
      undefined,
      { emekaegbuka: { name: 'Emeka Egbuka', ktc_value: 4881, position_rank_may2025: 'WR21' } },
      { emekaegbuka: { name: 'Emeka Egbuka', ktc_value: 6117, position_rank: 'WR10' } },
      {
        '2026': {
          emekaegbuka: { name: 'Emeka Egbuka', ktc_value: 5500, position_rank: 'WR13' },
        },
      }
    );

    expect(result.draftPicks[0].draftYear).toBe('2026');
    expect(result.draftPicks[0].ktcValue).toBe(5500);
    expect(result.draftPicks[0].currentKtcValue).toBe(6117);
    expect(result.draftPicks[0].valueGain).toBe(617);
    expect(result.draftPicks[0].positionRankMay2025).toBe('WR13');
    expect(result.draftPicks[0].positionRankChange).toBe('+3');
  });

  it('keeps current-year rookie picks neutral before the season evaluation window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T12:00:00-07:00'));

    const result = await analyzeDraftPicks(
      [
        {
          round: 1,
          pick_no: 10,
          player_id: 'player1',
          picked_by: 'roster1',
          season: '2026',
          user_id_to_manager_map: { roster1: 'Manager A' },
        },
      ] as any,
      {
        player1: { full_name: 'Rookie Rocket', position: 'WR' },
      },
      { roster1: 'Manager A' },
      { rookierocket: { name: 'Rookie Rocket', ktc_value: 5200, position_rank: 'WR12' } },
      { player1: { name: 'Rookie Rocket', pos: 'WR', adp: 10 } },
      undefined,
      undefined,
      { rookierocket: { name: 'Rookie Rocket', ktc_value: 5200, position_rank: 'WR12' } },
      {
        '2026': {
          rookierocket: { name: 'Rookie Rocket', ktc_value: 2500, position_rank: 'WR45' },
        },
      }
    );

    expect(result.draftPicks[0]).toMatchObject({
      draftKind: 'rookie',
      valueGain: 2700,
      positionRankChange: '+33',
      draftOutcome: 'neutral',
    });
    expect(result.draftStats[0]).toMatchObject({
      hits: 0,
      misses: 0,
    });
  });

  it('allows current-year rookie hit and miss labels after the season evaluation window opens', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00-07:00'));

    const result = await analyzeDraftPicks(
      [
        {
          round: 1,
          pick_no: 10,
          player_id: 'player1',
          picked_by: 'roster1',
          season: '2026',
          user_id_to_manager_map: { roster1: 'Manager A' },
        },
      ] as any,
      {
        player1: { full_name: 'Rookie Rocket', position: 'WR' },
      },
      { roster1: 'Manager A' },
      { rookierocket: { name: 'Rookie Rocket', ktc_value: 5200, position_rank: 'WR12' } },
      { player1: { name: 'Rookie Rocket', pos: 'WR', adp: 10 } },
      undefined,
      undefined,
      { rookierocket: { name: 'Rookie Rocket', ktc_value: 5200, position_rank: 'WR12' } },
      {
        '2026': {
          rookierocket: { name: 'Rookie Rocket', ktc_value: 2500, position_rank: 'WR45' },
        },
      }
    );

    expect(result.draftPicks[0]).toMatchObject({
      draftKind: 'rookie',
      valueGain: 2700,
      positionRankChange: '+33',
      draftOutcome: 'hit',
    });
    expect(result.draftStats[0]).toMatchObject({
      hits: 1,
      misses: 0,
    });
  });

  it('should prefer historical draft-year baseline values when available', async () => {
    const mockDraftPicks = [
      {
        round: 1,
        pick_no: 10,
        player_id: 'player1',
        picked_by: 'roster1',
        season: '2025',
        user_id_to_manager_map: { roster1: 'Manager A' },
      },
    ] as any;

    const mockPlayers = {
      player1: { full_name: 'Emeka Egbuka', position: 'WR' },
    };

    const result = await analyzeDraftPicks(
      mockDraftPicks,
      mockPlayers,
      { roster1: 'Manager A' },
      {
        emekaegbuka: {
          name: 'Emeka Egbuka',
          ktc_value: 5165,
          market_value_ktc: 6150,
          expert_value_dynastyprocess: 4082,
          value_sources: ['KTC', 'DynastyProcess'],
        },
      },
      { player1: { name: 'Emeka Egbuka', pos: 'WR', adp: 10 } },
      undefined,
      undefined,
      { emekaegbuka: { name: 'Emeka Egbuka', ktc_value: 5148, position_rank: 'WR14' } },
      {
        '2025': {
          emekaegbuka: {
            name: 'Emeka Egbuka',
            ktc_value: 3908,
            dynasty_value: 3908,
            market_value_ktc: 4881,
            expert_value_dynastyprocess: 1719,
            position_rank_may2025: 'WR21',
          },
        },
      }
    );

    expect(result.draftPicks[0].ktcValue).toBe(4222);
    expect(result.draftPicks[0].currentKtcValue).toBe(5719);
    expect(result.draftPicks[0].valueGain).toBe(1497);
    expect(result.draftPicks[0].positionRankMay2025).toBe('WR21');
    expect(result.draftPicks[0].positionRankChange).toBe('+7');
  });

  it('includes full main drafts for dynasty and redraft leagues while preserving the keeper rookie draft filter', async () => {
    const mainDraftPicks = Array.from({ length: 120 }, (_, index) => ({
      round: Math.floor(index / 12) + 1,
      pick_no: index + 1,
      draft_slot: (index % 12) + 1,
      player_id: `player${index + 1}`,
      picked_by: 'user1',
      roster_id: 1,
      is_keeper: null,
      metadata: {},
      reactions: null,
    }));

    const fetchMock = vi.fn(async (url: string) => ({
      json: async () => {
        if (url.endsWith('/league/league1/drafts')) {
          return [{
            draft_id: 'main-draft',
            season: '2026',
            type: 'snake',
            status: 'complete',
            created: 1787600000000,
            start_time: 1787603600000,
          }];
        }
        if (url.endsWith('/draft/main-draft/picks')) return mainDraftPicks;
        return [];
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const rosterMappingData = {
      currentRosterMap: { 1: 'Manager A' },
      currentRosters: [],
      currentUserMap: { user1: 'Manager A' },
      currentUserIdToManagerMap: { user1: 'Manager A' },
      pastRosterMap: {},
      pastRosters: [],
      pastUserMap: {},
    };

    await expect(fetchDraftData('league1', rosterMappingData)).resolves.toHaveLength(120);
    await expect(fetchDraftData('league1', rosterMappingData, { leagueValueMode: 'keeper' })).resolves.toHaveLength(0);

    const redraftPicks = await fetchDraftData('league1', rosterMappingData, { leagueValueMode: 'redraft' });
    expect(redraftPicks).toHaveLength(120);
    expect(redraftPicks[0]).toMatchObject({
      draft_id: 'main-draft',
      draft_type: 'snake',
      draft_created: 1787600000000,
      draft_start_time: 1787603600000,
      draft_pick_count: 120,
      season: '2026',
    });
  });

  it('keeps draft ADP scoped to the Sleeper season', () => {
    const adp = calculateADPFromPicks([
      { player_id: 'same-player', pick_no: 2, season: '2025' },
      { player_id: 'same-player', pick_no: 14, season: '2026' },
    ] as any);

    expect(adp['2025:same-player']?.adp).toBe(2);
    expect(adp['2026:same-player']?.adp).toBe(14);
    expect(adp['same-player']).toBeUndefined();
  });

  it('uses season-scoped redraft draft-day and regular-season-end values', async () => {
    const result = await analyzeDraftPicks(
      [
        {
          round: 1,
          pick_no: 1,
          player_id: 'player2025',
          picked_by: 'roster1',
          season: '2025',
          user_id_to_manager_map: { roster1: 'Manager A' },
        },
        {
          round: 1,
          pick_no: 1,
          player_id: 'player2026',
          picked_by: 'roster1',
          season: '2026',
          user_id_to_manager_map: { roster1: 'Manager A' },
        },
      ] as any,
      {
        player2025: { full_name: 'Season Runner', position: 'RB' },
        player2026: { full_name: 'Season Runner', position: 'RB' },
      },
      { roster1: 'Manager A' },
      { seasonrunner: { name: 'Season Runner', ktc_value: 900, redraft_value: 900, fantasypros_position_rank: 'RB8' } },
      {
        player2025: { name: 'Season Runner', adp: 1 },
        player2026: { name: 'Season Runner', adp: 1 },
      },
      undefined,
      undefined,
      undefined,
      undefined,
      {},
      {
        leagueValueMode: 'redraft',
        redraftValueWindowsBySeason: {
          '2025': {
            draftValues: { seasonrunner: { name: 'Season Runner', redraft_value: 1000, fantasypros_position_rank: 'RB2' } },
            currentValues: { seasonrunner: { name: 'Season Runner', redraft_value: 700, fantasypros_position_rank: 'RB12' } },
            draftValueDate: '2025-08-24',
            currentValueDate: '2025-12-10',
          },
          '2026': {
            draftValues: { seasonrunner: { name: 'Season Runner', redraft_value: 3000, fantasypros_position_rank: 'RB9' } },
            currentValues: { seasonrunner: { name: 'Season Runner', redraft_value: 3600, fantasypros_position_rank: 'RB5' } },
            draftValueDate: '2026-08-23',
            currentValueDate: '2026-12-09',
          },
        },
      }
    );

    expect(result.draftPicks).toHaveLength(2);
    expect(result.draftPicks[0]).toMatchObject({
      draftYear: '2025',
      ktcValue: 1000,
      currentKtcValue: 700,
      valueGain: -300,
      positionRankMay2025: 'RB2',
      currentPositionRank: 'RB12',
      positionRankChange: '-10',
      draftKind: 'main',
      draftValueDate: '2025-08-24',
      currentValueDate: '2025-12-10',
    });
    expect(result.draftPicks[1]).toMatchObject({
      draftYear: '2026',
      ktcValue: 3000,
      currentKtcValue: 3600,
      valueGain: 600,
      positionRankMay2025: 'RB9',
      currentPositionRank: 'RB5',
      positionRankChange: '+4',
      draftKind: 'main',
      draftValueDate: '2026-08-23',
      currentValueDate: '2026-12-09',
    });
  });

  it('uses draft-id scoped dynasty main draft values for the three-year monitoring window', async () => {
    const result = await analyzeDraftPicks(
      [
        {
          draft_id: 'startup-2024',
          draft_pick_count: 240,
          round: 1,
          pick_no: 4,
          player_id: 'player1',
          picked_by: 'roster1',
          season: '2024',
          user_id_to_manager_map: { roster1: 'Manager A' },
        },
      ] as any,
      {
        player1: { full_name: 'Startup Anchor', position: 'WR' },
      },
      { roster1: 'Manager A' },
      { startupanchor: { name: 'Startup Anchor', ktc_value: 5200, position_rank: 'WR18' } },
      { '2024:player1': { name: 'Startup Anchor', adp: 4 } },
      undefined,
      { startupanchor: { name: 'Startup Anchor', ktc_value: 1000, position_rank_may2025: 'WR99' } },
      { startupanchor: { name: 'Startup Anchor', ktc_value: 5200, position_rank: 'WR18' } },
      {
        '2024': {
          startupanchor: { name: 'Startup Anchor', ktc_value: 1200, position_rank: 'WR88' },
        },
      },
      {},
      {
        leagueValueMode: 'dynasty',
        dynastyMainDraftValueWindowsByDraftId: {
          'startup-2024': {
            draftValues: { startupanchor: { name: 'Startup Anchor', ktc_value: 4300, position_rank: 'WR25' } },
            currentValues: { startupanchor: { name: 'Startup Anchor', ktc_value: 6100, position_rank: 'WR9' } },
            draftValueDate: '2024-08-24',
            currentValueDate: '2027-08-24',
          },
        },
      }
    );

    expect(result.draftPicks[0]).toMatchObject({
      draftYear: '2024',
      draftPickCount: 240,
      ktcValue: 4300,
      currentKtcValue: 6100,
      valueGain: 1800,
      positionRankMay2025: 'WR25',
      currentPositionRank: 'WR9',
      positionRankChange: '+16',
      draftKind: 'startup',
      draftValueDate: '2024-08-24',
      currentValueDate: '2027-08-24',
    });
  });

  it('keeps dynasty rookie or supplemental drafts under the startup threshold on rookie baselines', async () => {
    const result = await analyzeDraftPicks(
      [
        {
          draft_id: 'rookie-2026',
          draft_pick_count: 80,
          round: 8,
          pick_no: 80,
          player_id: 'player1',
          picked_by: 'roster1',
          season: '2026',
          user_id_to_manager_map: { roster1: 'Manager A' },
        },
      ] as any,
      {
        player1: { full_name: 'Rookie Target', position: 'WR' },
      },
      { roster1: 'Manager A' },
      { rookietarget: { name: 'Rookie Target', ktc_value: 2000, position_rank: 'WR30' } },
      { '2026:player1': { name: 'Rookie Target', adp: 80 } },
      undefined,
      undefined,
      { rookietarget: { name: 'Rookie Target', ktc_value: 2000, position_rank: 'WR30' } },
      {
        '2026': {
          rookietarget: { name: 'Rookie Target', ktc_value: 900, position_rank: 'WR70' },
        },
      },
      {},
      {
        leagueValueMode: 'dynasty',
        dynastyMainDraftValueWindowsByDraftId: {
          'rookie-2026': {
            draftValues: { rookietarget: { name: 'Rookie Target', ktc_value: 5000, position_rank: 'WR5' } },
            currentValues: { rookietarget: { name: 'Rookie Target', ktc_value: 6000, position_rank: 'WR1' } },
            draftValueDate: '2026-05-02',
            currentValueDate: '2029-05-02',
          },
        },
      }
    );

    expect(result.draftPicks[0]).toMatchObject({
      draftKind: 'rookie',
      draftPickCount: 80,
      ktcValue: 900,
      currentKtcValue: 2000,
      valueGain: 1100,
      positionRankMay2025: 'WR70',
      currentPositionRank: 'WR30',
      draftValueDate: null,
      currentValueDate: null,
    });
  });

  it('should handle missing player data gracefully', async () => {
    const mockDraftPicks = [
      {
        round: 1,
        pick_no: 1,
        player_id: 'unknown_player',
        picked_by: 'roster1',
        user_id_to_manager_map: { 'roster1': 'Manager A' },
      },
    ] as any;

    const mockPlayers = {};

    const mockRosterMap = {
      roster1: 'Manager A',
    };

    const mockKtcValues = {};

    const mockAdpData = {};

    const result = await analyzeDraftPicks(
      mockDraftPicks,
      mockPlayers,
      mockRosterMap,
      mockKtcValues,
      mockAdpData
    );

    expect(result.draftPicks).toHaveLength(1);
    expect(result.draftPicks[0].playerName).toBe('Unknown');
    expect(result.draftPicks[0].playerPos).toBe('N/A');
    expect(result.draftPicks[0].currentKtcValue).toBeNull();
  });
});
