import { describe, expect, it } from 'vitest';
import { getPlayerValueConfidence } from './playerValueConfidence';
import type { PlayerDetails } from '@shared/types';

describe('getPlayerValueConfidence', () => {
  it('keeps players without value profiles low confidence', () => {
    const confidence = getPlayerValueConfidence({ mode: 'dynasty' });

    expect(confidence.score).toBeLessThan(46);
    expect(confidence.tone).toBe('danger');
    expect(confidence.primarySourceCount).toBe(0);
    expect(confidence.sources).toEqual([]);
  });

  it('raises dynasty confidence when multiple primary sources agree', () => {
    const valueProfile: PlayerDetails['valueProfile'] = {
      dynastyValue: 6400,
      marketKtc: 6300,
      flockFantasy: 6500,
      fantasyCalcDynasty: 6200,
      dynastyNerds: 6450,
      dynastyPositionRank: 'WR8',
      sources: ['KTC', 'Flock Fantasy', 'FantasyCalc', 'DynastyNerds'],
    };

    const confidence = getPlayerValueConfidence({ valueProfile, mode: 'dynasty' });

    expect(confidence.score).toBeGreaterThanOrEqual(78);
    expect(confidence.tone).toBe('good');
    expect(confidence.primarySourceCount).toBeGreaterThanOrEqual(4);
    expect(confidence.primarySources.map((source) => source.label)).toEqual([
      'Dynasty blend',
      'KTC market',
      'Flock Fantasy',
      'FantasyCalc dynasty',
      'Dynasty Nerds',
    ]);
  });

  it('penalizes wide source disagreement', () => {
    const valueProfile: PlayerDetails['valueProfile'] = {
      dynastyValue: 6400,
      marketKtc: 9300,
      flockFantasy: 2500,
      fantasyCalcDynasty: 6100,
      dynastyPositionRank: 'RB12',
      sources: ['KTC', 'Flock Fantasy', 'FantasyCalc'],
    };

    const confidence = getPlayerValueConfidence({ valueProfile, mode: 'dynasty' });

    expect(confidence.spreadPct).toBeGreaterThan(0.55);
    expect(confidence.score).toBeLessThan(78);
  });

  it('uses current-season sources for redraft confidence', () => {
    const valueProfile: PlayerDetails['valueProfile'] = {
      seasonValue: 5200,
      fantasyProsSeasonValue: 5100,
      fantasyCalcRedraft: 5300,
      flockBestBall: 5250,
      seasonPositionRank: 'RB14',
      sources: ['FantasyPros', 'FantasyCalc Redraft', 'Flock Best Ball'],
    };

    const confidence = getPlayerValueConfidence({ valueProfile, mode: 'redraft' });

    expect(confidence.primarySourceCount).toBe(4);
    expect(confidence.score).toBeGreaterThanOrEqual(70);
    expect(confidence.sources.map((source) => source.label)).toEqual([
      'Season blend',
      'FantasyPros season',
      'FantasyCalc redraft',
      'Flock best ball',
    ]);
  });
});
