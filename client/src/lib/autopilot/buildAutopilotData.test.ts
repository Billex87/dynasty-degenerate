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
    expect(data.actionQueue[0]).toMatchObject({
      decision: 'watch',
      label: "Don't force it",
    });
    expect(data.actionQueue[0]?.missingEvidence.join(' ')).toContain('precondition proof');
  });

  it('keeps fallback weekly-plan copy in support-read language', () => {
    const data = buildAutopilotData({
      mode: 'redraft',
      fallback: AUTOPILOT_MOCK_DATA.redraft,
    });

    expect(data.weeklyPlan?.summary).toContain('Pressure-test');
    expect(data.weeklyPlan?.summary).not.toMatch(/\bStart\b.*\bover\b/i);
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
    expect(data.lineup[0]).toMatchObject({
      action: 'Keep started',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(data.waivers[0]?.player).toBe('Waiver Receiver');
    expect(data.waivers[0]?.action).toBe('Queue-backed pickup');
    expect(data.waivers[0]?.summary).toContain('Queue-backed');
    expect(JSON.stringify(data.waivers)).not.toContain('Do this');
    expect(data.waivers.map((recommendation) => recommendation.action)).not.toEqual(
      expect.arrayContaining(['Priority add', 'Add if available']),
    );
    expect(data.trades.some((recommendation) => recommendation.player === 'Sample Runner')).toBe(true);
    expect(data.trades.map((recommendation) => recommendation.action)).toEqual(
      expect.arrayContaining(['Shop only if return clears', 'Test offer only']),
    );
    expect(data.trades.map((recommendation) => recommendation.action)).not.toEqual(
      expect.arrayContaining(['Trade away', 'Acquire']),
    );
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
    expect(data.actionQueue.find((item) => item.target === 'Sample Quarterback')).toMatchObject({
      decision: 'hold',
      action: 'Keep started',
    });
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
    expect(data.weeklyRecap?.headline).toBe('Lineup pressure test: Sample Tight End');
    expect(data.weeklyRecap?.headline).not.toMatch(/^Start\b/);
    expect(data.weeklyRecap?.summary).toContain('This support read does not replace the Action Queue');
    expect(data.weeklyRecap?.summary).not.toContain('Start Replacement Tight End over Sample Tight End');
    expect(data.weeklyRecap?.startSitCalls).toContainEqual(expect.objectContaining({
      sit: 'Sample Tight End',
      start: 'Replacement Tight End',
      note: expect.stringContaining('Pressure-test Sample Tight End with Replacement Tight End'),
    }));
    expect(data.futurePickTrajectory?.manager).toBe('Tester');
    expect(data.futurePickTrajectory?.points.length).toBeGreaterThan(0);
    expect(data.managerTendency?.label).toBe('Thin history');
    expect(data.managerTendency?.tradeActivityScore).toBeGreaterThan(20);
    expect(data.projections.map((projection) => projection.player)).toEqual(
      expect.arrayContaining(['Depth Receiver', 'Sample Runner']),
    );
  });

  it('only renders do-this queue rows when a concrete expected action is attached', () => {
    const dynastyReport = createCachedCommandCenterReport().reportData;
    dynastyReport.recentTransactions = [];
    const staleTransactionReport = createCachedCommandCenterReport().reportData;
    const redraftReport = createCachedRedraftReport().reportData;
    const scenarios = [
      buildAutopilotData({
        reportData: dynastyReport,
        mode: 'dynasty',
        fallback: AUTOPILOT_MOCK_DATA.dynasty,
      }),
      buildAutopilotData({
        reportData: staleTransactionReport,
        mode: 'dynasty',
        fallback: AUTOPILOT_MOCK_DATA.dynasty,
      }),
      buildAutopilotData({
        reportData: redraftReport,
        mode: 'redraft',
        fallback: AUTOPILOT_MOCK_DATA.redraft,
      }),
      buildAutopilotData({
        mode: 'dynasty',
        fallback: AUTOPILOT_MOCK_DATA.dynasty,
      }),
      buildAutopilotData({
        mode: 'redraft',
        fallback: AUTOPILOT_MOCK_DATA.redraft,
      }),
    ];

    const doThisRows = scenarios.flatMap((data) => data.actionQueue.filter((item) => item.decision === 'do'));
    expect(doThisRows.length).toBeGreaterThan(0);
    doThisRows.forEach((item) => {
      expect(item.label).toBe('Do this now');
      expect(item.expectedAction?.type).toBeTruthy();
      expect(item.expectedAction?.type).not.toBe('hold');
      expect(item.expectedAction?.type).not.toBe('unknown');
      expect(item.missingEvidence.join(' ')).not.toMatch(/precondition|concrete expected action/i);
    });

    const mockRows = scenarios
      .filter((data) => !data.dataStatus)
      .flatMap((data) => data.actionQueue);
    expect(mockRows.some((item) => item.decision === 'do')).toBe(false);
  });

  it('does not treat reason-only trade expected actions as concrete queue moves', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.managerRosterIntelligence = [];
    reportData.managerPositionCounts = [];
    reportData.waiverIntelligence = undefined;
    reportData.recentTransactions = [];

    const fallback = {
      ...AUTOPILOT_MOCK_DATA.dynasty,
      lineup: [],
      waivers: [],
      trades: [{
        id: 'reason-only-trade',
        type: 'Trade',
        player: 'Vague Trade Target',
        action: 'Trade now',
        confidence: 92,
        risk: 'Medium' as const,
        upside: 'High' as const,
        summary: 'This recommendation has a rationale but no player, pick, or return details.',
        reasons: ['Needs a concrete return before it can become an action.'],
        signals: ['Trade rationale only'],
        evidenceRead: {
          evidence: ['High confidence trade rationale.'],
          missingEvidence: [],
          hardBlockers: [],
          softPenalties: [],
          confidenceCap: 100,
          confidenceCapReason: null,
          sourceTrace: [{ label: 'Trade context', status: 'loaded', detail: 'Fixture says the context is loaded.' }],
          rawScore: 92,
          finalScore: 92,
          label: 'high conviction',
          shouldRender: true,
          canAct: true,
          whyThisFired: 'Trade context is loaded but the expected action is not concrete.',
        } as any,
        expectedAction: {
          type: 'trade',
          playersInvolved: [],
          expectedRosterChange: null,
          source: 'autopilot',
          reason: 'Trade because the roster needs help.',
        },
        tone: 'good' as const,
      }],
      projections: [],
      power: [],
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback,
    });

    const tradeQueueItem = data.actionQueue.find((item) => item.id.includes('reason-only-trade'));
    expect(tradeQueueItem).toMatchObject({
      decision: 'watch',
      label: "Don't force it",
      expectedAction: {
        type: 'trade',
      },
    });
    expect(tradeQueueItem?.missingEvidence.join(' ')).toContain('missing concrete player, pick, or return details');
    expect(data.actionQueue.some((item) => item.decision === 'do')).toBe(false);
  });

  it('does not treat same-player trade expected actions as concrete queue moves', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.managerRosterIntelligence = [];
    reportData.managerPositionCounts = [];
    reportData.waiverIntelligence = undefined;
    reportData.recentTransactions = [];

    const samePlayerRef = {
      id: 'same-trade-player',
      name: 'Same Trade Player',
      position: 'RB',
      team: 'GB',
    };
    const fallback = {
      ...AUTOPILOT_MOCK_DATA.dynasty,
      lineup: [],
      waivers: [],
      trades: [{
        id: 'same-player-trade',
        type: 'Trade',
        player: 'Same Trade Player',
        action: 'Trade now',
        confidence: 93,
        risk: 'Low' as const,
        upside: 'High' as const,
        summary: 'This fixture incorrectly uses the same player on both sides of a trade.',
        reasons: ['Malformed expected action should not become a direct action.'],
        signals: ['Trade proof'],
        evidenceRead: {
          evidence: ['High confidence trade rationale.'],
          missingEvidence: [],
          hardBlockers: [],
          softPenalties: [],
          confidenceCap: 100,
          confidenceCapReason: null,
          sourceTrace: [{ label: 'Trade context', status: 'loaded', detail: 'Fixture says the context is loaded.' }],
          rawScore: 93,
          finalScore: 93,
          label: 'high conviction',
          shouldRender: true,
          canAct: true,
          whyThisFired: 'Trade context is loaded but the expected action is malformed.',
        } as any,
        expectedAction: {
          type: 'trade',
          playerIn: samePlayerRef,
          playerOut: samePlayerRef,
          playersInvolved: [samePlayerRef, samePlayerRef],
          expectedRosterChange: 'Trade Same Trade Player for Same Trade Player.',
          source: 'autopilot',
          reason: 'Malformed same-player trade fixture.',
        },
        tone: 'good' as const,
      }],
      projections: [],
      power: [],
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback,
    });

    const tradeQueueItem = data.actionQueue.find((item) => item.id.includes('same-player-trade'));
    expect(tradeQueueItem).toMatchObject({
      decision: 'watch',
      label: "Don't force it",
      expectedAction: {
        type: 'trade',
      },
    });
    expect(tradeQueueItem?.missingEvidence.join(' ')).toContain('same player on both sides');
    expect(data.actionQueue.some((item) => item.decision === 'do')).toBe(false);
  });

  it('does not treat repeated trade pieces as concrete queue moves', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.managerRosterIntelligence = [];
    reportData.managerPositionCounts = [];
    reportData.waiverIntelligence = undefined;
    reportData.recentTransactions = [];

    const repeatedPlayerRef = {
      id: 'duplicate-trade-piece',
      name: 'Duplicate Trade Piece',
      position: 'WR',
      team: 'KC',
    };
    const fallback = {
      ...AUTOPILOT_MOCK_DATA.dynasty,
      lineup: [],
      waivers: [],
      trades: [{
        id: 'repeated-trade-piece',
        type: 'Trade',
        player: 'Duplicate Trade Piece',
        action: 'Trade now',
        confidence: 94,
        risk: 'Low' as const,
        upside: 'High' as const,
        summary: 'This fixture repeats the same player as two trade pieces.',
        reasons: ['Malformed expected action should not become a direct action.'],
        signals: ['Trade proof'],
        evidenceRead: {
          evidence: ['High confidence trade rationale.'],
          missingEvidence: [],
          hardBlockers: [],
          softPenalties: [],
          confidenceCap: 100,
          confidenceCapReason: null,
          sourceTrace: [{ label: 'Trade context', status: 'loaded', detail: 'Fixture says the context is loaded.' }],
          rawScore: 94,
          finalScore: 94,
          label: 'high conviction',
          shouldRender: true,
          canAct: true,
          whyThisFired: 'Trade context is loaded but the expected action repeats a trade piece.',
        } as any,
        expectedAction: {
          type: 'trade',
          playersInvolved: [repeatedPlayerRef, repeatedPlayerRef],
          expectedRosterChange: 'Trade Duplicate Trade Piece with Duplicate Trade Piece.',
          source: 'autopilot',
          reason: 'Malformed repeated trade-piece fixture.',
        },
        tone: 'good' as const,
      }],
      projections: [],
      power: [],
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback,
    });

    const tradeQueueItem = data.actionQueue.find((item) => item.id.includes('repeated-trade-piece'));
    expect(tradeQueueItem).toMatchObject({
      decision: 'watch',
      label: "Don't force it",
      expectedAction: {
        type: 'trade',
      },
    });
    expect(tradeQueueItem?.missingEvidence.join(' ')).toContain('repeats the same player');
    expect(data.actionQueue.some((item) => item.decision === 'do')).toBe(false);
  });

  it('does not treat same-player lineup swaps as concrete queue moves', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.managerRosterIntelligence = [];
    reportData.managerPositionCounts = [];
    reportData.waiverIntelligence = undefined;
    reportData.recentTransactions = [];

    const samePlayerRef = {
      id: 'same-player',
      name: 'Same Player',
      position: 'WR',
      team: 'DAL',
    };
    const fallback = {
      ...AUTOPILOT_MOCK_DATA.dynasty,
      lineup: [{
        id: 'same-player-swap',
        type: 'Start/Sit',
        player: 'Same Player',
        action: 'Start',
        confidence: 94,
        risk: 'Low' as const,
        upside: 'High' as const,
        summary: 'This fixture incorrectly uses the same player on both sides of a lineup swap.',
        reasons: ['Malformed expected action should not become a direct action.'],
        signals: ['Lineup proof'],
        evidenceRead: {
          evidence: ['High confidence lineup rationale.'],
          missingEvidence: [],
          hardBlockers: [],
          softPenalties: [],
          confidenceCap: 100,
          confidenceCapReason: null,
          sourceTrace: [{ label: 'Lineup context', status: 'loaded', detail: 'Fixture says the context is loaded.' }],
          rawScore: 94,
          finalScore: 94,
          label: 'high conviction',
          shouldRender: true,
          canAct: true,
          whyThisFired: 'Lineup context is loaded but the expected action is malformed.',
        } as any,
        expectedAction: {
          type: 'swap_starter',
          playerIn: samePlayerRef,
          playerOut: samePlayerRef,
          playersInvolved: [samePlayerRef, samePlayerRef],
          expectedLineupChange: 'Same Player should start over Same Player.',
          source: 'autopilot',
          reason: 'Malformed same-player swap fixture.',
        },
        tone: 'good' as const,
      }],
      waivers: [],
      trades: [],
      projections: [],
      power: [],
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback,
    });

    const samePlayerQueueItem = data.actionQueue.find((item) => item.id.includes('same-player-swap'));
    expect(samePlayerQueueItem).toMatchObject({
      decision: 'watch',
      label: "Don't force it",
      expectedAction: {
        type: 'swap_starter',
      },
    });
    expect(samePlayerQueueItem?.missingEvidence.join(' ')).toContain('same player on both sides');
    expect(data.actionQueue.some((item) => item.decision === 'do')).toBe(false);
  });

  it('does not treat single-player trade ideas without partner proof as concrete queue moves', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    reportData.positionDepth = [];

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    const tradeCard = data.trades.find((recommendation) => recommendation.player === 'Sample Runner');
    expect(tradeCard).toMatchObject({
      action: 'Shop only if return clears',
      expectedAction: {
        type: 'trade',
        playerOut: {
          name: 'Sample Runner',
        },
      },
    });
    expect(tradeCard?.expectedAction?.expectedRosterChange).not.toContain('with Rival');

    const partnerlessTrade = data.actionQueue.find((item) => item.source === 'trade' && item.target === 'Sample Runner');
    expect(partnerlessTrade).toMatchObject({
      decision: 'watch',
      label: "Don't force it",
      expectedAction: {
        type: 'trade',
      },
    });
    expect(partnerlessTrade?.missingEvidence.join(' ')).toContain('missing a partner or explicit return side');
    expect(data.actionQueue.filter((item) => item.target === 'Sample Runner' && item.decision === 'do')).toHaveLength(0);
  });

  it('does not promote waiver adds without a drop candidate or open roster spot proof', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    reportData.managerRosterIntelligence = (reportData.managerRosterIntelligence || []).map((row) => ({
      ...row,
      droppablePlayers: [],
    }));

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(data.waivers[0]).toMatchObject({
      player: 'Waiver Receiver',
      action: 'Monitor only',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(data.waivers[0]?.reasons.join(' ')).toContain('No drop candidate or open roster spot proof');

    const waiverQueueItem = data.actionQueue.find((item) => item.target === 'Waiver Receiver');
    expect(waiverQueueItem).toBeDefined();
    expect(waiverQueueItem).toMatchObject({
      source: 'waiver',
      decision: 'hold',
      label: 'No forced move',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(data.actionQueue.filter((item) => item.target === 'Waiver Receiver' && item.decision === 'do')).toHaveLength(0);
  });

  it('does not treat same-player add/drop expected actions as concrete queue moves', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.managerRosterIntelligence = [];
    reportData.managerPositionCounts = [];
    reportData.waiverIntelligence = undefined;
    reportData.recentTransactions = [];

    const samePlayerRef = {
      id: 'same-add-drop-player',
      name: 'Same Add Drop Player',
      position: 'RB',
      team: 'SEA',
    };
    const fallback = {
      ...AUTOPILOT_MOCK_DATA.dynasty,
      lineup: [],
      waivers: [{
        id: 'same-player-add-drop',
        type: 'Waiver',
        player: 'Same Add Drop Player',
        action: 'Queue-backed pickup',
        confidence: 92,
        risk: 'Low' as const,
        upside: 'High' as const,
        summary: 'This fixture incorrectly adds and drops the same player.',
        reasons: ['Malformed expected action should not become a direct action.'],
        signals: ['Waiver proof'],
        evidenceRead: {
          evidence: ['High confidence waiver rationale.'],
          missingEvidence: [],
          hardBlockers: [],
          softPenalties: [],
          confidenceCap: 100,
          confidenceCapReason: null,
          sourceTrace: [{ label: 'Waiver context', status: 'loaded', detail: 'Fixture says the context is loaded.' }],
          rawScore: 92,
          finalScore: 92,
          label: 'high conviction',
          shouldRender: true,
          canAct: true,
          whyThisFired: 'Waiver context is loaded but the expected action is malformed.',
        } as any,
        expectedAction: {
          type: 'add_player',
          playerIn: samePlayerRef,
          playerOut: samePlayerRef,
          playersInvolved: [samePlayerRef, samePlayerRef],
          expectedRosterChange: 'Add Same Add Drop Player and drop Same Add Drop Player.',
          source: 'autopilot',
          reason: 'Malformed same-player add/drop fixture.',
        },
        tone: 'good' as const,
      }],
      trades: [],
      projections: [],
      power: [],
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback,
    });

    const waiverQueueItem = data.actionQueue.find((item) => item.id.includes('same-player-add-drop'));
    expect(waiverQueueItem).toMatchObject({
      source: 'waiver',
      decision: 'watch',
      label: "Don't force it",
      expectedAction: {
        type: 'add_player',
      },
    });
    expect(waiverQueueItem?.missingEvidence.join(' ')).toContain('same player');
    expect(data.actionQueue.some((item) => item.decision === 'do')).toBe(false);
  });

  it('does not promote waiver add/drop reads when the drop candidate is no longer rostered', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    reportData.managerRosterIntelligence = (reportData.managerRosterIntelligence || []).map((row) => {
      if (row.manager !== 'Tester') return row;
      const staleDrop = {
        ...(row.droppablePlayers?.[0] || row.rosterPlayers?.[0]),
        player_id: 'stale-drop',
        name: 'Stale Bench Cut',
      };
      return {
        ...row,
        droppablePlayers: [staleDrop],
      };
    });

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(data.waivers[0]).toMatchObject({
      player: 'Waiver Receiver',
      action: 'Monitor only',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(data.waivers[0]?.secondary).not.toContain('drop Stale Bench Cut');
    expect(data.waivers[0]?.reasons.join(' ')).toContain('Drop candidate proof is stale');

    const waiverQueueItem = data.actionQueue.find((item) => item.target === 'Waiver Receiver');
    expect(waiverQueueItem).toMatchObject({
      source: 'waiver',
      decision: 'hold',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(data.actionQueue.filter((item) => item.target === 'Waiver Receiver' && item.decision === 'do')).toHaveLength(0);
  });

  it('does not promote waiver add/drop reads when the drop candidate is currently starting', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    reportData.managerRosterIntelligence = (reportData.managerRosterIntelligence || []).map((row) => {
      if (row.manager !== 'Tester') return row;
      const starterDrop = row.rosterPlayers?.find((player) => player.player_id === 'te1') || row.rosterPlayers?.[0];
      return {
        ...row,
        droppablePlayers: starterDrop ? [starterDrop] : [],
      };
    });

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(data.waivers[0]).toMatchObject({
      player: 'Waiver Receiver',
      action: 'Monitor only',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(data.waivers[0]?.secondary).not.toContain('drop Sample Tight End');
    expect(data.waivers[0]?.reasons.join(' ')).toContain('Drop candidate proof points at a current starter');

    const waiverQueueItem = data.actionQueue.find((item) => item.target === 'Waiver Receiver');
    expect(waiverQueueItem).toMatchObject({
      source: 'waiver',
      decision: 'hold',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(data.actionQueue.filter((item) => item.target === 'Waiver Receiver' && item.decision === 'do')).toHaveLength(0);
  });

  it('surfaces legal stored-projection start/sit swaps without changing dynasty value copy', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    const weeklyProjection = (playerId: string, points: number) => ({
      source: 'stored-weekly-projection' as const,
      provider: 'sleeper',
      season: '2026',
      week: 1,
      scoringProfile: 'PPR',
      projectedFantasyPoints: points,
      opponent: 'KC',
      homeAway: 'home' as const,
      status: 'ready' as const,
      note: 'Stored weekly projection fixture.',
      statSummary: playerId === 'te2' ? '6 targets · 4 rec' : '3 targets · 2 rec',
    });
    const row = reportData.managerPositionCounts?.find((managerRow) => managerRow.manager === 'Tester');
    for (const player of [
      ...(row?.starterPlayers || []),
      ...(row?.lineupPlayers || []),
      ...(row?.rosterPlayers || []),
    ]) {
      if (player.player_id === 'te1') player.weeklyProjection = weeklyProjection('te1', 7.1) as any;
      if (player.player_id === 'te2') player.weeklyProjection = weeklyProjection('te2', 12.6) as any;
    }

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    const startSit = data.lineup.find((recommendation) => recommendation.id.includes('lineup-projection-swap'));
    expect(startSit).toMatchObject({
      type: 'Start/Sit',
      player: 'Replacement Tight End',
      secondary: 'over Sample Tight End',
      expectedAction: {
        type: 'swap_starter',
      },
    });
    expect(startSit?.summary).toContain('stored weekly projection edge');
    expect(startSit?.reasons.join(' ')).toContain('weekly lineup edge only');
    expect(data.weeklyPlan?.starterToReview?.player).toBe('Sample Tight End');
    expect(data.weeklyPlan?.options.map((option) => option.player)).toContain('Replacement Tight End');
  });

  it('does not promote stored-projection swaps when the replacement is unavailable', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    const weeklyProjection = (playerId: string, points: number) => ({
      source: 'stored-weekly-projection' as const,
      provider: 'sleeper',
      season: '2026',
      week: 1,
      scoringProfile: 'PPR',
      projectedFantasyPoints: points,
      opponent: 'KC',
      homeAway: 'home' as const,
      status: 'ready' as const,
      note: 'Stored weekly projection fixture.',
      statSummary: playerId === 'te2' ? '6 targets · 4 rec' : '3 targets · 2 rec',
    });
    const row = reportData.managerPositionCounts?.find((managerRow) => managerRow.manager === 'Tester');
    for (const player of [
      ...(row?.starterPlayers || []),
      ...(row?.lineupPlayers || []),
      ...(row?.rosterPlayers || []),
    ]) {
      if (player.player_id === 'te1') player.weeklyProjection = weeklyProjection('te1', 7.1) as any;
      if (player.player_id === 'te2') {
        player.weeklyProjection = weeklyProjection('te2', 12.6) as any;
        player.playerDetails = {
          ...(player.playerDetails || {}),
          injuryStatus: 'Out',
          displayStatus: 'Out',
        } as any;
      }
    }

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(data.lineup.some((recommendation) => recommendation.id.includes('lineup-projection-swap'))).toBe(false);
    expect(data.lineup.filter((recommendation) => recommendation.expectedAction?.type === 'swap_starter')).toHaveLength(0);
    expect(JSON.stringify(data.lineup)).not.toContain('stored weekly projection edge');
  });

  it('keeps generic must-start lineup reads review-only without a concrete starter swap', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    const row = reportData.managerPositionCounts?.find((managerRow) => managerRow.manager === 'Tester');
    const replacementTightEnd = row?.rosterPlayers?.find((player) => player.player_id === 'te2');
    expect(replacementTightEnd).toBeTruthy();

    reportData.matchupPreviews = [{
      week: 1,
      manager: 'Tester',
      opponentManager: 'Rival',
      mustStarts: [replacementTightEnd as any],
      vulnerableSpots: [],
      boomBustRisks: [],
      howToWin: 'Replacement Tight End has the cleanest weekly matchup.',
      source: 'manual',
      updatedAt: '2026-06-02T00:00:00.000Z',
    }];

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    const mustStartRead = data.lineup.find((recommendation) => recommendation.id.includes('lineup-start-te2'));
    expect(mustStartRead).toMatchObject({
      type: 'Lineup review',
      player: 'Replacement Tight End',
      action: 'Review starter slot',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(mustStartRead?.summary).toContain('Review the actual starter slot');
    expect(mustStartRead?.expectedAction?.expectedLineupChange).toContain('No lineup change');
    expect(mustStartRead?.expectedAction?.expectedLineupChange).not.toContain('should be in a starting lineup slot');
  });

  it('does not create AI projection claims from stale stored projection rows', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    const staleWeeklyProjection = (playerId: string, points: number) => ({
      source: 'stored-weekly-projection' as const,
      provider: 'sleeper',
      season: '2026',
      week: 1,
      scoringProfile: 'PPR',
      projectedFantasyPoints: points,
      opponent: 'KC',
      homeAway: 'home' as const,
      status: 'stale' as const,
      note: 'Stored weekly projection fixture is stale.',
      statSummary: playerId === 'te2' ? '6 targets · 4 rec' : '3 targets · 2 rec',
    });
    const row = reportData.managerPositionCounts?.find((managerRow) => managerRow.manager === 'Tester');
    for (const player of [
      ...(row?.starterPlayers || []),
      ...(row?.lineupPlayers || []),
      ...(row?.rosterPlayers || []),
    ]) {
      if (player.player_id === 'te1') player.weeklyProjection = staleWeeklyProjection('te1', 7.1) as any;
      if (player.player_id === 'te2') player.weeklyProjection = staleWeeklyProjection('te2', 12.6) as any;
    }

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    expect(data.lineup.some((recommendation) => recommendation.id.includes('lineup-projection-swap'))).toBe(false);
    expect(JSON.stringify(data.lineup)).not.toContain('stored weekly projection edge');
    expect(JSON.stringify(data.weeklyPlan || {})).not.toContain('Stored weekly projection edge');
  });

  it('keeps weak-starter reviews as hold reads until a rostered slot-eligible replacement clears', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    const testerIntel = reportData.managerRosterIntelligence?.find((row) => row.manager === 'Tester')!;
    testerIntel.injuryInsurance = {
      player_id: 'outside-te',
      name: 'Outside Tight End',
      pos: 'TE',
      owner: 'Rival',
      value: 5200,
      seasonValue: 5200,
      currentPositionRank: 'TE4',
    } as any;

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    const weakStarterRead = data.lineup.find((recommendation) => recommendation.player === 'Sample Tight End');
    expect(weakStarterRead).toMatchObject({
      action: 'Review before lock',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(weakStarterRead?.summary).toContain('no current roster replacement has cleared slot eligibility');
    expect(weakStarterRead?.reasons.join(' ')).toContain('only an insurance note');
  });

  it('allows weak-starter swap reads only when the replacement is rostered and slot-eligible', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    const testerIntel = reportData.managerRosterIntelligence?.find((row) => row.manager === 'Tester')!;
    testerIntel.injuryInsurance = testerIntel.benchPlayers?.find((player) => player.player_id === 'te2') as any;

    const data = buildAutopilotData({
      reportData,
      mode: 'dynasty',
      fallback: AUTOPILOT_MOCK_DATA.dynasty,
    });

    const weakStarterRead = data.lineup.find((recommendation) => recommendation.player === 'Sample Tight End');
    expect(weakStarterRead).toMatchObject({
      action: 'Review before lock',
      secondary: 'cover: Replacement Tight End',
      expectedAction: {
        type: 'swap_starter',
        playerIn: {
          name: 'Replacement Tight End',
        },
        playerOut: {
          name: 'Sample Tight End',
        },
      },
    });
    expect(weakStarterRead?.reasons.join(' ')).toContain('on this roster and can fit');
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
    const tradeCard = data.trades.find((recommendation) => recommendation.player === 'Sample Runner');
    expect(tradeCard).toMatchObject({
      action: 'Shop only if return clears',
      expectedAction: {
        type: 'trade',
        playerOut: {
          name: 'Sample Runner',
        },
      },
    });
    expect(tradeCard?.expectedAction?.expectedRosterChange).toContain('only if the return upgrades');
    const unprovedTrade = data.actionQueue.find((item) => item.source === 'trade' && item.target === 'Sample Runner');
    expect(unprovedTrade).toMatchObject({
      decision: 'watch',
      label: "Don't force it",
      expectedAction: {
        type: 'trade',
      },
    });
    expect(unprovedTrade?.expectedAction?.expectedRosterChange).toContain('only if the return upgrades');
    expect(unprovedTrade?.missingEvidence.join(' ')).toContain('has not cleared current roster');
    expect(unprovedTrade?.missingEvidence.join(' ')).not.toContain('no concrete expected action');
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

  it('does not promote source-only D/ST waiver targets that are rostered in the league snapshot', () => {
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

    const weeks: WaiverWeeklyEcrWeek[] = [5, 4, 4].map((star, index) => ({
      week: index + 1,
      rankEcr: 2,
      positionRank: 'DEF2',
      bestRank: null,
      worstRank: null,
      averageRank: 2,
      rankStdDev: null,
      lastUpdated: '2026-09-08T18:00:00.000Z',
      opponent: `T${index + 1}`,
      homeAway: 'home',
      opponentRank: 4,
      matchupStars: star,
      matchupTier: 'easy',
      isBye: false,
    }));
    const broncos: TrendingPlayer = {
      player_id: 'denverbroncos',
      name: 'Denver Broncos',
      pos: 'DEF',
      team: 'DEN',
      owner: null,
      count: 520,
      seasonValue: 1120,
      currentPositionRank: 'DEF2',
      playerDetails: {
        playerId: 'denverbroncos',
        fullName: 'Denver Broncos',
        position: 'DEF',
        team: 'DEN',
        valueProfile: {
          seasonValue: 1120,
          fantasyProsSeasonValue: 1120,
          seasonPositionRank: 'DEF2',
          fantasyProsPositionRank: 'DEF2',
          sources: ['FantasyPros', 'DraftSharks'],
        },
      },
    };
    const signal: WaiverWeeklyEcrSignal = {
      signalType: 'draftsharks-sos',
      playerId: 'denverbroncos',
      fantasyProsId: null,
      name: 'Denver Broncos',
      position: 'DEF',
      team: 'DEN',
      source: 'DraftSharks',
      updatedAt: '2026-09-08T18:00:00.000Z',
      weeks,
      bestWeek: 1,
      bestRankEcr: 2,
      bestPositionRank: 'DEF2',
      averageRankEcr: 2,
      rankDelta: null,
      bestMatchupStars: 5,
      bestOpponentRank: 4,
      matchupWindows: buildMatchupWindowSet(weeks, { currentWeek: 1 }),
      confidence: 90,
      note: 'Denver matchup window.',
      sourceTrace: [],
      traceSummary: 'test',
    };
    const rosteredBroncos = {
      player_id: 'broncosdst',
      name: 'Broncos D/ST',
      pos: 'DEF',
      owner: 'Rival',
      value: 1120,
      seasonValue: 1120,
      currentPositionRank: 'DEF2',
      playerDetails: {
        playerId: 'broncosdst',
        fullName: 'Broncos D/ST',
        position: 'DEF',
        team: 'DEN',
      },
    };
    reportData.managerPositionCounts = [
      ...(reportData.managerPositionCounts || []),
      {
        manager: 'Rival',
        activePlayerCount: 1,
        reservePlayerCount: 0,
        taxiPlayerCount: 0,
        totalRosterPlayerCount: 1,
        QB: 0,
        QB_starters: 0,
        RB: 0,
        RB_starters: 0,
        WR: 0,
        WR_starters: 0,
        TE: 0,
        TE_starters: 0,
        DEF: 1,
        DEF_starters: 1,
        starterPlayers: [rosteredBroncos],
        lineupPlayers: [rosteredBroncos],
        rosterPlayers: [rosteredBroncos],
      },
    ];
    reportData.waiverIntelligence = {
      rosteredTrendingAdds: [],
      availableTrendingAdds: [{ ...broncos, weeklyEcr: signal }],
      highestKtcAvailable: { ...broncos, weeklyEcr: signal },
      bestAvailableByPosition: { QB: null, RB: null, WR: null, TE: null, K: null, DEF: { ...broncos, weeklyEcr: signal } },
      bestTaxiStashes: [],
      recentlyDroppedValuable: [],
      weeklyEcrTargets: [{ player: { ...broncos, weeklyEcr: signal }, signal, score: 95 }],
      omittedCandidates: [],
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'redraft',
      fallback: AUTOPILOT_MOCK_DATA.redraft,
    });

    expect(JSON.stringify(data.waivers)).not.toContain('Denver Broncos');
    expect(JSON.stringify(data.actionQueue)).not.toContain('Denver Broncos');
  });

  it('keeps stale weekly-source waiver reads below do-this copy and queue actions', () => {
    const reportData = createCachedCommandCenterReport().reportData as ReportData;
    reportData.recentTransactions = [];
    const receiver = reportData.waiverIntelligence!.availableTrendingAdds[0]!;
    const weeks: WaiverWeeklyEcrWeek[] = [1, 2, 3].map((week) => ({
      week,
      season: '2026',
      scoring: 'PPR',
      sourceKey: `fantasypros-endpoint-v1:2026:PPR:wr-week-${week}`,
      endpointKey: `wr-week-${week}`,
      sourceStatus: 'stale',
      sourceRowCount: 120,
      sourceFetchedAt: '2026-05-01T12:00:00.000Z',
      sourceLastUpdated: '2026-05-01T12:00:00.000Z',
      rankEcr: 31,
      positionRank: 'WR31',
      averageRank: 31,
      rankStdDev: null,
      lastUpdated: '2026-05-01T12:00:00.000Z',
      opponent: `T${week}`,
      homeAway: 'home',
      opponentRank: 14,
      matchupStars: 3,
      matchupTier: 'neutral',
      isBye: false,
    }));
    const signal: WaiverWeeklyEcrSignal = {
      signalType: 'weekly-rank',
      playerId: receiver.player_id,
      fantasyProsId: 'fp-waiver1',
      name: receiver.name,
      position: 'WR',
      team: receiver.team,
      source: 'FantasyPros',
      updatedAt: '2026-05-01T12:00:00.000Z',
      weeks,
      bestWeek: 1,
      bestRankEcr: 31,
      bestPositionRank: 'WR31',
      averageRankEcr: 31,
      rankDelta: null,
      matchupWindows: buildMatchupWindowSet(weeks, { currentWeek: 1 }),
      confidence: 82,
      note: 'Stale weekly rank fixture.',
      sourceTrace: [{
        source: 'FantasyPros',
        sourceKey: 'fantasypros-endpoint-v1:2026:PPR:wr-week-1',
        endpointKey: 'wr-week-1',
        endpointLabel: 'FantasyPros WR weekly ECR',
        status: 'stale',
        season: '2026',
        scoring: 'PPR',
        week: 1,
        position: 'WR',
        rowCount: 120,
        fetchedAt: '2026-05-01T12:00:00.000Z',
        lastUpdated: '2026-05-01T12:00:00.000Z',
        evidence: 'Week 1 WR31; 120 rows; stale snapshot.',
      }],
      traceSummary: 'FantasyPros weekly ECR source trace: W1 from stored endpoint snapshots (stale).',
    };
    const staleReceiver = { ...receiver, weeklyEcr: signal };
    reportData.waiverIntelligence = {
      ...reportData.waiverIntelligence!,
      availableTrendingAdds: [staleReceiver],
      highestKtcAvailable: staleReceiver,
      bestAvailableByPosition: {
        QB: null,
        RB: null,
        WR: staleReceiver,
        TE: null,
        K: null,
        DEF: null,
      },
      weeklyEcrTargets: [{ player: staleReceiver, signal, score: 88 }],
    };

    const data = buildAutopilotData({
      reportData,
      mode: 'redraft',
      fallback: AUTOPILOT_MOCK_DATA.redraft,
    });

    expect(data.waivers[0]).toMatchObject({
      player: 'Waiver Receiver',
      action: 'Monitor only',
      expectedAction: {
        type: 'hold',
      },
    });
    expect(data.waivers[0]?.summary).toContain("Don't add yet");
    expect(data.waivers[0]?.confidence).toBeLessThan(68);
    const waiverQueueItem = data.actionQueue.find((item) => item.target === 'Waiver Receiver');
    expect(waiverQueueItem).toBeDefined();
    expect(waiverQueueItem?.decision).not.toBe('do');
    expect(waiverQueueItem?.sourceHealth.join(' ')).toContain('stale');
    expect(waiverQueueItem?.changeTriggers.join(' ')).toContain('FantasyPros WR weekly ECR');
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
    expect(data.managerTendency?.signals).toEqual(expect.arrayContaining(['4 seasons observed']));
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
