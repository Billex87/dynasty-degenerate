import { describe, expect, it } from 'vitest';
import { isCurrentFantasySkillPlayer } from './playerEligibility';

describe('player eligibility filters', () => {
  it('rejects inactive stale Sleeper player records', () => {
    expect(isCurrentFantasySkillPlayer({
      first_name: 'Kenneth',
      last_name: 'Walker',
      position: 'WR',
      active: false,
      fantasy_positions: ['WR'],
    })).toBe(false);
  });

  it('accepts active fantasy skill players', () => {
    expect(isCurrentFantasySkillPlayer({
      first_name: 'Kenneth',
      last_name: 'Walker',
      position: 'RB',
      active: true,
      fantasy_positions: ['RB'],
    })).toBe(true);
  });

  it('rejects players whose fantasy positions do not include their primary position', () => {
    expect(isCurrentFantasySkillPlayer({
      first_name: 'Mismatch',
      last_name: 'Player',
      position: 'RB',
      active: true,
      fantasy_positions: ['WR'],
    })).toBe(false);
  });
});
