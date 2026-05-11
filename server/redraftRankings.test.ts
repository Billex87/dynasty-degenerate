import { afterEach, describe, expect, it } from 'vitest';
import {
  blendRedraftRankingRows,
  calculateRedraftSourceTrust,
  filterRedraftRowsForExpectedSeason,
  isRedraftSourceEnabled,
  type RedraftSourceTrust,
  type RedraftSourceRow,
  type RedraftSourceSnapshotPayload,
} from './redraftRankings';
import type { RankingSourceDiagnostic } from '../shared/types';

describe('redraft rankings blend', () => {
  afterEach(() => {
    delete process.env.ENABLE_REDRAFT_YAHOO;
  });

  it('normalizes platform ADP and ranking sources into one redraft-only board', () => {
    const rows = blendRedraftRankingRows({
      fantasyPros: {
        christianmccaffrey: {
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          rank: 2,
          positionRank: 'RB1',
          value: 8900,
        },
      },
      mflAdp: {
        christianmccaffrey: {
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          rank: 4,
          adp: 4.2,
        },
      },
      nflFantasy: {
        christianmccaffrey: {
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          rank: 1,
          positionRank: 'RB1',
        },
      },
    });

    expect(rows.christianmccaffrey).toMatchObject({
      name: 'Christian McCaffrey',
      position: 'RB',
      overallRank: 1,
      positionRank: 'RB1',
      sources: ['FantasyPros', 'MyFantasyLeague ADP', 'NFL Fantasy'],
    });
    expect(rows.christianmccaffrey.value).toBeGreaterThan(8000);
    expect(rows.christianmccaffrey.adp).toBe(4.2);
  });

  it('uses adaptive effective weights when blending source values', () => {
    const sourceRows = {
      fantasyPros: {
        christianmccaffrey: {
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          value: 9000,
        },
      },
      yahooDraftAnalysis: {
        christianmccaffrey: {
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          value: 1000,
        },
      },
    };

    const baseRows = blendRedraftRankingRows(sourceRows);
    const trustedRows = blendRedraftRankingRows(sourceRows, {
      sourceTrust: {
        yahooDraftAnalysis: {
          key: 'yahooDraftAnalysis',
          source: 'Yahoo Draft Analysis',
          score: 10,
          baseWeight: 0.07,
          multiplier: 0.143,
          effectiveWeight: 0.01,
          status: 'loaded',
          sampleSize: 1,
          medianConsensusDeltaPct: 0.5,
          recentSuccessRate: null,
          rowCountRatio: null,
          note: 'test low trust',
        } satisfies RedraftSourceTrust,
      },
    });

    expect(baseRows.christianmccaffrey.value).toBeLessThan(9000);
    expect(trustedRows.christianmccaffrey.value).toBeGreaterThan(baseRows.christianmccaffrey.value);
    expect(trustedRows.christianmccaffrey.value).toBeGreaterThan(8500);
  });

  it('scores aligned sources higher than consensus outliers', () => {
    const alignedRows: Record<string, RedraftSourceRow> = {};
    const outlierRows: Record<string, RedraftSourceRow> = {};
    for (let index = 1; index <= 25; index += 1) {
      const key = `player${index}`;
      alignedRows[key] = {
        name: `Player ${index}`,
        position: 'RB',
        value: 8000 - index * 40,
      };
      outlierRows[key] = {
        name: `Player ${index}`,
        position: 'RB',
        value: 1200,
      };
    }

    const diagnostics: RankingSourceDiagnostic[] = [
      {
        key: 'fantasyPros',
        source: 'FantasyPros',
        board: 'redraft',
        status: 'loaded',
        rowCount: 25,
        note: 'Loaded test rows.',
      },
      {
        key: 'mflAdp',
        source: 'MyFantasyLeague ADP',
        board: 'redraft',
        status: 'loaded',
        rowCount: 25,
        note: 'Loaded test rows.',
      },
      {
        key: 'yahooDraftAnalysis',
        source: 'Yahoo Draft Analysis',
        board: 'redraft',
        status: 'loaded',
        rowCount: 25,
        note: 'Loaded test rows.',
      },
      {
        key: 'espnFantasy',
        source: 'ESPN Fantasy',
        board: 'redraft',
        status: 'loaded',
        rowCount: 25,
        note: 'Loaded test rows.',
      },
    ];

    const trust = calculateRedraftSourceTrust({
      sourceMaps: {
        fantasyPros: alignedRows,
        mflAdp: alignedRows,
        espnFantasy: alignedRows,
        yahooDraftAnalysis: outlierRows,
      },
      diagnostics,
    });

    expect(trust.fantasyPros?.score).toBeGreaterThan(trust.yahooDraftAnalysis?.score || 0);
    expect(trust.fantasyPros?.multiplier).toBeGreaterThan(1);
    expect(trust.yahooDraftAnalysis?.multiplier).toBeLessThan(1);
    expect(trust.yahooDraftAnalysis?.sampleSize).toBe(25);
  });

  it('loses trust when a source row count collapses versus recent snapshots', () => {
    const currentRows: Record<string, RedraftSourceRow> = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [
      `player${index + 1}`,
      {
        name: `Player ${index + 1}`,
        position: 'WR',
        value: 6000 - index * 25,
      },
    ]));
    const history: RedraftSourceSnapshotPayload[] = [{
      schemaVersion: 1,
      generatedAt: '2026-05-10T00:00:00.000Z',
      snapshotKey: '2026-05-10',
      season: '2026',
      sources: {},
      diagnostics: [{
        key: 'mflAdp',
        source: 'MyFantasyLeague ADP',
        board: 'redraft',
        status: 'loaded',
        rowCount: 100,
        note: 'Loaded historical rows.',
      }],
    }];

    const trust = calculateRedraftSourceTrust({
      sourceMaps: { mflAdp: currentRows },
      diagnostics: [{
        key: 'mflAdp',
        source: 'MyFantasyLeague ADP',
        board: 'redraft',
        status: 'loaded',
        rowCount: 10,
        note: 'Loaded collapsed test rows.',
      }],
      history,
    });

    expect(trust.mflAdp?.rowCountRatio).toBe(0.1);
    expect(trust.mflAdp?.score).toBeLessThan(70);
    expect(trust.mflAdp?.multiplier).toBeLessThan(1);
  });

  it('honors redraft source environment toggles', () => {
    expect(isRedraftSourceEnabled('yahooDraftAnalysis')).toBe(true);

    process.env.ENABLE_REDRAFT_YAHOO = 'false';

    expect(isRedraftSourceEnabled('yahooDraftAnalysis')).toBe(false);
  });

  it('keeps scraping fallbacks opt-in by default in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_REDRAFT_YAHOO;
      expect(isRedraftSourceEnabled('yahooDraftAnalysis')).toBe(false);

      process.env.ENABLE_REDRAFT_YAHOO = 'true';
      expect(isRedraftSourceEnabled('yahooDraftAnalysis')).toBe(true);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('excludes stale-season source rows before blending', () => {
    const rows = filterRedraftRowsForExpectedSeason('espnFantasy', {
      current: {
        name: 'Current Player',
        position: 'RB',
        season: '2026',
        value: 5000,
      },
      stale: {
        name: 'Stale Player',
        position: 'WR',
        season: '2025',
        value: 7000,
      },
    }, '2026');

    expect(Object.keys(rows)).toEqual(['current']);
  });
});
