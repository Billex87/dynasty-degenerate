import type {
  ManagerIntelPlayer,
  PlayerDetails,
  ReportData,
  RookieDevelopmentAction,
  RookieDevelopmentContext,
  RookieDevelopmentManagerRead,
  RookieDevelopmentRead,
  RookieDevelopmentStage,
} from '../shared/types';

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getProjectionStatus(reportData: ReportData): RookieDevelopmentContext['projectionStatus'] {
  const status = reportData.weeklyProjectionDiagnostics?.status;
  if (status === 'ready' || status === 'warning' || status === 'blocked') return status;
  return 'missing';
}

function getCurrentSeason(reportData: ReportData): number {
  const season = Number(reportData.leagueDiagnostics?.currentSeason || new Date().getUTCFullYear());
  return Number.isInteger(season) ? season : new Date().getUTCFullYear();
}

function getPlayerDetails(player: ManagerIntelPlayer, reportData: ReportData): PlayerDetails | null {
  return reportData.playerDetailsById?.[player.player_id] || player.playerDetails || null;
}

function enrichPlayer(player: ManagerIntelPlayer, reportData: ReportData): ManagerIntelPlayer {
  const playerDetails = getPlayerDetails(player, reportData);
  return playerDetails ? { ...player, playerDetails } : player;
}

function getUniquePlayers(players: Array<ManagerIntelPlayer | null | undefined>): ManagerIntelPlayer[] {
  const seen = new Set<string>();
  return players.filter((player): player is ManagerIntelPlayer => {
    if (!player?.player_id || seen.has(player.player_id)) return false;
    seen.add(player.player_id);
    return true;
  });
}

function getManagerPlayers(reportData: ReportData): Array<{ manager: string; player: ManagerIntelPlayer }> {
  return (reportData.managerRosterIntelligence || []).flatMap((intel) =>
    getUniquePlayers([
      ...(intel.rosterPlayers || []),
      ...(intel.reservePlayers || []),
      ...(intel.taxiPlayers || []),
      ...(intel.benchPlayers || []),
    ]).map((player) => ({
      manager: intel.manager,
      player: enrichPlayer(player, reportData),
    }))
  );
}

function getDevelopmentStage(details: PlayerDetails | null, reportData: ReportData): RookieDevelopmentStage | null {
  const currentSeason = getCurrentSeason(reportData);
  const rookieYear = Number(details?.rookieYear);
  const yearsExp = finiteNumber(details?.yearsExp);
  if (Number.isInteger(rookieYear)) {
    if (rookieYear === currentSeason) return 'rookie';
    if (rookieYear === currentSeason - 1) return 'sophomore';
  }
  if (yearsExp === 0) return 'rookie';
  if (yearsExp === 1) return 'sophomore';
  return null;
}

function getTeamInvestmentScore(details: PlayerDetails | null): number {
  const draftCapital = details?.playerCohort?.draftCapital;
  const tierScore =
    draftCapital?.tier === 'premium' ? 92 :
      draftCapital?.tier === 'day-two' ? 78 :
        draftCapital?.tier === 'late-round' ? 52 :
          draftCapital?.tier === 'undrafted' ? 34 :
            42;
  const depthChartOrder = finiteNumber(details?.depthChartOrder);
  const depthChartBonus = depthChartOrder === 1 ? 10 : depthChartOrder === 2 ? 6 : 0;
  return clampScore(tierScore + depthChartBonus);
}

function getEarlyUsageScore(details: PlayerDetails | null): number {
  const usage = details?.usageTrend;
  if (!usage) return 28;
  const snapPct = finiteNumber(usage.avgOffenseSnapPct);
  const targetShare = finiteNumber(usage.avgTargetShare);
  const recentTargets = finiteNumber(usage.recentTargets);
  const recentCarries = finiteNumber(usage.recentCarries);
  const pointsPerGame = finiteNumber(usage.fantasyPointsPprPerGame);
  const trendBoost =
    usage.targetTrend === 'up' || usage.carryTrend === 'up' ? 12 :
      usage.targetTrend === 'down' || usage.carryTrend === 'down' ? -8 :
        0;
  return clampScore(
    (snapPct !== null ? snapPct * 0.35 : 0) +
    (targetShare !== null ? targetShare * 100 * 0.35 : 0) +
    Math.min(24, ((recentTargets || 0) + (recentCarries || 0)) * 0.8) +
    Math.min(18, (pointsPerGame || 0) * 1.2) +
    trendBoost
  );
}

function getDepthChartBarrierScore(details: PlayerDetails | null): number {
  const depthChartOrder = finiteNumber(details?.depthChartOrder);
  const room = details?.rosterRoom;
  const premiumThreats = room?.premiumAdditions?.length || 0;
  const currentCount = finiteNumber(room?.currentCount);
  const topDepthChartNames = room?.depthChartTop?.map((row) => row.name).filter(Boolean) || [];
  const isInTopGroup = Boolean(details?.fullName && topDepthChartNames.includes(details.fullName));
  return clampScore(
    (depthChartOrder !== null ? Math.max(0, depthChartOrder - 1) * 18 : 18) +
    premiumThreats * 14 +
    (currentCount !== null && currentCount >= 7 ? 12 : 0) -
    (isInTopGroup ? 16 : 0)
  );
}

function getSimilarPlayerOpportunityScore(details: PlayerDetails | null): number | null {
  const receipt = details?.playerCohort?.seasonOutcomeReceipt;
  if (receipt?.displayEligible) {
    return clampScore(
      (receipt.breakoutOrProgressionRate || 0) * 100 * 0.45 +
      (receipt.improvedOrSustainedRate || 0) * 100 * 0.35 +
      (100 - (receipt.materialFailureRate || 0) * 100) * 0.20
    );
  }
  const comps = details?.playerCohort?.historicalComps;
  if (comps?.sampleSize) {
    const positiveSignals = comps.signals.filter((signal) => signal.tone === 'good' || signal.tone === 'info').length;
    const riskSignals = comps.signals.filter((signal) => signal.tone === 'warn' || signal.tone === 'danger').length;
    return clampScore(48 + Math.min(28, positiveSignals * 7) - Math.min(20, riskSignals * 8) + Math.min(12, comps.sampleSize / 8));
  }
  return null;
}

function getOpportunityRunwayWeeks(details: PlayerDetails | null, similarScore: number | null): number | null {
  const draftCapital = details?.playerCohort?.draftCapital;
  const base =
    draftCapital?.opportunityWindow === 'protected-runway' ? 10 :
      draftCapital?.tier === 'premium' ? 9 :
        draftCapital?.tier === 'day-two' ? 7 :
          draftCapital?.tier === 'late-round' ? 4 :
            draftCapital?.tier === 'undrafted' ? 3 :
              null;
  if (base === null) return similarScore !== null ? Math.max(3, Math.round(similarScore / 14)) : null;
  return Math.max(2, base + (similarScore !== null && similarScore >= 70 ? 2 : similarScore !== null && similarScore <= 35 ? -2 : 0));
}

function getDevelopmentAction(input: {
  teamInvestmentScore: number;
  earlyUsageScore: number;
  depthChartBarrierScore: number;
  similarPlayerOpportunityScore: number | null;
  stage: RookieDevelopmentStage;
  details: PlayerDetails | null;
}): RookieDevelopmentAction {
  if (input.earlyUsageScore >= 68 && input.depthChartBarrierScore <= 36) return 'promote-window';
  if (input.earlyUsageScore >= 52 && input.teamInvestmentScore >= 55) return 'usage-ramp';
  if (input.depthChartBarrierScore >= 62 && input.teamInvestmentScore >= 58) return 'blocked-by-depth-chart';
  if (input.teamInvestmentScore >= 70 && input.earlyUsageScore < 45) return 'hold-development';
  if ((input.similarPlayerOpportunityScore || 50) <= 34 && input.teamInvestmentScore <= 52) return 'fragile-profile';
  if (input.stage === 'rookie' || input.details?.rosterStatus === 'Taxi') return 'stash-patience';
  return 'hold-development';
}

function buildDevelopmentRead(input: {
  manager: string;
  player: ManagerIntelPlayer;
  reportData: ReportData;
}): RookieDevelopmentRead | null {
  const details = getPlayerDetails(input.player, input.reportData);
  const stage = getDevelopmentStage(details, input.reportData);
  if (!stage) return null;

  const projectionStatus = getProjectionStatus(input.reportData);
  const weeklyProjection = details?.weeklyProjection?.status === 'ready' ? details.weeklyProjection : null;
  const teamInvestmentScore = getTeamInvestmentScore(details);
  const earlyUsageScore = getEarlyUsageScore(details);
  const depthChartBarrierScore = getDepthChartBarrierScore(details);
  const similarPlayerOpportunityScore = getSimilarPlayerOpportunityScore(details);
  const opportunityRunwayWeeks = getOpportunityRunwayWeeks(details, similarPlayerOpportunityScore);
  const action = getDevelopmentAction({
    teamInvestmentScore,
    earlyUsageScore,
    depthChartBarrierScore,
    similarPlayerOpportunityScore,
    stage,
    details,
  });
  const draftCapital = details?.playerCohort?.draftCapital || null;
  const score = clampScore(
    teamInvestmentScore * 0.30 +
    earlyUsageScore * 0.26 +
    (100 - depthChartBarrierScore) * 0.20 +
    (similarPlayerOpportunityScore ?? 52) * 0.16 +
    (opportunityRunwayWeeks !== null ? Math.min(12, opportunityRunwayWeeks) * 0.8 : 0)
  );
  let confidence = 46;
  const confidenceReasons = [
    'Draft position and team-investment evidence are attached.',
    details?.usageTrend ? 'Early usage trend is attached.' : 'Early usage trend is missing or thin.',
    details?.depthChartOrder || details?.rosterRoom ? 'Depth-chart barrier evidence is attached.' : 'Depth-chart barrier evidence is thin.',
    similarPlayerOpportunityScore !== null ? 'Similar-player opportunity evidence is attached.' : 'Similar-player opportunity evidence is not available.',
  ];
  confidence += teamInvestmentScore >= 70 ? 10 : 5;
  confidence += details?.usageTrend ? 8 : 0;
  confidence += details?.depthChartOrder || details?.rosterRoom ? 7 : 0;
  confidence += similarPlayerOpportunityScore !== null ? 7 : 0;
  confidence += weeklyProjection ? 6 : 0;
  const confidenceCapReason = projectionStatus === 'ready'
    ? null
    : 'Weekly projection readiness is not ready; rookie development confidence is capped to draft, usage, depth-chart, and comp evidence.';

  return {
    id: `${input.manager}:${input.player.player_id}:rookie-development`,
    manager: input.manager,
    player: input.player,
    stage,
    action,
    score,
    confidence: clampScore(Math.min(confidence, projectionStatus === 'ready' ? 88 : 64)),
    confidenceReasons: confidenceReasons.slice(0, 6),
    confidenceCapReason,
    draftCapitalTier: draftCapital?.tier || null,
    opportunityWindow: draftCapital?.opportunityWindow || null,
    teamInvestmentScore,
    earlyUsageScore,
    depthChartBarrierScore,
    similarPlayerOpportunityScore,
    opportunityRunwayWeeks,
    projectedFantasyPoints: weeklyProjection?.projectedFantasyPoints ?? null,
    projectionStatus: weeklyProjection ? 'ready' : projectionStatus,
    signals: [
      `${stage}-development`,
      `action:${action}`,
      draftCapital ? `draft-capital:${draftCapital.tier}` : null,
      weeklyProjection ? 'weekly-projection' : null,
      details?.usageTrend ? 'early-usage' : null,
      details?.depthChartOrder || details?.rosterRoom ? 'depth-chart' : null,
      similarPlayerOpportunityScore !== null ? 'similar-player-opportunity' : null,
    ].filter((signal): signal is string => Boolean(signal)),
    sourceTrace: [
      draftCapital ? `draft-capital:${draftCapital.tier}:${draftCapital.opportunityWindow}` : null,
      details?.usageTrend ? `usage-trend:${details.usageTrend.season || 'season'}` : null,
      details?.rosterRoom ? `roster-room:${details.rosterRoom.season || 'season'}` : null,
      details?.playerCohort?.seasonOutcomeReceipt ? `season-outcome-receipt:${details.playerCohort.seasonOutcomeReceipt.confidenceGrade}` : null,
      weeklyProjection ? `${weeklyProjection.source}:${weeklyProjection.provider || 'unknown'}:${weeklyProjection.week || 'week'}` : null,
    ].filter((trace): trace is string => Boolean(trace)),
  };
}

function groupReadsByAction(reads: RookieDevelopmentRead[]): Omit<RookieDevelopmentManagerRead, 'manager' | 'readCount'> {
  return {
    promoteWindow: reads.filter((read) => read.action === 'promote-window'),
    holdDevelopment: reads.filter((read) => read.action === 'hold-development'),
    usageRamp: reads.filter((read) => read.action === 'usage-ramp'),
    blockedByDepthChart: reads.filter((read) => read.action === 'blocked-by-depth-chart'),
    stashPatience: reads.filter((read) => read.action === 'stash-patience'),
    fragileProfile: reads.filter((read) => read.action === 'fragile-profile'),
  };
}

export function buildRookieDevelopmentContext(reportData: ReportData): RookieDevelopmentContext | null {
  const managerPlayers = getManagerPlayers(reportData);
  if (!managerPlayers.length) return null;
  const projectionStatus = getProjectionStatus(reportData);
  const rows = managerPlayers
    .map(({ manager, player }) => buildDevelopmentRead({ manager, player, reportData }))
    .filter((read): read is RookieDevelopmentRead => Boolean(read))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  const managers = Array.from(new Set(managerPlayers.map((row) => row.manager))).map((manager) => {
    const managerReads = rows.filter((read) => read.manager === manager);
    return {
      manager,
      readCount: managerReads.length,
      ...groupReadsByAction(managerReads),
    };
  });

  return {
    status: rows.length ? 'ready' : 'partial',
    source: 'stored-report-rookie-development',
    projectionStatus,
    generatedAt: new Date().toISOString(),
    rows,
    managers,
    note: projectionStatus === 'ready'
      ? 'Rookie and sophomore development context blends draft position, team investment, early usage, depth-chart barriers, and similar-player opportunity evidence.'
      : 'Rookie and sophomore development context is capped because weekly projection readiness is not ready.',
  };
}
