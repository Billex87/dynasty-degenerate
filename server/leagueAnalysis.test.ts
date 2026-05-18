import { describe, expect, it } from 'vitest';
import { playerNameKeysMatch } from './leagueAnalysis';

describe('playerNameKeysMatch', () => {
  it('matches suffix variants without allowing substring collisions', () => {
    expect(playerNameKeysMatch('Brian Thomas', 'Brian Thomas Jr.')).toBe(true);
    expect(playerNameKeysMatch('Brian Thomas', 'brianthomasjr')).toBe(true);
    expect(playerNameKeysMatch('Brian Thomas', 'Ian Thomas')).toBe(false);
    expect(playerNameKeysMatch('brianthomas', 'ianthomas')).toBe(false);
  });

  it('matches curated football name aliases from source providers and Sleeper', () => {
    expect(playerNameKeysMatch('Chigoziem Okonkwo', 'Chig Okonkwo')).toBe(true);
    expect(playerNameKeysMatch('Bam Knight', 'Zonovan Knight')).toBe(true);
    expect(playerNameKeysMatch('Gabriel Davis', 'Gabe Davis')).toBe(true);
    expect(playerNameKeysMatch('Hollywood Brown', 'Marquise Brown')).toBe(true);
    expect(playerNameKeysMatch('Nick Singleton', 'Nicholas Singleton')).toBe(true);
    expect(playerNameKeysMatch('Nicholas Singleton', 'nicksingleton')).toBe(true);
    expect(playerNameKeysMatch('Deion Burks (Duplicate)', 'Deion Burks')).toBe(true);
  });
});
