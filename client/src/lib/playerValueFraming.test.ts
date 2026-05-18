import { describe, expect, it } from 'vitest';
import type { PlayerDetails } from '@shared/types';
import { getPlayerValueFraming, PLAYER_VALUE_LANGUAGE } from './playerValueFraming';

describe('getPlayerValueFraming', () => {
  it('keeps the weighted source number as Market Price', () => {
    const valueProfile: PlayerDetails['valueProfile'] = {
      dynastyValue: 6400,
      balancedValue: 6200,
      marketKtc: 6100,
      fantasyCalcDynasty: 6350,
      dynastyPositionRank: 'WR8',
      sources: ['KTC', 'FantasyCalc'],
    };

    const framing = getPlayerValueFraming({ valueProfile, mode: 'dynasty', currentValue: 5000 });

    expect(PLAYER_VALUE_LANGUAGE.marketPrice).toBe('Market Price');
    expect(framing.marketPrice).toBe(6400);
  });

  it('adds a positive Degen Gap for supported breakout/context signals', () => {
    const valueProfile: PlayerDetails['valueProfile'] = {
      dynastyValue: 5000,
      marketKtc: 5050,
      flockFantasy: 4925,
      fantasyCalcDynasty: 4975,
      dynastyPositionRank: 'WR22',
      sources: ['KTC', 'Flock Fantasy', 'FantasyCalc'],
    };
    const details = {
      valueProfile,
      playerCohort: {
        confidence: 82,
        playerId: 'wr1',
        name: 'Breakout Wideout',
        position: 'WR',
        age: 23,
        value: 5000,
        lastSeasonPointsPerGame: 13.4,
        agePhase: 'ascending',
        productionScore: 78,
        marketScore: 64,
        marketProductionDelta: -14,
        outcomeBucket: 'breakout',
        calibration: {
          evidenceGrade: 'strong',
          evidenceScore: 82,
          confidenceCap: 90,
          strongReadEligible: true,
          missingSignals: [],
          cautionFlags: [],
          note: 'Strong evidence.',
        },
        draftCapital: {
          round: 2,
          pick: 39,
          tier: 'day-two',
          label: 'Day 2',
          opportunityWindow: 'protected-runway',
          patienceScore: 78,
          note: 'Draft capital supports patience.',
        },
        peers: [],
        trace: [],
      },
      playerSituationDelta: {
        playerId: 'wr1',
        name: 'Breakout Wideout',
        position: 'WR',
        score: 76,
        action: 'buy',
        confidence: 74,
        primaryLabel: 'vacated-opportunity',
        labels: ['vacated-opportunity'],
        summary: 'Role signals improved.',
        missingSignals: [],
        cautionFlags: [],
        components: [],
        trace: [],
      },
    } as unknown as PlayerDetails;

    const framing = getPlayerValueFraming({ valueProfile, mode: 'dynasty', details });

    expect(framing.degenGap).toBeGreaterThan(0);
    expect(framing.readLabel).toMatch(/buy/i);
    expect(framing.note).toContain('Degen Gap');
  });

  it('caps Degen Gap when source confidence is thin', () => {
    const valueProfile: PlayerDetails['valueProfile'] = {
      dynastyValue: 5000,
      sources: ['KTC'],
    };
    const details = {
      valueProfile,
      playerSituationDelta: {
        playerId: 'wr2',
        name: 'Thin Wideout',
        position: 'WR',
        score: 90,
        action: 'buy',
        confidence: 90,
        primaryLabel: 'role-boost',
        labels: ['role-boost'],
        summary: 'Upside exists but source coverage is thin.',
        missingSignals: [],
        cautionFlags: [],
        components: [],
        trace: [],
      },
    } as unknown as PlayerDetails;

    const framing = getPlayerValueFraming({ valueProfile, mode: 'dynasty', details });

    expect(framing.confidence.score).toBeLessThan(46);
    expect(framing.degenGap).toBeLessThanOrEqual(130);
    expect(framing.readLabel).toBe('Thin read');
  });

  it('uses season value as the redraft Market Price', () => {
    const valueProfile: PlayerDetails['valueProfile'] = {
      dynastyValue: 7000,
      seasonValue: 4300,
      fantasyProsSeasonValue: 4250,
      fantasyCalcRedraft: 4400,
      seasonPositionRank: 'RB18',
      sources: ['FantasyPros', 'FantasyCalc Redraft'],
    };

    const framing = getPlayerValueFraming({ valueProfile, mode: 'redraft' });

    expect(framing.marketPrice).toBe(4300);
  });
});
