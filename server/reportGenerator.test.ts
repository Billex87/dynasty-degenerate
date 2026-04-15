import { describe, it, expect } from 'vitest';
import {
  cleanName,
  getPlayerValue,
  getPickValue,
  projectValue,
  calculateValueAdjustment,
} from './leagueAnalysis';

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
    };

    it('should return base value for unknown pick', () => {
      expect(getPickValue(2025, 1, {})).toBe(4500);
      expect(getPickValue(2025, 2, {})).toBe(1800);
      expect(getPickValue(2025, 3, {})).toBe(600);
      expect(getPickValue(2025, 4, {})).toBe(250);
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
