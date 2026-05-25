import { describe, expect, it } from 'vitest';
import { evaluateRecommendationOutcome } from '../shared/recommendationOutcome';

describe('recommendation outcome inference', () => {
  it('marks add-player recommendations complete when roster sync shows the add', () => {
    const outcome = evaluateRecommendationOutcome({
      expectedAction: {
        type: 'waiver_add',
        playerIn: { id: 'p1', name: 'Waiver Receiver' },
      },
      previousRosterState: {
        manager: 'Sample Manager',
        rosterPlayerIds: ['old-player'],
      },
      currentRosterState: {
        manager: 'Sample Manager',
        rosterPlayerIds: ['old-player', 'p1'],
      },
      now: '2026-09-02T12:00:00.000Z',
    });

    expect(outcome).toMatchObject({
      status: 'observed_completed',
      confidence: 78,
      evidence: {
        reason: 'Recommended player appeared on roster after sync',
        playerId: 'p1',
        before: 'not_on_roster',
        after: 'on_roster',
        detectedFrom: 'roster_sync',
      },
    });
  });

  it('marks start-over recommendations ignored when the original starter stays in after expiration', () => {
    const outcome = evaluateRecommendationOutcome({
      expectedAction: {
        type: 'swap_starter',
        playerIn: { id: 'player-a', name: 'Player A' },
        playerOut: { id: 'player-b', name: 'Player B' },
      },
      currentLineupState: {
        manager: 'Sample Manager',
        rosterPlayerIds: ['player-a', 'player-b'],
        starterPlayerIds: ['player-b'],
      },
      now: '2026-09-05T12:00:00.000Z',
      expiresAt: '2026-09-04T12:00:00.000Z',
    });

    expect(outcome).toMatchObject({
      status: 'observed_ignored',
      evidence: {
        reason: 'Recommendation expired and the previous starter stayed in over the recommended player',
        playerId: 'player-a',
        after: 'original_starter_kept',
        detectedFrom: 'lineup_sync',
      },
    });
  });

  it('marks drop-for-add recommendations partially complete when only the drop happened', () => {
    const outcome = evaluateRecommendationOutcome({
      expectedAction: {
        type: 'drop_for_add',
        playerIn: { id: 'player-b', name: 'Player B' },
        playerOut: { id: 'player-a', name: 'Player A' },
      },
      transactionHistory: [
        { type: 'drop', playerId: 'player-a', playerName: 'Player A', manager: 'Sample Manager' },
        { type: 'add', playerId: 'player-c', playerName: 'Player C', manager: 'Sample Manager' },
      ],
      currentRosterState: {
        manager: 'Sample Manager',
        rosterPlayerIds: ['player-c'],
      },
      now: '2026-09-02T12:00:00.000Z',
    });

    expect(outcome).toMatchObject({
      status: 'observed_partially_completed',
      evidence: {
        reason: 'Only part of the recommended add/drop move was observed',
        after: 'expected_drop_completed_without_recommended_add',
        detectedFrom: 'transaction_history',
        details: {
          alternateAddPlayerId: 'player-c',
          alternateAddPlayerName: 'Player C',
        },
      },
    });
  });

  it('does not over-credit add recommendations when the player was already rostered', () => {
    const outcome = evaluateRecommendationOutcome({
      expectedAction: {
        type: 'add_player',
        playerIn: { id: 'player-a', name: 'Player A' },
      },
      previousRosterState: {
        manager: 'Sample Manager',
        rosterPlayerIds: ['player-a'],
      },
      currentRosterState: {
        manager: 'Sample Manager',
        rosterPlayerIds: ['player-a'],
      },
      now: '2026-09-02T12:00:00.000Z',
    });

    expect(outcome).toMatchObject({
      status: 'unknown',
      confidence: 36,
      evidence: {
        reason: 'Recommended add player was already on the roster before the observation window',
        before: 'on_roster',
        after: 'on_roster',
        detectedFrom: 'roster_sync',
      },
    });
  });

  it('marks contradicted recommendations when transaction history shows the opposite move', () => {
    const outcome = evaluateRecommendationOutcome({
      expectedAction: {
        type: 'drop_player',
        playerOut: { id: 'player-a', name: 'Player A' },
      },
      transactionHistory: [
        { type: 'add', playerId: 'player-a', playerName: 'Player A', manager: 'Sample Manager' },
      ],
      now: '2026-09-02T12:00:00.000Z',
    });

    expect(outcome).toMatchObject({
      status: 'observed_contradicted',
      evidence: {
        reason: 'Recommended drop player was added instead of removed',
        detectedFrom: 'transaction_history',
      },
    });
  });
});
