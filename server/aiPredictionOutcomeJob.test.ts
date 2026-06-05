import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIPredictionEvent } from './aiPredictionCalibration';
import { resolvePendingAIPredictionOutcomes } from './aiPredictionOutcomeJob';
import * as db from './db';
import * as userLoadPolicy from './loadTimeProviderPolicy';

function event(overrides: Partial<AIPredictionEvent> = {}): AIPredictionEvent {
  return {
    schemaVersion: 1,
    eventId: 'event-1',
    predictionKey: 'waiver:pickup:league-1:manager:player:p1:2026:1',
    createdAt: '2026-09-01T00:00:00.000Z',
    surface: 'waiver',
    action: 'pickup',
    decision: 'do',
    entityType: 'player',
    entityId: 'p1',
    entityName: 'Waiver Receiver',
    leagueId: 'league-1',
    manager: 'The Sample Squad',
    season: '2026',
    week: 1,
    label: 'priority',
    finalScore: 78,
    confidenceCap: 100,
    evidence: ['Available in live roster context.'],
    missingEvidence: [],
    hardBlockers: [],
    softPenalties: [],
    sourceTrace: [{ label: 'Sleeper', status: 'loaded' }],
    sourceAgreement: null,
    whyThisFired: 'Waiver read fired.',
    outcome: { status: 'pending' },
    ...overrides,
  };
}

describe('AI prediction outcome job', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves pending pickup predictions from Sleeper transaction facts', async () => {
    vi.spyOn(db, 'listPendingAiPredictionEvents').mockResolvedValue([event()]);
    const updateSpy = vi.spyOn(db, 'updateAiPredictionOutcome').mockResolvedValue(true);
    vi.spyOn(userLoadPolicy, 'fetchUserLoadJson').mockImplementation(async (url) => {
      const value = String(url);
      if (value.endsWith('/league/league-1')) return { leg: 1 };
      if (value.endsWith('/league/league-1/users')) {
        return [{ user_id: 'u1', display_name: 'Sample Manager' }];
      }
      if (value.endsWith('/league/league-1/rosters')) {
        return [{ roster_id: 1, owner_id: 'u1', metadata: { team_name: 'The Sample Squad' } }];
      }
      if (value.endsWith('/league/league-1/transactions/1')) {
        return [{
          type: 'free_agent',
          status: 'complete',
          adds: { p1: 1 },
          drops: {},
          roster_ids: [1],
          created: Date.parse('2026-09-02T00:00:00.000Z'),
        }];
      }
      if (value.endsWith('/league/league-1/matchups/1')) {
        return [{
          roster_id: 1,
          starters: ['p1'],
          players_points: { p1: 12 },
        }];
      }
      return [];
    });

    const result = await resolvePendingAIPredictionOutcomes({ limit: 10 });

    expect(result).toMatchObject({
      ok: true,
      scanned: 1,
      resolved: 1,
      pending: 0,
      failed: 0,
    });
    expect(updateSpy).toHaveBeenCalledWith({
      eventId: 'event-1',
      outcome: expect.objectContaining({
        status: 'hit',
      }),
    });
    expect(result.leagues[0]).toMatchObject({
      leagueId: 'league-1',
      weeks: [1],
      transactionFactCount: 1,
      playerStatFactCount: 1,
    });
  });

  it('leaves predictions pending when no outcome fact matches', async () => {
    vi.spyOn(db, 'listPendingAiPredictionEvents').mockResolvedValue([event({ entityId: 'p2' })]);
    const updateSpy = vi.spyOn(db, 'updateAiPredictionOutcome').mockResolvedValue(true);
    vi.spyOn(userLoadPolicy, 'fetchUserLoadJson').mockImplementation(async (url) => {
      const value = String(url);
      if (value.endsWith('/league/league-1')) return { leg: 1 };
      if (value.endsWith('/league/league-1/users')) return [];
      if (value.endsWith('/league/league-1/rosters')) return [];
      if (value.endsWith('/league/league-1/transactions/1')) return [];
      if (value.endsWith('/league/league-1/matchups/1')) return [];
      return [];
    });

    const result = await resolvePendingAIPredictionOutcomes({ limit: 10 });

    expect(result.pending).toBe(1);
    expect(result.resolved).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('resolves FAAB prediction outcomes from Sleeper waiver bids and league budget', async () => {
    vi.spyOn(db, 'listPendingAiPredictionEvents').mockResolvedValue([
      event({ metadata: { faabMin: 7, faabMax: 11 } }),
    ]);
    const updateSpy = vi.spyOn(db, 'updateAiPredictionOutcome').mockResolvedValue(true);
    vi.spyOn(userLoadPolicy, 'fetchUserLoadJson').mockImplementation(async (url) => {
      const value = String(url);
      if (value.endsWith('/league/league-1')) {
        return { leg: 1, season: '2026', settings: { waiver_budget: 200 } };
      }
      if (value.endsWith('/league/league-1/users')) {
        return [{ user_id: 'u1', display_name: 'Sample Manager' }];
      }
      if (value.endsWith('/league/league-1/rosters')) {
        return [{ roster_id: 1, owner_id: 'u1', metadata: { team_name: 'The Sample Squad' } }];
      }
      if (value.endsWith('/league/league-1/transactions/1')) {
        return [{
          type: 'waiver',
          status: 'complete',
          adds: { p1: 1 },
          drops: {},
          roster_ids: [1],
          leg: 1,
          settings: { waiver_bid: 18 },
          created: Date.parse('2026-09-02T00:00:00.000Z'),
        }];
      }
      if (value.endsWith('/league/league-1/matchups/1')) return [];
      return [];
    });

    const result = await resolvePendingAIPredictionOutcomes({ limit: 10 });

    expect(result).toMatchObject({
      resolved: 1,
      pending: 0,
      failed: 0,
    });
    expect(updateSpy).toHaveBeenCalledWith({
      eventId: 'event-1',
      outcome: expect.objectContaining({
        status: 'hit',
        actualValue: 9,
        baselineValue: 9,
        note: expect.stringContaining('Sleeper winning bid was 18 FAAB'),
      }),
    });
  });

  it('does not resolve predictions from blank waiver bids or missing matchup points', async () => {
    vi.spyOn(db, 'listPendingAiPredictionEvents').mockResolvedValue([
      event({ metadata: { faabMin: 7, faabMax: 11 } }),
    ]);
    const updateSpy = vi.spyOn(db, 'updateAiPredictionOutcome').mockResolvedValue(true);
    vi.spyOn(userLoadPolicy, 'fetchUserLoadJson').mockImplementation(async (url) => {
      const value = String(url);
      if (value.endsWith('/league/league-1')) {
        return { leg: 1, season: '2026', settings: { waiver_budget: 100 } };
      }
      if (value.endsWith('/league/league-1/users')) {
        return [{ user_id: 'u1', display_name: 'Sample Manager' }];
      }
      if (value.endsWith('/league/league-1/rosters')) {
        return [{ roster_id: 1, owner_id: 'u1', metadata: { team_name: 'The Sample Squad' } }];
      }
      if (value.endsWith('/league/league-1/transactions/1')) {
        return [{
          type: 'waiver',
          status: 'complete',
          adds: { p1: 1 },
          drops: {},
          roster_ids: [1],
          leg: 1,
          settings: { waiver_bid: '' },
          created: Date.parse('2026-09-02T00:00:00.000Z'),
        }];
      }
      if (value.endsWith('/league/league-1/matchups/1')) {
        return [{
          roster_id: 1,
          starters: ['p1'],
          players_points: { p1: null },
        }];
      }
      return [];
    });

    const result = await resolvePendingAIPredictionOutcomes({ limit: 10 });

    expect(result).toMatchObject({
      resolved: 0,
      pending: 1,
      failed: 0,
    });
    expect(result.leagues[0]).toMatchObject({
      transactionFactCount: 1,
      playerStatFactCount: 0,
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
