import { describe, expect, it } from 'vitest';
import {
  getPlayerRankForMode,
  getPlayerValueForMode,
  getPrimaryValueLabel,
  getSecondaryValueLabel,
  getValueDisplayConfig,
  normalizeLeagueValueMode,
  shouldShowDynastyValue,
  shouldUseSeasonPrimary,
} from './leagueValueMode';

describe('league value mode rules', () => {
  it('normalizes unknown formats to dynasty and preserves redraft', () => {
    expect(normalizeLeagueValueMode('redraft')).toBe('redraft');
    expect(normalizeLeagueValueMode('keeper')).toBe('dynasty');
    expect(normalizeLeagueValueMode(null)).toBe('dynasty');
  });

  it('keeps dynasty overview value-first but uses season value first for lineup context', () => {
    expect(getValueDisplayConfig('dynasty', 'overview')).toMatchObject({
      primaryLabel: 'Dynasty Value',
      secondaryLabel: 'Season Value',
      showDynastyValue: true,
      showSeasonValue: true,
    });

    expect(getValueDisplayConfig('dynasty', 'starter')).toMatchObject({
      primaryLabel: 'Season Value',
      secondaryLabel: 'Dynasty Value',
      showDynastyValue: true,
      showSeasonValue: true,
    });
  });

  it('makes redraft rankings current-season first and hides dynasty by default', () => {
    expect(getValueDisplayConfig('redraft', 'rankings')).toMatchObject({
      title: 'Redraft Value Board',
      primaryLabel: 'Redraft Value',
      showDynastyValue: false,
      showSeasonValue: true,
      hideUnsupportedDynasty: true,
    });
    expect(shouldShowDynastyValue('redraft', 'rankings')).toBe(false);
    expect(shouldUseSeasonPrimary('redraft', 'rankings')).toBe(true);
  });

  it('uses redraft-specific labels for draft and trade contexts', () => {
    expect(getPrimaryValueLabel('redraft', 'draft')).toBe('Current Value');
    expect(getSecondaryValueLabel('redraft', 'draft')).toBe('Draft-Day Value');
    expect(getPrimaryValueLabel('redraft', 'trade')).toBe('Current-Season Value');
    expect(shouldShowDynastyValue('redraft', 'trade')).toBe(false);
  });

  it('selects player values and ranks from the correct source for each format', () => {
    const valueProfile = {
      dynastyValue: 9100,
      balancedValue: 8800,
      seasonValue: 6400,
      fantasyProsSeasonValue: 6200,
      fantasyCalcRedraft: 6000,
      dynastyPositionRank: 'WR3',
      balancedPositionRank: 'WR4',
      seasonPositionRank: 'WR9',
      fantasyProsPositionRank: 'WR11',
    };

    expect(getPlayerValueForMode({ valueProfile, fallbackValue: 1, mode: 'dynasty', context: 'rankings' })).toBe(9100);
    expect(getPlayerRankForMode({ valueProfile, fallbackRank: 'WR99', mode: 'dynasty', context: 'rankings' })).toBe('WR3');
    expect(getPlayerValueForMode({ valueProfile, fallbackValue: 1, mode: 'redraft', context: 'rankings' })).toBe(6400);
    expect(getPlayerRankForMode({ valueProfile, fallbackRank: 'WR99', mode: 'redraft', context: 'rankings' })).toBe('WR9');
  });

  it('allows an explicit dynasty comparison override without changing redraft defaults', () => {
    expect(shouldShowDynastyValue('redraft', 'player-detail')).toBe(false);
    expect(shouldShowDynastyValue('redraft', 'player-detail', true)).toBe(true);
  });
});
