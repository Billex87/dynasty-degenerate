import type {
  DynastyContentionAction,
  DynastyContentionContext,
  DynastyContentionManagerRead,
  DynastyContentionPlayerRead,
  DynastyContentionRosterWindow,
  ManagerIntelPlayer,
  PlayerDetails,
  RedraftValuationRow,
  ReportData,
  WeeklyProjectionContext,
} from '../shared/types';

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeValue(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function getProjectionStatus(reportData: ReportData): DynastyContentionContext['projectionStatus'] {
  const status = reportData.weeklyProjectionDiagnostics?.status;
  if (status === 'ready' || status === 'warning' || status === 'blocked') return status;
  return 'missing';
}

function getRosterWindow(input: {
  manager: string;
  reportData: ReportData;
  intel: NonNullable<ReportData['managerRosterIntelligence']>[number];
}): {
  rosterWindow: DynastyContentionRosterWindow;
  contenderScore: number;
  rebuildScore: number;
} {
  const timeline = (input.reportData.dynastyTimelines || []).find((row) => row.manager === input.manager);
  const contenderScore = finiteNumber(timeline?.contenderScore) ?? finiteNumber((input.intel as any).contenderScore) ?? 50;
  const rebuildScore = finiteNumber(timeline?.rebuildScore) ?? finiteNumber((input.intel as any).rebuildScore) ?? 50;
  const label = `${timeline?.label || input.intel.timeline || input.intel.identity || ''}`;
  const rosterWindow: DynastyContentionRosterWindow =
    contenderScore >= rebuildScore + 8 || /contender|win|playoff/i.test(label)
      ? 'contender'
      : rebuildScore >= contenderScore + 8 || /rebuild|future/i.test(label)
        ? 'rebuilder'
        : 'middle';
  return { rosterWindow, contenderScore, rebuildScore };
}

function getPlayerDetails(
  player: ManagerIntelPlayer,
  reportData: ReportData
): PlayerDetails | null {
  return reportData.playerDetailsById?.[player.player_id] || player.playerDetails || null;
}

function enrichPlayer(player: ManagerIntelPlayer, reportData: ReportData): ManagerIntelPlayer {
  const playerDetails = getPlayerDetails(player, reportData);
  return playerDetails ? { ...player, playerDetails } : player;
}

function getReadyProjection(details: PlayerDetails | null): WeeklyProjectionContext | null {
  return details?.weeklyProjection?.status === 'ready' ? details.weeklyProjection : null;
}

function buildRedraftLookup(reportData: ReportData): Map<string, RedraftValuationRow> {
  return new Map((reportData.redraftValuation?.rows || []).map((row) => [row.playerId, row]));
}

function getDynastyValue(player: ManagerIntelPlayer, details: PlayerDetails | null): number | null {
  return safeValue(
    details?.valueProfile?.dynastyValue,
    details?.valueProfile?.balancedValue,
    player.value
  );
}

function getSeasonValue(
  player: ManagerIntelPlayer,
  details: PlayerDetails | null,
  redraftRead: RedraftValuationRow | null
): number | null {
  return safeValue(
    redraftRead?.finalValue,
    details?.valueProfile?.seasonValue,
    details?.valueProfile?.fantasyProsSeasonValue,
    player.seasonValue
  );
}

function getUniquePlayers(players: Array<ManagerIntelPlayer | null | undefined>): ManagerIntelPlayer[] {
  const seen = new Set<string>();
  return players.filter((player): player is ManagerIntelPlayer => {
    if (!player?.player_id || seen.has(player.player_id)) return false;
    seen.add(player.player_id);
    return true;
  });
}

function getManagerPlayers(intel: NonNullable<ReportData['managerRosterIntelligence']>[number]): ManagerIntelPlayer[] {
  return getUniquePlayers([
    ...(intel.rosterPlayers || []),
    ...(intel.reservePlayers || []),
    ...(intel.taxiPlayers || []),
    ...(intel.benchPlayers || []),
  ]);
}

function isStarterLike(player: ManagerIntelPlayer): boolean {
  return Boolean((player as any).isStarter || player.playerDetails?.isStarter);
}

function getSituationLabels(details: PlayerDetails | null): string[] {
  return details?.playerSituationDelta?.labels || [];
}

function hasRoleGrowthSignal(details: PlayerDetails | null): boolean {
  const labels = getSituationLabels(details);
  return Boolean(
    details?.playerSituationDelta?.action === 'buy' ||
    labels.some((label) => ['role-boost', 'vacated-opportunity', 'draft-capital-patience', 'veteran-runway'].includes(label)) ||
    details?.usageTrend?.targetTrend === 'up' ||
    details?.usageTrend?.carryTrend === 'up'
  );
}

function hasRunwayProtection(details: PlayerDetails | null): boolean {
  const draftCapital = details?.playerCohort?.draftCapital;
  return Boolean(
    draftCapital?.opportunityWindow === 'protected-runway' ||
    draftCapital?.tier === 'premium' ||
    draftCapital?.tier === 'day-two' ||
    (draftCapital?.patienceScore || 0) >= 68 ||
    getSituationLabels(details).includes('draft-capital-patience')
  );
}

function isDevelopmentHold(player: ManagerIntelPlayer, details: PlayerDetails | null): boolean {
  const age = finiteNumber(details?.age) ?? finiteNumber((player as any).age);
  return Boolean(
    (age !== null && age <= 24.5 && hasRunwayProtection(details)) ||
    details?.rosterStatus === 'Taxi' ||
    getSituationLabels(details).includes('draft-capital-patience')
  );
}

function buildRead(input: {
  action: DynastyContentionAction;
  manager: string;
  targetManager?: string | null;
  player: ManagerIntelPlayer;
  details: PlayerDetails | null;
  score: number;
  projectionStatus: DynastyContentionContext['projectionStatus'];
  redraftRead: RedraftValuationRow | null;
  reasons: string[];
  signals: string[];
}): DynastyContentionPlayerRead {
  const weeklyProjection = getReadyProjection(input.details);
  const dynastyValue = getDynastyValue(input.player, input.details);
  const seasonValue = getSeasonValue(input.player, input.details, input.redraftRead);
  const valueGap = seasonValue !== null && dynastyValue !== null ? Math.round(seasonValue - dynastyValue) : null;
  const projectionPoints = weeklyProjection?.projectedFantasyPoints ?? null;
  const draftCapital = input.details?.playerCohort?.draftCapital || null;
  const situationDelta = input.details?.playerSituationDelta || null;
  const confidenceReasons = [...input.reasons];
  const sourceTrace = [
    input.projectionStatus === 'ready' && weeklyProjection ? `${weeklyProjection.source}:${weeklyProjection.provider || 'unknown'}:${weeklyProjection.week || 'week'}` : null,
    input.redraftRead ? `stored-redraft-valuation:${input.redraftRead.status}` : null,
    draftCapital ? `draft-capital:${draftCapital.tier}:${draftCapital.opportunityWindow}` : null,
    situationDelta ? `situation-delta:${situationDelta.primaryLabel}:${situationDelta.action}` : null,
    input.details?.valueProfile?.sources?.length ? `value-profile:${input.details.valueProfile.sources.length}-sources` : null,
  ].filter((value): value is string => Boolean(value));

  let confidence = 48 + Math.min(22, Math.max(0, input.score) / 12);
  if (weeklyProjection) {
    confidence += 10;
    confidenceReasons.push('Ready weekly projection evidence is attached.');
  }
  if (input.redraftRead && input.redraftRead.status !== 'value-only') {
    confidence += 8;
    confidenceReasons.push('Projection-aware redraft valuation is attached.');
  } else if (input.redraftRead) {
    confidence += 3;
    confidenceReasons.push('Value-only redraft valuation is attached.');
  }
  if (draftCapital && draftCapital.tier !== 'unknown') {
    confidence += draftCapital.tier === 'premium' ? 8 : 5;
    confidenceReasons.push('Draft-capital runway is attached.');
  }
  if (situationDelta) {
    confidence += Math.min(8, Math.max(0, situationDelta.confidence || 0) / 14);
    confidenceReasons.push('Role and situation delta is attached.');
  }

  const projectionBlockedCapReason = input.projectionStatus === 'ready'
    ? null
    : 'Weekly projection readiness is not ready; contention confidence is capped to value, role, and runway evidence.';
  const cap = input.projectionStatus === 'ready' ? 92 : 64;
  return {
    id: `${input.manager}:${input.action}:${input.player.player_id}`,
    manager: input.manager,
    targetManager: input.targetManager || null,
    action: input.action,
    player: input.player,
    score: Math.round(input.score),
    confidence: clampScore(Math.min(confidence, cap)),
    confidenceReasons: Array.from(new Set(confidenceReasons.filter(Boolean))).slice(0, 6),
    confidenceCapReason: projectionBlockedCapReason,
    signals: Array.from(new Set(input.signals.filter(Boolean))).slice(0, 6),
    dynastyValue,
    seasonValue,
    valueGap,
    projectedFantasyPoints: projectionPoints,
    projectionStatus: weeklyProjection ? 'ready' : input.projectionStatus,
    redraftStatus: input.redraftRead?.status || null,
    draftCapitalTier: draftCapital?.tier || null,
    opportunityWindow: draftCapital?.opportunityWindow || null,
    situationAction: situationDelta?.action || null,
    situationLabels: situationDelta?.labels || [],
    sourceTrace,
  };
}

function sortReads(reads: DynastyContentionPlayerRead[]): DynastyContentionPlayerRead[] {
  return reads.sort((a, b) => b.score - a.score || b.confidence - a.confidence).slice(0, 4);
}

export function buildDynastyContentionContext(reportData: ReportData): DynastyContentionContext | null {
  if (reportData.leagueValueMode === 'redraft') return null;
  const managerRows = reportData.managerRosterIntelligence || [];
  if (!managerRows.length) return null;

  const redraftLookup = buildRedraftLookup(reportData);
  const projectionStatus = getProjectionStatus(reportData);
  const allPlayersByManager = new Map<string, ManagerIntelPlayer[]>(
    managerRows.map((intel) => [
      intel.manager,
      getManagerPlayers(intel).map((player) => enrichPlayer(player, reportData)),
    ])
  );

  const managers: DynastyContentionManagerRead[] = managerRows.map((intel) => {
    const { rosterWindow, contenderScore, rebuildScore } = getRosterWindow({
      manager: intel.manager,
      reportData,
      intel,
    });
    const ownPlayers = allPlayersByManager.get(intel.manager) || [];
    const externalPlayers = Array.from(allPlayersByManager.entries())
      .filter(([manager]) => manager !== intel.manager)
      .flatMap(([manager, players]) => players.map((player) => ({ manager, player })));

    const startNow = sortReads(ownPlayers
      .map((player) => {
        const details = getPlayerDetails(player, reportData);
        const redraftRead = redraftLookup.get(player.player_id) || null;
        const projection = getReadyProjection(details);
        const dynastyValue = getDynastyValue(player, details) || 0;
        const seasonValue = getSeasonValue(player, details, redraftRead) || 0;
        const valueGap = seasonValue - dynastyValue;
        const starterFit = isStarterLike(player);
        const eligible = rosterWindow !== 'rebuilder' && (starterFit || seasonValue >= 3000 || (projection?.projectedFantasyPoints || 0) >= 9);
        if (!eligible) return null;
        const score = seasonValue / 45 + Math.max(0, valueGap) / 12 + (projection?.projectedFantasyPoints || 0) * 24 + (starterFit ? 90 : 0);
        if (score < 120) return null;
        return buildRead({
          action: 'start-now',
          manager: intel.manager,
          player,
          details,
          score,
          projectionStatus,
          redraftRead,
          reasons: ['Current-season value and lineup fit support a start-now window.'],
          signals: ['current-season-value', starterFit ? 'starter-fit' : null, projection ? 'weekly-projection' : null].filter(Boolean) as string[],
        });
      })
      .filter((read): read is DynastyContentionPlayerRead => Boolean(read)));

    const holdThroughDevelopment = sortReads(ownPlayers
      .map((player) => {
        const details = getPlayerDetails(player, reportData);
        if (!isDevelopmentHold(player, details)) return null;
        const redraftRead = redraftLookup.get(player.player_id) || null;
        const draftCapital = details?.playerCohort?.draftCapital;
        const age = finiteNumber(details?.age) ?? finiteNumber((player as any).age) ?? 25;
        const score = (draftCapital?.patienceScore || 55) + Math.max(0, 25 - age) * 14 + (details?.rosterStatus === 'Taxi' ? 30 : 0);
        return buildRead({
          action: 'hold-through-development',
          manager: intel.manager,
          player,
          details,
          score,
          projectionStatus,
          redraftRead,
          reasons: ['Development runway is stronger than the short-term scoring read.'],
          signals: ['draft-capital-runway', details?.rosterStatus === 'Taxi' ? 'taxi-development' : null].filter(Boolean) as string[],
        });
      })
      .filter((read): read is DynastyContentionPlayerRead => Boolean(read)));

    const sellOnProjectionSpike = sortReads(ownPlayers
      .map((player) => {
        const details = getPlayerDetails(player, reportData);
        const projection = getReadyProjection(details);
        const redraftRead = redraftLookup.get(player.player_id) || null;
        const dynastyValue = getDynastyValue(player, details) || 0;
        const seasonValue = getSeasonValue(player, details, redraftRead) || 0;
        const valueGap = seasonValue - dynastyValue;
        const protectedRunway = hasRunwayProtection(details);
        const projectionSpike = (projection?.projectedFantasyPoints || 0) >= 9.5 && (valueGap >= 450 || (redraftRead?.valueDelta || 0) >= 350);
        if (!projectionSpike || (rosterWindow === 'contender' && isStarterLike(player) && protectedRunway)) return null;
        return buildRead({
          action: 'sell-on-projection-spike',
          manager: intel.manager,
          player,
          details,
          score: valueGap / 7 + (projection?.projectedFantasyPoints || 0) * 28 + (protectedRunway ? -80 : 60),
          projectionStatus,
          redraftRead,
          reasons: ['Short-term projection value is ahead of the dynasty runway.'],
          signals: ['projection-spike', valueGap > 0 ? 'season-over-dynasty-gap' : null, protectedRunway ? 'runway-protected' : null].filter(Boolean) as string[],
        });
      })
      .filter((read): read is DynastyContentionPlayerRead => Boolean(read)));

    const buyBeforeRoleGrowth = sortReads(externalPlayers
      .map(({ manager, player }) => {
        const details = getPlayerDetails(player, reportData);
        if (!hasRoleGrowthSignal(details)) return null;
        const redraftRead = redraftLookup.get(player.player_id) || null;
        const dynastyValue = getDynastyValue(player, details) || 0;
        const seasonValue = getSeasonValue(player, details, redraftRead) || 0;
        const age = finiteNumber(details?.age) ?? finiteNumber((player as any).age) ?? 28;
        const budgetAnchor = intel.sellCandidate?.value || intel.tradeChip?.value || 2500;
        const affordable = dynastyValue <= Math.max(7000, budgetAnchor * 1.55);
        if (!affordable || age > 26.5) return null;
        const roleScore = (details?.playerSituationDelta?.score || 55) + (details?.usageTrend?.targetTrend === 'up' || details?.usageTrend?.carryTrend === 'up' ? 30 : 0);
        return buildRead({
          action: 'buy-before-role-growth',
          manager: intel.manager,
          targetManager: manager,
          player,
          details,
          score: roleScore + Math.max(0, seasonValue - dynastyValue) / 20 + Math.max(0, 27 - age) * 8,
          projectionStatus,
          redraftRead,
          reasons: ['Role-growth evidence is visible before the full value move is priced in.'],
          signals: ['role-growth', details?.usageTrend?.targetTrend === 'up' ? 'target-trend-up' : null, details?.usageTrend?.carryTrend === 'up' ? 'carry-trend-up' : null].filter(Boolean) as string[],
        });
      })
      .filter((read): read is DynastyContentionPlayerRead => Boolean(read)));

    const doNotPanicRunway = sortReads(ownPlayers
      .map((player) => {
        const details = getPlayerDetails(player, reportData);
        if (!hasRunwayProtection(details)) return null;
        const projection = getReadyProjection(details);
        const redraftRead = redraftLookup.get(player.player_id) || null;
        const weakShortTermRead = !projection || (projection.projectedFantasyPoints || 0) < 7 || (redraftRead?.valueDelta || 0) < -250;
        const caution = Boolean(details?.playerSituationDelta?.cautionFlags?.length || details?.playerSituationDelta?.action === 'sell');
        if (!weakShortTermRead && !caution) return null;
        const draftCapital = details?.playerCohort?.draftCapital;
        return buildRead({
          action: 'do-not-panic-runway',
          manager: intel.manager,
          player,
          details,
          score: (draftCapital?.patienceScore || 60) + (weakShortTermRead ? 30 : 0) + (caution ? 12 : 0),
          projectionStatus,
          redraftRead,
          reasons: ['Draft-capital and opportunity runway limit the downside of a weak short-term read.'],
          signals: ['draft-capital-runway', weakShortTermRead ? 'weak-short-term-read' : null, caution ? 'situation-caution' : null].filter(Boolean) as string[],
        });
      })
      .filter((read): read is DynastyContentionPlayerRead => Boolean(read)));

    const allManagerReads = [
      ...startNow,
      ...holdThroughDevelopment,
      ...sellOnProjectionSpike,
      ...buyBeforeRoleGrowth,
      ...doNotPanicRunway,
    ];
    const managerConfidence = allManagerReads.length
      ? Math.round(allManagerReads.reduce((sum, read) => sum + read.confidence, 0) / allManagerReads.length)
      : projectionStatus === 'ready' ? 58 : 52;
    const confidenceCapReason = projectionStatus === 'ready'
      ? null
      : 'Weekly projection readiness is not ready; manager contention context is capped to value, role, and runway evidence.';

    return {
      manager: intel.manager,
      rosterWindow,
      contenderScore,
      rebuildScore,
      confidence: clampScore(projectionStatus === 'ready' ? managerConfidence : Math.min(managerConfidence, 64)),
      confidenceReasons: [
        `${rosterWindow} roster window from dynasty timeline.`,
        allManagerReads.length ? `${allManagerReads.length} player-level contention reads passed evidence gates.` : 'No player-level contention read cleared the evidence gates.',
      ],
      confidenceCapReason,
      startNow,
      holdThroughDevelopment,
      sellOnProjectionSpike,
      buyBeforeRoleGrowth,
      doNotPanicRunway,
    };
  });

  const rows = managers.flatMap((manager) => [
    ...manager.startNow,
    ...manager.holdThroughDevelopment,
    ...manager.sellOnProjectionSpike,
    ...manager.buyBeforeRoleGrowth,
    ...manager.doNotPanicRunway,
  ]);

  return {
    status: rows.length ? 'ready' : 'partial',
    source: 'stored-report-dynasty-contention',
    projectionStatus,
    generatedAt: new Date().toISOString(),
    rows,
    managers,
    note: projectionStatus === 'ready'
      ? 'Dynasty contention context blends roster window, current-season value, weekly projection, role growth, and draft-capital runway evidence.'
      : 'Dynasty contention context is capped because weekly projection readiness is not ready.',
  };
}
