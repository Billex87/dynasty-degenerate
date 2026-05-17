import { describe, expect, it } from 'vitest';
import { createCachedCommandCenterReport, createCachedRedraftReport } from '../../../../tests/e2e/fixtures/cachedReports';
import { buildAutopilotData } from './buildAutopilotData';
import { AUTOPILOT_MOCK_DATA } from './mockData';

describe('buildAutopilotData', () => {
  it('falls back to mock data when no report data exists', () => {
    const data = buildAutopilotData({
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(data.dataStatus).toBeUndefined();
    expect(data.headline).toBe('Long-range roster command');
    expect(data.waivers[0]?.player).toBe('Blake Corum');
  });

  it('builds a dynasty cockpit from live report data', () => {
    const reportData = createCachedCommandCenterReport().reportData;

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(data.dataStatus).toBe('Live report data');
    expect(data.focusManager).toBe('Tester');
    expect(data.headline).toBe('Tester dynasty cockpit');
    expect(data.direction.label).toBe('Contender');
    expect(data.direction.scores.map((score) => score.label)).toEqual([
      'Win-now push',
      'Future value',
      'Trade leverage',
    ]);
    expect(data.lineup[0]?.player).toBe('Sample Quarterback');
    expect(data.waivers[0]?.player).toBe('Waiver Receiver');
    expect(data.trades.some((recommendation) => recommendation.player === 'Sample Runner')).toBe(true);
    expect(data.weeklyPlan?.starterToReview?.player).toBe('Sample Tight End');
    expect(data.weeklyPlan?.options.map((option) => option.player)).toEqual(expect.arrayContaining(['Sample Quarterback', 'Sample Receiver']));
    expect(data.weeklyRecap?.headline).toContain('Sample Tight End');
    expect(data.weeklyRecap?.startSitCalls).toContainEqual(expect.objectContaining({
      sit: 'Sample Tight End',
      start: 'Sample Quarterback',
    }));
    expect(data.futurePickTrajectory?.manager).toBe('Tester');
    expect(data.futurePickTrajectory?.points.length).toBeGreaterThan(0);
    expect(data.managerTendency?.label).toBe('Thin history');
    expect(data.managerTendency?.tradeActivityScore).toBeGreaterThan(50);
    expect(data.projections.map((projection) => projection.player)).toEqual(
      expect.arrayContaining(['Depth Receiver', 'Sample Runner']),
    );
  });

  it('switches the recommendation lens for redraft mode', () => {
    const reportData = createCachedCommandCenterReport().reportData;

    const data = buildAutopilotData({
      reportData,
      mode: 'redraft',
      fallback: AUTOPILOT_MOCK_DATA.redraft,
    });

    expect(data.headline).toBe('Tester win-now cockpit');
    expect(data.direction.label).toBe('Win-now push');
    expect(data.direction.scores.map((score) => score.label)).toEqual([
      'Weekly ceiling',
      'Floor safety',
      'Bench utility',
    ]);
    expect(data.waivers[0]?.summary).toContain('current-season profile');
    expect(data.trades.some((recommendation) => recommendation.summary.includes('weekly starter'))).toBe(true);
  });

  it('promotes schedule planning data into the weekly plan and todo list', () => {
    const reportData = {
      ...createCachedCommandCenterReport().reportData,
      schedulePlanning: {
        source: 'DraftSharks',
        status: 'ready' as const,
        updatedAt: '2026-05-11T00:00:00.000Z',
        rosterGaps: [{
          manager: 'Tester',
          position: 'RB',
          weeks: [7, 9],
          severity: 'high' as const,
          note: 'RB depth gets thin during the bye crunch.',
        }],
        streamerCandidates: [{
          playerId: 'streamer-1',
          name: 'Week 7 Streamer',
          position: 'QB',
          team: 'BUF',
          byeWeek: 12,
          seasonSOS: 42,
          scheduleTier: 'easy' as const,
          targetWeeks: [7, 9],
          note: 'Stream during the bye stack.',
        }],
        byeWeekNotes: [{
          week: 7,
          note: 'First major bye-week crunch.',
          teams: ['BUF', 'MIA'],
        }],
      },
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'redraft',
      fallback: AUTOPILOT_MOCK_DATA.redraft,
    });

    expect(data.scheduleTodo[0]).toContain('state/nfl');
    expect(data.scheduleTodo[1]).toContain('research');
    expect(data.scheduleTodo[2]).toContain('player_id');
    expect(data.scheduleTodo[3]).toContain('depth_chart');
    expect(data.scheduleTodo.some((todo) => todo.includes('Schedule planning is live'))).toBe(true);
    expect(data.scheduleTodo.some((todo) => todo.includes('Week 7 is the first bye-week checkpoint'))).toBe(true);
    expect(data.weeklyPlan?.options.some((option) => option.player === 'Week 7 Streamer')).toBe(true);
  });

  it('preserves redraft league mode as a current-season read', () => {
    const reportData = createCachedRedraftReport().reportData;

    const data = buildAutopilotData({
      reportData,
      mode: 'redraft',
      fallback: AUTOPILOT_MOCK_DATA.redraft,
    });

    expect(data.dataStatus).toBe('Live report data');
    expect(data.focusManager).toBe('Tester');
    expect(data.direction.scores[0]?.label).toBe('Weekly ceiling');
    expect(data.systemRead.find((score) => score.label === 'Roster data')?.tone).toBe('warn');
    expect(data.lineup[0]?.player).toBe(AUTOPILOT_MOCK_DATA.redraft.lineup[0]?.player);
  });

  it('raises manager tendency confidence when multi-season history is present', () => {
    const cachedReport = createCachedCommandCenterReport();
    const reportData = {
      ...cachedReport.reportData,
      standingsHistory: ['2022', '2023', '2024', '2025'].flatMap((season, index) => [
        { season, manager: 'Tester', rank: index < 3 ? 1 : 2, wins: 10, losses: 4, ties: 0, pointsFor: 1700 - index * 20 },
        { season, manager: 'Rival', rank: index < 3 ? 2 : 1, wins: 8, losses: 6, ties: 0, pointsFor: 1500 + index * 10 },
      ]),
      tradeHistory: [
        ...cachedReport.reportData.tradeHistory,
        ...['2023', '2024', '2025'].map((season, index) => ({
          date: `${season}-05-0${index + 1}`,
          season,
          team_a: 'Tester',
          team_b: 'Rival',
          team_a_items: 'Depth Receiver',
          team_b_items: 'Future pick',
          team_a_total: 3000,
          team_b_total: 2400,
          point_gap: 600,
          winner: 'Tester',
          winners: ['Tester'],
        })),
      ],
      recentTransactions: [
        { id: 'tx-1', date: '2026-05-01', manager: 'Tester', type: 'Waiver' as const, bidAmount: 7, addedPlayer: null, droppedPlayer: null, alternativeDrop: null, note: 'Added depth.', losingBidsAvailable: false },
        { id: 'tx-2', date: '2026-05-02', manager: 'Tester', type: 'Free Agent' as const, bidAmount: null, addedPlayer: null, droppedPlayer: null, alternativeDrop: null, note: 'Churned bench.', losingBidsAvailable: false },
      ],
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(data.managerTendency?.historyDepthScore).toBeGreaterThan(70);
    expect(data.managerTendency?.competitiveConsistencyScore).toBeGreaterThan(70);
    expect(data.managerTendency?.signals).toEqual(expect.arrayContaining(['4 seasons tracked']));
    expect(data.direction.confidence).toBeGreaterThan(86);
  });

  it('caps AI read confidence when league confidence is low', () => {
    const reportData = createCachedCommandCenterReport().reportData;
    const lowConfidenceReport = {
      ...reportData,
      leagueDiagnostics: {
        ...reportData.leagueDiagnostics!,
        aiConfidence: {
          score: 34,
          label: 'Low confidence',
          note: 'Thin league memory.',
          previousScore: null,
          scoreDelta: null,
          signals: [],
          managerConfidence: [{
            manager: 'Tester',
            score: 31,
            label: 'Low confidence',
            note: 'Thin manager memory.',
            previousScore: null,
            scoreDelta: null,
            signals: [],
          }],
        },
      },
    };

    const data = buildAutopilotData({
      reportData: lowConfidenceReport,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    const cap = 47;
    expect(data.direction.confidence).toBeLessThanOrEqual(cap);
    expect(data.lineup.every((recommendation) => recommendation.confidence <= cap)).toBe(true);
    expect(data.waivers.every((recommendation) => recommendation.confidence <= cap)).toBe(true);
    expect(data.trades.every((recommendation) => recommendation.confidence <= cap)).toBe(true);
    expect(data.projections.every((projection) => projection.confidence <= cap)).toBe(true);
    expect(data.systemRead[0]).toMatchObject({
      label: 'League AI confidence',
      value: 34,
    });
  });
});
