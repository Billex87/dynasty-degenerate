import { describe, expect, it } from 'vitest';
import { playerNameKeysMatch } from './leagueAnalysis';

describe('playerNameKeysMatch', () => {
  it('matches suffix variants without allowing substring collisions', () => {
    expect(playerNameKeysMatch('Brian Thomas', 'Brian Thomas Jr.')).toBe(true);
    expect(playerNameKeysMatch('Brian Thomas', 'brianthomasjr')).toBe(true);
    expect(playerNameKeysMatch('Brian Thomas', 'Ian Thomas')).toBe(false);
    expect(playerNameKeysMatch('brianthomas', 'ianthomas')).toBe(false);
  });
});
