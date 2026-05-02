import { describe, it, expect, vi } from 'vitest';
import { analyzeDraftPicks } from './draftAnalysis';
import * as nflHeadshotFetcher from './nflHeadshotFetcher';
import { getRookieValueBaseline, getRookieValueBaselineMetadata } from './rookieValueBaselines';

// Mock the NFL headshot fetcher to avoid actual HTTP requests
vi.mock('./nflHeadshotFetcher', () => ({
  fetchNFLHeadshot: vi.fn().mockResolvedValue('https://example.com/headshot.jpg'),
}));

describe('Draft Analysis', () => {
  it('loads the locked 2025 rookie blend snapshot with source metadata', () => {
    const baseline = getRookieValueBaseline('2025');
    const metadata = getRookieValueBaselineMetadata('2025');
    const emeka =
      baseline?.['emeka-egbuka-1781'] ||
      Object.values(baseline || {}).find((record) => record.name === 'Emeka Egbuka');

    expect(metadata?.label).toBe('2025 Rookie Historical Blend');
    expect(metadata?.comparisonMode).toBe('blend-to-blend');
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

  it('should prefer historical blended draft-year baseline values when available', async () => {
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
      { emekaegbuka: { name: 'Emeka Egbuka', ktc_value: 5148 } },
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

    expect(result.draftPicks[0].ktcValue).toBe(3908);
    expect(result.draftPicks[0].currentKtcValue).toBe(5148);
    expect(result.draftPicks[0].valueGain).toBe(1240);
    expect(result.draftPicks[0].positionRankMay2025).toBe('WR21');
    expect(result.draftPicks[0].positionRankChange).toBe('+7');
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
