import { describe, expect, it } from 'vitest';
import { buildPlayerProjectionContext } from './playerProjectionContext';
import { buildProjectionAccuracyBacktest } from './projectionAccuracyBacktest';
import {
  buildAllProjectionRolloutFixtures,
  buildProjectionRolloutFixture,
} from './projectionRolloutFixtures';

describe('projection rollout fixtures', () => {
  it('builds all planned rollout scenarios with projection, schedule, actual, and context data', () => {
    const fixtures = buildAllProjectionRolloutFixtures();

    expect(fixtures.map((fixture) => fixture.scenario)).toEqual([
      'normal-week',
      'bye-heavy-week',
      'injury-heavy-week',
      'rookies-heavy-roster',
      'playoff-matchup-week',
    ]);
    for (const fixture of fixtures) {
      expect(fixture.projectionSnapshot.rowCount).toBeGreaterThan(0);
      expect(fixture.scheduleSnapshot.rowCount).toBeGreaterThan(0);
      expect(fixture.actualRows.length).toBeGreaterThan(0);
      expect(fixture.description).toBeTruthy();
    }
  });

  it('feeds fixture context maps through the projection context join', () => {
    const fixture = buildProjectionRolloutFixture('normal-week');
    const context = buildPlayerProjectionContext({
      projectionSnapshot: fixture.projectionSnapshot,
      scheduleSnapshot: fixture.scheduleSnapshot,
      ...fixture.contextMaps,
    });

    expect(context.status).toBe('ready');
    expect(context.rows.find((row) => row.playerId === 'fixture-wr-normal')).toMatchObject({
      opponentDefense: {
        fantasyPointsAllowedRank: 25,
      },
      gameEnvironment: {
        vegasTotal: 46.5,
      },
      depthChart: {
        starterStatus: 'starter',
      },
    });
  });

  it('keeps bye-heavy fixtures useful for missing-schedule fallback tests', () => {
    const fixture = buildProjectionRolloutFixture('bye-heavy-week');
    const context = buildPlayerProjectionContext({
      projectionSnapshot: fixture.projectionSnapshot,
      scheduleSnapshot: fixture.scheduleSnapshot,
      ...fixture.contextMaps,
    });

    expect(context.status).toBe('partial');
    expect(context.missingScheduleCount).toBeGreaterThan(0);
    expect(context.rows.find((row) => row.playerId === 'fixture-rb-bye')?.schedule.homeAway).toBe('bye');
  });

  it('supports offline projection accuracy backtests from fixture actuals', () => {
    const fixture = buildProjectionRolloutFixture('playoff-matchup-week');
    const backtest = buildProjectionAccuracyBacktest({
      projectionSnapshot: fixture.projectionSnapshot,
      scheduleSnapshot: fixture.scheduleSnapshot,
      actualRows: fixture.actualRows,
    });

    expect(backtest.comparedRowCount).toBe(1);
    expect(backtest.byHomeAway.home.comparedCount).toBe(1);
    expect(backtest.byOpponentStrength.hard.comparedCount).toBe(1);
    expect(backtest.largestMisses[0]).toMatchObject({
      playerId: 'fixture-qb-playoff',
      opponent: 'BAL',
      homeAway: 'home',
    });
  });
});
