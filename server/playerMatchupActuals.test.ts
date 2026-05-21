import { describe, expect, it } from 'vitest';
import { buildMatchupScheduleSnapshot } from './matchupScheduleSnapshots';
import { buildNflScheduleSnapshot } from './nflScheduleSnapshots';
import {
  buildPlayerMatchupActualRows,
  buildPlayerMatchupActuals,
  findPlayerMatchupArchetype,
  findPlayerOpponentHistory,
  getPlayerOpponentHistoryKey,
  type PlayerMatchupActualInputRow,
} from './playerMatchupActuals';

describe('player matchup actuals', () => {
  it('joins weekly actuals to schedule and matchup snapshots', () => {
    const schedule = buildNflScheduleSnapshot({
      season: 2026,
      source: 'NFL schedule',
      sourceVersion: 'release-1',
      rows: [
        { season: 2026, week: 1, gameId: 'jax-ari', homeTeam: 'JAC', awayTeam: 'ARI', gameStatus: 'final' },
      ],
    });
    const matchupSnapshot = buildMatchupScheduleSnapshot({
      season: 2026,
      source: 'draftsharks',
      sourceVersion: 'week-1',
      position: 'WR',
      rows: [
        {
          season: 2026,
          week: 1,
          source: 'draftsharks',
          position: 'WR',
          playerId: 'wr1',
          playerName: 'WR One',
          team: 'JAX',
          opponent: 'ARI',
          opponentRank: 29,
          matchupStars: 4.5,
          matchupTier: 'easy',
        },
      ],
    });

    const rows = buildPlayerMatchupActualRows({
      scheduleSnapshot: schedule,
      matchupSnapshots: [matchupSnapshot],
      actualRows: [
        {
          season: 2026,
          week: 1,
          playerId: 'wr1',
          playerName: 'WR One',
          team: 'JAX',
          position: 'WR',
          actualFantasyPoints: 18,
          projectedFantasyPoints: 13,
          targets: 8,
          receptions: 6,
          offenseSnapPct: 72,
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      opponent: 'ARI',
      homeAway: 'home',
      opponentRank: 29,
      matchupStars: 4.5,
      opponentStrengthBucket: 'soft',
      roleBucket: 'feature',
      resultVsProjection: 'beat',
    });
  });

  it('summarizes historical matchup archetypes into boost/caution signals', () => {
    const softHomeRows: PlayerMatchupActualInputRow[] = [
      { season: 2025, week: 1, playerId: 'wr1', playerName: 'WR One', team: 'JAX', position: 'WR', actualFantasyPoints: 14, projectedFantasyPoints: 10, targets: 7, receptions: 5, offenseSnapPct: 0.58, opponentRank: 30, homeAway: 'home' },
      { season: 2025, week: 2, playerId: 'wr2', playerName: 'WR Two', team: 'JAX', position: 'WR', actualFantasyPoints: 15, projectedFantasyPoints: 11, targets: 7, receptions: 6, offenseSnapPct: 0.57, opponentRank: 27, homeAway: 'home' },
      { season: 2025, week: 3, playerId: 'wr3', playerName: 'WR Three', team: 'JAX', position: 'WR', actualFantasyPoints: 12, projectedFantasyPoints: 10, targets: 6, receptions: 4, offenseSnapPct: 0.55, opponentRank: 31, homeAway: 'home' },
      { season: 2025, week: 4, playerId: 'wr4', playerName: 'WR Four', team: 'JAX', position: 'WR', actualFantasyPoints: 16, projectedFantasyPoints: 12, targets: 8, receptions: 6, offenseSnapPct: 0.62, opponentRank: 28, homeAway: 'home' },
      { season: 2025, week: 5, playerId: 'wr5', playerName: 'WR Five', team: 'JAX', position: 'WR', actualFantasyPoints: 13, projectedFantasyPoints: 9, targets: 6, receptions: 5, offenseSnapPct: 0.54, opponentRank: 29, homeAway: 'home' },
    ];
    const toughAwayRows: PlayerMatchupActualInputRow[] = [
      { season: 2025, week: 6, playerId: 'rb1', playerName: 'RB One', team: 'ARI', position: 'RB', actualFantasyPoints: 5, projectedFantasyPoints: 12, carries: 12, receptions: 1, offenseSnapPct: 0.55, opponentRank: 3, homeAway: 'away' },
      { season: 2025, week: 7, playerId: 'rb2', playerName: 'RB Two', team: 'ARI', position: 'RB', actualFantasyPoints: 7, projectedFantasyPoints: 14, carries: 14, receptions: 2, offenseSnapPct: 0.56, opponentRank: 5, homeAway: 'away' },
      { season: 2025, week: 8, playerId: 'rb3', playerName: 'RB Three', team: 'ARI', position: 'RB', actualFantasyPoints: 8, projectedFantasyPoints: 13, carries: 13, receptions: 2, offenseSnapPct: 0.58, opponentRank: 4, homeAway: 'away' },
      { season: 2025, week: 9, playerId: 'rb4', playerName: 'RB Four', team: 'ARI', position: 'RB', actualFantasyPoints: 6, projectedFantasyPoints: 11, carries: 11, receptions: 1, offenseSnapPct: 0.52, opponentRank: 2, homeAway: 'away' },
      { season: 2025, week: 10, playerId: 'rb5', playerName: 'RB Five', team: 'ARI', position: 'RB', actualFantasyPoints: 10, projectedFantasyPoints: 12, carries: 12, receptions: 2, offenseSnapPct: 0.55, opponentRank: 7, homeAway: 'away' },
    ];

    const result = buildPlayerMatchupActuals({
      actualRows: [...softHomeRows, ...toughAwayRows],
      minSampleSize: 5,
    });

    const wrSummary = result.summaries.find((summary) => summary.summaryKey === 'WR:starter:soft:home');
    const rbSummary = result.summaries.find((summary) => summary.summaryKey === 'RB:starter:tough:away');

    expect(wrSummary).toMatchObject({
      sampleSize: 5,
      avgProjectionError: 3.6,
      beatProjectionRate: 80,
      recommendation: 'boost',
    });
    expect(rbSummary).toMatchObject({
      sampleSize: 5,
      avgProjectionError: -5.2,
      floorMissRate: 80,
      recommendation: 'caution',
    });
    expect(result.featureCoverage).toMatchObject({
      actualRows: 10,
      projectionRows: 10,
      usageRows: 10,
      missingOpponentRows: 10,
    });

    const match = findPlayerMatchupArchetype({
      result,
      position: 'WR',
      roleBucket: 'starter',
      homeAway: 'home',
      opponentRank: 31,
    });

    expect(match?.summaryKey).toBe('WR:starter:soft:home');
    expect(match?.recommendation).toBe('boost');
  });

  it('blocks confident advice when the historical sample is too thin', () => {
    const result = buildPlayerMatchupActuals({
      minSampleSize: 5,
      actualRows: [
        { season: 2025, week: 1, playerId: 'te1', playerName: 'TE One', team: 'KC', position: 'TE', actualFantasyPoints: 14, projectedFantasyPoints: 9, targets: 6, receptions: 5, opponentRank: 28, homeAway: 'home' },
        { season: 2025, week: 2, playerId: 'te2', playerName: 'TE Two', team: 'KC', position: 'TE', actualFantasyPoints: 13, projectedFantasyPoints: 8, targets: 6, receptions: 5, opponentRank: 30, homeAway: 'home' },
      ],
    });

    expect(result.summaries).toHaveLength(1);
    expect(result.summaries[0]).toMatchObject({
      sampleSize: 2,
      recommendation: 'blocked',
    });
    expect(result.summaries[0].confidence).toBeLessThanOrEqual(35);
  });

  it('summarizes direct player-vs-opponent history across schedule snapshots', () => {
    const schedule2020 = buildNflScheduleSnapshot({
      season: 2020,
      source: 'NFL schedule',
      sourceVersion: '2020',
      rows: [
        { season: 2020, week: 6, gameId: 'buf-kc-2020', homeTeam: 'BUF', awayTeam: 'KC', gameStatus: 'final' },
      ],
    });
    const schedule2021 = buildNflScheduleSnapshot({
      season: 2021,
      source: 'NFL schedule',
      sourceVersion: '2021',
      rows: [
        { season: 2021, week: 5, gameId: 'kc-buf-2021', homeTeam: 'KC', awayTeam: 'BUF', gameStatus: 'final' },
      ],
    });
    const schedule2022 = buildNflScheduleSnapshot({
      season: 2022,
      source: 'NFL schedule',
      sourceVersion: '2022',
      rows: [
        { season: 2022, week: 6, gameId: 'kc-buf-2022', homeTeam: 'KC', awayTeam: 'BUF', gameStatus: 'final' },
      ],
    });

    const result = buildPlayerMatchupActuals({
      scheduleSnapshots: [schedule2020, schedule2021, schedule2022],
      playerOpponentMinSampleSize: 2,
      actualRows: [
        { season: 2020, week: 6, playerId: '4984', playerName: 'Josh Allen', team: 'BUF', position: 'QB', actualFantasyPoints: 16.1, projectedFantasyPoints: 20, passAttempts: 27, passingYards: 122, passingTouchdowns: 2, rushingYards: 42 },
        { season: 2021, week: 5, playerId: '4984', playerName: 'Josh Allen', team: 'BUF', position: 'QB', actualFantasyPoints: 36.5, projectedFantasyPoints: 24, passAttempts: 26, passingYards: 315, passingTouchdowns: 3, rushingYards: 59, rushingTouchdowns: 1 },
        { season: 2022, week: 6, playerId: '4984', playerName: 'Josh Allen', team: 'BUF', position: 'QB', actualFantasyPoints: 27.4, projectedFantasyPoints: 24, passAttempts: 40, passingYards: 329, passingTouchdowns: 3, interceptions: 1, rushingYards: 32 },
      ],
    });
    const historyKey = getPlayerOpponentHistoryKey({
      playerId: '4984',
      playerName: 'Josh Allen',
      position: 'QB',
      opponent: 'KC',
    });
    const history = findPlayerOpponentHistory({
      histories: result.playerOpponentHistories,
      playerId: '4984',
      position: 'QB',
      opponent: 'KC',
    });

    expect(historyKey).toBe('4984:QB:KC');
    expect(history).toMatchObject({
      historyKey: '4984:QB:KC',
      playerName: 'Josh Allen',
      opponent: 'KC',
      sampleSize: 3,
      avgFantasyPoints: 26.67,
      medianFantasyPoints: 27.4,
      highFantasyPoints: 36.5,
      lowFantasyPoints: 16.1,
      beatProjectionRate: 66.7,
      recommendation: 'boost',
    });
    expect(history?.games.map((game) => `${game.season}-W${game.week}-${game.homeAway}`)).toEqual([
      '2022-W6-away',
      '2021-W5-away',
      '2020-W6-home',
    ]);
    expect(history?.games[0].statLine).toContain('329 pass yds');
    expect(result.playerOpponentHistoryCount).toBe(1);
    expect(result.featureCoverage.scheduleJoinedRows).toBe(3);
  });
});
