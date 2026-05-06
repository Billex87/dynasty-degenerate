import { describe, it, expect } from 'vitest';
import {
  cleanName,
  getPlayerValue,
  getPickValue,
  projectValue,
  calculateValueAdjustment,
} from './leagueAnalysis';
import { generateReport } from './reportGenerator';

type TestPlayers = Parameters<typeof generateReport>[2];
type TestKtcValues = Parameters<typeof generateReport>[3];

describe('League Analysis Helpers', () => {
  describe('cleanName', () => {
    it('should remove special characters and lowercase', () => {
      expect(cleanName("Ja'Marr Chase")).toBe('jamarrchase');
      expect(cleanName('Josh Allen')).toBe('joshallen');
      expect(cleanName('Jaxon Smith-Njigba')).toBe('jaxonsmithnjigba');
    });

    it('should clean names correctly', () => {
      // Josh Allen -> joshallen (removes space, lowercases)
      const result = cleanName('Josh Allen');
      expect(result).toBe('joshallen');
    });

    it('should handle empty strings', () => {
      expect(cleanName('')).toBe('');
    });
  });

  describe('getPlayerValue', () => {
    const mockPlayers = {
      '123': {
        first_name: 'Josh',
        last_name: 'Allen',
        position: 'QB',
        age: 28,
      },
      '456': {
        first_name: 'Ja\'Marr',
        last_name: 'Chase',
        position: 'WR',
        age: 24,
      },
    };

    const mockKTCValues = {
      joshallen: { name: 'Josh Allen', ktc_value: 9999 },
      jamarrchase: { name: 'Ja\'Marr Chase', ktc_value: 9928 },
    };

    it('should return correct KTC value for player', () => {
      const result = getPlayerValue('123', mockPlayers, mockKTCValues);
      expect(result).toBe(9999); // Josh Allen
    });

    it('should return 0 for non-existent player', () => {
      expect(getPlayerValue('999', mockPlayers, mockKTCValues)).toBe(0);
    });

    it('should return 0 for player not in KTC data', () => {
      // Player exists but not in KTC values
      const result = getPlayerValue('123', { '123': { first_name: 'Unknown', last_name: 'Player', position: 'QB', age: 25 } }, {});
      expect(result).toBe(0);
    });
  });

  describe('getPickValue', () => {
    const mockKTCValues = {
      '2026mid1st': { name: '2026 Mid 1st', ktc_value: 4800 },
      '2026mid2nd': { name: '2026 Mid 2nd', ktc_value: 1900 },
      '2026late1st': { name: '2026 Late 1st', ktc_value: 3900 },
    };

    it('should return base value for unknown pick', () => {
      expect(getPickValue(2025, 1, {})).toBe(4500);
      expect(getPickValue(2025, 2, {})).toBe(1800);
      expect(getPickValue(2025, 3, {})).toBe(600);
      expect(getPickValue(2025, 4, {})).toBe(250);
    });

    it('should use the draft slot to separate early, mid, and late picks', () => {
      expect(getPickValue(2026, 1, mockKTCValues, 6, 10)).toBe(4800);
      expect(getPickValue(2026, 1, mockKTCValues, 7, 10)).toBe(3900);
    });
  });

  describe('projectValue', () => {
    it('should project RB value correctly', () => {
      const youngRBValue = projectValue(1000, 'RB', 23, 1);
      expect(youngRBValue).toBeGreaterThan(1000);

      const agingRBValue = projectValue(1000, 'RB', 27, 1);
      expect(agingRBValue).toBeLessThan(1000);
    });

    it('should project WR value correctly', () => {
      const youngWRValue = projectValue(1000, 'WR', 23, 1);
      expect(youngWRValue).toBeGreaterThan(1000);

      const agingWRValue = projectValue(1000, 'WR', 31, 1);
      expect(agingWRValue).toBeLessThan(1000);
    });

    it('should project QB value correctly', () => {
      const youngQBValue = projectValue(1000, 'QB', 24, 1);
      expect(youngQBValue).toBeGreaterThan(1000);

      const agingQBValue = projectValue(1000, 'QB', 36, 1);
      expect(agingQBValue).toBeLessThan(1000);
    });

    it('should return same value if no age provided', () => {
      expect(projectValue(1000, 'QB', null, 1)).toBe(1000);
    });
  });

  describe('calculateValueAdjustment', () => {
    it('should give adjustment to side with fewer items but best player', () => {
      const sideA = [5000, 1000];
      const sideB = [2000, 1500, 1200];

      const adj = calculateValueAdjustment(sideA, sideB);
      expect(adj).toBeGreaterThan(0);
    });

    it('should return 0 if side has more items', () => {
      const sideA = [5000, 1000, 800];
      const sideB = [2000, 1500];

      const adj = calculateValueAdjustment(sideA, sideB);
      expect(adj).toBe(0);
    });

    it('should return 0 if other side has best player', () => {
      const sideA = [2000, 1500];
      const sideB = [5000, 1000];

      const adj = calculateValueAdjustment(sideA, sideB);
      expect(adj).toBe(0);
    });

    it('should return 0 for empty arrays', () => {
      expect(calculateValueAdjustment([], [1000])).toBe(0);
      expect(calculateValueAdjustment([1000], [])).toBe(0);
    });
  });
});

describe('generateReport trade ledger', () => {
  const players = {
    downs: { first_name: 'Josh', last_name: 'Downs', position: 'WR', age: 24 },
    london: { first_name: 'Drake', last_name: 'London', position: 'WR', age: 24 },
    smith: { first_name: 'DeVonta', last_name: 'Smith', position: 'WR', age: 27 },
  };

  const ktcValues = {
    joshdowns: { name: 'Josh Downs', ktc_value: 3200 },
    drakelondon: { name: 'Drake London', ktc_value: 8500 },
    devontasmith: { name: 'DeVonta Smith', ktc_value: 6000 },
    '2026late1st': { name: '2026 Late 1st', ktc_value: 3928 },
    '2026late2nd': { name: '2026 Late 2nd', ktc_value: 2865 },
    '2026late3rd': { name: '2026 Late 3rd', ktc_value: 2117 },
  };

  const baseSeason = {
    label: '2026',
    rosterMap: {
      1: 'AwwQQ',
      3: 'mynameisbillex',
      9: 'Beaston1989',
      10: 'S1monB1rch',
    },
    rosters: [
      { roster_id: 1, owner_id: 'u1', players: ['london'] },
      { roster_id: 3, owner_id: 'u3', players: ['smith'] },
      { roster_id: 9, owner_id: 'u9', players: ['downs'] },
      { roster_id: 10, owner_id: 'u10', players: [] },
    ],
    draftSlotsBySeason: {
      '2026': {
        1: 8,
        10: 10,
      },
    },
  };

  it('shows draft picks in the side that received them', async () => {
    const report = await generateReport(
      {
        ...baseSeason,
        trades: [
          {
            status_updated: Date.parse('2026-04-15T12:00:00Z'),
            adds: { downs: 1 },
            draft_picks: [
              {
                round: 3,
                season: '2026',
                roster_id: 1,
                owner_id: 9,
                previous_owner_id: 1,
              },
            ],
          },
        ],
      },
      null,
      players,
      ktcValues,
      {}
    );

    const trade = report.tradeHistory[0];
    expect(trade.team_a).toBe('AwwQQ');
    expect(trade.team_a_items).toContain('PLAYER:downs|Josh Downs|3200');
    expect(trade.team_b).toBe('Beaston1989');
    expect(trade.team_b_items).toContain('PICK:2026 AwwQQ 3rd (3.08)|2117');
  });

  it('keeps player names visible when value adjustment is applied', async () => {
    const report = await generateReport(
      { ...baseSeason, trades: [] },
      {
        ...baseSeason,
        label: '2025',
        trades: [
          {
            status_updated: Date.parse('2025-08-13T12:00:00Z'),
            adds: {
              london: 1,
              smith: 3,
            },
            draft_picks: [
              {
                round: 1,
                season: '2026',
                roster_id: 1,
                owner_id: 3,
                previous_owner_id: 1,
              },
              {
                round: 2,
                season: '2026',
                roster_id: 10,
                owner_id: 3,
                previous_owner_id: 1,
              },
            ],
          },
        ],
      },
      players,
      ktcValues,
      {}
    );

    const trade = report.tradeHistory[0];
    expect(trade.team_a).toBe('AwwQQ');
    expect(trade.team_a_items.split(',').map(item => item.trim())).toContain('PLAYER:london|Drake London|8500');
    expect(trade.team_b).toBe('mynameisbillex');
    expect(trade.team_b_items).toContain('PLAYER:smith|DeVonta Smith|6000');
    expect(trade.team_b_items).toContain('PICK:2026 AwwQQ 1st (1.08)|3928');
    expect(trade.team_b_items).toContain('PICK:2026 S1monB1rch 2nd (2.10)|2865');
  });

  it('ranks weekly momentum by 7-day KTC percentage movement', async () => {
    const report = await generateReport(
      {
        label: '2026',
        trades: [],
        rosterMap: { 1: 'Manager A' },
        rosters: [
          { roster_id: 1, owner_id: 'u1', players: ['steady', 'smallBigPct', 'bigDrop', 'smallDrop'] },
        ],
      },
      null,
      {
        steady: { first_name: 'Steady', last_name: 'Gain', position: 'WR', age: 24 },
        smallBigPct: { first_name: 'Small', last_name: 'Bigpct', position: 'RB', age: 24 },
        bigDrop: { first_name: 'Big', last_name: 'Drop', position: 'QB', age: 24 },
        smallDrop: { first_name: 'Small', last_name: 'Drop', position: 'TE', age: 24 },
      },
      {
        steadygain: { name: 'Steady Gain', ktc_value: 5000, market_value_ktc: 9000 },
        smallbigpct: { name: 'Small Bigpct', ktc_value: 5000, market_value_ktc: 2500 },
        bigdrop: { name: 'Big Drop', ktc_value: 5000, market_value_ktc: 7000 },
        smalldrop: { name: 'Small Drop', ktc_value: 5000, market_value_ktc: 2000 },
      },
      {
        steadygain: { name: 'Steady Gain', ktc_value: 8000 },
        smallbigpct: { name: 'Small Bigpct', ktc_value: 2000 },
        bigdrop: { name: 'Big Drop', ktc_value: 7600 },
        smalldrop: { name: 'Small Drop', ktc_value: 2500 },
      }
    );

    expect(report.weeklyRisers.map((player) => player.name)).toEqual(['Small Bigpct', 'Steady Gain']);
    expect(report.weeklyRisers.map((player) => player.diff)).toEqual([500, 1000]);
    expect(report.weeklyRisers.map((player) => Math.round(player.pct_change * 10) / 10)).toEqual([25, 12.5]);
    expect(report.weeklyFallers.map((player) => player.name)).toEqual(['Small Drop', 'Big Drop']);
    expect(report.weeklyFallers.map((player) => player.diff)).toEqual([-500, -600]);
    expect(report.weeklyFallers.map((player) => Math.round(player.pct_change * 10) / 10)).toEqual([-20, -7.9]);
  });

  it('scales starter counts by league size and redraft positional rank', async () => {
    const report = await generateReport(
      {
        label: '2026',
        trades: [],
        rosterMap: {
          1: 'Manager A',
          2: 'Manager B',
        },
        rosters: [
          { roster_id: 1, owner_id: 'u1', players: ['qbTop', 'rbTop', 'wrTop', 'teTop'] },
          { roster_id: 2, owner_id: 'u2', players: ['qbLow', 'rbLow', 'wrLow', 'teLow'] },
        ],
      },
      null,
      {
        qbTop: { first_name: 'Top', last_name: 'QB', position: 'QB', age: 25 },
        rbTop: { first_name: 'Top', last_name: 'RB', position: 'RB', age: 25 },
        wrTop: { first_name: 'Top', last_name: 'WR', position: 'WR', age: 25 },
        teTop: { first_name: 'Top', last_name: 'TE', position: 'TE', age: 25 },
        qbLow: { first_name: 'Low', last_name: 'QB', position: 'QB', age: 25 },
        rbLow: { first_name: 'Low', last_name: 'RB', position: 'RB', age: 25 },
        wrLow: { first_name: 'Low', last_name: 'WR', position: 'WR', age: 25 },
        teLow: { first_name: 'Low', last_name: 'TE', position: 'TE', age: 25 },
      },
      {
        topqb: { name: 'Top QB', ktc_value: 5000, redraft_value: 9000, position_rank: 'QB4' },
        toprb: { name: 'Top RB', ktc_value: 5000, redraft_value: 9000, position_rank: 'RB6' },
        topwr: { name: 'Top WR', ktc_value: 5000, redraft_value: 9000, position_rank: 'WR8' },
        topte: { name: 'Top TE', ktc_value: 5000, redraft_value: 9000, position_rank: 'TE3' },
        lowqb: { name: 'Low QB', ktc_value: 5000, redraft_value: 1000, position_rank: 'QB5' },
        lowrb: { name: 'Low RB', ktc_value: 5000, redraft_value: 1000, position_rank: 'RB7' },
        lowwr: { name: 'Low WR', ktc_value: 5000, redraft_value: 1000, position_rank: 'WR9' },
        lowte: { name: 'Low TE', ktc_value: 5000, redraft_value: 1000, position_rank: 'TE4' },
      },
      {}
    );

    expect(report.managerPositionCounts[0]).toMatchObject({
      QB_starters: 1,
      RB_starters: 1,
      WR_starters: 1,
      TE_starters: 1,
    });
    expect(report.managerPositionCounts[1]).toMatchObject({
      QB_starters: 1,
      RB_starters: 1,
      WR_starters: 1,
      TE_starters: 1,
    });
    expect(report.managerPositionCounts[0].starterPlayers?.find((player) => player.pos === 'QB')?.seasonPositionRank).toBe('QB1');
    expect(report.managerPositionCounts[1].starterPlayers?.find((player) => player.pos === 'QB')?.seasonPositionRank).toBe('QB2');
  });

  it('builds owner intel from the actual superflex lineup and bench path', async () => {
    const report = await generateReport(
      {
        label: '2026',
        trades: [],
        rosterPositions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'SUPER_FLEX', 'BN'],
        rosterMap: {
          1: 'Manager A',
          2: 'Manager B',
        },
        rosters: [
          { roster_id: 1, owner_id: 'u1', players: ['aQb1', 'aQb2', 'aQb3', 'camWard', 'aRb1', 'aRb2', 'aRb3', 'aWr1', 'aWr2', 'aWr3', 'aTe1'], taxi: ['camWard'] },
          { roster_id: 2, owner_id: 'u2', players: ['bQb1', 'bQb2', 'bQb3', 'bRb1', 'bRb2', 'bRb3', 'bWr1', 'bWr2', 'bWr3', 'bTe1'] },
        ],
      },
      null,
      {
        aQb1: { first_name: 'Alpha', last_name: 'QBOne', position: 'QB', age: 25 },
        aQb2: { first_name: 'Alpha', last_name: 'QBTwo', position: 'QB', age: 25 },
        aQb3: { first_name: 'Alpha', last_name: 'QBThree', position: 'QB', age: 25 },
        camWard: { first_name: 'Cam', last_name: 'Ward', position: 'QB', age: 23 },
        aRb1: { first_name: 'Alpha', last_name: 'RBOne', position: 'RB', age: 25 },
        aRb2: { first_name: 'Alpha', last_name: 'RBTwo', position: 'RB', age: 25 },
        aRb3: { first_name: 'Alpha', last_name: 'RBThree', position: 'RB', age: 25 },
        aWr1: { first_name: 'Alpha', last_name: 'WROne', position: 'WR', age: 25 },
        aWr2: { first_name: 'Alpha', last_name: 'WRTwo', position: 'WR', age: 25 },
        aWr3: { first_name: 'Alpha', last_name: 'WRThree', position: 'WR', age: 25 },
        aTe1: { first_name: 'Alpha', last_name: 'TEOne', position: 'TE', age: 25 },
        bQb1: { first_name: 'Beta', last_name: 'QBOne', position: 'QB', age: 25 },
        bQb2: { first_name: 'Beta', last_name: 'QBTwo', position: 'QB', age: 25 },
        bQb3: { first_name: 'Beta', last_name: 'QBThree', position: 'QB', age: 25 },
        bRb1: { first_name: 'Beta', last_name: 'RBOne', position: 'RB', age: 25 },
        bRb2: { first_name: 'Beta', last_name: 'RBTwo', position: 'RB', age: 25 },
        bRb3: { first_name: 'Beta', last_name: 'RBThree', position: 'RB', age: 25 },
        bWr1: { first_name: 'Beta', last_name: 'WROne', position: 'WR', age: 25 },
        bWr2: { first_name: 'Beta', last_name: 'WRTwo', position: 'WR', age: 25 },
        bWr3: { first_name: 'Beta', last_name: 'WRThree', position: 'WR', age: 25 },
        bTe1: { first_name: 'Beta', last_name: 'TEOne', position: 'TE', age: 25 },
      },
      {
        alphaqbone: { name: 'Alpha QBOne', ktc_value: 9000, redraft_value: 9000, position_rank: 'QB1' },
        alphaqbtwo: { name: 'Alpha QBTwo', ktc_value: 8500, redraft_value: 8500, position_rank: 'QB2' },
        alphaqbthree: { name: 'Alpha QBThree', ktc_value: 1200, redraft_value: 1200, position_rank: 'QB44' },
        camward: { name: 'Cam Ward', ktc_value: 5000, redraft_value: 5000, position_rank: 'QB10' },
        alpharbone: { name: 'Alpha RBOne', ktc_value: 8000, redraft_value: 8000, position_rank: 'RB1' },
        alpharbtwo: { name: 'Alpha RBTwo', ktc_value: 7600, redraft_value: 7600, position_rank: 'RB2' },
        alpharbthree: { name: 'Alpha RBThree', ktc_value: 6000, redraft_value: 6000, position_rank: 'RB6' },
        alphawrone: { name: 'Alpha WROne', ktc_value: 8100, redraft_value: 8100, position_rank: 'WR1' },
        alphawrtwo: { name: 'Alpha WRTwo', ktc_value: 7700, redraft_value: 7700, position_rank: 'WR2' },
        alphawrthree: { name: 'Alpha WRThree', ktc_value: 6200, redraft_value: 6200, position_rank: 'WR6' },
        alphateone: { name: 'Alpha TEOne', ktc_value: 7000, redraft_value: 7000, position_rank: 'TE1' },
        betaqbone: { name: 'Beta QBOne', ktc_value: 6200, redraft_value: 6200, position_rank: 'QB6' },
        betaqbtwo: { name: 'Beta QBTwo', ktc_value: 5900, redraft_value: 5900, position_rank: 'QB7' },
        betaqbthree: { name: 'Beta QBThree', ktc_value: 5800, redraft_value: 5800, position_rank: 'QB8' },
        betarbone: { name: 'Beta RBOne', ktc_value: 5000, redraft_value: 5000, position_rank: 'RB10' },
        betarbtwo: { name: 'Beta RBTwo', ktc_value: 4800, redraft_value: 4800, position_rank: 'RB11' },
        betarbthree: { name: 'Beta RBThree', ktc_value: 4600, redraft_value: 4600, position_rank: 'RB12' },
        betawrone: { name: 'Beta WROne', ktc_value: 5200, redraft_value: 5200, position_rank: 'WR10' },
        betawrtwo: { name: 'Beta WRTwo', ktc_value: 5000, redraft_value: 5000, position_rank: 'WR11' },
        betawrthree: { name: 'Beta WRThree', ktc_value: 4900, redraft_value: 4900, position_rank: 'WR12' },
        betateone: { name: 'Beta TEOne', ktc_value: 5200, redraft_value: 5200, position_rank: 'TE6' },
      },
      {}
    );

    const managerA = report.managerRosterIntelligence.find((row) => row.manager === 'Manager A');
    expect(report.managerPositionCounts.find((row) => row.manager === 'Manager A')?.QB_starters).toBe(2);
    expect(managerA?.startingRosterStrength?.find((tile) => tile.key === 'QB_SF')).toMatchObject({
      label: 'QB/SF x2',
      leagueRank: 1,
    });
    expect(managerA?.benchBaseline?.find((tile) => tile.key === 'QB')?.player?.name).toBe('Cam Ward');
    expect(managerA?.tradeableDepth?.find((tile) => tile.position === 'QB')?.player?.name).toBe('Alpha QBThree');
  });

  it('limits bench baseline to positional next men up', async () => {
    const report = await generateReport(
      {
        label: '2026',
        trades: [],
        rosterPositions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'BN'],
        rosterMap: { 1: 'Manager A' },
        rosters: [
          {
            roster_id: 1,
            owner_id: 'u1',
            players: ['qbOne', 'rbOne', 'rbTwo', 'rbThree', 'wrOne', 'wrTwo', 'wrThree', 'teOne', 'benchTe', 'benchRb', 'benchWr', 'taxiRb'],
            taxi: ['taxiRb', 'benchTe'],
          },
        ],
      },
      null,
      {
        qbOne: { first_name: 'Starter', last_name: 'QB', position: 'QB', age: 25 },
        rbOne: { first_name: 'Starter', last_name: 'RBOne', position: 'RB', age: 25 },
        rbTwo: { first_name: 'Starter', last_name: 'RBTwo', position: 'RB', age: 25 },
        rbThree: { first_name: 'Starter', last_name: 'RBThree', position: 'RB', age: 25 },
        wrOne: { first_name: 'Starter', last_name: 'WROne', position: 'WR', age: 25 },
        wrTwo: { first_name: 'Starter', last_name: 'WRTwo', position: 'WR', age: 25 },
        wrThree: { first_name: 'Starter', last_name: 'WRThree', position: 'WR', age: 25 },
        teOne: { first_name: 'Starter', last_name: 'TE', position: 'TE', age: 25 },
        benchTe: { first_name: 'Bench', last_name: 'TE', position: 'TE', age: 25 },
        benchRb: { first_name: 'Bench', last_name: 'RB', position: 'RB', age: 25 },
        benchWr: { first_name: 'Bench', last_name: 'WR', position: 'WR', age: 25 },
        taxiRb: { first_name: 'Taxi', last_name: 'RB', position: 'RB', age: 22 },
      },
      {
        starterqb: { name: 'Starter QB', ktc_value: 9000, redraft_value: 9000, position_rank: 'QB5' },
        starterrbone: { name: 'Starter RBOne', ktc_value: 8000, redraft_value: 8000, position_rank: 'RB5' },
        starterrbtwo: { name: 'Starter RBTwo', ktc_value: 7600, redraft_value: 7600, position_rank: 'RB8' },
        starterrbthree: { name: 'Starter RBThree', ktc_value: 6200, redraft_value: 6200, position_rank: 'RB18' },
        starterwrone: { name: 'Starter WROne', ktc_value: 8100, redraft_value: 8100, position_rank: 'WR5' },
        starterwrtwo: { name: 'Starter WRTwo', ktc_value: 7700, redraft_value: 7700, position_rank: 'WR8' },
        starterwrthree: { name: 'Starter WRThree', ktc_value: 6100, redraft_value: 6100, position_rank: 'WR19' },
        starterte: { name: 'Starter TE', ktc_value: 7000, redraft_value: 7000, position_rank: 'TE3' },
        benchte: { name: 'Bench TE', ktc_value: 3900, redraft_value: 3900, position_rank: 'TE30' },
        benchrb: { name: 'Bench RB', ktc_value: 3000, redraft_value: 3000, position_rank: 'RB40' },
        benchwr: { name: 'Bench WR', ktc_value: 2800, redraft_value: 2800, position_rank: 'WR42' },
        taxirb: { name: 'Taxi RB', ktc_value: 3600, redraft_value: 3600, position_rank: 'RB35' },
      },
      {}
    );

    const managerA = report.managerRosterIntelligence.find((row) => row.manager === 'Manager A');
    const managerACounts = report.managerPositionCounts.find((row) => row.manager === 'Manager A');
    const rbTile = managerA?.benchBaseline?.find((tile) => tile.key === 'RB');
    const wrTile = managerA?.benchBaseline?.find((tile) => tile.key === 'WR');
    const teTile = managerA?.benchBaseline?.find((tile) => tile.key === 'TE');
    const flexTile = managerA?.benchBaseline?.find((tile) => tile.key === 'FLEX');

    expect(rbTile?.player?.name).toBe('Taxi RB');
    expect(wrTile?.player?.name).toBe('Bench WR');
    expect(teTile?.player?.name).toBe('Bench TE');
    expect(flexTile).toBeUndefined();
    expect(managerACounts?.RB).toBe(5);
    expect(managerACounts?.rosterPlayers?.some((player) => player.name === 'Taxi RB')).toBe(true);
  });

  it('uses dynasty value as primary for dynasty leagues and season value for redraft leagues', async () => {
    const seasonData = {
      label: '2026',
      trades: [],
      rosterMap: { 1: 'Manager A' },
      rosters: [
        { roster_id: 1, owner_id: 'u1', players: ['youngWr'] },
      ],
    };
    const players = {
      youngWr: { first_name: 'Young', last_name: 'WR', position: 'WR', age: 22 },
    };
    const values = {
      youngwr: { name: 'Young WR', ktc_value: 5000, redraft_value: 1200, position_rank: 'WR8' },
    };

    const dynastyReport = await generateReport(seasonData, null, players, values, {}, {}, { leagueValueMode: 'dynasty' });
    const redraftReport = await generateReport(seasonData, null, players, values, {}, {}, { leagueValueMode: 'redraft' });

    expect(dynastyReport.leagueValueMode).toBe('dynasty');
    expect(redraftReport.leagueValueMode).toBe('redraft');
    expect(dynastyReport.managerRosterValueGrowth[0].total_val).toBe(5000);
    expect(redraftReport.managerRosterValueGrowth[0].total_val).toBe(1200);
    expect(dynastyReport.managerPositionCounts[0].lineupPlayers[0].currentPositionRank).toBe('WR8');
    expect(redraftReport.managerPositionCounts[0].lineupPlayers[0].currentPositionRank).toBe('WR1');
  });
});

describe('generateReport taxi triage', () => {
  const runTaxiReport = (players: TestPlayers, ktcValues: TestKtcValues, taxiId: string) => generateReport(
    {
      label: '2026',
      trades: [],
      rosterPositions: ['TE', 'FLEX'],
      rosterMap: { 1: 'Manager A' },
      rosters: [
        { roster_id: 1, owner_id: 'u1', players: Object.keys(players), taxi: [taxiId] },
      ],
    },
    null,
    players,
    ktcValues,
    {}
  );

  it('does not promote a taxi tight end below the healthy starter and flex path', async () => {
    const report = await runTaxiReport(
      {
        mcbride: { first_name: 'Trey', last_name: 'McBride', position: 'TE', age: 26 },
        flex: { first_name: 'Flex', last_name: 'Starter', position: 'WR', age: 25 },
        bench: { first_name: 'Bench', last_name: 'Wideout', position: 'WR', age: 24 },
        endries: { first_name: 'Jack', last_name: 'Endries', position: 'TE', age: 22, metadata: { rookie_year: '2026' } },
      },
      {
        treymcbride: { name: 'Trey McBride', ktc_value: 8000, redraft_value: 8000, position_rank: 'TE1' },
        flexstarter: { name: 'Flex Starter', ktc_value: 1400, redraft_value: 1400, position_rank: 'WR60' },
        benchwideout: { name: 'Bench Wideout', ktc_value: 900, redraft_value: 900, position_rank: 'WR80' },
        jackendries: { name: 'Jack Endries', ktc_value: 800, redraft_value: 800, position_rank: 'TE23' },
      },
      'endries'
    );

    const taxiItem = report.managerRosterIntelligence[0].taxiTriage?.items.find((player) => player.name === 'Jack Endries');
    expect(taxiItem?.taxiAction).toBe('Keep Parked');
    expect(taxiItem?.taxiReason).toContain('not above a current starter, flex option, or injury fill-in');
  });

  it('promotes a taxi player when he beats the active flex value', async () => {
    const report = await runTaxiReport(
      {
        mcbride: { first_name: 'Trey', last_name: 'McBride', position: 'TE', age: 26 },
        flex: { first_name: 'Flex', last_name: 'Starter', position: 'WR', age: 25 },
        bench: { first_name: 'Bench', last_name: 'Wideout', position: 'WR', age: 24 },
        sadiq: { first_name: 'Kenyon', last_name: 'Sadiq', position: 'TE', age: 22, metadata: { rookie_year: '2026' } },
      },
      {
        treymcbride: { name: 'Trey McBride', ktc_value: 8000, redraft_value: 8000, position_rank: 'TE1' },
        flexstarter: { name: 'Flex Starter', ktc_value: 900, redraft_value: 900, position_rank: 'WR80' },
        benchwideout: { name: 'Bench Wideout', ktc_value: 700, redraft_value: 700, position_rank: 'WR90' },
        kenyonsadiq: { name: 'Kenyon Sadiq', ktc_value: 1600, redraft_value: 1600, position_rank: 'TE14' },
      },
      'sadiq'
    );

    const taxiItem = report.managerRosterIntelligence[0].taxiTriage?.items.find((player) => player.name === 'Kenyon Sadiq');
    expect(taxiItem?.taxiAction).toBe('Promote Now');
    expect(taxiItem?.taxiReason).toContain('beating Flex Starter');
  });

  it('promotes a taxi player only when an unavailable starter opens a weaker fill-in', async () => {
    const report = await runTaxiReport(
      {
        mcbride: { first_name: 'Trey', last_name: 'McBride', position: 'TE', age: 26, injury_status: 'Out' },
        flex: { first_name: 'Flex', last_name: 'Starter', position: 'WR', age: 25 },
        benchte: { first_name: 'Bench', last_name: 'Tightend', position: 'TE', age: 24 },
        endries: { first_name: 'Jack', last_name: 'Endries', position: 'TE', age: 22, metadata: { rookie_year: '2026' } },
      },
      {
        treymcbride: { name: 'Trey McBride', ktc_value: 8000, redraft_value: 8000, position_rank: 'TE1' },
        flexstarter: { name: 'Flex Starter', ktc_value: 1400, redraft_value: 1400, position_rank: 'WR60' },
        benchtightend: { name: 'Bench Tightend', ktc_value: 500, redraft_value: 500, position_rank: 'TE50' },
        jackendries: { name: 'Jack Endries', ktc_value: 800, redraft_value: 800, position_rank: 'TE23' },
      },
      'endries'
    );

    const taxiItem = report.managerRosterIntelligence[0].taxiTriage?.items.find((player) => player.name === 'Jack Endries');
    expect(taxiItem?.taxiAction).toBe('Promote Now');
    expect(taxiItem?.taxiReason).toContain('Trey McBride is tagged Out');
    expect(taxiItem?.taxiReason).toContain('beats the active fill-in Bench Tightend');
  });
});
