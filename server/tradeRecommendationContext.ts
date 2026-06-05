import type {
  DynastyContentionPlayerRead,
  DynastyContentionRosterWindow,
  ManagerIntelPlayer,
  ReportData,
  RookieDevelopmentRead,
  TradeRecommendationContext,
  TradeRecommendationRead,
} from '../shared/types';

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getProjectionStatus(reportData: ReportData): TradeRecommendationContext['projectionStatus'] {
  const status = reportData.weeklyProjectionDiagnostics?.status;
  if (status === 'ready' || status === 'warning' || status === 'blocked') return status;
  return 'missing';
}

function getRosterWindow(manager: string, reportData: ReportData): DynastyContentionRosterWindow {
  const row = reportData.dynastyContentionContext?.managers?.find((item) => item.manager === manager);
  if (row?.rosterWindow) return row.rosterWindow;
  const timeline = reportData.dynastyTimelines?.find((item) => item.manager === manager);
  if ((timeline?.contenderScore || 0) >= (timeline?.rebuildScore || 0) + 8) return 'contender';
  if ((timeline?.rebuildScore || 0) >= (timeline?.contenderScore || 0) + 8) return 'rebuilder';
  return 'middle';
}

function getPlayerId(player: ManagerIntelPlayer | null | undefined): string | null {
  return player?.player_id || null;
}

function getFantasyProsComparePlayerTrace(
  playerId: string | null,
  reportData: ReportData
): string | null {
  if (!playerId) return null;
  const trace = reportData.playerDetailsById?.[playerId]?.valueProfile?.fantasyProsSourceTrace
    ?.find((row) => row.key === 'COMPARE_PLAYERS');
  if (!trace) return null;
  const evidence = trace.evidence || 'stored FantasyPros compare-player snapshot';
  return `fantasypros-compare-players:${evidence}`;
}

function getPlayoffLeverageScore(
  playerId: string | null,
  manager: string,
  reportData: ReportData
): number | null {
  if (!playerId) return null;
  const planning: any = reportData.playoffSchedulePlanning;
  const actionItems = Array.isArray(planning?.actionItems) ? planning.actionItems : [];
  let score = 0;
  for (const item of actionItems) {
    const itemManager = item?.manager;
    const affected = Array.isArray(item?.affectedPlayers) ? item.affectedPlayers : [];
    const replacements = Array.isArray(item?.replacementTargets) ? item.replacementTargets : [];
    if (itemManager === manager && affected.some((player: any) => getPlayerId(player) === playerId || player?.playerId === playerId)) {
      score += item?.type === 'cover-risk' ? 18 : 10;
    }
    if (replacements.some((player: any) => getPlayerId(player) === playerId || player?.playerId === playerId)) {
      score += itemManager === manager ? 28 : 18;
    }
  }
  return score > 0 ? clampScore(score) : null;
}

function getContenderFit(input: {
  rosterWindow: DynastyContentionRosterWindow;
  shortTermValue: number | null;
  dynastyValue: number | null;
  projectedFantasyPoints: number | null;
  playoffLeverageScore: number | null;
}): number {
  const valueGap = (input.shortTermValue || 0) - (input.dynastyValue || 0);
  return clampScore(
    (input.rosterWindow === 'contender' ? 28 : input.rosterWindow === 'middle' ? 18 : 8) +
    Math.max(0, valueGap) / 90 +
    (input.projectedFantasyPoints || 0) * 2.4 +
    (input.playoffLeverageScore || 0) * 0.45
  );
}

function getRebuilderFit(input: {
  rosterWindow: DynastyContentionRosterWindow;
  shortTermValue: number | null;
  dynastyValue: number | null;
  sourceAction?: string | null;
}): number {
  const valueGap = (input.dynastyValue || 0) - (input.shortTermValue || 0);
  const sourceBoost = /hold|development|buy-before-role-growth|do-not-panic/i.test(input.sourceAction || '') ? 18 : 0;
  return clampScore(
    (input.rosterWindow === 'rebuilder' ? 28 : input.rosterWindow === 'middle' ? 16 : 8) +
    Math.max(0, valueGap) / 85 +
    sourceBoost
  );
}

function getScheduleSignal(input: {
  scheduleContextScore?: number | null;
  byeAdjustment?: number | null;
}): string | null {
  const score = finiteNumber(input.scheduleContextScore);
  if (score === null) return finiteNumber(input.byeAdjustment) ? 'bye-context' : null;
  if (score === 0) return 'schedule-context';
  return score > 0 ? 'positive-schedule-stretch' : 'negative-schedule-stretch';
}

function buildTradeRead(input: {
  manager: string;
  targetManager?: string | null;
  action: TradeRecommendationRead['action'];
  rosterWindow: DynastyContentionRosterWindow;
  player: ManagerIntelPlayer;
  sourceAction?: string | null;
  shortTermValue: number | null;
  dynastyValue: number | null;
  projectedFantasyPoints: number | null;
  projectionStatus: TradeRecommendationContext['projectionStatus'];
  playoffLeverageScore: number | null;
  scheduleAdjustment?: number | null;
  byeAdjustment?: number | null;
  scheduleContextScore?: number | null;
  sourceTrace: string[];
  baseScore: number;
}): TradeRecommendationRead {
  const valueGap = input.shortTermValue !== null && input.dynastyValue !== null
    ? Math.round(input.shortTermValue - input.dynastyValue)
    : null;
  const contenderFitScore = getContenderFit(input);
  const rebuilderFitScore = getRebuilderFit(input);
  const fragileProjectionSpike = input.sourceAction === 'sell-on-projection-spike';
  const scheduleContextScore = finiteNumber(input.scheduleContextScore);
  const scheduleScoreImpact = scheduleContextScore !== null
    ? Math.max(-70, Math.min(70, scheduleContextScore * 0.08))
    : 0;
  const adjustedBaseScore = input.baseScore + scheduleScoreImpact;
  const scheduleSignal = getScheduleSignal(input);
  const hasFantasyProsComparePlayers = input.sourceTrace.some((trace) => /fantasypros-compare-players/i.test(trace));
  const confidenceReasons = [
    'Trade read separates short-term scoring value from dynasty value.',
    input.playoffLeverageScore !== null ? 'Playoff schedule leverage is attached.' : 'No direct playoff leverage match is attached.',
    `${input.rosterWindow} roster-window fit is attached.`,
    fragileProjectionSpike ? 'Projection-spike fragility is attached.' : null,
    hasFantasyProsComparePlayers ? 'FantasyPros compare-player consensus is attached.' : null,
  ].filter((reason): reason is string => Boolean(reason));
  const projectionCapReason = input.projectionStatus === 'ready'
    ? null
    : 'Weekly projection readiness is not ready; trade confidence is capped to value, roster-window, and playoff context.';
  let confidence = 50 + Math.min(20, Math.max(0, adjustedBaseScore) / 10);
  confidence += input.projectedFantasyPoints !== null ? 8 : 0;
  confidence += input.playoffLeverageScore !== null ? 7 : 0;
  confidence += scheduleSignal ? 4 : 0;
  confidence += Math.max(contenderFitScore, rebuilderFitScore) >= 55 ? 7 : 0;
  confidence += hasFantasyProsComparePlayers ? 4 : 0;

  return {
    id: `${input.manager}:${input.action}:${input.player.player_id}`,
    manager: input.manager,
    targetManager: input.targetManager || null,
    action: input.action,
    sourceAction: input.sourceAction || null,
    rosterWindow: input.rosterWindow,
    player: input.player,
    score: Math.round(adjustedBaseScore),
    confidence: clampScore(Math.min(confidence, input.projectionStatus === 'ready' ? 90 : 62)),
    confidenceReasons,
    confidenceCapReason: projectionCapReason,
    shortTermValue: input.shortTermValue,
    dynastyValue: input.dynastyValue,
    valueGap,
    projectedFantasyPoints: input.projectedFantasyPoints,
    projectionStatus: input.projectedFantasyPoints !== null ? 'ready' : input.projectionStatus,
    playoffLeverageScore: input.playoffLeverageScore,
    scheduleAdjustment: input.scheduleAdjustment ?? null,
    byeAdjustment: input.byeAdjustment ?? null,
    scheduleContextScore: input.scheduleContextScore ?? null,
    contenderFitScore,
    rebuilderFitScore,
    fragileProjectionSpike,
    signals: [
      input.action,
      input.sourceAction || null,
      input.rosterWindow,
      input.projectedFantasyPoints !== null ? 'weekly-projection' : null,
      input.playoffLeverageScore !== null ? 'playoff-leverage' : null,
      scheduleSignal,
      hasFantasyProsComparePlayers ? 'fantasypros-compare-players' : null,
      fragileProjectionSpike ? 'fragile-projection-spike' : null,
    ].filter((signal): signal is string => Boolean(signal)),
    sourceTrace: input.sourceTrace,
  };
}

function fromContentionRead(input: {
  read: DynastyContentionPlayerRead;
  action: TradeRecommendationRead['action'];
  manager: string;
  reportData: ReportData;
}): TradeRecommendationRead {
  const projectionStatus = getProjectionStatus(input.reportData);
  const rosterWindow = getRosterWindow(input.manager, input.reportData);
  const playoffLeverageScore = getPlayoffLeverageScore(input.read.player.player_id, input.manager, input.reportData);
  const fantasyProsCompareTrace = getFantasyProsComparePlayerTrace(input.read.player.player_id, input.reportData);
  const baseScore =
    input.read.score * 0.72 +
    (playoffLeverageScore || 0) * 1.4 +
    (input.action === 'trade-away' && input.read.action === 'sell-on-projection-spike' ? 80 : 0);
  return buildTradeRead({
    manager: input.manager,
    targetManager: input.read.targetManager || input.read.player.owner || null,
    action: input.action,
    rosterWindow,
    player: input.read.player,
    sourceAction: input.read.action,
    shortTermValue: input.read.seasonValue,
    dynastyValue: input.read.dynastyValue,
    projectedFantasyPoints: input.read.projectedFantasyPoints ?? null,
    projectionStatus,
    playoffLeverageScore,
    scheduleAdjustment: input.read.scheduleAdjustment ?? null,
    byeAdjustment: input.read.byeAdjustment ?? null,
    scheduleContextScore: input.read.scheduleContextScore ?? null,
    sourceTrace: [
      ...(input.read.sourceTrace || []),
      fantasyProsCompareTrace,
    ].filter((trace): trace is string => Boolean(trace)),
    baseScore,
  });
}

function fromRookieRead(input: {
  read: RookieDevelopmentRead;
  manager: string;
  reportData: ReportData;
}): TradeRecommendationRead {
  const projectionStatus = getProjectionStatus(input.reportData);
  const rosterWindow = getRosterWindow(input.manager, input.reportData);
  const playoffLeverageScore = getPlayoffLeverageScore(input.read.player.player_id, input.manager, input.reportData);
  const fantasyProsCompareTrace = getFantasyProsComparePlayerTrace(input.read.player.player_id, input.reportData);
  return buildTradeRead({
    manager: input.manager,
    targetManager: input.read.player.owner || null,
    action: 'hold',
    rosterWindow,
    player: input.read.player,
    sourceAction: input.read.action,
    shortTermValue: input.read.player.seasonValue || null,
    dynastyValue: input.read.player.value || null,
    projectedFantasyPoints: input.read.projectedFantasyPoints ?? null,
    projectionStatus,
    playoffLeverageScore,
    scheduleAdjustment: null,
    byeAdjustment: null,
    scheduleContextScore: null,
    sourceTrace: [
      ...(input.read.sourceTrace || []),
      fantasyProsCompareTrace,
    ].filter((trace): trace is string => Boolean(trace)),
    baseScore: input.read.score + (input.read.opportunityRunwayWeeks || 0) * 4,
  });
}

function uniqueReads(reads: TradeRecommendationRead[]): TradeRecommendationRead[] {
  const seen = new Set<string>();
  return reads
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .filter((read) => {
      const key = `${read.action}:${read.player.player_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export function buildTradeRecommendationContext(reportData: ReportData): TradeRecommendationContext | null {
  if (reportData.leagueValueMode === 'redraft') return null;
  const dynastyManagers = reportData.dynastyContentionContext?.managers || [];
  if (!dynastyManagers.length) return null;
  const rookieRows = reportData.rookieDevelopmentContext?.rows || [];
  const projectionStatus = getProjectionStatus(reportData);

  const managers = dynastyManagers.map((managerRead) => {
    const tradeFor = uniqueReads([
      ...managerRead.buyBeforeRoleGrowth.map((read) => fromContentionRead({
        read,
        action: 'trade-for',
        manager: managerRead.manager,
        reportData,
      })),
      ...managerRead.startNow
        .filter((read) => read.targetManager && read.targetManager !== managerRead.manager)
        .map((read) => fromContentionRead({
          read,
          action: 'trade-for',
          manager: managerRead.manager,
          reportData,
        })),
    ]);
    const tradeAway = uniqueReads(managerRead.sellOnProjectionSpike.map((read) => fromContentionRead({
      read,
      action: 'trade-away',
      manager: managerRead.manager,
      reportData,
    })));
    const hold = uniqueReads([
      ...managerRead.doNotPanicRunway.map((read) => fromContentionRead({
        read,
        action: 'hold',
        manager: managerRead.manager,
        reportData,
      })),
      ...managerRead.holdThroughDevelopment.map((read) => fromContentionRead({
        read,
        action: 'hold',
        manager: managerRead.manager,
        reportData,
      })),
      ...rookieRows
        .filter((read) => read.manager === managerRead.manager && ['hold-development', 'stash-patience', 'blocked-by-depth-chart'].includes(read.action))
        .map((read) => fromRookieRead({
          read,
          manager: managerRead.manager,
          reportData,
        })),
    ]);

    return {
      manager: managerRead.manager,
      rosterWindow: managerRead.rosterWindow,
      tradeFor,
      tradeAway,
      hold,
    };
  });
  const rows = managers.flatMap((manager) => [
    ...manager.tradeFor,
    ...manager.tradeAway,
    ...manager.hold,
  ]);

  return {
    status: rows.length ? 'ready' : 'partial',
    source: 'stored-report-trade-recommendation',
    projectionStatus,
    generatedAt: new Date().toISOString(),
    rows,
    managers,
    note: projectionStatus === 'ready'
      ? 'Trade recommendation context separates short-term projection value, dynasty value, playoff leverage, roster-window fit, and fragile projection spikes.'
      : 'Trade recommendation context is capped because weekly projection readiness is not ready.',
  };
}
