import { describe, expect, it } from 'vitest';
import teamBackgrounds from './nfl_modal_backgrounds/meta.json';
import {
  getNflTeamColors,
  getNflTeamColorsWithFallback,
  getNflTeamGradientStops,
  getNflTeamHeaderGradient,
  NFL_TEAM_COLORS,
  normalizeNflTeamAbbr,
} from './teamTileStyle';

describe('teamTileStyle NFL metadata colors', () => {
  it('generates usable color sets and gradients for all metadata teams', () => {
    const teamCodes = Object.keys(teamBackgrounds.teams);

    expect(teamCodes).toHaveLength(32);
    for (const teamCode of teamCodes) {
      const colors = NFL_TEAM_COLORS[teamCode];
      const stops = getNflTeamGradientStops(teamCode);

      expect(colors).toEqual({
        primary: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        secondary: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        accent: expect.stringMatching(/^#[0-9A-F]{6}$/i),
      });
      expect(stops.length).toBeGreaterThanOrEqual(2);
      expect(getNflTeamHeaderGradient(teamCode)).toBe(
        `linear-gradient(${teamBackgrounds.gradientAngle}, ${stops.join(', ')})`
      );
    }
  });

  it('normalizes vendor and historical aliases through metadata aliases', () => {
    expect(normalizeNflTeamAbbr('JAC')).toBe('JAX');
    expect(normalizeNflTeamAbbr('WSH')).toBe('WAS');
    expect(normalizeNflTeamAbbr('ARZ')).toBe('ARI');
    expect(normalizeNflTeamAbbr('SD')).toBe('LAC');
    expect(normalizeNflTeamAbbr('OAK')).toBe('LV');
    expect(normalizeNflTeamAbbr('New York Jets')).toBe('NYJ');
  });

  it('uses the NFL fallback gradient for free agents and unknown teams', () => {
    expect(normalizeNflTeamAbbr('FA')).toBeNull();
    expect(normalizeNflTeamAbbr('UNKNOWN')).toBeNull();
    expect(getNflTeamColors('FA')).toBeNull();
    expect(getNflTeamGradientStops('FA')).toEqual(teamBackgrounds.fallback.gradient);
    expect(getNflTeamGradientStops('NOT_A_TEAM')).toEqual(teamBackgrounds.fallback.gradient);
    expect(getNflTeamColorsWithFallback('FA')).toEqual({
      primary: teamBackgrounds.fallback.gradient[0],
      secondary: teamBackgrounds.fallback.gradient[1],
      accent: teamBackgrounds.fallback.gradient[2],
    });
  });
});
