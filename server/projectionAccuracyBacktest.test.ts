import { describe, expect, it } from 'vitest';
import { buildNflScheduleSnapshot } from './nflScheduleSnapshots';
import { buildProjectionAccuracyBacktest, type ProjectionActualInputRow } from './projectionAccuracyBacktest';
import { buildPlayerProjectionSnapshot } from './playerProjectionSnapshots';

describe('projection accuracy backtest', () => {
  it('compares projection rows to final actuals and summarizes source accuracy', () => {
    const projectionSnapshot = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'fantasypros',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'week1-v1',
      rows: [
        { playerId: 'wr1', sourcePlayerId: 'fp-wr1', playerName: 'WR One', team: 'JAC', position: 'WR', projectedFantasyPoints: 15 },
        { playerId: 'rb1', sourcePlayerId: 'fp-rb1', playerName: 'RB One', team: 'ARI', position: 'RB', projectedFantasyPoints: 12 },
        { playerId: 'te-missing', sourcePlayerId: 'fp-te', playerName: 'TE Missing', team: 'KC', position: 'TE', projectedFantasyPoints: 7 },
      ],
    });
    const actualRows: ProjectionActualInputRow[] = [
      { season: 2026, week: 1, playerId: 'wr1', actualFantasyPoints: 17 },
      { season: 2026, week: 1, playerId: 'rb1', actualFantasyPoints: 7 },
    ];

    const result = buildProjectionAccuracyBacktest({ projectionSnapshot, actualRows });

    expect(result).toMatchObject({
      schemaVersion: 1,
      source: 'fantasypros',
      projectionType: 'weekly',
      projectedRowCount: 3,
      actualRowCount: 2,
      comparedRowCount: 2,
      missingActualCount: 1,
      decision: 'do-not-promote',
    });
    expect(result.summary).toMatchObject({
      comparedCount: 2,
      meanAbsoluteError: 3.5,
      rootMeanSquaredError: 3.81,
      bias: 1.5,
      withinFivePointRate: 100,
    });
    expect(result.byPosition.WR?.meanAbsoluteError).toBe(2);
    expect(result.byPosition.RB?.meanAbsoluteError).toBe(5);
    expect(result.largestMisses[0]).toMatchObject({ playerName: 'RB One', absoluteError: 5 });
  });

  it('uses schedule and optional buckets for home/away, opponent strength, rookie, and draft-capital groups', () => {
    const projectionSnapshot = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'fantasynerds',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'week1-v1',
      rows: [
        { playerId: 'wr-rookie', sourcePlayerId: 'fn-wr', playerName: 'Rookie WR', team: 'JAC', position: 'WR', projectedFantasyPoints: 14 },
        { playerId: 'qb-vet', sourcePlayerId: 'fn-qb', playerName: 'Veteran QB', team: 'ARI', position: 'QB', projectedFantasyPoints: 21 },
      ],
    });
    const schedule = buildNflScheduleSnapshot({
      season: 2026,
      source: 'Official schedule feed',
      sourceVersion: 'release-1',
      rows: [
        { week: 1, gameId: 'game-1', homeTeam: 'JAX', awayTeam: 'ARI', startsAt: '2026-09-13T17:00:00Z', gameStatus: 'final' },
      ],
    });

    const result = buildProjectionAccuracyBacktest({
      projectionSnapshot,
      scheduleSnapshot: schedule,
      actualRows: [
        { season: 2026, week: 1, playerId: 'wr-rookie', actualFantasyPoints: 16 },
        { season: 2026, week: 1, playerId: 'qb-vet', actualFantasyPoints: 19 },
      ],
      rookieByPlayerId: {
        'wr-rookie': true,
        'qb-vet': false,
      },
      draftCapitalBucketByPlayerId: {
        'wr-rookie': 'round-1',
        'qb-vet': 'veteran-premium-contract',
      },
      opponentStrengthByTeamPosition: {
        'ARI:WR': 'easy',
        'JAX:QB': 'hard',
      },
    });

    expect(result.comparisons.find((row) => row.playerId === 'wr-rookie')).toMatchObject({
      opponent: 'ARI',
      homeAway: 'home',
      rookieStatus: 'rookie',
      draftCapitalBucket: 'round-1',
      opponentStrengthBucket: 'easy',
    });
    expect(result.comparisons.find((row) => row.playerId === 'qb-vet')).toMatchObject({
      opponent: 'JAX',
      homeAway: 'away',
      rookieStatus: 'veteran',
      draftCapitalBucket: 'veteran-premium-contract',
      opponentStrengthBucket: 'hard',
    });
    expect(result.byHomeAway.home.comparedCount).toBe(1);
    expect(result.byOpponentStrength.easy.comparedCount).toBe(1);
    expect(result.byRookieStatus.rookie.comparedCount).toBe(1);
    expect(result.byDraftCapital['round-1'].comparedCount).toBe(1);
  });

  it('keeps projection accuracy gated when final actual sample is too thin', () => {
    const projectionSnapshot = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'internal',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'internal-v1',
      rows: [
        { playerId: 'wr1', playerName: 'WR One', team: 'JAC', position: 'WR', projectedFantasyPoints: 10 },
      ],
    });

    const result = buildProjectionAccuracyBacktest({
      projectionSnapshot,
      actualRows: [{ season: 2026, week: 1, playerId: 'wr1', actualFantasyPoints: 11 }],
    });

    expect(result.decision).toBe('do-not-promote');
    expect(result.decisionReason).toContain('Too few projection rows');
  });

  it('does not compare rows with blank projection or actual point fields as zero-point outcomes', () => {
    const baseSnapshot = buildPlayerProjectionSnapshot({
      season: 2026,
      week: 1,
      source: 'fantasypros',
      scoringProfile: 'PPR',
      projectionType: 'weekly',
      sourceVersion: 'week1-v1',
      rows: [
        { playerId: 'wr-valid', playerName: 'WR Valid', team: 'JAC', position: 'WR', projectedFantasyPoints: 10 },
      ],
    });
    const projectionSnapshot = {
      ...baseSnapshot,
      rowCount: 3,
      rows: [
        ...baseSnapshot.rows,
        { ...baseSnapshot.rows[0], playerId: 'wr-blank-projection', playerName: 'WR Blank Projection', projectedFantasyPoints: null },
        { ...baseSnapshot.rows[0], playerId: 'wr-empty-projection', playerName: 'WR Empty Projection', projectedFantasyPoints: '' },
      ],
    };

    const result = buildProjectionAccuracyBacktest({
      projectionSnapshot,
      actualRows: [
        { season: 2026, week: 1, playerId: 'wr-valid', actualFantasyPoints: 12 },
        { season: 2026, week: 1, playerId: 'wr-blank-projection', actualFantasyPoints: 8 },
        { season: 2026, week: 1, playerId: 'wr-empty-projection', actualFantasyPoints: null },
      ],
    });

    expect(result).toMatchObject({
      actualRowCount: 2,
      comparedRowCount: 1,
      missingActualCount: 2,
    });
    expect(result.comparisons).toHaveLength(1);
    expect(result.comparisons[0]).toMatchObject({
      playerId: 'wr-valid',
      actualFantasyPoints: 12,
      projectedFantasyPoints: 10,
    });
  });
});
