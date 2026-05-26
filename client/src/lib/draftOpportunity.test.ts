import { describe, expect, it } from 'vitest';
import type { DraftPick } from '@shared/types';
import { buildDraftOpportunityMap, getDraftPickKey } from './draftOpportunity';

function pick(overrides: Partial<DraftPick>): DraftPick {
  return {
    round: 1,
    pick: 1,
    playerName: 'Drafted Rookie',
    playerPos: 'WR',
    manager: 'Manager A',
    adp: null,
    ktcValue: 1000,
    currentKtcValue: 1000,
    valueGain: 0,
    draftYear: '2025',
    draftKind: 'rookie',
    player_id: `player-${overrides.pick || 1}`,
    ...overrides,
  };
}

describe('draft opportunity map', () => {
  it('compares missed opportunities within the same draft kind', () => {
    const drafted = pick({ pick: 1, playerName: 'Ashton Jeanty', currentKtcValue: 7000 });
    const startupVeteran = pick({
      pick: 2,
      playerName: "Ja'Marr Chase",
      currentKtcValue: 15000,
      draftKind: 'startup',
      draftPickCount: 160,
    });
    const laterRookie = pick({
      pick: 3,
      playerName: 'Omarion Hampton',
      currentKtcValue: 7600,
      playerDetails: { rookieYear: 2025 },
    });

    const result = buildDraftOpportunityMap([drafted, startupVeteran, laterRookie], [], 'dynasty');

    expect(result[getDraftPickKey(drafted)]).toMatchObject({
      playerName: 'Omarion Hampton',
      pickLabel: '2025 #3',
    });
  });

  it('does not suggest known veterans as rookie draft misses', () => {
    const drafted = pick({ pick: 1, playerName: 'Ashton Jeanty', currentKtcValue: 7000 });
    const veteran = pick({
      pick: 2,
      playerName: "Ja'Marr Chase",
      currentKtcValue: 15000,
      playerDetails: { rookieYear: 2021 },
    });
    const rookie = pick({
      pick: 3,
      playerName: 'Omarion Hampton',
      currentKtcValue: 7600,
      playerDetails: { rookieYear: 2025 },
    });

    const result = buildDraftOpportunityMap([drafted, veteran, rookie], [], 'dynasty');

    expect(result[getDraftPickKey(drafted)]).toMatchObject({
      playerName: 'Omarion Hampton',
      pickLabel: '2025 #3',
    });
  });

  it('uses experience as a fallback to keep veterans out of rookie draft misses', () => {
    const drafted = pick({ pick: 1, playerName: 'Ashton Jeanty', currentKtcValue: 7000 });
    const veteran = pick({
      pick: 2,
      playerName: "Ja'Marr Chase",
      currentKtcValue: 15000,
      playerDetails: { yearsExp: 5 },
    });
    const rookie = pick({
      pick: 3,
      playerName: 'Omarion Hampton',
      currentKtcValue: 7600,
      playerDetails: { yearsExp: 1 },
    });

    const result = buildDraftOpportunityMap([drafted, veteran, rookie], [], 'dynasty');

    expect(result[getDraftPickKey(drafted)]).toMatchObject({
      playerName: 'Omarion Hampton',
      pickLabel: '2025 #3',
    });
  });
});
