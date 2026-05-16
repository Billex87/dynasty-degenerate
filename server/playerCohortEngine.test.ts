import { describe, expect, it } from 'vitest';
import { buildPlayerCohortProfiles } from './playerCohortEngine';
import type { PlayerDetails } from '../shared/types';

function player(input: Partial<PlayerDetails> & { fullName: string; position: string }): PlayerDetails {
  return input as PlayerDetails;
}

describe('player cohort engine', () => {
  it('builds age, market-production, peer, and trace reads from stored player details', () => {
    const profiles = buildPlayerCohortProfiles({
      playerDetailsById: {
        wr1: player({
          fullName: 'Young Breakout',
          position: 'WR',
          age: 23,
          nflDraftRound: 1,
          nflDraftPick: 18,
          yearsExp: 1,
          lastSeasonPointsPerGame: 16,
          lastSeasonGames: 16,
          availabilitySeasons: 2,
          valueProfile: {
            dynastyValue: 5600,
            marketKtc: 5500,
            fantasyCalcDynasty: 5700,
            dynastyPositionRank: 'WR18',
            sources: ['KTC', 'FantasyCalc'],
          },
        }),
        wr2: player({
          fullName: 'Prime Peer',
          position: 'WR',
          age: 25,
          lastSeasonPointsPerGame: 15,
          lastSeasonGames: 15,
          availabilitySeasons: 2,
          valueProfile: {
            dynastyValue: 5400,
            marketKtc: 5300,
            fantasyCalcDynasty: 5500,
          },
        }),
        rb1: player({
          fullName: 'Older RB',
          position: 'RB',
          age: 29,
          lastSeasonPointsPerGame: 9,
          lastSeasonGames: 11,
          avgGamesMissed: 4.5,
          availabilitySeasons: 3,
          valueProfile: {
            dynastyValue: 5100,
            marketKtc: 5200,
            fantasyCalcDynasty: 5000,
          },
        }),
      },
    });

    expect(profiles.wr1).toMatchObject({
      agePhase: 'early',
      outcomeBucket: 'breakout',
      position: 'WR',
    });
    expect(profiles.wr1.peers).toEqual([
      expect.objectContaining({ playerId: 'wr2', name: 'Prime Peer' }),
    ]);
    expect(profiles.wr1.trace.join(' ')).toContain('Age phase: early');
    expect(profiles.wr1.trace.join(' ')).toContain('Draft capital: Round 1, pick 18');
    expect(profiles.wr1.draftCapital).toMatchObject({
      tier: 'premium',
      opportunityWindow: 'protected-runway',
    });
    expect(profiles.wr1.confidence).toBeGreaterThanOrEqual(70);
    expect(profiles.rb1.outcomeBucket).toBe('injury-risk');
  });

  it('keeps late or undrafted profiles on a shorter opportunity leash', () => {
    const profiles = buildPlayerCohortProfiles({
      playerDetailsById: {
        late: player({
          fullName: 'Late Round Bet',
          position: 'RB',
          age: 24,
          nflDraftRound: 6,
          nflDraftPick: 190,
          yearsExp: 2,
          lastSeasonPointsPerGame: 6,
          lastSeasonGames: 10,
          availabilitySeasons: 1,
          valueProfile: {
            dynastyValue: 1200,
            marketKtc: 1200,
          },
        }),
      },
    });

    expect(profiles.late.draftCapital).toMatchObject({
      tier: 'late-round',
      opportunityWindow: 'short-leash',
    });
    expect(profiles.late.trace.join(' ')).toContain('Low draft capital usually means opportunity has to be earned quickly');
  });

  it('keeps thin players conservative when value or production is missing', () => {
    const profiles = buildPlayerCohortProfiles({
      playerDetailsById: {
        te1: player({
          fullName: 'Thin Tight End',
          position: 'TE',
          age: 24,
        }),
      },
    });

    expect(profiles.te1.outcomeBucket).toBe('thin-signal');
    expect(profiles.te1.confidence).toBeLessThan(50);
    expect(profiles.te1.trace).toContain('Primary value is unavailable.');
    expect(profiles.te1.trace).toContain('Production score is unavailable.');
  });
});
