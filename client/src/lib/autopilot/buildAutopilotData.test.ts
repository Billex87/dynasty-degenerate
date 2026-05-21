import { describe, expect, it } from 'vitest';
import { createCachedCommandCenterReport, createCachedRedraftReport } from '../../../../tests/e2e/fixtures/cachedReports';
import { buildMatchupWindowSet } from '@shared/matchupWindows';
import type { ReportAICalibrationAdjustmentProfile, ReportData, TrendingPlayer, WaiverWeeklyEcrSignal, WaiverWeeklyEcrWeek } from '@shared/types';
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
    expect(data.actionQueue[0]?.label).toBe('Do this now');
  });

  it('builds a dynasty cockpit from live report data', () => {
    const reportData = createCachedCommandCenterReport().reportData;
    reportData.recentTransactions = [];

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
    expect(data.actionQueue[0]).toMatchObject({
      decision: 'do',
      label: 'Do this now',
    });
    expect(data.actionQueue[0]?.changeTriggers.length).toBeGreaterThan(0);
    expect(data.actionQueue[0]?.changeTriggers.join(' ')).toMatch(/blocker|confidence|partner|ownership|threshold|trade|pickup|lineup/i);
    expect(data.actionQueue[0]?.dominoEffects?.length).toBeGreaterThan(0);
    expect(data.actionQueue.filter((item) => item.decision === 'do')).toHaveLength(1);
    expect(data.actionQueue.map((item) => item.source)).toEqual(
      expect.arrayContaining(['lineup', 'trade']),
    );
    expect(data.rejections.length).toBeGreaterThan(0);
    expect(data.rejections.some((row) => /do not|force/i.test(row.action))).toBe(true);
    expect(data.marketAnomalies.map((row) => row.player)).toEqual(
      expect.arrayContaining(['Depth Receiver', 'Sample Runner']),
    );
    expect(data.reportCard?.rows.map((row) => row.label)).toEqual(
      expect.arrayContaining(['One-call discipline', 'Bad-idea engine', 'Market anomaly scan', 'Calibration memory']),
    );
    expect(data.weeklyPlan?.starterToReview?.player).toBe('Sample Tight End');
    expect(data.weeklyPlan?.options.map((option) => option.player)).toEqual(['Replacement Tight End']);
    expect(data.weeklyPlan?.options.map((option) => option.player)).not.toEqual(expect.arrayContaining(['Sample Quarterback', 'Sample Receiver']));
    expect(data.weeklyRecap?.headline).toContain('Sample Tight End');
    expect(data.weeklyRecap?.startSitCalls).toContainEqual(expect.objectContaining({
      sit: 'Sample Tight End',
      start: 'Replacement Tight End',
    }));
    expect(data.futurePickTrajectory?.manager).toBe('Tester');
    expect(data.futurePickTrajectory?.points.length).toBeGreaterThan(0);
    expect(data.managerTendency?.label).toBe('Thin history');
    expect(data.managerTendency?.tradeActivityScore).toBeGreaterThan(20);
    expect(data.projections.map((projection) => projection.player)).toEqual(
      expect.arrayContaining(['Depth Receiver', 'Sample Runner']),
    );
  });

  it('does not promote omitted waiver candidates from stale cached waiver slots', () => {
    const reportData = createCachedCommandCenterReport().reportData;
    const omittedCandidate = reportData.waiverIntelligence?.omittedCandidates?.[0];
    expect(omittedCandidate?.name).toBe('Dallen Bentley');

    reportData.waiverIntelligence!.bestTaxiStashes = [{
      player_id: omittedCandidate!.player_id,
      name: omittedCandidate!.name,
      pos: omittedCandidate!.pos,
      team: omittedCandidate!.team,
      owner: null,
      count: 0,
      ktcValue: omittedCandidate!.value,
      currentPositionRank: omittedCandidate!.rank,
    }];

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(JSON.stringify(data.waivers)).not.toContain('Dallen Bentley');
  });

  it('does not promote stale available waiver players already added in transactions', () => {
    const reportData = createCachedCommandCenterReport().reportData;

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(JSON.stringify(data.waivers)).not.toContain('Waiver Receiver');
    expect(JSON.stringify(data.waivers)).not.toContain('Blake Corum');
    expect(JSON.stringify(data.actionQueue)).not.toContain('Waiver Receiver');
    expect(JSON.stringify(data.actionQueue)).not.toContain('Blake Corum');
  });

  it('downranks D/ST waiver targets with rough early matchup windows', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.leagueDiagnostics = {
      ...reportData.leagueDiagnostics!,
      starterSlots: [
        ...(reportData.leagueDiagnostics?.starterSlots || []),
        'DEF',
      ],
      rosterSlots: [
        ...(reportData.leagueDiagnostics?.rosterSlots || []),
        'DEF',
      ],
    };
    const makeDefense = (
      player_id: string,
      name: string,
      team: string,
      rank: string,
      value: number,
      stars: number[],
    ): { player: TrendingPlayer; signal: WaiverWeeklyEcrSignal } => {
      const weeks: WaiverWeeklyEcrWeek[] = stars.map((star, index) => ({
        week: index + 1,
        rankEcr: Number(rank.replace(/\D/g, '')) || 12,
        positionRank: rank,
        bestRank: null,
        worstRank: null,
        averageRank: Number(rank.replace(/\D/g, '')) || 12,
        rankStdDev: null,
        lastUpdated: '2026-09-08T18:00:00.000Z',
        opponent: `T${index + 1}`,
        homeAway: 'home',
        opponentRank: star >= 4 ? 4 : star <= 2 ? 28 : 16,
        matchupStars: star,
        matchupTier: star >= 4 ? 'easy' : star <= 2 ? 'hard' : 'neutral',
        isBye: false,
      }));
      const player: TrendingPlayer = {
        player_id,
        name,
        pos: 'DEF',
        team,
        owner: null,
        count: 0,
        ktcValue: value,
        currentPositionRank: rank,
      };
      const signal: WaiverWeeklyEcrSignal = {
        signalType: 'draftsharks-sos',
        playerId: player_id,
        fantasyProsId: null,
        name,
        position: 'DEF',
        team,
        source: 'DraftSharks',
        updatedAt: '2026-09-08T18:00:00.000Z',
        weeks,
        bestWeek: 1,
        bestRankEcr: Number(rank.replace(/\D/g, '')) || 12,
        bestPositionRank: rank,
        averageRankEcr: Number(rank.replace(/\D/g, '')) || 12,
        rankDelta: null,
        bestMatchupStars: Math.max(...stars),
        bestOpponentRank: 4,
        matchupWindows: buildMatchupWindowSet(weeks, { currentWeek: 1 }),
        confidence: 90,
        note: `${name} matchup window.`,
        sourceTrace: [],
        traceSummary: 'test',
      };
      return { player: { ...player, weeklyEcr: signal }, signal };
    };
    const rams = makeDefense('rams', 'Los Angeles Rams', 'LAR', 'DEF4', 5000, [1, 3, 2]);
    const streamer = makeDefense('streamer', 'Streaming Defense', 'LV', 'DEF12', 500, [5, 4, 4]);
    reportData.waiverIntelligence = {
      rosteredTrendingAdds: [],
      availableTrendingAdds: [rams.player, streamer.player],
      highestKtcAvailable: rams.player,
      bestAvailableByPosition: {
        QB: null,
        RB: null,
        WR: null,
        TE: null,
        K: null,
        DEF: rams.player,
      },
      bestTaxiStashes: [],
      recentlyDroppedValuable: [],
      weeklyEcrTargets: [
        { player: rams.player, signal: rams.signal, score: 95 },
        { player: streamer.player, signal: streamer.signal, score: 90 },
      ],
      omittedCandidates: [],
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'redraft',
      fallback: AUTOPILOT_MOCK_DATA.redraft,
    });

    expect(data.waivers[0]?.player).toBe('Streaming Defense');
    expect(JSON.stringify(data.waivers)).not.toContain('Los Angeles Rams');
    expect(data.actionQueue[0]?.target).toBe('Streaming Defense');
    expect(data.actionQueue[0]?.changeTriggers.join(' ')).toContain('DraftSharks');
    expect(JSON.stringify(data.actionQueue)).not.toContain('Los Angeles Rams');
  });

  it('switches the recommendation lens for redraft mode', () => {
    const reportData = createCachedCommandCenterReport().reportData;
    reportData.recentTransactions = [];

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
    expect(data.waivers[0]?.summary).toContain('current-season waiver case');
    expect(data.waivers[0]?.summary).not.toContain('stash');
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
        }, {
          playerId: 'streamer-2',
          name: 'Waiver Tight End Streamer',
          position: 'TE',
          team: 'LV',
          byeWeek: 10,
          seasonSOS: 39,
          scheduleTier: 'easy' as const,
          targetWeeks: [8],
          note: 'Same-position streamer target.',
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
    expect(data.weeklyPlan?.options.some((option) => option.player === 'Week 7 Streamer')).toBe(false);
    expect(data.weeklyPlan?.options.some((option) => option.player === 'Waiver Tight End Streamer')).toBe(false);
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
    expect(data.direction.confidence).toBeGreaterThan(84);
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
    expect(data.actionQueue[0]).toMatchObject({
      decision: 'hold',
      label: 'No move is best',
    });
    expect(data.actionQueue[0]?.changeTriggers.join(' ')).toContain('clear the action threshold');
    expect(data.systemRead[0]).toMatchObject({
      label: 'League AI confidence',
      value: 34,
    });
  });

  it('applies outcome calibration adjustments to live waiver decisions', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    const calibrationProfile: ReportAICalibrationAdjustmentProfile = {
      schemaVersion: 1,
      generatedFrom: 'ai-prediction-events',
      generatedAt: '2026-05-21T12:00:00.000Z',
      eventCount: 30,
      scoredCount: 24,
      pendingCount: 6,
      globalAdjustment: {
        key: 'global',
        scope: 'global',
        group: {},
        eventCount: 30,
        scoredCount: 24,
        pendingCount: 6,
        hitRate: 0.5,
        avgConfidence: 72,
        calibrationGap: -12,
        brierScore: 0.31,
        scoreAdjustment: 0,
        confidenceCap: null,
        recommendation: 'calibrated',
        priority: 'info',
        reason: 'Global reads are calibrated enough to keep current scoring.',
      },
      adjustments: [{
        key: 'surface:autopilot|action:pickup',
        scope: 'surfaceAction',
        group: { surface: 'autopilot', action: 'pickup' },
        eventCount: 12,
        scoredCount: 10,
        pendingCount: 2,
        hitRate: 0.2,
        avgConfidence: 78,
        calibrationGap: -30,
        brierScore: 0.44,
        scoreAdjustment: -28,
        confidenceCap: 52,
        recommendation: 'lower-confidence',
        priority: 'warn',
        reason: 'Autopilot pickup calls have been overconfident against resolved outcomes.',
      }],
    };

    const data = buildAutopilotData({
      reportData: {
        ...reportData,
        aiCalibrationAdjustmentProfile: calibrationProfile,
      },
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(data.waivers.length).toBeGreaterThan(0);
    expect(data.waivers.every((recommendation) => recommendation.confidence <= 52)).toBe(true);
    expect(data.waivers[0]?.signals).toEqual(expect.arrayContaining(['Outcome-calibrated']));
    expect(data.waivers[0]?.reasons.join(' ')).toContain('overconfident');
    expect(data.reportCard?.rows.find((row) => row.label === 'Calibration memory')?.status).toContain('24 scored');
    expect(data.reportCard?.rows.find((row) => row.label === 'Calibration memory')?.detail).toContain('overconfident');
  });

  it('surfaces server-side daily deltas in the AI report card', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;

    const data = buildAutopilotData({
      reportData: {
        ...reportData,
        serverReportDelta: {
          schemaVersion: 1,
          source: 'server-cache',
          generatedAt: '2026-05-21T12:00:00.000Z',
          baselineGeneratedAt: '2026-05-20T12:00:00.000Z',
          summary: 'Waiver Receiver is now the first waiver name to review.',
          changes: [{
            id: 'top-waiver',
            label: 'Waiver target changed',
            summary: 'Waiver Receiver is now the first waiver name to review.',
            detail: 'WR55 | DraftSharks schedule',
            tone: 'info',
            priority: 5,
            receipts: ['Previous: Depth Receiver', 'Current: Waiver Receiver'],
          }],
        },
      },
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    const dailyDelta = data.reportCard?.rows.find((row) => row.label === 'Daily delta');
    expect(dailyDelta?.status).toBe('1 server change');
    expect(dailyDelta?.detail).toContain('Waiver Receiver');
    expect(dailyDelta?.tone).toBe('info');
  });
});
