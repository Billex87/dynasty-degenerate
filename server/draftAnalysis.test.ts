import { describe, it, expect } from 'vitest';
import { analyzeDraftPicks } from './draftAnalysis';

describe('Draft Analysis', () => {
  it('should analyze draft picks correctly', () => {
    const mockDraftPicks = [
      {
        round: 1,
        pick_no: 1,
        player_id: 'player1',
        picked_by: 'roster1',
      },
      {
        round: 1,
        pick_no: 2,
        player_id: 'player2',
        picked_by: 'roster2',
      },
    ];

    const mockPlayers = {
      player1: { full_name: 'Player One', position: 'QB' },
      player2: { full_name: 'Player Two', position: 'RB' },
    };

    const mockRosterMap = {
      roster1: 'Manager A',
      roster2: 'Manager B',
    };

    const mockKtcValues = {
      'Player One': { name: 'Player One', ktc_value: 1000 },
      'Player Two': { name: 'Player Two', ktc_value: 800 },
    };

    const mockAdpData = {
      player1: { name: 'Player One', pos: 'QB', adp: 5 },
      player2: { name: 'Player Two', pos: 'RB', adp: 1 },
    };

    const result = analyzeDraftPicks(
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
      ktcValue: 1000,
    });

    // Check manager stats
    const managerAStats = result.draftStats.find((s) => s.manager === 'Manager A');
    expect(managerAStats).toBeDefined();
    expect(managerAStats?.totalPicks).toBe(1);
    expect(managerAStats?.fallCount).toBe(1); // Picked at 1, ADP was 5 (fell - got better value)
  });

  it('should calculate ADP differences correctly', () => {
    const mockDraftPicks = [
      {
        round: 1,
        pick_no: 10,
        player_id: 'player1',
        picked_by: 'roster1',
      },
    ];

    const mockPlayers = {
      player1: { full_name: 'Player One', position: 'WR' },
    };

    const mockRosterMap = {
      roster1: 'Manager A',
    };

    const mockKtcValues = {
      'Player One': { name: 'Player One', ktc_value: 500 },
    };

    const mockAdpData = {
      player1: { name: 'Player One', pos: 'WR', adp: 5 },
    };

    const result = analyzeDraftPicks(
      mockDraftPicks,
      mockPlayers,
      mockRosterMap,
      mockKtcValues,
      mockAdpData
    );

    const managerStats = result.draftStats[0];
    expect(managerStats.avgAdpDiff).toBe(5); // Picked at 10, ADP was 5 (positive = reach)
    expect(managerStats.reachCount).toBe(1); // Picked at 10, ADP was 5 (reached for the player)
  });

  it('should handle missing player data gracefully', () => {
    const mockDraftPicks = [
      {
        round: 1,
        pick_no: 1,
        player_id: 'unknown_player',
        picked_by: 'roster1',
      },
    ];

    const mockPlayers = {};

    const mockRosterMap = {
      roster1: 'Manager A',
    };

    const mockKtcValues = {};

    const mockAdpData = {};

    const result = analyzeDraftPicks(
      mockDraftPicks,
      mockPlayers,
      mockRosterMap,
      mockKtcValues,
      mockAdpData
    );

    expect(result.draftPicks).toHaveLength(1);
    expect(result.draftPicks[0].playerName).toBe('Unknown');
    expect(result.draftPicks[0].playerPos).toBe('N/A');
    expect(result.draftPicks[0].ktcValue).toBeNull();
  });
});
