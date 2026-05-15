import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import { buildDepthChartDiagnostics, fetchEspnDepthChartsForPlayersWithDiagnostics, matchEspnDepthChartsToPlayers, parseEspnDepthChartHtml } from './espnDepthCharts';

function createDepthChartHtml(groups: unknown[]) {
  return `<script>window['__espnfitt__']=${JSON.stringify({
    page: {
      content: {
        depth: {
          dethTeamGroups: groups,
        },
      },
    },
  })};</script>`;
}

describe('ESPN depth chart parsing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses duplicate offensive rows into one actual position depth order', () => {
    const chart = parseEspnDepthChartHtml(createDepthChartHtml([
      {
        name: '3WR 1TE',
        rows: [
          ['WR', { displayName: 'Alpha One', uid: 's:20~l:28~a:111' }, { displayName: 'Charlie Three', uid: 's:20~l:28~a:333' }],
          ['WR', { displayName: 'Beta Two', uid: 's:20~l:28~a:222' }],
          ['RB', { displayName: 'Delta Four', uid: 's:20~l:28~a:444' }, { displayName: 'Echo Five', uid: 's:20~l:28~a:555' }],
        ],
      },
    ]), 'mia');

    expect(chart?.byEspnId.get('111')?.[0]).toMatchObject({ position: 'WR', order: 1 });
    expect(chart?.byEspnId.get('222')?.[0]).toMatchObject({ position: 'WR', order: 2 });
    expect(chart?.byEspnId.get('333')?.[0]).toMatchObject({ position: 'WR', order: 3 });
    expect(chart?.byEspnId.get('555')?.[0]).toMatchObject({ position: 'RB', order: 2 });
  });

  it('matches Sleeper players by ESPN id first and normalized name fallback', () => {
    const chart = parseEspnDepthChartHtml(createDepthChartHtml([
      {
        name: '3WR 1TE',
        rows: [
          ['WR', { displayName: 'Alpha One', uid: 's:20~l:28~a:111' }],
          ['WR', { displayName: 'Beta Two Jr.', uid: 's:20~l:28~a:222' }],
        ],
      },
    ]), 'mia');

    const matches = matchEspnDepthChartsToPlayers(new Map([['mia', chart]]), ['player-a', 'player-b'], {
      'player-a': { team: 'MIA', position: 'WR', full_name: 'Wrong Local Name', espn_id: '111' },
      'player-b': { team: 'MIA', position: 'WR', full_name: 'Beta Two', espn_id: null },
    });

    expect(matches['player-a']).toMatchObject({ playerName: 'Alpha One', order: 1 });
    expect(matches['player-b']).toMatchObject({ playerName: 'Beta Two Jr.', order: 2 });
  });

  it('summarizes coverage, mismatches, and failed teams for admin diagnostics', () => {
    const miaChart = parseEspnDepthChartHtml(createDepthChartHtml([
      {
        name: '3WR 1TE',
        rows: [
          ['WR', { displayName: 'Alpha One', uid: 's:20~l:28~a:111' }],
          ['WR', { displayName: 'Beta Two', uid: 's:20~l:28~a:222' }],
        ],
      },
    ]), 'mia');
    const players = {
      'player-a': { team: 'MIA', position: 'WR', full_name: 'Alpha One', espn_id: '111', depth_chart_position: 'WR', depth_chart_order: 1 },
      'player-b': { team: 'MIA', position: 'WR', full_name: 'Beta Two', espn_id: '222', depth_chart_position: 'SWR', depth_chart_order: 4 },
      'player-c': { team: 'DAL', position: 'RB', full_name: 'Gamma Three', espn_id: '333', depth_chart_position: 'RB', depth_chart_order: 1 },
    };
    const chartsByTeam = new Map([
      ['mia', miaChart],
      ['dal', null],
    ]);
    const matches = matchEspnDepthChartsToPlayers(chartsByTeam, Object.keys(players), players);
    const diagnostics = buildDepthChartDiagnostics(Object.keys(players), players, chartsByTeam, matches);

    expect(diagnostics.checkedPlayerCount).toBe(3);
    expect(diagnostics.matchedPlayerCount).toBe(2);
    expect(diagnostics.mismatchCount).toBe(1);
    expect(diagnostics.loadedTeams).toEqual(['mia']);
    expect(diagnostics.failedTeams).toEqual(['dal']);
    expect(diagnostics.durationMs).toBe(0);
  });

  it('loads player depth charts from stored snapshots without fetching ESPN live pages', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(db, 'findLatestProviderDataSnapshot').mockResolvedValue({
      snapshotKey: '2026-05-15',
      updatedAt: new Date('2026-05-15T12:00:00Z'),
      payload: JSON.stringify({
        schemaVersion: 1,
        generatedAt: '2026-05-15T12:00:00Z',
        snapshotKey: '2026-05-15',
        teams: {
          mia: [{
            team: 'mia',
            position: 'WR',
            order: 1,
            playerName: 'Alpha One',
            espnId: '111',
            groupName: '3WR 1TE',
          }],
        },
      }),
    });

    const result = await fetchEspnDepthChartsForPlayersWithDiagnostics(['player-a'], {
      'player-a': { team: 'MIA', position: 'WR', full_name: 'Wrong Local Name', espn_id: '111' },
    }, { sourceMode: 'snapshot' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.playerDepthCharts['player-a']).toMatchObject({
      playerName: 'Alpha One',
      order: 1,
    });
    expect(result.diagnostics.loadedTeams).toEqual(['mia']);
  });
});
