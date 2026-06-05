import type {
  ContenderPlayoffContext,
  ContenderPlayoffManagerRead,
  ContenderPlayoffStashRecommendation,
  ContenderPlayoffWeekRead,
  DynastyContentionRosterWindow,
  PlayoffSchedulePlanningSummary,
  ReportData,
} from '../shared/types';

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!finite.length) return null;
  return Math.round((finite.reduce((sum, value) => sum + value, 0) / finite.length) * 10) / 10;
}

function getProjectionStatus(reportData: ReportData): ContenderPlayoffContext['projectionStatus'] {
  const status = reportData.weeklyProjectionDiagnostics?.status;
  if (status === 'ready' || status === 'warning' || status === 'blocked') return status;
  return 'missing';
}

function getRosterWindow(row: any): DynastyContentionRosterWindow {
  if (row?.rosterWindow === 'contender' || row?.rosterWindow === 'rebuilder' || row?.rosterWindow === 'middle') {
    return row.rosterWindow;
  }
  return (row?.contenderScore || 0) >= (row?.rebuildScore || 0) + 8 ? 'contender' : 'middle';
}

function getContenderRows(reportData: ReportData): Array<{
  manager: string;
  rosterWindow: DynastyContentionRosterWindow;
  contenderScore: number;
  rebuildScore: number;
}> {
  const rows = (reportData.dynastyContentionContext?.managers || []).map((row) => ({
    manager: row.manager,
    rosterWindow: row.rosterWindow,
    contenderScore: row.contenderScore,
    rebuildScore: row.rebuildScore,
  }));
  if (rows.length) {
    const contenders = rows.filter((row) => row.rosterWindow === 'contender' || row.contenderScore >= 70);
    return contenders.length ? contenders : rows.slice(0, 3);
  }
  const timelineRows = (reportData.dynastyTimelines || [])
    .map((row) => ({
      manager: row.manager,
      rosterWindow: getRosterWindow(row),
      contenderScore: row.contenderScore || 0,
      rebuildScore: row.rebuildScore || 0,
    }))
    .sort((a, b) => b.contenderScore - a.contenderScore);
  return timelineRows.filter((row) => row.rosterWindow === 'contender' || row.contenderScore >= 70).slice(0, 6);
}

type ActionItem = NonNullable<PlayoffSchedulePlanningSummary['actionItems']>[number];
type ManagerPlan = PlayoffSchedulePlanningSummary['managerPlans'][number];
type WeekPlan = ManagerPlan['weeks'][number];

function getActionItemsForWeek(
  playoffSchedulePlanning: PlayoffSchedulePlanningSummary,
  manager: string,
  week: number
): ActionItem[] {
  return (playoffSchedulePlanning.actionItems || []).filter((item) => item.manager === manager && item.week === week);
}

function uniqueStashes(rows: ContenderPlayoffStashRecommendation[]): ContenderPlayoffStashRecommendation[] {
  const seen = new Set<string>();
  return rows
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .filter((row) => {
      if (seen.has(row.playerId)) return false;
      seen.add(row.playerId);
      return true;
    })
    .slice(0, 8);
}

function toStashRecommendations(input: {
  week: number;
  actionItems: ActionItem[];
  plan: ManagerPlan;
}): ContenderPlayoffStashRecommendation[] {
  const replacements = input.actionItems.flatMap((item) => item.replacementTargets || []);
  const priorityAdds = (input.plan.priorityAdds || []).filter((target) => target.targetWeeks.includes(input.week));
  return uniqueStashes([...replacements, ...priorityAdds].map((target) => ({
    playerId: target.playerId,
    name: target.name,
    position: target.position,
    team: target.team,
    targetWeeks: target.targetWeeks || [],
    seasonSOS: target.seasonSOS ?? null,
    scheduleTier: target.scheduleTier ?? null,
    score: Math.round(
      (target.targetWeeks?.includes(input.week) ? 45 : 20)
      + Math.max(0, target.seasonSOS || 0)
      + (target.scheduleTier === 'easy' || target.scheduleTier === 'elite' ? 18 : target.scheduleTier === 'hard' ? -8 : 0)
    ),
    note: target.note || null,
  })));
}

function buildWeekRead(input: {
  manager: string;
  week: WeekPlan;
  plan: ManagerPlan;
  playoffSchedulePlanning: PlayoffSchedulePlanningSummary;
  projectionStatus: ContenderPlayoffContext['projectionStatus'];
}): ContenderPlayoffWeekRead {
  const actionItems = getActionItemsForWeek(input.playoffSchedulePlanning, input.manager, input.week.week);
  const riskPlayers = [
    ...input.week.byePlayers.map((player) => ({ ...player, reason: 'bye' as const })),
    ...input.week.avoidPlayers.map((player) => ({ ...player, reason: 'avoid' as const })),
  ];
  const streamerPlayers = input.week.streamerPlayers.map((player) => ({ ...player, reason: 'streamer' as const }));
  const stashRecommendations = toStashRecommendations({
    week: input.week.week,
    actionItems,
    plan: input.plan,
  });
  const opponentDifficultyScore = clampScore(
    riskPlayers.length * 22
    + input.week.byePlayers.length * 10
    - streamerPlayers.length * 8
    + (input.week.confidence !== undefined && input.week.confidence < 62 ? 10 : 0)
  );
  const byeBenchPressureScore = clampScore(
    input.week.byePlayers.length * 35
    + input.week.avoidPlayers.length * 18
    + Math.max(0, input.plan.riskScore || 0) * 2
    - stashRecommendations.length * 6
  );
  const stashValueScore = clampScore(
    stashRecommendations.length * 18
    + streamerPlayers.length * 12
    + Math.max(0, input.plan.upsideScore || 0) * 3
  );
  const confidenceCapReason = input.projectionStatus === 'ready'
    ? input.week.confidenceCapReason || null
    : 'Weekly projection readiness is not ready; contender playoff context is capped to schedule/value evidence.';

  return {
    id: `${input.manager}-week-${input.week.week}-contender-playoff`,
    manager: input.manager,
    week: input.week.week,
    projectedStarterPoints: input.week.projectedStarterPoints,
    projectionCoverage: input.week.projectionCoverage,
    opponentDifficultyScore,
    byeBenchPressureScore,
    stashValueScore,
    affectedPlayers: [...riskPlayers, ...streamerPlayers],
    stashRecommendations,
    confidence: input.week.confidence || input.plan.confidence || 50,
    confidenceReasons: (input.week.confidenceReasons || input.plan.confidenceReasons || []).slice(0, 6),
    confidenceCapReason,
    sourceTrace: [
      `playoff-schedule:${input.playoffSchedulePlanning.status || 'unknown'}`,
      `projection-coverage:${input.week.projectionCoverage.mode}:${input.week.projectionCoverage.coveredPlayerCount}/${input.week.projectionCoverage.totalPlayerCount}`,
      actionItems.length ? `playoff-actions:${actionItems.length}` : null,
      stashRecommendations.length ? `stash-targets:${stashRecommendations.length}` : null,
    ].filter((trace): trace is string => Boolean(trace)),
  };
}

export function buildContenderPlayoffContext(reportData: ReportData): ContenderPlayoffContext | null {
  const playoffSchedulePlanning = reportData.playoffSchedulePlanning;
  if (!playoffSchedulePlanning?.managerPlans?.length) return null;
  const contenderRows = getContenderRows(reportData);
  if (!contenderRows.length) return null;
  const projectionStatus = getProjectionStatus(reportData);
  const managerPlansByName = new Map(playoffSchedulePlanning.managerPlans.map((plan) => [plan.manager, plan]));
  const managers: ContenderPlayoffManagerRead[] = contenderRows
    .map((contender) => {
      const plan = managerPlansByName.get(contender.manager);
      if (!plan) return null;
      const weeks = plan.weeks.map((week) => buildWeekRead({
        manager: contender.manager,
        week,
        plan,
        playoffSchedulePlanning,
        projectionStatus,
      }));
      const projectedLineupStrength = average(weeks.map((week) => week.projectedStarterPoints));
      const stashRecommendations = uniqueStashes(weeks.flatMap((week) => week.stashRecommendations));
      const confidence = weeks.length
        ? Math.min(...weeks.map((week) => week.confidence))
        : plan.confidence || 50;
      const confidenceCapReason = projectionStatus === 'ready'
        ? null
        : 'Weekly projection readiness is not ready; contender playoff context is capped to schedule/value evidence.';
      return {
        manager: contender.manager,
        rosterWindow: contender.rosterWindow,
        contenderScore: contender.contenderScore,
        rebuildScore: contender.rebuildScore,
        projectedLineupStrength,
        opponentDifficultyScore: clampScore(average(weeks.map((week) => week.opponentDifficultyScore)) || 0),
        byeBenchPressureScore: clampScore(average(weeks.map((week) => week.byeBenchPressureScore)) || 0),
        stashValueScore: clampScore(average(weeks.map((week) => week.stashValueScore)) || 0),
        confidence,
        confidenceReasons: (plan.confidenceReasons || []).slice(0, 6),
        confidenceCapReason,
        weeks,
        stashRecommendations,
      };
    })
    .filter((manager): manager is ContenderPlayoffManagerRead => Boolean(manager));
  const rows = managers.flatMap((manager) => manager.weeks);

  return {
    status: rows.length ? 'ready' : 'partial',
    source: 'stored-report-contender-playoff',
    projectionStatus,
    generatedAt: new Date().toISOString(),
    weeks: playoffSchedulePlanning.weeks || [],
    rows,
    managers,
    note: projectionStatus === 'ready'
      ? 'Contender playoff context summarizes Weeks 15-17 projected lineup strength, schedule difficulty, bye/bench pressure, and stash recommendations.'
      : 'Contender playoff context is capped because weekly projection readiness is not ready.',
  };
}
