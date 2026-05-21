import { describe, expect, it } from 'vitest';
import { normalizeNflTeamCode } from './nflTeamCodes';

describe('nfl team code normalization', () => {
  it('normalizes provider aliases into one canonical code set', () => {
    expect(normalizeNflTeamCode('JAC')).toBe('JAX');
    expect(normalizeNflTeamCode('ARZ')).toBe('ARI');
    expect(normalizeNflTeamCode('WSH')).toBe('WAS');
    expect(normalizeNflTeamCode('WFT')).toBe('WAS');
    expect(normalizeNflTeamCode('GNB')).toBe('GB');
    expect(normalizeNflTeamCode('KAN')).toBe('KC');
    expect(normalizeNflTeamCode('SFO')).toBe('SF');
    expect(normalizeNflTeamCode('SD')).toBe('LAC');
    expect(normalizeNflTeamCode('OAK')).toBe('LV');
    expect(normalizeNflTeamCode('STL')).toBe('LAR');
  });

  it('normalizes full team names without treating free agents as teams', () => {
    expect(normalizeNflTeamCode('Jacksonville Jaguars')).toBe('JAX');
    expect(normalizeNflTeamCode('Washington Football Team')).toBe('WAS');
    expect(normalizeNflTeamCode('Los Angeles Chargers')).toBe('LAC');
    expect(normalizeNflTeamCode('Los Angeles Rams')).toBe('LAR');
    expect(normalizeNflTeamCode('FA')).toBeNull();
    expect(normalizeNflTeamCode('Free Agent')).toBeNull();
    expect(normalizeNflTeamCode('')).toBeNull();
  });
});
