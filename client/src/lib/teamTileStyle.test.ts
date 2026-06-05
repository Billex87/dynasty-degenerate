import { describe, expect, it } from 'vitest';
import teamBackgrounds from './nfl_modal_backgrounds/meta.json';
import {
  getNflTeamColors,
  getNflTeamColorsWithFallback,
  getNflTeamGradientStops,
  getNflTeamHeaderBackgroundUrl,
  getNflTeamHeaderGradient,
  getNflTeamHeaderGradientStops,
  getTeamTileStyle,
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
      expect(getNflTeamHeaderGradientStops(teamCode)).toHaveLength(3);
      expect(getNflTeamHeaderGradientStops(teamCode)[1]).toBe('#000000');
    }
  });

  it('renders modal header gradients as light color, black, then a different team color', () => {
    expect(getNflTeamHeaderGradientStops('CHI')).toEqual(['#C83803', '#000000', '#0B162A']);
    expect(getNflTeamHeaderGradient('CHI')).toBe('linear-gradient(135deg, #C83803, #000000, #0B162A)');

    expect(getNflTeamHeaderGradientStops('DAL')).toEqual(['#869397', '#000000', '#041E42']);
    expect(getNflTeamHeaderGradient('DAL')).toBe('linear-gradient(135deg, #869397, #000000, #041E42)');
  });

  it('uses readable canonical team colors for NFL player tile CSS variables', () => {
    expect(getTeamTileStyle('ATL')).toEqual({
      '--team-primary': '#A71930',
      '--team-secondary': '#000000',
      '--team-accent': '#A5ACAF',
    });

    expect(getTeamTileStyle('WAS')).toEqual({
      '--team-primary': '#5A1414',
      '--team-secondary': '#FFB612',
      '--team-accent': '#FFFFFF',
    });

    expect(getTeamTileStyle('CHI')).toEqual({
      '--team-primary': '#C83803',
      '--team-secondary': '#0B162A',
      '--team-accent': '#C83803',
    });
  });

  it('normalizes vendor and historical aliases through metadata aliases', () => {
    expect(normalizeNflTeamAbbr('JAC')).toBe('JAX');
    expect(normalizeNflTeamAbbr('WSH')).toBe('WAS');
    expect(normalizeNflTeamAbbr('ARZ')).toBe('ARI');
    expect(normalizeNflTeamAbbr('SD')).toBe('LAC');
    expect(normalizeNflTeamAbbr('OAK')).toBe('LV');
    expect(normalizeNflTeamAbbr('FREE AGENT')).toBeNull();
    expect(normalizeNflTeamAbbr('New York Jets')).toBe('NYJ');
  });

  it('maps teams and aliases to public header background images', () => {
    expect(getNflTeamHeaderBackgroundUrl('TEN')).toBe('/assets/nfl-team-backgrounds/ten.jpg');
    expect(getNflTeamHeaderBackgroundUrl('JAC')).toBe('/assets/nfl-team-backgrounds/jax.jpg');
    expect(getNflTeamHeaderBackgroundUrl('OAK')).toBe('/assets/nfl-team-backgrounds/lv.jpg');
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
    expect(getTeamTileStyle('FA')).toEqual({
      '--team-primary': teamBackgrounds.fallback.gradient[0],
      '--team-secondary': teamBackgrounds.fallback.gradient[1],
      '--team-accent': teamBackgrounds.fallback.gradient[2],
    });
    expect(getTeamTileStyle('FREE AGENT')).toEqual(getTeamTileStyle('FA'));
    expect(getTeamTileStyle(null)).toEqual(getTeamTileStyle('FA'));
    expect(getNflTeamHeaderBackgroundUrl('FA')).toBe('/assets/nfl-team-backgrounds/nfl-fa.jpg');
    expect(getNflTeamHeaderBackgroundUrl('NOT_A_TEAM')).toBe('/assets/nfl-team-backgrounds/nfl-fa.jpg');
  });
});
